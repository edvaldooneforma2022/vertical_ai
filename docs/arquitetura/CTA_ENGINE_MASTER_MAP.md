# CTA Engine Master Map — Link Mágico

> Auditoria estática do fluxo real encontrado no código. Este documento descreve o comportamento observado, sem propor correções.

## SEÇÃO 1 — VISÃO GERAL

O **CTA Engine** é a camada que seleciona e/ou enriquece chamadas para ação em respostas comerciais. No código há mais de uma geração de decisão convivendo:

1. `sales/cta-engine.js` é o CTA Engine nominal: escolhe template por intenção/ação, evita repetição por conversa e pode trocar a URL para WhatsApp em cenários de fechamento/hesitação.
2. `lib/orchestrator.js` governa a resposta final em modo automático, decidindo quando bloquear CTA/checkout/closing, quando anexar checkout e quando aceitar CTA suave.
3. `lib/decision-core.js` define a regra granular que separa compra de informação, objeção, humano, pós-venda, problema de checkout e neutro.
4. `lib/v19-deterministic-engine.js` é uma camada determinística mais forte: resolve intent, estado conversacional, confiança dos dados, permissões de venda/CTA/checkout e pode remover/injetar checkout no pós-processamento.
5. O endpoint principal em `server.js` tem regras de precedência adicionais, principalmente agendamento com bypass total antes de KB/IA e V20 como observador.

Responsabilidade efetiva do CTA Engine ampliado:

- Mostrar CTA quando há intenção comercial suficiente e link/destino confiável.
- Não mostrar CTA quando a mensagem é informativa, suporte, objeção, stress, pós-venda, saída ou quando dados/link não são confiáveis.
- Capturar lead quando o score comportamental passa o threshold ou existem sinais fortes de compra/CTA/checkout.
- Agendar antes do restante do funil quando a mensagem contém intenção explícita de agenda.
- Responder apenas informativamente quando Decision Core/Orchestrator/V19 bloqueiam oversell.

Na jornada comercial ele entra depois da mensagem do usuário e da detecção de intenção, mas antes da resposta final entregue ao widget/WhatsApp; em alguns caminhos, o scheduler roda ainda antes e interrompe todo o restante.

## SEÇÃO 2 — COMPONENTES ENVOLVIDOS

