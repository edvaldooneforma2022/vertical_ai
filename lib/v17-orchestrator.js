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
 *   V14.3 (dados) → V17 (decide) → LLM (responde) → Sanitizer (leve) → Output
 * 
 * PROIBIDO:
 *   - V13 alterar resposta final
 *   - V15 alterar resposta final
 *   - V16 sobrescrever resposta
 *   - PP-GLOBAL injetar qualquer coisa
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
// 🧠 DETECÇÃO DE INTENÇÃO REAL
// ═══════════════════════════════════════════════════════

function detectIntent(msg) {
    const m = normalize(msg);

    // COMPRA — intenção clara de comprar
    if (contains(m, [
        'quero comprar', 'comprar', 'manda o link', 'como comprar',
        'me manda', 'quero o link', 'link de pagamento', 'pagar',
        'finalizar compra', 'quero adquirir', 'onde compro',
        'como faço para comprar', 'quero garantir', 'quero me inscrever'
    ])) return 'buy';

    // SUPORTE — quer falar com humano
    if (contains(m, [
        'whatsapp', 'falar com', 'atendente', 'suporte', 'humano',
        'falar com alguem', 'falar com alguém', 'contato', 'ligar',
        'telefone', 'email', 'ajuda humana'
    ])) return 'support';

    // SAÍDA — despedida
    if (contains(m, [
        'tchau', 'valeu', 'obrigado', 'falou', 'até mais',
        'ate mais', 'flw', 'brigado', 'obg'
    ])) return 'exit';

    // OBJEÇÃO — dúvida sobre legitimidade
    if (contains(m, [
        'golpe', 'fraude', 'confiavel', 'confiável', 'seguro',
        'funciona mesmo', 'é verdade', 'piramide', 'pirâmide',
        'é real', 'posso confiar', 'tenho medo', 'receio',
        'não confio', 'parece golpe', 'isso é golpe'
    ])) return 'objection';

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

    // GARANTIA — pergunta sobre segurança da compra
    if (contains(m, [
        'garantia', 'devolução', 'devolver', 'arrependimento',
        'reembolso', 'cancelar', 'cancelamento', 'prazo'
    ])) return 'guarantee';

    // INFO — qualquer outra pergunta
    return 'info';
}

// ═══════════════════════════════════════════════════════
// 🧠 EXTRAI DADOS REAIS DO PRODUTO
// ═══════════════════════════════════════════════════════

function getProductContext(data) {
    const d = data || {};
    const contatos = d.contatos || {};

    return {
        name: d.productName || d.title || '',
        description: d.description || '',
        cleanText: (d.cleanText || '').slice(0, 800),
        faq: d.faq || [],
        price: d.price || d.preco || '',
        bonuses: d.bonuses_detected || [],
        checkout: d.checkoutLink || null,
        whatsapp:
            d.whatsappLink ||
            (contatos.whatsappLinks && contatos.whatsappLinks[0]) ||
            (contatos.whatsapp && contatos.whatsapp[0]) ||
            null,
        socialLinks: contatos.redesSociais || [],
        emails: contatos.email || [],
        phones: contatos.telefone || []
    };
}

// ═══════════════════════════════════════════════════════
// 🧠 DEFINE ESTRATÉGIA (CORAÇÃO DO V17)
// ═══════════════════════════════════════════════════════

