# WHATSAPP V21 — Documentação Técnica Completa

## 1. Objetivo original da V21

A V21 foi criada para transformar o WhatsApp em um canal de transporte puro, reutilizando o mesmo cérebro comercial do Link Curto. O princípio documentado no próprio canal é: **canal não é inteligência**. O WhatsApp deve receber a mensagem, resolver o tenant, chamar o pipeline central e entregar a resposta, sem decidir sozinho intenção, jornada, CTA, captura ou agendamento.

### Motivo da criação

Antes da V21, o WhatsApp havia evoluído por correções sucessivas de SaaS, Evolution API e paridade de dados, mas ainda carregava risco de divergência funcional em relação ao Link Curto. A V21 nasceu para reduzir essa diferença e fazer o WhatsApp consumir `/api/process-chat-inteligente`, o endpoint central do Link Curto, em vez de depender do caminho legado `/api/chat-universal`.

### Problema que tentava resolver

O problema central era a **não paridade entre canais**. O mesmo usuário, com a mesma intenção, poderia receber comportamentos diferentes conforme entrasse pelo Link Curto, Widget ou WhatsApp. Isso afetava:

- detecção de intenção;
- estágio de jornada;
- CTA e checkout;
- captura de lead;
- agendamento;
- histórico e memória de conversa;
- auditoria operacional.

### Contexto comercial

Comercialmente, o WhatsApp é um canal de alta intenção. Muitos clientes chegam pelo WhatsApp prontos para comprar, tirar objeções ou agendar. Se o WhatsApp não compartilha o mesmo motor do Link Curto, a plataforma corre risco de perder conversões por respostas sem CTA, capturas fora de ordem ou agendamentos exibidos antes da qualificação mínima do lead.

A V21 buscou tornar o WhatsApp equivalente ao Link Curto para preservar conversão, consistência de funil e previsibilidade comercial.

### Contexto técnico

Tecnicamente, a V21 alterou a responsabilidade do `whatsapp-channel.js`: ele deixou de ser um canal que apenas chamava o endpoint legado e passou a montar um payload compatível com o Link Curto para `/api/process-chat-inteligente`. O endpoint central continua responsável por IA, inteligências, jornada, CTA, lead capture, scheduler, billing e camadas V17/V18/V19/V20.

---

## 2. Situação antes da V21

### Funcionamento do WhatsApp

O WhatsApp já possuía um canal nativo isolado, com webhooks de Evolution API e Twilio, resolução de tenant, rate limit, criação/resolução de lead por telefone, gravação de mensagens inbound/outbound e envio da resposta pelo provedor correto.

O fluxo básico antes da V21 era:

1. provedor enviava webhook;
2. canal validava evento, origem, grupo e texto;
3. canal resolvia tenant pela instância ou número;
4. canal resolvia/criava lead pelo telefone;
5. canal chamava o motor de chat;
6. canal adaptava e enviava a resposta.

### Endpoint utilizado

Antes da V21, o caminho esperado era o legado `/api/chat-universal`. A própria feature flag criada na V21 preserva essa possibilidade como rollback: `WA_USE_FULL_PIPELINE=false` retorna para `/api/chat-universal`; qualquer outro valor mantém o caminho novo `/api/process-chat-inteligente`.

### Fluxo de captura

Antes da V21, a captura do WhatsApp dependia de sinais disponíveis no retorno do endpoint legado ou de lógica indireta do canal. O canal não tinha paridade garantida com o mecanismo de lead score/captura usado pelo Link Curto no endpoint inteligente.

### Fluxo de CTA

O WhatsApp precisava transformar CTAs estruturados ou links em texto inline, porque o Widget pode renderizar botão, mas o WhatsApp precisa enviar texto clicável. Antes das correções de paridade, havia risco de CTA ausente, CTA incompleto ou CTA de WhatsApp redundante.

### Fluxo de agendamento

O Link Curto/Widget podia renderizar calendário usando `calendarHash` e componentes de frontend. No WhatsApp, esse mesmo sinal precisava ser traduzido em uma URL clicável `/agendar/<hash>`. Antes da V21, a paridade de ordem entre captura e agendamento não era explícita.

### Diferenças para Link Curto

O Link Curto chama diretamente `/api/process-chat-inteligente` com dados de página, assistente, instruções, `conversationId`, `leadId` e `apiKey`. O WhatsApp precisava reconstruir esse contexto a partir do tenant e da última URL curta/configuração do assistente. Essa reconstrução é uma dependência crítica e não óbvia da paridade.

