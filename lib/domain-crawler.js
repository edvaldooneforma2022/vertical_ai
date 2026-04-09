/**
 * 🕸️ DOMAIN CRAWLER V11.2 — SUBLINKS INTELIGENTE
 * 
 * Navega a partir de uma URL base e coleta sublinks do mesmo domínio.
 * Retorna array de páginas com URL + HTML para extração de conteúdo.
 * 
 * REGRAS:
 * - 100% aditivo — não altera nenhum módulo existente
 * - try/catch total — fallback para array vazio
 * - Timeout por request (8s) + limite de páginas (default 5)
 * - Não sai do domínio base
 * 
 * @version 11.2.0
 * @author Link Mágico Team
 */

const axios = require('axios');
const cheerio = require('cheerio');

// Cache simples por URL (TTL 10 min)
const _crawlCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

// Limpeza automática do cache a cada 5 minutos
setInterval(() => {
  try {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, entry] of _crawlCache.entries()) {
      if (now - entry.timestamp > CACHE_TTL) {
        _crawlCache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[DOMAIN-CRAWLER] 🧹 ${cleaned} entradas de cache expiradas removidas`);
    }
  } catch (_) {}
}, 5 * 60 * 1000);

/**
 * Extrai o domínio base de uma URL
 * @param {string} url
 * @returns {string|null}
 */
function getBaseDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch (_) {
    return null;
  }
}

/**
 * Crawla um domínio a partir de uma URL base
 * Coleta até `limit` páginas do mesmo domínio
 * 
 * @param {string} baseUrl - URL inicial para começar o crawl
 * @param {number} limit - Máximo de páginas a coletar (default: 5)
 * @returns {Promise<Array<{url: string, html: string}>>} - Array de páginas coletadas
 */
async function crawlDomain(baseUrl, limit = 5) {
  try {
    if (!baseUrl || typeof baseUrl !== 'string') {
      console.warn('[DOMAIN-CRAWLER] ⚠️ URL inválida');
      return [];
    }

    // Verificar cache
    const cacheKey = `${baseUrl}_${limit}`;
    const cached = _crawlCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      console.log(`[DOMAIN-CRAWLER] 📦 Cache hit para: ${baseUrl.substring(0, 60)}`);
      return cached.pages;
    }

    const baseDomain = getBaseDomain(baseUrl);
    if (!baseDomain) {
      console.warn('[DOMAIN-CRAWLER] ⚠️ Não foi possível extrair domínio de:', baseUrl.substring(0, 80));
      return [];
    }

    const visited = new Set();
    const queue = [baseUrl];
    const pages = [];
    const startTime = Date.now();

    console.log(`[DOMAIN-CRAWLER] 🕸️ Iniciando crawl: ${baseUrl.substring(0, 80)} (limit=${limit})`);

    while (queue.length > 0 && pages.length < limit) {
      const url = queue.shift();

      // Normalizar URL (remover trailing slash, fragmentos)
      let normalizedUrl;
      try {
        const parsed = new URL(url);
        parsed.hash = '';
        normalizedUrl = parsed.href.replace(/\/$/, '');
      } catch (_) {
        continue;
      }

      if (visited.has(normalizedUrl)) continue;
      visited.add(normalizedUrl);

      try {
        const { data } = await axios.get(normalizedUrl, {
          timeout: 8000,
          maxRedirects: 3,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; LinkMagicoBot/1.0)',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
          },
          // Limitar tamanho da resposta (2MB max)
          maxContentLength: 2 * 1024 * 1024,
          validateStatus: (status) => status >= 200 && status < 400
        });

        // Verificar se é HTML
        if (typeof data !== 'string') continue;

        const $ = cheerio.load(data);
        pages.push({ url: normalizedUrl, html: data });

        console.log(`[DOMAIN-CRAWLER] ✅ Página ${pages.length}/${limit}: ${normalizedUrl.substring(0, 80)}`);

        // Extrair links do mesmo domínio
        $('a[href]').each((_, el) => {
          try {
            let href = $(el).attr('href');
            if (!href) return;

            // Ignorar links indesejados
            if (href.startsWith('#') || href.startsWith('mailto:') || 
                href.startsWith('tel:') || href.startsWith('javascript:')) {
              return;
            }

            // Resolver URLs relativas
            if (href.startsWith('/')) {
              href = new URL(href, baseDomain).href;
            } else if (!href.startsWith('http')) {
              href = new URL(href, normalizedUrl).href;
            }

            // Normalizar
            try {
              const parsed = new URL(href);
              parsed.hash = '';
              href = parsed.href.replace(/\/$/, '');
            } catch (_) {
              return;
            }

            // Verificar se é do mesmo domínio
            if (href.startsWith(baseDomain) && !visited.has(href)) {
              // Filtrar extensões de arquivo (imagens, pdfs, etc)
              const ext = href.split('.').pop()?.toLowerCase();
              const skipExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'pdf', 'zip', 'mp4', 'mp3', 'css', 'js'];
              if (!skipExtensions.includes(ext)) {
                queue.push(href);
              }
            }
          } catch (_) {}
        });

      } catch (reqErr) {
        console.log(`[DOMAIN-CRAWLER] ⚠️ Falha ao acessar ${normalizedUrl.substring(0, 60)}: ${reqErr.message}`);
        // Continuar com próxima URL
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[DOMAIN-CRAWLER] 🏁 Crawl finalizado: ${pages.length} páginas em ${elapsed}ms`);

    // Salvar no cache
    _crawlCache.set(cacheKey, { pages, timestamp: Date.now() });

    return pages;

  } catch (err) {
    console.warn('[DOMAIN-CRAWLER] ⚠️ Erro geral:', err.message);
    return [];
  }
}

module.exports = { crawlDomain, getBaseDomain };