| Componente | Arquivo | Função principal | Responsabilidade | Dependências relevantes |
|---|---|---|---|---|
| Journey Stage | `server.js` | Variável `journeyStage` e atualização do lead | Classificar/propagar estágio, inclusive `agendamento` no bypass de agenda | `leadSystem`, `superInteligencia`, resposta do endpoint |
| Intent Detection | `lib/decision-core.js`, `lib/v17-orchestrator.js`, `lib/v17-link-resolver.js`, `lib/v19-deterministic-engine.js` | `detectIntent`, `resolveIntent` | Distinguir compra, informação, objeção, humano/suporte, saída, preço, agendamento indireto | Regex, atalhos semânticos, V17 fallback, estado de conversa |
| Lead Score | `lib/lead-capture-score.js` | `evaluateCapture` | Acumular score por conversa e decidir `shouldCapture` | Decision Core intent, V13 result, CTA candidate, checkout candidate, clique em CTA, inteligências |
| Lead Capture | `server.js`, `lib/lead-capture-score.js` | Retorno `leadCapture`, `markCaptured`, `markDismissed` | Exibir solicitação de contato e evitar repetição após captura/dispensa | `conversationId`, score session, `inteligencias`, checkout/CTA flags |
| Scheduler | `server.js`, `scheduling-manager.js`, `public/widget.js`, `whatsapp-channel.js` | `detectarAgendamento`, `generatePublicHash`, renderização de calendário | Priorizar agendamento e entregar `calendarHash`/`[CALENDAR_WIDGET]` | `apiKey`, `schedulingManager`, widget, canal WhatsApp |
| V17 | `lib/v17-orchestrator.js`, `lib/v17-link-resolver.js` | Orquestrador LLM-driven e resolver de link | V17 decide intent/estratégia; V17.3 trava CTA por intenção + link válido | Dados extraídos, checkout/WhatsApp, sanitizer |
| V18 | `lib/v18-extraction-guard.js`, `server.js` | Guard de extração e force CTA legado | Medir confiabilidade da extração; forçar CTA se checkout + buy quando V19 inativo | `processedPageData`, feature flags, `req.__forceBuyIntent` |
| V19 | `lib/v19-deterministic-engine.js`, `server.js` | `decide`, `applyDecision` | Fonte determinística de permissão de venda/CTA/checkout e limpeza de resposta | `conversationId`, `pageData`, `salesMode`, V17 intent |
| V20 | `server.js` | Observador de Camada 5 | Não intercepta; registra o que o legado teria bypassado | `inteligencias`, auditoria de logs |
| Decision Core | `lib/decision-core.js` | `buildDecision`, `shouldIncludeCheckout`, `shouldBlockCheckout` | Regra de ouro: checkout só para `buy`; bloqueio para info/objection/human/stress/neutral | Mensagem normalizada |
| Action Resolver | `lib/action-resolver.js` | `resolveAction` | Mapear intent para link correto (`checkout`, `whatsapp`, `instagram`) | `buildLinksMap`/mapa de links |
| Checkout Discovery | `lib/checkout-discovery.js`, `lib/checkout-click-discovery.js`, `lib/safe-checkout-resolver.js` | Descoberta/validação de checkout | Alimentar `checkoutLink` usado por CTA/orquestradores | Page data, links brutos, validação segura |
| Checkout Links Map | `lib/action-resolver.js`, `lib/v17-link-resolver.js` | `links.checkout`, `links.whatsapp`, `resolveBestLink` | Destino final de compra/suporte/fallback | Dados extraídos, WhatsApp como fallback |
| Conversation State | `lib/v19-deterministic-engine.js`, `lib/lead-capture-score.js` | Maps in-memory com TTL | Guardar stage/isBuyer/messageCount/score/captura por conversa | `conversationId`, TTL de 15 min ou 1 h |
| Orchestrator | `lib/orchestrator.js`, `lib/v17-orchestrator.js`, `server.js` | `apply`, pipeline endpoint | Controlar ordem final de bloqueios, links e resposta | Mode auto/manual/off, decision, CTA data, context |

## SEÇÃO 3 — FLUXO COMPLETO

Fluxo textual real consolidado:

```text
Mensagem do usuário
↓
Normalização / captura de inteligências / análise emocional
↓
[SCHED-PRIORITY] detectarAgendamento(message)
├─ se agendamento explícito → retorna resposta de agenda + calendarHash + journeyStage=agendamento; bypass KB/IA/CTA
└─ se não → continua
↓
Decision/Intent Detection
├─ Decision Core: checkout_issue > human > objection > post_sale > buy > info > interest > stress > neutral
├─ V17/V17.3: shortcuts, buy, support, guarantee, objection, explain, price, link_broken etc.
└─ V19: resolveIntent com prioridade exit/support > objection > buy > price > confusion > neutral
↓
Journey Stage / Conversation State
├─ V19 stage exiting/support/hesitating/confused bloqueia venda/CTA
├─ buy marca isBuyer=true
└─ neutral só herda buyer se stage anterior era ready/evaluating
↓
Lead Score
├─ soma sinais de intent, V13, temas comerciais, CTA/checkout candidates e engajamento
└─ shouldCapture se score ≥ 50 ou compra/READY_TO_BUY/checkoutCandidate/ctaCandidate, exceto despedida e exceto repetição
↓
Decision Core / V19 Permissions
├─ allowSell?
├─ allowCTA?
└─ allowCheckout?
↓
CTA Engine / Orchestrators
├─ Orchestrator bloqueia CTA/checkout/closing em info/objection/human/stress/neutral
├─ buy garante checkout/link e não adiciona CTA/Closing extra
├─ interest aceita CTA suave sem checkout forçado
├─ V19 remove CTA se allowSell=false
└─ V19 injeta checkout se allowCheckout=true e link ausente
↓
Ação escolhida
├─ Agendar
├─ Capturar lead
├─ Enviar checkout/compra
├─ Enviar WhatsApp/suporte
├─ Responder objeção/informação sem CTA
└─ Despedir/encerrar sem CTA
```

