\# LINK\_CURTO\_VENDAS.md — Comportamento Comercial do Link Curto



> Documento comercial baseado em evidências do projeto Link Mágico. Não descreve arquitetura interna nem propõe correções; mapeia como a conversa conduz um visitante desconhecido até compra, contato, captura de lead ou agendamento.



\## Evidências analisadas



\- Prompts comerciais e regras de conversa do Link Mágico em `public/elementor/bloco-3-js.html`.

\- Orquestração comercial V17 em `lib/v17-orchestrator.js`.

\- Proteção de extração e disponibilidade de links V18 em `lib/v18-extraction-guard.js`.

\- Motor determinístico de decisão V19 em `lib/v19-deterministic-engine.js`.

\- Auditoria/continuidade V20 no fluxo principal de chat em `server.js`.

\- Lead Capture orientado por intenção em `lib/lead-capture-score.js`.

\- Journey Stage e captura de inteligências em `lib/ai-systems/journey-analyzer.js`.

\- Scheduler/calendário em `scheduling-manager.js`, `server.js` e widget embutido.



\---



\# 1. Objetivo Comercial



\## Missão do Link Curto



O Link Curto funciona como um vendedor conversacional automático para uma página, produto, serviço ou link comercial. Sua missão comercial é transformar um visitante desconhecido em uma ação mensurável de negócio:



1\. comprar;

2\. clicar em checkout;

3\. deixar contato;

4\. falar com suporte/humano;

5\. agendar uma conversa;

6\. continuar a jornada com memória e contexto.



No material comercial do Link Mágico, o produto é descrito como uma plataforma de IA conversacional criada para aumentar vendas, qualificar leads automaticamente e transformar páginas de venda em operação de conversão 24 horas por dia.



\## O que ele tenta alcançar



O comportamento observado tenta equilibrar três objetivos:



\- \*\*Converter sem fricção quando a intenção é clara\*\*: em compra direta, o link de checkout deve aparecer imediatamente, sem novas perguntas de qualificação.

\- \*\*Não queimar conversão quando há dúvida, medo ou objeção\*\*: quando a pessoa está insegura, o sistema bloqueia venda agressiva e responde primeiro à objeção.

\- \*\*Preservar relacionamento quando a compra não acontece agora\*\*: se há interesse, dúvida, pedido de humano ou agendamento, a captura de lead e o scheduler criam continuidade comercial.



\## KPIs comerciais influenciados



\- Taxa de clique em CTA.

\- Taxa de clique em checkout.

\- Conversão visitante → lead.

\- Conversão lead → reunião/agendamento.

\- Conversão pergunta comercial → compra.

\- Redução de abandono em objeções.

\- Tempo até CTA em intenção de compra.

\- Qualidade do lead capturado por intenção/sinais.

\- Taxa de conversas sem dead-end.

\- Taxa de respostas sem CTA indevido em saída, suporte ou confusão.



\---



\# 2. Jornada Comercial Completa



\## Visitante → Descoberta → Interesse → Consideração → Negociação → Conversão



| Etapa | Estado do visitante | Papel da IA | Saída comercial esperada |

|---|---|---|---|

| Visitante | Pessoa desconhecida chega por link, widget, página ou link curto. | Cumprir, entender contexto, evitar pedir dados cedo demais quando `CHAT\_FIRST` está ativo. | Início de conversa sem fricção. |

| Descoberta | Pergunta “o que é?”, “como funciona?”, “para que serve?”. | Explicar de forma direta, adaptar ao conteúdo extraído, preservar contexto da página e evitar CTA agressivo se ainda é pura informação. | Entendimento do produto e avanço para interesse. |

| Interesse | Demonstra curiosidade: preço, planos, implementação, integração, começar. | Responder objetivamente, pontuar sinais comerciais para Lead Capture, oferecer continuidade. | Lead Capture pode aparecer se score ou sinais passarem o limite. |

| Consideração | Compara, pergunta garantia, confiabilidade, esforço, requisitos. | Resolver objeções e dúvidas antes de vender; não injetar checkout quando o estágio é hesitação/confusão. | Redução de risco percebido. |

| Negociação | Pergunta preço, pagamento, desconto, condições, “como comprar”. | Mostrar condições e CTA quando permitido; manter checkout se há buyer state válido. | Clique em checkout ou captura para follow-up. |

