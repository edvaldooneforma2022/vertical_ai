\# REGRESSÃO — Canal Link Curto



\## Escopo

Auditoria exclusiva do canal \*\*Link Curto\*\* da plataforma Link Mágico, com foco em pontos que podem gerar regressões. Este documento não propõe correções; apenas mapeia dependências, cadeia de execução, riscos e evidências técnicas observáveis no código.



\## Evidências-base usadas

\- `GET /l/:shortCode` resolve o código curto, consulta cache/banco, incrementa acesso, registra analytics, carrega whitelabel e redireciona para `/chatbot` com `name`, `url`, `instructions` e `apiKey`.

\- `POST /api/create-short-url` cria o link curto, valida `apiKey`, `robotName` e `salesUrl`, aplica limite de billing, gera código único, persiste em `short\_urls`, cacheia e retorna `shortUrl`.

\- `/chatbot` gera a experiência pública que chama `/api/process-chat-inteligente`.

\- `POST /api/process-chat-inteligente` é o cérebro comum que processa mensagem, extração, IA, journey, decisão, CTA, captura e resposta.

\- `public/widget-inline-generator.js` executa captura de lead via `/api/capture-lead` antes de enviar mensagens ao pipeline inteligente.

\- `whatsapp-channel.js` documenta a regressão V21: WhatsApp passou a depender do mesmo endpoint do Link Curto e deve apenas traduzir decisões do pipeline central.



\---



\## 1. Dependências diretas



\### Endpoints utilizados

| Endpoint | Papel no Link Curto | Regressão possível |

|---|---|---|

| `GET /l/:shortCode` | Entrada pública do canal. Resolve `shortCode` e redireciona para `/chatbot`. | Link público retorna 404/500, redireciona sem `apiKey`, perde whitelabel ou usa cache obsoleto. |

| `GET /chatbot` | Renderiza a página/chat público com parâmetros do assistente. | Chat abre sem configuração, sem URL de venda, sem instruções, sem whitelabel ou com script quebrado. |

| `POST /api/process-chat-inteligente` | Pipeline principal de conversa e decisão comercial. | Respostas genéricas, ausência de CTA, link errado, regressão de intenção/jornada/captura/agendamento. |

| `POST /api/create-short-url` | Criação de links curtos no dashboard. | Cliente não consegue criar assistente; limite de plano aplicado de forma errada; short URL duplicado/inativo. |

| `GET /api/assistants` | Lista assistentes a partir de `short\_urls`. | Dashboard não mostra assistentes criados; contagem/leads divergentes. |

| `POST /api/capture-lead` | Captura lead antes ou durante a conversa. | Conversa fica bloqueada no formulário, lead não aparece no CRM, agendamento/CTA condicionado a lead falha. |

| Rotas públicas de calendário/agendamento | Usadas quando o pipeline retorna sinal de agenda. | CTA de agenda aparece antes da captura ou deixa de aparecer. |

| APIs de whitelabel público | Carregam marca, logo, cores e powered-by. | Cliente perde identidade visual no Link Curto. |



\### Módulos chamados

| Módulo | Uso direto/funcional | Risco |

|---|---|---|

| `short-url-generator.js` | Valida e gera códigos curtos únicos. | Códigos inválidos, colisões ou links não resolvíveis. |

| `database.js` / `DatabaseHelpers` | CRUD em `short\_urls`, leitura por `api\_key`, incremento de acessos. | Fonte de verdade do Link Curto fica inconsistente. |

| `CacheManager` | Cache Redis de `short\_url:{code}`. | Dados obsoletos após edição/criação; redirecionamento para URL antiga. |

| `analyticsManager` / `analytics` | Eventos `short\_url\_accessed`, `short\_url\_created` e métricas de chat. | Dashboard subestima/duplica acessos e conversas. |

| `whitelabelManager` | Carrega identidade visual no redirect e no chatbot. | Regressão visual/comercial para clientes whitelabel. |

| `billingManager` / `billingMiddleware` | Limites de criação e uso do chat. | Bloqueio indevido de criação/conversa ou uso além do plano. |

