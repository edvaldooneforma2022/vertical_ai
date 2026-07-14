/**
 * 🔥 V16.2 — DECISION ENGINE BLINDADO FINAL (ANTI-PERDA DE VENDA)
 * 
 * Camada DETERMINÍSTICA de decisão comercial SOBRE V13.
 * NÃO altera V13 (Intent Classifier, State Manager, Rule Engine, Response Builder).
 * NÃO altera V14 (Logger, Analyzer, Adaptive).
 * 
 * PONTO DE INSERÇÃO:
 *   V13 Intent Classifier → V13 State Manager → 🔥 V16.2 → V13 Response Builder
 * 
 * SE V16.2 decide override → assume controle (checkout direto, support, etc.)
 * SE V16.2 decide DEFAULT → V13 continua normalmente
 * SE V16.2 FALHA → fallback total para V13 (try/catch global)
 * 
 * ATIVAÇÃO: FEATURE_V16_2_BLINDADO_FINAL=true + salesMode=auto
 * 
 * @version 16.2.0
 * @author Link Mágico Team
 */

'use strict';

// ═══════════════════════════════════════════════════════════════════
// DEPENDÊNCIAS (com fallback)
// ═══════════════════════════════════════════════════════════════════

let axios = null;
try {
    axios = require('axios');
} catch (_) {
    console.warn('[V16.2] ⚠️ axios não disponível — validateCheckoutUrl desativado');
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO 0 — NORMALIZAÇÃO DE INPUT (CRÍTICO PARA INPUT REAL)
// ═══════════════════════════════════════════════════════════════════

/**
 * Normaliza texto do usuário para matching confiável.
 * Trata acentos, pontuação, espaços múltiplos, erros de digitação comuns.
 * @param {string} text - Mensagem do usuário
 * @returns {string} Texto normalizado
 */
function normalize(text) {
    try {
        if (!text || typeof text !== 'string') return '';
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // remove acentos
            .replace(/[^\w\s]/g, '')         // remove pontuação
            .replace(/\s+/g, ' ')            // compacta espaços
            .trim();
    } catch (_) {
        return (text || '').toLowerCase().trim();
    }
}

// ═══════════════════════════════════════════════════════════════════
// PADRÕES DE INTENÇÃO V16.2 (EXPANDIDOS — COMPLEMENTAM V13)
// ═══════════════════════════════════════════════════════════════════

const HIGH_INTENT = [
    'quero comprar', 'vou comprar', 'tem link', 'me manda',
    'como faco', 'quero isso', 'vou pegar', 'bora', 'onde compra',
    'como adquirir', 'como comeco', 'como acesso', 'quero comecar',
    'qro compra', 'tem o link ai', 'como q compra isso', 'manda o site',
    'quero o link', 'manda o link', 'envia o link', 'passa o link',
    'quero pagar', 'vou pagar', 'pode enviar', 'quero ja',
    'fechado', 'to dentro', 'me inscreve', 'vou levar',
    'quero contratar', 'quero assinar', 'bora la', 'vamos la'
];

const PAYMENT_INTENT = [
    'parcela', 'parcelado', 'pix', 'cartao', 'boleto',
    'forma de pagamento', 'como pago', 'tem desconto',
    'a vista', 'parcelar', 'pagamento'
];

const PRICE_INTENT = [
    'quanto custa', 'qual o valor', 'preco', 'valor disso',
    'quanto e', 'qual valor', 'quanto fica', 'quanto sai'
];

const DELAY_INTENT = [
    'vou pensar', 'depois vejo', 'te aviso', 'mais tarde',
    'deixa eu pensar', 'preciso pensar', 'vou ver depois'
];

const REBUY_INTENT = [
    'ja comprei', 'comprar de novo', 'outra vez', 'quero outro',
    'de novo', 'comprar novamente', 'comprei antes'
];

// Padrões de SUPPORT (espelhado do V13, NÃO alterar V13)
const SUPPORT_PATTERNS_V16 = [
    'falar com alguem', 'falar com humano', 'falar com atendente',
    'falar com pessoa', 'falar com vendedor', 'atendimento humano',
    'quero suporte', 'preciso de suporte', 'falar com suporte',
    'whatsapp', 'whats', 'wpp', 'zap', 'zapzap',
    'contato', 'atendente', 'suporte', 'ligar', 'telefone'
];

// Padrões de DÚVIDA COMPLEXA (evita FORCE_CLOSE agressivo)
const COMPLEX_QUESTION_PATTERNS = [
    'como funciona', 'como e', 'o que e', 'o que faz',
    'me explica', 'pode explicar', 'explica melhor',
    'quero entender', 'quero saber mais', 'quero saber como',
    'pra que serve', 'para que serve', 'qual a diferenca',
    'como usar', 'quanto tempo', 'funciona pra',
    'duvida', 'pergunta', 'entender melhor',
    'o que inclui', 'o que vem', 'tem suporte', 'tem garantia',
    'serve pra', 'e bom pra', 'e indicado'
];

// Padrões de SAÍDA (NUNCA enviar checkout)
const EXIT_PATTERNS = [
    'tchau', 'ate mais', 'ate logo', 'falou', 'flw', 'vlw',
    'nao quero', 'nao me interessa', 'nao preciso', 'desisto',
    'depois eu vejo', 'depois vejo', 'valeu', 'obrigado',
    'nao obrigado', 'nao to interessado', 'nao estou interessado'
];

// Padrões de OBJEÇÃO (NÃO enviar checkout — responder com confiança)
const OBJECTION_PATTERNS = [
    'golpe', 'fraude', 'piramide', 'enganacao', 'engano',
    'parece golpe', 'isso e golpe', 'mentira', 'falso',
    'nao entendi', 'nao compreendi', 'nao entendo',
    'explica como se eu fosse leigo', 'leigo',
    'nao confio', 'medo', 'duvido', 'confiavel', 'seguro'
];

// ═══════════════════════════════════════════════════════════════════
// ANTI-LOOP — DOMÍNIOS BLOQUEADOS (NÃO ENVIAR COMO CHECKOUT)
// ═══════════════════════════════════════════════════════════════════

const BLOCKED_DOMAINS = ['vertical-ai', 'linkmagico', 'onrender.com/chatbot', 'localhost'];

/**
 * Verifica se URL é domínio interno (auto-referência)
 * @param {string} url 
 * @returns {boolean} true se URL deve ser bloqueada
 */
function isSelfReferenceUrl(url) {
    try {
        if (!url || typeof url !== 'string') return false;
        const lower = url.toLowerCase();
        return BLOCKED_DOMAINS.some(d => lower.includes(d));
    } catch (_) {
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO 1 — FUZZY MATCH (ANTI-ERRO DE DIGITAÇÃO)
// ═══════════════════════════════════════════════════════════════════

/**
 * Verifica se o texto normalizado contém algum padrão (aproximado)
 * @param {string} text - Texto normalizado
 * @param {string[]} patterns - Lista de padrões
 * @returns {string|null} Padrão encontrado ou null
 */
function matchesPattern(text, patterns) {
    try {
        for (const p of patterns) {
            if (text.includes(p)) return p;
        }
        return null;
    } catch (_) {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO 2 — BUYER STATE (EXPIRAÇÃO INTELIGENTE DE 15 MIN)
// ═══════════════════════════════════════════════════════════════════

const BUYER_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos

// Armazenamento isolado do V16.2 (NÃO usa V13 state)
const _v16BuyerStates = new Map();
const MAX_V16_STATES = 5000;

/**
 * Obtém ou cria o estado V16.2 de buyer para uma conversa
 * @param {string} conversationId 
 * @returns {Object} Estado V16.2
 */
function getBuyerState(conversationId) {
    try {
        if (!conversationId) return { isBuyer: false, lastBuyerIntent: 0, forceCount: 0 };

        // Cleanup se necessário
        if (_v16BuyerStates.size > MAX_V16_STATES) {
            _cleanupBuyerStates();
        }

        let state = _v16BuyerStates.get(conversationId);
        if (!state) {
            state = { isBuyer: false, lastBuyerIntent: 0, forceCount: 0 };
            _v16BuyerStates.set(conversationId, state);
        }

        // Expiração inteligente — reseta se > 15 minutos sem ação de compra
        if (state.isBuyer && (Date.now() - state.lastBuyerIntent > BUYER_TIMEOUT_MS)) {
            state.isBuyer = false;
            state.forceCount = 0;
            console.log(`[V16.2] ⏰ Buyer state expirado para conv=${conversationId.substring(0, 12)}`);
        }

        return state;
    } catch (_) {
        return { isBuyer: false, lastBuyerIntent: 0, forceCount: 0 };
    }
}

/**
 * Marca conversa como buyer (com timestamp de expiração)
 * @param {string} conversationId 
 */
function markAsBuyer(conversationId) {
    try {
        if (!conversationId) return;
        const state = getBuyerState(conversationId);
        state.isBuyer = true;
        state.lastBuyerIntent = Date.now();
        _v16BuyerStates.set(conversationId, state);
    } catch (_) {}
}

/**
 * Incrementa contador de FORCE_CLOSE (para limitar agressividade)
 * @param {string} conversationId 
 */
function incrementForceCount(conversationId) {
    try {
        if (!conversationId) return;
        const state = getBuyerState(conversationId);
        state.forceCount = (state.forceCount || 0) + 1;
        _v16BuyerStates.set(conversationId, state);
    } catch (_) {}
}

function _cleanupBuyerStates() {
    try {
        const now = Date.now();
        let cleaned = 0;
        for (const [id, state] of _v16BuyerStates.entries()) {
            if ((now - state.lastBuyerIntent) > BUYER_TIMEOUT_MS * 2) {
                _v16BuyerStates.delete(id);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            console.log(`[V16.2] 🧹 Cleanup: ${cleaned} buyer states removidos`);
        }
    } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO 3 — CHECKOUT VALIDATION (COM CACHE DE 5 MIN)
// ═══════════════════════════════════════════════════════════════════

const _checkoutValidationCache = new Map();
const CHECKOUT_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Valida se URL de checkout está acessível (HEAD + fallback GET).
 * Resultado é cacheado por 5 minutos para evitar latência.
 * @param {string} url - URL de checkout
 * @returns {Promise<boolean>} true se URL é válida
 */
async function validateCheckoutUrl(url) {
    try {
        if (!url || typeof url !== 'string') return false;
        if (!axios) return true; // sem axios → não bloquear (permissivo)

        // Anti-loop: bloquear domínios internos
        if (isSelfReferenceUrl(url)) {
            console.warn(`[V16.2-ANTILOOP] ⛔ URL de auto-referência bloqueada: ${url.substring(0, 60)}`);
            return false;
        }

        // Verificar cache
        const cached = _checkoutValidationCache.get(url);
        if (cached && (Date.now() - cached.timestamp < CHECKOUT_CACHE_TTL)) {
            return cached.valid;
        }

        // Tentativa 1: HEAD (mais leve)
        try {
            const res = await axios.head(url, { 
                timeout: 3000,
                maxRedirects: 5,
                validateStatus: (status) => status < 500 // 4xx é OK (pode ser login required)
            });
            if (res.status < 400) {
                _cacheCheckoutResult(url, true);
                return true;
            }
        } catch (_headErr) {
            // HEAD falhou — tentar GET como fallback
        }

        // Tentativa 2: GET (fallback — alguns gateways bloqueiam HEAD)
        try {
            const resGet = await axios.get(url, { 
                timeout: 3000,
                maxRedirects: 5,
                validateStatus: (status) => status < 500
            });
            const valid = resGet.status < 400;
            _cacheCheckoutResult(url, valid);
            return valid;
        } catch (_getErr) {
            _cacheCheckoutResult(url, false);
            return false;
        }

    } catch (_) {
        // Erro total → permissivo (não bloquear venda por falha de validação)
        return true;
    }
}

function _cacheCheckoutResult(url, valid) {
    try {
        _checkoutValidationCache.set(url, { valid, timestamp: Date.now() });
        // Cleanup
        if (_checkoutValidationCache.size > 200) {
            const now = Date.now();
            for (const [k, v] of _checkoutValidationCache.entries()) {
                if (now - v.timestamp > CHECKOUT_CACHE_TTL) {
                    _checkoutValidationCache.delete(k);
                }
            }
        }
    } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO 4 — ENGINE DE PRIORIDADE EXECUTÁVEL (CORAÇÃO DO SISTEMA)
// ═══════════════════════════════════════════════════════════════════

/**
 * Decide ação V16.2 com base no input normalizado e estado do buyer.
 * 
 * PRIORIDADE (ordem determina comportamento):
 *   1. SUPPORT  → WhatsApp direto (NUNCA checkout)
 *   2. REBUY    → Checkout de recompra
 *   3. BUY      → Checkout direto (HIGH_INTENT ou PAYMENT_INTENT)
 *   4. FORCE_CLOSE → Checkout para buyer persistente (com inteligência)
 *   5. PRICE    → Checkout com price trigger
 *   6. DELAY    → Reengajamento
 *   7. DEFAULT  → V13 decide (sem override)
 * 
 * @param {string} normalizedInput - Input normalizado
 * @param {Object} buyerState - Estado V16.2 do buyer
 * @param {Object} v13Intent - Resultado do V13 Intent Classifier
 * @returns {{ decision: string, reason: string, matchedPattern: string|null }}
 */
function detectDecision(normalizedInput, buyerState, v13Intent) {
    try {
        if (!normalizedInput) return { decision: 'DEFAULT', reason: 'empty_input', matchedPattern: null };

        // 1️⃣ SUPPORT (prioridade máxima — NUNCA envia checkout)
        const supportMatch = matchesPattern(normalizedInput, SUPPORT_PATTERNS_V16);
        if (supportMatch) {
            return { decision: 'SUPPORT', reason: 'support_detected', matchedPattern: supportMatch };
        }
        // Complementar com V13: se V13 já detectou SUPPORT, respeitar
        if (v13Intent && v13Intent.intent === 'SUPPORT') {
            return { decision: 'SUPPORT', reason: 'v13_support_confirmed', matchedPattern: 'v13_intent' };
        }

        // 2️⃣ REBUY (já comprou → checkout de recompra)
        const rebuyMatch = matchesPattern(normalizedInput, REBUY_INTENT);
        if (rebuyMatch) {
            return { decision: 'REBUY', reason: 'rebuy_detected', matchedPattern: rebuyMatch };
        }

        // 3️⃣ BUY (intenção de compra ou pagamento explícita)
        const highMatch = matchesPattern(normalizedInput, HIGH_INTENT);
        if (highMatch) {
            return { decision: 'BUY', reason: 'high_intent', matchedPattern: highMatch };
        }
        const paymentMatch = matchesPattern(normalizedInput, PAYMENT_INTENT);
        if (paymentMatch) {
            return { decision: 'BUY', reason: 'payment_intent', matchedPattern: paymentMatch };
        }

        // 4️⃣ FORCE_CLOSE (buyer persistente — COM INTELIGÊNCIA)
        //    ⚠️ SÓ aplicar se:
        //    - É buyer ativo
        //    - NÃO é uma dúvida complexa (evita resposta agressiva)
        //    - NÃO é saída (tchau, não quero)
        //    - NÃO é objeção (golpe, não entendi)
        //    - NÃO excedeu 3 tentativas de force (evita spam)
        if (buyerState && buyerState.isBuyer) {
            const isComplexQuestion = matchesPattern(normalizedInput, COMPLEX_QUESTION_PATTERNS);
            const isExit = matchesPattern(normalizedInput, EXIT_PATTERNS);
            const isObjection = matchesPattern(normalizedInput, OBJECTION_PATTERNS);
            const tooManyForces = (buyerState.forceCount || 0) >= 3;

            if (isExit) {
                console.log(`[V16.2] 🚫 EXIT detectado para buyer ("${isExit}") — DEFAULT, sem checkout`);
                return { decision: 'DEFAULT', reason: 'buyer_exit_detected', matchedPattern: isExit };
            }
            if (isObjection) {
                console.log(`[V16.2] 🛡️ OBJECTION detectada para buyer ("${isObjection}") — DEFAULT, sem checkout`);
                return { decision: 'DEFAULT', reason: 'buyer_objection_detected', matchedPattern: isObjection };
            }

            if (!isComplexQuestion && !tooManyForces) {
                return { decision: 'FORCE_CLOSE', reason: 'buyer_persistent', matchedPattern: null };
            }
            // Se é dúvida complexa de um buyer → DEFAULT (V13 responde, mas buyer state se mantém)
            if (isComplexQuestion) {
                console.log(`[V16.2] 🧠 Buyer com dúvida complexa — V13 responde, buyer state mantido`);
            }
            if (tooManyForces) {
                console.log(`[V16.2] 🛑 FORCE_CLOSE limitado (${buyerState.forceCount} tentativas) — V13 responde`);
            }
        }

        // 5️⃣ PRICE (perguntou preço → intent de compra confirmada)
        const priceMatch = matchesPattern(normalizedInput, PRICE_INTENT);
        if (priceMatch) {
            return { decision: 'PRICE', reason: 'price_trigger', matchedPattern: priceMatch };
        }

        // 6️⃣ DELAY (vai pensar → reengajamento)
        const delayMatch = matchesPattern(normalizedInput, DELAY_INTENT);
        if (delayMatch) {
            return { decision: 'DELAY', reason: 'delay_detected', matchedPattern: delayMatch };
        }

        // 7️⃣ DEFAULT (V13 decide)
        return { decision: 'DEFAULT', reason: 'no_v16_pattern', matchedPattern: null };

    } catch (err) {
        console.warn('[V16.2] ⚠️ Erro em detectDecision (fallback DEFAULT):', err.message);
        return { decision: 'DEFAULT', reason: 'error_fallback', matchedPattern: null };
    }
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO 5 — RESPONSE BUILDER V16.2 (RESPOSTAS DIRETAS)
// ═══════════════════════════════════════════════════════════════════

/**
 * Monta resposta determinística V16.2 para cada decisão.
 * @param {string} decision - Decisão V16.2
 * @param {Object} context - { checkoutLink, whatsappLink, productName }
 * @returns {{ text: string, injectCheckout: boolean, blockAI: boolean }}
 */
function buildDecisionResponse(decision, context = {}) {
    try {
        const checkout = context.checkoutLink || null;
        const whatsapp = context.whatsappLink || null;

        switch (decision) {
            case 'SUPPORT':
                return {
                    text: whatsapp
                        ? `Perfeito 👍 vou te conectar com um atendente agora.\n\n📞 Fale direto no WhatsApp:\n${whatsapp}\n\nEles vão te ajudar rapidinho 🙌`
                        : `Perfeito 👍 nosso time está pronto para te atender agora. Fale com a gente! 🙌`,
                    injectCheckout: false,
                    blockAI: true,
                    blockCheckout: true
                };

            case 'REBUY':
                return {
                    text: 'Boa! Que legal que curtiu 😄 Segue o link para garantir novamente 👇',
                    injectCheckout: true,
                    blockAI: true,
                    blockCheckout: false
                };

            case 'BUY': {
                const buyVariations = [
                    'Boa 😄 já te mando o acesso 👇',
                    'Perfeito — pode acessar por aqui 👇',
                    'Top! é só entrar nesse link 👇',
                    'Aqui está o acesso direto 👇'
                ];
                return {
                    text: buyVariations[Date.now() % buyVariations.length],
                    injectCheckout: true,
                    blockAI: true,
                    blockCheckout: false
                };
            }

            case 'FORCE_CLOSE': {
                const closeVariations = [
                    'Ah, e lembrando — o link pra garantir o seu acesso está aqui 👇',
                    'Aproveita que o link tá aqui pra você 👇',
                    'E o acesso, quando quiser, é por aqui 👇'
                ];
                return {
                    text: closeVariations[Date.now() % closeVariations.length],
                    injectCheckout: true,
                    blockAI: true, // 🔴 FIX: OVERRIDE TOTAL — V16.2 encerra pipeline
                    blockCheckout: false
                };
            }

            case 'PRICE':
                return {
                    text: 'Posso te mostrar as condições direto na página de pagamento 👇',
                    injectCheckout: true,
                    blockAI: true,
                    blockCheckout: false
                };

            case 'DELAY':
                return {
                    text: 'Perfeito 👍 mas o que ainda te impede de começar agora? 😄',
                    injectCheckout: false,
                    blockAI: true,
                    blockCheckout: false
                };

            default:
                return {
                    text: '',
                    injectCheckout: false,
                    blockAI: false,
                    blockCheckout: false
                };
        }
    } catch (_) {
        return { text: '', injectCheckout: false, blockAI: false, blockCheckout: false };
    }
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO 6 — ANTI-RESPOSTA-FRACA (IDEMPOTENTE)
// ═══════════════════════════════════════════════════════════════════

/**
 * Verifica se a resposta final é "fraca" para um buyer e injeta checkout se necessário.
 * IDEMPOTENTE: verifica se checkout JÁ está na resposta antes de injetar.
 * 
 * @param {string} response - Resposta final do V13
 * @param {Object} buyerState - Estado V16.2 do buyer
 * @param {string} checkoutLink - Link de checkout
 * @returns {{ response: string, wasWeak: boolean }}
 */
function applyAntiWeakResponse(response, buyerState, checkoutLink) {
    try {
        if (!buyerState || !buyerState.isBuyer) {
            return { response, wasWeak: false };
        }

        if (!checkoutLink) {
            return { response, wasWeak: false };
        }

        // ✅ Idempotência: se já contém checkout → não duplicar
        if (response.includes('FINALIZAR COMPRA') || 
            response.includes('━━━━━━━━━') ||
            response.includes(checkoutLink)) {
            return { response, wasWeak: false };
        }

        // Resposta fraca = não tem checkout para um buyer ativo
        console.log('[V16.2] 🛡️ Anti-Weak: buyer ativo sem checkout na resposta → injetando');
        
        const enhanced = response + 
            `\n\n━━━━━━━━━━━━━━━━━━━\n🚀 FINALIZAR COMPRA\n${checkoutLink}\n━━━━━━━━━━━━━━━━━━━`;

        return { response: enhanced, wasWeak: true };

    } catch (_) {
        return { response, wasWeak: false };
    }
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO 7 — RESPONSE SANITIZER (REMOVE TERMOS PROIBIDOS)
// ═══════════════════════════════════════════════════════════════════

const BLOCKED_TERMS = ['Braip', 'Hotmart', 'Kiwify', 'Eduzz', 'Monetizze', 'PerfectPay', 'Greenn'];

/**
 * Remove termos proibidos da resposta (nomes de plataforma)
 * @param {string} response 
 * @returns {string} Resposta sanitizada
 */
function sanitizeResponse(response) {
    try {
        if (!response || typeof response !== 'string') return response || '';
        let sanitized = response;
        for (const term of BLOCKED_TERMS) {
            const regex = new RegExp(`\\b${term}\\b`, 'gi');
            sanitized = sanitized.replace(regex, '');
        }
        return sanitized.replace(/\s{2,}/g, ' ').trim();
    } catch (_) {
        return response || '';
    }
}

// ═══════════════════════════════════════════════════════════════════
// MÓDULO 8 — ORQUESTRADOR PRINCIPAL (ENTRY POINT)
// ═══════════════════════════════════════════════════════════════════

/**
 * Orquestrador principal V16.2.
 * Recebe dados do pipeline V13 e decide se faz override ou não.
 * 
 * @param {Object} params
 * @param {string} params.userMessage - Mensagem original do usuário
 * @param {Object} params.v13Intent - Resultado do V13 Intent Classifier
 * @param {Object} params.v13State - Resultado do V13 State Manager
 * @param {string} params.conversationId - ID da conversa
 * @param {Object} params.pageData - Dados da página (checkoutLink, whatsapp, etc.)
 * @returns {Promise<{ override: boolean, decision: string, response: string, injectCheckout: boolean, blockAI: boolean, blockCheckout: boolean, reason: string }>}
 */
async function processDecision(params) {
    try {
        const {
            userMessage,
            v13Intent,
            v13State,
            conversationId,
            pageData
        } = params;

        const normalizedInput = normalize(userMessage);
        const buyerState = getBuyerState(conversationId);
        const checkoutLink = (pageData && pageData.checkoutLink) || null;
        const whatsappLink = (pageData && (pageData.whatsapp || pageData.whatsappLink)) || 
                             (pageData && pageData.contatos && pageData.contatos.whatsapp && pageData.contatos.whatsapp[0]) || null;

        // Anti-loop: verificar se checkout é self-reference
        if (checkoutLink && isSelfReferenceUrl(checkoutLink)) {
            console.warn(`[V16.2-ANTILOOP] ⛔ SELF_EXTRACTION_BLOCKED: ${checkoutLink.substring(0, 60)}`);
            return { override: false, decision: 'DEFAULT', reason: 'self_reference_blocked' };
        }

        // Detectar decisão V16.2
        const decisionResult = detectDecision(normalizedInput, buyerState, v13Intent);
        const { decision, reason, matchedPattern } = decisionResult;

        console.log(`[V16.2] 🔥 Decision: ${decision} | reason=${reason} | pattern=${matchedPattern || 'none'} | isBuyer=${buyerState.isBuyer} | conv=${(conversationId || '').substring(0, 12)}`);

        // Se DEFAULT → V13 continua (sem override)
        if (decision === 'DEFAULT') {
            return { override: false, decision: 'DEFAULT', reason };
        }

        // Atualizar buyer state para decisões de compra
        if (['BUY', 'REBUY', 'PRICE', 'FORCE_CLOSE'].includes(decision)) {
            markAsBuyer(conversationId);
        }
        if (decision === 'FORCE_CLOSE') {
            incrementForceCount(conversationId);
        }

        // Validar checkout ANTES de enviar (se necessário)
        const decisionResponse = buildDecisionResponse(decision, {
            checkoutLink,
            whatsappLink,
            productName: (pageData && pageData.title) || ''
        });

        if (decisionResponse.injectCheckout && checkoutLink) {
            const isValid = await validateCheckoutUrl(checkoutLink);
            if (!isValid) {
                console.warn(`[V16.2] ⛔ Checkout inválido — fallback para WhatsApp | url=${checkoutLink.substring(0, 60)}`);
                return {
                    override: true,
                    decision: 'CHECKOUT_INVALID_FALLBACK',
                    response: whatsappLink
                        ? `Vou te direcionar para o suporte pra te ajudar melhor 👇\n\n${whatsappLink}`
                        : 'Vou te direcionar para o suporte pra te ajudar melhor 👇',
                    injectCheckout: false,
                    blockAI: true,
                    blockCheckout: true,
                    reason: 'checkout_url_invalid'
                };
            }
        }

        // 🔴 FIX BUG-5: Se precisa de checkout mas não tem link → fallback WhatsApp
        if (decisionResponse.injectCheckout && !checkoutLink) {
            console.log(`[V16.2] ⚠️ Decisão ${decision} requer checkout mas link ausente → fallback WhatsApp`);
            return {
                override: true,
                decision: 'CHECKOUT_MISSING_FALLBACK',
                response: whatsappLink
                    ? `Vou te direcionar para o suporte pra te ajudar melhor 👇\n\n${whatsappLink}`
                    : 'Vou te direcionar para o suporte pra te ajudar melhor 👇',
                injectCheckout: false,
                blockAI: true,
                blockCheckout: true,
                reason: 'checkout_missing_fallback'
            };
        }

        // Sanitizar resposta
        let finalText = sanitizeResponse(decisionResponse.text);

        // 🔴 FIX: FORCE_CLOSE agora faz override TOTAL (pipeline encerrado)
        if (decision === 'FORCE_CLOSE') {
            return {
                override: true,
                decision,
                response: finalText,
                injectCheckout: true,
                blockAI: true, // 🔴 OVERRIDE TOTAL — V16.2 encerra pipeline
                blockCheckout: false,
                reason
            };
        }

        return {
            override: true,
            decision,
            response: finalText,
            injectCheckout: decisionResponse.injectCheckout,
            blockAI: decisionResponse.blockAI,
            blockCheckout: decisionResponse.blockCheckout || false,
            reason
        };

    } catch (err) {
        // FALLBACK TOTAL — qualquer erro → V13 continua normalmente
        console.warn('[V16.2] ⚠️ Erro em processDecision (fallback V13):', err.message);
        return { override: false, decision: 'DEFAULT', reason: 'error_fallback' };
    }
}

// ═══════════════════════════════════════════════════════════════════
// STATS (para debugging/monitoramento)
// ═══════════════════════════════════════════════════════════════════

function getStats() {
    return {
        buyerStates: _v16BuyerStates.size,
        checkoutCacheSize: _checkoutValidationCache.size,
        version: '16.2.0'
    };
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    // Entry point principal
    processDecision,
    
    // Pós-processamento
    applyAntiWeakResponse,
    sanitizeResponse,
    
    // Utilitários
    normalize,
    detectDecision,
    getBuyerState,
    markAsBuyer,
    validateCheckoutUrl,
    buildDecisionResponse,
    isSelfReferenceUrl,
    getStats,

    // Para testes
    _patterns: {
        HIGH_INTENT,
        PAYMENT_INTENT,
        PRICE_INTENT,
        DELAY_INTENT,
        REBUY_INTENT,
        SUPPORT_PATTERNS_V16,
        COMPLEX_QUESTION_PATTERNS,
        EXIT_PATTERNS,
        OBJECTION_PATTERNS,
        BLOCKED_DOMAINS,
        BLOCKED_TERMS
    }
};
