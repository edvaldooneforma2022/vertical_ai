/**
 * ========================================
 * ENHANCED CONTENT EXTRACTOR
 * ========================================
 * Sistema avançado de extração de conteúdo com:
 * - OCR para texto em imagens (Tesseract.js)
 * - Extração completa de conteúdo dinâmico
 * - Detecção de elementos flutuantes
 * - Captura de conteúdo de iframes
 * 
 * Autor: Link Mágico V8.0
 * Data: 2025
 */

const Tesseract = require('tesseract.js');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

// Puppeteer via client singleton (compartilhado com toda a plataforma)
let puppeteerClient = null;
try {
    puppeteerClient = require('./lib/puppeteer-client');
    if (puppeteerClient && puppeteerClient.isAvailable()) {
        console.log('✅ Puppeteer (via client) disponível para extração avançada');
    }
} catch (e) {
    console.log('⚠️ Puppeteer client não disponível para extração avançada');
}

// OOM Guard + Memory Utils
let isMemoryCritical = () => false;
let getMemoryUsage = () => ({ rss: 0, heapUsed: 0, heapTotal: 0 });
try {
    const _concLimit = require('./lib/concurrency-limit');
    isMemoryCritical = _concLimit.isMemoryCritical;
    getMemoryUsage = _concLimit.getMemoryUsage;
} catch (_) {}

class EnhancedContentExtractor {
    constructor(options = {}) {
        this.options = {
            maxOCRImages: options.maxOCRImages || 10,
            ocrLanguages: options.ocrLanguages || 'por+eng',
            timeout: options.timeout || 60000,
            enableOCR: options.enableOCR !== false,
            enableFloating: options.enableFloating !== false,
            enableDynamic: options.enableDynamic !== false,
            verbose: options.verbose || false,
            ...options
        };

        // Cache de workers Tesseract para performance
        this.ocrWorker = null;
        this.isInitialized = false;

        // Seletores para elementos flutuantes
        this.floatingSelectors = [
            '[style*="position: fixed"]',
            '[style*="position: sticky"]',
            '[class*="modal"]',
            '[class*="popup"]',
            '[class*="tooltip"]',
            '[class*="notification"]',
            '[class*="toast"]',
            '[class*="banner"]',
            '[class*="float"]',
            '[class*="overlay"]',
            '[class*="sticky"]',
            '[class*="fixed"]',
            '[role="dialog"]',
            '[role="tooltip"]',
            '[role="alert"]',
            '[role="alertdialog"]',
            '.modal',
            '.popup',
            '.tooltip',
            '.toast',
            '.snackbar',
            '.notification',
            '#modal',
            '#popup'
        ];

        // Seletores de conteúdo importante
        this.contentSelectors = [
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'p', 'article', 'section', 'main',
            '.content', '.text', '.description',
            '.product', '.offer', '.price',
            '.benefit', '.feature', '.bonus',
            '.testimonial', '.review', '.rating',
            '.faq', '.question', '.answer',
            '.cta', '.button-text', '.action',
            '[class*="content"]', '[class*="text"]',
            '[class*="product"]', '[class*="offer"]',
            '[class*="price"]', '[class*="benefit"]',
            '[class*="bonus"]', '[class*="feature"]',
            'li', 'span', 'div'
        ];

        console.log('🚀 EnhancedContentExtractor inicializado');
    }

