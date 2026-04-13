/**
 * 🧩 V13 — STATE MANAGER (MÁQUINA DE ESTADOS COM SCORE)
 * 
 * Gerencia o estado de cada conversa com pontuação de intenção.
 * NÃO é arbitrário (2 interações = WARM).
 * É baseado em score acumulado de intenções reais.
 * 
 * Estados: COLD → WARM → HOT → CHECKOUT_SENT
 * 
 * Score:
 *   READY_TO_BUY  = +5
 *   INTEREST      = +2
 *   DOUBT         = +1
 *   OBJECTION     = -2
 *   GREETING      = 0
 *   GENERIC       = 0
 * 
 * Transições:
 *   score >= 6  → HOT
 *   score >= 3  → WARM
 *   score < 3   → COLD
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════

const SCORE_MAP = {
    READY_TO_BUY: 5,
    INTEREST: 2,
    DOUBT: 1,
    OBJECTION: -2,
    GREETING: 0,
    GENERIC: 0
};

const STAGE_THRESHOLDS = {
    HOT: 6,
    WARM: 3,
    COLD: 0
};

// Tempo máximo de inatividade antes de resetar estado (30 min)
const STATE_TTL_MS = 30 * 60 * 1000;

// Máximo de conversas em memória (cleanup automático)
const MAX_CONVERSATIONS = 5000;

// ═══════════════════════════════════════════════════════════════════
// ARMAZENAMENTO EM MEMÓRIA
// ═══════════════════════════════════════════════════════════════════

const _states = new Map();

/**
 * Estrutura de estado de uma conversa
 */
function createInitialState() {
    return {
        stage: 'COLD',
        score: 0,
        messageCount: 0,
        intents: [],           // histórico de intenções
        lastIntent: null,
        checkoutSent: false,
        checkoutConfirmed: false,  // pré-confirmação antes do checkout
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
}

// ═══════════════════════════════════════════════════════════════════
// FUNÇÕES PRINCIPAIS
// ═══════════════════════════════════════════════════════════════════

/**
 * Obtém ou cria o estado de uma conversa
 * @param {string} conversationId - ID da conversa
 * @returns {Object} Estado atual
 */
function getState(conversationId) {
    if (!conversationId) return createInitialState();

    // Cleanup se necessário
    if (_states.size > MAX_CONVERSATIONS) {
        _cleanupOldStates();
    }

    let state = _states.get(conversationId);

    // Se não existe ou expirou → criar novo
    if (!state || (Date.now() - state.updatedAt) > STATE_TTL_MS) {
        state = createInitialState();
        _states.set(conversationId, state);
    }

    return state;
}

/**
 * Atualiza o estado com base na intenção detectada
 * @param {string} conversationId - ID da conversa
 * @param {string} intent - Intenção classificada
 * @param {string} message - Mensagem original (para histórico)
 * @returns {Object} Estado atualizado com { stage, score, transition }
 */
function updateState(conversationId, intent, message) {
    if (!conversationId) {
        return { stage: 'COLD', score: 0, transition: null };
    }

    const state = getState(conversationId);
    const previousStage = state.stage;

    // Se checkout já foi enviado, não muda mais
    if (state.stage === 'CHECKOUT_SENT') {
        state.updatedAt = Date.now();
        state.messageCount++;
        return { 
            stage: state.stage, 
            score: state.score, 
            transition: null,
            checkoutSent: true,
            checkoutConfirmed: state.checkoutConfirmed
        };
    }

    // Atualizar score
    const intentScore = SCORE_MAP[intent] || 0;
    state.score += intentScore;

    // Não deixar score ficar negativo
    if (state.score < 0) state.score = 0;

    // Registrar intenção
    state.intents.push(intent);
    if (state.intents.length > 20) state.intents.shift(); // manter últimas 20
    state.lastIntent = intent;
    state.messageCount++;
    state.updatedAt = Date.now();

    // Calcular novo estágio baseado em score
    if (state.score >= STAGE_THRESHOLDS.HOT) {
        state.stage = 'HOT';
    } else if (state.score >= STAGE_THRESHOLDS.WARM) {
        state.stage = 'WARM';
    } else {
        state.stage = 'COLD';
    }

    // Detectar transição
    const transition = previousStage !== state.stage 
        ? `${previousStage} → ${state.stage}` 
        : null;

    // Salvar
    _states.set(conversationId, state);

    return {
        stage: state.stage,
        score: state.score,
        transition: transition,
        messageCount: state.messageCount,
        lastIntent: intent,
        checkoutSent: state.checkoutSent,
        checkoutConfirmed: state.checkoutConfirmed
    };
}

/**
 * Marca que o checkout foi enviado
 * @param {string} conversationId 
 */
function markCheckoutSent(conversationId) {
    if (!conversationId) return;
    const state = getState(conversationId);
    state.checkoutSent = true;
    state.stage = 'CHECKOUT_SENT';
    state.updatedAt = Date.now();
    _states.set(conversationId, state);
}

/**
 * Marca que o usuário confirmou que quer o checkout
 * (etapa de pré-confirmação: "Posso enviar o link?")
 * @param {string} conversationId 
 */
function markCheckoutConfirmed(conversationId) {
    if (!conversationId) return;
    const state = getState(conversationId);
    state.checkoutConfirmed = true;
    state.updatedAt = Date.now();
    _states.set(conversationId, state);
}

/**
 * Verifica se precisa pré-confirmação antes de enviar checkout
 * @param {string} conversationId 
 * @returns {boolean}
 */
function needsConfirmation(conversationId) {
    if (!conversationId) return true;
    const state = getState(conversationId);
    return !state.checkoutConfirmed && !state.checkoutSent;
}

/**
 * Retorna estatísticas do state manager
 */
function getStats() {
    return {
        totalConversations: _states.size,
        stages: {
            COLD: [..._states.values()].filter(s => s.stage === 'COLD').length,
            WARM: [..._states.values()].filter(s => s.stage === 'WARM').length,
            HOT: [..._states.values()].filter(s => s.stage === 'HOT').length,
            CHECKOUT_SENT: [..._states.values()].filter(s => s.stage === 'CHECKOUT_SENT').length
        }
    };
}

// ═══════════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════════

function _cleanupOldStates() {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, state] of _states.entries()) {
        if ((now - state.updatedAt) > STATE_TTL_MS) {
            _states.delete(id);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.log(`[V13-STATE] 🧹 Cleanup: ${cleaned} estados expirados removidos`);
    }
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    getState,
    updateState,
    markCheckoutSent,
    markCheckoutConfirmed,
    needsConfirmation,
    getStats,
    SCORE_MAP,
    STAGE_THRESHOLDS
};
