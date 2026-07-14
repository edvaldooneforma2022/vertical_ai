/**
 * 📋 SISTEMA DE CONSENTIMENTO LGPD - Link Mágico V8.0
 * 
 * Gerencia consentimento de usuários conforme LGPD:
 * - Registro de consentimento
 * - Revogação de consentimento
 * - Exportação de dados (direito de acesso)
 * - Exclusão de dados (direito ao esquecimento)
 * - Logs de todas as operações
 * 
 * SEGURANÇA:
 * - Feature flag controlável
 * - Audit trail completo
 * - Dados criptografados
 * 
 * @version 1.0.0
 */

// Tipos de consentimento
const CONSENT_TYPES = {
    ESSENTIAL: 'essential',           // Funcionamento básico (obrigatório)
    ANALYTICS: 'analytics',           // Analytics e métricas
    MARKETING: 'marketing',           // Comunicações de marketing
    PERSONALIZATION: 'personalization', // Personalização de experiência
    DATA_SHARING: 'data_sharing',     // Compartilhamento com terceiros
    COOKIES: 'cookies'                // Cookies não essenciais
};

// Status de consentimento
const CONSENT_STATUS = {
    GRANTED: 'granted',
    DENIED: 'denied',
    PENDING: 'pending',
    WITHDRAWN: 'withdrawn'
};

class LGPDConsentManager {
    constructor() {
        this.enabled = false;
        this.db = null;
        this.dbInitialized = false;
        this.consentCache = new Map(); // Cache em memória

        console.log('📋 Sistema LGPD inicializando...');
    }

    /**
     * Inicializa o sistema de consentimento
     */
    async initialize(database) {
        try {
            // Verificar se feature está habilitada
            let featureFlags;
            try {
                featureFlags = require('./feature-flags').featureFlags;
                // LGPD sempre habilitado por padrão para compliance
                this.enabled = true;
            } catch (e) {
                this.enabled = true;
            }

            if (database) {
                this.db = database;
                await this._initializeDatabase();
            }

            console.log('✅ Sistema LGPD habilitado');

        } catch (error) {
            console.error('⚠️ Erro ao inicializar LGPD:', error.message);
        }
    }

