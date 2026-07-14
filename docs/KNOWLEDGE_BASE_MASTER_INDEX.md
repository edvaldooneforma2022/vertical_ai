# KNOWLEDGE_BASE_MASTER_INDEX.md — Índice Mestre da Base de Conhecimento Link Mágico

> Documento gerado a partir da estrutura real do repositório, dos documentos existentes e dos módulos de código analisados. Quando um documento solicitado nas Missões 05–30 não existe no repositório atual, ele aparece como **não encontrado** para preservar rastreabilidade sem inventar conteúdo.

## 1. Visão geral

Esta Base de Conhecimento é o índice mestre navegável da documentação do SaaS **Link Mágico**, uma plataforma multi-tenant de IA conversacional, captura de leads, widget, chatbot, CRM, analytics, integrações, checkout, WhatsApp, scheduler e deploy.

**Objetivo:** responder rapidamente onde cada assunto do Link Mágico está documentado, distinguindo documentos existentes, documentos ausentes e código-fonte que materializa os subsistemas.

**Escopo:**

- Documentos dentro de `docs/`.
- Documentos Markdown e TXT na raiz do repositório.
- Documentos públicos em `public/` quando fazem parte de governança, termos ou privacidade.
- Código analisado em `server.js`, `lib/`, `analytics/`, `modules/`, `public/` e arquivos de configuração.

**Como utilizar:**

1. Use a Seção 17 para encontrar rapidamente qualquer tema.
2. Use a Seção 9 quando a dúvida estiver formulada como pergunta.
3. Use a Seção 10 quando a dúvida estiver associada a responsabilidade funcional.
4. Use a Seção 12 para seguir uma trilha de leitura por perfil.
5. Use a Seção 14 para saber se o assunto está documentado, parcialmente documentado ou não documentado.

## 2. Mapa geral da documentação

Estrutura documental real encontrada:

```text
.
├── ANALISE_PROBLEMAS.md
├── CHECKLIST.md
├── COMO_FAZER_DEPLOY.md
├── CORRECAO_ANALYTICS.md
├── CORRECAO_CAMPOS_LEADS.md
├── CORRECAO_ERRO_SINTAXE.md
├── CORRECAO_PERSISTENCIA_LEADS.md
├── CORRECAO_RENDER.md
├── CORRECOES_APLICADAS.md
├── CORRECOES_DEFINITIVAS_RENDER.md
├── CORRECOES_FINAIS_RENDER.md
├── DEPLOY RENDER.md
├── DIAGNOSTICO_REAL.md
├── DOCUMENTACAO_BACKUP_LEADS.md
├── DOCUMENTACAO_MULTI_TENANT.md
├── GARANTIA_QUALIDADE.md
├── GUIA_CONFIGURACAO.md
├── GUIA_INICIANTE_COMPLETO.md
├── GUIA_VENDAS_CONFIGURACAO_CLIENTES.md
├── GUIA_VISUAL_ALTERACOES.md
├── Guia de Configuração do Crawl4AI para Vertical AI.md
├── INDICE_ARQUIVOS.md
├── INSTRUCOES_INSTALACAO.md
├── LEIA_PRIMEIRO.md
├── LEIA_PRIMEIRO_V3.md
├── LISTA_DOCUMENTACAO.txt
├── MANUAL_ATUALIZACOES_RECENTES.md
├── MELHORIAS_IMPLEMENTADAS.md
├── NOVAS_INTEGRACOES_V3.md
├── O QUE TEM NO SERVER.md
├── PAINEL_MELHORADO_README.md
├── PASSO_A_PASSO_CONFIGURACAO.md
├── README-MELHORIAS.md
├── README.md
├── README_AGENDAMENTO.md
├── README_LEADS_INTEGRATION.md
├── RECORD_TRABALHO.md
├── RELATÓRIO TÉCNICO.md
├── RELEASE_NOTES.md
├── RESUMO_CORRECOES.md
├── RESUMO_CORRECOES_IMPLEMENTADAS.md
├── RESUMO_EXECUTIVO.md
├── RESUMO_FINAL_CORRECOES.md
├── Relatório Funcionalidades ATUAIS.md
├── SUMARIO.txt
├── VALIDACAO_CORRECOES.md
├── VALIDACAO_INTEGRACOES.md
├── VALIDACAO_MULTI_TENANT.md
├── data/
│   └── README.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── KNOWLEDGE_BASE_MASTER_INDEX.md
│   ├── PATCH_V9.1_V9.2_CHECKOUT.md
│   └── openapi.yaml
├── documentacao_seguranca_linkmagico.md
├── public/
│   ├── politica-de-privacidade.md
│   └── termos-de-uso.md
└── readme-authentication.md
```

Pastas solicitadas como `docs/arquitetura/`, `docs/auditorias/`, `docs/regressões/`, `docs/whatsapp/`, `docs/link-curto/` e `docs/widget/` **não existem** na árvore atual.

## 3. Índice por categoria

### 3.1 Documentação central

