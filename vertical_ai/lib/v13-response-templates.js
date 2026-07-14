/**
 * 🧩 V13 — RESPONSE TEMPLATES (ESTRUTURAS FIXAS POR AÇÃO)
 * 
 * O segredo que elimina 80% da instabilidade.
 * A IA NÃO cria estrutura — ela PREENCHE variáveis.
 * 
 * Cada ação tem um template fixo.
 * A IA recebe o template + contexto e GERA APENAS o conteúdo.
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════
// TEMPLATES POR AÇÃO
// ═══════════════════════════════════════════════════════════════════

const RESPONSE_TEMPLATES = {

    WELCOME: {
        structure: 'saudacao + pergunta_abertura',
        maxParts: 2,
        example: 'Oi! Em que posso te ajudar hoje?',
        aiInstruction: `Responda com uma saudação CURTA e natural.
Faça UMA pergunta simples para entender o que o usuário precisa.
MÁXIMO 2 frases. SEM floreio. SEM emojis excessivos.`
    },

    ANSWER_SIMPLE: {
        structure: 'resposta_direta + complemento_minimo + proxima_acao',
        maxParts: 3,
        example: 'O curso tem 30 módulos. Cada módulo dura em média 20 minutos. Quer saber sobre algum tema específico?',
        aiInstruction: `PARTE 1: Responda DIRETAMENTE à pergunta usando apenas os dados do contexto.
PARTE 2: Adicione UM complemento útil (se necessário, senão omita).
PARTE 3: Faça UMA pergunta curta para avançar.
Se não tiver a informação, diga "Não tenho essa informação no momento."
NUNCA invente dados.`
    },

    SHOW_BENEFIT: {
        structure: 'beneficio_principal + resultado_concreto + pergunta',
        maxParts: 3,
        example: 'O método ensina a gerar leads qualificados em 7 dias. Alunos relatam aumento de 40% nas vendas. Quer ver como funciona no seu caso?',
        aiInstruction: `PARTE 1: Apresente o benefício PRINCIPAL do produto usando dados do contexto.
PARTE 2: Mostre um resultado concreto ou prova (se disponível no contexto).
PARTE 3: Pergunte se quer saber mais.
NÃO envie link de checkout. NÃO tente fechar venda.
Use APENAS informações do contexto. NUNCA invente.`
    },

    SHOW_BENEFIT_WITH_CTA: {
        structure: 'beneficio + diferencial + chamada_para_acao',
        maxParts: 3,
        example: 'Com a garantia de 7 dias, você testa sem risco. O acesso é imediato após a compra. Quer que eu te envie o link para garantir sua vaga?',
        aiInstruction: `PARTE 1: Reforce o benefício PRINCIPAL usando dados do contexto.
PARTE 2: Destaque um diferencial (garantia, bônus, urgência — SE existir no contexto).
PARTE 3: Pergunte se o usuário quer receber o link de acesso/compra.
NÃO envie o link ainda. Apenas PERGUNTE.`
    },

    HANDLE_OBJECTION: {
        structure: 'validar_preocupacao + contra_argumento + pergunta',
        maxParts: 3,
        example: 'Entendo sua preocupação com o investimento. O ponto é que a garantia de 7 dias cobre exatamente essa questão — você testa sem risco. O que mais te preocupa?',
        aiInstruction: `PARTE 1: VALIDE a preocupação do usuário (não ignore).
PARTE 2: Apresente um contra-argumento usando dados do contexto (garantia, prova social, resultado).
PARTE 3: Pergunte o que mais preocupa.
SEM pressão. SEM urgência falsa. Use APENAS dados do contexto.`
    },

    CONFIRM_BEFORE_CHECKOUT: {
        structure: 'confirmacao + seguranca',
        maxParts: 2,
        example: 'Perfeito! Posso te enviar o link de acesso agora?',
        aiInstruction: `Confirme o interesse do usuário de forma CURTA e natural.
Pergunte se pode enviar o link de acesso/pagamento.
MÁXIMO 2 frases. SEM enrolação. SEM repetir benefícios.
NÃO envie o link. Apenas confirme a intenção.`
    },

    TRIGGER_CHECKOUT: {
        structure: 'confirmacao_curta',
        maxParts: 1,
        example: 'Aqui está o seu link de acesso:',
        aiInstruction: `Diga UMA frase curta confirmando o envio do link.
Exemplo: "Aqui está o seu acesso:" ou "Pronto, segue o link:"
MÁXIMO 1 frase. O link será adicionado AUTOMATICAMENTE pelo sistema.
NÃO invente links. NÃO coloque URLs na resposta.`
    },

    ASK_QUESTION: {
        structure: 'contextualizacao + pergunta',
        maxParts: 2,
        example: 'Entendi! Me conta: você já usa alguma ferramenta para isso hoje?',
        aiInstruction: `Faça UMA pergunta para entender melhor o que o usuário precisa.
Contextualize brevemente se possível.
MÁXIMO 2 frases. SEM vendas. SEM links.`
    }
};

// ═══════════════════════════════════════════════════════════════════
// FUNÇÕES
// ═══════════════════════════════════════════════════════════════════

/**
 * Retorna o template para uma ação
 * @param {string} action - Ação decidida pelo Rule Engine
 * @returns {Object|null} Template com instruções para a IA
 */
function getTemplate(action) {
    return RESPONSE_TEMPLATES[action] || RESPONSE_TEMPLATES['ASK_QUESTION'];
}

/**
 * Monta o bloco de instrução para a IA baseado no template + contexto
 * @param {string} action - Ação decidida
 * @param {Object} context - { productName, price, benefit, guarantee, etc }
 * @returns {string} Instrução completa para o system prompt da IA
 */
function buildTemplateInstruction(action, context = {}) {
    const template = getTemplate(action);
    if (!template) return '';

    let contextBlock = '\nDados disponíveis:';
    if (context.productName) contextBlock += `\n- Produto: ${context.productName}`;
    if (context.price) contextBlock += `\n- Preço: ${context.price}`;
    if (context.benefit) contextBlock += `\n- Benefício principal: ${context.benefit}`;
    if (context.guarantee) contextBlock += `\n- Garantia: ${context.guarantee}`;
    if (context.bonuses) contextBlock += `\n- Bônus: ${context.bonuses}`;
    if (context.testimonial) contextBlock += `\n- Depoimento: ${context.testimonial}`;
    if (context.urgency) contextBlock += `\n- Urgência: ${context.urgency}`;

    return `[INSTRUÇÃO DE RESPOSTA — AÇÃO: ${action}]

ESTRUTURA OBRIGATÓRIA: ${template.structure}
MÁXIMO DE PARTES: ${template.maxParts}

${template.aiInstruction}
${contextBlock !== '\nDados disponíveis:' ? contextBlock : ''}

EXEMPLO DE FORMATO CORRETO:
"${template.example}"

REGRAS FINAIS:
- Siga EXATAMENTE a estrutura acima
- NÃO adicione partes extras
- NÃO floreie
- NÃO invente informações`;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    getTemplate,
    buildTemplateInstruction,
    RESPONSE_TEMPLATES
};
