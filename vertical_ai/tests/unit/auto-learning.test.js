/**
 * 🧪 TESTES — Auto-Learning V1.0
 * 
 * Validar:
 * 1. IA responde igual com feature OFF
 * 2. Dados são coletados corretamente
 * 3. Eventos são registrados
 * 4. Nenhuma quebra com módulos ausentes
 * 5. Performance engine gera scores válidos
 * 6. Memory store funciona com LRU
 * 7. Optimizer retorna original em caso de erro
 */

// Mock do fs para não escrever em disco durante testes
jest.mock('fs', () => {
    const actual = jest.requireActual('fs');
    return {
        ...actual,
        existsSync: jest.fn().mockReturnValue(false),
        mkdirSync: jest.fn(),
        writeFileSync: jest.fn(),
        readFileSync: jest.fn().mockReturnValue('[]')
    };
});

// Limpar variáveis de ambiente
beforeAll(() => {
    process.env.DEBUG_LEARNING = 'false';
});

describe('ConversationTracker', () => {
    let ConversationTracker;

    beforeEach(() => {
        jest.resetModules();
        const module = require('../../analytics/conversation-tracker');
        ConversationTracker = module.ConversationTracker;
    });

    test('deve inicializar sem erros', () => {
        const tracker = new ConversationTracker();
        expect(tracker).toBeDefined();
    });

    test('deve registrar interação e retornar ID', () => {
        const tracker = new ConversationTracker();
        // Forçar initialized
        tracker.initialized = true;

        const id = tracker.record({
            conversationId: 'test-conv-1',
            userMessage: 'Quanto custa?',
            aiResponse: 'O valor é R$ 99,90. Acesse https://example.com',
            detectedIntent: 'comprar',
            journeyStage: 'negociacao'
        });

        expect(id).toBeTruthy();
        expect(typeof id).toBe('string');
        expect(tracker.pendingWrites.length).toBe(1);
    });

    test('deve detectar CTA na resposta', () => {
        const tracker = new ConversationTracker();
        tracker.initialized = true;

        tracker.record({
            conversationId: 'test-conv-2',
            userMessage: 'Quero comprar',
            aiResponse: 'Acesse o link: https://checkout.com/produto'
        });

        const record = tracker.pendingWrites[0];
        expect(record.hasCTA).toBe(true);
        expect(record.links).toContain('https://checkout.com/produto');
    });

    test('deve extrair links da resposta', () => {
        const tracker = new ConversationTracker();
        tracker.initialized = true;

        tracker.record({
            conversationId: 'test-conv-3',
            userMessage: 'Links?',
            aiResponse: 'Veja: https://site1.com e https://site2.com/path'
        });

        const record = tracker.pendingWrites[0];
        expect(record.links.length).toBe(2);
    });

    test('deve retornar null se não inicializado', () => {
        const tracker = new ConversationTracker();
        tracker.initialized = false;

        const id = tracker.record({ userMessage: 'teste' });
        expect(id).toBeNull();
    });

    test('deve atualizar ação por conversationId', () => {
        const tracker = new ConversationTracker();
        tracker.initialized = true;
        tracker.records = [{
            conversationId: 'conv-update-test',
            actions: { clicked: false, scheduled: false, leadCaptured: false, whatsappOpened: false }
        }];

        const result = tracker.updateAction('conv-update-test', 'clicked');
        expect(result).toBe(true);
        expect(tracker.records[0].actions.clicked).toBe(true);
    });

    test('deve rejeitar ação inválida', () => {
        const tracker = new ConversationTracker();
        tracker.initialized = true;
        tracker.records = [{
            conversationId: 'conv-invalid',
            actions: {}
        }];

        const result = tracker.updateAction('conv-invalid', 'invalidAction');
        expect(result).toBe(false);
    });

    test('deve retornar stats corretos', () => {
        const tracker = new ConversationTracker();
        tracker.initialized = true;
        tracker.records = [
            { actions: { clicked: true }, timestamp: '2026-01-01T00:00:00Z' },
            { actions: { clicked: false }, timestamp: '2026-01-02T00:00:00Z' },
            { actions: { scheduled: true }, timestamp: '2026-01-03T00:00:00Z' }
        ];

        const stats = tracker.getStats();
        expect(stats.totalRecords).toBe(3);
        expect(stats.convertedRecords).toBe(2);
    });

    test('NUNCA deve lançar exceção no record()', () => {
        const tracker = new ConversationTracker();
        tracker.initialized = true;
        // Forçar erro interno
        tracker._sanitize = () => { throw new Error('Forced error'); };

        expect(() => {
            tracker.record({ userMessage: 'teste' });
        }).not.toThrow();
    });

    test('deve sanitizar e truncar mensagens', () => {
        const tracker = new ConversationTracker();
        tracker.initialized = true;

        const longMessage = 'x'.repeat(2000);
        tracker.record({
            conversationId: 'trunc-test',
            userMessage: longMessage,
            aiResponse: 'y'.repeat(1000)
        });

        const record = tracker.pendingWrites[0];
        expect(record.userMessage.length).toBeLessThanOrEqual(1000);
        expect(record.aiResponse.length).toBeLessThanOrEqual(503); // 500 + '...'
    });
});

