/**
 * 📊 V12 — LEARNING MEMORY (FEEDBACK LOOP)
 * 
 * Sistema de aprendizado que registra falhas e padrões de sucesso.
 * Permite identificar e corrigir comportamentos recorrentes.
 * 
 * @version 12.0.0
 * @author Link Mágico Team
 */

// Memória de falhas por tenant
const _failureMemory = new Map();
// Memória de padrões de sucesso
const _successMemory = new Map();
// Máximo de entradas por tenant
const MAX_ENTRIES_PER_TENANT = 100;

/**
 * Registra uma falha para aprendizado futuro
 * @param {string} apiKey
 * @param {string} failureType
 * @param {Object} context - Contexto adicional
 */
function saveFailure(apiKey, failureType, context = {}) {
    try {
        if (!apiKey || !failureType) return;

        const key = apiKey.substring(0, 20);
        if (!_failureMemory.has(key)) {
            _failureMemory.set(key, []);
        }

        const failures = _failureMemory.get(key);
        failures.push({
            type: failureType,
            timestamp: Date.now(),
            intent: context.intent || 'unknown',
            messagePreview: (context.message || '').substring(0, 50)
        });

        // Limitar tamanho
        if (failures.length > MAX_ENTRIES_PER_TENANT) {
            failures.splice(0, failures.length - MAX_ENTRIES_PER_TENANT);
        }

        console.log(`[LEARNING] 📝 Falha registrada: tenant=${key.substring(0, 8)}... type=${failureType} total=${failures.length}`);
    } catch (_) {}
}

/**
 * Registra um sucesso para aprendizado
 * @param {string} apiKey
 * @param {string} intent
 * @param {Object} context
 */
function saveSuccess(apiKey, intent, context = {}) {
    try {
        if (!apiKey) return;

        const key = apiKey.substring(0, 20);
        if (!_successMemory.has(key)) {
            _successMemory.set(key, []);
        }

        const successes = _successMemory.get(key);
        successes.push({
            intent: intent || 'unknown',
            timestamp: Date.now(),
            hadCheckout: !!context.checkoutLink,
            responseLength: (context.response || '').length
        });

        if (successes.length > MAX_ENTRIES_PER_TENANT) {
            successes.splice(0, successes.length - MAX_ENTRIES_PER_TENANT);
        }
    } catch (_) {}
}

/**
 * Retorna estatísticas de falhas de um tenant
 * @param {string} apiKey
 * @returns {Object} Stats
 */
function getFailureStats(apiKey) {
    try {
        const key = (apiKey || '').substring(0, 20);
        const failures = _failureMemory.get(key) || [];
        
        const stats = {};
        for (const f of failures) {
            stats[f.type] = (stats[f.type] || 0) + 1;
        }

        return {
            total: failures.length,
            byType: stats,
            lastFailure: failures.length > 0 ? failures[failures.length - 1] : null
        };
    } catch (_) {
        return { total: 0, byType: {}, lastFailure: null };
    }
}

/**
 * Detecta padrões recorrentes de falha
 * @param {string} apiKey
 * @returns {{ hasPattern: boolean, dominantFailure: string|null, frequency: number }}
 */
function detectPattern(apiKey) {
    try {
        const stats = getFailureStats(apiKey);
        
        if (stats.total < 3) {
            return { hasPattern: false, dominantFailure: null, frequency: 0 };
        }

        // Encontrar falha mais frequente
        let dominant = null;
        let maxCount = 0;
        for (const [type, count] of Object.entries(stats.byType)) {
            if (count > maxCount) {
                maxCount = count;
                dominant = type;
            }
        }

        const frequency = maxCount / stats.total;
        const hasPattern = frequency > 0.5 && maxCount >= 3;

        if (hasPattern) {
            console.log(`[LEARNING] 🔄 Padrão detectado: tenant=${(apiKey || '').substring(0, 8)}... type=${dominant} freq=${(frequency * 100).toFixed(0)}%`);
        }

        return { hasPattern, dominantFailure: dominant, frequency };
    } catch (_) {
        return { hasPattern: false, dominantFailure: null, frequency: 0 };
    }
}

/**
 * Limpa memória de um tenant
 */
function clearMemory(apiKey) {
    if (apiKey) {
        const key = apiKey.substring(0, 20);
        _failureMemory.delete(key);
        _successMemory.delete(key);
    }
}

module.exports = { saveFailure, saveSuccess, getFailureStats, detectPattern, clearMemory };