    /**
     * Extração completa - método principal
     */
    async extractComplete(url, options = {}) {
        const startTime = Date.now();
        const mergedOptions = { ...this.options, ...options };

        console.log(`🔍 [ENHANCED] Iniciando extração completa: ${url}`);

        const result = {
            success: true,
            url: url,
            dynamicText: '',
            ocrText: '',
            floatingContent: '',
            iframeContent: '',
            allImages: [],
            processedImages: 0,
            extractionTime: 0,
            method: 'enhanced',
            errors: []
        };

        try {
            // 1. Extração dinâmica com Puppeteer
            if (puppeteerClient && puppeteerClient.isAvailable() && mergedOptions.enableDynamic) {
                try {
                    const dynamicResult = await this._extractWithPuppeteer(url, mergedOptions);
                    result.dynamicText = dynamicResult.text || '';
                    result.floatingContent = dynamicResult.floatingContent || '';
                    result.iframeContent = dynamicResult.iframeContent || '';
                    result.allImages = dynamicResult.images || [];
                    console.log(`✅ [ENHANCED] Extração dinâmica: ${result.dynamicText.length} chars`);
                } catch (puppeteerError) {
                    console.warn(`⚠️ [ENHANCED] Puppeteer falhou: ${puppeteerError.message}`);
                    result.errors.push(`Puppeteer: ${puppeteerError.message}`);
                }
            }

            // 2. Fallback: Extração básica se Puppeteer falhou
            if (!result.dynamicText) {
                try {
                    const basicResult = await this._extractBasic(url);
                    result.dynamicText = basicResult.text || '';
                    result.allImages = basicResult.images || [];
                } catch (basicError) {
                    console.warn(`⚠️ [ENHANCED] Extração básica falhou: ${basicError.message}`);
                    result.errors.push(`Basic: ${basicError.message}`);
                }
            }

            // 3. OCR em imagens — CONDICIONAL (só se memória OK e texto insuficiente)
            const _hasEnoughText = (result.dynamicText || '').length > 300;
            const _ocrSafe = !isMemoryCritical(400) && !_hasEnoughText;
            if (mergedOptions.enableOCR && result.allImages.length > 0 && _ocrSafe) {
                try {
                    const ocrResult = await this._extractImageTexts(
                        result.allImages,
                        mergedOptions.maxOCRImages
                    );
                    result.ocrText = ocrResult.text || '';
                    result.processedImages = ocrResult.processedCount || 0;
                    console.log(`✅ [ENHANCED] OCR: ${result.processedImages} imagens → ${result.ocrText.length} chars`);
                } catch (ocrError) {
                    console.warn(`⚠️ [ENHANCED] OCR falhou: ${ocrError.message}`);
                    result.errors.push(`OCR: ${ocrError.message}`);
                }
            } else if (!_ocrSafe && mergedOptions.enableOCR) {
                console.log(`[ENHANCED] ⏩ OCR skipped (textLen=${(result.dynamicText||'').length}, memCritical=${isMemoryCritical(400)})`);
            }

        } catch (error) {
            console.error(`❌ [ENHANCED] Erro geral: ${error.message}`);
            result.success = false;
            result.errors.push(error.message);
        }

        result.extractionTime = Date.now() - startTime;
        console.log(`🏁 [ENHANCED] Concluído em ${result.extractionTime}ms`);

        return result;
    }

