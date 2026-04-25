/**
 * 🔧 PUPPETEER EXTRACTOR — Extração JS-heavy com fallback progressivo
 * 
 * ESTRATÉGIA:
 *   1. axios + cheerio (rápido) — já feito pelo pipeline existente
 *   2. SE falhar → Puppeteer (JS render) — este módulo
 *   3. Cache de resultado (5 min TTL)
 *   4. Concorrência limitada (max 2 simultâneos)
 *   5. Timeout agressivo (15s)
 * 
 * GARANTIAS:
 *   - NÃO impacta funcionalidade existente
 *   - NÃO substitui pipeline atual — COMPLEMENTA
 *   - Feature flag: FEATURE_PUPPETEER=true
 *   - try/catch total com fallback silencioso
 *   - Limitador de concorrência previne crash no Render
 */

const { getBrowser, isAvailable } = require('./puppeteer-client');

// ═══════════════════════════════════════════════════════════════════
// CACHE (evita re-extração desnecessária)
// ═══════════════════════════════════════════════════════════════════

const _puppeteerCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function getCached(url) {
    const key = (url || '').split('?')[0];
    const entry = _puppeteerCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL) {
        _puppeteerCache.delete(key);
        return null;
    }
    return entry.data;
}

function setCache(url, data) {
    const key = (url || '').split('?')[0];
    _puppeteerCache.set(key, {
        data,
        timestamp: Date.now()
    });

    // Limpar cache antigo (max 50 entradas)
    if (_puppeteerCache.size > 50) {
        const oldest = Array.from(_puppeteerCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
        if (oldest) _puppeteerCache.delete(oldest[0]);
    }
}

// ═══════════════════════════════════════════════════════════════════
// LIMITADOR DE CONCORRÊNCIA (CRÍTICO em produção)
// ═══════════════════════════════════════════════════════════════════

const _queue = [];
let _active = 0;
const MAX_CONCURRENT = 2;

function runWithLimit(fn) {
    return new Promise((resolve, reject) => {
        _queue.push({ fn, resolve, reject });
        _processQueue();
    });
}

async function _processQueue() {
    if (_active >= MAX_CONCURRENT || _queue.length === 0) return;

    const job = _queue.shift();
    _active++;

    try {
        const result = await job.fn();
        job.resolve(result);
    } catch (err) {
        job.reject(err);
    } finally {
        _active--;
        _processQueue();
    }
}

// ═══════════════════════════════════════════════════════════════════
// DECISÃO: QUANDO usar Puppeteer?
// ═══════════════════════════════════════════════════════════════════

/**
 * Determina se a extração precisa de Puppeteer como fallback
 * @param {Object} pageData - Dados extraídos pelo pipeline axios+cheerio
 * @returns {boolean}
 */
function shouldUsePuppeteer(pageData) {
    if (!pageData) return true;

    const textLength = (pageData.cleanText || '').length;

    // Texto muito curto → página renderiza via JS
    if (textLength < 200) return true;

    // Sem checkout E sem WhatsApp E texto curto → provavelmente JS-heavy
    if (!pageData.checkoutLink && !pageData.whatsappLink && textLength < 500) return true;

    // Extração falhou explicitamente
    if (pageData.method === 'fallback' || pageData.error) return true;

    // V18 Guard detectou falha
    if (pageData._extractionGuard) {
        const guard = pageData._extractionGuard;
        if (guard.status === 'failed') return true;
        if (guard.confidence < 30) return true;
    }

    return false;
}

// ═══════════════════════════════════════════════════════════════════
// EXTRAÇÃO COM PUPPETEER
// ═══════════════════════════════════════════════════════════════════

/**
 * Extrai conteúdo de página JS-heavy usando Puppeteer
 * @param {string} url
 * @returns {Promise<{html: string, links: Array, text: string}|null>}
 */
async function extractWithPuppeteer(url) {
    if (!isAvailable()) {
        console.log('[PUPPETEER-EXTRACT] ⚠️ Puppeteer não disponível');
        return null;
    }

    const browser = await getBrowser();
    if (!browser) return null;

    let page = null;
    try {
        page = await browser.newPage();

        // Bloquear recursos pesados (performance)
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const type = req.resourceType();
            if (['stylesheet', 'font', 'image', 'media'].includes(type)) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Timeout agressivo: 15s
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 15000
        });

        // Espera mínima para JS montar DOM
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Extrair HTML completo
        const html = await page.content();

        // Extrair links
        const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href]')).map(a => ({
                href: a.href,
                text: (a.innerText || '').trim().substring(0, 100)
            })).filter(l => l.href && l.href.startsWith('http'));
        });

        // Extrair texto visível
        const text = await page.evaluate(() => {
            const elements = document.querySelectorAll('h1, h2, h3, h4, p, li, span, div, td, th, label, button, a');
            const texts = new Set();
            elements.forEach(el => {
                const t = (el.innerText || '').trim();
                if (t.length > 15 && t.length < 1000) {
                    texts.add(t);
                }
            });
            return Array.from(texts).join('\n');
        });

        console.log(`[PUPPETEER-EXTRACT] ✅ Extração OK | url=${url.substring(0, 60)} | html=${html.length} chars | links=${links.length} | text=${text.length} chars`);

        return { html, links, text };

    } catch (err) {
        console.error(`[PUPPETEER-EXTRACT] ❌ Erro: ${err.message} | url=${(url || '').substring(0, 60)}`);
        return null;
    } finally {
        if (page) {
            try { await page.close(); } catch (_) {}
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL: Extração com fallback Puppeteer
// ═══════════════════════════════════════════════════════════════════

/**
 * Tenta enriquecer pageData usando Puppeteer como fallback
 * NÃO substitui extractPageData — é chamado DEPOIS, se necessário
 * 
 * @param {string} url - URL da página
 * @param {Object} pageData - Dados existentes (do axios+cheerio)
 * @param {Object} parseHtmlFn - Função para reprocessar HTML (extractCleanTextFromHTML)
 * @returns {Promise<Object>} pageData enriquecido
 */
async function enrichWithPuppeteerFallback(url, pageData, parseHtmlFn) {
    try {
        // Verificar feature flag
        const puppeteerEnabled = process.env.FEATURE_PUPPETEER === 'true';
        if (!puppeteerEnabled) {
            return pageData;
        }

        // Verificar se precisa de Puppeteer
        if (!shouldUsePuppeteer(pageData)) {
            return pageData;
        }

        // Verificar cache
        const cached = getCached(url);
        if (cached) {
            console.log(`[PUPPETEER-FALLBACK] 📦 Cache hit para ${(url || '').substring(0, 60)}`);
            return cached;
        }

        console.log(`[PUPPETEER-FALLBACK] 🔁 Acionado para ${(url || '').substring(0, 60)} | textLength=${(pageData.cleanText || '').length}`);

        // Executar com limite de concorrência
        const puppeteerData = await runWithLimit(() => extractWithPuppeteer(url));

        if (!puppeteerData) {
            console.log(`[PUPPETEER-FALLBACK] ⚠️ Puppeteer retornou null — mantendo dados originais`);
            return pageData;
        }

        // Enriquecer pageData (NÃO sobrescrever dados existentes válidos)
        const enriched = { ...pageData };

        // Texto: usar Puppeteer se for significativamente melhor
        if (puppeteerData.text && puppeteerData.text.length > (enriched.cleanText || '').length * 1.5) {
            enriched.cleanText = puppeteerData.text;
            enriched.method = 'puppeteer-fallback';
            console.log(`[PUPPETEER-FALLBACK] 📝 Texto atualizado: ${puppeteerData.text.length} chars (era ${(pageData.cleanText || '').length})`);
        }

        // HTML: reprocessar com parseHtml se disponível
        if (parseHtmlFn && puppeteerData.html && puppeteerData.html.length > 1000) {
            try {
                const reparsedText = parseHtmlFn(puppeteerData.html);
                if (reparsedText && reparsedText.length > (enriched.cleanText || '').length) {
                    enriched.cleanText = reparsedText;
                    enriched.method = 'puppeteer-fallback';
                }
            } catch (_) {}
        }

        // Links: tentar detectar checkout e WhatsApp nos links do Puppeteer
        if (puppeteerData.links && puppeteerData.links.length > 0) {
            const checkoutPatterns = ['hotmart', 'kiwify', 'eduzz', 'monetizze', 'braip', 'herospark', 'perfectpay', 'pay.', 'checkout', '/pagamento'];
            const whatsappPatterns = ['wa.me', 'api.whatsapp.com', 'whatsapp.com/send'];

            for (const link of puppeteerData.links) {
                const href = (link.href || '').toLowerCase();

                // Checkout (só se não tiver)
                if (!enriched.checkoutLink) {
                    if (checkoutPatterns.some(p => href.includes(p))) {
                        // Não usar URL de entrada como checkout
                        const inputBase = (url || '').split('?')[0].replace(/\/$/, '');
                        const linkBase = (link.href || '').split('?')[0].replace(/\/$/, '');
                        if (inputBase !== linkBase) {
                            enriched.checkoutLink = link.href;
                            enriched.checkoutSource = 'puppeteer-fallback';
                            console.log(`[PUPPETEER-FALLBACK] 💰 Checkout descoberto: ${link.href.substring(0, 80)}`);
                        }
                    }
                }

                // WhatsApp (só se não tiver)
                if (!enriched.whatsappLink) {
                    if (whatsappPatterns.some(p => href.includes(p))) {
                        enriched.whatsappLink = link.href;
                        console.log(`[PUPPETEER-FALLBACK] 📱 WhatsApp descoberto: ${link.href.substring(0, 80)}`);
                    }
                }
            }
        }

        enriched._puppeteerFallback = {
            used: true,
            timestamp: Date.now(),
            originalTextLength: (pageData.cleanText || '').length,
            enrichedTextLength: (enriched.cleanText || '').length,
            linksFound: (puppeteerData.links || []).length
        };

        // Cachear resultado
        setCache(url, enriched);

        return enriched;

    } catch (err) {
        console.error(`[PUPPETEER-FALLBACK] ❌ Erro fatal (pageData inalterado):`, err.message);
        return pageData; // Fallback silencioso
    }
}

module.exports = {
    extractWithPuppeteer,
    enrichWithPuppeteerFallback,
    shouldUsePuppeteer,
    isAvailable,
    getCached,
    setCache
};
