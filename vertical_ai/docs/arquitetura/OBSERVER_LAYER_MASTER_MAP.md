# OBSERVER_LAYER_MASTER_MAP — Link Mágico

Documento baseado exclusivamente no código presente neste repositório.

## 1. Visão geral

O “Observer Layer” não aparece como uma classe única chamada `ObserverLayer`. No código real ele é um conjunto distribuído de módulos e pontos de instrumentação que observam a conversa, intenções, estágio da jornada, CTAs, captura de lead, agendamento e conversões. O núcleo observável é o Auto-Learning/Conversation Tracker, complementado por logs de auditoria, telemetria V20, score de captura e auditoria/paridade do WhatsApp.

Objetivo comercial: medir e preservar sinais de conversão — clique, WhatsApp, agendamento e lead enviado — para aprender quais mensagens, intenções, stages e CTAs convertem melhor.

Objetivo técnico: coletar dados de forma “fire-and-forget”, com fallback silencioso, sem bloquear resposta da IA; persistir em banco quando disponível e em JSON como fallback; expor eventos por `/api/track-event`.

Papel na arquitetura V20: a camada observa o pipeline central sem substituir o LLM. Há auditoria explícita de bypass legado versus execução V20, logs de pipeline e retornos estruturados com `journeyStage`, `cta`, `leadCapture` e `calendarHash`.

Relações:
- Journey Stage: estágio é calculado por `JourneyAnalyzer` e gravado nos registros do tracker.
- Intent Detection: intenções alimentam otimização, captura e auditoria.
- CTA Engine: CTA é gerado/aplicado sob feature flag e observado por heurísticas, retorno JSON e eventos de conversão.
- Lead Capture: score observa sinais e decide `shouldCapture`; tracker observa `lead_submitted`.
- Scheduler: `calendarHash` sinaliza agendamento; tracker observa `schedule_created`.

## 2. Inventário completo relacionado ao Observer Layer

| Arquivo | Classes/funções/módulos | Responsabilidade | Dependências |
|---|---|---|---|
| `analytics/conversation-tracker.js` | `ConversationTracker`, `record`, `updateAction`, `getConvertedRecords`, `getStats` | Coleta passiva de interações, detecta CTA/links em respostas, atualiza ações de conversão. | `fs`, `path`, `crypto`, DB adapter opcional. |
| `analytics/index.js` | `recordInteraction`, `trackConversion`, `optimizeResponse`, `getSystemStats` | Orquestra tracker, performance, memória e optimizer; mapeia eventos externos para ações internas. | `conversation-tracker`, `performance-engine`, `memory-store`, `learning-optimizer`, `database`, `db-adapter`. |
| `analytics/performance-engine.js` | Performance Engine | Processa registros e padrões para aprendizado. | Tracker/memory via `analytics/index.js`, DB adapter. |
| `analytics/memory-store.js` | Memory Store | Armazena padrões aprendidos. | DB adapter/fallback JSON. |
| `analytics/learning-optimizer.js` | Learning Optimizer | Pode enriquecer resposta com padrões aprendidos. | Dados do memory store. |
| `analytics/db-adapter.js` | `LearningDbAdapter` | Persistência em DB dos dados de aprendizado. | `database`. |
| `lib/lead-capture-score.js` | `evaluateCapture`, `markCaptured`, `markDismissed`, `getScore` | Observa sinais comportamentais e decide captura. | Intenções de decision-core/V13, CTA candidates, checkout candidates, regex comerciais. |
| `lib/v13-intent-classifier.js` | `classifyIntent` | Classificador determinístico de intenção. | Regex internos. |
| `modules/leads/journey-analyzer.js` | `JourneyAnalyzer` | Classifica stage `descoberta`, `negociacao`, `fidelizacao`. | Keywords internas. |
| `lib/ai-systems/journey-analyzer.js` | `JourneyAnalyzer`, `capturarInteligencias`, `gerarRespostaContextual` | Versão de jornada/inteligências usada por sistemas de IA. | Keywords internas. |
| `sales/cta-engine.js` | `getCTA`, `applyCTA`, `mapToCtaIntent` | Seleciona/aplica CTA contextual e mantém anti-repetição por conversa. | `FEATURE_SMART_CTA`, contexto de página/WhatsApp. |
| `server.js` | Feature flags, pipeline V20, `/api/track-event`, logs `PIPELINE-DIAG`, `AUDIT-LLM-BYPASS-V20` | Integra observação no fluxo HTTP principal. | `analytics/index`, `lead-capture-score`, `cta-engine`, `schedulingManager`, feature flags. |
| `whatsapp-channel.js` | Tradução WA de `leadCapture` e `calendarHash`, `waParityAudit.log` | Observa/paritiza saída do pipeline para WhatsApp sem decidir regras próprias. | Pipeline central, lead system, WA provider, `wa-parity-audit`. |
| `public/widget.js` | captura `calendarHash`, renderização calendário, envio de chat | Canal widget consome sinais do pipeline. | `/api/process-chat-inteligente`, `/api/availability`, DOM. |
| `public/widget-v2.js` | captura `calendarHash` e fallback hash | Widget V2 consome sinal de calendário. | API chat/availability. |
| `public/widget-inline-generator.js` | geração inline com `calendarHash` | Versão inline do widget. | Config do tenant/API. |
| `short-url-generator.js` | geração de link curto | Componente de entrada/roteamento de links curtos; não contém observer explícito encontrado. | Storage/colisão de código. |
| `whatsapp-integration.js`, `whatsapp-routes.js` | Integração/rotas WA | Canal de mensagens; observer efetivo aparece em `whatsapp-channel.js`. | Providers WA e rotas Express. |
| `lib/feature-flags.js` | `FEATURE_AUTO_LEARNING` | Catálogo de feature flags. | Ambiente/config. |

