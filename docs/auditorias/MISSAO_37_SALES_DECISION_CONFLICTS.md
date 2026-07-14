# MISSÃO 37 — SALES DECISION CONFLICTS

Auditoria técnica focada exclusivamente em conflitos entre motores de decisão comercial do Link Mágico. Este documento não propõe correções; apenas registra diagnóstico com evidências de código.

## Seção 1 — Visão geral

### Cadeia real de decisão comercial

A cadeia comercial observada é composta por camadas parcialmente sobrepostas:

1. **Endpoint / roteamento inicial** em `server.js`: recebe mensagem, processa dados de página, calcula prioridade de agendamento, suporte e compra em caminhos de bypass.
2. **Intent Detection legado** via `SistemaCapturaInteligencias`: flags booleanas como `contatoDireto`, `linkSite`, `bonus`, `suporte` e, em outros trechos do servidor, `intencao_compra`.
3. **Journey Stage** via `JourneyAnalyzer.analyzeJourneyStage`: classifica a mensagem em `descoberta`, `negociacao` ou `fidelizacao`; se não há palavra-chave, retorna `descoberta`.
4. **Decision Core V10.1**: classifica intenção granular (`buy`, `info`, `interest`, `human`, `post_sale`, etc.) e define se checkout deve ser incluído ou bloqueado.
5. **Conversation State V11**: traduz a intenção em estágio de conversa (`decision`, `discovery`, `consideration`, `neutral`, etc.) e mantém memória in-memory com TTL.
6. **V17 Orchestrator**: cria estratégia comercial própria, com `sellMode`, `allowCheckout`, `allowCheckoutOnPrice`, `fallbackToWhatsApp` e prompt dinâmico.
7. **V18 / CTA forcing / fallback**: camadas de extração e failsafe podem forçar CTA no fim quando a resposta não contém checkout.
8. **V19 Deterministic Engine**: quando ativo decide `intent final`, `allowSell`, `allowCTA`, `allowCheckout`; em modo `shadow` apenas registra divergências contra legado.
9. **V20 Observer**: rebaixa a antiga camada interceptadora para observadora, logando o que teria bypassado sem impedir a chamada à IA.
10. **CTA Engine / Link Resolver / Channel Resolver**: monta ou remove CTA, injeta link, converte CTA para botão ou texto dependendo do canal.
11. **Lead Capture Score**: avalia sinais independentes e retorna `shouldCapture`.
12. **Scheduler**: gera `calendarHash` quando a resposta contém widget/calendário ou quando o caminho de prioridade de agendamento assume controle.
13. **Canal de saída**: Widget renderiza botão/form/calendário; WhatsApp traduz CTA, captura e agendamento para texto.

### Ordem real de execução identificada

Ordem simplificada do fluxo principal:

1. Rotas early-return de agendamento/suporte/compra podem responder antes da geração normal de IA.
2. Se não houver early-return, o servidor calcula `journeyStage` com `journeyAnalyzer.analyzeJourneyStage(message)`.
3. O servidor executa V20 como observador, sem interceptar, e chama `generateAIResponse`.
4. A resposta passa por orchestrator / decision layers / CTA resolvers / V18 fallback / V19 apply ou shadow.
5. O servidor calcula lead capture ao final, como observador não bloqueante.
6. O JSON final retorna `response`, `cta`, `calendarHash`, `journeyStage`, `leadCapture` e diagnósticos.
7. O cliente/canal decide renderização final: widget mostra captura inline; WhatsApp injeta CTA inline e pode adiar calendário se captura estiver pendente.

Evidências principais: o servidor possui caminhos de bypass para scheduler, suporte e compra antes do fluxo principal; o fluxo principal calcula `journeyStage`, executa V20 observer, chama `generateAIResponse`, aplica V19/V18.4, avalia lead capture e retorna todos os sinais no JSON final.

## Seção 2 — Inventário de motores

