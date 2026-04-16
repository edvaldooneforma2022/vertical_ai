/**
 * Script de QA V2 — URLs finais após redirect
 */

const https = require('https');

const BASE = 'https://vertical-ai-dktu.onrender.com';

const TENANTS = [
    {
        name: 'Teste01',
        apiKey: 'LMV7-QCBK-44S6-M0LF',
        url: 'https://soscrescimento.com.br/braip/?pv=prov6q42&af=afi11l16n6'
    },
    {
        name: 'Teste02',
        apiKey: 'LMV7-9BOT-HM5M-JOUV',
        url: 'https://upflows.com.br/'
    },
    {
        name: 'Teste03',
        apiKey: 'LMV7-85EN-D9I3-UTVW',
        url: 'https://go.hotmart.com/M103841445F'
    },
    {
        name: 'Teste04',
        apiKey: 'LMV7-HNTM-9OS5-QGFK',
        url: 'https://www.arsenalsecretodosceos.com.br/linkmagico'
    },
    {
        name: 'Teste05',
        apiKey: 'LMV7-P079-NLC2-8ZY7',
        url: 'https://go.hotmart.com/M103540655P'
    },
    {
        name: 'Teste06',
        apiKey: 'lm_live_4d489b0b54db990c7ae5e5e0ebfb4c8a',
        url: 'https://www.arsenalsecretodosceos.com.br/linkantiga'
    }
];

const TESTS = [
    { q: 'Oi, quero saber mais sobre esse produto', expect: 'Contexto' },
    { q: 'Funciona mesmo?', expect: 'Intent/Objection' },
    { q: 'Quero comprar', expect: 'Checkout' },
    { q: 'Quero falar com alguém', expect: 'Suporte+WhatsApp' },
    { q: 'Já comprei e quero comprar de novo', expect: 'Recompra+Checkout' },
    { q: 'Tá caro demais', expect: 'Objeção' }
];

function sendChat(apiKey, message, url, name) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({ message, url, name, instructions: '', apiKey });
        const opts = {
            hostname: 'vertical-ai-dktu.onrender.com',
            port: 443,
            path: '/api/chat-universal',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
            timeout: 60000
        };
        const req = https.request(opts, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch (_) { resolve({ error: d }); } });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(payload);
        req.end();
    });
}

async function main() {
    console.log('🚀 QA V13.0.4 — 6 TENANTS x 6 TESTES = 36 INTERAÇÕES');
    console.log('═'.repeat(60));

    const results = [];

    for (let t = 0; t < TENANTS.length; t++) {
        const tenant = TENANTS[t];
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`🧪 TENANT ${t+1} — ${tenant.name} | key=${tenant.apiKey.substring(0,12)}...`);
        console.log(`🌐 ${tenant.url.substring(0, 60)}`);
        console.log('═'.repeat(60));

        const tenantResults = { name: tenant.name, tests: [] };

        for (let i = 0; i < TESTS.length; i++) {
            const test = TESTS[i];
            process.stdout.write(`\n[${i+1}/6] "${test.q}" → `);

            try {
                const r = await sendChat(tenant.apiKey, test.q, tenant.url, tenant.name);
                const resp = r.response || r.error || 'SEM RESPOSTA';

                const hasCheckout = resp.includes('FINALIZAR COMPRA') || resp.includes('━━━');
                const hasWA = resp.includes('wa.me') || resp.includes('WhatsApp');
                const hasBad = /braip|hotmart|kiwify/i.test(resp);
                const hasPrice = /R\$\s?\d+/.test(resp);
                const hasGeneric = /\bproduto digital\b|\bé um curso\b|\bé uma plataforma\b/i.test(resp);

                // Scoring
                let score = 0;
                let notes = [];

                if (i === 0) { // Contexto
                    score = (!hasBad && !hasGeneric) ? 1 : 0;
                    notes = hasBad ? ['❌ Mencionou plataforma'] : hasGeneric ? ['❌ Genérico'] : ['✅ Contexto ok'];
                }
                if (i === 1) { // Intent
                    score = (!hasBad && !hasPrice) ? 1 : 0;
                    notes = ['✅ Intent ok'];
                }
                if (i === 2) { // Checkout
                    score = hasCheckout ? 1 : 0;
                    notes = hasCheckout ? ['✅ Checkout presente'] : ['❌ SEM CHECKOUT'];
                }
                if (i === 3) { // Suporte
                    score = (!hasCheckout && hasWA) ? 2 : hasWA ? 1 : !hasCheckout ? 1 : 0;
                    notes = [];
                    if (hasWA) notes.push('✅ WhatsApp');
                    if (!hasCheckout) notes.push('✅ Sem checkout');
                    if (hasCheckout) notes.push('❌ Checkout em suporte!');
                    if (!hasWA) notes.push('⚠️ Sem WhatsApp');
                }
                if (i === 4) { // Recompra
                    score = hasCheckout ? 1 : 0;
                    notes = hasCheckout ? ['✅ Checkout recompra'] : ['❌ SEM CHECKOUT recompra'];
                }
                if (i === 5) { // Objeção
                    score = (!hasPrice && !hasBad) ? 1 : 0;
                    notes = hasPrice ? ['❌ Inventou preço'] : ['✅ Objeção ok'];
                }

                tenantResults.tests.push({ question: test.q, response: resp.substring(0, 300), score, notes, hasCheckout, hasWA, hasBad, hasPrice });

                console.log(`${notes.join(' | ')}`);
                console.log(`   💬 "${resp.substring(0, 200)}${resp.length > 200 ? '...' : ''}"`);

            } catch (err) {
                console.log(`❌ ERRO: ${err.message}`);
                tenantResults.tests.push({ question: test.q, response: 'ERRO', score: 0, notes: ['❌ ERRO'] });
            }

            await new Promise(r => setTimeout(r, 2500));
        }

        const totalScore = tenantResults.tests.reduce((s, t) => s + t.score, 0);
        console.log(`\n📊 TENANT ${t+1} SCORE: ${totalScore}/7`);
        tenantResults.totalScore = totalScore;
        results.push(tenantResults);
    }

    // Resumo final
    console.log(`\n\n${'═'.repeat(60)}`);
    console.log('📊 RESUMO FINAL');
    console.log('═'.repeat(60));
    
    let grandTotal = 0;
    for (const r of results) {
        console.log(`  ${r.name}: ${r.totalScore}/7`);
        grandTotal += r.totalScore;
    }
    console.log(`\n🏆 TOTAL: ${grandTotal}/42`);
    console.log('═'.repeat(60));
}

main().catch(console.error);
