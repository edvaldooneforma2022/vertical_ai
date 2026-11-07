'use strict';

/**
 * LinkMágico — Fase 2C.2B-2
 * Testes do Wrapper resolveIdentityKey
 *
 * 16 cenários obrigatórios:
 *   A. Construção e precedência (4)
 *   B. Proteção contra dupla transformação (4)
 *   C. Interceptação de t: malformado (2)
 *   D. Validação e fail-closed (3)
 *   E. Isolamento entre tenants (2)
 *   F. Exclusão de chatbotId (1)
 *
 * Framework: Jest (disponível localmente)
 */

// ============================================================
// Importar o wrapper diretamente de server.js não é viável
// (server.js inicializa Express, banco, etc.).
// Estratégia: recriar a função usando os MESMOS exports do helper
// congelado e verificar que o comportamento é idêntico ao código
// inserido em server.js. Também validar o código-fonte estático.
// ============================================================

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const {
    buildCanonicalIdentityKey,
    validateTenantId,
    UUID_REGEX,
    LOCAL_ID_VALIDATORS,
} = require('../../lib/tenant-identity-helper');

// ============================================================
// Reprodução fiel do wrapper (cópia exata da lógica em server.js)
// para teste unitário isolado, sem carregar server.js inteiro.
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
        // Verificar se o resultado usou tipo 'lead' comparando com o formato esperado
        // O helper retorna t:<uuid>:lead:<id> quando usa leadId
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

const UUID_A = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const UUID_B = 'f9e8d7c6-b5a4-4321-9876-543210fedcba';

// ============================================================
// Grupo A: Construção e precedência (4 testes)
// ============================================================

describe('Fase 2C.2B-2 — A. Construção e precedência', () => {
    test('1. WhatsApp via conversationId legado', () => {
        const result = resolveIdentityKey(UUID_A, null, 'wa_5511999999999_abc12345');
        expect(result).toBe(`t:${UUID_A}:wa:5511999999999`);
    });

    test('2. Session via conversationId não-legado', () => {
        const result = resolveIdentityKey(UUID_A, null, 'widget_1730900000_abc123def');
        expect(result).toBe(`t:${UUID_A}:session:widget_1730900000_abc123def`);
    });

    test('3. Lead via leadId (sem conversationId)', () => {
        const result = resolveIdentityKey(UUID_A, 'lead-42-abc', null);
        expect(result).toBe(`t:${UUID_A}:lead:lead-42-abc`);
    });

    test('4. conversationId tem precedência sobre leadId', () => {
        const result = resolveIdentityKey(UUID_A, 'lead-99', 'wa_5511888888888_xyz');
        expect(result).toBe(`t:${UUID_A}:wa:5511888888888`);
    });
});

// ============================================================
// Grupo B: Proteção contra dupla transformação (4 testes)
// ============================================================

