/**
 * ⚡ RATE LIMITER PERSISTENTE - Link Mágico
 * Rate limiting baseado em PostgreSQL com sliding window.
 * 
 * Estratégia:
 * - Primary: PostgreSQL (contadores atômicos via UPSERT)
 * - Fallback: In-memory Map (se DB falhar)
 * - Graceful degradation: fail-open em caso de erro
 * 
 * Não altera o RateLimitSystem existente do security-system.js.
 * É um módulo independente usado pelo billing enforcement.
 */

class PersistentRateLimiter {
    constructor(db, usePostgres) {
        this.db = db;
        this.usePostgres = usePostgres;
        this.enabled = !!usePostgres;

        // Fallback in-memory para quando DB não está disponível
        this.memoryCounters = new Map();
        this.memoryCleanupInterval = null;

        if (this.enabled) {
            console.log('⚡ [RATE LIMITER] Rate limiting persistente ativo (PostgreSQL)');
            // Cleanup periódico de contadores expirados (a cada 5 min)
            this.startCleanup();
        } else {
            console.log('⚠️ [RATE LIMITER] Usando fallback in-memory (SQLite detectado)');
        }
    }

    /**
     * Verificar e incrementar rate limit atomicamente
     * @param {string} tenantId - ID do tenant
     * @param {string} windowType - 'min' | 'hour' | 'day'
     * @param {number} maxRequests - Limite máximo para esta janela
     * @returns {object} { allowed: boolean, current: number, limit: number, remaining: number, retryAfterMs: number }
     */
    async checkLimit(tenantId, windowType, maxRequests) {
        // Plano ilimitado
        if (maxRequests === -1) {
            return { allowed: true, current: 0, limit: -1, remaining: -1, retryAfterMs: 0 };
        }

        try {
            if (this.enabled) {
                return await this._checkLimitDB(tenantId, windowType, maxRequests);
            } else {
                return this._checkLimitMemory(tenantId, windowType, maxRequests);
            }
        } catch (error) {
            // Fail-open: se rate limiter falhar, permitir a request
            console.error(`⚠️ [RATE LIMITER] Erro, fail-open:`, error.message);
            return { allowed: true, current: 0, limit: maxRequests, remaining: maxRequests, retryAfterMs: 0 };
        }
    }

    /**
     * Check via PostgreSQL (atômico, sem race condition)
     */
    async _checkLimitDB(tenantId, windowType, maxRequests) {
        const { windowKey, expiresAt, retryAfterMs } = this._getWindowParams(windowType);

        // UPSERT atômico + retorno do count atual
        const query = `
            INSERT INTO billing_rate_counters (tenant_id, window_key, count, expires_at)
            VALUES ($1, $2, 1, $3)
            ON CONFLICT (tenant_id, window_key)
            DO UPDATE SET count = billing_rate_counters.count + 1
            RETURNING count
        `;

        const result = await this.db.query(query, [tenantId, windowKey, expiresAt]);
        const current = parseInt(result.rows[0].count);

        return {
            allowed: current <= maxRequests,
            current,
            limit: maxRequests,
            remaining: Math.max(0, maxRequests - current),
            retryAfterMs: current > maxRequests ? retryAfterMs : 0
        };
    }

    /**
     * Check via in-memory (fallback)
     */
    _checkLimitMemory(tenantId, windowType, maxRequests) {
        const { windowKey, retryAfterMs } = this._getWindowParams(windowType);
        const key = `${tenantId}:${windowKey}`;

        if (!this.memoryCounters.has(key)) {
            this.memoryCounters.set(key, { count: 0, expiresAt: Date.now() + retryAfterMs });
        }

        const counter = this.memoryCounters.get(key);

        // Janela expirada — resetar
        if (Date.now() > counter.expiresAt) {
            counter.count = 0;
            counter.expiresAt = Date.now() + retryAfterMs;
        }

        counter.count++;

        return {
            allowed: counter.count <= maxRequests,
            current: counter.count,
            limit: maxRequests,
            remaining: Math.max(0, maxRequests - counter.count),
            retryAfterMs: counter.count > maxRequests ? retryAfterMs : 0
        };
    }

