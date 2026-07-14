# DECISION_CORE_MASTER_MAP — Link Mágico

> Documento baseado exclusivamente no código existente. Não contém propostas de correção.

## 1. Visão geral

O **Decision Core** é o conjunto de camadas determinísticas que decide se a conversa pode vender, mostrar CTA, injetar checkout, capturar lead, priorizar suporte/humano ou expor agendamento. No código, o nome aparece em múltiplas gerações: `lib/decision-core.js` (V10.1), `lib/orchestrator.js` (V10.1), `lib/v16-decision-engine.js` (V16.2), `lib/v17-orchestrator.js`, `lib/v17-link-resolver.js`, `lib/v18-extraction-guard.js`, `lib/v19-deterministic-engine.js` e integrações em `server.js`.

**Objetivo comercial:** reduzir perda de venda, controlar quando o checkout/CTA aparece e evitar CTA em suporte, objeção, saída, confusão ou pós-venda. **Objetivo técnico:** centralizar regras determinísticas acima da IA generativa, aplicar feature flags, preservar fallback e produzir resposta final com metadados (`cta`, `calendarHash`, `inteligenciasDetectadas`, `journeyStage`, `leadCapture`).

**Papel arquitetural:** o pipeline principal (`server.js`) coleta contexto, detecta intenções/inteligências, gera resposta IA e aplica camadas de decisão de última milha. Quando `FEATURE_DETERMINISTIC_V19=true`, o V19 se declara autoridade única: resolve intent final, estado, confiança de dados, `allowSell`, `allowCTA` e `allowCheckout`, e depois aplica/remover/injeta CTA/checkout. Quando V19 está desligado ou em `shadow`, camadas legadas continuam ativas.

**Relação com V17:** `FEATURE_V17_BRAIN` descreve o V17 como “Unified Brain Orchestrator” que decide estratégia e pode bypassar V13/V15/V16/PP-GLOBAL/Sales Layer. Na rota principal, o `v17-link-resolver` ainda é usado como trava de CTA por intenção + link válido.

**Relação com V18:** V18 não é o decisor comercial final; é guarda de extração. Ele avalia confiança de `pageData`, descobre/faz fallback de checkout/WhatsApp e alimenta V19/legado com dados mais confiáveis. V18.2/V18.3/V18.4 têm fallback/força de CTA no legado, mas são bypassados quando V19 está ativo.

**Relação com V19:** V19 é a versão que mais explicitamente assume decisão final quando ativada: “autoridade única de decisão comercial”. Com V19 ativo, PP-GLOBAL, force CTA e fallback V18.4 são condicionados/bypassados para evitar conflito.

**Relação com V20:** V20 aparece como camada de auditoria/observer de bypass LLM: registra que flags legadas teriam bypassado, mas a geração IA executou. Não toma decisão final na resposta; observa e loga.

**Quem toma a decisão final do sistema?**

* Com `FEATURE_DETERMINISTIC_V19=true`: `lib/v19-deterministic-engine.js` toma a decisão comercial final e `applyDecision()` altera a resposta final.
* Sem V19 ativo: a decisão final é composta no `server.js` pela ordem real de execução: intercepts pré-KB/scheduler/support, IA, CTA Engine, Orchestrator V10, V18.3/V18.4/PP-GLOBAL, V17.2 Link Resolver e Lead Capture observer.
* No WhatsApp, o canal não decide; consome o pipeline central e apenas traduz CTA/captura/agendamento para texto.

## 2. Inventário completo

