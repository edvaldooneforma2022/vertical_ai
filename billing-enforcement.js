/**
 * 🛡️ BILLING ENFORCEMENT MIDDLEWARE - Link Mágico
 * Middleware que conecta billing, rate limiting e anti-fraude.
 * 
 * Pipeline: Quarentena → Rate Limit → Billing Limit → Anti-Fraud → next()
 * 
 * Este middleware é OPCIONAL — aplicado apenas nas rotas que precisam.
 * Não interfere com rotas existentes que não o utilizem.
 * Fail-open em caso de erro para não travar o sistema.
 */

const { getRateLimiter } = require('./rate-limiter');
const { getAntiFraud } = require('./anti-fraud');
const { getAuditLedger } = require('./billing-audit');

// Limites de rate por plano (req/min)
const PLAN_RATE_LIMITS = {
    free: { perMinute: 10, perHour: 200, perDay: 1000 },
    starter: { perMinute: 30, perHour: 1000, perDay: 5000 },
    pro: { perMinute: 60, perHour: 3000, perDay: 20000 },
    business: { perMinute: 120, perHour: 6000, perDay: 50000 },
    enterprise: { perMinute: -1, perHour: -1, perDay: -1 }  // ilimitado
};

/**
 * Criar middleware de billing enforcement
 * @param {object} billingManager - Instância do BillingManager existente
 * @returns {function} Express middleware
 */
function createBillingEnforcement(billingManager) {
    const rateLimiter = getRateLimiter();
    const antiFraud = getAntiFraud();

    return async (req, res, next) => {
        try {
            // Extrair tenantId do request (múltiplas fontes possíveis)
            const tenantId = req.tenantId ||
                req.headers['x-tenant-id'] ||
                req.query.apiKey ||
                req.query.api_key ||
                req.headers['x-api-key'] ||
                'anonymous';

            // Se não tem tenant, deixar passar (rotas públicas)
            if (tenantId === 'anonymous') {
                return next();
            }

            // 1. Verificar quarentena
            const quarantineCheck = await antiFraud.isQuarantined(tenantId);
            if (quarantineCheck) {
                return res.status(403).json({
                    success: false,
                    error: 'Conta temporariamente suspensa',
                    reason: 'Atividade suspeita detectada. Entre em contato com o suporte.',
                    code: 'ACCOUNT_QUARANTINED'
                });
            }

            // 2. Verificar rate limit (req/min)
            const planId = await _getTenantPlan(billingManager, tenantId);
            const limits = PLAN_RATE_LIMITS[planId] || PLAN_RATE_LIMITS.free;

            const rateLimitResult = await rateLimiter.checkLimit(tenantId, 'min', limits.perMinute);

            // Setar headers de rate limit
            const headers = rateLimiter.getRateLimitHeaders(rateLimitResult, 'min');
            for (const [key, value] of Object.entries(headers)) {
                res.setHeader(key, value);
            }

            if (!rateLimitResult.allowed) {
                return res.status(429).json({
                    success: false,
                    error: 'Limite de requisições excedido',
                    limit: rateLimitResult.limit,
                    remaining: 0,
                    retryAfterSeconds: Math.ceil(rateLimitResult.retryAfterMs / 1000),
                    code: 'RATE_LIMIT_EXCEEDED'
                });
            }

            // 3. Verificar anti-fraude (análise de padrão)
            const fraudCheck = await antiFraud.analyzeRequest(tenantId, {
                endpoint: req.path,
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                body: req.body ? Object.keys(req.body) : [] // Só chaves, não dados
            });

            if (fraudCheck.action === 'deny') {
                return res.status(403).json({
                    success: false,
                    error: 'Requisição bloqueada por segurança',
                    code: 'FRAUD_DETECTED'
                });
            }

            // 4. Tracking de uso (fire-and-forget, não bloqueia a request)
            _trackUsageAsync(billingManager, tenantId, req.path);

            // Adicionar info de billing ao request para uso downstream
            req.billingInfo = {
                tenantId,
                planId,
                rateLimitRemaining: rateLimitResult.remaining
            };

            next();
        } catch (error) {
            // FAIL-OPEN: qualquer erro no billing enforcement permite a request
            console.error('⚠️ [BILLING ENFORCEMENT] Erro, fail-open:', error.message);
            next();
        }
    };
}

/**
 * Obter plano do tenant (com cache simples)
 */
const _planCache = new Map();
const PLAN_CACHE_TTL = 5 * 60 * 1000; // 5 min

async function _getTenantPlan(billingManager, tenantId) {
    // Verificar cache
    const cached = _planCache.get(tenantId);
    if (cached && Date.now() - cached.timestamp < PLAN_CACHE_TTL) {
        return cached.planId;
    }

    try {
        const subscription = billingManager.getSubscription
            ? billingManager.getSubscription(tenantId)
            : null;

        const planId = (subscription && subscription.planId) || 'free';

        _planCache.set(tenantId, { planId, timestamp: Date.now() });

        return planId;
    } catch {
        return 'free';
    }
}

/**
 * Tracking assíncrono de uso (não bloqueia a request)
 */
function _trackUsageAsync(billingManager, tenantId, path) {
    try {
        const usageType = path.includes('chat') ? 'messages'
            : path.includes('extract') ? 'extractions'
                : 'api_calls';

        if (billingManager.trackUsage) {
            // Chamar sem await — fire and forget
            Promise.resolve(billingManager.trackUsage(tenantId, usageType, 1))
                .catch(err => {
                    console.error('⚠️ [BILLING ENFORCEMENT] Erro no tracking:', err.message);
                });
        }
    } catch (error) {
        // Ignorar silenciosamente
    }
}

module.exports = { createBillingEnforcement, PLAN_RATE_LIMITS };
