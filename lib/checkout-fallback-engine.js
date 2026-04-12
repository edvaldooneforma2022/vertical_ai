/**
 * 🔥 V11.3 — CHECKOUT FALLBACK ENGINE (FALLBACK INVISÍVEL)
 * 
 * Gerencia o ciclo de vida do checkout link por tenant:
 *   1. Verifica se já existe checkout confirmado no DB (prioridade MÁXIMA)
 *   2. Aceita checkout auto-detectado (V11.2) como candidato
 *   3. Persiste checkout confirmado pelo usuário
 *   4. Cache em memória para performance (TTL 30min)
 * 
 * REGRAS:
 *   - 100% aditivo — não altera nenhum módulo existente
 *   - Protegido por FEATURE_V11_3_FALLBACK
 *   - try/catch total — fallback para null (sem impacto)
 *   - Zero impacto em modo manual/desligado (lógica de modo fica no caller)
 * 
 * @version 11.3.1-hotfix
 * @author Link Mágico Team
 * 
 * HOTFIX 11.3.1 — Contenção de incidente cross-tenant:
 *   - Guard contra contaminação cross-tenant
 *   - Validação de domínio do checkout URL
 *   - clearAllCache() para reset emergencial
 *   - Audit logging em todas as operações
 */

// Cache em memória (evita queries repetidas ao DB)
const _checkoutCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

// 🔒 HOTFIX 11.3.1: Domínios válidos de checkout (whitelist)
const VALID_CHECKOUT_DOMAINS = [
    'hotmart.com', 'pay.hotmart.com', 'go.hotmart.com',
    'kiwify.com.br', 'pay.kiwify.com.br',
    'eduzz.com', 'checkout.eduzz.com', 'sun.eduzz.com',
    'monetizze.com.br',
    'braip.com', 'ev.braip.com',
    'herospark.com', 'pay.herospark.com',
    'lastlink.com',
    'pagar.me', 'checkout.stripe.com',
    'mpago.la', 'mercadopago.com', 'mercadopago.com.br',
    'pagseguro.uol.com.br',
    'paypal.com',
    'perfectpay.com.br',
    'greenn.com.br',
    'pepper.com.br'
];

/**
 * 🔒 HOTFIX 11.3.1: Valida se URL é de domínio de checkout conhecido
 * @param {string} url
 * @returns {boolean}
 */
function isValidCheckoutDomain(url) {
    try {
        if (!url) return false;
        const hostname = new URL(url).hostname.toLowerCase();
        return VALID_CHECKOUT_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
    } catch (_) {
        return false;
    }
}

/**
 * Busca checkout confirmado de um tenant no banco de dados
 * @param {Object} db - Instância do banco de dados
 * @param {string} apiKey - API key do tenant
 * @returns {Promise<string|null>} - URL de checkout ou null
 */
