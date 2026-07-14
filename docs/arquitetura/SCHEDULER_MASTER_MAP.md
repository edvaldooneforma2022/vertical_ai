# SCHEDULER_MASTER_MAP — Link Mágico

Documento técnico baseado no código real do repositório. Escopo: Scheduler, Scheduling Manager, Appointment System, Calendar System, CTA, Lead Capture, Journey/Intent, WhatsApp, Widget, Link Curto, Decision Core e Observer Layer.

## 1. Visão geral

O Scheduler é o conjunto de mecanismos que transforma uma intenção explícita de agendamento em calendário visual, slots públicos e criação de appointment. No fluxo principal, ele nasce em `superInteligencia.detectarAgendamento(message)`, que retorna uma resposta com o marcador `[CALENDAR_WIDGET]`. O backend adiciona `calendarHash`; os widgets usam esse hash para buscar slots e postar o booking.

**Objetivo comercial:** reduzir fricção para leads que querem marcar reunião, call, consulta ou horário, convertendo intenção de conversa em compromisso registrado.

**Objetivo técnico:** manter o calendário desacoplado do core de IA: `scheduling-manager.js` gerencia disponibilidade/hash/slots, enquanto `server.js` decide quando emitir o marcador e expõe as rotas públicas/privadas.

**Papel no funil conversacional:** quando a mensagem contém intenção explícita de agendamento, o Scheduler tem prioridade antes de KB/IA e posiciona o usuário em `journeyStage: agendamento`. Na UI, o calendário aparece dentro da conversa; no WhatsApp, o sinal vira URL de agendamento.

**Papel no pipeline V17-V20:** o Scheduler é um interceptador pré-KB e, portanto, pode bypassar KB, inteligências e LLM antes das camadas V17-V20 de decisão/CTA. Quando o fluxo principal gera `[CALENDAR_WIDGET]`, `CALENDAR-006` injeta `calendarHash` antes da resposta JSON final, depois de várias camadas de CTA/Decision/Orchestrator/V19.

## 2. Todos os componentes envolvidos

| Componente | Arquivo | Função | Responsabilidade | Dependências |
|---|---|---|---|---|
| Scheduler | `server.js` | `detectarAgendamento()`, `gerarOpcoesAgendamento()` | Detecta frases explícitas e emite `[CALENDAR_WIDGET]`. | `superInteligencia`, request de chat, `schedulingManager` para hash. |
| Scheduling Manager | `scheduling-manager.js` | `SchedulingManager` | Disponibilidade, datas bloqueadas, slots públicos, hash público e resolução de hash. | `crypto`, `database.js`, tabelas `api_keys`, `tenant_availability`, `tenant_blocked_dates`, opcional `appointments`. |
| Appointment System | `server.js`, `database.js` | `LeadCaptureSystem.addAppointment()`, `DatabaseHelpers.saveAppointment()` | Persiste agendamentos em memória/JSON e PostgreSQL/SQLite. | `tenant_appointments`, JSON por tenant, `DatabaseHelpers`. |
| Calendar System | `server.js`, widgets | `/api/availability`, `/api/public/availability/:hash`, `/api/public/book/:hash`, renderização do widget | Converte hash em slots e cria booking público. | `schedulingManager`, `getLeadSystem(apiKey)`, widgets. |
| CTA Engine | `server.js`, `sales/cta-engine` se disponível | `getCTA()`, `applyCTA()` | Coleta/aplica CTA em modo `auto`; pode ser orquestrado. | feature flags `FEATURE_SMART_CTA`, Orchestrator V10. |
| Lead Capture | `server.js`, `lib/lead-capture-score.js` | `/api/capture-lead`, `evaluateCapture()` | Captura lead antes ou durante booking; no Chat First é observer score. | `conversationId`, `leadId`, CRM sync, widgets. |
| Journey Stage | `server.js`, `journey-analyzer` | `analyzeJourneyStage()` e retorno JSON | Classifica estágio; Scheduler early força `agendamento`. | mensagem, leadSystem. |
| Intent Detection | `server.js`, `lib/v13-intent-classifier.js`, `lib/v17-orchestrator.js`, `lib/v19-deterministic-engine.js` | múltiplas camadas | Compra/suporte/preço/neutral etc.; agendamento usa detector próprio de frases. | message, processedPageData, state. |
| WhatsApp | `whatsapp-channel.js` | `_callUnifiedBrain()`, `_adaptForWhatsApp()` e tradução de sinais | Chama o pipeline central; traduz `calendarHash` para `/agendar/:hash` quando permitido. | lead, provider, Evolution/Twilio, `BASE_URL`. |
| Widget | `public/widget.js`, `public/widget-v2.js`, `public/widget-inline-generator.js` | `addMessage()`, `renderCalendarWidget()`, `_fetchSlots`, booking | Renderiza `[CALENDAR_WIDGET]`, captura/deriva `calendarHash`, busca slots e agenda. | backend `/api/chat-universal` ou equivalente, `/api/public/*`, Web Crypto fallback. |
| Link Curto | `server.js` inline widget | HTML/JS de chat do link curto | Renderiza calendário, exige lead antes do booking e usa `/api/capture-lead`. | `currentApiKey`, `leadId`, `/api/link-conversation`, `/api/public/book`. |
| Decision Core | `server.js`, `lib/decision-core.js`, `lib/v19-deterministic-engine.js` | `buildDecision()`, `applyDecisionCoreSafe()`, `applyDecision()` | Decide venda/CTA/checkout; não decide Scheduler early. | processedPageData, feature flags, orchestrator. |
| Observer Layer | `server.js`, `whatsapp-channel.js`, auditorias | logs `[AUDIT-LLM-BYPASS]`, `[PIPELINE-DIAG]`, `[AUDIT-LLM-BYPASS-V20]`, WA audit | Observa sem bloquear: billing, logs, lead score, auditoria de parity. | console/logger, billing, leadCaptureScore. |

