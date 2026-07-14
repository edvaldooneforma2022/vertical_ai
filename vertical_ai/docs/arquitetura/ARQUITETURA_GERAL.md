# Visão Geral

O LinkMágico (`vertical_ai`) é uma plataforma SaaS multi-tenant para captura, qualificação e conversão de leads por meio de links curtos, widget embarcável, chatbot com IA, WhatsApp e integrações comerciais. A arquitetura atual concentra o núcleo operacional no servidor Node.js/Express, com módulos auxiliares para autenticação, segurança, billing, analytics, integrações, WhatsApp, CRM, conhecimento e otimização de LLM.

Esta documentação técnica formaliza a última auditoria disponível no repositório, consolidando seus achados em uma visão arquitetural única. A auditoria aponta que o sistema evoluiu a partir de correções críticas no widget LinkMágico, especialmente relacionadas a inicialização sem token obrigatório, uso correto do domínio do servidor, geração de URL absoluta para o script do widget e redução de regressões no carregamento em sites de clientes.

O objetivo arquitetural principal é garantir que cada cliente consiga publicar um ponto de entrada comercial — link curto, widget ou WhatsApp — capaz de iniciar uma conversa, identificar contexto, capturar dados, acionar IA, registrar leads e encaminhar oportunidades para camadas comerciais ou integrações externas, preservando isolamento por tenant e controles mínimos de segurança.

A arquitetura apresenta alta densidade funcional no repositório raiz, com múltiplos arquivos históricos, backups e versões alternativas. Isso facilita auditoria retrospectiva, mas aumenta risco operacional, pois torna menos explícito qual implementação está ativa em produção. O arquivo `server.js` permanece como principal ponto de composição de rotas, middlewares e fluxos críticos.

# Componentes Principais

## Servidor HTTP e API

O servidor Express é o componente central. Ele expõe rotas públicas, administrativas, rotas de chatbot, endpoints de leads, rotas de WhatsApp, webhooks, integrações e recursos auxiliares. Também agrega middlewares de CORS, sessão, autenticação, validação, rate limiting, CSRF e segurança, conforme módulos disponíveis no repositório.

Responsabilidades principais:

- Servir painel, páginas HTML e ativos públicos.
- Processar mensagens do chatbot e chamadas universais de conversa.
- Capturar, consultar, atualizar e exportar leads.
- Registrar eventos de auditoria e métricas.
- Orquestrar integrações com IA, WhatsApp, CRM, Gmail, webhooks e billing.
- Controlar autenticação de clientes e administradores.

## Widget LinkMágico

O widget é a camada embarcável nos sites dos clientes. A auditoria destacou que sua estabilidade depende de três decisões arquiteturais:

- Não depender exclusivamente de token na URL para inicializar.
- Detectar automaticamente o domínio do servidor a partir do `currentScript.src`.
- Usar URL absoluta no snippet gerado para o cliente.

Essas decisões removem dependência do domínio do site cliente e reduzem falhas por 404, CORS incorreto ou chamadas ao host errado.

## Sistema de Leads

A camada de leads é responsável por persistir contatos, dados capturados, origem, contexto de navegação, mensagens e status comercial. O sistema é orientado por tenant, normalmente derivado de API key, e pode armazenar dados em JSON local ou base persistente conforme configuração.

Responsabilidades:

- Captura de lead a partir do widget, chatbot, link curto ou WhatsApp.
- Associação do lead ao tenant correto.
- Registro de histórico, mensagens e atributos comerciais.
- Exposição de endpoints administrativos para consulta e backup.
- Integração com analytics, CRM e camada comercial.

## Camada de IA

A camada de IA usa provedores LLM, otimizadores e módulos conversacionais para interpretar mensagens, manter contexto, qualificar intenção, responder perguntas e conduzir o usuário para conversão. O repositório possui módulos dedicados em `modules/ai`, além de componentes como `llm-optimizer.js`, `chatgpt-integration.js`, `chatgpt-routes.js` e base de conhecimento.

## WhatsApp

A integração WhatsApp atua como canal conversacional adicional, com rotas próprias, módulo de canal e integração. O fluxo deve preservar a mesma lógica de tenant, lead, contexto, IA, auditoria e segurança aplicada ao widget.

## Camada Comercial

