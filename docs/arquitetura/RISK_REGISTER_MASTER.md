# RISK_REGISTER_MASTER — Registro Mestre de Riscos Arquiteturais do Link Mágico

## SEÇÃO 1 — VISÃO GERAL

Este Registro Mestre de Riscos consolida riscos arquiteturais, técnicos, operacionais e comerciais observáveis na base Link Mágico. O objetivo é inventariar pontos de falha e fragilidade, sem propor correções, patches ou mudanças de implementação.

**Escopo analisado:** código-fonte Node.js/JavaScript, documentação existente, fluxos de chatbot/widget, extração de conteúdo, link curto, WhatsApp, captura de leads, agendamento, integrações, deploy, feature flags, estado conversacional, motor de decisão e mapas técnicos existentes ou equivalentes no código. Os arquivos solicitados como `MISSAO_06_EXTRACAO.md`, `MISSAO_07_PARIDADE.md`, `WHATSAPP_PIPELINE.md`, `LINK_CURTO_PIPELINE.md` e demais `*_MASTER_MAP.md` não estavam presentes no repositório; portanto, os riscos dessas áreas foram derivados de documentação disponível e dos módulos de produção correspondentes.

**Critérios de classificação:**

| Severidade | Critério |
|---|---|
| CRÍTICO | Pode interromper vendas, capturas, chat, autenticação, multi-tenant, deploy ou integridade de dados. |
| ALTO | Pode causar perda relevante de conversão, inconsistência entre canais, vazamento lógico entre fluxos ou operação instável. |
| MÉDIO | Pode degradar experiência, observabilidade, manutenção ou confiabilidade sem parada total imediata. |
| BAIXO | Risco localizado, com impacto limitado ou facilmente detectável operacionalmente. |

## SEÇÃO 2 — INVENTÁRIO GLOBAL DE RISCOS

| ID | Título | Categoria | Severidade | Probabilidade | Impacto |
|---|---|---|---|---|---|
| R-001 | `server.js` concentra servidor, rotas, HTML dinâmico, chat, extração, leads, agendamento, integrações e short links | Arquitetura | CRÍTICO | ALTA | Parada ampla e regressões cruzadas |
| R-002 | Múltiplos motores de decisão/intent coexistem em versões V10, V13, V16, V17 e V19 | Decisão | ALTO | ALTA | Respostas divergentes, CTA incorreto, checkout indevido |
| R-003 | Estado conversacional principal em memória com expiração por timer | Estado | ALTO | MÉDIA | Perda de contexto em restart, escala horizontal ou queda |
| R-004 | Extração depende de Puppeteer, crawlers, fallback e parsing de HTML | Extração | ALTO | ALTA | Conteúdo incompleto, link/WhatsApp não detectado |
| R-005 | Fluxo de WhatsApp depende de múltiplas fontes e heurísticas | WhatsApp | ALTO | MÉDIA | Captura comercial perdida e suporte não acionado |
| R-006 | Link curto e redirecionamento centralizados em `server.js` | Link curto | ALTO | MÉDIA | Falha de campanha e métricas inconsistentes |
| R-007 | Widget externo depende de configuração em página cliente, token opcional e API base autodetectada | Widget | ALTO | MÉDIA | Não carregamento, captura falha ou chamadas ao servidor errado |
| R-008 | CTA engine adiciona CTAs após camadas de venda/decisão | CTA | MÉDIO | MÉDIA | CTA perdido, duplicado ou incompatível com intenção |
| R-009 | Captura de leads aparece em múltiplos sistemas/arquivos | Lead capture | ALTO | MÉDIA | Duplicidade, bypass ou inconsistência multi-tenant |
| R-010 | Scheduler/agendamento compartilha rotas públicas e autenticadas | Scheduler | ALTO | MÉDIA | Booking incorreto, conflito de disponibilidade |
| R-011 | Journey stage deriva de intent e histórico curto | Jornada | MÉDIO | ALTA | Classificação imprecisa e prompts inadequados |
| R-012 | Regex determinístico para intenção é sensível a linguagem e variações | Intent detection | ALTO | ALTA | Falso positivo/negativo com impacto direto em vendas |
| R-013 | Feature flags numerosas, com defaults ativos e arquivo JSON | Feature flags | MÉDIO | ALTA | Flags órfãs, combinações não testadas e comportamento invisível |
| R-014 | Fluxos de dados incluem side effects em analytics, billing, lead, memória, auditoria e LLM | Data flow | ALTO | MÉDIA | Dependências ocultas e regressões difíceis de isolar |
| R-015 | Integrações externas críticas sem garantia uniforme de fallback | Integração | ALTO | MÉDIA | Chat, email, WhatsApp, billing ou crawl indisponíveis |
| R-016 | Deploy depende de variáveis obrigatórias, Redis/PostgreSQL opcionais e browser automation | Deploy | ALTO | MÉDIA | Falhas de startup ou degradação silenciosa |
| R-017 | CORS permissivo é requisito funcional do widget | Segurança/Arquitetura | ALTO | MÉDIA | Superfície ampla de abuso e difícil restrição futura |
| R-018 | Geração dinâmica de HTML do chatbot dentro do backend | Frontend/Backend | CRÍTICO | MÉDIA | SyntaxError, XSS lógico ou quebra de chat por string mal escapada |
| R-019 | Persistência híbrida JSON/SQLite/PostgreSQL/cache aumenta complexidade operacional | Dados | ALTO | MÉDIA | Divergência, backup incompleto e migração difícil |
| R-020 | Documentação master map solicitada não existe no repositório | Governança | ALTO | ALTA | Conhecimento concentrado e auditoria incompleta |