## 3. Fluxo global do agendamento

Fluxo real encontrado:

```text
Mensagem do usuário
↓
SCHED-PRIORITY executa superInteligencia.detectarAgendamento(message) antes do KB-FIRST
↓
Se frase explícita: gerarOpcoesAgendamento() retorna texto + [CALENDAR_WIDGET]
↓
Backend gera calendarHash com schedulingManager.generatePublicHash(apiKey)
↓
Resposta JSON: response, calendarHash, journeyStage="agendamento", metadata.method="scheduling-priority"
↓
Widget detecta [CALENDAR_WIDGET]
↓
Widget usa calendarHash ou calcula/busca fallback
↓
GET /api/public/availability/:hash resolve apiKey e retorna slots
↓
Usuário escolhe dia/hora
↓
Se Link Curto inline e sem leadId: captura lead antes
↓
POST /api/public/book/:hash cria appointment via getLeadSystem(apiKey).addAppointment()
↓
Confirmação visual/textual no canal
```

No fluxo principal, se alguma camada posterior produzir `[CALENDAR_WIDGET]`, o backend injeta `mainFlowCalendarHash` antes da resposta final.

## 4. Detecção de agendamento

### `detectarAgendamento()`

A implementação ativa em `server.js` é fraseada e evita palavras soltas. Ela exige expressões como `quero agendar`, `agendar reunião`, `marcar horário`, `ver horários` ou `disponibilidade de horário`. Ao detectar, chama `gerarOpcoesAgendamento()`.

Existe também uma versão em `lib/ai-systems/emocional.js`, mais ampla, que cita palavras como `agendar`, `marcar`, `reunião`, `consulta`, `horário`. Os testes `test-kb-fixes.js` documentam a regressão corrigida: palavras genéricas não devem disparar agendamento.

### `scheduling-priority`

Em `server.js`, `SCHED-PRIORITY-001` roda antes de KB-FIRST. Se detecta agendamento, faz bypass total de KB/inteligências/IA, atualiza conversa do lead se houver lead, registra billing, gera `calendarHash` e retorna imediatamente.

### `calendarHash`

Nasce no backend com `schedulingManager.generatePublicHash(apiKey)`. É consumido por widgets e WhatsApp. No Scheduler early, é enviado no JSON. No fluxo principal, só é emitido se `finalResponse` contém `[CALENDAR_WIDGET]`.

### Scheduler intercept

O intercept fica antes de KB-FIRST. Quem consome a saída são os canais: widget/link curto renderizam calendário; WhatsApp converte hash em URL.

