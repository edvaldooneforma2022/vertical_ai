# MISSÃO 40 — Commercial Event Tracing Implementation

## 1. Arquitetura do tracing

Foi criada uma camada única e aditiva de observabilidade comercial em `lib/commercial-events.js`. Ela não altera regras de venda, CTA Engine, V17, V18, V19, scheduler ou lead logic; apenas normaliza IDs e registra eventos append-only.

### Componentes

- **Commercial Event Layer**: `lib/commercial-events.js`
  - Enumera todos os eventos comerciais mínimos.
  - Normaliza `trace_id`, `conversation_id`, `message_id`, `tenant_id`, `lead_id`, `decision_id`, `cta_id`, `scheduler_session_id` e `appointment_id`.
  - Infere canal (`widget`, `whatsapp`, `short_link`, `api`) sem bloquear o fluxo.
  - Persiste localmente em JSONL (`data/commercial-events.jsonl`) como fallback operacional até a tabela definitiva existir.
- **Instrumentação no backend**: `server.js`
  - `/api/chat-universal`
  - `/api/process-chat-inteligente`
  - `/api/capture-lead`
  - `/api/appointments`
  - `/api/track-event`

### Garantias de desenho

- **Fail-open**: falha na gravação de evento não derruba chat, lead ou scheduler.
- **Append-only**: eventos são evidências históricas, não fonte de decisão.
- **Multi-tenant**: todo evento carrega `tenant_id`; índices propostos usam `tenant_id` como primeira coluna.
- **Correlação fim a fim**: quando o cliente envia IDs, eles são preservados; quando ausentes, a camada gera IDs sintéticos com prefixos rastreáveis.

---

## 2. Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `lib/commercial-events.js` | Nova camada única de eventos comerciais, normalização de contexto, enum de eventos, geração de IDs e persistência JSONL fail-open. |
| `server.js` | Importa a camada de eventos e instrumenta chat, lead capture, scheduler, appointment creation e tracking de clique/conversão. |

---

## 3. Pontos reais de entrada mapeados

### `/api/chat-universal`

- **Arquivo**: `server.js`
- **Onde nasce a conversa**: no caller/frontend; o endpoint recebe `conversationId` no body.
- **Onde nasce o `conversationId` hoje**: principalmente no widget (`public/widget.js`) e em clientes que chamam a API; se não vier, a camada gera `conv_*` apenas para rastreamento observacional.
- **Onde deveria nascer o `traceId`**: no primeiro ponto de borda do canal (widget/short link/WhatsApp/API gateway), antes da chamada HTTP ao backend.
- **Instrumentado**:
  - `chat.message.received`
  - `chat.intent.detected`
  - `sales.decision.made`
  - `sales.cta.created` ou `sales.cta.removed`
  - `chat.response.generated`
  - `chat.response.delivered`

### `/api/process-chat-inteligente`

- **Arquivo**: `server.js`
- **Onde nasce a conversa**: no caller; normalmente widget v2/inline ou integrações.
- **Onde nasce o `conversationId` hoje**: no frontend/canal chamador; se ausente, a camada gera `conv_*` para evidência.
- **Onde deveria nascer o `traceId`**: no canal que recebe a primeira mensagem do usuário.
- **Instrumentado**:
  - `chat.message.received`
  - `chat.intent.detected`
  - `chat.journey.detected`
  - `sales.decision.made`
  - `sales.cta.created` ou `sales.cta.removed`
  - `scheduler.shown`
  - `scheduler.slots.generated`
  - `chat.response.generated`
  - `chat.response.delivered`

### Widget

- **Arquivo principal encontrado**: `public/widget.js`
- **Onde nasce a conversa**: inicialização do widget no browser.
- **Onde nasce o `conversationId` hoje**: `this.conversationId = 'widget_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)`.
- **Onde deveria nascer o `traceId`**: no mesmo momento em que o widget cria `conversationId`, persistido em localStorage/sessionStorage e enviado em todos os payloads como `traceId`.
- **GAP restante**: a missão instrumentou o backend para aceitar/gerar `traceId`; ainda falta propagar explicitamente `traceId` no widget sem alterar UX.

