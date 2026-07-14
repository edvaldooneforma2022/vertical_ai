# JOURNEY_STAGE_MASTER_MAP — Link Mágico

Documento baseado exclusivamente no código presente no repositório.

## 1. Visão geral

Journey Stage é a classificação do momento comercial/conversacional do usuário. No pipeline legado principal, ele é calculado por `journeyAnalyzer.analyzeJourneyStage(message)` e retorna `descoberta`, `negociacao` ou `fidelizacao`. Em fluxos de interceptação do endpoint `/api/chat-universal`, o servidor também devolve stages operacionais fixos (`agendamento`, `suporte`, `checkout`). Em `lib/conversation-state.js`, existe outro mapa de estado conversacional em inglês (`discovery`, `consideration`, `decision`, etc.) derivado de intents internas.

Objetivo comercial: ajustar resposta, pressão de venda, CTA, bônus, captura e condução conforme a fase aparente do visitante. Objetivo técnico: transportar um sinal simples (`journeyStage`) entre geração de prompt, persistência de lead, sales layer, auto-learning, logs/auditoria, APIs e canais.

No pipeline conversacional, o stage aparece depois da leitura/normalização da mensagem e antes da montagem do prompt, das camadas de decisão comercial e da resposta final. Ele não é a única autoridade: V16 intercepta compra/suporte/agendamento antes de certas camadas; V17 pode fazer bypass total do legado; V18 protege dados extraídos; V19/V18.4 reforça CTA/conversão; V20 registra telemetria comparando bypass legado versus fluxo com LLM.

Relação com versões:

- V17: quando ativo e bem-sucedido, retorna diretamente e faz bypass de V13, V15, V16, pós-processadores e Sales Layer; nesse caminho o journey stage legado não domina a resposta.
- V18: atua sobre `processedPageData`, corrigindo/guardando extração antes de decisões dependentes de checkout/WhatsApp; não calcula stage.
- V19/V18.4: reforça CTA/checkout no final quando o CTA não saiu; usa intenção e checkout, não o JourneyAnalyzer como fonte principal.
- V20: audita o que o bypass legado teria feito versus o fluxo executado e registra `journeyStage` na resposta/log.

## 2. Componentes envolvidos

| Componente | Arquivo | Função real | Responsabilidade | Dependências |
|---|---|---|---|---|
| Journey Stage legado | `lib/ai-systems/journey-analyzer.js` e cópia em `server.js` | `JourneyAnalyzer.analyzeJourneyStage()` | Classificar mensagem por keywords em `descoberta`, `negociacao`, `fidelizacao`; fallback `descoberta`. | Texto da mensagem; `stageKeywords`. |
| Conversation State | `lib/conversation-state.js` | `resolveStage()`, `updateState()`, `buildStateContext()` | Resolver stage em inglês a partir de intent e manter estado in-memory por `conversationId`. | Intent externa (`buy`, `interest`, `objection`, etc.); Map in-memory. |
| Intent Detection V13 | `lib/v13-intent-classifier.js` | `classifyIntent()` | Classificar regex em `READY_TO_BUY`, `INTEREST`, `DOUBT`, `OBJECTION`, `SUPPORT`, `GREETING`, `GENERIC`. | Regex priorizados por ordem. |
| Decision Core / V10 | `lib/decision-core` chamado por `server.js` | `detectIntent()` / `buildDecision()` | Determinar intenção estratégica (`buy`, `interest`, `info`, `human`, etc.) para comportamento e decisões. | Mensagem do usuário; feature flags; sales mode. |
| CTA Engine | `sales/cta-engine.js` | `getCTA()`, `applyCTA()`, `mapToCtaIntent()` | Selecionar CTA por intenção/ação de decision engine; evitar repetição; não substituir resposta. | `intent`, `action`, `context`, `conversationId`. |
| Sales Layer | `sales/sales-layer.js` | `applySalesLayer()` | Pós-processar resposta com persuasão, fechamento, objeção, reengajamento e cópias por stage. | `journeyStage`, estado emocional, decisão, preset, mensagem, contagem. |
| Lead Capture | `lib/lead-capture-score.js`; `lib/leads/lead-capture.js`; `server.js` | `evaluateCapture()`, `addLead()`, `updateLeadJourneyStage()` | Captura por score comportamental e persistência de stage do lead. | Decision core, V13, CTA candidates, checkout candidate, inteligências, `conversationId`. |
| Scheduler | `server.js`, `whatsapp-channel.js`, agendamento público | `superInteligencia.detectarAgendamento()`, `schedulingManager.generatePublicHash()` | Interceptar intenção explícita de agendamento e devolver `journeyStage: agendamento`; no WhatsApp traduzir `calendarHash` para URL. | Mensagem, `apiKey`, `calendarHash`, lead capture. |
| Observer Layer | `analytics/*`, `lib/wa-parity-audit.js`, logs V20 | `recordInteraction()`, `optimizeResponse()`, `waParityAudit.log()` | Registrar/otimizar por intent/stage; auditar paridade entre WhatsApp e Link Curto. | `journeyStage`, intent, hasCTA, leadScore, canal. |
| WhatsApp | `whatsapp-channel.js` | Processamento WA e adaptação de resposta | Consumir sinais do pipeline central, traduzir captura/agendamento/CTA para texto de WhatsApp, auditar paridade. | `/api/process-chat-inteligente` ou `/api/chat-universal`, `journeyStage`, `leadCapture`, `calendarHash`. |
| Widget | `server.js` widget inline e endpoints | Envia mensagem para `/api/chat-universal` com `conversationId`, `leadId`, `pageData`. | Canal web embutido, captura inicial/inline e renderização de resposta. | API base, salesUrl, leadId, checkout detectado no frontend. |
| Link Curto | `/api/process-chat-inteligente` em `server.js` | Pipeline central com resposta, CTA, lead capture e calendário. | Fonte de paridade para WhatsApp V21. | `conversationId`, `processedPageData`, decisão, captura, calendarHash. |

