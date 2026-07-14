/**
 * 💰 DEALS MANAGER - Link Mágico V7.0
 * Gerenciamento de negócios/deals para previsão de receita
 */

const crypto = require('crypto');
const { db, USE_POSTGRES } = require('../../database');

function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

function placeholder(n) {
    return USE_POSTGRES ? `$${n}` : '?';
}

class DealsManager {

    /**
     * Criar novo deal
     */
    async createDeal(tenantId, leadId, dealData) {
        const id = generateId();
        const query = `INSERT INTO crm_deals (id, tenant_id, lead_id, title, value, probability, expected_close_date, status)
            VALUES (${placeholder(1)}, ${placeholder(2)}, ${placeholder(3)}, ${placeholder(4)}, ${placeholder(5)}, ${placeholder(6)}, ${placeholder(7)}, ${placeholder(8)})`;

        await db.query(query, [
            id, tenantId, leadId,
            dealData.title || 'Novo Negócio',
            dealData.value || 0,
            dealData.probability || 50,
            dealData.expected_close_date || null,
            'open'
        ]);

        console.log(`💰 [DEALS] Novo deal criado: ${dealData.title || 'Novo Negócio'} — R$ ${dealData.value || 0}`);
        return { id, ...dealData };
    }

    /**
     * Atualizar deal
     */
    async updateDeal(tenantId, dealId, data) {
        const fields = [];
        const params = [];
        let idx = 1;

        if (data.title !== undefined) { fields.push(`title = ${placeholder(idx++)}`); params.push(data.title); }
        if (data.value !== undefined) { fields.push(`value = ${placeholder(idx++)}`); params.push(data.value); }
        if (data.probability !== undefined) { fields.push(`probability = ${placeholder(idx++)}`); params.push(data.probability); }
        if (data.expected_close_date !== undefined) { fields.push(`expected_close_date = ${placeholder(idx++)}`); params.push(data.expected_close_date); }
        if (data.status !== undefined) { fields.push(`status = ${placeholder(idx++)}`); params.push(data.status); }

        fields.push('updated_at = CURRENT_TIMESTAMP');

        if (fields.length <= 1) {
            throw new Error('Nenhum campo para atualizar');
        }

        const query = `UPDATE crm_deals SET ${fields.join(', ')} WHERE id = ${placeholder(idx++)} AND tenant_id = ${placeholder(idx++)}`;
        params.push(dealId, tenantId);

        await db.query(query, params);
        return { success: true };
    }

    /**
     * Listar deals do tenant
     */
    async getDealsByTenant(tenantId, filters = {}) {
        let query = `
            SELECT d.*, cl.name as lead_name, cl.email as lead_email
            FROM crm_deals d
            LEFT JOIN crm_leads cl ON d.lead_id = cl.id
            WHERE d.tenant_id = ${placeholder(1)}
        `;
        const params = [tenantId];
        let idx = 2;

        if (filters.status) {
            query += ` AND d.status = ${placeholder(idx++)}`;
            params.push(filters.status);
        }

        query += ' ORDER BY d.created_at DESC';

        const result = await db.query(query, params);
        return result.rows || result;
    }

    /**
     * Obter estatísticas de receita
     */
    async getRevenueStats(tenantId) {
        const query = `
            SELECT
                status,
                COUNT(*) as count,
                COALESCE(SUM(value), 0) as total_value,
                COALESCE(SUM(value * probability / 100.0), 0) as weighted_value,
                COALESCE(AVG(probability), 0) as avg_probability
            FROM crm_deals
            WHERE tenant_id = ${placeholder(1)}
            GROUP BY status
        `;
        const result = await db.query(query, [tenantId]);
        const rows = result.rows || result;

        const stats = { open: { count: 0, total: 0, weighted: 0 }, won: { count: 0, total: 0 }, lost: { count: 0, total: 0 } };

        for (const row of rows) {
            if (row.status === 'open') {
                stats.open = { count: parseInt(row.count), total: parseFloat(row.total_value), weighted: parseFloat(row.weighted_value) };
            } else if (row.status === 'won') {
                stats.won = { count: parseInt(row.count), total: parseFloat(row.total_value) };
            } else if (row.status === 'lost') {
                stats.lost = { count: parseInt(row.count), total: parseFloat(row.total_value) };
            }
        }

        return stats;
    }
}

module.exports = { DealsManager };
