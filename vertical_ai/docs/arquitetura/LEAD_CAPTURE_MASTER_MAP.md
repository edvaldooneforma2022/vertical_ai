# LEAD_CAPTURE_MASTER_MAP — mapa definitivo de captura de leads

## 1. Visão geral

O Lead Capture System é o conjunto de rotas, estado em memória, heurísticas de score, formulários e persistência que transforma interações anônimas do Link Mágico em registros de lead por tenant. A captura efetiva acontece pela rota `POST /api/capture-lead`, que exige `apiKey`, exige `email`, deduplica por e-mail e grava o lead no `LeadCaptureSystem` do tenant.

Objetivo comercial: registrar contato antes, durante ou depois da conversa para permitir follow-up, CRM, análise e agendamento. Objetivo técnico: associar `leadId` e `conversationId` a conversas, eventos e agendamentos, usando JSON local e PostgreSQL quando habilitado.

No funil conversacional, a captura fica entre intenção/engajamento e conversão: ela observa sinais de interesse, recebe o resultado da resposta e devolve ao front-end a ordem de exibir formulário inline; não substitui a resposta comercial.

## 2. Componentes envolvidos

| Componente | Arquivo | Função | Responsabilidade | Dependências |
|---|---|---|---|---|
| Lead Capture | `lib/leads/lead-capture.js` | `LeadCaptureSystem` | Criar, carregar, salvar leads; atualizar conversa e estágio; persistir por tenant. | `fs`, `path`, `crypto`, `DatabaseHelpers`, `DATABASE_URL`, JSON em `data/tenants`. |
| Endpoint de captura | `server.js` | `POST /api/capture-lead` | Validar `apiKey` e e-mail, deduplicar por e-mail, criar lead, acionar CRM. | `getLeadSystem`, `crmManager`, `analytics`, sessão/API key. |
| Lead Score | `lib/lead-capture-score.js` | `evaluateCapture`, `markCaptured`, `markDismissed`, `getScore` | Acumular score por `conversationId`, decidir `shouldCapture`, gerar mensagem/contexto. | Intents DC/V13, flags CTA/checkout, `inteligencias`, `sessionScores` em memória. |
| Journey Stage legado | `modules/leads/journey-analyzer.js` | `analyzeJourneyStage`, `shouldMentionBonus` | Classificar `descoberta`, `negociacao`, `fidelizacao` por palavras-chave. | Mensagem do usuário. |
| Conversation State V11 | `lib/conversation-state.js` | `resolveStage`, `updateState`, `buildStateContext` | Manter estágio conversacional por sessão: `discovery`, `consideration`, `objection`, `decision`, etc. | `conversationId`, intent resolvida, Map em memória. |
| Intent Detection V13 | `lib/v13-intent-classifier.js` | `classifyIntent` | Classificar `READY_TO_BUY`, `INTEREST`, `DOUBT`, `OBJECTION`, `SUPPORT`, `GREETING`, `GENERIC`. | Regex priorizados. |
| Intent Detection V17 | `lib/v17-orchestrator.js` | `detectIntent`, estratégia V17 | Detectar intenção e estratégia comercial de alto nível. | Produto extraído, links sanitizados, padrões textuais. |
| CTA Engine | `sales/cta-engine.js` | `getCTA`, `applyCTA` | Selecionar/aplicar CTA contextual depois do Sales Layer. | `FEATURE_SMART_CTA`, intenção, checkout/link. |
| Scheduler | `server.js` | rotas públicas de calendário/agendamento | Criar appointment via `leadSystem.addAppointment`; widget renderiza calendário por marcador. | `getLeadSystem`, `apiKey`, `leadId`, dados de data/hora. |
| Decision Core | `server.js` / V19 | `decide`, `applyDecision` | Resolver permissão de venda/CTA/checkout; bloquear venda em saída, suporte, objeção e confusão. | V19, pageData, salesMode, V17 fallback. |
| V17 | `lib/v17-orchestrator.js` | Orquestração | Intenção, links seguros, estratégia de venda. | Dados extraídos, sanitização de URL. |
| V18 | `lib/v18-extraction-guard.js` | Extraction Guard | Medir qualidade da extração e confiabilidade de checkout/WhatsApp. | `pageData`, confidence, feature flags. |
| V19 | `lib/v19-deterministic-engine.js` | Deterministic Decision Engine | Fonte determinística para intent, stage, allowSell, allowCTA, allowCheckout. | `conversationId`, `pageData`, `salesMode`, V17 fallback. |
| V20 | `server.js` | Auditoria LLM-bypass | Registra o que a camada antiga teria bypassado versus resposta final. | `inteligencias`, `finalResponse`, `leadId`. |
| Observer Layer | `server.js` | bloco CHAT FIRST | Avalia captura inline após resposta, sem alterar resposta/intent/CTA. | `_leadCaptureScore`, `_chatFirstEnabled`, `conversationId`, `req.body.leadId`. |
| WhatsApp Channel | `whatsapp-channel`, `whatsapp-routes`, `server.js` | rotas e canal WA | Canal multi-tenant e eventos; captura de lead real continua passando por `/api/capture-lead` quando há formulário/lead. | `whatsappManager`, rotas WhatsApp, API key. |
| Widget | `public/widget.js` e HTML inline em `server.js` | formulário inicial e chat | Captura antes do chat no widget embutido; captura contextual no chatbot inline. | `/api/capture-lead`, `/api/process-chat-inteligente`, localStorage. |
| Link Curto | `server.js`, `short-url-generator.js` | `/l/:shortCode` | Resolver short code, carregar tenant/whitelabel e redirecionar para `/chatbot`. | Cache, `DatabaseHelpers`, analytics, whitelabel. |

