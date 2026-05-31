/**
 * 🔐 AUTH LOGIN — Link Mágico
 * Módulo isolado para login por email/senha.
 * 
 * SAFE PATCH - Módulo 100% isolado e aditivo.
 * NÃO IMPACTA nenhuma funcionalidade existente:
 * - API Key auth continua funcionando normalmente
 * - Hotmart webhook não é afetado
 * - Billing, WhatsApp, widget, CRM — tudo intacto
 * - /api/auth/* já é bypass no middleware requireApiKey (server.js L3660)
 * 
 * Feature Flag: FEATURE_EMAIL_LOGIN (default: true)
 * Pode ser desligado instantaneamente via env var.
 * 
 * Rotas:
 *   POST /api/auth/login — Login com email + senha → sessão
 *   POST /api/auth/session-check — Verificar se há sessão ativa
 *   POST /api/auth/set-password — Definir senha (para contas Hotmart sem senha)
 */

// Tentar carregar bcryptjs (fallback seguro se não disponível)
let bcrypt;
try {
    bcrypt = require('bcryptjs');
} catch (e) {
    console.warn('⚠️ [Auth Login] bcryptjs não disponível — login por email desabilitado');
    bcrypt = null;
}

// Carregar dependências do sistema existente
let db, USE_POSTGRES;
try {
    const database = require('./database');
    db = database.db;
    USE_POSTGRES = database.USE_POSTGRES;
} catch (e) {
    console.warn('⚠️ [Auth Login] database não disponível:', e.message);
}

// Rate limiting para login (proteção contra brute-force)
const LOGIN_RATE_LIMIT = new Map(); // IP -> { count, resetAt }
const MAX_LOGIN_ATTEMPTS = 10;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

/**
 * Rate limiting por IP
 */
function checkLoginRateLimit(ip) {
    const now = Date.now();
    const entry = LOGIN_RATE_LIMIT.get(ip);

    if (!entry || now > entry.resetAt) {
        LOGIN_RATE_LIMIT.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }

    if (entry.count >= MAX_LOGIN_ATTEMPTS) {
        return false;
    }

    entry.count++;
    return true;
}

// Limpar rate limit periodicamente (evitar memory leak)
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of LOGIN_RATE_LIMIT.entries()) {
        if (now > entry.resetAt) {
            LOGIN_RATE_LIMIT.delete(ip);
        }
    }
}, 10 * 60 * 1000); // Limpar a cada 10 minutos

/**
 * Handler de login
 */
async function handleLogin(req, res) {
    try {
        // 0. Verificar dependências
        if (!bcrypt) {
            return res.status(503).json({
                success: false,
                error: 'Serviço de login temporariamente indisponível'
            });
        }

        if (!db) {
            return res.status(503).json({
                success: false,
                error: 'Banco de dados não disponível'
            });
        }

        // 1. Validar dados de entrada
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email e senha são obrigatórios'
            });
        }

        // 2. Rate limiting
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
        if (!checkLoginRateLimit(clientIp)) {
            console.warn(`🚫 [Auth Login] Rate limit atingido para IP: ${clientIp}`);
            return res.status(429).json({
                success: false,
                error: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
            });
        }

        // 3. Buscar usuário no banco
        const query = USE_POSTGRES
            ? `SELECT t.id, t.name, t.email, t.plan, t.status, t.password_hash, ak.key_value as api_key
               FROM tenants t
               LEFT JOIN api_keys ak ON t.id = ak.tenant_id AND ak.active = ${USE_POSTGRES ? 'true' : '1'}
               WHERE LOWER(t.email) = LOWER($1)
               LIMIT 1`
            : `SELECT t.id, t.name, t.email, t.plan, t.status, t.password_hash, ak.key_value as api_key
               FROM tenants t
               LEFT JOIN api_keys ak ON t.id = ak.tenant_id AND ak.active = 1
               WHERE LOWER(t.email) = LOWER(?)
               LIMIT 1`;

        const result = await db.query(query, [email.trim().toLowerCase()]);
        const rows = result.rows || result;

        if (!rows || rows.length === 0) {
            console.log(`🔐 [Auth Login] Email não encontrado: ${email}`);
            return res.status(401).json({
                success: false,
                error: 'Email ou senha incorretos'
            });
        }

        const user = rows[0];

        // 4. Verificar se tem password_hash (pode ser conta Hotmart sem senha)
        if (!user.password_hash) {
            console.log(`🔐 [Auth Login] Conta sem senha definida: ${email}`);
            return res.status(401).json({
                success: false,
                error: 'Esta conta ainda não possui senha. Acesse pelo tab "API Key", depois defina sua senha no painel.',
                needsPassword: true
            });
        }

        // 5. Verificar senha
        const passwordValid = await bcrypt.compare(password, user.password_hash);

        if (!passwordValid) {
            console.log(`🔐 [Auth Login] Senha incorreta para: ${email}`);
            return res.status(401).json({
                success: false,
                error: 'Email ou senha incorretos'
            });
        }

        // 6. Verificar status da conta
        if (user.status && user.status !== 'active') {
            console.log(`🔐 [Auth Login] Conta inativa: ${email} (status: ${user.status})`);
            return res.status(403).json({
                success: false,
                error: 'Sua conta está inativa. Entre em contato com o suporte.'
            });
        }

        // 7. Criar sessão (mesmo padrão do self-service-signup.js L305-323)
        if (req.session) {
            req.session.tenantId = user.id;
            req.session.validatedApiKey = user.api_key || '';
            req.session.plan = user.plan || 'free';
            req.session.status = user.status || 'active';
            req.session.clientData = {
                id: user.id,
                name: user.name || email.split('@')[0],
                plan: user.plan || 'free',
                status: user.status || 'active',
                apiKey: user.api_key || ''
            };
        }

        console.log(`✅ [Auth Login] Login bem-sucedido: ${user.name || email} (plano: ${user.plan || 'free'})`);

        // 8. Retornar sucesso com API Key (para o frontend salvar no localStorage)
        return res.json({
            success: true,
            message: 'Login realizado com sucesso!',
            apiKey: user.api_key || '',
            plan: user.plan || 'free',
            name: user.name || email.split('@')[0],
            panelUrl: '/app'
        });

    } catch (error) {
        console.error('❌ [Auth Login] Erro inesperado:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Erro interno. Tente novamente.'
        });
    }
}

