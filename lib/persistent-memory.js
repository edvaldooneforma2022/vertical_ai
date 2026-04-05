/**
 * 🧠 SISTEMA DE MEMÓRIA PERSISTENTE - Link Mágico V8.0
 * 
 * Salva memória conversacional no banco de dados
 * Substitui Map() in-memory com persistência real
 * 
 * SEGURANÇA:
 * - Feature flag controlável
 * - Fallback automático para Map() se banco falhar
 * - TTL para expiração automática
 * 
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

class PersistentMemoryManager {
    constructor() {
        this.enabled = false;
        this.db = null;
        this.dbInitialized = false;
        this.memoryCache = new Map(); // Cache local para performance
        this.defaultTTL = 24 * 60 * 60 * 1000; // 24 horas em ms

        console.log('🧠 Sistema de Memória Persistente inicializando...');
    }

    /**
     * Inicializa o sistema de memória persistente
     */
    async initialize(database) {
        try {
            // Verificar se feature está habilitada
            let featureFlags;
            try {
                featureFlags = require('./feature-flags').featureFlags;
                this.enabled = featureFlags.isEnabled('FEATURE_PERSISTENT_MEMORY');
            } catch (e) {
                this.enabled = process.env.FEATURE_PERSISTENT_MEMORY === 'true';
            }

            if (!this.enabled) {
                console.log('🧠 Memória Persistente desabilitada (usando Map local)');
                return;
            }

            if (database) {
                this.db = database;
                await this._initializeDatabase();
            }

            console.log('✅ Memória Persistente habilitada');

        } catch (error) {
            console.error('⚠️ Erro ao inicializar Memória Persistente (usando fallback):', error.message);
            this.enabled = false;
        }
    }

    /**
     * Cria tabela de memória no banco
     */
    async _initializeDatabase() {
        if (!this.db || this.dbInitialized) return;

        try {
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS conversation_memory (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    tenant_id TEXT,
                    memory_type TEXT DEFAULT 'conversation',
                    
                    -- Dados da memória
                    preferences TEXT,
                    interaction_history TEXT,
                    emotional_profile TEXT,
                    topics_discussed TEXT,
                    
                    -- Estatísticas
                    total_interactions INTEGER DEFAULT 0,
                    avg_sentiment REAL DEFAULT 0,
                    last_emotion TEXT,
                    
                    -- Metadados
                    session_data TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP,
                    
                    UNIQUE(user_id, tenant_id)
                )
            `;

            await this.db.run(createTableQuery);

            // Índices para consultas eficientes
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_memory_user ON conversation_memory(user_id)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_memory_tenant ON conversation_memory(tenant_id)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_memory_expires ON conversation_memory(expires_at)');

            this.dbInitialized = true;
            console.log('✅ Tabela conversation_memory criada/verificada');

        } catch (error) {
            console.error('⚠️ Erro ao criar tabela conversation_memory:', error.message);
            throw error;
        }
    }

    /**
     * Salva memória do usuário
     * 
     * @param {string} userId - ID do usuário
     * @param {Object} memoria - Dados da memória
     * @param {string} [tenantId] - ID do tenant
     * @returns {boolean} Sucesso
     */
    async save(userId, memoria, tenantId = null) {
        // Sempre salvar no cache local primeiro
        const cacheKey = this._getCacheKey(userId, tenantId);
        this.memoryCache.set(cacheKey, {
            ...memoria,
            updatedAt: new Date().toISOString()
        });

        // Se não habilitado ou banco não disponível, retorna após cache
        if (!this.enabled || !this.db || !this.dbInitialized) {
            return true;
        }

        try {
            const id = `mem_${userId}_${tenantId || 'global'}`;
            const expiresAt = new Date(Date.now() + this.defaultTTL).toISOString();

            const query = `
                INSERT INTO conversation_memory (
                    id, user_id, tenant_id,
                    preferences, interaction_history, emotional_profile, topics_discussed,
                    total_interactions, avg_sentiment, last_emotion,
                    session_data, updated_at, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
                ON CONFLICT(id) DO UPDATE SET
                    user_id = EXCLUDED.user_id,
                    tenant_id = EXCLUDED.tenant_id,
                    preferences = EXCLUDED.preferences,
                    interaction_history = EXCLUDED.interaction_history,
                    emotional_profile = EXCLUDED.emotional_profile,
                    topics_discussed = EXCLUDED.topics_discussed,
                    total_interactions = EXCLUDED.total_interactions,
                    avg_sentiment = EXCLUDED.avg_sentiment,
                    last_emotion = EXCLUDED.last_emotion,
                    session_data = EXCLUDED.session_data,
                    updated_at = CURRENT_TIMESTAMP,
                    expires_at = EXCLUDED.expires_at
            `;

            await this.db.run(query, [
                id,
                userId,
                tenantId,
                JSON.stringify(memoria.preferencias || {}),
                JSON.stringify(memoria.historicoInteracoes || []),
                JSON.stringify(memoria.perfilEmocional || {}),
                JSON.stringify(memoria.topicosDiscutidos || []),
                memoria.totalInteracoes || 1,
                memoria.sentimentoMedio || 0,
                memoria.emocaoAtual || 'neutro',
                JSON.stringify(memoria.sessao || {}),
                expiresAt
            ]);

            return true;

        } catch (error) {
            console.error('⚠️ Erro ao salvar memória (usando cache local):', error.message);
            // Não propaga erro - cache local já tem os dados
            return true;
        }
    }

    /**
     * Carrega memória do usuário
     * 
     * @param {string} userId - ID do usuário
     * @param {string} [tenantId] - ID do tenant
     * @returns {Object|null} Dados da memória ou null
     */
    async load(userId, tenantId = null) {
        const cacheKey = this._getCacheKey(userId, tenantId);

        // Verificar cache local primeiro
        if (this.memoryCache.has(cacheKey)) {
            return this.memoryCache.get(cacheKey);
        }

        // Se não habilitado ou banco não disponível, retorna null
        if (!this.enabled || !this.db || !this.dbInitialized) {
            return null;
        }

        try {
            const query = `
                SELECT * FROM conversation_memory 
                WHERE user_id = ? AND (tenant_id = ? OR tenant_id IS NULL)
                AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
                ORDER BY tenant_id DESC NULLS LAST
                LIMIT 1
            `;

            const row = await this.db.get(query, [userId, tenantId]);

            if (!row) return null;

            const memoria = {
                preferencias: JSON.parse(row.preferences || '{}'),
                historicoInteracoes: JSON.parse(row.interaction_history || '[]'),
                perfilEmocional: JSON.parse(row.emotional_profile || '{}'),
                topicosDiscutidos: JSON.parse(row.topics_discussed || '[]'),
                totalInteracoes: row.total_interactions || 0,
                sentimentoMedio: row.avg_sentiment || 0,
                emocaoAtual: row.last_emotion || 'neutro',
                sessao: JSON.parse(row.session_data || '{}'),
                createdAt: row.created_at,
                updatedAt: row.updated_at
            };

            // Salvar no cache
            this.memoryCache.set(cacheKey, memoria);

            return memoria;

        } catch (error) {
            console.error('⚠️ Erro ao carregar memória:', error.message);
            return null;
        }
    }

    /**
     * Atualiza memória do usuário com nova interação
     * 
     * @param {string} userId - ID do usuário
     * @param {Object} interacao - Dados da nova interação
     * @param {string} [tenantId] - ID do tenant
     */
    async update(userId, interacao, tenantId = null) {
        // Carregar memória existente
        let memoria = await this.load(userId, tenantId) || this._createEmptyMemory();

        // Atualizar com nova interação
        memoria.historicoInteracoes.push({
            timestamp: new Date().toISOString(),
            mensagem: interacao.mensagem?.substring(0, 500), // Limitar tamanho
            emocao: interacao.emocao,
            intencoes: interacao.intencoes
        });

        // Manter apenas últimas 50 interações
        if (memoria.historicoInteracoes.length > 50) {
            memoria.historicoInteracoes = memoria.historicoInteracoes.slice(-50);
        }

        // Atualizar estatísticas
        memoria.totalInteracoes = (memoria.totalInteracoes || 0) + 1;
        memoria.emocaoAtual = interacao.emocao || memoria.emocaoAtual;

        // Atualizar perfil emocional
        if (interacao.emocao) {
            memoria.perfilEmocional[interacao.emocao] =
                (memoria.perfilEmocional[interacao.emocao] || 0) + 1;
        }

        // Detectar tópicos da mensagem
        if (interacao.topicos) {
            interacao.topicos.forEach(topico => {
                if (!memoria.topicosDiscutidos.includes(topico)) {
                    memoria.topicosDiscutidos.push(topico);
                }
            });
        }

        // Atualizar preferências detectadas
        if (interacao.preferencias) {
            memoria.preferencias = {
                ...memoria.preferencias,
                ...interacao.preferencias
            };
        }

        // Salvar
        await this.save(userId, memoria, tenantId);

        return memoria;
    }

    /**
     * Cria estrutura vazia de memória
     */
    _createEmptyMemory() {
        return {
            preferencias: {},
            historicoInteracoes: [],
            perfilEmocional: {},
            topicosDiscutidos: [],
            totalInteracoes: 0,
            sentimentoMedio: 0,
            emocaoAtual: 'neutro',
            sessao: {},
            createdAt: new Date().toISOString()
        };
    }

    /**
     * Gera chave de cache
     */
    _getCacheKey(userId, tenantId) {
        return `${tenantId || 'global'}:${userId}`;
    }

    /**
     * Limpa memórias expiradas
     */
    async cleanup() {
        if (!this.enabled || !this.db || !this.dbInitialized) return;

        try {
            const result = await this.db.run(`
                DELETE FROM conversation_memory 
                WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP
            `);

            console.log(`🧹 Memórias expiradas removidas: ${result?.changes || 0}`);

        } catch (error) {
            console.error('⚠️ Erro ao limpar memórias expiradas:', error.message);
        }
    }

    /**
     * Obtém estatísticas de memória
     */
    async getStats(tenantId = null) {
        const stats = {
            cacheSize: this.memoryCache.size,
            enabled: this.enabled,
            dbConnected: this.dbInitialized
        };

        if (this.enabled && this.db && this.dbInitialized) {
            try {
                const query = tenantId
                    ? 'SELECT COUNT(*) as total FROM conversation_memory WHERE tenant_id = ?'
                    : 'SELECT COUNT(*) as total FROM conversation_memory';

                const result = await this.db.get(query, tenantId ? [tenantId] : []);
                stats.totalMemories = result?.total || 0;

            } catch (error) {
                stats.dbError = error.message;
            }
        }

        return stats;
    }
}

// Singleton instance
const persistentMemory = new PersistentMemoryManager();

module.exports = {
    persistentMemory,
    PersistentMemoryManager
};
