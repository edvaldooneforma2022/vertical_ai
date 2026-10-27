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
    // CORREÇÃO A1: Idempotência via stripe_webhook_events (fail-closed)
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
                // SEC-06: Rejeitar webhook sem secret configurado (segurança)
                console.error('❌ [SEC-06] STRIPE_WEBHOOK_SECRET não configurado — webhook rejeitado');
                return res.status(500).json({ error: 'Webhook secret not configured' });
            }

            console.log(`💳 [Stripe Webhook] Evento recebido: ${event.type} (${event.id})`);

            // A1: Verificar idempotência — evento já processado?
            const idempotencyResult = await checkAndLockEvent(event.id, event.type);

            if (idempotencyResult === 'already_processed') {
                console.log(`⏭️ [Stripe Webhook] Evento já processado: ${event.id} — ignorando`);
                return res.json({ received: true, duplicate: true });
            }

            if (idempotencyResult === 'db_unavailable') {
                // FAIL-CLOSED: banco indisponível → 503 para Stripe tentar novamente
                console.error(`🚫 [Stripe Webhook] DB indisponível — rejeitando ${event.id} para retry`);
                return res.status(503).json({ error: 'Service temporarily unavailable' });
            }

            if (idempotencyResult === 'locked_by_other') {
                // C2/D12: Evento em processamento por outro worker (ou processo anterior que crashou).
                // Retornar 503 para que a Stripe continue retentando até o lease expirar.
                console.log(`⏳ [Stripe Webhook] Evento ${event.id} em processamento por outro worker — retornando 503 para retry`);
                return res.status(503).json({ error: 'Event currently being processed, retry later' });
            }

            // idempotencyResult === 'locked' — prosseguir com processamento

            try {
                switch (event.type) {
                    case 'checkout.session.completed':
                        await handleCheckoutCompleted(event.data.object, stripe, event.id);
                        break;

                    case 'customer.subscription.updated':
                        await handleSubscriptionUpdated(event.data.object, stripe);
                        break;

                    case 'customer.subscription.deleted':
                        await handleSubscriptionDeleted(event.data.object);
                        break;

                    case 'invoice.payment_failed':
                        await handlePaymentFailed(event.data.object);
                        break;

                    case 'charge.refunded':
                        await handleChargeRefunded(event.data.object, stripe);
                        break;

                    default:
                        console.log(`⚠️ [Stripe Webhook] Evento não tratado: ${event.type}`);
                }

                // A1: Marcar evento como processado com sucesso
                // Se isso falhar, o evento ficará como 'processing' e será
                // retentado na próxima entrega da Stripe (fail-closed).
                await markEventProcessed(event.id);

            } catch (processingErr) {
                // A1: Marcar evento como falho — permite nova tentativa
                await markEventFailed(event.id, processingErr.message);
                console.error(`❌ [Stripe Webhook] Falha no processamento de ${event.id}:`, processingErr.message);
                // Retornar 500 para que a Stripe tente novamente
                return res.status(500).json({ error: 'Webhook processing failed' });
            }

            res.json({ received: true });

        } catch (err) {
            console.error('❌ [Stripe Webhook] Erro:', err.message);
            res.status(500).json({ error: 'Webhook processing failed' });
        }
    });

    console.log('✅ [Stripe Routes] Rotas registradas: /api/billing/*, /api/stripe/webhook');
}

// ─── A1 + C2: Funções de idempotência com lease-based lock ───────────────────

const crypto = require('crypto');

// C2: ID único desta instância do processo — usado como token de propriedade
const PROCESSOR_ID = crypto.randomBytes(8).toString('hex');

// C2: Tempo máximo que um evento pode ficar em 'processing' antes de ser considerado abandonado
const LEASE_TIMEOUT_SECONDS = 300; // 5 minutos

/**
 * Verifica se evento já foi processado e adquire lease exclusivo.
 * C2: Usa processor_id e locked_at para garantir propriedade exclusiva.
 * FAIL-CLOSED: se o banco estiver indisponível, retorna 'db_unavailable'.
 * @returns {'already_processed'|'locked'|'db_unavailable'|'locked_by_other'}
 */
