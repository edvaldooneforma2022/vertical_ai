/**
 * 🚀 WA-CTA PROMOTER — Promoção Universal de WhatsApp como CTA
 * 
 * PRINCÍPIO: Quando não existe checkout mas existe WhatsApp com intenção
 * de conversão, promover WhatsApp como CTA primário.
 * 
 * REGRA DE OURO: Isso resolve uma CLASSE de problema, não um site.
 * Classe coberta: "WA-first" — sites sem checkout, conversão via WhatsApp.
 * 
 * SEGURANÇA:
 *   - Feature flag: FEATURE_WA_CTA_PROMOTER
 *   - NUNCA sobrescreve checkout existente
 *   - Scoring de intenção com threshold (confidence >= 0.6)
 *   - Diferencia WA de conversão vs WA de suporte/footer
 *   - try/catch total com fallback silencioso
 *   - Log detalhado com confidence + reason
 * 
 * @version 1.0.0
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════
// CONSTANTES — Heurísticas universais (NUNCA por domínio)
// ═══════════════════════════════════════════════════════════════════

/** Keywords que indicam INTENÇÃO DE CONVERSÃO (positivas) */
const CTA_KEYWORDS_HIGH = [
    'comprar', 'compre', 'adquir', 'quero', 'comecar', 'começar',
    'contratar', 'assinar', 'matricular', 'inscrever', 'garanti',
    'agendar', 'reservar', 'solicitar', 'pedir', 'encomendar'
];

const CTA_KEYWORDS_MED = [
    'falar com', 'fale com', 'especialista', 'consultor', 'vendedor',
    'orçamento', 'orcamento', 'cotação', 'cotacao', 'proposta',
    'demonstração', 'demonstracao', 'demo', 'teste grátis', 'teste gratis',
    'saiba mais', 'conhecer', 'experimentar', 'trial', 'começar agora',
    'comece agora', 'start', 'get started', 'buy', 'purchase', 'order'
];

/** Keywords que indicam SUPORTE/CONTATO — NÃO é conversão */
const SUPPORT_KEYWORDS = [
    'suporte', 'support', 'ajuda', 'help', 'dúvida', 'duvida',
    'reclamação', 'reclamacao', 'problema', 'cancelar', 'cancelamento',
    'reembolso', 'estorno', 'troca', 'devolução', 'devolucao',
    'atendimento ao cliente', 'customer service', 'sac', 'ouvidoria'
];

/** Threshold mínimo de confiança para promoção */
const CONFIDENCE_THRESHOLD = 0.6;

/** Score máximo no diagnóstico para sites WA-only */
const WA_CTA_SCORE_CAP = 85;

// ═══════════════════════════════════════════════════════════════════
// SCORING ENGINE — Avalia intenção de conversão do WhatsApp
// ═══════════════════════════════════════════════════════════════════

/**
 * Avalia se um link WhatsApp tem intenção de conversão (não apenas suporte)
 * 
 * @param {Object} context - Contexto da página extraída
 * @param {string} context.whatsappLink - URL do WhatsApp
 * @param {Array} context.whatsappLinks - Todas as URLs WhatsApp
 * @param {string} context.anchorText - Texto âncora do link WA (se disponível)
 * @param {Array} context.discoveredLinks - Todos os links descobertos na página
 * @param {string} context.cleanText - Texto limpo da página
 * @param {Object} context.contatos - Objeto de contatos extraídos
 * @returns {{ isConversion: boolean, confidence: number, reasons: string[] }}
 */
