/**
 * 🛡️ BILLING ENFORCEMENT MIDDLEWARE - Link Mágico
 * Middleware que conecta billing, rate limiting e anti-fraude.
 * 
 * Pipeline: Quarentena → Inadimplência → Rate Limit → Billing Limit → Anti-Fraud → next()
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

// Política de inadimplência aprovada pelo proprietário
const DELINQUENCY_GRACE_DAYS = 7;   // Até 6 dias: acesso normal. A partir de 7: aviso.
const DELINQUENCY_RESTRICT_DAYS = 14; // A partir de 14 dias: restringe novas criações.

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
                req.session?.validatedApiKey ||
                req.body?.apiKey ||
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

            // 1.5 Verificar inadimplência (subscription_status + período)
            const delinquencyResult = await _checkDelinquency(tenantId, req.method, req.path);
            if (delinquencyResult) {
                // Adicionar info de inadimplência ao request para uso em templates
                req.billingDelinquency = delinquencyResult;

                if (delinquencyResult.restricted) {
                    // A partir de 14 dias ou unpaid: bloquear criações, permitir consultas
                    return res.status(402).json({
                        success: false,
                        error: delinquencyResult.message,
                        code: 'BILLING_DELINQUENT',
                        delinquency: {
                            status: delinquencyResult.status,
                            daysOverdue: delinquencyResult.daysOverdue,
                            restricted: true,
                            upgradeUrl: '/pricing'
                        }
                    });
                }
                // Se apenas warning (7-13 dias), adiciona header e continua
                if (delinquencyResult.warning) {
                    res.setHeader('X-Billing-Warning', 'payment-overdue');
                    res.setHeader('X-Billing-Days-Overdue', String(delinquencyResult.daysOverdue));
                }
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

            // 4. Verificar limites de BILLING (mensagens/extrações)
            try {
                const usageType = req.path.includes('chat') ? 'messages'
                    : req.path.includes('extract') ? 'extractions'
                        : null;

                if (usageType && billingManager.canUseFeature) {
                    const allowed = await billingManager.canUseFeature(tenantId, usageType);
                    if (!allowed) {
                        const subscription = await billingManager.getSubscription(tenantId);
                        const limits = await billingManager.getRemainingLimits(tenantId);
                        console.warn(`🚫 [BILLING] Limite de ${usageType} atingido: tenant ${tenantId.substring(0, 8)}... (plano: ${subscription.planId})`);
                        return res.status(429).json({
                            success: false,
                            error: usageType === 'messages'
                                ? 'Limite de mensagens atingido para seu plano. Faça upgrade para continuar.'
                                : 'Limite de extrações atingido para seu plano. Faça upgrade para continuar.',
                            code: 'BILLING_LIMIT_EXCEEDED',
                            billing: {
                                feature: usageType,
                                planId: subscription.planId,
                                planName: subscription.plan?.name || 'Gratuito',
                                limits,
                                upgradeUrl: '/pricing'
                            }
                        });
                    }
                }
            } catch (billingErr) {
                // Fail-open: se billing check falhar, permite acesso
                console.warn('⚠️ [BILLING ENFORCEMENT] Erro no check de limites, fail-open:', billingErr.message);
            }

            // 5. Tracking de uso (fire-and-forget, não bloqueia a request)
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

// ─── Verificação de inadimplência ─────────────────────────────────────────────

/**
 * Rotas consideradas "de criação" que devem ser restringidas em inadimplência.
 * Rotas de leitura, consulta, login, billing e dados existentes continuam permitidas.
 */
const CREATION_PATH_PATTERNS = [
    '/api/chat-universal',
    '/api/process-chat-inteligente',
    '/api/extract',
    '/api/extract-enhanced',
    '/api/create-short-url',
    '/api/chatgpt/generate',
    '/api/gmail/send',
    '/api/whatsapp/send',
    '/api/leads/structured',
    '/api/whitelabel/',
    '/api/appointments',
    '/api/availability/blocked',
    '/admin/leads/backup/create',
];

/**
 * Verifica se uma rota é de "criação" (deve ser restringida na inadimplência).
 */
function _isCreationRoute(method, path) {
    if (method === 'GET') return false; // GET nunca é criação
    return CREATION_PATH_PATTERNS.some(pattern => path.startsWith(pattern));
}

/**
 * Verifica inadimplência do tenant.
 * Consulta subscription_status e subscription_current_period_end do banco.
 * Usa current_period_end como data de referência confiável (vem da Stripe).
 *
 * @returns {null|{warning:boolean, restricted:boolean, status:string, daysOverdue:number, message:string}}
 */
