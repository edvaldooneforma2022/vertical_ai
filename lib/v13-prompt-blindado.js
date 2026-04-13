/**
 * 🧩 V13 — PROMPT BLINDADO (IA CONTROLADA)
 * 
 * A IA recebe um prompt CURTO, DIRETO e TRAVADO.
 * Ela NÃO decide nada. Ela renderiza texto controlado.
 * 
 * HARD LIMITS na LLM:
 *   max_tokens: 150
 *   temperature: 0.3
 *   top_p: 0.7
 */

'use strict';

const { buildTemplateInstruction } = require('./v13-response-templates');

// ═══════════════════════════════════════════════════════════════════
// PROMPT BLINDADO (NÃO MODIFICAR SEM RAZÃO)
// ═══════════════════════════════════════════════════════════════════

const PROMPT_BLINDADO_BASE = `Você NÃO é uma IA livre.
Você é um componente controlado de um sistema de vendas.

REGRAS ABSOLUTAS:
1. Você NÃO pode inventar informações.
2. Você NÃO pode assumir nada que não foi dito pelo usuário.
3. Você NÃO pode responder fora do contexto da pergunta.
4. Você NÃO pode florear, expandir ou "embelezar" respostas.
5. Você NÃO pode criar explicações desnecessárias.
6. Você NÃO pode mudar de assunto.
7. Você NÃO pode oferecer checkout sem instrução do sistema.
8. Você NÃO pode se identificar como ChatGPT, GPT, ou qualquer IA.

SE NÃO TIVER CERTEZA:
→ faça uma pergunta curta e objetiva
→ nunca complete com suposição

FORMATO:
- Frases curtas
- Sem parágrafos longos
- Sem storytelling
- Sem criatividade desnecessária
- Sem emojis excessivos (máximo 1 por resposta)
- Sem tags HTML

ANTI-ALUCINAÇÃO:
Antes de responder, valide:
- Isso foi dito pelo usuário? Se não → NÃO diga
- Isso existe no contexto? Se não → NÃO diga
- Isso é necessário? Se não → NÃO diga

Responda sempre em português do Brasil.`;

// ═══════════════════════════════════════════════════════════════════
// HARD LIMITS PARA A LLM
// ═══════════════════════════════════════════════════════════════════

const LLM_HARD_LIMITS = {
    max_tokens: 150,
    temperature: 0.3,
    top_p: 0.7
};

// ═══════════════════════════════════════════════════════════════════
// FUNÇÕES
// ═══════════════════════════════════════════════════════════════════

/**
 * Monta o system prompt completo para a IA V13
 * @param {Object} params
 * @param {string} params.action - Ação decidida pelo Rule Engine
 * @param {string} params.intent - Intenção classificada
 * @param {Object} params.pageData - Dados da página (título, descrição, preço, etc)
 * @param {string} params.userInstructions - Instruções customizadas do operador
 * @returns {string} System prompt completo
 */
function buildBlindadoPrompt({ action, intent, pageData = {}, userInstructions = '' }) {
    // Contexto extraído da página (MÍNIMO necessário)
    const contextData = {
        productName: pageData.title || '',
        price: (pageData.price_detected && pageData.price_detected.length > 0) 
            ? pageData.price_detected.join(', ') : '',
        benefit: pageData.description || '',
        guarantee: '',
        bonuses: (pageData.bonuses_detected && pageData.bonuses_detected.length > 0) 
            ? pageData.bonuses_detected.join(', ') : '',
        testimonial: '',
        urgency: ''
    };

    // Extrair garantia e urgência do conteúdo se disponível
    if (pageData.cleanText) {
        const text = pageData.cleanText.substring(0, 3000);
        const garantiaMatch = text.match(/garantia\s+de\s+(\d+\s+dias?)/i);
        if (garantiaMatch) contextData.guarantee = garantiaMatch[0];
    }

    // Template de instrução baseado na ação
    const templateInstruction = buildTemplateInstruction(action, contextData);

    // Contexto da página (compacto — sem o prompt gigante)
    const pageContext = `
CONTEXTO DO PRODUTO:
Título: ${pageData.title || 'Não disponível'}
${contextData.price ? 'Preço: ' + contextData.price : ''}
${pageData.description ? 'Sobre: ' + pageData.description.substring(0, 300) : ''}
${contextData.bonuses ? 'Bônus: ' + contextData.bonuses : ''}
${contextData.guarantee ? 'Garantia: ' + contextData.guarantee : ''}

CONTEÚDO RELEVANTE:
${pageData.cleanText ? pageData.cleanText.substring(0, 2000) : 'Não disponível'}`;

    // Instruções do operador (se houver)
    const operatorBlock = userInstructions 
        ? `\nINSTRUÇÕES DO OPERADOR (respeite):\n${userInstructions.substring(0, 500)}` 
        : '';

    // Informações de contato (se disponíveis)
    let contactBlock = '';
    if (pageData.contatos) {
        const c = pageData.contatos;
        if (c.whatsapp && c.whatsapp.length > 0) contactBlock += `\nWhatsApp: ${c.whatsapp[0]}`;
        if (c.email && c.email.length > 0) contactBlock += `\nEmail: ${c.email[0]}`;
    }

    // MONTAGEM FINAL — ordem importa:
    // 1. Quem você é (blindado)
    // 2. O que fazer agora (template)
    // 3. Com que dados (contexto)
    // 4. Instruções extras (operador)
    return PROMPT_BLINDADO_BASE 
        + '\n\n' + templateInstruction 
        + '\n\n' + pageContext
        + operatorBlock
        + (contactBlock ? '\n\nCONTATOS DISPONÍVEIS:' + contactBlock : '');
}

/**
 * Retorna os hard limits para a chamada LLM
 * @returns {Object} { max_tokens, temperature, top_p }
 */
function getLLMHardLimits() {
    return { ...LLM_HARD_LIMITS };
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    buildBlindadoPrompt,
    getLLMHardLimits,
    PROMPT_BLINDADO_BASE,
    LLM_HARD_LIMITS
};