| Item | Caminho | Responsabilidade | Dependências reais |
|---|---|---|---|
| Decision Core V10.1 | `lib/decision-core.js` | `detectIntent`, `shouldIncludeCheckout`, `shouldBlockCheckout`, `buildDecision`; regra de ouro: checkout só para `buy`. | Regex local; consumido por lead capture e server/orquestração. |
| Orchestrator V10.1 | `lib/orchestrator.js` | Camada única de decisão final no legado: bypass, bloqueio, pós-venda, checkout issue, compra, CTA, closing. | `decision`, `ctaData`, `closingData`, `context`, `mode`, `FEATURE_ORCHESTRATOR_V10`. |
| V16.2 Decision Engine | `lib/v16-decision-engine.js` | Camada determinística anti-perda de venda; estado buyer com expiração; regras high intent, price, support, exit, objection. | `axios` opcional, `conversationId`, checkout, salesMode, feature flag. |
| V17 Brain Orchestrator | `lib/v17-orchestrator.js` | Detecta intenção/estratégia e monta prompt dinâmico; pode bypassar pipeline legado quando flagada. | Mensagem, contexto, dados extraídos, LLM. |
| V17 Link Resolver | `lib/v17-link-resolver.js` | Trava CTA no backend: detecta intent, resolve link, valida `shouldShowCTA`, remove CTA antigo, monta CTA. | `checkoutLink`, `whatsappLink`, `urlGuard`, mensagem. |
| V18 Extraction Guard | `lib/v18-extraction-guard.js` | Avalia status/confiança de extração, descobre links, aplica fallback sem sobrescrever dados existentes. | `pageData`, `links`, `FEATURE_V18_EXTRACTION_GUARD`, `FEATURE_V18_FALLBACK`. |
| V19 Deterministic Engine | `lib/v19-deterministic-engine.js` | Autoridade única quando ativa: intent, state, data confidence, sell/CTA/checkout, aplicação final. | Mensagem, `conversationId`, `pageData`, `v17Intent`, `salesMode`. |
| Lead Capture Score | `lib/lead-capture-score.js` | Observer de captura por score comportamental; consome decision-core, V13, CTA/checkout candidates e inteligências. | `conversationId`, `dcIntent`, `v13Result`, `ctaCandidate`, `checkoutCandidate`, `inteligencias`. |
| V13 Intent Classifier | `lib/v13-intent-classifier.js` | Classifica intents V13 como `READY_TO_BUY`, `INTEREST`, `DOUBT`; alimenta V13 e Lead Capture. | Mensagem. |
| Journey Analyzer | `lib/ai-systems/journey-analyzer.js`, `modules/leads/journey-analyzer.js` | Analisa estágio (`descoberta`, `consideração`, `decisão`, `agendamento`, `suporte` etc.). | Mensagem, histórico/lead. |
| CTA Engine | `sales/cta-engine.js` | Seleciona CTA contextual, anti-repetição, aplica CTA se permitido. | Intent/action/context/conversationId. |
| Sales Decision Engine | `sales/decision-engine.js` | Detecta intent e decide ação/estratégia comercial por stage/evolução. | Mensagem, histórico, `journeyStage`, contagem. |
| Sales Layer | `sales/sales-layer.js` | Injeta copy/closing/CTA conforme stage e decisão. | `journeyStage`, messageCount, preset, checkout. |
| Channel Resolver Safe | `lib/channel-resolver-safe.js` | Garante saída acionável para suporte/humano sem sobrescrever checkout. | Support intent, contatos/WhatsApp. |
| WA CTA Promoter | `lib/wa-cta-promoter.js` | Promove WhatsApp como CTA quando não há checkout e WhatsApp tem intenção de conversão. | `pageData`, links de WhatsApp, feature flag. |
| Link Resolver | `lib/link-resolver.js` | Resolve checkout por hierarquia de fontes. | `checkoutLink`, contexto, tenant/env. |
| Safe Checkout Resolver | `lib/safe-checkout-resolver.js` | Seleciona checkout seguro, evita URL interna/autorreferência. | URLs candidatas. |
| Force Checkout | `lib/force-checkout.js` | Camada de força/fallback de checkout. | Mensagem, checkout. |
| Lead Capture System | `lib/leads/lead-capture.js` | Persistência e atualização de leads, estágio e conversa. | DB/backup/analytics. |
| Persistent/Learning Memory | `lib/persistent-memory.js`, `lib/learning-memory.js`, `lib/conversation-state.js` | Memória de conversa, sucesso/falha e estado. | `apiKey`, `conversationId`, intent, checkout, resposta. |
| WhatsApp Channel | `whatsapp-channel.js` | Canal de transporte; chama pipeline central, injeta CTA inline, traduz leadCapture e calendarHash. | `process-chat-inteligente`, lead system, providers. |
| Widget | `public/widget.js` e HTML injetado em `server.js` | Renderiza links/CTA, captura inline, calendário via `calendarHash`, tracking. | Resposta JSON do backend. |
| Link Curto | rotas `/l/:shortCode`, `/chatbot` em `server.js`, `short-url-generator.js` | Resolve tenant/assistente e abre chatbot com dados do short URL. | `short_urls`, cache, whitelabel, apiKey. |
| Feature flags | `lib/feature-flags.js`, `data/feature_flags.json` | Liga/desliga V10/V15/V16/V17/V18/V19/WA/Chat First. | env vars, arquivo JSON, overrides. |
| Middleware API key | `server.js`, `routes.js`, `whatsapp-routes.js` | Resolve tenant/canal antes da decisão. | apiKey/widget token/short URL. |

## 3. Fluxo decisório completo real

