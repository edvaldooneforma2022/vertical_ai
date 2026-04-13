/**
 * 🔍 V12 — RESPONSE VALIDATOR
 * 
 * Valida a resposta ANTES de enviar ao usuário.
 * Garante qualidade mínima e detecta problemas.
 * 
 * @version 12.0.0
 * @author Link Mágico Team
 */

/**
 * Valida resposta da IA antes do envio
 * @param {Object} params
 * @param {string} params.response - Resposta da IA
 * @param {string} params.checkoutLink - Link de checkout correto
 * @param {string} params.intent - Intenção detectada
 * @param {string} params.message - Mensagem do usuário
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateResponse({ response, checkoutLink, intent, message }) {
    const errors = [];
    const warnings = [];

    try {
        if (!response || typeof response !== 'string') {
            errors.push('EMPTY_RESPONSE');
            return { valid: false, errors, warnings };
        }

        const trimmed = response.trim();

        // Erro: resposta muito curta
        if (trimmed.length < 10) {
            errors.push('TOO_SHORT');
        }

        // Erro: intent=buy mas checkout não presente
        if (intent === 'buy' && checkoutLink && !response.includes(checkoutLink)) {
            errors.push('CHECKOUT_NOT_PRESENT');
        }

        // Aviso: resposta com link diferente do checkout
        if (checkoutLink && response.includes('http') && !response.includes(checkoutLink)) {
            const urlRegex = /https?:\/\/[^\s]+/gi;
            const urls = (response.match(urlRegex) || []);
            const otherCheckoutDomains = urls.filter(u => {
                try {
                    const host = new URL(u).hostname;
                    return (host.includes('hotmart') || host.includes('braip') || 
                            host.includes('kiwify') || host.includes('eduzz') ||
                            host.includes('monetizze') || host.includes('perfectpay'));
                } catch (_) { return false; }
            });
            if (otherCheckoutDomains.length > 0) {
                warnings.push('POSSIBLE_WRONG_CHECKOUT_LINK');
            }
        }

        // Aviso: muitos links (spam)
        const linkCount = (response.match(/https?:\/\/[^\s]+/g) || []).length;
        if (linkCount > 4) {
            warnings.push('TOO_MANY_LINKS');
        }

        // Aviso: resposta muito longa
        if (trimmed.length > 3000) {
            warnings.push('RESPONSE_TOO_LONG');
        }

        // Aviso: caracteres estranhos / encoding quebrado
        if (/\uFFFD|â€™|â€œ|Ã©|Ã£/.test(response)) {
            warnings.push('ENCODING_ISSUES');
        }

        // Aviso: IA se identificando como ChatGPT/GPT
        if (/chatgpt|openai|gpt-4|gpt-3|como modelo de linguagem/i.test(response)) {
            warnings.push('AI_IDENTITY_LEAK');
        }

    } catch (err) {
        console.warn('[RESPONSE-VALIDATOR] ⚠️ Erro na validação:', err.message);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

module.exports = { validateResponse };
