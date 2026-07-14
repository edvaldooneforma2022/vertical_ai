# DATA FLOW MASTER MAP — Link Mágico

> Documento baseado exclusivamente na leitura do código real do repositório. Não contém correções, sugestões ou patches.

## 1. Visão geral

O Data Flow do Link Mágico é o conjunto de rotas, middlewares, caches, persistências e motores de decisão que recebem dados de canais de entrada (link curto, widget/chat web e WhatsApp), enriquecem esses dados com contexto de página, histórico, lead, plano, knowledge base e sinais conversacionais, e retornam uma resposta para o usuário final.

**Objetivo técnico:** transformar uma entrada de usuário em uma resposta contextualizada, rastreável e multi-tenant, protegida por API key/session/widget token, respeitando limites de billing, usando cache quando possível e persistindo eventos, leads, assistentes, agendamentos e configurações.

**Objetivo comercial:** capturar leads, conduzir conversas de venda, responder dúvidas, detectar intenção de compra/suporte, exibir CTA/checkout/WhatsApp/calendário e registrar analytics para operação SaaS.

**Papel arquitetural:** o `server.js` concentra o fluxo conversacional principal e integra módulos auxiliares: banco, cache, billing, analytics, short URL, WhatsApp, scheduling, knowledge base, journey analyzer e captura de inteligências. Os canais convergem para `/chatbot`, `/api/chat-universal`, `/api/process-chat-inteligente` ou webhooks públicos.

**Como os dados se movem:** entrada HTTP → validação/middleware → resolução de tenant/API key → cache/banco → extração de página quando há URL → construção de contexto (`pageData`, `cleanText`, FAQ, histórico, lead) → análise emocional/intenção/jornada → interceptações prioritárias (suporte, compra, knowledge base, agenda) → IA/local fallback → pós-processamento/CTA/calendário → persistência de conversa/uso/analytics → resposta JSON ou HTML.

## 2. Inventário global de fluxos

| Fluxo | Entrada | Transformação | Saída/Persistência | Arquivos |
|---|---|---|---|---|
| Link Curto | `POST /api/create-short-url`, `GET /l/:shortCode` | valida billing, gera código, cacheia, redireciona | `short_urls`, cache `short_url:*`, analytics | `server.js`, `short-url-generator.js`, `database.js`, `cache.js` |
| Widget | HTML `/chatbot` e JS público | coleta lead/mensagem, chama APIs | lead, conversa, resposta | `server.js`, `public/widget.js`, `public/widget-v2.js`, `widget-token.js` |
| WhatsApp | `/api/webhook/evolution`, config WA | resolve instância/tenant/lead, processa texto | conversa/resposta/estado | `server.js`, `whatsapp-routes.js`, `database.js` |
| Scheduler | intenção de agenda ou `[CALENDAR_WIDGET]` | gera hash público, slots, booking | `tenant_availability`, `tenant_blocked_dates`, appointments | `server.js`, `scheduling-manager.js`, `database.js` |
| CTA Engine | intenção de compra/suporte/checkout/WhatsApp | resolve link/contato/calendário | resposta com link/CTA | `server.js`, `modules/utils/sistema-captura-inteligencias.js` |
| Lead Capture | `/api/capture-lead`, calendário/widget | cria/atualiza lead/conversa | JSON/data e/ou DB conforme helper | `server.js`, `modules/leads/*`, `database.js` |
| Journey Stage | mensagem | keywords → `descoberta/negociacao/fidelizacao` | lead + retorno | `modules/leads/journey-analyzer.js`, `server.js` |
| Intent Detection | mensagem | heurísticas de flags | consumidores de CTA/observer/IA | `modules/utils/sistema-captura-inteligencias.js`, `server.js` |
| Observer Layer | flags de intenção | loga sinais sem interceptar | logs/telemetria | `server.js` |
| Decision Core | sinais + contexto | prioridade: agenda/suporte/compra/KB/IA | ação final | `server.js` |
| Conversation State | `leadId`, `conversationId`, memória V14 | identidade híbrida e histórico | lead + context layer | `server.js` |
| Analytics | eventos/requests/short URL | trackEvent/métricas | DB/memória/cache | `analytics/*`, `server.js`, `routes.js` |
| Billing | API key/plano/uso | valida limites, track usage | billing state/eventos | `billing.js`, `billing-enforcement.js`, `stripe-routes.js`, `server.js` |
| Cache | extração, short URL, rate limit | Redis ou Map fallback | cache TTL | `cache.js`, `server.js` |
| Banco | tenants/api_keys/short_urls/etc. | PostgreSQL ou SQLite | tabelas/migrations | `database.js` |
| Extração | URL | axios+cheerio, regex, contatos, checkout | `pageData` em cache/contexto | `server.js`, `crawl4ai_*` |

