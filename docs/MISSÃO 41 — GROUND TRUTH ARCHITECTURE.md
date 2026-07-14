# MISSÃO 40 — GROUND TRUTH ARCHITECTURE

## Fonte permitida usada

Este mapa foi construído somente a partir de código executável, imports, chamadas, endpoints, persistência e dependências reais do runtime Node/Express. Arquivos markdown, comentários e missões anteriores não foram usados como fonte de verdade.

## 1. Endpoint principal que recebe mensagens

**Endpoint principal comprovado:** `POST /api/process-chat-inteligente`.

Evidência executável:

- Rota Express registrada em `server.js`:
  - `app.post("/api/process-chat-inteligente", ...[requireApiKey, billingMiddleware].filter(Boolean), async (req, res) => {`
- O endpoint incrementa `analytics.chatRequests`, lê `message`, `pageData`, `url`, `conversationId`, `instructions`, `robotName`, `leadId`, valida `message` e processa a resposta final.

## 2. Endpoint que recebe mais tráfego

**Endpoint com maior evidência de tráfego conversacional:** `POST /api/process-chat-inteligente`.

Base executável:

- Widget V2 chama diretamente `/api/process-chat-inteligente`.
- Widget legado chama diretamente `/api/process-chat-inteligente`.
- Página de link curto `/l/:shortCode` redireciona para `/chatbot`, cujo JavaScript interno chama `/api/process-chat-inteligente`.
- WhatsApp registra webhook próprio, mas o webhook chama internamente o “Unified Brain”, que por padrão com `WA_USE_FULL_PIPELINE=true` chama `/api/process-chat-inteligente`.
- O contador `analytics.chatRequests++` está dentro de `/api/process-chat-inteligente`, e o WhatsApp também incrementa analytics antes de delegar para o mesmo cérebro.

## 3. Endpoint usado por canal

| Canal | Endpoint de entrada | Endpoint real que decide resposta | Evidência executável |
|---|---:|---:|---|
| Widget V2 | Cliente chama API diretamente | `POST /api/process-chat-inteligente` | `public/widget-v2.js` faz `fetch(apiBase + '/api/process-chat-inteligente')` com `message`, `pageData`, `robotName`, `instructions`, `conversationId`, `leadId`, `apiKey`. |
| Widget legado | Cliente chama API diretamente | `POST /api/process-chat-inteligente` | `public/widget.js` faz `fetch(this.config.apiBase + '/api/process-chat-inteligente')`. |
| WhatsApp Evolution | `POST /api/webhook/evolution` | `POST /api/process-chat-inteligente` se `WA_USE_FULL_PIPELINE` verdadeiro; senão `/api/chat-universal` | `whatsapp-channel.js` registra `/api/webhook/evolution`, resolve lead, chama `_callUnifiedBrain`, e `_callUnifiedBrain` escolhe endpoint interno. |
| WhatsApp Twilio | `POST /api/webhook/twilio` | mesmo `_callUnifiedBrain` | Rota registrada em `whatsapp-channel.js`. |
| Link Curto | `GET /l/:shortCode` | `/chatbot` → `POST /api/process-chat-inteligente` | `server.js` resolve `short_urls`, redireciona para `/chatbot?...`; o script do chatbot chama `/api/process-chat-inteligente`. |

## 4. Cadeia exata após receber mensagem

### 4.1 Widget V2

```text
Usuário
↓
public/widget-v2.js send message
↓
fetch(apiBase + '/api/process-chat-inteligente')
↓
server.js app.post('/api/process-chat-inteligente')
↓
extractPageData(targetUrl) se pageData incompleto
↓
_v113GetConfirmedCheckout(db, apiKey, salesUrl) se não houver checkout no pageData
↓
_waCTAPromoter.promoteWhatsAppToCTA(processedPageData) se aplicável
↓
_v18Guard.guardPageData(processedPageData, { enableFallback, context }) se habilitado
↓
_v19Engine.decide({ message, conversationId, pageData, v17Intent:null, salesMode }) se carregado/habilitado
↓
superInteligencia.detectarAgendamento(message) — pode retornar resposta imediata
↓
KB-FIRST — pode retornar resposta imediata
↓
sistemaInteligencias.capturarInteligencias(message)
↓
journeyAnalyzer.analyzeJourneyStage(message)
↓
superInteligencia.selecionarPersonalidade(...)
↓
generateAIResponse / pipeline de resposta principal
↓
leadSystem.updateLeadConversation(...) se existe lead
↓
_v14ContextLayer.addMessage/saveProductInfo se habilitado
↓
autoLearning.optimizeResponse(...) se habilitado
↓
_v11ResolveAction + _v11BuildLinksMap podem injetar checkout
↓
_v17LinkResolver.detectIntent/resolveBestLink/shouldShowCTA/buildCTA
↓
_channelResolver.resolve(...)
↓
_v19 apply/final guard quando ativo
↓
res.json({ success:true, response: finalResponse, ... })
↓
Widget renderiza data.response e, se houver calendarHash, renderiza calendário
```

