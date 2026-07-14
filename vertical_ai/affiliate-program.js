/**
 * 🤝 PROGRAMA DE AFILIADOS — Link Mágico
 * Sistema de indicação com link referral e comissão.
 *
 * SAFE PATCH - Módulo 100% isolado e aditivo.
 * NÃO IMPACTA nenhuma funcionalidade existente.
 * Feature Flag: FEATURE_AFFILIATES (default: true)
 *
 * Rotas:
 *   GET  /api/affiliates/my-link — Obter link de indicação
 *   GET  /api/affiliates/stats — Estatísticas de indicações
 *   GET  /r/:code — Redirect de referral (público)
 *
 * Como funciona:
 *   1. Cada tenant tem um código de referral único (ref_xxxxx)
 *   2. Compartilha link: site.linkmagico.app.br/?ref=ref_xxxxx
 *   3. Novo signup com ?ref= vincula ao afiliado
 *   4. Quando indicado paga → afiliado ganha comissão
 */

const crypto = require('crypto');

const APP_URL = process.env.APP_URL || 'https://linkmagico.app.br';
const SITE_URL = process.env.SITE_URL || 'https://site.linkmagico.app.br';
const COMMISSION_PERCENT = parseInt(process.env.AFFILIATE_COMMISSION || '20', 10); // 20% padrão
const FEATURE_ENABLED = process.env.FEATURE_AFFILIATES !== 'false';

/**
 * Gerar código de referral único
 */
function generateReferralCode() {
    return 'ref_' + crypto.randomBytes(4).toString('hex'); // ref_ + 8 chars hex
}

/**
 * Migration: criar tabela de referrals
 */
