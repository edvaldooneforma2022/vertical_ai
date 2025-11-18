/**
 * ========================================
 * CRAWL4AI ADAPTER - Node.js Wrapper
 * ========================================
 * Adaptador 100% gratuito para Crawl4AI
 * Substitui Firecrawl mantendo compatibilidade total
 * 
 * Autor: Sistema LinkMágico V7.0
 * Data: 2025
 */

const { spawn } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class Crawl4AIAdapter {
    constructor(options = {}) {
        this.mode = options.mode || 'docker'; // 'docker', 'python', 'api'
        this.dockerUrl = options.dockerUrl || process.env.CRAWL4AI_DOCKER_URL || 'http://localhost:11235';
        this.pythonPath = options.pythonPath || 'python3';
        this.verbose = options.verbose || false;
        this.timeout = options.timeout || 30000;
        
        console.log(`🚀 Crawl4AI Adapter inicializado - Modo: ${this.mode}`);
    }

    /**
     * Método principal - compatível com Firecrawl API
     * @param {string} url - URL para extrair
     * @param {object} params - Parâmetros de extração
     */
    async scrapeUrl(url, params = {}) {
        try {
            console.log(`🔍 [Crawl4AI] Extraindo: ${url}`);
            
            const result = await this._executeCrawl(url, params);
            
            // Normalizar resposta para formato compatível com Firecrawl
            return this._normalizeResponse(result);
            
        } catch (error) {
            console.error('❌ [Crawl4AI] Erro:', error.message);
            throw new Error(`Crawl4AI extraction failed: ${error.message}`);
        }
    }

    /**
     * Executa crawl baseado no modo configurado
     */
    async _executeCrawl(url, params) {
        switch (this.mode) {
            case 'docker':
                return await this._crawlViaDocker(url, params);
            case 'python':
                return await this._crawlViaPython(url, params);
            case 'api':
                return await this._crawlViaAPI(url, params);
            default:
                throw new Error(`Modo inválido: ${this.mode}`);
        }
    }

    /**
     * MODO 1: Docker API (Recomendado para produção)
     */
    async _crawlViaDocker(url, params) {
        try {
            const crawlConfig = {
                urls: [url],
                browser_config: {
                    headless: true,
                    verbose: this.verbose
                },
                crawler_config: {
                    bypass_cache: params.bypassCache || false,
                    word_count_threshold: params.wordCountThreshold || 10,
                    extraction_strategy: params.extractionStrategy || null,
                    chunking_strategy: params.chunkingStrategy || null
                }
            };

            const response = await axios.post(
                `${this.dockerUrl}/crawl`,
                crawlConfig,
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: this.timeout
                }
            );

            if (response.data.success && response.data.result) {
                return response.data.result;
            } else {
                throw new Error('Docker API response invalid');
            }
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                console.warn('⚠️ Docker não disponível, tentando modo Python...');
                return await this._crawlViaPython(url, params);
            }
            throw error;
        }
    }

    /**
     * MODO 2: Python Script (Fallback automático)
     */
    async _crawlViaPython(url, params) {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(__dirname, 'crawl4ai_script.py');
            
            // Criar script Python temporário se não existir
            if (!fs.existsSync(scriptPath)) {
                this._createPythonScript(scriptPath);
            }

            const pythonProcess = spawn(this.pythonPath, [
                scriptPath,
                url,
                JSON.stringify(params)
            ]);

            let outputData = '';
            let errorData = '';

            pythonProcess.stdout.on('data', (data) => {
                outputData += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorData += data.toString();
                if (this.verbose) {
                    console.log('🐍 [Python]:', data.toString());
                }
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Python script failed: ${errorData}`));
                } else {
                    try {
                        const result = JSON.parse(outputData);
                        resolve(result);
                    } catch (e) {
                        reject(new Error('Failed to parse Python output'));
                    }
                }
            });

            // Timeout
            setTimeout(() => {
                pythonProcess.kill();
                reject(new Error('Python script timeout'));
            }, this.timeout);
        });
    }

    /**
     * MODO 3: API Externa (Opcional)
     */
    async _crawlViaAPI(url, params) {
        // Implementação futura para API externa se necessário
        throw new Error('API mode not implemented yet');
    }

    /**
     * Normaliza resposta para formato compatível com Firecrawl
     */
    _normalizeResponse(rawResult) {
        // Crawl4AI retorna estrutura diferente, normalizar para compatibilidade
        return {
            success: true,
            data: {
                markdown: rawResult.markdown || rawResult.cleaned_html || '',
                html: rawResult.html || '',
                metadata: {
                    title: rawResult.metadata?.title || '',
                    description: rawResult.metadata?.description || '',
                    language: rawResult.metadata?.language || 'pt',
                    sourceURL: rawResult.url || '',
                    statusCode: rawResult.status_code || 200
                },
                links: rawResult.links || [],
                images: rawResult.media?.images || []
            },
            // Dados extras específicos do Crawl4AI
            crawl4ai: {
                screenshot: rawResult.screenshot,
                extracted_content: rawResult.extracted_content,
                timing: {
                    crawl_time: rawResult.crawl_time,
                    extraction_time: rawResult.extraction_time
                }
            }
        };
    }

    /**
     * Cria script Python para extração
     */
    _createPythonScript(scriptPath) {
        const pythonCode = `#!/usr/bin/env python3
import asyncio
import json
import sys
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

async def main():
    url = sys.argv[1]
    params = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    
    browser_config = BrowserConfig(
        headless=True,
        verbose=False
    )
    
    crawler_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS if params.get('bypassCache') else CacheMode.ENABLED,
        word_count_threshold=params.get('wordCountThreshold', 10)
    )
    
    async with AsyncWebCrawler(config=browser_config) as crawler:
        result = await crawler.arun(
            url=url,
            config=crawler_config
        )
        
        output = {
            'success': result.success,
            'url': result.url,
            'html': result.html[:1000],  # Limitar tamanho
            'markdown': result.markdown,
            'cleaned_html': result.cleaned_html[:1000],
            'media': {
                'images': [{'src': img['src'], 'alt': img.get('alt', '')} 
                          for img in result.media.get('images', [])[:10]]
            },
            'links': [{'url': link['href'], 'text': link.get('text', '')} 
                     for link in result.links.get('internal', [])[:20]],
            'metadata': result.metadata,
            'status_code': result.status_code,
            'crawl_time': result.crawl_time,
            'extraction_time': getattr(result, 'extraction_time', 0)
        }
        
        print(json.dumps(output))

if __name__ == "__main__":
    asyncio.run(main())
`;
        
        fs.writeFileSync(scriptPath, pythonCode);
        fs.chmodSync(scriptPath, '755');
        console.log('✅ Script Python criado:', scriptPath);
    }

    /**
     * Health check - verifica disponibilidade
     */
    async healthCheck() {
        try {
            if (this.mode === 'docker') {
                const response = await axios.get(`${this.dockerUrl}/health`, {
                    timeout: 5000
                });
                return response.data.status === 'healthy';
            }
            return true;
        } catch (error) {
            console.warn('⚠️ Health check failed:', error.message);
            return false;
        }
    }

    /**
     * Extração com CSS Selector (avançado)
     */
    async scrapeWithSelector(url, cssSelector, schema = null) {
        const params = {
            extractionStrategy: schema ? {
                type: 'css',
                schema: schema
            } : null
        };
        
        return await this.scrapeUrl(url, params);
    }

    /**
     * Batch scraping - múltiplas URLs
     */
    async scrapeMultiple(urls, params = {}) {
        const results = [];
        
        for (const url of urls) {
            try {
                const result = await this.scrapeUrl(url, params);
                results.push(result);
            } catch (error) {
                console.error(`❌ Erro ao processar ${url}:`, error.message);
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

// Factory function para fácil integração
function createCrawl4AIAdapter(options = {}) {
    return new Crawl4AIAdapter(options);
}

// Exports
module.exports = {
    Crawl4AIAdapter,
    createCrawl4AIAdapter
};

// Exemplo de uso (comentado)
/*
const adapter = createCrawl4AIAdapter({
    mode: 'docker', // ou 'python'
    verbose: true
});

// Compatível com Firecrawl API
adapter.scrapeUrl('https://example.com')
    .then(result => console.log(result))
    .catch(err => console.error(err));
*/