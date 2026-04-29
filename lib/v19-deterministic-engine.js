/**
 * 🧠 V19 — DETERMINISTIC DECISION ENGINE
 * 
 * AUTORIDADE ÚNICA de decisão comercial do Link Mágico.
 * Substitui conflitos entre V18.1/V18.2/V18.3/V18.4/PP-GLOBAL/IS_BUYER.
 * 
 * CONTRATO:
 * - Apenas este módulo decide: intent final, allowSell, allowCTA, allowCheckout
 * - NENHUM outro módulo pode sobrescrever, forçar CTA ou alterar intent
 * - IS_BUYER reseta em objeção/saída (não é sticky)
 * - Dados com baixa confiança NÃO geram checkout
 * 
 * ROLLOUT:
 * - FEATURE_DETERMINISTIC_V19=false → sistema atual intacto
 * - FEATURE_DETERMINISTIC_V19=shadow → roda paralelo (log only)
 * - FEATURE_DETERMINISTIC_V19=true → V19 assume controle
 * 
 * @version 19.0.0
 * @author Link Mágico Team
 */

'use strict';

// ═══════════════════════════════════════════════════════════════
// 🔍 INTENT PATTERNS (determinísticos, sem IA)
// ═══════════════════════════════════════════════════════════════

const INTENT_PATTERNS = {
    buy: [
        'quero comprar', 'qro compra', 'me manda o link', 'manda o link',
        'tem link', 'tem o link', 'manda o site', 'bora',
        'onde compra', 'como faco pra comprar', 'como faço pra comprar',
        'como q compra', 'quero comprar de novo', 'como pago', 'aceita pix',
        'quero assinar', 'quero pagar', 'quero adquirir', 'quero contratar',
        'quero garantir', 'quero ativar', 'vou levar', 'bora fechar',
        'fechar negocio', 'quero o produto', 'link de pagamento', 'link de checkout',
        'link de compra', 'envia o link', 'passa o link'
    ],
    price: [
        'quanto custa', 'qual o valor', 'preco', 'preço', 'quanto é',
        'quanto e', 'valor', 'parcelamento', 'parcela', 'tem desconto',
        'promocao', 'promoção', 'mais barato', 'plano', 'planos'
    ],
    objection: [
        'golpe', 'fraude', 'piramide', 'enganacao', 'engano',
        'nao entendi', 'nao compreendi', 'parece golpe', 'isso e golpe',
        'confiavel', 'seguro', 'medo', 'duvido', 'mentira', 'falso',
        'caro demais', 'muito caro', 'nao vale', 'nao compensa',
        'garantia', 'tem garantia', 'funciona mesmo', 'realmente funciona'
    ],
    exit: [
        'tchau', 'ate mais', 'ate logo', 'nao quero', 'nao me interessa',
        'depois eu vejo', 'valeu', 'obrigado pela ajuda', 'flw', 'falou',
        'desisto', 'nao preciso', 'nao obrigado', 'nao, obrigado',
        'vou pensar', 'deixa pra la', 'esquece'
    ],
    support: [
        'atendente', 'suporte', 'falar com alguem', 'falar com alguém',
        'humano', 'preciso de ajuda', 'falar com pessoa', 'pessoa real',
        'quero falar', 'falar com voce', 'falar com você', 'contato humano',
        'alguem de verdade', 'alguém de verdade'
    ],
    confusion: [
        'nao entendi nada', 'pode repetir', 'como assim', 'que',
        'o que e isso', 'o que é isso', 'explica melhor', 'não entendi'
    ]
};

// ═══════════════════════════════════════════════════════════════
// 🧠 INTENT RESOLVER — Fonte única de verdade
// ═══════════════════════════════════════════════════════════════

/**
 * Resolve intent com scoring (não binário).
 * Prioridade: exit > support > objection > buy > price > confusion > neutral
 */