## 3. Fluxo global real

Fluxo principal observado:

```text
Mensagem recebida
↓
Validação e identificação de apiKey/conversationId/leadId
↓
Extração/merge de pageData e checkout/WhatsApp
↓
Guards de dados: DB checkout, WA-CTA promoter, V18 extraction guard
↓
Geração de resposta ou interceptações
↓
Intent detection / inteligências / estado emocional
↓
JourneyAnalyzer.analyzeJourneyStage(message)
↓
Persistência opcional do stage no lead
↓
Prompt com JORNADA DO CLIENTE
↓
Decision Core / Behavior Layer / Sales Layer / CTA / captura / scheduler
↓
Resposta JSON com response, cta, calendarHash, inteligenciasDetectadas, journeyStage, leadCapture
```

Fluxos de bypass reais:

- Agendamento explícito: retorna antes do fluxo completo com `journeyStage: agendamento` e `calendarHash`.
- Suporte/humano explícito: retorna resposta de handoff com `journeyStage: suporte`.
- Compra direta com checkout: retorna checkout com `journeyStage: checkout`.
- V17 ativo: gera resposta e retorna antes do pipeline legado.

## 4. Journey stages existentes no código

### Stages do `JourneyAnalyzer`

| Stage | Origem | Finalidade | Critérios de entrada | Critérios de saída |
|---|---|---|---|---|
| `descoberta` | `stageKeywords.descoberta`; fallback de `analyzeJourneyStage()` | Explicar/introduzir. | Keywords como “o que é”, “como funciona”, “explica”, “primeira vez”, ou ausência de score. | Nova mensagem com score maior em `negociacao` ou `fidelizacao`. |
| `negociacao` | `stageKeywords.negociacao` | Conduzir preço, pagamento, compra, plano. | Keywords de preço, custo, pagamento, desconto, comprar, plano, cartão, boleto, pix. | Nova mensagem com outro score dominante. |
| `fidelizacao` | `stageKeywords.fidelizacao` | Suporte, atendimento e contato. | Keywords como suporte, atendimento, problema, ajuda, WhatsApp, chamado, resolver. | Nova mensagem com outro score dominante. |

### Stages operacionais retornados por endpoints

| Stage | Origem | Finalidade | Critérios de entrada | Critérios de saída |
|---|---|---|---|---|
| `agendamento` | Bypass SCHED-PRIORITY em `server.js` | Abrir fluxo de calendário/agendamento. | `superInteligencia.detectarAgendamento(message)` retorna resposta. | Próxima requisição sem intenção explícita segue fluxo normal. |
| `suporte` | PRE-KB SUPPORT em `server.js` | Handoff para atendente/WhatsApp. | Keywords explícitas de humano/suporte, excluindo pergunta informativa “você é humano?”. | Próxima mensagem sem gatilho segue fluxo normal. |
| `checkout` | PRE-KB BUY em `server.js` | Entregar link de compra imediatamente. | Mensagem de compra direta + `processedPageData.checkoutLink`. | Próxima mensagem sem gatilho segue fluxo normal; estado comprador pode persistir em Map global. |

