/**
 * 📋 SISTEMA DE AUDIT LOGGING - Link Mágico V8.0
 * 
 * Registra ações críticas para compliance e debugging
 * Totalmente isolado - não afeta funcionalidades existentes
 * 
 * Ações rastreadas:
 * - Login/logout
 * - Captura de leads
 * - Alterações de configuração
 * - Operações de billing
 * - Ações administrativas
 * 
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

// Tipos de ações que podem ser auditadas
const AUDIT_ACTIONS = {
    // Autenticação
    AUTH_LOGIN: 'auth.login',
    AUTH_LOGOUT: 'auth.logout',
    AUTH_API_KEY_VALIDATED: 'auth.api_key_validated',
    AUTH_API_KEY_FAILED: 'auth.api_key_failed',

    // Leads
    LEAD_CAPTURED: 'lead.captured',
    LEAD_UPDATED: 'lead.updated',
    LEAD_DELETED: 'lead.deleted',
    LEAD_EXPORTED: 'lead.exported',

    // Configurações
    CONFIG_UPDATED: 'config.updated',
    CONFIG_WHITELABEL: 'config.whitelabel',
    CONFIG_CHATBOT: 'config.chatbot',

    // Billing
    BILLING_PLAN_CHANGED: 'billing.plan_changed',
    BILLING_PAYMENT: 'billing.payment',

    // Agendamentos
    APPOINTMENT_CREATED: 'appointment.created',
    APPOINTMENT_UPDATED: 'appointment.updated',
    APPOINTMENT_CANCELLED: 'appointment.cancelled',

    // Conversas
    CONVERSATION_STARTED: 'conversation.started',
    CONVERSATION_ENDED: 'conversation.ended',

    // Integrações
    WEBHOOK_REGISTERED: 'webhook.registered',
    WEBHOOK_TRIGGERED: 'webhook.triggered',
    WHATSAPP_MESSAGE: 'whatsapp.message',

    // Admin
    ADMIN_ACTION: 'admin.action',
    BACKUP_CREATED: 'backup.created',
    BACKUP_RESTORED: 'backup.restored',

    // Sistema
    SYSTEM_ERROR: 'system.error',
    SYSTEM_WARNING: 'system.warning'
};

// Níveis de severidade
const SEVERITY = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
};

class AuditLogger {
    constructor() {
        this.enabled = false;
        this.queue = [];
        this.processing = false;
        this.logPath = path.join(__dirname, '..', 'data', 'audit_logs');
        this.dbInitialized = false;
        this.db = null;

        console.log('📋 Sistema de Audit Logging inicializando...');
    }

    /**
     * Inicializa o sistema de audit logging
     * @param {Object} options - Opções de configuração
     */
    async initialize(options = {}) {
        try {
            // Verificar se feature está habilitada
            let featureFlags;
            try {
                featureFlags = require('./feature-flags').featureFlags;
                this.enabled = featureFlags.isEnabled('FEATURE_AUDIT_LOGGING');
            } catch (e) {
                // Feature flags não disponível, usar default
                this.enabled = process.env.FEATURE_AUDIT_LOGGING === 'true';
            }

            if (!this.enabled) {
                console.log('📋 Audit Logging desabilitado (use FEATURE_AUDIT_LOGGING=true para habilitar)');
                return;
            }

            // Criar diretório de logs se não existir
            if (!fs.existsSync(this.logPath)) {
                fs.mkdirSync(this.logPath, { recursive: true });
            }

            // Tentar conectar ao banco de dados
            if (options.database) {
                this.db = options.database;
                await this._initializeDatabase();
            }

            console.log('✅ Audit Logging habilitado e pronto');

        } catch (error) {
            console.error('⚠️ Erro ao inicializar Audit Logging:', error.message);
            // Não lança erro para não quebrar o sistema
        }
    }

    /**
     * Inicializa tabela de audit no banco
     */
    async _initializeDatabase() {
        if (!this.db || this.dbInitialized) return;

        try {
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS audit_logs (
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
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `;

            await this.db.run(createTableQuery);

            // Criar índices para consultas eficientes
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)');

            this.dbInitialized = true;
            console.log('✅ Tabela audit_logs criada/verificada');

        } catch (error) {
            console.error('⚠️ Erro ao criar tabela audit_logs:', error.message);
        }
    }

    /**
     * Registra uma ação de auditoria
     * 
     * @param {string} action - Tipo de ação (use AUDIT_ACTIONS)
     * @param {Object} data - Dados da ação
     * @param {string} [data.tenantId] - ID do tenant
     * @param {string} [data.actorType] - Tipo do ator (user, system, api)
     * @param {string} [data.actorId] - ID do ator
     * @param {string} [data.targetType] - Tipo do alvo (lead, config, etc)
     * @param {string} [data.targetId] - ID do alvo
     * @param {Object} [data.details] - Detalhes adicionais
     * @param {string} [data.severity] - Nível de severidade
     * @param {Object} [data.request] - Objeto request (para extrair IP, user-agent)
     */
    async log(action, data = {}) {
        // Se desabilitado, retorna silenciosamente
        if (!this.enabled) return;

        try {
            const entry = {
                id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                action,
                tenantId: data.tenantId || null,
                actorType: data.actorType || 'system',
                actorId: data.actorId || null,
                targetType: data.targetType || null,
                targetId: data.targetId || null,
                details: data.details || null,
                severity: data.severity || SEVERITY.INFO,
                ipAddress: data.request?.ip || data.ipAddress || null,
                userAgent: data.request?.headers?.['user-agent'] || data.userAgent || null,
                sessionId: data.request?.session?.id || data.sessionId || null,
                metadata: data.metadata || null,
                createdAt: new Date().toISOString()
            };

            // Adicionar à fila para processamento assíncrono
            this.queue.push(entry);

            // Processar fila se não estiver processando
            if (!this.processing) {
                this._processQueue();
            }

        } catch (error) {
            console.error('⚠️ Erro ao registrar audit log:', error.message);
            // Não propaga erro para não afetar sistema principal
        }
    }

    /**
     * Processa fila de logs assincronamente
     */
    async _processQueue() {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;

        while (this.queue.length > 0) {
            const entry = this.queue.shift();

            try {
                // Salvar no banco se disponível
                if (this.db && this.dbInitialized) {
                    await this._saveToDatabase(entry);
                }

                // Sempre salvar em arquivo como backup
                await this._saveToFile(entry);

            } catch (error) {
                console.error('⚠️ Erro ao processar audit log:', error.message);
            }
        }

        this.processing = false;
    }

    /**
     * Salva log no banco de dados
     */
    async _saveToDatabase(entry) {
        const query = `
            INSERT INTO audit_logs (
                id, tenant_id, action, actor_type, actor_id,
                target_type, target_id, details, severity,
                ip_address, user_agent, session_id, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await this.db.run(query, [
            entry.id,
            entry.tenantId,
            entry.action,
            entry.actorType,
            entry.actorId,
            entry.targetType,
            entry.targetId,
            entry.details ? JSON.stringify(entry.details) : null,
            entry.severity,
            entry.ipAddress,
            entry.userAgent,
            entry.sessionId,
            entry.metadata ? JSON.stringify(entry.metadata) : null
        ]);
    }

    /**
     * Salva log em arquivo JSON (backup/fallback)
     */
    async _saveToFile(entry) {
        try {
            const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const filename = `audit_${date}.jsonl`;
            const filepath = path.join(this.logPath, filename);

            const line = JSON.stringify(entry) + '\n';
            fs.appendFileSync(filepath, line);

        } catch (error) {
            console.error('⚠️ Erro ao salvar audit log em arquivo:', error.message);
        }
    }

    /**
     * Busca logs de auditoria
     * 
     * @param {Object} filters - Filtros de busca
     * @returns {Array} Lista de logs
     */
    async search(filters = {}) {
        if (!this.db || !this.dbInitialized) {
            return { success: false, error: 'Database not available' };
        }

        try {
            let query = 'SELECT * FROM audit_logs WHERE 1=1';
            const params = [];

            if (filters.tenantId) {
                query += ' AND tenant_id = ?';
                params.push(filters.tenantId);
            }

            if (filters.action) {
                query += ' AND action = ?';
                params.push(filters.action);
            }

            if (filters.actorId) {
                query += ' AND actor_id = ?';
                params.push(filters.actorId);
            }

            if (filters.fromDate) {
                query += ' AND created_at >= ?';
                params.push(filters.fromDate);
            }

            if (filters.toDate) {
                query += ' AND created_at <= ?';
                params.push(filters.toDate);
            }

            if (filters.severity) {
                query += ' AND severity = ?';
                params.push(filters.severity);
            }

            query += ' ORDER BY created_at DESC';

            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(filters.limit);
            }

            const logs = await this.db.all(query, params);

            return {
                success: true,
                count: logs.length,
                logs: logs.map(log => ({
                    ...log,
                    details: log.details ? JSON.parse(log.details) : null,
                    metadata: log.metadata ? JSON.parse(log.metadata) : null
                }))
            };

        } catch (error) {
            console.error('❌ Erro ao buscar audit logs:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Helper para log de ações comuns
     */
    async logAuth(action, tenantId, actorId, request, details = {}) {
        await this.log(action, {
            tenantId,
            actorType: 'user',
            actorId,
            targetType: 'session',
            details,
            request
        });
    }

    async logLead(action, tenantId, leadId, actorId, request, details = {}) {
        await this.log(action, {
            tenantId,
            actorType: 'user',
            actorId,
            targetType: 'lead',
            targetId: leadId,
            details,
            request
        });
    }

    async logConfig(action, tenantId, configType, actorId, request, details = {}) {
        await this.log(action, {
            tenantId,
            actorType: 'user',
            actorId,
            targetType: 'config',
            targetId: configType,
            details,
            severity: SEVERITY.WARNING,
            request
        });
    }

    async logError(message, error, context = {}) {
        await this.log(AUDIT_ACTIONS.SYSTEM_ERROR, {
            actorType: 'system',
            severity: SEVERITY.ERROR,
            details: {
                message,
                error: error?.message || String(error),
                stack: error?.stack,
                ...context
            }
        });
    }
}

// Singleton instance
const auditLogger = new AuditLogger();

module.exports = {
    auditLogger,
    AUDIT_ACTIONS,
    SEVERITY,
    AuditLogger
};