function evaluateWhatsAppIntent(context = {}) {
    let confidence = 0;
    const reasons = [];

    try {
        const waLink = context.whatsappLink || '';
        const waLinks = context.whatsappLinks || context.contatos?.whatsappLinks || [];
        const allLinks = context.discoveredLinks || [];
        const cleanText = (context.cleanText || '').toLowerCase();

        // Se não tem WA, retorna imediatamente
        if (!waLink && waLinks.length === 0) {
            return { isConversion: false, confidence: 0, reasons: ['no_whatsapp'] };
        }

        // ─── SINAIS POSITIVOS ───────────────────────────────────

        // 1. Keywords de CTA no texto âncora do link WhatsApp
        const anchorText = (context.anchorText || '').toLowerCase();
        const allAnchorTexts = allLinks
            .filter(l => {
                const href = (l.href || l.url || '').toLowerCase();
                return href.includes('wa.me') || href.includes('whatsapp');
            })
            .map(l => (l.text || '').toLowerCase())
            .join(' ');
        
        const combinedAnchor = `${anchorText} ${allAnchorTexts}`;
        
        for (const kw of CTA_KEYWORDS_HIGH) {
            if (combinedAnchor.includes(kw)) {
                confidence += 0.25;
                reasons.push(`keyword_high:${kw}`);
                break; // Evitar acumulação excessiva
            }
        }

        for (const kw of CTA_KEYWORDS_MED) {
            if (combinedAnchor.includes(kw)) {
                confidence += 0.15;
                reasons.push(`keyword_med:${kw}`);
                break;
            }
        }

        // 2. WA aparece como link primário/repetido (sinal de CTA, não de footer)
        const waLinkCount = allLinks.filter(l => {
            const href = (l.href || l.url || '').toLowerCase();
            return href.includes('wa.me') || href.includes('whatsapp');
        }).length;

        if (waLinkCount >= 3) {
            confidence += 0.20;
            reasons.push(`wa_repeated:${waLinkCount}x`);
        } else if (waLinkCount >= 2) {
            confidence += 0.10;
            reasons.push(`wa_present:${waLinkCount}x`);
        }

        // 3. Página tem keywords de conversão no conteúdo geral
        const conversionKeywordsInPage = CTA_KEYWORDS_HIGH.filter(kw => cleanText.includes(kw));
        if (conversionKeywordsInPage.length >= 2) {
            confidence += 0.15;
            reasons.push(`page_conversion_context:${conversionKeywordsInPage.length}kw`);
        } else if (conversionKeywordsInPage.length >= 1) {
            confidence += 0.08;
            reasons.push(`page_has_conversion_kw`);
        }

        // 4. WA tem parâmetro de mensagem pré-definida (sinal forte de CTA)
        const waUrl = waLink || (waLinks[0] || '');
        if (waUrl.includes('text=') || waUrl.includes('message=')) {
            confidence += 0.15;
            reasons.push('wa_has_pretext');
        }

        // 5. Nenhum outro CTA existe (checkout, form, etc.)
        // Se estamos aqui, checkout já é null — isso por si só é um sinal
        confidence += 0.15;
        reasons.push('no_checkout_available');

        // ─── SINAIS NEGATIVOS (penalização) ─────────────────────

        // 6. WA aparece apenas com keywords de suporte
        for (const kw of SUPPORT_KEYWORDS) {
            if (combinedAnchor.includes(kw)) {
                confidence -= 0.30;
                reasons.push(`support_keyword:${kw}`);
                break;
            }
        }

        // 7. WA aparece apenas uma vez e sem contexto de CTA
        if (waLinkCount <= 1 && conversionKeywordsInPage.length === 0 && !waUrl.includes('text=')) {
            confidence -= 0.15;
            reasons.push('wa_isolated_no_context');
        }

        // Clamp 0-1
        confidence = Math.max(0, Math.min(1, confidence));

    } catch (err) {
        console.error('[WA-CTA] ⚠️ Erro ao avaliar intenção:', err.message);
        return { isConversion: false, confidence: 0, reasons: ['evaluation_error'] };
    }

    return {
        isConversion: confidence >= CONFIDENCE_THRESHOLD,
        confidence: Math.round(confidence * 100) / 100,
        reasons
    };
}

// ═══════════════════════════════════════════════════════════════════
// PROMOTER — Executa promoção controlada
// ═══════════════════════════════════════════════════════════════════

/**
 * Seleciona o melhor link WhatsApp para promoção como CTA
 * Prioriza: links com texto pré-definido > links com número > links genéricos
 * 
 * @param {string[]} waLinks - Array de URLs WhatsApp
 * @returns {string|null} Melhor link selecionado
 */