| Nome | Caminho | Objetivo | Escopo | Dependências |
|---|---|---|---|---|
| README | `README.md` | Apresentar plataforma, tecnologias e visão geral | SaaS Link Mágico v7.x, IA, scraping, automação, scheduler, CRM, integrações | `server.js`, módulos de IA, Redis, Crawl4AI, Playwright, OpenAI, Groq, OpenRouter |
| Arquitetura | `docs/ARCHITECTURE.md` | Descrever arquitetura crítica | Endpoints, fluxo de dados, tenancy, CORS, variáveis | `server.js`, `public/widget.js`, `data/`, testes |
| OpenAPI | `docs/openapi.yaml` | Especificar API em formato OpenAPI | Contratos HTTP documentados | Servidor Express e rotas de API |
| Patch V9.1/V9.2 Checkout | `docs/PATCH_V9.1_V9.2_CHECKOUT.md` | Registrar patch de checkout automático e seletor inteligente | Checkout, descoberta, decisão e fallback | `lib/checkout-*`, `lib/v17-*`, `lib/v19-*` |
| Índice de Arquivos | `INDICE_ARQUIVOS.md` | Mapear arquivos de versão melhorada | Arquivos do projeto e seus papéis | Estrutura geral do repositório |
| Sumário | `SUMARIO.txt` | Sumariar documentação existente | Lista textual | Documentação raiz |
| Lista de Documentação | `LISTA_DOCUMENTACAO.txt` | Listar documentação | Documentos do projeto | Documentação raiz |

### 3.2 Configuração, instalação e operação

| Nome | Caminho | Objetivo | Escopo | Dependências |
|---|---|---|---|---|
| Guia de Configuração | `GUIA_CONFIGURACAO.md` | Orientar configuração completa | Setup operacional | Variáveis de ambiente, APIs externas |
| Passo a Passo Configuração | `PASSO_A_PASSO_CONFIGURACAO.md` | Guiar configuração por etapas | Operação inicial | Painel, API keys, páginas cliente |
| Instruções de Instalação | `INSTRUCOES_INSTALACAO.md` | Instalar widget corrigido | Widget | HTML/JS de widget |
| Guia Iniciante Completo | `GUIA_INICIANTE_COMPLETO.md` | Explicar uso para iniciantes | Operação funcional | Painel, chat, leads |
| Guia Vendas/Clientes | `GUIA_VENDAS_CONFIGURACAO_CLIENTES.md` | Configurar clientes para venda | Comercial e onboarding | Multi-tenant, API keys, páginas de cliente |
| Crawl4AI | `Guia de Configuração do Crawl4AI para Vertical AI.md` | Configurar Crawl4AI | Extração web | Python, Crawl4AI, Playwright |
| Painel Melhorado | `PAINEL_MELHORADO_README.md` | Documentar painel v2 | Painel administrativo | `public/index_app.html`, scripts do painel |

### 3.3 Deploy, segurança e produção

| Nome | Caminho | Objetivo | Escopo | Dependências |
|---|---|---|---|---|
| Como Fazer Deploy | `COMO_FAZER_DEPLOY.md` | Orientar deploy | Deploy do painel | Render, variáveis |
| Deploy Render | `DEPLOY RENDER.md` | Registrar deploy no Render | Produção Render | `server.js`, Render |
| Correção Render | `CORRECAO_RENDER.md` | Corrigir deploy Render | Ajustes de server/deploy | `server.js` |
| Correções Definitivas Render | `CORRECOES_DEFINITIVAS_RENDER.md` | Consolidar correções Render | Produção | Render, build/start |
| Correções Finais Render | `CORRECOES_FINAIS_RENDER.md` | Fechar correções Render | Produção | Render |
| Segurança LinkMágico | `documentacao_seguranca_linkmagico.md` | Documentar segurança e configuração | Segurança v7.0 no Render | CORS, auth, variáveis, Render |
| Autenticação/Licenciamento | `readme-authentication.md` | Documentar licenciamento v6.0 | Auth, API keys e licença | `auth*.js`, `admin_keys.js` |
| Termos de Uso | `public/termos-de-uso.md` | Termos legais | Usuários finais | Site público |
| Política de Privacidade | `public/politica-de-privacidade.md` | Política legal | Privacidade/LGPD | Site público, consentimento |

### 3.4 Leads, backup, agendamento, integrações e multi-tenant

| Nome | Caminho | Objetivo | Escopo | Dependências |
|---|---|---|---|---|
| Multi-Tenant | `DOCUMENTACAO_MULTI_TENANT.md` | Documentar sistema multi-tenant | Isolamento por cliente | API keys, dados por tenant |
| Validação Multi-Tenant | `VALIDACAO_MULTI_TENANT.md` | Validar multi-tenant | Testes/validação | API keys, dados isolados |
| Backup Leads | `DOCUMENTACAO_BACKUP_LEADS.md` | Documentar backup automático | Leads e restauração | `lib/leads/lead-backup.js`, endpoints admin |
| Integração Leads | `README_LEADS_INTEGRATION.md` | Documentar integração completa de leads | Captura, CRM, integração | `lib/leads/lead-capture.js`, CRM |
| Validação Integrações | `VALIDACAO_INTEGRACOES.md` | Validar integrações de leads | Integrações externas | CRM, email, webhooks |
| Agendamento | `README_AGENDAMENTO.md` | Documentar scheduler/agendamentos | Appointments | Endpoints `/api/appointments` |
| Novas Integrações V3 | `NOVAS_INTEGRACOES_V3.md` | Registrar novas integrações | Gmail, APIs, CRM | Módulos de integração |
| Data README | `data/README.md` | Documentar dados locais | Persistência local | `data/` |

