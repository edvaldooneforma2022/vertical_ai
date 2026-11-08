/**
 * FASE 2C.3 — TESTES DE PERSISTÊNCIA MULTI-TENANT CANÔNICA
 *
 * Validação de persistência canônica por tenant UUID:
 * 1. DatabaseHelpers.saveLead grava tenant_uuid correto
 * 2. Lead do Tenant A não pode ser atualizado pelo Tenant B (OWNERSHIP_MISMATCH 403)
 * 3. Lead com tenant_uuid NULL não é assumido automaticamente por outro tenant
 * 4. DatabaseHelpers.getLeads retorna apenas leads do tenant autenticado
 * 5. Rotação de API Key mantém acesso aos leads do tenant legítimo
 * 6. DatabaseHelpers.getLeadById e updateLead respeitam ownership
 * 7. WhatsAppChannel._logMessage persiste tenant_uuid
 * 8. Mesmo telefone em dois tenants não causa mistura de registros
 * 9. CRM sincroniza corretamente para tenants com credenciais V2 (bcrypt)
 * 10. CRM não sincroniza registros de outro tenant
 * 11. learning_conversations não entrega conteúdo de Tenant A ao Tenant B (loadConversations)
 * 12. Dados legados ambíguos permanecem sem associação (tenant_uuid IS NULL)
 * 13. Migrations de Fase 2C.3 são idempotentes e catalog-checked
 * 14. Comportamentos congelados e consultas legadas permanecem compatíveis
 */

'use strict';

process.env.USE_POSTGRES = 'true';
process.env.DATABASE_URL = 'postgres://mock:mock@localhost:5432/mock';

const mockPool = {
    query: jest.fn(),
    on: jest.fn()
};

jest.mock('pg', () => ({
    Pool: jest.fn(() => mockPool)
}));

const mockCrmManager = {
    syncLeadToCRM: jest.fn().mockResolvedValue({ success: true })
};

jest.mock('../../lib/crm/index', () => ({
    crmManager: mockCrmManager
}));

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const databaseModule = require('../../database');
const { WhatsAppChannel } = require('../../whatsapp-channel');
const { LearningDbAdapter } = require('../../analytics/db-adapter');

