# INTEGRATION_MASTER_MAP — Link Mágico

Documento baseado exclusivamente em evidências do código da plataforma SaaS Link Mágico. Não inclui recomendações, correções ou patches.

## 1. Visão geral

Integrações externas são todos os pontos em que a aplicação depende de APIs, SDKs, serviços cloud, protocolos externos, bancos, caches, webhooks, provedores de IA, comunicação, cobrança, scraping remoto ou recursos de terceiros para entregar funcionalidades. Arquiteturalmente, elas ficam concentradas em módulos de orquestração do servidor (`server.js`), persistência (`database.js`), cache (`cache.js`), LLM (`llm-optimizer.js`, `chatgpt-integration.js`), canais (`whatsapp-integration.js`, `gmail-integration.js`) e monetização (`billing.js`, `stripe-routes.js`).

Serviços externos necessários para funcionamento completo:

- LLMs: Groq, OpenAI/ChatGPT e OpenRouter.
- WhatsApp: Twilio WhatsApp e/ou Evolution API.
- Email: Gmail/SMTP via Nodemailer.
- Dados: PostgreSQL em produção, SQLite como fallback/dev.
- Cache/rate limit: Redis, com fallback em memória.
- Extração: sites-alvo via HTTP, Crawl4AI Docker/Python, Puppeteer/Chromium, Google Cache e Jina Reader.
- Billing: Stripe; PayPal/PagSeguro aparecem apenas como preparados/não implementados.
- Webhooks: destinos HTTP configurados por tenant/chatbot e webhooks recebidos do Stripe, Evolution e Twilio.
- Autenticação: JWT, API keys, sessões e secrets locais/ambiente.

Dependência operacional: chat, captura de lead, CTA, scraping, calendário, CRM e notificações dependem dessas integrações. Dependência comercial: IA, WhatsApp, captura de leads, checkout e billing sustentam venda/retensão. Dependência financeira: Stripe e os custos de LLMs são os pontos explícitos de monetização/custo.

## 2. Inventário global de integrações

| Integração | Arquivo/linha | Finalidade | Criticidade |
|---|---:|---|---|
| Groq API | `server-melhorado.js:1667`, `server_backup.js:550` | Provedor LLM primário/fallback histórico. | CRÍTICO |
| OpenAI API | `chatgpt-integration.js:9`, `chatgpt-integration.js:75`, `server-melhorado.js:1711` | ChatGPT/GPT para respostas IA. | ALTO |
| OpenRouter API | `server-melhorado.js:1689`, `server_backup.js:573` | Provedor LLM intermediário/fallback. | ALTO |
| Twilio WhatsApp | `whatsapp-integration.js:140` | Envio WhatsApp via API Twilio. | ALTO |
| Evolution API | `whatsapp-integration.js:179`, `whatsapp-channel.js:101` | Envio e recebimento WhatsApp. | CRÍTICO para WhatsApp |
| Gmail/SMTP | `gmail-integration.js:4`, `gmail-integration.js:84` | Emails automáticos/notificações. | MÉDIO |
| PostgreSQL | `database.js:20`, `database.js:24` | Banco principal em produção. | CRÍTICO ABSOLUTO |
| SQLite | `database.js:40`, `database.js:51` | Banco local/desenvolvimento/fallback. | SUPORTE |
| Redis | `cache.js:12`, `cache.js:25` | Cache, rate limit e filas assíncronas. | ALTO |
| Cache in-memory | `cache.js:64`, `cache.js:67` | Fallback do Redis. | SUPORTE |
| Stripe | `billing.js:145`, `stripe-routes.js:35`, `routes.js:444` | Checkout, planos e webhooks de pagamento. | CRÍTICO comercial |
| Webhooks HTTP externos | `webhooks.js:31`, `webhooks.js:167` | Disparo para URLs configuradas. | MÉDIO/ALTO |
| Crawl4AI | `crawl4ai-adapter.js:20`, `crawl4ai-adapter.js:83` | Scraping via serviço Docker/API local. | MÉDIO |
| Puppeteer/Chromium | `lib/puppeteer-client.js:61`, `lib/puppeteer-extractor.js:21` | Renderização JS-heavy. | MÉDIO/ALTO para extração |
| Google Cache | `lib/puppeteer-extractor.js:34` | Fallback de extração pré-renderizada. | MÉDIO |
| Jina Reader | `lib/puppeteer-extractor.js:75` | Fallback remoto de leitura/renderização. | MÉDIO |
| Tesseract.js | `enhanced-content-extractor.js:15` | OCR local em imagens. | BAIXO/MÉDIO |
| Nodemailer | `gmail-integration.js:4`, `email-service.js`, `weekly-report.js` | Transporte SMTP. | MÉDIO |
| node-cron | `package.json:172`, `lib/v14-pattern-analyzer.js:173` | Agendamentos periódicos internos. | MÉDIO |
| JWT | `auth-system.js:2`, `auth-system.js:7` | Autenticação por token. | ALTO |