async function _checkDelinquency(tenantId, httpMethod, httpPath) {
    try {
        const { db, USE_POSTGRES } = require('./database');
        if (!db || !USE_POSTGRES) return null;

        // Buscar estado de assinatura pelo apiKey (tenantId pode ser key_value)
        const result = await db.query(
            `SELECT t.subscription_status, t.subscription_current_period_end, t.plan
             FROM tenants t JOIN api_keys ak ON t.id = ak.tenant_id
             WHERE ak.key_value = $1 AND ak.active = true LIMIT 1`,
            [tenantId]
        );
        const rows = result.rows || result;
        if (rows.length === 0) return null;

        const tenant = rows[0];
        const status = tenant.subscription_status;
        const plan = tenant.plan;

        // Plano free não tem cobrança → sem inadimplência
        if (!plan || plan === 'free') return null;

        // Status saudáveis: sem restrição
        if (!status || status === 'active' || status === 'trialing' || status === 'none') return null;

        // Status 'canceled' ou 'incomplete_expired': já tratados pelo webhook (downgrade para free)
        // Se o plano ainda não voltou para free (condição de corrida), não restringir aqui
        // M5: Se status é 'canceled' mas plano ainda é pago, logar inconsistência
        if (status === 'canceled' || status === 'incomplete_expired') {
            if (plan && plan !== 'free') {
                console.warn(`⚠️ [BILLING] Inconsistência: tenant ${tenantId} tem status=${status} mas plan=${plan} (esperado free). Webhook pode não ter completado o downgrade.`);
            }
            return null;
        }

        // M5: Status 'incomplete' — assinatura nunca foi ativada, tratar como past_due inicial
        if (status === 'incomplete') {
            const isCreation = _isCreationRoute(httpMethod, httpPath);
            if (isCreation) {
                return {
                    warning: true,
                    restricted: true,
                    status,
                    daysOverdue: 0,
                    message: 'Sua assinatura está pendente de confirmação de pagamento. Complete o pagamento para acessar os recursos do plano.'
                };
            }
            return {
                warning: true,
                restricted: false,
                status,
                daysOverdue: 0,
                message: 'Sua assinatura está pendente de confirmação de pagamento.'
            };
        }

        // past_due ou unpaid: calcular dias de atraso
        if (status === 'past_due' || status === 'unpaid') {
            let daysOverdue = 0;

            if (tenant.subscription_current_period_end) {
                const periodEnd = new Date(tenant.subscription_current_period_end);
                // M5: Validar se a data é válida — new Date(invalid) retorna NaN
                if (isNaN(periodEnd.getTime())) {
                    console.warn(`⚠️ [BILLING] Data de período inválida para tenant ${tenantId}: ${tenant.subscription_current_period_end}`);
                    // Data inválida: assumir pior caso para segurança
                    daysOverdue = status === 'unpaid' ? DELINQUENCY_RESTRICT_DAYS : DELINQUENCY_GRACE_DAYS;
                } else {
                    const now = new Date();
                    if (now > periodEnd) {
                        daysOverdue = Math.floor((now - periodEnd) / (1000 * 60 * 60 * 24));
                    }
                }
            } else {
                // Sem data de período: para unpaid, assumir restrito (precaução segura)
                // Para past_due sem data, assumir aviso (7 dias)
                daysOverdue = status === 'unpaid' ? DELINQUENCY_RESTRICT_DAYS : DELINQUENCY_GRACE_DAYS;
            }

            const isCreation = _isCreationRoute(httpMethod, httpPath);

            // unpaid: sempre restringir criações (regra explícita)
            if (status === 'unpaid' && isCreation) {
                return {
                    warning: true,
                    restricted: true,
                    status,
                    daysOverdue,
                    message: 'Sua assinatura está inadimplente. Regularize o pagamento para continuar criando conteúdo. Seus dados existentes permanecem acessíveis.'
                };
            }

            // past_due: política de 7/14 dias
            if (daysOverdue < DELINQUENCY_GRACE_DAYS) {
                // 0-6 dias: acesso normal, sem aviso
                return null;
            }

            if (daysOverdue >= DELINQUENCY_RESTRICT_DAYS && isCreation) {
                // 14+ dias: restringir criações
                return {
                    warning: true,
                    restricted: true,
                    status,
                    daysOverdue,
                    message: `Seu pagamento está ${daysOverdue} dias atrasado. Novas criações estão temporariamente restritas. Regularize o pagamento para restaurar o acesso completo.`
                };
            }

            if (daysOverdue >= DELINQUENCY_GRACE_DAYS) {
                // 7-13 dias: aviso sem restrição
                return {
                    warning: true,
                    restricted: false,
                    status,
                    daysOverdue,
                    message: `Seu pagamento está ${daysOverdue} dias atrasado. Regularize para evitar restrições.`
                };
            }
        }

        return null;
    } catch (err) {
        // Fail-open: se a verificação falhar, não bloquear
        console.warn('⚠️ [BILLING ENFORCEMENT] Erro no check de inadimplência, fail-open:', err.message);
        return null;
    }
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

module.exports = {
    createBillingEnforcement,
    PLAN_RATE_LIMITS,
    DELINQUENCY_GRACE_DAYS,
    DELINQUENCY_RESTRICT_DAYS,
    // Exportados para testes
    _isCreationRoute,
    _checkDelinquency
};
