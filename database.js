/**
 * 🗄️ SISTEMA DE BANCO DE DADOS - Link Mágico
 * Suporta PostgreSQL (produção) e SQLite (desenvolvimento)
 *
 * Funcionalidades:
 * - Armazenamento persistente de chatbots
 * - Histórico de conversas (30 dias)
 * - Métricas e analytics
 * - Cache de dados extraídos
 */

const fs = require('fs');
const path = require('path');

// Detectar ambiente e escolher banco apropriado
const USE_POSTGRES = process.env.DATABASE_URL || process.env.USE_POSTGRES === 'true';

let encMgr = null;
try {
    const { encryptionManager } = require('./lib/encryption');
    encMgr = encryptionManager;
} catch (e) {
    // encryptionManager opcional/fallback
}

// ════════════════════════════════════════════════════════════════
// FASE 2B: ESTADO DE PRONTIDÃO DA INFRAESTRUTURA DE AGENDAMENTO (FAIL-CLOSED)
// ════════════════════════════════════════════════════════════════
let _schedulingInfrastructureReady = !USE_POSTGRES; // SQLite default true; PostgreSQL requer validação das migrations
let _schedulingInfrastructureError = null;

function isSchedulingInfrastructureReady() {
    return _schedulingInfrastructureReady;
}

function getSchedulingInfrastructureError() {
    return _schedulingInfrastructureError;
}

function setSchedulingInfrastructureReady(isReady, error = null) {
    _schedulingInfrastructureReady = isReady;
    _schedulingInfrastructureError = error;
}

let db;

if (USE_POSTGRES) {
    // PostgreSQL para produção
    const { Pool } = require('pg');

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? {
            rejectUnauthorized: false
        } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });

    // 🛡️ R2: Capturar erros de clientes ociosos no pool
    // Sem este handler, um erro em conexão idle vira uncaughtException e mata o processo
    // REVERSÍVEL: remover este bloco restaura o comportamento anterior
    pool.on('error', (err, client) => {
        // Não imprimir connectionString, credenciais ou dados de clientes
        console.error(JSON.stringify({
            level: 'error',
            event: 'pg_pool_idle_error',
            error: String(err && err.message || err),
            code: String(err && err.code || ''),
            timestamp: new Date().toISOString()
        }));
    });

    db = {
        query: (text, params) => pool.query(text, params),
        pool: pool
    };

    console.log('✅ PostgreSQL conectado');
} else {
    // SQLite para desenvolvimento
    const Database = require('better-sqlite3');
    const dbPath = path.join(__dirname, 'data', 'linkmagico.db');

    // Garantir que o diretório existe
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');

    db = {
        query: (text, params) => {
            try {
                // Converter sintaxe PostgreSQL para SQLite
                const sqliteQuery = text
                    .replace(/\$(\d+)/g, '?')
                    .replace(/RETURNING \*/g, '');

                const textLower = text.toLowerCase().trimStart();
                const isReadQuery = textLower.includes('select') || textLower.startsWith('pragma');

                if (isReadQuery) {
                    return { rows: sqlite.prepare(sqliteQuery).all(params || []) };
                } else {
                    const info = sqlite.prepare(sqliteQuery).run(params || []);
                    return { rows: [{ id: info.lastInsertRowid }], changes: info.changes };
                }
            } catch (error) {
                // Suprimir erros esperados de coluna duplicada (já tratados pelos callers)
                const msg = error.message || '';
                if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
                    console.error('❌ Erro no SQLite:', error);
                }
                throw error;
            }
        },
        sqlite: sqlite
    };

    console.log('✅ SQLite conectado:', dbPath);
}

/**
 * 🏗️ Criar tabelas do banco de dados
 */
