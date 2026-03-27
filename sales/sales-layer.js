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
// [F11] INTERCEPTADOR DE SAÍDA — impede despedida prematura
// ─────────────────────────────────────────────────────────────────

const EXIT_PATTERNS = [
  'até logo', 'tchau', 'depois vemos', 'qualquer coisa',
  'fico à disposição', 'fico a disposição', 'bom dia pra você',
  'boa sorte', 'sucesso pra você', 'estou aqui se precisar'
];

// Frases de recusa forte — não reengajar
const STRONG_REFUSAL = [
  'não quero', 'nao quero', 'não tenho interesse', 'nao tenho interesse',
  'para de me', 'não me interessa', 'cancela', 'sai fora'
];

function isExitResponse(text) {
  try {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();
    return EXIT_PATTERNS.some(e => lower.includes(e));
  } catch (_) { return false; }
}

// [FASE 1] Filtro contextual — só reengaja quando faz sentido
function shouldReengage(response, userMessage, messageCount) {
  try {
    if (!response) return false;

    // Só se for saída real da IA
    if (!isExitResponse(response)) return false;

    // Não aplicar se usuário demonstrou desinteresse forte
    if (userMessage) {
      const lowerUser = userMessage.toLowerCase();
      if (STRONG_REFUSAL.some(r => lowerUser.includes(r))) return false;
    }

    // Só aplicar após mínimo de interação (evita parecer insistente)
    if (messageCount < 2) return false;

    return true;
  } catch (_) { return false; }
}

// [FASE 2] Memória anti-repetição de reengajamento
const _reengagementMemory = new Map();

function alreadyReengaged(conversationId) {
  if (!conversationId) return false;
  return _reengagementMemory.has(conversationId);
}

function markReengaged(conversationId) {
  if (!conversationId) return;
  _reengagementMemory.set(conversationId, Date.now());
  // Limpar memória antiga (> 1h) para evitar memory leak
  if (_reengagementMemory.size > 500) {
    const oneHourAgo = Date.now() - 3600000;
    for (const [key, ts] of _reengagementMemory) {
      if (ts < oneHourAgo) _reengagementMemory.delete(key);
    }
  }
}

const REENGAGEMENT_PHRASES = [
  'Antes de sair, deixa eu te mostrar uma coisa rápida que pode mudar isso pra você.',
  'Só um segundo — tem algo aqui que talvez você não tenha visto ainda.',
  'Espera, antes de ir: isso aqui pode ser exatamente o que você precisa.'
];

function injectReengagement(response, profile, stage) {
  try {
    // Só aplica para perfil distraído ou respostas genéricas de saída
    if (profile !== 'distraido' && profile !== 'normal') return response;
    const phrase = REENGAGEMENT_PHRASES[Math.floor(Math.random() * REENGAGEMENT_PHRASES.length)];
    if (process.env.DEBUG_SALES === 'true') {
      console.log('🔄 [SALES-LAYER][F11] Reengajamento de saída aplicado');
    }
    return String(response) + '\n\n' + phrase;
  } catch (_) { return response; }
}

// ─────────────────────────────────────────────────────────────────
// [F12] ENFORCE LINK FORMAT — apenas DETECÇÃO (transformação no server)
// ─────────────────────────────────────────────────────────────────
// [FASE 4] A transformação real é feita pelo normalizeLinks no server.js
// Aqui apenas detectamos e logamos para debug

function enforceLinkFormat(response) {
  try {
    if (!response || typeof response !== 'string') return response;
    // Já tem link — não duplicar
    if (response.includes('wa.me')) return response;
    if (response.includes('<a ')) return response;

    // [FASE 4] Só logar detecção — normalizeLinks no server faz a conversão
    const lower = response.toLowerCase();
    if (
      (lower.includes('whatsapp') || lower.includes('zap')) &&
      !lower.includes('wa.me') &&
      !lower.includes('api.whatsapp.com')
    ) {
      if (process.env.DEBUG_SALES === 'true') {
        console.log('📱 [SALES-LAYER][F12] WhatsApp detectado sem link — normalizeLinks fará conversão');
      }
    }
    // Retorna SEM modificar — única fonte de verdade é normalizeLinks
    return response;
  } catch (_) { return response; }
}