| Conversão | “Quero comprar”, “manda o link”, “quero contratar”, “quero agendar”. | Compra: enviar checkout direto. Agendamento: abrir calendário e exigir lead válido antes de confirmar. | Compra, lead capturado, reunião marcada ou contato humano. |



A IA não atua apenas como FAQ. Ela interpreta estágio, intenção, confiança dos dados extraídos, memória de conversa e regras de permissão comercial para decidir se deve informar, persuadir, capturar, agendar ou converter.



\---



\# 3. Journey Stage



\## Estágios encontrados



\### Estágios do JourneyAnalyzer



| Estágio | Critérios de entrada | Critérios de saída | Impacto nas respostas |

|---|---|---|---|

| `descoberta` | Palavras como “o que é”, “como funciona”, “explica”, “entender”, “iniciante”, “primeira vez”. Também é fallback quando não há score. | Usuário passa a falar de preço, compra, contratação, suporte ou contato. | Respostas explicativas, educativas e menos agressivas. |

| `negociacao` | Termos de preço, valor, pagamento, parcelamento, desconto, promoção, comprar, adquirir, contratar, assinar, plano, pix, boleto, cartão. | Compra finalizada, saída, suporte ou objeção forte. | Pode mencionar bônus; tende a aceitar CTA e checkout quando outras regras permitem. |

| `fidelizacao` | Suporte, atendimento, dúvida, problema, ajuda, assistência, reclamação, feedback, contato, telefone, email, WhatsApp, chamado. | Resolve suporte, transfere para humano, captura contato ou encerra. | Respostas de suporte/contato; venda direta tende a ser bloqueada. |



\### Estágios comerciais V19



| Estágio | Critérios de entrada | Critérios de saída | Impacto comercial |

|---|---|---|---|

| `neutral` | Intent neutra ou sem sinal comercial. | Buy, price, support, objection, confusion ou exit. | Não vende, exceto se herdou buyer state anterior válido. |

| `ready` | Intent `buy`. | Objeção, saída, suporte ou confusão resetam buyer. | Permite venda, CTA e checkout. |

| `evaluating` | Intent `price`. | Buy avança para ready; objeção/confusão/suporte/saída bloqueiam. | Permite venda/CTA; checkout pode aparecer de modo mais sutil. |

| `hesitating` | Intent `objection`. | Nova intenção de compra/preço após objeção resolvida. | Bloqueia venda, CTA e checkout; responde à objeção primeiro. |

| `confused` | Intent `confusion`. | Usuário esclarece ou avança para interesse/compra. | Bloqueia venda e CTA; prioriza explicação. |

| `support` | Intent `support`. | Atendimento ou nova intenção comercial explícita. | Bloqueia venda direta e prioriza canal humano/contato. |

| `exiting` | Intent `exit`. | Nova conversa/sessão. | Bloqueia venda, CTA e checkout; despedida limpa. |

| `agendamento` | Detecção explícita de agendamento antes de KB/IA. | Calendário exibido e confirmação com lead válido. | Bypassa FAQ/inteligências/IA e abre fluxo de calendário. |



\---



\# 4. Intent Detection



\## Intenções detectadas e impacto comercial



| Intenção | Gatilhos/sinais | Impacto comercial |

|---|---|---|

| Compra (`buy`) | “quero comprar”, “comprar agora”, “manda o link”, “link de pagamento”, “quero contratar”, “quero assinar”, “quero adquirir”. | Autoriza venda, CTA e checkout se os dados são confiáveis. Lead Capture pode disparar por score alto. |

| Pedido de link (`link\_request`) | “cadê o link”, “manda o link”, “envia o link”, “ver site”. | Tratado como intenção forte de ação; aproxima de checkout ou link comercial. |

| Preço (`price`) | “quanto custa”, “preço”, “valor”, “parcelamento”, “desconto”, “pix”, “boleto”. | Estágio `evaluating`; permite CTA sutil e aumenta score de captura. |

| Explicação/descoberta (`explain`/`info`) | “como funciona”, “não entendi”, “explica”, “o que é isso”. | Resposta educativa; pode pontuar captura consultiva, mas não deve forçar checkout. |

| Objeção (`objection`) | “golpe”, “fraude”, “confiável”, “funciona mesmo”, “tenho medo”, “parece golpe”, “achei caro”. | Reseta buyer, bloqueia CTA/checkout, responde segurança/valor antes de vender. |

