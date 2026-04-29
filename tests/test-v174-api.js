// V17.4 API Test — Testa os 5 cenarios criticos
const tests = [
  { msg: "quanto custa?", expect: "CTA price" },
  { msg: "quero comprar", expect: "CTA buy" },
  { msg: "como funciona?", expect: "NO CTA (info)" },
  { msg: "o link nao abriu", expect: "CTA whatsapp fallback" },
  { msg: "suporte", expect: "CTA whatsapp" }
];

async function runTest(msg, label) {
  try {
    const res = await fetch("https://vertical-ai-dktu.onrender.com/api/chat-universal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg,
        pageData: { url: "https://ev.braip.com/ref?pv=pro3exj8&af=afiv6o2dz" },
        robotName: "Granel",
        conversationId: "test_v174_" + Date.now() + "_" + Math.random().toString(36).slice(2,6),
        apiKey: ""
      })
    });
    const data = await res.json();
    const resp = (data.response || "").substring(0, 150).replace(/\n/g, " ");
    console.log("-------------------------------------------");
    console.log("MSG:    " + msg);
    console.log("EXPECT: " + label);
    console.log("RESP:   " + resp);
    console.log("CTA:    " + (data.cta ? JSON.stringify(data.cta) : "null"));
    console.log("STATUS: " + (data.cta ? "CTA PRESENT" : "NO CTA"));

    // Verificar vazamento visual
    const leaks = [];
    if (data.response && data.response.includes("━")) leaks.push("linha decorativa");
    if (data.response && /https?:\/\//.test(data.response)) leaks.push("URL no texto");
    if (data.response && /[🚀👇🔗🎁🛒💳]/.test(data.response)) leaks.push("emoji CTA");
    if (leaks.length > 0) {
      console.log("LEAKS:  " + leaks.join(", "));
    } else {
      console.log("LEAKS:  ZERO (limpo)");
    }
    return { msg, label, hasCta: !!data.cta, leaks };
  } catch(e) {
    console.log("ERROR:  " + e.message);
    return { msg, label, error: e.message };
  }
}

(async () => {
  console.log("========================================");
  console.log("  V17.4 API TEST — 5 CENARIOS CRITICOS");
  console.log("========================================\n");

  const results = [];
  for (const t of tests) {
    const r = await runTest(t.msg, t.expect);
    results.push(r);
  }

  console.log("\n========================================");
  console.log("  RESUMO FINAL");
  console.log("========================================");
  let pass = 0;
  let fail = 0;
  for (const r of results) {
    const shouldHaveCta = !r.label.includes("NO CTA");
    const ok = r.error ? false : (shouldHaveCta === r.hasCta);
    if (ok) pass++; else fail++;
    console.log((ok ? "PASS" : "FAIL") + " | " + r.msg + " | " + (r.hasCta ? "CTA" : "no CTA") + " | leaks=" + (r.leaks ? r.leaks.length : "?"));
  }
  console.log("\nSCORE: " + pass + "/" + results.length + " (" + Math.round(pass/results.length*100) + "%)");
  console.log("========================================");
})();
