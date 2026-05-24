/**
 * 💳 SISTEMA DE BILLING E PAGAMENTOS - Link Mágico
 * Gerenciamento de planos, assinaturas e pagamentos
 * 
 * Integrações suportadas:
 * - Stripe
 * - PayPal (preparado para integração)
 * - PagSeguro (preparado para integração)
 */

const crypto = require('crypto');

/**
 * 📋 Definição de Planos
 */
const PLANS = {
    free: {
        id: 'free',
        name: 'Gratuito',
        price: 0,
        currency: 'BRL',
        interval: 'month',
        features: {
            maxChatbots: 1,
            maxMessagesPerMonth: 100,
            maxExtractions: 3,
            cacheEnabled: false,
            analyticsRetention: 7,
            webhooksEnabled: false,
            apiAccess: false,
            customBranding: false,
            removePoweredBy: false,
            whatsappEnabled: false,
            prioritySupport: false
        },
        limits: {
            requestsPerMinute: 10,
            requestsPerHour: 100,
            requestsPerDay: 500
        }
    },

    starter: {
        id: 'starter',
        name: 'Starter',
        price: 29,
        currency: 'BRL',
        interval: 'month',
        features: {
            maxChatbots: 3,
            maxMessagesPerMonth: 1000,
            maxExtractions: 50,
            cacheEnabled: true,
            analyticsRetention: 30,
            webhooksEnabled: true,
            maxWebhooks: 5,
            apiAccess: true,
            customBranding: false,
            removePoweredBy: false,
            whatsappEnabled: false,
            prioritySupport: false
        },
        limits: {
            requestsPerMinute: 30,
            requestsPerHour: 500,
            requestsPerDay: 5000
        }
    },

    pro: {
        id: 'pro',
        name: 'Pro',
        price: 69,
        currency: 'BRL',
        interval: 'month',
        features: {
            maxChatbots: 10,
            maxMessagesPerMonth: 5000,
            maxExtractions: 200,
            cacheEnabled: true,
            analyticsRetention: 90,
            webhooksEnabled: true,
            maxWebhooks: 20,
            apiAccess: true,
            customBranding: true,
            removePoweredBy: true,
            whatsappEnabled: true,
            prioritySupport: true,
            advancedAnalytics: true,
            knowledgeBaseUpload: true
        },
        limits: {
            requestsPerMinute: 100,
            requestsPerHour: 2000,
            requestsPerDay: 20000
        }
    },

    business: {
        id: 'business',
        name: 'Business',
        price: 97,
        currency: 'BRL',
        interval: 'month',
        features: {
            maxChatbots: -1,
            maxMessagesPerMonth: -1,
            maxExtractions: -1,
            cacheEnabled: true,
            analyticsRetention: 365,
            webhooksEnabled: true,
            maxWebhooks: -1,
            apiAccess: true,
            customBranding: true,
            removePoweredBy: true,
            whatsappEnabled: true,
            prioritySupport: true,
            advancedAnalytics: true,
            knowledgeBaseUpload: true,
            dedicatedSupport: true,
            sla: true,
            whiteLabel: true
        },
        limits: {
            requestsPerMinute: -1,
            requestsPerHour: -1,
            requestsPerDay: -1
        }
    }
};

// Mapeamento de IDs antigos para novos (backward compatibility)
const PLAN_ID_ALIASES = {
    'professional': 'pro',
    'enterprise': 'business'
};

/**
 * 💼 Gerenciador de Billing
 */
class BillingManager {
    constructor() {
        this.subscriptions = new Map();
        this.usageTracking = new Map();
        this.stripeEnabled = !!process.env.STRIPE_SECRET_KEY;

        if (this.stripeEnabled) {
            this.initializeStripe();
        }

        console.log('💳 Sistema de Billing inicializado');
    }

    /**
     * Inicializar Stripe
     */
    initializeStripe() {
        try {
            const stripe = require('stripe');
            this.stripe = stripe(process.env.STRIPE_SECRET_KEY);
            console.log('✅ Stripe inicializado');
        } catch (error) {
            console.error('❌ Erro ao inicializar Stripe:', error.message);
            this.stripeEnabled = false;
        }
    }

    /**
     * Obter plano por ID (com fallback para IDs antigos)
     */
    getPlan(planId) {
        const resolvedId = PLAN_ID_ALIASES[planId] || planId;
        return PLANS[resolvedId] || PLANS.free;
    }

