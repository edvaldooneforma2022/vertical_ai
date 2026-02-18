/**
 * 🧪 Testes Unitários — FollowUpManager
 * Verifica regras, jobs pendentes, cancelamento por resposta e max_attempts
 */

// Mock do database
jest.mock('../../../database', () => ({
    db: {
        query: jest.fn().mockResolvedValue({ rows: [] })
    },
    USE_POSTGRES: true
}));

const { FollowUpManager } = require('../../../lib/crm/followup-manager');
const { db } = require('../../../database');

describe('FollowUpManager', () => {
    let fm;

    beforeEach(() => {
        fm = new FollowUpManager();
        jest.clearAllMocks();
    });

    describe('createRule', () => {
        it('deve criar regra com valores padrão', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const rule = await fm.createRule('tenant-1', {
                name: 'Follow-up 24h',
                trigger_type: 'new_lead',
                message_template: 'Olá {{name}}, tudo bem?'
            });

            expect(rule.name).toBe('Follow-up 24h');
            expect(rule.trigger_type).toBe('new_lead');
            expect(rule.id).toBeTruthy();

            const call = db.query.mock.calls[0];
            expect(call[0]).toContain('INSERT INTO followup_rules');
            // delay_minutes default = 1440, channel default = 'email', max_attempts default = 3
            expect(call[1]).toContain(1440);
            expect(call[1]).toContain('email');
            expect(call[1]).toContain(3);
        });

        it('deve aceitar delay customizado', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const rule = await fm.createRule('tenant-1', {
                name: 'Follow-up 1h',
                trigger_type: 'stage_change',
                trigger_stage_id: 'stage-123',
                delay_minutes: 60,
                channel: 'whatsapp',
                message_template: 'Oi',
                max_attempts: 5
            });

            const params = db.query.mock.calls[0][1];
            expect(params).toContain(60);
            expect(params).toContain('whatsapp');
            expect(params).toContain(5);
        });
    });

    describe('deleteRule', () => {
        it('deve cancelar jobs pendentes antes de remover regra', async () => {
            db.query.mockResolvedValue({ rows: [] });

            await fm.deleteRule('tenant-1', 'rule-123');

            expect(db.query).toHaveBeenCalledTimes(2);
            // Primeira query: cancelar jobs
            expect(db.query.mock.calls[0][0]).toContain('cancelled');
            expect(db.query.mock.calls[0][0]).toContain('followup_jobs');
            // Segunda query: deletar regra
            expect(db.query.mock.calls[1][0]).toContain('DELETE FROM followup_rules');
        });
    });

    describe('cancelJobsForLead', () => {
        it('deve cancelar todos os jobs pendentes do lead', async () => {
            db.query.mockResolvedValueOnce({ rowCount: 3, changes: 3 });

            const cancelled = await fm.cancelJobsForLead('lead-123');

            expect(cancelled).toBe(3);
            const call = db.query.mock.calls[0];
            expect(call[0]).toContain('cancelled');
            expect(call[0]).toContain('pending');
            expect(call[1]).toContain('lead-123');
        });

        it('deve retornar 0 quando não há jobs pendentes', async () => {
            db.query.mockResolvedValueOnce({ rowCount: 0, changes: 0 });

            const cancelled = await fm.cancelJobsForLead('lead-no-jobs');
            expect(cancelled).toBe(0);
        });
    });

    describe('failJob', () => {
        it('deve manter status pending se tentativas < max', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ attempts: 0 }] }); // check attempts
            db.query.mockResolvedValueOnce({ rows: [] }); // update
            db.query.mockResolvedValueOnce({ rows: [] }); // insert log

            await fm.failJob('job-1', 'Timeout', 3);

            const updateCall = db.query.mock.calls[1];
            expect(updateCall[1][0]).toBe('pending'); // status = pending (retry)
            expect(updateCall[1][1]).toBe(1); // attempts = 1
        });

        it('deve marcar como failed se tentativas >= max', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ attempts: 2 }] }); // já com 2 tentativas
            db.query.mockResolvedValueOnce({ rows: [] }); // update
            db.query.mockResolvedValueOnce({ rows: [] }); // insert log

            await fm.failJob('job-1', 'Timeout', 3);

            const updateCall = db.query.mock.calls[1];
            expect(updateCall[1][0]).toBe('failed'); // status = failed (max reached)
            expect(updateCall[1][1]).toBe(3); // attempts = 3
        });
    });

    describe('getPendingJobs', () => {
        it('deve usar FOR UPDATE SKIP LOCKED no PostgreSQL', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ id: 'job-1', lead_name: 'João', lead_email: 'joao@test.com' }]
            });

            const jobs = await fm.getPendingJobs(10);

            expect(jobs).toHaveLength(1);
            const call = db.query.mock.calls[0];
            expect(call[0]).toContain('FOR UPDATE');
            expect(call[0]).toContain('SKIP LOCKED');
        });
    });

    describe('updateLeadResponse', () => {
        it('deve cancelar jobs pendentes quando lead responde', async () => {
            db.query.mockResolvedValueOnce({ rows: [] }); // update last_response_at
            db.query.mockResolvedValueOnce({ rows: [{ id: 'lead-123' }] }); // find lead
            db.query.mockResolvedValueOnce({ rowCount: 2 }); // cancel jobs

            await fm.updateLeadResponse('tenant-1', 'joao@test.com');

            expect(db.query).toHaveBeenCalledTimes(3);
        });

        it('não deve lançar erro mesmo quando falha', async () => {
            db.query.mockRejectedValueOnce(new Error('DB error'));

            // Não deve lançar
            await expect(fm.updateLeadResponse('t', 'e@e.com')).resolves.not.toThrow();
        });
    });
});