## 3. Pipeline global real

```text
Mensagem do usuário
  ↓
/api/process-chat-inteligente ou /api/chat-universal
  ↓
Extração/normalização de pageData, links e contatos
  ↓
Journey Stage legado: descoberta | negociacao | fidelizacao
  ↓
Intent Detection: inteligencias + V13/V17/V19 conforme caminho ativo
  ↓
CTA Engine / Decision layers calculam CTA, checkout e resposta
  ↓
Lead Capture Evaluation (somente CHAT_FIRST, sem leadId, com conversationId)
  ↓
Resposta JSON: response + cta + journeyStage + leadCapture
  ↓
Front-end decide renderizar formulário inline se leadCapture.shouldCapture=true
  ↓
POST /api/capture-lead cria/deduplica lead
```

O fluxo real importante é: a captura contextual não decide a resposta; ela é avaliada depois da resposta final e retorna como metadado `leadCapture`.

## 4. Link Curto

O Link Curto não captura lead diretamente. Ele resolve `/l/:shortCode`, valida o formato, busca cache ou banco, incrementa acesso, registra analytics, carrega whitelabel e redireciona para `/chatbot` com `name`, `url`, `instructions` e `apiKey`.

Depois do redirecionamento, a captura passa a ser a captura do chatbot: formulário legado inicial quando `CHAT_FIRST` está desligado ou captura inline contextual quando `CHAT_FIRST` está ligado.

| Item | Comportamento real |
|---|---|
| Como captura | Indiretamente, ao abrir `/chatbot` com `apiKey` do short URL. |
| Quando captura | Não em `/l/:shortCode`; apenas após o carregamento do chatbot. |
| Score utilizado | Nenhum no redirect. O score aparece só no chat contextual (`evaluateCapture`). |
| `shouldCapture` | Não existe no short link; vem de `leadCapture` do endpoint conversacional. |
| `captureContext` | Não existe no redirect; vem do score contextual. |
| Formulário | Renderizado no `/chatbot`, não no redirect. |

## 5. Widget

Há dois comportamentos de widget:

1. **Widget externo `public/widget.js`**: captura inicial antes de liberar chat. O payload usa `nome`, `email`, `telefone`, `url_origem`, `robotName` e `apiKey`. O widget aceita seguir mesmo com erro de API, marcando `leadCaptured=true` no front-end.
2. **Chatbot inline servido pelo servidor**: com `CHAT_FIRST`, conversa primeiro e só mostra captura inline quando o backend retorna `leadCapture.shouldCapture=true`.

