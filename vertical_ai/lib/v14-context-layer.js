/**
 * 🧠 V14 CONTEXT LAYER — Memória de Curto Prazo + Anti-Repetição + Coerência
 * 
 * Restaura comportamento humano da IA:
 *   1. Memória de curto prazo (últimas 10 mensagens por conversationId)
 *   2. Anti-repetição (detecta respostas duplicadas/genéricas)
 *   3. Contexto conversacional (injeção de resumo no prompt)
 *   4. Coerência de produto (persistência de info do produto)
 * 
 * REGRAS:
 *   - 100% aditivo — não altera V13, V16, ou pipeline existente
 *   - Protegido por FEATURE_V14_CONTEXT_LAYER (default: true)
 *   - try/catch total — fallback silencioso em caso de erro
 *   - NÃO altera decisões (V16 manda na decisão)
 *   - SÓ melhora contexto e comportamento da resposta
 * 
 * @version 14.1.0
 * @requires FEATURE_V14_CONTEXT_LAYER=true
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════
// MEMÓRIA DE CURTO PRAZO — Histórico por conversationId
// ═══════════════════════════════════════════════════════════════════

// Map: conversationId → { messages: [{role, content}], productInfo: {}, lastUpdated: timestamp }
const _conversationMemory = new Map();

const MAX_MESSAGES = 10;       // 5 pares (user + assistant)
const MAX_STATE_AGE = 30 * 60 * 1000;  // 30 minutos
const CLEANUP_INTERVAL = 10 * 60 * 1000; // Limpar a cada 10 min

// Limpeza automática de sessões expiradas
setInterval(() => {
    try {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, state] of _conversationMemory.entries()) {
            if (now - (state.lastUpdated || 0) > MAX_STATE_AGE) {
                _conversationMemory.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`[V14-CTX] 🧹 ${cleaned} sessões expiradas removidas (${_conversationMemory.size} ativas)`);
        }
    } catch (_) {}
}, CLEANUP_INTERVAL);

/**
 * Obtém o histórico de mensagens de uma conversa (formato LLM messages)
 * @param {string} conversationId 
 * @returns {Array<{role: string, content: string}>}
 */
function getHistory(conversationId) {
    try {
        if (!conversationId) return [];
        const state = _conversationMemory.get(conversationId);
        if (!state) return [];

        // Verificar expiração
        if (Date.now() - (state.lastUpdated || 0) > MAX_STATE_AGE) {
            _conversationMemory.delete(conversationId);
            return [];
        }

        return state.messages || [];
    } catch (_) {
        return [];
    }
}

/**
 * Adiciona uma mensagem ao histórico
 * @param {string} conversationId 
 * @param {string} role - 'user' ou 'assistant'
 * @param {string} content - Conteúdo da mensagem
 */
function addMessage(conversationId, role, content) {
    try {
        if (!conversationId || !content) return;

        let state = _conversationMemory.get(conversationId);
        if (!state) {
            state = {
                messages: [],
                productInfo: null,
                lastUpdated: Date.now()
            };
            _conversationMemory.set(conversationId, state);
        }

        // Limitar conteúdo para não estourar tokens
        const trimmedContent = String(content).substring(0, 500);

        // Limpar checkout blocks do conteúdo do assistant para não poluir histórico
        let cleanContent = trimmedContent;
        if (role === 'assistant') {
            cleanContent = cleanContent
                .replace(/━+\n?🚀.*?━+/gs, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
            // Se sobrou muito pouco, usar original
            if (cleanContent.length < 10) cleanContent = trimmedContent;
        }

        state.messages.push({ role, content: cleanContent });

        // Manter apenas últimas MAX_MESSAGES
        if (state.messages.length > MAX_MESSAGES) {
            state.messages = state.messages.slice(-MAX_MESSAGES);
        }

        state.lastUpdated = Date.now();

        console.log(`[V14-CTX] 📝 ${role} salvo | conv=${conversationId.substring(0, 8)}... | msgs=${state.messages.length}`);
    } catch (err) {
        console.warn('[V14-CTX] ⚠️ Erro ao salvar mensagem:', err.message);
    }
}

/**
 * Salva informações do produto para a sessão (extraído do pageData na primeira interação)
 * @param {string} conversationId
 * @param {Object} pageData
 */
function saveProductInfo(conversationId, pageData) {
    try {
        if (!conversationId || !pageData) return;

        let state = _conversationMemory.get(conversationId);
        if (!state) {
            state = { messages: [], productInfo: null, lastUpdated: Date.now() };
            _conversationMemory.set(conversationId, state);
        }

        // Só salvar na primeira vez (não sobrescrever)
        if (state.productInfo) return;

        state.productInfo = {
            title: pageData.title || null,
            description: (pageData.resumo || pageData.description || '').substring(0, 300) || null,
            url: pageData.url || null
        };

        console.log(`[V14-CTX] 📦 Product info salvo: "${state.productInfo.title || 'sem título'}" | conv=${conversationId.substring(0, 8)}...`);
    } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════════
// ANTI-REPETIÇÃO — Detecta respostas duplicadas/genéricas
// ═══════════════════════════════════════════════════════════════════

// Frases que NUNCA devem ser repetidas
const BANNED_REPEATS = [
    'já usou algo parecido',
    'ja usou algo parecido',
    'como posso ajudar',
    'como posso te ajudar',
    'o que você precisa',
    'me conta mais',
    'me fale mais',
    'posso te ajudar',
    'fico feliz em ajudar',
    'como posso ser útil',
    'estou aqui para ajudar'
];

/**
 * Verifica se a resposta é uma repetição ou frase genérica banida
 * @param {string} conversationId 
 * @param {string} proposedResponse 
 * @returns {{ isRepetition: boolean, reason: string|null }}
 */
function checkRepetition(conversationId, proposedResponse) {
    try {
        if (!proposedResponse) return { isRepetition: false, reason: null };

        const responseLower = proposedResponse.toLowerCase().trim();

        // 1. Verificar frases banidas
        for (const banned of BANNED_REPEATS) {
            if (responseLower.includes(banned)) {
                console.log(`[V14-CTX] 🚫 BANNED REPEAT: "${banned}"`);
                return { isRepetition: true, reason: `banned_phrase: ${banned}` };
            }
        }

        // 2. Verificar duplicata com respostas anteriores
        if (conversationId) {
            const history = getHistory(conversationId);
            const previousResponses = history
                .filter(m => m.role === 'assistant')
                .map(m => m.content.toLowerCase().trim());

            for (const prev of previousResponses) {
                // Similaridade simples: se >70% das palavras são iguais
                const similarity = _calculateSimilarity(responseLower, prev);
                if (similarity > 0.7) {
                    console.log(`[V14-CTX] 🚫 DUPLICATE (${(similarity * 100).toFixed(0)}% similar)`);
                    return { isRepetition: true, reason: `duplicate_response_${(similarity * 100).toFixed(0)}pct` };
                }
            }
        }

        return { isRepetition: false, reason: null };
    } catch (_) {
        return { isRepetition: false, reason: null };
    }
}

/**
 * Calcula similaridade entre duas strings (Jaccard por palavras)
 * @param {string} a 
 * @param {string} b 
 * @returns {number} 0-1
 */
function _calculateSimilarity(a, b) {
    try {
        const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2));
        const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2));
        if (wordsA.size === 0 || wordsB.size === 0) return 0;

        let intersection = 0;
        for (const w of wordsA) {
            if (wordsB.has(w)) intersection++;
        }

        const union = new Set([...wordsA, ...wordsB]).size;
        return union > 0 ? intersection / union : 0;
    } catch (_) {
        return 0;
    }
}

