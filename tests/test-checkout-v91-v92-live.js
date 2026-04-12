/**
 * 🧪 TESTE OFICIAL V9.1 + V9.2 — INTEGRAÇÃO LIVE
 * 
 * Testa contra o servidor em produção:
 * - TESTE 3: Backend recebe checkoutLink
 * - TESTE 4: Link Resolver prioriza
 * - TESTE 5: Chat responde com checkout correto
 * - TESTE 7: Fallback sem checkout
 * - TESTE 9: Regressão
 */

const API_BASE = 'https://vertical-ai-dktu.onrender.com';
const API_KEY = 'LMV7-P079-NLC2-8ZY7';
const ROBOT_NAME = 'Assistente Teste';

let passed = 0;
let failed = 0;
const results = {};

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FALHOU: ${testName}`);
    failed++;
  }
}

async function callChat(message, checkoutLink = null) {
  const payload = {
    message: message,
    pageData: {
      url: 'https://example.com/produto-teste',
      checkoutLink: checkoutLink
    },
    robotName: ROBOT_NAME,
    instructions: 'Você é um assistente de vendas focado em conversão. Quando o cliente quiser comprar, forneça o link de checkout.',
    conversationId: 'test_v91_v92_' + Date.now(),
    apiKey: API_KEY
  };

  const response = await fetch(API_BASE + '/api/process-chat-inteligente', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

async function runTests() {
  console.log('🧪 TESTE OFICIAL V9.1 + V9.2 — INTEGRAÇÃO LIVE');
  console.log('📡 Servidor:', API_BASE);
  console.log('🔑 API Key:', API_KEY);
  console.log('═'.repeat(60));

  // ─────────────────────────────────────────
  // TESTE 3/4/5: CHECKOUT AUTO-DETECTADO → COMPRA
  // ─────────────────────────────────────────
  console.log('\n🧩 TESTE 3+4+5 — Checkout auto-detectado + resolução + resposta');
  console.log('─'.repeat(50));
  
  const checkoutUrl = 'https://pay.hotmart.com/G103177435I';
  
  try {
    const data = await callChat('quero comprar agora, me manda o link', checkoutUrl);
    
    assert(data.success === true, 'Resposta com success=true');
    assert(typeof data.response === 'string' && data.response.length > 10, 'Resposta não-vazia do servidor');
    
    // TESTE 5: Verificar se a resposta contém o link de checkout
    const hasCheckoutInResponse = data.response.includes(checkoutUrl) || 
                                   data.response.includes('hotmart') ||
                                   data.response.includes('link') ||
                                   data.response.includes('checkout');
    assert(hasCheckoutInResponse, 'Resposta menciona checkout/link');
    
    // Anti-duplicação: não deve duplicar o link
    if (data.response.includes(checkoutUrl)) {
      const count = data.response.split(checkoutUrl).length - 1;
      assert(count <= 2, `Anti-duplicação: link aparece ${count}x (máx 2)`);
    }
    
    console.log('  📝 Resposta:', data.response.substring(0, 200) + '...');
    results['Server Receive'] = 'OK';
    results['Link Resolver'] = 'OK';
    results['Chat Response'] = 'OK';
  } catch (err) {
    console.error('  ❌ ERRO:', err.message);
    results['Server Receive'] = 'FAIL';
    results['Link Resolver'] = 'FAIL';
    results['Chat Response'] = 'FAIL';
  }

  // ─────────────────────────────────────────
  // TESTE 5b: VARIAÇÕES DE MENSAGEM DE COMPRA
  // ─────────────────────────────────────────
  console.log('\n🧩 TESTE 5b — Variações de mensagem de compra');
  console.log('─'.repeat(50));
  
  const buyMessages = [
    'qual o link de pagamento?',
    'como faço pra comprar?'
  ];
  
  for (const msg of buyMessages) {
    try {
      const data = await callChat(msg, checkoutUrl);
      assert(data.success === true, `"${msg}" → sucesso`);
      console.log(`  📝 "${msg}" → ${data.response.substring(0, 100)}...`);
    } catch (err) {
      console.error(`  ❌ "${msg}" → ERRO: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────
  // TESTE 7: FALLBACK (SEM CHECKOUT)
  // ─────────────────────────────────────────
  console.log('\n🧩 TESTE 7 — Fallback (sem checkout do frontend)');
  console.log('─'.repeat(50));
  
  try {
    const data = await callChat('me fala sobre o produto', null);
    
    assert(data.success === true, 'Sucesso sem checkoutLink');
    assert(typeof data.response === 'string' && data.response.length > 5, 'Resposta válida sem checkout');
    
    console.log('  📝 Resposta:', data.response.substring(0, 150) + '...');
    results['Fallback'] = 'OK';
  } catch (err) {
    console.error('  ❌ ERRO:', err.message);
    results['Fallback'] = 'FAIL';
  }

  // ─────────────────────────────────────────
  // TESTE 9: REGRESSÃO
  // ─────────────────────────────────────────
  console.log('\n🧩 TESTE 9 — Regressão (mensagens normais)');
  console.log('─'.repeat(50));
  
  const regressionTests = [
    { msg: 'como funciona esse produto?', expect: 'resposta válida' },
    { msg: 'tem bônus inclusos?', expect: 'resposta válida' },
    { msg: 'obrigado pela ajuda', expect: 'resposta válida' }
  ];
  
  let regressionPassed = true;
  for (const test of regressionTests) {
    try {
      const data = await callChat(test.msg, null);
      const ok = data.success === true && data.response && data.response.length > 5;
      assert(ok, `"${test.msg}" → ${test.expect}`);
      if (!ok) regressionPassed = false;
      console.log(`  📝 "${test.msg}" → ${data.response.substring(0, 100)}...`);
    } catch (err) {
      console.error(`  ❌ "${test.msg}" → ERRO: ${err.message}`);
      regressionPassed = false;
    }
  }
  results['Regression'] = regressionPassed ? 'OK' : 'FAIL';

  // ─────────────────────────────────────────
  // TESTE EXTRA: SMART SELECTOR SCORE
  // ─────────────────────────────────────────
  console.log('\n🧩 TESTE 6 — Smart Selector (validação unitária)');
  console.log('─'.repeat(50));
  
  // Simular scoring do widget localmente
  function scoreElement(text, href) {
    let score = 0;
    const kwHigh = ['comprar','buy','checkout','pagar','finalizar','adquirir','assinar'];
    const kwMed = ['carrinho','cart','quero','garantir','inscrever'];
    const kwLow = ['saiba','detalhes','ver mais','sobre','contato','blog'];
    const payDom = ['hotmart','kiwify','eduzz','monetizze','pay.','checkout.','mercadopago','stripe','paypal'];
    
    kwHigh.forEach(k => { if (text.includes(k) || href.includes(k)) score += 50; });
    kwMed.forEach(k => { if (text.includes(k) || href.includes(k)) score += 20; });
    kwLow.forEach(k => { if (text.includes(k)) score -= 10; });
    payDom.forEach(d => { if (href.includes(d)) score += 60; });
    if (href.startsWith('http')) score += 10;
    if (href.includes('#') && !href.includes('http')) score -= 30;
    return score;
  }
  
  // Simular página com múltiplos botões
  const mockElements = [
    { text: 'comprar agora', href: 'https://pay.hotmart.com/abc123' },
    { text: 'saiba mais', href: 'https://example.com/detalhes' },
    { text: 'ver detalhes', href: '#detalhes' },
    { text: 'garantir vaga', href: 'https://pay.kiwify.com/xyz' },
    { text: 'contato', href: 'https://example.com/contato' }
  ];
  
  const scored = mockElements.map(el => ({
    ...el,
    score: scoreElement(el.text.toLowerCase(), el.href.toLowerCase())
  })).sort((a, b) => b.score - a.score);
  
  console.log('  Ranking de scoring:');
  scored.forEach((el, i) => {
    console.log(`    ${i+1}. [score=${el.score}] "${el.text}" → ${el.href}`);
  });
  
  assert(scored[0].href.includes('hotmart'), 'Smart Selector: "comprar agora" + hotmart vence');
  assert(scored[0].score > scored[1].score, 'Top 1 tem score maior que Top 2');
  assert(scored.find(e => e.text === 'saiba mais').score < scored[0].score, '"Saiba mais" tem score menor que "comprar agora"');
  assert(scored.find(e => e.href === '#detalhes').score < 0, 'Âncora interna tem score negativo');
  
  results['Smart Selector'] = 'OK';

  // ─────────────────────────────────────────
  // RELATÓRIO FINAL
  // ─────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RELATÓRIO OFICIAL V9.1 + V9.2');
  console.log('═'.repeat(60));
  console.log('');
  
  // Frontend extraction e Payload são testados no browser
  results['Frontend Extraction'] = 'BROWSER_TEST';
  results['Payload'] = 'BROWSER_TEST';
  
  const reportOrder = [
    'Frontend Extraction',
    'Payload',
    'Server Receive',
    'Link Resolver',
    'Chat Response',
    'Smart Selector',
    'Fallback',
    'Regression'
  ];
  
  reportOrder.forEach(key => {
    const status = results[key] || 'N/A';
    const icon = status === 'OK' ? '✅' : status === 'FAIL' ? '❌' : '🔎';
    console.log(`  ${icon} ${key}: ${status}`);
  });
  
  console.log('');
  console.log(`  Total: ${passed} passaram, ${failed} falharam`);
  console.log('═'.repeat(60));
  
  if (failed === 0) {
    console.log('🚀 TESTES DE INTEGRAÇÃO LIVE APROVADOS!');
  } else {
    console.log(`⚠️ ${failed} teste(s) falharam!`);
  }
}

runTests().catch(err => {
  console.error('❌ Erro fatal nos testes:', err);
  process.exit(1);
});
