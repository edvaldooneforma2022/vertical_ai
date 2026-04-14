/**
 * 🧪 TESTE V13.2 — 10 CENÁRIOS DE VALIDAÇÃO
 * Testa: Intent → State → Rule Engine → Multi-Checkout → Resultado
 */

const { classifyIntent } = require('../lib/v13-intent-classifier');
const { decideAction } = require('../lib/v13-rule-engine');
const { resolveCheckout, detectObjectionType } = require('../lib/v13-multi-checkout-engine');
const { buildBaseResponse } = require('../lib/v13-response-builder');

// Simular pageData
const MOCK_PAGE = {
    checkoutLink: 'https://pay.hotmart.com/ABC123',
    upsells: ['https://pay.hotmart.com/PREMIUM456'],
    downsells: ['https://pay.hotmart.com/BASIC789'],
    title: 'Curso Marketing Digital',
    whatsapp: 'https://wa.me/5511999999999'
};

// State manager mock
const states = {};
function mockState(convId, intent) {
    if (!states[convId]) states[convId] = { stage: 'COLD', score: 0, messageCount: 0, checkoutSent: false, checkoutConfirmed: false };
    const s = states[convId];
    s.messageCount++;
    if (intent === 'READY_TO_BUY') { s.score += 30; s.stage = s.score >= 60 ? 'HOT' : 'WARM'; }
    else if (intent === 'INTEREST') { s.score += 15; s.stage = s.score >= 40 ? 'WARM' : 'COLD'; }
    else if (intent === 'OBJECTION') { s.score -= 5; }
    else if (intent === 'DOUBT') { s.score += 10; s.stage = s.score >= 40 ? 'WARM' : 'COLD'; }
    return { ...s };
}

// 10 cenários
const TESTS = [
    { id: 1, msg: 'quero comprar',              expect: { intent: 'READY_TO_BUY' } },
    { id: 2, msg: 'qual o preço?',              expect: { intent: 'INTEREST' } },
    { id: 3, msg: 'tá caro',                    expect: { intent: 'OBJECTION' } },
    { id: 4, msg: 'tem mais barato?',           expect: { intent: 'INTEREST' } },
    { id: 5, msg: 'já comprei antes',           expect: { intent: 'GENERIC' } },
    { id: 6, msg: 'me manda o link',            expect: { intent: 'READY_TO_BUY' } },
    { id: 7, msg: 'quero falar com alguém',     expect: { intent: 'SUPPORT' } },
    { id: 8, msg: 'como funciona?',             expect: { intent: 'DOUBT' } },
    { id: 9, msg: 'isso presta?',               expect: { intent: 'OBJECTION' } },
    { id: 10, msg: 'tem garantia?',             expect: { intent: 'DOUBT' } },
];

console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 TESTE V13.2 — 10 CENÁRIOS DE VALIDAÇÃO');
console.log('═══════════════════════════════════════════════════════════\n');

let passed = 0;
let failed = 0;

for (const test of TESTS) {
    const convId = 'test_conv_1';
    
    // 1. Intent
    const intentResult = classifyIntent(test.msg);
    
    // 2. State
    const stateResult = mockState(convId, intentResult.intent);
    
    // 3. Rule Engine
    const actionResult = decideAction(intentResult.intent, stateResult, {
        checkoutLink: MOCK_PAGE.checkoutLink,
        productName: MOCK_PAGE.title
    });
    
    // 4. Objection type
    const objType = detectObjectionType(test.msg);
    
    // 5. Multi-Checkout
    const checkoutResult = resolveCheckout({
        action: actionResult.action,
        intent: intentResult.intent,
        stage: stateResult.stage,
        baseCheckout: MOCK_PAGE.checkoutLink,
        context: {
            upsells: MOCK_PAGE.upsells,
            downsells: MOCK_PAGE.downsells,
            objectionType: objType,
            messageCount: stateResult.messageCount,
            checkoutAlreadySent: stateResult.checkoutSent
        }
    });
    
    // 6. Response Builder
    const baseResponse = buildBaseResponse(actionResult.action, {
        checkoutLink: MOCK_PAGE.checkoutLink,
        productName: MOCK_PAGE.title,
        whatsappLink: MOCK_PAGE.whatsapp,
        userMessage: test.msg
    });

    // Validação
    const intentOk = intentResult.intent === test.expect.intent;
    const status = intentOk ? '✅' : '❌';
    if (intentOk) passed++; else failed++;

    console.log(`${status} Cenário ${test.id}: "${test.msg}"`);
    console.log(`   Intent:   ${intentResult.intent} (expected: ${test.expect.intent}) ${intentOk ? '✅' : '❌ FALHOU'}`);
    console.log(`   State:    ${stateResult.stage} (score=${stateResult.score})`);
    console.log(`   Action:   ${actionResult.action} (reason=${actionResult.reason})`);
    console.log(`   Checkout: ${checkoutResult ? `${checkoutResult.type} → ${checkoutResult.label}` : 'NENHUM'}`);
    console.log(`   Response: type=${baseResponse.type} | "${baseResponse.baseText.substring(0, 60)}..."`);
    if (objType) console.log(`   Objeção:  ${objType}`);
    console.log('');
}

console.log('═══════════════════════════════════════════════════════════');
console.log(`📊 RESULTADO: ${passed}/10 passaram | ${failed}/10 falharam`);
console.log('═══════════════════════════════════════════════════════════');

process.exit(0);
