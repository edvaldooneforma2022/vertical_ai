/**
 * Testes Unitários - Analytics Manager
 * Testa rastreamento de eventos e métricas
 */

const { analyticsManager } = require('../../../analytics.js');

describe('AnalyticsManager', () => {
    beforeEach(() => {
        // Limpar buffer antes de cada teste
        analyticsManager.metricsBuffer.clear();
    });

    afterAll(() => {
        if (analyticsManager.flushTimer) {
            clearInterval(analyticsManager.flushTimer);
        }
    });

    describe('trackEvent', () => {
        test('deve registrar evento de mensagem', () => {
            analyticsManager.trackEvent('test-chatbot', 'message', {
                responseTime: 150,
                success: true
            });

            const todayKey = analyticsManager.getTodayKey();
            expect(analyticsManager.metricsBuffer.has(`test-chatbot:${todayKey}`)).toBe(true);
        });

        test('deve registrar evento de lead', () => {
            analyticsManager.trackEvent('test-chatbot', 'lead_captured', {
                email: 'test@example.com'
            });

            const todayKey = analyticsManager.getTodayKey();
            expect(analyticsManager.metricsBuffer.has(`test-chatbot:${todayKey}`)).toBe(true);
        });

        test('deve registrar evento de extração', () => {
            analyticsManager.trackEvent('test-chatbot', 'extraction', {
                url: 'https://example.com',
                success: true
            });

            const todayKey = analyticsManager.getTodayKey();
            expect(analyticsManager.metricsBuffer.has(`test-chatbot:${todayKey}`)).toBe(true);
        });
    });

    describe('initializeMetrics', () => {
        test('deve retornar estrutura de métricas válida', () => {
            const metrics = analyticsManager.initializeMetrics();

            expect(metrics).toHaveProperty('messages');
            expect(metrics).toHaveProperty('leads');
            expect(metrics).toHaveProperty('extractions');
            expect(metrics).toHaveProperty('responseTimes');
            expect(metrics).toHaveProperty('apiCosts');
        });
    });

    describe('getTodayKey', () => {
        test('deve retornar data no formato YYYY-MM-DD', () => {
            const key = analyticsManager.getTodayKey();

            expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });

    describe('getSummary', () => {
        test('deve retornar resumo mesmo sem dados', async () => {
            const summary = await analyticsManager.getSummary('non-existent-chatbot', 7);

            expect(summary).toHaveProperty('period');
            expect(summary).toHaveProperty('totalMessages');
            expect(summary).toHaveProperty('totalLeads');
        });
    });
});
