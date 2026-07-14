/**
 * 🔗 WEBHOOK HOTMART — Provisionamento Automático de Tenants
 * Módulo 100% isolado. Registra um Express Router com endpoint público.
 *
 * Quando a Hotmart envia uma notificação de compra aprovada:
 *   1. Valida o hottok (segurança)
 *   2. Cria tenant + API key no banco de dados
 *   3. Adiciona ao JSON de fallback local (api_keys.json)
 *   4. Envia email com a API key ao comprador
 *
 * Variáveis de ambiente necessárias:
 *   HOTMART_HOTTOK        — Token secreto do webhook (configurado na Hotmart)
 *   HOTMART_DEFAULT_PLAN  — Plano padrão para novos clientes (default: "starter")
 *   PLATFORM_URL          — URL pública da plataforma (default: "https://vertical-ai-dktu.onrender.com")
 */

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// ─── Importações seguras (com fallback) ─────────────────────────────────────

let db, USE_POSTGRES, DatabaseHelpers;
try {
    const database = require('./database');
    db = database.db;
    USE_POSTGRES = database.USE_POSTGRES;
    DatabaseHelpers = database.DatabaseHelpers;
} catch (e) {
    console.error('⚠️ [Hotmart] Não foi possível importar database:', e.message);
}

let emailService;
try {
    emailService = require('./email-service').emailService;
} catch (e) {
    console.warn('⚠️ [Hotmart] email-service não disponível — emails não serão enviados');
    emailService = null;
}

// ─── Configurações ──────────────────────────────────────────────────────────

const HOTTOK = process.env.HOTMART_HOTTOK || null;
const DEFAULT_PLAN = process.env.HOTMART_DEFAULT_PLAN || 'starter';
const PLATFORM_URL = process.env.PLATFORM_URL || 'https://linkmagico.app.br';
const API_KEYS_JSON_PATH = path.join(__dirname, 'data', 'api_keys.json');
const PLAN_PRICE_CENTS = parseInt(process.env.HOTMART_PLAN_PRICE_CENTS || '9700'); // R$97,00

// ─── Funções auxiliares ─────────────────────────────────────────────────────

/**
 * Gera API key no formato LMV7-XXXX-XXXX-XXXX
 * (mesmo formato usado pelo gerador manual existente)
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
 * Valida o hottok enviado pela Hotmart
 */
function validateHottok(receivedHottok) {
    if (!HOTTOK) {
        console.warn('⚠️ [Hotmart] HOTMART_HOTTOK não configurado — pulando validação (INSEGURO em produção!)');
        return true; // Em dev, permite sem hottok
    }
    return receivedHottok === HOTTOK;
}

/**
 * Adiciona a API key ao arquivo JSON local (fallback de compatibilidade)
 */
