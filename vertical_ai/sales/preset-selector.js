/**
 * 🎯 PRESET SELECTOR — Link Mágico V8.0
 *
 * Auto-seleção inteligente de preset com base no tipo de link,
 * URL e conteúdo da página scraped.
 *
 * NÃO toca em: instructions, knowledge_base, contexto da IA.
 * APENAS retorna o nome do preset mais adequado.
 *
 * @version 1.0.0
 */

'use strict';

// ─────────────────────────────────────────────────────────────────
// SINAIS DE DETECÇÃO POR CONTEÚDO / URL
// ─────────────────────────────────────────────────────────────────

const URL_SIGNALS = {
  produto_digital: [
    'hotmart.com', 'eduzz.com', 'monetizze.com', 'kiwify.com', 'braip.com',
    'pay.herospark.com', 'perfectpay.com.br', 'lastlink.co'
  ],
  afiliado: [
    '/aff/', '/af/', '/go/', '/rec/', '/refer/', 'affiliate', 'promocao',
    'refid=', 'ref=', 'src=afiliado'
  ],
  ecommerce: [
    'shopify', 'loja.', 'mercadolivre.com', 'americanas.com', 'amazon.com',
    'magazineluiza', 'casasbahia', 'shopee', 'aliexpress', '/produto/', '/cart/'
  ],
  local_business: [
    'maps.google', 'waze.com', 'ifood.com.br', 'apontador.com',
    'tripadvisor', 'booking.com', 'reserva'
  ],
  lead: [
    'pages.', 'lp.', 'landing', '/captura', '/inscricao', '/inscri%C3%A7%C3%A3o',
    'leadlovers', 'activecampaign', 'mailchimp', 'rdstation'
  ]
};

const CONTENT_KEYWORDS = {
  produto_digital: [
    'comprar agora', 'garantir minha vaga', 'acesso imediato', 'bônus exclusivo',
    'oferta por tempo limitado', 'desconto', 'módulo', 'aula', 'certificado',
    'ebook', 'infoproduto', 'curso online', 'mentoria', 'mastermind'
  ],
  afiliado: [
    'link exclusivo', 'oferta especial', 'parceiro', 'indicação', 'comissão',
    'recomendo', 'use meu link'
  ],
  ecommerce: [
    'adicionar ao carrinho', 'finalizar compra', 'frete grátis', 'entrega',
    'estoque', 'produto físico', 'unidade', 'disponível', 'tamanho', 'cor'
  ],
  servico: [
    'agendar', 'orçamento', 'consultoria', 'atendimento', 'contratar',
    'profissional', 'especialista', 'assessoria', 'proposta'
  ],
  local_business: [
    'endereço', 'funcionamento', 'horário', 'localização', 'reserva',
    'mesa', 'salão', 'bairro', 'cidade'
  ],
  lead: [
    'cadastre-se', 'inscreva-se', 'lista de espera', 'newsletter',
    'baixe grátis', 'material gratuito', 'webinar', 'evento gratuito'
  ],
  institucional: [
    'sobre nós', 'nossa empresa', 'nossa história', 'missão', 'visão', 'valores',
    'equipe', 'time', 'parceiros', 'imprensa', 'política'
  ]
};

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function scoreSignals(text, signals) {
  const lower = String(text || '').toLowerCase();
  return signals.reduce((score, signal) => {
    return score + (lower.includes(signal.toLowerCase()) ? 1 : 0);
  }, 0);
}

function detectFromUrl(url = '') {
  const lower = url.toLowerCase();
  for (const [preset, signals] of Object.entries(URL_SIGNALS)) {
    if (signals.some(s => lower.includes(s))) return preset;
  }
  return null;
}

function detectFromContent(content = '') {
  const lower = content.toLowerCase();
  const scores = {};
  for (const [preset, keywords] of Object.entries(CONTENT_KEYWORDS)) {
    scores[preset] = keywords.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0);
  }
  // Retorna o preset com maior score (mínimo 2 matches para ser confiável)
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 2 ? best[0] : null;
}

// ─────────────────────────────────────────────────────────────────
// FUNÇÃO PRINCIPAL
// ─────────────────────────────────────────────────────────────────

/**
 * Seleciona automaticamente o preset mais adequado ao link.
 *
 * @param {object} params
 * @param {string} [params.linkType]    — tipo explícito ('produto', 'afiliado', etc.)
 * @param {string} [params.url]         — URL da página analisada
 * @param {string} [params.content]     — conteúdo textual scraped da página
 * @param {string} [params.title]       — título da página
 * @param {string} [params.description] — descrição/meta da página
 * @returns {string} Chave do preset (ex: 'produto_digital', 'default')
 */
function selectPreset({ linkType = null, url = '', content = '', title = '', description = '' } = {}) {
  try {
    // 1. Tipo explícito passado pelo sistema de links (prioridade máxima)
    const typeMap = {
      produto:    'produto_digital',
      afiliado:   'afiliado',
      servico:    'servico',
      lead:       'lead',
      ecommerce:  'ecommerce',
      local:      'local_business',
      institucional: 'institucional'
    };
    if (linkType && typeMap[linkType]) {
      console.log(`🎯 [PRESET-SELECTOR] Tipo explícito: ${linkType} → ${typeMap[linkType]}`);
      return typeMap[linkType];
    }

    // 2. Detecção por URL
    const byUrl = detectFromUrl(url);
    if (byUrl) {
      console.log(`🎯 [PRESET-SELECTOR] Detectado por URL: ${byUrl}`);
      return byUrl;
    }

    // 3. Detecção por conteúdo (título + descrição + texto)
    const fullText = [title, description, content].join(' ');
    const byContent = detectFromContent(fullText);
    if (byContent) {
      console.log(`🎯 [PRESET-SELECTOR] Detectado por conteúdo: ${byContent}`);
      return byContent;
    }

    // 4. Fallback: padrão inteligente
    console.log('🎯 [PRESET-SELECTOR] Fallback: default');
    return 'default';

  } catch (err) {
    console.warn('⚠️ [PRESET-SELECTOR] Erro na seleção (fallback: default):', err.message || err);
    return 'default';
  }
}

module.exports = selectPreset;
