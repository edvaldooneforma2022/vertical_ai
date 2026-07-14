# MISSÃO 36 — Sales Intelligence Audit

## Escopo

Este documento audita exclusivamente a capacidade conversacional de vendas da IA do Link Mágico. O foco é o diagnóstico técnico dos mecanismos reais de venda observáveis no código: Journey Stage, Intent Detection, CTA Engine, Lead Capture, Conversation State e Decision Core.

Fora do escopo: arquitetura, deploy, extração de dados, infraestrutura e sugestões de correção.

## Resumo executivo do diagnóstico

A inteligência de vendas é composta por camadas determinísticas e pós-processadores que classificam intenção comercial, estágio de jornada, objeções, urgência, pedido de contato, captura de lead, CTA e agendamento. A IA não depende apenas do LLM para vender: existem regras explícitas de palavras-chave, scores, estados de conversa e guardrails de CTA.

O fluxo comercial real pode ser resumido assim:

1. A mensagem entra no endpoint de chat inteligente ou no canal WhatsApp.
2. A mensagem é analisada por regras de jornada e intenções.
3. O sistema classifica se o lead está em descoberta, negociação, fidelização ou em estados determinísticos como ready, evaluating, hesitating, support, confused e exiting.
4. O Decision Core/V19 decide se pode vender, se pode mostrar CTA e se pode injetar checkout.
5. O CTA Engine resolve qual link usar: checkout, WhatsApp ou nenhum.
6. O Lead Capture Score decide se deve pedir dados do lead com base em intenção, sinais comerciais e score acumulado.
7. O agendamento é disparado apenas quando há frase explícita de marcação/agendamento.
8. O frontend/WhatsApp traduz o retorno em formulário inline, link de agenda ou CTA clicável.

## 1. Como a IA identifica que um lead quer comprar?

A IA identifica intenção de compra por múltiplas camadas reais:

### 1.1 Sistema de inteligências no servidor

O objeto `inteligencias` marca `intencao_compra = true` quando a mensagem contém expressões como:

- `contratar`
- `contratação`
- `quero comprar`
- `vou comprar`
- `onde pago`
- `como assino`
- `quero ativar`
- `vamos fechar`
- `quero começar`
- `quero assinar`
- `como compro`
- `quero adquirir`
- `como faço para comprar`

Exemplos reais:

| Mensagem do lead | Decisão esperada |
|---|---|
| `quero comprar` | `intencao_compra = true` |
| `como compro?` | `intencao_compra = true` |
| `quero assinar` | `intencao_compra = true` |
| `vamos fechar` | `intencao_compra = true` |
| `onde pago?` | `intencao_compra = true` |

### 1.2 Decision Core V10.1

O `decision-core` classifica a intenção como `buy` apenas para expressões inequívocas de compra, como:

- `quero comprar`
- `quero pagar`
- `quero adquirir`
- `quero assinar`
- `quero contratar`
- `quero garantir`
- `como compro`
- `onde compro`
- `me manda o link de compra`
- `link de pagamento`
- `link de checkout`
- `vou levar`
- `bora fechar`
- `fechar negocio`
- `pagar agora`

Regra central: checkout só deve aparecer quando a intenção é `buy`.

### 1.3 V17 Link Resolver

O V17 identifica intenção `buy` quando há termos como `comprar`, `quero comprar`, `finalizar`, `checkout` ou `pagar`. Também trata `link_request` e `price_strong` como intenções elegíveis a CTA.

Exemplos reais:

| Mensagem | Intent V17 | Efeito |
|---|---:|---|
| `quero comprar` | `buy` | CTA permitido se houver link válido |
| `me manda o link` | `link_request` | CTA permitido se houver checkout ou WhatsApp |
| `quanto custa?` | `price_strong` | CTA permitido se houver link válido |
| `link não abriu` | `link_broken` | fallback para WhatsApp |

### 1.4 V19 Deterministic Decision Engine

O V19 usa padrões determinísticos de compra como:

- `quero comprar`
- `me manda o link`
- `manda o link`
- `tem link`
- `onde compra`
- `como faço pra comprar`
- `como pago`
- `aceita pix`
- `quero assinar`
- `quero pagar`
- `quero adquirir`
- `vou levar`
- `bora fechar`
- `link de pagamento`
- `envia o link`

Quando a intenção final é `buy`, o estado vira `ready` e `isBuyer = true`.

## 2. Como a IA diferencia curioso, interessado e comprador?