    /**
     * Extração com Puppeteer para conteúdo dinâmico
     */
    async _extractWithPuppeteer(url, options) {
        if (!puppeteerClient || !puppeteerClient.isAvailable()) {
            throw new Error('Puppeteer não disponível');
        }

        // 🛡️ OOM GUARD — Checar ANTES de abrir página
        if (isMemoryCritical(350)) {
            const mem = getMemoryUsage();
            console.warn(`[OOM-GUARD] ⚠️ Memória alta (${mem.rss}MB) — pulando Enhanced Puppeteer`);
            throw new Error(`OOM-GUARD: memória ${mem.rss}MB > 350MB`);
        }

        let page = null;
        const _startTime = Date.now();
        try {
            const browser = await puppeteerClient.getBrowser();
            if (!browser) {
                throw new Error('Browser não disponível (circuit breaker ou falha de init)');
            }

            page = await browser.newPage();

            // Viewport compacto (economia de memória)
            await page.setViewport({ width: 1280, height: 800 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // 🔴 BLOQUEIO AGRESSIVO — imagens + stylesheet + font + media
            // OCR agora é condicional, então NÃO precisamos carregar imagens
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                const resourceType = req.resourceType();
                if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            // Navegar (timeout agressivo)
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 10000
            });

            // Event-driven wait (substitui delay fixo de 2s)
            await page.waitForFunction(
                () => document.readyState === 'complete',
                { timeout: 3000 }
            ).catch(() => {});

            // Scroll leve — máximo 30% da página (substitui 10000px)
            await page.evaluate(() => {
                const maxScroll = Math.min(document.body.scrollHeight * 0.3, 2000);
                window.scrollTo(0, maxScroll);
            });
            // Micro-wait pós-scroll (substitui delay fixo de 1.5s)
            await new Promise(resolve => setTimeout(resolve, 500));

            // Extrair todo o texto visível
            const pageContent = await page.evaluate((contentSelectors) => {
                // Remover scripts e estilos
                document.querySelectorAll('script, style, noscript').forEach(el => el.remove());

                const texts = [];
                const seenTexts = new Set();

                // Função para limpar e validar texto
                const cleanText = (text) => {
                    return (text || '').replace(/\s+/g, ' ').trim();
                };

                // Função para verificar se elemento é visível
                const isVisible = (el) => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' &&
                        style.visibility !== 'hidden' &&
                        style.opacity !== '0' &&
                        el.offsetHeight > 0;
                };

                // Extrair de seletores específicos primeiro
                contentSelectors.forEach(selector => {
                    try {
                        document.querySelectorAll(selector).forEach(el => {
                            if (isVisible(el)) {
                                const text = cleanText(el.textContent);
                                if (text && text.length > 5 && text.length < 2000 && !seenTexts.has(text)) {
                                    seenTexts.add(text);
                                    texts.push(text);
                                }
                            }
                        });
                    } catch (e) { }
                });

                // Extrair texto do body como fallback
                const bodyText = cleanText(document.body.textContent);

                return {
                    texts: texts.slice(0, 500), // Limitar quantidade
                    bodyLength: bodyText.length
                };
            }, this.contentSelectors);

            // Extrair elementos flutuantes
            const floatingContent = await this._extractFloatingElements(page);

            // Extrair conteúdo de iframes
            const iframeContent = await this._extractIframeContent(page);

            // Coletar URLs de imagens
            const images = await page.evaluate(() => {
                const imgUrls = [];
                document.querySelectorAll('img').forEach(img => {
                    const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
                    if (src && src.startsWith('http') && !src.includes('data:')) {
                        // Filtrar imagens muito pequenas (ícones)
                        const width = img.naturalWidth || img.width || 100;
                        const height = img.naturalHeight || img.height || 100;
                        if (width > 50 && height > 50) {
                            imgUrls.push({
                                src: src,
                                alt: img.alt || '',
                                width: width,
                                height: height
                            });
                        }
                    }
                });
                return imgUrls;
            });

            // 🚀 WIDGET WA DETECTION — Detectar WhatsApp no DOM renderizado
            // Cobre widgets injetados pós-render (classe universal, não por domínio)
            // 🔴 Payload reduzido: retorna só url+visible, max 20 items
            let detectedWhatsAppLinks = [];
            try {
                detectedWhatsAppLinks = await page.evaluate(() => {
                    const results = [];
                    const seen = new Set();

                    // 📉 PASSE 1: document.links (coleção nativa — zero custo de traversal)
                    // Muito mais leve que querySelectorAll em páginas grandes
                    for (const link of document.links) {
                        const href = (link.href || '').trim();
                        if (!href || seen.has(href)) continue;
                        const lower = href.toLowerCase();
                        if (!lower.includes('wa.me') && !lower.includes('whatsapp.com')) continue;
                        seen.add(href);

                        const rect = link.getBoundingClientRect();
                        const visible = rect.width > 0 && rect.height > 0;
                        const aboveFold = rect.top < window.innerHeight;

                        // Detectar fixed/sticky (max 3 níveis — economia)
                        let isFixed = false;
                        try {
                            let p = link;
                            for (let i = 0; i < 3 && p; i++) {
                                const cs = window.getComputedStyle(p);
                                if (cs.position === 'fixed' || cs.position === 'sticky') {
                                    isFixed = true; break;
                                }
                                p = p.parentElement;
                            }
                        } catch (_) {}

                        const text = (link.textContent || '').trim().substring(0, 60);
                        results.push({ href, text, visible, aboveFold, isFixed });
                    }

                    // PASSE 2: iframes com WA (document.links não cobre)
                    try {
                        document.querySelectorAll('iframe[src*="whatsapp"], iframe[src*="wa.me"]').forEach(el => {
                            const src = (el.src || '').trim();
                            if (src && !seen.has(src)) {
                                seen.add(src);
                                results.push({ href: src, text: '[iframe]', visible: true, aboveFold: false, isFixed: false });
                            }
                        });
                    } catch (_) {}

                    // 🔴 Retorna só o essencial, limitado a 20
                    return results.slice(0, 20);
                });

                if (detectedWhatsAppLinks.length > 0) {
                    console.log(`📱 [ENHANCED-WA] ${detectedWhatsAppLinks.length} links WhatsApp detectados no DOM renderizado`);
                }
            } catch (waDetectErr) {
                console.warn('📱 [ENHANCED-WA] Erro na detecção (sem impacto):', waDetectErr.message);
            }

            return {
                text: pageContent.texts.join('\n\n'),
                floatingContent: floatingContent,
                iframeContent: iframeContent,
                images: images,
                whatsappLinks: detectedWhatsAppLinks
            };

        } finally {
            // 🧹 Liberação agressiva — fechar página + anular referência
            if (page) {
                try {
                    await page.close();
                    page = null;
                } catch (e) { }
            }
        }
    }

    /**
     * Scroll completo da página para carregar conteúdo lazy
     */
    async _scrollPage(page) {
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 300;
                const maxScroll = 10000; // Limite de scroll

                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight || totalHeight >= maxScroll) {
                        // Voltar ao topo
                        window.scrollTo(0, 0);
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });
    }

    /**
     * Extrair conteúdo de elementos flutuantes
     */
    async _extractFloatingElements(page) {
        try {
            const floatingContent = await page.evaluate((selectors) => {
                const texts = [];
                const seenTexts = new Set();

                selectors.forEach(selector => {
                    try {
                        document.querySelectorAll(selector).forEach(el => {
                            const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
                            if (text && text.length > 10 && text.length < 1000 && !seenTexts.has(text)) {
                                seenTexts.add(text);
                                texts.push(text);
                            }
                        });
                    } catch (e) { }
                });

                return texts.join('\n\n');
            }, this.floatingSelectors);

            return floatingContent;
        } catch (error) {
            console.warn('Erro ao extrair elementos flutuantes:', error.message);
            return '';
        }
    }

    /**
     * Extrair conteúdo de iframes (same-origin)
     */
    async _extractIframeContent(page) {
        try {
            const frames = page.frames();
            const iframeTexts = [];

            for (const frame of frames) {
                if (frame === page.mainFrame()) continue;

                try {
                    const frameContent = await frame.evaluate(() => {
                        const text = (document.body?.textContent || '').replace(/\s+/g, ' ').trim();
                        return text.length > 20 && text.length < 5000 ? text : '';
                    });

                    if (frameContent) {
                        iframeTexts.push(frameContent);
                    }
                } catch (e) {
                    // Cross-origin frames não podem ser acessados - isso é esperado
                }
            }

            return iframeTexts.join('\n\n');
        } catch (error) {
            console.warn('Erro ao extrair iframes:', error.message);
            return '';
        }
    }

    /**
     * Extração básica sem Puppeteer (fallback)
     */
    async _extractBasic(url) {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
            },
            timeout: 30000
        });

        const $ = cheerio.load(response.data);
        $('script, style, noscript').remove();

        const texts = [];
        const seenTexts = new Set();

        this.contentSelectors.forEach(selector => {
            $(selector).each((i, el) => {
                const text = $(el).text().replace(/\s+/g, ' ').trim();
                if (text && text.length > 5 && text.length < 2000 && !seenTexts.has(text)) {
                    seenTexts.add(text);
                    texts.push(text);
                }
            });
        });

        // Coletar URLs de imagens
        const images = [];
        $('img').each((i, el) => {
            const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
            if (src && (src.startsWith('http') || src.startsWith('//'))) {
                const fullSrc = src.startsWith('//') ? 'https:' + src : src;
                images.push({
                    src: fullSrc,
                    alt: $(el).attr('alt') || ''
                });
            }
        });

        return {
            text: texts.join('\n\n'),
            images: images.slice(0, 50) // Limitar quantidade
        };
    }

    /**
     * Extração de texto de imagens usando OCR
     */
    async _extractImageTexts(images, maxImages = 10) {
        if (!images || images.length === 0) {
            return { text: '', processedCount: 0 };
        }

        console.log(`📸 [OCR] Processando até ${maxImages} de ${images.length} imagens`);

        // Filtrar e priorizar imagens maiores (mais propensas a ter texto)
        const sortedImages = [...images]
            .filter(img => img.src && !img.src.includes('.svg') && !img.src.includes('icon'))
            .sort((a, b) => {
                const areaA = (a.width || 100) * (a.height || 100);
                const areaB = (b.width || 100) * (b.height || 100);
                return areaB - areaA;
            })
            .slice(0, maxImages);

        const ocrResults = [];
        let processedCount = 0;

        for (const image of sortedImages) {
            try {
                const result = await this._processOCR(image.src);
                if (result && result.length > 10) {
                    ocrResults.push(result);
                    processedCount++;
                }
            } catch (error) {
                // Silently skip failed images
                if (this.options.verbose) {
                    console.warn(`OCR falhou para ${image.src}: ${error.message}`);
                }
            }
        }

        return {
            text: ocrResults.join('\n\n'),
            processedCount: processedCount
        };
    }

    /**
     * Processar OCR em uma única imagem
     */
    async _processOCR(imageUrl) {
        try {
            // Baixar imagem
            const response = await axios.get(imageUrl, {
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            // Verificar se é uma imagem válida
            const contentType = response.headers['content-type'];
            if (!contentType || !contentType.includes('image')) {
                return '';
            }

            // Usar caminho local para traineddata se disponível
            const langPath = path.join(__dirname);

            // Processar com Tesseract
            const result = await Tesseract.recognize(
                Buffer.from(response.data),
                this.options.ocrLanguages,
                {
                    langPath: langPath,
                    logger: this.options.verbose ? console.log : () => { }
                }
            );

            // Limpar e retornar texto
            const text = (result.data.text || '')
                .replace(/\s+/g, ' ')
                .replace(/[^\w\sáéíóúâêîôûãõçàèìòùäëïöüÁÉÍÓÚÂÊÎÔÛÃÕÇÀÈÌÒÙÄËÏÖÜ.,!?:;()@#$%&*+-='"]/g, '')
                .trim();

            return text.length > 5 ? text : '';

        } catch (error) {
            if (this.options.verbose) {
                console.warn(`OCR erro: ${error.message}`);
            }
            return '';
        }
    }

    /**
     * Método de teste para OCR
     */
    async testOCR(testImageUrl = 'https://tesseract.projectnaptha.com/img/eng_bw.png') {
        console.log('🧪 Testando OCR...');
        try {
            const result = await this._processOCR(testImageUrl);
            console.log(`✅ OCR Teste resultado: "${result.substring(0, 100)}..."`);
            return { success: true, text: result };
        } catch (error) {
            console.error(`❌ OCR Teste falhou: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Limpar recursos
     */
    async cleanup() {
        if (this.ocrWorker) {
            try {
                await this.ocrWorker.terminate();
            } catch (e) { }
            this.ocrWorker = null;
        }
    }
}

// Singleton para uso global
let globalExtractor = null;

function getEnhancedExtractor(options = {}) {
    if (!globalExtractor) {
        globalExtractor = new EnhancedContentExtractor(options);
    }
    return globalExtractor;
}

module.exports = {
    EnhancedContentExtractor,
    getEnhancedExtractor
};