| Motor | Responsabilidade | Entradas | Saídas | Dependências |
|---|---|---|---|---|
| Intent Detection legado | Detectar flags comerciais e operacionais por texto | `mensagem` | Flags como `contatoDireto`, `linkSite`, `bonus`, `detalhesBonus`, `experiencia`, `suporte`; no servidor também aparece `intencao_compra` | `JourneyAnalyzer/SistemaCapturaInteligencias`, `server.js` |
| Journey Stage | Classificar etapa em `descoberta`, `negociacao`, `fidelizacao` | Mensagem do usuário | `journeyStage` | Palavras-chave em `lib/ai-systems/journey-analyzer.js` |
| Decision Core | Classificar intenção granular e decidir override/checkout | Mensagem normalizada | `intent`, `shouldOverride`, `shouldIncludeCheckout`, `shouldBlockCheckout` | Regexes em `lib/decision-core.js` |
| CTA Engine / Link Resolver | Determinar se CTA aparece, remover CTA textual e montar CTA seguro | Intent + link | `shouldShowCTA`, `buildCTA`, texto sem CTA antigo | `lib/v17-link-resolver.js`, `server.js` |
| Lead Capture | Pontuar sinais e decidir captura inline | ConversationId, message, flags de inteligência, CTA e checkout candidatos | `{ shouldCapture, score, signals, captureMessage, captureContext }` | `lib/lead-capture-score.js`, `server.js`, widget/WhatsApp |
| Scheduler | Acionar agendamento e gerar `calendarHash` | Intenção de agendamento, resposta com `[CALENDAR_WIDGET]`, API key | `calendarHash`, link `/agendar/:hash`, widget de agenda | `scheduling-manager.js`, `server.js`, widget, WhatsApp |
| Conversation State | Manter estágio conversacional por sessão | `conversationId`, `intent`, `message` | `stage`, `lastIntent`, `intentHistory`, `messageCount` | Map in-memory em `lib/conversation-state.js` |
| Orchestrator | Centralizar decisão de resposta/CTA em modo V10/V17 | Decision Core, resposta, pageData, estratégia | Resposta final, CTA ou bypass conforme modo | `lib/orchestrator.js`, `lib/v17-orchestrator.js`, feature flags |
| V17 | Estratégia LLM-driven com venda direta/soft/educational/neutral | Mensagem, dados extraídos, histórico | `intent`, `sellMode`, `allowCheckout`, `allowWhatsApp`, prompt | `lib/v17-orchestrator.js`, link resolver |
| V18 | Guard/extraction/fallback/failsafe de CTA | Page data, links descobertos, checkout disponível, resposta | Dados de extração confiáveis/fallback e possível CTA forçado | `lib/v18-extraction-guard.js`, `server.js` |
| V19 | Motor determinístico final ou shadow | Mensagem, pageData, intent V17/legado, estado | `allowSell`, `allowCTA`, `allowCheckout`; aplicação ou log diff | `lib/v19-deterministic-engine.js`, `server.js` |
| V20 | Auditoria de bypass legado sem interceptar | `inteligencias`, mensagem, resposta final | Logs `wouldBypassLegacy`, `legacyReason` | `server.js` |

## Seção 3 — Conflitos de intenção

### 3.1 Compra direta: Decision Core/V17 identificam compra, Journey pode ficar neutra/descoberta

* **Mensagem exemplo:** `quero pagar agora`.
* **Decision Core:** classifica como `buy` porque contém `quero pagar agora` / `pagar agora`.
* **V17:** também permite venda direta para `buy`.
* **Journey Stage:** só reconhece negociação por termos como `preço`, `valor`, `pagamento`, `comprar`, `adquirir`, etc. Se a frase contiver `pagar` sem `pagamento`, `comprar` ou outro termo listado, a pontuação pode ser zero e o retorno default é `descoberta`.
* **Conflito:** comprador é tratado simultaneamente como `buy/direct` e `descoberta`.
* **Evidência:** Decision Core define `buy` para `quero pagar`, `pagar agora` e `finalizar compra`; Journey retorna `descoberta` quando `maxScore === 0`.

### 3.2 Link genérico: Intent Detection legado marca linkSite, Decision Core evita compra

* **Mensagem exemplo:** `me manda o link`.
* **Intent Detection legado:** `linkSite=true` para qualquer ocorrência de `link`, `site`, `url`, `página`.
* **Decision Core:** removeu `link` genérico da compra e só aceita `me manda o link de compra`, `link de pagamento` ou `link de checkout`.
* **Conflito:** uma camada entende solicitação de link/site; outra não entende compra.
* **Impacto:** fluxo pode gerar resposta informativa ou site oficial em vez de checkout.

