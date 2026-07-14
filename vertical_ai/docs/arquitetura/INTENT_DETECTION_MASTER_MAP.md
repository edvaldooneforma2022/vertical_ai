# INTENT DETECTION MASTER MAP — Link Mágico

Documento baseado exclusivamente no código presente no repositório em 2026-06-20. Ele descreve o funcionamento encontrado, sem propor correções.

## 1. Visão geral

Intent Detection é o conjunto de classificadores determinísticos, atalhos semânticos, heurísticas e regras de prioridade que transformam uma mensagem do usuário em intenção comercial/operacional. No código há múltiplas gerações coexistindo: `decision-core.js`, V13, V16.2, V17.2/V17.3, V18.x hard overrides e V19.

Objetivo comercial: evitar perda de venda, entregar checkout apenas quando a intenção permite, bloquear venda em suporte/saída/objeção e orientar captura de lead quando há evidência comportamental.

Objetivo técnico: produzir sinais como `intent`, `stage`, `allowSell`, `allowCTA`, `allowCheckout`, `sendCheckout`, `captureContext`, `journeyStage` e respostas com ou sem links.

Papel no pipeline conversacional:

```text
Mensagem
↓
Normalização / pré-processamento
↓
Intent Detection
↓
Journey Stage / State Machine
↓
Decision Core / Rule Engine / Orquestrador
↓
CTA / checkout / WhatsApp / lead capture / scheduler
↓
Resposta
```

Relação com V17: V17 é um orquestrador LLM-driven. Ele detecta intenção, cria estratégia (`sellMode`, `tone`, `allowCheckout`, `allowWhatsApp`) e monta prompt; depois sanitiza e injeta links reais.

Relação com V18: V18 inclui `extraction-guard` e hard overrides no `server.js`. A V18.1 força intenção de compra por keywords quando V19 não está ativo. O guard influencia a confiança dos dados consumida pela V19.

Relação com V19: V19 declara-se autoridade única quando `FEATURE_DETERMINISTIC_V19=true`. Ela resolve intent, state, confiança dos dados e permissões `allowSell`, `allowCTA`, `allowCheckout` antes do pipeline legado.

Relação com V20: não foi encontrado módulo `v20` no conjunto de arquivos inspecionado. A documentação real termina em V19 para Intent Detection.

## 2. Todos os componentes envolvidos