async function checkAndLockEvent(stripeEventId, eventType) {
    try {
        const { db, USE_POSTGRES } = require('./database');
        if (!db || !USE_POSTGRES) {
            console.error('❌ [Stripe Idempotency] Banco indisponível — rejeitando evento para retry');
            return 'db_unavailable';
        }

        // C2: INSERT com processor_id e locked_at — atômico contra concorrência
        const result = await db.query(
            `INSERT INTO stripe_webhook_events (stripe_event_id, event_type, status, processor_id, locked_at)
             VALUES ($1, $2, 'processing', $3, CURRENT_TIMESTAMP)
             ON CONFLICT (stripe_event_id) DO NOTHING
             RETURNING id`,
            [stripeEventId, eventType, PROCESSOR_ID]
        );

        const rows = result.rows || result;
        if (rows.length > 0) {
            return 'locked'; // Novo evento, lease adquirido
        }

        // Conflito — verificar status do existente
        const existing = await db.query(
            `SELECT status, processor_id, locked_at FROM stripe_webhook_events WHERE stripe_event_id = $1`,
            [stripeEventId]
        );
        const existingRows = existing.rows || existing;

        if (existingRows.length === 0) {
            return 'db_unavailable'; // Situação inesperada
        }

        const record = existingRows[0];

        // Evento já processado → não reprocessar
        if (record.status === 'processed') {
            return 'already_processed';
        }

        // C2: Evento em 'processing' por outro worker
        if (record.status === 'processing') {
            const lockedAt = record.locked_at ? new Date(record.locked_at) : null;
            const now = new Date();
            const ageSeconds = lockedAt ? (now - lockedAt) / 1000 : Infinity;

            if (ageSeconds < LEASE_TIMEOUT_SECONDS) {
                // Lease ainda válido — outro worker está processando
                console.log(`⏳ [Stripe Idempotency] Evento ${stripeEventId} em processamento por ${record.processor_id} há ${Math.round(ageSeconds)}s — recusando`);
                return 'locked_by_other';
            }

            // C2: Lease expirado — tentar re-adquirir ATOMICAMENTE
            // UPDATE condicional: só adquire se status ainda é 'processing' E processor_id é o antigo
            const reacquire = await db.query(
                `UPDATE stripe_webhook_events
                 SET status = 'processing', processor_id = $2, locked_at = CURRENT_TIMESTAMP, error_message = 'lease expired, reacquired'
                 WHERE stripe_event_id = $1 AND status = 'processing' AND processor_id = $3
                 RETURNING id`,
                [stripeEventId, PROCESSOR_ID, record.processor_id]
            );
            const reacquireRows = reacquire.rows || reacquire;
            if (reacquireRows.length > 0) {
                console.log(`🔄 [Stripe Idempotency] Lease expirado re-adquirido para ${stripeEventId} (antigo: ${record.processor_id})`);
                return 'locked';
            }

            // Outro worker re-adquiriu antes de nós
            return 'locked_by_other';
        }

        // Status 'failed' — permitir nova tentativa com novo lease
        if (record.status === 'failed') {
            const reacquire = await db.query(
                `UPDATE stripe_webhook_events
                 SET status = 'processing', processor_id = $2, locked_at = CURRENT_TIMESTAMP, error_message = NULL
                 WHERE stripe_event_id = $1 AND status = 'failed'
                 RETURNING id`,
                [stripeEventId, PROCESSOR_ID]
            );
            const reacquireRows = reacquire.rows || reacquire;
            if (reacquireRows.length > 0) {
                return 'locked';
            }
            // Outro worker adquiriu entre nosso SELECT e UPDATE
            return 'locked_by_other';
        }

        return 'db_unavailable';

    } catch (err) {
        console.error('❌ [Stripe Idempotency] Erro na verificação (fail-closed):', err.message);
        return 'db_unavailable';
    }
}

