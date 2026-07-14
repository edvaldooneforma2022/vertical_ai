/**
 * ═══════════════════════════════════════════════════════════════════
 * 🔒 CONTEXT LOCK SYSTEM — Link Mágico V8.0
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Garante que a IA:
 *   ✔ Identifique corretamente o produto
 *   ✔ Mantenha consistência absoluta
 *   ✔ Entenda o estado do usuário
 *   ✔ Nunca se perca
 *   ✔ Adapte a conversa dinamicamente
 * 
 * Feature Flag: FEATURE_CONTEXT_LOCK (default: true)
 * Impacto: ZERO em billing, rotas, WhatsApp, CRM, widget, auto-learning
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════
// 🔹 1. EXTRAÇÃO DE IDENTIDADE (Context Identity)
// ═══════════════════════════════════════════════════════════════════

/**
 * Extrai a identidade do produto a partir dos dados de scraping.
 * Retorna um objeto com nome, tipo, promessa, público, preço, categoria, plataforma e confiança.
 * 
 * @param {Object} scrapedData - Dados extraídos da página (pageData)
 * @returns {Object} contextIdentity
 */
function extractContextIdentity(scrapedData) {
    try {
        if (!scrapedData) {
            return _emptyIdentity();
        }

        const title = (scrapedData.title || '').trim();
        const description = (scrapedData.description || '').trim();
        const cleanText = (scrapedData.cleanText || '').trim();
        const url = (scrapedData.url || '').trim();
        const prices = scrapedData.price_detected || [];

        // ── Extrair nome do produto ──
        const productName = _extractProductName(title, description, cleanText);

        // ── Detectar tipo do produto ──
        const productType = _detectProductType(cleanText, url, description);

        // ── Extrair promessa principal ──
        const mainPromise = _extractMainPromise(description, cleanText);

        // ── Detectar público-alvo ──
        const targetAudience = _detectTargetAudience(cleanText, description);

        // ── Preço ──
        const price = prices.length > 0 ? prices[0] : _extractPriceFromText(cleanText);

        // ── Categoria ──
        const category = _detectCategory(cleanText, url, title);

        // ── Plataforma ──
        const platform = _detectPlatform(url);

        // ── Nível de confiança ──
        const confidence = _calculateConfidence({ productName, productType, mainPromise, targetAudience, price });

        return {
            productName,
            productType,
            mainPromise,
            targetAudience,
            price,
            category,
            platform,
            confidence
        };

    } catch (err) {
        console.warn('⚠️ [CONTEXT-LOCK] Erro na extração de identidade (fallback vazio):', err.message);
        return _emptyIdentity();
    }
}

function _emptyIdentity() {
    return {
        productName: '',
        productType: 'indefinido',
        mainPromise: '',
        targetAudience: '',
        price: '',
        category: '',
        platform: '',
        confidence: 0
    };
}

function _extractProductName(title, description, cleanText) {
    // Prioridade: título > primeira linha significativa do texto
    if (title && title.length > 3 && title.length < 200) {
        return title;
    }
    if (description && description.length > 5) {
        // Pegar até o primeiro ponto ou vírgula
        const firstPart = description.split(/[.,!?]/)[0].trim();
        if (firstPart.length > 3 && firstPart.length < 150) return firstPart;
    }
    if (cleanText) {
        const firstLine = cleanText.split('\n').find(l => l.trim().length > 5 && l.trim().length < 150);
        if (firstLine) return firstLine.trim();
    }
    return '';
}

function _detectProductType(text, url, description) {
    const combined = `${text} ${url} ${description}`.toLowerCase();

    // SaaS / Software
    if (/saas|software|plataforma|dashboard|painel|sistema|app|ferramenta digital|automação/i.test(combined)) {
        return 'SaaS';
    }
    // Infoproduto
    if (/curso|ebook|e-book|mentoria|treinamento|método|programa|masterclass|aula|workshop|módulo/i.test(combined)) {
        return 'Infoproduto';
    }
    // Serviço
    if (/consultoria|serviço|agência|assessoria|atendimento|suporte|gestão/i.test(combined)) {
        return 'Serviço';
    }
    // Produto físico
    if (/entrega|frete|caixa|embalagem|produto físico|envio|unidades|estoque|kg|gramas/i.test(combined)) {
        return 'Produto físico';
    }

    return 'indefinido';
}

