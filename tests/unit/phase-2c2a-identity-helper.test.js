'use strict';

/**
 * LinkMágico — Fase 2C.2A
 * Testes Unitários do Helper Canônico de Identidade Multi-Tenant
 *
 * Cobertura obrigatória:
 *   A. Isolamento entre tenants
 *   B. Determinismo
 *   C. Validação
 *   D. Precedência
 *   E. Segurança
 */

const {
  buildCanonicalIdentityKey,
  buildWhatsAppIdentityKey,
  validateTenantId,
  classifyLegacyId,
  UUID_REGEX,
  LEGACY_WA_REGEX,
  LEGACY_SESSION_REGEX,
  LEGACY_LEAD_REGEX,
  LOCAL_ID_VALIDATORS,
} = require('../../lib/tenant-identity-helper');

// ============================================================
// Fixtures
// ============================================================

const TENANT_A = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const TENANT_B = 'f9e8d7c6-b5a4-4321-9876-543210fedcba';
const INVALID_UUID = 'not-a-valid-uuid';
const API_KEY_V2 = 'lm_live_4a1b2c3d4e5f6789abcdef0123456789';
const PHONE_BR = '5511999999999';
const PHONE_US = '12025551234';
const SESSION_ID = '1730900000_abc123';
const LEAD_ID = 'lead-42-abc';

// ============================================================
// A. ISOLAMENTO ENTRE TENANTS
// ============================================================

describe('Fase 2C.2A — A. Isolamento entre Tenants', () => {
  test('Mesmo telefone em dois tenants diferentes gera identidades diferentes', () => {
    const keyA = buildWhatsAppIdentityKey(TENANT_A, PHONE_BR);
    const keyB = buildWhatsAppIdentityKey(TENANT_B, PHONE_BR);

    expect(keyA).not.toBe(keyB);
    expect(keyA).toBe(`t:${TENANT_A}:wa:${PHONE_BR}`);
    expect(keyB).toBe(`t:${TENANT_B}:wa:${PHONE_BR}`);
  });

  test('Mesmo session ID em dois tenants diferentes gera identidades diferentes', () => {
    const keyA = buildCanonicalIdentityKey(TENANT_A, null, `session_${SESSION_ID}`);
    const keyB = buildCanonicalIdentityKey(TENANT_B, null, `session_${SESSION_ID}`);

    expect(keyA).not.toBe(keyB);
    expect(keyA).toBe(`t:${TENANT_A}:session:${SESSION_ID}`);
    expect(keyB).toBe(`t:${TENANT_B}:session:${SESSION_ID}`);
  });

  test('Mesmo lead ID em dois tenants diferentes gera identidades diferentes', () => {
    const keyA = buildCanonicalIdentityKey(TENANT_A, LEAD_ID, null);
    const keyB = buildCanonicalIdentityKey(TENANT_B, LEAD_ID, null);

    expect(keyA).not.toBe(keyB);
    expect(keyA).toBe(`t:${TENANT_A}:lead:${LEAD_ID}`);
    expect(keyB).toBe(`t:${TENANT_B}:lead:${LEAD_ID}`);
  });

  test('Identidades de diferentes tipos no mesmo tenant sao diferentes', () => {
    const waKey = buildWhatsAppIdentityKey(TENANT_A, PHONE_BR);
    const sessKey = buildCanonicalIdentityKey(TENANT_A, null, `session_${SESSION_ID}`);
    const leadKey = buildCanonicalIdentityKey(TENANT_A, LEAD_ID, null);

    expect(waKey).not.toBe(sessKey);
    expect(waKey).not.toBe(leadKey);
    expect(sessKey).not.toBe(leadKey);
  });

  test('Formato legado WhatsApp com mesma API Key mas tenants diferentes gera identidades diferentes', () => {
    // Simula o cenário de colisão 100% da V2: wa_<phone>_lm_live_
    const legacyConvId = `wa_${PHONE_BR}_lm_live_`;
    const keyA = buildCanonicalIdentityKey(TENANT_A, null, legacyConvId);
    const keyB = buildCanonicalIdentityKey(TENANT_B, null, legacyConvId);

    expect(keyA).not.toBe(keyB);
    // Ambos extraem o mesmo telefone, mas o tenant diferencia
    expect(keyA).toBe(`t:${TENANT_A}:wa:${PHONE_BR}`);
    expect(keyB).toBe(`t:${TENANT_B}:wa:${PHONE_BR}`);
  });
});