### 4.2 WhatsApp Evolution

```text
Usuário WhatsApp
↓
POST /api/webhook/evolution
↓
WhatsAppChannel._handleEvolutionWebhook(req,res)
↓
WhatsAppChannel._processMessage(...)
↓
WhatsAppChannel._resolveLeadByPhone(apiKey, phone, pushName)
↓
leadSystem.addLead/updateLeadConversation ou vinculação de lead existente
↓
WhatsAppChannel._logMessage(inbound)
↓
WhatsAppChannel._callUnifiedBrain(apiKey, text, conversationId, lead.id)
↓
SELECT sales_url, robot_name, instructions FROM short_urls WHERE api_key = $1 ORDER BY id DESC LIMIT 1
↓
SELECT checkout_url FROM checkout_links WHERE api_key = $1 AND url_hash = $2 AND confirmed = true LIMIT 1
↓
http.request(127.0.0.1:{PORT}, POST /api/process-chat-inteligente ou /api/chat-universal)
↓
Fluxo central do endpoint escolhido
↓
WhatsApp adapta resposta: injeta CTA inline se aiResult.cta.url, traduz leadCapture, traduz calendarHash para URL /agendar/{hash}
↓
WhatsAppChannel._sendResponse(...)
↓
WhatsAppChannel._logMessage(outbound)
↓
leadSystem.updateLeadConversation(lead.id, adapted, false)
```

### 4.3 Link Curto

```text
Usuário abre /l/:shortCode
↓
server.js app.get('/l/:shortCode')
↓
ShortUrlGenerator.isValid(shortCode)
↓
CacheManager.get('short_url:' + shortCode)
↓
DatabaseHelpers.getShortUrl(shortCode) se cache miss
↓
CacheManager.set(...)
↓
DatabaseHelpers.updateShortUrlAccess(shortCode) assíncrono
↓
analyticsManager.trackEvent(apiKey, 'short_url_accessed', ...)
↓
whitelabelManager.getConfig(apiKey)
↓
res.redirect('/chatbot?...')
↓
/chatbot JS envia mensagem por fetch('/api/process-chat-inteligente')
↓
Fluxo central de /api/process-chat-inteligente
```

## 5. Módulos efetivamente executados

