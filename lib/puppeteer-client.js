/**
 * 🔧 PUPPETEER CLIENT — Render-safe browser singleton
 * 
 * Usa @sparticuz/chromium (compatível com Render/Lambda/Vercel)
 * Browser singleton com lifecycle controlado
 * Feature flag: FEATURE_PUPPETEER=true para ativar
 * 
 * GARANTIAS:
 *   - NÃO impacta nenhuma funcionalidade existente
 *   - Fallback silencioso se dependências não estiverem disponíveis
 *   - Browser fecha automaticamente após inatividade
 *   - Circuit breaker: desabilita temporariamente após falhas consecutivas
 *   - Request interception: bloqueia imagens/fontes/media para performance
 */

let chromium = null;
let puppeteerCore = null;
let browserInstance = null;
let lastUsed = 0;
const BROWSER_IDLE_TIMEOUT = 60 * 1000; // 1 minuto sem uso → fecha

// ═══════════════════════════════════════════════════════════════════
// 🛡️ CIRCUIT BREAKER — desabilita Puppeteer após falhas consecutivas
// ═══════════════════════════════════════════════════════════════════
let _consecutiveFailures = 0;
let _circuitOpenUntil = 0;
const MAX_CONSECUTIVE_FAILURES = 3;
const CIRCUIT_RESET_MS = 5 * 60 * 1000; // 5 minutos

function _isCircuitOpen() {
    if (_circuitOpenUntil > 0 && Date.now() < _circuitOpenUntil) {
        return true;
    }
    // Reset após período de cooldown
    if (_circuitOpenUntil > 0 && Date.now() >= _circuitOpenUntil) {
        console.log('[PUPPETEER-CLIENT] 🔄 Circuit breaker resetado — tentando novamente');
        _consecutiveFailures = 0;
        _circuitOpenUntil = 0;
    }
    return false;
}

function _recordSuccess() {
    _consecutiveFailures = 0;
}

function _recordFailure() {
    _consecutiveFailures++;
    if (_consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        _circuitOpenUntil = Date.now() + CIRCUIT_RESET_MS;
        console.warn(`[PUPPETEER-CLIENT] 🔴 Circuit breaker ABERTO — ${_consecutiveFailures} falhas consecutivas. Retry em ${CIRCUIT_RESET_MS / 1000}s`);
    }
}

// Tentar carregar dependências (fallback silencioso)
try {
    chromium = require('@sparticuz/chromium');
    puppeteerCore = require('puppeteer-core');
    console.log('[PUPPETEER-CLIENT] ✅ @sparticuz/chromium + puppeteer-core disponíveis');
} catch (err) {
    console.log('[PUPPETEER-CLIENT] ⚠️ @sparticuz/chromium não instalado — tentando puppeteer padrão');
    try {
        puppeteerCore = require('puppeteer');
        console.log('[PUPPETEER-CLIENT] ✅ Fallback: puppeteer padrão disponível');
    } catch (err2) {
        console.log('[PUPPETEER-CLIENT] ❌ Nenhum Puppeteer disponível — extração JS-heavy desabilitada');
    }
}

/**
 * Obtém ou cria instância do browser
 * @returns {Promise<Browser|null>}
 */
async function getBrowser() {
    if (!puppeteerCore) return null;

    // Circuit breaker check
    if (_isCircuitOpen()) {
        console.log('[PUPPETEER-CLIENT] 🔴 Circuit breaker ABERTO — Puppeteer temporariamente desabilitado');
        return null;
    }

    // Reusar browser existente
    if (browserInstance) {
        try {
            // Verificar se browser ainda está vivo
            const pages = await browserInstance.pages();
            lastUsed = Date.now();
            return browserInstance;
        } catch (err) {
            console.log('[PUPPETEER-CLIENT] ⚠️ Browser morto, recriando...');
            browserInstance = null;
        }
    }

    try {
        let launchOptions;
        if (chromium) {
            // Render/Lambda/Vercel — usa @sparticuz/chromium
            const execPath = typeof chromium.executablePath === 'function'
                ? await chromium.executablePath()
                : chromium.executablePath;
            launchOptions = {
                args: [
                    ...chromium.args,
                    '--disable-gpu',
                    '--disable-dev-shm-usage',
                    '--single-process'
                ],
                defaultViewport: chromium.defaultViewport,
                executablePath: execPath,
                headless: chromium.headless ?? 'shell',
            };
        } else {
            // Local/Docker — usa puppeteer padrão
            launchOptions = {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--single-process'
                ],
                defaultViewport: { width: 1200, height: 800 },
                timeout: 15000
            };
        }

        browserInstance = await puppeteerCore.launch(launchOptions);
        lastUsed = Date.now();
        _recordSuccess();
        console.log('[PUPPETEER-CLIENT] ✅ Browser criado');
        return browserInstance;
    } catch (err) {
        _recordFailure();
        console.error('[PUPPETEER-CLIENT] ❌ Falha ao criar browser:', err.message);
        return null;
    }
}

/**
 * Fecha browser explicitamente
 */
async function closeBrowser() {
    if (browserInstance) {
        try {
            await browserInstance.close();
            console.log('[PUPPETEER-CLIENT] 🔒 Browser fechado');
        } catch (err) {
            console.warn('[PUPPETEER-CLIENT] ⚠️ Erro ao fechar browser:', err.message);
        }
        browserInstance = null;
    }
}

/**
 * Verifica se Puppeteer está disponível (incluindo circuit breaker)
 */
function isAvailable() {
    return !!puppeteerCore && !_isCircuitOpen();
}

/**
 * Configura request interception para bloquear recursos pesados
 * Chamado pelo extractor após criar a página
 * @param {Page} page
 */
async function setupRequestInterception(page) {
    try {
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'font', 'media', 'stylesheet'].includes(resourceType)) {
                req.abort();
            } else {
                req.continue();
            }
        });
    } catch (err) {
        console.warn('[PUPPETEER-CLIENT] ⚠️ Request interception falhou (sem impacto):', err.message);
    }
}

// Auto-cleanup: fecha browser após inatividade
setInterval(async () => {
    if (browserInstance && Date.now() - lastUsed > BROWSER_IDLE_TIMEOUT) {
        console.log('[PUPPETEER-CLIENT] ⏰ Browser idle — fechando automaticamente');
        await closeBrowser();
    }
}, 30000);

module.exports = {
    getBrowser,
    closeBrowser,
    isAvailable,
    setupRequestInterception,
    getCircuitStatus: () => ({
        failures: _consecutiveFailures,
        isOpen: _isCircuitOpen(),
        resetAt: _circuitOpenUntil > 0 ? new Date(_circuitOpenUntil).toISOString() : null
    })
};
