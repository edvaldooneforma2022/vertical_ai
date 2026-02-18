/**
 * 🔄 FOLLOW-UP MANAGER - Link Mágico V7.0
 * Gerenciamento de regras e jobs de follow-up automático
 */

const crypto = require('crypto');
const { db, USE_POSTGRES } = require('../../database');

function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

function placeholder(n) {
    return USE_POSTGRES ? `$${n}` : '?';
}

class FollowUpManager {

    /**
     * Criar regra de follow-up
     */
    async createRule(tenantId, ruleData) {
        const id = generateId();
        const query = `INSERT INTO followup_rules (id, tenant_id, name, trigger_type, trigger_stage_id, delay_minutes, channel, message_template, max_attempts, active)
            VALUES (${placeholder(1)}, ${placeholder(2)}, ${placeholder(3)}, ${placeholder(4)}, ${placeholder(5)}, ${placeholder(6)}, ${placeholder(7)}, ${placeholder(8)}, ${placeholder(9)}, ${USE_POSTGRES ? placeholder(10) : placeholder(10)})`;

        await db.query(query, [
            id, tenantId,
            ruleData.name,
            ruleData.trigger_type,
            ruleData.trigger_stage_id || null,
            ruleData.delay_minutes || 1440,
            ruleData.channel || 'email',
            ruleData.message_template,
            ruleData.max_attempts || 3,
            USE_POSTGRES ? (ruleData.active !== false) : (ruleData.active !== false ? 1 : 0)
        ]);

        console.log(`🔄 [FOLLOW-UP] Regra criada: ${ruleData.name}`);
        return { id, ...ruleData };
    }

    /**
     * Atualizar regra
     */
    async updateRule(tenantId, ruleId, data) {
        const fields = [];
        const params = [];
        let idx = 1;

        if (data.name !== undefined) { fields.push(`name = ${placeholder(idx++)}`); params.push(data.name); }
        if (data.trigger_type !== undefined) { fields.push(`trigger_type = ${placeholder(idx++)}`); params.push(data.trigger_type); }
        if (data.trigger_stage_id !== undefined) { fields.push(`trigger_stage_id = ${placeholder(idx++)}`); params.push(data.trigger_stage_id); }
        if (data.delay_minutes !== undefined) { fields.push(`delay_minutes = ${placeholder(idx++)}`); params.push(data.delay_minutes); }
        if (data.channel !== undefined) { fields.push(`channel = ${placeholder(idx++)}`); params.push(data.channel); }
        if (data.message_template !== undefined) { fields.push(`message_template = ${placeholder(idx++)}`); params.push(data.message_template); }
        if (data.max_attempts !== undefined) { fields.push(`max_attempts = ${placeholder(idx++)}`); params.push(data.max_attempts); }
        if (data.active !== undefined) {
            fields.push(`active = ${placeholder(idx++)}`);
            params.push(USE_POSTGRES ? data.active : (data.active ? 1 : 0));
        }

        if (fields.length === 0) throw new Error('Nenhum campo para atualizar');

        const query = `UPDATE followup_rules SET ${fields.join(', ')} WHERE id = ${placeholder(idx++)} AND tenant_id = ${placeholder(idx++)}`;
        params.push(ruleId, tenantId);

        await db.query(query, params);
        return { success: true };
    }

    /**
     * Remover regra
     */
    async deleteRule(tenantId, ruleId) {
        // Cancelar jobs pendentes desta regra
        const cancelQuery = `UPDATE followup_jobs SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE rule_id = ${placeholder(1)} AND tenant_id = ${placeholder(2)} AND status = 'pending'`;
        await db.query(cancelQuery, [ruleId, tenantId]);

        const query = `DELETE FROM followup_rules WHERE id = ${placeholder(1)} AND tenant_id = ${placeholder(2)}`;
        await db.query(query, [ruleId, tenantId]);
        return { success: true };
    }

    /**
     * Listar regras do tenant
     */
    async getRules(tenantId) {
        const query = `SELECT r.*, s.name as stage_name FROM followup_rules r LEFT JOIN crm_stages s ON r.trigger_stage_id = s.id WHERE r.tenant_id = ${placeholder(1)} ORDER BY r.created_at DESC`;
        const result = await db.query(query, [tenantId]);
        return result.rows || result;
    }

    /**
     * Obter jobs pendentes para processamento (usado pelo worker)
     * Usa FOR UPDATE SKIP LOCKED no PostgreSQL para concorrência segura
     */
    async getPendingJobs(limit = 50) {
        const now = new Date().toISOString();
        let query;

        if (USE_POSTGRES) {
            query = `
                SELECT fj.*, fr.channel, fr.message_template, fr.max_attempts as rule_max_attempts,
                       cl.name as lead_name, cl.email as lead_email, cl.phone as lead_phone,
                       cl.last_response_at
                FROM followup_jobs fj
                JOIN followup_rules fr ON fj.rule_id = fr.id
                JOIN crm_leads cl ON fj.lead_id = cl.id
                WHERE fj.status = 'pending'
                  AND fj.scheduled_for <= $1
                ORDER BY fj.scheduled_for ASC
                LIMIT $2
                FOR UPDATE OF fj SKIP LOCKED
            `;
        } else {
            query = `
                SELECT fj.*, fr.channel, fr.message_template, fr.max_attempts as rule_max_attempts,
                       cl.name as lead_name, cl.email as lead_email, cl.phone as lead_phone,
                       cl.last_response_at
                FROM followup_jobs fj
                JOIN followup_rules fr ON fj.rule_id = fr.id
                JOIN crm_leads cl ON fj.lead_id = cl.id
                WHERE fj.status = 'pending'
                  AND fj.scheduled_for <= ?
                ORDER BY fj.scheduled_for ASC
                LIMIT ?
            `;
        }

        const result = await db.query(query, [now, limit]);
        return result.rows || result;
    }

