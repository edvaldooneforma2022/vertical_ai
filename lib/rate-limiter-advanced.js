/**
 * 🚦 SISTEMA DE RATE LIMITING AVANÇADO - Link Mágico V9.0
 * 
 * Rate limiting granular por:
 * - Endpoint específico
 * - Tenant/API Key (tier-based)
 * - IP do cliente
 * - Tipo de ação
 * 
 * V9.0 MELHORIAS:
 * - Whitelist de IPs via ENV (RATE_LIMIT_WHITELIST)
 * - Modo stress test via header (x-stress-test)
 * - Disable global via ENV (RATE_LIMIT_DISABLED)
 * - Rate limit por tenant tier (apiKey-based)
 * - Log estruturado JSON em todos os eventos
 * 
 * SEGURANÇA:
 * - Feature flag controlável
 * - Fallback para rate limit global existente
 * - Configurável por tenant
 * - Fail-open em caso de erro
 * 
 * @version 9.0.0
 */

class RateLimiterAdvanced {
    constructor() {
        this.enabled = false;
        this.limits = new Map(); // Armazena contadores
        this.lastCleanup = Date.now();
        this.cleanupInterval = 60000; // Limpar a cada 1 minuto

        // ═══════════════════════════════════════════════════════
        // V9: WHITELIST DE IPS (RATE_LIMIT_WHITELIST env var)
        // ═══════════════════════════════════════════════════════
        this.whitelistedIPs = (process.env.RATE_LIMIT_WHITELIST || '')
            .split(',')
            .map(ip => ip.trim())
            .filter(Boolean);

        // V9: Modo global disable via ENV (para QA)
        this.globalDisabled = process.env.RATE_LIMIT_DISABLED === 'true';

        if (this.whitelistedIPs.length > 0) {
            console.log(`🚦 [V9] Rate Limiter: ${this.whitelistedIPs.length} IPs na whitelist`);
        }
        if (this.globalDisabled) {
            console.log('🚦 [V9] Rate Limiter: DESATIVADO globalmente via ENV (RATE_LIMIT_DISABLED=true)');
        }

        // ═══════════════════════════════════════════════════════
        // V9: TENANT TIERS (limites por tier de API key)
        // ═══════════════════════════════════════════════════════
        this.tenantTiers = {
            enterprise: { multiplier: 5.0 },  // 5x o limite padrão
            pro:        { multiplier: 3.0 },  // 3x
            basic:      { multiplier: 1.0 },  // limite padrão
            free:       { multiplier: 0.5 },  // metade
            test:       { multiplier: 10.0 }   // 10x (para stress test)
        };
        this.tenantTierCache = new Map(); // Cache de tier por apiKey

        // Configurações padrão por tipo de endpoint
        this.defaultLimits = {
            // Endpoints de chat - mais permissivos
            chat: {
                windowMs: 60000,  // 1 minuto
                maxRequests: 60,  // 60 req/min
                message: 'Limite de mensagens atingido. Aguarde um momento.'
            },
            // Endpoints de API - moderado
            api: {
                windowMs: 60000,
                maxRequests: 100,
                message: 'Limite de requisições atingido. Tente novamente em alguns segundos.'
            },
            // Endpoints de autenticação - restrito
            auth: {
                windowMs: 300000, // 5 minutos
                maxRequests: 10,
                message: 'Muitas tentativas de login. Aguarde 5 minutos.'
            },
            // Endpoints de extração - muito restrito
            extraction: {
                windowMs: 60000,
                maxRequests: 5,
                message: 'Limite de extrações atingido. Aguarde antes de tentar novamente.'
            },
            // Endpoints de webhook - moderado
            webhook: {
                windowMs: 60000,
                maxRequests: 30,
                message: 'Limite de webhooks atingido.'
            },
            // Endpoints de admin - restrito
            admin: {
                windowMs: 60000,
                maxRequests: 20,
                message: 'Limite de requisições administrativas atingido.'
            },
            // Fallback padrão
            default: {
                windowMs: 60000,
                maxRequests: 50,
                message: 'Limite de requisições atingido.'
            }
        };

        // Mapeamento de rotas para tipos
        this.routeTypes = {
            // Chat
            '/api/process-chat': 'chat',
            '/api/process-chat-inteligente': 'chat',
            '/api/chat-universal': 'chat',
            '/api/chat': 'chat',
            '/chatbot': 'chat',

            // Extração
            '/api/extract': 'extraction',
            '/api/scrape': 'extraction',
            '/api/analyze-url': 'extraction',

            // Autenticação
            '/api/validate-key': 'auth',
            '/api/login': 'auth',
            '/api/register': 'auth',

            // Webhooks
            '/api/webhook': 'webhook',
            '/api/webhooks': 'webhook',

            // Admin
            '/admin': 'admin',
            '/api/admin': 'admin',
            '/admin/v8': 'admin'
        };

        console.log('🚦 Rate Limiter V9 inicializando...');
    }

