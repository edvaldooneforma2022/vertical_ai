/**
 * 💣 V17 — UNIFIED BRAIN ORCHESTRATOR (LLM-DRIVEN)
 * 
 * PRINCÍPIO: V17 DECIDE, IA EXECUTA.
 * 
 * Este módulo é o ÚNICO ponto de decisão do sistema.
 * Ele detecta intenção, monta estratégia e constrói o prompt.
 * A IA (LLM) recebe esse prompt e gera a resposta.
 * NENHUMA camada altera a resposta depois.
 * 
 * Fluxo:
 *   V14.3 (dados) → V17 (decide) → LLM (responde) → Sanitizer → injectLinks → Output
 * 
 * PROIBIDO:
 *   - V13 alterar resposta final
 *   - V15 alterar resposta final
 *   - V16 sobrescrever resposta
 *   - PP-GLOBAL injetar qualquer coisa
 *   - QUALQUER link hardcoded no sistema
 */

// ═══════════════════════════════════════════════════════
// UTILIDADES
// ═══════════════════════════════════════════════════════

function normalize(text) {
    return (text || '').toLowerCase().trim();
}

function contains(text, patterns) {
    const t = normalize(text);
    return (patterns || []).some(p => t.includes(p));
}

// ═══════════════════════════════════════════════════════
// 🔤 INTENT NORMALIZATION LAYER (PRÉ-CLASSIFIER)
// Corrige typos e abreviações ANTES da classificação
// ═══════════════════════════════════════════════════════

function normalizeIntentText(rawText) {
    if (!rawText) return '';
    let text = rawText.toLowerCase().trim();

    // Remove acentos para matching robusto
    text = text
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // 🧠 Correções de abreviações críticas (buy intent)
    const replacements = [
        [/\b(qro|qr|kro|kero|keru|queroo)\b/g, 'quero'],
        [/\bcomprarrr?\b/g, 'comprar'],
        [/\bcompra\b/g, 'comprar'],
        [/\bagoraaa?\b/g, 'agora'],
        [/\bjaa?\b/g, 'ja'],
        [/\bagr\b/g, 'agora'],
        [/\bblz\b/g, 'beleza'],
        [/\bmnd\b/g, 'manda'],
        [/\bpfv\b/g, 'por favor']
    ];

    replacements.forEach(([regex, value]) => {
        text = text.replace(regex, value);
    });

    return text;
}

// ═══════════════════════════════════════════════════════
// 🎯 SEMANTIC SHORTCUTS (ANTES DO CLASSIFIER)
// Padrões de alta confiança que NÃO podem falhar
// ═══════════════════════════════════════════════════════

function detectIntentShortcut(normalizedText) {
    if (!normalizedText) return null;
    const t = normalizedText;

    // 🔥 BUY INTENT FORTE — não pode ser classificado como exit/info
    if (
        /\b(quero comprar|comprar agora|quero isso|vou comprar|fechar agora|beleza quero comprar)\b/.test(t)
    ) {
        return 'buy';
    }

    // 🔥 LINK REQUEST — curto e direto
    if (
        /\b(cade|onde (fica|compro|pago|e o link)|link|manda o link|envia o link|me manda|ver site)\b/.test(t)
    ) {
        return 'link_request';
    }

    // 🔴 EXIT REAL — proteção contra falso positivo
    if (
        /\b(quero sair|encerrar|finalizar conversa)\b/.test(t)
    ) {
        return 'exit';
    }

    return null;
}

// ═══════════════════════════════════════════════════════
// 🔒 SANITIZE LINK — REGRA ABSOLUTA: PROIBIDO LINK INVÁLIDO
// Se o link é inválido, retorna null. PONTO FINAL.
// ═══════════════════════════════════════════════════════

