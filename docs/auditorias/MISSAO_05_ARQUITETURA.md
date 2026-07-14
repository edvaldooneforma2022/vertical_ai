Auditoria da Plataforma SaaS Link Mágico
Escopo cumprido: auditoria estática do projeto em /workspace/vertical_ai, sem alteração de arquivos, sem commit e sem push. O git status --short não retornou alterações.

1. Mapa completo da arquitetura
1.1 Visão geral
O projeto é uma aplicação Node.js / Express CommonJS com servidor monolítico principal em server.js, complementado por módulos auxiliares em lib/, rotas separadas em arquivos como routes.js e whatsapp-routes.js, frontend estático em public/, persistência híbrida em database.js, cache em Redis via cache.js, billing, analytics, whitelabel, CRM, lead capture, chatbot, short links e WhatsApp.

O próprio server.js centraliza os módulos essenciais: banco, cache, webhooks, billing, analytics, otimizador de LLM, knowledge base, rotas e inicialização. 

1.2 Camadas principais
Camada HTTP / SaaS
server.js inicializa middleware, sessões, CORS, rotas públicas, rotas autenticadas e endpoints críticos.

O CORS está configurado para permitir qualquer origem, coerente com a necessidade de widgets externos rodarem em domínios de clientes. 

Sessões usam Redis quando REDIS_URL existe; caso contrário, caem para MemoryStore, indicado como não recomendado para produção. 

Camada de autenticação e tenancy
/validate-api-key valida a API Key, grava tenantId, validatedApiKey, plano, status e dados do cliente na sessão. 

/api/session/me retorna o tenant autenticado com tenantId, apiKey, plano, status e dados do cliente. 

Diversos fluxos ainda resolvem o tenant por múltiplas fontes: sessão, header, query ou body, especialmente no WhatsApp. 

Camada de frontend / superfícies públicas
Painel principal: /app serve public/index_app.html. 

Chatbot público: /chatbot recebe name/robotName, url, apiKey, instructions e parâmetros whitelabel. 

Widget clássico: public/widget.js autodetecta o domínio do servidor a partir do <script src="...widget.js"> e aceita token opcional via query string. 

Widget v2: public/widget-v2.js é um widget inline moderno configurado por window.LinkMagicoWidgetConfig, com robotName, salesUrl, instructions, cores e apiKey. 

Camada de chat / IA
Existem dois endpoints centrais de conversa:

/api/process-chat-inteligente: endpoint principal usado pelos widgets, com extração automática quando pageData chega incompleto. 

/api/chat-universal: endpoint alternativo com lógica semelhante, incluindo salesMode, salesPreset, intenção de compra e extração quando o widget envia somente URL. 

O pipeline de IA inclui:

Extração de página (extractPageData).

Preservação de checkout vindo do widget.

Camadas V10/V11/V13/V14/V15/V16/V17/V18/V19 conforme flags.

LLM fallback em cascata: Groq → OpenRouter → OpenAI no trecho V17. 

Camada de dados
O projeto importa db, initializeDatabase, DatabaseHelpers e USE_POSTGRES de database.js, indicando persistência abstraída por helper. 

USE_POSTGRES depende de DATABASE_URL ou USE_POSTGRES=true, com fallback para armazenamento alternativo/local. 

Há tabelas/estruturas para tenants, chatbots, short URLs, leads, appointments, CRM, WhatsApp, audit logs, memória conversacional, settings, knowledge base e billing, conforme as migrations e helpers espalhados por database.js.

Camada de cache
CacheManager é usado em short URLs para cachear short_url:{shortCode} por 1 hora. 

O cache também é uma dependência para performance de extração, links curtos, sessões e possivelmente LLM/analytics.

Camada de billing
A criação de short URL verifica limite de chatbots por plano antes de criar o assistente. Há dois blocos de checagem de billing no fluxo. 

Billing é fail-open em caso de erro, permitindo continuidade quando a checagem falha. 

Camada de analytics
Acesso a short URL registra evento short_url_accessed. 

Criação de short URL registra short_url_created. 

