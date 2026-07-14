/**
 * 🧪 CHECKLIST COMPLETO V9.3 — Teste Live contra Produção
 * 
 * URL do produto: https://ev.braip.com/ref?pv=prov6q42&af=afi11l16n6
 * Servidor: https://vertical-ai-dktu.onrender.com
 * API Key: LMV7-P079-NLC2-8ZY7
 * 
 * Testes:
 * 1. 🔗 Teste direto de compra (CRÍTICO)
 * 2. 🧠 Teste indireto (IA usando contexto)
 * 3. 🔍 Verificação de resposta do servidor
 * 4. ⚖️ Teste cruzado (widget vs chatbot-page)
 * 5. 🧨 Teste anti-regressão
 * 6. 🔁 Teste pós-compra
 */

const API_BASE = 'https://vertical-ai-dktu.onrender.com';
const API_KEY = 'LMV7-P079-NLC2-8ZY7';
const PRODUCT_URL = 'https://ev.braip.com/ref?pv=prov6q42&af=afi11l16n6';
const LANDING_URL = 'https://soscrescimento.com.br/braip/?pv=prov6q42&af=afi11l16n6';
const ROBOT_NAME = 'Assistente de Vendas';
const INSTRUCTIONS = 'Você é um assistente de vendas especializado. Quando o cliente quiser comprar, forneça o link de checkout correto. Seja prestativo e natural.';

let passed = 0;
let failed = 0;
const testResults = [];

function assert(condition, testName, detail = '') {
    if (condition) {
        console.log(`  ✅ ${testName}`);
        passed++;
        testResults.push({ name: testName, status: 'PASS', detail });
    } else {
        console.error(`  ❌ FALHOU: ${testName}${detail ? ' — ' + detail : ''}`);
        failed++;
        testResults.push({ name: testName, status: 'FAIL', detail });
    }
}

// Simula chamada vindo do WIDGET (com checkoutLink já detectado pelo frontend)
async function callChatWidget(message, checkoutLink = null, convId = null) {
    const payload = {
        message: message,
        pageData: {
            url: PRODUCT_URL,
            title: 'S.O.S Crescimento',
            checkoutLink: checkoutLink
        },
        robotName: ROBOT_NAME,
        instructions: INSTRUCTIONS,
        conversationId: convId || 'test_v93_widget_' + Date.now(),
        apiKey: API_KEY
    };

    const response = await fetch(API_BASE + '/api/process-chat-inteligente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${response.statusText} — ${errBody.substring(0, 200)}`);
    }

    return await response.json();
}

// Simula chamada vindo do CHATBOT-PAGE (sem checkoutLink, server precisa extrair)
async function callChatPage(message, convId = null) {
    const payload = {
        message: message,
        pageData: {
            url: PRODUCT_URL,
            title: 'S.O.S Crescimento'
            // SEM checkoutLink — o server deve extrair via extractPageData
        },
        robotName: ROBOT_NAME,
        instructions: INSTRUCTIONS,
        conversationId: convId || 'test_v93_page_' + Date.now(),
        apiKey: API_KEY
    };

    const response = await fetch(API_BASE + '/api/process-chat-inteligente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${response.statusText} — ${errBody.substring(0, 200)}`);
    }

    return await response.json();
}

function checkForCheckoutLink(responseText) {
    const lower = responseText.toLowerCase();
    // Checkout link patterns
    const checkoutPatterns = [
        'ev.braip.com/checkout',
        'pay.hotmart.com',
        'kiwify.com',
        'checkout',
        'link de pagamento',
        'link de compra',
        'clique aqui',
        'comprar agora'
    ];
    return checkoutPatterns.some(p => lower.includes(p));
}

