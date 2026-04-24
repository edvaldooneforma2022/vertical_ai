/**
 * Testes V18 Extraction Guard
 * node tests/test-v18-guard.js
 */

const {
    evaluateExtractionStatus,
    buildValidatedData,
    discoverAndClassifyLinks,
    applyIntelligentFallback,
    guardPageData
} = require('../lib/v18-extraction-guard');

let passed = 0;
let total = 0;

function assert(condition, label) {
    total++;
    if (condition) { passed++; console.log(`  ✅ ${label}`); }
    else { console.log(`  ❌ ${label}`); }
}

// ═══════════════════════════════════════════════════════
console.log('\n🧪 TESTE 1 — evaluateExtractionStatus');

// Caso 1: Extração completa
const fullPageData = {
    title: 'Curso XYZ Premium',
    description: 'Aprenda tudo sobre investimentos com nosso curso completo de A a Z',
    cleanText: 'A'.repeat(2500),
    checkoutLink: 'https://pay.hotmart.com/ABC123',
    whatsappLink: 'https://wa.me/5511999999999',
    price_detected: ['R$ 197,00'],
    faq: [{ question: 'Como funciona?', answer: 'Simples' }],
    contatos: { whatsapp: ['5511999999999'], email: ['test@test.com'] }
};
const fullResult = evaluateExtractionStatus(fullPageData);
assert(fullResult.status === 'ok', `Caso completo: status=${fullResult.status} (esperado ok)`);
assert(fullResult.confidence >= 80, `Caso completo: confidence=${fullResult.confidence} (esperado >=80)`);
assert(fullResult.signals.hasCheckout === true, 'Caso completo: hasCheckout=true');
assert(fullResult.signals.hasWhatsApp === true, 'Caso completo: hasWhatsApp=true');

// Caso 2: Extração parcial (tem texto mas sem links)
const partialPageData = {
    title: 'Produto Teste',
    description: '',
    cleanText: 'A'.repeat(600),
    contatos: {}
};
const partialResult = evaluateExtractionStatus(partialPageData);
assert(partialResult.status === 'partial', `Caso parcial: status=${partialResult.status} (esperado partial)`);
assert(partialResult.confidence >= 20 && partialResult.confidence < 50, `Caso parcial: confidence=${partialResult.confidence}`);
assert(partialResult.signals.hasCheckout === false, 'Caso parcial: hasCheckout=false');

// Caso 3: Extração falhou
const failedPageData = { title: '', cleanText: '', contatos: {} };
const failedResult = evaluateExtractionStatus(failedPageData);
assert(failedResult.status === 'failed', `Caso falho: status=${failedResult.status} (esperado failed)`);
assert(failedResult.confidence < 20, `Caso falho: confidence=${failedResult.confidence}`);

// Caso 4: null
const nullResult = evaluateExtractionStatus(null);
assert(nullResult.status === 'failed', 'null → failed');
assert(nullResult.confidence === 0, 'null → confidence=0');

// ═══════════════════════════════════════════════════════
console.log('\n🧪 TESTE 2 — buildValidatedData');

const validated = buildValidatedData(fullPageData, fullResult);
assert(validated.checkout === 'https://pay.hotmart.com/ABC123', 'checkout preservado');
assert(validated.whatsapp === 'https://wa.me/5511999999999', 'whatsapp preservado');
assert(validated.isReliable === true, 'isReliable=true quando status=ok');
assert(validated.source === 'extracted', 'source=extracted');

const validatedPartial = buildValidatedData(partialPageData, partialResult);
assert(validatedPartial.isReliable === false, 'isReliable=false quando status=partial');
assert(validatedPartial.checkout === null, 'checkout=null quando não existe');

// ═══════════════════════════════════════════════════════
console.log('\n🧪 TESTE 3 — discoverAndClassifyLinks');

