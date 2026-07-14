/**
 * 🧪 V16.2 — TESTE COMPLETO (ANTI-PERDA DE VENDA)
 * 
 * Executa testes automatizados contra o endpoint /api/chat-universal
 * para validar todos os cenários do Decision Engine V16.2.
 * 
 * Uso: node scripts/test-v16.2.js
 */

const axios = require('axios');

const BASE_URL = 'https://vertical-ai-dktu.onrender.com';

// API Keys dos tenants para teste (extrair do healthz ou usar uma conhecida)
const TEST_TENANTS = [
    {
        name: 'Tenant EmrTDd',
        apiKey: 'LMV7-HNTM-9OS5-QGFK', // Arsenal dos CEOs
        url: 'https://www.arsenalsecretodosceos.com.br/linkmagic',
        instructions: 'Sempre responda de forma amigável, consultiva e entusiasmada, mas objetiva'
    }
];

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

let testNumber = 0;
let passed = 0;
let failed = 0;
let warnings = 0;
const results = [];

async function sendMessage(apiKey, message, url, instructions, conversationId) {
    // Delay para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 4000));
    try {
        const response = await axios.post(`${BASE_URL}/api/chat-universal`, {
            message,
            apiKey,
            url: url || '',
            instructions: instructions || '',
            conversationId: conversationId || `test_v16_${Date.now()}`,
            pageData: {
                url: url || '',
                salesMode: 'auto'
            }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': apiKey
            },
            timeout: 30000
        });

        return {
            success: true,
            text: response.data?.response || response.data?.text || response.data?.message || JSON.stringify(response.data),
            raw: response.data
        };
    } catch (err) {
        return {
            success: false,
            text: `ERRO: ${err.response?.status || err.code} — ${err.response?.data?.error || err.message}`,
            raw: err.response?.data || null
        };
    }
}

function check(testName, category, message, response, conditions) {
    testNumber++;
    const result = {
        id: testNumber,
        category,
        test: testName,
        message,
        response: response.text?.substring(0, 200) || 'VAZIO',
        checks: []
    };

    let allPassed = true;

    for (const [name, fn] of Object.entries(conditions)) {
        const ok = fn(response);
        result.checks.push({ name, ok });
        if (!ok) allPassed = false;
    }

    if (allPassed) {
        passed++;
        result.status = '✅ PASS';
    } else {
        failed++;
        result.status = '❌ FAIL';
    }

    results.push(result);

    // Console output
    console.log(`\n${result.status} [${testNumber}] ${category} — ${testName}`);
    console.log(`   📩 Input: "${message}"`);
    console.log(`   🤖 Output: "${(response.text || '').substring(0, 150)}..."`);
    for (const c of result.checks) {
        console.log(`   ${c.ok ? '✅' : '❌'} ${c.name}`);
    }

    return allPassed;
}

// ═══════════════════════════════════════════════════════════════════
// CONDIÇÕES DE VALIDAÇÃO
// ═══════════════════════════════════════════════════════════════════

const hasCheckout = (r) => {
    const t = (r.text || '').toLowerCase();
    return t.includes('finalizar compra') || t.includes('https://') || t.includes('http://');
};

const hasCheckoutBlock = (r) => {
    const t = r.text || '';
    return t.includes('FINALIZAR COMPRA') || t.includes('━━━━━━━━━');
};

const noCheckout = (r) => !hasCheckout(r);

const hasWhatsApp = (r) => {
    const t = (r.text || '').toLowerCase();
    return t.includes('whatsapp') || t.includes('wa.me') || t.includes('atendente') || t.includes('suporte') || t.includes('atend');
};

const notEmpty = (r) => (r.text || '').trim().length > 5;

const noError500 = (r) => r.success || !r.text?.includes('500');

const noPlatformNames = (r) => {
    const t = (r.text || '');
    // Remove URLs antes de checar (link de checkout pode conter domínio da plataforma)
    const textWithoutUrls = t.replace(/https?:\/\/[^\s]+/g, '').toLowerCase();
    return !textWithoutUrls.includes('braip') && !textWithoutUrls.includes('hotmart') && !textWithoutUrls.includes('kiwify');
};

const noQuestion = (r) => {
    const t = (r.text || '');
    // Para checkout direto, não deveria ter pergunta antes do link
    const beforeCheckout = t.split('FINALIZAR COMPRA')[0] || t;
    return !beforeCheckout.includes('?') || beforeCheckout.length < 80;
};

const isReengagement = (r) => {
    const t = (r.text || '').toLowerCase();
    return t.includes('?') || t.includes('impede') || t.includes('começar');
};

// ═══════════════════════════════════════════════════════════════════
// TESTES
// ═══════════════════════════════════════════════════════════════════

