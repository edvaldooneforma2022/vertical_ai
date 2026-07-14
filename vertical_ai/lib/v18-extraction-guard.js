/**
 * V18 EXTRACTION GUARD — Blindagem contra extractor imperfeito
 * 
 * PRINCÍPIO: O sistema não diferencia "NÃO EXISTE" vs "NÃO CONSEGUI EXTRAIR".
 * Este módulo resolve isso sem alterar o extractor.
 * 
 * Subsistemas:
 *   V18.1 — Extraction Status (ok/partial/failed + confidence)
 *   V18.2 — Hard Truth Layer (isReliable flag)
 *   V18.3 — Diagnóstico Honesto (logs que diferenciam falha de ausência)
 *   V18.4 — Link Discovery Passivo (classificação de links brutos)
 *   V18.5 — Fallback Inteligente (preenche lacunas com links descobertos)
 * 
 * REGRAS:
 *   - ADITIVO: só adiciona _extractionGuard ao pageData, não remove nada
 *   - REVERSÍVEL: feature flag FEATURE_V18_EXTRACTION_GUARD
 *   - SEGURO: try/catch total, fallback silencioso
 *   - V18.5 (fallback) só ativa com FEATURE_V18_FALLBACK=true
 */

// ═════════════════════════════════════════════════════════════════
// V18.6 — FAILURE CACHE (evita re-extração da mesma URL falha)
// ═════════════════════════════════════════════════════════════════
const _failureCache = new Map();
const FAILURE_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function markUrlFailed(url, confidence, method) {
    if (!url) return;
    const key = url.split('?')[0]; // normalizar sem query params
    _failureCache.set(key, {
        confidence,
        method,
        timestamp: Date.now(),
        count: (_failureCache.get(key)?.count || 0) + 1
    });
}

function getUrlFailureInfo(url) {
    if (!url) return null;
    const key = url.split('?')[0];
    const entry = _failureCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > FAILURE_CACHE_TTL) {
        _failureCache.delete(key);
        return null;
    }
    return entry;
}

function isUrlRecentlyFailed(url) {
    return !!getUrlFailureInfo(url);
}

// ═══════════════════════════════════════════════════════════════════
// V18.1 — EXTRACTION STATUS
// ═══════════════════════════════════════════════════════════════════

/**
 * Avalia a qualidade da extração e retorna status + confidence
 * @param {Object} pageData - Dados extraídos pelo extractPageData
 * @returns {{ status: 'ok'|'partial'|'failed', confidence: number, signals: Object }}
 */
function evaluateExtractionStatus(pageData) {
    if (!pageData) return { status: 'failed', confidence: 0, signals: {} };

    const signals = {
        hasTitle: !!(pageData.title && pageData.title.length > 5),
        hasDescription: !!(pageData.description && pageData.description.length > 20),
        hasCleanText: !!(pageData.cleanText && pageData.cleanText.length > 100),
        hasCheckout: !!pageData.checkoutLink,
        hasWhatsApp: !!(pageData.whatsappLink || pageData.contatos?.whatsappLinks?.length > 0 || pageData.contatos?.whatsapp?.length > 0),
        hasPrice: !!(pageData.price_detected && pageData.price_detected.length > 0),
        hasFaq: !!(pageData.faq && pageData.faq.length > 0),
        hasContatos: !!(pageData.contatos && (
            (pageData.contatos.telefone && pageData.contatos.telefone.length > 0) ||
            (pageData.contatos.email && pageData.contatos.email.length > 0) ||
            (pageData.contatos.whatsapp && pageData.contatos.whatsapp.length > 0) ||
            (pageData.contatos.whatsappLinks && pageData.contatos.whatsappLinks.length > 0)
        )),
        textLength: (pageData.cleanText || '').length,
        method: pageData.method || 'unknown',
        // AJUSTE #5: Rastrear se checkout veio de auto-checkout (pode mascarar falha)
        checkoutSource: pageData.checkoutSource || null
    };

    // Calcular confidence (0-100)
    let confidence = 0;

    // Conteúdo textual (peso 40)
    if (signals.textLength > 2000) confidence += 40;
    else if (signals.textLength > 500) confidence += 30;
    else if (signals.textLength > 100) confidence += 15;
    else confidence += 0;

    // Título + Descrição (peso 15)
    if (signals.hasTitle) confidence += 8;
    if (signals.hasDescription) confidence += 7;

    // Links críticos (peso 30)
    if (signals.hasCheckout) confidence += 20;
    if (signals.hasWhatsApp) confidence += 10;

    // Dados enriquecidos (peso 15)
    if (signals.hasPrice) confidence += 5;
    if (signals.hasFaq) confidence += 5;
    if (signals.hasContatos) confidence += 5;

    // ⚠️ AJUSTE V18.3: Penalizar quando checkout veio de auto-checkout (não da extração)
    // Auto-checkout pode mascarar falha real de extração
    if (signals.hasCheckout && signals.checkoutSource && signals.checkoutSource !== 'heuristic-v93') {
        confidence -= 15;
        signals._autoCheckoutPenalty = true;
    }

    // Clamp 0-100
    confidence = Math.max(0, Math.min(100, confidence));

    // Determinar status
    let status = 'ok';
    if (confidence < 20) {
        status = 'failed';
    } else if (confidence < 50) {
        status = 'partial';
    }

    // V18.4: PARTIAL_CRITICAL — tem texto mas sem checkout, e links podem existir
    // Isso não é "ok" para conversão mesmo com confidence >= 50
    if (status === 'ok' && !signals.hasCheckout && signals.textLength > 100) {
        status = 'partial_critical';
    }

    return { status, confidence, signals };
}

