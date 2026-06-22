/**
 * channel-safe-routing.js — CORREÇÕES ISOLADAS V21 (Sem Regressão)
 *
 * REGRAS ABSOLUTAS:
 * - NÃO altera fluxo LLM / V17 / V19 / V18
 * - NÃO modifica prompt engineering
 * - NÃO altera lead capture existente
 * - NÃO altera checkout validado
 * - Widget e Link Curto: comportamento intocado
 * - WhatsApp: correções cirúrgicas isoladas
 *
 * Fix 1: resolveScheduleUrl() — Domínio correto para agendamento no WhatsApp
 * Fix 2: enforcePageDataTruth() — Anti-hallucination negativa (todos canais)
 * Fix 3: resolveFinalCTA() — CTA Priority Engine com hierarquia única (todos canais)
 *
 * @version 1.0.0
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════
// FIX 1 — RESOLVE SCHEDULE URL (WhatsApp-only)
// ═══════════════════════════════════════════════════════════════════

/** Domínio oficial de produção para links públicos */
const PRODUCTION_PUBLIC_DOMAIN = 'https://linkmagico.app.br';

/**
 * Retorna a URL de agendamento com domínio correto por canal.
 *
 * @param {string} hash - calendarHash gerado pelo schedulingManager
 * @param {object} [options={}]
 * @param {string} [options.channel='widget'] - 'whatsapp' | 'widget' | 'shortlink'
 * @param {string} [options.fallbackUrl] - URL base do ambiente (variáveis de env)
 * @returns {string} URL completa de agendamento
 */
function resolveScheduleUrl(hash, options = {}) {
    if (!hash) return null;

    const channel = (options.channel || 'widget').toLowerCase();

    // WhatsApp: SEMPRE domínio de produção, nunca Render interno
    if (channel === 'whatsapp') {
        const url = `${PRODUCTION_PUBLIC_DOMAIN}/agendar/${hash}`;
        console.log(`[SCHEDULE-URL@whatsapp] Produção: ${url}`);
        return url;
    }

    // Widget / Shortlink: manter comportamento atual (fallbackUrl ou padrão)
    const baseUrl = options.fallbackUrl || PRODUCTION_PUBLIC_DOMAIN;
    return `${baseUrl}/agendar/${hash}`;
}

// ═══════════════════════════════════════════════════════════════════
// FIX 2 — ENFORCE PAGE DATA TRUTH (Anti-Hallucination Negativa)
// ═══════════════════════════════════════════════════════════════════

/**
 * Keywords comerciais que, se presentes no pageData, o LLM NÃO pode negar.
 * Mapeamento: keyword → rótulo legível para a resposta corretiva.
 */
const TRUTH_KEYWORDS = [
    { keyword: 'whitelabel', label: 'whitelabel' },
    { keyword: 'white label', label: 'whitelabel' },
    { keyword: 'white-label', label: 'whitelabel' },
    { keyword: 'afiliado', label: 'programa de afiliados' },
    { keyword: 'afiliados', label: 'programa de afiliados' },
    { keyword: 'parceiro', label: 'programa de parceiros' },
    { keyword: 'parceiros', label: 'programa de parceiros' },
    { keyword: 'comissão', label: 'sistema de comissões' },
    { keyword: 'comissao', label: 'sistema de comissões' },
    { keyword: 'revenda', label: 'programa de revenda' },
    { keyword: 'revendedor', label: 'programa de revenda' },
    { keyword: 'garantia', label: 'garantia' },
    { keyword: 'garantias', label: 'garantia' },
    { keyword: '7 dias', label: 'garantia de 7 dias' },
    { keyword: 'reembolso', label: 'política de reembolso' },
    { keyword: 'suporte', label: 'suporte' },
    { keyword: 'suporte técnico', label: 'suporte técnico' },
    { keyword: 'comunidade', label: 'comunidade' },
    { keyword: 'bônus', label: 'bônus' },
    { keyword: 'bonus', label: 'bônus' },
    { keyword: 'depoimento', label: 'depoimentos' },
    { keyword: 'resultado', label: 'resultados' },
    { keyword: 'caso de uso', label: 'casos de uso' },
    { keyword: 'casos de uso', label: 'casos de uso' },
];

/**
 * Padrões de negação que indicam hallucinação negativa.
 * O LLM está negando algo que existe no pageData.
 */
