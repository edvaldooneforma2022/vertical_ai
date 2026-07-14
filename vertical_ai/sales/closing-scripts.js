/**
 * 🔥 CLOSING SCRIPTS — Link Mágico V8.0
 *
 * Adiciona frases de fechamento naturais e contextuais.
 * NÃO parece script. Varia com base no contexto e intenção.
 *
 * Feature flag: FEATURE_CLOSING_SCRIPTS
 * Fallback: retorna resposta original sem alteração.
 *
 * @version 1.0.0
 */

'use strict';

// ─────────────────────────────────────────────────────────────────
// BANCO DE SCRIPTS DE FECHAMENTO POR INTENÇÃO
// ─────────────────────────────────────────────────────────────────

const CLOSING_SCRIPTS = {
    ready_to_buy: {
        // Urgência leve — confirmar decisão
        scripts: [
            'Quem começa hoje, já sai na frente amanhã.',
            'Depois de ativar, você vai se perguntar por que não fez antes.',
            'Tá tudo pronto pra você — é só dar o próximo passo.',
            'É agora. Você já entendeu o valor — só falta clicar.',
            'Quem entrou ontem já está usando. Sua vez.',
            'O mais difícil já passou — decidir. Agora é só ativar.'
        ]
    },
    interest: {
        // Reforçar benefício + próximo passo
        scripts: [
            'A parte boa é que você já tá no caminho certo.',
            'Isso aqui muda a forma como você faz as coisas.',
            'Quem começa a usar, raramente volta pro método antigo.',
            'Pensa assim: se funcionar pra metade do que promete, já valeu.',
            'A diferença entre quem vai e quem fica é essa decisão aqui.',
            'O próximo passo é simples — e o resultado pode ser grande.'
        ]
    },
    objection: {
        // Prova + simplificação
        scripts: [
            'Eu entendo a dúvida. Por isso existe a garantia — zero risco.',
            'Muita gente pensou igual a você. Depois agradeceu por ter tentado.',
            'Funciona? Olha os resultados de quem testou. Números reais.',
            'Não é promessa — é estrutura que funciona. Testa e comprova.',
            'Se não fosse bom, a gente não botava garantia. Simples assim.',
            'O risco maior é continuar fazendo do jeito que não tá funcionando.'
        ]
    },
    hesitation: {
        // Segurança + facilidade
        scripts: [
            'Sem compromisso de longo prazo. Testa, e se não curtir, cancela.',
            'Você não precisa decidir pra sempre — só dar o primeiro passo.',
            'Começa pelo mais simples. Depois você decide se quer ir além.',
            'Pior do que investir e não gostar, é não testar e ficar na dúvida.',
            'É mais fácil do que parece. Quem começa, se surpreende.',
            'Daqui a uma semana, você vai estar feliz por ter começado hoje.'
        ]
    },
    exit: {
        // Última carta (sem forçar)
        scripts: [
            'Sem problema! Se mudar de ideia, essa porta continua aberta.',
            'Tudo bem. Mas lembra: a oferta pode não estar igual depois.',
            'Respeito total. Mas guarda esse link — pode ser útil depois.',
            'Ok! Se precisar de algo no futuro, é só voltar aqui.',
            'Tranquilo! Só não quero que você perca algo por não ter visto tudo.'
        ]
    },
    curiosity: {
        // Puxar pra dentro
        scripts: [
            'Quer que eu te mostre o que mais chama atenção aqui?',
            'Tem um detalhe que normalmente surpreende quem descobre...',
            'O mais interessante ainda não apareceu. Quer ver?',
            'Se você gostou disso, espera até ver o que vem junto...',
            'Isso aqui é só a superfície. O melhor tá logo abaixo.'
        ]
    }
};

// Anti-repetição por conversa
const _usedScripts = new Map();

// ─────────────────────────────────────────────────────────────────
// FUNÇÃO PRINCIPAL — applyClosingLayer
// ─────────────────────────────────────────────────────────────────

/**
 * Aplica script de fechamento contextual na resposta.
 *
 * @param {object} params
 * @param {string} params.response       — Resposta atual da IA
 * @param {string} params.intent         — Intenção (comprar, duvida, objecao, sair, curioso)
 * @param {string} params.action         — Ação do decision engine (fechar, educar, etc.)
 * @param {string} params.conversationId — ID da conversa
 * @returns {string}                     — Resposta com closing script
 */
function applyClosingLayer({ response = '', intent = '', action = '', conversationId = null } = {}) {
    try {
        if (!response || typeof response !== 'string') return response;

        // Mapear para chave do banco de scripts
        const scriptKey = mapToScriptKey(intent, action);
        const bank = CLOSING_SCRIPTS[scriptKey] || CLOSING_SCRIPTS.curiosity;

        // Anti-repetição
        const convKey = conversationId || '_default';
        if (!_usedScripts.has(convKey)) {
            _usedScripts.set(convKey, new Set());
        }
        const used = _usedScripts.get(convKey);

        const available = bank.scripts.filter(s => !used.has(s));

        // Se já usou todos, não forçar mais
        if (available.length === 0) {
            return response;
        }

        const selected = available[Math.floor(Math.random() * available.length)];
        used.add(selected);

        // Limpateza de cache
        if (_usedScripts.size > 500) {
            const oldest = _usedScripts.keys().next().value;
            _usedScripts.delete(oldest);
        }

        // Não duplicar se algo similar já está na resposta
        const responseLower = response.toLowerCase();
        const scriptWords = selected.toLowerCase().split(' ').slice(0, 4).join(' ');
        if (responseLower.includes(scriptWords)) {
            return response;
        }

        // Adicionar ao final
        const separator = response.endsWith('\n') ? '' : '\n\n';

        console.log(`🔥 [CLOSING-LAYER] Script aplicado (key=${scriptKey}): "${selected.substring(0, 40)}..."`);

        return response + separator + selected;
    } catch (err) {
        console.warn('⚠️ [CLOSING-LAYER] Erro (fallback):', err.message);
        return response;
    }
}

/**
 * Mapeia intent/action para chave do banco de scripts.
 */
function mapToScriptKey(intent, action) {
    // Prioridade por ação
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

    const intentMap = {
        'comprar': 'ready_to_buy',
        'duvida': 'interest',
        'objecao': 'objection',
        'sair': 'exit',
        'curioso': 'curiosity'
    };

    if (action && actionMap[action]) return actionMap[action];
    if (intent && intentMap[intent]) return intentMap[intent];
    return 'curiosity';
}

module.exports = { applyClosingLayer };
