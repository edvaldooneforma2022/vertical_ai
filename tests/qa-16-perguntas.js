/**
 * 💣 QA — 16 PERGUNTAS (Nível Real)
 * Testa inteligência, memória, venda, links, suporte e comportamento humano
 * 4 tenants × 16 perguntas = 64 testes totais
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://vertical-ai-dktu.onrender.com';
const SHORT_CODES = ['SvdH3Z', 'N8OxIG', 'oJ5hIQ', 'CtyAln'];

// ═══ 7 BLOCOS DE PERGUNTAS ═══
const QA_BLOCKS = [
  { name: '🧠 BLOCO 1 — PRIMEIRO CONTATO', questions: [
    { id: 'Q01', text: 'Vi seu anúncio… me explica rápido o que você vende?', expect: 'PRODUTO_CLARO', criteria: 'Resposta clara + nome do produto + proposta' },
    { id: 'Q02', text: 'Mas tipo assim… isso serve pra quê na prática mesmo?', expect: 'EXPLICACAO_SIMPLES', criteria: 'Explicação simples, sem enrolação' },
  ]},
  { name: '🧩 BLOCO 2 — ENTENDIMENTO REAL', questions: [
    { id: 'Q03', text: 'Como isso funciona passo a passo?', expect: 'EXPLICACAO_CONCRETA', criteria: 'Explicação concreta (não genérica)' },
    { id: 'Q04', text: 'O que exatamente eu recebo quando compro?', expect: 'CONTEUDO_REAL', criteria: 'Conteúdo real (não pergunta de volta)' },
    { id: 'Q05', text: 'Precisa ter experiência ou qualquer pessoa consegue usar?', expect: 'RESPOSTA_DIRETA', criteria: 'Resposta direta + segurança' },
  ]},
  { name: '🧠 BLOCO 3 — MEMÓRIA E COERÊNCIA', questions: [
    { id: 'Q06', text: 'Você já me explicou isso antes… lembra?', expect: 'MEMORIA_CONTEXTO', criteria: 'Reconhecer contexto (não resetar)' },
    { id: 'Q07', text: 'Então resume tudo em 1 frase pra mim', expect: 'SINTESE_COERENTE', criteria: 'Síntese coerente do produto' },
  ]},
  { name: '💰 BLOCO 4 — INTENÇÃO DE COMPRA', questions: [
    { id: 'Q08', text: 'Quanto custa?', expect: 'LINK_COM_CONTEXTO', criteria: 'Link + contexto (não só botão)' },
    { id: 'Q09', text: 'Quero comprar agora', expect: 'LINK_UNICO', criteria: '1 único link válido, sem duplicação' },
    { id: 'Q10', text: 'Me manda o link certo porque o outro não abriu', expect: 'LINK_ALTERNATIVO', criteria: 'NÃO repetir link quebrado, alternativa ou WhatsApp' },
  ]},
  { name: '⚠️ BLOCO 5 — OBJEÇÕES (CRÍTICO)', questions: [
    { id: 'Q11', text: 'Isso parece golpe, é confiável mesmo?', expect: 'TRANQUILIZAR_SEM_CHECKOUT', criteria: 'Tranquilizar, NUNCA checkout direto' },
    { id: 'Q12', text: 'Não entendi nada ainda, explica como se eu fosse leigo', expect: 'EXPLICAR_SEM_VENDA', criteria: 'Explicação clara, sem empurrar venda' },
    { id: 'Q13', text: 'Achei caro… vale mesmo a pena?', expect: 'REFORCO_VALOR', criteria: 'Reforço de valor, não pressionar' },
  ]},
  { name: '📞 BLOCO 6 — SUPORTE', questions: [
    { id: 'Q14', text: 'Quero falar com alguém de verdade', expect: 'WHATSAPP_SEM_CHECKOUT', criteria: 'WhatsApp correto, sem checkout junto' },
  ]},
  { name: '🔚 BLOCO 7 — SAÍDA (ANTI-SPAM)', questions: [
    { id: 'Q15', text: 'Tá bom, depois eu vejo isso', expect: 'RESPOSTA_LEVE', criteria: 'Resposta leve, sem empurrar link' },
    { id: 'Q16', text: 'Valeu, tchau', expect: 'DESPEDIDA_LIMPA', criteria: 'Despedida limpa, ZERO checkout' },
  ]},
];

// ═══ FUNÇÕES AUXILIARES ═══
function callAPI(endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(endpoint, BASE_URL);
    const req = https.request({
      hostname: url.hostname, port: 443, path: url.pathname,
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 120000
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ ...JSON.parse(body), _status: res.statusCode, _elapsed: Date.now() - start }); }
        catch(e) { resolve({ success: false, error: 'JSON parse', _raw: body.substring(0,300), _status: res.statusCode, _elapsed: Date.now() - start }); }
      });
    });
    const start = Date.now();
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout 120s')); });
    req.write(data);
    req.end();
  });
}

function resolveShortUrl(code) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: new URL(BASE_URL).hostname, port: 443, path: `/l/${code}`,
      method: 'GET', timeout: 30000, headers: { 'User-Agent': 'QA-Bot/1.0' }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const p = new URL(res.headers.location, BASE_URL).searchParams;
        resolve({ name: p.get('name')||'Unknown', url: p.get('url')||'', apiKey: p.get('apiKey')||'', instructions: p.get('instructions')||'' });
      } else {
        let b = ''; res.on('data', c => b += c);
        res.on('end', () => resolve({ name: 'Unknown', url: '', apiKey: '', instructions: '', _status: res.statusCode }));
      }
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

// ═══ ANÁLISE DE RESPOSTA ═══
function analyze(text, expectation) {
  const t = (text || '').toLowerCase();
  const r = {
    hasLink: /https?:\/\/[^\s"'<>]+/.test(text),
    hasWhatsApp: /(whatsapp|wa\.me|atendente|humano|suporte.*contato)/i.test(text),
    isGeneric: /(ótima pergunta|posso ajudar|como posso te ajudar|deixe-me explicar|deixa eu te explicar)/i.test(text),
    hasCheckout: /(checkout|comprar|compre|adquira|garanta|finalizar)/i.test(text) && /https?:\/\/[^\s]+/.test(text),
    asksBack: /\?$/.test(text.trim()) || /(o que você|me conte|qual seu|como posso)/i.test(text),
    linkCount: ((text || '').match(/https?:\/\/[^\s"'<>]+/g) || []).length,
    length: (text || '').length,
  };

  switch(expectation) {
    case 'PRODUTO_CLARO':
      r.pass = !r.isGeneric && r.length > 50 && !r.asksBack;
      r.reason = r.pass ? 'Produto explicado' : (r.isGeneric ? 'GENÉRICO' : r.asksBack ? 'PERGUNTOU DE VOLTA' : 'CURTO DEMAIS');
      break;
    case 'EXPLICACAO_SIMPLES':
    case 'EXPLICACAO_CONCRETA':
    case 'CONTEUDO_REAL':
    case 'RESPOSTA_DIRETA':
      r.pass = !r.isGeneric && r.length > 40 && !r.hasCheckout;
      r.reason = r.pass ? 'Explicação OK' : (r.isGeneric ? 'GENÉRICO' : r.hasCheckout ? 'EMPURROU CHECKOUT' : 'CURTO');
      break;
    case 'MEMORIA_CONTEXTO':
      r.pass = !r.isGeneric && !/(não lembro|não tenho|primeira vez)/i.test(text);
      r.reason = r.pass ? 'Memória OK' : 'RESETOU CONVERSA';
      break;
    case 'SINTESE_COERENTE':
      r.pass = !r.isGeneric && r.length > 20 && r.length < 500;
      r.reason = r.pass ? 'Síntese OK' : (r.isGeneric ? 'GENÉRICO' : 'TAMANHO INADEQUADO');
      break;
    case 'LINK_COM_CONTEXTO':
      r.pass = (r.hasLink || r.hasCheckout) && r.length > 80;
      r.reason = r.pass ? 'Link+contexto OK' : (!r.hasLink ? 'SEM LINK' : 'SEM CONTEXTO');
      break;
    case 'LINK_UNICO':
      r.pass = r.hasLink && r.linkCount <= 2;
      r.reason = r.pass ? 'Link único OK' : (!r.hasLink ? 'SEM LINK' : `DUPLICADO (${r.linkCount} links)`);
      break;
    case 'LINK_ALTERNATIVO':
      r.pass = r.hasLink || r.hasWhatsApp;
      r.reason = r.pass ? (r.hasWhatsApp ? 'WhatsApp fallback' : 'Link alternativo') : 'SEM ALTERNATIVA';
      break;
    case 'TRANQUILIZAR_SEM_CHECKOUT':
      r.pass = !r.hasCheckout && r.length > 60;
      r.reason = r.pass ? 'Tranquilizou sem checkout' : (r.hasCheckout ? '❌ CHECKOUT NA OBJEÇÃO' : 'CURTO');
      break;
    case 'EXPLICAR_SEM_VENDA':
      r.pass = !r.hasCheckout && !r.isGeneric && r.length > 50;
      r.reason = r.pass ? 'Explicou sem vender' : (r.hasCheckout ? '❌ EMPURROU VENDA' : 'GENÉRICO/CURTO');
      break;
    case 'REFORCO_VALOR':
      r.pass = !r.isGeneric && r.length > 50;
      r.reason = r.pass ? 'Valor reforçado' : 'GENÉRICO';
      break;
    case 'WHATSAPP_SEM_CHECKOUT':
      r.pass = r.hasWhatsApp && !r.hasCheckout;
      r.reason = r.pass ? 'WhatsApp OK' : (!r.hasWhatsApp ? 'SEM WHATSAPP' : '❌ CHECKOUT+SUPORTE');
      break;
    case 'RESPOSTA_LEVE':
      r.pass = !r.hasCheckout && !r.hasLink;
      r.reason = r.pass ? 'Saída leve OK' : '❌ EMPURROU LINK NA SAÍDA';
      break;
    case 'DESPEDIDA_LIMPA':
      r.pass = !r.hasCheckout && !r.hasLink;
      r.reason = r.pass ? 'Despedida limpa' : '❌ CHECKOUT NO TCHAU';
      break;
    default:
      r.pass = true; r.reason = 'N/A';
  }
  return r;
}

// ═══ EXECUÇÃO ═══
async function testTenant(tenant, code) {
  const convId = `qa16_${code}_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  const results = [];
  
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`🧪 TENANT: ${tenant.name} (${code})`);
  console.log(`   URL: ${tenant.url}`);
  console.log(`   API Key: ${tenant.apiKey ? tenant.apiKey.substring(0,12)+'...' : 'N/A'}`);
  console.log(`${'═'.repeat(70)}`);

  for (const block of QA_BLOCKS) {
    console.log(`\n  📋 ${block.name}`);
    for (const q of block.questions) {
      try {
        const resp = await callAPI('/api/process-chat-inteligente', {
          message: q.text,
          pageData: { url: tenant.url },
          robotName: tenant.name,
          instructions: tenant.instructions || '',
          conversationId: convId,
          apiKey: tenant.apiKey,
          salesMode: 'auto'
        });
        const text = resp.response || resp.error || '';
        const a = analyze(text, q.expect);
        const icon = a.pass ? '✅' : '❌';
        console.log(`    ${icon} ${q.id}: "${q.text}"`);
        console.log(`       → ${a.reason} (${resp._elapsed || 0}ms)`);
        if (!a.pass) console.log(`       📝 "${text.substring(0, 200)}..."`);
        
        results.push({ ...q, response: text, analysis: a, elapsed: resp._elapsed, status: resp._status });
        await new Promise(r => setTimeout(r, 2000)); // delay entre msgs
      } catch (err) {
        console.log(`    ❌ ${q.id}: ERRO - ${err.message}`);
        results.push({ ...q, response: `ERROR: ${err.message}`, analysis: { pass: false, reason: `ERRO: ${err.message}` }, elapsed: 0 });
      }
    }
  }

  const passed = results.filter(r => r.analysis.pass).length;
  const total = results.length;
  const pct = Math.round(passed/total*100);
  const status = pct >= 81 ? '🔥 Pronto pra vender' : pct >= 56 ? '⚠️ Vende, mas perde dinheiro' : '💀 Ainda instável';
  
  console.log(`\n  📊 SCORE: ${passed}/${total} (${pct}%) — ${status}`);
  return { tenant: tenant.name, code, passed, total, pct, status, results };
}

async function main() {
  console.log('💣 QA — 16 PERGUNTAS (Nível Real)');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`🔗 Tenants: ${SHORT_CODES.join(', ')}\n`);

  // Resolver short URLs
  console.log('📡 Resolvendo tenants...');
  const tenants = [];
  for (const code of SHORT_CODES) {
    try {
      const t = await resolveShortUrl(code);
      tenants.push({ ...t, code });
      console.log(`  ✅ ${code} → ${t.name} | ${t.apiKey ? t.apiKey.substring(0,12)+'...' : '⚠️ SEM KEY'}`);
    } catch (e) {
      console.log(`  ❌ ${code} → ${e.message}`);
      tenants.push({ name: `Tenant-${code}`, url: '', apiKey: '', code });
    }
  }

  // Executar testes
  const allResults = [];
  for (const t of tenants) {
    if (!t.apiKey) { console.log(`\n⚠️ Pulando ${t.code} — sem apiKey`); continue; }
    try {
      allResults.push(await testTenant(t, t.code));
    } catch (e) {
      console.log(`\n❌ ERRO FATAL em ${t.code}: ${e.message}`);
      allResults.push({ tenant: t.name, code: t.code, passed: 0, total: 16, pct: 0, status: '💀 ERRO', results: [] });
    }
  }

  // Relatório final
  console.log(`\n\n${'═'.repeat(70)}`);
  console.log('📊 RELATÓRIO FINAL — QA 16 PERGUNTAS');
  console.log('═'.repeat(70));
  
  let gPass = 0, gTotal = 0;
  for (const r of allResults) {
    gPass += r.passed; gTotal += r.total;
    const icon = r.pct >= 81 ? '✅' : r.pct >= 56 ? '⚠️' : '❌';
    console.log(`  ${icon} ${r.tenant} (${r.code}): ${r.pct}% (${r.passed}/${r.total}) — ${r.status}`);
  }
  
  const gPct = gTotal > 0 ? Math.round(gPass/gTotal*100) : 0;
  console.log(`\n  🏆 TOTAL GERAL: ${gPct}% (${gPass}/${gTotal})`);
  console.log('═'.repeat(70));

  // Salvar JSON
  const outPath = path.join(__dirname, 'qa-16-results.json');
  fs.writeFileSync(outPath, JSON.stringify({ timestamp: new Date().toISOString(), overall: { passed: gPass, total: gTotal, pct: gPct }, tenants: allResults }, null, 2));
  console.log(`\n💾 Resultados salvos em ${outPath}`);
}

main().catch(e => { console.error('❌ FATAL:', e); process.exit(1); });
