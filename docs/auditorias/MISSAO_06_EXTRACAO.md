Auditoria técnica — sistema de extração do Link Mágico
Escopo e premissas
Auditei somente leitura do fluxo de extração/contexto/resposta.

Não alterei arquivos, não fiz commit, não fiz push e não propus correções, conforme solicitado.

A árvore Git estava limpa ao final da inspeção: git status --short não retornou alterações.

1. Diagnóstico executivo
O caso:

Página contém: “7 dias de garantia incondicional”
IA responde: “Não há informações sobre garantia”

pode ocorrer por múltiplas perdas acumuladas no pipeline. O ponto mais crítico identificado é:

O conteúdo extraído da página pode existir em pageData.cleanText, mas nem sempre chega integralmente ao prompt final. Há cortes em 800, 2.000, 3.000 e 6.000 caracteres dependendo do caminho, além de substituições/merges que podem sobrescrever cleanText.

Os principais pontos de risco são:

extractCleanTextFromHTML() remove tags inteiras e só aceita blocos textuais entre 16 e 999 caracteres. Um bloco longo contendo garantia pode ser descartado. 

A extração inicial remove script, style, noscript, iframe antes de extrair conteúdo. Se a informação de garantia estiver renderizada por script, iframe ou componente dinâmico, ela pode não aparecer no HTML limpo inicial. 

Puppeteer só roda como fallback quando o conteúdo é considerado insuficiente. Se o HTML inicial tiver mais de 500 caracteres e checkout/WA suficientes, o Puppeteer pode ser pulado. 

Quando Puppeteer ou enriquecimento encontram texto “melhor”, o sistema pode substituir cleanText, não apenas adicionar. Isso pode remover informações presentes no texto anterior se o texto novo for maior, mas não necessariamente mais completo. 

Antes da IA, generateAIResponse() corta pageData.cleanText para 6.000 caracteres no fluxo principal. Se “7 dias de garantia incondicional” estiver depois desse limite, não entra no contexto principal. 

O orquestrador V17 reduz cleanText para 800 caracteres no contexto de produto. Se V17 estiver ativo para aquela resposta, a chance de perder garantia aumenta muito. 

O prompt blindado V13 procura garantia apenas nos primeiros 3.000 caracteres e com regex estreito: /garantia\s+de\s+(\d+\s+dias?)/i. A frase “7 dias de garantia incondicional” não casa com esse padrão, porque está na ordem inversa. 

O prompt V13 ainda corta o conteúdo relevante para 2.000 caracteres. 

A Knowledge Builder do RAG limita a base total a 20.000 caracteres e divide por páginas crawleadas; cada página tem corte proporcional. 

O Widget envia inicialmente apenas { url, checkoutLink } em pageData, então o backend precisa extrair de novo; qualquer falha/cache/merge neste ponto afeta o contexto. 

2. Fluxograma completo do fluxo
2.1 Fluxo geral
Página de vendas
  ↓
Frontend / canal de entrada
  ├─ Link Curto: /l/:shortCode → redireciona para /chatbot com url/apiKey/instructions
  ├─ Widget: envia payload para /api/process-chat-inteligente
  └─ WhatsApp: usa pipeline server-side e chama generateAIResponse
  ↓
Endpoint de chat
  ├─ /api/chat-universal
  └─ /api/process-chat-inteligente
  ↓
Verificação: pageData já tem conteúdo real?
  ├─ Sim: usa pageData recebido
  └─ Não: chama extractPageData(url)
        ↓
        Axios + Cheerio
        ↓
        extractCleanTextFromHTML(html)
        ↓
        Extração de title, description, summary, bonuses, prices, links
        ↓
        Heurísticas de checkout/WhatsApp
        ↓
        Possível fallback Puppeteer
        ↓
        Possível enhanced extraction / fallback
        ↓
        uniqueLines(cleanText)
  ↓
