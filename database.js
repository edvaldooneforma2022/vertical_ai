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
        `CREATE INDEX IF NOT EXISTS idx_tenant_blocked_dates_tenant ON tenant_blocked_dates(tenant_id)`
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
            JSON.stringify(extracted_data),
            JSON.stringify(config),
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
            JSON.stringify(messages),
            user_satisfaction,
            resolved ? 1 : 0,
            lead_captured ? 1 : 0,
            JSON.stringify(metadata || {})
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
            JSON.stringify(extractedData),
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
     * Salvar lead no PostgreSQL/SQLite
     */
    async saveLead(apiKey, leadData) {
        const query = USE_POSTGRES
            ? `INSERT INTO tenant_leads (id, api_key, nome, email, telefone, message, url_origem, source, status, metadata, conversations)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (id) DO UPDATE SET
                   nome = $3, email = $4, telefone = $5, message = $6, 
                   url_origem = $7, status = $9, metadata = $10, conversations = $11,
                   updated_at = CURRENT_TIMESTAMP
               RETURNING *`
            : `INSERT OR REPLACE INTO tenant_leads (id, api_key, nome, email, telefone, message, url_origem, source, status, metadata, conversations, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

        const params = [
            leadData.id,
            apiKey,
            leadData.nome || null,
            leadData.email || null,
            leadData.telefone || null,
            leadData.message || null,
            leadData.url_origem || null,
            leadData.source || 'widget',
            leadData.status || 'novo',
            JSON.stringify(leadData.metadata || {}),
            JSON.stringify(leadData.conversations || [])
        ];

        const result = await db.query(query, params);
        const savedLead = result.rows ? result.rows[0] : null;

        // ===== HOOK: CRM SYNC (non-blocking, lazy require) =====
        // Sincronizar lead no CRM sem bloquear a resposta ao usuário
        setImmediate(async () => {
            try {
                const { crmManager } = require('./lib/crm/index');
                // Buscar tenant_uuid a partir da api_key para garantir UUID no CRM
                let tenantId = null;
                if (USE_POSTGRES) {
                    const akResult = await db.query(`SELECT tenant_uuid FROM api_keys WHERE key_hash = $1 LIMIT 1`, [
                        require('crypto').createHash('sha256').update(apiKey).digest('hex')
                    ]);
                    const row = (akResult.rows || akResult)[0];
                    tenantId = row?.tenant_uuid?.toString() || null;
                }
                // Fallback: buscar direto em tenants pela api_key legacy
                if (!tenantId) {
                    const tResult = USE_POSTGRES
                        ? await db.query(`SELECT t.id FROM tenants t JOIN api_keys ak ON ak.tenant_uuid = t.id WHERE ak.key_hash = $1 LIMIT 1`, [
                            require('crypto').createHash('sha256').update(apiKey).digest('hex')
                        ])
                        : await db.query(`SELECT tenant_uuid FROM tenant_leads WHERE api_key = ? LIMIT 1`, [apiKey]);
                    const tRow = ((tResult.rows || tResult)[0]);
                    tenantId = tRow?.id || tRow?.tenant_uuid || null;
                }

                if (tenantId) {
                    await crmManager.syncLeadToCRM(tenantId, {
                        id: leadData.id,
                        nome: leadData.nome,
                        email: leadData.email,
                        telefone: leadData.telefone,
                        url_origem: leadData.url_origem,
                        source: leadData.source
                    });
                }
            } catch (crmErr) {
                // CRM sync falhou — não impacta o salvamento do lead
                // Usar POST /api/crm/sync-leads para re-sync manual
                if (process.env.NODE_ENV !== 'test') {
                    console.warn('⚠️ [CRM-HOOK] Sync não executado:', crmErr.message);
                }
            }
        });
        // ===== FIM DO HOOK CRM SYNC =====

        return savedLead;
    },

    /**
     * Buscar todos os leads de um tenant
     */
    async getLeads(apiKey) {
        const query = USE_POSTGRES
            ? `SELECT * FROM tenant_leads WHERE api_key = $1 OR tenant_uuid::text = $1 ORDER BY created_at DESC`
            : `SELECT * FROM tenant_leads WHERE api_key = ? OR tenant_uuid = ? ORDER BY created_at DESC`;

        const params = USE_POSTGRES ? [apiKey] : [apiKey, apiKey];
        const result = await db.query(query, params);
        return result.rows.map(lead => {
            if (!USE_POSTGRES) {
                lead.metadata = JSON.parse(lead.metadata || '{}');
                lead.conversations = JSON.parse(lead.conversations || '[]');
            }
            return lead;
        });
    },

    /**
     * Buscar lead por ID
     */
    async getLeadById(apiKey, leadId) {
        const query = USE_POSTGRES
            ? `SELECT * FROM tenant_leads WHERE api_key = $1 AND id = $2`
            : `SELECT * FROM tenant_leads WHERE api_key = ? AND id = ?`;

        const result = await db.query(query, [apiKey, leadId]);
        const lead = result.rows[0];

        if (lead && !USE_POSTGRES) {
            lead.metadata = JSON.parse(lead.metadata || '{}');
            lead.conversations = JSON.parse(lead.conversations || '[]');
        }

        return lead;
    },

    /**
     * Atualizar lead
     */
    async updateLead(apiKey, leadId, data) {
        const query = USE_POSTGRES
            ? `UPDATE tenant_leads SET 
                nome = COALESCE($3, nome),
                email = COALESCE($4, email),
                telefone = COALESCE($5, telefone),
                status = COALESCE($6, status),
                metadata = COALESCE($7, metadata),
                conversations = COALESCE($8, conversations),
                updated_at = CURRENT_TIMESTAMP
               WHERE api_key = $1 AND id = $2
               RETURNING *`
            : `UPDATE tenant_leads SET 
                nome = COALESCE(?, nome),
                email = COALESCE(?, email),
                telefone = COALESCE(?, telefone),
                status = COALESCE(?, status),
                metadata = COALESCE(?, metadata),
                conversations = COALESCE(?, conversations),
                updated_at = datetime('now')
               WHERE api_key = ? AND id = ?`;

        const params = USE_POSTGRES
            ? [
                apiKey, leadId,
                data.nome, data.email, data.telefone, data.status,
                data.metadata ? JSON.stringify(data.metadata) : null,
                data.conversations ? JSON.stringify(data.conversations) : null
            ]
            : [
                data.nome, data.email, data.telefone, data.status,
                data.metadata ? JSON.stringify(data.metadata) : null,
                data.conversations ? JSON.stringify(data.conversations) : null,
                apiKey, leadId
            ];

        const result = await db.query(query, params);
        return result.rows[0];
    },

    // ===== CRUD para tenant_appointments =====

    /**
     * Salvar agendamento no PostgreSQL/SQLite
     */
    async saveAppointment(apiKey, appointmentData) {
        const query = USE_POSTGRES
            ? `INSERT INTO tenant_appointments (id, api_key, lead_id, datetime, status, notes, metadata)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (id) DO UPDATE SET
                   datetime = $4, status = $5, notes = $6, metadata = $7,
                   updated_at = CURRENT_TIMESTAMP
               RETURNING *`
            : `INSERT OR REPLACE INTO tenant_appointments (id, api_key, lead_id, datetime, status, notes, metadata, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

        const params = [
            appointmentData.id,
            apiKey,
            appointmentData.leadId || null,
            appointmentData.datetime || null,
            appointmentData.status || 'pendente',
            appointmentData.notes || null,
            JSON.stringify(appointmentData.metadata || {})
        ];

        const result = await db.query(query, params);
        return result.rows[0];
    },

    /**
     * Buscar todos os agendamentos de um tenant
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
            JSON.stringify(shortUrlData.metadata || {})
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
        const query = USE_POSTGRES
            ? `INSERT INTO whatsapp_settings (
                   api_key, provider, twilio_account_sid, twilio_auth_token, 
                   twilio_from_number, evolution_api_url, evolution_api_key,
                   evolution_instance_name, notification_phone, is_active
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               ON CONFLICT (api_key) DO UPDATE SET
                   provider = $2, twilio_account_sid = $3, twilio_auth_token = $4,
                   twilio_from_number = $5, evolution_api_url = $6, 
                   evolution_api_key = $7, evolution_instance_name = $8,
                   notification_phone = $9, is_active = $10,
                   updated_at = CURRENT_TIMESTAMP
               RETURNING *`
            : `INSERT OR REPLACE INTO whatsapp_settings (
                   api_key, provider, twilio_account_sid, twilio_auth_token,
                   twilio_from_number, evolution_api_url, evolution_api_key,
                   evolution_instance_name, notification_phone, is_active,
                   updated_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

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
            settings.isActive !== undefined ? settings.isActive : true
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
            JSON.stringify(metadata || {})
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
    }
};

module.exports = {
    db,
    initializeDatabase,
    DatabaseHelpers,
    USE_POSTGRES
};
