/**
 * 🔥 V12.1 — CHECKOUT FALLBACK ENGINE (FIX CROSS-URL)
 * 
 * FIX CRÍTICO V12.1: Checkout agora é vinculado a (apiKey + salesUrl)
 * Em vez de apenas apiKey. Isso corrige o bug onde o mesmo checkout
 * aparecia para TODAS as URLs de um tenant.
 * 
 * Gerencia o ciclo de vida do checkout link por tenant+url:
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
 * @version 12.1.0
 * @author Link Mágico Team
 * 
 * HOTFIX 12.1.0 — Fix cross-URL checkout contamination:
 *   - Chave composta (api_key + sales_url_hash) em vez de apenas api_key
 *   - Migration automática para nova estrutura
 *   - Backward-compatible: busca por apiKey+url primeiro, depois só apiKey
 */

const crypto = require('crypto');

// Cache em memória (evita queries repetidas ao DB)
const _checkoutCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos

// 🔒 Domínios válidos de checkout (whitelist)
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
 * Gera hash da URL de vendas para chave composta
 * @param {string} salesUrl
 * @returns {string}
 */
function hashSalesUrl(salesUrl) {
    if (!salesUrl) return 'default';
    try {
        // Normalizar URL: remover query params, trailing slash, www
        const parsed = new URL(salesUrl);
        const normalized = (parsed.hostname.replace(/^www\./, '') + parsed.pathname.replace(/\/$/, '')).toLowerCase();
        return crypto.createHash('md5').update(normalized).digest('hex').substring(0, 16);
    } catch (_) {
        return crypto.createHash('md5').update(salesUrl || '').digest('hex').substring(0, 16);
    }
}

/**
 * Gera chave de cache composta (apiKey + urlHash)
 * @param {string} apiKey
 * @param {string} salesUrl
 * @returns {string}
 */
function buildCacheKey(apiKey, salesUrl) {
    return `${apiKey}::${hashSalesUrl(salesUrl)}`;
}

/**
 * 🔒 Valida se URL é de domínio de checkout conhecido
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
 * 🔧 Migration: Adiciona coluna sales_url_hash se não existir
 * Chamado automaticamente na primeira operação
 */
