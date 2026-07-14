# WIDGET_CAPTURA — Auditoria do sistema de captura de leads do Widget

## 1. Visão geral

O sistema de captura do Widget é o conjunto de rotinas de frontend e backend que transforma visitantes anônimos em leads associados a uma conversa, URL de origem, assistente e, quando possível, histórico retroativo. Ele aparece em três superfícies principais:

1. **Widget embedado moderno (`public/widget.js`)**: captura bloqueante na primeira abertura quando `captureLeads` está ativo e ainda não existe lead restaurado.
2. **Widget v2 (`public/widget-v2.js`)**: captura bloqueante antes de enviar mensagens ou quick replies.
3. **Chatbot/Widget renderizado pelo servidor (`server.js`)**: fluxo `CHAT_FIRST`, que permite conversar primeiro e exibe captura inline quando o backend calcula interesse comercial suficiente via Lead Capture Score.

Objetivo comercial: identificar visitantes com intenção comercial, criar lead no CRM interno, disparar sincronização CRM fire-and-forget e preservar contexto para follow-up, CTA e agendamento.

Diferença para **Link Curto**: o Link Curto é essencialmente roteamento/atribuição de tráfego e conversão por clique; a captura do Widget é conversacional, usa mensagens, intenção, score, jornada e pode vincular histórico ao lead.

Diferença para **WhatsApp**: WhatsApp é canal de contato/CTA detectado ou promovido por outras camadas. A captura do Widget cria lead próprio via `/api/capture-lead`; WhatsApp pode ser campo do lead, CTA primário ou requisito antes de agendamento, mas não substitui automaticamente a criação do lead.

## 2. Componentes envolvidos

| Componente | Arquivo | Função real | Responsabilidade na captura |
|---|---|---|---|
| Widget | `public/widget.js` | `LinkMagicoWidget` | Renderiza widget embedado, estado `leadCaptured/leadId`, formulário `lm-lead-form`, bloqueia envio enquanto não captura, chama `/api/capture-lead`. |
| Widget v2 | `public/widget-v2.js` | `window.LMWidget` | Renderiza chat moderno v2, `leadCaptured=false` inicial, `showLeadForm()`, `captureLead()`, bloqueia `send()` e `quickReply()` até captura. |
| Chat | `server.js` | HTML/JS do chatbot e endpoint `/api/process-chat-inteligente` | Renderiza warming/form/chat, habilita `CHAT_FIRST`, recebe mensagens, devolve `leadCapture` ao frontend e faz sync retroativo. |
| Lead Capture | `server.js` | `POST /api/capture-lead` | Valida API key e email, deduplica por email, cria lead no `LeadSystem`, incrementa analytics e chama CRM sync. |
| Lead Capture | `lib/leads/lead-capture.js` | `LeadCaptureSystem` | Modelo in-memory por tenant: cria, consulta, atualiza conversa, score, jornada e status do lead. |
| Lead Score | `lib/lead-capture-score.js` | `evaluateCapture()` | Mantém score por `conversationId`, soma sinais comerciais, decide `shouldCapture`, `captureContext` e mensagem contextual. |
| Journey Stage | `server.js`; `lib/ai-systems/journey-analyzer.js` | `journeyAnalyzer.analyzeJourneyStage()` | Classifica estágio usado no pipeline de resposta e grava no lead quando há `leadId`; influencia resposta, não é gate direto do Lead Capture Score. |
| CTA Engine | `sales/cta-engine`; `server.js` | `_ctaEngine.getCTA()` / `applyCTA()` | Gera CTA contextual. No chat inteligente, a existência de `_intCta` vira `ctaCandidate` para Lead Capture Score. |
| Scheduler | `server.js` | `detectarAgendamento()`, calendário e `confirmScheduling()` | Agendamento explícito tem prioridade de backend; no frontend, confirmação de horário exige lead ou abre captura específica antes de reservar. |
| V17 | `server.js`; `lib/feature-flags.js`; módulos V17 | Unified Brain Orchestrator | Quando ligado, decide estratégia e pode bypassar pipeline legado em `generateAIResponse`; não controla diretamente Lead Capture Score do chat inteligente. |
| V18 | `server.js`; `lib/v18-extraction-guard.js` | Extraction Guard | Protege qualidade de extração de checkout/WhatsApp; afeta indiretamente captura porque `checkoutCandidate` depende de `processedPageData.checkoutLink`. |
| V19 | `server.js`; `lib/v19-deterministic-engine.js` | Deterministic Decision Engine | Pode assumir decisão comercial/bypassar V18.1-V18.4 e PP-GLOBAL no pipeline, mas não é entrada explícita de `evaluateCapture()`. |
| V20 | `server.js` | Observer da antiga camada 5 | Apenas telemetria comparativa; não intercepta nem decide captura. |

