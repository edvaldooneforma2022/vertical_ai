\# ONBOARDING — Link Mágico para novos profissionais



> \*\*Propósito deste documento\*\*: consolidar o conhecimento operacional, comercial e arquitetural produzido nas Missões 05–38 para que qualquer novo desenvolvedor, arquiteto, engenheiro de IA, consultor técnico, PM, estrategista de marketing ou parceiro técnico entenda o Link Mágico sem ler todo o repositório.



> \*\*Escopo\*\*: este documento não propõe melhorias, não cria arquitetura nova, não redefine pipeline e não substitui auditorias específicas. Ele é um mapa de entendimento e segurança.



\---



\## 1. O que é o Link Mágico



\### O que é o produto



O \*\*Link Mágico\*\* é uma plataforma SaaS de atendimento e conversão que transforma uma página de vendas, link curto, widget ou conversa de WhatsApp em um \*\*vendedor automático guiado por IA\*\*. Ele lê ou recebe dados de uma oferta, conversa com o visitante, entende intenção, identifica estágio de jornada, decide quando vender, quando capturar lead, quando encaminhar para WhatsApp, quando exibir checkout e quando sugerir agendamento.



\### Qual problema resolve



Páginas de vendas normalmente perdem visitantes porque:



\- o visitante tem dúvida e não encontra resposta rápida;

\- o checkout não aparece no momento certo;

\- o CTA é genérico ou invasivo;

\- o lead sai sem deixar contato;

\- o time comercial não sabe quem estava pronto para comprar;

\- canais diferentes respondem de formas inconsistentes.



O Link Mágico resolve isso colocando uma camada conversacional e decisória entre o visitante e a oferta. Essa camada tenta responder dúvidas, reduzir objeções e levar o usuário ao próximo passo comercial adequado.



\### Para quem foi criado



O produto foi criado para negócios que dependem de conversão digital, incluindo:



\- produtores e vendedores de infoprodutos;

\- negócios locais;

\- clínicas, consultorias e serviços;

\- e-commerces e ofertas diretas;

\- times de marketing que compram tráfego;

\- agências e parceiros que precisam instalar atendimento inteligente em páginas de clientes.



\### Como gera valor



O valor vem de quatro resultados finais:



1\. \*\*Conversão\*\*: conduzir o visitante ao checkout ou ao canal de compra.

2\. \*\*Captura de lead\*\*: obter dados de contato quando a venda imediata não acontece.

3\. \*\*Agendamento\*\*: converter interesse em reunião, consulta ou chamada comercial.

4\. \*\*Venda assistida\*\*: responder objeções e dúvidas em tempo real, sem depender de humano disponível.



\### O que é o Link Mágico em 2 minutos?



O Link Mágico é um SaaS que adiciona uma camada de IA comercial a páginas de vendas e canais de atendimento. O visitante chega por link curto, widget ou WhatsApp, envia uma mensagem, e o sistema passa por um pipeline que entende a intenção, avalia o estágio da jornada, consulta o estado da conversa, decide se deve vender ou não, escolhe CTA, captura lead quando necessário, oferece agendamento quando faz sentido e responde com uma próxima ação clara. O objetivo é transformar uma página passiva em um vendedor automático, seguro e rastreável.



\---



\## 2. Visão de negócio



\### Objetivo principal



\*\*Transformar páginas de vendas em vendedores automáticos.\*\*



O Link Mágico não é apenas um chatbot de suporte. Ele é uma camada de execução comercial que conversa, qualifica, decide e direciona o visitante para o próximo passo com base em sinais de intenção e contexto.



\### Canais principais



1\. \*\*Link Curto\*\*

&#x20;  - Porta de entrada compartilhável.

&#x20;  - Normalmente usado em tráfego pago, bio, campanha ou mensagem direta.

&#x20;  - Encaminha o usuário para uma experiência controlada e rastreável.



2\. \*\*Widget\*\*

&#x20;  - Camada embutida em página ou site do cliente.

&#x20;  - Atua enquanto o visitante navega na oferta.

&#x20;  - Conecta dúvidas contextuais à decisão comercial.



3\. \*\*WhatsApp\*\*

