/**
 * 🔧 ADMIN ROUTES - Link Mágico
 * Rotas administrativas para gestão do billing blindado.
 * 
 * Todas as rotas usam prefixo /api/admin/ e requerem ADMIN_SECRET_KEY.
 * Não conflita com nenhuma rota existente.
 * 
 * Para habilitar: definir a env var ADMIN_SECRET_KEY.
 */

const express = require('express');
const { getAuditLedger } = require('./billing-audit');
const { getAntiFraud } = require('./anti-fraud');
const { getApiKeyManager } = require('./api-key-manager');
const { getBillingMetrics } = require('./billing-metrics');

/**
 * Middleware de autenticação admin
 */
function adminAuth(req, res, next) {
    const adminKey = process.env.ADMIN_SECRET_KEY;

    if (!adminKey) {
        return res.status(503).json({
            success: false,
            error: 'Admin API não configurada. Defina ADMIN_SECRET_KEY.'
        });
    }

    const providedKey = req.headers['x-admin-key'] || req.query.admin_key;

    if (!providedKey || providedKey !== adminKey) {
        return res.status(401).json({
            success: false,
            error: 'Acesso negado. Chave admin inválida.'
        });
    }

    next();
}

/**
 * Configurar rotas admin
 * @param {object} app - Express app
 */
