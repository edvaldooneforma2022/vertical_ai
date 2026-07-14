/**
 * 🧠 DECISION CORE V10.1 — CLASSIFICAÇÃO INTELIGENTE DE INTENÇÃO
 * 
 * SUBSTITUI o V9 que tinha regex fraco (ex: "link" = compra).
 * 
 * Categorias de intenção:
 *   - buy       → quer comprar/pagar (ÚNICO que recebe checkout)
 *   - info      → quer saber mais, como funciona
 *   - objection → não gostou, confuso, caro
 *   - human     → quer falar com humano/WhatsApp
 *   - post_sale → já comprou, suporte
 *   - checkout_issue → questiona o link enviado
 *   - neutral   → saudação, "sim", "ok" (segue fluxo natural)
 * 
 * REGRA DE OURO: checkout SÓ aparece quando intent === 'buy'
 * 
 * Feature flag: FEATURE_DECISION_CORE (mantém compatibilidade)
 * @version 10.1.0
 */

function normalize(text = '') {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^\w\s]/gi, ''); // remove pontuação
}

/**
 * Detecta intenção do usuário com classificação granular
 * ORDEM IMPORTA: mais específico primeiro → mais genérico depois
 * @param {string} message - Mensagem do usuário
 * @returns {string} - Intenção detectada
 */
function detectIntent(message) {
  const msg = normalize(message);

  // ═══════════════════════════════════════════
  // 1. CHECKOUT ISSUE — usuário questiona o link (ANTES de buy para não confundir)
  // ═══════════════════════════════════════════
  if (/(esse link nao e|link nao e de|link errado|link nao funciona|nao e de pagamento|link incorreto|nao consigo pagar|pagina nao abre)/.test(msg)) {
    return 'checkout_issue';
  }

  // ═══════════════════════════════════════════
  // 2. HUMAN — quer falar com pessoa real (ANTES de post_sale)
  // ═══════════════════════════════════════════
  if (/(falar com alguem|falar com uma pessoa|atendente|humano|pessoa real|quero falar|whatsapp|zap|suporte humano|contato|telefone|falar com voce|falar pessoalmente)/.test(msg)) {
    return 'human';
  }

  // ═══════════════════════════════════════════
  // 3. OBJECTION — objeções, dúvidas negativas, confusão
  // ═══════════════════════════════════════════
  if (/(nao gostei|nao curti|nao quero|nao entendi|confuso|ta confuso|complicado|dificil|caro|muito caro|nao vale|nao sei se|nao me convenceu|achei ruim|horrivel|fraco|nao funciona pra mim|ta errado|nao concordo|nao acredito|golpe|fraude|enganacao|furada)/.test(msg)) {
    return 'objection';
  }

  // ═══════════════════════════════════════════
  // 4. POST-SALE — já comprou (ANTES de buy para "já paguei" não virar buy)
  // ═══════════════════════════════════════════
  if (/(ja comprei|ja paguei|ja pago|ja adquiri|ja assinei|ja tenho|nao recebi|cadê meu acesso|meu login|e agora|suporte|acesso liberado|email de confirmacao|chave de acesso)/.test(msg)) {
    return 'post_sale';
  }

  // ═══════════════════════════════════════════
  // 5. BUY — intenção clara de compra
  // Removido "link" genérico — agora só aceita expressões inequívocas
  // ═══════════════════════════════════════════
  if (/(quero comprar|quero pagar|quero adquirir|quero assinar|quero contratar|quero garantir|como compro|onde compro|como faco pra comprar|me manda o link de compra|link de pagamento|link de checkout|quero o produto|vou levar|bora fechar|fechar negocio|quero ativar|ativar agora|finalizar compra|pagar agora|quero pagar agora|fazer o pagamento)/.test(msg)) {
    return 'buy';
  }

  // ═══════════════════════════════════════════
  // 6. EXPLAIN — dúvida educativa, pedido de explicação
  // ═══════════════════════════════════════════
  if (/(como funciona|explica melhor|me explica|pode me explicar|explicar melhor|explicar|o que e isso|o que e|como que funciona)/.test(msg)) {
    return 'explain';
  }

  // ═══════════════════════════════════════════
  // 7. INFO — quer informação, contexto ou detalhes complementares
  // ═══════════════════════════════════════════
  if (/(informacoes|informacao|serve pra mim|detalhe|detalha|funcionalidade|o que vem|o que inclui|o que tem|pra quem serve|qual o diferencial|vi seu anuncio|o que voce vende)/.test(msg)) {
    return 'info';
  }

  // ═══════════════════════════════════════════
  // 8. INTEREST — interesse leve, quer mais detalhes (não buy)
  // ═══════════════════════════════════════════
  if (/(interessante|gostei|legal|bacana|faz sentido|quero saber mais|me conta mais|tem garantia|tem bonus|prova social|depoimento|resultado|quanto custa|qual o preco|qual valor|preco)/.test(msg)) {
    return 'interest';
  }

  // ═══════════════════════════════════════════
  // 8. STRESS — usuário frustrado/atacando
  // ═══════════════════════════════════════════
  if (/(voce esta confusa|nao sabe responder|burra|idiota|incompetente|inutil|voce e um robo|responde direito|que porcaria|ridiculo)/.test(msg)) {
    return 'stress';
  }

  // ═══════════════════════════════════════════
  // 9. NEUTRAL — tudo que não se encaixa: saudações, "sim", "ok" etc
  // ═══════════════════════════════════════════
  return 'neutral';
}

/**
 * Verifica se a intenção deve receber checkout link
 * @param {string} intent
 * @returns {boolean}
 */
function shouldIncludeCheckout(intent) {
  return intent === 'buy';
}

/**
 * Verifica se a intenção deve BLOQUEAR checkout (remover da resposta)
 * @param {string} intent
 * @returns {boolean}
 */
function shouldBlockCheckout(intent) {
  return ['info', 'objection', 'human', 'stress', 'neutral'].includes(intent);
}

/**
 * Constrói a decisão de override (mantém interface V9 para compatibilidade)
 * @param {string} message - Mensagem do usuário
 * @returns {Object} - { intent, shouldOverride }
 */
function buildDecision(message) {
  const intent = detectIntent(message);

  return {
    intent,
    shouldOverride: (intent === 'buy' || intent === 'post_sale' || intent === 'checkout_issue')
  };
}

module.exports = { buildDecision, detectIntent, shouldIncludeCheckout, shouldBlockCheckout };