// ═══════════════════════════════════════════════════════════════════
// V18.2 — HARD TRUTH LAYER
// ═══════════════════════════════════════════════════════════════════

/**
 * Cria validatedData com flag isReliable
 * @param {Object} pageData
 * @param {{ status: string, confidence: number }} extractionMeta
 * @returns {Object} validatedData
 */
function buildValidatedData(pageData, extractionMeta) {
    return {
        checkout: pageData?.checkoutLink || null,
        checkoutSource: pageData?.checkoutSource || null,
        whatsapp: pageData?.whatsappLink || null,
        contatos: pageData?.contatos || {},
        source: 'extracted',
        isReliable: extractionMeta.status === 'ok',
        extractionStatus: extractionMeta.status,
        confidence: extractionMeta.confidence,
        // V18.6: info de falha recente
        recentFailure: getUrlFailureInfo(pageData?.url) || null
    };
}

// ═══════════════════════════════════════════════════════════════════
// V18.3 — DIAGNÓSTICO HONESTO
// ═══════════════════════════════════════════════════════════════════

/**
 * Loga diagnóstico honesto diferenciando "não existe" de "não consegui extrair"
 */
function logHonestDiagnosis(url, extractionMeta, validatedData, context = {}) {
    const prefix = '[V18-GUARD]';
    const urlShort = (url || '').substring(0, 60);
    // AJUSTE #3: contexto para correlação multi-tenant
    const ctxStr = context.tenantId || context.conversationId
        ? ` tenant=${(context.tenantId || '').substring(0, 10)} conv=${(context.conversationId || '').substring(0, 15)}`
        : '';

    if (extractionMeta.status === 'failed') {
        console.log(`${prefix} ❌ EXTRAÇÃO FALHOU | url=${urlShort}${ctxStr} | confidence=${extractionMeta.confidence}%`);
        console.log(`${prefix}    → checkout: NÃO DETECTADO (extração falhou — pode existir na página)`);
        console.log(`${prefix}    → whatsapp: NÃO DETECTADO (extração falhou — pode existir na página)`);
    } else if (extractionMeta.status === 'partial') {
        console.log(`${prefix} ⚠️ EXTRAÇÃO PARCIAL | url=${urlShort}${ctxStr} | confidence=${extractionMeta.confidence}%`);
        if (!validatedData.checkout) {
            console.log(`${prefix}    → checkout: NÃO DETECTADO (baixa confiança de extração — pode existir)`);
        }
        if (!validatedData.whatsapp) {
            console.log(`${prefix}    → whatsapp: NÃO DETECTADO (baixa confiança de extração — pode existir)`);
        }
    } else if (extractionMeta.status === 'partial_critical') {
        console.log(`${prefix} 🔴 PARTIAL_CRITICAL | url=${urlShort}${ctxStr} | confidence=${extractionMeta.confidence}% | texto OK mas SEM CHECKOUT`);
        console.log(`${prefix}    → checkout: AUSENTE (extração ok mas sem link de conversão — fallback necessário)`);
    } else {
        console.log(`${prefix} ✅ EXTRAÇÃO OK | url=${urlShort}${ctxStr} | confidence=${extractionMeta.confidence}% | checkout=${!!validatedData.checkout} | whatsapp=${!!validatedData.whatsapp}`);
    }

    // AJUSTE #5: alertar quando checkout veio de auto-checkout (pode mascarar falha de extração)
    if (extractionMeta.signals?.checkoutSource && extractionMeta.status !== 'ok') {
        console.log(`${prefix}    ⚠️ AUTO_CHECKOUT_OVERRIDE: checkoutSource=${extractionMeta.signals.checkoutSource} (pode estar mascarando falha)`);
    }

    // ⚠️ AJUSTE V18.3 — Log snapshot JSON estruturado para debugging real
    if (extractionMeta.status !== 'ok') {
        try {
            console.log(`${prefix} 📊 SNAPSHOT: ${JSON.stringify({
                layer: 'V18',
                tenant: (context.tenantId || '').substring(0, 12),
                conv: (context.conversationId || '').substring(0, 15),
                url: urlShort,
                confidence: extractionMeta.confidence,
                status: extractionMeta.status,
                checkoutSource: extractionMeta.signals?.checkoutSource || null,
                hasCheckout: extractionMeta.signals?.hasCheckout || false,
                hasWhatsApp: extractionMeta.signals?.hasWhatsApp || false,
                textLength: extractionMeta.signals?.textLength || 0,
                method: extractionMeta.signals?.method || 'unknown'
            })}`);
        } catch (_) {}
    }
}