---

## 3. Alterações realizadas na V21

### Arquivos alterados ou envolvidos

| Arquivo | Papel na V21 |
|---|---|
| `whatsapp-channel.js` | Canal WhatsApp, webhooks, resolução de tenant/lead, chamada ao cérebro unificado, adaptação para WhatsApp, tradução de CTA/captura/agendamento e auditoria. |
| `lib/wa-parity-audit.js` | Auditoria observacional de paridade WhatsApp ↔ Link Curto, sem efeitos colaterais. |
| `server.js` | Endpoint `/api/process-chat-inteligente`, journey stage, intent detection, lead capture score, CTA, scheduler e retorno de sinais usados pela V21. |
| `whatsapp-routes.js` | Rotas administrativas/SaaS do WhatsApp, configuração de provider e instância Evolution/Twilio. |
| `whatsapp-integration.js` | Camada de integração/provedor para envio e testes de conexão. |
| `lib/leads/lead-capture.js` | Sistema de lead/captura usado pelo pipeline e pelo canal para resolver histórico e jornada. |

### Funções alteradas ou centrais

#### `whatsapp-channel.js`

- `registerRoutes(app)`: registra `/api/webhook/evolution`, `/api/webhook/twilio` e status do canal.
- `_handleEvolutionWebhook(req, res)`: normaliza eventos Evolution Go v0.7.1 e Evolution API v1, filtra mensagens inválidas e chama `_processIncomingMessage`.
- `_handleTwilioWebhook(req, res)`: compatibilidade com Twilio e convergência para `_processIncomingMessage`.
- `_processIncomingMessage(...)`: fluxo unificado do WhatsApp; resolve lead, registra mensagem, chama cérebro central, adapta resposta, injeta CTA inline, traduz captura/agendamento e registra auditoria.
- `_callUnifiedBrain(apiKey, message, conversationId, leadId)`: monta o payload compatível com Link Curto e escolhe `/api/process-chat-inteligente` ou `/api/chat-universal` pela feature flag.

#### `lib/wa-parity-audit.js`

- `log(params)`: registra sinais de jornada, intenção, lead score, CTA, captura, scheduler, fonte de resposta e indicação de paridade.

#### `server.js`

- `/api/process-chat-inteligente`: endpoint central que calcula jornada, captura inteligências, processa LLM/fallback, aplica camadas comerciais, CTA, scheduler, lead capture e retorna sinais estruturados.
- `generateAIResponse(...)`: geração central de resposta usada pelo endpoint inteligente.
- lógica de `leadCapture`: avalia score e `shouldCapture` em modo chat-first.
- lógica de `calendarHash`: retorna hash para scheduler quando há intenção de agendamento.

### Feature flags criadas ou relevantes

| Flag | Função |
|---|---|
| `WA_USE_FULL_PIPELINE` | Flag específica da V21. `true`/default usa `/api/process-chat-inteligente`; `false` usa `/api/chat-universal` como rollback. |
| `FEATURE_CLEAN_CHAT_V2` | Influencia pós-processamento de resposta no endpoint inteligente. |
| `FEATURE_AUTO_LEARNING` | Pode otimizar e registrar interações por intenção/jornada. |
| `FEATURE_WA_CTA_PROMOTER` | Promove WhatsApp como CTA universal em cenários específicos fora do canal de entrada WhatsApp. |
| `FEATURE_SMART_CTA` e flags de conversion layer | Afetam enriquecimento/conversão/CTA no pipeline central. |
| flags V17/V18/V19/V20 | Afetam resolução de CTA, decisões determinísticas, fallback e auditorias do pipeline central. |

### Auditorias adicionadas

A V21 adicionou `wa-parity-audit.js`, módulo observacional que loga:

- mensagem;
- canal;
- `conversationId`;
- `leadId`;
- `journeyStage`;
- intenções detectadas;
- `leadScore`;
- `ctaTriggered`;
- `captureTriggered`;
- `scheduleTriggered`;
- se `generateAIResponse` executou;
- fonte da resposta;
- preview da resposta;
- se deveria corresponder ao Link Curto.

### Novos fluxos

1. **WhatsApp → pipeline completo**: default passa a ser `/api/process-chat-inteligente`.
2. **Fallback controlado**: `WA_USE_FULL_PIPELINE=false` retorna ao legado.
3. **CTA estruturado → texto inline**: `aiResult.cta.url` vira texto clicável no WhatsApp.
4. **Lead capture → pergunta textual**: `leadCapture.shouldCapture` vira mensagem de captura.
5. **Scheduler → URL pública**: `calendarHash` vira `/agendar/<hash>`.
6. **Auditoria de paridade**: cada interação relevante gera log comparável ao Link Curto.