| Componente | Arquivo | Função/entrypoint | Responsabilidade | Dependências |
|---|---|---|---|---|
| Decision Core legado | `lib/decision-core.js` | `detectIntent`, `buildDecision`, `shouldIncludeCheckout`, `shouldBlockCheckout` | Classificar `buy/info/objection/human/post_sale/checkout_issue/interest/stress/neutral` e decidir override simples. | Regex local; usado conceitualmente pelo lead score. |
| V13 Intent Detection | `lib/v13-intent-classifier.js` | `classifyIntent` | Classificar `READY_TO_BUY`, `INTEREST`, `DOUBT`, `OBJECTION`, `SUPPORT`, `GREETING`, `GENERIC` com ordem de prioridade. | Regex locais; consumido por V13 state/rules, V16.2 e lead capture. |
| Journey Stage V13 | `lib/v13-state-manager.js` | `updateState`, `getState` | Converter histórico de intenções em score e estágios `COLD/WARM/HOT/CHECKOUT_SENT`. | `SCORE_MAP`, TTL in-memory. |
| V13 Rule Engine | `lib/v13-rule-engine.js` | `decideAction` | Mapear intent + stage em ação (`TRIGGER_CHECKOUT`, `SUPPORT`, `HANDLE_OBJECTION`, etc.). | V13 state, contexto de checkout. |
| V16.2 Decision Engine | `lib/v16-decision-engine.js` | `processDecision`, `detectDecision` | Override determinístico anti-perda de venda; decide `SUPPORT/REBUY/BUY/FORCE_CLOSE/PRICE/DELAY/DEFAULT`. | V13 intent, buyer state próprio, validação de checkout com axios. |
| V17 Unified Brain | `lib/v17-orchestrator.js` | `detectIntent`, `buildStrategy`, `buildV17Prompt`, `injectLinks` | Detectar intenção e transformar em estratégia de prompt + injeção determinística de links. | Dados extraídos, checkout/WhatsApp sanitizados, histórico. |
| V17.3 Link Resolver | `lib/v17-link-resolver.js` | `detectIntent`, `shouldShowCTA`, `resolveBestLink`, `buildCTA` | Decidir CTA por intenção e link disponível; fallback WhatsApp. | Checkout/WhatsApp em `data`. |
| V18 hard intent | `server.js` | bloco V18.1 | Forçar `req.__forceBuyIntent` por keywords de compra quando V19 não está ativo. | Mensagem HTTP; bypass por V19. |
| V19 Deterministic Engine | `lib/v19-deterministic-engine.js` | `decide`, `resolveIntent`, `resolveState`, `applyDecision` | Autoridade única opcional: intent final, state, `allowSell`, `allowCTA`, `allowCheckout`. | `pageData`, V17 fallback opcional, feature flag. |
| Journey Analyzer | `modules/leads/journey-analyzer.js` | `analyzeJourneyStage` | Classificar jornada em `descoberta`, `negociacao`, `fidelizacao` por keywords. | Keywords locais. |
| CTA Engine / Resolver | `lib/v17-link-resolver.js`, `lib/orchestrator.js`, `lib/v19-deterministic-engine.js` | `shouldShowCTA`, `apply`, `canShowCTA/applyDecision` | Permitir, remover ou injetar CTA/checkout conforme intenção. | Intent, link, state, confidence. |
| Lead Capture | `lib/lead-capture-score.js` | `evaluateCapture` | Pontuar sinais de intenção/CTA/checkout e disparar formulário de captura. | `decision-core`, V13, tópicos regex, inteligência existente. |
| Scheduler | `server.js` | `detectarAgendamento`, `processarAgendamento`; endpoints `/api/appointments` | Detectar intenção explícita de agendar e bypassar KB/IA; armazenar agendamentos. | `superInteligencia`, lead system, storage JSON/Postgres. |
| Observer Layer | `analytics/conversation-tracker.js`, `analytics/db-adapter.js`, `analytics/performance-engine.js`, `analytics/memory-store.js` | tracking/persistência | Registrar `detectedIntent`, `journeyStage`, CTA e ações para análise/aprendizado. | DB adapter, memória. |
| Conversation State | `lib/v13-state-manager.js`, `lib/v19-deterministic-engine.js`, `lib/v16-decision-engine.js` | maps in-memory | Estado de conversa, buyer state, TTL e histórico de intenção. | Conversation ID. |
| WhatsApp | `whatsapp-integration.js`, `lib/channel-resolver-safe.js`, `lib/wa-cta-promoter.js`, V16/V17/V19 | envio/handoff/fallback | Canal de suporte, notificação e CTA fallback quando checkout ausente/quebrado. | WhatsApp settings, pageData, links. |
| Widget | `widget.js.js`, `public/widget.js`, `apublicwidgetwidget.js` | frontend chat/CTA | Exibir mensagens, links e eventos; há patch textual de scheduler client-side em `apublicwidgetwidget.js`. | API backend. |
| Link Curto | `server.js`, `lib/v17-link-resolver.js`, `lib/v19-deterministic-engine.js` | rota de chat/inteligente e resolução de link | Fluxo comercial baseado em URL extraída, checkout e WhatsApp. | Crawlers/extraction/pageData. |

## 3. Fluxo global real encontrado

1. `server.js` carrega módulos V13, V16.2, V17, V18 guard, V19 e Lead Capture.
2. A mensagem passa por limpeza/normalização local em cada classificador.
3. Se `FEATURE_DETERMINISTIC_V19` estiver ativo, V19 roda pré-pipeline: resolve intent, state, data confidence e permissões.
4. Se V19 não está ativo, V18.1 pode marcar `req.__forceBuyIntent` por keywords de compra.
5. Antes de KB-first, o scheduler tem prioridade absoluta para frases explícitas de agendamento e retorna `journeyStage: agendamento`.
6. Se V17 estiver ativo, ele bypassa V13/V15/V16/PP-global/sales layer: detecta intenção, monta estratégia, chama LLM, sanitiza e injeta checkout/WhatsApp.
7. Sem V17 ativo, V13 classifica intenção, state manager pontua stage e rule engine decide ação.
8. V16.2 pode sobrescrever V13 para suporte, compra, recompra, preço, delay ou force close.
9. CTA/checkout são inseridos/removidos por orquestradores/resolvers conforme intent, link e confidence.
10. Lead capture avalia score com sinais de decision-core, V13, CTA, checkout e tópicos comerciais.
11. Observer/analytics persistem intent, journey stage, CTA e ações.

## 4. Todas as intenções existentes no código

### Decision Core (`lib/decision-core.js`)

