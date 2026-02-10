/**
 * 🚦 SISTEMA DE RATE LIMITING AVANÇADO - Link Mágico V8.0
 * 
 * Rate limiting granular por:
 * - Endpoint específico
 * - Tenant/API Key
 * - IP do cliente
 * - Tipo de ação
 * 
 * SEGURANÇA:
 * - Feature flag controlável
 * - Fallback para rate limit global existente
 * - Configurável por tenant
 * 
 * @version 1.0.0
 */

class RateLimiterAdvanced {
    constructor() {
        this.enabled = false;
        this.limits = new Map(); // Armazena contadores
        this.lastCleanup = Date.now();
        this.cleanupInterval = 60000; // Limpar a cada 1 minuto

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

        console.log('🚦 Rate Limiter Avançado inicializando...');
    }

    /**
     * Inicializa o sistema de rate limiting
     */
    async initialize() {
        try {
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

            console.log('✅ Rate Limiting Avançado habilitado');

        } catch (error) {
            console.error('⚠️ Erro ao inicializar Rate Limiter:', error.message);
            this.enabled = false;
        }
    }

    /**
     * Gera chave única para rate limiting
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
     */
    _getLimits(type, tenantId = null) {
        // TODO: No futuro, buscar limites customizados por tenant do banco
        return this.defaultLimits[type] || this.defaultLimits.default;
    }

    /**
     * Verifica se uma requisição está dentro do limite
     * 
     * @param {Object} options - Opções de rate limiting
     * @param {string} options.identifier - ID único (IP, userId, apiKey)
     * @param {string} options.endpoint - Path do endpoint
     * @param {string} [options.tenantId] - ID do tenant
     * @param {string} [options.type] - Tipo forçado (ignora detecção)
     * @returns {Object} { allowed: boolean, remaining: number, resetTime: number, message?: string }
     */
    check(options) {
        const { identifier, endpoint, tenantId = null, type = null } = options;

        // Se desabilitado, sempre permite
        if (!this.enabled) {
            return { allowed: true, remaining: Infinity, resetTime: 0 };
        }

        try {
            // Detectar tipo de endpoint
            const endpointType = type || this._detectEndpointType(endpoint);
            const limits = this._getLimits(endpointType, tenantId);

            // Gerar chave única
            const key = this._generateKey(identifier, endpoint, endpointType);

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
                console.log(`🚫 Rate limit excedido: ${key} (${record.count}/${limits.maxRequests})`);
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
     */
    middleware() {
        return (req, res, next) => {
            // Se desabilitado, passa direto
            if (!this.enabled) {
                return next();
            }

            try {
                // Determinar identificador (prioridade: apiKey > userId > IP)
                const identifier =
                    req.headers['x-api-key'] ||
                    req.query.apiKey ||
                    req.session?.userId ||
                    req.ip ||
                    req.connection?.remoteAddress ||
                    'unknown';

                const endpoint = req.path;
                const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;

                const result = this.check({ identifier, endpoint, tenantId });

                // Adicionar headers de rate limit
                res.setHeader('X-RateLimit-Limit', result.total || 'unlimited');
                res.setHeader('X-RateLimit-Remaining', result.remaining);
                res.setHeader('X-RateLimit-Reset', result.resetTime || 0);
                res.setHeader('X-RateLimit-Type', result.type || 'default');

                if (!result.allowed) {
                    // Logar tentativa bloqueada
                    console.warn(`🚫 [Rate Limit] Bloqueado: ${identifier} em ${endpoint}`);

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

        if (cleaned > 0) {
            console.log(`🧹 Rate Limiter: ${cleaned} registros limpos`);
        }
    }

    /**
     * Define limite customizado para um tenant
     */
    setTenantLimits(tenantId, type, limits) {
        const key = `tenant:${tenantId}:${type}`;
        this.tenantLimits = this.tenantLimits || new Map();
        this.tenantLimits.set(key, limits);
        console.log(`🚦 Limite customizado para tenant ${tenantId}: ${type} = ${limits.maxRequests}/${limits.windowMs}ms`);
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

        console.log(`🔄 Rate Limiter: ${resetCount} registros resetados para ${identifier}`);
        return resetCount;
    }

    /**
     * Obtém estatísticas
     */
    getStats() {
        const stats = {
            enabled: this.enabled,
            totalRecords: this.limits.size,
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
