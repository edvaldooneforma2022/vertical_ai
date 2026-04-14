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

    const prodName = _sanitizeProductName(productName) || 'esse produto';
    const prodDesc = productDescription ? productDescription.substring(0, 300) : '';

    switch (action) {

        // ═══ CHECKOUT — Link direto, sem enrolação ═══
        case 'TRIGGER_CHECKOUT': {
            if (!checkoutLink) {
                return {
                    type: 'checkout_missing',
                    baseText: `Vou verificar o link de acesso para você. Um momento.`,
                    meta: { lockCheckout: false },
                    humanizePrompt: null
                };
            }
            // 🔥 Variações anti-robô (deterministic random)
            const _checkoutVariations = [
                'Boa \ud83d\ude04 j\u00e1 te mando o acesso \ud83d\udc47',
                'Perfeito \u2014 pode acessar por aqui \ud83d\udc47',
                'Top! \u00e9 s\u00f3 entrar nesse link \ud83d\udc47',
                'Aqui est\u00e1 o acesso direto \ud83d\udc47'
            ];
            const _checkoutBase = _checkoutVariations[Date.now() % _checkoutVariations.length];
            return {
                type: 'checkout',
                baseText: _checkoutBase,
                meta: { lockCheckout: true, checkoutLink },
                humanizePrompt: null // 🔥 Não humanizar — texto já é natural
            };
        }

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
                humanizePrompt: `Reescreva natural e leve. MÁXIMO 3 frases curtas.
Use SÓ os dados fornecidos. NÃO invente nada.
NÃO envie links. NÃO cite preço.
Termine com pergunta tipo: "quer que eu te mande o acesso?"
Texto: "${_buildBenefitCtaText(prodName, benefits, guarantee, productDescription)}"`
            };

        // ═══ HANDLE_OBJECTION — Quebrar objeção (empático) ═══
        case 'HANDLE_OBJECTION':
            return {
                type: 'objection',
                baseText: _buildObjectionText(guarantee, prodName),
                meta: { blockPrice: true },
                humanizePrompt: `Reescreva empático e direto. MÁXIMO 3 frases curtas.
PARTE 1: Valide ("entendo totalmente")
PARTE 2: Contra-argumento leve
PARTE 3: Pergunta curiosa ("posso te mostrar algo?")
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
${prodDesc ? `Contexto real do produto: "${prodDesc}"` : ''}
Se não souber a resposta, diga "Não tenho essa informação no momento."
PROIBIDO: inventar dados, mencionar Braip, Hotmart, Kiwify, dizer "é um curso", "é uma plataforma".
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

        // ═══ SUPPORT — Direcionar para suporte (SEM CHECKOUT) ═══
        case 'SUPPORT':
            return {
                type: 'support',
                baseText: whatsappLink 
                    ? `Perfeito 👍 vou te conectar com nosso atendimento agora.\n\nÉ só chamar aqui 👇\n${whatsappLink}`
                    : `Perfeito 👍 nosso time está pronto para te atender agora.`,
                meta: { lockSupport: true, blockCheckout: true },
                humanizePrompt: null // Não humanizar — texto já é natural
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

/**
 * Sanitiza nome do produto removendo nomes de plataforma e termos genéricos
 */
function _sanitizeProductName(name) {
    if (!name) return null;
    let clean = name
        .replace(/\b(braip|hotmart|kiwify|eduzz|monetizze|perfect\s*pay|greenn|ticto)\b/gi, '')
        .replace(/\b(curso\s+de|plataforma\s+de|produto\s+digital)\b/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    return clean.length > 2 ? clean : null;
}

function _buildBenefitText(prodName, benefits, description) {
    if (benefits) {
        return `${prodName} oferece: ${benefits}. Quer saber mais?`;
    }
    if (description) {
        const shortDesc = description.substring(0, 200);
        return `${prodName}: ${shortDesc}. Quer saber mais sobre como funciona?`;
    }
    return `Me conta o que você precisa saber e eu te explico.`;
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
    return text || `Quer que eu te envie o link de acesso?`;
}

function _buildObjectionText(guarantee, prodName) {
    if (guarantee) {
        return `Entendo totalmente. ${prodName} tem ${guarantee}, então você pode testar sem risco. Posso te mostrar algo que pode fazer mais sentido pra você?`;
    }
    return `Entendo totalmente o que você quis dizer. Mas deixa eu te mostrar uma opção que pode fazer mais sentido pra você.`;
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

        // ═══ GUARD 2: Bloqueio de preço falso (SEMPRE ativo) ═══
        const _priceRegex = /R\$\s?\d+[.,]?\d*/g;
        if (_priceRegex.test(output)) {
            // Se nenhum preço veio do sistema, a IA inventou → remover
            output = output.replace(/R\$\s?\d+[.,]?\d*/g, '');
            console.warn('[V13.0.2-GUARD] ⛔ Preço inventado removido da resposta');
        }

        // ═══ GUARD 2.5: Bloqueio de nomes de plataforma (ANTI-ALUCINAÇÃO) ═══
        if (/\b(braip|hotmart|kiwify|eduzz|monetizze|perfect\s*pay|greenn|ticto)\b/i.test(output)) {
            output = output.replace(/\b(braip|hotmart|kiwify|eduzz|monetizze|perfect\s*pay|greenn|ticto)\b/gi, '').replace(/\s{2,}/g, ' ').trim();
            console.warn('[V13.0.3-GUARD] ⛔ Nome de plataforma removido da resposta');
        }

        // ═══ GUARD 2.6: Bloqueio de termos genéricos inventados ═══
        if (/\b(é um curso|é uma plataforma|é um produto digital|e um curso|e uma plataforma|e um produto digital)\b/i.test(output)) {
            output = output.replace(/\b(é um curso|é uma plataforma|é um produto digital|e um curso|e uma plataforma|e um produto digital)\b/gi, '').replace(/\s{2,}/g, ' ').trim();
            console.warn('[V13.0.3-GUARD] ⛔ Termo genérico inventado removido');
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
