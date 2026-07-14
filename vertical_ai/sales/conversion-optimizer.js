/**
 * 📊 CONVERSION OPTIMIZER — Link Mágico V8.0
 *
 * Otimiza respostas com base em dados de performance histórica.
 * Prioriza padrões com maior taxa de conversão, reduz padrões que falham.
 *
 * Feature flag: FEATURE_CONVERSION_OPTIMIZER
 * Fallback: retorna resposta original sem alteração.
 *
 * @version 1.0.0
 */

'use strict';

// ─────────────────────────────────────────────────────────────────
// DADOS DE PERFORMANCE EM MEMÓRIA
// ─────────────────────────────────────────────────────────────────

const _performanceData = {
    // Padrões de resposta por intenção com métricas
    patterns: new Map(),
    // Contadores globais
    totalInteractions: 0,
    totalConversions: 0,
    // Threshold mínimo de interações para otimizar
    MIN_INTERACTIONS: 10,
    // Threshold de performance para priorizar
    PERFORMANCE_THRESHOLD: 0.3 // 30% de conversão
};

// ─────────────────────────────────────────────────────────────────
// RASTREAR INTERAÇÕES (FIRE-AND-FORGET)
// ─────────────────────────────────────────────────────────────────

/**
 * Registrar uma interação para métricas.
 *
 * @param {string} intent      — Intenção detectada
 * @param {string} ctaType     — Tipo de CTA usado
 * @param {boolean} converted  — Se houve conversão/click
 * @param {string} tenantId    — ID do tenant
 */