### Stages do `conversation-state.js`

`resolveStage(intent)` mapeia: `buy→decision`, `interest→consideration`, `objection→objection`, `info→discovery`, `post_sale→post_sale`, `human→escalation`, `stress→recovery`, `checkout_issue→support`, fallback `neutral`. Esse sistema é paralelo ao JourneyAnalyzer e usa nomes em inglês.

### Stages mencionados em auditoria WhatsApp

`lib/wa-parity-audit.js` documenta `descoberta/interesse/consideração/avaliação/compra` como descrição de parâmetro, mas não calcula esses valores.

## 5. Detecção do Journey Stage

- Quem calcula: `JourneyAnalyzer.analyzeJourneyStage()` no pipeline legado; `resolveStage(intent)` em Conversation State; interceptadores de `server.js` definem estágios fixos (`agendamento`, `suporte`, `checkout`).
- Quem atualiza: `server.js` chama `leadSystem.updateLeadJourneyStage(leadId, journeyStage)` quando há lead; `conversation-state.updateState()` atualiza Map in-memory.
- Quem persiste: `LeadCaptureSystem.saveLeads()` grava `metadata: { journeyStage: lead.journeyStage }` no PostgreSQL/JSON; analytics gravam `journey_stage`.
- Quem consome: prompt principal, Sales Layer, auto-learning, analytics, WhatsApp parity audit, resposta JSON, lead capture indireto por intents/CTA.

Evidência central: o stage é calculado por mensagem, usado para `shouldMentionBonus`, persistido no lead e inserido no prompt como `JORNADA DO CLIENTE`.

## 6. Relação com Intent Detection

Há duas relações diferentes.

### V13 intent → stage de `conversation-state.js`

V13 retorna intents em maiúsculas; `conversation-state.js` espera intents minúsculas de outro detector. Não há mapeamento direto V13→JourneyAnalyzer encontrado. Quando usado em lead capture, V13 contribui para score, não para stage.

### Decision/Core intent → `conversation-state.js`

| Intent | Stage resultante |
|---|---|
| `buy` | `decision` |
| `interest` | `consideration` |
| `objection` | `objection` |
| `info` | `discovery` |
| `post_sale` | `post_sale` |
| `human` | `escalation` |
| `stress` | `recovery` |
| `checkout_issue` | `support` |
| outro/nulo | `neutral` |

### Mensagem → JourneyAnalyzer

O JourneyAnalyzer não consome intent; ele consome texto. Assim, uma mesma mensagem pode gerar V13 `SUPPORT` e JourneyAnalyzer `fidelizacao` por conter WhatsApp/suporte, ou V13 `INTEREST` e JourneyAnalyzer `negociacao` por conter preço.

## 7. Relação com CTA Engine

O CTA Engine usa `intent` e `action` do decision engine, não `journeyStage`. A prioridade declarada em `mapToCtaIntent()` é ação > intenção. Combinações reais:

| Decision intent/action | CTA intent | Tipo |
|---|---|---|
| `comprar` ou `fechar`/`link_direto` | `ready_to_buy` | primary |
| `duvida` ou `engajar` | `interest` | secondary |
| `objecao` ou `quebrar_objecao`/`provar` | `objection` | soft |
| `sair` ou `reengajar` | `exit` | soft |
| `reter` | `hesitation` | secondary |
| `educar` | `curiosity` | soft |

Stages que geram CTA via Sales Layer: `negociacao` é o mais forte; `shouldClose()` fecha em `negociacao` e `objecao`; `getMicroCommitment()` só atua em `descoberta`; `applyCTA()` bloqueia duplicidade e não adiciona CTA soft se já houver CTA forte/link. Não há regra real “stage bloqueia CTA” no CTA Engine; bloqueios são por CTA existente, tipo soft, modo off/manual, sarcasmo, resposta inadequada e bypasses.

## 8. Relação com Lead Capture

Lead Capture Score não usa `journeyStage` diretamente. Ele usa sinais: decision-core intent, V13 intent, padrões de preço/plano/contratação/WhatsApp/suporte, clique CTA, checkoutCandidate, ctaCandidate, inteligências e acumuladores. Captura dispara com score >= 50, `dcIntent === buy`, V13 `READY_TO_BUY`, checkoutCandidate ou ctaCandidate, exceto despedidas e exceto se captura já foi tratada.

