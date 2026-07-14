/**
 * 🧪 TESTES — WA-CTA PROMOTER
 * 
 * Cobre os 5 cenários críticos:
 * 1. Site com checkout → NÃO promove (Braip permanece 100)
 * 2. Site sem checkout + WA conversão → promove (Upflows → ≥80)
 * 3. Site sem checkout sem WA → não altera
 * 4. 🔴 CRÍTICO: checkout + WA coexistindo → checkout NÃO sobrescrito
 * 5. WA de suporte/footer → NÃO promove (falso positivo bloqueado)
 * 
 * + Testes do diagnóstico (score cap 85, modo AUTO)
 */

'use strict';

const { promoteWhatsAppToCTA, evaluateWhatsAppIntent, CONFIDENCE_THRESHOLD } = require('../lib/wa-cta-promoter');
const { runAssistantDiagnostic } = require('../lib/assistant-diagnostic');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✅ ${name}`);
    } catch (e) {
        failed++;
        console.log(`  ❌ ${name}: ${e.message}`);
    }
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'Assertion failed');
}

console.log('\n═══════════════════════════════════════════');
console.log('🧪 TESTES — WA-CTA PROMOTER');
console.log('═══════════════════════════════════════════\n');

// ═══════════════════════════════════════════
// CENÁRIO 1: Site com checkout → NÃO promove
// (Braip, e-commerce clássico)
// ═══════════════════════════════════════════
console.log('📋 CENÁRIO 1: Site COM checkout (e-commerce)');

test('Não promove quando checkout existe', () => {
    const pageData = {
        checkoutLink: 'https://ev.braip.com/checkout/abc123',
        checkoutSource: 'heuristic-v93',
        whatsappLink: 'https://wa.me/5511999999999',
        contatos: { whatsappLinks: ['https://wa.me/5511999999999'] },
        cleanText: 'Compre agora nosso produto incrível. Garantia de 30 dias.'
    };
    const result = promoteWhatsAppToCTA(pageData);
    assert(!result.promoted, 'Não deveria promover');
    assert(result.checkoutLink === null, 'checkoutLink deveria ser null');
});

test('Checkout original permanece intacto após tentativa', () => {
    const originalCheckout = 'https://ev.braip.com/checkout/abc123';
    const pageData = {
        checkoutLink: originalCheckout,
        checkoutSource: 'heuristic-v93',
        whatsappLink: 'https://wa.me/5511999999999',
        contatos: { whatsappLinks: ['https://wa.me/5511999999999'] },
        cleanText: 'Compre agora!'
    };
    promoteWhatsAppToCTA(pageData);
    assert(pageData.checkoutLink === originalCheckout, 'Checkout não deveria ser alterado');
});

// ═══════════════════════════════════════════
// CENÁRIO 2: Site sem checkout + WA conversão → promove
// (Upflows, WA-first)
// ═══════════════════════════════════════════
console.log('\n📋 CENÁRIO 2: Site SEM checkout COM WhatsApp (WA-first)');

test('Promove WA como CTA quando sem checkout + keywords de conversão', () => {
    const pageData = {
        checkoutLink: null,
        whatsappLink: 'https://wa.me/5511999999999?text=Quero%20contratar',
        contatos: { whatsappLinks: ['https://wa.me/5511999999999?text=Quero%20contratar'] },
        discoveredLinks: [
            { href: 'https://wa.me/5511999999999?text=Quero%20contratar', text: 'quero contratar agora' },
            { href: 'https://wa.me/5511999999999?text=Quero%20contratar', text: 'fale com especialista' },
            { href: 'https://wa.me/5511999999999?text=Quero%20contratar', text: 'começar agora' },
        ],
        cleanText: 'Nosso serviço ajuda você a contratar o plano ideal. Fale com um especialista. Comece agora mesmo.'
    };
    const result = promoteWhatsAppToCTA(pageData);
    assert(result.promoted === true, 'Deveria promover');
    assert(result.checkoutLink.includes('wa.me'), 'CTA deveria ser WA');
    assert(result.checkoutSource === 'whatsapp-cta', 'Source deveria ser whatsapp-cta');
    assert(result.confidence >= CONFIDENCE_THRESHOLD, `Confidence (${result.confidence}) deveria ser >= ${CONFIDENCE_THRESHOLD}`);
});

test('WA com texto pré-definido ganha prioridade de seleção', () => {
    const pageData = {
        checkoutLink: null,
        contatos: {
            whatsappLinks: [
                'https://wa.me/5511999999999',
                'https://wa.me/5511888888888?text=Quero%20saber%20mais'
            ]
        },
        discoveredLinks: [
            { href: 'https://wa.me/5511999999999', text: 'contato' },
            { href: 'https://wa.me/5511888888888?text=Quero%20saber%20mais', text: 'quero contratar' },
            { href: 'https://wa.me/5511888888888?text=Quero%20saber%20mais', text: 'comprar agora' },
        ],
        cleanText: 'Compre nosso serviço agora. Fale com nosso consultor.'
    };
    const result = promoteWhatsAppToCTA(pageData);
    assert(result.promoted === true, 'Deveria promover');
    // O link com text= deveria ser selecionado por prioridade
    assert(result.checkoutLink.includes('text='), 'Link com text= deveria ter prioridade');
});

// ═══════════════════════════════════════════
// CENÁRIO 3: Site sem checkout sem WA → não altera
// ═══════════════════════════════════════════
console.log('\n📋 CENÁRIO 3: Site SEM checkout SEM WhatsApp');

test('Nada promovido quando não tem WA', () => {
    const pageData = {
        checkoutLink: null,
        whatsappLink: null,
        contatos: { whatsappLinks: [], whatsapp: [] },
        discoveredLinks: [],
        cleanText: 'Site simples sem nenhum CTA.'
    };
    const result = promoteWhatsAppToCTA(pageData);
    assert(!result.promoted, 'Não deveria promover sem WA');
});

// ═══════════════════════════════════════════
// 🔴 CENÁRIO 4 (CRÍTICO): checkout + WA coexistindo
// ═══════════════════════════════════════════
console.log('\n📋 CENÁRIO 4 (CRÍTICO): Checkout + WA coexistindo');

test('Checkout NÃO é sobrescrito mesmo com WA forte', () => {
    const originalCheckout = 'https://pay.hotmart.com/ABC123';
    const pageData = {
        checkoutLink: originalCheckout,
        checkoutSource: 'heuristic-v93',
        whatsappLink: 'https://wa.me/5511999999999?text=Quero%20comprar',
        contatos: {
            whatsappLinks: [
                'https://wa.me/5511999999999?text=Quero%20comprar',
                'https://wa.me/5511999999999?text=Comprar%20agora'
            ]
        },
        discoveredLinks: [
            { href: 'https://wa.me/5511999999999?text=Quero%20comprar', text: 'comprar via whatsapp' },
        ],
        cleanText: 'Compre agora nosso curso incrível!'
    };
    const result = promoteWhatsAppToCTA(pageData);
    assert(!result.promoted, 'NÃO deveria promover quando checkout existe');
    assert(pageData.checkoutLink === originalCheckout, 'Checkout original DEVE permanecer');
    assert(pageData.checkoutSource === 'heuristic-v93', 'Source original DEVE permanecer');
});

// ═══════════════════════════════════════════
// CENÁRIO 5: WA de suporte/footer → NÃO promove
// ═══════════════════════════════════════════
console.log('\n📋 CENÁRIO 5: WA de suporte/footer (falso positivo)');

test('NÃO promove WA de suporte', () => {
    const pageData = {
        checkoutLink: null,
        whatsappLink: 'https://wa.me/5511999999999',
        contatos: { whatsappLinks: ['https://wa.me/5511999999999'] },
        discoveredLinks: [
            { href: 'https://wa.me/5511999999999', text: 'suporte técnico' },
        ],
        cleanText: 'Nosso produto é incrível. Para suporte, entre em contato.'
    };
    const result = promoteWhatsAppToCTA(pageData);
    assert(!result.promoted, 'NÃO deveria promover WA de suporte');
    assert(result.confidence < CONFIDENCE_THRESHOLD, `Confidence (${result.confidence}) deveria ser < ${CONFIDENCE_THRESHOLD}`);
});

test('NÃO promove WA de ajuda/reclamação', () => {
    const pageData = {
        checkoutLink: null,
        whatsappLink: 'https://wa.me/5511999999999',
        contatos: { whatsappLinks: ['https://wa.me/5511999999999'] },
        discoveredLinks: [
            { href: 'https://wa.me/5511999999999', text: 'precisa de ajuda? clique aqui' },
        ],
        cleanText: 'Dúvidas? Fale com nosso atendimento.'
    };
    const result = promoteWhatsAppToCTA(pageData);
    assert(!result.promoted, 'NÃO deveria promover WA de ajuda');
});

test('WA isolado sem contexto de conversão → NÃO promove', () => {
    const pageData = {
        checkoutLink: null,
        whatsappLink: 'https://wa.me/5511999999999',
        contatos: { whatsappLinks: ['https://wa.me/5511999999999'] },
        discoveredLinks: [
            { href: 'https://wa.me/5511999999999', text: 'whatsapp' },
        ],
        cleanText: 'Blog sobre tecnologia. Novidades semanais.'
    };
    const result = promoteWhatsAppToCTA(pageData);
    assert(!result.promoted, 'NÃO deveria promover WA isolado sem contexto');
});

// ═══════════════════════════════════════════
// CENÁRIO 6: DIAGNÓSTICO — Score e Modo
// ═══════════════════════════════════════════
console.log('\n📋 CENÁRIO 6: Diagnóstico (score + modo)');

test('Diagnóstico: site WA-CTA deve atingir AUTO (score >= 80)', () => {
    const pageData = {
        checkoutLink: 'https://wa.me/5511999999999?text=Contratar',
        checkoutSource: 'whatsapp-cta',
        whatsappLink: 'https://wa.me/5511999999999',
        contatos: { whatsappLinks: ['https://wa.me/5511999999999'] },
        cleanText: 'A'.repeat(600), // conteúdo suficiente
        faq: [
            { question: 'O que é?', answer: 'Nosso produto' },
            { question: 'Quanto custa?', answer: 'R$ 99,90' },
            { question: 'Tem garantia?', answer: 'Sim, 30 dias' },
        ]
    };
    const diag = runAssistantDiagnostic(pageData);
    assert(diag.score >= 80, `Score (${diag.score}) deveria ser >= 80`);
    assert(diag.mode === 'AUTO', `Modo deveria ser AUTO, foi ${diag.mode}`);
    assert(diag.isWaCta === true, 'isWaCta deveria ser true');
});

test('Diagnóstico: score WA-CTA é capped em 85', () => {
    const pageData = {
        checkoutLink: 'https://wa.me/5511999999999?text=Contratar',
        checkoutSource: 'whatsapp-cta',
        whatsappLink: 'https://wa.me/5511999999999',
        contatos: { whatsappLinks: ['https://wa.me/5511999999999'] },
        cleanText: 'A'.repeat(3000), // muito conteúdo
        faq: Array.from({ length: 10 }, (_, i) => ({ question: `Q${i}?`, answer: `A${i}` })),
    };
    const diag = runAssistantDiagnostic(pageData);
    assert(diag.score <= 85, `Score (${diag.score}) deveria ser <= 85 (capped)`);
});

test('Diagnóstico: checkout real NÃO tem cap', () => {
    const pageData = {
        checkoutLink: 'https://ev.braip.com/checkout/abc123',
        checkoutSource: 'heuristic-v93',
        whatsappLink: 'https://wa.me/5511999999999',
        contatos: { whatsappLinks: ['https://wa.me/5511999999999'] },
        cleanText: 'A'.repeat(3000),
        faq: Array.from({ length: 10 }, (_, i) => ({ question: `Q${i}?`, answer: `A${i}` })),
    };
    const diag = runAssistantDiagnostic(pageData);
    assert(diag.score === 100, `Score (${diag.score}) deveria ser 100 (sem cap)`);
    assert(diag.isWaCta === false, 'isWaCta deveria ser false');
});

// ═══════════════════════════════════════════
// CENÁRIO 7: evaluateWhatsAppIntent — unit tests
// ═══════════════════════════════════════════
console.log('\n📋 CENÁRIO 7: evaluateWhatsAppIntent (unit tests)');

test('Intent: sem WA retorna false', () => {
    const result = evaluateWhatsAppIntent({});
    assert(!result.isConversion, 'Deveria ser false sem WA');
    assert(result.confidence === 0, 'Confidence deveria ser 0');
});

test('Intent: WA com keyword "comprar" tem alta confiança', () => {
    const result = evaluateWhatsAppIntent({
        whatsappLink: 'https://wa.me/5511999999999',
        discoveredLinks: [
            { href: 'https://wa.me/5511999999999', text: 'comprar agora' },
            { href: 'https://wa.me/5511999999999', text: 'quero comprar' },
            { href: 'https://wa.me/5511999999999', text: 'comprar' },
        ],
        cleanText: 'Compre nosso produto agora. Garanta o seu!',
        contatos: { whatsappLinks: ['https://wa.me/5511999999999'] }
    });
    assert(result.isConversion === true, 'Deveria ser conversão');
    assert(result.confidence >= 0.6, `Confidence (${result.confidence}) deveria ser >= 0.6`);
});

test('Intent: WA com keyword "suporte" tem baixa confiança', () => {
    const result = evaluateWhatsAppIntent({
        whatsappLink: 'https://wa.me/5511999999999',
        discoveredLinks: [
            { href: 'https://wa.me/5511999999999', text: 'suporte ao cliente' },
        ],
        cleanText: 'Nosso suporte está disponível.',
        contatos: { whatsappLinks: ['https://wa.me/5511999999999'] }
    });
    assert(!result.isConversion, 'NÃO deveria ser conversão');
});

// ═══════════════════════════════════════════
// RESULTADO
// ═══════════════════════════════════════════
console.log('\n═══════════════════════════════════════════');
console.log(`📊 RESULTADO: ${passed}/${passed + failed} testes passaram`);
if (failed > 0) {
    console.log(`❌ ${failed} teste(s) falharam`);
    process.exit(1);
} else {
    console.log('✅ TODOS OS TESTES PASSARAM');
    process.exit(0);
}