    /**
     * Listar todos os planos
     */
    listPlans() {
        return Object.values(PLANS);
    }

    /**
     * Criar assinatura
     */
    async createSubscription(userId, planId, paymentMethod = 'stripe') {
        const plan = this.getPlan(planId);

        if (!plan) {
            throw new Error('Plano não encontrado');
        }

        const subscription = {
            id: crypto.randomBytes(16).toString('hex'),
            userId,
            planId,
            plan,
            status: 'active',
            paymentMethod,
            currentPeriodStart: new Date(),
            currentPeriodEnd: this.calculatePeriodEnd(plan.interval),
            createdAt: new Date().toISOString(),
            cancelAtPeriodEnd: false
        };

        this.subscriptions.set(userId, subscription);

        // Inicializar tracking de uso
        this.initializeUsageTracking(userId, planId);

        console.log(`✅ Assinatura criada: ${userId} -> ${planId}`);

        return subscription;
    }

    /**
     * Calcular fim do período
     */
    calculatePeriodEnd(interval) {
        const now = new Date();

        switch (interval) {
            case 'month':
                return new Date(now.setMonth(now.getMonth() + 1));
            case 'year':
                return new Date(now.setFullYear(now.getFullYear() + 1));
            default:
                return new Date(now.setMonth(now.getMonth() + 1));
        }
    }

    /**
     * Obter assinatura do usuário
     * Busca primeiro no cache in-memory, depois no banco (tenant.plan), com fallback para 'free'
     */
    async getSubscription(userId) {
        // 1. Checar Map in-memory primeiro (comportamento original)
        if (this.subscriptions.has(userId)) {
            return this.subscriptions.get(userId);
        }

        // 2. Tentar buscar plano real do tenant no banco de dados
        try {
            const { db, USE_POSTGRES } = require('./database');
            if (db) {
                const query = USE_POSTGRES
                    ? `SELECT t.plan FROM tenants t JOIN api_keys ak ON t.id = ak.tenant_id WHERE ak.key_value = $1 AND ak.active = true LIMIT 1`
                    : `SELECT t.plan FROM tenants t JOIN api_keys ak ON t.id = ak.tenant_id WHERE ak.key_value = ? AND ak.active = 1 LIMIT 1`;
                const result = await db.query(query, [userId]);
                const rows = result.rows || result;
                if (rows.length > 0 && rows[0].plan && PLANS[rows[0].plan]) {
                    const planId = rows[0].plan;
                    const sub = {
                        userId,
                        planId,
                        plan: PLANS[planId],
                        status: 'active',
                        source: 'database'
                    };
                    this.subscriptions.set(userId, sub); // Cache in-memory
                    console.log(`💳 [Billing] Plano '${planId}' carregado do banco para tenant ${userId.substring(0, 8)}...`);
                    return sub;
                }
            }
        } catch (e) {
            console.warn('⚠️ [Billing] Fallback para plano free:', e.message);
        }

        // 3. Fallback original: plano free
        return {
            userId,
            planId: 'free',
            plan: PLANS.free,
            status: 'active',
            source: 'fallback'
        };
    }

    /**
     * Atualizar plano
     */
    async upgradePlan(userId, newPlanId) {
        const currentSubscription = await this.getSubscription(userId);
        const newPlan = this.getPlan(newPlanId);

        if (!newPlan) {
            throw new Error('Plano não encontrado');
        }

        currentSubscription.planId = newPlanId;
        currentSubscription.plan = newPlan;
        currentSubscription.updatedAt = new Date().toISOString();

        this.subscriptions.set(userId, currentSubscription);

        console.log(`✅ Plano atualizado: ${userId} -> ${newPlanId}`);

        return currentSubscription;
    }

    /**
     * Cancelar assinatura
     */
    async cancelSubscription(userId, immediate = false) {
        const subscription = await this.getSubscription(userId);

        if (immediate) {
            subscription.status = 'cancelled';
            subscription.cancelledAt = new Date().toISOString();
        } else {
            subscription.cancelAtPeriodEnd = true;
        }

        this.subscriptions.set(userId, subscription);

        console.log(`✅ Assinatura cancelada: ${userId}`);

        return subscription;
    }

