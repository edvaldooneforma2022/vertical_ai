/**
 * 📊 BILLING METRICS - Link Mágico V8.0
 * Métricas de negócio e operacionais do sistema de billing.
 * 
 * MRR, churn, LTV, uso por plano, faturamento diário, etc.
 * Fonte de verdade: tabela 'tenants' (planos reais).
 * Fallback: billing_subscriptions (legado).
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
     * V8.0: Consulta tabela 'tenants' (fonte da verdade) com fallback para billing_subscriptions
     */
    async _getSubscriptionStats() {
        // Preços reais dos planos (sincronizado com billing.js)
        const PLAN_PRICES_CENTS = { free: 0, starter: 2900, pro: 6900, business: 9700 };

        // 1. Tentar tabela 'tenants' (fonte da verdade)
        try {
            const result = await this.db.query(`
                SELECT 
                    COALESCE(plan, 'free') as plan_id,
                    status,
                    COUNT(*) as count
                FROM tenants
                GROUP BY plan, status
                ORDER BY plan
            `);

            if (result.rows && result.rows.length > 0) {
                const total = result.rows.reduce((sum, r) => sum + parseInt(r.count), 0);
                const active = result.rows
                    .filter(r => r.status === 'active' || !r.status)
                    .reduce((sum, r) => sum + parseInt(r.count), 0);
                const totalAmountCents = result.rows
                    .filter(r => r.status === 'active' || !r.status)
                    .reduce((sum, r) => {
                        const planId = (r.plan_id || 'free').toLowerCase();
                        const priceCents = PLAN_PRICES_CENTS[planId] || 0;
                        return sum + (parseInt(r.count) * priceCents);
                    }, 0);

                console.log(`📊 [BILLING METRICS] Stats carregadas da tabela 'tenants': ${total} tenants, ${active} ativos, MRR R$ ${(totalAmountCents / 100).toFixed(2)}`);
                return { total, active, totalAmountCents, byPlan: result.rows, source: 'tenants' };
            }
        } catch (e) {
            console.warn('⚠️ [BILLING METRICS] Fallback para billing_subscriptions:', e.message);
        }

        // 2. Fallback: billing_subscriptions (legado)
        try {
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

            return { total, active, totalAmountCents, byPlan: result.rows, source: 'billing_subscriptions' };
        } catch (e2) {
            console.error('❌ [BILLING METRICS] Ambas as tabelas falharam:', e2.message);
            return { total: 0, active: 0, totalAmountCents: 0, byPlan: [], source: 'error' };
        }
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
     * V8.0: Consulta tabela 'tenants' (fonte da verdade) com fallback para billing_subscriptions
     */
    async getUsageSummary() {
        if (!this.enabled) return { byPlan: [], byTenant: [] };

        try {
            const currentPeriod = new Date().toISOString().substring(0, 7); // YYYY-MM

            // 1. Tentar com tabela 'tenants' (fonte da verdade)
            try {
                const planResult = await this.db.query(`
                    SELECT 
                        COALESCE(t.plan, 'free') as plan,
                        COUNT(DISTINCT t.id) as tenants,
                        COALESCE(SUM(bu.messages), 0) as messages,
                        COALESCE(SUM(bu.extractions), 0) as extractions,
                        COALESCE(SUM(bu.api_calls), 0) as api_calls
                    FROM tenants t
                    LEFT JOIN api_keys ak ON t.id = ak.tenant_id AND ak.active = true
                    LEFT JOIN billing_usage bu ON ak.key_value = bu.tenant_id AND bu.period = $1
                    WHERE t.status = 'active' OR t.status IS NULL
                    GROUP BY t.plan
                    ORDER BY t.plan
                `, [currentPeriod]);

                const tenantResult = await this.db.query(`
                    SELECT 
                        t.id as "tenantId",
                        COALESCE(t.plan, 'free') as plan,
                        t.name,
                        t.email,
                        COALESCE(bu.messages, 0) as messages,
                        COALESCE(bu.extractions, 0) as extractions,
                        COALESCE(bu.api_calls, 0) as api_calls
                    FROM tenants t
                    LEFT JOIN api_keys ak ON t.id = ak.tenant_id AND ak.active = true
                    LEFT JOIN billing_usage bu ON ak.key_value = bu.tenant_id AND bu.period = $1
                    WHERE t.status = 'active' OR t.status IS NULL
                    ORDER BY messages DESC, t.id ASC
                    LIMIT 100
                `, [currentPeriod]);

                if (planResult.rows && planResult.rows.length > 0) {
                    console.log(`📊 [BILLING METRICS] Usage carregado da tabela 'tenants': ${planResult.rows.length} planos`);
                    return { byPlan: planResult.rows, byTenant: tenantResult.rows, source: 'tenants' };
                }
            } catch (tenantErr) {
                console.warn('⚠️ [BILLING METRICS] Fallback usage para billing_subscriptions:', tenantErr.message);
            }

            // 2. Fallback: billing_subscriptions (legado)
            const planResult = await this.db.query(`
                SELECT 
                    bs.plan_id as plan,
                    COUNT(DISTINCT bs.tenant_id) as tenants,
                    COALESCE(SUM(bu.messages), 0) as messages,
                    COALESCE(SUM(bu.extractions), 0) as extractions,
                    COALESCE(SUM(bu.api_calls), 0) as api_calls
                FROM billing_subscriptions bs
                LEFT JOIN billing_usage bu ON bs.tenant_id = bu.tenant_id AND bu.period = $1
                GROUP BY bs.plan_id
                ORDER BY bs.plan_id
            `, [currentPeriod]);

            const tenantResult = await this.db.query(`
                SELECT 
                    bs.tenant_id as "tenantId",
                    bs.plan_id as plan,
                    COALESCE(bu.messages, 0) as messages,
                    COALESCE(bu.extractions, 0) as extractions,
                    COALESCE(bu.api_calls, 0) as api_calls
                FROM billing_subscriptions bs
                LEFT JOIN billing_usage bu ON bs.tenant_id = bu.tenant_id AND bu.period = $1
                ORDER BY messages DESC, bs.tenant_id ASC
                LIMIT 100
            `, [currentPeriod]);

            return { byPlan: planResult.rows, byTenant: tenantResult.rows, source: 'billing_subscriptions' };
        } catch (error) {
            console.error('❌ [BILLING METRICS] Erro ao calcular uso:', error.message);
            return { byPlan: [], byTenant: [] };
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
