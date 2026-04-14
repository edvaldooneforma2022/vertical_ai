/**
 * 🔥 V13.0.2 — RESPONSE BUILDER (ANTI-LOOP DEFINITIVO)
 * 
 * PRINCÍPIO: Sistema → resposta base → IA humaniza → envia
 * 
 * A IA NÃO cria a resposta. O sistema monta a base.
 * A IA recebe a base e SÓ reescreve em linguagem natural.
 * 
 * REGRAS:
 *   - 100% aditivo — novo módulo, não altera existentes
 *   - Protegido por FEATURE_V13_BLINDADO
 *   - try/catch total — fallback para resposta base crua
 *   - Zero impacto em modos manual/desligado
 * 
 * @version 13.0.2
 * @author Link Mágico Team
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════
// RESPONSE BUILDER — Monta resposta base (SEM IA)
// ═══════════════════════════════════════════════════════════════════

/**
 * Monta a resposta base determinística para cada ação.
 * A IA NÃO participa aqui — ela humaniza DEPOIS.
 * 
 * @param {string} action - Ação decidida pelo Rule Engine
 * @param {Object} data - Dados do contexto
 * @param {string} data.checkoutLink - Link de checkout
 * @param {string} data.productName - Nome do produto
 * @param {string} data.productDescription - Descrição do produto
 * @param {string} data.whatsappLink - Link de WhatsApp/suporte
 * @param {string} data.price - Preço do produto (extraído)
 * @param {string} data.guarantee - Garantia do produto
 * @param {string} data.benefits - Benefícios do produto
 * @param {string} data.userMessage - Mensagem do usuário
 * @returns {{ type: string, baseText: string, meta: Object, humanizePrompt: string }}
 */
