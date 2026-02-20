/**
 * 🏢 CRM MANAGER - Link Mágico V7.0
 * Gerenciamento de Pipeline, Estágios, Leads CRM e Atividades
 * 100% desacoplado do core de chat/IA
 */

const crypto = require('crypto');
const { db, USE_POSTGRES } = require('../../database');

const DEFAULT_STAGES = [
    { name: 'Novo Lead', color: '#6366f1', order_index: 0 },
    { name: 'Engajado', color: '#3b82f6', order_index: 1 },
    { name: 'Em Negociação', color: '#f59e0b', order_index: 2 },
    { name: 'Proposta', color: '#8b5cf6', order_index: 3 },
    { name: 'Fechado', color: '#10b981', order_index: 4 },
    { name: 'Perdido', color: '#ef4444', order_index: 5 }
];

function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

function placeholder(n) {
    return USE_POSTGRES ? `$${n}` : '?';
}

class CRMManager {
    constructor() {
        this.pipelineCache = new Map();
        this.analyticsCache = new Map();
    }

    /**
     * Garantir que o pipeline padrão existe para o tenant.
     * Criado automaticamente na primeira interação.
     */
    async ensureDefaultPipeline(tenantId) {
        try {
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);
            const checkQuery = `SELECT id FROM crm_pipelines WHERE (tenant_id = ${placeholder(1)} OR tenant_uuid ${USE_POSTGRES ? '::text' : ''} = ${placeholder(1)}) AND is_default = ${USE_POSTGRES ? 'true' : '1'} LIMIT 1`;
            const existing = await db.query(checkQuery, [tenantId]);
            const rows = existing.rows || existing;

            if (rows && rows.length > 0) {
                const pipelineId = rows[0].id;
                this.pipelineCache.set(tenantId, pipelineId);
                return pipelineId;
            }

            // Criar pipeline padrão
            const pipelineId = generateId();
            const insertPipeline = `INSERT INTO crm_pipelines (id, tenant_id, tenant_uuid, name, is_default) VALUES (${placeholder(1)}, ${placeholder(2)}, ${placeholder(3)}, ${placeholder(4)}, ${USE_POSTGRES ? 'true' : '1'})`;
            await db.query(insertPipeline, [
                pipelineId,
                tenantId,
                isUUID ? tenantId : null,
                'Pipeline Principal'
            ]);
            this.pipelineCache.set(tenantId, pipelineId);

            // Criar estágios padrão
            for (const stage of DEFAULT_STAGES) {
                const stageId = generateId();
                const insertStage = `INSERT INTO crm_stages (id, pipeline_id, name, color, order_index) VALUES (${placeholder(1)}, ${placeholder(2)}, ${placeholder(3)}, ${placeholder(4)}, ${placeholder(5)})`;
                await db.query(insertStage, [stageId, pipelineId, stage.name, stage.color, stage.order_index]);
            }

            console.log(`🏢 [CRM] Pipeline padrão criado para tenant ${tenantId.substring(0, 8)}...`);
            return pipelineId;
        } catch (error) {
            console.error('❌ [CRM] Erro ao criar pipeline padrão:', error.message);
            throw error;
        }
    }

    /**
     * Obter pipeline com estágios do tenant
     */
    async getPipeline(tenantId) {
        try {
            const pipelineId = await this.ensureDefaultPipeline(tenantId);

            const stagesQuery = `SELECT * FROM crm_stages WHERE pipeline_id = ${placeholder(1)} ORDER BY order_index ASC`;
            const stagesResult = await db.query(stagesQuery, [pipelineId]);
            const stages = stagesResult.rows || stagesResult;

            const pipelineQuery = `SELECT * FROM crm_pipelines WHERE id = ${placeholder(1)}`;
            const pipelineResult = await db.query(pipelineQuery, [pipelineId]);
            const pipeline = (pipelineResult.rows || pipelineResult)[0];

            return {
                ...pipeline,
                stages
            };
        } catch (error) {
            console.error('❌ [CRM] Erro ao obter pipeline:', error.message);
            throw error;
        }
    }

    /**
     * Calcular score do lead baseado nos dados disponíveis (0-100).
     * Quanto mais dados completos, maior o score.
     */
    calculateLeadScore(leadData) {
        let score = 0;

        // Nome informado (não genérico)
        const name = leadData.nome || leadData.name || '';
        if (name && name !== 'Não informado' && name.trim().length > 0) {
            score += 10;
        }

        // Email presente
        if (leadData.email && leadData.email.includes('@')) {
            score += 10;
        }

        // Telefone informado (sinal de alto interesse)
        const phone = leadData.telefone || leadData.phone || '';
        if (phone && phone !== 'Não informado' && phone.trim().length > 0) {
            score += 15;
        }

        // Veio do widget (tem url_origem)
        if (leadData.url_origem && leadData.url_origem.trim().length > 0) {
            score += 10;
        }

        // Empresa informada (sinal B2B)
        if (leadData.company && leadData.company.trim().length > 0) {
            score += 10;
        }

        // Já tem conversationId (engajou no chat)
        if (leadData.conversationId) {
            score += 5;
        }

        return Math.min(score, 100);
    }

    /**
     * Determinar temperatura do lead baseado no score.
     * >= 35 → hot, >= 20 → warm, < 20 → cold
     */
    determineTemperature(score) {
        if (score >= 35) return 'hot';
        if (score >= 20) return 'warm';
        return 'cold';
    }

    /**
     * Sincronizar lead do sistema de captura para o CRM.
     * Chamado via hook após criação de lead em /api/capture-lead.
     */
    async syncLeadToCRM(tenantId, leadData) {
        try {
            // Verificar se já existe no CRM
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);
            const checkQuery = `SELECT id FROM crm_leads WHERE (tenant_id = ${placeholder(1)} OR tenant_uuid ${USE_POSTGRES ? '::text' : ''} = ${placeholder(1)}) AND email = ${placeholder(2)} LIMIT 1`;
            const existing = await db.query(checkQuery, [tenantId, leadData.email]);
            const rows = existing.rows || existing;

            if (rows && rows.length > 0) {
                // Atualizar last_contact_at
                const updateQuery = `UPDATE crm_leads SET last_contact_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ${placeholder(1)} AND (tenant_id = ${placeholder(2)} OR tenant_uuid ${USE_POSTGRES ? '::text' : ''} = ${placeholder(2)})`;
                await db.query(updateQuery, [rows[0].id, tenantId]);
                return rows[0].id;
            }

            // Garantir pipeline e pegar estágio "Novo Lead"
            const pipelineId = await this.ensureDefaultPipeline(tenantId);
            const stageQuery = `SELECT id FROM crm_stages WHERE pipeline_id = ${placeholder(1)} AND order_index = 0 LIMIT 1`;
            const stageResult = await db.query(stageQuery, [pipelineId]);
            const stageRows = stageResult.rows || stageResult;
            const firstStageId = stageRows.length > 0 ? stageRows[0].id : null;

            const insertQuery = `INSERT INTO crm_leads (id, tenant_id, tenant_uuid, original_lead_id, name, email, phone, source, stage_id, estimated_value, temperature, score, last_contact_at)
                VALUES (${placeholder(1)}, ${placeholder(2)}, ${placeholder(3)}, ${placeholder(4)}, ${placeholder(5)}, ${placeholder(6)}, ${placeholder(7)}, ${placeholder(8)}, ${placeholder(9)}, ${placeholder(10)}, ${placeholder(11)}, ${placeholder(12)}, CURRENT_TIMESTAMP)`;

            // Calcular score e temperatura automaticamente (com fallback seguro)
            let score = 0;
            let temperature = 'cold';
            try {
                score = this.calculateLeadScore(leadData);
                temperature = this.determineTemperature(score);
            } catch (scoreErr) {
                console.warn('⚠️ [CRM] Erro no scoring (usando cold/0 como fallback):', scoreErr.message);
            }

            const estimatedValue = parseFloat(leadData.estimated_value || leadData.estimatedValue || 0) || 0;

            // ✅ Declarar IDs antes de usar no INSERT
            const leadId = generateId();
            const originalLeadId = leadData.id || leadData.leadId || leadData.original_lead_id || null;

            await db.query(insertQuery, [
                leadId,
                tenantId,
                isUUID ? tenantId : null,
                originalLeadId,
                leadData.nome || leadData.name || 'Não informado',
                leadData.email,
                leadData.telefone || leadData.phone || '',
                leadData.url_origem ? 'widget' : 'manual',
                firstStageId,
                estimatedValue,
                temperature,
                score
            ]);

            // Registrar atividade
            await this.addActivity(tenantId, leadId, 'created', 'Lead sincronizado do widget de chat');

            // Verificar regras de follow-up para trigger 'new_lead'
            await this._checkFollowUpTriggers(tenantId, leadId, 'new_lead', null);

            // Executar regras de automação para trigger 'new_lead'
            await this._executeAutomationRules(tenantId, leadId, 'new_lead', null);

            console.log(`🏢 [CRM] Lead sincronizado: ${leadData.email} → estágio "Novo Lead" | temp: ${temperature} (score: ${score}) | valor: R$ ${estimatedValue}`);
            return leadId;
        } catch (error) {
            console.error('❌ [CRM] Erro ao sincronizar lead:', error.message);
            throw error;
        }
    }

    /**
     * Obter leads agrupados por estágio (para Kanban)
     */
    async getLeadsByStage(tenantId, pipelineId) {
        try {
            if (!pipelineId) {
                pipelineId = await this.ensureDefaultPipeline(tenantId);
            }

            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);
            const query = `
                SELECT cl.*, cs.name as stage_name, cs.color as stage_color, cs.order_index
                FROM crm_leads cl
                LEFT JOIN crm_stages cs ON cl.stage_id = cs.id
                WHERE (cl.tenant_id = ${placeholder(1)} OR cl.tenant_uuid ${USE_POSTGRES ? '::text' : ''} = ${placeholder(1)})
                  AND (cs.pipeline_id = ${placeholder(2)} OR cl.stage_id IS NULL)
                ORDER BY cs.order_index ASC, cl.updated_at DESC
            `;
            const result = await db.query(query, [tenantId, pipelineId]);
            const leads = result.rows || result;

            // Agrupar por estágio
            const stagesQuery = `SELECT * FROM crm_stages WHERE pipeline_id = ${placeholder(1)} ORDER BY order_index ASC`;
            const stagesResult = await db.query(stagesQuery, [pipelineId]);
            const stages = stagesResult.rows || stagesResult;

            const grouped = {};
            for (const stage of stages) {
                grouped[stage.id] = {
                    id: stage.id,
                    name: stage.name,
                    color: stage.color,
                    order_index: stage.order_index,
                    leads: []
                };
            }

            for (const lead of leads) {
                const sid = lead.stage_id;
                if (sid && grouped[sid]) {
                    grouped[sid].leads.push(lead);
                }
            }

            return Object.values(grouped).sort((a, b) => a.order_index - b.order_index);
        } catch (error) {
            console.error('❌ [CRM] Erro ao obter leads por estágio:', error.message);
            throw error;
        }
    }

    /**
     * Mover lead para outro estágio
     */
    async moveLeadToStage(tenantId, leadId, newStageId) {
        try {
            // Obter estágio atual
            const currentQuery = `SELECT stage_id FROM crm_leads WHERE id = ${placeholder(1)} AND tenant_id = ${placeholder(2)}`;
            const currentResult = await db.query(currentQuery, [leadId, tenantId]);
            const currentRows = currentResult.rows || currentResult;
            const oldStageId = currentRows.length > 0 ? currentRows[0].stage_id : null;

            // Atualizar estágio
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);
            const updateQuery = `UPDATE crm_leads SET stage_id = ${placeholder(1)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${placeholder(2)} AND (tenant_id = ${placeholder(3)} OR tenant_uuid ${USE_POSTGRES ? '::text' : ''} = ${placeholder(3)})`;
            await db.query(updateQuery, [newStageId, leadId, tenantId]);

            // Obter nomes dos estágios para log
            let oldName = 'N/A', newName = 'N/A';
            if (oldStageId) {
                const oldQ = await db.query(`SELECT name FROM crm_stages WHERE id = ${placeholder(1)}`, [oldStageId]);
                oldName = ((oldQ.rows || oldQ)[0] || {}).name || 'N/A';
            }
            const newQ = await db.query(`SELECT name FROM crm_stages WHERE id = ${placeholder(1)}`, [newStageId]);
            newName = ((newQ.rows || newQ)[0] || {}).name || 'N/A';

            // Registrar atividade
            await this.addActivity(tenantId, leadId, 'stage_change', `Movido de "${oldName}" para "${newName}"`, oldName, newName);

            // Verificar regras de follow-up para trigger 'stage_change'
            await this._checkFollowUpTriggers(tenantId, leadId, 'stage_change', newStageId);

            // Disparar webhooks externos para o evento 'stage_change'
            await this._dispatchWebhooks(tenantId, 'stage_change', {
                lead_id: leadId,
                old_stage: oldName,
                new_stage: newName,
                old_stage_id: oldStageId,
                new_stage_id: newStageId
            });

            // Executar regras de automação para trigger 'stage_change'
            await this._executeAutomationRules(tenantId, leadId, 'stage_change', newStageId);

            console.log(`🏢 [CRM] Lead ${leadId.substring(0, 8)}... movido: ${oldName} → ${newName}`);
            return { success: true, oldStage: oldName, newStage: newName };
        } catch (error) {
            console.error('❌ [CRM] Erro ao mover lead:', error.message);
            throw error;
        }
    }

    /**
     * Atualizar temperatura do lead
     */
    async updateLeadTemperature(tenantId, leadId, temperature) {
        const validTemps = ['cold', 'warm', 'hot'];
        if (!validTemps.includes(temperature)) {
            throw new Error(`Temperatura inválida: ${temperature}. Usar: ${validTemps.join(', ')}`);
        }

        const query = `UPDATE crm_leads SET temperature = ${placeholder(1)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${placeholder(2)} AND tenant_id = ${placeholder(3)}`;
        await db.query(query, [temperature, leadId, tenantId]);

        await this.addActivity(tenantId, leadId, 'temperature_change', `Temperatura atualizada para ${temperature}`, null, temperature);
        return { success: true };
    }

    /**
     * Obter lead CRM por ID
     */
    async getLeadById(tenantId, leadId) {
        const query = `
            SELECT cl.*, cs.name as stage_name, cs.color as stage_color
            FROM crm_leads cl
            LEFT JOIN crm_stages cs ON cl.stage_id = cs.id
            WHERE cl.id = ${placeholder(1)} AND cl.tenant_id = ${placeholder(2)}
        `;
        const result = await db.query(query, [leadId, tenantId]);
        const rows = result.rows || result;
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Listar todos os leads CRM do tenant
     */
    async getLeads(tenantId, filters = {}) {
        let query = `
            SELECT cl.*, cs.name as stage_name, cs.color as stage_color
            FROM crm_leads cl
            LEFT JOIN crm_stages cs ON cl.stage_id = cs.id
            WHERE cl.tenant_id = ${placeholder(1)}
        `;
        const params = [tenantId];
        let paramIndex = 2;

        if (filters.temperature) {
            query += ` AND cl.temperature = ${placeholder(paramIndex++)}`;
            params.push(filters.temperature);
        }
        if (filters.stage_id) {
            query += ` AND cl.stage_id = ${placeholder(paramIndex++)}`;
            params.push(filters.stage_id);
        }

        query += ' ORDER BY cl.updated_at DESC';

        if (filters.limit) {
            query += ` LIMIT ${placeholder(paramIndex++)}`;
            params.push(filters.limit);
        }

        const result = await db.query(query, params);
        return result.rows || result;
    }

    /**
     * Registrar atividade
     */
    async addActivity(tenantId, leadId, type, description, oldValue = null, newValue = null) {
        try {
            const id = generateId();
            const query = `INSERT INTO crm_activities (id, tenant_id, lead_id, type, description, old_value, new_value)
                VALUES (${placeholder(1)}, ${placeholder(2)}, ${placeholder(3)}, ${placeholder(4)}, ${placeholder(5)}, ${placeholder(6)}, ${placeholder(7)})`;
            await db.query(query, [id, tenantId, leadId, type, description, oldValue, newValue]);
            return id;
        } catch (error) {
            console.error('❌ [CRM] Erro ao registrar atividade:', error.message);
            // Não relançar — atividade é secundária
        }
    }

    /**
     * Obter atividades de um lead
     */
    async getActivities(tenantId, leadId, limit = 50) {
        const query = `SELECT * FROM crm_activities WHERE lead_id = ${placeholder(1)} AND tenant_id = ${placeholder(2)} ORDER BY created_at DESC LIMIT ${placeholder(3)}`;
        const result = await db.query(query, [leadId, tenantId, limit]);
        return result.rows || result;
    }

    /**
     * Verificar regras de follow-up para triggers
     * @private
     */
    async _checkFollowUpTriggers(tenantId, leadId, triggerType, stageId) {
        try {
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId);
            let query = `SELECT * FROM followup_rules WHERE (tenant_id = ${placeholder(1)} OR tenant_uuid ${USE_POSTGRES ? '::text' : ''} = ${placeholder(1)}) AND trigger_type = ${placeholder(2)} AND active = ${USE_POSTGRES ? 'true' : '1'}`;
            const params = [tenantId, triggerType];

            if (stageId && triggerType === 'stage_change') {
                query += ` AND (trigger_stage_id = ${placeholder(3)} OR trigger_stage_id IS NULL)`;
                params.push(stageId);
            }

            const result = await db.query(query, params);
            const rules = result.rows || result;

            for (const rule of rules) {
                const jobId = generateId();
                const scheduledFor = new Date(Date.now() + rule.delay_minutes * 60 * 1000).toISOString();

                const insertJob = `INSERT INTO followup_jobs (id, tenant_id, tenant_uuid, lead_id, rule_id, scheduled_for, status)
                    VALUES (${placeholder(1)}, ${placeholder(2)}, ${placeholder(3)}, ${placeholder(4)}, ${placeholder(5)}, ${placeholder(6)}, 'pending')`;
                await db.query(insertJob, [
                    jobId,
                    tenantId,
                    isUUID ? tenantId : null,
                    leadId,
                    rule.id,
                    scheduledFor
                ]);

                console.log(`📋 [CRM] Follow-up job criado: ${rule.name} → agendado para ${scheduledFor}`);
            }
        } catch (error) {
            console.error('⚠️ [CRM] Erro ao verificar triggers de follow-up:', error.message);
            // Não relançar — é secundário
        }
    }

    /**
     * Analytics CRM: conversão por estágio, tempo médio, receita por canal, taxa de resposta
     */
    async getAnalytics(tenantId) {
        try {
            const cached = this.analyticsCache.get(tenantId);
            if (cached && cached.expiresAt > Date.now()) {
                return cached.data;
            }

            const pipelineId = await this.ensureDefaultPipeline(tenantId);

            // Contagem por estágio
            const stageCountsQuery = `
                SELECT cs.name, cs.color, cs.order_index, COUNT(cl.id) as lead_count
                FROM crm_stages cs
                LEFT JOIN crm_leads cl ON cl.stage_id = cs.id AND cl.tenant_id = ${placeholder(1)}
                WHERE cs.pipeline_id = ${placeholder(2)}
                GROUP BY cs.id, cs.name, cs.color, cs.order_index
                ORDER BY cs.order_index ASC
            `;
            const stageCounts = await db.query(stageCountsQuery, [tenantId, pipelineId]);

            // Contagem por temperatura
            const tempQuery = `
                SELECT temperature, COUNT(*) as count
                FROM crm_leads WHERE tenant_id = ${placeholder(1)}
                GROUP BY temperature
            `;
            const tempCounts = await db.query(tempQuery, [tenantId]);

            // Total de leads CRM
            const totalQuery = `SELECT COUNT(*) as total FROM crm_leads WHERE tenant_id = ${placeholder(1)}`;
            const totalResult = await db.query(totalQuery, [tenantId]);

            // Receita estimada dos deals abertos
            const revenueQuery = `
                SELECT
                    COUNT(*) as total_deals,
                    COALESCE(SUM(value), 0) as total_value,
                    COALESCE(SUM(value * probability / 100.0), 0) as weighted_value
                FROM crm_deals
                WHERE tenant_id = ${placeholder(1)} AND status = 'open'
            `;
            const revenueResult = await db.query(revenueQuery, [tenantId]);

            // Follow-up stats
            const followupQuery = `
                SELECT status, COUNT(*) as count
                FROM followup_jobs WHERE tenant_id = ${placeholder(1)}
                GROUP BY status
            `;
            const followupStats = await db.query(followupQuery, [tenantId]);

            // ===== MÉTRICAS AVANÇADAS =====

            // 1. Conversão por estágio: percentual de leads em cada estágio
            const totalLeadsVal = parseInt(((totalResult.rows || totalResult)[0] || {}).total) || 0;
            const byStageRaw = (stageCounts.rows || stageCounts).map(r => ({
                name: r.name,
                color: r.color,
                count: parseInt(r.lead_count) || 0
            }));
            const conversionByStage = byStageRaw.map(s => ({
                ...s,
                conversionRate: totalLeadsVal > 0 ? Math.round((s.count / totalLeadsVal) * 100) : 0
            }));

            // 2. Tempo médio até fechamento (deals won)
            let avgTimeToClose = 0;
            try {
                const timeQuery = USE_POSTGRES
                    ? `SELECT AVG(EXTRACT(EPOCH FROM (d.updated_at - d.created_at)) / 86400.0) as avg_days
                       FROM crm_deals d WHERE d.tenant_id = ${placeholder(1)} AND d.status = 'won'`
                    : `SELECT AVG(JULIANDAY(d.updated_at) - JULIANDAY(d.created_at)) as avg_days
                       FROM crm_deals d WHERE d.tenant_id = ${placeholder(1)} AND d.status = 'won'`;
                const timeResult = await db.query(timeQuery, [tenantId]);
                avgTimeToClose = parseFloat(((timeResult.rows || timeResult)[0] || {}).avg_days) || 0;
            } catch (e) { /* ignore */ }

            // 3. Receita por canal (source)
            let revenueByChannel = [];
            try {
                const channelQuery = `
                    SELECT cl.source, COUNT(d.id) as deal_count,
                        COALESCE(SUM(d.value), 0) as total_value
                    FROM crm_deals d
                    JOIN crm_leads cl ON d.lead_id = cl.id
                    WHERE d.tenant_id = ${placeholder(1)}
                    GROUP BY cl.source
                    ORDER BY total_value DESC
                `;
                const channelResult = await db.query(channelQuery, [tenantId]);
                revenueByChannel = (channelResult.rows || channelResult).map(r => ({
                    source: r.source || 'desconhecido',
                    dealCount: parseInt(r.deal_count) || 0,
                    totalValue: parseFloat(r.total_value) || 0
                }));
            } catch (e) { /* ignore */ }

            // 4. Taxa de resposta de follow-up
            let followupResponseRate = 0;
            let avgAttemptsUntilResponse = 0;
            try {
                const responseQuery = `
                    SELECT
                        COUNT(*) as total_sent,
                        SUM(CASE WHEN response_detected = ${USE_POSTGRES ? 'true' : '1'} THEN 1 ELSE 0 END) as responded
                    FROM followup_logs
                    WHERE job_id IN (SELECT id FROM followup_jobs WHERE tenant_id = ${placeholder(1)})
                    AND delivery_status = 'sent'
                `;
                const responseResult = await db.query(responseQuery, [tenantId]);
                const respRow = (responseResult.rows || responseResult)[0] || {};
                const totalSent = parseInt(respRow.total_sent) || 0;
                const responded = parseInt(respRow.responded) || 0;
                followupResponseRate = totalSent > 0 ? Math.round((responded / totalSent) * 100) : 0;

                // 5. Média de tentativas até resposta
                const attemptsQuery = `
                    SELECT AVG(fj.attempts) as avg_attempts
                    FROM followup_jobs fj
                    WHERE fj.tenant_id = ${placeholder(1)}
                    AND fj.status IN ('sent', 'cancelled')
                `;
                const attemptsResult = await db.query(attemptsQuery, [tenantId]);
                avgAttemptsUntilResponse = parseFloat(((attemptsResult.rows || attemptsResult)[0] || {}).avg_attempts) || 0;
            } catch (e) { /* ignore */ }

            const resultObject = {
                totalLeads: totalLeadsVal,
                byStage: conversionByStage,
                byTemperature: (tempCounts.rows || tempCounts).reduce((acc, r) => {
                    acc[r.temperature] = parseInt(r.count) || 0;
                    return acc;
                }, { cold: 0, warm: 0, hot: 0 }),
                deals: {
                    totalDeals: parseInt(((revenueResult.rows || revenueResult)[0] || {}).total_deals) || 0,
                    totalValue: parseFloat(((revenueResult.rows || revenueResult)[0] || {}).total_value) || 0,
                    weightedValue: parseFloat(((revenueResult.rows || revenueResult)[0] || {}).weighted_value) || 0
                },
                followup: (followupStats.rows || followupStats).reduce((acc, r) => {
                    acc[r.status] = parseInt(r.count) || 0;
                    return acc;
                }, { pending: 0, processing: 0, sent: 0, cancelled: 0, failed: 0 }),
                // Métricas avançadas
                advancedMetrics: {
                    conversionByStage,
                    avgTimeToCloseDays: Math.round(avgTimeToClose * 10) / 10,
                    revenueByChannel,
                    followupResponseRate,
                    avgAttemptsUntilResponse: Math.round(avgAttemptsUntilResponse * 10) / 10
                }
            };

            this.analyticsCache.set(tenantId, {
                data: resultObject,
                expiresAt: Date.now() + 60000 // 60 segundos
            });

            return resultObject;
        } catch (error) {
            console.error('❌ [CRM] Erro ao obter analytics:', error.message);
            throw error;
        }
    }

    /**
     * Reclassificar leads existentes que foram salvos com score=0 e temperature='cold'.
     * Recalcula score baseado nos dados disponíveis no banco.
     * Seguro: protegido por try/catch, não afeta nenhum fluxo existente.
     */
    async reclassifyExistingLeads(tenantId) {
        try {
            const query = `SELECT id, name, email, phone, source FROM crm_leads WHERE tenant_id = ${placeholder(1)} AND score = 0 AND temperature = 'cold'`;
            const result = await db.query(query, [tenantId]);
            const leads = result.rows || result;

            if (!leads || leads.length === 0) {
                console.log('🏢 [CRM] Nenhum lead para reclassificar.');
                return { updated: 0 };
            }

            let updated = 0;
            for (const lead of leads) {
                const leadData = {
                    nome: lead.name,
                    email: lead.email,
                    telefone: lead.phone,
                    url_origem: lead.source === 'widget' ? 'widget' : ''
                };

                const score = this.calculateLeadScore(leadData);
                const temperature = this.determineTemperature(score);

                if (temperature !== 'cold' || score > 0) {
                    const updateQuery = `UPDATE crm_leads SET score = ${placeholder(1)}, temperature = ${placeholder(2)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${placeholder(3)} AND tenant_id = ${placeholder(4)}`;
                    await db.query(updateQuery, [score, temperature, lead.id, tenantId]);
                    updated++;
                }
            }

            console.log(`🏢 [CRM] Reclassificados ${updated}/${leads.length} leads para tenant ${tenantId.substring(0, 8)}...`);
            return { updated, total: leads.length };
        } catch (error) {
            console.error('⚠️ [CRM] Erro ao reclassificar leads (não bloqueia):', error.message);
            return { updated: 0, error: error.message };
        }
    }

    // =============================================
    // WEBHOOK DISPATCH (stage_change → external)
    // =============================================

    /**
     * Disparar webhooks externos configurados para o evento
     * @private
     */
    async _dispatchWebhooks(tenantId, eventType, payload) {
        try {
            const query = `SELECT * FROM crm_webhooks WHERE tenant_id = ${placeholder(1)} AND event_type = ${placeholder(2)} AND active = ${USE_POSTGRES ? 'true' : '1'}`;
            const result = await db.query(query, [tenantId, eventType]);
            const webhooks = result.rows || result;

            for (const wh of webhooks) {
                try {
                    const headers = typeof wh.headers === 'string' ? JSON.parse(wh.headers || '{}') : (wh.headers || {});
                    const fetchModule = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
                    await fetchModule(wh.url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...headers },
                        body: JSON.stringify({
                            event: eventType,
                            tenant_id: tenantId,
                            timestamp: new Date().toISOString(),
                            data: payload
                        }),
                        signal: AbortSignal.timeout(5000)
                    });
                    console.log(`🔗 [CRM] Webhook enviado: ${wh.url}`);
                } catch (whErr) {
                    console.warn(`⚠️ [CRM] Webhook falhou: ${wh.url} — ${whErr.message}`);
                }
            }
        } catch (error) {
            console.warn('⚠️ [CRM] Erro ao disparar webhooks:', error.message);
        }
    }

    // =============================================
    // WEBHOOK CRUD
    // =============================================

    async createWebhook(tenantId, data) {
        const id = generateId();
        const query = `INSERT INTO crm_webhooks (id, tenant_id, event_type, url, headers)
            VALUES (${placeholder(1)}, ${placeholder(2)}, ${placeholder(3)}, ${placeholder(4)}, ${placeholder(5)})`;
        await db.query(query, [
            id, tenantId,
            data.event_type || 'stage_change',
            data.url,
            JSON.stringify(data.headers || {})
        ]);
        return { id, ...data };
    }

    async getWebhooks(tenantId) {
        const query = `SELECT * FROM crm_webhooks WHERE tenant_id = ${placeholder(1)} ORDER BY created_at DESC`;
        const result = await db.query(query, [tenantId]);
        return result.rows || result;
    }

    async deleteWebhook(tenantId, webhookId) {
        const query = `DELETE FROM crm_webhooks WHERE id = ${placeholder(1)} AND tenant_id = ${placeholder(2)}`;
        await db.query(query, [webhookId, tenantId]);
        return { deleted: true };
    }

    // =============================================
    // AUTOMATION RULES ENGINE
    // =============================================

    /**
     * Criar regra de automação condicional
     */
    async createAutomationRule(tenantId, data) {
        const id = generateId();
        const query = `INSERT INTO crm_automation_rules (id, tenant_id, name, trigger_type, condition_field, condition_operator, condition_value, action_type, action_target, action_config)
            VALUES (${placeholder(1)}, ${placeholder(2)}, ${placeholder(3)}, ${placeholder(4)}, ${placeholder(5)}, ${placeholder(6)}, ${placeholder(7)}, ${placeholder(8)}, ${placeholder(9)}, ${placeholder(10)})`;
        await db.query(query, [
            id, tenantId,
            data.name || 'Nova Regra',
            data.trigger_type || 'stage_change',
            data.condition_field || null,
            data.condition_operator || 'equals',
            data.condition_value || null,
            data.action_type || 'move_stage',
            data.action_target || null,
            JSON.stringify(data.action_config || {})
        ]);
        console.log(`⚡ [CRM] Automação criada: ${data.name}`);
        return { id, ...data };
    }

    async getAutomationRules(tenantId) {
        const query = `SELECT * FROM crm_automation_rules WHERE tenant_id = ${placeholder(1)} ORDER BY created_at DESC`;
        const result = await db.query(query, [tenantId]);
        return result.rows || result;
    }

    async deleteAutomationRule(tenantId, ruleId) {
        const query = `DELETE FROM crm_automation_rules WHERE id = ${placeholder(1)} AND tenant_id = ${placeholder(2)}`;
        await db.query(query, [ruleId, tenantId]);
        return { deleted: true };
    }

    async toggleAutomationRule(tenantId, ruleId, active) {
        const query = `UPDATE crm_automation_rules SET active = ${placeholder(1)} WHERE id = ${placeholder(2)} AND tenant_id = ${placeholder(3)}`;
        await db.query(query, [active ? (USE_POSTGRES ? true : 1) : (USE_POSTGRES ? false : 0), ruleId, tenantId]);
        return { updated: true };
    }

    /**
     * Executar regras de automação para um trigger específico
     * @private
     */
    async _executeAutomationRules(tenantId, leadId, triggerType, stageId) {
        try {
            const query = `SELECT * FROM crm_automation_rules WHERE tenant_id = ${placeholder(1)} AND trigger_type = ${placeholder(2)} AND active = ${USE_POSTGRES ? 'true' : '1'}`;
            const result = await db.query(query, [tenantId, triggerType]);
            const rules = result.rows || result;

            if (!rules || rules.length === 0) return;

            // Obter dados do lead para avaliar condições
            const leadQuery = `SELECT * FROM crm_leads WHERE id = ${placeholder(1)} AND tenant_id = ${placeholder(2)}`;
            const leadResult = await db.query(leadQuery, [leadId, tenantId]);
            const leadRows = leadResult.rows || leadResult;
            if (!leadRows || leadRows.length === 0) return;
            const lead = leadRows[0];

            for (const rule of rules) {
                try {
                    // Avaliar condição
                    if (rule.condition_field && rule.condition_value) {
                        const fieldValue = String(lead[rule.condition_field] || '');
                        const condValue = String(rule.condition_value);
                        let matches = false;

                        switch (rule.condition_operator) {
                            case 'equals': matches = fieldValue === condValue; break;
                            case 'not_equals': matches = fieldValue !== condValue; break;
                            case 'contains': matches = fieldValue.includes(condValue); break;
                            case 'greater_than': matches = parseFloat(fieldValue) > parseFloat(condValue); break;
                            case 'less_than': matches = parseFloat(fieldValue) < parseFloat(condValue); break;
                            default: matches = fieldValue === condValue;
                        }

                        if (!matches) continue; // Condição não atendida
                    }

                    // Executar ação
                    switch (rule.action_type) {
                        case 'move_stage':
                            if (rule.action_target && rule.action_target !== lead.stage_id) {
                                await this.moveLeadToStage(tenantId, leadId, rule.action_target);
                                await this.addActivity(tenantId, leadId, 'automation', `Automação "${rule.name}": movido para novo estágio`);
                            }
                            break;
                        case 'update_temperature':
                            if (rule.action_target) {
                                await this.updateLeadTemperature(tenantId, leadId, rule.action_target);
                                await this.addActivity(tenantId, leadId, 'automation', `Automação "${rule.name}": temperatura atualizada para ${rule.action_target}`);
                            }
                            break;
                        case 'add_activity':
                            await this.addActivity(tenantId, leadId, 'reminder', rule.action_target || `Lembrete: ${rule.name}`);
                            break;
                        default:
                            console.log(`⚡ [CRM] Ação desconhecida: ${rule.action_type}`);
                    }

                    console.log(`⚡ [CRM] Automação executada: ${rule.name}`);
                } catch (ruleErr) {
                    console.warn(`⚠️ [CRM] Erro na automação "${rule.name}":`, ruleErr.message);
                }
            }
        } catch (error) {
            console.warn('⚠️ [CRM] Erro ao executar automações:', error.message);
        }
    }
}

module.exports = { CRMManager };