&#x20;  - Canal de conversa direta e continuidade comercial.

&#x20;  - Pode ser CTA final, fallback de atendimento ou canal primário para leads mais quentes.



\### Objetivos finais



\- \*\*Conversão\*\*: fazer o usuário avançar ao checkout ou compra.

\- \*\*Captura de Lead\*\*: registrar nome, contato, intenção e contexto quando a venda ainda não é imediata.

\- \*\*Agendamento\*\*: transformar intenção em compromisso com data, hora ou follow-up.

\- \*\*Venda\*\*: entregar o CTA certo para a pessoa certa no momento certo.



\---



\## 3. Como o sistema funciona



Mapa simplificado:



```text

Visitante

↓

Mensagem

↓

Pipeline

↓

IA

↓

Decisão

↓

CTA

↓

Lead Capture

↓

Scheduler

↓

Resposta

```



\### 1. Visitante



É a pessoa que chega por link curto, widget ou WhatsApp. Pode estar apenas curiosa, comparando preço, pedindo suporte, querendo comprar, buscando contato humano ou tentando entender a oferta.



\### 2. Mensagem



A mensagem é o sinal primário do visitante. Ela contém intenção explícita ou implícita, como “quanto custa?”, “quero comprar”, “tem garantia?”, “falar com atendente” ou “posso agendar?”.



\### 3. Pipeline



O pipeline recebe a mensagem e o contexto do canal. Ele organiza dados como tenant, API key, produto, página, conversa, histórico, links disponíveis, checkout, WhatsApp e estado atual.



\### 4. IA



A IA formula a resposta conversacional com base nos dados disponíveis. Ela não deve decidir sozinha quando vender, quando inserir checkout ou quando forçar CTA se houver motores determinísticos responsáveis por isso.



\### 5. Decisão



A decisão é a camada crítica. Ela determina se a conversa permite venda, CTA, checkout, lead capture, WhatsApp ou agendamento. Em versões recentes, a autoridade decisória é concentrada em motores como V17/V19 e Decision Core para reduzir conflitos.



\### 6. CTA



O CTA é a chamada para ação. Pode ser compra, WhatsApp, agendamento, captura de contato ou orientação informativa. CTA errado prejudica conversão e pode quebrar confiança.



\### 7. Lead Capture



Quando a venda direta não é adequada ou o usuário demonstra interesse qualificado, o sistema captura dados de lead para continuidade comercial.



\### 8. Scheduler



Quando a intenção indica necessidade de conversa, consulta, reunião ou atendimento marcado, o scheduler transforma a conversa em compromisso comercial.



\### 9. Resposta



A resposta final precisa ser útil, coerente com o estágio da jornada, comercialmente segura, sem links inventados e sem CTA indevido.



\---



\## 4. Componentes principais



| Componente | Responsabilidade | Entrada | Saída | Impacto comercial |

|---|---|---|---|---|

| Intent Detection | Identificar a intenção da mensagem. | Texto do usuário, histórico, sinais do canal. | Intenção como compra, dúvida, objeção, suporte, preço, agendamento ou neutra. | Evita vender para quem não quer comprar e acelera quem está pronto. |

| Journey Stage | Classificar o estágio da jornada. | Mensagem, histórico, intenção, comportamento. | Estágio como descoberta, objeção, decisão, pós-venda ou neutro. | Define tom, profundidade e agressividade comercial. |

| Decision Core | Centralizar decisões comerciais. | Intenção, jornada, dados extraídos, estado, links disponíveis. | Permissões e ações: vender, mostrar CTA, checkout, WhatsApp, lead, scheduler. | Reduz conflitos e aumenta consistência entre canais. |

| Conversation State | Guardar memória curta da conversa. | Conversation ID, mensagens, última intenção, estágio, ações já feitas. | Estado atualizado da conversa. | Evita repetição de CTA, melhora continuidade e previne decisões fora de contexto. |

| CTA Engine | Selecionar e aplicar CTA contextual. | Intenção, ação, contexto, conversation ID. | CTA textual, tipo e URL quando aplicável. | Conduz o visitante ao próximo passo sem parecer aleatório. |

