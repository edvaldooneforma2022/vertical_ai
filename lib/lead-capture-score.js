/**
 * 🎯 LEAD CAPTURE SCORE — Captura Inteligente Orientada por Intenção
 * 
 * PRINCÍPIO: Atividade ≠ Interesse.
 * A captura ocorre quando há EVIDÊNCIA COMPORTAMENTAL de interesse,
 * NÃO quando há apenas atividade (mensagens, tempo).
 * 
 * CONSOME inteligência existente:
 *   - decision-core.js (detectIntent → buy/interest/info/objection/human/post_sale)
 *   - v13-intent-classifier.js (classifyIntent → READY_TO_BUY/INTEREST/DOUBT/etc)
 *   - CTA Engine signals (cta_candidate, checkout_candidate)
 * 
 * NÃO cria inteligência paralela.
 * NÃO usa captura após X mensagens/segundos.
 * 
 * @version 1.0.0
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════
// SCORE TABLE — Pontuação por sinal comportamental
// ═══════════════════════════════════════════════════════════════════

const SCORE_TABLE = {
    // Intenções do decision-core.js
    intent_buy: 50,           // detectIntent → 'buy'
    intent_interest: 25,      // detectIntent → 'interest'  
    intent_info: 10,          // detectIntent → 'info'
    intent_human: 15,         // detectIntent → 'human' (quer contato)
    intent_post_sale: 30,     // detectIntent → 'post_sale' (já comprou)
    intent_objection: 5,      // detectIntent → 'objection' (engajado, mesmo que resistente)

    // Intenções do v13-intent-classifier.js
    v13_ready_to_buy: 50,     // READY_TO_BUY
    v13_interest: 25,         // INTEREST
    v13_doubt: 15,            // DOUBT (engajado, tem dúvida real)

    // Perguntas sobre temas comerciais (regex direto)
    question_price: 30,       // preço, valor, quanto custa
    question_plan: 25,        // plano, planos, mensalidade
    question_hiring: 30,      // contratar, contratação, assinar
    question_implementation: 20, // implementar, implementação, integrar
    question_integration: 15, // integração, API, webhook
    question_whatsapp: 15,    // WhatsApp, contato, suporte
    question_support: 10,     // suporte, ajuda

    // Sinais comportamentais
    cta_click: 40,            // Clicou em CTA
    checkout_candidate: 40,   // Sistema marcou como checkout candidate
    cta_candidate: 35,        // Sistema marcou como CTA candidate

    // Acumuladores de engajamento (NÃO são gatilhos sozinhos)
    messages_5: 10,           // Conversa > 5 mensagens
    messages_10: 20,          // Conversa > 10 mensagens

    // Detecções do sistema existente
    detection_purchase_intent: 50,   // Sistema detectou intenção de compra
    detection_high_interest: 80,     // Sistema detectou interesse alto
};

// ═══════════════════════════════════════════════════════════════════
// GATILHO DE CAPTURA — Quando disparar?
// ═══════════════════════════════════════════════════════════════════

const CAPTURE_THRESHOLD = 50;

// ═══════════════════════════════════════════════════════════════════
// MENSAGENS CONTEXTUAIS — Baseadas na intenção detectada
// ═══════════════════════════════════════════════════════════════════

const CONTEXTUAL_MESSAGES = {
    purchase: 'Posso registrar seu contato para enviar os detalhes e facilitar os próximos passos?',
    evaluation: 'Se desejar, posso guardar seu contato para continuarmos exatamente deste ponto depois.',
    consultive: 'Posso registrar seu contato e organizar essas informações para você consultar depois.',
    support: 'Para dar continuidade ao seu atendimento, posso registrar seu contato?',
    post_sale: 'Para agilizar seu suporte, posso registrar seu contato?',
    default: 'Posso guardar seu contato para continuarmos essa conversa depois?'
};

// ═══════════════════════════════════════════════════════════════════
// PADRÕES DE DETECÇÃO — Perguntas sobre temas comerciais
// ═══════════════════════════════════════════════════════════════════

function normalize(text = '') {
    return text.toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/gi, '');
}

const TOPIC_PATTERNS = {
    question_price: /(quanto custa|qual o preco|qual o valor|preco|valor|investimento|custo)/,
    question_plan: /(plano|planos|mensalidade|mensal|anual|assinatura)/,
    question_hiring: /(contratar|contratacao|como contrato|assinar|assinatura|aderir|adesao)/,
    question_implementation: /(implementar|implementacao|como comecar|como comeco|prazo|tempo de implementacao)/,
    question_integration: /(integracao|integrar|api|webhook|conectar|plugin)/,
    question_whatsapp: /(whatsapp|whats|zap|wpp|contato direto)/,
    question_support: /(suporte|ajuda|atendimento|duvida sobre uso)/
};

// ═══════════════════════════════════════════════════════════════════
// ESTADO POR SESSÃO — Score acumulado por conversa
// ═══════════════════════════════════════════════════════════════════

const sessionScores = new Map();
const SESSION_TTL = 60 * 60 * 1000; // 1 hora

function getSession(conversationId) {
    if (!conversationId) return null;
    
    let session = sessionScores.get(conversationId);
    if (!session) {
        session = {
            score: 0,
            signals: [],
            messageCount: 0,
            captured: false,
            dismissed: false,
            captureShown: false,
            createdAt: Date.now()
        };
        sessionScores.set(conversationId, session);
    }
    
    // TTL cleanup
    if (Date.now() - session.createdAt > SESSION_TTL) {
        session.score = 0;
        session.signals = [];
        session.messageCount = 0;
        session.captured = false;
        session.dismissed = false;
        session.captureShown = false;
        session.createdAt = Date.now();
    }
    
    return session;
}

// Cleanup periódico (a cada 10 minutos)
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessionScores) {
        if (now - session.createdAt > SESSION_TTL) {
            sessionScores.delete(id);
        }
    }
}, 10 * 60 * 1000);

// ═══════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL: evaluateCapture
// ═══════════════════════════════════════════════════════════════════

/**
 * Avalia se a captura de lead deve ser disparada
 * CONSOME inteligência existente, NÃO cria inteligência paralela
 * 
 * @param {Object} params
 * @param {string} params.conversationId - ID da conversa
 * @param {string} params.message - Mensagem atual do usuário
 * @param {string} [params.dcIntent] - Intent do decision-core.js (buy/interest/info/etc)
 * @param {Object} [params.v13Result] - Resultado do v13-intent-classifier
 * @param {boolean} [params.ctaCandidate] - Se é candidato a CTA (via CTA Engine)
 * @param {boolean} [params.checkoutCandidate] - Se é candidato a checkout
 * @param {boolean} [params.ctaClicked] - Se clicou em CTA
 * @param {Object} [params.inteligencias] - Resultado do sistemaInteligencias.capturarInteligencias()
 * @returns {Object} { shouldCapture, score, signals, captureMessage, captureContext }
 */
