/**
 * FASE 2B — Testes de Idempotência, Isolamento e Integridade do Agendamento
 *
 * Testa as funções implementadas na Fase 2B sem dependência de banco real.
 * Usa mocks para PostgreSQL pool/client e dependências injetadas.
 * Importa o rate limiter REAL diretamente de lib/booking-rate-limiter.
 *
 * Seções:
 *   1. Rate Limiter (importado real de lib/booking-rate-limiter, fail-closed, limpeza, limite)
 *   2. _executeBookingDirect (CAS, idempotência, recuperação)
 *   3. _saveScheduleOfferStrict (transação, tenant isolation)
 *   4. _updateScheduleState (tenant filter, boolean return)
 *   5. _getSchedulePending (tenant filter, guards)
 *   6. _handleScheduleResponse (fluxo completo com tenantId e contexto)
 *   7. _syncAppointmentToMemory (deduplicação, rotação, isolamento estrito entre tenants A e B)
 *   8. _reconcileStaleBookings (complete vs revert)
 *   9. Fail-Closed da infraestrutura de agendamento
 *   10. Migrations (validações estruturais nos catálogos pg_constraint, pg_index e detecção de duplicidades)
 */

'use strict';

// ═══════════════════════════════════════════════════════════
// 1. RATE LIMITER — MÓDULO REAL (lib/booking-rate-limiter.js)
// ═══════════════════════════════════════════════════════════

const {
    checkBookingRateLimit,
    cleanupBookingRateLimitMap,
    resetBookingRateLimitMap,
    getBookingRateLimitMap,
    RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX_REQUESTS,
    RATE_LIMIT_MAX_ENTRIES
} = require('../../lib/booking-rate-limiter');

describe('Rate Limiter Real (Fase 2B)', () => {
    beforeEach(() => {
        resetBookingRateLimitMap();
    });

    test('permite até 5 requisições por hash por janela', () => {
        for (let i = 0; i < 5; i++) {
            expect(checkBookingRateLimit('hash1')).toBe(true);
        }
        expect(checkBookingRateLimit('hash1')).toBe(false);
    });

    test('hashes diferentes são independentes', () => {
        for (let i = 0; i < 5; i++) {
            checkBookingRateLimit('hash1');
        }
        expect(checkBookingRateLimit('hash2')).toBe(true);
    });

    test('fail-closed quando 1000 hashes ativos', () => {
        const map = getBookingRateLimitMap();
        for (let i = 0; i < 1000; i++) {
            map.set(`hash_${i}`, { timestamps: [Date.now()] });
        }
        expect(map.size).toBe(1000);

        // Nova requisição para hash não existente deve ser bloqueada (FAIL-CLOSED)
        const allowed = checkBookingRateLimit('novo_hash');
        expect(allowed).toBe(false);
    });

    test('limpa entradas expiradas e libera espaço', () => {
        const map = getBookingRateLimitMap();
        const oldTimestamp = Date.now() - 70000; // 70s atrás (expirado)
        for (let i = 0; i < 1000; i++) {
            map.set(`hash_${i}`, { timestamps: [oldTimestamp] });
        }

        // Nova requisição deve disparar limpeza e ser permitida
        const allowed = checkBookingRateLimit('novo_hash');
        expect(allowed).toBe(true);
        expect(map.size).toBe(1); // 1000 expiradas removidas + 1 nova
    });
});

// ═══════════════════════════════════════════════════════════
// 2. _executeBookingDirect (CAS, idempotência, recuperação)
// ═══════════════════════════════════════════════════════════

