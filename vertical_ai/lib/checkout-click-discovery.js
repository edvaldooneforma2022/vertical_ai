/**
 * 🔥 CHECKOUT CLICK DISCOVERY V11.2 — DESCOBERTA ATIVA POR CLIQUE
 * 
 * Abre a página com Puppeteer, identifica botões de compra,
 * clica automaticamente e captura o redirecionamento real.
 * 
 * 3 NÍVEIS DE DESCOBERTA:
 *   1. Redirect detection (ao carregar a página)
 *   2. DOM scanning (links visíveis)
 *   3. CLICK DISCOVERY (clique em botões → captura redirect)
 * 
 * REGRAS:
 * - 100% aditivo — não altera checkout-discovery.js existente
 * - Protegido por FEATURE_V11_2_RAG (não depende de FEATURE_V11_ENGINE)
 * - try/catch total — fallback para null (sem impacto)
 * - Timeout de 30s global para não travar o pipeline
 * - Browser sempre fechado no finally
 * 
 * @version 11.2.0
 * @author Link Mágico Team
 */

let puppeteer = null;
try {
  puppeteer = require('puppeteer');
} catch (_) {
  console.warn('[CHECKOUT-CLICK-DISCOVERY] ⚠️ Puppeteer não disponível — click discovery desabilitado');
}

/**
 * Domínios conhecidos de checkout/pagamento
 */
const CHECKOUT_DOMAINS = [
  'hotmart', 'kiwify', 'eduzz', 'monetizze',
  'stripe', 'paypal', 'checkout', 'pay',
  'herospark', 'braip', 'perfectpay', 'ticto',
  'mercadopago', 'pagseguro', 'yampi', 'cartpanda',
  'lastlink', 'pagar.me', 'iugu', 'asaas',
  'greenn', 'pepper', 'buypage'
];

/**
 * Palavras-chave para identificar botões de compra
 */
const BUY_BUTTON_KEYWORDS = [
  'comprar', 'compre', 'garantir', 'garanta',
  'acessar', 'acesse', 'checkout',
  'adquirir', 'adquira', 'assinar', 'assine',
  'matricular', 'inscrever', 'inscreva',
  'quero', 'eu quero', 'sim, eu quero',
  'pagar', 'pagamento', 'finalizar',
  'buy', 'get access', 'enroll',
  'aproveitar', 'aproveite',
  'começar', 'comece agora',
  'clique aqui', 'saiba mais'
];

/**
 * Verifica se uma URL pertence a um domínio de checkout
 * @param {string} url
 * @returns {boolean}
 */
function isCheckoutUrl(url) {
  try {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    return CHECKOUT_DOMAINS.some(domain => lower.includes(domain));
  } catch (_) {
    return false;
  }
}

/**
 * Descobre link de checkout via clique ativo em botões
 * 
 * Fluxo:
 *   1. Abre URL com Puppeteer
 *   2. Escuta redirecionamentos (framenavigated + request)
 *   3. Se não achou via redirect → escaneia DOM por links
 *   4. Se não achou via DOM → clica em botões de compra
 *   5. Captura redirecionamento após clique
 * 
 * @param {string} url - URL da página do produto
 * @param {Object} [options] - Opções
 * @param {number} [options.timeout=30000] - Timeout global em ms
 * @param {number} [options.clickWait=3000] - Tempo de espera após cada clique
 * @param {number} [options.maxClicks=3] - Máximo de cliques a tentar
 * @returns {Promise<string|null>} - URL de checkout descoberta ou null
 */
