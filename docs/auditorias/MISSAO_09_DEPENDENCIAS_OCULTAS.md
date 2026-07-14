# Matriz de Dependências — Link Mágico

## Convenção

- **Direta:** chamada/import/rota/campo usado explicitamente.
- **Indireta:** efeito via outro componente.
- **Oculta:** contrato implícito, ordem temporal, feature flag, side-effect ou marker textual.

| Componente | Quem chama | Chama | Dados recebidos | Dados retornados | Side-effects | Pode quebrar |
|---|---|---|---|---|---|---|
| `server.js` | processo Node, rotas HTTP, canais | módulos IA, DB, cache, leads, scheduling, analytics | env, requests, tenant/session | HTML/JSON/redirects | muta estado global, logs, analytics | todos os canais |
| `/api/process-chat-inteligente` | widget, chatbot HTML, WhatsApp HTTP interno, testes | extraction, checkout DB, V18/V19, KB, journey, IA, CTA, lead capture | `message`, `pageData`, `url`, `conversationId`, `instructions`, `robotName`, `leadId`, `apiKey` | `response`, `cta`, `calendarHash`, `inteligenciasDetectadas`, `journeyStage`, `leadCapture`, metadata | analytics, activeChats, lead stage/history, logs, learning | WhatsApp, Link Curto, Widget, Scheduler, CTA |
| Link Curto `/l/:shortCode` | usuários finais, campanhas | cache, DB, analytics, whitelabel, `/chatbot` | `shortCode` | redirect | access count, cache, analytics | widget/chatbot, attribution |
| Widget/chatbot | Link Curto, embed | capture-lead, process-chat, availability/book, track-conversion | query config, pageData, user messages | UI messages/forms/calendar | lead capture, booking, conversion tracking | lead capture, CTA, scheduler |
| WhatsApp Channel | Twilio/Evolution/webhooks | lead system, DB, HTTP pipeline, send provider, parity audit | phone, text, apiKey, provider metadata | WA message | logs inbound/outbound, lead updates, audit | WA parity, scheduler, capture |
| Lead Capture | widget, scheduler, process-chat signal, WA translator | `/api/capture-lead`, lead system, CRM/link conversation | name/email/phone/conversationId/apiKey | lead id/success; capture signal | creates/updates leads, links history | scheduler, CRM, WA, widget |
| Scheduler | SuperInteligência, widget, WA translator | scheduling manager, availability/book APIs | apiKey/calendarHash/leadId/date/time | marker, hash, booking status | booking, requires lead | WhatsApp schedule links, widget calendar |
| CTA Engine | server pipeline | CTA bank, context, anti-repeat map | intent/action/context/conversationId | `{text,url,type,intent}` | global anti-repeat map | widget buttons, WA inline CTA |
| Journey Stage | server pipeline | journey analyzer, lead system | message | stage string | persists lead journey | sales pressure, CTA, lead capture |
| Intent Detection | SuperInteligência, V18/V19, Decision Engine | keyword/rules/LLM context | message/pageData/state | intelligence flags/intent | sets force flags/logs | CTA, KB, scheduler, lead capture |
| KB First | process-chat | knowledge base/FAQ matching | message/pageData | direct JSON response | bypasses LLM and later layers | CTA/capture/scheduler ordering |
| Conversation State | V11/V14/V17/lead system | in-memory/state stores | conversationId/leadId/messages | history/state | stores context | V17 prompt, CTA anti-repeat, lead sync |
| Checkout Discovery | process-chat/extraction | V11 discovery, DB checkout, V18 guard, link resolver | URL/pageData/apiKey | checkoutLink/source/link map | writes pageData | CTA, WA, widget conversion |
| Action Resolver | V11 pipeline | links map/state | message/pageData/state | action decision | state update | orchestrator/CTA |
| Decision Engine | server prompt/post-processing | sales decision modules, V16/V19 | intent, journey, count, pageData | action/urgency/strategy/response patch | bypass flags/response mutation | CTA/sales/final response |
| Observer Layer | process-chat/WA/widget | audit logs, analytics, learning, parity audit | events/responses | logs/scores | telemetry, learning records | future behavior via learning/score |

## Fluxos paralelos e gates críticos

1. **WhatsApp:** provider webhook e pipeline HTTP interno rodam fora do navegador, mas dependem do mesmo contrato de `/api/process-chat-inteligente`.
2. **Widget:** render de CTA, lead capture inline, calendar widget e track-conversion rodam em paralelo com a conversa.
3. **Checkout:** widget checkout, DB confirmed checkout, WA promoter, V18 guard e discovery disputam a mesma propriedade `checkoutLink`.
4. **Decision:** V17, V19, V18.x, V11, orchestrator V10 e sales layers podem alternar autoridade por flags.
5. **Observers:** analytics, parity audit, auto-learning e lead score observam e podem indiretamente modular comportamento futuro.

## Gates/early returns críticos

- Mensagem ausente retorna 400.
- Canal WA `off` notifica dono e retorna.
- WA sem resposta da IA envia fallback e retorna.
- Link curto inválido/não encontrado retorna 404.
- Scheduler priority retorna JSON antes de KB/IA.
- KB First retorna JSON direto.
- CTA Engine `applyCTA` retorna sem mudança se já existe CTA/link ou CTA inválido.
- Sales Layer retorna sem mudança em `off`, manual sem preset, sarcasmo ou complemento inaplicável.

## Feature flags críticas

`FEATURE_V17_BRAIN`, `FEATURE_DETERMINISTIC_V19`, `FEATURE_V18_EXTRACTION_GUARD`, `FEATURE_V18_FALLBACK`, `FEATURE_SMART_CTA`, `FEATURE_CHAT_FIRST`, `FEATURE_ORCHESTRATOR_V10`, `FEATURE_V11_ENGINE`, `FEATURE_AUTO_CHECKOUT_DETECTION`, `FEATURE_CHECKOUT_AUTHORITY`, `FEATURE_CLEAN_CHAT_V2`, `FEATURE_AUTO_LEARNING`, `WA_USE_FULL_PIPELINE`.