function sanitizeLink(url) {
    if (!url) return null;
    if (typeof url !== 'string') return null;

    const u = url.trim();

    // Link vazio ou muito curto
    if (u.length < 10) return null;

    // PROIBIDO: links com ".." (truncados pelo LLM)
    if (u.includes('..')) return null;

    // PROIBIDO: links que não começam com http
    if (!u.startsWith('http://') && !u.startsWith('https://')) return null;

    // PROIBIDO: links que são só o domínio sem path útil
    // ex: "https://ev.braip.com" sem checkout path
    try {
        const parsed = new URL(u);
        // Se é só domínio sem path significativo, verificar se tem query params
        if (parsed.pathname === '/' && !parsed.search) {
            return null; // Só domínio, sem path ou params
        }
    } catch (e) {
        return null; // URL malformada
    }

    return u;
}

// ═══════════════════════════════════════════════════════
// 🧠 DETECÇÃO DE INTENÇÃO REAL
// ═══════════════════════════════════════════════════════

function detectIntent(msg) {
    // 🔤 PASSO 1: Normalizar texto (typos, abreviações)
    const normalized = normalizeIntentText(msg);
    const m = normalize(msg); // manter original para contains() com acentos

    // 🎯 PASSO 2: Shortcuts semânticos (alta confiança, não pode falhar)
    const shortcut = detectIntentShortcut(normalized);
    if (shortcut) {
        console.log(`[INTENT-SHORTCUT] 🎯 ${shortcut} | raw="${(msg || '').slice(0, 40)}" | normalized="${normalized.slice(0, 40)}"`);
        return shortcut;
    }

    // 🧠 PASSO 3: Classifier original (com texto normalizado onde possível)
    // ⚠️ ORDEM IMPORTA! Dúvidas/objeções/saída ANTES de compra.
    // Isso evita que "e se eu comprar e me arrepender?" seja classificado como "buy".

    // SAÍDA — despedida
    if (contains(m, [
        'tchau', 'falou', 'até mais', 'ate mais', 'flw'
    ])) return 'exit';

    // AGRADECIMENTO SIMPLES (sem intenção de compra)
    // ⚠️ Verificar que NÃO tem intenção de compra junto
    // 🔧 FIX: "blz" removido daqui — agora normalizado para "beleza" e verificado com shortcut
    if (contains(m, ['valeu', 'obrigado', 'brigado', 'obg', 'beleza', 'perfeito', 'show', 'top'])
        && !contains(m, ['comprar', 'quero', 'link', 'pagar'])
        && !contains(normalized, ['quero comprar', 'comprar agora', 'vou comprar'])) {
        return 'exit';
    }

    // GARANTIA / ARREPENDIMENTO — ANTES de buy!
    // Frases como "e se eu comprar e me arrepender?" são GARANTIA, não compra
    if (contains(m, [
        'garantia', 'devolução', 'devolver', 'arrependimento', 'arrepender',
        'reembolso', 'cancelar', 'cancelamento', 'me arrepender',
        'não gostar', 'nao gostar', 'desistir', 'trocar',
        'e se eu', 'se eu não gostar', 'posso devolver'
    ])) return 'guarantee';

    // OBJEÇÃO — dúvida sobre legitimidade (ANTES de buy!)
    if (contains(m, [
        'golpe', 'fraude', 'confiavel', 'confiável',
        'funciona mesmo', 'é verdade', 'piramide', 'pirâmide',
        'é real', 'posso confiar', 'tenho medo', 'receio',
        'não confio', 'parece golpe', 'isso é golpe', 'achei caro'
    ])) return 'objection';

    // SUPORTE — quer falar com humano
    if (contains(m, [
        'whatsapp', 'falar com', 'atendente', 'suporte', 'humano',
        'falar com alguem', 'falar com alguém', 'contato', 'ligar',
        'telefone', 'email', 'ajuda humana'
    ])) return 'support';

    // COMPRA — intenção clara de comprar (SÓ AQUI, depois de eliminar dúvidas)
    // 🔧 Agora também verifica texto normalizado para pegar typos
    if (contains(m, [
        'quero comprar', 'comprar', 'manda o link', 'como comprar',
        'me manda', 'quero o link', 'link de pagamento', 'pagar',
        'finalizar compra', 'quero adquirir', 'onde compro',
        'como faço para comprar', 'quero me inscrever'
    ]) || contains(normalized, [
        'quero comprar', 'comprar agora', 'vou comprar',
        'manda o link', 'quero o link'
    ])) return 'buy';

    // EXPLICAÇÃO — quer entender
    if (contains(m, [
        'como funciona', 'não entendi', 'nao entendi', 'explica',
        'me explica', 'o que é isso', 'o que e isso', 'como assim',
        'pode explicar', 'me fala mais', 'detalha'
    ])) return 'explain';

    // PREÇO — pergunta sobre valor
    if (contains(m, [
        'preço', 'preco', 'quanto custa', 'valor', 'investimento',
        'quanto é', 'quanto e', 'tem desconto', 'parcelamento',
        'parcela', 'aceita cartão', 'pix', 'boleto'
    ])) return 'price';

    // LINK REQUEST — via texto normalizado (fallback do shortcut)
    if (contains(normalized, ['cade', 'onde compro', 'onde pago', 'manda o link'])) {
        return 'buy';
    }

    // INFO — qualquer outra pergunta
    return 'info';
}