```text
Mensagem
↓
server.js recebe payload / canal resolve tenant
↓
Contexto: pageData, checkoutLink, whatsappLink, contatos, apiKey, leadId, conversationId, salesMode
↓
V18 Extraction Guard/Fallback qualifica pageData e links quando habilitado
↓
Intent Detection: decision-core/V13/V17/V19/regex de inteligências conforme flag e ponto do fluxo
↓
Journey Stage: journeyAnalyzer.analyzeJourneyStage(message) e leadSystem.updateLeadJourneyStage()
↓
Observer Layer: V20 audit e Lead Capture Score observam sinais sem alterar resposta principal
↓
Decision Core: V19 se ativo; senão composição legada V10/V16/V17.2/V18.x/PP-GLOBAL
↓
CTA: CTA Engine coleta/aplica; Orchestrator ou V19 autoriza/bloqueia; V17.2 monta objeto cta final
↓
Lead Capture: evaluateCapture retorna shouldCapture/score/captureMessage
↓
Scheduler: intenção de agendamento/intercept ou [CALENDAR_WIDGET] gera calendarHash
↓
Resposta Final: JSON com response, cta, calendarHash, inteligenciasDetectadas, analiseEmocional, journeyStage, leadCapture
```

## 4. Todas as entradas do Decision Core

Entradas confirmadas no código:

* `message`: fonte primária de intent, regex, journey, observer e agendamento.
* `conversationId`: estado buyer V16/V19, anti-repetição CTA, lead capture session, memória.
* `pageData`: `checkoutLink`, `whatsappLink`, `contatos`, `content`, `description`, `extractedText`, `links`, `_extractionGuard`, `bonuses_detected`.
* `salesMode`/modo IA: V19 bypassa em `manual` ou `off`; Orchestrator também respeita modo.
* `v17Intent`: fallback do V19 se V19 não classificar intent.
* `inteligencias`: flags como `intencao_compra`, `sair`, sinais de suporte/objeção/agendamento; usadas em logs, lead capture e legado.
* `journeyStage`: consumido por sales layer, resposta contextual, update de lead e retorno JSON.
* `analiseEmocional`/personalidade: retornadas no JSON e usadas por IA/sistemas emocionais.
* `checkoutLink` e fontes: frontend widget, DB confirmado, extração, V18 fallback, WA-CTA promotion, env.
* `calendarHash`: saída/estado de scheduler retornado para widget/WhatsApp.
* `leadId`/lead existente: controla captura inline e ordem captura→agendamento no WhatsApp.
* Histórico/memória: V13/V14/persistent/learning memory/conversation-state.
* CTA candidates: `_intCta`, `checkoutCandidate`, `ctaCandidate` alimentam captura.
* Canal: widget/link curto/WhatsApp muda renderização, não a decisão central.

## 5. Todas as saídas do Decision Core

| Saída | Condição real de disparo | Prioridade | Consumidores |
|---|---|---|---|
| `response` | Sempre, após IA/intercepts/aplicações finais. | Final. | Widget, WhatsApp, API. |
| `cta` | V17.2 `shouldShowCTA(intent, safeLink)` ou legado CTA Engine; V19 pode remover/injetar checkout no texto. | Abaixo de bloqueios exit/support/objection/confusion; acima de captura visual. | Widget renderiza botão; WhatsApp injeta texto inline. |
| Checkout no texto | `buy`/`price`/buyer + checkout confiável; ou V18.x fallback legado. | Bloqueado por support/exit/hesitating/confused e baixa confiança. | Usuário final, tracking de clique. |
| `leadCapture` | `FEATURE_CHAT_FIRST` + `evaluateCapture` score >= threshold e sem `leadId`. | Observer; não altera intent/CTA. No WhatsApp pode adiar scheduler. | Widget inline capture; WhatsApp pergunta textual. |
| `calendarHash` | Scheduler/intercept de agendamento ou resposta com `[CALENDAR_WIDGET]`. | Em WhatsApp só exibido após lead capturado ou se captura não foi pedida. | Widget calendário; WhatsApp URL `/agendar/{hash}`. |
| Handoff/suporte | Intenção support/human; intercept pré-KB ou channel resolver. | Bloqueia venda/CTA comercial. | Resposta final e canal. |
| Journey Stage | `journeyAnalyzer.analyzeJourneyStage`. | Metadado/CRM. | Lead system, analytics, WhatsApp audit, JSON. |
| Estados buyer | V16/V19 marcam/resetam buyer por conversa. | Influencia CTA futuro, mas reset em saída/suporte/objeção no V19. | V16/V19. |
| Auditoria V20/WA parity | Sempre que fluxo roda. | Não decisória. | Logs/auditoria. |

