# Manual Oficial de Operações de Engenharia — Link Mágico

> Documento operacional da plataforma SaaS Link Mágico. Este manual descreve operação, monitoramento, auditoria, manutenção e investigação diária com base no código presente no repositório, na arquitetura existente e nas regressões/riscos já documentados em artefatos do projeto. Não é um plano de correção nem uma lista de patches.

## 1. Visão geral

O Link Mágico é uma plataforma SaaS de chatbot com IA para vendas, captura de leads, distribuição de CTAs, link curto, atendimento via widget e WhatsApp, extração de páginas de venda, agendamento, CRM e integrações externas. A arquitetura declara `server.js` como servidor principal e centraliza endpoints críticos de autenticação, chatbot, leads, backup e agendamentos.

O objetivo operacional é manter a plataforma disponível, segura, previsível e auditável para múltiplos tenants, preservando:

- isolamento por API key;
- captura e persistência de leads;
- entrega correta de links e CTAs;
- continuidade do atendimento via widget e WhatsApp;
- disponibilidade de IA e fallback;
- integridade de banco, cache e arquivos de dados;
- rastreabilidade por logs, auditorias e métricas.

O escopo deste manual cobre rotinas de operação, monitoramento, investigação, resposta a incidentes, regressões, health checks e governança. Para manter a plataforma funcionando de forma segura, a operação deve observar diariamente os fluxos de entrada de mensagens, geração de respostas, extração de contexto, decisão de CTA, captura de lead, agendamento, persistência multi-tenant, integrações de IA e WhatsApp, além de bloquear deploys quando qualquer componente crítico apresentar inconsistência.

## 2. Inventário operacional

| Item | Arquivos / áreas | Função | Classe operacional |
|---|---|---|---|
| Servidor principal | `server.js` | Inicialização Express, rotas principais, chatbot, APIs, HTML dinâmico | CRÍTICO ABSOLUTO |
| Banco de dados | `database.js`, `data/` | PostgreSQL em produção, SQLite/JSON local, tabelas de leads, conversas, cache, WhatsApp, flags | CRÍTICO ABSOLUTO |
| Lead Capture | `lib/leads/lead-capture.js`, `database.js` | Captura, atualização, listagem e migração de leads/agendamentos | CRÍTICO ABSOLUTO |
| WhatsApp | `whatsapp-routes.js`, `whatsapp-channel.js`, tabelas `whatsapp_settings`, `whatsapp_messages` | Canal bidirecional SaaS, QR Code, estado de conexão, mensagens | CRÍTICO ABSOLUTO |
| IA / LLM | `llm-optimizer.js`, `chatgpt-integration.js`, `lib/v15-knowledge-enforcer.js`, `lib/v16-decision-engine.js` | Resposta conversacional, decisão, fallback e otimização | CRÍTICO ABSOLUTO |
| Decision Core | `lib/decision-core.js`, `lib/orchestrator.js`, `lib/v16-decision-engine.js` | Classificação de intenção, bloqueio/liberação de checkout, prioridade de resposta | CRÍTICO ABSOLUTO |
| CTA Engine | `sales/cta-engine.js`, `sales/sales-layer.js`, `lib/wa-cta-promoter.js` | Injeção contextual de CTA e links | CRÍTICO |
| Link curto | `short-url-generator.js`, `lib/links-map.js`, `lib/link-resolver.js`, `lib/v17-link-resolver.js` | Códigos curtos, resolução de checkout, normalização de links | CRÍTICO |
| Widget | `widget.js`, `chat.html`, `EXEMPLO-TESTE-WIDGET.html` | Canal web público do cliente | CRÍTICO |
| Extração | `lib/content-extractor-v112.js`, `lib/puppeteer-extractor.js`, `enhanced-content-extractor.js`, `lib/extraction/*` | Leitura de páginas, cleanText, contexto para IA | CRÍTICO |
| Scheduler / agendamentos | `scheduling-manager.js`, `lib/leads/lead-capture.js`, `database.js` | Criação, consulta e atualização de compromissos | CRÍTICO |
| Conversation State | `lib/conversation-state.js`, `lib/v13-state-manager.js`, `lib/persistent-memory.js` | Estado conversacional, memória, buyer state | CRÍTICO |
| Journey Stage | `modules/leads/journey-analyzer.js`, `sales/sales-layer.js` | Descoberta, negociação, objeção, fidelização | IMPORTANTE |
| Intent Detection | `lib/decision-core.js`, `lib/v13-intent-classifier.js`, `lib/v16-decision-engine.js` | Classificação de compra, suporte, objeção, dúvida, saída | IMPORTANTE |
| Observer Layer | `lib/audit-logger.js`, `analytics.js`, `weekly-report.js`, logs estruturados | Auditoria, métricas, relatórios | IMPORTANTE |
| Feature Flags | `lib/feature-flags.js`, `data/feature_flags.json`, tabela `feature_flags` | Controle gradual e reversível de comportamento | IMPORTANTE |
| Segurança e compliance | `auth.js`, `csrf-protection.js`, `compliance-middleware.js`, `csp-config.js`, `lib/lgpd-consent.js` | Autenticação, LGPD, CORS, headers | CRÍTICO |
| Cache | `cache.js`, Redis, `extraction_cache` | Cache de extração, resposta e sessões | IMPORTANTE |
| CRM / follow-up | `lib/crm/*`, `crm-integrations.js` | CRM, negócios, atividades e jobs | SUPORTE |
| Billing / Stripe | `stripe-routes.js`, `billing-*` | Assinaturas, métricas e monetização | SUPORTE |
| Admin | `admin-routes.js`, `lib/admin-routes-v8.js` | Operação administrativa | IMPORTANTE |