/**
 * Marca evento como processado com sucesso.
 * C2: Verifica processor_id antes de marcar — impede que worker antigo finalize evento de outro.
 * Lança exceção se falhar.
 */
async function markEventProcessed(stripeEventId) {
    const { db, USE_POSTGRES } = require('./database');
    if (!db || !USE_POSTGRES) {
        throw new Error('DB indisponível para marcar evento como processado');
    }

    // C2: UPDATE condicional — só marca se nós somos o proprietário OU status é processing
    const result = await db.query(
        `UPDATE stripe_webhook_events
         SET status = 'processed', processed_at = CURRENT_TIMESTAMP
         WHERE stripe_event_id = $1 AND status = 'processing' AND processor_id = $2
         RETURNING id`,
        [stripeEventId, PROCESSOR_ID]
    );
    const rows = result.rows || result;
    if (rows.length === 0) {
        console.warn(`⚠️ [Stripe Idempotency] Não foi possível marcar ${stripeEventId} como processed — propriedade perdida`);
        // Não lançar exceção aqui: os side effects já ocorreram. Logar para investigação.
    }
}

/**
 * Marca evento como falho — permite nova tentativa pela Stripe.
 * C2: Verifica processor_id — impede inversão de status por worker antigo.
 */
async function markEventFailed(stripeEventId, errorMessage) {
    try {
        const { db, USE_POSTGRES } = require('./database');
        if (!db || !USE_POSTGRES) return;

        // C2: UPDATE condicional — só marca failed se nós somos o proprietário
        await db.query(
            `UPDATE stripe_webhook_events
             SET status = 'failed', error_message = $2
             WHERE stripe_event_id = $1 AND processor_id = $3 AND status = 'processing'`,
            [stripeEventId, (errorMessage || '').substring(0, 500), PROCESSOR_ID]
        );
    } catch (err) {
        console.warn('⚠️ [Stripe Idempotency] Erro ao marcar falha:', err.message);
    }
}

// ─── A2/M3: Atualização de estado de assinatura no tenant ────────────────────

/**
 * Atualiza campos de estado da assinatura no tenant.
 * Usado por subscription.updated, subscription.deleted e checkout.completed.
 */
async function updateTenantSubscriptionState(stripeCustomerId, stateUpdate) {
    try {
        const { db, USE_POSTGRES } = require('./database');
        if (!db || !USE_POSTGRES) return null;

        const setClauses = [];
        const params = [];
        let idx = 1;

        if (stateUpdate.subscriptionStatus !== undefined) {
            setClauses.push(`subscription_status = $${idx++}`);
            params.push(stateUpdate.subscriptionStatus);
        }
        if (stateUpdate.currentPeriodEnd !== undefined) {
            setClauses.push(`subscription_current_period_end = $${idx++}`);
            params.push(stateUpdate.currentPeriodEnd);
        }
        if (stateUpdate.cancelAtPeriodEnd !== undefined) {
            setClauses.push(`subscription_cancel_at_period_end = $${idx++}`);
            params.push(stateUpdate.cancelAtPeriodEnd);
        }
        if (stateUpdate.plan !== undefined) {
            setClauses.push(`plan = $${idx++}`);
            params.push(stateUpdate.plan);
        }
        if (stateUpdate.stripeSubscriptionId !== undefined) {
            setClauses.push(`stripe_subscription_id = $${idx++}`);
            params.push(stateUpdate.stripeSubscriptionId);
        }

        setClauses.push(`billing_status_updated_at = CURRENT_TIMESTAMP`);
        setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

        params.push(stripeCustomerId);

        const result = await db.query(
            `UPDATE tenants SET ${setClauses.join(', ')}
             WHERE stripe_customer_id = $${idx}`,
            params
        );

        const rowCount = result.rowCount || result.changes || 0;
        return rowCount;
    } catch (err) {
        console.error('❌ [Stripe] Erro ao atualizar estado da assinatura:', err.message);
        return null;
    }
}