## 6. Matriz de prioridade

Regras reais consolidadas:

| Conflito | Vencedor real |
|---|---|
| Compra + Agendamento | Intercept de agendamento/scheduler pode retornar antes; se fluxo principal segue, compra/CTA só entra se não bloqueada e scheduler gera `calendarHash`. |
| Compra + Captura | Compra/CTA continua; Lead Capture é observer. No WhatsApp, se também houver scheduler e captura pendente, captura vem antes do link de agendamento. |
| Compra + CTA | Mesma intenção: CTA/checkout vence se há link confiável; V19 escolhe CTA direto para `buy`. |
| Agendamento + Captura | No WhatsApp, captura vence temporariamente e agenda é adiada até lead capturado ou sem `shouldCapture`. |
| Suporte + CTA | Suporte vence; V19 `support`/stage `support` bloqueia sell/CTA/checkout; Channel Resolver não altera checkout. |
| Goodbye/Exit + CTA | Exit vence; V19 `exit`/stage `exiting` bloqueia sell/CTA/checkout e remove CTA. |
| Goodbye/Exit + Scheduler | Exit tende a bloquear venda; scheduler só aparece se intercept específico já retornou antes. Não há regra global encontrada de exit + scheduler vencendo. |
| Objeção + Compra | V19 prioriza `objection` acima de `buy` quando ambos aparecem; responde objeção antes de vender. |
| Baixa confiança + Compra | V19 permite sell/CTA por intent, mas não injeta checkout se confiança < 0.3 ou sem checkout. |
| Pós-venda + CTA | Orchestrator legado define pós-venda como matador de CTA/Closing/Venda. |

## 7. Relação com Intent Detection

Intents consumidas confirmadas:

* `decision-core.js`: `checkout_issue`, `human`, `objection`, `post_sale`, `buy`, `info`, `interest`, `stress`, `neutral`.
* V19: `exit`, `support`, `objection`, `buy`, `price`, `confusion`, `neutral`, com prioridade `exit/support > objection > buy > price > confusion` e fallback em `v17Intent` só quando neutro.
* V13: `READY_TO_BUY`, `INTEREST`, `DOUBT` alimentam Lead Capture Score.
* V17.2 Link Resolver: `detectIntent(message)` decide se CTA pode ser exposto.

Impacto: `buy`/`price` autorizam venda; `exit`, `support`, `objection`, `confusion`, `human`, `stress`, `neutral` bloqueiam ou reduzem CTA/checkout conforme motor. `post_sale` ativa suporte e bloqueia venda no Orchestrator legado.

## 8. Relação com Journey Stage

`journeyStage` é produzido no fluxo principal por `journeyAnalyzer.analyzeJourneyStage(message)`, persistido no lead e retornado. Stages observados no código e documentação interna incluem `descoberta`, `consideracao/consideração`, `decisao/decisão`, `negociacao`, `objecao`, `suporte`, `checkout`, `agendamento` e `fidelizacao`.

Impactos reais:

* Sales Layer ajusta pressão/copy/closing conforme stage.
* Orchestrator e V19 usam estado/stage interno para bloquear venda em saída/suporte/hesitação/confusão.
* Scheduler retorna `journeyStage: agendamento` em caminho prioritário.
* Support intercept retorna `journeyStage: suporte`.
* Checkout intercept retorna `journeyStage: checkout`.

## 9. Relação com CTA Engine

CTA é autorizado quando há intenção comercial, link seguro/válido e nenhum bloqueio superior. No legado, CTA Engine coleta um CTA contextual, mas Orchestrator V10 pode impedir aplicação inline e decidir no fim. V18.2/V18.3 podem forçar CTA quando há checkout + buy intent, exceto com V19 ativo. V17.2 remove CTA textual antigo e só expõe `cta` se `shouldShowCTA(intent, safeLink)` for verdadeiro. V19, quando ativo, é quem decide `allowCTA` e `allowCheckout` e remove CTA se `allowSell=false`.

CTA é bloqueado por: modo manual/off, intents/stages de saída, suporte, objeção/hesitação, confusão, dados sem checkout, baixa confiança e CTA sem URL.

## 10. Relação com Lead Capture

Captura é autorizada por `FEATURE_CHAT_FIRST` e `lead-capture-score.js`, não por contagem simples de mensagens. O score consome intents do decision-core, V13, perguntas comerciais, clique/candidato CTA, candidato checkout e `inteligencias.intencao_compra`. Threshold real: `CAPTURE_THRESHOLD = 50`.