Stages que favorecem captura por efeito indireto:

- `negociacao`: costuma coocorrer com preço/compra/pagamento, elevando sinais de `question_price`, `intent_buy` ou `v13_interest`.
- `fidelizacao`: pode coocorrer com WhatsApp/suporte, gerando `question_whatsapp`, `question_support`, `intent_human`.
- `descoberta`: coocorre com dúvidas (`v13_doubt`, `intent_info`), score menor.

Não há bloqueio explícito por stage. O bloqueio real é despedida, já capturado, dispensado ou `captureShown`.

## 9. Relação com Scheduler

Agendamento tem prioridade quando `superInteligencia.detectarAgendamento(message)` retorna resposta. Nesse caso o endpoint retorna JSON com `journeyStage: agendamento` e `calendarHash`. No WhatsApp V21, o canal não decide agendamento; apenas traduz `calendarHash` do pipeline central para uma URL `/agendar/{hash}`.

Conflito real encontrado: no WhatsApp, agendamento é adiado se lead ainda não tem dados e o pipeline também pediu captura; a ordem aplicada é Captura → Agendamento.

## 10. Link Curto

O Link Curto é tratado como pipeline central/paridade para WhatsApp. Ele recebe a decisão completa do backend: `response`, `cta`, `calendarHash`, `journeyStage`, `leadCapture`. O Journey Stage influencia prompt, persistência e telemetry, mas decisões fortes de CTA/captura/agendamento dependem também de intents, checkout e sinais comerciais.

## 11. Widget

O widget chama `/api/chat-universal`, envia mensagem, `salesUrl`, `instructions`, `robotName`, `conversationId` e `leadId`. Diferenças para Link Curto:

- Widget pode detectar checkout no frontend e enviar `pageData.checkoutLink`, preservado pelo backend.
- Widget pode ter captura de lead inicial/inline.
- Widget renderiza resposta de texto; quando recebe calendário/lead capture depende do frontend específico para renderizar UI.

O uso de Journey Stage é backend-side: o widget envia mensagem; o servidor calcula e devolve `journeyStage`.

## 12. WhatsApp

WhatsApp consome o mesmo pipeline central quando `WA_USE_FULL_PIPELINE` está ativo; caso contrário usa `/api/chat-universal`. Diferenças:

- Não deve decidir captura própria; traduz `leadCapture.shouldCapture` em pergunta textual.
- Não deve decidir agendamento; traduz `calendarHash` em URL clicável.
- Removeu injeção repetida de link WhatsApp como CTA dentro do próprio WhatsApp para evitar conflito cognitivo.
- Audita paridade com `waParityAudit.log()` incluindo `journeyStage`, intent, score, CTA, captura e agendamento.

## 13. Matriz de decisão

