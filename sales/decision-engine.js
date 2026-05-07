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
      curioso:  { action: 'engajar',          urgency: 'low' }
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
    return { action: 'engajar', urgency: 'low' };
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

// ═══════════════════════════════════════════════════════════════════
// ███ DECISION ENGINE V2 — EVOLUÇÃO AVANÇADA ███
// ═══════════════════════════════════════════════════════════════════
//
// Todas as funções abaixo são ADITIVAS.
// As funções V1 acima permanecem 100% intactas como fallback.
// Se qualquer função V2 falhar → fallback para V1 → fallback para null.
//
// Protegido por FEATURE_DECISION_ENGINE_V2 (verificado no server.js)
// ═══════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// [V2 FASE 1] DETECÇÃO DE INTENÇÃO AVANÇADA COM CONFIDENCE
// ─────────────────────────────────────────────────────────────────

/**
 * Mapa de sinônimos informais → intenção real.
 * Cobre linguagem coloquial brasileira que o V1 não pega.
 */
const ADVANCED_PATTERNS = {
  comprar: {
    exact: INTENT_PATTERNS.comprar, // herda todos os patterns V1
    fuzzy: [
      // Gírias e linguagem informal de compra
      { pattern: 'to dentro',         weight: 1.0 },
      { pattern: 'tô dentro',        weight: 1.0 },
      { pattern: 'bora',              weight: 0.7 },
      { pattern: 'vou pegar',         weight: 0.9 },
      { pattern: 'vou querer',        weight: 0.9 },
      { pattern: 'pensando em pegar', weight: 0.8 },
      { pattern: 'quero garantir',    weight: 1.0 },
      { pattern: 'me convenceu',      weight: 0.9 },
      { pattern: 'fecha',             weight: 0.8 },
      { pattern: 'manda o link',      weight: 1.0 },
      { pattern: 'passa o link',      weight: 1.0 },
      { pattern: 'como faço pra',     weight: 0.7 },
      { pattern: 'como faco pra',     weight: 0.7 },
      { pattern: 'quero sim',         weight: 1.0 },
      { pattern: 'pode mandar',       weight: 0.9 },
      { pattern: 'manda pra mim',     weight: 0.9 },
      { pattern: 'compensa comprar',  weight: 0.8 },
      { pattern: 'vou levar',         weight: 0.9 },
      { pattern: 'onde pago',         weight: 1.0 },
      { pattern: 'pix',              weight: 0.8 },
      { pattern: 'cartão',            weight: 0.7 },
      { pattern: 'cartao',            weight: 0.7 },
      { pattern: 'parcela',           weight: 0.7 },
      { pattern: 'parcelar',          weight: 0.7 },
    ]
  },
  duvida: {
    exact: INTENT_PATTERNS.duvida,
    fuzzy: [
      { pattern: 'isso compensa',     weight: 0.6 },  // viés de compra
      { pattern: 'isso presta',       weight: 0.5 },
      { pattern: 'é bom mesmo',       weight: 0.5 },
      { pattern: 'e bom mesmo',       weight: 0.5 },
      { pattern: 'explica melhor',    weight: 0.8 },
      { pattern: 'como assim',        weight: 0.7 },
      { pattern: 'não entendi',       weight: 0.7 },
      { pattern: 'nao entendi',       weight: 0.7 },
      { pattern: 'pode explicar',     weight: 0.8 },
      { pattern: 'me explica',        weight: 0.8 },
      { pattern: 'o que vem',         weight: 0.7 },
      { pattern: 'o que inclui',      weight: 0.7 },
      { pattern: 'entrega o que',     weight: 0.6 },
      { pattern: 'serve pra mim',     weight: 0.6 },
    ]
  },
  objecao: {
    exact: INTENT_PATTERNS.objecao,
    fuzzy: [
      { pattern: 'acho caro',         weight: 0.9 },
      { pattern: 'muito dinheiro',    weight: 0.8 },
      { pattern: 'não sei não',       weight: 0.6 },
      { pattern: 'nao sei nao',       weight: 0.6 },
      { pattern: 'será que vale',     weight: 0.7 },
      { pattern: 'sera que vale',     weight: 0.7 },
      { pattern: 'funciona mesmo',    weight: 0.7 },
      { pattern: 'isso é real',       weight: 0.7 },
      { pattern: 'isso e real',       weight: 0.7 },
      { pattern: 'tem prova',         weight: 0.8 },
      { pattern: 'tem resultado',     weight: 0.6 },
      { pattern: 'já tentei',         weight: 0.7 },
      { pattern: 'ja tentei',         weight: 0.7 },
      { pattern: 'já comprei',        weight: 0.6 },
      { pattern: 'ja comprei',        weight: 0.6 },
      { pattern: 'e se não funcionar', weight: 0.8 },
      { pattern: 'e se nao funcionar', weight: 0.8 },
    ]
  },
  sair: {
    exact: INTENT_PATTERNS.sair,
    fuzzy: [
      { pattern: 'depois vejo',       weight: 0.9 },
      { pattern: 'vou pensar',        weight: 0.8 },
      { pattern: 'mais tarde',        weight: 0.8 },
      { pattern: 'agora não',         weight: 0.9 },
      { pattern: 'agora nao',         weight: 0.9 },
      { pattern: 'to sem grana',      weight: 0.7 },
      { pattern: 'tô sem grana',      weight: 0.7 },
      { pattern: 'no momento não',    weight: 0.8 },
      { pattern: 'no momento nao',    weight: 0.8 },
      { pattern: 'por enquanto não',  weight: 0.8 },
      { pattern: 'por enquanto nao',  weight: 0.8 },
      { pattern: 'não é pra mim',     weight: 0.9 },
      { pattern: 'nao e pra mim',     weight: 0.9 },
      { pattern: 'valeu mas',         weight: 0.7 },
      { pattern: 'obrigado mas',      weight: 0.7 },
    ]
  },
  curioso: {
    exact: INTENT_PATTERNS.curioso,
    fuzzy: [
      { pattern: 'oi',                weight: 0.5 },
      { pattern: 'eae',               weight: 0.5 },
      { pattern: 'fala',              weight: 0.4 },
      { pattern: 'opa',               weight: 0.5 },
      { pattern: 'vi o anúncio',      weight: 0.7 },
      { pattern: 'vi o anuncio',      weight: 0.7 },
      { pattern: 'me chamou atenção', weight: 0.7 },
      { pattern: 'me chamou atencao', weight: 0.7 },
      { pattern: 'tô curioso',        weight: 0.8 },
      { pattern: 'to curioso',        weight: 0.8 },
      { pattern: 'quero entender',    weight: 0.7 },
    ]
  }
};

