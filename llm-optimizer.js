/**
 * 🎯 SISTEMA DE OTIMIZAÇÃO DE CUSTOS LLM - Link Mágico V9
 * Gerencia chamadas de API para minimizar custos
 * 
 * Estratégias:
 * - Cache de respostas similares (V9: TTL 5min + normalização)
 * - Fallback inteligente entre provedores
 * - Modelos menores para perguntas simples
 * - Monitoramento de tokens
 * - V9: Log estruturado [CACHE_HIT] [CACHE_MISS]
 * - V9: Normalização de mensagem/intenção para melhor hit rate
 */

const crypto = require('crypto');

/**
 * 💰 Tabela de custos por provedor (por 1M tokens)
 */
const PRICING = {
    groq: {
        input: 0.00, // Gratuito atualmente
        output: 0.00
    },
    openai: {
        'gpt-4': {
            input: 30.00,
            output: 60.00
        },
        'gpt-4-turbo': {
            input: 10.00,
            output: 30.00
        },
        'gpt-3.5-turbo': {
            input: 0.50,
            output: 1.50
        }
    },
    openrouter: {
        'anthropic/claude-3': {
            input: 3.00,
            output: 15.00
        },
        'meta-llama/llama-3': {
            input: 0.18,
            output: 0.18
        }
    }
};

/**
 * 🧠 Classificador de complexidade de perguntas
 */
class QuestionComplexityAnalyzer {
    constructor() {
        this.simplePatterns = [
            /^(oi|olá|ola|hey|hi|hello)/i,
            /^(tchau|adeus|até|bye|goodbye)/i,
            /^(obrigad|thank)/i,
            /^(sim|não|nao|yes|no)$/i,
            /^(quanto custa|preço|valor|price)/i,
            /^(horário|hora|quando|when)/i,
            /^(onde|where|endereço|endereco)/i,
            /^(como|how)/i
        ];

        this.complexPatterns = [
            /porque|por que|why/i,
            /explicar|explain|detalhar/i,
            /diferença|comparar|compare/i,
            /análise|analise|analysis/i,
            /estratégia|estrategia|strategy/i
        ];
    }

    /**
     * Analisar complexidade da pergunta
     */
    analyze(question) {
        const length = question.length;
        const words = question.split(/\s+/).length;

        // Perguntas muito curtas são simples
        if (length < 20 || words < 5) {
            return 'simple';
        }

        // Verificar padrões simples
        for (const pattern of this.simplePatterns) {
            if (pattern.test(question)) {
                return 'simple';
            }
        }

        // Verificar padrões complexos
        for (const pattern of this.complexPatterns) {
            if (pattern.test(question)) {
                return 'complex';
            }
        }

        // Perguntas médias
        if (length < 100 && words < 20) {
            return 'medium';
        }

        return 'complex';
    }

    /**
     * Recomendar modelo baseado na complexidade
     */
    recommendModel(complexity) {
        switch (complexity) {
            case 'simple':
                return {
                    provider: 'groq',
                    model: 'llama3-8b-8192',
                    maxTokens: 150
                };
            
            case 'medium':
                return {
                    provider: 'groq',
                    model: 'llama3-70b-8192',
                    maxTokens: 300
                };
            
            case 'complex':
                return {
                    provider: 'groq',
                    model: 'llama3-70b-8192',
                    maxTokens: 500
                };
            
            default:
                return {
                    provider: 'groq',
                    model: 'llama3-70b-8192',
                    maxTokens: 300
                };
        }
    }
}

/**
 * 💾 Sistema de cache de respostas similares
 */
class ResponseCache {
    constructor() {
        this.cache = new Map();
        this.maxCacheSize = 1000;
        this.similarityThreshold = 0.85;
        // V9: TTL de 5 minutos (configurável via ENV)
        this.ttlMs = parseInt(process.env.LLM_CACHE_TTL_MS || String(5 * 60 * 1000), 10);
        this.stats = { hits: 0, misses: 0 };

        // V9: Cleanup automático a cada 2 minutos
        this._cleanupInterval = setInterval(() => this._cleanupExpired(), 2 * 60 * 1000);
        if (this._cleanupInterval.unref) this._cleanupInterval.unref();
    }

    /**
     * V9: Normalizar mensagem para melhor hit rate
     * Remove acentos, pontuação extra, espaços duplicados
     */
    _normalizeMessage(text) {
        return text
            .toLowerCase()
            .trim()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
            .replace(/[^a-z0-9\s]/g, ' ')  // remove pontuação
            .replace(/\s+/g, ' ')           // colapsa espaços
            .trim();
    }

