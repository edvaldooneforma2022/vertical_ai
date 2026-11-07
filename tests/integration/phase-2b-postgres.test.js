/**
 * FASE 2B — TESTES DE INTEGRAÇÃO COM POSTGRESQL REAL E ISOLADO
 *
 * ATENÇÃO: NUNCA APONTAR PARA BANCO OU CREDENCIAIS DE PRODUÇÃO!
 * Executa exclusivamente contra uma base de teste isolada configurada via:
 * process.env.TEST_DATABASE_URL
 *
 * Restrições estritas de segurança em runtime:
 * - Host permitido: estritamente 127.0.0.1
 * - Porta permitida: estritamente 5432
 * - Base permitida: estritamente linkmagico_phase2b_test
 * - Role restrita: linkmagico_test (NOSUPERUSER, NOCREATEDB, NOCREATEROLE)
 * - Verificação no catálogo da presença de pgcrypto pré-provisionada (sem DDL de extensão)
 * - Se qualquer parâmetro divergir, a suíte aborta ANTES de qualquer operação.
 * - Testes exercitam os métodos REAIS da aplicação:
 *     - WhatsAppChannel._executeBookingDirect (concorrência mono e multi-tenant)
 *     - WhatsAppChannel._reconcileStaleBookings
 *     - DatabaseHelpers.saveAppointment
 *     - initializeDatabase e runner real de migrations com fail-closed
 */

'use strict';

const TEST_DB_URL = process.env.TEST_DATABASE_URL;

// Configurar variáveis de ambiente do processo de teste antes de carregar os módulos
if (TEST_DB_URL) {
    process.env.DATABASE_URL = TEST_DB_URL;
    process.env.USE_POSTGRES = 'true';
}

const describeIntegration = TEST_DB_URL ? describe : describe.skip;

