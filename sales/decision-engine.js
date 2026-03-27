/**
 * 🧠 DECISION ENGINE — Link Mágico V8.0
 *
 * Camada intermediária de decisão inteligente para o modo AUTOMÁTICO.
 * Analisa a mensagem do usuário e retorna uma estratégia de venda.
 *
 * NÃO altera: scraping, KB, sales-layer (F0-F13), generate AI response,
 *             normalize-links, presets, preset-selector.
 *
 * APENAS adiciona: detecção de intenção + decisão estratégica.
 *
 * Se falhar → retorna null → fluxo original inalterado.
 *
 * @version 1.0.0
 */

'use strict';

// ─────────────────────────────────────────────────────────────────
// [FASE 2] DETECÇÃO DE INTENÇÃO REAL
// ─────────────────────────────────────────────────────────────────

/**
 * Mapeamento de padrões de intenção.
 * Cada chave = intenção detectável.
 * Cada valor = array de gatilhos textuais.
 */
const INTENT_PATTERNS = {
  comprar: [
    'quero comprar', 'como pagar', 'como comprar', 'quero adquirir',
    'quero contratar', 'me manda o link', 'me passa o link',
    'link de pagamento', 'link do produto', 'quero agora',
    'como acesso', 'quero começar', 'quero iniciar',
    'onde compro', 'onde pago', 'pode fechar', 'fecha pra mim',
    'vou querer', 'quero sim', 'vamos fechar', 'to dentro',
    'aceito', 'pode mandar', 'manda o pix', 'chave pix',
    'quero garantir', 'garanta minha vaga', 'quero minha vaga'
  ],
  duvida: [
    'funciona', 'é bom', 'e bom', 'serve pra', 'serve para',
    'como funciona', 'o que é', 'o que e', 'pra que serve',
    'para que serve', 'tem resultado', 'dá resultado', 'da resultado',
    'qual a diferença', 'qual a diferenca', 'o que inclui',
    'o que vem', 'tem garantia', 'como é', 'como e',
    'quanto tempo', 'demora quanto', 'preciso de experiência',
    'é difícil', 'e dificil', 'qualquer pessoa', 'iniciante'
  ],
  objecao: [
    'não confio', 'nao confio', 'golpe', 'fraude', 'fake',
    'piramide', 'pirâmide', 'furada', 'enganação', 'enganacao',
    'caro demais', 'muito caro', 'não vale', 'nao vale',
    'não acredito', 'nao acredito', 'tenho medo', 'receio',
    'será que funciona', 'sera que funciona', 'desconfio',
    'já vi isso antes', 'ja vi isso antes', 'promessa',
    'parece bom demais', 'não sei se', 'nao sei se',
    'tem reclamação', 'reclame aqui'
  ],
  sair: [
    'depois vejo', 'vou pensar', 'mais tarde', 'talvez',
    'não agora', 'nao agora', 'depois eu', 'outro dia',
    'vou ver', 'preciso pensar', 'deixa pra lá', 'deixa pra la',
    'não preciso', 'nao preciso', 'obrigado mas', 'tá bom tchau',
    'ta bom tchau', 'até mais', 'ate mais', 'valeu mas',
    'não é pra mim', 'nao e pra mim', 'sem interesse'
  ],
  curioso: [
    'oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite',
    'eae', 'e aí', 'e ai', 'oii', 'opa', 'fala',
    'quero saber', 'me conta', 'pode me ajudar', 'tô curiosa',
    'to curiosa', 'tô curioso', 'to curioso', 'vi o anúncio',
    'vim pelo', 'achei interessante', 'quero entender'
  ]
};

/**
 * Detecta a intenção real do usuário com base na mensagem.
 *
 * @param {string} userMessage — Mensagem do usuário (limpa)
 * @returns {string} — "comprar" | "duvida" | "objecao" | "sair" | "curioso"
 */
function detectIntent(userMessage) {
  try {
    const msg = String(userMessage || '').toLowerCase().trim();
    if (!msg) return 'curioso';

    // Score por intenção (multi-match para maior precisão)
    const scores = {};
    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      scores[intent] = 0;
      for (const pattern of patterns) {
        if (msg.includes(pattern)) {
          scores[intent]++;
        }
      }
    }

    // Encontrar intenção com maior score
    const best = Object.entries(scores)
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1]);

    if (best.length > 0) {
      return best[0][0];
    }

    // Fallback: sem match, classificar como curioso
    return 'curioso';
  } catch (err) {
    console.warn('⚠️ [DECISION-ENGINE] detectIntent erro:', err.message);
    return 'curioso';
  }
}