// ═══════════════════════════════════════════════════════════════════
// CONTEXTO CONVERSACIONAL — Injeção no prompt
// ═══════════════════════════════════════════════════════════════════

/**
 * Gera um bloco de contexto conversacional para injeção no system prompt
 * Informa à IA sobre o histórico da conversa para manter coerência
 * 
 * @param {string} conversationId 
 * @returns {string} Bloco de texto para system prompt (ou '' se sem histórico)
 */
function buildContextPrompt(conversationId) {
    try {
        if (!conversationId) return '';

        const state = _conversationMemory.get(conversationId);
        if (!state || !state.messages || state.messages.length === 0) return '';

        const messages = state.messages;
        const msgCount = messages.length;

        // Gerar resumo das últimas interações
        const recentPairs = [];
        for (let i = 0; i < messages.length; i += 2) {
            const userMsg = messages[i];
            const botMsg = messages[i + 1];
            if (userMsg && userMsg.role === 'user') {
                recentPairs.push({
                    user: userMsg.content.substring(0, 100),
                    bot: botMsg ? botMsg.content.substring(0, 100) : null
                });
            }
        }

        // Listar perguntas já feitas pelo bot (para anti-repetição)
        const botQuestions = messages
            .filter(m => m.role === 'assistant' && m.content.includes('?'))
            .map(m => {
                const questions = m.content.match(/[^.!]*\?/g);
                return questions ? questions[0].trim() : null;
            })
            .filter(Boolean)
            .slice(-3);

        // Info do produto
        let productContext = '';
        if (state.productInfo && state.productInfo.title) {
            productContext = `\nPRODUTO: "${state.productInfo.title}"`;
            if (state.productInfo.description) {
                productContext += ` — ${state.productInfo.description.substring(0, 150)}`;
            }
        }

        return `
[V14_CONTEXT — MEMÓRIA DA CONVERSA]
Esta conversa já tem ${msgCount} mensagens trocadas.${productContext}

HISTÓRICO RECENTE:
${recentPairs.slice(-3).map((p, i) => 
    `${i + 1}. Usuário: "${p.user}"${p.bot ? `\n   Você respondeu: "${p.bot}"` : ''}`
).join('\n')}

${botQuestions.length > 0 ? `\nPERGUNTAS QUE VOCÊ JÁ FEZ (NÃO REPITA):
${botQuestions.map(q => `- "${q}"`).join('\n')}` : ''}

REGRAS DE CONTINUIDADE:
- NÃO repita perguntas que já fez
- NÃO peça informações que o usuário já deu
- Responda DIRETAMENTE ao que foi perguntado agora
- Mantenha coerência com o que já foi conversado
- Se o usuário perguntar algo sobre o produto, responda baseado no contexto acima`;
    } catch (_) {
        return '';
    }
}

/**
 * Retorna histórico formatado como messages para o LLM
 * (formato exato que os LLMs esperam: [{role, content}, ...])
 * 
 * @param {string} conversationId 
 * @param {number} limit - Número máximo de mensagens (default: 6)
 * @returns {Array<{role: string, content: string}>}
 */
function getMessagesForLLM(conversationId, limit = 6) {
    try {
        const history = getHistory(conversationId);
        if (!history || history.length === 0) return [];

        // Pegar últimas N mensagens
        return history.slice(-limit).map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content
        }));
    } catch (_) {
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════════
// STATS — Para debug/monitoramento
// ═══════════════════════════════════════════════════════════════════

function getStats() {
    return {
        activeSessions: _conversationMemory.size,
        totalMessages: Array.from(_conversationMemory.values())
            .reduce((sum, s) => sum + (s.messages?.length || 0), 0)
    };
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    getHistory,
    addMessage,
    saveProductInfo,
    checkRepetition,
    buildContextPrompt,
    getMessagesForLLM,
    getStats
};