// ============================================================
// B. DETERMINISMO
// ============================================================

describe('Fase 2C.2A — B. Determinismo', () => {
  test('Mesmas entradas produzem a mesma identidade (WhatsApp)', () => {
    const key1 = buildWhatsAppIdentityKey(TENANT_A, PHONE_BR);
    const key2 = buildWhatsAppIdentityKey(TENANT_A, PHONE_BR);
    const key3 = buildWhatsAppIdentityKey(TENANT_A, PHONE_BR);

    expect(key1).toBe(key2);
    expect(key2).toBe(key3);
  });

  test('Mesmas entradas produzem a mesma identidade (Session)', () => {
    const convId = `session_${SESSION_ID}`;
    const key1 = buildCanonicalIdentityKey(TENANT_A, null, convId);
    const key2 = buildCanonicalIdentityKey(TENANT_A, null, convId);

    expect(key1).toBe(key2);
  });

  test('Mesmas entradas produzem a mesma identidade (Lead)', () => {
    const key1 = buildCanonicalIdentityKey(TENANT_A, LEAD_ID, null);
    const key2 = buildCanonicalIdentityKey(TENANT_A, LEAD_ID, null);

    expect(key1).toBe(key2);
  });

  test('Nenhuma dependencia de horario ou aleatoriedade', () => {
    // Executar 100 vezes e confirmar que o resultado é sempre idêntico
    const expected = buildWhatsAppIdentityKey(TENANT_A, PHONE_BR);
    for (let i = 0; i < 100; i++) {
      expect(buildWhatsAppIdentityKey(TENANT_A, PHONE_BR)).toBe(expected);
    }
  });

  test('UUID em maiusculas e normalizado para minusculas', () => {
    const upper = TENANT_A.toUpperCase();
    const key1 = buildCanonicalIdentityKey(upper, LEAD_ID, null);
    const key2 = buildCanonicalIdentityKey(TENANT_A, LEAD_ID, null);

    expect(key1).toBe(key2);
  });

  test('UUID com espacos e aparado corretamente', () => {
    const padded = `  ${TENANT_A}  `;
    const key1 = buildCanonicalIdentityKey(padded, LEAD_ID, null);
    const key2 = buildCanonicalIdentityKey(TENANT_A, LEAD_ID, null);

    expect(key1).toBe(key2);
  });
});

// ============================================================
// C. VALIDAÇÃO
// ============================================================