Captura é bloqueada quando sessão já foi capturada/dispensada, quando não há `conversationId`, ou no endpoint quando já existe `leadId` no body. No WhatsApp, captura é traduzida para pergunta textual e pode adiar agendamento.

## 11. Relação com Scheduler

Scheduler ganha prioridade quando há intercept/caminho de agendamento que gera `calendarHash` e retorna `journeyStage: agendamento`, ou quando a resposta contém `[CALENDAR_WIDGET]` e o fluxo principal injeta `mainFlowCalendarHash`. No widget, `calendarHash` renderiza calendário. No WhatsApp, `calendarHash` vira URL `/agendar/{hash}`.

Scheduler perde prioridade no WhatsApp quando `leadCapture.shouldCapture=true` e o lead ainda não tem dados; a ordem implementada é captura primeiro, agendamento depois. Também perde para bloqueios prévios se a rota retorna suporte/checkout antes ou se não há calendário configurado.

## 12. Relação com Observer Layer

Sinais observados:

* V20 audit: mensagem, conversationId, leadId, `inteligencias`, bypass legado esperado, resposta final preview.
* Lead Capture Score: intents, V13, CTA/checkout candidates, mensagens, inteligências.
* WA Parity Audit: journeyStage, intentDetected, leadScore, cta/capture/schedule triggered.

Sinais consumidos: `inteligencias`, `journeyStage`, `leadCapture.score`, `calendarHash`, CTA. Feedback loops: learning memory salva sucesso/falha, conversation state mantém buyer/estado, lead system atualiza histórico e journey stage.

## 13. Link Curto

Link Curto (`/l/:shortCode`) resolve `short_urls`, cacheia, incrementa acesso, carrega whitelabel e redireciona para `/chatbot` com `apiKey`, `robotName`, `sales_url` e instruções. Particularidade: o Link Curto é o canal base do pipeline central; WhatsApp busca paridade com ele. O comportamento decisório não é próprio do short URL: ele fornece tenant/contexto e usa o mesmo `/chatbot`/chat inteligente.

## 14. Widget

O widget detecta checkout na página, envia `pageData.checkoutLink`, renderiza links como CTAs clicáveis, rastreia cliques, exibe captura inline quando `leadCapture.shouldCapture=true` e renderiza calendário quando recebe `calendarHash`. Particularidade: o widget pode converter URLs da resposta em botões, então o backend também remove/injeta CTA para evitar botão comercial indevido.

## 15. WhatsApp

WhatsApp é explicitamente canal puro de transporte. Ele consome o pipeline central, adapta resposta para WhatsApp, injeta CTA como texto se o JSON trouxer `cta.url`, traduz `leadCapture` em pergunta e traduz `calendarHash` em URL. Não deve criar lógica própria de captura, agendamento ou CTA. Regra específica: não injeta link de WhatsApp de contato porque o usuário já está no WhatsApp.

## 16. Árvore de decisão global

```text
Mensagem recebida
├─ Resolver tenant/apiKey/canal/lead/conversationId
├─ Extrair/enriquecer pageData
│  ├─ checkoutLink presente?
│  ├─ whatsappLink/contatos presentes?
│  └─ V18 guard: ok/partial/failed + fallback opcional
├─ Intercepts prioritários pré-KB
│  ├─ agendamento → response + calendarHash + journeyStage=agendamento
│  ├─ suporte/humano → handoff/suporte + bloqueio venda
│  └─ checkout direto → response/checkout + journeyStage=checkout
├─ Geração IA / contexto / memória
├─ Intent/Journey
│  ├─ decision-core/V13/V17/regex legado
│  ├─ journeyAnalyzer
│  └─ V19 resolveIntent + resolveState se ativo/shadow
├─ Bloqueios
│  ├─ mode manual/off → sem interferência
│  ├─ exit/support → sem sell/CTA/checkout
│  ├─ objection/confusion/hesitating → sem checkout
│  └─ confidence < 0.3/sem link → sem checkout
├─ Autorizações
│  ├─ buy/price/buyer + confiança/link → CTA/checkout
│  ├─ interest → CTA soft legado se sem decisão forte
│  └─ support → canal acionável, não venda
├─ Aplicação final
│  ├─ V19 ativo: applyDecision remove/injeta/corrige
│  └─ Legado: Orchestrator + V18.x + PP-GLOBAL + V17.2
├─ Observers
│  ├─ V20 audit
│  ├─ Lead Capture Score
│  └─ WA parity/analytics
└─ JSON final: response, cta, calendarHash, inteligencias, emoção, journeyStage, leadCapture
```

## 17. Dependências ocultas