## 3. Fluxo principal da mensagem

```text
Mensagem do usuário
↓
POST /api/chat-universal ou /api/process-chat-inteligente
↓
requireApiKey / widget token / billingMiddleware
↓
normalização de body: message, url, pageData, instructions, leadId, conversationId, robotName, apiKey
↓
se necessário: extractPageData(url)
↓
pré-decisões: agenda, suporte, compra, buyer state, knowledge base
↓
intent detection + journey stage + emoção/persona
↓
generateAIResponse(...) ou generateLocalResponse(...)
↓
pós-processamento emocional, calendarHash, auto-learning
↓
updateLeadConversation / trackUsage / retorno JSON
```

Arquivos envolvidos: `server.js` (rotas, extração, decisão e resposta), `database.js` (persistência), `cache.js` (cache), `billing.js`/`billing-enforcement.js` (uso/limites), `modules/leads/journey-analyzer.js`, `modules/utils/sistema-captura-inteligencias.js`, `knowledge-base.js`, `scheduling-manager.js`, `analytics/*`.

## 4. Fluxo Link Curto

```text
POST /api/create-short-url
↓
validação apiKey + robotName + salesUrl
↓
verificação de limite de assistentes no billing
↓
ShortUrlGenerator.generateUnique(...)
↓
DatabaseHelpers.createShortUrl(...)
↓
CacheManager.set(short_url:<code>)
↓
analyticsManager.trackEvent(short_url_created)
↓
retorno shortUrl

GET /l/:shortCode
↓
ShortUrlGenerator.isValid
↓
CacheManager.get(short_url:<code>)
↓ miss
DatabaseHelpers.getShortUrl
↓
CacheManager.set(...)
↓
DatabaseHelpers.updateShortUrlAccess async
↓
analytics short_url_accessed
↓
whitelabelManager.getConfig
↓
redirect /chatbot?name&url&instructions&apiKey&wl...
```

## 5. Fluxo Widget

```text
Usuário abre /chatbot ou widget público
↓
server gera HTML com parâmetros: robotName, url, instructions, apiKey, whitelabel
↓
frontend coleta lead ou inicia conversa
↓
POST /api/capture-lead
↓
lead criado e id retornado
↓
POST /api/process-chat-inteligente ou /api/chat-universal
↓
fluxo principal da mensagem
↓
resposta exibida no widget; se houver [CALENDAR_WIDGET], widget usa calendarHash para buscar slots
```

O widget usa a API como canal de transporte; a decisão fica no servidor. `widget-token.js` pode registrar middleware antes de `requireApiKey`.

## 6. Fluxo WhatsApp

```text
Mensagem WhatsApp
↓
Webhook público /api/webhook/evolution ou /api/webhook/twilio
↓
rota permitida sem requireApiKey global por prefixo /api/webhook/
↓
resolução de instância/configuração em whatsapp_settings/api_keys
↓
resolução/criação de lead/conversationId
↓
injeção de conversationId em pageData para identidade híbrida
↓
processamento pelo core conversacional
↓
CTA/checkout/suporte/scheduler conforme intenção
↓
resposta enviada ao provedor WhatsApp
```

`whatsapp-routes.js` cuida da configuração SaaS, conexão com Evolution, webhook URL, status, reconexão e cache local de configuração. O `server.js` torna `/api/webhook/*` público no middleware global.

## 7. Fluxo de extração

```text
URL
↓
extractPageData(url)
↓
cache local getCacheData(url)
↓ miss
axios.get com headers e timeout
↓
cheerio.load(html)
↓
remoção de script/style/noscript/iframe
↓
extractCleanTextFromHTML(html)
↓
summary por sentenças
↓
extractBonuses / extractPrices / extrairContatosAprimorado
↓
heurística de checkout e WhatsApp em links/onclick/RSC
↓
fallback Puppeteer/crawl/fallback mínimo quando aplicável
↓
setCacheData(url, extractedData)
↓
pageData.cleanText/contexto IA
```

