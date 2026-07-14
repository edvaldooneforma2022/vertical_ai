# DEPLOY_MASTER_MAP — Link Mágico

Documento técnico baseado exclusivamente nos arquivos presentes neste repositório. Não registra recomendações nem correções; descreve o funcionamento real encontrado no código.

## 1. Visão geral

O deploy do Link Mágico é o processo de instalar dependências Node.js, disponibilizar variáveis de ambiente, inicializar a aplicação Express em `server.js`, executar o bootstrap global em `init.js`, preparar banco/cache/analytics e registrar rotas HTTP antes de colocar o servidor em escuta.

Para o sistema funcionar do zero, o código real exige:

1. Runtime Node.js com dependências instaladas por `npm install`, `npm ci --only=production` ou Docker.
2. Execução do comando `npm start`, que chama `node server.js`.
3. Carregamento de `.env` por `dotenv` dentro de `server.js`.
4. Disponibilidade mínima de banco: PostgreSQL quando `DATABASE_URL` ou `USE_POSTGRES=true` estiver definido; caso contrário, SQLite local via `better-sqlite3`.
5. Cache: Redis quando `REDIS_URL` ou `USE_REDIS=true` estiver definido; caso contrário, cache em memória.
6. Porta HTTP: `PORT` ou `3000`.
7. Integrações opcionais por variáveis: Stripe, OpenAI, Groq, OpenRouter, Gmail/SMTP, WhatsApp/Twilio/Evolution, Crawl4AI.

A entrada em produção ocorre quando `app.listen(PORT, '0.0.0.0')` termina o bootstrap e expõe health check, API, painel, chatbot e assets públicos.

## 2. Inventário de arquivos de deploy

| Arquivo | Linhas | Finalidade real |
|---|---:|---|
| `package.json` | scripts `start`, `dev`, `worker:followup`, `postinstall` | Define comandos de execução, desenvolvimento, worker e instalação do Chrome usado pelo Puppeteer. |
| `server.js` | bootstrap global e `app.listen` | Entrypoint real da aplicação web. Carrega `.env`, módulos, middlewares, rotas, bootstrap assíncrono e servidor HTTP. |
| `init.js` | função `initialize()` | Inicializa banco, cache e limpeza de analytics. |
| `database.js` | seleção PostgreSQL/SQLite e migrations | Configura camada de dados, cria tabelas/índices, roda migrations de billing e expõe helpers. |
| `cache.js` | Redis/in-memory | Inicializa cache, fallback em memória e rate limit baseado em cache. |
| `Dockerfile` | imagem Node 20 slim | Builda container, instala dependências de produção, copia código, expõe 3000 e executa `npm start`. |
| `docker-compose.crawl4ai.yml` | serviços `crawl4ai` e `nodejs-app` | Sobe Crawl4AI e a aplicação Node com `CRAWL4AI_MODE=docker`, `CRAWL4AI_DOCKER_URL` e `PORT=3000`. |
| `scripts/deploy.sh` | shell de deploy comercial | Verifica `.env`, instala dependências de produção, cria diretórios `data`/`logs` e executa `npm start`. |
| `.github/coderabbit.yaml` | revisão automatizada | Configura CodeRabbit em português para auto-review em push e pull request. |
| `scripts/setup.js` | bootstrap local | Gera `.env` de desenvolvimento, diretórios, arquivos de dados e mensagens de configuração. |
| `scripts/migrate-to-enterprise-tenancy.js` | migração manual | Carrega `.env`, inicializa banco e migra registros para tenancy enterprise. |
| `workers/followUpWorker.js` | worker separado | Entrypoint separado para follow-up por `npm run worker:followup`. |

Não foram encontrados Procfile, PM2, Railway ou Render YAML dedicados; há documentos Markdown de correções Render, mas não arquivos de pipeline executável.

## 3. Ponto de entrada principal

Fluxo real:

```text
npm start
↓
node server.js
↓
require("dotenv").config()
↓
carregamento síncrono de módulos globais e singletons
↓
criação/configuração do app Express
↓
registro de middlewares e rotas iniciais
↓
registro do webhook Hotmart antes de setupRoutes()
↓
setupRoutes(app)
↓
IIFE assíncrona
↓
await initialize()
↓
inicialização opcional V8
↓
registro de rotas V3 e flags finais
↓
app.listen(PORT, '0.0.0.0')
↓
servidor ativo
```

## 4. Bootstrap global

Ordem real de inicialização encontrada:

1. Módulos opcionais de sales/preset/normalização/decision/auto-instructions são carregados com `try/catch` e fallback de log.
2. `.env` é carregado.
3. Sistema de segurança é importado e seus objetos são instanciados.
4. Módulos centrais são importados: database, cache, webhooks, billing, analytics, LLM optimizer, knowledge base, routes e init.
5. Billing enforcement é carregado de forma opcional e fail-open.
6. Integrações V3 são importadas: Gmail, WhatsApp, ChatGPT, CRM, Whitelabel, Structured Leads, Short URL, API Key Manager.
7. Scheduling Manager é carregado de forma opcional.
8. Feature flags e módulos V8/V10/V11 são carregados de forma opcional.
9. Express/middlewares/rotas são definidos ao longo do arquivo.
10. Hotmart webhook é registrado antes de `setupRoutes()`.
11. `setupRoutes(app)` registra APIs principais de analytics, webhooks, billing, knowledge base, assistentes e afins.
12. A IIFE assíncrona chama `initialize()`.
13. `initialize()` executa banco → cache → limpeza de analytics.
14. Módulos V8 opcionais são inicializados.
15. Rotas V3/finais são registradas.
16. Feature flags finais ativam/desativam rotas e schedulers.
17. `app.listen` abre o servidor.
18. Após listen, se flag V14 estiver ativa, cron de auto-otimização é preparado.

## 5. Variáveis de ambiente

| Nome | Consumidores | Finalidade | Criticidade |
|---|---|---|---|
| `PORT` | `server.js`, Docker Compose | Porta HTTP. | CRÍTICO |
| `NODE_ENV` | `database.js`, `server.js`, auth/CSRF | Define produção/teste e SSL do PostgreSQL. | ALTO |
| `DATABASE_URL` | `database.js`, rotas WhatsApp, whitelabel | Ativa PostgreSQL e connection string. | CRÍTICO em produção; fallback local usa SQLite. |
| `USE_POSTGRES` | `database.js`, whitelabel, leads | Força modo PostgreSQL. | ALTO |
| `REDIS_URL` | `cache.js`, `server.js` | Ativa Redis. | MÉDIO; há fallback em memória. |
| `USE_REDIS` | `cache.js` | Força Redis. | MÉDIO |
| `SESSION_SECRET` | `server.js`, encryption | Segredo de sessão/encriptação fallback. | CRÍTICO |
| `JWT_SECRET` | `auth-system.js` | Assinatura JWT. | CRÍTICO |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_API_BASE` | `server.js`, setup | Provedor OpenAI. | ALTO para IA OpenAI; não bloqueia boot. |
| `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_API_BASE` | `server.js`, setup | Provedor Groq. | ALTO para IA Groq; não bloqueia boot. |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_API_BASE` | `server.js` | Provedor OpenRouter. | ALTO para IA OpenRouter; não bloqueia boot. |
| `STRIPE_SECRET_KEY` | `billing.js`, `server.js`, `stripe-routes.js`, `routes.js` | Habilita Stripe e rotas de cobrança. | ALTO para billing; rotas Stripe são omitidas sem ela. |
| `STRIPE_WEBHOOK_SECRET` | `stripe-routes.js`, `routes.js`, admin | Validação de webhook Stripe. | ALTO |
| `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS` | `stripe-routes.js`, admin | IDs de preços Stripe. | ALTO para checkout. |
| `FEATURE_TRIAL`, `STRIPE_TRIAL_DAYS`, `STRIPE_TRIAL_PLAN` | `stripe-routes.js` | Trial no checkout. | MÉDIO |
| `APP_URL`, `PLATFORM_URL`, `SITE_URL`, `RENDER_EXTERNAL_URL` | Stripe, WhatsApp, reports, admin | URLs públicas para callbacks/webhooks/links. | ALTO |
| `WHATSAPP_PROVIDER` | `whatsapp-integration.js`, routes, server | Seleção/fallback de WhatsApp. | MÉDIO |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` | `whatsapp-integration.js` | Configuração Twilio. | MÉDIO |
| `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME` | `whatsapp-integration.js` | Evolution API tenant/global. | MÉDIO |
| `CENTRAL_EVOLUTION_URL`, `CENTRAL_EVOLUTION_API_KEY` | `whatsapp-routes.js`, channel/integration | WhatsApp SaaS central. | ALTO para SaaS WhatsApp. |
| `ADMIN_PHONE`, `NOTIFICATION_PHONE` | WhatsApp | Destinatários administrativos. | BAIXO/MÉDIO |
| `GMAIL_USER`, `GMAIL_PASSWORD`, `GMAIL_FROM`, `OWNER_EMAIL` | Gmail/worker/server | Notificações e email Gmail. | MÉDIO |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_SECURE` | email service/worker/reports | Email SMTP. | MÉDIO |
| `CRAWL4AI_MODE`, `CRAWL4AI_DOCKER_URL` | Crawl adapter/replacement, Compose | Extração via Crawl4AI. | MÉDIO |
| `FEATURE_*` | `server.js`, libs, routes | Gates de funcionalidades e kill switches. | Variável por módulo. |
| `ANALYTICS_RETENTION_DAYS` | `init.js` | Retenção para limpeza de analytics no boot. | BAIXO |
| `ADMIN_API_KEY`, `ADMIN_SECRET_KEY` | admin routes | Autenticação admin. | CRÍTICO para admin. |
| `HOTMART_HOTTOK`, `HOTMART_DEFAULT_PLAN`, `HOTMART_PLAN_PRICE_CENTS` | Hotmart webhook | Provisionamento Hotmart. | MÉDIO/ALTO |
| `LOG_LEVEL`, `DEBUG_*`, `VERBOSE` | logs/testes | Verbosidade e debug. | BAIXO |
| `RATE_LIMIT_DISABLED`, `RATE_LIMIT_WHITELIST` | advanced rate limiter | Controle de rate limit avançado. | MÉDIO |
| `ENCRYPTION_MASTER_KEY`, `FEATURE_ENCRYPT_SENSITIVE` | encryption | Criptografia de dados sensíveis. | ALTO |
| `LLM_CACHE_TTL_MS`, `LLM_TIMEOUT_MS`, `CIRCUIT_BREAKER_TIMEOUT_MS`, `EXTRACTION_TIMEOUT_MS`, `PUPPETEER_TIMEOUT_MS` | optimizer/circuit breaker | Timeouts/TTL. | MÉDIO |

