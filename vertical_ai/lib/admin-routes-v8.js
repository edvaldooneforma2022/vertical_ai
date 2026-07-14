/**
 * 🛠️ ROTAS DE ADMINISTRAÇÃO V8.0 - Link Mágico
 * 
 * Rotas para gerenciar as novas funcionalidades V8.0:
 * - Feature Flags
 * - Audit Logs
 * - Memória Persistente
 * - Status do Sistema
 * 
 * TODAS as rotas requerem autenticação de admin
 * 
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();

// Importar módulos V8.0 com tratamento de erro
let featureFlags = null;
let auditLogger = null;
let persistentMemory = null;
let enhancedSentiment = null;
let rateLimiterAdvanced = null;
let lgpdConsentManager = null;
let encryptionManager = null;

try { featureFlags = require('./feature-flags').featureFlags; } catch (e) { }
try { auditLogger = require('./audit-logger').auditLogger; } catch (e) { }
try { persistentMemory = require('./persistent-memory').persistentMemory; } catch (e) { }
try { enhancedSentiment = require('./enhanced-sentiment').enhancedSentiment; } catch (e) { }
try { rateLimiterAdvanced = require('./rate-limiter-advanced').rateLimiterAdvanced; } catch (e) { }
try { lgpdConsentManager = require('./lgpd-consent').lgpdConsentManager; } catch (e) { }
try { encryptionManager = require('./encryption').encryptionManager; } catch (e) { }

/**
 * Middleware de autenticação admin
 */
function requireAdmin(req, res, next) {
    // Verificar API key de admin (definida em env)
    const adminKey = process.env.ADMIN_API_KEY || 'linkmagico-admin-v8';
    const providedKey = req.headers['x-admin-key'] || req.query.adminKey;

    if (providedKey !== adminKey) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized - Admin key required'
        });
    }

    next();
}

// ========================================
// ROTAS DE STATUS DO SISTEMA V8.0
// ========================================

/**
 * GET /admin/v8/status
 * Retorna status de todos os módulos V8.0
 */
