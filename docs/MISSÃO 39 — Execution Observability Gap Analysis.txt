# MISSÃO 39 — Execution Observability Gap Analysis

## Escopo e critério de evidência

Esta auditoria usa apenas código executável, persistência real e logs reais encontrados no repositório. Comentários, documentação anterior e testes não foram usados como prova de comportamento em produção.

Conclusão central: o Link Mágico consegue provar parcialmente captura de leads e geração de resposta quando `leadId` existe, mas não consegue reconstruir uma venda ponta a ponta. A cadeia Usuário → Mensagem → Intent → Journey → Decision → CTA → Lead → Scheduler → Resposta é quebrada em múltiplos pontos porque logs são majoritariamente efêmeros, a persistência comercial não recebe correlation id consistente e os módulos de decisão/CTA/learning não estão ligados de forma comprovável aos endpoints principais de chat.

---

## 1. Observability map

| Etapa | Onde deveria registrar | Onde realmente registra | Onde não registra | Onde o dado é perdido |
|---|---|---|---|---|
| Mensagens recebidas | Evento persistido por `conversationId`, tenant/API key, lead e timestamp antes de qualquer processamento. | Se `leadId` é enviado, `/api/chat-universal` chama `leadSystem.updateLeadConversation(leadId, message, true)`; `/api/process-chat-inteligente` faz o mesmo. | Sem `leadId`, não há persistência da mensagem nos endpoints principais. O endpoint `/api/chat-universal` não chama o tracker de auto-learning. | Mensagem sem `leadId` fica só em logs/response lifecycle e desaparece após a requisição. |
| Intenção detectada | Campo persistido por mensagem, com motor, score/confidence e versão. | `/api/process-chat-inteligente` retorna `inteligenciasDetectadas`; `decision-engine` loga intent quando chamado; `learning_conversations` tem coluna `detected_intent`. | `/api/chat-universal` não persiste intent. `generateAIResponse` não usa `decision-engine`. Não há prova de gravação de intent nos endpoints principais. | Intent é retornada apenas no endpoint inteligente ou impressa em console nos motores, sem vínculo persistente obrigatório. |
| Journey stage | Campo persistido por mensagem e por lead, com origem do classificador. | `generateAIResponse` calcula `journeyStage`, atualiza lead se `leadId` existir e loga a jornada; `/api/process-chat-inteligente` retorna `journeyStage`. | Sem `leadId`, não há persistência. Não há tabela de histórico de transições de jornada. | Mudanças de jornada não são reconstruíveis por turno; só o último estágio do lead pode sobreviver. |
| Decision core | Evento persistido com input, output, motor, versão e autoridade final. | `sales/decision-engine.js` monta objetos de decisão e loga decisão completa quando executado. | Endpoints principais mostrados não chamam `decideCommercialAction`/`decideCommercialActionV2`; não há tabela de decisions. | A decisão comercial desaparece como console log ou nunca é gerada no fluxo principal. |
| V17 | Evento persistido por versão/motor com decisão e efeitos. | Não há evidência executável de registro V17 no fluxo principal auditado. | Não existe tabela/endpoint de traces V17. | Qualquer efeito atribuído a V17 é não comprovável. |
| V18 | Evento persistido por versão/motor com CTA criado/alterado. | Não há evidência executável de registro V18 no fluxo principal auditado. | Não existe tabela/endpoint de traces V18. | CTA criado por V18 não é distinguível de texto gerado por LLM/local. |
| V19 | Evento persistido por versão/motor com CTA removido/bloqueado e razão. | Não há evidência executável de registro V19 no fluxo principal auditado. | Não existe tabela/endpoint de traces V19. | Remoções/bloqueios de CTA não deixam evidência. |
| CTA final | Persistir texto/URL/tipo do CTA final entregue ao cliente e clicks associados. | Widget transforma URLs da resposta em botões e adiciona listener para `cta_clicked`; `conversation-tracker` detecta `hasCTA` se receber `aiResponse`. | Não há prova de persistência do CTA final pelos endpoints principais. O tracker mapeia `click_link`, mas o widget emite `cta_clicked`, gerando incompatibilidade de evento. | CTA pode chegar na resposta sem registro do texto/URL; clique pode ser emitido com nome não mapeado. |
| Lead capture | Persistir lead, origem, conversationId, mensagem inicial e estado. | `/api/capture-lead` salva lead no sistema em arquivo via `LeadCaptureSystem`; `database.saveLead` existe para `tenant_leads`. | Endpoint legado `/api/capture-lead` não usa `conversationId`, não usa `database.saveLead` e não vincula ao decision/CTA/scheduler. | Lead fica separado do trace comercial; duplicado por e-mail retorna lead existente sem registrar nova tentativa. |
| Scheduler | Persistir exibição de slots, seleção, bloqueio, criação/cancelamento de agendamento, lead e conversationId. | `scheduling-manager` persiste disponibilidade/bloqueios e `database.saveAppointment` persiste agendamentos. | Geração/exibição de slots públicos não registra trace. Não há vínculo obrigatório com `conversationId`. | Abandono no calendário, bloqueio de slot e exposição do scheduler não são prováveis. |
| Resposta final | Persistir payload final entregue, provedor, tempo, journey, intent, CTA e ids. | `generateAIResponse` loga resposta final, provedor e tempo; se `leadId` existe, conversa no lead recebe a resposta. | Sem `leadId`, resposta não persiste. Logs não carregam `conversationId`. | Resposta final fica em console ou no HTTP response sem recuperação posterior. |

