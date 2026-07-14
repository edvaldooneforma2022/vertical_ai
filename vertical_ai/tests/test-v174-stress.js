// ================================================================
// V17.4 STRESS TEST — CONVERSAO SOB PRESSAO
// Simula usuarios reais: erros, interrupcoes, desvios
// Cada cenario = conversa NOVA (conversationId unico)
// ================================================================

const BASE = "https://vertical-ai-dktu.onrender.com";
const SALES_URL = "https://ev.braip.com/ref?pv=pro3exj8&af=afiv6o2dz";
const ROBOT = "Granel";

// ================================================================
// STEP 1: Extrair dados da pagina (como o frontend faz)
// ================================================================
async function extractPageData() {
  console.log("[EXTRACT] Extraindo dados de " + SALES_URL.substring(0, 50) + "...");
  try {
    const res = await fetch(BASE + "/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: SALES_URL })
    });
    const data = await res.json();
    const pd = data.data || data;
    console.log("[EXTRACT] checkoutLink: " + (pd.checkoutLink || "N/A"));
    console.log("[EXTRACT] whatsappLink: " + (pd.whatsappLink || pd.contatos?.whatsapp?.[0] || "N/A"));
    console.log("[EXTRACT] title: " + (pd.title || "N/A"));
    return pd;
  } catch (e) {
    console.error("[EXTRACT] ERRO: " + e.message);
    // Fallback manual com dados conhecidos
    return {
      url: SALES_URL,
      checkoutLink: SALES_URL,
      whatsappLink: "https://wa.me/5519981647456",
      contatos: { whatsapp: ["https://wa.me/5519981647456"] }
    };
  }
}

// ================================================================
// STEP 2: Enviar mensagem (conversa unica)
// ================================================================
async function sendMsg(msg, pageData, convId) {
  const res = await fetch(BASE + "/api/chat-universal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: msg,
      pageData: pageData,
      robotName: ROBOT,
      conversationId: convId,
      apiKey: ""
    })
  });
  return await res.json();
}

