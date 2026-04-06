/**
 * 🔗 LINK RESOLVER — MULTI-TENANT SAFE
 * 
 * Resolve o link de checkout correto para o tenant atual.
 * 
 * PRIORIDADE (V9.1+):
 *   1️⃣ Frontend auto-detectado (context.checkoutLink) — Smart Selector
 *   2️⃣ Contexto da página (context.checkoutUrl)
 *   3️⃣ Configuração do tenant (tenantConfig.checkout_url)
 *   4️⃣ Variável de ambiente (DEFAULT_CHECKOUT_URL)
 *   5️⃣ null (sem link disponível)
 */

function resolveCheckoutLink({ context, tenantConfig }) {
  try {
    // 1️⃣ Frontend auto-detectado (V9.1 — Smart Checkout Selector)
    // Enviado pelo widget via extractBestCheckoutLink()
    if (context?.checkoutLink) {
      console.log('[LINK-RESOLVER] ✅ usando checkout auto-detectado do frontend:', context.checkoutLink.substring(0, 60));
      return context.checkoutLink;
    }

    // 2️⃣ Link vindo do contexto da página (maior prioridade backend)
    if (context?.checkoutUrl) return context.checkoutUrl;
    if (context?.checkout_url) return context.checkout_url;
    
    // 3️⃣ Link configurado no Tenant (configuração global do chatbot)
    if (tenantConfig?.checkoutUrl) return tenantConfig.checkoutUrl;
    if (tenantConfig?.checkout_url) return tenantConfig.checkout_url;
    if (tenantConfig?.link_checkout) return tenantConfig.link_checkout;
    
    // 4️⃣ Fallback do ambiente (último recurso)
    if (process.env.DEFAULT_CHECKOUT_URL) return process.env.DEFAULT_CHECKOUT_URL;

    return null;

  } catch (err) {
    console.warn('⚠️ [LINK_RESOLVER_ERROR]', err.message);
    return null;
  }
}

module.exports = { resolveCheckoutLink };