| Lead Capture | Registrar e organizar leads. | Dados do visitante, tenant, mensagem, estágio, metadados. | Lead salvo, atualizado ou qualificado. | Recupera oportunidades que não compraram de imediato. |

| Scheduler | Criar e registrar agendamentos. | Lead, data/hora, intenção de reunião/consulta, tenant. | Agendamento ou solicitação de agendamento. | Transforma interesse em compromisso comercial. |

| Observer Layer | Observar eventos e resultados. | Conversas, ações, cliques, leads, agendamentos. | Métricas, logs, rastreabilidade, aprendizado. | Permite auditoria de conversão e detecção de regressões. |

| V17 | Orquestrar estratégia conversacional e links reais. | Mensagem, dados extraídos, instruções, modo de venda. | Estratégia, prompt, resposta estruturada e injeção segura de links. | Separa “IA conversa” de “sistema decide/injeta links”. |

| V18 | Blindar extração imperfeita. | Dados da página, links brutos, confiança da extração. | Status de extração, diagnóstico, fallback e links descobertos. | Evita afirmar ausência de checkout/WhatsApp quando a extração falhou. |

| V19 | Decisão determinística final. | Mensagem, conversation ID, pageData, intenção V17, salesMode. | allowSell, allowCTA, allowCheckout, links e decisão aplicada. | Remove conflitos entre camadas e impede CTA/checkout indevido. |

| V20 | Camada de hardening e correções de robustez. | Dados persistidos, strings, entradas sensíveis, eventos de runtime. | Dados sanitizados, persistência mais segura e menor risco operacional. | Reduz quebras em produção causadas por dados malformados ou inconsistentes. |



\---



\## 5. Leitura obrigatória



Ordem recomendada de leitura:



1\. \*\*ARQUITETURA\_GERAL.md\*\*

&#x20;  - Explica a visão macro do sistema, fronteiras de responsabilidade e dependências centrais.

&#x20;  - Deve ser lido primeiro para evitar interpretações isoladas.



2\. \*\*MAPA\_CONVERSACIONAL\_GLOBAL.md\*\*

&#x20;  - Mostra o fluxo conversacional de ponta a ponta.

&#x20;  - Ajuda a entender como intenção, jornada, CTA, lead e scheduler se conectam.



3\. \*\*MISSAO\_05\_ARQUITETURA.md\*\*

&#x20;  - Marco inicial de organização arquitetural.

&#x20;  - Importante para entender por que certas camadas existem.



4\. \*\*MISSAO\_09\_DEPENDENCIAS\_OCULTAS.md\*\*

&#x20;  - Lista dependências que não são óbvias ao ler apenas um arquivo.

&#x20;  - Essencial antes de alterar server.js, motores de decisão ou componentes comerciais.



5\. \*\*MISSAO\_36\_SALES\_INTELLIGENCE\_AUDIT.md\*\*

&#x20;  - Auditoria da inteligência comercial.

&#x20;  - Mostra onde a venda é decidida e onde há riscos de comportamento comercial incorreto.



6\. \*\*MISSAO\_37\_SALES\_DECISION\_CONFLICTS.md\*\*

&#x20;  - Documento crítico sobre conflitos decisórios.

&#x20;  - Deve ser lido antes de mexer em CTA, V17, V19, journey ou lead capture.



7\. \*\*SALES\_EXECUTION\_TRACE.md\*\* \*(quando existir)\*

&#x20;  - Rastro real de execução comercial.

&#x20;  - Útil para validar se o sistema fez o que a arquitetura afirma que deveria fazer.



> Observação: se algum documento ainda não existir no repositório, trate-o como item esperado do corpo documental das missões e procure seu equivalente mais recente antes de alterar código.



\---



\## 6. Entendendo os canais



\### LINK\_CURTO\_PIPELINE.md



O pipeline de link curto representa a entrada mais direta para campanhas. O usuário clica em um link reduzido, chega a uma experiência associada a um tenant/produto e inicia a conversa ou é encaminhado para uma página com inteligência comercial.



\*\*Como funciona\*\*:



1\. Usuário acessa link curto.

2\. Sistema resolve tenant/produto/origem.

3\. Contexto da oferta é carregado.

4\. Conversa passa pelo mesmo núcleo de intenção, jornada e decisão.