Arquivos principais: `server.js` contém `extractPageData`, retry e helpers; `crawl4ai_bridge.js`, `crawl4ai_extractor.py`, `crawl4ai_script.py` aparecem como camadas de extração auxiliares; `cache.js` fornece cache genérico, embora `extractPageData` também use cache local do servidor.

## 8. Fluxo de contexto

O contexto chega à IA por `processedPageData` e parâmetros explícitos:

- `pageData`: enviado pelo cliente ou produzido por `extractPageData(url)`.
- `cleanText`: extraído do HTML e usado como conteúdo textual da página.
- `chunks`: não há pipeline central nomeado de chunking no core principal; o código usa `cleanText`, `summary`, FAQ/KB e dados estruturados. Arquivos `analytics` e `knowledge-base.js` mantêm armazenamento/busca de conhecimento; a documentação real deve tratar “chunks” como contexto textual derivado, não como etapa formal universal.
- histórico: lead conversations e V14 context layer (`addMessage`, `getHistory`, `saveProductInfo`) quando feature flag ativa.
- estado: `leadId`, `conversationId`, buyer state em memória, journey stage, emoção e flags de intenção.
- memória: lead JSON/DB, `conversation_memory`, `learning_conversations` e auto-learning quando habilitado.

Caminho completo: request → `processedPageData` → possível injeção de `conversationId` → `generateAIResponse(message, processedPageData, [], instructions, effectiveLeadId, apiKey, robotName)` → resposta final.

## 9. Fluxo de Intent Detection

```text
Mensagem
↓
SistemaCapturaInteligencias.capturarInteligencias
↓
flags: contatoDireto, linkSite, bonus, detalhesBonus, experiencia, suporte
↓
server.js adiciona interceptações específicas: compra direta, suporte humano, saída, agenda
↓
consumidores: observer layer, CTA, resposta contextual, IA, auto-learning, logs de auditoria
```

Persistência direta das flags não é centralizada em tabela própria; os resultados entram em logs, resposta JSON (`inteligenciasDetectadas`), lead/conversa e auto-learning quando habilitado.

## 10. Fluxo de Journey Stage

```text
Mensagem
↓
JourneyAnalyzer.analyzeJourneyStage
↓
score por keywords
↓
resultado: descoberta, negociacao ou fidelizacao
↓
leadSystem.updateLeadJourneyStage(effectiveLeadId, journeyStage)
↓
consumidores: personalidade, resposta local/contextual, auto-learning, retorno da API
```

Dependências: `server.js` instancia e chama `journeyAnalyzer`; `modules/leads/journey-analyzer.js` define keywords e `shouldMentionBonus`.

## 11. Fluxo do Observer Layer

```text
Evento conversacional / flags detectadas
↓
Camada V20 observadora em server.js
↓
marca wouldBypassLegacy e legacyReason
↓
loga sinais, mas não intercepta
↓
LLM continua respondendo
```

O observer real é uma camada de log/telemetria sobre antigas condições de bypass; não é uma fila externa nem serviço separado.

## 12. Fluxo do Decision Core

```text
Sinais: mensagem + pageData + lead + histórico + KB + intent + journey + billing
↓
Priorização observada:
1. rotas/middleware/autenticação/billing
2. extração/contexto
3. agenda prioritária quando detectada
4. suporte hard override
5. compra direta com checkoutLink
6. KB-FIRST FAQ direta
7. despedida
8. observer layer
9. IA principal
10. pós-processamento, calendarHash, auto-learning
↓
Ação: resposta direta, checkout, suporte, calendário ou IA
```

## 13. Fluxo do CTA Engine

```text
Detecção
↓
intenção de compra, suporte, contatoDireto, linkSite, bonus, [CALENDAR_WIDGET]
↓
Resolução
↓
checkoutLink/whatsappLink/contatos/site/calendarHash
↓
Validação
↓
existência no pageData ou contatos extraídos; hash público gerado pelo scheduler
↓
Exibição
↓
texto com link, WhatsApp, site, bônus ou calendário interativo
```

Consumidores: widget web, WhatsApp, resposta JSON, lead conversation e analytics indiretamente.

## 14. Fluxo do Lead Capture