function addToLocalJson(apiKey, nome, plano) {
    try {
        let keys = {};
        if (fs.existsSync(API_KEYS_JSON_PATH)) {
            const raw = fs.readFileSync(API_KEYS_JSON_PATH, 'utf8');
            keys = JSON.parse(raw);
        }

        keys[apiKey] = {
            nome: nome,
            plano: plano,
            active: true,
            created_at: new Date().toISOString(),
            source: 'hotmart_webhook'
        };

        // Garantir que o diretório existe
        const dir = path.dirname(API_KEYS_JSON_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(API_KEYS_JSON_PATH, JSON.stringify(keys, null, 2), 'utf8');
        console.log(`✅ [Hotmart] API key adicionada ao JSON local`);
        return true;
    } catch (error) {
        console.error('❌ [Hotmart] Falha ao adicionar ao JSON local:', error.message);
        return false;
    }
}

/**
 * Desativa uma API key no JSON local pelo email do tenant
 */
function deactivateInLocalJson(email) {
    try {
        if (!fs.existsSync(API_KEYS_JSON_PATH)) return false;

        const raw = fs.readFileSync(API_KEYS_JSON_PATH, 'utf8');
        const keys = JSON.parse(raw);
        let updated = false;

        for (const [key, data] of Object.entries(keys)) {
            if (data.email === email && data.active === true) {
                data.active = false;
                data.deactivated_at = new Date().toISOString();
                data.deactivation_reason = 'hotmart_refund_or_cancel';
                updated = true;
            }
        }

        if (updated) {
            fs.writeFileSync(API_KEYS_JSON_PATH, JSON.stringify(keys, null, 2), 'utf8');
            console.log(`✅ [Hotmart] API key desativada no JSON local para: ${email}`);
        }

        return updated;
    } catch (error) {
        console.error('❌ [Hotmart] Falha ao desativar no JSON local:', error.message);
        return false;
    }
}

/**
 * Verifica se já existe tenant com o email fornecido
 */
async function findTenantByEmail(email) {
    if (!db) return null;

    try {
        const query = USE_POSTGRES
            ? `SELECT * FROM tenants WHERE email = $1 LIMIT 1`
            : `SELECT * FROM tenants WHERE email = ? LIMIT 1`;

        const result = await db.query(query, [email]);
        const rows = result.rows || result;
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('❌ [Hotmart] Erro ao buscar tenant por email:', error.message);
        return null;
    }
}

/**
 * Busca a API key associada a um tenant
 */
async function findApiKeyByTenantId(tenantId) {
    if (!db) return null;

    try {
        const query = USE_POSTGRES
            ? `SELECT key_value FROM api_keys WHERE tenant_id = $1 AND active = true LIMIT 1`
            : `SELECT key_value FROM api_keys WHERE tenant_id = ? AND active = 1 LIMIT 1`;

        const result = await db.query(query, [tenantId]);
        const rows = result.rows || result;
        return rows.length > 0 ? rows[0].key_value : null;
    } catch (error) {
        console.error('❌ [Hotmart] Erro ao buscar API key do tenant:', error.message);
        return null;
    }
}

// ─── Handlers de eventos Hotmart ────────────────────────────────────────────

/**
 * Processa compra aprovada: cria tenant + API key + envia email
 */
async function handlePurchaseApproved(buyerData) {
    const email = buyerData.email;
    const nome = buyerData.name || buyerData.first_name || 'Cliente';
    const plano = DEFAULT_PLAN;

    console.log(`🛒 [Hotmart] Compra aprovada — ${nome} (${email})`);

    // 1. Verificar duplicata
    const existingTenant = await findTenantByEmail(email);
    if (existingTenant) {
        console.log(`ℹ️ [Hotmart] Tenant já existe para ${email} — reativando se necessário`);

        // Reativar se estava suspenso
        if (existingTenant.status !== 'active') {
            try {
                const updateQuery = USE_POSTGRES
                    ? `UPDATE tenants SET status = $1 WHERE id = $2`
                    : `UPDATE tenants SET status = ? WHERE id = ?`;
                await db.query(updateQuery, ['active', existingTenant.id]);
                console.log(`✅ [Hotmart] Tenant reativado: ${existingTenant.id}`);
            } catch (err) {
                console.error('❌ [Hotmart] Falha ao reativar tenant:', err.message);
            }
        }

        // Buscar API key existente e reenviar email
        const existingKey = await findApiKeyByTenantId(existingTenant.id);
        if (existingKey && emailService) {
            await emailService.sendApiKeyEmail(email, nome, existingKey, PLATFORM_URL);
        }

        return { success: true, action: 'reactivated', tenantId: existingTenant.id };
    }

    // 2. Gerar API key
    const apiKey = generateApiKey();
    const keyHash = hashKey(apiKey);
    const tenantId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const apiKeyId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

    console.log(`🔑 [Hotmart] API key gerada: ${apiKey} para tenant ${tenantId}`);

    // 3. Salvar no banco de dados
    if (db) {
        try {
            // Criar tenant
            const insertTenant = USE_POSTGRES
                ? `INSERT INTO tenants (id, name, email, plan, status) VALUES ($1, $2, $3, $4, $5)`
                : `INSERT INTO tenants (id, name, email, plan, status) VALUES (?, ?, ?, ?, ?)`;
            await db.query(insertTenant, [tenantId, nome, email, plano, 'active']);

            // Criar API key
            const insertKey = USE_POSTGRES
                ? `INSERT INTO api_keys (id, tenant_id, key_value, key_hash, active) VALUES ($1, $2, $3, $4, $5)`
                : `INSERT INTO api_keys (id, tenant_id, key_value, key_hash, active) VALUES (?, ?, ?, ?, ?)`;
            await db.query(insertKey, [apiKeyId, tenantId, apiKey, keyHash, USE_POSTGRES ? true : 1]);

            console.log(`✅ [Hotmart] Tenant + API key salvos no banco`);
        } catch (error) {
            console.error('❌ [Hotmart] Falha ao salvar no banco:', error.message);
            // Continuar mesmo assim — o JSON local serve como fallback
        }
    }

    // 4. Adicionar ao JSON local (fallback para compatibilidade)
    addToLocalJson(apiKey, nome, plano);

    // 4.1. Criar assinatura billing e registrar evento (para dashboard admin)
    try {
        const { getAuditLedger } = require('./billing-audit');
        const subId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
        if (USE_POSTGRES && db) {
            await db.query(
                `INSERT INTO billing_subscriptions (id, tenant_id, plan_id, status, payment_method, metadata, amount_cents)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (tenant_id) DO UPDATE SET plan_id = $3, status = $4, amount_cents = $7, updated_at = CURRENT_TIMESTAMP`,
                [subId, tenantId, plano, 'active', 'hotmart', JSON.stringify({ email, nome }), PLAN_PRICE_CENTS]
            );
            console.log(`💳 [Hotmart] billing_subscription criada para tenant ${tenantId}`);
        }
        const ledger = getAuditLedger();
        await ledger.recordEvent({
            tenantId, eventType: 'subscription_created', planId: plano,
            amountCents: PLAN_PRICE_CENTS, source: 'hotmart',
            newState: { plan: plano, status: 'active' },
            metadata: { email, nome }
        });
    } catch (e) {
        console.warn('⚠️ [Hotmart] Erro ao criar billing_subscription (não crítico):', e.message);
    }

    // 5. Atualizar env API_KEYS_JSON se disponível (para Render)
    try {
        const localKeys = {};
        if (fs.existsSync(API_KEYS_JSON_PATH)) {
            Object.assign(localKeys, JSON.parse(fs.readFileSync(API_KEYS_JSON_PATH, 'utf8')));
        }
        // O JSON já foi atualizado por addToLocalJson, então a variável de ambiente
        // ficará desatualizada em relação ao arquivo. Isso é esperado — o validateApiKey
        // no server.js primeiro consulta o banco (que já foi atualizado) e só usa o JSON
        // como fallback se o banco não tiver a chave.
    } catch (e) {
        // Silencioso — não é crítico
    }

    // 6. Enviar email com API key
    if (emailService) {
        const emailResult = await emailService.sendApiKeyEmail(email, nome, apiKey, PLATFORM_URL);
        console.log(`📧 [Hotmart] Email: ${emailResult.message}`);
    } else {
        // Fallback: logar a API key no console
        console.log('═══════════════════════════════════════════════════');
        console.log(`🔑 [Hotmart] API KEY PARA ${nome} (${email}): ${apiKey}`);
        console.log('═══════════════════════════════════════════════════');
    }

    return { success: true, action: 'created', tenantId, apiKey };
}

/**
 * Processa reembolso/cancelamento: desativa o tenant
 */
async function handlePurchaseCancelled(buyerData) {
    const email = buyerData.email;
    const nome = buyerData.name || buyerData.first_name || 'Cliente';

    console.log(`🚫 [Hotmart] Reembolso/Cancelamento — ${nome} (${email})`);

    // 1. Desativar no banco
    if (db) {
        try {
            const tenant = await findTenantByEmail(email);
            if (tenant) {
                const updateQuery = USE_POSTGRES
                    ? `UPDATE tenants SET status = $1 WHERE id = $2`
                    : `UPDATE tenants SET status = ? WHERE id = ?`;
                await db.query(updateQuery, ['suspended', tenant.id]);

                // Desativar todas as API keys do tenant
                const deactivateKeys = USE_POSTGRES
                    ? `UPDATE api_keys SET active = false WHERE tenant_id = $1`
                    : `UPDATE api_keys SET active = 0 WHERE tenant_id = ?`;
                await db.query(deactivateKeys, [tenant.id]);

                console.log(`✅ [Hotmart] Tenant suspenso: ${tenant.id}`);

                // Registrar cancelamento no billing (dashboard admin)
                try {
                    if (USE_POSTGRES) {
                        await db.query(
                            `UPDATE billing_subscriptions SET status = $1, cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $2`,
                            ['cancelled', tenant.id]
                        );
                    }
                    const { getAuditLedger } = require('./billing-audit');
                    const ledger = getAuditLedger();
                    await ledger.recordEvent({
                        tenantId: tenant.id, eventType: 'subscription_cancelled',
                        source: 'hotmart', previousState: { status: 'active' },
                        newState: { status: 'cancelled' },
                        metadata: { email, reason: 'hotmart_refund_or_cancel' }
                    });
                } catch (e) {
                    console.warn('⚠️ [Hotmart] Erro ao atualizar billing_subscription (não crítico):', e.message);
                }
            } else {
                console.log(`ℹ️ [Hotmart] Nenhum tenant encontrado para ${email} — nada a desativar`);
            }
        } catch (error) {
            console.error('❌ [Hotmart] Falha ao desativar no banco:', error.message);
        }
    }

    // 2. Desativar no JSON local
    deactivateInLocalJson(email);

    return { success: true, action: 'suspended' };
}

// ─── Endpoint principal ─────────────────────────────────────────────────────

/**
 * POST /api/webhooks/hotmart
 *
 * Payload da Hotmart (formato padrão):
 * {
 *   "event": "PURCHASE_APPROVED",
 *   "hottok": "token-secreto",
 *   "data": {
 *     "buyer": { "email": "...", "name": "..." },
 *     "product": { "id": 123, "name": "Link Mágico" },
 *     "purchase": { "transaction": "HP123...", "status": "approved" }
 *   }
 * }
 */
router.post('/api/webhooks/hotmart', async (req, res) => {
    const startTime = Date.now();

    // Responder 200 imediatamente (Hotmart exige resposta rápida)
    // O processamento continua em background
    res.status(200).json({ success: true, message: 'Webhook recebido' });

    try {
        const payload = req.body;

        console.log(`📥 [Hotmart] Webhook recebido — Evento: ${payload.event || 'desconhecido'}`);

        // 1. Validar hottok
        const receivedHottok = payload.hottok || req.headers['x-hotmart-hottok'] || req.query.hottok;
        if (!validateHottok(receivedHottok)) {
            console.error('❌ [Hotmart] Hottok inválido — webhook rejeitado');
            return;
        }

        // 2. Extrair dados do comprador
        const buyer = payload.data?.buyer || payload.buyer || {};

        if (!buyer.email) {
            console.error('❌ [Hotmart] Email do comprador não encontrado no payload');
            console.log('📋 [Hotmart] Payload recebido:', JSON.stringify(payload, null, 2));
            return;
        }

        // 3. Processar evento
        const event = (payload.event || '').toUpperCase();

        switch (event) {
            case 'PURCHASE_APPROVED':
            case 'PURCHASE_COMPLETE':
            case 'PURCHASE_PROTEST': // Pode ser reaprovada
                await handlePurchaseApproved(buyer);
                break;

            case 'PURCHASE_REFUNDED':
            case 'PURCHASE_CHARGEDBACK':
            case 'PURCHASE_CANCELED':
            case 'SUBSCRIPTION_CANCELLATION':
                await handlePurchaseCancelled(buyer);
                break;

            case 'PURCHASE_DELAYED':
            case 'PURCHASE_BILLET_PRINTED':
                // Apenas logar — não provisionar ainda (esperando confirmação de pagamento)
                console.log(`ℹ️ [Hotmart] Evento informativo: ${event} — ${buyer.email}`);
                break;

            default:
                console.log(`⚠️ [Hotmart] Evento desconhecido: ${event}`);
                console.log('📋 [Hotmart] Payload:', JSON.stringify(payload, null, 2));
        }

        const duration = Date.now() - startTime;
        console.log(`✅ [Hotmart] Webhook processado em ${duration}ms`);

    } catch (error) {
        console.error('❌ [Hotmart] Erro ao processar webhook:', error.message);
        console.error(error.stack);
    }
});

// ─── Endpoint de status/teste ───────────────────────────────────────────────

router.get('/api/webhooks/hotmart/status', (req, res) => {
    res.json({
        success: true,
        service: 'Hotmart Webhook — Provisionamento Automático',
        configured: !!HOTTOK,
        emailService: emailService ? emailService.configured : false,
        defaultPlan: DEFAULT_PLAN,
        platformUrl: PLATFORM_URL,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
