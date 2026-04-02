/**
 * 🧠 AUTO-LEARNING SYSTEM — Link Mágico V8.0
 * 
 * Barrel export para o sistema de auto-learning.
 * Coordena: Tracker → Performance Engine → Memory Store → Optimizer
 * 
 * Uso no server.js:
 *   const autoLearning = require('./analytics');
 *   autoLearning.tracker.record({...});
 *   autoLearning.optimizer.enhance(response, learnedData);
 * 
 * Controlado por: FEATURE_AUTO_LEARNING
 * 
 * @version 1.0.0
 */

const { conversationTracker } = require('./conversation-tracker');
const { performanceEngine } = require('./performance-engine');
const { memoryStore } = require('./memory-store');
const { learningOptimizer } = require('./learning-optimizer');

const DEBUG = process.env.DEBUG_LEARNING === 'true';

function debugLog(...args) {
    if (DEBUG) {
        console.log('🧠 [AUTO-LEARNING]', ...args);
    }
}

/**
 * Registrar interação completa (chamado pós-resposta da IA)
 * Fire-and-forget — NUNCA bloqueia
 */
function recordInteraction(data) {
    try {
        const recordId = conversationTracker.record(data);

        // Notificar performance engine
        performanceEngine.notifyEvent();

        // Verificar se precisa recalcular
        if (performanceEngine.needsRecalc()) {
            // Executar recálculo assíncrono
            setImmediate(() => {
                try {
                    const allRecords = conversationTracker.getAllRecords();
                    performanceEngine.processRecords(allRecords);
                    performanceEngine.resetRecalcCounter();

                    // Atualizar memory store com novos scores
                    const topPatterns = performanceEngine.getTopPatterns(100);
                    memoryStore.updateFromScores(topPatterns);

                    debugLog('Recálculo completo:', topPatterns.length, 'padrões atualizados');
                } catch (err) {
                    if (DEBUG) {
                        console.warn('⚠️ [AUTO-LEARNING] Erro no recálculo:', err.message);
                    }
                }
            });
        }

        return recordId;
    } catch (err) {
        if (DEBUG) {
            console.warn('⚠️ [AUTO-LEARNING] Erro ao registrar interação:', err.message);
        }
        return null;
    }
}

/**
 * Registrar evento de conversão (chamado pelo endpoint /api/track-event)
 */
function trackConversion(conversationId, eventType) {
    try {
        const actionMap = {
            'click_link': 'clicked',
            'open_whatsapp': 'whatsappOpened',
            'schedule_created': 'scheduled',
            'lead_submitted': 'leadCaptured'
        };

        const action = actionMap[eventType];
        if (!action) {
            debugLog('Tipo de evento não mapeado:', eventType);
            return false;
        }

        return conversationTracker.updateAction(conversationId, action);
    } catch (err) {
        if (DEBUG) {
            console.warn('⚠️ [AUTO-LEARNING] Erro ao rastrear conversão:', err.message);
        }
        return false;
    }
}

/**
 * Obter dados aprendidos para otimização
 */
function getLearnedData(intent, profile, journeyStage) {
    try {
        return memoryStore.getLearnedData(intent, profile, journeyStage);
    } catch (err) {
        return null;
    }
}

/**
 * Otimizar resposta com dados aprendidos
 * Retorna response original se não há dados ou se ocorrer erro
 */
function optimizeResponse(response, intent, profile, journeyStage) {
    try {
        // Verificar se temos dados suficientes para otimizar
        const stats = memoryStore.getStats();
        if (!learningOptimizer.isReadyToOptimize(stats.totalPatterns)) {
            return response;
        }

        const learnedData = getLearnedData(intent, profile, journeyStage);
        return learningOptimizer.enhance(response, learnedData, {
            intent,
            journeyStage,
            hasCTA: false // Será detectado pelo optimizer
        });
    } catch (err) {
        // Sempre retorna original em caso de erro
        return response;
    }
}

/**
 * Retorna estatísticas completas do sistema
 */
function getSystemStats() {
    try {
        return {
            tracker: conversationTracker.getStats(),
            performance: performanceEngine.getStats(),
            memory: memoryStore.getStats(),
            optimizer: learningOptimizer.getStats()
        };
    } catch (err) {
        return { error: err.message };
    }
}

module.exports = {
    // Módulos individuais
    tracker: conversationTracker,
    performance: performanceEngine,
    memory: memoryStore,
    optimizer: learningOptimizer,

    // Funções de conveniência (alto nível)
    recordInteraction,
    trackConversion,
    getLearnedData,
    optimizeResponse,
    getSystemStats
};