## 3. Componentes que devem ser monitorados

| Componente | O que monitorar | Impacto | Criticidade |
|---|---|---|---|
| `server.js` | uptime, erro 5xx, rotas `/api/*`, geração de chatbot, memória e latência | indisponibilidade geral | CRÍTICO ABSOLUTO |
| CTA Engine | presença de CTA quando intenção pede compra, ausência quando intenção é informativa, duplicidade | perda de conversão ou oversell | CRÍTICO |
| Lead Capture | volume de leads, campos obrigatórios, erro de persistência, duplicidade, isolamento por tenant | perda de leads | CRÍTICO ABSOLUTO |
| Scheduler | criação de agendamentos, status, conflitos, consultas por lead | falha comercial pós-conversa | CRÍTICO |
| Journey Stage | transições entre descoberta/negociação/objeção/fidelização | abordagem comercial inadequada | IMPORTANTE |
| Intent Detection | distribuição de intents, quedas para default, falsos positivos de compra | CTA errado e regressão de experiência | IMPORTANTE |
| Observer Layer | eventos ausentes, logs incompletos, auditoria por tenant | baixa capacidade de investigação | IMPORTANTE |
| Decision Core | decisões BUY/DEFAULT/SUPPORT/PRICE, bloqueios de checkout, fallback | resposta errada ou link indevido | CRÍTICO ABSOLUTO |
| Conversation State | contagem de mensagens, buyer state, memória, expiração | perda de contexto | CRÍTICO |

## 4. Operação do link curto

Fluxo operacional:

1. Gerar código curto de forma única em `short-url-generator.js`.
2. Resolver link final por mapas de links e contexto de checkout.
3. Entregar link somente quando Decision Core/CTA Engine autorizarem.
4. Registrar cliques, origem e tenant quando disponível.

Monitoramento:

- colisões de código curto;
- taxa de resolução sem destino;
- links de checkout ausentes;
- links enviados em intents proibidas;
- falhas de redirecionamento 3xx/4xx/5xx.

Indicadores:

- `% short links resolvidos com sucesso`;
- `tempo médio de redirecionamento`;
- `taxa de CTA com link válido`;
- `erros de checkout resolver`;
- `incidentes de link errado por tenant`.

## 5. Operação do WhatsApp

Fluxo operacional:

1. Tenant solicita conexão.
2. `whatsapp-routes.js` cria ou reutiliza instância SaaS.
3. QR Code é apresentado quando necessário.
4. Estado de conexão é persistido em `whatsapp_settings`.
5. Mensagens são registradas em `whatsapp_messages` e associadas a lead/conversa.
6. Canal conversa com IA, CTA, lead capture e CRM.

Monitoramento:

- `connection_state`, `last_seen`, `connected_at`;
- erro ao conectar, reconectar ou desconectar;
- diferença entre estado na Evolution/WhatsApp e banco;
- mensagens inbound sem resposta;
- mensagens outbound falhas;
- tenants com instância duplicada.

Pontos críticos:

- QR expirado;
- instância conectada fora do estado salvo;
- webhook não recebido;
- token/API key inválido;
- número trocado entre tenants;
- WhatsApp sem CTA quando decisão pede fechamento.

## 6. Operação do widget

Fluxo operacional:

1. Cliente incorpora `widget.js` no site.
2. Widget envia mensagens para APIs de chatbot.
3. Servidor processa contexto, IA, CTA e captura de lead.
4. Resposta retorna ao navegador.
5. Leads e conversas são persistidos por tenant.

Monitoramento:

- carregamento do script;
- CORS e bloqueios CSP;
- chamadas `/api/process-chat-inteligente` e `/api/chat-universal`;
- latência no navegador;
- erro JS no widget;
- taxa de abandono antes da primeira resposta.

Indicadores:

- conversas iniciadas;
- mensagens por sessão;
- leads capturados por conversa;
- erro de API por domínio;
- tempo até primeira resposta;
- conversão por CTA.

## 7. Operação da extração

Componentes: `extractPageData`, `cleanText`, chunking de texto, merges de dados extraídos e contexto IA. O código usa extratores de conteúdo, Puppeteer, cache de extração e módulos específicos como bônus/contatos.

Sinais de falha:

- `cleanText` vazio ou muito curto;
- título/descrição ausentes;
- preço/checkout/contatos não detectados;
- timeout de Puppeteer/crawler;
- cache devolvendo extração antiga;
- merge sobrescrevendo dado confiável por dado vazio;
- IA respondendo genericamente por falta de contexto.

Impacto operacional:

- respostas genéricas;
- CTA sem promessa do produto;
- link de checkout ausente;
- baixa conversão;
- aumento de suporte humano;
- risco de informação incorreta.

## 8. Operação do CTA Engine

Comportamento esperado:

- mapear intenção e ação em CTA;
- evitar repetição de CTA na mesma conversa;
- não duplicar CTA já existente;
- priorizar CTA forte quando há intenção de compra/hesitação;
- respeitar bloqueios do Decision Core.

Indicadores:

- taxa de respostas com CTA por intent;
- CTA duplicado por conversa;
- CTA ausente em compra;
- CTA indevido em dúvida/suporte;
- cliques por tipo de CTA.

Falhas comuns:

- intent mal classificada;
- contexto sem checkout;
- resposta já contém CTA e engine não injeta;
- texto do CTA não corresponde ao canal;
- link normalizado incorretamente.

## 9. Operação do Lead Capture

Captura:

- entrada via widget, WhatsApp, API e fluxos de CRM;
- dados principais: nome, email, telefone, mensagem, origem, status, metadados e conversas;
- enriquecimento com jornada e canal.

Persistência:

- PostgreSQL/SQLite por `database.js`;
- fallback JSON em `lib/leads/lead-capture.js`;
- índices por API key, telefone WhatsApp, status e data;
- sincronização assíncrona com CRM sem bloquear salvamento do lead.

Monitoramento:

- erros de `saveLead`;
- lead salvo sem tenant;
- campos obrigatórios vazios;
- discrepância entre lead capturado e CRM;
- duplicidade por email/telefone;
- queda na taxa de lead por conversa.

## 10. Operação do Scheduler

Criação:

- agendamentos são criados com lead, data/hora, status, notas e origem;
- dados podem vir de API, conversa ou painel.

Atualização:

- status válidos: `pendente`, `confirmado`, `cancelado`, `realizado`;
- alterações devem preservar leadId, tenant e histórico operacional.

Falhas:

- conflito de horário;
- lead inexistente;
- datetime inválido;
- divergência entre JSON e banco;
- consulta por lead sem retorno;
- agendamento criado sem notificação humana.

## 11. Operação do Journey Stage

Estados principais:

- `descoberta`: início, perguntas abertas, baixa pressão;
- `negociacao`: interesse/compras, uso maior de CTA;
- `objecao`: preço, confiança, garantia, prazo;
- `fidelizacao`: pós-venda ou recompra.

