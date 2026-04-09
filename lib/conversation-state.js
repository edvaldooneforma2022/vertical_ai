/**
 * 🧠 CONVERSATION STATE V11 — MEMORY ENGINE (ANTI-BURRICE)
 * 
 * Mantém estado conversacional por sessão para evitar
 * que a IA repita perguntas, perca contexto ou force vendas.
 * 
 * REGRAS:
 * - 100% aditivo — não altera memória existente (SuperInteligência)
 * - Armazenamento in-memory (Map) — não depende de banco
 * - try/catch total — fallback para estado neutro
 * - Limpeza automática de sessões antigas (30min)
 * 
 * @version 11.0.0
 * @author Link Mágico Team
 */

// Estado conversacional por sessão (conversationId → state)
const _conversationStates = new Map();

// Limpeza automática a cada 10 minutos
const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10min
const MAX_STATE_AGE = 30 * 60 * 1000; // 30min sem atividade

setInterval(() => {
  try {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, state] of _conversationStates.entries()) {
      if (now - (state._lastUpdated || 0) > MAX_STATE_AGE) {
        _conversationStates.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[CONVERSATION-STATE] 🧹 ${cleaned} sessões expiradas removidas`);
    }
  } catch (_) {}
}, CLEANUP_INTERVAL);

/**
 * Resolve o estágio da conversa com base na intenção
 * @param {string} intent
 * @returns {string} - discovery | objection | decision | post_sale | neutral
 */
function resolveStage(intent) {
  switch (intent) {
    case 'buy':
      return 'decision';
    case 'interest':
      return 'consideration';
    case 'objection':
      return 'objection';
    case 'info':
      return 'discovery';
    case 'post_sale':
      return 'post_sale';
    case 'human':
      return 'escalation';
    case 'stress':
      return 'recovery';
    case 'checkout_issue':
      return 'support';
    default:
      return 'neutral';
  }
}

/**
 * Obtém o estado atual de uma conversa
 * @param {string} conversationId
 * @returns {Object} Estado conversacional
 */
function getState(conversationId) {
  try {
    if (!conversationId) return _createDefaultState();
    return _conversationStates.get(conversationId) || _createDefaultState();
  } catch (_) {
    return _createDefaultState();
  }
}

/**
 * Atualiza o estado conversacional
 * @param {string} conversationId
 * @param {string} intent - Intenção detectada
 * @param {string} message - Mensagem do usuário
 * @returns {Object} Estado atualizado
 */
function updateState(conversationId, intent, message) {
  try {
    if (!conversationId) return _createDefaultState();

    const currentState = _conversationStates.get(conversationId) || _createDefaultState();

    const newState = {
      ...currentState,
      lastIntent: intent || 'neutral',
      lastMessage: (message || '').substring(0, 200), // Limitar tamanho
      stage: resolveStage(intent),
      messageCount: (currentState.messageCount || 0) + 1,
      _lastUpdated: Date.now(),
      
      // Histórico de intents (últimos 5)
      intentHistory: [
        ...(currentState.intentHistory || []).slice(-4),
        intent || 'neutral'
      ]
    };

    _conversationStates.set(conversationId, newState);

    console.log(`[CONVERSATION-STATE] 📝 ${conversationId.substring(0, 8)}... → stage=${newState.stage} intent=${newState.lastIntent} msgs=${newState.messageCount}`);

    return newState;
  } catch (err) {
    console.warn('[CONVERSATION-STATE] ⚠️ Erro ao atualizar:', err.message);
    return _createDefaultState();
  }
}

/**
 * Gera contexto textual para injeção no prompt
 * @param {Object} state - Estado conversacional
 * @returns {string} Texto formatado para prompt
 */
function buildStateContext(state) {
  try {
    if (!state || !state.stage) return '';

    return `
[V11_CONVERSATION_STATE]
ESTADO DA CONVERSA:
- Estágio: ${state.stage}
- Última intenção: ${state.lastIntent || 'desconhecida'}
- Mensagens trocadas: ${state.messageCount || 0}
- Histórico de intenções: ${(state.intentHistory || []).join(' → ')}

REGRA: Adapte sua resposta ao estágio atual.
- discovery → explique com clareza
- consideration → aprofunde benefícios
- objection → resolva dúvidas antes de vender
- decision → facilite a compra
- post_sale → suporte, não venda
- escalation → direcione para humano
- neutral → responda naturalmente`;
  } catch (_) {
    return '';
  }
}

/**
 * Cria estado padrão
 * @private
 */
function _createDefaultState() {
  return {
    lastIntent: 'neutral',
    lastMessage: '',
    stage: 'neutral',
    messageCount: 0,
    intentHistory: [],
    _lastUpdated: Date.now()
  };
}

module.exports = { getState, updateState, buildStateContext, resolveStage };
