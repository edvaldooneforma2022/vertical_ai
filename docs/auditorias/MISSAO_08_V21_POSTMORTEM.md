# MISSÃO 08 — Postmortem Técnico do Incidente V21

**Data da análise:** 2026-06-19  
**Escopo:** Auditoria de Paridade, Auditoria de Extração, comportamento do WhatsApp e comportamento do Link Curto.  
**Tipo:** documentação técnica pós-incidente.  
**Status:** não contém correções implementáveis; registra fatos, impactos, riscos e recomendações.

---

## 1. Resumo executivo

O V21 nasceu de uma falha de paridade entre canais: o Link Curto utilizava o pipeline completo em `/api/process-chat-inteligente`, enquanto o WhatsApp ainda funcionava como canal semi-inteligente, chamando fluxo legado, reconstruindo parte do contexto e traduzindo decisões comerciais localmente. Essa diferença produzia respostas e CTAs inconsistentes entre o chat web e o WhatsApp.

A intervenção principal do V21 foi reposicionar o WhatsApp como **canal puro de transporte**: receber mensagem, resolver tenant/lead, chamar o mesmo cérebro usado pelo Link Curto e entregar a resposta adaptada ao meio. O ganho foi a convergência de endpoint, payload e sinais comerciais. O incidente pós-V21 foi causado por um efeito colateral de adaptação do canal: o WhatsApp passou a injetar link de WhatsApp como CTA em respostas onde o lead já estava falando pelo próprio WhatsApp, gerando a percepção de “CTA fantasma”.

---

## 2. Linha do tempo técnica

| Marco | Evidência técnica | Interpretação |
|---|---|---|
| Antes do V21 | WhatsApp consumia lógica própria/legada associada ao `chat-universal`. | Canal não tinha paridade real com o Link Curto. |
| V21 | WhatsApp passa a chamar `_callUnifiedBrain` e selecionar `/api/process-chat-inteligente` por padrão. | Paridade funcional com o pipeline do Link Curto. |
| V21 | Criado `lib/wa-parity-audit.js`. | Observabilidade para comparar sinais do WhatsApp com Link Curto. |
| Pós-V21 | Bloco de CTA inline ainda adaptava links de WhatsApp de contato. | Canal aplicava uma regra redundante para o próprio meio WhatsApp. |
| V21-FIX-001 | Removida a injeção de `wa.me` como “Fale com a equipe”. | Correção conceitual: checkout pode ser CTA; WhatsApp de contato não deve ser CTA dentro do WhatsApp. |

---

## 3. O que motivou o V21

### 3.1 Falha de paridade entre canais

O Link Curto enviava mensagens para `/api/process-chat-inteligente` com `message`, `pageData`, `robotName`, `instructions`, `conversationId`, `leadId` e `apiKey`. Já o WhatsApp precisava reconstruir dados equivalentes e, antes do V21, não garantia o mesmo endpoint e a mesma matriz de decisões.

### 3.2 Sintomas observados

- WhatsApp não reproduzia com fidelidade as decisões comerciais do Link Curto.
- CTAs, checkout, captura e agendamento dependiam de traduções/adaptações locais.
- Extração e enriquecimento de dados do assistente eram dependentes de consultas laterais a `short_urls`, `checkout_links` e, quando disponível, `extractPageData`.
- O canal WhatsApp acumulava responsabilidade que deveria pertencer ao pipeline central.

### 3.3 Hipótese central do V21

A hipótese correta foi: **se o WhatsApp consumir o mesmo endpoint e os mesmos sinais do Link Curto, o comportamento comercial tenderá à paridade; diferenças restantes devem ser apenas de renderização do canal.**

---

## 4. O que foi alterado

### 4.1 Reposicionamento arquitetural do WhatsApp

O cabeçalho do canal foi atualizado para explicitar o princípio “Canal ≠ Inteligência”: o WhatsApp deve receber, resolver tenant, enviar ao Unified Brain e entregar resposta, enquanto decisões de intenção, jornada, CTA, captura e agendamento vêm do pipeline central.

