/**
 * 🛣️ CRM ROUTES - Link Mágico V7.0
 * Rotas API para Pipeline, Leads CRM, Follow-Up, Deals e Analytics
 * 100% desacoplado do core de chat/IA
 */

const { crmManager, dealsManager, followUpManager } = require('./index');
const { db, USE_POSTGRES } = require('../../database');

/**
 * Helper: extrair tenant_id da request (api_key)
 */
function getTenantId(req) {
    // Prioridade para o tenantId (UUID) já validado na sessão
    if (req.session?.tenantId) return req.session.tenantId;

    // Fallback: se houver apenas a chave (ex: via header x-api-key), retornamos a chave
    // para que as queries (que agora usam tenant_uuid) funcionem se usarmos JOIN ou
    // se o middleware não tiver rodado (raro, mas possível em workers parciais)
    // NOTA: Após a migração total, as queries operacionais usarão apenas UUID.
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

    // =====================
    // RECLASSIFICAÇÃO DE LEADS
    // =====================

    /**
     * POST /api/crm/leads/reclassify — Reclassificar leads existentes com score=0
     */
    app.post('/api/crm/leads/reclassify', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const result = await crmManager.reclassifyExistingLeads(tenantId);
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('❌ [CRM] Erro POST /api/crm/leads/reclassify:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao reclassificar leads' });
        }
    });

    // =====================
    // WEBHOOKS CRM
    // =====================

    /**
     * POST /api/crm/webhooks — Criar webhook para eventos CRM
     */
    app.post('/api/crm/webhooks', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const { url, event_type, headers } = req.body;
            if (!url) return res.status(400).json({ success: false, error: 'URL é obrigatória' });

            const result = await crmManager.createWebhook(tenantId, { url, event_type, headers });
            res.json({ success: true, webhook: result });
        } catch (error) {
            console.error('❌ [CRM] Erro POST /api/crm/webhooks:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao criar webhook' });
        }
    });

    /**
     * GET /api/crm/webhooks — Listar webhooks do tenant
     */
    app.get('/api/crm/webhooks', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const webhooks = await crmManager.getWebhooks(tenantId);
            res.json({ success: true, webhooks });
        } catch (error) {
            console.error('❌ [CRM] Erro GET /api/crm/webhooks:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao listar webhooks' });
        }
    });

    /**
     * DELETE /api/crm/webhooks/:id — Remover webhook
     */
    app.delete('/api/crm/webhooks/:id', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            await crmManager.deleteWebhook(tenantId, req.params.id);
            res.json({ success: true });
        } catch (error) {
            console.error('❌ [CRM] Erro DELETE /api/crm/webhooks:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao remover webhook' });
        }
    });

    // =====================
    // AUTOMATION RULES
    // =====================

    /**
     * POST /api/crm/automation/rules — Criar regra de automação
     */
    app.post('/api/crm/automation/rules', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const result = await crmManager.createAutomationRule(tenantId, req.body);
            res.json({ success: true, rule: result });
        } catch (error) {
            console.error('❌ [CRM] Erro POST /api/crm/automation/rules:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao criar regra de automação' });
        }
    });

    /**
     * GET /api/crm/automation/rules — Listar regras de automação
     */
    app.get('/api/crm/automation/rules', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const rules = await crmManager.getAutomationRules(tenantId);
            res.json({ success: true, rules });
        } catch (error) {
            console.error('❌ [CRM] Erro GET /api/crm/automation/rules:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao listar regras' });
        }
    });

    /**
     * DELETE /api/crm/automation/rules/:id — Remover regra de automação
     */
    app.delete('/api/crm/automation/rules/:id', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            await crmManager.deleteAutomationRule(tenantId, req.params.id);
            res.json({ success: true });
        } catch (error) {
            console.error('❌ [CRM] Erro DELETE /api/crm/automation/rules:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao remover regra' });
        }
    });

    /**
     * PATCH /api/crm/automation/rules/:id/toggle — Ativar/desativar regra
     */
    app.patch('/api/crm/automation/rules/:id/toggle', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const { active } = req.body;
            await crmManager.toggleAutomationRule(tenantId, req.params.id, active);
            res.json({ success: true });
        } catch (error) {
            console.error('❌ [CRM] Erro PATCH /api/crm/automation/rules/:id/toggle:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao alternar regra' });
        }
    });

    // =====================
    // SYNC LEADS → CRM
    // =====================

    /**
     * POST /api/crm/sync-leads
     * Sincroniza todos os leads de tenant_leads para crm_leads.
     * Necessário para migrar dados históricos e para novos leads que
     * ainda não passaram pelo hook de sync.
     */
    app.post('/api/crm/sync-leads', async (req, res) => {
        try {
            const tenantId = getTenantId(req);
            if (!tenantId) return res.status(401).json({ success: false, error: 'Não autenticado' });

            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);

            // Buscar leads em tenant_leads filtrando pelo tenant correto
            // Se for UUID: buscar por tenant_uuid OU pelas api_keys do tenant (para leads históricos com tenant_uuid=NULL)
            let leads = [];

            if (isUUID) {
                // Primeiro: buscar por tenant_uuid
                const qByUUID = USE_POSTGRES
                    ? `SELECT * FROM tenant_leads WHERE tenant_uuid::text = $1 ORDER BY created_at ASC`
                    : `SELECT * FROM tenant_leads WHERE tenant_uuid = ? ORDER BY created_at ASC`;
                const resByUUID = await db.query(qByUUID, [tenantId]);
                leads = resByUUID.rows || resByUUID;

                // Segundo: buscar pelas api_keys do tenant (cobre leads históricos com tenant_uuid=NULL)
                const qKeys = USE_POSTGRES
                    ? `SELECT key_value FROM api_keys WHERE tenant_id = $1 AND active = true`
                    : `SELECT key_value FROM api_keys WHERE tenant_id = ? AND active = 1`;
                const keysResult = await db.query(qKeys, [tenantId]);
                const apiKeys = (keysResult.rows || keysResult).map(r => r.key_value);

                if (apiKeys.length > 0) {
                    for (const key of apiKeys) {
                        const qByKey = USE_POSTGRES
                            ? `SELECT * FROM tenant_leads WHERE api_key = $1 AND (tenant_uuid IS NULL OR tenant_uuid::text != $2) ORDER BY created_at ASC`
                            : `SELECT * FROM tenant_leads WHERE api_key = ? AND (tenant_uuid IS NULL OR tenant_uuid != ?) ORDER BY created_at ASC`;
                        const resByKey = await db.query(qByKey, [key, tenantId]);
                        const extraLeads = resByKey.rows || resByKey;
                        leads = leads.concat(extraLeads);
                    }
                }
            } else {
                // tenantId é uma apiKey string
                const qByKey = USE_POSTGRES
                    ? `SELECT * FROM tenant_leads WHERE api_key = $1 ORDER BY created_at ASC`
                    : `SELECT * FROM tenant_leads WHERE api_key = ? ORDER BY created_at ASC`;
                const resByKey = await db.query(qByKey, [tenantId]);
                leads = resByKey.rows || resByKey;
            }

            if (!leads || leads.length === 0) {
                return res.json({ success: true, synced: 0, message: 'Nenhum lead encontrado em tenant_leads' });
            }

            // Deduplicar por id (caso lead apareça nas duas queries)
            const seen = new Set();
            leads = leads.filter(l => {
                if (seen.has(l.id)) return false;
                seen.add(l.id);
                return true;
            });

            let synced = 0;
            let errors = 0;

            for (const lead of leads) {
                try {
                    // syncLeadToCRM agora resolve UUID automaticamente via _resolveTenantUUID
                    await crmManager.syncLeadToCRM(tenantId, {
                        id: lead.id,
                        nome: lead.nome || lead.name,
                        email: lead.email,
                        telefone: lead.telefone || lead.phone,
                        url_origem: lead.url_origem || lead.source,
                        company: lead.company,
                        estimated_value: lead.estimated_value,
                        conversationId: lead.conversation_id
                    });
                    synced++;
                } catch (err) {
                    console.warn(`⚠️ [CRM] Erro ao sincronizar lead ${lead.email}:`, err.message);
                    errors++;
                }
            }

            console.log(`🔄 [CRM] Sync concluído: ${synced}/${leads.length} leads sincronizados para crm_leads`);
            res.json({ success: true, synced, errors, total: leads.length });
        } catch (error) {
            console.error('❌ [CRM] Erro POST /api/crm/sync-leads:', error.message);
            res.status(500).json({ success: false, error: 'Erro ao sincronizar leads: ' + error.message });
        }
    });

    console.log('✅ [CRM] Rotas CRM V7.0 registradas com sucesso');
}

module.exports = { setupCRMRoutes };