    // ═══════════════════════════════════════════════════════
    // V9: MÉTODOS DE WHITELIST E STRESS TEST
    // ═══════════════════════════════════════════════════════

    /**
     * V9: Verifica se IP está na whitelist
     */
    _isWhitelisted(ip) {
        if (!ip || this.whitelistedIPs.length === 0) return false;
        // Normalizar IPv6 mapped IPv4 (::ffff:127.0.0.1 → 127.0.0.1)
        const normalizedIp = ip.replace(/^::ffff:/, '');
        return this.whitelistedIPs.some(wip => wip === ip || wip === normalizedIp);
    }

    /**
     * V9: Verifica se é uma requisição de stress test
     */
    _isStressTest(req) {
        return req.headers && req.headers['x-stress-test'] === 'true';
    }

    /**
     * V9: Obtém tier do tenant baseado na apiKey
     */
    _getTenantTier(apiKey) {
        if (!apiKey) return 'basic';
        // Cache para não recalcular a cada request
        if (this.tenantTierCache.has(apiKey)) {
            return this.tenantTierCache.get(apiKey);
        }
        // Default: basic. Em produção, pode ser buscado do billing
        const tier = 'basic';
        this.tenantTierCache.set(apiKey, tier);
        return tier;
    }

    /**
     * V9: Define tier do tenant (chamado externamente pelo billing)
     */
    setTenantTier(apiKey, tier) {
        if (this.tenantTiers[tier]) {
            this.tenantTierCache.set(apiKey, tier);
        }
    }

    /**
     * V9: Log estruturado em JSON
     */
    _logEvent(event, data) {
        try {
            console.log(JSON.stringify({
                event: `[RATE-LIMIT] ${event}`,
                ...data,
                timestamp: new Date().toISOString()
            }));
        } catch (_) {
            // Nunca quebrar por causa de log
        }
    }

    /**
     * Inicializa o sistema de rate limiting
     */
    async initialize() {
        try {
            // V9: Se globalmente desativado, não inicializar
            if (this.globalDisabled) {
                this.enabled = false;
                console.log('🚦 [V9] Rate Limiting desativado globalmente (ENV)');
                return;
            }

            let featureFlags;
            try {
                featureFlags = require('./feature-flags').featureFlags;
                this.enabled = featureFlags.isEnabled('FEATURE_ADVANCED_RATE_LIMIT');
            } catch (e) {
                this.enabled = process.env.FEATURE_ADVANCED_RATE_LIMIT === 'true';
            }

            if (!this.enabled) {
                console.log('🚦 Rate Limiting Avançado desabilitado');
                return;
            }

            // Iniciar limpeza periódica
            setInterval(() => this._cleanup(), this.cleanupInterval);

            console.log('✅ Rate Limiting V9 habilitado');

        } catch (error) {
            console.error('⚠️ Erro ao inicializar Rate Limiter:', error.message);
            this.enabled = false;
        }
    }

    /**
     * Gera chave única para rate limiting
     * V9: Prioriza apiKey sobre IP para rate limit por tenant
     */
    _generateKey(identifier, endpoint, type) {
        return `${type}:${endpoint}:${identifier}`;
    }

