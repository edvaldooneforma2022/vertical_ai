/**
 * 🔥 V13.2.1 — CHECKOUT LINK CLASSIFIER (AUTO-ALIMENTAÇÃO)
 * 
 * Classifica TODOS os links de checkout encontrados pelo V11.2.
 * Alimenta automaticamente: checkoutLink, upsells, downsells.
 * 
 * PRINCÍPIO:
 *   V11.2 extrai links → Classifier separa → pageData populado → V13.2 usa
 * 
 * REGRAS:
 *   - 100% determinístico (zero IA)
 *   - 100% aditivo — novo módulo
 *   - Isolado por try/catch
 *   - Fallback: se falhar, pageData.checkoutLink já existe (V11.2)
 *   - Zero impacto no fluxo atual
 * 
 * @version 13.2.1
 * @author Link Mágico Team
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════
// PADRÕES DE CLASSIFICAÇÃO (determinísticos)
// ═══════════════════════════════════════════════════════════════════

// Domínios conhecidos de checkout
const CHECKOUT_DOMAINS = [
    'hotmart.com', 'pay.hotmart.com', 'go.hotmart.com',
    'kiwify.com.br', 'pay.kiwify.com.br',
    'eduzz.com', 'checkout.eduzz.com', 'sun.eduzz.com',
    'monetizze.com.br',
    'braip.com', 'ev.braip.com',
    'herospark.com', 'pay.herospark.com',
    'lastlink.com',
    'pagar.me', 'checkout.stripe.com',
    'mpago.la', 'mercadopago.com', 'mercadopago.com.br',
    'pagseguro.uol.com.br',
    'paypal.com',
    'perfectpay.com.br',
    'greenn.com.br',
    'pepper.com.br'
];

// Padrões de URL que indicam checkout/compra
const CHECKOUT_URL_PATTERNS = [
    /checkout/i,
    /\/pay\b/i,
    /\/comprar/i,
    /\/pagamento/i,
    /\/sign-up/i,
    /\/subscribe/i,
    /\/purchase/i,
    /\/order/i
];

// Padrões que indicam upsell (versão premium, completa, combo)
const UPSELL_INDICATORS = [
    /premium/i,
    /completo/i,
    /complete/i,
    /combo/i,
    /bundle/i,
    /vip/i,
    /gold/i,
    /platinum/i,
    /pro\b/i,
    /avancado/i,
    /avançado/i,
    /master/i,
    /full/i,
    /unlimited/i,
    /anual/i,
    /yearly/i
];

// Padrões que indicam downsell (versão básica, lite, entrada)
const DOWNSELL_INDICATORS = [
    /basico/i,
    /básico/i,
    /basic/i,
    /lite/i,
    /mini/i,
    /starter/i,
    /light/i,
    /entrada/i,
    /mensal/i,
    /monthly/i,
    /trial/i,
    /essencial/i
];

// ═══════════════════════════════════════════════════════════════════
// CLASSIFICADOR PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

/**
 * Verifica se um link é de checkout (domínio conhecido ou padrão de URL)
 * @param {string} url
 * @returns {boolean}
 */
function isCheckoutLink(url) {
    try {
        if (!url || typeof url !== 'string') return false;
        if (!url.startsWith('http')) return false;

        const hostname = new URL(url).hostname.toLowerCase();
        const pathname = new URL(url).pathname.toLowerCase();

        // Verificar domínio conhecido
        if (CHECKOUT_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) {
            return true;
        }

        // Verificar padrão de URL
        if (CHECKOUT_URL_PATTERNS.some(p => p.test(url))) {
            return true;
        }

        return false;
    } catch (_) {
        return false;
    }
}

/**
 * Classifica um link de checkout como primary, upsell ou downsell
 * @param {string} url
 * @returns {'primary' | 'upsell' | 'downsell'}
 */
function classifyCheckoutType(url) {
    try {
        const lowerUrl = url.toLowerCase();

        // Verificar upsell
        if (UPSELL_INDICATORS.some(p => p.test(lowerUrl))) {
            return 'upsell';
        }

        // Verificar downsell
        if (DOWNSELL_INDICATORS.some(p => p.test(lowerUrl))) {
            return 'downsell';
        }

        return 'primary';
    } catch (_) {
        return 'primary';
    }
}

