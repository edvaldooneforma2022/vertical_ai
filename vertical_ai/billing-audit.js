/**
 * 📒 BILLING AUDIT LEDGER - Link Mágico
 * Sistema de auditoria financeira imutável (Event Sourcing)
 * 
 * Registra TODOS os eventos financeiros em tabela append-only.
 * Nenhum registro pode ser editado ou deletado — apenas novos eventos são inseridos.
 * 
 * Fallback: se DB falhar, loga no console e continua (fail-open).
 */

const crypto = require('crypto');

class BillingAuditLedger {
    constructor(db, usePostgres) {
        this.db = db;
        this.usePostgres = usePostgres;
        this.enabled = !!usePostgres; // Só funciona com PostgreSQL

        if (this.enabled) {
            console.log('📒 [AUDIT LEDGER] Sistema de auditoria financeira ativo');
        } else {
            console.log('⚠️ [AUDIT LEDGER] Desabilitado (requer PostgreSQL)');
        }
    }

    /**
     * Registrar evento financeiro imutável
     * @param {object} eventData
     * @param {string} eventData.tenantId - ID do tenant
     * @param {string} eventData.eventType - Tipo do evento (subscription_created, payment_succeeded, etc.)
     * @param {string} [eventData.planId] - ID do plano
     * @param {number} [eventData.amountCents] - Valor em centavos
     * @param {string} [eventData.currency] - Moeda (default: BRL)
     * @param {object} [eventData.previousState] - Estado anterior
     * @param {object} [eventData.newState] - Novo estado
     * @param {string} [eventData.source] - Origem (stripe, hotmart, admin, system)
     * @param {string} [eventData.externalRef] - Referência externa (Stripe ID, etc.)
     * @param {string} [eventData.ipAddress] - IP do solicitante
     * @param {object} [eventData.metadata] - Dados extras
     */
    async recordEvent(eventData) {
        if (!this.enabled) {
            console.log(`📒 [AUDIT] ${eventData.eventType} | tenant=${eventData.tenantId} (log-only, DB disabled)`);
            return null;
        }

        const eventId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

        try {
            const query = `
                INSERT INTO billing_events 
                    (event_id, tenant_id, event_type, plan_id, amount_cents, currency, 
                     previous_state, new_state, source, external_ref, ip_address, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id, event_id, created_at
            `;

            const params = [
                eventId,
                eventData.tenantId,
                eventData.eventType,
                eventData.planId || null,
                eventData.amountCents || 0,
                eventData.currency || 'BRL',
                JSON.stringify(eventData.previousState || null),
                JSON.stringify(eventData.newState || null),
                eventData.source || 'system',
                eventData.externalRef || null,
                eventData.ipAddress || null,
                JSON.stringify(eventData.metadata || {})
            ];

            const result = await this.db.query(query, params);

            console.log(`📒 [AUDIT] ${eventData.eventType} | tenant=${eventData.tenantId} | id=${eventId}`);

            return result.rows[0];
        } catch (error) {
            // Fail-open: auditar é importante mas não deve travar o sistema
            console.error(`❌ [AUDIT LEDGER] Erro ao registrar evento:`, error.message);
            console.log(`📒 [AUDIT FALLBACK] ${eventData.eventType} | tenant=${eventData.tenantId} | data=${JSON.stringify(eventData)}`);
            return null;
        }
    }

    /**
     * Consultar histórico de eventos de um tenant
     */
    async getTenantHistory(tenantId, options = {}) {
        if (!this.enabled) return [];

        try {
            const { startDate, endDate, eventType, limit = 100, offset = 0 } = options;

            let query = `SELECT * FROM billing_events WHERE tenant_id = $1`;
            const params = [tenantId];
            let paramIdx = 2;

            if (eventType) {
                query += ` AND event_type = $${paramIdx++}`;
                params.push(eventType);
            }
            if (startDate) {
                query += ` AND created_at >= $${paramIdx++}`;
                params.push(startDate);
            }
            if (endDate) {
                query += ` AND created_at <= $${paramIdx++}`;
                params.push(endDate);
            }

            query += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
            params.push(limit, offset);

            const result = await this.db.query(query, params);
            return result.rows;
        } catch (error) {
            console.error('❌ [AUDIT LEDGER] Erro ao consultar histórico:', error.message);
            return [];
        }
    }

    /**
     * Calcular métricas financeiras
     */
    async getFinancialMetrics(options = {}) {
        if (!this.enabled) return null;

        try {
            const { startDate, endDate } = options;

            let dateFilter = '';
            const params = [];
            let paramIdx = 1;

            if (startDate) {
                dateFilter += ` AND created_at >= $${paramIdx++}`;
                params.push(startDate);
            }
            if (endDate) {
                dateFilter += ` AND created_at <= $${paramIdx++}`;
                params.push(endDate);
            }

            // Total de eventos por tipo
            const eventsQuery = `
                SELECT event_type, COUNT(*) as count, 
                       SUM(amount_cents) as total_cents
                FROM billing_events 
                WHERE 1=1 ${dateFilter}
                GROUP BY event_type
                ORDER BY count DESC
            `;

            // MRR (baseado em assinaturas ativas)
            const mrrQuery = `
                SELECT COUNT(*) as active_subscriptions,
                       SUM(CASE 
                           WHEN event_type = 'payment_succeeded' THEN amount_cents 
                           ELSE 0 
                       END) as total_revenue_cents
                FROM billing_events
                WHERE event_type IN ('payment_succeeded', 'subscription_created')
                ${dateFilter}
            `;

            const [eventsResult, mrrResult] = await Promise.all([
                this.db.query(eventsQuery, params),
                this.db.query(mrrQuery, params)
            ]);

            return {
                eventBreakdown: eventsResult.rows,
                revenue: mrrResult.rows[0],
                period: { startDate, endDate }
            };
        } catch (error) {
            console.error('❌ [AUDIT LEDGER] Erro ao calcular métricas:', error.message);
            return null;
        }
    }

    /**
     * Listar eventos recentes (para admin dashboard)
     */
    async getRecentEvents(limit = 50) {
        if (!this.enabled) return [];

        try {
            const query = `
                SELECT * FROM billing_events 
                ORDER BY created_at DESC 
                LIMIT $1
            `;
            const result = await this.db.query(query, [limit]);
            return result.rows;
        } catch (error) {
            console.error('❌ [AUDIT LEDGER] Erro ao listar eventos recentes:', error.message);
            return [];
        }
    }
}

// Singleton — inicializado sob demanda
let _instance = null;

function getAuditLedger() {
    if (!_instance) {
        try {
            const { db, USE_POSTGRES } = require('./database');
            _instance = new BillingAuditLedger(db, USE_POSTGRES);
        } catch (e) {
            console.error('⚠️ [AUDIT LEDGER] Falha ao inicializar:', e.message);
            _instance = new BillingAuditLedger(null, false);
        }
    }
    return _instance;
}

module.exports = { BillingAuditLedger, getAuditLedger };
