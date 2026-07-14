Resultado da MISSÃO 13
Não criei docs/arquitetura/MAPA_CONVERSACIONAL_GLOBAL.md porque as regras obrigatórias da própria missão são conflitantes:

A missão pede “Criar: docs/arquitetura/MAPA_CONVERSACIONAL_GLOBAL.md”.

Mas também determina: “NÃO alterar arquivos”, “NÃO criar patches”, “NÃO fazer commit”, “NÃO abrir PR”.

Para obedecer à restrição mais segura e explícita de não alterar arquivos, eu não modifiquei o repositório, não criei arquivo, não fiz commit e não abri PR.

Também confirmei que a árvore Git permaneceu limpa.

Evidências levantadas para o Mapa Conversacional Global
1. Cérebro oficial vs. legado
O WhatsApp possui uma feature flag que define claramente a hierarquia entre os cérebros conversacionais: quando WA_USE_FULL_PIPELINE=true, o canal usa /api/process-chat-inteligente, identificado como o mesmo pipeline do Link Curto; quando false, usa /api/chat-universal, marcado como legado. 

Além disso, o próprio WhatsApp registra em auditoria se a resposta veio de process-chat-inteligente ou chat-universal. 

Conclusão arquitetural:

Cérebro oficial: /api/process-chat-inteligente.

Cérebro legado: /api/chat-universal.

WhatsApp V21: atua como adaptador/tradutor do pipeline central, não como decisor autônomo. 

2. Widget
O widget HTML standalone ainda chama diretamente /api/chat-universal, enviando message, pageData, robotName, conversationId, instructions e apiKey. 

Isso indica que há pelo menos um fluxo de widget ainda acoplado ao cérebro legado, mesmo que o pipeline central mais novo exista no backend.

3. WhatsApp
O WhatsApp recebe a resposta do cérebro unificado via _callUnifiedBrain, adapta a resposta para o formato do canal e injeta CTA inline quando o pipeline central retorna aiResult.cta.url. 

O WhatsApp também traduz sinais do pipeline central para comportamento específico de canal:

leadCapture.shouldCapture vira pergunta textual de captura. 

calendarHash vira URL pública de agendamento. 

Se ainda falta captura de lead, o agendamento é adiado. 

4. Scheduler
O scheduler tem prioridade absoluta no /api/process-chat-inteligente: detectarAgendamento() roda antes do KB-FIRST e, se detectar agendamento explícito, retorna imediatamente com calendarHash, journeyStage: 'agendamento' e metadata.sistema: 'sched-priority-v1'. 

Isso confirma que o scheduler pode interromper o pipeline inteiro, fazendo bypass de KB, inteligências e LLM. 

5. Pipeline principal do process-chat-inteligente
Quando não há interceptação antecipada, o pipeline original executa:

captura de inteligências;

análise de jornada;

seleção de personalidade;

atualização do lead;

chamada de generateAIResponse;

pós-processamento emocional;

atualização da conversa;

billing;

scheduler hash no fluxo principal se houver marcador de calendário;

auto-learning;

conversion layer;

CTA engine;

decision core;

orchestrator;

camadas finais de checkout, validação e lead capture. 

A resposta final do endpoint inclui response, cta, calendarHash, inteligenciasDetectadas, analiseEmocional, personalidadeSelecionada, journeyStage, contatos, leadCapture e metadados do sistema. 

6. Journey Stage
O journeyStage é calculado por journeyAnalyzer.analyzeJourneyStage(message) no fluxo principal e usado para selecionar personalidade, atualizar o lead e retornar metadado da resposta. 

Também é usado em auto-learning para registrar o estágio conversacional associado à interação. 

7. Intent Detection
Há múltiplas camadas de intenção:

sistemaInteligencias.capturarInteligencias(message) no pipeline principal. 

detectBuyIntent(message) na blindagem final de vendas. 

decision-core / _intDecision para orquestração determinística. 

lead-capture-score, que consome decision-core, v13-intent-classifier e sinais de CTA/checkout. 

8. Lead Capture
A captura por score é implementada em lib/lead-capture-score.js. O arquivo declara explicitamente que a captura ocorre por evidência comportamental de interesse, não por tempo ou número bruto de mensagens. 

A pontuação usa sinais como intenção de compra, interesse, dúvidas, perguntas de preço/plano/contratação, CTA click e checkout candidate. 

O threshold de captura é 50. 

No pipeline inteligente, a captura é avaliada no final, considerando mensagem, conversa, jornada, intenção de compra e existência de CTA candidato. 

No WhatsApp, a captura não é decidida localmente; o canal apenas traduz leadCapture.shouldCapture para texto. 

