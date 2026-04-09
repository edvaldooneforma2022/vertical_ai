/**
 * 🔗 LINKS MAP V11 — FONTE ÚNICA DE VERDADE PARA LINKS
 * 
 * Centraliza todos os links disponíveis para o contexto da conversa.
 * A IA NÃO DECIDE links — ela apenas recebe o mapa.
 * 
 * REGRAS:
 * - 100% aditivo — não altera link-resolver nem nenhum módulo
 * - try/catch total — retorna mapa vazio se falhar
 * - Não depende de nenhum módulo legado
 * 
 * @version 11.0.0
 * @author Link Mágico Team
 */

/**
 * Constrói mapa de links a partir dos dados da página
 * @param {Object} pageData - Dados extraídos da página
 * @returns {Object} Mapa com checkout, whatsapp, instagram, site
 */
function buildLinksMap(pageData) {
  try {
    if (!pageData || typeof pageData !== 'object') {
      return {
        checkout: null,
        whatsapp: null,
        instagram: null,
        site: null
      };
    }

    // Resolver WhatsApp de múltiplas fontes
    let whatsappLink = null;
    try {
      if (pageData.contatos && pageData.contatos.whatsapp && pageData.contatos.whatsapp.length > 0) {
        whatsappLink = pageData.contatos.whatsapp[0];
      } else if (pageData.whatsapp) {
        whatsappLink = pageData.whatsapp;
      }
    } catch (_) {}

    // Resolver Instagram
    let instagramLink = null;
    try {
      if (pageData.contatos && pageData.contatos.instagram) {
        instagramLink = pageData.contatos.instagram;
      } else if (pageData.instagram) {
        instagramLink = pageData.instagram;
      }
    } catch (_) {}

    return {
      checkout: pageData.checkoutLink || null,
      whatsapp: whatsappLink,
      instagram: instagramLink,
      site: pageData.url || pageData._originalUrl || null
    };

  } catch (err) {
    console.warn('[LINKS-MAP] ⚠️ Erro ao construir mapa:', err.message);
    return {
      checkout: null,
      whatsapp: null,
      instagram: null,
      site: null
    };
  }
}

module.exports = { buildLinksMap };