### 3.3 WhatsApp/contato: canal humano versus compra/condução

* **Mensagem exemplo:** `quero falar no whatsapp para comprar`.
* **Decision Core:** regra `human` roda antes de `buy`; presença de `whatsapp`/`quero falar` encerra como `human`.
* **Journey Stage:** pode cair em `negociacao` por `comprar`.
* **V17:** `support`/default vira `neutral`, mas `buy`/`link_request` vira direto conforme seu detector próprio.
* **Conflito:** contato humano pode neutralizar compra explícita no Decision Core, enquanto Journey enxerga negociação.

### 3.4 Preço: V17 trata como venda direta; Decision Core trata como interesse

* **Mensagem exemplo:** `quanto custa?`.
* **Decision Core:** classifica `interest`, não `buy`.
* **Conversation State:** `interest` vira `consideration`.
* **V17:** `price` recebe `sellMode='direct'` e `allowCheckoutOnPrice=true` se houver checkout.
* **Conflito:** uma camada considera interesse leve; outra permite link comercial.

### 3.5 Pós-venda com palavra de compra/pagamento

* **Mensagem exemplo:** `já paguei, cadê meu acesso?`.
* **Decision Core:** `post_sale` roda antes de buy.
* **Journey Stage:** `pagamento` pode pontuar `negociacao`; `suporte`/`acesso` pode pontuar `fidelizacao` dependendo dos termos.
* **Conflito:** o sistema pode registrar negociação/fidelização enquanto Decision Core bloqueia venda e prioriza suporte.

## Seção 4 — Conflitos de Journey Stage

### 4.1 Estágio default `descoberta` para ausência de keyword

O `JourneyAnalyzer` retorna `descoberta` quando nenhuma palavra-chave pontua. Isso conflita com compradores que usam verbos de fechamento ausentes da lista de negociação, como `fechar`, `levar`, `ativar agora`, `finalizar`.

**Impacto comercial:** lead com compra explícita pode ser reportado como topo de funil no JSON final, nos metadados de lead e em analytics.

### 4.2 Journey Stage não acompanha Decision Core granular

Decision Core possui `buy`, `interest`, `human`, `post_sale`, `checkout_issue`, `stress`; Journey Stage só possui três categorias. A tradução é imperfeita:

* `buy` pode virar `negociacao` ou `descoberta`.
* `human` pode virar `fidelizacao` se houver `whatsapp`/`telefone`.
* `interest` por preço pode virar `negociacao`, embora Conversation State diga `consideration`.
* `checkout_issue` não tem categoria dedicada em Journey Stage.

### 4.3 Lead atualizado com estágio contraditório

O servidor atualiza o lead com `journeyStage` calculado por palavras-chave. Se outro motor decide compra/checkout, o cadastro do lead ainda pode receber `descoberta`.

## Seção 5 — Conflitos de CTA

### 5.1 CTA gerado/permitido por uma camada, removido por V19

V19 declara que apenas ele decide `allowCTA` e `allowCheckout` quando ativo. Se `allowSell=false`, a aplicação remove qualquer CTA/checkout da resposta, mesmo que camada anterior tenha forçado ou gerado CTA.

**Causa:** hierarquia superior do V19 ativo.

### 5.2 V18.4 força CTA quando resposta não contém checkout, mas V19 pode bloquear

No servidor, em modo shadow, V18.4 legado ainda pode rodar e forçar CTA se `__forceCTA` está ativo e a resposta não contém checkout. Quando V19 está ativo, `applyDecision` roda sobre a resposta final e pode remover/corrigir CTA.

**Conflito:** V18 tenta recuperar venda; V19 pode negar por confiança/intenção/estado.

### 5.3 Orchestrator V10 é bypassado quando `__forceCTA` está ativo

O fluxo registra explicitamente que, se `__forceCTA` estiver ativo, o Orchestrator V10 é bypassado porque “ele mata o CTA”. Isso é evidência direta de conflito entre CTA forcing e Orchestrator.

### 5.4 V17 prompt proíbe URLs; Link Resolver injeta CTA depois

V17 instrui o LLM a nunca escrever URLs e, em paralelo, diz que o link será exibido automaticamente abaixo. Se a etapa posterior não injeta o CTA, a resposta pode dizer “link abaixo” sem link.

