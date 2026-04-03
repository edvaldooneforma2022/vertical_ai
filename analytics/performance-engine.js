/**
 * 📊 PERFORMANCE ENGINE — Auto-Learning V1.0
 * 
 * Analisa padrões de conversão e gera scores de performance.
 * Execução assíncrona/lazy — NUNCA bloqueia o fluxo principal.
 * 
 * Controlado por: FEATURE_AUTO_LEARNING
 * Debug: DEBUG_LEARNING=true
 * 
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'learning');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');
const MAX_PATTERNS = 1000;
const TEST_MODE = process.env.AUTO_LEARNING_TEST_MODE === 'true';
const RECALC_THRESHOLD = TEST_MODE ? 5 : 100; // Test mode: recálculo a cada 5 eventos
const RECALC_INTERVAL_MS = TEST_MODE ? 60000 : 3600000; // Test mode: 1 min; prod: 1 hora
const MIN_SAMPLES_FOR_SCORE = TEST_MODE ? 1 : 3; // Test mode: 1 amostra basta
const DEBUG = process.env.DEBUG_LEARNING === 'true';

function debugLog(...args) {
    if (DEBUG) {
        console.log('📊 [PERFORMANCE-ENGINE]', ...args);
    }
}

class PerformanceEngine {
    constructor() {
        this.patterns = new Map();
        this.lastRecalcCount = 0;
        this.eventsSinceRecalc = 0;
        this.initialized = false;
        this.recalcTimer = null;

        try {
            this._loadScores();
            this._startRecalcTimer();
            this.initialized = true;
            debugLog('Inicializado com', this.patterns.size, 'padrões');
        } catch (err) {
            console.warn('⚠️ [PERFORMANCE-ENGINE] Falha ao inicializar:', err.message);
        }
    }

    /**
     * Processar registros do tracker e calcular scores
     * @param {Array} records - Registros do ConversationTracker
     */
    processRecords(records) {
        try {
            if (!this.initialized || !Array.isArray(records)) return;

            debugLog('Processando', records.length, 'registros');

            // Agrupar por padrão
            const groups = new Map();

            for (const record of records) {
                const patternKey = this._generatePatternKey(record);
                if (!patternKey) continue;

                if (!groups.has(patternKey)) {
                    groups.set(patternKey, {
                        pattern: patternKey,
                        intent: record.detectedIntent || 'unknown',
                        journeyStage: record.journeyStage || 'unknown',
                        hasCTA: record.hasCTA || false,
                        total: 0,
                        converted: 0,
                        clicks: 0,
                        schedules: 0,
                        leads: 0,
                        whatsapp: 0,
                        sampleResponses: []
                    });
                }

                const group = groups.get(patternKey);
                group.total++;

                const hasConversion = record.actions &&
                    (record.actions.clicked || record.actions.scheduled ||
                     record.actions.leadCaptured || record.actions.whatsappOpened);

                if (hasConversion) {
                    group.converted++;
                    if (record.actions.clicked) group.clicks++;
                    if (record.actions.scheduled) group.schedules++;
                    if (record.actions.leadCaptured) group.leads++;
                    if (record.actions.whatsappOpened) group.whatsapp++;

                    // Guardar resposta que converteu (top 5)
                    if (group.sampleResponses.length < 5 && record.aiResponse) {
                        group.sampleResponses.push(record.aiResponse);
                    }
                }
            }

            // Calcular scores
            for (const [key, group] of groups) {
                if (group.total < MIN_SAMPLES_FOR_SCORE) continue;

                const score = {
                    pattern: group.pattern,
                    intent: group.intent,
                    journeyStage: group.journeyStage,
                    hasCTA: group.hasCTA,
                    successRate: parseFloat((group.converted / group.total).toFixed(4)),
                    attempts: group.total,
                    conversions: group.converted,
                    breakdown: {
                        clicks: group.clicks,
                        schedules: group.schedules,
                        leads: group.leads,
                        whatsapp: group.whatsapp
                    },
                    topResponses: group.sampleResponses,
                    lastUpdated: new Date().toISOString()
                };

                this.patterns.set(key, score);
            }

            // Limitar número de padrões
            this._enforceLimit();

            // Salvar
            this._saveScores();

            debugLog('Scores calculados:', this.patterns.size, 'padrões');
        } catch (err) {
            if (DEBUG) {
                console.warn('⚠️ [PERFORMANCE-ENGINE] Erro ao processar:', err.message);
            }
        }
    }

    /**
     * Notificar novo evento (para saber quando recalcular)
     */
    notifyEvent() {
        this.eventsSinceRecalc++;
    }

    /**
     * Verificar se precisa recalcular
     */
    needsRecalc() {
        return this.eventsSinceRecalc >= RECALC_THRESHOLD;
    }

    /**
     * Resetar contador de recálculo
     */
    resetRecalcCounter() {
        this.eventsSinceRecalc = 0;
    }

    /**
     * Obter score de um padrão específico
     */
    getScore(intent, journeyStage) {
        try {
            const key = `${intent || 'unknown'}::${journeyStage || 'unknown'}`;
            return this.patterns.get(key) || null;
        } catch (err) {
            return null;
        }
    }

    /**
     * Obter os top N padrões com melhor performance
     */
    getTopPatterns(n = 10) {
        try {
            const sorted = Array.from(this.patterns.values())
                .filter(p => p.attempts >= MIN_SAMPLES_FOR_SCORE)
                .sort((a, b) => b.successRate - a.successRate);
            return sorted.slice(0, n);
        } catch (err) {
            return [];
        }
    }

    /**
     * Obter estatísticas gerais
     */
    getStats() {
        try {
            const patterns = Array.from(this.patterns.values());
            const totalAttempts = patterns.reduce((sum, p) => sum + p.attempts, 0);
            const totalConversions = patterns.reduce((sum, p) => sum + p.conversions, 0);

            return {
                totalPatterns: this.patterns.size,
                totalAttempts,
                totalConversions,
                avgSuccessRate: totalAttempts > 0
                    ? parseFloat((totalConversions / totalAttempts).toFixed(4))
                    : 0,
                eventsSinceRecalc: this.eventsSinceRecalc,
                topPattern: patterns.length > 0
                    ? patterns.sort((a, b) => b.successRate - a.successRate)[0]
                    : null
            };
        } catch (err) {
            return { totalPatterns: 0, totalAttempts: 0, totalConversions: 0 };
        }
    }

    // ===== MÉTODOS PRIVADOS =====

    _generatePatternKey(record) {
        try {
            const intent = record.detectedIntent || 'unknown';
            const stage = record.journeyStage || 'unknown';
            return `${intent}::${stage}`;
        } catch (err) {
            return null;
        }
    }

    _enforceLimit() {
        if (this.patterns.size <= MAX_PATTERNS) return;

        // Remover padrões com menos amostras
        const sorted = Array.from(this.patterns.entries())
            .sort((a, b) => a[1].attempts - b[1].attempts);

        const toRemove = sorted.slice(0, this.patterns.size - MAX_PATTERNS);
        for (const [key] of toRemove) {
            this.patterns.delete(key);
        }

        debugLog(`Limite aplicado: removidos ${toRemove.length} padrões com menos amostras`);
    }

    _loadScores() {
        try {
            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
            }

            if (fs.existsSync(SCORES_FILE)) {
                const data = fs.readFileSync(SCORES_FILE, 'utf8');
                const parsed = JSON.parse(data);
                if (parsed && typeof parsed === 'object') {
                    for (const [key, value] of Object.entries(parsed)) {
                        this.patterns.set(key, value);
                    }
                }
            }
        } catch (err) {
            console.warn('⚠️ [PERFORMANCE-ENGINE] Erro ao carregar scores:', err.message);
        }
    }

    _saveScores() {
        try {
            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
            }

            const obj = {};
            for (const [key, value] of this.patterns) {
                obj[key] = value;
            }

            fs.writeFileSync(SCORES_FILE, JSON.stringify(obj, null, 2));
            debugLog('Scores salvos em disco');
        } catch (err) {
            console.warn('⚠️ [PERFORMANCE-ENGINE] Erro ao salvar scores:', err.message);
        }
    }

    _startRecalcTimer() {
        this.recalcTimer = setInterval(() => {
            if (this.eventsSinceRecalc > 0) {
                debugLog('Recálculo periódico agendado');
                // O recálculo em si será chamado pelo index.js
            }
        }, RECALC_INTERVAL_MS);

        if (this.recalcTimer.unref) {
            this.recalcTimer.unref();
        }
    }

    destroy() {
        if (this.recalcTimer) {
            clearInterval(this.recalcTimer);
            this.recalcTimer = null;
        }
    }
}

// Singleton
const performanceEngine = new PerformanceEngine();

module.exports = {
    performanceEngine,
    PerformanceEngine
};