function _extractMainPromise(description, cleanText) {
    // Procurar frases de promessa
    const promisePatterns = [
        /(?:aprenda|descubra|transforme|conquiste|domine|alcance|desbloqueie|garanta)[^.!?]{10,120}[.!?]/i,
        /(?:o método|a forma|o segredo|a chave|o caminho|a solução)[^.!?]{10,120}[.!?]/i,
        /(?:como|por que)[^.!?]{10,100}[.!?]/i
    ];

    const combined = `${description} ${cleanText}`;
    for (const pattern of promisePatterns) {
        const match = combined.match(pattern);
        if (match) return match[0].trim().substring(0, 200);
    }

    // Fallback: usar descrição truncada
    if (description && description.length > 10) {
        return description.substring(0, 200);
    }

    return '';
}

function _detectTargetAudience(cleanText, description) {
    const combined = `${cleanText} ${description}`.toLowerCase();

    const audiencePatterns = [
        { pattern: /empreendedor|dono de negócio|empresário/i, audience: 'Empreendedores' },
        { pattern: /iniciante|começando|zero|do zero/i, audience: 'Iniciantes' },
        { pattern: /profissional|avançado|expert/i, audience: 'Profissionais' },
        { pattern: /mulher|feminino|mãe/i, audience: 'Público feminino' },
        { pattern: /homem|masculino/i, audience: 'Público masculino' },
        { pattern: /empresa|corporativo|b2b/i, audience: 'Empresas (B2B)' },
        { pattern: /estudante|universitário|aluno/i, audience: 'Estudantes' },
        { pattern: /freelancer|autônomo/i, audience: 'Freelancers/Autônomos' },
        { pattern: /afiliado|marketing digital/i, audience: 'Afiliados/Marketing Digital' }
    ];

    const detected = [];
    for (const { pattern, audience } of audiencePatterns) {
        if (pattern.test(combined)) {
            detected.push(audience);
        }
    }

    return detected.length > 0 ? detected.join(', ') : '';
}

function _extractPriceFromText(text) {
    if (!text) return '';
    const priceMatch = text.match(/R\$\s*[\d.,]+/i);
    return priceMatch ? priceMatch[0] : '';
}

function _detectCategory(cleanText, url, title) {
    const combined = `${cleanText} ${url} ${title}`.toLowerCase();

    const categories = [
        { pattern: /saúde|fitness|emagrecimento|dieta|nutri/i, cat: 'Saúde e Bem-estar' },
        { pattern: /dinheiro|renda|ganhar|faturar|lucro|investimento/i, cat: 'Finanças/Renda' },
        { pattern: /relacionamento|namoro|casamento|amor/i, cat: 'Relacionamentos' },
        { pattern: /marketing|tráfego|vendas|leads|funil/i, cat: 'Marketing Digital' },
        { pattern: /tecnologia|software|programação|código|dev/i, cat: 'Tecnologia' },
        { pattern: /beleza|estética|cabelo|pele|cosmétic/i, cat: 'Beleza e Estética' },
        { pattern: /educação|ensino|aprendizado|idioma/i, cat: 'Educação' },
        { pattern: /alimentação|receita|culinária|gastronomia/i, cat: 'Alimentação' }
    ];

    for (const { pattern, cat } of categories) {
        if (pattern.test(combined)) return cat;
    }

    return '';
}

function _detectPlatform(url) {
    if (!url) return '';
    const urlLower = url.toLowerCase();

    if (urlLower.includes('hotmart')) return 'Hotmart';
    if (urlLower.includes('eduzz')) return 'Eduzz';
    if (urlLower.includes('monetizze')) return 'Monetizze';
    if (urlLower.includes('kiwify')) return 'Kiwify';
    if (urlLower.includes('shopify')) return 'Shopify';
    if (urlLower.includes('nuvemshop')) return 'Nuvemshop';
    if (urlLower.includes('mercadolivre') || urlLower.includes('mercadolibre')) return 'Mercado Livre';
    if (urlLower.includes('braip')) return 'Braip';
    if (urlLower.includes('perfectpay')) return 'PerfectPay';
    if (urlLower.includes('greenn')) return 'Greenn';

    return '';
}