| Módulo | Importado? | Chamado? | Endpoints | Parâmetros comprovados | Saída altera resposta final? | Persistência | Classificação |
|---|---:|---:|---|---|---:|---:|---|
| Intent | Sim: `sistemaInteligencias`, `v13-intent-classifier`, `_v17LinkResolver.detectIntent`, `_v19Engine.decide` | Sim | `/api/process-chat-inteligente`; indiretamente WhatsApp via Unified Brain | `message`; V19 recebe `{ message, conversationId, pageData, v17Intent:null, salesMode }` | Sim: orienta CTA, journey, leadCapture e decisões V19/V17 | Parcial: estado V11/V14/learning | **ATIVO** |
| Journey | Sim: `journeyAnalyzer` | Sim | `/api/process-chat-inteligente`; WhatsApp consome `journeyStage` retornado | `message` | Sim: personalidade, retorno JSON, learning | Lead conversation e learning podem armazenar stage | **ATIVO** |
| Decision Engine | Sim: `sales/decision-engine`, `lib/decision-core`, V16.2, V19 | Parcial: V19 e decision core têm chamadas; import de `sales/decision-engine` não é evidência suficiente de chamada no fluxo principal | `/api/process-chat-inteligente` | V19 `{message, conversationId, pageData, v17Intent, salesMode}`; decision core `message` | Sim quando flags/ambiente ativam override | V11 conversation state pode persistir estado | **PARCIALMENTE ATIVO** |
| CTA Engine | Sim: `sales/cta-engine`, `v17-link-resolver`, `wa-cta-promoter` | V17 Link Resolver e WA CTA são chamados; `sales/cta-engine` precisa de chamada específica não comprovada no fluxo principal | `/api/process-chat-inteligente`; WhatsApp apenas traduz `aiResult.cta` | `message`, `processedPageData.checkoutLink`, `whatsappLink`, `primaryLink` | Sim: cria `cta` e injeta link/texto | Click tracking/analytics em frontend; checkout DB | **ATIVO** para V17/WA CTA; **ÓRFÃO** para `sales/cta-engine` se sem chamada real |
| V17 | Sim: `lib/v17-orchestrator`, `lib/v17-link-resolver` | `v17-link-resolver` é chamado; orquestrador V17 importado mas não comprovado como controlador principal | `/api/process-chat-inteligente`; WhatsApp recebe `cta` | `detectIntent(message)`, `resolveBestLink(intent,{checkoutLink, whatsappLink, primaryLink})`, `shouldShowCTA(intent, link)`, `buildCTA(link,intent)` | Sim: altera CTA retornado e remove CTA antigo | Não diretamente | **ATIVO** para link resolver; **PARCIALMENTE ATIVO** para orquestrador |
| V18 | Sim: `lib/v18-extraction-guard` | Sim se flags/env habilitam | `/api/process-chat-inteligente` | `guardPageData(processedPageData,{ enableFallback, context:{tenantId, conversationId} })` | Sim: altera `processedPageData`, portanto pode alterar checkout/contexto/resposta | Não diretamente | **PARCIALMENTE ATIVO** |
| V19 | Sim: `lib/v19-deterministic-engine` | Sim se `_v19Engine && _v19Mode`; modo pode ser `true`, `shadow` ou `false` | `/api/process-chat-inteligente` | `{ message, conversationId, pageData, v17Intent:null, salesMode }` | Sim quando modo ativo; shadow loga sem controlar | Não diretamente | **PARCIALMENTE ATIVO** |
| Lead Capture | Sim: LeadSystem em `server.js`, `lib/lead-capture-score`, frontend capture forms | Sim | `/api/process-chat-inteligente`, `/api/capture-lead`, WhatsApp webhook | `leadId`, `conversationId`, dados de nome/email/telefone; WhatsApp usa `apiKey, phone, pushName` | Sim: retorna `leadCapture`, exige captura antes de agendamento em WhatsApp/widget | Sim: PostgreSQL `tenant_leads` e JSON fallback; WhatsApp cria/vincula lead | **ATIVO** |
| Scheduler | Sim: `scheduling-manager` | Sim | `/api/process-chat-inteligente`, `/api/availability`, `/api/agendar/:hash`, widget calendar | `apiKey`, `tenantId`, `hash`, `leadId`, `date`, `time`, `name/email/phone` | Sim: `SCHED-PRIORITY` pode bypassar todo pipeline e retornar calendário | Sim: appointments via LeadSystem; availability/blocked dates via schedulingManager | **ATIVO** |
| CRM | Sim: `crmIntegrations`, `setupCRMRoutes`, `crmManager` | Sim em lead WhatsApp e endpoints CRM; também captura estruturada | WhatsApp `_resolveLeadByPhone`; `/api/leads/structured`; rotas CRM/admin | `crmManager.syncLeadToCRM(apiKey,newLead)`; structured lead data | Não controla resposta conversacional principal; atua pós-captura | Sim/externa dependendo CRM | **PARCIALMENTE ATIVO** |
| Learning | Sim: `learning-memory`, `autoLearning` | Sim se flag/env habilita | `/api/process-chat-inteligente` | `optimizeResponse(finalResponse,intent,emotion,journeyStage)`; `recordInteraction({conversationId,userMessage,aiResponse,detectedIntent,journeyStage,emotionalState,apiKey,robotName})` | Sim: pode substituir `finalResponse` por resposta otimizada | Sim: recordInteraction/memória | **PARCIALMENTE ATIVO** |

## 6. ARQUITETURA REAL EXECUTADA

