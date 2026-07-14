/**
 * 🧪 TESTE DE DIAGNÓSTICO DO ASSISTENTE (V14.2 + V14.2.1 Fixes)
 * 
 * Testa:
 * - Score e modo corretos para diferentes cenários
 * - V14.2.1: WhatsApp em contatos.whatsapp[] (campo aninhado)
 * - V14.2.1: WhatsApp como número formatado (+55...)
 * - V14.2.1: FAQ com campos alternativos
 */

const { runAssistantDiagnostic } = require('../lib/assistant-diagnostic');

let passed = 0;
let failed = 0;

function test(name, data, expectedMode, expectedScore) {
    const result = runAssistantDiagnostic(data);
    const modeOk = result.mode === expectedMode;
    const scoreOk = expectedScore === undefined || result.score === expectedScore;
    const ok = modeOk && scoreOk;
    
    if (ok) {
        passed++;
        console.log(`✅ [${name}] Score: ${result.score} | Mode: ${result.mode}`);
    } else {
        failed++;
        console.log(`❌ [${name}] Score: ${result.score} (esperado: ${expectedScore || '?'}) | Mode: ${result.mode} (esperado: ${expectedMode})`);
    }
    if (result.issues.length > 0) console.log(`   Issues: ${result.issues.join(', ')}`);
    if (result.warnings.length > 0) console.log(`   Warnings: ${result.warnings.join(', ')}`);
    return ok;
}

console.log("🧪 Iniciando testes de diagnóstico V14.2.1...\n");

// ===== TESTES ORIGINAIS =====
console.log("--- Testes Originais ---");

test("Assistente Perfeito (AUTO)", {
    checkoutLink: "https://pay.hotmart.com/ABC",
    cleanText: "Lorem ipsum ".repeat(100),
    faq: [1, 2, 3],
    whatsapp: "https://wa.me/5511999999999"
}, "AUTO", 100);

test("Sem Checkout (LIMITED)", {
    cleanText: "Lorem ipsum ".repeat(100),
    faq: [1, 2, 3],
    whatsapp: "https://wa.me/5511999999999"
}, "LIMITED", 60);

test("Conteúdo Fraco (MANUAL)", {
    checkoutLink: "https://pay.hotmart.com/ABC",
    cleanText: "Pequeno",
    faq: [],
    whatsapp: ""
}, "MANUAL", 40);

// ===== V14.2.1: FIX WhatsApp em contatos.whatsapp[] =====
console.log("\n--- V14.2.1: WhatsApp em contatos.whatsapp[] ---");

test("WhatsApp em contatos.whatsapp (número)", {
    checkoutLink: "https://pay.monetizze.com.br/ABC",
    cleanText: "Lorem ipsum ".repeat(100),
    faq: [{q:"a?"}, {q:"b?"}, {q:"c?"}],
    contatos: {
        whatsapp: ["+5519981647456"],
        whatsappLinks: []
    }
}, "AUTO", 100);

test("WhatsApp em contatos.whatsappLinks (URL)", {
    checkoutLink: "https://pay.hotmart.com/ABC",
    cleanText: "Lorem ipsum ".repeat(100),
    faq: [1, 2, 3],
    contatos: {
        whatsapp: [],
        whatsappLinks: ["https://api.whatsapp.com/send?phone=5519981647456"]
    }
}, "AUTO", 100);

test("WhatsApp SEM contatos (deve falhar)", {
    checkoutLink: "https://pay.hotmart.com/ABC",
    cleanText: "Lorem ipsum ".repeat(100),
    faq: [1, 2, 3],
    contatos: {
        whatsapp: [],
        whatsappLinks: []
    }
}, "AUTO", 85); // 85 >= 80 = AUTO (checkout 40 + content 30 + faq 15 = 85)

// ===== V14.2.1: FIX FAQ campos alternativos =====
console.log("\n--- V14.2.1: FAQ campos alternativos ---");

test("FAQ em campo 'faqs'", {
    checkoutLink: "https://pay.hotmart.com/ABC",
    cleanText: "Lorem ipsum ".repeat(100),
    faqs: [{q:"1"}, {q:"2"}, {q:"3"}],
    whatsapp: "https://wa.me/5511999999999"
}, "AUTO", 100);

test("FAQ em campo 'perguntas_frequentes'", {
    checkoutLink: "https://pay.hotmart.com/ABC",
    cleanText: "Lorem ipsum ".repeat(100),
    perguntas_frequentes: [{q:"1"}, {q:"2"}, {q:"3"}],
    whatsapp: "https://wa.me/5511999999999"
}, "AUTO", 100);

// ===== SIMULAÇÃO: soscrescimento.com.br =====
console.log("\n--- Simulação: soscrescimento.com.br ---");

test("soscrescimento.com.br (cenário real após fix)", {
    checkoutLink: "https://pay.monetizze.com.br/checkout/ABC",
    cleanText: "S.O.S Crescimento Kit Original para crescimento capilar com fórmula exclusiva de aminoácidos e vitaminas ".repeat(10),
    faq: [
        { question: "O kit é original?", answer: "Sim, 100% original" },
        { question: "Quanto tempo demora para chegar?", answer: "5-10 dias úteis" },
        { question: "Tem garantia?", answer: "30 dias de garantia" },
        { question: "Como usar?", answer: "Aplicar conforme instruções" }
    ],
    contatos: {
        whatsapp: ["+5519981647456"],
        whatsappLinks: ["https://api.whatsapp.com/send?phone=5519981647456"],
        telefone: [],
        email: []
    }
}, "AUTO", 100);

test("soscrescimento.com.br (cenário ANTES do fix - sem FAQ)", {
    checkoutLink: "https://pay.monetizze.com.br/checkout/ABC",
    cleanText: "S.O.S Crescimento Kit Original ".repeat(20),
    // Sem faq (não era extraído)
    // WhatsApp em contatos (agora detectado pelo fix V14.2.1)
    contatos: {
        whatsapp: ["+5519981647456"],
        whatsappLinks: ["https://api.whatsapp.com/send?phone=5519981647456"],
    }
}, "AUTO", 85); // 85 >= 80 = AUTO (checkout 40 + content 30 + whatsapp 15 = 85)

// ===== EDGE CASES =====
console.log("\n--- Edge Cases ---");

test("Dados nulos", null, "MANUAL", 0);

test("Objeto vazio", {}, "MANUAL", 0);

test("WhatsApp apenas número sem +55", {
    checkoutLink: "https://pay.hotmart.com/ABC",
    cleanText: "Lorem ipsum ".repeat(100),
    faq: [1, 2, 3],
    contatos: {
        whatsapp: ["19981647456"] // 11 dígitos
    }
}, "AUTO", 100);

// ===== RESULTADO FINAL =====
console.log(`\n${'='.repeat(50)}`);
console.log(`🧪 Resultado: ${passed} passed, ${failed} failed de ${passed + failed} testes`);
console.log(`${failed === 0 ? '✅ TODOS OS TESTES PASSARAM!' : '❌ ALGUNS TESTES FALHARAM!'}`);
process.exit(failed > 0 ? 1 : 0);