function resolveIntent(msg, v17Intent) {
    const normalizedMsg = (msg || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const scores = {};

    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
        let matchCount = 0;
        for (const p of patterns) {
            if (normalizedMsg.includes(p)) matchCount++;
        }
        if (matchCount > 0) {
            scores[intent] = matchCount;
        }
    }

    // Prioridade hierárquica (exit/support > objection > buy > price)
    const priorityOrder = ['exit', 'support', 'objection', 'buy', 'price', 'confusion'];
    
    let bestIntent = 'neutral';
    let bestScore = 0;

    for (const intent of priorityOrder) {
        if (scores[intent] && scores[intent] > 0) {
            // Exit e support têm prioridade absoluta (1 match basta)
            if (intent === 'exit' || intent === 'support') {
                bestIntent = intent;
                bestScore = scores[intent];
                break;
            }
            // Para os demais, maior score vence
            if (scores[intent] > bestScore) {
                bestScore = scores[intent];
                bestIntent = intent;
            }
        }
    }

    // Usar V17 intent como fallback APENAS se V19 não conseguiu classificar
    if (bestIntent === 'neutral' && v17Intent && v17Intent !== 'neutral') {
        const v17Map = {
            'buy': 'buy', 'purchase': 'buy', 'compra': 'buy',
            'price': 'price', 'pricing': 'price', 'preco': 'price',
            'exit': 'exit', 'leave': 'exit', 'saida': 'exit',
            'support': 'support', 'human': 'support', 'suporte': 'support',
            'objection': 'objection', 'objecao': 'objection'
        };
        bestIntent = v17Map[v17Intent] || 'neutral';
    }

    return {
        intent: bestIntent,
        score: bestScore,
        source: bestScore > 0 ? 'v19_patterns' : (v17Intent ? 'v17_fallback' : 'default'),
        raw: scores
    };
}

// ═══════════════════════════════════════════════════════════════
// 🎯 STATE MACHINE — Com reset automático
// ═══════════════════════════════════════════════════════════════

// Estado global de conversação (in-memory, TTL controlado)
const _v19ConversationState = new Map();
const V19_STATE_TTL = 15 * 60 * 1000; // 15 minutos

function resolveState(conversationId, intentResult) {
    const intent = intentResult.intent;
    const now = Date.now();

    // Buscar estado anterior
    let prevState = null;
    if (conversationId && _v19ConversationState.has(conversationId)) {
        const cached = _v19ConversationState.get(conversationId);
        if (now - cached.updatedAt < V19_STATE_TTL) {
            prevState = cached;
        } else {
            _v19ConversationState.delete(conversationId);
        }
    }

    // Determinar stage atual
    let stage = 'neutral';
    let isBuyer = false;

    switch (intent) {
        case 'exit':
            stage = 'exiting';
            isBuyer = false; // RESET automático
            break;
        case 'objection':
            stage = 'hesitating';
            isBuyer = false; // RESET automático
            break;
        case 'confusion':
            stage = 'confused';
            isBuyer = false; // RESET automático
            break;
        case 'price':
            stage = 'evaluating';
            // Herdar isBuyer do estado anterior (preço não confirma nem nega compra)
            isBuyer = prevState?.isBuyer || false;
            break;
        case 'buy':
            stage = 'ready';
            isBuyer = true; // Marcar como buyer
            break;
        case 'support':
            stage = 'support';
            isBuyer = false; // RESET automático
            break;
        default:
            stage = 'neutral';
            // Herdar isBuyer APENAS se estado anterior era 'ready' ou 'evaluating'
            // Em qualquer outro caso, reset
            if (prevState && (prevState.stage === 'ready' || prevState.stage === 'evaluating')) {
                isBuyer = prevState.isBuyer;
            } else {
                isBuyer = false;
            }
    }

    const newState = {
        stage,
        isBuyer,
        previousStage: prevState?.stage || null,
        previousIntent: prevState?.lastIntent || null,
        lastIntent: intent,
        updatedAt: now,
        messageCount: (prevState?.messageCount || 0) + 1
    };

    // Salvar estado
    if (conversationId) {
        _v19ConversationState.set(conversationId, newState);
    }

    return newState;
}

// ═══════════════════════════════════════════════════════════════
// 📊 DATA CONFIDENCE — Validação de dados extraídos
// ═══════════════════════════════════════════════════════════════

function resolveDataConfidence(pageData) {
    if (!pageData) {
        return { confidence: 0, hasCheckout: false, hasWhatsApp: false, hasContent: false };
    }

    let confidence = 0;
    const checkoutLink = pageData.checkoutLink || null;
    const whatsappLink = pageData.whatsappLink || pageData.whatsapp ||
        (pageData.contatos?.whatsapp && pageData.contatos.whatsapp[0]) || null;
    const hasContent = !!(pageData.cleanText && pageData.cleanText.length > 100);

    // Scoring de confiança
    if (checkoutLink) confidence += 0.4;
    if (hasContent) confidence += 0.3;
    if (whatsappLink) confidence += 0.1;
    if (pageData.title) confidence += 0.1;
    if (pageData.summary || pageData.description) confidence += 0.1;

    // Penalidade se extraction guard marcou como failed
    if (pageData._extractionGuard) {
        const guard = pageData._extractionGuard;
        if (guard.status === 'failed') confidence *= 0.3;
        else if (guard.status === 'partial') confidence *= 0.7;
    }

    return {
        confidence: Math.min(1, confidence),
        hasCheckout: !!checkoutLink,
        checkoutLink: checkoutLink,
        hasWhatsApp: !!whatsappLink,
        whatsappLink: whatsappLink,
        hasContent: hasContent
    };
}

