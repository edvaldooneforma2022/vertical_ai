/**
 * 🌐 V14.3 DEEP CONTEXT EXPLORER
 * 
 * Eleva o sistema de extração de "página" para "ecossistema completo".
 * Explora links internos do mesmo domínio (até 3 níveis, max 5-10 páginas),
 * consolida FAQ, contatos, checkout e conteúdo de múltiplas fontes.
 * 
 * REGRAS:
 * - 100% aditivo — NÃO quebra pipeline atual
 * - try/catch em TUDO — fallback para modo atual
 * - Feature flag: FEATURE_DEEP_CONTEXT_EXPLORER
 * - Performance controlada: timeout global + limite de páginas
 * - Output unificado com confidenceScore
 * 
 * @version 14.3.0
 * @author Link Mágico Team
 */

'use strict';

const axios = require('axios');
const cheerio = require('cheerio');

// ===== CONFIGURAÇÃO =====
const DEFAULTS = {
    maxPages: 5,
    maxDepth: 3,
    timeoutPerPage: 8000,    // 8s por página
    globalTimeout: 45000,    // 45s total
    sameDomainOnly: true,
    userAgent: 'Mozilla/5.0 (compatible; LinkMagicoBot/14.3; Deep Context Explorer)'
};

// ===== CLASSIFICAÇÃO DE LINKS =====
const LINK_PATTERNS = {
    checkout: [
        /checkout/i, /comprar/i, /buy/i, /pagar/i, /pagamento/i,
        /hotmart\.com/i, /kiwify\.com/i, /eduzz\.com/i, /monetizze\.com/i,
        /braip\.com/i, /perfectpay\.com/i, /herospark\.com/i,
        /stripe\.com/i, /paypal\.com/i, /mercadopago/i, /pagseguro/i
    ],
    suporte: [
        /wa\.me/i, /whatsapp/i, /api\.whatsapp/i,
        /suporte/i, /support/i, /contato/i, /contact/i,
        /ajuda/i, /help/i, /atendimento/i,
        /telegram\.me/i, /t\.me/i
    ],
    conteudo: [
        /sobre/i, /about/i, /depoimento/i, /testimonial/i,
        /resultado/i, /result/i, /faq/i, /duvida/i, /perguntas/i,
        /blog/i, /artigo/i, /article/i, /como-funciona/i
    ]
};

/**
 * Classifica um link por seu provável propósito
 * @param {string} href - URL do link
 * @param {string} anchorText - Texto âncora do link
 * @returns {string} 'checkout' | 'suporte' | 'conteudo' | 'outro'
 */
function classifyLink(href, anchorText = '') {
    try {
        const combined = `${href} ${anchorText}`.toLowerCase();
        for (const [type, patterns] of Object.entries(LINK_PATTERNS)) {
            for (const pattern of patterns) {
                if (pattern.test(combined)) return type;
            }
        }
        return 'conteudo'; // Default: considerar como conteúdo
    } catch (_) {
        return 'outro';
    }
}

/**
 * Extrai FAQ de uma página usando seletores comuns
 * @param {CheerioAPI} $ - Instância do Cheerio
 * @returns {Array<{question: string, answer: string}>}
 */
function extractFAQFromPage($) {
    const faqItems = [];
    try {
        const faqSelectors = [
            { container: '.elementor-toggle-item', title: '.elementor-toggle-title', content: '.elementor-tab-content' },
            { container: '.elementor-accordion-item', title: '.elementor-accordion-title', content: '.elementor-accordion-content' },
            { container: 'details', title: 'summary', content: 'p' },
            { container: '.faq-item', title: '.faq-question, .question, h3, h4', content: '.faq-answer, .answer, p' },
            { container: '.accordion-item', title: '.accordion-header, .accordion-button', content: '.accordion-body, .accordion-collapse' },
            { container: '[itemtype*="Question"]', title: '[itemprop="name"]', content: '[itemprop="acceptedAnswer"], [itemprop="text"]' },
        ];

        for (const sel of faqSelectors) {
            $(sel.container).each((_, el) => {
                try {
                    const q = $(el).find(sel.title).first().text().trim();
                    const a = $(el).find(sel.content).first().text().trim();
                    if (q && q.length > 5 && q.length < 500) {
                        faqItems.push({ question: q, answer: (a || '').substring(0, 1000) });
                    }
                } catch (_) {}
            });
            if (faqItems.length > 0) break;
        }

        // Fallback: perguntas em texto
        if (faqItems.length === 0) {
            const faqSectionSelectors = [
                '[class*="faq"]', '[class*="duvida"]', '[class*="pergunta"]',
                '[id*="faq"]', '[id*="duvida"]', '[id*="pergunta"]'
            ];
            for (const selector of faqSectionSelectors) {
                $(selector).find('h3, h4, h5, strong, .title, dt').each((_, el) => {
                    try {
                        const text = $(el).text().trim();
                        if (text.endsWith('?') && text.length > 10 && text.length < 500) {
                            faqItems.push({ question: text, answer: '' });
                        }
                    } catch (_) {}
                });
                if (faqItems.length > 0) break;
            }
        }
    } catch (e) {
        console.warn('[DEEP-CONTEXT] ⚠️ Erro ao extrair FAQ:', e.message);
    }
    return faqItems;
}