/**
 * [V2 FASE 1] Detecta intenção com score de confiança.
 *
 * @param {string} userMessage — mensagem do usuário
 * @param {Array}  history     — histórico de mensagens (opcional)
 * @returns {{ intent: string, confidence: number }}
 */
function detectIntentAdvanced(userMessage, history) {
  try {
    const msg = String(userMessage || '').toLowerCase().trim();
    if (!msg) return { intent: 'curioso', confidence: 0.3 };

    const scores = {};

    for (const [intent, data] of Object.entries(ADVANCED_PATTERNS)) {
      let totalScore = 0;
      let matchCount = 0;

      // 1. Exact matches (V1 herança) — peso 1.0 cada
      for (const pattern of data.exact) {
        if (msg.includes(pattern)) {
          totalScore += 1.0;
          matchCount++;
        }
      }

      // 2. Fuzzy matches (V2 novidade) — peso variável
      for (const { pattern, weight } of data.fuzzy) {
        if (msg.includes(pattern)) {
          totalScore += weight;
          matchCount++;
        }
      }

      // 3. Bônus contextual por histórico (se disponível)
      if (Array.isArray(history) && history.length > 0) {
        const lastMsgs = history
          .filter(h => h && h.role === 'user')
          .slice(-3)
          .map(h => String(h.content || '').toLowerCase());

        // Se últimas mensagens tinham mesma tendência, aumentar score
        for (const prevMsg of lastMsgs) {
          for (const pattern of data.exact) {
            if (prevMsg.includes(pattern)) {
              totalScore += 0.2; // bônus leve por consistência
              break; // só 1 bônus por mensagem anterior
            }
          }
        }
      }

      scores[intent] = { total: totalScore, matches: matchCount };
    }

    // Encontrar melhor intenção
    const sorted = Object.entries(scores)
      .filter(([, s]) => s.total > 0)
      .sort((a, b) => b[1].total - a[1].total);

    if (sorted.length === 0) {
      return { intent: 'curioso', confidence: 0.3 };
    }

    const [bestIntent, bestScore] = sorted[0];

    // Calcular confidence normalizada (0.0 → 1.0)
    // 1 match exato = ~0.6, 2+ = ~0.8+, com fuzzy = boost fino
    const rawConfidence = Math.min(bestScore.total / 2.0, 1.0);
    const confidence = Math.round(rawConfidence * 100) / 100;

    // Se 2 intenções empatadas ou muito próximas → reduzir confidence
    if (sorted.length >= 2) {
      const secondScore = sorted[1][1].total;
      if (bestScore.total > 0 && secondScore / bestScore.total > 0.7) {
        // Ambiguidade alta → reduzir confiança
        return { intent: bestIntent, confidence: Math.max(confidence * 0.7, 0.3) };
      }
    }

    return { intent: bestIntent, confidence };
  } catch (err) {
    console.warn('⚠️ [DECISION-ENGINE-V2] detectIntentAdvanced erro:', err.message);
    // Fallback para V1
    return { intent: detectIntent(userMessage), confidence: 0.5 };
  }
}

