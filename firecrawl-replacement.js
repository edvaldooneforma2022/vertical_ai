/**
 * ========================================
 * FIRECRAWL REPLACEMENT - Crawl4AI
 * ========================================
 * Drop-in replacement para FirecrawlApp
 * 100% compatível com código existente
 * Substitui Firecrawl por Crawl4AI gratuito
 * 
 * USO: Basta trocar o import/require
 * ANTES: const FirecrawlApp = require('@mendable/firecrawl-js').default;
 * DEPOIS: const FirecrawlApp = require('./firecrawl-replacement');
 */

const { Crawl4AIAdapter } = require('./crawl4ai-adapter');

/**
 * Classe compatível com FirecrawlApp
 * Mantém mesma interface pública
 */
class FirecrawlApp {
    constructor(config = {}) {
        // Configuração original Firecrawl (ignorada)
        this.apiKey = config.apiKey;
        
        // Inicializar Crawl4AI
        this.crawler = new Crawl4AIAdapter({
            mode: process.env.CRAWL4AI_MODE || 'python', // docker, python, api
            dockerUrl: process.env.CRAWL4AI_DOCKER_URL,
            verbose: config.verbose || false,
            timeout: config.timeout || 30000
        });
        
        console.log('🔄 [FirecrawlApp] Usando Crawl4AI (100% gratuito)');
    }

    /**
     * Método principal do Firecrawl
     * Mantém mesma assinatura
     */
    async scrapeUrl(url, params = {}) {
        try {
            // Mapear parâmetros Firecrawl -> Crawl4AI
            const crawl4aiParams = this._mapFirecrawlParams(params);
            
            // Executar com Crawl4AI
            const result = await this.crawler.scrapeUrl(url, crawl4aiParams);
            
            // Retornar no formato Firecrawl esperado
            return this._toFirecrawlFormat(result);
            
        } catch (error) {
            console.error('❌ [FirecrawlApp] Erro:', error.message);
            
            // Fallback para extração básica se Crawl4AI falhar
            return await this._fallbackExtraction(url);
        }
    }

    /**
     * Mapeia parâmetros Firecrawl para Crawl4AI
     */
    _mapFirecrawlParams(firecrawlParams) {
        return {
            bypassCache: firecrawlParams.bypassCache || false,
            wordCountThreshold: firecrawlParams.wordCountThreshold || 10,
            formats: firecrawlParams.formats || ['markdown', 'html'],
            onlyMainContent: firecrawlParams.onlyMainContent !== false,
            includeTags: firecrawlParams.includeTags,
            excludeTags: firecrawlParams.excludeTags,
            headers: firecrawlParams.headers,
            waitFor: firecrawlParams.waitFor,
            timeout: firecrawlParams.timeout
        };
    }

    /**
     * Converte resposta Crawl4AI para formato Firecrawl
     */
    _toFirecrawlFormat(crawl4aiResult) {
        if (!crawl4aiResult || !crawl4aiResult.success) {
            throw new Error('Crawl4AI extraction failed');
        }

        // Estrutura compatível com Firecrawl
        return {
            success: true,
            data: {
                // Conteúdo principal
                markdown: crawl4aiResult.data.markdown || '',
                html: crawl4aiResult.data.html || '',
                text: this._extractText(crawl4aiResult.data.markdown),
                
                // Metadados
                metadata: {
                    title: crawl4aiResult.data.metadata?.title || '',
                    description: crawl4aiResult.data.metadata?.description || '',
                    language: crawl4aiResult.data.metadata?.language || 'pt',
                    keywords: crawl4aiResult.data.metadata?.keywords || '',
                    robots: crawl4aiResult.data.metadata?.robots || '',
                    ogTitle: crawl4aiResult.data.metadata?.ogTitle || '',
                    ogDescription: crawl4aiResult.data.metadata?.ogDescription || '',
                    ogImage: crawl4aiResult.data.metadata?.ogImage || '',
                    sourceURL: crawl4aiResult.data.metadata?.sourceURL || '',
                    statusCode: crawl4aiResult.data.metadata?.statusCode || 200
                },
                
                // Links e imagens
                links: (crawl4aiResult.data.links || []).map(link => 
                    typeof link === 'string' ? link : link.url || link.href
                ),
                images: (crawl4aiResult.data.images || []).map(img => 
                    typeof img === 'string' ? img : img.src || img.url
                ),
                
                // Screenshot (se disponível)
                screenshot: crawl4aiResult.crawl4ai?.screenshot
            }
        };
    }