/**
 * Extrai WhatsApp links de uma página
 * @param {CheerioAPI} $ - Instância do Cheerio
 * @returns {{numbers: string[], links: string[]}}
 */
function extractWhatsAppFromPage($) {
    const numbers = [];
    const links = [];
    try {
        $('a[href]').each((_, el) => {
            try {
                const href = ($(el).attr('href') || '').trim();
                if (href.includes('wa.me') || href.includes('whatsapp') || href.includes('api.whatsapp')) {
                    if (!links.includes(href)) links.push(href);
                    const numMatch = href.match(/\d{10,13}/);
                    if (numMatch) {
                        const num = numMatch[0];
                        if (!numbers.includes(num)) numbers.push(num);
                    }
                }
            } catch (_) {}
        });

        // Buscar em onclick e data attributes
        $('[onclick*="whatsapp"], [onclick*="wa.me"], [data-url*="whatsapp"], [data-url*="wa.me"], [data-href*="whatsapp"]').each((_, el) => {
            try {
                const val = $(el).attr('onclick') || $(el).attr('data-url') || $(el).attr('data-href') || '';
                const urlMatch = val.match(/(https?:\/\/[^\s'"]+whatsapp[^\s'"]*|https?:\/\/wa\.me\/[^\s'"]+)/i);
                if (urlMatch && !links.includes(urlMatch[1])) {
                    links.push(urlMatch[1]);
                    const numMatch = urlMatch[1].match(/\d{10,13}/);
                    if (numMatch && !numbers.includes(numMatch[0])) numbers.push(numMatch[0]);
                }
            } catch (_) {}
        });
    } catch (e) {
        console.warn('[DEEP-CONTEXT] ⚠️ Erro ao extrair WhatsApp:', e.message);
    }
    return { numbers, links };
}

/**
 * Extrai checkout links de uma página
 * @param {CheerioAPI} $ - Instância do Cheerio
 * @returns {string[]}
 */