## 3. Fluxo completo encontrado

Fluxo real do **Chat First**:

```text
Visitante abre chatbot
↓
Chat inicia direto (SKIP_WARMING=true; CHAT_FIRST=true por padrão)
↓
Visitante envia mensagem
↓
/api/process-chat-inteligente processa IA/pipeline comercial
↓
Backend calcula jornada, inteligências, CTA, checkout e resposta final
↓
Lead Capture Score avalia mensagem se CHAT_FIRST e não há leadId
↓
Resposta volta com { leadCapture }
↓
Frontend renderiza resposta
↓
Se leadCapture.shouldCapture=true, showInlineCapture() exibe formulário inline
↓
Visitante preenche nome + WhatsApp ou email
↓
POST /api/capture-lead
↓
Se sucesso: leadId global, inlineCaptured=true, sync retroativo via /api/link-conversation
```

Fluxo real do **Widget embedado (`public/widget.js`)**:

```text
Visitante abre widget
↓
Se captureLeads=true e lead não restaurado do localStorage
↓
showLeadForm() exibe formulário e oculta input
↓
Usuário informa nome (email/telefone opcionais no frontend)
↓
POST /api/capture-lead
↓
Se API OK: armazena leadId no localStorage, marca leadCaptured=true e libera chat
↓
Se API falha: marca leadCaptured=true mesmo assim para não bloquear conversa
```

Fluxo real do **Widget v2**:

```text
Visitante clica quick reply ou tenta enviar mensagem
↓
Se !leadCaptured, showLeadForm() e retorno sem enviar
↓
Nome obrigatório no frontend; email/telefone opcionais
↓
POST /api/capture-lead
↓
Se sucesso: leadId e leadCaptured=true
↓
Se erro: leadCaptured=true mesmo assim
```

## 4. Tipos de captura mapeados

| Tipo solicitado | Existe? | Gatilho real |
|---|---:|---|
| Captura inicial | Sim | `public/widget.js`: ao abrir chat se `captureLeads && !leadCaptured`; `public/widget-v2.js`: antes da primeira mensagem/quick reply. |
| Captura contextual | Sim | `CHAT_FIRST`: `showInlineCapture(captureMessage)` com mensagem contextual vinda de `lead-capture-score`. |
| Captura por score | Sim | `session.score >= 50`, ou compra/READY_TO_BUY, ou checkout/CTA candidate. |
| Captura antes de CTA | Parcial | Se o CTA Engine gerou `_intCta`, isso vira `ctaCandidate=true` e dispara captura inline; a resposta com CTA ainda é enviada, então a captura não bloqueia o CTA. |
| Captura antes de agendamento | Sim | `confirmScheduling()` exige lead antes de reservar: se não há `leadId`, renderiza `schedCaptureForm`. |
| Captura após objeções | Sim, limitada | `dcIntent='objection'` adiciona 5 pontos; sozinha não atinge threshold. Pode capturar se combinada com outros sinais. |
| Captura após interesse | Sim | `curioso` vira `dcIntent='interest'` e soma 25; com CTA candidate ou perguntas comerciais alcança captura. |

