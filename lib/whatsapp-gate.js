'use strict';

/**
 * 🔒 GATE CENTRAL DE CONTROLE OPERACIONAL DO WHATSAPP
 * LinkMágico — Regra Fail-Closed
 *
 * Retorna true ESTRITAMENTE quando process.env.FEATURE_WHATSAPP_OPERATIONAL === 'true'.
 * Qualquer outro valor (false, ausente, vazio, 1, yes, enabled, null, undefined) retorna false.
 *
 * @module lib/whatsapp-gate
 */

function isWhatsAppOperational() {
    return process.env.FEATURE_WHATSAPP_OPERATIONAL === 'true';
}

module.exports = {
    isWhatsAppOperational
};