/**
 * Busca apiKey de um tenant pelo stripe_customer_id
 */
async function findApiKeyByStripeCustomer(stripeCustomerId) {
    try {
        const { db, USE_POSTGRES } = require('./database');
        if (!db || !USE_POSTGRES) return null;

        const result = await db.query(
            `SELECT ak.key_value FROM api_keys ak JOIN tenants t ON ak.tenant_id = t.id
             WHERE t.stripe_customer_id = $1 AND ak.active = true LIMIT 1`,
            [stripeCustomerId]
        );
        const rows = result.rows || result;
        return rows.length > 0 ? rows[0].key_value : null;
    } catch (err) {
        console.error('❌ [Stripe] Erro ao buscar apiKey por customer:', err.message);
        return null;
    }
}

// ─── Handlers de Webhook ─────────────────────────────────────────────────────

async function handleCheckoutCompleted(session, stripe, stripeEventId) {
    const apiKey = session.client_reference_id || session.metadata?.apiKey;
    const planId = session.metadata?.planId;
    const customerEmail = session.customer_email || '';
    const stripeCustomerId = session.customer;
    const subscriptionId = session.subscription;

    if (!apiKey || !planId) {
        // C1: dados obrigatórios ausentes — lançar para marcar como failed e retry
        throw new Error(`checkout.session.completed sem apiKey (${!!apiKey}) ou planId (${!!planId})`);
    }

    const isTrial = session.metadata?.trial === 'true';
    console.log(`💳 [Stripe Webhook] Checkout completado: ${apiKey.substring(0, 9)}... → plano ${planId}${isTrial ? ' (TRIAL ' + TRIAL_DAYS + 'd)' : ''}`);

    // 0. Marcar trial_used se aplicável (secundário — não bloqueia)
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

    // 1. ESSENCIAL: Atualizar plano no banco (+ campos de estado A2/M2/M3)
    // C1: Se esta operação falhar, a exceção PROPAGA para marcar o evento como failed.
    let planUpdated = false;
    const { db, USE_POSTGRES } = require('./database');
    if (db && USE_POSTGRES) {
        try {
            await db.query(
                `UPDATE tenants SET plan = $1, stripe_customer_id = $2, stripe_subscription_id = $3,
                 subscription_status = 'active', billing_status_updated_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
                 WHERE id = (SELECT tenant_id FROM api_keys WHERE key_value = $4 AND active = true LIMIT 1)`,
                [planId, stripeCustomerId || '', subscriptionId || '', apiKey]
            );
            planUpdated = true;
            console.log(`✅ [Stripe Webhook] Plano atualizado no banco: ${planId}`);
        } catch (dbErr) {
            // Tentar fallback com colunas mínimas antes de desistir
            console.error('❌ [Stripe Webhook] Erro ao atualizar plano (tentando fallback):', dbErr.message);
            try {
                await db.query(
                    `UPDATE tenants SET plan = $1 WHERE id = (SELECT tenant_id FROM api_keys WHERE key_value = $2 AND active = true LIMIT 1)`,
                    [planId, apiKey]
                );
                planUpdated = true;
                console.log(`✅ [Stripe Webhook] Plano atualizado (fallback): ${planId}`);
            } catch (e2) {
                // C1: Ambos falharam — lançar para retry
                throw new Error(`Falha essencial ao atualizar plano no banco: ${e2.message}`);
            }
        }

        // M3: Buscar período da assinatura e persistir (secundário — não bloqueia)
        if (planUpdated && subscriptionId && stripe) {
            try {
                const sub = await stripe.subscriptions.retrieve(subscriptionId);
                if (sub && sub.current_period_end) {
                    await db.query(
                        `UPDATE tenants SET subscription_current_period_end = $1,
                         subscription_cancel_at_period_end = $2
                         WHERE stripe_customer_id = $3`,
                        [
                            new Date(sub.current_period_end * 1000),
                            sub.cancel_at_period_end || false,
                            stripeCustomerId
                        ]
                    );
                    console.log(`📅 [Stripe] Período salvo: até ${new Date(sub.current_period_end * 1000).toISOString()}`);
                }
            } catch (subErr) {
                console.warn('⚠️ [Stripe] Não foi possível buscar período da assinatura:', subErr.message);
            }
        }
    } else {
        // C1: Banco indisponível — lançar para retry
        throw new Error('DB indisponível para atualizar plano — requer retry');
    }

    // 2. Atualizar billing in-memory (secundário — não bloqueia)
    try {
        await billingManager.upgradePlan(apiKey, planId);
    } catch (e) {
        console.warn('⚠️ [Stripe Webhook] Erro ao atualizar billing in-memory:', e.message);
    }

    // 3. Registrar evento de audit (secundário — best-effort)
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

    // 4. Registrar comissão de afiliado (secundário — idempotente via UNIQUE index)
    try {
        const { registerCommission } = require('./affiliate-program');
        const amountCents = Math.round((PLANS[planId]?.price || 0) * 100);
        if (amountCents > 0) {
            await registerCommission(apiKey, planId, amountCents, stripeEventId);
        }
    } catch (e) {
        console.warn('⚠️ [Stripe Webhook] Falha ao registrar comissão afiliado (não crítico):', e.message);
    }

    console.log(`🎉 [Stripe] Upgrade concluído: ${apiKey.substring(0, 9)}... → ${planId} (${PLANS[planId]?.name || planId})`);
}