### 4.2 Feature flag de rollback

Foi introduzida `WA_USE_FULL_PIPELINE`, ativada por padrão, para alternar entre:

- `/api/process-chat-inteligente` — caminho do Link Curto;
- `/api/chat-universal` — caminho legado de rollback.

Isso reduziu o risco de implantação ao permitir reversão operacional sem alteração de código.

### 4.3 Endpoint unificado

O WhatsApp passou a chamar `_callUnifiedBrain`, montando payload com `message`, `apiKey`, `conversationId`, `leadId`, `url`, `robotName`, `instructions`, `pageData` e `context`, e selecionando o endpoint por feature flag.

### 4.4 Auditoria de paridade

Foi criado `lib/wa-parity-audit.js`, módulo observacional que registra:

- canal;
- mensagem;
- `conversationId`;
- `leadId`;
- `journeyStage`;
- intenções detectadas;
- lead score;
- CTA;
- captura;
- agendamento;
- fonte da resposta;
- preview da resposta;
- indicador de potencial paridade com Link Curto.

### 4.5 Tradução de sinais para WhatsApp

O canal passou a traduzir sinais do pipeline central para formato textual:

- `leadCapture.shouldCapture` vira mensagem de captura;
- `calendarHash` vira URL `/agendar/{hash}`;
- `cta.url` vira link inline, já que o WhatsApp não renderiza botão como o widget.

### 4.6 Remoção do CTA fantasma

Após a identificação do problema, foi documentada/removida a injeção de link de WhatsApp de contato dentro do próprio WhatsApp. O comentário atual preserva a razão: o lead já está no WhatsApp e repetir “Fale com a equipe” cria conflito cognitivo.

---

## 5. O que funcionou

### 5.1 Centralização das decisões comerciais

A maior melhoria foi deslocar as decisões de negócio para o pipeline central. O WhatsApp deixou de ser uma segunda implementação parcial do funil e passou a se aproximar de um adaptador de transporte.

### 5.2 Paridade de endpoint

A convergência para `/api/process-chat-inteligente` reduziu divergências entre Link Curto e WhatsApp. Como o Link Curto já usa esse endpoint, o WhatsApp passou a depender da mesma inteligência central.

### 5.3 Observabilidade

A auditoria de paridade funcionou como instrumento de diagnóstico. Ela não altera resposta, intenção, CTA ou fluxo, mas permite comparar sinais relevantes em produção.

### 5.4 Preservação de rollback

A feature flag de pipeline criou uma saída operacional segura para retornar ao comportamento legado caso o endpoint unificado causasse regressões graves.

### 5.5 Separação entre CTA de checkout e CTA de WhatsApp

A correção posterior deixou mais claro que CTA transacional é diferente de CTA de canal. Checkout continua sendo útil no WhatsApp; link para WhatsApp dentro do WhatsApp é redundante.

---

## 6. O que quebrou

### 6.1 CTA fantasma de WhatsApp

O principal problema foi a injeção de “Fale com a equipe” com link `wa.me` em respostas enviadas pelo próprio WhatsApp. Isso quebrou a experiência porque o usuário já estava naquele canal.

**Impacto percebido:** perda de credibilidade da automação, confusão do lead e sensação de resposta sem contexto.

### 6.2 Mistura entre adaptação de canal e regra comercial

A adaptação inline de CTAs era necessária para checkout e links externos, mas a regra foi ampla demais ao tratar link de WhatsApp como CTA acionável também dentro do canal WhatsApp.

### 6.3 Paridade incompleta na extração

A tentativa de buscar `pageData` por `server-utils.extractPageData` é condicional. Quando esse módulo/função não está disponível, o canal depende do endpoint para extrair via URL. Isso mantém a operação possível, mas revela que a paridade de extração ainda depende de fallback implícito.

### 6.4 Agendamento dependente de heurística de lead capturado