| Intent | Descrição | Origem | Critérios | Consumidores |
|---|---|---|---|---|
| `checkout_issue` | Problema com link/checkout. | Regex em `detectIntent`. | “link errado”, “não consigo pagar”, “página não abre”. | `buildDecision`, `lib/orchestrator.js`. |
| `human` | Quer humano/WhatsApp/contato. | Regex. | “atendente”, “whatsapp”, “telefone”, “falar com alguém”. | Orchestrator, lead capture (`intent_human`). |
| `objection` | Resistência/confusão/risco. | Regex. | “golpe”, “caro”, “não quero”, “não funciona”. | Orchestrator bloqueia checkout; lead score. |
| `post_sale` | Já comprou ou precisa acesso. | Regex. | “já comprei”, “não recebi”, “meu login”. | Orchestrator pós-venda; lead score. |
| `buy` | Compra/pagamento. | Regex. | “quero comprar”, “link de pagamento”, “quero ativar”. | Checkout, lead score. |
| `info` | Explicação/informação. | Regex. | “como funciona”, “o que inclui”. | Bloqueio de checkout; lead score. |
| `interest` | Interesse leve/comercial. | Regex. | “quanto custa”, “tem garantia”, “gostei”. | CTA leve; lead score. |
| `stress` | Usuário frustrado/agressivo. | Regex. | “burra”, “responde direito”, “robô”. | Bloqueio de checkout. |
| `neutral` | Fallback. | Fallback. | Sem match. | Sem checkout. |

### V13 (`lib/v13-intent-classifier.js`)

`READY_TO_BUY`, `INTEREST`, `DOUBT`, `OBJECTION`, `SUPPORT`, `GREETING`, `GENERIC`.

### V16.2 decisions (`lib/v16-decision-engine.js`)

`SUPPORT`, `REBUY`, `BUY`, `FORCE_CLOSE`, `PRICE`, `DELAY`, `DEFAULT`, além de fallbacks `CHECKOUT_INVALID_FALLBACK` e `CHECKOUT_MISSING_FALLBACK`.

### V17 (`lib/v17-orchestrator.js`)

`buy`, `link_request`, `exit`, `guarantee`, `objection`, `support`, `explain`, `price`, `info`.

### V17.3 Link Resolver (`lib/v17-link-resolver.js`)

`link_broken`, `support`, `buy`, `link_request`, `price_strong`, `price_objection`, `explain`, `info`.

### V19 (`lib/v19-deterministic-engine.js`)

`buy`, `price`, `objection`, `exit`, `support`, `confusion`, `neutral`.

### Inteligências/lead score

`intencao_compra` aparece como sinal de `inteligencias` no lead capture. Ele não é classificador principal nesse arquivo; é consumido como evidência para `detection_purchase_intent`.

### Scheduler

A intenção operacional de agendamento é detectada em `server.js` por frases explícitas, retornando fluxo de `agendamento`.

## 5. Onde nascem as intenções

| Origem | Tipo | Como detecta |
|---|---|---|
| `lib/decision-core.js` | Regex normalizado | Remove acentos/pontuação; ordem fixa checkout issue → human → objection → post_sale → buy → info → interest → stress → neutral. |
| `lib/v13-intent-classifier.js` | Regex por arrays | Prioridade: negação → saudação curta → suporte → dúvida → compra → interesse → objeção → genérico. |
| `lib/v16-decision-engine.js` | Heurística por `includes` | Normaliza acentos/pontuação e usa listas `HIGH_INTENT`, `PAYMENT_INTENT`, `PRICE_INTENT`, `DELAY_INTENT`, `REBUY_INTENT`, support/exit/objection. |
| `lib/v17-orchestrator.js` | Normalização + shortcuts + contains | Corrige typos (`qro`→`quero`), usa atalhos de alta confiança, depois ordem: exit, agradecimento, garantia, objection, support, buy, explain, price, link fallback, info. |
| `lib/v17-link-resolver.js` | Regex direto | `link_broken`, support, buy, link_request, price_strong, price_objection, explain, info. |
| `lib/v19-deterministic-engine.js` | Scoring por patterns | Conta matches por intent e aplica prioridade `exit > support > objection > buy > price > confusion`, com fallback V17. |
| `server.js` V18.1 | Keyword match | Força compra por keywords amplas quando V19 não está ativo. |
| `server.js` Scheduler | Frases explícitas | Exige “quero agendar”, “agendar reunião”, “marcar consulta”, etc. |
| `modules/leads/journey-analyzer.js` | Keyword score | Mapeia mensagem para `descoberta/negociacao/fidelizacao`. |
| `lib/lead-capture-score.js` | Consumidor de intent + regex | Não cria intent principal; soma sinais de intents, tópicos e eventos. |

## 6. Confiança e prioridade

Há quatro mecanismos de confiança/prioridade:

1. V13: confiança fixa por match (`0.95`, `0.9`, `0.85`, `0.8`, `0.3`) e prioridade pela ordem dos checks.
2. V13 State: score acumulado por intent (`READY_TO_BUY +5`, `INTEREST +2`, `DOUBT +1`, `OBJECTION -2`).
3. V19: score por quantidade de patterns + prioridade hierárquica. `exit` e `support` vencem com 1 match; depois maior score entre `objection`, `buy`, `price`, `confusion`.
4. V19 Data Confidence: checkout só é permitido com link, confiança >= 0.3 e stage não bloqueante.

Coexistência:

| Caso | V13 | V16.2 | V17 | V19 |
|---|---|---|---|---|
| Compra + Agendamento | Scheduler em `server.js` roda antes do KB-first e bypassa IA se frase explícita. | Sem decisão específica para agendamento. | Sem intent `schedule`. | Sem intent `schedule`; se scheduler não interceptar, compra pode vencer. |
| Compra + Suporte | SUPPORT vem antes de BUY em V13. | SUPPORT tem prioridade 1 e bloqueia checkout. | `support` vem antes de buy. | `support` tem prioridade absoluta. |
| Compra + Sair | V13 negação/saída vira `OBJECTION` antes de compra. | `EXIT_PATTERNS` bloqueiam force close para buyer; high intent ainda pode vencer se não detectado como exit. | `exit`/agradecimento/garantia/objection vêm antes de buy; shortcut forte de compra pode vencer cedo. | `exit` tem prioridade absoluta. |
| Compra + Objeção | V13 `DOUBT`/negação/objection podem vencer conforme ordem; mixed doubt+buy vira READY_TO_BUY. | Objeção bloqueia force close, mas BUY/PAYMENT vem antes de PRICE/DELAY após support/rebuy. | garantia/objection vêm antes de buy. | objection vem antes de buy na prioridade. |

## 7. Relação com Journey Stage

| Intent | Stage real encontrado |
|---|---|
| V13 `READY_TO_BUY` | Soma +5; pode levar de COLD a WARM/HOT; Rule Engine dispara checkout se houver link. |
| V13 `INTEREST` | Soma +2; COLD/WARM/HOT conforme acumulado. |
| V13 `DOUBT` | Soma +1; normalmente COLD ou progressão lenta. |
| V13 `OBJECTION` | Soma -2 com piso zero; tende a COLD. |
| V13 `SUPPORT/GREETING/GENERIC` | Score 0; stage permanece pelo score anterior. |
| V13 checkout enviado | `CHECKOUT_SENT`; update posterior não muda stage. |
| V19 `buy` | `ready`, `isBuyer=true`. |
| V19 `price` | `evaluating`; herda `isBuyer` anterior. |
| V19 `objection` | `hesitating`, `isBuyer=false`. |
| V19 `exit` | `exiting`, `isBuyer=false`. |
| V19 `support` | `support`, `isBuyer=false`. |
| V19 `confusion` | `confused`, `isBuyer=false`. |
| V19 `neutral` | `neutral`, herda buyer só se stage anterior era `ready/evaluating`. |
| JourneyAnalyzer descoberta | Keywords de explicação/informação; default. |
| JourneyAnalyzer negociacao | Keywords de preço/pagamento/compra. |
| JourneyAnalyzer fidelizacao | Keywords de suporte/contato/problema. |
| Scheduler agendamento | `server.js` retorna `journeyStage: agendamento` no bypass. |

## 8. Relação com CTA Engine

Regras reais:

- `decision-core`: `shouldIncludeCheckout` somente para `buy`; `shouldBlockCheckout` para `info`, `objection`, `human`, `stress`, `neutral`.
- `lib/orchestrator.js`: bloqueia checkout/CTA/closing para `info/objection/human/stress/neutral`; `post_sale` adiciona mensagem pós-venda; `checkout_issue` reenvia link; `buy` garante link; `interest` aceita CTA leve.
- V13 Rule Engine: `READY_TO_BUY` com checkout aciona `TRIGGER_CHECKOUT`; `SUPPORT` retorna `blockCheckout`; `INTEREST` em WARM/HOT usa benefício com CTA, sem checkout direto.
- V16.2: `SUPPORT` bloqueia checkout; `BUY/REBUY/PRICE/FORCE_CLOSE` injetam checkout; `DELAY` não injeta; falta/invalidade de checkout cai para WhatsApp/suporte.
- V17: checkout só em `buy/link_request` com checkout válido; preço pode mostrar link; suporte injeta WhatsApp; objection/guarantee/explain/info são soft/educational/neutral sem link.
- V17.3: CTA permitido para `buy`, `link_request`, `support`, `link_broken`, `price_strong` se houver link resolvido.
- V19: `allowCTA` falso para `exiting/hesitating/support/confused`; true para `buy/price` ou buyer persistente. `applyDecision` remove CTA se `allowSell=false`.

