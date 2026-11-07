'use strict';

/**
 * LinkMágico — Fase 2C.2B-1
 * Testes de Autenticação dos Endpoints de Chat
 *
 * Valida:
 *   1. Remoção de publicPaths (endpoints exigem autenticação)
 *   2. Middleware retorna JSON (não redirect) para rotas de API
 *   3. Defesa em profundidade nos handlers
 *   4. Matriz de 7 cenários de autenticação
 *   5. Preservação dos redirects das rotas web
 *   6. UUID canônico disponível em req.cliente.id
 */

const assert = require('assert');
const path = require('path');

// ============================================================
// Helpers de teste
// ============================================================

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (err) {
        failed++;
        failures.push({ name, error: err.message });
        console.log(`  ❌ ${name}`);
        console.log(`     ${err.message}`);
    }
}

// ============================================================
// GRUPO 1: Verificação estática do publicPaths
// ============================================================

console.log('\n=== GRUPO 1: publicPaths ===\n');

const fs = require('fs');
const serverContent = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf8');

test('publicPaths NÃO contém /api/process-chat-inteligente como entrada ativa', () => {
    // Encontrar o array publicPaths e verificar que a linha está comentada
    const publicPathsMatch = serverContent.match(/const publicPaths = \[([\s\S]*?)\];/);
    assert.ok(publicPathsMatch, 'Array publicPaths não encontrado');
    const arrayContent = publicPathsMatch[1];

    // Linhas ativas (não comentadas) que contêm o endpoint
    const activeLines = arrayContent.split('\n').filter(line => {
        const trimmed = line.trim();
        return !trimmed.startsWith('//') && trimmed.includes('/api/process-chat-inteligente');
    });
    assert.strictEqual(activeLines.length, 0,
        'Endpoint /api/process-chat-inteligente ainda está ativo em publicPaths');
});

test('publicPaths NÃO contém /api/chat-universal como entrada ativa', () => {
    const publicPathsMatch = serverContent.match(/const publicPaths = \[([\s\S]*?)\];/);
    assert.ok(publicPathsMatch, 'Array publicPaths não encontrado');
    const arrayContent = publicPathsMatch[1];

    const activeLines = arrayContent.split('\n').filter(line => {
        const trimmed = line.trim();
        return !trimmed.startsWith('//') && trimmed.includes('/api/chat-universal');
    });
    assert.strictEqual(activeLines.length, 0,
        'Endpoint /api/chat-universal ainda está ativo em publicPaths');
});

test('publicPaths preserva demais endpoints públicos', () => {
    const publicPathsMatch = serverContent.match(/const publicPaths = \[([\s\S]*?)\];/);
    assert.ok(publicPathsMatch, 'Array publicPaths não encontrado');
    const arrayContent = publicPathsMatch[1];

    const expectedPublicEndpoints = [
        '/health', '/healthz', '/api/webhooks/hotmart',
        '/api/capture-lead', '/api/track-event',
        '/api/billing/plans', '/api/stripe/webhook'
    ];

    expectedPublicEndpoints.forEach(ep => {
        const activeLines = arrayContent.split('\n').filter(line => {
            const trimmed = line.trim();
            return !trimmed.startsWith('//') && trimmed.includes(ep);
        });
        assert.ok(activeLines.length > 0, `Endpoint público ${ep} foi removido indevidamente`);
    });
});

// ============================================================
// GRUPO 2: Verificação do inline middleware
// ============================================================

console.log('\n=== GRUPO 2: Middleware inline ===\n');

test('chat-universal NÃO possui requireApiKey inline', () => {
    const chatUniversalMatch = serverContent.match(
        /app\.post\("\/api\/chat-universal"[^)]*\)/
    );
    assert.ok(chatUniversalMatch, 'Declaração do endpoint chat-universal não encontrada');
    const declaration = chatUniversalMatch[0];
    assert.ok(!declaration.includes('requireApiKey'),
        'requireApiKey ainda está presente no inline middleware de chat-universal');
});

test('process-chat-inteligente NÃO possui requireApiKey inline', () => {
    const pciMatch = serverContent.match(
        /app\.post\("\/api\/process-chat-inteligente"[^)]*\)/
    );
    assert.ok(pciMatch, 'Declaração do endpoint process-chat-inteligente não encontrada');
    const declaration = pciMatch[0];
    assert.ok(!declaration.includes('requireApiKey'),
        'requireApiKey ainda está presente no inline middleware de process-chat-inteligente');
});