## 5. Formulário

### `public/widget.js`

HTML renderizado dentro de `lm-chat-messages`:

- Título: “Para melhor atendê-lo, informe seus dados:”
- `lm-lead-name`: texto, placeholder “Seu nome *”, `required`.
- `lm-lead-email`: email, placeholder “Seu melhor email”, sem `required` no HTML atual.
- `lm-lead-phone`: telefone, placeholder “WhatsApp (opcional)”.
- Botão `lm-lead-submit`: “Continuar conversa →”.

Validação real no frontend: somente nome é obrigatório. O endpoint, porém, exige email; logo, há acoplamento perigoso: o frontend permite email vazio, mas o backend responde 400. Em falha de API, o frontend libera a conversa mesmo assim.

### `public/widget-v2.js`

HTML inline em `lm-lead-prompt`:

- `lmLeadName`: “Qual o seu nome?”, `required`.
- `lmLeadEmail`: “Seu melhor email”, `required` no HTML.
- `lmLeadPhone`: “WhatsApp (opcional)”.
- Botão: “Continuar conversa”.

Validação real no JS: somente nome é checado; email pode ser vazio apesar do `required` HTML, porque o clique chama função manual e não submit nativo.

### Chat First (`server.js`)

Formulário legado `leadForm`:

- Nome completo.
- Email obrigatório no JS.
- WhatsApp opcional.

Captura inline:

- Nome.
- WhatsApp.
- Email opcional.
- Botões “Registrar contato” e “Continuar sem informar”.
- Validação real: exige WhatsApp ou email. Se email estiver vazio e WhatsApp preenchido, envia `email:'Não informado'`, contornando a exigência backend de email não vazio.

Captura de agendamento:

- Nome.
- WhatsApp obrigatório.
- Email opcional.
- Botão “Confirmar Agendamento”.
- Validação real: WhatsApp obrigatório; email pode ir como “Não informado”.

## 6. Lead Score

Regras reais em `lib/lead-capture-score.js`:

- Threshold global: `CAPTURE_THRESHOLD = 50`.
- Estado por sessão: `score`, `signals`, `messageCount`, `captured`, `dismissed`, `captureShown`, TTL de 1 hora.
- Se `captured` ou `dismissed`, não captura novamente.
- `captureShown` impede repetir a exibição após primeiro disparo.
- Despedidas e agradecimentos bloqueiam disparo mesmo com score.

Principais pontuações:

| Sinal | Pontos |
|---|---:|
| `intent_buy` | 50 |
| `v13_ready_to_buy` | 50 |
| `detection_purchase_intent` | 50 |
| `detection_high_interest` | 80, definido mas não usado no código atual |
| `cta_click` | 40 |
| `checkout_candidate` | 40 |
| `cta_candidate` | 35 |
| `question_price` | 30 |
| `question_hiring` | 30 |
| `intent_interest` / `v13_interest` | 25 |
| `question_plan` | 25 |
| `question_implementation` | 20 |
| `intent_human` / `v13_doubt` / `question_integration` / `question_whatsapp` | 15 |
| `intent_info` / `question_support` / `messages_5` | 10 |
| `intent_objection` | 5 |
| `messages_10` | 20 |

`shouldCapture` verdadeiro quando não é despedida, ainda não mostrou captura, e ao menos uma condição ocorre:

- score acumulado >= 50;
- `dcIntent === 'buy'`;
- `v13Result.intent === 'READY_TO_BUY'`;
- `checkoutCandidate === true`;
- `ctaCandidate === true`.

`captureContext` real:

- `purchase`: compra ou READY_TO_BUY.
- `post_sale`: pós-venda.
- `support`: humano/suporte.
- `evaluation`: interesse comercial.
- `consultive`: informação/dúvida.
- `default`: fallback.

## 7. Relação com CTA