// ═══════════════════════════════════════════════════════
// 🧠 EXTRAI DADOS REAIS DO PRODUTO
// ═══════════════════════════════════════════════════════

function getProductContext(data) {
    const d = data || {};
    const contatos = d.contatos || {};

    // Extrair e VALIDAR checkout
    const rawCheckout = d.checkoutLink || null;
    const validCheckout = sanitizeLink(rawCheckout);

    // Extrair e VALIDAR WhatsApp
    const rawWhatsApp =
        d.whatsappLink ||
        (contatos.whatsappLinks && contatos.whatsappLinks[0]) ||
        (contatos.whatsapp && contatos.whatsapp[0]) ||
        null;

    // 🔒 STRIP URLs de TODOS os campos que vão pro LLM
    // Isso IMPEDE o LLM de ver/truncar/inventar qualquer URL
    const safeFaq = (d.faq || []).map(f => ({
        question: stripUrlsFromText(f.question || ''),
        answer: stripUrlsFromText(f.answer || '')
    }));

    const safeBonuses = (d.bonuses_detected || []).map(b => stripUrlsFromText(String(b)));

    // ═══ FIX-03 [V21.1-HARDENING] — Feature flag para contexto expandido ═══
    // Default: 800 chars (comportamento atual). Flag ON: 3000 chars (~950 tokens).
    const _v17CtxLimit = (process.env.FEATURE_V17_EXTENDED_CONTEXT === 'true') ? 3000 : 800;
    const _v17RawLen = (d.cleanText || '').length;
    const _v17SlicedText = stripUrlsFromText((d.cleanText || '').slice(0, _v17CtxLimit));
    console.log(`[V17-CONTEXT] chars_total=${_v17RawLen} | chars_enviados=${_v17SlicedText.length} | limit=${_v17CtxLimit} | tokens_estimados=${Math.ceil(_v17SlicedText.length / 3.2)}`);

    return {
        name: stripUrlsFromText(d.productName || d.title || ''),
        description: stripUrlsFromText(d.description || ''),
        cleanText: _v17SlicedText,
        faq: safeFaq,
        price: d.price || d.preco || '',
        bonuses: safeBonuses,
        checkout: validCheckout,
        whatsapp: rawWhatsApp,
        socialLinks: contatos.redesSociais || [],
        emails: contatos.email || [],
        phones: contatos.telefone || []
    };
}

