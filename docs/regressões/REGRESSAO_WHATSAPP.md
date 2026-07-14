\# REGRESSÃO WHATSAPP — Auditoria Técnica do Canal



\## Visão Geral



O canal WhatsApp está em um ponto de estabilidade \*\*moderada, porém sensível a regressões de pipeline\*\*. A arquitetura atual tenta tratar o WhatsApp como canal puro de transporte: recebe webhooks, resolve tenant, cria/vincula lead, chama o mesmo cérebro usado pelo Link Curto e traduz sinais de CTA, captura e agendamento para texto compatível com WhatsApp.



O maior risco atual não está no envio/recebimento básico, mas na \*\*paridade comercial\*\* entre WhatsApp e Link Curto. O canal depende de múltiplas camadas históricas acumuladas no `server.js` — V17, V18, V19, WA-CTA, scheduler, lead capture, contexto conversacional e extração de conteúdo — além de uma chamada HTTP interna para `/api/process-chat-inteligente`. Qualquer divergência entre o payload do WhatsApp e o payload do widget/link curto pode causar:



\- CTA ausente, duplicado, prematuro ou apontando para link incorreto.

\- Agendamento antes da captura de lead.

\- Handoff para atendimento humano sem link válido.

\- Perda de memória entre conversas omnichannel.

\- Recriação indevida de leads com email placeholder.

\- Queda silenciosa para `/api/chat-universal` quando a feature flag de paridade for desligada.



A regressão mais crítica já documentada no código é a correção V21 que removeu a injeção automática de link de WhatsApp de contato em respostas do próprio canal WhatsApp, pois isso gerava conflito cognitivo: o usuário já estava dentro do WhatsApp e recebia CTA para “falar no WhatsApp”.



\## Linha do Tempo das Regressões



| Versão / Período aproximado | Evento | Evidência técnica | Risco associado |

|---|---|---|---|

| V9.1–V9.3 | Detecção/preservação de checkout passa a ser tratada como fonte crítica em `chat-universal` e `process-chat-inteligente`. | Blocos `AUTO-CHECKOUT` e `CHECKOUT-DB-INJECT` preservam ou injetam `checkoutLink`. | CTA sem checkout ou checkout perdido quando WhatsApp envia payload incompleto. |

| V14.2.1–V14.3 | WhatsApp extraído de páginas passa a ser promovido para campo top-level e usado em discovery de links. | `server.js` promove `whatsappLink` e escaneia links/onclick. | WhatsApp de contato pode ser confundido com CTA comercial. |

| V17 | Orquestrador central passa a decidir estratégia de resposta e links. | `FEATURE\_V17\_BRAIN` e `lib/v17-orchestrator.js`. | Divergência se WhatsApp não entrar no mesmo fluxo do Link Curto. |

| V17.2/V17.3 | Link Resolver passa a decidir CTA por intenção e link válido. | `lib/v17-link-resolver.js` e guard final. | CTA errado quando a intenção não é compra ou quando link está ausente. |

| V18 | Extraction Guard adiciona classificação de confiabilidade e fallback. | `lib/v18-extraction-guard.js`; flags `FEATURE\_V18\_EXTRACTION\_GUARD` e `FEATURE\_V18\_FALLBACK`. | Fallback pode preencher WhatsApp/checkout de forma divergente entre canais. |

| V18.1–V18.4 | Compra por keyword e força de CTA são adicionadas antes de decisões posteriores. | Blocos `V18.1-INTENT` e `V18.2-CTA`. | CTA prematuro em perguntas informativas com palavras como preço/plano/link. |

| V19 | Engine determinística assume ou roda em shadow, podendo bypassar V18.1–V18.4 e PP-GLOBAL. | `FEATURE\_DETERMINISTIC\_V19` suporta `false`, `shadow` e `true`. | Mudança de autoridade de decisão pode alterar comportamento do WhatsApp sem mudança no canal. |

