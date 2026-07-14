Escopo e premissa
Não alterei código, não fiz commit e não fiz push. O rastreamento abaixo é exclusivamente estático/técnico, a partir dos arquivos do repositório e comandos de leitura. O ponto central encontrado é que o conteúdo pode estar presente em extractPageData.cleanText, mas desaparecer do prompt final por cortes sucessivos, troca de fonte no merge, caminhos condicionais de prompt e versões alternativas do pipeline.

1. Onde ocorre truncamento de conteúdo
1.1. Extração HTML inicial: descarte por tamanho do bloco
A primeira perda ocorre em extractCleanTextFromHTML(html). Ela percorre seletores h1, h2, h3, p, li, span, div, normaliza o texto e só adiciona blocos com mais de 15 e menos de 1000 caracteres. Blocos maiores que 999 caracteres são descartados por completo, não truncados. 

if (text && text.length > 15 && text.length < 1000) {
    textBlocks.push(text);
}
Consequência: se a frase “7 dias de garantia incondicional” estiver dentro de um div/section longo com mais de 1000 caracteres, esse bloco não entra no cleanText inicial.

1.2. Summary: corte em 400 caracteres
O campo summary usa as primeiras 3 sentenças do bodyText, mas depois corta em 400 caracteres. 

extractedData.summary = sentences.slice(0, 3).join(". ").substring(0, 400) + ...
Esse campo não é o principal para o prompt completo, mas é usado em outros pontos como descrição/resumo fallback.

1.3. FAQ: resposta limitada a 1000 caracteres
Durante a extração de FAQ no extractPageData, cada resposta encontrada é limitada a 1000 caracteres. 

faqItems.push({ question: q, answer: (a || '').substring(0, 1000) });
Se a garantia estiver depois do caractere 1000 da resposta de FAQ, ela é removida desse campo.

1.4. Puppeteer principal: substituição por texto “maior”, não merge textual
Quando o fallback Puppeteer extrai finalText, ele substitui extractedData.cleanText se o texto renderizado for maior que o texto atual. Não há merge linha a linha entre Cheerio e Puppeteer nesse ponto. 

if (finalText && finalText.length > extractedData.cleanText.length) {
    extractedData.cleanText = finalText;
    extractedData.method = "puppeteer";
}
Consequência: se Cheerio capturou “7 dias de garantia incondicional”, mas Puppeteer produziu um texto maior sem essa frase, a frase pode ser perdida por substituição.

1.5. Enhanced extractor: limites duros por item, quantidade e scroll
No enhanced-content-extractor.js, a extração dinâmica tem limites agressivos:

scroll máximo de 30% da página ou 2000px; 

no máximo 150 itens; 

no máximo 300 caracteres por item; 

só seletores prioritários, definidos como os 12 primeiros seletores; 

Isso significa que uma garantia localizada abaixo dos primeiros 30% da página, depois dos 150 primeiros blocos, ou após o caractere 300 de um bloco capturado, não entra em dynamicText.

1.6. Enhanced extractor: short-circuit descarta floating/iframe se já há 50 textos
Se pageContent.texts.length > 50, o enhanced extractor não coleta elementos flutuantes nem iframes. 

Se “7 dias de garantia incondicional” estiver num modal, popup, sticky/floating ou iframe, ela pode ser ignorada quando já houver mais de 50 textos coletados.

1.7. Enhanced OCR: pulado se texto dinâmico tiver mais de 300 caracteres
OCR só roda se não houver texto suficiente; _hasEnoughText é verdadeiro quando dynamicText.length > 300. 

Se a garantia aparece apenas em imagem, mas a página já tem mais de 300 caracteres de texto comum, o OCR é pulado e a garantia não entra no cleanText.

1.8. Elementos flutuantes: bloco precisa ter entre 10 e 1000 caracteres
Mesmo quando floating é coletado, cada elemento precisa ter texto entre 10 e 1000 caracteres. 

1.9. Iframes: cada iframe precisa ter entre 20 e 5000 caracteres
Conteúdo de iframe só entra se o texto total do frame tiver mais de 20 e menos de 5000 caracteres. 

1.10. Prompt principal legado/universal: cleanText cortado em 6000 caracteres
Na geração de resposta, pageData.cleanText é reduzido para os primeiros 6000 caracteres antes de entrar como pageContentSummary. 