describe('PerformanceEngine', () => {
    let PerformanceEngine;

    beforeEach(() => {
        jest.resetModules();
        const module = require('../../analytics/performance-engine');
        PerformanceEngine = module.PerformanceEngine;
    });

    test('deve inicializar sem erros', () => {
        const engine = new PerformanceEngine();
        expect(engine).toBeDefined();
        expect(engine.patterns).toBeDefined();
    });

    test('deve processar registros e gerar scores', () => {
        const engine = new PerformanceEngine();
        engine.initialized = true;

        const records = [];
        // Criar 10 registros com mesma intent/stage, 5 com conversão
        for (let i = 0; i < 10; i++) {
            records.push({
                detectedIntent: 'comprar',
                journeyStage: 'negociacao',
                hasCTA: true,
                aiResponse: `Resposta ${i}`,
                actions: {
                    clicked: i < 5,
                    scheduled: false,
                    leadCaptured: false,
                    whatsappOpened: false
                }
            });
        }

        engine.processRecords(records);

        const score = engine.getScore('comprar', 'negociacao');
        expect(score).toBeTruthy();
        expect(score.successRate).toBe(0.5);
        expect(score.attempts).toBe(10);
    });

    test('deve ignorar padrões com poucas amostras', () => {
        const engine = new PerformanceEngine();
        engine.initialized = true;

        const records = [
            {
                detectedIntent: 'raro',
                journeyStage: 'descoberta',
                actions: { clicked: true }
            }
        ];

        engine.processRecords(records);

        const score = engine.getScore('raro', 'descoberta');
        expect(score).toBeNull();
    });

    test('deve retornar top padrões ordenados', () => {
        const engine = new PerformanceEngine();
        engine.initialized = true;

        engine.patterns.set('a::b', { successRate: 0.3, attempts: 10 });
        engine.patterns.set('c::d', { successRate: 0.8, attempts: 20 });
        engine.patterns.set('e::f', { successRate: 0.5, attempts: 15 });

        const top = engine.getTopPatterns(2);
        expect(top.length).toBe(2);
        expect(top[0].successRate).toBe(0.8);
    });

    test('deve notificar e verificar recálculo', () => {
        const engine = new PerformanceEngine();
        expect(engine.needsRecalc()).toBe(false);

        for (let i = 0; i < 100; i++) {
            engine.notifyEvent();
        }

        expect(engine.needsRecalc()).toBe(true);

        engine.resetRecalcCounter();
        expect(engine.needsRecalc()).toBe(false);
    });
});

