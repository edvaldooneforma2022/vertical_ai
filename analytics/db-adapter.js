/**
 * 🗄️ DB ADAPTER — Auto-Learning V2.0
 * 
 * Camada de persistência que salva/carrega dados do auto-learning
 * no banco de dados (PostgreSQL ou SQLite).
 * 
 * REGRA DE OURO: Qualquer falha → fallback silencioso → zero impacto
 * 
 * Controlado por: FEATURE_LEARNING_DB_PERSISTENCE (default: true)
 * Debug: DEBUG_LEARNING=true
 * 
 * NÃO IMPACTA: fluxo de vendas (⚡/🎛️/⚫), billing, auth, CRM, whatsapp
 * 
 * @version 2.0.0
 */

const DEBUG = process.env.DEBUG_LEARNING === 'true';
const FEATURE_ENABLED = process.env.FEATURE_LEARNING_DB_PERSISTENCE !== 'false'; // default: true

function debugLog(...args) {
    if (DEBUG) {
        console.log('🗄️ [LEARNING-DB]', ...args);
    }
}

class LearningDbAdapter {
    constructor(db, usePostgres) {
        this.db = db;
        this.usePostgres = usePostgres;
        this.initialized = false;

        if (!db) {
            debugLog('DB não disponível — modo fallback (JSON)');
            return;
        }

        if (!FEATURE_ENABLED) {
            debugLog('FEATURE_LEARNING_DB_PERSISTENCE desativado — modo fallback (JSON)');
            return;
        }

        this.initialized = true;
        debugLog('Inicializado com', usePostgres ? 'PostgreSQL' : 'SQLite');
    }

    // ========================================
    // CONVERSATIONS (learning_conversations)
    // ========================================