Middlewares específicos chamados “observer” não foram encontrados. Feature flags observadas: `FEATURE_AUTO_LEARNING`, `DEBUG_LEARNING`, `AUTO_LEARNING_TEST_MODE`, `FEATURE_SMART_CTA`, `FEATURE_ORCHESTRATOR_V10`, `FEATURE_CONTEXT_LOCK`.

## 3. Fluxo completo real

Fluxo principal observado:

1. Mensagem chega em endpoint do servidor ou canal WhatsApp/widget.
2. Intent Detection gera `inteligencias` e/ou decision intent/V13.
3. Journey Stage é calculado por `journeyAnalyzer.analyzeJourneyStage`.
4. Observer distribuído registra logs diagnósticos, Auto-Learning, lead score e auditorias.
5. CTA Engine pode coletar/aplicar CTA quando `FEATURE_SMART_CTA=true`.
6. Lead Capture Score avalia sinais e retorna `leadCapture` no JSON.
7. Scheduler gera `calendarHash` quando há caminho de agendamento ou marcador de calendário.
8. Resposta retorna com `response`, `cta`, `calendarHash`, `inteligenciasDetectadas`, `journeyStage`, `leadCapture`.

## 4. Eventos observados

Eventos externos aceitos por `/api/track-event`:

| Evento | Origem | Consumidor | Finalidade |
|---|---|---|---|
| `click_link` | Frontend/widget/canal cliente | `analytics.trackConversion` → `ConversationTracker.updateAction(clicked)` | Conversão por clique. |
| `open_whatsapp` | Frontend/widget/canal cliente | `analytics.trackConversion` → `whatsappOpened` | Conversão para WhatsApp. |
| `schedule_created` | Frontend/scheduler | `analytics.trackConversion` → `scheduled` | Conversão por agendamento. |
| `lead_submitted` | Frontend/formulário lead | `analytics.trackConversion` → `leadCaptured` | Conversão por lead capturado. |

Eventos/sinais internos observados:
- Interação registrada: `recordInteraction` com `detectedIntent`, `journeyStage`, `emotionalState`, `robotName`.
- CTA presente: `_detectCTA` e retorno `cta`.
- Lead capture triggered: `leadCapture.shouldCapture`.
- Scheduler triggered: presença de `calendarHash`.
- Goodbye/despedida: `lead-capture-score` bloqueia captura em mensagens de despedida.
- Handoff/support: intenção `SUPPORT`/`human` pontua captura e orienta CTA/contato.

## 5. Decisões observadas

