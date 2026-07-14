/**
 * 💼 MÓDULO DE LEADS - Link Mágico V8.0
 * 
 * Ponto de entrada para o sistema de leads.
 * Re-exporta todas as classes e funções dos módulos.
 */

const {
    LeadCaptureSystem,
    getLeadSystem,
    getTenantLeadsFilePath,
    getTenantAppointmentsFilePath
} = require('./lead-capture');

const {
    LeadBackupSystem,
    getBackupSystem,
    getTenantBackupDirPath
} = require('./lead-backup');

module.exports = {
    // Classes
    LeadCaptureSystem,
    LeadBackupSystem,

    // Factory functions
    getLeadSystem,
    getBackupSystem,

    // Path helpers
    getTenantLeadsFilePath,
    getTenantAppointmentsFilePath,
    getTenantBackupDirPath
};
