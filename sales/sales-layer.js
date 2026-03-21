/**
 * ⚔️ SALES LAYER — Link Mágico V8.0
 *
 * Camada de pós-processamento EXCLUSIVAMENTE aditiva.
 * NUNCA altera o conteúdo base da resposta da IA.
 * NUNCA inventa informações, contexto ou produtos.
 * APENAS adiciona complementos persuasivos no final da resposta.
 *
 * Integração: chamada APÓS generateAIResponse(), protegida por FEATURE_SALES_LAYER.
 * Comportamento controlado por PRESETS (sales/presets.js).
 *
 * @version 2.0.0 — com suporte a presets multi-nicho
 */

'use strict';

const { getPreset } = require('./presets');

// ─────────────────────────────────────────────────────────────────
// MAPEAMENTO DE JORNADA (sistema usa: descoberta, negociacao, fidelizacao)
// ─────────────────────────────────────────────────────────────────
const VALID_STAGES = new Set(['descoberta', 'negociacao', 'fidelizacao']);

// ─────────────────────────────────────────────────────────────────
// BANCO DE COMPLEMENTOS — indexados por pressão e objective
// ─────────────────────────────────────────────────────────────────

const COMPLEMENTS = {

  // ── pressure: low ─────────────────────────────────────────────
  low: {
    assist: [
      '\n\nTem mais alguma dúvida que posso esclarecer?',
      '\n\nIsso faz sentido para você até aqui?'
    ],
    lead: [
      '\n\nSe quiser receber mais detalhes, posso te ajudar a dar o primeiro passo.',
      '\n\nQuer que eu te mostre como acessar isso sem compromisso?'
    ],
    educativo: [
      '\n\nIsso é mais comum do que parece — posso explicar melhor se quiser.',
      '\n\nFique à vontade para perguntar qualquer coisa.'
    ]
  },

  // ── pressure: medium ──────────────────────────────────────────
  medium: {
    assist: [
      '\n\nFaz sentido para o seu caso? Posso continuar explicando.',
      '\n\nO que você achou até aqui?'
    ],
    schedule: [
      '\n\nPosso te ajudar a dar o próximo passo agora — quer que eu te guie?',
      '\n\nMuita gente na mesma situação que você resolveu agendando uma conversa rápida. Quer tentar?'
    ],
    conversion: [
      '\n\nPelo que você descreveu, isso resolve exatamente o que você precisa. O que te impede de avançar?',
      '\n\nMuita gente que estava na mesma dúvida tomou essa decisão e não se arrependeu. Faz sentido para você?'
    ]
  },

  // ── pressure: high ────────────────────────────────────────────
  high: {
    conversion: [
      '\n\nVocê já viu o valor. A única diferença agora é começar — ou continuar como está.',
      '\n\nQuem tomou essa decisão hoje não perdeu tempo. Quer garantir sua vaga agora?',
      '\n\nEssa oferta não fica aberta para sempre. Se faz sentido, o momento é esse.'
    ],
    schedule: [
      '\n\nSe você quer resolver isso hoje, o próximo passo é simples. Quer que eu te guie?',
      '\n\nUma conversa rápida já resolve o que você precisa — quer agendar agora?'
    ]
  },

  // ── urgência detectada (sobrepõe pressão) ─────────────────────
  urgency: [
    '\n\nSe você precisa resolver isso agora, eu posso te ajudar a dar o próximo passo hoje mesmo.',
    '\n\nEntendo a urgência — vamos resolver isso direto.'
  ],

  // ── dúvida detectada (complemento especial) ───────────────────
  duvida: [
    '\n\nIsso é mais comum do que parece — posso explicar exatamente como isso funciona no seu caso.',
    '\n\nFaz todo sentido ter essa dúvida. Deixa eu te mostrar como funciona na prática.'
  ],

  // ── fidelização — suporte pós-compra ─────────────────────────
  fidelizacao: [
    '\n\nSe tiver mais alguma dúvida sobre o uso, pode perguntar à vontade.',
    '\n\nEstou aqui para garantir que você aproveite o máximo disso.'
  ]
};

// ─────────────────────────────────────────────────────────────────
// RESOLVER COMPORTAMENTO A PARTIR DO PRESET
// ─────────────────────────────────────────────────────────────────

/**
 * Retorna o behavior config ativo com base no modo e preset.
 * @param {object} opts
 * @param {string} opts.mode         — 'auto' | 'manual' | 'off'
 * @param {string} [opts.userPreset] — preset escolhido manualmente
 * @param {string} [opts.autoPreset] — preset detectado automaticamente
 * @returns {{ pressure, style, goal, urgency } | null}
 */
