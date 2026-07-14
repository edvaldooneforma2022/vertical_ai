// V17.4 STRESS TEST — TENANT: Gjgw (9LCZcv) — upflows.com.br
const BASE = "https://vertical-ai-dktu.onrender.com";
const SALES_URL = "https://upflows.com.br/";
const ROBOT = "Gjgw";
const API_KEY = "LMV7-85EN-D9I3-UTVW";

async function extractPageData() {
  console.log("[EXTRACT] Extraindo dados de " + SALES_URL + "...");
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
    console.error("[EXTRACT] ERRO: " + e.message + " — fallback manual");
    return { url: SALES_URL, whatsappLink: "https://wa.me/5511962607237", contatos: { whatsapp: ["https://wa.me/5511962607237"] } };
  }
}

async function sendMsg(msg, pageData, convId) {
  const res = await fetch(BASE + "/api/chat-universal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: msg, pageData, url: SALES_URL, robotName: ROBOT, conversationId: convId, apiKey: API_KEY })
  });
  return await res.json();
}

function cid() { return "stress_gjgw_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8); }

const SC = [
  { name: "1. PRECO DIRETO", messages: ["quanto custa?"], expectCta: [true] },
  { name: "2. COMPRA DIRETA", messages: ["quero comprar"], expectCta: [true] },
  { name: "3. INFO PURA", messages: ["como funciona esse produto?"], expectCta: [false] },
  { name: "4. LINK QUEBRADO", messages: ["o link nao abriu, manda outro"], expectCta: [true] },
  { name: "5. SUPORTE", messages: ["quero falar com atendente"], expectCta: [true] },
  { name: "6. JORNADA (info>preco>compra)", messages: ["oi, o que eh isso?", "quanto custa?", "quero comprar"], expectCta: [false, true, true] },
  { name: "7. INDECISO", messages: ["qual o valor?", "achei caro", "tem desconto?"], expectCta: [true, false, false] },
  { name: "8. TYPO MOBILE", messages: ["qero compra", "manda o link ai"], expectCta: [true, true] },
  { name: "9. SPAM", messages: ["asdfghjkl"], expectCta: [false] },
  { name: "10. OBJECAO+RETORNO", messages: ["isso eh golpe?", "ta, me manda o link"], expectCta: [false, true] }
];

async function run(sc, pd) {
  const id = cid();
  console.log("\n" + "=".repeat(55));
  console.log("  " + sc.name + "  (conv:" + id.slice(-8) + ")");
  console.log("=".repeat(55));
  const res = [];
  for (let i = 0; i < sc.messages.length; i++) {
    const msg = sc.messages[i], ex = sc.expectCta[i];
    try {
      const d = await sendMsg(msg, pd, id);
      const r = (d.response || "").substring(0, 120).replace(/\n/g, " ");
      const has = !!(d.cta && d.cta.url);
      const ct = d.cta ? d.cta.text + " -> " + d.cta.url.substring(0, 50) : "null";
      const lk = [];
      if (d.response && d.response.includes("\u2501")) lk.push("linha");
      if (d.response && /https?:\/\//.test(d.response)) lk.push("URL");
      if (d.response && /[\u{1F680}\u{1F447}\u{1F517}\u{1F381}\u{1F6D2}\u{1F4B3}]/u.test(d.response)) lk.push("emoji");
      const ok = has === ex;
      console.log("  [" + (i+1) + "] \"" + msg + "\"");
      console.log("      RESP: " + r);
      console.log("      CTA:  " + ct);
      console.log("      " + (ok ? "PASS" : "FAIL") + " (expect:" + (ex?"CTA":"noCTA") + " got:" + (has?"CTA":"noCTA") + ")" + (lk.length ? " LEAKS:" + lk.join(",") : ""));
      res.push({ ok, leaks: lk.length });
    } catch (e) {
      console.log("  [" + (i+1) + "] ERROR: " + e.message);
      res.push({ ok: false, leaks: 0 });
    }
  }
  return res;
}

(async () => {
  console.log("#".repeat(55));
  console.log("#  V17.4 STRESS — Gjgw (9LCZcv) upflows.com.br");
  console.log("#  " + new Date().toISOString());
  console.log("#".repeat(55));
  const pd = await extractPageData();
  let p = 0, f = 0, l = 0;
  const sr = [];
  for (const s of SC) {
    const r = await run(s, pd);
    let sp = 0, sf = 0, sl = 0;
    for (const x of r) { if (x.ok) { sp++; p++; } else { sf++; f++; } sl += x.leaks; l += x.leaks; }
    sr.push({ name: s.name, pass: sp, total: r.length, fail: sf });
  }
  const t = p + f;
  console.log("\n" + "#".repeat(55));
  console.log("#  RESUMO — Gjgw (9LCZcv)");
  console.log("#".repeat(55));
  for (const s of sr) console.log("  " + (s.fail === 0 ? "PASS" : "FAIL") + " | " + s.name + " (" + s.pass + "/" + s.total + ")");
  console.log("\n  TOTAL: " + p + "/" + t + " (" + Math.round(p/t*100) + "%)");
  console.log("  LEAKS: " + l);
  console.log("  GRADE: " + (p/t >= 0.9 ? "A" : p/t >= 0.7 ? "B" : p/t >= 0.5 ? "C" : "F"));
  console.log("#".repeat(55));
})();
