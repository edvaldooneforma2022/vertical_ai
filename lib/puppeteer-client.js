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
 */

let chromium = null;
let puppeteerCore = null;
let browserInstance = null;
let lastUsed = 0;
const BROWSER_IDLE_TIMEOUT = 60 * 1000; // 1 minuto sem uso → fecha

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
                args: chromium.args,
                defaultViewport: chromium.defaultViewport,
                executablePath: execPath,
                headless: chromium.headless ?? 'shell',
            };
        } else {
            // Local/Docker — usa puppeteer padrão
            launchOptions = {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
                defaultViewport: { width: 1200, height: 800 },
                timeout: 15000
            };
        }

        browserInstance = await puppeteerCore.launch(launchOptions);
        lastUsed = Date.now();
        console.log('[PUPPETEER-CLIENT] ✅ Browser criado');
        return browserInstance;
    } catch (err) {
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
 * Verifica se Puppeteer está disponível
 */
function isAvailable() {
    return !!puppeteerCore;
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
    isAvailable
};