// ═══════════════════════════════════════════════════════════════
// 🎯 REGRAS DE DECISÃO — Unificadas
// ═══════════════════════════════════════════════════════════════

function canSell(intentResult, stateResult) {
    const { intent } = intentResult;
    const { stage } = stateResult;

    // Bloqueio absoluto
    if (stage === 'exiting') return false;
    if (stage === 'support') return false;
    if (intent === 'exit') return false;
    if (intent === 'support') return false;

    // Permitir venda
    if (intent === 'buy') return true;
    if (intent === 'price') return true;

    // Objeção: NÃO vender (responder à objeção primeiro)
    if (intent === 'objection' || stage === 'hesitating') return false;

    // Confusão: NÃO vender
    if (intent === 'confusion' || stage === 'confused') return false;

    // Neutral: vender APENAS se era buyer antes
    if (stateResult.isBuyer) return true;

    return false;
}

function canShowCTA(intentResult, stateResult) {
    const { intent } = intentResult;
    const { stage } = stateResult;

    // Bloqueio absoluto
    if (stage === 'exiting') return false;
    if (stage === 'hesitating') return false;
    if (stage === 'support') return false;
    if (stage === 'confused') return false;

    // Permitir CTA
    return ['buy', 'price'].includes(intent) || stateResult.isBuyer;
}

function canInjectCheckout(dataResult, stateResult) {
    // Sem checkout = sem injeção
    if (!dataResult.hasCheckout) return false;

    // Dados com baixa confiança = sem checkout
    if (dataResult.confidence < 0.3) return false;

    // Estado hesitando/saindo = sem checkout
    if (stateResult.stage === 'hesitating') return false;
    if (stateResult.stage === 'exiting') return false;
    if (stateResult.stage === 'support') return false;
    if (stateResult.stage === 'confused') return false;

    return true;
}

// ═══════════════════════════════════════════════════════════════
// 🧠 DECISION ENGINE — Função principal
// ═══════════════════════════════════════════════════════════════

/**
 * @param {Object} ctx - Contexto completo
 * @param {string} ctx.message - Mensagem do usuário
 * @param {string} [ctx.conversationId] - ID da conversa
 * @param {Object} [ctx.pageData] - Dados extraídos da página
 * @param {string} [ctx.v17Intent] - Intent do V17 (fallback)
 * @param {string} [ctx.salesMode] - Modo de vendas (auto/manual/off)
 * @returns {Object} Decisão completa
 */
function decide(ctx) {
    try {
        const { message, conversationId, pageData, v17Intent, salesMode } = ctx;

        // Bypass total se não for modo automático
        if (salesMode === 'manual' || salesMode === 'off') {
            return {
                active: false,
                reason: 'non_auto_mode',
                intent: { intent: 'neutral', score: 0, source: 'bypass' },
                state: { stage: 'neutral', isBuyer: false },
                data: { confidence: 0 },
                allowSell: false,
                allowCTA: false,
                allowCheckout: false
            };
        }

        // 1. Resolver intent (fonte única)
        const intentResult = resolveIntent(message, v17Intent);

        // 2. Resolver state (com reset automático)
        const stateResult = resolveState(conversationId, intentResult);

        // 3. Avaliar confiança dos dados
        const dataResult = resolveDataConfidence(pageData);

        // 4. Decisões
        const allowSell = canSell(intentResult, stateResult);
        const allowCTA = canShowCTA(intentResult, stateResult);
        const allowCheckout = canInjectCheckout(dataResult, stateResult);

        const decision = {
            active: true,
            intent: intentResult,
            state: stateResult,
            data: dataResult,
            allowSell,
            allowCTA,
            allowCheckout,
            checkoutLink: allowCheckout ? dataResult.checkoutLink : null,
            whatsappLink: dataResult.whatsappLink || null,
            timestamp: Date.now()
        };

        console.log(`[V19-DECISION] intent=${intentResult.intent}(${intentResult.score}) | stage=${stateResult.stage} | buyer=${stateResult.isBuyer} | sell=${allowSell} | cta=${allowCTA} | checkout=${allowCheckout} | conf=${dataResult.confidence.toFixed(2)}`);

        return decision;

    } catch (err) {
        console.error('[V19-DECISION] ❌ Erro (fallback seguro):', err.message);
        return {
            active: false,
            reason: 'error',
            error: err.message,
            intent: { intent: 'neutral', score: 0, source: 'error' },
            state: { stage: 'neutral', isBuyer: false },
            data: { confidence: 0 },
            allowSell: false,
            allowCTA: false,
            allowCheckout: false
        };
    }
}