A camada comercial é composta por motores e scripts localizados em `sales/`, incluindo decisão, CTA, prevenção de abandono, seleção de presets, fechamento, contexto e otimização de conversão. Ela atua sobre conversas e leads para direcionar respostas, ofertas, chamadas para ação e próximos passos.

## Billing e Assinaturas

A camada de billing inclui enforcement, auditoria, métricas e rotas de Stripe. Ela deve controlar limites de uso, status de assinatura, elegibilidade de funcionalidades, checkout e métricas financeiras.

## Segurança, Compliance e Auditoria

O sistema possui arquivos específicos para autenticação, CORS, CSRF, rate limit, antifraude, compliance, consentimento LGPD, criptografia e auditoria. A auditoria anterior indicou atenção especial a segredos versionados, abertura de CORS, proteção de rotas administrativas e sanitização de entradas.

# Fluxo do Link Curto

O fluxo do link curto representa um ponto de entrada simplificado para conversão. Embora a implementação possa variar conforme rota e versão ativa, arquiteturalmente o fluxo esperado é:

1. O usuário acessa uma URL curta gerada pelo LinkMágico.
2. O servidor resolve o identificador curto e identifica o tenant proprietário.
3. O sistema recupera configuração comercial, contexto, produto, página ou campanha associada.
4. O usuário é redirecionado para a experiência configurada, que pode ser página de chatbot, widget, checkout, WhatsApp ou página de vendas.
5. A visita é registrada em analytics e auditoria.
6. Caso haja interação, o lead é criado ou atualizado no escopo do tenant.
7. A camada de IA e a camada comercial recebem o contexto de origem para personalizar a abordagem.

Pontos críticos do fluxo:

- A resolução do link curto não pode perder o vínculo com o tenant.
- Redirecionamentos devem validar URLs de destino para evitar open redirect.
- Métricas devem registrar origem, campanha, identificador curto, data/hora e tenant.
- O fluxo deve continuar funcional mesmo quando o visitante chega sem token explícito, desde que exista configuração suficiente no link ou campanha.

# Fluxo do Widget

O widget é o fluxo mais sensível identificado na auditoria, pois opera em domínios de terceiros e depende de carregamento remoto.

Fluxo técnico esperado:

1. O cliente instala no site um snippet com URL absoluta para o script do widget.
2. O navegador do visitante carrega `widget.js` a partir do domínio LinkMágico.
3. O widget detecta o domínio base do servidor usando a URL do próprio script.
4. O widget lê configuração global opcional, parâmetros da URL ou atributos do script.
5. O widget inicializa o balão flutuante e prepara listeners de abertura, fechamento e envio de mensagem.
6. Ao iniciar conversa, o widget envia requisições para o domínio LinkMágico, não para o domínio do cliente.
7. O servidor valida tenant, origem, token ou configuração disponível.
8. A mensagem é processada por IA ou fluxo comercial.
9. Dados do visitante e mensagens relevantes são registrados como lead.
10. Eventos de analytics, auditoria e métricas são persistidos.

Decisões arquiteturais consolidadas pela auditoria:

- O token deve ser opcional quando houver configuração alternativa válida.
- A API base não deve ser `window.location.origin`, pois isso aponta para o site cliente.
- O snippet gerado no painel deve usar URL absoluta.
- O CORS precisa permitir o uso embarcado em domínios externos, mas com controles compensatórios como API key, rate limit, validação de payload e auditoria.

Pontos de atenção:

- Alterações em `widget.js` têm alto risco de regressão.
- Alterações no gerador de snippet podem quebrar instalações novas.
- Alterações em CORS podem impedir carregamento em sites clientes.
- Alterações em rotas de chat podem quebrar o widget sem afetar o painel administrativo.

# Fluxo do WhatsApp

O WhatsApp funciona como canal conversacional externo e deve convergir para o mesmo modelo de lead e IA usado pelo widget.

Fluxo técnico esperado:

1. O usuário envia mensagem para número ou canal WhatsApp configurado.
2. O provedor ou webhook entrega o evento ao servidor.
3. A camada de WhatsApp normaliza payload, remetente, mensagem, mídia e metadados.
4. O sistema identifica tenant por número, configuração, token, webhook ou chave associada.
5. O lead é criado ou atualizado com canal `whatsapp`.
6. A camada de IA interpreta mensagem, contexto histórico e intenção.
7. A camada comercial aplica regras de CTA, qualificação, fechamento ou prevenção de abandono.
8. A resposta é enviada ao provedor WhatsApp.
9. Eventos são registrados em auditoria, analytics e histórico do lead.