// ================================================================
// STEP 3: Cenarios de stress
// ================================================================
function makeConvId() {
  return "stress_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

const SCENARIOS = [
  {
    name: "1. PRECO DIRETO",
    desc: "Usuario pergunta preco sem rodeio",
    messages: ["quanto custa?"],
    expectCta: [true]
  },
  {
    name: "2. COMPRA DIRETA",
    desc: "Usuario quer comprar sem conversa previa",
    messages: ["quero comprar"],
    expectCta: [true]
  },
  {
    name: "3. INFO PURA (sem CTA)",
    desc: "Usuario so quer saber como funciona",
    messages: ["como funciona esse produto?"],
    expectCta: [false]
  },
  {
    name: "4. LINK QUEBRADO -> FALLBACK",
    desc: "Usuario diz que link nao abriu",
    messages: ["o link nao abriu, manda outro"],
    expectCta: [true]
  },
  {
    name: "5. PEDIDO DE SUPORTE",
    desc: "Usuario pede humano/whatsapp",
    messages: ["quero falar com atendente"],
    expectCta: [true]
  },
  {
    name: "6. JORNADA REAL: info -> preco -> compra",
    desc: "Usuario faz 3 perguntas em sequencia (mesma conversa)",
    messages: ["oi, o que eh isso?", "quanto custa?", "quero comprar"],
    expectCta: [false, true, true]
  },
  {
    name: "7. USUARIO INDECISO",
    desc: "Pergunta preco, diz que eh caro, depois volta",
    messages: ["qual o valor?", "achei caro", "tem desconto?"],
    expectCta: [true, false, false]
  },
  {
    name: "8. ERRO DE DIGITACAO",
    desc: "Usuario digita errado (simula mobile)",
    messages: ["qero compra", "manda o link ai"],
    expectCta: [true, true]
  },
  {
    name: "9. SPAM / TESTE VAZIO",
    desc: "Usuario manda algo sem sentido",
    messages: ["asdfghjkl"],
    expectCta: [false]
  },
  {
    name: "10. OBJECAO + RETORNO",
    desc: "Usuario objeta e depois pede link",
    messages: ["isso eh golpe?", "ta, me manda o link"],
    expectCta: [false, true]
  }
];

// ================================================================
// STEP 4: Executar tudo
// ================================================================
async function runScenario(scenario, pageData) {
  const convId = makeConvId();
  console.log("\n" + "=".repeat(60));
  console.log("  " + scenario.name);
  console.log("  " + scenario.desc);
  console.log("  convId: " + convId);
  console.log("=".repeat(60));

  const results = [];
  for (let i = 0; i < scenario.messages.length; i++) {
    const msg = scenario.messages[i];
    const expectCta = scenario.expectCta[i];
    try {
      const data = await sendMsg(msg, pageData, convId);
      const resp = (data.response || "").substring(0, 120).replace(/\n/g, " ");
      const hasCta = !!(data.cta && data.cta.url);
      const ctaText = data.cta ? data.cta.text + " -> " + data.cta.url.substring(0, 50) : "null";

      // Detectar vazamentos
      const leaks = [];
      if (data.response && data.response.includes("\u2501")) leaks.push("linha");
      if (data.response && /https?:\/\//.test(data.response)) leaks.push("URL-no-texto");
      if (data.response && /[\u{1F680}\u{1F447}\u{1F517}\u{1F381}\u{1F6D2}\u{1F4B3}]/u.test(data.response)) leaks.push("emoji-CTA");

      const ok = hasCta === expectCta;
      const status = ok ? "PASS" : "FAIL";

      console.log("  [" + (i + 1) + "] \"" + msg + "\"");
      console.log("      RESP:   " + resp);
      console.log("      CTA:    " + ctaText);
      console.log("      EXPECT: " + (expectCta ? "CTA" : "no CTA") + " | GOT: " + (hasCta ? "CTA" : "no CTA") + " | " + status);
      if (leaks.length > 0) console.log("      LEAKS:  " + leaks.join(", "));

      results.push({ msg, ok, hasCta, expectCta, leaks: leaks.length });
    } catch (e) {
      console.log("  [" + (i + 1) + "] \"" + msg + "\" -> ERROR: " + e.message);
      results.push({ msg, ok: false, error: true });
    }
  }
  return results;
}

(async () => {
  console.log("################################################################");
  console.log("#  V17.4 STRESS TEST — CONVERSAO SOB PRESSAO                  #");
  console.log("#  " + new Date().toISOString() + "                       #");
  console.log("################################################################\n");

  // Extract primeiro
  const pageData = await extractPageData();
  console.log("");

  // Rodar todos os cenarios
  let totalPass = 0;
  let totalFail = 0;
  let totalLeaks = 0;
  const scenarioResults = [];

  for (const sc of SCENARIOS) {
    const results = await runScenario(sc, pageData);
    let scPass = 0, scFail = 0, scLeaks = 0;
    for (const r of results) {
      if (r.ok) { scPass++; totalPass++; } else { scFail++; totalFail++; }
      if (r.leaks) { scLeaks += r.leaks; totalLeaks += r.leaks; }
    }
    scenarioResults.push({ name: sc.name, pass: scPass, fail: scFail, leaks: scLeaks, total: results.length });
  }

  // Resumo final
  const total = totalPass + totalFail;
  console.log("\n\n" + "#".repeat(60));
  console.log("#  RESUMO FINAL — V17.4 STRESS TEST");
  console.log("#".repeat(60));
  console.log("");
  for (const sr of scenarioResults) {
    const icon = sr.fail === 0 ? "PASS" : "FAIL";
    console.log("  " + icon + " | " + sr.name + " (" + sr.pass + "/" + sr.total + ")" + (sr.leaks > 0 ? " [LEAKS:" + sr.leaks + "]" : ""));
  }
  console.log("");
  console.log("  TOTAL: " + totalPass + "/" + total + " (" + Math.round(totalPass / total * 100) + "%)");
  console.log("  LEAKS: " + totalLeaks);
  console.log("  GRADE: " + (totalPass / total >= 0.9 ? "A" : totalPass / total >= 0.7 ? "B" : totalPass / total >= 0.5 ? "C" : "F"));
  console.log("#".repeat(60));
})();
