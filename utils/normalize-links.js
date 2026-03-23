/**
 * 🔗 NORMALIZE LINKS — Link Mágico V8.0
 *
 * Converte números de telefone brutos em links wa.me clicáveis.
 * Roda ANTES do processMessageContent (client-side) para que
 * o pipeline URL→Botão capture os links gerados.
 *
 * Pipeline: IA gera texto → normalizeLinks() → client processMessageContent() → botão
 *
 * @version 1.0.0
 */

'use strict';

/**
 * Converte números de telefone brasileiros em links wa.me.
 * Exemplos:
 *   "+5511962607237"           → "https://wa.me/5511962607237"
 *   "+55 (11) 96260-7237"     → "https://wa.me/5511962607237"
 *   "envie para 11962607237"  → "envie para https://wa.me/5511962607237"
 *
 * NÃO altera URLs já existentes (wa.me, https://, etc).
 *
 * @param {string} text
 * @returns {string}
 */
function normalizeLinks(text) {
  try {
    if (!text || typeof text !== 'string') return text;

    // Não processar se já contém wa.me (evita dupla conversão)
    // Mas processar se tem número solto ALÉM de wa.me
    const phoneRegex = /(\+?\d{1,3}[\s.-]?)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/g;

    return text.replace(phoneRegex, function (match) {
      // Extrair apenas dígitos
      const digits = match.replace(/\D/g, '');

      // Validar: precisa ter pelo menos 10 dígitos (DDD + número)
      if (digits.length < 10 || digits.length > 15) return match;

      // Verificar se esse número já está dentro de um link wa.me
      const matchIndex = text.indexOf(match);
      const before50 = text.substring(Math.max(0, matchIndex - 50), matchIndex);
      if (before50.includes('wa.me/')) return match;

      // Garantir prefixo 55 (Brasil)
      const normalized = digits.startsWith('55') ? digits : '55' + digits;

      return 'https://wa.me/' + normalized;
    });
  } catch (err) {
    // Fallback silencioso — nunca quebra o texto original
    return text;
  }
}

module.exports = normalizeLinks;
