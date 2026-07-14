# CONVERSATION_STATE_MASTER_MAP — Link Mágico

Documento baseado exclusivamente no código real inspecionado em `server.js`, `lib/*`, `analytics/*`, `database.js`, `public/*` e módulos de leads/short URL/WhatsApp. Não contém propostas de correção.

## 1. Visão geral

Conversation State no Link Mágico não é um único objeto central persistido. É um conjunto de estados por conversa/sessão, distribuído entre memória de processo, lead persistido, histórico analítico, short URL, agenda e dados de canal.

Objetivo técnico: manter contexto suficiente para decidir resposta, estágio, CTA, checkout, captura, agendamento e tracking sem depender apenas da mensagem atual. O núcleo explícito é `lib/conversation-state.js`, que mantém um `Map` por `conversationId`, com estágio derivado de intent, última mensagem, contador e histórico de intents. Existe também `lib/v13-state-manager.js`, uma máquina de estados comercial por score (`COLD`, `WARM`, `HOT`, `CHECKOUT_SENT`).

Objetivo comercial: evitar repetição, evitar oversell, decidir quando facilitar compra, quando bloquear checkout, quando capturar lead, quando acionar WhatsApp/suporte e quando abrir calendário.

Encaixe arquitetural:

- Entrada: widget, chatbot de link curto, endpoints `/api/chat-universal` e `/api/process-chat-inteligente`, canal WhatsApp.
- Identidade: `conversationId`, `leadId`, `apiKey`, short code, telefone WhatsApp e sessão local do widget/chatbot.
- Decisão: Decision Core, V13 classifier/state, V17 orchestrator, sales/CTA layers e scheduler.
- Persistência: memória (`Map`), JSON de tenants, PostgreSQL/SQLite via `DatabaseHelpers`, Redis/cache para short URLs e storage/localStorage no navegador.

Relações principais:

- Decision Core detecta intent granular (`buy`, `interest`, `info`, `objection`, `human`, `post_sale`, `checkout_issue`, `neutral`) e isso alimenta estado, bloqueio de checkout e orquestração.
- Journey Stage é salvo no lead (`descoberta`, `negociacao`, `fidelizacao`) e usado na geração de resposta/sales layer.
- Intent Detection alimenta `conversation-state`, `v13-state-manager`, `lead-capture-score` e decisões de CTA/checkout.
- CTA Engine/checkout dependem de intent, links extraídos/confirmados e memória de checkout já enviado.
- Lead Capture tem estado próprio de score por `conversationId` e persiste o lead quando formulário é submetido.
- Scheduler usa resposta com marcador `[CALENDAR_WIDGET]`, `calendarHash`, appointments por tenant e atualização de jornada para negociação em fluxos documentados.

Resposta direta: o sistema sabe em que ponto da conversa o lead está combinando `conversationId` com estados em memória, `leadId` com `journeyStage` persistido, intent calculada pela mensagem atual, histórico de conversas do lead e, em partes do fluxo comercial, score acumulado V13/lead-capture.

## 2. Inventário completo