### 3.5 Correções, validação, regressão histórica e qualidade

| Nome | Caminho | Objetivo | Escopo | Dependências |
|---|---|---|---|---|
| Análise de Problemas | `ANALISE_PROBLEMAS.md` | Analisar problemas do chatbot | Diagnóstico funcional | Widget/chatbot |
| Diagnóstico Real | `DIAGNOSTICO_REAL.md` | Diagnosticar problema real do widget | Código original do widget | Widget |
| Correções Aplicadas | `CORRECOES_APLICADAS.md` | Registrar correções no widget | Widget | HTML/JS |
| Correção Analytics | `CORRECAO_ANALYTICS.md` | Corrigir analytics profissional | Analytics | `analytics/` |
| Correção Campos Leads | `CORRECAO_CAMPOS_LEADS.md` | Corrigir mapeamento de campos | Leads | Lead capture/CRM |
| Correção Erro Sintaxe | `CORRECAO_ERRO_SINTAXE.md` | Corrigir sintaxe em server | Servidor | `server.js` |
| Correção Persistência Leads | `CORRECAO_PERSISTENCIA_LEADS.md` | Corrigir persistência | Leads | Dados e storage |
| Resumo Correções | `RESUMO_CORRECOES.md` | Resumir correções | Correções gerais | Correções aplicadas |
| Resumo Correções Implementadas | `RESUMO_CORRECOES_IMPLEMENTADAS.md` | Consolidar correções implementadas | Histórico | Correções |
| Resumo Final Correções | `RESUMO_FINAL_CORRECOES.md` | Fechar pacote de correções | Histórico | Correções |
| Validação Correções | `VALIDACAO_CORRECOES.md` | Validar correções | QA | Testes manuais/automatizados |
| Garantia Qualidade | `GARANTIA_QUALIDADE.md` | Documentar qualidade | QA | Testes e checklist |
| Checklist | `CHECKLIST.md` | Checklist de implementação | Execução/QA | Features implantadas |
| Release Notes | `RELEASE_NOTES.md` | Registrar versões | Histórico de release | Correções e features |

### 3.6 Relatórios e materiais executivos

| Nome | Caminho | Objetivo | Escopo | Dependências |
|---|---|---|---|---|
| Resumo Executivo | `RESUMO_EXECUTIVO.md` | Resumir melhorias | Executivo | Melhorias gerais |
| Relatório Técnico | `RELATÓRIO TÉCNICO.md` | Relatar tecnicamente o sistema | Técnico | Implementação |
| Relatório Funcionalidades Atuais | `Relatório Funcionalidades ATUAIS.md` | Mapear funcionalidades atuais | Varredura funcional | Código e documentação |
| Record Trabalho | `RECORD_TRABALHO.md` | Registrar trabalho realizado | Histórico | Alterações anteriores |
| Manual Atualizações Recentes | `MANUAL_ATUALIZACOES_RECENTES.md` | Registrar atualizações recentes | Operação e histórico | Alterações recentes |
| Melhorias Implementadas | `MELHORIAS_IMPLEMENTADAS.md` | Listar melhorias | Produto | Features e correções |
| Leia Primeiro | `LEIA_PRIMEIRO.md` | Orientar primeiro acesso | Onboarding | Produto geral |
| Leia Primeiro V3 | `LEIA_PRIMEIRO_V3.md` | Orientar V3 | Onboarding V3 | Features V3 |

## 4. Documentos de arquitetura

Documentos solicitados e situação real:

| Documento solicitado | Situação | Resumo executivo |
|---|---|---|
| `ARQUITETURA_GERAL.md` | Não encontrado | O equivalente existente é `docs/ARCHITECTURE.md`, que descreve arquitetura v7.0, endpoints críticos, fluxo de dados, tenancy, CORS, variáveis e checklist de modificação. |
| `FLUXO_LINK_CURTO.md` | Não encontrado | Não há documento dedicado a fluxo de link curto; há código relacionado a resolução de links em `lib/link-resolver.js`, `lib/links-map.js`, checkout e criação de link em `public/criar-link.html`. |
| `FLUXO_WIDGET.md` | Não encontrado | O tema está distribuído em `INSTRUCOES_INSTALACAO.md`, `DIAGNOSTICO_REAL.md`, `CORRECOES_APLICADAS.md`, `Código do Widget Inline (Para o Cliente).txt` e arquivos `public/*widget*`. |
| `FLUXO_WHATSAPP.md` | Não encontrado | Não há documento dedicado; WhatsApp aparece no código de decisão, analytics, links-map, captura de inteligências e auditoria/paridade WA. |
| `MAPA_CONVERSACIONAL_GLOBAL.md` | Não encontrado | O mapa conversacional está parcialmente refletido em `README.md`, `lib/decision-core.js`, `lib/conversation-state.js`, `lib/v13-*`, `lib/v14-*`, `lib/v16-*`, `lib/v19-*`. |
| `MATRIZ_DE_PROPRIEDADE.md` | Não encontrado | Não há matriz formal; responsabilidade pode ser inferida pela Seção 10 deste índice. |
| `FEATURE_FLAGS_MASTER_MAP.md` | Não encontrado | O código de referência é `lib/feature-flags.js` e `data/feature_flags.json`. |
| `DATA_FLOW_MASTER_MAP.md` | Não encontrado | `docs/ARCHITECTURE.md` contém fluxo principal; persistência/analytics/leads estão em documentos específicos. |
| `INTEGRATION_MASTER_MAP.md` | Não encontrado | Integrações são tratadas por `NOVAS_INTEGRACOES_V3.md`, `README_LEADS_INTEGRATION.md`, `VALIDACAO_INTEGRACOES.md` e módulos CRM/Gmail/Hotmart. |
| `DEPLOY_MASTER_MAP.md` | Não encontrado | Deploy está distribuído em `COMO_FAZER_DEPLOY.md`, `DEPLOY RENDER.md`, `CORRECAO_RENDER.md`, `CORRECOES_*_RENDER.md` e segurança Render. |