O widget dispara eventos para /api/widget/analytics via sendBeacon ou fetch. 

2. Fluxo do Link Curto
2.1 Criação do link curto
Endpoint: POST /api/create-short-url.

Fluxo observado:

Recebe robotName, salesUrl, instructions e apiKey do body. 

Limpa cache de checkout por tenant se _v113ClearCache existir. 

Exige apiKey. 

Executa checagem de billing por limite de chatbots no plano. 

Exige robotName e salesUrl. 

Executa nova checagem de limite via DatabaseHelpers.getShortUrlsByApiKey. 

Gera shortCode único com ShortUrlGenerator.generateUnique, verificando colisão via DatabaseHelpers.shortCodeExists. 

Monta longUrl no formato /chatbot?name=...&url=...&instructions=...&apiKey=.... 

Persiste em banco via DatabaseHelpers.createShortUrl. 

Salva no cache Redis por 1 hora em short_url:{shortCode}. 

Registra analytics de criação. 

2.2 Geração do código curto
O gerador usa Base62, 6 caracteres, crypto.randomBytes, com até 10 tentativas para evitar colisão. 

A validação exige string de exatamente 6 caracteres e todos dentro do charset Base62. 

2.3 Acesso ao link curto
Endpoint: GET /l/:shortCode.

Fluxo observado:

Valida formato do shortCode. 

Busca primeiro no cache Redis short_url:{shortCode}. 

Em cache miss, busca no banco por DatabaseHelpers.getShortUrl(shortCode). 

Se encontrar no banco, salva no cache por 1 hora. 

Incrementa contador de acesso de forma assíncrona. 

Registra analytics short_url_accessed. 

Carrega whitelabel do tenant via whitelabelManager.getConfig(shortUrl.api_key). 

Monta query para /chatbot com name, url, instructions, apiKey e parâmetros whitelabel. 

Redireciona para /chatbot?.... 

2.4 Persistência dos links curtos
DatabaseHelpers possui helpers para criar, buscar, atualizar acesso, listar por API Key e verificar existência de short code. 

2.5 Relação com “Meus Assistentes”
routes.js lista assistentes a partir da tabela short_urls, filtrando ativos e mapeando para shortUrl: /s/{short_code} no frontend de assistentes. 

Há uma diferença operacional relevante: o redirecionamento implementado no servidor usa /l/:shortCode, enquanto a listagem de assistentes monta /s/${s.short_code}. 

3. Fluxo do Widget
3.1 Inicialização do widget clássico
public/widget.js:

Evita múltiplas inicializações verificando window.LinkMagicoWidget. 

Autodetecta o domínio da API pelo src do script contendo widget.js. 

Extrai token opcional da query string do script. 

Define estado interno: versão, flags de abertura, conversationId, token e tempo inicial. 

3.2 Envio de mensagem pelo widget clássico
O widget monta payload com:

message

robotName

instructions

salesUrl

pageData.url

pageData.checkoutLink

conversationId

leadId

apiKey

Em seguida envia POST para /api/process-chat-inteligente, com header X-Widget-Token. 

3.3 Envio de mensagem pelo widget v2
O widget v2 detecta checkout no DOM, coloca em pageData.checkoutLink e envia para /api/process-chat-inteligente com message, pageData, robotName, instructions, conversationId, leadId e apiKey. 

3.4 Tratamento no servidor
No endpoint /api/process-chat-inteligente:

Resolve API Key de req.cliente, sessão ou body. 

Exige message. 

Usa conversationId para registrar chat ativo por 30 minutos. 

Detecta se pageData tem conteúdo real (cleanText, title, summary). 

Se o widget enviou apenas URL, chama extractPageData(targetUrl). 

Faz merge seguro entre extração e pageData vindo do widget. 

Preserva checkoutLink enviado pelo widget como prioridade máxima. 

3.5 Analytics do widget
O widget envia eventos para /api/widget/analytics via navigator.sendBeacon; se indisponível, usa fetch(..., keepalive: true) e ignora falhas de analytics. 

4. Fluxo do WhatsApp
4.1 Rotas de configuração multi-tenant
Arquivo: whatsapp-routes.js.