### 5.5 Sales mode `off`/`manual` conflita com CTA automático

V17 monta prompt “Sem vendas, sem CTA” em `salesMode='off'`, mas camadas posteriores como V18 fallback/V19 apply/Link Resolver podem operar independentemente do texto do prompt se as flags permitirem.

### 5.6 WhatsApp injeta CTA inline; widget renderiza separado

O WhatsApp pega `aiResult.cta` e concatena texto/link na mensagem. O Widget mantém `cta` separado. A mesma decisão central vira duas experiências diferentes, e falhas de adaptação no WhatsApp são capturadas como “sem impacto”, podendo deixar CTA não aplicado no canal.

## Seção 6 — Conflitos de Lead Capture

### 6.1 `shouldCapture=true` não captura automaticamente no backend

Lead Capture Score é avaliado no final como “observer only — não altera resposta/intent/CTA”. O servidor retorna `leadCapture` no JSON; a captura real depende do cliente/canal.

**Fluxo completo:**

1. Backend calcula `_leadCaptureResult`.
2. Se `shouldCapture=true`, apenas loga “CAPTURA DISPARADA”.
3. JSON inclui `leadCapture`.
4. Widget, se `CHAT_FIRST` e `!inlineCaptured`, chama `showInlineCapture`.
5. WhatsApp adiciona pergunta textual se `!lead?.email_captured`.

**Conflito:** motor de captura decide, mas execução é delegada ao canal.

### 6.2 Bloqueio por lead já presente ou leadId

O backend só avalia captura quando há `conversationId` e não há `req.body.leadId`. Assim, um lead parcial ou um leadId sem email pode impedir a avaliação de captura inline.

### 6.3 WhatsApp adia Scheduler quando captura está pendente

No WhatsApp, se há `calendarHash` mas também `leadCapture.shouldCapture=true` e não há dados do lead, o agendamento é adiado. Logo, um sinal de captura bloqueia a execução do scheduler no canal.

### 6.4 Erro do widget não retorna ao motor

Se o widget falha ao mostrar formulário inline ou o usuário ignora, o backend não recebe confirmação imediata. O motor marcou `shouldCapture`, mas o estado comercial pode seguir sem captura efetiva.

## Seção 7 — Conflitos de Scheduler

### 7.1 Intenção de agendamento early-return versus fluxo principal

O servidor tem caminho de prioridade `SCHED-PRIORITY` com bypass LLM, `calendarHash` e `journeyStage='agendamento'`. No fluxo principal, há correção posterior que injeta `calendarHash` se a resposta contém `[CALENDAR_WIDGET]`.

**Conflito:** há dois modos de acionar scheduler: prioridade antes da IA e detecção posterior por marcador no texto.

### 7.2 Scheduler depende de marcador textual no fluxo principal

Se a IA entende intenção de agendar mas não produz `[CALENDAR_WIDGET]`, o fallback `CALENDAR-006` não injeta `calendarHash`.

### 7.3 WhatsApp bloqueia agenda até captura

Mesmo com `calendarHash`, o WhatsApp só envia URL se o lead tem dados ou se a captura não foi pedida. Portanto, uma intenção de agenda pode ser adiada por Lead Capture.

### 7.4 Widget tenta obter hash alternativo

O widget armazena `data.calendarHash`, mas também tenta obter hash por `/api/availability` se a resposta contém `[CALENDAR_WIDGET]` e o backend não enviou hash. Isso cria uma terceira decisão de scheduler no cliente.

## Seção 8 — Conflitos de Decision Core

### 8.1 Decision Core recomenda checkout apenas para `buy`, mas V17 permite em `price`

Decision Core: checkout só quando `intent === 'buy'`. V17: `price` tem `allowCheckoutOnPrice=true`. Conflito direto de política comercial.

### 8.2 Decision Core bloqueia checkout para `human`; Journey/Intent legado podem tratar como contato comercial

Pedido de WhatsApp é `human` no Decision Core e bloqueia checkout, mas `SistemaCapturaInteligencias` responde com WhatsApp/telefone e Journey pode classificar como `fidelizacao`.

### 8.3 Decision Core `shouldOverride` não cobre `interest`

