/**
 * 🧠 KNOWLEDGE BUILDER V11.2 — RAG SIMPLES
 * 
 * Constrói base de conhecimento a partir de páginas crawleadas.
 * Gera contexto textual para injeção no prompt da IA.
 * 
 * REGRAS:
 * - 100% aditivo — não altera knowledge-base.js existente
 * - Escopo diferente: KB existente = FAQs/Documentos do tenant, este = crawl de URL
 * - try/catch total — fallback para string vazia
 * - Limite de 20.000 caracteres para não estourar token limit
 * 
 * @version 11.2.0
 * @author Link Mágico Team
 */

/**
 * Constrói base de conhecimento a partir de páginas extraídas
 * @param {Array<{url: string, title: string, text: string, meta: string}>} extractedPages 
 * @param {number} maxChars - Limite máximo de caracteres (default: 20000)
 * @returns {string} Texto formatado para injeção no prompt
 */
function buildKnowledge(extractedPages, maxChars = 20000) {
  try {
    if (!Array.isArray(extractedPages) || extractedPages.length === 0) {
      return '';
    }

    const sections = [];
    let totalChars = 0;

    for (const page of extractedPages) {
      if (!page || typeof page !== 'object') continue;

      const title = (page.title || 'Sem título').substring(0, 200);
      const text = (page.text || '').substring(0, Math.max(1000, Math.floor(maxChars / extractedPages.length)));
      const url = (page.url || '').substring(0, 200);

      const section = `--- ${title} (${url}) ---\n${text}`;
      
      if (totalChars + section.length > maxChars) {
        // Adicionar parte truncada
        const remaining = maxChars - totalChars;
        if (remaining > 200) {
          sections.push(section.substring(0, remaining) + '...');
        }
        break;
      }

      sections.push(section);
      totalChars += section.length;
    }

    const knowledge = sections.join('\n\n');
    
    if (knowledge.length > 0) {
      console.log(`[KNOWLEDGE-BUILDER] ✅ Base construída: ${extractedPages.length} páginas, ${knowledge.length} chars`);
    }

    return knowledge;

  } catch (err) {
    console.warn('[KNOWLEDGE-BUILDER] ⚠️ Erro:', err.message);
    return '';
  }
}

/**
 * Formata contexto de conhecimento para injeção no prompt da IA
 * @param {string} knowledge - Texto da base de conhecimento
 * @returns {string} Bloco formatado para prompt
 */
function formatKnowledgeContext(knowledge) {
  try {
    if (!knowledge || typeof knowledge !== 'string' || knowledge.trim().length === 0) {
      return '';
    }

    return `
[V11.2_KNOWLEDGE_BASE — CONTEÚDO REAL DO SITE]
BASE REAL DO PRODUTO (extraída automaticamente do site):
${knowledge}

REGRA V11.2: Use ESTE conteúdo como fonte primária de verdade.
- Responda com base no conteúdo real acima
- Seja direto e específico
- Não invente informações que não estejam no conteúdo
- Se não souber, diga claramente
- NUNCA use a URL da página como link de compra`;

  } catch (err) {
    console.warn('[KNOWLEDGE-BUILDER] ⚠️ Erro em formatKnowledgeContext:', err.message);
    return '';
  }
}

module.exports = { buildKnowledge, formatKnowledgeContext };
