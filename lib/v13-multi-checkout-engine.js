/**
 * 🔥 V13.2 — MULTI-CHECKOUT ENGINE (MONETIZAÇÃO AUTOMÁTICA)
 * 
 * Decide QUAL checkout usar com base em contexto real.
 * Suporta: primary, upsell, downsell, cross-sell.
 * 
 * REGRAS:
 *   - 100% aditivo — novo módulo
 *   - Protegido por FEATURE_V13_MULTI_CHECKOUT
 *   - IA NUNCA decide checkout — backend soberano
 *   - Fallback: se falhar, usa checkout principal
 *   - Nunca envia mais de 1 link por resposta
 *   - Nunca ativa se não houver baseCheckout
 *   - Zero impacto em modos manual/desligado
 * 
 * @version 13.2.0
 * @author Link Mágico Team
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════
// MULTI-CHECKOUT RESOLVER
// ═══════════════════════════════════════════════════════════════════

/**
 * Decide qual checkout enviar com base no contexto completo.
 * 
 * HIERARQUIA (NUNCA quebrada):
 *   1. Checkout confirmado (DB) → prioridade máxima
 *   2. Checkout detectado (V11) → segunda prioridade
 *   3. Multi-checkout (V13.2) → camada de decisão sobre o acima
 * 
 * @param {Object} params
 * @param {string} params.action - Ação do Rule Engine (TRIGGER_CHECKOUT, etc)
 * @param {string} params.intent - Intenção classificada (READY_TO_BUY, OBJECTION, etc)
 * @param {string} params.stage - Estágio do funil (COLD, WARM, HOT)
 * @param {string} params.baseCheckout - Checkout principal já resolvido
 * @param {Object} params.context - Dados adicionais
 * @param {string[]} params.context.upsells - URLs de upsell
 * @param {string[]} params.context.downsells - URLs de downsell
 * @param {string} params.context.objectionType - Tipo de objeção (price, trust, etc)
 * @param {number} params.context.messageCount - Número de mensagens na conversa
 * @param {boolean} params.context.checkoutAlreadySent - Se checkout já foi enviado
 * @returns {{ type: string, url: string, label: string, reason: string } | null}
 */
function resolveCheckout({
    action,
    intent,
    stage,
    baseCheckout,
    context = {}
}) {
    try {
        // ═══ GUARD: Sem checkout principal → nada a fazer ═══
        if (!baseCheckout) {
            return null;
        }

        const {
            upsells = [],
            downsells = [],
            objectionType,
            messageCount = 0,
            checkoutAlreadySent = false
        } = context;

        // Validar arrays
        const validUpsells = Array.isArray(upsells) ? upsells.filter(u => u && typeof u === 'string' && u.startsWith('http')) : [];
        const validDownsells = Array.isArray(downsells) ? downsells.filter(d => d && typeof d === 'string' && d.startsWith('http')) : [];

        // ═══ REGRA 1: Compra direta (HOT) → checkout principal SEMPRE ═══
        if (action === 'TRIGGER_CHECKOUT') {
            // Se já enviou checkout e tem upsell → oferecer upsell na segunda vez
            if (checkoutAlreadySent && validUpsells.length > 0) {
                console.log('[V13.2] 📈 Upsell pós-checkout detectado');
                return {
                    type: 'upsell',
                    url: validUpsells[0],
                    label: 'VER VERSÃO COMPLETA',
                    reason: 'post_checkout_upsell'
                };
            }

            // Primeira compra → checkout principal
            return {
                type: 'primary',
                url: baseCheckout,
                label: 'FINALIZAR COMPRA',
                reason: 'direct_buy'
            };
        }

        // ═══ REGRA 2: Objeção de preço → downsell ═══
        if (intent === 'OBJECTION' && objectionType === 'price') {
            if (validDownsells.length > 0) {
                console.log('[V13.2] 📉 Downsell por objeção de preço');
                return {
                    type: 'downsell',
                    url: validDownsells[0],
                    label: 'VER OPÇÃO MAIS ACESSÍVEL',
                    reason: 'price_objection_downsell'
                };
            }
            // Sem downsell → manter principal (com objeção tratada pelo V13)
            return {
                type: 'primary',
                url: baseCheckout,
                label: 'FINALIZAR COMPRA',
                reason: 'objection_no_downsell'
            };
        }

        // ═══ REGRA 3: Interesse quente (WARM/HOT) → upsell contextual ═══
        if ((stage === 'WARM' || stage === 'HOT') && validUpsells.length > 0) {
            // Só oferece upsell se a conversa já avançou (>3 mensagens)
            if (messageCount > 3) {
                console.log('[V13.2] 📈 Upsell contextual (conversa quente)');
                return {
                    type: 'upsell',
                    url: validUpsells[0],
                    label: 'VER VERSÃO COMPLETA',
                    reason: 'warm_upsell'
                };
            }
        }

        // ═══ REGRA 4: Confirm before checkout → checkout principal ═══
        if (action === 'CONFIRM_BEFORE_CHECKOUT') {
            return {
                type: 'primary',
                url: baseCheckout,
                label: 'FINALIZAR COMPRA',
                reason: 'confirm_primary'
            };
        }

        // ═══ DEFAULT: Checkout principal ═══
        return {
            type: 'primary',
            url: baseCheckout,
            label: 'FINALIZAR COMPRA',
            reason: 'default'
        };

    } catch (err) {
        console.warn('[V13.2] ⚠️ Erro no Multi-Checkout (fallback para principal):', err.message);
        return baseCheckout ? {
            type: 'primary',
            url: baseCheckout,
            label: 'FINALIZAR COMPRA',
            reason: 'error_fallback'
        } : null;
    }
}

/**
 * Detecta tipo de objeção do usuário
 * @param {string} message - Mensagem do usuário
 * @returns {string|null} Tipo: 'price', 'trust', 'timing', 'value', null
 */
function detectObjectionType(message) {
    if (!message) return null;
    const msg = message.toLowerCase();

    // Preço
    if (/\b(caro|muito caro|tá caro|ta caro|não tenho dinheiro|nao tenho dinheiro|investimento alto|puxado)\b/i.test(msg)) {
        return 'price';
    }

    // Confiança
    if (/\b(não confio|nao confio|golpe|fraude|pirâmide|piramide|reclame aqui)\b/i.test(msg)) {
        return 'trust';
    }

    // Timing
    if (/\b(agora não|agora nao|depois|mais tarde|pensar|vou pensar|preciso pensar)\b/i.test(msg)) {
        return 'timing';
    }

    // Valor
    if (/\b(não vale|nao vale|não funciona|nao funciona|não serve|nao serve)\b/i.test(msg)) {
        return 'value';
    }

    return null;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    resolveCheckout,
    detectObjectionType
};
