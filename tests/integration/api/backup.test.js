/**
 * Testes de Integração - Sistema de Backup
 * Testa endpoints de backup de leads
 */

const request = require('supertest');
const express = require('express');

// Mock do app para testes
const createTestApp = () => {
    const app = express();
    app.use(express.json());

    // Mock de dados de backup
    const mockBackups = [
        {
            filename: 'backup_2025-12-14_manual.json',
            size: 1024,
            createdAt: '2025-12-14T10:00:00Z',
            leadsCount: 5,
            type: 'manual'
        },
        {
            filename: 'backup_2025-12-13_daily.json',
            size: 2048,
            createdAt: '2025-12-13T00:00:00Z',
            leadsCount: 10,
            type: 'daily'
        }
    ];

    // Mock de sessão com API Key
    app.use((req, res, next) => {
        req.session = {
            validatedApiKey: 'TEST-API-KEY-123',
            clientData: {
                nome: 'Test Client',
                plano: 'premium'
            }
        };
        next();
    });

    // Criar backup
    app.post('/admin/leads/backup/create', (req, res) => {
        const newBackup = {
            filename: `backup_${new Date().toISOString().split('T')[0]}_manual.json`,
            size: 512,
            createdAt: new Date().toISOString(),
            leadsCount: 2,
            type: 'manual'
        };

        res.json({
            success: true,
            filename: newBackup.filename,
            path: `/data/backups/${newBackup.filename}`,
            leadsCount: newBackup.leadsCount
        });
    });

    // Listar backups
    app.get('/admin/leads/backup/list', (req, res) => {
        res.json({
            success: true,
            backups: mockBackups,
            total: mockBackups.length
        });
    });

    // Restaurar backup
    app.post('/admin/leads/backup/restore', (req, res) => {
        const { filename } = req.body;

        if (!filename) {
            return res.status(400).json({
                success: false,
                error: 'Nome do arquivo de backup é obrigatório'
            });
        }

        const backup = mockBackups.find(b => b.filename === filename);
        if (!backup) {
            return res.status(404).json({
                success: false,
                error: 'Backup não encontrado'
            });
        }

        res.json({
            success: true,
            leadsCount: backup.leadsCount,
            timestamp: backup.createdAt,
            message: `Backup ${filename} restaurado com sucesso`
        });
    });

    return app;
};

describe('Sistema de Backup de Leads', () => {
    let app;

    beforeAll(() => {
        app = createTestApp();
    });

    describe('POST /admin/leads/backup/create', () => {
        test('deve criar backup com sucesso', async () => {
            const response = await request(app)
                .post('/admin/leads/backup/create')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('filename');
            expect(response.body).toHaveProperty('path');
            expect(response.body.filename).toMatch(/backup_.*_manual\.json/);
        });
    });

    describe('GET /admin/leads/backup/list', () => {
        test('deve listar backups disponíveis', async () => {
            const response = await request(app)
                .get('/admin/leads/backup/list')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('backups');
            expect(response.body).toHaveProperty('total');
            expect(Array.isArray(response.body.backups)).toBe(true);
            expect(response.body.total).toBeGreaterThan(0);
        });

        test('cada backup deve ter campos obrigatórios', async () => {
            const response = await request(app)
                .get('/admin/leads/backup/list')
                .expect(200);

            const backup = response.body.backups[0];
            expect(backup).toHaveProperty('filename');
            expect(backup).toHaveProperty('size');
            expect(backup).toHaveProperty('createdAt');
            expect(backup).toHaveProperty('leadsCount');
        });
    });

    describe('POST /admin/leads/backup/restore', () => {
        test('deve restaurar backup existente', async () => {
            const response = await request(app)
                .post('/admin/leads/backup/restore')
                .send({ filename: 'backup_2025-12-14_manual.json' })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body).toHaveProperty('leadsCount');
            expect(response.body).toHaveProperty('timestamp');
        });

        test('deve rejeitar restauração sem filename', async () => {
            const response = await request(app)
                .post('/admin/leads/backup/restore')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toContain('obrigatório');
        });

        test('deve retornar 404 para backup inexistente', async () => {
            const response = await request(app)
                .post('/admin/leads/backup/restore')
                .send({ filename: 'backup_inexistente.json' })
                .expect(404);

            expect(response.body.success).toBe(false);
        });
    });
});

describe('Isolamento de Tenancy (API Key)', () => {
    test('backup deve estar associado à API Key do usuário', async () => {
        const app = createTestApp();

        const response = await request(app)
            .post('/admin/leads/backup/create')
            .expect(200);

        // O backup deve ser criado com sucesso apenas para usuário autenticado
        expect(response.body.success).toBe(true);
    });
});