5\. Resposta final direciona para checkout, WhatsApp, lead ou agendamento.



\### WHATSAPP\_PIPELINE.md



O pipeline de WhatsApp é usado para continuidade comercial e atendimento direto. Ele é sensível porque WhatsApp pode ser tanto canal de suporte quanto CTA final.



\*\*Como funciona\*\*:



1\. Usuário chega por WhatsApp ou pede WhatsApp durante a conversa.

2\. Sistema identifica intenção de falar com humano, suporte, compra ou continuidade.

3\. Link de WhatsApp só deve ser usado quando permitido pela decisão.

4\. A conversa preserva contexto para não perder estágio comercial.



\### WIDGET\_PIPELINE.md



O widget é a camada embutida na página. Ele está mais próximo do comportamento do visitante no site e deve responder dúvidas sem desviar indevidamente da oferta.



\*\*Como funciona\*\*:



1\. Widget carrega com API key/configuração do tenant.

2\. Visitante envia mensagem na página.

3\. Backend recebe mensagem e contexto.

4\. Núcleo conversacional decide resposta, CTA, lead ou scheduler.

5\. Widget exibe resposta e ações.



\### O que os canais têm em comum



\- Todos alimentam o mesmo objetivo comercial: conversão, lead, agendamento ou venda.

\- Todos dependem de intenção, jornada, estado e decisão.

\- Todos precisam respeitar links reais e contexto do tenant.

\- Todos devem evitar CTA indevido.



\### O que é diferente



\- \*\*Link Curto\*\*: mais associado a campanha, origem e primeira entrada.

\- \*\*Widget\*\*: mais contextual à página e experiência web.

\- \*\*WhatsApp\*\*: mais humano, relacional e sensível a suporte/continuidade.



\---



\## 7. Maiores riscos



Base conceitual esperada: MISSAO\_08\_V21\_POSTMORTEM.md, REGRESSAO\_V21.md, REGRESSAO\_WHATSAPP.md, REGRESSAO\_LINK\_CURTO.md e RISK\_REGISTER\_MASTER.md.



Top 20 riscos atuais:



1\. \*\*Conflito de autoridade decisória\*\*: mais de um módulo decidir venda, CTA ou checkout ao mesmo tempo.

2\. \*\*Regressão tipo V21\*\*: mudança ampla que altera comportamento comercial sem rastreabilidade suficiente.

3\. \*\*CTA indevido\*\*: mostrar compra para usuário em suporte, objeção fraca ou contexto neutro.

4\. \*\*Checkout inventado ou inválido\*\*: IA ou fallback apresentar link não confiável.

5\. \*\*WhatsApp acionado fora de contexto\*\*: mandar para humano quando deveria converter ou explicar.

6\. \*\*Lead Capture silenciosamente quebrado\*\*: perder dados de contato sem erro visível.

7\. \*\*Scheduler sem contexto comercial\*\*: agendar sem lead, tenant ou intenção correta.

8\. \*\*Journey Stage incorreto\*\*: classificar decisão como descoberta ou suporte como compra.

9\. \*\*Intent Detection frágil\*\*: palavras curtas, gírias e ambiguidade causarem ação errada.

10\. \*\*Conversation State perdido\*\*: repetição de CTA, reset de intenção ou esquecimento do histórico.

11\. \*\*Extração de página com baixa confiança\*\*: ausência falsa de checkout, WhatsApp ou dados críticos.

12\. \*\*Fallback agressivo demais\*\*: preencher lacunas com link incorreto ou canal indevido.

13\. \*\*server.js como ponto de acoplamento\*\*: alteração local gerar efeito sistêmico em múltiplos canais.

14\. \*\*Paridade quebrada entre canais\*\*: Link Curto, Widget e WhatsApp responderem com regras diferentes.

15\. \*\*Feature flags mal compreendidas\*\*: ativar camada shadow/ativa sem saber impacto.

16\. \*\*Logs insuficientes\*\*: não conseguir reconstruir por que a venda foi ou não oferecida.

17\. \*\*Dados multi-tenant misturados\*\*: lead, agendamento ou contexto de um cliente afetar outro.