| `extractPageData` | Extrai conteúdo da URL quando `pageData` vem incompleto. | IA responde sem contexto, inventa benefícios ou não encontra checkout. |

| `getLeadSystem(apiKey)` | Mantém leads e histórico por tenant. | Vazamento/cross-tenant ou perda de histórico. |

| `generateAIResponse` | Monta prompt, chama LLMs, aplica camadas V9–V15 e retorna resposta base. | Regressão de tom, CTA, link, memória, detecção de intenção. |

| `public/widget-inline-generator.js` | UI pública, captura lead, envio ao endpoint inteligente, renderização de links/CTA. | Usuário envia mensagem mas nada chega ao backend; CTA renderiza incorretamente. |



\### Middlewares utilizados

| Middleware | Onde afeta | Regressão |

|---|---|---|

| Autenticação/API key global | `/api/process-chat-inteligente` usa `requireApiKey`; `/l/\*` é liberado como rota pública. | Se `/l/\*` deixar de ser público, todos os links curtos quebram. Se `apiKey` não for propagada, conversa vira 401/tenant errado. |

| `billingMiddleware` | Pipeline inteligente. | Conversas públicas podem ser bloqueadas por billing mal resolvido. |

| Sessão/tenant | Dashboard e criação/listagem de assistentes. | Assistentes aparecem em tenant errado ou somem do painel. |

| Rotas públicas | `/l/`, `/chatbot`, `/api/public/`, `/api/webhook/` etc. | Alterações na allowlist afetam acesso público sem login. |



\### Sistemas compartilhados

\- Banco `short\_urls`: fonte primária do canal.

\- Redis/cache: acelera resolução, mas pode congelar configurações antigas.

\- Billing/planos: controla criação e uso.

\- Lead System/CRM: captura, histórico e funil.

\- Analytics: acessos e conversas.

\- Whitelabel: marca do cliente.

\- IA multi-provider: Groq, OpenRouter, OpenAI e fallback local.

\- Scheduler/calendário: dependente da ordem captura → agendamento.

\- WhatsApp V21: depende do mesmo cérebro do Link Curto, o que aumenta risco de mudanças globais.



\---



\## 2. Dependências indiretas



| Componente indireto | Como afeta o Link Curto sem ser “do canal” | Sintoma de regressão |

|---|---|---|

| CTA Engine / Decision Core | Pós-processa intenção de compra e injeta checkout/suporte. | Usuário pede compra e não recebe link; recebe link errado; CTA repetitivo. |

| Decision Engine V1/V2 | Decide estratégia antes do Sales Layer. | Conversa muda de tom, pula etapas ou pressiona demais. |

| Sales Layer | Reescreve resposta final para persuasão. | Resposta deixa de responder a pergunta e vira pitch. |

| Scheduler | Usa sinais do pipeline para agendamento. | Calendário surge antes da captura ou desaparece. |

| Lead Capture | Widget bloqueia envio até capturar dados; pipeline também retorna sinal de captura. | Loop de captura; lead duplicado; perda de conversa. |

| Journey Stage | Determina estágio do cliente e alimenta prompt/decisão. | Lead quente tratado como frio; pós-venda vira nova venda. |

| Intent Detection | Classifica compra, objeção, humano, pós-venda, stress etc. | Resposta contraditória; não respeita pedido de humano; link de compra quando usuário está irritado. |

| Observer Layer/telemetria | Logs e comparação de paridade entre canais. | Regressão fica invisível no monitoramento. |

| V17 / Link Resolver | Normaliza e resolve CTAs/links para canais. | Checkout não aparece em WhatsApp/Link Curto ou vira URL da página. |

| V18/V19/V20 | Camadas posteriores de orquestração/limpeza/contexto quando presentes no pipeline. | Mudança aparentemente isolada altera resposta final, limpeza de links ou regras de contexto. |

| V21 | WhatsApp usa o endpoint do Link Curto como fonte de decisão. | Fix no WhatsApp quebra Link Curto, ou fix no Link Curto altera WhatsApp. |

| LLM Optimizer/cache | Cacheia respostas por `chatbotId`/`apiKey`. | Usuário recebe resposta antiga sem novo checkout/instrução. |