// 🛡️ STRIP URLs DO TEXTO (evita que o LLM copie/trunque)
// Remove QUALQUER URL de qualquer campo antes de enviar ao LLM
function stripUrlsFromText(text) {
    if (!text || typeof text !== 'string') return text || '';
    let clean = text;
    // Remove URLs completas (https://..., http://...)
    clean = clean.replace(/https?:\/\/[^\s)>\]]+/gi, '');
    // Remove domínios de plataformas conhecidas SEM protocolo
    // (ex: ev.braip.com/algo, go.hotmart.com/xxx)
    clean = clean.replace(/\b\S*(?:braip|hotmart|kiwify|eduzz|monetizze|herospark|perfectpay|greenn)\.\S+/gi, '');
    // Remove padrões truncados (ev..com, wa..me, etc)
    clean = clean.replace(/\S*\.\.\S*/g, '');
    // Limpa espaços duplos resultantes
    clean = clean.replace(/  +/g, ' ').trim();
    return clean;
}

// ═══════════════════════════════════════════════════════
// 🧠 DEFINE ESTRATÉGIA (CORAÇÃO DO V17)
// ═══════════════════════════════════════════════════════

function buildStrategy({ userMessage, extractedData, conversationHistory }) {
    const intent = detectIntent(userMessage);
    const product = getProductContext(extractedData);
    const msgCount = Array.isArray(conversationHistory) ? conversationHistory.length : 0;

    const hasCheckout = !!product.checkout; // Já validado pelo sanitizeLink
    const hasWhatsApp = !!product.whatsapp;

    // 🔥 CONTROLE DE INTENSIDADE DE VENDA
    let sellMode;
    switch (intent) {
        case 'buy':
        case 'link_request':
            sellMode = 'direct';    // Pode oferecer compra
            break;
        case 'price':
            sellMode = 'direct';    // Pode mostrar preço e link
            break;
        case 'objection':
        case 'guarantee':
            sellMode = 'soft';      // Apenas reduzir risco, sem pressionar
            break;
        case 'explain':
        case 'info':
            sellMode = 'educational'; // Explicar, não vender
            break;
        case 'exit':
        case 'support':
        default:
            sellMode = 'neutral';    // Ajudar normalmente
            break;
    }

    // Tom da resposta
    let tone;
    switch (intent) {
        case 'objection': tone = 'reassuring'; break;
        case 'buy': tone = 'direct'; break;
        case 'link_request': tone = 'direct'; break;
        case 'exit': tone = 'warm'; break;
        case 'support': tone = 'helpful'; break;
        case 'guarantee': tone = 'confident'; break;
        case 'price': tone = 'transparent'; break;
        default: tone = 'helpful'; break;
    }

    return {
        intent,
        sellMode,
        tone,
        // ⚠️ CHECKOUT só quando: (1) intenção de compra/link E (2) link VÁLIDO existe
        allowCheckout: (intent === 'buy' || intent === 'link_request') && hasCheckout,
        // ⚠️ Preço: mostra link SE existir, mas não é obrigatório
        allowCheckoutOnPrice: intent === 'price' && hasCheckout,
        allowWhatsApp: intent === 'support' && hasWhatsApp,
        // Fallback: se não tem checkout válido, oferecer WhatsApp
        fallbackToWhatsApp: (intent === 'buy' || intent === 'link_request' || intent === 'price') && !hasCheckout && hasWhatsApp,
        product,
        messageCount: msgCount
    };
}

// ═══════════════════════════════════════════════════════
// 🧠 PROMPT DINÂMICO (O QUE A IA RECEBE)
// ═══════════════════════════════════════════════════════