```text
                      ┌────────────────────────┐
                      │        Usuário         │
                      └───────────┬────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐        ┌──────────────────┐       ┌─────────────────┐
│ Widget JS     │        │ GET /l/:shortCode│       │ WhatsApp webhook│
│ widget/v2     │        │ short_urls/cache │       │ evolution/twilio│
└───────┬───────┘        └────────┬─────────┘       └────────┬────────┘
        │                         │                          │
        │                         ▼                          ▼
        │                 ┌──────────────┐          ┌────────────────────┐
        │                 │ /chatbot UI  │          │ _resolveLeadByPhone│
        │                 └──────┬───────┘          │ _logMessage inbound│
        │                        │                  └─────────┬──────────┘
        └──────────────┬─────────┘                            │
                       ▼                                      ▼
        ┌──────────────────────────────────────┐      ┌────────────────────┐
        │ POST /api/process-chat-inteligente   │◄─────│ _callUnifiedBrain  │
        └──────────────────┬───────────────────┘      │ http.request local │
                           │                          └────────────────────┘
                           ▼
        ┌──────────────────────────────────────┐
        │ pageData/url extraction              │
        │ checkout DB injection                │
        │ WA CTA promotion                     │
        │ V18 guard                            │
        │ V19 decision                         │
        │ Scheduler early bypass               │
        │ KB-FIRST early bypass                │
        │ Intent + Journey + Personality       │
        │ AI response pipeline                 │
        │ Lead history                         │
        │ V14 context                          │
        │ Learning optimize/record             │
        │ V11 action resolver                  │
        │ V17 link resolver / CTA              │
        │ Channel resolver / final guards      │
        └──────────────────┬───────────────────┘
                           ▼
        ┌──────────────────────────────────────┐
        │ JSON: response, cta, leadCapture,    │
        │ calendarHash, journeyStage, metadata │
        └──────────────────┬───────────────────┘
                           │
           ┌───────────────┴────────────────┐
           ▼                                ▼
   ┌──────────────┐                ┌────────────────────┐
   │ Widget render│                │ WhatsApp adapter   │
   │ response/cal │                │ CTA inline/capture │
   └──────────────┘                │ schedule URL/send  │
                                   └────────────────────┘
```

## 7. TOP 50 arquivos mais críticos

Critério: participação direta no fluxo de conversa, endpoint, persistência, canal, checkout, lead, scheduler, CRM ou módulos importados/chamados pelo fluxo.

1. `server.js`
2. `whatsapp-channel.js`
3. `public/widget-v2.js`
4. `public/widget.js`
5. `database.js`
6. `cache.js`
7. `security-system.js`
8. `billing-enforcement.js`
9. `billing.js`
10. `analytics.js`
11. `server-utils.js`
12. `scheduling-manager.js`
13. `lib/v19-deterministic-engine.js`
14. `lib/v18-extraction-guard.js`
15. `lib/v17-link-resolver.js`
16. `lib/v17-orchestrator.js`
17. `lib/v16-decision-engine.js`
18. `lib/v13-intent-classifier.js`
19. `lib/decision-core.js`
20. `lib/orchestrator.js`
21. `lib/link-resolver.js`
22. `lib/checkout-discovery.js`
23. `lib/links-map.js`
24. `lib/action-resolver.js`
25. `lib/conversation-state.js`
26. `lib/v14-context-layer.js`
27. `lib/learning-memory.js`
28. `lib/lead-capture-score.js`
29. `lib/wa-cta-promoter.js`
30. `lib/channel-resolver.js`
31. `lib/crm/index.js`
32. `lib/crm/crm-routes.js`
33. `structured-leads.js`
34. `crm-integrations.js`
35. `whatsapp-routes.js`
36. `whatsapp-integration.js`
37. `chatgpt-integration.js`
38. `chatgpt-routes.js`
39. `knowledge-base.js`
40. `llm-optimizer.js`
41. `sales/decision-engine.js`
42. `sales/cta-engine.js`
43. `sales/sales-layer.js`
44. `sales/preset-selector.js`
45. `sales/auto-instructions.js`
46. `utils/normalize-links.js`
47. `api-key-manager.js`
48. `short-url-generator.js`
49. `whitelabel.js`
50. `routes.js`

## 8. TOP 20 componentes que parecem importantes mas não participam como controlador do fluxo principal

Classificação baseada em import/chamada real no fluxo principal, não em nome ou documentação.

