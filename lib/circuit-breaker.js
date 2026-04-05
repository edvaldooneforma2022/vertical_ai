/**
 * ⚡ CIRCUIT BREAKER + TIMEOUT + SAFE EXECUTION — Link Mágico V9
 * 
 * Módulo defensivo para proteger o sistema contra:
 * - Chamadas LLM lentas (timeout)
 * - Puppeteer travado (timeout)
 * - Extração demorada (timeout)
 * - Erros cascata (circuit breaker)
 * 
 * REGRA: 100% aditivo, não altera nenhum comportamento existente.
 * Só é usado quando wrappers são explicitamente aplicados.
 * 
 * @version 9.0.0
 */

// Timeout padrão configurável via ENV (default: 8000ms)
const DEFAULT_TIMEOUT_MS = parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT_MS || '8000', 10);

/**
 * Wrapper de timeout para qualquer Promise.
 * Se a promise não resolver dentro de `ms`, rejeita com erro de timeout.
 * 
 * @param {Promise} promise - Promise a ser executada
 * @param {number} [ms] - Timeout em milissegundos (default: ENV ou 8000)
 * @param {string} [label] - Label para log (ex: 'LLM', 'Puppeteer')
 * @returns {Promise} - Resolve com resultado ou rejeita com timeout
 */
async function withTimeout(promise, ms = DEFAULT_TIMEOUT_MS, label = 'operation') {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`[TIMEOUT] ${label} excedeu ${ms}ms`));
        }, ms);
    });

    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutId);
        return result;
    } catch (err) {
        clearTimeout(timeoutId);
        throw err;
    }
}

/**
 * Execução segura com fallback e log estruturado.
 * NUNCA lança exceção — sempre retorna resultado ou fallback.
 * 
 * @param {Function} fn - Função a executar (pode ser async)
 * @param {Function|*} fallback - Função fallback ou valor direto
 * @param {string} [label] - Label para log (ex: '[SALES-LAYER]')
 * @returns {*} - Resultado da função ou do fallback
 */
async function safeExecution(fn, fallback, label = '[SAFE_EXEC]') {
    try {
        const result = await fn();
        return result;
    } catch (err) {
        console.error(`${label} Erro capturado:`, JSON.stringify({
            error: err.message,
            timestamp: new Date().toISOString(),
            label
        }));

        if (typeof fallback === 'function') {
            try {
                return await fallback();
            } catch (fallbackErr) {
                console.error(`${label} Fallback também falhou:`, fallbackErr.message);
                return null;
            }
        }
        return fallback !== undefined ? fallback : null;
    }
}

/**
 * Circuit Breaker simples para proteger serviços externos.
 * 
 * Estados:
 * - CLOSED: funcionando normalmente (passa tudo)
 * - OPEN: serviço problemático (rejeita imediatamente)
 * - HALF_OPEN: testando recuperação (permite 1 request)
 * 
 * @param {Object} options
 * @param {number} [options.failureThreshold=5] - Falhas para abrir
 * @param {number} [options.resetTimeoutMs=30000] - Tempo para tentar recuperar
 * @param {number} [options.timeoutMs] - Timeout por chamada
 * @param {string} [options.name='default'] - Nome do circuit breaker
 * @returns {Object} - { execute(fn), getState(), reset() }
 */
function createCircuitBreaker(options = {}) {
    const {
        failureThreshold = 5,
        resetTimeoutMs = 30000,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        name = 'default'
    } = options;

    let state = 'CLOSED';
    let failures = 0;
    let lastFailureTime = 0;
    let successCount = 0;

    function getState() {
        if (state === 'OPEN') {
            // Verificar se já passou o tempo de reset
            if (Date.now() - lastFailureTime >= resetTimeoutMs) {
                state = 'HALF_OPEN';
                console.log(JSON.stringify({
                    event: '[CIRCUIT_BREAKER]',
                    name,
                    transition: 'OPEN → HALF_OPEN',
                    timestamp: new Date().toISOString()
                }));
            }
        }
        return state;
    }

    async function execute(fn) {
        const currentState = getState();

        if (currentState === 'OPEN') {
            console.warn(JSON.stringify({
                event: '[CIRCUIT_BREAKER]',
                name,
                action: 'REJECTED',
                state: 'OPEN',
                retryIn: Math.max(0, resetTimeoutMs - (Date.now() - lastFailureTime)),
                timestamp: new Date().toISOString()
            }));
            throw new Error(`[CIRCUIT_BREAKER] ${name}: circuito aberto, serviço indisponível`);
        }

        try {
            const result = await withTimeout(
                Promise.resolve().then(fn),
                timeoutMs,
                `circuit-breaker:${name}`
            );

            // Sucesso — resetar contadores
            if (currentState === 'HALF_OPEN') {
                state = 'CLOSED';
                failures = 0;
                console.log(JSON.stringify({
                    event: '[CIRCUIT_BREAKER]',
                    name,
                    transition: 'HALF_OPEN → CLOSED',
                    timestamp: new Date().toISOString()
                }));
            }
            successCount++;
            return result;

        } catch (err) {
            failures++;
            lastFailureTime = Date.now();

            if (failures >= failureThreshold && state !== 'OPEN') {
                state = 'OPEN';
                console.error(JSON.stringify({
                    event: '[CIRCUIT_BREAKER]',
                    name,
                    transition: `${currentState} → OPEN`,
                    failures,
                    threshold: failureThreshold,
                    timestamp: new Date().toISOString()
                }));
            }

            throw err;
        }
    }

    function reset() {
        state = 'CLOSED';
        failures = 0;
        lastFailureTime = 0;
        successCount = 0;
    }

    function stats() {
        return {
            name,
            state: getState(),
            failures,
            successCount,
            lastFailureTime: lastFailureTime ? new Date(lastFailureTime).toISOString() : null,
            failureThreshold,
            resetTimeoutMs,
            timeoutMs
        };
    }

    return { execute, getState, reset, stats };
}

// ═══════════════════════════════════════════════════════════════
// INSTÂNCIAS PRÉ-CONFIGURADAS (prontas para uso no server.js)
// ═══════════════════════════════════════════════════════════════

const llmCircuitBreaker = createCircuitBreaker({
    name: 'LLM',
    failureThreshold: 5,
    resetTimeoutMs: 30000,
    timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10)
});

const extractionCircuitBreaker = createCircuitBreaker({
    name: 'Extraction',
    failureThreshold: 3,
    resetTimeoutMs: 60000,
    timeoutMs: parseInt(process.env.EXTRACTION_TIMEOUT_MS || '15000', 10)
});

const puppeteerCircuitBreaker = createCircuitBreaker({
    name: 'Puppeteer',
    failureThreshold: 3,
    resetTimeoutMs: 60000,
    timeoutMs: parseInt(process.env.PUPPETEER_TIMEOUT_MS || '20000', 10)
});

console.log(`⚡ [V9] Circuit Breaker carregado | timeout_default=${DEFAULT_TIMEOUT_MS}ms`);

module.exports = {
    withTimeout,
    safeExecution,
    createCircuitBreaker,
    DEFAULT_TIMEOUT_MS,
    // Instâncias pré-configuradas
    llmCircuitBreaker,
    extractionCircuitBreaker,
    puppeteerCircuitBreaker
};
