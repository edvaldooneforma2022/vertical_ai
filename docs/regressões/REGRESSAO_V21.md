# Regressão V21 — Auditoria técnica da paridade WhatsApp ↔ Link Curto

## Escopo

Este documento audita a implementação da **V21** da plataforma SaaS Link Mágico, com foco no canal WhatsApp e na migração do processamento de mensagens para o mesmo pipeline usado pelo Link Curto: `/api/process-chat-inteligente`.

Evidências usadas:

- Commit base da V21: `b7b7257` — `V21 PARITY: WhatsApp consome mesmo endpoint do Link Curto (/api/process-chat-inteligente)`.
- Commit corretivo pós-deploy: `eeecc18` — `V21-FIX-001: Remover CTA fantasma que injetava wa.me em TODA resposta WhatsApp`.
- Diff auditado: `git diff b7b7257^..HEAD -- whatsapp-channel.js lib/wa-parity-audit.js`.
- Arquivos impactados pela V21: `whatsapp-channel.js` e `lib/wa-parity-audit.js`.

> Observação: esta auditoria não propõe correções. O objetivo é documentar comportamento, regressões, regressões aparentes e dependências ocultas.

---

## Resumo executivo

A V21 alterou a responsabilidade do WhatsApp: o canal deixou de consumir diretamente o endpoint legado `/api/chat-universal` e passou a consumir, por padrão, `/api/process-chat-inteligente`, o mesmo endpoint usado pelo Link Curto. A intenção arquitetural foi transformar o WhatsApp em canal de transporte puro, delegando decisões comerciais — intenção, etapa de jornada, CTA, captura e agendamento — ao pipeline central.

A alteração trouxe ganho de paridade, mas também expôs no WhatsApp sinais e pós-processamentos que antes estavam restritos ao fluxo do Link Curto/widget. O principal efeito colateral observado no próprio histórico foi a injeção de link de WhatsApp de contato em respostas do canal WhatsApp, registrada e corrigida no commit `eeecc18` como `V21-FIX-001`.

A V21 também ampliou dependências internas: tenant precisa ter dados coerentes em `short_urls`, `checkout_links`, dados extraídos do site e comportamento esperado do endpoint `/api/process-chat-inteligente`. Qualquer instabilidade do pipeline central agora impacta diretamente o WhatsApp.

---

## Linha do tempo

```text
ANTES DA V21
↓
WhatsApp processava mensagens via /api/chat-universal.
O canal já resolvia tenant, lead, conversationId, fazia rate limit, logava inbound/outbound,
injetava CTA retornado por aiResult.cta e também podia injetar contatos.whatsappLink.

DEPLOY V21
↓
WhatsApp passa a chamar _callUnifiedBrain(), com feature flag WA_USE_FULL_PIPELINE.
Por padrão, WA_USE_FULL_PIPELINE=true direciona para /api/process-chat-inteligente.
O payload passa a buscar paridade com Link Curto: message, apiKey, conversationId, leadId,
url, robotName, instructions, pageData e context.checkoutLink.
Entram traduções explícitas de sinais do pipeline central: leadCapture.shouldCapture,
calendarHash, cta, journeyStage e inteligenciasDetectadas.
Entra módulo observacional lib/wa-parity-audit.js.

PROBLEMAS OBSERVADOS
↓
1. CTA fantasma de WhatsApp: respostas no WhatsApp recebiam "Fale com a equipe: wa.me/...".
2. Mudança de comportamento percebida no WhatsApp por adoção de pós-processadores do endpoint inteligente.
3. Maior acoplamento operacional a extração, checkout confirmado, billing/auth interno e regras de Link Curto.
4. Agendamento e captura passam a aparecer no WhatsApp por tradução de sinais do pipeline central.

DIAGNÓSTICO
↓
A regressão confirmada foi causada pela permanência de lógica legada de injeção de contato WhatsApp
em um contexto onde o lead já está dentro do WhatsApp. O restante das diferenças é majoritariamente
resultado esperado da paridade: sinais que já existiam no process-chat-inteligente ficaram visíveis no canal WhatsApp.

CONCLUSÃO
↓
A V21 não alterou server.js nem os motores centrais; alterou o consumidor WhatsApp.
A regressão funcional comprovada foi introduzida/amplificada pela combinação entre o novo pipeline central
e a lógica antiga de adaptação inline do WhatsApp. Regressões aparentes decorrem da exposição de sinais centrais
que antes não chegavam ao WhatsApp.
```