* `server.js` é o integrador real e contém múltiplas decisões de última milha, mesmo com módulos separados.
* A ordem de execução é uma dependência invisível: intercepts pré-KB podem retornar antes de Orchestrator/V19; V18.x e PP-GLOBAL são bypassados somente se V19 ativo.
* `pageData.checkoutLink` pode vir de widget, DB confirmado, extração, fallback V18 ou WA-CTA promotion; consumidores tratam como dado único.
* `calendarHash` pode vir de caminho prioritário ou ser injetado por marcador `[CALENDAR_WIDGET]` no fluxo principal.
* `leadCapture` é “observer only” no backend, mas no WhatsApp altera a entrega ao adiar scheduler.
* `conversationId` é chave para buyer state, anti-repetição CTA, lead capture session e memória; mudanças nesse valor mudam decisões.
* CTA pode existir como texto na resposta, como objeto `cta` no JSON ou como URL renderizada pelo widget.

## 18. Mapa de risco

| Componente | Risco | Motivo |
|---|---:|---|
| `server.js` | ALTO | Orquestra ordem final, intercepts, V18/V19, CTA, capture, scheduler e resposta JSON. |
| `lib/v19-deterministic-engine.js` | ALTO | Autoridade única quando ativada; remove/injeta checkout. |
| `lib/orchestrator.js` | ALTO | Decisão final legada com hierarquia de bloqueio/venda. |
| `lib/v17-link-resolver.js` | ALTO | Trava CTA final e objeto `cta`. |
| `lib/v18-extraction-guard.js` | MÉDIO | Afeta confiança e disponibilidade de checkout/WhatsApp. |
| `lib/decision-core.js` | MÉDIO | Classificação base usada por captura e legado. |
| `lib/v16-decision-engine.js` | MÉDIO | Buyer state e overrides quando flagado. |
| `lib/lead-capture-score.js` | MÉDIO | Captura inline e ordem com scheduler no WhatsApp. |
| `whatsapp-channel.js` | MÉDIO | Tradução canal; pode mudar percepção de CTA/captura/scheduler. |
| `public/widget.js` | MÉDIO | Renderização final de CTA, captura e calendário. |
| `sales/cta-engine.js` | MÉDIO | CTA contextual e anti-repetição. |
| `sales/sales-layer.js` | MÉDIO | Pressão/closing por stage no legado. |
| `lib/feature-flags.js` | ALTO | Liga/desliga autoridade V17/V18/V19/Chat First. |
| `lib/leads/lead-capture.js` | BAIXO/MÉDIO | Persistência e stage do lead; não decide venda diretamente. |
| `short-url-generator.js` e rotas `/l` | BAIXO | Resolver canal/tenant; não decide comercialmente. |

## 19. Histórico de regressões

Evidências encontradas em código/testes/docs:

* V10.1 substitui regex fraco onde “link” virava compra; regra de ouro limita checkout a `buy`.
* Orchestrator V10.1 documenta hierarquia para eliminar conflitos entre CTA, Closing, Decision Core e Sales Layer.
* V16.2 existe como “anti-perda de venda” com buyer state e fallback para V13.
* V18.2/V18.3/V18.4 aparecem como fixes de CTA forçado/fallback quando checkout não sai.
* V19 declara substituir conflitos V18.1/V18.2/V18.3/V18.4/PP-GLOBAL/IS_BUYER sticky.
* Testes `tests/test-decision-core.js`, `tests/test-v16-complete.js`, `tests/test-v18-guard.js`, `tests/test-v93-full-checklist.js`, `tests/test-wa-cta-promoter.js`, `tests/test-v174-gjg.js` cobrem regressões de checkout, CTA, extração, widget/page e WhatsApp.
* WhatsApp V21 tem patch de paridade com Link Curto e remove injeção de link WhatsApp de contato para evitar conflito cognitivo.

## 20. Matriz de propriedade

| Decisão | Dono real primário | Donos condicionais/consumidores |
|---|---|---|
| CTA | V19 quando ativo; senão V17.2 Link Resolver + Orchestrator/CTA Engine. | Widget e WhatsApp renderizam/traduzem. |
| Checkout | V19 quando ativo; senão Orchestrator/V18.x/PP-GLOBAL/V17.2. | V18 fornece confiança/fallback; widget envia link. |
| Lead Capture | `lib/lead-capture-score.js` decide `shouldCapture`; `lib/leads/lead-capture.js` persiste. | Widget/WhatsApp executam UI/texto. |
| Scheduler | `server.js`/scheduling manager gera `calendarHash`. | Widget renderiza; WhatsApp traduz para URL. |
| Handoff | Support intercept/Channel Resolver Safe/WhatsApp transport. | Lead system e resposta final. |
| Journey Stage | Journey Analyzer no fluxo principal. | Lead system, Sales Layer, auditoria. |
| Intent Detection | V19 se ativo; senão decision-core/V13/V17/regex legado por camada. | CTA, Lead Capture, Orchestrator, Sales Layer. |