// [FASE 5] Proteção contra CTA duplicado
function hasCTA(response) {
  try {
    if (!response) return false;
    const lower = response.toLowerCase();
    return (
      lower.includes('http') ||
      lower.includes('clique') ||
      lower.includes('acesse') ||
      lower.includes('wa.me')
    );
  } catch (_) { return false; }
}

// ─────────────────────────────────────────────────────────────────
// [F13] WRAPPER FINAL — aplica F11+F12 em qualquer saída
// ─────────────────────────────────────────────────────────────────

function applyFinalGuards(response, userMessage, messageCount, conversationId) {
  try {
    let result = response;

    // [F11] Exit guard — intercepcar despedidas com filtro contextual
    if (shouldReengage(result, userMessage, messageCount) && !alreadyReengaged(conversationId)) {
      const profile = detectUserProfile(userMessage);
      result = injectReengagement(result, profile, 'descoberta');
      markReengaged(conversationId);
    }

    // [F12] Enforce link format (apenas detecção/log)
    result = enforceLinkFormat(result);

    return result;
  } catch (_) { return response; }
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
  autoPreset      = null,
  decision        = null
}) {
  // [F13] Guardar userMessage para applyFinalGuards
  const _userMsg = userMessage;
  // [F10] Safe wrapper global
  try {

    // ── GUARDS básicos ────────────────────────────────────────────
    if (mode === 'off') return responseBase;
    if (mode === 'manual' && !userPreset) return responseBase;
    if (estadoEmocional.sarcasmo) return responseBase;
    if (!shouldApplyComplement(responseBase)) return responseBase;

    // ── 🧠 [DECISION-ENGINE] Camada inteligente (APENAS modo auto) ──────
    // Se decision existe e mode === 'auto', usa decisão estratégica.
    // Se decision === null, fluxo F0-F13 original continua idêntico.
    if (decision && mode === 'auto') {
      try {
        const isV2 = decision._source === 'decision-engine-v2';
        const { intent, action, urgency, nextStep, context } = decision;

        // ══════════════════════════════════════════════════════════
        // 🧠 [V2] LÓGICA AVANÇADA — Strategy-based (quando V2 ativo)
        // ══════════════════════════════════════════════════════════
        if (isV2 && decision.strategy) {
          const { strategy, pressure, confidence } = decision;

          // [V2] FECHAR — intent=comprar OU strategy=fechar
          if (strategy === 'fechar' || (intent === 'comprar' && confidence >= 0.6)) {
            let closingMsg = 'Perfeito! Vou te mostrar como começar agora:';
            if (context && context.price) {
              closingMsg = `Ótimo! O investimento é ${context.price}. Vou te mostrar como garantir agora:`;
            } else if (context && context.benefit) {
              closingMsg = `Perfeito! ${context.benefit}. Vou te mostrar como começar:`;
            }
            console.log(`🧠 [DE-V2] strategy=fechar (confidence=${confidence}) → fechamento com checkout`);
            return String(responseBase) + '\n\n' + closingMsg;
          }

          // [V2] RETER — intent=sair, strategy=reter
          if (strategy === 'reter') {
            const reengPhrases = [
              'Antes de sair, deixa eu te mostrar algo rápido que pode mudar isso pra você.',
              'Só um segundo — tem algo aqui que talvez você não tenha visto ainda.',
              'Espera, antes de ir: isso aqui pode ser exatamente o que você precisa.'
            ];
            const reengPhrase = reengPhrases[Math.floor(Math.random() * reengPhrases.length)];
            console.log(`🧠 [DE-V2] strategy=reter (pressure=${pressure}) → reengajamento`);
            return String(responseBase) + '\n\n' + reengPhrase;
          }

          // [V2] QUEBRAR OBJEÇÃO — com contexto real
          if (strategy === 'quebrar_objecao') {
            if (context && context.benefit) {
              const proofMsg = `Entendo sua preocupação. Olha só: ${context.benefit}. Isso faz sentido pra você?`;
              console.log(`🧠 [DE-V2] strategy=quebrar_objecao → prova com contexto`);
              return String(responseBase) + '\n\n' + proofMsg;
            }
            // Sem contexto → cai pro fluxo F0-F13
          }

          // [V2] ENGAJAR — pressão média, CTA suave
          if (strategy === 'engajar' && decision.action === 'CTA') {
            console.log(`🧠 [DE-V2] strategy=engajar + CTA → empurrando pra próximo passo`);
            return String(responseBase) + '\n\nIsso faz sentido pra você? Posso te mostrar como funciona na prática.';
          }

          if (process.env.DEBUG_SALES === 'true') {
            console.log(`🧠 [DE-V2] Passthrough → fluxo F0-F13 (strategy=${strategy}, action=${decision.action})`);
          }
          // Se nenhum caso V2 especial → cai no fluxo F0-F13 normalmente
        }

        // ══════════════════════════════════════════════════════════
        // 🧠 [V1] LÓGICA ORIGINAL — Intent-based (fallback)
        // ══════════════════════════════════════════════════════════
        if (!isV2) {

          // [FASE 7] REENGAJAMENTO INTELIGENTE: se intent === 'sair', NUNCA despedida neutra
          if (intent === 'sair') {
            const reengPhrases = [
              'Antes de sair, deixa eu te mostrar algo rápido que pode mudar isso pra você.',
              'Só um segundo — tem algo aqui que talvez você não tenha visto ainda.',
              'Espera, antes de ir: isso aqui pode ser exatamente o que você precisa.'
            ];
            const reengPhrase = reengPhrases[Math.floor(Math.random() * reengPhrases.length)];
            console.log('🧠 [DECISION-ENGINE] Intent=sair → reengajamento forçado');
            return String(responseBase) + '\n\n' + reengPhrase;
          }

          // [FASE 6] PRIORIDADE CHECKOUT: se quer comprar e nextStep é checkout
          if (intent === 'comprar' && nextStep === 'checkout') {
            let closingMsg = 'Perfeito! Vou te mostrar como começar agora:';
            if (context && context.price) {
              closingMsg = `Ótimo! O investimento é ${context.price}. Vou te mostrar como garantir agora:`;
            } else if (context && context.benefit) {
              closingMsg = `Perfeito! ${context.benefit}. Vou te mostrar como começar:`;
            }
            console.log('🧠 [DECISION-ENGINE] Intent=comprar → fechamento com checkout');
            return String(responseBase) + '\n\n' + closingMsg;
          }

          // [FASE 3] OBJEÇÃO INTELIGENTE: provar com contexto real
          if (intent === 'objecao' && context && context.benefit) {
            const proofMsg = `Entendo sua preocupação. Olha só: ${context.benefit}. Isso faz sentido pra você?`;
            console.log('🧠 [DECISION-ENGINE] Intent=objecao → prova com contexto');
            return String(responseBase) + '\n\n' + proofMsg;
          }

          if (process.env.DEBUG_SALES === 'true') {
            console.log(`🧠 [DECISION-ENGINE] Passthrough → fluxo F0-F13 (intent=${intent}, action=${action})`);
          }
        }
        // Se nenhum caso especial, cai no fluxo F0-F13 normalmente
      } catch (_decisionErr) {
        // Safe mode: qualquer erro no decision → fluxo original
        console.warn('⚠️ [DECISION-ENGINE] Erro no sales-layer (fallback F0-F13):', _decisionErr.message);
      }
    }

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

    if (process.env.DEBUG_SALES === 'true') {
      console.log(
        `⚔️ [SALES-LAYER v4] preset=${activePresetKey} | stage=${stage} | ` +
        `pressure=${activePressure} | mode=${mode} | msgs=${count}`
      );
    }

    const _preReturn = copyPhrase
      ? String(responseBase) + '\n\n' + copyPhrase
      : responseBase;

    // [F13] WRAPPER FINAL — aplica F11 (exit guard) + F12 (enforce links)
    return applyFinalGuards(_preReturn, _userMsg, count, conversationId);

  } catch (err) {
    // [F10] Safe wrapper global — nunca perde a resposta original
    console.error('⚠️ [SALES-LAYER] Erro geral (fallback absoluto):', err.message || err);
    return responseBase;
  }
}

module.exports = applySalesLayer;