## 5. Calendar Hash

| Etapa | Código real | Observação |
|---|---|---|
| Geração | `generatePublicHash(apiKey)` | `sha256("calendar_" + apiKey).hex().substring(0,16)`. |
| Persistência | Não há persistência específica do hash | Hash é determinístico; persiste indiretamente porque depende da `apiKey` ativa. |
| Resolução | `resolveApiKeyFromHash(publicHash)` | Varre `api_keys` ativas e compara hashes gerados. |
| Validação | Rotas públicas retornam 404 se hash não resolve | `/api/public/availability/:hash` e `/api/public/book/:hash`. |
| Uso widget | `calendarHash` da resposta, `/api/availability` fallback ou Web Crypto local | Widget evita expor apiKey real no endpoint público. |
| Uso WhatsApp | monta `${BASE_URL}/agendar/${calendarHash}` | Apenas se captura não bloquear a exibição. |

Evidência funcional: `scheduling-manager.js` gera e resolve hash; `server.js` injeta hash; widgets leem/calculam; WhatsApp traduz para link.

## 6. Link Curto

O Link Curto usa o chat inline embutido em `server.js`. Quando recebe `[CALENDAR_WIDGET]`, chama `addCalendarWidget()`, usa `getCalendarHash()` e busca `/api/public/availability/:hash`. Na confirmação, há regra explícita `SCHED-LEAD-001`: todo agendamento exige lead válido. Se `leadId` ainda não existe, a UI injeta formulário inline com nome, WhatsApp obrigatório e email opcional; chama `/api/capture-lead`; atualiza `leadId`; sincroniza mensagens pré-captura por `/api/link-conversation`; só então chama `/api/public/book/:hash`.

Prioridade real: no Link Curto, a captura bloqueia o booking, mas não bloqueia a exibição inicial do calendário; bloqueia a confirmação final.

## 7. Widget

`public/widget.js`, `public/widget-v2.js` e `public/widget-inline-generator.js` seguem a mesma arquitetura:

1. Enviam a mensagem ao backend.
2. Se a resposta contém `calendarHash`, guardam em variável/estado local.
3. Se a resposta contém `[CALENDAR_WIDGET]`, renderizam calendário visual.
4. Se falta hash, tentam obter por `/api/availability?apiKey=...` ou calcular no cliente com SHA-256.
5. Buscam slots por `/api/public/availability/:hash`.
6. Confirmam em `/api/public/book/:hash`.

No `public/widget.js`, o comentário indica que o widget envia `pageData` para permitir que o Decision Engine identifique corretamente intent de agendamento; sem `pageData`, o backend poderia não injetar `[CALENDAR_WIDGET]`.

## 8. WhatsApp

O WhatsApp não renderiza calendário. `whatsapp-channel.js` chama o pipeline central e adapta a resposta. Regras específicas:

- CTA do pipeline é injetado inline como texto/link.
- `[CALENDAR_WIDGET]` é removido/substituído na adaptação textual.
- Se `aiResult.calendarHash` existe e a mensagem ainda não contém `/agendar/`, o canal monta URL pública `BASE_URL/agendar/:calendarHash`.
- A regra de paridade V21 diz que agendamento só aparece após captura: se lead não tem email/telefone/wa_phone e `leadCapture.shouldCapture` está ativo, o agendamento é adiado.
- Captura no WhatsApp é tradução do sinal `leadCapture.shouldCapture`; o canal não decide captura por conta própria.

Observação de risco: o código monta `/agendar/:hash`, mas a busca por rota mostra endpoints públicos `/api/public/*`; não foi encontrada rota Express `/agendar/:hash` no trecho pesquisado.

## 9. Relação com Lead Capture

### Captura → Scheduler

No Link Curto, a captura é pré-requisito para concluir o booking. O usuário pode escolher slot, mas `confirmScheduling()` interrompe e pede contato se não houver `leadId`. Após captura, agenda.

### Scheduler → Captura

O Scheduler early pode exibir calendário antes da captura. A captura entra no momento de confirmação no Link Curto ou, no WhatsApp, antes de mostrar a URL quando `leadCapture.shouldCapture` está ativo.

### Prioridade, interrupção e bloqueio

