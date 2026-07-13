const { detectHighIntent } = require('../lib/v15-context-enforcer.js');

const tests = [
    // BUY — deve manter
    ['Quero comprar agora', 'buy'],
    ['Manda o link de pagamento', 'buy'],
    ['Bora fechar', 'buy'],
    ['Vou levar', 'buy'],
    ['Quero esse produto', 'buy'],
    // FAQ — antes era buy, agora deve ser faq (FIX-07)
    ['Qual o valor do condominio?', 'faq'],
    ['Quanto tempo demora a compra?', 'faq'],
    ['A parcela pode comprometer minha renda?', 'faq'],
    ['Aceita FGTS?', 'faq'],
    ['O apartamento tem varanda?', 'faq'],
    ['Quantos quartos tem?', 'faq'],
    ['Quais bairros voces cobrem?', 'faq'],
    ['Tem piscina?', 'faq'],
    // FAQ — termos financeiros (FIX-08)
    ['Qual a diferenca entre SAC e Tabela PRICE?', 'faq'],
    ['Tem financiamento?', 'faq'],
    ['Qual a taxa de juros?', 'faq'],
    // FAQ — original
    ['Como funciona o produto?', 'faq'],
    // SUPPORT — deve manter
    ['Quero falar com atendente', 'support'],
    ['Preciso de ajuda', 'support'],
];

let pass = 0, fail = 0;
for (const [msg, expected] of tests) {
    const result = detectHighIntent(msg);
    const ok = result === expected;
    if (ok) pass++; else fail++;
    console.log((ok ? 'PASS' : 'FAIL') + ' | ' + result.padEnd(7) + ' | ' + msg);
}
console.log('\n' + pass + '/' + tests.length + ' PASS | ' + fail + ' FAIL');
if (fail > 0) process.exit(1);
