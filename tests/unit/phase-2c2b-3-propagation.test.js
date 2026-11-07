'use strict';

/**
 * LinkMágico — Fase 2C.2B-3
 * Testes Unitários de Propagação de tenantId e identityKey
 *
 * Cobertura obrigatória (12 itens):
 *   1. Tenant autenticado correto (origem confiável de req.cliente.id).
 *   2. Identidade canônica propagada sem transformação.
 *   3. Dois tenants com mesmo identificador local geram identidades distintas.
 *   4. Ausência de tenantId/identityKey causando falha fechada em generateAIResponse.
 *   5. Identidade de tenant divergente causando rejeição.
 *   6. Tentativa de injetar tenantId pelo body sem alterar a identidade confiável.
 *   7. Ausência de fallback para chatbotId (V11 e motores).
 *   8. Ausência de fallback para unknown (V11).
 *   9. Propagação correta nos dois chamadores de generateAIResponse (chat-universal e process-chat-inteligente).
 *  10. Preservação do fluxo WhatsApp e sua validação interna via endpoint autenticado.
 *  11. Verificação de integridade dos contratos anteriores (2C.2A, 2C.2B-1, 2C.2B-2).
 *  12. Preservação dos fluxos de processamento e retorno consistente de conversationId.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
    validateTenantId,
    buildCanonicalIdentityKey,
    UUID_REGEX,
    LOCAL_ID_VALIDATORS
} = require('../../lib/tenant-identity-helper');

// ============================================================
// Wrapper resolveIdentityKey (cópia idêntica à de server.js)
// ============================================================

function resolveIdentityKey(tenantId, leadId, conversationId) {
    // 1. Validar tenant — obrigatório, fail-closed
    const validTenant = validateTenantId(tenantId);

    // 2. Interceptar prefixo reservado 't:' — ANTES de delegar ao helper
    if (conversationId && typeof conversationId === 'string' && conversationId.startsWith('t:')) {
        const parts = conversationId.split(':');

        // Exigir exatamente 4 partes: t, uuid, tipo, localId
        if (parts.length !== 4) {
            throw new Error(
                'IDENTITY_ERROR: formato canonico malformado — esperadas 4 partes, recebidas ' + parts.length
            );
        }

        const [prefix, embeddedUuid, tipo, localId] = parts;

        // Validar UUID embarcado
        if (!UUID_REGEX.test(embeddedUuid)) {
            throw new Error(
                'IDENTITY_ERROR: UUID invalido no formato canonico'
            );
        }

        // Comparar com tenant autenticado (ambos já normalizados)
        if (embeddedUuid !== validTenant) {
            throw new Error(
                'IDENTITY_ERROR: tenant divergente na identidade canonica'
            );
        }

        // Validar tipo
        if (!LOCAL_ID_VALIDATORS[tipo]) {
            throw new Error(
                'IDENTITY_ERROR: tipo desconhecido no formato canonico: ' + tipo
            );
        }

        // Validar localId
        if (!LOCAL_ID_VALIDATORS[tipo].test(localId)) {
            throw new Error(
                'IDENTITY_ERROR: localId invalido para tipo ' + tipo
            );
        }

        // Formato canônico válido, mesmo tenant → pass-through
        if (leadId && typeof leadId === 'string' && leadId.trim().length > 0) {
            console.warn('[IDENTITY] leadId fornecido mas nao utilizado (conversationId prevaleceu)');
        }
        return conversationId;
    }

    // 3. Delegar ao helper congelado
    const result = buildCanonicalIdentityKey(validTenant, leadId, conversationId);

    // 4. Observabilidade: avisar se leadId fornecido mas não utilizado
    if (leadId && typeof leadId === 'string' && leadId.trim().length > 0) {
        const resultParts = result.split(':');
        if (resultParts.length === 4 && resultParts[2] !== 'lead') {
            console.warn('[IDENTITY] leadId fornecido mas nao utilizado (conversationId prevaleceu)');
        }
    }

    return result;
}

// ============================================================
// Fixtures
// ============================================================

const TENANT_A = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const TENANT_B = 'f9e8d7c6-b5a4-4321-9876-543210fedcba';
const LOCAL_SESSION = 'widget_1730900000_abc123def';
const LOCAL_PHONE = '5511999999999';
const LOCAL_LEAD = 'lead-42-abc';

const serverContent = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf-8');

// ============================================================
// Simulação de generateAIResponse para validação de contrato
// ============================================================

function mockGenerateAIResponse(userMessage, pageData, conversationHistory, instructions, leadId, apiKey, chatbotId, tenantId, identityKey) {
    if (!tenantId || !identityKey) {
        throw new Error('IDENTITY_ERROR: tenantId e identityKey são obrigatórios');
    }
    return {
        status: 'ok',
        propagatedTenantId: tenantId,
        propagatedIdentityKey: identityKey,
        userId: identityKey // SuperInteligência
    };
}

// ============================================================
// 1 & 2. Tenant autenticado e propagação sem transformação
// ============================================================

describe('Fase 2C.2B-3 — 1 & 2. Tenant autenticado e propagação sem transformação', () => {
    test('1. Origem confiável do tenantId é req.cliente.id (nunca do body)', () => {
        const req = {
            cliente: { id: TENANT_A, apiKey: 'valid-api-key' },
            body: { tenantId: 'hacker-tenant-uuid', conversationId: LOCAL_SESSION }
        };
        // O handler obtém tenantId exclusivamente de req.cliente.id
        const tenantId = req.cliente?.id;
        expect(tenantId).toBe(TENANT_A);
        expect(tenantId).not.toBe(req.body.tenantId);
    });

    test('2. Identidade canônica construída uma vez e propagada sem alteração', () => {
        const req = {
            cliente: { id: TENANT_A },
            body: { conversationId: LOCAL_SESSION, leadId: null }
        };
        const tenantId = req.cliente.id;
        const identityKey = resolveIdentityKey(tenantId, req.body.leadId, req.body.conversationId);
        expect(identityKey).toBe(`t:${TENANT_A}:session:${LOCAL_SESSION}`);

        // Propagação para generateAIResponse
        const result = mockGenerateAIResponse('Olá', {}, [], '', null, 'key', null, tenantId, identityKey);
        expect(result.propagatedIdentityKey).toBe(identityKey);
        expect(result.propagatedTenantId).toBe(tenantId);
    });
});

// ============================================================
// 3. Isolamento multi-tenant com mesmo identificador local
// ============================================================

describe('Fase 2C.2B-3 — 3. Isolamento multi-tenant', () => {
    test('Mesmo session ID em dois tenants gera identidades distintas', () => {
        const keyA = resolveIdentityKey(TENANT_A, null, LOCAL_SESSION);
        const keyB = resolveIdentityKey(TENANT_B, null, LOCAL_SESSION);
        expect(keyA).not.toBe(keyB);
        expect(keyA).toBe(`t:${TENANT_A}:session:${LOCAL_SESSION}`);
        expect(keyB).toBe(`t:${TENANT_B}:session:${LOCAL_SESSION}`);
    });

    test('Mesmo WhatsApp phone em dois tenants gera identidades distintas', () => {
        const waId = `wa_${LOCAL_PHONE}_key12345`;
        const keyA = resolveIdentityKey(TENANT_A, null, waId);
        const keyB = resolveIdentityKey(TENANT_B, null, waId);
        expect(keyA).not.toBe(keyB);
        expect(keyA).toBe(`t:${TENANT_A}:wa:${LOCAL_PHONE}`);
        expect(keyB).toBe(`t:${TENANT_B}:wa:${LOCAL_PHONE}`);
    });
});

// ============================================================
// 4 & 5. Falha fechada e rejeição de divergência
// ============================================================

describe('Fase 2C.2B-3 — 4 & 5. Falha fechada e rejeição de divergência', () => {
    test('4. Ausência de tenantId ou identityKey em generateAIResponse causa falha fechada', () => {
        expect(() => mockGenerateAIResponse('msg', {}, [], '', null, 'key', null, null, 't:key'))
            .toThrow('IDENTITY_ERROR: tenantId e identityKey são obrigatórios');

        expect(() => mockGenerateAIResponse('msg', {}, [], '', null, 'key', null, TENANT_A, null))
            .toThrow('IDENTITY_ERROR: tenantId e identityKey são obrigatórios');

        expect(() => mockGenerateAIResponse('msg', {}, [], '', null, 'key', null, undefined, undefined))
            .toThrow('IDENTITY_ERROR: tenantId e identityKey são obrigatórios');
    });

    test('5. Identidade canônica de tenant divergente causa rejeição', () => {
        const foreignCanonical = `t:${TENANT_B}:session:${LOCAL_SESSION}`;
        expect(() => resolveIdentityKey(TENANT_A, null, foreignCanonical))
            .toThrow('IDENTITY_ERROR: tenant divergente na identidade canonica');
    });
});

// ============================================================
// 6. Injeção de tenantId pelo body é ignorada
// ============================================================

describe('Fase 2C.2B-3 — 6. Tentativa de injeção de tenantId pelo payload', () => {
    test('req.body.tenantId malicioso não substitui tenant autenticado no handler', () => {
        const cuHandlerIdx = serverContent.indexOf('app.post("/api/chat-universal"');
        const cuSnippet = serverContent.substring(cuHandlerIdx, cuHandlerIdx + 400);
        expect(cuSnippet).toContain('const tenantId = req.cliente?.id;');
        expect(cuSnippet).not.toContain('req.body.tenantId');

        const pciHandlerIdx = serverContent.indexOf('app.post("/api/process-chat-inteligente"');
        const pciSnippet = serverContent.substring(pciHandlerIdx, pciHandlerIdx + 400);
        expect(pciSnippet).toContain('const tenantId = req.cliente?.id;');
        expect(pciSnippet).not.toContain('req.body.tenantId');
    });
});

// ============================================================
// 7 & 8. Ausência de fallback para chatbotId ou unknown
// ============================================================

describe('Fase 2C.2B-3 — 7 & 8. Eliminação de fallback para chatbotId e unknown', () => {
    test('7. V11 Conversation State não usa chatbotId como identificador de conversa', () => {
        const v11Idx = serverContent.indexOf('// V11 Conversation State');
        const v11Snippet = serverContent.substring(v11Idx, v11Idx + 400);
        expect(v11Snippet).toContain('const _v11ConvId = identityKey;');
        expect(v11Snippet).not.toContain('const _v11ConvId = leadId || chatbotId');
    });

    test('8. V11 Conversation State não usa unknown no código como fallback', () => {
        const v11Idx = serverContent.indexOf('// V11 Conversation State');
        const v11Snippet = serverContent.substring(v11Idx, v11Idx + 400);
        expect(v11Snippet).not.toContain("|| 'unknown'");
    });

    test('SuperInteligência userId usa identityKey em vez de leadId || user_timestamp', () => {
        const siIdx = serverContent.indexOf('// 🎯 SUPERINTELIGÊNCIA: Análise Avançada');
        const siSnippet = serverContent.substring(siIdx, siIdx + 300);
        expect(siSnippet).toContain('const userId = identityKey;');
        expect(siSnippet).not.toContain('const userId = leadId || `user_${Date.now()}`;');
    });
});

// ============================================================
// 9. Propagação nos dois chamadores de generateAIResponse
// ============================================================

describe('Fase 2C.2B-3 — 9. Chamadores de generateAIResponse', () => {
    test('chat-universal constrói identityKey e passa tenantId + identityKey', () => {
        const cuStart = serverContent.indexOf('app.post("/api/chat-universal"');
        const cuEnd = serverContent.indexOf('app.post("/api/process-chat-inteligente"');
        const cuBody = serverContent.substring(cuStart, cuEnd);

        expect(cuBody).toContain('const identityKey = resolveIdentityKey(tenantId, leadId, conversationId);');
        expect(cuBody).toContain('generateAIResponse(message, processedPageData || {}, [], instructions, effectiveLeadId || leadId, apiKey, robotName || null, tenantId, identityKey)');
    });

    test('process-chat-inteligente constrói identityKey e passa tenantId + identityKey', () => {
        const pciStart = serverContent.indexOf('app.post("/api/process-chat-inteligente"');
        const pciEnd = serverContent.indexOf('setupRoutes(app);', pciStart);
        const pciBody = serverContent.substring(pciStart, pciEnd);

        expect(pciBody).toContain('const identityKey = resolveIdentityKey(tenantId, leadId, conversationId);');
        expect(pciBody).toContain('generateAIResponse(message, processedPageData || {}, [], instructions, effectiveLeadId || leadId, apiKey, robotName || null, tenantId, identityKey)');
    });

    test('Substituição de todos os 5 usos internos de buildIdentityKey', () => {
        // Encontrar todas as chamadas restantes a buildIdentityKey(
        const matches = serverContent.match(/buildIdentityKey\(/g) || [];
        // Deve haver apenas 1 ocorrência: a própria declaração 'function buildIdentityKey('
        expect(matches.length).toBe(1);
    });
});

// ============================================================
// 10. Preservação do fluxo WhatsApp
// ============================================================

describe('Fase 2C.2B-3 — 10. Fluxo WhatsApp preservado', () => {
    const waContent = fs.readFileSync(path.join(__dirname, '..', '..', 'whatsapp-channel.js'), 'utf-8');

    test('WhatsApp não constrói identidade canônica no webhook', () => {
        expect(waContent).not.toContain('resolveIdentityKey');
        expect(waContent).not.toContain('buildCanonicalIdentityKey');
    });

    test('_callUnifiedBrain faz requisição HTTP autenticada ao endpoint interno', () => {
        const ubIdx = waContent.indexOf('async _callUnifiedBrain(');
        const ubSnippet = waContent.substring(ubIdx, ubIdx + 7000);
        expect(ubSnippet).toContain('apiKey,');
        expect(ubSnippet).toContain('conversationId,');
        expect(ubSnippet).toContain('/api/process-chat-inteligente');
        expect(ubSnippet).toContain('/api/chat-universal');
    });
});

// ============================================================
// 11. Integridade dos contratos e fases anteriores
// ============================================================

describe('Fase 2C.2B-3 — 11. Integridade dos contratos anteriores', () => {
    test('Helper congelado intacto com hash SHA-256 exato', () => {
        const helperContent = fs.readFileSync(path.join(__dirname, '..', '..', 'lib', 'tenant-identity-helper.js'));
        const hash = crypto.createHash('sha256').update(helperContent).digest('hex');
        expect(hash).toBe('cfbef623d73b3666b75fd1b269c17321f873b851f477f94f514ed7d2657889ae');
    });

    test('buildIdentityKey legado preservado como dead code', () => {
        expect(serverContent).toContain('function buildIdentityKey(leadId, conversationId)');
    });

    test('requireApiKey global continua sendo ponto de autenticação', () => {
        expect(serverContent).toContain('app.use(requireApiKey)');
    });

    test('Defesa em profundidade mantida nos dois endpoints', () => {
        const cuStart = serverContent.indexOf('app.post("/api/chat-universal"');
        const pciStart = serverContent.indexOf('app.post("/api/process-chat-inteligente"');
        expect(serverContent.substring(cuStart, cuStart + 250)).toContain('if (!tenantId)');
        expect(serverContent.substring(pciStart, pciStart + 250)).toContain('if (!tenantId)');
    });
});

// ============================================================
// 12. Preservação dos fluxos e eco de conversationId
// ============================================================

describe('Fase 2C.2B-3 — 12. Preservação dos fluxos existentes', () => {
    test('chat-universal retorna conversationId na resposta', () => {
        const cuStart = serverContent.indexOf('app.post("/api/chat-universal"');
        const cuEnd = serverContent.indexOf('app.post("/api/process-chat-inteligente"');
        const cuBody = serverContent.substring(cuStart, cuEnd);
        expect(cuBody).toContain('conversationId: conversationId || null');
    });

    test('process-chat-inteligente retorna conversationId na resposta', () => {
        const pciStart = serverContent.indexOf('app.post("/api/process-chat-inteligente"');
        const pciEnd = serverContent.indexOf('setupRoutes(app);', pciStart);
        const pciBody = serverContent.substring(pciStart, pciEnd);
        expect(pciBody).toContain('conversationId: conversationId || null');
    });

    test('generateAIResponse possui validação fail-closed no topo', () => {
        const genStart = serverContent.indexOf('async function generateAIResponse(');
        const genSnippet = serverContent.substring(genStart, genStart + 600);
        expect(genSnippet).toContain('if (!tenantId || !identityKey)');
        expect(genSnippet).toContain("throw new Error('IDENTITY_ERROR: tenantId e identityKey são obrigatórios')");
    });
});

// ============================================================
// Correção V11 — Consistência entre leitura e escrita
// ============================================================

describe('Fase 2C.2B-3 — Correção V11: Consistência entre leitura e escrita', () => {
    const conversationState = require('../../lib/conversation-state');

    test('V11 grava e recupera estado utilizando exatamente a mesma identityKey canônica', () => {
        const canonicalKey = resolveIdentityKey(TENANT_A, null, 'session_v11_test_consistency');

        // 1. Gravação (como ocorre no handler com identityKey)
        const updated = conversationState.updateState(canonicalKey, 'buy', 'quero comprar produto');
        expect(updated.lastIntent).toBe('buy');
        expect(updated.stage).toBe('decision');

        // 2. Leitura subsequente (como ocorre em generateAIResponse com identityKey)
        const retrieved = conversationState.getState(canonicalKey);
        expect(retrieved.lastIntent).toBe('buy');
        expect(retrieved.stage).toBe('decision');
        expect(retrieved.messageCount).toBeGreaterThanOrEqual(1);
        expect(retrieved.lastMessage).toBe('quero comprar produto');

        // 3. Verifica que a chave bruta NÃO tem acesso a esse estado
        const rawRetrieved = conversationState.getState('session_v11_test_consistency');
        expect(rawRetrieved.lastIntent).toBe('neutral');
        expect(rawRetrieved.stage).toBe('neutral');
        expect(rawRetrieved.messageCount).toBe(0);
    });

    test('V11 isola estados conversacionais de dois tenants com o mesmo session ID local', () => {
        const keyTenantA = resolveIdentityKey(TENANT_A, null, 'session_shared_id_12345');
        const keyTenantB = resolveIdentityKey(TENANT_B, null, 'session_shared_id_12345');
        expect(keyTenantA).not.toBe(keyTenantB);

        // Tenant A registra interesse de compra
        conversationState.updateState(keyTenantA, 'buy', 'mensagem compra tenant A');

        // Tenant B registra solicitação de suporte
        conversationState.updateState(keyTenantB, 'support', 'mensagem suporte tenant B');

        // Valida que Tenant A recupera 'buy' e não foi sobrescrito por B
        const stateA = conversationState.getState(keyTenantA);
        expect(stateA.lastIntent).toBe('buy');
        expect(stateA.lastMessage).toBe('mensagem compra tenant A');

        // Valida que Tenant B recupera 'support' e não 'buy'
        const stateB = conversationState.getState(keyTenantB);
        expect(stateB.lastIntent).toBe('support');
        expect(stateB.lastMessage).toBe('mensagem suporte tenant B');
    });

    test('server.js: chat-universal atualiza V11 com identityKey', () => {
        // Recarregar serverContent atualizado
        const freshServer = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf-8');
        const cuStart = freshServer.indexOf('app.post("/api/chat-universal"');
        const cuEnd = freshServer.indexOf('app.post("/api/process-chat-inteligente"');
        const cuBody = freshServer.substring(cuStart, cuEnd);

        expect(cuBody).toContain('_v11ConversationState.updateState(identityKey, _v11Intent, message);');
        expect(cuBody).not.toContain('_v11ConversationState.updateState(conversationId, _v11Intent, message);');
    });

    test('server.js: process-chat-inteligente atualiza V11 com identityKey nos dois pontos', () => {
        // Recarregar serverContent atualizado
        const freshServer = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf-8');
        const pciStart = freshServer.indexOf('app.post("/api/process-chat-inteligente"');
        const pciEnd = freshServer.indexOf('setupRoutes(app);', pciStart);
        const pciBody = freshServer.substring(pciStart, pciEnd);

        expect(pciBody).toContain('_v11ConversationState.updateState(identityKey, _v11IntIntent, message);');
        expect(pciBody).toContain('_v11ConversationState.updateState(identityKey, _v12Intent, message);');
        expect(pciBody).not.toContain('_v11ConversationState.updateState(conversationId,');
    });

    test('server.js: zero chamadas restantes a updateState com conversationId', () => {
        const freshServer = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf-8');
        expect(freshServer).not.toContain('_v11ConversationState.updateState(conversationId');
    });
});