| Knowledge Base | Busca FAQ por `chatbotId`/robotName. | Resposta usa FAQ errada ou não usa FAQ configurada. |

| Whitelabel | Configura visual e `powered by`. | Cliente percebe perda de marca, logo ou cores. |

| Billing | Valida criação e conversa. | Link criado mas chat bloqueado; planos free/pro inconsistentes. |



\---



\## 3. Componentes críticos



\### Arquivos críticos

| Arquivo | Criticidade | Motivo |

|---|---:|---|

| `server.js` | Crítico | Contém rotas `/l/:shortCode`, `/api/create-short-url`, `/chatbot`, `/api/process-chat-inteligente`, middlewares e camadas de decisão. |

| `database.js` | Crítico | Define persistência e consultas em `short\_urls`. |

| `short-url-generator.js` | Alto | Geração/validação de códigos curtos. |

| `public/widget-inline-generator.js` | Crítico | UI pública do Link Curto, captura lead e chamada ao pipeline. |

| `whatsapp-channel.js` | Alto | Canal V21 consome o mesmo cérebro do Link Curto; alterações de paridade afetam sem chamada direta do usuário Link Curto. |

| `structured-leads.js` | Alto | Persistência estruturada de leads e estatísticas. |

| `whitelabel.js` | Médio/Alto | Marca do cliente na experiência pública. |

| `analytics.js` | Médio | Métricas de acesso/conversa e regressão detectável. |

| `billing.js` / rotas de billing | Alto | Limites e bloqueios comerciais. |



\### Funções/trechos críticos

\- `ShortUrlGenerator.isValid()` e `ShortUrlGenerator.generateUnique()`.

\- `DatabaseHelpers.createShortUrl()`, `getShortUrl()`, `updateShortUrlAccess()`, `getShortUrlsByApiKey()`, `shortCodeExists()`.

\- Handler `GET /l/:shortCode`.

\- Handler `POST /api/create-short-url`.

\- Handler `GET /chatbot`.

\- Handler `POST /api/process-chat-inteligente`.

\- `generateAIResponse()`.

\- `applyDecisionCoreSafe()`.

\- Chamadas a `extractPageData()`.

\- Captura `captureLead()` e envio de mensagem em `public/widget-inline-generator.js`.

\- `\_callUnifiedBrain()` em `whatsapp-channel.js`, por ser consumidor V21 do mesmo pipeline.



\### Rotas críticas

\- `/l/:shortCode`

\- `/chatbot`

\- `/api/process-chat-inteligente`

\- `/api/create-short-url`

\- `/api/assistants`

\- `/api/capture-lead`

\- `/api/whitelabel-public/:chatbotId`

\- Rotas públicas de calendário/agendamento



\### Feature flags e chaves de comportamento

| Flag/variável | Risco |

|---|---|

| `FEATURE\_DECISION\_CORE` | Liga/desliga override determinístico de compra/suporte. |

| `FEATURE\_AUTO\_CHECKOUT\_DETECTION` | Preserva/injeta checkout extraído. |

| `FEATURE\_CLEAN\_CHAT\_V2` | Altera busca de FAQ e combinação com superinteligência. |

| `FEATURE\_PRESETS` | Seleção automática de preset por conteúdo/URL. |

| `FEATURE\_SALES\_LAYER` | Pós-processamento persuasivo. |

| `FEATURE\_DECISION\_ENGINE` | Decide estratégia comercial antes do Sales Layer. |

| `FEATURE\_DECISION\_ENGINE\_V2` | Substitui/faz fallback para Decision Engine V1. |

| `FEATURE\_V11\_ENGINE` | Injeta mapa de links e estado conversacional. |

| `FEATURE\_MEUS\_ASSISTENTES` | Pode ocultar/listar assistentes. |

| `WA\_USE\_FULL\_PIPELINE` | Define se WhatsApp usa `/api/process-chat-inteligente`; mudanças impactam paridade V21. |

| `SALES\_LAYER\_MODE` | Pode desligar/manualizar decisões comerciais. |