## 21. Matriz global de decisões

| Evento | Sinal recebido | Decisão tomada | Componente responsável | Prioridade |
|---|---|---|---|---|
| “quero comprar” | `buy` + checkout | Injetar CTA/checkout direto | V19/Orchestrator | Alta |
| “quanto custa” | `price` + checkout | CTA sutil/condições | V19 | Média/alta |
| “tchau” | `exit` | Bloquear venda/CTA | V19 | Absoluta |
| “falar com atendente” | `support`/`human` | Handoff/suporte, sem checkout | V19/Channel Resolver | Absoluta |
| “isso é golpe?” | `objection` | Responder objeção, sem checkout | V19/Orchestrator | Alta |
| “não entendi nada” | `confusion` | Explicar, sem checkout | V19 | Alta |
| “já comprei” | `post_sale` | Suporte/pós-venda, mata CTA | decision-core/Orchestrator | Alta |
| “link errado” | `checkout_issue` | Reenviar/corrigir link | decision-core/Orchestrator | Alta |
| Checkout sem URL | CTA textual inválido | Corrigir com URL ou remover | V19 applyDecision | Alta |
| Checkout com baixa confiança | `_extractionGuard=failed/partial` | Não injetar se confiança < 0.3 | V19 + V18 | Alta |
| Sem checkout, WhatsApp conversão | WA score >= 0.6 | Promover WA como CTA | WA CTA Promoter | Média |
| `leadCapture.score>=50` | Sinais comerciais | Pedir contato inline | Lead Capture Score | Média |
| `leadId` presente | Lead já existe | Não disparar captura inline | server.js/Lead Capture | Alta |
| `calendarHash` presente | Agendamento | Renderizar calendário/URL | Scheduler + Widget/WA | Alta |
| `leadCapture` + `calendarHash` no WA | Captura pendente | Adiar agendamento | WhatsApp Channel | Alta |
| `FEATURE_DETERMINISTIC_V19=shadow` | V19 paralelo | Log diff, não aplica | V19/server.js | Observação |
| `salesMode=manual/off` | modo não auto | Bypass interferência | V19/Orchestrator | Absoluta |
| CTA Engine gera soft CTA | interest/contexto | Orchestrator pode permitir se sem decisão forte | CTA Engine/Orchestrator | Baixa/média |
| Resposta IA genérica | Padrões genéricos | Remover/ajustar | V19 applyDecision/self-healing | Média |
| Link interno/autorreferência | domínio bloqueado | Bloquear checkout | V16/safe resolvers | Alta |
| Short URL acessado | `shortCode` | Resolver tenant/contexto | server.js `/l/:shortCode` | Pré-decisão |
| Widget envia checkout | `pageData.checkoutLink` | Usar como candidato principal | server/V18/V19 | Alta |
| DB checkout confirmado | tenant checkout | Injetar se ausente no diagnóstico/fluxo | server/link resolver | Alta |
| V20 flags detectadas | wouldBypassLegacy | Auditar, não interceptar | V20 audit | Observação |

## 22. Mapa de consumo

| Sinal | Produz | Consome | Modifica | Persiste | Executa |
|---|---|---|---|---|---|
| `message` | Canal/widget/WA | Todos os detectores | Normalizadores | Histórico lead/memória | server.js |
| `intent` | decision-core/V13/V17/V19 | CTA, Orchestrator, Lead Capture | V19 fallback/state | Logs/memória | Decision engines |
| `journeyStage` | Journey Analyzer | Sales Layer, lead system, WA audit | Lead system update | Lead | server.js |
| `checkoutLink` | Widget/extractor/DB/V18/WA promoter | V19, Orchestrator, CTA, widget | V18 fallback/PP-GLOBAL | checkout DB/cache/log | V19/apply/renderer |
| `whatsappLink` | extractor/pageData | Channel resolver, WA promoter | WA promoter pode promover como checkoutLink | pageData/log | CTA/contato |
| `_extractionGuard` | V18 | V19 data confidence | não sobrescreve pageData base | pageData runtime | V19 |
| `cta` | V17.2/CTA Engine | Widget/WhatsApp | V19 pode remover texto; V17.2 monta objeto | analytics clicks | UI/canal |
| `leadCapture` | Lead Capture Score | Widget/WhatsApp | Widget/WA executam capture | Lead system | UI/texto |
| `calendarHash` | Scheduler | Widget/WhatsApp | WA converte para URL | Agendamento | Calendário/URL |
| `conversationId` | cliente/server | state/memória/capture/CTA | nenhum | estado/memória | todas camadas |
| `inteligencias` | super inteligência/regex | Lead Capture, V20, retorno | nenhum | logs | observers |