// ─────────────────────────────────────────────────────────────────
// [V2 FASE 2] ANÁLISE DE ESTÁGIO POR HISTÓRICO
// ─────────────────────────────────────────────────────────────────

/**
 * Analisa as últimas mensagens do usuário para determinar estágio real.
 *
 * @param {Array} history — conversationHistory [{role, content}, ...]
 * @returns {{ stage: string, evolution: string, repeatedIntent: boolean }}
 */
function getConversationStage(history) {
  try {
    if (!Array.isArray(history) || history.length === 0) {
      return { stage: 'descoberta', evolution: 'inicio', repeatedIntent: false };
    }

    // Extrair últimas 3 mensagens do usuário
    const userMessages = history
      .filter(h => h && h.role === 'user' && h.content)
      .slice(-3)
      .map(h => String(h.content).toLowerCase().trim());

    if (userMessages.length === 0) {
      return { stage: 'descoberta', evolution: 'inicio', repeatedIntent: false };
    }

    // Detectar intenção de cada mensagem
    const intents = userMessages.map(msg => detectIntent(msg));

    // Verificar repetição de intenção
    const repeatedIntent = intents.length >= 2 &&
      intents[intents.length - 1] === intents[intents.length - 2];

    // Mapear evolução
    const intentSequence = intents.join('→');
    let stage = 'descoberta';
    let evolution = 'estavel';

    // Padrões de evolução conhecidos
    if (intents.includes('comprar')) {
      stage = 'fechamento';
      evolution = 'avancando';
    } else if (intents.includes('objecao') && intents.includes('duvida')) {
      stage = 'negociacao';
      evolution = 'resistencia';
    } else if (intents.includes('objecao')) {
      stage = 'objecao';
      evolution = 'resistencia';
    } else if (intents.includes('sair')) {
      stage = 'saida';
      evolution = 'recuando';
    } else if (intents.includes('duvida')) {
      stage = 'engajamento';
      // Se começou curioso e foi pra dúvida = avançando
      if (intents[0] === 'curioso' && intents[intents.length - 1] === 'duvida') {
        evolution = 'avancando';
      }
    }

    // Sequências específicas de conversão alta
    if (intents.length >= 2) {
      const last = intents[intents.length - 1];
      const prev = intents[intents.length - 2];

      // Dúvida → Compra = fechamento direto
      if (prev === 'duvida' && last === 'comprar') {
        stage = 'fechamento';
        evolution = 'acelerado';
      }
      // Objeção → Dúvida = quebrou resistência parcial
      if (prev === 'objecao' && last === 'duvida') {
        stage = 'negociacao';
        evolution = 'avancando';
      }
      // Curioso → Curioso → Curioso = não está progredindo
      if (intents.every(i => i === 'curioso') && intents.length >= 3) {
        stage = 'descoberta';
        evolution = 'estagnado';
      }
    }

    if (process.env.DEBUG_SALES === 'true') {
      console.log(`🧠 [V2-STAGE] Intents: [${intentSequence}] → stage=${stage} evolution=${evolution}`);
    }

    return { stage, evolution, repeatedIntent };
  } catch (err) {
    console.warn('⚠️ [DECISION-ENGINE-V2] getConversationStage erro:', err.message);
    return { stage: 'descoberta', evolution: 'inicio', repeatedIntent: false };
  }
}