function setupAdminRoutes(app) {
    // Todas as rotas admin requerem autenticação
    app.use('/api/admin', adminAuth);

    // ===== OVERVIEW FINANCEIRO =====

    app.get('/api/admin/billing/overview', async (req, res) => {
        try {
            const metrics = getBillingMetrics();
            const overview = await metrics.getOverview();
            res.json({ success: true, data: overview });
        } catch (error) {
            console.error('❌ [ADMIN] Erro no overview:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao gerar overview' });
        }
    });

    // ===== EVENTOS FINANCEIROS (AUDIT LEDGER) =====

    app.get('/api/admin/billing/events', async (req, res) => {
        try {
            const ledger = getAuditLedger();
            const { tenantId, eventType, startDate, endDate, limit = 50 } = req.query;

            let events;
            if (tenantId) {
                events = await ledger.getTenantHistory(tenantId, {
                    eventType, startDate, endDate, limit: parseInt(limit)
                });
            } else {
                events = await ledger.getRecentEvents(parseInt(limit));
            }

            res.json({ success: true, count: events.length, events });
        } catch (error) {
            console.error('❌ [ADMIN] Erro ao listar eventos:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao listar eventos' });
        }
    });

    // ===== PLANOS & STRIPE (V8.0) =====

    app.get('/api/admin/billing/plans', async (req, res) => {
        try {
            const { PLANS } = require('./billing');

            // Stripe Price IDs das env vars
            const STRIPE_PRICES = {
                starter: process.env.STRIPE_PRICE_STARTER || '',
                pro: process.env.STRIPE_PRICE_PRO || '',
                business: process.env.STRIPE_PRICE_BUSINESS || ''
            };

            const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
            const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
            const appUrl = process.env.APP_URL || process.env.PLATFORM_URL || '';

            // Mascarar chaves por segurança
            function maskKey(key) {
                if (!key) return '';
                if (key.length <= 8) return '****';
                return key.substring(0, 7) + '••••••••' + key.substring(key.length - 4);
            }

            const plans = Object.values(PLANS).map(p => ({
                id: p.id,
                name: p.name,
                price: p.price,
                currency: p.currency,
                interval: p.interval,
                features: p.features,
                limits: p.limits,
                stripePriceId: STRIPE_PRICES[p.id] || null
            }));

            res.json({
                success: true,
                data: {
                    plans,
                    stripe: {
                        enabled: !!stripeSecretKey,
                        secretKeyMasked: maskKey(stripeSecretKey),
                        webhookSecretMasked: maskKey(webhookSecret),
                        prices: STRIPE_PRICES,
                        appUrl: appUrl || 'Não definida'
                    }
                }
            });

            console.log('📋 [ADMIN] Planos listados com sucesso');
        } catch (error) {
            console.error('❌ [ADMIN] Erro ao listar planos:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao listar planos' });
        }
    });

    app.post('/api/admin/billing/change-plan', async (req, res) => {
        try {
            const { tenantId, newPlan } = req.body || {};

            if (!tenantId || !newPlan) {
                return res.status(400).json({ success: false, error: 'tenantId e newPlan obrigatórios' });
            }

            const { PLANS, billingManager } = require('./billing');

            // Resolver aliases (professional→pro, enterprise→business)
            const PLAN_ALIASES = { 'professional': 'pro', 'enterprise': 'business' };
            const resolvedPlan = PLAN_ALIASES[newPlan] || newPlan;

            if (!PLANS[resolvedPlan]) {
                return res.status(400).json({ success: false, error: `Plano '${newPlan}' não existe. Válidos: ${Object.keys(PLANS).join(', ')}` });
            }

            // 1. Tentar atualizar no banco de dados
            let dbUpdated = false;
            try {
                const { db, USE_POSTGRES } = require('./database');
                if (db && USE_POSTGRES) {
                    // Tentar primeiro pelo ID do tenant
                    let result = await db.query(
                        `UPDATE tenants SET plan = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
                        [resolvedPlan, tenantId]
                    );
                    let rowCount = result.rowCount || (result.rows ? result.rows.length : 0);

                    // Se não achou pelo ID, tentar pela API Key
                    if (rowCount === 0) {
                        result = await db.query(
                            `UPDATE tenants SET plan = $1, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT tenant_id FROM api_keys WHERE key_value = $2 AND active = true LIMIT 1)`,
                            [resolvedPlan, tenantId]
                        );
                        rowCount = result.rowCount || 0;
                    }

                    if (rowCount > 0) {
                        dbUpdated = true;
                        console.log(`✅ [ADMIN] Plano alterado no DB: ${tenantId.substring(0, 12)}... → ${resolvedPlan}`);
                    } else {
                        console.warn(`⚠️ [ADMIN] Tenant não encontrado no DB: ${tenantId.substring(0, 12)}...`);
                    }
                }
            } catch (dbErr) {
                console.error('❌ [ADMIN] Erro ao atualizar plano no DB:', dbErr.message);
            }

            // 2. Atualizar billing in-memory (fallback seguro)
            try {
                await billingManager.upgradePlan(tenantId, resolvedPlan);
                console.log(`✅ [ADMIN] Plano atualizado in-memory: ${tenantId.substring(0, 12)}... → ${resolvedPlan}`);
            } catch (memErr) {
                console.warn('⚠️ [ADMIN] Erro ao atualizar billing in-memory:', memErr.message);
            }

            // 3. Registrar evento de audit (best-effort)
            try {
                const ledger = getAuditLedger();
                await ledger.recordEvent({
                    tenantId,
                    eventType: 'admin_plan_change',
                    planId: resolvedPlan,
                    amountCents: Math.round((PLANS[resolvedPlan]?.price || 0) * 100),
                    source: 'admin_dashboard',
                    newState: { plan: resolvedPlan, status: 'active' },
                    metadata: { changedBy: 'admin', previousAction: 'manual_change' }
                });
            } catch (e) {
                // Audit é best-effort — não bloqueia
            }

            res.json({
                success: true,
                message: `Plano alterado para ${PLANS[resolvedPlan].name} (${resolvedPlan})`,
                dbUpdated,
                plan: {
                    id: resolvedPlan,
                    name: PLANS[resolvedPlan].name,
                    price: PLANS[resolvedPlan].price
                }
            });

        } catch (error) {
            console.error('❌ [ADMIN] Erro ao alterar plano:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao alterar plano: ' + error.message });
        }
    });

    // ===== MÉTRICAS FINANCEIRAS =====

    app.get('/api/admin/billing/metrics', async (req, res) => {
        try {
            const ledger = getAuditLedger();
            const { startDate, endDate } = req.query;
            const metrics = await ledger.getFinancialMetrics({ startDate, endDate });
            res.json({ success: true, data: metrics });
        } catch (error) {
            console.error('❌ [ADMIN] Erro nas métricas:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao calcular métricas' });
        }
    });

    // ===== USO POR PLANO =====

    app.get('/api/admin/usage/summary', async (req, res) => {
        try {
            const metrics = getBillingMetrics();
            const usage = await metrics.getUsageSummary();
            res.json({ success: true, data: usage });
        } catch (error) {
            console.error('❌ [ADMIN] Erro no uso:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao calcular uso' });
        }
    });

    // ===== QUARENTENA (ANTI-FRAUDE) =====

    app.get('/api/admin/quarantine', async (req, res) => {
        try {
            const antiFraud = getAntiFraud();
            const quarantined = await antiFraud.listQuarantined();
            res.json({ success: true, count: quarantined.length, tenants: quarantined });
        } catch (error) {
            console.error('❌ [ADMIN] Erro na quarentena:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao listar quarentena' });
        }
    });

    app.post('/api/admin/quarantine/:tenantId/clear', async (req, res) => {
        try {
            const antiFraud = getAntiFraud();
            const { tenantId } = req.params;
            const { reviewedBy } = req.body;

            const cleared = await antiFraud.clearQuarantine(tenantId, reviewedBy || 'admin');
            res.json({ success: cleared, message: cleared ? 'Tenant liberado' : 'Falha ao liberar' });
        } catch (error) {
            console.error('❌ [ADMIN] Erro ao liberar quarentena:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao liberar' });
        }
    });

    // ===== ALERTAS =====

    app.get('/api/admin/alerts', async (req, res) => {
        try {
            const antiFraud = getAntiFraud();
            const { limit = 50 } = req.query;
            const alerts = antiFraud.getAlerts(parseInt(limit));
            res.json({ success: true, count: alerts.length, alerts });
        } catch (error) {
            console.error('❌ [ADMIN] Erro nos alertas:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao listar alertas' });
        }
    });

    // ===== API KEYS MANAGEMENT =====

    app.get('/api/admin/keys/:tenantId', async (req, res) => {
        try {
            const keyManager = getApiKeyManager();
            const keys = await keyManager.listKeys(req.params.tenantId);
            res.json({ success: true, keys });
        } catch (error) {
            console.error('❌ [ADMIN] Erro ao listar keys:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao listar keys' });
        }
    });

    app.post('/api/admin/keys/:tenantId', async (req, res) => {
        try {
            const keyManager = getApiKeyManager();
            const { name, scopes, allowedIps, allowedDomains, expiresInDays, email, plan } = req.body;
            const tenantId = req.params.tenantId;

            // Auto-criar tenant se não existir (permite criar clientes novos direto pelo Admin Billing)
            try {
                const db = keyManager.db;
                if (db) {
                    const existing = await db.query('SELECT id FROM tenants WHERE id = $1', [tenantId]);
                    if (existing.rows.length === 0) {
                        await db.query(
                            'INSERT INTO tenants (id, name, email, plan, status) VALUES ($1, $2, $3, $4, $5)',
                            [tenantId, name || 'Tenant Manual', email || '', plan || 'starter', 'active']
                        );
                        console.log(`✅ [ADMIN] Tenant auto-criado: ${tenantId} (${name || 'Tenant Manual'})`);
                    }
                }
            } catch (tenantErr) {
                console.warn('⚠️ [ADMIN] Aviso ao verificar/criar tenant:', tenantErr.message);
                // Continua — pode ser que a tabela tenants não exista ou outro erro não-crítico
            }

            const newKey = await keyManager.createKey(tenantId, name || 'Admin-created key', {
                scopes, allowedIps, allowedDomains, expiresInDays
            });

            res.json({ success: true, key: newKey, tenantId });
        } catch (error) {
            console.error('❌ [ADMIN] Erro ao criar key:', error.message);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/api/admin/keys/:tenantId/:keyId/revoke', async (req, res) => {
        try {
            const keyManager = getApiKeyManager();
            await keyManager.revokeKey(req.params.keyId);
            res.json({ success: true, message: 'Key revogada' });
        } catch (error) {
            console.error('❌ [ADMIN] Erro ao revogar key:', error.message);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/api/admin/keys/:tenantId/:keyId/rotate', async (req, res) => {
        try {
            const keyManager = getApiKeyManager();
            const newKey = await keyManager.rotateKey(
                req.params.tenantId,
                req.params.keyId
            );
            res.json({ success: true, key: newKey });
        } catch (error) {
            console.error('❌ [ADMIN] Erro ao rotacionar key:', error.message);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ===== SYSTEM HEALTH =====

    app.get('/api/admin/health', async (req, res) => {
        try {
            const metrics = getBillingMetrics();
            const health = await metrics.getSystemHealth();
            res.json({ success: true, health });
        } catch (error) {
            console.error('❌ [ADMIN] Erro no health check:', error.message);
            res.status(500).json({ success: false, error: 'Erro no health check' });
        }
    });

    console.log('🔧 [ADMIN] Rotas administrativas configuradas (/api/admin/*)');
}

module.exports = { setupAdminRoutes };