describe('Fase 2C.2A — C. Validacao', () => {
  // C.1 Tenant UUID
  describe('C.1 — Validacao de UUID', () => {
    test('UUID v4 valido e aceito', () => {
      expect(() => validateTenantId(TENANT_A)).not.toThrow();
      expect(validateTenantId(TENANT_A)).toBe(TENANT_A);
    });

    test('UUID v4 em maiusculas e normalizado', () => {
      expect(validateTenantId(TENANT_A.toUpperCase())).toBe(TENANT_A);
    });

    test('UUID invalido lanca erro', () => {
      expect(() => validateTenantId(INVALID_UUID)).toThrow('IDENTITY_ERROR');
    });

    test('Tenant ausente (undefined) lanca erro', () => {
      expect(() => validateTenantId(undefined)).toThrow('IDENTITY_ERROR');
    });

    test('Tenant ausente (null) lanca erro', () => {
      expect(() => validateTenantId(null)).toThrow('IDENTITY_ERROR');
    });

    test('Tenant vazio lanca erro', () => {
      expect(() => validateTenantId('')).toThrow('IDENTITY_ERROR');
    });

    test('Tenant numerico lanca erro', () => {
      expect(() => validateTenantId(12345)).toThrow('IDENTITY_ERROR');
    });

    test('Tenant objeto lanca erro', () => {
      expect(() => validateTenantId({})).toThrow('IDENTITY_ERROR');
    });

    test('API Key V2 como tenant lanca erro', () => {
      expect(() => validateTenantId(API_KEY_V2)).toThrow('IDENTITY_ERROR');
    });

    test('UUID sem hifens lanca erro', () => {
      const noHyphens = TENANT_A.replace(/-/g, '');
      expect(() => validateTenantId(noHyphens)).toThrow('IDENTITY_ERROR');
    });
  });

  // C.2 Identificadores locais
  describe('C.2 — Validacao de identificadores locais', () => {
    test('Telefone valido (BR, 13 digitos)', () => {
      expect(() => buildWhatsAppIdentityKey(TENANT_A, PHONE_BR)).not.toThrow();
    });

    test('Telefone valido (US, 11 digitos)', () => {
      expect(() => buildWhatsAppIdentityKey(TENANT_A, PHONE_US)).not.toThrow();
    });

    test('Telefone com 8 digitos (minimo) e aceito', () => {
      expect(() => buildWhatsAppIdentityKey(TENANT_A, '12345678')).not.toThrow();
    });

    test('Telefone com 15 digitos (maximo) e aceito', () => {
      expect(() => buildWhatsAppIdentityKey(TENANT_A, '123456789012345')).not.toThrow();
    });

    test('Telefone com 7 digitos (abaixo do minimo) lanca erro', () => {
      expect(() => buildWhatsAppIdentityKey(TENANT_A, '1234567')).toThrow('IDENTITY_ERROR');
    });

    test('Telefone com 16 digitos (acima do maximo) lanca erro', () => {
      expect(() => buildWhatsAppIdentityKey(TENANT_A, '1234567890123456')).toThrow('IDENTITY_ERROR');
    });

    test('Telefone ausente lanca erro', () => {
      expect(() => buildWhatsAppIdentityKey(TENANT_A, null)).toThrow('IDENTITY_ERROR');
      expect(() => buildWhatsAppIdentityKey(TENANT_A, undefined)).toThrow('IDENTITY_ERROR');
      expect(() => buildWhatsAppIdentityKey(TENANT_A, '')).toThrow('IDENTITY_ERROR');
    });

    test('Telefone com caracteres nao numericos e limpo', () => {
      const key = buildWhatsAppIdentityKey(TENANT_A, '+55 (11) 99999-9999');
      expect(key).toBe(`t:${TENANT_A}:wa:${PHONE_BR}`);
    });

    test('Identificador vazio no buildCanonicalIdentityKey lanca erro', () => {
      expect(() => buildCanonicalIdentityKey(TENANT_A, '', '')).toThrow('IDENTITY_ERROR');
    });

    test('Ambos ausentes (null, null) lanca erro', () => {
      expect(() => buildCanonicalIdentityKey(TENANT_A, null, null)).toThrow('IDENTITY_ERROR');
    });

    test('Ambos undefined lanca erro', () => {
      expect(() => buildCanonicalIdentityKey(TENANT_A, undefined, undefined)).toThrow('IDENTITY_ERROR');
    });
  });

  // C.3 Formatos legados
  describe('C.3 — Formatos legados', () => {
    test('wa_<phone>_<key8> legado valido e classificado corretamente', () => {
      const result = classifyLegacyId('wa_5511999999999_lm_live_');
      expect(result).toEqual({ type: 'wa', localId: '5511999999999' });
    });

    test('wa:<phone> legado valido e classificado corretamente', () => {
      const result = classifyLegacyId('wa:5511999999999');
      expect(result).toEqual({ type: 'wa', localId: '5511999999999' });
    });

    test('session_<id> legado valido e classificado corretamente', () => {
      const result = classifyLegacyId('session_1730900000_abc123');
      expect(result).toEqual({ type: 'session', localId: '1730900000_abc123' });
    });

    test('web:sess_<id> legado valido e classificado corretamente', () => {
      const result = classifyLegacyId('web:sess_1730900000_abc123');
      expect(result).toEqual({ type: 'session', localId: '1730900000_abc123' });
    });

    test('lead_<id> legado valido e classificado corretamente', () => {
      const result = classifyLegacyId('lead_42');
      expect(result).toEqual({ type: 'lead', localId: '42' });
    });

    test('lead:<id> legado valido e classificado corretamente', () => {
      const result = classifyLegacyId('lead:42');
      expect(result).toEqual({ type: 'lead', localId: '42' });
    });

    test('Formato nao reconhecido retorna null', () => {
      expect(classifyLegacyId('unknown_format_123')).toBeNull();
      expect(classifyLegacyId('some-random-string')).toBeNull();
    });

    test('String vazia retorna null', () => {
      expect(classifyLegacyId('')).toBeNull();
    });

    test('null retorna null', () => {
      expect(classifyLegacyId(null)).toBeNull();
    });

    test('undefined retorna null', () => {
      expect(classifyLegacyId(undefined)).toBeNull();
    });

    test('wa_invalid_phone_format e rejeitado', () => {
      expect(classifyLegacyId('wa_invalid_phone_format')).toBeNull();
    });

    test('wa_ com 7 digitos e rejeitado', () => {
      expect(classifyLegacyId('wa_1234567')).toBeNull();
    });

    test('wa_ com 16 digitos e rejeitado', () => {
      expect(classifyLegacyId('wa_1234567890123456')).toBeNull();
    });

    test('session_ com 3 chars e rejeitado (abaixo do minimo 8)', () => {
      expect(classifyLegacyId('session_abc')).toBeNull();
    });

    test('session_ com 65 chars e rejeitado (acima do maximo 64)', () => {
      expect(classifyLegacyId('session_' + 'a'.repeat(65))).toBeNull();
    });

    test('session_ com path traversal e rejeitado', () => {
      expect(classifyLegacyId('session_../invalid_path')).toBeNull();
    });

    test('lead_ vazio e rejeitado', () => {
      expect(classifyLegacyId('lead_')).toBeNull();
    });

    test('lead: com 65 chars e rejeitado (acima do maximo 64)', () => {
      expect(classifyLegacyId('lead:' + 'a'.repeat(65))).toBeNull();
    });

    test('lead: com barra e rejeitado', () => {
      expect(classifyLegacyId('lead:invalid/slash')).toBeNull();
    });
  });

  // C.4 Limites dos identificadores
  describe('C.4 — Limites de identificadores', () => {
    test('Session com exatamente 8 chars e aceito', () => {
      const result = classifyLegacyId('session_12345678');
      expect(result).toEqual({ type: 'session', localId: '12345678' });
    });

    test('Session com exatamente 64 chars e aceito', () => {
      const id64 = 'a'.repeat(64);
      const result = classifyLegacyId('session_' + id64);
      expect(result).toEqual({ type: 'session', localId: id64 });
    });

    test('Lead com exatamente 1 char e aceito', () => {
      const result = classifyLegacyId('lead_a');
      expect(result).toEqual({ type: 'lead', localId: 'a' });
    });

    test('Lead com exatamente 64 chars e aceito', () => {
      const id64 = 'b'.repeat(64);
      const result = classifyLegacyId('lead_' + id64);
      expect(result).toEqual({ type: 'lead', localId: id64 });
    });

    test('Phone com exatamente 8 digitos e aceito', () => {
      const result = classifyLegacyId('wa_12345678');
      expect(result).toEqual({ type: 'wa', localId: '12345678' });
    });

    test('Phone com exatamente 15 digitos e aceito', () => {
      const result = classifyLegacyId('wa_123456789012345');
      expect(result).toEqual({ type: 'wa', localId: '123456789012345' });
    });
  });
});