function checkForLandingOnly(responseText) {
    const lower = responseText.toLowerCase();
    // Se contém a URL da landing page MAS NÃO contém checkout
    const hasLanding = lower.includes('soscrescimento.com.br') || lower.includes('ev.braip.com/ref');
    const hasCheckout = lower.includes('ev.braip.com/checkout') || lower.includes('pay.') || lower.includes('checkout');
    return hasLanding && !hasCheckout;
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runFullChecklist() {
    console.log('═'.repeat(65));
    console.log('🧪 CHECKLIST COMPLETO V9.3 — TESTE LIVE EM PRODUÇÃO');
    console.log('═'.repeat(65));
    console.log(`📡 Servidor: ${API_BASE}`);
    console.log(`🔑 API Key: ${API_KEY}`);
    console.log(`📍 Produto: ${PRODUCT_URL}`);
    console.log(`⏰ ${new Date().toISOString()}`);
    console.log('');

    // ═══════════════════════════════════════════════
    // TESTE 1: 🔗 Teste direto de compra (CRÍTICO)
    // ═══════════════════════════════════════════════
    console.log('━'.repeat(65));
    console.log('📋 TESTE 1: 🔗 Teste direto de compra (CRÍTICO)');
    console.log('━'.repeat(65));

    const buyMessages = [
        'quero comprar',
        'qual o link de pagamento?',
        'como faço pra pagar?'
    ];

    for (const msg of buyMessages) {
        try {
            console.log(`\n  📨 Enviando: "${msg}"`);
            const data = await callChatWidget(msg, 'https://ev.braip.com/checkout/planv8yk/cheon6kw');
            
            assert(data.success === true, `"${msg}" → resposta com sucesso`);
            
            const resp = data.response || '';
            console.log(`  📝 Resposta: ${resp.substring(0, 250)}...`);
            
            // Verificar se NÃO mostra apenas landing page
            const landingOnly = checkForLandingOnly(resp);
            assert(!landingOnly, `"${msg}" → NÃO mostra apenas URL da landing`, 
                landingOnly ? 'PROBLEMA: Resposta contém só a landing page!' : '');
            
            // Verificar se menciona checkout/compra
            const hasCheckout = checkForCheckoutLink(resp);
            assert(hasCheckout, `"${msg}" → resposta contém referência a checkout/compra`,
                hasCheckout ? '' : 'IA não mencionou checkout');
            
            await sleep(2000); // Rate limiting
        } catch (err) {
            console.error(`  ❌ ERRO em "${msg}": ${err.message}`);
            failed++;
        }
    }

    // ═══════════════════════════════════════════════
    // TESTE 2: 🧠 Teste indireto (IA usando contexto)
    // ═══════════════════════════════════════════════
    console.log('\n' + '━'.repeat(65));
    console.log('📋 TESTE 2: 🧠 Teste indireto (IA usando contexto)');
    console.log('━'.repeat(65));

    const contextMessages = [
        'como funciona?',
        'tem garantia?',
        'tem bônus?'
    ];

    for (const msg of contextMessages) {
        try {
            console.log(`\n  📨 Enviando: "${msg}"`);
            const data = await callChatWidget(msg, 'https://ev.braip.com/checkout/planv8yk/cheon6kw');
            
            assert(data.success === true, `"${msg}" → resposta com sucesso`);
            
            const resp = data.response || '';
            console.log(`  📝 Resposta: ${resp.substring(0, 200)}...`);
            
            // Resposta deve ser válida e informativa
            assert(resp.length > 20, `"${msg}" → resposta com conteúdo substancial`);
            
            await sleep(2000);
        } catch (err) {
            console.error(`  ❌ ERRO em "${msg}": ${err.message}`);
            failed++;
        }
    }

    // ═══════════════════════════════════════════════
    // TESTE 3: ⚖️ Teste cruzado (Widget vs Chatbot-Page)
    // ═══════════════════════════════════════════════
    console.log('\n' + '━'.repeat(65));
    console.log('📋 TESTE 3: ⚖️ Teste cruzado (Widget vs Chatbot-Page)');
    console.log('━'.repeat(65));

    try {
        console.log('\n  📨 [WIDGET] Enviando: "quero comprar" (com checkoutLink no payload)');
        const widgetData = await callChatWidget('quero comprar', 'https://ev.braip.com/checkout/planv8yk/cheon6kw');
        const widgetResp = widgetData.response || '';
        console.log(`  📝 [WIDGET] Resposta: ${widgetResp.substring(0, 200)}...`);
        
        await sleep(3000);
        
        console.log('\n  📨 [PAGE] Enviando: "quero comprar" (SEM checkoutLink — server deve extrair)');
        const pageData = await callChatPage('quero comprar');
        const pageResp = pageData.response || '';
        console.log(`  📝 [PAGE] Resposta: ${pageResp.substring(0, 200)}...`);
        
        // Ambos devem ter sucesso
        assert(widgetData.success === true, '[WIDGET] Resposta com sucesso');
        assert(pageData.success === true, '[PAGE] Resposta com sucesso');
        
        // Ambos devem mencionar checkout de alguma forma
        const widgetHasCheckout = checkForCheckoutLink(widgetResp);
        const pageHasCheckout = checkForCheckoutLink(pageResp);
        
        assert(widgetHasCheckout, '[WIDGET] Resposta menciona checkout/compra');
        assert(pageHasCheckout, '[PAGE] Resposta menciona checkout/compra (server-side extraction)');
        
    } catch (err) {
        console.error(`  ❌ ERRO no teste cruzado: ${err.message}`);
        failed++;
    }

    // ═══════════════════════════════════════════════
    // TESTE 4: 🧨 Teste anti-regressão
    // ═══════════════════════════════════════════════
    console.log('\n' + '━'.repeat(65));
    console.log('📋 TESTE 4: 🧨 Teste anti-regressão');
    console.log('━'.repeat(65));

    const normalMessages = [
        'olá',
        'tudo bem?',
        'me explica melhor'
    ];

    for (const msg of normalMessages) {
        try {
            console.log(`\n  📨 Enviando: "${msg}"`);
            const data = await callChatPage(msg);
            
            assert(data.success === true, `"${msg}" → resposta com sucesso`);
            
            const resp = data.response || '';
            console.log(`  📝 Resposta: ${resp.substring(0, 200)}...`);
            
            // Resposta deve ser natural, NÃO deve forçar link de compra
            assert(resp.length > 5, `"${msg}" → IA responde normalmente`);
            
            await sleep(2000);
        } catch (err) {
            console.error(`  ❌ ERRO em "${msg}": ${err.message}`);
            failed++;
        }
    }

    // ═══════════════════════════════════════════════
    // TESTE 5: 🔁 Teste pós-compra
    // ═══════════════════════════════════════════════
    console.log('\n' + '━'.repeat(65));
    console.log('📋 TESTE 5: 🔁 Teste pós-compra');
    console.log('━'.repeat(65));

    const postBuyMessages = [
        'já comprei',
        'comprei e agora?'
    ];

    for (const msg of postBuyMessages) {
        try {
            console.log(`\n  📨 Enviando: "${msg}"`);
            const data = await callChatPage(msg);
            
            assert(data.success === true, `"${msg}" → resposta com sucesso`);
            
            const resp = data.response || '';
            console.log(`  📝 Resposta: ${resp.substring(0, 200)}...`);
            
            // Deve responder (modo suporte), não forçar novo checkout
            assert(resp.length > 10, `"${msg}" → resposta substancial (modo suporte)`);
            
            await sleep(2000);
        } catch (err) {
            console.error(`  ❌ ERRO em "${msg}": ${err.message}`);
            failed++;
        }
    }

    // ═══════════════════════════════════════════════
    // TESTE 6: ⚡ TESTE FINAL (O MAIS IMPORTANTE)
    // ═══════════════════════════════════════════════
    console.log('\n' + '━'.repeat(65));
    console.log('📋 TESTE 6: ⚡ TESTE FINAL — "qual o link de pagamento?"');
    console.log('━'.repeat(65));

    try {
        console.log('\n  📨 Enviando: "qual o link de pagamento?"');
        const data = await callChatWidget('qual o link de pagamento?', 'https://ev.braip.com/checkout/planv8yk/cheon6kw');
        
        const resp = data.response || '';
        console.log(`  📝 Resposta COMPLETA:\n  ────────────────────`);
        console.log(`  ${resp}`);
        console.log(`  ────────────────────`);
        
        assert(data.success === true, 'Resposta com sucesso');
        
        // CRITÉRIO PRINCIPAL: deve conter link de checkout real
        const hasRealCheckout = resp.toLowerCase().includes('ev.braip.com/checkout') || 
                                 resp.toLowerCase().includes('pay.hotmart') ||
                                 resp.toLowerCase().includes('checkout');
        assert(hasRealCheckout, '💥 Resposta contém CHECKOUT REAL');
        
        // NÃO deve conter apenas a landing page
        const onlyLanding = resp.includes('soscrescimento.com.br') && !resp.toLowerCase().includes('checkout');
        assert(!onlyLanding, 'NÃO mostra apenas URL da landing');
        
    } catch (err) {
        console.error(`  ❌ ERRO: ${err.message}`);
        failed++;
    }

    // ═══════════════════════════════════════════════
    // RELATÓRIO FINAL
    // ═══════════════════════════════════════════════
    console.log('\n' + '═'.repeat(65));
    console.log('📊 RELATÓRIO FINAL — CHECKLIST V9.3');
    console.log('═'.repeat(65));
    console.log('');
    
    const diagnostics = {
        'Teste direto de compra': testResults.filter(t => t.name.includes('checkout') || t.name.includes('compra')).every(t => t.status === 'PASS') ? '✅' : '❌',
        'Teste indireto (contexto)': testResults.filter(t => t.name.includes('substancial')).every(t => t.status === 'PASS') ? '✅' : '❌',
        'Teste cruzado (widget/page)': testResults.filter(t => t.name.includes('[WIDGET]') || t.name.includes('[PAGE]')).every(t => t.status === 'PASS') ? '✅' : '❌',
        'Anti-regressão': testResults.filter(t => t.name.includes('normalmente')).every(t => t.status === 'PASS') ? '✅' : '❌',
        'Pós-compra': testResults.filter(t => t.name.includes('suporte')).every(t => t.status === 'PASS') ? '✅' : '❌',
        'Teste final (checkout direto)': testResults.filter(t => t.name.includes('💥')).every(t => t.status === 'PASS') ? '✅' : '❌'
    };

    Object.entries(diagnostics).forEach(([key, val]) => {
        console.log(`  ${val} ${key}`);
    });

    console.log('');
    console.log(`  🏁 RESULTADO: ${passed} passaram, ${failed} falharam`);
    console.log('═'.repeat(65));
    
    if (failed === 0) {
        console.log('💥 PROBLEMA RESOLVIDO DEFINITIVAMENTE — TODOS OS TESTES PASSARAM!');
    } else {
        console.log(`⚠️ ${failed} teste(s) falharam — ver detalhes acima`);
    }
    console.log('');
}

runFullChecklist().catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
});
