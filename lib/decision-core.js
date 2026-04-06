/**
 * 🧠 DECISION CORE V9 — SAAS SAFE
 * 
 * Camada determinística de decisão para override final de intenções críticas.
 * REFORÇA a resposta da IA em vez de substituí-la.
 */

function normalize(text = '') {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^\w\s]/gi, ''); // remove pontuação
}

/**
 * Detecta intenção do usuário com base em palavras-chave
 * @param {string} message - Mensagem do usuário
 * @returns {string} - Intenção detectada (buy, post_sale, explain, objection, curiosity)
 */
function detectIntent(message) {
  const msg = normalize(message);

  // Intenção de compra: "quero comprar", "link de pagamento", etc.
  if (/comprar|compra|quero comprar|link|pagamento|checkout|adquirir|assinar|pix|boleto|cartao/.test(msg)) {
    return 'buy';
  }

  // Explicação: "como funciona", "o que é", etc. (Prioridade sobre suporte genérico)
  if (/como funciona|o que e|explicar|explica/.test(msg)) {
    return 'explain';
  }
  
  // Pós-venda: "já comprei", "não recebi", "preciso de suporte", etc.
  if (/(ja|estou|ainda)\s*(comprei|pagou|paguei|pago|recebi)|e agora|suporte|acesso|login|entrar/.test(msg)) {
    return 'post_sale';
  }
  
  if (/garantia|bonus|prova|resultado|depoimento|seguranca/.test(msg)) return 'objection';
  if (/garantia|bonus|prova|resultado|depoimento|seguranca/.test(msg)) return 'objection';

  return 'curiosity';
}

/**
 * Constrói a decisão de override
 * @param {string} message - Mensagem do usuário
 * @returns {Object} - { intent, shouldOverride }
 */
function buildDecision(message) {
  const intent = detectIntent(message);

  return {
    intent,
    shouldOverride: (intent === 'buy' || intent === 'post_sale')
  };
}

module.exports = { buildDecision };