O Observer não é apenas passivo em todos os pontos. O Auto-Learning/Tracker é passivo e não bloqueia. Porém o conjunto Observer inclui módulos que tomam decisões:

- `lead-capture-score.evaluateCapture` decide `shouldCapture`, `captureMessage`, `captureContext` e altera estado de sessão (`score`, `signals`, `captureShown`).
- `analytics.optimizeResponse` pode modificar `finalResponse` com dados aprendidos, preservando fallback para original.
- `cta-engine.applyCTA` pode modificar a resposta adicionando CTA.
- `whatsapp-channel.js` não decide regra de captura/agendamento; traduz sinais do pipeline para texto/URL e pode adiar agendamento até haver lead.
- Bloqueios: captura não dispara em goodbye; captura não repete se `captured`, `dismissed` ou `captureShown`; CTA soft não é adicionado se já existe CTA forte.

## 6. Relação com Intent Detection

Intenções V13 observadas: `READY_TO_BUY`, `INTEREST`, `DOUBT`, `OBJECTION`, `SUPPORT`, `GREETING`, `GENERIC`.

Intenções/sinais de pipeline observados no score: `buy`, `interest`, `info`, `human`, `post_sale`, `objection`, além de flags de `inteligencias` como `intencao_compra`, `objecao`, `curioso`, `sair`, `comparacao`, `suporte` nos logs V20.

Métricas/efeitos: geração de score, signals, contexto de captura, otimização de resposta, auditoria comparativa e agrupamento de performance por intenção.

## 7. Relação com Journey Stage

Stages reais encontrados: `descoberta`, `negociacao`, `fidelizacao`; no caminho scheduler também retorna `journeyStage: 'agendamento'`.

Uso: stage entra no prompt/resposta, no tracker, no Auto-Learning optimizer e no retorno JSON. Impacto comercial: segmenta descoberta/educação, negociação/preço-compra e fidelização/suporte.

## 8. Relação com CTA Engine

Eventos/regras reais:
- `getCTA` mapeia intenção/ação para `ready_to_buy`, `interest`, `objection`, `hesitation`, `exit`, `curiosity`.
- Anti-repetição por `conversationId` evita CTA repetido.
- `applyCTA` enriquece resposta se não houver duplicação.
- Compra: CTA de compra usa URL de contexto ou WhatsApp se disponível para `ready_to_buy`/`hesitation`.
- Conversão de CTA é observada por `click_link`; WhatsApp por `open_whatsapp`.
- Abandono aparece como intenção/CTA `exit` e sinal `sair` em auditoria, não como evento externo separado.

## 9. Relação com Lead Capture

Captura disparada quando score alcança 50 ou há `buy`, `READY_TO_BUY`, `checkoutCandidate` ou `ctaCandidate`, exceto goodbye e exceto se já exibida/capturada/dispensada.

Captura ignorada quando: sem `conversationId`, sessão já `captured`/`dismissed`, mensagem de despedida, `captureShown` já true, score insuficiente sem gatilho forte.

Score observado: tabela inclui intenções, tópicos comerciais, CTA click, checkout/CTA candidate, quantidade de mensagens e detecção de compra.

Dependências: decision-core, V13 intent classifier, CTA candidates, checkout candidates, regex comerciais e `inteligencias`.

## 10. Relação com Scheduler

Eventos e sinais:
- `calendarHash` é gerado por `schedulingManager.generatePublicHash(apiKey)`.
- Retorno com `[CALENDAR_WIDGET]` injeta `calendarHash` no fluxo principal.
- Caminho `SCHED-PRIORITY` retorna `journeyStage: 'agendamento'` e `calendarHash`.
- Evento de conversão externo: `schedule_created`.
- WhatsApp traduz `calendarHash` para `/agendar/{calendarHash}` e adia se captura ainda precisa acontecer.

`Scheduler priority` existe como bypass auditado `SCHED-PRIORITY` no servidor.

## 11. Observabilidade V20

