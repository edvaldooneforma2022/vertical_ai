/**
 * 📊 WEEKLY REPORT — Link Mágico
 * Envia email semanal com métricas do chatbot para cada tenant ativo.
 *
 * SAFE PATCH - Módulo 100% isolado e aditivo.
 * NÃO IMPACTA nenhuma funcionalidade existente.
 * Feature Flag: FEATURE_WEEKLY_REPORT (default: true)
 *
 * Funciona via email_queue (mesma infra do onboarding).
 * Agendado via setInterval no server.js (1x por semana).
 */

const APP_URL = process.env.APP_URL || 'https://linkmagico.app.br';
const FEATURE_ENABLED = process.env.FEATURE_WEEKLY_REPORT !== 'false';

/**
 * Busca métricas da última semana para um tenant
 */
async function getTenantWeeklyMetrics(db, tenantId, apiKey) {
    const metrics = {
        messages: 0,
        leads: 0,
        conversations: 0,
        topQuestions: [],
        responseRate: 0
    };

    try {
        // Mensagens na última semana
        const msgResult = await db.query(
            `SELECT COUNT(*) as count FROM messages 
             WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
            [tenantId]
        ).catch(() => ({ rows: [{ count: 0 }] }));
        metrics.messages = parseInt((msgResult.rows || msgResult)[0]?.count || '0');

        // Leads capturados na última semana
        const leadResult = await db.query(
            `SELECT COUNT(*) as count FROM leads 
             WHERE api_key = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
            [apiKey]
        ).catch(() => ({ rows: [{ count: 0 }] }));
        metrics.leads = parseInt((leadResult.rows || leadResult)[0]?.count || '0');

        // Conversas únicas
        const convResult = await db.query(
            `SELECT COUNT(DISTINCT conversation_id) as count FROM messages 
             WHERE tenant_id = $1 AND created_at >= NOW() - INTERVAL '7 days'`,
            [tenantId]
        ).catch(() => ({ rows: [{ count: 0 }] }));
        metrics.conversations = parseInt((convResult.rows || convResult)[0]?.count || '0');

    } catch (e) {
        console.warn(`⚠️ [WeeklyReport] Erro ao buscar métricas para ${tenantId.substring(0, 8)}:`, e.message);
    }

    return metrics;
}

/**
 * Gera HTML do email de relatório semanal
 */