---

## 2. Traceability audit

| Transição | Existe log? | Existe persistência? | Correlation id? | Conversation id? | Recuperação posterior? | Classificação |
|---|---:|---:|---:|---:|---:|---|
| Usuário → Mensagem | Parcial: endpoint inteligente loga tamanho, URL e leadId; IA loga texto limpo. | Parcial: só com `leadId`. | Não. | Parcial: aceito no body e usado apenas para `activeChats`. | Parcial: via lead, se existente. | Parcialmente rastreável |
| Mensagem → Intent | Parcial: motores logam intent quando executados. | Não comprovada no fluxo principal. | Não. | Não. | Não. | Não rastreável |
| Intent → Journey | Parcial: journey é logada; endpoint inteligente retorna. | Parcial: último estágio no lead se `leadId`. | Não. | Não. | Parcial. | Parcialmente rastreável |
| Journey → Decision | Parcial: `decision-engine` loga decisão se chamado. | Não. | Não. | Parâmetro existe no motor, mas não há persistência. | Não. | Não rastreável |
| Decision → CTA | Parcial: `cta-engine` loga seleção se chamado. | Não. | Não. | Memória interna por `conversationId`, não persistida. | Não. | Não rastreável |
| CTA → Lead | Parcial: captura de lead loga novo lead. | Parcial: arquivo em `/tmp`/fallback no endpoint legado; DB em funções separadas. | Não. | Não no endpoint legado. | Parcial: admin lista leads. | Parcialmente rastreável |
| Lead → Scheduler | Não há trace comercial de transição. | Parcial: agendamento pode ter `lead_id`. | Não. | Não. | Parcial: buscar agendamentos por lead. | Parcialmente rastreável |
| Scheduler → Resposta | Parcial: erros/slots não são traceados; widget só renderiza marcador. | Não para exibição/abandono. | Não. | Não. | Não. | Não rastreável |
| Resposta → Usuário | Parcial: console log da resposta. | Parcial: só com `leadId`. | Não. | Não. | Parcial. | Parcialmente rastreável |

---

## 3. Logging gap report — TOP 50 informações críticas ausentes