## 9. Relação com Lead Capture

`lib/lead-capture-score.js` soma pontos por sinais:

- Aumentam score: `buy` +50, `interest` +25, `info` +10, `human` +15, `post_sale` +30, `objection` +5; V13 `READY_TO_BUY` +50, `INTEREST` +25, `DOUBT` +15; preço +30; plano +25; contratação +30; implementação +20; integração +15; WhatsApp +15; suporte +10; clique CTA +40; checkout candidate +40; CTA candidate +35; `intencao_compra` +50; high interest +80; mensagens 5/10 +10/+20.
- Redução explícita de score: não há subtração no lead capture; bloqueios são por `captured`, `dismissed`, TTL e despedida.
- Disparo: `score >= 50` ou `dcIntent === buy` ou V13 `READY_TO_BUY` ou `checkoutCandidate` ou `ctaCandidate`, desde que não seja despedida e captura ainda não tenha sido exibida.
- Contextos: `purchase`, `post_sale`, `support`, `evaluation`, `consultive`, `default`.

## 10. Relação com Scheduler

O scheduler não usa os classificadores V13/V17/V19 como fonte principal. Ele usa detecção explícita em `server.js` antes do KB-first.

Ativam Scheduler: frases como `quero agendar`, `quero marcar`, `agendar reunião`, `marcar consulta`, `agendar horário`, `como agendar`, `marcar call`, `agendar vídeo`.

Bloqueios/controle: comentários indicam correções para evitar disparos por palavras soltas como WhatsApp/telefone/falar e para evitar que preço como “R$ 30” seja confundido com horário.

Conflito encontrado: `SCHED-PRIORITY-001` documenta que KB-first interceptava “quero agendar” porque “quero” dava match; por isso `detectarAgendamento` roda antes do KB-first e faz bypass total.

## 11. Link Curto

No fluxo de link curto/chat inteligente, a intenção impacta diretamente:

- se o link extraído vira checkout;
- se WhatsApp vira fallback;
- se CTA é removido por não ser compra;
- se V19 bloqueia checkout por baixa confiança de dados;
- se V17 sanitiza URLs antes de mandar contexto ao LLM e injeta o link real depois.

Impacto comercial: compra, preço e link_request tendem a preservar ou inserir CTA; suporte e link quebrado tendem a WhatsApp; objeção/saída/confusão removem pressão comercial.

## 12. Widget

O widget exibe mensagens e converte URLs em botões CTA no frontend. A decisão de intenção é majoritariamente backend. Diferenças encontradas:

- O widget processa URLs para criar botões, mas não contém o classificador mestre de intenção.
- Há arquivo `apublicwidgetwidget.js` com patch textual de scheduler client-side que detecta `schedule` por termos de agendamento, mas o scheduler efetivo do backend está em `server.js`.
- Eventos do frontend incluem `click_link`, `open_whatsapp`, `schedule_created`, `lead_submitted`, consumidos por analytics/lead scoring.

## 13. WhatsApp

WhatsApp aparece como:

- intent de suporte/humano em decision-core, V13, V16, V17, V17.3 e V19;
- link fallback quando checkout não existe, está quebrado ou inválido;
- canal de notificação de lead (`whatsapp-integration.js`);
- evento de analytics (`open_whatsapp`).

Diferenças:

- Em link curto, WhatsApp é fallback comercial e suporte.
- No widget, WhatsApp aparece como CTA/link exibido ao usuário.
- No backend WhatsApp integration, intenção alta pode gerar notificação (`notifyHighIntent`) mas essa notificação não é o classificador principal.

## 14. Matriz completa de intenções por exemplos