## SEÇÃO 3 — RISCOS DE ARQUITETURA

- **Acoplamento excessivo:** `server.js` importa dezenas de módulos de vendas, IA, extração, billing, analytics, CRM, WhatsApp, Gmail, Puppeteer, cache, banco, segurança e rotas. Isso faz com que mudanças de inicialização ou ordem de carga tenham efeito sistêmico.
- **Dependências circulares lógicas:** ainda que não comprovadas como ciclos `require()` formais, há ciclos de responsabilidade entre decisão → CTA → link resolver → resposta → validação → estado → analytics → aprendizado.
- **Módulos críticos:** `server.js`, `lib/decision-core.js`, `lib/conversation-state.js`, `lib/content-extractor-v112.js`, `lib/link-resolver.js`, `sales/cta-engine.js`, `public/widget.js`, `scheduling-manager.js`, `structured-leads.js`, `short-url-generator.js`.
- **Concentração de lógica:** rotas HTTP, HTML dinâmico, extração, chat e integrações convivem no mesmo arquivo de servidor.

## SEÇÃO 4 — RISCOS DO SERVER.JS

`server.js` possui aproximadamente 12.930 linhas e cerca de 647 KB, com 142 chamadas `require()` detectadas e 79 rotas Express definidas. Ele atua como ponto central para health checks, autenticação, chatbot, captura de leads, admin, agendamento, extração, Gmail, WhatsApp, ChatGPT, whitelabel, CRM, link curto e checkout.

**Responsabilidades concentradas:** bootstrap da aplicação, configuração de middleware, CORS, sessões, rotas públicas, rotas admin, chat universal, processamento inteligente, extração, HTML do chatbot, integrações e redirecionamento de short link.

**Dependências críticas:** banco/cache, LLM, Puppeteer, billing, analytics, módulos V13–V19, lead capture, scheduler, WhatsApp, Gmail, CRM, whitelabel, CTA/sales layer.

**Criticidade:** CRÍTICO. O arquivo é um single point of failure técnico e de governança.

## SEÇÃO 5 — RISCOS DE PARIDADE

Como `MISSAO_07_PARIDADE.md` não existe no repositório, a paridade foi avaliada pelos canais disponíveis: widget, `/chatbot`, `/chat.html`, API universal, WhatsApp, link curto e painel.

- Divergência entre widget raiz `widget.js` e `public/widget.js`.
- Diferenças entre `/api/chat-universal` e `/api/process-chat-inteligente`.
- Regras de CTA/checkout podem variar conforme canal e feature flag.
- Risco comercial: o mesmo lead pode receber resposta, CTA ou caminho de compra diferente dependendo do canal.

## SEÇÃO 6 — RISCOS DE EXTRAÇÃO

Como `MISSAO_06_EXTRACAO.md` não existe, a análise usa módulos de extração presentes.