Merges e injeções
  ├─ merge extractionResult + pageData do widget
  ├─ checkout do widget pode sobrescrever checkout extraído
  ├─ checkout confirmado do DB pode ser injetado se ausente
  ├─ WA-CTA pode promover WhatsApp a checkoutLink
  └─ V18 Guard pode alterar/validar pageData
  ↓
generateAIResponse()
  ↓
Pré-processamento
  ├─ contactInfo
  ├─ priceInfo
  ├─ pageContentSummary = cleanText.substring(0, 6000)
  ├─ Knowledge Base = compileContext(apiKey, 4000)
  ├─ OCR = até 2 itens
  ├─ V11.2 RAG, se ativo
  ├─ V13/V14/V15/V16/V17/V19 dependendo de flags
  ↓
Montagem do systemPrompt
  ├─ Prompt universal
  ├─ context lock
  ├─ behavior engine
  ├─ decision context
  ├─ RAG context
  ├─ links map
  └─ scraped context
  ↓
messages = [
  { role: "system", content: systemPrompt },
  ...conversationHistory,
  { role: "user", content: cleanUserMessage }
]
  ↓
LLM
  ├─ Groq maxTokens 300
  ├─ OpenRouter maxTokens 250
  └─ OpenAI maxTokens 250
  ↓
Pós-processamento
  ├─ possível combinação com superinteligência
  ├─ fallback local se sem resposta
  ├─ limpeza regex final
  └─ cache de resposta
  ↓
Resposta ao usuário
3. Mapa de arquivos envolvidos
Arquivo	Papel no fluxo	Evidência
server.js	Núcleo do backend: extração, endpoints, merges, prompt e chamada IA.	extractCleanTextFromHTML() está em server.js. 
server.js	extractPageData() cria extractedData, baixa HTML, extrai texto e metadados.	Inicialização de extractedData e campos principais. 
server.js	Endpoint /api/chat-universal, usado por fluxos que enviam mensagem e URL/pageData.	Endpoint e merge quando pageData não tem conteúdo real. 
server.js	Endpoint /api/process-chat-inteligente, usado pelo widget moderno/inline.	Endpoint e extração automática quando pageData vem incompleto. 
server.js	generateAIResponse() monta contexto e chama LLM.	Assinatura da função. 
public/widget.js	Widget envia payload ao backend com pageData mínimo.	Payload com pageData: { url, checkoutLink }. 
public/widget.js	Widget chama /api/process-chat-inteligente.	Fetch para endpoint inteligente. 
public/widget-inline-generator.js	Gerador inline também envia pageData mínimo para /api/process-chat-inteligente.	Fetch e payload inline. 
lib/v17-orchestrator.js	Orquestrador V17 cria contexto de produto reduzido e remove URLs.	cleanText cortado em 800 caracteres. 
lib/v13-prompt-blindado.js	Prompt blindado extrai garantia por regex e corta contexto.	Regex de garantia e cortes de 3.000/2.000 caracteres. 
lib/knowledge-builder.js	Constrói base RAG a partir de páginas crawleadas com limite de caracteres.	Limite default 20.000 e truncamento por página. 
lib/v14-context-layer.js	Memória de curto prazo: histórico e produto resumido.	Limite de 10 mensagens e 500 caracteres por mensagem. 
lib/puppeteer-extractor.js	Fallback/enriquecimento pode substituir cleanText se o texto novo for maior.	Substituição de enriched.cleanText. 
4. Mapa de funções envolvidas
4.1 Extração
extractPageDataWithRetry(url, maxRetries = 3)
Tenta extractPageData(url) com timeout progressivo.

Timeouts: 30s, 45s, 60s.

Considera sucesso se houver cleanText, title ou description. 

extractPageData(url)
Responsabilidades:

Verifica cache por URL. 

Inicializa extractedData. 

Baixa HTML com Axios/Cheerio. Timeout: 30s. Redirects: 5. 

Extrai título, descrição e cleanText. 