| Chaves `GROQ\_API\_KEY`, `OPENROUTER\_API\_KEY`, `OPENAI\_API\_KEY` | Ordem/fallback de IA altera resposta. |



\---



\## 4. Cadeia completa de execução



```text

Usuário acessa /l/:shortCode

→ server.js valida shortCode

→ tenta CacheManager short\_url:{code}

→ se miss: DatabaseHelpers.getShortUrl(shortCode)

→ incrementa access\_count de forma assíncrona

→ analyticsManager.trackEvent(short\_url\_accessed)

→ whitelabelManager.getConfig(api\_key)

→ redirect /chatbot?name=\&url=\&instructions=\&apiKey=\&wl...

→ /chatbot gera HTML/JS público

→ widget abre conversa e, se necessário, exibe formulário de lead

→ POST /api/capture-lead salva lead e devolve leadId

→ usuário envia mensagem

→ JS envia POST /api/process-chat-inteligente com message, pageData/url, robotName, instructions, conversationId, leadId, apiKey

→ requireApiKey/billingMiddleware resolvem tenant/limite

→ getLeadSystem(apiKey) carrega sistema de leads

→ se pageData incompleto: extractPageData(url)

→ preserva/injeta checkoutLink quando flags ativas

→ detecta jornada/intenção/emoção

→ generateAIResponse monta prompt com contexto da página, histórico, instruções, KB, V10/V11 etc.

→ LLM cache opcional ou chamadas Groq → OpenRouter → OpenAI → fallback local

→ limpeza/normalização de resposta

→ Decision Engine/Sales Layer/Decision Core/CTA Link Resolver podem alterar resposta final

→ sinais de leadCapture/calendarHash/cta podem ser retornados

→ widget renderiza texto, links e botões/CTA

→ leadSystem atualiza conversa/histórico

→ analytics contabiliza uso

```



\---



\## 5. Pontos de regressão por componente



| Componente | O que quebra | Impacto comercial | Impacto técnico | Gravidade |

|---|---|---|---|---|

| `/l/:shortCode` | 404/500, redirect incorreto, query sem `apiKey`. | Campanhas em bio/anúncios param de converter. | Entrada pública fica indisponível. | Crítico |

| Cache Redis | Dados antigos de `sales\_url`, `instructions`, `api\_key`. | Cliente corrige link/instrução mas usuário vê versão antiga. | Inconsistência cache x banco. | Alto |

| `short\_urls` | Registro ausente/inativo/duplicado. | Assistentes deixam de existir para clientes. | Fonte de verdade corrompida. | Crítico |

| Billing na criação | Bloqueio indevido por contagem errada. | Cliente não cria novo assistente e pode cancelar. | Divergência `short\_urls` x `chatbots`. | Alto |

| Billing no chat | Conversa pública bloqueada. | Lead quente não recebe resposta. | Middleware impede pipeline. | Crítico |

| `/chatbot` | HTML sem parâmetros corretos. | Experiência pública quebra logo após redirect. | UI sem contexto/API key. | Crítico |

| Widget público | Captura/submit/renderização falha. | Usuário abandona antes de conversar. | JS falha no browser. | Crítico |

| Captura de lead | Loop, duplicidade, não salva contato. | Perda direta de leads. | CRM/histórico incompleto. | Crítico |

| `process-chat-inteligente` | Resposta genérica/erro. | Conversão cai em todos os links. | Pipeline central indisponível. | Crítico |

| Extração de página | Conteúdo/checkout não encontrado. | IA não sabe vender produto correto. | `pageData` incompleto. | Alto |

| Intent Detection | Compra/pós-venda/humano mal classificados. | Usuário decidido não compra; cliente irritado. | Regras e prompt erram caminho. | Alto |

| Journey Stage | Estágio errado. | Nutrição e CTA no momento errado. | Estado conversacional inconsistente. | Alto |

| CTA Engine | Link ausente/errado/repetido. | Perda de venda imediata. | Pós-processamento indevido. | Crítico |

| Sales Layer | Resposta vira propaganda e ignora pergunta. | Queda de confiança/conversão. | Pós-processamento altera conteúdo validado. | Alto |