describe('Fase 2C.2B-2 — B. Proteção contra dupla transformação', () => {
    test('5. Identidade canônica do mesmo tenant → pass-through', () => {
        const canonical = `t:${UUID_A}:session:abc12345`;
        const result = resolveIdentityKey(UUID_A, null, canonical);
        expect(result).toBe(canonical);
    });

    test('5a. Identidade canônica válida do mesmo tenant + leadId não vazio: retorna a identidade original e emite um aviso', () => {
        const canonical = `t:${UUID_A}:session:abc12345`;
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const result = resolveIdentityKey(UUID_A, 'lead-42', canonical);
        expect(result).toBe(canonical);
        expect(warnSpy).toHaveBeenCalledWith('[IDENTITY] leadId fornecido mas nao utilizado (conversationId prevaleceu)');
        warnSpy.mockRestore();
    });

    test('5b. Identidade canônica válida + leadId null ou vazio: retorna a identidade original sem emitir aviso', () => {
        const canonical = `t:${UUID_A}:session:abc12345`;
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const result1 = resolveIdentityKey(UUID_A, null, canonical);
        const result2 = resolveIdentityKey(UUID_A, '', canonical);
        const result3 = resolveIdentityKey(UUID_A, '   ', canonical);
        expect(result1).toBe(canonical);
        expect(result2).toBe(canonical);
        expect(result3).toBe(canonical);
        expect(warnSpy).not.toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    test('6. Identidade canônica de tenant diferente → erro', () => {
        const canonical = `t:${UUID_B}:session:abc12345`;
        expect(() => resolveIdentityKey(UUID_A, null, canonical))
            .toThrow('IDENTITY_ERROR: tenant divergente na identidade canonica');
    });

    test('7. Formato canônico malformado (UUID inválido) → erro', () => {
        expect(() => resolveIdentityKey(UUID_A, null, 't:not-a-valid-uuid:session:abc12345'))
            .toThrow('IDENTITY_ERROR: UUID invalido no formato canonico');
    });

    test('8. Formato canônico malformado (tipo inválido) → erro', () => {
        expect(() => resolveIdentityKey(UUID_A, null, `t:${UUID_A}:chatbot:abc12345`))
            .toThrow('IDENTITY_ERROR: tipo desconhecido no formato canonico');
    });
});

// ============================================================
// Grupo C: Interceptação de t: malformado — Ressalva 1 (2 testes)
// ============================================================

describe('Fase 2C.2B-2 — C. Interceptação de t: malformado (Ressalva 1)', () => {
    test('9. Partes excedentes (t:uuid:session:abc:extra) → erro, NÃO cai no leadId', () => {
        const malformed = `t:${UUID_A}:session:abc12345:extra`;
        // Sem o wrapper, o helper usaria leadId como fallback.
        // O wrapper DEVE interceptar e rejeitar.
        expect(() => resolveIdentityKey(UUID_A, 'lead-42', malformed))
            .toThrow('IDENTITY_ERROR: formato canonico malformado');
    });

    test('10. Partes insuficientes (t:uuid:session) → erro, NÃO cai no leadId', () => {
        const malformed = `t:${UUID_A}:session`;
        expect(() => resolveIdentityKey(UUID_A, 'lead-42', malformed))
            .toThrow('IDENTITY_ERROR: formato canonico malformado');
    });
});

// ============================================================
// Grupo D: Validação e fail-closed (3 testes)
// ============================================================

describe('Fase 2C.2B-2 — D. Validação e fail-closed', () => {
    test('11. tenantId ausente → erro', () => {
        expect(() => resolveIdentityKey(null, 'lead-42', 'session_abc12345'))
            .toThrow('IDENTITY_ERROR: tenantId ausente');
    });

    test('12. tenantId não-UUID → erro', () => {
        expect(() => resolveIdentityKey('apikey123', 'lead-42', 'session_abc12345'))
            .toThrow('IDENTITY_ERROR: tenantId nao e UUID');
    });

    test('13. Nenhuma identidade local → erro', () => {
        expect(() => resolveIdentityKey(UUID_A, null, null))
            .toThrow('IDENTITY_ERROR: impossivel determinar identidade local');
    });
});

// ============================================================
// Grupo E: Isolamento entre tenants (2 testes)
// ============================================================

describe('Fase 2C.2B-2 — E. Isolamento entre tenants', () => {
    test('14. Mesmo leadId em dois tenants → chaves diferentes', () => {
        const keyA = resolveIdentityKey(UUID_A, 'lead-42', null);
        const keyB = resolveIdentityKey(UUID_B, 'lead-42', null);
        expect(keyA).not.toBe(keyB);
        expect(keyA).toContain(UUID_A);
        expect(keyB).toContain(UUID_B);
    });

    test('15. Mesmo conversationId em dois tenants → chaves diferentes', () => {
        const keyA = resolveIdentityKey(UUID_A, null, 'session_abc12345');
        const keyB = resolveIdentityKey(UUID_B, null, 'session_abc12345');
        expect(keyA).not.toBe(keyB);
        expect(keyA).toContain(UUID_A);
        expect(keyB).toContain(UUID_B);
    });
});

// ============================================================
// Grupo F: Exclusão de chatbotId (1 teste)
// ============================================================

describe('Fase 2C.2B-2 — F. Exclusão de chatbotId', () => {
    test('16. chatbotId não é parâmetro do wrapper', () => {
        expect(resolveIdentityKey.length).toBe(3);
    });
});

// ============================================================
// Verificações estáticas de server.js (código-fonte)
// ============================================================

describe('Fase 2C.2B-2 — Verificações estáticas de server.js', () => {
    const serverContent = fs.readFileSync(
        path.join(__dirname, '..', '..', 'server.js'), 'utf-8'
    );

    test('server.js contém resolveIdentityKey com assinatura correta', () => {
        expect(serverContent).toContain(
            'function resolveIdentityKey(tenantId, leadId, conversationId)'
        );
    });

    test('server.js importa o helper congelado', () => {
        expect(serverContent).toContain("require('./lib/tenant-identity-helper')");
    });

    test('server.js importa buildCanonicalIdentityKey', () => {
        expect(serverContent).toContain('buildCanonicalIdentityKey');
    });

    test('server.js importa validateTenantId', () => {
        expect(serverContent).toContain('validateTenantId');
    });

    test('server.js importa UUID_REGEX e LOCAL_ID_VALIDATORS', () => {
        expect(serverContent).toContain('UUID_REGEX');
        expect(serverContent).toContain('LOCAL_ID_VALIDATORS');
    });

    test('resolveIdentityKey NÃO aceita chatbotId', () => {
        // Extrair a função do server.js
        const fnStart = serverContent.indexOf('function resolveIdentityKey(');
        const fnSignature = serverContent.substring(fnStart, fnStart + 200);
        expect(fnSignature).not.toContain('chatbotId');
    });

    test('resolveIdentityKey intercepta prefixo t: antes do helper', () => {
        const fnStart = serverContent.indexOf('function resolveIdentityKey(');
        const fnBody = serverContent.substring(fnStart, fnStart + 2000);
        const tPrefixIdx = fnBody.indexOf("startsWith('t:')");
        const delegateIdx = fnBody.indexOf('buildCanonicalIdentityKey(');
        expect(tPrefixIdx).toBeGreaterThan(-1);
        expect(delegateIdx).toBeGreaterThan(-1);
        expect(tPrefixIdx).toBeLessThan(delegateIdx);
    });

    test('buildIdentityKey legado permanece inalterado', () => {
        expect(serverContent).toContain('function buildIdentityKey(leadId, conversationId)');
    });

    test('generateAIResponse contém assinatura com parâmetros da Fase 2C.2B-3', () => {
        expect(serverContent).toContain(
            'async function generateAIResponse(userMessage, pageData = {}, conversationHistory = [], instructions = "", leadId = null, apiKey = null, chatbotId = null, tenantId, identityKey)'
        );
    });

    test('helper congelado com hash correto', () => {
        const helperContent = fs.readFileSync(
            path.join(__dirname, '..', '..', 'lib', 'tenant-identity-helper.js')
        );
        const hash = crypto.createHash('sha256').update(helperContent).digest('hex');
        expect(hash).toBe('cfbef623d73b3666b75fd1b269c17321f873b851f477f94f514ed7d2657889ae');
    });

    test('Lógica do wrapper em server.js é idêntica à cópia de teste', () => {
        // Extrair o corpo da função de server.js
        const fnStart = serverContent.indexOf('function resolveIdentityKey(tenantId, leadId, conversationId) {');
        // Encontrar o fechamento da função (procurar o console.log que segue)
        const fnEnd = serverContent.indexOf("console.log('✅ [FASE 2C.2B-2]", fnStart);
        const serverFn = serverContent.substring(fnStart, fnEnd).trim();

        // Ler este arquivo de teste e extrair a cópia
        const testContent = fs.readFileSync(__filename, 'utf-8');
        const testFnStart = testContent.indexOf('function resolveIdentityKey(tenantId, leadId, conversationId) {');
        const testFnEnd = testContent.indexOf('\n// ============================================================\n// Fixtures', testFnStart);
        const testFn = testContent.substring(testFnStart, testFnEnd).trim();

        // Normalizar line endings para comparação
        const normalize = (s) => s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        expect(normalize(serverFn)).toBe(normalize(testFn));
    });
});
