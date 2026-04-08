/**
 * 🧠 ORCHESTRATOR V10.1 — CAMADA ÚNICA DE DECISÃO FINAL
 * 
 * V10.1: Agora respeita classificação granular de intenção.
 *        NÃO injeta checkout/CTA quando intent ≠ buy.
 * 
 * Hierarquia de prioridade:
 *   1. Bypass total (modo manual/off)
 *   2. Bloqueio de checkout (info/objection/human/stress/neutral)
 *   3. Pós-venda (mata CTA/Closing/Venda)
 *   4. Problema com checkout (reenvia link)
 *   5. Compra (garante link, sem CTA duplicado)
 *   6. CTA (apenas se intent = interest e não houver decisão forte)
 *   7. Closing (apenas se não redundante)
 * 
 * REGRAS:
 * - 100% aditivo — não altera camadas anteriores
 * - try/catch total — fallback para resposta original
 * - Feature flag gated (FEATURE_ORCHESTRATOR_V10)
 * - Respeita modos da IA (auto/manual/off)
 * 
 * @version 10.1.0
 * @author Link Mágico Team
 */

class Orchestrator {
  constructor({ featureFlags } = {}) {
    this.featureFlags = featureFlags || null;
    console.log('🧠 [ORCHESTRATOR_V10.1] Instância criada');
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
      const intent = decision?.intent || 'neutral';

      // ═══════════════════════════════════════════
      // BYPASS: modo manual ou desligado → zero interferência
      // ═══════════════════════════════════════════
      if (mode !== 'auto') {
        return { text: final, orchestrated: false, reason: 'mode_bypass' };
      }

      // ═══════════════════════════════════════════
      // V10.1 PRIORIDADE 0 — BLOQUEIO DE CHECKOUT EM INTENTS NÃO-COMPRA
      // Se intent é info/objection/human/stress/neutral → NÃO adicionar checkout
      // A IA deve responder com conteúdo, não com link
      // ═══════════════════════════════════════════
      const NON_CHECKOUT_INTENTS = ['info', 'objection', 'human', 'stress', 'neutral'];
      if (NON_CHECKOUT_INTENTS.includes(intent)) {
        console.log(`🧠 [ORCHESTRATOR_V10.1] Intent="${intent}" → Sem checkout/CTA/Closing`);
        // V10.1: NÃO adicionar nenhum CTA, Closing ou link de checkout
        // A resposta da IA já foi guiada pelo Behavior Layer
        return {
          text: final,
          orchestrated: true,
          reason: `intent_${intent}_no_oversell`
        };
      }

      // ═══════════════════════════════════════════
      // PRIORIDADE 1 — PÓS-VENDA (mata tudo)
      // Se o usuário já comprou, não faz sentido CTA/Closing/Venda
      // ═══════════════════════════════════════════
      if (intent === 'post_sale') {
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
      // PRIORIDADE 1.5 — CHECKOUT ISSUE (reenvia link correto)
      // ═══════════════════════════════════════════
      if (intent === 'checkout_issue') {
        const link = this._resolveLink(context);
        if (link && !final.includes(link)) {
          final += `\n\n✅ Este é o link oficial e seguro de pagamento:\n${link}`;
        }
        return {
          text: final,
          orchestrated: true,
          reason: 'checkout_issue'
        };
      }

      // ═══════════════════════════════════════════
      // PRIORIDADE 2 — COMPRA (garante link, sem duplicação)
      // ═══════════════════════════════════════════
      if (intent === 'buy') {
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
      // PRIORIDADE 3 — INTEREST (pode ter CTA leve, sem checkout forçado)
      // ═══════════════════════════════════════════
      if (intent === 'interest') {
        // CTA suave para interesse — sem forçar link
        if (ctaData && ctaData.text && typeof ctaData.text === 'string') {
          if (!final.includes(ctaData.text.trim())) {
            final += `\n\n${ctaData.text}`;
          }
        }
        // NÃO adicionar Closing em interest — manter conversa fluindo
        return {
          text: final,
          orchestrated: true,
          reason: 'interest'
        };
      }

      // ═══════════════════════════════════════════
      // DEFAULT — retorna resposta como está
      // ═══════════════════════════════════════════
      return {
        text: final,
        orchestrated: true,
        reason: 'default'
      };

    } catch (err) {
      console.error('[ORCHESTRATOR_V10.1_ERROR]', err.message || err);

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