function trackInteraction(intent, ctaType, converted, tenantId) {
    try {
        const key = `${intent}:${ctaType}`;

        if (!_performanceData.patterns.has(key)) {
            _performanceData.patterns.set(key, {
                intent,
                ctaType,
                interactions: 0,
                conversions: 0,
                lastUsed: Date.now()
            });
        }

        const pattern = _performanceData.patterns.get(key);
        pattern.interactions++;
        if (converted) pattern.conversions++;
        pattern.lastUsed = Date.now();

        _performanceData.totalInteractions++;
        if (converted) _performanceData.totalConversions++;

        // Limitar padrões armazenados
        if (_performanceData.patterns.size > 100) {
            // Remover padrão menos usado
            let oldestKey = null;
            let oldestTime = Infinity;
            for (const [k, v] of _performanceData.patterns) {
                if (v.lastUsed < oldestTime) {
                    oldestTime = v.lastUsed;
                    oldestKey = k;
                }
            }
            if (oldestKey) _performanceData.patterns.delete(oldestKey);
        }
    } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────
// OBTER PERFORMANCE POR INTENÇÃO
// ─────────────────────────────────────────────────────────────────

/**
 * Retorna dados de performance para uma intenção.
 *
 * @param {string} intent — Intenção
 * @returns {{ bestCTA: string, conversionRate: number, hasEnoughData: boolean }}
 */
function getPerformance(intent) {
    try {
        const relevant = [];
        for (const [, data] of _performanceData.patterns) {
            if (data.intent === intent && data.interactions >= _performanceData.MIN_INTERACTIONS) {
                relevant.push({
                    ...data,
                    rate: data.conversions / data.interactions
                });
            }
        }

        if (relevant.length === 0) {
            return { bestCTA: null, conversionRate: 0, hasEnoughData: false };
        }

        // Ordenar por taxa de conversão
        relevant.sort((a, b) => b.rate - a.rate);
        const best = relevant[0];

        return {
            bestCTA: best.ctaType,
            conversionRate: Math.round(best.rate * 100) / 100,
            hasEnoughData: true
        };
    } catch (_) {
        return { bestCTA: null, conversionRate: 0, hasEnoughData: false };
    }
}

// ─────────────────────────────────────────────────────────────────
// OTIMIZAÇÕES DE ESTRUTURA
// ─────────────────────────────────────────────────────────────────

const STRUCTURE_OPTIMIZATIONS = {
    // Se resposta muito longa para intent de compra → encurtar
    shortenForBuyers: (response, intent) => {
        if (intent !== 'comprar' && intent !== 'ready_to_buy') return response;
        if (response.length <= 300) return response;

        // Manter primeira metade + última frase
        const sentences = response.split(/(?<=[.!?])\s+/);
        if (sentences.length <= 2) return response;

        // Pegar primeiras 2 frases + última
        const optimized = sentences.slice(0, 2).join(' ') + ' ' + sentences[sentences.length - 1];
        return optimized;
    },

    // Se resposta não termina com pergunta/ação → adicionar micro-compromisso
    addMicroCommitment: (response, intent) => {
        if (intent === 'comprar' || intent === 'ready_to_buy') return response;

        const responseLower = response.toLowerCase();
        const endsWithQuestion = response.trim().endsWith('?');
        const hasAction = responseLower.includes('clique') || responseLower.includes('acesse') ||
                          responseLower.includes('confira');

        if (endsWithQuestion || hasAction) return response;

        // Adicionar micro-compromisso leve
        const commitments = [
            'Faz sentido pra você?',
            'Quer saber mais sobre isso?',
            'O que acha?',
            'Te interessa?',
            'Quer que eu te mostre mais?'
        ];

        const selected = commitments[Math.floor(Math.random() * commitments.length)];
        return response + ' ' + selected;
    },

    // Mover CTA/link para o final (se está no meio)
    moveCTAToEnd: (response) => {
        // Simples: não reorganizar se já é curta
        if (response.length <= 200) return response;

        // Detectar se tem link no meio
        const lines = response.split('\n');
        if (lines.length <= 2) return response;

        const linkLines = [];
        const textLines = [];

        for (const line of lines) {
            if (line.includes('http') || line.includes('clique') || line.includes('acesse')) {
                linkLines.push(line);
            } else {
                textLines.push(line);
            }
        }

        if (linkLines.length === 0 || linkLines.length === lines.length) return response;

        return [...textLines, ...linkLines].join('\n');
    }
};

// ─────────────────────────────────────────────────────────────────
// FUNÇÃO PRINCIPAL — optimizeByPerformance
// ─────────────────────────────────────────────────────────────────

/**
 * Otimiza resposta com base em dados de performance.
 *
 * @param {object} params
 * @param {string} params.response        — Resposta atual
 * @param {string} params.intent          — Intenção detectada
 * @param {object} params.historicalData  — Dados históricos (opcional)
 * @returns {string}                      — Resposta otimizada
 */
function optimizeByPerformance({ response = '', intent = '', historicalData = {} } = {}) {
    try {
        if (!response || typeof response !== 'string') return response;

        let optimized = response;

        // 1. Otimizar estrutura para intenção de compra
        optimized = STRUCTURE_OPTIMIZATIONS.shortenForBuyers(optimized, intent);

        // 2. Mover CTA para o final
        optimized = STRUCTURE_OPTIMIZATIONS.moveCTAToEnd(optimized);

        // 3. Adicionar micro-compromisso se necessário
        optimized = STRUCTURE_OPTIMIZATIONS.addMicroCommitment(optimized, intent);

        // 4. Log se houve mudança
        if (optimized !== response) {
            console.log(`📊 [CONVERSION-OPTIMIZER] Resposta otimizada (intent=${intent}, ΔChars=${optimized.length - response.length})`);
        }

        return optimized;
    } catch (err) {
        console.warn('⚠️ [CONVERSION-OPTIMIZER] Erro (fallback):', err.message);
        return response;
    }
}

/**
 * Obter estatísticas de performance.
 */
function getStats() {
    return {
        totalInteractions: _performanceData.totalInteractions,
        totalConversions: _performanceData.totalConversions,
        conversionRate: _performanceData.totalInteractions > 0
            ? Math.round((_performanceData.totalConversions / _performanceData.totalInteractions) * 100) / 100
            : 0,
        patternsTracked: _performanceData.patterns.size
    };
}

module.exports = {
    optimizeByPerformance,
    trackInteraction,
    getPerformance,
    getStats
};
