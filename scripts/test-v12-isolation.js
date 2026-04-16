/**
 * 🧪 V13 — TESTE COMPLETO DE PRODUÇÃO (6 TENANTS)
 * 
 * Para cada tenant:
 * 1. Ativa assistente (POST /api/activate)
 * 2. Verifica checkout-status (GET /api/checkout-status)
 * 3. Busca o link curto gerado
 * 4. Testa chat com intenção neutra
 * 5. Testa chat com intenção de compra
 * 6. Testa chat com pedido direto de link
 */

const BASE = 'https://vertical-ai-dktu.onrender.com';

const TENANTS = [
    { key: 'LMV7-QCBK-44S6-M0LF', url: 'https://soscrescimento.com.br/braip/?pv=prov6q42&af=afi11l16n6', name: 'Teste Braip' },
    { key: 'LMV7-9BOT-HM5M-JOUV', url: 'https://upflows.com.br/', name: 'Teste Upflows' },
    { key: 'LMV7-85EN-D9I3-UTVW', url: 'https://go.hotmart.com/M103841445F', name: 'Teste Hotmart M1038' },
    { key: 'LMV7-HNTM-9OS5-QGFK', url: 'https://www.arsenalsecretodosceos.com.br/linkmagico', name: 'Teste Arsenal Magico' },
    { key: 'LMV7-P079-NLC2-8ZY7', url: 'https://go.hotmart.com/M103540655P', name: 'Teste Hotmart M1035' },
    { key: 'lm_live_4d489b0b54db990c7ae5e5e0ebfb4c8a', url: 'https://www.arsenalsecretodosceos.com.br/linkantiga', name: 'Teste Arsenal Antiga' }
];

async function f(url, opts, ms = 90000) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    try { const r = await fetch(url, { ...opts, signal: c.signal }); clearTimeout(t); return r; }
    catch (e) { clearTimeout(t); throw e; }
}

