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

        // Tabela de Leads por Tenant (V3.1 - PostgreSQL)
        `CREATE TABLE IF NOT EXISTS tenant_leads (
            id VARCHAR(255) PRIMARY KEY,
            api_key VARCHAR(255) NOT NULL,
            nome VARCHAR(255),
            email VARCHAR(255),
            telefone VARCHAR(100),
            empresa VARCHAR(255),
            cargo VARCHAR(255),
            origem VARCHAR(255),
            journey_stage VARCHAR(50) DEFAULT 'descoberta',
            status VARCHAR(50) DEFAULT 'ativo',
            conversations JSONB DEFAULT '[]',
            bookings JSONB DEFAULT '[]',
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tabela de Agendamentos por Tenant (V3.1 - PostgreSQL)
        `CREATE TABLE IF NOT EXISTS tenant_appointments (
            id VARCHAR(255) PRIMARY KEY,
            api_key VARCHAR(255) NOT NULL,
            lead_id VARCHAR(255),
            nome VARCHAR(255),
            email VARCHAR(255),
            telefone VARCHAR(100),
            data VARCHAR(50),
            horario VARCHAR(50),
            servico VARCHAR(255),
            observacoes TEXT,
            status VARCHAR(50) DEFAULT 'pendente',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_lead FOREIGN KEY (lead_id) REFERENCES tenant_leads(id) ON DELETE SET NULL
        )`,

        // Índices para performance
        `CREATE INDEX IF NOT EXISTS idx_conversations_chatbot ON conversations(chatbot_id)`,
        `CREATE INDEX IF NOT EXISTS idx_conversations_timestamp ON conversations(timestamp)`,
        `CREATE INDEX IF NOT EXISTS idx_analytics_chatbot_date ON analytics(chatbot_id, date)`,
        `CREATE INDEX IF NOT EXISTS idx_extraction_cache_hash ON extraction_cache(url_hash)`,
        `CREATE INDEX IF NOT EXISTS idx_extraction_cache_expires ON extraction_cache(expires_at)`,
        `CREATE INDEX IF NOT EXISTS idx_tenant_leads_api_key ON tenant_leads(api_key)`,
        `CREATE INDEX IF NOT EXISTS idx_tenant_leads_email ON tenant_leads(email)`,
        `CREATE INDEX IF NOT EXISTS idx_tenant_appointments_api_key ON tenant_appointments(api_key)`,
        `CREATE INDEX IF NOT EXISTS idx_tenant_appointments_lead_id ON tenant_appointments(lead_id)`
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

        // Tabela de Leads por Tenant (V3.1 - SQLite)
        `CREATE TABLE IF NOT EXISTS tenant_leads (
            id TEXT PRIMARY KEY,
            api_key TEXT NOT NULL,
            nome TEXT,
            email TEXT,
            telefone TEXT,
            empresa TEXT,
            cargo TEXT,
            origem TEXT,
            journey_stage TEXT DEFAULT 'descoberta',
            status TEXT DEFAULT 'ativo',
            conversations TEXT DEFAULT '[]',
            bookings TEXT DEFAULT '[]',
            metadata TEXT DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_interaction DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,

        // Tabela de Agendamentos por Tenant (V3.1 - SQLite)
        `CREATE TABLE IF NOT EXISTS tenant_appointments (
            id TEXT PRIMARY KEY,
            api_key TEXT NOT NULL,
            lead_id TEXT,
            nome TEXT,
            email TEXT,
            telefone TEXT,
            data TEXT,
            horario TEXT,
            servico TEXT,
            observacoes TEXT,
            status TEXT DEFAULT 'pendente',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lead_id) REFERENCES tenant_leads(id) ON DELETE SET NULL
        )`
    ];
}

/**
 * 🔍 Funções auxiliares para queries
 */
