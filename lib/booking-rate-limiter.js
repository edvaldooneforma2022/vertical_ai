/**
 * 🛡️ RATE LIMITER - Agendamento Público (Fase 2B)
 * Limitação em memória por hash de calendário com comportamento FAIL-CLOSED.
 * Teto estrito de 1.000 entradas com expiração e limpeza automática.
 */

'use strict';

const RATE_LIMIT_WINDOW_MS = 60000;    // 1 minuto
const RATE_LIMIT_MAX_REQUESTS = 5;      // 5 requisições por minuto por hash
const RATE_LIMIT_MAX_ENTRIES = 1000;    // Máximo de hashes rastreados simultaneamente

const _bookingRateLimit = new Map();

/**
 * Limpar entradas expiradas no Map de rate limit.
 * @returns {number} Quantidade de entradas removidas
 */
function cleanupBookingRateLimitMap() {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, val] of _bookingRateLimit) {
        val.timestamps = val.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
        if (val.timestamps.length === 0) {
            _bookingRateLimit.delete(key);
            cleaned++;
        }
    }
    return cleaned;
}

/**
 * Verificar se uma requisição para o hash é permitida.
 * Comportamento FAIL-CLOSED: se a capacidade máxima for atingida mesmo após limpeza, bloqueia.
 *
 * @param {string} hash - Hash do calendário público
 * @returns {boolean} true se permitido, false se bloqueado (HTTP 429)
 */
function checkBookingRateLimit(hash) {
    if (!hash || typeof hash !== 'string') return false;

    const now = Date.now();
    let entry = _bookingRateLimit.get(hash);

    if (entry) {
        entry.timestamps = entry.timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
        if (entry.timestamps.length === 0) {
            _bookingRateLimit.delete(hash);
            entry = null;
        }
    }

    // Se é nova entrada e o Map atingiu o teto, tentar limpeza imediata
    if (!entry && _bookingRateLimit.size >= RATE_LIMIT_MAX_ENTRIES) {
        cleanupBookingRateLimitMap();

        // Se após limpeza o Map continua no teto: FAIL-CLOSED (bloquear)
        if (_bookingRateLimit.size >= RATE_LIMIT_MAX_ENTRIES) {
            console.error(
                `🚨 [RATE-LIMIT][FAIL-CLOSED] Capacidade máxima atingida (${_bookingRateLimit.size}/${RATE_LIMIT_MAX_ENTRIES}). `
                + `Requisição bloqueada para hash=${hash.substring(0, 8)}...`
            );
            return false;
        }
    }

    if (!entry) {
        entry = { timestamps: [] };
        _bookingRateLimit.set(hash, entry);
    }

    if (entry.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
        return false; // Excedeu limite da janela
    }

    entry.timestamps.push(now);
    return true;
}

/**
 * Obter o Map de rate limit (para inspeção e testes)
 */
function getBookingRateLimitMap() {
    return _bookingRateLimit;
}

/**
 * Resetar o Map de rate limit (para testes)
 */
function resetBookingRateLimitMap() {
    _bookingRateLimit.clear();
}

module.exports = {
    RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_MAX_ENTRIES,
    checkBookingRateLimit,
    cleanupBookingRateLimitMap,
    getBookingRateLimitMap,
    resetBookingRateLimitMap
};