// ═══════════════════════════════════════════════════════════════
// 📊 SHADOW MODE — Comparação com sistema legado
// ═══════════════════════════════════════════════════════════════

/**
 * Compara decisão V19 com comportamento legado e loga diferenças
 */
function logDiff(v19Decision, legacyContext) {
    try {
        const diffs = [];

        // Comparar intent
        const legacyIsBuy = legacyContext.forceBuyIntent || false;
        const v19IsBuy = v19Decision.intent.intent === 'buy';
        if (legacyIsBuy !== v19IsBuy) {
            diffs.push(`INTENT_DIFF: legacy_buy=${legacyIsBuy} vs v19_buy=${v19IsBuy} (v19_intent=${v19Decision.intent.intent})`);
        }

        // Comparar CTA
        const legacyForceCTA = legacyContext.forceCTA || false;
        if (legacyForceCTA !== v19Decision.allowCTA) {
            diffs.push(`CTA_DIFF: legacy_forceCTA=${legacyForceCTA} vs v19_allowCTA=${v19Decision.allowCTA}`);
        }

        // Comparar IS_BUYER
        const legacyIsBuyer = legacyContext.isBuyer || false;
        if (legacyIsBuyer !== v19Decision.state.isBuyer) {
            diffs.push(`BUYER_DIFF: legacy=${legacyIsBuyer} vs v19=${v19Decision.state.isBuyer} (stage=${v19Decision.state.stage})`);
        }

        // Comparar checkout
        const legacyHasCheckout = !!(legacyContext.checkoutLink);
        const v19HasCheckout = v19Decision.allowCheckout;
        if (legacyHasCheckout && !v19HasCheckout) {
            diffs.push(`CHECKOUT_BLOCKED: legacy would inject, v19 blocks (conf=${v19Decision.data.confidence.toFixed(2)}, stage=${v19Decision.state.stage})`);
        } else if (!legacyHasCheckout && v19HasCheckout) {
            diffs.push(`CHECKOUT_ADDED: legacy missed, v19 would inject`);
        }

        if (diffs.length > 0) {
            console.log(`[V19-SHADOW] 🔍 ${diffs.length} diferença(s) encontrada(s):`);
            diffs.forEach(d => console.log(`  → ${d}`));
        } else {
            console.log(`[V19-SHADOW] ✅ Sem divergências`);
        }

        return { diffs, count: diffs.length };
    } catch (err) {
        console.warn('[V19-SHADOW] Erro no diff:', err.message);
        return { diffs: [], count: 0, error: err.message };
    }
}

// ═══════════════════════════════════════════════════════════════
// 🧹 APLICAR DECISÃO — Pós-processamento controlado
// ═══════════════════════════════════════════════════════════════

/**
 * Aplica a decisão V19 sobre a resposta final.
 * Chamado APENAS quando V19 está ativo (não shadow).
 */
