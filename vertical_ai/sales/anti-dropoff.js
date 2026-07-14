/**
 * 🛡️ ANTI-DROPOFF — Link Mágico V8.0
 *
 * Detecta intenção de saída e injeta resposta de retenção leve.
 * NÃO é agressivo. NÃO repete padrão. NÃO quebra fluxo.
 *
 * Feature flag: FEATURE_ANTI_DROPOFF
 * Fallback: retorna resposta original sem alteração.
 *
 * @version 1.0.0
 */

'use strict';

// ─────────────────────────────────────────────────────────────────
// PADRÕES DE DETECÇÃO DE SAÍDA
// ─────────────────────────────────────────────────────────────────

const EXIT_PATTERNS = [
    'vou pensar', 'depois vejo', 'não quero', 'nao quero',
    'talvez', 'mais tarde', 'depois eu', 'outro dia',
    'não agora', 'nao agora', 'sem interesse', 'obrigado mas',
    'valeu mas', 'tá bom tchau', 'ta bom tchau', 'até mais',
    'ate mais', 'não é pra mim', 'nao e pra mim', 'tchau',
    'bye', 'deixa pra lá', 'deixa pra la', 'não preciso',
    'nao preciso', 'to sem grana', 'tô sem grana',
    'por enquanto não', 'por enquanto nao', 'no momento não',
    'no momento nao', 'preciso pensar'
];

// ─────────────────────────────────────────────────────────────────
// RESPOSTAS DE RETENÇÃO (LEVES, NÃO AGRESSIVAS)
// ─────────────────────────────────────────────────────────────────

const RETENTION_RESPONSES = [
    'Entendo! Antes de ir, só queria te mostrar uma coisa rápida que costuma mudar a visão de quem estava na mesma dúvida...',
    'Tranquilo! Mas deixa eu compartilhar algo que talvez você não tenha percebido ainda...',
    'Sem problema! Só pra não ficar no ar: tem um detalhe que muita gente só descobre depois...',
    'Ok, respeito total! Mas tem algo que talvez faça diferença na sua decisão...',
    'Tudo bem! Antes de fechar, queria te fazer uma pergunta rápida — pode ser?',
    'Entendo, sem pressão. Mas é que tem um ponto que normalmente muda a percepção...',
    'Beleza, sem stress! Só queria garantir que você viu tudo o que está incluído...',
    'Ok! Mas antes de sair, vale ver isso aqui — muita gente só percebe depois e volta arrependida...'
];

// Anti-repetição por conversa
const _usedRetentions = new Map();

// ─────────────────────────────────────────────────────────────────
// DETECÇÃO DE DROPOFF
// ─────────────────────────────────────────────────────────────────

/**
 * Detecta se o usuário está querendo sair/abandonar.
 *
 * @param {string} userMessage       — Mensagem do usuário
 * @param {object} conversationState — Estado da conversa (opcional)
 * @returns {{ isDropoff: boolean, confidence: number, pattern: string }}
 */
function detectDropoff(userMessage, conversationState = {}) {
    try {
        if (!userMessage || typeof userMessage !== 'string') {
            return { isDropoff: false, confidence: 0, pattern: '' };
        }

        const msgLower = userMessage.toLowerCase().trim();

        // Verificar padrões de saída
        const matchedPatterns = EXIT_PATTERNS.filter(p => msgLower.includes(p));

        if (matchedPatterns.length === 0) {
            return { isDropoff: false, confidence: 0, pattern: '' };
        }

        // Calcular confiança (mais padrões = mais confiança)
        const confidence = Math.min(1.0, matchedPatterns.length * 0.4);

        // Verificar se não é falso positivo (mensagem com interesse real)
        const interestSignals = ['mas', 'porém', 'entretanto', 'só que', 'quero saber',
                                  'me explica', 'quanto custa', 'como funciona'];
        const hasInterest = interestSignals.some(s => msgLower.includes(s));

        if (hasInterest && confidence < 0.6) {
            return { isDropoff: false, confidence: 0, pattern: '' };
        }

        console.log(`🛡️ [ANTI-DROPOFF] Padrão detectado: "${matchedPatterns[0]}" (confidence=${confidence})`);

        return {
            isDropoff: true,
            confidence,
            pattern: matchedPatterns[0]
        };
    } catch (err) {
        console.warn('⚠️ [ANTI-DROPOFF] Erro na detecção:', err.message);
        return { isDropoff: false, confidence: 0, pattern: '' };
    }
}

// ─────────────────────────────────────────────────────────────────
// APLICAR RETENÇÃO
// ─────────────────────────────────────────────────────────────────

/**
 * Aplica camada de retenção se dropoff detectado.
 *
 * @param {string} response        — Resposta atual da IA
 * @param {string} userMessage     — Mensagem do usuário
 * @param {string} conversationId  — ID da conversa
 * @returns {string}               — Resposta com retenção (ou original)
 */
function applyAntiDropoff(response, userMessage, conversationId) {
    try {
        const dropoff = detectDropoff(userMessage);

        if (!dropoff.isDropoff) {
            return response;
        }

        // Obter resposta de retenção não usada nesta conversa
        const convKey = conversationId || '_default';
        if (!_usedRetentions.has(convKey)) {
            _usedRetentions.set(convKey, new Set());
        }
        const used = _usedRetentions.get(convKey);

        const available = RETENTION_RESPONSES.filter(r => !used.has(r));
        if (available.length === 0) {
            // Já usou todas — não forçar. Respeitar saída.
            console.log('🛡️ [ANTI-DROPOFF] Todas as retenções já usadas — respeitando saída');
            return response;
        }

        const selected = available[Math.floor(Math.random() * available.length)];
        used.add(selected);

        // Limitar cache
        if (_usedRetentions.size > 500) {
            const oldest = _usedRetentions.keys().next().value;
            _usedRetentions.delete(oldest);
        }

        // Se a resposta da IA já reconheceu a saída, adicionar retenção sutilmente
        const separator = response.endsWith('\n') ? '' : '\n\n';

        console.log(`🛡️ [ANTI-DROPOFF] Retenção aplicada (confidence=${dropoff.confidence})`);

        return response + separator + selected;
    } catch (err) {
        console.warn('⚠️ [ANTI-DROPOFF] Erro ao aplicar (fallback):', err.message);
        return response;
    }
}

module.exports = { detectDropoff, applyAntiDropoff };