- **Truncamento:** limites de prompt, histórico e conteúdo podem remover elementos comerciais essenciais.
- **Perda de conteúdo:** páginas SPA, lazy loading, bloqueios anti-bot e cookies podem impedir extração completa.
- **Contexto incompleto:** checkout, WhatsApp, prova social e garantia podem não aparecer no HTML inicial.
- **Chunking:** divisão inadequada pode separar preço, CTA e link de compra.
- **Impacto:** perda de resposta correta, CTA errado, WhatsApp ausente, checkout incorreto e redução de conversão.

## SEÇÃO 7 — RISCOS DO WHATSAPP

Arquivos documentais solicitados não existem; evidências vêm de `whatsapp-integration.js`, `whatsapp-channel.js`, `whatsapp-routes.js`, `lib/channel-resolver-safe.js` e `lib/wa-cta-promoter.js`.

- **Operacionais:** falha de credenciais/API, número ausente, formatação inválida, status não confiável.
- **Comerciais:** intenção humana não direcionada ao WhatsApp, CTA de WhatsApp omitido, rota de suporte perdida.
- **Captura:** lead pode sair para WhatsApp antes de captura estruturada; fontes de número têm prioridade e podem divergir.

## SEÇÃO 8 — RISCOS DO LINK CURTO

Documentação solicitada não existe; riscos derivam de `short-url-generator.js` e rotas `/l/:shortCode` e `/api/create-short-url`.

- Redirecionamento é parte crítica de campanhas e vendas.
- Erro em short code pode quebrar tráfego pago.
- Métricas de clique/conversão podem divergir se tracking falhar.
- Ausência de fallback robusto causa perda direta de receita.

## SEÇÃO 9 — RISCOS DO WIDGET

Documentação solicitada não existe; riscos derivam de `widget.js`, `public/widget.js`, `public/widget-v2.js` e páginas HTML.

- Configuração cliente pode omitir API key/token.
- Autodetecção de domínio por script source pode falhar em CDN, proxy ou cache.
- Token opcional cria operação permissiva e caminho alternativo de autenticação.
- Conflito de z-index/CSS pode ocultar widget.
- Rate limit local do widget não substitui proteção server-side.

## SEÇÃO 10 — RISCOS DO CTA ENGINE

- CTA perdido quando feature flag, mapeamento de intenção ou pós-processamento falha.
- CTA duplicado quando resposta da IA já contém CTA e engine adiciona outro.
- CTA incorreto quando intenção/action é mapeada para categoria inadequada.
- Impacto direto: perda de conversão ou pressão comercial indevida.

## SEÇÃO 11 — RISCOS DO LEAD CAPTURE

- Captura não executada se widget/API falha antes de enviar dados.
- Captura duplicada se múltiplos canais registram o mesmo contato.
- Bypass de captura quando usuário vai direto para WhatsApp/checkout.
- Persistência multi-formato aumenta risco de divergência entre tenant, backup e admin.

## SEÇÃO 12 — RISCOS DO SCHEDULER

- Bypass por rotas públicas de disponibilidade/agendamento.
- Conflito se disponibilidade muda entre consulta e booking.
- Agendamento incorreto por timezone, validação de hash ou integração externa.
- Impacto operacional: leads frustrados e perda de confiança.

## SEÇÃO 13 — RISCOS DO JOURNEY STAGE

- Classificação de estágio deriva de intent e histórico curto.
- Divergência entre estágio do conversation-state e decisões V13/V16/V19.
- Efeitos colaterais no prompt: resposta educativa para lead pronto ou venda agressiva para suporte.

## SEÇÃO 14 — RISCOS DE INTENT DETECTION

- Falsos positivos: termos como compra, suporte, WhatsApp ou preço podem aparecer em contexto negativo.
- Falsos negativos: gírias, erros de digitação e mensagens ambíguas podem cair em neutral.
- Impacto comercial: checkout bloqueado quando deveria aparecer ou enviado quando deveria ser contido.

## SEÇÃO 15 — RISCOS DO DECISION CORE

- Decisões incorretas por regex estático e ordem de prioridade.
- Conflitos entre decision-core, sales decision-engine, V16 e V19.
- Priorização inadequada entre checkout, suporte, objeção, pós-venda e informação.

## SEÇÃO 16 — RISCOS DE CONVERSATION STATE

- Perda de contexto em restart, escala horizontal ou expiração de 30 minutos.
- Inconsistência quando múltiplas instâncias processam mesma conversa.
- Corrupção lógica se conversationId colide, é ausente ou muda entre canais.