Monitoramento:

- transições por conversa;
- tempo em cada estágio;
- CTA por estágio;
- taxa de compra por estágio;
- regressões para estado inicial.

Divergências:

- usuário pronto para comprar mantido em descoberta;
- objeção tratada como compra;
- pós-venda recebendo checkout;
- estado perdido entre widget e WhatsApp.

## 12. Operação do Intent Detection

Classificação esperada:

- compra/ready to buy;
- dúvida/informação;
- objeção;
- suporte/humano;
- saída/dropoff;
- preço;
- pós-venda;
- default/neutral.

Erros:

- falso positivo de compra gera oversell;
- falso negativo de compra perde conversão;
- suporte tratado como venda aumenta atrito;
- saída tratada como encerramento neutro reduz retenção.

Monitoramento:

- distribuição de intents por canal;
- aumento de DEFAULT;
- intents BUY sem checkout;
- intents SUPPORT sem handoff;
- divergência entre V13/V16/Decision Core.

## 13. Operação do Decision Core

Decisões:

- liberar checkout somente quando intenção e contexto permitirem;
- bloquear checkout para informação, objeção, humano, stress e neutral;
- priorizar suporte/pós-venda quando detectado;
- permitir override determinístico em compra, preço e recompra.

Prioridades:

1. Segurança e não-oversell.
2. Suporte humano quando necessário.
3. Compra explícita com checkout válido.
4. Resposta contextual com IA.
5. CTA leve apenas quando coerente.

Riscos:

- checkout indevido;
- ausência de checkout em compra;
- decisão determinística bloqueando IA útil;
- fallback silencioso para default;
- divergência entre decision engine e sales layer.

## 14. Operação do Observer Layer

Observabilidade:

- logs de decisão, CTA, extração, lead, WhatsApp, banco e cache;
- auditoria JSONL em `data/audit_logs/`;
- analytics de conversas, satisfação, resolvido, lead capturado, tokens e custos;
- relatórios semanais.

Eventos:

- mensagem recebida;
- intent classificada;
- decisão tomada;
- CTA aplicado;
- lead salvo;
- agendamento criado;
- WhatsApp conectado/desconectado;
- extração concluída/falha;
- erro de IA.

Métricas:

- uptime;
- 5xx por rota;
- latência por canal;
- leads por tenant;
- taxa de CTA;
- taxa de falha LLM;
- cache hit/miss;
- mensagens WhatsApp pendentes.

## 15. Operação das feature flags

Flags críticas controlam comportamento progressivo em banco/tabela `feature_flags`, arquivo `data/feature_flags.json` e módulo `lib/feature-flags.js`.

Monitoramento:

- flag inexistente usando default inesperado;
- flag ativada para todos os tenants sem validação;
- divergência entre arquivo e banco;
- mudança de flag sem auditoria;
- regressão após ativação.

Riscos:

- liberação global de motor experimental;
- desativação de fallback;
- comportamento diferente por tenant sem rastreabilidade;
- dificuldade de reproduzir bug.

## 16. Operação das integrações

| Integração | Dependência | Sinais de falha |
|---|---|---|
| OpenAI | `OPENAI_API_KEY`, rotas/integrações de chat | 401/429/5xx, timeout, resposta vazia, custo anormal |
| Groq | `GROQ_API_KEY`, LLM principal/alternativo | latência alta, erro de provider, fallback frequente |
| OpenRouter | chave/endpoint quando configurado | modelo indisponível, erro de roteamento, tokens rejeitados |
| WhatsApp | Evolution/API, `whatsapp-routes.js` | QR expirado, webhook ausente, conexão divergente |
| Gmail | `gmail-integration.js`, credenciais OAuth/API | envio falho, refresh token expirado |
| Redis | `REDIS_URL`, `cache.js` | fallback para memória, perda de sessão/cache, keys expiradas incorretamente |
| PostgreSQL | `DATABASE_URL`, `database.js` | pool indisponível, migração falha, locks, índices ausentes |

## 17. Operação do deploy

Startup:

1. Validar variáveis de ambiente críticas.
2. Inicializar banco e migrações.
3. Inicializar cache Redis ou fallback in-memory.
4. Carregar API keys/tenants.
5. Registrar rotas Express.
6. Iniciar servidor na porta configurada.