// CORREÇÃO A2: Tratar estados de assinatura de forma consistente
// Proteção contra eventos fora de ordem: verifica estado atual do tenant antes de alterar
async function handleSubscriptionUpdated(subscription, stripe) {
    const status = subscription.status;
    const customerId = subscription.customer;
    const subscriptionId = subscription.id;

    console.log(`💳 [Stripe Webhook] Assinatura atualizada: ${subscriptionId} — status: ${status}`);

    // Proteção contra reativação fora de ordem:
    // Se o tenant já está 'canceled' no banco e recebemos um evento 'active' para
    // uma subscription diferente da que está registrada, ignorar.
    let currentTenantState = null;
    try {
        const { db, USE_POSTGRES } = require('./database');
        if (db && USE_POSTGRES) {
            const check = await db.query(
                `SELECT subscription_status, stripe_subscription_id, plan
                 FROM tenants WHERE stripe_customer_id = $1 LIMIT 1`,
                [customerId]
            );
            const checkRows = check.rows || check;
            if (checkRows.length > 0) {
                currentTenantState = checkRows[0];
            }
        }
    } catch (e) {
        // C1: Falha ao verificar estado atual é essencial — lançar para retry
        throw new Error(`Falha ao verificar estado do tenant para customer ${customerId}: ${e.message}`);
    }

    // Se tenant está canceled e recebe active de subscription diferente → ignorar
    if (currentTenantState &&
        currentTenantState.subscription_status === 'canceled' &&
        currentTenantState.stripe_subscription_id &&
        currentTenantState.stripe_subscription_id !== subscriptionId &&
        (status === 'active' || status === 'trialing')) {
        console.warn(`⚠️ [Stripe] Ignorando evento ${status} de subscription ${subscriptionId} — tenant já cancelado com subscription ${currentTenantState.stripe_subscription_id}`);
        return;
    }

    // Persistir estado da assinatura no tenant (A2/M3)
    const stateUpdate = {
        subscriptionStatus: status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        stripeSubscriptionId: subscriptionId
    };

    // M3: Persistir período de vencimento
    if (subscription.current_period_end) {
        stateUpdate.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
    }

    // A2: Política de acesso por estado
    switch (status) {
        case 'active':
        case 'trialing':
            break;

        case 'past_due':
            console.warn(`⚠️ [Stripe] Assinatura com pagamento atrasado: ${subscriptionId} (customer: ${customerId})`);
            break;

        case 'unpaid':
            console.warn(`🔴 [Stripe] Assinatura inadimplente: ${subscriptionId} (customer: ${customerId})`);
            break;

        case 'canceled':
        case 'incomplete_expired':
            stateUpdate.plan = 'free';
            const apiKey = await findApiKeyByStripeCustomer(customerId);
            if (apiKey) {
                try {
                    await billingManager.upgradePlan(apiKey, 'free');
                } catch (e) {
                    console.warn('⚠️ [Stripe] Erro ao atualizar billing in-memory no downgrade:', e.message);
                }
                console.log(`⬇️ [Stripe] Downgrade para Free via subscription.updated(${status}): ${apiKey.substring(0, 9)}...`);
            }
            break;

        default:
            console.log(`ℹ️ [Stripe] Estado de assinatura não tratado: ${status}`);
    }

    // C1: ESSENCIAL — persistir estado. Se falhar, lançar para retry.
    const rowCount = await updateTenantSubscriptionState(customerId, stateUpdate);
    if (rowCount === null) {
        // updateTenantSubscriptionState retorna null em caso de erro
        throw new Error(`Falha essencial ao persistir estado de assinatura para customer ${customerId}`);
    }
    if (rowCount === 0) {
        console.warn(`⚠️ [Stripe] Tenant não encontrado para customer ${customerId} — estado não persistido`);
    }

    // Registrar no audit ledger (secundário — best-effort)
    try {
        const { getAuditLedger } = require('./billing-audit');
        const ledger = getAuditLedger();
        await ledger.recordEvent({
            tenantId: customerId,
            eventType: 'stripe_subscription_' + status,
            source: 'stripe',
            newState: { status, cancel_at_period_end: subscription.cancel_at_period_end },
            metadata: { subscriptionId, customerId }
        });
    } catch (e) {
        // Audit é best-effort
    }
}