Regras reais do chatbot inline:

- Captura contextual só roda se `CHAT_FIRST` estiver habilitado, houver `conversationId` e não houver `leadId` no corpo.
- O front-end chama `showInlineCapture(captureMessage)` depois de exibir a resposta do bot.
- O formulário inline pede nome, WhatsApp e e-mail opcional, mas exige telefone ou e-mail no front-end.
- A rota `/api/capture-lead` exige e-mail; quando o inline envia e-mail vazio, pode receber erro 400 apesar do front-end aceitar telefone.
- Após captura inline bem-sucedida, o front-end chama `/api/link-conversation` para vincular mensagens anteriores ao lead.
- Antes de CTA: a avaliação recebe `ctaCandidate: !!_intCta`, então CTA candidato aumenta score e pode disparar captura.
- Antes de Scheduler: não há regra global explícita de “capturar antes do scheduler”; há fluxo de calendário que pode criar appointment com `leadId` nulo e formulário do scheduler reutilizando `/api/capture-lead` em trechos do HTML.

## 6. WhatsApp

No código analisado, WhatsApp aparece em três papéis distintos:

- **Intenção/canal de suporte**: V13 classifica mensagens com `whatsapp`, `wpp`, `zap`, telefone e humano como `SUPPORT`.
- **Link de conversão ou handoff**: V17/V15/V13 builders e WA CTA promoter podem usar link WhatsApp extraído como contato ou CTA.
- **Canal multi-tenant**: rotas e registro do canal WhatsApp são carregados no servidor.

Captura via texto/WhatsApp não tem um formulário sequencial dedicado no backend principal equivalente ao widget inline. O que existe é captura por intenção: quando o usuário pede WhatsApp/suporte, o score pode receber `question_whatsapp` e/ou `intent_human` se essa intenção chegar como `dcIntent=human`; no fluxo principal mostrado, porém, o mapeamento do `dcIntent` em CHAT_FIRST reduz `inteligencias` a `buy`, `objection`, `interest` ou `info`, então suporte via WhatsApp pode virar `info` se não estiver em outra camada.

Captura antes do agendamento não é uma regra única do canal WhatsApp. O appointment aceita `leadId` nulo e grava nome/e-mail/telefone próprios do agendamento.

## 7. Lead Score

Threshold principal: `CAPTURE_THRESHOLD = 50`.

Tabela de pontuação real:

| Sinal | Pontos |
|---|---:|
| `intent_buy`, `v13_ready_to_buy`, `detection_purchase_intent` | 50 |
| `detection_high_interest` | 80 |
| `cta_click`, `checkout_candidate` | 40 |
| `cta_candidate` | 35 |
| `question_price`, `question_hiring`, `intent_post_sale` | 30 |
| `intent_interest`, `v13_interest`, `question_plan` | 25 |
| `question_implementation`, `messages_10` | 20 |
| `intent_human`, `v13_doubt`, `question_integration`, `question_whatsapp` | 15 |
| `intent_info`, `question_support`, `messages_5` | 10 |
| `intent_objection` | 5 |

Acúmulo: por `conversationId` em `sessionScores` Map. Cada sinal só pontua uma vez por sessão. `messageCount` incrementa em toda avaliação. `messages_5` e `messages_10` somam pontos, mas o comentário do código diz que engajamento não é gatilho sozinho.

Reset: sessão expira em 1 hora; limpeza periódica remove sessões expiradas a cada 10 minutos. `markCaptured` e `markDismissed` bloqueiam nova exibição na mesma sessão. Persistência do score: não há banco; é in-memory.

## 8. Capture Context

Contextos produzidos por `determineCaptureContext`:

| Contexto no código | Quando é criado | Mensagem consumida | Observação |
|---|---|---|---|
| `purchase` | `dcIntent='buy'` ou V13 `READY_TO_BUY` | “registrar seu contato para enviar os detalhes...” | Compra clara. |
| `post_sale` | `dcIntent='post_sale'` | “Para agilizar seu suporte...” | Existe no score, mas não aparece no mapeamento CHAT_FIRST principal. |
| `support` | `dcIntent='human'` | “Para dar continuidade ao seu atendimento...” | Suporte/humano. |
| `evaluation` | `dcIntent='interest'` ou V13 `INTEREST` | “continuarmos exatamente deste ponto...” | Equivale a consideração. |
| `consultive` | `dcIntent='info'` ou V13 `DOUBT` | “organizar essas informações...” | Dúvidas/exploração. |
| `default` | fallback | Mensagem padrão. | Sem sinal específico. |

Os contextos solicitados `scheduler`, `consideration` e `negotiation` não aparecem com esses nomes em `lead-capture-score.js`. O equivalente funcional mais próximo é `evaluation` para consideração/negociação e os fluxos de agendamento usam dados próprios de appointment, não `captureContext='scheduler'`.

## 9. Relação com Journey Stage

Matriz baseada no código real:

| Journey Stage | Origem | Captura permitida? | Captura recomendada pelo código? | Captura bloqueada? |
|---|---|---|---|---|
| `descoberta` | JourneyAnalyzer padrão ou keywords de explicação | Sim, se score/CTA/checkout/intent atingir regra. | Só se sinais somarem; estágio sozinho não captura. | Não. |
| `negociacao` | preço, pagamento, comprar, contratar | Sim. | Indiretamente, pois palavras comerciais também pontuam no Lead Score. | Não. |
| `fidelizacao` | suporte, contato, WhatsApp, ajuda | Sim. | Indiretamente, via suporte/WhatsApp se esses sinais entrarem no score. | Não. |
| `discovery` | Conversation State V11 para intent `info` | Sim. | Não por estágio; depende de score. | Não. |
| `consideration` | V11 para intent `interest` | Sim. | Sim indiretamente, `intent_interest=25`. | Não. |
| `decision` | V11 para intent `buy` | Sim. | Sim, `intent_buy=50`. | Não. |
| `objection` / `hesitating` | V11/V19 | Lead Score permite pequena pontuação; V19 bloqueia venda/CTA. | Não. | Captura não é bloqueada por V19 diretamente, mas CTA/checkout são. |
| `support` / `escalation` | V11/V19 | Sim tecnicamente; V19 bloqueia venda. | Possível se `intent_human` entrar. | Venda/CTA bloqueados, captura não. |
| `exiting` | V19 | Score bloqueia despedida por regex. | Não. | Sim para captura em despedidas pelo guard clause do score; V19 também bloqueia venda. |
| `confused` | V19 | Não há bloqueio direto de captura. | Não. | CTA/venda bloqueados. |

## 10. Relação com CTA Engine

Captura → CTA: o código não mostra uma regra em que captura bem-sucedida force CTA. Após o lead ser capturado, o front-end simplesmente continua a conversa com `leadId`.

CTA → Captura: existe relação direta. O avaliador de captura recebe `ctaCandidate: !!_intCta`; `cta_candidate` soma 35 pontos e também entra como condição direta de `shouldCapture`, desde que não tenha sido mostrada captura antes e a mensagem não seja despedida.

Prioridade: CTA é calculado antes, resposta é produzida, depois captura é avaliada como observer. Na UI, a resposta aparece primeiro e a captura inline surge depois.

## 11. Relação com Scheduler

Captura → Scheduler: appointments aceitam `leadId`; quando há lead capturado, o agendamento pode ser associado ao lead.

Scheduler → Captura: o código do calendário público cria appointment com `leadId` opcional e dados próprios (`name`, `email`, `phone`). Há trechos de HTML que reutilizam `/api/capture-lead` antes ou durante formulários, mas a rota de appointment não obriga lead prévio.

Quem vence: Scheduler vence quando o usuário agenda, pois `addAppointment` aceita `leadId || null`. Captura não bloqueia agendamento.