// ─────────────────────────────────────────────────────────────────
// [V2 FASE 3] DECISION MATRIX
// ─────────────────────────────────────────────────────────────────

/**
 * Matriz de decisão estruturada.
 *
 * @param {object} params
 * @param {string}  params.intent       — intenção detectada
 * @param {number}  params.confidence   — confiança da detecção
 * @param {string}  params.stage        — estágio do histórico
 * @param {string}  params.evolution    — evolução da conversa
 * @param {number}  params.messageCount — total de mensagens
 * @returns {{ strategy: string, pressure: string, action: string }}
 */
function decideByMatrix({ intent, confidence, stage, evolution, messageCount }) {
  try {
    const count = Number(messageCount) || 1;

    // ── REGRA ABSOLUTA: Intent = comprar → fechar direto ──
    if (intent === 'comprar' && confidence >= 0.6) {
      return { strategy: 'fechar', pressure: 'high', action: 'link_direto' };
    }

    // ── MATRIZ POR COMBINAÇÃO intent × stage ──
    const matrix = {
      // DÚVIDA
      'duvida:descoberta':   { strategy: 'educar',           pressure: 'low',    action: 'responder' },
      'duvida:engajamento':  { strategy: 'engajar',          pressure: 'medium', action: 'responder' },
      'duvida:negociacao':   { strategy: 'quebrar_objecao',  pressure: 'medium', action: 'CTA' },
      'duvida:fechamento':   { strategy: 'fechar',           pressure: 'high',   action: 'CTA' },

      // OBJEÇÃO
      'objecao:descoberta':  { strategy: 'educar',           pressure: 'low',    action: 'responder' },
      'objecao:engajamento': { strategy: 'quebrar_objecao',  pressure: 'medium', action: 'responder' },
      'objecao:negociacao':  { strategy: 'quebrar_objecao',  pressure: 'medium', action: 'CTA' },
      'objecao:objecao':     { strategy: 'quebrar_objecao',  pressure: 'medium', action: 'responder' },

      // SAIR
      'sair:descoberta':     { strategy: 'reter',            pressure: 'low',    action: 'responder' },
      'sair:engajamento':    { strategy: 'reter',            pressure: 'medium', action: 'responder' },
      'sair:negociacao':     { strategy: 'reter',            pressure: 'high',   action: 'CTA' },
      'sair:saida':          { strategy: 'reter',            pressure: 'medium', action: 'responder' },

      // CURIOSO
      'curioso:descoberta':  { strategy: 'educar',           pressure: 'low',    action: 'responder' },
      'curioso:engajamento': { strategy: 'engajar',          pressure: 'medium', action: 'responder' },
    };

    const key = `${intent}:${stage}`;
    let decision = matrix[key] || { strategy: 'engajar', pressure: 'low', action: 'responder' };

    // ── [V2 FASE 6] CONTROLE DE AGRESSIVIDADE ──
    // Escalar pressão baseado no número de mensagens
    if (intent !== 'comprar') {
      if (count <= 2)      decision.pressure = 'low';
      else if (count <= 5) decision.pressure = decision.pressure === 'low' ? 'medium' : decision.pressure;
      else                 decision.pressure = decision.pressure === 'low' ? 'medium' : 'high';
    }

    // Se evolução é 'avancando' ou 'acelerado', empurrar pra CTA
    if (evolution === 'avancando' && count >= 3) {
      decision.action = 'CTA';
    }
    if (evolution === 'acelerado') {
      decision.action = 'link_direto';
      decision.pressure = 'high';
    }

    // Se estagnado por muito tempo, tentar engajar
    if (evolution === 'estagnado' && count >= 4) {
      decision.strategy = 'engajar';
      decision.pressure = 'medium';
      decision.action = 'CTA';
    }

    return decision;
  } catch (err) {
    console.warn('⚠️ [DECISION-ENGINE-V2] decideByMatrix erro:', err.message);
    return { strategy: 'engajar', pressure: 'low', action: 'responder' };
  }
}

