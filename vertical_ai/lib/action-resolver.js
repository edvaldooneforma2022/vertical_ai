/**
 * 🎯 ACTION RESOLVER V11 — RESOLVE AÇÃO POR INTENÇÃO
 * 
 * Dado um intent e o mapa de links, retorna o link correto para a ação.
 * Determinístico — sem IA, sem adivinhação.
 * 
 * REGRAS:
 * - 100% aditivo — não altera nenhum módulo
 * - Determinístico — mesma entrada = mesma saída
 * - try/catch total — fallback para null
 * 
 * @version 11.0.0
 * @author Link Mágico Team
 */

/**
 * Resolve ação com base na intenção detectada
 * @param {string} intent - Intenção do usuário (buy, human, instagram, etc)
 * @param {Object} links - Mapa de links do buildLinksMap
 * @returns {string|null} URL para a ação, ou null
 */
function resolveAction(intent, links) {
  try {
    if (!intent || !links || typeof links !== 'object') {
      return null;
    }

    switch (intent) {
      case 'buy':
        return links.checkout || null;

      case 'human':
        return links.whatsapp || null;

      case 'instagram':
        return links.instagram || null;

      case 'checkout_issue':
        // Reenviar o checkout correto
        return links.checkout || null;

      default:
        return null;
    }
  } catch (err) {
    console.warn('[ACTION-RESOLVER] ⚠️ Erro:', err.message);
    return null;
  }
}

module.exports = { resolveAction };
