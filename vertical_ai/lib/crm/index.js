/**
 * 🏢 CRM V7.0 - Link Mágico
 * Módulo principal — exporta managers e setup de rotas
 */

const { CRMManager } = require('./crm-manager');
const { DealsManager } = require('./deals-manager');
const { FollowUpManager } = require('./followup-manager');

// Instâncias singleton
const crmManager = new CRMManager();
const dealsManager = new DealsManager();
const followUpManager = new FollowUpManager();

module.exports = {
    crmManager,
    dealsManager,
    followUpManager,
    CRMManager,
    DealsManager,
    FollowUpManager
};