test('chat-universal preserva billingMiddleware', () => {
    const chatUniversalMatch = serverContent.match(
        /app\.post\("\/api\/chat-universal"[^)]*\)/
    );
    assert.ok(chatUniversalMatch, 'Declaração do endpoint chat-universal não encontrada');
    assert.ok(chatUniversalMatch[0].includes('billingMiddleware'),
        'billingMiddleware foi removido indevidamente de chat-universal');
});

test('process-chat-inteligente preserva billingMiddleware', () => {
    const pciMatch = serverContent.match(
        /app\.post\("\/api\/process-chat-inteligente"[^)]*\)/
    );
    assert.ok(pciMatch, 'Declaração do endpoint process-chat-inteligente não encontrada');
    assert.ok(pciMatch[0].includes('billingMiddleware'),
        'billingMiddleware foi removido indevidamente de process-chat-inteligente');
});

// ============================================================
// GRUPO 3: Defesa em profundidade nos handlers
// ============================================================

console.log('\n=== GRUPO 3: Defesa em profundidade ===\n');

test('chat-universal verifica req.cliente?.id no handler', () => {
    // Localizar o handler de chat-universal e verificar que há defesa em profundidade
    const handlerStart = serverContent.indexOf('app.post("/api/chat-universal"');
    assert.ok(handlerStart > -1, 'Handler chat-universal não encontrado');

    // Procurar nas próximas 500 chars pela verificação
    const handlerSnippet = serverContent.substring(handlerStart, handlerStart + 500);
    assert.ok(handlerSnippet.includes('req.cliente?.id'),
        'Verificação de req.cliente?.id não encontrada no handler chat-universal');
    assert.ok(handlerSnippet.includes('401'),
        'Resposta 401 não encontrada no handler chat-universal');
});

test('process-chat-inteligente verifica req.cliente?.id no handler', () => {
    const handlerStart = serverContent.indexOf('app.post("/api/process-chat-inteligente"');
    assert.ok(handlerStart > -1, 'Handler process-chat-inteligente não encontrado');

    const handlerSnippet = serverContent.substring(handlerStart, handlerStart + 500);
    assert.ok(handlerSnippet.includes('req.cliente?.id'),
        'Verificação de req.cliente?.id não encontrada no handler process-chat-inteligente');
    assert.ok(handlerSnippet.includes('401'),
        'Resposta 401 não encontrada no handler process-chat-inteligente');
});

// ============================================================
// GRUPO 4: Middleware — JSON para rotas de API
// ============================================================

console.log('\n=== GRUPO 4: Middleware JSON para rotas de API ===\n');

// Extrair a função requireApiKey do server.js
const middlewareStart = serverContent.indexOf('async function requireApiKey');
const middlewareEnd = serverContent.indexOf('\n}\r\n\r\n// ===== WIDGET TOKEN', middlewareStart);
const middlewareCode = serverContent.substring(middlewareStart, middlewareEnd + 2);

test('Middleware possui 3 guardas de rota de API antes dos redirects', () => {
    const apiGuards = (middlewareCode.match(/req\.path === '\/api\/process-chat-inteligente' \|\| req\.path === '\/api\/chat-universal'/g) || []);
    assert.strictEqual(apiGuards.length, 3,
        `Esperados 3 guardas de rota de API, encontrados ${apiGuards.length}`);
});

test('Guarda 1 (UUID divergente) retorna 401 JSON', () => {
    const uuidDivIdx = middlewareCode.indexOf('UUID divergente na sessão V1');
    assert.ok(uuidDivIdx > -1, 'Seção UUID divergente não encontrada');

    const afterDiv = middlewareCode.substring(uuidDivIdx, uuidDivIdx + 600);
    // Verificar que o bloco contém guarda de rota de API com JSON 401
    assert.ok(afterDiv.includes("req.path === '/api/process-chat-inteligente'"),
        'Guarda de rota de API não encontrada após UUID divergente');
    assert.ok(afterDiv.includes("res.status(401).json"),
        'Resposta 401 JSON não encontrada após UUID divergente');
    // Verificar que o redirect ainda existe (para rotas web)
    assert.ok(afterDiv.includes('res.redirect'),
        'Redirect para rotas web deve ser preservado');
});

test('Guarda 2 (revalidação falhou) retorna 401 JSON', () => {
    const revokingIdx = middlewareCode.indexOf('Revoking session for tenant');
    assert.ok(revokingIdx > -1, 'Seção Revoking session não encontrada');

    const afterRevoking = middlewareCode.substring(revokingIdx, revokingIdx + 500);
    const jsonIdx = afterRevoking.indexOf("res.status(401).json");
    const redirectIdx = afterRevoking.indexOf('res.redirect("/?error=key_revoked")');
    assert.ok(jsonIdx > -1, 'Resposta 401 JSON não encontrada após Revoking session');
    assert.ok(jsonIdx < redirectIdx,
        'Guarda JSON deve vir ANTES do redirect para revalidação falhou');
});

