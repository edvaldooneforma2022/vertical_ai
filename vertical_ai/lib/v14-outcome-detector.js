/**
 * 🔥 V14.0 — OUTCOME DETECTOR
 * 
 * Analisa o resultado de cada interação:
 * - Converteu? (checkout enviado + clicou)
 * - Abandonou? (parou de responder)
 * - Pediu suporte?
 * 
 * @version 14.0.0
 * @requires FEATURE_V14_SELF_OPTIMIZING=true
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════
// OUTCOME DETECTOR
// ═══════════════════════════════════════════════════════════════════

/**
 * Detecta o outcome de uma interação
 * @param {Object} interaction - Dados da interação
 * @returns {{ converted: boolean, dropped: boolean, askedForSupport: boolean, engaged: boolean }}
 */
function detectOutcome(interaction = {}) {
    try {
        const {
            intent,
            action,
            hadCheckout,
            userMessage,
            aiResponse,
            nextMessageExists
        } = interaction;

        const msg = (userMessage || '').toLowerCase();

        // ═══ CONVERTED — checkout foi enviado ═══
        const converted = !!(hadCheckout && (
            action === 'TRIGGER_CHECKOUT' ||
            (aiResponse && aiResponse.includes('FINALIZAR COMPRA'))
        ));

        // ═══ DROPPED — sem continuação após última mensagem ═══
        const dropped = !nextMessageExists && !converted && intent !== 'SUPPORT';

        // ═══ SUPPORT — pediu atendimento humano ═══
        const askedForSupport = intent === 'SUPPORT';

        // ═══ ENGAGED — continuou conversando (positivo) ═══
        const engaged = !!nextMessageExists && !askedForSupport;

        return {
            converted,
            dropped,
            askedForSupport,
            engaged,
            score: _calculateScore(converted, dropped, engaged, askedForSupport)
        };

    } catch (err) {
        console.warn('[V14-OUTCOME] ⚠️ Erro:', err.message);
        return {
            converted: false,
            dropped: false,
            askedForSupport: false,
            engaged: false,
            score: 0
        };
    }
}

/**
 * Calcula score numérico do outcome
 * +10 conversão, +5 engajamento, -5 abandono, -2 suporte
 */
function _calculateScore(converted, dropped, engaged, support) {
    let score = 0;
    if (converted) score += 10;
    if (engaged) score += 5;
    if (dropped) score -= 5;
    if (support) score -= 2;
    return score;
}

/**
 * Processa outcomes em batch (para logs antigos)
 * @param {Object} db - MongoDB
 * @param {Array} logs - Array de logs para processar
 */
async function processOutcomesBatch(db, logs = []) {
    try {
        if (!db || logs.length === 0) return { processed: 0 };

        let processed = 0;

        // Agrupar logs por conversationId
        const conversations = {};
        for (const log of logs) {
            const convId = log.conversationId || 'unknown';
            if (!conversations[convId]) conversations[convId] = [];
            conversations[convId].push(log);
        }

        // Para cada conversa, detectar outcome da última mensagem
        for (const [convId, msgs] of Object.entries(conversations)) {
            const sorted = msgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            const last = sorted[sorted.length - 1];
            const hasNext = sorted.length > 1;

            const outcome = detectOutcome({
                ...last,
                nextMessageExists: hasNext
            });

            // Atualizar no DB
            try {
                const { updateOutcome } = require('./v14-conversation-logger');
                await updateOutcome(db, convId, outcome);
                processed++;
            } catch (_) {}
        }

        console.log(`[V14-OUTCOME] 🎯 Batch processado: ${processed} conversas`);
        return { processed };

    } catch (err) {
        console.warn('[V14-OUTCOME] ⚠️ Erro no batch:', err.message);
        return { processed: 0 };
    }
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    detectOutcome,
    processOutcomesBatch
};