| # | Informação crítica ausente | Impacto comercial | Impacto operacional | Severidade |
|---:|---|---|---|---|
| 1 | `correlation_id` global por requisição. | Não atribui venda ao caminho correto. | Debug distribuído inviável. | Crítica |
| 2 | `conversation_id` persistido em todos os eventos. | Comprador não é reconstruído. | Relatórios por conversa falham. | Crítica |
| 3 | Mensagem recebida sem `leadId`. | Leads anônimos compradores somem. | Sem replay de incidentes. | Crítica |
| 4 | Intent detectada por turno no chat universal. | Não prova quem decidiu vender. | Motor não auditável. | Crítica |
| 5 | Confidence/score de intent. | Priorização de compra não auditável. | Tuning sem base. | Alta |
| 6 | Mudança de intent. | Sinais de compra podem desaparecer. | Não há análise de regressão. | Alta |
| 7 | Journey stage por turno. | Não prova evolução do funil. | Só há último estado parcial. | Crítica |
| 8 | Mudança de journey. | Abandono por etapa não é medido. | Não há histórico temporal. | Alta |
| 9 | Decision core chamado/não chamado. | Autoridade operacional desconhecida. | Falhas silenciosas de roteamento. | Crítica |
| 10 | Input completo do decision core. | Decisão não reprodutível. | Debug inconclusivo. | Alta |
| 11 | Output completo do decision core. | Fechamento não atribuível. | Sem auditoria de regras. | Crítica |
| 12 | Versão do motor decisor. | V17/V18/V19 não comparáveis. | Deploy sem rastreabilidade. | Alta |
| 13 | Autoridade final entre motores. | Não prova quem manda na venda. | Conflitos invisíveis. | Crítica |
| 14 | CTA criado por motor. | Receita não atribuível a CTA. | Otimização impossível. | Crítica |
| 15 | CTA removido por motor. | Perda direta de venda invisível. | Bug não diagnosticável. | Crítica |
| 16 | CTA bloqueado por regra. | Conversão perdida sem evidência. | Regras não auditáveis. | Crítica |
| 17 | Motivo de bloqueio/remoção de CTA. | Não sabe por que comprador não recebeu link. | Correção cega. | Alta |
| 18 | CTA final entregue, texto e URL. | Não prova que checkout chegou. | Sem comparação output/UI. | Crítica |
| 19 | Ordem final de CTAs após otimização. | CTA pode ficar oculto/alterado. | Regressões invisíveis. | Média |
| 20 | URL de checkout detectada. | Checkout errado não é provado. | Diagnóstico de scraping fraco. | Alta |
| 21 | Origem do checkout detectado. | Produto/tenant pode ser confundido. | Auditoria multi-tenant falha. | Alta |
| 22 | Click real no CTA com nome de evento mapeado. | Conversão atribuída perde o clique. | Tracker não atualiza ação. | Crítica |
| 23 | Erro de tracking de evento no widget. | Clicks podem sumir. | Observabilidade client-side fraca. | Alta |
| 24 | Exibição do botão CTA no DOM. | Não prova que usuário viu CTA. | UI regressions invisíveis. | Alta |
| 25 | Falha ao renderizar CTA. | Venda pode desaparecer no front. | Sem alerta de front. | Alta |
| 26 | Lead capture tentativa iniciada. | Form abandonment invisível. | Não mede fricção. | Alta |
| 27 | Lead capture ignorado/duplicado. | Leads recorrentes não contam jornada. | Operação vê falso sucesso. | Alta |
| 28 | Lead capture com `conversationId`. | Lead não liga à conversa. | CRM incompleto. | Crítica |
| 29 | Lead capture com CTA de origem. | Não atribui captura a oferta. | Campanhas não comparáveis. | Alta |
| 30 | Falha ao persistir lead em DB no endpoint legado. | Lead pode ficar em storage efêmero. | Migração incompleta invisível. | Crítica |
| 31 | Sync CRM sucesso/falha por lead com id rastreável. | Lead salvo pode não ir ao CRM. | Operação perde follow-up. | Alta |
| 32 | Scheduler exibido ao usuário. | Não prova que agenda apareceu. | Abandono de calendário invisível. | Crítica |
| 33 | Slots calculados para o usuário. | Disponibilidade errada não auditável. | Debug de calendário difícil. | Alta |
| 34 | Slot bloqueado por indisponibilidade. | Venda por agenda pode sumir. | Sem causa de bloqueio. | Alta |
| 35 | Slot selecionado. | Intenção de agendar não vira dado. | Funil perde etapa. | Alta |
| 36 | Agendamento criado com conversationId. | Venda/agendamento não liga ao chat. | Follow-up incompleto. | Crítica |
| 37 | Abandono após abrir scheduler. | Perda de venda invisível. | Sem métricas de UX. | Alta |
| 38 | Provider LLM por conversationId. | Falhas de provedor afetam vendas sem atribuição. | Debug por conversa inviável. | Média |
| 39 | Fallback local acionado com motivo. | Respostas fracas podem derrubar vendas. | Qualidade não observável. | Alta |
| 40 | Erro sanitização/limpeza de mensagem. | Mensagem comercial pode ser alterada. | Perda de input invisível. | Média |
| 41 | Resposta antes/depois de guards. | CTA pode ser removido sem prova. | Debug impossível. | Crítica |
| 42 | Resposta antes/depois de optimizer. | Alteração comercial não auditável. | Otimização não verificável. | Alta |
| 43 | Anti-dropoff acionado por conversa. | Retenção não comprovada. | Métrica de abandono ausente. | Alta |
| 44 | Buyer readiness ou perfil operacional. | Compradores não identificáveis. | Segmentação falha. | Alta |
| 45 | Status de buyer após interrupção. | Compra pode se perder em desvio. | Sem replay comercial. | Alta |
| 46 | Tenant/api_key em todo trace. | Multi-tenant sem isolamento analítico. | Vazamento/confusão de dados. | Crítica |
| 47 | IP/user-agent/session client. | Fraude e duplicidade não auditáveis. | Diagnóstico client-side fraco. | Média |
| 48 | HTTP status/latência por etapa. | Queda de conversão por performance invisível. | SLO inexistente. | Média |
| 49 | Persistência de learning acionada por chat real. | Aprendizado não prova uso produtivo. | Scores podem ficar vazios. | Alta |
| 50 | Recuperação posterior de trace completo. | Auditoria de venda impossível. | Suporte não consegue provar execução. | Crítica |