| Scheduler | Agenda antes da captura ou nunca agenda. | Reuniões/vendas consultivas perdidas. | Ordem de sinais quebrada. | Alto |

| Whitelabel | Marca/logo/cor/powered-by incorreto. | Perda de valor para planos pagos/agências. | Config pública não aplicada. | Médio/Alto |

| Analytics | Acesso/conversa/lead não registrado. | Cliente não percebe ROI. | Observabilidade falsa. | Médio |

| V21 WhatsApp | Mudança no pipeline central altera canal externo. | Regressão cruzada e suporte elevado. | Acoplamento oculto entre canais. | Alto |

| LLM cache | Resposta antiga sem novo CTA. | Checkout errado após alteração do cliente. | Cache por chave ampla. | Alto |

| KB/FAQ | FAQ errada por `robotName/chatbotId`. | Resposta imprecisa. | Busca em base inadequada. | Médio |



\---



\## 6. Histórico de regressões detectáveis semelhantes ao V21



\### Padrão V21 observado

O WhatsApp declara que é canal puro de transporte e que toda decisão comercial vem do pipeline central usado pelo Link Curto. Ele chama o mesmo endpoint (`/api/process-chat-inteligente`) e traduz CTA, captura e agenda para WhatsApp. Logo, regressões semelhantes ao V21 surgem quando um canal altera ou interpreta decisões que deveriam continuar centralizadas.



\### Regressões semelhantes detectáveis

| Regressão | Como seria percebida | Sintomas | Arquivos envolvidos |

|---|---|---|---|

| Paridade quebrada entre Link Curto e WhatsApp | Mesma mensagem gera CTA diferente por canal. | WhatsApp injeta CTA inline, Link Curto não renderiza botão; ou Link Curto mostra checkout e WhatsApp não. | `server.js`, `whatsapp-channel.js`, `public/widget-inline-generator.js` |

| Ordem captura → agendamento quebrada | Usuário recebe agenda sem dados mínimos. | Calendário aparece antes de nome/email/telefone; WhatsApp adia mas Link Curto mostra. | `server.js`, `whatsapp-channel.js`, widget público, rotas de calendário |

| Link resolver/CTA regressivo | Usuário pede compra e recebe URL da página, não checkout. | Resposta com “acesse o site” em vez de link de pagamento; links removidos pela limpeza final. | `server.js`, camadas V11/V17, normalização de links |

| Cache de IA obsoleto | Cliente atualiza instrução/checkout e resposta antiga permanece. | Resposta menciona preço/link anterior; logs indicam cache HIT. | `server.js`, LLM optimizer/cache |

| `apiKey` perdida no redirect | Chat abre mas endpoint inteligente falha. | 401/tenant errado; captura não aparece no painel correto. | `server.js` `/l/:shortCode`, `/chatbot`, widget |

| Lead duplicado/cross-channel | Mesmo usuário vira dois leads desconectados. | Histórico separado entre Link Curto e WhatsApp; CRM mostra duplicidade. | `server.js`, `whatsapp-channel.js`, sistemas de lead |

| Limpeza final remove URL | IA gera link, resposta final não tem link clicável. | Logs mostram URL original e resposta limpa sem URL. | `server.js` limpeza de resposta, widget renderização |



\---



\## 7. Matriz de risco



| Componente | Arquivo | Impacto | Probabilidade | Risco Final |

|---|---|---:|---:|---:|

| Redirect Link Curto | `server.js` | Crítico | Médio | Crítico |

| Persistência `short\_urls` | `database.js` | Crítico | Médio | Crítico |

| Pipeline inteligente | `server.js` | Crítico | Alto | Crítico |

| CTA/Decision Core | `server.js` | Crítico | Alto | Crítico |

| Widget público | `public/widget-inline-generator.js` | Crítico | Médio | Crítico |

| Captura de lead | `public/widget-inline-generator.js`, `server.js`, `structured-leads.js` | Crítico | Médio | Crítico |

| Billing chat/criação | `server.js`, `billing.js` | Alto | Médio | Alto |

| Cache Redis | `server.js`, `database.js` | Alto | Médio | Alto |

| Extração de página | `server.js`, adaptadores de crawling | Alto | Médio | Alto |