Documento de arquitetura existente principal:

- `docs/ARCHITECTURE.md`: referência arquitetural crítica; explica que LinkMágico é SaaS de chatbot com IA para vendas e captura de leads; lista servidor principal, painel, widget, dados, endpoints, fluxo, multi-tenancy, CORS e variáveis.

## 5. Documentos de auditoria

Documentos solicitados das Missões 05–09:

| Documento | Situação | Observação |
|---|---|---|
| `MISSAO_05_ARQUITETURA.md` | Não encontrado | Nenhum arquivo com esse nome foi localizado. |
| `MISSAO_06_EXTRACAO.md` | Não encontrado | Extração aparece em README, Crawl4AI guide e módulos `crawl4ai*`, `lib/extraction/`. |
| `MISSAO_07_PARIDADE.md` | Não encontrado | Paridade aparece no código `lib/wa-parity-audit.js`; não há documento dedicado. |
| `MISSAO_08_V21_POSTMORTEM.md` | Não encontrado | Não há documento V21 postmortem na árvore atual. |
| `MISSAO_09_DEPENDENCIAS_OCULTAS.md` | Não encontrado | Dependências são inferíveis por `package.json`, README e módulos, mas não há auditoria com esse nome. |

Auditorias/relatórios encontrados:

- `ANALISE_PROBLEMAS.md`: análise de problemas do chatbot.
- `DIAGNOSTICO_REAL.md`: diagnóstico do problema do widget.
- `RELATÓRIO TÉCNICO.md`: relatório técnico.
- `Relatório Funcionalidades ATUAIS.md`: varredura profunda de funcionalidades.
- `VALIDACAO_CORRECOES.md`: validação das correções.
- `VALIDACAO_INTEGRACOES.md`: validação de integrações de leads.
- `VALIDACAO_MULTI_TENANT.md`: validação multi-tenant.
- `GARANTIA_QUALIDADE.md`: garantia de qualidade.

## 6. Documentos de regressão

| Documento solicitado | Situação | Quando consultar |
|---|---|---|
| `REGRESSAO_V21.md` | Não encontrado | Como não existe, consultar `RELEASE_NOTES.md`, `RESUMO_FINAL_CORRECOES.md`, `VALIDACAO_CORRECOES.md` e relatórios técnicos para histórico. |
| `REGRESSAO_WHATSAPP.md` | Não encontrado | Consultar código `lib/wa-parity-audit.js`, `lib/wa-cta-promoter.js`, `lib/v16-decision-engine.js`, `analytics/*` e documentos de validação. |
| `REGRESSAO_LINK_CURTO.md` | Não encontrado | Consultar `docs/PATCH_V9.1_V9.2_CHECKOUT.md`, `lib/link-resolver.js`, `lib/links-map.js`, `lib/checkout-*`. |

Regressão histórica real está distribuída entre documentos de correção, validação, release notes e garantia de qualidade.

## 7. Documentos de canais

### Link Curto

| Documento | Situação | Conteúdo real relacionado |
|---|---|---|
| `LINK_CURTO_PIPELINE.md` | Não encontrado | Código relacionado: `lib/link-resolver.js`, `lib/links-map.js`, checkout discovery/fallback e `public/criar-link.html`. |
| `LINK_CURTO_VENDAS.md` | Não encontrado | Venda/checkout aparece em `docs/PATCH_V9.1_V9.2_CHECKOUT.md`, `GUIA_VENDAS_CONFIGURACAO_CLIENTES.md` e motores V16/V19. |

### WhatsApp

| Documento | Situação | Conteúdo real relacionado |
|---|---|---|
| `WHATSAPP_PIPELINE.md` | Não encontrado | Código relacionado: `lib/wa-cta-promoter.js`, `lib/wa-parity-audit.js`, `lib/links-map.js`, `analytics/*`. |
| `WHATSAPP_V21.md` | Não encontrado | Não há documento V21; consultar motores determinísticos/decisão e auditoria WA no código. |

### Widget

| Documento | Situação | Conteúdo real relacionado |
|---|---|---|
| `WIDGET_PIPELINE.md` | Não encontrado | Documentos reais: `INSTRUCOES_INSTALACAO.md`, `DIAGNOSTICO_REAL.md`, `CORRECOES_APLICADAS.md`, demos em `public/`. |
| `WIDGET_CAPTURA.md` | Não encontrado | Captura está em `README_LEADS_INTEGRATION.md`, `DOCUMENTACAO_BACKUP_LEADS.md`, `CORRECAO_CAMPOS_LEADS.md`, `CORRECAO_PERSISTENCIA_LEADS.md`. |

## 8. Master Maps