Controles necessários:

- Validar assinatura do webhook quando o provedor oferecer esse recurso.
- Impedir que mensagens de um tenant sejam roteadas para outro.
- Persistir identificadores externos de conversa e remetente.
- Tratar idempotência de webhooks para evitar duplicidade de mensagens ou leads.
- Aplicar rate limit e bloqueio antifraude para abuso ou spam.

# Sistema Multi-Tenant

A arquitetura multi-tenant é baseada principalmente em API keys, configurações por cliente e separação lógica dos dados. O isolamento por tenant é requisito central, pois o mesmo servidor atende múltiplos clientes.

Responsabilidades do multi-tenant:

- Identificar tenant em cada requisição pública ou administrativa.
- Separar leads, backups, configurações, métricas e integrações.
- Impedir acesso cruzado entre clientes.
- Aplicar limites comerciais conforme plano e status de assinatura.
- Registrar tenant em eventos de auditoria.

Fontes possíveis de identificação do tenant:

- API key.
- Token de widget.
- Configuração global do widget.
- Link curto ou campanha.
- Número/canal WhatsApp.
- Sessão autenticada no painel.
- Configuração de webhook ou integração.

Riscos multi-tenant:

- Fallbacks permissivos podem associar dados ao tenant errado.
- Arquivos JSON nomeados por chave precisam evitar exposição, colisão ou path traversal.
- Rotas administrativas devem exigir autenticação e escopo do tenant.
- Backups e exports devem preservar isolamento.

# Camada de IA

A camada de IA combina provedores externos, base de conhecimento, otimização de prompts e regras comerciais. Ela deve ser tratada como componente orquestrado, não como fonte única de decisão.

Funções principais:

- Responder mensagens de visitantes e leads.
- Interpretar intenção, estágio de compra e objeções.
- Usar contexto de página, produto, campanha e histórico.
- Acionar scripts de venda, CTAs e fluxos de qualificação.
- Apoiar sumarização, classificação e enriquecimento de leads.

Dependências típicas:

- Chaves de API de provedores LLM.
- Base de conhecimento local ou persistente.
- Histórico de conversa e dados do lead.
- Configurações comerciais do tenant.
- Módulos de otimização e segurança de prompt.

Riscos:

- Vazamento de dados entre tenants via contexto indevidamente compartilhado.
- Prompt injection por conteúdo de páginas, mensagens ou webhooks.
- Falhas por indisponibilidade ou limite dos provedores LLM.
- Custos imprevisíveis sem limites por tenant.
- Respostas desalinhadas com regras comerciais ou compliance.

Controles recomendados:

- Sanitização e delimitação explícita de contexto externo.
- Rate limit por tenant, canal e usuário.
- Logs de decisão sem exposição de dados sensíveis desnecessários.
- Fallbacks quando IA estiver indisponível.
- Testes de regressão para prompts e endpoints de chat.

# Camada Comercial

A camada comercial traduz conversa em conversão. Ela inclui motores de decisão, CTAs, scripts de fechamento, prevenção de abandono, presets, instruções automáticas e otimização de conversão.

Responsabilidades:

- Selecionar abordagem comercial conforme tenant, produto e estágio do lead.
- Identificar objeções e responder com argumentos adequados.
- Aplicar CTAs contextuais.
- Direcionar para checkout, WhatsApp, agendamento, formulário ou atendimento humano.
- Reduzir abandono com mensagens e ofertas oportunas.
- Registrar evolução do lead no funil.

Integrações relevantes:

- CRM para sincronização de contatos e oportunidades.
- Stripe ou outro provedor para checkout e billing.
- Gmail/e-mail para follow-up.
- WhatsApp para continuidade de atendimento.
- Analytics para mensurar conversão.

Pontos críticos:

- A decisão comercial deve respeitar regras do tenant e plano contratado.
- CTAs não podem gerar links inválidos ou inseguros.
- Scripts comerciais devem ser versionados e testáveis.
- Alterações em `sales/` podem impactar conversão mesmo sem quebrar testes técnicos.

# Camada de Segurança

A segurança está distribuída em módulos e middlewares. A auditoria anterior sinalizou riscos relevantes que devem ser tratados como prioridade arquitetural.

Controles existentes ou esperados:

- Autenticação por API key e sessão.
- Administração protegida por credenciais ou chaves administrativas.
- Rate limiting.
- CSRF para rotas sensíveis quando aplicável.
- CORS configurado para suportar widget externo.
- Antifraude.
- Compliance e consentimento LGPD.
- Auditoria de eventos.
- Validação e sanitização de entrada.

Riscos de segurança destacados:

- Presença de arquivos de API keys no repositório.
- CORS excessivamente permissivo sem controles compensatórios suficientes.
- Rotas administrativas expostas sem autenticação robusta.
- Webhooks sem validação de assinatura.
- Possibilidade de XSS por dados de lead, mensagens ou conteúdo extraído.
- Possibilidade de open redirect em fluxos de link curto.
- Segredos em backups, arquivos históricos ou exemplos.

Diretrizes:

- Segredos devem ficar em variáveis de ambiente ou cofre externo.
- Arquivos de exemplo devem conter apenas placeholders.
- Dados sensíveis em logs devem ser mascarados.
- Entradas externas devem ser validadas por schema.
- Toda rota administrativa deve ter autenticação e autorização explícitas.
- Toda operação multi-tenant deve registrar e validar `tenantId`.

# Dependências Críticas

Dependências e recursos críticos para operação:

- Node.js e NPM para execução do servidor e scripts.
- Express para rotas HTTP.
- Middlewares de CORS, sessão, parsing e segurança.
- Provedores LLM como Groq e OpenAI, conforme variáveis disponíveis.
- Stripe para checkout e billing quando habilitado.
- WhatsApp/provedor externo para canal conversacional.
- Armazenamento local JSON e/ou banco persistente configurado.
- Redis quando usado para sessão, cache ou rate limit.
- Gmail/CRM/webhooks para integrações comerciais.
- Crawl4AI ou extratores para captura de conteúdo de páginas.
- Sistema de arquivos para leads, backups, auditoria e configurações quando em modo local.

Variáveis e configurações críticas:

- Chaves de provedores LLM.
- Chaves de API dos tenants.
- Segredo de sessão.
- URL de banco de dados.
- URL de Redis.
- Chaves e segredos de Stripe.
- Tokens e assinaturas de webhooks.
- Configurações de CORS e domínio público do servidor.

# Arquivos Críticos

Arquivos e diretórios que concentram risco arquitetural:

- `server.js`: composição principal do servidor, rotas, middlewares e fluxos críticos.
- `widget.js`: script embarcado em sites clientes; qualquer regressão impacta carregamento externo.
- `short-url-generator.js`: geração ou suporte a links curtos.
- `routes.js`: rotas auxiliares ou agregadas.
- `auth.js`, `auth-system.js`, `auth-login.js`, `admin_keys.js`: autenticação e acesso administrativo.
- `cors-config.js`: política de CORS para painel, API e widget externo.
- `csrf-protection.js`: proteção CSRF.
- `rate-limiter.js`: controle de abuso e limites.
- `security-system.js`, `anti-fraud.js`, `compliance-middleware.js`: segurança, antifraude e compliance.
- `lib/audit-logger.js`: registro de auditoria.
- `data/audit_logs/`: trilha de auditoria gerada.
- `billing.js`, `billing-enforcement.js`, `billing-metrics.js`, `billing-audit.js`, `stripe-routes.js`: billing, planos e checkout.
- `whatsapp-integration.js`, `whatsapp-channel.js`, `whatsapp-routes.js`: canal WhatsApp.
- `crm-integrations.js`, `gmail-integration.js`, `webhooks.js`: integrações externas.
- `knowledge-base.js`, `llm-optimizer.js`, `chatgpt-integration.js`, `chatgpt-routes.js`, `modules/ai/`: camada de IA.
- `sales/`: lógica comercial e motores de conversão.
- `analytics.js`: métricas e eventos.
- `database.js`: acesso ou abstração de persistência.
- `api-keys.json`: arquivo sensível; deve ser substituído por configuração segura quando contiver dados reais.
- `env.example`: referência oficial de configuração esperada.
- `docs/ARCHITECTURE.md`: documentação arquitetural anterior e pontos críticos já catalogados.

# Riscos Arquiteturais

## Concentração excessiva em `server.js`

Grande parte da lógica de negócio, composição de rotas e geração dinâmica está centralizada. Isso aumenta risco de regressão, dificulta testes isolados e reduz clareza sobre fronteiras entre módulos.

Mitigação recomendada:

- Modularizar rotas por domínio funcional.
- Extrair serviços puros para leads, widget, IA, WhatsApp e billing.
- Adicionar testes unitários e de integração por módulo.

## Múltiplas versões e backups no repositório

Arquivos como versões alternativas de servidor e backups históricos podem confundir manutenção e deploy.

Mitigação recomendada:

- Definir explicitamente quais arquivos são ativos.
- Mover histórico para documentação, tags ou diretório de arquivo morto.
- Remover artefatos duplicados do caminho operacional.

## Segredos versionados ou próximos do código

A existência de `api-keys.json` no repositório é risco crítico caso contenha chaves reais.

Mitigação recomendada:

- Remover segredos do versionamento.
- Rotacionar chaves expostas.
- Usar variáveis de ambiente ou secret manager.
- Manter apenas exemplos sem valor real.

## CORS e widget externo

O widget exige funcionamento em múltiplos domínios, mas abertura ampla de CORS pode ampliar superfície de ataque.

Mitigação recomendada:

- Combinar CORS permissivo para ativos públicos com autenticação, rate limit e validação estrita nos endpoints mutáveis.
- Registrar origem e tenant em eventos de auditoria.
- Revisar endpoints que aceitam credenciais ou dados sensíveis.

## Isolamento multi-tenant

Qualquer falha na identificação do tenant pode causar vazamento de leads, configurações, históricos ou métricas.

Mitigação recomendada:

- Centralizar resolução de tenant.
- Exigir tenant explícito em serviços internos.
- Testar acesso cruzado entre tenants.
- Garantir que backups, exports e integrações respeitem escopo.

## Dependência de provedores externos

IA, WhatsApp, Stripe, Gmail, CRM e Crawl4AI introduzem risco de indisponibilidade, limite, mudança de API e custo.

Mitigação recomendada:

- Implementar timeouts, retries controlados e circuit breakers.
- Definir fallback operacional.
- Monitorar erro por provedor e por tenant.

# Pontos de Regressão

Pontos que devem ser protegidos por testes e checklist antes de qualquer alteração:

## Widget

- Carregamento de `widget.js` via URL absoluta.
- Detecção correta do domínio do servidor por `currentScript.src`.
- Inicialização sem token quando configuração global estiver presente.
- Inicialização com token quando fornecido.
- Criação e exibição do balão flutuante.
- Envio de mensagem para o domínio LinkMágico correto.
- Compatibilidade com sites em subdiretórios, CSP, HTTPS e domínios externos.

## Link curto

- Geração de identificador único.
- Resolução do link para o tenant correto.
- Redirecionamento seguro.
- Registro de analytics e origem.
- Preservação de parâmetros de campanha.

## Chatbot e IA

- Endpoints de chat retornando respostas válidas.
- Fallback quando provedor LLM falhar.
- Preservação de contexto por tenant e lead.
- Sanitização de conteúdo extraído de páginas ou enviado por usuários.
- Ausência de vazamento de contexto entre tenants.

## WhatsApp

- Recebimento e normalização de webhooks.
- Identificação correta do tenant por canal.
- Idempotência de mensagens.
- Resposta pelo provedor correto.
- Registro do lead com canal WhatsApp.

## Multi-tenant

- API key válida cria escopo correto.
- API key inválida é rejeitada.
- Leads de um tenant não aparecem para outro.
- Backups e exports são segregados.
- Billing e limites são aplicados por tenant.

## Segurança

- Rotas administrativas exigem autenticação.
- Rate limit ativo em endpoints públicos sensíveis.
- CSRF ativo onde houver sessão e mutação de estado.
- CORS não quebra widget e não libera endpoints sensíveis sem controle.
- Entradas de leads, mensagens e webhooks são validadas.
- Segredos não aparecem em logs, exemplos ou respostas de API.

## Billing e camada comercial

- Checkout gera sessão válida.
- Enforcement bloqueia ou libera funcionalidades conforme plano.
- Métricas de uso são registradas corretamente.
- CTAs apontam para URLs válidas e seguras.
- Motores comerciais não quebram conversa quando faltam dados opcionais.

## Persistência e auditoria

- Leads são salvos no armazenamento correto.
- Auditoria registra eventos críticos com severidade e tenant quando aplicável.
- Backups podem ser criados, listados e restaurados.
- Migrações não perdem dados existentes.
- Falhas de escrita são tratadas sem derrubar o servidor.