async function initializeDatabase() {
    console.log('🏗️ Inicializando estrutura do banco de dados...');

    const tables = USE_POSTGRES ? getPostgresTables() : getSQLiteTables();

    for (const table of tables) {
        try {
            await db.query(table);
            console.log('✅ Tabela criada/verificada');
        } catch (error) {
            console.error('❌ Erro ao criar tabela:', error.message);
        }
    }

    console.log('✅ Banco de dados inicializado com sucesso!');

    // 🔄 Migrations seguras — adicionar colunas novas a tabelas existentes
    const migrations = [
        // Stripe Billing — colunas para integração
        `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT DEFAULT ''`,
        `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT DEFAULT ''`,
        `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at ${USE_POSTGRES ? 'TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP' : 'DATETIME'}`,
        // CRM V7.1 — estimated_value em crm_leads
        `ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS estimated_value ${USE_POSTGRES ? 'NUMERIC(12,2)' : 'REAL'} DEFAULT 0`,
        // CRM V7.1 — sent_at e response_detected em followup_logs
        `ALTER TABLE followup_logs ADD COLUMN IF NOT EXISTS sent_at ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'}`,
        `ALTER TABLE followup_logs ADD COLUMN IF NOT EXISTS response_detected ${USE_POSTGRES ? 'BOOLEAN DEFAULT false' : 'INTEGER DEFAULT 0'}`,
        // CRM V7.2 — crm_automation_rules table
        `CREATE TABLE IF NOT EXISTS crm_automation_rules (
            id ${USE_POSTGRES ? 'VARCHAR(255)' : 'TEXT'} PRIMARY KEY,
            tenant_id ${USE_POSTGRES ? 'VARCHAR(255)' : 'TEXT'} NOT NULL,
            name ${USE_POSTGRES ? 'VARCHAR(255)' : 'TEXT'} NOT NULL,
            trigger_type ${USE_POSTGRES ? 'VARCHAR(50)' : 'TEXT'} NOT NULL DEFAULT 'stage_change',
            condition_field ${USE_POSTGRES ? 'VARCHAR(50)' : 'TEXT'},
            condition_operator ${USE_POSTGRES ? 'VARCHAR(20)' : 'TEXT'} DEFAULT 'equals',
            condition_value ${USE_POSTGRES ? 'TEXT' : 'TEXT'},
            action_type ${USE_POSTGRES ? 'VARCHAR(50)' : 'TEXT'} NOT NULL DEFAULT 'move_stage',
            action_target ${USE_POSTGRES ? 'TEXT' : 'TEXT'},
            action_config ${USE_POSTGRES ? 'JSONB DEFAULT \'{}\'' : 'TEXT DEFAULT \'{}\''},
            active ${USE_POSTGRES ? 'BOOLEAN DEFAULT true' : 'INTEGER DEFAULT 1'},
            created_at ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'} DEFAULT CURRENT_TIMESTAMP
        )`,
        // CRM V7.2 — crm_webhooks table
        `CREATE TABLE IF NOT EXISTS crm_webhooks (
            id ${USE_POSTGRES ? 'VARCHAR(255)' : 'TEXT'} PRIMARY KEY,
            tenant_id ${USE_POSTGRES ? 'VARCHAR(255)' : 'TEXT'} NOT NULL,
            event_type ${USE_POSTGRES ? 'VARCHAR(50)' : 'TEXT'} NOT NULL DEFAULT 'stage_change',
            url ${USE_POSTGRES ? 'TEXT' : 'TEXT'} NOT NULL,
            headers ${USE_POSTGRES ? 'JSONB DEFAULT \'{}\'' : 'TEXT DEFAULT \'{}\''},
            active ${USE_POSTGRES ? 'BOOLEAN DEFAULT true' : 'INTEGER DEFAULT 1'},
            created_at ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'} DEFAULT CURRENT_TIMESTAMP
        )`,
        // OTIMIZAÇÃO V7.3 — Índices de Performance
        `CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant ON crm_leads(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant_email ON crm_leads(tenant_id, email)`,
        `CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant_stage_updated ON crm_leads(tenant_id, stage_id, updated_at DESC)`,
        `CREATE INDEX IF NOT EXISTS idx_crm_stages_pipeline ON crm_stages(pipeline_id)`,
        `CREATE INDEX IF NOT EXISTS idx_crm_activities_lead ON crm_activities(lead_id)`,
        `CREATE INDEX IF NOT EXISTS idx_crm_activities_tenant ON crm_activities(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_followup_rules_tenant ON followup_rules(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_followup_jobs_tenant ON followup_jobs(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_followup_jobs_status ON followup_jobs(status)`,
        `CREATE INDEX IF NOT EXISTS idx_crm_deals_tenant ON crm_deals(tenant_id)`,

        // ENTERPRISE SAAS MIGRATION - Stage 1
        `CREATE TABLE IF NOT EXISTS tenants (
            id ${USE_POSTGRES ? 'UUID PRIMARY KEY DEFAULT gen_random_uuid()' : 'TEXT PRIMARY KEY'},
            name TEXT,
            email TEXT,
            plan TEXT DEFAULT 'basic',
            status TEXT DEFAULT 'active',
            created_at ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'} DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS api_keys (
            id ${USE_POSTGRES ? 'UUID PRIMARY KEY DEFAULT gen_random_uuid()' : 'TEXT PRIMARY KEY'},
            tenant_id ${USE_POSTGRES ? 'UUID' : 'TEXT'} NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            key_value TEXT NOT NULL,
            key_hash TEXT NOT NULL,
            active ${USE_POSTGRES ? 'BOOLEAN DEFAULT true' : 'INTEGER DEFAULT 1'},
            created_at ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'} DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`,
        `CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id)`,

        // Adicionar tenant_uuid em todas as tabelas operacionais
        `ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS tenant_uuid ${USE_POSTGRES ? 'UUID' : 'TEXT'} REFERENCES tenants(id)`,
        `ALTER TABLE chatbots ADD COLUMN IF NOT EXISTS tenant_uuid ${USE_POSTGRES ? 'UUID' : 'TEXT'} REFERENCES tenants(id)`,
        `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS tenant_uuid ${USE_POSTGRES ? 'UUID' : 'TEXT'} REFERENCES tenants(id)`,
        `ALTER TABLE short_urls ADD COLUMN IF NOT EXISTS tenant_uuid ${USE_POSTGRES ? 'UUID' : 'TEXT'} REFERENCES tenants(id)`,
        `ALTER TABLE tenant_leads ADD COLUMN IF NOT EXISTS tenant_uuid ${USE_POSTGRES ? 'UUID' : 'TEXT'} REFERENCES tenants(id)`,
        `ALTER TABLE tenant_appointments ADD COLUMN IF NOT EXISTS tenant_uuid ${USE_POSTGRES ? 'UUID' : 'TEXT'} REFERENCES tenants(id)`,
        `ALTER TABLE crm_pipelines ADD COLUMN IF NOT EXISTS tenant_uuid ${USE_POSTGRES ? 'UUID' : 'TEXT'} REFERENCES tenants(id)`,
        `ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS tenant_uuid ${USE_POSTGRES ? 'UUID' : 'TEXT'} REFERENCES tenants(id)`,
        `ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS tenant_uuid ${USE_POSTGRES ? 'UUID' : 'TEXT'} REFERENCES tenants(id)`,
        `ALTER TABLE crm_deals ADD COLUMN IF NOT EXISTS tenant_uuid ${USE_POSTGRES ? 'UUID' : 'TEXT'} REFERENCES tenants(id)`,
        `ALTER TABLE followup_rules ADD COLUMN IF NOT EXISTS tenant_uuid ${USE_POSTGRES ? 'UUID' : 'TEXT'} REFERENCES tenants(id)`,
        `ALTER TABLE followup_jobs ADD COLUMN IF NOT EXISTS tenant_uuid ${USE_POSTGRES ? 'UUID' : 'TEXT'} REFERENCES tenants(id)`,
        `ALTER TABLE crm_automation_rules ADD COLUMN IF NOT EXISTS tenant_uuid ${USE_POSTGRES ? 'UUID' : 'TEXT'} REFERENCES tenants(id)`,
        `ALTER TABLE crm_webhooks ADD COLUMN IF NOT EXISTS tenant_uuid ${USE_POSTGRES ? 'UUID' : 'TEXT'} REFERENCES tenants(id)`,
        `ALTER TABLE chatgpt_settings ADD COLUMN IF NOT EXISTS tenant_uuid ${USE_POSTGRES ? 'UUID' : 'TEXT'} REFERENCES tenants(id)`,
        `ALTER TABLE conversation_memory ADD COLUMN IF NOT EXISTS tenant_uuid ${USE_POSTGRES ? 'UUID' : 'TEXT'} REFERENCES tenants(id)`,
        `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS tenant_uuid ${USE_POSTGRES ? 'UUID' : 'TEXT'} REFERENCES tenants(id)`,

        // SAFE PATCH - BUG-FAQ-003: Tabela para persistir Knowledge Base no PostgreSQL
        // Substitui o armazenamento em arquivos JSON (que eram perdidos a cada deploy)
        `CREATE TABLE IF NOT EXISTS tenant_knowledge (
            api_key ${USE_POSTGRES ? 'VARCHAR(255)' : 'TEXT'} PRIMARY KEY,
            data ${USE_POSTGRES ? 'JSONB' : 'TEXT'} NOT NULL DEFAULT '${USE_POSTGRES ? '{}' : '{}'}',
            updated_at ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'} DEFAULT CURRENT_TIMESTAMP
        )`,

        // SAFE PATCH - SCHED-001: Tabela de disponibilidade por tenant (calendário real)
        `CREATE TABLE IF NOT EXISTS tenant_availability (
            id ${USE_POSTGRES ? 'VARCHAR(255)' : 'TEXT'} PRIMARY KEY,
            tenant_id ${USE_POSTGRES ? 'VARCHAR(255)' : 'TEXT'} NOT NULL,
            day_of_week ${USE_POSTGRES ? 'INTEGER' : 'INTEGER'} NOT NULL,
            start_time ${USE_POSTGRES ? 'VARCHAR(5)' : 'TEXT'} NOT NULL,
            end_time ${USE_POSTGRES ? 'VARCHAR(5)' : 'TEXT'} NOT NULL,
            slot_duration_minutes ${USE_POSTGRES ? 'INTEGER' : 'INTEGER'} DEFAULT 60,
            active ${USE_POSTGRES ? 'BOOLEAN DEFAULT true' : 'INTEGER DEFAULT 1'},
            created_at ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'} DEFAULT CURRENT_TIMESTAMP,
            updated_at ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'} DEFAULT CURRENT_TIMESTAMP
        )`,

        // SAFE PATCH - SCHED-002: Tabela de datas bloqueadas por tenant
        `CREATE TABLE IF NOT EXISTS tenant_blocked_dates (
            id ${USE_POSTGRES ? 'VARCHAR(255)' : 'TEXT'} PRIMARY KEY,
            tenant_id ${USE_POSTGRES ? 'VARCHAR(255)' : 'TEXT'} NOT NULL,
            blocked_date ${USE_POSTGRES ? 'DATE' : 'TEXT'} NOT NULL,
            reason ${USE_POSTGRES ? 'TEXT' : 'TEXT'},
            created_at ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'} DEFAULT CURRENT_TIMESTAMP
        )`,

        // SAFE PATCH - SCHED-003: Índices para performance
        `CREATE INDEX IF NOT EXISTS idx_tenant_availability_tenant ON tenant_availability(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_tenant_blocked_dates_tenant ON tenant_blocked_dates(tenant_id)`,

        // ========================================
        // SAFE PATCH - AUTO-LEARNING V2.0: Persistência em banco de dados
        // Substitui armazenamento em JSON no filesystem (que era perdido a cada restart no Render)
        // Controlado por: FEATURE_LEARNING_DB_PERSISTENCE
        // ========================================

        // Tabela de interações de conversa para auto-learning (substitui conversations.json)
        `CREATE TABLE IF NOT EXISTS learning_conversations (
            id ${USE_POSTGRES ? 'VARCHAR(255)' : 'TEXT'} PRIMARY KEY,
            conversation_id ${USE_POSTGRES ? 'VARCHAR(255)' : 'TEXT'},
            user_message ${USE_POSTGRES ? 'TEXT' : 'TEXT'},
            ai_response ${USE_POSTGRES ? 'TEXT' : 'TEXT'},
            detected_intent ${USE_POSTGRES ? 'VARCHAR(100)' : 'TEXT'},
            journey_stage ${USE_POSTGRES ? 'VARCHAR(100)' : 'TEXT'},
            profile ${USE_POSTGRES ? 'VARCHAR(100)' : 'TEXT'},
            has_cta ${USE_POSTGRES ? 'BOOLEAN DEFAULT false' : 'INTEGER DEFAULT 0'},
            links ${USE_POSTGRES ? 'JSONB DEFAULT \'[]\'' : 'TEXT DEFAULT \'[]\''},
            emotional_state ${USE_POSTGRES ? 'VARCHAR(50)' : 'TEXT'},
            api_key ${USE_POSTGRES ? 'VARCHAR(255)' : 'TEXT'},
            robot_name ${USE_POSTGRES ? 'VARCHAR(255)' : 'TEXT'},
            action_clicked ${USE_POSTGRES ? 'BOOLEAN DEFAULT false' : 'INTEGER DEFAULT 0'},
            action_scheduled ${USE_POSTGRES ? 'BOOLEAN DEFAULT false' : 'INTEGER DEFAULT 0'},
            action_lead_captured ${USE_POSTGRES ? 'BOOLEAN DEFAULT false' : 'INTEGER DEFAULT 0'},
            action_whatsapp_opened ${USE_POSTGRES ? 'BOOLEAN DEFAULT false' : 'INTEGER DEFAULT 0'},
            created_at ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'} DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tabela de scores de performance por padrão (substitui scores.json)
        `CREATE TABLE IF NOT EXISTS learning_scores (
            pattern_key ${USE_POSTGRES ? 'VARCHAR(255)' : 'TEXT'} PRIMARY KEY,
            intent ${USE_POSTGRES ? 'VARCHAR(100)' : 'TEXT'},
            journey_stage ${USE_POSTGRES ? 'VARCHAR(100)' : 'TEXT'},
            has_cta ${USE_POSTGRES ? 'BOOLEAN DEFAULT false' : 'INTEGER DEFAULT 0'},
            success_rate ${USE_POSTGRES ? 'REAL' : 'REAL'} DEFAULT 0,
            attempts ${USE_POSTGRES ? 'INTEGER' : 'INTEGER'} DEFAULT 0,
            conversions ${USE_POSTGRES ? 'INTEGER' : 'INTEGER'} DEFAULT 0,
            breakdown ${USE_POSTGRES ? 'JSONB DEFAULT \'{}\'' : 'TEXT DEFAULT \'{}\''},
            top_responses ${USE_POSTGRES ? 'JSONB DEFAULT \'[]\'' : 'TEXT DEFAULT \'[]\''},
            updated_at ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'} DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tabela de padrões aprendidos com LRU (substitui patterns.json)
        `CREATE TABLE IF NOT EXISTS learning_patterns (
            pattern_key ${USE_POSTGRES ? 'VARCHAR(255)' : 'TEXT'} PRIMARY KEY,
            intent ${USE_POSTGRES ? 'VARCHAR(100)' : 'TEXT'},
            profile ${USE_POSTGRES ? 'VARCHAR(100)' : 'TEXT'},
            journey_stage ${USE_POSTGRES ? 'VARCHAR(100)' : 'TEXT'},
            success_rate ${USE_POSTGRES ? 'REAL' : 'REAL'} DEFAULT 0,
            top_responses ${USE_POSTGRES ? 'JSONB DEFAULT \'[]\'' : 'TEXT DEFAULT \'[]\''},
            attempts ${USE_POSTGRES ? 'INTEGER' : 'INTEGER'} DEFAULT 0,
            conversions ${USE_POSTGRES ? 'INTEGER' : 'INTEGER'} DEFAULT 0,
            access_count ${USE_POSTGRES ? 'INTEGER' : 'INTEGER'} DEFAULT 0,
            updated_at ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'} DEFAULT CURRENT_TIMESTAMP
        )`,

        // Índices para performance do auto-learning
        `CREATE INDEX IF NOT EXISTS idx_learning_conv_conversation ON learning_conversations(conversation_id)`,
        `CREATE INDEX IF NOT EXISTS idx_learning_conv_api_key ON learning_conversations(api_key)`,
        `CREATE INDEX IF NOT EXISTS idx_learning_conv_created ON learning_conversations(created_at)`,
        `CREATE INDEX IF NOT EXISTS idx_learning_scores_intent ON learning_scores(intent)`,
        `CREATE INDEX IF NOT EXISTS idx_learning_patterns_intent ON learning_patterns(intent)`,

        // ========================================
        // 🛠️ AUTO-HEAL: Colunas que podem não existir em bancos antigos
        // Corrige: "column X of relation tenant_leads does not exist"
        // ========================================
        `ALTER TABLE tenant_leads ADD COLUMN IF NOT EXISTS message ${USE_POSTGRES ? 'TEXT' : 'TEXT'}`,
        `ALTER TABLE tenant_leads ADD COLUMN IF NOT EXISTS url_origem ${USE_POSTGRES ? 'TEXT' : 'TEXT'}`,
        `ALTER TABLE tenant_leads ADD COLUMN IF NOT EXISTS source ${USE_POSTGRES ? 'TEXT' : 'TEXT'} DEFAULT 'widget'`,
        `ALTER TABLE tenant_leads ADD COLUMN IF NOT EXISTS status ${USE_POSTGRES ? 'TEXT' : 'TEXT'} DEFAULT 'novo'`,
        `ALTER TABLE tenant_leads ADD COLUMN IF NOT EXISTS metadata ${USE_POSTGRES ? 'JSONB DEFAULT \'{}\'': 'TEXT DEFAULT \'{}\''} `,
        `ALTER TABLE tenant_leads ADD COLUMN IF NOT EXISTS conversations ${USE_POSTGRES ? 'JSONB DEFAULT \'[]\'': 'TEXT DEFAULT \'[]\''} `,
        `ALTER TABLE tenant_leads ADD COLUMN IF NOT EXISTS updated_at ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'} DEFAULT CURRENT_TIMESTAMP`,

        // ═══════════════════════════════════════════════════════
        // WA-CHANNEL-001 — Canal WhatsApp Nativo
        // ═══════════════════════════════════════════════════════

        // Novas colunas em tenant_leads (identificação omnichannel)
        `ALTER TABLE tenant_leads ADD COLUMN IF NOT EXISTS wa_phone VARCHAR(50)`,
        `ALTER TABLE tenant_leads ADD COLUMN IF NOT EXISTS channel VARCHAR(20) DEFAULT 'widget'`,

        // Novas colunas em whatsapp_settings (canal bidirecional)
        `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS channel_enabled ${USE_POSTGRES ? 'BOOLEAN DEFAULT false' : 'INTEGER DEFAULT 0'}`,
        `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS channel_mode VARCHAR(20) DEFAULT 'auto'`,
        `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(255)`,

        // Tabela de mensagens WhatsApp (log completo bidirecional)
        `CREATE TABLE IF NOT EXISTS whatsapp_messages (
            id VARCHAR(255) PRIMARY KEY,
            tenant_id VARCHAR(255) NOT NULL,
            api_key VARCHAR(255) NOT NULL,
            wa_message_id VARCHAR(255),
            wa_phone VARCHAR(50) NOT NULL,
            direction VARCHAR(10) NOT NULL,
            message_type VARCHAR(20) DEFAULT 'text',
            content TEXT,
            media_url TEXT,
            lead_id VARCHAR(255),
            conversation_id VARCHAR(255),
            provider VARCHAR(20),
            status VARCHAR(20) DEFAULT 'delivered',
            metadata ${USE_POSTGRES ? "JSONB DEFAULT '{}'" : "TEXT DEFAULT '{}'"},
            attempts INTEGER DEFAULT 0,
            locked_until ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'},
            last_attempt_at ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'},
            error_message TEXT,
            outbound_sent ${USE_POSTGRES ? 'BOOLEAN DEFAULT false' : 'INTEGER DEFAULT 0'},
            created_at ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'} DEFAULT CURRENT_TIMESTAMP
        )`,

        // Índices para whatsapp_messages
        `CREATE INDEX IF NOT EXISTS idx_wa_msg_phone ON whatsapp_messages(wa_phone)`,
        `CREATE INDEX IF NOT EXISTS idx_wa_msg_tenant ON whatsapp_messages(api_key)`,
        `CREATE INDEX IF NOT EXISTS idx_wa_msg_lead ON whatsapp_messages(lead_id)`,
        `CREATE INDEX IF NOT EXISTS idx_wa_msg_conv ON whatsapp_messages(conversation_id)`,
        `CREATE INDEX IF NOT EXISTS idx_wa_msg_created ON whatsapp_messages(created_at)`,
        `CREATE INDEX IF NOT EXISTS idx_wa_msg_wa_id ON whatsapp_messages(wa_message_id)`,
        `CREATE INDEX IF NOT EXISTS idx_wa_msg_status_locked ON whatsapp_messages (status, locked_until)`,

        // Migrations de colunas para whatsapp_messages em bancos existentes
        `ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0`,
        `ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS locked_until ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'}`,
        `ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS last_attempt_at ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'}`,
        `ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS error_message TEXT`,
        `ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS outbound_sent ${USE_POSTGRES ? 'BOOLEAN DEFAULT false' : 'INTEGER DEFAULT 0'}`,

        // Índice para busca de lead por wa_phone
        `CREATE INDEX IF NOT EXISTS idx_tenant_leads_wa_phone ON tenant_leads(wa_phone)`,

        // ═══════════════════════════════════════════════════════
        // WA-SAAS-001 — Camada SaaS WhatsApp (Evolution Central)
        // Colunas adicionais em whatsapp_settings para modo SaaS
        // ═══════════════════════════════════════════════════════
        `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS saas_instance_name VARCHAR(50)`,
        `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS saas_phone VARCHAR(50)`,
        `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS saas_push_name VARCHAR(255)`,
        `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS connection_state VARCHAR(20) DEFAULT 'disconnected'`,
        `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS connected_at ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'}`,
        `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS last_seen ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'}`,

        // Índice para resolver instância SaaS no webhook global
        `CREATE INDEX IF NOT EXISTS idx_wa_saas_instance ON whatsapp_settings(saas_instance_name)`,

        // ═══════════════════════════════════════════════════════
        // META CLOUD API — WhatsApp Business Platform Oficial
        // ═══════════════════════════════════════════════════════
        `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS meta_phone_number_id VARCHAR(50)`,
        `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS meta_waba_id VARCHAR(50)`,
        `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS meta_access_token TEXT`,
        `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS meta_verify_token VARCHAR(255)`,
        `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS meta_app_secret VARCHAR(255)`,
        `CREATE INDEX IF NOT EXISTS idx_wa_meta_phone ON whatsapp_settings(meta_phone_number_id)`,
        `CREATE INDEX IF NOT EXISTS idx_wa_meta_waba ON whatsapp_settings(meta_waba_id)`,

        // ═══════════════════════════════════════════════════════
        // V9 BLINDADA — ÍNDICES DE PERFORMANCE ADICIONAIS
        // ═══════════════════════════════════════════════════════
        `CREATE INDEX IF NOT EXISTS idx_tenant_leads_created ON tenant_leads(created_at)`,
        `CREATE INDEX IF NOT EXISTS idx_tenant_leads_status ON tenant_leads(status)`,

        // ═══════════════════════════════════════════════════════
        // V11.3 — FALLBACK INVISÍVEL: Checkout links por tenant
        // ═══════════════════════════════════════════════════════
        `CREATE TABLE IF NOT EXISTS tenant_checkout_links (
            api_key ${USE_POSTGRES ? 'VARCHAR(255)' : 'TEXT'} PRIMARY KEY,
            checkout_url ${USE_POSTGRES ? 'TEXT' : 'TEXT'} NOT NULL,
            source ${USE_POSTGRES ? 'VARCHAR(50)' : 'TEXT'} DEFAULT 'auto_v112',
            confirmed ${USE_POSTGRES ? 'BOOLEAN DEFAULT false' : 'INTEGER DEFAULT 0'},
            created_at ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'} DEFAULT CURRENT_TIMESTAMP,
            updated_at ${USE_POSTGRES ? 'TIMESTAMP' : 'DATETIME'} DEFAULT CURRENT_TIMESTAMP
        )`,

        // ═══════════════════════════════════════════════════════
        // SELF-SERVICE SIGNUP V1.0 — Campos para login de tenants
        // ═══════════════════════════════════════════════════════
        `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS password_hash TEXT`,
        `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS signup_source TEXT DEFAULT 'hotmart'`,
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email)`,

    ];

    for (const migration of migrations) {
        try {
            if (!USE_POSTGRES) {
                // SQLite: não suporta ADD COLUMN IF NOT EXISTS
                // Verificar via PRAGMA antes de executar
                const alterMatch = migration.match(/ALTER TABLE (\w+) ADD COLUMN (?:IF NOT EXISTS )?(\w+)/i);
                if (alterMatch) {
                    const [, tableName, colName] = alterMatch;
                    try {
                        const cols = await db.query(`PRAGMA table_info(${tableName})`);
                        const colList = cols.rows || cols;
                        const exists = colList.some(c => c.name === colName);
                        if (exists) continue; // coluna já existe, pular
                    } catch (pragmaErr) {
                        // Tabela pode não existir ainda — pular silenciosamente
                        continue;
                    }
                    // Remover IF NOT EXISTS para SQLite
                    const sqliteQuery = migration.replace(/ADD COLUMN IF NOT EXISTS/i, 'ADD COLUMN').replace(/REFERENCES \w+\(\w+\)/i, '');
                    await db.query(sqliteQuery);
                    continue;
                }
            }
            await db.query(migration);
        } catch (err) {
            // Ignorar erros de coluna já existente (PostgreSQL)
            if (!err.message.includes('duplicate column') && !err.message.includes('already exists')) {
                console.warn('⚠️ Migration:', err.message);
            }
        }
    }

    // ═══════════════════════════════════════════════════════
    // FASE 2B — Migrations Críticas de Multi-tenant e Idempotência
    // Executadas com validação estrutural em catálogos e fail-closed
    // ═══════════════════════════════════════════════════════
    await runPhase2bMigrations(db, USE_POSTGRES);

    // ═══════════════════════════════════════════════════════
    // FASE 2C.3 — Migrations de Persistência Canônica Multi-Tenant (R-02 / R-01 / R-05)
    // ═══════════════════════════════════════════════════════
    await runPhase2c3Migrations(db, USE_POSTGRES);

    // 🛡️ BILLING BLINDADO — Inicializar tabelas de billing (subscriptions, usage, keys, etc)
    try {
        const { runMigrations } = require('./billing-migrations');
        await runMigrations(db, USE_POSTGRES);
        console.log('✅ Migrations de Billing concluídas');
    } catch (error) {
        console.log('⚠️ Falha ao rodar migrations de billing (não crítico):', error.message);
    }
}

/**
 * ═══════════════════════════════════════════════════════
 * FASE 2B — Migrations Críticas de Multi-tenant e Idempotência
 * Executadas com validação estrutural em catálogos e fail-closed
 * ═══════════════════════════════════════════════════════
 * @param {Object} [dbInstance=db] - Instância do banco de dados (Pool/db)
 * @param {boolean} [usePostgres=USE_POSTGRES] - Flag indicando se é ambiente PostgreSQL
 * @returns {Promise<{ success: boolean, error: string|null }>}
 */
async function runPhase2bMigrations(dbInstance = db, usePostgres = USE_POSTGRES) {
    const phase2bMigrations = [
        // Migration 2B-1A: tenant_id em wa_schedule_pending
        `ALTER TABLE wa_schedule_pending ADD COLUMN IF NOT EXISTS tenant_id ${usePostgres ? 'UUID' : 'TEXT'}`,

        // Migration 2B-1B: FK nomeada para tenants(id) com validação estrutural via catálogos
        ...(usePostgres ? [`DO $$
        DECLARE
            v_constraint RECORD;
            v_count INT;
        BEGIN
            -- 1. Validar constraint existente via catálogo pg_constraint
            SELECT
                c.conname,
                ns_local.nspname AS local_schema,
                tbl_local.relname AS local_table,
                att_local.attname AS local_col,
                ns_ref.nspname AS ref_schema,
                tbl_ref.relname AS ref_table,
                att_ref.attname AS ref_col,
                c.contype
            INTO v_constraint
            FROM pg_constraint c
            JOIN pg_class tbl_local ON tbl_local.oid = c.conrelid
            JOIN pg_namespace ns_local ON ns_local.oid = tbl_local.relnamespace
            JOIN pg_attribute att_local ON att_local.attrelid = tbl_local.oid AND att_local.attnum = c.conkey[1]
            JOIN pg_class tbl_ref ON tbl_ref.oid = c.confrelid
            JOIN pg_namespace ns_ref ON ns_ref.oid = tbl_ref.relnamespace
            JOIN pg_attribute att_ref ON att_ref.attrelid = tbl_ref.oid AND att_ref.attnum = c.confkey[1]
            WHERE c.conname = 'fk_wa_schedule_pending_tenant'
              AND ns_local.nspname = current_schema();

            IF FOUND THEN
                -- Validar se a estrutura existente é idêntica à esperada
                IF v_constraint.local_table != 'wa_schedule_pending' OR
                   v_constraint.local_col != 'tenant_id' OR
                   v_constraint.ref_table != 'tenants' OR
                   v_constraint.ref_col != 'id' OR
                   v_constraint.contype != 'f' THEN
                    RAISE EXCEPTION 'Constraint homônima incompatível: % na tabela % (%). Esperado: wa_schedule_pending(tenant_id) -> tenants(id)',
                        v_constraint.conname, v_constraint.local_table, v_constraint.local_col;
                END IF;
            ELSE
                -- Verificar se existe constraint homônima de outro tipo no schema
                SELECT COUNT(*) INTO v_count
                FROM pg_constraint c
                JOIN pg_namespace ns ON ns.oid = c.connamespace
                WHERE c.conname = 'fk_wa_schedule_pending_tenant'
                  AND ns.nspname = current_schema();

                IF v_count > 0 THEN
                    RAISE EXCEPTION 'Constraint homônima incompatível de outro tipo encontrada com nome fk_wa_schedule_pending_tenant';
                END IF;

                ALTER TABLE wa_schedule_pending
                ADD CONSTRAINT fk_wa_schedule_pending_tenant
                FOREIGN KEY (tenant_id) REFERENCES tenants(id);
            END IF;
        END $$;`] : []),

        // Migration 2B-1C: Índice composto para consultas de agendamento
        `CREATE INDEX IF NOT EXISTS idx_wa_sched_tenant_conv_state
         ON wa_schedule_pending (tenant_id, conversation_id, state, created_at DESC)`,

        // Migration 2B-2A: schedule_ref_id em tenant_appointments
        `ALTER TABLE tenant_appointments ADD COLUMN IF NOT EXISTS schedule_ref_id VARCHAR(255)`,

        // Migration 2B-2B: Detecção de duplicidades prévia + Índice único parcial com validação de catálogo
        ...(usePostgres ? [`DO $$
        DECLARE
            v_idx RECORD;
            v_count INT;
            v_dup_count INT;
            v_dup_ids TEXT;
        BEGIN
            -- 1. DETECÇÃO DE DUPLICIDADES ANTES DE CRIAR O ÍNDICE (Item 4)
            SELECT COUNT(*), string_agg(schedule_ref_id, ', ')
            INTO v_dup_count, v_dup_ids
            FROM (
                SELECT schedule_ref_id
                FROM tenant_appointments
                WHERE schedule_ref_id IS NOT NULL
                GROUP BY schedule_ref_id
                HAVING COUNT(*) > 1
                LIMIT 10
            ) d;

            IF v_dup_count > 0 THEN
                RAISE EXCEPTION 'Detecção de duplicidades em schedule_ref_id impediu criação de índice único. Encontradas ocorrências duplicadas nos IDs: %. Dados preservados integralmente.', v_dup_ids;
            END IF;

            -- 2. VALIDAÇÃO ESTRUTURAL DO ÍNDICE EXISTENTE VIA CATÁLOGO
            SELECT
                idx_cls.relname AS index_name,
                tbl_cls.relname AS table_name,
                ns.nspname AS schema_name,
                i.indisunique AS is_unique,
                att.attname AS col_name,
                pg_get_expr(i.indpred, i.indrelid) AS predicate
            INTO v_idx
            FROM pg_index i
            JOIN pg_class idx_cls ON idx_cls.oid = i.indexrelid
            JOIN pg_class tbl_cls ON tbl_cls.oid = i.indrelid
            JOIN pg_namespace ns ON ns.oid = idx_cls.relnamespace
            LEFT JOIN pg_attribute att ON att.attrelid = tbl_cls.oid AND att.attnum = i.indkey[0]
            WHERE idx_cls.relname = 'idx_appointments_idempotency'
              AND ns.nspname = current_schema();

            IF FOUND THEN
                IF v_idx.table_name != 'tenant_appointments' OR
                   v_idx.is_unique != true OR
                   v_idx.col_name != 'schedule_ref_id' OR
                   v_idx.predicate IS DISTINCT FROM '(schedule_ref_id IS NOT NULL)' THEN
                    RAISE EXCEPTION 'Índice homônimo incompatível encontrado: % na tabela % (unique: %, col: %, pred: %). Esperado: tenant_appointments(schedule_ref_id) UNIQUE WHERE schedule_ref_id IS NOT NULL',
                        v_idx.index_name, v_idx.table_name, v_idx.is_unique, v_idx.col_name, v_idx.predicate;
                END IF;
            ELSE
                SELECT COUNT(*) INTO v_count
                FROM pg_class c
                JOIN pg_namespace ns ON ns.oid = c.relnamespace
                WHERE c.relname = 'idx_appointments_idempotency'
                  AND ns.nspname = current_schema();

                IF v_count > 0 THEN
                    RAISE EXCEPTION 'Objeto homônimo incompatível encontrado com nome idx_appointments_idempotency';
                END IF;

                CREATE UNIQUE INDEX idx_appointments_idempotency
                ON tenant_appointments (schedule_ref_id)
                WHERE schedule_ref_id IS NOT NULL;
            END IF;
        END $$;`] : []),

        // Migration 2B-3: Backfill tenant_uuid em tenant_appointments
        // api_keys.tenant_id é UUID (FK para tenants.id UUID).
        // tenant_appointments.tenant_uuid é UUID. Atribuição direta segura.
        ...(usePostgres ? [`UPDATE tenant_appointments ta
         SET tenant_uuid = ak.tenant_id
         FROM api_keys ak
         WHERE ta.api_key = ak.key_value
           AND ta.tenant_uuid IS NULL
           AND ak.tenant_id IS NOT NULL`] : [])
    ];

    let phase2bSuccess = true;
    for (const migration of phase2bMigrations) {
        try {
            if (!usePostgres) {
                const alterMatch = migration.match(/ALTER TABLE (\w+) ADD COLUMN (?:IF NOT EXISTS )?(\w+)/i);
                if (alterMatch) {
                    const [, tableName, colName] = alterMatch;
                    try {
                        const cols = await dbInstance.query(`PRAGMA table_info(${tableName})`);
                        const colList = cols.rows || cols;
                        const exists = colList.some(c => c.name === colName);
                        if (exists) continue;
                    } catch (pragmaErr) {
                        continue;
                    }
                    const sqliteQuery = migration.replace(/ADD COLUMN IF NOT EXISTS/i, 'ADD COLUMN').replace(/REFERENCES \w+\(\w+\)/i, '');
                    await dbInstance.query(sqliteQuery);
                    continue;
                }
            }
            await dbInstance.query(migration);
        } catch (err) {
            phase2bSuccess = false;
            _schedulingInfrastructureReady = false;
            _schedulingInfrastructureError = err.message;
            console.error('❌ [FASE 2B][FAIL-CLOSED] Falha crítica nas migrations de agendamento:', err.message);
            break; // Interromper migrations críticas restantes
        }
    }

    if (phase2bSuccess) {
        _schedulingInfrastructureReady = true;
        _schedulingInfrastructureError = null;
        console.log('✅ [FASE 2B] Estruturas de agendamento multi-tenant e idempotência validadas com sucesso.');
    }

    return {
        success: phase2bSuccess,
        error: _schedulingInfrastructureError
    };
}

// 🛡️ [FASE 2C.3] Validador canônico de UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(val) {
    return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

/**
 * 🔍 Verificação prévia de duplicidades históricas em whatsapp_messages
 * para garantir que o índice único parcial 'uq_wa_msg_tenant_provider_wamid'
 * possa ser criado com segurança sem falhar nem violar dados existentes.
 *
 * @param {Object} [dbInstance=db] - Instância do banco
 * @param {boolean} [usePostgres=USE_POSTGRES] - Flag PostgreSQL
 * @returns {Promise<{ hasDuplicates: boolean, count: number, groupsCount: number, duplicates: Array, error?: string }>}
 */
async function checkHistoricalDuplicatesForUniqueIndex(dbInstance = db, usePostgres = USE_POSTGRES) {
    try {
        let tableExists = false;
        if (usePostgres) {
            const check = await dbInstance.query(
                "SELECT to_regclass('public.whatsapp_messages') AS exists_table"
            );
            tableExists = !!(check && check.rows && check.rows[0] && check.rows[0].exists_table);
        } else {
            const check = await dbInstance.query(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='whatsapp_messages'"
            );
            const rows = check?.rows || check;
            tableExists = Array.isArray(rows) && rows.length > 0;
        }

        if (!tableExists) {
            return { hasDuplicates: false, count: 0, groupsCount: 0, duplicates: [] };
        }

        if (!usePostgres) {
            const pragma = await dbInstance.query("PRAGMA table_info(whatsapp_messages)");
            const cols = (pragma?.rows || pragma || []).map(c => c.name);
            if (!cols.includes('tenant_uuid') || !cols.includes('provider') || !cols.includes('wa_message_id')) {
                return { hasDuplicates: false, count: 0, groupsCount: 0, duplicates: [] };
            }
        }

        const query = `
            SELECT tenant_uuid, provider, wa_message_id, COUNT(*) AS count
            FROM whatsapp_messages
            WHERE wa_message_id IS NOT NULL
            GROUP BY tenant_uuid, provider, wa_message_id
            HAVING COUNT(*) > 1
        `;

        const result = await dbInstance.query(query);
        const rows = result?.rows || result || [];

        if (Array.isArray(rows) && rows.length > 0) {
            const duplicates = rows.map(r => ({
                tenant_uuid: r.tenant_uuid,
                provider: r.provider,
                wa_message_id: r.wa_message_id,
                count: parseInt(r.count, 10)
            }));
            const totalCount = duplicates.reduce((acc, d) => acc + d.count, 0);
            return {
                hasDuplicates: true,
                count: totalCount,
                groupsCount: duplicates.length,
                duplicates
            };
        }

        return { hasDuplicates: false, count: 0, groupsCount: 0, duplicates: [] };
    } catch (err) {
        if (err.message && (err.message.includes('does not exist') || err.message.includes('não existe') || err.message.includes('column'))) {
            return { hasDuplicates: false, count: 0, groupsCount: 0, duplicates: [] };
        }
        return { hasDuplicates: false, count: 0, groupsCount: 0, duplicates: [], error: err.message };
    }
}

/**
 * ═══════════════════════════════════════════════════════
 * FASE 2C.3 — MIGRATIONS DE PERSISTÊNCIA MULTI-TENANT CANÔNICA (R-02 / R-01 / R-05)
 * ═══════════════════════════════════════════════════════
 * Executa migrações estruturais e idempotentes para:
 * 1. whatsapp_messages.tenant_uuid UUID + colunas de fila durável + FK para tenants(id) + índice
 * 2. tenant_leads.tenant_uuid índice idx_tenant_leads_tenant_uuid
 * 3. learning_conversations.tenant_uuid UUID + índice idx_learning_conv_tenant_uuid
 * 4. Validação prévia de duplicidades históricas antes do índice único parcial
 * 5. Backfill conservador para registros legados associados a chaves V1 ativas
 *
 * @param {Object} [dbInstance=db] - Instância de conexão do banco
 * @param {boolean} [usePostgres=USE_POSTGRES] - Flag indicando se é ambiente PostgreSQL
 * @returns {Promise<{ success: boolean, error: string|null, stats?: Object, duplicateDetails?: Object }>}
 */
async function runPhase2c3Migrations(dbInstance = db, usePostgres = USE_POSTGRES) {
    const stats = {
        leadsBackfilled: 0,
        messagesBackfilled: 0
    };

    // Pré-validação 1: verificar duplicidades antes de qualquer alteração estrutural
    const preCheck = await checkHistoricalDuplicatesForUniqueIndex(dbInstance, usePostgres);
    if (preCheck.hasDuplicates) {
        const errorMsg = `[MIGRATION-ABORTED] Duplicidades históricas detectadas em whatsapp_messages para (tenant_uuid, provider, wa_message_id). ` +
            `Encontrados ${preCheck.groupsCount} grupos com duplicidade (total de ${preCheck.count} registros duplicados). ` +
            `O índice único 'uq_wa_msg_tenant_provider_wamid' NÃO foi criado para preservar integralmente os dados existentes sem exclusão ou consolidação arbitrária. ` +
            `Chaves duplicadas: ${JSON.stringify(preCheck.duplicates)}`;
        console.error('❌ ' + errorMsg);
        return {
            success: false,
            error: errorMsg,
            stats,
            duplicateDetails: preCheck
        };
    }

    const phase2c3BaseMigrations = [
        // Migration 2C.3-1A: tenant_uuid e colunas de fila/resiliência em whatsapp_messages
        `ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS tenant_uuid ${usePostgres ? 'UUID' : 'TEXT'}`,
        `ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0`,
        `ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS locked_until ${usePostgres ? 'TIMESTAMP' : 'DATETIME'}`,
        `ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS last_attempt_at ${usePostgres ? 'TIMESTAMP' : 'DATETIME'}`,
        `ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS error_message TEXT`,
        `ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS outbound_sent ${usePostgres ? 'BOOLEAN DEFAULT false' : 'INTEGER DEFAULT 0'}`,
        `ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS outbound_status ${usePostgres ? "VARCHAR(30) DEFAULT 'pending'" : "TEXT DEFAULT 'pending'"}`,
        `ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS outbound_wamid ${usePostgres ? 'VARCHAR(100)' : 'TEXT'}`,
        `ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS outbound_sent_at ${usePostgres ? 'TIMESTAMP' : 'DATETIME'}`,
        `ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS lease_token ${usePostgres ? 'VARCHAR(100)' : 'TEXT'}`,
        `CREATE INDEX IF NOT EXISTS idx_wa_msg_status_locked ON whatsapp_messages (status, locked_until)`,

        // Meta Cloud API colunas em whatsapp_settings
        `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS meta_phone_number_id VARCHAR(50)`,
        `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS meta_waba_id VARCHAR(50)`,
        `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS meta_access_token TEXT`,
        `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS meta_verify_token VARCHAR(255)`,
        `ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS meta_app_secret VARCHAR(255)`,
        `CREATE INDEX IF NOT EXISTS idx_wa_meta_phone ON whatsapp_settings(meta_phone_number_id)`,
        `CREATE INDEX IF NOT EXISTS idx_wa_meta_waba ON whatsapp_settings(meta_waba_id)`,

        // Migration 2C.3-1B: FK nomeada fk_wa_messages_tenant com validação estrutural via catálogos
        ...(usePostgres ? [`DO $$
        DECLARE
            v_constraint RECORD;
            v_count INT;
        BEGIN
            SELECT
                c.conname,
                tbl_local.relname AS local_table,
                att_local.attname AS local_col,
                tbl_ref.relname AS ref_table,
                att_ref.attname AS ref_col,
                c.contype
            INTO v_constraint
            FROM pg_constraint c
            JOIN pg_class tbl_local ON tbl_local.oid = c.conrelid
            JOIN pg_namespace ns_local ON ns_local.oid = tbl_local.relnamespace
            JOIN pg_attribute att_local ON att_local.attrelid = tbl_local.oid AND att_local.attnum = c.conkey[1]
            JOIN pg_class tbl_ref ON tbl_ref.oid = c.confrelid
            JOIN pg_namespace ns_ref ON ns_ref.oid = tbl_ref.relnamespace
            JOIN pg_attribute att_ref ON att_ref.attrelid = tbl_ref.oid AND att_ref.attnum = c.confkey[1]
            WHERE c.conname = 'fk_wa_messages_tenant'
              AND ns_local.nspname = current_schema();

            IF FOUND THEN
                IF v_constraint.local_table != 'whatsapp_messages' OR
                   v_constraint.local_col != 'tenant_uuid' OR
                   v_constraint.ref_table != 'tenants' OR
                   v_constraint.ref_col != 'id' OR
                   v_constraint.contype != 'f' THEN
                    RAISE EXCEPTION 'Constraint homônima incompatível: % na tabela % (%). Esperado: whatsapp_messages(tenant_uuid) -> tenants(id)',
                        v_constraint.conname, v_constraint.local_table, v_constraint.local_col;
                END IF;
            ELSE
                SELECT COUNT(*) INTO v_count
                FROM pg_constraint c
                JOIN pg_namespace ns ON ns.oid = c.connamespace
                WHERE c.conname = 'fk_wa_messages_tenant'
                  AND ns.nspname = current_schema();

                IF v_count > 0 THEN
                    RAISE EXCEPTION 'Constraint homônima incompatível de outro tipo encontrada com nome fk_wa_messages_tenant';
                END IF;

                ALTER TABLE whatsapp_messages
                ADD CONSTRAINT fk_wa_messages_tenant
                FOREIGN KEY (tenant_uuid) REFERENCES tenants(id);
            END IF;
        END $$;`] : []),

        // Migration 2C.3-1C: Índice para whatsapp_messages(tenant_uuid)
        `CREATE INDEX IF NOT EXISTS idx_wa_msg_tenant_uuid ON whatsapp_messages (tenant_uuid)`,

        // Migration 2C.3-1D: Índice para whatsapp_messages(wa_message_id) para deduplicação persistente
        `CREATE INDEX IF NOT EXISTS idx_wa_msg_wa_id ON whatsapp_messages (wa_message_id)`
    ];

    const phase2c3RemainingMigrations = [
        // Migration 2C.3-2: Índice para tenant_leads(tenant_uuid)
        `CREATE INDEX IF NOT EXISTS idx_tenant_leads_tenant_uuid ON tenant_leads (tenant_uuid)`,

        // Migration 2C.3-3A: tenant_uuid em learning_conversations
        `ALTER TABLE learning_conversations ADD COLUMN IF NOT EXISTS tenant_uuid ${usePostgres ? 'UUID' : 'TEXT'}`,

        // Migration 2C.3-3B: Índice para learning_conversations(tenant_uuid)
        `CREATE INDEX IF NOT EXISTS idx_learning_conv_tenant_uuid ON learning_conversations (tenant_uuid)`,

        // Migration 2C.3-4A: Backfill conservador para whatsapp_messages (somente correspondência exata com chave V1 ativa)
        ...(usePostgres ? [`UPDATE whatsapp_messages wm
         SET tenant_uuid = ak.tenant_id
         FROM api_keys ak
         WHERE wm.api_key = ak.key_value
           AND wm.tenant_uuid IS NULL
           AND ak.active = true
           AND ak.tenant_id IS NOT NULL`] : []),

        // Migration 2C.3-4B: Backfill conservador para tenant_leads (somente correspondência exata com chave V1 ativa)
        ...(usePostgres ? [`UPDATE tenant_leads tl
         SET tenant_uuid = ak.tenant_id
         FROM api_keys ak
         WHERE tl.api_key = ak.key_value
           AND tl.tenant_uuid IS NULL
           AND ak.active = true
           AND ak.tenant_id IS NOT NULL`] : [])
    ];

    // Se PostgreSQL possuir suporte a transações no adaptador, usar client dedicado com BEGIN / COMMIT / ROLLBACK
    const client = (usePostgres && typeof dbInstance.connect === 'function') ? await dbInstance.connect() : null;
    const runner = client || dbInstance;

    try {
        if (client) {
            await client.query('BEGIN');
        }

        // 1. Executar migrações base (colunas e índices estruturais)
        for (const migration of phase2c3BaseMigrations) {
            if (!usePostgres) {
                const alterMatch = migration.match(/ALTER TABLE (\w+) ADD COLUMN (?:IF NOT EXISTS )?(\w+)/i);
                if (alterMatch) {
                    const [, tableName, colName] = alterMatch;
                    try {
                        const cols = await runner.query(`PRAGMA table_info(${tableName})`);
                        const colList = cols.rows || cols;
                        const exists = colList.some(c => c.name === colName);
                        if (exists) continue;
                    } catch (pragmaErr) {
                        continue;
                    }
                    const sqliteQuery = migration.replace(/ADD COLUMN IF NOT EXISTS/i, 'ADD COLUMN').replace(/REFERENCES \w+\(\w+\)/i, '');
                    await runner.query(sqliteQuery);
                    continue;
                }
            }
            await runner.query(migration);
        }

        // 2. Validação prévia de duplicidades históricas antes de criar o índice único
        const dupCheck = await checkHistoricalDuplicatesForUniqueIndex(runner, usePostgres);
        if (dupCheck.hasDuplicates) {
            if (client) {
                await client.query('ROLLBACK');
            }
            const errorMsg = `[MIGRATION-ABORTED] Duplicidades históricas detectadas em whatsapp_messages para (tenant_uuid, provider, wa_message_id). ` +
                `Encontrados ${dupCheck.groupsCount} grupos com duplicidade (total de ${dupCheck.count} registros duplicados). ` +
                `O índice único 'uq_wa_msg_tenant_provider_wamid' NÃO foi criado para preservar integralmente os dados existentes sem exclusão ou consolidação arbitrária. ` +
                `Chaves duplicadas: ${JSON.stringify(dupCheck.duplicates)}`;
            console.error('❌ ' + errorMsg);
            return {
                success: false,
                error: errorMsg,
                stats,
                duplicateDetails: dupCheck
            };
        }

        // 3. Criar índice único parcial de idempotência
        await runner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_msg_tenant_provider_wamid ON whatsapp_messages (tenant_uuid, provider, wa_message_id) WHERE wa_message_id IS NOT NULL`);

        // 4. Executar migrações restantes (leads, learning_conversations, backfills)
        for (const migration of phase2c3RemainingMigrations) {
            if (!usePostgres) {
                const alterMatch = migration.match(/ALTER TABLE (\w+) ADD COLUMN (?:IF NOT EXISTS )?(\w+)/i);
                if (alterMatch) {
                    const [, tableName, colName] = alterMatch;
                    try {
                        const cols = await runner.query(`PRAGMA table_info(${tableName})`);
                        const colList = cols.rows || cols;
                        const exists = colList.some(c => c.name === colName);
                        if (exists) continue;
                    } catch (pragmaErr) {
                        continue;
                    }
                    const sqliteQuery = migration.replace(/ADD COLUMN IF NOT EXISTS/i, 'ADD COLUMN').replace(/REFERENCES \w+\(\w+\)/i, '');
                    await runner.query(sqliteQuery);
                    continue;
                }
            }
            const res = await runner.query(migration);
            if (migration.startsWith('UPDATE tenant_leads') && res && typeof res.rowCount === 'number') {
                stats.leadsBackfilled = res.rowCount;
            } else if (migration.startsWith('UPDATE whatsapp_messages') && res && typeof res.rowCount === 'number') {
                stats.messagesBackfilled = res.rowCount;
            }
        }

        if (client) {
            await client.query('COMMIT');
        }

        console.log('✅ [FASE 2C.3] Estruturas de persistência canônica multi-tenant validadas com sucesso.');
        return {
            success: true,
            error: null,
            stats
        };
    } catch (err) {
        if (client) {
            try { await client.query('ROLLBACK'); } catch (_) {}
        }
        console.error('❌ [FASE 2C.3] Falha na migration estrutural:', err.message);
        return {
            success: false,
            error: err.message,
            stats
        };
    } finally {
        if (client && typeof client.release === 'function') {
            client.release();
        }
    }
}