describe('_executeBookingDirect (Fase 2B)', () => {
    let channel;
    let mockClient;
    const defaultPending = {
        id: 1,
        api_key: 'test-api-key',
        selected_date: '2026-12-01',
        selected_time: '10:00'
    };
    const defaultLead = { id: 'lead-123', nome: 'João', wa_phone: '5511999999999' };
    const defaultTenantId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

    beforeEach(() => {
        const { WhatsAppChannel } = require('../../whatsapp-channel');
        channel = Object.create(WhatsAppChannel.prototype);
        channel.USE_POSTGRES = true;
        mockClient = {
            query: jest.fn(async () => ({ rows: [], rowCount: 0 })),
            release: jest.fn()
        };
        channel.db = {
            pool: {
                connect: jest.fn(async () => mockClient)
            }
        };
        channel.deps = {
            isSchedulingInfrastructureReady: () => true
        };
    });

    test('retorna no_postgres quando USE_POSTGRES é false', async () => {
        channel.USE_POSTGRES = false;
        const result = await channel._executeBookingDirect(defaultPending, defaultLead, defaultTenantId);
        expect(result).toEqual({ success: false, reason: 'no_postgres' });
    });

    test('retorna no_tenant quando tenantId é nulo', async () => {
        const result = await channel._executeBookingDirect(defaultPending, defaultLead, null);
        expect(result).toEqual({ success: false, reason: 'no_tenant' });
    });

    test('caminho feliz — CAS, INSERT, UPDATE e COMMIT bem-sucedidos', async () => {
        mockClient.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({ rowCount: 1 }) // CAS (UPDATE pending)
            .mockResolvedValueOnce({ rows: [{ id: 'apt-001' }] }) // INSERT
            .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE completed
            .mockResolvedValueOnce({}); // COMMIT

        const result = await channel._executeBookingDirect(defaultPending, defaultLead, defaultTenantId);

        expect(result.success).toBe(true);
        expect(result.appointmentId).toBe('apt-001');
        expect(result.wasDuplicate).toBe(false);
        expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    test('conflito de UNIQUE — recupera appointment existente', async () => {
        mockClient.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({ rowCount: 1 }) // CAS
            .mockResolvedValueOnce({ rows: [] }) // INSERT conflitou (0 rows)
            .mockResolvedValueOnce({ rows: [{ id: 'apt-existing' }] }) // SELECT recovery
            .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE completed
            .mockResolvedValueOnce({}); // COMMIT

        const result = await channel._executeBookingDirect(defaultPending, defaultLead, defaultTenantId);

        expect(result.success).toBe(true);
        expect(result.appointmentId).toBe('apt-existing');
        expect(result.wasDuplicate).toBe(true);
    });

    test('CAS falha e pending já completed — recuperação idempotente', async () => {
        mockClient.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({ rowCount: 0 }) // CAS falhou
            .mockResolvedValueOnce({}) // ROLLBACK
            .mockResolvedValueOnce({ rows: [{ state: 'completed' }] }) // SELECT state
            .mockResolvedValueOnce({ rows: [{ id: 'apt-recovered' }] }); // SELECT appointment

        const result = await channel._executeBookingDirect(defaultPending, defaultLead, defaultTenantId);

        expect(result.success).toBe(true);
        expect(result.appointmentId).toBe('apt-recovered');
        expect(result.wasDuplicate).toBe(true);
    });

    test('libera conexão exclusivamente no finally mesmo em erro', async () => {
        mockClient.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockRejectedValueOnce(new Error('Connection lost')); // CAS explodiu

        const result = await channel._executeBookingDirect(defaultPending, defaultLead, defaultTenantId);

        expect(result.success).toBe(false);
        expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
});

// ═══════════════════════════════════════════════════════════
// 3. _saveScheduleOfferStrict
// ═══════════════════════════════════════════════════════════

describe('_saveScheduleOfferStrict (Fase 2B)', () => {
    let channel;
    let mockClient;
    const defaultTenantId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

    beforeEach(() => {
        const { WhatsAppChannel } = require('../../whatsapp-channel');
        channel = Object.create(WhatsAppChannel.prototype);
        channel.USE_POSTGRES = true;
        mockClient = {
            query: jest.fn(async () => ({ rows: [], rowCount: 0 })),
            release: jest.fn()
        };
        channel.db = {
            pool: { connect: jest.fn(async () => mockClient) }
        };
        channel.deps = {
            isSchedulingInfrastructureReady: () => true
        };
    });

    test('retorna false se USE_POSTGRES é false', async () => {
        channel.USE_POSTGRES = false;
        const result = await channel._saveScheduleOfferStrict('c1', 'k1', 'h1', [], null, defaultTenantId);
        expect(result).toBe(false);
    });

    test('retorna false se tenantId é nulo', async () => {
        const result = await channel._saveScheduleOfferStrict('c1', 'k1', 'h1', [], null, null);
        expect(result).toBe(false);
    });

    test('transação completa — cancela anteriores e insere novo', async () => {
        mockClient.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE anteriores cancelados
            .mockResolvedValueOnce({ rows: [{ id: 42 }] }) // INSERT novo
            .mockResolvedValueOnce({}); // COMMIT

        const slots = [{ date: '2026-12-01', time: '10:00' }];
        const result = await channel._saveScheduleOfferStrict('c1', 'k1', 'h1', slots, 'lead-1', defaultTenantId);

        expect(result).toBe(true);
        expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    test('em caso de erro faz rollback e libera conexão', async () => {
        mockClient.query
            .mockResolvedValueOnce({}) // BEGIN
            .mockRejectedValueOnce(new Error('Deadlock'));

        const result = await channel._saveScheduleOfferStrict('c1', 'k1', 'h1', [], null, defaultTenantId);

        expect(result).toBe(false);
        expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
});

// ═══════════════════════════════════════════════════════════
// 4. _updateScheduleState
// ═══════════════════════════════════════════════════════════

describe('_updateScheduleState (Fase 2B)', () => {
    let channel;
    const defaultTenantId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

    beforeEach(() => {
        const { WhatsAppChannel } = require('../../whatsapp-channel');
        channel = Object.create(WhatsAppChannel.prototype);
        channel.USE_POSTGRES = true;
        channel.db = { query: jest.fn() };
        channel.deps = { isSchedulingInfrastructureReady: () => true };
    });

    test('retorna false se tenantId é nulo', async () => {
        const result = await channel._updateScheduleState(1, 'selected', '2026-12-01', '10:00', null);
        expect(result).toBe(false);
        expect(channel.db.query).not.toHaveBeenCalled();
    });

    test('inclui tenant_id no WHERE e retorna true com rowCount 1', async () => {
        channel.db.query.mockResolvedValueOnce({ rowCount: 1 });
        const result = await channel._updateScheduleState(1, 'selected', '2026-12-01', '10:00', defaultTenantId);

        expect(result).toBe(true);
        const queryCall = channel.db.query.mock.calls[0];
        expect(queryCall[0]).toContain('AND tenant_id = $5');
        expect(queryCall[1]).toContain(defaultTenantId);
    });

    test('retorna false quando rowCount é 0 (tenant não é dono)', async () => {
        channel.db.query.mockResolvedValueOnce({ rowCount: 0 });
        const result = await channel._updateScheduleState(1, 'cancelled', null, null, 'outro-tenant');
        expect(result).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════
// 5. _getSchedulePending
// ═══════════════════════════════════════════════════════════

describe('_getSchedulePending (Fase 2B)', () => {
    let channel;
    const defaultTenantId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

    beforeEach(() => {
        const { WhatsAppChannel } = require('../../whatsapp-channel');
        channel = Object.create(WhatsAppChannel.prototype);
        channel.USE_POSTGRES = true;
        channel.db = { query: jest.fn() };
        channel.deps = { isSchedulingInfrastructureReady: () => true };
    });

    test('retorna null se tenantId é nulo', async () => {
        const result = await channel._getSchedulePending('conv-1', null);
        expect(result).toBeNull();
        expect(channel.db.query).not.toHaveBeenCalled();
    });

    test('filtra por tenant_id na query', async () => {
        channel.db.query.mockResolvedValueOnce({ rows: [{ id: 1, state: 'offered' }] });
        const result = await channel._getSchedulePending('conv-1', defaultTenantId);

        expect(result).toEqual({ id: 1, state: 'offered' });
        const queryCall = channel.db.query.mock.calls[0];
        expect(queryCall[0]).toContain('AND tenant_id = $2');
        expect(queryCall[1]).toEqual(['conv-1', defaultTenantId]);
    });

    test('retorna null se USE_POSTGRES é false', async () => {
        channel.USE_POSTGRES = false;
        const result = await channel._getSchedulePending('conv-1', defaultTenantId);
        expect(result).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════
// 6. _handleScheduleResponse
// ═══════════════════════════════════════════════════════════

describe('_handleScheduleResponse (Fase 2B)', () => {
    let channel;
    const defaultTenantId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

    beforeEach(() => {
        const { WhatsAppChannel } = require('../../whatsapp-channel');
        channel = Object.create(WhatsAppChannel.prototype);
        channel.USE_POSTGRES = true;
        channel.deps = {
            getLeadSystem: jest.fn(() => ({ appointments: [] })),
            isSchedulingInfrastructureReady: () => true
        };
        channel._getSchedulePending = jest.fn();
        channel._updateScheduleState = jest.fn(async () => true);
        channel._executeBookingDirect = jest.fn();
        channel._syncAppointmentToMemory = jest.fn();
    });

    test('retorna null se tenantId é ausente', async () => {
        const result = await channel._handleScheduleResponse('conv-1', 'sim', 'k1', {}, null);
        expect(result).toBeNull();
    });

    test('seleção de slot numérico avança state para selected', async () => {
        channel._getSchedulePending.mockResolvedValueOnce({
            id: 1,
            state: 'offered',
            slots_json: JSON.stringify([{ date: '2026-12-01', time: '10:00', dayName: 'Segunda-feira' }])
        });

        const reply = await channel._handleScheduleResponse('conv-1', '1', 'k1', {}, defaultTenantId);

        expect(channel._updateScheduleState).toHaveBeenCalledWith(1, 'selected', '2026-12-01', '10:00', defaultTenantId);
        expect(reply).toContain('Confirme seu agendamento');
    });

    test('confirmação SIM executa booking direto e sincroniza memória com contexto', async () => {
        channel._getSchedulePending.mockResolvedValueOnce({
            id: 1,
            state: 'selected',
            selected_date: '2026-12-01',
            selected_time: '10:00'
        });
        channel._executeBookingDirect.mockResolvedValueOnce({
            success: true,
            appointmentId: 'apt-001',
            wasDuplicate: false
        });

        const reply = await channel._handleScheduleResponse('conv-1', 'sim', 'k1', {}, defaultTenantId);

        expect(channel._executeBookingDirect).toHaveBeenCalled();
        expect(channel._syncAppointmentToMemory).toHaveBeenCalledWith(
            expect.anything(),
            expect.anything(),
            'apt-001',
            { apiKey: 'k1', tenantId: defaultTenantId }
        );
        expect(reply).toContain('Agendamento confirmado!');
    });

    test('resposta NÃO cancela agendamento', async () => {
        channel._getSchedulePending.mockResolvedValueOnce({ id: 1, state: 'selected' });

        const reply = await channel._handleScheduleResponse('conv-1', 'não', 'k1', {}, defaultTenantId);

        expect(channel._updateScheduleState).toHaveBeenCalledWith(1, 'cancelled', null, null, defaultTenantId);
        expect(reply).toContain('cancelado');
    });

    test('mensagem não relacionada retorna null (pass-through)', async () => {
        channel._getSchedulePending.mockResolvedValueOnce({ id: 1, state: 'offered', slots_json: '[]' });

        const reply = await channel._handleScheduleResponse('conv-1', 'olá, tudo bem?', 'k1', {}, defaultTenantId);
        expect(reply).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════
// 7. _syncAppointmentToMemory (Isolamento entre Tenants)
// ═══════════════════════════════════════════════════════════

describe('_syncAppointmentToMemory (Fase 2B)', () => {
    let channel;
    let leadSystemMock;

    beforeEach(() => {
        const { WhatsAppChannel } = require('../../whatsapp-channel');
        channel = Object.create(WhatsAppChannel.prototype);
        leadSystemMock = { appointments: [] };
        channel.deps = {
            getLeadSystem: jest.fn(() => leadSystemMock),
            getApiKeyManager: jest.fn(() => ({
                validateKey: jest.fn(async (key) => {
                    if (key === 'keyA') return { valid: true, tenantId: 'tenantA' };
                    if (key === 'keyB') return { valid: true, tenantId: 'tenantB' };
                    return { valid: false };
                })
            }))
        };
    });

    test('adiciona appointment ao array', async () => {
        const pending = { api_key: 'keyA', selected_date: '2026-12-01', selected_time: '10:00' };
        await channel._syncAppointmentToMemory(pending, { id: 'lead1' }, 'apt-001', { apiKey: 'keyA', tenantId: 'tenantA' });

        expect(leadSystemMock.appointments).toHaveLength(1);
        expect(leadSystemMock.appointments[0].id).toBe('apt-001');
    });

    test('deduplicação — não insere duplicata', async () => {
        leadSystemMock.appointments = [{ id: 'apt-001' }];
        const pending = { api_key: 'keyA', selected_date: '2026-12-01', selected_time: '10:00' };
        await channel._syncAppointmentToMemory(pending, {}, 'apt-001', { apiKey: 'keyA', tenantId: 'tenantA' });

        expect(leadSystemMock.appointments).toHaveLength(1);
    });

    test('ISOLAMENTO CONCORRENTE: appointment de tenant A NUNCA entra no singleton de tenant B', async () => {
        const singletonA = { appointments: [], tenantUuid: 'tenantA' };
        const singletonB = { appointments: [], tenantUuid: 'tenantB' };

        channel.deps.getLeadSystem = jest.fn(key => {
            if (key === 'keyA') return singletonA;
            if (key === 'keyB') return singletonB;
            return null;
        });

        // Simula pending do Tenant A, mas uma requisição de Tenant B está ocorrendo
        const pendingA = { api_key: 'keyA', selected_date: '2026-12-01', selected_time: '10:00' };

        // Chamada explícita de sync para Tenant A com contexto seguro de Tenant A
        await channel._syncAppointmentToMemory(pendingA, {}, 'apt-tenantA-001', { apiKey: 'keyA', tenantId: 'tenantA' });

        // Tentar injetar appointment de Tenant A no contexto de Tenant B (cross-tenant mismatch)
        const pendingCross = { api_key: 'keyB', selected_date: '2026-12-01', selected_time: '10:00' };
        await channel._syncAppointmentToMemory(pendingCross, {}, 'apt-fake-cross', { apiKey: 'keyB', tenantId: 'tenantA' });

        // Singleton A tem apenas seu próprio appointment
        expect(singletonA.appointments).toHaveLength(1);
        expect(singletonA.appointments[0].id).toBe('apt-tenantA-001');

        // Singleton B NÃO tem NENHUM appointment (bloqueado pelo check de tenant_uuid)
        expect(singletonB.appointments).toHaveLength(0);
    });

    test('CONCORRÊNCIA Promise.all: duas operações simultâneas com tenants A e B mantêm isolamento', async () => {
        /**
         * LIMITAÇÃO: Este teste usa mocks — não há banco PostgreSQL real.
         * Ele comprova que duas invocações concorrentes de _handleScheduleResponse
         * (via Promise.all) NÃO trocam contexto entre tenants, pois cada closure
         * de _processIncomingMessage captura seu próprio tenantId.
         *
         * A concorrência real de banco requer TEST_DATABASE_URL (testes de integração).
         */
        const { WhatsAppChannel } = require('../../whatsapp-channel');

        const singletonA = { appointments: [], tenantUuid: 'tenantA' };
        const singletonB = { appointments: [], tenantUuid: 'tenantB' };

        const channel = Object.create(WhatsAppChannel.prototype);
        channel.USE_POSTGRES = true;
        channel.db = { query: jest.fn(async () => ({ rows: [], rowCount: 0 })) };
        channel.deps = {
            getLeadSystem: jest.fn(key => {
                if (key === 'keyA') return singletonA;
                if (key === 'keyB') return singletonB;
                return null;
            }),
            getApiKeyManager: jest.fn(() => ({
                validateKey: jest.fn(async (key) => {
                    // Simular latência assíncrona variável para provocar intercalação
                    await new Promise(r => setTimeout(r, Math.random() * 10));
                    if (key === 'keyA') return { valid: true, tenantId: 'tenantA' };
                    if (key === 'keyB') return { valid: true, tenantId: 'tenantB' };
                    return { valid: false };
                })
            })),
            isSchedulingInfrastructureReady: () => true
        };

        // Preparar _handleScheduleResponse para booking direto
        // Mock _getSchedulePending: cada tenant tem seu pending
        channel._getSchedulePending = jest.fn(async (convId, tenantId) => {
            if (tenantId === 'tenantA') return {
                id: 100, state: 'selected', api_key: 'keyA',
                selected_date: '2026-12-01', selected_time: '10:00', tenant_id: 'tenantA'
            };
            if (tenantId === 'tenantB') return {
                id: 200, state: 'selected', api_key: 'keyB',
                selected_date: '2026-12-02', selected_time: '14:00', tenant_id: 'tenantB'
            };
            return null;
        });

        channel._executeBookingDirect = jest.fn(async (pending, lead, tenantId) => {
            // Simular latência para intercalação
            await new Promise(r => setTimeout(r, Math.random() * 10));
            return {
                success: true,
                appointmentId: `apt-${tenantId}-${pending.id}`,
                wasDuplicate: false
            };
        });

        // _syncAppointmentToMemory é o código REAL (não mock)
        // para exercitar a validação de tenant em concorrência
        // (já está no prototype)

        // Executar as duas operações concorrentemente
        const [replyA, replyB] = await Promise.all([
            channel._handleScheduleResponse('conv-A', 'sim', 'keyA', { id: 'leadA' }, 'tenantA'),
            channel._handleScheduleResponse('conv-B', 'sim', 'keyB', { id: 'leadB' }, 'tenantB')
        ]);

        // Ambos devem ter sucesso
        expect(replyA).toContain('Agendamento confirmado!');
        expect(replyB).toContain('Agendamento confirmado!');

        // Aguardar as promises fire-and-forget de _syncAppointmentToMemory
        await new Promise(r => setTimeout(r, 100));

        // VERIFICAÇÃO CRÍTICA: isolamento de tenants
        // Singleton A deve ter APENAS appointments de tenant A
        const aptsA = singletonA.appointments;
        const aptsB = singletonB.appointments;

        expect(aptsA.every(a => a.id.includes('tenantA'))).toBe(true);
        expect(aptsB.every(a => a.id.includes('tenantB'))).toBe(true);

        // Nenhum appointment de A em B, e vice-versa
        expect(aptsA.some(a => a.id.includes('tenantB'))).toBe(false);
        expect(aptsB.some(a => a.id.includes('tenantA'))).toBe(false);

        // Cada um chamou _executeBookingDirect com o tenantId correto
        const bookCalls = channel._executeBookingDirect.mock.calls;
        expect(bookCalls).toHaveLength(2);
        const tenantIds = bookCalls.map(c => c[2]).sort();
        expect(tenantIds).toEqual(['tenantA', 'tenantB']);

        // _getSchedulePending foi chamado com tenantId isolado
        const pendingCalls = channel._getSchedulePending.mock.calls;
        expect(pendingCalls).toHaveLength(2);
        const pendingTenants = pendingCalls.map(c => c[1]).sort();
        expect(pendingTenants).toEqual(['tenantA', 'tenantB']);
    });
});

// ═══════════════════════════════════════════════════════════
// 8. _reconcileStaleBookings
// ═══════════════════════════════════════════════════════════

describe('_reconcileStaleBookings (Fase 2B)', () => {
    let channel;

    beforeEach(() => {
        const { WhatsAppChannel } = require('../../whatsapp-channel');
        channel = Object.create(WhatsAppChannel.prototype);
        channel.USE_POSTGRES = true;
        channel.db = {
            query: jest.fn(async () => ({ rows: [], rowCount: 0 }))
        };
    });

    test('noop se USE_POSTGRES é false', async () => {
        channel.USE_POSTGRES = false;
        await channel._reconcileStaleBookings();
        expect(channel.db.query).not.toHaveBeenCalled();
    });

    test('noop se não há stale bookings', async () => {
        channel.db.query.mockResolvedValueOnce({ rows: [] });
        await channel._reconcileStaleBookings();
        expect(channel.db.query).toHaveBeenCalledTimes(1);
    });

    test('completa pending se appointment existe', async () => {
        channel.db.query
            .mockResolvedValueOnce({ rows: [{ id: 42, tenant_id: 'tenant-1' }] }) // stale
            .mockResolvedValueOnce({ rows: [{ id: 'apt-001' }] }) // appointment exists
            .mockResolvedValueOnce({ rowCount: 1 }); // UPDATE completed

        await channel._reconcileStaleBookings();

        const thirdCall = channel.db.query.mock.calls[2];
        expect(thirdCall[0]).toContain("state = 'completed'");
        expect(thirdCall[1]).toContain(42);
    });

    test('reverte para selected se appointment não existe', async () => {
        channel.db.query
            .mockResolvedValueOnce({ rows: [{ id: 42, tenant_id: 'tenant-1' }] }) // stale
            .mockResolvedValueOnce({ rows: [] }) // no appointment
            .mockResolvedValueOnce({ rowCount: 1 }); // UPDATE selected

        await channel._reconcileStaleBookings();

        const thirdCall = channel.db.query.mock.calls[2];
        expect(thirdCall[0]).toContain("state = 'selected'");
    });
});

// ═══════════════════════════════════════════════════════════
// 9. FAIL-CLOSED DA INFRAESTRUTURA DE AGENDAMENTO
// ═══════════════════════════════════════════════════════════

describe('Fail-Closed da Infraestrutura de Agendamento (Fase 2B)', () => {
    let channel;

    beforeEach(() => {
        const { WhatsAppChannel } = require('../../whatsapp-channel');
        channel = Object.create(WhatsAppChannel.prototype);
        channel.USE_POSTGRES = true;
        channel.deps = {
            isSchedulingInfrastructureReady: jest.fn(() => false) // INFRAESTRUTURA INDISPONÍVEL
        };
    });

    test('_handleScheduleResponse bloqueia com mensagem amigável quando infra falha', async () => {
        const response = await channel._handleScheduleResponse('conv-1', 'sim', 'key1', {}, 'tenant-1');
        expect(response).toContain('temporariamente indisponível para manutenção de segurança');
    });

    test('_executeBookingDirect retorna scheduling_infrastructure_unavailable', async () => {
        const result = await channel._executeBookingDirect({ id: 1 }, {}, 'tenant-1');
        expect(result).toEqual({ success: false, reason: 'scheduling_infrastructure_unavailable' });
    });

    test('_saveScheduleOfferStrict retorna false imediatamente', async () => {
        const result = await channel._saveScheduleOfferStrict('conv-1', 'key1', 'hash1', [], null, 'tenant-1');
        expect(result).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════
// 10. Migrations (verificação estática nos catálogos e queries)
// ═══════════════════════════════════════════════════════════

describe('Migrations Fase 2B (verificação estática)', () => {
    const fs = require('fs');
    const path = require('path');
    const databaseContent = fs.readFileSync(path.resolve(__dirname, '../../database.js'), 'utf8');

    test('Migration 2B-1A: ADD COLUMN tenant_id em wa_schedule_pending', () => {
        expect(databaseContent).toContain('ALTER TABLE wa_schedule_pending ADD COLUMN IF NOT EXISTS tenant_id');
    });

    test('Migration 2B-1B: FK nomeada fk_wa_schedule_pending_tenant e catálogo pg_constraint', () => {
        expect(databaseContent).toContain("fk_wa_schedule_pending_tenant");
        expect(databaseContent).toContain('FOREIGN KEY (tenant_id) REFERENCES tenants(id)');
        expect(databaseContent).toContain('FROM pg_constraint c');
        expect(databaseContent).toContain("ns_local.nspname = current_schema()");
        expect(databaseContent).toContain("v_constraint.contype != 'f'");
        expect(databaseContent).toContain("RAISE EXCEPTION 'Constraint homônima incompatível");
    });

    test('Migration 2B-1C: Índice composto idx_wa_sched_tenant_conv_state', () => {
        expect(databaseContent).toContain('idx_wa_sched_tenant_conv_state');
        expect(databaseContent).toContain('(tenant_id, conversation_id, state, created_at DESC)');
    });

    test('Migration 2B-2A: ADD COLUMN schedule_ref_id em tenant_appointments', () => {
        expect(databaseContent).toContain('ALTER TABLE tenant_appointments ADD COLUMN IF NOT EXISTS schedule_ref_id VARCHAR(255)');
    });

    test('Migration 2B-2B: Detecção de duplicidades antes de criar o índice', () => {
        expect(databaseContent).toContain('SELECT COUNT(*), string_agg(schedule_ref_id');
        expect(databaseContent).toContain('GROUP BY schedule_ref_id');
        expect(databaseContent).toContain('HAVING COUNT(*) > 1');
        expect(databaseContent).toContain("RAISE EXCEPTION 'Detecção de duplicidades em schedule_ref_id impediu criação de índice único");
    });

    test('Migration 2B-2B: Unique partial index validado no catálogo pg_index', () => {
        expect(databaseContent).toContain('idx_appointments_idempotency');
        expect(databaseContent).toContain('FROM pg_index i');
        expect(databaseContent).toContain('i.indisunique AS is_unique');
        expect(databaseContent).toContain("WHERE schedule_ref_id IS NOT NULL");
        expect(databaseContent).toContain("RAISE EXCEPTION 'Índice homônimo incompatível encontrado");
    });

    test('Migration 2B-3: Backfill tenant_uuid com guard de NOT NULL', () => {
        expect(databaseContent).toContain('SET tenant_uuid = ak.tenant_id');
        expect(databaseContent).toContain('ta.tenant_uuid IS NULL');
        expect(databaseContent).toContain('ak.tenant_id IS NOT NULL');
    });

    test('saveAppointment inclui schedule_ref_id e tenant_uuid', () => {
        expect(databaseContent).toContain('schedule_ref_id, tenant_uuid');
        expect(databaseContent).toContain('COALESCE($8, tenant_appointments.schedule_ref_id)');
        expect(databaseContent).toContain('COALESCE($9, tenant_appointments.tenant_uuid)');
    });

    test('getAppointmentsByTenant existe e filtra por tenant_uuid', () => {
        expect(databaseContent).toContain('async getAppointmentsByTenant');
        expect(databaseContent).toContain('WHERE tenant_uuid = $1');
    });

    test('Fail-Closed state e helpers exportados em database.js', () => {
        expect(databaseContent).toContain('isSchedulingInfrastructureReady');
        expect(databaseContent).toContain('getSchedulingInfrastructureError');
        expect(databaseContent).toContain('setSchedulingInfrastructureReady');
    });
});
