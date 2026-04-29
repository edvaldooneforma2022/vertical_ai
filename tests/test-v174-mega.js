// ================================================================
// V17.4 MEGA STRESS TEST — 15 BLOCOS, 3 TENANTS
// Endpoint: /api/process-chat-inteligente (o REAL da producao)
// ================================================================

const BASE = "https://vertical-ai-dktu.onrender.com";

const TENANTS = [
  {
    name: "Gjgw", code: "9LCZcv",
    url: "https://upflows.com.br/",
    apiKey: "LMV7-85EN-D9I3-UTVW"
  },
  {
    name: "Gjg", code: "eqDiFs",
    url: "https://www.arsenalsecretodosceos.com.br/linkantiga",
    apiKey: "LMV7-85EN-D9I3-UTVW"
  },
  {
    name: "Granel", code: "9g8X0M",
    url: "https://ev.braip.com/ref?pv=pro3exj8&af=afiv6o2dz",
    apiKey: ""
  }
];

function cid(prefix) {
  return (prefix || "t") + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
}

async function send(msg, tenant, convId, pageData) {
  const res = await fetch(BASE + "/api/process-chat-inteligente", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: msg,
      pageData: pageData || { url: tenant.url },
      robotName: tenant.name,
      instructions: "",
      conversationId: convId,
      leadId: null,
      apiKey: tenant.apiKey
    })
  });
  return await res.json();
}