| Master Map solicitado | Situação | Papel real/inferido a partir do código |
|---|---|---|
| `CTA_ENGINE_MASTER_MAP.md` | Não encontrado | CTA é executado por analytics optimizer, WA promoter, decision engines e checkout responders. |
| `LEAD_CAPTURE_MASTER_MAP.md` | Não encontrado | Captura é documentada por `README_LEADS_INTEGRATION.md`, backup e correções de leads; código em `lib/leads/`. |
| `SCHEDULER_MASTER_MAP.md` | Não encontrado | Scheduler/agendamento é documentado por `README_AGENDAMENTO.md` e endpoints de appointments. |
| `JOURNEY_STAGE_MASTER_MAP.md` | Não encontrado | Jornada aparece em `modules/leads/journey-analyzer.js`, `analytics/*`, V14/V19. |
| `INTENT_DETECTION_MASTER_MAP.md` | Não encontrado | Intenção aparece em `lib/decision-core.js`, `lib/v13-intent-classifier.js`, `lib/v16-decision-engine.js`, `modules/ai/*`. |
| `OBSERVER_LAYER_MASTER_MAP.md` | Não encontrado | Observação/logging aparece em analytics tracker, conversation logger, audit logger e performance engine. |
| `DECISION_CORE_MASTER_MAP.md` | Não encontrado | Decisão aparece em `lib/decision-core.js`, V16, V17 orchestrator e V19 deterministic engine. |
| `CONVERSATION_STATE_MASTER_MAP.md` | Não encontrado | Estado aparece em `lib/conversation-state.js`, `lib/v13-state-manager.js`, V14 context/outcome/pattern. |

## 9. Matriz de consulta

| Pergunta | Documento recomendado |
|---|---|
| O que é o Link Mágico? | `README.md` |
| Como a arquitetura funciona? | `docs/ARCHITECTURE.md` |
| Quais endpoints existem? | `docs/ARCHITECTURE.md` e `docs/openapi.yaml` |
| Como funciona multi-tenant? | `DOCUMENTACAO_MULTI_TENANT.md` |
| Como validar multi-tenant? | `VALIDACAO_MULTI_TENANT.md` |
| Como configurar o produto? | `GUIA_CONFIGURACAO.md` |
| Como configurar passo a passo? | `PASSO_A_PASSO_CONFIGURACAO.md` |
| Como vender/configurar para clientes? | `GUIA_VENDAS_CONFIGURACAO_CLIENTES.md` |
| Como instalar o widget? | `INSTRUCOES_INSTALACAO.md` |
| Como diagnosticar problemas do widget? | `DIAGNOSTICO_REAL.md` |
| Quais correções foram aplicadas ao widget? | `CORRECOES_APLICADAS.md` |
| Como funciona captura de leads? | `README_LEADS_INTEGRATION.md` |
| Como funciona backup de leads? | `DOCUMENTACAO_BACKUP_LEADS.md` |
| Como corrigir persistência de leads? | `CORRECAO_PERSISTENCIA_LEADS.md` |
| Como corrigir campos de leads? | `CORRECAO_CAMPOS_LEADS.md` |
| Como funciona o Scheduler? | `README_AGENDAMENTO.md` |
| Como funciona Analytics? | `CORRECAO_ANALYTICS.md` e `analytics/` |
| Como funciona o CTA? | Não há master map; consultar `docs/PATCH_V9.1_V9.2_CHECKOUT.md`, `analytics/learning-optimizer.js`, `lib/wa-cta-promoter.js`. |
| Como funciona WhatsApp? | Não há `WHATSAPP_PIPELINE.md`; consultar `lib/wa-cta-promoter.js`, `lib/wa-parity-audit.js`, `lib/links-map.js`. |
| Como funciona checkout/link de venda? | `docs/PATCH_V9.1_V9.2_CHECKOUT.md` |
| Como fazer deploy no Render? | `COMO_FAZER_DEPLOY.md`, `DEPLOY RENDER.md` |
| Quais foram as correções Render? | `CORRECAO_RENDER.md`, `CORRECOES_DEFINITIVAS_RENDER.md`, `CORRECOES_FINAIS_RENDER.md` |
| Como configurar segurança? | `documentacao_seguranca_linkmagico.md` |
| Como funciona autenticação/licenciamento? | `readme-authentication.md` |
| Quais validações existem? | `VALIDACAO_CORRECOES.md`, `VALIDACAO_INTEGRACOES.md`, `VALIDACAO_MULTI_TENANT.md` |
| Quais funcionalidades atuais existem? | `Relatório Funcionalidades ATUAIS.md` |
| Qual histórico de versões? | `RELEASE_NOTES.md` |
| Onde estão termos e privacidade? | `public/termos-de-uso.md`, `public/politica-de-privacidade.md` |

## 10. Matriz de responsabilidade

