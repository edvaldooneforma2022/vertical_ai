/**
 * 🔥 V14.0 — ADAPTIVE LAYER
 * 
 * Aplica pesos de otimização em runtime.
 * Ajusta variações de resposta baseado em dados reais.
 * 
 * NÃO ALTERA: intent, rule engine, checkout.
 * SÓ AJUSTA: texto da resposta (template/variação).
 * 
 * @version 14.0.0
 * @requires FEATURE_V14_SELF_OPTIMIZING=true
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════
// ADAPTIVE LAYER — Ajusta respostas em runtime
// ═══════════════════════════════════════════════════════════════════

// Templates adaptativos por strategy
const ADAPTIVE_TEMPLATES = {
    // ═══ OBJECTION — Estratégias ═══
    OBJECTION: {
        neutral: [
            'Entendo totalmente. Posso te mostrar algo que pode fazer sentido?',
            'Faz sentido sua preocupação. Quer que eu te mostre por que vale a pena?'
        ],
        aggressive: [
            'Olha, entendo que parece alto — mas o resultado que as pessoas têm é surreal. Quer ver?',
            'Entendo 100%. Mas pensa: quanto custa NÃO resolver isso? Posso te mostrar uma opção?'
        ],
        accelerate: [
            'Entendo. E se eu te mostrar uma condição especial que pode funcionar melhor pra você?',
            'Faz sentido. Deixa eu te mostrar algo que pode mudar sua visão 👇'
        ]
    },
    // ═══ INTEREST — Estratégias ═══
    INTEREST: {
        neutral: [
            'Legal que você se interessou! Quer saber mais detalhes?',
            'Boa! Posso te explicar como funciona na prática?'
        ],
        accelerate: [
            'Você veio no momento certo! Quer que eu te mande o acesso direto?',
            'Perfeito! Muita gente que começou perguntando assim já tá usando. Quer ver como acessar?'
        ],
        reinforce: [
            'Excelente escolha! Esse é o que mais tem dado resultado. Quer o acesso?',
            'Boa visão! Quem testou já sentiu diferença. Posso te mandar o link?'
        ]
    },
    // ═══ DOUBT — Estratégias ═══
    DOUBT: {
        neutral: [
            'Boa pergunta! Deixa eu te explicar.'
        ],
        optimize: [
            'Ótima pergunta — e a resposta é bem simples.'
        ]
    },
    // ═══ READY_TO_BUY — Estratégias ═══
    READY_TO_BUY: {
        neutral: [
            'Perfeito — já te mando o acesso 👇'
        ],
        reinforce: [
            'Boa decisão! Aqui está o acesso direto 👇'
        ]
    }
};

/**
 * Aplica adaptação na resposta baseado nos pesos
 * @param {string} intent - Intent classificado
 * @param {string} baseText - Texto base do Response Builder
 * @param {Object} weights - Pesos do Optimization Engine
 * @returns {{ adapted: boolean, text: string, strategy: string }}
 */
function adaptResponse(intent, baseText, weights = {}) {
    try {
        const intentWeight = weights[intent];
        
        // Se não tem peso para esse intent → retorna original
        if (!intentWeight || !intentWeight.strategy) {
            return { adapted: false, text: baseText, strategy: 'none' };
        }

        const strategy = intentWeight.strategy;
        const templates = ADAPTIVE_TEMPLATES[intent];

        // Se não tem templates para esse intent → retorna original
        if (!templates) {
            return { adapted: false, text: baseText, strategy };
        }

        const strategyTemplates = templates[strategy] || templates['neutral'];
        if (!strategyTemplates || strategyTemplates.length === 0) {
            return { adapted: false, text: baseText, strategy };
        }

        // Selecionar template aleatório dentro da estratégia
        const selected = strategyTemplates[Math.floor(Math.random() * strategyTemplates.length)];

        // Só adaptar se o template tiver pelo menos 10 amostras (evitar noise)
        if (intentWeight.totalSamples < 10) {
            console.log(`[V14-ADAPTIVE] ⏸️ Amostras insuficientes para ${intent} (${intentWeight.totalSamples}/10)`);
            return { adapted: false, text: baseText, strategy: 'insufficient_data' };
        }

        console.log(`[V14-ADAPTIVE] 🔄 Adaptando ${intent}: strategy=${strategy} | weight=${intentWeight.weight} | conv=${intentWeight.convRate}%`);

        return {
            adapted: true,
            text: selected,
            strategy,
            originalText: baseText
        };

    } catch (err) {
        console.warn('[V14-ADAPTIVE] ⚠️ Erro (retornando original):', err.message);
        return { adapted: false, text: baseText, strategy: 'error' };
    }
}

/**
 * Verifica se deve acelerar para checkout (baseado em dados)
 * @param {string} intent - Intent atual
 * @param {Object} weights - Pesos
 * @returns {boolean}
 */
function shouldAccelerateCheckout(intent, weights = {}) {
    try {
        const w = weights[intent];
        if (!w) return false;

        // Se INTEREST tem alta conversão → acelerar
        if (intent === 'INTEREST' && w.strategy === 'accelerate') return true;
        
        // Se engajamento > 50% mas conversão < 10% → acelerar
        if (w.engRate > 50 && w.convRate < 10) return true;

        return false;
    } catch (_) {
        return false;
    }
}

/**
 * Retorna estatísticas para o dashboard
 */
function getAdaptiveStats(weights = {}) {
    const stats = {
        totalIntents: Object.keys(weights).length,
        strategies: {},
        topConverter: null,
        worstDropper: null
    };

    let maxConv = 0;
    let maxDrop = 0;

    for (const [intent, w] of Object.entries(weights)) {
        stats.strategies[intent] = w.strategy;
        if (w.convRate > maxConv) {
            maxConv = w.convRate;
            stats.topConverter = intent;
        }
        if (w.dropRate > maxDrop) {
            maxDrop = w.dropRate;
            stats.worstDropper = intent;
        }
    }

    return stats;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    adaptResponse,
    shouldAccelerateCheckout,
    getAdaptiveStats,
    ADAPTIVE_TEMPLATES
};
