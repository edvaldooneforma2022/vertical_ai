/**
 * 🧠 V15 — CONTEXT ENFORCEMENT LAYER (SAFE)
 * 
 * Middleware determinístico de "última milha" que intercepta a resposta final
 * da IA para garantir entrega obrigatória de dados de conversão.
 * 
 * REGRAS:
 * - V15 NÃO decide nada (isso é do V16)
 * - V15 apenas corrige e reforça a resposta final
 * - V15 atua DEPOIS do Humanizer e ANTES do pós-processador final
 * - Se falhar, resposta original prevalece (fallback total)
 * 
 * @version 1.0.0
 * @requires Feature Flag: FEATURE_V15_CONTEXT_ENFORCEMENT
 */

/**
 * Normaliza texto para comparação
 * @param {string} text
 * @returns {string}
 */
function normalize(text = '') {
    return text.toLowerCase().trim();
}

/**
 * Verifica se o texto contém algum dos padrões
 * @param {string} text
 * @param {string[]} patterns
 * @returns {boolean}
 */
function containsAny(text, patterns = []) {
    const t = normalize(text);
    return patterns.some(p => t.includes(p));
}

// ═══════════════════════════════════════════════════════════════════
// 🚫 ANTI-GENÉRICO FORTE
// Detecta respostas genéricas / fracas / sem conteúdo útil
// ═══════════════════════════════════════════════════════════════════

/**
 * Detecta se a resposta é genérica / sem valor de conversão
 * @param {string} text
 * @returns {boolean}
 */
function isGenericResponse(text) {
    const genericPatterns = [
        'como posso ajudar',
        'posso te ajudar',
        'ótima pergunta',
        'otima pergunta',
        'me conte mais',
        'me fale mais',
        'deixe-me explicar',
        'fico feliz em ajudar',
        'claro que posso',
        'com certeza posso',
        'é uma excelente pergunta',
        'obrigado pelo interesse',
        'obrigado pelo seu interesse',
        'posso te mostrar como funciona primeiro',
        'aqui estão as informações que você precisa'
    ];

    const t = normalize(text);

    // Padrão 1: resposta contém frase genérica
    if (genericPatterns.some(p => t.includes(p))) return true;

    // Padrão 2: resposta muito curta e sem link
    if (t.length < 30 && !t.includes('http')) return true;

    // Padrão 3: resposta é só saudação
    if (/^(olá|oi|hey|bom dia|boa tarde|boa noite)[!.,]?\s*$/i.test(t)) return true;

    return false;
}

// ═══════════════════════════════════════════════════════════════════
// 🎯 DETECTOR DE INTENÇÃO ALTA
// Classifica a mensagem do usuário em: buy | support | faq | none
// ═══════════════════════════════════════════════════════════════════

/**
 * Detecta intenção de alta prioridade na mensagem do usuário
 * @param {string} message
 * @returns {'buy'|'support'|'faq'|'none'}
 */
function detectHighIntent(message) {
    const msg = normalize(message);

    // ═══ FIX-07 [V15-INFORMATIONAL-GUARD] — Contextos informativos NÃO são buy ═══
    // Perguntas como "Qual o valor do condomínio?" ou "Quanto tempo demora?"
    // contêm palavras que casam com buyPatterns (valor, quanto), mas são informativas.
    // Feature flag: FEATURE_V15_INFORMATIONAL_GUARD (default: true)
    const _informationalGuardEnabled = (process.env.FEATURE_V15_INFORMATIONAL_GUARD !== 'false');

    // ─── INTENÇÃO DE FAQ (VERIFICAR PRIMEIRO para evitar falso buy/support) ───
    const faqPatterns = [
        'como funciona', 'o que é', 'o que e',
        'para que serve', 'pra que serve',
        'qual a diferença', 'qual a diferenca',
        'tem garantia', 'prazo', 'entrega',
        'funcionalidade', 'benefício', 'beneficio',
        'depoimento', 'resultado', 'testemunho',
        // FIX-08 [V15-INFORMATIONAL-GUARD] — Termos técnicos/financeiros → FAQ, não support
        'sac', 'tabela price', 'financiamento', 'financiar',
        'fgts', 'taxa de juros', 'juros',
        'escritura', 'registro', 'itbi',
        'documentação', 'documentacao', 'certidão', 'certidao'
    ];
    if (faqPatterns.some(p => msg.includes(p))) return 'faq';

    // ─── INTENÇÃO DE COMPRA ───
    const buyPatterns = [
        'comprar', 'compra', 'quero', 'fechar', 'garantir',
        'como faço', 'como faco',
        'valor', 'preço', 'preco', 'quanto', 'custa',
        'link', 'checkout',
        'acesso', 'começar', 'comecar', 'liberar',
        'adquirir', 'assinar', 'pagamento', 'pagar', 'pago',
        'finalizar', 'inscrição', 'inscricao', 'inscrever',
        'boleto', 'pix', 'cartão', 'cartao', 'parcelar', 'parcela',
        'investimento', 'investir', 'contratar', 'cadastrar',
        'compro', 'onde compro', 'como pago', 'como paga',
        'pode parcelar', 'formas de pagamento', 'aceita',
        'bora fechar', 'vou levar', 'quero esse', 'manda o link',
        'tem link', 'manda o site'
    ];

    // ─── INTENÇÃO DE SUPORTE (ANTES de buy para evitar 'quero' genérico) ───
    const supportPatterns = [
        'atendente', 'suporte', 'falar com', 'humano',
        'pessoa real', 'preciso de ajuda', 'reclamação', 'reclamacao',
        'problema', 'não funciona', 'nao funciona', 'não consigo',
        'nao consigo', 'erro', 'defeito', 'devolver', 'reembolso',
        'cancelar', 'cancelamento'
    ];
    if (supportPatterns.some(p => msg.includes(p))) return 'support';

    // FIX-07: Se a mensagem tem contexto informativo, não classificar como buy
    if (_informationalGuardEnabled) {
        const informationalContext = [
            'condomínio', 'condominio', 'quanto tempo', 'diferença', 'diferenca',
            'renda', 'fgts', 'financiamento', 'entrada mínima', 'entrada minima',
            'custos extras', 'documentos', 'requisitos', 'análise de crédito',
            'analise de credito', 'comprometer', 'demora', 'processo de compra',
            'taxa de juros', 'juros', 'sac', 'price', 'tabela',
            'existe', 'há quanto', 'ha quanto', 'quantas', 'quantos',
            'quais cidades', 'quais bairros', 'onde vocês', 'onde voces',
            'com quem', 'funciona', 'aceita fgts', 'varanda', 'academia',
            'piscina', 'garagem', 'quartos', 'metragem', 'área', 'area',
            'segurança', 'seguranca', 'vista para', 'andar'
        ];
        const isInformational = informationalContext.some(p => msg.includes(p));
        if (isInformational) {
            return 'faq';
        }
    }

    if (buyPatterns.some(p => msg.includes(p))) return 'buy';

    return 'none';
}