- **Quem possui prioridade na detecção?** Scheduler early antes de KB/IA.
- **Quem interrompe quem?** No backend, Scheduler interrompe KB/IA. No frontend Link Curto, Lead Capture interrompe o booking final.
- **Quem bloqueia quem?** Lead Capture bloqueia confirmação de agendamento sem lead no Link Curto; no WhatsApp bloqueia/adia o link se o pipeline pediu captura e o lead não tem dados.

## 10. Relação com CTA Engine

- **CTA antes do Scheduler:** não ocorre no caminho `scheduling-priority`, pois o retorno é imediato antes do bloco de CTA Engine.
- **Scheduler antes do CTA:** sim, no early path, Scheduler tem prioridade absoluta.
- **Coexistência:** no fluxo principal, uma resposta pode passar por CTA/Orchestrator/Decision e ainda conter `[CALENDAR_WIDGET]`; nesse caso `CALENDAR-006` injeta `calendarHash` depois.
- **Conflitos:** Decision Core/V19 podem remover ou injetar CTAs/checkout, mas não há regra equivalente removendo `[CALENDAR_WIDGET]`; portanto o risco é indireto: camadas que substituam `finalResponse` podem apagar o marcador antes de `CALENDAR-006`.

## 11. Relação com Journey Stage

Tabela baseada no código encontrado. O único estágio forçado pelo Scheduler é `agendamento`. Para demais estágios, não há matriz explícita bloqueando Scheduler; a permissão depende de `detectarAgendamento()`.

| Journey Stage | Scheduler permitido? | Scheduler recomendado? | Scheduler bloqueado? | Evidência real |
|---|---:|---:|---:|---|
| `agendamento` | Sim | Sim | Não | Early return define `journeyStage: 'agendamento'`. |
| `descoberta` | Sim se frase explícita | Não há regra dedicada | Não encontrado | Detector roda antes de stage. |
| `interesse`/`curioso` | Sim se frase explícita | Não há regra dedicada | Não encontrado | Detector independe de stage. |
| `consideracao` | Sim se frase explícita | Não há regra dedicada | Não encontrado | Sem matriz por stage. |
| `negociacao` | Sim se frase explícita | Não há regra dedicada | Não encontrado | Sem bloqueio. |
| `decisao`/buyer | Sim se frase explícita | Não há regra dedicada | Não encontrado | Sem bloqueio. |
| `suporte` | Sim se frase explícita | Não há regra dedicada | Não encontrado | Agendamento não consulta intent de suporte. |
| `sair`/exit | Sim se frase explícita | Não há regra dedicada | Não encontrado | Early path ocorre antes das regras V20/V19. |
| `N/A` | Sim se frase explícita | Não há regra dedicada | Não encontrado | Early path não depende de stage prévio. |

## 12. Relação com Intent Detection

Intenções que ativam Scheduler são frases explícitas do detector próprio: `quero agendar`, `gostaria de marcar`, `agendar reunião`, `marcar consulta`, `ver horários`, `disponibilidade de horário` etc.

Intenções que não ativam por si só: compra, preço, suporte, WhatsApp, telefone, falar com alguém, curiosidade, objeção e saída, salvo se a frase também contiver expressão explícita de agendamento.

Prioridade real: o detector de agendamento roda antes de KB-FIRST e antes das camadas V17-V20; portanto, se o texto bater em uma frase de agendamento, o intent comercial posterior não tem chance de alterar a decisão nesse request.

## 13. Diferenças entre canais

| Funcionalidade | Link Curto | Widget | WhatsApp |
|---|---|---|---|
| Scheduler | Renderiza calendário inline via `[CALENDAR_WIDGET]`. | Renderiza calendário visual. | Não renderiza; traduz para link. |
| `calendarHash` | Obtém por `getCalendarHash()` e usa APIs públicas. | Usa resposta `calendarHash`, fallback `/api/availability`, fallback Web Crypto. | Usa `aiResult.calendarHash` para URL `/agendar/:hash`. |
| Captura | Obrigatória antes de confirmar booking. | Depende do widget/config; booking pode enviar campos/leadId. | Captura textual antes do link se `leadCapture.shouldCapture`. |
| CTA | Links viram botões/anchors com tracking. | URLs viram CTA button com tracking. | CTA vira texto inline. |
| Contexto | Usa `currentApiKey`, `sessionConversationId`, `leadId`. | Usa config, conversationId, leadId, pageData. | Usa phone, lead, conversationId e provider. |
| Persistência | `/api/capture-lead`, `/api/link-conversation`, `/api/public/book`. | `/api/public/book` e estado local. | Persistência depende do pipeline central e lead do WhatsApp; scheduling via URL externa. |

