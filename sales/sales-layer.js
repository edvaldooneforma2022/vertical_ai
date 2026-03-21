/**
 * ⚔️ SALES LAYER — Link Mágico V8.0
 *
 * Camada de pós-processamento EXCLUSIVAMENTE aditiva.
 * NUNCA altera o conteúdo base da resposta da IA.
 * NUNCA inventa informações, contexto ou produtos.
 * APENAS adiciona copy de condução de venda no final da resposta base.
 *
 * Integração: chamada APÓS generateAIResponse(), protegida por FEATURE_SALES_LAYER.
 * Comportamento controlado por PRESETS com copy real por estágio.
 *
 * @version 3.0.0 — copy real por estágio via presets.js
 */

'use strict';

const { getPreset } = require('./presets');

// ─────────────────────────────────────────────────────────────────
// MAPEAMENTO DE ESTÁGIO → CHAVE DE COPY
// ─────────────────────────────────────────────────────────────────
const STAGE_TO_COPY_KEY = {
  descoberta:  'discovery',
  engajamento: 'engagement',
  objecao:     'objection',
  negociacao:  'closing',
  fidelizacao: 'engagement'  // pós-compra usa tom de suporte/engajamento
};

// ─────────────────────────────────────────────────────────────────
// FALLBACK DE COMPLEMENTOS GENÉRICOS
// (usado quando o preset não tem copy para o estágio ou ocorre erro)
// ─────────────────────────────────────────────────────────────────
const FALLBACK_COMPLEMENTS = {
  low:    ['Tem mais alguma dúvida que posso esclarecer?', 'Faz sentido para você até aqui?'],
  medium: ['O que você achou? Posso continuar explicando.', 'Faz sentido para o seu caso?'],
  high:   ['Você já viu o valor. A única diferença agora é começar.', 'Faz mais sentido começar agora ou continuar do jeito que está?']
};

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function pick(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Seleciona frase de copy baseada no preset e estágio.
 * Fallback seguro em cada nível.
 *
 * @param {object} presetData — objeto do preset (inclui .copy)
 * @param {string} journeyStage — estágio atual da jornada
 * @param {string} pressure — nível de pressão do behavior
 * @returns {string}
 */
function getCopyByStage(presetData, journeyStage, pressure) {
  try {
    const copyKey = STAGE_TO_COPY_KEY[journeyStage] || 'engagement';

    // Tenta copy do preset
    if (presetData && presetData.copy && Array.isArray(presetData.copy[copyKey]) && presetData.copy[copyKey].length > 0) {
      return pick(presetData.copy[copyKey]);
    }

    // Fallback 1: outro bloco de copy do mesmo preset
    if (presetData && presetData.copy) {
      const fallbackKey = Object.keys(presetData.copy).find(k => Array.isArray(presetData.copy[k]) && presetData.copy[k].length > 0);
      if (fallbackKey) return pick(presetData.copy[fallbackKey]);
    }

    // Fallback 2: complementos genéricos por pressão
    const level = pressure || 'medium';
    return pick(FALLBACK_COMPLEMENTS[level] || FALLBACK_COMPLEMENTS.medium);

  } catch (err) {
    console.warn('⚠️ [SALES-LAYER] getCopyByStage falhou (fallback genérico):', err.message);
    return pick(FALLBACK_COMPLEMENTS.medium);
  }
}

/**
 * Retorna false se a resposta base não deve receber complemento.
 * Garante que a camada de venda nunca interfere em respostas inabilitadas.
 */
function shouldApplyComplement(responseBase) {
  const base = String(responseBase || '');
  if (base.length < 20)   return false;
  if (base.length > 2000) return false;
  const lastChars = base.slice(-120).toLowerCase();
  if (lastChars.includes('?'))      return false;  // resposta já termina em pergunta
  if (lastChars.includes('clique')) return false;  // já tem CTA
  if (lastChars.includes('acesse')) return false;
  if (lastChars.includes('compre')) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────
// RESOLVER COMPORTAMENTO A PARTIR DO PRESET
// ─────────────────────────────────────────────────────────────────

/**
 * Retorna behavior config ativo com base no modo e preset.
 * @returns {{ pressure, style, goal, urgency } | null}
 */
function getBehaviorConfig({ mode, userPreset, autoPreset }) {
  try {
    if (mode === 'off') return null;

    if (mode === 'manual' && userPreset) {
      return getPreset(userPreset).behavior;
    }

    const key = autoPreset || 'default';
    return getPreset(key).behavior;

  } catch (err) {
    console.warn('⚠️ [SALES-LAYER] getBehaviorConfig falhou (fallback default):', err.message);
    return getPreset('default').behavior;
  }
}

/**
 * Retorna dados completos do preset ativo (behavior + copy).
 */
function getActivePresetData({ mode, userPreset, autoPreset }) {
  try {
    if (mode === 'off') return getPreset('default');
    if (mode === 'manual' && userPreset) return getPreset(userPreset);
    return getPreset(autoPreset || 'default');
  } catch (err) {
    return getPreset('default');
  }
}

// ─────────────────────────────────────────────────────────────────
// FUNÇÃO PRINCIPAL — ponto único de entrada
// ─────────────────────────────────────────────────────────────────

/**
 * Aplica pós-processamento persuasivo sobre a resposta da IA base.
 *
 * @param {object} params
 * @param {string}  params.responseBase    — Resposta original da IA (NUNCA alterada)
 * @param {string}  params.journeyStage    — "descoberta" | "negociacao" | "fidelizacao" | "objecao"
 * @param {object}  params.estadoEmocional — { emocaoPrimaria, sarcasmo, urgencia, ... }
 * @param {string}  [params.mode]          — "auto" | "manual" | "off" (default: "auto")
 * @param {string}  [params.userPreset]    — preset selecionado manualmente
 * @param {string}  [params.autoPreset]    — preset detectado automaticamente
 * @returns {string} Resposta final (responseBase + copy) ou responseBase em caso de erro
 */
function applySalesLayer({
  responseBase,
  journeyStage    = 'descoberta',
  estadoEmocional = {},
  mode            = 'auto',
  userPreset      = null,
  autoPreset      = null
}) {
  try {
    // ── GUARD: modo desligado ────────────────────────────────────
    if (mode === 'off') return responseBase;

    // ── GUARD: modo manual sem preset ────────────────────────────
    if (mode === 'manual' && !userPreset) return responseBase;

    // ── GUARD: sarcasmo → não forçar venda ───────────────────────
    if (estadoEmocional.sarcasmo) return responseBase;

    // ── GUARD: resposta não apta para complemento ────────────────
    if (!shouldApplyComplement(responseBase)) return responseBase;

    // ── Resolver behavior ─────────────────────────────────────────
    const behavior = getBehaviorConfig({ mode, userPreset, autoPreset });
    if (!behavior) return responseBase;

    // ── Obter dados completos do preset (inclui .copy) ────────────
    const presetData = getActivePresetData({ mode, userPreset, autoPreset });

    // ── Selecionar copy baseado em estágio ────────────────────────
    const validStages = new Set(['descoberta','negociacao','fidelizacao','engajamento','objecao']);
    const stage = validStages.has(journeyStage) ? journeyStage : 'descoberta';
    const copyPhrase = getCopyByStage(presetData, stage, behavior.pressure);

    const activePresetKey = mode === 'manual'
      ? (userPreset  || 'default')
      : (autoPreset  || 'default');

    console.log(
      `⚔️ [SALES-LAYER v3] preset=${activePresetKey} | stage=${stage} | ` +
      `pressure=${behavior.pressure} | goal=${behavior.goal} | mode=${mode}`
    );

    return copyPhrase
      ? String(responseBase) + '\n\n' + copyPhrase
      : responseBase;

  } catch (err) {
    console.error('⚠️ [SALES-LAYER] Erro no pós-processamento (fallback):', err.message || err);
    return responseBase; // fallback absoluto: retorna resposta original intacta
  }
}

module.exports = applySalesLayer;