Gera summary dos 3 primeiros períodos, limitado a 400 caracteres. 

Extrai bônus e preços. 

Decide se deve usar Puppeteer.

Pode enriquecer com OCR, conteúdo flutuante, iframes, texto dinâmico.

Deduplica linhas com uniqueLines(cleanText). 

extractCleanTextFromHTML(html)
Regras críticas:

Remove: script, style, noscript, iframe, nav, footer, aside. 

Lê apenas: h1, h2, h3, p, li, span, div. 

Só aceita bloco se:

text.length > 15

text.length < 1000
Isso descarta blocos curtos demais e longos demais. 

Inclui meta description no início, se tiver mais de 20 caracteres. 

Remove duplicados por igualdade exata e junta com \n. 

5. Ordem exata de execução — principais canais
5.1 Link Curto
GET /l/:shortCode
  ↓
Valida shortCode
  ↓
Busca no cache Redis: short_url:{shortCode}
  ↓
Se não achar, busca DatabaseHelpers.getShortUrl(shortCode)
  ↓
Salva cache por 3600s
  ↓
Monta parâmetros:
  name, url, instructions, apiKey
  ↓
Redireciona para /chatbot?...
  ↓
Frontend do chatbot envia mensagem para backend
  ↓
Backend processa por /api/process-chat-inteligente ou /api/chat-universal
Evidências:

A rota /l/:shortCode valida o código, busca cache/DB e cacheia por 3600 segundos. 

O redirecionamento passa name, url, instructions e apiKey. 

Risco específico do Link Curto
O Link Curto não transporta conteúdo extraído; ele transporta a URL da página de vendas. Portanto, a qualidade da resposta depende da extração posterior feita pelo backend/chatbot. 

5.2 Widget
public/widget.js
  ↓
Usuário envia mensagem
  ↓
Widget monta payload:
  message
  robotName
  instructions
  salesUrl
  pageData: { url: salesUrl, checkoutLink: detectedCheckoutLink }
  conversationId
  leadId
  apiKey
  ↓
POST /api/process-chat-inteligente
  ↓
Backend detecta que pageData não tem cleanText/title/summary
  ↓
extractPageData(targetUrl)
  ↓
Merge extractionResult + pageData do widget
  ↓
processedPageData → generateAIResponse()
Evidências:

O widget monta pageData apenas com url e checkoutLink; não manda texto completo da página. 

O widget chama /api/process-chat-inteligente. 

O endpoint reconhece pageData incompleto e chama extractPageData(targetUrl). 

Depois faz merge da extração com o pageData recebido, preservando campos não vazios do widget. 

Risco específico do Widget
O Widget depende de extração server-side posterior. Se extractPageData() não capturar a frase da garantia, ela não existirá para a IA. Além disso, se o widget enviar algum campo não vazio com mesmo nome de campo extraído, esse valor pode sobrescrever o extraído no merge. 

5.3 WhatsApp
O caminho WhatsApp aparece acoplado ao fluxo server-side e usa generateAIResponse() no pipeline do backend. O ponto auditável mais claro é que o endpoint/pipeline inteligente chega em:

processedPageData
  ↓
generateAIResponse(message, processedPageData, [], instructions, leadId, apiKey, robotName)
Evidência:

No pipeline inteligente, a LLM é chamada por generateAIResponse() com processedPageData. 

Diferença operacional provável
Widget/Link Curto dependem da URL da página de vendas e extração HTTP/DOM.

WhatsApp tende a depender mais de processedPageData já associado ao tenant/conversa/API key, e pode passar por interceptadores determinísticos antes da IA.

Em perguntas de compra/agendamento, alguns fluxos podem bypassar a IA completamente, mas para pergunta de garantia normalmente deve chegar à IA, salvo se alguma camada classificar de forma diferente. O código mostra bypass de agendamento e compra direta antes da IA. 