Preço/valor vira `interest`, mas `shouldOverride=false`. Em paralelo, V17 considera preço suficientemente comercial para modo direto. Isso deixa preço dependente do orchestrator/CTA posterior.

### 8.4 `checkout_issue` é override, mas não compra

Decision Core trata problema de checkout como override, Conversation State vira `support`, Journey pode não identificar suporte. Camadas comerciais podem divergir entre suporte e recuperação de venda.

## Seção 9 — Conflitos de Conversation State

### 9.1 Estado in-memory com expiração causa perda de contexto

Conversation State usa `Map` em memória, limpeza a cada 10 minutos e expiração em 30 minutos. Reinício de processo ou TTL apagado retorna estado padrão neutro.

### 9.2 Ausência de `conversationId` retorna estado neutro

Se não há `conversationId`, `getState` e `updateState` retornam estado default, neutralizando intenção/histórico.

### 9.3 Atualização sobrescreve estágio com última intenção

`updateState` calcula `stage` apenas pela intenção atual. Uma sequência `buy` → `ok` pode levar `lastIntent='neutral'` e `stage='neutral'`, mesmo que o histórico contenha compra.

### 9.4 V19 possui estado próprio com TTL diferente

V19 mantém `_v19ConversationState` com TTL de 15 minutos, enquanto V11 usa 30 minutos. A mesma conversa pode estar “compradora” em um estado e expirada/neutra no outro.

## Seção 10 — Conflitos entre canais

### Link Curto / Widget / WhatsApp

* **Widget:** recebe `cta` estruturado e pode renderizar botão; recebe `leadCapture` e abre formulário inline; recebe `calendarHash` e renderiza calendário.
* **WhatsApp:** recebe a mesma resposta central, adapta texto, injeta CTA como URL inline, transforma captura em pergunta textual e transforma `calendarHash` em link `/agendar/:hash` apenas se lead capturado ou sem captura pendente.
* **Link Curto / endpoint central:** retorna JSON com todos os sinais, mas não garante execução final.

### Exemplos de divergência da mesma mensagem

| Mensagem | Link Curto / Widget | WhatsApp | Conflito |
|---|---|---|---|
| `quero comprar` | Pode renderizar CTA estruturado como botão | Injeta CTA inline no texto | Mesma decisão, formato e rastreabilidade diferentes |
| `quero agendar uma reunião` com `shouldCapture=true` | Pode mostrar captura inline e/ou calendário conforme widget | Agenda adiada até captura | Scheduler bloqueado por canal |
| `me manda o link` | Pode ser tratado como site/link genérico ou sem checkout | CTA só aparece se pipeline retornou `cta` | Link genérico diverge da intenção de compra |

## Seção 11 — Conflitos entre pipelines V17, V18, V19, V20

| Pipeline | Decisão própria | Conflito observado |
|---|---|---|
| V17 | Define `sellMode`, `allowCheckout`, `allowCheckoutOnPrice`, `fallbackToWhatsApp` | Pode permitir checkout em preço, enquanto Decision Core não considera compra |
| V18 | Fallback/extraction/force CTA | Pode forçar CTA que Orchestrator mataria e que V19 ativo removeria |
| V19 | Pretende ser fonte única de `intent final`, `allowSell`, `allowCTA`, `allowCheckout` | Em shadow não executa, só loga divergências; em ativo sobrescreve legado |
| V20 | Apenas observa bypass legado | Registra que camada antiga teria interceptado, mas deixa IA responder; conflito vira telemetria, não execução |

Conflito estrutural: o próprio comentário do V19 afirma que ele substitui conflitos entre V18.1/V18.2/V18.3/V18.4/PP-GLOBAL/IS_BUYER e que nenhum outro módulo deveria sobrescrever CTA/intent; porém o servidor ainda mantém modos legacy/shadow/fallback, criando coexistência de políticas.

## Seção 12 — Matriz de conflitos