// CORREÇÃO M2 + C1: Cancelamento robusto — falhas essenciais propagam
async function handleSubscriptionDeleted(subscription) {
    const customerId = subscription.customer;
    const subscriptionId = subscription.id;
    console.log(`💳 [Stripe Webhook] Assinatura cancelada: ${subscriptionId} (customer: ${customerId})`);

    // C1: ESSENCIAL — buscar e fazer downgrade no banco
    const { db, USE_POSTGRES } = require('./database');
    if (!db || !USE_POSTGRES) {
        throw new Error('DB indisponível para processar cancelamento — requer retry');
    }

    // M2: Buscar tenant pelo par (customer_id + subscription_id) para máxima precisão
    let result = await db.query(
        `SELECT ak.key_value, t.plan, t.id as tenant_id FROM api_keys ak JOIN tenants t ON ak.tenant_id = t.id
         WHERE t.stripe_customer_id = $1 AND t.stripe_subscription_id = $2 AND ak.active = true LIMIT 1`,
        [customerId, subscriptionId]
    );
    let rows = result.rows || result;

    // Fallback: buscar apenas por customer_id
    if (rows.length === 0) {
        result = await db.query(
            `SELECT ak.key_value, t.plan, t.id as tenant_id FROM api_keys ak JOIN tenants t ON ak.tenant_id = t.id
             WHERE t.stripe_customer_id = $1 AND ak.active = true LIMIT 1`,
            [customerId]
        );
        rows = result.rows || result;
    }

    if (rows.length > 0) {
        const apiKey = rows[0].key_value;
        const previousPlan = rows[0].plan;

        // C1: ESSENCIAL — downgrade no banco. Se falhar, lançar para retry.
        await db.query(
            `UPDATE tenants SET plan = 'free', subscription_status = 'canceled',
             billing_status_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE stripe_customer_id = $1`,
            [customerId]
        );

        // Atualizar billing in-memory (secundário)
        try {
            await billingManager.upgradePlan(apiKey, 'free');
        } catch (e) {
            console.warn('⚠️ [Stripe] Erro ao atualizar billing in-memory no cancelamento:', e.message);
        }
        console.log(`⬇️ [Stripe] Downgrade para Free: ${apiKey.substring(0, 9)}... (era: ${previousPlan})`);

        // Audit log (secundário — best-effort)
        try {
            const { getAuditLedger } = require('./billing-audit');
            const ledger = getAuditLedger();
            await ledger.recordEvent({
                tenantId: apiKey,
                eventType: 'stripe_subscription_deleted',
                planId: 'free',
                source: 'stripe',
                previousState: { plan: previousPlan },
                newState: { plan: 'free', status: 'canceled' },
                metadata: { subscriptionId, customerId }
            });
        } catch (e) {
            // Audit é best-effort
        }
    } else {
        console.warn(`⚠️ [Stripe] Tenant não encontrado para customer ${customerId} — cancelamento ignorado (seguro)`);
    }
}