| Item | Caminho | Tipo | Responsabilidade | Dependências |
|---|---|---|---|---|
| Conversation State V11 | `lib/conversation-state.js` | módulo | `Map` por `conversationId`, resolve stage por intent, monta contexto textual | Decision Core/intent, `conversationId` |
| V13 State Manager | `lib/v13-state-manager.js` | módulo | score comercial e estados `COLD/WARM/HOT/CHECKOUT_SENT` | V13 intent classifier, `conversationId` |
| Decision Core | `lib/decision-core.js` | módulo | detecta intent, decide bloquear/incluir checkout | mensagem normalizada |
| V13 Intent Classifier | `lib/v13-intent-classifier.js` | módulo | classifica `READY_TO_BUY/INTEREST/DOUBT/OBJECTION/SUPPORT/GREETING/GENERIC` | regex local |
| V17 Orchestrator | `lib/v17-orchestrator.js` | módulo | classifica intenção LLM-driven/determinística e monta estratégia final | dados extraídos, links, mensagem |
| Orchestrator V10 | `lib/orchestrator.js` | classe | aplica pós-processamento por intent, bloqueia CTA/checkout quando necessário | Decision Core, links/contexto |
| Action Resolver | `lib/action-resolver.js` | função | resolve link por intent (`buy`→checkout, `human`→WhatsApp) | `links-map` |
| Lead Capture System | `lib/leads/lead-capture.js` | classe | cria lead, conversa persistida, journeyStage, appointments | JSON, PostgreSQL via `DatabaseHelpers`, `apiKey` |
| Lead Capture Score | `lib/lead-capture-score.js` | módulo | score em memória para exibir captura inline | Decision Core, V13 classifier, CTA/checkout signals |
| Analytics Conversation Tracker | `analytics/conversation-tracker.js` | classe | registra interações, intents, stages, CTAs e ações | memória/DB adapter |
| Analytics DB Adapter | `analytics/db-adapter.js` | classe | persiste learning conversations/scores | `database.js` |
| Database Helpers | `database.js` | módulo | tabelas de leads, appointments, short URLs, WhatsApp messages, learning | PostgreSQL/SQLite |
| Short URL routes | `server.js` | rotas | cria `/l/:shortCode`, redireciona para `/chatbot`, cacheia short URL | `DatabaseHelpers`, `CacheManager`, `ShortUrlGenerator` |
| Chat endpoints | `server.js` | rotas | processam mensagens e atualizam estado/conversa/captura | lead system, Decision Core, sched, analytics |
| Widget inline/chatbot | `server.js`, `public/widget.js`, `package.js` | frontend | gera `conversationId`, manda mensagens, captura lead, renderiza CTA/calendário | navegador, localStorage, endpoints |
| WhatsApp Channel | `whatsapp-channel.js`, `whatsapp-routes.js`, `database.js` | canal/rotas | identifica conversas por telefone/lead/conversation_id e persiste mensagens | WhatsApp manager, DB |
| Feature Flags | `lib/feature-flags.js`, `data/feature_flags.json`, env vars em `server.js` | flags | habilitam camadas como decision, checkout, learning, scheduler | ambiente/JSON |

## 3. Identificação da conversa

- `conversationId`: chave primária de estados em memória. Usado por `conversation-state`, V13 state, lead capture score, analytics e frontend.
- `sessionId`: não aparece como entidade backend central; o equivalente funcional é o `conversationId` gerado no cliente ou recebido via canal.
- `leadId`: ID persistido do lead; vincula histórico, jornada e appointments.
- `apiKey`: tenant lógico. Define arquivos JSON `data/tenants/leads-${apiKey}.json`, `appointments-${apiKey}.json`, short URLs, WhatsApp settings e registros de banco.
- `tenant`: aparece como `apiKey`, `tenant_id` e `tenant_uuid` nas tabelas.
- telefone WhatsApp: usado nas tabelas `whatsapp_messages`/settings e como identificador de canal junto de `api_key`, `lead_id` e `conversation_id`.
- widget session: gera `conversationId` tipo `widget_...` ou `chat_...` no JavaScript e usa `localStorage` para `leadId` em versões de widget.
- link curto session: `/l/:shortCode` resolve short URL, injeta `apiKey`, `name`, `url`, `instructions` em `/chatbot`; o chatbot gera uma sessão de conversa própria no navegador.

## 4. Criação de estado

O estado nasce sob demanda:

1. Primeira mensagem com `conversationId`: `getState()`/`updateState()` cria estado default em `Map` se não existir.
2. Acesso ao widget: JavaScript inicializa widget e gera `conversationId`; o backend só cria estado quando recebe a mensagem.
3. Acesso ao link curto: `/l/:shortCode` não cria conversation state; resolve dados e redireciona. A página `/chatbot` cria `sessionConversationId`; a primeira mensagem cria estado backend.
4. Primeira mensagem WhatsApp: canal registra mensagem e usa telefone/conversation_id; o estado de conversa depende de o canal encaminhar `conversationId` ao pipeline.
5. Captura de lead: quando formulário é submetido, `addLead()` cria registro com `conversations: []`, `journeyStage: "descoberta"`, `status: "ativo"`.

Fluxo real resumido: cliente gera `conversationId` → POST chat com mensagem/apiKey/pageData/leadId → server ativa chat, extrai pageData, detecta intent/journey, atualiza lead se houver, atualiza estado em memória quando camada ativa, retorna resposta e sinalização de captura/calendário.

## 5. Persistência

| Meio | Evidência funcional | O que guarda |
|---|---|---|
| Memória `Map` | `lib/conversation-state.js` | V11 conversation state por `conversationId`, TTL 30min |
| Memória `Map` | `lib/v13-state-manager.js` | score/stage comercial V13, TTL 30min, max 5000 conversas |
| Memória `Map` | `lib/lead-capture-score.js` | score de captura, flags `captured/dismissed/captureShown`, TTL 1h |
| JSON | `lib/leads/lead-capture.js` | leads e appointments por tenant em `data/tenants` |
| PostgreSQL/SQLite | `database.js` | tenant_leads, tenant_appointments, short_urls, whatsapp_messages, learning_conversations |
| Redis/cache | `server.js` short URL | cache `short_url:${shortCode}` por 1h |
| Browser storage | widget/chatbot JS | `conversationId` em variável de sessão; `lm_lead_id` em localStorage em widget legado |
| Analytics memory/DB | `analytics/*` | registros de conversa, actions e outcomes |

Não há Redis como fonte canônica de conversation state; aparece como cache de short URL e possivelmente cache auxiliar.

## 6. Estrutura do estado

Campos reais encontrados:

### V11 `conversation-state`

- `lastIntent`
- `lastMessage`
- `stage`
- `messageCount`
- `intentHistory`
- `_lastUpdated`

Stages derivados: `decision`, `consideration`, `objection`, `discovery`, `post_sale`, `escalation`, `recovery`, `support`, `neutral`.

### V13 `state-manager`

- `stage`: `COLD`, `WARM`, `HOT`, `CHECKOUT_SENT`
- `score`
- `messageCount`
- `intents`
- `lastIntent`
- `checkoutSent`
- `checkoutConfirmed`
- `createdAt`
- `updatedAt`

### Lead Capture Score

- `score`
- `signals`
- `messageCount`
- `captured`
- `dismissed`
- `captureShown`
- `createdAt`

### Lead persistido

- `id`
- `timestamp`
- campos recebidos (`nome`, `email`, `telefone`, `url_origem`, `robotName`, `conversationId`, etc.)
- `conversations[]`
- `journeyStage`
- `lastInteraction`
- `status`

### Conversation dentro do lead

- `timestamp`
- `message`
- `isUser`

### Appointment

- `id`
- `createdAt`
- `leadId`
- `leadName`
- `leadEmail`
- `leadPhone`
- `datetime`
- `status`
- `notes`
- `robotName`
- `urlOrigem`
- `updatedAt` quando status muda

### Analytics / learning

- `conversation_id`
- `user_message`
- `ai_response`
- `detected_intent`
- `journey_stage`
- `profile`
- `has_cta`
- `links`
- `emotional_state`
- `api_key`
- `robot_name`
- actions: `action_clicked`, `action_scheduled`, `action_lead_captured`, `action_whatsapp_opened`

Campos citados no enunciado que existem com nomes próximos: `leadScore` não aparece como campo central; existe `score` em V13 e lead-capture-score. `captureStatus` não aparece como campo literal; existe `captured/dismissed/captureShown`. `schedulerStatus` não aparece como campo literal; existe `appointment.status`. `checkoutStatus` não aparece como campo literal; existe `checkoutSent/checkoutConfirmed` e stage `CHECKOUT_SENT`. `observerFlags` não foi encontrado como campo literal.