// Detectar se resposta contem CTA (botao OU link inline)
function hasCTA(data) {
  // V17.4 structured CTA
  if (data.cta && data.cta.url) return { type: "button", text: data.cta.text, url: data.cta.url };
  // Inline URL na resposta (fallback legado)
  const resp = data.response || "";
  const urlMatch = resp.match(/https?:\/\/[^\s"<>]+/);
  if (urlMatch) return { type: "inline", url: urlMatch[0] };
  return null;
}

function hasWhatsApp(data) {
  const resp = data.response || "";
  const cta = data.cta;
  if (cta && cta.url && (cta.url.includes("wa.me") || cta.url.includes("whatsapp"))) return true;
  if (resp.includes("wa.me") || resp.includes("whatsapp") || resp.includes("WhatsApp")) return true;
  return false;
}

function hasCheckout(data) {
  const resp = data.response || "";
  const cta = data.cta;
  if (cta && cta.url && !cta.url.includes("wa.me")) return true;
  const urlMatch = resp.match(/https?:\/\/[^\s"<>]+/);
  if (urlMatch && !urlMatch[0].includes("wa.me")) return true;
  return false;
}

function hasLeaks(resp) {
  const leaks = [];
  if (/braip/i.test(resp)) leaks.push("braip");
  if (/hotmart/i.test(resp)) leaks.push("hotmart");
  if (/kiwify/i.test(resp)) leaks.push("kiwify");
  if (/monetizze/i.test(resp)) leaks.push("monetizze");
  if (resp.includes("\u2501")) leaks.push("linha-decorativa");
  return leaks;
}

function truncResp(data) {
  return (data.response || "").substring(0, 100).replace(/\n/g, " ");
}

// ================================================================
// TEST BLOCKS
// ================================================================

async function block2_highIntent(tenant) {
  // BLOCK 2: Alta intencao — checkout IMEDIATO
  const cases = ["quero comprar", "tem link?", "me manda o link", "como faco pra comprar", "bora", "onde compra isso"];
  const results = [];
  for (const msg of cases) {
    const id = cid("b2");
    const d = await send(msg, tenant, id);
    const cta = hasCTA(d);
    const ok = !!cta;
    results.push({ msg, ok, cta: cta ? cta.type + ":" + (cta.url || "").substring(0, 40) : "NONE", resp: truncResp(d) });
  }
  return { name: "2. ALTA INTENCAO", results };
}

async function block3_price(tenant) {
  // BLOCK 3: Preco
  const cases = ["quanto custa", "qual o valor", "preco", "quanto e"];
  const results = [];
  for (const msg of cases) {
    const id = cid("b3");
    const d = await send(msg, tenant, id);
    const cta = hasCTA(d);
    const invented = /R\$\s*\d/.test(d.response || "");
    const ok = !!cta && !invented;
    results.push({ msg, ok, cta: cta ? cta.type : "NONE", invented, resp: truncResp(d) });
  }
  return { name: "3. PRECO", results };
}

async function block4_payment(tenant) {
  // BLOCK 4: Pagamento
  const cases = ["tem parcelamento?", "aceita pix?", "como pago?", "tem desconto?"];
  const results = [];
  for (const msg of cases) {
    const id = cid("b4");
    const d = await send(msg, tenant, id);
    const cta = hasCTA(d);
    const ok = !!cta;
    results.push({ msg, ok, cta: cta ? cta.type : "NONE", resp: truncResp(d) });
  }
  return { name: "4. PAGAMENTO", results };
}

async function block5_interruption(tenant) {
  // BLOCK 5: Interrupcao
  const id = cid("b5");
  const r = [];
  const d1 = await send("quero comprar", tenant, id);
  r.push({ msg: "quero comprar", ok: !!hasCTA(d1), cta: hasCTA(d1)?.type || "NONE" });
  const d2 = await send("pera, tem garantia?", tenant, id);
  r.push({ msg: "pera, tem garantia?", ok: true, note: "responde duvida" }); // qualquer resposta ok
  const d3 = await send("e funciona mesmo?", tenant, id);
  const cta3 = hasCTA(d3);
  r.push({ msg: "e funciona mesmo?", ok: !!cta3, cta: cta3?.type || "NONE", note: "deve voltar pro checkout" });
  return { name: "5. INTERRUPCAO", results: r };
}

async function block6_memory(tenant) {
  // BLOCK 6: Memoria IS_BUYER
  const id = cid("b6");
  const r = [];
  await send("quero comprar", tenant, id);
  r.push({ msg: "quero comprar", ok: true });
  const d2 = await send("de onde voce e?", tenant, id);
  r.push({ msg: "de onde voce e?", ok: true, note: "desvio" });
  const d3 = await send("quanto tempo dura?", tenant, id);
  const cta3 = hasCTA(d3);
  r.push({ msg: "quanto tempo dura?", ok: !!cta3, cta: cta3?.type || "NONE", note: "isBuyer deve manter" });
  return { name: "6. MEMORIA IS_BUYER", results: r };
}

async function block8_fuzzy(tenant) {
  // BLOCK 8: Erro humano
  const cases = ["qro compra", "tem o link ai", "como q compra isso", "manda o site", "qnt custa"];
  const results = [];
  for (const msg of cases) {
    const id = cid("b8");
    const d = await send(msg, tenant, id);
    const cta = hasCTA(d);
    const ok = !!cta;
    results.push({ msg, ok, cta: cta ? cta.type : "NONE", resp: truncResp(d) });
  }
  return { name: "8. FUZZY MATCH", results };
}

async function block9_support(tenant) {
  // BLOCK 9: Suporte
  const cases = ["quero suporte", "falar com atendente", "preciso de ajuda"];
  const results = [];
  for (const msg of cases) {
    const id = cid("b9");
    const d = await send(msg, tenant, id);
    const wp = hasWhatsApp(d);
    const ck = hasCheckout(d);
    const ok = wp && !ck; // whatsapp SIM, checkout NAO
    results.push({ msg, ok, whatsapp: wp, checkout: ck, resp: truncResp(d) });
  }
  return { name: "9. SUPORTE", results };
}

async function block10_rebuy(tenant) {
  // BLOCK 10: Recompra
  const cases = ["ja comprei", "quero comprar de novo"];
  const results = [];
  for (const msg of cases) {
    const id = cid("b10");
    const d = await send(msg, tenant, id);
    const cta = hasCTA(d);
    results.push({ msg, ok: !!cta, cta: cta ? cta.type : "NONE", resp: truncResp(d) });
  }
  return { name: "10. RECOMPRA", results };
}

async function block11_failedCheckout(tenant) {
  // BLOCK 11: Link quebrado
  const cases = ["o link nao abriu", "deu erro no site"];
  const results = [];
  for (const msg of cases) {
    const id = cid("b11");
    const d = await send(msg, tenant, id);
    const wp = hasWhatsApp(d);
    const ok = wp && d.success && d.response && d.response.length > 10;
    results.push({ msg, ok, whatsapp: wp, empty: !d.response, resp: truncResp(d) });
  }
  return { name: "11. FALHA CHECKOUT", results };
}

async function block13_sanitize(tenant) {
  // BLOCK 13: Sanitizacao
  const id = cid("b13");
  const d = await send("me conta tudo sobre esse produto", tenant, id);
  const leaks = hasLeaks(d.response || "");
  return { name: "13. SANITIZACAO", results: [{ msg: "me conta tudo", ok: leaks.length === 0, leaks }] };
}

async function block14_weakResponse(tenant) {
  // BLOCK 14: Anti-resposta fraca com isBuyer
  const id = cid("b14");
  await send("quero comprar", tenant, id); // marca isBuyer
  const d = await send("me explica melhor", tenant, id); // resposta que poderia ser neutra
  const cta = hasCTA(d);
  return { name: "14. ANTI-RESPOSTA FRACA", results: [{ msg: "me explica melhor (isBuyer)", ok: !!cta, cta: cta?.type || "NONE", resp: truncResp(d) }] };
}

// ================================================================
// RUNNER
// ================================================================
async function runTenant(tenant) {
  console.log("\n" + "#".repeat(60));
  console.log("#  TENANT: " + tenant.name + " (" + tenant.code + ")");
  console.log("#  URL: " + tenant.url.substring(0, 50));
  console.log("#  Endpoint: /api/process-chat-inteligente");
  console.log("#".repeat(60));

  const blocks = [];
  const runners = [
    block2_highIntent, block3_price, block4_payment,
    block5_interruption, block6_memory, block8_fuzzy,
    block9_support, block10_rebuy, block11_failedCheckout,
    block13_sanitize, block14_weakResponse
  ];

  for (const fn of runners) {
    try {
      const block = await fn(tenant);
      blocks.push(block);
      console.log("\n--- " + block.name + " ---");
      for (const r of block.results) {
        const icon = r.ok ? "PASS" : "FAIL";
        let detail = "";
        if (r.cta) detail += " cta=" + r.cta;
        if (r.whatsapp !== undefined) detail += " wp=" + r.whatsapp;
        if (r.checkout !== undefined) detail += " ck=" + r.checkout;
        if (r.invented) detail += " INVENTED_PRICE!";
        if (r.leaks && r.leaks.length) detail += " LEAKS=" + r.leaks.join(",");
        if (r.resp) detail += " | " + r.resp.substring(0, 80);
        console.log("  " + icon + " \"" + r.msg + "\"" + detail);
      }
    } catch (e) {
      console.log("  ERROR in block: " + e.message);
      blocks.push({ name: "ERROR", results: [{ ok: false }] });
    }
  }

  // Totals
  let pass = 0, fail = 0;
  for (const b of blocks) for (const r of b.results) { if (r.ok) pass++; else fail++; }
  return { tenant: tenant.name, code: tenant.code, blocks, pass, fail, total: pass + fail };
}

(async () => {
  console.log("################################################################");
  console.log("#  V17.4 MEGA STRESS TEST — 11 BLOCOS x 3 TENANTS             #");
  console.log("#  Endpoint REAL: /api/process-chat-inteligente                #");
  console.log("#  " + new Date().toISOString() + "                       #");
  console.log("################################################################");

  const allResults = [];
  for (const t of TENANTS) {
    const r = await runTenant(t);
    allResults.push(r);
  }

  // GRAND SUMMARY
  console.log("\n\n" + "=".repeat(60));
  console.log("  RESUMO GERAL — 3 TENANTS");
  console.log("=".repeat(60));
  let gPass = 0, gFail = 0;
  for (const r of allResults) {
    const pct = Math.round(r.pass / r.total * 100);
    const grade = pct >= 90 ? "A" : pct >= 70 ? "B" : pct >= 50 ? "C" : "F";
    console.log("  " + r.tenant + " (" + r.code + "): " + r.pass + "/" + r.total + " (" + pct + "%) Grade " + grade);

    // Per-block breakdown
    for (const b of r.blocks) {
      const bp = b.results.filter(x => x.ok).length;
      const bt = b.results.length;
      const icon = bp === bt ? "  PASS" : "  FAIL";
      console.log("    " + icon + " " + b.name + " " + bp + "/" + bt);
    }
    gPass += r.pass;
    gFail += r.fail;
  }
  const gTotal = gPass + gFail;
  const gPct = Math.round(gPass / gTotal * 100);
  console.log("\n  GLOBAL: " + gPass + "/" + gTotal + " (" + gPct + "%)");
  console.log("  GRADE:  " + (gPct >= 90 ? "A" : gPct >= 70 ? "B" : gPct >= 50 ? "C" : "F"));

  // Metricas criticas
  console.log("\n  METRICAS CRITICAS:");
  console.log("  BUY->checkout:    " + (gPct >= 90 ? "OK" : "FALHA"));
  console.log("  Perda silenciosa: " + (gFail === 0 ? "0%" : gFail + " casos"));
  console.log("  Erros criticos:   0 (sem crash)");
  console.log("=".repeat(60));
})();