| Mensagem | Intent detectada provável por camada | Journey Stage | CTA | Lead Capture | Scheduler |
|---|---|---|---|---|---|
| Como funciona? | V13 `DOUBT`; V17 `explain`; V19 neutral/confusion se “como assim” | V13 +1 COLD; JourneyAnalyzer descoberta | Bloqueado/educacional | +15 V13 doubt ou +10 info | Não |
| O que é isso? | decision-core `info`; V17 `explain`; V19 `confusion` | descoberta/confused | Não | +10 info | Não |
| É golpe? | V13 `OBJECTION`; V17/V19 `objection` | hesitating/COLD | Não | +5 objection | Não |
| Parece fraude | objection | hesitating/COLD | Não | +5 | Não |
| Tem garantia? | V13 `DOUBT`; decision-core `interest`; V17 `guarantee`; V19 `objection` | descoberta/hesitating | V17 soft sem link; V19 bloqueia venda | +25 interest ou +15 doubt | Não |
| E se eu me arrepender? | V17 `guarantee` | soft/educational | Não | consultive se info/doubt | Não |
| Tem provas? | V17 fallback `info`; decision-core neutral/interest se prova social | descoberta | Não direto | baixo/consultive | Não |
| Funciona mesmo? | V13 `OBJECTION`; V17 `objection`; V19 `objection` | hesitating | Não | +5 | Não |
| Qual o preço? | decision-core `interest`; V13 `INTEREST`; V17 `price`; V19 `price` | negociacao/evaluating | Sim em V17/V19 se link e confiança; V13 CTA leve | +25/+30 | Não |
| Quanto custa? | interest/price | negociacao/evaluating | Sim se permitido | +30 preço | Não |
| Tem desconto? | interest/price | negociacao | CTA possível | +25 interest / tópico preço | Não |
| Aceita pix? | V16 `BUY`; V19 `buy`; V17 `price` | ready/evaluating | Sim | +50 buy ou tópico | Não |
| Quero comprar. | V13 `READY_TO_BUY`; V17/V19 `buy` | HOT/ready | Checkout direto | Dispara | Não |
| Quero ativar. | decision-core/V19 `buy` | ready | Checkout | Dispara | Não |
| Manda o link | V13 `READY_TO_BUY`; V17 `link_request`; V19 `buy` | ready | Checkout | Dispara | Não |
| Link de pagamento | buy | ready | Checkout | Dispara | Não |
| Onde pago? | V13 `READY_TO_BUY`; V17 link/buy | ready | Checkout | Dispara | Não |
| Quero agendar. | Scheduler explícito; V19 pode ver neutral se não interceptado | `agendamento` no bypass | Não checkout | Pode atualizar lead conversation | Sim |
| Quero marcar reunião | Scheduler | agendamento | Não | possível via lead update | Sim |
| Como agendar? | Scheduler | agendamento | Não | possível | Sim |
| Quero falar com humano | V13 `SUPPORT`; V17/V19 support | support/fidelizacao | WhatsApp/suporte, sem checkout | +15 human/+10 suporte | Não |
| Quero um especialista | Pode ser support se “falar com” ausente não necessariamente match | fidelizacao/neutral | Depende resposta | baixo | Não |
| Me chama no WhatsApp | support/human | support | WhatsApp | +15 | Não |
| Telefone de contato | support/human | fidelizacao/support | WhatsApp/contato | +15 | Não |
| Já comprei | decision-core `post_sale`; V13 `READY_TO_BUY` pelo rebuy pattern; V16 `REBUY` | pós-venda ou checkout/rebuy | V16 pode checkout recompra; decision-core pós-venda | +30 post_sale ou +50 V13 | Não |
| Não recebi acesso | post_sale | fidelizacao | Sem venda; suporte | +30 | Não |
| Suporte por favor | support/human | support/fidelizacao | WhatsApp; sem checkout | +15/+10 | Não |
| Está caro | objection | hesitating | Não | +5 | Não |
| Vou pensar | V13 `OBJECTION`; V16 `DELAY`; V19 `exit` | COLD/exiting ou delay | Não | +5 se objection | Não |
| Não quero | V13 OBJECTION; V19 exit | exiting/COLD | Não | bloqueado por despedida/score baixo | Não |
| Obrigado | V17 exit; V19 exit se “obrigado pela ajuda”; lead goodbye guard | exiting | Não | Não dispara se despedida | Não |
| Tchau | V13 OBJECTION via negação; V17/V19 exit | exiting | Não | Não | Não |
| Link não abriu | V17.3 `link_broken`; decision-core `checkout_issue` | suporte/fallback | WhatsApp ou reenvio link | possível | Não |
| Página não abre | checkout_issue | neutral/issue | Reenvia link | possível | Não |
| Não entendi nada | V19 `confusion`; V17 explain; V13 DOUBT/OBJECTION conforme texto | confused/descoberta | Não | +10/+15 | Não |
| Explica melhor | V13 DOUBT; V17 explain; V19 confusion | descoberta/confused | Não | +15 | Não |
| Quero saber mais | V13 DOUBT; decision-core interest | descoberta | CTA leve possível se interest | +15/+25 | Não |
| Gostei | decision-core interest; V13 INTEREST | WARM se acumulado | CTA leve | +25 | Não |
| Fechado | V13 READY_TO_BUY; V16 BUY | ready | Checkout | Dispara | Não |
| Bora fechar | decision-core buy; V19 buy | ready | Checkout | Dispara | Não |
| Preciso de ajuda | V19 support; Journey fidelizacao | support | Sem checkout | +10/+15 | Não |
| Quero cancelar | V13 OBJECTION; V17 guarantee/exit conforme texto | hesitating/exiting | Não | +5 ou bloqueio | Não |