## 14. Dependências ocultas

- Hash público depende de `api_keys.key_value` ativo; se a key não estiver na tabela, rotas públicas não resolvem o hash.
- `getPublicSlots()` consulta `appointments`, mas o booking público salva em `tenant_appointments`/JSON via `LeadCaptureSystem.addAppointment()`. Isso sugere possível divergência na checagem de slots ocupados.
- Widgets possuem fallback de cálculo client-side do hash; isso acopla frontend ao algoritmo exato `sha256("calendar_" + apiKey).substring(0,16)`.
- WhatsApp gera URL `/agendar/:hash`, mas a rota encontrada é `/api/public/availability/:hash` e `/api/public/book/:hash`; a página `/agendar/:hash` não apareceu na busca direta.
- `CALENDAR-006` depende de string literal `[CALENDAR_WIDGET]`; qualquer alteração de marcador quebra hash/renderização.
- Lead Capture bloqueia booking no Link Curto por regra frontend, não pela rota pública: `/api/public/book/:hash` aceita booking sem leadId e com nome/email não informados.

## 15. Matriz de decisão

Decisão real inferida das regras de frases explícitas de `detectarAgendamento()`:

| Mensagem | Intent predominante provável | Journey Stage antes | Scheduler? | Motivo real |
|---|---|---|---:|---|
| Quero uma demonstração. | interesse/human | qualquer | Não | Não contém frase explícita de agendamento. |
| Quero marcar uma reunião. | agendamento | qualquer | Sim | Contém `quero marcar` e `marcar reunião`. |
| Quero falar com vendas. | suporte/human | qualquer | Não | `falar` não dispara após KB-SCHED-001. |
| Quero conversar com um especialista. | human/suporte | qualquer | Não | Sem frase de agendamento. |
| Quero agendar agora. | agendamento | qualquer | Sim | Contém `quero agendar`. |
| Gostaria de uma apresentação. | interesse | qualquer | Não | Sem `gostaria de agendar/marcar`. |
| Gostaria de agendar uma apresentação. | agendamento | qualquer | Sim | Contém `gostaria de agendar`. |
| Quero marcar call. | agendamento | qualquer | Sim | Contém `quero marcar`/`marcar call`. |
| Como agendar horário? | agendamento | qualquer | Sim | Contém `como agendar` e `agendar horário`. |
| Ver horários disponíveis. | agendamento | qualquer | Sim | Contém `ver horários`. |
| Tem WhatsApp? | suporte/contato | qualquer | Não | WhatsApp não dispara agendamento. |
| Me chama no telefone. | contato | qualquer | Não | Telefone não dispara agendamento. |
| Preciso de suporte. | suporte | qualquer | Não | Sem frase de agenda. |
| Quero comprar. | buy | qualquer | Não | Compra não é agendamento. |
| Quero o preço. | price | qualquer | Não | Preço não é agendamento. |
| Quero agendar uma consulta. | agendamento | qualquer | Sim | Contém `quero agendar` e `agendar consulta`. |
| Posso agendar? | agendamento | qualquer | Sim | Contém `posso agendar`. |
| Disponibilidade de horário? | agendamento | qualquer | Sim | Contém `disponibilidade de horário`. |
| Quero escolher horário. | agendamento | qualquer | Sim | Contém `escolher horário`. |
| Quero marcar uma demo. | agendamento | qualquer | Sim | Contém `quero marcar`/`marcar uma`. |
| Agendar vídeo com a equipe. | agendamento | qualquer | Sim | Contém `agendar vídeo`. |
| Marcar reunião amanhã. | agendamento | qualquer | Sim | Contém `marcar reunião`. |
| Preciso falar com alguém. | human | qualquer | Não | Não há frase explícita de agenda. |
| Pode me ligar? | contato | qualquer | Não | Sem agendamento. |
| Quero uma call. | interesse/human | qualquer | Não | `call` isolado não está na lista. |
| Quero agendar call. | agendamento | qualquer | Sim | Contém `agendar call`. |