    /**
     * Extrai texto limpo do markdown
     */
    _extractText(markdown) {
        if (!markdown) return '';
        
        return markdown
            .replace(/#+\s/g, '') // Remove headers
            .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links
            .replace(/[*_~`]/g, '') // Remove formatação
            .replace(/\n\n+/g, '\n') // Normaliza quebras
            .trim();
    }

    /**
     * Fallback usando Cheerio se Crawl4AI falhar
     */
    async _fallbackExtraction(url) {
        console.warn('⚠️ [FirecrawlApp] Usando fallback básico...');
        
        try {
            const axios = require('axios');
            const cheerio = require('cheerio');
            
            const { data } = await axios.get(url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; LinkMagico/7.0)'
                }
            });
            
            const $ = cheerio.load(data);
            
            // Extração básica
            const title = $('title').text() || '';
            const description = $('meta[name="description"]').attr('content') || '';
            const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
            
            // Construir resposta mínima compatível
            return {
                success: true,
                data: {
                    markdown: bodyText.substring(0, 5000),
                    html: data.substring(0, 10000),
                    text: bodyText.substring(0, 5000),
                    metadata: {
                        title,
                        description,
                        sourceURL: url,
                        statusCode: 200
                    },
                    links: [],
                    images: []
                }
            };
            
        } catch (error) {
            console.error('❌ [FirecrawlApp] Fallback também falhou:', error.message);
            
            return {
                success: false,
                error: 'Extraction failed completely',
                data: {
                    markdown: '',
                    html: '',
                    text: '',
                    metadata: { sourceURL: url },
                    links: [],
                    images: []
                }
            };
        }
    }

    /**
     * Método de crawl (compatibilidade futura)
     */
    async crawlUrl(url, params = {}) {
        // Por enquanto, redireciona para scrapeUrl
        return await this.scrapeUrl(url, params);
    }

    /**
     * Health check
     */
    async healthCheck() {
        return await this.crawler.healthCheck();
    }

    /**
     * Batch scraping
     */
    async scrapeUrls(urls, params = {}) {
        const results = [];
        
        for (const url of urls) {
            try {
                const result = await this.scrapeUrl(url, params);
                results.push(result);
            } catch (error) {
                results.push({
                    success: false,
                    url,
                    error: error.message
                });
            }
        }
        
        return results;
    }
}

// Export como default para compatibilidade perfeita
module.exports = FirecrawlApp;
module.exports.default = FirecrawlApp;

/**
 * ========================================
 * EXEMPLOS DE USO
 * ========================================
 */

/*
// EXEMPLO 1: Uso idêntico ao Firecrawl
const FirecrawlApp = require('./firecrawl-replacement');

const app = new FirecrawlApp({
    apiKey: 'não_necessário_mas_mantém_compatibilidade'
});

const result = await app.scrapeUrl('https://example.com');
console.log(result.data.markdown);


// EXEMPLO 2: Com parâmetros (compatível com Firecrawl)
const result = await app.scrapeUrl('https://example.com', {
    formats: ['markdown', 'html'],
    onlyMainContent: true,
    includeTags: ['article', 'main'],
    waitFor: 2000
});


// EXEMPLO 3: Batch scraping
const urls = [
    'https://site1.com',
    'https://site2.com',
    'https://site3.com'
];

const results = await app.scrapeUrls(urls);
results.forEach(result => {
    if (result.success) {
        console.log(result.data.metadata.title);
    }
});


// EXEMPLO 4: Health check
const isHealthy = await app.healthCheck();
console.log('Crawl4AI está', isHealthy ? '✅ online' : '❌ offline');
*/