## 6. Configuração de produção, homologação, desenvolvimento e local

| Ambiente | Como o código diferencia | Efeito real |
|---|---|---|
| Produção | `NODE_ENV=production` | PostgreSQL usa SSL com `rejectUnauthorized:false`; Docker expõe porta 3000; `npm start` roda `server.js`. |
| Homologação | Não há configuração dedicada encontrada | Usa mesmas chaves e flags que o ambiente fornecer. |
| Desenvolvimento | `scripts/setup.js` gera `.env` com `NODE_ENV=development`, `PORT=3000`, chaves placeholder; `npm run dev` usa nodemon. | Execução local com reload e placeholders. |
| Local sem PostgreSQL | Ausência de `DATABASE_URL` e `USE_POSTGRES` | `database.js` usa SQLite local. |
| Local sem Redis | Ausência de `REDIS_URL` e `USE_REDIS` | `cache.js` usa Map em memória. |
| Docker Compose Crawl4AI | `docker-compose.crawl4ai.yml` | Sobe app + Crawl4AI e injeta modo docker para extração. |

## 7. Inicialização do banco

`database.js` define `USE_POSTGRES = process.env.DATABASE_URL || process.env.USE_POSTGRES === 'true'`. Se verdadeiro, cria `Pool` do pacote `pg` com SSL em produção. Caso contrário, usa `better-sqlite3`.

Quem inicia: `init.js` chama `initializeDatabase()` como primeiro passo.

Quem valida: o próprio `initializeDatabase()` executa criação de tabelas/índices/migrations; falhas são capturadas no `init.js`, que retorna `false` sem impedir necessariamente o `app.listen`.

Quem depende: rotas, billing, analytics, knowledge base, WhatsApp settings, leads, scheduler, whitelabel, API keys, feature flags, CRM e follow-up.

Migrations/helpers reais:

- Tabelas core: chatbots, analytics, webhooks, usage, knowledge base, WhatsApp settings, feature flags, tenants/API keys e follow-up.
- Billing: `database.js` tenta `require('./billing-migrations').runMigrations()` e trata falha como não crítica.
- Helpers: `DatabaseHelpers` concentra operações de analytics, leads, WhatsApp settings, API keys e outras entidades.
- JSON/filesystem: Knowledge Base carrega cache/fallback em `data/knowledge/*.json`; analytics auto-learning também possui fallback JSON quando adapter de DB falha.

## 8. Inicialização do cache

Fluxo real:

```text
init.initialize()
↓
initializeCache()
↓
USE_REDIS?
├─ sim: redis.createClient({ url: REDIS_URL, reconnectStrategy }) + connect()
│       ├─ ready: isRedisConnected=true
│       └─ erro/conexão falha: initializeInMemoryCache()
└─ não: initializeInMemoryCache()
```

`CacheManager` usa o cliente ativo para extrações, respostas, sessões e short URLs. O rate limit básico em `cache.js` usa incrementos/TTL no cache ativo. O rate limiter avançado V8 é adicionado como middleware somente quando existe `rateLimiterAdvanced`, `featureFlags` e flag `FEATURE_ADVANCED_RATE_LIMIT` ativa.

