/**
 * 🧪 V16.2 — STRESS TEST (USUÁRIO REAL CAÓTICO)
 * 
 * Objetivo: Validar conversão sob pressão, erros, interrupções e desvios.
 */
const axios = require('axios');

const BASE = 'https://vertical-ai-dktu.onrender.com';
const KEY = 'LMV7-HNTM-9OS5-QGFK';
const URL_PAGE = 'https://www.arsenalsecretodosceos.com.br/linkmagic';

async function send(msg, convId) {
    // Delay para simular digitação e evitar rate limit
    await new Promise(r => setTimeout(r, 4500));
    try {
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
        const text = res.data && (res.data.response || res.data.text || res.data.message) || '';
        return {
            text,
            hasCheckout: text.includes('FINALIZAR COMPRA') || text.includes('https://'),
            decision: text.includes('v16_') || text.includes('🚀') // Heurística pra detecção de injeção v16
        };
    } catch(e) {
        return { error: e.response ? e.response.status : e.code };
    }
}

async function runPressureTests() {
    console.log('🔥 INICIANDO STRESS TEST V16.2 — COMPORTAMENTO SOB PRESSÃO');
    console.log('════════════════════════════════════════════════════════\n');

    const convId = 'stress_' + Date.now();

    // SCENARIO 1: O USUÁRIO "MUITO ANALFABETO OU COM PRESSA"
    console.log('🔴 CENÁRIO 1: Erro extremo de digitação');
    const r1 = await send('qro comra agra memo me paza o lynk', convId);
    console.log(`   Input: "qro comra agra memo me paza o lynk"`);
    console.log(`   Output: ${r1.text.substring(0, 100)}...`);
    console.log(`   Checkout Enviado: ${r1.hasCheckout ? '✅ SIM' : '❌ NÃO'}`);

    // SCENARIO 2: O USUÁRIO QUE DESVIA (INTERRUPÇÃO)
    console.log('\n🔴 CENÁRIO 2: Interrupção técnica após intenção');
    const r2 = await send('mas pera ai tem garantia de qts dias?', convId);
    console.log(`   Input: "mas pera ai tem garantia de qts dias?"`);
    console.log(`   Output: ${r2.text.substring(0, 100)}...`);
    console.log(`   Checkout Mantido: ${r2.hasCheckout ? '✅ SIM' : '❌ NÃO (esperado se for dúvida complexa)'}`);
    
    // SCENARIO 3: A "RESPOSTA FRACA" DA IA (ANTI-WEAK CHECK)
    console.log('\n🔴 CENÁRIO 3: Desvio total de assunto (Teste de persistência de Buyer)');
    const r3 = await send('ah entendi. e vc é de onde?', convId);
    console.log(`   Input: "ah entendi. e vc é de onde?"`);
    console.log(`   Output: ${r2.text.includes('🚀') || r3.text.includes('🚀') ? '✅ ANTI-WEAK ATIVADO' : '❌ SEM ANTI-WEAK'}`);
    console.log(`   Checkout Presente: ${r3.hasCheckout ? '✅ SIM' : '❌ NÃO'}`);

    // SCENARIO 4: FECHAMENTO FORÇADO (FORCE_CLOSE)
    console.log('\n🔴 CENÁRIO 4: Usuário tentando encerrar sem comprar');
    const r4 = await send('ok vou ver aqui', convId);
    console.log(`   Input: "ok vou ver aqui"`);
    console.log(`   Output: ${r4.text.substring(0, 100)}...`);
    console.log(`   Force Checkout: ${r4.hasCheckout ? '✅ SIM' : '❌ NÃO'}`);

    // SCENARIO 5: SUPORTE DURANTE COMPRA
    console.log('\n🔴 CENÁRIO 5: Pedido de suporte no meio do funil');
    const r5 = await send('quero falar com um humano agora', convId);
    console.log(`   Input: "quero falar com um humano agora"`);
    console.log(`   Output: ${r5.text.substring(0, 100)}...`);
    console.log(`   Link WhatsApp: ${r5.text.includes('WhatsApp') || r5.text.includes('wa.me') ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`   Checkout Bloqueado: ${!r5.hasCheckout ? '✅ SIM' : '❌ NÃO (erro: não deveria enviar checkout aqui)'}`);

    console.log('\n\n🏁 STRESS TEST CONCLUÍDO!');
}

runPressureTests();