A diferenciação acontece pela combinação entre Journey Stage, Decision Core, V17, V19 e Lead Capture Score.

### 2.1 Curioso

Curioso é o usuário em fase informacional. Exemplos de sinais:

- `o que é`
- `como funciona`
- `me explica`
- `para que serve`
- `detalhes`
- `quero entender`
- `primeira vez`
- `iniciante`

Decisões reais:

- Journey Stage tende a `descoberta`.
- Decision Core tende a `info`.
- V19 tende a `confusion` ou `neutral`, se for pergunta genérica.
- Não deve receber checkout direto, salvo se houver estado comprador anterior em camadas legadas.
- Pode receber captura consultiva se o score atingir o limiar.

Exemplo real:

```text
Lead: como funciona?
Classificação provável: descoberta / info
Conduta: explicar produto, sem checkout direto pelo Decision Core.
```

### 2.2 Interessado

Interessado é quem demonstra avaliação comercial, mas ainda não compra. Sinais:

- `interessante`
- `gostei`
- `quero saber mais`
- `tem garantia`
- `tem bônus`
- `quanto custa`
- `qual o preço`
- `qual valor`

Decisões reais:

- Decision Core pode classificar como `interest`.
- Journey Stage pode virar `negociacao` quando envolve preço, valor, pagamento, plano ou condições.
- Lead Capture Score soma sinais como `intent_interest`, `question_price`, `question_plan` e `question_hiring`.
- V19 classifica preço como `price` e estado `evaluating`; nesse estado pode vender e pode mostrar CTA, mas com CTA mais sutil.

Exemplo real:

```text
Lead: qual o valor?
Classificação provável: negociacao / interest ou price
Conduta: responder preço/condições e permitir CTA se houver link confiável.
```

### 2.3 Comprador

Comprador é quem expressa ação de compra, pagamento, assinatura ou fechamento. Sinais:

- `quero comprar`
- `quero pagar`
- `como compro`
- `onde compro`
- `me manda o link de compra`
- `link de pagamento`
- `vou levar`
- `bora fechar`
- `aceita pix`

Decisões reais:

- `intencao_compra = true` no sistema de inteligências.
- Decision Core retorna `buy`.
- V17 retorna `buy` ou `link_request`.
- V19 retorna `buy`, stage `ready`, `isBuyer = true`.
- Lead Capture Score dispara captura por `dcIntent === buy`, `checkoutCandidate`, `ctaCandidate` ou score >= 50.
- CTA/checkout pode ser injetado se houver checkout válido e confiança mínima.

Exemplo real:

```text
Lead: quero comprar agora
Classificação provável: intencao_compra=true / buy / ready
Conduta: CTA de finalizar compra e possível captura de lead.
```

## 3. Como a IA identifica objeções?

Há três camadas principais de objeção.

### 3.1 Decision Core

Classifica como `objection` mensagens com termos como:

- `não gostei`
- `não quero`
- `não entendi`
- `confuso`
- `complicado`
- `difícil`
- `caro`
- `muito caro`
- `não vale`
- `não me convenceu`
- `não funciona pra mim`
- `golpe`
- `fraude`
- `enganação`
- `furada`

### 3.2 Pós-processador global

Mesmo quando o lead já estava marcado como comprador, o pós-processador bloqueia checkout se a mensagem atual parecer objeção. Padrões reais:

- `golpe`
- `fraude`
- `pirâmide`
- `enganação`
- `não entendi`
- `parece golpe`
- `confiável`
- `seguro`
- `medo`
- `duvido`
- `mentira`
- `falso`
- `leigo`
- `explica`

### 3.3 V19

O V19 tem categoria `objection` para objeções de confiança, segurança, preço e validade:

- `golpe`
- `fraude`
- `piramide`
- `enganacao`
- `confiavel`
- `seguro`
- `medo`
- `duvido`
- `caro demais`
- `muito caro`
- `não vale`
- `não compensa`
- `garantia`
- `funciona mesmo`
- `realmente funciona`

Quando V19 classifica objeção, o estado vira `hesitating` e `isBuyer = false`.

Exemplos reais:

| Mensagem | Classificação provável | Efeito comercial |
|---|---|---|
| `isso é golpe?` | objection / hesitating | Bloqueia CTA de checkout |
| `achei muito caro` | objection ou price_objection | Responde objeção antes de vender |
| `não entendi` | objection/confusion | Remove pressão de venda |
| `funciona mesmo?` | objection | Não trata como compra imediata |

