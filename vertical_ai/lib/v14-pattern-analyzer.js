/**
 * 🔥 V14.0 — PATTERN ANALYZER + OPTIMIZATION ENGINE
 * 
 * Analisa padrões em conversas reais:
 * - Quais intents convertem mais?
 * - Quais intents abandonam mais?
 * - Gera pesos de otimização automáticos
 * 
 * Roda como cron (setInterval) a cada 10 minutos.
 * 
 * @version 14.0.0
 * @requires FEATURE_V14_SELF_OPTIMIZING=true
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════
// PATTERN ANALYZER
// ═══════════════════════════════════════════════════════════════════

// Cache em memória dos pesos (atualizado pelo cron)
let _optimizationWeights = {};
let _lastAnalysis = null;
let _analysisInterval = null;

/**
 * Analisa padrões dos últimos N logs
 * @param {Object} db - MongoDB
 * @param {number} hours - Período de análise (default: 24h)
 * @returns {Object} Relatório de padrões
 */
async function analyzePatterns(db, hours = 24) {
    try {
        if (!db) return null;

        const { getRecentLogs } = require('./v14-conversation-logger');
        const logs = await getRecentLogs(db, hours);

        if (logs.length < 5) {
            console.log(`[V14-ANALYZER] ⏸️ Dados insuficientes (${logs.length} logs) — mínimo 5`);
            return null;
        }

        // Agrupar por intent
        const intentStats = {};
        for (const log of logs) {
            const intent = log.intent || 'UNKNOWN';
            if (!intentStats[intent]) {
                intentStats[intent] = {
                    total: 0,
                    converted: 0,
                    dropped: 0,
                    support: 0,
                    engaged: 0,
                    withCheckout: 0
                };
            }
            const stats = intentStats[intent];
            stats.total++;
            if (log.hadCheckout) stats.withCheckout++;
            if (log.outcome) {
                if (log.outcome.converted) stats.converted++;
                if (log.outcome.dropped) stats.dropped++;
                if (log.outcome.askedForSupport) stats.support++;
                if (log.outcome.engaged) stats.engaged++;
            }
        }

        // Calcular taxas
        const report = {};
        for (const [intent, stats] of Object.entries(intentStats)) {
            report[intent] = {
                total: stats.total,
                conversionRate: stats.total > 0 ? (stats.converted / stats.total * 100).toFixed(1) : 0,
                dropRate: stats.total > 0 ? (stats.dropped / stats.total * 100).toFixed(1) : 0,
                engagementRate: stats.total > 0 ? (stats.engaged / stats.total * 100).toFixed(1) : 0,
                checkoutRate: stats.total > 0 ? (stats.withCheckout / stats.total * 100).toFixed(1) : 0,
                supportRate: stats.total > 0 ? (stats.support / stats.total * 100).toFixed(1) : 0
            };
        }

        _lastAnalysis = {
            timestamp: new Date(),
            totalLogs: logs.length,
            period: `${hours}h`,
            report
        };

        console.log(`[V14-ANALYZER] 📊 Análise concluída: ${logs.length} logs | intents: ${Object.keys(report).join(', ')}`);

        // Gerar pesos de otimização
        const weights = generateWeights(report);
        _optimizationWeights = weights;

        // Salvar no DB
        try {
            await db.collection('optimization_weights').updateOne(
                { type: 'current' },
                { $set: { weights, report, updatedAt: new Date() } },
                { upsert: true }
            );
            console.log('[V14-OPTIMIZER] 💾 Pesos salvos no DB');
        } catch (_) {}

        return { report, weights };

    } catch (err) {
        console.warn('[V14-ANALYZER] ⚠️ Erro na análise:', err.message);
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════
// OPTIMIZATION ENGINE — Gera pesos baseados nos padrões
// ═══════════════════════════════════════════════════════════════════

/**
 * Gera pesos de otimização baseados no relatório
 * @param {Object} report - Relatório do Pattern Analyzer
 * @returns {Object} Pesos por intent
 */
function generateWeights(report) {
    const weights = {};

    for (const [intent, stats] of Object.entries(report)) {
        const convRate = parseFloat(stats.conversionRate) || 0;
        const dropRate = parseFloat(stats.dropRate) || 0;
        const engRate = parseFloat(stats.engagementRate) || 0;

        let weight = 0;
        let strategy = 'mantain';

        // Alta conversão → reforçar (manter o que funciona)
        if (convRate > 30) {
            weight = 3;
            strategy = 'reinforce';
        }
        // Conversão média → otimizar levemente
        else if (convRate > 10) {
            weight = 1;
            strategy = 'optimize';
        }
        // Baixa conversão + alto abandono → resposta mais forte
        else if (dropRate > 50) {
            weight = -2;
            strategy = 'aggressive';
        }
        // Baixa conversão mas engajamento alto → acelerar para checkout
        else if (engRate > 50 && convRate < 10) {
            weight = 2;
            strategy = 'accelerate';
        }
        // Genérico → manter
        else {
            weight = 0;
            strategy = 'neutral';
        }

        weights[intent] = {
            weight,
            strategy,
            convRate,
            dropRate,
            engRate,
            totalSamples: stats.total
        };
    }

    return weights;
}

// ═══════════════════════════════════════════════════════════════════
// CRON — Roda análise periodicamente
// ═══════════════════════════════════════════════════════════════════

/**
 * Inicia o cron de análise (a cada 10 minutos)
 * @param {Object} db - MongoDB
 */
function startAnalysisCron(db) {
    if (_analysisInterval) {
        console.log('[V14-ANALYZER] ⚠️ Cron já ativo — ignorando');
        return;
    }

    const INTERVAL_MS = 10 * 60 * 1000; // 10 minutos

    // Primeira análise após 30 segundos
    setTimeout(() => {
        analyzePatterns(db).catch(err => {
            console.warn('[V14-ANALYZER] ⚠️ Primeira análise falhou:', err.message);
        });
    }, 30000);

    // Repetir a cada 10 minutos
    _analysisInterval = setInterval(() => {
        analyzePatterns(db).catch(err => {
            console.warn('[V14-ANALYZER] ⚠️ Análise cron falhou:', err.message);
        });
    }, INTERVAL_MS);

    console.log('[V14-ANALYZER] ✅ Cron iniciado (intervalo: 10min)');
}

/**
 * Para o cron
 */
function stopAnalysisCron() {
    if (_analysisInterval) {
        clearInterval(_analysisInterval);
        _analysisInterval = null;
        console.log('[V14-ANALYZER] ⏹️ Cron parado');
    }
}

/**
 * Retorna os pesos atuais (do cache em memória)
 */
function getCurrentWeights() {
    return _optimizationWeights;
}

/**
 * Retorna última análise
 */
function getLastAnalysis() {
    return _lastAnalysis;
}

/**
 * Carrega pesos do DB para memória (usar no boot)
 */
async function loadWeightsFromDB(db) {
    try {
        if (!db) return;
        const doc = await db.collection('optimization_weights').findOne({ type: 'current' });
        if (doc && doc.weights) {
            _optimizationWeights = doc.weights;
            console.log(`[V14-OPTIMIZER] ✅ Pesos carregados do DB: ${Object.keys(doc.weights).length} intents`);
        }
    } catch (err) {
        console.warn('[V14-OPTIMIZER] ⚠️ Erro ao carregar pesos:', err.message);
    }
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    analyzePatterns,
    generateWeights,
    startAnalysisCron,
    stopAnalysisCron,
    getCurrentWeights,
    getLastAnalysis,
    loadWeightsFromDB
};