## SEÇÃO 17 — RISCOS DE FEATURE FLAGS

- Flags órfãs por crescimento histórico de versões.
- Flags conflitantes por combinação de engines V8–V19.
- Flags sem documentação master map presente no repositório.
- Defaults ativos podem habilitar comportamento não auditado em produção.

## SEÇÃO 18 — RISCOS DE DATA FLOW

- Fluxos invisíveis entre chat, lead, analytics, billing, memory, audit log e learning optimizer.
- Side effects de pós-processamento mudam resposta final após LLM.
- Dependências ocultas por módulos opcionais carregados com fallback silencioso.

## SEÇÃO 19 — RISCOS DE INTEGRAÇÃO

- Dependências externas: Groq/OpenAI, Gmail, WhatsApp, Redis, PostgreSQL, Puppeteer/browser, APIs de billing/checkout, crawlers.
- APIs críticas: chat, extração, WhatsApp, Gmail, short link, agendamento.
- Serviços sem fallback uniforme podem degradar silenciosamente ou interromper fluxo.

## SEÇÃO 20 — RISCOS DE DEPLOY

- Falhas de startup por variáveis ausentes, módulos opcionais não instalados ou browser automation indisponível.
- Configuração incorreta de Redis/PostgreSQL/session secret/API keys impacta produção.
- Dependências obrigatórias de ambiente podem não estar refletidas em documentação única.

## SEÇÃO 21 — SINGLE POINTS OF FAILURE

| SPOF | Severidade | Evidência |
|---|---|---|
| `server.js` | CRÍTICO | Centraliza rotas, chat, extração, integrações e HTML |
| API LLM principal | CRÍTICO | Chat comercial depende de geração/decisão por IA |
| Extração de página | ALTO | Alimenta conhecimento, checkout, WhatsApp e conteúdo comercial |
| Widget público | ALTO | Principal entrada em sites de clientes |
| Persistência de leads | ALTO | Base comercial e operação de clientes |
| Link curto | ALTO | Entrada de campanhas e redirecionamento |
| Feature flags | MÉDIO | Controlam múltiplos comportamentos críticos |
| Conversation state in-memory | MÉDIO | Contexto pode sumir em restart/escala |

## SEÇÃO 22 — MATRIZ DE IMPACTO

| Risco | Impacto Comercial | Impacto Técnico | Impacto Operacional |
|---|---|---|---|
| `server.js` monolítico | Alto | Alto | Alto |
| Intent incorreta | Alto | Médio | Médio |
| Extração incompleta | Alto | Alto | Médio |
| WhatsApp falho | Alto | Médio | Alto |
| Widget não carrega | Alto | Médio | Alto |
| Link curto falha | Alto | Médio | Alto |
| Estado perdido | Médio | Alto | Médio |
| Flags conflitantes | Médio | Alto | Médio |
| Scheduler conflita | Médio | Médio | Alto |
| Integração LLM indisponível | Alto | Alto | Alto |

## SEÇÃO 23 — MATRIZ DE PROBABILIDADE

| Risco | Probabilidade |
|---|---|
| `server.js` monolítico gerar regressão | ALTA |
| Extração incompleta | ALTA |
| Intent falso positivo/negativo | ALTA |
| Flags conflitantes/órfãs | ALTA |
| Paridade divergente entre canais | MÉDIA |
| WhatsApp ausente/incorreto | MÉDIA |
| Link curto quebrado | MÉDIA |
| Estado perdido | MÉDIA |
| Scheduler com conflito | MÉDIA |
| LLM totalmente indisponível | BAIXA |

## SEÇÃO 24 — TOP 10 RISCOS DO LINK MÁGICO

1. `server.js` como núcleo monolítico crítico.
2. Extração incompleta de páginas de venda.
3. Intent/decision incorreta afetando checkout e suporte.
4. Widget público falhar em domínio cliente.
5. WhatsApp não resolvido para intenção humana.
6. Link curto quebrar campanhas.
7. Persistência/captura de leads inconsistente.
8. Estado conversacional perdido ou divergente.
9. Feature flags conflitantes entre versões.
10. Deploy com dependências ambientais incompletas.

## SEÇÃO 25 — TOP 10 ARQUIVOS MAIS PERIGOSOS