const pageWithLinks = {
    url: 'https://meuproduto.com/vendas',
    checkoutLink: 'https://pay.hotmart.com/ABC123',
    whatsappLink: 'https://wa.me/5511999999999',
    linksExtraidos: [
        { url: 'https://pay.kiwify.com/checkout/xyz' },
        { url: 'https://instagram.com/marca' },
        { url: 'https://meuproduto.com/blog' }
    ],
    contatos: {
        whatsappLinks: ['https://wa.me/5511888888888']
    }
};
const discovered = discoverAndClassifyLinks(pageWithLinks);
assert(discovered.checkout.length >= 2, `checkout descobertos: ${discovered.checkout.length} (>=2)`);
assert(discovered.whatsapp.length >= 2, `whatsapp descobertos: ${discovered.whatsapp.length} (>=2)`);
assert(discovered.social.length >= 1, `social descobertos: ${discovered.social.length} (>=1)`);

// Caso: sem links
const emptyDiscovery = discoverAndClassifyLinks({});
assert(emptyDiscovery.checkout.length === 0, 'sem links → checkout=0');
assert(emptyDiscovery.whatsapp.length === 0, 'sem links → whatsapp=0');

// URL de entrada NÃO deve ser checkout
const selfUrlPage = {
    url: 'https://ev.braip.com/ref?pv=abc',
    linksExtraidos: [
        { url: 'https://ev.braip.com/ref?pv=abc' },
        { url: 'https://ev.braip.com/checkout/xyz123' }
    ]
};
const selfDiscovery = discoverAndClassifyLinks(selfUrlPage);
assert(!selfDiscovery.checkout.includes('https://ev.braip.com/ref?pv=abc'), 'URL de entrada excluída do checkout');
assert(selfDiscovery.checkout.length >= 1, 'Outro link braip com path diferente detectado como checkout');

// ═══════════════════════════════════════════════════════
console.log('\n🧪 TESTE 4 — applyIntelligentFallback');

// Caso 1: extração OK → sem fallback
const okPageData = { checkoutLink: 'https://pay.hotmart.com/X' };
const okMeta = { status: 'ok', confidence: 90 };
const okValidated = { checkout: 'https://pay.hotmart.com/X', whatsapp: null };
const okFallback = applyIntelligentFallback(okPageData, okValidated, { checkout: ['https://alt.com'], whatsapp: [] }, okMeta);
assert(okFallback.applied === false, 'status=ok → sem fallback');
assert(okFallback.fallbackData !== undefined, 'fallbackData retornado');

// Caso 2: extração parcial + checkout descoberto → fallback disponível (NÃO muta pageData)
const partialPage = { url: 'https://meuproduto.com' };
const partialMeta = { status: 'partial', confidence: 30 };
const partialValidated2 = { checkout: null, whatsapp: null };
const partialLinks = { checkout: ['https://pay.hotmart.com/FALLBACK'], whatsapp: ['https://wa.me/5511111111'] };
const partialFallback = applyIntelligentFallback(partialPage, partialValidated2, partialLinks, partialMeta);
assert(partialFallback.applied === true, 'status=partial → fallback disponível');
assert(partialFallback.fallbacks.length === 2, `fallbacks: ${partialFallback.fallbacks.length} (checkout+whatsapp)`);
assert(partialFallback.fallbackData.checkout === 'https://pay.hotmart.com/FALLBACK', 'fallbackData.checkout preenchido');
assert(partialFallback.fallbackData.checkoutSource === 'v18-fallback-discovery', 'fallbackData.checkoutSource correto');
assert(partialFallback.fallbackData.whatsapp === 'https://wa.me/5511111111', 'fallbackData.whatsapp preenchido');
assert(!partialPage.checkoutLink, 'pageData NÃO mutado (checkoutLink ainda null)');
assert(!partialPage.whatsappLink, 'pageData NÃO mutado (whatsappLink ainda null)');

