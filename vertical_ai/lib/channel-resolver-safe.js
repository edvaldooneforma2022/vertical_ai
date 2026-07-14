/**
 * 📞 CHANNEL RESOLVER SAFE LAYER
 * 
 * Garante que o usuário NUNCA fique sem caminho de contato
 * quando a intenção é falar com suporte/humano.
 * 
 * REGRAS (NÃO NEGOCIÁVEIS):
 * - NUNCA sobrescreve WhatsApp já detectado
 * - NUNCA altera fluxo de checkout
 * - NUNCA interfere em respostas fora de "support intent"
 * - APENAS atua quando NÃO existe canal disponível
 * 
 * FONTES DE WHATSAPP (em ordem de prioridade):
 * 1. pageData.whatsappLink (extração) — NÃO TOCA
 * 2. pageData.contatos.whatsapp[0] (extração) — NÃO TOCA
 * 3. pageData.contatos.whatsappLinks[0] (extração) — NÃO TOCA
 * 4. DB tenant (assistentes table) — INJETA se existir
 * 5. Fallback visual ("botão de WhatsApp na tela") — ÚLTIMO RECURSO
 * 
 * @version 1.0.0
 * @author Link Mágico Team
 */

'use strict';

// ═══════════════════════════════════════════════════════════════
// 🔍 SUPPORT INTENT DETECTION
// ═══════════════════════════════════════════════════════════════

const SUPPORT_INTENT_PATTERNS = [
    'atendente', 'suporte', 'falar com alguem', 'falar com alguém',
    'humano', 'preciso de ajuda', 'falar com pessoa', 'pessoa real',
    'quero falar', 'falar com voce', 'falar com você', 'contato humano',
    'alguem de verdade', 'alguém de verdade', 'falar com gente',
    'ajuda humana', 'atendimento', 'reclamacao', 'reclamação',
    'ouvidoria', 'sac', 'central de atendimento'
];

/**
 * Detecta se a mensagem tem intenção de contato com suporte/humano
 */
function isSupportIntent(message) {
    if (!message) return false;
    const normalized = message.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return SUPPORT_INTENT_PATTERNS.some(p => normalized.includes(p));
}

/**
 * Verifica se a intenção V19 é de suporte
 */
function isV19SupportIntent(v19Decision) {
    if (!v19Decision || !v19Decision.intent) return false;
    return v19Decision.intent.intent === 'support';
}

// ═══════════════════════════════════════════════════════════════
// 📞 WHATSAPP RESOLVER
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve o melhor WhatsApp disponível de todas as fontes
 * @returns {string|null} Link WhatsApp ou null
 */
function resolveWhatsApp(pageData, tenantWhatsApp) {
    // 1. Extração (prioridade máxima — dado real)
    if (pageData?.whatsappLink) return pageData.whatsappLink;
    
    // 2. Contatos extraídos
    if (pageData?.contatos?.whatsappLinks && pageData.contatos.whatsappLinks.length > 0) {
        return pageData.contatos.whatsappLinks[0];
    }
    if (pageData?.contatos?.whatsapp && pageData.contatos.whatsapp.length > 0) {
        const num = pageData.contatos.whatsapp[0];
        // Se já é um link, usar direto
        if (num.startsWith('http') || num.startsWith('wa.me')) return num;
        // Formatar número como link wa.me
        const cleaned = num.replace(/\D/g, '');
        if (cleaned.length >= 10) return `https://wa.me/${cleaned}`;
        return num;
    }

    // 3. WhatsApp da página bruta
    if (pageData?.whatsapp) return pageData.whatsapp;

    // 4. Tenant config (DB)
    if (tenantWhatsApp) return tenantWhatsApp;

    // 5. Nenhum encontrado
    return null;
}

// ═══════════════════════════════════════════════════════════════
// 🧠 CHANNEL RESOLVER — Função principal
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve canal de contato quando a resposta é de suporte sem link.
 * 
 * @param {Object} opts
 * @param {string} opts.message - Mensagem do usuário
 * @param {string} opts.response - Resposta atual (pré-channel-resolver)
 * @param {Object} [opts.pageData] - Dados extraídos da página
 * @param {Object} [opts.v19Decision] - Decisão do V19 (se disponível)
 * @param {string} [opts.tenantWhatsApp] - WhatsApp do tenant (DB)
 * @param {string} [opts.channelLabel] - Label customizado ("Falar com especialista")
 * @returns {Object} { response, resolved, source }
 */
function resolve(opts) {
    try {
        const { message, response, pageData, v19Decision, tenantWhatsApp, channelLabel } = opts;

        // 🔒 Só atua em intenção de contato humano
        const hasSupportIntent = isV19SupportIntent(v19Decision) || isSupportIntent(message);
        if (!hasSupportIntent) {
            return { response, resolved: false, reason: 'not_support_intent' };
        }

        // ✅ Verificar se a resposta JÁ tem um link de WhatsApp/contato
        const responseHasLink = response && (
            response.includes('wa.me') ||
            response.includes('whatsapp.com') ||
            response.includes('api.whatsapp') ||
            /\(\d{2}\)\s*\d{4,5}[-.]\d{4}/.test(response) ||
            /\d{10,13}/.test(response)
        );

        if (responseHasLink) {
            return { response, resolved: false, reason: 'response_already_has_contact' };
        }

        // 🔍 Resolver WhatsApp de todas as fontes
        const whatsappLink = resolveWhatsApp(pageData, tenantWhatsApp);

        if (whatsappLink) {
            // ✅ WhatsApp encontrado → injetar na resposta
            const label = channelLabel || 'Fale direto no WhatsApp';
            const newResponse = `Perfeito 👍 vou te conectar com alguém do nosso time agora.\n\n📞 ${label}:\n${whatsappLink}\n\nEles vão te ajudar rapidinho 🙌`;
            
            console.log(`[CHANNEL-RESOLVER] ✅ WhatsApp injetado | source=${whatsappLink.substring(0, 40)}`);
            return { response: newResponse, resolved: true, source: 'whatsapp_injected' };
        }

        // ⚠️ FALLBACK INTELIGENTE (sem link nenhum)
        // Verifica se a resposta atual é um dead-end
        const isDeadEnd = response && (
            response.includes('Fale com a gente') ||
            response.includes('nosso time está pronto') ||
            response.includes('atendente agora') ||
            response.length < 80
        );

        if (isDeadEnd) {
            const fallbackResponse = `Perfeito 👍 você pode falar com alguém direto pelo site.\n\n👉 É só clicar no botão de WhatsApp que fica no canto da tela.\n\nSe preferir, mande uma mensagem aqui que eu te ajudo no que puder 🙌`;
            
            console.log(`[CHANNEL-RESOLVER] ⚠️ Fallback visual (sem WhatsApp detectado)`);
            return { response: fallbackResponse, resolved: true, source: 'fallback_visual' };
        }

        // Resposta não é dead-end → não alterar
        return { response, resolved: false, reason: 'response_is_actionable' };

    } catch (err) {
        console.error('[CHANNEL-RESOLVER] ❌ Erro:', err.message);
        return { response: opts.response, resolved: false, reason: 'error', error: err.message };
    }
}

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
    resolve,
    resolveWhatsApp,
    isSupportIntent,
    isV19SupportIntent,
    SUPPORT_INTENT_PATTERNS
};