A resolução da API Key aceita sessão, header x-api-key, query e body. 

Salvar settings
Endpoint: POST /api/whatsapp/settings.

Fluxo:

Resolve API Key.

Exige provider twilio ou evolution.

Valida campos obrigatórios por provider.

Salva via DatabaseHelpers.saveWhatsAppSettings.

Invalida cache do tenant com clearTenantCache. 

Buscar settings
Endpoint: GET /api/whatsapp/settings.

Fluxo:

Resolve API Key.

Busca via DatabaseHelpers.getWhatsAppSettings.

Se não houver config, retorna configured: false e indica se há fallback global por WHATSAPP_PROVIDER.

Retorna dados sem credenciais sensíveis. 

4.2 WhatsApp SaaS com Evolution Central
Connect
Endpoint: POST /api/whatsapp/saas/connect.

Fluxo:

Exige apiKey e tenantId de sessão. 

Verifica se a Evolution Central está configurada por variáveis de ambiente. 

Gera nome de instância por tenant e verifica settings existentes. 

Se houver token, consulta status da instância existente. 

Se a instância estiver morta por limite/expiração de QR, tenta deletar para recriar. 

Se não existir, cria instância na Evolution Central com token gerado. 

Configura webhook para /api/webhook/evolution. 

Aguarda inicialização e tenta buscar QR Code até 3 vezes. 

Salva settings em whatsapp_settings, atualiza colunas SaaS e invalida cache. 

Retorna instanceName, qrcode e mensagem de status. 

Status
Endpoint: GET /api/whatsapp/saas/status.

Fluxo:

Resolve API Key.

Busca settings.

Se não houver saas_instance_name, retorna not_configured.

Se a Evolution Central estiver indisponível/configuração ausente, retorna cache local.

Consulta /instance/status com token da instância.

Se conectado, consulta /instance/all com token global para obter telefone/JID.

Atualiza whatsapp_settings com status conectado/desconectado.

Retorna status, phone, pushName, instanceName, provider, connectedAt e lastSeen. 

Disconnect
Endpoint: POST /api/whatsapp/saas/disconnect.

Fluxo:

Resolve API Key.

Busca settings.

Faz logout na Evolution Central sem deletar a instância.

Atualiza estado local para disconnected.

Invalida cache e retorna mensagem. 

Reconnect
Endpoint: POST /api/whatsapp/saas/reconnect.

Fluxo:

Resolve API Key.

Exige Evolution Central configurada.

Busca settings e instância existente.

Solicita novo QR.

Se já conectado, retorna already_connected.

Atualiza estado para connecting.

Retorna qrcode. 

4.3 Envio WhatsApp legado
Além das rotas multi-tenant, há endpoints em server.js:

POST /api/whatsapp/send, protegido por requireApiKeyV3, chama whatsappManager.sendMessage(to, message).

GET /api/whatsapp/status, protegido por requireApiKeyV3, retorna whatsappManager.getStatus(). 

4.4 WhatsApp no pipeline de conversa
O WhatsApp aparece como:

Canal de suporte/handoff.

Fallback quando não há checkout.

Link detectado na extração (whatsappLink, contatos.whatsappLinks).

CTA alternativo em resolvers V17/V19.

O resolver V17 declara que WhatsApp é fallback real quando não há checkout e também fallback para link quebrado. 

5. Mapeamento de V17, V18, V19 e V20
5.1 V17 — Unified Brain / Link Resolver
Componentes encontrados
lib/v17-orchestrator.js

lib/v17-link-resolver.js

Integração em server.js no pipeline de conversa.

Função arquitetural
O V17 é descrito como um “Unified Brain Orchestrator” no pipeline, onde V17 decide estratégia, LLM executa, sanitizer limpa e links são injetados determinísticamente. 

Quando habilitado por FEATURE_V17_BRAIN ou variável de ambiente, ele:

Constrói estratégia com userMessage, extractedData e histórico. 

Loga intent, modo de venda, tom, checkout e WhatsApp permitidos. 

Monta prompt V17 com estratégia, pageData, instruções e sales mode. 