Bifurcações críticas:

- **Agendamento explícito** vence tudo, porque roda antes de KB-FIRST e retorna JSON imediatamente.
- **Modo não automático** bypassa V19/Orchestrator e evita interferência comercial automática.
- **Compra clara** é o único caminho de checkout no Decision Core e é um dos poucos caminhos de injeção no V19.
- **Preço** no V19 pode permitir venda/CTA, mas objeção de preço (`caro`, `muito caro`) vira bloqueio em V17.3/V19 conforme padrões.
- **Suporte/humano/WhatsApp** normalmente não vira checkout; Action Resolver manda para WhatsApp.
- **Objeção/confusão/saída** bloqueiam CTA/checkout e priorizam resposta informativa/retentiva.

## SEÇÃO 4 — TIPOS DE CTA

| Tipo | Gatilho | Prioridade real | Origem | Destino |
|---|---|---:|---|---|
| Compra direta / Finalizar compra | `buy`, `link_request`, `checkout_candidate`, `allowCheckout=true` | Alta, abaixo de scheduler e bloqueios de suporte/objeção | V17.3/V19/Orchestrator | `checkoutLink` |
| Checkout issue | Link errado/não abre/não consigo pagar | Alta, após bloqueios non-auto; reenvia link correto | Decision Core/Orchestrator/V17.3 | checkout ou WhatsApp em link quebrado V17.3 |
| CTA primário | `comprar`, ação `fechar`/`link_direto` | Média/alta; depende de não haver CTA forte prévio | `sales/cta-engine.js` | `context.url` ou WhatsApp em ready_to_buy/hesitation |
| CTA secundário / interesse | `interest`, `duvida`, ação `engajar` | Média; Orchestrator só permite em `interest` | `sales/cta-engine.js` + `lib/orchestrator.js` | Sem link forçado ou `context.url` |
| Objeção / prova | `objecao`, ação `quebrar_objecao`/`provar` | Baixa; muitas camadas bloqueiam oversell | `sales/cta-engine.js` | Texto suave, sem checkout garantido |
| Hesitação / garantia | ação `reter`, V17 guarantee | Baixa/média; pode usar WhatsApp se CTA Engine nominal | `sales/cta-engine.js`, V17 | WhatsApp ou resposta de garantia |
| Saída / retenção | `sair`, ação `reengajar` | Baixa; goodbye pode vencer | `sales/cta-engine.js`, `sales/anti-dropoff.js`, `server.js` | Texto de retenção, normalmente sem link |
| WhatsApp / especialista / humano | `human`, `support`, `contato`, `whatsapp` | Alta para suporte, mas não para compra | Decision Core, Action Resolver, V17.3 | `links.whatsapp` / `whatsappLink` |
| Captura / formulário | score ≥ 50 ou sinais fortes | Paralelo ao CTA; exibido como `leadCapture` | `lib/lead-capture-score.js`, widgets | Formulário de lead no widget/canal |
| Agendamento / calendário | frases explícitas de agenda | Máxima no endpoint | `server.js`, `scheduling-manager.js`, widget | `calendarHash`, `/agendar/:hash`, calendário embutido |
| Demonstração | “agendar call”, “marcar reunião”, contexto consultivo | Máxima se detectada como agendamento; senão consultivo/captura | `detectarAgendamento`, Lead Capture | calendário ou captura consultiva |

## SEÇÃO 5 — ORDEM DE PRIORIDADE

Ordem real encontrada:

1. **Modo/feature flag e bypasses**: modo manual/off desativa interferência automática nas camadas que respeitam `mode`/`salesMode`.
2. **Scheduler explícito (`SCHED-PRIORITY`)**: antes de KB, IA e CTA; retorna imediatamente.
3. **Despedida simples**: em `server.js`, se `sair=true` sem compra/contato direto, gera goodbye.
4. **Decision Core / V19 bloqueios**: info, objection, human, stress, neutral, support, exiting, hesitating e confused impedem checkout/CTA conforme camada.
5. **Checkout issue**: reenvio de link correto ou fallback WhatsApp em link quebrado.
6. **Buy / link_request / price forte**: permite checkout/CTA se há link e confiança suficiente.
7. **Lead Capture**: roda como avaliação paralela; pode disparar por compra/CTA/checkout/score, mas não substitui necessariamente a resposta.
8. **CTA suave de interest**: só entra quando não há decisão forte e o orquestrador permite.
9. **Resposta informativa/default**: fallback quando nada comercial é autorizado.