function getBehaviorConfig({ mode, userPreset, autoPreset }) {
  try {
    if (mode === 'off') return null;

    if (mode === 'manual' && userPreset) {
      return getPreset(userPreset).behavior;
    }

    if (mode === 'auto' || !mode) {
      const key = autoPreset || 'default';
      return getPreset(key).behavior;
    }

    return getPreset('default').behavior;

  } catch (err) {
    console.warn('⚠️ [SALES-LAYER] getBehaviorConfig falhou (fallback default):', err.message);
    return getPreset('default').behavior;
  }
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function pick(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Retorna false se a resposta base não deve receber complemento.
 */
function shouldApplyComplement(responseBase) {
  const base = String(responseBase || '');
  if (base.length < 20)   return false;
  if (base.length > 2000) return false;
  const lastChars = base.slice(-100).toLowerCase();
  if (lastChars.includes('?'))       return false;
  if (lastChars.includes('clique'))  return false;
  if (lastChars.includes('acesse'))  return false;
  if (lastChars.includes('compre'))  return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────
// SELEÇÃO DE COMPLEMENTO
// ─────────────────────────────────────────────────────────────────

/**
 * Escolhe o complemento mais adequado baseado no behavior e estado emocional.
 */
function chooseComplement({ behavior, journeyStage, estadoEmocional }) {
  const emotion  = (estadoEmocional.emocaoPrimaria || '').toLowerCase();
  const urgencia = Boolean(estadoEmocional.urgencia || behavior.urgency);
  const pressure = behavior.pressure || 'medium';
  const goal     = behavior.goal     || 'assist';

  // Fidelização → sempre suporte, sem pressão
  if (journeyStage === 'fidelizacao') {
    return pick(COMPLEMENTS.fidelizacao);
  }

  // Urgência → complemento de urgência (sobrepõe pressão)
  if (urgencia && journeyStage !== 'descoberta') {
    return pick(COMPLEMENTS.urgency);
  }

  // Dúvida → complemento de esclarecimento
  if (emotion === 'duvida' && journeyStage === 'descoberta') {
    return pick(COMPLEMENTS.duvida);
  }

  // Selecionar de acordo com pressão + goal
  const pressureBank = COMPLEMENTS[pressure];
  if (!pressureBank) return pick(COMPLEMENTS.low.assist);

  const goalBank = pressureBank[goal] || pressureBank.assist || pressureBank.conversion;
  if (!goalBank) {
    // fallback: pegar qualquer array disponível nessa pressão
    const fallbackArr = Object.values(pressureBank)[0];
    return pick(fallbackArr);
  }

  return pick(goalBank);
}

// ─────────────────────────────────────────────────────────────────
// FUNÇÃO PRINCIPAL — ponto único de entrada
// ─────────────────────────────────────────────────────────────────

/**
 * Aplica pós-processamento persuasivo sobre a resposta da IA base.
 *
 * @param {object} params
 * @param {string}  params.responseBase    — Resposta original da IA (NUNCA alterada)
 * @param {string}  params.journeyStage    — "descoberta" | "negociacao" | "fidelizacao"
 * @param {object}  params.estadoEmocional — { emocaoPrimaria, sarcasmo, urgencia, ... }
 * @param {string}  [params.mode]          — "auto" | "manual" | "off" (default: "auto")
 * @param {string}  [params.userPreset]    — preset selecionado manualmente
 * @param {string}  [params.autoPreset]    — preset detectado automaticamente
 * @returns {string} Resposta final ou responseBase em caso de erro/fallback
 */
function applySalesLayer({
  responseBase,
  journeyStage     = 'descoberta',
  estadoEmocional  = {},
  mode             = 'auto',
  userPreset       = null,
  autoPreset       = null
}) {
  try {
    // ── GUARD: modo desligado ────────────────────────────────────
    if (mode === 'off') return responseBase;

    // ── GUARD: modo manual sem preset ────────────────────────────
    if (mode === 'manual' && !userPreset) return responseBase;

    // ── GUARD: resposta não apta para complemento ────────────────
    if (!shouldApplyComplement(responseBase)) return responseBase;

    // ── GUARD: sarcasmo → não forçar venda ───────────────────────
    if (estadoEmocional.sarcasmo) return responseBase;

    // ── Resolver comportamento via preset ─────────────────────────
    const behavior = getBehaviorConfig({ mode, userPreset, autoPreset });
    if (!behavior) return responseBase; // mode === 'off'

    const stage = VALID_STAGES.has(journeyStage) ? journeyStage : 'descoberta';

    // ── Selecionar complemento ───────────────────────────────────
    const complement = chooseComplement({ behavior, journeyStage: stage, estadoEmocional });

    const activePreset = mode === 'manual'
      ? (userPreset || 'default')
      : (autoPreset || 'default');

    console.log(
      `⚔️ [SALES-LAYER v2] preset=${activePreset} | stage=${stage} | ` +
      `pressure=${behavior.pressure} | goal=${behavior.goal} | mode=${mode}`
    );

    return complement
      ? String(responseBase) + complement
      : responseBase;

  } catch (err) {
    console.error('⚠️ [SALES-LAYER] Erro no pós-processamento (fallback):', err.message || err);
    return responseBase;
  }
}

module.exports = applySalesLayer;
