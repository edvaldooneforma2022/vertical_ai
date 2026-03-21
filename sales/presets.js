/**
 * ⚙️ PRESETS MULTI-NICHO — Link Mágico V8.0
 *
 * Define COMPORTAMENTO de venda + BLOCOS DE COPY por estágio.
 * NÃO altera: instructions, knowledge_base, scraping, prompt base ou contexto da URL.
 * APENAS configura: pressão, estilo, objetivo, urgência e frases de condução da venda.
 *
 * @version 2.0.0 — com copy real por estágio
 */

'use strict';

const PRESETS = {

  // ── Preset padrão (fallback seguro) ───────────────────────────────────────
  default: {
    name: 'Padrão Inteligente',
    description: 'Comportamento equilibrado, consultivo e adaptativo',
    behavior: {
      pressure: 'medium',
      style:    'consultivo',
      goal:     'assist',
      urgency:  false
    },
    copy: {
      discovery:  [
        'Isso faz sentido para o que você busca?',
        'Tem mais alguma dúvida que posso esclarecer?'
      ],
      engagement: [
        'Isso aqui já resolve boa parte do que você precisa.',
        'Pelo que você falou, isso se encaixa bem no seu caso.'
      ],
      objection:  [
        'O que te impede de avançar agora?',
        'Você quer entender melhor antes ou já faz sentido ir em frente?'
      ],
      closing:    [
        'Quer que eu te mostre o próximo passo?',
        'Posso te ajudar a dar o primeiro passo agora.'
      ]
    }
  },

  // ── Produto Digital ────────────────────────────────────────────────────────
  produto_digital: {
    name: 'Produto Digital',
    description: 'Alta conversão para infoprodutos, cursos e ebooks',
    behavior: {
      pressure: 'high',
      style:    'direto',
      goal:     'conversion',
      urgency:  true
    },
    copy: {
      discovery:  [
        'Se isso resolver o problema, faria sentido avançar?',
        'Você já tentou alguma solução antes ou seria a primeira vez?'
      ],
      engagement: [
        'Pelo que você falou, isso já se encaixa bem no que você precisa.',
        'Isso resolve exatamente o ponto que você trouxe.'
      ],
      objection:  [
        'Se isso realmente resolver, o que te impediria de começar agora?',
        'É mais dúvida ou só falta decidir?'
      ],
      closing:    [
        'Você já viu como funciona. A única coisa agora é começar.',
        'Faz mais sentido começar agora ou continuar do jeito que está?'
      ]
    }
  },

  // ── Afiliado ───────────────────────────────────────────────────────────────
  afiliado: {
    name: 'Afiliado',
    description: 'Persuasão máxima para links de afiliado',
    behavior: {
      pressure: 'high',
      style:    'persuasivo',
      goal:     'conversion',
      urgency:  true
    },
    copy: {
      discovery:  [
        'Você já tentou vender como afiliado antes ou está começando agora?',
        'Hoje sua maior dificuldade é tráfego ou conversão?'
      ],
      engagement: [
        'A maioria perde venda exatamente nesse ponto que você falou.',
        'Isso aqui resolve justamente onde a maioria trava.'
      ],
      objection:  [
        'Se você já tem tráfego, faz sentido deixar essas vendas escaparem?',
        'O que está te segurando agora?'
      ],
      closing:    [
        'Você já entendeu como isso funciona. Agora é só colocar pra rodar.',
        'Quer ativar agora ou prefere continuar testando sozinho?'
      ]
    }
  },

  // ── Serviço ────────────────────────────────────────────────────────────────
  servico: {
    name: 'Serviço',
    description: 'Foco em agendamento e qualificação de leads de serviço',
    behavior: {
      pressure: 'medium',
      style:    'consultivo',
      goal:     'schedule',
      urgency:  false
    },
    copy: {
      discovery:  [
        'Você está buscando mais clientes ou organizar melhor seu atendimento?',
        'Hoje você responde tudo manualmente?'
      ],
      engagement: [
        'Isso aqui já resolveria boa parte do seu atendimento.',
        'Você conseguiria automatizar boa parte do processo com isso.'
      ],
      objection:  [
        'Se isso resolve seu atendimento, o que falta pra dar o próximo passo?',
        'Você quer entender melhor ou já faz sentido avançar?'
      ],
      closing:    [
        'Quer ver como isso funcionaria no seu caso?',
        'Podemos já colocar isso rodando pra você testar.'
      ]
    }
  },

  // ── Captura de Leads ───────────────────────────────────────────────────────
  lead: {
    name: 'Captura de Leads',
    description: 'Educativo e leve, foco em capturar dados de contato',
    behavior: {
      pressure: 'low',
      style:    'educativo',
      goal:     'lead',
      urgency:  false
    },
    copy: {
      discovery:  [
        'Você já captura leads hoje ou ainda não tem isso estruturado?',
        'Você costuma perder contatos por falta de resposta?'
      ],
      engagement: [
        'Isso já começa a organizar seu processo.',
        'Você passa a não perder mais contatos.'
      ],
      objection:  [
        'Faz sentido estruturar isso agora?',
        'Quer entender melhor antes de aplicar?'
      ],
      closing:    [
        'Quer testar isso no seu fluxo?',
        'Posso te mostrar como começar.'
      ]
    }
  },

  // ── E-commerce ────────────────────────────────────────────────────────────
  ecommerce: {
    name: 'E-commerce',
    description: 'Conversão direta para lojas virtuais e produtos físicos',
    behavior: {
      pressure: 'medium',
      style:    'direto',
      goal:     'conversion',
      urgency:  true
    },
    copy: {
      discovery:  [
        'Você sente que perde vendas depois do clique?',
        'As pessoas chegam mas não compram?'
      ],
      engagement: [
        'Isso resolve exatamente esse abandono.',
        'Você começa a recuperar essas vendas.'
      ],
      objection:  [
        'Se você já tem tráfego, faz sentido não converter?',
        'O que falta pra você testar isso?'
      ],
      closing:    [
        'Você pode começar a recuperar essas vendas agora.',
        'Quer ativar isso no seu e-commerce?'
      ]
    }
  },

  // ── Negócio Local ─────────────────────────────────────────────────────────
  local_business: {
    name: 'Negócio Local',
    description: 'Consultivo para negócios físicos, foco em agendamento',
    behavior: {
      pressure: 'medium',
      style:    'consultivo',
      goal:     'schedule',
      urgency:  false
    },
    copy: {
      discovery:  [
        'Você atende via WhatsApp ou Instagram hoje?',
        'Consegue responder todo mundo rápido?'
      ],
      engagement: [
        'Isso já automatiza boa parte do seu atendimento.',
        'Você não perde mais clientes por demora.'
      ],
      objection:  [
        'Se isso resolve seu atendimento, o que falta?',
        'Quer testar isso funcionando?'
      ],
      closing:    [
        'Quer começar a usar isso agora?',
        'Podemos ativar isso pra você hoje.'
      ]
    }
  },

  // ── Institucional / Marca ─────────────────────────────────────────────────
  institucional: {
    name: 'Institucional',
    description: 'Informativo e leve para páginas institucionais',
    behavior: {
      pressure: 'low',
      style:    'educativo',
      goal:     'assist',
      urgency:  false
    },
    copy: {
      discovery:  [
        'Posso ajudar com alguma informação específica?',
        'Tem alguma dúvida sobre a empresa que posso esclarecer?'
      ],
      engagement: [
        'Fico à disposição para esclarecer qualquer ponto.',
        'Pode perguntar à vontade.'
      ],
      objection:  [
        'Tem mais alguma informação que posso detalhar?',
        'Quer que eu explique com mais detalhes?'
      ],
      closing:    [
        'Posso te ajudar com mais alguma coisa?',
        'Estou aqui se precisar de mais informações.'
      ]
    }
  }
};

/**
 * Retorna preset completo (behavior + copy).
 * @param {string} presetKey
 * @returns {{ name, behavior, copy }}
 */
function getPreset(presetKey) {
  return PRESETS[presetKey] || PRESETS.default;
}

/**
 * Lista todos os presets para exibição no front-end.
 * @returns {Array<{key, name, description}>}
 */
function listPresets() {
  return Object.entries(PRESETS).map(([key, p]) => ({
    key,
    name:        p.name,
    description: p.description
  }));
}

module.exports = { PRESETS, getPreset, listPresets };
