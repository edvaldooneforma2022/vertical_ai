/**
 * 🔥 V14.0 — CONVERSATION LOGGER
 * 
 * Registra cada interação do chatbot para análise posterior.
 * Fire-and-forget — NUNCA bloqueia a resposta.
 * 
 * @version 14.0.0
 * @requires FEATURE_V14_SELF_OPTIMIZING=true
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════
// CONVERSATION LOGGER — Salva interações no DB
// ═══════════════════════════════════════════════════════════════════

/**
 * Registra uma interação no banco de dados
 * @param {Object} db - Instância do MongoDB
 * @param {Object} data - Dados da interação
 * @returns {Promise<boolean>} true se salvou
 */
async function logConversation(db, data = {}) {
    try {
        if (!db) return false;

        const log = {
            apiKey: data.apiKey || null,
            conversationId: data.conversationId || null,
            userMessage: (data.userMessage || '').substring(0, 500),
            aiResponse: (data.aiResponse || '').substring(0, 1000),
            intent: data.intent || 'UNKNOWN',
            action: data.action || 'UNKNOWN',
            stage: data.stage || 'COLD',
            hadCheckout: !!data.hadCheckout,
            checkoutType: data.checkoutType || null,
            responseTimeMs: data.responseTimeMs || 0,
            v13Pipeline: !!data.v13Pipeline,
            timestamp: new Date(),
            // Outcome será preenchido depois pelo Outcome Detector
            outcome: null
        };

        await db.collection('conversation_logs').insertOne(log);
        console.log(`[V14-LOGGER] 📝 Log salvo | intent=${log.intent} | action=${log.action} | checkout=${log.hadCheckout}`);
        return true;

    } catch (err) {
        console.warn('[V14-LOGGER] ⚠️ Erro ao salvar log (sem impacto):', err.message);
        return false;
    }
}

/**
 * Atualiza outcome de uma conversa
 * @param {Object} db - Instância do MongoDB
 * @param {string} conversationId - ID da conversa
 * @param {Object} outcome - { converted, dropped, askedForSupport }
 */
async function updateOutcome(db, conversationId, outcome) {
    try {
        if (!db || !conversationId) return false;

        const result = await db.collection('conversation_logs').updateMany(
            { conversationId, outcome: null },
            { $set: { outcome, outcomeTimestamp: new Date() } }
        );

        if (result.modifiedCount > 0) {
            console.log(`[V14-LOGGER] 🎯 Outcome atualizado: convId=${conversationId} | converted=${outcome.converted}`);
        }
        return result.modifiedCount > 0;

    } catch (err) {
        console.warn('[V14-LOGGER] ⚠️ Erro ao atualizar outcome:', err.message);
        return false;
    }
}

/**
 * Busca logs recentes para análise
 * @param {Object} db - Instância do MongoDB
 * @param {number} hours - Horas para buscar (default: 24)
 * @param {string} apiKey - Filtrar por tenant (opcional)
 * @returns {Promise<Array>}
 */
async function getRecentLogs(db, hours = 24, apiKey = null) {
    try {
        if (!db) return [];

        const since = new Date(Date.now() - (hours * 60 * 60 * 1000));
        const query = { timestamp: { $gte: since } };
        if (apiKey) query.apiKey = apiKey;

        return await db.collection('conversation_logs')
            .find(query)
            .sort({ timestamp: -1 })
            .limit(1000)
            .toArray();

    } catch (err) {
        console.warn('[V14-LOGGER] ⚠️ Erro ao buscar logs:', err.message);
        return [];
    }
}

/**
 * Cria índices necessários (rodar no boot)
 */
async function ensureIndexes(db) {
    try {
        if (!db) return;

        const col = db.collection('conversation_logs');
        await col.createIndex({ timestamp: -1 });
        await col.createIndex({ apiKey: 1, timestamp: -1 });
        await col.createIndex({ intent: 1, timestamp: -1 });
        await col.createIndex({ conversationId: 1 });
        console.log('[V14-LOGGER] ✅ Índices criados');

    } catch (err) {
        console.warn('[V14-LOGGER] ⚠️ Erro ao criar índices:', err.message);
    }
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    logConversation,
    updateOutcome,
    getRecentLogs,
    ensureIndexes
};
