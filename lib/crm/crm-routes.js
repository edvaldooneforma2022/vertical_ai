/**
 * 🛣️ CRM ROUTES - Link Mágico V7.0
 * Rotas API para Pipeline, Leads CRM, Follow-Up, Deals e Analytics
 * 100% desacoplado do core de chat/IA
 */

const { crmManager, dealsManager, followUpManager } = require('./index');

/**
 * Helper: extrair tenant_id da request (api_key)
 */
function getTenantId(req) {
    return req.session?.validatedApiKey || req.headers['x-api-key'] || req.query.apiKey || req.body?.apiKey;
}

/**
 * Configurar rotas CRM
 */
function setupCRMRoutes(app) {
    console.log('🏢 [CRM] Registrando rotas CRM V7.0...');

    // =====================
    // PIPELINE
    // =====================

    /**
     * GET /api/crm/pipeline — Obter pipeline do tenant (cria padrão se não existir)
     */
    app.get('/api/crm/pipeline', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const pipeline = await crmManager.getPipeline(tenantId);
            res.json({ success: true, pipeline });
        } catch (error) {
            console.error('❌ [CRM] Erro GET /api/crm/pipeline:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao obter pipeline' });
        }
    });

    // =====================
    // LEADS CRM (Kanban)
    // =====================

    /**
     * GET /api/crm/leads — Leads agrupados por estágio (para Kanban)
     */
    app.get('/api/crm/leads', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const { view } = req.query;

            if (view === 'kanban') {
                const stages = await crmManager.getLeadsByStage(tenantId);
                return res.json({ success: true, stages });
            }

            // Lista simples
            const leads = await crmManager.getLeads(tenantId, req.query);
            res.json({ success: true, leads });
        } catch (error) {
            console.error('❌ [CRM] Erro GET /api/crm/leads:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao obter leads CRM' });
        }
    });

    /**
     * GET /api/crm/leads/:id — Detalhes de um lead CRM
     */
    app.get('/api/crm/leads/:id', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const lead = await crmManager.getLeadById(tenantId, req.params.id);
            if (!lead) return res.status(404).json({ success: false, error: 'Lead não encontrado' });

            res.json({ success: true, lead });
        } catch (error) {
            console.error('❌ [CRM] Erro GET /api/crm/leads/:id:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao obter lead' });
        }
    });

    /**
     * PUT /api/crm/leads/:id/stage — Mover lead de estágio (drag & drop)
     */
    app.put('/api/crm/leads/:id/stage', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const { stage_id } = req.body;
            if (!stage_id) return res.status(400).json({ success: false, error: 'stage_id é obrigatório' });

            const result = await crmManager.moveLeadToStage(tenantId, req.params.id, stage_id);
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('❌ [CRM] Erro PUT /api/crm/leads/:id/stage:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao mover lead' });
        }
    });

    /**
     * PUT /api/crm/leads/:id/temperature — Atualizar temperatura
     */
    app.put('/api/crm/leads/:id/temperature', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const { temperature } = req.body;
            if (!temperature) return res.status(400).json({ success: false, error: 'temperature é obrigatório' });

            const result = await crmManager.updateLeadTemperature(tenantId, req.params.id, temperature);
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('❌ [CRM] Erro PUT /api/crm/leads/:id/temperature:', error.message);
            res.status(500).json({ success: false, error: error.message || 'Erro ao atualizar temperatura' });
        }
    });

    /**
     * GET /api/crm/leads/:id/activities — Histórico de atividades
     */
    app.get('/api/crm/leads/:id/activities', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const activities = await crmManager.getActivities(tenantId, req.params.id);
            res.json({ success: true, activities });
        } catch (error) {
            console.error('❌ [CRM] Erro GET /api/crm/leads/:id/activities:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao obter atividades' });
        }
    });

    // =====================
    // FOLLOW-UP
    // =====================

    /**
     * GET /api/crm/followup/rules — Listar regras de follow-up
     */
    app.get('/api/crm/followup/rules', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const rules = await followUpManager.getRules(tenantId);
            res.json({ success: true, rules });
        } catch (error) {
            console.error('❌ [CRM] Erro GET /api/crm/followup/rules:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao listar regras' });
        }
    });

    /**
     * POST /api/crm/followup/rules — Criar regra de follow-up
     */
    app.post('/api/crm/followup/rules', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const { name, trigger_type, message_template } = req.body;
            if (!name || !trigger_type || !message_template) {
                return res.status(400).json({ success: false, error: 'name, trigger_type e message_template são obrigatórios' });
            }

            const rule = await followUpManager.createRule(tenantId, req.body);
            res.json({ success: true, rule });
        } catch (error) {
            console.error('❌ [CRM] Erro POST /api/crm/followup/rules:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao criar regra' });
        }
    });

    /**
     * PUT /api/crm/followup/rules/:id — Atualizar regra
     */
    app.put('/api/crm/followup/rules/:id', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const result = await followUpManager.updateRule(tenantId, req.params.id, req.body);
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('❌ [CRM] Erro PUT /api/crm/followup/rules/:id:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao atualizar regra' });
        }
    });

    /**
     * DELETE /api/crm/followup/rules/:id — Remover regra
     */
    app.delete('/api/crm/followup/rules/:id', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const result = await followUpManager.deleteRule(tenantId, req.params.id);
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('❌ [CRM] Erro DELETE /api/crm/followup/rules/:id:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao remover regra' });
        }
    });

    /**
     * GET /api/crm/followup/jobs — Listar jobs de follow-up
     */
    app.get('/api/crm/followup/jobs', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const jobs = await followUpManager.getJobsByTenant(tenantId, req.query);
            res.json({ success: true, jobs });
        } catch (error) {
            console.error('❌ [CRM] Erro GET /api/crm/followup/jobs:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao listar jobs' });
        }
    });

    // =====================
    // DEALS
    // =====================

    /**
     * GET /api/crm/deals — Listar deals
     */
    app.get('/api/crm/deals', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const deals = await dealsManager.getDealsByTenant(tenantId, req.query);
            res.json({ success: true, deals });
        } catch (error) {
            console.error('❌ [CRM] Erro GET /api/crm/deals:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao listar deals' });
        }
    });

    /**
     * POST /api/crm/deals — Criar deal
     */
    app.post('/api/crm/deals', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const { lead_id } = req.body;
            if (!lead_id) return res.status(400).json({ success: false, error: 'lead_id é obrigatório' });

            const deal = await dealsManager.createDeal(tenantId, lead_id, req.body);
            res.json({ success: true, deal });
        } catch (error) {
            console.error('❌ [CRM] Erro POST /api/crm/deals:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao criar deal' });
        }
    });

    /**
     * PUT /api/crm/deals/:id — Atualizar deal
     */
    app.put('/api/crm/deals/:id', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const result = await dealsManager.updateDeal(tenantId, req.params.id, req.body);
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('❌ [CRM] Erro PUT /api/crm/deals/:id:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao atualizar deal' });
        }
    });

    // =====================
    // ANALYTICS CRM
    // =====================

    /**
     * GET /api/crm/analytics — Analytics CRM completo
     */
    app.get('/api/crm/analytics', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const analytics = await crmManager.getAnalytics(tenantId);
            const revenue = await dealsManager.getRevenueStats(tenantId);

            res.json({
                success: true,
                analytics: {
                    ...analytics,
                    revenue
                }
            });
        } catch (error) {
            console.error('❌ [CRM] Erro GET /api/crm/analytics:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao obter analytics CRM' });
        }
    });

    console.log('✅ [CRM] Rotas CRM V7.0 registradas com sucesso');
}

module.exports = { setupCRMRoutes };