async function getConfirmedCheckout(db, apiKey) {
    try {
        if (!db || !apiKey) return null;

        // 🔒 HOTFIX 11.3.1: Validar formato mínimo da apiKey
        if (typeof apiKey !== 'string' || apiKey.length < 5) {
            console.warn(`[V11.3-SECURITY] ⛔ apiKey inválida rejeitada: "${String(apiKey).substring(0, 20)}"`);
            return null;
        }

        // Verificar cache primeiro
        const cached = _checkoutCache.get(apiKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            // 🔒 HOTFIX 11.3.1: Validar domínio do checkout cacheado
            if (!isValidCheckoutDomain(cached.url)) {
                console.warn(`[V11.3-SECURITY] ⛔ Checkout cacheado com domínio inválido REMOVIDO: ${cached.url.substring(0, 60)}`);
                _checkoutCache.delete(apiKey);
                // NÃO retorna — vai buscar do DB
            } else {
                console.log(`[V11.3-FALLBACK] ✅ Checkout do cache: ${cached.url.substring(0, 60)} (tenant=${apiKey.substring(0, 8)}...)`);
                return cached.url;
            }
        }

        // Buscar do banco de dados
        const result = await db.query(
            'SELECT checkout_url, source, confirmed, api_key FROM tenant_checkout_links WHERE api_key = $1 ORDER BY confirmed DESC, updated_at DESC LIMIT 1',
            [apiKey]
        );

        if (result && result.rows && result.rows.length > 0) {
            const row = result.rows[0];
            const checkoutUrl = row.checkout_url;

            // 🔒 HOTFIX 11.3.1: HARD GUARD contra cross-tenant
            if (row.api_key && row.api_key !== apiKey) {
                console.error(`[V11.3-SECURITY] 🚨 CROSS-TENANT BLOCKED! Requested=${apiKey.substring(0, 8)}... Returned=${row.api_key.substring(0, 8)}... URL=${checkoutUrl.substring(0, 60)}`);
                return null;
            }

            // 🔒 HOTFIX 11.3.1: Validar domínio do checkout do DB
            if (!isValidCheckoutDomain(checkoutUrl)) {
                console.warn(`[V11.3-SECURITY] ⚠️ Checkout do DB com domínio desconhecido (tenant=${apiKey.substring(0, 8)}...): ${checkoutUrl.substring(0, 80)}`);
                // Permite URLs desconhecidas se confirmadas manualmente pelo usuário
                if (!row.confirmed) {
                    console.warn(`[V11.3-SECURITY] ⛔ Checkout auto-detectado com domínio desconhecido REJEITADO`);
                    return null;
                }
            }

            // Atualizar cache (com apiKey para verificação futura)
            _checkoutCache.set(apiKey, {
                url: checkoutUrl,
                source: row.source,
                confirmed: row.confirmed,
                apiKey: apiKey, // 🔒 guardar para cross-check
                timestamp: Date.now()
            });

            console.log(`[V11.3-AUDIT] ✅ Checkout do DB: tenant=${apiKey.substring(0, 8)}... url=${checkoutUrl.substring(0, 60)} source=${row.source} confirmed=${row.confirmed}`);
            return checkoutUrl;
        }

        return null;
    } catch (err) {
        console.warn('[V11.3-FALLBACK] ⚠️ Erro ao buscar checkout do DB (sem impacto):', err.message);
        return null;
    }
}

/**
 * Salva checkout link para um tenant (auto-detectado ou confirmado pelo usuário)
 * @param {Object} db - Instância do banco de dados
 * @param {string} apiKey - API key do tenant
 * @param {string} checkoutUrl - URL de checkout
 * @param {string} source - Fonte: 'auto_v112', 'auto_click', 'user_confirmed', 'widget'
 * @param {boolean} confirmed - Se foi confirmado manualmente pelo usuário
 * @returns {Promise<boolean>} - true se salvo com sucesso
 */