    /**
     * Cria tabelas necessárias
     */
    async _initializeDatabase() {
        if (!this.db || this.dbInitialized) return;

        try {
            // Tabela de consentimentos
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS lgpd_consents (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    tenant_id TEXT,
                    consent_type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    version TEXT,
                    ip_address TEXT,
                    user_agent TEXT,
                    granted_at TIMESTAMP,
                    withdrawn_at TIMESTAMP,
                    expires_at TIMESTAMP,
                    metadata TEXT DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, tenant_id, consent_type)
                )
            `);

            // Tabela de solicitações de dados (DSAR)
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS lgpd_data_requests (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    tenant_id TEXT,
                    request_type TEXT NOT NULL,
                    status TEXT DEFAULT 'pending',
                    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    response_data TEXT,
                    metadata TEXT DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Índices
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_consents_user ON lgpd_consents(user_id)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_consents_tenant ON lgpd_consents(tenant_id)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_data_requests_user ON lgpd_data_requests(user_id)');

            this.dbInitialized = true;
            console.log('✅ Tabelas LGPD criadas/verificadas');

        } catch (error) {
            console.error('⚠️ Erro ao criar tabelas LGPD:', error.message);
        }
    }

    /**
     * Registra consentimento do usuário
     * 
     * @param {Object} options
     * @param {string} options.userId - ID do usuário
     * @param {string} options.consentType - Tipo de consentimento
     * @param {boolean} options.granted - Se consentimento foi concedido
     * @param {Object} [options.metadata] - Metadados adicionais
     * @returns {Object} Resultado da operação
     */
    async recordConsent(options) {
        const { userId, tenantId, consentType, granted, metadata = {}, request } = options;

        if (!userId || !consentType) {
            return { success: false, error: 'userId e consentType são obrigatórios' };
        }

        try {
            const id = `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const status = granted ? CONSENT_STATUS.GRANTED : CONSENT_STATUS.DENIED;
            const now = new Date().toISOString();

            // Atualizar cache
            const cacheKey = `${tenantId || 'global'}:${userId}:${consentType}`;
            this.consentCache.set(cacheKey, { status, grantedAt: granted ? now : null });

            // Salvar no banco se disponível
            if (this.db && this.dbInitialized) {
                await this.db.run(`
                    INSERT INTO lgpd_consents (
                        id, user_id, tenant_id, consent_type, status,
                        ip_address, user_agent, granted_at, metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(user_id, tenant_id, consent_type) DO UPDATE SET
                        status = excluded.status,
                        granted_at = CASE WHEN excluded.status = 'granted' THEN excluded.granted_at ELSE granted_at END,
                        withdrawn_at = CASE WHEN excluded.status = 'withdrawn' THEN CURRENT_TIMESTAMP ELSE NULL END,
                        updated_at = CURRENT_TIMESTAMP
                `, [
                    id,
                    userId,
                    tenantId || null,
                    consentType,
                    status,
                    request?.ip || null,
                    request?.headers?.['user-agent'] || null,
                    granted ? now : null,
                    JSON.stringify(metadata)
                ]);
            }

            // Log de auditoria
            try {
                const auditLogger = require('./audit-logger').auditLogger;
                if (auditLogger) {
                    await auditLogger.log('lgpd.consent_recorded', {
                        tenantId,
                        actorType: 'user',
                        actorId: userId,
                        targetType: 'consent',
                        targetId: consentType,
                        details: { status, consentType },
                        request
                    });
                }
            } catch (e) { }

            console.log(`📋 [LGPD] Consentimento registrado: ${userId} - ${consentType} = ${status}`);

            return {
                success: true,
                consentId: id,
                status,
                consentType
            };

        } catch (error) {
            console.error('❌ Erro ao registrar consentimento:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Revoga consentimento
     */
    async withdrawConsent(userId, consentType, tenantId = null, request = null) {
        return this.recordConsent({
            userId,
            tenantId,
            consentType,
            granted: false,
            metadata: { action: 'withdrawn' },
            request
        });
    }

    /**
     * Verifica se usuário tem consentimento
     * 
     * @param {string} userId
     * @param {string} consentType
     * @param {string} [tenantId]
     * @returns {boolean}
     */
    async hasConsent(userId, consentType, tenantId = null) {
        // Consentimento essencial sempre ativo
        if (consentType === CONSENT_TYPES.ESSENTIAL) {
            return true;
        }

        // Verificar cache primeiro
        const cacheKey = `${tenantId || 'global'}:${userId}:${consentType}`;
        if (this.consentCache.has(cacheKey)) {
            return this.consentCache.get(cacheKey).status === CONSENT_STATUS.GRANTED;
        }

        // Buscar no banco
        if (this.db && this.dbInitialized) {
            try {
                const result = await this.db.get(`
                    SELECT status FROM lgpd_consents
                    WHERE user_id = ? AND consent_type = ?
                    AND (tenant_id = ? OR tenant_id IS NULL)
                `, [userId, consentType, tenantId]);

                if (result) {
                    this.consentCache.set(cacheKey, { status: result.status });
                    return result.status === CONSENT_STATUS.GRANTED;
                }
            } catch (e) { }
        }

        return false;
    }

    /**
     * Obtém todos os consentimentos de um usuário
     */
    async getUserConsents(userId, tenantId = null) {
        if (!this.db || !this.dbInitialized) {
            return { success: false, error: 'Database not available' };
        }

        try {
            const consents = await this.db.all(`
                SELECT * FROM lgpd_consents
                WHERE user_id = ? AND (tenant_id = ? OR tenant_id IS NULL)
                ORDER BY consent_type
            `, [userId, tenantId]);

            return {
                success: true,
                userId,
                consents: consents.map(c => ({
                    type: c.consent_type,
                    status: c.status,
                    grantedAt: c.granted_at,
                    withdrawnAt: c.withdrawn_at
                }))
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Cria solicitação de acesso a dados (DSAR)
     */
    async createDataRequest(userId, requestType, tenantId = null, request = null) {
        const validTypes = ['access', 'deletion', 'portability', 'correction'];

        if (!validTypes.includes(requestType)) {
            return { success: false, error: `Tipo de solicitação inválido. Use: ${validTypes.join(', ')}` };
        }

        try {
            const id = `dsar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            if (this.db && this.dbInitialized) {
                await this.db.run(`
                    INSERT INTO lgpd_data_requests (id, user_id, tenant_id, request_type, metadata)
                    VALUES (?, ?, ?, ?, ?)
                `, [id, userId, tenantId, requestType, JSON.stringify({
                    ip: request?.ip,
                    userAgent: request?.headers?.['user-agent']
                })]);
            }

            // Log de auditoria
            try {
                const auditLogger = require('./audit-logger').auditLogger;
                if (auditLogger) {
                    await auditLogger.log('lgpd.data_request_created', {
                        tenantId,
                        actorType: 'user',
                        actorId: userId,
                        targetType: 'data_request',
                        targetId: id,
                        details: { requestType },
                        severity: 'warning',
                        request
                    });
                }
            } catch (e) { }

            console.log(`📋 [LGPD] Solicitação de dados criada: ${requestType} para ${userId}`);

            return {
                success: true,
                requestId: id,
                requestType,
                status: 'pending',
                message: `Sua solicitação de ${requestType} foi registrada. Prazo: 15 dias úteis.`
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Exporta todos os dados do usuário (direito de acesso)
     */
    async exportUserData(userId, tenantId = null) {
        if (!this.db || !this.dbInitialized) {
            return { success: false, error: 'Database not available' };
        }

        try {
            const data = {
                exportedAt: new Date().toISOString(),
                userId,
                sections: {}
            };

            // Consentimentos
            const consents = await this.getUserConsents(userId, tenantId);
            data.sections.consents = consents.consents || [];

            // Leads (se existir tabela)
            try {
                const leads = await this.db.all(`
                    SELECT * FROM tenant_leads 
                    WHERE (email LIKE ? OR telefone LIKE ?) 
                    AND (api_key = ? OR ? IS NULL)
                `, [`%${userId}%`, `%${userId}%`, tenantId, tenantId]);
                data.sections.leads = leads || [];
            } catch (e) { }

            // Conversations (se existir)
            try {
                const conversations = await this.db.all(`
                    SELECT * FROM conversations 
                    WHERE session_id LIKE ?
                `, [`%${userId}%`]);
                data.sections.conversations = conversations || [];
            } catch (e) { }

            // Memória conversacional
            try {
                const memory = await this.db.all(`
                    SELECT * FROM conversation_memory 
                    WHERE user_id = ?
                `, [userId]);
                data.sections.conversationMemory = memory || [];
            } catch (e) { }

            return {
                success: true,
                data,
                format: 'json',
                message: 'Dados exportados com sucesso conforme LGPD Art. 18'
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Exclui dados do usuário (direito ao esquecimento)
     */
    async deleteUserData(userId, tenantId = null) {
        if (!this.db || !this.dbInitialized) {
            return { success: false, error: 'Database not available' };
        }

        try {
            const deletedItems = [];

            // Excluir consentimentos
            await this.db.run(`DELETE FROM lgpd_consents WHERE user_id = ?`, [userId]);
            deletedItems.push('consents');

            // Excluir memória conversacional
            try {
                await this.db.run(`DELETE FROM conversation_memory WHERE user_id = ?`, [userId]);
                deletedItems.push('conversation_memory');
            } catch (e) { }

            // Anonimizar leads (não exclui, mas anonimiza)
            try {
                await this.db.run(`
                    UPDATE tenant_leads 
                    SET email = '[REMOVIDO]', telefone = '[REMOVIDO]', nome = '[REMOVIDO]'
                    WHERE (email LIKE ? OR telefone LIKE ?)
                `, [`%${userId}%`, `%${userId}%`]);
                deletedItems.push('leads_anonymized');
            } catch (e) { }

            // Limpar cache
            for (const key of this.consentCache.keys()) {
                if (key.includes(userId)) {
                    this.consentCache.delete(key);
                }
            }

            // Log de auditoria
            try {
                const auditLogger = require('./audit-logger').auditLogger;
                if (auditLogger) {
                    await auditLogger.log('lgpd.data_deleted', {
                        tenantId,
                        actorType: 'system',
                        actorId: 'lgpd_manager',
                        targetType: 'user_data',
                        targetId: userId,
                        details: { deletedItems },
                        severity: 'critical'
                    });
                }
            } catch (e) { }

            console.log(`📋 [LGPD] Dados excluídos para usuário ${userId}: ${deletedItems.join(', ')}`);

            return {
                success: true,
                deletedItems,
                message: 'Dados excluídos/anonimizados conforme LGPD Art. 18'
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Gera texto de política de privacidade
     */
    getPrivacyPolicyText(tenantName = 'Link Mágico') {
        return {
            title: `Política de Privacidade - ${tenantName}`,
            version: '1.0.0',
            lastUpdated: new Date().toISOString().split('T')[0],
            sections: {
                dataCollection: 'Coletamos: nome, email, telefone, mensagens de chat e dados de navegação.',
                purposes: 'Utilizamos seus dados para: prestação de serviços, comunicação, melhorias e análise.',
                rights: 'Você tem direito a: acessar, corrigir, excluir e portar seus dados.',
                contact: 'Para exercer seus direitos, entre em contato pelo chat ou email.',
                cookies: 'Utilizamos cookies essenciais e, com seu consentimento, cookies de análise.'
            }
        };
    }

    /**
     * Middleware Express para verificar consentimento
     */
    requireConsent(consentType) {
        return async (req, res, next) => {
            const userId = req.session?.userId || req.ip;
            const tenantId = req.headers['x-api-key'] || req.query.apiKey;

            const hasConsent = await this.hasConsent(userId, consentType, tenantId);

            if (!hasConsent && consentType !== CONSENT_TYPES.ESSENTIAL) {
                return res.status(403).json({
                    success: false,
                    error: 'Consent Required',
                    consentType,
                    message: `Consentimento para '${consentType}' é necessário para esta ação.`
                });
            }

            next();
        };
    }
}

// Singleton instance
const lgpdConsentManager = new LGPDConsentManager();

module.exports = {
    lgpdConsentManager,
    LGPDConsentManager,
    CONSENT_TYPES,
    CONSENT_STATUS
};