| Mensagem | Intent provável real | Journey Stage provável | Ação resultante real |
|---|---|---|---|
| “Como funciona?” | V13 `DOUBT`; decision `info` | `descoberta` | Explica; prompt em descoberta; captura consultiva só se score/sinais. |
| “O que é isso?” | `DOUBT`/`info` | `descoberta` | Explicação objetiva. |
| “Me explica melhor” | `DOUBT` | `descoberta` | Educação/curiosity, sem fechamento agressivo. |
| “Quero saber mais” | `DOUBT` ou `INTEREST` conforme regex | `descoberta` | Aprofunda; pode pontuar captura. |
| “Preço?” | `INTEREST` | `negociacao` | Responde valor se houver dados; CTA secundário/checkout se aplicável. |
| “Quanto custa?” | `INTEREST` | `negociacao` | Sinal `question_price`; favorece captura. |
| “Tem desconto?” | `INTEREST` | `negociacao` | CTA de interesse/negociação. |
| “Aceita Pix?” | `INTEREST` | `negociacao` | Responde pagamento; sinal comercial. |
| “Quero comprar.” | `READY_TO_BUY` / buy | `negociacao` ou `checkout` se bypass | Checkout direto se link disponível; captura compra se sem lead. |
| “Manda o link” | `READY_TO_BUY` | `negociacao` | CTA/checkout obrigatório se link existe. |
| “Quero assinar” | `READY_TO_BUY` | `negociacao` | Fechamento. |
| “É golpe?” | `OBJECTION` | `descoberta` se keyword não casa no JourneyAnalyzer | Resolver objeção; stage pode ficar descoberta por lacuna entre detectores. |
| “Não confio” | `OBJECTION` | `descoberta` | Quebra objeção via behavior/decision, não via stage. |
| “Tem garantia?” | `DOUBT` | `descoberta` | Responde garantia; CTA suave possível. |
| “Achei caro” | `OBJECTION` | `descoberta` ou `negociacao` se contém preço/valor | Quebra objeção; Sales Layer pode tratar `objecao` se informado. |
| “Vou pensar” | `OBJECTION` | `descoberta` | Retenção/hesitation via intent/action. |
| “Quero agendar” | scheduler | `agendamento` | Bypass com calendário/hash. |
| “Quero falar com vendas” | support/human | `suporte` ou `fidelizacao` | Handoff/WhatsApp se disponível. |
| “Quero um especialista” | human/support se regex casar | `suporte` ou `descoberta` | Handoff se termos de suporte/humano explícitos. |
| “Me chama no WhatsApp” | `SUPPORT` | `fidelizacao` | Envia contato; no WA não injeta WA repetido. |
| “Preciso de suporte” | `SUPPORT` | `fidelizacao`/`suporte` | Handoff. |
| “Quero cancelar” | `OBJECTION` pela negação | `descoberta` | Retenção/objeção; não há stage cancelamento encontrado. |
| “Já comprei” | `READY_TO_BUY` no V13 buy patterns; decision pode post_sale se outro detector | `descoberta` | Risco de conflito: compra de novo vs pós-venda depende detector. |
| “Meu link não funciona” | `checkout_issue` no conversation-state se detector usar | `descoberta` | Suporte/link seguro por behavior layer. |
| “Obrigado” | generic/goodbye | `descoberta` | Captura bloqueada por despedida/agradecimento. |
| “Tchau” | `OBJECTION`/exit | `descoberta` | Reengajamento possível por decision/sales; captura bloqueada. |
| “Oi” | `GREETING` | `descoberta` | Saudação natural. |
| “Funciona mesmo?” | `OBJECTION` | `descoberta` | Prova/garantia; stage não capta objeção por keyword. |
| “Tem WhatsApp?” | `SUPPORT` | `fidelizacao` | Contato direto; score `question_whatsapp`. |
| “Quero contratar” | `READY_TO_BUY`/commercial | `negociacao` | Checkout/lead capture. |
| “Tem plano mensal?” | `INTEREST` | `negociacao` | Responde plano; score `question_plan`. |
| “Como começo?” | `DOUBT` | `descoberta` | Explica início; score implementação. |

## 14. Dependências ocultas

- Dois sistemas de stage coexistem: português (`descoberta/negociacao/fidelizacao`) e inglês (`discovery/consideration/decision/...`). Não são automaticamente sincronizados.
- JourneyAnalyzer decide por contagem de keywords e desempate pela ordem do objeto; ausência de keyword vira `descoberta`.
- Stage do lead só aceita `descoberta`, `negociacao`, `fidelizacao` em `updateLeadJourneyStage`; stages operacionais retornados (`agendamento`, `suporte`, `checkout`) não entram por essa função.
- CTA Engine não lê `journeyStage`, mas Sales Layer lê; por isso mudanças em stage afetam cópia/persuasão, não necessariamente CTA Engine.
- Lead Capture Score documenta não usar atividade pura; porém `messages_5` e `messages_10` somam score sem dispararem sozinhas.
- WhatsApp depende da paridade do pipeline central; se o pipeline central não retornar `leadCapture`/`calendarHash`, WhatsApp não deve inventar.
- V17 pode pular todo o legado, tornando JourneyAnalyzer irrelevante naquele caminho.

## 15. Mapa de risco

| Componente | Risco | Motivo |
|---|---|---|
| `server.js` pipeline principal | ALTO | Concentra cálculo, bypasses, persistência, prompt, resposta e canais. |
| `lib/ai-systems/journey-analyzer.js` | ALTO | Fonte de stage legado; keywords mudam comportamento comercial. |
| `sales/sales-layer.js` | ALTO | Consome stage para fechamento, microcompromisso, cópia e pressão. |
| `lib/leads/lead-capture.js` | MÉDIO | Persiste stage do lead e restringe valores aceitos. |
| `lib/lead-capture-score.js` | MÉDIO | Não usa stage diretamente, mas interage com CTA/checkout/intents. |
| `sales/cta-engine.js` | MÉDIO | CTA por intent/action; risco de conflito com stage comercial. |
| `lib/v13-intent-classifier.js` | MÉDIO | Altera sinais de compra/interesse/suporte que influenciam captura/behavior. |
| `lib/conversation-state.js` | MÉDIO | Stage paralelo em inglês pode divergir do stage legado. |
| `whatsapp-channel.js` | ALTO | Adapta sinais do pipeline para canal; risco de divergência intercanal. |
| `lib/wa-parity-audit.js` | BAIXO | Observação apenas, sem alteração de fluxo. |
| `analytics/*` | BAIXO/MÉDIO | Usa stage para aprendizado/otimização; risco indireto. |
| V18/WA-CTA/link resolver | MÉDIO | Não calculam stage, mas alteram checkout/CTA que competem com decisões. |