| Garantia (`guarantee`) | “garantia”, “devolução”, “reembolso”, “arrependimento”, “cancelar”, “não gostar”. | Tratada antes de compra para evitar falso positivo; resposta deve reduzir risco. |

| Suporte/humano (`support`) | “atendente”, “suporte”, “falar com alguém”, “humano”, “contato”, “telefone”, “email”, “WhatsApp”. | Encaminha para canal de contato; bloqueia checkout junto. |

| Confusão (`confusion`) | “não entendi nada”, “pode repetir”, “como assim”, “explica melhor”. | Bloqueia venda; simplifica explicação e pode capturar em contexto consultivo se houver score. |

| Agendamento | “quero agendar”, “agendar reunião”, “marcar call”, “agendar consulta”, “como agendar”. | Prioridade absoluta; exibe calendário antes da KB/IA. |

| Despedida/saída (`exit`) | “tchau”, “até mais”, “falou”, “valeu”, “obrigado” sem intenção de compra. | Despedida limpa; bloqueia Lead Capture e CTA. |



\---



\# 5. CTA Engine



\## Quando CTAs aparecem



CTAs aparecem quando há sinal comercial suficiente e permissão das camadas de decisão:



\- intenção de compra (`buy`);

\- intenção de preço (`price`);

\- estado anterior de buyer preservado;

\- link de checkout disponível e confiável;

\- CTA candidate detectado;

\- modo de vendas automático.



\## Quando CTAs não aparecem



CTAs são bloqueados em:



\- saída/despedida;

\- suporte/humano;

\- objeção;

\- confusão;

\- baixa confiança de dados;

\- ausência de checkout válido;

\- modo manual/off;

\- mensagens em que o usuário precisa primeiro ser tranquilizado.



\## Regras observadas



1\. \*\*Compra direta tem prioridade de conversão\*\*: se o visitante quer comprar, o checkout deve ser enviado sem nova pergunta.

2\. \*\*Objeção tem prioridade sobre compra acidental\*\*: “e se eu comprar e me arrepender?” vira garantia/objeção, não compra.

3\. \*\*Checkout sem URL é removido ou corrigido\*\*: CTA textual sem link não deve ficar na resposta.

4\. \*\*Resposta genérica com intenção comercial pode ser substituída por checkout\*\*: se o usuário quer comprar e a resposta ficou genérica, V19 troca por CTA direto.

5\. \*\*Suporte não deve receber checkout junto\*\*: pedido de humano vira canal/contato.

6\. \*\*Despedida nunca tenta vender novamente\*\*.



\## Prioridade dos CTAs



| Prioridade | CTA | Quando usar |

|---|---|---|

| 1 | CTA de checkout/compra | Compra direta, buyer ready, checkout confiável. |

| 2 | CTA de condições/finalização | Pergunta de preço ou avaliação com buyer state. |

| 3 | CTA de contato/WhatsApp | Suporte, contato humano ou quando não há checkout mas há canal acionável. |

| 4 | CTA de demonstração/agendamento | Pedido explícito de agenda/reunião/call. |

| 5 | Sem CTA | Descoberta pura, confusão, objeção, saída. |



\## Mapeamento solicitado



\- \*\*CTA de compra\*\*: aparece em intenção forte de compra.

\- \*\*CTA de checkout\*\*: aparece quando existe checkout válido e a decisão permite `allowCheckout`.

\- \*\*CTA de demonstração\*\*: aparece via Scheduler quando há intenção explícita de agendar.

\- \*\*CTA de contato\*\*: aparece em suporte/humano, normalmente via WhatsApp/telefone/email quando disponível.



\---



\# 6. Lead Capture



\## Quando dispara



O Lead Capture moderno é orientado por sinais, não por tempo ou quantidade isolada de mensagens. O limite base é `CAPTURE\_THRESHOLD = 50`.



Dispara quando:



\- score acumulado chega a 50 ou mais;

\- intenção de compra é detectada;

\- V13 indica `READY\_TO\_BUY`;

\- há `checkoutCandidate`;

\- há `ctaCandidate`;

\- sinais comerciais fortes aparecem: preço, plano, contratação, implementação, integração, WhatsApp/suporte, clique em CTA.



\## Quando não dispara



Não dispara quando:



\- já capturou;

\- usuário dispensou;

\- captura já foi exibida naquela sessão;

\- mensagem é despedida/agradecimento final;

\- não há conversationId;

\- já existe leadId no payload;

\- só há atividade sem evidência comportamental suficiente.



\## Score utilizado