18\. \*\*Resposta genérica em momento de compra\*\*: usuário quer comprar e sistema responde sem checkout.

19\. \*\*Resposta vendedora em momento informativo\*\*: usuário só quer entender e recebe pressão comercial.

20\. \*\*Alterações sem auditoria de impacto\*\*: mudanças em V17-V20, CTA, lead ou scheduler sem relatório.



\---



\## 8. Regras de ouro



1\. \*\*Nunca alterar `server.js` sem auditoria.\*\*

&#x20;  - Motivo: é ponto central de rotas, integração de canais e orquestração. Uma mudança pequena pode afetar produção inteira.



2\. \*\*Nunca alterar V17-V20 sem relatório de impacto.\*\*

&#x20;  - Motivo: essas versões concentram decisão, extração, aplicação de regras e hardening. Alteração sem análise pode reintroduzir conflitos.



3\. \*\*Nunca alterar CTA Engine sem rastreamento.\*\*

&#x20;  - Motivo: CTA impacta conversão diretamente e precisa ser auditável por intenção, contexto e conversa.



4\. \*\*Nunca alterar Journey Stage sem auditoria.\*\*

&#x20;  - Motivo: jornada controla o tom comercial. Classificação errada muda a experiência do cliente.



5\. \*\*Nunca alterar Lead Capture sem auditoria.\*\*

&#x20;  - Motivo: leads são ativos comerciais. Perda, duplicidade ou associação errada afeta receita.



6\. \*\*Nunca alterar Scheduler sem auditoria.\*\*

&#x20;  - Motivo: agendamentos têm consequência operacional real para cliente, time comercial e usuário final.



7\. \*\*Nunca fazer commit automático.\*\*

&#x20;  - Motivo: commits devem representar mudanças revisadas e intencionais, especialmente em módulos comerciais.



8\. \*\*Nunca fazer push automático.\*\*

&#x20;  - Motivo: push pode publicar regressão, expor alteração incompleta ou acionar deploy sem validação.



\---



\## 9. Conhecimento mínimo



Antes de começar a programar, a pessoa precisa saber:



\- o que o Link Mágico vende como produto;

\- quais são os três canais principais;

\- qual é o fluxo Visitante → Mensagem → Pipeline → IA → Decisão → CTA → Lead → Scheduler → Resposta;

\- quais componentes podem decidir venda, CTA, checkout, lead e scheduler;

\- quais componentes apenas observam, registram ou enriquecem;

\- quais arquivos são sensíveis;

\- como uma alteração pode afetar conversão;

\- como identificar se uma mudança é de apresentação, pipeline, decisão ou persistência;

\- como rodar testes e validar regressões;

\- como ler logs de intenção, jornada, CTA e decisão.



\### Checklist mínimo



\- \[ ] Li a visão geral do produto.

\- \[ ] Entendo Link Curto, Widget e WhatsApp.

\- \[ ] Sei explicar como ocorre uma venda.

\- \[ ] Sei quem decide CTA.

\- \[ ] Sei quem decide Lead Capture.

\- \[ ] Sei quem decide Scheduler.

\- \[ ] Sei o papel de V17, V18, V19 e V20.

\- \[ ] Sei por que V21 é risco de regressão.

\- \[ ] Sei que `server.js` é área crítica.

\- \[ ] Sei que mudanças comerciais exigem auditoria.

\- \[ ] Sei que IA não deve inventar link.

\- \[ ] Sei que o estado conversacional evita repetição e conflito.



\---



\## 10. Teste de certificação



O profissional só pode alterar código após responder corretamente:



1\. \*\*O que é o Link Mágico?\*\*

&#x20;  - Um SaaS que transforma páginas e canais digitais em vendedores automáticos com IA, decisão comercial, CTA, lead capture e scheduler.



2\. \*\*Como ocorre uma venda?\*\*

&#x20;  - O visitante demonstra intenção ou avança na jornada; o pipeline reúne contexto; a decisão permite venda/CTA/checkout; a resposta entrega o próximo passo comercial com link real.



3\. \*\*Quem decide o CTA?\*\*

&#x20;  - A decisão comercial e o CTA Engine, respeitando autoridade de motores como V17/V19 e estado da conversa.