Usa histórico do V14 context layer se habilitado. 

Chama LLM em cascata Groq → OpenRouter → OpenAI. 

Aplica fallback se resposta vier vazia/curta. 

Sanitiza resposta. 

Injeta links reais pós-LLM. 

Salva histórico no V14 de forma fire-and-forget. 

V17 Link Resolver
lib/v17-link-resolver.js:

Detecta intent: link_broken, support, buy, link_request, price_strong, price_objection, explain, info. 

Só permite CTA para intents específicas: buy, link_request, support, link_broken, price_strong. 

Resolve melhor link com prioridade checkout → WhatsApp para compra/link/preço forte; WhatsApp direto para suporte/link quebrado. 

Remove CTAs antigos e URLs do texto de saída. 

Constrói CTA “Falar no WhatsApp” ou “Finalizar compra”. 

5.2 V18 — Extraction Guard
Arquivo: lib/v18-extraction-guard.js.

Função arquitetural
O V18 existe para diferenciar “não existe dado” de “não consegui extrair dado”. Ele adiciona uma camada de diagnóstico e confiança sem remover dados existentes. 

Submódulos declarados
V18.1 — Extraction Status.

V18.2 — Hard Truth Layer.

V18.3 — Diagnóstico Honesto.

V18.4 — Link Discovery Passivo.

V18.5 — Fallback Inteligente.

V18.6 — Failure Cache. 

Failure cache
Mantém falhas recentes em memória por 5 minutos, normalizando URL sem query string. 

Avaliação de extração
evaluateExtractionStatus(pageData) mede sinais como:

título

descrição

texto limpo

checkout

WhatsApp

preço

FAQ

contatos

método

origem do checkout 

O score dá peso para conteúdo textual, título/descrição, links críticos e dados enriquecidos. 

Há penalidade se o checkout veio de auto-checkout e não da heurística esperada, pois pode mascarar falha real de extração. 

5.3 V19 — Deterministic Decision Engine
Arquivo: lib/v19-deterministic-engine.js.

Função arquitetural
O V19 é documentado como autoridade única de decisão comercial: intent final, allowSell, allowCTA, allowCheckout, reset de IS_BUYER e bloqueio de checkout com baixa confiança. 

Rollout
FEATURE_DETERMINISTIC_V19=false: sistema atual intacto.

FEATURE_DETERMINISTIC_V19=shadow: roda paralelo apenas para log.

FEATURE_DETERMINISTIC_V19=true: V19 assume controle. 

O server.js carrega o V19 e define modo false, shadow ou true via feature flag ou variável de ambiente. 

Resolução de intent
O V19 possui padrões determinísticos para:

buy

price

objection

exit

support

confusion 

A resolução normaliza acentos, conta matches e aplica prioridade exit > support > objection > buy > price > confusion. 

Se não classificar, usa intent V17 como fallback mapeado. 

State machine
O V19 mantém estado conversacional em memória por 15 minutos. 

Regras principais:

exit, objection, confusion, support resetam isBuyer.

buy marca isBuyer=true.

price pode herdar isBuyer.

Estado anterior só é herdado em casos específicos. 

5.4 V20 — Mapeamento encontrado
Não encontrei arquivos, módulos ou rotas identificadas como V20 no projeto durante a auditoria estática por rg em server.js, lib/, public/, routes.js, whatsapp-routes.js e chatgpt-routes.js.

Portanto, dentro do código auditado:

V17 existe e está integrado ao pipeline.

V18 existe como guard de extração.

V19 existe como engine determinístico, com rollout por flag.

V20 não aparece implementado ou referenciado de forma identificável nos arquivos analisados.

6. Arquivos mais críticos
6.1 server.js
É o arquivo mais crítico do sistema. Centraliza:

middleware, CORS e sessão.

autenticação por API Key.

/app, /chatbot, /api/process-chat-inteligente, /api/chat-universal.

pipeline de IA.

short URL.

rotas de WhatsApp legadas.

inicialização de módulos.

billing, analytics, whitelabel, extração, leads e CRM.

Evidências:

Importa banco, cache, billing, analytics, knowledge base e rotas. 

Define CORS SaaS amplo para widgets externos. 

Implementa autenticação principal. 

Implementa /chatbot. 

Implementa endpoints principais de chat. 

Implementa short links. 

6.2 database.js
Crítico porque contém:

seleção Postgres/fallback.

migrations.

helpers de tenants, short URLs, WhatsApp, leads, CRM e cache de extração.

estruturas multi-tenant.

Evidências:

USE_POSTGRES é definido por ambiente. 

Short URLs e WhatsApp estão nos helpers. 

6.3 public/widget.js
Crítico porque é o script externo embutido no site do cliente:

autodetecta API base.

gera UI.

envia chat para /api/process-chat-inteligente.

carrega token opcional.

captura lead e analytics.

Evidências:

Autodetecção do domínio do servidor. 

Payload do chat com pageData, checkoutLink, leadId, apiKey. 

Analytics fire-and-forget. 

6.4 public/widget-v2.js
Crítico por ser variante inline moderna do widget e por enviar checkoutLink detectado no DOM para o backend. 

6.5 whatsapp-routes.js
Crítico para integração WhatsApp multi-tenant e SaaS:

settings por tenant.

Evolution Central.

QR Code.

status.

disconnect/reconnect.

cache de tenant.

Evidências: 

6.6 lib/v17-orchestrator.js
Crítico por poder assumir o fluxo de resposta e bypassar camadas antigas quando FEATURE_V17_BRAIN está ativo. A integração no server.js mostra que V17 decide estratégia, monta prompt, chama LLM, sanitiza e injeta links. 

6.7 lib/v17-link-resolver.js
Crítico por decidir CTA e fallback WhatsApp/checkout em nível de saída. 

6.8 lib/v18-extraction-guard.js
Crítico para confiabilidade de extração e diagnóstico entre falha real vs ausência de dado. 

6.9 lib/v19-deterministic-engine.js
Crítico por declarar autoridade única de decisão comercial quando habilitado. 

6.10 short-url-generator.js
Crítico para geração e validação dos códigos curtos. 

6.11 routes.js
Crítico para dashboard/assistentes, limpeza de assistentes e leitura de short_urls como fonte de “Meus Assistentes”. 

7. Dependências ocultas
7.1 Variáveis de ambiente
Dependências inferidas no código:

REDIS_URL: ativa Redis para sessões. 

DATABASE_URL / USE_POSTGRES: controla Postgres vs fallback. 

GROQ_API_KEY, OPENROUTER_API_KEY, OPENAI_API_KEY: controlam cascata LLM do V17. 

FEATURE_V17_BRAIN: ativa V17. 

FEATURE_DETERMINISTIC_V19: ativa ou coloca V19 em shadow. 

CENTRAL_EVOLUTION_URL, CENTRAL_EVOLUTION_API_KEY: exigidas para WhatsApp SaaS. 

APP_URL ou RENDER_EXTERNAL_URL: usado para montar webhook da Evolution. 

WHATSAPP_PROVIDER: indica fallback global de WhatsApp quando tenant não configurou settings. 

7.2 Cache Redis
O fluxo de short URL depende de cache para performance, mas mantém fallback em banco. Se cache contém dados antigos, o redirect pode continuar usando dados cacheados por até 1 hora. 

7.3 Sessão vs API Key no body
Vários fluxos aceitam API Key de body/query/header/sessão. Isso cria dependência implícita entre frontend, widget, painel e APIs. Exemplos:

/api/process-chat-inteligente usa req.cliente, sessão ou req.body.apiKey. 

WhatsApp usa sessão, header, query ou body. 

7.4 Whitelabel
Short links dependem de whitelabelManager.getConfig(api_key) para injetar parâmetros visuais no redirect para /chatbot. 

O /chatbot também busca whitelabel do banco quando os parâmetros não vierem na URL. 

7.5 Billing fail-open
A criação de assistente depende de billing, mas os blocos são fail-open em erro. Isso significa que a disponibilidade do billing afeta enforcement, mas não necessariamente bloqueia criação se falhar. 