| Journey/Intent | `server.js` | Alto | Alto | Crítico |

| Scheduler | `server.js` e módulos de calendário | Alto | Médio | Alto |

| Whitelabel | `server.js`, `whitelabel.js` | Médio | Médio | Médio/Alto |

| Analytics | `server.js`, `analytics.js` | Médio | Médio | Médio |

| WhatsApp V21 | `whatsapp-channel.js`, `server.js` | Alto | Alto | Crítico |

| LLM cache | `server.js` | Alto | Médio | Alto |

| Knowledge Base | `server.js`, `knowledge-base.js` | Médio | Médio | Médio |

| Assistants dashboard | `server.js` | Médio | Médio | Médio |



\---



\## 8. Conclusão Executiva



\### O que nunca deve ser alterado sem auditoria?

1\. A assinatura e payload de `/api/process-chat-inteligente`, porque é o cérebro do Link Curto e também base de paridade V21.

2\. O redirect `/l/:shortCode → /chatbot?...`, especialmente propagação de `apiKey`, `url`, `name`, `instructions` e whitelabel.

3\. A tabela/contrato `short\_urls`, incluindo `short\_code`, `api\_key`, `sales\_url`, `robot\_name`, `instructions`, `status` e `access\_count`.

4\. A allowlist pública de rotas `/l/\*` e `/chatbot`.

5\. A ordem captura → decisão → CTA → agendamento.

6\. As camadas de CTA/Decision Core/V11/V17 e limpeza de links.

7\. O contrato de renderização do widget público para links, CTA, leadId e conversationId.

8\. O cache de short URL e o cache de IA quando há checkout/instruções alteráveis pelo cliente.



\### O que pode ser alterado com segurança?

\- Textos estáticos de UI que não mudem IDs, seletores, payloads nem endpoints.

\- Estilos visuais do widget, desde que não removam classes/IDs usados por JS.

\- Logs e mensagens de diagnóstico, desde que não removam telemetria essencial de regressão.

\- Ajustes em documentação e páginas institucionais fora do fluxo `/l` → `/chatbot` → `/api/process-chat-inteligente`.

\- Novas métricas aditivas que não bloqueiem resposta nem alterem payload.



\### Quais áreas possuem maior acoplamento oculto?

1\. Link Curto ↔ WhatsApp V21: WhatsApp consome o mesmo endpoint e traduz decisões do pipeline central.

2\. Link Curto ↔ Billing: criação e conversa pública dependem de plano/limite.

3\. Link Curto ↔ Lead Capture ↔ Scheduler: agendamento depende de sinais e estado de captura.

4\. Link Curto ↔ Cache Redis/LLM cache: configurações alteradas podem não refletir imediatamente.

5\. Link Curto ↔ CTA/Decision/Sales layers: múltiplas camadas podem sobrescrever a resposta final.

6\. Link Curto ↔ Whitelabel: identidade visual vem de consulta indireta durante redirect/renderização.



\### Quais áreas representam maior risco comercial?

1\. CTA/checkout: qualquer falha remove o caminho de compra.

2\. Captura de leads: perda de contatos tem impacto direto em ROI e retenção.

3\. Disponibilidade de `/l/:shortCode`: links em bio, anúncios e campanhas deixam de funcionar.

4\. Billing mal aplicado: bloqueia conversas de leads pagos ou impede criação de assistentes.

5\. Whitelabel quebrado: reduz valor percebido para agências e planos pagos.

6\. Paridade V21: regressões cruzadas multiplicam suporte e reduzem confiança nos canais.



\---



\## Síntese final

O Link Curto não é apenas um redirect. Ele é a porta pública para um pipeline central altamente acoplado a banco, cache, billing, whitelabel, captura de lead, IA, decision/CTA engines, scheduler, analytics e paridade WhatsApp V21. O maior risco de regressão está em alterações aparentemente locais em `server.js` ou no widget que mudem payload, ordem de execução, links/CTA, `apiKey` ou estado conversacional. Qualquer mudança nessas áreas deve ser tratada como mudança de arquitetura de canal, não como ajuste simples.