## 9. Inicialização da IA

A IA é carregada em camadas:

1. `llm-optimizer.js` é importado no topo de `server.js` e em `routes.js`.
2. O otimizador define análise de complexidade, cache de respostas, custos e fallback entre provedores.
3. `knowledge-base.js` instancia `KnowledgeBaseManager`, tenta conectar ao banco e carrega fallback filesystem.
4. `server.js` possui chamadas diretas a Groq, OpenRouter e OpenAI por variáveis `*_API_KEY`, `*_MODEL`, `*_API_BASE`.
5. `chatgpt-integration.js` e `chatgpt-routes.js` adicionam integração/rotas multi-tenant para ChatGPT quando configuradas.
6. Feature flags controlam camadas de decisão, sales layer, auto-learning, prompts universais, V13/V14/V15/V16/V17/V18 etc.

Ordem de carga: optimizer e KB são importados antes de `setupRoutes`; provedores são usados sob demanda nas rotas de chat/geração; auto-learning injeta DB adapter via `setImmediate`, sem bloquear boot.

## 10. Inicialização de segurança

`server.js` importa `SecuritySystem`, `ThreatDetectionSystem`, `RateLimitSystem`, `InputValidationSystem`, `ApplicationFirewall` e `SecurityMonitor`. Em seguida, instancia todos.

`SecuritySystem` constrói threat detection, rate limiter, input validator, firewall, audit logger, conjuntos de IP bloqueado e monitoramento. Seu middleware verifica IP bloqueado, requisição suspeita, rate limit por IP, validação de entrada e log de auditoria.

Além disso, o código tem módulos separados de CSRF, CORS, CSP, compliance, auth e rate limiter avançado. O rate limiter avançado só entra no Express quando habilitado via feature flag no bootstrap V8/final.

## 11. Inicialização de billing

`billing.js` instancia `BillingManager` no require. O construtor cria mapas de assinatura/uso, define `stripeEnabled = !!STRIPE_SECRET_KEY` e chama `initializeStripe()` quando a chave existe. Planos reais: `free`, `starter`, `pro`, `business`, com aliases `professional → pro` e `enterprise → business`.

Dependências:

- Stripe depende de `STRIPE_SECRET_KEY`.
- Checkout/rotas Stripe dependem de `STRIPE_PRICE_*`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`/`PLATFORM_URL` quando aplicável.
- Enforcement é carregado em `server.js` por `createBillingEnforcement(billingManager)` e falha em modo não crítico.
- Migrations de billing rodam durante `initializeDatabase()` e falham de forma não crítica segundo log do código.

## 12. Inicialização de analytics

`analytics/index.js` exporta tracker, performance engine, memory store e optimizer. Ele tenta injetar adapter de banco via `setImmediate`; se falhar, usa fallback JSON. No bootstrap principal, `init.js` limpa analytics antigos com `ANALYTICS_RETENTION_DAYS || 90`. `routes.js` registra endpoints de consulta/exportação e `server.js` chama tracking em fluxos de short URL, leads e chat.

Fluxo:

```text
require('./analytics')
↓
setImmediate tenta DB adapter
↓
init.initialize() limpa dados antigos
↓
rotas /api/analytics são registradas
↓
trackEvent/recordInteraction são chamados sob demanda
```

## 13. Inicialização do WhatsApp

Componentes reais:

- `whatsapp-integration.js`: gerenciador de Twilio/Evolution, provider, tenantInstances e templates.
- `whatsapp-routes.js`: rotas multi-tenant de settings, teste, SaaS connect/status/disconnect/reconnect e configuração de webhook Evolution.
- `whatsapp-channel.js`: canal WhatsApp nativo opcional registrado em `server.js` dentro de `try/catch`.
- `database.js`: tabela `whatsapp_settings`, `whatsapp_messages` e colunas SaaS/canal.

Bootstrap:

1. `server.js` importa `whatsappManager`.
2. `database.js` cria tabelas/colunas WhatsApp no bootstrap de DB.
3. Rotas básicas `/api/whatsapp/send` e `/api/whatsapp/status` são registradas se o servidor chega à seção V3.
4. `require('./whatsapp-routes')(app, logger)` registra rotas multi-tenant.
5. `registerWhatsAppChannel(app, ...)` tenta registrar canal nativo; falha não bloqueia.
6. Integração SaaS depende de `CENTRAL_EVOLUTION_URL`, `CENTRAL_EVOLUTION_API_KEY`, `APP_URL` ou `RENDER_EXTERNAL_URL`.

## 14. Inicialização do scheduler

`server.js` tenta carregar `scheduling-manager.js`; se falhar, apenas registra warning. Quando carregado, rotas de disponibilidade, bloqueios e reserva pública são registradas dentro de `if (schedulingManager)`. O manager depende de `database.js`, resolve tenant por hash de API key e possui cache local de disponibilidade.

Fluxo:

```text
require('./scheduling-manager')
↓
schedulingManager disponível?
├─ não: rotas de calendário não são registradas
└─ sim: /api/availability, /api/availability/blocked, /api/public/availability/:hash, /api/public/book/:hash
↓
operações consultam/gravam no banco
```

## 15. Registro de rotas

Ordem real de alto nível:

1. Middlewares globais/estáticos/sessão definidos anteriormente em `server.js`.
2. Webhook Hotmart é registrado antes de `setupRoutes()` para evitar conflito com `POST /api/webhooks/:chatbotId`.
3. `setupRoutes(app)` registra analytics, stats tenant, webhooks, billing, knowledge base, assistentes e demais APIs do arquivo `routes.js`.
4. Admin V8 é montado em `/admin/v8`.
5. Depois de `initialize()`, `server.js` registra rotas V3: Gmail, scheduler, WhatsApp básico, ChatGPT, whitelabel, leads, CRM, short URL, assistentes, admin, checkout, self-service signup, email login, widget token, onboarding email, Stripe, templates, affiliates e weekly reports.
6. Rate limiter avançado pode ser adicionado antes e depois, condicionado por feature flag.
7. `app.listen` encerra o registro principal.

Dependências por grupo:

- APIs core: banco/helpers/cache.
- Admin: admin routes e segredos/chaves.
- Chat: IA, KB, cache, feature flags, analytics.
- Leads: banco, CRM opcional, email/WhatsApp opcionais.
- Scheduler: schedulingManager + banco.
- Billing: billingManager + Stripe opcional.
- Analytics: analyticsManager + DB/fallback.

## 16. Feature flags no boot

Flags reais são carregadas de duas formas:

1. Variáveis `process.env.FEATURE_*` lidas diretamente em `server.js` e libs.
2. `lib/feature-flags` carregado em `server.js` e `routes.js` como `featureFlags`, usado por `featureFlags.isEnabled(...)`.

Gates/kill switches observados:

- Rotas/funcionalidades desativáveis quando env é `'false'`: `FEATURE_SELF_SERVICE_SIGNUP`, `FEATURE_EMAIL_LOGIN`, `FEATURE_WIDGET_TOKEN`, `FEATURE_ONBOARDING_EMAILS`, `FEATURE_TEMPLATES`, `FEATURE_AFFILIATES`, `FEATURE_WEEKLY_REPORT`.
- Rate limiter avançado: `FEATURE_ADVANCED_RATE_LIMIT`.
- Camadas de chat/IA/vendas: `FEATURE_AUTO_LEARNING`, `FEATURE_DECISION_ENGINE`, `FEATURE_DECISION_ENGINE_V2`, `FEATURE_SALES_LAYER`, `FEATURE_PRESETS`, `FEATURE_UNIVERSAL_PROMPT`, `FEATURE_V13_*`, `FEATURE_V14_SELF_OPTIMIZING`, `FEATURE_V15_*`, `FEATURE_V16_2_*`, `FEATURE_V17_BRAIN`, `FEATURE_V18_*`, `FEATURE_WA_CTA_PROMOTER`, `FEATURE_CLEAN_CHAT_V2`, `FEATURE_WIDGET_TOKEN`.

## 17. Dependências de startup

| Dependência | Impede iniciar? | Criticidade | Evidência funcional |
|---|---|---|---|
| Node.js/dependências npm | Sim | CRÍTICO | Sem runtime/imports, `server.js` não executa. |
| `server.js` válido | Sim | CRÍTICO | Entrypoint de `npm start`. |
| `init.js` | Sim se import falhar | CRÍTICO | Importado diretamente pelo servidor. |
| Banco | Não necessariamente | ALTO/CRÍTICO | `initialize()` captura erro e retorna `false`; rotas dependentes podem falhar. |
| Cache Redis | Não | MÉDIO | Fallback in-memory. |
| Stripe | Não | ALTO para billing | Rotas Stripe só carregam se `STRIPE_SECRET_KEY`. |
| Provedores IA | Não no boot | ALTO para chat inteligente | Usados sob demanda/fallbacks. |
| WhatsApp | Não | MÉDIO | Rotas/módulos tratam ausências. |
| Scheduling Manager | Não | MÉDIO | Carregado com `try/catch`. |
| Billing enforcement | Não | MÉDIO | Carregado fail-open. |
| Feature flags lib | Não | MÉDIO | `try/catch`, fica `null`. |
| Arquivos opcionais V8/V10/V11 | Não | BAIXO/MÉDIO | `try/catch`. |

## 18. Sequência completa de startup

1. Processo executa `node server.js`.
2. Módulos opcionais de sales/decision/normalização são tentados.
3. `.env` é carregado.
4. Segurança é importada e instanciada.
5. Database/cache/webhooks/billing/analytics/LLM/KB/routes/init são importados.
6. BillingManager inicializa e Stripe é tentado se houver chave.
7. KnowledgeBaseManager prepara diretório, tenta DB e carrega JSON filesystem.
8. Billing enforcement é tentado.
9. Integrações Gmail, WhatsApp, ChatGPT, CRM, whitelabel, leads, short URL e API keys são importadas.
10. Scheduling Manager é tentado.
11. Feature flags e módulos avançados são tentados.
12. Express/middlewares/rotas anteriores no arquivo são configurados.
13. Webhook Hotmart é tentado e registrado antes das rotas genéricas.
14. `setupRoutes(app)` registra rotas core.
15. Admin V8 é tentado.
16. IIFE chama `await initialize()`.
17. `initializeDatabase()` cria/valida estruturas.
18. `initializeCache()` conecta Redis ou inicia in-memory.
19. Analytics antigos são limpos.
20. Módulos V8 opcionais inicializam com banco se disponíveis.
21. Rotas V3/finais são registradas.
22. Rotas condicionadas por flags/env são registradas ou omitidas.
23. Rotas Stripe só são registradas se `STRIPE_SECRET_KEY`.
24. Weekly report é agendado se habilitado.
25. `app.listen(PORT, '0.0.0.0')` sobe HTTP.
26. Logs de endpoints e status de módulos são impressos.
27. Cron V14 é preparado se flag ativa.
28. Servidor está pronto para requisições.

## 19. Pontos de falha no deploy

| Falha | Consequência real |
|---|---|
| `.env` ausente em `scripts/deploy.sh` | Script aborta antes de instalar/iniciar. |
| Dependência npm ausente | Import falha; se for módulo obrigatório, processo encerra. |
| Banco indisponível | `initialize()` registra erro e retorna `false`; servidor pode subir degradado, mas rotas DB falham. |
| Redis indisponível | Fallback para cache em memória. |
| Stripe sem chave | Stripe e rotas de billing Stripe ficam desabilitados. |
| Migrations de billing falham | Log de falha não crítica; restante prossegue. |
| Provedor IA sem chave | Chamadas ao provedor falham ou usam fallback se implementado no fluxo. |
| Crawl4AI indisponível | Extração via Crawl4AI falha ou usa modo alternativo conforme adapter. |
| WhatsApp SaaS sem Central Evolution | Endpoint de connect retorna indisponibilidade. |
| Scheduler não carregado | Rotas de calendário não são registradas. |
| Feature flags indisponíveis | Funcionalidades condicionadas ficam off/null ou retornam 403 em rotas específicas. |

## 20. Fallbacks de inicialização

| Módulo | Fallback real |
|---|---|
| Banco | PostgreSQL → SQLite quando `DATABASE_URL`/`USE_POSTGRES` ausentes. Erro em `initialize()` não bloqueia necessariamente listen. |
| Cache | Redis → in-memory em ausência ou erro de conexão. |
| Billing enforcement | Falha no require cria warning e deixa enforcement desativado. |
| Stripe | Sem `STRIPE_SECRET_KEY`, rotas Stripe não são registradas. |
| Knowledge Base | PostgreSQL → filesystem `data/knowledge`. |
| Auto-learning | DB adapter → JSON/fallback silencioso. |
| WhatsApp Channel | Falha no canal nativo não bloqueia. |
| Scheduling | Falha no módulo não bloqueia. |
| Feature flags | Falha no módulo deixa `featureFlags=null`. |
| V8/V10/V11 modules | Falhas são registradas como não críticas. |

## 21. Modo degraded

Podem falhar sem derrubar completamente o servidor:

- Redis/cache externo.
- Stripe/rotas Stripe.
- Billing enforcement.
- Migrations de billing.
- Feature flags lib.
- Módulos V8/V10/V11 opcionais.
- Scheduling Manager.
- WhatsApp channel/rotas SaaS parcialmente.
- Auto-learning DB adapter.
- Knowledge Base PostgreSQL, com fallback filesystem.
- Analytics DB adapter, com fallback JSON.

Podem derrubar completamente:

- Sintaxe/import obrigatório de `server.js`.
- Ausência de dependências obrigatórias importadas fora de `try/catch`.
- Falha fatal antes da IIFE e antes dos blocos protegidos.
- Runtime Node inexistente.
- `package.json`/`npm start` incorreto no ambiente de deploy.

Banco indisponível é híbrido: o código captura erro no `initialize()`, mas a plataforma fica operacionalmente degradada porque muitas rotas dependem do DB.

## 22. Matriz de dependências

| Componente | Quem inicia | Quem depende | Criticidade |
|---|---|---|---|
| Express server | `server.js` | Todas as rotas | CRÍTICO |
| Database | `init.js` → `initializeDatabase()` | Auth, tenants, leads, analytics, billing, WhatsApp, scheduler | CRÍTICO/ALTO |
| Cache | `init.js` → `initializeCache()` | LLM cache, short URL, rate limit, extrações | MÉDIO |
| BillingManager | require de `billing.js` | checkout, admin, enforcement, limites | ALTO |
| Stripe routes | `server.js` se `STRIPE_SECRET_KEY` | checkout/webhooks | ALTO |
| Analytics | require + `init.js` cleanup | dashboards, tracking, auto-learning | MÉDIO |
| LLM Optimizer | require | chat/geração | ALTO |
| Knowledge Base | require | chat e bases por tenant | ALTO |
| SecuritySystem | `server.js` | middlewares de proteção | ALTO |
| Feature Flags | `server.js`/`routes.js` | gates e killswitches | MÉDIO |
| WhatsApp | `server.js` + routes | notificações, canal, SaaS connect | MÉDIO/ALTO |
| Scheduler | `server.js` try/catch | calendário e reservas | MÉDIO |
| Gmail/SMTP | imports/rotas/workers | emails e notificações | MÉDIO |
| Crawl4AI | docker compose/adapter | extração web | MÉDIO |
| Worker follow-up | `npm run worker:followup` | follow-ups assíncronos | MÉDIO |

## 23. Deploy em produção

Processos reais documentados no código:

### Via npm

```bash
npm install
npm start
```

`npm start` executa `node server.js`.

### Via script shell

```bash
scripts/deploy.sh
```

Fluxo do script: exige `.env`; executa `npm ci --only=production`; cria `data`, `logs`, `logs/consent`, `logs/deletion`; executa `npm start`.

### Via Dockerfile

```text
node:20-slim
WORKDIR /usr/src/app
COPY package.json/package-lock.json
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Via Docker Compose com Crawl4AI

