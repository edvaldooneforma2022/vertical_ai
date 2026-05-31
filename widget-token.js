/**
 * 🔐 WIDGET TOKEN — Link Mágico
 * Módulo isolado para tokens públicos de widget.
 * 
 * SAFE PATCH - Módulo 100% isolado e aditivo.
 * NÃO IMPACTA nenhuma funcionalidade existente:
 * - API Key auth continua funcionando normalmente
 * - requireApiKey middleware não é alterado
 * - billingMiddleware não é alterado
 * - Endpoints do widget continuam iguais
 * - Billing, WhatsApp, CRM, pipeline — tudo intacto
 * 
 * Feature Flag: FEATURE_WIDGET_TOKEN (default: true)
 * Pode ser desligado instantaneamente via env var.
 * 
 * Rotas:
 *   POST /api/auth/widget-token — Gerar/obter token público
 *   POST /api/auth/widget-token/regenerate — Regenerar token
 *   GET  /api/auth/widget-token — Obter token atual
 * 
 * Middleware:
 *   resolveWidgetToken — Intercepta widgetToken no body e resolve para apiKey
 */

const crypto = require('crypto');

// Carregar dependências do sistema existente
let db, USE_POSTGRES;
try {
    const database = require('./database');
    db = database.db;
    USE_POSTGRES = database.USE_POSTGRES;
} catch (e) {
    console.warn('⚠️ [Widget Token] database não disponível:', e.message);
}

// Cache de widget tokens para performance (evitar queries repetidas)
const TOKEN_CACHE = new Map(); // widgetToken -> { apiKey, tenantId, cachedAt }
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Gerar token público único
 */
function generateWidgetToken() {
    return 'wt_' + crypto.randomBytes(16).toString('hex'); // wt_ + 32 chars hex
}

/**
 * Migration: Adicionar coluna widget_token se não existe
 */