```text
Dados de lead ou interação de calendário
↓
POST /api/capture-lead ou resolução por conversationId
↓
LeadCaptureSystem.addLead / findLeadByConversationId
↓
updateLeadConversation(user/assistant)
↓
updateLeadJourneyStage
↓
persistência em arquivo por tenant e/ou helpers DB conforme caminho
```

Regras reais observadas: lead pode ser atualizado por `leadId`; se não houver `leadId`, o `conversationId` pode localizar lead existente; conversas registram usuário e assistente; stage é atualizado após classificação.

## 15. Fluxo do Scheduler

```text
Intenção de agendamento ou resposta contém [CALENDAR_WIDGET]
↓
schedulingManager.generatePublicHash(apiKey)
↓
frontend usa calendarHash
↓
resolveApiKeyFromHash(publicHash)
↓
getPublicSlots(tenantId)
↓
getAvailability + getBlockedDates + appointments ocupados
↓
slots ou fallback padrão
↓
booking persiste appointment/lead conforme rota de calendário
```

Persistência: `tenant_availability`, `tenant_blocked_dates` e tabela de appointments usada em consulta de ocupação; cache interno de disponibilidade por 1 minuto.

## 16. Fluxo de Analytics

```text
Eventos HTTP/negócio
↓
analyticsManager.trackEvent ou contadores runtime
↓
agregação por tenant/chatbot
↓
persistência/adapters analytics
↓
rotas em routes.js: /api/analytics/:chatbotId e export
↓
dashboards públicos/admin
```

Produtores: short URL created/accessed, extrações, leads, conversas, billing/admin. Consumidores: dashboards, healthcheck, exports e relatórios.

## 17. Fluxo de Cache

```text
Leitura
↓
CacheManager.get / getCacheData / cache interno scheduler
↓
Hit: retorna objeto/string parseado
↓
Miss: banco, extração ou cálculo
↓
Atualização: CacheManager.set/cacheExtraction/setCacheData/map.set
```

Camadas: Redis se `REDIS_URL`/`USE_REDIS`; fallback Map in-memory; cache local de extração no `server.js`; cache do scheduler em `SchedulingManager.cache`; cache de short URL com TTL 1h; cache de extração no módulo `cache.js` com TTL 24h; response cache com TTL 1h.

## 18. Fluxo de banco de dados

- **PostgreSQL:** escolhido quando `DATABASE_URL` ou `USE_POSTGRES=true`; usa `pg.Pool` com limite 20, SSL em produção.
- **SQLite:** fallback de desenvolvimento em `data/linkmagico.db`, WAL habilitado.
- **JSON Storage:** conhecimento, leads e dados locais aparecem como fallback/cache em módulos; migrations criam `tenant_knowledge`, `learning_conversations` e demais tabelas para persistência mais estável.
- **Backups:** há documentação e rotas/admin de backup de leads no código legado; fluxo de dados depende de lead system.
- **Multi-tenant:** `tenants`, `api_keys`, `tenant_uuid`, `api_key`, `key_hash`, `short_urls`, `whatsapp_settings`, CRM, billing e knowledge isolam dados por tenant/API key.

## 19. Fluxo de Billing

```text
Plano/subscription
↓
billingManager.getSubscription(apiKey)
↓
limites: mensagens, chatbots, features
↓
billingMiddleware nas rotas de chat
↓
validação em create-short-url para maxChatbots
↓
execução permitida ou 429
↓
billingManager.trackUsage(apiKey, 'messages')
```

Dependências: `billing.js`, `billing-enforcement.js`, `stripe-routes.js`, `admin-routes.js`, `billing-audit.js`, `server.js`.

## 20. Matriz global de dados

| Origem | Transformação | Consumidor | Persistência | Arquivo responsável |
|---|---|---|---|---|
| URL de venda | extração HTML → pageData | IA/CTA/checkout | cache | `server.js` |
| Mensagem usuário | limpeza/análise | Decision Core | lead/history | `server.js` |
| API key | validação tenant/plano | middleware/billing | session/db | `server.js`, `database.js` |
| Short URL | código → config assistente | redirect/widget | `short_urls`/cache | `server.js`, `database.js` |
| Lead form | addLead | chat/scheduler/admin | lead storage | `server.js` |
| Intent flags | heurísticas | CTA/observer/IA | logs/JSON response | `sistema-captura-inteligencias.js` |
| Journey | keywords | persona/lead/learning | lead/learning | `journey-analyzer.js` |
| KB | searchSmart | resposta direta/contexto | tenant_knowledge/files | `knowledge-base.js` |
| Billing event | track usage | limits/admin | billing/audit | `billing.js`, `billing-audit.js` |
| Analytics event | trackEvent | dashboard/export | analytics store | `analytics/*`, `routes.js` |
| WhatsApp settings | Evolution config | webhook/status | whatsapp_settings | `whatsapp-routes.js` |
| Disponibilidade | slots públicos | widget calendário | scheduler tables | `scheduling-manager.js` |