No Chat First, a ordem real é: resposta e CTA são calculados primeiro; depois o Lead Capture Score roda como “observer only”. Porém o resultado do CTA entra na decisão de captura como `ctaCandidate: !!_intCta`. Assim:

- **CTA → Captura** existe: CTA candidate dispara captura inline.
- **Captura → CTA** não bloqueia nem reordena o CTA: a resposta final já volta com `cta` e texto; o formulário aparece 800 ms depois da resposta.
- Prioridade prática: CTA/pipeline comercial decide antes; captura observa e pode pedir contato depois.

No widget embedado bloqueante, a captura inicial tem prioridade sobre qualquer CTA porque o usuário nem envia mensagem antes de preencher ou ocorrer fallback.

## 8. Relação com agendamento

Backend: agendamento explícito tem prioridade absoluta no endpoint inteligente. A detecção `detectarAgendamento(message)` roda antes de KB/inteligências/IA e retorna calendário com `journeyStage:'agendamento'`. Isso vence a captura por score daquele ciclo porque há `return res.json(...)` antes da avaliação Lead Capture Score do fluxo principal.

Frontend: ao confirmar horário, o Scheduler exige lead válido. Se não há `leadId`, renderiza `schedCaptureForm`, captura lead via `/api/capture-lead`, faz sync retroativo e só então chama `/api/public/book/:hash`.

Conclusão: **Scheduler vence no backend para intenção explícita de agenda; Captura vence no frontend antes de confirmar reserva**.

## 9. Relação com Journey Stage

Estágios observados/solicitados:

| Estágio | Captura pode ocorrer? | Regra real |
|---|---|---|
| Descoberta | Sim | Perguntas informativas somam pouco; captura só ocorre se score acumular ou houver CTA/checkout candidate. |
| Consideração | Sim | Interesse, preço, planos, implementação e integração aumentam score; combinação costuma atingir 50. |
| Negociação | Sim | Compra/contratação/checkout disparam imediatamente por intenção de compra ou checkout candidate. |
| Compra | Sim | `intencao_compra` vira `dcIntent='buy'`, score 50 e contexto `purchase`. |
| Agendamento | Sim, por fluxo próprio | Backend retorna calendário antes do score; captura ocorre na confirmação se não houver lead. |

Observação: Journey Stage influencia resposta e atualização do lead, mas o Lead Capture Score do Chat First recebe `dcIntent`, `inteligencias`, CTA e checkout; não recebe `journeyStage` diretamente.

## 10. Dependências ocultas

1. `FEATURE_CHAT_FIRST` é default true se não for explicitamente `false`; isso muda o modelo de captura de formulário inicial para inline.
2. `SKIP_WARMING=true` no HTML do chat pula warming e também pula formulário legado.
3. `public/widget.js` e `public/widget-v2.js` aceitam email vazio, mas `/api/capture-lead` exige email.
4. Captura inline manda email “Não informado” quando só há telefone; isso satisfaz a validação backend, mas cria leads com email artificial.
5. `showInlineCapture()` marca `inlineCaptured=true` ao dispensar, mas não chama `markDismissed()` no backend; o score server-side pode continuar com `captureShown=true` sem conhecer a dispensa formal.
6. `markCaptured()` e `markDismissed()` existem no score, mas não foram encontrados ligados ao endpoint de captura/dispensa.
7. `leadCaptured=true` em catch nos widgets evita bloqueio, mas pode mascarar falha de captura.
8. `localStorage` restaura lead em `public/widget.js`, porém o Chat First usa variável de sessão JS separada.
9. CTA Engine influencia captura por `ctaCandidate`, embora captura seja descrita como observer.
10. Scheduler reutiliza `/api/capture-lead`, então qualquer mudança na validação de lead afeta agendamento.
11. V18 altera confiabilidade/checkout/WhatsApp e pode impactar `checkoutCandidate` indiretamente.
12. O estado do score é in-memory e expira em 1 hora; reinício do servidor perde contexto de captura.

## 11. Matriz de decisão

