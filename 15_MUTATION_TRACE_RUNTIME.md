# 15_MUTATION_TRACE_RUNTIME.md

## Objetivo
Mapear o fluxo de runtime exato que gerou a resposta ao prompt `Quanto custa?` no endpoint `/api/process-chat-inteligente`, identificando o módulo final que alterou o `finalResponse` e as etapas de mutação.

## Evidência de runtime
- Endpoint real observado: `POST https://linkmagico.app.br/api/process-chat-inteligente`
- Payload mínimo usado no teste: `message: "Quanto custa?", apiKey: "LMV7-45QA-QJAP-DW1U"`
- Resposta observada do endpoint:
  - `response`: "É Grátis/para sempre. \nO link de compra está logo abaixo. \udcc8\n\n👉 Veja condições e finalize aqui:\nhttps://linkmagico.app.br/pricing.html"
  - `cta`: `{ text: "Finalizar compra", url: "https://linkmagico.app.br/pricing.html" }`
- O link final retornado é `https://linkmagico.app.br/pricing.html`.

## Resultado principal
A alteração final do texto retornado para incluir o CTA em formato "👉 Veja condições e finalize aqui:" foi aplicada por `lib/v19-deterministic-engine.js` no método `applyDecision()`.

## Por que esta é a camada final
### Padrão de texto observado
- A string exata gerada corresponde ao branch de `V19.applyDecision()` para intent `price` / `isBuyer`:
  - `response += `\n\n👉 Veja condições e finalize aqui:\n${decision.checkoutLink}``
- Este texto NÃO é produzido por:
  - `V18.4` legacy (`Clique para finalizar sua compra`)
  - `V11.3.3` sales shield (`FINALIZAR COMPRA` bloco de checkout)
  - `V18.3` CTA injection (`Finalize sua compra aqui:`)

### Implicação
- `V19` está ativo como autoridade final ou foi o último mutador válido antes do retorno.
- `V19` é responsável por transformar a resposta IA em uma resposta comercial com checkout quando detecta `price` + checkout confiável.

## Fluxo completo de runtime para `Quanto custa?`
1. `/api/process-chat-inteligente` é chamado.
2. `processedPageData` é carregado/extraído e contém `checkoutLink` para a página de pricing.
3. Módulos pré-pipeline podem ajustar `processedPageData`:
   - `CHECKOUT-DB-INJECT@chat-inteligente`
   - `WA-CTA PROMOTER`
   - `V18-GUARD` (guardião de extração)
4. `V19` determina decisão antes de qualquer pós-processamento comercial:
   - Em `server.js` na seção `// 🧠 V19 — DETERMINISTIC DECISION ENGINE (PRÉ-PIPELINE)`
   - `__v19Decision = _v19Engine.decide(...)`
   - Se ativo, `__v19Active = true` e os blocos `V18.1`, `V18.2`, `PP-GLOBAL` são bypassados.
5. A IA gera a resposta base em `generateAIResponse(...)`.
6. Pós-processamentos iniciais ocorrem, mas nenhum deles corresponde ao CTA final observado:
   - `FEATURE_SMART_CTA` / `_ctaEngine.applyCTA` não é a origem do texto final.
   - `FEATURE_CLOSING_SCRIPTS` apenas adiciona frases de fechamento, não o CTA exato.
   - `FEATURE_ANTI_DROPOFF` não equivale à frase de checkout.
7. `V17.2 Link Resolver` executa e constrói `_intCta`:
   - `detectIntent(message)` provavelmente retorna `price`.
   - `resolveBestLink(...)` escolhe `processedPageData.checkoutLink`.
   - `buildCTA(link, intent)` produz `{ text: 'Finalizar compra', url: checkoutLink }`.
   - Observação: `V17.2` cria o objeto `cta` retornado, mas não precisa modificar `finalResponse`.
8. `V19.applyDecision(__v19Decision, finalResponse)` é chamado:
   - Se `decision.allowCheckout && decision.checkoutLink` e intent = `price`, ele injeta exatamente:
     - `👉 Veja condições e finalize aqui:
${decision.checkoutLink}`
   - Isso corresponde ao texto live observado.
9. O objeto final retornado inclui:
   - `response`: texto com CTA injetado por V19
   - `cta`: objeto de CTA construído por V17.2

## Módulos críticos identificados
- `lib/v19-deterministic-engine.js`
  - `decide(ctx)` → determina `intent`, `stage`, `allowSell`, `allowCTA`, `allowCheckout`, `checkoutLink`
  - `applyDecision(decision, finalResponse)` → aplica a alteração final de texto
- `lib/v17-link-resolver.js`
  - `detectIntent(message)` → detecta `price` para `Quanto custa?`
  - `resolveBestLink(...)` → escolhe `checkoutLink`
  - `buildCTA(link, intent)` → produz o `cta` retornado
- `server.js`
  - Bloco `// 🧠 V19 — DETERMINISTIC DECISION ENGINE (PRÉ-PIPELINE)`
  - Bloco `// ================================================================ // 🧠 V19 — APPLY DECISION (ou V18.4 legado)`
  - Bloco `// ═══════════════════════════════════════════════════════════════════ // 🧠 [V17.2] CHECKOUT AUTHORITY / FINAL OUTPUT GUARD` onde `_intCta` é montado

## Fluxos bypassados ou não responsáveis
- `V18.1` (hard buy intent override) não é a origem aqui porque a mensagem é de preço, não de compra direta.
- `V18.2` (`__forceCTA`) não se aplica quando `V19` está ativo.
- `V18.3` CTA injection é bypassado quando `__v19Active` é verdadeiro.
- `V18.4` failsafe append não geraria o texto observado.
- `V11.3.3` sales shield produziria `FINALIZAR COMPRA` em bloco formatado, não o texto `Veja condições e finalize aqui:`.
- `PP-GLOBAL` não foi o autor final quando `V19` está ativo.

## Conclusão
Para o caso `Quanto custa?` observado no endpoint real, o controle decisório final pertence a `lib/v19-deterministic-engine.js`. 

- `V19` é o responsável pela última mutação de `finalResponse`.
- `V17.2` é responsável pelo retorno do objeto `cta`, mas não pela frase de checkout final.

Portanto, o módulo que altera a resposta final exibida ao usuário é `lib/v19-deterministic-engine.js` via `applyDecision()`.
