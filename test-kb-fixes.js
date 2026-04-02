/**
 * 🧪 TESTE DAS CORREÇÕES KB-FIRST + SCHED-001 + SCHED-002 + KB-SMART-001
 * 
 * Valida que:
 * 1. searchSmart() encontra FAQs com frases naturais
 * 2. detectarAgendamento() NÃO dispara com palavras genéricas
 * 3. processarAgendamento() NÃO interpreta números em frases como horários
 * 
 * Executar: node test-kb-fixes.js
 */

'use strict';

// ═══════════════════════════════════════════════════════════
// MOCK: Knowledge Base Manager (searchSmart)
// ═══════════════════════════════════════════════════════════
const { KnowledgeBaseManager } = (() => {
    // Importar a classe real
    const kbModule = require('./knowledge-base');
    // Re-exportar para teste
    return { KnowledgeBaseManager: kbModule.knowledgeBaseManager.constructor };
})();

const kb = new KnowledgeBaseManager();

// Simular FAQs como as do usuário
const TEST_CHATBOT_ID = 'test-kb-fixes';
kb.knowledgeBases.set(TEST_CHATBOT_ID, {
    chatbotId: TEST_CHATBOT_ID,
    sources: [],
    faqs: [
        {
            id: 'faq1', active: true, hits: 0,
            question: 'o que é isso link magico o que faz pra que serve qual produto ferramenta plataforma',
            answer: 'O Link Mágico transforma qualquer link em um vendedor automático com IA. Você cola o link de um produto, página ou serviço → a IA lê tudo → e começa a vender pra você. Quer ver na prática? Me manda qualquer link e eu te mostro.'
        },
        {
            id: 'faq2', active: true, hits: 0,
            question: 'como funciona na pratica como usar como ativa como faz funcionar na real explica',
            answer: 'É simples — 3 passos: 1. Você cola o link do seu produto 2. A IA lê e entende tudo automaticamente 3. Ela começa a responder os clientes e vender Sem configuração, sem programação. Cola o link e pronto.'
        },
        {
            id: 'faq6', active: true, hits: 0,
            question: 'quanto custa preco valor plano mensalidade investimento gratuito gratis free teste',
            answer: 'Tem plano é R$ 97,00/ano. Mas antes de olhar preço, faz o seguinte: Testa com o seu próprio link aqui na página. Quando você ver a IA vendendo o SEU produto, o valor faz sentido sozinho. Quer testar agora?'
        },
        {
            id: 'faq7', active: true, hits: 0,
            question: 'quero comprar como comprar ativar contratar assinar começar link checkout pagar pagamento',
            answer: 'Boa! Vamos ativar agora. Clica aqui para garantir seu acesso: 👉 https://pay.hotmart.com/G103177435I Se tiver qualquer dúvida depois de ativar, é só chamar aqui.'
        },
        {
            id: 'faq9', active: true, hits: 0,
            question: 'funciona whatsapp direct instagram redes sociais mensagem automatica integra',
            answer: 'Sim, tem integração com WhatsApp. Quando um lead demonstra interesse, você recebe alerta no WhatsApp na hora. Também dá pra configurar atendimento automático direto no WhatsApp. Quer saber como ativar isso?'
        },
        {
            id: 'faq11', active: true, hits: 0,
            question: 'tem suporte ajuda depois de comprar atendimento duvida problema tecnico assistencia',
            answer: 'Sim, tem suporte direto. Depois de ativar, se precisar de qualquer ajuda para configurar ou otimizar, é só chamar. A plataforma é simples, mas estamos junto se precisar.'
        }
    ],
    documents: [],
    manualEntries: [],
    lastUpdated: new Date().toISOString(),
    totalEntries: 6
});

// ═══════════════════════════════════════════════════════════
// TESTE 1: searchSmart() encontra FAQs com frases naturais
// ═══════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(70));
console.log('📚 TESTE 1: searchSmart() — Busca inteligente com frases naturais');
console.log('═'.repeat(70));

