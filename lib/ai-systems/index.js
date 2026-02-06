/**
 * 🧠 MÓDULO DE SISTEMAS DE IA - Link Mágico V8.0
 * 
 * Ponto de entrada para os sistemas de IA.
 * Re-exporta todas as classes e funções dos módulos.
 */

const {
    SuperInteligenciaConversacional,
    superInteligenciaGlobal
} = require('./super-inteligencia');

const {
    JourneyAnalyzer,
    journeyAnalyzer,
    SistemaCapturaInteligencias,
    sistemaInteligencias
} = require('./journey-analyzer');

const {
    SuperInteligenciaEmocional,
    superInteligencia
} = require('./emocional');

module.exports = {
    // Classes
    SuperInteligenciaConversacional,
    JourneyAnalyzer,
    SistemaCapturaInteligencias,
    SuperInteligenciaEmocional,

    // Instâncias pré-inicializadas
    superInteligenciaGlobal,
    journeyAnalyzer,
    sistemaInteligencias,
    superInteligencia
};
