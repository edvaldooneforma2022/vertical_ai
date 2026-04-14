/**
 * 🧩 V13 — RULE ENGINE (CÉREBRO REAL — HARD RULES)
 * 
 * Recebe (intent, state) → decide action.
 * A IA NÃO DECIDE ISSO.
 * 
 * Ações:
 *   WELCOME              → Saudação inicial
 *   ANSWER_SIMPLE         → Responder dúvida de forma direta
 *   SHOW_BENEFIT          → Mostrar benefício do produto
 *   SHOW_BENEFIT_WITH_CTA → Benefício + chamada para ação
 *   HANDLE_OBJECTION      → Quebrar objeção sem pressão
 *   CONFIRM_BEFORE_CHECKOUT → Pré-confirmação antes do link
 *   TRIGGER_CHECKOUT      → Disparar checkout (fora da IA)
 *   ASK_QUESTION          → Fazer pergunta para entender o usuário
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════
// TABELA DE DECISÃO (intent × state → action)
// ═══════════════════════════════════════════════════════════════════

/**
 * Decide a ação com base na intenção e estado
 * @param {string} intent - Intenção classificada
 * @param {Object} stateInfo - { stage, score, checkoutSent, checkoutConfirmed, messageCount }
 * @param {Object} context - { hasCheckoutLink, productName, checkoutLink }
 * @returns {{ action: string, reason: string, sendCheckout: boolean }}
 */
function decideAction(intent, stateInfo, context = {}) {
    const stage = stateInfo.stage || 'COLD';
    const checkoutSent = stateInfo.checkoutSent || false;
    const checkoutConfirmed = stateInfo.checkoutConfirmed || false;
    const hasCheckout = !!(context.checkoutLink);

    // ═══ READY_TO_BUY — 🔥 CHECKOUT DIRETO (SEM ENROLAÇÃO) ═══
    if (intent === 'READY_TO_BUY') {
        // 🔥 Se tem checkout → ENVIAR IMEDIATO (sem confirmar)
        if (hasCheckout) {
            return {
                action: 'TRIGGER_CHECKOUT',
                reason: checkoutSent ? 'buy_intent_resend' : 'buy_intent_direct',
                sendCheckout: true
            };
        }

        // Sem checkout disponível → CTA para manter engajamento
        return {
            action: 'SHOW_BENEFIT_WITH_CTA',
            reason: 'buy_intent_no_checkout',
            sendCheckout: false
        };
    }

    // ═══ SUPPORT — 🚫 NUNCA CHECKOUT (prioridade máxima) ═══
    if (intent === 'SUPPORT') {
        return {
            action: 'SUPPORT',
            reason: 'support_requested',
            sendCheckout: false,
            blockCheckout: true,
            priority: 999
        };
    }

    // ═══ OBJECTION ═══
    if (intent === 'OBJECTION') {
        return {
            action: 'HANDLE_OBJECTION',
            reason: 'objection_detected',
            sendCheckout: false
        };
    }

    // ═══ INTEREST ═══
    if (intent === 'INTEREST') {
        if (stage === 'HOT' && hasCheckout) {
            return {
                action: 'SHOW_BENEFIT_WITH_CTA',
                reason: 'interest_hot_with_cta',
                sendCheckout: false
            };
        }
        if (stage === 'WARM') {
            return {
                action: 'SHOW_BENEFIT_WITH_CTA',
                reason: 'interest_warm',
                sendCheckout: false
            };
        }
        return {
            action: 'SHOW_BENEFIT',
            reason: 'interest_cold',
            sendCheckout: false
        };
    }

    // ═══ DOUBT ═══
    if (intent === 'DOUBT') {
        return {
            action: 'ANSWER_SIMPLE',
            reason: 'doubt_direct_answer',
            sendCheckout: false
        };
    }

    // ═══ GREETING ═══
    if (intent === 'GREETING') {
        return {
            action: 'WELCOME',
            reason: 'greeting',
            sendCheckout: false
        };
    }

    // ═══ GENERIC (fallback) ═══
    return {
        action: 'ASK_QUESTION',
        reason: 'generic_fallback',
        sendCheckout: false
    };
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    decideAction
};