A regra de exibir `/agendar/{hash}` após captura usa existência de `email`, `telefone` ou `wa_phone`. No WhatsApp, `wa_phone` existe cedo, o que pode ser interpretado como dado suficiente mesmo sem captura formal de nome/e-mail, dependendo da regra comercial desejada.

### 6.5 Versão de status desalinhada

A rota de status ainda expõe `version: 'WA-CHANNEL-001'`, apesar do cabeçalho do arquivo indicar V21/WA-CHANNEL-002. Isso não quebra o fluxo, mas prejudica auditoria operacional.

---

## 7. Dependências ocultas descobertas

### 7.1 Banco como fonte de contexto do canal

Para atingir paridade, o WhatsApp depende de consultas a:

- `short_urls` para `sales_url`, `robot_name` e `instructions`;
- `checkout_links` para checkout confirmado;
- leads para `conversationId`, telefone, canal e histórico.

### 7.2 Hash de URL para checkout confirmado

O lookup de checkout usa `md5(salesUrl).substring(0, 16)`. Isso cria dependência silenciosa entre normalização de URL, registro do checkout e recuperação pelo WhatsApp.

### 7.3 `server-utils.extractPageData` como dependência opcional

O canal tenta importar `extractPageData`, mas aceita falha silenciosa. Essa decisão evita indisponibilidade, porém dificulta comprovar se a extração ocorreu no canal ou apenas no endpoint central.

### 7.4 Variáveis de ambiente

O comportamento depende de variáveis como:

- `WA_USE_FULL_PIPELINE`;
- `PORT`;
- `BASE_URL`;
- `RENDER_EXTERNAL_URL`;
- variáveis de Evolution Central usadas no envio.

### 7.5 Semântica do retorno do pipeline

O WhatsApp depende de campos retornados pelo Unified Brain: `response`, `cta`, `leadCapture`, `calendarHash`, `journeyStage` e `inteligenciasDetectadas`. Qualquer mudança nesses nomes altera o canal.

### 7.6 Diferença de renderização entre canais

O Link Curto renderiza botões, links rastreados, captura inline e widget de calendário. O WhatsApp só entrega texto. Essa diferença obriga uma camada de tradução, que deve ser explicitamente limitada a apresentação.

---

## 8. Regras comerciais afetadas

### 8.1 Regra de CTA

- Checkout e CTA externo podem ser convertidos em texto inline no WhatsApp.
- Link de WhatsApp de contato não deve ser injetado como CTA dentro do próprio WhatsApp.

### 8.2 Regra de captura

O WhatsApp passou a respeitar `leadCapture.shouldCapture` vindo do pipeline. O canal não deve decidir quando capturar; deve apenas transformar o sinal em mensagem.

### 8.3 Regra de agendamento

`calendarHash` precisa ser renderizado de forma diferente por canal:

- Link Curto: widget/calendário;
- WhatsApp: URL clicável.

A regra de ordem “captura → agendamento” ficou explícita, mas sua implementação depende da definição de lead suficientemente capturado.

### 8.4 Regra de contexto omnichannel

O WhatsApp prioriza `conversationId` do lead quando existe, o que preserva memória entre widget e WhatsApp. Isso afeta CRM, histórico e continuidade da IA.

### 8.5 Regra de fallback

Quando o Unified Brain não retorna resposta válida, o canal envia fallback genérico: “Recebi sua mensagem! Em breve retornaremos.” Essa regra preserva disponibilidade, mas pode esconder falhas do pipeline se não houver alerta operacional.

---

## 9. Auditoria de Paridade

### 9.1 Resultado

A auditoria foi bem direcionada: ela mede os sinais corretos para comparar WhatsApp e Link Curto sem interferir no fluxo. O design observacional é adequado porque evita que a própria auditoria vire fonte de regressão.

### 9.2 Lacunas

- Não há persistência estruturada; os eventos ficam em `console.log`.
- Não há correlação automática com uma interação equivalente no Link Curto.
- `wouldMatchLinkCurto` é inferido pela feature flag, não por comparação real de saída.
- O preview de resposta ajuda diagnóstico, mas não substitui diff semântico entre canais.