function selectPrimaryWhatsApp(waLinks) {
    if (!waLinks || waLinks.length === 0) return null;

    // Prioridade 1: link com mensagem pré-definida
    const withText = waLinks.find(l => l.includes('text=') || l.includes('message='));
    if (withText) return withText;

    // Prioridade 2: link wa.me com número
    const waMeWithNum = waLinks.find(l => /wa\.me\/\d+/.test(l));
    if (waMeWithNum) return waMeWithNum;

    // Prioridade 3: api.whatsapp.com com phone
    const apiWa = waLinks.find(l => l.includes('api.whatsapp.com') && l.includes('phone='));
    if (apiWa) return apiWa;

    // Fallback: primeiro link
    return waLinks[0];
}

/**
 * 🚀 FUNÇÃO PRINCIPAL — Promove WhatsApp como CTA quando aplicável
 * 
 * REGRAS:
 * - NUNCA sobrescreve checkout existente
 * - Só promove se confidence >= 0.6
 * - Retorna dados sem mutar o original (promoterResult separado)
 * 
 * @param {Object} pageData - Dados extraídos da página
 * @returns {{ promoted: boolean, checkoutLink: string|null, checkoutSource: string, confidence: number, reasons: string[], scoreCap: number }}
 */
function promoteWhatsAppToCTA(pageData) {
    const result = {
        promoted: false,
        checkoutLink: null,
        checkoutSource: null,
        confidence: 0,
        reasons: [],
        scoreCap: 0 // 0 = sem cap
    };

    try {
        // GUARD 1: Se já tem checkout, NUNCA promover
        if (pageData.checkoutLink) {
            console.log('[WA-CTA] ℹ️ Checkout já existe — WA NÃO promovido');
            return result;
        }

        // Coletar todas as URLs WhatsApp disponíveis
        const waLinks = [];
        if (pageData.whatsappLink) waLinks.push(pageData.whatsappLink);
        if (pageData.contatos?.whatsappLinks) {
            for (const l of pageData.contatos.whatsappLinks) {
                if (l && !waLinks.includes(l)) waLinks.push(l);
            }
        }
        if (pageData.contatos?.whatsapp) {
            for (const num of pageData.contatos.whatsapp) {
                if (num) {
                    const cleanNum = num.replace(/\D/g, '');
                    const waUrl = `https://wa.me/${cleanNum}`;
                    if (!waLinks.includes(waUrl)) waLinks.push(waUrl);
                }
            }
        }

        // GUARD 2: Sem WhatsApp, nada a fazer
        if (waLinks.length === 0) {
            console.log('[WA-CTA] ℹ️ Nenhum WhatsApp encontrado — sem promoção');
            return result;
        }

        // Avaliar intenção de conversão
        const intent = evaluateWhatsAppIntent({
            whatsappLink: waLinks[0],
            whatsappLinks: waLinks,
            anchorText: '',
            discoveredLinks: pageData.discoveredLinks || [],
            cleanText: pageData.cleanText || '',
            contatos: pageData.contatos || {}
        });

        result.confidence = intent.confidence;
        result.reasons = intent.reasons;

        // GUARD 3: Confiança insuficiente
        if (!intent.isConversion) {
            console.log(`[WA-CTA] ⚠️ Confiança insuficiente (${intent.confidence}) — WA NÃO promovido | reasons=${intent.reasons.join(',')}`);
            return result;
        }

        // ✅ PROMOÇÃO APROVADA
        const selectedWA = selectPrimaryWhatsApp(waLinks);
        if (!selectedWA) {
            console.log('[WA-CTA] ⚠️ Nenhum link WA válido selecionado');
            return result;
        }

        result.promoted = true;
        result.checkoutLink = selectedWA;
        result.checkoutSource = 'whatsapp-cta';
        result.scoreCap = WA_CTA_SCORE_CAP;

        console.log(`[WA-CTA] 🚀 WhatsApp PROMOVIDO a CTA | url=${selectedWA.substring(0, 80)} | confidence=${intent.confidence} | reasons=${intent.reasons.join(',')}`);

    } catch (err) {
        console.error('[WA-CTA] ❌ Erro na promoção (sem impacto):', err.message);
    }

    return result;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    promoteWhatsAppToCTA,
    evaluateWhatsAppIntent,
    selectPrimaryWhatsApp,
    // Constantes exportadas para testes
    CONFIDENCE_THRESHOLD,
    WA_CTA_SCORE_CAP,
    CTA_KEYWORDS_HIGH,
    CTA_KEYWORDS_MED,
    SUPPORT_KEYWORDS
};