function _calculateConfidence(identity) {
    let score = 0;
    if (identity.productName) score += 0.25;
    if (identity.productType !== 'indefinido') score += 0.20;
    if (identity.mainPromise) score += 0.20;
    if (identity.targetAudience) score += 0.15;
    if (identity.price) score += 0.20;
    return Math.round(score * 100) / 100; // 0.00 a 1.00
}


// ═══════════════════════════════════════════════════════════════════
// 🔹 2. FIXAÇÃO — CONTEXT LOCK BLOCK
// ═══════════════════════════════════════════════════════════════════

/**
 * Monta o bloco de identidade fixa do produto para injetar no prompt.
 * @param {Object} contextIdentity - Resultado de extractContextIdentity()
 * @returns {string} Bloco de texto para o system prompt
 */
function buildContextLockBlock(contextIdentity) {
    try {
        if (!contextIdentity || contextIdentity.confidence === 0) {
            return ''; // Sem dados suficientes — não travar contexto
        }

        return `
# 🔒 CONTEXT LOCK (IDENTIDADE FIXA)

Produto: ${contextIdentity.productName || 'Não identificado'}
Tipo: ${contextIdentity.productType || 'Indefinido'}
Promessa: ${contextIdentity.mainPromise || 'Não identificada'}
Público: ${contextIdentity.targetAudience || 'Não identificado'}
${contextIdentity.price ? `Preço: ${contextIdentity.price}` : ''}
${contextIdentity.category ? `Categoria: ${contextIdentity.category}` : ''}
${contextIdentity.platform ? `Plataforma: ${contextIdentity.platform}` : ''}
Confiança: ${Math.round(contextIdentity.confidence * 100)}%

REGRAS:
- Este chat está vendendo EXCLUSIVAMENTE este produto
- Nunca mude o tipo de produto
- Nunca misture com outro contexto
- Nunca contradiga essa identidade
- Se o usuário confundir, corrija com clareza
- Se faltar informação, diga que vai verificar — NUNCA invente`;

    } catch (err) {
        console.warn('⚠️ [CONTEXT-LOCK] Erro ao montar bloco (fallback vazio):', err.message);
        return '';
    }
}


// ═══════════════════════════════════════════════════════════════════
// 🔹 3. ESTADO DO USUÁRIO (USER STATE ENGINE)
// ═══════════════════════════════════════════════════════════════════

/**
 * Detecta o estado do usuário com base na mensagem.
 * @param {string} message - Mensagem do usuário
 * @returns {string} Estado: buy | price | hesitation | customer | churn | support | neutral
 */
function detectUserState(message) {
    try {
        if (!message) return 'neutral';

        const text = message.toLowerCase().trim();

        // Pós-compra / Cliente
        if (/já comprei|já paguei|já sou (cliente|aluno|membro)|fiz (o |a )?pagamento|já adquiri|meu acesso/i.test(text)) {
            return 'customer';
        }

        // Cancelamento / Churn
        if (/cancelar|cancela|reembolso|estorno|devolver|desistir|quero meu dinheiro/i.test(text)) {
            return 'churn';
        }

        // Intenção de compra
        if (/quero comprar|vou comprar|como compro|onde compro|pode me vender|quero adquirir|quero garantir|vou pegar|vou fechar|fecha|bora|quero esse|me manda o link/i.test(text)) {
            return 'buy';
        }

        // Consulta de preço
        if (/quanto custa|qual o preço|qual o valor|preço|valor|investimento|quanto é|quanto sai|sai por quanto/i.test(text)) {
            return 'price';
        }

        // Hesitação
        if (/não quero|vou pensar|depois vejo|não sei se|será que vale|tenho dúvida|não tenho certeza|achei caro|tá caro|muito caro|não tenho dinheiro|tá apertado/i.test(text)) {
            return 'hesitation';
        }

        // Suporte
        if (/não funciona|problema|erro|bug|não consigo|ajuda|suporte|como faço|não deu certo|não carrega/i.test(text)) {
            return 'support';
        }

        return 'neutral';

    } catch (err) {
        console.warn('⚠️ [CONTEXT-LOCK] Erro na detecção de estado (fallback neutral):', err.message);
        return 'neutral';
    }
}


