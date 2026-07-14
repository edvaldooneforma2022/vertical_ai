# KNOWLEDGE TRANSFER PLAYBOOK — Link Mágico

> Manual operacional para transferência de conhecimento. Este documento consolida o comportamento real observado no código e na documentação existente do repositório. Não é um plano de correção nem uma lista de patches.

## 1. Visão geral

O **Link Mágico** é uma plataforma SaaS de chatbot com IA voltada a vendas, captura de leads, conversão e atendimento em múltiplos canais. O produto permite que um cliente configure um assistente, extraia contexto de páginas de venda, publique um widget ou link curto e conduza conversas que podem gerar CTA, WhatsApp, lead ou agendamento.

**Objetivo do produto:** transformar páginas, links e canais de conversa em um assistente comercial capaz de responder dúvidas, identificar intenção, conduzir etapas da jornada e acionar conversão.

**Objetivo comercial:** aumentar geração de leads, cliques em checkout, contatos por WhatsApp e agendamentos para cada tenant/cliente.

**Objetivo técnico:** manter uma API multi-tenant que combine extração de conteúdo, persistência, IA, decision engines, feature flags e canais externos sem quebrar isolamento por API key.

**O que entender primeiro:**

1. `server.js` é o centro operacional: registra rotas, inicializa middleware, executa chat, extração, leads, agendamentos, link curto e integrações.
2. A API key é o principal eixo de tenancy e isolamento.
3. Os fluxos de chat dependem de `pageData`, histórico, estado conversacional, feature flags e provedores LLM.
4. O sistema possui camadas históricas V17, V18, V19 e V20 convivendo com engines anteriores; mudanças sem auditoria podem reativar regressões.
5. Canais diferentes entram por rotas diferentes, mas convergem para extração/contexto/decisão/resposta/persistência.

## 2. Resumo executivo da plataforma

### Arquitetura geral

A arquitetura é uma aplicação Node.js/Express monolítica com módulos auxiliares. O `server.js` conecta rotas HTTP, autenticação, sessões, CORS, billing, extração, chat universal, chat inteligente, lead capture, scheduler, link curto e integrações. A persistência usa PostgreSQL quando `DATABASE_URL`/`USE_POSTGRES` existe, com fallback SQLite e também arquivos JSON para dados legados por tenant.

### Principais componentes

- **API Express:** endpoints públicos, administrativos, chat, extração, leads, agendamentos, short links e integrações.
- **Banco:** `database.js` define tabelas, migrations e helpers para chatbots, conversas, leads, short URLs, feature flags, WhatsApp e CRM.
- **Feature flags:** `lib/feature-flags.js` controla ativação de módulos críticos.
- **Extração:** `extractPageData`, `enhanced-content-extractor.js`, Crawl4AI, Puppeteer e guards V18.
- **IA:** chamadas para Groq, OpenRouter e OpenAI com fallback.
- **Decisão comercial:** Decision Core, Decision Engine, CTA Engine, Sales Layer, V17 e V19.
- **Canais:** widget web, link curto e WhatsApp.
- **Conversão:** lead capture, CTA, checkout, WhatsApp e appointments.

### Fluxos principais

1. Cliente cria/acessa assistente via API key.
2. Plataforma extrai dados da URL de venda e persiste contexto.
3. Usuário chega por widget, chatbot, link curto ou WhatsApp.
4. Mensagem entra em rota de chat.
5. Contexto é montado com `pageData`, histórico, lead, canal e flags.
6. Decision layers determinam intenção, estágio, CTA e tom.
7. LLM gera resposta por Groq/OpenRouter/OpenAI ou fallback.
8. Resposta é validada/sanitizada, recebe CTA/link quando aplicável.
9. Lead, conversa, eventos, agendamentos e analytics são salvos.

### Dependências críticas