4\. \*\*Quem decide o Scheduler?\*\*

&#x20;  - A camada decisória a partir de intenção de agendamento, contexto do lead e disponibilidade do fluxo de agendamento.



5\. \*\*Quem decide o Lead Capture?\*\*

&#x20;  - A camada de decisão/lead capture com base em interesse, estágio, dados já existentes e objetivo comercial.



6\. \*\*Qual é o papel do V17?\*\*

&#x20;  - Orquestrar estratégia conversacional, detectar intenção, estruturar prompt e garantir injeção segura de links reais.



7\. \*\*Qual é o papel do V19?\*\*

&#x20;  - Centralizar decisão determinística de intent final, allowSell, allowCTA e allowCheckout, reduzindo conflitos entre módulos.



8\. \*\*Qual é o maior risco arquitetural?\*\*

&#x20;  - Conflito de autoridade: múltiplas camadas tentando decidir venda, CTA ou checkout simultaneamente.



9\. \*\*O que aconteceu no V21?\*\*

&#x20;  - V21 é tratado como marco de regressão/postmortem: uma mudança com risco de ter quebrado comportamento comercial, especialmente quando não há rastreabilidade e auditoria suficientes.



10\. \*\*Quais são os três canais principais?\*\*

&#x20;   - Link Curto, Widget e WhatsApp.



\---



\## 11. Primeira semana



\### Dia 1 — Produto e negócio



\*\*Estudar\*\*:

\- Este onboarding.

\- Resumo executivo do produto.

\- Conceitos de conversão, lead, scheduler e venda assistida.



\*\*Entender\*\*:

\- O Link Mágico não é “só chatbot”.

\- O valor está em decidir o próximo passo comercial.



\*\*Não alterar\*\*:

\- Código de produção.

\- CTA.

\- Decision Core.

\- V17-V20.



\### Dia 2 — Arquitetura e mapa conversacional



\*\*Estudar\*\*:

\- ARQUITETURA\_GERAL.md.

\- MAPA\_CONVERSACIONAL\_GLOBAL.md.

\- MISSAO\_05\_ARQUITETURA.md.



\*\*Entender\*\*:

\- Como mensagem vira resposta.

\- Onde entram intenção, jornada e decisão.



\*\*Não alterar\*\*:

\- `server.js`.

\- pipelines de canal.



\### Dia 3 — Decisão comercial



\*\*Estudar\*\*:

\- MISSAO\_36\_SALES\_INTELLIGENCE\_AUDIT.md.

\- MISSAO\_37\_SALES\_DECISION\_CONFLICTS.md.

\- Decision Core, CTA Engine, V17, V19.



\*\*Entender\*\*:

\- Quem pode decidir vender.

\- Quem apenas enriquece ou observa.



\*\*Não alterar\*\*:

\- CTA Engine.

\- V17/V19.

\- Regras de checkout.



\### Dia 4 — Canais e persistência



\*\*Estudar\*\*:

\- LINK\_CURTO\_PIPELINE.md.

\- WIDGET\_PIPELINE.md.

\- WHATSAPP\_PIPELINE.md.

\- Lead Capture e Scheduler.



\*\*Entender\*\*:

\- O que muda entre canais.

\- Como lead e agendamento viram ativos comerciais.



\*\*Não alterar\*\*:

\- Lead Capture.

\- Scheduler.

\- integrações multi-tenant.



\### Dia 5 — Riscos e certificação



\*\*Estudar\*\*:

\- MISSAO\_08\_V21\_POSTMORTEM.md.

\- REGRESSAO\_V21.md.

\- REGRESSAO\_WHATSAPP.md.

\- REGRESSAO\_LINK\_CURTO.md.

\- RISK\_REGISTER\_MASTER.md.



\*\*Entender\*\*:

\- Por que regressões comerciais são mais perigosas que bugs visuais.

\- Como auditar impacto antes de mudar.



\*\*Não alterar\*\*:

\- Qualquer componente crítico sem plano, teste e auditoria.



\---



\## 12. Mapa de autoridade



| Área | Autoridade principal | Observação |

|---|---|---|

| Venda | Decision Core / V19 / estratégia V17 | Venda só deve ocorrer quando intenção, jornada e dados permitem. |