/**
 * 📊 Estrutura de tabelas PostgreSQL
 */
function getPostgresTables() {
    return [
        // ENTERPRISE SAAS MIGRATION - pgcrypto for UUIDs
        `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`,

        // Tabela de Tenants
        `CREATE TABLE IF NOT EXISTS tenants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT,
            email TEXT,
            plan TEXT DEFAULT 'basic',
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tabela de API Keys
        `CREATE TABLE IF NOT EXISTS api_keys (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            key_value TEXT NOT NULL,
            key_hash TEXT NOT NULL,
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tabela de Chatbots
        `CREATE TABLE IF NOT EXISTS chatbots (
            id VARCHAR(255) PRIMARY KEY,
            api_key VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            url TEXT NOT NULL,
            extracted_data JSONB,
            config JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(50) DEFAULT 'active',
            user_email VARCHAR(255),
            plan VARCHAR(50) DEFAULT 'free'
        )`,

        // Tabela de Conversas
        `CREATE TABLE IF NOT EXISTS conversations (
            id SERIAL PRIMARY KEY,
            chatbot_id VARCHAR(255) REFERENCES chatbots(id) ON DELETE CASCADE,
            session_id VARCHAR(255) NOT NULL,
            messages JSONB NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            user_satisfaction INTEGER,
            resolved BOOLEAN DEFAULT false,
            lead_captured BOOLEAN DEFAULT false,
            metadata JSONB DEFAULT '{}'
        )`,

        // Tabela de Analytics
        `CREATE TABLE IF NOT EXISTS analytics (
            id SERIAL PRIMARY KEY,
            chatbot_id VARCHAR(255) REFERENCES chatbots(id) ON DELETE CASCADE,
            date DATE NOT NULL,
            total_messages INTEGER DEFAULT 0,
            total_conversations INTEGER DEFAULT 0,
            avg_response_time FLOAT DEFAULT 0,
            success_rate FLOAT DEFAULT 0,
            error_count INTEGER DEFAULT 0,
            api_calls INTEGER DEFAULT 0,
            tokens_used INTEGER DEFAULT 0,
            cost_estimate FLOAT DEFAULT 0,
            UNIQUE(chatbot_id, date)
        )`,

        // Tabela de Cache de Extração
        `CREATE TABLE IF NOT EXISTS extraction_cache (
            id SERIAL PRIMARY KEY,
            url TEXT NOT NULL,
            url_hash VARCHAR(64) UNIQUE NOT NULL,
            extracted_data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP NOT NULL,
            hit_count INTEGER DEFAULT 0
        )`,

        // Tabela de Webhooks
        `CREATE TABLE IF NOT EXISTS webhooks (
            id SERIAL PRIMARY KEY,
            chatbot_id VARCHAR(255) REFERENCES chatbots(id) ON DELETE CASCADE,
            event_type VARCHAR(100) NOT NULL,
            url TEXT NOT NULL,
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tabela de Conhecimento Adicional
        `CREATE TABLE IF NOT EXISTS knowledge_base (
            id SERIAL PRIMARY KEY,
            chatbot_id VARCHAR(255) REFERENCES chatbots(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL,
            content TEXT NOT NULL,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tabela de Leads por Tenant (para migração futura de JSON)
        `CREATE TABLE IF NOT EXISTS tenant_leads (
            id VARCHAR(255) PRIMARY KEY,
            api_key VARCHAR(255) NOT NULL,
            nome TEXT,
            email TEXT,
            telefone TEXT,
            message TEXT,
            url_origem TEXT,
            source TEXT DEFAULT 'widget',
            status TEXT DEFAULT 'novo',
            metadata JSONB DEFAULT '{}',
            conversations JSONB DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tabela de Agendamentos por Tenant
        `CREATE TABLE IF NOT EXISTS tenant_appointments (
            id VARCHAR(255) PRIMARY KEY,
            api_key VARCHAR(255) NOT NULL,
            lead_id VARCHAR(255),
            datetime TEXT,
            status TEXT DEFAULT 'pendente',
            notes TEXT,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tabela de Short URLs
        `CREATE TABLE IF NOT EXISTS short_urls (
            id SERIAL PRIMARY KEY,
            short_code VARCHAR(10) UNIQUE NOT NULL,
            api_key VARCHAR(255) NOT NULL,
            long_url TEXT NOT NULL,
            robot_name VARCHAR(255),
            sales_url TEXT,
            instructions TEXT,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            access_count INTEGER DEFAULT 0,
            status VARCHAR(20) DEFAULT 'active'
        )`,

        // Tabela de Configurações WhatsApp por Tenant (NOVO - Multi-Tenant)
        `CREATE TABLE IF NOT EXISTS whatsapp_settings (
            id SERIAL PRIMARY KEY,
            api_key VARCHAR(255) UNIQUE NOT NULL,
            provider VARCHAR(20) NOT NULL,

            -- Configurações Twilio
            twilio_account_sid VARCHAR(255),
            twilio_auth_token VARCHAR(255),
            twilio_from_number VARCHAR(50),

            -- Configurações Evolution API
            evolution_api_url TEXT,
            evolution_api_key VARCHAR(255),
            evolution_instance_name VARCHAR(100),

            -- Configurações gerais
            notification_phone VARCHAR(50),
            is_active BOOLEAN DEFAULT true,
            test_mode BOOLEAN DEFAULT false,

            -- Metadados
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (api_key) REFERENCES chatbots(api_key) ON DELETE CASCADE
        )`,

        // Tabela de Configurações ChatGPT por Tenant (Multi-Tenant)
        `CREATE TABLE IF NOT EXISTS chatgpt_settings (
            id SERIAL PRIMARY KEY,
            api_key VARCHAR(255) UNIQUE NOT NULL,
            openai_api_key TEXT NOT NULL,
            default_model VARCHAR(50) DEFAULT 'gpt-4-turbo',
            temperature REAL DEFAULT 0.7,
            max_tokens INTEGER DEFAULT 1000,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (api_key) REFERENCES chatbots(api_key) ON DELETE CASCADE
        )`,

        // ========================================
        // TABELAS V8.0 - NOVAS FUNCIONALIDADES
        // ========================================

        // Tabela de Memória Conversacional Persistente (V8.0)
        `CREATE TABLE IF NOT EXISTS conversation_memory (
            id VARCHAR(255) PRIMARY KEY,
            user_id VARCHAR(255) NOT NULL,
            tenant_id VARCHAR(255),
            memory_type VARCHAR(50) DEFAULT 'conversation',

            -- Dados da memória
            preferences JSONB DEFAULT '{}',
            interaction_history JSONB DEFAULT '[]',
            emotional_profile JSONB DEFAULT '{}',
            topics_discussed JSONB DEFAULT '[]',

            -- Estatísticas
            total_interactions INTEGER DEFAULT 0,
            avg_sentiment REAL DEFAULT 0,
            last_emotion VARCHAR(50),

            -- Metadados
            session_data JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,

            UNIQUE(user_id, tenant_id)
        )`,

        // Tabela de Logs de Auditoria (V8.0)
        `CREATE TABLE IF NOT EXISTS audit_logs (
            id VARCHAR(255) PRIMARY KEY,
            tenant_id VARCHAR(255),
            action VARCHAR(100) NOT NULL,
            actor_type VARCHAR(50),
            actor_id VARCHAR(255),
            target_type VARCHAR(50),
            target_id VARCHAR(255),
            details JSONB,
            severity VARCHAR(20) DEFAULT 'info',
            ip_address VARCHAR(45),
            user_agent TEXT,
            session_id VARCHAR(255),
            metadata JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tabela de Feature Flags (V8.0)
        `CREATE TABLE IF NOT EXISTS feature_flags (
            id SERIAL PRIMARY KEY,
            flag_name VARCHAR(100) UNIQUE NOT NULL,
            enabled BOOLEAN DEFAULT false,
            description TEXT,
            tenant_overrides JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Índices para performance
        `CREATE INDEX IF NOT EXISTS idx_conversations_chatbot ON conversations(chatbot_id)`,
        `CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp)`,
        `CREATE INDEX IF NOT EXISTS idx_analytics_chatbot_date ON analytics(chatbot_id, date)`,
        `CREATE INDEX IF NOT EXISTS idx_extraction_cache_hash ON extraction_cache(url_hash)`,
        `CREATE INDEX IF NOT EXISTS idx_extraction_cache_expires ON extraction_cache(expires_at)`,
        `CREATE INDEX IF NOT EXISTS idx_tenant_leads_api_key ON tenant_leads(api_key)`,
        `CREATE INDEX IF NOT EXISTS idx_tenant_appointments_api_key ON tenant_appointments(api_key)`,
        `CREATE INDEX IF NOT EXISTS idx_tenant_appointments_lead_id ON tenant_appointments(lead_id)`,
        `CREATE INDEX IF NOT EXISTS idx_short_urls_code ON short_urls(short_code)`,
        `CREATE INDEX IF NOT EXISTS idx_short_urls_api_key ON short_urls(api_key)`,
        `CREATE INDEX IF NOT EXISTS idx_whatsapp_settings_api_key ON whatsapp_settings(api_key)`,

        // Tabela de Assistentes IA por Tenant (Meus Assistentes)
        `CREATE TABLE IF NOT EXISTS tenant_assistants (
            id VARCHAR(255) PRIMARY KEY,
            api_key VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            sales_url TEXT NOT NULL,
            instructions TEXT DEFAULT '',
            status VARCHAR(20) DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Índices para tabelas V8.0
        `CREATE INDEX IF NOT EXISTS idx_memory_user ON conversation_memory(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_memory_tenant ON conversation_memory(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_memory_expires ON conversation_memory(expires_at)`,
        `CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)`,
        `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)`,
        `CREATE INDEX IF NOT EXISTS idx_tenant_assistants_api_key ON tenant_assistants(api_key)`,

        // ========================================
        // TABELAS CRM V7.0 — Pipeline, Leads CRM, Follow-Up, Deals
        // ========================================

        `CREATE TABLE IF NOT EXISTS crm_pipelines (
            id VARCHAR(255) PRIMARY KEY,
            tenant_id VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            is_default BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS crm_stages (
            id VARCHAR(255) PRIMARY KEY,
            pipeline_id VARCHAR(255) NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            color VARCHAR(20) DEFAULT '#6366f1',
            order_index INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS crm_leads (
            id VARCHAR(255) PRIMARY KEY,
            tenant_id VARCHAR(255) NOT NULL,
            original_lead_id VARCHAR(255),
            name VARCHAR(255) DEFAULT 'Não informado',
            email VARCHAR(255),
            phone VARCHAR(50),
            source VARCHAR(50) DEFAULT 'widget',
            stage_id VARCHAR(255) REFERENCES crm_stages(id) ON DELETE SET NULL,
            estimated_value NUMERIC(12,2) DEFAULT 0,
            temperature VARCHAR(10) DEFAULT 'cold',
            score INTEGER DEFAULT 0,
            last_contact_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_response_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS crm_activities (
            id VARCHAR(255) PRIMARY KEY,
            tenant_id VARCHAR(255) NOT NULL,
            lead_id VARCHAR(255) NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
            type VARCHAR(50) NOT NULL,
            description TEXT,
            old_value TEXT,
            new_value TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS crm_deals (
            id VARCHAR(255) PRIMARY KEY,
            tenant_id VARCHAR(255) NOT NULL,
            lead_id VARCHAR(255) REFERENCES crm_leads(id) ON DELETE SET NULL,
            title VARCHAR(255) NOT NULL,
            value NUMERIC(12,2) DEFAULT 0,
            probability INTEGER DEFAULT 50,
            expected_close_date DATE,
            status VARCHAR(20) DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS followup_rules (
            id VARCHAR(255) PRIMARY KEY,
            tenant_id VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            trigger_type VARCHAR(50) NOT NULL DEFAULT 'new_lead',
            trigger_stage_id VARCHAR(255),
            delay_minutes INTEGER DEFAULT 1440,
            channel VARCHAR(20) DEFAULT 'email',
            message_template TEXT,
            max_attempts INTEGER DEFAULT 3,
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS followup_jobs (
            id VARCHAR(255) PRIMARY KEY,
            tenant_id VARCHAR(255) NOT NULL,
            lead_id VARCHAR(255) NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
            rule_id VARCHAR(255) NOT NULL REFERENCES followup_rules(id) ON DELETE CASCADE,
            scheduled_for TIMESTAMP NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            attempts INTEGER DEFAULT 0,
            last_error TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS followup_logs (
            id VARCHAR(255) PRIMARY KEY,
            job_id VARCHAR(255) NOT NULL REFERENCES followup_jobs(id) ON DELETE CASCADE,
            channel VARCHAR(20),
            delivery_status VARCHAR(20) DEFAULT 'pending',
            error_message TEXT,
            sent_at TIMESTAMP,
            response_detected BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Índices CRM V7.0
        `CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant ON crm_leads(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_crm_leads_email ON crm_leads(email)`,
        `CREATE INDEX IF NOT EXISTS idx_crm_leads_stage ON crm_leads(stage_id)`,
        `CREATE INDEX IF NOT EXISTS idx_crm_stages_pipeline ON crm_stages(pipeline_id)`,
        `CREATE INDEX IF NOT EXISTS idx_crm_deals_tenant ON crm_deals(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_followup_rules_tenant ON followup_rules(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_followup_jobs_status ON followup_jobs(status, scheduled_for)`,
        `CREATE INDEX IF NOT EXISTS idx_followup_jobs_lead ON followup_jobs(lead_id)`
    ];
}

/**
 * 📊 Estrutura de tabelas SQLite
 */
function getSQLiteTables() {
    return [
        // Tabela de Tenants
        `CREATE TABLE IF NOT EXISTS tenants (
            id TEXT PRIMARY KEY,
            name TEXT,
            email TEXT,
            plan TEXT DEFAULT 'basic',
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tabela de API Keys
        `CREATE TABLE IF NOT EXISTS api_keys (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            key_value TEXT NOT NULL,
            key_hash TEXT NOT NULL,
            active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        )`,

        // Tabela de Chatbots
        `CREATE TABLE IF NOT EXISTS chatbots (
            id TEXT PRIMARY KEY,
            api_key TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            extracted_data TEXT,
            config TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'active',
            user_email TEXT,
            plan TEXT DEFAULT 'free'
        )`,

        // Tabela de Conversas
        `CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chatbot_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            messages TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            user_satisfaction INTEGER,
            resolved INTEGER DEFAULT 0,
            lead_captured INTEGER DEFAULT 0,
            metadata TEXT DEFAULT '{}',
            FOREIGN KEY (chatbot_id) REFERENCES chatbots(id) ON DELETE CASCADE
        )`,

        // Tabela de Analytics
        `CREATE TABLE IF NOT EXISTS analytics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chatbot_id TEXT NOT NULL,
            date DATE NOT NULL,
            total_messages INTEGER DEFAULT 0,
            total_conversations INTEGER DEFAULT 0,
            avg_response_time REAL DEFAULT 0,
            success_rate REAL DEFAULT 0,
            error_count INTEGER DEFAULT 0,
            api_calls INTEGER DEFAULT 0,
            tokens_used INTEGER DEFAULT 0,
            cost_estimate REAL DEFAULT 0,
            FOREIGN KEY (chatbot_id) REFERENCES chatbots(id) ON DELETE CASCADE,
            UNIQUE(chatbot_id, date)
        )`,

        // Tabela de Cache de Extração
        `CREATE TABLE IF NOT EXISTS extraction_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT NOT NULL,
            url_hash TEXT UNIQUE NOT NULL,
            extracted_data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            hit_count INTEGER DEFAULT 0
        )`,

        // Tabela de Webhooks
        `CREATE TABLE IF NOT EXISTS webhooks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chatbot_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            url TEXT NOT NULL,
            active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chatbot_id) REFERENCES chatbots(id) ON DELETE CASCADE
        )`,

        // Tabela de Conhecimento Adicional
        `CREATE TABLE IF NOT EXISTS knowledge_base (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chatbot_id TEXT NOT NULL,
            type TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chatbot_id) REFERENCES chatbots(id) ON DELETE CASCADE
        )`,

        // Tabela de Leads por Tenant (para migração futura de JSON)
        `CREATE TABLE IF NOT EXISTS tenant_leads (
            id TEXT PRIMARY KEY,
            api_key TEXT NOT NULL,
            nome TEXT,
            email TEXT,
            telefone TEXT,
            message TEXT,
            url_origem TEXT,
            source TEXT DEFAULT 'widget',
            status TEXT DEFAULT 'novo',
            metadata TEXT DEFAULT '{}',
            conversations TEXT DEFAULT '[]',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tabela de Agendamentos por Tenant
        `CREATE TABLE IF NOT EXISTS tenant_appointments (
            id TEXT PRIMARY KEY,
            api_key TEXT NOT NULL,
            lead_id TEXT,
            datetime TEXT,
            status TEXT DEFAULT 'pendente',
            notes TEXT,
            metadata TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tabela de Short URLs
        `CREATE TABLE IF NOT EXISTS short_urls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            short_code TEXT UNIQUE NOT NULL,
            api_key TEXT NOT NULL,
            long_url TEXT NOT NULL,
            robot_name TEXT,
            sales_url TEXT,
            instructions TEXT,
            metadata TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
            access_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active'
        )`,

        // Tabela de Configurações WhatsApp por Tenant (NOVO - Multi-Tenant)
        `CREATE TABLE IF NOT EXISTS whatsapp_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            api_key TEXT UNIQUE NOT NULL,
            provider TEXT NOT NULL,

            -- Configurações Twilio
            twilio_account_sid TEXT,
            twilio_auth_token TEXT,
            twilio_from_number TEXT,

            -- Configurações Evolution API
            evolution_api_url TEXT,
            evolution_api_key TEXT,
            evolution_instance_name TEXT,

            -- Configurações gerais
            notification_phone TEXT,
            is_active INTEGER DEFAULT 1,
            test_mode INTEGER DEFAULT 0,

            -- Metadados
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (api_key) REFERENCES chatbots(api_key) ON DELETE CASCADE
        )`,

        // Tabela de Configurações ChatGPT por Tenant (Multi-Tenant)
        `CREATE TABLE IF NOT EXISTS chatgpt_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            api_key TEXT UNIQUE NOT NULL,
            openai_api_key TEXT NOT NULL,
            default_model TEXT DEFAULT 'gpt-4-turbo',
            temperature REAL DEFAULT 0.7,
            max_tokens INTEGER DEFAULT 1000,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (api_key) REFERENCES chatbots(api_key) ON DELETE CASCADE
        )`,

        // ========================================
        // TABELAS V8.0 - NOVAS FUNCIONALIDADES (SQLite)
        // ========================================

        // Tabela de Memória Conversacional Persistente (V8.0)
        `CREATE TABLE IF NOT EXISTS conversation_memory (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            tenant_id TEXT,
            memory_type TEXT DEFAULT 'conversation',

            -- Dados da memória
            preferences TEXT DEFAULT '{}',
            interaction_history TEXT DEFAULT '[]',
            emotional_profile TEXT DEFAULT '{}',
            topics_discussed TEXT DEFAULT '[]',

            -- Estatísticas
            total_interactions INTEGER DEFAULT 0,
            avg_sentiment REAL DEFAULT 0,
            last_emotion TEXT,

            -- Metadados
            session_data TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME,

            UNIQUE(user_id, tenant_id)
        )`,

        // Tabela de Logs de Auditoria (V8.0)
        `CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            tenant_id TEXT,
            action TEXT NOT NULL,
            actor_type TEXT,
            actor_id TEXT,
            target_type TEXT,
            target_id TEXT,
            details TEXT,
            severity TEXT DEFAULT 'info',
            ip_address TEXT,
            user_agent TEXT,
            session_id TEXT,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tabela de Feature Flags (V8.0)
        `CREATE TABLE IF NOT EXISTS feature_flags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            flag_name TEXT UNIQUE NOT NULL,
            enabled INTEGER DEFAULT 0,
            description TEXT,
            tenant_overrides TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tabela de Assistentes IA por Tenant (Meus Assistentes)
        `CREATE TABLE IF NOT EXISTS tenant_assistants (
            id TEXT PRIMARY KEY,
            api_key TEXT NOT NULL,
            name TEXT NOT NULL,
            sales_url TEXT NOT NULL,
            instructions TEXT DEFAULT '',
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Índices para tabelas V8.0
        `CREATE INDEX IF NOT EXISTS idx_memory_user ON conversation_memory(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_memory_tenant ON conversation_memory(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)`,
        `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)`,
        `CREATE INDEX IF NOT EXISTS idx_tenant_assistants_api_key ON tenant_assistants(api_key)`,

        // ========================================
        // TABELAS CRM V7.0 — Pipeline, Leads CRM, Follow-Up, Deals (SQLite)
        // ========================================

        `CREATE TABLE IF NOT EXISTS crm_pipelines (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            name TEXT NOT NULL,
            is_default INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS crm_stages (
            id TEXT PRIMARY KEY,
            pipeline_id TEXT NOT NULL,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#6366f1',
            order_index INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (pipeline_id) REFERENCES crm_pipelines(id) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS crm_leads (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            original_lead_id TEXT,
            name TEXT DEFAULT 'Não informado',
            email TEXT,
            phone TEXT,
            source TEXT DEFAULT 'widget',
            stage_id TEXT,
            estimated_value REAL DEFAULT 0,
            temperature TEXT DEFAULT 'cold',
            score INTEGER DEFAULT 0,
            last_contact_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_response_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (stage_id) REFERENCES crm_stages(id) ON DELETE SET NULL
        )`,

        `CREATE TABLE IF NOT EXISTS crm_activities (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            lead_id TEXT NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            old_value TEXT,
            new_value TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS crm_deals (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            lead_id TEXT,
            title TEXT NOT NULL,
            value REAL DEFAULT 0,
            probability INTEGER DEFAULT 50,
            expected_close_date TEXT,
            status TEXT DEFAULT 'open',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE SET NULL
        )`,

        `CREATE TABLE IF NOT EXISTS followup_rules (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            name TEXT NOT NULL,
            trigger_type TEXT NOT NULL DEFAULT 'new_lead',
            trigger_stage_id TEXT,
            delay_minutes INTEGER DEFAULT 1440,
            channel TEXT DEFAULT 'email',
            message_template TEXT,
            max_attempts INTEGER DEFAULT 3,
            active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        `CREATE TABLE IF NOT EXISTS followup_jobs (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            lead_id TEXT NOT NULL,
            rule_id TEXT NOT NULL,
            scheduled_for DATETIME NOT NULL,
            status TEXT DEFAULT 'pending',
            attempts INTEGER DEFAULT 0,
            last_error TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lead_id) REFERENCES crm_leads(id) ON DELETE CASCADE,
            FOREIGN KEY (rule_id) REFERENCES followup_rules(id) ON DELETE CASCADE
        )`,

        `CREATE TABLE IF NOT EXISTS followup_logs (
            id TEXT PRIMARY KEY,
            job_id TEXT NOT NULL,
            channel TEXT,
            delivery_status TEXT DEFAULT 'pending',
            error_message TEXT,
            sent_at DATETIME,
            response_detected INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (job_id) REFERENCES followup_jobs(id) ON DELETE CASCADE
        )`,

        // Índices CRM V7.0
        `CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant ON crm_leads(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_crm_leads_email ON crm_leads(email)`,
        `CREATE INDEX IF NOT EXISTS idx_crm_leads_stage ON crm_leads(stage_id)`,
        `CREATE INDEX IF NOT EXISTS idx_crm_stages_pipeline ON crm_stages(pipeline_id)`,
        `CREATE INDEX IF NOT EXISTS idx_crm_deals_tenant ON crm_deals(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_followup_rules_tenant ON followup_rules(tenant_id)`,
        `CREATE INDEX IF NOT EXISTS idx_followup_jobs_status ON followup_jobs(status, scheduled_for)`,
        `CREATE INDEX IF NOT EXISTS idx_followup_jobs_lead ON followup_jobs(lead_id)`
    ];
}

/**
 * 🔍 Funções auxiliares para queries
 */
const DatabaseHelpers = {
    /**
     * 🔧 Executar query genérica (INSERT, UPDATE, DELETE, CREATE)
     */
    async run(query, params = []) {
        try {
            if (USE_POSTGRES) {
                // Converter ? para $1, $2, etc para PostgreSQL
                let pgQuery = query;
                let paramIndex = 1;
                pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);
                await db.query(pgQuery, params);
            } else {
                // SQLite usa ? diretamente
                const sqliteQuery = query.replace(/\$(\d+)/g, '?');
                db.sqlite.prepare(sqliteQuery).run(params);
            }
            return true;
        } catch (error) {
            console.error('❌ DatabaseHelpers.run error:', error);
            throw error;
        }
    },

    /**
     * 🔧 Buscar uma única linha
     */
    async get(query, params = []) {
        try {
            if (USE_POSTGRES) {
                let pgQuery = query;
                let paramIndex = 1;
                pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);
                const result = await db.query(pgQuery, params);
                return result.rows[0] || null;
            } else {
                const sqliteQuery = query.replace(/\$(\d+)/g, '?');
                return db.sqlite.prepare(sqliteQuery).get(params);
            }
        } catch (error) {
            console.error('❌ DatabaseHelpers.get error:', error);
            throw error;
        }
    },

    /**
     * 🔧 Buscar múltiplas linhas
     */
    async all(query, params = []) {
        try {
            if (USE_POSTGRES) {
                let pgQuery = query;
                let paramIndex = 1;
                pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);
                const result = await db.query(pgQuery, params);
                return result.rows;
            } else {
                const sqliteQuery = query.replace(/\$(\d+)/g, '?');
                return db.sqlite.prepare(sqliteQuery).all(params);
            }
        } catch (error) {
            console.error('❌ DatabaseHelpers.all error:', error);
            return [];
        }
    },

    /**
     * Criar ou atualizar chatbot
     */
    async upsertChatbot(chatbotData) {

        const { id, api_key, name, url, extracted_data, config, user_email, plan } = chatbotData;

        const query = USE_POSTGRES
            ? `INSERT INTO chatbots (id, api_key, name, url, extracted_data, config, user_email, plan, last_active)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
               ON CONFLICT (id) DO UPDATE SET
                   name = $3, url = $4, extracted_data = $5, config = $6,
                   user_email = $7, plan = $8, last_active = CURRENT_TIMESTAMP
               RETURNING *`
            : `INSERT OR REPLACE INTO chatbots (id, api_key, name, url, extracted_data, config, user_email, plan, last_active)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

        const params = [
            id,
            api_key,
            name,
            url,
            // FIX-04 [V21.1-HARDENING]: Sanitizar Unicode surrogates antes de persistir
            JSON.stringify(this._sanitizeForJson(extracted_data)),
            JSON.stringify(this._sanitizeForJson(config)),
            user_email,
            plan || 'free'
        ];

        const result = await db.query(query, params);
        return result.rows[0];
    },

    /**
     * Buscar chatbot por API key
     */
    async getChatbotByApiKey(apiKey) {
        const query = USE_POSTGRES
            ? `SELECT * FROM chatbots WHERE api_key = $1 OR tenant_uuid::text = $1`
            : `SELECT * FROM chatbots WHERE api_key = ? OR tenant_uuid = ?`;

        const params = USE_POSTGRES ? [apiKey] : [apiKey, apiKey];
        const result = await db.query(query, params);
        const chatbot = result.rows[0];

        if (chatbot && !USE_POSTGRES) {
            chatbot.extracted_data = JSON.parse(chatbot.extracted_data || '{}');
            chatbot.config = JSON.parse(chatbot.config || '{}');
        }

        return chatbot;
    },

    /**
     * Salvar conversa
     */
    async saveConversation(conversationData) {
        const { chatbot_id, session_id, messages, user_satisfaction, resolved, lead_captured, metadata } = conversationData;

        const query = USE_POSTGRES
            ? `INSERT INTO conversations (chatbot_id, session_id, messages, user_satisfaction, resolved, lead_captured, metadata)
               VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`
            : `INSERT INTO conversations (chatbot_id, session_id, messages, user_satisfaction, resolved, lead_captured, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;

        const params = [
            chatbot_id,
            session_id,
            // FIX-04 [V21.1-HARDENING]: Sanitizar Unicode surrogates antes de persistir
            JSON.stringify(this._sanitizeForJson(messages)),
            user_satisfaction,
            resolved ? 1 : 0,
            lead_captured ? 1 : 0,
            JSON.stringify(this._sanitizeForJson(metadata || {}))
        ];

        const result = await db.query(query, params);
        return result.rows[0];
    },

    /**
     * Atualizar analytics diário
     */
    async updateDailyAnalytics(chatbot_id, metrics) {
        const today = new Date().toISOString().split('T')[0];

        const query = USE_POSTGRES
            ? `INSERT INTO analytics (chatbot_id, date, total_messages, total_conversations, avg_response_time, success_rate, error_count, api_calls, tokens_used, cost_estimate)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               ON CONFLICT (chatbot_id, date) DO UPDATE SET
                   total_messages = analytics.total_messages + $3,
                   total_conversations = analytics.total_conversations + $4,
                   avg_response_time = ($5 + analytics.avg_response_time) / 2,
                   success_rate = ($6 + analytics.success_rate) / 2,
                   error_count = analytics.error_count + $7,
                   api_calls = analytics.api_calls + $8,
                   tokens_used = analytics.tokens_used + $9,
                   cost_estimate = analytics.cost_estimate + $10`
            : `INSERT OR REPLACE INTO analytics (chatbot_id, date, total_messages, total_conversations, avg_response_time, success_rate, error_count, api_calls, tokens_used, cost_estimate)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const params = [
            chatbot_id,
            today,
            metrics.total_messages || 1,
            metrics.total_conversations || 1,
            metrics.avg_response_time || 0,
            metrics.success_rate || 100,
            metrics.error_count || 0,
            metrics.api_calls || 1,
            metrics.tokens_used || 0,
            metrics.cost_estimate || 0
        ];

        await db.query(query, params);
    },

    /**
     * Buscar ou criar cache de extração
     */
    async getOrCreateExtractionCache(url, extractionFunction) {
        const crypto = require('crypto');
        const urlHash = crypto.createHash('sha256').update(url).digest('hex');

        // Buscar cache existente
        const query = USE_POSTGRES
            ? `SELECT * FROM extraction_cache WHERE url_hash = $1 AND expires_at > CURRENT_TIMESTAMP`
            : `SELECT * FROM extraction_cache WHERE url_hash = ? AND expires_at > datetime('now')`;

        const result = await db.query(query, [urlHash]);

        if (result.rows.length > 0) {
            // Cache hit - incrementar contador
            const updateQuery = USE_POSTGRES
                ? `UPDATE extraction_cache SET hit_count = hit_count + 1 WHERE url_hash = $1`
                : `UPDATE extraction_cache SET hit_count = hit_count + 1 WHERE url_hash = ?`;

            await db.query(updateQuery, [urlHash]);

            console.log('✅ Cache HIT para URL:', url);
            const cached = result.rows[0];
            return USE_POSTGRES ? cached.extracted_data : JSON.parse(cached.extracted_data);
        }

        // Cache miss - extrair dados
        console.log('❌ Cache MISS para URL:', url);
        const extractedData = await extractionFunction(url);

        // Salvar no cache (24 horas)
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const insertQuery = USE_POSTGRES
            ? `INSERT INTO extraction_cache (url, url_hash, extracted_data, expires_at)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (url_hash) DO UPDATE SET
                   extracted_data = $3, expires_at = $4, hit_count = 0`
            : `INSERT OR REPLACE INTO extraction_cache (url, url_hash, extracted_data, expires_at)
               VALUES (?, ?, ?, ?)`;

        await db.query(insertQuery, [
            url,
            urlHash,
            // FIX-04 [V21.1-HARDENING]: Sanitizar Unicode surrogates antes de persistir
            JSON.stringify(this._sanitizeForJson(extractedData)),
            expiresAt.toISOString()
        ]);

        return extractedData;
    },

    /**
     * Limpar cache expirado
     */
    async cleanExpiredCache() {
        const query = USE_POSTGRES
            ? `DELETE FROM extraction_cache WHERE expires_at < CURRENT_TIMESTAMP`
            : `DELETE FROM extraction_cache WHERE expires_at < datetime('now')`;

        const result = await db.query(query);
        console.log('🧹 Cache expirado limpo');
    },

    /**
     * Obter analytics de um chatbot
     */
    async getChatbotAnalytics(chatbot_id, days = 30) {
        const query = USE_POSTGRES
            ? `SELECT * FROM analytics
               WHERE chatbot_id = $1 AND date >= CURRENT_DATE - ($2 * INTERVAL '1 day')
               ORDER BY date DESC`
            : `SELECT * FROM analytics
               WHERE chatbot_id = ? AND date >= date('now', '-' || ? || ' days')
               ORDER BY date DESC`;

        const parsedDays = parseInt(days, 10);
        if (isNaN(parsedDays) || parsedDays <= 0) {
            throw new Error('Invalid days parameter');
        }
        const result = await db.query(query, USE_POSTGRES ? [chatbot_id, parsedDays] : [chatbot_id, parsedDays]);
        return result.rows;
    },

    // ===== CRUD para tenant_leads =====

    /**
     * 🛡️ [V20-FIX] Sanitizar strings para remover Unicode surrogates órfãos
     * Resolve erro PostgreSQL 22P02: "Unicode low surrogate must follow a high surrogate"
     * Causa: emojis cortados pela metade ao truncar strings ou dados do widget
     */
    _sanitizeForJson(value) {
        if (value === null || value === undefined) return value;
        if (typeof value === 'string') {
            // Remove surrogates órfãos (high sem low, ou low sem high)
            return value.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
        }
        if (typeof value === 'number' || typeof value === 'boolean') return value;
        if (Array.isArray(value)) {
            return value.map(item => this._sanitizeForJson(item));
        }
        if (typeof value === 'object') {
            const sanitized = {};
            for (const [key, val] of Object.entries(value)) {
                sanitized[key] = this._sanitizeForJson(val);
            }
            return sanitized;
        }
        return value;
    },

    /**
     * Salvar lead no PostgreSQL/SQLite
     * 🛡️ [FASE 2C.3 / R-01 / R-07] Persistência Canônica Multi-Tenant
     * @param {string} apiKey - Chave da API
     * @param {Object} leadData - Dados do lead
     * @param {string|null} [tenantUuid=null] - UUID canônico do tenant autenticado
     */
    async saveLead(apiKey, leadData, tenantUuid = null) {
        if (!leadData || !leadData.id) {
            throw new Error('ID do lead é obrigatório para persistência.');
        }

        const resolvedTenantUuid = isUuid(tenantUuid)
            ? tenantUuid.trim().toLowerCase()
            : (isUuid(leadData.tenant_uuid)
                ? leadData.tenant_uuid.trim().toLowerCase()
                : (isUuid(leadData.tenantUuid) ? leadData.tenantUuid.trim().toLowerCase() : null));

        // 🛡️ [V20-FIX] Sanitizar dados antes de persistir no PostgreSQL
        const safeMeta = this._sanitizeForJson(leadData.metadata || {});
        const safeConvs = this._sanitizeForJson(leadData.conversations || []);
        const safeMessage = this._sanitizeForJson(leadData.message || null);

        let savedLead = null;

        if (USE_POSTGRES) {
            const query = `INSERT INTO tenant_leads (
                id, api_key, nome, email, telefone, message, url_origem, source, status, metadata, conversations, tenant_uuid
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id) DO UPDATE SET
                nome = EXCLUDED.nome,
                email = EXCLUDED.email,
                telefone = EXCLUDED.telefone,
                message = EXCLUDED.message,
                url_origem = EXCLUDED.url_origem,
                status = EXCLUDED.status,
                metadata = EXCLUDED.metadata,
                conversations = EXCLUDED.conversations,
                api_key = CASE
                    WHEN tenant_leads.tenant_uuid IS NOT NULL AND EXCLUDED.tenant_uuid IS NOT NULL AND tenant_leads.tenant_uuid = EXCLUDED.tenant_uuid THEN EXCLUDED.api_key
                    ELSE tenant_leads.api_key
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE (
                (tenant_leads.tenant_uuid IS NOT NULL AND EXCLUDED.tenant_uuid IS NOT NULL AND tenant_leads.tenant_uuid = EXCLUDED.tenant_uuid)
                OR
                (tenant_leads.tenant_uuid IS NULL AND EXCLUDED.tenant_uuid IS NULL AND tenant_leads.api_key = EXCLUDED.api_key)
            )
            RETURNING *`;

            const params = [
                leadData.id,
                apiKey,
                leadData.nome || null,
                leadData.email || null,
                leadData.telefone || null,
                safeMessage,
                leadData.url_origem || null,
                leadData.source || 'widget',
                leadData.status || 'novo',
                JSON.stringify(safeMeta),
                JSON.stringify(safeConvs),
                resolvedTenantUuid
            ];

            // 🛡️ [V20.1-HOTFIX] Sanitização final dos params JSON stringificados
            const surrogateRegex = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
            for (let i = 0; i < params.length; i++) {
                if (typeof params[i] === 'string' && surrogateRegex.test(params[i])) {
                    console.warn(`⚠️ [SURROGATE-FIX] Param $${i + 1} contém surrogate órfão — sanitizando`);
                    surrogateRegex.lastIndex = 0;
                    params[i] = params[i].replace(surrogateRegex, '');
                }
                surrogateRegex.lastIndex = 0;
            }

            const result = await db.query(query, params);
            if (result.rows && result.rows.length > 0) {
                savedLead = result.rows[0];
            } else {
                // Conflito de ID com falha na cláusula WHERE de ownership
                const existing = await db.query('SELECT id, tenant_uuid, api_key FROM tenant_leads WHERE id = $1', [leadData.id]);
                if (existing.rows && existing.rows.length > 0) {
                    const row = existing.rows[0];
                    console.warn(`🚨 [SECURITY][TENANT-ISOLATION] Tentativa de alteração de lead pertencente a outro tenant: leadId=${leadData.id}, owner=${row.tenant_uuid || 'legacy'}, attemptedTenant=${resolvedTenantUuid || 'legacy'}`);
                    const err = new Error('Acesso negado: lead pertence a outro tenant.');
                    err.code = 'OWNERSHIP_MISMATCH';
                    err.status = 403;
                    throw err;
                }
            }
        } else {
            // SQLite / ambiente local
            const existing = await db.query('SELECT id, tenant_uuid, api_key FROM tenant_leads WHERE id = ?', [leadData.id]);
            const existingRow = existing.rows ? existing.rows[0] : null;

            if (existingRow) {
                const sameTenant = (existingRow.tenant_uuid && resolvedTenantUuid && existingRow.tenant_uuid === resolvedTenantUuid);
                const sameLegacy = (!existingRow.tenant_uuid && !resolvedTenantUuid && existingRow.api_key === apiKey);

                if (!sameTenant && !sameLegacy) {
                    console.warn(`🚨 [SECURITY][TENANT-ISOLATION] Tentativa de alteração de lead pertencente a outro tenant (SQLite): leadId=${leadData.id}`);
                    const err = new Error('Acesso negado: lead pertence a outro tenant.');
                    err.code = 'OWNERSHIP_MISMATCH';
                    err.status = 403;
                    throw err;
                }

                const updateQuery = `UPDATE tenant_leads SET
                    nome = ?, email = ?, telefone = ?, message = ?, url_origem = ?, source = ?,
                    status = ?, metadata = ?, conversations = ?, updated_at = datetime('now')
                    WHERE id = ?`;
                await db.query(updateQuery, [
                    leadData.nome || null,
                    leadData.email || null,
                    leadData.telefone || null,
                    safeMessage,
                    leadData.url_origem || null,
                    leadData.source || 'widget',
                    leadData.status || 'novo',
                    JSON.stringify(safeMeta),
                    JSON.stringify(safeConvs),
                    leadData.id
                ]);
            } else {
                const insertQuery = `INSERT INTO tenant_leads (id, api_key, nome, email, telefone, message, url_origem, source, status, metadata, conversations, tenant_uuid, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;
                await db.query(insertQuery, [
                    leadData.id,
                    apiKey,
                    leadData.nome || null,
                    leadData.email || null,
                    leadData.telefone || null,
                    safeMessage,
                    leadData.url_origem || null,
                    leadData.source || 'widget',
                    leadData.status || 'novo',
                    JSON.stringify(safeMeta),
                    JSON.stringify(safeConvs),
                    resolvedTenantUuid
                ]);
            }
            const fetchRes = await db.query('SELECT * FROM tenant_leads WHERE id = ?', [leadData.id]);
            savedLead = fetchRes.rows ? fetchRes.rows[0] : null;
        }

        // ===== HOOK: CRM SYNC (non-blocking, lazy require) =====
        // 🛡️ [FASE 2C.3 / R-07] Sincronização resiliente com tenant canônico e suporte a chaves V2 (bcrypt)
        setImmediate(async () => {
            try {
                const { crmManager } = require('./lib/crm/index');
                let crmTenantId = resolvedTenantUuid;

                if (!crmTenantId && USE_POSTGRES && apiKey) {
                    if (apiKey.startsWith('lm_live_') || apiKey.startsWith('lm_test_')) {
                        const prefix = apiKey.substring(0, 12);
                        const v2Result = await db.query(
                            `SELECT tenant_id, key_hash, status FROM api_keys_v2 WHERE key_prefix = $1`,
                            [prefix]
                        );
                        const rows = v2Result.rows || [];
                        const bcrypt = require('bcryptjs');
                        for (const row of rows) {
                            if (row.status === 'active' && await bcrypt.compare(apiKey, row.key_hash)) {
                                crmTenantId = row.tenant_id ? row.tenant_id.toString() : null;
                                break;
                            }
                        }
                    } else {
                        const akResult = await db.query(
                            `SELECT tenant_id, tenant_uuid FROM api_keys WHERE key_hash = $1 LIMIT 1`,
                            [require('crypto').createHash('sha256').update(apiKey).digest('hex')]
                        );
                        const row = (akResult.rows || akResult)[0];
                        crmTenantId = row?.tenant_uuid?.toString() || row?.tenant_id?.toString() || null;
                    }
                }

                if (crmTenantId) {
                    await crmManager.syncLeadToCRM(crmTenantId, {
                        id: leadData.id,
                        nome: leadData.nome,
                        email: leadData.email,
                        telefone: leadData.telefone,
                        url_origem: leadData.url_origem,
                        source: leadData.source
                    });
                }
            } catch (crmErr) {
                if (process.env.NODE_ENV !== 'test') {
                    console.warn('⚠️ [CRM-HOOK] Sync não executado:', crmErr.message);
                }
            }
        });
        // ===== FIM DO HOOK CRM SYNC =====

        return savedLead;
    },

    /**
     * Buscar todos os leads de um tenant por UUID canônico
     * @param {string} tenantUuid - UUID do tenant
     */
    async getLeadsByTenant(tenantUuid) {
        if (!isUuid(tenantUuid)) {
            throw new Error('UUID canônico inválido para busca de leads');
        }
        const normalizedUuid = tenantUuid.trim().toLowerCase();
        const query = USE_POSTGRES
            ? `SELECT * FROM tenant_leads WHERE tenant_uuid = $1 ORDER BY created_at DESC`
            : `SELECT * FROM tenant_leads WHERE tenant_uuid = ? ORDER BY created_at DESC`;

        const result = await db.query(query, [normalizedUuid]);
        const rows = result.rows || [];
        return rows.map(lead => {
            if (!USE_POSTGRES) {
                lead.metadata = typeof lead.metadata === 'string' ? JSON.parse(lead.metadata || '{}') : lead.metadata;
                lead.conversations = typeof lead.conversations === 'string' ? JSON.parse(lead.conversations || '[]') : lead.conversations;
            }
            return lead;
        });
    },

    /**
     * Buscar todos os leads de um tenant
     * Se identifier for UUID: filtra por tenant_uuid = $1
     * Se identifier for API Key legada: filtra por api_key = $1 AND tenant_uuid IS NULL
     */
    async getLeads(identifier) {
        if (!identifier) return [];
        if (isUuid(identifier)) {
            return this.getLeadsByTenant(identifier);
        }

        const query = USE_POSTGRES
            ? `SELECT * FROM tenant_leads WHERE api_key = $1 AND tenant_uuid IS NULL ORDER BY created_at DESC`
            : `SELECT * FROM tenant_leads WHERE api_key = ? AND tenant_uuid IS NULL ORDER BY created_at DESC`;

        const result = await db.query(query, [identifier]);
        const rows = result.rows || [];
        return rows.map(lead => {
            if (!USE_POSTGRES) {
                lead.metadata = typeof lead.metadata === 'string' ? JSON.parse(lead.metadata || '{}') : lead.metadata;
                lead.conversations = typeof lead.conversations === 'string' ? JSON.parse(lead.conversations || '[]') : lead.conversations;
            }
            return lead;
        });
    },

    /**
     * Buscar lead por ID e UUID do tenant
     */
    async getLeadByIdAndTenant(tenantUuid, leadId) {
        if (!isUuid(tenantUuid)) throw new Error('UUID canônico inválido');
        const normalizedUuid = tenantUuid.trim().toLowerCase();
        const query = USE_POSTGRES
            ? `SELECT * FROM tenant_leads WHERE tenant_uuid = $1 AND id = $2`
            : `SELECT * FROM tenant_leads WHERE tenant_uuid = ? AND id = ?`;

        const result = await db.query(query, [normalizedUuid, leadId]);
        const lead = (result.rows || [])[0];
        if (lead && !USE_POSTGRES) {
            lead.metadata = typeof lead.metadata === 'string' ? JSON.parse(lead.metadata || '{}') : lead.metadata;
            lead.conversations = typeof lead.conversations === 'string' ? JSON.parse(lead.conversations || '[]') : lead.conversations;
        }
        return lead || null;
    },

    /**
     * Buscar lead por ID
     */
    async getLeadById(identifier, leadId) {
        if (!identifier || !leadId) return null;
        if (isUuid(identifier)) {
            return this.getLeadByIdAndTenant(identifier, leadId);
        }

        const query = USE_POSTGRES
            ? `SELECT * FROM tenant_leads WHERE api_key = $1 AND tenant_uuid IS NULL AND id = $2`
            : `SELECT * FROM tenant_leads WHERE api_key = ? AND tenant_uuid IS NULL AND id = ?`;

        const result = await db.query(query, [identifier, leadId]);
        const lead = (result.rows || [])[0];

        if (lead && !USE_POSTGRES) {
            lead.metadata = typeof lead.metadata === 'string' ? JSON.parse(lead.metadata || '{}') : lead.metadata;
            lead.conversations = typeof lead.conversations === 'string' ? JSON.parse(lead.conversations || '[]') : lead.conversations;
        }

        return lead || null;
    },

    /**
     * Atualizar lead por UUID do tenant
     */
    async updateLeadByTenant(tenantUuid, leadId, data) {
        if (!isUuid(tenantUuid)) throw new Error('UUID canônico inválido');
        const normalizedUuid = tenantUuid.trim().toLowerCase();
        const query = USE_POSTGRES
            ? `UPDATE tenant_leads SET
                nome = COALESCE($3, nome),
                email = COALESCE($4, email),
                telefone = COALESCE($5, telefone),
                status = COALESCE($6, status),
                metadata = COALESCE($7, metadata),
                conversations = COALESCE($8, conversations),
                updated_at = CURRENT_TIMESTAMP
               WHERE tenant_uuid = $1 AND id = $2
               RETURNING *`
            : `UPDATE tenant_leads SET
                nome = COALESCE(?, nome),
                email = COALESCE(?, email),
                telefone = COALESCE(?, telefone),
                status = COALESCE(?, status),
                metadata = COALESCE(?, metadata),
                conversations = COALESCE(?, conversations),
                updated_at = datetime('now')
               WHERE tenant_uuid = ? AND id = ?`;

        const params = USE_POSTGRES
            ? [
                normalizedUuid, leadId,
                data.nome, data.email, data.telefone, data.status,
                data.metadata ? JSON.stringify(this._sanitizeForJson(data.metadata)) : null,
                data.conversations ? JSON.stringify(this._sanitizeForJson(data.conversations)) : null
            ]
            : [
                data.nome, data.email, data.telefone, data.status,
                data.metadata ? JSON.stringify(this._sanitizeForJson(data.metadata)) : null,
                data.conversations ? JSON.stringify(this._sanitizeForJson(data.conversations)) : null,
                normalizedUuid, leadId
            ];

        const result = await db.query(query, params);
        return (result.rows || [])[0] || null;
    },

    /**
     * Atualizar lead
     */
    async updateLead(identifier, leadId, data) {
        if (!identifier || !leadId) return null;
        if (isUuid(identifier)) {
            return this.updateLeadByTenant(identifier, leadId, data);
        }

        const query = USE_POSTGRES
            ? `UPDATE tenant_leads SET
                nome = COALESCE($3, nome),
                email = COALESCE($4, email),
                telefone = COALESCE($5, telefone),
                status = COALESCE($6, status),
                metadata = COALESCE($7, metadata),
                conversations = COALESCE($8, conversations),
                updated_at = CURRENT_TIMESTAMP
               WHERE api_key = $1 AND tenant_uuid IS NULL AND id = $2
               RETURNING *`
            : `UPDATE tenant_leads SET
                nome = COALESCE(?, nome),
                email = COALESCE(?, email),
                telefone = COALESCE(?, telefone),
                status = COALESCE(?, status),
                metadata = COALESCE(?, metadata),
                conversations = COALESCE(?, conversations),
                updated_at = datetime('now')
               WHERE api_key = ? AND tenant_uuid IS NULL AND id = ?`;

        const params = USE_POSTGRES
            ? [
                identifier, leadId,
                data.nome, data.email, data.telefone, data.status,
                data.metadata ? JSON.stringify(this._sanitizeForJson(data.metadata)) : null,
                data.conversations ? JSON.stringify(this._sanitizeForJson(data.conversations)) : null
            ]
            : [
                data.nome, data.email, data.telefone, data.status,
                data.metadata ? JSON.stringify(this._sanitizeForJson(data.metadata)) : null,
                data.conversations ? JSON.stringify(this._sanitizeForJson(data.conversations)) : null,
                identifier, leadId
            ];

        const result = await db.query(query, params);
        return (result.rows || [])[0] || null;
    },

    // ===== CRUD para tenant_appointments =====

    /**
     * Salvar agendamento no PostgreSQL/SQLite
     * Fase 2B: aceita opcionalmente scheduleRefId e tenantUuid
     */
    async saveAppointment(apiKey, appointmentData) {
        const query = USE_POSTGRES
            ? `INSERT INTO tenant_appointments (id, api_key, lead_id, datetime, status, notes, metadata, schedule_ref_id, tenant_uuid)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               ON CONFLICT (id) DO UPDATE SET
                   datetime = $4, status = $5, notes = $6, metadata = $7,
                   schedule_ref_id = COALESCE($8, tenant_appointments.schedule_ref_id),
                   tenant_uuid = COALESCE($9, tenant_appointments.tenant_uuid),
                   updated_at = CURRENT_TIMESTAMP
               RETURNING *`
            : `INSERT OR REPLACE INTO tenant_appointments (id, api_key, lead_id, datetime, status, notes, metadata, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

        const params = USE_POSTGRES
            ? [
                appointmentData.id,
                apiKey,
                appointmentData.leadId || null,
                appointmentData.datetime || null,
                appointmentData.status || 'pendente',
                appointmentData.notes || null,
                // FIX-04 [V21.1-HARDENING]: Sanitizar Unicode surrogates antes de persistir
                JSON.stringify(this._sanitizeForJson(appointmentData.metadata || {})),
                appointmentData.scheduleRefId || null,
                appointmentData.tenantUuid || null
            ]
            : [
                appointmentData.id,
                apiKey,
                appointmentData.leadId || null,
                appointmentData.datetime || null,
                appointmentData.status || 'pendente',
                appointmentData.notes || null,
                JSON.stringify(this._sanitizeForJson(appointmentData.metadata || {}))
            ];

        const result = await db.query(query, params);
        return result.rows?.[0];
    },

    /**
     * Buscar todos os agendamentos de um tenant (fallback legado por api_key)
     */
    async getAppointments(apiKey) {
        const query = USE_POSTGRES
            ? `SELECT * FROM tenant_appointments WHERE api_key = $1 ORDER BY created_at DESC`
            : `SELECT * FROM tenant_appointments WHERE api_key = ? ORDER BY created_at DESC`;

        const result = await db.query(query, [apiKey]);
        return result.rows.map(apt => {
            if (!USE_POSTGRES) {
                apt.metadata = JSON.parse(apt.metadata || '{}');
            }
            return apt;
        });
    },

    /**
     * Fase 2B: Buscar agendamentos por tenant_uuid — sobrevive à rotação de API Key
     */
    async getAppointmentsByTenant(tenantUuid) {
        if (!USE_POSTGRES || !tenantUuid) return [];
        const query = `SELECT * FROM tenant_appointments WHERE tenant_uuid = $1 ORDER BY created_at DESC`;
        const result = await db.query(query, [tenantUuid]);
        return result.rows || [];
    },

    /**
     * Buscar agendamentos por lead ID
     */
    async getAppointmentsByLeadId(apiKey, leadId) {
        const query = USE_POSTGRES
            ? `SELECT * FROM tenant_appointments WHERE api_key = $1 AND lead_id = $2 ORDER BY created_at DESC`
            : `SELECT * FROM tenant_appointments WHERE api_key = ? AND lead_id = ? ORDER BY created_at DESC`;

        const result = await db.query(query, [apiKey, leadId]);
        return result.rows.map(apt => {
            if (!USE_POSTGRES) {
                apt.metadata = JSON.parse(apt.metadata || '{}');
            }
            return apt;
        });
    },

    /**
     * Atualizar status do agendamento
     */
    async updateAppointmentStatus(apiKey, appointmentId, status) {
        const query = USE_POSTGRES
            ? `UPDATE tenant_appointments SET status = $3, updated_at = CURRENT_TIMESTAMP
               WHERE api_key = $1 AND id = $2 RETURNING *`
            : `UPDATE tenant_appointments SET status = ?, updated_at = datetime('now')
               WHERE api_key = ? AND id = ?`;

        const params = USE_POSTGRES
            ? [apiKey, appointmentId, status]
            : [status, apiKey, appointmentId];

        const result = await db.query(query, params);
        return result.rows[0];
    },

    // ===== CRUD para short_urls =====

    /**
     * Criar short URL
     */
    async createShortUrl(apiKey, shortUrlData) {
        const query = USE_POSTGRES
            ? `INSERT INTO short_urls (short_code, api_key, long_url, robot_name, sales_url, instructions, metadata)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING *`
            : `INSERT INTO short_urls (short_code, api_key, long_url, robot_name, sales_url, instructions, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;

        const params = [
            shortUrlData.shortCode,
            apiKey,
            shortUrlData.longUrl,
            shortUrlData.robotName || null,
            shortUrlData.salesUrl || null,
            shortUrlData.instructions || null,
            // FIX-04 [V21.1-HARDENING]: Sanitizar Unicode surrogates antes de persistir
            JSON.stringify(this._sanitizeForJson(shortUrlData.metadata || {}))
        ];

        try {
            const result = await db.query(query, params);
            console.log(`✅ Short URL criada: ${shortUrlData.shortCode} para tenant ${apiKey}`);
            return result.rows[0];
        } catch (error) {
            console.error('❌ Erro ao criar short URL:', error);
            throw error;
        }
    },

    /**
     * Buscar short URL por código
     */
    async getShortUrl(shortCode) {
        const query = USE_POSTGRES
            ? `SELECT * FROM short_urls WHERE short_code = $1 AND status = 'active'`
            : `SELECT * FROM short_urls WHERE short_code = ? AND status = 'active'`;

        const result = await db.query(query, [shortCode]);
        const shortUrl = result.rows[0];

        if (shortUrl && !USE_POSTGRES) {
            shortUrl.metadata = JSON.parse(shortUrl.metadata || '{}');
        }

        return shortUrl;
    },

    /**
     * Atualizar contador de acessos de short URL
     */
    async updateShortUrlAccess(shortCode) {
        const query = USE_POSTGRES
            ? `UPDATE short_urls
               SET access_count = access_count + 1,
                   last_accessed = CURRENT_TIMESTAMP
               WHERE short_code = $1`
            : `UPDATE short_urls
               SET access_count = access_count + 1,
                   last_accessed = datetime('now')
               WHERE short_code = ?`;

        await db.query(query, [shortCode]);
    },

    /**
     * Listar short URLs de um tenant
     */
    async getShortUrlsByApiKey(apiKey) {
        const query = USE_POSTGRES
            ? `SELECT * FROM short_urls WHERE api_key = $1 OR tenant_uuid::text = $1 ORDER BY created_at DESC`
            : `SELECT * FROM short_urls WHERE api_key = ? OR tenant_uuid = ? ORDER BY created_at DESC`;

        const params = USE_POSTGRES ? [apiKey] : [apiKey, apiKey];
        const result = await db.query(query, params);
        return result.rows.map(shortUrl => {
            if (!USE_POSTGRES) {
                shortUrl.metadata = JSON.parse(shortUrl.metadata || '{}');
            }
            return shortUrl;
        });
    },

    /**
 * Hard-delete de short URL (assistente) por ID
 * ANTERIORMENTE: soft-delete (status='inactive')
 * AGORA: exclusão permanente - o usuário já confirmou na UI
 */
    async deleteShortUrl(apiKey, id) {
        // First fetch the row to return its data
        const selectQuery = USE_POSTGRES
            ? `SELECT * FROM short_urls WHERE id = $1 AND api_key = $2`
            : `SELECT * FROM short_urls WHERE id = ? AND api_key = ?`;

        const selectResult = await db.query(selectQuery, [id, apiKey]);
        const row = selectResult.rows[0];
        if (!row) return null;

        // Hard-delete: remover permanentemente
        const deleteQuery = USE_POSTGRES
            ? `DELETE FROM short_urls WHERE id = $1 AND api_key = $2`
            : `DELETE FROM short_urls WHERE id = ? AND api_key = ?`;

        await db.query(deleteQuery, [id, apiKey]);
        console.log(`✅ Short URL (assistente) EXCLUÍDO PERMANENTEMENTE: id=${id} para tenant ${apiKey}`);
        return row;
    },

    /**
     * Verificar se short code já existe
     */
    async shortCodeExists(shortCode) {
        const query = USE_POSTGRES
            ? `SELECT COUNT(*) as count FROM short_urls WHERE short_code = $1`
            : `SELECT COUNT(*) as count FROM short_urls WHERE short_code = ?`;

        const result = await db.query(query, [shortCode]);
        const count = USE_POSTGRES ? parseInt(result.rows[0].count) : result.rows[0].count;
        return count > 0;
    },

    // ===== CRUD para whatsapp_settings (NOVO - Multi-Tenant) =====

    /**
     * Salvar configurações WhatsApp de um tenant
     */
    async saveWhatsAppSettings(apiKey, settings) {
        let metaToken = settings.metaAccessToken || settings.accessToken || null;
        const tenantUuid = settings.tenantUuid || (isUuid(apiKey) ? apiKey : null);

        // Criptografar token da Meta se encryptionManager estiver ativo
        if (metaToken && encMgr && encMgr.enabled) {
            metaToken = encMgr.encrypt(metaToken, tenantUuid || apiKey);
        }

        const query = USE_POSTGRES
            ? `INSERT INTO whatsapp_settings (
                   api_key, provider, twilio_account_sid, twilio_auth_token,
                   twilio_from_number, evolution_api_url, evolution_api_key,
                   evolution_instance_name, notification_phone, is_active,
                   meta_phone_number_id, meta_waba_id, meta_access_token,
                   meta_verify_token, meta_app_secret, tenant_uuid
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
               ON CONFLICT (api_key) DO UPDATE SET
                   provider = $2, twilio_account_sid = $3, twilio_auth_token = $4,
                   twilio_from_number = $5, evolution_api_url = $6,
                   evolution_api_key = $7, evolution_instance_name = $8,
                   notification_phone = $9, is_active = $10,
                   meta_phone_number_id = $11, meta_waba_id = $12, meta_access_token = $13,
                   meta_verify_token = $14, meta_app_secret = $15,
                   tenant_uuid = COALESCE($16, whatsapp_settings.tenant_uuid),
                   updated_at = CURRENT_TIMESTAMP
               RETURNING *`
            : `INSERT OR REPLACE INTO whatsapp_settings (
                   api_key, provider, twilio_account_sid, twilio_auth_token,
                   twilio_from_number, evolution_api_url, evolution_api_key,
                   evolution_instance_name, notification_phone, is_active,
                   meta_phone_number_id, meta_waba_id, meta_access_token,
                   meta_verify_token, meta_app_secret, tenant_uuid,
                   updated_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

        const params = [
            apiKey,
            settings.provider,
            settings.twilioAccountSid || null,
            settings.twilioAuthToken || null,
            settings.twilioFromNumber || null,
            settings.evolutionApiUrl || null,
            settings.evolutionApiKey || null,
            settings.evolutionInstanceName || null,
            settings.notificationPhone || null,
            settings.isActive !== undefined ? settings.isActive : true,
            settings.metaPhoneNumberId || settings.phoneNumberId || null,
            settings.metaWabaId || settings.wabaId || null,
            metaToken,
            settings.metaVerifyToken || settings.verifyToken || null,
            settings.metaAppSecret || settings.appSecret || null,
            tenantUuid
        ];

        try {
            const result = await db.query(query, params);
            console.log(`✅ WhatsApp configurado para tenant ${apiKey} (${settings.provider})`);
            return result.rows[0];
        } catch (error) {
            console.error('❌ Erro ao salvar configurações WhatsApp:', error);
            throw error;
        }
    },

    /**
     * Buscar configurações WhatsApp de um tenant
     */
    async getWhatsAppSettings(apiKey) {
        const query = USE_POSTGRES
            ? `SELECT * FROM whatsapp_settings WHERE (api_key = $1 OR tenant_uuid::text = $1) AND is_active = true`
            : `SELECT * FROM whatsapp_settings WHERE (api_key = ? OR tenant_uuid = ?) AND is_active = 1`;

        const params = USE_POSTGRES ? [apiKey] : [apiKey, apiKey];
        const result = await db.query(query, params);
        const settings = result.rows[0];

        if (!settings) {
            return null;
        }

        // Converter boolean para SQLite (0/1)
        if (!USE_POSTGRES) {
            settings.is_active = settings.is_active === 1;
            settings.test_mode = settings.test_mode === 1;
        }

        // Descriptografar token da Meta se necessário
        if (settings.meta_access_token && settings.meta_access_token.startsWith('ENC:') && encMgr) {
            settings.meta_access_token = encMgr.decrypt(settings.meta_access_token, settings.tenant_uuid || apiKey);
        }

        return settings;
    },

    /**
     * Deletar configurações WhatsApp de um tenant
     */
    async deleteWhatsAppSettings(apiKey) {
        const query = USE_POSTGRES
            ? `DELETE FROM whatsapp_settings WHERE api_key = $1`
            : `DELETE FROM whatsapp_settings WHERE api_key = ?`;

        try {
            await db.query(query, [apiKey]);
            console.log(`✅ Configurações WhatsApp removidas para tenant ${apiKey}`);
            return { success: true };
        } catch (error) {
            console.error('❌ Erro ao deletar configurações WhatsApp:', error);
            throw error;
        }
    },

    /**
     * Listar todos os tenants com WhatsApp configurado
     */
    async listWhatsAppSettings() {
        const query = USE_POSTGRES
            ? `SELECT api_key, provider, notification_phone, is_active, created_at
               FROM whatsapp_settings
               WHERE is_active = true
               ORDER BY created_at DESC`
            : `SELECT api_key, provider, notification_phone, is_active, created_at
               FROM whatsapp_settings
               WHERE is_active = 1
               ORDER BY created_at DESC`;

        const result = await db.query(query);
        return result.rows || [];
    },

    /**
     * Buscar configurações WhatsApp por Meta Phone Number ID (Webhooks)
     */
    async getWhatsAppSettingsByMetaPhone(phoneNumberId) {
        if (!phoneNumberId) return null;
        const query = USE_POSTGRES
            ? `SELECT * FROM whatsapp_settings WHERE meta_phone_number_id = $1 AND is_active = true LIMIT 1`
            : `SELECT * FROM whatsapp_settings WHERE meta_phone_number_id = ? AND is_active = 1 LIMIT 1`;
        const result = await db.query(query, [phoneNumberId]);
        const settings = result?.rows?.[0] || null;
        if (settings && settings.meta_access_token && settings.meta_access_token.startsWith('ENC:') && encMgr) {
            settings.meta_access_token = encMgr.decrypt(settings.meta_access_token, settings.tenant_uuid || settings.api_key);
        }
        return settings;
    },

    /**
     * Buscar configurações WhatsApp por Meta WABA ID
     */
    async getWhatsAppSettingsByMetaWaba(wabaId) {
        if (!wabaId) return null;
        const query = USE_POSTGRES
            ? `SELECT * FROM whatsapp_settings WHERE meta_waba_id = $1 AND is_active = true LIMIT 1`
            : `SELECT * FROM whatsapp_settings WHERE meta_waba_id = ? AND is_active = 1 LIMIT 1`;
        const result = await db.query(query, [wabaId]);
        const settings = result?.rows?.[0] || null;
        if (settings && settings.meta_access_token && settings.meta_access_token.startsWith('ENC:') && encMgr) {
            settings.meta_access_token = encMgr.decrypt(settings.meta_access_token, settings.tenant_uuid || settings.api_key);
        }
        return settings;
    },

    /**
     * Buscar configurações WhatsApp por tenant_uuid canônico
     */
    async getWhatsAppSettingsByTenant(tenantUuid) {
        if (!tenantUuid) return null;
        const query = USE_POSTGRES
            ? `SELECT * FROM whatsapp_settings WHERE (tenant_uuid = $1 OR api_key = $1) AND is_active = true LIMIT 1`
            : `SELECT * FROM whatsapp_settings WHERE (tenant_uuid = ? OR api_key = ?) AND is_active = 1 LIMIT 1`;
        const result = await db.query(query, USE_POSTGRES ? [tenantUuid] : [tenantUuid, tenantUuid]);
        const settings = result?.rows?.[0] || null;
        if (settings && settings.meta_access_token && settings.meta_access_token.startsWith('ENC:') && encMgr) {
            settings.meta_access_token = encMgr.decrypt(settings.meta_access_token, settings.tenant_uuid || settings.api_key);
        }
        return settings;
    },

    // ===== CRUD para chatgpt_settings (Multi-Tenant) =====

    /**
     * Salvar configurações ChatGPT de um tenant
     */
    async saveChatGPTSettings(apiKey, settings) {
        const query = USE_POSTGRES
            ? `INSERT INTO chatgpt_settings (
                   api_key, openai_api_key, default_model, temperature, max_tokens, is_active
               ) VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (api_key) DO UPDATE SET
                   openai_api_key = $2, default_model = $3, temperature = $4,
                   max_tokens = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
               RETURNING *`
            : `INSERT OR REPLACE INTO chatgpt_settings (
                   api_key, openai_api_key, default_model, temperature, max_tokens, is_active, updated_at
               ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`;

        const params = [
            apiKey,
            settings.openaiApiKey,
            settings.defaultModel || 'gpt-4-turbo',
            settings.temperature !== undefined ? settings.temperature : 0.7,
            settings.maxTokens || 1000,
            settings.isActive !== undefined ? settings.isActive : true
        ];

        try {
            const result = await db.query(query, params);
            console.log(`✅ ChatGPT configurado para tenant ${apiKey} (${settings.defaultModel || 'gpt-4-turbo'})`);
            return result.rows ? result.rows[0] : { success: true };
        } catch (error) {
            console.error('❌ Erro ao salvar configurações ChatGPT:', error);
            throw error;
        }
    },

    /**
     * Buscar configurações ChatGPT de um tenant
     */
    async getChatGPTSettings(apiKey) {
        const query = USE_POSTGRES
            ? `SELECT * FROM chatgpt_settings WHERE api_key = $1 AND is_active = true`
            : `SELECT * FROM chatgpt_settings WHERE api_key = ? AND is_active = 1`;

        const result = await db.query(query, [apiKey]);
        const settings = result.rows[0];

        if (!settings) {
            return null;
        }

        // Converter boolean para SQLite (0/1)
        if (!USE_POSTGRES) {
            settings.is_active = settings.is_active === 1;
        }

        return settings;
    },

    /**
     * Deletar configurações ChatGPT de um tenant
     */
    async deleteChatGPTSettings(apiKey) {
        const query = USE_POSTGRES
            ? `DELETE FROM chatgpt_settings WHERE api_key = $1`
            : `DELETE FROM chatgpt_settings WHERE api_key = ?`;

        try {
            await db.query(query, [apiKey]);
            console.log(`✅ Configurações ChatGPT removidas para tenant ${apiKey}`);
            return { success: true };
        } catch (error) {
            console.error('❌ Erro ao deletar configurações ChatGPT:', error);
            throw error;
        }
    },

    // ===== SHORT URL MANAGEMENT =====

    /**
     * Verificar se código curto já existe
     */
    async shortCodeExists(code) {
        const query = USE_POSTGRES
            ? `SELECT COUNT(*) as count FROM short_urls WHERE short_code = $1 AND status = 'active'`
            : `SELECT COUNT(*) as count FROM short_urls WHERE short_code = ? AND status = 'active'`;

        const result = await db.query(query, [code]);
        const count = USE_POSTGRES ? parseInt(result.rows[0].count) : result.rows[0].count;
        return count > 0;
    },

    /**
     * Criar novo short URL
     */
    async createShortUrl(apiKey, data) {
        const { shortCode, longUrl, robotName, salesUrl, instructions, metadata } = data;

        const query = USE_POSTGRES
            ? `INSERT INTO short_urls (short_code, api_key, long_url, robot_name, sales_url, instructions, metadata, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
               RETURNING *`
            : `INSERT INTO short_urls (short_code, api_key, long_url, robot_name, sales_url, instructions, metadata, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`;

        const params = [
            shortCode,
            apiKey,
            longUrl,
            robotName || null,
            salesUrl || null,
            instructions || null,
            // FIX-04 [V21.1-HARDENING]: Sanitizar Unicode surrogates antes de persistir
            JSON.stringify(this._sanitizeForJson(metadata || {}))
        ];

        const result = await db.query(query, params);
        return result.rows[0];
    },

    /**
     * Buscar short URL por código
     */
    async getShortUrlByCode(code) {
        const query = USE_POSTGRES
            ? `SELECT * FROM short_urls WHERE short_code = $1 AND status = 'active'`
            : `SELECT * FROM short_urls WHERE short_code = ? AND status = 'active'`;

        const result = await db.query(query, [code]);
        const shortUrl = result.rows[0];

        if (shortUrl && !USE_POSTGRES) {
            shortUrl.metadata = JSON.parse(shortUrl.metadata || '{}');
        }

        // Incrementar contador de acessos
        if (shortUrl) {
            const updateQuery = USE_POSTGRES
                ? `UPDATE short_urls
                   SET access_count = access_count + 1, last_accessed = CURRENT_TIMESTAMP
                   WHERE short_code = $1`
                : `UPDATE short_urls
                   SET access_count = access_count + 1, last_accessed = datetime('now')
                   WHERE short_code = ?`;

            await db.query(updateQuery, [code]);
        }

        return shortUrl;
    },

    // ===== CRUD para tenant_assistants (Meus Assistentes) =====

    /**
     * Salvar novo assistente
     */
    async saveAssistant(apiKey, assistantData) {
        const query = USE_POSTGRES
            ? `INSERT INTO tenant_assistants (id, api_key, name, sales_url, instructions, status)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING *`
            : `INSERT INTO tenant_assistants (id, api_key, name, sales_url, instructions, status)
               VALUES (?, ?, ?, ?, ?, ?)`;

        const params = [
            assistantData.id,
            apiKey,
            assistantData.name,
            assistantData.salesUrl,
            assistantData.instructions || '',
            assistantData.status || 'active'
        ];

        const result = await db.query(query, params);
        return result.rows[0] || assistantData;
    },

    /**
     * Buscar todos os assistentes de um tenant
     */
    async getAssistants(apiKey) {
        const query = USE_POSTGRES
            ? `SELECT * FROM tenant_assistants WHERE api_key = $1 ORDER BY created_at DESC`
            : `SELECT * FROM tenant_assistants WHERE api_key = ? ORDER BY created_at DESC`;

        const result = await db.query(query, [apiKey]);
        return result.rows.map(a => ({
            id: a.id,
            name: a.name,
            salesUrl: a.sales_url,
            instructions: a.instructions || '',
            status: a.status,
            createdAt: a.created_at,
            updatedAt: a.updated_at
        }));
    },

    /**
     * Atualizar assistente
     */
    async updateAssistant(apiKey, assistantId, data) {
        const fields = [];
        const params = [];
        let paramIndex = 1;

        if (data.name !== undefined) {
            fields.push(USE_POSTGRES ? `name = $${paramIndex++}` : `name = ?`);
            params.push(data.name);
        }
        if (data.salesUrl !== undefined) {
            fields.push(USE_POSTGRES ? `sales_url = $${paramIndex++}` : `sales_url = ?`);
            params.push(data.salesUrl);
        }
        if (data.instructions !== undefined) {
            fields.push(USE_POSTGRES ? `instructions = $${paramIndex++}` : `instructions = ?`);
            params.push(data.instructions);
        }
        if (data.status !== undefined) {
            fields.push(USE_POSTGRES ? `status = $${paramIndex++}` : `status = ?`);
            params.push(data.status);
        }

        if (fields.length === 0) return null;

        fields.push(USE_POSTGRES ? `updated_at = CURRENT_TIMESTAMP` : `updated_at = datetime('now')`);

        const whereClause = USE_POSTGRES
            ? `WHERE id = $${paramIndex++} AND api_key = $${paramIndex++}`
            : `WHERE id = ? AND api_key = ?`;
        params.push(assistantId, apiKey);

        const query = USE_POSTGRES
            ? `UPDATE tenant_assistants SET ${fields.join(', ')} ${whereClause} RETURNING *`
            : `UPDATE tenant_assistants SET ${fields.join(', ')} ${whereClause}`;

        const result = await db.query(query, params);

        if (USE_POSTGRES) {
            const row = result.rows[0];
            if (!row) return null;
            return { id: row.id, name: row.name, salesUrl: row.sales_url, instructions: row.instructions, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
        }

        // For SQLite, fetch the updated row
        return this.getAssistantById(apiKey, assistantId);
    },

    /**
     * Buscar assistente por ID
     */
    async getAssistantById(apiKey, assistantId) {
        const query = USE_POSTGRES
            ? `SELECT * FROM tenant_assistants WHERE id = $1 AND api_key = $2`
            : `SELECT * FROM tenant_assistants WHERE id = ? AND api_key = ?`;

        const result = await db.query(query, [assistantId, apiKey]);
        const a = result.rows[0];
        if (!a) return null;
        return { id: a.id, name: a.name, salesUrl: a.sales_url, instructions: a.instructions || '', status: a.status, createdAt: a.created_at, updatedAt: a.updated_at };
    },

    /**
     * Deletar assistente
     */
    async deleteAssistant(apiKey, assistantId) {
        // First get the assistant to return its data
        const assistant = await this.getAssistantById(apiKey, assistantId);
        if (!assistant) return null;

        const query = USE_POSTGRES
            ? `DELETE FROM tenant_assistants WHERE id = $1 AND api_key = $2`
            : `DELETE FROM tenant_assistants WHERE id = ? AND api_key = ?`;

        await db.query(query, [assistantId, apiKey]);
        return assistant;
    },

    isSchedulingInfrastructureReady,
    getSchedulingInfrastructureError,
    setSchedulingInfrastructureReady,
    runPhase2bMigrations,
    runPhase2c3Migrations,
    checkHistoricalDuplicatesForUniqueIndex
};

module.exports = {
    db,
    initializeDatabase,
    runPhase2bMigrations,
    runPhase2c3Migrations,
    checkHistoricalDuplicatesForUniqueIndex,
    DatabaseHelpers,
    USE_POSTGRES,
    isSchedulingInfrastructureReady,
    getSchedulingInfrastructureError,
    setSchedulingInfrastructureReady
};