// ═══════════════════════════════════════════════════════════════════
// V18.4 — LINK DISCOVERY PASSIVO
// ═══════════════════════════════════════════════════════════════════

/**
 * Padrões de checkout conhecidos
 */
const CHECKOUT_PATTERNS = [
    'hotmart.com', 'pay.hotmart.com', 'go.hotmart.com',
    'kiwify.com', 'pay.kiwify.com',
    'eduzz.com', 'checkout.eduzz.com',
    'monetizze.com', 'braip.com', 'ev.braip.com',
    'herospark.com', 'perfectpay.com',
    'checkout.', 'pay.', '/checkout', '/pagamento',
    'mercadopago.com', 'pagar.me', 'stripe.com', 'paypal.com'
];

const WHATSAPP_PATTERNS = [
    'wa.me/', 'api.whatsapp.com', 'whatsapp.com/send',
    'chat.whatsapp.com', 'wa.link/'
];

/**
 * Classifica links brutos do pageData em categorias
 * @param {Object} pageData
 * @returns {{ checkout: string[], whatsapp: string[], social: string[], other: string[] }}
 */
function discoverAndClassifyLinks(pageData) {
    const result = { checkout: [], whatsapp: [], social: [], other: [] };
    if (!pageData) return result;

    // Coletar todos os links disponíveis no pageData
    const allLinks = new Set();

    // Links já extraídos
    if (pageData.linksExtraidos && Array.isArray(pageData.linksExtraidos)) {
        pageData.linksExtraidos.forEach(l => {
            const url = typeof l === 'string' ? l : (l?.url || l?.href || '');
            if (url && url.startsWith('http')) allLinks.add(url);
        });
    }

    // Links de contatos
    if (pageData.contatos) {
        if (pageData.contatos.whatsappLinks) {
            pageData.contatos.whatsappLinks.forEach(l => { if (l) allLinks.add(l); });
        }
        if (pageData.contatos.site) {
            pageData.contatos.site.forEach(l => { if (l && l.startsWith('http')) allLinks.add(l); });
        }
    }

    // URL original e checkout detectado
    if (pageData.checkoutLink) allLinks.add(pageData.checkoutLink);
    if (pageData.whatsappLink) allLinks.add(pageData.whatsappLink);
    if (pageData._originalUrl) allLinks.add(pageData._originalUrl);

    // Classificar
    for (const link of allLinks) {
        const lower = link.toLowerCase();

        if (WHATSAPP_PATTERNS.some(p => lower.includes(p))) {
            result.whatsapp.push(link);
        } else if (CHECKOUT_PATTERNS.some(p => lower.includes(p))) {
            // Não incluir a URL de entrada como checkout
            const inputUrl = (pageData.url || '').split('?')[0].replace(/\/$/, '');
            const linkBase = link.split('?')[0].replace(/\/$/, '');
            if (linkBase !== inputUrl) {
                result.checkout.push(link);
            }
        } else if (/instagram|facebook|youtube|tiktok|telegram|linkedin|twitter/i.test(lower)) {
            result.social.push(link);
        } else {
            result.other.push(link);
        }
    }

    return result;
}

