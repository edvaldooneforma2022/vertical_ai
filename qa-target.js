/**
 * Tira-teima para Tenant 1 e 2
 */
const https = require('https');
const TENANTS = [
    { name: 'Teste01', apiKey: 'LMV7-QCBK-44S6-M0LF', url: 'https://soscrescimento.com.br/braip/?pv=prov6q42&af=afi11l16n6' },
    { name: 'Teste02', apiKey: 'LMV7-9BOT-HM5M-JOUV', url: 'https://upflows.com.br/' }
];
const TESTS = [
    { q: 'Oi, quero saber mais sobre esse produto' },
    { q: 'Funciona mesmo?' },
    { q: 'Quero comprar' },
    { q: 'Quero falar com alguém' },
    { q: 'Já comprei e quero comprar de novo' },
    { q: 'Tá caro demais' }
];
function sendChat(apiKey, message, url, name) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({ message, url, name, instructions: '', apiKey });
        const opts = { hostname: 'vertical-ai-dktu.onrender.com', port: 443, path: '/api/chat-universal', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }, timeout: 60000 };
        const req = https.request(opts, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (_) { resolve({ error: d }); } }); });
        req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(payload); req.end();
    });
}
async function main() {
    for (let t = 0; t < TENANTS.length; t++) {
        const tenant = TENANTS[t];
        console.log(`\n🧪 TENANT ${t+1} — ${tenant.name}`);
        for (let i = 0; i < TESTS.length; i++) {
            const r = await sendChat(tenant.apiKey, TESTS[i].q, tenant.url, tenant.name);
            console.log(`[${i+1}] Q: ${TESTS[i].q}\n    A: ${r.response ? r.response.substring(0, 150).replace(/\n/g, ' ') : 'ERRO'}`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}
main();
