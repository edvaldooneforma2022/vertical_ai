/**
 * 🧠 V12 — SELF-HEALING ENGINE
 * 
 * Detecta quando algo deu errado na resposta da IA e corrige automaticamente.
 * 
 * Tipos de falha detectados:
 *   - MISSING_CHECKOUT: intent=buy + checkout disponível, mas não presente na resposta
 *   - WEAK_RESPONSE: resposta muito curta (< 30 chars)
 *   - LOW_CONFIDENCE: IA diz "não sei" / "não tenho"
 *   - WRONG_LINK: resposta tem link diferente do checkout correto
 *   - EMPTY_RESPONSE: resposta vazia
 * 
 * REGRAS:
 *   - 100% aditivo — não altera nenhum módulo existente
 *   - Protegido por FEATURE_V12_SELF_HEALING
 *   - try/catch total — fallback retorna resposta original
 *   - NÃO atua em modo manual/desligado
 * 
 * @version 12.0.0
 * @author Link Mágico Team
 */

// Contadores de healing (para aprendizado)
const _healingStats = new Map();

/**
 * Detecta tipo de falha na resposta
 * @param {Object} params
 * @param {string} params.response - Resposta da IA
 * @param {string} params.checkoutLink - Link de checkout correto
 * @param {string} params.intent - Intenção detectada
 * @param {string} params.message - Mensagem original do usuário
 * @returns {string|null} - Tipo de falha ou null se ok
 */
function detectFailure({ response, checkoutLink, intent, message }) {
    try {
        if (!response || response.trim().length === 0) {
            return 'EMPTY_RESPONSE';
        }

        if (response.trim().length < 30) {
            return 'WEAK_RESPONSE';
        }

        // Intent de compra SEM checkout na resposta
        if (intent === 'buy' && checkoutLink && !response.includes(checkoutLink)) {
            return 'MISSING_CHECKOUT';
        }

        // IA com baixa confiança
        const lowConfidencePatterns = [
            'não sei', 'não tenho', 'nao sei', 'nao tenho',
            'não posso', 'não consigo', 'infelizmente não',
            'não tenho informação', 'não encontrei'
        ];
        const responseLower = response.toLowerCase();
        if (lowConfidencePatterns.some(p => responseLower.includes(p))) {
            return 'LOW_CONFIDENCE';
        }

        // Resposta tem link mas é diferente do checkout
        if (checkoutLink && intent === 'buy') {
            const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
            const urls = response.match(urlRegex) || [];
            const wrongUrls = urls.filter(u => 
                !u.includes(checkoutLink.split('/')[2]) && // domínio diferente
                !u.includes('wa.me') &&
                !u.includes('instagram.com') &&
                !u.includes('facebook.com')
            );
            if (wrongUrls.length > 0 && !response.includes(checkoutLink)) {
                return 'WRONG_LINK';
            }
        }

        return null; // Nenhuma falha detectada
    } catch (err) {
        console.warn('[SELF-HEALING] ⚠️ Erro na detecção:', err.message);
        return null;
    }
}

/**
 * Corrige a resposta baseado no tipo de falha
 * @param {Object} params
 * @param {string} params.failureType - Tipo de falha
 * @param {string} params.response - Resposta original
 * @param {string} params.checkoutLink - Link de checkout
 * @param {string} params.apiKey - API key (para stats)
 * @returns {string} Resposta corrigida
 */
function healResponse({ failureType, response, checkoutLink, apiKey }) {
    try {
        // Registrar stats
        _trackHealing(apiKey, failureType);

        switch (failureType) {
            case 'MISSING_CHECKOUT':
                console.log('[SELF-HEALING] 🔧 Fix: MISSING_CHECKOUT — injetando link');
                if (checkoutLink) {
                    return `${response}\n\n👉 Para finalizar com segurança:\n${checkoutLink}`;
                }
                return response;

            case 'WEAK_RESPONSE':
                console.log('[SELF-HEALING] 🔧 Fix: WEAK_RESPONSE — expandindo');
                return `Deixa eu te explicar melhor 👇\n\n${response}\n\nPosso te ajudar com mais alguma dúvida?`;

            case 'LOW_CONFIDENCE':
                console.log('[SELF-HEALING] 🔧 Fix: LOW_CONFIDENCE — redirecionando');
                return `${response}\n\n💡 Posso te ajudar de outra forma ou te direcionar para atendimento personalizado. O que prefere?`;

            case 'WRONG_LINK':
                console.log('[SELF-HEALING] 🔧 Fix: WRONG_LINK — corrigindo link');
                if (checkoutLink) {
                    return `${response}\n\n✅ Link oficial e seguro:\n${checkoutLink}`;
                }
                return response;

            case 'EMPTY_RESPONSE':
                console.log('[SELF-HEALING] 🔧 Fix: EMPTY_RESPONSE — gerando fallback');
                return 'Obrigado pela mensagem! Como posso te ajudar hoje? 😊';

            default:
                return response;
        }
    } catch (err) {
        console.warn('[SELF-HEALING] ⚠️ Erro no healing (resposta original mantida):', err.message);
        return response;
    }
}

/**
 * Pipeline completo: detectar + corrigir
 * @param {Object} params
 * @returns {{ text: string, healed: boolean, failureType: string|null }}
 */
function applyHealing({ response, checkoutLink, intent, message, apiKey, mode }) {
    try {
        // Bypass em modo manual/off
        if (mode !== 'auto') {
            return { text: response, healed: false, failureType: null };
        }

        const failure = detectFailure({ response, checkoutLink, intent, message });
        
        if (!failure) {
            return { text: response, healed: false, failureType: null };
        }

        const healed = healResponse({ failureType: failure, response, checkoutLink, apiKey });

        console.log(`[SELF-HEALING] ✅ Correção aplicada: type=${failure} | tenant=${(apiKey || '').substring(0, 8)}...`);

        return {
            text: healed,
            healed: healed !== response,
            failureType: failure
        };
    } catch (err) {
        console.warn('[SELF-HEALING] ⚠️ Erro no pipeline (resposta original):', err.message);
        return { text: response, healed: false, failureType: null };
    }
}

/**
 * Registra healing para aprendizado
 * @private
 */
function _trackHealing(apiKey, failureType) {
    try {
        const key = `${apiKey || 'unknown'}::${failureType}`;
        _healingStats.set(key, (_healingStats.get(key) || 0) + 1);
    } catch (_) {}
}

/**
 * Retorna estatísticas de healing
 */
function getHealingStats(apiKey) {
    try {
        const stats = {};
        for (const [key, count] of _healingStats.entries()) {
            if (!apiKey || key.startsWith(apiKey)) {
                stats[key] = count;
            }
        }
        return stats;
    } catch (_) {
        return {};
    }
}

module.exports = { detectFailure, healResponse, applyHealing, getHealingStats };
