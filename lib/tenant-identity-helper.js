'use strict';

/**
 * LinkMágico — Fase 2C.2A
 * Helper Canônico de Identidade Multi-Tenant
 *
 * Contrato de identidade:
 *   t:<tenantUUID>:<tipo>:<identificadorLocal>
 *
 * Tipos suportados:
 *   - wa      → conversa WhatsApp, identificador = telefone (8–15 dígitos)
 *   - session → sessão web, identificador = sessão alfanumérica (8–64 chars)
 *   - lead    → lead do CRM, identificador = ID alfanumérico (1–64 chars)
 *
 * Regras obrigatórias:
 *   1. tenantId é UUID v4 canônico (obrigatório).
 *   2. Determinístico: mesmas entradas → mesma saída.
 *   3. Sem geração aleatória interna, sem timestamp, sem estado global.
 *   4. Fail-closed: entradas inválidas lançam erro.
 *   5. API Key nunca é usada como identidade de tenant.
 *   6. X-Tenant-ID ou tenant informado pelo cliente nunca é confiável
 *      (o tenant vem exclusivamente do fluxo de autenticação).
 *
 * @module lib/tenant-identity-helper
 */

// ============================================================
// Validações
// ============================================================

/**
 * Regex para UUID v4 canônico (lowercase, com hífens).
 * Aceita também UUIDs v1–v5 para compatibilidade com registros existentes.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ============================================================
// Regex legadas validadas na auditoria forense (22 testes, 22/22 aprovados)
// NÃO ALTERAR sem nova auditoria e testes correspondentes.
// ============================================================

const LEGACY_WA_REGEX = /^wa[:_](?<phone>\d{8,15})(?:_[a-zA-Z0-9_-]+)?$/;
const LEGACY_SESSION_REGEX = /^(?:session_|web:sess_)(?<sess>[a-zA-Z0-9_-]{8,64})$/;
const LEGACY_LEAD_REGEX = /^lead[:_](?<leadId>[a-zA-Z0-9_-]{1,64})$/;

// Validações de identificador local por tipo
const LOCAL_ID_VALIDATORS = {
  wa:      /^\d{8,15}$/,
  session: /^[a-zA-Z0-9_-]{8,64}$/,
  lead:    /^[a-zA-Z0-9_-]{1,64}$/,
};

// ============================================================
// Helper principal
// ============================================================

/**
 * Valida que um tenantId é UUID canônico.
 *
 * @param {*} tenantId - Valor a validar.
 * @returns {string} UUID normalizado (lowercase).
 * @throws {Error} Se o tenantId for inválido.
 */
function validateTenantId(tenantId) {
  if (tenantId === undefined || tenantId === null || tenantId === '') {
    throw new Error('IDENTITY_ERROR: tenantId ausente ou vazio');
  }

  if (typeof tenantId !== 'string') {
    throw new Error('IDENTITY_ERROR: tenantId deve ser string, recebido ' + typeof tenantId);
  }

  const normalized = tenantId.trim().toLowerCase();

  if (!UUID_REGEX.test(normalized)) {
    throw new Error('IDENTITY_ERROR: tenantId nao e UUID valido: ' + tenantId);
  }

  return normalized;
}

/**
 * Classifica um conversationId legado e extrai o identificador local.
 *
 * Ordem de verificação:
 *   1. Formato WhatsApp legado (wa_<phone>_<key> ou wa:<phone>)
 *   2. Formato sessão legada (session_<id> ou web:sess_<id>)
 *   3. Formato lead legado (lead_<id> ou lead:<id>)
 *
 * @param {string} conversationId - ID de conversa no formato legado.
 * @returns {{ type: string, localId: string } | null}
 *   Objeto com tipo e ID local, ou null se não reconhecido.
 */
function classifyLegacyId(conversationId) {
  if (!conversationId || typeof conversationId !== 'string') {
    return null;
  }

  const waMatch = LEGACY_WA_REGEX.exec(conversationId);
  if (waMatch) {
    return { type: 'wa', localId: waMatch.groups.phone };
  }

  const sessMatch = LEGACY_SESSION_REGEX.exec(conversationId);
  if (sessMatch) {
    return { type: 'session', localId: sessMatch.groups.sess };
  }

  const leadMatch = LEGACY_LEAD_REGEX.exec(conversationId);
  if (leadMatch) {
    return { type: 'lead', localId: leadMatch.groups.leadId };
  }

  return null;
}

