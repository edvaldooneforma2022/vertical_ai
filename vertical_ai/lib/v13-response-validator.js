/**
 * 🧩 V13 — RESPONSE VALIDATOR (ANTI-ALUCINAÇÃO FORTE)
 * 
 * Valida DEPOIS da IA responder.
 * Se falhar → fallback padrão (NUNCA deixa alucinação passar).
 * 
 * Checks:
 * - Tamanho máximo (400 chars)
 * - Frases proibidas (suposições)
 * - Invenção de dados (dados que não existem no contexto)
 * - Múltiplas perguntas (sinal de fuga)
 * - Links não autorizados
 * - Identity leak (ChatGPT, GPT)
 * - Encoding quebrado
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════════════════

const MAX_RESPONSE_LENGTH = 400;

const FORBIDDEN_PHRASES = [
    /\b(talvez|imagino\s+que|provavelmente|possível\s+que|pode\s+ser\s+que)\b/i,
    /\b(acredito\s+que|suponho|presumo|arriscaria\s+dizer)\b/i,
    /\b(pelo\s+que\s+eu\s+sei|se\s+não\s+me\s+engano|se\s+eu\s+tivesse\s+que\s+adivinhar)\b/i,
    /\b(ótima\s+pergunta|excelente\s+pergunta|boa\s+pergunta)\b/i,
    /\b(com\s+certeza|sem\s+dúvida\s+alguma|absolutamente\s+fantástico)\b/i
];

const IDENTITY_LEAK_PATTERNS = [
    /\b(chatgpt|gpt-4|gpt-3|openai|claude|gemini|anthropic)\b/i,
    /\b(como\s+uma?\s+ia|como\s+inteligência\s+artificial|sou\s+uma?\s+ia)\b/i,
    /\b(meu\s+treinamento|fui\s+treinado|meus\s+dados\s+de\s+treinamento)\b/i
];

const ENCODING_PATTERNS = [
    /â€|Ã¡|Ã©|Ã³|Ã§|&amp;|&lt;|&gt;/,
    /\u0000|\ufffd/
];

// Fallback padrão quando validação falha
const FALLBACK_RESPONSE = 'Me diga exatamente o que você quer saber para eu te responder com precisão.';

// ═══════════════════════════════════════════════════════════════════
// VALIDADOR PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

/**
 * Valida a resposta da IA
 * @param {string} response - Resposta gerada pela IA
 * @param {Object} context - { productName, checkoutLink, action }
 * @returns {{ valid: boolean, response: string, issues: string[] }}
 */
function validateResponse(response, context = {}) {
    const issues = [];

    // 0. Resposta vazia ou nula
    if (!response || typeof response !== 'string' || response.trim().length < 5) {
        return {
            valid: false,
            response: FALLBACK_RESPONSE,
            issues: ['EMPTY_RESPONSE']
        };
    }

    let cleanResponse = response.trim();

    // 1. TAMANHO — truncar se necessário (não rejeitar)
    if (cleanResponse.length > MAX_RESPONSE_LENGTH) {
        // Tentar cortar num ponto natural (ponto, interrogação, exclamação)
        const cutPoint = cleanResponse.substring(0, MAX_RESPONSE_LENGTH).lastIndexOf('.');
        if (cutPoint > MAX_RESPONSE_LENGTH * 0.5) {
            cleanResponse = cleanResponse.substring(0, cutPoint + 1);
        } else {
            cleanResponse = cleanResponse.substring(0, MAX_RESPONSE_LENGTH) + '...';
        }
        issues.push('TRUNCATED');
    }

    // 2. FRASES PROIBIDAS (suposições, floreio)
    for (const pattern of FORBIDDEN_PHRASES) {
        if (pattern.test(cleanResponse)) {
            // Não rejeitar completamente — remover a frase
            cleanResponse = cleanResponse.replace(pattern, '').replace(/\s{2,}/g, ' ').trim();
            issues.push('FORBIDDEN_PHRASE_REMOVED');
        }
    }

    // 3. IDENTITY LEAK — rejeitar completamente
    for (const pattern of IDENTITY_LEAK_PATTERNS) {
        if (pattern.test(cleanResponse)) {
            return {
                valid: false,
                response: FALLBACK_RESPONSE,
                issues: ['IDENTITY_LEAK']
            };
        }
    }

    // 4. ENCODING QUEBRADO — rejeitar
    for (const pattern of ENCODING_PATTERNS) {
        if (pattern.test(cleanResponse)) {
            return {
                valid: false,
                response: FALLBACK_RESPONSE,
                issues: ['BROKEN_ENCODING']
            };
        }
    }

    // 5. MÚLTIPLAS PERGUNTAS (sinal de fuga — IA não sabe o que fazer)
    const questionCount = (cleanResponse.match(/\?/g) || []).length;
    if (questionCount > 2) {
        // Manter apenas até a segunda pergunta
        let qCount = 0;
        let cutIdx = cleanResponse.length;
        for (let i = 0; i < cleanResponse.length; i++) {
            if (cleanResponse[i] === '?') {
                qCount++;
                if (qCount >= 2) {
                    cutIdx = i + 1;
                    break;
                }
            }
        }
        cleanResponse = cleanResponse.substring(0, cutIdx).trim();
        issues.push('TOO_MANY_QUESTIONS');
    }

    // 6. LINKS NÃO AUTORIZADOS
    const urlsInResponse = cleanResponse.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi) || [];
    if (urlsInResponse.length > 0) {
        const correctCheckout = context.checkoutLink || '';
        for (const url of urlsInResponse) {
            // Se tem checkout correto, verificar se o URL é o correto
            if (correctCheckout && !url.includes(correctCheckout.split('//')[1]?.split('/')[0] || '___')) {
                // Links de contato (wa.me) são permitidos
                if (!url.includes('wa.me') && !url.includes('whatsapp')) {
                    cleanResponse = cleanResponse.replace(url, '').trim();
                    issues.push('UNAUTHORIZED_LINK_REMOVED');
                }
            }
        }
    }

    // 7. INVENÇÃO DE DADOS — verificar se menciona produto sem contexto
    if (!context.productName && /\b(nosso\s+produto|nosso\s+curso|nosso\s+método|nosso\s+treinamento)\b/i.test(cleanResponse)) {
        issues.push('POSSIBLE_INVENTION');
        // Não rejeitar — apenas marcar
    }

    // 8. TAGS HTML residuais
    cleanResponse = cleanResponse.replace(/<[^>]*>/g, '').replace(/\[OUT\]/g, '').trim();

    // Limpeza final de espaços extras
    cleanResponse = cleanResponse.replace(/\n{3,}/g, '\n\n').replace(/\s{2,}/g, ' ').trim();

    // Se após limpeza ficou muito curto
    if (cleanResponse.length < 5) {
        return {
            valid: false,
            response: FALLBACK_RESPONSE,
            issues: ['EMPTY_AFTER_CLEANUP']
        };
    }

    return {
        valid: issues.length === 0 || !issues.includes('IDENTITY_LEAK'),
        response: cleanResponse,
        issues: issues
    };
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    validateResponse,
    FALLBACK_RESPONSE,
    MAX_RESPONSE_LENGTH
};
