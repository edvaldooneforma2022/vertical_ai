/**
 * 🔥 V12.0 — FORCE CHECKOUT LAYER (BACKEND SOBERANO)
 * 
 * Garante que o backend SEMPRE injeta o checkout link correto
 * quando há intenção de compra, independente do que a IA responde.
 * 
 * REGRAS:
 * - 100% aditivo — não altera nenhum módulo existente
 * - Protegido por FEATURE_V12_FORCE_CHECKOUT
 * - try/catch total — fallback retorna resposta original
 * - Atua APÓS Orchestrator e todas as camadas
 * - NÃO duplica link se já presente
 * - NÃO atua em modo manual/desligado
 * 
 * @version 12.0.0
 * @author Link Mágico Team
 */

// Padrões expandidos de intenção de compra
const BUY_TRIGGERS = [
    'comprar', 'compra', 'quero', 'fechar', 'garantir',
    'como faço', 'valor', 'preço', 'preco', 'quanto', 'custa',
    'link', 'checkout', 'acesso', 'começar', 'liberar',
    'adquirir', 'assinar', 'pagamento', 'pagar', 'pago',
    'finalizar', 'inscrição', 'inscrever', 'garantir meu',
    'boleto', 'pix', 'cartão', 'cartao', 'parcelar', 'parcela',
    'investimento', 'investir', 'contratar', 'cadastrar',
    'compro', 'onde compro', 'como pago', 'como paga',
    'pode parcelar', 'formas de pagamento', 'aceita',
    'bora fechar', 'fechar negocio', 'vou levar',
    'me manda o link', 'manda o link', 'quero o link',
    'quero esse', 'quero o produto', 'quero adquirir'
];

// Padrões de pós-venda (NÃO forçar checkout)
const POST_SALE_TRIGGERS = [
    'já comprei', 'ja comprei', 'já adquiri', 'já paguei',
    'não recebi', 'nao recebi', 'meu acesso', 'meu login',
    'já sou aluno', 'ja sou aluno', 'já tenho', 'ja tenho',
    'suporte', 'problema com', 'não funciona', 'reembolso',
    'cancelar', 'cancelamento', 'estorno'
];

/**
 * Detecta se a mensagem tem intenção de compra (expandido)
 * @param {string} message - Mensagem do usuário
 * @returns {boolean}
 */
function shouldForceCheckout(message) {
    try {
        if (!message || typeof message !== 'string') return false;
        
        const msg = message.toLowerCase().trim();
        
        // Verificar se é pós-venda PRIMEIRO (prioridade)
        const isPostSale = POST_SALE_TRIGGERS.some(t => msg.includes(t));
        if (isPostSale) {
            console.log('[V12-FORCE] ⏭️ Pós-venda detectado — checkout NÃO forçado');
            return false;
        }
        
        // Verificar intenção de compra
        const hasBuyIntent = BUY_TRIGGERS.some(t => msg.includes(t));
        
        if (hasBuyIntent) {
            console.log('[V12-FORCE] 🔥 Intenção de compra detectada');
        }
        
        return hasBuyIntent;
    } catch (_) {
        return false;
    }
}

/**
 * Injeta checkout link na resposta (SE não presente)
 * Garante que o link aparece exatamente 1 vez
 * 
 * @param {string} response - Resposta da IA
 * @param {string} checkoutLink - Link de checkout
 * @param {Object} options - Opções
 * @param {string} options.style - 'subtle' | 'strong' | 'auto' (default: 'auto')
 * @returns {string} Resposta com checkout garantido
 */