## 12. Diferenças entre canais

| Funcionalidade | Link Curto | Widget | WhatsApp |
|---|---|---|---|
| Captura | Indireta via `/chatbot`. | Inicial obrigatória no widget externo; contextual no chatbot inline. | Não há captura sequencial dedicada identificada; depende de rotas/formulários ou intenção. |
| Score | Nenhum no redirect. | `evaluateCapture` no CHAT_FIRST; widget externo não usa score. | Pode influenciar intent/sinais, mas não há score específico de canal WA. |
| CTA | Não decide CTA. | Resposta pode conter CTA; candidato CTA pode disparar captura. | WhatsApp pode ser CTA/handoff quando link extraído. |
| Scheduler | Não decide. | Pode renderizar calendário por marcador e enviar appointment. | Não há precedência WA→scheduler específica. |
| Formulário | Formulário do chatbot após redirect. | Formulário inicial ou inline. | Não há formulário WA próprio no trecho principal. |
| Contexto | Herdado do chatbot. | `captureContext` do Lead Score no inline. | Suporte/WhatsApp pode virar intent/context conforme classificador. |
| Persistência | Short URL registra acesso; lead persiste depois. | `/api/capture-lead` persiste lead. | Eventos/canal WA existem; lead real persiste via captura padrão. |

## 13. Dependências ocultas

- `apiKey` é obrigatório na captura; Link Curto e Widget precisam propagá-lo corretamente.
- O formulário inline aceita telefone ou e-mail, mas `/api/capture-lead` exige e-mail; isso cria dependência implícita entre front-end e backend.
- `Lead Score` é in-memory: restart apaga score, captura mostrada, dismiss e captured.
- `ctaCandidate` força elegibilidade de captura mesmo com score abaixo de 50.
- `session.captureShown` impede reexibir captura mesmo se usuário ignorar visualmente sem clicar em dispensar.
- `markDismissed` existe, mas o botão inline apenas seta `inlineCaptured=true` no front-end; não chama `markDismissed` no backend.
- V19 bloqueia CTA/venda, mas não bloqueia diretamente Lead Capture Score.
- O `dcIntent` usado no CHAT_FIRST é derivado de poucos campos de `inteligencias`, não de toda a taxonomia V13/V17/V19.
- Appointment aceita `leadId` nulo, então captura não é pré-condição real do Scheduler.

## 14. Matriz de decisão

| Pergunta | Intent provável | Journey Stage provável | Score/sinais prováveis | Captura? |
|---|---|---|---|---|
| “Como funciona?” | `info` / V13 `DOUBT` | `descoberta` / `discovery` | `intent_info=10`, V13 doubt se usado `+15` | Normalmente não, salvo CTA candidato. |
| “É golpe?” | `objection` | `objection` / `hesitating` | `intent_objection=5` | Não por score; CTA/venda bloqueados por V19. |
| “Quero comprar.” | `buy` / `READY_TO_BUY` | `negociacao` / `decision` | `intent_buy=50` | Sim. |
| “Quero começar.” | V13 `READY_TO_BUY`; V17 pode compra/implementação | `negociacao` | `v13_ready_to_buy=50` ou `question_implementation=20` | Sim se V13 usado; talvez não se só regex de implementação. |
| “Quero uma demonstração.” | interesse/consultivo | `descoberta` ou `consideration` | Pode não haver padrão específico de demo no score | Depende de CTA/checkout/inteligencias. |
| “Quero agendar.” | schedule não aparece no Lead Score principal | pode ser `descoberta`/neutral | Sem sinal dedicado `scheduler` | Não por score, a menos que outra camada gere CTA/calendário. |
| “Quero falar com humano.” | V13 `SUPPORT`, V17 `support`, V19 `support` | `fidelizacao` / `support` | Se mapeado como `human`: +15; no CHAT_FIRST pode virar `info` | Possível, mas não garantido. |
| “Qual o preço?” | `interest`/price | `negociacao`/evaluating | `question_price=30`; V13 interest +25 se usado | Pode chegar a 55 se ambos usados; no CHAT_FIRST depende de `inteligencias`. |
| “Tem plano mensal?” | `interest` | `negociacao` | `question_plan=25` | Não sozinho. |
| “Aceita pix?” | buy/price | `negociacao` | V19 price; Lead Score pode não pontuar pix diretamente | Depende de intent/CTA. |
| “Manda o link.” | `buy` / link_request | `decision` | `intent_buy=50` ou checkout candidate | Sim. |
| “Tenho dúvida.” | `DOUBT` | `descoberta` | `v13_doubt=15` se usado | Não sozinho. |
| “Quero suporte.” | support/human | `fidelizacao`/support | `intent_human=15` se mapeado | Não sozinho. |
| “Obrigado, tchau.” | exit/goodbye | exiting | guard `_isGoodbye` | Não. |
| “Achei caro.” | objection/price | hesitating/negociacao | objection 5 ou price | Normalmente não; CTA bloqueado se V19 objection. |