| Mensagem | Intent derivado | Journey provável | Sinais/score | Captura? |
|---|---|---|---|---|
| “quanto custa?” | info | consideração | `intent_info` 10 + `question_price` 30 = 40 | Não, salvo CTA candidate. |
| “quero comprar” | buy | compra | `intent_buy` 50 + compra detectada 50 | Sim. |
| “tem planos mensais?” | info | consideração | 10 + `question_plan` 25 = 35 | Não isoladamente. |
| “qual valor e como assinar?” | buy/info | negociação | preço 30 + contratação 30 >= 60 | Sim. |
| “posso integrar por API?” | info | consideração | 10 + integração 15 = 25 | Não isoladamente. |
| “quero falar com humano” | human | suporte | `intent_human` 15 | Não isoladamente. |
| “me chama no WhatsApp” | human/info | suporte | humano 15 + WhatsApp 15 = 30 | Não isoladamente. |
| “tenho interesse” | interest | consideração | `intent_interest` 25 | Não isoladamente. |
| “tenho interesse, quais planos?” | interest | consideração | 25 + plano 25 = 50 | Sim. |
| “isso é caro” | objection | negociação | objeção 5 | Não isoladamente. |
| “está caro, mas quero assinar” | buy/objection | negociação | compra 50 + objeção 5 | Sim. |
| “como implementar?” | info | consideração | 10 + implementação 20 = 30 | Não isoladamente. |
| “como implementar e quanto custa?” | info | consideração | 10 + implementação 20 + preço 30 = 60 | Sim. |
| “quero agendar” | agendamento | agendamento | Scheduler intercepta antes do score | Não inline; captura antes de confirmar horário. |
| “marcar reunião amanhã” | agendamento | agendamento | Scheduler intercepta | Captura só na confirmação se sem lead. |
| “me manda o checkout” | buy | compra | compra + checkout candidate se houver link | Sim. |
| “onde clico para pagar?” | buy | compra | compra 50 | Sim. |
| “tem suporte?” | info/support | descoberta | 10 + suporte 10 = 20 | Não isoladamente. |
| “já comprei e preciso ajuda” | post_sale | suporte | pós-venda 30 + suporte 10 = 40 | Não isoladamente. |
| “já comprei, quero falar com atendimento” | post_sale/human | suporte | pós-venda 30 + humano 15 = 45 | Não, salvo CTA/WA candidate. |
| “me explica melhor” | info | descoberta | 10 | Não. |
| “qual o preço do plano anual?” | info | consideração | 10 + preço 30 + plano 25 = 65 | Sim. |
| “contratar agora” | buy | compra | compra/contratação | Sim. |
| “tchau obrigado” | goodbye | saída | guard de despedida | Não. |
| “obrigado” | goodbye | saída | guard de agradecimento | Não. |
| “tem desconto?” | info/negociação | negociação | sem regex específica de desconto, pode depender de inteligências/CTA | Incerto; não por score puro. |
| “qual prazo para começar?” | info | consideração | 10 + implementação 20 = 30 | Não isoladamente. |
| “quero o link” com CTA gerado | interest/buy | compra | `ctaCandidate=true` | Sim. |
| “mais detalhes” com CTA gerado | interest | consideração | `ctaCandidate=true` | Sim. |
| “finalizar compra” com checkout detectado | buy | compra | buy + checkoutCandidate | Sim. |
| 5ª mensagem sem interesse | info/default | descoberta | `messages_5` 10 + talvez info 10 | Não. |
| 10ª mensagem sem interesse | info/default | descoberta | `messages_5` 10 + `messages_10` 20 | Não sem outros sinais. |
| 10ª mensagem + preço anterior | info | consideração | acumulado pode ultrapassar 50 | Sim se ainda não mostrou. |
| “quero suporte sobre uso” | human/info | suporte | suporte 10 + humano 15 | Não isoladamente. |
| “continuar depois” | interest | consideração | depende de intent; mensagem contextual é evaluation/default se score >= 50 | Talvez. |

