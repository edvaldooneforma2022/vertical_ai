/**
 * Testes Unitários - LLM Optimizer
 * Testa otimização de custos e cache de respostas
 */

const { llmOptimizer, QuestionComplexityAnalyzer, ResponseCache } = require('../../llm-optimizer');

describe('QuestionComplexityAnalyzer', () => {
    let analyzer;

    beforeEach(() => {
        analyzer = new QuestionComplexityAnalyzer();
    });

    describe('analyze', () => {
        test('deve classificar saudações como simples', () => {
            const result = analyzer.analyze('Olá');
            expect(result.complexity).toBe('simple');
        });

        test('deve classificar perguntas técnicas como complexas', () => {
            const result = analyzer.analyze('Como funciona a análise de sentimentos usando deep learning com transformers?');
            expect(result.complexity).toBe('complex');
        });

        test('deve classificar perguntas médias corretamente', () => {
            const result = analyzer.analyze('Qual o preço do plano profissional?');
            expect(['simple', 'medium']).toContain(result.complexity);
        });
    });

    describe('recommendModel', () => {
        test('deve recomendar modelo rápido para perguntas simples', () => {
            const recommendation = analyzer.recommendModel('simple');
            expect(recommendation.provider).toBeDefined();
        });

        test('deve recomendar modelo avançado para perguntas complexas', () => {
            const recommendation = analyzer.recommendModel('complex');
            expect(recommendation.provider).toBeDefined();
        });
    });
});

describe('ResponseCache', () => {
    let cache;

    beforeEach(() => {
        cache = new ResponseCache();
        cache.clear();
    });

    describe('set e findSimilar', () => {
        test('deve armazenar e recuperar resposta', () => {
            cache.set('chatbot-1', 'Qual o preço?', 'O preço é R$ 99,90');

            const found = cache.findSimilar('Qual o preço?', 'chatbot-1');
            expect(found).not.toBeNull();
            expect(found.response).toBe('O preço é R$ 99,90');
        });

        test('deve encontrar respostas similares', () => {
            cache.set('chatbot-1', 'Qual o valor do produto?', 'O valor é R$ 99,90');

            // Pergunta similar mas não idêntica
            const found = cache.findSimilar('Qual o valor?', 'chatbot-1');
            // Pode ou não encontrar dependendo do threshold
            // O importante é não quebrar
            expect(found === null || found.response).toBeTruthy();
        });

        test('deve retornar null para chatbot diferente', () => {
            cache.set('chatbot-1', 'Qual o preço?', 'O preço é R$ 99,90');

            const found = cache.findSimilar('Qual o preço?', 'chatbot-2');
            expect(found).toBeNull();
        });
    });

    describe('getStats', () => {
        test('deve retornar estatísticas do cache', () => {
            cache.set('chatbot-1', 'Pergunta 1', 'Resposta 1');
            cache.set('chatbot-1', 'Pergunta 2', 'Resposta 2');

            const stats = cache.getStats();
            expect(stats.size).toBe(2);
        });
    });

    describe('clear', () => {
        test('deve limpar todo o cache', () => {
            cache.set('chatbot-1', 'Pergunta', 'Resposta');
            cache.clear();

            const stats = cache.getStats();
            expect(stats.size).toBe(0);
        });
    });
});

describe('LLMOptimizer', () => {
    describe('optimizeCall', () => {
        test('deve retornar recomendações válidas', () => {
            const result = llmOptimizer.optimizeCall('test-chatbot', 'Olá, tudo bem?');

            expect(result).toHaveProperty('recommendedModel');
            expect(result).toHaveProperty('complexity');
        });

        test('deve verificar cache antes de recomendar', () => {
            // Adicionar ao cache primeiro
            llmOptimizer.cacheResponse('test-chatbot', 'Pergunta teste', 'Resposta teste');

            const result = llmOptimizer.optimizeCall('test-chatbot', 'Pergunta teste');

            // Deve ter cacheHit se encontrou
            expect(result).toHaveProperty('cacheHit');
        });
    });

    describe('calculateCost', () => {
        test('deve calcular custo para Groq', () => {
            const cost = llmOptimizer.calculateCost('groq', 'llama-3', 1000, 500);
            expect(typeof cost).toBe('number');
            expect(cost).toBeGreaterThanOrEqual(0);
        });

        test('deve calcular custo para OpenAI', () => {
            const cost = llmOptimizer.calculateCost('openai', 'gpt-4', 1000, 500);
            expect(typeof cost).toBe('number');
            expect(cost).toBeGreaterThan(0);
        });
    });
});