## 15. Mapa de risco

| Componente | Risco | Motivo baseado no código |
|---|---|---|
| `/api/capture-lead` | ALTO | É ponto único de persistência, exige e-mail e deduplica por e-mail. |
| `lead-capture-score.js` | ALTO | Decide `shouldCapture`; estado in-memory e regras de CTA podem disparar captura. |
| Chatbot inline em `server.js` | ALTO | Renderiza e submete captura; divergência telefone/e-mail versus backend. |
| Widget externo `public/widget.js` | MÉDIO | Captura inicial e fallback permite seguir sem persistir. |
| Link Curto | MÉDIO | Não captura, mas precisa preservar `apiKey` e parâmetros para o funil. |
| JourneyAnalyzer | BAIXO | Estágio sozinho não bloqueia nem força captura. |
| V13/V17 intent | MÉDIO | Influenciam score/contexto quando integrados. |
| V19 | MÉDIO | Bloqueia venda/CTA/checkout, mas não captura diretamente. |
| Scheduler | MÉDIO | Pode criar appointment sem lead; associação depende de `leadId`. |
| WhatsApp Channel | MÉDIO | Forte acoplamento com suporte/CTA, mas captura dedicada não está centralizada. |
| V18 | BAIXO/MÉDIO | Afeta confiança de checkout, que pode afetar checkoutCandidate/CTA. |
| Conversation State | BAIXO | Orienta prompt/estágio; não decide captura diretamente. |

## 16. Conclusão executiva

O sistema de captura realmente funciona por três mecanismos: formulário inicial do widget, captura inline contextual no chatbot e endpoint único de persistência `/api/capture-lead`. O Link Curto não captura; ele roteia para o chatbot com `apiKey`. WhatsApp é mais um canal/intenção/handoff do que um funil de captura próprio no código principal analisado.

O canal com captura mais avançada é o chatbot/widget inline com `CHAT_FIRST`, porque combina resposta conversacional, score, contexto e formulário inline. O mais limitado é Link Curto, pois só redireciona. WhatsApp é intermediário: tem classificação e handoff, mas não apresenta captura sequencial dedicada centralizada.

Os módulos com maior poder de decisão são `lead-capture-score.js` para captura, `/api/capture-lead` para persistência, V19 para venda/CTA/checkout, e o bloco CHAT_FIRST em `server.js` para conectar avaliação backend ao formulário front-end.

Dependências que podem causar regressões futuras: obrigatoriedade de e-mail no backend versus formulário inline com e-mail opcional; score in-memory; `ctaCandidate` como gatilho forte; ausência de chamada backend para `markDismissed`; agendamento com `leadId` opcional; e múltiplas taxonomias de intent (JourneyAnalyzer, V11, V13, V17, V19, inteligencias) coexistindo.

Antes de qualquer V22, auditoria obrigatória deve cobrir: `/api/capture-lead`, `lib/lead-capture-score.js`, bloco CHAT_FIRST de `server.js`, `public/widget.js`, rotas de Scheduler, V19 e integração WhatsApp/CTA.