const DENIAL_PATTERNS = [
    /n[oã]o (?:temos|há|possui|existe|encontramos|dispomos|oferecemos|tem|possui|oferece|dispõe|disponibiliza|incluso|contém|inclui)\b.*(?:whitelabel|white.?label|afiliad|parceir|comiss[ãa]o|revenda|garanti|reembolso|suporte|b[oô]nus|depoiment|resultado|caso.?de.?uso)/gi,
    /n[oã]o (?:encontrei|achei|vi|localizei) (?:informa[cç][oõ]es?|dados?|nada|detalhes?) (?:sobre )?(?:whitelabel|white.?label|afiliad|parceir|comiss[ãa]o|revenda|garanti|reembolso|b[oô]nus|depoiment)/gi,
    /(?:whitelabel|white.?label|afiliad|parceir|comiss[ãa]o|revenda|garanti|reembolso|b[oô]nus|depoiment).*n[oã]o (?:é|está|foram|são) (?:mencionad|citad|listad|descrit|inclu[íi]d)/gi,
    /n[oã]o (?:há|tem) (?:nenhuma|nenhum|qualquer) (?:informa[cç][aã]o|dado|detalhe|menção|refer[eê]ncia) (?:sobre )?(?:whitelabel|white.?label|afiliad|parceir|comiss[ãa]o|revenda|garanti|reembolso|b[oô]nus|depoiment)/gi,
    /n[oã]o (?:posso|consigo|tenho como) (?:confirmar|garantir|afirmar|dizer) (?:que )?(?:exista?|haja?|tenha) (?:.*)(?:whitelabel|white.?label|afiliad|parceir|comiss[ãa]o|revenda|garanti|reembolso|b[oô]nus|depoiment)/gi,
];

/**
 * Dados estruturados do pageData que indicam existência de features.
 * Verifica além do texto: campos estruturados, faq, bônus detectados, etc.
 */
function extractPageDataFacts(pageData) {
    if (!pageData) return new Set();

    const facts = new Set();
    const d = pageData;

    // Texto completo (cleanText) — fonte primária de verdade
    const fullText = [
        d.cleanText || '',
        d.description || '',
        d.title || '',
        d.summary || ''
    ].join(' ').toLowerCase();

    for (const { keyword, label } of TRUTH_KEYWORDS) {
        if (fullText.includes(keyword.toLowerCase())) {
            facts.add(label);
        }
    }

    // Bônus detectados
    if (d.bonuses_detected && d.bonuses_detected.length > 0) {
        facts.add('bônus');
    }

    // FAQ existente
    if (d.faq && d.faq.length > 0) {
        const faqText = d.faq.map(f => `${f.question || ''} ${f.answer || ''}`).join(' ').toLowerCase();
        for (const { keyword, label } of TRUTH_KEYWORDS) {
            if (faqText.includes(keyword.toLowerCase())) {
                facts.add(label);
            }
        }
    }

    // Contatos (indica suporte)
    if (d.contatos) {
        const c = d.contatos;
        if (c.email && c.email.length > 0) facts.add('suporte');
        if (c.whatsapp && c.whatsapp.length > 0) facts.add('suporte');
        if (c.telefone && c.telefone.length > 0) facts.add('suporte');
    }

    // Checkout existente
    if (d.checkoutLink) {
        facts.add('link de compra');
    }

    // Preço detectado
    if (d.price || d.preco) {
        facts.add('preço');
    }

    return facts;
}

/**
 * Detecta se a resposta contém negação de algum fato existente.
 *
 * @param {string} response - Resposta gerada pelo LLM
 * @param {Set<string>} facts - Conjunto de fatos confirmados do pageData
 * @returns {{ hasDenial: boolean, deniedFacts: string[], correctedResponse: string|null }}
 */