function buildV17Prompt(strategy, extractedData, instructions, salesMode) {
    const product = strategy.product;
    const mode = salesMode || 'auto';

    // ─── BASE DO PROMPT (varia por salesMode) ───
    let basePrompt;

    if (mode === 'off') {
        basePrompt = `Você é um assistente objetivo.
Responda com base nos dados fornecidos. Sem vendas, sem CTA.`;
    } else if (mode === 'manual') {
        basePrompt = `Você é um assistente que respeita totalmente as instruções do usuário.
O usuário define o comportamento. Você NÃO sobrescreve isso.`;
    } else {
        // AUTO (default)
        basePrompt = `Você é um assistente de vendas inteligente e humano.
Seu objetivo: entender o usuário, responder com clareza, e conduzir naturalmente.`;
    }

    // ─── DADOS DO PRODUTO (SEM URLs — LLMs truncam links) ───
    const productBlock = `
DADOS DO PRODUTO:
Nome: ${product.name || 'Não disponível'}
Descrição: ${product.description || 'Não disponível'}
${product.price ? `Preço: ${product.price}` : ''}
${product.bonuses.length > 0 ? `Bônus: ${product.bonuses.slice(0, 3).join(', ')}` : ''}
${product.faq.length > 0 ? `FAQ:\n${product.faq.slice(0, 5).map(f => `- ${f.question}: ${f.answer}`).join('\n')}` : ''}

CONTEÚDO:
${product.cleanText || product.description || 'Conteúdo não disponível'}`;

    // ─── ESTRATÉGIA POR INTENÇÃO ───
    const intentBlock = `
INTENÇÃO DETECTADA: ${strategy.intent.toUpperCase()}
MODO DE VENDA: ${strategy.sellMode}
TOM: ${strategy.tone}

REGRAS DO MODO DE VENDA:
${strategy.sellMode === 'direct' ? '- Pode oferecer compra\n- Linguagem objetiva e de fechamento\n- Reforce segurança e garantia' : ''}
${strategy.sellMode === 'soft' ? '- Apenas reduzir risco, sem pressionar\n- Use provas, garantia, depoimentos\n- NÃO ofereça compra\n- NÃO mencione link' : ''}
${strategy.sellMode === 'educational' ? '- Explicar de forma clara e objetiva\n- Use dados reais do produto\n- NÃO venda, apenas eduque\n- NÃO mencione link' : ''}
${strategy.sellMode === 'neutral' ? '- Ajudar normalmente\n- Sem vendas\n- Sem CTA\n- Sem links' : ''}`;

    // ─── CONTROLE DE LINKS (LLM não recebe URLs — só instruções) ───
    let linksBlock = '';
    if (strategy.allowCheckout || strategy.allowCheckoutOnPrice) {
        linksBlock += `\n\nO link de compra será exibido automaticamente abaixo da sua resposta.
⚠️ Diga ao usuário que o link está logo abaixo. NÃO tente escrever nenhuma URL.`;
    }
    if (strategy.allowWhatsApp) {
        linksBlock += `\n\nO link do WhatsApp será exibido automaticamente abaixo.
⚠️ Diga ao usuário que o WhatsApp está logo abaixo. NÃO tente escrever nenhuma URL.`;
    }
    if (strategy.fallbackToWhatsApp) {
        linksBlock += `\n\nNão temos link de compra disponível no momento.
Ofereça ao usuário: "Posso te enviar o link direto pelo WhatsApp pra garantir que funcione. Quer?"
NÃO invente links. NÃO escreva URLs.`;
    }

    // ─── REGRAS ANTI-SPAM (CRÍTICO) ───
    const antiSpamBlock = `

REGRAS CRÍTICAS (NÃO IGNORAR):
- Use APENAS dados reais do contexto fornecido
- Nunca invente informações
- Nunca responda genérico ("ótima pergunta", "posso te ajudar")
- Nunca ignore a pergunta do usuário
- NUNCA escreva URLs, links ou endereços web na resposta
- NUNCA use links incompletos ou inválidos
- Se não houver link válido, NÃO invente
- Máximo 4 linhas por resposta
- Máximo 1 emoji por mensagem
- Responda em português do Brasil
- NUNCA inclua tags HTML ou marcações como [OUT]
- NUNCA inclua blocos de ━━━ ou separadores visuais`;

    // ─── INSTRUÇÕES DO USUÁRIO (modo manual) ───
    const userInstructions = instructions ? `\n\nINSTRUÇÕES DO USUÁRIO (PRIORIDADE MÁXIMA):\n${instructions}` : '';

    // ─── MONTAGEM FINAL ───
    return basePrompt + productBlock + intentBlock + linksBlock + antiSpamBlock + userInstructions;
}