## 16. Histórico de regressões evidenciado no código

- Conflito CTA/WhatsApp: comentário V21 remove injeção de WhatsApp como CTA no próprio WhatsApp porque o lead já está no canal e a repetição “destruía credibilidade”.
- Conflito Scheduler/Lead Capture: WhatsApp adia agendamento quando o pipeline pediu captura e o lead não tem dados; ordem fixada: captura antes de agenda.
- Conflito V13/legado: quando V13 blindado está ativo, `server.js` pula V10/V11/CTA/Closing/Orchestrator legado para evitar sobreposição.
- Conflito V17/legado: V17 retorna direto e declara bypass total de V13, V15, V16, PP-GLOBAL e Sales Layer.
- Conflito entre canais: WA parity audit existe para comparar WhatsApp com Link Curto e registra stage, intent, CTA, captura e schedule.

## 17. Matriz de propriedade

| Decisão | Dono real | Hierarquia observada |
|---|---|---|
| Stage legado | JourneyAnalyzer | Mensagem → keyword score → `journeyStage`. |
| Stage de estado | Conversation State | Intent externa → `resolveStage()` → Map in-memory. |
| Intenção regex | V13 Intent Classifier | Regex priorizado; negação/saudação/suporte/dúvida/compra/interesse/objeção. |
| Decisão estratégica | Decision Core / V10/V16 | Intents e interceptações podem sobrepor prompt/stage. |
| CTA | CTA Engine + Sales Layer + V19/V18.4 | Action > intent no CTA Engine; Sales Layer pode fechar por stage; camadas finais podem forçar checkout. |
| Lead Capture | Lead Capture Score | Score e sinais; stage não é autoridade direta. |
| Scheduler | SCHED-PRIORITY / `calendarHash` | Intenção explícita de agendamento tem bypass próprio. |
| Canal WhatsApp | Pipeline central decide; WhatsApp traduz | WhatsApp não deveria criar captura/agendamento próprios. |

## 18. Conclusão executiva

O Journey Stage real do Link Mágico é um sinal conversacional simples e útil, mas não é o controlador soberano do pipeline. A fonte legada principal classifica mensagens por keywords em `descoberta`, `negociacao` e `fidelizacao`. O servidor também retorna stages operacionais (`agendamento`, `suporte`, `checkout`) em bypasses específicos. Paralelamente, `conversation-state.js` mantém outro sistema de stages em inglês derivado de intents.

Seu poder efetivo está em: orientar prompt, bônus, Sales Layer, persistência de lead, analytics, auto-learning e resposta JSON. Ele não decide sozinho CTA, captura, checkout, agendamento ou WhatsApp; essas decisões são compartilhadas com Decision Core, V13, V16, CTA Engine, Lead Capture Score, Scheduler e guards de checkout.

Componentes que dependem dele diretamente: `server.js`, `lib/ai-systems/journey-analyzer.js`, `sales/sales-layer.js`, `lib/leads/lead-capture.js`, analytics/auto-learning e auditoria WhatsApp. Componentes que podem causar regressões mesmo sem mexer no stage: V13 intent classifier, Decision Core, CTA Engine, Lead Capture Score, Scheduler, V17, V18, V19/V18.4, `whatsapp-channel.js`.

Arquivos que exigem auditoria obrigatória antes de qualquer alteração futura:

1. `server.js`
2. `lib/ai-systems/journey-analyzer.js`
3. `sales/sales-layer.js`
4. `sales/cta-engine.js`
5. `lib/lead-capture-score.js`
6. `lib/leads/lead-capture.js`
7. `lib/v13-intent-classifier.js`
8. `lib/conversation-state.js`
9. `whatsapp-channel.js`
10. `lib/wa-parity-audit.js`
11. `analytics/learning-optimizer.js`
12. `analytics/conversation-tracker.js`
