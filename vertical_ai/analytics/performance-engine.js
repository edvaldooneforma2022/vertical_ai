/**
 * 📊 PERFORMANCE ENGINE — Auto-Learning V2.0
 * 
 * Analisa padrões de conversão e gera scores de performance.
 * Execução assíncrona/lazy — NUNCA bloqueia o fluxo principal.
 * 
 * V2.0: Persistência em banco de dados (PostgreSQL/SQLite)
 *       com fallback automático para JSON no filesystem.
 * 
 * NÃO IMPACTA: fluxo de vendas (⚡/🎛️/⚫), billing, auth, CRM
 * 
 * Controlado por: FEATURE_AUTO_LEARNING
 * Debug: DEBUG_LEARNING=true
 * 
 * @version 2.0.0
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'learning');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');
const MAX_PATTERNS = 1000;
const TEST_MODE = process.env.AUTO_LEARNING_TEST_MODE === 'true';
const RECALC_THRESHOLD = TEST_MODE ? 5 : 100;
const RECALC_INTERVAL_MS = TEST_MODE ? 60000 : 3600000;
const MIN_SAMPLES_FOR_SCORE = TEST_MODE ? 1 : 3;
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
        this.dbAdapter = null; // V2.0: Injetado pelo index.js

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
     * V2.0: Injetar DB adapter para persistência em banco
     */
    setDbAdapter(adapter) {
        try {
            this.dbAdapter = adapter;
            if (adapter && adapter.isAvailable()) {
                debugLog('DB Adapter injetado — persistência em banco ativa');
                // Carregar do banco se ainda vazio
                if (this.patterns.size === 0) {
                    this._loadFromDb();
                }
            }
        } catch (err) {
            debugLog('Erro ao configurar DB adapter:', err.message);
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

    notifyEvent() {
        this.eventsSinceRecalc++;
    }

    needsRecalc() {
        return this.eventsSinceRecalc >= RECALC_THRESHOLD;
    }

    resetRecalcCounter() {
        this.eventsSinceRecalc = 0;
    }

    getScore(intent, journeyStage) {
        try {
            const key = `${intent || 'unknown'}::${journeyStage || 'unknown'}`;
            return this.patterns.get(key) || null;
        } catch (err) {
            return null;
        }
    }

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
                    : null,
                dbPersistence: !!(this.dbAdapter && this.dbAdapter.isAvailable())
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

    /**
     * V2.0: Carregar scores do banco (assíncrono)
     */
    _loadFromDb() {
        if (!this.dbAdapter || !this.dbAdapter.isAvailable()) return;

        setImmediate(async () => {
            try {
                const dbPatterns = await this.dbAdapter.loadScores();
                if (dbPatterns && dbPatterns.size > 0) {
                    // Mesclar: banco tem prioridade
                    for (const [key, value] of dbPatterns) {
                        if (!this.patterns.has(key)) {
                            this.patterns.set(key, value);
                        }
                    }
                    debugLog(`Mesclados ${dbPatterns.size} scores do banco`);
                }
            } catch (err) {
                debugLog('Erro ao carregar scores do banco (não crítico):', err.message);
            }
        });
    }

    _saveScores() {
        // V2.0: Salvar no banco (prioridade)
        if (this.dbAdapter && this.dbAdapter.isAvailable()) {
            this.dbAdapter.saveScores(this.patterns).then(saved => {
                if (saved) {
                    debugLog('Scores salvos no banco');
                }
            }).catch(err => {
                debugLog('Erro ao salvar scores no banco, fallback JSON:', err.message);
                this._saveScoresToJson();
            });
        } else {
            this._saveScoresToJson();
        }
    }

    /**
     * Fallback: salvar scores em JSON
     */
    _saveScoresToJson() {
        try {
            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
            }

            const obj = {};
            for (const [key, value] of this.patterns) {
                obj[key] = value;
            }

            fs.writeFileSync(SCORES_FILE, JSON.stringify(obj, null, 2));
            debugLog('Scores salvos em disco (JSON)');
        } catch (err) {
            console.warn('⚠️ [PERFORMANCE-ENGINE] Erro ao salvar scores:', err.message);
        }
    }

    _startRecalcTimer() {
        this.recalcTimer = setInterval(() => {
            if (this.eventsSinceRecalc > 0) {
                debugLog('Recálculo periódico agendado');
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
