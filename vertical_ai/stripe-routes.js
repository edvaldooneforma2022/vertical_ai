/**
 * 💳 STRIPE ROUTES - Link Mágico
 * Rotas para checkout, webhook e gestão de planos via Stripe.
 * 
 * SAFE PATCH - Módulo isolado. Não impacta funcionalidades existentes.
 * Feature flag: ativo somente se STRIPE_SECRET_KEY estiver configurada.
 * 
 * Rotas:
 *   POST /api/billing/create-checkout — cria sessão Stripe Checkout
 *   POST /api/stripe/webhook — recebe eventos do Stripe
 *   GET  /api/billing/plans — lista planos com preços
 *   GET  /api/billing/my-plan — plano atual do tenant
 */

const { PLANS, billingManager } = require('./billing');

// Mapeamento planId → Stripe Price ID (env vars)
const STRIPE_PRICES = {
    starter: process.env.STRIPE_PRICE_STARTER || '',
    pro: process.env.STRIPE_PRICE_PRO || '',
    business: process.env.STRIPE_PRICE_BUSINESS || ''
};

const APP_URL = process.env.APP_URL || process.env.PLATFORM_URL || 'https://linkmagico.app.br';
const TRIAL_DAYS = parseInt(process.env.STRIPE_TRIAL_DAYS || '7', 10);
const TRIAL_PLAN = process.env.STRIPE_TRIAL_PLAN || 'pro'; // Plano oferecido no trial

/**
 * Registra rotas Stripe no Express app
 */
