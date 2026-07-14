# Manual Oficial de Análise de Impacto de Mudanças — Link Mágico

> **Missão 34 — CHANGE_IMPACT_PLAYBOOK.md**
>
> Este documento define o processo oficial para avaliar riscos antes de qualquer alteração no Link Mágico.
>
> Base utilizada nesta análise:
>
> - Código real do repositório, especialmente `server.js`, `sales/cta-engine.js`, `structured-leads.js`, `scheduling-manager.js`, `whatsapp-channel.js`, `whatsapp-integration.js`, `analytics/*`, `lib/*` e módulos de extração.
> - Evidências arquiteturais documentadas em comentários de versão no código: V13, V14, V15, V16.2, V17, V17.2, V18, V19, V21 e patches de paridade/canal.
> - Documentação existente do repositório sobre arquitetura, leads, autenticação, agendamento, multi-tenant, integrações e correções.
> - Histórico de regressões citado pela missão: `REGRESSAO_V21.md`, `REGRESSAO_WHATSAPP.md`, `REGRESSAO_LINK_CURTO.md` e `MISSAO_08_V21_POSTMORTEM.md`. Esses arquivos não estão presentes no estado atual do repositório; portanto, as conclusões abaixo consolidam os padrões explicitamente referenciados no código e nos comentários de regressão/paridade.
> - Master Maps citados pela missão. Os arquivos `*_MASTER_MAP.md` não estão presentes no estado atual do repositório; por isso, este playbook reconstrói os mapas a partir dos módulos reais e dos pontos de integração existentes.

---

## Sumário