- Variáveis `GROQ_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `API_KEYS_JSON`.
- PostgreSQL/SQLite e JSON storage.
- Redis para sessão em produção quando configurado.
- Crawl4AI/Puppeteer para extração dinâmica.
- Twilio/Evolution para WhatsApp.
- Feature flags para comportamento de engines.

## 3. Mapa da documentação

| Documento | Finalidade | Quando consultar | Importância |
|---|---|---|---|
| `docs/ARCHITECTURE.md` | Visão da arquitetura, endpoints críticos, tenancy, funções críticas e checklist. | Primeiro contato, mudança em API, leads, CORS, HTML ou tenancy. | Crítico absoluto |
| `docs/PATCH_V9.1_V9.2_CHECKOUT.md` | Registro do patch de checkout V9.1/V9.2. | Investigação de checkout, CTA e regressões de conversão. | Crítico |
| `docs/openapi.yaml` | Contrato OpenAPI de endpoints. | Integração externa, teste manual de API, validação de payloads. | Importante |
| `docs/KNOWLEDGE_TRANSFER_PLAYBOOK.md` | Manual de transferência de conhecimento. | Onboarding, férias do dev principal, investigação e governança. | Crítico absoluto |

Documentos citados pela missão, mas não presentes no repositório no momento da consolidação: `REGRESSAO_V21.md`, `REGRESSAO_WHATSAPP.md`, `REGRESSAO_LINK_CURTO.md`, `MISSAO_09_DEPENDENCIAS_OCULTAS.md` e master maps específicos. Quando existirem, devem ser tratados como fontes de auditoria histórica, porém este playbook não inventa conteúdo ausente.

## 4. Arquitetura em 10 minutos

O Link Mágico é um monólito Express. O usuário final conversa via widget, link curto/chatbot ou WhatsApp. Cada requisição carrega uma API key ou identificador equivalente. Essa chave seleciona tenant, dados de assistente, leads, short URLs e configurações. O conteúdo comercial vem de uma URL extraída por `extractPageData` e módulos auxiliares. A extração gera `pageData` com texto limpo, links, checkout, WhatsApp, preço, benefícios, contatos e metadados. V18 avalia se a extração é confiável e pode descobrir/fazer fallback de links.

No chat, a plataforma monta mensagens para LLM. V17 pode assumir como cérebro unificado: detecta estratégia, monta prompt, chama LLM e injeta links. V19 pode assumir como autoridade determinística de decisão comercial quando ativo. Caso contrário, o fluxo legado usa Decision Core, Decision Engine, Sales Layer, CTA e validadores. A resposta passa por guards para evitar links errados, ausência de CTA em intenção de compra e problemas de contexto. Leads e agendamentos ficam em sistemas por tenant e em banco/JSON. Feature flags são decisivas: ligar ou desligar uma flag pode mudar a arquitetura ativa sem alterar código.

## 5. Componentes críticos

### `server.js`

Arquivo central. Responsável por inicialização Express, middlewares, rotas, sessão, CORS, health checks, extração, chat, lead capture, appointments, short links, integrações e bootstrap. Qualquer alteração nesse arquivo pode afetar múltiplos fluxos ao mesmo tempo.

### CTA Engine

Localizado em `sales/cta-engine.js` e complementado por resolvers/guards. Seu papel é transformar intenção, contexto e disponibilidade de link em chamadas de ação. É sensível a checkout, WhatsApp, intenção de compra e histórico para evitar CTA fraco, repetido ou ausente.

### Lead Capture

Implementado no `LeadCaptureSystem` em `server.js`, nos helpers do banco e no widget. Captura nome, e-mail, telefone, mensagem, origem, metadata e conversas. Deve respeitar tenant por API key e pode persistir em PostgreSQL ou JSON.

### Scheduler

Representado pelo bloco de appointments do `LeadCaptureSystem`, rotas `/api/appointments`, `/admin/appointments`, disponibilidade pública e integrações auxiliares. Converte intenção/agendamento em registros com status `pendente`, `confirmado`, `cancelado` ou `realizado`.

### Journey Stage

Calculado por camadas de decisão, especialmente `sales/decision-engine.js`, que interpreta histórico para estágios como descoberta, engajamento, objeção, negociação, fechamento e saída.

### Intent Detection

A detecção aparece em V13, Decision Engine, V17 link resolver e V19. Classifica mensagens como compra, dúvida, objeção, saída, suporte/humano etc. É base para CTA, pressão comercial e fallback de canal.

### Observer Layer

Camadas de observação aparecem em logs estruturados, diagnostics, analytics, learning, V18 honest diagnosis, health/status e eventos do widget. Seu papel é tornar visível o que o pipeline decidiu, qual provider respondeu e quais dados foram confiáveis.

### Decision Core

Camada de decisão comercial controlada por feature flag. Coordena intenção, estágio, checkout/WhatsApp e resposta. Convive com Decision Engine, Sales Layer, V17 e V19; por isso conflitos de autoridade são risco real.

### Conversation State

Estado vem de histórico enviado pelo cliente, memória V14/context layer, `conversationId`, `leadId`, widgets com localStorage, tabelas de memória/conversas e módulos de state. É usado para não reiniciar jornada a cada mensagem.

## 6. Canais da plataforma

### Link curto

Rota `/l/:shortCode` resolve código curto para URL/dados do assistente e registra acesso. A criação ocorre por `/api/create-short-url`. Depende de `short_urls`, API key, URL de destino, dados de vendas e roteamento correto para chat/redirect.

### Widget

`public/widget.js` injeta UI no site cliente. Mantém `conversationId`, localStorage de lead, formulário opcional de lead capture, envio de mensagens para chat universal/process-chat, renderização de CTAs e tracking. Depende de CORS aberto para domínios clientes e de `apiBase`/`apiKey` corretos.

### WhatsApp

`whatsapp-routes.js` e `whatsapp-integration.js` configuram providers, estados de conexão, notificações de lead e envio. Depende de configurações por tenant, Twilio/Evolution, telefone, conexão e cache/estado.

### Diferenças

- Link curto começa por resolução de código e tende a criar contexto de campanha/assistente.
- Widget roda no navegador do cliente e precisa tolerar CORS, localStorage e falhas de captura.
- WhatsApp depende de estado externo de conexão e mapeamento telefone/tenant.

## 7. Pipelines

### V17 — Unified Brain Orchestrator

Controlado por `FEATURE_V17_BRAIN`. Quando ativo, decide estratégia, intenção, modo de venda e tom; monta prompt; chama Groq/OpenRouter/OpenAI; sanitiza resposta e injeta links. Pode bypassar camadas legadas.

Dependências: `lib/v17-orchestrator.js`, `lib/v17-link-resolver.js`, feature flag, pageData, histórico, V14 context layer, LLM keys.

### V18 — Extraction Guard

Controlado por `FEATURE_V18_EXTRACTION_GUARD` e `FEATURE_V18_FALLBACK`. Avalia status da extração, confiança, links descobertos, diagnóstico honesto, fallback de checkout/WhatsApp e cache de falhas.

Dependências: `lib/v18-extraction-guard.js`, `pageData`, links brutos, cleanText, checkout/WhatsApp detectados, feature flags.

### V19 — Deterministic Decision Engine

Controlado por `FEATURE_DETERMINISTIC_V19` com modos `false`, `shadow` e `true`. Atua como autoridade única de decisão comercial no modo automático, com intent resolver determinístico, state machine e validação de confiança.

Dependências: `lib/v19-deterministic-engine.js`, estado da conversa, pageData, confiança da extração, feature flag/env.

### V20 — Persistência segura/Unicode e JSON

No código, V20 aparece como correções de sanitização antes de persistência JSON/PostgreSQL, especialmente para remover Unicode surrogates órfãos antes de salvar leads/metadados/conversas. O foco é estabilidade de persistência.

Dependências: `database.js`, serialização JSON/JSONB, leads, metadata, conversas e PostgreSQL.

## 8. Extração

Fluxo completo:

1. Rota recebe URL ou fluxo de criação/chat precisa de contexto.
2. `extractPageDataWithRetry` chama `extractPageData` com tentativas.
3. `extractPageData` usa estratégias HTTP/Cheerio, enhanced extractor, Puppeteer/Crawl4AI quando disponíveis e heurísticas de links.
4. `cleanText`/texto limpo remove ruído e prepara conteúdo consumível.
5. Chunking pode ser aplicado em adaptadores Crawl4AI e módulos de knowledge/RAG para dividir conteúdo grande.
6. Merge consolida resultados de extração básica, dinâmica, OCR, links e heurísticas.
7. O resultado vira `pageData`, incluindo `cleanText`, produto, preço, benefícios, links, checkout, WhatsApp, contatos e metadados.
8. V18 avalia confiabilidade e pode enriquecer `pageData` sem sobrescrever dados confiáveis.
9. O contexto enviado para IA contém instruções do assistente, resumo do produto, dados extraídos, histórico, estado, intenção e links permitidos.

## 9. IA e decisões

### Provedores

- **Groq:** primeira opção em vários fluxos quando `GROQ_API_KEY` existe.
- **OpenRouter:** fallback/alternativa quando `OPENROUTER_API_KEY` existe.
- **OpenAI:** fallback/alternativa quando `OPENAI_API_KEY` existe.

### Fluxo real

1. Mensagem normalizada entra no endpoint.
2. Contexto de tenant e pageData é carregado.
3. Feature flags definem se V17, V19 ou fluxo legado assume.
4. Decision Core/Engine/CTA avaliam intenção, estágio e ação.
5. Prompt é montado com contexto real.
6. Provider LLM responde.
7. Resposta é sanitizada, validada, recebe CTA/link e é salva.

## 10. Leads e conversão

Fluxo comercial:

1. Visitante inicia conversa por widget/link/WhatsApp.
2. Sistema detecta interesse, intenção ou formulário de lead.
3. `/api/capture-lead` ou rotas estruturadas salvam lead.
4. CTA Engine/Decision layers escolhem checkout, WhatsApp, agendamento ou resposta educativa.
5. Scheduler cria appointment quando há intenção de agendar.
6. WhatsApp pode receber notificação de novo lead ou virar CTA primário quando não há checkout confiável.

## 11. Multi-tenancy

### API Keys

A API key identifica cliente e seleciona dados. O código possui validação de API key, sessão, helpers de tenant e tabelas `api_keys`/`tenants`.

### Isolamento

Isolamento ocorre por `api_key`, `tenant_uuid`, nomes de arquivos por API key e filtros em queries. O risco principal é qualquer rota/helper esquecer o filtro de tenant.

### Armazenamento

- JSON legado: leads e appointments por API key.
- PostgreSQL/SQLite: tabelas tenant-aware.
- Configurações: API keys, WhatsApp settings, short URLs, CRM, leads, conversations.

## 12. Banco e persistência

### PostgreSQL

Ativado por `DATABASE_URL` ou `USE_POSTGRES=true`. Usa `pg.Pool`, migrations e JSONB para metadata/conversas.

### JSON Storage

Usado por sistemas legados e fallback: leads, appointments e backups em diretórios por tenant/API key.

### Backups

`LeadBackupSystem` gerencia criação, listagem e restauração de backups de leads por tenant. Rotas administrativas expõem operações.

### Dependências

Banco precisa estar inicializado antes das rotas críticas. Mudanças de schema devem preservar compatibilidade PostgreSQL/SQLite e JSON legado.

## 13. Integrações

| Integração | Papel | Impacto |
|---|---|---|
| WhatsApp | Canal, notificações, CTA e atendimento humano. | Quebra afeta conversão e suporte. |
| Gmail | Envio/status de e-mail via rotas V3. | Afeta comunicação operacional. |
| OpenAI | LLM fallback/alternativa. | Afeta geração de resposta. |
| Groq | LLM principal em vários fluxos. | Afeta latência/resposta. |
| OpenRouter | LLM fallback/roteamento. | Afeta resiliência de IA. |
| Redis | Store de sessão em produção. | Afeta login/sessões. |
| PostgreSQL | Persistência principal. | Afeta quase todos os dados. |
| Crawl4AI | Extração avançada. | Afeta qualidade de contexto. |

## 14. Feature flags

Localização principal: `lib/feature-flags.js`. Também há flags lidas de variáveis de ambiente no `server.js`.

Funcionamento: cada flag possui definição, default e leitura de ambiente. Algumas flags têm modo booleano; V19 aceita `shadow` e `true` via env.

Riscos:

- Ativar V17 pode bypassar pipelines legados.
- Ativar V19 em `true` muda autoridade de decisão.
- V18 fallback pode alterar links disponíveis quando extração é parcial.
- Flags de memória, learning, context e sales layer alteram estado e resposta sem mudança visível em rotas.

## 15. Deploy

Startup prático:

1. Node carrega `server.js`.
2. Dependências e módulos opcionais são importados com fallbacks.
3. Banco é inicializado por `initializeDatabase`.
4. Middlewares de CORS, sessão, auth, billing e rate limit são registrados.
5. Rotas principais são montadas.
6. Integrações opcionais são conectadas quando variáveis existem.
7. App escuta em `PORT` em `0.0.0.0`.

Bootstrap depende de variáveis de ambiente, banco, Redis opcional, diretórios `data/` e provedores externos.

## 16. Regressões históricas

Os arquivos `REGRESSAO_V21.md`, `REGRESSAO_WHATSAPP.md` e `REGRESSAO_LINK_CURTO.md` não estão presentes no repositório. Com base no código e documentação existente, as regressões historicamente sensíveis são:

- Checkout/CTA: links errados, CTA ausente, conflito entre engines.
- WhatsApp: conexão por tenant, provider externo, promoção indevida como CTA, fallback sem checkout.
- Link curto: resolução de código, associação tenant/assistente, redirect e tracking.
- HTML/widget: escaping, CORS, conversa sem lead, localStorage.
- Persistência: JSONB/PostgreSQL rejeitando Unicode inválido ou campos ausentes.

Lições documentadas no código: manter guards, usar feature flags, preservar fallback, não sobrescrever dados confiáveis, manter isolamento por API key e validar rotas críticas após mudanças.

## 17. Dependências ocultas

`MISSAO_09_DEPENDENCIAS_OCULTAS.md` não está presente. Dependências invisíveis observadas no código:

- `pageData` alimenta decisão, CTA, links, prompt, diagnóstico e fallback.
- `conversationId`/`leadId` conectam histórico, memória, widget e V14 context.
- CORS permissivo é requisito do widget externo.
- `apiKey` aparece em sessão, banco, JSON, WhatsApp, short URLs e lead capture.
- Feature flags podem mudar fluxo sem mudança de endpoint.
- Providers LLM são usados em cascata; remover um altera fallback.
- JSON legado e banco coexistem; alterar um sem migração quebra leitura.
- WhatsApp como CTA depende de ausência de checkout e confiança.
- Scheduler usa LeadCaptureSystem; não é sistema isolado.

## 18. Top 20 arquivos mais importantes

| Rank | Arquivo | Classe | Por quê |
|---|---|---|---|
| 1 | `server.js` | CRÍTICO ABSOLUTO | Núcleo da aplicação e rotas. |
| 2 | `database.js` | CRÍTICO ABSOLUTO | Persistência e migrations. |
| 3 | `lib/feature-flags.js` | CRÍTICO ABSOLUTO | Liga/desliga arquiteturas. |
| 4 | `public/widget.js` | CRÍTICO ABSOLUTO | Canal web principal. |
| 5 | `lib/v19-deterministic-engine.js` | CRÍTICO | Autoridade determinística de decisão. |
| 6 | `lib/v17-orchestrator.js` | CRÍTICO | Cérebro unificado. |
| 7 | `lib/v18-extraction-guard.js` | CRÍTICO | Confiabilidade da extração. |
| 8 | `sales/decision-engine.js` | CRÍTICO | Intenção, estágio e matriz. |
| 9 | `sales/cta-engine.js` | CRÍTICO | Conversão e CTA. |
| 10 | `whatsapp-routes.js` | CRÍTICO | Configuração/ciclo WhatsApp. |
| 11 | `whatsapp-integration.js` | CRÍTICO | Providers e notificações. |
| 12 | `enhanced-content-extractor.js` | IMPORTANTE | Extração avançada. |
| 13 | `crawl4ai_bridge.js` | IMPORTANTE | Ponte Node/Python para Crawl4AI. |
| 14 | `api-key-manager.js` | IMPORTANTE | Gestão de chaves. |
| 15 | `scheduling-manager.js` | IMPORTANTE | Disponibilidade/agendamentos auxiliares. |
| 16 | `lib/v14-context-layer.js` | IMPORTANTE | Memória/contexto conversacional. |
| 17 | `lib/lead-capture-score.js` | IMPORTANTE | Captura inline por intenção. |
| 18 | `lib/wa-cta-promoter.js` | IMPORTANTE | WhatsApp como CTA. |
| 19 | `short-url-generator.js` | SUPORTE | Geração de códigos curtos. |
| 20 | `docs/ARCHITECTURE.md` | SUPORTE | Referência arquitetural. |

## 19. Top 20 arquivos mais perigosos

1. `server.js`: pode quebrar todos os endpoints, bootstrap, chat, lead, extração e integrações.
2. `database.js`: pode corromper schema, migrations, tenant filters e persistência.
3. `lib/feature-flags.js`: pode mudar arquitetura ativa em produção.
4. `public/widget.js`: pode quebrar canal web, lead capture e CTA visual.
5. `sales/decision-engine.js`: pode reduzir conversão ou forçar CTA errado.
6. `sales/cta-engine.js`: pode remover checkout/WhatsApp ou repetir CTA.
7. `lib/v19-deterministic-engine.js`: pode quebrar autoridade de decisão.
8. `lib/v17-orchestrator.js`: pode alterar prompt, tom e injeção de links.
9. `lib/v18-extraction-guard.js`: pode confiar em extração ruim ou esconder links bons.
10. `whatsapp-routes.js`: pode desconectar tenants ou expor configuração errada.
11. `whatsapp-integration.js`: pode quebrar provider e notificações.
12. `api-key-manager.js`: pode comprometer isolamento.
13. `auth.js`/`auth-system.js`: pode afetar acesso e sessão.
14. `billing-enforcement.js`: pode bloquear chat indevidamente.
15. `lib/v14-context-layer.js`: pode misturar histórico entre usuários.
16. `lib/lead-capture-score.js`: pode capturar cedo/tarde demais.
17. `lib/wa-cta-promoter.js`: pode promover WhatsApp sobre checkout.
18. `enhanced-content-extractor.js`: pode degradar contexto.
19. `crawl4ai_bridge.js`: pode travar extração externa.
20. `short-url-generator.js`: pode colidir códigos ou quebrar links curtos.

## 20. Como investigar um bug

### Exemplo: bug no WhatsApp

1. Identificar sintoma: conexão, envio, recebimento, CTA, notificação ou tenant errado.
2. Consultar documentos: este playbook, `docs/ARCHITECTURE.md`, OpenAPI se endpoint público estiver envolvido.
3. Verificar arquivos: `whatsapp-routes.js`, `whatsapp-integration.js`, `database.js`, `server.js`, `lib/wa-cta-promoter.js`.
4. Confirmar tenant: API key, `tenant_uuid`, tabela `whatsapp_settings` e cache.
5. Confirmar provider: Twilio/Evolution/env vars.
6. Confirmar fluxo: rota de settings/status/connect/send, estado de conexão, logs.
7. Se for CTA WhatsApp: checar checkout ausente, V18, WA promoter e Decision layers.
8. Validar regressão manual mínima por canal afetado.

## 21. Como investigar uma regressão

1. Definir versão/flag/canal afetado.
2. Descobrir se houve mudança de feature flag.
3. Mapear endpoint de entrada.
4. Seguir dados: request → tenant → pageData → decision → LLM → resposta → persistência.
5. Comparar comportamento com documentação e testes existentes.
6. Procurar logs de V17, V18, V19, provider LLM e validators.
7. Verificar se fallback foi acionado.
8. Confirmar se regressão é de código, config, provider externo, banco ou dado extraído.

## 22. Como auditar uma nova feature

1. Identificar canais afetados: widget, link curto, WhatsApp, API.
2. Identificar dados afetados: leads, conversations, short_urls, settings, appointments.
3. Identificar engines afetadas: V17, V18, V19, Decision Core, CTA.
4. Checar feature flag existente ou necessária.
5. Checar isolamento por tenant.
6. Checar fallback quando provider externo falha.
7. Checar persistência PostgreSQL/SQLite/JSON.
8. Checar testes de regressão do canal e da conversão.

## 23. Como fazer alterações com segurança

Checklist técnico:

- Entender se `server.js` será tocado.
- Localizar feature flags relacionadas.
- Confirmar impacto em `apiKey`/tenant.
- Confirmar impacto em `pageData` e contexto de IA.
- Confirmar impacto em CTA/checkout/WhatsApp.
- Confirmar persistência PostgreSQL e JSON legado.
- Confirmar histórico/conversationId/leadId.
- Rodar testes relevantes existentes.
- Testar pelo menos um fluxo feliz e um fallback.
- Não alterar CORS do widget sem auditoria.
- Não alterar ordem de providers sem validar fallback.

## 24. O que nunca deve ser alterado sem auditoria

- CORS global do widget.
- Validação de API key e filtros de tenant.
- Schema/migrations de leads, short URLs, WhatsApp e conversations.
- `extractPageData` e V18 guard.
- Regras de CTA/checkout/WhatsApp.
- Feature flags V17/V18/V19.
- Geração de HTML do chatbot/widget e escaping.
- Rotas `/api/chat-universal`, `/api/process-chat-inteligente`, `/api/capture-lead`, `/l/:shortCode`.
- Persistência de appointments e backups.

## 25. O que exige teste de regressão

- Mudança em chat ou prompts: testar intenção de compra, dúvida, objeção e suporte.
- Mudança em extração: testar URL com checkout, URL sem checkout e URL com WhatsApp.
- Mudança em widget: testar abertura, captura de lead, envio, CTA e localStorage.
- Mudança em WhatsApp: testar settings, status, connect/disconnect e notificação.
- Mudança em link curto: testar criação, resolução e tracking.
- Mudança em banco: testar leitura/gravação por tenant e fallback SQLite/JSON quando aplicável.
- Mudança em feature flags: testar flag off, shadow quando existir e flag on.

## 26. Matriz de governança

| Área | Revisor recomendado |
|---|---|
| Arquitetura | Tech lead/backend principal + responsável de produto |
| Pipelines V17/V18/V19/V20 | Tech lead + especialista em IA/LLM |
| Extração | Backend + responsável por dados/contexto |
| CTA | Produto/comercial + backend |
| Lead Capture | Produto/comercial + backend + dados |
| Scheduler | Produto/operações + backend |
| Multi-tenancy/API keys | Tech lead + segurança |
| Banco/migrations | Backend sênior + DevOps |
| WhatsApp | Backend + operações/suporte |

## 27. Checklist de onboarding

### Dia 1

- Ler este playbook e `docs/ARCHITECTURE.md`.
- Entender startup, variáveis e estrutura de diretórios.
- Mapear endpoints principais no `server.js`.

### Dia 2

- Estudar multi-tenancy: API keys, tenants, leads, short URLs.
- Ler `database.js` e identificar tabelas críticas.
- Rodar health/status local se ambiente permitir.

### Dia 3

- Estudar extração: `extractPageData`, enhanced extractor, Crawl4AI e V18.
- Testar mentalmente fluxo URL → pageData → prompt.

### Dia 4

- Estudar IA/decisão: V17, V19, Decision Engine, CTA Engine.
- Seguir uma mensagem de chat do endpoint até a resposta final.

### Dia 5

- Estudar canais: widget, link curto e WhatsApp.
- Simular investigação de bug usando o playbook.
- Revisar lista de arquivos perigosos e checklist de regressão.

## 28. Checklist de férias do dev principal

### Precisa estar documentado

- Variáveis de ambiente de produção.
- Feature flags ativas.
- Tenants/API keys principais.
- Providers LLM ativos e fallback.
- Provider WhatsApp ativo.
- Procedimento de backup/restore.
- Endpoints críticos e fluxos de teste.

### Precisa estar monitorado

- Health/status da API.
- Banco e migrations.
- Redis/sessões.
- Erros LLM por provider.
- Falhas de extração/V18.
- WhatsApp connection state.
- Taxa de captura de leads, CTAs e appointments.

### Precisa estar validado

- Chat universal e chat inteligente.
- Widget em domínio externo.
- Link curto.
- Captura de lead.
- CTA de checkout.
- WhatsApp como canal/CTA.
- Backup de leads.

## 29. Resumo executivo final

Se o desenvolvedor principal desaparecer amanhã:

### O que está documentado

- Arquitetura geral e endpoints críticos.
- Fluxos de chat, lead, extração, CTA, WhatsApp, link curto e scheduler.
- Pipelines V17, V18, V19 e V20 observados no código.
- Arquivos críticos e perigosos.
- Procedimentos de investigação, regressão, auditoria e onboarding.

### O que ainda depende de conhecimento humano

- Estado real de produção e flags ativas.
- Histórico completo das regressões cujos arquivos não estão no repositório.
- Decisões comerciais por trás de pressão de CTA, WhatsApp e checkout.
- Credenciais/providers reais e operação de tenants importantes.

### O que é seguro manter

- Operação cotidiana sem mexer em engines.
- Monitoramento de health, leads, appointments e status WhatsApp.
- Consultas e pequenas análises baseadas em documentação e logs.

### O que é arriscado alterar

- `server.js`, `database.js`, feature flags, V17/V18/V19, CTA, tenant isolation, widget, WhatsApp e link curto.

### Maturidade documental

A maturidade documental é **intermediária em evolução**: há documentação arquitetural e agora um playbook consolidado, mas faltam no repositório os documentos históricos de regressão e dependências ocultas citados pela missão. O código contém muitos comentários úteis, logs e feature flags, porém parte do conhecimento operacional de produção ainda precisa ser confirmado fora do repositório.