// Caso 3: extração falhou mas sem links → sem fallback
const failedPage = {};
const failedMeta2 = { status: 'failed', confidence: 5 };
const failedValidated = { checkout: null, whatsapp: null };
const failedFallback = applyIntelligentFallback(failedPage, failedValidated, { checkout: [], whatsapp: [] }, failedMeta2);
assert(failedFallback.applied === false, 'sem links descobertos → sem fallback');

// ═══════════════════════════════════════════════════════
console.log('\n🧪 TESTE 5 — guardPageData (end-to-end)');

// Caso 1: pageData completo
const fullGuarded = guardPageData({ ...fullPageData }, { enableFallback: false });
assert(fullGuarded._extractionGuard !== undefined, 'metadata adicionada');
assert(fullGuarded._extractionGuard.version === '18.2', 'version=18.2');
assert(fullGuarded._extractionGuard.status === 'ok', 'status=ok');
assert(fullGuarded._extractionGuard.isReliable === true, 'isReliable=true');
assert(fullGuarded._extractionGuard.extractionFailed === false, 'extractionFailed=false (confidence alta)');
assert(fullGuarded.checkoutLink === 'https://pay.hotmart.com/ABC123', 'checkoutLink preservado (sem fallback)');

// Caso 2: pageData parcial COM fallback
const partialGuarded = guardPageData({
    title: 'Produto',
    cleanText: 'A'.repeat(300),
    linksExtraidos: [
        { url: 'https://pay.hotmart.com/DISCOVERED' },
        { url: 'https://wa.me/5511999999999' }
    ],
    contatos: {}
}, { enableFallback: true });
assert(partialGuarded._extractionGuard.status === 'partial', 'status=partial');
assert(partialGuarded._extractionGuard.isReliable === false, 'isReliable=false');
assert(partialGuarded._extractionGuard.fallback.applied === true, 'fallback aplicado');
assert(partialGuarded.checkoutLink === 'https://pay.hotmart.com/DISCOVERED', 'checkout via fallback');
assert(partialGuarded.whatsappLink === 'https://wa.me/5511999999999', 'whatsapp via fallback');

// Caso 3: pageData parcial SEM fallback (flag OFF)
const partialNoFallback = guardPageData({
    title: 'Produto',
    cleanText: 'A'.repeat(300),
    linksExtraidos: [{ url: 'https://pay.hotmart.com/NOPE' }],
    contatos: {}
}, { enableFallback: false });
assert(partialNoFallback._extractionGuard.fallback.applied === false, 'fallback NÃO aplicado (flag OFF)');
assert(!partialNoFallback.checkoutLink, 'checkoutLink continua null (flag OFF)');

// Caso 4: null → retorna null
const nullGuarded = guardPageData(null);
assert(nullGuarded === null, 'null → retorna null');

// Caso 5: Dados originais preservados
const originalData = {
    title: 'Produto Original',
    description: 'Desc original',
    cleanText: 'A'.repeat(2500),
    checkoutLink: 'https://original.com/checkout',
    whatsappLink: 'https://wa.me/original',
    price_detected: ['R$ 99'],
    contatos: { email: ['a@b.com'] }
};
const originalCopy = JSON.parse(JSON.stringify(originalData));
guardPageData(originalData, { enableFallback: true });
assert(originalData.title === originalCopy.title, 'title preservado');
assert(originalData.checkoutLink === originalCopy.checkoutLink, 'checkoutLink preservado (já existia)');
assert(originalData.whatsappLink === originalCopy.whatsappLink, 'whatsappLink preservado (já existia)');

// ═══════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════════════════');
console.log(`📊 RESULTADO: ${passed}/${total} (${Math.round(passed/total*100)}%)`);
console.log('══════════════════════════════════════════════════');
if (passed === total) console.log('🔥 TODOS OS TESTES PASSARAM\n');
else console.log(`⚠️ ${total - passed} TESTES FALHARAM\n`);