function buildBaseResponse(action, data = {}) {
    const {
        checkoutLink,
        productName,
        productDescription,
        whatsappLink,
        price,
        guarantee,
        benefits,
        userMessage
    } = data;

    const prodName = productName || 'este produto';

    switch (action) {

        // ═══ CHECKOUT — Link direto, sem enrolação ═══
        case 'TRIGGER_CHECKOUT':
            if (!checkoutLink) {
                return {
                    type: 'checkout_missing',
                    baseText: `Vou verificar o link de acesso para você. Um momento.`,
                    meta: { lockCheckout: false },
                    humanizePrompt: null // Não humanizar — texto já final
                };
            }
            return {
                type: 'checkout',
                baseText: `Aqui está o link para garantir o seu acesso:`,
                meta: { lockCheckout: true, checkoutLink },
                humanizePrompt: `Reescreva de forma natural e curta. MÁXIMO 1 frase. 
NÃO adicione links. NÃO invente informações. O link será adicionado automaticamente.
Texto: "Aqui está o link para garantir o seu acesso."`
            };

        // ═══ PRÉ-CONFIRMAÇÃO — Perguntar antes de enviar ═══
        case 'CONFIRM_BEFORE_CHECKOUT':
            return {
                type: 'confirm',
                baseText: `Posso te enviar o link de acesso agora?`,
                meta: { lockCheckout: false },
                humanizePrompt: `Reescreva de forma natural, curta e amigável. MÁXIMO 2 frases.
Pergunte se o usuário quer receber o link.
NÃO envie links. NÃO invente preços ou informações.
Texto: "Posso te enviar o link de acesso de ${prodName} agora?"`
            };

        // ═══ SHOW_BENEFIT — Mostrar valor do produto ═══
        case 'SHOW_BENEFIT':
            return {
                type: 'benefit',
                baseText: _buildBenefitText(prodName, benefits, productDescription),
                meta: {},
                humanizePrompt: `Reescreva de forma natural e conversacional. MÁXIMO 3 frases.
Use APENAS os dados fornecidos. NÃO invente benefícios.
NÃO envie links. NÃO mencione preço.
Termine com uma pergunta curta.
Texto: "${_buildBenefitText(prodName, benefits, productDescription)}"`
            };

        // ═══ SHOW_BENEFIT_WITH_CTA — Benefício + chamada ═══
        case 'SHOW_BENEFIT_WITH_CTA':
            return {
                type: 'benefit_cta',
                baseText: _buildBenefitCtaText(prodName, benefits, guarantee, productDescription),
                meta: {},
                humanizePrompt: `Reescreva de forma natural e persuasiva. MÁXIMO 3 frases.
Use APENAS os dados fornecidos. NÃO invente.
NÃO envie links. NÃO insira preço. 
Termine perguntando se o usuário quer receber o link.
Texto: "${_buildBenefitCtaText(prodName, benefits, guarantee, productDescription)}"`
            };

        // ═══ HANDLE_OBJECTION — Quebrar objeção ═══
        case 'HANDLE_OBJECTION':
            return {
                type: 'objection',
                baseText: _buildObjectionText(guarantee, prodName),
                meta: { blockPrice: true },
                humanizePrompt: `Reescreva de forma empática e natural. MÁXIMO 3 frases.
PARTE 1: Valide a preocupação (sem ignorar).
PARTE 2: Use o contra-argumento fornecido.
PARTE 3: Pergunte o que mais preocupa.
NÃO invente preço. NÃO pressione. NÃO envie links.
Texto: "${_buildObjectionText(guarantee, prodName)}"`
            };

        // ═══ ANSWER_SIMPLE — Resposta direta ═══
        case 'ANSWER_SIMPLE':
            return {
                type: 'answer',
                baseText: '',  // IA preenche com base no contexto
                meta: { blockPrice: false },
                humanizePrompt: `Responda à pergunta do usuário de forma DIRETA e CURTA. MÁXIMO 3 frases.
Use APENAS informações do produto "${prodName}".
Se não souber a resposta, diga "Não tenho essa informação no momento."
NÃO invente. NÃO envie links. Termine com UMA pergunta curta.
Pergunta do usuário: "${userMessage || ''}"`
            };

        // ═══ WELCOME — Saudação ═══
        case 'WELCOME':
            return {
                type: 'welcome',
                baseText: `Olá! Em que posso te ajudar hoje?`,
                meta: {},
                humanizePrompt: `Reescreva uma saudação curta e natural. MÁXIMO 2 frases.
Pergunte como pode ajudar. SEM emojis excessivos. SEM floreio.
Texto: "Olá! Em que posso te ajudar hoje?"`
            };

        // ═══ ASK_QUESTION — Perguntar para entender ═══
        case 'ASK_QUESTION':
            return {
                type: 'question',
                baseText: `Me conta mais sobre o que você precisa.`,
                meta: {},
                humanizePrompt: `Reescreva de forma natural. MÁXIMO 2 frases.
Faça UMA pergunta para entender o que o usuário precisa.
NÃO venda. NÃO envie links.
Texto: "Me conta mais sobre o que você precisa em relação a ${prodName}."`
            };

        // ═══ SUPPORT — Direcionar para suporte ═══
        case 'SUPPORT':
            return {
                type: 'support',
                baseText: whatsappLink 
                    ? `Fale com nosso time aqui: ${whatsappLink}`
                    : `Nosso time está pronto para te atender.`,
                meta: { lockSupport: true },
                humanizePrompt: null // Não humanizar — texto final
            };

        // ═══ DEFAULT ═══
        default:
            return {
                type: 'default',
                baseText: '',
                meta: {},
                humanizePrompt: `Responda de forma curta e natural à mensagem do usuário.
MÁXIMO 3 frases. NÃO invente informações. NÃO envie links.
Produto: ${prodName}.
Mensagem: "${userMessage || ''}"`
            };
    }
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS — Montagem de texto base
// ═══════════════════════════════════════════════════════════════════

function _buildBenefitText(prodName, benefits, description) {
    if (benefits) {
        return `${prodName} oferece: ${benefits}. Quer saber mais?`;
    }
    if (description) {
        const shortDesc = description.substring(0, 200);
        return `${prodName}: ${shortDesc}. Quer saber mais sobre como funciona?`;
    }
    return `${prodName} pode te ajudar. Me conta o que você precisa saber.`;
}

function _buildBenefitCtaText(prodName, benefits, guarantee, description) {
    let text = '';
    if (benefits) {
        text += `${prodName}: ${benefits}. `;
    } else if (description) {
        text += `${prodName}: ${description.substring(0, 150)}. `;
    }
    if (guarantee) {
        text += `${guarantee}. `;
    }
    text += `Quer que eu te envie o link de acesso?`;
    return text || `${prodName} está disponível. Quer que eu te envie o link de acesso?`;
}

function _buildObjectionText(guarantee, prodName) {
    if (guarantee) {
        return `Entendo sua preocupação. ${prodName} oferece ${guarantee}, então você pode testar sem risco. O que mais te preocupa?`;
    }
    return `Entendo sua preocupação. Me conte o que te preocupa para eu poder te ajudar melhor.`;
}

// ═══════════════════════════════════════════════════════════════════
// POST-GUARDS — Travas absolutas pós-IA
// ═══════════════════════════════════════════════════════════════════

/**
 * Aplica guardas de segurança DEPOIS da IA humanizar
 * @param {string} response - Resposta humanizada pela IA
 * @param {Object} meta - Meta do buildBaseResponse
 * @param {Object} data - Dados do contexto (checkoutLink, etc)
 * @returns {string} Resposta final segura
 */
function applyPostGuards(response, meta = {}, data = {}) {
    let output = response || '';

    try {
        // ═══ GUARD 1: Lock Checkout — Se é ação de checkout, garantir link correto ═══
        if (meta.lockCheckout && data.checkoutLink) {
            // Se IA removeu/alterou o link ou inventou outro → forçar
            // O link será injetado DEPOIS pelo pipeline, então aqui só garantimos que nenhum link falso foi adicionado
            const urlRegex = /https?:\/\/[^\s]+/gi;
            const foundUrls = output.match(urlRegex) || [];
            
            // Remover qualquer URL que a IA tenha inventado
            for (const url of foundUrls) {
                if (url !== data.checkoutLink) {
                    output = output.replace(url, '').trim();
                }
            }
        }

        // ═══ GUARD 2: Bloqueio de preço falso ═══
        if (meta.blockPrice) {
            // Remover menções a preço que a IA possa ter inventado
            output = output.replace(/R\$\s?\d+[.,]?\d*/g, '[valor disponível na página]');
        }

        // ═══ GUARD 3: Lock Support — Se é suporte, manter link correto ═══
        if (meta.lockSupport && data.whatsappLink) {
            if (!output.includes(data.whatsappLink)) {
                output = `${output}\n\n👉 ${data.whatsappLink}`;
            }
        }

        // ═══ GUARD 4: Anti-resposta vazia ═══
        if (!output || output.trim().length < 5) {
            return data.baseText || 'Me conta como posso te ajudar.';
        }

        // ═══ GUARD 5: Anti-resposta gigante (max 500 chars) ═══
        if (output.length > 500) {
            output = output.substring(0, 500).replace(/\s+\S*$/, '') + '...';
        }

        return output.trim();

    } catch (err) {
        console.warn('[V13.0.2] ⚠️ Erro nos post-guards (fallback base):', err.message);
        return data.baseText || response || 'Me conta como posso te ajudar.';
    }
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    buildBaseResponse,
    applyPostGuards
};