// ═══════════════════════════════════════════════════════════════════
// 🔥 MOTOR PRINCIPAL — enforceContext
// Intercepta resposta final e garante entrega de dados de conversão
// ═══════════════════════════════════════════════════════════════════

/**
 * Motor principal do V15 — intercepta e corrige resposta final
 * 
 * @param {Object} params
 * @param {string} params.response - Resposta final da IA
 * @param {string} params.userMessage - Mensagem do usuário
 * @param {Object} params.extractedData - Dados extraídos da página (processedPageData)
 * @returns {string} Resposta corrigida ou original
 */
function enforceContext({ response = '', userMessage = '', extractedData = {} }) {
    // Fallback seguro: se não há resposta, retornar como está
    if (!response || !userMessage) return response;

    const intent = detectHighIntent(userMessage);
    const generic = isGenericResponse(response);

    // Extrair dados disponíveis
    const checkoutLink = extractedData.checkoutLink || null;
    const whatsapp = extractedData.whatsapp || extractedData.whatsappLink ||
        (extractedData.contatos && extractedData.contatos.whatsapp && extractedData.contatos.whatsapp[0]) || null;
    const productName = extractedData.title || '';

    let enforced = response;
    let enforcements = [];

    // ═══ REGRA 1: Resposta genérica + intent buy + checkout disponível ═══
    if (generic && intent === 'buy' && checkoutLink) {
        enforced = productName
            ? `${productName} está disponível para você! Clique abaixo para garantir 👇\n\n━━━━━━━━━━━━━━━━━━━\n🚀 FINALIZAR COMPRA\n${checkoutLink}\n━━━━━━━━━━━━━━━━━━━`
            : `Clique abaixo para finalizar sua compra 👇\n\n━━━━━━━━━━━━━━━━━━━\n🚀 FINALIZAR COMPRA\n${checkoutLink}\n━━━━━━━━━━━━━━━━━━━`;
        enforcements.push('GENERIC_BUY_OVERRIDE');
    }

    // ═══ REGRA 2: Resposta genérica + intent support + WhatsApp disponível ═══
    else if (generic && intent === 'support' && whatsapp) {
        const whatsappUrl = whatsapp.startsWith('http') ? whatsapp : `https://wa.me/${whatsapp.replace(/\D/g, '')}`;
        enforced = `Perfeito 👍 vou te conectar com um atendente agora.\n\n📞 Fale direto no WhatsApp:\n${whatsappUrl}\n\nEles vão te ajudar rapidinho 🙌`;
        enforcements.push('GENERIC_SUPPORT_OVERRIDE');
    }

    // ═══ REGRA 3: Intent buy + checkout disponível mas AUSENTE na resposta ═══
    else if (intent === 'buy' && checkoutLink && !response.includes(checkoutLink) && !response.includes('FINALIZAR COMPRA')) {
        enforced += `\n\n━━━━━━━━━━━━━━━━━━━\n🚀 FINALIZAR COMPRA\n${checkoutLink}\n━━━━━━━━━━━━━━━━━━━`;
        enforcements.push('BUY_CHECKOUT_APPEND');
    }

    // ═══ REGRA 4: Intent support + WhatsApp disponível mas AUSENTE na resposta ═══
    else if (intent === 'support' && whatsapp && !response.includes(whatsapp) && !response.includes('wa.me')) {
        const whatsappUrl = whatsapp.startsWith('http') ? whatsapp : `https://wa.me/${whatsapp.replace(/\D/g, '')}`;
        enforced += `\n\n📞 Fale direto no WhatsApp:\n${whatsappUrl}`;
        enforcements.push('SUPPORT_WHATSAPP_APPEND');
    }

    // ═══ LOG DE ENFORCEMENT ═══
    if (enforcements.length > 0) {
        console.log(`[V15-ENFORCEMENT] 🧠 Aplicado: ${enforcements.join(' + ')} | intent=${intent} | generic=${generic} | checkout=${!!checkoutLink} | whatsapp=${!!whatsapp} | product=${productName.substring(0, 30)}`);
    }

    return enforced;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    enforceContext,
    isGenericResponse,
    detectHighIntent,
    normalize,
    containsAny
};