// ═══════════════════════════════════════════════════════════════════
// 🔹 4. BLOCO DE CONTEXTO DINÂMICO (USER STATE BLOCK)
// ═══════════════════════════════════════════════════════════════════

/**
 * Monta o bloco de estado do usuário para injetar no prompt.
 * @param {string} userState - Resultado de detectUserState()
 * @returns {string} Bloco de texto para o system prompt
 */
function buildContextStateBlock(userState) {
    try {
        const stateInstructions = {
            buy: `O usuário quer COMPRAR. Responda com CTA direto e link de checkout. Não explique mais — FECHE.`,
            price: `O usuário quer saber o PREÇO. Responda o valor, mas contextualize o investimento. Nunca responda seco.`,
            hesitation: `O usuário está HESITANDO. Reduza risco: mencione garantia, resultado, prova social. NÃO pressione.`,
            customer: `O usuário JÁ É CLIENTE. NÃO tente vender. Ajude com acesso, suporte ou dúvidas. Seja prestativo.`,
            churn: `O usuário quer CANCELAR. Ouça, entenda o motivo, ofereça solução se possível. NÃO force retenção agressiva.`,
            support: `O usuário precisa de SUPORTE. Ajude a resolver o problema. NÃO tente vender nada agora.`,
            neutral: `O usuário está em modo NEUTRO. Entenda a intenção antes de agir. Faça perguntas se necessário.`
        };

        return `
# 🧠 ESTADO DO USUÁRIO

Estado atual: ${userState}

INSTRUÇÃO: ${stateInstructions[userState] || stateInstructions.neutral}

REGRAS DE ESTADO:
- Adapte a resposta ao estado detectado
- Nunca tratar cliente como lead
- Nunca tentar vender para quem já comprou
- Se for cliente → ajudar
- Se for dúvida → explicar
- Se for compra → CTA direto
- Se for hesitação → reduzir risco
- Se for suporte → resolver problema`;

    } catch (err) {
        console.warn('⚠️ [CONTEXT-LOCK] Erro ao montar bloco de estado (fallback vazio):', err.message);
        return '';
    }
}


// ═══════════════════════════════════════════════════════════════════
// 🔹 5. HIERARQUIA DE CONTEXTO
// ═══════════════════════════════════════════════════════════════════

/**
 * Retorna o bloco de hierarquia de prioridades de contexto.
 * @returns {string}
 */
function buildContextHierarchyBlock() {
    return `
# 🧠 PRIORIDADE DE CONTEXTO

1. CONTEXT LOCK (identidade do produto) — NUNCA contradizer
2. AUTO-INSTRUCTIONS (instruções geradas por IA)
3. SCRAPED DATA (dados extraídos da página)
4. USER MESSAGE (mensagem do usuário)

Nunca inverter essa ordem. Se houver conflito, a prioridade superior SEMPRE vence.`;
}


// ═══════════════════════════════════════════════════════════════════
// 🔹 6. ANTI-CONTRADIÇÃO
// ═══════════════════════════════════════════════════════════════════

/**
 * Retorna o bloco de regras anti-contradição.
 * @returns {string}
 */
function buildAntiContradictionBlock() {
    return `
# 🚫 ANTI-CONTRADIÇÃO

- Nunca contradizer respostas anteriores
- Nunca mudar o que já foi definido sobre o produto
- Se faltar informação: dizer claramente que vai verificar
- Nunca inventar detalhes, funcionalidades ou preços
- Se o usuário citar algo que não existe no contexto: corrigir com educação
- Manter 100% de consistência em toda a conversa`;
}


// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    extractContextIdentity,
    detectUserState,
    buildContextLockBlock,
    buildContextStateBlock,
    buildContextHierarchyBlock,
    buildAntiContradictionBlock
};
