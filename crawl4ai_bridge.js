/**
 * Crawl4AI Bridge - Ponte Node.js ↔ Python
 * Permite usar Crawl4AI (Python) a partir do Node.js
 */

const { spawn } = require('child_process');
const path = require('path');

class Crawl4AIBridge {
    constructor() {
        this.pythonScript = path.join(__dirname, 'crawl4ai_extractor.py');
        this.timeout = 30000; // 30 segundos
        
        console.log('🐍 Crawl4AI Bridge inicializado');
        console.log(`📄 Script Python: ${this.pythonScript}`);
    }

    /**
     * Extrai dados de uma URL usando Crawl4AI
     * @param {string} url - URL para extrair
     * @returns {Promise<Object>} - Dados extraídos
     */
    async scrapeUrl(url) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            console.log(`🔍 [Crawl4AI] Extraindo: ${url}`);

            // Spawn processo Python
            const python = spawn('python3', [this.pythonScript, url]);
            
            let stdout = '';
            let stderr = '';
            
            // Timeout
            const timeoutId = setTimeout(() => {
                python.kill();
                reject(new Error('Timeout ao extrair página'));
            }, this.timeout);

            // Capturar stdout
            python.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            // Capturar stderr
            python.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            // Processo finalizado
            python.on('close', (code) => {
                clearTimeout(timeoutId);
                
                const duration = Date.now() - startTime;
                
                if (code !== 0) {
                    console.error(`❌ [Crawl4AI] Erro (código ${code}):`, stderr);
                    return reject(new Error(`Python process exited with code ${code}: ${stderr}`));
                }

                try {
                    const result = JSON.parse(stdout);
                    
                    if (!result.success) {
                        console.error(`❌ [Crawl4AI] Falha:`, result.error);
                        return reject(new Error(result.error));
                    }

                    console.log(`✅ [Crawl4AI] Sucesso em ${duration}ms`);
                    
                    // Formatar resposta compatível com Firecrawl
                    resolve({
                        data: {
                            markdown: result.data.cleanText,
                            html: result.data.html,
                            content: result.data.cleanText,
                            title: result.data.title,
                            metadata: {
                                title: result.data.title,
                                description: result.data.description,
                                ...result.data.metadata
                            },
                            links: result.data.links,
                            images: result.data.images,
                            contatos: result.data.contatos
                        },
                        method: 'crawl4ai',
                        extractionTime: duration
                    });

                } catch (parseError) {
                    console.error('❌ [Crawl4AI] Erro ao parsear JSON:', parseError);
                    console.error('Stdout:', stdout);
                    reject(new Error(`Failed to parse Python output: ${parseError.message}`));
                }
            });

            // Erro no processo
            python.on('error', (error) => {
                clearTimeout(timeoutId);
                console.error('❌ [Crawl4AI] Erro ao spawnar Python:', error);
                reject(error);
            });
        });
    }

    /**
     * Verifica se Crawl4AI está disponível
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        try {
            const result = await this.scrapeUrl('https://example.com');
            return result && result.data;
        } catch (error) {
            console.warn('⚠️  Crawl4AI não está disponível:', error.message);
            return false;
        }
    }
}

// Exportar instância única
const crawl4aiBridge = new Crawl4AIBridge();

module.exports = {
    Crawl4AIBridge,
    crawl4aiBridge
};