Restart:

- preferir restart controlado;
- observar logs de migração;
- validar conexão com banco/Redis/WhatsApp/LLM;
- conferir rotas críticas antes de liberar tráfego.

Validação:

- health da API;
- chat simples;
- captura de lead teste;
- CTA com intenção de compra;
- extração de URL conhecida;
- conexão WhatsApp de tenant de teste;
- consulta de leads no admin.

Monitoramento pós-deploy:

- 30 minutos de erro 5xx;
- latência de IA;
- queda de leads;
- falhas de WhatsApp;
- logs de Decision Core;
- uso de memória.

## 18. Incident response

### WhatsApp parado

1. Confirmar se é geral ou tenant específico.
2. Verificar `connection_state`, `last_seen` e logs de `whatsapp-routes.js`.
3. Conferir webhook e estado na Evolution/API.
4. Reproduzir envio inbound/outbound em tenant de teste.
5. Se QR expirou, reconectar instância.
6. Se webhook falha, escalar integração antes de mexer em IA.

### CTA ausente

1. Capturar conversa, intent, decisão e resposta final.
2. Verificar Decision Core e Sales Layer.
3. Confirmar checkoutLink/contexto.
4. Verificar CTA Engine para duplicidade/bloqueio.
5. Consultar regressões de link curto/WhatsApp se o canal for específico.

### Lead não capturado

1. Verificar payload recebido e API key.
2. Conferir `saveLead`, banco e JSON fallback.
3. Validar campos obrigatórios e tenant.
4. Verificar CRM sync sem confundir falha de CRM com falha de captura.
5. Comparar volume antes/depois do incidente.

### Scheduler falhando

1. Validar datetime e leadId.
2. Conferir tabela/arquivo de appointments.
3. Verificar status permitido.
4. Procurar conflitos e erros SQL.
5. Reprocessar consulta por lead.

### IA sem resposta

1. Verificar provider ativo e chave.
2. Checar 401/429/5xx/timeout.
3. Conferir fallback e circuit breaker.
4. Validar contexto extraído.
5. Confirmar se Decision Core bloqueou IA por override.

### Extração falhando

1. Testar URL isolada.
2. Verificar cache de extração.
3. Conferir Puppeteer/crawler.
4. Avaliar `cleanText`, título, descrição e checkout.
5. Marcar impacto sobre CTA/IA antes de fechar incidente.

## 19. Investigação de bugs

Fluxo oficial:

```text
Sintoma
↓
Canal afetado: widget, WhatsApp, link curto, admin, API
↓
Documentos: arquitetura, mapas mestres, regressões, auditorias, este manual
↓
Arquivos: server.js, módulo específico, database.js, rotas, camada sales/lib
↓
Componentes: extração, intent, decision, CTA, lead, scheduler, integração
↓
Logs e dados: request, response, tenant, conversationId, leadId, timestamp
↓
Reprodução controlada
↓
Classificação: bug, regressão, falha externa, dado inválido, operação
```

Metodologia:

- nunca começar corrigindo;
- isolar tenant e canal;
- preservar payloads e logs;
- comparar comportamento esperado x real;
- consultar regressões conhecidas;
- identificar primeiro componente onde o sinal diverge;
- só depois abrir tarefa técnica.

## 20. Investigação de regressões

Procedimento oficial baseado nas regressões documentadas de V21, WhatsApp e link curto:

1. Definir versão/intervalo temporal afetado.
2. Comparar fluxo anterior e atual.
3. Reproduzir cenário mínimo.
4. Classificar canal: WhatsApp, link curto, widget, IA, lead.
5. Verificar se a regressão é de decisão, roteamento, persistência ou integração.
6. Checar logs antes/depois do deploy.
7. Bloquear novos deploys se afetar CRÍTICO ABSOLUTO.
8. Registrar incidente com evidências, tenant e conversas.
9. Validar recuperação em cenário real e sintético.

## 21. Rotinas diárias

Diário:

- revisar 5xx e latência;
- conferir leads capturados por tenant;
- validar WhatsApp conectado;
- revisar falhas LLM;
- checar CTAs ausentes em BUY;
- verificar extrações vazias;
- observar cache/banco.