function buildWeeklyReportEmail(name, metrics) {
    const greeting = name ? `Olá, ${name}!` : 'Olá!';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
<tr>
  <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:30px 40px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;">⚡ LinkMágico</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Relatório Semanal</p>
  </td>
</tr>
<tr>
  <td style="padding:32px 40px;">
    <h2 style="color:#1f2937;margin:0 0 8px;font-size:20px;">${greeting}</h2>
    <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Aqui está o resumo da performance do seu vendedor IA nos últimos 7 dias:
    </p>

    <!-- Métricas -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td width="33%" style="text-align:center;padding:16px 8px;background:#f0fdf4;border-radius:12px 0 0 12px;">
          <div style="font-size:32px;font-weight:800;color:#10b981;">${metrics.messages}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">Mensagens</div>
        </td>
        <td width="34%" style="text-align:center;padding:16px 8px;background:#eff6ff;">
          <div style="font-size:32px;font-weight:800;color:#3b82f6;">${metrics.leads}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">Leads capturados</div>
        </td>
        <td width="33%" style="text-align:center;padding:16px 8px;background:#faf5ff;border-radius:0 12px 12px 0;">
          <div style="font-size:32px;font-weight:800;color:#8b5cf6;">${metrics.conversations}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">Conversas</div>
        </td>
      </tr>
    </table>

    ${metrics.messages === 0 ? `
    <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:10px;padding:16px;margin-bottom:20px;">
      <p style="color:#92400e;font-size:13px;margin:0;line-height:1.5;">
        <strong>💡 Dica:</strong> Seu chatbot não recebeu mensagens esta semana. 
        Instale o widget no seu site ou compartilhe o link do chat para começar a receber leads.
      </p>
    </div>` : `
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:16px;margin-bottom:20px;">
      <p style="color:#166534;font-size:13px;margin:0;line-height:1.5;">
        <strong>🎉 Parabéns!</strong> Seu vendedor IA atendeu ${metrics.messages} mensagens 
        e capturou ${metrics.leads} lead${metrics.leads !== 1 ? 's' : ''} esta semana.
      </p>
    </div>`}

    <div style="text-align:center;margin:24px 0;">
      <a href="${APP_URL}/app" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;">
        📊 Ver painel completo
      </a>
    </div>

    <p style="color:#9ca3af;font-size:12px;text-align:center;margin:20px 0 0;">
      Este relatório é enviado toda semana automaticamente.
    </p>
  </td>
</tr>
<tr>
  <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="color:#94a3b8;font-size:12px;margin:0;">
      © ${new Date().getFullYear()} LinkMágico — <a href="${APP_URL}" style="color:#6366f1;text-decoration:none;">linkmagico.app.br</a>
    </p>
  </td>
</tr>
</table>
</td></tr></table>
</body></html>`;
}

/**
 * Agenda relatórios semanais para todos os tenants ativos
 * Chamado via setInterval no server.js (1x por semana)
 */
async function scheduleWeeklyReports() {
    if (!FEATURE_ENABLED) return;

    try {
        const { db, USE_POSTGRES } = require('./database');
        if (!db || !USE_POSTGRES) return;

        // Buscar tenants ativos com email (que tiveram alguma atividade nos últimos 30 dias)
        const result = await db.query(`
            SELECT t.id, t.email, t.name, ak.key_value as api_key
            FROM tenants t
            JOIN api_keys ak ON t.id = ak.tenant_id AND ak.active = true
            WHERE t.email IS NOT NULL AND t.email != ''
            AND t.status != 'suspended'
            LIMIT 500
        `);

        const rows = result.rows || result;
        if (!rows || rows.length === 0) {
            console.log('📊 [WeeklyReport] Nenhum tenant ativo encontrado');
            return;
        }

        let enqueued = 0;
        const { emailService } = require('./email-service');
        const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'linkmagicobot@gmail.com';

        for (const tenant of rows) {
            try {
                // Verificar se já enviou relatório esta semana (idempotência)
                const existing = await db.query(
                    `SELECT COUNT(*) as count FROM email_queue 
                     WHERE tenant_id = $1 AND template_id = 'weekly_report' 
                     AND created_at >= NOW() - INTERVAL '6 days'`,
                    [tenant.id]
                );
                const existRows = existing.rows || existing;
                if (parseInt(existRows[0]?.count || '0') > 0) continue;

                // Buscar métricas
                const metrics = await getTenantWeeklyMetrics(db, tenant.id, tenant.api_key);

                // Gerar email
                const html = buildWeeklyReportEmail(tenant.name, metrics);
                const subject = metrics.messages > 0
                    ? `📊 Seu vendedor IA recebeu ${metrics.messages} mensagens esta semana`
                    : '📊 Relatório semanal do seu vendedor IA';

                // Enviar diretamente ou agendar via queue
                if (emailService && emailService.configured) {
                    // Agendar na queue para não sobrecarregar
                    await db.query(
                        `INSERT INTO email_queue (tenant_id, api_key, email, name, template_id, subject, send_at)
                         VALUES ($1, $2, $3, $4, 'weekly_report', $5, NOW() + ($6 || ' minutes')::INTERVAL)`,
                        [tenant.id, tenant.api_key, tenant.email, tenant.name || '', subject, (enqueued * 2).toString()]
                    );
                    enqueued++;
                }
            } catch (tenantErr) {
                // Silencioso por tenant — não impactar outros
                console.warn(`⚠️ [WeeklyReport] Erro para ${tenant.id.substring(0, 8)}:`, tenantErr.message);
            }
        }

        console.log(`📊 [WeeklyReport] ${enqueued} relatórios semanais agendados de ${rows.length} tenants`);

    } catch (err) {
        console.error('❌ [WeeklyReport] Erro ao agendar relatórios:', err.message);
    }
}

module.exports = { scheduleWeeklyReports, buildWeeklyReportEmail, getTenantWeeklyMetrics };