async function ensureAffiliatesTables() {
    if (!FEATURE_ENABLED) return;

    try {
        const { db, USE_POSTGRES } = require('./database');
        if (!db || !USE_POSTGRES) return;

        // Coluna referral_code no tenant
        await db.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS referral_code TEXT`);
        await db.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS referred_by TEXT`); // código do afiliado

        // Tabela de comissões
        await db.query(`
            CREATE TABLE IF NOT EXISTS affiliate_commissions (
                id SERIAL PRIMARY KEY,
                affiliate_tenant_id TEXT NOT NULL,
                referred_tenant_id TEXT NOT NULL,
                event_type TEXT DEFAULT 'signup',
                plan_id TEXT,
                amount_cents INT DEFAULT 0,
                commission_cents INT DEFAULT 0,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        // Index para busca rápida
        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_referral_code 
            ON tenants(referral_code) WHERE referral_code IS NOT NULL
        `).catch(() => {});

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_tenant
            ON affiliate_commissions(affiliate_tenant_id)
        `).catch(() => {});

        console.log('🤝 [Affiliates] Tabelas verificadas');
    } catch (e) {
        if (!e.message.includes('already exists')) {
            console.warn('⚠️ [Affiliates] Migration:', e.message);
        }
    }
}

/**
 * Registra rotas de afiliados no Express app
 */
function registerAffiliateRoutes(app) {
    if (!FEATURE_ENABLED) {
        console.log('⚠️ [Affiliates] Feature desabilitada (FEATURE_AFFILIATES=false)');
        return;
    }

    // GET /api/affiliates/my-link — Obter/gerar link de indicação
    app.get('/api/affiliates/my-link', async (req, res) => {
        try {
            const apiKey = req.query.apiKey || req.session?.validatedApiKey;
            if (!apiKey) {
                return res.status(401).json({ success: false, error: 'API Key obrigatória' });
            }

            const { db, USE_POSTGRES } = require('./database');
            if (!db || !USE_POSTGRES) {
                return res.status(503).json({ success: false, error: 'DB não disponível' });
            }

            // Buscar tenant e código existente
            const result = await db.query(
                `SELECT t.id, t.referral_code, t.name, t.email
                 FROM tenants t JOIN api_keys ak ON t.id = ak.tenant_id
                 WHERE ak.key_value = $1 AND ak.active = true LIMIT 1`,
                [apiKey]
            );
            const rows = result.rows || result;

            if (rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Tenant não encontrado' });
            }

            let { referral_code } = rows[0];

            // Gerar código se não existe
            if (!referral_code) {
                referral_code = generateReferralCode();
                await db.query(
                    `UPDATE tenants SET referral_code = $1 WHERE id = $2`,
                    [referral_code, rows[0].id]
                );
                console.log(`🤝 [Affiliates] Código gerado: ${referral_code} para ${rows[0].id.substring(0, 8)}...`);
            }

            const referralLink = `${SITE_URL}/?ref=${referral_code}`;

            return res.json({
                success: true,
                referralCode: referral_code,
                referralLink: referralLink,
                commissionPercent: COMMISSION_PERCENT,
                shareLinks: {
                    whatsapp: `https://wa.me/?text=${encodeURIComponent(`Crie seu vendedor IA com o LinkMágico! 🚀 ${referralLink}`)}`,
                    copy: referralLink
                }
            });

        } catch (err) {
            console.error('❌ [Affiliates] Erro ao obter link:', err.message);
            res.status(500).json({ success: false, error: 'Erro interno' });
        }
    });

    // GET /api/affiliates/stats — Estatísticas do afiliado
    app.get('/api/affiliates/stats', async (req, res) => {
        try {
            const apiKey = req.query.apiKey || req.session?.validatedApiKey;
            if (!apiKey) {
                return res.status(401).json({ success: false, error: 'API Key obrigatória' });
            }

            const { db, USE_POSTGRES } = require('./database');
            if (!db || !USE_POSTGRES) {
                return res.status(503).json({ success: false, error: 'DB não disponível' });
            }

            // Buscar tenant
            const tenantResult = await db.query(
                `SELECT t.id, t.referral_code FROM tenants t JOIN api_keys ak ON t.id = ak.tenant_id
                 WHERE ak.key_value = $1 AND ak.active = true LIMIT 1`,
                [apiKey]
            );
            const tenantRows = tenantResult.rows || tenantResult;
            if (tenantRows.length === 0) {
                return res.status(404).json({ success: false, error: 'Tenant não encontrado' });
            }

            const tenantId = tenantRows[0].id;

            // Total de indicados
            const referredResult = await db.query(
                `SELECT COUNT(*) as count FROM tenants WHERE referred_by = $1`,
                [tenantRows[0].referral_code]
            );
            const referredCount = parseInt((referredResult.rows || referredResult)[0]?.count || '0');

            // Indicados que viraram pagantes
            const paidResult = await db.query(
                `SELECT COUNT(*) as count FROM tenants 
                 WHERE referred_by = $1 AND plan IS NOT NULL AND plan != 'free'`,
                [tenantRows[0].referral_code]
            );
            const paidCount = parseInt((paidResult.rows || paidResult)[0]?.count || '0');

            // Comissões
            const commissionsResult = await db.query(
                `SELECT 
                    COALESCE(SUM(commission_cents), 0) as total_cents,
                    COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_cents ELSE 0 END), 0) as paid_cents,
                    COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_cents ELSE 0 END), 0) as pending_cents,
                    COUNT(*) as events
                 FROM affiliate_commissions 
                 WHERE affiliate_tenant_id = $1`,
                [tenantId]
            );
            const commissions = (commissionsResult.rows || commissionsResult)[0] || {};

            return res.json({
                success: true,
                stats: {
                    referredTotal: referredCount,
                    referredPaid: paidCount,
                    conversionRate: referredCount > 0 ? Math.round((paidCount / referredCount) * 100) : 0,
                    commissions: {
                        totalBRL: (parseInt(commissions.total_cents || '0') / 100).toFixed(2),
                        paidBRL: (parseInt(commissions.paid_cents || '0') / 100).toFixed(2),
                        pendingBRL: (parseInt(commissions.pending_cents || '0') / 100).toFixed(2),
                        events: parseInt(commissions.events || '0')
                    },
                    commissionPercent: COMMISSION_PERCENT
                }
            });

        } catch (err) {
            console.error('❌ [Affiliates] Erro ao buscar stats:', err.message);
            res.status(500).json({ success: false, error: 'Erro interno' });
        }
    });

    console.log(`🤝 [Affiliates] Rotas registradas (comissão: ${COMMISSION_PERCENT}%)`);
}