### WhatsApp

- **Arquivos/módulos encontrados**: `whatsapp-integration`, rotas `/api/whatsapp/*` e integrações administrativas em `server.js`/`public/index_app.html`.
- **Onde nasce a conversa**: no inbound webhook/mensagem WhatsApp ou envio administrativo.
- **Onde nasce o `conversationId` hoje**: não há evidência de ID conversacional comercial consistente atravessando todo pipeline; há eventos legados de WhatsApp e integrações.
- **Onde deveria nascer o `traceId`**: no webhook inbound do WhatsApp, derivado de `wamid`/telefone + timestamp, e repassado para o processamento de chat.
- **GAP restante**: instrumentar webhook inbound real quando identificado em produção.

### Link Curto

- **Arquivo/módulo encontrado**: `short-url-generator` importado pelo backend e geração no painel.
- **Onde nasce a conversa**: clique/resolução do link curto que leva o usuário a um chat/página.
- **Onde nasce o `conversationId` hoje**: normalmente após abrir o destino/widget, não no redirect.
- **Onde deveria nascer o `traceId`**: no redirect do link curto, propagado como query param ou storage bootstrap para o widget.
- **GAP restante**: instrumentar a rota de resolução do link curto com `sales.cta.clicked`/`chat.message.received` quando a rota concreta for consolidada.

---

## 4. Mapa completo de execução

Fluxo reconstruído:

```text
Usuário
↓
Mensagem
↓
Intent
↓
Journey
↓
Decision
↓
CTA
↓
Lead
↓
Scheduler
↓
Resposta
```

| Transição | Arquivo | Função/trecho | Linha aproximada | Dados recebidos | Dados produzidos |
|---|---|---|---:|---|---|
| Usuário → Mensagem | `server.js` | handler `/api/chat-universal` | ~8394 | `message`, `pageData`, `url`, `conversationId`, `leadId`, `robotName` | `chat.message.received`, contexto comercial normalizado |
| Usuário → Mensagem | `server.js` | handler `/api/process-chat-inteligente` | ~9180 | `message`, `pageData`, `url`, `conversationId`, `leadId`, `robotName` | `chat.message.received`, contexto comercial normalizado |
| Mensagem → Intent | `server.js` | `detectBuyIntent(message)` em `/api/chat-universal` | ~8440 | texto do usuário | `chat.intent.detected` com `buyIntent` |
| Mensagem → Intent | `server.js` | `sistemaInteligencias.capturarInteligencias(message)` | ~9634 | texto do usuário | `chat.intent.detected` com flags de inteligência |
| Intent → Journey | `server.js` | `journeyAnalyzer.analyzeJourneyStage(message)` | ~9637 | texto + intenção implícita | `chat.journey.detected` com `journeyStage` |
| Journey → Decision | `server.js` | camadas Decision Core / Orchestrator / V18/V19 / final guard | ~9800-10580 | `processedPageData`, intenção, jornada, checkout | `sales.decision.made` com decisão final observada |
| Decision → CTA | `server.js` | V17.2 link resolver / `_intCta` / `_cuCta` | ~10587 e ~9060 | link seguro + intenção | `sales.cta.created` ou `sales.cta.removed` |
| CTA → Lead | `server.js` | `/api/capture-lead` | ~8262 | `nome`, `email`, `telefone`, `conversationId` | `lead.capture.started`, `lead.capture.completed` ou `lead.capture.ignored` |
| Lead → Scheduler | `server.js` | scheduler priority + `/api/appointments` | ~9425 e ~4489 | intenção de agendar, `datetime`, `leadId` | `scheduler.shown`, `scheduler.slots.generated`, `scheduler.slot.selected`, `scheduler.appointment.created` |
| Scheduler → Resposta | `server.js` | retorno JSON do scheduler priority | ~9432 | resposta calendário | `chat.response.generated`, `chat.response.delivered` |
| Resposta final | `server.js` | retorno JSON do chat | ~10618 | `finalResponse`, `cta`, `journeyStage` | `chat.response.generated`, `chat.response.delivered` |
| Clique/Conversão | `server.js` | `/api/track-event` | ~10651 | `conversationId`, `eventType`, `url` | `sales.cta.clicked`, `scheduler.appointment.created`, `lead.capture.completed` |

