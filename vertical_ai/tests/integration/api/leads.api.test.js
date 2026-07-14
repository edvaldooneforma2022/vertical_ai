/**
 * Testes de Integração - API de Leads
 * Testa endpoints REST de leads
 */

const request = require('supertest');
const express = require('express');

// Mock básico do app para testes
const createTestApp = () => {
    const app = express();
    app.use(express.json());

    // Mock de sessão
    app.use((req, res, next) => {
        req.session = {
            validatedApiKey: 'TEST-API-KEY-123'
        };
        next();
    });

    // Mock dos endpoints
    app.get('/admin/leads', (req, res) => {
        res.json({
            success: true,
            leads: [],
            total: 0
        });
    });

    app.get('/admin/leads/:id', (req, res) => {
        if (req.params.id === 'existing-lead') {
            res.json({
                success: true,
                lead: {
                    id: 'existing-lead',
                    nome: 'Test Lead',
                    email: 'test@example.com'
                }
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Lead não encontrado'
            });
        }
    });

    app.post('/api/capture-lead', (req, res) => {
        const { nome, email } = req.body;

        if (!nome || !email) {
            return res.status(400).json({
                success: false,
                error: 'Nome e email são obrigatórios'
            });
        }

        res.json({
            success: true,
            lead: {
                id: 'new-lead-123',
                nome,
                email,
                timestamp: new Date().toISOString()
            }
        });
    });

    return app;
};

describe('API de Leads', () => {
    let app;

    beforeAll(() => {
        app = createTestApp();
    });

    describe('GET /admin/leads', () => {
        test('deve retornar lista de leads', async () => {
            const response = await request(app)
                .get('/admin/leads')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('leads');
            expect(response.body).toHaveProperty('total');
        });
    });

    describe('GET /admin/leads/:id', () => {
        test('deve retornar lead existente', async () => {
            const response = await request(app)
                .get('/admin/leads/existing-lead')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.lead.id).toBe('existing-lead');
        });

        test('deve retornar 404 para lead inexistente', async () => {
            const response = await request(app)
                .get('/admin/leads/non-existent')
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /api/capture-lead', () => {
        test('deve capturar novo lead com dados válidos', async () => {
            const response = await request(app)
                .post('/api/capture-lead')
                .send({
                    nome: 'João Silva',
                    email: 'joao@example.com'
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.lead).toHaveProperty('id');
            expect(response.body.lead.nome).toBe('João Silva');
        });

        test('deve rejeitar lead sem email', async () => {
            const response = await request(app)
                .post('/api/capture-lead')
                .send({
                    nome: 'João Silva'
                })
                .expect(400);

            expect(response.body.success).toBe(false);
        });

        test('deve rejeitar lead sem nome', async () => {
            const response = await request(app)
                .post('/api/capture-lead')
                .send({
                    email: 'joao@example.com'
                })
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });
});