`docker-compose.crawl4ai.yml` sobe `crawl4ai` e `nodejs-app`; o app depende do serviço Crawl4AI e recebe `CRAWL4AI_MODE=docker`, `CRAWL4AI_DOCKER_URL=http://crawl4ai:11235`, `PORT=3000`.

## 24. CI/CD

Encontrado:

- `.github/coderabbit.yaml`: auto-review em push e pull request, idioma `pt-BR`, sugestões e inline fixes habilitados.

Não encontrado:

- GitHub Actions executáveis em `.github/workflows`.
- Procfile.
- PM2/ecosystem config.
- Railway config.
- Render config executável.

Logo, o repositório contém automação de revisão, mas não pipeline CI/CD/deploy automático versionado além dos scripts e Docker.

## 25. Single points of failure

| Item | Risco | Motivo |
|---|---|---|
| `server.js` | CRÍTICO | Entrypoint monolítico; concentra imports, rotas, bootstrap e listen. |
| `database.js` | ALTO | Camada única de DB, migrations e helpers. |
| `init.js` | ALTO | Sequencia banco/cache/analytics no boot. |
| `package.json` scripts | CRÍTICO | Define `npm start`. |
| `SESSION_SECRET`/`JWT_SECRET` | ALTO | Segurança de sessão/JWT. |
| `DATABASE_URL` em produção | ALTO | Sem ele, produção pode cair em SQLite/local se não for configurada. |
| `STRIPE_SECRET_KEY` | ALTO para billing | Ausência desativa Stripe. |
| `CENTRAL_EVOLUTION_*` | ALTO para WhatsApp SaaS | Sem elas, conexão SaaS não fica disponível. |
| `lib/feature-flags` | MÉDIO | Falha desativa gates dependentes. |