| V20 | Sanitização de Unicode antes de persistir no PostgreSQL. | `database.js` sanitiza strings com surrogates órfãos. | Mensagens WhatsApp com emojis/caracteres inválidos podem falhar em persistência se a sanitização for contornada. |

| V21 | WhatsApp passa a chamar `/api/process-chat-inteligente` por padrão, com rollback para `/api/chat-universal`. | `WA\_USE\_FULL\_PIPELINE` controla o endpoint interno. | Regressão crítica de paridade se a flag voltar para pipeline legado. |

| V21-FIX-001 | Removida injeção de link WhatsApp de contato em todas as respostas do canal WhatsApp. | Comentário em `whatsapp-channel.js` declara remoção por conflito cognitivo. | Reintrodução desse padrão degradaria conversão e confiança. |



\## Regressões Confirmadas



\### 1. CTA de WhatsApp dentro do próprio WhatsApp



\- \*\*Data aproximada:\*\* V21 / V21-FIX-001.

\- \*\*Arquivos envolvidos:\*\* `whatsapp-channel.js`, `server.js`, `lib/wa-cta-promoter.js`.

\- \*\*Causa raiz:\*\* o pipeline central trabalha com links de WhatsApp como possível contato/CTA para o widget, mas o canal WhatsApp precisa traduzir essa decisão de forma diferente. A injeção textual de “Fale com a equipe no WhatsApp” dentro de uma conversa já aberta no WhatsApp foi removida explicitamente no canal.

\- \*\*Impacto comercial:\*\* queda de credibilidade, confusão do lead e fricção no momento de conversão.

\- \*\*Impacto técnico:\*\* duplicidade semântica entre CTA do pipeline e canal de transporte; risco de CTA redundante quando `wa-cta-promoter` promove WhatsApp como `checkoutLink` na ausência de checkout real.

\- \*\*Status atual:\*\* corrigida no canal pelo comentário V21-FIX-001; permanece como risco de regressão se a lógica for reintroduzida ou se WA-CTA for ativado sem auditoria de canal.



\### 2. Divergência WhatsApp vs Link Curto por uso do endpoint legado



\- \*\*Data aproximada:\*\* V21.

\- \*\*Arquivos envolvidos:\*\* `whatsapp-channel.js`, `server.js`.

\- \*\*Causa raiz:\*\* existe rollback instantâneo `WA\_USE\_FULL\_PIPELINE=false`, que troca `/api/process-chat-inteligente` por `/api/chat-universal`.

\- \*\*Impacto comercial:\*\* respostas menos completas, possível perda de lead capture, journey stage, CTA estruturado, scheduler e telemetria de paridade.

\- \*\*Impacto técnico:\*\* bifurcação de pipeline e perda da garantia de que o WhatsApp consome o mesmo cérebro do Link Curto.

\- \*\*Status atual:\*\* controlada por flag; por padrão usa pipeline completo, mas a regressão pode ser acionada por variável de ambiente.



\### 3. Agendamento antes de captura de lead



\- \*\*Data aproximada:\*\* V21, após integração de scheduler com sinais do pipeline.

\- \*\*Arquivos envolvidos:\*\* `whatsapp-channel.js`, `server.js`.

\- \*\*Causa raiz:\*\* `/api/process-chat-inteligente` possui atalho de prioridade absoluta para agendamento explícito antes de KB/IA. No WhatsApp, há uma proteção que adia o link de agenda quando o lead ainda não possui dados suficientes e o pipeline solicitou captura.

\- \*\*Impacto comercial:\*\* marcação sem identificação suficiente do lead, perda de contato e menor qualidade de qualificação.

\- \*\*Impacto técnico:\*\* conflito de ordem entre scheduler early-bypass e lead capture textual do WhatsApp.

\- \*\*Status atual:\*\* mitigada no canal por regra de tradução `CAPTURA → AGENDAMENTO`, mas ainda sensível a alterações no retorno `calendarHash`/`leadCapture`.



\### 4. Handoff humano com WhatsApp ausente ou ambíguo