1. [Visão geral](#1-visão-geral)
2. [Histórico de regressões](#2-histórico-de-regressões)
3. [Matriz de criticidade](#3-matriz-de-criticidade)
4. [Processo oficial de análise de impacto](#4-processo-oficial-de-análise-de-impacto)
5. [Alteração de pipelines](#5-alteração-de-pipelines)
6. [Alteração do `server.js`](#6-alteração-do-serverjs)
7. [Alteração de extração](#7-alteração-de-extração)
8. [Alteração de CTA Engine](#8-alteração-de-cta-engine)
9. [Alteração de Lead Capture](#9-alteração-de-lead-capture)
10. [Alteração de Scheduler](#10-alteração-de-scheduler)
11. [Alteração de Journey Stage](#11-alteração-de-journey-stage)
12. [Alteração de Intent Detection](#12-alteração-de-intent-detection)
13. [Alteração de Decision Core](#13-alteração-de-decision-core)
14. [Alteração de Conversation State](#14-alteração-de-conversation-state)
15. [Alteração de Feature Flags](#15-alteração-de-feature-flags)
16. [Alteração de integrações](#16-alteração-de-integrações)
17. [Matriz de dependências](#17-matriz-de-dependências)
18. [Matriz de testes obrigatórios](#18-matriz-de-testes-obrigatórios)
19. [Matriz de canais](#19-matriz-de-canais)
20. [Matriz de risco comercial](#20-matriz-de-risco-comercial)
21. [Matriz de risco técnico](#21-matriz-de-risco-técnico)
22. [Checklist pré-mudança](#22-checklist-pré-mudança)
23. [Checklist pós-mudança](#23-checklist-pós-mudança)
24. [Checklist pré-deploy](#24-checklist-pré-deploy)
25. [Governança de mudanças](#25-governança-de-mudanças)
26. [Top 20 componentes mais sensíveis](#26-top-20-componentes-mais-sensíveis)
27. [Playbook de investigação](#27-playbook-de-investigação)
28. [Playbook de regressão](#28-playbook-de-regressão)
29. [Conclusão executiva](#29-conclusão-executiva)

---

# 1. Visão geral

## 1.1 O que é análise de impacto

Análise de impacto é o processo obrigatório de identificar, antes de alterar código, quais fluxos, canais, módulos, dados persistidos, integrações externas e métricas comerciais podem ser afetados por uma mudança.

No Link Mágico, a análise de impacto é especialmente importante porque a plataforma concentra múltiplas responsabilidades em fluxos compartilhados:

- geração de respostas por IA;
- extração de conteúdo de páginas de venda;
- detecção de intenção;
- classificação de jornada;
- geração e aplicação de CTA;
- captura de leads;
- agendamento;
- canais Widget, Link Curto e WhatsApp;
- persistência JSON/PostgreSQL;
- sessões/cache Redis;
- provedores LLM OpenAI, Groq e OpenRouter;
- flags progressivas para versões V13+.

Uma alteração aparentemente local pode atingir vários canais porque o WhatsApp, o Widget e o Link Curto dependem do pipeline central de decisão e de resposta.

## 1.2 Objetivo

Este playbook tem quatro objetivos:

1. **Evitar regressões comerciais**, como perda de CTA, perda de leads, perda de agendamentos ou respostas sem link de compra.
2. **Evitar regressões técnicas**, como quebra de pipelines V17/V18/V19/V20, indisponibilidade de canais, falhas de extração e falhas de persistência.
3. **Padronizar a investigação prévia** antes de qualquer mudança em módulos sensíveis.
4. **Definir checklists obrigatórios** para pré-mudança, pós-mudança e pré-deploy.

## 1.3 Escopo

Este manual cobre mudanças em:

- `server.js`;
- pipeline de IA e função `generateAIResponse`;
- extração (`extractPageData`, `extractPageDataWithRetry`, texto limpo, links, preços, imagens, iframes e fallback Puppeteer/enhanced extractor);
- CTA Engine (`sales/cta-engine.js`);
- Lead Capture (`lib/lead-capture-score.js`, `structured-leads.js`, LeadSystem embutido em `server.js`);
- Scheduler (`scheduling-manager.js` e fluxos de calendário em `server.js`);
- Decision Core, Journey Stage, Intent Detection e Conversation State;
- feature flags;
- integrações OpenAI, Groq, OpenRouter, WhatsApp, Gmail, Redis e PostgreSQL;
- canais Link Curto, Widget e WhatsApp.

## 1.4 Quando deve ser utilizada

A análise de impacto deve ser executada:

- antes de qualquer alteração em componente classificado como **Crítico Absoluto** ou **Crítico**;
- antes de alterar prompts, regras determinísticas, classificadores, heurísticas, thresholds ou feature flags;
- antes de alterar resposta da API `/api/chat`, `/chatbot`, webhooks ou rotas públicas;
- antes de alterar persistência, migração, schema, cache, sessão ou armazenamento de conversas;
- antes de ativar ou desativar qualquer pipeline V17+;
- antes de alterar integrações externas;
- antes de alterar comportamento de canais;
- antes de refatorar código compartilhado.

## 1.5 Quais mudanças exigem análise obrigatória?

Exigem análise obrigatória:

| Tipo de mudança | Motivo |
|---|---|
| Mudança em `server.js` | Arquivo orquestrador central: rotas, IA, extração, leads, agendamento, canais, flags e integrações. |
| Mudança em `generateAIResponse` | Afeta resposta, CTA, jornada, intenção, lead capture, histórico, LLM e fallback local. |
| Mudança em `extractPageData` | Afeta contexto usado pela IA, checkout, WhatsApp, preços, bônus e qualidade da resposta. |
| Mudança em CTA Engine | Afeta conversão, link de compra, texto final e paridade WhatsApp/Widget. |
| Mudança em Lead Capture | Afeta coleta de dados comerciais e disparo de formulário/pergunta. |
| Mudança em Scheduler | Afeta agendamentos e renderização de calendário. |
| Mudança em WhatsApp Channel | Afeta omnichannel, paridade, memória e entrega da resposta. |
| Mudança em feature flags | Pode alterar pipeline ativo em produção sem mudar código. |
| Mudança em provedores LLM | Pode alterar qualidade, latência, fallback e custo. |
| Mudança em PostgreSQL/Redis | Pode afetar leads, sessões, histórico, multi-tenant e disponibilidade. |
| Mudança em normalização de URL/link | Pode quebrar Link Curto, checkout, WhatsApp e widgets. |
| Mudança em intent/journey/decision | Pode mudar fluxo comercial inteiro. |

---

# 2. Histórico de regressões

## 2.1 Fontes históricas

A missão solicita uso de:

- `REGRESSAO_V21.md`;
- `REGRESSAO_WHATSAPP.md`;
- `REGRESSAO_LINK_CURTO.md`;
- `MISSAO_08_V21_POSTMORTEM.md`.

Esses arquivos não estão presentes no estado atual do repositório. Mesmo assim, o código contém marcas explícitas de correções e regressões, especialmente:

- comentários V21 de paridade WhatsApp ↔ Link Curto em `whatsapp-channel.js`;
- remoção de CTA de WhatsApp redundante no WhatsApp quando o lead já está no canal;
- adaptação de sinais do pipeline central para WhatsApp;
- garantia de ordem captura → agendamento;
- injeção de `calendarHash` no fluxo principal;
- referências a Link Resolver V17.2;
- logs e flags de Decision Engine V19;
- fallback e guard rails V18 para extração.

## 2.2 Principais causas observadas

| Causa | Descrição | Efeito provável |
|---|---|---|
| Decisão duplicada por canal | WhatsApp ou Widget tentando decidir comercialmente fora do pipeline central. | Divergência entre Link Curto, Widget e WhatsApp. |
| Ordem incorreta de ações | Agendamento ou CTA disparando antes de captura necessária. | Lead incompleto, calendário sem contexto ou perda de conversão. |
| CTA tratado como texto simples | Widget pode renderizar botão; WhatsApp precisa URL inline. | CTA funciona em um canal e desaparece em outro. |
| Extração incompleta | Conteúdo, preço, checkout ou WhatsApp não extraído. | IA responde genericamente ou sem link correto. |
| Feature flag sem matriz de impacto | Ativação muda pipeline sem validação completa. | Regressão silenciosa. |
| Falta de paridade cross-channel | Mudança validada só no Widget ou só no Link Curto. | Regressão em WhatsApp ou vice-versa. |
| Fallback silencioso excessivo | Erros são tratados como não críticos, mas reduzem qualidade. | Produção continua online, porém com comportamento comercial pior. |
| Estado de conversa divergente | `conversationId`, `leadId` ou histórico não preservado entre canais. | IA perde memória, repete perguntas ou captura lead duplicado. |

## 2.3 Padrões encontrados

1. **Canais são tradutores, não decisores.**
   - O WhatsApp deve traduzir sinais do pipeline central, não recalcular intenção, CTA, captura ou agendamento de forma isolada.

2. **CTA precisa ser validado por canal.**
   - No Widget pode ser botão/renderização.
   - No WhatsApp precisa estar no texto como link clicável.
   - No Link Curto precisa preservar checkout/URL correta.

3. **Lead Capture e Scheduler têm dependência de ordem.**
   - Capturar dados antes de agendar quando necessário.
   - Não ocultar calendário quando `calendarHash` existir.

4. **Extração é raiz de muitas regressões.**
   - Se `cleanText`, checkout, preço ou links falham, a IA e os motores comerciais trabalham com contexto incorreto.

5. **Flags podem criar comportamento híbrido.**
   - V17, V18, V19 e flags de canal podem rodar em paralelo, shadow ou bypass.

6. **`server.js` é acoplado demais para mudança sem análise.**
   - Rotas, IA, extração, leads, scheduler, analytics e integrações coexistem no mesmo arquivo.

## 2.4 Lições aprendidas

- Nenhuma mudança em pipeline central deve ser validada em apenas um canal.
- Todo resultado de IA deve ser checado por: resposta, CTA, lead capture, scheduler, jornada, intenção e logs.
- Toda mudança em extração deve validar páginas simples, páginas dinâmicas, checkout externo e WhatsApp.
- Toda mudança em WhatsApp deve validar paridade com Link Curto e Widget.
- Toda mudança em flags deve ter plano de rollback.
- Toda regressão deve registrar: causa raiz, componente alterado, componentes afetados, canal afetado, teste que teria detectado e ação preventiva.

---

# 3. Matriz de criticidade

## 3.1 Critérios

| Nível | Definição |
|---|---|
| **Crítico Absoluto** | Uma falha interrompe receita, leads, CTA, agendamento, resposta da IA ou todos os canais. Exige auditoria e validação completa. |
| **Crítico** | Uma falha afeta fluxo comercial importante ou canal específico. Exige análise formal e regressão direcionada. |
| **Importante** | Uma falha degrada qualidade, observabilidade, UX ou performance, mas não necessariamente interrompe venda. |
| **Suporte** | Componente auxiliar, administrativo ou operacional. Ainda exige cuidado se tocar dependências críticas. |

## 3.2 Classificação oficial

| Componente | Nível | Justificativa |
|---|---:|---|
| `server.js` | **Crítico Absoluto** | Orquestra rotas, IA, extração, leads, agendamento, flags, canais e integrações. |
| Decision Core / `generateAIResponse` / V17/V19 | **Crítico Absoluto** | Define resposta, estratégia, CTA, captura e jornada. |
| Extração (`extractPageData`) | **Crítico Absoluto** | Fonte primária de contexto, checkout, preço, WhatsApp e conteúdo. |
| CTA Engine | **Crítico Absoluto** | Diretamente ligado à conversão e link de compra. |
| Lead Capture | **Crítico Absoluto** | Diretamente ligado à geração de leads. |
| Scheduler | **Crítico** | Afeta agendamentos e calendário. |
| WhatsApp Channel | **Crítico** | Canal comercial omnichannel; depende de paridade com pipeline central. |
| Link Curto | **Crítico** | Entrada pública principal e dependente de URL/extração/checkout. |
| Widget | **Crítico** | Canal de conversa e renderização de CTA/captura/calendário. |
| Journey Stage | **Crítico** | Influencia tom, CTA, lead scoring e analytics. |
| Intent Detection | **Crítico** | Influencia decisão comercial, compra, suporte, agendamento e objeções. |
| Conversation State | **Crítico** | Mantém memória, leadId, conversationId e histórico. |
| Feature Flags | **Crítico** | Controlam pipelines e comportamento em produção. |
| OpenAI/Groq/OpenRouter | **Crítico** | Provedores de resposta IA e fallback. |
| PostgreSQL | **Crítico** | Persistência de leads, agendamentos, tenants, conversas e WhatsApp logs. |
| Redis/cache/sessões | **Importante** | Afeta sessão, cache e estabilidade sob carga. |
| Observer Layer / analytics | **Importante** | Mede conversão e aprendizagem; pode impactar otimização e diagnósticos. |
| Gmail/email | **Importante** | Notificações e comunicação; não deve bloquear core. |
| Billing/auth/admin | **Importante** | Afeta acesso, planos e painel. |
| Documentação/scripts auxiliares | **Suporte** | Baixo risco direto, exceto quando alteram deploy/configuração. |

---

# 4. Processo oficial de análise de impacto

Fluxo obrigatório:

```text
Mudança
  ↓
Identificação
  ↓
Dependências
  ↓
Impacto
  ↓
Validação
  ↓
Teste
  ↓
Deploy
```

## 4.1 Mudança

Descrever a mudança em uma frase:

- O que será alterado?
- Em qual arquivo/função/rota?
- Qual comportamento esperado?
- Qual comportamento atual não pode quebrar?

## 4.2 Identificação

Classificar:

- componente primário;
- nível de criticidade;
- canal afetado;
- pipeline afetado;
- feature flag envolvida;
- dependências externas;
- dados persistidos.

## 4.3 Dependências

Mapear dependências diretas e indiretas:

- quem chama o componente;
- quem consome o retorno;
- quais campos do retorno são esperados;
- quais flags mudam o caminho;
- quais fallbacks são usados;
- quais integrações podem falhar.

## 4.4 Impacto

Classificar impacto:

- comercial: vendas, CTA, leads, agendamentos;
- técnico: rotas, canais, integrações, persistência, cache;
- operacional: observabilidade, logs, suporte, rollback;
- UX: renderização, tempo de resposta, mensagens, links.

## 4.5 Validação

Definir evidências mínimas:

- entrada usada;
- saída esperada;
- logs esperados;
- campos obrigatórios no JSON;
- renderização esperada no canal;
- persistência esperada.

## 4.6 Teste

Executar matriz obrigatória conforme o componente alterado. Se o teste automatizado não existir, executar teste manual documentado com payload e resposta esperada.

## 4.7 Deploy

Deploy só pode ocorrer se:

- impacto mapeado;
- checklist pré-mudança preenchido;
- testes obrigatórios executados;
- rollback definido;
- flags configuradas;
- canais críticos validados.

---

# 5. Alteração de pipelines

## 5.1 Pipeline V17 — Unified Brain Orchestrator

### Papel

V17 é descrito no código como “Unified Brain Orchestrator”: decide estratégia, envia ao LLM e pode bypassar fluxos antigos quando `FEATURE_V17_BRAIN=true`.

### Dependências

- `generateAIResponse`;
- feature flag `FEATURE_V17_BRAIN`;
- pageData extraído;
- histórico de conversa;
- instruções do chatbot;
- decision/intent/journey;
- LLM provider;
- CTA/link resolver;
- canais consumidores.

### Riscos

- bypass indevido de regras antigas;
- perda de CTA;
- perda de captura;
- resposta fora do contexto extraído;
- divergência entre canais;
- fallback não testado.

### Validações obrigatórias

- V17 off: fluxo legado preservado.
- V17 on: resposta contém contexto correto.
- CTA permanece correto.
- Lead capture continua retornando metadados esperados.
- Scheduler continua emitindo `calendarHash` quando aplicável.
- Widget, Link Curto e WhatsApp apresentam comportamento equivalente.

## 5.2 Pipeline V18 — Extraction Guard

### Papel

V18 é guard rail de extração, protegido por `FEATURE_V18_EXTRACTION_GUARD` e fallback por `FEATURE_V18_FALLBACK`.

### Dependências

- `extractPageData`;
- conteúdo Cheerio;
- enhanced extractor;
- Puppeteer/fallback;
- checkout detection;
- WhatsApp link detection;
- deep context explorer;
- `cleanText` final.

### Riscos

- aceitar extração pobre como válida;
- descartar conteúdo dinâmico importante;
- perder checkout;
- duplicar ou poluir texto;
- aumentar latência;
- ativar fallback em páginas que não precisam.

### Validações obrigatórias

- Página estática com texto suficiente.
- Página dinâmica com texto insuficiente inicial.
- Página com checkout externo.
- Página com WhatsApp flutuante.
- Página com preço e bônus.
- Falha de rede com fallback seguro.

## 5.3 Pipeline V19 — Deterministic Decision Engine

### Papel

V19 é descrito como “autoridade única” e pode rodar em `off`, `shadow` ou `true` pela flag `FEATURE_DETERMINISTIC_V19`.

### Dependências

- feature flag `FEATURE_DETERMINISTIC_V19`;
- intent;
- journey;
- pageData;
- CTA/link resolver;
- lead capture;
- scheduler;
- logs comparativos em shadow.

### Riscos

- decisão determinística diferente da IA;
- shadow sem análise dos diffs;
- modo `true` bypassando fluxos V18.x e CTA global;
- regras rígidas para linguagem ambígua;
- falso positivo de compra/agendamento.

### Validações obrigatórias

- `off`: comportamento legado.
- `shadow`: diffs logados e analisados.
- `true`: decisões comerciais corretas.
- Testes com compra, dúvida, objeção, preço, suporte, agendamento e saudação.

## 5.4 Pipeline V20 — Resolução/canal/paridade operacional

### Papel

O repositório atual não contém marca textual explícita única “V20” nos arquivos analisados. Para governança, V20 deve ser tratado como a camada de transição entre decisão central e canais, incluindo Channel Resolver, WhatsApp promoter, Link Resolver e paridade de canais.

### Dependências

- `FEATURE_CHANNEL_RESOLVER_SAFE`;
- `FEATURE_WA_CTA_PROMOTER`;
- Link Resolver V17.2;
- WhatsApp Channel;
- Widget renderer;
- Link Curto;
- resposta final e metadados de CTA/calendário/captura.

### Riscos

- canal redecidir o que o core já decidiu;
- CTA aparecer em um canal e sumir em outro;
- WhatsApp receber botão em vez de URL inline;
- Link Curto usar link incorreto;
- Widget não renderizar captura/calendário.

### Validações obrigatórias

- Mesmo cenário nos três canais.
- CTA equivalente por canal.
- Lead capture equivalente por canal.
- Scheduler equivalente por canal.
- Logs de paridade sem divergência crítica.

---

# 6. Alteração do `server.js`

## 6.1 Dependências afetadas

`server.js` concentra:

- Express app e rotas públicas/admin;
- carregamento de feature flags;
- módulos V13+;
- cache e Redis;
- autenticação, sessão e CORS;
- LeadSystem e AppointmentSystem internos;
- extração de página;
- provedores LLM;
- geração de resposta;
- endpoint de chat;
- scheduler/calendário;
- analytics/conversion events;
- integração com PostgreSQL;
- integração com WhatsApp Channel;
- renderização/retorno de metadados para o Widget.

## 6.2 Módulos consumidores

- `public/widget.js`, `public/widjet.js`, `public/widget-v2.js` e páginas públicas;
- Link Curto/rotas públicas;
- WhatsApp Channel via chamada HTTP ao core;
- painel/admin;
- analytics;
- structured leads;
- scheduling manager;
- integrações de CRM/webhooks.

## 6.3 Riscos de regressão

| Área | Risco |
|---|---|
| Rotas | quebrar contrato JSON esperado pelo Widget/WhatsApp. |
| IA | resposta genérica, sem contexto ou sem fallback. |
| CTA | perder link, duplicar CTA ou usar URL errada. |
| Lead Capture | formulário não disparar ou disparar cedo demais. |
| Scheduler | calendário não renderizar por ausência de `calendarHash`. |
| Extração | IA receber conteúdo vazio ou incorreto. |
| Persistência | leads/agendamentos duplicados ou perdidos. |
| Feature flags | ativar pipeline diferente do esperado. |
| Canais | Link Curto/Widget/WhatsApp divergirem. |
| Segurança | CORS, sessão, CSRF, token widget ou rate limit afetados. |

## 6.4 Checklist obrigatório para `server.js`

Antes:

- [ ] Identificar função/rota exata.
- [ ] Classificar criticidade.
- [ ] Verificar se toca resposta da API.
- [ ] Verificar se toca `generateAIResponse`.
- [ ] Verificar se toca `extractPageData`.
- [ ] Verificar se toca LeadSystem/AppointmentSystem.
- [ ] Verificar se toca flags V17/V18/V19/V20.
- [ ] Verificar se toca Widget, Link Curto ou WhatsApp.
- [ ] Definir rollback.

Depois:

- [ ] Validar `/health` ou rota equivalente.
- [ ] Validar chat com página real.
- [ ] Validar CTA.
- [ ] Validar lead capture.
- [ ] Validar agendamento.
- [ ] Validar WhatsApp.
- [ ] Validar persistência.
- [ ] Validar logs de erro.
- [ ] Validar flags no modo esperado.

---

# 7. Alteração de extração

## 7.1 Componentes

| Componente | Papel |
|---|---|
| `extractPageDataWithRetry` | Retenta extração e fornece fallback. |
| `extractPageData` | Fluxo principal de extração. |
| `cleanText` | Texto consolidado enviado ao contexto IA. |
| `extractCleanTextFromHTML` | Base Cheerio/HTML para texto. |
| chunking/contexto | Reduz/organiza conteúdo para prompt. |
| merges | Combina Cheerio, enhanced extractor, OCR, iframes, dynamic text e links. |
| checkout detection | Descobre link de compra/CTA. |
| WhatsApp detection | Descobre links/telefones de WhatsApp. |
| Puppeteer/enhanced fallback | Recupera conteúdo dinâmico. |

## 7.2 Matriz de impacto

| Alteração | Impacto em IA | Impacto em CTA | Impacto em Leads | Impacto em Scheduler | Risco |
|---|---|---|---|---|---|
| `cleanText` | Alto: muda contexto inteiro. | Médio/alto: pode remover argumentos de venda. | Médio: pode remover sinais de interesse. | Baixo/médio. | **Alto** |
| Checkout detection | Médio. | Altíssimo: link errado/ausente. | Médio. | Baixo. | **Alto** |
| WhatsApp detection | Médio. | Médio: CTA de contato. | Alto em canal WhatsApp. | Baixo. | **Alto** |
| Price extraction | Alto para perguntas de preço. | Médio. | Médio. | Baixo. | **Médio/Alto** |
| OCR/imagens | Médio. | Médio. | Baixo/médio. | Baixo. | **Médio** |
| Iframe extraction | Médio/alto. | Alto se checkout estiver em iframe. | Baixo. | Baixo. | **Médio/Alto** |
| Dynamic text merge | Alto. | Médio/alto. | Médio. | Baixo. | **Alto** |
| Deduplicação | Médio. | Baixo/médio. | Baixo. | Baixo. | **Médio** |
| Timeout/fallback | Alto se reduz conteúdo. | Alto se pula checkout. | Médio. | Baixo. | **Alto** |

## 7.3 Validações obrigatórias

- [ ] Página com HTML simples.
- [ ] Página com conteúdo dinâmico.
- [ ] Página com checkout externo.
- [ ] Página com WhatsApp flutuante.
- [ ] Página com preço visível.
- [ ] Página com bônus/FAQ.
- [ ] Página lenta ou indisponível.
- [ ] Texto final sem duplicação excessiva.
- [ ] `pageData.checkoutLink` preservado.
- [ ] `pageData.whatsappLinks` preservado quando detectado.
- [ ] `cleanText` suficiente para resposta específica.

---

# 8. Alteração de CTA Engine

## 8.1 Papel

A CTA Engine (`sales/cta-engine.js`) converte intenção/ação/contexto em CTA textual e aplica esse CTA à resposta final quando `FEATURE_SMART_CTA=true`.

## 8.2 Impactos possíveis

| Impacto | Descrição |
|---|---|
| Conversão | CTA incorreto reduz cliques e vendas. |
| Duplicação | CTA repetido pode degradar UX. |
| Canal | Widget pode renderizar diferente do WhatsApp. |
| Link | Texto de CTA sem URL pode falhar no WhatsApp. |
| Timing | CTA cedo demais pode soar agressivo; tarde demais perde venda. |
| Jornada | CTA deve variar por descoberta/consideração/negociação. |

## 8.3 Componentes afetados

- `generateAIResponse`;
- endpoint `/api/chat` ou equivalente;
- Widget renderer;
- WhatsApp Channel inline CTA;
- analytics de clique (`cta_click`, `checkout_click`);
- Link Resolver V17.2;
- Decision Engine V19;
- Conversion Optimizer/Anti Dropoff/Closing Scripts.

## 8.4 Validações obrigatórias

- [ ] Intenção de compra gera CTA forte.
- [ ] Dúvida gera CTA suave ou educacional.
- [ ] Objeção não força checkout sem resposta.
- [ ] CTA não duplica se resposta já tem CTA.
- [ ] CTA aparece no Widget.
- [ ] CTA aparece como link clicável no WhatsApp quando aplicável.
- [ ] CTA usa checkout real, não URL da página de venda quando checkout foi encontrado.
- [ ] Eventos de clique continuam registrados.

---

# 9. Alteração de Lead Capture

## 9.1 Componentes

- `lib/lead-capture-score.js`;
- LeadSystem em `server.js`;
- `structured-leads.js`;
- captura inline do Widget;
- tradução de captura no WhatsApp;
- persistência JSON/PostgreSQL;
- notificações e CRM.

## 9.2 Riscos

| Risco | Efeito |
|---|---|
| Captura cedo demais | Usuário abandona conversa. |
| Captura tarde demais | Lead quente não é salvo. |
| Captura ausente | Perda direta de leads. |
| Dados duplicados | CRM/painel poluído. |
| Falha de persistência | Lead aparece na conversa, mas não no painel. |
| WhatsApp sem tradução textual | Sinal existe, mas usuário não vê pergunta. |
| Scheduler antes da captura | Agendamento sem dados comerciais. |

## 9.3 Efeitos colaterais

- alteração no score muda taxa de captura;
- alteração de campos muda PostgreSQL/JSON/CRM;
- alteração de `conversationId` quebra continuidade;
- alteração de `leadId` quebra atualização de jornada;
- alteração de mensagens muda UX e conversão.

## 9.4 Testes obrigatórios

- [ ] Conversa fria não captura imediatamente.
- [ ] Conversa com intenção alta captura.
- [ ] Captura inline aparece no Widget.
- [ ] WhatsApp converte captura em pergunta textual.
- [ ] Lead salvo em storage correto.
- [ ] Lead atualiza conversa/histórico.
- [ ] Lead não duplica em reenvio.
- [ ] Agendamento respeita ordem captura → calendário quando aplicável.

---

# 10. Alteração de Scheduler

## 10.1 Componentes

- `scheduling-manager.js`;
- `AppointmentSystem` em `server.js`;
- `detectarAgendamento`;
- geração de `calendarHash`;
- rotas públicas de calendário;
- Widget calendar renderer;
- WhatsApp link de agendamento;
- PostgreSQL/JSON de appointments.

## 10.2 Impactos

| Área | Impacto |
|---|---|
| Vendas | Agendamento pode ser o CTA final. |
| Lead Capture | Pode exigir dados antes de marcar horário. |
| Widget | Depende de `[CALENDAR_WIDGET]` e `calendarHash`. |
| WhatsApp | Precisa URL textual/clicável. |
| Persistência | Appointment precisa tenant/apiKey corretos. |
| Notificação | Pode depender de email/WhatsApp. |

## 10.3 Riscos

- falso positivo de agendamento;
- não detectar pedido explícito;
- `calendarHash` ausente;
- tenant incorreto;
- horário duplicado;
- agendamento sem lead;
- divergência Widget/WhatsApp;
- quebra de fallback quando PostgreSQL indisponível.

## 10.4 Validações

- [ ] Pedido explícito de agendamento.
- [ ] Pergunta ambígua não abre calendário indevidamente.
- [ ] `calendarHash` presente quando calendário deve renderizar.
- [ ] Widget renderiza calendário.
- [ ] WhatsApp recebe link clicável.
- [ ] Appointment salva corretamente.
- [ ] Tenant/apiKey correto.
- [ ] Fluxo com lead capturado e sem lead capturado.

---

# 11. Alteração de Journey Stage

## 11.1 Papel

Journey Stage classifica o estágio do cliente, como descoberta, consideração, negociação, checkout, suporte ou agendamento. Esse estágio influencia resposta, CTA, lead scoring, analytics e atualização do lead.

## 11.2 Efeitos indiretos

| Mudança em Journey | Efeito indireto |
|---|---|
| Classificar negociação cedo demais | CTA agressivo. |
| Classificar descoberta tarde demais | Perda de oportunidade de venda. |
| Classificar suporte como compra | Resposta comercial inadequada. |
| Classificar compra como dúvida | CTA fraco. |
| Não atualizar lead | CRM perde evolução. |
| Divergir por canal | WhatsApp e Widget respondem diferente. |

## 11.3 Componentes dependentes

- `journeyAnalyzer.analyzeJourneyStage`;
- LeadSystem `updateLeadJourneyStage`;
- CTA Engine;
- learning optimizer;
- analytics/performance engine;
- prompt de IA;
- local fallback response;
- WhatsApp audit logs.

## 11.4 Validações

- [ ] Saudação → descoberta.
- [ ] Pergunta de preço → consideração/negociação conforme contexto.
- [ ] Objeção → negociação.
- [ ] “quero comprar” → checkout/negociação.
- [ ] “quero agendar” → agendamento.
- [ ] “preciso de suporte” → suporte.
- [ ] Lead recebe stage atualizado.
- [ ] CTA condiz com stage.

---

# 12. Alteração de Intent Detection

## 12.1 Papel

Intent Detection identifica intenções como compra, preço, bônus, suporte, contato, agendamento, objeção e dúvidas. Afeta decisão comercial, resposta, CTA, scheduler e lead capture.

## 12.2 Falsos positivos

| Falso positivo | Risco comercial |
|---|---|
| Detectar compra em pergunta casual | CTA agressivo e perda de confiança. |
| Detectar agendamento sem pedido real | Calendário intrusivo. |
| Detectar suporte em objeção comercial | Perda de venda. |
| Detectar WhatsApp/contato indevidamente | Desvia usuário do funil. |
| Detectar checkout sem intenção | Pressão comercial indevida. |

## 12.3 Falsos negativos

| Falso negativo | Risco comercial |
|---|---|
| Não detectar compra | Perda de venda. |
| Não detectar preço | Resposta genérica. |
| Não detectar agendamento | Perda de reunião. |
| Não detectar objeção | Não remove barreira de compra. |
| Não detectar lead quente | Não captura contato. |

## 12.4 Validações

- [ ] Compra explícita.
- [ ] Compra implícita.
- [ ] Objeção de preço.
- [ ] Dúvida técnica.
- [ ] Pedido de suporte.
- [ ] Pedido de contato.
- [ ] Pedido de agendamento.
- [ ] Frases ambíguas.
- [ ] Gírias e linguagem coloquial.
- [ ] Mensagens curtas no WhatsApp.

---

# 13. Alteração de Decision Core

## 13.1 Papel

Decision Core é a camada que decide o que fazer com uma mensagem: responder, vender, capturar lead, inserir CTA, agendar, acionar fallback ou transferir contexto para canal. Inclui V17, V19, Link Resolver, CTA rules, intent, journey e geração final.

## 13.2 Impacto global

Uma alteração no Decision Core pode afetar simultaneamente:

- resposta textual;
- CTA;
- checkout link;
- lead capture;
- scheduler;
- prompt/contexto IA;
- fallback local;
- analytics;
- canais;
- persistência de estado.

## 13.3 Riscos sistêmicos

| Risco | Consequência |
|---|---|
| Autoridade duplicada | Dois módulos decidem ações diferentes. |
| Bypass indevido | Regras críticas deixam de rodar. |
| Falta de fallback | Erro de LLM quebra resposta. |
| Shadow ignorado | Divergências passam para produção. |
| Ordem errada | CTA/captura/agendamento aparecem no momento errado. |
| Estado ausente | Repetição e perda de contexto. |
| Canal sem tradução | Decisão correta não aparece ao usuário. |

## 13.4 Validações obrigatórias

- [ ] Matriz de intenções completa.
- [ ] Matriz de jornadas completa.
- [ ] Matriz de canais completa.
- [ ] CTA correto.
- [ ] Lead capture correto.
- [ ] Scheduler correto.
- [ ] Fallback local correto.
- [ ] Provedores LLM com fallback.
- [ ] Logs de decisão compreensíveis.

---

# 14. Alteração de Conversation State

## 14.1 Componentes

- `conversationId`;
- `leadId`;
- histórico de conversa;
- `lib/v13-state-manager.js`;
- analytics conversation tracker;
- memory-store;
- context lock;
- WhatsApp phone → lead resolver;
- omnichannel CRM link.

## 14.2 Riscos de contexto

| Risco | Efeito |
|---|---|
| `conversationId` instável | IA perde memória. |
| `leadId` ausente | Lead não atualiza jornada/histórico. |
| Histórico truncado incorretamente | Resposta ignora conversa. |
| Estado por canal separado | Omnichannel quebra. |
| Context lock incorreto | IA insiste em contexto errado. |
| Repetição não detectada | UX ruim. |

## 14.3 Riscos de memória

- vazamento de memória por estados sem limpeza;
- arquivo JSON crescendo sem controle;
- PostgreSQL indisponível gerando fallback inconsistente;
- conversas duplicadas por canal;
- dados sensíveis em logs;
- perda de pending writes em analytics.

## 14.4 Validações

- [ ] Mesmo usuário mantém contexto no Widget.
- [ ] Mesmo telefone mantém contexto no WhatsApp.
- [ ] Lead existente é vinculado ao WhatsApp.
- [ ] Troca de canal preserva `conversationId` quando possível.
- [ ] Histórico não cresce indefinidamente.
- [ ] Estado é limpo/expira conforme política.
- [ ] Analytics recebe conversationId correto.

---

# 15. Alteração de Feature Flags

## 15.1 Flags sensíveis

| Flag | Área |
|---|---|
| `FEATURE_V17_BRAIN` | Unified Brain. |
| `FEATURE_V18_EXTRACTION_GUARD` | Guard de extração. |
| `FEATURE_V18_FALLBACK` | Fallback de extração. |
| `FEATURE_DETERMINISTIC_V19` | Decision Engine. |
| `FEATURE_CHANNEL_RESOLVER_SAFE` | Resolução segura de canal. |
| `FEATURE_WA_CTA_PROMOTER` | CTA no WhatsApp. |
| `FEATURE_CHAT_FIRST` | Captura por score/chat-first. |
| `FEATURE_PUPPETEER` | Extração dinâmica. |
| `FEATURE_AUTO_LEARNING` | Aprendizagem automática. |
| `FEATURE_SMART_CTA` | CTA Engine. |
| `FEATURE_CONTEXT_LOCK` | Trava de contexto. |
| `FEATURE_MODULAR_AI` | Módulos IA refatorados. |
| `FEATURE_PERSISTENT_MEMORY` | Memória persistente. |
| `FEATURE_WIDGET_TOKEN` | Segurança do widget. |
| `FEATURE_AUTO_CHECKOUT_DETECTION` | Detecção automática de checkout. |

## 15.2 Conflitos possíveis

| Combinação | Risco |
|---|---|
| V17 on + V19 true | Autoridade de decisão precisa ser única. |
| V18 guard off + Puppeteer off | Extração pobre sem fallback. |
| Smart CTA off + WA CTA promoter on | WhatsApp pode esperar CTA inexistente. |
| Chat First off + Scheduler on | Agendamento sem captura prévia. |
| Channel Resolver off + WhatsApp on | Divergência de canal. |
| Context Lock on + extração ruim | IA fica presa em contexto incorreto. |
| Persistent Memory off + omnichannel on | Perda de continuidade. |

## 15.3 Regras

- Toda alteração de flag exige registro de antes/depois.
- Flags com modo `shadow` devem ter análise dos diffs antes de `true`.
- Nunca ativar duas autoridades de decisão sem matriz de precedência.
- Toda flag que altera canal exige teste Widget + Link Curto + WhatsApp.
- Toda flag que altera extração exige páginas de teste.

---

# 16. Alteração de integrações

## 16.1 OpenAI

Impactos:

- qualidade e tom das respostas;
- custo e latência;
- compatibilidade de payload;
- fallback para outros provedores;
- limites e erros de API.

Validações:

- chave presente;
- modelo configurado;
- timeout;
- fallback local/provedor secundário;
- resposta com contexto e CTA.

## 16.2 Groq

Impactos:

- latência menor, comportamento de modelo diferente;
- compatibilidade com formato OpenAI-like;
- variação de instruções.

Validações:

- `GROQ_API_KEY`;
- `GROQ_MODEL`;
- resposta em português;
- preservação de CTA e contexto.

## 16.3 OpenRouter

Impactos:

- roteamento para modelos externos;
- variação de capacidade;
- headers e base URL;
- custo/latência.

Validações:

- `OPENROUTER_API_KEY`;
- `OPENROUTER_MODEL`;
- fallback;
- compatibilidade de mensagens.

## 16.4 WhatsApp

Impactos:

- entrega de mensagens;
- paridade com pipeline central;
- resolução de tenant por telefone/API key;
- criação/vínculo de lead;
- CTA inline;
- agendamento por URL.

Validações:

- webhook inbound;
- outbound send;
- lead existente por telefone;
- lead novo;
- CTA inline;
- captura textual;
- calendário/link de agendamento;
- logs de paridade.

## 16.5 Gmail/email

Impactos:

- notificações de lead/agendamento;
- relatórios;
- recuperação/contato operacional.

Validações:

- envio não bloqueia core;
- erro é logado;
- retry/fila quando aplicável;
- templates mantêm campos obrigatórios.

## 16.6 Redis

Impactos:

- sessões;
- cache;
- rate limit;
- estabilidade sob carga.

Validações:

- Redis conectado;
- fallback para MemoryStore documentado;
- rate limit funcional;
- comportamento em queda do Redis.

## 16.7 PostgreSQL

Impactos:

- leads;
- appointments;
- tenants;
- WhatsApp logs;
- learning/analytics;
- migração JSON ↔ banco.

Validações:

- conexão;
- migração;
- leitura/escrita;
- fallback JSON quando aplicável;
- tenant isolation;
- não duplicação.

---

# 17. Matriz de dependências

| Componente alterado | Componentes afetados | Nível de impacto |
|---|---|---:|
| `server.js` | Todos os canais, IA, extração, leads, scheduler, flags, integrações | **Crítico Absoluto** |
| `generateAIResponse` | CTA, lead capture, scheduler, journey, intent, LLM, Widget, WA | **Crítico Absoluto** |
| `extractPageData` | contexto IA, checkout, WhatsApp, preço, CTA, Link Curto | **Crítico Absoluto** |
| CTA Engine | resposta final, checkout, analytics, WhatsApp inline, Widget | **Crítico Absoluto** |
| Lead Capture | CRM, Widget inline, WA textual, PostgreSQL/JSON, scheduler | **Crítico Absoluto** |
| Scheduler | calendário, appointments, Widget, WA, leads | **Crítico** |
| Journey Stage | CTA, lead score, analytics, prompt, CRM | **Crítico** |
| Intent Detection | Decision Core, CTA, scheduler, suporte, compra | **Crítico** |
| Decision Core | Todos os fluxos comerciais | **Crítico Absoluto** |
| Conversation State | memória, histórico, omnichannel, analytics | **Crítico** |
| Feature Flags | pipelines, canais, extração, segurança | **Crítico** |
| WhatsApp Channel | WA inbound/outbound, lead linking, CTA, scheduler | **Crítico** |
| Link Curto | URL, extração, CTA, resposta, analytics | **Crítico** |
| Widget | renderização CTA/captura/calendário, UX, eventos | **Crítico** |
| PostgreSQL | leads, appointments, tenants, logs, analytics | **Crítico** |
| Redis | sessão, cache, rate limit | **Importante** |
| OpenAI/Groq/OpenRouter | IA, fallback, custo, latência | **Crítico** |
| Analytics/Observer | métricas, aprendizagem, diagnóstico | **Importante** |

---

# 18. Matriz de testes obrigatórios

| Mudança | Testes necessários |
|---|---|
| CTA | CTA Regression; checkout link; não duplicação; Widget; WhatsApp inline; analytics click. |
| Lead Capture | Lead Regression; score threshold; Widget inline; WhatsApp textual; persistência; não duplicação. |
| Scheduler | Scheduler Regression; `calendarHash`; Widget calendar; WhatsApp URL; salvar appointment; tenant. |
| Extração | Extraction Regression; HTML simples; dinâmico; checkout; WhatsApp; preço; fallback. |
| Decision Core | Decision Regression; intenções; jornada; CTA; captura; scheduler; fallback LLM. |
| Intent Detection | Intent Matrix; falsos positivos; falsos negativos; mensagens curtas; ambiguidades. |
| Journey Stage | Journey Matrix; atualização de lead; CTA por estágio; analytics. |
| Conversation State | Memory Regression; conversationId; leadId; histórico; omnichannel. |
| Feature Flags | Flag Matrix; off/on/shadow; rollback; canais; logs. |
| WhatsApp | WA Regression; inbound; outbound; lead link; CTA inline; captura; scheduler. |
| Link Curto | Short Link Regression; URL; extração; resposta; checkout; tracking. |
| Widget | Widget Regression; render CTA; render captura; render calendário; eventos. |
| PostgreSQL | DB Regression; leads; appointments; tenants; fallback; migração. |
| Redis | Session/cache test; fallback MemoryStore; rate limit. |
| LLM providers | Provider fallback; timeout; formato; resposta em português. |

---

# 19. Matriz de canais

| Componente | Link Curto | Widget | WhatsApp |
|---|---|---|---|
| Extração | Crítico: origem do contexto da URL. | Médio: pode usar contexto já extraído. | Crítico quando WA chama core com salesUrl. |
| CTA Engine | Crítico: link de checkout. | Crítico: botão/CTA renderizado. | Crítico: precisa URL inline. |
| Lead Capture | Médio/alto: depende do fluxo. | Crítico: formulário inline. | Crítico: pergunta textual e vínculo por telefone. |
| Scheduler | Médio/alto. | Crítico: calendário visual. | Crítico: link textual. |
| Journey Stage | Crítico. | Crítico. | Crítico. |
| Intent Detection | Crítico. | Crítico. | Crítico, com mensagens mais curtas. |
| Decision Core | Crítico absoluto. | Crítico absoluto. | Crítico absoluto. |
| Conversation State | Médio/alto. | Crítico. | Crítico: telefone e lead. |
| Feature Flags | Alto. | Alto. | Alto. |
| PostgreSQL | Alto. | Alto. | Alto: logs e lead link. |
| Redis | Médio. | Médio. | Médio. |
| Analytics | Alto para atribuição. | Alto para eventos. | Alto para paridade e conversão. |

Regra: qualquer componente com impacto **Crítico** em pelo menos um canal deve ser testado nos três canais se estiver no caminho do pipeline central.

---

# 20. Matriz de risco comercial

## 20.1 Classificação

| Nível | Definição |
|---|---|
| **Alto** | Pode reduzir vendas, leads, CTA ou agendamentos diretamente. |
| **Médio** | Pode degradar conversão, qualidade da resposta ou rastreamento. |
| **Baixo** | Baixo efeito comercial direto. |

## 20.2 Mudanças que podem afetar vendas

| Mudança | Risco |
|---|---:|
| CTA Engine | **Alto** |
| Decision Core | **Alto** |
| Intent Detection compra/preço/objeção | **Alto** |
| Checkout detection | **Alto** |
| Link Resolver | **Alto** |
| Extração de preço/oferta/bônus | **Alto** |
| LLM provider/prompt | **Médio/Alto** |
| Widget render | **Alto** |
| WhatsApp inline CTA | **Alto** |

## 20.3 Mudanças que podem afetar leads

| Mudança | Risco |
|---|---:|
| Lead Capture score | **Alto** |
| Structured leads | **Alto** |
| Persistência PostgreSQL/JSON | **Alto** |
| WhatsApp lead resolver | **Alto** |
| Widget inline capture | **Alto** |
| Journey Stage | **Médio/Alto** |
| Conversation State | **Médio/Alto** |

## 20.4 Mudanças que podem afetar CTA

| Mudança | Risco |
|---|---:|
| CTA Engine | **Alto** |
| Link Resolver V17.2 | **Alto** |
| Checkout extraction | **Alto** |
| Decision Core V17/V19 | **Alto** |
| WhatsApp Channel adapter | **Alto** |
| Widget renderer | **Alto** |
| Feature flags | **Alto** |

## 20.5 Mudanças que podem afetar agendamentos

| Mudança | Risco |
|---|---:|
| Scheduler | **Alto** |
| `detectarAgendamento` | **Alto** |
| `calendarHash` | **Alto** |
| Widget calendar | **Alto** |
| WhatsApp scheduler URL | **Alto** |
| Lead Capture order | **Médio/Alto** |
| Appointment persistence | **Alto** |

---

# 21. Matriz de risco técnico

## 21.1 Mudanças que podem quebrar pipelines

| Mudança | Risco técnico |
|---|---:|
| `server.js` | **Alto** |
| `generateAIResponse` | **Alto** |
| Feature flags V17/V18/V19/V20 | **Alto** |
| Decision Engine | **Alto** |
| Extração | **Alto** |
| Prompt/context chunking | **Alto** |
| LLM provider | **Médio/Alto** |

## 21.2 Mudanças que podem quebrar integrações

| Mudança | Risco técnico |
|---|---:|
| OpenAI/Groq/OpenRouter payload | **Alto** |
| WhatsApp webhook/send | **Alto** |
| PostgreSQL schema/helpers | **Alto** |
| Redis session/cache | **Médio/Alto** |
| Gmail/email queue | **Médio** |
| CRM/webhooks | **Médio/Alto** |

## 21.3 Mudanças que podem quebrar canais

| Mudança | Risco técnico |
|---|---:|
| Widget JS/API contract | **Alto** |
| Link Curto routing/URL | **Alto** |
| WhatsApp Channel adapter | **Alto** |
| CORS/token widget | **Alto** |
| Response JSON shape | **Alto** |
| `calendarHash`/CTA/leadCapture fields | **Alto** |

---

# 22. Checklist pré-mudança

Antes de alterar qualquer código:

- [ ] Descrever a mudança em uma frase.
- [ ] Identificar arquivos/funções/rotas afetadas.
- [ ] Classificar criticidade.
- [ ] Verificar se toca `server.js`.
- [ ] Verificar se toca pipeline IA.
- [ ] Verificar se toca extração.
- [ ] Verificar se toca CTA.
- [ ] Verificar se toca lead capture.
- [ ] Verificar se toca scheduler.
- [ ] Verificar se toca journey/intent/decision.
- [ ] Verificar se toca conversation state.
- [ ] Verificar se toca feature flags.
- [ ] Verificar se toca integrações externas.
- [ ] Mapear canais afetados: Link Curto, Widget, WhatsApp.
- [ ] Mapear dados persistidos afetados.
- [ ] Mapear campos JSON afetados.
- [ ] Mapear logs necessários.
- [ ] Definir testes obrigatórios.
- [ ] Definir plano de rollback.
- [ ] Definir se precisa auditoria/revisão/relatório.

---

# 23. Checklist pós-mudança

Após alterar código:

- [ ] Confirmar que a mudança ficou restrita ao escopo.
- [ ] Confirmar que contratos de API não mudaram sem documentação.
- [ ] Confirmar que flags mantêm defaults esperados.
- [ ] Confirmar que fallback continua funcionando.
- [ ] Confirmar que logs não expõem dados sensíveis.
- [ ] Executar testes obrigatórios do componente.
- [ ] Validar Link Curto quando aplicável.
- [ ] Validar Widget quando aplicável.
- [ ] Validar WhatsApp quando aplicável.
- [ ] Validar CTA.
- [ ] Validar Lead Capture.
- [ ] Validar Scheduler.
- [ ] Validar persistência.
- [ ] Validar analytics/eventos.
- [ ] Registrar riscos residuais.

---

# 24. Checklist pré-deploy

Antes de deploy:

- [ ] Relatório de impacto preenchido para componentes críticos.
- [ ] Testes obrigatórios executados.
- [ ] Canais críticos validados.
- [ ] Feature flags conferidas no ambiente alvo.
- [ ] Variáveis de ambiente conferidas.
- [ ] Rollback definido.
- [ ] Logs/observabilidade preparados.
- [ ] Migrações revisadas, se houver.
- [ ] Dados de produção preservados.
- [ ] Verificação de saúde planejada.
- [ ] Plano de monitoramento pós-deploy.
- [ ] Responsável por rollback definido.

---

# 25. Governança de mudanças

## 25.1 Componentes que exigem auditoria antes da alteração

- `server.js`;
- `generateAIResponse`;
- `extractPageData`;
- CTA Engine;
- Lead Capture;
- Decision Core V17/V19;
- WhatsApp Channel;
- Scheduler;
- feature flags críticas;
- PostgreSQL/migrações;
- contratos JSON do Widget/WhatsApp.

## 25.2 Componentes que exigem revisão técnica

- módulos de analytics;
- memory/conversation state;
- integração LLM;
- Redis/session/cache;
- autenticação/CORS/token;
- CRM/webhooks;
- renderização de Widget;
- Link Curto.

## 25.3 Componentes que exigem relatório de impacto

Relatório obrigatório para:

- qualquer componente Crítico Absoluto;
- qualquer mudança que afete mais de um canal;
- qualquer mudança que altere resposta final da IA;
- qualquer mudança que altere CTA, lead capture ou scheduler;
- qualquer mudança que altere persistência de lead/agendamento;
- qualquer ativação de flag V17/V18/V19/V20 em produção.

## 25.4 Modelo mínimo de relatório de impacto

```text
Mudança:
Componente primário:
Arquivos/funções:
Criticidade:
Canais afetados:
Pipelines afetados:
Feature flags:
Dependências diretas:
Dependências indiretas:
Risco comercial:
Risco técnico:
Testes obrigatórios:
Plano de rollback:
Responsável:
```

---

# 26. Top 20 componentes mais sensíveis

Ranking por **Impacto × Dependências**:

| Rank | Componente | Motivo |
|---:|---|---|
| 1 | `server.js` | Maior concentração de responsabilidades e rotas. |
| 2 | `generateAIResponse` | Centro da resposta IA e decisões comerciais. |
| 3 | `extractPageData` | Origem do contexto e links comerciais. |
| 4 | Decision Core V17/V19 | Autoridade de decisão e bypass de fluxos. |
| 5 | CTA Engine | Conversão direta. |
| 6 | Lead Capture Score/System | Receita via geração de leads. |
| 7 | WhatsApp Channel | Canal comercial com adaptação própria e paridade. |
| 8 | Link Resolver / checkout detection | Define link real de compra. |
| 9 | Scheduler / Calendar Hash | Agendamentos e conversão de reunião. |
| 10 | Feature Flags | Mudam comportamento sem patch. |
| 11 | Conversation State / V13 state | Memória e continuidade. |
| 12 | Journey Analyzer | Influencia CTA, lead score e resposta. |
| 13 | Intent Detection | Define ações comerciais. |
| 14 | Widget API contract | Renderização final para usuário. |
| 15 | PostgreSQL helpers/persistence | Fonte de dados de leads/agendamentos/tenants. |
| 16 | LLM provider clients | Resposta IA, fallback e custo. |
| 17 | Enhanced extractor/Puppeteer | Conteúdo dinâmico e páginas modernas. |
| 18 | Analytics/Observer Layer | Métricas, aprendizagem e diagnóstico. |
| 19 | Redis/session/cache | Estabilidade e sessão. |
| 20 | Auth/CORS/widget token | Segurança e disponibilidade do Widget. |

---

# 27. Playbook de investigação

Procedimento oficial:

```text
Alteração
  ↓
Dependências
  ↓
Impacto
  ↓
Validação
```

## 27.1 Passo 1 — Alteração

Registrar:

- arquivo;
- função;
- rota;
- flag;
- entrada alterada;
- saída esperada.

## 27.2 Passo 2 — Dependências

Responder:

- Quem chama?
- Quem consome?
- Quais campos são esperados?
- Quais canais usam?
- Quais flags mudam o caminho?
- Qual fallback existe?

## 27.3 Passo 3 — Impacto

Classificar:

- risco comercial: alto/médio/baixo;
- risco técnico: alto/médio/baixo;
- canais afetados;
- dados afetados;
- métricas afetadas.

## 27.4 Passo 4 — Validação

Definir:

- cenários mínimos;
- payloads;
- respostas esperadas;
- logs esperados;
- persistência esperada;
- plano de rollback.

---

# 28. Playbook de regressão

## 28.1 Objetivo

Investigar rapidamente uma regressão, identificar causa raiz e prevenir repetição.

## 28.2 Procedimento oficial

1. **Classificar sintoma**
   - CTA sumiu?
   - Lead não captura?
   - Calendário não aparece?
   - WhatsApp diverge?
   - Link Curto falha?
   - IA responde genérico?
   - Dados não persistem?

2. **Identificar canal**
   - Link Curto;
   - Widget;
   - WhatsApp;
   - todos.

3. **Identificar último componente alterado**
   - arquivo;
   - função;
   - flag;
   - env var;
   - dependência externa.

4. **Reproduzir com entrada mínima**
   - mensagem;
   - URL;
   - apiKey/tenant;
   - conversationId;
   - leadId.

5. **Inspecionar saída estruturada**
   - `response`;
   - `cta`;
   - `leadCapture`;
   - `calendarHash`;
   - `journeyStage`;
   - `inteligenciasDetectadas`;
   - logs de provider/fallback.

6. **Comparar canais**
   - mesmo input no Widget;
   - mesmo input no Link Curto;
   - mesmo input no WhatsApp.

7. **Isolar camada**
   - extração;
   - decisão;
   - geração;
   - adaptação de canal;
   - renderização;
   - persistência.

8. **Confirmar causa raiz**
   - mudança de contrato;
   - flag;
   - fallback;
   - estado;
   - integração;
   - dado ausente.

9. **Definir contenção**
   - rollback;
   - desativar flag;
   - fallback manual;
   - limitar canal;
   - monitorar logs.

10. **Registrar postmortem**
    - causa;
    - impacto;
    - canal;
    - teste que faltou;
    - prevenção.

## 28.3 Matriz rápida de diagnóstico

| Sintoma | Primeiro lugar para olhar |
|---|---|
| Resposta genérica | `extractPageData`, LLM fallback, prompt/contexto. |
| CTA ausente | CTA Engine, Link Resolver, checkout extraction, flags. |
| CTA no Widget mas não no WA | WhatsApp adapter/promoter, inline CTA. |
| Captura não aparece | `lead-capture-score`, endpoint JSON, Widget inline, WA tradução. |
| Calendário não aparece | `detectarAgendamento`, `calendarHash`, Widget renderer. |
| Agendamento sem lead | ordem Lead Capture → Scheduler. |
| Lead duplicado | Lead resolver, phone/email matching, conversationId. |
| WhatsApp responde diferente | canal redecidindo, paridade, core endpoint. |
| Link Curto quebra | URL routing, extraction, checkout detection. |
| Dados somem | PostgreSQL fallback, JSON backup, tenant/apiKey. |

---

# 29. Conclusão executiva

## 29.1 Como avaliar mudanças

Toda mudança deve ser avaliada por cinco perguntas:

1. **Qual componente primário será alterado?**
2. **Quais componentes consomem esse resultado?**
3. **Quais canais dependem desse comportamento?**
4. **Qual risco comercial existe para vendas, leads, CTA ou agendamento?**
5. **Quais testes provam que não houve regressão?**

Se qualquer resposta envolver `server.js`, Decision Core, extração, CTA, lead capture, scheduler, WhatsApp ou feature flags, a mudança exige análise formal.

## 29.2 Como reduzir risco

- Manter uma autoridade única de decisão.
- Tratar canais como adaptadores, não como decisores.
- Validar sempre Widget + Link Curto + WhatsApp.
- Usar flags em modo shadow antes de ativar.
- Registrar diffs de decisão.
- Testar CTA, captura e scheduler juntos.
- Preservar contrato JSON da API.
- Validar extração antes de validar IA.
- Garantir rollback simples por flag quando possível.

## 29.3 Como evitar novos V21

Para evitar regressões do tipo V21:

- não alterar WhatsApp sem validar paridade com Link Curto;
- não permitir que o WhatsApp tome decisão comercial independente do core;
- validar CTA inline no WhatsApp;
- validar ordem captura → agendamento;
- validar `calendarHash` em todos os caminhos;
- validar que a resposta final contém os metadados esperados;
- registrar teste de regressão para todo bug encontrado.

## 29.4 Componentes que exigem maior cuidado

Maior cuidado absoluto:

1. `server.js`;
2. `generateAIResponse`;
3. `extractPageData`;
4. Decision Core V17/V19;
5. CTA Engine;
6. Lead Capture;
7. WhatsApp Channel;
8. Scheduler;
9. Feature Flags;
10. PostgreSQL/persistência.

## 29.5 Componentes que exigem auditoria obrigatória

Auditoria obrigatória antes de alterar:

- `server.js`;
- pipeline V17/V18/V19/V20;
- extração;
- CTA Engine;
- Lead Capture;
- Scheduler;
- Journey Stage;
- Intent Detection;
- Decision Core;
- Conversation State;
- Feature Flags;
- integrações OpenAI/Groq/OpenRouter/WhatsApp/PostgreSQL/Redis;
- contratos de API consumidos por Widget, Link Curto e WhatsApp.

## 29.6 Regra final

> Nenhuma alteração em componente comercial ou pipeline central deve ser considerada segura até provar, com evidência, que **resposta, CTA, lead capture, scheduler, estado, persistência e canais** continuam funcionando.