## 7. Ciclo de vida

Não há uma única máquina `criada → ativa → comercial → encerrada`. O ciclo real é composto:

1. Conversa criada: primeira chamada com `conversationId`; estado default ou inicial é criado.
2. Conversa ativa: `messageCount` incrementa, `lastIntent`/`intentHistory` atualizam, `analytics.activeChats` inclui a conversa por 30min.
3. Conversa comercial: intent/score muda stage para `consideration/decision` ou `WARM/HOT`; lead capture score pode disparar captura; checkout pode ser confirmado/enviado.
4. Conversa encerrada: não há evento universal de encerramento persistido. Encerramento real ocorre por TTL de memória, fechamento do widget, intent `exit` em V17 ou status de appointment/lead por rotas específicas.

## 8. Relação com Journey Stage

Journey Stage persistido vive no lead: `addLead()` inicia `journeyStage: "descoberta"`; `updateLeadJourneyStage()` aceita apenas `descoberta`, `negociacao`, `fidelizacao` e salva. O server calcula/anexa `journeyStage` durante geração/resposta e passa esse valor para sales layer, decision engine, analytics e persistência do lead quando há `leadId` ou lead encontrado por `conversationId`.

Quem altera: `LeadCaptureSystem.updateLeadJourneyStage()` e trechos do servidor que chamam essa função após análise da jornada/agendamento.

Quem consome: geração de resposta, sales layer, analytics/learning, CRM/lead views.

## 9. Relação com Intent Detection

Intents persistidas em memória:

- V11: `lastIntent` e `intentHistory` com últimos 5.
- V13: `lastIntent` e `intents` com até 20.
- Analytics/learning: `detected_intent` no registro de conversa.
- Lead Capture Score: `signals` derivados de intent, não a intent bruta sempre.

Histórico real: V11 e V13 guardam históricos curtos em memória; lead persistido guarda mensagens, não campo de intent por mensagem; learning pode guardar intent por interação quando o tracker é acionado.

## 10. Relação com CTA Engine

CTAs são governados por intent/estado, mas não há um campo canônico `ctasShown` persistido globalmente. Estados reais relacionados:

- V13: `checkoutSent`, `checkoutConfirmed`, stage `CHECKOUT_SENT` impedem nova mudança após checkout enviado.
- Lead Capture Score: `ctaCandidate`, `checkoutCandidate`, `ctaClicked` viram signals e podem disparar captura.
- Analytics: ações `clicked`, `whatsappOpened`, `scheduled`, `leadCaptured` rastreiam conversão.
- Orchestrator V10 bloqueia checkout/CTA/closing para intents não comerciais e adiciona CTA leve para `interest` quando `ctaData` existe.

CTAs repetidos são prevenidos parcialmente por checagens de conteúdo (`final.includes(...)`) e por `checkoutSent`; não há memória comercial única persistente de todos os CTAs mostrados.

## 11. Relação com Lead Capture

Status real:

- Antes da captura: estado em `lead-capture-score` com `captured=false`, `dismissed=false`, `captureShown=false`.
- Captura exibida: `captureShown=true`.
- Captura enviada: lead criado com `status="ativo"`; `markCaptured()` pode marcar sessão como capturada.
- Captura dispensada: `dismissed=true`.

Campos coletados: `nome`, `email`, `telefone`, `url_origem`, `robotName`, `conversationId`, `apiKey`; o sistema também aceita `message/source/status/metadata` dependendo do caminho.

Bloqueios: captura não reaparece se `captured` ou `dismissed`; também não dispara em despedidas e não dispara novamente após `captureShown`.

Fluxo real: backend avalia score → resposta inclui `leadCapture.shouldCapture` → frontend exibe formulário inline → POST `/api/capture-lead` → backend `addLead()` → frontend chama `/api/link-conversation` para sincronizar mensagens anteriores ao lead.