## 4. Como a IA responde objeções?

O diagnóstico técnico mostra que a resposta de objeção tem duas partes:

1. O LLM gera a resposta textual principal com base no prompt, conhecimento e contexto.
2. As camadas determinísticas impedem que a resposta vire fechamento agressivo quando há objeção.

Regras reais observadas:

- Decision Core marca `objection` como intenção que bloqueia checkout.
- V19 define `canSell = false` para `objection` ou estado `hesitating`.
- V19 define `canShowCTA = false` quando o estágio é `hesitating`.
- V19 remove CTA/checkout da resposta se `allowSell = false`.
- O pós-processador global bloqueia checkout para comprador anterior se a mensagem atual for objeção.

Exemplo real:

```text
Lead: parece golpe, é confiável?
Diagnóstico: objection / hesitating / isBuyer=false
Conduta técnica: responder confiança/segurança; remover ou bloquear checkout.
```

Outro exemplo:

```text
Lead: muito caro
Diagnóstico: objection ou price_objection, dependendo da camada
Conduta técnica: tratar resistência de preço antes de CTA direto.
```

## 5. Como a IA conduz para o CTA?

A condução para CTA é baseada em intent + link válido.

### 5.1 Seleção de CTA pelo V17

O V17:

1. Detecta intenção.
2. Resolve o melhor link.
3. Valida se deve mostrar CTA.
4. Constrói o CTA.

Intenções permitidas para CTA:

- `buy`
- `link_request`
- `support`
- `link_broken`
- `price_strong`

Resolução real:

- `buy`, `link_request` e `price_strong`: preferem checkout; se não houver checkout, usam WhatsApp.
- `support`: usa WhatsApp.
- `link_broken`: usa WhatsApp.
- Sem link válido: não há CTA.

Labels reais:

- Compra: `Finalizar compra`
- Suporte/link quebrado: `Falar no WhatsApp`

### 5.2 Injeção de checkout pelo V19

Quando V19 está ativo:

- Se intenção é `buy` e há checkout permitido, injeta bloco `FINALIZAR COMPRA`.
- Se intenção é `price` ou o estado já é comprador, injeta CTA mais sutil: `Veja condições e finalize aqui`.
- Se não pode vender, remove blocos de CTA/checkout.

### 5.3 WhatsApp Channel

No WhatsApp, o CTA retornado pelo pipeline é transformado em texto inline com label e URL. Se houver `calendarHash`, o canal adiciona URL de agendamento, respeitando a ordem captura → agendamento quando o lead ainda não tem dados.

Exemplo real:

```text
Lead: me manda o link de compra
V17: link_request
Link resolvido: checkoutLink
CTA: Finalizar compra + URL
```

## 6. Como a IA decide quando capturar lead?

A captura usa o `lead-capture-score`, que acumula sinais por conversa.

### 6.1 Limiar

O threshold real é 50 pontos.

### 6.2 Sinais e pontuação

Principais sinais reais:

| Sinal | Pontos |
|---|---:|
| `intent_buy` | 50 |
| `intent_interest` | 25 |
| `intent_info` | 10 |
| `intent_human` | 15 |
| `intent_post_sale` | 30 |
| `intent_objection` | 5 |
| `question_price` | 30 |
| `question_plan` | 25 |
| `question_hiring` | 30 |
| `question_implementation` | 20 |
| `question_integration` | 15 |
| `question_whatsapp` | 15 |
| `cta_click` | 40 |
| `checkout_candidate` | 40 |
| `cta_candidate` | 35 |
| `detection_purchase_intent` | 50 |

A captura dispara quando:

- score >= 50; ou
- `dcIntent === buy`; ou
- V13 retornou `READY_TO_BUY`; ou
- há `checkoutCandidate`; ou
- há `ctaCandidate`.

Guardrail real: não captura em despedidas como `tchau`, `bye`, `até logo`, `falou`, `valeu` ou agradecimento inicial.

### 6.3 Mensagens de captura por contexto

Mensagens reais:

- Compra: `Posso registrar seu contato para enviar os detalhes e facilitar os próximos passos?`
- Avaliação: `Se desejar, posso guardar seu contato para continuarmos exatamente deste ponto depois.`
- Consultivo: `Posso registrar seu contato e organizar essas informações para você consultar depois.`
- Suporte: `Para dar continuidade ao seu atendimento, posso registrar seu contato?`
- Pós-venda: `Para agilizar seu suporte, posso registrar seu contato?`