Resposta às perguntas de precedência:

- **Scheduler vence CTA?** Sim. O caminho `SCHED-PRIORITY` dá `return res.json` antes do fluxo principal.
- **Lead Capture vence CTA?** Não exatamente. Ele é paralelo e retorna um objeto de captura; não é a camada principal de texto. Porém `ctaCandidate`/`checkoutCandidate` podem disparar captura.
- **CTA vence resposta informativa?** Não nos caminhos protegidos. Decision Core/Orchestrator bloqueiam CTA/checkout em info/objection/human/stress/neutral; V19 remove CTA se `allowSell=false`.

## SEÇÃO 6 — REGRAS DE BLOQUEIO

CTA/checkout não devem aparecer quando:

- Intent é `info`, `objection`, `human`, `stress` ou `neutral` no Orchestrator.
- Decision Core `shouldBlockCheckout` retorna verdadeiro para `info`, `objection`, `human`, `stress`, `neutral`.
- V19 stage é `exiting`, `support`, `hesitating` ou `confused`.
- V19 `allowSell=false`; nessa situação ele remove blocos de `FINALIZAR COMPRA` e CTAs finais.
- Não existe checkout válido, ou a confiança dos dados é menor que `0.3` no V19.
- V17.3 `shouldShowCTA` recebe intent fora de `buy`, `link_request`, `support`, `link_broken`, `price_strong` ou link ausente.
- A mensagem é uma despedida e não há compra/contato direto.
- A resposta já contém CTA forte e o novo CTA é soft no CTA Engine nominal.
- O link é inválido/truncado/domínio sem path no sanitizer V17.
- A captura já foi mostrada/capturada/dispensada para a conversa.
- A mensagem de captura é despedida (`tchau`, `bye`, `adeus`, `valeu`, `obrigado`).

Proteções adicionais:

- V18 penaliza extrações suspeitas e pode marcar extração como parcial/falha.
- V19 mantém state TTL para resetar buyer após saída/suporte/objeção/confusão.
- V20 não intercepta; apenas registra telemetria para reduzir bypass hardcoded.

## SEÇÃO 7 — REGRAS DE CAPTURA

`lib/lead-capture-score.js` define um score acumulado por `conversationId`, TTL de 1 hora, e `CAPTURE_THRESHOLD = 50`.

Pontuações principais:

- `intent_buy`: 50
- `intent_interest`: 25
- `intent_info`: 10
- `intent_human`: 15
- `intent_post_sale`: 30
- `intent_objection`: 5
- `v13_ready_to_buy`: 50
- `v13_interest`: 25
- `v13_doubt`: 15
- `question_price`: 30
- `question_plan`: 25
- `question_hiring`: 30
- `question_implementation`: 20
- `question_integration`: 15
- `question_whatsapp`: 15
- `question_support`: 10
- `cta_click`: 40
- `checkout_candidate`: 40
- `cta_candidate`: 35
- `messages_5`: 10
- `messages_10`: 20
- `detection_purchase_intent`: 50
- `detection_high_interest`: 80 (definido na tabela, mas não aplicado no trecho auditado)

`shouldCapture` dispara quando todos estes grupos passam:

1. Não é despedida.
2. Não foi capturado/dispensado e `captureShown` ainda é falso.
3. Pelo menos uma condição é verdadeira:
   - score acumulado ≥ 50;
   - `dcIntent === 'buy'`;
   - `v13Result.intent === 'READY_TO_BUY'`;
   - `checkoutCandidate === true`;
   - `ctaCandidate === true`.

`captureContext`:

- `purchase`: `dcIntent=buy` ou V13 `READY_TO_BUY`.
- `post_sale`: `dcIntent=post_sale`.
- `support`: `dcIntent=human`.
- `evaluation`: `dcIntent=interest` ou V13 `INTEREST`.
- `consultive`: `dcIntent=info` ou V13 `DOUBT`.
- `default`: fallback.

