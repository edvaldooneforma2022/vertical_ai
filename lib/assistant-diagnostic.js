/**
 * 🧠 MÓDULO DE DIAGNÓSTICO DO ASSISTENTE
 * 
 * Avalia se o assistente tem dados suficientes para operar com sucesso.
 * Calcula um score de prontidão (0-100) e sugere um modo de operação.
 * 
 * @version 1.0.0
 */

'use strict';

/**
 * Executa o diagnóstico do assistente baseado nos dados extraídos da página
 * @param {Object} processedPageData Dados processados da página de vendas
 * @returns {Object} Resultado do diagnóstico { score, mode, issues, warnings, ready }
 */
function runAssistantDiagnostic(processedPageData) {
    try {
        if (!processedPageData) {
            return {
                score: 0,
                mode: 'MANUAL',
                issues: ['DATA_MISSING'],
                warnings: [],
                ready: false
            };
        }

        let score = 0;
        const issues = [];
        const warnings = [];
        let isWaCta = false; // Flag para cap de score WA-only

        // 1. CHECKOUT (Crítico para vendas)
        const checkout = processedPageData.checkoutLink || processedPageData.checkout;
        const checkoutSource = processedPageData.checkoutSource || processedPageData._checkoutSource || null;
        if (checkout && String(checkout).startsWith('http')) {
            // WA-CTA: +30 pontos (vs +40 do checkout real)
            // Diferenciamos porque WA é conversão indireta, checkout é direta
            if (checkoutSource === 'whatsapp-cta') {
                score += 30;
                isWaCta = true;
                warnings.push('CHECKOUT_VIA_WHATSAPP');
            } else {
                score += 40;
            }
        } else {
            issues.push('CHECKOUT_MISSING');
        }

        // 2. CONTEÚDO (Base de conhecimento)
        const content = processedPageData.cleanText || processedPageData.content || '';
        if (content.length > 500) {
            score += 30;
        } else if (content.length > 200) {
            score += 15;
            warnings.push('CONTENT_LOW');
        } else {
            warnings.push('CONTENT_WEAK');
        }

        // 3. FAQ (Dúvidas frequentes)
        // V14.2.1 FIX: Suportar múltiplos nomes de campo
        const faq = processedPageData.faq 
            || processedPageData.faqs 
            || processedPageData.perguntas_frequentes 
            || [];
        if (faq.length >= 3) {
            score += 15;
        } else if (faq.length > 0) {
            score += 7;
            warnings.push('FAQ_LOW');
        } else {
            warnings.push('FAQ_MISSING');
        }

        // 4. WHATSAPP (Canal de suporte)
        // V14.2.1 FIX: Buscar em contatos.whatsapp[] (campo aninhado) + aceitar números formatados
        const whatsapp = processedPageData.whatsapp 
            || processedPageData.whatsappLink
            || (processedPageData.contatos?.whatsapp?.[0])
            || (processedPageData.contatos?.whatsappLinks?.[0])
            || null;
        const whatsappStr = whatsapp ? String(whatsapp) : '';
        if (whatsappStr && (
            whatsappStr.includes('wa.me') || 
            whatsappStr.includes('api.whatsapp.com') ||
            whatsappStr.includes('whatsapp.com') ||
            /^\+?\d{10,13}$/.test(whatsappStr.replace(/\D/g, ''))
        )) {
            score += 15;
        } else {
            issues.push('WHATSAPP_MISSING');
        }

        // ⚠️ CAP de score para sites WA-only (evita inflação)
        // WA é conversão indireta — não deve atingir 100
        if (isWaCta) {
            score = Math.min(score, 85);
        }

        // 5. CLASSIFICAÇÃO DE MODO
        let mode = 'MANUAL';
        if (score >= 80) {
            mode = 'AUTO';
        } else if (score >= 50) {
            mode = 'LIMITED';
        } else {
            mode = 'MANUAL';
        }

        return {
            score,
            mode,
            issues,
            warnings,
            ready: score >= 80,
            isWaCta, // Expor para debugging
            timestamp: new Date().toISOString()
        };

    } catch (e) {
        console.error('[DIAGNOSTIC] ❌ Erro ao executar diagnóstico:', e.message);
        return {
            score: 0,
            mode: 'MANUAL',
            issues: ['DIAGNOSTIC_ERROR'],
            warnings: [],
            ready: false
        };
    }
}

module.exports = { runAssistantDiagnostic };