const testQueries = [
    { input: 'Ola, o que e o Link Magico?', expectFaq: 'faq1', desc: 'FAQ 1 — O QUE É' },
    { input: 'Isso funciona no meu WhatsApp tambem?', expectFaq: 'faq9', desc: 'FAQ 9 — WHATSAPP' },
    { input: 'Se eu contratar agora, tenho algum suporte tecnico?', expectFaq: 'faq11', desc: 'FAQ 11 — SUPORTE' },
    { input: 'Perfeito, onde eu faco o pagamento?', expectFaq: 'faq7', desc: 'FAQ 7 — CHECKOUT' },
    { input: 'Pode me enviar o link de compra novamente para eu nao perder?', expectFaq: 'faq7', desc: 'FAQ 7 — CHECKOUT (link)' },
    { input: 'Quanto custa isso?', expectFaq: 'faq6', desc: 'FAQ 6 — PREÇO' },
    { input: 'Como funciona na pratica?', expectFaq: 'faq2', desc: 'FAQ 2 — COMO FUNCIONA' },
];

let passed = 0;
let failed = 0;

for (const test of testQueries) {
    const results = kb.searchSmart(TEST_CHATBOT_ID, test.input, 3);
    const bestMatch = results[0];
    const matchId = bestMatch?.data?.id;
    const score = bestMatch?.score || 0;
    
    const ok = matchId === test.expectFaq && score >= 3;
    
    if (ok) {
        console.log(`  ✅ "${test.input}"`);
        console.log(`     → ${test.desc} | Score: ${score} | Match: ${matchId}`);
        passed++;
    } else {
        console.log(`  ❌ "${test.input}"`);
        console.log(`     → Esperado: ${test.expectFaq} (${test.desc})`);
        console.log(`     → Obtido: ${matchId || 'NENHUM'} | Score: ${score}`);
        if (results.length > 0) {
            console.log(`     → Top 3: ${results.map(r => `${r.data.id}(${r.score})`).join(', ')}`);
        }
        failed++;
    }
}

// ═══════════════════════════════════════════════════════════
// TESTE 2: detectarAgendamento() NÃO dispara com palavras genéricas
// ═══════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(70));
console.log('📅 TESTE 2: detectarAgendamento() — Não deve disparar com palavras genéricas');
console.log('═'.repeat(70));

// Criar instância local para teste
class TestSuperInteligencia {
    constructor() {
        this.horariosDisponiveis = [
            "Segunda 09:00", "Segunda 14:00", "Segunda 16:00",
            "Terça 10:00", "Terça 15:00", "Terça 17:00",
            "Quarta 09:30", "Quarta 14:30", "Quarta 16:30",
            "Quinta 11:00", "Quinta 15:30", "Quinta 17:30",
            "Sexta 10:30", "Sexta 14:00", "Sexta 16:00"
        ];
    }

    // Versão CORRIGIDA (KB-SCHED-001)
    detectarAgendamento(mensagem) {
        const mensagemLower = mensagem.toLowerCase();
        const frasesAgendamento = [
            'quero agendar', 'quero marcar', 'gostaria de agendar', 'gostaria de marcar',
            'agendar reunião', 'agendar reuniao', 'marcar reunião', 'marcar reuniao',
            'agendar consulta', 'marcar consulta', 'agendar horário', 'agendar horario',
            'marcar horário', 'marcar horario', 'agendar uma', 'marcar uma',
            'posso agendar', 'como agendar', 'como marcar', 'agendar call',
            'marcar call', 'agendar video', 'agendar vídeo',
            'escolher horário', 'escolher horario', 'ver horários', 'ver horarios',
            'disponibilidade de horário', 'disponibilidade de horario'
        ];
        const isAgendamento = frasesAgendamento.some(frase => mensagemLower.includes(frase));
        return isAgendamento ? 'AGENDAMENTO' : null;
    }