Quando NÃO captura:

- Sem `conversationId`.
- Captura já feita/dispensada/mostrada.
- Despedida.
- Score abaixo de 50 sem sinal forte.
- Apenas mensagens/tempo não bastam; `messages_5` e `messages_10` são acumuladores, não gatilhos sozinhos.

## SEÇÃO 8 — REGRAS DE AGENDAMENTO

Agendamento é decidido por `superInteligencia.detectarAgendamento(message)` no `server.js` antes do KB-FIRST. A detecção exige frases explícitas como `quero agendar`, `marcar reunião`, `agendar consulta`, `ver horários`, `disponibilidade de horário` etc.; palavras genéricas como WhatsApp/falar/telefone foram removidas como gatilho isolado.

Quando detectado:

- O endpoint faz bypass total de KB, inteligências e IA.
- Atualiza histórico do lead, se houver lead efetivo.
- Registra billing de mensagem.
- Gera `calendarHash = schedulingManager.generatePublicHash(apiKey)`.
- Retorna `journeyStage: 'agendamento'`, `metadata.method: 'scheduling-priority'` e `response` com instrução/calendário.

`calendarHash`:

- É SHA-256 de `calendar_${apiKey}`, truncado para 16 caracteres.
- O widget usa esse hash para buscar/renderizar horários.
- Se o fluxo principal produzir `[CALENDAR_WIDGET]`, há uma proteção `CALENDAR-006` que injeta `calendarHash` mesmo sem passar pelo bypass de agenda.
- No WhatsApp, `calendarHash` pode virar URL `/agendar/:hash`.

Precedência sobre CTA:

- Agendamento explícito tem precedência absoluta sobre CTA, checkout, lead capture textual e IA.
- No fluxo principal, se `[CALENDAR_WIDGET]` aparecer, o hash é anexado; nesse caso não há bypass inicial, mas ainda há prioridade visual de calendário no widget.

## SEÇÃO 9 — DEPENDÊNCIAS OCULTAS

- **Scheduler ↔ CTA**: o scheduler não chama CTA Engine, mas por rodar antes e retornar cedo, cancela qualquer chance de CTA/checkout naquele turno.
- **Lead Capture ↔ CTA**: `ctaCandidate` e `checkoutCandidate` elevam captura; portanto uma mudança nas regras de CTA altera captura sem mexer no módulo de captura.
- **Lead Capture ↔ Decision Core/V13**: mudanças de classificação mudam score e contexto de captura.
- **WhatsApp ↔ CTA**: CTA Engine nominal troca URL para WhatsApp em `ready_to_buy`/`hesitation` quando há contato; Action Resolver manda `human` para WhatsApp; V17.3 usa WhatsApp como fallback sem checkout ou link quebrado.
- **Extraction Guard ↔ Checkout/CTA**: V18/V19 reduzem confiança quando a extração falha; isso bloqueia checkout mesmo que a intenção seja comercial.
- **Conversation State ↔ Compra futura**: V19 herda `isBuyer` em estados `ready/evaluating`; uma mensagem neutra após compra/preço pode continuar permitindo venda.
- **V20 ↔ Regressão de percepção**: V20 não altera resposta, mas logs de auditoria podem induzir análise equivocada se confundidos com decisão ativa.
- **CTA nominal ↔ Orchestrator**: `sales/cta-engine.js` pode gerar CTA, mas `lib/orchestrator.js` pode ignorar/remover conforme intent.
- **Link sanitizer ↔ Receita**: sanitização agressiva bloqueia links sem path ou truncados, reduzindo CTA em sites com checkout em domínio raiz.

## SEÇÃO 10 — MATRIZ DE DECISÃO