function registerStripeRoutes(app) {
    let stripe;

    try {
        const stripeLib = require('stripe');
        stripe = stripeLib(process.env.STRIPE_SECRET_KEY);
        console.log('✅ [Stripe Routes] Stripe SDK inicializado');
    } catch (err) {
        console.error('❌ [Stripe Routes] Falha ao inicializar Stripe:', err.message);
        return;
    }

    // ─── MIGRATION: coluna trial_used ────────────────────────────────────────
    (async () => {
        try {
            const { db, USE_POSTGRES } = require('./database');
            if (db && USE_POSTGRES) {
                await db.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT false`);
                await db.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP`);
                console.log('✅ [Stripe Trial] Colunas trial_used e trial_started_at verificadas');
            }
        } catch (e) {
            if (!e.message.includes('already exists')) {
                console.warn('⚠️ [Stripe Trial] Migration:', e.message);
            }
        }
    })();

    // ─── GET /api/billing/trial-eligible — Verifica se pode usar trial ───────
    app.get('/api/billing/trial-eligible', async (req, res) => {
        try {
            if (process.env.FEATURE_TRIAL !== undefined && process.env.FEATURE_TRIAL === 'false') {
                return res.json({ success: true, eligible: false, reason: 'Trial desabilitado' });
            }

            const apiKey = req.query.apiKey || req.session?.validatedApiKey;
            if (!apiKey) {
                return res.status(401).json({ success: false, error: 'API Key obrigatória' });
            }

            const { db, USE_POSTGRES } = require('./database');
            if (!db || !USE_POSTGRES) {
                return res.json({ success: true, eligible: false, reason: 'DB não disponível' });
            }

            // 1. Buscar tenant
            const result = await db.query(
                `SELECT t.plan, t.trial_used, t.email 
                 FROM tenants t JOIN api_keys ak ON t.id = ak.tenant_id 
                 WHERE ak.key_value = $1 AND ak.active = true LIMIT 1`,
                [apiKey]
            );
            const rows = result.rows || result;

            if (rows.length === 0) {
                return res.json({ success: true, eligible: false, reason: 'Tenant não encontrado' });
            }

            const tenant = rows[0];

            // 2. Verificar: já usou trial?
            if (tenant.trial_used) {
                return res.json({ success: true, eligible: false, reason: 'Trial já utilizado', trialPlan: TRIAL_PLAN, trialDays: TRIAL_DAYS });
            }

            // 3. Verificar: já é pagante?
            if (tenant.plan && tenant.plan !== 'free') {
                return res.json({ success: true, eligible: false, reason: 'Já possui plano pago', trialPlan: TRIAL_PLAN, trialDays: TRIAL_DAYS });
            }

            // 4. Verificar: email já usou trial em OUTRA conta?
            if (tenant.email) {
                const emailCheck = await db.query(
                    `SELECT COUNT(*) as count FROM tenants WHERE email = $1 AND trial_used = true`,
                    [tenant.email]
                );
                const emailRows = emailCheck.rows || emailCheck;
                if (parseInt(emailRows[0]?.count || '0') > 0) {
                    return res.json({ success: true, eligible: false, reason: 'Email já utilizou trial', trialPlan: TRIAL_PLAN, trialDays: TRIAL_DAYS });
                }
            }

            // 5. Elegível!
            return res.json({
                success: true,
                eligible: true,
                trialPlan: TRIAL_PLAN,
                trialDays: TRIAL_DAYS,
                planName: PLANS[TRIAL_PLAN]?.name || 'Pro',
                planFeatures: PLANS[TRIAL_PLAN]?.features || {}
            });

        } catch (err) {
            console.error('❌ [Stripe Trial] Erro ao verificar elegibilidade:', err.message);
            return res.json({ success: true, eligible: false, reason: 'Erro interno' });
        }
    });

    // ─── GET /api/billing/plans — Lista planos (público) ─────────────────────
    app.get('/api/billing/plans', (req, res) => {
        try {
            const plans = Object.values(PLANS).map(p => ({
                id: p.id,
                name: p.name,
                price: p.price,
                currency: p.currency,
                interval: p.interval,
                features: p.features,
                stripePriceId: STRIPE_PRICES[p.id] || null
            }));
            res.json({ success: true, plans });
        } catch (err) {
            console.error('❌ [Stripe] Erro ao listar planos:', err.message);
            res.status(500).json({ success: false, error: 'Erro interno' });
        }
    });

    // ─── GET /api/billing/my-plan — Plano atual do tenant ────────────────────
    app.get('/api/billing/my-plan', async (req, res) => {
        try {
            const apiKey = req.query.apiKey || req.session?.validatedApiKey;
            if (!apiKey) {
                return res.status(401).json({ success: false, error: 'API Key obrigatória' });
            }

            const subscription = await billingManager.getSubscription(apiKey);
            const usage = await billingManager.getUsage(apiKey);
            const limits = await billingManager.getRemainingLimits(apiKey);

            res.json({
                success: true,
                plan: {
                    id: subscription.planId,
                    name: subscription.plan?.name || 'Gratuito',
                    price: subscription.plan?.price || 0,
                    status: subscription.status
                },
                usage,
                limits
            });
        } catch (err) {
            console.error('❌ [Stripe] Erro ao buscar plano:', err.message);
            res.status(500).json({ success: false, error: 'Erro interno' });
        }
    });

    // ─── POST /api/billing/create-checkout — Cria sessão Stripe ──────────────
    app.post('/api/billing/create-checkout', async (req, res) => {
        try {
            const { apiKey, planId } = req.body || {};

            if (!apiKey || !planId) {
                return res.status(400).json({ success: false, error: 'apiKey e planId obrigatórios' });
            }

            if (!STRIPE_PRICES[planId]) {
                return res.status(400).json({ success: false, error: `Plano '${planId}' inválido ou sem preço Stripe configurado` });
            }

            // Buscar email do tenant no banco
            let customerEmail = '';
            try {
                const { db, USE_POSTGRES } = require('./database');
                if (db && USE_POSTGRES) {
                    const result = await db.query(
                        `SELECT t.email FROM tenants t JOIN api_keys ak ON t.id = ak.tenant_id WHERE ak.key_value = $1 AND ak.active = true LIMIT 1`,
                        [apiKey]
                    );
                    const rows = result.rows || result;
                    if (rows.length > 0) customerEmail = rows[0].email || '';
                }
            } catch (e) {
                console.warn('⚠️ [Stripe] Não conseguiu buscar email do tenant:', e.message);
            }

            // SAFE PATCH — Trial 7 dias
            const isTrial = req.body.trial === true && planId === TRIAL_PLAN;
            let trialEligible = false;

            if (isTrial && process.env.FEATURE_TRIAL !== 'false') {
                try {
                    const { db: trialDb, USE_POSTGRES: trialPG } = require('./database');
                    if (trialDb && trialPG) {
                        const trialCheck = await trialDb.query(
                            `SELECT t.trial_used, t.email FROM tenants t JOIN api_keys ak ON t.id = ak.tenant_id WHERE ak.key_value = $1 AND ak.active = true LIMIT 1`,
                            [apiKey]
                        );
                        const trialRows = trialCheck.rows || trialCheck;
                        if (trialRows.length > 0 && !trialRows[0].trial_used) {
                            // Checar email duplicado
                            const email = trialRows[0].email;
                            if (email) {
                                const emailDup = await trialDb.query(
                                    `SELECT COUNT(*) as count FROM tenants WHERE email = $1 AND trial_used = true`,
                                    [email]
                                );
                                const dupRows = emailDup.rows || emailDup;
                                if (parseInt(dupRows[0]?.count || '0') === 0) {
                                    trialEligible = true;
                                }
                            } else {
                                trialEligible = true; // Sem email, permitir
                            }
                        }
                    }
                } catch (trialErr) {
                    console.warn('⚠️ [Stripe Trial] Erro ao verificar trial:', trialErr.message);
                    // Fallback: não oferece trial (seguro)
                }
            }

            const sessionParams = {
                payment_method_types: ['card'],
                mode: 'subscription',
                line_items: [{
                    price: STRIPE_PRICES[planId],
                    quantity: 1
                }],
                success_url: `${APP_URL}/checkout-success.html?session_id={CHECKOUT_SESSION_ID}&plan=${planId}${trialEligible ? '&trial=true' : ''}`,
                cancel_url: `${APP_URL}/pricing.html?cancelled=true`,
                client_reference_id: apiKey,
                metadata: {
                    apiKey,
                    planId,
                    source: 'linkmagico_pricing',
                    trial: trialEligible ? 'true' : 'false'
                }
            };

            // Adicionar trial period se elegível
            if (trialEligible) {
                sessionParams.subscription_data = {
                    trial_period_days: TRIAL_DAYS
                };
                console.log(`🎁 [Stripe Trial] Trial ${TRIAL_DAYS} dias para: ${apiKey.substring(0, 9)}...`);
            }

            if (customerEmail) {
                sessionParams.customer_email = customerEmail;
            }

            const session = await stripe.checkout.sessions.create(sessionParams);

            console.log(`💳 [Stripe] Checkout criado: ${apiKey.substring(0, 9)}... → plano ${planId} (session: ${session.id})`);

            res.json({
                success: true,
                url: session.url,
                sessionId: session.id
            });

        } catch (err) {
            console.error('❌ [Stripe] Erro ao criar checkout:', err.message);
            res.status(500).json({ success: false, error: 'Erro ao criar sessão de pagamento' });
        }
    });

    // ─── POST /api/stripe/webhook — Recebe eventos do Stripe ─────────────────
    app.post('/api/stripe/webhook', async (req, res) => {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

        try {
            let event;

            if (webhookSecret) {
                const sig = req.headers['stripe-signature'];
                const rawBody = req.rawBody || req.body;
                try {
                    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
                } catch (err) {
                    console.error('❌ [Stripe Webhook] Assinatura inválida:', err.message);
                    return res.status(400).json({ error: 'Webhook signature verification failed' });
                }
            } else {
                // Sem webhook secret (dev mode)
                event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
                console.warn('⚠️ [Stripe Webhook] Sem STRIPE_WEBHOOK_SECRET — aceitando sem verificação');
            }

            console.log(`💳 [Stripe Webhook] Evento recebido: ${event.type}`);

            switch (event.type) {
                case 'checkout.session.completed':
                    await handleCheckoutCompleted(event.data.object);
                    break;

                case 'customer.subscription.updated':
                    await handleSubscriptionUpdated(event.data.object);
                    break;

                case 'customer.subscription.deleted':
                    await handleSubscriptionDeleted(event.data.object);
                    break;

                case 'invoice.payment_failed':
                    await handlePaymentFailed(event.data.object);
                    break;

                default:
                    console.log(`⚠️ [Stripe Webhook] Evento não tratado: ${event.type}`);
            }

            res.json({ received: true });

        } catch (err) {
            console.error('❌ [Stripe Webhook] Erro:', err.message);
            res.status(500).json({ error: 'Webhook processing failed' });
        }
    });

    console.log('✅ [Stripe Routes] Rotas registradas: /api/billing/*, /api/stripe/webhook');
}

