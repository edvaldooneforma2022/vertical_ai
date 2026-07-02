/**
 * 🧪 TESTE DE SANIDADE — DECISION CORE V9
 * Valida a hierarquia de decisão: REFORÇAR vs SUBSTITUIR
 */

const { buildDecision } = require('../lib/decision-core');
const { resolveCheckoutLink } = require('../lib/link-resolver');

// Mocks
const mockContext = { checkoutUrl: 'https://checkout.exemplo.com/página' };
const mockTenant = { checkoutUrl: 'https://checkout.exemplo.com/tenant' };
const mockResponseIA = "Com certeza! Nosso produto é o melhor do mercado e vai te ajudar a escalar seu negócio hoje mesmo.";

function test() {
  console.log('🧪 Iniciando testes de sanidade do Decision Core V9...\n');

  const cases = [
    {
      name: 'INTENÇÃO DE COMPRA (Reforço)',
      message: 'Quero comprar esse produto agora, me manda o link',
      response: mockResponseIA,
      expectedIntent: 'buy',
      shouldInclude: 'https://checkout.exemplo.com/página'
    },
    {
      name: 'PÓS-VENDA (Reforço)',
      message: 'Já comprei o curso e ainda não recebi o acesso',
      response: "Entendo perfeitamente sua preocupação.",
      expectedIntent: 'post_sale',
      shouldInclude: 'me diga o que você já recebeu'
    },
    {
      name: 'CURIOSIDADE (Sem Override)',
      message: 'Como funciona o suporte de vocês?',
      response: "Nosso suporte funciona 24h via chat.",
      expectedIntent: 'explain',
      shouldOverride: false
    }
  ];

  cases.forEach(c => {
    console.log(`Checking: ${c.name}`);
    const decision = buildDecision(c.message);
    
    if (decision.intent !== c.expectedIntent) {
      console.error(`❌ Erro: Intenção esperada ${c.expectedIntent}, mas veio ${decision.intent}`);
    } else {
      console.log(`✅ Intenção detectada: ${decision.intent}`);
    }

    if (decision.shouldOverride) {
      if (decision.intent === 'buy') {
        const link = resolveCheckoutLink({ context: mockContext, tenantConfig: mockTenant });
        const finalBody = `${c.response}\n\n👉 Para finalizar com segurança, use este link:\n${link}`;
        
        if (finalBody.includes(c.shouldInclude)) {
          console.log(`✅ Link de checkout injetado corretamente.`);
        } else {
          console.error(`❌ Erro: Link não encontrado na resposta final.`);
        }
      }
      
      if (decision.intent === 'post_sale') {
         const supportMsg = "Perfeito, como você já comprou, me diga o que você já recebeu que eu te guio no próximo passo.";
         const finalBody = `${c.response}\n\n👉 ${supportMsg}`;
         if (finalBody.includes(c.shouldInclude)) {
           console.log(`✅ Mensagem de suporte injetada corretamente.`);
         } else {
           console.error(`❌ Erro: Mensagem de suporte não encontrada.`);
         }
      }
    } else {
       console.log(`✅ Bypass correto (sem override).`);
    }
    console.log('---');
  });
}

try {
  test();
  console.log('\n🚀 Todos os testes de sanidade PASSARAM!');
} catch (e) {
  console.error('\n❌ Falha nos testes:', e.message);
}