## 23. Decision Core real vs documentação

| Comportamento documentado no código | Comportamento encontrado |
|---|---|
| V19 é autoridade única quando ativo. | Verdadeiro apenas com `FEATURE_DETERMINISTIC_V19=true`; em `false/shadow`, legado segue decidindo. |
| WhatsApp não decide. | Confirmado: canal traduz sinais do pipeline central. |
| V18 é aditivo e não sobrescreve dados existentes. | Confirmado por descrição e testes; fallback só preenche ausentes quando flagado. |
| Lead Capture é observer only. | Backend não altera resposta principal, mas canal WhatsApp muda entrega ao acrescentar pergunta/adicionar ordem captura→agenda. |
| CTA só com intenção certa + link válido. | Confirmado em V17.2/V19; legado V18.x contém força de CTA quando V19 não ativo. |
| Orchestrator é camada única final. | Verdadeiro no legado com flag; na prática há camadas posteriores como V18.3/V18.4/PP-GLOBAL/V17.2/V19 dependendo flags. |

## 24. Arquivos críticos

| Classe | Arquivos | Motivo |
|---|---|---|
| CRÍTICO ABSOLUTO | `server.js`, `lib/v19-deterministic-engine.js`, `lib/feature-flags.js` | Orquestração final, autoridade única e ativação de versões. |
| CRÍTICO | `lib/orchestrator.js`, `lib/v17-link-resolver.js`, `lib/v18-extraction-guard.js`, `lib/lead-capture-score.js`, `whatsapp-channel.js`, `public/widget.js` | Afetam CTA/checkout/captura/scheduler/renderização. |
| IMPORTANTE | `lib/decision-core.js`, `lib/v16-decision-engine.js`, `lib/v17-orchestrator.js`, `sales/cta-engine.js`, `sales/sales-layer.js`, `lib/channel-resolver-safe.js`, `lib/wa-cta-promoter.js` | Decisões ou enriquecimentos comerciais condicionais. |
| SUPORTE | `lib/leads/lead-capture.js`, `lib/persistent-memory.js`, `lib/learning-memory.js`, `lib/conversation-state.js`, `short-url-generator.js`, `routes.js`, `whatsapp-routes.js` | Persistência, memória, rotas e resolução de canal/tenant. |

## 25. Conclusão executiva

O Decision Core real do Link Mágico é uma **pilha versionada de decisão determinística**, não um único arquivo. A decisão comercial mais forte e explícita está em `lib/v19-deterministic-engine.js` quando `FEATURE_DETERMINISTIC_V19=true`; nesse modo, V19 resolve intent, estado e confiança dos dados, define `allowSell`, `allowCTA` e `allowCheckout`, e aplica a resposta final removendo ou injetando checkout. Quando V19 não está ativo, a decisão final é composta pela ordem do `server.js`: intercepts, IA, CTA Engine, Orchestrator V10, V18.x/PP-GLOBAL, V17.2 Link Resolver, observer de captura e retorno JSON.

A decisão final do sistema, portanto, está **no ponto de aplicação final da resposta**: V19 `applyDecision()` se ativo; caso contrário, no pipeline final do `server.js` com Orchestrator/V18/PP-GLOBAL/V17.2. Os módulos que dependem desse núcleo são Widget, Link Curto, WhatsApp, Lead Capture, Scheduler, Sales Layer, CTA Engine, memória/analytics e CRM/lead system.

Arquivos que nunca devem ser alterados sem auditoria: `server.js`, `lib/v19-deterministic-engine.js`, `lib/feature-flags.js`, `lib/orchestrator.js`, `lib/v17-link-resolver.js`, `lib/v18-extraction-guard.js`, `lib/lead-capture-score.js`, `whatsapp-channel.js` e `public/widget.js`.

Alterações que exigem relatório de impacto obrigatório: qualquer mudança em prioridades de intent, bloqueios de CTA/checkout, fontes de `checkoutLink`, confiança V18, feature flags V17/V18/V19/Chat First, ordem de intercepts no `server.js`, contrato JSON (`cta`, `calendarHash`, `leadCapture`, `journeyStage`), renderização do widget e tradução do WhatsApp.
