/**
 * Testes de Integração - API Meus Assistentes
 * Testa CRUD de assistentes, isolamento por tenant e feature flag
 */

const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');

// --- Storage helpers (mirroring server.js logic for test isolation) ---
const TEST_DATA_DIR = path.join(__dirname, '..', '..', '..', 'data', 'tenants');

function getAssistantsFilePath(apiKey) {
    const safeKey = String(apiKey).replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(TEST_DATA_DIR, `assistants-${safeKey}.json`);
}

function loadAssistantsData(apiKey) {
    try {
        const filePath = getAssistantsFilePath(apiKey);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) { /* ignore */ }
    return [];
}

function saveAssistantsData(apiKey, data) {
    if (!fs.existsSync(TEST_DATA_DIR)) fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    fs.writeFileSync(getAssistantsFilePath(apiKey), JSON.stringify(data, null, 2), 'utf8');
}

// --- Feature flag mock ---
let featureFlagEnabled = true;

// --- Mock Express app mimicking server.js routes ---
function createTestApp(sessionApiKey = 'TEST-ASST-KEY-001') {
    const app = express();
    app.use(express.json());

    // Mock session
    app.use((req, res, next) => {
        req.session = { validatedApiKey: sessionApiKey };
        next();
    });

    // --- CRUD Routes (same logic as server.js) ---
    app.get('/api/assistants', (req, res) => {
        try {
            const apiKey = req.session.validatedApiKey || req.query.apiKey;
            if (!apiKey) return res.status(401).json({ success: false, error: 'API Key não fornecida' });
            if (!featureFlagEnabled) return res.status(403).json({ success: false, error: 'Funcionalidade desabilitada' });

            const assistants = loadAssistantsData(apiKey);
            res.json({ success: true, assistants, total: assistants.length });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/api/assistants', (req, res) => {
        try {
            const apiKey = req.session.validatedApiKey || req.body.apiKey;
            if (!apiKey) return res.status(401).json({ success: false, error: 'API Key não fornecida' });
            if (!featureFlagEnabled) return res.status(403).json({ success: false, error: 'Funcionalidade desabilitada' });

            const { name, salesUrl, instructions } = req.body;
            if (!name || !name.trim()) return res.status(400).json({ success: false, error: 'Nome do assistente é obrigatório' });
            if (!salesUrl || !salesUrl.trim()) return res.status(400).json({ success: false, error: 'URL de vendas é obrigatória' });

            const assistants = loadAssistantsData(apiKey);
            const newAssistant = {
                id: `asst_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                name: name.trim(),
                salesUrl: salesUrl.trim(),
                instructions: (instructions || '').trim(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: 'active'
            };
            assistants.push(newAssistant);
            saveAssistantsData(apiKey, assistants);

            res.json({ success: true, assistant: newAssistant, message: 'Assistente criado com sucesso' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.put('/api/assistants/:id', (req, res) => {
        try {
            const apiKey = req.session.validatedApiKey || req.body.apiKey;
            if (!apiKey) return res.status(401).json({ success: false, error: 'API Key não fornecida' });
            if (!featureFlagEnabled) return res.status(403).json({ success: false, error: 'Funcionalidade desabilitada' });

            const assistants = loadAssistantsData(apiKey);
            const index = assistants.findIndex(a => a.id === req.params.id);
            if (index === -1) return res.status(404).json({ success: false, error: 'Assistente não encontrado' });

            const { name, salesUrl, instructions, status } = req.body;
            if (name !== undefined) assistants[index].name = name.trim();
            if (salesUrl !== undefined) assistants[index].salesUrl = salesUrl.trim();
            if (instructions !== undefined) assistants[index].instructions = instructions.trim();
            if (status !== undefined && ['active', 'inactive'].includes(status)) assistants[index].status = status;
            assistants[index].updatedAt = new Date().toISOString();

            saveAssistantsData(apiKey, assistants);
            res.json({ success: true, assistant: assistants[index], message: 'Assistente atualizado com sucesso' });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.delete('/api/assistants/:id', (req, res) => {
        try {
            const apiKey = req.session.validatedApiKey || req.query.apiKey;
            if (!apiKey) return res.status(401).json({ success: false, error: 'API Key não fornecida' });
            if (!featureFlagEnabled) return res.status(403).json({ success: false, error: 'Funcionalidade desabilitada' });

            const assistants = loadAssistantsData(apiKey);
            const index = assistants.findIndex(a => a.id === req.params.id);
            if (index === -1) return res.status(404).json({ success: false, error: 'Assistente não encontrado' });

            const removed = assistants.splice(index, 1)[0];
            saveAssistantsData(apiKey, assistants);

            res.json({ success: true, message: 'Assistente removido com sucesso', removedId: removed.id });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    return app;
}

// --- Cleanup helper ---
function cleanupTestFiles() {
    ['TEST-ASST-KEY-001', 'TEST-ASST-KEY-002'].forEach(key => {
        const fp = getAssistantsFilePath(key);
        try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch (e) { /* ignore */ }
    });
}

// =============================================================================
// TESTS
// =============================================================================

describe('API Meus Assistentes', () => {
    let app;

    beforeAll(() => {
        app = createTestApp('TEST-ASST-KEY-001');
        featureFlagEnabled = true;
    });

    beforeEach(() => {
        cleanupTestFiles();
        featureFlagEnabled = true;
    });

    afterAll(() => {
        cleanupTestFiles();
    });

    // --- LIST ---
    describe('GET /api/assistants', () => {
        test('deve retornar lista vazia inicialmente', async () => {
            const res = await request(app).get('/api/assistants').expect(200);
            expect(res.body.success).toBe(true);
            expect(res.body.assistants).toEqual([]);
            expect(res.body.total).toBe(0);
        });

        test('deve retornar 403 quando feature flag desabilitada', async () => {
            featureFlagEnabled = false;
            const res = await request(app).get('/api/assistants').expect(403);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('desabilitada');
        });
    });

    // --- CREATE ---
    describe('POST /api/assistants', () => {
        test('deve criar um assistente com sucesso', async () => {
            const res = await request(app)
                .post('/api/assistants')
                .send({ name: '@VendasBot', salesUrl: 'https://example.com', instructions: 'Responda bem' })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.assistant).toBeDefined();
            expect(res.body.assistant.name).toBe('@VendasBot');
            expect(res.body.assistant.salesUrl).toBe('https://example.com');
            expect(res.body.assistant.status).toBe('active');
            expect(res.body.assistant.id).toMatch(/^asst_/);
        });

        test('deve rejeitar sem nome', async () => {
            const res = await request(app)
                .post('/api/assistants')
                .send({ salesUrl: 'https://example.com' })
                .expect(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('Nome');
        });

        test('deve rejeitar sem URL', async () => {
            const res = await request(app)
                .post('/api/assistants')
                .send({ name: 'Bot' })
                .expect(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('URL');
        });

        test('deve persistir o assistente criado', async () => {
            await request(app)
                .post('/api/assistants')
                .send({ name: 'PersistBot', salesUrl: 'https://persist.com' })
                .expect(200);

            const list = await request(app).get('/api/assistants').expect(200);
            expect(list.body.total).toBe(1);
            expect(list.body.assistants[0].name).toBe('PersistBot');
        });
    });

    // --- UPDATE ---
    describe('PUT /api/assistants/:id', () => {
        test('deve atualizar um assistente existente', async () => {
            const created = await request(app)
                .post('/api/assistants')
                .send({ name: 'Original', salesUrl: 'https://original.com' });

            const id = created.body.assistant.id;

            const res = await request(app)
                .put(`/api/assistants/${id}`)
                .send({ name: 'Atualizado', salesUrl: 'https://updated.com' })
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.assistant.name).toBe('Atualizado');
            expect(res.body.assistant.salesUrl).toBe('https://updated.com');
        });

        test('deve retornar 404 para ID inexistente', async () => {
            const res = await request(app)
                .put('/api/assistants/asst_inexistente')
                .send({ name: 'Teste' })
                .expect(404);
            expect(res.body.success).toBe(false);
        });

        test('deve atualizar status para inactive', async () => {
            const created = await request(app)
                .post('/api/assistants')
                .send({ name: 'StatusBot', salesUrl: 'https://status.com' });

            const id = created.body.assistant.id;

            const res = await request(app)
                .put(`/api/assistants/${id}`)
                .send({ status: 'inactive' })
                .expect(200);

            expect(res.body.assistant.status).toBe('inactive');
        });
    });

    // --- DELETE ---
    describe('DELETE /api/assistants/:id', () => {
        test('deve remover um assistente existente', async () => {
            const created = await request(app)
                .post('/api/assistants')
                .send({ name: 'DeleteBot', salesUrl: 'https://delete.com' });

            const id = created.body.assistant.id;

            const res = await request(app)
                .delete(`/api/assistants/${id}`)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.removedId).toBe(id);

            // Verify it's gone
            const list = await request(app).get('/api/assistants').expect(200);
            expect(list.body.total).toBe(0);
        });

        test('deve retornar 404 para ID inexistente', async () => {
            const res = await request(app)
                .delete('/api/assistants/asst_inexistente')
                .expect(404);
            expect(res.body.success).toBe(false);
        });
    });

    // --- TENANT ISOLATION ---
    describe('Isolamento por Tenant', () => {
        test('tenants diferentes não compartilham assistentes', async () => {
            // Tenant 1 creates an assistant
            await request(app)
                .post('/api/assistants')
                .send({ name: 'Tenant1Bot', salesUrl: 'https://t1.com' })
                .expect(200);

            // Tenant 2 app
            const app2 = createTestApp('TEST-ASST-KEY-002');

            // Tenant 2 should see empty list
            const list2 = await request(app2).get('/api/assistants').expect(200);
            expect(list2.body.total).toBe(0);

            // Tenant 1 should still see its assistant
            const list1 = await request(app).get('/api/assistants').expect(200);
            expect(list1.body.total).toBe(1);
            expect(list1.body.assistants[0].name).toBe('Tenant1Bot');
        });
    });
});