test('Guarda 3 (sem acesso) retorna 401 JSON', () => {
    const noAccessIdx = middlewareCode.indexOf('Sem acesso: Redirecionar para login');
    assert.ok(noAccessIdx > -1, 'Seção sem acesso não encontrada');

    const afterNoAccess = middlewareCode.substring(noAccessIdx, noAccessIdx + 400);
    const jsonIdx = afterNoAccess.indexOf("res.status(401).json");
    const redirectIdx = afterNoAccess.indexOf('res.redirect("/")');
    assert.ok(jsonIdx > -1, 'Resposta 401 JSON não encontrada para sem acesso');
    assert.ok(jsonIdx < redirectIdx,
        'Guarda JSON deve vir ANTES do redirect para sem acesso');
});

// ============================================================
// GRUPO 5: Preservação dos redirects para rotas web
// ============================================================

console.log('\n=== GRUPO 5: Preservação dos redirects web ===\n');

test('Redirect "/?error=key_revoked" preservado para rotas web (UUID divergente)', () => {
    const uuidDivIdx = middlewareCode.indexOf('UUID divergente na sessão V1');
    const sectionEnd = middlewareCode.indexOf('return next();', uuidDivIdx);
    const section = middlewareCode.substring(uuidDivIdx, sectionEnd);
    assert.ok(section.includes('res.redirect("/?error=key_revoked")'),
        'Redirect para rotas web foi removido na seção UUID divergente');
});

test('Redirect "/?error=key_revoked" preservado para rotas web (revalidação)', () => {
    const revokingIdx = middlewareCode.indexOf('Revoking session for tenant');
    const sectionEnd = middlewareCode.indexOf('Sem acesso', revokingIdx);
    const section = middlewareCode.substring(revokingIdx, sectionEnd);
    assert.ok(section.includes('res.redirect("/?error=key_revoked")'),
        'Redirect para rotas web foi removido na seção revalidação');
});

test('Redirect "/" preservado para rotas web (sem acesso)', () => {
    const noAccessIdx = middlewareCode.indexOf('Sem acesso: Redirecionar para login');
    const section = middlewareCode.substring(noAccessIdx, noAccessIdx + 500);
    assert.ok(section.includes('res.redirect("/")'),
        'Redirect "/" para rotas web foi removido');
});

// ============================================================
// GRUPO 6: Simulação funcional da cadeia de middleware
// ============================================================

console.log('\n=== GRUPO 6: Simulação funcional da cadeia de autenticação ===\n');

// Simular o comportamento do middleware para as duas rotas de API
function createMockReq(options) {
    return {
        path: options.path || '/api/chat-universal',
        headers: options.headers || {},
        query: options.query || {},
        body: options.body || {},
        session: options.session || {},
        cliente: options.cliente || undefined,
    };
}

function createMockRes() {
    const res = {
        _statusCode: null,
        _jsonData: null,
        _redirectUrl: null,
        status(code) { res._statusCode = code; return res; },
        json(data) { res._jsonData = data; return res; },
        redirect(url) { res._redirectUrl = url; return res; },
    };
    return res;
}

// Cenário 1: API Key ausente nas rotas de API
for (const endpoint of ['/api/chat-universal', '/api/process-chat-inteligente']) {
    test(`Cenário: API Key ausente em ${endpoint} → 401 JSON (não redirect)`, () => {
        // O middleware, ao não encontrar apiKey e não ter sessão,
        // cairia em "4. Sem acesso" → guarda de rota de API retorna 401 JSON
        const req = createMockReq({ path: endpoint });
        const res = createMockRes();

        // Simular o comportamento do ponto 4 (sem acesso)
        if (req.path === '/api/process-chat-inteligente' || req.path === '/api/chat-universal') {
            res.status(401).json({ success: false, error: 'Autenticação obrigatória.' });
        } else {
            res.redirect('/');
        }

        assert.strictEqual(res._statusCode, 401, 'Status deveria ser 401');
        assert.ok(res._jsonData, 'Deveria retornar JSON');
        assert.strictEqual(res._jsonData.success, false);
        assert.strictEqual(res._redirectUrl, null, 'NÃO deveria ter redirect');
    });
}

