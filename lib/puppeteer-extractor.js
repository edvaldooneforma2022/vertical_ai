/**
 * 🔧 PUPPETEER EXTRACTOR — Extração JS-heavy com fallback progressivo
 * 
 * ESTRATÉGIA (cascata):
 *   1. axios + cheerio (rápido) — já feito pelo pipeline existente
 *   2. SE falhar → Google Cache (HTML pré-renderizado, sem deps)
 *   3. SE falhar → Jina Reader API (renderização remota)
 *   4. SE falhar → Puppeteer local (JS render com auto-scroll)
 *   5. Cache de resultado (5 min TTL)
 *   6. Concorrência limitada (max 2 simultâneos)
 *   7. Timeout agressivo (15-20s)
 * 
 * GARANTIAS:
 *   - NÃO impacta funcionalidade existente
 *   - NÃO substitui pipeline atual — COMPLEMENTA
 *   - Feature flag: FEATURE_PUPPETEER=true
 *   - try/catch total com fallback silencioso
 *   - Limitador de concorrência previne crash no Render
 */

const { getBrowser, isAvailable } = require('./puppeteer-client');
const axios = require('axios');
const cheerio = require('cheerio');

// ═══════════════════════════════════════════════════════════════════
// 🌐 WEB RENDERER FALLBACK — Extração via API/Cache (sem Chrome)
// ═══════════════════════════════════════════════════════════════════

/**
 * Tenta extrair via Google Cache (HTML pré-renderizado)
 */
async function extractWithGoogleCache(url) {
    try {
        const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
        console.log(`[WEB-RENDERER] 📦 Tentando Google Cache para: ${(url || '').substring(0, 60)}`);
        
        const response = await axios.get(cacheUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 15000,
            maxRedirects: 3,
            validateStatus: s => s >= 200 && s < 400
        });

        const html = (response.data || '').toString();
        if (!html || html.length < 500) {
            console.log(`[WEB-RENDERER] ⚠️ Google Cache: HTML insuficiente (${html.length})`);
            return null;
        }

        // Parsear HTML com cheerio
        const $ = cheerio.load(html);
        $('script, style, noscript, iframe').remove();
        
        const text = $('body').text().replace(/\s+/g, ' ').trim();
        
        // Extrair links (href + onclick + URLs em texto)
        const links = extractAllLinks($, url);

        console.log(`[WEB-RENDERER] ✅ Google Cache OK | html=${html.length} | text=${text.length} | links=${links.length}`);
        return { text, html, links };

    } catch (err) {
        console.log(`[WEB-RENDERER] ⚠️ Google Cache falhou: ${err.message}`);
        return null;
    }
}

/**
 * Tenta extrair via Jina Reader API (renderização remota)
 */