| Tema | Documento principal | Documento secundário |
|---|---|---|
| Arquitetura geral | `docs/ARCHITECTURE.md` | `README.md` |
| API | `docs/openapi.yaml` | `docs/ARCHITECTURE.md` |
| Multi-tenant | `DOCUMENTACAO_MULTI_TENANT.md` | `VALIDACAO_MULTI_TENANT.md` |
| Widget | `INSTRUCOES_INSTALACAO.md` | `DIAGNOSTICO_REAL.md` |
| Captura de leads | `README_LEADS_INTEGRATION.md` | `CORRECAO_CAMPOS_LEADS.md` |
| Backup de leads | `DOCUMENTACAO_BACKUP_LEADS.md` | `CORRECAO_PERSISTENCIA_LEADS.md` |
| Scheduler | `README_AGENDAMENTO.md` | `README.md` |
| Checkout/CTA de venda | `docs/PATCH_V9.1_V9.2_CHECKOUT.md` | `GUIA_VENDAS_CONFIGURACAO_CLIENTES.md` |
| WhatsApp | Código `lib/wa-cta-promoter.js` | Código `lib/wa-parity-audit.js` |
| Analytics | `CORRECAO_ANALYTICS.md` | `analytics/` |
| Deploy | `COMO_FAZER_DEPLOY.md` | `DEPLOY RENDER.md` |
| Segurança | `documentacao_seguranca_linkmagico.md` | `readme-authentication.md` |
| Qualidade | `GARANTIA_QUALIDADE.md` | `CHECKLIST.md` |
| Regressões históricas | `VALIDACAO_CORRECOES.md` | `RELEASE_NOTES.md` |
| Operação iniciante | `GUIA_INICIANTE_COMPLETO.md` | `LEIA_PRIMEIRO.md` |

## 11. Mapa de dependências

```text
README.md
├── docs/ARCHITECTURE.md
├── GUIA_CONFIGURACAO.md
├── README_AGENDAMENTO.md
├── README_LEADS_INTEGRATION.md
└── NOVAS_INTEGRACOES_V3.md

docs/ARCHITECTURE.md
├── docs/openapi.yaml
├── DOCUMENTACAO_MULTI_TENANT.md
├── DOCUMENTACAO_BACKUP_LEADS.md
├── documentacao_seguranca_linkmagico.md
└── server.js

README_LEADS_INTEGRATION.md
├── DOCUMENTACAO_BACKUP_LEADS.md
├── CORRECAO_CAMPOS_LEADS.md
├── CORRECAO_PERSISTENCIA_LEADS.md
├── VALIDACAO_INTEGRACOES.md
└── lib/leads/

DOCUMENTACAO_MULTI_TENANT.md
├── VALIDACAO_MULTI_TENANT.md
├── readme-authentication.md
└── data/README.md

docs/PATCH_V9.1_V9.2_CHECKOUT.md
├── lib/checkout-discovery.js
├── lib/checkout-click-discovery.js
├── lib/checkout-fallback-engine.js
├── lib/link-resolver.js
├── lib/links-map.js
└── lib/v19-deterministic-engine.js

CORRECOES_* / CORRECAO_*
├── VALIDACAO_CORRECOES.md
├── GARANTIA_QUALIDADE.md
└── RELEASE_NOTES.md

COMO_FAZER_DEPLOY.md / DEPLOY RENDER.md
├── CORRECAO_RENDER.md
├── CORRECOES_DEFINITIVAS_RENDER.md
├── CORRECOES_FINAIS_RENDER.md
└── documentacao_seguranca_linkmagico.md
```

## 12. Ordem de leitura

### Trilha executiva

1. `README.md`
2. `RESUMO_EXECUTIVO.md`
3. `Relatório Funcionalidades ATUAIS.md`
4. `RELEASE_NOTES.md`
5. `docs/KNOWLEDGE_BASE_MASTER_INDEX.md`

### Trilha arquiteto

1. `docs/ARCHITECTURE.md`
2. `README.md`
3. `DOCUMENTACAO_MULTI_TENANT.md`
4. `README_LEADS_INTEGRATION.md`
5. `README_AGENDAMENTO.md`
6. `docs/PATCH_V9.1_V9.2_CHECKOUT.md`
7. `documentacao_seguranca_linkmagico.md`

### Trilha desenvolvedor

1. `README.md`
2. `docs/ARCHITECTURE.md`
3. `GUIA_CONFIGURACAO.md`
4. `README_LEADS_INTEGRATION.md`
5. `DOCUMENTACAO_BACKUP_LEADS.md`
6. `README_AGENDAMENTO.md`
7. `docs/openapi.yaml`
8. `docs/PATCH_V9.1_V9.2_CHECKOUT.md`

### Trilha QA

1. `CHECKLIST.md`
2. `GARANTIA_QUALIDADE.md`
3. `VALIDACAO_CORRECOES.md`
4. `VALIDACAO_INTEGRACOES.md`
5. `VALIDACAO_MULTI_TENANT.md`
6. `RELEASE_NOTES.md`

### Trilha auditoria

1. `docs/ARCHITECTURE.md`
2. `documentacao_seguranca_linkmagico.md`
3. `DOCUMENTACAO_MULTI_TENANT.md`
4. `readme-authentication.md`
5. `RELATÓRIO TÉCNICO.md`
6. `Relatório Funcionalidades ATUAIS.md`
7. `VALIDACAO_*`

### Trilha IA/Codex

1. `docs/KNOWLEDGE_BASE_MASTER_INDEX.md`
2. `docs/ARCHITECTURE.md`
3. `README.md`
4. `INDICE_ARQUIVOS.md`
5. `O QUE TEM NO SERVER.md`
6. `docs/PATCH_V9.1_V9.2_CHECKOUT.md`
7. Código em `lib/decision-core.js`, `lib/conversation-state.js`, `lib/v13-*`, `lib/v14-*`, `lib/v16-*`, `lib/v19-*`, `analytics/`.

