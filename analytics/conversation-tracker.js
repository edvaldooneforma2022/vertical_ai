/**
 * 🧠 CONVERSATION TRACKER — Auto-Learning V1.0
 * 
 * Coleta PASSIVA de dados de conversação para aprendizado.
 * NÃO bloqueia respostas da IA. Falhas são silenciosas.
 * 
 * Controlado por: FEATURE_AUTO_LEARNING
 * Debug: DEBUG_LEARNING=true
 * 
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configurações
const MAX_RECORDS = 5000;
const DATA_DIR = path.join(__dirname, '..', 'data', 'learning');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');
const FLUSH_INTERVAL_MS = 30000; // Salvar a cada 30s
const DEBUG = process.env.DEBUG_LEARNING === 'true';

function debugLog(...args) {
    if (DEBUG) {
        console.log('🧠 [LEARNING-TRACKER]', ...args);
    }
}

class ConversationTracker {
    constructor() {
        this.records = [];
        this.pendingWrites = [];
        this.initialized = false;
        this.flushTimer = null;

        try {
            this._ensureDataDir();
            this._loadExistingData();
            this._startFlushTimer();
            this.initialized = true;
            debugLog('Inicializado com', this.records.length, 'registros existentes');
        } catch (err) {
            console.warn('⚠️ [LEARNING-TRACKER] Falha ao inicializar (modo degradado):', err.message);
        }
    }

    /**
     * Registrar uma interação de conversa (fire-and-forget)
     * NUNCA lança exceção para o chamador
     */
    record(data) {
        try {
            if (!this.initialized) {
                debugLog('Tracker não inicializado, ignorando registro');
                return null;
            }

            const record = {
                id: crypto.randomBytes(8).toString('hex'),
                conversationId: data.conversationId || null,
                timestamp: new Date().toISOString(),
                userMessage: this._sanitize(data.userMessage),
                aiResponse: this._truncate(data.aiResponse, 500),
                detectedIntent: data.detectedIntent || null,
                journeyStage: data.journeyStage || null,
                profile: data.profile || null,
                hasCTA: this._detectCTA(data.aiResponse),
                links: this._extractLinks(data.aiResponse),
                emotionalState: data.emotionalState || null,
                apiKey: data.apiKey ? data.apiKey.substring(0, 8) + '...' : null,
                robotName: data.robotName || null,
                actions: {
                    clicked: false,
                    scheduled: false,
                    leadCaptured: false,
                    whatsappOpened: false
                }
            };

            this.pendingWrites.push(record);
            debugLog('Registro adicionado à fila:', record.id);

            return record.id;
        } catch (err) {
            // NUNCA propagar erro
            if (DEBUG) {
                console.warn('⚠️ [LEARNING-TRACKER] Erro ao registrar:', err.message);
            }
            return null;
        }
    }

    /**
     * Atualizar ação de um registro (quando evento de conversão chegar)
     */
    updateAction(conversationId, actionType) {
        try {
            if (!this.initialized) return false;

            const validActions = ['clicked', 'scheduled', 'leadCaptured', 'whatsappOpened'];
            if (!validActions.includes(actionType)) {
                debugLog('Ação inválida:', actionType);
                return false;
            }

            // Buscar nos registros em memória
            const records = this._findByConversationId(conversationId);
            if (records.length === 0) {
                debugLog('Nenhum registro encontrado para conversationId:', conversationId);
                return false;
            }

            // Atualizar o registro mais recente
            const latestRecord = records[records.length - 1];
            latestRecord.actions[actionType] = true;
            latestRecord.actions[`${actionType}At`] = new Date().toISOString();

            debugLog('Ação atualizada:', actionType, 'para conversação:', conversationId);
            this._scheduleSave();

            return true;
        } catch (err) {
            if (DEBUG) {
                console.warn('⚠️ [LEARNING-TRACKER] Erro ao atualizar ação:', err.message);
            }
            return false;
        }
    }

    /**
     * Retorna todos os registros com conversões (para o performance engine)
     */
    getConvertedRecords() {
        try {
            return this.records.filter(r =>
                r.actions.clicked ||
                r.actions.scheduled ||
                r.actions.leadCaptured ||
                r.actions.whatsappOpened
            );
        } catch (err) {
            return [];
        }
    }

    /**
     * Retorna todos os registros
     */
    getAllRecords() {
        try {
            return [...this.records];
        } catch (err) {
            return [];
        }
    }

    /**
     * Retorna estatísticas básicas
     */
    getStats() {
        try {
            const total = this.records.length;
            const converted = this.getConvertedRecords().length;
            return {
                totalRecords: total,
                convertedRecords: converted,
                conversionRate: total > 0 ? (converted / total).toFixed(4) : 0,
                pendingWrites: this.pendingWrites.length,
                oldestRecord: this.records.length > 0 ? this.records[0].timestamp : null,
                newestRecord: this.records.length > 0 ? this.records[this.records.length - 1].timestamp : null
            };
        } catch (err) {
            return { totalRecords: 0, convertedRecords: 0, conversionRate: 0 };
        }
    }

    // ===== MÉTODOS PRIVADOS =====

    _findByConversationId(conversationId) {
        return this.records.filter(r => r.conversationId === conversationId);
    }

    _detectCTA(text) {
        if (!text) return false;
        const ctaPatterns = [
            /clique/i, /acesse/i, /compre/i, /adquira/i,
            /garanta/i, /aproveite/i, /confira/i, /saiba mais/i,
            /agende/i, /cadastre/i, /whatsapp/i, /fale conosco/i,
            /https?:\/\//i, /\[.*\]\(.*\)/i
        ];
        return ctaPatterns.some(pattern => pattern.test(text));
    }

    _extractLinks(text) {
        if (!text) return [];
        try {
            const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
            const matches = text.match(urlRegex) || [];
            return matches.slice(0, 10);
        } catch (e) {
            return [];
        }
    }

    _sanitize(text) {
        if (!text) return '';
        return String(text).substring(0, 1000);
    }

    _truncate(text, maxLen) {
        if (!text) return '';
        return String(text).length > maxLen
            ? String(text).substring(0, maxLen) + '...'
            : String(text);
    }

    _ensureDataDir() {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
            debugLog('Diretório de dados criado:', DATA_DIR);
        }
    }

    _loadExistingData() {
        try {
            if (fs.existsSync(CONVERSATIONS_FILE)) {
                const data = fs.readFileSync(CONVERSATIONS_FILE, 'utf8');
                this.records = JSON.parse(data);
                if (!Array.isArray(this.records)) {
                    this.records = [];
                }
            }
        } catch (err) {
            console.warn('⚠️ [LEARNING-TRACKER] Erro ao carregar dados:', err.message);
            this.records = [];
        }
    }

    _startFlushTimer() {
        this.flushTimer = setInterval(() => {
            this._flush();
        }, FLUSH_INTERVAL_MS);

        // Não impedir o processo de encerrar
        if (this.flushTimer.unref) {
            this.flushTimer.unref();
        }
    }

    _scheduleSave() {
        debugLog('Save agendado (próximo flush)');
    }

    _flush() {
        try {
            if (this.pendingWrites.length === 0) return;

            // Mover pending para records
            this.records.push(...this.pendingWrites);
            this.pendingWrites = [];

            // Limitar tamanho (rotação)
            if (this.records.length > MAX_RECORDS) {
                const excess = this.records.length - MAX_RECORDS;
                this.records = this.records.slice(excess);
                debugLog(`Rotação: ${excess} registros antigos removidos`);
            }

            // Salvar em disco
            this._ensureDataDir();
            fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(this.records, null, 2));
            debugLog(`Flush: ${this.records.length} registros salvos em disco`);
        } catch (err) {
            console.warn('⚠️ [LEARNING-TRACKER] Erro no flush:', err.message);
        }
    }

    /**
     * Forçar salvamento imediato (para shutdown graceful)
     */
    forceFlush() {
        try {
            this._flush();
        } catch (err) {
            // Silencioso
        }
    }

    /**
     * Destruir timer (cleanup)
     */
    destroy() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        this.forceFlush();
    }
}

// Singleton
const conversationTracker = new ConversationTracker();

// Graceful shutdown
process.on('beforeExit', () => {
    conversationTracker.forceFlush();
});

module.exports = {
    conversationTracker,
    ConversationTracker
};
