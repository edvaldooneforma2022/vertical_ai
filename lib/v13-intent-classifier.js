/**
 * 🧩 V13 — INTENT CLASSIFIER (DETERMINÍSTICO)
 * 
 * Classificador de intenção 100% regex/regras.
 * ZERO IA. Previsível. Testável. Determinístico.
 * 
 * Retorna: READY_TO_BUY | INTEREST | DOUBT | OBJECTION | SUPPORT | GREETING | GENERIC
 * 
 * REGRA: A ordem dos checks é PRIORIDADE.
 * "quero entender" → DOUBT (não READY_TO_BUY)
 * "quero comprar" → READY_TO_BUY
 * "quero falar com alguém" → SUPPORT
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════
// PADRÕES DE INTENÇÃO (regex com prioridade)
// ═══════════════════════════════════════════════════════════════════

// NEGAÇÕES — detectadas ANTES para desambiguar
const NEGATION_PATTERNS = [
    /\b(não\s+quero|nao\s+quero|não\s+vou|nao\s+vou|não\s+preciso|nao\s+preciso)\b/i,
    /\b(não\s+tenho\s+interesse|nao\s+tenho\s+interesse)\b/i,
    /\b(desisto|cancelar|cancela|sair|tchau|até\s+mais)\b/i
];

// DÚVIDA — tem prioridade sobre INTEREST para evitar falso positivo
// "quero entender" → DOUBT, não READY_TO_BUY
const DOUBT_PATTERNS = [
    /\b(como\s+funciona|como\s+é|o\s+que\s+é|o\s+que\s+faz)\b/i,
    /\b(me\s+explica|pode\s+explicar|explica\s+melhor|explicar)\b/i,
    /\b(quero\s+entender|quero\s+saber\s+mais|quero\s+saber\s+como)\b/i,
    /\b(pra\s+que\s+serve|para\s+que\s+serve|qual\s+a\s+diferença)\b/i,
    /\b(como\s+usar|como\s+começo|como\s+começar|como\s+faz)\b/i,
    /\b(dúvida|pergunta|entender\s+melhor)\b/i,
    /\b(o\s+que\s+inclui|o\s+que\s+vem|tem\s+suporte|tem\s+garantia)\b/i,
    /\b(funciona\s+pra|serve\s+pra|é\s+bom\s+pra|é\s+indicado)\b/i
];

// READY_TO_BUY — intenção de compra clara e direta
const BUY_PATTERNS = [
    /\b(quero\s+comprar|vou\s+comprar|quero\s+adquirir|quero\s+assinar)\b/i,
    /\b(comprar\s+agora|fechar\s+agora|fechar\s+negócio|fechar\s+negocio)\b/i,
    /\b(como\s+compro|como\s+pago|como\s+faço\s+pra\s+comprar)\b/i,
    /\b(quero\s+pagar|vou\s+pagar|pode\s+mandar\s+o\s+link)\b/i,
    /\b(link\s+de\s+pagamento|link\s+de\s+compra|link\s+pra\s+comprar)\b/i,
    /\b(manda\s+o\s+link|me\s+manda|envia\s+o\s+link|passa\s+o\s+link)\b/i,
    /\b(quero\s+esse|quero\s+o\s+acesso|quero\s+começar|pode\s+enviar)\b/i,
    /\b(vou\s+levar|vou\s+adquirir|vou\s+assinar|quero\s+contratar)\b/i,
    /\b(fechado|tô\s+dentro|to\s+dentro|me\s+inscreve|inscrever)\b/i,
    /\b(aceito|vamos\s+lá|bora|quero\s+já|pra\s+ontem)\b/i
];

// INTEREST — interesse mas sem decisão de compra ainda
const INTEREST_PATTERNS = [
    /\b(preço|preco|valor|quanto\s+custa|quanto\s+é|quanto\s+e)\b/i,
    /\b(tem\s+desconto|promoção|promocao|oferta|cupom)\b/i,
    /\b(parcela|parcelar|parcelamento|à\s+vista|a\s+vista)\b/i,
    /\b(pix|boleto|cartão|cartao|pagamento)\b/i,
    /\b(plano|planos|mensalidade|anual|mensal)\b/i,
    /\b(investimento|condição|condicao|condições|condicoes)\b/i,
    /\b(teste\s+grátis|teste\s+gratis|trial|período\s+de\s+teste)\b/i,
    /\b(interessado|me\s+interessa|achei\s+interessante|gostei)\b/i,
    /\b(quero\s+ver|quero\s+conhecer|conta\s+mais|mais\s+detalhes)\b/i,
    /\b(mais\s+barato|mais\s+acessível|mais\s+acessivel|mais\s+em\s+conta|opção\s+menor|opcao\s+menor)\b/i,
    /\b(tem\s+outro|outra\s+opção|outra\s+opcao|versão\s+mais|versao\s+mais)\b/i
];

// OBJECTION — resistência, dúvida sobre valor
const OBJECTION_PATTERNS = [
    /\b(caro|muito\s+caro|é\s+caro|achei\s+caro|tá\s+caro|ta\s+caro)\b/i,
    /\b(não\s+confio|nao\s+confio|fraude|golpe|piramide|pirâmide)\b/i,
    /\b(não\s+vale|nao\s+vale|não\s+funciona|nao\s+funciona)\b/i,
    /\b(não\s+sei\s+se|nao\s+sei\s+se|será\s+que|sera\s+que)\b/i,
    /\b(vi\s+reclamação|reclamação|reclame\s+aqui|avaliação\s+negativa)\b/i,
    /\b(pensar|vou\s+pensar|preciso\s+pensar|deixa\s+eu\s+pensar)\b/i,
    /\b(concorrente|outro\s+produto|alternativa|comparar)\b/i,
    /\b(medo|receio|inseguro|insegurança)\b/i,
    /\b(presta|isso\s+presta|funciona\s+mesmo|é\s+bom\s+mesmo|e\s+bom\s+mesmo)\b/i,
    /\b(confiável|confiavel|seguro|é\s+seguro|e\s+seguro|furada)\b/i
];

// SUPPORT — quer falar com humano/suporte
const SUPPORT_PATTERNS = [
    /\b(falar\s+com\s+(alguém|alguem|humano|atendente|pessoa|vendedor))\b/i,
    /\b(atendimento\s+(humano|personalizado|pessoal))\b/i,
    /\b(quero\s+suporte|preciso\s+de\s+suporte|falar\s+com\s+suporte)\b/i,
    /\b(whatsapp|whats|wpp|zap|zapzap)\b/i,
    /\b(ligar|telefone|ligue\s+pra\s+mim|me\s+ligue|contato\s+humano)\b/i,
    /\b(não\s+quero\s+robô|nao\s+quero\s+robo|quero\s+pessoa\s+real)\b/i
];

// GREETING — saudação simples
const GREETING_PATTERNS = [
    /^(oi|olá|ola|hey|ei|eai|e\s+aí|e\s+ai|opa|fala)\b/i,
    /^(bom\s+dia|boa\s+tarde|boa\s+noite)\b/i,
    /^(tudo\s+bem|tudo\s+certo|como\s+vai|beleza)\b/i,
    /^(oi\s+tudo\s+bem|olá\s+tudo\s+bem|oi\s+td\s+bem)\b/i
];

// ═══════════════════════════════════════════════════════════════════
// CLASSIFICADOR PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

/**
 * Classifica a intenção do usuário de forma determinística
 * @param {string} message - Mensagem do usuário
 * @returns {{ intent: string, confidence: number, matchedPattern: string }}
 */