    /**
     * Detecta tipo de endpoint baseado no path
     */
    _detectEndpointType(path) {
        // Verificar mapeamento direto primeiro
        for (const [route, type] of Object.entries(this.routeTypes)) {
            if (path.startsWith(route)) {
                return type;
            }
        }
        return 'default';
    }

    /**
     * Obtém limites para um endpoint/tenant
     * V9: Aplica multiplicador de tier
     */
    _getLimits(type, tenantId = null, apiKey = null) {
        const baseLimits = this.defaultLimits[type] || this.defaultLimits.default;

        // V9: Aplicar multiplicador de tier
        const tier = this._getTenantTier(apiKey);
        const tierConfig = this.tenantTiers[tier] || this.tenantTiers.basic;
        const multiplier = tierConfig.multiplier || 1.0;

        if (multiplier !== 1.0) {
            return {
                ...baseLimits,
                maxRequests: Math.ceil(baseLimits.maxRequests * multiplier)
            };
        }

        // Verificar tenant customizado
        if (this.tenantLimits) {
            const customKey = `tenant:${tenantId}:${type}`;
            if (this.tenantLimits.has(customKey)) {
                return this.tenantLimits.get(customKey);
            }
        }

        return baseLimits;
    }

    /**
     * Verifica se uma requisição está dentro do limite
     * 
     * @param {Object} options - Opções de rate limiting
     * @param {string} options.identifier - ID único (IP, userId, apiKey)
     * @param {string} options.endpoint - Path do endpoint
     * @param {string} [options.tenantId] - ID do tenant
     * @param {string} [options.type] - Tipo forçado (ignora detecção)
     * @param {string} [options.apiKey] - V9: API key para tier-based limiting
     * @returns {Object} { allowed: boolean, remaining: number, resetTime: number, message?: string }
     */
    check(options) {
        const { identifier, endpoint, tenantId = null, type = null, apiKey = null } = options;

        // Se desabilitado, sempre permite
        if (!this.enabled) {
            return { allowed: true, remaining: Infinity, resetTime: 0 };
        }

        try {
            // Detectar tipo de endpoint
            const endpointType = type || this._detectEndpointType(endpoint);
            const limits = this._getLimits(endpointType, tenantId, apiKey);

            // Gerar chave única (V9: priorizar apiKey sobre IP)
            const effectiveId = apiKey || identifier;
            const key = this._generateKey(effectiveId, endpoint, endpointType);

            // Obter ou criar registro
            const now = Date.now();
            let record = this.limits.get(key);

            if (!record || now > record.resetTime) {
                // Criar novo registro
                record = {
                    count: 0,
                    resetTime: now + limits.windowMs,
                    type: endpointType
                };
            }

            // Incrementar contador
            record.count++;
            this.limits.set(key, record);

            // Verificar limite
            const remaining = Math.max(0, limits.maxRequests - record.count);
            const allowed = record.count <= limits.maxRequests;

            if (!allowed) {
                // V9: Log estruturado JSON
                this._logEvent('BLOCKED', {
                    ip: identifier,
                    apiKey: apiKey ? apiKey.substring(0, 8) + '...' : null,
                    route: endpoint,
                    type: endpointType,
                    count: record.count,
                    limit: limits.maxRequests
                });
            }

            return {
                allowed,
                remaining,
                resetTime: record.resetTime,
                total: limits.maxRequests,
                message: allowed ? null : limits.message,
                type: endpointType
            };

        } catch (error) {
            console.error('⚠️ Erro no rate limiting:', error.message);
            // Em caso de erro, permite a requisição (fail-open)
            return { allowed: true, remaining: Infinity, resetTime: 0 };
        }
    }