/**
 * Registra um referral no signup (chamado pelo self-service-signup)
 * @param {string} tenantId — ID do novo tenant
 * @param {string} referralCode — Código ref_xxx vindo do signup
 */
async function registerReferral(tenantId, referralCode) {
    if (!FEATURE_ENABLED || !referralCode) return;

    try {
        const { db, USE_POSTGRES } = require('./database');
        if (!db || !USE_POSTGRES) return;

        // Verificar se código existe
        const result = await db.query(
            `SELECT id FROM tenants WHERE referral_code = $1 LIMIT 1`,
            [referralCode]
        );
        const rows = result.rows || result;

        if (rows.length === 0) {
            console.warn(`⚠️ [Affiliates] Código referral inválido: ${referralCode}`);
            return;
        }

        const affiliateId = rows[0].id;

        // Não permite auto-referência
        if (affiliateId === tenantId) return;

        // Marcar referred_by no novo tenant
        await db.query(
            `UPDATE tenants SET referred_by = $1 WHERE id = $2`,
            [referralCode, tenantId]
        );

        // Registrar evento de comissão (signup — sem valor ainda)
        await db.query(
            `INSERT INTO affiliate_commissions (affiliate_tenant_id, referred_tenant_id, event_type, status)
             VALUES ($1, $2, 'signup', 'pending')`,
            [affiliateId, tenantId]
        );

        console.log(`🤝 [Affiliates] Referral registrado: ${referralCode} → ${tenantId.substring(0, 8)}...`);
    } catch (e) {
        // Silencioso — referral é bonus, não pode impactar signup
        console.warn('⚠️ [Affiliates] Erro ao registrar referral:', e.message);
    }
}

/**
 * Registra comissão quando indicado paga (chamado pelo webhook do Stripe)
 * @param {string} apiKey — API Key do tenant que pagou
 * @param {string} planId — Plano contratado
 * @param {number} amountCents — Valor pago em centavos
 */
async function registerCommission(apiKey, planId, amountCents) {
    if (!FEATURE_ENABLED) return;

    try {
        const { db, USE_POSTGRES } = require('./database');
        if (!db || !USE_POSTGRES) return;

        // Buscar tenant e verificar se tem referral
        const result = await db.query(
            `SELECT t.id, t.referred_by FROM tenants t 
             JOIN api_keys ak ON t.id = ak.tenant_id 
             WHERE ak.key_value = $1 AND ak.active = true LIMIT 1`,
            [apiKey]
        );
        const rows = result.rows || result;

        if (rows.length === 0 || !rows[0].referred_by) return;

        const referredCode = rows[0].referred_by;

        // Buscar afiliado
        const affiliateResult = await db.query(
            `SELECT id FROM tenants WHERE referral_code = $1 LIMIT 1`,
            [referredCode]
        );
        const affiliateRows = affiliateResult.rows || affiliateResult;
        if (affiliateRows.length === 0) return;

        const commissionCents = Math.round(amountCents * COMMISSION_PERCENT / 100);

        await db.query(
            `INSERT INTO affiliate_commissions (affiliate_tenant_id, referred_tenant_id, event_type, plan_id, amount_cents, commission_cents, status)
             VALUES ($1, $2, 'payment', $3, $4, $5, 'pending')`,
            [affiliateRows[0].id, rows[0].id, planId, amountCents, commissionCents]
        );

        console.log(`💰 [Affiliates] Comissão registrada: R$${(commissionCents / 100).toFixed(2)} (${COMMISSION_PERCENT}% de R$${(amountCents / 100).toFixed(2)}) para afiliado ${affiliateRows[0].id.substring(0, 8)}...`);
    } catch (e) {
        console.warn('⚠️ [Affiliates] Erro ao registrar comissão:', e.message);
    }
}

module.exports = {
    registerAffiliateRoutes,
    ensureAffiliatesTables,
    registerReferral,
    registerCommission,
    generateReferralCode
};