| CTA | CTA Engine subordinado à decisão | CTA não deve sobrescrever decisão superior. |

| Lead | Lead Capture + decisão comercial | Captura quando há interesse, qualificação ou necessidade de continuidade. |

| Scheduler | Scheduler + decisão comercial | Agendamento depende de intenção e contexto válido. |

| Journey | Journey Analyzer / Conversation State / V19 state | Define estágio e influencia tom. |

| Intent | Intent Detection / V17 / V19 | Intenção final deve evitar conflitos entre classificadores. |

| Estado Conversacional | Conversation State | Mantém continuidade, evita repetição e registra última intenção/estágio. |

| Checkout | Decision Core / V19 / link resolver | Checkout deve vir de dado real, confiável e autorizado. |

| WhatsApp | Channel resolver / Decision Core / V19 | Pode ser canal, CTA ou fallback; requer contexto. |

| Widget | Widget pipeline + backend | Interface web, mas decisão deve vir do núcleo. |

| Link Curto | Link resolver / pipeline de entrada | Resolve origem/campanha/produto antes do núcleo conversacional. |



\---



\## 13. Resumo executivo



O Link Mágico é uma plataforma SaaS que transforma canais digitais em vendedores automáticos. Ele atua em três entradas principais: Link Curto, Widget e WhatsApp. Em vez de apenas responder perguntas, o sistema interpreta intenção, identifica estágio da jornada, consulta o estado da conversa e decide qual ação comercial deve ocorrer.



O fluxo central é simples: o visitante envia uma mensagem; o pipeline reúne contexto; a IA formula resposta; a camada decisória define se pode vender, mostrar CTA, usar checkout, capturar lead ou sugerir agendamento; a resposta final é entregue com o próximo passo correto.



O objetivo de negócio é aumentar conversão, capturar oportunidades perdidas, agendar contatos qualificados e reduzir dependência de atendimento humano imediato. Para isso, componentes como Intent Detection, Journey Stage, Decision Core, Conversation State, CTA Engine, Lead Capture, Scheduler e Observer Layer precisam atuar com responsabilidades claras.



As versões V17, V18, V19 e V20 são críticas. V17 organiza estratégia e links reais. V18 protege contra extração imperfeita. V19 centraliza decisão determinística e reduz conflitos. V20 endurece robustez e persistência. Qualquer alteração nessas áreas exige auditoria.



O maior risco arquitetural é conflito de autoridade: múltiplos módulos decidindo CTA, checkout ou venda ao mesmo tempo. Esse risco é especialmente relevante por causa do histórico de regressões associado ao V21 e aos canais WhatsApp/Link Curto.



A regra prática é: não altere `server.js`, V17-V20, CTA Engine, Journey Stage, Lead Capture ou Scheduler sem auditoria de impacto. O Link Mágico deve ser entendido como um sistema comercial sensível, onde uma mudança técnica pode aumentar ou reduzir receita diretamente.



Se alguém entender este documento, a ordem de leitura obrigatória e o teste de certificação, conseguirá compreender o produto em menos de 30 minutos e iniciar conversas técnicas com segurança.
--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
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


ATENÇÃO:

ATUALIZAÇÃO: A Missão 38 mostrou uma coisa extremamente importante:

não existe evidência operacional suficiente para afirmar quem realmente decide uma venda em produção.

Portanto algumas partes do onboarding estão escritas como se fossem fatos absolutos.

O que está excelente
1. Seção 1 — O que é o Link Mágico

Excelente.

Se um desenvolvedor ler apenas essa seção, já entende:

o produto;
o problema;
o mercado;
a proposta de valor.

Eu manteria praticamente igual.

2. Seção 2 — Visão de negócio

Excelente.

Isso evita que um programador pense:

"é só mais um chatbot"

e faz ele entender que:

"é um sistema de conversão".

Isso é crítico.

3. Seção 7 — Maiores riscos

Excelente.

Principalmente:

conflito de autoridade;
regressão V21;
CTA indevido;
Journey incorreto;
State perdido.

Esses são exatamente os pontos que aparecem repetidamente nas Missões.

4. Seção 8 — Regras de Ouro