## 12. Relação com Scheduler

Estados reais:

- `calendarHash`: gerado pelo scheduling manager e retornado quando resposta usa calendário.
- Agendamento iniciado: resposta contém `[CALENDAR_WIDGET]` e frontend renderiza widget de calendário.
- Agendamento concluído: `addAppointment()` cria appointment com `status: "pendente"`.
- Status posteriores: `updateAppointmentStatus()` aceita `pendente`, `confirmado`, `cancelado`, `realizado`.
- Reabertura: não há estado canônico de reabertura; o calendário pode ser renderizado novamente se nova resposta contiver marcador/hash.

## 13. Relação com Decision Core

Estados que influenciam decisões:

- `journeyStage`
- `messageCount`
- `conversationId`
- histórico de conversa enviado ao LLM
- `checkoutSent/checkoutConfirmed`
- `lastIntent/intentHistory`
- signals de lead capture
- disponibilidade de links (`checkoutLink`, `whatsappLink`)

Decisões que alteram estado:

- intent detectada atualiza V11/V13.
- compra/checkout pode marcar confirmação/envio.
- signals de CTA/checkout atualizam lead capture score.
- captura cria/persiste lead.
- agendamento cria appointment.

## 14. Link curto

Criação: POST `/api/create-short-url` valida `apiKey`, limites de billing, gera `shortCode`, monta `longUrl=/chatbot?...`, salva no banco e cacheia por 1h.

Persistência: tabela `short_urls` via `DatabaseHelpers`, cache `short_url:${shortCode}`, analytics `short_url_created` e `short_url_accessed`.

Encerramento: delete/hard-delete existe em `DatabaseHelpers`; acesso só resolve registros `status='active'`. Acesso ao link curto não cria conversation state; ele apenas transporta configuração para o chatbot.

Particularidade: a sessão conversacional nasce depois do redirect, no `/chatbot`, via `sessionConversationId`.

## 15. Widget

Criação: widget cria HTML, configura API base, gera `conversationId` no cliente e envia POST com `message`, `pageData/url`, `instructions`, `robotName`, `conversationId`, `leadId/apiKey`.

Persistência: estado de conversa no backend em memória; lead no JSON/DB após captura; `leadId` pode ficar no localStorage em widget legado; analytics por `conversationId`.

Encerramento: fechar widget oculta UI; não há finalização backend imediata. Estado expira por TTL ou remove active chat após 30min.

Particularidade: widget pode preservar `checkoutLink` enviado pelo cliente com prioridade sobre extração automática.

## 16. WhatsApp

Criação: canal WhatsApp usa configurações multi-tenant e tabela `whatsapp_messages`; identificação envolve `api_key`, `wa_phone`, `lead_id` e `conversation_id`.

Persistência: configurações em `whatsapp_settings`; mensagens em `whatsapp_messages`; ações de conversão usam `action_whatsapp_opened`/`open_whatsapp`.

Encerramento: não há estado conversacional de encerramento específico no core; conexão WhatsApp tem `connection_state`, `connected_at`, `last_seen`.

Particularidade: Decision Core classifica menção a WhatsApp/telefone/contato como `human`; Action Resolver mapeia `human` para link WhatsApp.

## 17. Mapa global de transições

