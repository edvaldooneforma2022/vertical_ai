/**
 * ⚔️ SALES LAYER — Link Mágico V8.0
 *
 * Camada de pós-processamento EXCLUSIVAMENTE aditiva.
 * NUNCA altera o conteúdo base da resposta da IA.
 * NUNCA inventa informações, contexto ou produtos.
 *
 * @version 4.0.0 — Otimização Final de Conversão (Fases 0-10)
 *
 * Módulos implementados:
 * [F0]  Auditoria automática de duplicatas
 * [F1]  Anti-repetição por sessão (lastUsedCopy)
 * [F2]  Pressão dinâmica por contagem de mensagens
 * [F3]  Detecção de intenção de compra (buy intent)
 * [F4]  Timing inteligente de fechamento
 * [F5]  Classificação de perfil do usuário
 * [F6]  Gatilho final de decisão
 * [F7]  Soft reengagement (backend)
 * [F8]  Micro-compromissos em discovery
 * [F9]  Gatilho de aversão à perda (controlado)
 * [F10] Safe wrapper global
 */

'use strict';

const { getPreset } = require('./presets');

// ─────────────────────────────────────────────────────────────────
// ESTADO LEVE DE MÓDULO
// Memória por conversationId (Map limpa após 30min para não vazar memória)
// ─────────────────────────────────────────────────────────────────
const _copyHistory    = new Map(); // conversationId → última frase usada
const _copyTimestamps = new Map(); // conversationId → timestamp (limpeza)
const COPY_TTL_MS     = 30 * 60 * 1000; // 30 minutos