6. Limites de caracteres/tokens encontrados
Local	Limite	Efeito
extractCleanTextFromHTML()	aceita blocos < 1000 caracteres	Blocos longos são descartados integralmente. 
extractCleanTextFromHTML()	aceita blocos > 15 caracteres	Blocos muito curtos são descartados. 
Axios	timeout 30s	Página lenta pode não ser extraída. 
Axios	maxRedirects 5	Cadeias longas de redirect podem falhar. 
summary	3 primeiras sentenças + 400 chars	Garantia fora do início não entra no resumo. 
Puppeteer fallback	só se cleanText ausente ou < 200 chars, salvo heurísticas	Conteúdo dinâmico pode não ser renderizado se HTML inicial já parecer suficiente. 
Puppeteer scroll	até 3000px	Conteúdo abaixo desse ponto pode não carregar. 
Conversion scan DOM	50 elementos	Links após os 50 primeiros podem não ser escaneados. 
generateAIResponse()	cleanText.substring(0, 6000)	Conteúdo depois de 6.000 chars não entra nesse resumo. 
Knowledge Base	4000 chars via compileContext(apiKey, 4000)	KB do tenant é limitada antes do prompt. 
OCR	apenas 2 itens	Texto de imagens além dos 2 primeiros não entra. 
V11.2 crawl	5 páginas	RAG de domínio limita profundidade. 
Knowledge Builder	default 20.000 chars total	Base RAG truncada. 
V17 product cleanText	800 chars	Contexto V17 perde quase tudo depois do início. 
V17 FAQ	5 FAQs	FAQs de garantia fora das 5 primeiras não entram. 
V17 bônus	3 bônus	Bônus além dos 3 primeiros não entram. 
V13 garantia scan	primeiros 3.000 chars	Garantia depois disso não é detectada como campo estruturado. 
V13 contexto relevante	2.000 chars	Conteúdo depois disso não entra nesse prompt. 
V14 memória	10 mensagens	Histórico antigo é descartado. 
V14 mensagem	500 chars	Mensagens longas são cortadas. 
LLM Groq	max 300 tokens	Resposta curta; pode omitir detalhe. 
LLM OpenRouter	max 250 tokens	Resposta curta; pode omitir detalhe. 
LLM OpenAI	max 250 tokens	Resposta curta; pode omitir detalhe. 
7. Pontos onde conteúdo pode ser perdido
7.1 Durante limpeza HTML
Perda por remoção de elementos
extractCleanTextFromHTML() remove script, style, noscript, iframe, nav, footer, aside. 

Se a frase “7 dias de garantia incondicional” estiver:

em um iframe;

em conteúdo renderizado por JavaScript;

em um rodapé removido;

em bloco dentro de noscript;

em componente de navegação/aside/footer;

ela pode ser eliminada antes de entrar em cleanText.

7.2 Perda por filtro de tamanho de bloco
O texto só entra se text.length > 15 && text.length < 1000. 

Isso tem dois efeitos:

Se a garantia estiver em um microcopy curto isolado, pode cair no filtro mínimo.

Se a garantia estiver dentro de um grande div com mais de 999 caracteres, o bloco inteiro é descartado.

No caso da frase exata:

“7 dias de garantia incondicional”

ela tem mais de 15 caracteres, então passaria se fosse extraída como bloco próprio. Mas se estiver dentro de um grande bloco de copy de vendas com mais de 999 caracteres, o bloco pode ser descartado.

7.3 Perda por extração inicial aparentemente “boa”
O sistema calcula se já tem conteúdo suficiente e pode pular Puppeteer quando a pontuação estimada é alta. A variável _hasContent é verdadeira com mais de 500 caracteres, e o fallback Puppeteer só roda quando o texto é ausente ou menor que 200 caracteres e a heurística não pulou. 

Consequência:

Uma página com 800 caracteres extraídos, mas sem a garantia, pode ser considerada “boa o suficiente”.

Se a garantia depende de renderização dinâmica, Puppeteer pode não rodar.

