/**
 * Módulo: Principal de Módulos
 * Re-exporta todos os módulos do diretório modules/
 * 
 * @module modules
 */

const ai = require('./ai');
const leads = require('./leads');
const utils = require('./utils');

module.exports = {
    // AI Modules
    SuperInteligenciaConversacional: ai.SuperInteligenciaConversacional,

    // Leads Modules
    JourneyAnalyzer: leads.JourneyAnalyzer,

    // Utils Modules
    SistemaCapturaInteligencias: utils.SistemaCapturaInteligencias,

    // Namespaced exports
    ai,
    leads,
    utils
};