1. `sales/cta-engine.js` — importado silenciosamente; chamada controladora não comprovada no fluxo principal.
2. `sales/decision-engine.js` — importado no topo; V19/V17/decision-core aparecem como controladores mais diretos.
3. `lib/v17-orchestrator.js` — importado, mas o controle comprovado de CTA no trecho principal é `v17-link-resolver`.
4. `lib/orchestrator.js` — instanciado, mas não aparece como autoridade final clara na cadeia de resposta principal.
5. `crm-integrations.js` — importante para templates/rotas; não decide resposta conversacional.
6. `structured-leads.js` — endpoint próprio; não é o capturador principal do chat widget/WhatsApp.
7. `gmail-integration.js` — notificação; não decide resposta.
8. `whatsapp-integration.js` — integração/manager; o canal conversacional real está em `whatsapp-channel.js`.
9. `chatgpt-routes.js` — rotas auxiliares; não é o endpoint principal de conversa.
10. `routes.js` — muitas rotas administrativas; não controla a mensagem principal.
11. `swagger-config.js` — documentação/infra, fora do fluxo de conversa.
12. `weekly-report.js` — agendamento de relatórios, fora da resposta ao usuário.
13. `backup` routes/tests — fora do fluxo principal.
14. `public/widget-inline-generator.js` — gera snippet; não é runtime central quando o widget já está carregado.
15. `package.js` — contém widget/package, mas o runtime observado usa `public/widget*.js` e `server.js`.
16. `server-new.js` — servidor alternativo, não indicado como entrypoint executado pelo package atual.
17. `server-melhorado.js` — servidor alternativo, não indicado como entrypoint executado pelo package atual.
18. `server antes.js` — legado/alternativo, não fluxo atual.
19. `test-*` e `tests/*` — exercitam endpoints, não participam do runtime.
20. `data_deletion_form.html` — fluxo LGPD, não conversa principal.

## 9. EXECUTION AUTHORITY MAP

| Autoridade | Quem controla de fato | Evidência executável | Observação factual |
|---|---|---|---|
| Resposta | `POST /api/process-chat-inteligente` em `server.js` | Recebe mensagem, monta `finalResponse`, retorna `res.json({ success:true, response: ... })`; WhatsApp delega para ele via `_callUnifiedBrain` quando full pipeline ativo | Scheduler e KB-FIRST podem bypassar IA e responder imediatamente. |
| CTA | `v17-link-resolver` + V11 action resolver + V19 quando ativo | V17 detecta intent, resolve link, valida com URL guard, cria CTA; V11 pode injetar “Finalizar agora”; V19 pode assumir controle quando modo ativo | WhatsApp não decide CTA: apenas transforma `aiResult.cta.url` em texto inline. |
| Checkout | Prioridade: `pageData.checkoutLink` do widget/contexto → DB `checkout_links` via `_v113GetConfirmedCheckout` → WA CTA promoter/links resolvers | Widget envia `checkoutLink`; server preserva; server consulta DB quando ausente; WhatsApp também consulta `checkout_links` antes de chamar Unified Brain | Checkout altera `processedPageData` e depois CTA/finalResponse. |
| Lead | `LeadSystem` em `server.js`; WhatsApp `_resolveLeadByPhone`; `/api/capture-lead` no frontend | Leads são criados/vinculados/atualizados, conversas são persistidas, WhatsApp cria lead automaticamente se não existir | CRM é sincronização posterior, não autoridade primária do lead. |
| Scheduler | `superInteligencia.detectarAgendamento` + `schedulingManager` + endpoints `/api/availability` e `/api/agendar/:hash` | Detecção de agendamento pode retornar antes do restante; `schedulingManager.generatePublicHash(apiKey)` gera `calendarHash`; booking usa LeadSystem appointments | No WhatsApp, `calendarHash` vira URL `/agendar/{hash}`. |
| CRM | `crmManager.syncLeadToCRM` e rotas CRM | Chamado após criação de lead WhatsApp; endpoints CRM existem | Não altera a resposta final no fluxo principal; opera como efeito colateral. |

## Persistência real comprovada

- `short_urls`: resolução de link curto e metadados do assistente.
- `checkout_links`: checkout confirmado consultado por WhatsApp e endpoint central.
- `tenant_leads`/JSON fallback: leads e conversas via `LeadSystem`.
- `whatsapp_messages`: log inbound/outbound do WhatsApp.
- Cache Redis via `CacheManager`: short URL e outros caches.
- Learning/context/state: V14 context layer, V11 conversation state e autoLearning quando habilitados.
- Scheduler: availability/blocked dates via `schedulingManager` e appointments via `LeadSystem.addAppointment`.