// ═══════════════════════════════════════════════════════
// 🧹 SANITIZER — LIMPA LIXO DO LLM (NUNCA MODIFICA SENTIDO)
// ═══════════════════════════════════════════════════════

function sanitizeResponse(response) {
    if (!response || typeof response !== 'string') return response;

    let clean = response;

    // Remove nomes de plataformas de pagamento (regex simples)
    const blockedTerms = ['Braip', 'Hotmart', 'Kiwify', 'Eduzz', 'Monetizze', 'PerfectPay', 'Greenn'];
    for (const term of blockedTerms) {
        clean = clean.replace(new RegExp(`\\b${term}\\b`, 'gi'), '');
    }

    // Remove tags HTML residuais
    clean = clean.replace(/<s>\s*\[OUT\]/g, '');
    clean = clean.replace(/<[^>]*>/g, '');

    // 🔒 Remove QUALQUER URL truncada/inventada pelo LLM
    // Padrão: links com ".." (ex: ev..com, wa..me)
    clean = clean.replace(/\S*\.\.\S*/g, '');

    // Remove URLs soltas que o LLM tenha colocado (não deveria ter nenhuma)
    clean = clean.replace(/https?:\/\/[^\s)>\]]+/gi, '');

    // Remove emojis de link (🔗) que ficaram soltos
    clean = clean.replace(/🔗\s*/g, '');

    // Remove blocos de separadores que o LLM tenha copiado
    clean = clean.replace(/[━═─]{3,}/g, '');

    // Remove "FINALIZAR COMPRA" que o LLM tenha copiado do contexto
    clean = clean.replace(/🚀\s*FINALIZAR COMPRA/gi, '');

    // Limpa linhas vazias excessivas (máx 2 consecutivas)
    clean = clean.replace(/\n{3,}/g, '\n\n');

    // Limpa espaços duplos
    clean = clean.replace(/  +/g, ' ').trim();

    return clean;
}

// ═══════════════════════════════════════════════════════
// 🔗 INJEÇÃO DETERMINÍSTICA DE LINKS (PÓS-LLM)
// O LLM conversa, o V17 injeta links REAIS e COMPLETOS
// Nunca depende do LLM para outputar URLs (eles truncam)
// ═══════════════════════════════════════════════════════

function injectLinks(response, strategy) {
    if (!response || typeof response !== 'string') return response;

    let result = response;
    const product = strategy.product;

    // Validar checkout com sanitizeLink ANTES de injetar
    const safeCheckout = sanitizeLink(product.checkout);
    const safeWhatsApp = product.whatsapp;

    // Injetar checkout REAL (COMPLETO, nunca truncado)
    if ((strategy.allowCheckout || strategy.allowCheckoutOnPrice) && safeCheckout) {
        result += `\n\n━━━━━━━━━━━━━━━━━━━\n🚀 FINALIZAR COMPRA\n${safeCheckout}\n━━━━━━━━━━━━━━━━━━━`;
    }

    // Injetar WhatsApp REAL (suporte ou fallback)
    if ((strategy.allowWhatsApp || strategy.fallbackToWhatsApp) && safeWhatsApp) {
        const waUrl = safeWhatsApp.startsWith('http')
            ? safeWhatsApp
            : `https://wa.me/${safeWhatsApp.replace(/\D/g, '')}`;
        if (!result.includes(waUrl)) {
            result += `\n\n📱 WhatsApp: ${waUrl}`;
        }
    }

    return result;
}

// ═══════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════

module.exports = {
    detectIntent,
    normalizeIntentText,
    detectIntentShortcut,
    getProductContext,
    buildStrategy,
    buildV17Prompt,
    sanitizeResponse,
    sanitizeLink,
    stripUrlsFromText,
    injectLinks
};