function applyDecision(decision, finalResponse) {
    try {
        if (!decision.active) return { response: finalResponse, modified: false };

        let response = finalResponse || '';
        let modified = false;

        // 1. Se NÃO pode vender → remover qualquer CTA/checkout da resposta
        if (!decision.allowSell) {
            // Remover blocos de FINALIZAR COMPRA
            const ctaPattern = /━+\n🚀 FINALIZAR COMPRA\n[^\n]*\n━+/g;
            const hadCTA = ctaPattern.test(response);
            response = response.replace(ctaPattern, '').trim();
            
            // Remover "👉 Finalize/Clique para..."
            response = response.replace(/\n\n👉\s*(Finalize|Clique para|Para finalizar).*$/gm, '').trim();
            
            if (hadCTA) {
                modified = true;
                console.log('[V19-APPLY] 🚫 CTA removido (allowSell=false)');
            }
        }

        // 2. Se PODE vender + PODE injetar checkout + checkout NÃO presente
        if (decision.allowCheckout && decision.checkoutLink) {
            if (!response.includes(decision.checkoutLink)) {
                if (decision.intent.intent === 'buy') {
                    // Compra direta → CTA direto
                    response += `\n\n━━━━━━━━━━━━━━━━━━━\n🚀 FINALIZAR COMPRA\n${decision.checkoutLink}\n━━━━━━━━━━━━━━━━━━━`;
                    modified = true;
                    console.log('[V19-APPLY] ✅ Checkout injetado (buy intent)');
                } else if (decision.intent.intent === 'price' || decision.state.isBuyer) {
                    // Preço ou buyer → CTA sutil
                    response += `\n\n👉 Veja condições e finalize aqui:\n${decision.checkoutLink}`;
                    modified = true;
                    console.log('[V19-APPLY] ✅ Checkout injetado (price/buyer)');
                }
            }
        }

        // 3. CTA "FINALIZAR COMPRA" sem URL → corrigir ou remover
        if (response.includes('FINALIZAR COMPRA') && !response.includes('http')) {
            if (decision.checkoutLink && decision.allowCheckout) {
                response = response.replace(
                    /━+\n🚀 FINALIZAR COMPRA\n━+/g,
                    `━━━━━━━━━━━━━━━━━━━\n🚀 FINALIZAR COMPRA\n${decision.checkoutLink}\n━━━━━━━━━━━━━━━━━━━`
                );
                modified = true;
                console.log('[V19-APPLY] 🔧 CTA sem URL corrigido');
            } else {
                response = response.replace(/━+\n🚀 FINALIZAR COMPRA\n━+/g, '').trim();
                modified = true;
                console.log('[V19-APPLY] 🚫 CTA sem URL removido (checkout bloqueado)');
            }
        }

        // 4. Anti-genérico (remover frases genéricas)
        const genericPatterns = [
            'ótima pergunta', 'otima pergunta',
            'deixe-me explicar detalhadamente',
            'como posso ajudar você hoje', 'como posso te ajudar hoje',
            'aqui estão as informações que você precisa',
            'obrigado pelo seu interesse! como posso',
            'posso te mostrar como funciona primeiro'
        ];
        const responseLower = response.toLowerCase();
        const isGeneric = genericPatterns.some(p => responseLower.includes(p));
        
        if (isGeneric && decision.allowSell && decision.checkoutLink) {
            // Generic + pode vender → substituir por checkout direto
            response = `Clique abaixo para finalizar sua compra 👇\n\n━━━━━━━━━━━━━━━━━━━\n🚀 FINALIZAR COMPRA\n${decision.checkoutLink}\n━━━━━━━━━━━━━━━━━━━`;
            modified = true;
            console.log('[V19-APPLY] 🔥 Resposta genérica substituída por checkout');
        } else if (isGeneric) {
            // Generic + não pode vender → limpar
            response = response
                .replace(/💭\s*\*?\*?Ótima pergunta!?\*?\*?\s*/gi, '')
                .replace(/💭\s*\*?\*?tima pergunta!?\*?\*?\s*/gi, '')
                .replace(/Deixe-me explicar detalhadamente\.\s*/gi, '')
                .replace(/🎯\s*Obrigado pelo seu interesse!\s*Como posso ajudar você hoje\?\s*/gi, '')
                .replace(/👉\s*Posso te mostrar como funciona primeiro.*$/gim, '')
                .trim();
            if (!response || response.length < 20) {
                response = 'Como posso te ajudar com mais informações sobre o produto?';
            }
            modified = true;
            console.log('[V19-APPLY] 🧹 Resposta genérica limpa');
        }

        return { response, modified };

    } catch (err) {
        console.error('[V19-APPLY] ❌ Erro:', err.message);
        return { response: finalResponse, modified: false };
    }
}

// ═══════════════════════════════════════════════════════════════
// 🧹 LIMPEZA PERIÓDICA — Evita memory leak
// ═══════════════════════════════════════════════════════════════

function cleanupExpiredStates() {
    try {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, val] of _v19ConversationState.entries()) {
            if (now - val.updatedAt > V19_STATE_TTL) {
                _v19ConversationState.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`[V19] 🧹 ${cleaned} estados expirados limpos (restam ${_v19ConversationState.size})`);
        }
    } catch (err) {
        // Silencioso
    }
}

// Limpeza a cada 5 minutos
setInterval(cleanupExpiredStates, 5 * 60 * 1000);

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
    decide,
    applyDecision,
    logDiff,
    resolveIntent,
    resolveState,
    resolveDataConfidence,
    canSell,
    canShowCTA,
    canInjectCheckout,
    cleanupExpiredStates,
    // Para testes
    _getConversationState: () => _v19ConversationState,
    INTENT_PATTERNS
};