7.4 Perda por scroll Puppeteer limitado
Quando Puppeteer roda, ele rola a página até totalHeight >= scrollHeight ou totalHeight > 3000. 

Se a garantia estiver abaixo de 3000px e depender de lazy loading por scroll, pode não carregar.

7.5 Perda por substituição de cleanText
Há pontos em que um texto maior substitui o anterior:

Puppeteer substitui extractedData.cleanText se finalText.length > extractedData.cleanText.length. 

Enhanced content pode substituir por dynamicText se for 20% maior. 

puppeteer-extractor.js também substitui enriched.cleanText se fallback/reparse for maior. 

Risco:

“Maior” não significa “mais completo”. Um texto maior pode não conter a garantia que existia no texto anterior.

7.6 Perda por deduplicação de linhas
No final, se houver cleanText, ele passa por uniqueLines(cleanText). 

Sem ver a implementação de uniqueLines() nesta auditoria, o risco conceitual é:

linhas repetidas/similares podem ser removidas;

se a linha da garantia for considerada duplicada por normalização interna, pode sumir.

7.7 Perda por truncamento antes do prompt
Mesmo que cleanText contenha a garantia, generateAIResponse() usa:

pageData.cleanText.substring(0, 6000)
para pageContentSummary. 

Se a garantia estiver após o caractere 6000, ela não entra nesse bloco.

7.8 Perda por V17 — corte severo de 800 caracteres
O V17 cria contexto de produto com:

cleanText: stripUrlsFromText((d.cleanText || '').slice(0, 800))

Se a resposta sobre garantia passar por V17, a garantia precisa estar nos primeiros 800 caracteres para entrar no product.cleanText.

7.9 Perda por regex de garantia insuficiente
O V13 tenta extrair garantia assim:

const garantiaMatch = text.match(/garantia\s+de\s+(\d+\s+dias?)/i);

Isso detecta:

“garantia de 7 dias”

“garantia de 30 dias”

Mas não detecta:

“7 dias de garantia”

“7 dias de garantia incondicional”

Portanto, no caso real informado, mesmo que a frase esteja nos primeiros 3.000 caracteres, o campo estruturado Garantia: pode ficar vazio.

8. Pontos onde conteúdo pode ser sobrescrito
8.1 Merge do /api/chat-universal
Quando pageData vem sem conteúdo real, o endpoint extrai a URL e faz merge:

const _cuMerged = { ..._cuExtracted };
for (const [k, v] of Object.entries(processedPageData)) {
  if (v !== undefined && v !== null && v !== '') {
    _cuMerged[k] = v;
  }
}
processedPageData = _cuMerged;

Isso significa:

a extração é base;

qualquer campo não vazio enviado pelo frontend sobrescreve a extração.

Se algum frontend enviar cleanText incompleto, mas não vazio, ele pode sobrescrever o cleanText extraído.

8.2 Merge do /api/process-chat-inteligente
Mesmo padrão:

const _intMerged = { ...extractionResult };
for (...) {
  if (v !== undefined && v !== null && v !== '') {
    _intMerged[k] = v;
  }
}
processedPageData = _intMerged;

No Widget atual, o payload mostrado envia apenas url e checkoutLink, então não sobrescreve cleanText nesse arquivo específico. 

Mas o endpoint aceita sobrescrita de qualquer campo não vazio vindo de pageData.

8.3 CheckoutLink sobrescrito/injetado
Embora não afete diretamente garantia, afeta o contexto de venda e rotas determinísticas:

Widget pode preservar/sobrescrever checkout. 

Checkout confirmado do DB é injetado se ausente. 

WA-CTA pode promover WhatsApp para checkoutLink se não houver checkout. 

Essas camadas podem mudar a decisão do fluxo, inclusive gerar respostas determinísticas antes da IA em intenções de compra.

9. Pontos onde conteúdo pode ser truncado
9.1 Na extração
Blocos com 1000+ caracteres são descartados, não truncados. 