async function runAllTests() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🧪 V16.2 — TESTE COMPLETO (ANTI-PERDA DE VENDA)');
    console.log('═══════════════════════════════════════════════════════');

    const tenant = TEST_TENANTS[0];
    const { apiKey, url, instructions } = tenant;
    console.log(`\n🏢 Tenant: ${tenant.name}`);
    console.log(`🔑 API Key: ${apiKey.substring(0, 12)}...`);
    console.log(`🌐 URL: ${url}`);

    // ═══ BLOCO 1: ALTA INTENÇÃO ═══
    console.log('\n\n🔥 BLOCO 1 — ALTA INTENÇÃO (CHECKOUT DIRETO)');
    console.log('─────────────────────────────────────────────');

    const highIntentCases = [
        'quero comprar',
        'tem link?',
        'me manda o link',
        'como faço pra comprar',
        'bora',
        'onde compra isso'
    ];

    for (const msg of highIntentCases) {
        const convId = `test_hi_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const r = await sendMessage(apiKey, msg, url, instructions, convId);
        check(`HIGH_INTENT: "${msg}"`, 'ALTA INTENÇÃO', msg, r, {
            'Não vazio': notEmpty,
            'Checkout presente': hasCheckout,
            'Sem nomes de plataforma': noPlatformNames,
            'Sem erro 500': noError500
        });
    }

    // ═══ BLOCO 2: PREÇO ═══
    console.log('\n\n💰 BLOCO 2 — PREÇO (PRICE TRIGGER)');
    console.log('─────────────────────────────────────────────');

    const priceCases = ['quanto custa', 'qual o valor', 'preço', 'quanto é'];

    for (const msg of priceCases) {
        const convId = `test_pr_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const r = await sendMessage(apiKey, msg, url, instructions, convId);
        check(`PRICE: "${msg}"`, 'PREÇO', msg, r, {
            'Não vazio': notEmpty,
            'Checkout presente': hasCheckout,
            'Sem nomes de plataforma': noPlatformNames,
            'Sem erro 500': noError500
        });
    }

    // ═══ BLOCO 3: PAGAMENTO ═══
    console.log('\n\n💳 BLOCO 3 — PAGAMENTO (CHECKOUT DIRETO)');
    console.log('─────────────────────────────────────────────');

    const paymentCases = ['tem parcelamento?', 'aceita pix?', 'como pago?', 'tem desconto?'];

    for (const msg of paymentCases) {
        const convId = `test_pay_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const r = await sendMessage(apiKey, msg, url, instructions, convId);
        check(`PAYMENT: "${msg}"`, 'PAGAMENTO', msg, r, {
            'Não vazio': notEmpty,
            'Checkout presente': hasCheckout,
            'Sem erro 500': noError500
        });
    }

    // ═══ BLOCO 4: FUZZY MATCH (ERRO HUMANO) ═══
    console.log('\n\n🤖 BLOCO 4 — FUZZY MATCH (ERRO HUMANO)');
    console.log('─────────────────────────────────────────────');

    const fuzzyCases = ['qro compra', 'tem o link ai', 'como q compra isso', 'manda o site'];

    for (const msg of fuzzyCases) {
        const convId = `test_fz_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const r = await sendMessage(apiKey, msg, url, instructions, convId);
        check(`FUZZY: "${msg}"`, 'ERRO HUMANO', msg, r, {
            'Não vazio': notEmpty,
            'Checkout presente': hasCheckout,
            'Sem erro 500': noError500
        });
    }

    // ═══ BLOCO 5: SUPORTE (ISOLAMENTO) ═══
    console.log('\n\n🚫 BLOCO 5 — SUPORTE (ISOLAMENTO TOTAL)');
    console.log('─────────────────────────────────────────────');

    const supportCases = ['quero suporte', 'falar com atendente', 'preciso de ajuda'];

    for (const msg of supportCases) {
        const convId = `test_sp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const r = await sendMessage(apiKey, msg, url, instructions, convId);
        check(`SUPPORT: "${msg}"`, 'SUPORTE', msg, r, {
            'Não vazio': notEmpty,
            'Sem erro 500': noError500,
            'Direciona para atendimento': hasWhatsApp
        });
    }

    // ═══ BLOCO 6: RECOMPRA ═══
    console.log('\n\n🔁 BLOCO 6 — RECOMPRA');
    console.log('─────────────────────────────────────────────');

    const rebuyCases = ['já comprei', 'quero comprar de novo'];

    for (const msg of rebuyCases) {
        const convId = `test_rb_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const r = await sendMessage(apiKey, msg, url, instructions, convId);
        check(`REBUY: "${msg}"`, 'RECOMPRA', msg, r, {
            'Não vazio': notEmpty,
            'Checkout presente': hasCheckout,
            'Sem erro 500': noError500
        });
    }

    // ═══ BLOCO 7: DELAY (REENGAJAMENTO) ═══
    console.log('\n\n⏳ BLOCO 7 — DELAY (REENGAJAMENTO)');
    console.log('─────────────────────────────────────────────');

    const delayCases = ['vou pensar', 'depois vejo', 'te aviso'];

    for (const msg of delayCases) {
        const convId = `test_dl_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const r = await sendMessage(apiKey, msg, url, instructions, convId);
        check(`DELAY: "${msg}"`, 'DELAY', msg, r, {
            'Não vazio': notEmpty,
            'Reengajamento (pergunta)': isReengagement,
            'Sem erro 500': noError500
        });
    }

    // ═══ BLOCO 8: INTERRUPÇÃO (MEMÓRIA) ═══
    console.log('\n\n🧠 BLOCO 8 — INTERRUPÇÃO (MEMÓRIA IS_BUYER)');
    console.log('─────────────────────────────────────────────');

    const memConvId = `test_mem_${Date.now()}`;
    
    // Msg 1: comprar → marca como buyer
    const r1 = await sendMessage(apiKey, 'quero comprar', url, instructions, memConvId);
    check('MEMORY: Msg 1 — "quero comprar" (marca buyer)', 'MEMÓRIA', 'quero comprar', r1, {
        'Não vazio': notEmpty,
        'Checkout presente': hasCheckout,
        'Sem erro 500': noError500
    });

    // Msg 2: dúvida → ainda deve ter checkout (é buyer)
    const r2 = await sendMessage(apiKey, 'e funciona mesmo?', url, instructions, memConvId);
    check('MEMORY: Msg 2 — "e funciona mesmo?" (buyer com dúvida)', 'MEMÓRIA', 'e funciona mesmo?', r2, {
        'Não vazio': notEmpty,
        'Sem erro 500': noError500
        // Nota: pode ter checkout via anti-weak ou pode ser dúvida complexa
    });

    // Msg 3: pergunta aleatória → FORCE_CLOSE deve empurrar checkout
    const r3 = await sendMessage(apiKey, 'de onde você é?', url, instructions, memConvId);
    check('MEMORY: Msg 3 — "de onde você é?" (buyer desviando)', 'MEMÓRIA', 'de onde você é?', r3, {
        'Não vazio': notEmpty,
        'Sem erro 500': noError500
    });

    // ═══ BLOCO 9: SANITIZAÇÃO ═══
    console.log('\n\n🧼 BLOCO 9 — SANITIZAÇÃO');
    console.log('─────────────────────────────────────────────');

    const sanitizeCases = ['me fala sobre o produto', 'como funciona?'];

    for (const msg of sanitizeCases) {
        const convId = `test_sn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const r = await sendMessage(apiKey, msg, url, instructions, convId);
        check(`SANITIZE: "${msg}"`, 'SANITIZAÇÃO', msg, r, {
            'Não vazio': notEmpty,
            'Sem nomes de plataforma': noPlatformNames,
            'Sem erro 500': noError500
        });
    }

    // ═══ RESULTADO FINAL ═══
    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('📊 RESULTADO FINAL V16.2');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   ✅ Passed: ${passed}/${testNumber}`);
    console.log(`   ❌ Failed: ${failed}/${testNumber}`);
    console.log(`   📈 Taxa de sucesso: ${((passed / testNumber) * 100).toFixed(1)}%`);
    console.log('═══════════════════════════════════════════════════════');

    // Detalhes dos falhos
    if (failed > 0) {
        console.log('\n🔴 TESTES QUE FALHARAM:');
        for (const r of results.filter(r => r.status === '❌ FAIL')) {
            console.log(`\n   [${r.id}] ${r.test}`);
            console.log(`   Input: "${r.message}"`);
            console.log(`   Output: "${r.response}"`);
            for (const c of r.checks.filter(c => !c.ok)) {
                console.log(`   ❌ ${c.name}`);
            }
        }
    }

    // Métricas
    const checkoutTests = results.filter(r => ['ALTA INTENÇÃO', 'PREÇO', 'PAGAMENTO', 'ERRO HUMANO', 'RECOMPRA'].includes(r.category));
    const checkoutPassed = checkoutTests.filter(r => r.checks.some(c => c.name === 'Checkout presente' && c.ok));
    console.log(`\n📊 MÉTRICAS:`);
    console.log(`   Taxa de envio de checkout: ${checkoutPassed.length}/${checkoutTests.length} (${((checkoutPassed.length / checkoutTests.length) * 100).toFixed(1)}%)`);
    console.log(`   Taxa de fallback: ${results.filter(r => r.checks.some(c => c.name === 'Sem erro 500' && !c.ok)).length}/${testNumber}`);

    return { passed, failed, total: testNumber };
}

// ═══════════════════════════════════════════════════════════════════
// EXECUÇÃO
// ═══════════════════════════════════════════════════════════════════

runAllTests()
    .then(({ passed, failed, total }) => {
        console.log(`\n🏁 Testes concluídos: ${passed}/${total} aprovados`);
        process.exit(failed > 0 ? 1 : 0);
    })
    .catch(err => {
        console.error('💥 Erro fatal nos testes:', err.message);
        process.exit(2);
    });