\- \*\*Data aproximada:\*\* V16.3 em diante; risco confirmado no fluxo atual de suporte.

\- \*\*Arquivos envolvidos:\*\* `server.js`, extração de conteúdo, `whatsapp-channel.js`.

\- \*\*Causa raiz:\*\* o interceptador pré-KB de suporte usa `\_iWhatsApp` derivado de `processedPageData`. Se não houver link/número extraído, responde que o time está pronto e mantém a conversa no próprio chat.

\- \*\*Impacto comercial:\*\* lead pedindo humano pode não ser transferido de fato.

\- \*\*Impacto técnico:\*\* handoff depende de extração de WhatsApp confiável e da forma como o canal adapta a resposta.

\- \*\*Status atual:\*\* funcional com fallback textual; risco permanece quando a extração não encontra contato humano.



\### 5. Criação automática de lead com email placeholder



\- \*\*Data aproximada:\*\* V21.

\- \*\*Arquivos envolvidos:\*\* `whatsapp-channel.js`, `server.js`, sistema de leads.

\- \*\*Causa raiz:\*\* o canal cria lead automaticamente por telefone com `email: 'Não informado'`, antes de captura estruturada posterior.

\- \*\*Impacto comercial:\*\* base de leads com dados incompletos; automações por email e deduplicação por email podem ser degradadas.

\- \*\*Impacto técnico:\*\* lead capture passa a ter estado parcial desde a primeira mensagem, podendo interferir em regras que assumem lead já capturado.

\- \*\*Status atual:\*\* comportamento ativo; precisa ser monitorado como risco de regressão de qualificação.



\## Regressões Potenciais



\### Dependências ocultas



\- A chamada interna HTTP depende de `PORT` correto e do servidor local aceitar `127.0.0.1`.

\- O payload do WhatsApp depende de dados de `short\_urls`, `checkout\_links` e extração por `server-utils` quando disponível.

\- O retorno da IA precisa manter contrato com campos como `response`, `cta`, `leadCapture`, `calendarHash`, `journeyStage` e `inteligenciasDetectadas`.



\### Feature flags perigosas



\- `WA\_USE\_FULL\_PIPELINE=false`: ativa pipeline legado no WhatsApp.

\- `FEATURE\_WA\_CTA\_PROMOTER=true`: promove WhatsApp como CTA quando não há checkout.

\- `FEATURE\_V18\_FALLBACK=true`: pode preencher lacunas com links descobertos e mudar destino comercial.

\- `FEATURE\_DETERMINISTIC\_V19=true`: muda autoridade de decisão e bypassa regras anteriores.

\- `FEATURE\_V17\_BRAIN=true`: ativa orquestrador com bypass total de camadas antigas.



\### Bypass de captura



\- O lead é criado automaticamente por telefone; regras posteriores podem considerar que já existe lead, mesmo sem email/nome validado.

\- O scheduler early-bypass de `server.js` pode retornar calendário antes das camadas de inteligência se o canal não adiar corretamente.



\### CTA prematuro



\- Palavras de compra em V18.1 forçam buy intent por keyword.

\- V18.2 força CTA quando há checkout e buy intent.

\- V19 pode injetar ou remover CTA com base em estado determinístico e TTL de 15 minutos.



\### Scheduler antes do lead capture



\- O canal tenta bloquear agenda quando `leadCapture.shouldCapture` é verdadeiro e não há dados mínimos.

\- Se o pipeline deixar de retornar `leadCapture` junto com `calendarHash`, a URL de agendamento pode aparecer cedo demais.



\### Perda de contexto



\- A memória omnichannel depende de `lead.conversationId` ou de `wa\_<phone>\_<apiKey8chars>`.

\- Se o lead existente não for vinculado por telefone normalizado, cria-se novo `conversationId` e perde-se contexto do widget.

\- O estado V19 é in-memory e expira; restart ou múltiplas instâncias podem gerar decisões diferentes.



\### Divergência de pipeline



\- `chat-universal` e `process-chat-inteligente` têm blocos parecidos, mas não idênticos, para checkout, WA-CTA, V18 e guard final.

