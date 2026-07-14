/**
 * 🧪 V16.2 — RETEST (4 casos que faltaram por rate limit)
 */
const axios = require('axios');

const BASE = 'https://vertical-ai-dktu.onrender.com';
const KEY = 'LMV7-HNTM-9OS5-QGFK';
const URL_PAGE = 'https://www.arsenalsecretodosceos.com.br/linkmagic';

async function test(msg, label) {
    await new Promise(r => setTimeout(r, 5000));
    try {
        const convId = 'retest_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
        const res = await axios.post(BASE + '/api/chat-universal', {
            message: msg,
            apiKey: KEY,
            url: URL_PAGE,
            conversationId: convId,
            pageData: { url: URL_PAGE, salesMode: 'auto' }
        }, {
            headers: { 'Content-Type': 'application/json', 'X-API-Key': KEY },
            timeout: 30000
        });
        const text = res.data && (res.data.response || res.data.text || res.data.message) || JSON.stringify(res.data);
        const hasCheckout = text.includes('FINALIZAR COMPRA') || text.includes('https://');
        const hasSupport = text.toLowerCase().includes('atend') || text.toLowerCase().includes('suporte') || text.toLowerCase().includes('whatsapp') || text.toLowerCase().includes('ajudar');
        const hasReengagement = text.includes('?');
        
        console.log('\n' + label);
        console.log('  Input: ' + msg);
        console.log('  Output: ' + text.substring(0, 200));
        console.log('  Checkout: ' + (hasCheckout ? '✅ SIM' : '❌ NÃO'));
        console.log('  Support: ' + (hasSupport ? '✅ SIM' : '❌ NÃO'));
        console.log('  Reengagement: ' + (hasReengagement ? '✅ SIM' : '❌ NÃO'));
    } catch(e) {
        console.log('\n' + label + ' -> ERRO: ' + (e.response ? e.response.status : e.code) + ' — ' + (e.response && e.response.data ? e.response.data.error : e.message));
    }
}

async function main() {
    console.log('🧪 V16.2 — RETEST (4 CASOS RESTANTES)');
    console.log('═══════════════════════════════════════');
    
    await test('preciso de ajuda', '🚫 SUPPORT: "preciso de ajuda"');
    await test('já comprei', '🔁 REBUY: "já comprei"');
    await test('quero comprar de novo', '🔁 REBUY: "quero comprar de novo"');
    await test('vou pensar', '⏳ DELAY: "vou pensar"');
    
    console.log('\n\n🏁 Retest concluído!');
}

main().catch(function(e) { console.error('FATAL:', e.message); });