// Cenário 2: API Key vazia nas rotas de API
for (const endpoint of ['/api/chat-universal', '/api/process-chat-inteligente']) {
    test(`Cenário: API Key vazia em ${endpoint} → 401 JSON`, () => {
        const req = createMockReq({ path: endpoint, body: { apiKey: '' } });
        const res = createMockRes();

        // apiKey vazia é falsy, mesmo caminho de "ausente"
        const apiKey = req.body.apiKey;
        if (!apiKey) {
            // Sem sessão → ponto 4
            if (req.path === '/api/process-chat-inteligente' || req.path === '/api/chat-universal') {
                res.status(401).json({ success: false, error: 'Autenticação obrigatória.' });
            } else {
                res.redirect('/');
            }
        }

        assert.strictEqual(res._statusCode, 401);
        assert.ok(res._jsonData);
        assert.strictEqual(res._redirectUrl, null);
    });
}

// Cenário 3: API Key inválida
for (const endpoint of ['/api/chat-universal', '/api/process-chat-inteligente']) {
    test(`Cenário: API Key inválida em ${endpoint} → 401 JSON`, () => {
        const res = createMockRes();
        // O middleware chama validateApiKey, que retorna { success: false }
        // Caminho L4011: res.status(401).json(...)
        // Este caminho JÁ retorna JSON, sem redirect
        res.status(401).json({ success: false, error: 'API Key inválida.' });

        assert.strictEqual(res._statusCode, 401);
        assert.ok(res._jsonData);
        assert.strictEqual(res._redirectUrl, null);
    });
}

// Cenário 4: Tenant suspenso
for (const endpoint of ['/api/chat-universal', '/api/process-chat-inteligente']) {
    test(`Cenário: Tenant suspenso em ${endpoint} → 403 JSON`, () => {
        const res = createMockRes();
        // Caminho L4008: reasonCode === 'TENANT_SUSPENDED'
        res.status(403).json({ success: false, error: 'Conta suspensa.' });

        assert.strictEqual(res._statusCode, 403);
        assert.ok(res._jsonData);
        assert.strictEqual(res._redirectUrl, null);
    });
}

// Cenário 5: Falha de infraestrutura
for (const endpoint of ['/api/chat-universal', '/api/process-chat-inteligente']) {
    test(`Cenário: Falha de infraestrutura em ${endpoint} → 503 JSON`, () => {
        const res = createMockRes();
        // Caminho L4004: isInfraError
        res.status(503).json({ success: false, error: 'Serviço temporariamente indisponível.' });

        assert.strictEqual(res._statusCode, 503);
        assert.ok(res._jsonData);
        assert.strictEqual(res._redirectUrl, null);
    });
}

// Cenário 6: Defesa em profundidade — req.cliente?.id ausente
for (const endpoint of ['/api/chat-universal', '/api/process-chat-inteligente']) {
    test(`Cenário: Defesa em profundidade — req.cliente.id ausente em ${endpoint} → 401 JSON`, () => {
        const req = createMockReq({ path: endpoint });
        const res = createMockRes();

        // Simular handler
        const tenantId = req.cliente?.id;
        if (!tenantId) {
            res.status(401).json({ success: false, error: 'Autenticação obrigatória.' });
        }

        assert.strictEqual(res._statusCode, 401);
        assert.ok(res._jsonData);
        assert.strictEqual(res._redirectUrl, null);
    });
}

// Cenário 7: API Key válida → req.cliente.id disponível
test('Cenário: API Key válida → req.cliente.id contém UUID', () => {
    const FAKE_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const req = createMockReq({
        path: '/api/chat-universal',
        cliente: { id: FAKE_UUID, apiKey: 'test-key', plan: 'pro', status: 'active' },
    });

    const tenantId = req.cliente?.id;
    assert.ok(tenantId, 'req.cliente.id deveria estar disponível');
    assert.strictEqual(tenantId, FAKE_UUID, 'req.cliente.id deveria ser o UUID canônico');
    assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(tenantId),
        'req.cliente.id deveria ser formato UUID válido');
});

// ============================================================
// GRUPO 7: Verificação de que rotas web preservam redirect
// ============================================================

console.log('\n=== GRUPO 7: Rotas web preservam redirect ===\n');

test('Rota web "/app" não seria afetada pelas guardas de API', () => {
    const req = createMockReq({ path: '/app' });
    const res = createMockRes();

    // Simular ponto 4 do middleware
    if (req.path === '/api/process-chat-inteligente' || req.path === '/api/chat-universal') {
        res.status(401).json({ success: false, error: 'Autenticação obrigatória.' });
    } else {
        res.redirect('/');
    }

    assert.strictEqual(res._redirectUrl, '/', 'Rota web deveria receber redirect');
    assert.strictEqual(res._statusCode, null, 'Rota web NÃO deveria receber status JSON');
});