## 26. Arquivos críticos de deploy

### CRÍTICO ABSOLUTO

- `server.js`: processo principal, bootstrap, rotas e `listen`.
- `package.json`: scripts de start/dev/worker/postinstall e dependências.
- `database.js`: seleção de banco, schema, migrations e helpers.
- `init.js`: ordem banco → cache → analytics.

### CRÍTICO

- `cache.js`: Redis/fallback e cache usado por performance/rate limit.
- `billing.js`: planos, Stripe e billing manager.
- `routes.js`: APIs core.
- `security-system.js`: segurança global.
- `Dockerfile`: imagem e comando de produção containerizada.
- `scripts/deploy.sh`: deploy shell.

### IMPORTANTE

- `stripe-routes.js`, `admin-routes.js`, `whatsapp-routes.js`, `whatsapp-integration.js`, `chatgpt-integration.js`, `knowledge-base.js`, `llm-optimizer.js`, `scheduling-manager.js`, `analytics/index.js`.

### SUPORTE

- `docker-compose.crawl4ai.yml`, `scripts/setup.js`, `scripts/migrate-to-enterprise-tenancy.js`, `.github/coderabbit.yaml`, `workers/followUpWorker.js`.

## 27. Diagrama global de deploy

```text
Deploy real
↓
Instalar dependências npm
↓
Carregar variáveis via .env/ambiente
↓
Executar node server.js
↓
Carregar módulos opcionais e obrigatórios
↓
Instanciar segurança, billing, analytics, KB, integrações
↓
Configurar Express/middlewares
↓
Registrar Hotmart antes das rotas genéricas
↓
Registrar setupRoutes(app)
↓
Bootstrap init.initialize()
    ↓
    Banco: PostgreSQL ou SQLite
    ↓
    Cache: Redis ou in-memory
    ↓
    Analytics cleanup
↓
Inicializar V8 opcionais
↓
Registrar rotas V3/finais
    ↓
    Gmail / Scheduler / WhatsApp / ChatGPT / Whitelabel / Leads / CRM
    ↓
    Short URL / Assistants / Admin / Checkout / Auth / Widget Token
    ↓
    Stripe se chave existir / Templates / Affiliates / Weekly report
↓
app.listen(PORT, 0.0.0.0)
↓
Servidor Online
```