const DatabaseHelpers = {
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

    // =====================================================
    // 📋 MÉTODOS CRUD PARA LEADS (V3.1)
    // =====================================================

    /**
     * Salvar ou atualizar lead
     */
    async saveLead(apiKey, leadData) {
        const { id, nome, email, telefone, empresa, cargo, origem, journey_stage, status, conversations, bookings, metadata } = leadData;

        const query = USE_POSTGRES
            ? `INSERT INTO tenant_leads (id, api_key, nome, email, telefone, empresa, cargo, origem, journey_stage, status, conversations, bookings, metadata, last_interaction)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
               ON CONFLICT (id) DO UPDATE SET
                   nome = $3, email = $4, telefone = $5, empresa = $6, cargo = $7, origem = $8,
                   journey_stage = $9, status = $10, conversations = $11, bookings = $12, 
                   metadata = $13, last_interaction = CURRENT_TIMESTAMP
               RETURNING *`
            : `INSERT OR REPLACE INTO tenant_leads (id, api_key, nome, email, telefone, empresa, cargo, origem, journey_stage, status, conversations, bookings, metadata, last_interaction)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;

        const params = [
            id,
            apiKey,
            nome || null,
            email || null,
            telefone || null,
            empresa || null,
            cargo || null,
            origem || null,
            journey_stage || 'descoberta',
            status || 'ativo',
            JSON.stringify(conversations || []),
            JSON.stringify(bookings || []),
            JSON.stringify(metadata || {})
        ];

        try {
            const result = await db.query(query, params);
            console.log(`✅ Lead salvo no banco: ${id}`);
            return result.rows[0] || { id };
        } catch (error) {
            console.error('❌ Erro ao salvar lead no banco:', error);
            throw error;
        }
    },

    /**
     * Buscar todos os leads por API key
     */
    async getLeadsByApiKey(apiKey) {
        const query = USE_POSTGRES
            ? `SELECT * FROM tenant_leads WHERE api_key = $1 ORDER BY last_interaction DESC`
            : `SELECT * FROM tenant_leads WHERE api_key = ? ORDER BY last_interaction DESC`;

        try {
            const result = await db.query(query, [apiKey]);
            return result.rows.map(lead => {
                if (!USE_POSTGRES) {
                    lead.conversations = JSON.parse(lead.conversations || '[]');
                    lead.bookings = JSON.parse(lead.bookings || '[]');
                    lead.metadata = JSON.parse(lead.metadata || '{}');
                }
                return lead;
            });
        } catch (error) {
            console.error('❌ Erro ao buscar leads:', error);
            return [];
        }
    },

    /**
     * Buscar lead por ID
     */
    async getLeadById(apiKey, leadId) {
        const query = USE_POSTGRES
            ? `SELECT * FROM tenant_leads WHERE api_key = $1 AND id = $2`
            : `SELECT * FROM tenant_leads WHERE api_key = ? AND id = ?`;

        try {
            const result = await db.query(query, [apiKey, leadId]);
            if (result.rows.length === 0) return null;

            const lead = result.rows[0];
            if (!USE_POSTGRES) {
                lead.conversations = JSON.parse(lead.conversations || '[]');
                lead.bookings = JSON.parse(lead.bookings || '[]');
                lead.metadata = JSON.parse(lead.metadata || '{}');
            }
            return lead;
        } catch (error) {
            console.error('❌ Erro ao buscar lead por ID:', error);
            return null;
        }
    },

    /**
     * Buscar lead por email
     */
    async getLeadByEmail(apiKey, email) {
        const query = USE_POSTGRES
            ? `SELECT * FROM tenant_leads WHERE api_key = $1 AND email = $2`
            : `SELECT * FROM tenant_leads WHERE api_key = ? AND email = ?`;

        try {
            const result = await db.query(query, [apiKey, email]);
            if (result.rows.length === 0) return null;

            const lead = result.rows[0];
            if (!USE_POSTGRES) {
                lead.conversations = JSON.parse(lead.conversations || '[]');
                lead.bookings = JSON.parse(lead.bookings || '[]');
                lead.metadata = JSON.parse(lead.metadata || '{}');
            }
            return lead;
        } catch (error) {
            console.error('❌ Erro ao buscar lead por email:', error);
            return null;
        }
    },

    /**
     * Atualizar lead
     */
    async updateLead(apiKey, leadId, updates) {
        // Primeiro buscar o lead existente
        const existingLead = await this.getLeadById(apiKey, leadId);
        if (!existingLead) {
            console.error('❌ Lead não encontrado para atualização:', leadId);
            return null;
        }

        // Mesclar atualizações
        const updatedLead = { ...existingLead, ...updates, id: leadId };
        return await this.saveLead(apiKey, updatedLead);
    },

    /**
     * Deletar lead
     */
    async deleteLead(apiKey, leadId) {
        const query = USE_POSTGRES
            ? `DELETE FROM tenant_leads WHERE api_key = $1 AND id = $2`
            : `DELETE FROM tenant_leads WHERE api_key = ? AND id = ?`;

        try {
            await db.query(query, [apiKey, leadId]);
            console.log(`🗑️ Lead deletado: ${leadId}`);
            return true;
        } catch (error) {
            console.error('❌ Erro ao deletar lead:', error);
            return false;
        }
    },

    // =====================================================
    // 📅 MÉTODOS CRUD PARA AGENDAMENTOS (V3.1)
    // =====================================================

    /**
     * Salvar agendamento
     */
    async saveAppointment(apiKey, appointmentData) {
        const { id, lead_id, nome, email, telefone, data, horario, servico, observacoes, status } = appointmentData;

        const query = USE_POSTGRES
            ? `INSERT INTO tenant_appointments (id, api_key, lead_id, nome, email, telefone, data, horario, servico, observacoes, status)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (id) DO UPDATE SET
                   lead_id = $3, nome = $4, email = $5, telefone = $6, data = $7, 
                   horario = $8, servico = $9, observacoes = $10, status = $11
               RETURNING *`
            : `INSERT OR REPLACE INTO tenant_appointments (id, api_key, lead_id, nome, email, telefone, data, horario, servico, observacoes, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const params = [
            id,
            apiKey,
            lead_id || null,
            nome || null,
            email || null,
            telefone || null,
            data || null,
            horario || null,
            servico || null,
            observacoes || null,
            status || 'pendente'
        ];

        try {
            const result = await db.query(query, params);
            console.log(`✅ Agendamento salvo no banco: ${id}`);
            return result.rows[0] || { id };
        } catch (error) {
            console.error('❌ Erro ao salvar agendamento:', error);
            throw error;
        }
    },

    /**
     * Buscar agendamentos por API key
     */
    async getAppointmentsByApiKey(apiKey) {
        const query = USE_POSTGRES
            ? `SELECT * FROM tenant_appointments WHERE api_key = $1 ORDER BY created_at DESC`
            : `SELECT * FROM tenant_appointments WHERE api_key = ? ORDER BY created_at DESC`;

        try {
            const result = await db.query(query, [apiKey]);
            return result.rows;
        } catch (error) {
            console.error('❌ Erro ao buscar agendamentos:', error);
            return [];
        }
    },

    /**
     * Buscar agendamentos por lead
     */
    async getAppointmentsByLeadId(apiKey, leadId) {
        const query = USE_POSTGRES
            ? `SELECT * FROM tenant_appointments WHERE api_key = $1 AND lead_id = $2 ORDER BY created_at DESC`
            : `SELECT * FROM tenant_appointments WHERE api_key = ? AND lead_id = ? ORDER BY created_at DESC`;

        try {
            const result = await db.query(query, [apiKey, leadId]);
            return result.rows;
        } catch (error) {
            console.error('❌ Erro ao buscar agendamentos por lead:', error);
            return [];
        }
    },

    /**
     * Atualizar status do agendamento
     */
    async updateAppointmentStatus(apiKey, appointmentId, newStatus) {
        const query = USE_POSTGRES
            ? `UPDATE tenant_appointments SET status = $3 WHERE api_key = $1 AND id = $2`
            : `UPDATE tenant_appointments SET status = ? WHERE api_key = ? AND id = ?`;

        const params = USE_POSTGRES
            ? [apiKey, appointmentId, newStatus]
            : [newStatus, apiKey, appointmentId];

        try {
            await db.query(query, params);
            console.log(`✅ Status do agendamento atualizado: ${appointmentId} -> ${newStatus}`);
            return true;
        } catch (error) {
            console.error('❌ Erro ao atualizar status do agendamento:', error);
            return false;
        }
    }
};

module.exports = {
    db,
    initializeDatabase,
    DatabaseHelpers,
    USE_POSTGRES
};