## 3. OpenAI

Consumidores:

- `chatgpt-integration.js`: módulo dedicado; base URL `https://api.openai.com/v1`, modelos `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`, default `gpt-4-turbo`; chama `/chat/completions` via Axios.
- `server-melhorado.js`/`server_backup.js`: funções históricas com `OPENAI_API_KEY`, `OPENAI_MODEL` e `OPENAI_API_BASE`.
- `chatgpt-routes.js` e UI de `add-v3-tabs.js`: status, modelos, teste e configuração de ChatGPT.

Chaves:

- `CHATGPT_API_KEY` inicializa o singleton do módulo ChatGPT.
- `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_API_BASE` aparecem em fluxos legados/servidores backup.
- `chatgpt_settings.openai_api_key` é configuração por tenant buscada em banco.

Modelos usados:

- `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo` no módulo ChatGPT.
- `OPENAI_MODEL || gpt-3.5-turbo` em servidor legado.

Fluxos dependentes: respostas de chat com contexto, continuação de conversa, teste de conexão, escolha/recomendação de modelo e fallback global quando tenant não possui configuração própria.

Fallbacks existentes: se tenant não tem configuração, usa instância global; se erro ao buscar tenant, usa global; em servidores legados, OpenAI é chamado depois de Groq/OpenRouter. Sem OpenAI, falham respostas que dependam exclusivamente do ChatGPT configurado por tenant; no fluxo legado, o impacto é reduzido quando Groq/OpenRouter estão disponíveis.

## 4. Groq

Consumidores: servidores legados/backup e `llm-optimizer.js`. Modelos: `llama3-8b-8192`, `llama3-70b-8192`, `llama-3.1-70b-versatile` e env `GROQ_MODEL`. Fluxos: chat universal, perguntas simples/médias/complexas no otimizador, fallback primário em servidores antigos. Estratégia: Groq é recomendado como primeiro provedor pelo otimizador; se falha, fluxos legados tentam OpenRouter e depois OpenAI. Impacto real: indisponibilidade degrada IA principal e aumenta custo se cair para OpenAI/OpenRouter.

## 5. OpenRouter

Consumidores: servidores legados/backup; tabelas de custo em `llm-optimizer.js`. Modelos: `mistralai/mistral-7b-instruct`, `anthropic/claude-3`, `meta-llama/llama-3`, env `OPENROUTER_MODEL`. Papel: fallback entre Groq e OpenAI. Estratégia: chamado quando Groq não produziu resposta; se também falhar, tenta OpenAI. Impacto: falha aumenta dependência final da OpenAI; não derruba IA se Groq ou OpenAI funcionarem.

## 6. LLM orchestration

Fluxo real encontrado:

1. Classificação de complexidade da pergunta (`simple`, `medium`, `complex`).
2. Recomendação de Groq como provedor preferencial com modelos pequenos/grandes conforme complexidade.
3. Cache de respostas por hash/similaridade com TTL configurável.
4. Registro de custos por provedor/modelo.
5. Fallback legado: Groq → OpenRouter → OpenAI.
6. Fallback de tenant ChatGPT: configuração do tenant → configuração global.

Prioridade observada: custo/latência favorecem Groq; OpenRouter aparece como fallback intermediário; OpenAI aparece como fallback premium/tenant ChatGPT.

## 7. WhatsApp

APIs:

- Twilio: `https://api.twilio.com/2010-04-01/Accounts/{accountSid}/Messages.json`, payload form-url-encoded com `To`, `From`, `Body`, autenticação Basic Auth por Account SID/Auth Token.
- Evolution Go: `${apiUrl}/send/text`, payload JSON `{ number, text }`, autenticação header `apikey`.
- Evolution Channel: webhook `/api/webhook/evolution`; Twilio compatível em rota de webhook de canal.

Eventos recebidos: mensagens Evolution (`messages.upsert`/formatos Evolution Go e v1), mensagens Twilio inbound. Eventos enviados: novo lead, alta intenção, resumo diário, respostas do bot para WhatsApp.

Dependências: envs `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`, `CENTRAL_EVOLUTION_URL`, `CENTRAL_EVOLUTION_API_KEY`, `NOTIFICATION_PHONE`, `ADMIN_PHONE`. Pontos de falha: credenciais ausentes, Evolution central fora, Twilio fora, tenant não resolvido, número inválido.

## 8. Gmail

Integração é SMTP/Gmail via Nodemailer, não uma implementação OAuth Gmail API. Usa `service = gmail`, `user`, `password`, `from` e autenticação por usuário/senha/app password. Tokens e refresh tokens OAuth não aparecem no módulo real. Consumidores: notificações de lead, email de boas-vindas e emails customizados. Riscos: credenciais ausentes impedem emails, mas o módulo retorna erro sem derrubar a aplicação.

## 9. Extração de conteúdo

- HTTP básico: Axios + Cheerio em diversos extratores/crawlers.
- Crawl4AI: modo Docker por `CRAWL4AI_DOCKER_URL`, fallback para script Python local, modo API declarado não implementado.
- Puppeteer: client singleton com `@sparticuz/chromium`/`puppeteer-core` e fallback para `puppeteer` padrão.
- Fallback remoto: Google Cache e Jina Reader.
- OCR: Tesseract.js em `enhanced-content-extractor.js`.

Dependências: acesso HTTP a sites-alvo, Chrome/Chromium, memória suficiente, Crawl4AI service, Jina/Google para fallback.

## 10. Redis

Consumidores: `cache.js`, rate limit middleware/cache manager, sessões em versões antigas, caches de extração/respostas comuns. Uso: cache 24h de extração, cache 1h de respostas comuns, contadores de rate limit por API key, queue/assincronia. Falha: `initializeCache` cai para cache em memória; em produção multi-instância isso reduz consistência, compartilhamento de rate limit e persistência temporária.

## 11. PostgreSQL

PostgreSQL é ativado por `DATABASE_URL` ou `USE_POSTGRES=true`; usa pool `pg`, SSL em produção e migrations/tabelas no boot. Tabelas citadas/criadas incluem `tenants`, `api_keys`, `chatbots`, `whatsapp_settings`, `short_urls`, `tenant_leads`, `tenant_appointments`, `crm_pipelines`, `crm_leads`, `crm_activities`, `crm_deals`, `followup_rules`, `followup_jobs`, `crm_automation_rules`, `crm_webhooks`, `chatgpt_settings`, `conversation_memory`, `audit_logs`, `tenant_knowledge`, `tenant_availability`, `tenant_blocked_dates`. Consumidores: autenticação/API keys, billing/Stripe, CRM, WhatsApp settings, ChatGPT tenant settings, scheduler, analytics/leads/memória.

## 12. JSON Storage

Arquivos persistidos/consumidos:

- `data/api_keys.json`: self-service signup e API keys locais.
- `api-keys.json`: chaves legadas.
- `data/feature_flags.json`: flags de produto.
- `data/usage.json`: uso local.
- Arquivos de teste/resultados em `tests/*.json`.

Papel atual: fallback/desenvolvimento/legado para configuração e estado simples, enquanto o banco concentra persistência SaaS.

## 13. Billing

Gateway real: Stripe. Integra checkout, plano atual, trial, webhook e colunas `stripe_customer_id`/`stripe_subscription_id`. APIs externas: Stripe SDK/API e webhook assinado. Validações: `STRIPE_WEBHOOK_SECRET`, `stripe-signature`, price IDs por plano. PayPal e PagSeguro aparecem somente como “preparado para integração”, sem fluxo implementado.

## 14. Analytics

Analytics internos aparecem como contadores/métricas de requisições, extrações, chats, leads, LLM stats, billing metrics e endpoint `/api/analytics`. Não foi encontrado SDK externo de analytics tipo Google Analytics/Segment. Monitoramento é interno por logs/status e métricas próprias.

## 15. Agendamento

Scheduler/calendário usa `scheduling-manager.js` com PostgreSQL/SQLite e hashes públicos por API key. Tabelas: `tenant_availability`, `tenant_blocked_dates`, `tenant_appointments`. Serviços externos de calendário (Google Calendar, Outlook) não aparecem implementados. `node-cron` existe como dependência e é citado em análise de padrões, mas o calendário público é DB-driven.

## 16. Autenticação

Mecanismos:

- JWT com `JWT_SECRET` em `auth-system.js`.
- Sessões Express com `SESSION_SECRET` em servidores.
- API keys por JSON/env/banco (`API_KEYS_JSON`, `api_keys`, `key_hash`).
- Admin key `ADMIN_SECRET_KEY`.
- Stripe webhook secret.
- Webhook outbound HMAC próprio.
- OAuth externo real não foi encontrado para Gmail; Gmail usa SMTP.

Fluxo: request valida token/API key/sessão, resolve tenant, consulta permissões/plano, chama módulo de negócio.

## 17. Webhooks

| Origem | Destino | Payload | Consumidor |
|---|---|---|---|
| Link Mágico | URL configurada por chatbot | `{ event, chatbotId, timestamp, data }` + headers HMAC | `webhooks.js` |
| Stripe | `/api/webhooks/stripe` e `/api/stripe/webhook` | evento Stripe assinado | `routes.js`, `stripe-routes.js` |
| Evolution API | `/api/webhook/evolution` | eventos de mensagem/instância | `whatsapp-channel.js` |
| Twilio WhatsApp | webhook compatível Twilio | `From`, `Body`/payload Twilio | `whatsapp-channel.js` |
| CRM interno | Webhooks CRM por `crm_webhooks` | eventos de estágio/lead | `lib/crm/crm-manager.js` |

## 18. Endpoints externos

- `https://api.openai.com/v1/chat/completions`
- `https://api.groq.com/openai/v1/chat/completions`
- `https://openrouter.ai/api/v1/chat/completions`
- `https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json`
- `${EVOLUTION_API_URL}/send/text`
- `${CENTRAL_EVOLUTION_URL}/...` rotas de instância/conexão/logout/envio
- `${CRAWL4AI_DOCKER_URL}/crawl`
- `https://webcache.googleusercontent.com/search?q=cache:{url}`
- `https://r.jina.ai/{url}`
- Stripe API via SDK
- Sites-alvo fornecidos pelo usuário para scraping/crawling
- Fontes/CDN em páginas estáticas: Google Fonts, Font Awesome
- Links externos de CTA reconhecidos: WhatsApp, Hotmart, Kiwify, Mercado Pago, Mercado Livre, redes sociais.

## 19. Chaves e segredos

