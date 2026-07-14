Observação obrigatória sobre o entregável

Eu não criei docs/widget/WIDGET\_PIPELINE.md porque sua própria regra obrigatória diz “NÃO alterar arquivos”, “NÃO criar patches”, “NÃO fazer commit” e “NÃO abrir PR”. Como criar esse arquivo seria uma alteração no repositório, mantive a investigação em modo somente leitura e entrego abaixo o conteúdo documentado para você copiar para o arquivo quando quiser.



WIDGET\_PIPELINE.md — Pipeline Completo do Widget Link Mágico

1\. Bootstrap do Widget

Arquivo principal

O widget comercial ativo está em public/widget.js. Ele é um script autoexecutável que recebe window e document, impede inicialização dupla se window.LinkMagicoWidget já existir, detecta o domínio do servidor pelo src do próprio script e lê opcionalmente o parâmetro token da URL do script. 



Como o widget nasce

O nascimento ocorre em três etapas:



O script é carregado no site do cliente.



Ele detecta sua própria URL via document.querySelectorAll('script\[src\*="widget.js"]').



Ele expõe window.LinkMagicoWidget e tenta auto-inicializar com configuração global ou atributo data-linkmagico-config. 



Configuração recebida

A configuração padrão inclui posição, cores, textos, robotName, salesUrl, instructions, apiBase, comportamento visual, captura de leads, analytics e apiKey. 



A inicialização mescla a configuração padrão com userConfig, tenta carregar whitelabel, valida domínio, cria conversationId, restaura leadId do localStorage e injeta a UI quando o DOM estiver pronto. 



Formas de inicialização

O widget procura primeiro window.LinkMagicoWidgetConfig. Se existir apikey em minúsculo, converte para apiKey. Depois tenta data-linkmagico-config em scripts. 



Script legado

Existe também widget.js na raiz, que é um widget mais simples baseado em iframe. Ele exige apiKey, cria botão flutuante e iframe apontando para salesUrl, anexando robotName, instructions, primaryColor, apiKey e welcomeMessage na query string. 



2\. Resolução de Tenant

Principal: apiKey

No widget comercial, o tenant é identificado primariamente por config.apiKey. Esse valor é enviado para whitelabel, captura de lead, chat e persistência local. 



No endpoint principal /api/process-chat-inteligente, o backend resolve a API key via req.cliente?.apiKey, req.session?.validatedApiKey ou req.body.apiKey. 



Token opcional

O parâmetro token na URL do script é lido como widgetToken, mas o próprio código informa que ele é opcional e que o widget pode funcionar por autenticação baseada em configuração. 



Domínio

A validação client-side de domínio é apenas permissiva: localhost é aceito e, fora isso, o código retorna true, com comentário dizendo que a validação real é server-side. 



Whitelabel

Antes de renderizar o widget, o client chama /api/whitelabel-public/:chatbotId, onde chatbotId é apiKey, token ou 'default'. Se retornar configuração, aplica cores, nome da empresa, logo e mensagem inicial. 



Link Curto

No fluxo de link curto, /l/:shortCode busca o registro em cache ou banco, carrega whitelabel do tenant e redireciona para /chatbot com name, url, instructions e apiKey. 



3\. Inicialização da Conversa

conversationId

No widget comercial, o conversationId é criado uma única vez na inicialização do widget com formato:



widget\_<timestamp>\_<random>

Ele não é recuperado de storage; é novo a cada carregamento/inicialização do widget. 



leadId

O leadId é restaurado do localStorage se captureLeads estiver ativo. A chave usada é:



lm\_lead\_<apiKey ou robotName ou default>

Se existir, leadCaptured vira true. 



Cookies e sessionId

No public/widget.js, não há cookie próprio para sessão do widget. O estado persistente client-side relevante é o leadId no localStorage. O backend usa sessão Express em vários pontos, mas o widget comercial envia explicitamente conversationId, leadId e apiKey no payload. 



Persistência

A persistência real da conversa no widget comercial é limitada no client: mensagens ficam no DOM e são limitadas por maxMessages. O vínculo durável com lead depende da captura via /api/capture-lead e, em fluxos chat-first do HTML gerado, de /api/link-conversation. 



4\. Captura Inicial

Captura obrigatória no widget comercial