| Motor A | Motor B | Conflito | Impacto Comercial | Frequência estimada |
|---|---|---|---|---|
| Decision Core | Journey Stage | `buy` vs `descoberta` quando frase de compra não está nas keywords de jornada | Lead comprador reportado como topo de funil | Alta |
| Decision Core | V17 | `interest` para preço vs `sellMode=direct`/checkout em preço | CTA inconsistente em perguntas de preço | Alta |
| Intent legado | Decision Core | `linkSite=true` para `link` genérico vs compra bloqueada | Checkout pode não aparecer em pedido ambíguo | Alta |
| V18 CTA fallback | Orchestrator | Force CTA bypassa Orchestrator porque ele “mata o CTA” | Resposta final depende de ordem técnica | Média |
| V18 CTA fallback | V19 | CTA forçado pode ser removido por `allowSell=false` | Compra recuperada por uma camada e perdida por outra | Média |
| Lead Capture | Scheduler | Captura pendente adia agenda no WhatsApp | Lead quente não agenda imediatamente | Média |
| Conversation State V11 | V19 State | TTL 30 min vs 15 min | Estados divergentes na mesma sessão | Média |
| V20 | Camada 5 antiga | Antes bypassava; agora só observa | Mesmas flags não produzem mesma ação histórica | Média |
| Widget | WhatsApp | CTA botão vs CTA inline | Rastreabilidade e UX divergentes | Alta |
| Scheduler early | Scheduler marker | Early-return vs `[CALENDAR_WIDGET]` | Agenda depende do caminho de execução | Média |
| Decision Core | Lead Capture | Compra/CTA pode ocorrer antes da captura ou captura depois da resposta | Perda de dados do lead antes do clique | Média |
| Conversation State | Decision Core | Última mensagem neutra reseta estágio | Comprador perde contexto após “ok/sim” | Alta |

## Seção 13 — Top 20 conflitos mais graves

1. **Compra clara classificada como `buy`, mas Journey retorna `descoberta`** — afeta analytics, lead metadata e condução.
2. **Preço como `interest` no Decision Core, mas venda direta no V17** — política de CTA inconsistente em intenção comercial comum.
3. **V18 força CTA, V19 pode remover** — camadas finais contraditórias no fechamento.
4. **Orchestrator bypassado por `__forceCTA`** — evidência explícita de conflito operacional.
5. **Lead Capture decide `shouldCapture=true`, mas backend não captura** — decisão não executada sem canal.
6. **Scheduler adiado por captura no WhatsApp** — agendamento de lead quente bloqueado.
7. **Journey Stage com default `descoberta`** — muitos termos não mapeados viram topo de funil.
8. **Pedido de WhatsApp classificado como `human` antes de compra** — compra com canal humano pode perder checkout.
9. **`link` genérico ativa linkSite, mas não compra** — pedido ambíguo diverge.
10. **Conversation State reseta estágio pela última intenção neutra** — perda de intenção acumulada.
11. **TTL V11 e TTL V19 diferentes** — memória comercial inconsistente.
12. **V20 observa em vez de interceptar** — flags que antes desviavam fluxo agora apenas logam.
13. **Scheduler por early-return e por marcador textual** — dois gatilhos de agenda não equivalentes.
14. **Widget e WhatsApp executam CTA de formas diferentes** — mesma decisão tem output distinto.
15. **V17 proíbe URLs no prompt e depende de injeção posterior** — falha posterior deixa promessa sem link.
16. **Decision Core não faz override para `interest`** — preço pode depender de outras camadas.
17. **`checkout_issue` sem Journey dedicado** — recuperação de compra vira suporte/descoberta.
18. **Lead com `leadId` pula avaliação de captura** — captura parcial pode bloquear enriquecimento.
19. **Fallback WhatsApp quando não há checkout conflita com venda direta** — comprador recebe contato em vez de link.
20. **Cliente tenta scheduler fallback por `/api/availability`** — decisão de agenda migra para frontend.

## Seção 14 — Fluxo de uma compra ideal

### Fluxo ideal

Mensagem: `quero comprar agora`
↓
Intent: compra explícita (`buy` / `ready_to_buy`)
↓
Journey: negociação/decisão
↓
Decision: permitir venda, CTA e checkout
↓
CTA: botão/link de checkout válido
↓
Lead Capture: captura se score/threshold exigir, sem bloquear checkout crítico
↓
Scheduler: só se a intenção for agenda ou se o produto exigir reunião

### Comportamento real encontrado

