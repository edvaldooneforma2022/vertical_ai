/**
 * ⚡ AUTO-INSTRUCTIONS GENERATOR — Link Mágico V8.0
 *
 * Gera instruções comportamentais dinâmicas a partir dos dados da página (scraping).
 * Roda ANTES do chat, como um "pré-cérebro" que adapta a IA ao contexto do link.
 *
 * CACHE: Instruções são cacheadas por URL (1h TTL). Evita chamada LLM repetida.
 * FALLBACK: Se LLM falhar, gera instruções locais (rule-based, sem LLM).
 * FEATURE FLAG: FEATURE_AUTO_INSTRUCTIONS (default: true)
 *
 * NÃO altera: scraping, KB, prompt universal, decision engine, sales-layer,
 *             endpoints, billing, auth, WhatsApp, widget, leads.
 *
 * APENAS adiciona: instruções dinâmicas injetadas no prompt (modo AUTO only).
 *
 * @version 1.0.0
 */

'use strict';

// ─────────────────────────────────────────────────────────────────
// CACHE EM MEMÓRIA POR URL
// ─────────────────────────────────────────────────────────────────

const _aiCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

function getCached(url) {
    try {
        if (!url) return null;
        const key = String(url).toLowerCase().trim();
        const entry = _aiCache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.timestamp > CACHE_TTL) {
            _aiCache.delete(key);
            return null;
        }
        return entry.instructions;
    } catch (_) {
        return null;
    }
}