No public/widget.js, captureLeads vem true por padrão. Ao abrir o chat pela primeira vez, se captureLeads estiver ativo e leadCaptured for falso, o widget mostra o formulário inicial e oculta a área de input. 



O envio de mensagem também é bloqueado antes da captura: se captureLeads estiver ativo e leadCaptured for falso, sendMessage() chama showLeadForm() e retorna. 



Campos do formulário

O formulário renderizado pede nome obrigatório, email opcional no front, telefone opcional e botão “Continuar conversa”. 



Divergência crítica: front vs backend

No front, apenas o nome é obrigatório. 



No backend /api/capture-lead, o email é obrigatório; se não houver email, retorna 400. 



Isso significa que a captura inicial pode “falhar” no backend quando o visitante preenche apenas nome. O front trata erro de API permitindo o chat mesmo assim: marca leadCaptured = true e continua. 



Por que captura antes da conversa?

Porque o próprio widget bloqueia sendMessage() enquanto captureLeads estiver ativo e leadCaptured falso. O objetivo implícito é registrar lead antes de liberar interação. 



Cenários em que captura é ignorada

A captura inicial é ignorada quando:



captureLeads é configurado como false. 



Existe leadId salvo no localStorage, restaurando leadCaptured = true. 



A chamada /api/capture-lead falha; o fallback permite seguir sem lead válido. 



showLeadForm() falha por erro de UI; o fallback marca leadCaptured = true. 



5\. Fluxo Conversacional

Sequência do widget comercial:



Visitante clica no botão.



openChat() abre a janela.



Se precisa capturar lead, mostra formulário.



Após captura ou bypass, input fica disponível.



sendMessage() valida mensagem, tamanho e rate limit.



Mensagem do usuário é adicionada ao DOM.



Mostra typing.



Chama callAPI(message, 0).



Envia payload para /api/process-chat-inteligente.



Recebe JSON.



Armazena calendarHash se existir.



Renderiza resposta, CTAs e/ou calendário.



Dispara eventos de analytics. 



6\. Payload enviado para IA

O payload real do widget comercial para o backend é:



{

&#x20; "message": "...",

&#x20; "robotName": "...",

&#x20; "instructions": "...",

&#x20; "salesUrl": "...",

&#x20; "pageData": {

&#x20;   "url": "...",

&#x20;   "checkoutLink": "..."

&#x20; },

&#x20; "conversationId": "...",

&#x20; "leadId": "...",

&#x20; "apiKey": "..."

}

Ele é construído em callAPI(). 



Headers enviados:



{

&#x20; "Content-Type": "application/json",

&#x20; "X-Widget-Token": "<token opcional>"

}



7\. Endpoint Utilizado

Endpoint principal do widget comercial

O widget comercial usa:



POST /api/process-chat-inteligente



Não usa chat-universal no public/widget.js

O public/widget.js não chama /api/chat-universal; ele chama diretamente /api/process-chat-inteligente. 



chat-universal

/api/chat-universal existe no backend e também possui pipeline de CTA, conversão, enforcement e resposta, mas é usado pelo HTML gerado em alguns fluxos legados/embutidos, não pelo public/widget.js comercial. 



Endpoints secundários do widget comercial

GET /api/whitelabel-public/:chatbotId para whitelabel. 



POST /api/capture-lead para captura inicial. 



POST /api/widget/analytics para analytics. 



GET /api/public/availability/:hash para slots do calendário. 



POST /api/public/book/:hash para confirmar agendamento. 



8\. Enriquecimento de Contexto

No client

Antes de enviar a mensagem, o widget tenta detectar o melhor link de checkout na página atual analisando a e button, texto, href, data-checkout, onclick, palavras de compra e domínios de pagamento. 



Esse link vira pageData.checkoutLink. 



No servidor

No /api/process-chat-inteligente, se pageData não tem conteúdo real (cleanText, title ou summary) mas tem URL, o backend chama extractPageData(targetUrl). Depois faz merge: começa com a extração e sobrescreve com campos não vazios vindos do widget. 



O checkoutLink detectado pelo widget tem prioridade máxima e é preservado explicitamente. 



Ordem de prioridade do checkout

A ordem encontrada é:



pageData.checkoutLink enviado pelo widget.