Excelente.

Eu transformaria isso em regra oficial do projeto.

O que eu corrigiria
Problema 1

Você escreve:

"Em versões recentes, a autoridade decisória é concentrada em motores como V17/V19"

Isso não está comprovado.

A Missão 37 mostrou exatamente o contrário.

Existem múltiplas autoridades simultâneas:

Decision Core
Journey
V17
V18
V19
CTA Engine
Scheduler
Lead Capture

e não existe garantia de unificação.

Eu trocaria para:

"A arquitetura pretendida concentra a decisão em V17/V19, porém auditorias identificaram coexistência de múltiplos motores decisórios."

Problema 2

Mapa simplificado

Hoje está:

Visitante
↓
Mensagem
↓
Pipeline
↓
IA
↓
Decisão
↓
CTA
↓
Lead Capture
↓
Scheduler
↓
Resposta

Isso é simplificado demais.

Para onboarding técnico eu usaria:

Visitante
↓
Canal (Widget / WhatsApp / Link Curto)
↓
Mensagem
↓
Intent Detection
↓
Journey Stage
↓
Decision Core
↓
Conversation State
↓
V17
↓
V18
↓
V19
↓
CTA Engine
↓
Lead Capture
↓
Scheduler
↓
Resposta Final

Porque esse é o mapa real levantado pela Missão 37.

Problema 3

Seção "Componentes principais"

Hoje você escreve:

Decision Core → Centralizar decisões comerciais

Isso é perigoso.

Porque um engenheiro novo vai concluir:

"ah então mexer no Decision Core resolve tudo"

e isso é falso.

A Missão 37 mostrou que:

Decision Core é apenas um dos motores.

Eu mudaria para:

"Decision Core: um dos motores centrais de decisão comercial."

Problema 4

Seção V20

Você escreveu:

"V20 endurece robustez e persistência."

Mas a Missão 37 mostrou:

V20 é majoritariamente observador.

Eu alteraria para:

"V20 atua principalmente como camada observadora e de hardening, registrando decisões legadas sem interferir diretamente no fluxo principal."

O que está faltando

Aqui está o maior problema.

Falta uma seção chamada:
Estado Atual do Projeto

Eu colocaria antes da seção 5.

Algo assim:

Estado Atual (Jun/2026)

Resultado consolidado das Missões:

O que sabemos
O sistema possui mais de 200 arquivos.
Existem múltiplos motores comerciais.
Existem conflitos de decisão documentados.
Existem múltiplos pipelines por canal.
O comportamento teórico está amplamente documentado.
O que não sabemos
Quem realmente converte mais.
Quem realmente bloqueia vendas.
Qual motor possui maior autoridade operacional.
Quantos compradores chegaram ao checkout.
Onde compradores reais abandonam o fluxo.
Motivo

A Missão 38 encontrou:

0 conversas persistidas
0 leads persistidos
0 agendamentos persistidos
0 traces comerciais completos

Portanto:

A arquitetura está documentada, mas a execução real ainda não está observável.

Essa seção é extremamente importante.

Porque evita que um novo engenheiro trate os documentos como verdade absoluta.

O documento que eu adicionaria

Além desse onboarding, eu criaria:

/docs
 ├─ ONBOARDING_NEW_ENGINEER.md
 ├─ ARCHITECTURE_STATUS.md
 ├─ SALES_DECISION_CONFLICTS.md
 ├─ SALES_EXECUTION_TRACE.md
 └─ KNOWN_UNKNOWNS.md

E o mais importante seria:

KNOWN_UNKNOWNS.md

Ou seja:

"o que acreditamos que acontece"

versus

"o que conseguimos provar que acontece"

A Missão 38 mostrou que existe uma diferença enorme entre essas duas coisas.

Minha avaliação

Se eu fosse contratar um desenvolvedor sênior amanhã e tivesse que entregar apenas um documento, eu daria:

Nota atual: 8,5/10

Após as correções acima:

Nota: 9,8/10

Porque ele deixa de ser apenas um onboarding e passa a ser um manual operacional do Link Mágico, permitindo que alguém entenda 80–90% do sistema sem precisar navegar pelos mais de 200 arquivos do repositório.