Exemplos reais:

```text
Lead: quero comprar
Sinais: intent_buy + detection_purchase_intent + checkoutCandidate possível
Score: >= 50
Resultado: shouldCapture=true
```

```text
Lead: qual o valor?
Sinais: question_price + intent_interest/price dependendo da camada
Score: pode chegar a 30 ou mais; captura pode ocorrer com novos sinais acumulados.
```

## 7. Como a IA decide quando agendar?

O agendamento não é disparado por qualquer interesse comercial. Ele exige intenção explícita de agendamento.

Frases reais que disparam agendamento:

- `quero agendar`
- `quero marcar`
- `gostaria de agendar`
- `agendar reunião`
- `marcar reunião`
- `agendar consulta`
- `agendar horário`
- `marcar horário`
- `posso agendar`
- `como agendar`
- `agendar call`
- `marcar call`
- `escolher horário`
- `ver horários`
- `disponibilidade de horário`

Quando detectado, o sistema retorna:

```text
**📅 AGENDAMENTO DISPONÍVEL**

Escolha um dia e horário no calendário abaixo:

[CALENDAR_WIDGET]
```

Depois, o fluxo injeta `calendarHash` para o widget renderizar calendário. No frontend existe regra de negócio: todo agendamento exige lead válido. Se ainda não existe `leadId`, o sistema intercepta e pede nome, email e WhatsApp antes de confirmar.

Exemplo real:

```text
Lead: quero agendar uma reunião
Detecção: agendamento explícito
Resposta: calendário visual
Se lead não existe: captura contato antes de confirmar.
```

## 8. Como a IA identifica urgência?

Há uma camada de inteligência conversacional que identifica urgência por termos explícitos.

Termos reais:

- `urgente`
- `agora`
- `imediatamente`
- `rápido`
- `importante`
- `prioridade`

Essa análise retorna nível de urgência e também aparece em logs de inicialização como funcionalidade ativada. No fluxo comercial, termos de urgência também aparecem indiretamente nas intenções de compra, por exemplo `pagar agora`, `quero pagar agora`, `ativar agora` e `quero comprar agora`, que elevam o lead a comprador.

Exemplos reais:

| Mensagem | Sinal |
|---|---|
| `preciso disso agora` | urgência |
| `quero pagar agora` | urgência + compra |
| `é urgente` | urgência |
| `quero ativar agora` | compra com urgência |

## 9. Como a IA identifica intenção comercial?

A intenção comercial é detectada por um conjunto amplo de sinais:

### 9.1 Negociação/Journey Stage

Termos de negociação:

- `preço`
- `valor`
- `quanto custa`
- `custo`
- `investimento`
- `pagamento`
- `forma de pagamento`
- `parcelamento`
- `desconto`
- `promoção`
- `oferta`
- `condições`
- `comprar`
- `adquirir`
- `contratar`
- `assinar`
- `plano`
- `cartão`
- `boleto`
- `pix`

### 9.2 Decision Core

Intenções comerciais:

- `buy`: compra explícita.
- `interest`: interesse comercial sem compra explícita.
- `human`: pedido de contato humano, potencial comercial ou suporte.
- `objection`: objeção comercial, engajamento resistente.

### 9.3 Lead Capture Score

Perguntas comerciais pontuadas:

- preço/valor/investimento/custo
- plano/mensalidade/assinatura
- contratar/assinar/aderir
- implementação/prazo/como começar
- integração/API/webhook
- WhatsApp/contato direto

Exemplo real:

```text
Lead: tem plano mensal e integração com WhatsApp?
Sinais: question_plan + question_integration + question_whatsapp
Diagnóstico: intenção comercial de avaliação.
```

## 10. Como a IA conduz a conversa até a venda?

O funil real é determinístico-consultivo:

### 10.1 Entrada curiosa

```text
Lead: o que é isso?
```

Decisões:

- Journey: descoberta.
- Intent: info/confusion.
- CTA: bloqueado ou ausente.
- Conduta: explicar.

### 10.2 Interesse comercial

```text
Lead: gostei, quanto custa?
```

Decisões:

- Journey: negociação.
- Intent: interest/price.
- Lead Score: soma preço/interesse.
- CTA: permitido por V17 `price_strong` ou V19 `price`, se houver link confiável.
- Conduta: responder valor/condições e CTA sutil.

### 10.3 Objeção