Extração server-side de extractPageData().



Reforço por FEATURE\_AUTO\_CHECKOUT\_DETECTION, usando req.body.pageData.checkoutLink ou req.body.context.checkoutLink.



Checkout confirmado no banco via \_v113GetConfirmedCheckout, somente se ainda não houver processedPageData.checkoutLink.



Promoção de WhatsApp para CTA se não houver checkout e o promotor estiver ativo. 



extractPageData

extractPageData(url) inicializa objeto com title, description, benefits, testimonials, cta, summary, cleanText, imagesText, url, method, bonuses\_detected, price\_detected e contatos. Depois busca HTML via Axios/Cheerio com user-agent próprio e timeout de 30s. 



9\. Journey Stage

O estágio da jornada é calculado por journeyAnalyzer.analyzeJourneyStage(message) dentro do pipeline de geração de resposta e também no endpoint inteligente. Quando há leadId, o estágio do lead é atualizado. 



No retorno do /api/process-chat-inteligente, journeyStage é devolvido ao client. 



10\. Intent Detection

Há múltiplas camadas de intenção:



Decision Engine legado

O sales/decision-engine.js suporta intenções:



comprar



duvida



objecao



sair



curioso



com padrões textuais explícitos. 



A ação derivada pode ser fechar, quebrar\_objecao, provar, reengajar ou engajar, com ajuste por journeyStage e quantidade de mensagens. 



Inteligências detectadas no endpoint inteligente

O endpoint retorna inteligenciasDetectadas, incluindo flags como intencao\_compra, objecao, curioso, sair, comparacao e suporte, conforme log diagnóstico. 



V18/V19/V17.2

O endpoint inteligente possui camadas adicionais:



V18.1 força buy intent por keywords como comprar, assinar, pagar, plano, preço, checkout, etc. 



V19 pode assumir decisão determinística antes do pipeline. 



V17.2 detecta intenção para resolver link e construir CTA final. 



11\. Lead Capture

Widget comercial: captura antes da conversa

O public/widget.js faz captura inicial bloqueante. captureLeads é true por padrão, mostra formulário no primeiro openChat() e bloqueia envio antes de leadCaptured. 



Chat-first / captura opcional por score

O backend tem lib/lead-capture-score.js, que avalia captura por sinais de intenção e score. O threshold é 50. 



Sinais incluem intent buy, interest, info, human, post\_sale, objection, perguntas sobre preço, plano, contratação, implementação, integração, WhatsApp, suporte, CTA, checkout candidate e acumuladores de mensagens. 



A captura por score é avaliada no final do /api/process-chat-inteligente se chat-first estiver ativo, existir conversationId, não houver req.body.leadId e \_leadCaptureScore estiver disponível. 



O retorno inclui leadCapture com shouldCapture, score, signals, captureMessage e captureContext. 



Diferença para Link Curto

O Link Curto redireciona para /chatbot, que gera HTML completo via generateFullChatbotHTML(). Esse HTML tem fluxo próprio com sessionConversationId, captura inline e chamada a /api/link-conversation para vincular histórico pré-captura. 



Diferença para WhatsApp

As rotas WhatsApp resolvem apiKey por sessão/header/query/body e operam em instância/configurações do tenant. O fluxo não usa formulário visual de lead antes de conversar; é canal conversacional externo, baseado no número/instância/configuração do WhatsApp. 



12\. CTA Engine

CTA no client

O widget transforma qualquer URL presente na resposta em botão .lm-cta-button. O label depende do tipo de link:



WhatsApp → “Falar no WhatsApp”



Instagram → “Ver Instagram”



Facebook → “Ver Facebook”



YouTube → “Ver no YouTube”



TikTok → “Ver TikTok”



Telegram → “Abrir Telegram”



LinkedIn → “Ver LinkedIn”



checkout/hotmart/kiwify/eduzz/monetizze/braip/herospark → “Finalizar Compra”



formulários → “Abrir Formulário”



fallback → “Acessar agora” 



CTA no backend

O sales/cta-engine.js possui banco de CTAs por intenção: ready\_to\_buy, interest, objection, hesitation, exit e curiosity. 



Ele mapeia intenções do decision engine para intenções de CTA e evita repetição por conversationId. 