/**
 * Classifica TODOS os links extraídos e retorna estrutura organizada.
 * Alimenta pageData.checkoutLink, pageData.upsells, pageData.downsells
 * 
 * @param {string[]} allLinks - Todos os links extraídos pelo V11.2
 * @param {string|null} existingCheckout - Checkout já descoberto (prioridade máxima)
 * @returns {{ primary: string|null, upsells: string[], downsells: string[], allCheckouts: string[], stats: Object }}
 */
function classifyAllCheckoutLinks(allLinks, existingCheckout = null) {
    try {
        if (!Array.isArray(allLinks) || allLinks.length === 0) {
            return {
                primary: existingCheckout || null,
                upsells: [],
                downsells: [],
                allCheckouts: existingCheckout ? [existingCheckout] : [],
                stats: { total: 0, checkouts: 0, upsells: 0, downsells: 0 }
            };
        }

        // Deduplicar links
        const uniqueLinks = [...new Set(allLinks.filter(l => l && typeof l === 'string'))];

        // Filtrar apenas links de checkout
        const checkoutLinks = uniqueLinks.filter(isCheckoutLink);

        // Classificar cada um
        const classified = {
            primary: [],
            upsell: [],
            downsell: []
        };

        for (const link of checkoutLinks) {
            const type = classifyCheckoutType(link);
            classified[type].push(link);
        }

        // Se existingCheckout já existe, ele é o primary
        // Os outros primaries encontrados vão para um grupo separado
        let finalPrimary = existingCheckout;

        if (!finalPrimary && classified.primary.length > 0) {
            finalPrimary = classified.primary[0];
        }

        // Remover o primary da lista de classificados (evitar duplicata)
        const upsells = classified.upsell.filter(u => u !== finalPrimary);
        const downsells = classified.downsell.filter(d => d !== finalPrimary);

        // Se tem primaries extras (além do escolhido), considerar como alternativas
        const extraPrimaries = classified.primary.filter(p => p !== finalPrimary);

        const stats = {
            total: uniqueLinks.length,
            checkouts: checkoutLinks.length,
            primary: finalPrimary ? 1 : 0,
            upsells: upsells.length,
            downsells: downsells.length,
            extras: extraPrimaries.length
        };

        console.log(`[V13.2.1] 📊 Links classificados: ${stats.checkouts} checkouts de ${stats.total} links | primary=${stats.primary} upsells=${stats.upsells} downsells=${stats.downsells} extras=${stats.extras}`);

        return {
            primary: finalPrimary,
            upsells,
            downsells,
            allCheckouts: checkoutLinks,
            extraPrimaries,
            stats
        };

    } catch (err) {
        console.warn('[V13.2.1] ⚠️ Erro na classificação (fallback):', err.message);
        return {
            primary: existingCheckout || null,
            upsells: [],
            downsells: [],
            allCheckouts: existingCheckout ? [existingCheckout] : [],
            stats: { total: 0, checkouts: 0, error: true }
        };
    }
}

/**
 * Aplica links classificados ao pageData (populando upsells/downsells)
 * ADITIVO: nunca sobrescreve pageData.checkoutLink se já existe
 * 
 * @param {Object} pageData - Dados da página
 * @param {string[]} allLinks - Todos os links extraídos
 * @returns {Object} pageData atualizado
 */
function enrichPageDataWithCheckouts(pageData, allLinks) {
    try {
        if (!pageData || !allLinks) return pageData;

        const result = classifyAllCheckoutLinks(allLinks, pageData.checkoutLink);

        // NUNCA sobrescrever checkoutLink existente
        if (!pageData.checkoutLink && result.primary) {
            pageData.checkoutLink = result.primary;
            console.log(`[V13.2.1] ✅ checkoutLink populado: ${result.primary.substring(0, 60)}`);
        }

        // Alimentar upsells (sempre aditivo)
        if (result.upsells.length > 0) {
            pageData.upsells = result.upsells;
            console.log(`[V13.2.1] 📈 ${result.upsells.length} upsell(s) encontrado(s)`);
        }

        // Alimentar downsells (sempre aditivo)
        if (result.downsells.length > 0) {
            pageData.downsells = result.downsells;
            console.log(`[V13.2.1] 📉 ${result.downsells.length} downsell(s) encontrado(s)`);
        }

        return pageData;

    } catch (err) {
        console.warn('[V13.2.1] ⚠️ Erro ao enriquecer pageData (sem impacto):', err.message);
        return pageData;
    }
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    isCheckoutLink,
    classifyCheckoutType,
    classifyAllCheckoutLinks,
    enrichPageDataWithCheckouts
};
