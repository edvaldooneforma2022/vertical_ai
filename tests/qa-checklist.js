/**
 * 🧪 QA CHECKLIST — Link Mágico V8
 * Validação completa: extração, score, chatbot, infra
 */
const axios = require('axios');
const BASE = 'https://vertical-ai-dktu.onrender.com';
const API_KEY = 'LMV7-UO9R-1S4M-CPO5';
const TEST_URL = 'https://llovers.com.br';

let passed = 0;
let failed = 0;
let warnings = 0;
const results = [];

function check(name, condition, detail) {
    if (condition) {
        passed++;
        results.push(`  ✅ ${name}`);
    } else {
        failed++;
        results.push(`  ❌ ${name} — ${detail || 'FALHOU'}`);
    }
}

function warn(name, detail) {
    warnings++;
    results.push(`  ⚠️ ${name} — ${detail}`);
}

function section(title) {
    results.push(`\n${'═'.repeat(60)}`);
    results.push(`  ${title}`);
    results.push('═'.repeat(60));
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ═══════════════════════════════════════════════════════════
// 1. EXTRAÇÃO (5 rodadas para consistência)
// ═══════════════════════════════════════════════════════════
async function testExtraction() {
    section('1. VALIDAÇÃO DE EXTRAÇÃO (5 rodadas)');
    
    const extractions = [];
    
    for (let i = 1; i <= 5; i++) {
        results.push(`\n  --- Rodada ${i}/5 ---`);
        try {
            const start = Date.now();
            const resp = await axios.post(`${BASE}/api/extract`, {
                url: TEST_URL,
                forceRefresh: true
            }, { timeout: 60000 });
            const elapsed = Date.now() - start;
            const d = resp.data;
            
            const linkCount = (d.discoveredLinks || []).length;
            const hasCheckout = !!d.checkoutLink;
            const hasWhatsapp = !!d.whatsappLink;
            const faqCount = (d.faq || []).length;
            const textLen = (d.cleanText || '').length;
            const method = d.method || 'unknown';
            
            extractions.push({ linkCount, hasCheckout, hasWhatsapp, faqCount, textLen, method, elapsed });
            
            results.push(`    método: ${method} | ${elapsed}ms`);
            results.push(`    links: ${linkCount} | texto: ${textLen} | faqs: ${faqCount}`);
            results.push(`    checkout: ${hasCheckout ? d.checkoutLink?.substring(0, 60) : 'NÃO'}`);
            results.push(`    whatsapp: ${hasWhatsapp ? d.whatsappLink?.substring(0, 60) : 'NÃO'}`);
            
            if (i === 1) {
                check('Texto ≥ 20k chars', textLen >= 20000, `texto=${textLen}`);
                check('Checkout detectado', hasCheckout, 'checkoutLink ausente');
                check('WhatsApp detectado', hasWhatsapp, 'whatsappLink ausente');
                check('FAQs ≥ 10', faqCount >= 10, `faq=${faqCount}`);
                check('Método inclui puppeteer', method.includes('puppeteer'), `method=${method}`);
            }
        } catch (err) {
            check(`Rodada ${i} sem erro`, false, err.message);
            extractions.push(null);
        }
        
        if (i < 5) await sleep(2000);
    }
    
    // Consistência
    section('1b. CONSISTÊNCIA (determinismo)');
    const valid = extractions.filter(Boolean);
    check('5/5 extrações OK', valid.length === 5, `${valid.length}/5 OK`);
    
    if (valid.length >= 2) {
        const checkouts = valid.filter(e => e.hasCheckout).length;
        const whatsapps = valid.filter(e => e.hasWhatsapp).length;
        check('Checkout em 5/5', checkouts === valid.length, `${checkouts}/${valid.length}`);
        check('WhatsApp em 5/5', whatsapps === valid.length, `${whatsapps}/${valid.length}`);
        
        const linkCounts = valid.map(e => e.linkCount);
        const linkMin = Math.min(...linkCounts);
        const linkMax = Math.max(...linkCounts);
        check('Links estáveis (±5)', linkMax - linkMin <= 5, `min=${linkMin} max=${linkMax}`);
    }
}

// ═══════════════════════════════════════════════════════════
// 2. SCORE + DIAGNÓSTICO
// ═══════════════════════════════════════════════════════════
async function testScore() {
    section('2. VALIDAÇÃO DO SCORE');
    try {
        // Primeiro precisamos de um assistente ativo
        const assistants = await axios.get(`${BASE}/api/assistants?apiKey=${API_KEY}`, { timeout: 10000 });
        const list = assistants.data.assistants || assistants.data || [];
        
        if (list.length === 0) {
            warn('Score', 'Nenhum assistente ativo — criando...');
            // Criar via short-url
            await axios.post(`${BASE}/api/create-short-url`, {
                robotName: 'QA-Test',
                salesUrl: TEST_URL,
                apiKey: API_KEY
            }, { timeout: 30000 });
            await sleep(2000);
        }
        
        const diag = await axios.post(`${BASE}/api/assistant-diagnostic`, {
            apiKey: API_KEY,
            salesUrl: TEST_URL
        }, { timeout: 10000 });
        
        const score = diag.data.score;
        const mode = diag.data.mode;
        const ready = diag.data.ready;
        
        results.push(`    Score: ${score} | Modo: ${mode} | Pronto: ${ready}`);
        check('Score = 100', score === 100, `score=${score}`);
        check('Modo = AUTO', mode === 'AUTO' || mode === 'auto', `mode=${mode}`);
        check('Pronto = true', ready === true, `ready=${ready}`);
    } catch (err) {
        check('Diagnóstico sem erro', false, err.message);
    }
}

// ═══════════════════════════════════════════════════════════
// 3. CHECKOUT STATUS
// ═══════════════════════════════════════════════════════════
async function testCheckout() {
    section('3. VALIDAÇÃO DE CHECKOUT');
    try {
        const resp = await axios.get(`${BASE}/api/checkout-status?apiKey=${API_KEY}&salesUrl=${encodeURIComponent(TEST_URL)}`, { timeout: 10000 });
        const d = resp.data;
        results.push(`    Status: ${JSON.stringify(d).substring(0, 200)}`);
        check('Checkout status OK', resp.status === 200, `status=${resp.status}`);
    } catch (err) {
        check('Checkout status', false, err.message);
    }
}

// ═══════════════════════════════════════════════════════════
// 4. CHATBOT — 5 cenários
// ═══════════════════════════════════════════════════════════
async function testChatbot() {
    section('4. VALIDAÇÃO DO CHATBOT');
    
    const scenarios = [
        { name: '🟢 Compra direta', msg: 'quero comprar', expectCTA: true, expectIntent: 'buy' },
        { name: '🟢 Preço', msg: 'quanto custa?', expectCTA: true, expectIntent: 'price' },
        { name: '🟢 Suporte', msg: 'falar com suporte', expectCTA: false, expectSupport: true },
        { name: '🟢 Navegação neutra', msg: 'é difícil usar?', expectCTA: false },
        { name: '🔴 Saída', msg: 'tchau', expectCTA: false, expectExit: true }
    ];
    
    for (const sc of scenarios) {
        results.push(`\n  --- ${sc.name} ---`);
        results.push(`    Input: "${sc.msg}"`);
        try {
            const resp = await axios.post(`${BASE}/api/process-chat-inteligente`, {
                message: sc.msg,
                url: TEST_URL,
                apiKey: API_KEY,
                conversationId: `qa_test_${Date.now()}`,
                leadId: `qa_lead_${Date.now()}`
            }, { timeout: 15000 });
            
            const d = resp.data;
            const reply = d.reply || d.response || d.message || '';
            const hasLink = reply.includes('http') || reply.includes('checkout') || reply.includes('#planos');
            
            results.push(`    Resposta: "${reply.substring(0, 100)}..."`);
            results.push(`    CTA presente: ${hasLink}`);
            
            check(`${sc.name} — resposta OK`, reply.length > 20, `reply=${reply.length} chars`);
            
            if (sc.expectCTA) {
                check(`${sc.name} — CTA presente`, hasLink, 'link não encontrado na resposta');
            }
            if (sc.expectExit) {
                check(`${sc.name} — sem CTA spam`, !hasLink, 'CTA indevido na saída');
            }
        } catch (err) {
            check(`${sc.name}`, false, err.message);
        }
        await sleep(1000);
    }
}

// ═══════════════════════════════════════════════════════════
// 5. INFRA
// ═══════════════════════════════════════════════════════════
async function testInfra() {
    section('5. VALIDAÇÃO DE INFRA');
    
    // Health
    try {
        const health = await axios.get(`${BASE}/health`, { timeout: 10000 });
        const d = health.data;
        results.push(`    Uptime: ${d.uptime}s | Version: ${d.version}`);
        check('Health OK', d.status === 'healthy', `status=${d.status}`);
        check('Puppeteer disponível', d.services?.puppeteer === true, `puppeteer=${d.services?.puppeteer}`);
    } catch (err) {
        check('Health', false, err.message);
    }
    
    // System status
    try {
        const status = await axios.get(`${BASE}/api/system/status`, { timeout: 10000 });
        const d = status.data;
        check('System status OK', status.status === 200, `status=${status.status}`);
        check('Puppeteer (system)', d.services?.puppeteer === true, `puppeteer=${d.services?.puppeteer}`);
    } catch (err) {
        check('System status', false, err.message);
    }
    
    // Leads
    section('5b. LEADS + BANCO');
    try {
        const leads = await axios.get(`${BASE}/admin/leads`, {
            headers: { 'Cookie': '' },
            timeout: 10000,
            validateStatus: () => true
        });
        check('Leads endpoint acessível', leads.status === 200 || leads.status === 302, `status=${leads.status}`);
    } catch (err) {
        warn('Leads', err.message);
    }
}

// ═══════════════════════════════════════════════════════════
// EXECUÇÃO
// ═══════════════════════════════════════════════════════════
async function main() {
    console.log('\n🧪 QA CHECKLIST — LINK MÁGICO V8');
    console.log(`🎯 Target: ${BASE}`);
    console.log(`🔑 API Key: ${API_KEY}`);
    console.log(`🌐 URL teste: ${TEST_URL}`);
    console.log(`⏰ Início: ${new Date().toLocaleString('pt-BR')}\n`);
    
    await testExtraction();
    await testScore();
    await testCheckout();
    await testChatbot();
    await testInfra();
    
    // RESULTADO FINAL
    results.push(`\n${'═'.repeat(60)}`);
    results.push('  🏁 RESULTADO FINAL');
    results.push('═'.repeat(60));
    results.push(`  ✅ Passou: ${passed}`);
    results.push(`  ❌ Falhou: ${failed}`);
    results.push(`  ⚠️ Avisos: ${warnings}`);
    results.push(`  📊 Total: ${passed + failed} checks`);
    results.push(`  ⏰ ${new Date().toLocaleString('pt-BR')}`);
    
    if (failed === 0) {
        results.push(`\n  🎉 APROVADO — Produto funcional + infra confiável`);
    } else {
        results.push(`\n  🚨 NÃO APROVADO — ${failed} falha(s) detectada(s)`);
    }
    
    console.log(results.join('\n'));
}

main().catch(err => {
    console.error('❌ ERRO FATAL:', err.message);
    process.exit(1);
});