## 16. Mapa de risco

| Componente | Risco | Justificativa |
|---|---|---|
| `server.js` SCHED-PRIORITY | ALTO | Ordem antes do KB/IA define bypass e retorno JSON. |
| `scheduling-manager.js` hash/resolução | ALTO | Quebra hash invalida calendário público e WhatsApp. |
| Rotas `/api/public/*` | ALTO | São caminho único para slots/booking público. |
| Link Curto inline scheduler | ALTO | Possui regra crítica de captura antes do booking. |
| `public/widget.js` calendário | ALTO | Widget principal renderiza marcador e faz booking. |
| `whatsapp-channel.js` tradução V21 | MÉDIO/ALTO | Canal não agenda diretamente; depende do link e da rota `/agendar`. |
| CTA Engine/Orchestrator/V19 | MÉDIO | Pode substituir resposta e apagar marcador. |
| Lead Capture Score | MÉDIO | No WhatsApp pode adiar link; no chat-first observa e sinaliza. |
| Appointment JSON/Postgres | MÉDIO | Persistência dupla e possível divergência. |
| `database.js` tabelas | MÉDIO | Schema de appointments/short_urls/api_keys sustenta o fluxo. |
| Tests/diagnósticos | BAIXO/MÉDIO | Documentam regressões, mas não protegem todos os canais. |

## 17. Histórico de regressões

Evidências em comentários/testes:

- **KB-SCHED-001:** antes, palavras soltas como `whatsapp`, `telefone`, `falar` disparavam agendamento; agora exige frases explícitas.
- **SCHED-PRIORITY-001:** KB-FIRST interceptava `quero agendar` por causa de match genérico em `quero`; o detector foi movido antes do KB-FIRST e faz bypass total.
- **CALENDAR-001/CALENDAR-006:** inicialmente apenas o caminho `SCHED-PRIORITY` retornava `calendarHash`; se o fluxo principal gerasse `[CALENDAR_WIDGET]`, o widget não recebia hash.
- **CALENDAR-V2-004/V2-005/V3:** widgets foram ajustados para capturar `calendarHash`, buscar hash via `/api/availability` e renderizar o calendário ao detectar marcador.
- **SCHED-LEAD-001:** Link Curto passou a exigir lead válido antes de confirmar agendamento, reaproveitando `/api/capture-lead`.
- **WA-V21-SCHEDULE:** WhatsApp passou a respeitar ordem captura → agendamento e apenas traduzir sinais do pipeline central.

## 18. Conclusão executiva

O Scheduler funciona como um interceptador de alta prioridade para frases explícitas de agendamento. Quando dispara, o backend não consulta KB/IA para decidir; retorna calendário via marcador, `calendarHash` e `journeyStage: agendamento`. O componente com maior poder de decisão para agendamento é o bloco `SCHED-PRIORITY` em `server.js`, porque roda antes do restante do pipeline.

O Scheduling Manager é a infraestrutura: gera/resolver hash, disponibilidade, bloqueios e slots. O Appointment System registra o booking via `LeadCaptureSystem.addAppointment()` e `DatabaseHelpers.saveAppointment()`. Os widgets/link curto fazem a experiência visual e o WhatsApp transforma o sinal em link.

Arquivos que exigem auditoria obrigatória antes de qualquer alteração futura:

1. `server.js` — ordem do pipeline, detector, rotas, Link Curto inline.
2. `scheduling-manager.js` — hash, slots, disponibilidade.
3. `public/widget.js`, `public/widget-v2.js`, `public/widget-inline-generator.js` — renderização e booking.
4. `whatsapp-channel.js` — paridade de captura/agendamento e link `/agendar/:hash`.
5. `database.js` — schema e persistência de appointments/api_keys.
6. `lib/lead-capture-score.js` — sinais de captura que podem adiar agendamento em WhatsApp.
7. `lib/decision-core.js`, `lib/v19-deterministic-engine.js`, `lib/orchestrator.js` — camadas capazes de alterar `finalResponse` e afetar marcador/hash.