| Variável | Finalidade | Consumidores |
|---|---|---|
| `DATABASE_URL` | PostgreSQL | `database.js`, módulos DB |
| `USE_POSTGRES` | Forçar PostgreSQL | `database.js` |
| `REDIS_URL` | Redis | `cache.js`, versões antigas |
| `USE_REDIS` | Forçar Redis | `cache.js` |
| `GROQ_API_KEY` | Groq LLM | servidores legados |
| `GROQ_MODEL` | Modelo Groq | servidores legados |
| `GROQ_API_BASE` | Base Groq custom | servidores legados |
| `OPENAI_API_KEY` | OpenAI legado | servidores legados |
| `OPENAI_MODEL` | Modelo OpenAI legado | servidores legados |
| `OPENAI_API_BASE` | Base OpenAI custom | servidores legados |
| `OPENROUTER_API_KEY` | OpenRouter | servidores legados |
| `OPENROUTER_MODEL` | Modelo OpenRouter | servidores legados |
| `OPENROUTER_API_BASE` | Base OpenRouter | servidores legados |
| `CHATGPT_API_KEY` | ChatGPT global | `chatgpt-integration.js` |
| `TWILIO_ACCOUNT_SID` | Twilio | `whatsapp-integration.js` |
| `TWILIO_AUTH_TOKEN` | Twilio | `whatsapp-integration.js` |
| `TWILIO_WHATSAPP_NUMBER` | Número remetente | `whatsapp-integration.js` |
| `EVOLUTION_API_URL` | Evolution tenant/global | WhatsApp |
| `EVOLUTION_API_KEY` | Evolution auth | WhatsApp |
| `EVOLUTION_INSTANCE_NAME` | Instância | WhatsApp |
| `CENTRAL_EVOLUTION_URL` | Evolution central | WhatsApp SaaS |
| `CENTRAL_EVOLUTION_API_KEY` | Auth central | WhatsApp SaaS |
| `GMAIL_USER`/`SMTP_USER` | SMTP user | Gmail/email workers |
| `GMAIL_PASSWORD`/`SMTP_PASS` | SMTP password | Gmail/email workers |
| `SMTP_FROM` | Remetente | email workers |
| `OWNER_EMAIL` | Destino lead | Gmail |
| `STRIPE_SECRET_KEY` | Stripe SDK | billing/stripe routes |
| `STRIPE_WEBHOOK_SECRET` | Assinatura webhook | routes/stripe |
| `STRIPE_PRICE_STARTER/PRO/BUSINESS` | Price IDs | `stripe-routes.js` |
| `STRIPE_TRIAL_DAYS` | Trial | `stripe-routes.js` |
| `STRIPE_TRIAL_PLAN` | Trial | `stripe-routes.js` |
| `APP_URL`/`PLATFORM_URL` | URLs checkout | `stripe-routes.js` |
| `JWT_SECRET` | JWT | `auth-system.js` |
| `SESSION_SECRET` | sessões/encryption fallback | servidores/lib |
| `ADMIN_SECRET_KEY` | rotas admin | `admin-routes.js` |
| `API_KEYS_JSON` | API keys em env | servidores |
| `ENCRYPTION_MASTER_KEY` | criptografia | `lib/encryption.js` |
| `CRAWL4AI_DOCKER_URL` | Crawl4AI | `crawl4ai-adapter.js` |
| `FEATURE_PUPPETEER` | habilita Puppeteer | `lib/puppeteer-extractor.js` |
| `PUPPETEER_TIMEOUT_MS` | timeout browser | `lib/circuit-breaker.js` |
| `LLM_CACHE_TTL_MS` | cache LLM | `llm-optimizer.js` |
| `NOTIFICATION_PHONE`/`ADMIN_PHONE` | WhatsApp admin | `whatsapp-integration.js` |

## 20. Matriz de dependências