| Ranking | Arquivo | Classe | Motivo |
|---|---|---|---|
| 1 | `server.js` | CRÍTICO ABSOLUTO | Monólito operacional da plataforma |
| 2 | `public/widget.js` | CRÍTICO | Entrada externa principal |
| 3 | `lib/decision-core.js` | CRÍTICO | Decide checkout/bloqueio/intenção |
| 4 | `lib/conversation-state.js` | ALTO RISCO | Estado in-memory da conversa |
| 5 | `lib/content-extractor-v112.js` | ALTO RISCO | Base do conhecimento extraído |
| 6 | `lib/link-resolver.js` | ALTO RISCO | Resolução de URLs comerciais |
| 7 | `lib/channel-resolver-safe.js` | ALTO RISCO | Caminho humano/WhatsApp |
| 8 | `sales/cta-engine.js` | ALTO RISCO | CTA final da resposta |
| 9 | `scheduling-manager.js` | ALTO RISCO | Disponibilidade e agendamentos |
| 10 | `short-url-generator.js` | ALTO RISCO | Redirecionamento de campanha |

## SEÇÃO 26 — TOP 10 DEPENDÊNCIAS MAIS PERIGOSAS

| Dependência | Tipo | Risco |
|---|---|---|
| Groq/OpenAI | Externa | Chat e geração indisponíveis ou inconsistentes |
| Puppeteer/browser | Externa/runtime | Extração falha em deploy/headless |
| Redis | Externa | Sessões/cache/rate limit podem degradar |
| PostgreSQL/SQLite/JSON data | Externa/interna | Persistência divergente |
| WhatsApp API/config | Externa | Canal humano indisponível |
| Gmail integration | Externa | Envio/status de email falha |
| Billing middleware | Interna/externa | Bloqueio indevido ou bypass de limites |
| Feature flags | Interna | Comportamentos ocultos e combinações perigosas |
| Widget config cliente | Externa | API key/token/domínio incorretos |
| Checkout/link resolver | Interna | URL comercial errada ou ausente |

## SEÇÃO 27 — MATRIZ DE GOVERNANÇA

| Componente | Auditoria obrigatória | Relatório de impacto | Testes de regressão |
|---|---|---|---|
| `server.js` | Sim | Sim | Sim |
| Widget público | Sim | Sim | Sim |
| Decision/intent engines | Sim | Sim | Sim |
| Extração/crawler | Sim | Sim | Sim |
| Lead capture | Sim | Sim | Sim |
| WhatsApp/channel resolver | Sim | Sim | Sim |
| Link curto | Sim | Sim | Sim |
| Scheduler | Sim | Sim | Sim |
| Feature flags | Sim | Sim | Sim |
| Deploy/env | Sim | Sim | Sim |

## SEÇÃO 28 — RISCOS PARA FÉRIAS DO DEV PRINCIPAL

- Conhecimento concentrado em `server.js` e na ordem histórica de versões V8–V19.
- Master maps solicitados ausentes reduzem capacidade de onboarding e auditoria independente.
- Componentes com documentação insuficiente: decisão multi-engine, data flow, feature flags, paridade de canais, link curto e extração.
- Continuidade ameaçada por lógica implícita em comentários, fallbacks silenciosos e módulos opcionais carregados dinamicamente.

## SEÇÃO 29 — CONCLUSÃO EXECUTIVA

O nível atual de risco arquitetural da plataforma é **ALTO**, com áreas **CRÍTICAS** concentradas em `server.js`, chat/LLM, extração, widget público, captura de leads e decisão de checkout/WhatsApp.

Os maiores riscos são: monólito operacional, divergência entre engines e canais, extração incompleta, perda de contexto, CTA/checkout incorreto, WhatsApp não acionado e documentação master map ausente.

Os componentes que exigem maior atenção são `server.js`, widget público, decision core, extração, lead capture, link resolver, WhatsApp resolver, scheduler e feature flags. Os módulos mais sensíveis são aqueles que alteram a resposta final ao lead ou determinam se o usuário verá checkout, WhatsApp, CTA ou formulário de captura.

As dependências que representam maior ameaça operacional são LLM externo, Puppeteer/browser runtime, persistência híbrida, WhatsApp, Redis/PostgreSQL, widget configuration e billing/checkout integrations.
