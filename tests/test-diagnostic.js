/**
 * 🧪 TESTE DE DIAGNÓSTICO DO ASSISTENTE (V14.2)
 */

const { runAssistantDiagnostic } = require('../lib/assistant-diagnostic');

const testCases = [
    {
        name: "Assistente Perfeito (AUTO)",
        data: {
            checkoutLink: "https://pay.hotmart.com/ABC",
            cleanText: "Lorem ipsum ".repeat(100), // > 500 chars
            faq: [1, 2, 3],
            whatsapp: "https://wa.me/5511999999999"
        },
        expectedMode: "AUTO"
    },
    {
        name: "Sem Checkout (LIMITED/MANUAL)",
        data: {
            cleanText: "Lorem ipsum ".repeat(100),
            faq: [1, 2, 3],
            whatsapp: "https://wa.me/5511999999999"
        },
        expectedMode: "LIMITED" // 60 points (30 content + 15 faq + 15 wa)
    },
    {
        name: "Conteúdo Fraco (MANUAL)",
        data: {
            checkoutLink: "https://pay.hotmart.com/ABC",
            cleanText: "Pequeno",
            faq: [],
            whatsapp: ""
        },
        expectedMode: "MANUAL" // 40 points (checkout only)
    }
];

console.log("🧪 Iniciando testes de diagnóstico...");

testCases.forEach(tc => {
    const result = runAssistantDiagnostic(tc.data);
    const passed = result.mode === tc.expectedMode;
    console.log(`${passed ? '✅' : '❌'} [${tc.name}] Score: ${result.score} | Mode: ${result.mode} (Esperado: ${tc.expectedMode})`);
    if (result.issues.length > 0) console.log(`   Issues: ${result.issues.join(', ')}`);
    if (result.warnings.length > 0) console.log(`   Warnings: ${result.warnings.join(', ')}`);
});

console.log("\n✅ Testes concluídos.");