\- O WhatsApp por padrão chama `process-chat-inteligente`, mas o rollback para legado mantém a divergência possível.



\## Dependências Críticas



| Componente origem | Componente destino | Impacto da quebra |

|---|---|---|

| Webhook Evolution/Twilio | Resolução de tenant em `whatsapp\_settings` | Mensagem recebida é descartada por instância/número desconhecido. |

| Resolução de tenant | `getLeadSystem(apiKey)` | Lead não é vinculado/criado; histórico e CRM ficam incompletos. |

| Lead existente | `conversationId` omnichannel | Perda de memória entre widget e WhatsApp. |

| WhatsApp Channel | `/api/process-chat-inteligente` | Sem resposta inteligente; fallback genérico ao usuário. |

| `short\_urls` | Payload do Unified Brain | Robot name, URL e instruções ausentes. |

| `checkout\_links` | CTA Engine / V17.2 / V19 | CTA sem checkout confirmado ou link incorreto. |

| Extração de conteúdo | Journey/Intent/CTA/Handoff | Respostas sem contexto, sem benefícios, sem contato e sem checkout. |

| V18 Extraction Guard | PageData confiável | Falsos negativos/positivos de checkout e WhatsApp. |

| V19 Engine | Decisão comercial | Mudança de CTA, sell mode e estado de comprador. |

| Scheduler | Tradução WhatsApp de `calendarHash` | Agenda ausente ou prematura. |

| `whatsappManager` / Evolution central | Envio de resposta | Resposta gerada, mas não entregue. |

| `whatsapp\_messages` | Auditoria e rastreabilidade | Conversas sem trilha persistente no PostgreSQL. |

| `wa-parity-audit` | Auditoria de paridade | Perda de comparação WhatsApp vs Link Curto. |



\## Matriz de Impacto



| Risco | Classificação | Justificativa |

|---|---|---|

| Rollback para `/api/chat-universal` | Crítico | Afeta todo o contrato de paridade V21. |

| CTA de WhatsApp dentro do WhatsApp | Alto | Causa confusão comercial direta e pode reduzir conversão. |

| Scheduler antes da captura | Alto | Gera agendamento com lead incompleto. |

| CTA prematuro por keyword/V18.1 | Alto | Pode empurrar compra antes da qualificação. |

| V19 ativo sem shadow suficiente | Alto | Bypassa regras legadas e muda decisão comercial. |

| Extração falha de checkout/WhatsApp | Alto | Impede compra, handoff e contatos. |

| Perda de `conversationId` omnichannel | Alto | Respostas sem memória e duplicação de leads. |

| Email placeholder em leads WhatsApp | Médio | Afeta qualidade da base e automações, mas não bloqueia conversa. |

| Falha de log em `whatsapp\_messages` | Médio | Não bloqueia fluxo, mas reduz auditoria. |

| Rate limit por telefone | Médio | Protege abuso, mas pode bloquear usuários legítimos em rajadas. |

| Mensagem > 4096 caracteres truncada | Baixo | Proteção adequada; risco residual de perder parte da resposta. |

| Falha do `wa-parity-audit` | Baixo | Stub silencioso não bloqueia, mas reduz observabilidade. |



\## Checklist Pré-Deploy WhatsApp



\- Confirmar `WA\_USE\_FULL\_PIPELINE` diferente de `false` no ambiente de produção.

\- Validar webhook Evolution com eventos `Message`, `messages.upsert` e `messages\_upsert`.

\- Validar webhook Twilio com `From`, `To`, `Body` e `MessageSid`.

\- Confirmar resolução de tenant por `evolution\_instance\_name`, `saas\_instance\_name` e fallback `lm\_<tenantPrefix>`.

\- Testar lead novo por WhatsApp e lead existente com telefone já capturado no widget.

\- Validar reaproveitamento de `conversationId` omnichannel.

\- Testar mensagem informativa sem CTA: “como funciona?”