// 1. Ativar assistente
async function activateAssistant(t) {
    try {
        const r = await f(`${BASE}/api/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: t.key,
                url: t.url,
                robotName: t.name,
                salesMode: 'auto'
            })
        }, 120000);
        const d = await r.json();
        return { success: d.success, shortLink: d.shortLink || d.shortUrl || null, error: d.error || null, raw: d };
    } catch (e) { return { success: false, error: e.message }; }
}

// 2. Checkout status
async function checkCheckout(t) {
    try {
        const u = `${BASE}/api/checkout-status?apiKey=${encodeURIComponent(t.key)}&salesUrl=${encodeURIComponent(t.url)}`;
        const r = await f(u, {});
        const d = await r.json();
        return d;
    } catch (e) { return { error: e.message }; }
}

// 3. Chat
async function chat(t, message, convId) {
    try {
        const r = await f(`${BASE}/api/chat-universal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': t.key },
            body: JSON.stringify({
                apiKey: t.key,
                message: message,
                url: t.url,
                conversationId: convId
            })
        }, 120000);
        const d = await r.json();
        const urls = (d.response || '').match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi) || [];
        return { 
            success: d.success, 
            response: (d.response || '').substring(0, 400),
            urls: urls,
            checkoutLink: d.checkoutLink || null
        };
    } catch (e) { return { success: false, error: e.message }; }
}

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
    console.log('═'.repeat(80));
    console.log('🧪 TESTE COMPLETO V13 — 6 TENANTS EM PRODUÇÃO');
    console.log('   ' + new Date().toISOString());
    console.log('═'.repeat(80));

    const REPORT = [];

    for (let i = 0; i < TENANTS.length; i++) {
        const t = TENANTS[i];
        const report = { tenant: t.name, key: t.key.substring(0, 12) + '...', url: t.url };

        console.log(`\n${'━'.repeat(80)}`);
        console.log(`📋 TENANT ${i + 1}/6: ${t.name}`);
        console.log(`   Key: ${t.key.substring(0, 16)}...`);
        console.log(`   URL: ${t.url}`);
        console.log(`${'━'.repeat(80)}`);

        // PASSO 1: Ativar
        console.log('\n  🚀 1. Ativando assistente...');
        const act = await activateAssistant(t);
        report.activation = act;
        if (act.success) {
            console.log(`     ✅ Ativado! ShortLink: ${act.shortLink || 'NÃO GERADO'}`);
        } else {
            console.log(`     ❌ Falha: ${act.error}`);
        }
        report.shortLink = act.shortLink || null;

        // Esperar extração processar
        await delay(5000);

        // PASSO 2: Checkout Status
        console.log('\n  🔍 2. Verificando checkout-status...');
        const ck = await checkCheckout(t);
        report.checkout = ck;
        console.log(`     hasCheckout: ${ck.hasCheckout || false}`);
        console.log(`     checkoutUrl: ${(ck.checkoutUrl || 'NENHUM')}`);
        console.log(`     confirmed: ${ck.confirmed || false}`);
        console.log(`     source: ${ck.source || 'N/A'}`);

        // PASSO 3: Chat Neutro
        const convId = `test_${Date.now()}_${i}`;
        console.log('\n  💬 3. Chat: "Olá, me fale sobre esse produto"...');
        await delay(2000);
        const c1 = await chat(t, 'Olá, me fale sobre esse produto', convId);
        report.chatNeutro = c1;
        if (c1.success) {
            console.log(`     Resposta (${c1.response.length} chars): ${c1.response.substring(0, 200)}...`);
            console.log(`     URLs na resposta: ${c1.urls.length > 0 ? c1.urls.join(' | ') : 'NENHUMA'}`);
        } else {
            console.log(`     ❌ Erro: ${c1.error}`);
        }

        // PASSO 4: Chat Preço
        console.log('\n  💰 4. Chat: "Qual é o preço? Aceita pix?"...');
        await delay(3000);
        const c2 = await chat(t, 'Qual é o preço? Aceita pix?', convId);
        report.chatPreco = c2;
        if (c2.success) {
            console.log(`     Resposta (${c2.response.length} chars): ${c2.response.substring(0, 200)}...`);
            console.log(`     URLs: ${c2.urls.length > 0 ? c2.urls.join(' | ') : 'NENHUMA'}`);
        } else {
            console.log(`     ❌ Erro: ${c2.error}`);
        }

        // PASSO 5: Chat Buy
        console.log('\n  🛒 5. Chat: "Quero comprar, manda o link de pagamento"...');
        await delay(3000);
        const c3 = await chat(t, 'Quero comprar, manda o link de pagamento', convId);
        report.chatBuy = c3;
        if (c3.success) {
            console.log(`     Resposta (${c3.response.length} chars): ${c3.response.substring(0, 300)}...`);
            console.log(`     URLs: ${c3.urls.length > 0 ? c3.urls.join(' | ') : '⚠️ NENHUMA!'}`);
        } else {
            console.log(`     ❌ Erro: ${c3.error}`);
        }

        // PASSO 6: Chat "como pagar"
        console.log('\n  💳 6. Chat: "Como faço para pagar?"...');
        await delay(3000);
        const c4 = await chat(t, 'Como faço para pagar?', convId);
        report.chatPagar = c4;
        if (c4.success) {
            console.log(`     Resposta (${c4.response.length} chars): ${c4.response.substring(0, 300)}...`);
            console.log(`     URLs: ${c4.urls.length > 0 ? c4.urls.join(' | ') : '⚠️ NENHUMA!'}`);
        } else {
            console.log(`     ❌ Erro: ${c4.error}`);
        }

        REPORT.push(report);
        await delay(3000);
    }

    // ═══════════════════════════════════════════════════════════════════
    // ANÁLISE FINAL
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n\n' + '═'.repeat(80));
    console.log('📊 RELATÓRIO FINAL — ANÁLISE COMPLETA');
    console.log('═'.repeat(80));

    // Verificar contaminação cross-tenant
    console.log('\n🔒 CONTAMINAÇÃO CROSS-TENANT:');
    const checkoutMap = {};
    for (const r of REPORT) {
        const ckUrl = r.checkout?.checkoutUrl || 'NENHUM';
        if (!checkoutMap[ckUrl]) checkoutMap[ckUrl] = [];
        checkoutMap[ckUrl].push(r.tenant);
    }
    for (const [url, tenants] of Object.entries(checkoutMap)) {
        if (tenants.length > 1 && url !== 'NENHUM') {
            console.log(`  ⚠️ CONTAMINAÇÃO: "${url.substring(0, 60)}..." aparece em: ${tenants.join(', ')}`);
        }
    }
    const contaminated = Object.values(checkoutMap).some(t => t.length > 1 && Object.keys(checkoutMap).find(k => k !== 'NENHUM'));
    if (!contaminated) console.log('  ✅ Sem contaminação detectada');

    // Resumo por tenant
    console.log('\n📋 RESUMO POR TENANT:');
    for (const r of REPORT) {
        const ckUrl = r.checkout?.checkoutUrl || 'NENHUM';
        const buyUrls = r.chatBuy?.urls || [];
        const pagarUrls = r.chatPagar?.urls || [];
        const allChatUrls = [...new Set([...buyUrls, ...pagarUrls])];
        
        console.log(`\n  ${r.tenant}:`);
        console.log(`    ShortLink: ${r.shortLink || 'N/A'}`);
        console.log(`    Checkout DB: ${ckUrl}`);
        console.log(`    URLs no chat (buy): ${buyUrls.length > 0 ? buyUrls.join(', ') : '⚠️ NENHUMA'}`);
        console.log(`    URLs no chat (pagar): ${pagarUrls.length > 0 ? pagarUrls.join(', ') : '⚠️ NENHUMA'}`);
        
        // Verificar se link do chat bate com checkout do DB
        if (ckUrl !== 'NENHUM' && allChatUrls.length > 0) {
            const match = allChatUrls.some(u => u.includes(ckUrl.split('//')[1]?.split('/').slice(0,2).join('/') || '___'));
            console.log(`    Match checkout↔chat: ${match ? '✅ SIM' : '⚠️ NÃO'}`);
        }
    }

    // Problemas encontrados
    console.log('\n❌ PROBLEMAS ENCONTRADOS:');
    let problemCount = 0;
    for (const r of REPORT) {
        if (!r.activation?.success) { problemCount++; console.log(`  ${r.tenant}: Ativação falhou`); }
        if (!r.checkout?.hasCheckout) { problemCount++; console.log(`  ${r.tenant}: Sem checkout no DB`); }
        if (r.chatBuy?.urls?.length === 0) { problemCount++; console.log(`  ${r.tenant}: Chat BUY sem link`); }
        if (r.chatPagar?.urls?.length === 0) { problemCount++; console.log(`  ${r.tenant}: Chat PAGAR sem link`); }
    }
    if (problemCount === 0) console.log('  ✅ Nenhum problema encontrado!');

    console.log('\n' + '═'.repeat(80));
    console.log(`🏁 TESTE FINALIZADO — ${REPORT.length} tenants, ${REPORT.length * 6} testes executados`);
    console.log('═'.repeat(80));
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