## 13. Documentos críticos

### Crítico absoluto

- `docs/ARCHITECTURE.md`: referência de arquitetura crítica, endpoints, tenancy, CORS e variáveis.
- `README.md`: visão geral oficial da plataforma.
- `docs/openapi.yaml`: contrato de API.
- `DOCUMENTACAO_MULTI_TENANT.md`: isolamento de clientes.
- `documentacao_seguranca_linkmagico.md`: segurança e produção.

### Crítico

- `README_LEADS_INTEGRATION.md`: captura e integração de leads.
- `DOCUMENTACAO_BACKUP_LEADS.md`: backup e restauração.
- `README_AGENDAMENTO.md`: scheduler.
- `docs/PATCH_V9.1_V9.2_CHECKOUT.md`: checkout/CTA/link de venda.
- `readme-authentication.md`: licenciamento e autenticação.

### Importante

- `GUIA_CONFIGURACAO.md`
- `PASSO_A_PASSO_CONFIGURACAO.md`
- `GUIA_VENDAS_CONFIGURACAO_CLIENTES.md`
- `VALIDACAO_CORRECOES.md`
- `VALIDACAO_INTEGRACOES.md`
- `VALIDACAO_MULTI_TENANT.md`
- `GARANTIA_QUALIDADE.md`
- `RELEASE_NOTES.md`

### Suporte

- Documentos de correção `CORRECAO_*` e `CORRECOES_*`.
- Relatórios históricos.
- Guias visuais e materiais de onboarding.
- Termos, privacidade e documentos públicos.

## 14. Gaps de documentação

### Temas já documentados

- Visão geral da plataforma.
- Arquitetura crítica.
- Multi-tenancy.
- API/OpenAPI.
- Leads, backup e validação.
- Scheduler/agendamento.
- Deploy Render.
- Segurança e autenticação.
- Correções históricas.
- Validações e garantia de qualidade.

### Temas parcialmente documentados

- Widget: há instalação, diagnóstico e correções, mas não um `WIDGET_PIPELINE.md` consolidado.
- WhatsApp: há código e menções, mas não `WHATSAPP_PIPELINE.md`.
- Link curto/checkout: checkout está documentado no patch V9.1/V9.2; link curto não possui documento dedicado.
- CTA: aparece em checkout, analytics e WhatsApp, mas não há master map próprio.
- Estados conversacionais e jornada: aparecem no código e README, sem mapa dedicado.
- Feature flags: há código/dados, sem mapa documental dedicado.

### Temas ainda não documentados como arquivos dedicados

- Missões `MISSAO_05` a `MISSAO_09` com nomes solicitados.
- Regressões `REGRESSAO_V21`, `REGRESSAO_WHATSAPP`, `REGRESSAO_LINK_CURTO`.
- Master maps de CTA, lead capture, scheduler, journey stage, intent detection, observer layer, decision core e conversation state.
- Pastas documentais por domínio dentro de `docs/`.

## 15. Mapa global do Link Mágico

```text
Arquitetura
└── docs/ARCHITECTURE.md, README.md
    ↓
Fluxos
└── Chatbot, widget, API, leads, scheduler e checkout descritos em arquitetura, README e docs específicos
    ↓
Estados
└── lib/conversation-state.js, lib/v13-state-manager.js, V14 context/outcome/pattern
    ↓
Decisões
└── lib/decision-core.js, lib/v16-decision-engine.js, lib/v19-deterministic-engine.js
    ↓
Captura
└── README_LEADS_INTEGRATION.md, DOCUMENTACAO_BACKUP_LEADS.md, lib/leads/
    ↓
CTA
└── docs/PATCH_V9.1_V9.2_CHECKOUT.md, analytics optimizer, WA CTA promoter
    ↓
Scheduler
└── README_AGENDAMENTO.md, endpoints de appointments
    ↓
Analytics
└── CORRECAO_ANALYTICS.md, analytics/conversation-tracker.js, db-adapter, performance-engine
    ↓
Deploy
└── COMO_FAZER_DEPLOY.md, DEPLOY RENDER.md, CORRECOES_*_RENDER.md, documentacao_seguranca_linkmagico.md
```

## 16. Governança da Base de Conhecimento

### Após mudanças arquiteturais, atualizar

- `docs/ARCHITECTURE.md`
- `README.md`
- `docs/openapi.yaml` quando endpoints mudarem
- `DOCUMENTACAO_MULTI_TENANT.md` quando isolamento/API keys/dados mudarem
- `documentacao_seguranca_linkmagico.md` quando segurança, CORS, auth ou deploy mudarem
- Este índice mestre

### Após regressões, atualizar

- `VALIDACAO_CORRECOES.md`
- `GARANTIA_QUALIDADE.md`
- `RELEASE_NOTES.md`
- Documento `CORRECAO_*` ou `CORRECOES_*` correspondente
- Este índice mestre se novo documento for criado

### Após novos pipelines

- `README.md` para visão geral
- `docs/ARCHITECTURE.md` para impacto arquitetural
- `docs/openapi.yaml` se houver API nova
- Documento de domínio correspondente, quando existir
- Validações correspondentes
- Este índice mestre

## 17. Índice mestre final

