/**
 * 🔒 CONCURRENCY LIMIT — Limitador de concorrência sem dependências externas
 * 
 * Controla quantas operações pesadas (ex: Puppeteer) rodam ao mesmo tempo.
 * Previne OOM em ambientes com memória limitada (512MB Render).
 * 
 * @version 1.0.0
 */

'use strict';

/**
 * Cria um limitador de concorrência
 * @param {number} max - Máximo de operações simultâneas (default: 2)
 * @returns {Function} Função `run(fn)` que enfileira e executa com limite
 */
function createLimiter(max = 2) {
    let active = 0;
    const queue = [];

    const next = () => {
        if (queue.length === 0 || active >= max) return;
        active++;
        const { fn, resolve, reject } = queue.shift();

        fn()
            .then(resolve)
            .catch(reject)
            .finally(() => {
                active--;
                next();
            });
    };

    /**
     * Enfileira e executa uma função async respeitando o limite
     * @param {Function} fn - Função async a executar
     * @returns {Promise} Resultado da função
     */
    function run(fn) {
        return new Promise((resolve, reject) => {
            queue.push({ fn, resolve, reject });
            next();
        });
    }

    // Expor stats para debugging
    run.getStats = () => ({ active, queued: queue.length, max });

    return run;
}

/**
 * 🛡️ OOM GUARD — Verifica se memória está crítica
 * @param {number} thresholdMB - Limite em MB (default: 420 — margem antes dos 512MB)
 * @returns {boolean} true se memória está acima do threshold
 */
function isMemoryCritical(thresholdMB = 420) {
    try {
        const usedMB = process.memoryUsage().rss / 1024 / 1024;
        return usedMB > thresholdMB;
    } catch (_) {
        return false; // Em caso de erro, não bloquear
    }
}

/**
 * Retorna uso atual de memória em MB
 * @returns {{ rss: number, heapUsed: number, heapTotal: number }}
 */
function getMemoryUsage() {
    try {
        const mem = process.memoryUsage();
        return {
            rss: Math.round(mem.rss / 1024 / 1024),
            heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
            heapTotal: Math.round(mem.heapTotal / 1024 / 1024)
        };
    } catch (_) {
        return { rss: 0, heapUsed: 0, heapTotal: 0 };
    }
}

module.exports = {
    createLimiter,
    isMemoryCritical,
    getMemoryUsage
};