## 15. Dependências ocultas

- Feature flags mudam a autoridade do sistema: V19 ativo bypassa V18.1; V17 ativo bypassa V13/V15/V16/PP-global/sales layer.
- Há múltiplos vocabulários de intenção (`buy` vs `READY_TO_BUY` vs `BUY`), exigindo mapeamentos implícitos em lead capture e fallbacks.
- V16.2 mantém `buyerState` próprio, separado do V13 state e V19 state.
- V19 depende de `pageData._extractionGuard` para reduzir confiança de dados.
- Scheduler tem prioridade fora do classificador mestre, diretamente no `server.js`.
- `interest` em uma camada pode significar preço/garantia; em outra, garantia vira `objection`.
- `link` genérico é perigoso: V17 shortcut `link_request` trata “link” diretamente, enquanto decision-core removeu “link” genérico de buy.
- Lead Capture não reduz score por objeção; objeção ainda soma +5 por engajamento.

## 16. Mapa de risco

| Componente | Risco | Motivo |
|---|---|---|
| `server.js` pipeline | ALTO | Orquestra feature flags, V18 hard intent, scheduler priority, V19 e lead capture. |
| `lib/v19-deterministic-engine.js` | ALTO | Autoridade única opcional; remove/injeta CTA e muda estado comercial. |
| `lib/v17-orchestrator.js` | ALTO | Bypassa camadas legadas quando ativo e injeta links pós-LLM. |
| `lib/v16-decision-engine.js` | ALTO | Override com force close e buyer state persistente. |
| `lib/v13-intent-classifier.js` | MÉDIO/ALTO | Base determinística e consumida por V13/V16/lead capture. |
| `lib/v13-state-manager.js` | MÉDIO | Score/stage in-memory influencia regra comercial. |
| `lib/v13-rule-engine.js` | MÉDIO | Define ação final V13. |
| `lib/v17-link-resolver.js` | MÉDIO | CTA/fallback por intent. |
| `lib/lead-capture-score.js` | MÉDIO | Disparo de captura e score comercial. |
| Scheduler em `server.js` | MÉDIO/ALTO | Bypass total de KB/IA; conflitos históricos com KB-first. |
| Observer analytics | BAIXO/MÉDIO | Não decide venda, mas armazena sinais para aprendizado/relatórios. |
| Widget frontend | BAIXO/MÉDIO | Exibe CTA e eventos; decisão principal está no backend. |
| WhatsApp integration | BAIXO/MÉDIO | Canal/fallback/notificação, não classificador mestre. |

## 17. Histórico de regressões encontrado no código

Evidências em comentários/código:

- `decision-core.js` substitui V9 por regex mais granular porque “link” genérico era fraco como compra.
- V13 documenta “quero entender” como `DOUBT`, não `READY_TO_BUY`, para evitar falso positivo.
- V16.2 inclui proteções anti-perda de venda, anti-loop, checkout inválido, fallback WhatsApp, limite de force close e bloqueio de buyer em exit/objection.
- V17 declara que V13/V15/V16/PP-global não devem alterar resposta final quando V17 está ativo.
- V17 sanitiza URLs porque LLMs truncam/inventam links.
- V19 declara substituir conflitos entre V18.1/V18.2/V18.3/V18.4/PP-GLOBAL/IS_BUYER.
- Scheduler tem comentário SCHED-PRIORITY-001: KB-first interceptava “quero agendar”; solução real é rodar agendamento antes.
- Scheduler também registra regressão de falso horário: “R$ 30” podia virar match de horário.
- Lead Capture registra princípio “Atividade ≠ Interesse”, evitando captura apenas por tempo/mensagens.

## 18. Matriz de propriedade