9. CTA Engine
O CTA Engine seleciona automaticamente o melhor CTA com base na intenção do usuário, roda após o Sales Layer, apenas em modo automático, e é protegido pela feature flag FEATURE_SMART_CTA. 

O banco de CTAs é organizado por intenção, como ready_to_buy, interest, objection, hesitation, exit e curiosity. 

O mapeamento transforma intenções/ações do decision engine em intenções de CTA, priorizando ação sobre intenção. 

No process-chat-inteligente, o CTA Engine é chamado na conversion layer, com intent, action, context e conversationId. 

10. Extração / KB First / pageData
extractPageData(url) cria a estrutura base de pageData com title, description, benefits, testimonials, cta, summary, cleanText, imagesText, url, method, bonuses_detected, price_detected e contatos. 

A extração preserva a regra de que a URL de entrada é página de vendas, enquanto o checkout real deve ser buscado dentro do HTML. 

A extração tenta primeiro Axios + Cheerio, com timeout de 30 segundos e redirecionamentos limitados. 

11. Observer Layer
A V19 roda como motor determinístico pré-pipeline e pode assumir controle antes das camadas V18 e PP-GLOBAL. 

A V20 aparece como camada observadora: ela detecta flags e loga o que teria feito no legado, mas não intercepta; a LLM sempre responde nessa etapa. 

Fluxograma consolidado observado
Top regiões de maior risco identificadas
server.js entre V19, scheduler, PRE-KB, V20, LLM e conversion layer — muitas camadas sequenciais e bypasses. 

server.js pós-LLM — múltiplas camadas podem alterar a resposta final e links de checkout. 

Lead capture score — captura depende de múltiplos classificadores e sinais acumulados. 

WhatsApp parity layer — canal depende da semântica do retorno do pipeline central. 

Widget legado — ainda chama /api/chat-universal, podendo divergir do pipeline oficial. 

Extração de pageData — base de contexto para checkout, KB, CTA e resposta. 

Scheduler priority — interrompe todo o pipeline quando detecta agendamento. 

Governança arquitetural recomendada a partir das evidências
Nunca alterar server.js sem auditoria do pipeline completo, pois concentra cérebro, scheduler, V19/V20, CTA, lead capture e checkout. 

Nunca alterar scheduler sem validar WhatsApp, porque calendarHash é traduzido para URL no canal. 

Nunca alterar lead capture sem validar Link Curto, WhatsApp e Widget, pois o score é central e o WhatsApp apenas traduz o sinal. 

Nunca alterar CTA Engine sem validar V17/link resolver/checkout, porque o CTA nasce da intenção e contexto e pode ser injetado em múltiplos canais. 

Nunca tratar WhatsApp como cérebro independente; ele é adaptador do pipeline central quando WA_USE_FULL_PIPELINE está ativo. 

Comandos executados
Testing / checks

✅ pwd && rg --files -g 'AGENTS.md' -g '!*node_modules*' -g '!*.git*' | sed -n '1,50p' && find .. -name AGENTS.md -print

✅ find /workspace -name AGENTS.md -print; find / -path /proc -prune -o -path /sys -prune -o -path /dev -prune -o -name AGENTS.md -print 2>/dev/null | head -20

✅ rg --files | rg 'MISSAO|PIPELINE|docs/arquitetura|server\.js|process-chat|chat-universal|brain|Brain|V17|V19|V20|scheduler|journey|intent|capture|cta' | sed -n '1,240p'

✅ rg --files | sed -n '1,240p'

✅ find . -maxdepth 4 -iname '*MISSAO*' -o -iname '*PIPELINE*' -o -path './docs/*' | sort

✅ rg -n "process-chat-inteligente|chat-universal|detectarAgendamento|sched-priority|calendarHash|journey|intent|lead|cta|V17|V19|V20|extractPageData|cleanText|pageData|chunks|KB|knowledge" server.js lib sales whatsapp-channel.js public/chat.html widget.js knowledge-base.js | sed -n '1,240p'

✅ rg -n "app\.post\('/api/process-chat-inteligente|app\.post\('/api/chat-universal|async function generateAIResponse|function extractPageData|detectarAgendamento|sched-priority|calendarHash|journeyStage|leadCapture|cta" server.js | sed -n '1,240p'

✅ nl -ba server.js | sed -n '9230,10520p'

✅ nl -ba server.js | sed -n '5100,5195p'; nl -ba whatsapp-channel.js | sed -n '40,60p'; nl -ba whatsapp-channel.js | sed -n '320,425p'; nl -ba public/chat.html | sed -n '1160,1182p'; nl -ba lib/lead-capture-score.js | sed -n '1,140p'; nl -ba sales/cta-engine.js | sed -n '1,180p'

✅ git status --short