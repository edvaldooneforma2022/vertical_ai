/**
 * FASE 2C.1 — Testes Unitários de Identidade Canônica do Tenant, Cache e Sessões
 * 
 * Cobre estritamente os casos U15–U72 especificados no fechamento da Fase 2C.1:
 * - api-key-manager.js (validateKey & _validateCredential)
 * - server.js (validateApiKey)
 * - server.js (requireApiKey)
 * - server.js (requireApiKeyV3)
 * 
 * Sem dependência de banco de dados real (100% isolado por mocks).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const bcrypt = require('bcryptjs');
const { ApiKeyManager } = require('../../api-key-manager');

// ═══════════════════════════════════════════════════════════
// HELPERS PARA EXTRAÇÃO DE FUNÇÕES DO SERVER.JS
// ═══════════════════════════════════════════════════════════

const serverCode = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');

function extractServerFunction(name) {
    const regex = new RegExp(`async function ${name}\\s*\\([\\s\\S]*?\\n\\}`);
    const match = serverCode.match(regex);
    if (!match) throw new Error(`Função ${name} não encontrada em server.js`);
    return match[0];
}

function createMiddlewareEnv(managerMock, loggerMock = null) {
    const sandbox = {
        getApiKeyManager: () => managerMock,
        logger: loggerMock || {
            warn: jest.fn(),
            error: jest.fn(),
            info: jest.fn()
        },
        console: {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        }
    };
    vm.createContext(sandbox);

    const validateApiKeySrc = extractServerFunction('validateApiKey');
    const requireApiKeySrc = extractServerFunction('requireApiKey');
    const requireApiKeyV3Src = extractServerFunction('requireApiKeyV3');

    vm.runInContext(validateApiKeySrc, sandbox);
    vm.runInContext(requireApiKeySrc, sandbox);
    vm.runInContext(requireApiKeyV3Src, sandbox);

    return sandbox;
}

function createMockReqRes({ apiKey = null, query = {}, body = {}, headers = {}, session = {}, path = '/api/protected' } = {}) {
    const req = {
        path,
        headers: { ...headers },
        query: { ...query },
        body: { ...body },
        session: { ...session }
    };

    if (apiKey) {
        req.headers['x-api-key'] = apiKey;
    }

    const res = {
        statusCode: 200,
        _json: null,
        _redirect: null,
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(data) {
            this._json = data;
            return this;
        },
        redirect: function(url) {
            this._redirect = url;
            return this;
        }
    };

    const next = jest.fn();

    return { req, res, next };
}

function createSmartDbMock() {
    let keyHandler = null;
    let tenantHandler = null;

    const queryFn = jest.fn(async (sql, params) => {
        const sqlStr = String(sql || '');
        if (sqlStr.includes('UPDATE api_keys_v2 SET last_used_at')) {
            return { rows: [] };
        }
        if (sqlStr.includes('UPDATE api_keys_v2 SET status = \'revoked\'') || sqlStr.includes('UPDATE api_keys SET active = false')) {
            return { rows: [] };
        }
        if (sqlStr.includes('api_keys_v2') || sqlStr.includes('api_keys')) {
            if (typeof keyHandler === 'function') return keyHandler(sqlStr, params);
            if (keyHandler) return keyHandler;
            return { rows: [] };
        }
        if (sqlStr.includes('FROM tenants')) {
            if (typeof tenantHandler === 'function') return tenantHandler(sqlStr, params);
            if (tenantHandler) return tenantHandler;
            return { rows: [] };
        }
        return { rows: [] };
    });

    return {
        query: queryFn,
        setKeyResponse: (res) => { keyHandler = res; },
        setTenantResponse: (res) => { tenantHandler = res; }
    };
}

// ═══════════════════════════════════════════════════════════
// SUÍTE 1: ApiKeyManager — validateKey & _validateCredential
// ═══════════════════════════════════════════════════════════

describe('FASE 2C.1 — ApiKeyManager (validateKey & _validateCredential)', () => {
    let smartDb;
    let manager;

    const TENANT_UUID = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
    const RAW_V2_KEY = 'lm_live_abcdef1234567890abcdef123456';
    const RAW_V1_KEY = 'LMV7-TEST-1234-5678';

    beforeEach(async () => {
        smartDb = createSmartDbMock();
        manager = new ApiKeyManager(smartDb, true);
    });

    test('U15: V2 válida + tenant ativo retorna dados canônicos', async () => {
        const hash = await bcrypt.hash(RAW_V2_KEY, 4);
        smartDb.setKeyResponse({
            rows: [{
                id: 10,
                key_hash: hash,
                key_prefix: RAW_V2_KEY.substring(0, 12),
                tenant_id: TENANT_UUID,
                status: 'active',
                expires_at: null,
                scopes: JSON.stringify(['read', 'write']),
                allowed_ips: JSON.stringify([]),
                allowed_domains: JSON.stringify([])
            }]
        });
        smartDb.setTenantResponse({
            rows: [{
                name: 'Empresa Alfa',
                plan: 'pro',
                status: 'active'
            }]
        });

        const result = await manager.validateKey(RAW_V2_KEY);

        expect(result.valid).toBe(true);
        expect(result.tenantId).toBe(TENANT_UUID);
        expect(result.tenantName).toBe('Empresa Alfa');
        expect(result.tenantPlan).toBe('pro');
        expect(result.tenantStatus).toBe('active');
        expect(result.keyId).toBe(10);
        expect(result.scopes).toEqual(['read', 'write']);
    });

    test('U16: V2 válida + tenant suspenso retorna TENANT_SUSPENDED', async () => {
        const hash = await bcrypt.hash(RAW_V2_KEY, 4);
        smartDb.setKeyResponse({
            rows: [{
                id: 10,
                key_hash: hash,
                key_prefix: RAW_V2_KEY.substring(0, 12),
                tenant_id: TENANT_UUID,
                status: 'active',
                expires_at: null,
                scopes: '["*"]'
            }]
        });
        smartDb.setTenantResponse({
            rows: [{
                name: 'Empresa Alfa',
                plan: 'pro',
                status: 'suspended'
            }]
        });

        const result = await manager.validateKey(RAW_V2_KEY);

        expect(result.valid).toBe(false);
        expect(result.reasonCode).toBe('TENANT_SUSPENDED');
    });

    test('U17: V2 + erro de banco na consulta do tenant retorna INFRA_ERROR', async () => {
        const hash = await bcrypt.hash(RAW_V2_KEY, 4);
        smartDb.setKeyResponse({
            rows: [{
                id: 10,
                key_hash: hash,
                key_prefix: RAW_V2_KEY.substring(0, 12),
                tenant_id: TENANT_UUID,
                status: 'active',
                expires_at: null,
                scopes: '["*"]'
            }]
        });
        smartDb.setTenantResponse(() => Promise.reject(new Error('Connection timeout')));

        const result = await manager.validateKey(RAW_V2_KEY);

        expect(result.valid).toBe(false);
        expect(result.reasonCode).toBe('INFRA_ERROR');
        expect(result.isInfraError).toBe(true);
    });

    test('U18: V1 válida + tenant ativo retorna dados canônicos com isLegacy: true', async () => {
        smartDb.setKeyResponse({
            rows: [{
                id: 'leg_1',
                key_value: RAW_V1_KEY,
                tenant_id: TENANT_UUID,
                active: true
            }]
        });
        smartDb.setTenantResponse({
            rows: [{
                name: 'Empresa Legado',
                plan: 'basic',
                status: 'active'
            }]
        });

        const result = await manager.validateKey(RAW_V1_KEY);

        expect(result.valid).toBe(true);
        expect(result.tenantId).toBe(TENANT_UUID);
        expect(result.tenantName).toBe('Empresa Legado');
        expect(result.tenantStatus).toBe('active');
        expect(result.isLegacy).toBe(true);
        expect(result.keyId).toBe('legacy_leg_1');
    });

    test('U19: V1 válida + tenant suspenso retorna TENANT_SUSPENDED', async () => {
        smartDb.setKeyResponse({
            rows: [{
                id: 'leg_1',
                key_value: RAW_V1_KEY,
                tenant_id: TENANT_UUID,
                active: true
            }]
        });
        smartDb.setTenantResponse({
            rows: [{
                name: 'Empresa Legado',
                plan: 'basic',
                status: 'suspended'
            }]
        });

        const result = await manager.validateKey(RAW_V1_KEY);

        expect(result.valid).toBe(false);
        expect(result.reasonCode).toBe('TENANT_SUSPENDED');
    });

    test('U20: V1 + erro de banco na consulta de tenant retorna INFRA_ERROR', async () => {
        smartDb.setKeyResponse({
            rows: [{
                id: 'leg_1',
                key_value: RAW_V1_KEY,
                tenant_id: TENANT_UUID,
                active: true
            }]
        });
        smartDb.setTenantResponse(() => Promise.reject(new Error('Postgres connection pool drained')));

        const result = await manager.validateKey(RAW_V1_KEY);

        expect(result.valid).toBe(false);
        expect(result.reasonCode).toBe('INFRA_ERROR');
        expect(result.isInfraError).toBe(true);
    });

    test('U29: V2 + tenant inexistente no banco (rows.length === 0) retorna TENANT_NOT_FOUND', async () => {
        const hash = await bcrypt.hash(RAW_V2_KEY, 4);
        smartDb.setKeyResponse({
            rows: [{
                id: 10,
                key_hash: hash,
                key_prefix: RAW_V2_KEY.substring(0, 12),
                tenant_id: 'non-existent-tenant-uuid',
                status: 'active',
                expires_at: null,
                scopes: '["*"]'
            }]
        });
        smartDb.setTenantResponse({ rows: [] }); // Tenant não encontrado

        const result = await manager.validateKey(RAW_V2_KEY);

        expect(result.valid).toBe(false);
        expect(result.reasonCode).toBe('TENANT_NOT_FOUND');
    });

    test('U30: V1 + tenant inexistente no banco (rows.length === 0) retorna TENANT_NOT_FOUND', async () => {
        smartDb.setKeyResponse({
            rows: [{
                id: 'leg_1',
                key_value: RAW_V1_KEY,
                tenant_id: 'non-existent-tenant-uuid',
                active: true
            }]
        });
        smartDb.setTenantResponse({ rows: [] });

        const result = await manager.validateKey(RAW_V1_KEY);

        expect(result.valid).toBe(false);
        expect(result.reasonCode).toBe('TENANT_NOT_FOUND');
    });

    test('U34: V2 key inexistente retorna KEY_NOT_FOUND', async () => {
        smartDb.setKeyResponse({ rows: [] });

        const result = await manager.validateKey(RAW_V2_KEY);

        expect(result.valid).toBe(false);
        expect(result.reasonCode).toBe('KEY_NOT_FOUND');
    });

    test('U35: V1 key inativa (active=false) retorna KEY_REVOKED', async () => {
        smartDb.setKeyResponse({
            rows: [{
                id: 'leg_1',
                key_value: RAW_V1_KEY,
                tenant_id: TENANT_UUID,
                active: false
            }]
        });

        const result = await manager.validateKey(RAW_V1_KEY);

        expect(result.valid).toBe(false);
        expect(result.reasonCode).toBe('KEY_REVOKED');
    });

    test('U36: V2 key revogada (status !== active) retorna KEY_REVOKED', async () => {
        const hash = await bcrypt.hash(RAW_V2_KEY, 4);
        smartDb.setKeyResponse({
            rows: [{
                id: 10,
                key_hash: hash,
                key_prefix: RAW_V2_KEY.substring(0, 12),
                tenant_id: TENANT_UUID,
                status: 'revoked',
                expires_at: null
            }]
        });

        const result = await manager.validateKey(RAW_V2_KEY);

        expect(result.valid).toBe(false);
        expect(result.reasonCode).toBe('KEY_REVOKED');
    });

    test('U37: V2 key expirada no banco retorna KEY_EXPIRED', async () => {
        const hash = await bcrypt.hash(RAW_V2_KEY, 4);
        const pastDate = new Date(Date.now() - 10000).toISOString();
        smartDb.setKeyResponse({
            rows: [{
                id: 10,
                key_hash: hash,
                key_prefix: RAW_V2_KEY.substring(0, 12),
                tenant_id: TENANT_UUID,
                status: 'active',
                expires_at: pastDate
            }]
        });

        const result = await manager.validateKey(RAW_V2_KEY);

        expect(result.valid).toBe(false);
        expect(result.reasonCode).toBe('KEY_EXPIRED');
    });

    test('U38: V2 key com data de expiração inválida falha fechada com KEY_EXPIRED', async () => {
        const hash = await bcrypt.hash(RAW_V2_KEY, 4);
        smartDb.setKeyResponse({
            rows: [{
                id: 10,
                key_hash: hash,
                key_prefix: RAW_V2_KEY.substring(0, 12),
                tenant_id: TENANT_UUID,
                status: 'active',
                expires_at: 'DATA_TOTALMENTE_INVALIDA'
            }]
        });

        const result = await manager.validateKey(RAW_V2_KEY);

        expect(result.valid).toBe(false);
        expect(result.reasonCode).toBe('KEY_EXPIRED');
    });

    test('U39: V2 key sem expiração (expires_at = null) é aceita', async () => {
        const hash = await bcrypt.hash(RAW_V2_KEY, 4);
        smartDb.setKeyResponse({
            rows: [{
                id: 10,
                key_hash: hash,
                key_prefix: RAW_V2_KEY.substring(0, 12),
                tenant_id: TENANT_UUID,
                status: 'active',
                expires_at: null,
                scopes: '["*"]'
            }]
        });
        smartDb.setTenantResponse({
            rows: [{ name: 'Tenant', plan: 'basic', status: 'active' }]
        });

        const result = await manager.validateKey(RAW_V2_KEY);

        expect(result.valid).toBe(true);
    });

    test('U40: Sistema desabilitado (enabled = false) retorna SYSTEM_DISABLED', async () => {
        const disabledManager = new ApiKeyManager(smartDb, false);
        const result = await disabledManager.validateKey(RAW_V2_KEY);

        expect(result.valid).toBe(false);
        expect(result.reasonCode).toBe('SYSTEM_DISABLED');
        expect(result.isInfraError).toBe(true);
    });

    test('U41: Raw key vazia ou nula retorna SYSTEM_DISABLED', async () => {
        const result1 = await manager.validateKey('');
        const result2 = await manager.validateKey(null);

        expect(result1.valid).toBe(false);
        expect(result1.reasonCode).toBe('SYSTEM_DISABLED');
        expect(result2.valid).toBe(false);
        expect(result2.reasonCode).toBe('SYSTEM_DISABLED');
    });

    test('U42: Erro de banco na consulta da credencial retorna INFRA_ERROR', async () => {
        smartDb.setKeyResponse(() => Promise.reject(new Error('Connection terminated unexpectedly')));

        const result = await manager.validateKey(RAW_V2_KEY);

        expect(result.valid).toBe(false);
        expect(result.reasonCode).toBe('INFRA_ERROR');
        expect(result.isInfraError).toBe(true);
    });

    test('U43: Cache negativo: key rejeitada é retornada do cache sem bater no banco', async () => {
        smartDb.setKeyResponse({ rows: [] }); // key not found

        const res1 = await manager.validateKey(RAW_V2_KEY);
        expect(res1.valid).toBe(false);

        // Segunda chamada imediata
        const res2 = await manager.validateKey(RAW_V2_KEY);
        expect(res2.valid).toBe(false);
        expect(res2.reasonCode).toBe('KEY_NOT_FOUND');
        expect(smartDb.query).toHaveBeenCalledTimes(1); // Somente 1 consulta ao DB
    });

    test('U44: Cache positivo: não recalcula bcrypt, mas SEMPRE consulta banco para tenant', async () => {
        const hash = await bcrypt.hash(RAW_V2_KEY, 4);
        smartDb.setKeyResponse({
            rows: [{
                id: 10,
                key_hash: hash,
                key_prefix: RAW_V2_KEY.substring(0, 12),
                tenant_id: TENANT_UUID,
                status: 'active',
                expires_at: null,
                scopes: '["*"]'
            }]
        });
        smartDb.setTenantResponse({
            rows: [{ name: 'Tenant A', plan: 'basic', status: 'active' }]
        });

        // 1ª Validação: bcrypt + tenant check
        const res1 = await manager.validateKey(RAW_V2_KEY);
        expect(res1.valid).toBe(true);

        // 2ª Validação com plano atualizado no banco
        smartDb.setTenantResponse({
            rows: [{ name: 'Tenant A Novo Nome', plan: 'enterprise', status: 'active' }]
        });

        const res2 = await manager.validateKey(RAW_V2_KEY);
        expect(res2.valid).toBe(true);
        expect(res2.tenantName).toBe('Tenant A Novo Nome');
        expect(res2.tenantPlan).toBe('enterprise');
    });

    test('U45: Cache positivo: tenant suspenso no banco após cache hit da credencial é rejeitado em tempo real', async () => {
        const hash = await bcrypt.hash(RAW_V2_KEY, 4);
        smartDb.setKeyResponse({
            rows: [{
                id: 10,
                key_hash: hash,
                key_prefix: RAW_V2_KEY.substring(0, 12),
                tenant_id: TENANT_UUID,
                status: 'active',
                expires_at: null,
                scopes: '["*"]'
            }]
        });
        smartDb.setTenantResponse({
            rows: [{ name: 'Tenant A', plan: 'basic', status: 'active' }]
        });

        // 1ª Validação: válida
        const res1 = await manager.validateKey(RAW_V2_KEY);
        expect(res1.valid).toBe(true);

        // Tenant suspenso no banco no instante seguinte
        smartDb.setTenantResponse({
            rows: [{ name: 'Tenant A', plan: 'basic', status: 'suspended' }]
        });

        const res2 = await manager.validateKey(RAW_V2_KEY);
        expect(res2.valid).toBe(false);
        expect(res2.reasonCode).toBe('TENANT_SUSPENDED');
    });

    test('U46: Cache positivo: tenant inexistente no banco após cache hit é rejeitado', async () => {
        const hash = await bcrypt.hash(RAW_V2_KEY, 4);
        smartDb.setKeyResponse({
            rows: [{
                id: 10,
                key_hash: hash,
                key_prefix: RAW_V2_KEY.substring(0, 12),
                tenant_id: TENANT_UUID,
                status: 'active',
                expires_at: null,
                scopes: '["*"]'
            }]
        });
        smartDb.setTenantResponse({
            rows: [{ name: 'Tenant A', plan: 'basic', status: 'active' }]
        });

        await manager.validateKey(RAW_V2_KEY);

        // Tenant excluído do banco
        smartDb.setTenantResponse({ rows: [] });

        const res2 = await manager.validateKey(RAW_V2_KEY);
        expect(res2.valid).toBe(false);
        expect(res2.reasonCode).toBe('TENANT_NOT_FOUND');
    });

    test('U47: Cache positivo: erro de banco no tenant check durante cache hit retorna INFRA_ERROR', async () => {
        const hash = await bcrypt.hash(RAW_V2_KEY, 4);
        smartDb.setKeyResponse({
            rows: [{
                id: 10,
                key_hash: hash,
                key_prefix: RAW_V2_KEY.substring(0, 12),
                tenant_id: TENANT_UUID,
                status: 'active',
                expires_at: null,
                scopes: '["*"]'
            }]
        });
        smartDb.setTenantResponse({
            rows: [{ name: 'Tenant A', plan: 'basic', status: 'active' }]
        });

        await manager.validateKey(RAW_V2_KEY);

        // Banco falha na 2ª checagem
        smartDb.setTenantResponse(() => Promise.reject(new Error('DB unavailable')));

        const res2 = await manager.validateKey(RAW_V2_KEY);
        expect(res2.valid).toBe(false);
        expect(res2.reasonCode).toBe('INFRA_ERROR');
        expect(res2.isInfraError).toBe(true);
    });

    test('U48: Revogação via revokeKey limpa o cache de validação', async () => {
        const hash = await bcrypt.hash(RAW_V2_KEY, 4);
        smartDb.setKeyResponse({
            rows: [{
                id: 10,
                key_hash: hash,
                key_prefix: RAW_V2_KEY.substring(0, 12),
                tenant_id: TENANT_UUID,
                status: 'active',
                expires_at: null,
                scopes: '["*"]'
            }]
        });
        smartDb.setTenantResponse({
            rows: [{ name: 'Tenant A', plan: 'basic', status: 'active' }]
        });

        await manager.validateKey(RAW_V2_KEY);
        expect(manager.validationCache.size).toBe(1);

        await manager.revokeKey(10);

        expect(manager.validationCache.size).toBe(0);
    });

    test('U49: Rotação via rotateKey limpa o cache de validação', async () => {
        manager.validationCache.set('old-key', { result: { valid: true }, timestamp: Date.now() });
        expect(manager.validationCache.size).toBe(1);

        // Mock rotateKey queries
        smartDb.setKeyResponse((sql) => {
            if (sql.includes('SELECT * FROM api_keys_v2')) {
                return { rows: [{ id: 10, name: 'Key', scopes: '["*"]', allowed_ips: '[]', allowed_domains: '[]' }] };
            }
            if (sql.includes('INSERT INTO api_keys_v2')) {
                return { rows: [{ id: 11, key_prefix: 'lm_live_newk', tenant_id: TENANT_UUID, name: 'Rotated' }] };
            }
            return { rows: [] };
        });

        await manager.rotateKey(TENANT_UUID, 10);
        expect(manager.validationCache.size).toBe(0);
    });

    test('U50: checkScope funciona com wildcard e scopes específicos', () => {
        expect(manager.checkScope(['*'], 'admin:write')).toBe(true);
        expect(manager.checkScope(['read', 'write'], 'read')).toBe(true);
        expect(manager.checkScope(['read'], 'write')).toBe(false);
        expect(manager.checkScope(null, 'read')).toBe(true);
    });

    test('U51: checkOrigin valida allowedIps e allowedDomains', () => {
        const keyData = {
            allowedIps: ['192.168.1.1'],
            allowedDomains: ['example.com']
        };

        expect(manager.checkOrigin(keyData, '192.168.1.1', 'example.com').allowed).toBe(true);
        expect(manager.checkOrigin(keyData, '10.0.0.1', 'example.com').allowed).toBe(false);
        expect(manager.checkOrigin(keyData, '192.168.1.1', 'malicious.com').allowed).toBe(false);
    });

    test('U71 (OBRIGATÓRIO): Cache hit V2 com expiração futura continua válido', async () => {
        const futureDate = new Date(Date.now() + 600000).toISOString();
        const hash = await bcrypt.hash(RAW_V2_KEY, 4);

        smartDb.setKeyResponse({
            rows: [{
                id: 10,
                key_hash: hash,
                key_prefix: RAW_V2_KEY.substring(0, 12),
                tenant_id: TENANT_UUID,
                status: 'active',
                expires_at: futureDate,
                scopes: '["*"]'
            }]
        });
        smartDb.setTenantResponse({
            rows: [{ name: 'Tenant A', plan: 'pro', status: 'active' }]
        });

        // 1ª Validação: insere no cache com expiresAt futuro
        const res1 = await manager.validateKey(RAW_V2_KEY);
        expect(res1.valid).toBe(true);

        // 2ª Validação: cache hit, tenant check do banco
        smartDb.setTenantResponse({
            rows: [{ name: 'Tenant A', plan: 'pro', status: 'active' }]
        });

        const res2 = await manager.validateKey(RAW_V2_KEY);
        expect(res2.valid).toBe(true);
        expect(res2.tenantPlan).toBe('pro');
    });

    test('U72 (OBRIGATÓRIO): Cache hit V2 com expiração passada é rejeitado imediatamente com remoção da entrada', async () => {
        // Criar entrada em cache com expiresAt que expira em 50ms
        const expiryDate = new Date(Date.now() + 50);
        manager.validationCache.set(RAW_V2_KEY, {
            result: {
                valid: true,
                keyId: 10,
                tenantId: TENANT_UUID,
                expiresAt: expiryDate.toISOString(),
                scopes: ['*']
            },
            timestamp: Date.now()
        });

        // Aguardar passar da expiração
        await new Promise(r => setTimeout(r, 60));

        const res = await manager.validateKey(RAW_V2_KEY);

        expect(res.valid).toBe(false);
        expect(res.reasonCode).toBe('KEY_EXPIRED');
        expect(manager.validationCache.has(RAW_V2_KEY)).toBe(false); // Entrada deletada do cache
    });
});

// ═══════════════════════════════════════════════════════════
// SUÍTE 2: server.js — validateApiKey()
// ═══════════════════════════════════════════════════════════

describe('FASE 2C.1 — server.js (validateApiKey)', () => {
    test('U21: validateApiKey com key válida retorna objeto canônico de tenant', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: true,
                tenantId: 'uuid-1234',
                tenantName: 'Clínica Bem Estar',
                tenantPlan: 'enterprise',
                tenantStatus: 'active',
                keyId: 42,
                scopes: ['all']
            })
        };
        const env = createMiddlewareEnv(managerMock);

        const res = await env.validateApiKey('lm_live_xyz123');

        expect(res.success).toBe(true);
        expect(res.tenant).toEqual({
            id: 'uuid-1234',
            name: 'Clínica Bem Estar',
            plan: 'enterprise',
            status: 'active',
            apiKey: 'lm_live_xyz123',
            scopes: ['all'],
            allowedIps: [],
            allowedDomains: [],
            keyId: 42
        });
    });

    test('U22: validateApiKey propaga tenantStatus real sem hardcode active', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: true,
                tenantId: 'uuid-1234',
                tenantName: 'Clínica',
                tenantPlan: 'pro',
                tenantStatus: 'active',
                keyId: 42,
                scopes: ['*']
            })
        };
        const env = createMiddlewareEnv(managerMock);

        const res = await env.validateApiKey('lm_live_xyz123');
        expect(res.tenant.status).toBe('active');
    });

    test('U52: validateApiKey propaga reasonCode e isInfraError em falha de infra', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: false,
                reason: 'Erro ao verificar status do tenant',
                reasonCode: 'INFRA_ERROR',
                isInfraError: true
            })
        };
        const env = createMiddlewareEnv(managerMock);

        const res = await env.validateApiKey('lm_live_xyz123');

        expect(res.success).toBe(false);
        expect(res.reasonCode).toBe('INFRA_ERROR');
        expect(res.isInfraError).toBe(true);
    });

    test('U53: validateApiKey propaga TENANT_SUSPENDED em suspensão', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: false,
                reason: 'Tenant suspenso ou inativo',
                reasonCode: 'TENANT_SUSPENDED',
                isInfraError: false
            })
        };
        const env = createMiddlewareEnv(managerMock);

        const res = await env.validateApiKey('lm_live_xyz123');

        expect(res.success).toBe(false);
        expect(res.reasonCode).toBe('TENANT_SUSPENDED');
    });

    test('U54: validateApiKey catch geral retorna INFRA_ERROR fail-closed', async () => {
        const managerMock = {
            validateKey: jest.fn().mockRejectedValue(new Error('Fatal unhandled error'))
        };
        const env = createMiddlewareEnv(managerMock);

        const res = await env.validateApiKey('lm_live_xyz123');

        expect(res.success).toBe(false);
        expect(res.reasonCode).toBe('INFRA_ERROR');
        expect(res.isInfraError).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════
// SUÍTE 3: server.js — requireApiKey() (Middleware V1)
// ═══════════════════════════════════════════════════════════

describe('FASE 2C.1 — server.js (requireApiKey)', () => {
    test('U23: Key válida propaga sessão completa, req.cliente e chama next()', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: true,
                tenantId: 'uuid-canonical',
                tenantName: 'Tenant Real',
                tenantPlan: 'pro',
                tenantStatus: 'active',
                keyId: 99,
                scopes: ['*']
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const { req, res, next } = createMockReqRes({ apiKey: 'valid-api-key' });

        await env.requireApiKey(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(req.session.tenantId).toBe('uuid-canonical');
        expect(req.session.plan).toBe('pro');
        expect(req.session.status).toBe('active');
        expect(req.cliente.id).toBe('uuid-canonical');
        expect(req.cliente.plan).toBe('pro');
    });

    test('U26: Key com erro de infra retorna HTTP 503 e NÃO chama next()', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: false,
                reason: 'Erro interno na validação',
                reasonCode: 'INFRA_ERROR',
                isInfraError: true
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const { req, res, next } = createMockReqRes({ apiKey: 'some-key' });

        await env.requireApiKey(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(503);
        expect(res._json.error).toMatch(/temporariamente indispon/);
    });

    test('U27: Key de tenant suspenso retorna HTTP 403 e NÃO chama next()', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: false,
                reason: 'Tenant suspenso ou inativo',
                reasonCode: 'TENANT_SUSPENDED'
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const { req, res, next } = createMockReqRes({ apiKey: 'some-key' });

        await env.requireApiKey(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(403);
        expect(res._json.error).toBe('Tenant suspenso ou inativo');
    });

    test('U28: Key inválida/revogada retorna HTTP 401 e NÃO chama next()', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: false,
                reason: 'Key revogada ou inativa',
                reasonCode: 'KEY_REVOKED'
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const { req, res, next } = createMockReqRes({ apiKey: 'revoked-key' });

        await env.requireApiKey(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
    });

    test('U24: Sessão existente revalidada reconstrói clientData com dados do banco e chama next()', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: true,
                tenantId: 'uuid-1234',
                tenantName: 'Nome do Banco',
                tenantPlan: 'enterprise',
                tenantStatus: 'active',
                keyId: 'k-1',
                scopes: ['*']
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const { req, res, next } = createMockReqRes({
            session: {
                tenantId: 'uuid-1234',
                validatedApiKey: 'lm_live_sessionkey',
                clientData: { plan: 'basic_old', name: 'Nome Antigo' },
                destroy: jest.fn()
            }
        });

        await env.requireApiKey(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(req.cliente.name).toBe('Nome do Banco');
        expect(req.cliente.plan).toBe('enterprise');
        expect(req.session.plan).toBe('enterprise');
    });

    test('U25: Sessão existente com divergência de UUID destrói sessão e redireciona', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: true,
                tenantId: 'outro-uuid-divergente',
                tenantName: 'Outro Tenant',
                tenantPlan: 'basic',
                tenantStatus: 'active'
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const destroyMock = jest.fn();
        const { req, res, next } = createMockReqRes({
            session: {
                tenantId: 'uuid-original',
                validatedApiKey: 'lm_live_sessionkey',
                destroy: destroyMock
            }
        });

        await env.requireApiKey(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(destroyMock).toHaveBeenCalledTimes(1);
        expect(res._redirect).toBe('/?error=key_revoked');
    });

    test('U55: Sessão existente com key revogada destrói sessão e redireciona', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: false,
                reason: 'Key revogada',
                reasonCode: 'KEY_REVOKED'
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const destroyMock = jest.fn();
        const { req, res, next } = createMockReqRes({
            session: {
                tenantId: 'uuid-original',
                validatedApiKey: 'revoked-session-key',
                destroy: destroyMock
            }
        });

        await env.requireApiKey(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(destroyMock).toHaveBeenCalledTimes(1);
        expect(res._redirect).toBe('/?error=key_revoked');
    });

    test('U56: Sessão existente com erro de infra na revalidação retorna 503 e preserva sessão', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: false,
                reason: 'DB connection error',
                reasonCode: 'INFRA_ERROR',
                isInfraError: true
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const destroyMock = jest.fn();
        const { req, res, next } = createMockReqRes({
            session: {
                tenantId: 'uuid-original',
                validatedApiKey: 'key',
                destroy: destroyMock
            }
        });

        await env.requireApiKey(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(destroyMock).not.toHaveBeenCalled(); // Não destrói sessão em erro transitório
        expect(res.statusCode).toBe(503);
    });

    test('U57: Sem key e sem sessão redireciona para login /', async () => {
        const env = createMiddlewareEnv({});
        const { req, res, next } = createMockReqRes();

        await env.requireApiKey(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res._redirect).toBe('/');
    });

    test('U58: Rotas públicas em publicPaths executam bypass e chamam next()', async () => {
        const env = createMiddlewareEnv({});
        const { req, res, next } = createMockReqRes({ path: '/health' });

        await env.requireApiKey(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
    });
});

// ═══════════════════════════════════════════════════════════
// SUÍTE 4: server.js — requireApiKeyV3() (Middleware V3)
// ═══════════════════════════════════════════════════════════

describe('FASE 2C.1 — server.js (requireApiKeyV3)', () => {
    test('U59: Key fornecida válida propaga req.session.tenantId (UUID canônico) e chama next()', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: true,
                tenantId: 'uuid-canonica-v3',
                tenantName: 'Tenant V3 Corp',
                tenantPlan: 'enterprise',
                tenantStatus: 'active',
                keyId: 501,
                scopes: ['chat', 'leads']
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const { req, res, next } = createMockReqRes({ apiKey: 'lm_live_v3key' });

        await env.requireApiKeyV3(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(req.session.tenantId).toBe('uuid-canonica-v3');
        expect(req.session.plan).toBe('enterprise');
        expect(req.session.status).toBe('active');
        expect(req.cliente.id).toBe('uuid-canonica-v3');
        expect(req.cliente.scopes).toEqual(['chat', 'leads']);
    });

    test('U60: Key fornecida com falha de infra retorna 503 e NUNCA chama next()', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: false,
                reason: 'Erro no pool',
                reasonCode: 'INFRA_ERROR',
                isInfraError: true
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const { req, res, next } = createMockReqRes({ apiKey: 'lm_live_v3key' });

        await env.requireApiKeyV3(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(503);
        expect(res._json.error).toMatch(/temporariamente indispon/);
    });

    test('U61: Key fornecida com tenant suspenso retorna 403 e NUNCA chama next()', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: false,
                reason: 'Tenant suspenso ou inativo',
                reasonCode: 'TENANT_SUSPENDED'
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const { req, res, next } = createMockReqRes({ apiKey: 'lm_live_v3key' });

        await env.requireApiKeyV3(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(403);
        expect(res._json.error).toBe('Tenant suspenso ou inativo');
    });

    test('U62: Key fornecida com credencial inválida/revogada/expirada retorna 401 e NUNCA chama next()', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: false,
                reason: 'Key expirada ou com expiração inválida',
                reasonCode: 'KEY_EXPIRED'
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const { req, res, next } = createMockReqRes({ apiKey: 'lm_live_expired' });

        await env.requireApiKeyV3(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
    });

    test('U63: Sessão existente válida revalida no banco, atualiza dados canônicos e chama next()', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: true,
                tenantId: 'uuid-v3-canonical',
                tenantName: 'Nome Atualizado do Banco',
                tenantPlan: 'enterprise_plus',
                tenantStatus: 'active',
                keyId: 777,
                scopes: ['*']
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const { req, res, next } = createMockReqRes({
            session: {
                tenantId: 'uuid-v3-canonical',
                validatedApiKey: 'lm_live_sessionsaved',
                clientData: { name: 'Nome Antigo', plan: 'basic' }
            }
        });

        await env.requireApiKeyV3(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(req.session.tenantId).toBe('uuid-v3-canonical');
        expect(req.session.plan).toBe('enterprise_plus');
        expect(req.session.status).toBe('active');
        expect(req.cliente.name).toBe('Nome Atualizado do Banco');
        expect(req.cliente.plan).toBe('enterprise_plus');
    });

    test('U64: Sessão existente antiga (sem tenantId anterior) recebe tenantId revalidado pela 1ª vez e chama next()', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: true,
                tenantId: 'uuid-atribuido-agora',
                tenantName: 'Tenant Antigo Sem UUID',
                tenantPlan: 'basic',
                tenantStatus: 'active',
                keyId: 100,
                scopes: ['*']
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const { req, res, next } = createMockReqRes({
            session: {
                // tenantId ausente (sessão antiga de antes da Fase 2C.1)
                validatedApiKey: 'lm_live_oldsession'
            }
        });

        await env.requireApiKeyV3(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(req.session.tenantId).toBe('uuid-atribuido-agora');
        expect(req.cliente.id).toBe('uuid-atribuido-agora');
    });

    test('U65: Sessão existente com divergência de UUID destrói sessão, retorna 401 e NUNCA chama next()', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: true,
                tenantId: 'uuid-diferente-do-salvo',
                tenantName: 'Outro Tenant',
                tenantPlan: 'basic',
                tenantStatus: 'active'
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const destroyMock = jest.fn();
        const { req, res, next } = createMockReqRes({
            session: {
                tenantId: 'uuid-original-esperado',
                validatedApiKey: 'lm_live_somekey',
                destroy: destroyMock
            }
        });

        await env.requireApiKeyV3(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(destroyMock).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBe(401);
        expect(res._json.error).toMatch(/inválida/);
    });

    test('U66: Sessão existente com tenant suspenso destrói sessão, retorna 403 e NUNCA chama next()', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: false,
                reason: 'Tenant suspenso ou inativo',
                reasonCode: 'TENANT_SUSPENDED'
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const destroyMock = jest.fn();
        const { req, res, next } = createMockReqRes({
            session: {
                tenantId: 'uuid-suspenso',
                validatedApiKey: 'lm_live_somekey',
                destroy: destroyMock
            }
        });

        await env.requireApiKeyV3(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(destroyMock).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBe(403);
        expect(res._json.error).toMatch(/suspensa/);
    });

    test('U67: Sessão existente com credencial revogada destrói sessão, retorna 401 e NUNCA chama next()', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: false,
                reason: 'Key revogada',
                reasonCode: 'KEY_REVOKED'
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const destroyMock = jest.fn();
        const { req, res, next } = createMockReqRes({
            session: {
                tenantId: 'uuid-revogado',
                validatedApiKey: 'lm_live_somekey',
                destroy: destroyMock
            }
        });

        await env.requireApiKeyV3(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(destroyMock).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBe(401);
        expect(res._json.error).toMatch(/expirada ou revogada/);
    });

    test('U68: Sessão existente com falha de infra na revalidação retorna 503, preserva sessão e NUNCA chama next()', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: false,
                reason: 'Falha de conexão com banco de dados',
                reasonCode: 'INFRA_ERROR',
                isInfraError: true
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const destroyMock = jest.fn();
        const { req, res, next } = createMockReqRes({
            session: {
                tenantId: 'uuid-ok',
                validatedApiKey: 'lm_live_somekey',
                destroy: destroyMock
            }
        });

        await env.requireApiKeyV3(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(destroyMock).not.toHaveBeenCalled(); // Preserva sessão
        expect(res.statusCode).toBe(503);
    });

    test('U69: Sem key e sem sessão retorna 401 e NUNCA chama next()', async () => {
        const env = createMiddlewareEnv({});
        const { req, res, next } = createMockReqRes();

        await env.requireApiKeyV3(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
    });

    test('U70: Erro inesperado no try/catch retorna 503 e NUNCA chama next() (fail-closed absoluto)', async () => {
        const env = createMiddlewareEnv({});
        const res = {
            statusCode: 200,
            status: function(code) { this.statusCode = code; return this; },
            json: function(data) { this._json = data; return this; }
        };
        const next = jest.fn();
        const badReq = {
            get query() { throw new Error('Crash catastrófico no middleware'); }
        };

        await env.requireApiKeyV3(badReq, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(503);
        expect(res._json.error).toMatch(/Erro interno na autenticação/);
    });

    // ═══════════════════════════════════════════════════════════
    // FASE 2C.1 — PONTOS RESIDUAIS REVISÃO CORRETIVA FINAL (U73-U81)
    // ═══════════════════════════════════════════════════════════

    test('U73 (PONTO 1): Sessão antiga V1 sem tenantId mas com validatedApiKey recupera UUID canônico do banco e chama next()', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: true,
                tenantId: 'uuid-canonical-recovered',
                tenantName: 'Tenant Recuperado',
                tenantPlan: 'pro',
                tenantStatus: 'active',
                keyId: 'k-leg-1',
                scopes: ['*'],
                allowedIps: [],
                allowedDomains: []
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const { req, res, next } = createMockReqRes({
            session: {
                // Sem req.session.tenantId (sessão antiga pré-2C.1)
                validatedApiKey: 'LMV7-OLD-SESSION-KEY',
                destroy: jest.fn()
            }
        });

        await env.requireApiKey(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(req.session.tenantId).toBe('uuid-canonical-recovered');
        expect(req.session.plan).toBe('pro');
        expect(req.session.status).toBe('active');
        expect(req.cliente.id).toBe('uuid-canonical-recovered');
        expect(req.session.clientData.id).toBe('uuid-canonical-recovered');
    });

    test('U74 (PONTO 2): getApiKeyManager() lançando exceção em requireApiKey é capturado no try/catch e retorna 503', async () => {
        const sandbox = {
            getApiKeyManager: () => {
                throw new Error('Postgres connection pool not initialized');
            },
            logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
            console: { log: jest.fn(), warn: jest.fn(), error: jest.fn() }
        };
        vm.createContext(sandbox);
        const validateApiKeySrc = extractServerFunction('validateApiKey');
        const requireApiKeySrc = extractServerFunction('requireApiKey');
        vm.runInContext(validateApiKeySrc, sandbox);
        vm.runInContext(requireApiKeySrc, sandbox);

        const { req, res, next } = createMockReqRes({
            session: {
                validatedApiKey: 'lm_live_session'
            }
        });

        await sandbox.requireApiKey(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(503);
        expect(res._json.error).toMatch(/temporariamente indispon/);
    });

    test('U75 (PONTO 3): requireApiKey ignora esquema não-Bearer (ex: Basic) e autentica Bearer válido', async () => {
        const managerMock = {
            validateKey: jest.fn().mockImplementation(async (key) => {
                if (key === 'lm_live_bearer_valid') {
                    return {
                        valid: true,
                        tenantId: 'uuid-bearer',
                        tenantName: 'Bearer Tenant',
                        tenantPlan: 'pro',
                        tenantStatus: 'active',
                        keyId: 88,
                        scopes: ['*'],
                        allowedIps: [],
                        allowedDomains: []
                    };
                }
                return { valid: false, reason: 'Invalid key', reasonCode: 'KEY_NOT_FOUND' };
            })
        };
        const env = createMiddlewareEnv(managerMock);

        // Caso 1: Authorization com esquema Basic não é interpretado como API key
        const reqResBasic = createMockReqRes({
            headers: { authorization: 'Basic dXNlcjpwYXNz' }
        });
        await env.requireApiKey(reqResBasic.req, reqResBasic.res, reqResBasic.next);
        expect(reqResBasic.next).not.toHaveBeenCalled();
        expect(reqResBasic.res._redirect).toBe('/');

        // Caso 2: Authorization com Bearer válido é extraído e aceito
        const reqResBearer = createMockReqRes({
            headers: { authorization: 'Bearer lm_live_bearer_valid' }
        });
        await env.requireApiKey(reqResBearer.req, reqResBearer.res, reqResBearer.next);
        expect(reqResBearer.next).toHaveBeenCalledTimes(1);
        expect(reqResBearer.req.session.tenantId).toBe('uuid-bearer');
    });

    test('U76 (PONTO 3): requireApiKeyV3 ignora esquema não-Bearer (ex: Basic) e autentica Bearer válido', async () => {
        const managerMock = {
            validateKey: jest.fn().mockImplementation(async (key) => {
                if (key === 'lm_live_bearer_v3') {
                    return {
                        valid: true,
                        tenantId: 'uuid-v3-bearer',
                        tenantName: 'Bearer V3 Tenant',
                        tenantPlan: 'enterprise',
                        tenantStatus: 'active',
                        keyId: 99,
                        scopes: ['v3:read'],
                        allowedIps: [],
                        allowedDomains: []
                    };
                }
                return { valid: false, reason: 'Invalid key', reasonCode: 'KEY_NOT_FOUND' };
            })
        };
        const env = createMiddlewareEnv(managerMock);

        // Caso 1: Basic auth -> 401
        const reqResBasic = createMockReqRes({
            headers: { authorization: 'Basic dXNlcjpwYXNz' }
        });
        await env.requireApiKeyV3(reqResBasic.req, reqResBasic.res, reqResBasic.next);
        expect(reqResBasic.next).not.toHaveBeenCalled();
        expect(reqResBasic.res.statusCode).toBe(401);

        // Caso 2: Bearer auth -> 200 / next()
        const reqResBearer = createMockReqRes({
            headers: { authorization: 'Bearer lm_live_bearer_v3' }
        });
        await env.requireApiKeyV3(reqResBearer.req, reqResBearer.res, reqResBearer.next);
        expect(reqResBearer.next).toHaveBeenCalledTimes(1);
        expect(reqResBearer.req.session.tenantId).toBe('uuid-v3-bearer');
    });

    test('U77 (PONTO 4): validateApiKey preserva allowedIps e allowedDomains no tenant', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: true,
                tenantId: 'uuid-ips-test',
                tenantName: 'Tenant IP Restricted',
                tenantPlan: 'enterprise',
                tenantStatus: 'active',
                keyId: 101,
                scopes: ['api:all'],
                allowedIps: ['192.168.1.100', '10.0.0.1'],
                allowedDomains: ['app.example.com', 'admin.example.com']
            })
        };
        const env = createMiddlewareEnv(managerMock);

        const res = await env.validateApiKey('lm_live_restricted_key');

        expect(res.success).toBe(true);
        expect(res.tenant.allowedIps).toEqual(['192.168.1.100', '10.0.0.1']);
        expect(res.tenant.allowedDomains).toEqual(['app.example.com', 'admin.example.com']);
    });

    test('U78 (PONTO 4): Credenciais V1 retornam allowedIps: [] e allowedDomains: [] por padrão', async () => {
        const smartDb = createSmartDbMock();
        const manager = new ApiKeyManager(smartDb, true);
        smartDb.setKeyResponse({
            rows: [{
                id: 'v1_key_id',
                key_value: 'LMV7-LEGACY-KEY-TEST',
                tenant_id: 'uuid-leg-1',
                active: true
            }]
        });
        smartDb.setTenantResponse({
            rows: [{ name: 'Legado Tenant', plan: 'basic', status: 'active' }]
        });

        const res = await manager.validateKey('LMV7-LEGACY-KEY-TEST');

        expect(res.valid).toBe(true);
        expect(res.allowedIps).toEqual([]);
        expect(res.allowedDomains).toEqual([]);
        expect(Array.isArray(res.allowedIps)).toBe(true);
        expect(Array.isArray(res.allowedDomains)).toBe(true);
    });

    test('U79 (PONTO 5): requireApiKey detecta divergência entre clientData.id antigo e UUID revalidado', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: true,
                tenantId: 'uuid-BBB-banco',
                tenantName: 'Tenant Divergente',
                tenantPlan: 'basic',
                tenantStatus: 'active'
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const destroyMock = jest.fn();
        const { req, res, next } = createMockReqRes({
            session: {
                // Sessão antiga sem req.session.tenantId, mas com clientData.id
                clientData: { id: 'uuid-AAA-antigo' },
                validatedApiKey: 'lm_live_session',
                destroy: destroyMock
            }
        });

        await env.requireApiKey(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(destroyMock).toHaveBeenCalledTimes(1);
        expect(res._redirect).toBe('/?error=key_revoked');
    });

    test('U80 (PONTO 5): requireApiKeyV3 detecta divergência entre clientData.id antigo e UUID revalidado', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: true,
                tenantId: 'uuid-BBB-banco',
                tenantName: 'Tenant Divergente',
                tenantPlan: 'basic',
                tenantStatus: 'active'
            })
        };
        const env = createMiddlewareEnv(managerMock);
        const destroyMock = jest.fn();
        const { req, res, next } = createMockReqRes({
            session: {
                // Sessão antiga sem req.session.tenantId, mas com clientData.id
                clientData: { id: 'uuid-AAA-antigo' },
                validatedApiKey: 'lm_live_session',
                destroy: destroyMock
            }
        });

        await env.requireApiKeyV3(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(destroyMock).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBe(401);
        expect(res._json.error).toMatch(/Sessão inválida/);
    });

    test('U81 (PONTO 6): Fallback de plano - tenant.plan nulo no banco resulta em basic seguro', async () => {
        const smartDb = createSmartDbMock();
        const manager = new ApiKeyManager(smartDb, true);
        const RAW_V2 = 'lm_live_test_plan_fallback_123';
        const hash = await bcrypt.hash(RAW_V2, 4);

        smartDb.setKeyResponse({
            rows: [{
                id: 200,
                key_hash: hash,
                key_prefix: RAW_V2.substring(0, 12),
                tenant_id: 'uuid-plan-fallback',
                status: 'active',
                expires_at: null,
                scopes: ['*']
            }]
        });
        smartDb.setTenantResponse({
            rows: [{
                name: 'Tenant Sem Plano Explícito',
                plan: null,
                status: 'active'
            }]
        });

        const res = await manager.validateKey(RAW_V2);

        expect(res.valid).toBe(true);
        expect(res.tenantPlan).toBe('basic');
    });


    // ═══════════════════════════════════════════════════════════
    // FASE 2C.1 — CUIDADO A: DESTRUIÇÃO ASSÍNCRONA DE SESSÃO
    // ═══════════════════════════════════════════════════════════

    test('U82 (CUIDADO A): requireApiKey aguarda efetivamente o callback assíncrono de destroy() antes de redirecionar', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: false,
                reason: 'Key revogada',
                reasonCode: 'KEY_REVOKED'
            })
        };
        const env = createMiddlewareEnv(managerMock);

        let destroyCallbackFinished = false;
        let redirectCalledAfterDestroy = false;

        const destroyMock = jest.fn((callback) => {
            setTimeout(() => {
                destroyCallbackFinished = true;
                if (typeof callback === 'function') callback();
            }, 30);
        });

        const req = {
            path: '/dashboard',
            headers: {},
            query: {},
            body: {},
            session: {
                tenantId: 'uuid-test',
                validatedApiKey: 'lm_live_session',
                destroy: destroyMock
            }
        };

        const res = {
            statusCode: 200,
            _redirect: null,
            redirect: function(url) {
                redirectCalledAfterDestroy = destroyCallbackFinished;
                this._redirect = url;
                return this;
            }
        };
        const next = jest.fn();

        await env.requireApiKey(req, res, next);

        expect(destroyMock).toHaveBeenCalledTimes(1);
        expect(destroyCallbackFinished).toBe(true);
        expect(redirectCalledAfterDestroy).toBe(true);
        expect(res._redirect).toBe('/?error=key_revoked');
    });

    test('U83 (CUIDADO A): requireApiKeyV3 aguarda efetivamente o callback assíncrono de destroy() antes de responder 401', async () => {
        const managerMock = {
            validateKey: jest.fn().mockResolvedValue({
                valid: false,
                reason: 'Key expirada',
                reasonCode: 'KEY_EXPIRED'
            })
        };
        const env = createMiddlewareEnv(managerMock);

        let destroyCallbackFinished = false;
        let responseCalledAfterDestroy = false;

        const destroyMock = jest.fn((callback) => {
            setTimeout(() => {
                destroyCallbackFinished = true;
                if (typeof callback === 'function') callback();
            }, 30);
        });

        const req = {
            path: '/api/v3/leads',
            headers: {},
            query: {},
            body: {},
            session: {
                tenantId: 'uuid-v3-test',
                validatedApiKey: 'lm_live_session',
                destroy: destroyMock
            }
        };

        const res = {
            statusCode: 200,
            _json: null,
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                responseCalledAfterDestroy = destroyCallbackFinished;
                this._json = data;
                return this;
            }
        };
        const next = jest.fn();

        await env.requireApiKeyV3(req, res, next);

        expect(destroyMock).toHaveBeenCalledTimes(1);
        expect(destroyCallbackFinished).toBe(true);
        expect(responseCalledAfterDestroy).toBe(true);
        expect(res.statusCode).toBe(401);
    });

});