// ─── Handlers de Webhook ─────────────────────────────────────────────────────

async function handleCheckoutCompleted(session) {
    try {
        const apiKey = session.client_reference_id || session.metadata?.apiKey;
        const planId = session.metadata?.planId;
        const customerEmail = session.customer_email || '';
        const stripeCustomerId = session.customer;
        const subscriptionId = session.subscription;

        if (!apiKey || !planId) {
            console.error('❌ [Stripe Webhook] checkout.session.completed sem apiKey ou planId');
            return;
        }

        const isTrial = session.metadata?.trial === 'true';
        console.log(`💳 [Stripe Webhook] Checkout completado: ${apiKey.substring(0, 9)}... → plano ${planId}${isTrial ? ' (TRIAL ' + TRIAL_DAYS + 'd)' : ''}`);

        // 0. Marcar trial_used se aplicável
        if (isTrial) {
            try {
                const { db: tDb, USE_POSTGRES: tPG } = require('./database');
                if (tDb && tPG) {
                    await tDb.query(
                        `UPDATE tenants SET trial_used = true, trial_started_at = CURRENT_TIMESTAMP 
                         WHERE id = (SELECT tenant_id FROM api_keys WHERE key_value = $1 AND active = true LIMIT 1)`,
                        [apiKey]
                    );
                    console.log(`🔒 [Stripe Trial] trial_used marcado para: ${apiKey.substring(0, 9)}...`);
                }
            } catch (trialMarkErr) {
                console.error('⚠️ [Stripe Trial] Erro ao marcar trial_used:', trialMarkErr.message);
            }
        }

        // 1. Atualizar plano no banco
        try {
            const { db, USE_POSTGRES } = require('./database');
            if (db && USE_POSTGRES) {
                await db.query(
                    `UPDATE tenants SET plan = $1, stripe_customer_id = $2, stripe_subscription_id = $3, updated_at = CURRENT_TIMESTAMP
                     WHERE id = (SELECT tenant_id FROM api_keys WHERE key_value = $4 AND active = true LIMIT 1)`,
                    [planId, stripeCustomerId || '', subscriptionId || '', apiKey]
                );
                console.log(`✅ [Stripe Webhook] Plano atualizado no banco: ${planId}`);
            }
        } catch (dbErr) {
            console.error('❌ [Stripe Webhook] Erro ao atualizar plano no banco:', dbErr.message);
            // Tentar com colunas sem stripe (fallback se colunas não existem)
            try {
                const { db, USE_POSTGRES } = require('./database');
                if (db && USE_POSTGRES) {
                    await db.query(
                        `UPDATE tenants SET plan = $1 WHERE id = (SELECT tenant_id FROM api_keys WHERE key_value = $2 AND active = true LIMIT 1)`,
                        [planId, apiKey]
                    );
                    console.log(`✅ [Stripe Webhook] Plano atualizado (fallback sem stripe columns): ${planId}`);
                }
            } catch (e2) {
                console.error('❌ [Stripe Webhook] Fallback também falhou:', e2.message);
            }
        }

        // 2. Atualizar billing in-memory
        try {
            await billingManager.upgradePlan(apiKey, planId);
        } catch (e) {
            console.warn('⚠️ [Stripe Webhook] Erro ao atualizar billing in-memory:', e.message);
        }

        // 3. Registrar evento de audit
        try {
            const { getAuditLedger } = require('./billing-audit');
            const ledger = getAuditLedger();
            await ledger.recordEvent({
                tenantId: apiKey,
                eventType: 'stripe_checkout_completed',
                planId,
                amountCents: Math.round((PLANS[planId]?.price || 0) * 100),
                source: 'stripe',
                newState: { plan: planId, status: 'active' },
                metadata: { stripeCustomerId, subscriptionId, customerEmail }
            });
        } catch (e) {
            // Audit é best-effort
        }

        // 4. SAFE PATCH — Registrar comissão de afiliado (se indicado por alguém)
        try {
            const { registerCommission } = require('./affiliate-program');
            const amountCents = Math.round((PLANS[planId]?.price || 0) * 100);
            if (amountCents > 0) {
                await registerCommission(apiKey, planId, amountCents);
            }
        } catch (e) {
            // Fail-safe: webhook funciona mesmo se afiliados falhar
            console.warn('⚠️ [Stripe Webhook] Falha ao registrar comissão afiliado (não crítico):', e.message);
        }

        console.log(`🎉 [Stripe] Upgrade concluído: ${apiKey.substring(0, 9)}... → ${planId} (${PLANS[planId]?.name || planId})`);

    } catch (err) {
        console.error('❌ [Stripe Webhook] Erro no handleCheckoutCompleted:', err.message);
    }
}

