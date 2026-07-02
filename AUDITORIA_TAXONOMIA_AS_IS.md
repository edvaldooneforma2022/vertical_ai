# Auditoria AS-IS de Taxonomia de Intents

## 1. Todas as intents existentes no sistema

### Decision Core / V17 / V19
- `checkout_issue`
- `human`
- `objection`
- `post_sale`
- `buy`
- `explain`
- `info`
- `interest`
- `stress`
- `neutral`
- `exit`
- `guarantee`
- `support`
- `link_request`
- `price`
- `price_strong`
- `price_objection`
- `link_broken`
- `confusion`

### Pipeline comercial / Sales
- `comprar`
- `duvida`
- `objecao`
- `sair`
- `curioso`

### CTA / Closing buckets
- `ready_to_buy`
- `interest`
- `objection`
- `hesitation`
- `exit`
- `curiosity`

## 2. Em quais módulos cada intent é produzida e consumida

| Intent | Produzido por | Consumido por | Observações |
|---|---|---|---|
| `checkout_issue` | `lib/decision-core.js` | `server.js` step de `shouldBlockCheckout` / orquestrador | problema de link |
| `human` | `lib/decision-core.js` | `server.js` / `Orchestrator` / `lead capture` | suporte/humano |
| `objection` | `lib/decision-core.js`, `lib/v17-orchestrator.js`, `lib/v19-deterministic-engine.js` | `Orchestrator`, `CTA Engine`, `Closing Scripts`, `V19 apply`, `Sales Layer` | amplamente compartilhado |
| `post_sale` | `lib/decision-core.js` | `Orchestrator`, `lead capture` | pós-venda |
| `buy` | `lib/decision-core.js`, `lib/v17-orchestrator.js`, `lib/v17-link-resolver.js`, `lib/v19-deterministic-engine.js` | CTA/Closing/Orchestrator/V19 | equivalente a `comprar` / `ready_to_buy` |
| `explain` | `lib/decision-core.js`, `lib/v17-orchestrator.js`, `lib/v17-link-resolver.js` | `Orchestrator`, `CTA Engine`, `V17` prompt | pedido de explicação |
| `info` | `lib/decision-core.js`, `lib/v17-orchestrator.js`, `lib/v17-link-resolver.js` | `Orchestrator`, `CTA Engine`, `V17` prompt | informação complementar |
| `interest` | `lib/decision-core.js`, `lib/v17-orchestrator.js` | `Orchestrator`, `CTA Engine`, `V17` strategy | interesse leve |
| `stress` | `lib/decision-core.js` | `Orchestrator` / `checkout blocker` | frustração |
| `neutral` | `lib/decision-core.js`, `lib/v19-deterministic-engine.js` | `checkout blocker`, `V19` | fallback neutro |
| `exit` | `lib/v17-orchestrator.js`, `lib/v19-deterministic-engine.js` | `V17` strategy, `V19` state, `Closing/CTA` | desistência / despedida |
| `guarantee` | `lib/v17-orchestrator.js` | `V17` strategy | garantia / risco |
| `support` | `lib/v17-orchestrator.js`, `lib/v17-link-resolver.js`, `lib/v19-deterministic-engine.js` | `CTA Engine`, `V19`, `Orchestrator` | suporte/humano |
| `link_request` | `lib/v17-orchestrator.js`, `lib/v17-link-resolver.js` | `V17` strategy, CTA resolver | pedido de link |
| `price` | `lib/v17-orchestrator.js`, `lib/v19-deterministic-engine.js` | `V17` strategy, `V19` | preço / valor |
| `price_strong` | `lib/v17-link-resolver.js` | `V17` CTA resolver | preço como compra |
| `price_objection` | `lib/v17-link-resolver.js` | `V17` CTA resolver | preço como barreira |
| `link_broken` | `lib/v17-link-resolver.js` | `V17` CTA resolver | fallback WhatsApp |
| `confusion` | `lib/v19-deterministic-engine.js` | `V19` | semântica de confusão |
| `comprar` | `sales/decision-engine.js` | `sales-layer.js`, `CTA Engine`, `Closing Scripts` | equivalente a `buy` |
| `duvida` | `sales/decision-engine.js` | `sales-layer.js`, `CTA Engine`, `Closing Scripts` | equivalente a `explain` / `info` |
| `objecao` | `sales/decision-engine.js` | `sales-layer.js`, `CTA Engine`, `Closing Scripts` | equivalente a `objection` |
| `sair` | `sales/decision-engine.js` | `sales-layer.js` | equivalente a `exit` |
| `curioso` | `sales/decision-engine.js`, `sales/sales-layer.js` | `sales-layer.js`, `CTA Engine`, `Closing Scripts` | traduz para `curiosity` |
| `ready_to_buy` | `sales/cta-engine.js`, `sales/closing-scripts.js` | `CTA Engine`, `Closing Scripts` | target de `buy` |
| `interest` | `sales/cta-engine.js`, `sales/closing-scripts.js` | `CTA Engine`, `Closing Scripts` | target de `duvida` |
| `hesitation` | `sales/cta-engine.js`, `sales/closing-scripts.js` | `CTA Engine`, `Closing Scripts` | target de `sair` / `objecao` |
| `curiosity` | `sales/cta-engine.js`, `sales/closing-scripts.js` | `CTA Engine`, `Closing Scripts` | target de `curioso` |
| `exit` (CTA) | `sales/cta-engine.js`, `sales/closing-scripts.js` | `CTA Engine`, `Closing Scripts` | target de `sair` |