| Evento | Estado atual | Novo estado | Arquivo responsável |
|---|---|---|---|
| Primeira mensagem com `conversationId` | inexistente | V11 default/atualizado | `lib/conversation-state.js` |
| Intent `buy` | qualquer V11 | `decision` | `lib/conversation-state.js` |
| Intent `interest` | qualquer V11 | `consideration` | `lib/conversation-state.js` |
| Intent `objection` | qualquer V11 | `objection` | `lib/conversation-state.js` |
| Intent `info` | qualquer V11 | `discovery` | `lib/conversation-state.js` |
| Intent `post_sale` | qualquer V11 | `post_sale` | `lib/conversation-state.js` |
| Intent `human` | qualquer V11 | `escalation` | `lib/conversation-state.js` |
| Intent `stress` | qualquer V11 | `recovery` | `lib/conversation-state.js` |
| Intent `checkout_issue` | qualquer V11 | `support` | `lib/conversation-state.js` |
| TTL 30min V11 | qualquer V11 | removido | `lib/conversation-state.js` |
| Primeira V13 | inexistente | `COLD` | `lib/v13-state-manager.js` |
| Score >= 3 | `COLD` | `WARM` | `lib/v13-state-manager.js` |
| Score >= 6 | `COLD/WARM` | `HOT` | `lib/v13-state-manager.js` |
| `markCheckoutConfirmed()` | qualquer V13 | `checkoutConfirmed=true` | `lib/v13-state-manager.js` |
| `markCheckoutSent()` | qualquer V13 | `CHECKOUT_SENT`, `checkoutSent=true` | `lib/v13-state-manager.js` |
| Mensagem após `CHECKOUT_SENT` | `CHECKOUT_SENT` | permanece `CHECKOUT_SENT` | `lib/v13-state-manager.js` |
| Lead criado | inexistente | `status=ativo`, `journeyStage=descoberta` | `lib/leads/lead-capture.js` |
| Journey update válido | `descoberta/negociacao/fidelizacao` | novo stage permitido | `lib/leads/lead-capture.js` |
| Captura score >= threshold | `captureShown=false` | `captureShown=true` | `lib/lead-capture-score.js` |
| Captura submetida | `captured=false` | `captured=true` + lead persistido | `lib/lead-capture-score.js`, `lib/leads/lead-capture.js` |
| Captura dispensada | `dismissed=false` | `dismissed=true` | `lib/lead-capture-score.js` |
| Appointment criado | inexistente | `status=pendente` | `lib/leads/lead-capture.js` |
| Appointment status update | `pendente/confirmado/cancelado/realizado` | status permitido | `lib/leads/lead-capture.js` |
| Short URL criada | inexistente | `status active` no banco/cache | `server.js`, `database.js` |
| Short URL acessada | active | access_count incrementado | `server.js`, `database.js` |

## 18. Dependências ocultas

- `conversationId` é obrigatório para estados em memória; sem ele, V11/V13 retornam estado default sem persistir.
- `apiKey` é a chave real de tenant para JSON, DB, short URL e WhatsApp, mesmo quando há `tenant_uuid`.
- `leadId` pode ser recuperado por `conversationId` se o lead tiver esse campo, criando acoplamento entre captura e chat.
- `checkoutLink` vindo do widget pode sobrescrever/preceder extração, mudando decisão comercial.
- Fechar widget não encerra estado backend; TTL faz cleanup.
- Lead capture score e V13 state são independentes; scores comerciais podem divergir.
- O mesmo termo `stage` significa coisas diferentes: V11 (`decision/discovery/...`), V13 (`COLD/HOT/...`) e lead journey (`descoberta/negociacao/fidelizacao`).

## 19. Riscos de regressão

| Componente | Risco | Motivo |
|---|---|---|
| `server.js` chat endpoints | ALTO | orquestra entrada, estado, lead, checkout, calendário e resposta |
| `lib/conversation-state.js` | ALTO | muda contexto e adaptação da IA por intent |
| `lib/v13-state-manager.js` | ALTO | controla aquecimento e bloqueio de checkout repetido |
| `lib/decision-core.js` | ALTO | altera compra/bloqueio/humano/pós-venda |
| `lib/lead-capture-score.js` | ALTO | afeta momento de captura e UX comercial |
| `lib/leads/lead-capture.js` | ALTO | persistência de lead, jornada e appointments |
| `database.js` | ALTO | schema/persistência multicanal |
| Short URL routes | MÉDIO/ALTO | afeta aquisição e tenant routing |
| Widget/chatbot JS | MÉDIO/ALTO | afeta `conversationId`, captura e calendário |
| Analytics | MÉDIO | afeta learning/tracking, menos resposta imediata |
| WhatsApp channel/settings | MÉDIO/ALTO | afeta canal externo e identificação por telefone |
| `action-resolver.js` | MÉDIO | mapeia intent para link |
| Feature flags | MÉDIO | podem ativar/desativar camadas críticas |