```text
Lead: parece caro, funciona mesmo?
```

Decisões:

- Intent: objection.
- State: hesitating.
- `isBuyer = false`.
- CTA/checkout: bloqueado/removido.
- Conduta: responder objeção antes de fechamento.

### 10.4 Compra explícita

```text
Lead: entendi, quero comprar agora
```

Decisões:

- `intencao_compra = true`.
- Decision Core: `buy`.
- V19: `ready`, `isBuyer = true`.
- Lead Capture: dispara por compra/score/checkout candidate.
- CTA: `Finalizar compra` com checkout, se link válido.

### 10.5 Agendamento

```text
Lead: quero agendar uma call
```

Decisões:

- Agendamento explícito detectado.
- Resposta com `[CALENDAR_WIDGET]`.
- `calendarHash` retornado.
- Se não há lead, captura contato antes de confirmar.

## Mapa dos fluxos reais

### Fluxo A — Compra direta

```text
Mensagem: quero comprar
↓
Sistema de inteligências: intencao_compra=true
↓
Decision Core: buy
↓
V17: buy ou link_request
↓
V19: stage=ready, isBuyer=true
↓
Lead Capture Score: shouldCapture=true
↓
CTA: Finalizar compra se checkoutLink válido
```

### Fluxo B — Preço/avaliação

```text
Mensagem: qual o valor?
↓
Journey: negociacao
↓
Decision Core: interest
↓
V17: price_strong
↓
V19: price / evaluating
↓
Lead Capture Score: question_price + possível intent_interest
↓
CTA: permitido, geralmente mais consultivo/sutil
```

### Fluxo C — Objeção de confiança

```text
Mensagem: isso é golpe?
↓
Decision Core: objection
↓
V19: stage=hesitating, isBuyer=false
↓
canSell=false / canShowCTA=false
↓
applyDecision remove CTA/checkout
↓
Resposta trata objeção sem empurrar checkout
```

### Fluxo D — Suporte/humano

```text
Mensagem: quero falar com atendente
↓
Decision Core: human
↓
V17: support
↓
V19: support, isBuyer=false
↓
CTA de checkout bloqueado
↓
Link preferencial: WhatsApp
```

### Fluxo E — Agendamento com captura prévia

```text
Mensagem: quero agendar reunião
↓
Detector de agendamento: match explícito
↓
Resposta: [CALENDAR_WIDGET]
↓
calendarHash gerado
↓
Frontend tenta agendar
↓
Se leadId ausente: pede nome/email/WhatsApp
↓
Depois confirma booking
```

## Decisões reais consolidadas

| Decisão | Regra real |
|---|---|
| Lead quer comprar | Expressões explícitas de compra/pagamento/assinatura/fechamento |
| Lead é curioso | Perguntas informacionais e etapa descoberta |
| Lead é interessado | Preço, bônus, garantia, mais detalhes, planos, avaliação |
| Lead é comprador | Compra/pagamento/link de compra/fechamento |
| Objeção | Termos de preço alto, golpe, confiança, confusão, não convencimento |
| CTA | Só com intent permitida e link válido |
| Checkout | Permitido para compra/preço com dados confiáveis; bloqueado em objeção, saída, suporte e confusão |
| Captura | Score >= 50 ou compra/ready/CTA/checkout candidate |
| Agendamento | Somente frases explícitas de agendamento/marcação |
| Urgência | Termos como urgente/agora/imediatamente/rápido/importante/prioridade |

## Diagnóstico final

A IA de vendas do Link Mágico possui uma camada comercial real, determinística e multiestágio. Ela diferencia curiosidade, interesse, compra, objeção, suporte, saída e agendamento por regras explícitas. A venda não é conduzida apenas por geração de texto: o sistema controla CTA, checkout, captura e agenda por decisões programáticas.

A lógica de venda mais forte está concentrada em:

- `JourneyAnalyzer`, para estágio de descoberta/negociação/fidelização.
- `SistemaCapturaInteligencias`, para intenção de compra, contato, suporte e saída.
- `decision-core`, para classificação granular buy/info/interest/objection/human/post_sale.
- `v17-link-resolver`, para CTA por intenção e link válido.
- `lead-capture-score`, para captura por score comportamental.
- `v19-deterministic-engine`, para decisão unificada de vender, bloquear CTA, injetar checkout e manter estado conversacional.
- Fluxo de agendamento no servidor/frontend, que exige intenção explícita e lead válido.
