// V17.2 — Link Resolver (PATCH DO FUNDADOR — 5 CORREÇÕES CIRÚRGICAS)
// REGRA: CTA só aparece com INTENÇÃO CERTA + LINK VÁLIDO
// REGRA: WhatsApp é fallback real quando não tem checkout
// REGRA: CTA antigo no texto é removido

// ✅ PATCH 2 — DETECT INTENT (CRÍTICO)
function detectIntent(message = '') {
    const msg = message.toLowerCase();

    if (/(comprar|quero comprar|finalizar|checkout|pagar)/.test(msg)) return 'buy';

    if (/(link|manda o link|me envia o link)/.test(msg)) return 'link_request';

    if (/(whatsapp|atendente|humano|suporte|falar com algu[eé]m)/.test(msg)) return 'support';

    if (/(preço|valor|quanto custa)/.test(msg)) return 'price';

    if (/(como funciona|explica|passo a passo)/.test(msg)) return 'explain';

    return 'info';
}

// ✅ PATCH 1 — TRAVAR CTA NO BACKEND (ESSENCIAL)
function shouldShowCTA(intent, link) {
    if (!link) return false;

    const allowedIntents = ['buy', 'link_request', 'support'];

    return allowedIntents.includes(intent);
}

// ✅ PATCH 3 — FALLBACK REAL PARA WHATSAPP
function resolveBestLink(intent, data) {
    const checkout = data?.checkoutLink || null;
    const whatsapp = data?.whatsappLink || null;

    if (intent === 'buy' || intent === 'link_request') {
        if (checkout) return checkout;
        if (whatsapp) return whatsapp; // 🔥 fallback inteligente
    }

    if (intent === 'support') {
        return whatsapp || null;
    }

    return null;
}

// ✅ PATCH 4 — FIREWALL DE SAÍDA (FORTALECIDO)
function stripCTAText(text = '') {
    try {
        return text
            // remove blocos tipo ━━━ ... ━━━
            .replace(/━{3,}[\s\S]*?━{3,}/g, '')

            // remove "FINALIZAR COMPRA"
            .replace(/finalizar compra/gi, '')

            // remove "ACESSAR AGORA"
            .replace(/acessar agora/gi, '')

            // remove emojis comuns de CTA
            .replace(/🚀|👇|🔗/g, '')

            // remove URLs diretas no texto
            .replace(/https?:\/\/[^\s]+/g, '')

            // remove ev.. / pay.. etc
            .replace(/\b\w+\.\.\w+\b/g, '')

            // limpar linhas vazias múltiplas
            .replace(/\n{3,}/g, '\n\n')

            .trim();
    } catch {
        return text;
    }
}

// ✅ PATCH 5 — BUILD CTA À PROVA DE FALHA
function buildCTA(link, intent) {
    if (!link) return null;

    if (intent === 'support') {
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