---

## 4. Sales black holes

| Evento | Último ponto observável | Ponto onde desaparece | Consequência | Classificação |
|---|---|---|---|---|
| Usuário envia mensagem sem `leadId`. | Requisição HTTP e, às vezes, console log. | Antes de persistir conversa. | Comprador anônimo não é recuperável. | Crítico |
| Usuário demonstra compra no `/api/chat-universal`. | Texto da mensagem e journey em log. | Intent/decision não persistidos. | Não se prova que motor decidiu vender. | Crítico |
| Decision engine deveria fechar venda. | Console interno do `decision-engine`, se chamado. | Sem chamada comprovada no endpoint principal e sem tabela. | Autoridade final desconhecida. | Crítico |
| CTA gerado em texto pela IA. | Console da resposta final. | Sem registro de CTA final estruturado. | Não se prova checkout entregue. | Crítico |
| CTA renderizado pelo widget. | DOM local do usuário; listener client-side. | Evento `cta_clicked` não corresponde ao mapeamento `click_link`. | Clique/conversão pode não atualizar tracker. | Crítico |
| Lead captura duplicada por e-mail. | Endpoint retorna lead existente. | Tentativa nova não é registrada como evento. | Sinal comercial recorrente some. | Alto |
| Lead sem conversa prévia. | Lead salvo em arquivo legado. | Sem `conversationId` nem CTA de origem. | Lead não atribuído ao funil. | Alto |
| CRM sync falha. | Warning assíncrono sem bloquear. | Não impacta resposta e pode não ser reprocessado automaticamente. | Operação acredita que lead está no CRM. | Alto |
| Scheduler exibido. | Marcador/renderização no widget. | Sem evento persistido de exibição. | Abandono no calendário invisível. | Crítico |
| Slot bloqueado/indisponível. | Cálculo interno de `getPublicSlots`. | Sem trace de slot removido. | Usuário pode não agendar sem evidência. | Alto |
| Agendamento criado. | `tenant_appointments` por `lead_id`. | Sem `conversationId`/CTA/decision. | Agendamento não prova venda originada no chat. | Alto |
| Resposta final com fallback local. | Log de provedor `local`. | Sem persistência por conversa se não houver `leadId`. | Queda de qualidade não correlacionável. | Médio |
| Mudança de journey. | Último estado no lead. | Histórico anterior sobrescrito/ausente. | Abandono por etapa não mensurável. | Alto |
| V19 remove CTA. | Nenhum ponto observável executável encontrado. | Ação não registrada. | Perda de checkout invisível. | Crítico |
| V18 cria CTA. | Nenhum ponto observável executável encontrado. | Ação não registrada. | Receita não atribuível. | Crítico |

