/**
 * ⚔️ SALES LAYER — Link Mágico V8.0
 *
 * Camada de pós-processamento EXCLUSIVAMENTE aditiva.
 * NUNCA altera o conteúdo base da resposta da IA.
 * NUNCA inventa informações, contexto ou produtos.
 * APENAS adiciona complementos persuasivos no final da resposta.
 *
 * Integração: chamada APÓS generateAIResponse(), protegida por FEATURE_SALES_LAYER.
 *
 * @version 1.0.0
 */

'use strict';

// ─────────────────────────────────────────────────────────────────
// MAPEAMENTO DE JORNADA (sistema usa: descoberta, negociacao, fidelizacao)
// ─────────────────────────────────────────────────────────────────
const STAGE_MAP = {
  descoberta:  'descoberta',
  negociacao:  'negociacao',
  fidelizacao: 'fidelizacao'
};

// ─────────────────────────────────────────────────────────────────
// NÍVEIS DE PRESSÃO
// ─────────────────────────────────────────────────────────────────
const PRESSURE_LEVELS = {
  leve:  1,
  medio: 2,
  alto:  3
};

// ─────────────────────────────────────────────────────────────────
// COMPLEMENTOS POR ESTÁGIO / EMOÇÃO / PRESSÃO
// ─────────────────────────────────────────────────────────────────

const COMPLEMENTS = {
  // ── Descoberta: leve curiosidade ──────────────────────────────
  descoberta: {
    default: [
      '\n\nIsso faz sentido para o que você busca?',
      '\n\nTem mais alguma dúvida que posso esclarecer?'
    ],
    duvida: [
      '\n\nIsso é mais comum do que parece — posso explicar com mais detalhes se quiser.',
      '\n\nFique à vontade para perguntar qualquer coisa, sem compromisso.'
    ]
  },

  // ── Negociação: interesse → decisão ───────────────────────────
  negociacao: {
    leve: [
      '\n\nFaz sentido para o seu caso até aqui?',
      '\n\nPosso te ajudar a entender melhor como isso funciona na prática?'
    ],
    medio: [
      '\n\nPelo que você descreveu, isso resolve exatamente o que você precisa. O que te impede de avançar agora?',
      '\n\nMuita gente que estava na mesma situação que você tomou essa decisão e não se arrependeu. Quer que eu te mostre como começar?'
    ],
    alto: [
      '\n\nVocê já viu funcionando. A única diferença agora é começar ou continuar como está.',
      '\n\nEssa janela não fica aberta para sempre. Se quiser garantir sua vaga agora, é só me dizer.'
    ],
    urgencia: [
      '\n\nSe você quer resolver isso hoje, o próximo passo é simples — quer que eu te guie?'
    ]
  },

  // ── Fidelização: suporte pós-compra ───────────────────────────
  fidelizacao: {
    default: [
      '\n\nSe tiver mais alguma dúvida sobre o uso, pode perguntar à vontade.',
      '\n\nEstou aqui para garantir que você aproveite o máximo disso.'
    ]
  }
};

// ─────────────────────────────────────────────────────────────────
// LÓGICA DE PRESSÃO PROGRESSIVA
// ─────────────────────────────────────────────────────────────────

/**
 * Define o nível de pressão com base na jornada e estado emocional.
 * @param {string} journeyStage
 * @param {object} estadoEmocional
 * @returns {'leve'|'medio'|'alto'}
 */
function calcPressureLevel(journeyStage, estadoEmocional) {
  if (journeyStage !== 'negociacao') return 'leve';
  if (estadoEmocional.urgencia)            return 'alto';
  if (estadoEmocional.emocaoPrimaria === 'confianca') return 'alto';
  if (estadoEmocional.emocaoPrimaria === 'interesse') return 'medio';
  return 'leve';
}

/**
 * Escolhe aleatoriamente um complemento de um array.
 * @param {string[]} arr
 * @returns {string}
 */