Dados produzidos:
- Logs de carga de módulos e feature flags em `server.js`.
- `PIPELINE-DIAG` com mensagem, lead, conversationId, intent, journey, CTA e resposta.
- `AUDIT-LLM-BYPASS-V20` compara bypass legado com execução V20.
- Auto-Learning stats via `getSystemStats`.
- Conversation records com CTA, links, intent, stage, emoção e ações.
- WhatsApp parity audit com channel, leadScore, ctaTriggered, captureTriggered, scheduleTriggered.

## 12. Link Curto

O código localizado para link curto (`short-url-generator.js`) gera códigos e trata colisões, mas não contém integração explícita com Auto-Learning ou eventos observer. Nos comentários do WhatsApp, “Link Curto” é referência ao pipeline central que retorna `leadCapture` e `calendarHash`; o WhatsApp traduz o que o Link Curto decidiu.

Diferença encontrada: Link Curto/widget renderiza calendário; WhatsApp converte `calendarHash` em URL clicável.

## 13. Widget

Widget consome `calendarHash`, renderiza calendário e armazena hash recebido do servidor. O widget também é origem provável dos eventos `/api/track-event`, embora o endpoint aceite eventos de qualquer frontend/canal.

Diferenças encontradas: `public/widget.js`, `public/widget-v2.js` e `public/widget-inline-generator.js` têm lógicas de fallback para obter/derivar `calendarHash` quando a resposta contém calendário.

## 14. WhatsApp

WhatsApp usa o pipeline central. Ele observa `leadCapture.shouldCapture`, `calendarHash`, `cta`, `journeyStage` e registra auditoria de paridade. O canal declara explicitamente que não decide; traduz captura para texto e agendamento para URL. Pode adiar scheduler quando captura precisa vir antes.

## 15. Matriz global de eventos

| Evento/sinal | Origem | Consumidor | Impacto comercial | Arquivo responsável |
|---|---|---|---|---|
| `recordInteraction` | Pipeline pós-resposta | Auto-Learning | Base de aprendizado de conversas | `server.js`, `analytics/index.js` |
| `click_link` | Frontend/canal | Tracker | Mede clique CTA/link | `server.js`, `analytics/index.js` |
| `open_whatsapp` | Frontend/canal | Tracker | Mede handoff WhatsApp | `server.js`, `analytics/index.js` |
| `schedule_created` | Scheduler/frontend | Tracker | Mede reunião criada | `server.js`, `analytics/index.js` |
| `lead_submitted` | Formulário lead | Tracker | Mede lead capturado | `server.js`, `analytics/index.js` |
| `leadCapture.shouldCapture` | Lead score | Widget/WA/resposta JSON | Dispara pedido de contato | `lib/lead-capture-score.js`, `server.js` |
| `calendarHash` | Scheduler | Widget/WA | Agenda reunião | `server.js`, `whatsapp-channel.js` |
| CTA coletado/aplicado | CTA Engine | Orchestrator/resposta | Empurra conversão | `sales/cta-engine.js`, `server.js` |
| Goodbye detectado | Regex lead score | Lead capture | Evita captura inadequada | `lib/lead-capture-score.js` |
| `AUDIT-LLM-BYPASS-V20` | Pipeline V20 | Logs/auditoria | Rastreia regressão de bypass | `server.js` |
| WA parity audit | WhatsApp | Auditoria | Compara canal WA e Link Curto | `whatsapp-channel.js` |

## 16. Dependências ocultas

- Auto-Learning depende de variáveis de ambiente configuradas em runtime antes do `require`.
- `analytics/index.js` importa `database` via `setImmediate`, criando dependência assíncrona e fallback JSON.
- Lead capture depende de `_intCta` e `processedPageData.checkoutLink`, mesmo sendo descrito como observer-only no ponto de chamada.
- WhatsApp depende de semântica do pipeline central (`leadCapture`, `calendarHash`) e não de tipos formais.
- `calendarHash` depende de `schedulingManager` global disponível.
- `conversationId` é chave comum para tracker, lead score e eventos; ausência quebra rastreio/captura por sessão.

## 17. Mapa de risco