## 28. Governança de deploy

Arquivos que exigem auditoria obrigatória antes de alteração, por impacto direto no boot/deploy:

- `server.js`
- `package.json`
- `package-lock.json`
- `database.js`
- `init.js`
- `cache.js`
- `Dockerfile`
- `scripts/deploy.sh`
- `docker-compose.crawl4ai.yml`
- `billing.js`
- `stripe-routes.js`
- `routes.js`
- `security-system.js`
- `whatsapp-routes.js`
- `whatsapp-integration.js`
- `llm-optimizer.js`
- `knowledge-base.js`
- `analytics/index.js`
- `scheduling-manager.js`

Arquivos que nunca devem ser alterados sem relatório de impacto:

- `server.js`, por concentrar entrada, rotas, flags e listen.
- `database.js`, por alterar schemas/migrations/helpers.
- `package.json` e `package-lock.json`, por alterar comando e dependências de produção.
- `init.js`, por alterar ordem de bootstrap.
- `billing.js`/`stripe-routes.js`, por impacto financeiro.
- `security-system.js`/auth/rate limit, por impacto de segurança.
- `Dockerfile`/`scripts/deploy.sh`, por impacto direto no ambiente de produção.

## 29. Conclusão executiva

O sistema sobe por `npm start`, que executa `node server.js`. O servidor carrega variáveis, módulos obrigatórios e opcionais, inicializa singletons, registra rotas e chama `initialize()`. O bootstrap real de `initialize()` é banco → cache → limpeza de analytics. Depois disso, o servidor registra rotas finais condicionadas por módulos e flags e abre `app.listen` em `0.0.0.0`.

A entrada em produção pode ocorrer por npm direto, pelo script `scripts/deploy.sh`, por Dockerfile ou pelo Docker Compose com Crawl4AI. O código não contém pipeline GitHub Actions, Procfile, PM2, Railway ou Render YAML executável.

Componentes críticos: `server.js`, `package.json`, `database.js`, `init.js`, `cache.js`, `routes.js`, `billing.js`, `security-system.js` e configurações de runtime. Dependências obrigatórias reais para processo: Node.js, dependências npm, `server.js` íntegro, scripts de start e porta. Dependências obrigatórias operacionais em produção: banco consistente, segredos de sessão/JWT, URLs/chaves dos provedores usados e variáveis das integrações ativas.

Riscos principais: monólito de bootstrap em `server.js`, banco como dependência transversal, produção cair em fallback local se variáveis de banco não forem definidas, rotas financeiras dependerem de Stripe e múltiplos módulos opcionais ativados por flags.

Módulos com fallback: cache Redis, Knowledge Base DB, analytics DB adapter, auto-learning, billing enforcement, Stripe routes, feature flags, scheduler, WhatsApp channel e módulos V8/V10/V11. Módulos que podem derrubar a plataforma: runtime/dependências obrigatórias, sintaxe/import obrigatório de `server.js`, `package.json`/start incorreto e falhas fatais fora dos blocos protegidos por `try/catch`.