    /**
     * Marcar job como processing
     */
    async markJobProcessing(jobId) {
        const query = `UPDATE followup_jobs SET status = 'processing', updated_at = CURRENT_TIMESTAMP WHERE id = ${placeholder(1)}`;
        await db.query(query, [jobId]);
    }

    /**
     * Completar job (sucesso)
     */
    async completeJob(jobId, channel) {
        const query = `UPDATE followup_jobs SET status = 'sent', attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ${placeholder(1)}`;
        await db.query(query, [jobId]);

        // Registrar log
        const logId = generateId();
        const logQuery = `INSERT INTO followup_logs (id, job_id, channel, delivery_status) VALUES (${placeholder(1)}, ${placeholder(2)}, ${placeholder(3)}, 'sent')`;
        await db.query(logQuery, [logId, jobId, channel]);
    }

    /**
     * Falhar job
     */
    async failJob(jobId, errorMessage, maxRetries) {
        // Verificar tentativas
        const checkQuery = `SELECT attempts FROM followup_jobs WHERE id = ${placeholder(1)}`;
        const checkResult = await db.query(checkQuery, [jobId]);
        const rows = checkResult.rows || checkResult;
        const attempts = (rows[0]?.attempts || 0) + 1;

        const newStatus = attempts >= maxRetries ? 'failed' : 'pending';
        const query = `UPDATE followup_jobs SET status = ${placeholder(1)}, attempts = ${placeholder(2)}, last_error = ${placeholder(3)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${placeholder(4)}`;
        await db.query(query, [newStatus, attempts, errorMessage, jobId]);

        // Registrar log de falha
        const logId = generateId();
        const logQuery = `INSERT INTO followup_logs (id, job_id, channel, delivery_status, error_message) VALUES (${placeholder(1)}, ${placeholder(2)}, 'unknown', 'failed', ${placeholder(3)})`;
        await db.query(logQuery, [logId, jobId, errorMessage]);
    }

    /**
     * Cancelar job (lead respondeu)
     */
    async cancelJob(jobId) {
        const query = `UPDATE followup_jobs SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ${placeholder(1)}`;
        await db.query(query, [jobId]);
    }

    /**
     * Cancelar todos os jobs pendentes de um lead
     */
    async cancelJobsForLead(leadId) {
        const query = `UPDATE followup_jobs SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE lead_id = ${placeholder(1)} AND status = 'pending'`;
        const result = await db.query(query, [leadId]);
        return result.rowCount || result.changes || 0;
    }

    /**
     * Listar jobs por tenant (para painel)
     */
    async getJobsByTenant(tenantId, filters = {}) {
        let query = `
            SELECT fj.*, fr.name as rule_name, fr.channel,
                   cl.name as lead_name, cl.email as lead_email
            FROM followup_jobs fj
            JOIN followup_rules fr ON fj.rule_id = fr.id
            JOIN crm_leads cl ON fj.lead_id = cl.id
            WHERE fj.tenant_id = ${placeholder(1)}
        `;
        const params = [tenantId];
        let idx = 2;

        if (filters.status) {
            query += ` AND fj.status = ${placeholder(idx++)}`;
            params.push(filters.status);
        }

        query += ' ORDER BY fj.scheduled_for DESC LIMIT 100';

        const result = await db.query(query, params);
        return result.rows || result;
    }

    /**
     * Atualizar last_response_at de um lead CRM
     */
    async updateLeadResponse(tenantId, email) {
        try {
            const query = `UPDATE crm_leads SET last_response_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ${placeholder(1)} AND email = ${placeholder(2)}`;
            await db.query(query, [tenantId, email]);

            // Cancelar jobs pendentes para este lead
            const leadQuery = `SELECT id FROM crm_leads WHERE tenant_id = ${placeholder(1)} AND email = ${placeholder(2)}`;
            const leadResult = await db.query(leadQuery, [tenantId, email]);
            const rows = leadResult.rows || leadResult;

            if (rows.length > 0) {
                const cancelled = await this.cancelJobsForLead(rows[0].id);
                if (cancelled > 0) {
                    console.log(`🔄 [FOLLOW-UP] ${cancelled} jobs cancelados — lead ${email} respondeu`);
                }
            }
        } catch (error) {
            console.warn('⚠️ [FOLLOW-UP] Erro ao atualizar resposta do lead:', error.message);
        }
    }
}

module.exports = { FollowUpManager };