---

## O que existia antes da V21

Antes da V21, o canal WhatsApp já possuía as seguintes responsabilidades:

1. Receber webhooks da Evolution API e Twilio.
2. Responder rapidamente ao webhook para evitar reenvios.
3. Ignorar eventos que não fossem mensagens, mensagens enviadas pelo próprio número e grupos.
4. Extrair telefone, nome e texto da mensagem.
5. Resolver tenant pela instância ou número.
6. Aplicar rate limit por telefone.
7. Resolver ou criar lead por telefone.
8. Criar ou reaproveitar `conversationId`.
9. Registrar mensagens inbound/outbound.
10. Atualizar histórico do lead.
11. Respeitar `channelMode=off`, notificando apenas o dono.
12. Chamar o backend por HTTP interno usando `/api/chat-universal`.
13. Adaptar Markdown/HTML para formato aceitável no WhatsApp.
14. Injetar CTA textual quando `aiResult.cta.url` existia.
15. Injetar link de contato de WhatsApp quando `aiResult.contatos.whatsappLink` ou `aiResult.contatos.whatsappLinks[0]` existia.

O método responsável pelo processamento remoto era `_callChatUniversal`, direcionado para `/api/chat-universal`. O payload incluía `channel: 'whatsapp'`, além de `message`, `apiKey`, `conversationId`, `leadId`, `url`, `robotName`, `instructions`, `pageData` e `context.checkoutLink`.

---

## O que foi alterado pela V21

### 1. Mudança arquitetural do canal

O cabeçalho e os comentários do arquivo foram atualizados de `Link Mágico V8.0` / `WA-CHANNEL-001` para `Link Mágico V21` / `WA-CHANNEL-002`, explicitando o princípio **Canal ≠ Inteligência**.

A nova regra documentada no código é que o WhatsApp apenas transporta mensagens: recebe, resolve tenant, chama o cérebro unificado e entrega resposta. Decisões comerciais passam a vir do pipeline central.

### 2. Novo módulo de auditoria de paridade

Foi criado `lib/wa-parity-audit.js`, módulo observacional que registra em `console.log` dados como:

- mensagem;
- canal;
- `conversationId`;
- `leadId`;
- `journeyStage`;
- intenções detectadas;
- lead score;
- CTA disparado;
- captura disparada;
- agendamento disparado;
- fonte da resposta;
- preview da resposta;
- indicação se a resposta deveria equivaler ao Link Curto.

O próprio módulo declara que é de observação pura e sem efeito colateral.

### 3. Feature flag de rollback

A V21 introduziu `WA_USE_FULL_PIPELINE`:

- `WA_USE_FULL_PIPELINE=true` ou ausente: usa `/api/process-chat-inteligente`.
- `WA_USE_FULL_PIPELINE=false`: usa `/api/chat-universal`.

Como o valor padrão é `process.env.WA_USE_FULL_PIPELINE !== 'false'`, o deploy sem variável explícita ativa o pipeline completo.

### 4. Troca do endpoint chamado pelo WhatsApp

O processamento automático/manual deixou de chamar `_callChatUniversal(...)` e passou a chamar `_callUnifiedBrain(...)`.

Internamente, `_callUnifiedBrain` seleciona o endpoint:

- `/api/process-chat-inteligente` quando `WA_USE_FULL_PIPELINE` está ativo;
- `/api/chat-universal` quando a flag está desativada.

### 5. Payload alinhado ao Link Curto

A V21 passa a montar payload descrito como idêntico ao Link Curto:

- `message`;
- `apiKey`;
- `conversationId`;
- `leadId`;
- `url`;
- `robotName`;
- `instructions`;
- `pageData` enriquecido;
- `context.checkoutLink` quando houver checkout confirmado.

A diferença relevante é que o campo `channel: 'whatsapp'`, antes enviado ao `/api/chat-universal`, foi removido do body. O canal continua marcado somente por header `X-Internal-Channel: whatsapp`.

### 6. Tradução de sinais do pipeline central

