/**
 * 📧 EMAIL QUEUE WORKER - Link Mágico
 * Sistema de fila de emails com PostgreSQL
 * 
 * SAFE PATCH - Módulo isolado. Não impacta funcionalidades existentes.
 * Feature flag: FEATURE_ONBOARDING_EMAILS (default: true)
 * 
 * Funções:
 * - enqueueOnboardingEmails() — agenda 5 emails pós-cadastro
 * - processEmailQueue() — processa fila a cada 5 min via setInterval
 */

const { ONBOARDING_SEQUENCE, getOnboardingTemplate } = require('./onboarding-emails');

// Feature flag
const FEATURE_ENABLED = process.env.FEATURE_ONBOARDING_EMAILS !== 'false';

/**
 * Inicializa tabela email_queue no PostgreSQL (idempotente)
 */
async function initEmailQueue() {
    if (!FEATURE_ENABLED) return;

    try {
        const { db, USE_POSTGRES } = require('./database');
        if (!USE_POSTGRES || !db) {
            console.log('⚠️ [EmailQueue] PostgreSQL não disponível — fila de emails desabilitada');
            return;
        }

        await db.query(`
            CREATE TABLE IF NOT EXISTS email_queue (
                id SERIAL PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                api_key TEXT NOT NULL,
                email TEXT NOT NULL,
                name TEXT DEFAULT '',
                template_id TEXT NOT NULL,
                subject TEXT NOT NULL,
                send_at TIMESTAMPTZ NOT NULL,
                sent_at TIMESTAMPTZ,
                status TEXT DEFAULT 'pending',
                attempts INT DEFAULT 0,
                error TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_email_queue_pending 
            ON email_queue(status, send_at) WHERE status = 'pending'
        `).catch(() => {}); // Ignora se já existe

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_email_queue_tenant 
            ON email_queue(tenant_id)
        `).catch(() => {});

        console.log('✅ [EmailQueue] Tabela email_queue inicializada');
    } catch (err) {
        console.error('❌ [EmailQueue] Erro ao inicializar tabela:', err.message);
    }
}

/**
 * Agenda os 5 emails de onboarding para um novo usuário
 * @param {string} tenantId - ID do tenant
 * @param {string} apiKey - API Key do tenant
 * @param {string} email - Email do usuário
 * @param {string} name - Nome do usuário
 */
async function enqueueOnboardingEmails(tenantId, apiKey, email, name) {
    if (!FEATURE_ENABLED) {
        console.log('⚠️ [EmailQueue] Feature desabilitada — emails não agendados');
        return;
    }

    try {
        const { db, USE_POSTGRES } = require('./database');
        if (!USE_POSTGRES || !db) return;

        // Verificar se já existem emails agendados (idempotência)
        const existing = await db.query(
            `SELECT COUNT(*) as count FROM email_queue WHERE tenant_id = $1 AND template_id LIKE 'onboarding_%'`,
            [tenantId]
        );
        const rows = existing.rows || existing;
        if (rows[0] && parseInt(rows[0].count) > 0) {
            console.log(`⚠️ [EmailQueue] Emails já agendados para tenant ${tenantId.substring(0, 8)}... — ignorando`);
            return;
        }

        const now = new Date();

        for (const seq of ONBOARDING_SEQUENCE) {
            const sendAt = new Date(now.getTime() + seq.delayMinutes * 60 * 1000);

            await db.query(
                `INSERT INTO email_queue (tenant_id, api_key, email, name, template_id, subject, send_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [tenantId, apiKey, email, name || '', seq.id, seq.subject, sendAt.toISOString()]
            );
        }

        console.log(`📧 [EmailQueue] 5 emails de onboarding agendados para ${email} (tenant: ${tenantId.substring(0, 8)}...)`);
    } catch (err) {
        // Fail-safe: não impacta signup se falhar
        console.error('❌ [EmailQueue] Erro ao agendar emails:', err.message);
    }
}

/**
 * Processa emails pendentes na fila
 * Chamado a cada 5 min via setInterval no server.js
 */
async function processEmailQueue() {
    if (!FEATURE_ENABLED) return;

    try {
        const { db, USE_POSTGRES } = require('./database');
        if (!USE_POSTGRES || !db) return;

        // Buscar até 10 emails pendentes prontos para envio
        const result = await db.query(
            `SELECT * FROM email_queue 
             WHERE status = 'pending' AND send_at <= NOW() AND attempts < 3
             ORDER BY send_at ASC 
             LIMIT 10`
        );

        const rows = result.rows || result;
        if (!rows || rows.length === 0) return;

        console.log(`📧 [EmailQueue] Processando ${rows.length} email(s) pendente(s)...`);

        const { emailService } = require('./email-service');

        for (const row of rows) {
            try {
                // Gerar template HTML
                const template = getOnboardingTemplate(row.template_id, {
                    name: row.name,
                    apiKey: row.api_key
                });

                if (!template) {
                    await db.query(
                        `UPDATE email_queue SET status = 'failed', error = 'Template não encontrado' WHERE id = $1`,
                        [row.id]
                    );
                    continue;
                }

                // Enviar via email-service existente
                const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'linkmagicobot@gmail.com';

                if (emailService.configured) {
                    await emailService.transporter.sendMail({
                        from: `"LinkMágico" <${fromAddress}>`,
                        to: row.email,
                        subject: template.subject,
                        html: template.html
                    });
                } else {
                    // Dev mode: logar no console
                    console.log(`📧 [DEV] Email ${row.template_id} para ${row.email}: "${template.subject}"`);
                }

                // Marcar como enviado
                await db.query(
                    `UPDATE email_queue SET status = 'sent', sent_at = NOW() WHERE id = $1`,
                    [row.id]
                );

                const seqNum = row.template_id.replace('onboarding_', '');
                console.log(`✅ [EmailQueue] Email ${seqNum}/5 enviado para ${row.email}`);

            } catch (sendErr) {
                // Incrementar tentativas
                await db.query(
                    `UPDATE email_queue SET attempts = attempts + 1, error = $2 WHERE id = $1`,
                    [row.id, sendErr.message]
                ).catch(() => {});

                console.error(`❌ [EmailQueue] Falha ao enviar email ${row.template_id} para ${row.email}:`, sendErr.message);
            }
        }
    } catch (err) {
        // Silencioso para não poluir logs em erro de DB
        if (err.message && !err.message.includes('does not exist')) {
            console.error('❌ [EmailQueue] Erro no processamento:', err.message);
        }
    }
}

module.exports = {
    initEmailQueue,
    enqueueOnboardingEmails,
    processEmailQueue
};