| Componente | Risco | Motivo |
|---|---|---|
| `server.js` pipeline V20 | ALTO | Integra intent, CTA, lead capture, scheduler, tracking e auditoria. |
| `lib/lead-capture-score.js` | ALTO | Toma decisão de captura e modifica estado por sessão. |
| `analytics/index.js` | ALTO | Orquestra tracker/optimizer/conversões e persistência. |
| `analytics/conversation-tracker.js` | MÉDIO | Passivo, mas chave para métricas e conversão. |
| `sales/cta-engine.js` | MÉDIO | Pode modificar resposta e influenciar conversão. |
| `whatsapp-channel.js` | MÉDIO | Tradução canal-específica pode alterar ordem captura/agendamento. |
| Widgets públicos | MÉDIO | Consomem `calendarHash` e eventos de frontend. |
| `modules/leads/journey-analyzer.js` | BAIXO | Determinístico e isolado por keywords. |
| `lib/v13-intent-classifier.js` | MÉDIO | Determina intent para score e comportamento. |
| `short-url-generator.js` | BAIXO | Não contém observer explícito encontrado. |

## 18. Histórico de regressões

Evidências no código/comentários:
- CTA: `FEATURE_SMART_CTA`, Orchestrator V10 e checagem de CTA duplicado indicam regressões de CTA/oversell já consideradas.
- Lead Capture: comentários “OBSERVER ONLY — não altera resposta/intent/CTA” e guardas de goodbye/repetição indicam risco de interferência.
- Scheduler: patches `CALENDAR-001` e `CALENDAR-006` indicam regressão onde fluxo principal não retornava `calendarHash`.
- WhatsApp: V21 parity audit e comentários de tradução indicam conflitos de paridade com Link Curto.
- Widget: patches `CALENDAR-V2/V3/V4` indicam regressões de recepção/renderização de `calendarHash`.
- Link Curto: mencionado em WhatsApp como referência de decisão central para captura/agendamento.

## 19. Matriz de propriedade

| Evento/sinal | Dono lógico | Produz | Consome | Modifica | Persiste |
|---|---|---|---|---|---|
| Intent | Pipeline/intent modules | `sistemaInteligencias`, V13/decision core | Lead score, CTA, analytics | Não no observer | Logs/records |
| Journey Stage | JourneyAnalyzer | `journeyAnalyzer` | Analytics, resposta, lead system | Lead system pode atualizar lead | Lead JSON/Postgres, tracker |
| CTA | CTA Engine | `sales/cta-engine.js` | Resposta/orchestrator/tracker | `applyCTA` modifica resposta | Tracker como `hasCTA`/links |
| Lead Capture signal | Lead Capture Score | `evaluateCapture` | Widget/WA/cliente | Estado de sessão | Não diretamente; evento `lead_submitted` persiste ação |
| Lead submitted | Frontend/form | `/api/track-event` | Auto-Learning | Ação tracker | Tracker DB/JSON |
| Schedule signal | Scheduler | `calendarHash` | Widget/WA | WA traduz para URL | Evento `schedule_created` no tracker |
| WhatsApp open | Frontend/canal | `/api/track-event` | Auto-Learning | Ação tracker | Tracker DB/JSON |
| Pipeline audit | Server | `server.js` | Logs | Não | Log externo/runtime |

## 20. Conclusão executiva

O Observer Layer real do Link Mágico é distribuído e pragmático: ele combina Auto-Learning passivo, telemetria V20, tracking de conversões, score de captura e adaptação por canal. Sua importância no V20 é permitir que a plataforma execute o pipeline de IA sem bypass legado, observando tudo que afeta conversão.

Componentes dependentes: CTA Engine, Lead Capture Score, Scheduler/calendar, Widget, WhatsApp, tracker de analytics, Journey Analyzer e intent detection.

Arquivos críticos: `server.js`, `analytics/index.js`, `analytics/conversation-tracker.js`, `lib/lead-capture-score.js`, `sales/cta-engine.js`, `whatsapp-channel.js`, `public/widget.js`, `public/widget-v2.js`, `public/widget-inline-generator.js`.

Arquivos que exigem auditoria obrigatória antes de qualquer alteração futura: todos os críticos acima, especialmente qualquer trecho que altere `conversationId`, `leadCapture`, `calendarHash`, `/api/track-event`, `FEATURE_AUTO_LEARNING`, `FEATURE_SMART_CTA`, `AUDIT-LLM-BYPASS-V20` ou ordem captura → agendamento.