### 9.3 Conclusão

A auditoria de paridade é suficiente para triagem inicial, mas ainda não é uma auditoria de paridade completa. Ela registra indícios; não prova equivalência.

---

## 10. Auditoria de Extração

### 10.1 Resultado

A extração do WhatsApp passou a buscar as mesmas fontes do Link Curto: URL de vendas, nome do robô, instruções, checkout confirmado e dados da página quando possível.

### 10.2 Problemas identificados

- `pageData` pode ser `undefined` e a extração ficar delegada implicitamente ao endpoint.
- O canal monta `context.checkoutLink`, mas também injeta `checkoutLink` em `pageData` quando existe. Isso duplica caminhos possíveis para o mesmo dado.
- A paridade depende da consistência entre `salesUrl`, hash de checkout e dados de extração.
- Falhas de extração são silenciosas e podem parecer respostas ruins da IA, não falha de contexto.

### 10.3 Conclusão

A extração melhorou em termos de intenção arquitetural, mas ainda precisa de contrato explícito: quem extrai, quando extrai, onde persiste e qual campo é fonte canônica para checkout e CTA.

---

## 11. Comportamento do WhatsApp

### 11.1 Comportamento esperado após V21

1. Receber webhook.
2. Resolver tenant.
3. Resolver/criar lead.
4. Registrar inbound.
5. Atualizar histórico.
6. Chamar Unified Brain.
7. Adaptar resposta para texto.
8. Traduzir sinais comerciais já decididos.
9. Enviar resposta pela mesma instância/provedor.
10. Registrar outbound.
11. Emitir auditoria.

### 11.2 Comportamento problemático observado

O WhatsApp tratou um link de WhatsApp extraído como CTA útil. No contexto de conversa por WhatsApp, isso era semanticamente errado.

### 11.3 Conclusão

O WhatsApp deve adaptar forma, não conteúdo comercial. Links inline são uma necessidade do canal; inventar uma ação redundante para o mesmo canal é quebra de contexto.

---

## 12. Comportamento do Link Curto

### 12.1 Papel no incidente

O Link Curto foi a referência de comportamento esperado. Ele já consumia `/api/process-chat-inteligente` com payload completo e renderizava recursos ricos no navegador.

### 12.2 Diferenças naturais

- Link Curto consegue renderizar botão, widget, captura inline e tracking de clique.
- WhatsApp precisa converter tudo em texto.
- Link Curto tem `pageData` disponível no front; WhatsApp precisa reconstruir ou delegar extração.

### 12.3 Conclusão

Paridade não significa saída visual idêntica. Significa mesma decisão comercial, mesma intenção, mesmo CTA transacional e mesma ordem de funil, com renderização adequada ao canal.

---

## 13. Riscos arquiteturais encontrados

1. **Canal acumulando regra de negócio:** qualquer adaptação inline pode virar regra comercial acidental.
2. **Contratos implícitos de payload:** o WhatsApp depende de campos do endpoint sem schema formal versionado.
3. **Observabilidade não persistida:** logs podem se perder em produção e dificultar comparação histórica.
4. **Fallback silencioso de extração:** ausência de `pageData` pode degradar resposta sem sinal claro.
5. **Duplicidade de fonte de checkout:** `pageData.checkoutLink`, `context.checkoutLink`, `cta.url` e banco podem divergir.
6. **Feature flag sem visibilidade externa:** se `WA_USE_FULL_PIPELINE=false`, a auditoria registra legado, mas a operação pode não perceber rapidamente.
7. **Renderização desigual:** widgets e botões no Link Curto viram texto no WhatsApp; sem política clara, isso gera inconsistência.
8. **Acoplamento via HTTP interno:** o canal chama o próprio servidor em `127.0.0.1`; isso preserva stack, mas adiciona dependência de porta, timeout e roteamento interno.
9. **Heurística de captura no WhatsApp:** telefone pode ser confundido com captura suficiente.
10. **Versão operacional desatualizada:** status reportando WA-CHANNEL-001 durante V21 prejudica diagnóstico.

