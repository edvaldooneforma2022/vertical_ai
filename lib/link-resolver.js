/**
 * 🔗 LINK RESOLVER — MULTI-TENANT SAFE
 * 
 * Resolve o link de checkout correto para o tenant atual.
 */

function resolveCheckoutLink({ context, tenantConfig }) {
  try {
    // 1. Link vindo do contexto da página (maior prioridade, específico para o produto na página)
    if (context?.checkoutUrl) return context.checkoutUrl;
    if (context?.checkout_url) return context.checkout_url;
    
    // 2. Link configurado no Tenant (configuração global do chatbot)
    if (tenantConfig?.checkoutUrl) return tenantConfig.checkoutUrl;
    if (tenantConfig?.checkout_url) return tenantConfig.checkout_url;
    if (tenantConfig?.link_checkout) return tenantConfig.link_checkout;
    
    // 3. Fallback do ambiente (último recurso)
    if (process.env.DEFAULT_CHECKOUT_URL) return process.env.DEFAULT_CHECKOUT_URL;

    return null;

  } catch (err) {
    console.warn('⚠️ [LINK_RESOLVER_ERROR]', err.message);
    return null;
  }
}

module.exports = { resolveCheckoutLink };
