/**
 * Testes de Integração - API do Chatbot
 * Testa endpoints críticos do chatbot e geração de HTML
 */

const request = require('supertest');
const express = require('express');

// Importar função escapeForJS do server (simulada aqui para testes)
function escapeForJS(str) {
    if (!str) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t')
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e');
}

// Mock do app para testes
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

    // Mock do endpoint /chatbot
    app.get('/chatbot', (req, res) => {
        const robotName = req.query.name || 'Assistente IA';
        const instructions = req.query.instructions || '';

        const safeRobotName = escapeForJS(robotName);
        const safeInstructions = escapeForJS(instructions);

        const html = `<!DOCTYPE html>
<html>
<head><title>Chatbot - ${safeRobotName}</title></head>
<body>
<script>
const robotName = "${safeRobotName}";
const instructions = "${safeInstructions}";
console.log("Chatbot:", robotName);
</script>
</body>
</html>`;

        res.set('Content-Type', 'text/html');
        res.send(html);
    });

    // Mock do endpoint /api/process-chat-inteligente
    app.post('/api/process-chat-inteligente', (req, res) => {
        const { message, robotName, apiKey } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Mensagem é obrigatória'
            });
        }

        res.json({
            success: true,
            response: `Olá! Sou ${robotName || 'Assistente IA'}. Você disse: ${message}`,
            leadId: null
        });
    });

    return app;
};

describe('API do Chatbot', () => {
    let app;

    beforeAll(() => {
        app = createTestApp();
    });

    describe('GET /chatbot', () => {
        test('deve retornar página HTML do chatbot', async () => {
            const response = await request(app)
                .get('/chatbot')
                .query({ name: 'Link Mágico', url: 'https://example.com' })
                .expect(200);

            expect(response.text).toContain('<!DOCTYPE html>');
            expect(response.text).toContain('Link Mágico');
        });

        test('deve escapar aspas duplas corretamente', async () => {
            const response = await request(app)
                .get('/chatbot')
                .query({
                    name: 'Assistente "Teste"',
                    instructions: 'Responda com "clareza"'
                })
                .expect(200);

            // Não deve quebrar o JavaScript
            expect(response.text).not.toContain('Assistente "Teste"');
            expect(response.text).toContain('Assistente \\"Teste\\"');
        });

        test('deve escapar tags script para evitar XSS', async () => {
            const response = await request(app)
                .get('/chatbot')
                .query({
                    name: 'Test</script><script>alert(1)',
                    instructions: ''
                })
                .expect(200);

            // Não deve conter tags script não escapadas
            expect(response.text).not.toContain('</script><script>');
            expect(response.text).toContain('\\u003c/script\\u003e');
        });

        test('deve lidar com quebras de linha nas instruções', async () => {
            const response = await request(app)
                .get('/chatbot')
                .query({
                    name: 'Bot',
                    instructions: 'Linha 1\nLinha 2\nLinha 3'
                })
                .expect(200);

            // Quebras de linha devem ser escapadas
            expect(response.text).toContain('Linha 1\\nLinha 2\\nLinha 3');
        });
    });

    describe('POST /api/process-chat-inteligente', () => {
        test('deve processar mensagem com sucesso', async () => {
            const response = await request(app)
                .post('/api/process-chat-inteligente')
                .send({
                    message: 'Qual o preço?',
                    robotName: 'Link Mágico',
                    apiKey: 'TEST-KEY'
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.response).toContain('Qual o preço?');
        });

        test('deve rejeitar requisição sem mensagem', async () => {
            const response = await request(app)
                .post('/api/process-chat-inteligente')
                .send({
                    robotName: 'Link Mágico'
                })
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });
});

describe('Função escapeForJS', () => {
    test('deve escapar aspas duplas', () => {
        expect(escapeForJS('texto "com aspas"')).toBe('texto \\"com aspas\\"');
    });

    test('deve escapar aspas simples', () => {
        expect(escapeForJS("texto 'com aspas'")).toBe("texto \\'com aspas\\'");
    });

    test('deve escapar barras invertidas', () => {
        expect(escapeForJS('caminho\\arquivo')).toBe('caminho\\\\arquivo');
    });

    test('deve escapar quebras de linha', () => {
        expect(escapeForJS('linha1\nlinha2')).toBe('linha1\\nlinha2');
    });

    test('deve escapar retorno de carro', () => {
        expect(escapeForJS('texto\r\ncom CRLF')).toBe('texto\\r\\ncom CRLF');
    });

    test('deve escapar tabs', () => {
        expect(escapeForJS('col1\tcol2')).toBe('col1\\tcol2');
    });

    test('deve escapar tags HTML para evitar XSS', () => {
        expect(escapeForJS('<script>alert(1)</script>')).toBe('\\u003cscript\\u003ealert(1)\\u003c/script\\u003e');
    });

    test('deve retornar string vazia para null/undefined', () => {
        expect(escapeForJS(null)).toBe('');
        expect(escapeForJS(undefined)).toBe('');
        expect(escapeForJS('')).toBe('');
    });

    test('deve lidar com strings complexas', () => {
        const input = 'Responda em "5 linhas" e de forma amigável.\nSeja objetivo.';
        const expected = 'Responda em \\"5 linhas\\" e de forma amigável.\\nSeja objetivo.';
        expect(escapeForJS(input)).toBe(expected);
    });
});