## 20. Matriz de propriedade

| Estado | Quem cria | Quem altera | Quem persiste | Quem consome | Quem destrói |
|---|---|---|---|---|---|
| V11 conversation | `getState/updateState` | `updateState` | memória Map | prompt/contexto/servidor | cleanup TTL |
| V13 comercial | `getState` | `updateState`, `markCheckout*` | memória Map | checkout/CTA | cleanup TTL |
| Lead | `/api/capture-lead`/`addLead` | lead system/server | JSON + PostgreSQL/SQLite | chat, CRM, scheduler | não há destroy no módulo principal |
| Journey Stage | `addLead` | `updateLeadJourneyStage` | lead JSON/DB metadata | IA/sales/analytics | substituído por novo valor |
| Lead capture score | `evaluateCapture` | `evaluateCapture`, `markCaptured`, `markDismissed` | memória Map | frontend captura | TTL |
| Appointment | scheduler/API `addAppointment` | `updateAppointmentStatus` | JSON + PostgreSQL/SQLite | calendário/admin/lead | não há destroy no módulo |
| Short URL | `/api/create-short-url` | access counter/status/delete DB | DB + cache | `/l/:shortCode`, dashboard | delete/hard-delete/cache TTL |
| WhatsApp message | WhatsApp channel | canal/rotas | DB | WhatsApp/analytics/leads | não identificado no core |
| Analytics conversation | tracker | tracker/actions | memória/DB | learning/performance | retenção/adapters |

## 21. Estados órfãos

- `sessionId` não aparece como conceito central de backend; parece substituído por `conversationId`.
- `captureStatus`, `schedulerStatus`, `checkoutStatus`, `observerFlags` não aparecem como campos literais; existem equivalentes fragmentados.
- `conversation-state.js` V11 e `v13-state-manager.js` duplicam `stage`, `messageCount`, intent history e TTL sem fonte única.
- Lead `journeyStage` usa nomenclatura em português e V11/V13 usam nomenclaturas diferentes.
- `findLeadByConversationId()` depende de leads terem `conversationId`; nem todos os caminhos garantem esse campo se não veio no payload.

## 22. Estados críticos

| Estado | Afeta | Criticidade |
|---|---|---|
| `lastIntent`/intent atual | vendas, CTA, suporte, checkout | CRÍTICO |
| V13 `stage/score/checkoutSent` | checkout e repetição | CRÍTICO |
| Lead `journeyStage` | resposta e funil | CRÍTICO |
| Lead capture `captured/dismissed/captureShown/score` | captura | CRÍTICO |
| `conversationId` | todos estados de sessão | CRÍTICO |
| `apiKey` | tenant/persistência/canal | CRÍTICO |
| `leadId` | histórico e agenda | CRÍTICO |
| `calendarHash` | scheduler frontend | ALTO |
| `appointment.status` | scheduler | ALTO |
| `whatsapp_messages.conversation_id/wa_phone` | WhatsApp | ALTO |
| short URL `status/access_count` | aquisição | MÉDIO/ALTO |
| analytics actions | otimização/performance | MÉDIO |

## 23. Fluxo completo de uma venda

