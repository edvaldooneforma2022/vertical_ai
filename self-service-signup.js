/**
 * 🆓 SELF-SERVICE SIGNUP — Link Mágico
 * Módulo isolado para cadastro self-service com plano Free.
 * 
 * Feature Flag: FEATURE_SELF_SERVICE_SIGNUP (default: true)
 * Pode ser desligado instantaneamente via env var.
 * 
 * NÃO IMPACTA nenhuma funcionalidade existente:
 * - Hotmart webhook continua funcionando normalmente
 * - API Keys existentes não são afetadas
 * - Billing enforcement existente é reutilizado
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Tentar carregar bcryptjs (fallback seguro se não disponível)
let bcrypt;
try {
    bcrypt = require('bcryptjs');
} catch (e) {
    console.warn('⚠️ [Signup] bcryptjs não disponível — signup desabilitado');
    bcrypt = null;
}

// Carregar dependências do sistema existente
let db, USE_POSTGRES, emailService;
try {
    const database = require('./database');
    db = database.db;
    USE_POSTGRES = database.USE_POSTGRES;
} catch (e) {
    console.warn('⚠️ [Signup] database não disponível:', e.message);
}

try {
    emailService = require('./email-service');
} catch (e) {
    console.warn('⚠️ [Signup] email-service não disponível');
    emailService = null;
}

// ─── Configurações ──────────────────────────────────────────────────────────

const PLATFORM_URL = process.env.PLATFORM_URL || 'https://linkmagico.app.br';
const API_KEYS_JSON_PATH = path.join(__dirname, 'data', 'api_keys.json');
const SIGNUP_RATE_LIMIT = new Map(); // IP -> { count, resetAt }
const MAX_SIGNUPS_PER_IP = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hora

// ─── Funções auxiliares ─────────────────────────────────────────────────────

/**
 * Gera API key no formato LMV7-XXXX-XXXX-XXXX
 * (mesmo formato do hotmart-webhook.js)
 */
function generateApiKey() {
    const prefix = 'LMV7';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = [];

    for (let i = 0; i < 3; i++) {
        let segment = '';
        for (let j = 0; j < 4; j++) {
            const randomIndex = crypto.randomInt(0, chars.length);
            segment += chars.charAt(randomIndex);
        }
        segments.push(segment);
    }

    return `${prefix}-${segments.join('-')}`;
}

/**
 * Gera hash SHA-256 da API key (compatível com validateApiKey do server.js)
 */