| Decisão | Dono real encontrado |
|---|---|
| Intent principal com V19 ativo | `lib/v19-deterministic-engine.js`. |
| Intent principal com V17 ativo | `lib/v17-orchestrator.js`. |
| Intent legado V13 | `lib/v13-intent-classifier.js`. |
| Override comercial legado | `lib/v16-decision-engine.js`. |
| Journey V13 | `lib/v13-state-manager.js`. |
| Journey textual de leads | `modules/leads/journey-analyzer.js`. |
| CTA/checkout V19 | `canShowCTA`, `canInjectCheckout`, `applyDecision` em V19. |
| CTA/checkout V17 | `buildStrategy` + `injectLinks` em V17. |
| CTA/checkout V13 | `decideAction` em V13 Rule Engine. |
| Lead Capture | `lib/lead-capture-score.js`. |
| Scheduler | `server.js` (`detectarAgendamento`, `processarAgendamento`, endpoints). |
| WhatsApp fallback | V16/V17/V17.3/V19 + channel resolver/WA promoter. |

Hierarquia real:

1. Scheduler explícito em `server.js` pode bypassar KB/IA.
2. V19, se ativo, decide antes e bypassa V18.1/PP-global.
3. V17, se ativo, bypassa V13/V15/V16/PP-global/sales layer.
4. Sem V19/V17, V18.1/V13/V16.2 e orquestradores legados coexistem.
5. Lead Capture observa e pontua, mas não é dono do CTA.

## 19. Mapa de consumo por intenção

| Intent | CTA Engine | Lead Capture | Scheduler | WhatsApp | Widget | Link Curto | Observer |
|---|---|---|---|---|---|---|---|
| `buy` / `READY_TO_BUY` / `BUY` | Checkout direto | Alto/dispara | Não | Fallback se sem checkout | Exibe link | Principal | Persiste intent/CTA |
| `link_request` | Checkout/link | Pode disparar via checkout candidate | Não | Fallback | Exibe CTA | Principal | Sim |
| `price` / `price_strong` / `INTEREST` | CTA possível | +25/+30 | Não | Fallback possível | Exibe CTA | Sim | Sim |
| `objection` / `guarantee` | Bloqueia checkout ou soft sem link | +5 ou consultive | Não | Pode encaminhar se suporte | Sem CTA compra | Bloqueio comercial | Sim |
| `support` / `human` / `SUPPORT` | Bloqueia checkout; WhatsApp | +15/+10 | Não | Principal | Exibe WhatsApp | Fallback/suporte | Sim |
| `post_sale` / `REBUY` | Post-sale sem venda no decision-core; V16 REBUY com checkout | +30 ou +50 V13 | Não | Suporte possível | Exibe resposta | Depende camada | Sim |
| `exit` | Bloqueia | Goodbye guard | Não | Não | Sem CTA | Bloqueio | Sim |
| `confusion` / `DOUBT` / `explain` / `info` | Bloqueia checkout; responde | +10/+15 | Não | Não direto | Resposta | Educacional | Sim |
| `GREETING` / `neutral` / `GENERIC` | Sem CTA; pergunta | baixo | Não | Não | Resposta | Sem venda | Sim |
| `agendamento` | Não checkout | Pode atualizar lead/conversa | Principal | Não direto | Pode exibir agenda | Bypass | Sim/event `schedule_created` |
| `link_broken` / `checkout_issue` | Reenvio/fallback WhatsApp | Possível | Não | Forte fallback | Exibe WhatsApp/link | Importante | Sim |

## 20. Conclusão executiva

O Intent Detection real do Link Mágico é multicamada e determinístico. Não existe apenas um classificador universal sempre ativo; a autoridade depende de feature flags e ordem no `server.js`.

Classificador principal quando V19 está ativo: `lib/v19-deterministic-engine.js`, que resolve intent, state, confiança de dados e permissões comerciais.

Classificador principal quando V17 está ativo: `lib/v17-orchestrator.js`, que detecta intent, define estratégia comercial e injeta links reais depois do LLM.

Base legada principal: V13 (`lib/v13-intent-classifier.js`, `lib/v13-state-manager.js`, `lib/v13-rule-engine.js`) com override V16.2 (`lib/v16-decision-engine.js`).

Componentes dependentes: CTA/checkout, Lead Capture, Scheduler, WhatsApp fallback, analytics observer, widget e fluxos de link curto.

Arquivos críticos para auditoria obrigatória:

- `server.js`
- `lib/v19-deterministic-engine.js`
- `lib/v17-orchestrator.js`
- `lib/v16-decision-engine.js`
- `lib/v13-intent-classifier.js`
- `lib/v13-state-manager.js`
- `lib/v13-rule-engine.js`
- `lib/v17-link-resolver.js`
- `lib/lead-capture-score.js`
- `modules/leads/journey-analyzer.js`
- `analytics/conversation-tracker.js`
- `analytics/db-adapter.js`

Alterações nesses arquivos exigem auditoria porque podem mudar: intenção detectada, desempate, checkout, CTA, WhatsApp fallback, lead capture, scheduler bypass, jornada e métricas persistidas.
