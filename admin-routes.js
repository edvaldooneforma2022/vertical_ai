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
            const { name, scopes, allowedIps, allowedDomains, expiresInDays } = req.body;

            const newKey = await keyManager.createKey(req.params.tenantId, name || 'Admin-created key', {
                scopes, allowedIps, allowedDomains, expiresInDays
            });

            res.json({ success: true, key: newKey });
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