| Mensagem do usuário | Intent provável | Journey/State | Lead Score estimado | Ação escolhida |
|---|---|---|---:|---|
| “quero comprar agora” | buy | ready / isBuyer=true | +50 | Checkout/Finalizar compra; captura pode disparar |
| “me manda o link de compra” | buy / link_request | ready | +50 | Checkout direto se link confiável |
| “onde compro?” | buy/link_request | ready | +50 | Checkout ou fallback WhatsApp se sem checkout |
| “link de pagamento?” | buy | ready | +50 | Checkout |
| “quero pagar agora” | buy | ready | +50 | Checkout |
| “como funciona?” | info/explain | neutral/confused | +10 | Resposta informativa sem checkout |
| “me explica melhor” | info/explain | neutral/confused | +10 | Resposta explicativa sem CTA forte |
| “o que vem incluso?” | info | neutral | +10 | Informação; possível captura consultiva só se acumular score |
| “qual o preço?” | interest/price | evaluating | +30 | V19 pode permitir CTA/checkout sutil se dados confiáveis |
| “quanto custa?” | interest/price | evaluating | +30 | Condições/preço; CTA possível no V19 |
| “tem desconto?” | price | evaluating | +30 | Responder preço/condições; CTA sutil possível |
| “achei caro” | objection/price_objection | hesitating | +5 | Responder objeção; bloquear checkout |
| “isso é golpe?” | objection | hesitating | +5 | Prova/segurança; sem CTA de compra |
| “funciona mesmo?” | objection | hesitating | +5 | Responder objeção/prova; sem checkout |
| “não entendi nada” | objection/confusion | confused | +5 a +10 | Explicar novamente; sem CTA |
| “quero falar com alguém” | human/support | support | +15 | WhatsApp/humano; sem checkout |
| “tem WhatsApp?” | human/support | support | +15 | Link/contato WhatsApp |
| “preciso de suporte” | human/post_sale/support | support/post_sale | +10 a +30 | Suporte; sem CTA comercial |
| “já comprei e não recebi” | post_sale | pós-venda | +30 | Direcionar suporte/pós-venda; sem checkout |
| “meu login não chegou” | post_sale | pós-venda | +30 | Suporte pós-venda |
| “esse link não funciona” | checkout_issue/link_broken | issue | variável | Reenvia checkout ou WhatsApp fallback |
| “página não abre” | checkout_issue | issue | variável | Link oficial seguro se disponível |
| “quero agendar” | scheduling | agendamento | não prioritário | Calendar widget + calendarHash; bypass CTA |
| “marcar reunião” | scheduling | agendamento | não prioritário | Calendar widget + calendarHash |
| “ver horários” | scheduling | agendamento | não prioritário | Calendar widget + calendarHash |
| “agendar consulta” | scheduling | agendamento | não prioritário | Calendar widget + calendarHash |
| “tchau” | exit | exiting | 0 | Despedida sem CTA/captura |
| “obrigado” | exit/neutral | exiting/neutral | bloqueado se despedida | Sem captura; geralmente sem CTA |
| “legal” | interest/neutral | neutral | +25 se interest | CTA suave possível apenas se Orchestrator permitir interest |
| “gostei, quero saber mais” | interest | neutral/evaluation | +25 | CTA suave; captura se acumular ou CTA candidate |
| “tem garantia?” | interest/guarantee | evaluating/hesitation | +25 | Resposta de garantia; CTA suave/WhatsApp possível no CTA nominal |
| “posso cancelar?” | guarantee/objection | hesitating | +5 | Responder garantia; bloquear checkout forçado |
| “quero contratar” | buy/hiring | ready | +50 ou +30 | Checkout/captura |
| “como contrato?” | hiring/buy/info | ready ou consultive | +30 a +50 | Se buy claro, checkout; senão informação/captura |
| “tem integração com API?” | info + integration | consultive | +15/+10 | Informativo; captura consultiva pode acumular |
| “funciona com WhatsApp?” | info/human/integration | support ou consultive | +15 | Responder/WhatsApp; sem checkout se human |
| “vou pensar” | exit | exiting | 0 | Sem CTA; possível retenção leve se anti-dropoff ativo |
| “ok, manda” | neutral/link_request dependendo contexto | herda isBuyer se ready | variável | Pode vender se V19 herdou isBuyer |

## SEÇÃO 11 — MAPA DE RISCO

