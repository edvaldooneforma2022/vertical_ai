/**
 * 🎯 CTA ENGINE — Link Mágico V8.0
 *
 * Seleciona automaticamente o melhor CTA com base na intenção do usuário.
 * Roda APÓS o Sales Layer, APENAS no modo automático.
 *
 * NÃO altera: prompt universal, auto-instructions, decision engine, sales-layer.
 * APENAS enriquece a resposta com CTA contextual.
 *
 * Feature flag: FEATURE_SMART_CTA
 * Fallback: retorna resposta original sem alteração.
 *
 * @version 1.0.0
 */

'use strict';

// ─────────────────────────────────────────────────────────────────
// BANCO DE CTAs POR INTENÇÃO
// ─────────────────────────────────────────────────────────────────

const CTA_BANK = {
    ready_to_buy: {
        type: 'primary',
        templates: [
            'Clique aqui e garanta o seu agora →',
            'Aproveite antes que acabe →',
            'Acesse agora e comece hoje mesmo →',
            'Garanta sua vaga enquanto está disponível →',
            'É só clicar aqui pra ativar o seu →'
        ]
    },
    interest: {
        type: 'secondary',
        templates: [
            'Quer ver como funciona na prática?',
            'Posso te mostrar mais detalhes se quiser.',
            'Dá uma olhada, acho que vai fazer sentido pra você →',
            'Veja o que está incluído →',
            'Conheça tudo o que vem no pacote →'
        ]
    },
    objection: {
        type: 'soft',
        templates: [
            'E se eu te mostrar que tem garantia total?',
            'Deixa eu te mostrar os resultados reais...',
            'Tem gente na mesma situação que já resolveu assim →',
            'Olha só o que quem testou falou...',
            'Veja os depoimentos de quem já usou →'
        ]
    },
    hesitation: {
        type: 'secondary',
        templates: [
            'Sem compromisso — você pode testar sem risco.',
            'Tem garantia de satisfação. Zero risco pra você.',
            'Pode cancelar a qualquer momento se não gostar.',
            'É sem pegadinha. Se não curtir, pega o dinheiro de volta.',
            'O risco é zero — a garantia cobre tudo.'
        ]
    },
    exit: {
        type: 'soft',
        templates: [
            'Antes de sair, tem algo que talvez você não tenha visto...',
            'Calma — tem um detalhe importante que muda tudo...',
            'Espera, deixa eu te mostrar uma coisa rápida...',
            'Só um segundo — tem um bônus que você pode perder...',
            'Última coisa: isso aqui costuma fazer diferença →'
        ]
    },
    curiosity: {
        type: 'soft',
        templates: [
            'Quer saber mais sobre como funciona?',
            'Posso te explicar melhor se quiser.',
            'Tem bastante coisa legal aqui. Quer ver?',
            'O que te chamou atenção? Posso aprofundar.',
            'Quer que eu te mostre os principais benefícios?'
        ]
    }
};

// ─────────────────────────────────────────────────────────────────
// MAPEAMENTO DECISION ENGINE → CTA INTENT
// ─────────────────────────────────────────────────────────────────

function mapToCtaIntent(decisionIntent, decisionAction) {
    try {
        // Mapeamento direto por intenção do decision engine
        const intentMap = {
            'comprar': 'ready_to_buy',
            'duvida': 'interest',
            'objecao': 'objection',
            'sair': 'exit',
            'curioso': 'curiosity'
        };

        // Mapeamento por ação decidida
        const actionMap = {
            'fechar': 'ready_to_buy',
            'link_direto': 'ready_to_buy',
            'quebrar_objecao': 'objection',
            'reengajar': 'exit',
            'reter': 'hesitation',
            'educar': 'curiosity',
            'engajar': 'interest',
            'provar': 'objection'
        };

        // Prioridade: ação > intenção (ação é mais contextualizada)
        if (decisionAction && actionMap[decisionAction]) {
            return actionMap[decisionAction];
        }
        if (decisionIntent && intentMap[decisionIntent]) {
            return intentMap[decisionIntent];
        }

        return 'curiosity'; // fallback seguro
    } catch (_) {
        return 'curiosity';
    }
}

// ─────────────────────────────────────────────────────────────────
// ANTI-REPETIÇÃO: Rastrear CTAs usados por conversa
// ─────────────────────────────────────────────────────────────────