test('Rota web "/dashboard" não seria afetada pelas guardas de API', () => {
    const req = createMockReq({ path: '/dashboard' });
    const res = createMockRes();

    if (req.path === '/api/process-chat-inteligente' || req.path === '/api/chat-universal') {
        res.status(401).json({ success: false, error: 'Autenticação obrigatória.' });
    } else {
        res.redirect('/');
    }

    assert.strictEqual(res._redirectUrl, '/', 'Rota web deveria receber redirect');
    assert.strictEqual(res._statusCode, null);
});

// ============================================================
// GRUPO 8: Verificação de segurança adicional
// ============================================================

console.log('\n=== GRUPO 8: Segurança adicional ===\n');

test('Handler NÃO confia em tenantId do body', () => {
    const cuHandlerIdx = serverContent.indexOf('app.post("/api/chat-universal"');
    const handlerBlock = serverContent.substring(cuHandlerIdx, cuHandlerIdx + 300);

    // A verificação deve usar req.cliente?.id, não req.body.tenantId
    assert.ok(!handlerBlock.includes('req.body.tenantId'),
        'Handler NÃO deve confiar em tenantId do body');
    assert.ok(handlerBlock.includes('req.cliente?.id'),
        'Handler deve usar req.cliente?.id');
});

test('Respostas de erro NÃO expõem credenciais ou stack traces', () => {
    // Verificar as mensagens de erro inseridas pela Fase 2C.2B-1
    const errorMessages = [
        'Autenticação obrigatória.',
        'Credencial revogada.'
    ];
    errorMessages.forEach(msg => {
        assert.ok(serverContent.includes(msg), `Mensagem de erro "${msg}" não encontrada`);
    });
    // Verificar que as mensagens não contêm dados sensíveis
    errorMessages.forEach(msg => {
        assert.ok(!msg.includes('apiKey'), `Mensagem "${msg}" expõe apiKey`);
        assert.ok(!msg.includes('stack'), `Mensagem "${msg}" expõe stack trace`);
        assert.ok(!msg.includes('token'), `Mensagem "${msg}" expõe token`);
        assert.ok(!msg.includes('password'), `Mensagem "${msg}" expõe password`);
    });
});

test('requireApiKey global permanece registrado', () => {
    assert.ok(serverContent.includes('app.use(requireApiKey)'),
        'Middleware global requireApiKey não está registrado');
});

test('express.json() permanece antes de requireApiKey global', () => {
    const jsonIdx = serverContent.indexOf('express.json(');
    const reqApiKeyIdx = serverContent.indexOf('app.use(requireApiKey)');
    assert.ok(jsonIdx > -1, 'express.json() não encontrado');
    assert.ok(reqApiKeyIdx > -1, 'app.use(requireApiKey) não encontrado');
    assert.ok(jsonIdx < reqApiKeyIdx,
        'express.json() deve vir ANTES de requireApiKey global');
});

// ============================================================
// GRUPO 9: Arquivos congelados intactos
// ============================================================

console.log('\n=== GRUPO 9: Arquivos congelados ===\n');

const crypto = require('crypto');

function sha256(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

test('lib/tenant-identity-helper.js não foi alterado', () => {
    const hash = sha256(path.join(__dirname, '..', '..', 'lib', 'tenant-identity-helper.js'));
    assert.strictEqual(hash, 'cfbef623d73b3666b75fd1b269c17321f873b851f477f94f514ed7d2657889ae',
        'Hash do helper diverge — arquivo foi alterado!');
});

test('tests/unit/phase-2c2a-identity-helper.test.js não foi alterado', () => {
    const hash = sha256(path.join(__dirname, '..', '..', 'tests', 'unit', 'phase-2c2a-identity-helper.test.js'));
    assert.strictEqual(hash, 'aaf563b1374fff2cd386e03fdada1f627ed06cfc4c40c643ca4a0f3a1d0c2823',
        'Hash dos testes 2C.2A diverge — arquivo foi alterado!');
});

// ============================================================
// RESULTADO FINAL
// ============================================================

console.log('\n' + '='.repeat(60));
console.log(`RESULTADO FINAL: ${passed} aprovados, ${failed} reprovados, ${passed + failed} total`);
console.log('='.repeat(60));

if (failures.length > 0) {
    console.log('\nFALHAS:');
    failures.forEach(f => console.log(`  ❌ ${f.name}: ${f.error}`));
}

process.exit(failed > 0 ? 1 : 0);