summary corta para 400 caracteres. 

9.2 No contexto de IA
cleanText principal: 6.000 caracteres. 

KB: 4.000 caracteres. 

RAG domínio: 20.000 caracteres total. 

V17: 800 caracteres. 

V13: scan de garantia em 3.000 caracteres e conteúdo relevante em 2.000 caracteres. 

9.3 No histórico/memória
V14 mantém 10 mensagens. 

Cada mensagem é limitada a 500 caracteres. 

9.4 Na resposta
LLMs são chamados com maxTokens de 250–300. 

10. Contexto enviado para a IA
No fluxo principal de generateAIResponse():

Cria pageContentSummary com os primeiros 6.000 caracteres de pageData.cleanText. 

Compila Knowledge Base do tenant com limite de 4.000 caracteres. 

Adiciona OCR de até 2 textos de imagem. 

Pode rodar V11.2 RAG e crawl de até 5 páginas. 

Monta systemPrompt com:

prompt universal;

context lock;

hierarquia;

behavior engine;

estado;

decisão;

auto-instruções;

anti-contradição;

RAG;

links map;

scraped context. 

Monta messages com systemPrompt, histórico e mensagem do usuário. 

11. Processamento antes de generateAIResponse()
/api/chat-universal
Antes de chamar a IA:

Recebe message, pageData, url, conversationId, instructions, robotName, leadId. 

Se pageData não tem cleanText, title ou summary, extrai a URL. 

Faz merge da extração com pageData recebido. 

Injeta salesMode e salesPreset. 

Preserva checkout do widget, se houver. 

Injeta checkout confirmado do DB, se ausente. 

Loga estado final, incluindo textLen. 

Pode promover WhatsApp para CTA. 

Passa por V18 Guard. 

Injeta conversationId.

Chama generateAIResponse(). 

/api/process-chat-inteligente
Antes de chamar a IA:

Recebe message, pageData, url, conversationId, instructions, robotName, leadId. 

Define processedPageData = pageData. 

Se não há conteúdo real, usa targetUrl e chama extractPageData(targetUrl). 

Faz merge da extração com pageData. 

Preserva checkout do widget. 

Injeta checkout confirmado do DB se ausente. 

Passa por WA-CTA e V18 Guard. 

Pode passar por V19 e interceptadores.

Em fluxo normal, chama generateAIResponse(). 

12. Caso específico: “7 dias de garantia incondicional”
12.1 Onde a frase pode se perder
Cenário A — frase está em bloco HTML longo
Se a frase estiver em um grande div de copy com mais de 999 caracteres, extractCleanTextFromHTML() descarta o bloco inteiro porque exige text.length < 1000. 

Resultado:

Página contém garantia
↓
Bloco extraído tem 1500 caracteres
↓
Filtro descarta
↓
cleanText não contém garantia
↓
IA responde “não há informações”
Cenário B — frase depende de JavaScript
Se a garantia é renderizada depois por JS, Axios/Cheerio não verá o texto. Puppeteer só roda se o conteúdo inicial for menor que 200 caracteres e a heurística não pular. 

Resultado:

HTML inicial não contém garantia
↓
cleanText inicial tem conteúdo suficiente (>500 chars)
↓
Puppeteer pode ser pulado
↓
Garantia dinâmica não entra
Cenário C — frase está depois dos 6.000 caracteres
Mesmo se cleanText contém a frase, generateAIResponse() corta o contexto principal em 6.000 caracteres. 

Resultado:

cleanText contém garantia no caractere 8500
↓
pageContentSummary = cleanText[0..6000]
↓
Garantia não entra no prompt
↓
IA não sabe responder
Cenário D — V17 ativo e frase depois dos 800 caracteres
V17 reduz cleanText para 800 caracteres. 

Resultado:

cleanText contém garantia no caractere 1200
↓
V17 product.cleanText = primeiros 800 chars
↓
Garantia fora do contexto V17
↓
Resposta pode dizer que não encontrou garantia
Cenário E — V13 tenta estruturar garantia, mas regex não casa
A frase informada é:

“7 dias de garantia incondicional”

A regex é:

garantia\s+de\s+(\d+\s+dias?)
Ela espera “garantia de 7 dias”, não “7 dias de garantia”. 

Resultado:

cleanText contém “7 dias de garantia incondicional”
↓
Regex procura “garantia de 7 dias”
↓
Não encontra
↓
Campo Garantia fica vazio
↓
Prompt estruturado não destaca garantia
Este é um achado central: mesmo quando a frase existe, a camada V13 pode não reconhecê-la como garantia estruturada.

Cenário F — frase está em imagem
Se a garantia estiver em imagem, ela depende de OCR. O contexto de OCR enviado ao prompt usa apenas os dois primeiros itens de imagesText. 

Resultado:

Garantia está em imagem
↓
OCR não roda, falha ou fica depois dos 2 primeiros itens
↓
Prompt não recebe garantia
13. Diferenças entre Link Curto, Widget e WhatsApp
13.1 Link Curto
Resolve /l/:shortCode.

Busca dados do short URL em cache/DB.

Redireciona para /chatbot com name, url, instructions, apiKey. 

Não carrega cleanText.

Depende da extração posterior da URL.

Risco dominante
Falha na extração da URL ou cache de short URL com sales_url incorreto/desatualizado.

13.2 Widget
Envia pageData mínimo: url e checkoutLink. 

Chama /api/process-chat-inteligente. 

Backend identifica ausência de conteúdo e chama extractPageData(targetUrl). 

Faz merge da extração com dados do widget. 

Risco dominante
O Widget não fornece o texto da página; o backend precisa extrair. Se a página bloqueia bot, renderiza via JS ou coloca garantia em bloco longo/imagem, a IA não verá.

13.3 WhatsApp
O pipeline server-side chama generateAIResponse() com processedPageData. 

Pode passar por camadas determinísticas/interceptadores antes da IA, como agendamento e compra direta. 

Depende da disponibilidade de processedPageData associado ao tenant/conversa.

Risco dominante
No WhatsApp, a perda pode vir menos do frontend e mais de:

processedPageData incompleto;

contexto antigo de conversa;

memória V14 resumida;

cache de resposta;

interceptadores que bypassam ou mudam a resposta.

14. Dependências ocultas
14.1 Feature flags
Várias etapas dependem de flags e módulos opcionais:

FEATURE_AUTO_CHECKOUT_DETECTION

FEATURE_V11_3_FALLBACK

FEATURE_V14_CONTEXT_LAYER

FEATURE_CLEAN_CHAT_V2

FEATURE_V11_ENGINE

FEATURE_PRESETS

FEATURE_CONTEXT_LOCK

V18 Guard

V19 Engine

Essas flags alteram o caminho real da resposta. Por exemplo, V14 injeta histórico real se a flag estiver ativa. 

14.2 Cache
Há cache em múltiplos níveis:

extractPageData() retorna cache por URL se existir. 

Link curto cacheia por 3600 segundos. 

Respostas LLM podem vir do cache quando não há checkout. 

No caso da garantia, o cache de resposta é importante: uma resposta antiga “não há informações” pode ser reutilizada se o cache considerar a pergunta similar. 

14.3 Knowledge Base do tenant
Além da página extraída, há contexto de Knowledge Base com compileContext(apiKey, 4000). 

Se a KB disser algo divergente ou não contiver garantia, pode competir com o conteúdo extraído dependendo da montagem final do prompt.

14.4 Context Lock / Behavior Engine
O modo auto adiciona várias camadas antes do scraped context. O próprio comentário de montagem diz que o “SCRAPED CONTEXT” entra por último. 

Isso pode diluir evidência factual se o prompt ficar grande.

