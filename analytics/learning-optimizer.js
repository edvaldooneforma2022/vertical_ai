/**
 * 🎯 LEARNING OPTIMIZER — Auto-Learning V1.0
 * 
 * Otimização LEVE de respostas baseada em dados aprendidos.
 * NÃO substitui resposta original — apenas ajusta se dados disponíveis.
 * Qualquer erro → retorna resposta original intacta.
 * 
 * Controlado por: FEATURE_AUTO_LEARNING
 * Debug: DEBUG_LEARNING=true
 * 
 * @version 1.0.0
 */

const DEBUG = process.env.DEBUG_LEARNING === 'true';

// Limiar mínimo para ativar otimização
const MIN_SUCCESS_RATE = 0.3;
const TEST_MODE = process.env.AUTO_LEARNING_TEST_MODE === 'true';
const MIN_ATTEMPTS = TEST_MODE ? 2 : 10; // Test mode: 2 tentativas; prod: 10
const MIN_PATTERNS_TO_OPTIMIZE = TEST_MODE ? 3 : 50; // Em test mode: 3 padrões; prod: 50

function debugLog(...args) {
    if (DEBUG) {
        console.log('🎯 [LEARNING-OPTIMIZER]', ...args);
    }
}

class LearningOptimizer {
    constructor() {
        this.optimizationCount = 0;
        this.fallbackCount = 0;
        debugLog('Inicializado');
    }

    /**
     * Otimizar resposta com base em dados aprendidos
     * 
     * REGRA DE OURO: Se qualquer coisa falhar, retorna response original
     * 
     * @param {string} response - Resposta original da IA
     * @param {Object|null} learnedData - Dados do MemoryStore (pode ser null)
     * @param {Object} context - Contexto atual { intent, journeyStage, hasCTA }
     * @returns {string} Resposta otimizada ou original
     */
    enhance(response, learnedData, context = {}) {
        try {
            // Se não há dados aprendidos, retornar original
            if (!learnedData) {
                debugLog('Sem dados aprendidos, retornando original');
                return response;
            }

            // Verificar se temos dados suficientes para confiar
            if (learnedData.attempts < MIN_ATTEMPTS) {
                debugLog('Dados insuficientes (attempts:', learnedData.attempts, '), retornando original');
                return response;
            }

            // Verificar se a taxa de sucesso justifica otimização
            if (learnedData.successRate < MIN_SUCCESS_RATE) {
                debugLog('Success rate baixo:', learnedData.successRate, ', retornando original');
                return response;
            }

            let optimized = response;
            let changes = [];

            // --- Otimização 1: Reforço de CTA ---
            if (context.journeyStage === 'negociacao' && !this._hasCTA(response)) {
                optimized = this._addCTAReinforcement(optimized, learnedData);
                changes.push('cta_reinforcement');
            }

            // --- Otimização 2: Variação de copy baseada em top responses ---
            if (learnedData.topResponses && learnedData.topResponses.length > 0) {
                const inspiration = this._extractInspirations(learnedData.topResponses);
                if (inspiration) {
                    optimized = this._applyInspiration(optimized, inspiration);
                    changes.push('copy_variation');
                }
            }

            // --- Otimização 3: Reordenação de frases (CTA no final) ---
            if (this._hasCTA(optimized) && context.journeyStage === 'negociacao') {
                optimized = this._moveCTAToEnd(optimized);
                changes.push('cta_reorder');
            }

            // Verificar integridade da resposta otimizada
            if (!this._isValidResponse(optimized)) {
                debugLog('Resposta otimizada inválida, retornando original');
                this.fallbackCount++;
                return response;
            }

            this.optimizationCount++;
            debugLog('Resposta otimizada:', changes.join(', '));

            return optimized;
        } catch (err) {
            // REGRA DE OURO: qualquer erro → retorna original
            if (DEBUG) {
                console.warn('⚠️ [LEARNING-OPTIMIZER] Erro na otimização, usando original:', err.message);
            }
            this.fallbackCount++;
            return response;
        }
    }