function setCache(url, instructions) {
    try {
        if (!url || !instructions) return;
        const key = String(url).toLowerCase().trim();
        _aiCache.set(key, { instructions, timestamp: Date.now() });
        // Limitar cache a 200 URLs para evitar memory leak
        if (_aiCache.size > 200) {
            const oldest = _aiCache.keys().next().value;
            _aiCache.delete(oldest);
        }
    } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────
// DETECÇÃO DE TIPO DE PRODUTO (LOCAL, SEM LLM)
// ─────────────────────────────────────────────────────────────────

const PRODUCT_TYPE_SIGNALS = {
    infoproduto: {
        url: ['hotmart', 'eduzz', 'monetizze', 'kiwify', 'braip', 'herospark', 'perfectpay', 'lastlink'],
        content: ['curso', 'módulo', 'aula', 'ebook', 'mentoria', 'certificado', 'acesso imediato',
                  'área de membros', 'treinamento', 'masterclass', 'mastermind', 'infoproduto',
                  'garantir minha vaga', 'bônus exclusivo', 'material completo']
    },
    servico: {
        url: [],
        content: ['agendar', 'orçamento', 'consultoria', 'atendimento', 'contratar',
                  'profissional', 'especialista', 'assessoria', 'proposta', 'sessão',
                  'consulta', 'avaliação gratuita', 'trabalho personalizado']
    },
    saas: {
        url: ['app.', 'dashboard.', 'login.', 'plano', 'pricing'],
        content: ['plano mensal', 'plano anual', 'assinatura', 'free trial', 'trial grátis',
                  'funcionalidade', 'integração', 'api', 'automação', 'software',
                  'plataforma', 'saas', 'sistema', 'ferramenta online']
    },
    ecommerce: {
        url: ['shopify', 'loja.', 'mercadolivre', 'amazon', 'shopee', '/produto/', '/cart/'],
        content: ['adicionar ao carrinho', 'frete grátis', 'entrega', 'estoque',
                  'produto físico', 'unidade', 'tamanho', 'cor', 'comprar agora',
                  'frete', 'envio', 'cep']
    },
    lead_capture: {
        url: ['pages.', 'lp.', 'landing', '/captura', 'leadlovers', 'rdstation'],
        content: ['cadastre-se', 'inscreva-se', 'lista de espera', 'newsletter',
                  'baixe grátis', 'material gratuito', 'webinar', 'evento gratuito',
                  'e-book grátis', 'aula gratuita']
    },
    negocio_local: {
        url: ['maps.google', 'waze.com', 'ifood', 'booking'],
        content: ['endereço', 'horário de funcionamento', 'localização', 'reserva',
                  'salão', 'bairro', 'cidade', 'loja física', 'visite-nos']
    }
};

function detectProductType(url, content) {
    try {
        const urlLower = String(url || '').toLowerCase();
        const contentLower = String(content || '').toLowerCase();

        const scores = {};
        for (const [type, signals] of Object.entries(PRODUCT_TYPE_SIGNALS)) {
            let score = 0;
            for (const s of signals.url) {
                if (urlLower.includes(s)) score += 2;
            }
            for (const s of signals.content) {
                if (contentLower.includes(s)) score += 1;
            }
            scores[type] = score;
        }

        const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
        if (sorted[0] && sorted[0][1] >= 2) {
            return sorted[0][0];
        }
        return 'generico';
    } catch (_) {
        return 'generico';
    }
}

// ─────────────────────────────────────────────────────────────────
// DETECÇÃO DE NÍVEL DO USUÁRIO (LOCAL)
// ─────────────────────────────────────────────────────────────────

function detectAudienceLevel(content) {
    try {
        const lower = String(content || '').toLowerCase();
        const advancedSignals = ['avançado', 'profissional', 'expert', 'especialista',
                                  'técnico', 'enterprise', 'corporativo', 'b2b'];
        const beginnerSignals = ['iniciante', 'do zero', 'passo a passo', 'nunca fez',
                                  'primeira vez', 'começar', 'simples', 'fácil',
                                  'qualquer pessoa', 'sem experiência'];

        const advScore = advancedSignals.filter(s => lower.includes(s)).length;
        const begScore = beginnerSignals.filter(s => lower.includes(s)).length;

        if (advScore > begScore) return 'avançado';
        if (begScore > advScore) return 'leigo';
        return 'intermediário';
    } catch (_) {
        return 'intermediário';
    }
}

// ─────────────────────────────────────────────────────────────────
// EXTRAÇÃO LOCAL DE DORES E OBJEÇÕES (SEM LLM)
// ─────────────────────────────────────────────────────────────────

function extractPainPoints(content) {
    try {
        const lower = String(content || '').toLowerCase();
        const painPatterns = [
            { pattern: 'cansad', pain: 'Cansaço com métodos que não funcionam' },
            { pattern: 'não consig', pain: 'Dificuldade em conseguir resultados sozinho' },
            { pattern: 'frustr', pain: 'Frustração com experiências anteriores' },
            { pattern: 'perder tempo', pain: 'Medo de perder tempo' },
            { pattern: 'perder dinheiro', pain: 'Medo de perder dinheiro' },
            { pattern: 'não sab', pain: 'Falta de conhecimento no assunto' },
            { pattern: 'dificuldade', pain: 'Dificuldade em alcançar o objetivo' },
            { pattern: 'complicad', pain: 'Complexidade dos métodos existentes' },
            { pattern: 'caro', pain: 'Preocupação com custo' },
            { pattern: 'sem resultado', pain: 'Resultados insatisfatórios até agora' },
            { pattern: 'precis', pain: 'Necessidade urgente de solução' },
            { pattern: 'problem', pain: 'Problema específico do nicho' }
        ];

        const found = painPatterns
            .filter(p => lower.includes(p.pattern))
            .map(p => p.pain);

        return found.length > 0 ? found.slice(0, 5) : ['Busca por solução prática', 'Desejo de resultados rápidos'];
    } catch (_) {
        return ['Busca por solução prática'];
    }
}

function predictObjections(productType, price) {
    try {
        const baseObjections = ['É caro demais', 'Será que funciona mesmo?', 'E se eu não gostar?'];

        const typeObjections = {
            infoproduto: ['Já comprei curso e não funcionou', 'Vou ter suporte?', 'É diferente dos outros?'],
            servico: ['Quanto tempo demora?', 'Tem garantia do resultado?', 'Posso cancelar?'],
            saas: ['Tem período de teste?', 'É difícil de usar?', 'Meus dados ficam seguros?'],
            ecommerce: ['E se o produto não for como na foto?', 'Quanto tempo de entrega?', 'Posso devolver?'],
            lead_capture: ['Vão ficar mandando email?', 'É gratuito mesmo?', 'Meus dados são seguros?'],
            negocio_local: ['Fica longe de mim?', 'Precisa agendar?', 'Tem estacionamento?'],
            generico: ['Preciso saber mais', 'Quero ver prova social', 'Tem depoimentos?']
        };

        const specific = typeObjections[productType] || typeObjections.generico;

        // Se tem preço alto, adicionar objeção de preço
        if (price) {
            const priceNum = parseFloat(String(price).replace(/[^\d.,]/g, '').replace(',', '.'));
            if (priceNum > 500) {
                return ['Investimento alto — preciso pensar', ...specific.slice(0, 2)];
            }
        }

        return [...baseObjections.slice(0, 1), ...specific.slice(0, 3)];
    } catch (_) {
        return ['É caro demais', 'Será que funciona?', 'E se não gostar?'];
    }
}

// ─────────────────────────────────────────────────────────────────
// ESTRATÉGIA POR TIPO DE PRODUTO
// ─────────────────────────────────────────────────────────────────

const STRATEGY_MAP = {
    infoproduto: {
        tom: 'emocional e aspiracional',
        estrategia: 'Conectar com a dor, mostrar transformação, usar prova social e urgência. Falar em resultados, não em features.',
        cta: 'CTA após mostrar transformação. Usar gatilhos de escassez e exclusividade. Priorizar link de checkout.'
    },
    servico: {
        tom: 'consultivo e profissional',
        estrategia: 'Entender a necessidade específica, demonstrar expertise, apresentar cases. Foco em personalização e confiança.',
        cta: 'CTA para agendamento ou contato. Nunca pressionar compra direta — conduzir para conversa.'
    },
    saas: {
        tom: 'lógico e objetivo',
        estrategia: 'Foco em ROI, eficiência e automação. Comparação com alternativas. Demonstrar economia de tempo/dinheiro.',
        cta: 'CTA para trial gratuito ou demonstração. Se não tem trial, focar em plano mais acessível.'
    },
    ecommerce: {
        tom: 'direto e prático',
        estrategia: 'Foco no produto: qualidade, entrega, garantia. Responder dúvidas sobre especificações. Destacar diferenciais.',
        cta: 'CTA direto para compra. Mencionar frete grátis e garantia se disponíveis.'
    },
    lead_capture: {
        tom: 'curiosidade e valor',
        estrategia: 'Mostrar o valor do material gratuito. Criar expectativa. Minimizar fricção do cadastro.',
        cta: 'CTA para cadastro. Reforçar que é gratuito e sem compromisso.'
    },
    negocio_local: {
        tom: 'acolhedor e prático',
        estrategia: 'Foco em localização, horários, praticidade. Mostrar diferenciais do estabelecimento.',
        cta: 'CTA para agendamento, reserva ou visita. Informar endereço e como chegar.'
    },
    generico: {
        tom: 'equilibrado e consultivo',
        estrategia: 'Entender a necessidade, apresentar benefícios, conduzir para ação.',
        cta: 'CTA contextual baseado no que a página oferece.'
    }
};

// ─────────────────────────────────────────────────────────────────
// EXTRAIR PROMESSA PRINCIPAL (LOCAL)
// ─────────────────────────────────────────────────────────────────

function extractMainPromise(title, description, content) {
    try {
        // Prioridade: título > descrição > primeira frase do conteúdo
        if (title && title.length > 10 && title.length < 200) {
            return String(title).trim();
        }
        if (description && description.length > 10 && description.length < 300) {
            return String(description).trim().substring(0, 150);
        }
        if (content) {
            const firstSentence = String(content).split(/[.!?\n]/).find(s => s.trim().length > 15);
            if (firstSentence) return firstSentence.trim().substring(0, 150);
        }
        return 'Não identificada';
    } catch (_) {
        return 'Não identificada';
    }
}

// ─────────────────────────────────────────────────────────────────
// PROMPT GERADOR (PARA LLM)
// ─────────────────────────────────────────────────────────────────

function buildGeneratorPrompt(pageData) {
    const title = pageData.title || 'Não disponível';
    const description = pageData.description || pageData.summary || 'Não disponível';
    const price = (pageData.price_detected && pageData.price_detected.length > 0)
        ? pageData.price_detected.join(', ')
        : 'Não detectado';
    const bonuses = (pageData.bonuses_detected && pageData.bonuses_detected.length > 0)
        ? pageData.bonuses_detected.join(', ')
        : 'Nenhum detectado';
    const contentSnippet = pageData.cleanText
        ? String(pageData.cleanText).substring(0, 2000)
        : 'Não disponível';

    return `Analise o contexto abaixo e gere instruções comportamentais para um vendedor de alta performance.

CONTEXTO DA PÁGINA:
TÍTULO: ${title}
DESCRIÇÃO: ${description}
PREÇO: ${price}
BÔNUS: ${bonuses}
CONTEÚDO (trecho): ${contentSnippet}

OBJETIVO: Gerar instruções invisíveis para guiar a IA na conversa com foco em conversão.

SAÍDA OBRIGATÓRIA (responda EXATAMENTE neste formato, sem explicações extras):

1. TIPO DE PRODUTO: (infoproduto, serviço, SaaS, e-commerce, captura de leads, negócio local)
2. NÍVEL DO USUÁRIO: (leigo, intermediário, avançado)
3. PRINCIPAL PROMESSA: (resumida em 1 frase clara)
4. DORES DO USUÁRIO: (lista com 3-5 itens)
5. OBJEÇÕES PROVÁVEIS: (lista com 3-4 itens)
6. ESTRATÉGIA DE CONVERSA: (como conduzir este tipo de lead, 2-3 frases)
7. TOM IDEAL: (direto, emocional, técnico, consultivo, etc)
8. ESTRATÉGIA DE CTA: (quando usar e como usar, 1-2 frases)

REGRAS:
- NÃO inventar informações que não estejam no contexto
- Usar APENAS o contexto fornecido
- Ser específico ao conteúdo da página
- Evitar respostas genéricas`;
}

// ─────────────────────────────────────────────────────────────────
// GERAÇÃO LOCAL (FALLBACK SEM LLM)
// ─────────────────────────────────────────────────────────────────

function generateLocal(pageData) {
    try {
        const url = pageData.url || '';
        const content = [
            pageData.title || '',
            pageData.description || '',
            pageData.cleanText || ''
        ].join(' ');

        const productType = detectProductType(url, content);
        const audienceLevel = detectAudienceLevel(content);
        const mainPromise = extractMainPromise(pageData.title, pageData.description, pageData.cleanText);
        const painPoints = extractPainPoints(content);
        const price = (pageData.price_detected && pageData.price_detected.length > 0) ? pageData.price_detected[0] : null;
        const objections = predictObjections(productType, price);
        const strategy = STRATEGY_MAP[productType] || STRATEGY_MAP.generico;

        const autoInstructions = `
AUTO-INSTRUÇÕES DINÂMICAS (geradas a partir da página):
1. TIPO DE PRODUTO: ${productType}
2. NÍVEL DO USUÁRIO: ${audienceLevel}
3. PRINCIPAL PROMESSA: ${mainPromise}
4. DORES DO USUÁRIO: ${painPoints.join('; ')}
5. OBJEÇÕES PROVÁVEIS: ${objections.join('; ')}
6. ESTRATÉGIA DE CONVERSA: ${strategy.estrategia}
7. TOM IDEAL: ${strategy.tom}
8. ESTRATÉGIA DE CTA: ${strategy.cta}

USE estas instruções para calibrar TODAS as respostas. Adapte tom, argumentos e CTAs ao tipo de produto e público detectados.`;

        console.log(`⚡ [AUTO-INSTRUCTIONS] Gerado LOCAL: tipo=${productType} nivel=${audienceLevel}`);
        return autoInstructions;
    } catch (err) {
        console.warn('⚠️ [AUTO-INSTRUCTIONS] Erro na geração local:', err.message);
        return '';
    }
}

// ─────────────────────────────────────────────────────────────────
// PROCESSAR RESPOSTA DA LLM (PARSER)
// ─────────────────────────────────────────────────────────────────

function parseLLMResponse(rawResponse) {
    try {
        if (!rawResponse || typeof rawResponse !== 'string' || rawResponse.trim().length < 50) {
            return null;
        }

        // Verificar se contém pelo menos 3 das seções esperadas
        const sections = ['TIPO DE PRODUTO', 'NÍVEL DO USUÁRIO', 'PRINCIPAL PROMESSA',
                          'DORES', 'OBJEÇÕES', 'ESTRATÉGIA', 'TOM', 'CTA'];
        const foundSections = sections.filter(s => rawResponse.toUpperCase().includes(s));

        if (foundSections.length < 3) {
            console.warn(`⚠️ [AUTO-INSTRUCTIONS] Resposta LLM com apenas ${foundSections.length}/8 seções — fallback`);
            return null;
        }

        // Formatar como instrução para o prompt
        const autoInstructions = `
AUTO-INSTRUÇÕES DINÂMICAS (geradas por IA a partir da página):
${rawResponse.trim()}

USE estas instruções para calibrar TODAS as respostas. Adapte tom, argumentos e CTAs ao tipo de produto e público detectados.`;

        return autoInstructions;
    } catch (err) {
        console.warn('⚠️ [AUTO-INSTRUCTIONS] Erro ao parsear resposta LLM:', err.message);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────
// FUNÇÃO PRINCIPAL — generateAutoInstructions
// ─────────────────────────────────────────────────────────────────

/**
 * Gera auto-instruções dinâmicas a partir dos dados da página.
 *
 * Fluxo:
 * 1. Verificar cache (por URL)
 * 2. Tentar gerar via LLM (callLLMFn)
 * 3. Fallback: gerar localmente (rule-based)
 * 4. Cachear resultado
 *
 * @param {object} pageData     — Dados scraped da página
 * @param {function} callLLMFn  — Função async que recebe messages[] e retorna string
 * @returns {Promise<string>}   — Auto-instruções formatadas (ou '' se tudo falhar)
 */
async function generateAutoInstructions(pageData, callLLMFn) {
    try {
        // Verificar se tem dados mínimos
        if (!pageData || (!pageData.title && !pageData.cleanText && !pageData.description)) {
            console.log('⚡ [AUTO-INSTRUCTIONS] Sem dados de página — skip');
            return '';
        }

        // 1. Verificar cache
        const url = pageData.url || '';
        const cached = getCached(url);
        if (cached) {
            console.log(`⚡ [AUTO-INSTRUCTIONS] Cache HIT para: ${url.substring(0, 60)}...`);
            return cached;
        }

        // 2. Tentar LLM
        let instructions = null;
        if (typeof callLLMFn === 'function') {
            try {
                const generatorPrompt = buildGeneratorPrompt(pageData);
                const messages = [
                    { role: 'system', content: 'Você é um analista de marketing e vendas. Responda APENAS no formato solicitado, sem explicações extras.' },
                    { role: 'user', content: generatorPrompt }
                ];

                const rawResponse = await callLLMFn(messages, 0.3, 500);
                instructions = parseLLMResponse(rawResponse);

                if (instructions) {
                    console.log(`⚡ [AUTO-INSTRUCTIONS] Gerado via LLM (${instructions.length} chars) para: ${url.substring(0, 60)}...`);
                }
            } catch (llmErr) {
                console.warn(`⚠️ [AUTO-INSTRUCTIONS] LLM falhou (fallback local): ${llmErr.message}`);
                instructions = null;
            }
        }

        // 3. Fallback local se LLM falhou
        if (!instructions) {
            instructions = generateLocal(pageData);
            if (instructions) {
                console.log(`⚡ [AUTO-INSTRUCTIONS] Gerado via fallback LOCAL para: ${url.substring(0, 60)}...`);
            }
        }

        // 4. Cachear
        if (instructions && url) {
            setCache(url, instructions);
        }

        return instructions || '';

    } catch (err) {
        console.warn('⚠️ [AUTO-INSTRUCTIONS] Erro geral (retornando vazio):', err.message);
        return '';
    }
}

// ─────────────────────────────────────────────────────────────────
// UTILITÁRIOS (EXPOSTOS PARA TESTES)
// ─────────────────────────────────────────────────────────────────

/**
 * Limpar cache manualmente (útil para testes e admin)
 */
function clearCache() {
    _aiCache.clear();
    console.log('⚡ [AUTO-INSTRUCTIONS] Cache limpo');
}

/**
 * Obter status do cache
 */
function getCacheStats() {
    return {
        size: _aiCache.size,
        urls: Array.from(_aiCache.keys()).slice(0, 10)
    };
}

// ─────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────

module.exports = {
    generateAutoInstructions,
    generateLocal,
    clearCache,
    getCacheStats,
    // Expostos para teste unitário
    detectProductType,
    detectAudienceLevel,
    extractPainPoints,
    predictObjections,
    extractMainPromise,
    buildGeneratorPrompt,
    parseLLMResponse
};