/**
 * Verificar sessão ativa (para auto-login no frontend)
 */
async function handleSessionCheck(req, res) {
    try {
        if (req.session && req.session.tenantId && req.session.validatedApiKey) {
            return res.json({
                success: true,
                authenticated: true,
                apiKey: req.session.validatedApiKey,
                plan: req.session.plan || 'free',
                name: req.session.clientData?.name || ''
            });
        }

        return res.json({
            success: true,
            authenticated: false
        });
    } catch (error) {
        return res.json({
            success: true,
            authenticated: false
        });
    }
}

/**
 * Definir senha (para contas criadas via Hotmart ou sem senha)
 * Requer sessão ativa (autenticado via API Key)
 */
async function handleSetPassword(req, res) {
    try {
        // 0. Verificar dependências
        if (!bcrypt) {
            return res.status(503).json({
                success: false,
                error: 'Serviço temporariamente indisponível'
            });
        }

        if (!db) {
            return res.status(503).json({
                success: false,
                error: 'Banco de dados não disponível'
            });
        }

        // 1. Verificar se está autenticado (via sessão = logado por API Key)
        const tenantId = req.session?.tenantId;
        const apiKey = req.session?.validatedApiKey;

        if (!tenantId || !apiKey) {
            return res.status(401).json({
                success: false,
                error: 'Você precisa estar logado para definir uma senha. Acesse com sua API Key primeiro.'
            });
        }

        // 2. Validar nova senha
        const { password } = req.body || {};

        if (!password || password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Senha deve ter no mínimo 6 caracteres'
            });
        }

        // 3. Verificar se a conta já tem senha
        let existingHash = null;
        try {
            const checkQuery = USE_POSTGRES
                ? `SELECT password_hash FROM tenants WHERE id = $1 LIMIT 1`
                : `SELECT password_hash FROM tenants WHERE id = ? LIMIT 1`;
            const checkResult = await db.query(checkQuery, [tenantId]);
            const rows = checkResult.rows || checkResult;
            if (rows.length > 0) {
                existingHash = rows[0].password_hash;
            }
        } catch (e) {
            console.warn('⚠️ [Auth SetPassword] Erro ao verificar senha existente:', e.message);
        }

        if (existingHash) {
            // Conta já tem senha — exigir senha atual para alterar
            const { currentPassword } = req.body || {};
            if (!currentPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'Sua conta já possui senha. Informe a senha atual para alterá-la.',
                    hasExistingPassword: true
                });
            }

            const currentValid = await bcrypt.compare(currentPassword, existingHash);
            if (!currentValid) {
                return res.status(401).json({
                    success: false,
                    error: 'Senha atual incorreta'
                });
            }
        }

        // 4. Hashear e salvar nova senha
        const passwordHash = await bcrypt.hash(password, 10);

        const updateQuery = USE_POSTGRES
            ? `UPDATE tenants SET password_hash = $1 WHERE id = $2`
            : `UPDATE tenants SET password_hash = ? WHERE id = ?`;

        await db.query(updateQuery, [passwordHash, tenantId]);

        console.log(`✅ [Auth SetPassword] Senha ${existingHash ? 'alterada' : 'definida'} para tenant: ${tenantId.substring(0, 8)}...`);

        return res.json({
            success: true,
            message: existingHash ? 'Senha alterada com sucesso!' : 'Senha definida com sucesso! Agora você pode fazer login com email e senha.'
        });

    } catch (error) {
        console.error('❌ [Auth SetPassword] Erro:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Erro interno. Tente novamente.'
        });
    }
}

/**
 * Registra rotas de login no Express app
 */
function registerLoginRoutes(app) {
    // POST /api/auth/login — Login com email + senha
    app.post('/api/auth/login', handleLogin);

    // POST /api/auth/session-check — Verificar sessão ativa
    app.post('/api/auth/session-check', handleSessionCheck);

    // POST /api/auth/set-password — Definir ou alterar senha
    app.post('/api/auth/set-password', handleSetPassword);

    console.log('🔐 [Auth Login] Rotas registradas: /api/auth/login, /session-check, /set-password');
}

module.exports = {
    registerLoginRoutes,
    handleLogin,
    handleSessionCheck,
    handleSetPassword
};
