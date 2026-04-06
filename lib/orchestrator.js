/**
 * 🧠 ORCHESTRATOR V10 — CAMADA ÚNICA DE DECISÃO FINAL
 * 
 * Hierarquia de prioridade:
 *   1. Bypass total (modo manual/off)
 *   2. Pós-venda (mata CTA/Closing/Venda)
 *   3. Compra (garante link, sem CTA duplicado)
 *   4. CTA (apenas se não houver decisão forte)
 *   5. Closing (apenas se não redundante)
 * 
 * REGRAS:
 * - 100% aditivo — não altera camadas anteriores
 * - try/catch total — fallback para resposta original
 * - Feature flag gated (FEATURE_ORCHESTRATOR_V10)
 * - Respeita modos da IA (auto/manual/off)
 * 
 * @version 10.0.0
 * @author Link Mágico Team
 */

class Orchestrator {
  constructor({ featureFlags } = {}) {
    this.featureFlags = featureFlags || null;
    console.log('🧠 [ORCHESTRATOR_V10] Instância criada');
  }

  /**
   * Aplica orquestração hierárquica na resposta final
   * 
   * @param {Object} params
   * @param {string} params.response - Resposta base da IA
   * @param {Object} params.context - Dados da página/contexto (ex: checkoutUrl)
   * @param {Object} params.decision - Resultado do Decision Core ({ intent, shouldOverride })
   * @param {Object} params.ctaData - Dados do CTA Engine (se aplicado)
   * @param {Object} params.closingData - Dados do Closing Scripts (se aplicado)
   * @param {string} params.mode - Modo da IA: 'auto' | 'manual' | 'off'
   * @returns {{ text: string, orchestrated: boolean, reason: string, fallback?: boolean }}
   */
  apply({
    response,
    context,
    decision,
    ctaData,
    closingData,
    mode
  }) {
    try {
      // Validação de entrada
      if (!response || typeof response !== 'string') {
        return { text: response || '', orchestrated: false, reason: 'invalid_input' };
      }

      // Fallback padrão
      let final = response;

      // ═══════════════════════════════════════════
      // BYPASS: modo manual ou desligado → zero interferência
      // ═══════════════════════════════════════════
      if (mode !== 'auto') {
        return { text: final, orchestrated: false, reason: 'mode_bypass' };
      }

      // ═══════════════════════════════════════════
      // PRIORIDADE 1 — PÓS-VENDA (mata tudo)
      // Se o usuário já comprou, não faz sentido CTA/Closing/Venda
      // ═══════════════════════════════════════════
      if (decision && decision.intent === 'post_sale') {
        // Manter resposta da IA mas garantir direcionamento pós-venda
        const postSaleMsg = '👉 Perfeito, como você já comprou, me diga o que você já recebeu para eu te ajudar melhor.';
        
        // Só adicionar se a resposta não tem conteúdo pós-venda similar
        if (!final.includes('já comprou') && !final.includes('já recebeu') && !final.includes('guio no próximo')) {
          final = `${final}\n\n${postSaleMsg}`;
        }

        return {
          text: final,
          orchestrated: true,
          reason: 'post_sale'
        };
      }

      // ═══════════════════════════════════════════
      // PRIORIDADE 2 — COMPRA (garante link, sem duplicação)
      // ═══════════════════════════════════════════
      if (decision && decision.intent === 'buy') {
        const link = this._resolveLink(context);

        if (link && !final.includes(link)) {
          final += `\n\n👉 Para finalizar com segurança:\n${link}`;
        }

        // Em modo compra: NÃO adicionar CTA nem Closing
        // A resposta da IA + link já é suficiente
        return {
          text: final,
          orchestrated: true,
          reason: 'buy'
        };
      }

      // ═══════════════════════════════════════════
      // PRIORIDADE 3 — CTA (apenas se não houver decisão forte)
      // Só aplica se CTA Engine gerou algo E não está duplicado
      // ═══════════════════════════════════════════
      if (ctaData && ctaData.text && typeof ctaData.text === 'string') {
        // Evitar duplicação: só adicionar se texto do CTA não existe na resposta
        if (!final.includes(ctaData.text.trim())) {
          final += `\n\n${ctaData.text}`;
        }
      }

      // ═══════════════════════════════════════════
      // PRIORIDADE 4 — CLOSING (apenas se não redundante)
      // Só aplica se Closing Scripts gerou algo E não repete CTA
      // ═══════════════════════════════════════════
      if (closingData && closingData.text && typeof closingData.text === 'string') {
        const closingTrimmed = closingData.text.trim();
        // Evitar: closing duplicando CTA ou conteúdo existente
        if (closingTrimmed && !final.includes(closingTrimmed)) {
          final += `\n\n${closingData.text}`;
        }
      }

      return {
        text: final,
        orchestrated: true,
        reason: 'default'
      };

    } catch (err) {
      console.error('[ORCHESTRATOR_V10_ERROR]', err.message || err);

      // Fallback absoluto: retorna resposta original sem nenhuma modificação
      return {
        text: response,
        orchestrated: false,
        reason: 'error',
        fallback: true
      };
    }
  }

  /**
   * Resolve link de checkout do contexto disponível
   * @private
   */
  _resolveLink(context) {
    try {
      if (!context) return null;
      // V9.1: checkoutLink from frontend has highest priority
      return context.checkoutLink || context.checkoutUrl || context.checkout_url || null;
    } catch (_) {
      return null;
    }
  }
}

module.exports = Orchestrator;