function injectCheckout(response, checkoutLink, options = {}) {
    try {
        if (!checkoutLink) return response;
        if (!response) return checkoutLink;
        
        const trimmedLink = checkoutLink.trim();
        
        // Já tem o link? NÃO duplicar
        if (response.includes(trimmedLink)) {
            console.log('[V12-FORCE] ✅ Link já presente — sem duplicação');
            return response;
        }
        
        // Verificar quantos links de checkout já existem (anti-spam)
        const linkCount = (response.match(/https?:\/\/[^\s]+/g) || []).length;
        
        if (linkCount >= 3) {
            console.log('[V12-FORCE] ⚠️ Muitos links na resposta — sem injeção extra');
            return response;
        }
        
        // Injetar com estilo apropriado
        const style = options.style || 'auto';
        let injection;
        
        switch (style) {
            case 'subtle':
                injection = `\n\n👉 Finalize aqui: ${trimmedLink}`;
                break;
            case 'strong':
                injection = `\n\n━━━━━━━━━━━━━━━━━━━\n🚀 FINALIZAR COMPRA\n${trimmedLink}\n━━━━━━━━━━━━━━━━━━━`;
                break;
            default: // auto
                injection = `\n\n👉 Para finalizar com segurança:\n${trimmedLink}`;
        }
        
        console.log(`[V12-FORCE] 💉 Checkout injetado (style=${style})`);
        return `${response}${injection}`;
        
    } catch (err) {
        console.warn('[V12-FORCE] ⚠️ Erro na injeção (resposta original mantida):', err.message);
        return response;
    }
}

/**
 * Fallback inteligente quando NÃO há checkout disponível
 * Nunca deixa o usuário sem resposta
 * 
 * @param {string} response - Resposta da IA
 * @param {boolean} hasBuyIntent - Se tem intenção de compra
 * @returns {string} Resposta com fallback se necessário
 */
function applyFallback(response, hasBuyIntent) {
    try {
        if (!response) return response;
        
        // Só aplicar fallback se tem intenção de compra E não tem nenhum link
        if (hasBuyIntent && !/(https?:\/\/[^\s]+)/g.test(response)) {
            console.log('[V12-FORCE] 🛡️ Fallback ativado — sem checkout disponível');
            return `${response}\n\n👉 Posso te mostrar como funciona primeiro ou te direcionar para atendimento. O que prefere?`;
        }
        
        return response;
    } catch (_) {
        return response;
    }
}

/**
 * Pipeline completo do Force Checkout Layer
 * Aplica tudo em sequência: detect → inject/fallback
 * 
 * @param {Object} params
 * @param {string} params.response - Resposta da IA
 * @param {string} params.message - Mensagem do usuário  
 * @param {string} params.checkoutLink - Link de checkout (pode ser null)
 * @param {string} params.mode - Modo: 'auto' | 'manual' | 'off'
 * @returns {{ text: string, forced: boolean, reason: string }}
 */
function applyForceCheckoutPipeline({ response, message, checkoutLink, mode }) {
    try {
        // Bypass total se não é modo automático
        if (mode !== 'auto') {
            return { text: response, forced: false, reason: 'mode_bypass' };
        }
        
        const hasBuyIntent = shouldForceCheckout(message);
        
        // Sem intenção de compra → sem ação
        if (!hasBuyIntent) {
            return { text: response, forced: false, reason: 'no_buy_intent' };
        }
        
        // TEM intenção de compra
        if (checkoutLink) {
            // Tem checkout → injetar se necessário
            const injected = injectCheckout(response, checkoutLink);
            const wasInjected = injected !== response;
            return {
                text: injected,
                forced: wasInjected,
                reason: wasInjected ? 'checkout_injected' : 'checkout_already_present'
            };
        } else {
            // SEM checkout → fallback inteligente
            const fallbacked = applyFallback(response, true);
            return {
                text: fallbacked,
                forced: fallbacked !== response,
                reason: 'fallback_no_checkout'
            };
        }
        
    } catch (err) {
        console.error('[V12-FORCE] ❌ Erro no pipeline (resposta mantida):', err.message);
        return { text: response, forced: false, reason: 'error_fallback' };
    }
}

module.exports = {
    shouldForceCheckout,
    injectCheckout,
    applyFallback,
    applyForceCheckoutPipeline,
    BUY_TRIGGERS,
    POST_SALE_TRIGGERS
};