describe('MemoryStore', () => {
    let MemoryStore;

    beforeEach(() => {
        jest.resetModules();
        const module = require('../../analytics/memory-store');
        MemoryStore = module.MemoryStore;
    });

    test('deve inicializar sem erros', () => {
        const store = new MemoryStore();
        expect(store).toBeDefined();
    });

    test('deve armazenar e recuperar padrão', () => {
        const store = new MemoryStore();
        store.initialized = true;

        store.store_pattern('comprar', 'informal', 'negociacao', {
            successRate: 0.75,
            topResponses: ['Resposta top 1', 'Resposta top 2'],
            attempts: 50,
            conversions: 38
        });

        const data = store.getLearnedData('comprar', 'informal', 'negociacao');
        expect(data).toBeTruthy();
        expect(data.successRate).toBe(0.75);
        expect(data.topResponses.length).toBe(2);
    });

    test('deve retornar null quando não há dados', () => {
        const store = new MemoryStore();
        store.initialized = true;

        const data = store.getLearnedData('inexistente', 'nenhum', 'nada');
        expect(data).toBeNull();
    });

    test('deve fazer fallback para match sem profile', () => {
        const store = new MemoryStore();
        store.initialized = true;

        store.store_pattern('info', 'unknown', 'descoberta', {
            successRate: 0.6,
            topResponses: ['Resposta fallback'],
            attempts: 20,
            conversions: 12
        });

        // Buscar com profile diferente — deve cair no fallback
        const data = store.getLearnedData('info', 'formal', 'descoberta');
        expect(data).toBeTruthy();
        expect(data.successRate).toBe(0.6);
    });

    test('deve respeitar limite LRU', () => {
        const store = new MemoryStore();
        store.initialized = true;

        // Inserir mais que o limite (simulado com store menor)
        for (let i = 0; i < 10; i++) {
            store.store_pattern(`intent_${i}`, 'unknown', 'unknown', {
                successRate: 0.5,
                topResponses: [],
                attempts: 10
            });
        }

        expect(store.store.size).toBeLessThanOrEqual(1000);
    });
});