7.6 Extração dinâmica
O widget pode enviar somente URL; o backend depende de extractPageData(targetUrl) para montar contexto real. 

7.7 V14 Context Layer
O V17 pode usar histórico real do V14 se FEATURE_V14_CONTEXT_LAYER estiver ativo. 

7.8 Analytics fire-and-forget
Analytics do widget e de short links são tolerantes a falha, logo métricas podem divergir sem quebrar fluxo de usuário. 

7.9 Evolution Central
WhatsApp SaaS depende de semântica específica da Evolution Go v0.7.1, incluindo endpoints /instance/create, /instance/connect, /instance/qr, /instance/status, /instance/all, /instance/logout. 

8. Pontos de regressão
Conforme solicitado, abaixo estão apenas pontos de regressão mapeados, sem propor correções.

8.1 CORS do widget
O CORS permite todas as origens para modo SaaS de widgets externos. Qualquer alteração nesse bloco pode quebrar widgets instalados em domínios de clientes. 

8.2 Sessão Redis vs MemoryStore
Sem REDIS_URL, sessões usam MemoryStore. Em produção com múltiplas instâncias, isso pode afetar autenticação, /api/session/me, WhatsApp SaaS e painel. 

8.3 API Key em múltiplas fontes
Mudanças na resolução de apiKey podem quebrar:

widget, que envia apiKey no body. 

/api/process-chat-inteligente, que lê body/sessão/cliente. 

WhatsApp, que lê sessão/header/query/body. 

8.4 Extração automática para widget
O backend trata como caso crítico o widget enviar pageData apenas com URL. Alterações nessa lógica podem quebrar entendimento de produto, checkout, WhatsApp e contexto. 

8.5 Preservação de checkout vindo do widget
O servidor preserva checkoutLink detectado pelo widget como prioridade máxima. Remover ou alterar essa precedência pode causar perda de CTA correto. 

8.6 Short URL cacheado por 1 hora
Alterações em short URLs podem não refletir imediatamente se cache Redis tiver short_url:{shortCode} salvo. 

8.7 Divergência /l/:shortCode vs /s/:short_code
O servidor implementa redirect em /l/:shortCode, mas a listagem de assistentes monta URL com /s/${short_code}. Isso é um ponto sensível de regressão entre dashboard e backend. 

8.8 Billing duplicado/fail-open na criação de assistentes
Há dois blocos de verificação de limite de chatbots no mesmo endpoint. Mudanças em um e não no outro podem gerar comportamento divergente. Ambos são fail-open em erro. 

8.9 V17 pode bypassar camadas antigas
Quando FEATURE_V17_BRAIN está ativo, o comentário indica bypass de V13, V15, V16, PP-GLOBAL e Sales Layer. Mudanças no V17 podem alterar drasticamente o comportamento conversacional. 

8.10 V17 injeta links pós-LLM
O V17 injeta links reais depois do LLM e do sanitizer. Regressão aqui afeta checkout completo, WhatsApp e prevenção de link truncado. 

8.11 V17 Link Resolver remove URLs do texto
stripCTAText remove URLs, domínios, emojis e CTAs clássicos. Alterações podem causar remoção indevida de informações ou deixar URLs antigas passarem. 

8.12 V18 penaliza auto-checkout
O V18 reduz confiança quando checkout veio de fonte que pode mascarar falha de extração. Mudança nesse score altera decisões posteriores de confiabilidade e CTA. 

8.13 V19 reseta comprador em objeção/saída/suporte
O V19 altera estado conversacional com reset de isBuyer em intents específicas. Mudanças nos padrões ou prioridade podem disparar ou suprimir CTAs em momentos errados. 

8.14 WhatsApp SaaS depende de tenantId na sessão
/api/whatsapp/saas/connect exige apiKey e tenantId; se a sessão não estiver populada por /validate-api-key, o connect falha com 401. 

8.15 WhatsApp SaaS depende de Evolution Central
Quando CENTRAL_EVOLUTION_URL e CENTRAL_EVOLUTION_API_KEY não estão configurados, o connect retorna 503. 