---

## 4. Arquitetura da V21

### Fluxograma textual completo

```text
Mensagem WhatsApp
↓
Webhook do provedor
  ├─ Evolution: POST /api/webhook/evolution
  └─ Twilio: POST /api/webhook/twilio
↓
_whatsappWebhook / handler do provedor
  ├─ valida evento
  ├─ ignora fromMe
  ├─ ignora grupo
  ├─ extrai remoteJid/phone
  ├─ extrai pushName
  ├─ extrai texto
  └─ resolve tenant
↓
_processIncomingMessage
  ├─ resolve/cria lead por telefone
  ├─ escolhe conversationId
  ├─ grava inbound
  ├─ atualiza histórico do lead
  ├─ incrementa analytics
  └─ respeita channelMode off/manual/auto
↓
_callUnifiedBrain
  ├─ busca short_urls do tenant
  ├─ busca sales_url
  ├─ busca robotName
  ├─ busca instructions
  ├─ busca checkout confirmado
  ├─ tenta enriquecer pageData
  ├─ monta payload: message, apiKey, conversationId, leadId, url, robotName, instructions, pageData, context
  └─ escolhe endpoint por WA_USE_FULL_PIPELINE
↓
/api/process-chat-inteligente
  ├─ resolve apiKey
  ├─ processa pageData/url
  ├─ analisa emoção
  ├─ captura inteligências/intents
  ├─ calcula journeyStage
  ├─ resolve effectiveLeadId
  ├─ atualiza conversa/jornada do lead
  ├─ detecta agendamento prioritário quando aplicável
  ├─ chama generateAIResponse ou fallback
  ├─ aplica camadas V17/V18/V19/V20 conforme flags
  ├─ avalia CTA
  ├─ avalia leadCapture
  ├─ gera calendarHash quando necessário
  └─ retorna response + sinais estruturados
↓
Adaptadores do WhatsApp
  ├─ _adaptForWhatsApp(response)
  ├─ remove/ajusta formatação incompatível
  ├─ injeta CTA inline quando cta.url existe
  ├─ traduz leadCapture.shouldCapture em pergunta textual
  └─ traduz calendarHash em URL /agendar/<hash>
↓
CTA
  ├─ origem: pipeline central
  ├─ forma no Widget/Link Curto: estrutura/botão
  └─ forma no WhatsApp: texto + URL
↓
Lead Capture
  ├─ origem: leadCapture.shouldCapture
  ├─ forma no Widget/Link Curto: UI/form/estado do chat
  └─ forma no WhatsApp: pergunta textual no fim da resposta
↓
Scheduler
  ├─ origem: calendarHash
  ├─ forma no Widget/Link Curto: calendário/widget
  └─ forma no WhatsApp: link /agendar/<hash>
↓
Resposta final
  ├─ envio pelo provider correto
  ├─ grava outbound
  ├─ atualiza histórico do lead
  └─ registra WA-PARITY-AUDIT
```

---

## 5. Ganhos obtidos

### Paridade de journey stage

A V21 passa a usar o `journeyAnalyzer` do endpoint inteligente. O WhatsApp não calcula jornada por conta própria; ele recebe `journeyStage` do pipeline central e apenas audita/loga esse sinal.

### Paridade de intent detection

A detecção de intenção passa a vir de `sistemaInteligencias.capturarInteligencias(message)` dentro de `/api/process-chat-inteligente`. O WhatsApp recebe `inteligenciasDetectadas` e registra na auditoria.

### Paridade de scheduler

A V21 consome `calendarHash` retornado pelo pipeline. O ganho é compartilhar a mesma detecção de agendamento do Link Curto, mudando apenas a renderização final: calendário no Widget/Link Curto, URL clicável no WhatsApp.

### Paridade de CTA

O WhatsApp passa a consumir `cta` estruturado do pipeline central. Quando há `cta.url`, o canal injeta o link na mensagem final para compensar a ausência de UI de botão no WhatsApp.

### Paridade de lead score

O WhatsApp passa a receber `leadCapture.score` e `leadCapture.shouldCapture` do endpoint inteligente, permitindo auditar se o mesmo score que dispararia captura no Link Curto também foi avaliado no WhatsApp.

---

## 6. Problemas encontrados após deploy