async function extractWithJinaReader(url) {
    try {
        const jinaUrl = `https://r.jina.ai/${url}`;
        console.log(`[WEB-RENDERER] 🌐 Tentando Jina Reader para: ${(url || '').substring(0, 60)}`);
        
        const response = await axios.get(jinaUrl, {
            headers: {
                'Accept': 'text/plain',
                'User-Agent': 'Mozilla/5.0 (compatible; LinkMagico-Bot/7.0)'
            },
            timeout: 20000,
            maxRedirects: 3
        });

        const text = (response.data || '').toString().trim();
        
        if (!text || text.length < 100) {
            console.log(`[WEB-RENDERER] ⚠️ Jina: texto insuficiente (${text.length})`);
            return null;
        }

        // Extrair links do markdown + URLs brutas
        const links = [];
        const linkRegex = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
        let match;
        while ((match = linkRegex.exec(text)) !== null) {
            links.push({ text: match[1], href: match[2] });
        }
        const urlRegex = /https?:\/\/[^\s"'<>()\[\]{}]+/g;
        (text.match(urlRegex) || []).forEach(u => {
            if (!links.some(l => l.href === u)) links.push({ text: '', href: u });
        });

        console.log(`[WEB-RENDERER] ✅ Jina OK | text=${text.length} | links=${links.length}`);
        return { text, links };

    } catch (err) {
        console.log(`[WEB-RENDERER] ⚠️ Jina falhou: ${err.message}`);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════
// 🔗 EXTRAÇÃO AGRESSIVA DE LINKS (href + onclick + URLs em texto)
// ═══════════════════════════════════════════════════════════════════

/**
 * Extrai TODOS os links possíveis de um HTML parseado pelo cheerio
 * Inclui: <a href>, onclick="...url...", URLs em texto
 */
function extractAllLinks($, inputUrl) {
    const links = [];
    const seen = new Set();

    function addLink(href, text) {
        if (!href || !href.startsWith('http') || seen.has(href)) return;
        seen.add(href);
        links.push({ href, text: (text || '').trim().substring(0, 100) });
    }

    // 1. <a href> tradicionais
    $('a[href]').each((_, el) => {
        const href = ($(el).attr('href') || '').trim();
        const text = $(el).text();
        addLink(href, text);
    });

    // 2. onclick handlers com URLs
    $('[onclick]').each((_, el) => {
        const onclick = $(el).attr('onclick') || '';
        const urlMatches = onclick.match(/https?:\/\/[^\s"'<>()]+/g);
        if (urlMatches) {
            urlMatches.forEach(u => addLink(u, 'onclick'));
        }
        // window.open('url') ou location.href='url'
        const openMatch = onclick.match(/(?:window\.open|location\.href|location\.assign)\s*\(\s*['"](https?:\/\/[^'"]+)['"]/);
        if (openMatch) addLink(openMatch[1], 'onclick-redirect');
    });

    // 3. data-href, data-url, data-link
    $('[data-href], [data-url], [data-link]').each((_, el) => {
        ['data-href', 'data-url', 'data-link'].forEach(attr => {
            const val = $(el).attr(attr) || '';
            if (val.startsWith('http')) addLink(val, 'data-attr');
        });
    });

    // 4. URLs brutas no body text
    const bodyText = $('body').text() || '';
    const urlsInText = bodyText.match(/https?:\/\/[^\s"'<>()\[\]{}]+/g) || [];
    urlsInText.forEach(u => addLink(u, 'text-url'));

    // 5. <button> e <input> com URLs em value/formaction
    $('button[formaction], input[formaction]').each((_, el) => {
        const action = $(el).attr('formaction') || '';
        if (action.startsWith('http')) addLink(action, 'formaction');
    });

    return links;
}

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
    _puppeteerCache.set(key, { data, timestamp: Date.now() });
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
// DECISÃO: QUANDO acionar fallback? (MAIS AGRESSIVO)
// ═══════════════════════════════════════════════════════════════════

/**
 * Determina se a extração precisa de fallback
 * CRITÉRIOS EXPANDIDOS: texto curto OU sem checkout OU sem whatsapp
 */
function shouldUsePuppeteer(pageData) {
    if (!pageData) return true;

    const textLength = (pageData.cleanText || '').length;

    // Texto muito curto → SPA/JS-heavy
    if (textLength < 200) return true;

    // Sem checkout E sem WhatsApp → provavelmente faltou renderizar
    if (!pageData.checkoutLink && !pageData.whatsappLink) return true;

    // Texto curto + sem checkout → alto risco de SPA
    if (textLength < 500 && !pageData.checkoutLink) return true;

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
// EXTRAÇÃO COM PUPPETEER (AUTO-SCROLL + DELAY + EXTRAÇÃO AGRESSIVA)
// ═══════════════════════════════════════════════════════════════════

/**
 * Extrai conteúdo de página JS-heavy usando Puppeteer
 * Com auto-scroll + delay pós-load + extração de onclick/data-attrs
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

        // Navegação: domcontentloaded (rápido) + delay manual para JS
        // networkidle2 FALHA em SPAs pesadas (nunca para de fazer requests)
        try {
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 25000
            });
        } catch (navErr) {
            // Fallback: se até domcontentloaded falhar, tenta com load
            console.log(`[PUPPETEER-EXTRACT] ⚠️ domcontentloaded timeout, tentando com load...`);
            await page.goto(url, {
                waitUntil: 'load',
                timeout: 20000
            });
        }

        // ⏳ Espera para o JS do SPA montar o DOM
        await new Promise(resolve => setTimeout(resolve, 5000));

        // ⚡ AUTO-SCROLL — força lazy-loading de conteúdo
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 300;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight || totalHeight > 5000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        // ⏳ Delay pós-scroll — dá tempo pro JS carregar conteúdo lazy
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Extrair HTML completo
        const html = await page.content();

        // 🔗 EXTRAÇÃO AGRESSIVA DE LINKS
        const links = await page.evaluate(() => {
            const result = [];
            const seen = new Set();

            function addLink(href, text) {
                if (!href || !href.startsWith('http') || seen.has(href)) return;
                seen.add(href);
                result.push({ href, text: (text || '').trim().substring(0, 100) });
            }

            // <a href>
            document.querySelectorAll('a[href]').forEach(a => {
                addLink(a.href, a.innerText);
            });

            // onclick com URLs
            document.querySelectorAll('[onclick]').forEach(el => {
                const onclick = el.getAttribute('onclick') || '';
                const urls = onclick.match(/https?:\/\/[^\s"'<>()]+/g);
                if (urls) urls.forEach(u => addLink(u, 'onclick'));
            });

            // data-href, data-url, data-link
            document.querySelectorAll('[data-href], [data-url], [data-link]').forEach(el => {
                ['data-href', 'data-url', 'data-link'].forEach(attr => {
                    const val = el.getAttribute(attr) || '';
                    if (val.startsWith('http')) addLink(val, 'data-attr');
                });
            });

            // URLs no body text
            const bodyText = document.body?.innerText || '';
            const textUrls = bodyText.match(/https?:\/\/[^\s"'<>()\[\]{}]+/g) || [];
            textUrls.forEach(u => addLink(u, 'text-url'));

            return result;
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

        console.log(`[PUPPETEER-EXTRACT] ✅ Extração OK | url=${url.substring(0, 60)} | html=${html.length} | links=${links.length} | text=${text.length}`);
        console.log('[PUPPETEER] text length:', text.length);
        console.log('[PUPPETEER] links found:', links.length);
        console.log('[PUPPETEER] sample links:', JSON.stringify(links.slice(0, 5).map(l => l.href)));
        if (text.length > 0) {
            console.log('[PUPPETEER] text preview:', text.substring(0, 200));
        }
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
// FUNÇÃO PRINCIPAL: Extração com fallback cascata
// ═══════════════════════════════════════════════════════════════════

/**
 * Tenta enriquecer pageData usando fallbacks progressivos:
 *   1. Google Cache (rápido, sem deps)
 *   2. Jina Reader (renderização remota)
 *   3. Puppeteer local (se disponível)
 */
async function enrichWithPuppeteerFallback(url, pageData, parseHtmlFn) {
    try {
        // Verificar feature flag
        if (process.env.FEATURE_PUPPETEER !== 'true') {
            return pageData;
        }

        // Verificar se precisa de fallback
        if (!shouldUsePuppeteer(pageData)) {
            return pageData;
        }

        // Verificar cache
        const cached = getCached(url);
        if (cached) {
            console.log(`[PUPPETEER-FALLBACK] 📦 Cache hit para ${(url || '').substring(0, 60)}`);
            return cached;
        }

        console.log(`[PUPPETEER-FALLBACK] 🔁 Acionado para ${(url || '').substring(0, 60)} | text=${(pageData.cleanText || '').length} | checkout=${!!pageData.checkoutLink} | wa=${!!pageData.whatsappLink}`);

        // ════════════════════════════════════════════════════════
        // CASCATA DE FALLBACKS
        // ════════════════════════════════════════════════════════
        let fallbackData = null;

        // PASSO 1: Google Cache (rápido, sem deps, HTML renderizado)
        const googleData = await extractWithGoogleCache(url);
        if (googleData && googleData.text && googleData.text.length > 200) {
            fallbackData = googleData;
            fallbackData._source = 'google-cache';
            console.log('[PUPPETEER] ✅ google-cache text length:', googleData.text.length);
            console.log('[PUPPETEER] ✅ google-cache links found:', googleData.links.length);
            console.log('[PUPPETEER] ✅ google-cache sample links:', JSON.stringify(googleData.links.slice(0, 5).map(l => l.href)));
        }

        // PASSO 2: Jina Reader (se Google falhou)
        if (!fallbackData) {
            const jinaData = await extractWithJinaReader(url);
            if (jinaData && jinaData.text && jinaData.text.length > 200) {
                fallbackData = jinaData;
                fallbackData._source = 'jina-reader';
                console.log('[PUPPETEER] ✅ jina-reader text length:', jinaData.text.length);
                console.log('[PUPPETEER] ✅ jina-reader links found:', jinaData.links.length);
                console.log('[PUPPETEER] ✅ jina-reader sample links:', JSON.stringify(jinaData.links.slice(0, 5).map(l => l.href)));
            }
        }

        // PASSO 3: Puppeteer local — executa SE:
        //   A) Tudo falhou (!fallbackData), OU
        //   B) Jina/Google trouxe TEXTO mas NÃO trouxe checkout/whatsapp
        //      (SPAs como leadlovers: texto OK via Jina, mas links JS não capturados)
        const _imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp'];
        const _hasUsefulLinks = fallbackData && fallbackData.links && fallbackData.links.some(l => {
            const h = (l.href || '').toLowerCase();
            const t = (l.text || '').toLowerCase();
            // Ignorar links de imagem (alt text "Botão de WhatsApp" NÃO é um link de WhatsApp)
            if (_imageExts.some(ext => h.includes(ext))) return false;
            // Ignorar links internos do mesmo domínio que são assets
            if (h.includes('/_next/') || h.includes('/img/') || h.includes('/assets/') || h.includes('/uploads/')) return false;
            
            return h.includes('hotmart') || h.includes('kiwify') || h.includes('checkout') ||
                   h.includes('wa.me') || h.includes('whatsapp.com') || h.includes('/pricing') ||
                   h.includes('/planos') || h.includes('/plans') || h.includes('/subscribe') ||
                   t.includes('comprar') || t.includes('começar') || t.includes('assinar') ||
                   t.includes('plano') || t.includes('checkout');
        });
        const _needsPuppeteerLinks = !pageData.checkoutLink && !pageData.whatsappLink && !_hasUsefulLinks;

        console.log(`[PUPPETEER-CASCADE] 🔍 Decisão Puppeteer local: hasUsefulLinks=${_hasUsefulLinks} | needsLinks=${_needsPuppeteerLinks} | available=${isAvailable()} | fallbackData=${!!fallbackData} | commit=b29530a`);

        if ((!fallbackData || _needsPuppeteerLinks) && isAvailable()) {
            console.log(`[PUPPETEER] 🔄 Tentando Puppeteer local... | motivo=${!fallbackData ? 'sem-dados' : 'links-insuficientes'}`);
            try {
                const puppeteerData = await runWithLimit(() => extractWithPuppeteer(url));
                if (puppeteerData) {
                    if (!fallbackData) {
                        // Nenhum dado anterior — usar Puppeteer como fonte principal
                        fallbackData = puppeteerData;
                        fallbackData._source = 'puppeteer';
                    } else {
                        // Jina teve texto bom — MESCLAR links do Puppeteer com texto do Jina
                        console.log(`[PUPPETEER] 🔗 Mesclando ${(puppeteerData.links || []).length} links do Puppeteer com texto do ${fallbackData._source}`);
                        fallbackData.links = [
                            ...(puppeteerData.links || []),
                            ...(fallbackData.links || [])
                        ];
                        // Se Puppeteer trouxe texto melhor, usar
                        if (puppeteerData.text && puppeteerData.text.length > (fallbackData.text || '').length) {
                            fallbackData.text = puppeteerData.text;
                        }
                        fallbackData._source = fallbackData._source + '+puppeteer';
                    }
                }
            } catch (_ppErr) {
                console.warn('[PUPPETEER] ⚠️ Puppeteer local falhou (dados anteriores mantidos):', _ppErr.message);
            }
        }

        if (!fallbackData) {
            console.log(`[PUPPETEER-FALLBACK] ⚠️ Nenhum fallback disponível — mantendo dados originais`);
            console.log('[PUPPETEER] ❌ TODAS as 3 estratégias falharam para:', (url || '').substring(0, 80));
            return pageData;
        }

        // ════════════════════════════════════════════════════════
        // ENRIQUECER pageData (NÃO sobrescrever dados válidos)
        // ════════════════════════════════════════════════════════
        const enriched = { ...pageData };
        const source = fallbackData._source || 'fallback';

        // 🔗 UNIVERSAL: Se pageData já tem discoveredLinks do Cheerio, usar
        // ANTES do fallback (são links extraídos do HTML original)
        if (!enriched.checkoutLink && pageData.discoveredLinks && pageData.discoveredLinks.length > 0) {
            try {
                const _ckPatterns = [
                    'hotmart', 'kiwify', 'eduzz', 'monetizze', 'braip', 'herospark', 'perfectpay',
                    'checkout', '/pagamento', '/pricing', '/planos', '/precos', '/nossos-planos',
                    '/plans', '/comprar', '/assinar', '/subscribe', '/signup',
                    'mercadolivre', 'shopify', 'shopee', 'magazineluiza', 'amazon',
                    '/cart', '/carrinho', '/produto/', '/product/'
                ];
                const _ckTextPatterns = [
                    'comprar', 'assinar', 'começar', 'comecar', 'plano', 'preço', 'preco',
                    'pricing', 'plans', 'buy', 'subscribe', 'checkout', 'signup',
                    'adicionar ao carrinho', 'add to cart', 'garantir', 'adquirir',
                    'quero', 'matricular', 'inscrever', 'finalizar', 'pedir', 'cadastr'
                ];
                const inputBase = (url || '').split('?')[0].replace(/\/$/, '');

                for (const link of pageData.discoveredLinks) {
                    const href = (link.href || '').toLowerCase();
                    const text = (link.text || '').toLowerCase();
                    const linkBase = (link.href || '').split('?')[0].replace(/\/$/, '');

                    if (inputBase === linkBase) continue; // Ignorar self-links

                    const urlMatch = _ckPatterns.some(p => href.includes(p));
                    const textMatch = _ckTextPatterns.some(p => text.includes(p));

                    if (urlMatch || textMatch) {
                        enriched.checkoutLink = link.href;
                        enriched.checkoutSource = 'discoveredLinks';
                        const matchType = urlMatch ? 'url' : 'text';
                        console.log(`[ENRICHMENT] 💰 Checkout via discoveredLinks (${matchType}): ${link.href.substring(0, 80)} [texto="${text.substring(0, 40)}"]`);
                        break;
                    }
                }
            } catch (_dlErr) {
                console.warn('[ENRICHMENT] ⚠️ Erro ao processar discoveredLinks:', _dlErr.message);
            }
        }

        // 📱 WhatsApp: verificar também nos discoveredLinks
        if (!enriched.whatsappLink && pageData.discoveredLinks && pageData.discoveredLinks.length > 0) {
            try {
                const _waPatterns = ['wa.me', 'api.whatsapp.com', 'whatsapp.com/send', 'whatsapp.com/catalog'];
                for (const link of pageData.discoveredLinks) {
                    if (_waPatterns.some(p => (link.href || '').toLowerCase().includes(p))) {
                        enriched.whatsappLink = link.href;
                        console.log(`[ENRICHMENT] 📱 WhatsApp via discoveredLinks: ${link.href.substring(0, 80)}`);
                        break;
                    }
                }
            } catch (_) {}
        }

        // Texto: usar fallback se for melhor
        if (fallbackData.text && fallbackData.text.length > (enriched.cleanText || '').length * 1.3) {
            enriched.cleanText = fallbackData.text;
            enriched.method = source;
            console.log(`[PUPPETEER-FALLBACK] 📝 Texto via ${source}: ${fallbackData.text.length} chars (era ${(pageData.cleanText || '').length})`);
        }

        // HTML: reprocessar com parseHtml se disponível
        if (parseHtmlFn && fallbackData.html && fallbackData.html.length > 1000) {
            try {
                const reparsedText = parseHtmlFn(fallbackData.html);
                if (reparsedText && reparsedText.length > (enriched.cleanText || '').length) {
                    enriched.cleanText = reparsedText;
                    enriched.method = source;
                }
            } catch (_) {}
        }

        // Links: detectar checkout e WhatsApp
        if (fallbackData.links && fallbackData.links.length > 0) {
            // Padrões de URL de checkout/pagamento (UNIVERSAL)
            const checkoutPatterns = [
                // Infoprodutos BR
                'hotmart', 'kiwify', 'eduzz', 'monetizze', 'braip', 'herospark', 'perfectpay',
                'pay.', 'checkout', '/pagamento',
                // SaaS pricing pages
                '/pricing', '/planos', '/precos', '/nossos-planos', '/plans',
                '/comprar', '/assinar', '/subscribe', '/signup', '/register',
                '/buy', '/purchase', '/order',
                // E-commerce BR
                'mercadolivre.com', 'mercadopago.com', 'magazineluiza.com', 'magalu.com',
                'casasbahia.com', 'americanas.com', 'shopee.com.br', 'amazon.com.br',
                'submarino.com', 'pontofrio.com', 'extra.com.br',
                // E-commerce Global
                'shopify.com', 'amazon.com', 'aliexpress.com', 'ebay.com',
                'stripe.com/pay', 'paypal.com/payflow',
                // Carrinho genérico
                '/cart', '/carrinho', '/sacola', '/bag', '/basket',
                '/add-to-cart', '/adicionar', '/pedido',
                // Produto
                '/produto/', '/product/', '/item/'
            ];
            // Padrões de texto âncora que indicam checkout
            const checkoutTextPatterns = [
                'plano', 'preço', 'preco', 'comprar', 'assinar', 'subscribe',
                'pricing', 'plans', 'buy now', 'sign up', 'cadastr',
                'começar', 'comecar', 'start', 'trial', 'upgrade',
                // E-commerce
                'adicionar ao carrinho', 'add to cart', 'compre agora', 'buy now',
                'ver produto', 'ver oferta', 'aproveitar', 'garantir',
                'pedir agora', 'fazer pedido', 'finalizar compra'
            ];
            const whatsappPatterns = ['wa.me', 'api.whatsapp.com', 'whatsapp.com/send', 'whatsapp.com/catalog'];

            for (const link of fallbackData.links) {
                const href = (link.href || '').toLowerCase();
                const linkText = (link.text || '').toLowerCase();

                // Checkout: detectar por URL ou por texto âncora
                if (!enriched.checkoutLink) {
                    const urlMatch = checkoutPatterns.some(p => href.includes(p));
                    const textMatch = checkoutTextPatterns.some(p => linkText.includes(p));
                    
                    if (urlMatch || textMatch) {
                        const inputBase = (url || '').split('?')[0].replace(/\/$/, '');
                        const linkBase = (link.href || '').split('?')[0].replace(/\/$/, '');
                        if (inputBase !== linkBase) {
                            enriched.checkoutLink = link.href;
                            enriched.checkoutSource = source;
                            const matchType = urlMatch ? 'url-pattern' : 'text-pattern';
                            console.log(`[PUPPETEER-FALLBACK] 💰 Checkout via ${source} (${matchType}): ${link.href.substring(0, 80)}`);
                        }
                    }
                }

                // WhatsApp
                if (!enriched.whatsappLink) {
                    if (whatsappPatterns.some(p => href.includes(p))) {
                        enriched.whatsappLink = link.href;
                        console.log(`[PUPPETEER-FALLBACK] 📱 WhatsApp via ${source}: ${link.href.substring(0, 80)}`);
                    }
                }
            }
        }

        // ❓ FAQ: extrair perguntas/respostas do texto enriquecido
        if ((!enriched.faq || enriched.faq.length === 0) && enriched.cleanText && enriched.cleanText.length > 500) {
            try {
                const lines = enriched.cleanText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                const faqItems = [];
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    // Detectar perguntas: termina com ? e tem entre 10-300 chars
                    if (line.endsWith('?') && line.length > 10 && line.length < 300) {
                        // Resposta: próximas linhas até próxima pergunta ou 500 chars
                        let answer = '';
                        for (let j = i + 1; j < lines.length && j <= i + 5; j++) {
                            if (lines[j].endsWith('?') && lines[j].length > 10) break;
                            answer += (answer ? ' ' : '') + lines[j];
                            if (answer.length > 500) break;
                        }
                        if (answer.length > 10) {
                            faqItems.push({ question: line, answer: answer.substring(0, 1000) });
                        }
                    }
                }
                
                if (faqItems.length > 0) {
                    enriched.faq = faqItems.slice(0, 20); // Máx 20 FAQs
                    console.log(`[ENRICHMENT] ❓ ${faqItems.length} FAQs extraídas do texto (${source})`);
                }
            } catch (_faqErr) {
                console.warn('[ENRICHMENT] ⚠️ Erro na extração de FAQ:', _faqErr.message);
            }
        }

        enriched._puppeteerFallback = {
            used: true,
            source,
            timestamp: Date.now(),
            originalTextLength: (pageData.cleanText || '').length,
            enrichedTextLength: (enriched.cleanText || '').length,
            linksFound: (fallbackData.links || []).length
        };

        // Cachear resultado
        setCache(url, enriched);
        return enriched;

    } catch (err) {
        console.error(`[PUPPETEER-FALLBACK] ❌ Erro fatal (pageData inalterado):`, err.message);
        return pageData;
    }
}

module.exports = {
    extractWithPuppeteer,
    extractWithGoogleCache,
    extractWithJinaReader,
    extractAllLinks,
    enrichWithPuppeteerFallback,
    shouldUsePuppeteer,
    isAvailable,
    getCached,
    setCache
};