    /**
     * Calcular parâmetros da janela de tempo
     */
    _getWindowParams(windowType) {
        const now = new Date();
        let windowKey, expiresAt, retryAfterMs;

        switch (windowType) {
            case 'min':
                windowKey = `min:${now.toISOString().substring(0, 16)}`; // YYYY-MM-DDTHH:MM
                expiresAt = new Date(now.getTime() + 2 * 60 * 1000).toISOString(); // 2 min TTL
                retryAfterMs = 60 * 1000; // retry em 1 min
                break;
            case 'hour':
                windowKey = `hour:${now.toISOString().substring(0, 13)}`; // YYYY-MM-DDTHH
                expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(); // 2h TTL
                retryAfterMs = 60 * 60 * 1000; // retry em 1h
                break;
            case 'day':
                windowKey = `day:${now.toISOString().substring(0, 10)}`; // YYYY-MM-DD
                expiresAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(); // 2d TTL
                retryAfterMs = 24 * 60 * 60 * 1000; // retry em 1d
                break;
            default:
                windowKey = `min:${now.toISOString().substring(0, 16)}`;
                expiresAt = new Date(now.getTime() + 2 * 60 * 1000).toISOString();
                retryAfterMs = 60 * 1000;
        }

        return { windowKey, expiresAt, retryAfterMs };
    }

    /**
     * Limpar contadores expirados (PostgreSQL)
     */
    async cleanup() {
        if (!this.enabled) {
            // Cleanup in-memory
            const now = Date.now();
            for (const [key, counter] of this.memoryCounters) {
                if (now > counter.expiresAt) {
                    this.memoryCounters.delete(key);
                }
            }
            return;
        }

        try {
            const result = await this.db.query(
                `DELETE FROM billing_rate_counters WHERE expires_at < CURRENT_TIMESTAMP`
            );
            // Log apenas se houver limpeza significativa
        } catch (error) {
            console.error('⚠️ [RATE LIMITER] Erro no cleanup:', error.message);
        }
    }

    /**
     * Iniciar cleanup periódico
     */
    startCleanup() {
        // Limpar a cada 5 minutos
        this.memoryCleanupInterval = setInterval(() => {
            this.cleanup().catch(err => {
                console.error('⚠️ [RATE LIMITER] Erro no cleanup periódico:', err.message);
            });
        }, 5 * 60 * 1000);

        // Não impedir o processo de sair
        if (this.memoryCleanupInterval.unref) {
            this.memoryCleanupInterval.unref();
        }
    }

    /**
     * Parar cleanup (para shutdown graceful)
     */
    stopCleanup() {
        if (this.memoryCleanupInterval) {
            clearInterval(this.memoryCleanupInterval);
            this.memoryCleanupInterval = null;
        }
    }

    /**
     * Obter headers de rate limit para resposta HTTP
     */
    getRateLimitHeaders(result, windowType) {
        return {
            'X-RateLimit-Limit': String(result.limit),
            'X-RateLimit-Remaining': String(result.remaining),
            'X-RateLimit-Window': windowType,
            ...(result.retryAfterMs > 0 ? { 'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)) } : {})
        };
    }
}

// Singleton — inicializado sob demanda
let _instance = null;

function getRateLimiter() {
    if (!_instance) {
        try {
            const { db, USE_POSTGRES } = require('./database');
            _instance = new PersistentRateLimiter(db, USE_POSTGRES);
        } catch (e) {
            console.error('⚠️ [RATE LIMITER] Falha ao inicializar:', e.message);
            _instance = new PersistentRateLimiter(null, false);
        }
    }
    return _instance;
}

module.exports = { PersistentRateLimiter, getRateLimiter };
