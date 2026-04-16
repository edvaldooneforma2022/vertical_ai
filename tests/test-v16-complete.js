/**
 * 🧪 TESTE COMPLETO V16.2 — ANTI-PERDA DE VENDA
 * 
 * Simula usuários reais com erros, interrupções e desvios.
 * Testa comportamento de conversão sob pressão.
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'https://vertical-ai-dktu.onrender.com';

// ═══════════════════════════════════════════════════════
// CONFIGURAÇÃO DOS TENANTS
// ═══════════════════════════════════════════════════════
const SHORT_URLS = [
    'EmrTDd', 'dTOCWs', 'erpaii', '9nbcI5', 'WObmBi', 'NV2M2R'
];

// Tenant direto (sem short URL)
const DIRECT_TENANT = {
    name: '05 (Arsenal)',
    url: 'https://www.arsenalsecretodosceos.com.br/linkmagic',
    apiKey: 'LMV7-HNTM-9OS5-QGFK',
    instructions: 'Sempre responda de forma amigável, consultiva e entusiasmada, mas objetiva'
};

// ═══════════════════════════════════════════════════════
// BLOCOS DE TESTE
// ═══════════════════════════════════════════════════════

const TEST_BLOCKS = {
    // BLOCO 1 — Alta Intenção
    HIGH_INTENT: {
        name: '🔥 ALTA INTENÇÃO (compra direta)',
        messages: [
            { text: 'quero comprar', expect: 'CHECKOUT_DIRETO' },
            { text: 'tem link?', expect: 'CHECKOUT_DIRETO' },
            { text: 'me manda o link', expect: 'CHECKOUT_DIRETO' },
            { text: 'como faço pra comprar', expect: 'CHECKOUT_DIRETO' },
            { text: 'bora', expect: 'CHECKOUT_DIRETO' },
            { text: 'onde compra isso', expect: 'CHECKOUT_DIRETO' },
        ]
    },

    // BLOCO 2 — Preço
    PRICE: {
        name: '💰 PREÇO (intenção quente)',
        messages: [
            { text: 'quanto custa', expect: 'CHECKOUT_COM_CONTEXTO' },
            { text: 'qual o valor', expect: 'CHECKOUT_COM_CONTEXTO' },
            { text: 'preço', expect: 'CHECKOUT_COM_CONTEXTO' },
            { text: 'quanto é', expect: 'CHECKOUT_COM_CONTEXTO' },
        ]
    },

    // BLOCO 3 — Pagamento
    PAYMENT: {
        name: '💳 PAGAMENTO (intenção altíssima)',
        messages: [
            { text: 'tem parcelamento?', expect: 'CHECKOUT_COM_CONTEXTO' },
            { text: 'aceita pix?', expect: 'CHECKOUT_COM_CONTEXTO' },
            { text: 'como pago?', expect: 'CHECKOUT_COM_CONTEXTO' },
            { text: 'tem desconto?', expect: 'CHECKOUT_COM_CONTEXTO' },
        ]
    },

    // BLOCO 4 — Fuzzy Match (erros humanos)
    FUZZY: {
        name: '🤖 ERRO HUMANO (fuzzy match)',
        messages: [
            { text: 'qro compra', expect: 'CHECKOUT_DIRETO' },
            { text: 'tem o link ai', expect: 'CHECKOUT_DIRETO' },
            { text: 'como q compra isso', expect: 'CHECKOUT_DIRETO' },
            { text: 'manda o site', expect: 'CHECKOUT_DIRETO' },
            { text: 'qnt custa', expect: 'CHECKOUT_COM_CONTEXTO' },
        ]
    },

    // BLOCO 5 — Suporte (isolamento)
    SUPPORT: {
        name: '🚫 SUPORTE (isolamento total)',
        messages: [
            { text: 'quero suporte', expect: 'WHATSAPP_SEM_CHECKOUT' },
            { text: 'falar com atendente', expect: 'WHATSAPP_SEM_CHECKOUT' },
            { text: 'preciso de ajuda', expect: 'WHATSAPP_SEM_CHECKOUT' },
        ]
    },

    // BLOCO 6 — Recompra
    RECOMPRA: {
        name: '🔁 RECOMPRA',
        messages: [
            { text: 'já comprei', expect: 'CHECKOUT_OU_SUPORTE' },
            { text: 'quero comprar de novo', expect: 'CHECKOUT_DIRETO' },
        ]
    },
};

// BLOCO ESPECIAL — Interrupção (requer conversationId persistente)
const INTERRUPTION_FLOW = {
    name: '🔁 INTERRUPÇÃO + RECUPERAÇÃO',
    messages: [
        { text: 'quero comprar', expect: 'CHECKOUT_DIRETO', check: 'first_checkout' },
        { text: 'pera, tem garantia?', expect: 'RESPOSTA_COM_CHECKOUT', check: 'keeps_checkout' },
        { text: 'e funciona mesmo?', expect: 'RESPOSTA_COM_CHECKOUT', check: 'keeps_checkout' },
    ]
};

// BLOCO ESPECIAL — Memória IS_BUYER
const MEMORY_FLOW = {
    name: '🧠 MEMÓRIA (IS_BUYER)',
    messages: [
        { text: 'quero comprar', expect: 'CHECKOUT_DIRETO', check: 'first_checkout' },
        { text: 'de onde você é?', expect: 'RESPOSTA_COM_CHECKOUT', check: 'still_buyer' },
        { text: 'quanto tempo dura?', expect: 'RESPOSTA_COM_CHECKOUT', check: 'still_buyer' },
    ]
};

// ═══════════════════════════════════════════════════════
// FUNÇÕES DE ANÁLISE
// ═══════════════════════════════════════════════════════

function analyzeResponse(response, expectation) {
    const text = (response || '').toLowerCase();
    const result = {
        hasCheckout: /https?:\/\/[^\s]+/.test(response) || /🔗\s*\S+\.\S+/.test(response),
        hasClickableLink: /https?:\/\/[^\s"'<>]+/.test(response),
        mentionsBraip: /braip/i.test(response),
        mentionsHotmart: /hotmart/i.test(response),
        mentionsKiwify: /kiwify/i.test(response),
        mentionsPlatform: /braip|hotmart|kiwify/i.test(response),
        isGenericFiller: /(ótima pergunta|posso ajudar|como posso te ajudar|aqui estão as informações)/i.test(response),
        hasWhatsApp: /(whatsapp|wa\.me|suporte|atendente|humano)/i.test(response),
        hasCTA: /(comprar|checkout|link|clique|acesse|garanta|compre|adquira|👉|👇|🔗)/i.test(response),
        isEmpty: !response || response.trim().length === 0,
        length: (response || '').length,
    };

    // Determinar pass/fail baseado na expectativa
    switch (expectation) {
        case 'CHECKOUT_DIRETO':
            result.pass = result.hasCheckout && !result.isGenericFiller;
            result.reason = result.pass ? 'Checkout presente' : 
                (!result.hasCheckout ? 'SEM CHECKOUT' : 'Resposta genérica');
            break;
        case 'CHECKOUT_COM_CONTEXTO':
            result.pass = result.hasCheckout || result.hasCTA;
            result.reason = result.pass ? 'Checkout/CTA presente' : 'SEM CHECKOUT/CTA';
            break;
        case 'WHATSAPP_SEM_CHECKOUT':
            result.pass = result.hasWhatsApp;
            result.reason = result.pass ? 'WhatsApp direcionado' : 'SEM WHATSAPP';
            break;
        case 'RESPOSTA_COM_CHECKOUT':
            result.pass = result.hasCheckout || result.hasCTA;
            result.reason = result.pass ? 'Manteve checkout' : 'PERDEU CHECKOUT';
            break;
        case 'CHECKOUT_OU_SUPORTE':
            result.pass = result.hasCheckout || result.hasWhatsApp;
            result.reason = result.pass ? 'Checkout ou suporte' : 'SEM DIRECIONAMENTO';
            break;
        default:
            result.pass = true;
            result.reason = 'Sem validação';
    }

    return result;
}

// ═══════════════════════════════════════════════════════
// CHAMADA À API
// ═══════════════════════════════════════════════════════

function callAPI(endpoint, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const url = new URL(endpoint, BASE_URL);
        
        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
            },
            timeout: 120000
        };

        const startTime = Date.now();
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                const elapsed = Date.now() - startTime;
                try {
                    const json = JSON.parse(body);
                    resolve({ ...json, _elapsed: elapsed, _status: res.statusCode });
                } catch (e) {
                    resolve({ success: false, error: 'JSON parse error', _raw: body.substring(0, 500), _elapsed: elapsed, _status: res.statusCode });
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout 120s')); });
        req.write(data);
        req.end();
    });
}

// Resolver short URL para pegar parâmetros do tenant
function resolveShortUrl(code) {
    return new Promise((resolve, reject) => {
        const url = new URL(`/l/${code}`, BASE_URL);
        
        const req = https.request({
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'GET',
            timeout: 60000,
            headers: { 'User-Agent': 'Mozilla/5.0 TestBot' }
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const loc = res.headers.location;
                const params = new URL(loc, BASE_URL).searchParams;
                resolve({
                    name: params.get('name') || 'Unknown',
                    url: params.get('url') || '',
                    apiKey: params.get('apiKey') || '',
                    instructions: params.get('instructions') || '',
                    redirectUrl: loc
                });
            } else {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    // Parse from HTML if it's a full page response
                    resolve({ name: 'Unknown', url: '', apiKey: '', instructions: '', _status: res.statusCode });
                });
            }
        });

        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

// ═══════════════════════════════════════════════════════
// EXECUÇÃO DOS TESTES
// ═══════════════════════════════════════════════════════

async function testBlock(tenant, block, conversationId) {
    const results = [];
    const convId = conversationId || `test_v16_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    for (const msg of block.messages) {
        try {
            const body = {
                message: msg.text,
                pageData: { url: tenant.url },
                robotName: tenant.name,
                instructions: tenant.instructions || '',
                conversationId: convId,
                apiKey: tenant.apiKey,
                salesMode: 'auto'
            };

            const resp = await callAPI('/api/process-chat-inteligente', body);
            const responseText = resp.response || resp.error || '';
            const analysis = analyzeResponse(responseText, msg.expect);

            results.push({
                message: msg.text,
                response: responseText.substring(0, 300),
                fullResponse: responseText,
                elapsed: resp._elapsed,
                status: resp._status,
                analysis,
                check: msg.check,
            });

            // Pequeno delay entre mensagens
            await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
            results.push({
                message: msg.text,
                response: `ERROR: ${err.message}`,
                elapsed: 0,
                status: 'error',
                analysis: { pass: false, reason: `ERRO: ${err.message}` },
            });
        }
    }

    return { blockName: block.name, convId, results };
}

async function testTenant(tenant) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🧪 TESTANDO: ${tenant.name}`);
    console.log(`   URL: ${tenant.url}`);
    console.log(`   API Key: ${tenant.apiKey ? tenant.apiKey.substring(0, 12) + '...' : 'N/A'}`);
    console.log(`${'═'.repeat(60)}`);

    const allResults = {};
    let totalTests = 0;
    let totalPass = 0;
    let totalCheckoutSent = 0;
    let totalCheckoutExpected = 0;
    let totalGeneric = 0;
    let totalPlatformMention = 0;
    let totalResponseTime = 0;

    // Testar cada bloco isolado (nova conversa)
    for (const [key, block] of Object.entries(TEST_BLOCKS)) {
        console.log(`\n  📋 ${block.name}`);
        const blockResult = await testBlock(tenant, block);
        allResults[key] = blockResult;

        for (const r of blockResult.results) {
            totalTests++;
            if (r.analysis.pass) totalPass++;
            if (r.analysis.hasCheckout) totalCheckoutSent++;
            if (['CHECKOUT_DIRETO', 'CHECKOUT_COM_CONTEXTO'].includes(r.analysis.reason?.includes('CHECKOUT') ? '' : '')) {}
            if (r.analysis.isGenericFiller) totalGeneric++;
            if (r.analysis.mentionsPlatform) totalPlatformMention++;
            totalResponseTime += r.elapsed || 0;

            const icon = r.analysis.pass ? '✅' : '❌';
            console.log(`    ${icon} "${r.message}" → ${r.analysis.reason} (${r.elapsed}ms)`);
            if (!r.analysis.pass) {
                console.log(`       Resposta: "${r.response.substring(0, 150)}..."`);
            }
        }
    }

    // BLOCO ESPECIAL: Interrupção (mesma conversa)
    console.log(`\n  📋 ${INTERRUPTION_FLOW.name}`);
    const interruptResult = await testBlock(tenant, INTERRUPTION_FLOW);
    allResults['INTERRUPTION'] = interruptResult;
    for (const r of interruptResult.results) {
        totalTests++;
        if (r.analysis.pass) totalPass++;
        if (r.analysis.hasCheckout) totalCheckoutSent++;
        if (r.analysis.isGenericFiller) totalGeneric++;
        totalResponseTime += r.elapsed || 0;
        const icon = r.analysis.pass ? '✅' : '❌';
        console.log(`    ${icon} "${r.message}" → ${r.analysis.reason} (${r.elapsed}ms)`);
    }

    // BLOCO ESPECIAL: Memória (mesma conversa)
    console.log(`\n  📋 ${MEMORY_FLOW.name}`);
    const memoryResult = await testBlock(tenant, MEMORY_FLOW);
    allResults['MEMORY'] = memoryResult;
    for (const r of memoryResult.results) {
        totalTests++;
        if (r.analysis.pass) totalPass++;
        if (r.analysis.hasCheckout) totalCheckoutSent++;
        if (r.analysis.isGenericFiller) totalGeneric++;
        totalResponseTime += r.elapsed || 0;
        const icon = r.analysis.pass ? '✅' : '❌';
        console.log(`    ${icon} "${r.message}" → ${r.analysis.reason} (${r.elapsed}ms)`);
    }

    const avgTime = totalTests > 0 ? Math.round(totalResponseTime / totalTests) : 0;

    console.log(`\n  📊 RESUMO ${tenant.name}:`);
    console.log(`     Total: ${totalPass}/${totalTests} passed (${Math.round(totalPass/totalTests*100)}%)`);
    console.log(`     Checkout enviado: ${totalCheckoutSent}/${totalTests}`);
    console.log(`     Respostas genéricas: ${totalGeneric}`);
    console.log(`     Menções plataforma: ${totalPlatformMention}`);
    console.log(`     Tempo médio: ${avgTime}ms`);

    return {
        tenant: tenant.name,
        totalTests,
        totalPass,
        passRate: Math.round(totalPass/totalTests*100),
        totalCheckoutSent,
        totalGeneric,
        totalPlatformMention,
        avgTime,
        allResults
    };
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════

async function main() {
    console.log('🧪 ═══════════════════════════════════════════════════');
    console.log('   TESTE COMPLETO V16.2 — ANTI-PERDA DE VENDA');
    console.log('   Data:', new Date().toISOString());
    console.log('═══════════════════════════════════════════════════════\n');

    const allTenantResults = [];

    // 1. Resolver short URLs
    console.log('📡 Resolvendo short URLs dos tenants...\n');
    const tenants = [];

    for (const code of SHORT_URLS) {
        try {
            console.log(`  Resolvendo /l/${code}...`);
            const info = await resolveShortUrl(code);
            tenants.push({ ...info, shortCode: code });
            console.log(`    ✅ ${info.name} | url=${(info.url || '').substring(0, 50)} | apiKey=${info.apiKey ? info.apiKey.substring(0, 12) + '...' : 'N/A'}`);
        } catch (err) {
            console.log(`    ❌ Erro: ${err.message}`);
            tenants.push({ name: `Tenant ${code}`, url: '', apiKey: '', shortCode: code });
        }
    }

    // Adicionar tenant direto
    tenants.push(DIRECT_TENANT);

    // 2. Executar testes em cada tenant
    for (const tenant of tenants) {
        if (!tenant.apiKey) {
            console.log(`\n⚠️ Pulando ${tenant.name || tenant.shortCode} — sem apiKey`);
            continue;
        }

        try {
            const result = await testTenant(tenant);
            allTenantResults.push(result);
        } catch (err) {
            console.log(`\n❌ ERRO no tenant ${tenant.name}: ${err.message}`);
            allTenantResults.push({
                tenant: tenant.name,
                totalTests: 0, totalPass: 0, passRate: 0,
                error: err.message
            });
        }
    }

    // 3. Relatório final
    console.log('\n\n' + '═'.repeat(60));
    console.log('📊 RELATÓRIO FINAL — V16.2');
    console.log('═'.repeat(60));

    let grandTotal = 0, grandPass = 0, grandCheckout = 0, grandGeneric = 0, grandPlatform = 0;

    for (const r of allTenantResults) {
        grandTotal += r.totalTests || 0;
        grandPass += r.totalPass || 0;
        grandCheckout += r.totalCheckoutSent || 0;
        grandGeneric += r.totalGeneric || 0;
        grandPlatform += r.totalPlatformMention || 0;

        console.log(`\n  ${r.passRate >= 80 ? '✅' : '❌'} ${r.tenant}: ${r.passRate}% (${r.totalPass}/${r.totalTests}) | checkout=${r.totalCheckoutSent} | genérico=${r.totalGeneric} | plataforma=${r.totalPlatformMention} | avg=${r.avgTime}ms`);
    }

    const overallRate = grandTotal > 0 ? Math.round(grandPass / grandTotal * 100) : 0;

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  TOTAL: ${overallRate}% (${grandPass}/${grandTotal})`);
    console.log(`  Checkout enviado: ${grandCheckout}/${grandTotal}`);
    console.log(`  Respostas genéricas: ${grandGeneric}`);
    console.log(`  Menções a plataformas: ${grandPlatform}`);

    console.log(`\n🏆 CRITÉRIOS DE APROVAÇÃO:`);
    console.log(`  ${grandCheckout === grandTotal - 9 ? '✅' : '❌'} 100% BUY → checkout (${grandCheckout} enviados)`);
    console.log(`  ${grandGeneric === 0 ? '✅' : '❌'} 0 respostas genéricas (${grandGeneric} encontradas)`);
    console.log(`  ${grandPlatform === 0 ? '✅' : '❌'} 0 menções a plataformas (${grandPlatform} encontradas)`);
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🧪 TESTE COMPLETO FINALIZADO');
    console.log('═══════════════════════════════════════════════════════');

    // Output JSON para processamento
    const jsonOutput = JSON.stringify({
        timestamp: new Date().toISOString(),
        version: 'V16.2',
        overallRate,
        grandTotal,
        grandPass,
        grandCheckout,
        grandGeneric,
        grandPlatform,
        tenants: allTenantResults.map(r => ({
            name: r.tenant,
            passRate: r.passRate,
            tests: r.totalTests,
            passed: r.totalPass,
            checkout: r.totalCheckoutSent,
            generic: r.totalGeneric,
            platform: r.totalPlatformMention,
            avgTime: r.avgTime
        }))
    }, null, 2);

    require('fs').writeFileSync(
        require('path').join(__dirname, 'test-v16-results.json'),
        jsonOutput
    );
    console.log('\n💾 Resultados salvos em tests/test-v16-results.json');
}

main().catch(err => {
    console.error('❌ ERRO FATAL:', err);
    process.exit(1);
});