function extractCheckoutFromPage($) {
    const checkouts = [];
    try {
        $('a[href]').each((_, el) => {
            try {
                const href = ($(el).attr('href') || '').trim();
                if (!href.startsWith('http')) return;
                const text = ($(el).text() || '').toLowerCase();
                const combined = `${href} ${text}`.toLowerCase();
                
                for (const pattern of LINK_PATTERNS.checkout) {
                    if (pattern.test(combined) && !checkouts.includes(href)) {
                        checkouts.push(href);
                        break;
                    }
                }
            } catch (_) {}
        });

        // Buscar em onclick, data-url, data-href (links ocultos)
        $('[onclick*="checkout"], [onclick*="comprar"], [data-url*="checkout"], [data-url*="hotmart"], [data-url*="kiwify"]').each((_, el) => {
            try {
                const val = $(el).attr('onclick') || $(el).attr('data-url') || $(el).attr('data-href') || '';
                const urlMatch = val.match(/https?:\/\/[^\s'"]+/);
                if (urlMatch && !checkouts.includes(urlMatch[0])) {
                    checkouts.push(urlMatch[0]);
                }
            } catch (_) {}
        });
    } catch (e) {
        console.warn('[DEEP-CONTEXT] ⚠️ Erro ao extrair checkout:', e.message);
    }
    return checkouts;
}

/**
 * Extrai links internos do mesmo domínio
 * @param {CheerioAPI} $ - Instância do Cheerio
 * @param {string} baseDomain - Domínio base (ex: https://example.com)
 * @param {Set<string>} visited - URLs já visitadas
 * @returns {Array<{url: string, text: string, type: string}>}
 */
function extractInternalLinks($, baseDomain, visited) {
    const links = [];
    try {
        $('a[href]').each((_, el) => {
            try {
                let href = ($(el).attr('href') || '').trim();
                const text = ($(el).text() || '').trim();

                // Ignorar links indesejados
                if (!href || href.startsWith('#') || href.startsWith('mailto:') || 
                    href.startsWith('tel:') || href.startsWith('javascript:')) return;

                // Resolver URLs relativas
                if (href.startsWith('/')) {
                    href = new URL(href, baseDomain).href;
                } else if (!href.startsWith('http')) {
                    try { href = new URL(href, baseDomain).href; } catch (_) { return; }
                }

                // Normalizar
                try {
                    const parsed = new URL(href);
                    parsed.hash = '';
                    href = parsed.href.replace(/\/$/, '');
                } catch (_) { return; }

                // Filtrar: mesmo domínio, não visitado, não é arquivo
                if (!href.startsWith(baseDomain)) return;
                if (visited.has(href)) return;

                const ext = href.split('.').pop()?.toLowerCase();
                const skipExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'pdf', 'zip', 'mp4', 'mp3', 'css', 'js', 'ico'];
                if (skipExts.includes(ext)) return;

                const type = classifyLink(href, text);
                links.push({ url: href, text: text.substring(0, 100), type });
            } catch (_) {}
        });
    } catch (e) {
        console.warn('[DEEP-CONTEXT] ⚠️ Erro ao extrair links internos:', e.message);
    }
    return links;
}

/**
 * 🌐 DEEP CONTEXT EXPLORER — Função Principal
 * 
 * Explora o ecossistema completo de um site, navegando links internos
 * e consolidando FAQ, contatos, checkout e conteúdo.
 * 
 * @param {string} baseUrl - URL inicial
 * @param {Object} initialData - Dados já extraídos pela extração principal
 * @param {Object} options - Configurações opcionais
 * @returns {Promise<Object>} Dados consolidados do ecossistema
 */
async function exploreDeepContext(baseUrl, initialData = {}, options = {}) {
    const startTime = Date.now();
    const config = { ...DEFAULTS, ...options };
    
    const result = {
        globalContext: true,
        sources: [],
        faq: [...(initialData.faq || [])],
        contatos: {
            whatsapp: [...(initialData.contatos?.whatsapp || [])],
            whatsappLinks: [...(initialData.contatos?.whatsappLinks || [])],
            telefone: [...(initialData.contatos?.telefone || [])],
            email: [...(initialData.contatos?.email || [])],
        },
        checkout: [],
        classifiedLinks: {
            checkout: [],
            suporte: [],
            conteudo: []
        },
        confidenceScore: 0,
        explorationTime: 0,
        pagesExplored: 0,
        errors: []
    };

    try {
        // Adicionar checkout existente
        if (initialData.checkoutLink) {
            result.checkout.push(initialData.checkoutLink);
        }

        // Determinar domínio base
        let baseDomain;
        try {
            baseDomain = new URL(baseUrl).origin;
        } catch (_) {
            console.warn('[DEEP-CONTEXT] ⚠️ URL base inválida:', baseUrl);
            return result;
        }

        const visited = new Set([baseUrl.replace(/\/$/, '')]);
        let queue = [];

        // Buscar página inicial se não temos HTML
        let initialHtml = '';
        try {
            const resp = await axios.get(baseUrl, {
                timeout: config.timeoutPerPage,
                headers: { 'User-Agent': config.userAgent, 'Accept': 'text/html', 'Accept-Language': 'pt-BR,pt;q=0.9' },
                maxRedirects: 3,
                maxContentLength: 2 * 1024 * 1024,
                validateStatus: s => s >= 200 && s < 400
            });
            initialHtml = typeof resp.data === 'string' ? resp.data : '';
        } catch (e) {
            console.warn('[DEEP-CONTEXT] ⚠️ Erro ao acessar página inicial:', e.message);
            result.errors.push(`Página inicial: ${e.message}`);
        }

        if (initialHtml) {
            const $initial = cheerio.load(initialHtml);
            result.sources.push({ url: baseUrl, status: 'ok' });
            result.pagesExplored = 1;

            // Extrair links internos para exploração
            const internalLinks = extractInternalLinks($initial, baseDomain, visited);
            
            // Classificar e priorizar links
            for (const link of internalLinks) {
                result.classifiedLinks[link.type]?.push(link);
                if (link.type !== 'checkout' || !link.url.includes(baseDomain)) {
                    // Priorizar: conteúdo > suporte > outros
                    queue.push(link);
                }
            }

            // Priorizar links de conteúdo (FAQ, depoimentos, sobre)
            queue.sort((a, b) => {
                const priority = { conteudo: 0, suporte: 1, checkout: 2, outro: 3 };
                return (priority[a.type] || 3) - (priority[b.type] || 3);
            });

            // Limitar quantidade
            queue = queue.slice(0, config.maxPages - 1);

            // Extrair dados avançados da página inicial (onclick, data-url, scripts)
            try {
                // Buscar WhatsApp em onclick e data-attributes
                const wpInitial = extractWhatsAppFromPage($initial);
                for (const n of wpInitial.numbers) {
                    if (!result.contatos.whatsapp.includes(n)) result.contatos.whatsapp.push(n);
                }
                for (const l of wpInitial.links) {
                    if (!result.contatos.whatsappLinks.includes(l)) result.contatos.whatsappLinks.push(l);
                }

                // Buscar checkouts em onclick e data-attributes
                const ckInitial = extractCheckoutFromPage($initial);
                for (const c of ckInitial) {
                    if (!result.checkout.includes(c)) result.checkout.push(c);
                }

                // Buscar URLs em scripts inline (data-url, checkout patterns)
                $initial('script').each((_, el) => {
                    try {
                        const scriptContent = $initial(el).html() || '';
                        if (scriptContent.length > 10000) return; // Ignorar scripts grandes
                        
                        // Buscar URLs de checkout em scripts
                        const urlMatches = scriptContent.match(/https?:\/\/[^\s'"]+(?:checkout|hotmart|kiwify|eduzz|monetizze|braip)[^\s'"]*/gi);
                        if (urlMatches) {
                            for (const u of urlMatches) {
                                const clean = u.replace(/['";\)\]]+$/, '');
                                if (!result.checkout.includes(clean)) result.checkout.push(clean);
                            }
                        }

                        // Buscar WhatsApp em scripts
                        const waMatches = scriptContent.match(/https?:\/\/(?:wa\.me|api\.whatsapp\.com)[^\s'"]*/gi);
                        if (waMatches) {
                            for (const w of waMatches) {
                                const clean = w.replace(/['";\)\]]+$/, '');
                                if (!result.contatos.whatsappLinks.includes(clean)) result.contatos.whatsappLinks.push(clean);
                            }
                        }
                    } catch (_) {}
                });
            } catch (advErr) {
                console.warn('[DEEP-CONTEXT] ⚠️ Extração avançada:', advErr.message);
            }
        }

        // ===== EXPLORAR SUBPÁGINAS =====
        console.log(`[DEEP-CONTEXT] 🌐 Explorando ${queue.length} subpáginas de ${baseDomain}`);

        for (const link of queue) {
            // Verificar timeout global
            if (Date.now() - startTime > config.globalTimeout) {
                console.log('[DEEP-CONTEXT] ⏰ Timeout global atingido');
                break;
            }

            if (result.pagesExplored >= config.maxPages) {
                console.log('[DEEP-CONTEXT] 📄 Limite de páginas atingido');
                break;
            }

            try {
                const resp = await axios.get(link.url, {
                    timeout: config.timeoutPerPage,
                    headers: { 'User-Agent': config.userAgent, 'Accept': 'text/html', 'Accept-Language': 'pt-BR,pt;q=0.9' },
                    maxRedirects: 3,
                    maxContentLength: 2 * 1024 * 1024,
                    validateStatus: s => s >= 200 && s < 400
                });

                if (typeof resp.data !== 'string') continue;

                const $sub = cheerio.load(resp.data);
                visited.add(link.url);
                result.pagesExplored++;
                result.sources.push({ url: link.url, type: link.type, status: 'ok' });

                console.log(`[DEEP-CONTEXT] ✅ Página ${result.pagesExplored}/${config.maxPages}: ${link.url.substring(0, 80)} [${link.type}]`);

                // Extrair FAQ desta subpágina
                const subFaq = extractFAQFromPage($sub);
                for (const item of subFaq) {
                    const exists = result.faq.some(f => f.question === item.question);
                    if (!exists) result.faq.push(item);
                }

                // Extrair WhatsApp desta subpágina
                const subWp = extractWhatsAppFromPage($sub);
                for (const n of subWp.numbers) {
                    if (!result.contatos.whatsapp.includes(n)) result.contatos.whatsapp.push(n);
                }
                for (const l of subWp.links) {
                    if (!result.contatos.whatsappLinks.includes(l)) result.contatos.whatsappLinks.push(l);
                }

                // Extrair checkouts desta subpágina
                const subCk = extractCheckoutFromPage($sub);
                for (const c of subCk) {
                    if (!result.checkout.includes(c)) result.checkout.push(c);
                }

            } catch (subErr) {
                result.sources.push({ url: link.url, type: link.type, status: 'error', error: subErr.message });
                console.log(`[DEEP-CONTEXT] ⚠️ Falha: ${link.url.substring(0, 60)}: ${subErr.message}`);
            }
        }

        // ===== CALCULAR CONFIDENCE SCORE =====
        let confidence = 0;
        if (result.checkout.length > 0) confidence += 30;
        if (result.faq.length >= 3) confidence += 25;
        else if (result.faq.length > 0) confidence += 10;
        if (result.contatos.whatsapp.length > 0 || result.contatos.whatsappLinks.length > 0) confidence += 20;
        if (result.contatos.email.length > 0) confidence += 10;
        if (result.pagesExplored > 1) confidence += 10;
        if (result.pagesExplored >= 3) confidence += 5;
        result.confidenceScore = Math.min(100, confidence);

        result.explorationTime = Date.now() - startTime;
        console.log(`[DEEP-CONTEXT] 🏁 Exploração completa: ${result.pagesExplored} páginas, ${result.faq.length} FAQs, ${result.checkout.length} checkouts, confidence=${result.confidenceScore}% em ${result.explorationTime}ms`);

    } catch (globalErr) {
        console.error('[DEEP-CONTEXT] ❌ Erro global:', globalErr.message);
        result.errors.push(`Global: ${globalErr.message}`);
    }

    result.explorationTime = Date.now() - startTime;
    return result;
}

/**
 * Merge dos dados do Deep Context Explorer com os dados existentes
 * Nunca sobrescreve dados existentes — apenas adiciona o que falta
 * 
 * @param {Object} extractedData - Dados originais do extractPageData
 * @param {Object} deepContext - Resultado do exploreDeepContext
 * @returns {Object} extractedData atualizado (mutado in-place)
 */
function mergeDeepContext(extractedData, deepContext) {
    try {
        if (!deepContext || !deepContext.globalContext) return extractedData;

        // Merge FAQ (apenas se não existir ou tiver mais)
        if (deepContext.faq.length > (extractedData.faq?.length || 0)) {
            extractedData.faq = deepContext.faq;
            console.log(`[DEEP-CONTEXT-MERGE] ❓ FAQ atualizado: ${deepContext.faq.length} items`);
        }

        // Merge WhatsApp (adicionar novos)
        if (!extractedData.contatos) extractedData.contatos = {};
        if (!extractedData.contatos.whatsapp) extractedData.contatos.whatsapp = [];
        if (!extractedData.contatos.whatsappLinks) extractedData.contatos.whatsappLinks = [];

        for (const n of (deepContext.contatos?.whatsapp || [])) {
            if (!extractedData.contatos.whatsapp.includes(n)) {
                extractedData.contatos.whatsapp.push(n);
            }
        }
        for (const l of (deepContext.contatos?.whatsappLinks || [])) {
            if (!extractedData.contatos.whatsappLinks.includes(l)) {
                extractedData.contatos.whatsappLinks.push(l);
            }
        }

        // Promover WhatsApp link se não existir
        if (!extractedData.whatsappLink && deepContext.contatos?.whatsappLinks?.length > 0) {
            extractedData.whatsappLink = deepContext.contatos.whatsappLinks[0];
            console.log(`[DEEP-CONTEXT-MERGE] 📱 WhatsApp promovido: ${extractedData.whatsappLink}`);
        }

        // Merge Checkout (apenas se não existir)
        if (!extractedData.checkoutLink && deepContext.checkout.length > 0) {
            extractedData.checkoutLink = deepContext.checkout[0];
            console.log(`[DEEP-CONTEXT-MERGE] 🛒 Checkout adicionado: ${extractedData.checkoutLink.substring(0, 80)}`);
        }

        // Adicionar metadata de exploração
        extractedData.deepContext = {
            explored: true,
            pagesExplored: deepContext.pagesExplored,
            sources: deepContext.sources,
            confidenceScore: deepContext.confidenceScore,
            classifiedLinks: deepContext.classifiedLinks,
            explorationTime: deepContext.explorationTime
        };

        console.log(`[DEEP-CONTEXT-MERGE] ✅ Merge completo | confidence=${deepContext.confidenceScore}%`);

    } catch (mergeErr) {
        console.warn('[DEEP-CONTEXT-MERGE] ⚠️ Erro no merge (dados originais mantidos):', mergeErr.message);
    }

    return extractedData;
}

module.exports = { 
    exploreDeepContext, 
    mergeDeepContext,
    classifyLink,
    extractFAQFromPage,
    extractWhatsAppFromPage,
    extractCheckoutFromPage,
    extractInternalLinks,
    DEFAULTS 
};