    /**
     * Salvar batch de registros de conversa
     * @param {Array} records - Array de objetos de registro do ConversationTracker
     * @returns {boolean} true se salvou com sucesso
     */
    async saveConversations(records) {
        if (!this.initialized || !records || records.length === 0) return false;

        try {
            let saved = 0;
            for (const record of records) {
                try {
                    const links = typeof record.links === 'string' 
                        ? record.links 
                        : JSON.stringify(record.links || []);

                    if (this.usePostgres) {
                        await this.db.query(
                            `INSERT INTO learning_conversations 
                             (id, conversation_id, user_message, ai_response, detected_intent, 
                              journey_stage, profile, has_cta, links, emotional_state, 
                              api_key, robot_name, action_clicked, action_scheduled, 
                              action_lead_captured, action_whatsapp_opened, created_at)
                             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
                             ON CONFLICT (id) DO UPDATE SET
                              action_clicked = $13, action_scheduled = $14,
                              action_lead_captured = $15, action_whatsapp_opened = $16`,
                            [
                                record.id,
                                record.conversationId || null,
                                record.userMessage || '',
                                record.aiResponse || '',
                                record.detectedIntent || null,
                                record.journeyStage || null,
                                record.profile || null,
                                record.hasCTA || false,
                                links,
                                record.emotionalState || null,
                                record.apiKey || null,
                                record.robotName || null,
                                record.actions?.clicked || false,
                                record.actions?.scheduled || false,
                                record.actions?.leadCaptured || false,
                                record.actions?.whatsappOpened || false,
                                record.timestamp || new Date().toISOString()
                            ]
                        );
                    } else {
                        await this.db.query(
                            `INSERT OR REPLACE INTO learning_conversations 
                             (id, conversation_id, user_message, ai_response, detected_intent, 
                              journey_stage, profile, has_cta, links, emotional_state, 
                              api_key, robot_name, action_clicked, action_scheduled, 
                              action_lead_captured, action_whatsapp_opened, created_at)
                             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                            [
                                record.id,
                                record.conversationId || null,
                                record.userMessage || '',
                                record.aiResponse || '',
                                record.detectedIntent || null,
                                record.journeyStage || null,
                                record.profile || null,
                                record.hasCTA ? 1 : 0,
                                links,
                                record.emotionalState || null,
                                record.apiKey || null,
                                record.robotName || null,
                                record.actions?.clicked ? 1 : 0,
                                record.actions?.scheduled ? 1 : 0,
                                record.actions?.leadCaptured ? 1 : 0,
                                record.actions?.whatsappOpened ? 1 : 0,
                                record.timestamp || new Date().toISOString()
                            ]
                        );
                    }
                    saved++;
                } catch (rowErr) {
                    if (DEBUG) {
                        console.warn('⚠️ [LEARNING-DB] Erro ao salvar registro:', rowErr.message);
                    }
                }
            }

            debugLog(`Salvas ${saved}/${records.length} conversas no banco`);
            return saved > 0;
        } catch (err) {
            if (DEBUG) {
                console.warn('⚠️ [LEARNING-DB] Erro ao salvar conversas:', err.message);
            }
            return false;
        }
    }

    /**
     * Carregar todos os registros de conversa do banco
     * @param {number} limit - Número máximo de registros
     * @returns {Array} Array de registros ou [] em caso de erro
     */
    async loadConversations(limit = 5000) {
        if (!this.initialized) return [];

        try {
            const paramPlaceholder = this.usePostgres ? '$1' : '?';
            const result = await this.db.query(
                `SELECT * FROM learning_conversations ORDER BY created_at DESC LIMIT ${paramPlaceholder}`,
                [limit]
            );

            const rows = result.rows || [];
            debugLog(`Carregadas ${rows.length} conversas do banco`);

            return rows.map(row => this._rowToRecord(row));
        } catch (err) {
            if (DEBUG) {
                console.warn('⚠️ [LEARNING-DB] Erro ao carregar conversas:', err.message);
            }
            return [];
        }
    }

    // ========================================
    // SCORES (learning_scores)
    // ========================================

    /**
     * Salvar scores de performance
     * @param {Map|Object} patterns - Map ou objeto de scores
     * @returns {boolean}
     */
    async saveScores(patterns) {
        if (!this.initialized) return false;

        try {
            const entries = patterns instanceof Map 
                ? Array.from(patterns.entries()) 
                : Object.entries(patterns);

            let saved = 0;
            for (const [key, score] of entries) {
                try {
                    const breakdown = typeof score.breakdown === 'string'
                        ? score.breakdown
                        : JSON.stringify(score.breakdown || {});
                    const topResponses = typeof score.topResponses === 'string'
                        ? score.topResponses
                        : JSON.stringify(score.topResponses || []);

                    if (this.usePostgres) {
                        await this.db.query(
                            `INSERT INTO learning_scores 
                             (pattern_key, intent, journey_stage, has_cta, success_rate, 
                              attempts, conversions, breakdown, top_responses, updated_at)
                             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                             ON CONFLICT (pattern_key) DO UPDATE SET
                              success_rate = $5, attempts = $6, conversions = $7,
                              breakdown = $8, top_responses = $9, updated_at = $10`,
                            [
                                key,
                                score.intent || 'unknown',
                                score.journeyStage || 'unknown',
                                score.hasCTA || false,
                                score.successRate || 0,
                                score.attempts || 0,
                                score.conversions || 0,
                                breakdown,
                                topResponses,
                                score.lastUpdated || new Date().toISOString()
                            ]
                        );
                    } else {
                        await this.db.query(
                            `INSERT OR REPLACE INTO learning_scores 
                             (pattern_key, intent, journey_stage, has_cta, success_rate, 
                              attempts, conversions, breakdown, top_responses, updated_at)
                             VALUES (?,?,?,?,?,?,?,?,?,?)`,
                            [
                                key,
                                score.intent || 'unknown',
                                score.journeyStage || 'unknown',
                                score.hasCTA ? 1 : 0,
                                score.successRate || 0,
                                score.attempts || 0,
                                score.conversions || 0,
                                breakdown,
                                topResponses,
                                score.lastUpdated || new Date().toISOString()
                            ]
                        );
                    }
                    saved++;
                } catch (rowErr) {
                    if (DEBUG) {
                        console.warn('⚠️ [LEARNING-DB] Erro ao salvar score:', rowErr.message);
                    }
                }
            }

            debugLog(`Salvos ${saved} scores no banco`);
            return saved > 0;
        } catch (err) {
            if (DEBUG) {
                console.warn('⚠️ [LEARNING-DB] Erro ao salvar scores:', err.message);
            }
            return false;
        }
    }

    /**
     * Carregar scores do banco
     * @returns {Map} Map de pattern_key → score object
     */
    async loadScores() {
        if (!this.initialized) return new Map();

        try {
            const result = await this.db.query('SELECT * FROM learning_scores');
            const rows = result.rows || [];
            const map = new Map();

            for (const row of rows) {
                map.set(row.pattern_key, {
                    pattern: row.pattern_key,
                    intent: row.intent,
                    journeyStage: row.journey_stage,
                    hasCTA: this.usePostgres ? row.has_cta : !!row.has_cta,
                    successRate: parseFloat(row.success_rate) || 0,
                    attempts: parseInt(row.attempts) || 0,
                    conversions: parseInt(row.conversions) || 0,
                    breakdown: this._parseJSON(row.breakdown, {}),
                    topResponses: this._parseJSON(row.top_responses, []),
                    lastUpdated: row.updated_at
                });
            }

            debugLog(`Carregados ${map.size} scores do banco`);
            return map;
        } catch (err) {
            if (DEBUG) {
                console.warn('⚠️ [LEARNING-DB] Erro ao carregar scores:', err.message);
            }
            return new Map();
        }
    }

    // ========================================
    // PATTERNS (learning_patterns)
    // ========================================

    /**
     * Salvar padrões aprendidos
     * @param {Map|Object} store - Map ou objeto de padrões
     * @param {Array} accessOrder - Ordem de acesso LRU
     * @returns {boolean}
     */
    async savePatterns(store, accessOrder) {
        if (!this.initialized) return false;

        try {
            const entries = store instanceof Map 
                ? Array.from(store.entries()) 
                : Object.entries(store);

            let saved = 0;
            for (const [key, entry] of entries) {
                try {
                    const topResponses = typeof entry.topResponses === 'string'
                        ? entry.topResponses
                        : JSON.stringify(entry.topResponses || []);

                    if (this.usePostgres) {
                        await this.db.query(
                            `INSERT INTO learning_patterns 
                             (pattern_key, intent, profile, journey_stage, success_rate,
                              top_responses, attempts, conversions, access_count, updated_at)
                             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                             ON CONFLICT (pattern_key) DO UPDATE SET
                              success_rate = $5, top_responses = $6, attempts = $7,
                              conversions = $8, access_count = $9, updated_at = $10`,
                            [
                                key,
                                entry.intent || 'unknown',
                                entry.profile || 'unknown',
                                entry.journeyStage || 'unknown',
                                entry.successRate || 0,
                                topResponses,
                                entry.attempts || 0,
                                entry.conversions || 0,
                                entry.accessCount || 0,
                                entry.lastUpdated || new Date().toISOString()
                            ]
                        );
                    } else {
                        await this.db.query(
                            `INSERT OR REPLACE INTO learning_patterns 
                             (pattern_key, intent, profile, journey_stage, success_rate,
                              top_responses, attempts, conversions, access_count, updated_at)
                             VALUES (?,?,?,?,?,?,?,?,?,?)`,
                            [
                                key,
                                entry.intent || 'unknown',
                                entry.profile || 'unknown',
                                entry.journeyStage || 'unknown',
                                entry.successRate || 0,
                                topResponses,
                                entry.attempts || 0,
                                entry.conversions || 0,
                                entry.accessCount || 0,
                                entry.lastUpdated || new Date().toISOString()
                            ]
                        );
                    }
                    saved++;
                } catch (rowErr) {
                    if (DEBUG) {
                        console.warn('⚠️ [LEARNING-DB] Erro ao salvar padrão:', rowErr.message);
                    }
                }
            }

            debugLog(`Salvos ${saved} padrões no banco`);
            return saved > 0;
        } catch (err) {
            if (DEBUG) {
                console.warn('⚠️ [LEARNING-DB] Erro ao salvar padrões:', err.message);
            }
            return false;
        }
    }

    /**
     * Carregar padrões do banco
     * @returns {{ store: Map, accessOrder: Array }}
     */
    async loadPatterns() {
        if (!this.initialized) return { store: new Map(), accessOrder: [] };

        try {
            const result = await this.db.query(
                'SELECT * FROM learning_patterns ORDER BY updated_at ASC'
            );
            const rows = result.rows || [];
            const store = new Map();
            const accessOrder = [];

            for (const row of rows) {
                const key = row.pattern_key;
                store.set(key, {
                    key: key,
                    intent: row.intent || 'unknown',
                    profile: row.profile || 'unknown',
                    journeyStage: row.journey_stage || 'unknown',
                    successRate: parseFloat(row.success_rate) || 0,
                    topResponses: this._parseJSON(row.top_responses, []),
                    attempts: parseInt(row.attempts) || 0,
                    conversions: parseInt(row.conversions) || 0,
                    accessCount: parseInt(row.access_count) || 0,
                    lastUpdated: row.updated_at
                });
                accessOrder.push(key);
            }

            debugLog(`Carregados ${store.size} padrões do banco`);
            return { store, accessOrder };
        } catch (err) {
            if (DEBUG) {
                console.warn('⚠️ [LEARNING-DB] Erro ao carregar padrões:', err.message);
            }
            return { store: new Map(), accessOrder: [] };
        }
    }

    // ========================================
    // HELPERS
    // ========================================

    _rowToRecord(row) {
        try {
            return {
                id: row.id,
                conversationId: row.conversation_id,
                timestamp: row.created_at,
                userMessage: row.user_message || '',
                aiResponse: row.ai_response || '',
                detectedIntent: row.detected_intent,
                journeyStage: row.journey_stage,
                profile: row.profile,
                hasCTA: this.usePostgres ? row.has_cta : !!row.has_cta,
                links: this._parseJSON(row.links, []),
                emotionalState: row.emotional_state,
                apiKey: row.api_key,
                robotName: row.robot_name,
                actions: {
                    clicked: this.usePostgres ? row.action_clicked : !!row.action_clicked,
                    scheduled: this.usePostgres ? row.action_scheduled : !!row.action_scheduled,
                    leadCaptured: this.usePostgres ? row.action_lead_captured : !!row.action_lead_captured,
                    whatsappOpened: this.usePostgres ? row.action_whatsapp_opened : !!row.action_whatsapp_opened
                }
            };
        } catch (err) {
            return null;
        }
    }

    _parseJSON(value, defaultValue) {
        if (!value) return defaultValue;
        if (typeof value === 'object') return value; // Already parsed (PostgreSQL JSONB)
        try {
            return JSON.parse(value);
        } catch (e) {
            return defaultValue;
        }
    }

    isAvailable() {
        return this.initialized;
    }
}

module.exports = { LearningDbAdapter };