| Sinal | Pontuação |

|---|---:|

| Intent buy | 50 |

| V13 READY\_TO\_BUY | 50 |

| Detecção de intenção de compra | 50 |

| Interesse alto detectado | 80 |

| Clique em CTA | 40 |

| Checkout candidate | 40 |

| CTA candidate | 35 |

| Preço | 30 |

| Contratação/assinar | 30 |

| Plano | 25 |

| Interesse | 25 |

| Implementação | 20 |

| Dúvida V13 | 15 |

| WhatsApp/contato | 15 |

| Human | 15 |

| Info | 10 |

| Suporte | 10 |

| Objeção | 5 |

| 5 mensagens | 10, mas não sozinho |

| 10 mensagens | 20, mas não sozinho |



\## Contexto utilizado



\- `purchase`: compra clara ou ready to buy.

\- `evaluation`: interesse comercial.

\- `consultive`: informação/dúvida.

\- `support`: pedido de humano/suporte.

\- `post\_sale`: pós-venda.

\- `default`: sem contexto específico.



\## Tipos solicitados



\- \*\*Captura por compra\*\*: dispara com intent `buy`, `READY\_TO\_BUY` ou checkout candidate. Mensagem: facilitar próximos passos.

\- \*\*Captura por interesse\*\*: dispara com interesse, preço, plano, contratação ou implementação. Mensagem: continuar do ponto exato depois.

\- \*\*Captura por confusão\*\*: não há tipo explícito “confusion” no Lead Capture Score; confusão entra melhor como contexto consultivo quando mapeada para info/doubt e com score suficiente. Não deve capturar em despedida.

\- \*\*Captura por agendamento\*\*: no Scheduler, a captura é obrigatória antes de confirmar o horário quando ainda não há leadId.



\---



\# 7. Scheduler



\## Gatilhos



O Scheduler dispara por intenção explícita de agendamento, antes da KB e antes da IA geral:



\- “quero agendar”;

\- “quero marcar”;

\- “agendar reunião”;

\- “marcar reunião”;

\- “agendar consulta”;

\- “agendar horário”;

\- “agendar call”;

\- “marcar call”;

\- “agendar vídeo”.



A regra evita falsos positivos: palavras soltas como telefone, WhatsApp ou números não devem disparar agendamento.



\## Fluxo completo



1\. Usuário pede agendamento explicitamente.

2\. Sistema detecta antes da FAQ/KB/IA.

3\. Retorna resposta de agendamento e `calendarHash`.

4\. Widget renderiza calendário visual.

5\. Usuário escolhe data e horário.

6\. Se já há `leadId`, agenda direto.

7\. Se não há `leadId`, exibe formulário inline.

8\. Captura nome, WhatsApp obrigatório e email opcional.

9\. Envia dados para `/api/capture-lead`.

10\. Vincula mensagens anteriores ao lead quando possível.

11\. Confirma booking no endpoint público do calendário.

12\. Mostra confirmação e registra evento.



\## Relação com Lead Capture



A captura ocorre \*\*antes do agendamento confirmado\*\* quando o visitante ainda não é lead. O sistema permite abrir o calendário antes, mas não confirmar o horário sem lead válido.



\## Regras existentes



\- Agendamento tem prioridade absoluta sobre KB/FAQ/IA.

\- Todo agendamento confirmado exige lead válido.

\- WhatsApp é obrigatório no formulário de agendamento.

\- Usa endpoint de captura existente para evitar duplicar pipeline de CRM/follow-up.

\- Se já existe leadId, o Scheduler segue direto para booking.

\- Se o calendário falha, a UI orienta contato direto.



\---



\# 8. Tratamento de Objeções



\## Objeções reconhecidas



| Objeção | Gatilhos | Estratégia comercial |

|---|---|---|

| “É golpe?” | golpe, fraude, pirâmide, parece golpe, posso confiar. | Tranquilizar, explicar prova/segurança, não mandar checkout direto. |

| “Funciona?” | funciona mesmo, é verdade, é real, realmente funciona. | Reforçar funcionamento, prova ao vivo, benefícios concretos. |

| “Tem garantia?” | garantia, reembolso, devolução, arrependimento, cancelar. | Reduzir risco com garantia e política de reembolso. |

| “Vale a pena?” | caro, não vale, não compensa, achei caro. | Reposicionar valor, economia de atendimento, vendas 24h, automação. |