// ═══════════════════════════════════════════════════════════════════
// V18.5 — FALLBACK INTELIGENTE
// ═══════════════════════════════════════════════════════════════════

/**
 * Preenche lacunas nos dados extraídos usando links descobertos.
 * SÓ EXECUTA se FEATURE_V18_FALLBACK=true.
 * Não sobrescreve dados existentes — apenas preenche null/undefined.
 * 
 * @param {Object} pageData - Dados originais (será MUTADO com fallback)
 * @param {Object} validatedData - Dados validados
 * @param {Object} discoveredLinks - Links classificados
 * @param {Object} extractionMeta - Status da extração
 * @returns {{ applied: boolean, fallbacks: string[] }}
 */
function applyIntelligentFallback(pageData, validatedData, discoveredLinks, extractionMeta) {
    const fallbacks = [];
    // AJUSTE #1: fallbackData separado — NÃO muta pageData diretamente
    const fallbackData = { checkout: null, whatsapp: null };

    // AJUSTE #2: HARD LOCK — só executa se flag está explicitamente ON
    // Sem flag, retorna imediatamente sem tocar em nada
    // V18.4: partial_critical também dispara fallback (tem texto sem checkout)
    if (extractionMeta.status === 'ok') {
        return { applied: false, fallbacks: [], fallbackData };
    }

    // FALLBACK 1: Checkout — NÃO muta pageData, coloca em fallbackData
    if (!pageData.checkoutLink && discoveredLinks.checkout.length > 0) {
        fallbackData.checkout = discoveredLinks.checkout[0];
        fallbackData.checkoutSource = 'v18-fallback-discovery';
        fallbacks.push(`checkout=${discoveredLinks.checkout[0].substring(0, 60)}`);
    }

    // FALLBACK 2: WhatsApp — NÃO muta pageData, coloca em fallbackData
    if (!pageData.whatsappLink && discoveredLinks.whatsapp.length > 0) {
        fallbackData.whatsapp = discoveredLinks.whatsapp[0];
        fallbacks.push(`whatsapp=${discoveredLinks.whatsapp[0].substring(0, 60)}`);
    }

    if (fallbacks.length > 0) {
        console.log(`[V18-GUARD] 🔄 FALLBACK disponível (${fallbacks.length}): ${fallbacks.join(' | ')}`);
    }

    return { applied: fallbacks.length > 0, fallbacks, fallbackData };
}

// ═══════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL — guardPageData
// ═══════════════════════════════════════════════════════════════════

/**
 * Função principal que orquestra V18.1 a V18.5.
 * Adiciona _extractionGuard ao pageData sem alterar dados existentes.
 * 
 * @param {Object} pageData - Output de extractPageData (SERÁ ENRIQUECIDO)
 * @param {Object} options
 * @param {boolean} options.enableFallback - Se true, ativa V18.5
 * @returns {Object} pageData enriquecido com _extractionGuard
 */