## 21. Dependências ocultas

- `GET /l/:shortCode` atualiza contador de acesso de forma assíncrona: side effect não bloqueante.
- Criação de short URL limpa cache de checkout por tenant quando função/flag existe.
- `/api/webhook/*` é público por regra do middleware global, então depende da validação interna dos webhooks.
- O contexto V14 grava histórico e produto apenas quando feature flag está ativa.
- `buyer state` é Map em memória por conversationId, expira em 15 minutos e influencia compra futura.
- `KB-FIRST` pode bypassar todo o restante do pipeline quando encontra FAQ forte.
- Auto-learning roda `setImmediate`, ou seja, registra depois da resposta sem bloquear.
- Scheduler injeta `calendarHash` apenas se a resposta final contém `[CALENDAR_WIDGET]` ou em caminhos prioritários de agenda.

## 22. Pontos de gargalo

- **Extração:** `axios` com timeout de 30s, parse Cheerio e eventuais fallbacks/crawlers; páginas grandes aumentam CPU/memória.
- **IA:** `generateAIResponse` é ponto central e dependente de contexto/LLM/KB; chamadas externas podem dominar latência.
- **Banco:** `pg.Pool` max 20; queries de `resolveApiKeyFromHash` varrem todas as API keys ativas e calculam hash em memória.
- **Cache:** fallback in-memory perde dados em restart e não compartilha entre instâncias.
- **Scheduler:** disponibilidade fica em Map por tenant e consultas de appointments podem crescer se não indexadas conforme tabela real.
- **Server monolítico:** `server.js` concentra muitas responsabilidades, elevando custo de leitura e risco de regressão.

## 23. Pontos de falha

| Risco | Classificação | Evidência funcional |
|---|---:|---|
| `server.js` indisponível | ALTO | centraliza rotas, extração, decisão, widget, short URL e resposta |
| Banco indisponível | ALTO | API keys, tenants, short URLs, billing, scheduler e settings dependem dele |
| LLM/IA indisponível | ALTO | fluxo principal depende de `generateAIResponse`, embora existam interceptações/fallback local |
| Redis/cache indisponível | MÉDIO | há fallback in-memory, mas perde performance/compartilhamento |
| Extração de página falha | MÉDIO | há fallback, mas CTA/checkout/contexto podem ficar pobres |
| Webhook WhatsApp sem validação interna | MÉDIO | rota é pública pelo middleware global |
| Analytics falhar | BAIXO | normalmente loga erro e não bloqueia resposta |
| Auto-learning falhar | BAIXO | fire-and-forget e protegido por try/catch |

## 24. Matriz de propriedade

| Fluxo | Produz | Consome | Modifica | Persiste | Depende |
|---|---|---|---|---|---|
| Link Curto | dashboard/API | usuário final/widget | access_count/cache | DB/cache | billing/db/cache |
| Widget | browser | server chat APIs | DOM/local state | lead/conversa | apiKey/token |
| WhatsApp | Evolution/Twilio | webhook/core | lead/conversation | DB/settings | provedor WA |
| Extração | URL/HTML | IA/CTA | pageData | cache | rede/HTML |
| Intent | mensagem | decision/CTA | flags | logs/response | heurísticas |
| Journey | mensagem | persona/lead | stage | lead/learning | keywords |
| Lead | form/chat | admin/chat | conversations/stage | JSON/DB | tenant/apiKey |
| Scheduler | intenção/calendário | widget | slots/bookings | DB | hash/apiKey |
| Billing | Stripe/admin/API | middleware | plan/usage | DB/audit | apiKey |
| Analytics | eventos | dashboards | métricas | store/db | tenant/chatbot |

## 25. Diagrama global