// ============================================================
// D. PRECEDÊNCIA
// ============================================================

describe('Fase 2C.2A — D. Precedencia', () => {
  test('conversationId valido com leadId presente: conversationId tem precedencia', () => {
    const convId = `session_${SESSION_ID}`;
    const key = buildCanonicalIdentityKey(TENANT_A, LEAD_ID, convId);
    expect(key).toBe(`t:${TENANT_A}:session:${SESSION_ID}`);
  });

  test('conversationId valido sem leadId', () => {
    const convId = `session_${SESSION_ID}`;
    const key = buildCanonicalIdentityKey(TENANT_A, null, convId);
    expect(key).toBe(`t:${TENANT_A}:session:${SESSION_ID}`);
  });

  test('leadId valido sem conversationId', () => {
    const key = buildCanonicalIdentityKey(TENANT_A, LEAD_ID, null);
    expect(key).toBe(`t:${TENANT_A}:lead:${LEAD_ID}`);
  });

  test('Ambos ausentes: lanca erro', () => {
    expect(() => buildCanonicalIdentityKey(TENANT_A, null, null)).toThrow('IDENTITY_ERROR');
  });

  test('conversationId legado WhatsApp tem precedencia sobre leadId', () => {
    const convId = `wa_${PHONE_BR}_lm_live_`;
    const key = buildCanonicalIdentityKey(TENANT_A, LEAD_ID, convId);
    expect(key).toBe(`t:${TENANT_A}:wa:${PHONE_BR}`);
  });

  test('conversationId legado lead tem precedencia sobre leadId separado', () => {
    const convId = 'lead_99';
    const key = buildCanonicalIdentityKey(TENANT_A, 'other-lead', convId);
    // conversationId é reconhecido como formato legado lead:99
    expect(key).toBe(`t:${TENANT_A}:lead:99`);
  });

  test('conversationId nao-legado mas valido como session e aceito', () => {
    // Um conversationId que não é formato legado mas é alfanumérico 8+ chars
    const convId = 'abcdef12345678';
    const key = buildCanonicalIdentityKey(TENANT_A, null, convId);
    expect(key).toBe(`t:${TENANT_A}:session:${convId}`);
  });

  test('conversationId nao-legado invalido e leadId valido: usa leadId', () => {
    // conversationId que não é formato legado e não é session válido (muito curto)
    const convId = 'ab';
    const key = buildCanonicalIdentityKey(TENANT_A, LEAD_ID, convId);
    expect(key).toBe(`t:${TENANT_A}:lead:${LEAD_ID}`);
  });

  test('conversationId nao-legado invalido e leadId invalido: lanca erro', () => {
    const convId = 'ab';
    const invalidLead = '../traversal';
    expect(() => buildCanonicalIdentityKey(TENANT_A, invalidLead, convId)).toThrow('IDENTITY_ERROR');
  });
});