// ─────────────────────────────────────────────────────────────────
// [FASE 3] REGRA DE DECISÃO (CORE)
// ─────────────────────────────────────────────────────────────────

/**
 * Decide a ação estratégica baseada na intenção + contexto.
 *
 * @param {string} intent         — Intenção detectada
 * @param {string} journeyStage   — Estágio da jornada (descoberta, negociacao, etc.)
 * @param {number} messageCount   — Número de mensagens na conversa
 * @returns {{ action: string, urgency: string }}
 */
function decideAction(intent, journeyStage, messageCount) {
  try {
    const count = Number(messageCount) || 1;

    // Mapeamento direto intenção → ação
    const actionMap = {
      comprar:  { action: 'fechar',           urgency: 'high' },
      objecao:  { action: 'quebrar_objecao',  urgency: 'medium' },
      duvida:   { action: 'provar',           urgency: 'low' },
      sair:     { action: 'reengajar',        urgency: 'medium' },
      curioso:  { action: 'educar',           urgency: 'low' }
    };

    const base = actionMap[intent] || actionMap.curioso;

    // Ajustes contextuais
    // Se está em negociação e tem dúvida, subir urgência
    if (journeyStage === 'negociacao' && intent === 'duvida') {
      base.urgency = 'medium';
    }

    // Se muitas mensagens e ainda curioso, subir para provar
    if (intent === 'curioso' && count >= 4) {
      base.action = 'provar';
      base.urgency = 'medium';
    }

    // Se muitas mensagens e dúvida, migrar para fechar
    if (intent === 'duvida' && count >= 6) {
      base.action = 'fechar';
      base.urgency = 'medium';
    }

    return base;
  } catch (err) {
    console.warn('⚠️ [DECISION-ENGINE] decideAction erro:', err.message);
    return { action: 'educar', urgency: 'low' };
  }
}

// ─────────────────────────────────────────────────────────────────
// [FASE 6] PRIORIDADE DE CHECKOUT / NEXT STEP
// ─────────────────────────────────────────────────────────────────

/**
 * Define o próximo passo ideal com prioridade:
 *   1. CHECKOUT (se ação é fechar e tem link de compra)
 *   2. PÁGINA (link da página original)
 *   3. WHATSAPP (contato direto)
 *   4. PERGUNTA (manter conversa)
 *
 * @param {string} action       — Ação decidida
 * @param {object} extractedData — Dados da página (pageData)
 * @returns {string} — "checkout" | "whatsapp" | "agendar" | "pergunta"
 */
function prioritizeNextStep(action, extractedData) {
  try {
    // Se ação é fechar, priorizar checkout
    if (action === 'fechar') {
      // Verificar se tem URL de checkout disponível
      const url = (extractedData && extractedData.url) || '';
      const hasCheckoutUrl = url && (
        url.includes('hotmart') ||
        url.includes('kiwify') ||
        url.includes('eduzz') ||
        url.includes('pay.') ||
        url.includes('checkout') ||
        url.includes('cart') ||
        url.includes('comprar')
      );

      if (hasCheckoutUrl) return 'checkout';

      // Se tem WhatsApp disponível
      const contatos = extractedData && extractedData.contatos;
      if (contatos && contatos.whatsapp && contatos.whatsapp.length > 0) {
        return 'whatsapp';
      }

      // Tem URL genérica
      if (url) return 'checkout';

      return 'pergunta';
    }

    // Se ação é reengajar, usar pergunta inteligente
    if (action === 'reengajar') return 'pergunta';

    // Se ação é quebrar objeção, provar primeiro
    if (action === 'quebrar_objecao') return 'pergunta';

    // Default: manter conversa
    return 'pergunta';
  } catch (err) {
    return 'pergunta';
  }
}

// ─────────────────────────────────────────────────────────────────
// [FASE 8] CONTEXTO REAL (SEM NOVO SCRAPING)
// ─────────────────────────────────────────────────────────────────

