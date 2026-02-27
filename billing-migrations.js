/**
 * 🏗️ BILLING MIGRATIONS - Link Mágico
 * Script de migração para criar tabelas do sistema de billing blindado.
 * 
 * Este script é ADITIVO — cria tabelas novas sem alterar as existentes.
 * Pode ser executado múltiplas vezes com segurança (IF NOT EXISTS).
 * 
 * Uso: node billing-migrations.js
 * Ou: require('./billing-migrations').runMigrations()
 */

/**
 * Tabelas PostgreSQL para o sistema de billing blindado
 */
function getBillingMigrations() {
    return [
        // ===== 1. ASSINATURAS PERSISTENTES =====
        `CREATE TABLE IF NOT EXISTS billing_subscriptions (
            id VARCHAR(64) PRIMARY KEY,
            tenant_id VARCHAR(255) NOT NULL,
            plan_id VARCHAR(50) NOT NULL DEFAULT 'free',
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            payment_method VARCHAR(50),
            current_period_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            current_period_end TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
            cancel_at_period_end BOOLEAN DEFAULT false,
            external_id VARCHAR(255),
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            cancelled_at TIMESTAMP
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_sub_tenant 
            ON billing_subscriptions(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_billing_sub_status 
            ON billing_subscriptions(status)`,

        // ===== 1.1 ADICIONAR COLUNA amount_cents (se não existir) =====
        `DO $$ BEGIN
            ALTER TABLE billing_subscriptions ADD COLUMN amount_cents INTEGER DEFAULT 0;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$`,

        // ===== 2. TRACKING DE USO MENSAL PERSISTENTE =====
        `CREATE TABLE IF NOT EXISTS billing_usage (
            id SERIAL PRIMARY KEY,
            tenant_id VARCHAR(255) NOT NULL,
            period VARCHAR(7) NOT NULL,
            messages INTEGER DEFAULT 0,
            extractions INTEGER DEFAULT 0,
            api_calls INTEGER DEFAULT 0,
            webhook_calls INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(tenant_id, period)
        )`,
        `CREATE INDEX IF NOT EXISTS idx_billing_usage_tenant_period 
            ON billing_usage(tenant_id, period)`,

        // ===== 3. CONTADORES DE RATE LIMIT =====
        `CREATE TABLE IF NOT EXISTS billing_rate_counters (
            id SERIAL PRIMARY KEY,
            tenant_id VARCHAR(255) NOT NULL,
            window_key VARCHAR(80) NOT NULL,
            count INTEGER DEFAULT 0,
            expires_at TIMESTAMP NOT NULL,
            UNIQUE(tenant_id, window_key)
        )`,
        `CREATE INDEX IF NOT EXISTS idx_rate_counters_expires 
            ON billing_rate_counters(expires_at)`,
        `CREATE INDEX IF NOT EXISTS idx_rate_counters_tenant 
            ON billing_rate_counters(tenant_id, window_key)`,

        // ===== 4. LEDGER FINANCEIRO IMUTÁVEL (EVENT SOURCING) =====
        `CREATE TABLE IF NOT EXISTS billing_events (
            id SERIAL PRIMARY KEY,
            event_id VARCHAR(64) UNIQUE NOT NULL,
            tenant_id VARCHAR(255) NOT NULL,
            event_type VARCHAR(50) NOT NULL,
            plan_id VARCHAR(50),
            amount_cents INTEGER DEFAULT 0,
            currency VARCHAR(3) DEFAULT 'BRL',
            previous_state JSONB,
            new_state JSONB,
            source VARCHAR(50),
            external_ref VARCHAR(255),
            ip_address VARCHAR(45),
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE INDEX IF NOT EXISTS idx_billing_events_tenant 
            ON billing_events(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_billing_events_type 
            ON billing_events(event_type)`,
        `CREATE INDEX IF NOT EXISTS idx_billing_events_created 
            ON billing_events(created_at)`,

        // ===== 5. API KEYS AVANÇADAS =====
        `CREATE TABLE IF NOT EXISTS api_keys_v2 (
            id SERIAL PRIMARY KEY,
            key_hash VARCHAR(128) NOT NULL,
            key_prefix VARCHAR(12) NOT NULL,
            tenant_id VARCHAR(255) NOT NULL,
            name VARCHAR(255),
            scopes JSONB DEFAULT '["*"]',
            allowed_ips JSONB DEFAULT '[]',
            allowed_domains JSONB DEFAULT '[]',
            status VARCHAR(20) DEFAULT 'active',
            expires_at TIMESTAMP,
            last_used_at TIMESTAMP,
            usage_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            revoked_at TIMESTAMP
        )`,
        `CREATE INDEX IF NOT EXISTS idx_api_keys_v2_tenant 
            ON api_keys_v2(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_api_keys_v2_prefix 
            ON api_keys_v2(key_prefix)`,
        `CREATE INDEX IF NOT EXISTS idx_api_keys_v2_status 
            ON api_keys_v2(status)`,

        // ===== 6. QUARENTENA DE TENANTS (ANTI-FRAUDE) =====
        `CREATE TABLE IF NOT EXISTS tenant_quarantine (
            id SERIAL PRIMARY KEY,
            tenant_id VARCHAR(255) NOT NULL,
            reason VARCHAR(255) NOT NULL,
            evidence JSONB DEFAULT '{}',
            status VARCHAR(20) DEFAULT 'quarantined',
            quarantined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reviewed_at TIMESTAMP,
            reviewed_by VARCHAR(255)
        )`,
        `CREATE INDEX IF NOT EXISTS idx_quarantine_tenant 
            ON tenant_quarantine(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_quarantine_status 
            ON tenant_quarantine(status)`
    ];
}