// CORREÇÃO A2 + C1: handlePaymentFailed — falha de persistência propaga
async function handlePaymentFailed(invoice) {
    const customerId = invoice.customer;
    console.error(`❌ [Stripe] Pagamento falhou: invoice ${invoice.id} — customer ${customerId}`);

    // C1: ESSENCIAL — registrar estado no tenant. Se falhar, propagar.
    const rowCount = await updateTenantSubscriptionState(customerId, {
        subscriptionStatus: 'past_due'
    });
    if (rowCount === null) {
        throw new Error(`Falha essencial ao registrar payment_failed para customer ${customerId}`);
    }

    // Audit log (secundário — best-effort)
    try {
        const { getAuditLedger } = require('./billing-audit');
        const ledger = getAuditLedger();
        await ledger.recordEvent({
            tenantId: customerId,
            eventType: 'stripe_payment_failed',
            amountCents: invoice.amount_due || 0,
            source: 'stripe',
            metadata: { invoiceId: invoice.id, customerId }
        });
    } catch (e) {
        // Audit é best-effort
    }
}

// CORREÇÃO I3: Handler de reembolso
// DECISÃO DE NEGÓCIO NECESSÁRIA: O comportamento abaixo apenas registra o reembolso
// e loga um aviso. NÃO cancela automaticamente a assinatura em nenhum caso de reembolso.
// O proprietário deve decidir se reembolso total = cancelamento imediato.
async function handleChargeRefunded(charge, stripe) {
    try {
        const customerId = charge.customer;
        const amountRefunded = charge.amount_refunded || 0;
        const amountTotal = charge.amount || 0;
        const isFullRefund = amountRefunded >= amountTotal;

        console.log(`💰 [Stripe] Reembolso ${isFullRefund ? 'TOTAL' : 'PARCIAL'}: R$${(amountRefunded / 100).toFixed(2)} de R$${(amountTotal / 100).toFixed(2)} — customer ${customerId}`);

        // Audit log
        try {
            const { getAuditLedger } = require('./billing-audit');
            const ledger = getAuditLedger();
            await ledger.recordEvent({
                tenantId: customerId,
                eventType: isFullRefund ? 'stripe_refund_full' : 'stripe_refund_partial',
                amountCents: amountRefunded,
                source: 'stripe',
                metadata: {
                    chargeId: charge.id,
                    customerId,
                    amountTotal,
                    amountRefunded,
                    isFullRefund
                }
            });
        } catch (e) {
            // Audit é best-effort
        }

        // DECISÃO PENDENTE: Se reembolso total deve cancelar assinatura automaticamente.
        // Por segurança, apenas registra — o cancelamento virá via subscription.deleted
        // se o proprietário cancelar manualmente a assinatura na Stripe.
        if (isFullRefund) {
            console.warn(`🔔 [Stripe] ATENÇÃO: Reembolso total para customer ${customerId}. Verificar se assinatura deve ser cancelada manualmente.`);
        }

    } catch (err) {
        console.error('❌ [Stripe Webhook] Erro no handleChargeRefunded:', err.message);
    }
}

module.exports = { registerStripeRoutes };
