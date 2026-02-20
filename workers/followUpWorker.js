#!/usr/bin/env node
/**
 * 🔄 FOLLOW-UP WORKER - Link Mágico V7.0
 * Processo isolado que executa jobs de follow-up agendados
 *
 * Executar: node workers/followUpWorker.js
 * Ou via npm: npm run worker:followup
 *
 * ⚠️ Este processo roda SEPARADO do server.js
 * ⚠️ Não depende de Express, sessão ou qualquer variável global
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const cron = require('node-cron');
const { db, USE_POSTGRES } = require('../database');
const { FollowUpManager } = require('../lib/crm/followup-manager');

const followUpManager = new FollowUpManager();

// Configuração
const WORKER_INTERVAL = '*/1 * * * *'; // A cada 1 minuto
const BATCH_SIZE = 50;
let isProcessing = false;

console.log('🔄 ═══════════════════════════════════════');
console.log('🔄  FOLLOW-UP WORKER - Link Mágico V7.0');
console.log(`🔄  Database: ${USE_POSTGRES ? 'PostgreSQL' : 'SQLite'}`);
console.log(`🔄  Intervalo: ${WORKER_INTERVAL}`);
console.log(`🔄  Batch Size: ${BATCH_SIZE}`);
console.log('🔄 ═══════════════════════════════════════');

/**
 * Processar jobs pendentes
 */
async function processFollowUpJobs() {
    if (isProcessing) {
        console.log('⏳ [WORKER] Processamento anterior ainda em andamento, pulando...');
        return;
    }

    isProcessing = true;
    const startTime = Date.now();

    try {
        const jobs = await followUpManager.getPendingJobs(BATCH_SIZE);

        if (jobs.length === 0) {
            return; // Silencioso quando não há jobs
        }

        console.log(`\n📋 [WORKER] ${jobs.length} job(s) pendente(s) encontrado(s)`);

        let processed = 0;
        let cancelled = 0;
        let failed = 0;

        for (const job of jobs) {
            try {
                // Marcar como processando (idempotência)
                await followUpManager.markJobProcessing(job.id);

                // Verificar se lead respondeu após o agendamento
                if (job.last_response_at) {
                    const responseTime = new Date(job.last_response_at).getTime();
                    const scheduledTime = new Date(job.scheduled_for).getTime();

                    if (responseTime > scheduledTime) {
                        await followUpManager.cancelJob(job.id);
                        cancelled++;
                        console.log(`  🚫 Job ${job.id.substring(0, 8)}... cancelado — lead ${job.lead_email} respondeu`);
                        continue;
                    }
                }

                // Verificar max_attempts
                if (job.attempts >= (job.rule_max_attempts || 3)) {
                    await followUpManager.failJob(job.id, 'Máximo de tentativas atingido', job.rule_max_attempts || 3);
                    failed++;
                    console.log(`  ❌ Job ${job.id.substring(0, 8)}... falhou — máximo de tentativas`);
                    continue;
                }

                // Enviar mensagem pelo canal configurado
                const sent = await sendMessage(job);

                if (sent.success) {
                    await followUpManager.completeJob(job.id, job.channel);

                    // Atualizar last_contact_at do lead
                    const updateQuery = USE_POSTGRES
                        ? `UPDATE crm_leads SET last_contact_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`
                        : `UPDATE crm_leads SET last_contact_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
                    await db.query(updateQuery, [job.lead_id]);

                    processed++;
                    console.log(`  ✅ Job ${job.id.substring(0, 8)}... enviado via ${job.channel} para ${job.lead_email}`);
                } else {
                    await followUpManager.failJob(job.id, sent.error, job.rule_max_attempts || 3);
                    failed++;
                    console.log(`  ⚠️ Job ${job.id.substring(0, 8)}... falhou: ${sent.error}`);
                }

            } catch (jobError) {
                await followUpManager.failJob(job.id, jobError.message, job.rule_max_attempts || 3);
                failed++;
                console.error(`  ❌ Erro processando job ${job.id}:`, jobError.message);
            }
        }

        const elapsed = Date.now() - startTime;
        console.log(`📊 [WORKER] Ciclo completado em ${elapsed}ms: ${processed} enviados, ${cancelled} cancelados, ${failed} falhas`);

    } catch (error) {
        console.error('❌ [WORKER] Erro geral no processamento:', error.message);
    } finally {
        isProcessing = false;
    }
}

/**
 * Enviar mensagem via canal configurado
 */
async function sendMessage(job) {
    const { channel, message_template, lead_name, lead_email, lead_phone } = job;

    // Substituir variáveis no template
    const message = (message_template || '')
        .replace(/\{\{nome\}\}/gi, lead_name || 'Cliente')
        .replace(/\{\{email\}\}/gi, lead_email || '')
        .replace(/\{\{telefone\}\}/gi, lead_phone || '');

    try {
        switch (channel) {
            case 'email': {
                // Tentar usar nodemailer diretamente
                const nodemailer = require('nodemailer');

                if (!process.env.SMTP_HOST && !process.env.GMAIL_USER) {
                    return { success: false, error: 'SMTP não configurado (SMTP_HOST ou GMAIL_USER necessário)' };
                }

                let transporter;
                if (process.env.GMAIL_USER) {
                    transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: process.env.GMAIL_USER,
                            pass: process.env.GMAIL_APP_PASSWORD
                        }
                    });
                } else {
                    transporter = nodemailer.createTransport({
                        host: process.env.SMTP_HOST,
                        port: parseInt(process.env.SMTP_PORT || '587'),
                        secure: process.env.SMTP_SECURE === 'true',
                        auth: {
                            user: process.env.SMTP_USER,
                            pass: process.env.SMTP_PASS
                        }
                    });
                }

                await transporter.sendMail({
                    from: process.env.SMTP_FROM || process.env.GMAIL_USER || 'noreply@linkmagico.com',
                    to: lead_email,
                    subject: `Follow-up - ${lead_name || 'Cliente'}`,
                    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <p>${message.replace(/\n/g, '<br>')}</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="color: #999; font-size: 12px;">Enviado automaticamente pelo Link Mágico</p>
                    </div>`
                });

                return { success: true };
            }

            case 'whatsapp': {
                if (!lead_phone) {
                    return { success: false, error: 'Lead não possui telefone cadastrado' };
                }

                // Usar a WhatsApp Integration existente com suporte multi-tenant
                try {
                    const { whatsappManager } = require('../whatsapp-integration');
                    if (whatsappManager) {
                        const tenantId = job.tenant_uuid || job.tenant_id;
                        const instance = await whatsappManager.getTenantInstance(tenantId);
                        await instance.sendMessage(lead_phone, message);
                        return { success: true };
                    }
                } catch (e) {
                    // WhatsApp manager não disponível
                    console.error('❌ [WORKER] Erro no WhatsApp:', e.message);
                }

                return { success: false, error: 'WhatsApp integration não configurada' };
            }

            default:
                return { success: false, error: `Canal "${channel}" não suportado` };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ===== INICIAR WORKER =====
console.log(`\n🚀 [WORKER] Iniciando agendamento cron: ${WORKER_INTERVAL}`);

// Executar imediatamente na primeira vez
processFollowUpJobs().then(() => {
    console.log('✅ [WORKER] Primeira verificação concluída');
});

// Agendar execução periódica
cron.schedule(WORKER_INTERVAL, () => {
    processFollowUpJobs();
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 [WORKER] Encerrando...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 [WORKER] Encerrando (SIGTERM)...');
    process.exit(0);
});

console.log('✅ [WORKER] Follow-Up Worker ativo e aguardando jobs...\n');