// ─────────────────────────────────────────────────────────────────
// [V2 FASE 5] ANTI-ERRO DE DECISÃO
// ─────────────────────────────────────────────────────────────────

/**
 * Garante que decisões críticas não sejam perdidas.
 *
 * @param {object} decision   — decisão da matrix
 * @param {string} intent     — intenção detectada
 * @param {number} confidence — confiança
 * @param {object} context    — contexto (hasUrl, etc.)
 * @returns {object} decision corrigida (ou mesma)
 */
function antiErrorSafeguard(decision, intent, confidence, context) {
  try {
    // REGRA 1: Se intent=comprar com confiança alta e action não é link_direto → FORÇAR
    if (intent === 'comprar' && confidence >= 0.7 && decision.action !== 'link_direto') {
      decision.action = 'link_direto';
      decision.strategy = 'fechar';
      decision.pressure = 'high';
      decision._safeguardApplied = 'force_cta_on_buy';
    }

    // REGRA 2: Se intent=comprar e contexto tem URL → garantir checkout
    if (intent === 'comprar' && context && context.hasUrl && decision.action === 'responder') {
      decision.action = 'CTA';
      decision._safeguardApplied = 'force_cta_has_url';
    }

    return decision;
  } catch (err) {
    return decision;
  }
}

// ─────────────────────────────────────────────────────────────────
// [V2 FASE 7] AUTO-CORREÇÃO
// ─────────────────────────────────────────────────────────────────

/**
 * Se a última resposta da IA não conteve CTA nem avançou a conversa,
 * aumentar pressão nesta rodada.
 *
 * @param {object} decision  — decisão atual
 * @param {Array}  history   — histórico completo
 * @returns {object} decision (possivelmente ajustada)
 */
function autoCorrect(decision, history) {
  try {
    if (!Array.isArray(history) || history.length < 2) return decision;

    // Pegar última resposta da IA
    const lastAssistant = [...history]
      .reverse()
      .find(h => h && h.role === 'assistant');

    if (!lastAssistant || !lastAssistant.content) return decision;

    const lastResponse = String(lastAssistant.content).toLowerCase();

    // Verificar se teve CTA na última resposta
    const hadCTA = lastResponse.includes('http') ||
                   lastResponse.includes('clique') ||
                   lastResponse.includes('acesse') ||
                   lastResponse.includes('wa.me') ||
                   lastResponse.includes('começar agora') ||
                   lastResponse.includes('comecar agora') ||
                   lastResponse.includes('ativar');

    // Se não teve CTA e não estamos no início → aumentar pressão
    if (!hadCTA && decision.pressure !== 'high') {
      const pressureMap = { low: 'medium', medium: 'high' };
      decision.pressure = pressureMap[decision.pressure] || decision.pressure;
      decision._autoCorrection = 'pressure_increased';

      if (process.env.DEBUG_SALES === 'true') {
        console.log('🔄 [V2-AUTOCORRECT] Pressão aumentada: último turno sem CTA');
      }
    }

    return decision;
  } catch (err) {
    return decision;
  }
}

// ─────────────────────────────────────────────────────────────────
// [V2 FASE 1-9] FUNÇÃO PRINCIPAL — decideStrategyV2
// ─────────────────────────────────────────────────────────────────

/**
 * Função principal V2 do Decision Engine.
 * Usa detecção avançada + histórico + matrix + safeguards.
 *
 * SAFE MODE: Se qualquer erro → retorna null → V1 assume.
 *
 * @param {object} params
 * @param {string}  params.userMessage        — mensagem do usuário
 * @param {string}  params.journeyStage       — estágio (V1 legacy, usado como fallback)
 * @param {number}  params.messageCount       — total de mensagens
 * @param {string}  params.conversationId     — ID da conversa
 * @param {object}  params.extractedData      — pageData
 * @param {Array}   params.conversationHistory — histórico [{role, content}, ...]
 * @returns {object|null}
 */