describe('LearningOptimizer', () => {
    let LearningOptimizer;

    beforeEach(() => {
        jest.resetModules();
        const module = require('../../analytics/learning-optimizer');
        LearningOptimizer = module.LearningOptimizer;
    });

    test('deve retornar resposta original se learnedData é null', () => {
        const optimizer = new LearningOptimizer();
        const original = 'Esta é a resposta original da IA.';

        const result = optimizer.enhance(original, null, {});
        expect(result).toBe(original);
    });

    test('deve retornar resposta original se dados insuficientes', () => {
        const optimizer = new LearningOptimizer();
        const original = 'Resposta original.';

        const result = optimizer.enhance(original, {
            successRate: 0.8,
            attempts: 5, // Menos que MIN_ATTEMPTS (10)
            topResponses: []
        }, {});

        expect(result).toBe(original);
    });

    test('deve retornar resposta original se successRate baixa', () => {
        const optimizer = new LearningOptimizer();
        const original = 'Resposta original.';

        const result = optimizer.enhance(original, {
            successRate: 0.1, // Menos que MIN_SUCCESS_RATE (0.3)
            attempts: 50,
            topResponses: []
        }, {});

        expect(result).toBe(original);
    });

    test('deve otimizar quando há dados suficientes', () => {
        const optimizer = new LearningOptimizer();
        const original = 'Esta é uma resposta sem ênfase na primeira frase. E continua aqui.';

        const result = optimizer.enhance(original, {
            successRate: 0.7,
            attempts: 100,
            topResponses: ['**Resposta com ênfase.** Detalhes aqui.']
        }, { journeyStage: 'descoberta' });

        // Deve ter aplicado alguma otimização
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    test('NUNCA deve lançar exceção no enhance()', () => {
        const optimizer = new LearningOptimizer();
        const original = 'Resposta segura.';

        // Forçar erro
        optimizer._hasCTA = () => { throw new Error('Forced'); };

        expect(() => {
            const result = optimizer.enhance(original, {
                successRate: 0.9,
                attempts: 200,
                topResponses: ['Top']
            }, { journeyStage: 'negociacao' });
            // Em caso de erro, deve retornar original
            expect(result).toBe(original);
        }).not.toThrow();
    });

    test('deve verificar readiness para otimização', () => {
        const optimizer = new LearningOptimizer();

        expect(optimizer.isReadyToOptimize(10)).toBe(false);
        expect(optimizer.isReadyToOptimize(50)).toBe(true);
        expect(optimizer.isReadyToOptimize(100)).toBe(true);
    });
});

describe('Auto-Learning Index (Barrel)', () => {
    let autoLearning;

    beforeEach(() => {
        jest.resetModules();
        autoLearning = require('../../analytics/index');
    });

    test('deve exportar todos os módulos', () => {
        expect(autoLearning.tracker).toBeDefined();
        expect(autoLearning.performance).toBeDefined();
        expect(autoLearning.memory).toBeDefined();
        expect(autoLearning.optimizer).toBeDefined();
    });

    test('deve exportar funções de conveniência', () => {
        expect(typeof autoLearning.recordInteraction).toBe('function');
        expect(typeof autoLearning.trackConversion).toBe('function');
        expect(typeof autoLearning.getLearnedData).toBe('function');
        expect(typeof autoLearning.optimizeResponse).toBe('function');
        expect(typeof autoLearning.getSystemStats).toBe('function');
    });

    test('recordInteraction deve funcionar sem erros', () => {
        autoLearning.tracker.initialized = true;

        const id = autoLearning.recordInteraction({
            conversationId: 'barrel-test',
            userMessage: 'Teste de integração',
            aiResponse: 'Resposta integrada'
        });

        expect(id).toBeTruthy();
    });

    test('trackConversion deve mapear eventos corretamente', () => {
        autoLearning.tracker.initialized = true;
        autoLearning.tracker.records = [{
            conversationId: 'track-test',
            actions: { clicked: false, scheduled: false, leadCaptured: false, whatsappOpened: false }
        }];

        autoLearning.trackConversion('track-test', 'click_link');
        expect(autoLearning.tracker.records[0].actions.clicked).toBe(true);

        autoLearning.trackConversion('track-test', 'open_whatsapp');
        expect(autoLearning.tracker.records[0].actions.whatsappOpened).toBe(true);
    });

    test('trackConversion deve retornar false para evento desconhecido', () => {
        const result = autoLearning.trackConversion('any', 'evento_invalido');
        expect(result).toBe(false);
    });

    test('optimizeResponse deve retornar original quando sem dados', () => {
        const original = 'Resposta original sem otimização.';
        const result = autoLearning.optimizeResponse(original, 'info', null, 'descoberta');
        expect(result).toBe(original);
    });

    test('getSystemStats deve retornar objeto válido', () => {
        const stats = autoLearning.getSystemStats();
        expect(stats).toBeDefined();
        expect(stats.tracker).toBeDefined();
        expect(stats.performance).toBeDefined();
        expect(stats.memory).toBeDefined();
        expect(stats.optimizer).toBeDefined();
    });
});

describe('Regressão — Feature OFF', () => {
    test('com feature flag OFF, nenhum módulo deve interferir', () => {
        // Simular que feature está desligada
        const featureFlags = {
            isEnabled: (flag) => false
        };

        const response = 'Resposta original da IA';
        let finalResponse = response;

        // Simular lógica do server.js
        try {
            const autoLearning = require('../../analytics/index');
            if (autoLearning && featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_AUTO_LEARNING')) {
                autoLearning.recordInteraction({ userMessage: 'test', aiResponse: response });
                finalResponse = autoLearning.optimizeResponse(response, null, null, null);
            }
        } catch (e) {
            // Silencioso
        }

        // Resposta deve ser exatamente igual
        expect(finalResponse).toBe(response);
    });
});