async function ensureWidgetTokenColumn() {
    if (!db) return;
    
    try {
        if (USE_POSTGRES) {
            await db.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS widget_token TEXT`);
            console.log('✅ [Widget Token] Coluna widget_token verificada (Postgres)');
        } else {
            // SQLite: verificar se coluna existe via pragma
            const cols = await db.query(`PRAGMA table_info(tenants)`);
            const rows = cols.rows || cols;
            const hasColumn = rows.some(r => r.name === 'widget_token');
            if (!hasColumn) {
                await db.query(`ALTER TABLE tenants ADD COLUMN widget_token TEXT`);
                console.log('✅ [Widget Token] Coluna widget_token criada (SQLite)');
            } else {
                console.log('✅ [Widget Token] Coluna widget_token já existe (SQLite)');
            }
        }
    } catch (e) {
        // Coluna pode já existir, ignorar erro
        if (!e.message.includes('duplicate') && !e.message.includes('already exists')) {
            console.warn('⚠️ [Widget Token] Migration:', e.message);
        }
    }
}

/**
 * Handler: Gerar ou obter token público
 * POST /api/auth/widget-token
 * GET  /api/auth/widget-token
 */
async function handleGetOrCreateToken(req, res) {
    try {
        if (!db) {
            return res.status(503).json({ success: false, error: 'Banco de dados não disponível' });
        }

        // Verificar se está autenticado
        const tenantId = req.session?.tenantId;
        if (!tenantId) {
            return res.status(401).json({
                success: false,
                error: 'Você precisa estar logado para gerar um token de widget.'
            });
        }

        // Buscar token existente
        const query = USE_POSTGRES
            ? `SELECT widget_token FROM tenants WHERE id = $1 LIMIT 1`
            : `SELECT widget_token FROM tenants WHERE id = ? LIMIT 1`;

        const result = await db.query(query, [tenantId]);
        const rows = result.rows || result;

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Tenant não encontrado' });
        }

        let widgetToken = rows[0].widget_token;

        // Se não tem token, gerar um novo (POST)
        if (!widgetToken && req.method === 'POST') {
            widgetToken = generateWidgetToken();

            const updateQuery = USE_POSTGRES
                ? `UPDATE tenants SET widget_token = $1 WHERE id = $2`
                : `UPDATE tenants SET widget_token = ? WHERE id = ?`;

            await db.query(updateQuery, [widgetToken, tenantId]);
            console.log(`🔐 [Widget Token] Token gerado para tenant: ${tenantId.substring(0, 8)}...`);
        }

        if (!widgetToken) {
            return res.json({
                success: true,
                hasToken: false,
                widgetToken: null,
                message: 'Nenhum token gerado ainda. Use POST para gerar.'
            });
        }

        // Gerar snippet de embed
        const snippet = `<!-- LinkMágico Widget -->
<script>
(function() {
    var config = {
        widgetToken: "${widgetToken}",
        // ... demais configurações do widget
    };
    // Cole o restante do código do widget aqui
})();
</script>`;

        return res.json({
            success: true,
            hasToken: true,
            widgetToken: widgetToken,
            snippet: snippet,
            message: 'Use o widgetToken no lugar da apiKey no código do widget.'
        });

    } catch (error) {
        console.error('❌ [Widget Token] Erro ao obter/criar token:', error.message);
        return res.status(500).json({ success: false, error: 'Erro interno. Tente novamente.' });
    }
}

/**
 * Handler: Regenerar token (revogar anterior)
 * POST /api/auth/widget-token/regenerate
 */
async function handleRegenerateToken(req, res) {
    try {
        if (!db) {
            return res.status(503).json({ success: false, error: 'Banco de dados não disponível' });
        }

        const tenantId = req.session?.tenantId;
        if (!tenantId) {
            return res.status(401).json({
                success: false,
                error: 'Você precisa estar logado para regenerar o token.'
            });
        }

        // Buscar token antigo para invalidar cache
        const oldQuery = USE_POSTGRES
            ? `SELECT widget_token FROM tenants WHERE id = $1 LIMIT 1`
            : `SELECT widget_token FROM tenants WHERE id = ? LIMIT 1`;

        const oldResult = await db.query(oldQuery, [tenantId]);
        const oldRows = oldResult.rows || oldResult;
        if (oldRows.length > 0 && oldRows[0].widget_token) {
            TOKEN_CACHE.delete(oldRows[0].widget_token); // Invalidar cache do token antigo
        }

        // Gerar novo token
        const newToken = generateWidgetToken();

        const updateQuery = USE_POSTGRES
            ? `UPDATE tenants SET widget_token = $1 WHERE id = $2`
            : `UPDATE tenants SET widget_token = ? WHERE id = ?`;

        await db.query(updateQuery, [newToken, tenantId]);

        console.log(`🔄 [Widget Token] Token regenerado para tenant: ${tenantId.substring(0, 8)}...`);

        return res.json({
            success: true,
            widgetToken: newToken,
            message: 'Token regenerado com sucesso! O token anterior foi revogado. Atualize o código do widget.'
        });

    } catch (error) {
        console.error('❌ [Widget Token] Erro ao regenerar:', error.message);
        return res.status(500).json({ success: false, error: 'Erro interno. Tente novamente.' });
    }
}

/**
 * Middleware: Resolve widgetToken → apiKey
 * Intercepta requests com widgetToken no body e substitui por apiKey real.
 * DEVE ser registrado ANTES do requireApiKey.
 */
async function resolveWidgetToken(req, res, next) {
    try {
        // Só processar se tem widgetToken no body e NÃO tem apiKey
        const widgetToken = req.body?.widgetToken;
        if (!widgetToken || !widgetToken.startsWith('wt_') || req.body.apiKey) {
            return next(); // Nada a fazer — seguir fluxo normal
        }

        if (!db) {
            console.warn('⚠️ [Widget Token] DB não disponível — passando adiante');
            return next();
        }

        // 1. Verificar cache primeiro
        const cached = TOKEN_CACHE.get(widgetToken);
        if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL_MS) {
            req.body.apiKey = cached.apiKey;
            return next();
        }

        // 2. Buscar no banco
        const query = USE_POSTGRES
            ? `SELECT t.id, ak.key_value as api_key 
               FROM tenants t 
               JOIN api_keys ak ON t.id = ak.tenant_id AND ak.active = true
               WHERE t.widget_token = $1 
               LIMIT 1`
            : `SELECT t.id, ak.key_value as api_key 
               FROM tenants t 
               JOIN api_keys ak ON t.id = ak.tenant_id AND ak.active = 1
               WHERE t.widget_token = ? 
               LIMIT 1`;

        const result = await db.query(query, [widgetToken]);
        const rows = result.rows || result;

        if (!rows || rows.length === 0) {
            console.warn(`🚫 [Widget Token] Token inválido: ${widgetToken.substring(0, 10)}...`);
            return res.status(401).json({
                success: false,
                error: 'Widget token inválido ou revogado.'
            });
        }

        const { api_key } = rows[0];

        // 3. Cachear para performance
        TOKEN_CACHE.set(widgetToken, {
            apiKey: api_key,
            tenantId: rows[0].id,
            cachedAt: Date.now()
        });

        // 4. Injetar apiKey real no body (o restante do fluxo não sabe que era token)
        req.body.apiKey = api_key;
        
        return next();

    } catch (error) {
        console.error('❌ [Widget Token] Erro no middleware:', error.message);
        // FALLBACK: não bloquear o request — deixar seguir sem apiKey
        // O requireApiKey ou o endpoint vai retornar 401 se necessário
        return next();
    }
}

// Limpar cache expirado periodicamente
setInterval(() => {
    const now = Date.now();
    for (const [token, entry] of TOKEN_CACHE.entries()) {
        if (now - entry.cachedAt > CACHE_TTL_MS) {
            TOKEN_CACHE.delete(token);
        }
    }
}, 10 * 60 * 1000); // A cada 10 minutos

/**
 * Registra rotas e middleware no Express app
 */
function registerWidgetTokenRoutes(app) {
    // Rotas de gestão de token (autenticadas via sessão, bypass em /api/auth/*)
    app.post('/api/auth/widget-token', handleGetOrCreateToken);
    app.get('/api/auth/widget-token', handleGetOrCreateToken);
    app.post('/api/auth/widget-token/regenerate', handleRegenerateToken);

    console.log('🔐 [Widget Token] Rotas registradas: /api/auth/widget-token, /regenerate');
}

/**
 * Registra o middleware de resolução (chamado separadamente)
 */
function registerWidgetTokenMiddleware(app) {
    // Middleware ANTES do requireApiKey para interceptar widgetToken
    app.use(resolveWidgetToken);
    console.log('🔐 [Widget Token] Middleware resolveWidgetToken registrado');
}

module.exports = {
    registerWidgetTokenRoutes,
    registerWidgetTokenMiddleware,
    resolveWidgetToken,
    ensureWidgetTokenColumn,
    handleGetOrCreateToken,
    handleRegenerateToken
};
