/**
 * 📊 WA-PARITY-AUDIT — Link Mágico V21
 * 
 * Módulo de auditoria de paridade WhatsApp ↔ Link Curto.
 * 
 * REGRAS:
 * - Pura observação — ZERO lógica de vendas
 * - ZERO efeitos colaterais — apenas console.log
 * - ZERO alteração de resposta, intenção, CTA ou fluxo
 * - Serve para comparar se WhatsApp está produzindo
 *   os mesmos sinais que o Link Curto
 */

'use strict';

/**
 * Registrar auditoria de paridade para uma interação WhatsApp.
 * 
 * @param {Object} params
 * @param {string} params.message           - Mensagem do usuário
 * @param {string} params.channel           - Canal (sempre 'whatsapp')
 * @param {string} params.conversationId    - ID da conversa
 * @param {string} params.leadId            - ID do lead (se existir)
 * @param {string} params.journeyStage      - Estágio da jornada (descoberta/interesse/consideração/avaliação/compra)
 * @param {Object} params.intentDetected    - Intenções detectadas pelo pipeline
 * @param {number} params.leadScore         - Score do lead
 * @param {boolean} params.ctaTriggered     - Se CTA foi disparado
 * @param {boolean} params.captureTriggered - Se captura de lead foi disparada
 * @param {boolean} params.scheduleTriggered - Se agendamento foi disparado
 * @param {boolean} params.generateAIResponseExecuted - Se generateAIResponse rodou
 * @param {string} params.responseSource    - Fonte da resposta (endpoint usado)
 * @param {string} params.responsePreview   - Preview da resposta (120 chars)
 * @param {boolean} params.wouldMatchLinkCurto - Se comportamento corresponde ao Link Curto
 */
function log(params) {
    try {
        const {
            message = '',
            channel = 'whatsapp',
            conversationId = '',
            leadId = '',
            journeyStage = 'N/A',
            intentDetected = {},
            leadScore = 0,
            ctaTriggered = false,
            captureTriggered = false,
            scheduleTriggered = false,
            generateAIResponseExecuted = true,
            responseSource = 'unknown',
            responsePreview = '',
            wouldMatchLinkCurto = false
        } = params || {};

        const timestamp = new Date().toISOString();
        const msgPreview = (message || '').substring(0, 60).replace(/\n/g, ' ');
        const respPreview = (responsePreview || '').substring(0, 120).replace(/\n/g, ' ');

        console.log(`\n[WA-PARITY-AUDIT] ═══════════════════════════════════════`);
        console.log(`[WA-PARITY-AUDIT] timestamp=${timestamp}`);
        console.log(`[WA-PARITY-AUDIT] channel=${channel}`);
        console.log(`[WA-PARITY-AUDIT] message="${msgPreview}"`);
        console.log(`[WA-PARITY-AUDIT] conversationId=${conversationId || 'N/A'}`);
        console.log(`[WA-PARITY-AUDIT] leadId=${leadId || 'N/A'}`);
        console.log(`[WA-PARITY-AUDIT] journeyStage=${journeyStage}`);
        console.log(`[WA-PARITY-AUDIT] intentDetected=${JSON.stringify(intentDetected)}`);
        console.log(`[WA-PARITY-AUDIT] leadScore=${leadScore}`);
        console.log(`[WA-PARITY-AUDIT] ctaTriggered=${ctaTriggered}`);
        console.log(`[WA-PARITY-AUDIT] captureTriggered=${captureTriggered}`);
        console.log(`[WA-PARITY-AUDIT] scheduleTriggered=${scheduleTriggered}`);
        console.log(`[WA-PARITY-AUDIT] generateAIResponseExecuted=${generateAIResponseExecuted}`);
        console.log(`[WA-PARITY-AUDIT] responseSource=${responseSource}`);
        console.log(`[WA-PARITY-AUDIT] responsePreview="${respPreview}"`);
        console.log(`[WA-PARITY-AUDIT] wouldMatchLinkCurto=${wouldMatchLinkCurto}`);
        console.log(`[WA-PARITY-AUDIT] ═══════════════════════════════════════\n`);
    } catch (auditErr) {
        // Auditoria NUNCA deve impactar o fluxo
        console.warn('[WA-PARITY-AUDIT] Erro no log (sem impacto):', auditErr.message);
    }
}

module.exports = { log };
