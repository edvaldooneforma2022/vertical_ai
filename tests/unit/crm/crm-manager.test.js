/**
 * 🧪 Testes Unitários — CRMManager
 * Verifica pipeline padrão, sync de leads, mudanças de estágio, temperatura e analytics
 */

// Mock do database
jest.mock('../../../database', () => {
    const mockRows = [];
    return {
        db: {
            query: jest.fn().mockImplementation((query, params) => {
                // Default: retorna resultado vazio
                return Promise.resolve({ rows: mockRows });
            })
        },
        USE_POSTGRES: true,
        __mockRows: mockRows
    };
});

const { CRMManager } = require('../../../lib/crm/crm-manager');
const { db } = require('../../../database');

describe('CRMManager', () => {
    let crm;

    beforeEach(() => {
        crm = new CRMManager();
        jest.clearAllMocks();
    });

    describe('ensureDefaultPipeline', () => {
        it('deve retornar pipeline existente se já existir', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 'pipeline-123' }] });

            const result = await crm.ensureDefaultPipeline('tenant-abc');

            expect(result).toBe('pipeline-123');
            expect(db.query).toHaveBeenCalledTimes(1);
            expect(db.query.mock.calls[0][1]).toContain('tenant-abc');
        });

        it('deve criar pipeline padrão com 6 estágios se não existir', async () => {
            db.query.mockResolvedValueOnce({ rows: [] }); // Nenhum pipeline existente
            // Inserir pipeline + 6 estágios = 7 queries
            for (let i = 0; i < 7; i++) {
                db.query.mockResolvedValueOnce({ rows: [{ id: `new-${i}` }] });
            }

            const result = await crm.ensureDefaultPipeline('tenant-new');

            expect(result).toBeTruthy();
            // 1 SELECT + 1 INSERT pipeline + 6 INSERT stages = 8 queries
            expect(db.query).toHaveBeenCalledTimes(8);
        });

        it('deve lançar erro quando o banco falha', async () => {
            db.query.mockRejectedValueOnce(new Error('DB connection failed'));

            await expect(crm.ensureDefaultPipeline('tenant-err'))
                .rejects.toThrow('DB connection failed');
        });
    });

    describe('syncLeadToCRM', () => {
        const leadData = {
            id: 'lead-orig-1',
            nome: 'João Silva',
            email: 'joao@test.com',
            telefone: '11999999999',
            url_origem: 'https://example.com'
        };

        it('deve atualizar lead existente sem duplicar', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 'crm-lead-exists' }] }); // check existing
            db.query.mockResolvedValueOnce({ rows: [] }); // update

            const result = await crm.syncLeadToCRM('tenant-abc', leadData);

            expect(result).toBe('crm-lead-exists');
            // 1 SELECT check + 1 UPDATE = 2
            expect(db.query).toHaveBeenCalledTimes(2);
        });

        it('deve criar novo lead no CRM se não existir', async () => {
            db.query.mockResolvedValueOnce({ rows: [] }); // não existe
            db.query.mockResolvedValueOnce({ rows: [{ id: 'pipeline-1' }] }); // ensureDefaultPipeline
            db.query.mockResolvedValueOnce({ rows: [{ id: 'stage-1' }] }); // primeiro estágio
            db.query.mockResolvedValueOnce({ rows: [] }); // INSERT lead
            db.query.mockResolvedValueOnce({ rows: [] }); // addActivity
            db.query.mockResolvedValueOnce({ rows: [] }); // _checkFollowUpTriggers

            const result = await crm.syncLeadToCRM('tenant-abc', leadData);

            expect(result).toBeTruthy();
            // Verificar que o INSERT contém os dados corretos
            const insertCall = db.query.mock.calls.find(call =>
                call[0].includes('INSERT INTO crm_leads')
            );
            expect(insertCall).toBeTruthy();
            expect(insertCall[1]).toContain('joao@test.com');
        });
    });

    describe('updateLeadTemperature', () => {
        it('deve aceitar temperaturas válidas (cold, warm, hot)', async () => {
            db.query.mockResolvedValue({ rows: [] });

            for (const temp of ['cold', 'warm', 'hot']) {
                await crm.updateLeadTemperature('tenant-1', 'lead-1', temp);
            }

            expect(db.query).toHaveBeenCalled();
        });

        it('deve rejeitar temperatura inválida', async () => {
            await expect(crm.updateLeadTemperature('tenant-1', 'lead-1', 'freezing'))
                .rejects.toThrow('Temperatura inválida');
        });
    });

    describe('addActivity', () => {
        it('deve registrar atividade com todos os campos', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const result = await crm.addActivity(
                'tenant-1', 'lead-1', 'stage_change',
                'Movido para Engajado', 'Novo Lead', 'Engajado'
            );

            expect(result).toBeTruthy();
            const call = db.query.mock.calls[0];
            expect(call[0]).toContain('INSERT INTO crm_activities');
            expect(call[1]).toContain('tenant-1');
            expect(call[1]).toContain('lead-1');
            expect(call[1]).toContain('stage_change');
        });

        it('não deve lançar erro mesmo quando o banco falha', async () => {
            db.query.mockRejectedValueOnce(new Error('DB error'));

            // addActivity não relança erros (é secundário)
            const result = await crm.addActivity('t', 'l', 'test', 'desc');
            expect(result).toBeUndefined();
        });
    });

    describe('getLeads', () => {
        it('deve buscar leads filtrados por temperatura', async () => {
            db.query.mockResolvedValueOnce({
                rows: [
                    { id: '1', name: 'Lead Hot', temperature: 'hot' }
                ]
            });

            const leads = await crm.getLeads('tenant-1', { temperature: 'hot' });

            expect(leads).toHaveLength(1);
            expect(leads[0].temperature).toBe('hot');
            const call = db.query.mock.calls[0];
            expect(call[1]).toContain('hot');
        });
    });
});