## 4. Quais intents representam o mesmo conceito de negócio

| Conceito de negócio | Intents equivalentes |
|---|---|
| Compra | `buy`, `comprar`, `ready_to_buy` |
| Pedido de explicação / dúvidas | `explain`, `duvida`, `info`, `interest`, `curioso`, `curiosity` |
| Objeção | `objection`, `objecao`, `price_objection` |
| Suporte humano | `human`, `support` |
| Saída / desistência | `exit`, `sair` |
| Preço / valor | `price`, `price_strong`, `comprar` em contexto de preço |
| Checkout link request | `link_request`, `buy` |
| Confusão / não entendi | `confusion`, `explain`, `objection` |
| Garantia / risco | `guarantee` |
| Problema de link | `checkout_issue`, `link_broken` |
| Pós-venda | `post_sale` |
| Neutro / fallback | `neutral` |

## 5. Traduções implícitas entre módulos

- `curioso` → `curiosity`
- `comprar` → `buy` / `ready_to_buy`
- `duvida` → `explain` / `info` / `interest`
- `objecao` → `objection`
- `sair` → `exit`
- `human` → `support`
- `link_request` → `buy` / `ready_to_buy`
- `price_strong` → sinal de compra próxima / CTA permitido
- `price_objection` → sinal de bloqueio de CTA
- `confusion` → `explain` / `objection`
- `checkout_issue` → `link_broken`
- `guarantee` → cobertura de risco / objeção de preço

## 6. Conflitos semânticos existentes hoje

- **`explain` vs `curioso` / `duvida`**
  - `Decision Core` / `V17` usam `explain` para "como funciona".
  - pipeline comercial usa `duvida` ou `curioso` para o mesmo tipo de pergunta.
  - isso cria divergência na forma como a mesma mensagem é tratada e se checkout é bloqueado.

- **`info` vs `interest`**
  - `Decision Core` define `info` como "quer informação".
  - Sales CTA/Closing usa `interest` como intenção leve.
  - `info` tende a ser mapeado para `interest`, mas não há correspondência única.

- **`buy` / `comprar` / `ready_to_buy`**
  - o mesmo conceito existe em domínios diferentes.
  - potencial conflito se um módulo classificar como `buy` e outro como `duvida` / `curioso`.

- **`support` vs `human`**
  - V17 / V19 usam `support`.
  - Decision Core usa `human`.
  - semântica próxima, mas não há consistência de nomes.

- **`price` / `price_strong` / `price_objection`**
  - V17 distingue preço como potencial compra ou como objeção.
  - Sales pipeline não tem correspondência clara e costuma encaixar em `duvida` ou `objecao`.
  - resulta em ambiguidade na transição para CTA.

- **`confusion` vs `explain`**
  - V19 possui `confusion`; Decision Core/V17 usam `explain`.
  - mesmo conceito, mas com comportamento diferente.

- **`checkout_issue` vs `link_broken`**
  - mesma ideia de problema de link, mas domínios distintos.
  - pode haver duplicação de lógica.

- **`curioso` como intent vs `curiosity` como CTA**
  - o mesmo conceito é representado em níveis diferentes.
  - causa ruído entre a camada de decisão comercial e a camada de copy/CTA.

## 7. Matriz comparativa AS-IS

| Módulo | Taxonomia | Intents principais | Notas |
|---|---|---|---|
| `lib/decision-core.js` | Decision Core legacy | `checkout_issue`, `human`, `objection`, `post_sale`, `buy`, `explain`, `info`, `interest`, `stress`, `neutral` | checkout só em `buy` |
| `lib/v17-orchestrator.js` | V17 unified brain | `exit`, `guarantee`, `objection`, `support`, `buy`, `link_request`, `price`, `explain`, `info` | LLM-driven |
| `lib/v17-link-resolver.js` | V17 CTA resolver | `link_broken`, `support`, `buy`, `link_request`, `price_strong`, `price_objection`, `explain`, `info` | controla CTA/link |
| `lib/v19-deterministic-engine.js` | V19 autoridade | `exit`, `support`, `objection`, `buy`, `price`, `confusion`, `neutral` | autoridade única quando flag ativa |
| `sales/decision-engine.js` | Pipeline comercial | `comprar`, `duvida`, `objecao`, `sair`, `curioso` | decisão de vendas |
| `sales/cta-engine.js` | CTA buckets | `ready_to_buy`, `interest`, `objection`, `hesitation`, `exit`, `curiosity` | mapeia intents para CTA |
| `sales/closing-scripts.js` | Closing buckets | mesmo que CTA Engine | scripts finais |
| `sales/sales-layer.js` | Perfil + pressão | perfil `curioso` | ajusta urgência |
| `server.js` | Orquestração | consome todos | integra camadas |
| `server.js` (`inteligencias`) | sinal behavioral | `curioso` como flag | usado em lead capture / analytics |

---

## Nota: Normalização de Fronteira (Task 01)

Foi implementada normalização automática em `server.js` na variável `_v21ResolvedIntent` (fonte `inteligencias`) via `SALES_TO_V17_INTENT_MAP`. Traduz intents PT (`curioso`→`interest`, `duvida`→`explain`, `comprar`→`buy`, `objecao`→`objection`, `sair`→`exit`) antes de propagar ao domínio V17. Feature flag: `FEATURE_TAXONOMY_NORMALIZATION` (default `true`). Nenhum pipeline interno foi alterado.