A V21 adicionou uma camada de tradução no WhatsApp para sinais retornados por `/api/process-chat-inteligente`:

- `aiResult.cta.url` vira CTA inline textual.
- `aiResult.leadCapture.shouldCapture` vira pergunta textual de captura.
- `aiResult.calendarHash` vira URL `/agendar/{calendarHash}`.
- `aiResult.journeyStage`, `aiResult.inteligenciasDetectadas` e `aiResult.leadCapture.score` passam a ser logados na auditoria de paridade.

### 7. Correção pós-deploy V21-FIX-001

O commit `eeecc18` removeu a injeção de `contatos.whatsappLink` no WhatsApp. A justificativa no próprio código é que o lead já está no WhatsApp, e adicionar “Fale com a equipe: wa.me/...” em toda resposta causava perda de credibilidade e conflito cognitivo.

---

## Arquivos impactados

| Arquivo | Tipo de impacto | Evidência |
|---|---|---|
| `whatsapp-channel.js` | Alteração funcional principal. Troca de endpoint, feature flag, tradução de sinais, auditoria e remoção do CTA fantasma de WhatsApp. | `git diff b7b7257^..HEAD -- whatsapp-channel.js` |
| `lib/wa-parity-audit.js` | Novo arquivo observacional. Loga telemetria de paridade WhatsApp ↔ Link Curto. | `git diff b7b7257^..HEAD -- lib/wa-parity-audit.js` |
| `server.js` | Não foi alterado pela V21 auditada, mas passa a ser dependência direta do WhatsApp por expor `/api/process-chat-inteligente`. | `rg -n "/api/process-chat-inteligente|leadCapture|calendarHash|cta" server.js` |

---

## Comportamentos que mudaram

### WhatsApp passa a herdar o pipeline do Link Curto

Antes, o WhatsApp recebia saída do `/api/chat-universal`. Depois, por padrão, recebe saída do `/api/process-chat-inteligente`.

Esse endpoint central possui múltiplas camadas que podem alterar resposta final:

- extração automática de `pageData` quando incompleto;
- preservação/injeção de checkout;
- WA CTA promoter;
- V18 extraction guard;
- V19 deterministic decision engine;
- hard buy intent override;
- prioridade de agendamento;
- interceptores pré-KB;
- pós-processadores globais anti-perda de venda;
- context enforcement;
- final output guard + V17.2 link resolver;
- channel resolver;
- lead capture score;
- telemetria de bypass V20.

Portanto, uma mensagem no WhatsApp agora pode ser afetada por regras que originalmente foram desenhadas para o Link Curto/widget.

### Sinais comerciais passam a ser traduzidos no canal

O WhatsApp deixou de depender apenas do texto `response`. Agora ele também interpreta campos estruturados do resultado:

- CTA;
- captura de lead;
- agendamento;
- etapa de jornada;
- inteligência detectada;
- score de captura.

### Agendamento deixa de ser apenas resposta textual

Quando o endpoint central retorna `calendarHash`, o WhatsApp monta uma URL pública de agendamento baseada em `BASE_URL`, `RENDER_EXTERNAL_URL` ou fallback `https://linkmagico.app.br`.

### Captura deixa de ser invisível no WhatsApp

Quando `leadCapture.shouldCapture=true`, o WhatsApp adiciona ao texto a `captureMessage` retornada pelo pipeline central.

### CTA de WhatsApp de contato foi removido

A lógica antiga de inserir `📱 Fale com a equipe: {waLink}` foi removida após observação de regressão.

---

## Sinais que passaram a vir do `process-chat-inteligente`

A partir da V21, o WhatsApp passa a consumir e/ou auditar os seguintes sinais retornados pelo endpoint central:

| Sinal | Origem no endpoint central | Uso no WhatsApp |
|---|---|---|
| `response` | Resposta final do pipeline superinteligente | Texto base adaptado para WhatsApp |
| `cta` | V17.2 Link Resolver / guard final | Injeção inline do CTA com label e URL |
| `calendarHash` | Detecção/prioridade de agendamento | Conversão em URL `/agendar/{hash}` |
| `inteligenciasDetectadas` | Sistema de inteligências do pipeline | Auditoria de paridade |
| `analiseEmocional` | SuperInteligência emocional | Não altera o texto no WhatsApp; compõe resposta/telemetria central |
| `journeyStage` | Jornada detectada pelo pipeline | Auditoria e log final |
| `leadCapture` | Chat First / Lead Capture Score | Tradução para pergunta de captura e auditoria |
| `bonuses_detected` | Extração/pageData | Permanece dado de retorno do endpoint; não é traduzido diretamente pelo WhatsApp |
| `contatos` | Dados extraídos do site | Antes alimentava CTA fantasma; após V21-FIX-001 não é mais injetado como link de contato no WhatsApp |
| `metadata` | Metadados do endpoint | Não usado diretamente pelo canal |

---

## Comportamentos que permaneceram iguais

Mesmo após a V21, permaneceram iguais no canal WhatsApp:

1. Registro das rotas `/api/webhook/evolution` e `/api/webhook/twilio`.
2. ACK imediato para webhooks.
3. Filtro de eventos não suportados.
4. Ignorar mensagens `fromMe`.
5. Ignorar grupos.
6. Normalização de telefone.
7. Extração de `PushName`.
8. Rate limit por telefone.
9. Resolução de tenant pela instância.
10. Resolução/criação de lead por telefone.
11. Uso do `conversationId` do lead quando existente, preservando memória omnichannel.
12. Log de mensagens inbound e outbound.
13. Atualização do histórico do lead.
14. Respeito ao modo `off`.
15. Fallback “Recebi sua mensagem! Em breve retornaremos.” quando a IA não retorna resposta.
16. Envio pela mesma instância Evolution que recebeu a mensagem.
17. Adaptação básica do texto para WhatsApp.
18. Timeout de IA em 30 segundos.

---

## Regressões observadas após o deploy

### Regressão 1 — CTA fantasma de WhatsApp em respostas do próprio WhatsApp

**Sintoma**

Respostas enviadas pelo canal WhatsApp passaram a incluir link de contato do próprio WhatsApp, por exemplo:

```text
📱 Fale com a equipe: https://wa.me/...
```

O problema é semântico: o lead já estava falando no WhatsApp. A resposta parecia redirecionar o usuário para outro WhatsApp ou repetir um canal já em uso.

**Causa raiz**

A lógica legada de adaptação do canal continuou ativa após a troca para o pipeline central. Antes, o canal injetava `aiResult.contatos.whatsappLink` ou `aiResult.contatos.whatsappLinks[0]` como CTA auxiliar. Com a V21, o endpoint central passou a fornecer contatos extraídos do Link Curto/site com mais consistência, amplificando a frequência dessa injeção.

O commit `eeecc18` removeu essa injeção e documentou a causa no próprio código: o lead já está no WhatsApp e a inserção destruía credibilidade/causava conflito cognitivo.

**Arquivos envolvidos**

- `whatsapp-channel.js` — bloco de adaptação da resposta para WhatsApp e injeção de CTA/links.
- `server.js` — fornecedor indireto do campo `contatos` no retorno do endpoint central.

**Fluxo afetado**

```text
Evolution/Twilio webhook
→ _processIncomingMessage
→ _callUnifiedBrain
→ /api/process-chat-inteligente
→ retorno com contatos.whatsappLink
→ adaptação WhatsApp
→ injeção indevida de link wa.me
→ _sendResponse
```

**Impacto comercial**

Alto em conversas de venda e suporte. O lead recebe uma orientação redundante ou confusa, reduz confiança, aumenta atrito e pode abandonar o funil por parecer automação mal configurada.

**Risco de correção**

Baixo. A correção remove apenas a injeção de link de contato WhatsApp no canal WhatsApp e mantém CTA de checkout (`aiResult.cta.url`). O risco residual é deixar de expor um WhatsApp alternativo de suporte quando ele seria útil; porém, no canal WhatsApp o contexto primário já é conversacional.

**Dependências ocultas relacionadas**

- Estrutura `contatos` retornada pelo endpoint central.
- Extração de contatos em `pageData`.
- WA CTA promoter e Channel Resolver podem continuar influenciando o texto base antes da adaptação.
- Diferença entre CTA de checkout e link de contato.

**Classificação**

Problema **introduzido/amplificado pela V21**. A lógica existia antes, mas a V21 mudou a fonte para um pipeline que retorna mais sinais e contatos, tornando a falha visível no canal.

