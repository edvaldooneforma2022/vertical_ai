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

    // ─── DADOS DO PRODUTO ───
    const productBlock = `
DADOS DO PRODUTO:
Nome: ${product.name || 'Não disponível'}
Descrição: ${product.description || 'Não disponível'}
${product.price ? `Preço: ${product.price}` : ''}
${product.bonuses.length > 0 ? `Bônus: ${product.bonuses.slice(0, 3).join(', ')}` : ''}
${product.checkout ? `Link de checkout: ${product.checkout}` : ''}
${product.whatsapp ? `WhatsApp: ${product.whatsapp}` : ''}
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

    // ─── CONTROLE DE LINKS ───
    let linksBlock = '';
    if (strategy.allowCheckout && product.checkout) {
        linksBlock += `\n\nLINK DE CHECKOUT (usar APENAS se intenção = compra):
${product.checkout}
⚠️ Inclua este link na resposta quando o usuário quiser comprar.`;
    }
    if (strategy.allowWhatsApp && product.whatsapp) {
        linksBlock += `\n\nWHATSAPP (o usuário quer suporte):
${product.whatsapp}
⚠️ Inclua este link na resposta para direcionar ao suporte.`;
    }

    // ─── REGRAS ANTI-SPAM (CRÍTICO) ───
    const antiSpamBlock = `

REGRAS CRÍTICAS (NÃO IGNORAR):
- Use APENAS dados reais do contexto fornecido
- Nunca invente informações
- Nunca responda genérico ("ótima pergunta", "posso te ajudar")
- Nunca ignore a pergunta do usuário
- Nunca repita o mesmo link duas vezes na mesma resposta
- Nunca envie link se o usuário estiver confuso, com dúvida ou irritado
- Nunca envie checkout em respostas de objeção ou dúvida
- Só envie checkout quando o usuário demonstrar intenção CLARA de compra
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
// EXPORTS
// ═══════════════════════════════════════════════════════

module.exports = {
    detectIntent,
    getProductContext,
    buildStrategy,
    buildV17Prompt,
    sanitizeResponse
};