Semanal:

- revisar auditorias JSONL;
- conferir backups de leads;
- analisar top erros por rota;
- revisar feature flags ativas;
- testar widget e WhatsApp ponta a ponta;
- validar agendamentos e CRM sync.

Mensal:

- revisar regressões abertas;
- auditar dependências externas;
- revisar custos de IA;
- testar restauração de backup;
- revisar governança de flags;
- atualizar documentação operacional.

## 22. Health checks

| Área | Verificações |
|---|---|
| APIs | status 200 em rotas críticas, erro 5xx, tempo de resposta |
| IA | chamada simples, timeout, fallback, tokens/custo |
| Banco | conexão, pool, migrações, queries de leads/conversas |
| Cache | Redis conectado, fallback, hit/miss, expiração |
| Integrações | WhatsApp, Gmail, providers LLM, webhooks |
| Scheduler | criar/listar/atualizar appointment de teste |

## 23. Alertas operacionais

| Módulo | ALTO | MÉDIO | BAIXO |
|---|---|---|---|
| Server | processo down, 5xx alto | latência elevada | logs ruidosos |
| IA | todas chamadas falham | fallback frequente | custo acima do padrão |
| Lead Capture | leads não salvam | CRM sync falha | campos incompletos |
| WhatsApp | canal parado geral | tenant desconectado | QR expirando |
| Widget | script não carrega | erro por domínio | queda de conversão |
| Link curto | redirecionamento falha | checkout ausente | clique sem tracking |
| CTA | CTA indevido em suporte | CTA ausente em compra | copy repetitiva |
| Scheduler | agendamentos não criam | status divergente | atraso em listagem |
| Extração | contexto vazio geral | cache antigo | dados parciais |
| Banco | indisponível | locks/lentidão | crescimento de tabela |
| Cache | Redis indisponível | hit rate baixo | limpeza atrasada |
| Flags | flag crítica invertida | rollout sem auditoria | flag obsoleta |

## 24. Matriz de escalonamento

Investigar quando:

- houver queda de conversão, leads, CTAs ou mensagens;
- um tenant relatar comportamento diferente do esperado;
- logs mostrarem default/fallback anormal;
- qualquer health check falhar.

Auditar quando:

- feature flag crítica for alterada;
- integração externa mudar;
- ocorrer incidente repetido;
- houver divergência entre banco, JSON e CRM;
- deploy tocar `server.js`, Decision Core, Lead Capture, WhatsApp ou banco.

Bloquear deploy quando:

- teste de captura de lead falhar;
- WhatsApp principal estiver instável;
- IA não tiver fallback;
- migração de banco falhar;
- link curto/checkout estiver inconsistente;
- regressão CRÍTICO ABSOLUTO estiver aberta.

Abrir incidente quando:

- impacto atingir produção;
- houver perda de dados/leads;
- canal WhatsApp ou widget ficar indisponível;
- CTA indevido afetar vendas;
- erro externo impedir atendimento.

## 25. Governança operacional

Revisões obrigatórias:

- Arquitetura: responsável técnico sênior ou mantenedor principal.
- Regressões: engenharia + operação + responsável do canal afetado.
- Pipelines: dono do fluxo widget/WhatsApp/link curto.
- Integrações: engenharia + responsável por credenciais/fornecedor.
- Banco e dados: engenharia + responsável por compliance/LGPD.
- Feature flags: engenharia + produto/operação.

## 26. Top 20 componentes mais sensíveis

1. `server.js`
2. `database.js`
3. `lib/leads/lead-capture.js`
4. `whatsapp-routes.js`
5. `lib/decision-core.js`
6. `lib/v16-decision-engine.js`
7. `sales/sales-layer.js`
8. `sales/cta-engine.js`
9. `lib/orchestrator.js`
10. `widget.js`
11. `short-url-generator.js`
12. `lib/link-resolver.js`
13. `lib/v17-link-resolver.js`
14. `lib/content-extractor-v112.js`
15. `lib/puppeteer-extractor.js`
16. `cache.js`
17. `lib/feature-flags.js`
18. `scheduling-manager.js`
19. `lib/conversation-state.js`
20. `lib/audit-logger.js`

## 27. Top 20 incidentes mais prováveis

