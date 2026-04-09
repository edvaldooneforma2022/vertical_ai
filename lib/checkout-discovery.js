/**
 * 🔍 CHECKOUT DISCOVERY ENGINE V11 — PUPPETEER
 * 
 * Navega até a URL do tenant, intercepta redirecionamentos e clica
 * em botões de compra para descobrir o link de checkout REAL.
 * 
 * REGRAS:
 * - 100% aditivo — não altera nenhum módulo existente
 * - Protegido por FEATURE_V11_ENGINE + ENABLE_V11_DISCOVERY
 * - try/catch total — fallback para null (sem impacto)
 * - Timeout de 30s para não travar o fluxo
 * 
 * @version 11.0.0
 * @author Link Mágico Team
 */

let puppeteer = null;
try {
  puppeteer = require('puppeteer');
} catch (_) {
  console.warn('[CHECKOUT-DISCOVERY] ⚠️ Puppeteer não disponível — discovery desabilitado');
}

/**
 * Domínios conhecidos de checkout/pagamento
 */
const CHECKOUT_DOMAINS = [
  'hotmart', 'kiwify', 'eduzz', 'monetizze',
  'stripe', 'paypal', 'checkout', 'pay',
  'herospark', 'braip', 'perfectpay', 'ticto',
  'mercadopago', 'pagseguro', 'yampi', 'cartpanda'
];

/**
 * Verifica se uma URL pertence a um domínio de checkout
 * @param {string} url
 * @returns {boolean}
 */
function isCheckoutDomain(url) {
  try {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    return CHECKOUT_DOMAINS.some(domain => lower.includes(domain));
  } catch (_) {
    return false;
  }
}

/**
 * Descobre link de checkout via navegação Puppeteer
 * @param {string} url - URL da página do produto
 * @returns {Promise<string|null>} - URL de checkout descoberta ou null
 */
async function discoverCheckout(url) {
  if (!puppeteer) {
    console.warn('[CHECKOUT-DISCOVERY] Puppeteer não disponível');
    return null;
  }

  if (!url || typeof url !== 'string') {
    return null;
  }

  let browser;
  const startTime = Date.now();

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process'
      ]
    });

    const page = await browser.newPage();

    // Timeout global para não travar
    page.setDefaultTimeout(25000);

    let detectedCheckout = null;

    // Intercepta navegações para detectar redirecionamentos
    page.on('framenavigated', frame => {
      try {
        const targetUrl = frame.url();
        if (isCheckoutDomain(targetUrl)) {
          detectedCheckout = targetUrl;
          console.log(`[CHECKOUT-DISCOVERY] 🎯 Checkout detectado via navegação: ${targetUrl.substring(0, 100)}`);
        }
      } catch (_) {}
    });

    // Intercepta requests de rede (para links que abrem em nova aba)
    page.on('request', request => {
      try {
        const reqUrl = request.url();
        if (isCheckoutDomain(reqUrl) && request.resourceType() === 'document') {
          detectedCheckout = reqUrl;
          console.log(`[CHECKOUT-DISCOVERY] 🎯 Checkout detectado via request: ${reqUrl.substring(0, 100)}`);
        }
      } catch (_) {}
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Se já encontrou via redirecionamento, retornar
    if (detectedCheckout) {
      console.log(`[CHECKOUT-DISCOVERY] ✅ Checkout encontrado via redirect em ${Date.now() - startTime}ms`);
      return detectedCheckout;
    }

    // Procurar links de checkout na página
    const pageCheckouts = await page.evaluate((domains) => {
      const results = [];
      
      // Checar todos os links
      document.querySelectorAll('a[href]').forEach(el => {
        const href = el.href || '';
        const lower = href.toLowerCase();
        if (domains.some(d => lower.includes(d))) {
          results.push(href);
        }
      });

      return results;
    }, CHECKOUT_DOMAINS);

    if (pageCheckouts.length > 0) {
      detectedCheckout = pageCheckouts[0];
      console.log(`[CHECKOUT-DISCOVERY] ✅ Checkout encontrado via DOM em ${Date.now() - startTime}ms: ${detectedCheckout.substring(0, 100)}`);
      return detectedCheckout;
    }

    // Clicar em botões relevantes e esperar redirecionamento
    try {
      await page.evaluate(() => {
        const keywords = ['comprar', 'buy', 'checkout', 'pagar', 'garantir', 'adquirir', 'assinar', 'matricular'];

        document.querySelectorAll('a, button').forEach(el => {
          const text = (el.innerText || '').toLowerCase();
          if (keywords.some(k => text.includes(k))) {
            try { el.click(); } catch (e) {}
          }
        });
      });

      // Esperar possíveis redirecionamentos após clique
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (_clickErr) {
      console.warn('[CHECKOUT-DISCOVERY] ⚠️ Erro ao clicar botões (não crítico):', _clickErr.message);
    }

    if (detectedCheckout) {
      console.log(`[CHECKOUT-DISCOVERY] ✅ Checkout encontrado via clique em ${Date.now() - startTime}ms`);
    } else {
      console.log(`[CHECKOUT-DISCOVERY] ℹ️ Nenhum checkout encontrado para: ${url.substring(0, 80)} (${Date.now() - startTime}ms)`);
    }

    return detectedCheckout;

  } catch (err) {
    console.warn('[CHECKOUT-DISCOVERY] ⚠️ Erro:', err.message);
    return null;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  }
}

module.exports = { discoverCheckout, isCheckoutDomain, CHECKOUT_DOMAINS };