function pick(arr) {
  if (!arr || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─────────────────────────────────────────────────────────────────
// VALIDAÇÃO DE SEGURANÇA — garante que a camada só complementa
// ─────────────────────────────────────────────────────────────────

/**
 * Retorna false se a resposta base já é muito longa ou já tem CTA explícito.
 * Evita complementos redundantes ou em mensagens de erro.
 * @param {string} responseBase
 * @returns {boolean}
 */
function shouldApplyComplement(responseBase) {
  const base = String(responseBase || '');
  if (base.length < 20)   return false; // resposta vazia/erro
  if (base.length > 2000) return false; // resposta muito longa
  // Se já termina com pergunta ou CTA, não adiciona mais
  const lastChars = base.slice(-80).toLowerCase();
  if (lastChars.includes('?') || lastChars.includes('clique') || lastChars.includes('acesse')) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────
// FUNÇÃO PRINCIPAL — ponto único de entrada
// ─────────────────────────────────────────────────────────────────

/**
 * Aplica pós-processamento persuasivo sobre a resposta da IA base.
 *
 * @param {object} params
 * @param {string}  params.responseBase    — Resposta original da IA (NÃO É ALTERADA)
 * @param {string}  params.journeyStage    — "descoberta" | "negociacao" | "fidelizacao"
 * @param {object}  params.estadoEmocional — objeto com emocaoPrimaria, sarcasmo, urgencia
 * @param {string}  [params.mode]          — "auto" | "manual" | "off"
 * @param {string}  [params.preset]        — preset selecionado manualmente (ou null)
 * @param {number}  [params.pressureOverride] — força um nível de pressão (1-3, opcional)
 * @returns {string} Resposta final (base + complemento, ou só base em caso de erro/fallback)
 */
function applySalesLayer({
  responseBase,
  journeyStage     = 'descoberta',
  estadoEmocional  = {},
  mode             = 'auto',
  preset           = null,
  pressureOverride = null
}) {
  try {
    // ── GUARD: modo desligado ────────────────────────────────────
    if (mode === 'off') return responseBase;

    // ── GUARD: modo manual sem preset selecionado ────────────────
    if (mode === 'manual' && !preset) return responseBase;

    // ── GUARD: resposta não apta para complemento ────────────────
    if (!shouldApplyComplement(responseBase)) return responseBase;

    // ── GUARD: sarcasmo detectado → não forçar venda ────────────
    if (estadoEmocional.sarcasmo) return responseBase;

    const stage    = STAGE_MAP[journeyStage] || 'descoberta';
    const emotion  = (estadoEmocional.emocaoPrimaria || '').toLowerCase();
    const urgencia = Boolean(estadoEmocional.urgencia);

    // ── Calcular nível de pressão ────────────────────────────────
    let pressureName = calcPressureLevel(stage, estadoEmocional);
    if (pressureOverride) {
      const names = ['leve', 'medio', 'alto'];
      pressureName = names[Math.min(Math.max(pressureOverride - 1, 0), 2)];
    }

    // ── Selecionar complemento ───────────────────────────────────
    let complement = '';

    if (stage === 'descoberta') {
      if (emotion === 'duvida' && COMPLEMENTS.descoberta.duvida) {
        complement = pick(COMPLEMENTS.descoberta.duvida);
      } else {
        complement = pick(COMPLEMENTS.descoberta.default);
      }

    } else if (stage === 'negociacao') {
      if (urgencia && COMPLEMENTS.negociacao.urgencia) {
        complement = pick(COMPLEMENTS.negociacao.urgencia);
      } else {
        complement = pick(COMPLEMENTS.negociacao[pressureName] || COMPLEMENTS.negociacao.leve);
      }

    } else if (stage === 'fidelizacao') {
      complement = pick(COMPLEMENTS.fidelizacao.default);
    }

    // ── Montar resposta final ────────────────────────────────────
    const finalResponse = complement
      ? String(responseBase) + complement
      : responseBase;

    console.log(`⚔️ [SALES-LAYER] stage=${stage} | emotion=${emotion} | pressure=${pressureName} | urgencia=${urgencia} | mode=${mode}`);

    return finalResponse;

  } catch (err) {
    // FALLBACK ABSOLUTO: qualquer erro → retornar resposta original intacta
    console.error('⚠️ [SALES-LAYER] Erro no pós-processamento (fallback para resposta original):', err.message || err);
    return responseBase;
  }
}

module.exports = applySalesLayer;