/**
 * Executar todas as migrations
 * @param {object} db - Instância do banco de dados
 * @param {boolean} isPostgres - Se está usando PostgreSQL
 */
async function runMigrations(db, isPostgres) {
    // Se chamado sem argumentos, tentar importar do database.js
    if (!db) {
        try {
            const database = require('./database');
            db = database.db;
            isPostgres = database.USE_POSTGRES;
        } catch (e) {
            console.error('❌ [BILLING MIGRATIONS] Não foi possível carregar database.js:', e.message);
            return { success: false, error: e.message };
        }
    }

    if (!isPostgres) {
        console.log('⚠️ [BILLING MIGRATIONS] Pulando — requer PostgreSQL (ambiente atual: SQLite).');
        return { success: true, skipped: true, count: 0 };
    }

    console.log('🏗️ [BILLING MIGRATIONS] Iniciando migrações do sistema de billing...');

    const migrations = getBillingMigrations();
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < migrations.length; i++) {
        try {
            await db.query(migrations[i]);
            successCount++;
        } catch (error) {
            // Ignorar erros de "already exists" — é esperado em re-runs
            if (error.message && error.message.includes('already exists')) {
                successCount++;
            } else {
                console.error(`❌ [BILLING MIGRATIONS] Erro na migração ${i + 1}:`, error.message);
                errorCount++;
            }
        }
    }

    console.log(`✅ [BILLING MIGRATIONS] Concluído: ${successCount} OK, ${errorCount} erros de ${migrations.length} total.`);

    return {
        success: errorCount === 0,
        skipped: false,
        count: successCount,
        errors: errorCount,
        total: migrations.length
    };
}

// Se executado diretamente: rodar migrations e sair
if (require.main === module) {
    runMigrations()
        .then(result => {
            console.log('📊 Resultado:', JSON.stringify(result, null, 2));
            process.exit(result.success ? 0 : 1);
        })
        .catch(err => {
            console.error('❌ Falha fatal:', err);
            process.exit(1);
        });
}

module.exports = { runMigrations, getBillingMigrations };