1. Primeira mensagem: frontend envia `conversationId`, `apiKey`, mensagem, pageData/URL.
2. Descoberta: Decision Core/V17 classifica info/explain/price; V11 pode ir para `discovery`, lead journey inicia como `descoberta` se lead capturado.
3. Consideração: intent `interest` ou V13 `INTEREST` aumenta score; V11 `consideration`, V13 pode ir `WARM`.
4. Compra: intent `buy`/`READY_TO_BUY`; V11 `decision`, V13 score pode ir `HOT`; orchestrator permite checkout.
5. CTA/checkout: link resolvido por pageData/DB/links; V13 pode marcar `checkoutConfirmed` e `CHECKOUT_SENT`.
6. Captura: lead-capture-score dispara formulário por compra/score/CTA; frontend coleta nome/email/telefone; backend cria lead.
7. Agendamento: se fluxo pede agenda, resposta inclui `[CALENDAR_WIDGET]`, backend retorna `calendarHash`, frontend renderiza calendário; `addAppointment()` cria `pendente`.
8. Encerramento: não há estado único final; conversa expira por TTL, widget fecha, appointment muda status ou intent `post_sale/exit` muda tratamento.

## 24. Arquivos críticos

### CRÍTICO ABSOLUTO

- `server.js`: concentra rotas de chat, short URL, scheduler, captura, checkout, flags e integração de estados.
- `database.js`: schema e helpers de persistência para tenants, leads, appointments, short URLs, WhatsApp e learning.
- `lib/leads/lead-capture.js`: persistência comercial de lead/conversa/jornada/agenda.

### CRÍTICO

- `lib/decision-core.js`: fonte determinística de intents comerciais.
- `lib/conversation-state.js`: memória conversacional V11.
- `lib/v13-state-manager.js`: estado comercial por score.
- `lib/lead-capture-score.js`: estado de captura orientado por intenção.
- `lib/v17-orchestrator.js`: intenção/estratégia final em fluxo moderno.

### IMPORTANTE

- `lib/orchestrator.js`: pós-processamento por intent.
- `lib/action-resolver.js`: mapeia intent para checkout/WhatsApp.
- `analytics/conversation-tracker.js`, `analytics/db-adapter.js`: aprendizado, ações e métricas.
- `whatsapp-channel.js`, `whatsapp-routes.js`: canal WhatsApp.
- `public/widget.js`, `package.js`: identidade de sessão e UX do widget.

### SUPORTE

- `lib/feature-flags.js`, `data/feature_flags.json`: gates de comportamento.
- `cache.js`: suporte ao cache.
- `short-url-generator.js`: geração de códigos curtos.

## 25. Conclusão executiva

O estado conversacional do Link Mágico funciona como um sistema distribuído: a conversa é identificada por `conversationId`, contextualizada por intent e stage em memória, conectada comercialmente a um `leadId` persistido e separada por `apiKey`/tenant. Não existe uma tabela única chamada conversation_state que guarde tudo.

Onde é armazenado:

- Estado imediato: memória de processo (`Map`) em V11, V13 e lead capture score.
- Estado comercial persistente: lead/appointments em JSON e PostgreSQL/SQLite.
- Estado de canal: short URLs, WhatsApp messages/settings e analytics em DB/cache.
- Estado cliente: variáveis JS/localStorage.

Quem controla:

- `server.js` coordena o fluxo.
- Decision Core/V17 classificam intenção.
- V11/V13 guardam contexto transitório.
- LeadCaptureSystem persiste a parte comercial durável.
- Scheduler/short URL/WhatsApp adicionam estados de canal.

Módulos dependentes: IA/LLM prompt, sales layer, CTA/checkout, lead capture, scheduler, analytics/learning, WhatsApp, CRM/dashboards e short URL.

Arquivos que nunca devem ser alterados sem auditoria: `server.js`, `database.js`, `lib/leads/lead-capture.js`, `lib/decision-core.js`, `lib/conversation-state.js`, `lib/v13-state-manager.js`, `lib/lead-capture-score.js`, `lib/v17-orchestrator.js`, `whatsapp-channel.js`, `whatsapp-routes.js`, `public/widget.js` e `package.js`.
