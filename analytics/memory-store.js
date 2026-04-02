/**
 * 💾 MEMORY STORE — Auto-Learning V1.0
 * 
 * Armazenamento leve das melhores respostas por padrão.
 * Usa JSON local com política LRU para limpeza automática.
 * 
 * Controlado por: FEATURE_AUTO_LEARNING
 * Debug: DEBUG_LEARNING=true
 * 
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'learning');
const PATTERNS_FILE = path.join(DATA_DIR, 'patterns.json');
const MAX_ENTRIES = 1000;
const TOP_RESPONSES_PER_PATTERN = 3;
const DEBUG = process.env.DEBUG_LEARNING === 'true';

function debugLog(...args) {
    if (DEBUG) {
        console.log('💾 [MEMORY-STORE]', ...args);
    }
}

class MemoryStore {
    constructor() {
        this.store = new Map();
        this.accessOrder = []; // Para LRU
        this.initialized = false;

        try {
            this._load();
            this.initialized = true;
            debugLog('Inicializado com', this.store.size, 'padrões');
        } catch (err) {
            console.warn('⚠️ [MEMORY-STORE] Falha ao inicializar:', err.message);
        }
    }

    /**
     * Armazenar dados aprendidos para um padrão
     * @param {string} intent 
     * @param {string} profile 
     * @param {string} journeyStage 
     * @param {Object} data - { successRate, topResponses, metadata }
     */
    store_pattern(intent, profile, journeyStage, data) {
        try {
            if (!this.initialized) return false;

            const key = this._makeKey(intent, profile, journeyStage);

            const entry = {
                key,
                intent: intent || 'unknown',
                profile: profile || 'unknown',
                journeyStage: journeyStage || 'unknown',
                successRate: data.successRate || 0,
                topResponses: (data.topResponses || []).slice(0, TOP_RESPONSES_PER_PATTERN),
                attempts: data.attempts || 0,
                conversions: data.conversions || 0,
                lastUpdated: new Date().toISOString(),
                accessCount: 0
            };

            this.store.set(key, entry);
            this._touchLRU(key);

            // Limitar tamanho
            this._enforceLRU();

            // Salvar
            this._save();

            debugLog('Padrão armazenado:', key, 'successRate:', entry.successRate);
            return true;
        } catch (err) {
            if (DEBUG) {
                console.warn('⚠️ [MEMORY-STORE] Erro ao armazenar:', err.message);
            }
            return false;
        }
    }

    /**
     * Obter dados aprendidos para um contexto
     * Retorna null se não houver dados suficientes
     * 
     * @param {string} intent 
     * @param {string} profile 
     * @param {string} journeyStage 
     * @returns {Object|null}
     */
    getLearnedData(intent, profile, journeyStage) {
        try {
            if (!this.initialized) return null;

            const key = this._makeKey(intent, profile, journeyStage);
            const entry = this.store.get(key);

            if (!entry) {
                // Tentar match parcial (sem profile)
                const fallbackKey = this._makeKey(intent, 'unknown', journeyStage);
                const fallbackEntry = this.store.get(fallbackKey);

                if (!fallbackEntry) {
                    debugLog('Nenhum dado aprendido para:', key);
                    return null;
                }

                this._touchLRU(fallbackKey);
                fallbackEntry.accessCount++;
                return this._formatOutput(fallbackEntry);
            }

            this._touchLRU(key);
            entry.accessCount++;

            debugLog('Dados aprendidos encontrados:', key, 'successRate:', entry.successRate);
            return this._formatOutput(entry);
        } catch (err) {
            if (DEBUG) {
                console.warn('⚠️ [MEMORY-STORE] Erro ao buscar:', err.message);
            }
            return null;
        }
    }

    /**
     * Atualizar store com dados do performance engine
     * @param {Array} scores - Lista de scores do PerformanceEngine
     */
    updateFromScores(scores) {
        try {
            if (!this.initialized || !Array.isArray(scores)) return;

            let updated = 0;
            for (const score of scores) {
                if (score.successRate > 0 && score.attempts >= 5) {
                    this.store_pattern(
                        score.intent,
                        'unknown', // Profile genérico
                        score.journeyStage,
                        {
                            successRate: score.successRate,
                            topResponses: score.topResponses || [],
                            attempts: score.attempts,
                            conversions: score.conversions
                        }
                    );
                    updated++;
                }
            }

            debugLog(`Store atualizado com ${updated} padrões do PerformanceEngine`);
        } catch (err) {
            if (DEBUG) {
                console.warn('⚠️ [MEMORY-STORE] Erro ao atualizar do scores:', err.message);
            }
        }
    }

    /**
     * Retorna estatísticas do store
     */
    getStats() {
        try {
            const entries = Array.from(this.store.values());
            return {
                totalPatterns: this.store.size,
                maxEntries: MAX_ENTRIES,
                avgSuccessRate: entries.length > 0
                    ? parseFloat((entries.reduce((s, e) => s + e.successRate, 0) / entries.length).toFixed(4))
                    : 0,
                totalAccesses: entries.reduce((s, e) => s + e.accessCount, 0),
                mostAccessed: entries.length > 0
                    ? entries.sort((a, b) => b.accessCount - a.accessCount)[0]?.key
                    : null
            };
        } catch (err) {
            return { totalPatterns: 0, maxEntries: MAX_ENTRIES };
        }
    }

    // ===== MÉTODOS PRIVADOS =====

    _makeKey(intent, profile, journeyStage) {
        return `${intent || 'unknown'}::${profile || 'unknown'}::${journeyStage || 'unknown'}`;
    }

    _formatOutput(entry) {
        return {
            successRate: entry.successRate,
            topResponses: entry.topResponses,
            attempts: entry.attempts,
            conversions: entry.conversions,
            intent: entry.intent,
            journeyStage: entry.journeyStage
        };
    }

    _touchLRU(key) {
        // Mover para o final (mais recente)
        const idx = this.accessOrder.indexOf(key);
        if (idx !== -1) {
            this.accessOrder.splice(idx, 1);
        }
        this.accessOrder.push(key);
    }

    _enforceLRU() {
        while (this.store.size > MAX_ENTRIES && this.accessOrder.length > 0) {
            const oldestKey = this.accessOrder.shift();
            this.store.delete(oldestKey);
            debugLog('LRU: removido padrão antigo:', oldestKey);
        }
    }

    _load() {
        try {
            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
            }

            if (fs.existsSync(PATTERNS_FILE)) {
                const data = fs.readFileSync(PATTERNS_FILE, 'utf8');
                const parsed = JSON.parse(data);

                if (parsed && parsed.entries && typeof parsed.entries === 'object') {
                    for (const [key, value] of Object.entries(parsed.entries)) {
                        this.store.set(key, value);
                    }
                    this.accessOrder = parsed.accessOrder || Object.keys(parsed.entries);
                }
            }
        } catch (err) {
            console.warn('⚠️ [MEMORY-STORE] Erro ao carregar:', err.message);
        }
    }

    _save() {
        try {
            if (!fs.existsSync(DATA_DIR)) {
                fs.mkdirSync(DATA_DIR, { recursive: true });
            }

            const obj = {
                entries: {},
                accessOrder: this.accessOrder,
                lastSaved: new Date().toISOString()
            };

            for (const [key, value] of this.store) {
                obj.entries[key] = value;
            }

            fs.writeFileSync(PATTERNS_FILE, JSON.stringify(obj, null, 2));
            debugLog('Padrões salvos em disco');
        } catch (err) {
            console.warn('⚠️ [MEMORY-STORE] Erro ao salvar:', err.message);
        }
    }
}

// Singleton
const memoryStore = new MemoryStore();

module.exports = {
    memoryStore,
    MemoryStore
};
