/**
 * 📧 SERVIÇO DE EMAIL - Link Mágico
 * Módulo isolado para envio de emails (provisionamento automático)
 * 
 * Configuração via variáveis de ambiente:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 * 
 * Se SMTP não estiver configurado, faz fallback para console (dev mode).
 */

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  // nodemailer não instalado — fallback ativado
  nodemailer = null;
}

class EmailService {
  constructor() {
    this.transporter = null;
    this.configured = false;
    this._initialize();
  }

  _initialize() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!nodemailer || !host || !user || !pass) {
      console.log('⚠️ [EmailService] SMTP não configurado — emails serão logados no console (dev mode)');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
      });
      this.configured = true;
      console.log(`✅ [EmailService] SMTP configurado: ${host}:${port}`);
    } catch (error) {
      console.error('❌ [EmailService] Falha ao configurar SMTP:', error.message);
    }
  }

  /**
   * Envia email com a API key para o cliente
   * @param {string} email - Email do comprador
   * @param {string} nome - Nome do comprador
   * @param {string} apiKey - API key gerada
   * @param {string} plataformaUrl - URL da plataforma (ex: https://vertical-ai-dktu.onrender.com)
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async sendApiKeyEmail(email, nome, apiKey, plataformaUrl) {
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'linkmagicobot@gmail.com';
    const subject = '🔑 Sua chave de acesso — Link Mágico';

    const htmlBody = this._buildEmailHtml(nome, apiKey, plataformaUrl);
    const textBody = this._buildEmailText(nome, apiKey, plataformaUrl);

    if (!this.configured) {
      console.log('═══════════════════════════════════════════════════');
      console.log('📧 [EmailService] DEV MODE — Email que seria enviado:');
      console.log(`   Para: ${email}`);
      console.log(`   Nome: ${nome}`);
      console.log(`   API Key: ${apiKey}`);
      console.log(`   URL: ${plataformaUrl}`);
      console.log('═══════════════════════════════════════════════════');
      return { success: true, message: 'Email logado no console (SMTP não configurado)' };
    }

    try {
      await this.transporter.sendMail({
        from: `"Link Mágico" <${fromAddress}>`,
        to: email,
        subject,
        text: textBody,
        html: htmlBody
      });

      console.log(`✅ [EmailService] Email enviado com sucesso para: ${email}`);
      return { success: true, message: `Email enviado para ${email}` };
    } catch (error) {
      console.error(`❌ [EmailService] Falha ao enviar email para ${email}:`, error.message);
      // Logar a API key no console como fallback de segurança
      console.log(`🔑 [EmailService] FALLBACK — API Key para ${email}: ${apiKey}`);
      return { success: false, message: `Falha ao enviar email: ${error.message}` };
    }
  }

  _buildEmailHtml(nome, apiKey, plataformaUrl) {
    const primeiroNome = (nome || 'Cliente').split(' ')[0];
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:30px 40px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:28px;">🔗 Link Mágico</h1>
            <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Plataforma de IA Conversacional</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="color:#1e293b;margin:0 0 16px;font-size:22px;">Olá, ${primeiroNome}! 🎉</h2>
            <p style="color:#475569;font-size:16px;line-height:1.6;margin:0 0 24px;">
              Obrigado por adquirir o <strong>Link Mágico</strong>! Sua chave de acesso está pronta:
            </p>
            <!-- API Key Box -->
            <div style="background:#f8fafc;border:2px dashed #6366f1;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px;">
              <p style="color:#64748b;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Sua API Key</p>
              <p style="color:#6366f1;font-size:24px;font-weight:bold;margin:0;letter-spacing:2px;font-family:monospace;">${apiKey}</p>
            </div>
            <!-- Instructions -->
            <h3 style="color:#1e293b;font-size:16px;margin:0 0 12px;">📋 Como acessar:</h3>
            <ol style="color:#475569;font-size:15px;line-height:1.8;margin:0 0 24px;padding-left:20px;">
              <li>Acesse <a href="${plataformaUrl}" style="color:#6366f1;text-decoration:none;font-weight:600;">${plataformaUrl}</a></li>
              <li>Cole sua API Key no campo de autenticação</li>
              <li>Clique em <strong>"Validar"</strong> e comece a usar!</li>
            </ol>
            <!-- Training Link -->
            <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
              <h3 style="color:#065f46;font-size:16px;margin:0 0 8px;">🎓 Treinamento Exclusivo</h3>
              <p style="color:#047857;font-size:14px;line-height:1.6;margin:0;">
                Acesse o treinamento completo para aproveitar ao máximo a plataforma:
              </p>
              <div style="text-align:center;margin:12px 0 0;">
                <a href="https://site.linkmagico.app.br/BEMVINDO" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:14px;font-weight:600;">Acessar Treinamento →</a>
              </div>
            </div>
            <!-- CTA Button -->
            <div style="text-align:center;margin:0 0 24px;">
              <a href="${plataformaUrl}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">Acessar a Plataforma →</a>
            </div>
            <!-- Warning -->
            <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 16px;">
              <p style="color:#92400e;font-size:13px;margin:0;">
                ⚠️ <strong>Importante:</strong> Guarde esta chave com segurança. Ela é pessoal e intransferível.
              </p>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:12px;margin:0;text-align:center;">
              Este é um email automático do Link Mágico. Em caso de dúvidas, responda este email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  _buildEmailText(nome, apiKey, plataformaUrl) {
    const primeiroNome = (nome || 'Cliente').split(' ')[0];
    return `Olá, ${primeiroNome}!

Obrigado por adquirir o Link Mágico! Sua chave de acesso está pronta:

🔑 Sua API Key: ${apiKey}

📋 Como acessar:
1. Acesse ${plataformaUrl}
2. Cole sua API Key no campo de autenticação
3. Clique em "Validar" e comece a usar!

🎓 Treinamento Exclusivo:
Acesse o treinamento completo: https://site.linkmagico.app.br/BEMVINDO

⚠️ Importante: Guarde esta chave com segurança. Ela é pessoal e intransferível.

---
Este é um email automático do Link Mágico.`;
  }
}

// Instância singleton
const emailService = new EmailService();

module.exports = { emailService, EmailService };