### CTA fantasma

Foi observado um CTA de WhatsApp sendo injetado em respostas do próprio WhatsApp, como se o usuário ainda precisasse “falar com a equipe” por `wa.me`. Isso gerava conflito cognitivo: o usuário já estava conversando no WhatsApp. O commit atual indica a correção V21-FIX-001: remoção desse CTA fantasma que injetava `wa.me` em toda resposta WhatsApp.

Impacto:

- perda de credibilidade;
- ruído comercial;
- falsa sensação de redirecionamento;
- possível duplicidade com CTA real de checkout.

### Captura não disparando

Mesmo com paridade, a captura depende de condições específicas: `leadCapture.shouldCapture`, ausência de `leadId` no body em certos caminhos, `conversationId` consistente e avaliação do chat-first. Se o WhatsApp cria/resgata lead antes da chamada, alguns caminhos podem interpretar que já existe lead suficiente ou não disparar a captura inline esperada.

Impacto:

- conversas avançam sem pedir dados mínimos;
- scheduler pode aparecer sem qualificação adequada;
- CRM fica com lead incompleto.

### Agendamento sem captura

A V21 tentou impor a ordem captura → agendamento no adaptador WhatsApp. Porém, o pipeline central pode retornar `calendarHash` por intenção forte de agendamento, e o canal precisa decidir se mostra link ou adia. Se o lead tiver telefone/wa_phone, o adaptador pode considerar que há dado suficiente e liberar agendamento, mesmo sem e-mail ou nome.

Impacto:

- agendamento pode ocorrer com lead pouco qualificado;
- dados comerciais podem ficar incompletos;
- diferenças com Widget podem aparecer se o Widget exige formulário antes do calendário.

### Diferenças observadas entre canais

- Widget/Link Curto renderiza CTA como botão; WhatsApp renderiza texto.
- Widget/Link Curto pode renderizar calendário; WhatsApp precisa link público.
- Widget pode bloquear envio antes de captura; WhatsApp é conversacional e precisa pedir dados por texto.
- Link Curto já possui contexto direto de URL/página; WhatsApp precisa reconstruir esse contexto via DB.
- WhatsApp tem telefone por natureza; Link Curto pode não ter telefone inicialmente.

---

## 7. Causas-raiz identificadas

### `server.js`

O `server.js` concentra a inteligência real: jornada, intenções, scheduler, CTA, lead capture e camadas V17-V20. A V21 revelou que o WhatsApp só será paritário se o retorno do endpoint central expuser todos os sinais necessários e se esses sinais forem independentes de assumptions específicas do frontend.

Dependências ocultas descobertas:

- `leadCapture` depende de `conversationId`, `leadId` e modo chat-first.
- scheduler depende de `calendarHash` e do estado de captura.
- CTA depende de checkout/pageData/intenção e de camadas V17/V18/V19.
- journey depende de heurística central e não do canal.

### `whatsapp-channel.js`

O canal é responsável por reconstruir contexto que o Link Curto já possui naturalmente. Ele precisa buscar `sales_url`, `robotName`, `instructions`, checkout confirmado e possivelmente `pageData`.

Dependências ocultas descobertas:

- última `short_urls` do tenant pode não representar o contexto desejado da conversa;
- checkout confirmado depende de hash de `salesUrl`;
- `server-utils.extractPageData` pode estar indisponível, empurrando extração para o endpoint;
- `conversationId` precisa ser estável para memória e lead score;
- adaptação final pode criar divergência mesmo quando o pipeline foi paritário.

### Scheduler

O scheduler não é apenas uma intenção; ele depende da renderização por canal. No Widget, o hash pode virar calendário. No WhatsApp, precisa virar URL. A dependência oculta é que o canal precisa respeitar a ordem comercial antes de expor o link.

### Lead Capture

A captura não é somente “pedir nome/e-mail”. Ela depende do score, sinais acumulados, estado do lead e presença/ausência de identificadores. No WhatsApp, o telefone já existe, então a plataforma pode confundir “lead identificado” com “lead capturado”.

---

## 8. Lições aprendidas

### O que a V21 revelou sobre a arquitetura

A V21 revelou que a arquitetura do Link Mágico é fortemente centralizada no endpoint inteligente, mas os canais ainda possuem responsabilidades críticas de adaptação. A inteligência pode ser central, mas a renderização e a ordem comercial continuam sensíveis ao canal.

### Riscos futuros