---

## 5. Eventos implementados

Todos os eventos mínimos foram definidos na camada única:

- `chat.message.received`
- `chat.intent.detected`
- `chat.journey.detected`
- `sales.decision.made`
- `sales.cta.created`
- `sales.cta.modified`
- `sales.cta.removed`
- `chat.response.generated`
- `chat.response.delivered`
- `sales.cta.clicked`
- `lead.capture.started`
- `lead.capture.completed`
- `lead.capture.ignored`
- `scheduler.shown`
- `scheduler.slots.generated`
- `scheduler.slot.selected`
- `scheduler.appointment.created`
- `scheduler.abandoned`

Observação: `sales.cta.modified`, `scheduler.abandoned` foram definidos no contrato para uso pelos pontos de UI/worker ainda não instrumentados. O backend já está preparado para persisti-los via `recordCommercialEvent`.

---

## 6. Correlation IDs

Campos suportados em todo evento:

| Campo | Origem preferencial | Fallback |
|---|---|---|
| `trace_id` | `body.traceId`, `body.trace_id`, header `x-trace-id` | `trace_*` |
| `conversation_id` | `body.conversationId`, `body.conversation_id` | `conv_*` |
| `message_id` | `body.messageId`, `body.message_id` | `msg_*` |
| `tenant_id` | API key validada, session, body/query | `null` se rota não autenticada |
| `lead_id` | `body.leadId`, lead criado/encontrado | `null` |
| `decision_id` | `body.decisionId` ou gerado no ponto de decisão | `decision_*` |
| `cta_id` | `body.ctaId` ou gerado quando CTA final existe | `cta_*` |
| `scheduler_session_id` | `body.schedulerSessionId` | `sched_${conversation_id}` no scheduler |
| `appointment_id` | appointment criado ou `body.appointmentId` | `null` |

---

## 7. Schema final proposto — `commercial_events`

```sql
CREATE TABLE commercial_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  trace_id TEXT NOT NULL,
  conversation_id TEXT,
  message_id TEXT,
  lead_id TEXT,
  decision_id TEXT,
  cta_id TEXT,
  scheduler_session_id TEXT,
  appointment_id TEXT,
  event_type TEXT NOT NULL,
  channel TEXT,
  source TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Índices

```sql
CREATE INDEX idx_commercial_events_tenant_trace_time
  ON commercial_events (tenant_id, trace_id, occurred_at);

CREATE INDEX idx_commercial_events_tenant_conversation_time
  ON commercial_events (tenant_id, conversation_id, occurred_at);

CREATE INDEX idx_commercial_events_tenant_lead_time
  ON commercial_events (tenant_id, lead_id, occurred_at)
  WHERE lead_id IS NOT NULL;

CREATE INDEX idx_commercial_events_tenant_type_time
  ON commercial_events (tenant_id, event_type, occurred_at);

CREATE INDEX idx_commercial_events_tenant_cta_time
  ON commercial_events (tenant_id, cta_id, occurred_at)
  WHERE cta_id IS NOT NULL;

CREATE INDEX idx_commercial_events_payload_gin
  ON commercial_events USING GIN (payload);
```

### Retenção

- **Hot storage**: 90 dias em tabela principal.
- **Warm/archive**: 12 meses em partições mensais ou object storage JSONL/Parquet.
- **Hard delete/anonymização**: por tenant e lead mediante política LGPD; manter métricas agregadas sem PII.

### Estratégia multi-tenant

- `tenant_id` obrigatório na tabela final.
- Todas as queries administrativas devem filtrar por `tenant_id` primeiro.
- Recomendado Row Level Security no Postgres:

```sql
ALTER TABLE commercial_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY commercial_events_tenant_isolation
  ON commercial_events
  USING (tenant_id = current_setting('app.tenant_id'));