router.get('/status', requireAdmin, async (req, res) => {
    try {
        const status = {
            version: '8.0.0',
            timestamp: new Date().toISOString(),
            modules: {
                featureFlags: {
                    loaded: !!featureFlags,
                    initialized: featureFlags?.initialized || false,
                    enabledFlags: featureFlags?.getEnabledFlags?.() || []
                },
                auditLogger: {
                    loaded: !!auditLogger,
                    enabled: auditLogger?.enabled || false,
                    queueSize: auditLogger?.queue?.length || 0
                },
                persistentMemory: {
                    loaded: !!persistentMemory,
                    enabled: persistentMemory?.enabled || false,
                    cacheSize: persistentMemory?.memoryCache?.size || 0,
                    dbConnected: persistentMemory?.dbInitialized || false
                },
                enhancedSentiment: {
                    loaded: !!enhancedSentiment,
                    enabled: enhancedSentiment?.enabled || false
                }
            }
        };

        // Obter stats de memória se disponível
        if (persistentMemory && typeof persistentMemory.getStats === 'function') {
            status.modules.persistentMemory.stats = await persistentMemory.getStats();
        }

        res.json({ success: true, ...status });

    } catch (error) {
        console.error('❌ Erro ao obter status V8.0:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// ROTAS DE FEATURE FLAGS
// ========================================

/**
 * GET /admin/v8/flags
 * Lista todas as feature flags
 */
router.get('/flags', requireAdmin, (req, res) => {
    if (!featureFlags) {
        return res.status(503).json({
            success: false,
            error: 'Feature Flags module not loaded'
        });
    }

    try {
        const flags = featureFlags.getAllFlags();
        res.json({
            success: true,
            flags,
            enabledCount: Object.values(flags).filter(f => f.enabled).length,
            totalCount: Object.keys(flags).length
        });

    } catch (error) {
        console.error('❌ Erro ao listar flags:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /admin/v8/flags/:flagName/enable
 * Habilita uma feature flag
 */
router.post('/flags/:flagName/enable', requireAdmin, async (req, res) => {
    if (!featureFlags) {
        return res.status(503).json({
            success: false,
            error: 'Feature Flags module not loaded'
        });
    }

    try {
        const { flagName } = req.params;
        const success = featureFlags.enable(flagName);

        // Salvar configuração
        await featureFlags.saveConfig();

        // Log de auditoria
        if (auditLogger) {
            await auditLogger.log('admin.flag_enabled', {
                targetType: 'feature_flag',
                targetId: flagName,
                details: { enabled: true },
                request: req
            });
        }

        res.json({
            success,
            flagName,
            enabled: true,
            message: success ? `Flag ${flagName} habilitada` : `Flag ${flagName} não encontrada`
        });

    } catch (error) {
        console.error('❌ Erro ao habilitar flag:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /admin/v8/flags/:flagName/disable
 * Desabilita uma feature flag
 */
router.post('/flags/:flagName/disable', requireAdmin, async (req, res) => {
    if (!featureFlags) {
        return res.status(503).json({
            success: false,
            error: 'Feature Flags module not loaded'
        });
    }

    try {
        const { flagName } = req.params;
        const success = featureFlags.disable(flagName);

        // Salvar configuração
        await featureFlags.saveConfig();

        // Log de auditoria
        if (auditLogger) {
            await auditLogger.log('admin.flag_disabled', {
                targetType: 'feature_flag',
                targetId: flagName,
                details: { enabled: false },
                request: req
            });
        }

        res.json({
            success,
            flagName,
            enabled: false,
            message: success ? `Flag ${flagName} desabilitada` : `Flag ${flagName} não encontrada`
        });

    } catch (error) {
        console.error('❌ Erro ao desabilitar flag:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /admin/v8/flags/:flagName/tenant/:tenantId
 * Define override de flag para um tenant específico
 */
router.post('/flags/:flagName/tenant/:tenantId', requireAdmin, async (req, res) => {
    if (!featureFlags) {
        return res.status(503).json({
            success: false,
            error: 'Feature Flags module not loaded'
        });
    }

    try {
        const { flagName, tenantId } = req.params;
        const { enabled } = req.body;

        const success = featureFlags.setTenantOverride(tenantId, flagName, enabled);
        await featureFlags.saveConfig();

        res.json({
            success,
            flagName,
            tenantId,
            enabled,
            message: `Override para tenant ${tenantId}: ${flagName} = ${enabled}`
        });

    } catch (error) {
        console.error('❌ Erro ao definir tenant override:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// ROTAS DE AUDIT LOGS
// ========================================

/**
 * GET /admin/v8/audit
 * Busca logs de auditoria
 */
router.get('/audit', requireAdmin, async (req, res) => {
    if (!auditLogger) {
        return res.status(503).json({
            success: false,
            error: 'Audit Logger module not loaded'
        });
    }

    try {
        const filters = {
            tenantId: req.query.tenantId,
            action: req.query.action,
            actorId: req.query.actorId,
            fromDate: req.query.fromDate,
            toDate: req.query.toDate,
            severity: req.query.severity,
            limit: parseInt(req.query.limit) || 100
        };

        const result = await auditLogger.search(filters);
        res.json(result);

    } catch (error) {
        console.error('❌ Erro ao buscar audit logs:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// ROTAS DE MEMÓRIA PERSISTENTE
// ========================================

/**
 * GET /admin/v8/memory/stats
 * Estatísticas da memória persistente
 */
router.get('/memory/stats', requireAdmin, async (req, res) => {
    if (!persistentMemory) {
        return res.status(503).json({
            success: false,
            error: 'Persistent Memory module not loaded'
        });
    }

    try {
        const tenantId = req.query.tenantId;
        const stats = await persistentMemory.getStats(tenantId);
        res.json({ success: true, ...stats });

    } catch (error) {
        console.error('❌ Erro ao obter stats de memória:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /admin/v8/memory/cleanup
 * Limpa memórias expiradas
 */
router.post('/memory/cleanup', requireAdmin, async (req, res) => {
    if (!persistentMemory) {
        return res.status(503).json({
            success: false,
            error: 'Persistent Memory module not loaded'
        });
    }

    try {
        await persistentMemory.cleanup();
        res.json({
            success: true,
            message: 'Memórias expiradas removidas com sucesso'
        });

    } catch (error) {
        console.error('❌ Erro ao limpar memórias:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// ROTAS DE TESTE DE SENTIMENTO
// ========================================

/**
 * POST /admin/v8/sentiment/test
 * Testa análise de sentimento com uma mensagem
 */
router.post('/sentiment/test', requireAdmin, (req, res) => {
    if (!enhancedSentiment) {
        return res.status(503).json({
            success: false,
            error: 'Enhanced Sentiment module not loaded'
        });
    }

    try {
        const { message, history } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        // Análise simples
        const basicResult = enhancedSentiment.analyze(message);

        // Análise com contexto se histórico fornecido
        let contextResult = null;
        if (history && Array.isArray(history)) {
            contextResult = enhancedSentiment.analyzeWithContext(message, history);
        }

        // Recomendação de escalonamento
        const escalationResult = enhancedSentiment.shouldEscalate(
            contextResult || basicResult
        );

        res.json({
            success: true,
            message,
            analysis: {
                basic: basicResult,
                withContext: contextResult,
                escalation: escalationResult
            }
        });

    } catch (error) {
        console.error('❌ Erro ao testar sentimento:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// ROTAS LGPD - COMPLIANCE
// ========================================

/**
 * POST /admin/v8/lgpd/consent
 * Registra consentimento do usuário
 */
router.post('/lgpd/consent', requireAdmin, async (req, res) => {
    if (!lgpdConsentManager) {
        return res.status(503).json({
            success: false,
            error: 'LGPD Consent Manager not loaded'
        });
    }

    try {
        const { userId, tenantId, consentType, granted } = req.body;
        const result = await lgpdConsentManager.recordConsent({
            userId,
            tenantId,
            consentType,
            granted,
            request: req
        });
        res.json(result);

    } catch (error) {
        console.error('❌ Erro ao registrar consentimento:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /admin/v8/lgpd/consents/:userId
 * Lista consentimentos de um usuário
 */
router.get('/lgpd/consents/:userId', requireAdmin, async (req, res) => {
    if (!lgpdConsentManager) {
        return res.status(503).json({
            success: false,
            error: 'LGPD Consent Manager not loaded'
        });
    }

    try {
        const { userId } = req.params;
        const tenantId = req.query.tenantId;
        const result = await lgpdConsentManager.getUserConsents(userId, tenantId);
        res.json(result);

    } catch (error) {
        console.error('❌ Erro ao listar consentimentos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /admin/v8/lgpd/export/:userId
 * Exporta todos os dados do usuário (direito de acesso)
 */
router.get('/lgpd/export/:userId', requireAdmin, async (req, res) => {
    if (!lgpdConsentManager) {
        return res.status(503).json({
            success: false,
            error: 'LGPD Consent Manager not loaded'
        });
    }

    try {
        const { userId } = req.params;
        const tenantId = req.query.tenantId;
        const result = await lgpdConsentManager.exportUserData(userId, tenantId);
        res.json(result);

    } catch (error) {
        console.error('❌ Erro ao exportar dados:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * DELETE /admin/v8/lgpd/delete/:userId
 * Exclui dados do usuário (direito ao esquecimento)
 */
router.delete('/lgpd/delete/:userId', requireAdmin, async (req, res) => {
    if (!lgpdConsentManager) {
        return res.status(503).json({
            success: false,
            error: 'LGPD Consent Manager not loaded'
        });
    }

    try {
        const { userId } = req.params;
        const tenantId = req.query.tenantId;
        const result = await lgpdConsentManager.deleteUserData(userId, tenantId);
        res.json(result);

    } catch (error) {
        console.error('❌ Erro ao excluir dados:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /admin/v8/lgpd/data-request
 * Cria solicitação de dados (DSAR)
 */
router.post('/lgpd/data-request', requireAdmin, async (req, res) => {
    if (!lgpdConsentManager) {
        return res.status(503).json({
            success: false,
            error: 'LGPD Consent Manager not loaded'
        });
    }

    try {
        const { userId, requestType, tenantId } = req.body;
        const result = await lgpdConsentManager.createDataRequest(
            userId, requestType, tenantId, req
        );
        res.json(result);

    } catch (error) {
        console.error('❌ Erro ao criar solicitação de dados:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// ROTAS RATE LIMITER
// ========================================

/**
 * GET /admin/v8/ratelimit/stats
 * Estatísticas do rate limiter
 */
router.get('/ratelimit/stats', requireAdmin, (req, res) => {
    if (!rateLimiterAdvanced) {
        return res.status(503).json({
            success: false,
            error: 'Rate Limiter not loaded'
        });
    }

    try {
        const stats = rateLimiterAdvanced.getStats();
        res.json({ success: true, ...stats });

    } catch (error) {
        console.error('❌ Erro ao obter stats de rate limit:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /admin/v8/ratelimit/reset/:identifier
 * Reseta limite de um identificador
 */
router.post('/ratelimit/reset/:identifier', requireAdmin, (req, res) => {
    if (!rateLimiterAdvanced) {
        return res.status(503).json({
            success: false,
            error: 'Rate Limiter not loaded'
        });
    }

    try {
        const { identifier } = req.params;
        const count = rateLimiterAdvanced.reset(identifier);
        res.json({
            success: true,
            identifier,
            resetCount: count,
            message: `Reset ${count} registros para ${identifier}`
        });

    } catch (error) {
        console.error('❌ Erro ao resetar rate limit:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========================================
// ROTAS ENCRYPTION
// ========================================

/**
 * GET /admin/v8/encryption/status
 * Status do sistema de criptografia
 */
router.get('/encryption/status', requireAdmin, (req, res) => {
    if (!encryptionManager) {
        return res.status(503).json({
            success: false,
            error: 'Encryption Manager not loaded'
        });
    }

    try {
        const status = encryptionManager.getStatus();
        res.json({ success: true, ...status });

    } catch (error) {
        console.error('❌ Erro ao obter status de encryption:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