    /**
     * Inicializar tracking de uso
     */
    initializeUsageTracking(userId, planId) {
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        if (!this.usageTracking.has(userId)) {
            this.usageTracking.set(userId, new Map());
        }

        const userUsage = this.usageTracking.get(userId);

        if (!userUsage.has(monthKey)) {
            userUsage.set(monthKey, {
                messages: 0,
                extractions: 0,
                apiCalls: 0,
                webhookCalls: 0,
                startDate: now.toISOString()
            });
        }
    }

    /**
     * Registrar uso
     */
    trackUsage(userId, type, amount = 1) {
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        if (!this.usageTracking.has(userId)) {
            this.initializeUsageTracking(userId, 'free');
        }

        const userUsage = this.usageTracking.get(userId);
        const monthUsage = userUsage.get(monthKey);

        if (monthUsage) {
            monthUsage[type] = (monthUsage[type] || 0) + amount;
        }

        // Persistir no banco (fire-and-forget, não bloqueia)
        this._persistUsageToDB(userId, monthKey, type, amount).catch(() => { });
    }

    /**
     * Persistir uso no PostgreSQL (best-effort, não falha se DB offline)
     */
    async _persistUsageToDB(tenantId, period, type, amount) {
        try {
            const { db, USE_POSTGRES } = require('./database');
            if (!USE_POSTGRES || !db) return;

            const column = type === 'messages' ? 'messages'
                : type === 'extractions' ? 'extractions'
                    : 'api_calls';

            await db.query(
                `INSERT INTO billing_usage (tenant_id, period, ${column})
                 VALUES ($1, $2, $3)
                 ON CONFLICT (tenant_id, period)
                 DO UPDATE SET ${column} = billing_usage.${column} + $3, updated_at = CURRENT_TIMESTAMP`,
                [tenantId, period, amount]
            );
        } catch (e) {
            // Silencioso — tracking em DB é best-effort
            console.warn('⚠️ [Billing] Erro ao persistir uso no DB:', e.message);
        }
    }

    /**
     * Obter uso atual
     */
    getUsage(userId) {
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        if (!this.usageTracking.has(userId)) {
            return {
                messages: 0,
                extractions: 0,
                apiCalls: 0,
                webhookCalls: 0
            };
        }

        const userUsage = this.usageTracking.get(userId);
        return userUsage.get(monthKey) || {
            messages: 0,
            extractions: 0,
            apiCalls: 0,
            webhookCalls: 0
        };
    }

    /**
     * Verificar se usuário pode usar recurso
     */
    async canUseFeature(userId, feature, amount = 1) {
        const subscription = await this.getSubscription(userId);
        const plan = subscription.plan || PLANS.free;
        const usage = this.getUsage(userId);

        // Verificar limites do plano
        switch (feature) {
            case 'messages':
                if (plan.features.maxMessagesPerMonth === -1) return true;
                return usage.messages + amount <= plan.features.maxMessagesPerMonth;

            case 'extractions':
                if (plan.features.maxExtractions === -1) return true;
                return usage.extractions + amount <= plan.features.maxExtractions;

            case 'webhooks':
                return plan.features.webhooksEnabled;

            case 'api':
                return plan.features.apiAccess;

            case 'cache':
                return plan.features.cacheEnabled;

            case 'customBranding':
                return plan.features.customBranding;

            default:
                return true;
        }
    }

    /**
     * Obter limites restantes
     */
    async getRemainingLimits(userId) {
        const subscription = await this.getSubscription(userId);
        const plan = subscription.plan;
        const usage = this.getUsage(userId);

        return {
            messages: {
                used: usage.messages,
                limit: plan.features.maxMessagesPerMonth,
                remaining: plan.features.maxMessagesPerMonth === -1
                    ? -1
                    : plan.features.maxMessagesPerMonth - usage.messages
            },
            extractions: {
                used: usage.extractions,
                limit: plan.features.maxExtractions,
                remaining: plan.features.maxExtractions === -1
                    ? -1
                    : plan.features.maxExtractions - usage.extractions
            }
        };
    }