function buildStrategy({ userMessage, extractedData, conversationHistory }) {
    const intent = detectIntent(userMessage);
    const product = getProductContext(extractedData);
    const msgCount = Array.isArray(conversationHistory) ? conversationHistory.length : 0;

    const hasCheckout = !!product.checkout;
    const hasWhatsApp = !!product.whatsapp;

    // 🔥 CONTROLE DE INTENSIDADE DE VENDA
    let sellMode;
    switch (intent) {
        case 'buy':
        case 'price':
            sellMode = 'direct';    // Pode oferecer compra
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
        allowCheckout: (intent === 'buy' || intent === 'price') && hasCheckout,
        allowWhatsApp: intent === 'support' && hasWhatsApp,
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
${strategy.sellMode === 'direct' ? '- Pode oferecer compra e link de checkout\n- Linguagem objetiva e de fechamento\n- Reforce segurança e garantia' : ''}
${strategy.sellMode === 'soft' ? '- Apenas reduzir risco, sem pressionar\n- Use provas, garantia, depoimentos\n- NÃO envie link de checkout' : ''}
${strategy.sellMode === 'educational' ? '- Explicar de forma clara e objetiva\n- Use dados reais do produto\n- NÃO venda, apenas eduque' : ''}
${strategy.sellMode === 'neutral' ? '- Ajudar normalmente\n- Sem vendas\n- Sem CTA' : ''}`;

    // ─── CONTROLE DE LINKS (LLM não recebe URLs — só instruções) ───
    let linksBlock = '';
    if (strategy.allowCheckout && product.checkout) {
        linksBlock += `\n\nO link de compra ESTÁ DISPONÍVEL e será exibido automaticamente abaixo da sua resposta.
⚠️ Diga ao usuário que o link está logo abaixo. NÃO tente escrever a URL você mesmo.`;
    }
    if (strategy.allowWhatsApp && product.whatsapp) {
        linksBlock += `\n\nO link do WhatsApp ESTÁ DISPONÍVEL e será exibido automaticamente abaixo.
⚠️ Diga ao usuário que o WhatsApp está logo abaixo. NÃO tente escrever a URL você mesmo.`;
    }

    // ─── REGRAS ANTI-SPAM (CRÍTICO) ───
    const antiSpamBlock = `

REGRAS CRÍTICAS (NÃO IGNORAR):
- Use APENAS dados reais do contexto fornecido
- Nunca invente informações
- Nunca responda genérico ("ótima pergunta", "posso te ajudar")
- Nunca ignore a pergunta do usuário
- NUNCA escreva URLs ou links na resposta — eles serão injetados automaticamente
- Máximo 4 linhas por resposta
- Máximo 1 emoji por mensagem
- Responda em português do Brasil
- NUNCA inclua tags HTML ou marcações como [OUT]`;

    // ─── INSTRUÇÕES DO USUÁRIO (modo manual) ───
    const userInstructions = instructions ? `\n\nINSTRUÇÕES DO USUÁRIO (PRIORIDADE MÁXIMA):\n${instructions}` : '';

    // ─── MONTAGEM FINAL ───
    return basePrompt + productBlock + intentBlock + linksBlock + antiSpamBlock + userInstructions;
}

// ═══════════════════════════════════════════════════════
// 🧹 SANITIZER LEVE (SÓ LIMPA, NUNCA MODIFICA SENTIDO)
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

    // Limpa espaços duplos (SEM remover quebras de linha intencionais)
    clean = clean.replace(/  +/g, ' ').trim();

    // NUNCA remove links (wa.me, https://, etc.)
    // NUNCA reescreve semanticamente

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

    // Remover qualquer URL truncada/inventada que o LLM tenha colocado
    // (regex: remove URLs que NÃO sejam completas/válidas)
    result = result.replace(/\u{1F517}\s*\S*\.\.\.?\S*/gu, '').trim();
    result = result.replace(/\u{1F517}\s*(?:ev\.\.[\w.]*|wa\.me[^\s]*)/gu, '').trim();

    // Injetar checkout REAL (COMPLETO, nunca truncado)
    if (strategy.allowCheckout && product.checkout) {
        // Só injeta se não existe já o link completo na resposta
        if (!result.includes(product.checkout)) {
            result += `\n\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\ud83d\ude80 FINALIZAR COMPRA\n${product.checkout}\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`;
        }
    }

    // Injetar WhatsApp REAL
    if (strategy.allowWhatsApp && product.whatsapp) {
        const waUrl = product.whatsapp.startsWith('http')
            ? product.whatsapp
            : `https://wa.me/${product.whatsapp.replace(/\D/g, '')}`;
        if (!result.includes(waUrl)) {
            result += `\n\n\ud83d\udcf1 WhatsApp: ${waUrl}`;
        }
    }

    return result;
}

// ═══════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════

module.exports = {
    detectIntent,
    getProductContext,
    buildStrategy,
    buildV17Prompt,
    sanitizeResponse,
    injectLinks
};