function guardPageData(pageData, options = {}) {
    if (!pageData) return pageData;

    try {
        // V18.6: Check failure cache
        const recentFailure = getUrlFailureInfo(pageData.url);
        if (recentFailure) {
            console.log(`[V18-GUARD] ⚠️ URL já falhou recentemente (${recentFailure.count}x, confidence=${recentFailure.confidence}, method=${recentFailure.method})`);
        }

        // V18.1 — Extraction Status
        const extractionMeta = evaluateExtractionStatus(pageData);

        // V18.2 — Hard Truth Layer
        const validatedData = buildValidatedData(pageData, extractionMeta);

        // AJUSTE #4: Flag explícita de extração falha (para futuro retry)
        const extractionFailed = extractionMeta.confidence < 40;

        // V18.6: Registrar falha no cache
        if (extractionFailed) {
            markUrlFailed(pageData.url, extractionMeta.confidence, extractionMeta.signals?.method);
        }

        // V18.3 — Diagnóstico Honesto (AJUSTE #3: com contexto multi-tenant)
        logHonestDiagnosis(pageData.url, extractionMeta, validatedData, options.context || {});

        // V18.4 — Link Discovery Passivo
        const discoveredLinks = discoverAndClassifyLinks(pageData);

        // V18.5 — Fallback Inteligente (só com flag)
        let fallbackResult = { applied: false, fallbacks: [], fallbackData: {} };
        if (options.enableFallback) {
            fallbackResult = applyIntelligentFallback(pageData, validatedData, discoveredLinks, extractionMeta);

            // AJUSTE #1: Aplicar fallback ao pageData SOMENTE aqui, controlado
            if (fallbackResult.applied && fallbackResult.fallbackData) {
                if (fallbackResult.fallbackData.checkout && !pageData.checkoutLink) {
                    pageData.checkoutLink = fallbackResult.fallbackData.checkout;
                    pageData.checkoutSource = fallbackResult.fallbackData.checkoutSource || 'v18-fallback';
                    console.log(`[V18-GUARD] 🔄 FALLBACK APLICADO ao pageData: checkout=${pageData.checkoutLink.substring(0, 60)}`);
                }
                if (fallbackResult.fallbackData.whatsapp && !pageData.whatsappLink) {
                    pageData.whatsappLink = fallbackResult.fallbackData.whatsapp;
                    console.log(`[V18-GUARD] 🔄 FALLBACK APLICADO ao pageData: whatsapp=${pageData.whatsappLink.substring(0, 60)}`);
                }
            }
        }
        // AJUSTE #2: HARD LOCK — sem flag, PROIBIDO alterar qualquer campo do pipeline
        // (nenhum campo de pageData é tocado se enableFallback=false)

        // Log discovery (sempre — para observabilidade)
        if (discoveredLinks.checkout.length > 0 || discoveredLinks.whatsapp.length > 0) {
            console.log(`[V18-GUARD] 🔍 Links descobertos: checkout=${discoveredLinks.checkout.length} whatsapp=${discoveredLinks.whatsapp.length} social=${discoveredLinks.social.length} other=${discoveredLinks.other.length}`);
        }

        // ADITIVO: adicionar metadata sem remover nada
        pageData._extractionGuard = {
            version: '18.4',
            status: extractionMeta.status,
            confidence: extractionMeta.confidence,
            extractionFailed,
            signals: extractionMeta.signals,
            validatedData,
            discoveredLinks: {
                checkout: discoveredLinks.checkout,
                whatsapp: discoveredLinks.whatsapp,
                totalDiscovered: discoveredLinks.checkout.length + discoveredLinks.whatsapp.length + discoveredLinks.social.length + discoveredLinks.other.length
            },
            fallback: fallbackResult,
            isReliable: validatedData.isReliable,
            failureCache: recentFailure || null
        };

        return pageData;

    } catch (err) {
        console.error('[V18-GUARD] ⚠️ Erro (pageData inalterado):', err.message);
        return pageData; // fallback silencioso
    }
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    guardPageData,
    evaluateExtractionStatus,
    buildValidatedData,
    logHonestDiagnosis,
    discoverAndClassifyLinks,
    applyIntelligentFallback,
    // V18.6 — Failure Cache
    markUrlFailed,
    getUrlFailureInfo,
    isUrlRecentlyFailed,
    CHECKOUT_PATTERNS,
    WHATSAPP_PATTERNS
};