async function handleSubscriptionUpdated(subscription) {
    try {
        console.log(`💳 [Stripe Webhook] Assinatura atualizada: ${subscription.id} — status: ${subscription.status}`);

        if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
            console.warn(`⚠️ [Stripe] Assinatura com pagamento pendente: ${subscription.id}`);
        }
    } catch (err) {
        console.error('❌ [Stripe Webhook] Erro no handleSubscriptionUpdated:', err.message);
    }
}

async function handleSubscriptionDeleted(subscription) {
    try {
        console.log(`💳 [Stripe Webhook] Assinatura cancelada: ${subscription.id}`);

        // Buscar tenant pelo stripe_customer_id e fazer downgrade para Free
        try {
            const { db, USE_POSTGRES } = require('./database');
            if (db && USE_POSTGRES) {
                const result = await db.query(
                    `SELECT ak.key_value FROM api_keys ak JOIN tenants t ON ak.tenant_id = t.id 
                     WHERE t.stripe_customer_id = $1 AND ak.active = true LIMIT 1`,
                    [subscription.customer]
                );
                const rows = result.rows || result;
                if (rows.length > 0) {
                    const apiKey = rows[0].key_value;
                    await db.query(
                        `UPDATE tenants SET plan = 'free' WHERE id = (SELECT tenant_id FROM api_keys WHERE key_value = $1 LIMIT 1)`,
                        [apiKey]
                    );
                    await billingManager.upgradePlan(apiKey, 'free');
                    console.log(`⬇️ [Stripe] Downgrade para Free: ${apiKey.substring(0, 9)}...`);
                }
            }
        } catch (dbErr) {
            console.error('❌ [Stripe Webhook] Erro no downgrade:', dbErr.message);
        }
    } catch (err) {
        console.error('❌ [Stripe Webhook] Erro no handleSubscriptionDeleted:', err.message);
    }
}

async function handlePaymentFailed(invoice) {
    try {
        console.error(`❌ [Stripe] Pagamento falhou: invoice ${invoice.id} — customer ${invoice.customer}`);
    } catch (err) {
        console.error('❌ [Stripe Webhook] Erro no handlePaymentFailed:', err.message);
    }
}

module.exports = { registerStripeRoutes };