function evaluateCapture({
    conversationId,
    message = '',
    dcIntent = null,
    v13Result = null,
    ctaCandidate = false,
    checkoutCandidate = false,
    ctaClicked = false,
    inteligencias = null
}) {
    const session = getSession(conversationId);
    if (!session) {
        return { shouldCapture: false, score: 0, signals: [], captureMessage: null, captureContext: 'none' };
    }

    // Se já capturou ou dispensou, não mostrar novamente
    if (session.captured || session.dismissed) {
        return { shouldCapture: false, score: session.score, signals: session.signals, captureMessage: null, captureContext: 'already_handled' };
    }

    session.messageCount++;
    const msg = normalize(message);
    const newSignals = [];

    // ─── 1. Sinais do decision-core.js (detectIntent) ───
    if (dcIntent) {
        const intentMap = {
            'buy': 'intent_buy',
            'interest': 'intent_interest',
            'info': 'intent_info',
            'human': 'intent_human',
            'post_sale': 'intent_post_sale',
            'objection': 'intent_objection'
        };
        const signal = intentMap[dcIntent];
        if (signal && !session.signals.includes(signal)) {
            session.score += SCORE_TABLE[signal] || 0;
            session.signals.push(signal);
            newSignals.push(signal);
        }
    }

    // ─── 2. Sinais do v13-intent-classifier ───
    if (v13Result && v13Result.intent) {
        const v13Map = {
            'READY_TO_BUY': 'v13_ready_to_buy',
            'INTEREST': 'v13_interest',
            'DOUBT': 'v13_doubt'
        };
        const signal = v13Map[v13Result.intent];
        if (signal && !session.signals.includes(signal)) {
            session.score += SCORE_TABLE[signal] || 0;
            session.signals.push(signal);
            newSignals.push(signal);
        }
    }

    // ─── 3. Perguntas sobre temas comerciais (regex) ───
    for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
        if (pattern.test(msg) && !session.signals.includes(topic)) {
            session.score += SCORE_TABLE[topic] || 0;
            session.signals.push(topic);
            newSignals.push(topic);
        }
    }

    // ─── 4. Sinais comportamentais ───
    if (ctaClicked && !session.signals.includes('cta_click')) {
        session.score += SCORE_TABLE.cta_click;
        session.signals.push('cta_click');
        newSignals.push('cta_click');
    }
    if (checkoutCandidate && !session.signals.includes('checkout_candidate')) {
        session.score += SCORE_TABLE.checkout_candidate;
        session.signals.push('checkout_candidate');
        newSignals.push('checkout_candidate');
    }
    if (ctaCandidate && !session.signals.includes('cta_candidate')) {
        session.score += SCORE_TABLE.cta_candidate;
        session.signals.push('cta_candidate');
        newSignals.push('cta_candidate');
    }

    // ─── 5. Inteligências do sistema existente ───
    if (inteligencias) {
        if (inteligencias.intencao_compra && !session.signals.includes('detection_purchase_intent')) {
            session.score += SCORE_TABLE.detection_purchase_intent;
            session.signals.push('detection_purchase_intent');
            newSignals.push('detection_purchase_intent');
        }
    }

    // ─── 6. Acumuladores de engajamento (NÃO são gatilhos sozinhos) ───
    if (session.messageCount >= 5 && !session.signals.includes('messages_5')) {
        session.score += SCORE_TABLE.messages_5;
        session.signals.push('messages_5');
        newSignals.push('messages_5');
    }
    if (session.messageCount >= 10 && !session.signals.includes('messages_10')) {
        session.score += SCORE_TABLE.messages_10;
        session.signals.push('messages_10');
        newSignals.push('messages_10');
    }

    // ─── DECISÃO DE CAPTURA ───
    const captureContext = determineCaptureContext(dcIntent, v13Result, inteligencias);
    const shouldCapture = (
        session.score >= CAPTURE_THRESHOLD ||
        dcIntent === 'buy' ||
        (v13Result && v13Result.intent === 'READY_TO_BUY') ||
        checkoutCandidate ||
        ctaCandidate
    ) && !session.captureShown;

    // Selecionar mensagem contextual
    let captureMessage = null;
    if (shouldCapture) {
        captureMessage = CONTEXTUAL_MESSAGES[captureContext] || CONTEXTUAL_MESSAGES.default;
        session.captureShown = true;
    }

    console.log(`[LEAD-CAPTURE-SCORE] conv=${conversationId?.substring(0,8)}... score=${session.score} signals=[${newSignals.join(',')}] shouldCapture=${shouldCapture} context=${captureContext}`);

    return {
        shouldCapture,
        score: session.score,
        signals: session.signals,
        newSignals,
        captureMessage,
        captureContext,
        messageCount: session.messageCount
    };
}