1. WhatsApp desconectado por tenant.
2. CTA ausente em intenção de compra.
3. Lead capturado no front mas não salvo.
4. IA sem resposta por quota/provider.
5. Extração retorna contexto vazio.
6. Link curto resolve para destino incorreto ou vazio.
7. CORS/CSP bloqueia widget.
8. Scheduler cria agendamento inválido.
9. Banco indisponível ou migração falha.
10. Redis indisponível causando perda de cache/sessão.
11. Feature flag ativa comportamento experimental globalmente.
12. Decision Core classifica suporte como compra.
13. Checkout enviado em intenção informativa.
14. CRM sync falha silenciosamente.
15. Webhook WhatsApp não chega.
16. API key/tenant incorreto mistura dados.
17. Cache de extração antigo causa resposta errada.
18. Conversa perde estado entre mensagens.
19. Admin não lista leads por divergência tenant_uuid/api_key.
20. Deploy reinicia sem variáveis críticas.

## 28. Matriz de recuperação

| Incidente | Impacto | Investigação | Recuperação |
|---|---|---|---|
| WhatsApp parado | perda de canal | estado, webhook, instância | reconectar/revalidar webhook |
| CTA ausente | perda de conversão | intent, decision, checkout, CTA | restaurar configuração/flag ou fallback operacional |
| Lead não capturado | perda de dados comerciais | payload, tenant, banco, JSON | reprocessar dados e validar persistência |
| Scheduler falhando | perda de reuniões | datetime, leadId, DB | corrigir dado operacional e revalidar criação |
| IA sem resposta | atendimento parado | provider, chave, quota, timeout | ativar fallback/provider alternativo |
| Extração falhando | contexto ruim | URL, cache, crawler, cleanText | limpar cache/reextrair com método alternativo |
| Link curto falhando | checkout inacessível | código, mapa, resolver | regenerar link ou usar link final validado |
| Widget bloqueado | canal web parado | console, CORS, CSP, API | ajustar configuração operacional do domínio |
| Banco indisponível | plataforma instável | conexão, pool, logs | restaurar banco/failover |
| Feature flag errada | comportamento regressivo | auditoria e escopo | rollback da flag |

## 29. Operação durante férias do dev principal

Áreas que exigem atenção:

- WhatsApp e webhooks;
- captura de leads;
- Decision Core/CTA;
- extração de páginas;
- banco/cache;
- deploy e variáveis de ambiente;
- feature flags.

Componentes com monitoramento extra:

- `server.js`;
- `database.js`;
- `whatsapp-routes.js`;
- `lib/leads/lead-capture.js`;
- `sales/cta-engine.js`;
- `lib/v16-decision-engine.js`;
- `cache.js`;
- `lib/content-extractor-v112.js`.

Documentos a consultar primeiro:

1. Este manual.
2. `docs/ARCHITECTURE.md`.
3. Documentos de regressão disponíveis.
4. Master maps disponíveis.
5. Guias de deploy.
6. Logs de auditoria em `data/audit_logs/`.

Regra operacional: durante ausência do dev principal, evitar mudanças estruturais em CRÍTICO ABSOLUTO; preferir rollback, flag rollback, reconexão operacional, reprocessamento e comunicação de incidente.

## 30. Conclusão executiva

Operar o Link Mágico exige disciplina em quatro eixos: disponibilidade, decisão comercial correta, persistência de dados e rastreabilidade. A plataforma deve ser monitorada por canal e por tenant, com foco em server, IA, WhatsApp, widget, lead capture, scheduler, extração, CTA, Decision Core, banco e cache.

Para investigar falhas, a equipe deve seguir o fluxo sintoma → documentos → arquivos → componentes → logs → reprodução, evitando correções prematuras. Para reduzir riscos operacionais, deploys devem ser bloqueados quando componentes CRÍTICO ABSOLUTO apresentarem inconsistência, feature flags devem ser auditadas e regressões devem ser tratadas como incidentes quando afetarem vendas, atendimento ou dados.

A estabilidade depende de health checks regulares, alertas claros, governança de mudanças e documentação operacional atualizada. A prioridade máxima é nunca perder lead, nunca misturar tenants, nunca enviar CTA/checkout indevido e nunca deixar um canal crítico sem observabilidade.