    /**
     * Verificar se o sistema tem dados suficientes para otimizações
     */
    isReadyToOptimize(totalPatterns) {
        return totalPatterns >= MIN_PATTERNS_TO_OPTIMIZE;
    }

    /**
     * Retorna estatísticas
     */
    getStats() {
        return {
            optimizationCount: this.optimizationCount,
            fallbackCount: this.fallbackCount,
            optimizationRate: (this.optimizationCount + this.fallbackCount) > 0
                ? parseFloat((this.optimizationCount / (this.optimizationCount + this.fallbackCount)).toFixed(4))
                : 0
        };
    }

    // ===== MÉTODOS PRIVADOS =====

    _hasCTA(text) {
        if (!text) return false;
        const ctaPatterns = [
            /clique/i, /acesse/i, /compre/i, /adquira/i,
            /garanta/i, /aproveite/i, /confira/i, /saiba mais/i,
            /agende/i, /cadastre/i, /fale conosco/i,
            /https?:\/\//i
        ];
        return ctaPatterns.some(p => p.test(text));
    }

    _addCTAReinforcement(text, learnedData) {
        try {
            // Adicionar reforço sutil no final
            const reinforcements = [
                '\n\n💡 Posso te ajudar com mais detalhes!',
                '\n\n✨ Quer saber mais? Estou aqui!',
                '\n\n🎯 Quer que eu te ajude a dar o próximo passo?'
            ];

            // Escolher baseado no hash da resposta (determinístico, mas variado)
            const hash = text.length % reinforcements.length;
            return text + reinforcements[hash];
        } catch (err) {
            return text;
        }
    }

    _extractInspirations(topResponses) {
        try {
            if (!topResponses || topResponses.length === 0) return null;

            // Extrair padrões comuns das respostas que mais convertem
            const patterns = {
                startsWithEmoji: false,
                avgLength: 0,
                usesEmphasis: false,
                usesList: false
            };

            for (const resp of topResponses) {
                if (/^[\u{1F600}-\u{1F9FF}]|^[🎯✨💡🚀⭐❤️]/u.test(resp)) {
                    patterns.startsWithEmoji = true;
                }
                patterns.avgLength += resp.length;
                if (resp.includes('**') || resp.includes('__')) {
                    patterns.usesEmphasis = true;
                }
                if (resp.includes('\n-') || resp.includes('\n•') || resp.includes('\n✅')) {
                    patterns.usesList = true;
                }
            }

            patterns.avgLength = Math.round(patterns.avgLength / topResponses.length);

            return patterns;
        } catch (err) {
            return null;
        }
    }

    _applyInspiration(text, inspiration) {
        try {
            let result = text;

            // Se top responses usam ênfase e a resposta atual não tem
            if (inspiration.usesEmphasis && !text.includes('**')) {
                // Adicionar ênfase na primeira frase
                const firstDot = result.indexOf('.');
                if (firstDot > 10 && firstDot < 200) {
                    result = '**' + result.substring(0, firstDot) + '.**' + result.substring(firstDot + 1);
                }
            }

            return result;
        } catch (err) {
            return text;
        }
    }

    _moveCTAToEnd(text) {
        try {
            // Se a resposta tem links, garantir que o link está próximo do final
            const lines = text.split('\n');
            if (lines.length <= 2) return text;

            const ctaLines = [];
            const normalLines = [];

            for (const line of lines) {
                if (/https?:\/\/|clique|acesse|compre|garanta/i.test(line)) {
                    ctaLines.push(line);
                } else {
                    normalLines.push(line);
                }
            }

            if (ctaLines.length > 0 && normalLines.length > 0) {
                return [...normalLines, ...ctaLines].join('\n');
            }

            return text;
        } catch (err) {
            return text;
        }
    }

    _isValidResponse(text) {
        // Validação básica de integridade
        if (!text || typeof text !== 'string') return false;
        if (text.length < 10) return false;
        if (text.length > 10000) return false;
        return true;
    }
}

// Singleton
const learningOptimizer = new LearningOptimizer();

module.exports = {
    learningOptimizer,
    LearningOptimizer
};
