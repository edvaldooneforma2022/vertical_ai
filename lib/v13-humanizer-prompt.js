/**
 * 🔥 V13.1 — HUMANIZER PROMPT (CAMADA EMOCIONAL)
 * 
 * Transforma robô que vende → humano que convence.
 * A IA NÃO cria resposta. Ela REESCREVE o texto base como humano.
 * 
 * REGRAS:
 *   - 100% aditivo — novo módulo
 *   - Protegido por FEATURE_V13_BLINDADO
 *   - Fallback: se falhar, usa texto base  
 *   - Zero impacto em modos manual/desligado
 * 
 * @version 13.1.0
 * @author Link Mágico Team
 */

'use strict';

/**
 * Monta o prompt de humanização para a IA.
 * A IA recebe o texto base e SÓ reescreve em linguagem natural.
 * 
 * @param {string} baseResponse - Texto base montado pelo sistema
 * @param {Object} context - Contexto adicional
 * @param {string} context.intent - Intenção classificada
 * @param {string} context.action - Ação do rule engine
 * @param {string} context.productName - Nome do produto
 * @param {string} context.stage - Estágio do funil (COLD/WARM/HOT)
 * @returns {string} Prompt completo para a IA
 */
function buildHumanizerPrompt(baseResponse, context = {}) {
    const { intent, action, productName, stage } = context;

    // Dicas por tipo de ação (micro-ajustes de tom)
    let toneTip = '';
    switch (action) {
        case 'TRIGGER_CHECKOUT':
            toneTip = 'Tom: animado e direto. O usuário JÁ quer comprar.';
            break;
        case 'CONFIRM_BEFORE_CHECKOUT':
            toneTip = 'Tom: confiante e leve. Confirme sem pressionar.';
            break;
        case 'HANDLE_OBJECTION':
            toneTip = 'Tom: empático e paciente. Nunca julgue a objeção.';
            break;
        case 'SHOW_BENEFIT':
        case 'SHOW_BENEFIT_WITH_CTA':
            toneTip = 'Tom: entusiasmado mas sem exagerar. Mostre valor real.';
            break;
        case 'WELCOME':
            toneTip = 'Tom: acolhedor e casual. Como receber alguém na sua casa.';
            break;
        case 'ANSWER_SIMPLE':
            toneTip = 'Tom: claro e objetivo. Responda e pergunte uma coisa.';
            break;
        case 'SUPPORT':
            toneTip = 'Tom: prestativo e direto. Encaminhe para o suporte.';
            break;
        default:
            toneTip = 'Tom: natural e conversacional.';
    }

    return `Você é um humano real conversando no WhatsApp.
Seu nome é o assistente de vendas ${productName ? `do produto "${productName}"` : 'da empresa'}.

REGRAS:
- Fale como gente normal, não como robô
- Use frases curtas (máximo 3 linhas)
- Pode usar leve emoção (😄 👍 🔥 👇) — máximo 2 emojis
- Pode quebrar linha para dar ritmo
- Pode fazer micro-perguntas no final
- Seja direto, sem enrolação

PROIBIDO (ABSOLUTO):
- Inventar preço ou valor (R$, reais, etc)
- Inventar link ou URL
- Inventar bônus ou garantia que não foi informada
- Alterar a intenção da resposta
- Adicionar informações que não estão no texto base
- Usar mais de 120 palavras

${toneTip}

IMPORTANTE:
Você NÃO está criando uma resposta nova.
Você está APENAS REESCREVENDO o texto abaixo de forma mais humana e conversacional.
Mantenha EXATAMENTE a mesma intenção e informações.

TEXTO BASE PARA REESCREVER:
"${baseResponse}"

RESPOSTA HUMANIZADA:`;
}

/**
 * Valida resposta humanizada — anti-alucinação pós-IA
 * Se falhar, retorna o texto base original (seguro)
 * 
 * @param {string} humanized - Resposta humanizada pela IA
 * @param {string} baseResponse - Texto base original (fallback)
 * @param {Object} options - Opções
 * @param {boolean} options.allowPrice - Se deve permitir menção a preço
 * @returns {{ valid: boolean, response: string, issues: string[] }}
 */
function validateHumanizedResponse(humanized, baseResponse, options = {}) {
    const issues = [];

    if (!humanized || typeof humanized !== 'string' || humanized.trim().length < 3) {
        return { valid: false, response: baseResponse, issues: ['empty_response'] };
    }

    const text = humanized.trim();

    // ═══ GUARD 1: Anti preço inventado ═══
    if (!options.allowPrice) {
        const priceRegex = /R\$\s?\d+/;
        if (priceRegex.test(text)) {
            // Verificar se o preço já estava no baseResponse
            if (!priceRegex.test(baseResponse || '')) {
                issues.push('price_invented');
                console.warn('[V13.1-GUARD] ⛔ Preço inventado detectado na humanização');
                return { valid: false, response: baseResponse, issues };
            }
        }
    }

    // ═══ GUARD 2: Anti URL inventada ═══
    const urlRegex = /https?:\/\/|www\./i;
    if (urlRegex.test(text)) {
        // Se o baseResponse não tinha URL, a IA inventou
        if (!urlRegex.test(baseResponse || '')) {
            issues.push('url_invented');
            console.warn('[V13.1-GUARD] ⛔ URL inventada detectada na humanização');
            return { valid: false, response: baseResponse, issues };
        }
    }

    // ═══ GUARD 3: Anti resposta gigante (max 500 chars) ═══
    if (text.length > 500) {
        issues.push('too_long');
        const trimmed = text.substring(0, 500).replace(/\s+\S*$/, '') + '...';
        return { valid: true, response: trimmed, issues };
    }

    // ═══ GUARD 4: Anti repetição do prompt ═══
    if (text.includes('TEXTO BASE') || text.includes('RESPOSTA HUMANIZADA') || text.includes('PROIBIDO')) {
        issues.push('prompt_leak');
        console.warn('[V13.1-GUARD] ⛔ Vazamento de prompt detectado');
        return { valid: false, response: baseResponse, issues };
    }

    // ═══ GUARD 5: Anti robô (detectar padrões robóticos) ═══
    const robotPatterns = [
        /^(com base|de acordo com|conforme|segundo)/i,
        /^(como assistente|como um assistente|eu sou um)/i
    ];
    for (const pattern of robotPatterns) {
        if (pattern.test(text)) {
            issues.push('robotic_start');
            // Não rejeita, só reporta
        }
    }

    return { valid: true, response: text, issues };
}

module.exports = {
    buildHumanizerPrompt,
    validateHumanizedResponse
};