15. Conclusão técnica
A resposta “Não há informações sobre garantia” pode ser tecnicamente explicada por qualquer uma destas cadeias:

Cadeia mais provável 1 — extração perdeu a frase
Página contém “7 dias de garantia incondicional”
↓
Frase está em bloco >999 chars, iframe, JS, imagem ou abaixo do conteúdo carregado
↓
extractCleanTextFromHTML() não inclui a frase
↓
pageData.cleanText chega sem garantia
↓
generateAIResponse() não tem evidência
↓
IA responde que não há informação
Evidência principal: filtro de blocos >15 && <1000 e remoção de elementos. 

Cadeia mais provável 2 — extração capturou, mas prompt cortou
cleanText contém a frase
↓
Frase está depois dos primeiros 6000 caracteres
↓
generateAIResponse() corta cleanText
↓
Ou V17 corta para 800 caracteres
↓
Ou V13 corta contexto para 2000/3000 caracteres
↓
IA não recebe a frase
Evidências: cortes em 6000, 800, 3000 e 2000 caracteres. 

Cadeia mais provável 3 — frase existe, mas não foi reconhecida como “garantia”
cleanText contém “7 dias de garantia incondicional”
↓
V13 procura apenas “garantia de X dias”
↓
Regex não encontra
↓
Campo Garantia fica vazio
↓
Prompt estruturado não reforça a garantia
↓
IA pode responder que não há garantia
Evidência: regex específica garantia de X dias. 

16. Evidências por comando executado
Testing / Checks

✅ pwd && rg --files -g 'AGENTS.md' -g '!node_modules' -g '!vendor'

✅ find .. -name AGENTS.md -print

✅ rg -n "extractPageData|cleanText|generateAIResponse|Link Curto|Widget|WhatsApp|chunk|truncate|trunc|magic|Link Mágico|link magico|short link|whatsapp" -S .

✅ rg -n "async function extractPageData|function extractCleanText|cleanText|generateAIResponse|chunk|truncate|MAX|slice\\(|substring\\(" server.js routes src lib public/*.js -S

✅ nl -ba server.js | sed -n '5009,5065p;5105,5235p;5470,5725p;5910,5965p;6125,6420p;6490,6525p;6885,6905p;7510,7550p;7820,7950p;8360,8545p'

✅ nl -ba server.js | sed -n '6400,6445p;6490,6525p;6878,6900p;7490,7575p;7770,7815p' && nl -ba lib/v17-orchestrator.js | sed -n '250,395p' && nl -ba lib/v13-prompt-blindado.js | sed -n '88,116p' && nl -ba lib/puppeteer-extractor.js | sed -n '588,606p'

✅ rg -n "app\\.post\\(\\\"/api/(chat|chat-universal|whatsapp|webhook|.*short|short)|app\\.get\\(\\\"/(c|chatbot|api/link|l)/|short" server.js | head -80 && rg -n "generateAIResponse\\(" server.js lib -S

✅ nl -ba server.js | sed -n '9580,9630p;12236,12313p' && rg -n "fetch\\(.*api/chat-universal|/api/chat-universal|salesUrl|pageData" public/widget.js public/widjet.js public/script.js widget.js public/widget-inline-generator.js -S

✅ nl -ba public/widget.js | sed -n '1768,1795p' && nl -ba public/widget-inline-generator.js | sed -n '614,626p' && nl -ba server.js | sed -n '9300,9360p;9410,9465p'

✅ rg -n "app\\.post\\(\\\"/api/process-chat-inteligente|process-chat-inteligente" server.js && nl -ba server.js | sed -n '9000,9075p'

✅ nl -ba server.js | sed -n '9107,9188p;9200,9255p'

✅ git status --short && nl -ba lib/knowledge-builder.js | sed -n '20,52p' && nl -ba lib/v14-context-layer.js | sed -n '29,33p;93,113p' && nl -ba public/widget.js | sed -n '1796,1810p'