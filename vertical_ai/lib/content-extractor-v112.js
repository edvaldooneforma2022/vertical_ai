/**
 * 📄 CONTENT EXTRACTOR V11.2 — EXTRAÇÃO DE CONTEÚDO INTELIGENTE
 * 
 * Extrai título, texto limpo e links de páginas HTML.
 * Usado pelo pipeline V11.2 para construir base de conhecimento.
 * 
 * REGRAS:
 * - 100% aditivo — não altera nenhum módulo existente
 * - Não conflita com enhanced-content-extractor.js (escopo diferente)
 * - try/catch total — fallback para objeto vazio
 * 
 * @version 11.2.0
 * @author Link Mágico Team
 */

const cheerio = require('cheerio');

/**
 * Extrai conteúdo relevante de uma string HTML
 * @param {string} html - HTML da página
 * @returns {{ title: string, text: string, links: string[], meta: string }}
 */
function extractContent(html) {
  try {
    if (!html || typeof html !== 'string') {
      return { title: '', text: '', links: [], meta: '' };
    }

    const $ = cheerio.load(html);

    // Remover elementos não-relevantes
    $('script, style, noscript, iframe, svg, nav, footer, header').remove();

    // Extrair título
    const title = $('title').text().trim() || 
                  $('h1').first().text().trim() || 
                  $('meta[property="og:title"]').attr('content') || '';

    // Extrair meta description
    const meta = $('meta[name="description"]').attr('content') ||
                 $('meta[property="og:description"]').attr('content') || '';

    // Extrair texto limpo do body
    let rawText = '';
    try {
      // Priorizar seções de conteúdo
      const contentSelectors = ['main', 'article', '[role="main"]', '.content', '#content', '.post', '.entry'];
      let mainContent = '';
      
      for (const selector of contentSelectors) {
        const el = $(selector);
        if (el.length > 0) {
          mainContent = el.text();
          break;
        }
      }

      rawText = mainContent || $('body').text();
    } catch (_) {
      rawText = $('body').text();
    }

    // Limpar texto
    const text = rawText
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Extrair todos os links
    const links = [];
    $('a[href]').each((_, el) => {
      try {
        const href = $(el).attr('href');
        if (href && href.startsWith('http')) {
          links.push(href);
        }
      } catch (_) {}
    });

    return { title, text, links, meta };

  } catch (err) {
    console.warn('[CONTENT-EXTRACTOR-V112] ⚠️ Erro:', err.message);
    return { title: '', text: '', links: [], meta: '' };
  }
}

/**
 * Detecta links de checkout a partir de um array de links
 * Método passivo — análise de padrões de URL
 * @param {string[]} links - Array de URLs
 * @returns {string|null} - Primeiro link de checkout encontrado ou null
 */
function detectCheckoutFromLinks(links) {
  try {
    if (!Array.isArray(links) || links.length === 0) return null;

    // Padrões conhecidos de plataformas de checkout
    const checkoutPatterns = [
      /checkout/i,
      /pay\b/i,
      /hotmart\.com/i,
      /kiwify\.com/i,
      /eduzz\.com/i,
      /monetizze\.com/i,
      /stripe\.com/i,
      /paypal\.com/i,
      /herospark\.com/i,
      /braip\.com/i,
      /perfectpay\.com/i,
      /ticto\.com/i,
      /mercadopago/i,
      /pagseguro/i,
      /yampi\.com/i,
      /cartpanda/i,
      /pagamento/i,
      /comprar/i
    ];

    for (const link of links) {
      if (typeof link !== 'string') continue;
      for (const pattern of checkoutPatterns) {
        if (pattern.test(link)) {
          console.log(`[CONTENT-EXTRACTOR-V112] 🎯 Checkout detectado via links: ${link.substring(0, 100)}`);
          return link;
        }
      }
    }

    return null;

  } catch (err) {
    console.warn('[CONTENT-EXTRACTOR-V112] ⚠️ Erro em detectCheckoutFromLinks:', err.message);
    return null;
  }
}

module.exports = { extractContent, detectCheckoutFromLinks };