const _usedCTAs = new Map(); // conversationId → Set de CTAs usados

function getUnusedCTA(intent, conversationId) {
    try {
        const bank = CTA_BANK[intent] || CTA_BANK.curiosity;
        const templates = bank.templates;

        // Obter CTAs já usados nesta conversa
        const usedKey = conversationId || '_default';
        if (!_usedCTAs.has(usedKey)) {
            _usedCTAs.set(usedKey, new Set());
        }
        const used = _usedCTAs.get(usedKey);

        // Filtrar CTAs não usados
        const available = templates.filter(t => !used.has(t));

        // Se todos foram usados, resetar
        if (available.length === 0) {
            used.clear();
            const selected = templates[Math.floor(Math.random() * templates.length)];
            used.add(selected);
            return { text: selected, type: bank.type };
        }

        // Selecionar aleatório dos disponíveis
        const selected = available[Math.floor(Math.random() * available.length)];
        used.add(selected);

        // Limpar cache se muito grande (evitar memory leak)
        if (_usedCTAs.size > 500) {
            const oldest = _usedCTAs.keys().next().value;
            _usedCTAs.delete(oldest);
        }

        return { text: selected, type: bank.type };
    } catch (_) {
        return { text: '', type: 'soft' };
    }
}

// ─────────────────────────────────────────────────────────────────
// FUNÇÃO PRINCIPAL — getCTA
// ─────────────────────────────────────────────────────────────────

/**
 * Seleciona o melhor CTA com base na intenção e contexto.
 *
 * @param {object} params
 * @param {string} params.intent         — Intenção do decision engine (comprar, duvida, etc.)
 * @param {string} params.action         — Ação decidida (fechar, educar, etc.)
 * @param {object} params.context        — Contexto da página (url, contatos, etc.)
 * @param {string} params.conversationId — ID da conversa (para anti-repetição)
 * @returns {{ text: string, url: string, type: string } | null}
 */
function getCTA({ intent = '', action = '', context = {}, conversationId = null } = {}) {
    try {
        const ctaIntent = mapToCtaIntent(intent, action);
        const cta = getUnusedCTA(ctaIntent, conversationId);

        if (!cta.text) return null;

        // Determinar URL do CTA
        let url = '';
        if (context && context.url) {
            url = context.url;
        }
        if (context && context.contatos && context.contatos.whatsapp && context.contatos.whatsapp.length > 0) {
            // Se tem WhatsApp e intenção é fechar, usar WhatsApp
            if (ctaIntent === 'ready_to_buy' || ctaIntent === 'hesitation') {
                url = context.contatos.whatsapp[0];
            }
        }

        console.log(`🎯 [CTA-ENGINE] Intent=${ctaIntent} Type=${cta.type} Text="${cta.text.substring(0, 40)}..."`);

        return {
            text: cta.text,
            url: url,
            type: cta.type,
            intent: ctaIntent
        };
    } catch (err) {
        console.warn('⚠️ [CTA-ENGINE] Erro (retornando null):', err.message);
        return null;
    }
}

/**
 * Aplica CTA na resposta (enriquece, não substitui).
 *
 * @param {string} response     — Resposta atual da IA
 * @param {object} ctaResult    — Resultado do getCTA
 * @returns {string}            — Resposta enriquecida
 */
function applyCTA(response, ctaResult) {
    try {
        if (!ctaResult || !ctaResult.text) return response;
        if (!response || typeof response !== 'string') return response;

        // Não duplicar se CTA similar já existe na resposta
        const responseLower = response.toLowerCase();
        const ctaLower = ctaResult.text.toLowerCase().substring(0, 20);
        if (responseLower.includes(ctaLower)) return response;

        // Verificar se resposta já tem um CTA (link ou chamada para ação)
        const hasExistingCTA = responseLower.includes('clique') ||
            responseLower.includes('acesse') ||
            responseLower.includes('garanta') ||
            responseLower.includes('compre') ||
            responseLower.includes('http');

        // Se já tem CTA forte e o novo é soft, não adicionar
        if (hasExistingCTA && ctaResult.type === 'soft') return response;

        // Adicionar CTA ao final
        const separator = response.endsWith('\n') ? '' : '\n\n';
        return response + separator + ctaResult.text;
    } catch (_) {
        return response;
    }
}

module.exports = { getCTA, applyCTA, mapToCtaIntent };