describeIntegration('PostgreSQL Real — Testes de Integração e Concorrência da Aplicação (Fase 2B)', () => {
    let pgPool;
    const { Pool } = require('pg');

    // Carregar módulos reais da aplicação
    const {
        initializeDatabase,
        runPhase2bMigrations,
        DatabaseHelpers,
        isSchedulingInfrastructureReady,
        getSchedulingInfrastructureError,
        setSchedulingInfrastructureReady,
        db
    } = require('../../database');

    const { WhatsAppChannel } = require('../../whatsapp-channel');

    /**
     * Validação estrita de segurança de URL antes de conectar
     */
    function assertSafeTestUrl(urlStr) {
        if (!urlStr) throw new Error('[SEGURANÇA] TEST_DATABASE_URL não configurada.');
        const parsed = new URL(urlStr);
        if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
            throw new Error(`[SEGURANÇA] Protocolo inválido: ${parsed.protocol}`);
        }
        if (parsed.hostname !== '127.0.0.1') {
            throw new Error(`[SEGURANÇA] Host '${parsed.hostname}' não autorizado. Permitido exclusivamente: 127.0.0.1`);
        }
        const port = parsed.port || '5432';
        if (port !== '5432') {
            throw new Error(`[SEGURANÇA] Porta '${port}' não autorizada. Permitida exclusivamente: 5432`);
        }
        const dbName = parsed.pathname.replace(/^\//, '');
        if (dbName !== 'linkmagico_phase2b_test') {
            throw new Error(`[SEGURANÇA] Banco '${dbName}' não autorizado. Permitido exclusivamente: linkmagico_phase2b_test`);
        }
    }

    /**
     * Validação rigorosa e independente da identidade de cada pool.
     * Não permite conexão sem comprovação de banco, endereço e porta.
     */
    async function assertPoolIdentity(poolInstance, poolName) {
        if (!poolInstance || typeof poolInstance.connect !== 'function') {
            throw new Error(
                `[SEGURANÇA][${poolName}] Pool inválido ou não inicializado. Abortando.`
            );
        }

        const client = await poolInstance.connect();

        try {
            const check = await client.query(`
                SELECT current_database() AS current_db,
                       current_user AS cur_user,
                       inet_server_addr()::text AS server_addr,
                       inet_server_port()::text AS server_port,
                       current_setting('server_version_num') AS ver_num
            `);

            const row = check.rows && check.rows[0];

            if (!row) {
                throw new Error(
                    `[SEGURANÇA][${poolName}] Consulta de identidade sem resultado. Abortando.`
                );
            }

            if (row.current_db !== 'linkmagico_phase2b_test') {
                throw new Error(
                    `[SEGURANÇA][${poolName}] Banco '${row.current_db}' não autorizado. Abortando.`
                );
            }

            if (row.cur_user !== 'linkmagico_test') {
                throw new Error(
                    `[SEGURANÇA][${poolName}] Usuário '${row.cur_user}' não autorizado. Abortando.`
                );
            }

            const addrStr = row.server_addr == null
                ? ''
                : String(row.server_addr).trim();

            if (addrStr !== '127.0.0.1' && addrStr !== '127.0.0.1/32') {
                throw new Error(
                    `[SEGURANÇA][${poolName}] Endereço '${addrStr || 'nulo/vazio'}' não autorizado. Permitido exclusivamente: 127.0.0.1 ou 127.0.0.1/32`
                );
            }

            const portStr = row.server_port == null
                ? ''
                : String(row.server_port).trim();

            if (portStr !== '5432') {
                throw new Error(
                    `[SEGURANÇA][${poolName}] Porta '${portStr || 'nula/vazia'}' não autorizada. Abortando.`
                );
            }

            const verNum = parseInt(row.ver_num, 10);
            if (isNaN(verNum) || verNum < 160000 || verNum >= 170000) {
                throw new Error(
                    `[SEGURANÇA][${poolName}] Versão PostgreSQL '${row.ver_num}' não é a versão 16 esperada. Abortando.`
                );
            }

        } finally {
            client.release();
        }
    }

    beforeAll(async () => {
        // 1. Validar a URL antes de qualquer conexão.
        assertSafeTestUrl(TEST_DB_URL);

        // 2. Criar o pool independente da suíte.
        pgPool = new Pool({
            connectionString: TEST_DB_URL,
            connectionTimeoutMillis: 3000
        });

        // 3. Validar fisicamente o primeiro pool.
        await assertPoolIdentity(pgPool, 'pgPool');

        // 4. Validar fisicamente o pool real da aplicação.
        // Não criar nem reconfigurar outro pool.
        await assertPoolIdentity(db.pool, 'db.pool');

        // 5. Verificar pgcrypto usando o pool já validado.
        const client = await pgPool.connect();

        try {
            const extCheck = await client.query(`
                SELECT 1
                FROM pg_extension
                WHERE extname = 'pgcrypto'
            `);

            if (extCheck.rowCount === 0) {
                throw new Error(
                    '[SEGURANÇA] Extensão "pgcrypto" não está instalada no catálogo de linkmagico_phase2b_test. Deve ser provisionada pelo administrador.'
                );
            }
        } finally {
            client.release();
        }
    });

    afterAll(async () => {
        // Encerramento limpo e gracioso de todos os pools para evitar handles abertos
        if (db && db.pool) {
            try { await db.pool.end(); } catch {}
        }
        if (pgPool) {
            try { await pgPool.end(); } catch {}
        }
    });

    beforeEach(async () => {
        // Limpar e reconstruir tabelas exclusivamente na base isolada linkmagico_phase2b_test
        // ATENÇÃO: NÃO executar CREATE EXTENSION aqui (role de teste não possui superusuário)
        const client = await pgPool.connect();
        try {
            await client.query(`
                DROP TABLE IF EXISTS tenant_appointments CASCADE;
                DROP TABLE IF EXISTS wa_schedule_pending CASCADE;
                DROP TABLE IF EXISTS api_keys CASCADE;
                DROP TABLE IF EXISTS tenants CASCADE;

                CREATE TABLE tenants (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name TEXT,
                    email TEXT
                );

                CREATE TABLE api_keys (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                    key_value TEXT NOT NULL,
                    key_hash TEXT NOT NULL,
                    active BOOLEAN DEFAULT true
                );

                CREATE TABLE wa_schedule_pending (
                    id SERIAL PRIMARY KEY,
                    tenant_id UUID REFERENCES tenants(id),
                    conversation_id TEXT NOT NULL,
                    api_key TEXT NOT NULL,
                    calendar_hash TEXT NOT NULL,
                    slots_json TEXT NOT NULL,
                    lead_id TEXT,
                    selected_date TEXT,
                    selected_time TEXT,
                    state VARCHAR(50) DEFAULT 'offered',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE tenant_appointments (
                    id VARCHAR(255) PRIMARY KEY,
                    tenant_uuid UUID REFERENCES tenants(id),
                    api_key VARCHAR(255),
                    lead_id VARCHAR(255),
                    datetime VARCHAR(100),
                    status VARCHAR(50),
                    notes TEXT,
                    metadata JSONB,
                    schedule_ref_id VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );

                CREATE UNIQUE INDEX idx_appointments_idempotency
                ON tenant_appointments (schedule_ref_id)
                WHERE schedule_ref_id IS NOT NULL;
            `);
        } finally {
            client.release();
        }

        // Resetar o estado da infraestrutura para true antes de cada teste funcional
        setSchedulingInfrastructureReady(true);
    });

    /**
     * Helper para criar instância real do WhatsAppChannel conectada ao banco de testes
     */
    function createTestChannel() {
        return new WhatsAppChannel({
            db: db,
            USE_POSTGRES: true,
            getLeadSystem: () => ({ appointments: [] }),
            getApiKeyManager: () => ({
                validateKey: async (key) => ({
                    valid: true,
                    tenantId: key.includes('B') ? 'tenant-b-uuid' : 'tenant-a-uuid'
                })
            }),
            whatsappManager: {},
            analytics: {},
            isSchedulingInfrastructureReady: () => isSchedulingInfrastructureReady()
        });
    }

    test('1. Concorrência Intra-Tenant Real: Duas confirmações simultâneas em _executeBookingDirect geram exatamente 1 appointment', async () => {
        const clientSetup = await pgPool.connect();
        let tenantId, pendingId;
        try {
            const tRes = await clientSetup.query(`INSERT INTO tenants (name) VALUES ('Tenant Teste Real') RETURNING id`);
            tenantId = tRes.rows[0].id;

            const pRes = await clientSetup.query(`
                INSERT INTO wa_schedule_pending (tenant_id, conversation_id, api_key, calendar_hash, slots_json, selected_date, selected_time, state)
                VALUES ($1, 'conv-concorrente', 'key-test-1', 'hash-test-1', '[]', '2026-12-01', '10:00', 'selected')
                RETURNING id
            `, [tenantId]);
            pendingId = pRes.rows[0].id;
        } finally {
            clientSetup.release();
        }

        const channel = createTestChannel();
        try {
            const pendingObj = {
                id: pendingId,
                api_key: 'key-test-1',
                calendar_hash: 'hash-test-1',
                selected_date: '2026-12-01',
                selected_time: '10:00'
            };
            const leadObj = { id: 'lead-concorrente', nome: 'Cliente Concorrente' };

            // Executar duas chamadas concorrentes REAIS de _executeBookingDirect via Promise.all
            const [resA, resB] = await Promise.all([
                channel._executeBookingDirect(pendingObj, leadObj, tenantId),
                channel._executeBookingDirect(pendingObj, leadObj, tenantId)
            ]);

            // Ambas devem reportar sucesso à aplicação
            expect(resA.success).toBe(true);
            expect(resB.success).toBe(true);

            // Exatamente uma foi a inserção original e a outra foi identificada como idempotente
            const duplicates = [resA.wasDuplicate, resB.wasDuplicate];
            expect(duplicates).toContain(false);
            expect(duplicates).toContain(true);

            // Ambos devem retornar o mesmo appointmentId final
            expect(resA.appointmentId).toBe(resB.appointmentId);

            // Validação no PostgreSQL real: exatamente 1 registro criado em tenant_appointments
            const verifyClient = await pgPool.connect();
            try {
                const countRes = await verifyClient.query(
                    `SELECT COUNT(*) FROM tenant_appointments WHERE schedule_ref_id = $1`,
                    [String(pendingId)]
                );
                expect(parseInt(countRes.rows[0].count, 10)).toBe(1);

                // wa_schedule_pending deve estar completed
                const pCheck = await verifyClient.query(
                    `SELECT state FROM wa_schedule_pending WHERE id = $1`,
                    [pendingId]
                );
                expect(pCheck.rows[0].state).toBe('completed');
            } finally {
                verifyClient.release();
            }
        } finally {
            channel.destroy();
        }
    });

    test('2. Concorrência Multi-Tenant Real: Dois tenants independentes confirmam simultaneamente via Promise.all sem interferência cruzada', async () => {
        const clientSetup = await pgPool.connect();
        let tenantAId, tenantBId, pendingAId, pendingBId;
        try {
            const tARes = await clientSetup.query(`INSERT INTO tenants (name) VALUES ('Tenant Alpha') RETURNING id`);
            tenantAId = tARes.rows[0].id;
            const tBRes = await clientSetup.query(`INSERT INTO tenants (name) VALUES ('Tenant Beta') RETURNING id`);
            tenantBId = tBRes.rows[0].id;

            const pARes = await clientSetup.query(`
                INSERT INTO wa_schedule_pending (tenant_id, conversation_id, api_key, calendar_hash, slots_json, selected_date, selected_time, state)
                VALUES ($1, 'conv-tenant-a', 'key-a', 'hash-a', '[]', '2026-12-02', '14:00', 'selected')
                RETURNING id
            `, [tenantAId]);
            pendingAId = pARes.rows[0].id;

            const pBRes = await clientSetup.query(`
                INSERT INTO wa_schedule_pending (tenant_id, conversation_id, api_key, calendar_hash, slots_json, selected_date, selected_time, state)
                VALUES ($1, 'conv-tenant-b', 'key-b', 'hash-b', '[]', '2026-12-02', '15:00', 'selected')
                RETURNING id
            `, [tenantBId]);
            pendingBId = pBRes.rows[0].id;
        } finally {
            clientSetup.release();
        }

        const channel = createTestChannel();
        try {
            const pendingA = {
                id: pendingAId,
                api_key: 'key-a',
                calendar_hash: 'hash-a',
                selected_date: '2026-12-02',
                selected_time: '14:00'
            };
            const leadA = { id: 'lead-a', nome: 'Cliente A' };

            const pendingB = {
                id: pendingBId,
                api_key: 'key-b',
                calendar_hash: 'hash-b',
                selected_date: '2026-12-02',
                selected_time: '15:00'
            };
            const leadB = { id: 'lead-b', nome: 'Cliente B' };

            // Executar chamadas simultâneas de dois tenants distintos
            const [resA, resB] = await Promise.all([
                channel._executeBookingDirect(pendingA, leadA, tenantAId),
                channel._executeBookingDirect(pendingB, leadB, tenantBId)
            ]);

            // Ambos devem ter sucesso como primeira inserção (não duplicados)
            expect(resA.success).toBe(true);
            expect(resA.wasDuplicate).toBe(false);
            expect(resB.success).toBe(true);
            expect(resB.wasDuplicate).toBe(false);
            expect(resA.appointmentId).not.toBe(resB.appointmentId);

            // Verificação no banco: isolamento estrito de tenant_uuid e estado
            const verifyClient = await pgPool.connect();
            try {
                const apptA = await verifyClient.query(
                    `SELECT id, tenant_uuid, schedule_ref_id FROM tenant_appointments WHERE id = $1`,
                    [resA.appointmentId]
                );
                expect(apptA.rows[0].tenant_uuid).toBe(tenantAId);
                expect(apptA.rows[0].schedule_ref_id).toBe(String(pendingAId));

                const apptB = await verifyClient.query(
                    `SELECT id, tenant_uuid, schedule_ref_id FROM tenant_appointments WHERE id = $1`,
                    [resB.appointmentId]
                );
                expect(apptB.rows[0].tenant_uuid).toBe(tenantBId);
                expect(apptB.rows[0].schedule_ref_id).toBe(String(pendingBId));

                const pendA = await verifyClient.query(`SELECT state, tenant_id FROM wa_schedule_pending WHERE id = $1`, [pendingAId]);
                expect(pendA.rows[0].state).toBe('completed');
                expect(pendA.rows[0].tenant_id).toBe(tenantAId);

                const pendB = await verifyClient.query(`SELECT state, tenant_id FROM wa_schedule_pending WHERE id = $1`, [pendingBId]);
                expect(pendB.rows[0].state).toBe('completed');
                expect(pendB.rows[0].tenant_id).toBe(tenantBId);
            } finally {
                verifyClient.release();
            }
        } finally {
            channel.destroy();
        }
    });

    test('3. Isolamento Estrito / Prevenção de Hijack: Tenant B não consegue confirmar ou capturar pending pertencente ao Tenant A', async () => {
        const clientSetup = await pgPool.connect();
        let tenantAId, tenantBId, pendingAId;
        try {
            const tARes = await clientSetup.query(`INSERT INTO tenants (name) VALUES ('Tenant Vítima') RETURNING id`);
            tenantAId = tARes.rows[0].id;
            const tBRes = await clientSetup.query(`INSERT INTO tenants (name) VALUES ('Tenant Invasor') RETURNING id`);
            tenantBId = tBRes.rows[0].id;

            const pARes = await clientSetup.query(`
                INSERT INTO wa_schedule_pending (tenant_id, conversation_id, api_key, calendar_hash, slots_json, selected_date, selected_time, state)
                VALUES ($1, 'conv-vitima', 'key-vitima', 'hash-vitima', '[]', '2026-12-03', '09:00', 'selected')
                RETURNING id
            `, [tenantAId]);
            pendingAId = pARes.rows[0].id;
        } finally {
            clientSetup.release();
        }

        const channel = createTestChannel();
        try {
            const pendingObj = {
                id: pendingAId,
                api_key: 'key-invasor',
                calendar_hash: 'hash-invasor',
                selected_date: '2026-12-03',
                selected_time: '09:00'
            };
            const leadInvasor = { id: 'lead-invasor', nome: 'Invasor' };

            // Tenant B tenta confirmar com seu tenantBId o pending pertencente ao Tenant A
            const hijackResult = await channel._executeBookingDirect(pendingObj, leadInvasor, tenantBId);

            // Operação deve falhar e não adquirir o CAS
            expect(hijackResult.success).toBe(false);
            expect(hijackResult.reason).toBe('cas_failed');

            // Verificação no banco: pending do Tenant A permanece intacto ('selected') e nenhum appointment foi gerado
            const verifyClient = await pgPool.connect();
            try {
                const checkPending = await verifyClient.query(
                    `SELECT state, tenant_id FROM wa_schedule_pending WHERE id = $1`,
                    [pendingAId]
                );
                expect(checkPending.rows[0].state).toBe('selected');
                expect(checkPending.rows[0].tenant_id).toBe(tenantAId);

                const countAppt = await verifyClient.query(
                    `SELECT COUNT(*) FROM tenant_appointments WHERE schedule_ref_id = $1`,
                    [String(pendingAId)]
                );
                expect(parseInt(countAppt.rows[0].count, 10)).toBe(0);
            } finally {
                verifyClient.release();
            }
        } finally {
            channel.destroy();
        }
    });

    test('4. Conflito real no índice UNIQUE parcial é tratado com sucesso idempotente via aplicação', async () => {
        const clientSetup = await pgPool.connect();
        let tenantId, pendingId;
        try {
            const tRes = await clientSetup.query(`INSERT INTO tenants (name) VALUES ('T1') RETURNING id`);
            tenantId = tRes.rows[0].id;

            const pRes = await clientSetup.query(`
                INSERT INTO wa_schedule_pending (tenant_id, conversation_id, api_key, calendar_hash, slots_json, selected_date, selected_time, state)
                VALUES ($1, 'conv-idx', 'key-test-4', 'hash-test-4', '[]', '2026-12-01', '11:00', 'selected')
                RETURNING id
            `, [tenantId]);
            pendingId = pRes.rows[0].id;
        } finally {
            clientSetup.release();
        }

        const channel = createTestChannel();
        try {
            const pendingObj = {
                id: pendingId,
                api_key: 'key-test-4',
                calendar_hash: 'hash-test-4',
                selected_date: '2026-12-01',
                selected_time: '11:00'
            };
            const leadObj = { id: 'lead-idx', nome: 'Cliente Index' };

            // Primeira confirmação real
            const firstResult = await channel._executeBookingDirect(pendingObj, leadObj, tenantId);
            expect(firstResult.success).toBe(true);
            expect(firstResult.wasDuplicate).toBe(false);

            // Segunda confirmação do mesmo pending (conflito real no índice UNIQUE parcial)
            const secondResult = await channel._executeBookingDirect(pendingObj, leadObj, tenantId);
            expect(secondResult.success).toBe(true);
            expect(secondResult.wasDuplicate).toBe(true);
            expect(secondResult.appointmentId).toBe(firstResult.appointmentId);
        } finally {
            channel.destroy();
        }
    });

    test('5. Recuperação real após resultado incerto de COMMIT (retry com pending já completed)', async () => {
        const clientSetup = await pgPool.connect();
        let tenantId, pendingId;
        try {
            const tRes = await clientSetup.query(`INSERT INTO tenants (name) VALUES ('T1') RETURNING id`);
            tenantId = tRes.rows[0].id;

            // Simula transação que completou no banco mas o cliente não recebeu a resposta
            const pRes = await clientSetup.query(`
                INSERT INTO wa_schedule_pending (tenant_id, conversation_id, api_key, calendar_hash, slots_json, state)
                VALUES ($1, 'conv-commit-lost', 'k1', 'h1', '[]', 'completed')
                RETURNING id
            `, [tenantId]);
            pendingId = pRes.rows[0].id;

            // Appointment já existe persistido
            await DatabaseHelpers.saveAppointment('k1', {
                id: 'apt-already-committed',
                leadId: 'lead-1',
                datetime: '2026-12-01 14:00',
                status: 'pendente',
                notes: 'Agendado previamente',
                scheduleRefId: String(pendingId),
                tenantUuid: tenantId
            });
        } finally {
            clientSetup.release();
        }

        const channel = createTestChannel();
        try {
            const pendingObj = {
                id: pendingId,
                api_key: 'k1',
                calendar_hash: 'h1',
                selected_date: '2026-12-01',
                selected_time: '14:00'
            };

            // Nova chamada ao método real da aplicação
            const result = await channel._executeBookingDirect(pendingObj, {}, tenantId);

            expect(result.success).toBe(true);
            expect(result.wasDuplicate).toBe(true);
            expect(result.appointmentId).toBe('apt-already-committed');
        } finally {
            channel.destroy();
        }
    });

    test('6. Reconciliação real _reconcileStaleBookings: preserva transação ativa e resolve pendings travados', async () => {
        const clientSetup = await pgPool.connect();
        let tenantId, activePendingId, staleNoApptId, staleWithApptId;
        try {
            const tRes = await clientSetup.query(`INSERT INTO tenants (name) VALUES ('T1') RETURNING id`);
            tenantId = tRes.rows[0].id;

            // 1. Pending ativo (< 5 min)
            const pActive = await clientSetup.query(`
                INSERT INTO wa_schedule_pending (tenant_id, conversation_id, api_key, calendar_hash, slots_json, state, updated_at)
                VALUES ($1, 'c-active', 'k1', 'h1', '[]', 'booking_in_progress', NOW())
                RETURNING id
            `, [tenantId]);
            activePendingId = pActive.rows[0].id;

            // 2. Pending travado (> 5 min) sem appointment
            const pStale1 = await clientSetup.query(`
                INSERT INTO wa_schedule_pending (tenant_id, conversation_id, api_key, calendar_hash, slots_json, state, updated_at)
                VALUES ($1, 'c-stale-1', 'k1', 'h1', '[]', 'booking_in_progress', NOW() - INTERVAL '10 minutes')
                RETURNING id
            `, [tenantId]);
            staleNoApptId = pStale1.rows[0].id;

            // 3. Pending travado (> 5 min) com appointment existente
            const pStale2 = await clientSetup.query(`
                INSERT INTO wa_schedule_pending (tenant_id, conversation_id, api_key, calendar_hash, slots_json, state, updated_at)
                VALUES ($1, 'c-stale-2', 'k1', 'h1', '[]', 'booking_in_progress', NOW() - INTERVAL '10 minutes')
                RETURNING id
            `, [tenantId]);
            staleWithApptId = pStale2.rows[0].id;

            // Criar o appointment correspondente ao pStale2
            await clientSetup.query(`
                INSERT INTO tenant_appointments (id, tenant_uuid, api_key, schedule_ref_id, datetime, status)
                VALUES ('apt-reconciled', $1, 'k1', $2, '2026-12-01 16:00', 'pendente')
            `, [tenantId, String(staleWithApptId)]);
        } finally {
            clientSetup.release();
        }

        const channel = createTestChannel();
        try {
            // Executar o método de reconciliação real da aplicação
            await channel._reconcileStaleBookings();

            const clientVerify = await pgPool.connect();
            try {
                // Ativo: mantido em booking_in_progress (não interferiu em transação em andamento)
                const checkActive = await clientVerify.query(`SELECT state FROM wa_schedule_pending WHERE id = $1`, [activePendingId]);
                expect(checkActive.rows[0].state).toBe('booking_in_progress');

                // Travado sem agendamento: revertido para selected (permite retentativa segura)
                const checkStale1 = await clientVerify.query(`SELECT state FROM wa_schedule_pending WHERE id = $1`, [staleNoApptId]);
                expect(checkStale1.rows[0].state).toBe('selected');

                // Travado com agendamento: finalizado para completed
                const checkStale2 = await clientVerify.query(`SELECT state FROM wa_schedule_pending WHERE id = $1`, [staleWithApptId]);
                expect(checkStale2.rows[0].state).toBe('completed');
            } finally {
                clientVerify.release();
            }
        } finally {
            channel.destroy();
        }
    });

    test('7. Migration real de FK com constraint correta preexistente — idempotência via runPhase2bMigrations', async () => {
        // Executar o runner de migrations real da Fase 2B
        const res1 = await runPhase2bMigrations(db, true);
        expect(res1.success).toBe(true);
        expect(isSchedulingInfrastructureReady()).toBe(true);

        // Executar novamente: deve ser 100% idempotente
        const res2 = await runPhase2bMigrations(db, true);
        expect(res2.success).toBe(true);
        expect(isSchedulingInfrastructureReady()).toBe(true);
        expect(getSchedulingInfrastructureError()).toBeNull();
    });

    test('8. Migration real de FK com constraint homônima incompatível — interrupção obrigatória via runPhase2bMigrations', async () => {
        const client = await pgPool.connect();
        try {
            // Forçar criação de coluna e índice para criar constraint homônima incompatível
            await client.query(`ALTER TABLE wa_schedule_pending ADD COLUMN IF NOT EXISTS wrong_tenant_col TEXT`);
            await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_email_unique ON tenants(email)`);

            // Remover a constraint correta se existir
            await client.query(`ALTER TABLE wa_schedule_pending DROP CONSTRAINT IF EXISTS fk_wa_schedule_pending_tenant`);

            // Criar constraint homônima incompatível (aponta para coluna errada)
            await client.query(`
                ALTER TABLE wa_schedule_pending
                ADD CONSTRAINT fk_wa_schedule_pending_tenant
                FOREIGN KEY (wrong_tenant_col) REFERENCES tenants(email);
            `);
        } finally {
            client.release();
        }

        // Executar o runner de migrations real da Fase 2B
        const res = await runPhase2bMigrations(db, true);

        // Deve falhar com fail-closed
        expect(res.success).toBe(false);
        expect(isSchedulingInfrastructureReady()).toBe(false);
        const err = getSchedulingInfrastructureError();
        expect(err).not.toBeNull();
        expect(err).toContain('Constraint homônima incompatível');
    });

    test('9. Migration real de índice UNIQUE correto preexistente — idempotência via runPhase2bMigrations', async () => {
        // Executar o runner real da Fase 2B com o índice existente
        const res1 = await runPhase2bMigrations(db, true);
        expect(res1.success).toBe(true);
        expect(isSchedulingInfrastructureReady()).toBe(true);

        // Executar novamente
        const res2 = await runPhase2bMigrations(db, true);
        expect(res2.success).toBe(true);
        expect(isSchedulingInfrastructureReady()).toBe(true);
        expect(getSchedulingInfrastructureError()).toBeNull();
    });

    test('10. Migration real de índice homônimo incompatível — interrupção obrigatória via runPhase2bMigrations', async () => {
        const client = await pgPool.connect();
        try {
            // Remover o índice correto
            await client.query(`DROP INDEX IF EXISTS idx_appointments_idempotency`);

            // Criar índice homônimo NÃO-UNIQUE (incompatível)
            await client.query(`
                CREATE INDEX idx_appointments_idempotency
                ON tenant_appointments (schedule_ref_id)
                WHERE schedule_ref_id IS NOT NULL;
            `);
        } finally {
            client.release();
        }

        // Executar o runner real da Fase 2B
        const res = await runPhase2bMigrations(db, true);

        // Deve falhar com fail-closed
        expect(res.success).toBe(false);
        expect(isSchedulingInfrastructureReady()).toBe(false);
        const err = getSchedulingInfrastructureError();
        expect(err).not.toBeNull();
        expect(err).toContain('Índice homônimo incompatível encontrado');
    });

    test('11. Detecção real de duplicidades em schedule_ref_id aborta migration sem perder dados via runPhase2bMigrations', async () => {
        const client = await pgPool.connect();
        let tenantId;
        try {
            const tRes = await client.query(`INSERT INTO tenants (name) VALUES ('T1') RETURNING id`);
            tenantId = tRes.rows[0].id;

            // Remover índice para permitir inserção de duplicatas de teste
            await client.query(`DROP INDEX IF EXISTS idx_appointments_idempotency`);

            // Inserir dois appointments com mesmo schedule_ref_id
            await client.query(`
                INSERT INTO tenant_appointments (id, tenant_uuid, schedule_ref_id)
                VALUES ('apt-dup-real-1', $1, 'dup-real-999'),
                       ('apt-dup-real-2', $1, 'dup-real-999')
            `, [tenantId]);
        } finally {
            client.release();
        }

        // Executar o runner de migrations real da Fase 2B
        const res = await runPhase2bMigrations(db, true);

        // Deve falhar com fail-closed informando a duplicidade detectada
        expect(res.success).toBe(false);
        expect(isSchedulingInfrastructureReady()).toBe(false);
        const err = getSchedulingInfrastructureError();
        expect(err).not.toBeNull();
        expect(err).toContain('Detecção de duplicidades em schedule_ref_id impediu criação de índice único');
        expect(err).toContain('dup-real-999');

        // Confirmar preservação estrita de dados (nenhum registro foi excluído)
        const clientVerify = await pgPool.connect();
        try {
            const countCheck = await clientVerify.query(
                `SELECT COUNT(*) FROM tenant_appointments WHERE schedule_ref_id = 'dup-real-999'`
            );
            expect(parseInt(countCheck.rows[0].count, 10)).toBe(2);
        } finally {
            clientVerify.release();
        }
    });

    test('12. Backfill real de tenant_uuid em tenant_appointments via runPhase2bMigrations', async () => {
        const client = await pgPool.connect();
        let tenantId;
        try {
            const tRes = await client.query(`INSERT INTO tenants (name) VALUES ('T-Backfill') RETURNING id`);
            tenantId = tRes.rows[0].id;

            await client.query(`
                INSERT INTO api_keys (tenant_id, key_value, key_hash)
                VALUES ($1, 'key-backfill-real', 'hash-bf')
            `, [tenantId]);

            // Inserir agendamento com tenant_uuid NULL
            await client.query(`
                INSERT INTO tenant_appointments (id, api_key, tenant_uuid, schedule_ref_id)
                VALUES ('apt-bf-real-1', 'key-backfill-real', NULL, 'ref-bf-1')
            `);
        } finally {
            client.release();
        }

        // Executar o runner real da Fase 2B (executa o backfill da migration 2B-3)
        const res1 = await runPhase2bMigrations(db, true);
        expect(res1.success).toBe(true);
        expect(isSchedulingInfrastructureReady()).toBe(true);

        const clientVerify = await pgPool.connect();
        try {
            // Verificar se tenant_uuid foi preenchido
            const verify = await clientVerify.query(`SELECT tenant_uuid FROM tenant_appointments WHERE id = 'apt-bf-real-1'`);
            expect(verify.rows[0].tenant_uuid).toBe(tenantId);
        } finally {
            clientVerify.release();
        }

        // Executar novamente: idempotente
        const res2 = await runPhase2bMigrations(db, true);
        expect(res2.success).toBe(true);
        expect(isSchedulingInfrastructureReady()).toBe(true);
    });
});