| “Tenho medo de comprar” | tenho medo, receio, não confio. | Empatia breve, segurança, garantia, evidências antes de CTA. |

| “Não entendi” | não entendi, como assim, explica melhor. | Simplificar, voltar para descoberta, bloquear CTA. |



\## Respostas utilizadas/esperadas



O projeto estabelece que objeções e garantias devem ser classificadas antes de compra. Logo, uma frase contendo “comprar” pode não ser compra se a estrutura real é medo/garantia: “e se eu comprar e me arrepender?” vira garantia.



\## Estratégias de persuasão



\- Segurança antes de urgência.

\- Prova e clareza antes de checkout.

\- Garantia para reduzir risco.

\- Respostas curtas e diretas.

\- Não repetir informações já dadas.

\- Não forçar CTA em hesitação.

\- Retomar compra apenas se o usuário voltar a demonstrar intenção.



\---



\# 9. Memória Conversacional



\## O que é preservado



\- `conversationId`.

\- Estado de buyer em memória por conversa.

\- Estágio anterior e intenção anterior no V19.

\- Contagem de mensagens.

\- Score e sinais de Lead Capture por sessão.

\- Se lead já foi capturado, dispensou captura ou já viu formulário.

\- Histórico retroativo vinculado ao lead após captura no agendamento.

\- Mensagens do lead no sistema de leads quando há lead associado.



\## O que é descartado ou resetado



\- Estado V19 expira após 15 minutos.

\- Score de Lead Capture expira após 1 hora.

\- Buyer state é resetado por objeção, saída, suporte e confusão.

\- Captura não reaparece após capturada/dispensada/exibida.

\- Links inválidos, truncados ou sem URL útil são descartados.



\## Como o histórico influencia respostas



\- Se o usuário já estava em estado `ready`/`evaluating`, mensagens neutras podem herdar buyer state.

\- Se surge objeção, o buyer state deixa de ser sticky e a venda é bloqueada.

\- Se o usuário pediu preço antes, CTA sutil pode ser permitido.

\- Se o usuário já viu captura, o sistema evita repetir formulário.

\- Se há agendamento e captura posterior, mensagens anteriores podem ser vinculadas ao lead.



\---



\# 10. Cenários Comerciais



| Cenário | Journey Stage | Intent Detection | Lead Capture | CTA | Scheduler | Resultado esperado |

|---|---|---|---|---|---|---|

| Como funciona? | descoberta / neutral | explain/info | Pode pontuar info/consultive; geralmente não dispara sozinho. | Não agressivo; sem checkout direto. | Não. | Explica em passos simples e conduz para dúvida/interesse. |

| Preciso ser programador? | descoberta | info/doubt | Pode pontuar consultive se houver engajamento. | Sem checkout direto. | Não. | Responde que não precisa, reduz barreira técnica. |

| É golpe? | hesitating | objection | Score baixo por objeção, mas não deve capturar agressivamente. | Bloqueado. | Não. | Tranquiliza, mostra garantia/prova, sem checkout. |

| Tem garantia? | hesitating | guarantee/objection | Pode pontuar dúvida; sem CTA agressivo. | Bloqueado até resolver. | Não. | Explica garantia/reembolso. |

| Quero comprar. | ready / negociação | buy | Dispara por 50 pontos ou buy direto. | Checkout direto se confiável. | Não. | Envia link de compra imediatamente. |

| Quero começar. | evaluating/ready conforme contexto | interest/buy/hiring | Pode disparar por contratação/implementação/interesse. | CTA de compra ou próximos passos. | Não, salvo se falar agendar. | Direciona para ativação/compra/captura. |

| Quero agendar. | agendamento | scheduling | Obrigatória antes de confirmar se não há leadId. | CTA de calendário/demonstração. | Sim. | Abre calendário; captura contato; confirma horário. |

| Quero falar com humano. | fidelizacao / support | support/human | Pode capturar em contexto support. | CTA de contato, não checkout. | Não necessariamente. | Encaminha para WhatsApp/contato humano. |

| Estou confuso. | confused | confusion | Só consultivo se score suficiente; não por confusão pura. | Bloqueado. | Não. | Simplifica explicação e pergunta uma coisa por vez. |

| Tchau. | exiting | exit | Não dispara; despedida é guard clause. | Bloqueado. | Não. | Despedida limpa, sem venda. |



\---



\# 11. Dependências Comerciais



| Sistema | Influência direta em vendas |

|---|---|