## 12. Mapa de risco

| Componente | Risco | Motivo |
|---|---|---|
| `/api/capture-lead` | ALTO | Ponto central; validação de email afeta widgets, Chat First, scheduler e CRM sync. |
| `lib/lead-capture-score.js` | ALTO | Decide captura inline; estado in-memory e thresholds impactam conversão. |
| Chat First HTML/JS em `server.js` | ALTO | Mistura renderização, captura inline, sync retroativo, scheduler e envio de mensagens. |
| Scheduler em `server.js` | ALTO | Bypass backend + captura obrigatória frontend antes de reserva. |
| `public/widget.js` | ALTO | Widget embedado em sites externos; captura bloqueante e fallback que libera sem lead. |
| `public/widget-v2.js` | MÉDIO | Captura bloqueante simples; validação divergente de backend. |
| CTA Engine | MÉDIO | `ctaCandidate` pode disparar captura mesmo sem score alto. |
| Journey Analyzer | MÉDIO | Não decide captura diretamente, mas altera jornada do lead e tom da resposta. |
| V18 Extraction Guard | MÉDIO | Pode mudar presença de checkout/WhatsApp e influenciar `checkoutCandidate`. |
| V17 Brain | MÉDIO | Pode bypassar pipeline em rotas de IA; impacto direto no score do Chat First é limitado. |
| V19 Deterministic | MÉDIO | Pode alterar intent/CTA comercial, mas não entra diretamente no Lead Capture Score atual. |
| V20 Observer | BAIXO | Apenas telemetria; não intercepta captura. |
| `/api/link-conversation` | MÉDIO | Preserva histórico pré-captura; falha não bloqueia, mas reduz qualidade do lead. |
| LocalStorage do widget | BAIXO | Restaura lead em embed; risco de leadId antigo/compartilhado no navegador. |

## 13. Conclusão executiva

O Widget captura leads de duas formas: **bloqueante** nos widgets embedados (`public/widget.js` e `public/widget-v2.js`) e **conversacional inline** no Chat First renderizado pelo servidor. A captura bloqueante aparece antes da conversa; a inline aparece depois que a IA/pipeline detecta interesse comercial suficiente.

Captura quando:

- widget embedado abre ou usuário tenta enviar mensagem sem lead;
- Lead Capture Score atinge 50 pontos;
- há intenção de compra, READY_TO_BUY, CTA candidate ou checkout candidate;
- usuário confirma agendamento sem lead;
- fluxo legado exige email antes de iniciar chat.

Não captura quando:

- `captureLeads` está desativado;
- lead já foi restaurado/capturado;
- captura inline já foi mostrada;
- mensagem é despedida/agradecimento;
- score não atinge threshold e não há CTA/checkout/buy trigger;
- Scheduler intercepta intenção de agenda no backend antes do Lead Capture Score, deixando captura para a confirmação.

Módulos que controlam a captura:

- `public/widget.js` e `public/widget-v2.js` para bloqueio e formulários embedados;
- `server.js` para HTML do Chat First, endpoint inteligente, scheduler, `/api/capture-lead` e `/api/link-conversation`;
- `lib/lead-capture-score.js` para score/threshold/contexto;
- `lib/leads/lead-capture.js` para persistência in-memory do lead por tenant;
- CTA Engine, V18 e Scheduler como influenciadores indiretos ou prioritários.

Antes de qualquer alteração futura, auditar obrigatoriamente:

1. `/api/capture-lead` e validações de email/telefone;
2. `showInlineCapture()` e `confirmScheduling()` no HTML gerado por `server.js`;
3. `evaluateCapture()` e seus thresholds;
4. `public/widget.js` e `public/widget-v2.js` para divergências frontend/backend;
5. CTA Engine e V18 se a alteração afetar checkout/CTA;
6. Scheduler se a alteração tocar agendamento, telefone obrigatório ou leadId.
