Tabela de divergências — Link Curto vs Widget vs WhatsApp
Dimensão	Link Curto	Widget	WhatsApp
CTA	CTA principal é abrir o assistente via URL. O painel gera uma URL /chatbot?... com nome, URL de venda, instruções e API key; o link curto /l/:shortCode apenas resolve e redireciona para essa rota completa. 	CTA principal é abrir o chat flutuante no site do cliente e continuar a conversa dentro do widget. O widget também tem botão visual de CTA .lm-cta-button para links dentro da conversa. 	Pode atuar como CTA de conversão quando o site não tem checkout, mas há WhatsApp com sinais de compra/agendamento/orçamento. O promotor de WhatsApp só promove WA como CTA se não existir checkout e a confiança for suficiente. 
Lead Capture	Indireto: o link curto leva para /chatbot, que carrega o assistente com parâmetros. O link em si não captura lead; ele só registra acesso/analytics e redireciona. 	Forte e nativo: o widget tem captureLeads: true, formulário com nome, email e WhatsApp, bloqueia envio antes da captura e chama /api/capture-lead. 	Mais voltado a contato/handoff/conversão externa do que captura estruturada dentro do produto. Pode ser usado como canal de notificação/integração, mas a captura estruturada oficial continua sendo o endpoint de leads. 
Scheduler	Depende da experiência do /chatbot para iniciar agendamento; o link curto não agenda por si só. A documentação de agendamento descreve o fluxo no chatbot, com formulário e rota dedicada. 	Suporta o fluxo conversacional que pode levar ao agendamento. A arquitetura expõe endpoints de agendamento e a plataforma declara Scheduler integrado. 	Quando WhatsApp é CTA de serviço/agendamento, pode encaminhar o usuário para marcar externamente; no código, “agendar/reservar/solicitar” são sinais fortes para tratar WhatsApp como CTA de conversão. 
Journey Stage	Herda a jornada do chatbot após redirecionar. O short link não tem estágio próprio; ele só leva para a conversa. 	Jornada é persistida no lead: novos leads começam em descoberta, conversas são armazenadas, e o estágio pode ser atualizado para descoberta, negociacao ou fidelizacao. 	Tende a aparecer em dois estágios: negociação, quando WA vira CTA de conversão, e fidelização/suporte, quando o usuário pede contato humano. O analisador classifica termos como comprar/pagamento em negociação e WhatsApp/suporte/contato em fidelização. 
Intent Detection	Não detecta intenção diretamente no acesso ao link; a intenção é inferida depois, dentro da conversa do /chatbot. 	Usa classificador determinístico na conversa: retorna intenções como READY_TO_BUY, INTEREST, DOUBT, OBJECTION, SUPPORT, GREETING e GENERIC. 	Tem duas camadas de intenção: suporte/humano por padrões como “whatsapp”, “zap”, “atendente”, e conversão por heurísticas de CTA em links WA. 
Handoff	Handoff indireto: o link abre o chatbot; qualquer transferência para humano acontece depois, conforme intenção e canal disponível. 	Handoff ocorre dentro do fluxo do chat quando a intenção é suporte. A engine bloqueia checkout em SUPPORT e prioriza ação de suporte. 	Handoff é o ponto mais forte: o channel-resolver injeta WhatsApp quando há intenção de suporte/humano e existe canal disponível, priorizando WhatsApp extraído da página, contatos extraídos, configuração do tenant e fallback. 
Contexto Conversacional	Contexto inicial vem dos parâmetros do link: nome do robô, URL de venda, instruções e API key. O short link redireciona para /chatbot reconstruindo esses parâmetros. 	Contexto mais rico e persistente: mantém conversationId, estado de lead capturado, histórico de mensagens no lead e dados da página/site via configuração do widget. 	Contexto é mais canalizado para contato/conversão: resolve o melhor WhatsApp a partir de pageData, contatos extraídos ou tenant; não é o repositório principal do histórico, mas preserva caminho de contato quando a conversa pede humano. 
Leitura consolidada
Canal	Melhor uso	Principal divergência
Link Curto	Distribuição externa: bio, social, anúncio, mensagem, QR code.	É um atalho de entrada para o chatbot; não é, por si só, o motor de captura, scheduler ou handoff.
Widget	Site do cliente, onde a IA fica embutida e captura lead antes da conversa.	É o canal mais completo para lead capture + contexto + jornada + conversa contínua.
WhatsApp	Conversão assistida, suporte humano, WA-first e fallback de contato.	É o melhor canal de handoff e pode virar CTA primário quando não há checkout e há sinais de conversão.
Testing

✅ pwd && rg -n "Link Curto|Widget|WhatsApp|CTA|Lead Capture|Scheduler|Journey Stage|Intent Detection|Handoff|Contexto|Conversacional|lead|scheduler|handoff|intent" -S .

✅ find .. -name AGENTS.md -print && rg -n "Link Curto|short link|link curto|share|whatsapp|widget|journey|handoff|intent|scheduler|agend|CTA|capture" docs public lib modules server.js README* -S

✅ nl -ba README.md | sed -n '80,100p;170,190p'

✅ nl -ba docs/ARCHITECTURE.md | sed -n '1,75p;130,150p'

✅ nl -ba README_AGENDAMENTO.md | sed -n '1,55p'

✅ nl -ba lib/leads/lead-capture.js | sed -n '190,250p'

✅ nl -ba modules/leads/journey-analyzer.js | sed -n '1,220p'

✅ nl -ba lib/v13-intent-classifier.js | sed -n '1,180p'

✅ nl -ba lib/v13-rule-engine.js | sed -n '1,130p'

✅ nl -ba lib/channel-resolver-safe.js | sed -n '1,150p'

✅ nl -ba lib/wa-cta-promoter.js | sed -n '1,180p;216,300p'

✅ nl -ba public/widget.js | sed -n '86,145p;360,390p;1400,1490p;1550,1635p'

✅ nl -ba public/index_app.html | sed -n '1636,1655p;2388,2413p;2528,2538p'

✅ nl -ba server.js | sed -n '12230,12318p;12435,12448p'

✅ git status --short — sem alterações no código.