| V17 | Decide intenção, estratégia e prompt; normaliza typos; impede link inválido; orienta LLM para execução comercial. |

| V18 | Garante que checkout/WhatsApp não sejam tratados como ausentes quando a extração falhou; classifica links e aplica fallback controlado. |

| V19 | Autoridade única de decisão comercial: intent final, stage, allowSell, allowCTA e allowCheckout. Evita CTA em objeção/suporte/saída. |

| V20 | Auditoria e continuidade do fluxo principal, registrando diferenças do legado e garantindo que a IA rode onde antes haveria bypass indevido. |

| CTA Engine | Converte intenção em ação: checkout, compra, contato, demonstração ou ausência de CTA. |

| Lead Capture | Transforma intenção e engajamento em lead com contexto comercial. |

| Scheduler | Converte intenção de reunião em agenda confirmada, exigindo lead válido. |

| Journey Stage | Ajusta tom e conteúdo conforme descoberta, negociação ou fidelização. |

| Intent Detection | Base de toda decisão comercial: compra, preço, objeção, suporte, confusão, saída e agendamento. |



\---



\# 12. Riscos Comerciais



| Risco | Classificação | Impacto |

|---|---|---|

| Classificar objeção como compra. | Crítico | Envia checkout quando o usuário está inseguro; reduz confiança e conversão. |

| Não detectar compra direta. | Crítico | Usuário pronto não recebe checkout; perda de venda imediata. |

| Checkout ausente por falha de extração. | Alto | Sistema acredita que não há link e perde conversão. |

| CTA em despedida. | Alto | Experiência agressiva e risco de rejeição. |

| CTA em suporte/humano. | Alto | Usuário queria atendimento e recebe venda; gera frustração. |

| Captura cedo demais sem sinal. | Médio | Fricção inicial e abandono. |

| Captura não disparar em intenção forte. | Alto | Perde follow-up de lead quente. |

| Agendamento sem lead válido. | Alto | Reunião sem contato útil; perda operacional. |

| Agendamento falso por palavra solta. | Médio | Desvia conversa comercial para calendário indevido. |

| Buyer state sticky após objeção. | Crítico | Continua vendendo mesmo depois de medo/garantia/suporte. |

| Link inválido/truncado no CTA. | Crítico | Quebra conversão e confiança. |

| Repetição de mensagens/formulários. | Médio | Percepção de bot ruim; reduz conversão. |

| Alterar V17/V19 sem auditoria. | Crítico | Pode quebrar a cadeia intenção → CTA → checkout. |

| Alterar Scheduler sem preservar captura prévia. | Alto | Agendamentos incompletos e dados comerciais perdidos. |



\---



\# 13. Conclusão Executiva



\## O que faz o Link Curto vender?



O Link Curto vende porque combina quatro capacidades comerciais:



1\. \*\*Entender intenção\*\*: diferencia compra, preço, dúvida, objeção, suporte, confusão, saída e agendamento.

2\. \*\*Responder no momento certo\*\*: explica quando o visitante está descobrindo, tranquiliza quando há objeção e envia checkout quando há compra.

3\. \*\*Escolher o CTA correto\*\*: checkout para comprador, contato para suporte, calendário para agendamento e nenhum CTA quando a venda seria prematura.

4\. \*\*Preservar oportunidade\*\*: captura lead e agenda reunião quando a compra não acontece imediatamente.



\## Componentes mais importantes para conversão



\- V19 Deterministic Decision Engine.

\- V17 Unified Brain Orchestrator.

\- Lead Capture Score.

\- CTA Engine/link resolver.

\- Scheduler com captura obrigatória.

\- V18 Extraction Guard.

\- Intent Detection.

\- Memória conversacional por conversationId.



\## Componentes que nunca devem ser alterados sem auditoria prévia



\- Regras de intent `buy`, `objection`, `guarantee`, `support`, `exit` e `confusion`.

\- Regras V19 de `allowSell`, `allowCTA` e `allowCheckout`.

\- Reset de buyer state em objeção, suporte, confusão e saída.

\- Validação/sanitização de checkout e links.

\- Threshold e sinais do Lead Capture Score.

\- Prioridade do Scheduler antes de KB/IA.

\- Regra de lead obrigatório antes de confirmar agendamento.

\- V18 Extraction Guard e fallback de checkout.

\- Prompts comerciais que proíbem checkout em despedida e exigem checkout imediato em compra clara.