/**
 * Determina o contexto da captura baseado nos sinais
 */
function determineCaptureContext(dcIntent, v13Result, inteligencias) {
    // Intenção de compra clara
    if (dcIntent === 'buy' || (v13Result && v13Result.intent === 'READY_TO_BUY')) {
        return 'purchase';
    }
    // Pós-venda
    if (dcIntent === 'post_sale') {
        return 'post_sale';
    }
    // Quer falar com humano/suporte
    if (dcIntent === 'human') {
        return 'support';
    }
    // Interesse comercial
    if (dcIntent === 'interest' || (v13Result && v13Result.intent === 'INTEREST')) {
        return 'evaluation';
    }
    // Dúvida/consultivo
    if (dcIntent === 'info' || (v13Result && v13Result.intent === 'DOUBT')) {
        return 'consultive';
    }
    return 'default';
}

/**
 * Marca que o lead foi capturado (formulário preenchido)
 */
function markCaptured(conversationId) {
    const session = getSession(conversationId);
    if (session) {
        session.captured = true;
        console.log(`[LEAD-CAPTURE-SCORE] ✅ Lead capturado: conv=${conversationId?.substring(0,8)}...`);
    }
}

/**
 * Marca que o usuário dispensou a captura
 */
function markDismissed(conversationId) {
    const session = getSession(conversationId);
    if (session) {
        session.dismissed = true;
        console.log(`[LEAD-CAPTURE-SCORE] ⏭️ Captura dispensada: conv=${conversationId?.substring(0,8)}...`);
    }
}

/**
 * Obtém o score atual sem incrementar
 */
function getScore(conversationId) {
    const session = sessionScores.get(conversationId);
    return session ? session.score : 0;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    evaluateCapture,
    markCaptured,
    markDismissed,
    getScore,
    SCORE_TABLE,
    CAPTURE_THRESHOLD,
    CONTEXTUAL_MESSAGES
};