```text
Usuário
↓
Canal: Link Curto / Widget / WhatsApp
↓
Express server.js
↓
Middleware público ou requireApiKey + widget token + billing
↓
Tenant/API key/session
↓
Lead/conversationId/pageData/url/instructions
↓
Cache
├─ hit: shortUrl/pageData/slots
└─ miss: DB ou extração
↓
Extração de página: axios + cheerio + cleanText + contatos + checkout
↓
Knowledge Base + histórico + estado
↓
Intent Detection + Journey Stage + emoção/persona
↓
Decision Core
├─ Scheduler
├─ Suporte
├─ Compra/checkout
├─ KB-FIRST
├─ Despedida
└─ IA principal
↓
CTA Engine / calendarHash / resposta textual
↓
Persistências: lead, usage, analytics, learning, access_count
↓
Resposta JSON, HTML, redirect ou envio WhatsApp
```

## 26. Arquivos críticos

| Classe | Arquivo | Motivo |
|---|---|---|
| CRÍTICO ABSOLUTO | `server.js` | núcleo HTTP, autenticação, extração, chat, decisão, short URL, widget e webhooks |
| CRÍTICO ABSOLUTO | `database.js` | seleção PostgreSQL/SQLite, migrations e helpers multi-tenant |
| CRÍTICO | `billing.js` / `billing-enforcement.js` | limita execução comercial e registra uso |
| CRÍTICO | `cache.js` | Redis/fallback, rate limit e cache operacional |
| CRÍTICO | `scheduling-manager.js` | calendário público, hash e slots |
| CRÍTICO | `whatsapp-routes.js` | configura canal WhatsApp SaaS e webhook Evolution |
| IMPORTANTE | `knowledge-base.js` | KB-first e contexto/resposta direta |
| IMPORTANTE | `modules/utils/sistema-captura-inteligencias.js` | flags de intenção e respostas contextuais |
| IMPORTANTE | `modules/leads/journey-analyzer.js` | classificação de jornada |
| IMPORTANTE | `analytics/*` | métricas, dashboards, learning e performance |
| SUPORTE | `short-url-generator.js` | geração/validação de códigos curtos |
| SUPORTE | `public/widget*.js`, `public/chat.html` | clientes de entrada/exibição |

## 27. Comparação entre canais

| Aspecto | Link Curto | Widget | WhatsApp |
|---|---|---|---|
| Entrada | `GET /l/:code` | página/widget + APIs | webhook provedor |
| Primeiro dado | shortCode | lead/mensagem/url | número/mensagem/instância |
| Resolução tenant | `short_urls.api_key` | apiKey/token/session | settings/instância/API key |
| Persistência inicial | access_count + analytics | lead + conversa | lead/conversation/settings |
| Decisão | redireciona para chat | core conversacional direto | core conversacional após webhook |
| Extração | via `/chatbot?url=` | via URL/pageData | via config/contexto da conversa |
| Resposta | redirect/HTML | JSON exibido no widget | envio ao WhatsApp |
| CTA | prepara robot/url/instructions | checkout/WhatsApp/calendário | checkout/WhatsApp/calendário em texto |

## 28. Conclusão executiva

Os dados trafegam pelo Link Mágico a partir de canais independentes que convergem para o `server.js`. O sistema resolve o tenant, aplica cache e billing, enriquece a mensagem com dados extraídos da página, KB, lead e histórico, classifica intenção/jornada, executa uma árvore de decisão com interceptações prioritárias e só então chama a IA principal quando nenhuma resposta direta tem prioridade. A resposta retorna ao canal e side effects registram lead, analytics, billing, aprendizado, acesso de short URL e calendário.

Fluxos mais importantes: mensagem principal, extração de página, short URL, lead capture, billing, scheduler e WhatsApp. Os módulos com mais dependências são `server.js`, `database.js`, `billing.js`, `cache.js`, `knowledge-base.js` e `scheduling-manager.js`. Arquivos que exigem auditoria obrigatória antes de alteração: `server.js`, `database.js`, `billing.js`, `billing-enforcement.js`, `cache.js`, `whatsapp-routes.js`, `scheduling-manager.js`, `knowledge-base.js`, `modules/utils/sistema-captura-inteligencias.js` e `modules/leads/journey-analyzer.js`.

Maior risco arquitetural observado: concentração de fluxos críticos em `server.js`, dependência do banco para identidade multi-tenant/short URLs/billing/scheduler, dependência da IA para qualidade da resposta e múltiplos side effects assíncronos que podem alterar métricas/estado sem bloquear a resposta.