let _migrationDone = false;
async function ensureMigration(db) {
    if (_migrationDone) return;
    try {
        // PASSO 1: Verificar se colunas novas já existem
        let hasNewCols = false;
        try {
            const testResult = await db.query(
                `SELECT sales_url_hash FROM tenant_checkout_links LIMIT 1`
            );
            hasNewCols = true;
        } catch (_) {
            // Colunas não existem — precisa migrar
        }

        if (!hasNewCols) {
            // PASSO 2: Adicionar colunas novas
            await db.query(`ALTER TABLE tenant_checkout_links ADD COLUMN IF NOT EXISTS sales_url_hash VARCHAR(16) DEFAULT 'default'`);
            await db.query(`ALTER TABLE tenant_checkout_links ADD COLUMN IF NOT EXISTS sales_url TEXT`);
        }

        // PASSO 3: Dropar PK antiga (api_key solitária) para permitir múltiplos checkouts
        // Isso é CRÍTICO: sem isso, INSERT de 2° checkout do mesmo tenant falha
        try {
            // PostgreSQL: encontrar e dropar constraint de PK
            const pkResult = await db.query(`
                SELECT constraint_name FROM information_schema.table_constraints 
                WHERE table_name = 'tenant_checkout_links' AND constraint_type = 'PRIMARY KEY'
            `);
            if (pkResult && pkResult.rows && pkResult.rows.length > 0) {
                const pkName = pkResult.rows[0].constraint_name;
                await db.query(`ALTER TABLE tenant_checkout_links DROP CONSTRAINT ${pkName}`);
                console.log(`[V12.1] 🔧 PK antiga removida: ${pkName}`);
            }
        } catch (pkErr) {
            // SQLite não suporta DROP CONSTRAINT — ok, gerenciamos via upsert
            console.log('[V12.1] ℹ️ PK drop não aplicável (SQLite ou já removida)');
        }

        // PASSO 4: Criar índice único composto (nova "PK lógica")
        try {
            await db.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_checkout_tenant_url ON tenant_checkout_links(api_key, sales_url_hash)`);
            console.log('[V12.1] ✅ Índice composto (api_key + sales_url_hash) criado');
        } catch (_) {
            // Já existe — ok
        }

        // PASSO 5: Adicionar ID serial como nova PK (PostgreSQL only)
        try {
            await db.query(`ALTER TABLE tenant_checkout_links ADD COLUMN IF NOT EXISTS id SERIAL`);
        } catch (_) {
            // Não crítico
        }

        _migrationDone = true;
        console.log('[V12.1] ✅ Migration checkout multi-URL completa');
    } catch (err) {
        _migrationDone = true;
        console.warn('[V12.1] ⚠️ Migration checkout:', err.message);
    }
}

/**
 * Busca checkout confirmado de um tenant+url no banco de dados
 * @param {Object} db - Instância do banco de dados
 * @param {string} apiKey - API key do tenant
 * @param {string} salesUrl - URL de vendas (opcional, para isolamento por URL)
 * @returns {Promise<string|null>} - URL de checkout ou null
 */
async function getConfirmedCheckout(db, apiKey, salesUrl) {
    try {
        if (!db || !apiKey) return null;

        // Validar formato mínimo da apiKey
        if (typeof apiKey !== 'string' || apiKey.length < 5) {
            console.warn(`[V12.1-SECURITY] ⛔ apiKey inválida rejeitada: "${String(apiKey).substring(0, 20)}"`);
            return null;
        }

        await ensureMigration(db);

        const urlHash = hashSalesUrl(salesUrl);
        const cacheKey = buildCacheKey(apiKey, salesUrl);

        // Verificar cache primeiro
        const cached = _checkoutCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
            if (!isValidCheckoutDomain(cached.url)) {
                console.warn(`[V12.1-SECURITY] ⛔ Checkout cacheado inválido REMOVIDO`);
                _checkoutCache.delete(cacheKey);
            } else {
                console.log(`[V12.1] ✅ Checkout do cache: ${cached.url.substring(0, 60)} (tenant=${apiKey.substring(0, 8)}... url_hash=${urlHash})`);
                return cached.url;
            }
        }

        // ESTRATÉGIA 1: Buscar por apiKey + salesUrl (preciso)
        let result = null;
        try {
            result = await db.query(
                'SELECT checkout_url, source, confirmed, api_key, sales_url_hash FROM tenant_checkout_links WHERE api_key = $1 AND sales_url_hash = $2 ORDER BY confirmed DESC, updated_at DESC LIMIT 1',
                [apiKey, urlHash]
            );
        } catch (_) {
            // Coluna pode não existir ainda — fallback
        }

        // ESTRATÉGIA 2: Fallback para busca só por apiKey (backward compatible)
        if (!result || !result.rows || result.rows.length === 0) {
            result = await db.query(
                'SELECT checkout_url, source, confirmed, api_key FROM tenant_checkout_links WHERE api_key = $1 AND (sales_url_hash IS NULL OR sales_url_hash = $2) ORDER BY confirmed DESC, updated_at DESC LIMIT 1',
                [apiKey, 'default']
            );
        }

        if (result && result.rows && result.rows.length > 0) {
            const row = result.rows[0];
            const checkoutUrl = row.checkout_url;

            // HARD GUARD contra cross-tenant
            if (row.api_key && row.api_key !== apiKey) {
                console.error(`[V12.1-SECURITY] 🚨 CROSS-TENANT BLOCKED!`);
                return null;
            }

            // Validar domínio
            if (!isValidCheckoutDomain(checkoutUrl)) {
                if (!row.confirmed) {
                    console.warn(`[V12.1-SECURITY] ⛔ Checkout auto-detectado com domínio desconhecido REJEITADO`);
                    return null;
                }
            }

            // Atualizar cache
            _checkoutCache.set(cacheKey, {
                url: checkoutUrl,
                source: row.source,
                confirmed: row.confirmed,
                apiKey: apiKey,
                urlHash: urlHash,
                timestamp: Date.now()
            });

            console.log(`[V12.1-AUDIT] ✅ Checkout do DB: tenant=${apiKey.substring(0, 8)}... url_hash=${urlHash} checkout=${checkoutUrl.substring(0, 60)}`);
            return checkoutUrl;
        }

        return null;
    } catch (err) {
        console.warn('[V12.1] ⚠️ Erro ao buscar checkout (sem impacto):', err.message);
        return null;
    }
}

/**
 * Salva checkout link para um tenant+url
 * @param {Object} db - Instância do banco de dados
 * @param {string} apiKey - API key do tenant
 * @param {string} checkoutUrl - URL de checkout
 * @param {string} source - Fonte: 'auto_v112', 'auto_click', 'user_confirmed', 'widget'
 * @param {boolean} confirmed - Se foi confirmado manualmente pelo usuário
 * @param {string} salesUrl - URL de vendas (para isolamento por URL)
 * @returns {Promise<boolean>} - true se salvo com sucesso
 */
async function saveCheckoutLink(db, apiKey, checkoutUrl, source = 'auto_v112', confirmed = false, salesUrl = null) {
    try {
        if (!db || !apiKey || !checkoutUrl) return false;

        if (typeof apiKey !== 'string' || apiKey.length < 5) {
            console.warn(`[V12.1-SECURITY] ⛔ saveCheckout REJEITADO — apiKey inválida`);
            return false;
        }

        // Validar URL
        try { new URL(checkoutUrl); } catch (_) {
            console.warn('[V12.1] ⚠️ URL inválida:', checkoutUrl);
            return false;
        }

        // Validar domínio para auto-detectados
        if (!confirmed && !isValidCheckoutDomain(checkoutUrl)) {
            console.warn(`[V12.1-SECURITY] ⛔ saveCheckout REJEITADO — domínio desconhecido (auto): ${checkoutUrl.substring(0, 80)}`);
            return false;
        }

        await ensureMigration(db);

        const urlHash = hashSalesUrl(salesUrl);
        const cacheKey = buildCacheKey(apiKey, salesUrl);

        console.log(`[V12.1-AUDIT] 💾 saveCheckout: tenant=${apiKey.substring(0, 8)}... url_hash=${urlHash} checkout=${checkoutUrl.substring(0, 60)} source=${source} confirmed=${confirmed}`);

        // Verificar se já existe para este tenant+url EXATO
        let existingResult;
        try {
            existingResult = await db.query(
                'SELECT confirmed FROM tenant_checkout_links WHERE api_key = $1 AND sales_url_hash = $2',
                [apiKey, urlHash]
            );
        } catch (_) {
            existingResult = { rows: [] };
        }

        const hasExisting = existingResult && existingResult.rows && existingResult.rows.length > 0;
        const existingConfirmed = hasExisting
            ? (existingResult.rows[0].confirmed === true || existingResult.rows[0].confirmed === 1)
            : false;

        // Se já confirmado E o novo é auto-detectado → NÃO sobrescrever
        if (existingConfirmed && !confirmed) {
            console.log(`[V12.1] ℹ️ Checkout confirmado já existe para esta URL — auto-detectado ignorado`);
            return false;
        }

        // UPSERT: UPDATE se existe, INSERT se não existe
        if (hasExisting) {
            // UPDATE — atualiza checkout para este tenant+url
            await db.query(
                'UPDATE tenant_checkout_links SET checkout_url = $1, source = $2, confirmed = $3, sales_url = $4, updated_at = CURRENT_TIMESTAMP WHERE api_key = $5 AND sales_url_hash = $6',
                [checkoutUrl, source, confirmed, salesUrl || '', apiKey, urlHash]
            );
            console.log(`[V12.1] 🔄 Checkout ATUALIZADO para tenant=${apiKey.substring(0, 8)}... url_hash=${urlHash}`);
        } else {
            // INSERT — nova linha para este tenant+url (NÃO sobrescreve outras URLs)
            try {
                await db.query(
                    'INSERT INTO tenant_checkout_links (api_key, checkout_url, source, confirmed, sales_url, sales_url_hash) VALUES ($1, $2, $3, $4, $5, $6)',
                    [apiKey, checkoutUrl, source, confirmed, salesUrl || '', urlHash]
                );
                console.log(`[V12.1] ➕ Checkout NOVO inserido para tenant=${apiKey.substring(0, 8)}... url_hash=${urlHash}`);
            } catch (insertErr) {
                // Conflito (PK antiga ou unique index) — UPDATE como fallback
                console.warn(`[V12.1] ⚠️ INSERT falhou (conflito), fazendo UPDATE: ${insertErr.message}`);
                await db.query(
                    'UPDATE tenant_checkout_links SET checkout_url = $1, source = $2, confirmed = $3, sales_url = $4, sales_url_hash = $5, updated_at = CURRENT_TIMESTAMP WHERE api_key = $6 AND (sales_url_hash = $7 OR sales_url_hash = $8)',
                    [checkoutUrl, source, confirmed, salesUrl || '', urlHash, apiKey, urlHash, 'default']
                );
            }
        }

        // Atualizar cache
        _checkoutCache.set(cacheKey, {
            url: checkoutUrl,
            source: source,
            confirmed: confirmed,
            apiKey: apiKey,
            urlHash: urlHash,
            timestamp: Date.now()
        });

        console.log(`[V12.1-AUDIT] ✅ Checkout SALVO: tenant=${apiKey.substring(0, 8)}... url_hash=${urlHash}`);
        return true;
    } catch (err) {
        console.warn('[V12.1] ⚠️ Erro ao salvar checkout:', err.message);
        return false;
    }
}

/**
 * Retorna o status do checkout para um tenant+url (usado pela UI)
 */
async function getCheckoutStatus(db, apiKey, salesUrl) {
    try {
        const checkoutUrl = await getConfirmedCheckout(db, apiKey, salesUrl);
        const cacheKey = buildCacheKey(apiKey, salesUrl);
        const cached = _checkoutCache.get(cacheKey);

        return {
            hasCheckout: !!checkoutUrl,
            checkoutUrl: checkoutUrl || null,
            source: cached ? cached.source : null,
            confirmed: cached ? cached.confirmed : false
        };
    } catch (err) {
        return { hasCheckout: false, checkoutUrl: null, source: null, confirmed: false };
    }
}

/**
 * Limpa cache de um tenant
 */
function clearCache(apiKey) {
    if (apiKey) {
        // Limpar todas as entradas deste tenant
        for (const [key] of _checkoutCache.entries()) {
            if (key.startsWith(apiKey + '::')) {
                _checkoutCache.delete(key);
            }
        }
        console.log(`[V12.1-AUDIT] 🧹 Cache limpo para tenant=${apiKey.substring(0, 8)}...`);
    }
}

/**
 * Reset GLOBAL de cache
 */
function clearAllCache() {
    const size = _checkoutCache.size;
    _checkoutCache.clear();
    console.log(`[V12.1-SECURITY] 🧨 CACHE GLOBAL LIMPO — ${size} entradas removidas`);
}

module.exports = {
    getConfirmedCheckout,
    saveCheckoutLink,
    getCheckoutStatus,
    clearCache,
    clearAllCache,
    isValidCheckoutDomain,
    hashSalesUrl,
    VALID_CHECKOUT_DOMAINS
};