No endpoint inteligente, a camada final V17.2 remove CTAs textuais antigos, resolve melhor link por intenção e cria objeto cta se shouldShowCTA() permitir. Esse cta é retornado no JSON, mas o public/widget.js atualmente renderiza principalmente URLs dentro de data.response; ele não consome explicitamente data.cta. 



Quando aparece

Aparece visualmente no widget quando a resposta contém URL, pois addMessage() chama processMessageContent() se detectar URL. 



Quando não aparece

Não aparece quando:



A resposta não contém URL.



A resposta tem \[CALENDAR\_WIDGET], pois o fluxo renderiza calendário em vez de processar URLs naquele bloco.



O backend bloqueia checkout por intent não compatível.



URL Guard remove URL insegura/corrompida.



Safe checkout bloqueia link inválido/cross-tenant. 



13\. Scheduler

Detecção

O sistema possui detectarAgendamento() na super inteligência e roda uma prioridade de agendamento antes de KB-first no endpoint inteligente. 



Resposta com marcador

Quando o backend decide abrir calendário, a resposta contém marcador \[CALENDAR\_WIDGET] e retorna calendarHash. O widget armazena data.calendarHash e renderiza calendário ao detectar o marcador. 



Renderização

renderCalendarWidget() cria container, prefere this.calendarHash retornado pela API e, se não houver, tenta gerar hash client-side com SHA-256 de "calendar\_" + apiKey, pegando os 16 primeiros hexadecimais. 



Slots

O widget busca slots em:



GET /api/public/availability/:hash

O backend resolve apiKey pelo hash e retorna schedulingManager.getPublicSlots(tenantId). 



Booking

Ao selecionar horário, o widget envia:



POST /api/public/book/:hash

com data, hora, nome, email, telefone, leadId e notas. O backend cria appointment no leadSystem.addAppointment(). 



14\. Renderização da Resposta

O widget renderiza mensagens por DOM, não por innerHTML livre, exceto botões/ícones controlados. O conteúdo comum vira textContent. URLs viram botões CTA. Calendário vira componente interativo. 



Componentes especiais:



Mensagem de boas-vindas. 



Formulário de lead. 



CTA buttons por URL. 



Calendário inline. 



Typing indicator. 



15\. Dependências Ocultas e Acoplamentos

Principais dependências ocultas encontradas:



apiKey precisa existir para tenant correto no backend. 



Whitelabel depende de /api/whitelabel-public/:chatbotId. 



Captura front exige nome, backend exige email. 



conversationId não persiste entre reloads. 



leadId persiste por localStorage, não por cookie/session. 



Checkout client depende da estrutura DOM da página cliente. 



Backend preserva checkout do widget como prioridade máxima. 



DB checkout só entra se não houver checkout no processedPageData. 



Renderização de CTA depende de URL textual dentro de response, não do objeto cta retornado. 



Calendário depende de marcador textual \[CALENDAR\_WIDGET]. 



Calendário depende de calendarHash ou fallback Web Crypto. 



Analytics depende de navigator.sendBeacon ou fetch keepalive. 



Rate limit é apenas client-side no widget: 10 mensagens por minuto. 



O endpoint inteligente depende de requireApiKey e billingMiddleware. 



Link curto depende da tabela/cache short\_urls. 



/chatbot depende de generateFullChatbotHTML(). 



Agendamento público depende de schedulingManager.resolveApiKeyFromHash(). 



V17/V18/V19 e feature flags podem alterar o comportamento sem mudança no widget. 



leadCapture por score é observer no endpoint e depende de \_chatFirstEnabled. 



Fallbacks silenciosos frequentemente permitem seguir mesmo com falhas, podendo mascarar erro. 



16\. Fluxo Visual Completo

17\. Comparação: Widget vs Link Curto vs WhatsApp

Dimensão	Widget Comercial public/widget.js	Link Curto /l/:shortCode	WhatsApp

Entrada	Script no site do cliente	URL curta	Canal externo WhatsApp

Tenant	config.apiKey	short\_urls.api\_key	API key por sessão/header/query/body

UI	DOM injetado no site	Página /chatbot gerada	Interface WhatsApp

Endpoint principal	/api/process-chat-inteligente	HTML gerado pode usar /api/process-chat-inteligente ou /api/chat-universal conforme template	Rotas e integrações WhatsApp