| Integração | Consumidores | Criticidade | Fallback | Impacto comercial | Impacto técnico |
|---|---|---|---|---|---|
| PostgreSQL | SaaS, tenants, CRM, scheduler, billing | CRÍTICO | SQLite dev | Muito alto | Perda de persistência/tenant |
| Redis | cache/rate limit | ALTO | memória | Médio | perda de cache/rate limit distribuído |
| Groq | chat IA | CRÍTICO IA | OpenRouter/OpenAI | Alto | respostas IA degradam |
| OpenRouter | chat IA | ALTO | OpenAI | Médio | menos fallback |
| OpenAI/ChatGPT | chat IA tenant | ALTO | global/Groq legado | Alto | respostas IA premium falham |
| Twilio | WhatsApp | ALTO | Evolution se configurado | Alto | notificações/canal falham |
| Evolution | WhatsApp SaaS | CRÍTICO WA | Twilio parcial | Alto | inbound/outbound WA falham |
| Gmail/SMTP | email | MÉDIO | nenhum real | Médio | notificações por email falham |
| Stripe | billing | CRÍTICO comercial | nenhum | Muito alto | checkout/webhook falham |
| Crawl4AI | extração | MÉDIO | Python/Puppeteer/HTTP | Médio | scraping degrada |
| Puppeteer | extração JS | MÉDIO | Google/Jina/basic | Médio | menos conteúdo dinâmico |
| Webhooks outbound | integrações cliente | MÉDIO | retry 3x | Médio | automações externas falham |
| Scheduler DB | agenda | ALTO | retornos vazios/erros tratados | Médio | slots/agendamentos indisponíveis |

## 21. Matriz de falhas

- PostgreSQL indisponível: plataforma SaaS perde persistência central. CRÍTICO.
- Redis indisponível: usa memória, mas perde distribuição e resiliência. ALTO.
- Groq indisponível: chat tenta fallback quando disponível; custo pode subir. ALTO.
- OpenRouter indisponível: reduz redundância LLM. MÉDIO.
- OpenAI indisponível: ChatGPT tenant/global falha; legados podem usar Groq/OpenRouter. ALTO.
- Evolution indisponível: WhatsApp inbound/outbound SaaS falha. CRÍTICO.
- Twilio indisponível: WhatsApp Twilio falha. ALTO.
- Gmail/SMTP indisponível: emails não enviados. MÉDIO.
- Stripe indisponível: checkout, assinatura e webhooks falham. CRÍTICO.
- Crawl4AI indisponível: fallback Python/extração alternativa. MÉDIO.
- Puppeteer indisponível: fallback básico/remoto; conteúdo JS pode degradar. MÉDIO.
- Jina/Google Cache indisponíveis: menos fallback de scraping. BAIXO/MÉDIO.
- Webhooks externos indisponíveis: retry e depois perda do disparo. MÉDIO.

## 22. Dependências ocultas

- OpenAI aparece sob dois nomes: `CHATGPT_API_KEY` no módulo V3 e `OPENAI_API_KEY` nos servidores legados.
- Gmail não usa OAuth apesar da aba/termo Gmail; usa SMTP/Nodemailer.
- Redis é opcional, mas sua ausência muda a semântica de cache/rate limit para processo único.
- Crawl4AI depende de serviço Docker local ou pacote Python local; modo API está declarado mas não implementado.
- Puppeteer depende de Chromium compatível e memória; extração avançada faz fallback silencioso.
- Stripe depende de banco para trial/tenant e de webhook secret para confirmação confiável.
- WhatsApp SaaS depende da resolução tenant→instância além da API Evolution.

## 23. Single points of failure

| Serviço | Risco | Evidência operacional |
|---|---|---|
| PostgreSQL | CRÍTICO ABSOLUTO | Persistência de tenants, API keys, CRM, scheduler, billing. |
| Stripe | CRÍTICO comercial | Sem fallback de gateway implementado. |
| Evolution central | CRÍTICO WhatsApp | Canal inbound SaaS e envio centralizado. |
| Configuração de LLM | ALTO | Sem algum provider configurado, chat IA falha. |
| `data/api_keys.json` em modo local | ALTO local | Signup/API keys podem depender do arquivo. |
| SMTP/Gmail | MÉDIO | Notificações sem fallback de email. |
| Redis | MÉDIO/ALTO | Há fallback, mas não distribuído. |