function detectDenial(response, facts) {
    if (!response || !facts || facts.size === 0) {
        return { hasDenial: false, deniedFacts: [], correctedResponse: null };
    }

    const deniedFacts = [];
    const responseLower = response.toLowerCase();

    // Construir mapa: keyword → label (para traduzir match cru → label legível)
    const keywordToLabels = new Map();
    for (const { keyword, label } of TRUTH_KEYWORDS) {
        const kw = keyword.toLowerCase();
        if (!keywordToLabels.has(kw)) {
            keywordToLabels.set(kw, []);
        }
        keywordToLabels.get(kw).push(label);
    }

    // Verificar cada padrão de negação
    for (const pattern of DENIAL_PATTERNS) {
        const match = responseLower.match(pattern);
        if (match) {
            const matchText = match[0].toLowerCase();
            // Descobrir qual KEYWORD (não label) está no texto da negação
            for (const [keyword, labels] of keywordToLabels) {
                if (matchText.includes(keyword)) {
                    // Verificar se ALGUM dos labels associados a esta keyword é um fato confirmado
                    for (const label of labels) {
                        if (facts.has(label) && !deniedFacts.includes(label)) {
                            deniedFacts.push(label);
                            break; // Um fato por keyword
                        }
                    }
                }
            }
        }
    }

    // Verificação adicional: frase genérica com labels
    for (const fact of facts) {
        const factLower = fact.toLowerCase();
        const escapedFact = factLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const genericDenial = new RegExp(
            `n[oã]o (?:há|tem|encontramos|possuímos|dispomos|oferecemos) (?:nenhuma|nenhum|qualquer|informa[cç][oõ]es?|dados?|detalhes?)(?: sobre| referente| a)?\\s*(?:${escapedFact})`,
            'gi'
        );
        if (genericDenial.test(responseLower) && !deniedFacts.includes(fact)) {
            deniedFacts.push(fact);
        }
    }

    // Verificação adicional 2: "não [verbo] [fato]" direto (ex: "não oferece garantia")
    for (const [keyword, labels] of keywordToLabels) {
        const escapedKw = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const directDenial = new RegExp(
            `n[oã]o (?:possui|oferece|tem|inclui|contém|disponibiliza|oferecemos|temos|há|existe)\\s+(?:.*?\\s+)?${escapedKw}`,
            'gi'
        );
        if (directDenial.test(responseLower)) {
            for (const label of labels) {
                if (facts.has(label) && !deniedFacts.includes(label)) {
                    deniedFacts.push(label);
                    break;
                }
            }
        }
    }

    if (deniedFacts.length === 0) {
        return { hasDenial: false, deniedFacts: [], correctedResponse: null };
    }

    return { hasDenial: true, deniedFacts, correctedResponse: null };
}

/**
 * Aplica correção à resposta quando há negação indevida.
 * Substitui frases de negação por confirmação baseada nos dados reais.
 *
 * @param {string} response - Resposta original do LLM
 * @param {string[]} deniedFacts - Lista de fatos que foram negados
 * @returns {string} Resposta corrigida
 */
function buildCorrection(response, deniedFacts) {
    if (!deniedFacts || deniedFacts.length === 0) return response;

    let corrected = response;

    // Construir mapa reverso: label → keywords
    const labelToKeywords = new Map();
    for (const { keyword, label } of TRUTH_KEYWORDS) {
        if (!labelToKeywords.has(label)) {
            labelToKeywords.set(label, []);
        }
        labelToKeywords.get(label).push(keyword.toLowerCase());
    }

    for (const fact of deniedFacts) {
        const factLower = fact.toLowerCase();

        // Obter keywords para este fato
        const keywords = labelToKeywords.get(fact) || [factLower];
        // Montar alternância de keywords para regex: (kw1|kw2|...)
        const kwPattern = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

        // Padrão 1: "não [verbo] [informaçoes?] [sobre] X"
        const p1 = new RegExp(
            `[^.]*n[oã]o (?:temos|há|possui|encontramos|dispomos|oferecemos|tem|possuímos|existe) (?:nenhuma|nenhum|qualquer)? ?(?:informa[cç][oõ]es?|dados?|detalhes?|nada)? ?(?:sobre )?(?:${kwPattern})[^.]*\\.?`,
            'gi'
        );

        const match1 = corrected.match(p1);
        if (match1) {
            const replacement = `Conforme as informações disponíveis na página, existe sim o módulo de ${fact}. Para mais detalhes específicos, recomendo verificar diretamente na página ou entrar em contato.`;
            corrected = corrected.replace(match1[0], replacement);
            continue;
        }

        // Padrão 2: "não possui/oferece/tem X"
        const p2 = new RegExp(
            `[^.]*n[oã]o (?:possui|oferece|tem|inclui|contém|disponibiliza|oferecemos|temos|há|existe)\\s+(?:.*?\\s+)?(?:${kwPattern})[^.]*\\.?`,
            'gi'
        );
        const match2 = corrected.match(p2);
        if (match2) {
            const replacement = `A página menciona ${fact}. Para detalhes completos, recomendo acessar a página oficial.`;
            corrected = corrected.replace(match2[0], replacement);
            continue;
        }

        // Padrão 3: "não é/são/foram mencionado X"
        const p3 = new RegExp(
            `[^.]*n[oã]o (?:é|está|são|foram) (?:mencionad|citad|listad|descrit|inclu[íi]d)[oaos]?.*(?:${kwPattern})[^.]*\\.?`,
            'gi'
        );
        const match3 = corrected.match(p3);
        if (match3) {
            const replacement = `A página menciona ${fact}. Para detalhes completos sobre como funciona, recomendo acessar a página oficial.`;
            corrected = corrected.replace(match3[0], replacement);
            continue;
        }
    }

    // Se nenhuma substituição regex funcionou, append genérico
    if (corrected === response && deniedFacts.length > 0) {
        const factList = deniedFacts.slice(0, 3).join(', ');
        corrected += `\n\nℹ️ Informação complementar: a página do produto menciona ${factList}. Para detalhes, acesse a página oficial.`;
    }

    return corrected;
}