- Novas flags no `server.js` podem alterar WhatsApp sem tocar em `whatsapp-channel.js`.
- Correções de Widget podem não funcionar no WhatsApp se dependerem de UI.
- Scheduler e captura podem divergir se o retorno estruturado não for suficientemente explícito.
- CTA pode duplicar se existir ao mesmo tempo no texto e em `cta` estruturado.
- O canal pode usar contexto errado se houver múltiplos links/assistentes por tenant.

### Dependências críticas

- estabilidade de `conversationId`;
- consistência de `leadId`;
- retorno estruturado do endpoint inteligente;
- resolução correta de tenant/instância;
- disponibilidade de `sales_url`, `instructions`, `robotName` e checkout;
- regras de adaptação WhatsApp;
- logs de auditoria.

### Pontos que exigem auditoria antes de futuras versões

- CTA duplicado ou fantasma;
- captura antes/depois do scheduler;
- divergência entre `leadId` e `conversationId`;
- resposta com link no texto + `cta.url` simultâneo;
- presença de `calendarHash` sem lead suficiente;
- paridade de intenção entre WhatsApp e Link Curto;
- efeito das flags V17/V18/V19/V20 no WhatsApp.

---

## 9. Mapa de risco

| Componente | Risco | Justificativa |
|---|---:|---|
| WhatsApp | ALTO | Canal depende de provider externo, tenant resolution, adaptação textual, contexto reconstruído e ordem captura/agendamento. |
| Link Curto | MÉDIO | É o caminho mais nativo do pipeline, mas ainda depende de flags e camadas comerciais complexas. |
| Widget | MÉDIO | Possui UI própria para CTA, lead capture e scheduler; risco está em divergência com backend e bloqueios de frontend. |
| Scheduler | ALTO | Depende de intenção, `calendarHash`, renderização por canal e estado de captura. |
| Lead Capture | ALTO | Depende de score, histórico, `leadId`, `conversationId` e diferenças entre telefone capturado e lead qualificado. |
| CTA Engine | ALTO | Afetado por V17/V18/V19, checkout, pageData, fallback e adaptação por canal. |
| Journey Stage | MÉDIO | Centralizado e auditável, mas heurístico; mudanças de prompts/intents podem alterar classificação. |
| V17 | ALTO | Camada ligada à resolução correta de CTA; impacto direto em conversão. |
| V18 | MÉDIO | Fallback/failsafe pode corrigir CTA, mas também pode mascarar causa-raiz. |
| V19 | ALTO | Decisão determinística sobre CTA/resposta; quando ativa, altera comportamento comercial central. |
| V20 | MÉDIO | Tornou bypass observacional, reduzindo risco, mas seus sinais ainda influenciam diagnóstico e evolução futura. |

---

## 10. Conclusão executiva

### A V21 foi bem-sucedida?

Sim, em termos arquiteturais. A V21 atingiu o objetivo principal: fazer o WhatsApp consumir o mesmo endpoint do Link Curto e transformar o canal em transporte/adaptador, não em motor comercial paralelo.

### Quais problemas eram realmente da V21?

Eram problemas da V21 os pontos ligados à adaptação final do WhatsApp:

- CTA fantasma de `wa.me` no próprio WhatsApp;
- tradução de CTA estruturado para texto inline;
- decisão local de quando mostrar ou adiar scheduler;
- interpretação de captura em um canal que já possui telefone.

### Quais problemas já existiam antes?

Já existiam antes da V21 os problemas estruturais de acoplamento e dependências ocultas:

- `server.js` concentra múltiplas camadas comerciais;
- lead capture depende de estado conversacional e identificadores;
- scheduler depende da forma de renderização;
- CTA depende de checkout/pageData/flags;
- canais diferentes possuem capacidades de UI diferentes.

A V21 não criou essas dependências; ela as expôs ao tentar equalizar o WhatsApp com o Link Curto.

### Estado atual do WhatsApp após a V21

O WhatsApp está em estado mais avançado e mais próximo da paridade com Link Curto. O canal:

- recebe webhooks Evolution/Twilio;
- resolve tenant;
- mantém lead/conversa;
- chama `/api/process-chat-inteligente` por padrão;
- possui rollback para `/api/chat-universal`;
- traduz CTA, captura e scheduler para texto WhatsApp;
- registra auditoria de paridade.

O estado atual é funcionalmente melhor que o pré-V21, mas ainda exige auditoria contínua em CTA, lead capture e scheduler, porque esses pontos dependem de sinais estruturados do pipeline central e de decisões de adaptação específicas do canal WhatsApp.