---

## 14. Lições aprendidas

1. **Paridade deve ser definida por contrato, não por intenção.** O V21 aproximou canais, mas ainda depende de campos e convenções não formalizados.
2. **Canal não deve decidir negócio.** O canal pode renderizar; não deve inventar CTA, alterar etapa do funil ou promover contato redundante.
3. **CTA é dependente de contexto.** Um link útil no site pode ser absurdo dentro do WhatsApp.
4. **Observabilidade precisa medir equivalência real.** Logs são úteis, mas paridade exige comparação de entradas, decisões e saídas.
5. **Fallbacks silenciosos resolvem disponibilidade, mas escondem qualidade.** Extração ausente precisa ser visível.
6. **Renderização é parte do produto.** Mesmo com o mesmo endpoint, a experiência muda se botão vira texto ou calendário vira URL.
7. **Feature flags precisam de telemetria operacional.** Rollback é bom, mas deve ficar evidente nos logs, painéis e auditorias.

---

## 15. Recomendações para futuras evoluções

> Estas recomendações são direcionais e não constituem patch nesta missão.

### 15.1 Contrato formal do Unified Brain

Definir schema versionado para entrada e saída de `/api/process-chat-inteligente`, incluindo campos obrigatórios, opcionais e semântica de `cta`, `leadCapture`, `calendarHash`, `pageData` e `context`.

### 15.2 Matriz de renderização por canal

Criar documentação explícita:

| Sinal central | Link Curto | WhatsApp |
|---|---|---|
| `cta.url` checkout | botão/link rastreado | texto com URL |
| `leadCapture.shouldCapture` | formulário inline | pergunta textual |
| `calendarHash` | widget calendário | URL `/agendar/{hash}` |
| WhatsApp de contato | botão/link no site | não injetar se canal atual já é WhatsApp |

### 15.3 Auditoria persistente

Persistir eventos de paridade em tabela/log estruturado com `conversationId`, `channel`, `endpoint`, `journeyStage`, `cta.url`, `leadCapture`, `calendarHash`, `responseHash` e `timestamp`.

### 15.4 Testes de contrato entre Link Curto e WhatsApp

Criar cenários comparáveis para:

- pergunta informativa;
- intenção de compra;
- intenção de suporte;
- intenção de agendamento;
- captura antes de agendamento;
- checkout confirmado;
- checkout ausente com WhatsApp de contato.

### 15.5 Fonte canônica de checkout

Definir prioridade única para checkout: banco confirmado, extração, contexto ou CTA final. Evitar múltiplas fontes ativas sem regra de precedência documentada.

### 15.6 Telemetria de extração

Registrar explicitamente se `pageData` veio do banco/cache, de `extractPageData`, do endpoint central ou se ficou ausente.

### 15.7 Política de CTA contextual

Documentar regra: **não sugerir migração para o canal onde o usuário já está**. Exemplos:

- no WhatsApp, não enviar “fale no WhatsApp”;
- no widget, WhatsApp pode ser fallback de atendimento;
- em checkout, sempre preferir CTA transacional se confirmado.

### 15.8 Versionamento operacional

Alinhar versão exposta em status com a versão real do canal e incluir flags ativas no diagnóstico.

---

## 16. Conclusão

O V21 foi uma evolução arquitetural necessária e correta: reduziu divergência entre WhatsApp e Link Curto ao centralizar decisões no pipeline principal. O incidente do CTA fantasma não invalida o V21; ele revela que **paridade de inteligência não elimina a necessidade de uma camada de apresentação consciente do canal**.

A principal correção conceitual é separar três camadas:

1. **Pipeline central:** decide intenção, etapa, CTA, captura e agendamento.
2. **Contrato de dados:** transporta sinais de forma estável e observável.
3. **Canal:** renderiza sinais sem criar regra comercial própria.

Enquanto essa separação não for formalizada por contrato, testes e telemetria persistente, novas regressões poderão surgir sempre que um canal tentar “ajudar” o pipeline central com heurísticas locais.