| Componente | Risco | Motivo |
|---|---|---|
| `server.js` pipeline principal | ALTO | Muitas decisões e precedências coexistem no endpoint; scheduler retorna cedo; V20 observa; lead capture e calendarHash são anexados no final. |
| Scheduler priority | ALTO | Bypass total antes da IA/CTA; falso positivo remove venda, falso negativo deixa agenda virar conversa comum. |
| V19 deterministic engine | ALTO | Remove ou injeta checkout/CTA no pós-processamento e mantém estado conversacional. |
| Decision Core | ALTO | Define regra de ouro do checkout; regex pequena pode reclassificar receita/suporte. |
| Lead Capture Score | MÉDIO/ALTO | Depende de sinais externos; CTA candidate dispara captura mesmo sem score alto. |
| V17 Link Resolver | MÉDIO/ALTO | Sanitiza e decide CTA/link; pode bloquear links válidos ou trocar por WhatsApp. |
| V18 Extraction Guard | MÉDIO | Afeta confiança e, indiretamente, checkout/CTA. |
| CTA Engine nominal | MÉDIO | Gera templates e WhatsApp override, mas é limitado por orquestradores. |
| Action Resolver | MÉDIO | Simples, mas erro no map de links manda usuário para destino errado. |
| Checkout Discovery/Map | ALTO | Fonte do link de receita; se falha, CTA vira WhatsApp ou some. |
| Conversation State | MÉDIO | In-memory/TTL; perda de estado muda decisão entre turnos. |
| V20 observer | BAIXO/MÉDIO | Não decide, mas logs podem mascarar entendimento operacional. |
| Widget calendário/captura | MÉDIO | Renderização depende de `calendarHash` e marcadores; falha visual muda ação do usuário. |
| WhatsApp Channel | MÉDIO | Adapta calendarHash e logs; canal pode transformar calendário em URL. |

## SEÇÃO 12 — CONCLUSÃO EXECUTIVA

Como o CTA Engine realmente funciona:

- Não há um único “CTA Engine” soberano. O comportamento final é a composição de Decision Core, Orchestrator, V17/V18/V19, scheduler, lead score, checkout discovery e widgets.
- `sales/cta-engine.js` escolhe texto de CTA, mas a exibição real depende das camadas posteriores/anexas.
- A decisão mais importante é a classificação de intenção: compra clara libera checkout; informação/suporte/objeção bloqueiam oversell.
- Agendamento explícito é o caminho mais prioritário e interrompe o fluxo comercial normal.
- Captura de lead é paralela e comportamental; ela não substitui o CTA, mas é acionada pelos mesmos sinais comerciais.

Módulos com maior poder de decisão:

1. `server.js`, por ordenar scheduler, IA, V20, lead capture e resposta JSON.
2. `lib/v19-deterministic-engine.js`, por decidir `allowSell`, `allowCTA`, `allowCheckout` e modificar a resposta final.
3. `lib/decision-core.js`, pela regra de ouro de checkout apenas em `buy`.
4. `scheduling-manager.js` + `detectarAgendamento`, por priorizar calendário acima da venda.
5. Checkout discovery/resolvers, por fornecer ou negar o destino final.

Dependências com maior potencial de regressão futura:

- Regex de intenção em Decision Core/V17/V19.
- Ordem do scheduler no `server.js`.
- Critérios de confiança V18/V19 sobre `checkoutLink`.
- Sinais `ctaCandidate`/`checkoutCandidate` alimentando captura.
- Estado in-memory por `conversationId`.
- WhatsApp como fallback de compra/suporte.

Componentes que exigem auditoria obrigatória antes de qualquer V22:

- `server.js` nos blocos de scheduler, V20, lead capture, retorno JSON e qualquer pós-processamento de resposta.
- `lib/v19-deterministic-engine.js` inteiro.
- `lib/decision-core.js` e `lib/v17-link-resolver.js` para regex e bloqueios.
- `lib/lead-capture-score.js` para efeitos colaterais de captura.
- `lib/checkout-discovery.js`, `lib/checkout-click-discovery.js`, `lib/safe-checkout-resolver.js` e `lib/action-resolver.js` para destino de links.
- `scheduling-manager.js`, `public/widget.js`, `public/widget-inline-generator.js`, `public/widget-v2.js` e `whatsapp-channel.js` para calendarHash/renderização.
