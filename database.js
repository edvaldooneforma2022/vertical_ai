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

                if (text.toLowerCase().includes('select')) {
                    return { rows: sqlite.prepare(sqliteQuery).all(params || []) };
                } else {
                    const info = sqlite.prepare(sqliteQuery).run(params || []);
                    return { rows: [{ id: info.lastInsertRowid }] };
                }
            } catch (error) {
                console.error('❌ Erro no SQLite:', error);
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
}

/**
 * 📊 Estrutura de tabelas PostgreSQL
 */
function getPostgresTables() {
    return [
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

        // 🔗 Tabela de Configurações de Assistentes (Short URLs)
        `CREATE TABLE IF NOT EXISTS assistant_configs (
            id VARCHAR(16) PRIMARY KEY,
            api_key VARCHAR(255) NOT NULL,
            robot_name TEXT NOT NULL,
            sales_url TEXT NOT NULL,
            instructions TEXT,
            primary_color VARCHAR(20) DEFAULT '#3b82f6',
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            access_count INTEGER DEFAULT 0
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
        `CREATE INDEX IF NOT EXISTS idx_assistant_configs_api_key ON assistant_configs(api_key)`
    ];
}

/**
 * 📊 Estrutura de tabelas SQLite
 */
function getSQLiteTables() {
    return [
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

        // 🔗 Tabela de Configurações de Assistentes (Short URLs)
        `CREATE TABLE IF NOT EXISTS assistant_configs (
            id TEXT PRIMARY KEY,
            api_key TEXT NOT NULL,
            robot_name TEXT NOT NULL,
            sales_url TEXT NOT NULL,
            instructions TEXT,
            primary_color TEXT DEFAULT '#3b82f6',
            metadata TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
            access_count INTEGER DEFAULT 0
        )`
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
            ? `SELECT * FROM chatbots WHERE api_key = $1`
            : `SELECT * FROM chatbots WHERE api_key = ?`;

        const parsedDays = parseInt(days, 10);
        if (isNaN(parsedDays) || parsedDays <= 0) {
            throw new Error('Invalid days parameter');
        }
        const result = await db.query(query, [chatbot_id, parsedDays]); const chatbot = result.rows[0];

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
        return result.rows[0];
    },

    /**
     * Buscar todos os leads de um tenant
     */
    async getLeads(apiKey) {
        const query = USE_POSTGRES
            ? `SELECT * FROM tenant_leads WHERE api_key = $1 ORDER BY created_at DESC`
            : `SELECT * FROM tenant_leads WHERE api_key = ? ORDER BY created_at DESC`;

        const result = await db.query(query, [apiKey]);
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

    // ===== 🔗 CRUD para assistant_configs (Short URLs) =====

    /**
     * Gerar ID curto único para short URL
     */
    generateShortId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },

    /**
     * Salvar configuração de assistente e retornar short ID
     */
    async saveAssistantConfig(configData) {
        const shortId = this.generateShortId();

        const query = USE_POSTGRES
            ? `INSERT INTO assistant_configs (id, api_key, robot_name, sales_url, instructions, primary_color, metadata)
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               RETURNING *`
            : `INSERT INTO assistant_configs (id, api_key, robot_name, sales_url, instructions, primary_color, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?)`;

        const params = [
            shortId,
            configData.apiKey || '',
            configData.robotName || 'Assistente IA',
            configData.salesUrl || '',
            configData.instructions || '',
            configData.primaryColor || '#3b82f6',
            JSON.stringify(configData.metadata || {})
        ];

        try {
            const result = await db.query(query, params);
            console.log(`🔗 Configuração de assistente salva: ${shortId}`);
            return { shortId, ...configData };
        } catch (error) {
            // Se ID já existe (raro), tentar novamente
            if (error.message && error.message.includes('UNIQUE')) {
                console.log('⚠️ Colisão de ID, regenerando...');
                return this.saveAssistantConfig(configData);
            }
            throw error;
        }
    },

    /**
     * Buscar configuração por short ID
     */
    async getAssistantConfig(shortId) {
        const query = USE_POSTGRES
            ? `SELECT * FROM assistant_configs WHERE id = $1`
            : `SELECT * FROM assistant_configs WHERE id = ?`;

        const result = await db.query(query, [shortId]);
        const config = result.rows[0];

        if (config) {
            // Atualizar estatísticas de acesso
            this.updateAssistantConfigAccess(shortId);

            if (!USE_POSTGRES && config.metadata) {
                config.metadata = JSON.parse(config.metadata);
            }
        }

        return config;
    },

    /**
     * Atualizar estatísticas de acesso
     */
    async updateAssistantConfigAccess(shortId) {
        const query = USE_POSTGRES
            ? `UPDATE assistant_configs SET last_accessed = CURRENT_TIMESTAMP, access_count = access_count + 1 WHERE id = $1`
            : `UPDATE assistant_configs SET last_accessed = datetime('now'), access_count = access_count + 1 WHERE id = ?`;

        try {
            await db.query(query, [shortId]);
        } catch (error) {
            console.error('⚠️ Erro ao atualizar estatísticas de acesso:', error);
        }
    }
};

module.exports = {
    db,
    initializeDatabase,
    DatabaseHelpers,
    USE_POSTGRES
};