* Intent pode ser `buy` no Decision Core.
* Journey pode ser `descoberta` se a frase não bater nas keywords.
* V17 pode permitir checkout se detectar `buy`, mas também tem política própria para `price`.
* V18 pode forçar CTA se a resposta final não o contém.
* V19 ativo pode remover CTA se `allowSell=false`/`allowCheckout=false`.
* Lead Capture é avaliado depois da resposta e depende do canal para executar.
* WhatsApp pode adiar scheduler se captura estiver pendente.

## Seção 15 — Fluxo de uma compra perdida

### Cenário A — Compra com frase fora das keywords de Journey

Mensagem: `vou levar, manda pra finalizar`
↓
Decision Core/V17 podem ver compra conforme detector; Journey pode retornar `descoberta`
↓
Resposta comercial depende de camadas finais
↓
CTA pode ou não ser aplicado conforme V18/V19
↓
Lead metadata fica topo de funil

**Quebra:** Journey Stage não acompanha intenção de compra.

### Cenário B — Preço com CTA contraditório

Mensagem: `quanto custa?`
↓
Decision Core: `interest`
↓
Conversation State: `consideration`
↓
V17: `price` com venda direta e checkout em preço
↓
V19 pode permitir ou negar CTA conforme seu score/estado

**Quebra:** política de CTA para preço é divergente.

### Cenário C — Agendamento com captura pendente no WhatsApp

Mensagem: `quero agendar uma reunião`
↓
Scheduler gera `calendarHash`
↓
Lead Capture retorna `shouldCapture=true`
↓
WhatsApp pergunta captura e adia link de agenda

**Quebra:** Scheduler não executa no canal até captura.

### Cenário D — CTA forçado e removido

Mensagem de compra com checkout disponível
↓
V18.4 força CTA por ausência no texto
↓
V19 ativo aplica decisão final
↓
Se `allowSell=false`, CTA removido

**Quebra:** duas camadas finais disputam a ação comercial.

## Seção 16 — Conclusão executiva

1. **Maior conflito comercial encontrado:** coexistência de motores finais de CTA/checkout — V17/V18/Orchestrator/V19 — com políticas diferentes e ordem de aplicação capaz de gerar, bypassar ou remover CTA.
2. **Motor com mais divergências:** Journey Stage, por ter vocabulário estreito e três categorias, diverge de Decision Core, V17, Conversation State e Lead Capture.
3. **Conflito que causa mais perda de conversão:** CTA permitido/forçado por uma camada e removido/bloqueado por outra, especialmente V18 versus V19/Orchestrator.
4. **O sistema sabe identificar compradores?** Parcialmente. Decision Core e V17 têm sinais claros de compra, mas não compartilham a mesma taxonomia e não garantem alinhamento com Journey/State.
5. **O sistema sabe conduzir compradores?** Parcialmente. Existem mecanismos de CTA, checkout, fallback WhatsApp, captura e scheduler, mas eles não são uma cadeia única; são camadas concorrentes.
6. **Onde a cadeia perde eficiência?** Na transição intenção → jornada → CTA final → captura/scheduler por canal. A decisão não é atômica e pode ser reclassificada depois.
7. **Principal problema:** conflito entre motores, com efeitos secundários em classificação, condução, CTA, captura e scheduler.

## Evidências de código consultadas

* `lib/decision-core.js`: categorias, regexes e política “checkout só em buy”.
* `lib/ai-systems/journey-analyzer.js`: keywords de jornada e fallback para `descoberta`.
* `lib/conversation-state.js`: stage derivado da intenção atual, estado in-memory e fallback neutro.
* `lib/v17-orchestrator.js`: estratégia, sell modes, checkout em buy/link_request/price e prompt sem URLs.
* `lib/v17-link-resolver.js`: regras de exibição e construção de CTA.
* `lib/v19-deterministic-engine.js`: fonte determinística de `allowSell`, `allowCTA`, `allowCheckout`, diff com legado e remoção/injeção final.
* `lib/lead-capture-score.js`: pontuação e retorno `shouldCapture`.
* `server.js`: ordem real, early returns, V20 observer, V18/V19 apply, lead capture e JSON final.
* `whatsapp-channel.js`: adaptação de CTA, captura e scheduler para WhatsApp.
* `public/widget*.js` e trecho embutido em `server.js`: execução client-side de captura e calendário.
