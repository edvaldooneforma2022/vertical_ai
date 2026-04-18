/**
 * 🧠 V15.5 — KNOWLEDGE ENFORCEMENT LAYER (STABLE)
 * 
 * Garante que a IA use conteúdo extraído (V14.3) para:
 * - Explicar o produto de verdade
 * - Responder objeções corretamente
 * - NÃO responder genérico
 * 
 * REGRAS ABSOLUTAS:
 * - V15.5 NÃO força venda
 * - V15.5 NÃO injeta checkout
 * - V15.5 NÃO interfere no V16
 * - V15.5 APENAS corrige respostas ruins usando dados reais
 * 
 * POSIÇÃO NO PIPELINE:
 *   V14.3 (dados) → V13 (resposta base) → Humanizer → 🧠 V15.5 → PP-GLOBAL → Output
 * 
 * @version 1.0.0
 * @requires Feature Flag: FEATURE_V15_KNOWLEDGE_ENFORCER
 */

function normalize(text = '') {
    return text.toLowerCase().trim();
}

function containsAny(text, patterns = []) {
    const t = normalize(text);
    return patterns.some(p => t.includes(p));
}

// ═══════════════════════════════════════════════════════════════════
// 🚫 DETECTOR DE RESPOSTA GENÉRICA
// Identifica respostas que não agregam valor real ao usuário
// ═══════════════════════════════════════════════════════════════════

/**
 * Detecta se a resposta é genérica / sem conteúdo real
 * @param {string} text
 * @returns {boolean}
 */
function isGeneric(text = '') {
    const patterns = [
        'como posso ajudar',
        'me diga o que você precisa',
        'posso te ajudar',
        'já usou algo parecido',
        'deixa eu te explicar melhor',
        'vou te explicar',
        'o que você precisa mesmo',
        'quer conversar sobre',
        'estou aqui para ajudar'
    ];
    return containsAny(text, patterns);
}

// ═══════════════════════════════════════════════════════════════════
// 🧠 EXTRATOR DE CONTEXTO DO PRODUTO
// Extrai informações úteis dos dados extraídos (V14.3)
// ═══════════════════════════════════════════════════════════════════

/**
 * Extrai contexto relevante do produto a partir dos dados extraídos
 * @param {Object} data - Dados extraídos (processedPageData)
 * @returns {{ name: string, description: string }}
 */
function extractContext(data = {}) {
    return {
        name: data.productName || data.title || '',
        description:
            data.description ||
            data.cleanText?.slice(0, 800) ||
            ''
    };
}

// ═══════════════════════════════════════════════════════════════════
// 🧠 DETECTOR DE INTENÇÃO LEVE
// Classifica a mensagem SEM interferir no V16
// ═══════════════════════════════════════════════════════════════════

/**
 * Detecta intenção leve da mensagem (NÃO interfere no V16)
 * @param {string} msg
 * @returns {'buy'|'support'|'objection'|'info'|'unknown'}
 */
function detectIntent(msg = '') {
    const m = normalize(msg);

    if (containsAny(m, ['comprar', 'quero comprar', 'link'])) return 'buy';
    if (containsAny(m, ['whatsapp', 'falar', 'atendente', 'suporte'])) return 'support';
    if (containsAny(m, ['golpe', 'funciona', 'seguro', 'confiável', 'vale a pena'])) return 'objection';
    if (containsAny(m, ['o que é', 'como funciona', 'produto', 'o que você vende'])) return 'info';

    return 'unknown';
}

// ═══════════════════════════════════════════════════════════════════
// 🧠 VERIFICADOR DE RESPOSTA FRACA
// Detecta se a resposta ignora o contexto do produto
// ═══════════════════════════════════════════════════════════════════

/**
 * Verifica se a resposta é fraca / ignora o contexto do produto
 * @param {string} response
 * @param {{ name: string, description: string }} context
 * @returns {boolean}
 */
function isWeakResponse(response, context) {
    if (!response) return true;

    if (response.length < 30) return true;

    if (context.name && !normalize(response).includes(normalize(context.name))) {
        return true;
    }

    return false;
}

// ═══════════════════════════════════════════════════════════════════
// 🧠 CONSTRUTOR DE RESPOSTA INTELIGENTE
// Reconstrói resposta com dados reais quando necessário
// NÃO injeta checkout, NÃO força venda
// ═══════════════════════════════════════════════════════════════════

/**
 * Constrói resposta inteligente baseada em dados reais
 * @param {Object} params
 * @param {'buy'|'support'|'objection'|'info'|'unknown'} params.intent
 * @param {{ name: string, description: string }} params.context
 * @param {Object} params.data - Dados extraídos completos
 * @returns {string|null} - Resposta reconstruída ou null se não aplicável
 */
function buildResponse({ intent, context, data }) {

    const faq = data.faq || [];

    // INFO — Responder com dados reais do produto
    if (intent === 'info') {
        if (faq.length > 0) {
            return `${faq[0].question}\n\n${faq[0].answer || ''}`;
        }

        if (context.description) {
            return context.description.slice(0, 400);
        }
    }

    // OBJEÇÃO — Responder com segurança, SEM forçar checkout
    if (intent === 'objection') {
        return `Entendo sua dúvida 👍

Esse tipo de pergunta é super comum.

O ${context.name || 'produto'} foi desenvolvido justamente para resolver esse problema de forma prática e segura.

Se quiser, posso te explicar exatamente como ele funciona na prática 👇`;
    }

    return null;
}

// ═══════════════════════════════════════════════════════════════════
// 💣 CORE — enforceKnowledge
// Motor principal do V15.5 — corrige respostas ruins usando dados reais
// NÃO toca no V16, NÃO injeta checkout, NÃO sobrescreve resposta boa
// ═══════════════════════════════════════════════════════════════════

/**
 * Motor principal do V15.5 — intercepta e corrige resposta fraca/genérica
 * 
 * @param {Object} params
 * @param {string} params.response - Resposta atual (pós-humanizer)
 * @param {string} params.userMessage - Mensagem do usuário
 * @param {Object} params.extractedData - Dados extraídos da página (pageData)
 * @returns {string} Resposta corrigida ou original
 */
function enforceKnowledge({
    response,
    userMessage,
    extractedData = {}
}) {

    let final = response || '';

    const intent = detectIntent(userMessage);

    const context = extractContext(extractedData);

    // 🚫 REMOVE GENÉRICO
    if (isGeneric(final)) {
        final = '';
    }

    // 🚫 RESPOSTA FRACA OU IGNORANDO CONTEXTO
    if (isWeakResponse(final, context)) {

        const rebuilt = buildResponse({
            intent,
            context,
            data: extractedData
        });

        if (rebuilt) {
            return rebuilt;
        }
    }

    // 🔁 FALLBACK CONTROLADO (SEM FORÇAR VENDA)
    if (!final || final.length < 20) {

        if (context.description) {
            return context.description.slice(0, 300);
        }
    }

    return final;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    enforceKnowledge
};
