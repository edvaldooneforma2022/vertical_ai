/**
 * 🧪 TESTES V14 CONTEXT LAYER
 * 
 * Testa: memória de curto prazo, anti-repetição, contexto conversacional
 * 
 * Executar: node tests/test-v14-context.js
 */

'use strict';

const v14 = require('../lib/v14-context-layer');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
    if (condition) {
        passed++;
        console.log(`  ✅ ${testName}`);
    } else {
        failed++;
        console.error(`  ❌ ${testName}`);
    }
}

console.log('\n═══════════════════════════════════════════');
console.log('🧪 V14 CONTEXT LAYER — TESTES UNITÁRIOS');
console.log('═══════════════════════════════════════════\n');

// ═══ TESTE 1: Memória básica ═══
console.log('📝 TESTE 1: Memória básica');
{
    const convId = 'test_memory_' + Date.now();

    // Sem histórico inicialmente
    const emptyHist = v14.getHistory(convId);
    assert(emptyHist.length === 0, 'Histórico vazio inicialmente');

    // Adicionar mensagens
    v14.addMessage(convId, 'user', 'Olá, vi seu anúncio');
    v14.addMessage(convId, 'assistant', 'Oi! Que bom que viu 😄');
    v14.addMessage(convId, 'user', 'Como funciona?');
    v14.addMessage(convId, 'assistant', 'Funciona assim: você cria um link e ele vira um vendedor automático');

    const hist = v14.getHistory(convId);
    assert(hist.length === 4, 'Histórico com 4 mensagens');
    assert(hist[0].role === 'user', 'Primeira mensagem é do user');
    assert(hist[0].content.includes('anúncio'), 'Conteúdo correto da primeira msg');
    assert(hist[3].role === 'assistant', 'Última mensagem é do assistant');
}

// ═══ TESTE 2: Limite de mensagens ═══
console.log('\n📝 TESTE 2: Limite de mensagens (max 10)');
{
    const convId = 'test_limit_' + Date.now();

    // Adicionar 14 mensagens (excede o limite de 10)
    for (let i = 0; i < 7; i++) {
        v14.addMessage(convId, 'user', `Pergunta ${i + 1}`);
        v14.addMessage(convId, 'assistant', `Resposta ${i + 1}`);
    }

    const hist = v14.getHistory(convId);
    assert(hist.length <= 10, `Histórico limitado a 10 (atual: ${hist.length})`);
    assert(hist[0].content.includes('Pergunta 3') || hist[0].content.includes('Pergunta 4'), 'Mensagens antigas removidas');
}

// ═══ TESTE 3: Anti-repetição — frases banidas ═══
console.log('\n📝 TESTE 3: Anti-repetição — frases banidas');
{
    const convId = 'test_banned_' + Date.now();

    const check1 = v14.checkRepetition(convId, 'Já usou algo parecido? Me conta!');
    assert(check1.isRepetition === true, 'Detecta "já usou algo parecido"');

    const check2 = v14.checkRepetition(convId, 'Como posso te ajudar hoje?');
    assert(check2.isRepetition === true, 'Detecta "como posso te ajudar"');

    const check3 = v14.checkRepetition(convId, 'Boa pergunta! O produto funciona assim...');
    assert(check3.isRepetition === false, 'Não bloqueia resposta legítima');
}

// ═══ TESTE 4: Anti-repetição — duplicatas ═══
console.log('\n📝 TESTE 4: Anti-repetição — respostas duplicadas');
{
    const convId = 'test_dup_' + Date.now();

    // Salvar resposta anterior
    v14.addMessage(convId, 'user', 'funciona mesmo?');
    v14.addMessage(convId, 'assistant', 'Sim, funciona de verdade! Muita gente já está usando e tendo resultados.');

    // Verificar duplicata
    const checkDup = v14.checkRepetition(convId, 'Sim, funciona de verdade! Muita gente já está usando e tendo resultados.');
    assert(checkDup.isRepetition === true, 'Detecta resposta duplicada (100% igual)');

    // Verificar resposta diferente
    const checkNew = v14.checkRepetition(convId, 'Com certeza! Deixa eu te explicar os detalhes...');
    assert(checkNew.isRepetition === false, 'Aceita resposta diferente');
}