---

## 5. Minimum telemetry spec

A especificação mínima abaixo é apenas documental. Ela define o menor conjunto de eventos e campos necessário para reconstruir uma venda ponta a ponta.

### IDs obrigatórios

- `trace_id`: id global da requisição/evento encadeado.
- `conversation_id`: id estável da conversa, criado no primeiro contato e reaproveitado no widget, backend, lead e scheduler.
- `message_id`: id único por mensagem recebida e por resposta enviada.
- `tenant_id` ou `api_key_hash`: isolamento operacional por tenant.
- `lead_id`: nulo até captura, preenchido após captura.
- `cta_id`: id do CTA final estruturado.
- `decision_id`: id da decisão comercial que gerou ou bloqueou ação.
- `scheduler_session_id`: id da sessão de calendário.
- `appointment_id`: id do agendamento, se criado.

### Eventos mínimos

| Evento | Quando emitir | Campos mínimos |
|---|---|---|
| `chat.message.received` | Ao receber mensagem | `trace_id`, `conversation_id`, `message_id`, `tenant_id`, `lead_id`, `timestamp`, `channel`, `message_text`, `url`, `robot_name` |
| `chat.intent.detected` | Após classificador de intent | IDs acima, `intent`, `confidence`, `engine`, `engine_version`, `input_message_id` |
| `chat.journey.detected` | Após classificador de jornada | IDs acima, `journey_stage`, `previous_journey_stage`, `engine`, `reason_code` |
| `sales.decision.made` | Após decision core | IDs acima, `decision_id`, `intent`, `journey_stage`, `action`, `strategy`, `pressure`, `next_step`, `engine`, `engine_version`, `authority_rank` |
| `sales.cta.created` | Quando motor cria CTA | IDs acima, `cta_id`, `decision_id`, `cta_text`, `cta_url`, `cta_type`, `created_by_engine`, `source_url` |
| `sales.cta.modified` | Quando guard/optimizer altera CTA | IDs acima, `cta_id`, `before`, `after`, `modified_by_engine`, `reason_code` |
| `sales.cta.removed` | Quando CTA é removido/bloqueado | IDs acima, `cta_id`, `removed_by_engine`, `reason_code`, `decision_id` |
| `chat.response.generated` | Antes de enviar HTTP response | IDs acima, `response_message_id`, `provider`, `latency_ms`, `final_text`, `has_cta`, `cta_ids`, `decision_id` |
| `chat.response.delivered` | Widget recebe/renderiza resposta | IDs acima, `response_message_id`, `render_status`, `dom_cta_count` |
| `sales.cta.clicked` | Clique em CTA | IDs acima, `cta_id`, `cta_url`, `cta_type`, `clicked_at`, `client_session_id` |
| `lead.capture.started` | Formulário exibido/submetido | IDs acima, `form_id`, `source_cta_id`, `source_message_id` |
| `lead.capture.completed` | Lead salvo | IDs acima, `lead_id`, `email_hash`, `phone_hash`, `source`, `persisted_store` |
| `lead.capture.ignored` | Duplicado/inválido/erro | IDs acima, `reason_code`, `email_hash`, `existing_lead_id` |
| `scheduler.shown` | Calendário renderizado | IDs acima, `scheduler_session_id`, `source_cta_id`, `slots_count` |
| `scheduler.slots.generated` | Backend calcula slots | IDs acima, `scheduler_session_id`, `date_range`, `available_slots_count`, `blocked_slots_count` |
| `scheduler.slot.selected` | Usuário seleciona horário | IDs acima, `scheduler_session_id`, `selected_datetime` |
| `scheduler.appointment.created` | Agendamento salvo | IDs acima, `appointment_id`, `lead_id`, `selected_datetime`, `status` |
| `scheduler.abandoned` | Usuário abre agenda e não conclui | IDs acima, `scheduler_session_id`, `last_step`, `elapsed_ms` |