function hashKey(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Rate limiting por IP
 */
function checkRateLimit(ip) {
    const now = Date.now();
    const entry = SIGNUP_RATE_LIMIT.get(ip);

    if (!entry || now > entry.resetAt) {
        SIGNUP_RATE_LIMIT.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }

    if (entry.count >= MAX_SIGNUPS_PER_IP) {
        return false;
    }

    entry.count++;
    return true;
}

/**
 * Salvar API key no JSON local (fallback, compatível com Hotmart)
 */
function addToLocalJson(apiKey, nome, plano, email) {
    try {
        let keys = {};
        if (fs.existsSync(API_KEYS_JSON_PATH)) {
            const raw = fs.readFileSync(API_KEYS_JSON_PATH, 'utf8');
            keys = JSON.parse(raw);
        }

        keys[apiKey] = {
            nome: nome,
            email: email,
            plano: plano,
            active: true,
            created_at: new Date().toISOString(),
            source: 'self_service_signup'
        };

        const dir = path.dirname(API_KEYS_JSON_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(API_KEYS_JSON_PATH, JSON.stringify(keys, null, 2), 'utf8');
        console.log(`✅ [Signup] API key adicionada ao JSON local`);
        return true;
    } catch (error) {
        console.error('❌ [Signup] Falha ao adicionar ao JSON local:', error.message);
        return false;
    }
}

// ─── Handler principal de signup ────────────────────────────────────────────

async function handleSignup(req, res) {
    try {
        // 0. Verificar se bcrypt está disponível
        if (!bcrypt) {
            return res.status(503).json({
                success: false,
                error: 'Serviço de cadastro temporariamente indisponível'
            });
        }

        // 1. Validar dados de entrada
        const { email, password, name } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email e senha são obrigatórios'
            });
        }

        // Validar formato do email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Formato de email inválido'
            });
        }

        // Validar senha mínima
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Senha deve ter no mínimo 6 caracteres'
            });
        }

        // 2. Rate limiting
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
        if (!checkRateLimit(clientIp)) {
            return res.status(429).json({
                success: false,
                error: 'Muitas tentativas de cadastro. Tente novamente em 1 hora.'
            });
        }

        // 3. Verificar duplicata de email
        if (db) {
            try {
                const checkQuery = USE_POSTGRES
                    ? `SELECT id FROM tenants WHERE LOWER(email) = LOWER($1) LIMIT 1`
                    : `SELECT id FROM tenants WHERE LOWER(email) = LOWER(?) LIMIT 1`;
                const result = await db.query(checkQuery, [email.trim()]);
                const rows = result.rows || result;

                if (rows.length > 0) {
                    return res.status(409).json({
                        success: false,
                        error: 'Este email já está cadastrado. Use sua API Key existente ou entre em contato com o suporte.'
                    });
                }
            } catch (dbErr) {
                console.warn('⚠️ [Signup] Erro ao verificar duplicata (continuando):', dbErr.message);
            }
        }

        // 4. Hashear senha
        const passwordHash = await bcrypt.hash(password, 10);

        // 5. Gerar API Key
        const apiKey = generateApiKey();
        const keyHash = hashKey(apiKey);
        const tenantId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
        const apiKeyId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
        const clientName = (name || '').trim() || email.split('@')[0];
        const plano = 'free';

        console.log(`🆓 [Signup] Novo cadastro self-service — ${clientName} (${email})`);

        // 6. Salvar no banco de dados
        if (db) {
            try {
                // Criar tenant
                const insertTenant = USE_POSTGRES
                    ? `INSERT INTO tenants (id, name, email, plan, status, password_hash, signup_source) VALUES ($1, $2, $3, $4, $5, $6, $7)`
                    : `INSERT INTO tenants (id, name, email, plan, status, password_hash, signup_source) VALUES (?, ?, ?, ?, ?, ?, ?)`;
                await db.query(insertTenant, [tenantId, clientName, email.trim().toLowerCase(), plano, 'active', passwordHash, 'self_service']);

                // Criar API key
                const insertKey = USE_POSTGRES
                    ? `INSERT INTO api_keys (id, tenant_id, key_value, key_hash, active) VALUES ($1, $2, $3, $4, $5)`
                    : `INSERT INTO api_keys (id, tenant_id, key_value, key_hash, active) VALUES (?, ?, ?, ?, ?)`;
                await db.query(insertKey, [apiKeyId, tenantId, apiKey, keyHash, USE_POSTGRES ? true : 1]);

                console.log(`✅ [Signup] Tenant + API key salvos no banco`);
            } catch (dbError) {
                // Verificar se é erro de email duplicado (race condition)
                if (dbError.message && (dbError.message.includes('unique') || dbError.message.includes('duplicate') || dbError.message.includes('UNIQUE'))) {
                    return res.status(409).json({
                        success: false,
                        error: 'Este email já está cadastrado.'
                    });
                }
                console.error('❌ [Signup] Falha ao salvar no banco:', dbError.message);
                // Continuar — JSON local serve como fallback
            }
        }

        // 7. Salvar no JSON local (fallback)
        addToLocalJson(apiKey, clientName, plano, email.trim().toLowerCase());

        // 8. Criar assinatura billing (plano free)
        try {
            const { billingManager } = require('./billing');
            await billingManager.createSubscription(apiKey, 'free', 'self_service');
        } catch (e) {
            console.warn('⚠️ [Signup] Erro ao criar billing subscription (não crítico):', e.message);
        }

        // 9. Registrar evento no audit ledger
        try {
            const { getAuditLedger } = require('./billing-audit');
            const ledger = getAuditLedger();
            await ledger.recordEvent({
                tenantId, eventType: 'signup_self_service', planId: plano,
                amountCents: 0, source: 'self_service',
                newState: { plan: plano, status: 'active' },
                metadata: { email: email.trim().toLowerCase(), name: clientName }
            });
        } catch (e) {
            // Silencioso — audit é best-effort
        }

        // 10. Enviar email de boas-vindas com API Key
        if (emailService && emailService.sendApiKeyEmail) {
            try {
                await emailService.sendApiKeyEmail(email.trim(), clientName, apiKey, PLATFORM_URL);
                console.log(`📧 [Signup] Email de boas-vindas enviado para ${email}`);
            } catch (emailErr) {
                console.warn('⚠️ [Signup] Falha ao enviar email (não crítico):', emailErr.message);
            }
        }

        // 10.5 Agendar sequência de onboarding (5 emails)
        try {
            const { enqueueOnboardingEmails } = require('./email-queue-worker');
            await enqueueOnboardingEmails(tenantId, apiKey, email.trim(), clientName);
        } catch (e) {
            // Fail-safe: signup funciona mesmo sem onboarding
            console.warn('⚠️ [Signup] Falha ao agendar onboarding (não crítico):', e.message);
        }

        // 11. Sucesso!
        console.log(`🎉 [Signup] Cadastro concluído! ${clientName} — Plano Free — Key: ${apiKey.substring(0, 9)}...`);

        return res.status(201).json({
            success: true,
            message: 'Conta criada com sucesso!',
            apiKey: apiKey,
            plan: plano,
            limits: {
                messages: 100,
                chatbots: 1,
                extractions: 3
            },
            panelUrl: `${PLATFORM_URL}/app`,
            nextSteps: [
                'Copie sua API Key acima',
                'Acesse o painel em /app',
                'Cole o link da sua página e comece a vender!'
            ]
        });

    } catch (error) {
        console.error('❌ [Signup] Erro inesperado:', error);
        return res.status(500).json({
            success: false,
            error: 'Erro interno. Tente novamente em alguns instantes.'
        });
    }
}

// ─── Registro de rotas ──────────────────────────────────────────────────────

function registerRoutes(app) {
    // POST /api/auth/signup — Cadastro self-service
    app.post('/api/auth/signup', handleSignup);

    // GET /api/auth/signup/status — Health check do signup
    app.get('/api/auth/signup/status', (req, res) => {
        res.json({
            enabled: true,
            bcryptAvailable: !!bcrypt,
            dbAvailable: !!db,
            emailAvailable: !!(emailService && emailService.sendApiKeyEmail)
        });
    });

    console.log('🆓 [Signup] Rotas de self-service registradas: POST /api/auth/signup');
}

module.exports = {
    registerRoutes,
    handleSignup,
    generateApiKey,
    hashKey
};