const cleanTextLimited = pageData.cleanText.substring(0, 6000);
Logo, qualquer conteúdo presente em cleanText depois da posição 6000 não entra no prompt universal/legado.

1.11. Auto-instructions: cleanText cortado em 2000 caracteres
O gerador de auto-instruções usa apenas os primeiros 2000 caracteres de pageData.cleanText. 

const contentSnippet = pageData.cleanText
    ? String(pageData.cleanText).substring(0, 2000)
    : 'Não disponível';
Se a garantia estiver depois dos 2000 primeiros caracteres, ela não influencia as auto-instruções geradas via LLM.

1.12. V13 blindado: procura garantia só nos primeiros 3000 e envia só primeiros 2000
O prompt V13 tem dois cortes relevantes:

para detectar garantia, usa pageData.cleanText.substring(0, 3000); 

para enviar “CONTEÚDO RELEVANTE”, usa pageData.cleanText.substring(0, 2000). 

Além disso, a regex de garantia V13 captura apenas o padrão garantia de X dias, não necessariamente “7 dias de garantia incondicional”. 

const garantiaMatch = text.match(/garantia\s+de\s+(\d+\s+dias?)/i);
A frase “7 dias de garantia incondicional” não bate literalmente nessa regex, porque a ordem é “7 dias de garantia”, não “garantia de 7 dias”.

1.13. V17: cleanText cortado em 800 caracteres
No orquestrador V17, o contexto de produto usa apenas os primeiros 800 caracteres do cleanText. 

cleanText: stripUrlsFromText((d.cleanText || '').slice(0, 800))
Então, com V17 ativo, a frase só chega ao LLM se estiver nos primeiros 800 caracteres do cleanText ou em outros campos como descrição/FAQ/bonuses.

1.14. V14 contexto conversacional: mensagens cortadas em 500 caracteres e descrição em 300
A camada V14 salva mensagens truncadas a 500 caracteres. 
Também salva productInfo.description com apenas 300 caracteres. 

Isso afeta histórico e contexto persistido entre interações, não necessariamente o primeiro prompt.

1.15. Knowledge Base compilada: limite total de 4000 caracteres
knowledgeBaseManager.compileContext(apiKey, 4000) é chamado com limite de 4000 caracteres. 
Dentro de compileContext, entradas que ultrapassariam o limite são interrompidas com break, e o retorno final ainda aplica substring(0, maxLength). 

1.16. RAG V11.2: base total 20000 e fatia por página
O buildKnowledge do V11.2 limita a base a 20000 caracteres por padrão, corta título em 200, URL em 200, e corta texto por página em maxChars / extractedPages.length, com mínimo 1000 caracteres por página. 

2. Limites máximos de cleanText
Não existe um único “limite máximo global” de cleanText em extractPageData. O que existe é uma combinação de filtros, substituições e limites por caminho.

2.1. extractCleanTextFromHTML
O cleanText inicial é formado por blocos individuais de < 1000 caracteres, sem limite total explícito. 

Limites efetivos:

bloco precisa ter text.length > 15;

bloco precisa ter text.length < 1000;

duplicados são removidos por Set;

o retorno é uniqueBlocks.join("\n").

2.2. Puppeteer principal
Se Puppeteer produzir texto maior, ele substitui o cleanText atual. Não há limite total explícito nesse trecho, mas ele depende do conteúdo passado por extractCleanTextFromHTML(content), portanto herda o filtro de blocos < 1000. 

2.3. Enhanced dynamic text
O dynamicText do enhanced extractor tem limite aproximado de:

150 itens;

300 caracteres por item;

separador \n\n.

Limite bruto aproximado: 150 * 300 = 45.000 caracteres, mais separadores. Mas, na prática, só pega os 12 seletores prioritários e para cedo. 

2.4. Merge enhanced OCR/floating/iframe
OCR, floating e iframe são concatenados em extractedData.cleanText, sem limite global explícito. 

Mas depois pode ocorrer substituição por dynamicText se dynamicText.length > extractedData.cleanText.length * 1.2. 

2.5. Processamento final
No fim da extração, uniqueLines(extractedData.cleanText) remove linhas duplicadas, mas não corta por tamanho global. 

Conclusão sobre limite máximo de cleanText
Na extração: não há limite global final fixo para cleanText.

