/**
 * 🔗 NORMALIZE LINKS — Link Mágico V8.0
 *
 * Converte números de telefone brutos em links wa.me clicáveis.
 * Roda ANTES do processMessageContent (client-side) para que
 * o pipeline URL→Botão capture os links gerados.
 *
 * Pipeline: IA gera texto → normalizeLinks() → client processMessageContent() → botão
 *
 * [FASE 4] ÚNICA FONTE DE VERDADE para transformação de telefone → link
 * O sales-layer (F12) apenas detecta; este módulo faz a conversão real.
 *
 * @version 2.0.0
 */

'use strict';

/**
 * Converte números de telefone brasileiros em links wa.me.
 * Suporta:
 *   "+5511962607237"           → "https://wa.me/5511962607237"
 *   "+55 (11) 96260-7237"     → "https://wa.me/5511962607237"
 *   "11 96260-7237"           → "https://wa.me/5511962607237"
 *   "0800 123 4567"           → NÃO converte (0800 não é WhatsApp)
 *
 * NÃO altera URLs já existentes (wa.me, https://, <a href).
 *
 * @param {string} text
 * @returns {string}
 */
function normalizeLinks(text) {
  try {
    if (!text || typeof text !== 'string') return text;

    // Guard: se já tem link formatado, evita dupla conversão
    if (text.includes('<a ')) return text;

    // Regex que captura formatos variados de telefone brasileiro
    // +55 (11) 96260-7237, 11962607237, +5511962607237, (11) 9 6260-7237
    const phoneRegex = /(\+?\d{1,3}[\s.-]?)?\(?\d{2}\)?[\s.-]?\d?\s?\d{4}[\s.-]?\d{4}/g;

    return text.replace(phoneRegex, function (match, _prefix, _offset) {
      // Extrair apenas dígitos
      const digits = match.replace(/\D/g, '');

      // Validar: precisa ter pelo menos 10 dígitos (DDD + número)
      if (digits.length < 10 || digits.length > 15) return match;

      // NÃO converter 0800 (não é WhatsApp)
      if (digits.startsWith('0800') || digits.startsWith('0300')) return match;

      // Verificar se esse número já está dentro de um link wa.me
      const matchIndex = text.indexOf(match);
      const before60 = text.substring(Math.max(0, matchIndex - 60), matchIndex);
      if (before60.includes('wa.me/')) return match;
      if (before60.includes('href="')) return match;

      // Garantir prefixo 55 (Brasil)
      const normalized = digits.startsWith('55') ? digits : '55' + digits;

      if (process.env.DEBUG_SALES === 'true') {
        console.log(`🔗 [NORMALIZE-LINKS] ${match} → https://wa.me/${normalized}`);
      }

      return 'https://wa.me/' + normalized;
    });
  } catch (err) {
    // Fallback silencioso — nunca quebra o texto original
    return text;
  }
}

module.exports = normalizeLinks;