    /**
     * Gerar hash da pergunta (V9: com normalização avançada)
     */
    generateHash(question) {
        const normalized = this._normalizeMessage(question);
        return crypto.createHash('md5').update(normalized).digest('hex');
    }

    /**
     * Calcular similaridade entre strings (Levenshtein simplificado)
     */
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Distância de Levenshtein
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * Buscar resposta similar no cache
     */
    findSimilar(question, chatbotId) {
        const normalizedQuestion = this._normalizeMessage(question);
        
        // Busca exata primeiro
        const exactHash = this.generateHash(question);
        const exactKey = `${chatbotId}:${exactHash}`;
        const exactMatch = this.cache.get(exactKey);
        
        if (exactMatch) {
            // V9: Verificar TTL
            if (Date.now() - exactMatch.timestamp > this.ttlMs) {
                this.cache.delete(exactKey);
                // Expirado, continua busca
            } else {
                this.stats.hits++;
                exactMatch.hits++;
                this._logCacheEvent('CACHE_HIT', { type: 'exact', chatbotId, questionLength: question.length });
                return exactMatch.response;
            }
        }

        // Busca por similaridade (V9: com normalização)
        for (const [key, value] of this.cache.entries()) {
            if (!key.startsWith(`${chatbotId}:`)) continue;
            
            // V9: Verificar TTL antes de comparar
            if (Date.now() - value.timestamp > this.ttlMs) continue;
            
            const similarity = this.calculateSimilarity(
                normalizedQuestion,
                this._normalizeMessage(value.question)
            );

            if (similarity >= this.similarityThreshold) {
                this.stats.hits++;
                value.hits++;
                this._logCacheEvent('CACHE_HIT', { type: 'similar', similarity: (similarity * 100).toFixed(1), chatbotId });
                return value.response;
            }
        }

        this.stats.misses++;
        this._logCacheEvent('CACHE_MISS', { chatbotId, questionLength: question.length });
        return null;
    }

    /**
     * Adicionar resposta ao cache
     */
    set(chatbotId, question, response, metadata = {}) {
        const hash = this.generateHash(question);
        const key = `${chatbotId}:${hash}`;

        // Limpar cache se exceder tamanho máximo
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(key, {
            question,
            response,
            metadata,
            timestamp: Date.now(),
            hits: 0
        });
    }

    /**
     * Obter estatísticas do cache
     */
    getStats() {
        return {
            version: 'v9',
            size: this.cache.size,
            maxSize: this.maxCacheSize,
            ttlMs: this.ttlMs,
            utilizationPercent: (this.cache.size / this.maxCacheSize * 100).toFixed(1),
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: (this.stats.hits + this.stats.misses) > 0
                ? ((this.stats.hits / (this.stats.hits + this.stats.misses)) * 100).toFixed(1)
                : '0.0'
        };
    }

    /**
     * Limpar cache
     */
    clear() {
        this.cache.clear();
        this.stats = { hits: 0, misses: 0 };
    }

    /**
     * V9: Cleanup de entries expirados
     */
    _cleanupExpired() {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.ttlMs) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            this._logCacheEvent('CACHE_CLEANUP', { cleaned, remaining: this.cache.size });
        }
    }

    /**
     * V9: Log estruturado JSON para cache
     */
    _logCacheEvent(event, data) {
        try {
            console.log(JSON.stringify({
                event: `[${event}]`,
                ...data,
                timestamp: new Date().toISOString()
            }));
        } catch (_) { /* nunca quebrar por log */ }
    }
}

/**
 * 🎯 Gerenciador de otimização de LLM
 */
class LLMOptimizer {
    constructor() {
        this.complexityAnalyzer = new QuestionComplexityAnalyzer();
        this.responseCache = new ResponseCache();
        this.usageStats = new Map();
        
        console.log('🎯 Sistema de Otimização LLM inicializado');
    }

    /**
     * Otimizar chamada de LLM
     */
    async optimizeCall(chatbotId, question, context = {}) {
        // 1. Verificar cache primeiro
        const cachedResponse = this.responseCache.findSimilar(question, chatbotId);
        
        if (cachedResponse) {
            this.trackUsage(chatbotId, 'cache', 0, 0);
            return {
                response: cachedResponse,
                source: 'cache',
                cost: 0,
                tokens: 0
            };
        }

        // 2. Analisar complexidade
        const complexity = this.complexityAnalyzer.analyze(question);
        const recommendation = this.complexityAnalyzer.recommendModel(complexity);

        console.log(`📊 Complexidade: ${complexity} | Modelo: ${recommendation.model}`);

        return {
            recommendation,
            complexity,
            shouldCache: complexity === 'simple' || complexity === 'medium'
        };
    }