describe('FASE 2C.3 — Persistência Multi-Tenant Canônica', () => {
    const tenantA = '11111111-1111-4111-8111-111111111111';
    const tenantB = '22222222-2222-4222-8222-222222222222';
    const legacyKeyA = 'lm_live_legacy_key_a';
    const legacyKeyB = 'lm_live_legacy_key_b';

    beforeEach(() => {
        jest.clearAllMocks();
        mockPool.query.mockReset();
        mockCrmManager.syncLeadToCRM.mockClear();
    });

    // ═══════════════════════════════════════════════════════════
    // 1. DatabaseHelpers.saveLead & Ownership (Reqs 1, 2, 3, 5)
    // ═══════════════════════════════════════════════════════════
    describe('1. DatabaseHelpers.saveLead & Proteção de Ownership', () => {
        test('Req 1: saveLead grava tenant_uuid correto no PostgreSQL', async () => {
            const leadData = {
                id: 'lead-test-01',
                nome: 'Lead A',
                email: 'lead-a@teste.com',
                telefone: '5511999990001'
            };

            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: leadData.id, ...leadData, tenant_uuid: tenantA }]
            });

            const saved = await databaseModule.DatabaseHelpers.saveLead(legacyKeyA, leadData, tenantA);

            expect(mockPool.query).toHaveBeenCalled();
            const [queryStr, params] = mockPool.query.mock.calls[0];

            expect(queryStr).toContain('INSERT INTO tenant_leads');
            expect(queryStr).toContain('tenant_uuid');
            // Param $12 deve ser tenantA
            expect(params[11]).toBe(tenantA);
            expect(saved.tenant_uuid).toBe(tenantA);
        });

        test('Req 2: Lead do Tenant A não pode ser atualizado pelo Tenant B (rejeição com 403)', async () => {
            const leadData = {
                id: 'lead-shared-id',
                nome: 'Tentativa de Hijack',
                email: 'hacker@teste.com'
            };

            // Simula PostgreSQL retornando 0 rows afetadas devido à cláusula WHERE do ON CONFLICT
            mockPool.query.mockResolvedValueOnce({ rows: [] });

            // Simula consulta de checagem encontrando que o lead pertence ao Tenant A
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 'lead-shared-id', tenant_uuid: tenantA, api_key: legacyKeyA }]
            });

            await expect(
                databaseModule.DatabaseHelpers.saveLead(legacyKeyB, leadData, tenantB)
            ).rejects.toThrow('Acesso negado: lead pertence a outro tenant.');

            expect(mockPool.query).toHaveBeenCalledTimes(2);
        });

        test('Req 3: Lead com tenant_uuid NULL não é assumido automaticamente por outro tenant', async () => {
            const leadData = {
                id: 'legacy-lead-null',
                nome: 'Lead Legado Antigo'
            };

            // Simula tentativa de inserção/update com Tenant B onde cláusula WHERE falha
            mockPool.query.mockResolvedValueOnce({ rows: [] });

            // Simula checagem encontrando lead legado pertencente a outra API Key (legacyKeyA) com tenant_uuid NULL
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 'legacy-lead-null', tenant_uuid: null, api_key: legacyKeyA }]
            });

            await expect(
                databaseModule.DatabaseHelpers.saveLead(legacyKeyB, leadData, tenantB)
            ).rejects.toThrow('Acesso negado: lead pertence a outro tenant.');
        });

        test('Req 5: Rotação de API Key mantém acesso aos leads associados ao tenant UUID', async () => {
            const rotatedKeyA = 'lm_live_new_rotated_key_a';
            const leadData = {
                id: 'lead-rotated-01',
                nome: 'Lead A Atualizado'
            };

            // Mesma tenantA, nova rotatedKeyA: WHERE (tenant_uuid = EXCLUDED.tenant_uuid) coincide
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: leadData.id, tenant_uuid: tenantA, api_key: rotatedKeyA }]
            });

            const saved = await databaseModule.DatabaseHelpers.saveLead(rotatedKeyA, leadData, tenantA);

            expect(saved).toBeDefined();
            expect(saved.tenant_uuid).toBe(tenantA);
            expect(saved.api_key).toBe(rotatedKeyA);
        });
    });

    // ═══════════════════════════════════════════════════════════
    // 2. Consultas Canônicas: getLeads, getLeadById, updateLead
    // ═══════════════════════════════════════════════════════════
    describe('2. Consultas Canônicas e Isolamento (Reqs 4, 6, 14)', () => {
        test('Req 4: getLeads com UUID canônico consulta estritamente WHERE tenant_uuid = $1', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [
                    { id: 'lead-1', nome: 'Lead 1', tenant_uuid: tenantA },
                    { id: 'lead-2', nome: 'Lead 2', tenant_uuid: tenantA }
                ]
            });

            const leads = await databaseModule.DatabaseHelpers.getLeads(tenantA);

            expect(mockPool.query).toHaveBeenCalledTimes(1);
            const [sql, params] = mockPool.query.mock.calls[0];

            expect(sql).toContain('WHERE tenant_uuid = $1');
            expect(sql).not.toContain('OR tenant_uuid::text = $1');
            expect(params).toEqual([tenantA]);
            expect(leads.length).toBe(2);
            expect(leads.every(l => l.tenant_uuid === tenantA)).toBe(true);
        });

        test('Req 14: getLeads com API Key legada não-UUID consulta estritamente registros com tenant_uuid IS NULL', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [
                    { id: 'lead-legacy', nome: 'Lead Legado', api_key: legacyKeyA, tenant_uuid: null }
                ]
            });

            const leads = await databaseModule.DatabaseHelpers.getLeads(legacyKeyA);

            expect(mockPool.query).toHaveBeenCalledTimes(1);
            const [sql, params] = mockPool.query.mock.calls[0];

            expect(sql).toContain('WHERE api_key = $1 AND tenant_uuid IS NULL');
            expect(params).toEqual([legacyKeyA]);
            expect(leads.length).toBe(1);
        });

        test('Req 6: getLeadById com UUID filtra por tenant_uuid = $1 AND id = $2', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 'lead-1', tenant_uuid: tenantA }]
            });

            const lead = await databaseModule.DatabaseHelpers.getLeadById(tenantA, 'lead-1');

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE tenant_uuid = $1 AND id = $2'),
                [tenantA, 'lead-1']
            );
            expect(lead.id).toBe('lead-1');
        });

        test('Req 6: updateLead com UUID atualiza exclusivamente com escopo do tenant', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: 'lead-1', nome: 'Nome Atualizado', tenant_uuid: tenantA }]
            });

            const updated = await databaseModule.DatabaseHelpers.updateLead(tenantA, 'lead-1', {
                nome: 'Nome Atualizado'
            });

            const [sql, params] = mockPool.query.mock.calls[0];
            expect(sql).toContain('WHERE tenant_uuid = $1 AND id = $2');
            expect(params[0]).toBe(tenantA);
            expect(params[1]).toBe('lead-1');
            expect(updated.nome).toBe('Nome Atualizado');
        });
    });

    // ═══════════════════════════════════════════════════════════
    // 3. WhatsAppChannel._logMessage & Isolamento (Reqs 7, 8)
    // ═══════════════════════════════════════════════════════════
    describe('3. WhatsAppChannel._logMessage & Isolamento de Mensagens', () => {
        let channel;

        beforeEach(() => {
            channel = Object.create(WhatsAppChannel.prototype);
            channel.db = mockPool;
            channel.USE_POSTGRES = true;
        });

        test('Req 7: _logMessage persiste tenant_uuid como parâmetro $11', async () => {
            await channel._logMessage({
                apiKey: legacyKeyA,
                waMessageId: 'wa-msg-101',
                waPhone: '5511999990001',
                direction: 'inbound',
                content: 'Olá assistente',
                leadId: 'lead-01',
                conversationId: 'conv-01',
                provider: 'evolution',
                tenantId: tenantA
            });

            expect(mockPool.query).toHaveBeenCalledTimes(1);
            const [sql, params] = mockPool.query.mock.calls[0];

            expect(sql).toContain('INSERT INTO whatsapp_messages');
            expect(sql).toContain('tenant_uuid');
            expect(params.length).toBe(11);
            expect(params[10]).toBe(tenantA);
        });

        test('Req 7: _logMessage lida de forma segura com tenantId nulo ou inválido', async () => {
            await channel._logMessage({
                apiKey: legacyKeyA,
                waPhone: '5511999990001',
                direction: 'outbound',
                content: 'Resposta',
                tenantId: 'invalid-non-uuid-string'
            });

            const [, params] = mockPool.query.mock.calls[0];
            expect(params[10]).toBeNull();
        });

        test('Req 8: Mesmo telefone em dois tenants diferentes gera mensagens com tenant_uuid distintos', async () => {
            const sharedPhone = '5511888887777';

            // Mensagem no tenant A
            await channel._logMessage({
                apiKey: legacyKeyA,
                waPhone: sharedPhone,
                direction: 'inbound',
                content: 'Mensagem para Tenant A',
                tenantId: tenantA
            });

            // Mensagem no tenant B
            await channel._logMessage({
                apiKey: legacyKeyB,
                waPhone: sharedPhone,
                direction: 'inbound',
                content: 'Mensagem para Tenant B',
                tenantId: tenantB
            });

            expect(mockPool.query).toHaveBeenCalledTimes(2);

            const paramsA = mockPool.query.mock.calls[0][1];
            const paramsB = mockPool.query.mock.calls[1][1];

            expect(paramsA[4]).toBe(sharedPhone);
            expect(paramsA[10]).toBe(tenantA);

            expect(paramsB[4]).toBe(sharedPhone);
            expect(paramsB[10]).toBe(tenantB);

            expect(paramsA[10]).not.toBe(paramsB[10]);
        });
    });

    // ═══════════════════════════════════════════════════════════
    // 4. CRM Sincronização & Chaves V2 bcrypt (Reqs 9, 10)
    // ═══════════════════════════════════════════════════════════
    describe('4. Sincronização CRM e Resolução de Chaves V2 (Reqs 9, 10)', () => {
        beforeEach(() => {
            mockCrmManager.syncLeadToCRM.mockReset();
        });

        test('Req 9: saveLead aciona CRM com tenantId canônico resolvido diretamente', async () => {
            const leadData = {
                id: 'crm-lead-01',
                nome: 'Cliente CRM',
                email: 'cliente@crm.com'
            };

            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: leadData.id, ...leadData, tenant_uuid: tenantA }]
            });

            await databaseModule.DatabaseHelpers.saveLead('some-key', leadData, tenantA);

            await new Promise(resolve => setTimeout(resolve, 80));

            expect(mockCrmManager.syncLeadToCRM).toHaveBeenCalledWith(
                tenantA,
                expect.objectContaining({ id: 'crm-lead-01', nome: 'Cliente CRM' })
            );
        });

        test('Req 9: saveLead para chave V2 sem tenantUuid explícito resolve via api_keys_v2 com bcrypt', async () => {
            const rawV2Key = 'lm_live_abcdef1234567890';
            const hashedKey = await bcrypt.hash(rawV2Key, 4); // Salt rápido para teste unitário
            const leadData = { id: 'crm-v2-lead', nome: 'Cliente V2' };

            // 1. Inserção do lead
            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: leadData.id, tenant_uuid: null }]
            });

            // 2. Consulta a api_keys_v2 pelo prefixo de 12 caracteres
            mockPool.query.mockResolvedValueOnce({
                rows: [{ tenant_id: tenantB, key_hash: hashedKey, status: 'active' }]
            });

            await databaseModule.DatabaseHelpers.saveLead(rawV2Key, leadData, null);

            await new Promise(resolve => setTimeout(resolve, 150));

            expect(mockCrmManager.syncLeadToCRM).toHaveBeenCalledWith(
                tenantB,
                expect.objectContaining({ id: 'crm-v2-lead' })
            );
        });

        test('Req 10: CRM não sincroniza registros de outro tenant', async () => {
            const leadData = { id: 'crm-isolated-lead', nome: 'Lead Isolado' };

            mockPool.query.mockResolvedValueOnce({
                rows: [{ id: leadData.id, tenant_uuid: tenantA }]
            });

            await databaseModule.DatabaseHelpers.saveLead('key-a', leadData, tenantA);
            await new Promise(resolve => setTimeout(resolve, 80));

            expect(mockCrmManager.syncLeadToCRM).not.toHaveBeenCalledWith(
                tenantB,
                expect.anything()
            );
        });
    });

    // ═══════════════════════════════════════════════════════════
    // 5. Isolamento de Aprendizado em DbAdapter (Req 11)
    // ═══════════════════════════════════════════════════════════
    describe('5. Isolamento de Aprendizado (learning_conversations) (Req 11)', () => {
        let adapter;

        beforeEach(() => {
            adapter = new LearningDbAdapter(mockPool, true);
        });

        test('Req 11: saveConversations grava tenant_uuid na tabela learning_conversations', async () => {
            const records = [{
                id: 'conv-rec-01',
                conversationId: 'c1',
                userMessage: 'Olá',
                aiResponse: 'Tudo bem?',
                tenantUuid: tenantA
            }];

            await adapter.saveConversations(records);

            expect(mockPool.query).toHaveBeenCalledTimes(1);
            const [sql, params] = mockPool.query.mock.calls[0];

            expect(sql).toContain('INSERT INTO learning_conversations');
            expect(sql).toContain('tenant_uuid');
            // Param $18 deve ser tenantA
            expect(params[17]).toBe(tenantA);
        });

        test('Req 11: loadConversations sem tenantUuid rejeita busca e retorna array vazio (bloqueio de vazamento)', async () => {
            const result = await adapter.loadConversations(50, null);

            expect(result).toEqual([]);
            expect(mockPool.query).not.toHaveBeenCalled();
        });

        test('Req 11: loadConversations com tenantUuid filtra estritamente por tenant_uuid = $1', async () => {
            mockPool.query.mockResolvedValueOnce({
                rows: [
                    { id: 'c1', user_message: 'Msg A', tenant_uuid: tenantA },
                    { id: 'c2', user_message: 'Msg A2', tenant_uuid: tenantA }
                ]
            });

            const result = await adapter.loadConversations(50, tenantA);

            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('WHERE tenant_uuid = $1'),
                [tenantA, 50]
            );
            expect(result.length).toBe(2);
            expect(result[0].tenantUuid).toBe(tenantA);
        });

        test('Req 11: _rowToRecord mapeia tenantUuid corretamente', () => {
            const row = {
                id: 'r1',
                conversation_id: 'conv-1',
                created_at: new Date().toISOString(),
                user_message: 'Teste',
                ai_response: 'Resp',
                tenant_uuid: tenantA
            };

            const record = adapter._rowToRecord(row);
            expect(record.tenantUuid).toBe(tenantA);
        });
    });

    // ═══════════════════════════════════════════════════════════
    // 6. Migrations Idempotentes e Backfill Seguro (Reqs 12, 13)
    // ═══════════════════════════════════════════════════════════
    describe('6. Migrations Idempotentes e Análise de Backfill (Reqs 12, 13)', () => {
        test('Req 13: runPhase2c3Migrations executa com sucesso e é idempotente', async () => {
            mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });

            const res1 = await databaseModule.runPhase2c3Migrations(mockPool, true);
            expect(res1.success).toBe(true);

            // Segunda execução (idempotência)
            const res2 = await databaseModule.runPhase2c3Migrations(mockPool, true);
            expect(res2.success).toBe(true);

            // Verifica que consultas de alteração e catalog check foram emitidas
            const queries = mockPool.query.mock.calls.map(c => c[0]);
            expect(queries.some(q => q.includes('whatsapp_messages ADD COLUMN IF NOT EXISTS tenant_uuid'))).toBe(true);
            expect(queries.some(q => q.includes('learning_conversations ADD COLUMN IF NOT EXISTS tenant_uuid'))).toBe(true);
            expect(queries.some(q => q.includes('idx_tenant_leads_tenant_uuid'))).toBe(true);
            expect(queries.some(q => q.includes('idx_wa_msg_tenant_uuid'))).toBe(true);
        });

        test('Req 12: Backfill conservador atualiza apenas registros vinculados a chaves V1 ativas e com tenant_id não nulo', async () => {
            mockPool.query.mockImplementation((sql) => {
                if (typeof sql === 'string' && sql.startsWith('UPDATE tenant_leads')) {
                    return Promise.resolve({ rowCount: 15 });
                }
                if (typeof sql === 'string' && sql.startsWith('UPDATE whatsapp_messages')) {
                    return Promise.resolve({ rowCount: 8 });
                }
                return Promise.resolve({ rows: [], rowCount: 0 });
            });

            const res = await databaseModule.runPhase2c3Migrations(mockPool, true);

            expect(res.success).toBe(true);
            expect(res.stats.leadsBackfilled).toBe(15);
            expect(res.stats.messagesBackfilled).toBe(8);

            const queries = mockPool.query.mock.calls.map(c => c[0]);
            const leadBackfill = queries.find(q => typeof q === 'string' && q.startsWith('UPDATE tenant_leads'));

            expect(leadBackfill).toContain('tl.api_key = ak.key_value');
            expect(leadBackfill).toContain('tl.tenant_uuid IS NULL');
            expect(leadBackfill).toContain('ak.active = true');
            expect(leadBackfill).toContain('ak.tenant_id IS NOT NULL');
        });
    });
});