/**
 * FUNÇÃO PRINCIPAL — Enforce Page Data Truth
 *
 * Regra: Se pageData contém keyword → resposta NÃO pode negar existência.
 * Prioridade de fonte de verdade:
 *   1. pageData estruturado (extractPageData)
 *   2. checkout DB
 *   3. knowledge base do site
 *   4. LLM (último recurso)
 *
 * Esta função atua APÓS o LLM, como guard de saída.
 * NÃO altera o fluxo de geração, apenas corrige negações falsas.
 *
 * @param {string} response - Resposta gerada pelo pipeline
 * @param {object} pageData - Dados extraídos da página
 * @param {object} [options={}]
 * @param {string} [options.channel] - Canal de origem (para logs)
 * @returns {{ response: string, enforced: boolean, deniedFacts: string[], factsFound: number }}
 */
function enforcePageDataTruth(response, pageData, options = {}) {
    const channel = options.channel || 'unknown';
    const startTime = Date.now();

    try {
        if (!response || typeof response !== 'string') {
            return { response, enforced: false, deniedFacts: [], factsFound: 0 };
        }

        // 1. Extrair fatos confirmados do pageData (fonte de verdade primária)
        const facts = extractPageDataFacts(pageData);

        if (facts.size === 0) {
            return { response, enforced: false, deniedFacts: [], factsFound: 0 };
        }

        // 2. Detectar negações na resposta
        const denial = detectDenial(response, facts);

        if (!denial.hasDenial) {
            return { response, enforced: false, deniedFacts: [], factsFound: facts.size };
        }

        // 3. Aplicar correção
        const correctedResponse = buildCorrection(response, denial.deniedFacts);
        const elapsed = Date.now() - startTime;

        console.log(`[PAGE-TRUTH@${channel}] ✅ Corrigida negação | facts=${facts.size} | denied=[${denial.deniedFacts.join(',')}] | ${elapsed}ms`);

        return {
            response: correctedResponse,
            enforced: true,
            deniedFacts: denial.deniedFacts,
            factsFound: facts.size
        };
    } catch (err) {
        console.warn(`[PAGE-TRUTH@${channel}] Erro (sem impacto):`, err.message);
        return { response, enforced: false, deniedFacts: [], factsFound: 0 };
    }
}

// ═══════════════════════════════════════════════════════════════════
// FIX 3 — CTA PRIORITY ENGINE (Hierarquia Única)
// ═══════════════════════════════════════════════════════════════════

/**
 * Intent CTA mapping — qual tipo de link por intenção.
 * Hierarquia fixa, sem ambiguidade:
 *   1. checkoutLink → intent purchase/price_strong/link_request
 *   2. scheduleLink → intent schedule
 *   3. whatsappLink → intent support/contact
 *   4. null → tudo mais
 */
const CTA_INTENT_PRIORITY = {
    buy:              ['checkoutLink'],
    price_strong:     ['checkoutLink'],
    link_request:     ['checkoutLink'],
    schedule:         ['scheduleLink'],
    support:          ['whatsappLink'],
    link_broken:      ['whatsappLink'],
    info:             [],
    explain:          [],
    price_objection:  [],
    contact:          ['whatsappLink'],
};

/**
 * CTA Priority Engine — Única autoridade de CTA final.
 *
 * REGRA: Apenas 1 CTA final permitido por resposta.
 * NENHUM canal pode sobrescrever outro após decisão final.
 *
 * Fluxo de prioridade:
 *   1. checkoutLink (se intent = purchase)
 *   2. scheduleLink (se intent = schedule)
 *   3. whatsappLink (se intent = support/contact)
 *   4. null
 *
 * @param {object} params
 * @param {string} params.intent - Intent detectada (V17.2 detectIntent)
 * @param {string|null} params.checkoutLink - Link de checkout validado
 * @param {string|null} params.scheduleLink - Link de agendamento
 * @param {string|null} params.whatsappLink - Link de WhatsApp
 * @param {object|null} params.existingCta - CTA já decidido por V17.2 ({ text, url })
 * @param {string} [params.channel] - Canal de origem
 * @returns {{ cta: { text: string, url: string }|null, source: string, reason: string }}
 */