```

---

## 8. Prova de funcionamento — simulação "quanto custa?"

Comando executado para provar a camada sem iniciar o servidor:

```bash
node - <<'NODE'
const { CommercialEventTypes, normalizeContext, recordCommercialEvent, buildDecisionId, buildCtaId } = require('./lib/commercial-events');
const ctx = normalizeContext({ body: { traceId: 'trace_m40_demo', conversationId: 'conv_m40_demo', messageId: 'msg_m40_demo', apiKey: 'tenant_m40_demo', leadId: 'lead_m40_demo', channel: 'widget' }, source: 'mission_40_demo' });
ctx.decision_id = buildDecisionId(ctx);
recordCommercialEvent(CommercialEventTypes.CHAT_MESSAGE_RECEIVED, ctx, { message: 'quanto custa?' });
recordCommercialEvent(CommercialEventTypes.CHAT_INTENT_DETECTED, ctx, { intent: 'price', buyIntent: true });
recordCommercialEvent(CommercialEventTypes.CHAT_JOURNEY_DETECTED, ctx, { journeyStage: 'negociacao' });
recordCommercialEvent(CommercialEventTypes.SALES_DECISION_MADE, ctx, { action: 'answer_price_and_offer_cta' });
ctx.cta_id = buildCtaId(ctx);
recordCommercialEvent(CommercialEventTypes.SALES_CTA_CREATED, ctx, { label: 'Finalizar compra', url: 'https://checkout.example/demo' });
recordCommercialEvent(CommercialEventTypes.CHAT_RESPONSE_GENERATED, ctx, { responsePreview: 'O valor é R$97. Para finalizar, clique no botão.' });
recordCommercialEvent(CommercialEventTypes.CHAT_RESPONSE_DELIVERED, ctx, { statusCode: 200 });
console.log('demo trace appended', ctx.trace_id, ctx.conversation_id);
NODE
```

### Trace completo demonstrado

| Ordem | Evento | IDs preservados |
|---:|---|---|
| 1 | `chat.message.received` | `trace_m40_demo`, `conv_m40_demo`, `msg_m40_demo`, `tenant_m40_demo`, `lead_m40_demo` |
| 2 | `chat.intent.detected` | mesmo `trace_id`, `conversation_id`, `message_id`, `decision_id` |
| 3 | `chat.journey.detected` | mesmo `trace_id`, `conversation_id`, `message_id`, `decision_id` |
| 4 | `sales.decision.made` | mesmo `trace_id`, `conversation_id`, `message_id`, `decision_id` |
| 5 | `sales.cta.created` | adiciona `cta_id` |
| 6 | `chat.response.generated` | preserva `cta_id` |
| 7 | `chat.response.delivered` | preserva `cta_id` |

Resultado: Mensagem → Intent → Journey → Decision → CTA → Resposta ficam registráveis por `trace_id` e reconstruíveis em ordem cronológica.

---

## 9. Gaps restantes

1. **Persistência Postgres ainda não aplicada**: a tabela está proposta; implementação atual grava JSONL fail-open para não bloquear esta missão em migração de DB.
2. **Widget não envia `traceId` explicitamente**: backend aceita; frontend ainda deve gerar e propagar.
3. **WhatsApp inbound real precisa de instrumentação no webhook**: pontos administrativos existem, mas o inbound comercial precisa ser identificado/conectado.
4. **Link curto precisa gerar trace no redirect**: backend tem `short-url-generator`, mas a rota de resolução deve propagar `traceId` para o widget/destino.
5. **Eventos definidos mas sem ponto concreto atual**: `sales.cta.modified` e `scheduler.abandoned` dependem de instrumentação de UI/estado de abandono.
6. **Early returns comerciais específicos**: alguns bypasses pré-KB retornam antes do fluxo principal; a camada já existe, mas a cobertura pode ser ampliada para cada bypass com `sales.decision.made` específico.

--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------