    /**
     * Middleware Express para rate limiting
     * V9: Com whitelist, stress test mode, tenant tier, logs JSON
     */
    middleware() {
        return (req, res, next) => {
            // V9: Se globalmente desativado, passa direto
            if (this.globalDisabled) {
                return next();
            }

            // Se desabilitado via feature flag, passa direto
            if (!this.enabled) {
                return next();
            }

            try {
                const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';

                // ═══ V9: BYPASS 1 — Whitelist de IP ═══
                if (this._isWhitelisted(clientIp)) {
                    this._logEvent('WHITELIST_BYPASS', { ip: clientIp, route: req.path });
                    return next();
                }

                // ═══ V9: BYPASS 2 — Modo Stress Test ═══
                if (this._isStressTest(req)) {
                    this._logEvent('STRESS_TEST_BYPASS', { ip: clientIp, route: req.path });
                    return next();
                }

                // Determinar identificador (V9: prioridade apiKey > userId > IP)
                const apiKey = req.headers['x-api-key'] || req.query?.apiKey || req.body?.apiKey;
                const identifier = apiKey || req.session?.userId || clientIp;

                const endpoint = req.path;
                const tenantId = req.headers['x-tenant-id'] || req.query?.tenantId;

                const result = this.check({ identifier, endpoint, tenantId, apiKey });

                // Adicionar headers de rate limit
                res.setHeader('X-RateLimit-Limit', result.total || 'unlimited');
                res.setHeader('X-RateLimit-Remaining', result.remaining);
                res.setHeader('X-RateLimit-Reset', result.resetTime || 0);
                res.setHeader('X-RateLimit-Type', result.type || 'default');

                if (!result.allowed) {
                    // V9: Log estruturado JSON no bloqueio
                    this._logEvent('REJECTED', {
                        ip: clientIp,
                        apiKey: apiKey ? apiKey.substring(0, 8) + '...' : null,
                        route: endpoint,
                        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
                    });

                    return res.status(429).json({
                        success: false,
                        error: 'Too Many Requests',
                        message: result.message,
                        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
                    });
                }

                next();

            } catch (error) {
                console.error('⚠️ Erro no middleware de rate limit:', error.message);
                // Fail-open: permite a requisição em caso de erro
                next();
            }
        };
    }

    /**
     * Limpa registros expirados
     */
    _cleanup() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, record] of this.limits.entries()) {
            if (now > record.resetTime) {
                this.limits.delete(key);
                cleaned++;
            }
        }

        // V9: Limpar também cache de tier antigo (> 1h)
        if (this.tenantTierCache && this.tenantTierCache.size > 1000) {
            this.tenantTierCache.clear();
        }

        if (cleaned > 0) {
            this._logEvent('CLEANUP', { cleaned, remaining: this.limits.size });
        }
    }

    /**
     * Define limite customizado para um tenant
     */
    setTenantLimits(tenantId, type, limits) {
        const key = `tenant:${tenantId}:${type}`;
        this.tenantLimits = this.tenantLimits || new Map();
        this.tenantLimits.set(key, limits);
        this._logEvent('TENANT_LIMITS_SET', { tenantId, type, maxRequests: limits.maxRequests });
    }

    /**
     * Reseta limite de um identificador
     */
    reset(identifier, endpoint = null) {
        let resetCount = 0;

        for (const key of this.limits.keys()) {
            if (key.includes(identifier)) {
                if (!endpoint || key.includes(endpoint)) {
                    this.limits.delete(key);
                    resetCount++;
                }
            }
        }

        this._logEvent('RESET', { identifier, resetCount });
        return resetCount;
    }

    /**
     * Obtém estatísticas (V9: inclui whitelist e tier info)
     */
    getStats() {
        const stats = {
            version: 'v9',
            enabled: this.enabled,
            globalDisabled: this.globalDisabled,
            totalRecords: this.limits.size,
            whitelistedIPs: this.whitelistedIPs.length,
            tenantTiersCached: this.tenantTierCache ? this.tenantTierCache.size : 0,
            byType: {}
        };

        for (const [key, record] of this.limits.entries()) {
            const type = record.type || 'unknown';
            stats.byType[type] = (stats.byType[type] || 0) + 1;
        }

        return stats;
    }
}

// Singleton instance
const rateLimiterAdvanced = new RateLimiterAdvanced();

// Inicializar automaticamente
rateLimiterAdvanced.initialize().catch(err => {
    console.error('❌ Falha ao inicializar Rate Limiter:', err);
});

module.exports = {
    rateLimiterAdvanced,
    RateLimiterAdvanced
};