// ═══ TESTE 5: Contexto conversacional ═══
console.log('\n📝 TESTE 5: Contexto conversacional (prompt)');
{
    const convId = 'test_ctx_' + Date.now();

    // Sem histórico → contexto vazio
    const emptyCtx = v14.buildContextPrompt(convId);
    assert(emptyCtx === '', 'Contexto vazio sem histórico');

    // Com histórico → gera contexto
    v14.addMessage(convId, 'user', 'vi seu anúncio');
    v14.addMessage(convId, 'assistant', 'Oi! Que bom que viu 😄 quer saber mais?');
    v14.addMessage(convId, 'user', 'como funciona?');
    v14.addMessage(convId, 'assistant', 'Funciona assim: cria um link e ele vira vendedor.');

    const ctx = v14.buildContextPrompt(convId);
    assert(ctx.includes('V14_CONTEXT'), 'Contém header V14_CONTEXT');
    assert(ctx.includes('4 mensagens'), 'Conta mensagens corretas');
    assert(ctx.includes('anúncio'), 'Inclui histórico do usuário');
    assert(ctx.includes('NÃO repita'), 'Inclui regras de continuidade');
}

// ═══ TESTE 6: getMessagesForLLM ═══
console.log('\n📝 TESTE 6: getMessagesForLLM (formato LLM)');
{
    const convId = 'test_llm_' + Date.now();

    v14.addMessage(convId, 'user', 'Mensagem 1');
    v14.addMessage(convId, 'assistant', 'Resposta 1');
    v14.addMessage(convId, 'user', 'Mensagem 2');
    v14.addMessage(convId, 'assistant', 'Resposta 2');
    v14.addMessage(convId, 'user', 'Mensagem 3');
    v14.addMessage(convId, 'assistant', 'Resposta 3');

    const msgs = v14.getMessagesForLLM(convId, 4);
    assert(msgs.length === 4, `Retorna últimas 4 (atual: ${msgs.length})`);
    assert(msgs[0].role === 'user' || msgs[0].role === 'assistant', 'Formato correto de role');
    assert(typeof msgs[0].content === 'string', 'Conteúdo é string');
}

// ═══ TESTE 7: Product info ═══
console.log('\n📝 TESTE 7: Product info (coerência de produto)');
{
    const convId = 'test_product_' + Date.now();

    v14.saveProductInfo(convId, {
        title: 'Link Mágico',
        resumo: 'Plataforma de vendas com IA',
        url: 'https://linkmagico.com'
    });

    const ctx = v14.buildContextPrompt(convId);
    // Product info é exibido no contexto quando há mensagens
    v14.addMessage(convId, 'user', 'o que é isso?');
    v14.addMessage(convId, 'assistant', 'É o Link Mágico!');

    const ctxWithProduct = v14.buildContextPrompt(convId);
    assert(ctxWithProduct.includes('Link Mágico'), 'Produto aparece no contexto');
}

// ═══ TESTE 8: Stats ═══
console.log('\n📝 TESTE 8: Stats');
{
    const stats = v14.getStats();
    assert(stats.activeSessions > 0, `Sessions ativas: ${stats.activeSessions}`);
    assert(stats.totalMessages > 0, `Total mensagens: ${stats.totalMessages}`);
}

// ═══ RESULTADO ═══
console.log('\n═══════════════════════════════════════════');
console.log(`🧪 RESULTADO: ${passed} passed | ${failed} failed | ${passed + failed} total`);
console.log('═══════════════════════════════════════════\n');

if (failed > 0) {
    process.exit(1);
}
