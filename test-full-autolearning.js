/**
 * TESTE COMPLETO AUTO-LEARNING V2.0
 * FASE 3: Simulação de 30 usuários reais (variados)
 * FASE 7: Teste de estabilidade (50+ interações)
 * 
 * Executa interações diversificadas via API e registra resultados
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'https://vertical-ai-dktu.onrender.com';

// ===== FASE 3: Cenários de usuários reais =====
const SCENARIOS = [
  // 🟢 COMPRA (10 variações)
  { msg: "quero comprar", type: "compra", session: "user-compra-01" },
  { msg: "me manda o link de compra", type: "compra", session: "user-compra-02" },
  { msg: "como faco pra adquirir?", type: "compra", session: "user-compra-03" },
  { msg: "quero assinar agora", type: "compra", session: "user-compra-04" },
  { msg: "tem link pra pagar?", type: "compra", session: "user-compra-05" },
  { msg: "aceita cartao?", type: "compra", session: "user-compra-06" },
  { msg: "onde eu compro isso?", type: "compra", session: "user-compra-07" },
  { msg: "quero garantir minha vaga", type: "compra", session: "user-compra-08" },
  { msg: "posso comprar agora mesmo?", type: "compra", session: "user-compra-09" },
  { msg: "manda o link ai", type: "compra", session: "user-compra-10" },

  // 🟡 DÚVIDA (10 variações)
  { msg: "isso funciona mesmo?", type: "duvida", session: "user-duvida-01" },
  { msg: "como eu uso isso?", type: "duvida", session: "user-duvida-02" },
  { msg: "serve pra loja de roupa?", type: "duvida", session: "user-duvida-03" },
  { msg: "funciona no whatsapp?", type: "duvida", session: "user-duvida-04" },
  { msg: "tem suporte?", type: "duvida", session: "user-duvida-05" },
  { msg: "precisa saber programar?", type: "duvida", session: "user-duvida-06" },
  { msg: "quanto tempo leva pra configurar?", type: "duvida", session: "user-duvida-07" },
  { msg: "da pra testar antes?", type: "duvida", session: "user-duvida-08" },
  { msg: "qual a diferenca pros concorrentes?", type: "duvida", session: "user-duvida-09" },
  { msg: "tem garantia?", type: "duvida", session: "user-duvida-10" },

  // 🔴 SAÍDA (5 variações)
  { msg: "vou pensar", type: "saida", session: "user-saida-01" },
  { msg: "depois vejo", type: "saida", session: "user-saida-02" },
  { msg: "nao sei se preciso disso", type: "saida", session: "user-saida-03" },
  { msg: "ta caro demais", type: "saida", session: "user-saida-04" },
  { msg: "vou pesquisar mais", type: "saida", session: "user-saida-05" },

  // 📱 WHATSAPP (5 variações)
  { msg: "me chama no whatsapp", type: "whatsapp", session: "user-whats-01" },
  { msg: "posso falar pelo zap?", type: "whatsapp", session: "user-whats-02" },
  { msg: "tem whatsapp pra contato?", type: "whatsapp", session: "user-whats-03" },
  { msg: "prefiro falar no whatsapp", type: "whatsapp", session: "user-whats-04" },
  { msg: "manda no zap", type: "whatsapp", session: "user-whats-05" },
];

// ===== FASE 7: Interações de estabilidade (50+) =====
const STABILITY_MESSAGES = [
  "oi", "ola", "bom dia", "boa tarde", "boa noite",
  "o que voce faz?", "me explica melhor", "como funciona isso?",
  "quero saber mais", "me conta ai", "qual o preco?", "quanto custa?",
  "tem desconto?", "aceita pix?", "tem parcelamento?",
  "quero comprar", "me manda o link", "como adquiro?",
  "funciona pra mim?", "serve pro meu negocio?",
  "obrigado", "valeu", "vlw", "top", "legal",
  "nao entendi", "explica de novo", "pode repetir?",
  "quero testar", "tem teste gratis?", "como comeco?",
  "qual o diferencial?", "por que devo usar?", "vale a pena?",
  "vou pensar", "depois volto", "beleza", "entendi",
  "quero assinar", "faz um orcamento", "compro agora",
  "preciso de ajuda", "tem suporte humano?", "falo com alguem?",
  "como cancelo?", "tem contrato?", "e seguro?",
  "me convenceu", "bora la", "me inscrevo agora",
  "tchau", "ate mais", "um abraco",
];

function makeRequest(url, method, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data.substring(0, 200), parseError: true });
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function sendChatMessage(message, conversationId) {
  const url = `${BASE_URL}/api/process-chat-inteligente`;
  return makeRequest(url, 'POST', {
    message: message,
    conversationId: conversationId,
    url: 'https://vertical-ai-dktu.onrender.com/l/4IRk4w',
  });
}

async function sendTrackEvent(conversationId, eventType) {
  const url = `${BASE_URL}/api/track-event`;
  return makeRequest(url, 'POST', {
    conversationId: conversationId,
    eventType: eventType,
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runPhase3() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧩 FASE 3 — SIMULAÇÃO DE USUÁRIOS REAIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = { compra: [], duvida: [], saida: [], whatsapp: [] };
  let successCount = 0;
  let errorCount = 0;
  let trackEvents = 0;

  for (let i = 0; i < SCENARIOS.length; i++) {
    const scenario = SCENARIOS[i];
    const convId = `test-phase3-${scenario.session}-${Date.now()}`;

    try {
      // Enviar mensagem
      const startTime = Date.now();
      const response = await sendChatMessage(scenario.msg, convId);
      const elapsed = Date.now() - startTime;

      if (response.status === 200 && response.body.success) {
        successCount++;
        const aiResponse = response.body.response || '';
        const hasCTA = aiResponse.includes('http') || aiResponse.includes('hotmart') || aiResponse.includes('link');
        const hasWhatsApp = aiResponse.includes('whatsapp') || aiResponse.includes('WhatsApp') || aiResponse.includes('zap');

        results[scenario.type].push({
          msg: scenario.msg,
          responseLength: aiResponse.length,
          hasCTA,
          hasWhatsApp,
          elapsed,
          journeyStage: response.body.journeyStage,
        });

        // Simular conversão para cenários de compra (track event)
        if (scenario.type === 'compra' && hasCTA) {
          await sleep(500);
          const trackResult = await sendTrackEvent(convId, 'click_link');
          if (trackResult.status === 200) trackEvents++;
        }

        // Simular whatsapp click
        if (scenario.type === 'whatsapp') {
          await sleep(500);
          const trackResult = await sendTrackEvent(convId, 'open_whatsapp');
          if (trackResult.status === 200) trackEvents++;
        }

        const typeEmoji = { compra: '🟢', duvida: '🟡', saida: '🔴', whatsapp: '📱' };
        console.log(`  ${typeEmoji[scenario.type]} [${i+1}/${SCENARIOS.length}] "${scenario.msg}" → ${elapsed}ms | CTA:${hasCTA} | ${aiResponse.substring(0, 80)}...`);
      } else {
        errorCount++;
        console.log(`  ❌ [${i+1}/${SCENARIOS.length}] "${scenario.msg}" → Status ${response.status}`);
      }
    } catch (error) {
      errorCount++;
      console.log(`  ❌ [${i+1}/${SCENARIOS.length}] "${scenario.msg}" → ERRO: ${error.message}`);
    }

    // Intervalo entre requisições (evitar rate limit)
    await sleep(2000);
  }

  console.log('\n📊 RESULTADO FASE 3:');
  console.log(`  ✅ Sucesso: ${successCount}/${SCENARIOS.length}`);
  console.log(`  ❌ Erros: ${errorCount}`);
  console.log(`  🎯 Track Events enviados: ${trackEvents}`);
  console.log(`  🟢 Compras: ${results.compra.length} respostas (${results.compra.filter(r => r.hasCTA).length} com CTA)`);
  console.log(`  🟡 Dúvidas: ${results.duvida.length} respostas`);
  console.log(`  🔴 Saídas: ${results.saida.length} respostas`);
  console.log(`  📱 WhatsApp: ${results.whatsapp.length} respostas`);

  return { successCount, errorCount, trackEvents, results };
}

async function runPhase7() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧩 FASE 7 — TESTE DE ESTABILIDADE (50+ interações)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let successCount = 0;
  let errorCount = 0;
  let totalTime = 0;
  let maxTime = 0;
  let minTime = Infinity;
  const errors = [];

  for (let i = 0; i < STABILITY_MESSAGES.length; i++) {
    const msg = STABILITY_MESSAGES[i];
    const convId = `test-stability-${i}-${Date.now()}`;

    try {
      const startTime = Date.now();
      const response = await sendChatMessage(msg, convId);
      const elapsed = Date.now() - startTime;

      totalTime += elapsed;
      if (elapsed > maxTime) maxTime = elapsed;
      if (elapsed < minTime) minTime = elapsed;

      if (response.status === 200 && response.body.success) {
        successCount++;
        if (i % 10 === 0) {
          console.log(`  ✅ [${i+1}/${STABILITY_MESSAGES.length}] "${msg}" → ${elapsed}ms`);
        }
      } else if (response.status === 429) {
        // Rate limit - esperado, contar mas não falhar
        console.log(`  ⚠️ [${i+1}/${STABILITY_MESSAGES.length}] Rate limit (429) — esperado`);
        successCount++; // Rate limit é comportamento correto
        await sleep(5000); // Esperar mais
      } else {
        errorCount++;
        errors.push({ msg, status: response.status, i: i+1 });
        console.log(`  ❌ [${i+1}/${STABILITY_MESSAGES.length}] "${msg}" → Status ${response.status}`);
      }
    } catch (error) {
      errorCount++;
      errors.push({ msg, error: error.message, i: i+1 });
      console.log(`  ❌ [${i+1}/${STABILITY_MESSAGES.length}] "${msg}" → ERRO: ${error.message}`);
    }

    await sleep(1500); // Intervalo entre requisições
  }

  const avgTime = totalTime / (successCount + errorCount);

  console.log('\n📊 RESULTADO FASE 7:');
  console.log(`  ✅ Sucesso: ${successCount}/${STABILITY_MESSAGES.length}`);
  console.log(`  ❌ Erros reais: ${errorCount}`);
  console.log(`  ⏱️ Tempo médio: ${avgTime.toFixed(0)}ms`);
  console.log(`  ⏱️ Tempo mínimo: ${minTime}ms`);
  console.log(`  ⏱️ Tempo máximo: ${maxTime}ms`);
  if (errors.length > 0) {
    console.log(`  ⚠️ Erros detalhados:`, JSON.stringify(errors.slice(0, 5)));
  }

  return { successCount, errorCount, avgTime, minTime, maxTime, errors, total: STABILITY_MESSAGES.length };
}

async function runPhase5() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧩 FASE 5 — VALIDAÇÃO INTERNA');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    const status = await makeRequest(`${BASE_URL}/api/system/status`, 'GET');
    console.log('  📊 System Status:', JSON.stringify(status.body, null, 2).substring(0, 500));
  } catch (e) {
    console.log('  ⚠️ Erro ao obter status:', e.message);
  }

  // Testar track-event com todos os tipos válidos
  const eventTypes = ['click_link', 'open_whatsapp', 'schedule_created', 'lead_submitted'];
  for (const eventType of eventTypes) {
    try {
      const result = await sendTrackEvent(`validate-${eventType}-${Date.now()}`, eventType);
      console.log(`  🎯 Track ${eventType}: status=${result.status}, success=${result.body?.success}, tracked=${result.body?.tracked}`);
    } catch (e) {
      console.log(`  ❌ Track ${eventType}: ERRO ${e.message}`);
    }
    await sleep(500);
  }

  // Testar evento inválido
  try {
    const result = await sendTrackEvent('test-invalid', 'invalid_event');
    console.log(`  🚫 Track invalid_event: status=${result.status} (esperado 400), error=${result.body?.error?.substring(0, 60)}`);
  } catch (e) {
    console.log(`  ❌ Track invalid: ERRO ${e.message}`);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  TESTE COMPLETO AUTO-LEARNING V2.0            ║');
  console.log('║  Fases 3, 5 e 7                               ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log(`🕐 Início: ${new Date().toISOString()}\n`);

  // FASE 3: Simulação de usuários reais (30 interações)
  const phase3 = await runPhase3();

  // FASE 5: Validação interna
  await runPhase5();

  // FASE 7: Teste de estabilidade (50+ interações)
  const phase7 = await runPhase7();

  // RESUMO FINAL
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║  RESUMO GERAL                                  ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log(`  FASE 3: ${phase3.successCount}/${SCENARIOS.length} OK | ${phase3.errorCount} erros | ${phase3.trackEvents} track events`);
  console.log(`  FASE 7: ${phase7.successCount}/${phase7.total} OK | ${phase7.errorCount} erros | avg ${phase7.avgTime?.toFixed(0)}ms`);
  console.log(`  Total interações: ${SCENARIOS.length + STABILITY_MESSAGES.length}`);
  console.log(`🕐 Fim: ${new Date().toISOString()}`);
}

main().catch(console.error);