\- Testar intenção de compra com checkout confirmado: “quero comprar”.

\- Testar intenção de preço/plano sem checkout confirmado.

\- Testar página com apenas WhatsApp e sem checkout.

\- Testar pedido de humano: “quero falar com atendente”.

\- Testar pedido de agendamento antes de fornecer dados.

\- Testar pedido de agendamento após captura de dados mínimos.

\- Validar que o canal não injeta link “fale no WhatsApp” quando o usuário já está no WhatsApp.

\- Verificar logs `\[WA-V21]`, `\[WA-CTA]`, `\[WA-V21-CAPTURE]`, `\[WA-V21-SCHEDULE]`, `\[CHECKOUT-FINAL@chat-inteligente]`, `\[V18-GUARD@chat-inteligente]`, `\[V19]` e `\[AUDIT-LLM-BYPASS]`.

\- Validar persistência em `whatsapp\_messages` quando PostgreSQL estiver ativo.

\- Validar envio pela mesma instância Evolution que recebeu a mensagem.

\- Validar fallback para instância tenant e instância global.



\## Recomendações de Auditoria



Não são propostas correções neste documento. A auditoria deve apenas monitorar e validar os pontos abaixo.



\### Onde monitorar



\- Logs do webhook: recebimento, formato Evolution, telefone, push name, texto e tenant resolvido.

\- Logs de paridade V21: endpoint usado, `wouldMatchLinkCurto`, journey, intent, lead score, CTA, captura e agenda.

\- Logs de checkout final antes da decisão comercial.

\- Logs de V18 Guard e V19 Decision/Apply.

\- Logs de scheduler early-bypass e handoff pré-KB.

\- Tabela `whatsapp\_messages` para inbound/outbound e `conversationId`.

\- Sistema de leads para duplicidade por telefone e presença de `wa\_phone`.



\### O que validar



\- Se o endpoint interno do WhatsApp é o mesmo esperado para Link Curto.

\- Se `apiKey`, `conversationId`, `leadId`, `url`, `robotName`, `instructions`, `pageData` e `context.checkoutLink` chegam ao pipeline.

\- Se `leadCapture.shouldCapture` aparece antes do scheduler quando o lead está incompleto.

\- Se CTA só aparece com intenção e link válido.

\- Se handoff humano não depende de link inexistente.

\- Se o WhatsApp não transforma contato WhatsApp em CTA redundante dentro do próprio canal.



\### Cenários que devem ser testados



1\. Primeiro contato pelo WhatsApp sem lead prévio.

2\. Contato pelo widget seguido de WhatsApp com mesmo telefone.

3\. Compra direta com checkout confirmado no banco.

4\. Compra direta sem checkout confirmado e com WhatsApp na página.

5\. Pergunta de suporte humano com e sem WhatsApp extraído.

6\. Pedido explícito de agenda antes de nome/email.

7\. Pedido explícito de agenda após dados mínimos.

8\. Mensagens com emojis e caracteres Unicode incomuns.

9\. Sequência longa para validar contexto e TTL de estado.

10\. Ambiente com V19 em `shadow` comparado com V19 ativo.



\## Conclusão



O canal WhatsApp encontra-se \*\*operacional e arquiteturalmente mais maduro após V21\*\*, porque deixou de ser um fluxo paralelo e passou a consumir o pipeline central do Link Curto por padrão. Ainda assim, sua estabilidade atual deve ser classificada como \*\*moderada com risco alto em pontos comerciais\*\*, pois depende de muitas camadas históricas e feature flags que alteram decisão, extração, CTA, captura, agendamento e handoff.



A principal fronteira de risco é a paridade: enquanto o WhatsApp continuar entrando no pipeline completo e apenas traduzindo sinais centrais para texto, a estabilidade tende a ser aceitável. Se o canal voltar a decidir CTA/captura/agendamento sozinho, se o endpoint legado for reativado, ou se links de WhatsApp forem novamente tratados como CTA dentro do próprio WhatsApp, a probabilidade de regressão comercial volta a ser alta.



