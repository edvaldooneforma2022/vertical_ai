// V17.3 — Link Resolver (PATCH FINAL REFINADO)
// REGRA: CTA só aparece com INTENÇÃO CERTA + LINK VÁLIDO
// REGRA: WhatsApp é fallback real quando não tem checkout
// REGRA: CTA antigo no texto é removido (incluindo domínios sem protocolo)
// REGRA: "link não abriu" → fallback WhatsApp

// ✅ DETECT INTENT (REFINADO)
function detectIntent(message = '') {
    const msg = message.toLowerCase();

    // Prioridade 0: Falha de link → fallback WhatsApp
    if (/(n[aã]o abriu|n[aã]o funciona|erro no link|link quebrado|link errado|outro n[aã]o abriu)/.test(msg))
        return 'link_broken';

    // Suporte / humano
    if (/(whatsapp|atendente|humano|suporte|falar com algu[eé]m)/.test(msg))
        return 'support';

    // Compra explícita
    if (/(comprar|quero comprar|finalizar|checkout|pagar)/.test(msg))
        return 'buy';

    // Pedido de link
    if (/(link|manda o link|me envia o link|onde compro)/.test(msg))
        return 'link_request';

    // Preço forte (quer saber valor = perto de comprar)
    if (/(quanto custa|preço|qual o valor)/.test(msg))
        return 'price_strong';

    // Preço objeção (acha caro = NÃO mostrar CTA)
    if (/(caro|barato|vale a pena|achei caro|muito caro)/.test(msg))
        return 'price_objection';

    // Explicação
    if (/(como funciona|explica|passo a passo)/.test(msg))
        return 'explain';

    return 'info';
}

// ✅ TRAVAR CTA NO BACKEND
function shouldShowCTA(intent, link) {
    if (!link) return false;

    const allowedIntents = ['buy', 'link_request', 'support', 'link_broken', 'price_strong'];

    return allowedIntents.includes(intent);
}

// ✅ FALLBACK REAL PARA WHATSAPP
function resolveBestLink(intent, data) {
    const checkout = data?.checkoutLink || null;
    const whatsapp = data?.whatsappLink || null;

    // Link quebrado → forçar WhatsApp
    if (intent === 'link_broken') {
        return whatsapp || null;
    }

    if (intent === 'buy' || intent === 'link_request' || intent === 'price_strong') {
        if (checkout) return checkout;
        if (whatsapp) return whatsapp; // fallback inteligente
    }

    if (intent === 'support') {
        return whatsapp || null;
    }

    return null;
}

// ✅ FIREWALL DE SAÍDA (NÍVEL SAAS GLOBAL)
function stripCTAText(text = '') {
    try {
        if (!text || typeof text !== 'string') return text;

        return text
            // remove blocos com qualquer tipo de linha decorativa
            .replace(/[━─—]{3,}[\s\S]*?[━─—]{3,}/g, '')

            // remove linhas isoladas de separadores
            .replace(/^[━─—\s]+$/gm, '')

            // remove CTAs clássicos
            .replace(/finalizar compra/gi, '')
            .replace(/acessar agora/gi, '')
            .replace(/clique abaixo/gi, '')
            .replace(/compre agora/gi, '')

            // remove emojis de CTA
            .replace(/[🚀👇🔗🎁🛒💳]/g, '')

            // remove QUALQUER URL com protocolo
            .replace(/https?:\/\/[^\s]+/g, '')

            // remove domínios sem protocolo (ev.braip.com, pay.hotmart.com, etc)
            .replace(/\b[a-z0-9.-]+\.(com|br|net|org)\b/gi, '')

            // remove padrões truncados (ev..com)
            .replace(/\b\w+\.\.\w+\b/g, '')

            // limpar linhas vazias múltiplas
            .replace(/\n{3,}/g, '\n\n')

            .trim();
    } catch {
        return text;
    }
}

// ✅ BUILD CTA À PROVA DE FALHA
function buildCTA(link, intent) {
    if (!link) return null;

    if (intent === 'support' || intent === 'link_broken') {
        return {
            text: 'Falar no WhatsApp',
            url: link
        };
    }

    return {
        text: 'Finalizar compra',
        url: link
    };
}

module.exports = {
    detectIntent,
    shouldShowCTA,
    resolveBestLink,
    stripCTAText,
    buildCTA
};
