/**
 * ⚙️ PRESETS MULTI-NICHO — Link Mágico V8.0
 *
 * Define o COMPORTAMENTO de venda por nicho.
 * NÃO altera: instructions, knowledge_base, scraping, prompt base ou contexto da URL.
 * APENAS configura: pressão, estilo, objetivo e urgência da camada de venda.
 *
 * @version 1.0.0
 */

'use strict';

const PRESETS = {

  // ── Preset padrão (fallback seguro) ───────────────────────────────────────
  default: {
    name: 'Padrão Inteligente',
    description: 'Comportamento equilibrado, consultivo e adaptativo',
    behavior: {
      pressure: 'medium',
      style: 'consultivo',
      goal: 'assist',
      urgency: false
    }
  },

  // ── Produto Digital (infoproduto, curso, ebook) ────────────────────────────
  produto_digital: {
    name: 'Produto Digital',
    description: 'Alta conversão para infoprodutos, cursos e ebooks',
    behavior: {
      pressure: 'high',
      style: 'direto',
      goal: 'conversion',
      urgency: true
    }
  },

  // ── Afiliado ───────────────────────────────────────────────────────────────
  afiliado: {
    name: 'Afiliado',
    description: 'Persuasão máxima para links de afiliado',
    behavior: {
      pressure: 'high',
      style: 'persuasivo',
      goal: 'conversion',
      urgency: true
    }
  },

  // ── Serviço (agência, consultoria, freelancer) ─────────────────────────────
  servico: {
    name: 'Serviço',
    description: 'Foco em agendamento e qualificação de leads de serviço',
    behavior: {
      pressure: 'medium',
      style: 'consultivo',
      goal: 'schedule',
      urgency: false
    }
  },

  // ── Captura de Leads ───────────────────────────────────────────────────────
  lead: {
    name: 'Captura de Leads',
    description: 'Educativo e leve, foco em capturar dados de contato',
    behavior: {
      pressure: 'low',
      style: 'educativo',
      goal: 'lead',
      urgency: false
    }
  },

  // ── E-commerce ────────────────────────────────────────────────────────────
  ecommerce: {
    name: 'E-commerce',
    description: 'Conversão direta para lojas virtuais e produtos físicos',
    behavior: {
      pressure: 'medium',
      style: 'direto',
      goal: 'conversion',
      urgency: true
    }
  },

  // ── Negócio Local ─────────────────────────────────────────────────────────
  local_business: {
    name: 'Negócio Local',
    description: 'Consultivo para negócios físicos, foco em agendamento',
    behavior: {
      pressure: 'medium',
      style: 'consultivo',
      goal: 'schedule',
      urgency: false
    }
  },

  // ── Institucional / Marca ─────────────────────────────────────────────────
  institucional: {
    name: 'Institucional',
    description: 'Informativo e leve para páginas institucionais',
    behavior: {
      pressure: 'low',
      style: 'educativo',
      goal: 'assist',
      urgency: false
    }
  }
};

/**
 * Retorna a configuração de comportamento de um preset.
 * @param {string} presetKey
 * @returns {{ pressure: string, style: string, goal: string, urgency: boolean }}
 */
function getPreset(presetKey) {
  return PRESETS[presetKey] || PRESETS.default;
}

/**
 * Lista de todos os presets disponíveis (para o front-end).
 * @returns {Array<{key: string, name: string, description: string}>}
 */
function listPresets() {
  return Object.entries(PRESETS).map(([key, p]) => ({
    key,
    name: p.name,
    description: p.description
  }));
}

module.exports = { PRESETS, getPreset, listPresets };