async function discoverCheckoutByClick(url, options = {}) {
  if (!puppeteer) {
    console.warn('[CHECKOUT-CLICK-DISCOVERY] Puppeteer não disponível');
    return null;
  }

  if (!url || typeof url !== 'string') {
    return null;
  }

  const timeout = options.timeout || 30000;
  const clickWait = options.clickWait || 3000;
  const maxClicks = options.maxClicks || 3;

  let browser = null;
  const startTime = Date.now();

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--disable-extensions'
      ]
    });

    const page = await browser.newPage();
    page.setDefaultTimeout(timeout);

    // Bloquear recursos pesados para acelerar
    await page.setRequestInterception(true);
    page.on('request', req => {
      try {
        const type = req.resourceType();
        if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
          req.abort();
        } else {
          req.continue();
        }
      } catch (_) {
        try { req.continue(); } catch (__) {}
      }
    });

    let detectedCheckout = null;

    // ═══════════════════════════════════════════
    // NÍVEL 1: Intercepta redirecionamentos automáticos
    // ═══════════════════════════════════════════
    page.on('framenavigated', frame => {
      try {
        if (frame !== page.mainFrame()) return;
        const targetUrl = frame.url();
        if (isCheckoutUrl(targetUrl)) {
          detectedCheckout = targetUrl;
          console.log(`[CHECKOUT-CLICK-DISCOVERY] 🎯 Nível 1 — Checkout via redirect: ${targetUrl.substring(0, 120)}`);
        }
      } catch (_) {}
    });

    // Intercepta requests de navegação (links target=_blank etc)
    page.on('request', request => {
      try {
        if (request.resourceType() === 'document') {
          const reqUrl = request.url();
          if (isCheckoutUrl(reqUrl) && reqUrl !== url) {
            detectedCheckout = reqUrl;
            console.log(`[CHECKOUT-CLICK-DISCOVERY] 🎯 Nível 1 — Checkout via request: ${reqUrl.substring(0, 120)}`);
          }
        }
      } catch (_) {}
    });

    // Navegar até a página
    await page.goto(url, { waitUntil: 'networkidle2', timeout: timeout });

    // Se já encontrou via redirect, retornar
    if (detectedCheckout) {
      console.log(`[CHECKOUT-CLICK-DISCOVERY] ✅ Checkout encontrado via redirect em ${Date.now() - startTime}ms`);
      return detectedCheckout;
    }

    // ═══════════════════════════════════════════
    // NÍVEL 2: Escanear DOM por links de checkout
    // ═══════════════════════════════════════════
    try {
      const domCheckouts = await page.evaluate((domains) => {
        const results = [];
        document.querySelectorAll('a[href]').forEach(el => {
          const href = el.href || '';
          const lower = href.toLowerCase();
          if (domains.some(d => lower.includes(d))) {
            results.push(href);
          }
        });
        return results;
      }, CHECKOUT_DOMAINS);

      if (domCheckouts.length > 0) {
        detectedCheckout = domCheckouts[0];
        console.log(`[CHECKOUT-CLICK-DISCOVERY] ✅ Nível 2 — Checkout via DOM em ${Date.now() - startTime}ms: ${detectedCheckout.substring(0, 120)}`);
        return detectedCheckout;
      }
    } catch (_domErr) {
      console.warn('[CHECKOUT-CLICK-DISCOVERY] ⚠️ Erro ao escanear DOM (continuando para clique):', _domErr.message);
    }

    // ═══════════════════════════════════════════
    // NÍVEL 3: CLICK DISCOVERY — clica em botões de compra
    // ═══════════════════════════════════════════
    console.log(`[CHECKOUT-CLICK-DISCOVERY] 🖱️ Nível 3 — Iniciando click discovery...`);

    try {
      // Buscar todos os botões e links clicáveis
      const clickableElements = await page.evaluate((keywords) => {
        const results = [];

        document.querySelectorAll('a, button, [role="button"], input[type="submit"], [onclick]').forEach((el, index) => {
          const text = (el.innerText || el.textContent || el.value || '').toLowerCase().trim();
          const href = (el.href || el.getAttribute('href') || '').toLowerCase();
          const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
          const title = (el.getAttribute('title') || '').toLowerCase();
          const className = (el.className || '').toLowerCase();

          // Score de relevância
          let score = 0;
          const searchText = `${text} ${ariaLabel} ${title} ${className}`;

          for (const keyword of keywords) {
            if (searchText.includes(keyword)) {
              score += 2;
            }
          }

          // Bonus para botões com estilo de destaque (provavelmente CTA)
          const style = window.getComputedStyle(el);
          const bgColor = style.backgroundColor;
          if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
            score += 1; // Tem cor de fundo = provavelmente CTA
          }

          // Bonus para elementos grandes (CTAs geralmente são maiores)
          const rect = el.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 30) {
            score += 1;
          }

          if (score > 0) {
            results.push({
              index,
              score,
              text: text.substring(0, 80),
              tag: el.tagName,
              selector: el.id ? `#${el.id}` : (el.className ? `.${el.className.split(' ')[0]}` : `${el.tagName.toLowerCase()}:nth-of-type(${index})`)
            });
          }
        });

        // Ordenar por score (mais relevante primeiro)
        results.sort((a, b) => b.score - a.score);

        return results.slice(0, 10); // Top 10
      }, BUY_BUTTON_KEYWORDS);

      console.log(`[CHECKOUT-CLICK-DISCOVERY] 🖱️ ${clickableElements.length} botões candidatos encontrados`);

      // Clicar nos botões mais relevantes (limitado por maxClicks)
      let clickCount = 0;
      for (const element of clickableElements) {
        if (detectedCheckout || clickCount >= maxClicks) break;

        // Checar timeout global
        if (Date.now() - startTime > timeout - 5000) {
          console.log('[CHECKOUT-CLICK-DISCOVERY] ⏰ Timeout se aproximando, parando cliques');
          break;
        }

        try {
          console.log(`[CHECKOUT-CLICK-DISCOVERY] 🖱️ Clicando: "${element.text}" (score=${element.score}, tag=${element.tag})`);

          // Re-buscar o elemento e clicar
          await page.evaluate((keywords, idx) => {
            const elements = document.querySelectorAll('a, button, [role="button"], input[type="submit"], [onclick]');
            let targetIdx = 0;
            
            for (const el of elements) {
              const text = (el.innerText || el.textContent || el.value || '').toLowerCase().trim();
              const searchText = `${text} ${(el.getAttribute('aria-label') || '')} ${(el.className || '')}`.toLowerCase();
              
              let hasKeyword = false;
              for (const kw of keywords) {
                if (searchText.includes(kw)) {
                  hasKeyword = true;
                  break;
                }
              }
              
              if (hasKeyword) {
                if (targetIdx === idx) {
                  try { el.click(); } catch (_) {}
                  return;
                }
                targetIdx++;
              }
            }
          }, BUY_BUTTON_KEYWORDS, clickCount);

          clickCount++;

          // Esperar possível redirecionamento
          await new Promise(resolve => setTimeout(resolve, clickWait));

          if (detectedCheckout) {
            console.log(`[CHECKOUT-CLICK-DISCOVERY] 🔥 Checkout encontrado após clique #${clickCount}!`);
            break;
          }

          // Verificar se a URL da página mudou
          const currentUrl = page.url();
          if (currentUrl !== url && isCheckoutUrl(currentUrl)) {
            detectedCheckout = currentUrl;
            console.log(`[CHECKOUT-CLICK-DISCOVERY] 🔥 Checkout via URL change: ${currentUrl.substring(0, 120)}`);
            break;
          }

          // Verificar se apareceu popup/nova aba
          const pages = await browser.pages();
          for (const p of pages) {
            try {
              const pUrl = p.url();
              if (pUrl !== url && pUrl !== 'about:blank' && isCheckoutUrl(pUrl)) {
                detectedCheckout = pUrl;
                console.log(`[CHECKOUT-CLICK-DISCOVERY] 🔥 Checkout via nova aba: ${pUrl.substring(0, 120)}`);
                break;
              }
            } catch (_) {}
          }

        } catch (_clickErr) {
          console.warn(`[CHECKOUT-CLICK-DISCOVERY] ⚠️ Erro ao clicar botão #${clickCount + 1} (não crítico):`, _clickErr.message);
        }
      }
    } catch (_clickPhaseErr) {
      console.warn('[CHECKOUT-CLICK-DISCOVERY] ⚠️ Erro na fase de clique (não crítico):', _clickPhaseErr.message);
    }

    // Resultado final
    const elapsed = Date.now() - startTime;
    if (detectedCheckout) {
      console.log(`[CHECKOUT-CLICK-DISCOVERY] ✅ Checkout DESCOBERTO em ${elapsed}ms: ${detectedCheckout.substring(0, 120)}`);
    } else {
      console.log(`[CHECKOUT-CLICK-DISCOVERY] ℹ️ Nenhum checkout encontrado para: ${url.substring(0, 80)} (${elapsed}ms)`);
    }

    return detectedCheckout;

  } catch (err) {
    console.warn('[CHECKOUT-CLICK-DISCOVERY] ⚠️ Erro geral:', err.message);
    return null;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  }
}

module.exports = { discoverCheckoutByClick, isCheckoutUrl, CHECKOUT_DOMAINS, BUY_BUTTON_KEYWORDS };