/**
 * Constrói a chave de identidade canônica isolada por tenant.
 *
 * Formato: t:<tenantUUID>:<tipo>:<identificadorLocal>
 *
 * Regras de precedência:
 *   1. Se conversationId é fornecido e reconhecido como formato legado,
 *      extrai tipo e identificador local do formato legado.
 *   2. Se conversationId é fornecido mas não legado, e é um identificador
 *      local válido para sessão, usa tipo 'session'.
 *   3. Se conversationId não existe mas leadId existe e é válido, usa tipo 'lead'.
 *   4. Se nenhuma identidade válida existe, lança erro (fail-closed).
 *
 * @param {string} tenantId - UUID canônico do tenant (obrigatório).
 * @param {string|null|undefined} leadId - ID do lead, se disponível.
 * @param {string|null|undefined} conversationId - ID da conversa, se disponível.
 * @returns {string} Chave canônica no formato t:<uuid>:<type>:<localId>.
 * @throws {Error} Se tenantId for inválido ou nenhuma identidade local for determinável.
 */
function buildCanonicalIdentityKey(tenantId, leadId, conversationId) {
  // 1. Validar tenant — obrigatório, fail-closed
  const validTenant = validateTenantId(tenantId);

  // 2. Tentar classificar conversationId legado
  if (conversationId && typeof conversationId === 'string') {
    const legacy = classifyLegacyId(conversationId);

    if (legacy) {
      // Formato legado reconhecido — usar tipo e ID extraídos
      return `t:${validTenant}:${legacy.type}:${legacy.localId}`;
    }

    // Não é formato legado — verificar se é identificador local válido para sessão
    const trimmed = conversationId.trim();
    if (trimmed.length > 0 && LOCAL_ID_VALIDATORS.session.test(trimmed)) {
      return `t:${validTenant}:session:${trimmed}`;
    }
  }

  // 3. Sem conversationId válido — tentar leadId
  if (leadId && typeof leadId === 'string') {
    const trimmedLead = leadId.trim();
    if (trimmedLead.length > 0 && LOCAL_ID_VALIDATORS.lead.test(trimmedLead)) {
      return `t:${validTenant}:lead:${trimmedLead}`;
    }

    // leadId fornecido mas inválido
    throw new Error(
      'IDENTITY_ERROR: leadId fornecido mas invalido: ' + leadId
    );
  }

  // 4. Nenhuma identidade local determinável — fail-closed
  throw new Error(
    'IDENTITY_ERROR: impossivel determinar identidade local — ' +
    'conversationId e leadId ausentes ou invalidos'
  );
}

/**
 * Constrói identidade canônica para conversa WhatsApp.
 *
 * Atalho para o caso comum do canal WhatsApp onde o telefone é conhecido.
 *
 * @param {string} tenantId - UUID canônico do tenant.
 * @param {string} phone - Número de telefone (8–15 dígitos).
 * @returns {string} Chave canônica no formato t:<uuid>:wa:<phone>.
 * @throws {Error} Se tenantId ou phone forem inválidos.
 */
function buildWhatsAppIdentityKey(tenantId, phone) {
  const validTenant = validateTenantId(tenantId);

  if (!phone || typeof phone !== 'string') {
    throw new Error('IDENTITY_ERROR: phone ausente ou invalido');
  }

  const cleanPhone = phone.replace(/\D/g, '');

  if (!LOCAL_ID_VALIDATORS.wa.test(cleanPhone)) {
    throw new Error(
      'IDENTITY_ERROR: phone nao possui entre 8 e 15 digitos: ' + phone
    );
  }

  return `t:${validTenant}:wa:${cleanPhone}`;
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  // Funções principais
  buildCanonicalIdentityKey,
  buildWhatsAppIdentityKey,

  // Funções de suporte (expostas para testes)
  validateTenantId,
  classifyLegacyId,

  // Constantes (expostas para testes e reutilização futura)
  UUID_REGEX,
  LEGACY_WA_REGEX,
  LEGACY_SESSION_REGEX,
  LEGACY_LEAD_REGEX,
  LOCAL_ID_VALIDATORS,
};