    /**
     * Calcular custo da chamada
     */
    calculateCost(provider, model, inputTokens, outputTokens) {
        let pricing = PRICING[provider];
        
        if (!pricing) {
            return 0;
        }

        // Para OpenAI e OpenRouter, buscar pricing do modelo específico
        if (typeof pricing === 'object' && !pricing.input) {
            pricing = pricing[model] || { input: 0, output: 0 };
        }

        const inputCost = (inputTokens / 1000000) * pricing.input;
        const outputCost = (outputTokens / 1000000) * pricing.output;

        return inputCost + outputCost;
    }

    /**
     * Rastrear uso
     */
    trackUsage(chatbotId, provider, inputTokens, outputTokens, model = null) {
        const key = `${chatbotId}:${this.getTodayKey()}`;
        
        if (!this.usageStats.has(key)) {
            this.usageStats.set(key, {
                chatbotId,
                date: new Date().toISOString().split('T')[0],
                providers: {},
                totalCalls: 0,
                totalTokens: 0,
                totalCost: 0,
                cacheHits: 0
            });
        }

        const stats = this.usageStats.get(key);
        
        if (provider === 'cache') {
            stats.cacheHits++;
        } else {
            if (!stats.providers[provider]) {
                stats.providers[provider] = {
                    calls: 0,
                    inputTokens: 0,
                    outputTokens: 0,
                    cost: 0
                };
            }

            const providerStats = stats.providers[provider];
            providerStats.calls++;
            providerStats.inputTokens += inputTokens;
            providerStats.outputTokens += outputTokens;

            const cost = this.calculateCost(provider, model, inputTokens, outputTokens);
            providerStats.cost += cost;

            stats.totalCalls++;
            stats.totalTokens += inputTokens + outputTokens;
            stats.totalCost += cost;
        }
    }

    /**
     * Obter chave do dia
     */
    getTodayKey() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Obter estatísticas de uso
     */
    getUsageStats(chatbotId, days = 30) {
        const stats = [];
        
        for (const [key, value] of this.usageStats.entries()) {
            if (key.startsWith(`${chatbotId}:`)) {
                stats.push(value);
            }
        }

        // Ordenar por data
        stats.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Limitar aos últimos N dias
        return stats.slice(0, days);
    }

    /**
     * Obter resumo de economia
     */
    getSavingsSummary(chatbotId) {
        const stats = this.getUsageStats(chatbotId);
        
        let totalCalls = 0;
        let cacheHits = 0;
        let totalCost = 0;

        for (const day of stats) {
            totalCalls += day.totalCalls;
            cacheHits += day.cacheHits;
            totalCost += day.totalCost;
        }

        // Estimar custo sem cache (assumindo custo médio por chamada)
        const avgCostPerCall = totalCalls > 0 ? totalCost / totalCalls : 0;
        const estimatedCostWithoutCache = (totalCalls + cacheHits) * avgCostPerCall;
        const savings = estimatedCostWithoutCache - totalCost;
        const savingsPercent = estimatedCostWithoutCache > 0 
            ? (savings / estimatedCostWithoutCache * 100) 
            : 0;

        return {
            totalCalls: totalCalls + cacheHits,
            cacheHits,
            cacheHitRate: totalCalls + cacheHits > 0 
                ? (cacheHits / (totalCalls + cacheHits) * 100).toFixed(1)
                : 0,
            totalCost: totalCost.toFixed(2),
            estimatedCostWithoutCache: estimatedCostWithoutCache.toFixed(2),
            savings: savings.toFixed(2),
            savingsPercent: savingsPercent.toFixed(1)
        };
    }

    /**
     * Adicionar resposta ao cache
     */
    cacheResponse(chatbotId, question, response, metadata = {}) {
        this.responseCache.set(chatbotId, question, response, metadata);
    }

    /**
     * Obter estatísticas do cache
     */
    getCacheStats() {
        return this.responseCache.getStats();
    }
}

// Instância global do otimizador
const llmOptimizer = new LLMOptimizer();

module.exports = {
    llmOptimizer,
    QuestionComplexityAnalyzer,
    ResponseCache
};