8.16 Webhook da Evolution usa APP_URL/RENDER_EXTERNAL_URL
Se a URL pública estiver errada, mensagens WhatsApp podem não chegar ao backend, mesmo com QR/instância criada. 

8.17 Settings WhatsApp e cache tenant
Após salvar, conectar, desconectar ou reconectar, o cache do tenant é invalidado. Regressões em clearTenantCache ou nos pontos de chamada podem deixar provider/status antigos em uso. 

Comandos usados na auditoria
Leitura e inspeção apenas; nenhum arquivo foi alterado.

Testing / Checks

✅ pwd && rg --files -g 'AGENTS.md' -g 'package.json' -g 'pyproject.toml' -g 'README*' -g 'src/**' -g 'app/**' -g 'pages/**' -g 'components/**' -g 'lib/**' -g 'supabase/**' -g 'prisma/**' -g 'docs/**' | head -300

✅ find .. -name AGENTS.md -print

✅ cat package.json && printf '\n---\n' && rg --files | sed -n '1,260p'

✅ sed -n '1,240p' docs/ARCHITECTURE.md && printf '\n---README---\n' && sed -n '1,220p' README.md

✅ rg -n "V17|v17|V18|v18|V19|v19|V20|v20|short|slug|redirect|widget|whatsapp|process-chat|chat-universal|api/wa|sendWhatsapp|WhatsApp|validate-api-key|criar-link|shortlink|link curto|linkResolver|resolve" server.js lib public/widget*.js whatsapp-routes.js routes.js chatgpt-routes.js | head -500

✅ sed -n '1,220p' lib/v17-orchestrator.js; printf '\n---v17 resolver---\n'; sed -n '1,240p' lib/v17-link-resolver.js; printf '\n---v18---\n'; sed -n '1,220p' lib/v18-extraction-guard.js; printf '\n---v19---\n'; sed -n '1,260p' lib/v19-deterministic-engine.js

✅ rg -n "app\.(get|post|put|delete)\(['\"]/(s/|api/short|api/links|api/create|api/process-chat-inteligente|api/chat-universal|api/widget|api/whatsapp|chatbot|validate-api-key|app['\"]|app\b)" server.js routes.js whatsapp-routes.js | sed -n '1,240p'

✅ sed -n '120,175p' routes.js; sed -n '820,930p' routes.js; sed -n '3920,3995p' server.js; sed -n '7600,7850p' server.js

✅ sed -n '12000,12480p' server.js

✅ sed -n '8370,8455p' server.js; sed -n '9100,9185p' server.js; sed -n '1790,1825p' public/widget.js; sed -n '790,820p' public/widget-v2.js

✅ rg -n "createShortUrl|getShortUrl\(|getShortUrlsByApiKey|updateShortUrlAccess|shortCodeExists|whatsapp_settings|saveWhatsAppSettings|getWhatsAppSettings|DatabaseHelpers|USE_POSTGRES|CacheManager|class Cache" database.js server.js routes.js whatsapp-routes.js short-url-generator.js widget-token.js | head -300

✅ sed -n '1,200p' short-url-generator.js; printf '\n---db short---\n'; rg -n "createShortUrl|getShortUrl\(|getShortUrlsByApiKey|updateShortUrlAccess|shortCodeExists|whatsapp_settings|saveWhatsAppSettings|getWhatsAppSettings" database.js -C 3

✅ nl -ba server.js | sed -n '108,130p;3628,3668p;3923,3982p;4839,4868p;6188,6290p;8374,8428p;9107,9165p;12240,12475p'

✅ nl -ba lib/v17-link-resolver.js | sed -n '1,120p'; nl -ba lib/v18-extraction-guard.js | sed -n '1,120p'; nl -ba lib/v19-deterministic-engine.js | sed -n '1,210p'

✅ nl -ba public/widget.js | sed -n '1,45p;1770,1815p;2170,2188p'; nl -ba public/widget-v2.js | sed -n '1,20p;790,820p'; nl -ba whatsapp-routes.js | sed -n '1,90p;211,405p;410,665p'

✅ git status --short && find .. -name AGENTS.md -print