function classifyIntent(message) {
    if (!message || typeof message !== 'string') {
        return { intent: 'GENERIC', confidence: 0, matchedPattern: 'empty' };
    }

    const msg = message.toLowerCase().trim();

    // Mensagem muito curta (< 3 chars) → GENERIC
    if (msg.length < 3) {
        return { intent: 'GENERIC', confidence: 0.3, matchedPattern: 'too_short' };
    }

    // 1️⃣ NEGAÇÃO (prioridade máxima — rejeição clara)
    for (const pattern of NEGATION_PATTERNS) {
        if (pattern.test(msg)) {
            return { intent: 'OBJECTION', confidence: 0.9, matchedPattern: pattern.toString() };
        }
    }

    // 2️⃣ GREETING (detectar saudação antes de tudo)
    // Só se a mensagem for curta (< 30 chars) — evita "bom dia, quero comprar"
    if (msg.length < 30) {
        for (const pattern of GREETING_PATTERNS) {
            if (pattern.test(msg)) {
                return { intent: 'GREETING', confidence: 0.95, matchedPattern: pattern.toString() };
            }
        }
    }

    // 3️⃣ SUPPORT (quer humano/suporte — ANTES de DOUBT para não confundir)
    for (const pattern of SUPPORT_PATTERNS) {
        if (pattern.test(msg)) {
            return { intent: 'SUPPORT', confidence: 0.9, matchedPattern: pattern.toString() };
        }
    }

    // 4️⃣ DÚVIDA (ANTES de BUY — "quero entender" ≠ "quero comprar")
    for (const pattern of DOUBT_PATTERNS) {
        if (pattern.test(msg)) {
            // Mas se também tem padrão de compra, verificar qual é mais forte
            const hasBuyPattern = BUY_PATTERNS.some(bp => bp.test(msg));
            if (hasBuyPattern) {
                // Mensagem mista: "quero saber mais e comprar" → BUY vence
                return { intent: 'READY_TO_BUY', confidence: 0.8, matchedPattern: 'mixed_doubt_buy' };
            }
            return { intent: 'DOUBT', confidence: 0.85, matchedPattern: pattern.toString() };
        }
    }

    // 5️⃣ READY_TO_BUY (intenção de compra clara)
    for (const pattern of BUY_PATTERNS) {
        if (pattern.test(msg)) {
            return { intent: 'READY_TO_BUY', confidence: 0.95, matchedPattern: pattern.toString() };
        }
    }

    // 6️⃣ INTEREST (interesse sem decisão)
    for (const pattern of INTEREST_PATTERNS) {
        if (pattern.test(msg)) {
            return { intent: 'INTEREST', confidence: 0.85, matchedPattern: pattern.toString() };
        }
    }

    // 7️⃣ OBJECTION (resistência)
    for (const pattern of OBJECTION_PATTERNS) {
        if (pattern.test(msg)) {
            return { intent: 'OBJECTION', confidence: 0.85, matchedPattern: pattern.toString() };
        }
    }

    // 8️⃣ GENERIC (fallback)
    return { intent: 'GENERIC', confidence: 0.3, matchedPattern: 'fallback' };
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    classifyIntent,
    // Exportar para testes
    _patterns: {
        NEGATION_PATTERNS,
        DOUBT_PATTERNS,
        BUY_PATTERNS,
        INTEREST_PATTERNS,
        OBJECTION_PATTERNS,
        SUPPORT_PATTERNS,
        GREETING_PATTERNS
    }
};