| Tema | Onde encontrar |
|---|---|
| Plataforma | `README.md` |
| Arquitetura | `docs/ARCHITECTURE.md` |
| API | `docs/openapi.yaml` |
| Servidor principal | `docs/ARCHITECTURE.md`, `O QUE TEM NO SERVER.md`, `server.js` |
| Painel | `PAINEL_MELHORADO_README.md`, `public/index_app.html` |
| Widget | `INSTRUCOES_INSTALACAO.md`, `DIAGNOSTICO_REAL.md`, `CORRECOES_APLICADAS.md` |
| Chatbot | `README.md`, `docs/ARCHITECTURE.md`, `public/chat.html` |
| IA conversacional | `README.md`, `modules/ai/`, `lib/ai-systems/` |
| Decisão | `lib/decision-core.js`, `lib/v16-decision-engine.js`, `lib/v19-deterministic-engine.js` |
| Estado de conversa | `lib/conversation-state.js`, `lib/v13-state-manager.js` |
| Intenção | `lib/v13-intent-classifier.js`, `lib/decision-core.js`, `modules/ai/` |
| Jornada | `modules/leads/journey-analyzer.js`, `analytics/` |
| Leads | `README_LEADS_INTEGRATION.md`, `lib/leads/` |
| Backup leads | `DOCUMENTACAO_BACKUP_LEADS.md`, `lib/leads/lead-backup.js` |
| Persistência leads | `CORRECAO_PERSISTENCIA_LEADS.md`, `data/README.md` |
| Campos leads | `CORRECAO_CAMPOS_LEADS.md` |
| CRM | `README_LEADS_INTEGRATION.md`, `lib/crm/` |
| Scheduler | `README_AGENDAMENTO.md` |
| Analytics | `CORRECAO_ANALYTICS.md`, `analytics/` |
| WhatsApp | `lib/wa-cta-promoter.js`, `lib/wa-parity-audit.js`, `lib/links-map.js` |
| Checkout | `docs/PATCH_V9.1_V9.2_CHECKOUT.md`, `lib/checkout-*` |
| Links | `lib/link-resolver.js`, `lib/links-map.js` |
| Extração | `Guia de Configuração do Crawl4AI para Vertical AI.md`, `lib/extraction/`, `crawl4ai*` |
| Multi-tenant | `DOCUMENTACAO_MULTI_TENANT.md`, `VALIDACAO_MULTI_TENANT.md` |
| Autenticação | `readme-authentication.md`, `auth*.js` |
| Segurança | `documentacao_seguranca_linkmagico.md` |
| Deploy | `COMO_FAZER_DEPLOY.md`, `DEPLOY RENDER.md`, `CORRECAO_RENDER.md` |
| Render | `CORRECOES_DEFINITIVAS_RENDER.md`, `CORRECOES_FINAIS_RENDER.md` |
| Configuração | `GUIA_CONFIGURACAO.md`, `PASSO_A_PASSO_CONFIGURACAO.md` |
| Onboarding | `LEIA_PRIMEIRO.md`, `LEIA_PRIMEIRO_V3.md`, `GUIA_INICIANTE_COMPLETO.md` |
| Vendas | `GUIA_VENDAS_CONFIGURACAO_CLIENTES.md` |
| Integrações | `NOVAS_INTEGRACOES_V3.md`, `VALIDACAO_INTEGRACOES.md` |
| Qualidade | `GARANTIA_QUALIDADE.md`, `CHECKLIST.md` |
| Correções | `RESUMO_CORRECOES.md`, `RESUMO_FINAL_CORRECOES.md`, `CORRECAO_*` |
| Releases | `RELEASE_NOTES.md` |
| Relatórios | `RELATÓRIO TÉCNICO.md`, `Relatório Funcionalidades ATUAIS.md` |
| Legal | `public/termos-de-uso.md`, `public/politica-de-privacidade.md` |
| Dados | `data/README.md` |

## 18. Conclusão executiva

**O que está documentado:** a base atual documenta visão geral, arquitetura crítica, API, configuração, deploy, segurança, multi-tenancy, leads, backup, scheduler, integrações, correções, validações, qualidade, relatórios e materiais legais.

**O que ainda não está documentado como arquivo dedicado:** os documentos nominalmente solicitados para Missões 05–09, regressões V21/WhatsApp/link curto, pipelines de WhatsApp/widget/link curto e master maps de CTA, captura, scheduler, jornada, intenção, observer layer, decision core e estado conversacional não existem na árvore atual.

**Documentos mais importantes:** `README.md`, `docs/ARCHITECTURE.md`, `docs/openapi.yaml`, `DOCUMENTACAO_MULTI_TENANT.md`, `README_LEADS_INTEGRATION.md`, `DOCUMENTACAO_BACKUP_LEADS.md`, `README_AGENDAMENTO.md`, `docs/PATCH_V9.1_V9.2_CHECKOUT.md`, `documentacao_seguranca_linkmagico.md` e este índice.

**Leitura inicial recomendada:** começar por `README.md`, seguir para `docs/ARCHITECTURE.md`, consultar a matriz de perguntas deste índice e então acessar o documento de domínio correspondente.

**Como usar a base:** localizar o tema na Seção 17, confirmar responsabilidade na Seção 10, verificar dependências na Seção 11 e, quando o documento dedicado não existir, consultar os documentos secundários e arquivos de código apontados neste índice.