function decideStrategyV2({
  userMessage     = '',
  journeyStage    = 'descoberta',
  messageCount    = 1,
  conversationId  = null,
  extractedData   = {},
  conversationHistory = []
} = {}) {
  // [FASE 9] SAFE MODE TOTAL
  try {
    if (!userMessage || typeof userMessage !== 'string') return null;
    const msg = userMessage.trim();
    if (!msg) return null;

    // [FASE 1] Detectar intenção com confiança
    const { intent, confidence } = detectIntentAdvanced(msg, conversationHistory);

    // FALLBACK: Se confiança muito baixa → retornar null (V1 assume via server.js)
    if (confidence < 0.4) {
      if (process.env.DEBUG_SALES === 'true') {
        console.log(`🧠 [V2] Confidence ${confidence} < 0.4 → fallback para V1`);
      }
      return null;
    }

    // [FASE 2] Analisar estágio por histórico
    const { stage, evolution, repeatedIntent } = getConversationStage(conversationHistory);

    // [FASE 3] Decision Matrix
    let decision = decideByMatrix({
      intent,
      confidence,
      stage,
      evolution,
      messageCount
    });

    // [FASE 4] Extrair contexto real (reutiliza V1)
    const context = extractContextHints(extractedData);

    // Enriquecer contexto com flags booleanas
    context.hasPrice   = !!(context.price);
    context.hasBenefit = !!(context.benefit);

    // [FASE 5] Anti-erro
    decision = antiErrorSafeguard(decision, intent, confidence, context);

    // [FASE 7] Auto-correção
    decision = autoCorrect(decision, conversationHistory);

    // [FASE 6] Priorizar próximo passo (reutiliza V1)
    const nextStep = prioritizeNextStep(
      decision.strategy === 'fechar' ? 'fechar' : decision.action === 'link_direto' ? 'fechar' : 'educar',
      extractedData
    );

    const result = {
      intent,
      confidence,
      stage,
      evolution,
      strategy:  decision.strategy,
      pressure:  decision.pressure,
      action:    decision.action,
      nextStep,
      context,
      repeatedIntent,
      // Compatibilidade com V1 (sales-layer espera esses campos)
      urgency: decision.pressure,
      // Metadados
      _source: 'decision-engine-v2',
      _timestamp: Date.now(),
      _safeguardApplied: decision._safeguardApplied || null,
      _autoCorrection: decision._autoCorrection || null
    };

    // [FASE 8] LOGS INTELIGENTES
    if (process.env.DEBUG_SALES === 'true') {
      console.log('╔══════════════════════════════════════════════╗');
      console.log('║  🧠 DECISION ENGINE V2 — DECISÃO COMPLETA   ║');
      console.log('╠══════════════════════════════════════════════╣');
      console.log(`║  INTENT:     ${intent} (${confidence})`);
      console.log(`║  STAGE:      ${stage} (${evolution})`);
      console.log(`║  STRATEGY:   ${decision.strategy}`);
      console.log(`║  PRESSURE:   ${decision.pressure}`);
      console.log(`║  ACTION:     ${decision.action}`);
      console.log(`║  NEXT STEP:  ${nextStep}`);
      if (context.price)   console.log(`║  💰 PREÇO:   ${context.price}`);
      if (context.benefit) console.log(`║  ✨ BENEFÍCIO: ${context.benefit}`);
      if (decision._safeguardApplied) console.log(`║  🛡️ SAFEGUARD: ${decision._safeguardApplied}`);
      if (decision._autoCorrection)   console.log(`║  🔄 AUTOCORRECT: ${decision._autoCorrection}`);
      console.log('╚══════════════════════════════════════════════╝');
    }

    return result;

  } catch (err) {
    // [FASE 9] SAFE MODE — retorna null, V1 assume
    console.warn('⚠️ [DECISION-ENGINE-V2] Erro geral (safe mode → null):', err.message || err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// EXPORTS (V1 + V2)
// ─────────────────────────────────────────────────────────────────

module.exports = {
  // V1 (inalterado — backward compatible)
  decideStrategy,
  detectIntent,
  decideAction,
  prioritizeNextStep,
  extractContextHints,
  // V2 (novo — protegido por feature flag)
  decideStrategyV2,
  detectIntentAdvanced,
  getConversationStage,
  decideByMatrix,
  antiErrorSafeguard,
  autoCorrect
};
