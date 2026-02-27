/**
 * 📊 BILLING METRICS - Link Mágico
 * Métricas de negócio e operacionais do sistema de billing.
 * 
 * MRR, churn, LTV, uso por plano, faturamento diário, etc.
 * Usa as tabelas billing_events e billing_subscriptions.
 */

class BillingMetrics {
    constructor(db, usePostgres) {
        this.db = db;
        this.usePostgres = usePostgres;
        this.enabled = !!usePostgres;
    }

    /**
     * Visão geral financeira
     */
    async getOverview() {
        if (!this.enabled) return this._getEmptyOverview();

        try {
            const [subs, revenue, recentEvents] = await Promise.all([
                this._getSubscriptionStats(),
                this._getRevenueStats(),
                this._getRecentEventCounts()
            ]);

            return {
                subscriptions: subs,
                revenue,
                recentEvents,
                generatedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ [BILLING METRICS] Erro ao calcular overview:', error.message);
            return this._getEmptyOverview();
        }
    }

    /**
     * Stats de assinaturas (ativas, por plano)
     */
    async _getSubscriptionStats() {
        const result = await this.db.query(`
            SELECT 
                plan_id,
                status,
                COUNT(*) as count,
                SUM(COALESCE(amount_cents, 0)) as total_amount_cents
            FROM billing_subscriptions
            GROUP BY plan_id, status
            ORDER BY plan_id
        `);

        const total = result.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
        const active = result.rows
            .filter(r => r.status === 'active')
            .reduce((sum, r) => sum + parseInt(r.count), 0);
        const totalAmountCents = result.rows
            .filter(r => r.status === 'active')
            .reduce((sum, r) => sum + parseInt(r.total_amount_cents || 0), 0);

        return {
            total,
            active,
            totalAmountCents,
            byPlan: result.rows
        };
    }

    /**
     * Stats de faturamento
     */
    async _getRevenueStats() {
        const result = await this.db.query(`
            SELECT 
                SUM(amount_cents) as total_cents,
                COUNT(*) as payment_count,
                AVG(amount_cents) as avg_cents
            FROM billing_events
            WHERE (event_type = 'payment_succeeded' OR event_type = 'subscription_created')
            AND created_at >= CURRENT_DATE - INTERVAL '30 days'
        `);

        const row = result.rows[0] || {};
        return {
            last30Days: {
                totalCents: parseInt(row.total_cents || 0),
                totalBRL: (parseInt(row.total_cents || 0) / 100).toFixed(2),
                paymentCount: parseInt(row.payment_count || 0),
                avgCents: Math.round(parseFloat(row.avg_cents || 0))
            }
        };
    }

    /**
     * Contagem de eventos recentes (últimas 24h)
     */
    async _getRecentEventCounts() {
        const result = await this.db.query(`
            SELECT 
                event_type,
                COUNT(*) as count
            FROM billing_events
            WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
            GROUP BY event_type
            ORDER BY count DESC
        `);

        return result.rows;
    }

    /**
     * Uso agregado por plano
     */
    async getUsageSummary() {
        if (!this.enabled) return [];

        try {
            const currentPeriod = new Date().toISOString().substring(0, 7); // YYYY-MM

            const result = await this.db.query(`
                SELECT 
                    bs.plan_id,
                    COUNT(DISTINCT bu.tenant_id) as tenant_count,
                    SUM(bu.messages) as total_messages,
                    SUM(bu.extractions) as total_extractions,
                    SUM(bu.api_calls) as total_api_calls,
                    AVG(bu.messages) as avg_messages
                FROM billing_usage bu
                LEFT JOIN billing_subscriptions bs ON bu.tenant_id = bs.tenant_id
                WHERE bu.period = $1
                GROUP BY bs.plan_id
                ORDER BY bs.plan_id
            `, [currentPeriod]);

            return result.rows;
        } catch (error) {
            console.error('❌ [BILLING METRICS] Erro ao calcular uso:', error.message);
            return [];
        }
    }

    /**
     * Health check do sistema de billing
     */
    async getSystemHealth() {
        const health = {
            database: false,
            billingTables: false,
            rateLimiterTable: false,
            timestamp: new Date().toISOString()
        };

        if (!this.enabled) {
            return { ...health, status: 'degraded', reason: 'PostgreSQL não disponível' };
        }

        try {
            // Check database
            await this.db.query('SELECT 1');
            health.database = true;

            // Check billing tables
            const tables = await this.db.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name LIKE 'billing_%'
            `);
            health.billingTables = tables.rows.length >= 3;
            health.tableCount = tables.rows.length;
            health.tables = tables.rows.map(r => r.table_name);

            // Check rate limiter
            const rateTable = tables.rows.find(r => r.table_name === 'billing_rate_counters');
            health.rateLimiterTable = !!rateTable;

            health.status = health.database && health.billingTables ? 'healthy' : 'degraded';
        } catch (error) {
            health.status = 'unhealthy';
            health.error = error.message;
        }

        return health;
    }

    _getEmptyOverview() {
        return {
            subscriptions: { total: 0, active: 0, byPlan: [] },
            revenue: { last30Days: { totalCents: 0, totalBRL: '0.00', paymentCount: 0, avgCents: 0 } },
            recentEvents: [],
            generatedAt: new Date().toISOString(),
            note: 'PostgreSQL necessário para métricas completas'
        };
    }
}

// Singleton
let _instance = null;

function getBillingMetrics() {
    if (!_instance) {
        try {
            const { db, USE_POSTGRES } = require('./database');
            _instance = new BillingMetrics(db, USE_POSTGRES);
        } catch (e) {
            _instance = new BillingMetrics(null, false);
        }
    }
    return _instance;
}

module.exports = { BillingMetrics, getBillingMetrics };
