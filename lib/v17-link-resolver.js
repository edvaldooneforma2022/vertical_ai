// V17.2 — Link Resolver (PATCH FINAL — DECISÃO CORRETA DE CTA)
// REGRA: CTA só aparece com INTENÇÃO CERTA + LINK VÁLIDO

// 🧠 DETECT INTENT
function detectIntent(msg) {
    const m = (msg || '').toLowerCase();

    if (/quero comprar|comprar agora|finalizar|pagar|checkout/.test(m))
        return 'buy';

    if (/link|manda o link|acesso|onde compro/.test(m))
        return 'link_request';

    if (/preço|valor|quanto custa|oferta/.test(m))
        return 'price';

    if (/whatsapp|falar com|atendente|humano|suporte/.test(m))
        return 'support';

    if (/tchau|valeu|obrigado|depois eu vejo/.test(m))
        return 'exit';

    if (/golpe|fraude|confiavel|seguro/.test(m))
        return 'objection';

    if (/não entendi|como funciona|explica/.test(m))
        return 'explain';

    return 'info';
}

// 🧠 TRAVA DE EXIBIÇÃO (O MAIS IMPORTANTE)
function shouldShowCTA(intent, linkData) {
    if (!linkData) return false;

    const allowedIntents = [
        'buy',
        'link_request',
        'price',
        'support'
    ];

    return allowedIntents.includes(intent);
}

// 🔗 PRIORIDADE DE LINKS (CORREÇÃO DO WHATSAPP)
function resolveBestLink(intent, data) {
    // 1. Se pediu suporte → WhatsApp SEMPRE
    if (intent === 'support') {
        return data.whatsappLink || null;
    }

    // 2. Se quer comprar → checkout
    if (intent === 'buy' || intent === 'price') {
        return data.checkoutLink || null;
    }

    // 3. Se pediu link
    if (intent === 'link_request') {
        return (
            data.checkoutLink ||
            data.whatsappLink ||
            data.primaryLink ||
            null
        );
    }

    return null;
}

// 🛑 BLOQUEIO TOTAL DE CTA VAZIO
function buildCTA(link, intent) {
    if (!link) return null;

    const textMap = {
        buy: '🚀 Finalizar Compra',
        price: '💰 Ver Oferta',
        support: '📞 Falar no WhatsApp',
        link_request: '🔗 Acessar'
    };

    return {
        text: textMap[intent] || 'Acessar',
        url: link
    };
}

module.exports = {
    detectIntent,
    shouldShowCTA,
    resolveBestLink,
    buildCTA
};