## 24. Matriz de propriedade

| Integração | Inicializa | Consome | Persiste | Monitora | Depende |
|---|---|---|---|---|---|
| PostgreSQL | `database.js` | quase todos módulos SaaS | Postgres | logs/status | tenants, CRM, billing |
| Redis | `cache.js` | cache/rate limit | Redis/memória | `isRedisConnected` | extração, rate limit |
| Groq | servidores/LLM legacy | chat | não persiste direto | analytics/LLM stats | chat IA |
| OpenAI | `chatgpt-integration.js` | chatgpt routes/chat | `chatgpt_settings` | status/testConnection | IA tenant |
| OpenRouter | servidores legacy | chat | não persiste direto | logs | fallback IA |
| Twilio | `whatsapp-integration.js` | notificações/canal | settings/env | logs | WhatsApp |
| Evolution | `whatsapp-integration.js`, `whatsapp-channel.js` | WA SaaS | `whatsapp_settings` | logs/status | WhatsApp |
| Gmail | `gmail-integration.js` | emails lead | env/settings | logs/status | comunicação |
| Stripe | `billing.js`, `stripe-routes.js` | billing/pricing | tenants/sub IDs | webhooks/admin | receita |
| Webhooks | `webhooks.js` | eventos chatbot | memória/CRM DB | retries/logs | automações externas |
| Crawl4AI | `crawl4ai-adapter.js` | extratores | não | logs | extração |
| Scheduler | `scheduling-manager.js` | widget/API | DB | logs | agenda |

## 25. Diagrama global de integrações

```text
Widget público / Link Curto / Chat
  ↓
Server.js / rotas API
  ↓
Autenticação (API Key/JWT/Sessão)
  ↓
PostgreSQL ou SQLite
  ├─ tenants / api_keys / chatbots / leads
  ├─ chatgpt_settings / whatsapp_settings
  ├─ tenant_availability / tenant_blocked_dates / tenant_appointments
  └─ billing / CRM / knowledge
  ↓
Cache Redis ou In-Memory
  ├─ extrações
  ├─ respostas comuns
  └─ rate limit
  ↓
Extração de conteúdo
  ├─ Axios + Cheerio
  ├─ Crawl4AI Docker → Python fallback
  ├─ Google Cache → Jina Reader → Puppeteer
  └─ OCR Tesseract
  ↓
LLM Orchestration
  ├─ Groq
  ├─ OpenRouter
  └─ OpenAI/ChatGPT
  ↓
Sales/CTA Engine / Lead Capture / Scheduler
  ├─ Links WhatsApp/checkout/social
  ├─ PostgreSQL leads/agendamentos
  └─ Analytics interno
  ↓
Comunicação e automações
  ├─ WhatsApp: Evolution/Twilio
  ├─ Gmail/SMTP
  ├─ Webhooks externos
  └─ Stripe billing/webhook
```

## 26. Custo arquitetural

Pagas: OpenAI/ChatGPT, Stripe (taxas), Twilio, PostgreSQL/Redis gerenciados, infraestrutura Puppeteer/Crawl4AI. Híbridas: OpenRouter (depende do modelo), Evolution API (self-host/gratuito ou serviço), Gmail/SMTP (conta gratuita ou workspace), Crawl4AI (software gratuito com custo infra). Gratuitas/locais: SQLite, cache em memória, Tesseract.js, Axios/Cheerio. Groq é tratado no código de pricing como custo zero “atualmente”, mas continua dependência externa.

Impacto financeiro: falha do Groq pode deslocar carga para modelos pagos; Stripe é receita; Twilio/WhatsApp e Gmail são comunicação comercial; PostgreSQL/Redis sustentam operação SaaS.

## 27. Resiliência

Possuem fallback:

- Redis → memória.
- PostgreSQL → SQLite apenas por configuração/ambiente, não como failover runtime real.
- LLM legado: Groq → OpenRouter → OpenAI.
- ChatGPT tenant → ChatGPT global.
- Crawl4AI Docker → Python.
- Extração: básico/remoto/Puppeteer em cascata.
- Webhooks outbound: retry até 3 tentativas.

Não possuem fallback real:

- Stripe.
- Gmail/SMTP.
- Evolution inbound SaaS.
- Twilio quando provider selecionado é Twilio.
- JWT/session secret mal configurado.
- Banco em produção se PostgreSQL cair durante runtime.

Maior risco operacional: PostgreSQL, Stripe, Evolution central/WhatsApp, provedores LLM configurados, Redis em ambiente multi-instância.

## 28. Arquivos críticos

| Arquivo | Classificação | Motivo |
|---|---|---|
| `database.js` | CRÍTICO ABSOLUTO | Persistência e migrations. |
| `server.js` | CRÍTICO ABSOLUTO | Composição de módulos e rotas centrais. |
| `billing.js` | CRÍTICO | Planos, Stripe, uso. |
| `stripe-routes.js` | CRÍTICO | Checkout/webhook de pagamento. |
| `whatsapp-channel.js` | CRÍTICO | Webhooks inbound WA e resposta. |
| `whatsapp-integration.js` | CRÍTICO | Envio WhatsApp Twilio/Evolution. |
| `llm-optimizer.js` | CRÍTICO | Seleção/cache/custo LLM. |
| `chatgpt-integration.js` | CRÍTICO | OpenAI/ChatGPT tenant/global. |
| `cache.js` | IMPORTANTE | Redis/cache/rate limit. |
| `webhooks.js` | IMPORTANTE | Webhooks externos. |
| `gmail-integration.js` | IMPORTANTE | Email SMTP. |
| `scheduling-manager.js` | IMPORTANTE | Calendário/agendamento. |
| `crawl4ai-adapter.js` | SUPORTE | Extração via Crawl4AI. |
| `lib/puppeteer-extractor.js` | SUPORTE/IMPORTANTE | Extração JS-heavy e fallbacks. |
| `enhanced-content-extractor.js` | SUPORTE | OCR/dinâmico. |
| `auth-system.js` | CRÍTICO | JWT. |

## 29. Conclusão executiva

Foram identificadas 18 categorias reais de integração externa/infra: PostgreSQL, SQLite, Redis, cache em memória, Groq, OpenAI/ChatGPT, OpenRouter, Twilio, Evolution API, Gmail/SMTP, Stripe, webhooks HTTP, Crawl4AI, Puppeteer/Chromium, Google Cache, Jina Reader, Tesseract/OCR e sites/URLs de terceiros acessados por scraping/CTA.

Críticas: PostgreSQL, Stripe, Evolution/WhatsApp, LLMs configurados, autenticação/API keys. Com fallback: Redis, parte dos LLMs, extração/Crawl4AI/Puppeteer, webhooks outbound. Sem fallback forte: Stripe, Gmail/SMTP, banco produtivo em runtime, Evolution inbound.

Maiores riscos: PostgreSQL para SaaS inteiro; Stripe para receita; Evolution/Twilio para WhatsApp; LLMs para IA; Redis para escala e rate limit; extração JS-heavy para qualidade de contexto.

Impactos por área:

- Vendas: Stripe, LLM, CTA links, WhatsApp, email, webhooks.
- IA: Groq, OpenAI, OpenRouter, cache LLM, extração de conteúdo.
- WhatsApp: Evolution, Twilio, tenant settings, webhook channel.
- Scheduler: PostgreSQL/SQLite e `scheduling-manager.js`; sem calendário externo implementado.
- CTA Engine: extração de links, Puppeteer/Jina/Google Cache, normalização de WhatsApp/checkout.
- Lead Capture: PostgreSQL/SQLite, widget APIs, Gmail/WhatsApp notificações, analytics internos.