Captura	Inicial bloqueante por padrão	Inline/chat-first no HTML gerado	Não há formulário visual inicial igual ao widget

Persistência lead	localStorage para leadId	Lead/conversation no HTML e /api/link-conversation	Telefone/instância/configuração

Checkout	Detecta DOM do site cliente	Extração da URL de vendas cadastrada	Depende do contexto/tenant/resposta

CTA	URLs viram botões no widget	HTML próprio	Mensagem textual/link no WhatsApp

Scheduler	Calendário inline	HTML gerado tem fluxo próprio de calendário	Depende de integração/mensagem

Comercial	Embutido na página de vendas	Página hospedada pelo Link Mágico	Conversa em canal de atendimento

18\. Pontos Críticos

Top 20 riscos de regressão

Quebrar auto-init via window.LinkMagicoWidgetConfig. 



Quebrar fallback apikey → apiKey. 



Alterar geração de conversationId. 



Perder restauração de leadId. 



Mudar regra front de captura sem alinhar backend. 



Remover fallback que libera conversa se captura falhar. 



Alterar endpoint /api/process-chat-inteligente. 



Quebrar merge de pageData. 



Sobrescrever checkout detectado pelo widget. 



Quebrar extração server-side. 



Quebrar extractBestCheckoutLink(). 



Não retornar calendarHash. 



Remover marcador \[CALENDAR\_WIDGET]. 



Quebrar hash fallback do calendário. 



Quebrar /api/public/availability/:hash. 



Quebrar /api/public/book/:hash. 



Retornar CTA apenas em cta sem URL em response, pois widget não renderiza data.cta diretamente. 



Alterar labels de getSmartLinkLabel() e afetar conversão. 



Feature flags V17/V18/V19 mudarem resposta sem mudança no widget. 



Billing/API key middleware bloquear widget externo. 



Top 20 componentes críticos

public/widget.js



LinkMagicoWidget.init()



LinkMagicoWidget.openChat()



LinkMagicoWidget.sendMessage()



LinkMagicoWidget.callAPI()



LinkMagicoWidget.extractBestCheckoutLink()



LinkMagicoWidget.addMessage()



LinkMagicoWidget.processMessageContent()



LinkMagicoWidget.renderCalendarWidget()



LinkMagicoWidget.bookSlot()



/api/process-chat-inteligente



extractPageData()



\_v113GetConfirmedCheckout



V17.2 Link Resolver



V19 Decision Engine



journeyAnalyzer



lib/lead-capture-score.js



sales/cta-engine.js



schedulingManager



/api/capture-lead



Checks executados

✅ pwd \&\& rg --files -g 'AGENTS.md' -g '!node\_modules' -g '!vendor' \&\& git status --short — verificação inicial; o comando retornou código 1 porque não encontrou AGENTS.md via rg, sem alterar arquivos.



✅ find .. -name AGENTS.md -print; git status --short — confirmou ausência de AGENTS.md aplicável e worktree limpo.



✅ rg --files -g '!node\_modules' -g '!vendor' | sed -n '1,200p' — inspeção de estrutura.



✅ rg -n "process-chat-inteligente|chat-universal|extractPageData|shouldCapture|captureContext|journey|intent|calendarHash|detectarAgendamento|checkoutLink|short\_urls|apiKey|conversationId|leadId|sessionId|localStorage|cookie" public/widget.js widget.js server.js routes.js short-url-generator.js whatsapp-routes.js sales -g '!node\_modules' — busca dos pontos do pipeline.



✅ nl -ba public/widget.js | sed -n '1,260p' e demais faixas de public/widget.js — leitura com numeração de linhas.



✅ nl -ba server.js | sed -n '4839,4925p', 5105,5195p, 8249,8345p, 8580,9205p, 9200,10520p, 11982,12035p, 12236,12316p — leitura dos endpoints e pipeline.



✅ nl -ba lib/lead-capture-score.js | sed -n '1,380p' — análise da captura por score.



✅ nl -ba sales/decision-engine.js | sed -n '1,170p' — análise de intent detection.



✅ nl -ba sales/cta-engine.js | sed -n '1,280p' — análise do CTA Engine.



✅ git status --short — confirmou que nenhum arquivo foi alterado.