function _cleanExpiredHistory() {
  try {
    const now = Date.now();
    for (const [id, ts] of _copyTimestamps) {
      if (now - ts > COPY_TTL_MS) {
        _copyHistory.delete(id);
        _copyTimestamps.delete(id);
      }
    }
  } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────
// MAPEAMENTO ESTÁGIO → CHAVE DE COPY
// ─────────────────────────────────────────────────────────────────
const STAGE_TO_COPY_KEY = {
  descoberta:  'discovery',
  engajamento: 'engagement',
  objecao:     'objection',
  negociacao:  'closing',
  fidelizacao: 'engagement'
};

// ─────────────────────────────────────────────────────────────────
// FALLBACK DE COMPLEMENTOS GENÉRICOS
// ─────────────────────────────────────────────────────────────────
const FALLBACK_COMPLEMENTS = {
  low:    ['Tem mais alguma dúvida que posso esclarecer?', 'Faz sentido para você até aqui?'],
  medium: ['O que você achou? Posso continuar explicando.', 'Faz sentido para o seu caso?'],
  high:   ['Você já viu o valor. A única diferença agora é começar.', 'Faz mais sentido começar agora ou continuar do jeito que está?']
};

// ─────────────────────────────────────────────────────────────────
// [F1] ANTI-REPETIÇÃO — getCopyByStage com memória por sessão
// ─────────────────────────────────────────────────────────────────

/**
 * Seleciona frase de copy baseada no preset e estágio,
 * evitando repetir a última frase usada na mesma sessão.
 */
function getCopyByStage(presetData, journeyStage, pressure, conversationId) {
  try {
    _cleanExpiredHistory();

    const copyKey = STAGE_TO_COPY_KEY[journeyStage] || 'engagement';
    let options   = (presetData && presetData.copy && Array.isArray(presetData.copy[copyKey]))
      ? [...presetData.copy[copyKey]]
      : [];

    // [F1] Filtrar última frase usada para evitar repetição
    const lastUsed = _copyHistory.get(conversationId || '_global');
    if (lastUsed && options.length > 1) {
      options = options.filter(opt => opt !== lastUsed);
    }

    // Fallback 1: outro bloco do mesmo preset
    if (options.length === 0 && presetData && presetData.copy) {
      const fallbackKey = Object.keys(presetData.copy).find(
        k => Array.isArray(presetData.copy[k]) && presetData.copy[k].length > 0
      );
      if (fallbackKey) options = [...presetData.copy[fallbackKey]];
    }

    // Fallback 2: complementos genéricos por pressão
    if (options.length === 0) {
      const level = pressure || 'medium';
      options = FALLBACK_COMPLEMENTS[level] || FALLBACK_COMPLEMENTS.medium;
    }

    const selected = options[Math.floor(Math.random() * options.length)] || null;

    // Salvar na memória de sessão
    if (selected && conversationId) {
      _copyHistory.set(conversationId, selected);
      _copyTimestamps.set(conversationId, Date.now());
    }

    return selected;
  } catch (err) {
    console.warn('⚠️ [SALES-LAYER][F1] getCopyByStage falhou:', err.message);
    const level = pressure || 'medium';
    return (FALLBACK_COMPLEMENTS[level] || FALLBACK_COMPLEMENTS.medium)[0];
  }
}

// ─────────────────────────────────────────────────────────────────
// [F2] PRESSÃO DINÂMICA POR CONTAGEM DE MENSAGENS
// ─────────────────────────────────────────────────────────────────

function getDynamicPressure(basePressure, messageCount) {
  try {
    const count = Number(messageCount) || 1;
    if (count <= 2) return 'low';
    if (count <= 5) return 'medium';
    return basePressure === 'high' ? 'high' : 'medium';
  } catch (err) {
    return basePressure || 'medium';
  }
}

// ─────────────────────────────────────────────────────────────────
// [F3] DETECÇÃO DE INTENÇÃO DE COMPRA (BUY INTENT)
// ─────────────────────────────────────────────────────────────────

const BUY_INTENT_TRIGGERS = [
  'quero comprar', 'quero pagar', 'como comprar', 'quero contratar',
  'me mostra', 'me mostre', 'me manda o link', 'me passa o link',
  'link de pagamento', 'link do produto', 'preço', 'valor', 'quanto custa',
  'checkout', 'como faço pra', 'quero agora', 'como acesso'
];

function detectBuyIntent(userMessage) {
  try {
    const msg = String(userMessage || '').toLowerCase();
    return BUY_INTENT_TRIGGERS.some(t => msg.includes(t));
  } catch (err) {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────
// [F4] TIMING INTELIGENTE — evita fechamento precoce
// ─────────────────────────────────────────────────────────────────

function shouldClose(journeyStage, messageCount) {
  try {
    if (journeyStage === 'negociacao') return true;
    if (journeyStage === 'objecao')    return true;
    if (Number(messageCount) >= 5)     return true;
    return false;
  } catch (err) {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────
// [F5] CLASSIFICAÇÃO DE PERFIL DO USUÁRIO
// ─────────────────────────────────────────────────────────────────

function detectUserProfile(userMessage) {
  try {
    const msg = String(userMessage || '').toLowerCase();
    if (msg.includes('como funciona') || msg.includes('o que é') || msg.includes('o que e'))
      return 'curioso';
    if (msg.includes('funciona mesmo') || msg.includes('confiável') || msg.includes('confiaval') || msg.includes('é real') || msg.includes('e real'))
      return 'cetico';
    if (msg.includes('depois vejo') || msg.includes('talvez') || msg.includes('vou pensar') || msg.includes('mais tarde'))
      return 'distraido';
    if (msg.includes('comparando') || msg.includes('outro') || msg.includes('alternativa') || msg.includes('concorrente'))
      return 'comparador';
    return 'normal';
  } catch (err) {
    return 'normal';
  }
}

// ─────────────────────────────────────────────────────────────────
// [F6] GATILHO FINAL DE DECISÃO
// ─────────────────────────────────────────────────────────────────

function injectFinalDecision(response, journeyStage, messageCount) {
  try {
    if (journeyStage !== 'negociacao') return response;
    if (Number(messageCount) < 4)      return response;
    return response + '\n\nAgora é simples: você quer ativar isso agora ou prefere continuar perdendo essas oportunidades?';
  } catch (err) {
    return response;
  }
}

// ─────────────────────────────────────────────────────────────────
// [F7] SOFT REENGAGEMENT (backend — primeira interação sem contexto)
// ─────────────────────────────────────────────────────────────────

function getSoftReengagement(messageCount) {
  try {
    if (Number(messageCount) !== 1) return null;
    return 'Posso te mostrar rapidamente como isso funciona no seu caso?';
  } catch (err) {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// [F8] MICRO-COMPROMISSOS (discovery, 1 a cada 2 interações)
// ─────────────────────────────────────────────────────────────────

const MICRO_COMMITMENTS = [
  'Isso faz sentido pra você até aqui?',
  'Você já passou por algo assim antes?',
  'É mais ou menos isso que você está buscando?'
];

function getMicroCommitment(messageCount, journeyStage) {
  try {
    if (journeyStage !== 'descoberta') return null;
    // Aplicar apenas em contagens pares para não ser repetitivo
    if (Number(messageCount) % 2 !== 0) return null;
    return MICRO_COMMITMENTS[Math.floor(Math.random() * MICRO_COMMITMENTS.length)];
  } catch (err) {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// [F9] AVERSÃO À PERDA (controlada, apenas com urgência ativa)
// ─────────────────────────────────────────────────────────────────

function addLossAversion(journeyStage, urgency) {
  try {
    if (!urgency) return null;
    if (journeyStage === 'negociacao') {
      return 'Enquanto você pensa, essas oportunidades continuam passando.';
    }
    return null;
  } catch (err) {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────────

function getBehaviorConfig({ mode, userPreset, autoPreset }) {
  try {
    if (mode === 'off') return null;
    if (mode === 'manual' && userPreset) return getPreset(userPreset).behavior;
    return getPreset(autoPreset || 'default').behavior;
  } catch (err) {
    return getPreset('default').behavior;
  }
}

function getActivePresetData({ mode, userPreset, autoPreset }) {
  try {
    if (mode === 'off')                  return getPreset('default');
    if (mode === 'manual' && userPreset) return getPreset(userPreset);
    return getPreset(autoPreset || 'default');
  } catch (err) {
    return getPreset('default');
  }
}

function shouldApplyComplement(responseBase) {
  const base = String(responseBase || '');
  if (base.length < 20)   return false;
  if (base.length > 2000) return false;
  const lastChars = base.slice(-120).toLowerCase();
  if (lastChars.includes('?'))      return false;
  if (lastChars.includes('clique')) return false;
  if (lastChars.includes('acesse')) return false;
  if (lastChars.includes('compre')) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────
// [F10] FUNÇÃO PRINCIPAL — Safe Wrapper Global
// ─────────────────────────────────────────────────────────────────

/**
 * Aplica pós-processamento persuasivo sobre a resposta da IA base.
 *
 * @param {object} params
 * @param {string}  params.responseBase      — Resposta original (NUNCA alterada em erro)
 * @param {string}  params.journeyStage      — "descoberta" | "negociacao" | "fidelizacao" | "objecao"
 * @param {object}  params.estadoEmocional   — { emocaoPrimaria, sarcasmo, urgencia, ... }
 * @param {string}  [params.userMessage]     — Mensagem do usuário (para F3/F5)
 * @param {number}  [params.messageCount]    — Total de mensagens da conversa (para F2/F4/F6/F8)
 * @param {string}  [params.conversationId]  — ID da conversa (para F1 anti-repetição)
 * @param {string}  [params.mode]            — "auto" | "manual" | "off"
 * @param {string}  [params.userPreset]      — Preset selecionado manualmente
 * @param {string}  [params.autoPreset]      — Preset detectado automaticamente
 * @returns {string}
 */
function applySalesLayer({
  responseBase,
  journeyStage    = 'descoberta',
  estadoEmocional = {},
  userMessage     = '',
  messageCount    = 1,
  conversationId  = null,
  mode            = 'auto',
  userPreset      = null,
  autoPreset      = null
}) {
  // [F10] Safe wrapper global
  try {

    // ── GUARDS básicos ────────────────────────────────────────────
    if (mode === 'off') return responseBase;
    if (mode === 'manual' && !userPreset) return responseBase;
    if (estadoEmocional.sarcasmo) return responseBase;
    if (!shouldApplyComplement(responseBase)) return responseBase;

    // ── [F3] BUY INTENT — bypass direto ao link ───────────────────
    try {
      if (detectBuyIntent(userMessage)) {
        console.log('🛒 [SALES-LAYER][F3] Buy intent detectado — bypass persuasão');
        return responseBase + '\n\nPerfeito. Vou te mostrar como ativar agora:';
      }
    } catch (_f3) { /* fallthrough */ }

    // ── Resolver behavior + preset ────────────────────────────────
    const behavior   = getBehaviorConfig({ mode, userPreset, autoPreset });
    if (!behavior) return responseBase;

    const presetData = getActivePresetData({ mode, userPreset, autoPreset });

    const validStages = new Set(['descoberta','negociacao','fidelizacao','engajamento','objecao']);
    const stage       = validStages.has(journeyStage) ? journeyStage : 'descoberta';
    const count       = Number(messageCount) || 1;

    // ── [F5] PERFIL DO USUÁRIO → ajusta pressão ───────────────────
    let activePressure = behavior.pressure || 'medium';
    let activeUrgency  = behavior.urgency  || false;
    try {
      const profile = detectUserProfile(userMessage);
      if (profile === 'cetico')    activePressure = 'low';
      if (profile === 'distraido') activeUrgency  = true;
      if (profile === 'comparador') activePressure = 'medium';
      if (profile !== 'normal') console.log(`👤 [SALES-LAYER][F5] Perfil: ${profile}`);
    } catch (_f5) { /* fallthrough */ }

    // ── [F2] PRESSÃO DINÂMICA por contagem ────────────────────────
    try {
      activePressure = getDynamicPressure(activePressure, count);
    } catch (_f2) { /* fallthrough */ }

    // ── [F9] AVERSÃO À PERDA ──────────────────────────────────────
    try {
      const lossAversion = addLossAversion(stage, activeUrgency);
      if (lossAversion) {
        console.log('⚡ [SALES-LAYER][F9] Loss aversion aplicada');
        return String(responseBase) + '\n\n' + lossAversion;
      }
    } catch (_f9) { /* fallthrough */ }

    // ── [F4] TIMING — evita fechamento precoce ────────────────────
    let applyClosing = false;
    try {
      applyClosing = shouldClose(stage, count);
    } catch (_f4) { applyClosing = false; }

    if (!applyClosing) {
      // ── [F8] MICRO-COMPROMISSO em discovery ────────────────────
      try {
        const microCommit = getMicroCommitment(count, stage);
        if (microCommit) {
          console.log('🔗 [SALES-LAYER][F8] Micro-compromisso aplicado');
          return String(responseBase) + '\n\n' + microCommit;
        }
      } catch (_f8) { /* fallthrough */ }

      // ── [F7] SOFT REENGAGEMENT (1ª mensagem) ───────────────────
      try {
        const reengagement = getSoftReengagement(count);
        if (reengagement) {
          console.log('🔁 [SALES-LAYER][F7] Soft reengagement aplicado');
          return String(responseBase) + '\n\n' + reengagement;
        }
      } catch (_f7) { /* fallthrough */ }

      // Não é momento de fechar → retorna sem pressão
      return responseBase;
    }

    // ── [F6] GATILHO FINAL DE DECISÃO ────────────────────────────
    try {
      const withDecision = injectFinalDecision(String(responseBase), stage, count);
      if (withDecision !== responseBase) {
        console.log('🏁 [SALES-LAYER][F6] Gatilho final de decisão aplicado');
        return withDecision;
      }
    } catch (_f6) { /* fallthrough */ }

    // ── [F1] COPY CONTEXTUAL COM ANTI-REPETIÇÃO ───────────────────
    const activePresetKey = mode === 'manual'
      ? (userPreset || 'default')
      : (autoPreset || 'default');

    const copyPhrase = getCopyByStage(presetData, stage, activePressure, conversationId);

    console.log(
      `⚔️ [SALES-LAYER v4] preset=${activePresetKey} | stage=${stage} | ` +
      `pressure=${activePressure} | mode=${mode} | msgs=${count}`
    );

    return copyPhrase
      ? String(responseBase) + '\n\n' + copyPhrase
      : responseBase;

  } catch (err) {
    // [F10] Safe wrapper global — nunca perde a resposta original
    console.error('⚠️ [SALES-LAYER] Erro geral (fallback absoluto):', err.message || err);
    return responseBase;
  }
}

module.exports = applySalesLayer;