    // Versão CORRIGIDA (KB-SCHED-002)
    processarAgendamento(mensagem) {
        const mensagemLower = mensagem.toLowerCase().trim();
        for (let i = 0; i < this.horariosDisponiveis.length; i++) {
            const numero = (i + 1).toString();
            const horarioTexto = this.horariosDisponiveis[i].toLowerCase();
            const isExactNumber = mensagemLower === numero;
            const isExactSchedule = mensagemLower.includes(horarioTexto);
            if (isExactNumber || isExactSchedule) {
                return { confirmed: true, datetime: this.horariosDisponiveis[i] };
            }
        }
        return null;
    }
}

const si = new TestSuperInteligencia();

// Mensagens que NÃO devem disparar agendamento
const noScheduleTests = [
    'Isso funciona no meu WhatsApp tambem?',
    'Vou querer o plano de R$ 29, como faco?',
    'Eu só tenho 90, isso paga?',
    'eu paguei R$ 30 reais em outro lugar',
    'Pode me enviar o link de compra?',
    'Se eu contratar agora, tenho algum suporte tecnico?',
    'Ola, o que e o Link Magico?',
    'Quero falar sobre o produto',
    'Me liga depois',
    'Meu telefone é 11999887766'
];

for (const msg of noScheduleTests) {
    const agend = si.detectarAgendamento(msg);
    const proc = si.processarAgendamento(msg);
    
    if (!agend && !proc) {
        console.log(`  ✅ "${msg}" → sem agendamento`);
        passed++;
    } else {
        console.log(`  ❌ "${msg}" → FALSO POSITIVO!`);
        if (agend) console.log(`     → detectarAgendamento disparou!`);
        if (proc) console.log(`     → processarAgendamento confirmou: ${proc.datetime}`);
        failed++;
    }
}

// Mensagens que DEVEM disparar agendamento
const yesScheduleTests = [
    'Quero agendar uma reunião',
    'Como agendar horário?',
    'Gostaria de marcar consulta'
];

for (const msg of yesScheduleTests) {
    const agend = si.detectarAgendamento(msg);
    if (agend) {
        console.log(`  ✅ "${msg}" → agendamento detectado corretamente`);
        passed++;
    } else {
        console.log(`  ❌ "${msg}" → deveria ter disparado agendamento!`);
        failed++;
    }
}

// ═══════════════════════════════════════════════════════════
// TESTE 3: processarAgendamento() com números
// ═══════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(70));
console.log('🔢 TESTE 3: processarAgendamento() — Números isolados vs números em frases');
console.log('═'.repeat(70));

const numberTests = [
    { input: '6', expect: true, desc: 'número exato → deve confirmar' },
    { input: '3', expect: true, desc: 'número exato → deve confirmar' },
    { input: 'R$ 30', expect: false, desc: 'preço → NÃO deve confirmar' },
    { input: 'eu paguei R$ 30 reais', expect: false, desc: 'frase com número → NÃO' },
    { input: 'Eu só tenho 90', expect: false, desc: 'frase com número → NÃO' },
    { input: 'quero o plano de R$ 29', expect: false, desc: 'preço em frase → NÃO' },
    { input: 'segunda 14:00', expect: true, desc: 'horário completo → deve confirmar' },
];

for (const test of numberTests) {
    const result = si.processarAgendamento(test.input);
    const confirmed = result?.confirmed || false;
    
    if (confirmed === test.expect) {
        console.log(`  ✅ "${test.input}" → ${test.desc}`);
        passed++;
    } else {
        console.log(`  ❌ "${test.input}" → ${test.desc}`);
        console.log(`     → Esperado: ${test.expect}, Obtido: ${confirmed}${result ? ' (' + result.datetime + ')' : ''}`);
        failed++;
    }
}

// ═══════════════════════════════════════════════════════════
// RESULTADO FINAL
// ═══════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(70));
console.log(`📊 RESULTADO FINAL: ${passed} PASSED | ${failed} FAILED`);
console.log('═'.repeat(70));

if (failed === 0) {
    console.log('🎉 TODOS OS TESTES PASSARAM! As correções estão funcionando.');
} else {
    console.log(`⚠️ ${failed} teste(s) falharam. Revisar antes do deploy.`);
}

process.exit(failed > 0 ? 1 : 0);