Por bloco: Cheerio só aceita blocos < 1000; Enhanced aceita itens de 300 caracteres no dynamic path.

No prompt final: o limite relevante é 6000 caracteres no fluxo universal/legado, 2000 no V13 fallback, 800 no V17, 2000 no auto-instructions e 4000 na KB.

3. Limites de contexto enviados ao LLM
3.1. Chamadas LLM e max_tokens
As funções callGroq, callOpenRouter e callOpenAI enviam messages, temperature e max_tokens. 

No fluxo principal legado/universal:

Groq: max_tokens = 300; 

OpenRouter: max_tokens = 250; 

OpenAI: max_tokens = 250. 

Isso limita a saída, não o tamanho do prompt de entrada.

3.2. Contexto da página no prompt universal
No prompt universal, o bloco _scrapedContext inclui:

título;

descrição;

preço;

bônus;

contato;

OCR;

URL;

checkout;

CONTEÚDO DO PRODUTO/SERVIÇO;

KB compilada;

FAQ contextual. 

O conteúdo do produto nesse bloco é pageContentSummary, previamente cortado em 6000 caracteres. 

3.3. KB do tenant no prompt
A KB do tenant é compilada com limite 4000 caracteres. 
O método compileContext interrompe inclusão de FAQs/documentos/entradas/URLs quando excederia o limite e retorna context.substring(0, maxLength). 

3.4. Auto-instructions
Antes do prompt final, as auto-instruções podem ser geradas por LLM a partir de:

título;

descrição;

preço;

bônus;

cleanText.substring(0, 2000). 

Essa chamada usa callLLMFn(messages, 0.3, 500), ou seja, saída de 500 tokens. 

3.5. V13
No V13 blindado:

hard limits: max_tokens: 150, temperature: 0.3, top_p: 0.7; 

conteúdo relevante: primeiros 2000 caracteres de cleanText; 

instruções do operador: primeiros 500 caracteres. 

No V13.1 humanizer, o código usa maxTokens = 120. 

3.6. V17
No V17:

cleanText entra no contexto com slice(0, 800); 

o prompt inclui esse product.cleanText em CONTEÚDO; 

resposta LLM usa maxTokens = 200 em Groq/OpenRouter/OpenAI. 

4. Merges de conteúdo
4.1. Merge inicial por Set
extractCleanTextFromHTML junta blocos únicos com new Set(...), removendo duplicados exatos. 

4.2. Puppeteer principal não faz merge: substitui se maior
Como mostrado, Puppeteer substitui cleanText se finalText for maior. 

Isso é tecnicamente uma substituição por maior conteúdo, não um merge conservador.

4.3. Enhanced OCR/floating/iframe faz append
O enhanced extractor adiciona OCR, floating e iframe ao cleanText com marcadores:

[CONTEÚDO EXTRAÍDO DE IMAGENS];

[ELEMENTOS DINÂMICOS/FLUTUANTES];

[CONTEÚDO DE IFRAMES]. 

4.4. Enhanced dynamic pode substituir tudo
Depois de appendar OCR/floating/iframe, o código pode substituir todo o cleanText por enhancedContent.dynamicText se ele for 20% maior que o cleanText atual. 

Isso pode eliminar conteúdo previamente adicionado, inclusive OCR/floating/iframe, caso dynamicText seja grande o suficiente.

4.5. WhatsApp e checkout são mesclados como metadados, não como texto
Links de WhatsApp detectados pelo enhanced extractor são adicionados em contatos.whatsappLinks e possivelmente promovidos para whatsappLink, sem necessariamente entrar no texto do prompt. 

O conversion scan salva candidatos limitados a 5 links cada em _conversionScan. 

4.6. Puppeteer fallback transfere campos se enriquecidos
No fallback Puppeteer final, cleanText só substitui se o texto enriquecido for maior que o anterior. Também transfere checkout, WhatsApp, FAQ e discoveredLinks sob condições. 

5. Chunks descartados
Aqui “chunks” não aparece como uma estrutura formal única de chunking para extractPageData, mas há vários pontos com descarte por fatia/bloco.

5.1. Blocos HTML > 999 caracteres descartados
Em extractCleanTextFromHTML, blocos com 1000 caracteres ou mais são descartados, não fatiados. 