    /**
     * Criar sessão de checkout Stripe
     */
    async createCheckoutSession(userId, planId, successUrl, cancelUrl) {
        if (!this.stripeEnabled) {
            throw new Error('Stripe não está configurado');
        }

        const plan = this.getPlan(planId);

        if (!plan || plan.price === 0) {
            throw new Error('Plano inválido para checkout');
        }

        try {
            const session = await this.stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: plan.currency.toLowerCase(),
                            product_data: {
                                name: `Link Mágico - Plano ${plan.name}`,
                                description: `Assinatura ${plan.interval === 'month' ? 'mensal' : 'anual'}`
                            },
                            unit_amount: Math.round(plan.price * 100),
                            recurring: {
                                interval: plan.interval
                            }
                        },
                        quantity: 1
                    }
                ],
                mode: 'subscription',
                success_url: successUrl,
                cancel_url: cancelUrl,
                client_reference_id: userId,
                metadata: {
                    userId,
                    planId
                }
            });

            return session;
        } catch (error) {
            console.error('❌ Erro ao criar sessão de checkout:', error);
            throw error;
        }
    }

    /**
     * Webhook handler do Stripe
     */
    async handleStripeWebhook(event) {
        if (!this.stripeEnabled) {
            return;
        }

        try {
            switch (event.type) {
                case 'checkout.session.completed':
                    await this.handleCheckoutCompleted(event.data.object);
                    break;

                case 'customer.subscription.updated':
                    await this.handleSubscriptionUpdated(event.data.object);
                    break;

                case 'customer.subscription.deleted':
                    await this.handleSubscriptionDeleted(event.data.object);
                    break;

                case 'invoice.payment_succeeded':
                    await this.handlePaymentSucceeded(event.data.object);
                    break;

                case 'invoice.payment_failed':
                    await this.handlePaymentFailed(event.data.object);
                    break;

                default:
                    console.log(`⚠️ Evento Stripe não tratado: ${event.type}`);
            }
        } catch (error) {
            console.error('❌ Erro ao processar webhook Stripe:', error);
            throw error;
        }
    }

    /**
     * Handler: Checkout completado
     */
    async handleCheckoutCompleted(session) {
        const userId = session.client_reference_id;
        const planId = session.metadata.planId;

        await this.createSubscription(userId, planId, 'stripe');

        console.log(`✅ Checkout completado: ${userId} -> ${planId}`);
    }

    /**
     * Handler: Assinatura atualizada
     */
    async handleSubscriptionUpdated(subscription) {
        console.log('✅ Assinatura atualizada:', subscription.id);
    }

    /**
     * Handler: Assinatura deletada
     */
    async handleSubscriptionDeleted(subscription) {
        console.log('✅ Assinatura deletada:', subscription.id);
    }

    /**
     * Handler: Pagamento bem-sucedido
     */
    async handlePaymentSucceeded(invoice) {
        console.log('✅ Pagamento bem-sucedido:', invoice.id);
    }

    /**
     * Handler: Pagamento falhou
     */
    async handlePaymentFailed(invoice) {
        console.error('❌ Pagamento falhou:', invoice.id);
    }
}

// Instância global do gerenciador de billing
const billingManager = new BillingManager();

/**
 * 🛡️ Middleware Express para enforcement de limites de billing.
 * Fail-open: se ocorrer erro, permite acesso (não bloqueia).
 * @param {string} feature - 'messages' ou 'extractions'
 */
function createBillingEnforcement(feature) {
    return async (req, res, next) => {
        try {
            const apiKey = req.cliente?.apiKey || req.session?.validatedApiKey || req.body?.apiKey || req.query?.apiKey;
            if (!apiKey) return next(); // Sem API key → outro middleware tratará

            const allowed = await billingManager.canUseFeature(apiKey, feature);
            if (!allowed) {
                const limits = await billingManager.getRemainingLimits(apiKey);
                const subscription = await billingManager.getSubscription(apiKey);
                console.warn(`⚠️ [Billing] Limite de ${feature} atingido para tenant ${apiKey.substring(0, 8)}... (plano: ${subscription.planId})`);
                return res.status(429).json({
                    success: false,
                    error: `Limite de ${feature === 'messages' ? 'mensagens' : 'extrações'} atingido para seu plano.`,
                    billing: {
                        feature,
                        planId: subscription.planId,
                        limits
                    }
                });
            }
            next();
        } catch (err) {
            console.warn(`⚠️ [Billing] Enforcement fail-open para ${feature}:`, err.message);
            next(); // Fail-open: permite acesso em caso de erro
        }
    };
}

module.exports = {
    billingManager,
    PLANS,
    createBillingEnforcement
};
