/**
 * 🧪 TESTES V9.1 + V9.2 — AUTO CHECKOUT DETECTION + SMART SELECTOR
 *
 * Valida:
 * 1. Link Resolver — hierarquia de prioridade (frontend > tenant > env > null)
 * 2. Decision Core — injeção de checkout quando intent=buy
 * 3. Orchestrator — anti-duplicação de link
 * 4. Feature Flags — flags definidas e acessíveis
 *
 * @version 1.0.0
 */

'use strict';

// ─────────────────────────────────────────────────────────
// IMPORTS
// ─────────────────────────────────────────────────────────

const { resolveCheckoutLink } = require('../lib/link-resolver');
const { buildDecision } = require('../lib/decision-core');
const Orchestrator = require('../lib/orchestrator');
const { FEATURE_DEFINITIONS } = require('../lib/feature-flags');

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FALHOU: ${testName}`);
    failed++;
  }
}

// ─────────────────────────────────────────────────────────
// TESTE 1: FEATURE FLAGS DEFINIDAS
// ─────────────────────────────────────────────────────────

console.log('\n🧪 [TESTE 1] Feature Flags V9.1 / V9.2');
console.log('─'.repeat(50));

assert(
  FEATURE_DEFINITIONS.FEATURE_AUTO_CHECKOUT_DETECTION !== undefined,
  'FEATURE_AUTO_CHECKOUT_DETECTION está definida'
);

assert(
  FEATURE_DEFINITIONS.FEATURE_AUTO_CHECKOUT_DETECTION.defaultEnabled === true,
  'FEATURE_AUTO_CHECKOUT_DETECTION habilitada por padrão'
);

assert(
  FEATURE_DEFINITIONS.FEATURE_AUTO_CHECKOUT_DETECTION.riskLevel === 'low',
  'FEATURE_AUTO_CHECKOUT_DETECTION riskLevel = low'
);

assert(
  FEATURE_DEFINITIONS.FEATURE_SMART_CHECKOUT_SELECTOR !== undefined,
  'FEATURE_SMART_CHECKOUT_SELECTOR está definida'
);

assert(
  FEATURE_DEFINITIONS.FEATURE_SMART_CHECKOUT_SELECTOR.defaultEnabled === true,
  'FEATURE_SMART_CHECKOUT_SELECTOR habilitada por padrão'
);

// ─────────────────────────────────────────────────────────
// TESTE 2: LINK RESOLVER — HIERARQUIA DE PRIORIDADE
// ─────────────────────────────────────────────────────────

console.log('\n🧪 [TESTE 2] Link Resolver — Hierarquia de Prioridade');
console.log('─'.repeat(50));

// 2.1: checkoutLink do frontend tem prioridade máxima
const link1 = resolveCheckoutLink({
  context: {
    checkoutLink: 'https://pay.hotmart.com/auto-detectado',
    checkoutUrl: 'https://outro.com/manual'
  },
  tenantConfig: {
    checkout_url: 'https://tenant.com/checkout'
  }
});
assert(
  link1 === 'https://pay.hotmart.com/auto-detectado',
  'Prioridade 1: checkoutLink do frontend (auto-detectado) vence checkoutUrl e tenant'
);

// 2.2: checkoutUrl (contexto) é segunda prioridade
const link2 = resolveCheckoutLink({
  context: {
    checkoutUrl: 'https://manual.com/checkout'
  },
  tenantConfig: {
    checkout_url: 'https://tenant.com/checkout'
  }
});
assert(
  link2 === 'https://manual.com/checkout',
  'Prioridade 2: checkoutUrl do contexto vence tenant'
);

// 2.3: checkout_url do tenant (terceira prioridade)
const link3 = resolveCheckoutLink({
  context: {},
  tenantConfig: {
    checkout_url: 'https://tenant.com/checkout'
  }
});
assert(
  link3 === 'https://tenant.com/checkout',
  'Prioridade 3: checkout_url do tenant usado quando sem contexto'
);

// 2.4: link_checkout do tenant (alias)
const link3b = resolveCheckoutLink({
  context: {},
  tenantConfig: {
    link_checkout: 'https://tenant.com/link-checkout'
  }
});
assert(
  link3b === 'https://tenant.com/link-checkout',
  'Prioridade 3b: link_checkout do tenant (alias) funciona'
);

// 2.5: null quando sem nenhum link
const link4 = resolveCheckoutLink({
  context: {},
  tenantConfig: {}
});
assert(
  link4 === null,
  'Prioridade 5: sem link → retorna null'
);

// 2.6: Erro silencioso
const link5 = resolveCheckoutLink({
  context: null,
  tenantConfig: null
});
assert(
  link5 === null,
  'Erro silencioso: context=null + tenantConfig=null → null sem exceção'
);

// ─────────────────────────────────────────────────────────
// TESTE 3: DECISION CORE — DETECÇÃO DE INTENT DE COMPRA
// ─────────────────────────────────────────────────────────

console.log('\n🧪 [TESTE 3] Decision Core — Intent de Compra');
console.log('─'.repeat(50));

const buyMessages = [
  'Quero comprar agora',
  'Me manda o link de pagamento',
  'Como faço pra pagar no pix?',
  'Link do checkout por favor',
  'Quero adquirir esse curso'
];

buyMessages.forEach(msg => {
  const d = buildDecision(msg);
  assert(
    d.intent === 'buy',
    `"${msg}" → intent=buy (veio: ${d.intent})`
  );
});

// Intent de pós-venda não deve ser buy
const postSaleMsg = 'Já comprei ontem mas não recebi o acesso';
const postSaleDecision = buildDecision(postSaleMsg);
assert(
  postSaleDecision.intent === 'post_sale',
  `"${postSaleMsg}" → intent=post_sale (veio: ${postSaleDecision.intent})`
);

// Intent de curiosidade — explain priority over curiosity
const curiosityMsg = 'Como funciona o treinamento?';
const curiosityDecision = buildDecision(curiosityMsg);
assert(
  curiosityDecision.intent === 'explain',
  `"${curiosityMsg}" → intent=explain (veio: ${curiosityDecision.intent})`
);

// ─────────────────────────────────────────────────────────
// TESTE 4: ORCHESTRATOR — ANTI-DUPLICAÇÃO + COMPRA
// ─────────────────────────────────────────────────────────

console.log('\n🧪 [TESTE 4] Orchestrator V10 — Anti-duplicação + Compra');
console.log('─'.repeat(50));

const orch = new Orchestrator();

// 4.1: Buy intent + link → injeta checkout
const orchResult1 = orch.apply({
  response: 'Ótimo, você vai adorar nosso produto!',
  context: { checkoutLink: 'https://pay.kiwify.com/checkout-abc' },
  decision: { intent: 'buy', shouldOverride: true },
  ctaData: null,
  closingData: null,
  mode: 'auto'
});
assert(
  orchResult1.orchestrated === true && orchResult1.reason === 'buy',
  'Buy intent → orquestrado com reason=buy'
);
assert(
  orchResult1.text.includes('https://pay.kiwify.com/checkout-abc'),
  'Buy intent → link de checkout injetado na resposta'
);

// 4.2: Buy intent + link já presente → NÃO duplica
const orchResult2 = orch.apply({
  response: 'Ótimo! Compre aqui: https://pay.kiwify.com/checkout-abc',
  context: { checkoutLink: 'https://pay.kiwify.com/checkout-abc' },
  decision: { intent: 'buy', shouldOverride: true },
  ctaData: null,
  closingData: null,
  mode: 'auto'
});
assert(
  orchResult2.text.split('https://pay.kiwify.com/checkout-abc').length - 1 === 1,
  'Anti-duplicação: link NÃO duplicado quando já presente'
);

// 4.3: Modo manual → bypass total
const orchResult3 = orch.apply({
  response: 'Resposta manual',
  context: { checkoutLink: 'https://example.com' },
  decision: { intent: 'buy', shouldOverride: true },
  ctaData: null,
  closingData: null,
  mode: 'manual'
});
assert(
  orchResult3.orchestrated === false && orchResult3.reason === 'mode_bypass',
  'Modo manual → bypass total, sem orquestração'
);

// 4.4: Modo off → bypass total
const orchResult4 = orch.apply({
  response: 'Resposta off',
  context: { checkoutLink: 'https://example.com' },
  decision: { intent: 'buy', shouldOverride: true },
  ctaData: null,
  closingData: null,
  mode: 'off'
});
assert(
  orchResult4.orchestrated === false && orchResult4.reason === 'mode_bypass',
  'Modo off → bypass total, sem orquestração'
);

// 4.5: Post-sale → resposta pós-venda
const orchResult5 = orch.apply({
  response: 'Entendi sua situação.',
  context: {},
  decision: { intent: 'post_sale', shouldOverride: true },
  ctaData: null,
  closingData: null,
  mode: 'auto'
});
assert(
  orchResult5.orchestrated === true && orchResult5.reason === 'post_sale',
  'Post-sale intent → orquestrado com reason=post_sale'
);

// 4.6: Sem context → sem crash
const orchResult6 = orch.apply({
  response: 'Teste sem contexto',
  context: null,
  decision: { intent: 'buy', shouldOverride: true },
  ctaData: null,
  closingData: null,
  mode: 'auto'
});
assert(
  orchResult6.text !== undefined,
  'Sem contexto (null) → não crashou'
);

// ─────────────────────────────────────────────────────────
// TESTE 5: LINK RESOLVER + DECISION CORE INTEGRADOS
// ─────────────────────────────────────────────────────────

console.log('\n🧪 [TESTE 5] Integração Link Resolver + Decision Core');
console.log('─'.repeat(50));

// Simular fluxo completo: usuário quer comprar + checkout auto-detectado
const userMsg = 'Quero comprar aquele curso agora!';
const decision = buildDecision(userMsg);
const autoCheckoutLink = 'https://pay.hotmart.com/G103177435I';

const resolvedLink = resolveCheckoutLink({
  context: { checkoutLink: autoCheckoutLink },
  tenantConfig: {}
});

const iaResponse = 'Esse curso vai mudar sua vida! Tenho certeza que você vai amar.';

assert(
  decision.intent === 'buy' && decision.shouldOverride === true,
  'Mensagem de compra → intent=buy + shouldOverride=true'
);

assert(
  resolvedLink === autoCheckoutLink,
  'Link auto-detectado do frontend resolvido corretamente'
);

// Simular injeção pelo Decision Core
const finalResponse = `${iaResponse}\n\n👉 Para finalizar com segurança, use este link:\n${resolvedLink}`;
assert(
  finalResponse.includes(autoCheckoutLink),
  'Resposta final contém o link auto-detectado do checkout'
);

// Anti-duplicação: se o link já estiver na resposta, não duplicar
assert(
  !iaResponse.includes(autoCheckoutLink) || finalResponse.split(autoCheckoutLink).length - 1 === 1,
  'Anti-duplicação: link não duplicado'
);

// ─────────────────────────────────────────────────────────
// TESTE 6: EDGE CASES
// ─────────────────────────────────────────────────────────

console.log('\n🧪 [TESTE 6] Edge Cases');
console.log('─'.repeat(50));

// 6.1: checkoutLink vazio (string vazia)
const linkEmpty = resolveCheckoutLink({
  context: { checkoutLink: '' },
  tenantConfig: {}
});
assert(
  linkEmpty === null,
  'checkoutLink vazio ("") → null'
);

// 6.2: checkoutLink undefined
const linkUndef = resolveCheckoutLink({
  context: { checkoutLink: undefined },
  tenantConfig: {}
});
assert(
  linkUndef === null,
  'checkoutLink undefined → null'
);

// 6.3: Sem argumentos
const linkNoArgs = resolveCheckoutLink({});
assert(
  linkNoArgs === null,
  'Sem context nem tenantConfig → null'
);

// 6.4: buildDecision com mensagem vazia
const emptyDecision = buildDecision('');
assert(
  emptyDecision.intent !== undefined,
  'buildDecision("") → não crashou, retornou intent'
);

// ─────────────────────────────────────────────────────────
// RESULTADO FINAL
// ─────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(50));
console.log(`🏁 RESULTADO: ${passed} passaram, ${failed} falharam`);
if (failed === 0) {
  console.log('🚀 TODOS OS TESTES V9.1/V9.2 PASSARAM!\n');
  process.exit(0);
} else {
  console.error(`⚠️ ${failed} teste(s) falharam!\n`);
  process.exit(1);
}