### Persistência recomendada

- Uma tabela append-only de eventos comerciais (`commercial_events`) particionada por `tenant_id` e tempo.
- Índices por `conversation_id`, `trace_id`, `lead_id`, `cta_id`, `appointment_id` e `created_at`.
- Campo `payload` JSON para detalhes de cada motor, mas mantendo colunas normalizadas para ids, tipo de evento e timestamp.
- Retenção mínima operacional superior ao ciclo de venda do tenant.

---

## 6. Known vs proven

| Assunto | Acreditamos que acontece | Conseguimos provar que acontece | Classificação |
|---|---|---|---|
| CTA chega ao usuário | A resposta pode conter URL e o widget pode renderizar botão. | Parcialmente: o front cria botão para URLs, mas não há persistência de entrega/render por conversa. | Parcialmente comprovado |
| Scheduler é exibido | Marcador de calendário no widget renderiza calendário. | Não de forma persistente: não há evento de exibição recuperável. | Não comprovado |
| Lead é capturado | `/api/capture-lead` cria lead e incrementa contador. | Parcialmente: prova local/legada por arquivo e logs; sem `conversationId` e sem vínculo CTA/decision. | Parcialmente comprovado |
| Compradores recebem checkout | Motores e widget têm lógica relacionada a checkout. | Não: não há trace persistido do checkout final entregue por comprador. | Não comprovado |
| V19 possui autoridade final | A missão menciona essa hipótese. | Não há evidência executável/persistida de V19 no fluxo auditado. | Não comprovado |
| V18 cria CTA | Há `cta-engine` para selecionar CTA, mas não V18 comprovável. | Não há registro de CTA criado por V18 no fluxo principal. | Não comprovado |
| V17 participa do fluxo | Pode existir como versão histórica conceitual. | Não há trace executável/persistido V17 encontrado no fluxo principal. | Não comprovado |
| Decision engine decide venda | `decision-engine` produz decisão quando chamado. | Parcial: o módulo é executável e loga, mas endpoints principais não provam chamada nem persistem decisão. | Parcialmente comprovado |
| Journey é detectada | `journeyAnalyzer.analyzeJourneyStage` é chamado. | Parcial: é logada e pode atualizar lead, mas sem histórico por turno sem `leadId`. | Parcialmente comprovado |
| Intent é detectada | Endpoint inteligente e decision engine detectam intenções. | Parcial: retorno/log em alguns caminhos, sem persistência ponta a ponta. | Parcialmente comprovado |
| CTA click é rastreado | Widget emite evento de clique. | Parcial/frágil: evento emitido (`cta_clicked`) não bate com mapeamento de conversão (`click_link`). | Parcialmente comprovado |
| Scheduler bloqueia slots ocupados | `getPublicSlots` consulta agendamentos e bloqueios. | Parcial: cálculo existe, mas bloqueios/removidos não são traceados por usuário. | Parcialmente comprovado |
| Conversas podem ser recuperadas | Leads têm `conversations`; learning tem tabela. | Parcial: só com `leadId` ou se tracker for chamado por algum fluxo; endpoints principais não provam learning. | Parcialmente comprovado |
| Venda ponta a ponta é auditável | A arquitetura sugere cadeia completa. | Não: faltam ids e eventos entre decision, CTA, lead, scheduler e resposta. | Não comprovado |

---

## Resposta final da missão

O Link Mágico consegue provar em produção apenas eventos isolados: que recebeu algumas requisições de chat, que pode gerar resposta, que pode salvar lead em fluxo legado quando o formulário é submetido, que pode guardar conversas associadas a um `leadId` e que possui persistência para leads/agendamentos em partes do código. Ele não consegue provar uma venda ponta a ponta, não consegue provar qual motor possui autoridade operacional final, não consegue provar que um comprador recebeu checkout, não consegue provar onde um comprador abandonou o fluxo e não consegue provar que V17/V18/V19 executaram ações comerciais específicas.