// ============================================================
// E. SEGURANÇA
// ============================================================

describe('Fase 2C.2A — E. Seguranca', () => {
  test('API Key V2 como tenant e rejeitada', () => {
    expect(() => {
      buildCanonicalIdentityKey(API_KEY_V2, LEAD_ID, null);
    }).toThrow('IDENTITY_ERROR');
  });

  test('API Key V1 como tenant e rejeitada', () => {
    expect(() => {
      buildCanonicalIdentityKey('abc123def456', LEAD_ID, null);
    }).toThrow('IDENTITY_ERROR');
  });

  test('Tenant arbitrario (string qualquer) e rejeitado', () => {
    expect(() => {
      buildCanonicalIdentityKey('meu-tenant-customizado', LEAD_ID, null);
    }).toThrow('IDENTITY_ERROR');
  });

  test('Identidade sem tenant canonico lanca erro', () => {
    expect(() => {
      buildCanonicalIdentityKey(undefined, LEAD_ID, null);
    }).toThrow('IDENTITY_ERROR');
  });

  test('Entrada malformada: tenant com caracteres especiais e rejeitado', () => {
    expect(() => {
      buildCanonicalIdentityKey('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d; DROP TABLE', LEAD_ID, null);
    }).toThrow('IDENTITY_ERROR');
  });

  test('Entrada malformada: leadId com barra e rejeitado', () => {
    expect(() => {
      buildCanonicalIdentityKey(TENANT_A, '../etc/passwd', null);
    }).toThrow('IDENTITY_ERROR');
  });

  test('Entrada malformada: leadId com ponto-e-virgula e rejeitado', () => {
    expect(() => {
      buildCanonicalIdentityKey(TENANT_A, 'lead;DROP', null);
    }).toThrow('IDENTITY_ERROR');
  });

  test('Tentativa de injecao no conversationId legado e rejeitada', () => {
    expect(classifyLegacyId('wa_5511999999999; rm -rf /')).toBeNull();
    expect(classifyLegacyId('session_../../etc/passwd')).toBeNull();
    expect(classifyLegacyId('lead_id<script>alert(1)</script>')).toBeNull();
  });

  test('Todos os erros contem prefixo IDENTITY_ERROR', () => {
    const cases = [
      () => validateTenantId(null),
      () => validateTenantId('invalid'),
      () => buildCanonicalIdentityKey(TENANT_A, null, null),
      () => buildWhatsAppIdentityKey(TENANT_A, null),
      () => buildWhatsAppIdentityKey(TENANT_A, '123'),
      () => buildCanonicalIdentityKey(TENANT_A, '../bad', null),
    ];

    for (const fn of cases) {
      expect(fn).toThrow(/^IDENTITY_ERROR:/);
    }
  });
});