---

### Regressão 2 — Mudança perceptível de tom e decisão no WhatsApp

**Sintoma**

O WhatsApp pode responder com tom, CTAs, captura, objeções, suporte ou agendamento de forma diferente do comportamento anterior ao deploy.

**Causa raiz**

A fonte de decisão mudou de `/api/chat-universal` para `/api/process-chat-inteligente`. O novo endpoint tem camadas adicionais de decisão e pós-processamento: V18, V19, V15, V17.2, lead capture score, prioridade de agendamento e pós-processador global.

**Arquivos envolvidos**

- `whatsapp-channel.js` — troca `_callChatUniversal` por `_callUnifiedBrain`.
- `server.js` — implementação do endpoint `/api/process-chat-inteligente` e suas camadas.

**Fluxo afetado**

```text
Mensagem WhatsApp
→ _callUnifiedBrain
→ /api/process-chat-inteligente
→ camadas de decisão do Link Curto
→ resposta final diferente da resposta pré-V21
```

**Impacto comercial**

Médio a alto. Quando a nova decisão é melhor, aumenta paridade e conversão. Quando é inesperada para o operador do WhatsApp, pode parecer regressão por fugir do comportamento anterior.

**Risco de correção**

Alto se a correção tentar alterar o pipeline central, pois afetaria Link Curto e widget. Baixo/moderado se a mudança for apenas de configuração via `WA_USE_FULL_PIPELINE=false`, mas isso reverte o objetivo de paridade da V21.

**Dependências ocultas relacionadas**

- Feature flags do servidor: V15, V18, V19, V12, Chat First, auto-checkout.
- Dados extraídos do site.
- Checkout confirmado no banco.
- Estado de conversa e memória `conversationId`.
- Billing/auth middlewares do endpoint central.

**Classificação**

Majoritariamente **regressão aparente** quando o comportamento é apenas diferente por desenho. Pode virar regressão real se a decisão central estiver errada para o contexto WhatsApp.

---

### Regressão 3 — Captura de lead duplicada ou deslocada no WhatsApp

**Sintoma**

O WhatsApp pode adicionar uma pergunta de captura ao final de respostas quando `leadCapture.shouldCapture=true`, mesmo que o canal já tenha criado um lead automático com nome/telefone.

**Causa raiz**

O canal cria lead automaticamente por telefone, mas a captura do pipeline central está orientada a qualificação de lead do fluxo Link Curto. A condição adicionada na V21 verifica `!lead?.email_captured`, não necessariamente se já existem telefone, nome, `wa_phone` ou lead criado pelo WhatsApp.

**Arquivos envolvidos**

- `whatsapp-channel.js` — criação automática do lead e tradução de `leadCapture.shouldCapture`.
- `server.js` — cálculo de `leadCapture` via Lead Capture Score.

**Fluxo afetado**

```text
Webhook WhatsApp
→ _resolveLeadByPhone cria/resolve lead com telefone
→ /api/process-chat-inteligente avalia leadCapture
→ WhatsApp adiciona captureMessage se !lead.email_captured
```

**Impacto comercial**

Médio. A pergunta pode ser útil para enriquecer lead, mas pode soar redundante se a conversa já traz nome/telefone pelo canal.

**Risco de correção**

Médio. Qualquer ajuste na condição de captura precisa preservar a ordem esperada do Link Curto e não quebrar a qualificação de leads sem email.

**Dependências ocultas relacionadas**

- Convenção de `email_captured`.
- Lead criado automaticamente com `email: 'Não informado'`.
- `wa_phone` e `telefone` como prova parcial de captura.
- Score e thresholds do Chat First.

**Classificação**

Problema **amplificado pela V21**. A captura central já existia, mas passou a ser traduzida no WhatsApp.

---

### Regressão 4 — Agendamento adiado ou exibido de forma diferente no WhatsApp

**Sintoma**

Mensagens com intenção de agendamento podem gerar URL `/agendar/{hash}` ou ter o agendamento adiado até que a captura aconteça.

**Causa raiz**

A V21 traduz `calendarHash` para URL clicável no WhatsApp. Porém, a regra local tenta preservar a ordem “captura → agendamento”: se houver `calendarHash`, mas o pipeline também pedir captura e o lead não tiver dados suficientes, o canal adia o link de agenda.