/**
 * Extrai hints contextuais do extractedData (pageData) já existente.
 * NÃO faz scraping. Apenas lê o que já foi extraído.
 *
 * @param {object} extractedData — pageData do server.js
 * @returns {object} — { benefit, price, productName, hasUrl }
 */
function extractContextHints(extractedData) {
  try {
    if (!extractedData || typeof extractedData !== 'object') {
      return { benefit: null, price: null, productName: null, hasUrl: false };
    }

    // Extrair preço já detectado
    const price = (extractedData.price_detected && extractedData.price_detected.length > 0)
      ? extractedData.price_detected[0]
      : null;

    // Extrair nome do produto do título
    const productName = extractedData.title
      ? String(extractedData.title).substring(0, 80)
      : null;

    // Extrair primeiro benefício do resumo (summary ou cleanText)
    let benefit = null;
    const summary = extractedData.summary || extractedData.description || '';
    if (summary) {
      // Pegar primeira frase relevante como benefício
      const sentences = String(summary).split(/[.!?\n]/).filter(s => s.trim().length > 15);
      if (sentences.length > 0) {
        benefit = sentences[0].trim().substring(0, 120);
      }
    }

    return {
      benefit,
      price,
      productName,
      hasUrl: !!(extractedData.url)
    };
  } catch (err) {
    return { benefit: null, price: null, productName: null, hasUrl: false };
  }
}

// ─────────────────────────────────────────────────────────────────
// [FASE 1] FUNÇÃO PRINCIPAL — decideStrategy
// ─────────────────────────────────────────────────────────────────

/**
 * Função principal do Decision Engine.
 * Analisa a mensagem do usuário e retorna uma decisão estratégica completa.
 *
 * SAFE MODE (Fase 9): Se qualquer erro ocorre, retorna null.
 * Quando null, o sales-layer usa o fluxo original sem mudanças.
 *
 * @param {object} params
 * @param {string}  params.userMessage     — Mensagem do usuário
 * @param {string}  params.journeyStage    — Estágio da jornada
 * @param {number}  params.messageCount    — Total de mensagens
 * @param {string}  params.conversationId  — ID da conversa
 * @param {object}  params.extractedData   — pageData com summary, price, etc.
 * @returns {object|null} — Decisão estratégica ou null (fallback)
 */
function decideStrategy({
  userMessage     = '',
  journeyStage    = 'descoberta',
  messageCount    = 1,
  conversationId  = null,
  extractedData   = {}
} = {}) {
  // [FASE 9] SAFE MODE — qualquer erro retorna null (fluxo original intacto)
  try {
    if (!userMessage || typeof userMessage !== 'string') return null;

    const msg = userMessage.trim();
    if (!msg) return null;

    // [FASE 2] Detectar intenção real
    const intent = detectIntent(msg);

    // [FASE 3] Decidir ação estratégica
    const { action, urgency } = decideAction(intent, journeyStage, messageCount);

    // [FASE 6] Priorizar próximo passo
    const nextStep = prioritizeNextStep(action, extractedData);

    // [FASE 8] Extrair contexto real (sem novo scraping)
    const context = extractContextHints(extractedData);

    const decision = {
      intent,
      action,
      urgency,
      nextStep,
      context,
      // Metadados para debug
      _source: 'decision-engine-v1',
      _timestamp: Date.now()
    };

    // Log de decisão (controlado por env var)
    if (process.env.DEBUG_SALES === 'true') {
      console.log(`🧠 [DECISION-ENGINE] Intent=${intent} → Action=${action} | Urgency=${urgency} | Next=${nextStep}`);
      if (context.price) console.log(`💰 [DECISION-ENGINE] Preço detectado: ${context.price}`);
      if (context.benefit) console.log(`✨ [DECISION-ENGINE] Benefício: ${context.benefit}`);
    }

    return decision;

  } catch (err) {
    // [FASE 9] SAFE MODE — retorna null, fluxo original continua
    console.warn('⚠️ [DECISION-ENGINE] Erro geral (safe mode → null):', err.message || err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────

module.exports = {
  decideStrategy,
  detectIntent,
  decideAction,
  prioritizeNextStep,
  extractContextHints
};