// ============================================================
// F. FORMATO DA SAÍDA (verificação estrutural)
// ============================================================

describe('Fase 2C.2A — F. Formato da Saida', () => {
  test('Formato: t:<uuid>:wa:<phone>', () => {
    const key = buildWhatsAppIdentityKey(TENANT_A, PHONE_BR);
    const parts = key.split(':');
    expect(parts[0]).toBe('t');
    expect(parts[1]).toBe(TENANT_A);
    expect(parts[2]).toBe('wa');
    expect(parts[3]).toBe(PHONE_BR);
    expect(parts.length).toBe(4);
  });

  test('Formato: t:<uuid>:session:<id>', () => {
    const key = buildCanonicalIdentityKey(TENANT_A, null, `session_${SESSION_ID}`);
    const parts = key.split(':');
    expect(parts[0]).toBe('t');
    expect(parts[1]).toBe(TENANT_A);
    expect(parts[2]).toBe('session');
    // SESSION_ID contém underscore, não dois-pontos
    expect(parts[3]).toBe(SESSION_ID);
    expect(parts.length).toBe(4);
  });

  test('Formato: t:<uuid>:lead:<id>', () => {
    const key = buildCanonicalIdentityKey(TENANT_A, LEAD_ID, null);
    const parts = key.split(':');
    expect(parts[0]).toBe('t');
    expect(parts[1]).toBe(TENANT_A);
    expect(parts[2]).toBe('lead');
    // LEAD_ID contém hífens, não dois-pontos
    expect(parts[3]).toBe(LEAD_ID);
    expect(parts.length).toBe(4);
  });

  test('Todos os exports estao presentes', () => {
    const mod = require('../../lib/tenant-identity-helper');
    expect(typeof mod.buildCanonicalIdentityKey).toBe('function');
    expect(typeof mod.buildWhatsAppIdentityKey).toBe('function');
    expect(typeof mod.validateTenantId).toBe('function');
    expect(typeof mod.classifyLegacyId).toBe('function');
    expect(mod.UUID_REGEX).toBeInstanceOf(RegExp);
    expect(mod.LEGACY_WA_REGEX).toBeInstanceOf(RegExp);
    expect(mod.LEGACY_SESSION_REGEX).toBeInstanceOf(RegExp);
    expect(mod.LEGACY_LEAD_REGEX).toBeInstanceOf(RegExp);
    expect(typeof mod.LOCAL_ID_VALIDATORS).toBe('object');
  });
});