Como leads de WhatsApp normalmente têm telefone e `wa_phone`, a variável `hasLeadData` tende a ser verdadeira após `_resolveLeadByPhone`, o que pode fazer o agendamento aparecer imediatamente em muitos casos.

**Arquivos envolvidos**

- `whatsapp-channel.js` — tradução de `calendarHash` e regra de adiamento.
- `server.js` — geração de `calendarHash` no fluxo de agendamento.

**Fluxo afetado**

```text
Usuário pede agendamento
→ /api/process-chat-inteligente detecta agendamento e retorna calendarHash
→ WhatsApp monta BASE_URL/agendar/hash
→ dependendo de leadCapture e hasLeadData, envia ou adia
```

**Impacto comercial**

Médio. Exibir agenda corretamente pode aumentar conversão; adiar ou exibir fora de ordem pode gerar atrito ou perda de intenção quente.

**Risco de correção**

Médio/alto. Ajustar essa ordem sem quebrar a paridade com Link Curto exige entender a estratégia de captura antes de agenda.

**Dependências ocultas relacionadas**

- `BASE_URL` / `RENDER_EXTERNAL_URL`.
- Existência de hash público no `schedulingManager`.
- Estado de lead no WhatsApp.
- `leadCapture.shouldCapture`.

**Classificação**

Regressão **aparente ou amplificada**, dependendo do caso. A mudança é esperada pela V21, mas pode parecer erro se o WhatsApp antes não exibia calendário.

---

### Regressão 5 — Dependência nova do endpoint inteligente e de middlewares centrais

**Sintoma**

Quando `/api/process-chat-inteligente` falha, demora ou rejeita a chamada, o WhatsApp cai no fallback genérico ou não entrega resposta inteligente.

**Causa raiz**

A V21 moveu o WhatsApp para o endpoint que usa `requireApiKey` e `billingMiddleware`, além de extração, IA e múltiplas camadas de decisão. Embora a chamada interna envie `apiKey` no body, o canal agora depende da compatibilidade desse endpoint com chamadas internas.

**Arquivos envolvidos**

- `whatsapp-channel.js` — chamada HTTP interna para endpoint central.
- `server.js` — rota `/api/process-chat-inteligente` com middlewares e pipeline completo.

**Fluxo afetado**

```text
WhatsApp inbound
→ HTTP interno 127.0.0.1:{PORT}/api/process-chat-inteligente
→ requireApiKey / billingMiddleware / pipeline central
→ resposta ou erro/timeout
```

**Impacto comercial**

Alto se houver falha sistêmica, pois todo atendimento automático do WhatsApp depende do endpoint central por padrão.

**Risco de correção**

Alto se a correção mexer em autenticação/billing global. Moderado se for tratada por feature flag operacional.

**Dependências ocultas relacionadas**

- `PORT` correto no runtime.
- `apiKey` válido no body.
- Middlewares aceitarem chamada interna.
- Limites de billing.
- Latência da extração de página.
- Timeout fixo de 30 segundos.

**Classificação**

Problema **introduzido pela V21** como acoplamento arquitetural, mesmo que não seja bug quando tudo está saudável.

---

## Regressões apenas aparentes

### Aparente 1 — WhatsApp agora retorna CTA de checkout com mais frequência

A V21 passa a usar o V17.2 Link Resolver e outros pós-processadores do endpoint central. Se o usuário demonstra intenção de compra, receber CTA é comportamento esperado de paridade, não regressão por si só.

### Aparente 2 — Resposta do WhatsApp ficou mais parecida com Link Curto

Essa é a meta explícita da V21. Diferenças em relação ao comportamento antigo não são automaticamente regressões; são regressões somente quando quebram o contexto conversacional do WhatsApp ou reduzem conversão.

### Aparente 3 — Auditoria gerando logs extensos

`lib/wa-parity-audit.js` apenas escreve logs e declara não alterar resposta, intenção, CTA ou fluxo. O aumento de log é custo observacional, não regressão funcional, salvo impacto operacional por volume de logs.

### Aparente 4 — Agendamento em formato de link

No Link Curto o calendário pode ser renderizado visualmente. No WhatsApp, a tradução para URL clicável é necessária por limitação do canal.

