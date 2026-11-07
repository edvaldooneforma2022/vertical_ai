/**
 * 🔑 API KEY MANAGER v2 - Link Mágico
 * Gestão avançada de API keys com persistência em PostgreSQL.
 * 
 * Features:
 * - Keys armazenadas como hash bcrypt (nunca em plaintext)
 * - Rotação automática
 * - Expiração programada
 * - Controle de scopes (permissões)
 * - Restrição por IP/Domínio
 * - Revogação imediata
 * - Tokens efêmeros
 * 
 * Não altera o auth.js existente — funciona como camada adicional.
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

class ApiKeyManager {
    constructor(db, usePostgres) {
        this.db = db;
        this.usePostgres = usePostgres;
        this.enabled = !!usePostgres;

        // Cache de validação (evita hit no DB a cada request)
        this.validationCache = new Map();
        this.CACHE_TTL = 60 * 1000; // 1 minuto

        if (this.enabled) {
            console.log('🔑 [API KEY MANAGER] Sistema avançado de API keys ativo');
        } else {
            console.log('⚠️ [API KEY MANAGER] Desabilitado (requer PostgreSQL)');
        }
    }

    /**
     * Gerar nova API key
     * @param {string} tenantId - ID do tenant
     * @param {string} name - Nome/descrição da key
     * @param {object} options - Opções adicionais
     * @returns {{ rawKey: string, keyId: number, prefix: string }} - Raw key é mostrada UMA VEZ
     */
    async createKey(tenantId, name, options = {}) {
        if (!this.enabled) {
            throw new Error('API Key Manager requer PostgreSQL');
        }

        const {
            scopes = ['*'],
            allowedIps = [],
            allowedDomains = [],
            expiresInDays = null
        } = options;

        // Gerar key raw: lm_live_<32 hex chars>
        const rawBytes = crypto.randomBytes(16);
        const rawKey = `lm_live_${rawBytes.toString('hex')}`;
        const prefix = rawKey.substring(0, 12); // lm_live_xxxx

        // Hash da key para armazenamento
        const keyHash = await bcrypt.hash(rawKey, 12);

        // Calcular expiração
        const expiresAt = expiresInDays
            ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
            : null;

        const query = `
            INSERT INTO api_keys_v2 (key_hash, key_prefix, tenant_id, name, scopes, 
                allowed_ips, allowed_domains, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, key_prefix, tenant_id, name, scopes, status, created_at, expires_at
        `;

        const result = await this.db.query(query, [
            keyHash, prefix, tenantId, name,
            JSON.stringify(scopes),
            JSON.stringify(allowedIps),
            JSON.stringify(allowedDomains),
            expiresAt
        ]);

        return {
            rawKey,  // ⚠️ Mostrar UMA VEZ ao usuário — não armazenamos o raw
            keyId: result.rows[0].id,
            prefix,
            ...result.rows[0]
        };
    }

    /**
     * Validar API key (FASE 2C.1 — Identidade Canônica do Tenant)
     *
     * Fluxo:
     * 1. Cache otimiza validação criptográfica da credencial (bcrypt/hash).
     * 2. Expiração V2 é verificada em todo cache hit positivo.
     * 3. Status do tenant é consultado em tempo real a cada requisição.
     *
     * @param {string} rawKey - Key raw fornecida pelo cliente
     * @returns {{ valid: boolean, tenantId?: string, tenantName?: string, tenantPlan?: string, tenantStatus?: string, scopes?: string[], reason?: string, reasonCode?: string, isInfraError?: boolean }}
     */
    async validateKey(rawKey) {
        if (!this.enabled || !rawKey) {
            return { valid: false, reason: 'Sistema de keys desabilitado', reasonCode: 'SYSTEM_DISABLED', isInfraError: true };
        }

        // Cache otimiza validação da CREDENCIAL (bcrypt/hash), não do tenant
        const cached = this._getCached(rawKey);
        if (cached && !cached.valid) {
            // Resultado negativo cacheado (key bloqueada) — retornar direto
            return cached;
        }

        const isV2 = rawKey.startsWith('lm_live_') || rawKey.startsWith('lm_test_');

        let keyResult;

        if (cached && cached.valid) {
            // [FASE 2C.1] Verificar expiração em tempo real, mesmo com cache hit
            if (cached.expiresAt != null) {
                const expiresAtMs = new Date(cached.expiresAt).getTime();
                if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
                    this.validationCache.delete(rawKey);
                    return { valid: false, reason: 'Key expirada ou com expiração inválida', reasonCode: 'KEY_EXPIRED' };
                }
            }
            keyResult = cached;
        } else {
            // Validar credencial contra o banco
            try {
                keyResult = await this._validateCredential(rawKey, isV2);
            } catch (error) {
                console.error('❌ [API KEY MANAGER] Erro na validação da credencial:', error.message);
                return { valid: false, reason: 'Erro interno na validação', reasonCode: 'INFRA_ERROR', isInfraError: true };
            }

            if (!keyResult.valid) {
                this._setCache(rawKey, keyResult);
                return keyResult;
            }

            // Cachear resultado positivo da credencial (sem status do tenant)
            this._setCache(rawKey, keyResult);
        }

        // [FASE 2C.1] SEMPRE verificar tenant em tempo real — não cacheado
        try {
            const tenantCheck = await this.db.query(
                `SELECT name, plan, status FROM tenants WHERE id = $1`,
                [keyResult.tenantId]
            );

            if (tenantCheck.rows.length === 0) {
                console.log(`🚫 [SECURITY] Tenant NÃO ENCONTRADO: ${keyResult.tenantId}`);
                return { valid: false, reason: 'Tenant não encontrado', reasonCode: 'TENANT_NOT_FOUND' };
            }

            const tenant = tenantCheck.rows[0];

            if (tenant.status !== 'active') {
                console.log(`🚫 [SECURITY] Tenant SUSPENSO: ${keyResult.tenantId}, status=${tenant.status}`);
                return { valid: false, reason: 'Tenant suspenso ou inativo', reasonCode: 'TENANT_SUSPENDED' };
            }

            // Retornar resultado completo com dados canônicos atuais do tenant
            return {
                valid: true,
                keyId: keyResult.keyId,
                tenantId: keyResult.tenantId,
                tenantStatus: tenant.status,
                tenantName: tenant.name,
                tenantPlan: tenant.plan || 'basic',
                scopes: keyResult.scopes,
                allowedIps: keyResult.allowedIps || [],
                allowedDomains: keyResult.allowedDomains || [],
                isLegacy: keyResult.isLegacy || false
            };
        } catch (tenantErr) {
            console.error(`❌ [API KEY MANAGER] Erro ao verificar tenant ${keyResult.tenantId}:`, tenantErr.message);
            return { valid: false, reason: 'Erro ao verificar status do tenant', reasonCode: 'INFRA_ERROR', isInfraError: true };
        }
    }

    /**
     * Validar credencial V1/V2 contra o banco (FASE 2C.1)
     * Responsável apenas pela validação criptográfica da key.
     * NÃO verifica status do tenant — isso é feito por validateKey().
     *
     * @param {string} rawKey - Key raw
     * @param {boolean} isV2 - Se é key V2
     * @returns {object} Resultado da validação da credencial
     */
    async _validateCredential(rawKey, isV2) {
        if (isV2) {
            // --- LÓGICA V2 (Sistema Novo) ---
            const prefix = rawKey.substring(0, 12);
            const result = await this.db.query(
                `SELECT * FROM api_keys_v2 WHERE key_prefix = $1`,
                [prefix]
            );

            if (result.rows.length === 0) return { valid: false, reason: 'Key não encontrada', reasonCode: 'KEY_NOT_FOUND' };

            for (const row of result.rows) {
                const matches = await bcrypt.compare(rawKey, row.key_hash);
                if (matches) {
                    if (row.status !== 'active') {
                        console.log(`🚫 [SECURITY] Key V2 BLOQUEADA (status=${row.status}): tenant=${row.tenant_id}`);
                        return { valid: false, reason: 'Key revogada ou inativa', reasonCode: 'KEY_REVOKED' };
                    }
                    // Verificação fail-closed de expiração
                    if (row.expires_at != null) {
                        const expiresAtMs = new Date(row.expires_at).getTime();
                        if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
                            return { valid: false, reason: 'Key expirada ou com expiração inválida', reasonCode: 'KEY_EXPIRED' };
                        }
                    }

                    // Atualizar uso (fire-and-forget)
                    this.db.query(
                        `UPDATE api_keys_v2 SET last_used_at = CURRENT_TIMESTAMP, usage_count = usage_count + 1 WHERE id = $1`,
                        [row.id]
                    ).catch(() => { });

                    return {
                        valid: true,
                        keyId: row.id,
                        tenantId: row.tenant_id,
                        expiresAt: row.expires_at || null,
                        scopes: typeof row.scopes === 'string' ? JSON.parse(row.scopes) : row.scopes,
                        allowedIps: typeof row.allowed_ips === 'string' ? JSON.parse(row.allowed_ips) : row.allowed_ips,
                        allowedDomains: typeof row.allowed_domains === 'string' ? JSON.parse(row.allowed_domains) : row.allowed_domains
                    };
                }
            }
            return { valid: false, reason: 'Key inválida', reasonCode: 'KEY_NOT_FOUND' };
        } else {
            // --- LÓGICA LEGADO V1 (Sistema Antigo) ---
            // Busca 1: Por key_value (plaintext)
            let result = await this.db.query(
                `SELECT * FROM api_keys WHERE key_value = $1`,
                [rawKey]
            );

            // Busca 2: Se não encontrou por plaintext, buscar por key_hash (SHA-256)
            if (result.rows.length === 0) {
                const keyHash = require('crypto').createHash('sha256').update(rawKey).digest('hex');
                result = await this.db.query(
                    `SELECT * FROM api_keys WHERE key_hash = $1`,
                    [keyHash]
                );
            }

            if (result.rows.length === 0) return { valid: false, reason: 'Key legada não encontrada', reasonCode: 'KEY_NOT_FOUND' };
            const row = result.rows[0];

            if (!row.active) {
                console.log(`🚫 [SECURITY] Key LEGADA BLOQUEADA (active=false): tenant=${row.tenant_id}, key_id=${row.id}`);
                return { valid: false, reason: 'Key legada revogada', reasonCode: 'KEY_REVOKED' };
            }

            return {
                valid: true,
                keyId: `legacy_${row.id}`,
                tenantId: row.tenant_id,
                scopes: ['*'],
                allowedIps: [],
                allowedDomains: [],
                isLegacy: true
            };
        }
    }

    /**
     * Verificar se key tem permissão para o scope solicitado
     */
    checkScope(keyScopes, requiredScope) {
        if (!keyScopes || keyScopes.includes('*')) return true;
        return keyScopes.includes(requiredScope);
    }

    /**
     * Verificar se IP/domínio é permitido
     */
    checkOrigin(keyData, ip, domain) {
        // Se listas estão vazias, permitir tudo
        if (keyData.allowedIps && keyData.allowedIps.length > 0) {
            if (!keyData.allowedIps.includes(ip)) {
                return { allowed: false, reason: `IP ${ip} não autorizado para esta key` };
            }
        }

        if (keyData.allowedDomains && keyData.allowedDomains.length > 0 && domain) {
            if (!keyData.allowedDomains.includes(domain)) {
                return { allowed: false, reason: `Domínio ${domain} não autorizado para esta key` };
            }
        }

        return { allowed: true };
    }

    async rotateKey(tenantId, oldKeyId, newOptions = {}) {
        if (!this.enabled) throw new Error('Requer PostgreSQL');

        const isLegacy = typeof oldKeyId === 'string' && oldKeyId.startsWith('legacy_');
        let oldMetadata = {};

        if (isLegacy) {
            // Buscar na tabela legado
            const legacyId = oldKeyId.replace('legacy_', '');
            const legacyKey = await this.db.query(
                `SELECT * FROM api_keys WHERE id = $1 AND tenant_id = $2 AND active = true`,
                [legacyId, tenantId]
            );
            if (legacyKey.rows.length === 0) throw new Error('Chave legada não encontrada ou inativa');
            oldMetadata = { name: 'Chave Legacy Rotacionada', scopes: ['*'] };
        } else {
            // Buscar na tabela V2
            const oldKey = await this.db.query(
                `SELECT * FROM api_keys_v2 WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
                [oldKeyId, tenantId]
            );
            if (oldKey.rows.length === 0) throw new Error('Key não encontrada ou já revogada');
            const old = oldKey.rows[0];
            oldMetadata = {
                name: old.name,
                scopes: typeof old.scopes === 'string' ? JSON.parse(old.scopes) : old.scopes,
                allowedIps: typeof old.allowed_ips === 'string' ? JSON.parse(old.allowed_ips) : old.allowed_ips,
                allowedDomains: typeof old.allowed_domains === 'string' ? JSON.parse(old.allowed_domains) : old.allowed_domains
            };
        }

        // Criar nova key (sempre V2)
        const newKey = await this.createKey(tenantId, `${oldMetadata.name} (rotacionada)`, {
            ...oldMetadata,
            ...newOptions
        });

        // Revogar key antiga
        await this.revokeKey(oldKeyId);

        // Invalidar cache
        this.validationCache.clear();

        return newKey;
    }

    /**
     * Revogar key imediatamente
     */
    async revokeKey(keyId) {
        if (!this.enabled) throw new Error('Requer PostgreSQL');

        const isLegacy = typeof keyId === 'string' && keyId.startsWith('legacy_');

        if (isLegacy) {
            const legacyId = keyId.replace('legacy_', '');
            await this.db.query(
                `UPDATE api_keys SET active = false WHERE id = $1`,
                [legacyId]
            );
        } else {
            await this.db.query(
                `UPDATE api_keys_v2 SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE id = $1`,
                [keyId]
            );
        }

        // Invalidar cache
        this.validationCache.clear();

        return true;
    }

    /**
     * Listar keys de um tenant (sem revelar hashes)
     */
    async listKeys(tenantId) {
        if (!this.enabled) return [];

        try {
            // 1. Chaves V2 (Sistema Novo)
            const v2Result = await this.db.query(
                `SELECT id, key_prefix, name, scopes, status, created_at, expires_at, 
                        last_used_at, usage_count
                 FROM api_keys_v2 
                 WHERE tenant_id = $1 
                 ORDER BY created_at DESC`,
                [tenantId]
            );

            // 2. Chaves Legadas (Sistema Antigo)
            // Nota: Tentamos buscar da tabela 'api_keys' se ela existir
            let legacyKeys = [];
            try {
                const legacyResult = await this.db.query(
                    `SELECT id, key_value, active, 'active' as status, 'Chave Legada' as name
                     FROM api_keys 
                     WHERE tenant_id = $1`,
                    [tenantId]
                );
                legacyKeys = legacyResult.rows.map(k => ({
                    ...k,
                    id: `legacy_${k.id}`,
                    key_prefix: k.key_value ? k.key_value.substring(0, 8) : '********',
                    status: k.active ? 'active' : 'revoked',
                    is_legacy: true
                }));
            } catch (e) {
                // Tabela legado pode não existir ou ter estrutura diferente
                console.log('ℹ️ [API KEY MANAGER] Sem chaves legadas para este tenant ou tabela inexistente.');
            }

            // Unificar resultados
            return [...v2Result.rows, ...legacyKeys];
        } catch (error) {
            console.error('❌ [API KEY MANAGER] Erro ao listar keys:', error.message);
            return [];
        }
    }

    // ===== CACHE INTERNO =====

    _getCached(rawKey) {
        const entry = this.validationCache.get(rawKey);
        if (entry && Date.now() - entry.timestamp < this.CACHE_TTL) {
            return entry.result;
        }
        return null;
    }

    _setCache(rawKey, result) {
        this.validationCache.set(rawKey, {
            result,
            timestamp: Date.now()
        });

        // Limitar tamanho do cache
        if (this.validationCache.size > 1000) {
            const firstKey = this.validationCache.keys().next().value;
            this.validationCache.delete(firstKey);
        }
    }
}

// Singleton
let _instance = null;

function getApiKeyManager() {
    if (!_instance) {
        try {
            const { db, USE_POSTGRES } = require('./database');
            _instance = new ApiKeyManager(db, USE_POSTGRES);
        } catch (e) {
            console.error('⚠️ [API KEY MANAGER] Falha ao inicializar:', e.message);
            _instance = new ApiKeyManager(null, false);
        }
    }
    return _instance;
}

module.exports = { ApiKeyManager, getApiKeyManager };