async function saveCheckoutLink(db, apiKey, checkoutUrl, source = 'auto_v112', confirmed = false) {
    try {
        if (!db || !apiKey || !checkoutUrl) return false;

        // 🔒 HOTFIX 11.3.1: Validar formato mínimo da apiKey
        if (typeof apiKey !== 'string' || apiKey.length < 5) {
            console.warn(`[V11.3-SECURITY] ⛔ saveCheckout REJEITADO — apiKey inválida: "${String(apiKey).substring(0, 20)}"`);
            return false;
        }

        // Validar URL
        try {
            new URL(checkoutUrl);
        } catch (_) {
            console.warn('[V11.3-FALLBACK] ⚠️ URL inválida, não salva:', checkoutUrl);
            return false;
        }

        // 🔒 HOTFIX 11.3.1: Validar domínio do checkout
        if (!confirmed && !isValidCheckoutDomain(checkoutUrl)) {
            console.warn(`[V11.3-SECURITY] ⛔ saveCheckout REJEITADO — domínio desconhecido (auto-detectado): ${checkoutUrl.substring(0, 80)}`);
            return false;
        }

        // 🔒 HOTFIX 11.3.1: Audit log
        console.log(`[V11.3-AUDIT] 💾 saveCheckout: tenant=${apiKey.substring(0, 8)}... url=${checkoutUrl.substring(0, 60)} source=${source} confirmed=${confirmed}`);

        // Upsert: se já existe, atualizar; senão, inserir
        // Prioridade: user_confirmed SEMPRE sobrescreve auto-detectado
        const existingResult = await db.query(
            'SELECT confirmed FROM tenant_checkout_links WHERE api_key = $1',
            [apiKey]
        );

        const existingConfirmed = existingResult && existingResult.rows && existingResult.rows.length > 0
            ? (existingResult.rows[0].confirmed === true || existingResult.rows[0].confirmed === 1)
            : false;

        // Se já confirmado manualmente E o novo é auto-detectado → NÃO sobrescrever
        if (existingConfirmed && !confirmed) {
            console.log(`[V11.3-FALLBACK] ℹ️ Checkout confirmado já existe — auto-detectado ignorado (tenant=${apiKey.substring(0, 8)}...)`);
            return false;
        }

        if (existingResult && existingResult.rows && existingResult.rows.length > 0) {
            await db.query(
                'UPDATE tenant_checkout_links SET checkout_url = $1, source = $2, confirmed = $3, updated_at = CURRENT_TIMESTAMP WHERE api_key = $4',
                [checkoutUrl, source, confirmed, apiKey]
            );
        } else {
            await db.query(
                'INSERT INTO tenant_checkout_links (api_key, checkout_url, source, confirmed) VALUES ($1, $2, $3, $4)',
                [apiKey, checkoutUrl, source, confirmed]
            );
        }

        // Atualizar cache (com apiKey para cross-check)
        _checkoutCache.set(apiKey, {
            url: checkoutUrl,
            source: source,
            confirmed: confirmed,
            apiKey: apiKey, // 🔒 guardar para cross-check
            timestamp: Date.now()
        });

        console.log(`[V11.3-AUDIT] ✅ Checkout SALVO: tenant=${apiKey.substring(0, 8)}... url=${checkoutUrl.substring(0, 60)} source=${source} confirmed=${confirmed}`);
        return true;
    } catch (err) {
        console.warn('[V11.3-FALLBACK] ⚠️ Erro ao salvar checkout (sem impacto):', err.message);
        return false;
    }
}

/**
 * Retorna o status do checkout para um tenant (usado pela UI)
 * @param {Object} db - Instância do banco de dados
 * @param {string} apiKey - API key do tenant
 * @returns {Promise<Object>} - { hasCheckout, checkoutUrl, source, confirmed }
 */
async function getCheckoutStatus(db, apiKey) {
    try {
        const checkoutUrl = await getConfirmedCheckout(db, apiKey);
        const cached = _checkoutCache.get(apiKey);

        return {
            hasCheckout: !!checkoutUrl,
            checkoutUrl: checkoutUrl || null,
            source: cached ? cached.source : null,
            confirmed: cached ? cached.confirmed : false
        };
    } catch (err) {
        return {
            hasCheckout: false,
            checkoutUrl: null,
            source: null,
            confirmed: false
        };
    }
}

/**
 * Limpa cache de um tenant (ex: após atualização)
 * @param {string} apiKey
 */
function clearCache(apiKey) {
    if (apiKey) {
        _checkoutCache.delete(apiKey);
        console.log(`[V11.3-AUDIT] 🧹 Cache limpo para tenant=${apiKey.substring(0, 8)}...`);
    }
}

/**
 * 🧨 HOTFIX 11.3.1: Reset GLOBAL de cache (contenção de incidente)
 * Uso: emergência em produção quando há contaminação cross-tenant
 */
function clearAllCache() {
    const size = _checkoutCache.size;
    _checkoutCache.clear();
    console.log(`[V11.3-SECURITY] 🧨 CACHE GLOBAL LIMPO — ${size} entradas removidas`);
}

module.exports = {
    getConfirmedCheckout,
    saveCheckoutLink,
    getCheckoutStatus,
    clearCache,
    clearAllCache,
    isValidCheckoutDomain,
    VALID_CHECKOUT_DOMAINS
};