5.2. Enhanced dynamic descarta após 150 itens
O loop para quando texts.length >= MAX_ITEMS, com MAX_ITEMS = 150. 

5.3. Enhanced dynamic descarta caracteres após 300 por item
Cada texto aceito é cortado com raw.slice(0, MAX_CHARS), MAX_CHARS = 300. 

5.4. Enhanced dynamic ignora blocos longos >= 2000
Ainda no enhanced dynamic, o texto bruto só entra se raw.length > 20 && raw.length < 2000. Blocos com 2000+ caracteres são descartados. 

5.5. Links do conversion scan param em 50 itens
O scan de links renderizados usa MAX = 50 e interrompe quando r.scanned >= MAX. 

5.6. Conversion scan salva apenas top 5 candidatos
Mesmo que encontre mais candidatos, _conversionScan mantém apenas 5 checkouts e 5 WhatsApps. 

5.7. Deep context explorer limita fila de páginas
O deep context explorer limita a fila com queue.slice(0, config.maxPages - 1). 

5.8. Scripts inline grandes são ignorados no deep context
Scripts com mais de 10000 caracteres são ignorados. 

Se a garantia estiver em JSON/script inline grande, esse caminho não captura.

5.9. RAG V11.2 trunca por página e interrompe ao exceder maxChars
buildKnowledge corta texto por página e, se a seção estourar o limite total, insere só o restante com ... e faz break. 

6. Conteúdo presente na extração mas ausente no prompt final
O caso mais importante é este:

extractPageData.cleanText pode conter uma informação, mas o prompt final não a recebe se ela estiver fora da janela usada pelo pipeline ativo.

6.1. Fluxo universal/legado
Se a frase está em pageData.cleanText na posição > 6000, ela não entra em pageContentSummary, pois há substring(0, 6000). 

O prompt universal insere pageContentSummary no bloco CONTEÚDO DO PRODUTO/SERVIÇO. 

Logo:

extractPageData.cleanText contém frase na posição 6500
→ pageContentSummary = cleanText[0..5999]
→ prompt final não contém a frase
6.2. V13 blindado
Se V13 estiver ativo, o prompt blindado só envia cleanText.substring(0, 2000) como “CONTEÚDO RELEVANTE”. 

Além disso, a detecção automática de garantia só busca nos primeiros 3000 caracteres e com regex específica garantia de X dias. 

Portanto, “7 dias de garantia incondicional” pode estar em cleanText, mas:

se estiver depois de 2000 caracteres, não entra no conteúdo relevante;

se estiver depois de 3000 caracteres, nem é candidata a extração de garantia;

mesmo dentro de 3000, a regex não captura a ordem “7 dias de garantia incondicional”.

6.3. V17
Se V17 estiver ativo, apenas cleanText.slice(0, 800) entra em product.cleanText. 
Esse conteúdo vai para o prompt em CONTEÚDO. 

Logo, a frase precisa estar nos primeiros 800 caracteres do cleanText, ou em outro campo incluído, para chegar ao LLM.

6.4. Clean Chat V2 fallback
No fallback useCleanChat, o prompt não inclui pageContentSummary. Ele inclui título, descrição, bônus, contato, URL e FAQ contextual, mas não o conteúdo completo do produto. 

Nesse modo, uma frase presente apenas em cleanText pode ficar ausente do prompt.

6.5. LLM cache pode ignorar o prompt atual
Antes de chamar o LLM, se não há checkout e existe cache similar, o sistema pode usar resposta cacheada e nem chamar LLM com o prompt atual. 

Ou seja, mesmo que a frase esteja no prompt montado, a resposta final pode vir de cache e não refletir a extração atual.

7. Rastreamento completo do exemplo: “7 dias de garantia incondicional”
Abaixo estão os caminhos possíveis da frase desde a extração até a resposta final.

7.1. Origem em HTML estático
Se a frase aparece em um bloco curto, por exemplo:

<p>7 dias de garantia incondicional</p>
ela tende a entrar no cleanText, porque:

seletor p é varrido;

texto normalizado tem mais de 15 caracteres;

texto tem menos de 1000 caracteres. 

Depois, uniqueBlocks.join("\n") monta o cleanText. 

Resultado esperado:

extractPageData.cleanText contém:
7 dias de garantia incondicional
7.2. Origem em HTML estático, mas dentro de bloco grande
Se a frase está dentro de um div com 1200 caracteres, o bloco inteiro é descartado por text.length < 1000. 

Resultado:

extractPageData.cleanText NÃO contém a frase
Esse é um descarte na extração, antes de qualquer prompt.

7.3. Origem em FAQ
Se a frase estiver numa FAQ, ela pode entrar em dois lugares:

no cleanText, se o bloco da FAQ passar nos filtros do extractCleanTextFromHTML; 

no array faq, se o seletor de FAQ detectar pergunta/resposta. A resposta é limitada a 1000 caracteres. 

Se estiver depois dos 1000 caracteres da resposta, some do campo faq.

7.4. Origem em conteúdo renderizado por JS
Se a frase só aparece após renderização JS, ela depende de Puppeteer ou Enhanced.

Puppeteer principal
Se Puppeteer roda e o finalText é maior que o cleanText atual, substitui o cleanText. 

Cenário positivo:

Puppeteer finalText contém frase
→ finalText maior que cleanText atual
→ cleanText passa a conter frase
Cenário negativo:

Cheerio cleanText contém frase
→ Puppeteer finalText não contém frase, mas é maior
→ cleanText é substituído
→ frase desaparece
Enhanced dynamic
O enhanced dynamic só varre parte do DOM, com 150 itens e 300 caracteres por item. 

Se a frase aparecer após o item 150, após o caractere 300 do item, abaixo do scroll coletado, em floating/iframe pulado, ou em OCR pulado, ela não entra.

7.5. Merge pós-extração
Se OCR/floating/iframe capturam a frase, ela é adicionada ao cleanText por append. 

Exemplo:

cleanText original
...
[CONTEÚDO EXTRAÍDO DE IMAGENS]
7 dias de garantia incondicional
Mas se depois enhancedContent.dynamicText for 20% maior que o cleanText, o código substitui tudo pelo dynamicText. 

Cenário de perda:

cleanText + OCR contém frase
dynamicText é maior que cleanText * 1.2
→ cleanText = dynamicText
→ se dynamicText não contém frase, frase desaparece
7.6. Processamento final
No final de extractPageData, uniqueLines remove linhas duplicadas. 

Se a frase estiver duplicada exatamente, só uma ocorrência permanece. Se for única, permanece.

7.7. Entrada no prompt universal/legado
No fluxo universal/legado, a frase só entra no prompt se estiver nos primeiros 6000 caracteres de pageData.cleanText. 

O prompt então inclui:

CONTEÚDO DO PRODUTO/SERVIÇO:
${pageContentSummary}

Exemplo positivo
posição da frase em cleanText = 1200
→ substring(0, 6000) contém frase
→ prompt contém “7 dias de garantia incondicional”
Exemplo negativo
posição da frase em cleanText = 7200
→ substring(0, 6000) não contém frase
→ prompt final não contém a frase
7.8. Entrada no prompt V13
No V13 fallback direto, o prompt envia só os primeiros 2000 caracteres de cleanText. 

Além disso, tenta extrair garantia dos primeiros 3000 caracteres, mas a regex espera “garantia de 7 dias”, não “7 dias de garantia incondicional”. 

Exemplo com a frase em posição 1200
cleanText[1200] = “7 dias de garantia incondicional”
→ entra em CONTEÚDO RELEVANTE
→ mas contextData.guarantee provavelmente fica vazio porque regex não casa
Exemplo com a frase em posição 2500
→ não entra em CONTEÚDO RELEVANTE, pois corte é 2000
→ está dentro dos primeiros 3000, mas regex não casa pela ordem da frase
→ garantia não é estruturada
Exemplo com a frase em posição 3500
→ não entra no CONTEÚDO RELEVANTE
→ não entra na detecção de garantia
→ ausente do prompt V13
7.9. Entrada no prompt V17
No V17, a frase só entra se estiver nos primeiros 800 caracteres de cleanText. 

O prompt V17 coloca isso em:

CONTEÚDO:
${product.cleanText || product.description || 'Conteúdo não disponível'}

Exemplo
posição da frase = 600
→ entra no prompt V17

posição da frase = 1200
→ não entra no prompt V17 via cleanText
7.10. Resposta final
A resposta final pode seguir vários caminhos:

Caminho A — resposta do LLM principal
O array enviado ao LLM é:

[
  { role: "system", content: systemPrompt },
  ...conversationHistory,
  { role: "user", content: cleanUserMessage }
]

Se a frase entrou no systemPrompt, o LLM pode usá-la. Se não entrou, o LLM não tem essa evidência no contexto final.

Caminho B — resposta de cache
Se houver cache similar e não houver checkout, o sistema pode retornar uma resposta cacheada sem chamar LLM. 

Nesse caso, a frase pode estar no cleanText e até no prompt montado, mas a resposta final não será necessariamente baseada nesse prompt.

Caminho C — V13 response builder
No V13.0.2, a resposta base usa pageData.garantia || pageData.guarantee || null, não extrai diretamente “7 dias de garantia incondicional” de cleanText nesse trecho. 

Se pageData.garantia/pageData.guarantee não estiver populado, a garantia pode não aparecer na base, mesmo existindo em cleanText.

Caminho D — V15.5 knowledge enforcer
Depois da humanização V13, o V15.5 pode enriquecer resposta com contexto real usando extractedData: pageData. 

Mas isso depende de feature flag e da lógica do enforcer; não garante que a frase será usada.

Diagnóstico específico da frase “7 dias de garantia incondicional”
Onde ela é encontrada no repositório
O comando encontrou ocorrências relevantes em:

FAQ default da knowledge base: “garantia incondicional de 7 dias”;

termos de uso: “garantia incondicional de 7 (sete) dias”;

markdown de termos: “garantia incondicional de 7 (sete) dias”; 

configuração demo/instruções: “7 dias incondicional. Reembolso total se não gostar.”

A frase exata “7 dias de garantia incondicional” aparece como exemplo em public/index_app.html.

Conclusão técnica
Principais causas de perda da informação
Descarte na extração inicial: blocos HTML com 1000+ caracteres são removidos por completo. 

Substituição por Puppeteer: texto estático pode ser trocado por texto renderizado maior, sem merge conservador. 

Enhanced extractor agressivamente limitado: 150 itens, 300 caracteres por item, scroll parcial, skip de floating/iframe e OCR condicional. 

Substituição enhanced: dynamicText pode substituir todo o cleanText depois de appends de OCR/floating/iframe. 

Corte antes do prompt: universal/legado usa só 6000 caracteres; V13 usa 2000; V17 usa 800. 

Regex V13 não captura a frase na ordem “7 dias de garantia incondicional”: ela procura “garantia de 7 dias”. 

Cache pode bypassar LLM: resposta final pode vir de cache similar, não do prompt atual. 

Comandos usados
Testing / Checks

✅ pwd && find .. -name AGENTS.md -print && rg -n "extractPageData|cleanText|chunk|merge|LLM|prompt|context" -S .

✅ find .. -name AGENTS.md -print -exec sed -n '1,220p' {} \;

✅ sed -n '1,260p' enhanced-content-extractor.js

✅ sed -n '1420,1640p' server.js

✅ sed -n '2000,2180p' server.js

✅ sed -n '260,460p' sales/auto-instructions.js

✅ sed -n '720,805p' knowledge-base.js

✅ nl -ba enhanced-content-extractor.js | sed -n '220,430p'

✅ nl -ba server.js | sed -n '4900,5965p'

✅ nl -ba server.js | sed -n '5990,6068p'

✅ nl -ba server.js | sed -n '6125,6505p'

✅ nl -ba server.js | sed -n '6400,6635p'

✅ nl -ba server.js | sed -n '6810,7045p'

✅ nl -ba server.js | sed -n '7270,7630p'

✅ nl -ba server.js | sed -n '7800,7868p'

✅ nl -ba lib/v13-prompt-blindado.js | sed -n '1,150p'

✅ nl -ba lib/v17-orchestrator.js | sed -n '240,490p'

✅ nl -ba lib/v14-context-layer.js | sed -n '80,155p'

✅ nl -ba lib/knowledge-builder.js | sed -n '1,115p'

✅ nl -ba lib/content-extractor-v112.js | sed -n '1,95p'

✅ nl -ba lib/deep-context-explorer.js | sed -n '340,385p'

✅ git status --short && rg -n "7 dias de garantia incondicional|garantia incondicional|7 dias" . -S