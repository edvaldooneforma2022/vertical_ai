/**
 * 📦 MÓDULO DE EXTRAÇÃO - Link Mágico V8.0
 * 
 * Ponto de entrada para os sistemas de extração de dados.
 * Re-exporta todas as classes e funções dos módulos.
 */

const {
    SistemaExtracaoContatosAprimorado,
    sistemaContatosAprimorado
} = require('./contatos');

const {
    SistemaExtracaoApurado,
    sistemaExtracaoApurado
} = require('./bonus');

module.exports = {
    // Classes
    SistemaExtracaoContatosAprimorado,
    SistemaExtracaoApurado,

    // Instâncias pré-inicializadas
    sistemaContatosAprimorado,
    sistemaExtracaoApurado
};