function resolveFinalCTA(params) {
    const {
        intent = 'info',
        checkoutLink = null,
        scheduleLink = null,
        whatsappLink = null,
        existingCta = null,
        channel = 'unknown'
    } = params;

    // Se existingCta já foi decidido por V17.2, validar com hierarquia
    if (existingCta && existingCta.url) {
        const url = existingCta.url;

        // Verificar se o CTA existente está na prioridade correta para o intent
        const allowedSources = CTA_INTENT_PRIORITY[intent] || [];

        if (allowedSources.includes('checkoutLink') && checkoutLink && url.includes(checkoutLink)) {
            // Checkout para intent de compra → CORRETO
            return { cta: existingCta, source: 'v17.2_validated', reason: `checkout_for_${intent}` };
        }

        if (allowedSources.includes('scheduleLink') && scheduleLink) {
            // Agendamento para intent de schedule → CORRETO
            return { cta: existingCta, source: 'v17.2_validated', reason: `schedule_for_${intent}` };
        }

        if (allowedSources.includes('whatsappLink') && (whatsappLink && url.includes(whatsappLink) || url.includes('wa.me'))) {
            // WhatsApp para intent de suporte → CORRETO
            return { cta: existingCta, source: 'v17.2_validated', reason: `whatsapp_for_${intent}` };
        }

        // CTA existente NÃO está na prioridade correta → sobrescrever com hierarquia
        console.log(`[CTA-PRIORITY@${channel}] ⚠️ CTA existente fora da prioridade: intent=${intent} cta_url=${url.substring(0, 50)} → reavaliando`);
    }

    // HIERARQUIA DE PRIORIDADE
    const allowedSources = CTA_INTENT_PRIORITY[intent] || [];

    // 1. Checkout (purchase/price/link_request)
    if (allowedSources.includes('checkoutLink') && checkoutLink) {
        return {
            cta: { text: 'Finalizar compra', url: checkoutLink },
            source: 'cta_priority_engine',
            reason: `checkout_priority_for_${intent}`
        };
    }

    // 2. Schedule (agendamento)
    if (allowedSources.includes('scheduleLink') && scheduleLink) {
        return {
            cta: { text: 'Agendar', url: scheduleLink },
            source: 'cta_priority_engine',
            reason: `schedule_priority_for_${intent}`
        };
    }

    // 3. WhatsApp (suporte/contato/link_broken)
    if (allowedSources.includes('whatsappLink') && whatsappLink) {
        const ctaText = intent === 'link_broken' ? 'Falar no WhatsApp' : 'Falar com a equipe';
        return {
            cta: { text: ctaText, url: whatsappLink },
            source: 'cta_priority_engine',
            reason: `whatsapp_priority_for_${intent}`
        };
    }

    // 4. Sem CTA
    return { cta: null, source: 'cta_priority_engine', reason: `no_cta_for_${intent}` };
}

// ═══════════════════════════════════════════════════════════════════
// FIX 4 — CHANNEL ISOLATION GUARD
// ═══════════════════════════════════════════════════════════════════

/**
 * Verifica se uma correção deve ser aplicada para o canal dado.
 * Widget e Shortlink: NENHUMA correção aplicada (zero impacto).
 * WhatsApp: correções aplicadas.
 *
 * @param {string} channel - Canal de origem
 * @param {string} fixName - Nome da correção
 * @returns {boolean}
 */
function shouldApplyFix(channel, fixName) {
    const ch = (channel || '').toLowerCase();

    // Widget e Shortlink: NUNCA aplicar correções (zero regressão)
    if (ch === 'widget' || ch === 'shortlink') {
        return false;
    }

    // WhatsApp: aplicar todas as correções
    if (ch === 'whatsapp') {
        return true;
    }

    // Canal desconhecido (ex: API direta): aplicar apenas enforcePageDataTruth
    if (fixName === 'enforcePageDataTruth') {
        return true;
    }

    return false;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    // Fix 1: Schedule URL
    resolveScheduleUrl,
    PRODUCTION_PUBLIC_DOMAIN,

    // Fix 2: Page Data Truth
    enforcePageDataTruth,
    extractPageDataFacts,

    // Fix 3: CTA Priority
    resolveFinalCTA,

    // Fix 4: Channel Isolation
    shouldApplyFix,

    // Exports para testes
    TRUTH_KEYWORDS,
    DENIAL_PATTERNS,
    CTA_INTENT_PRIORITY,
    detectDenial,
    buildCorrection
};