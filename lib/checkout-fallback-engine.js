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
 * @version 11.3.0
 * @author Link Mágico Team
 */

// Cache em memória (evita queries repetidas ao DB)
const _checkoutCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

/**
 * Busca checkout confirmado de um tenant no banco de dados
 * @param {Object} db - Instância do banco de dados
 * @param {string} apiKey - API key do tenant
 * @returns {Promise<string|null>} - URL de checkout ou null
 */
async function getConfirmedCheckout(db, apiKey) {
    try {
        if (!db || !apiKey) return null;

        // Verificar cache primeiro
        const cached = _checkoutCache.get(apiKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            console.log(`[V11.3-FALLBACK] ✅ Checkout do cache: ${cached.url.substring(0, 60)}`);
            return cached.url;
        }

        // Buscar do banco de dados
        const result = await db.query(
            'SELECT checkout_url, source, confirmed FROM tenant_checkout_links WHERE api_key = $1 ORDER BY confirmed DESC, updated_at DESC LIMIT 1',
            [apiKey]
        );

        if (result && result.rows && result.rows.length > 0) {
            const row = result.rows[0];
            const checkoutUrl = row.checkout_url;

            // Atualizar cache
            _checkoutCache.set(apiKey, {
                url: checkoutUrl,
                source: row.source,
                confirmed: row.confirmed,
                timestamp: Date.now()
            });

            console.log(`[V11.3-FALLBACK] ✅ Checkout do DB: ${checkoutUrl.substring(0, 60)} (source=${row.source}, confirmed=${row.confirmed})`);
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

        // Validar URL
        try {
            new URL(checkoutUrl);
        } catch (_) {
            console.warn('[V11.3-FALLBACK] ⚠️ URL inválida, não salva:', checkoutUrl);
            return false;
        }

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
            console.log(`[V11.3-FALLBACK] ℹ️ Checkout confirmado já existe — auto-detectado ignorado`);
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

        // Atualizar cache
        _checkoutCache.set(apiKey, {
            url: checkoutUrl,
            source: source,
            confirmed: confirmed,
            timestamp: Date.now()
        });

        console.log(`[V11.3-FALLBACK] ✅ Checkout salvo: ${checkoutUrl.substring(0, 60)} (source=${source}, confirmed=${confirmed})`);
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
    if (apiKey) _checkoutCache.delete(apiKey);
}

module.exports = {
    getConfirmedCheckout,
    saveCheckoutLink,
    getCheckoutStatus,
    clearCache
};