---

## Problemas pré-existentes

1. **Injeção de `contatos.whatsappLink` já existia no canal antes da V21.** A V21 não criou a lógica original; ela a tornou mais danosa ao alimentar o canal com sinais do endpoint central.
2. **Acoplamento a dados de `short_urls` e `checkout_links` já existia no WhatsApp pré-V21.** O canal já buscava `sales_url`, `robot_name`, `instructions` e checkout confirmado.
3. **Extração por `server-utils.extractPageData` já era best-effort.** Se o módulo/função não estivesse disponível, o endpoint faria extração por URL.
4. **Lead automático com `email: 'Não informado'` já existia.** Isso contribui para ambiguidades de captura, mas não foi criado pela V21.
5. **Timeout de 30 segundos já existia.** A V21 aumentou a chance de acionar timeout por usar endpoint mais pesado, mas o mecanismo é pré-existente.

---

## Problemas introduzidos pela V21

1. **Acoplamento padrão do WhatsApp ao `/api/process-chat-inteligente`.** O canal agora depende do pipeline completo, middlewares e feature flags centrais.
2. **Tradução local de `leadCapture` e `calendarHash`.** O WhatsApp passou a adicionar conteúdo próprio derivado de sinais estruturados.
3. **Remoção do campo body `channel: 'whatsapp'`.** O canal permanece no header, mas qualquer lógica que dependesse do body perde esse indicador.
4. **Auditoria de paridade em runtime.** Não altera resposta, mas adiciona custo de log e mais exposição de dados em console.
5. **Default de feature flag favorece pipeline completo.** Sem configuração explícita, o comportamento novo fica ativo.

---

## Problemas amplificados pela V21

1. **CTA fantasma de WhatsApp.** Lógica pré-existente amplificada por retorno mais rico de `contatos` no endpoint inteligente.
2. **Latência/fallback por endpoint pesado.** Timeout pré-existente fica mais relevante porque `/api/process-chat-inteligente` executa mais camadas que `/api/chat-universal`.
3. **Ambiguidade de captura de lead.** Lead automático por telefone já existia; `leadCapture.shouldCapture` torna a lacuna de `email_captured` mais visível.
4. **Dependência de checkout correto.** A V21 centraliza decisões em checkout confirmado/processado, ampliando impacto de dados incorretos em `checkout_links` ou `pageData`.

---

## Matriz consolidada de regressões

| Regressão | Tipo | Sintoma | Causa raiz | Impacto comercial | Risco de correção |
|---|---|---|---|---|---|
| CTA fantasma `wa.me` | Real, confirmada | “Fale com a equipe” dentro do próprio WhatsApp | Lógica legada de contato + sinais centrais | Alto | Baixo |
| Tom/decisão diferente | Aparente/condicional | Resposta diferente do pré-V21 | Troca de endpoint e camadas centrais | Médio/alto | Alto |
| Captura redundante | Amplificada | Pergunta de captura mesmo com lead por telefone | `!lead.email_captured` como critério | Médio | Médio |
| Agendamento diferente | Aparente/amplificada | Link `/agendar` ou adiamento | Tradução de `calendarHash` + ordem captura/agenda | Médio | Médio/alto |
| Fallback por falha central | Arquitetural | Resposta genérica ou ausência de IA | Dependência do endpoint inteligente | Alto | Alto |

---

## Conclusão

A V21 cumpriu a mudança arquitetural proposta: o WhatsApp passou a consumir o mesmo cérebro do Link Curto. A regressão material comprovada foi a injeção de link de WhatsApp de contato dentro do próprio canal WhatsApp, corrigida por `V21-FIX-001`.

As demais alterações observadas decorrem principalmente da nova paridade: o canal começou a receber e traduzir sinais que já existiam no `/api/process-chat-inteligente`, como CTA, captura, agendamento, jornada e intenções. Isso explica por que alguns problemas parecem regressões, mas são mudanças esperadas de comportamento.

O principal risco técnico remanescente é o aumento de acoplamento: qualquer comportamento, instabilidade ou feature flag do pipeline central passa a afetar diretamente o WhatsApp. A V21 não mudou o `server.js`, mas mudou a superfície de impacto do `server.js` sobre o canal WhatsApp.
