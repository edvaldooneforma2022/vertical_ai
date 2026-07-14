/**
 * 📧 TEMPLATES DE ONBOARDING - Link Mágico
 * 5 emails sequenciais para novos usuários Free
 * 
 * SAFE PATCH - Módulo isolado, não impacta funcionalidades existentes.
 * Feature flag: FEATURE_ONBOARDING_EMAILS (default: true)
 */

const APP_URL = process.env.APP_URL || 'https://linkmagico.app.br';

/**
 * Definição dos 5 emails de onboarding
 */
const ONBOARDING_SEQUENCE = [
    {
        id: 'onboarding_1',
        delayMinutes: 0, // imediato
        subject: '🚀 Sua conta está pronta — crie seu vendedor em 2 min',
    },
    {
        id: 'onboarding_2',
        delayMinutes: 24 * 60, // 24h
        subject: '🤖 Seu assistente já está respondendo? Veja como configurar',
    },
    {
        id: 'onboarding_3',
        delayMinutes: 48 * 60, // 48h
        subject: '💡 3 formas de usar seu vendedor: widget, link, Instagram',
    },
    {
        id: 'onboarding_4',
        delayMinutes: 5 * 24 * 60, // 5 dias
        subject: '📊 Seus primeiros leads — o que fazer agora',
    },
    {
        id: 'onboarding_5',
        delayMinutes: 7 * 24 * 60, // 7 dias
        subject: '⚡ Desbloqueie mais: upgrade a partir de R$29/mês',
    }
];

/**
 * Header padrão do email
 */
function emailHeader() {
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
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Seu Vendedor IA 24/7</p>
  </td>
</tr>`;
}

/**
 * Footer padrão do email
 */
function emailFooter() {
    return `<tr>
  <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="color:#94a3b8;font-size:12px;margin:0;">
      © ${new Date().getFullYear()} LinkMágico — <a href="${APP_URL}" style="color:#6366f1;text-decoration:none;">linkmagico.app.br</a>
    </p>
    <p style="color:#cbd5e1;font-size:11px;margin:8px 0 0;">
      Você recebeu este email por criar uma conta no LinkMágico.
    </p>
  </td>
</tr>
</table>
</td></tr></table>
</body></html>`;
}

/**
 * Botão CTA
 */
function ctaButton(text, url, color = '#6366f1') {
    return `<a href="${url}" style="display:inline-block;background:${color};color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;margin:8px 0;">${text}</a>`;
}

/**
 * Gera HTML para cada template
 */
function getOnboardingTemplate(templateId, data) {
    const { name, apiKey } = data;
    const firstName = (name || 'Empreendedor').split(' ')[0];
    const panelUrl = `${APP_URL}/app`;
    const signupUrl = `${APP_URL}/signup.html`;

    const templates = {
        // EMAIL 1 — Imediato: Conta criada
        onboarding_1: () => `${emailHeader()}
<tr><td style="padding:30px 40px;">
  <h2 style="color:#1f2937;margin:0 0 16px;">Olá, ${firstName}! 👋</h2>
  <p style="color:#4b5563;font-size:15px;line-height:1.7;">
    Sua conta <strong>LinkMágico</strong> está pronta! Em menos de 2 minutos, você pode criar
    seu primeiro <strong>vendedor IA</strong> que funciona 24/7.
  </p>
  <h3 style="color:#6366f1;margin:24px 0 12px;">Como começar:</h3>
  <table cellpadding="0" cellspacing="0" width="100%">
    <tr><td style="padding:8px 0;"><span style="background:#6366f1;color:#fff;border-radius:50%;padding:4px 10px;font-size:13px;font-weight:600;">1</span> <span style="color:#374151;font-size:14px;margin-left:8px;">Acesse o painel com sua API Key</span></td></tr>
    <tr><td style="padding:8px 0;"><span style="background:#6366f1;color:#fff;border-radius:50%;padding:4px 10px;font-size:13px;font-weight:600;">2</span> <span style="color:#374151;font-size:14px;margin-left:8px;">Cole o link da sua página de vendas</span></td></tr>
    <tr><td style="padding:8px 0;"><span style="background:#6366f1;color:#fff;border-radius:50%;padding:4px 10px;font-size:13px;font-weight:600;">3</span> <span style="color:#374151;font-size:14px;margin-left:8px;">Clique em "Ativar Assistente IA"</span></td></tr>
  </table>
  <div style="text-align:center;margin:24px 0;">
    ${ctaButton('🚀 Criar meu vendedor agora', panelUrl)}
  </div>
  <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:16px 0;">
    <p style="color:#166534;font-size:13px;margin:0;">🔑 <strong>Sua API Key:</strong> ${apiKey}</p>
    <p style="color:#166534;font-size:12px;margin:4px 0 0;">Guarde-a em local seguro. Você também pode encontrá-la no painel.</p>
  </div>
</td></tr>
${emailFooter()}`,

        // EMAIL 2 — 24h: Configurar FAQs
        onboarding_2: () => `${emailHeader()}
<tr><td style="padding:30px 40px;">
  <h2 style="color:#1f2937;margin:0 0 16px;">${firstName}, seu assistente já está respondendo? 🤖</h2>
  <p style="color:#4b5563;font-size:15px;line-height:1.7;">
    Se você já ativou seu vendedor IA, ele já pode estar respondendo seus clientes automaticamente!
    Aqui vão <strong>3 dicas</strong> para melhorar as respostas:
  </p>
  <div style="background:#f8fafc;border-radius:8px;padding:20px;margin:16px 0;">
    <p style="color:#1f2937;font-size:14px;margin:0 0 12px;"><strong>💡 Dica 1:</strong> Use instruções claras</p>
    <p style="color:#6b7280;font-size:13px;margin:0 0 16px;">Ex: "Sempre responda de forma amigável e direcione para o link de compra"</p>
    <p style="color:#1f2937;font-size:14px;margin:0 0 12px;"><strong>💡 Dica 2:</strong> Respostas curtas vendem mais</p>
    <p style="color:#6b7280;font-size:13px;margin:0 0 16px;">Configure para 2-3 frases por resposta. Objetivo e sem enrolação.</p>
    <p style="color:#1f2937;font-size:14px;margin:0 0 12px;"><strong>💡 Dica 3:</strong> Teste como seu cliente</p>
    <p style="color:#6b7280;font-size:13px;margin:0;">Pergunte "Quanto custa?", "Tem garantia?", "Como comprar?" e ajuste as respostas.</p>
  </div>
  <div style="text-align:center;margin:24px 0;">
    ${ctaButton('⚙️ Configurar meu assistente', panelUrl)}
  </div>
</td></tr>
${emailFooter()}`,

        // EMAIL 3 — 48h: 3 formas de usar
        onboarding_3: () => `${emailHeader()}
<tr><td style="padding:30px 40px;">
  <h2 style="color:#1f2937;margin:0 0 16px;">3 formas de usar seu vendedor IA 💡</h2>
  <p style="color:#4b5563;font-size:15px;line-height:1.7;">
    ${firstName}, seu assistente é versátil! Veja como colocá-lo para trabalhar em diferentes canais:
  </p>
  <table cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;">
    <tr>
      <td style="background:#eff6ff;border-radius:8px;padding:16px;margin-bottom:12px;">
        <p style="color:#1e40af;font-size:15px;font-weight:600;margin:0;">🔗 1. Link direto</p>
        <p style="color:#3b82f6;font-size:13px;margin:6px 0 0;">Compartilhe o link curto do seu assistente nas redes sociais, bio do Instagram, etc.</p>
      </td>
    </tr>
    <tr><td style="height:12px;"></td></tr>
    <tr>
      <td style="background:#f0fdf4;border-radius:8px;padding:16px;">
        <p style="color:#166534;font-size:15px;font-weight:600;margin:0;">💬 2. Widget no site</p>
        <p style="color:#15803d;font-size:13px;margin:6px 0 0;">Cole o código do widget no seu site. Um balão flutuante atende visitantes automaticamente.</p>
      </td>
    </tr>
    <tr><td style="height:12px;"></td></tr>
    <tr>
      <td style="background:#fef3c7;border-radius:8px;padding:16px;">
        <p style="color:#92400e;font-size:15px;font-weight:600;margin:0;">📱 3. Instagram / WhatsApp</p>
        <p style="color:#b45309;font-size:13px;margin:6px 0 0;">Use o link na bio do Instagram ou configure integração WhatsApp (plano Pro).</p>
      </td>
    </tr>
  </table>
  <div style="text-align:center;margin:24px 0;">
    ${ctaButton('📋 Copiar código do widget', panelUrl)}
  </div>
</td></tr>
${emailFooter()}`,

        // EMAIL 4 — 5 dias: Primeiros leads
        onboarding_4: () => `${emailHeader()}
<tr><td style="padding:30px 40px;">
  <h2 style="color:#1f2937;margin:0 0 16px;">📊 Seus primeiros leads, ${firstName}!</h2>
  <p style="color:#4b5563;font-size:15px;line-height:1.7;">
    Se seu assistente já está ativo, é provável que ele já capturou seus primeiros leads!
    Veja o que fazer com eles:
  </p>
  <div style="background:#f8fafc;border-radius:8px;padding:20px;margin:16px 0;">
    <p style="color:#1f2937;font-size:14px;margin:0 0 12px;"><strong>1. Verifique o painel</strong></p>
    <p style="color:#6b7280;font-size:13px;margin:0 0 16px;">Acesse o painel e veja as conversas recentes. Cada conversa é um lead potencial.</p>
    <p style="color:#1f2937;font-size:14px;margin:0 0 12px;"><strong>2. Ative o follow-up</strong></p>
    <p style="color:#6b7280;font-size:13px;margin:0 0 16px;">No modo Automático, a IA faz follow-up sozinha. No Manual, você decide quando intervir.</p>
    <p style="color:#1f2937;font-size:14px;margin:0 0 12px;"><strong>3. Acompanhe as métricas</strong></p>
    <p style="color:#6b7280;font-size:13px;margin:0;">Quantidade de mensagens, leads capturados e links clicados — tudo no painel.</p>
  </div>
  <div style="text-align:center;margin:24px 0;">
    ${ctaButton('📈 Ver meus leads', panelUrl)}
  </div>
</td></tr>
${emailFooter()}`,

        // EMAIL 5 — 7 dias: Upgrade
        onboarding_5: () => `${emailHeader()}
<tr><td style="padding:30px 40px;">
  <h2 style="color:#1f2937;margin:0 0 16px;">⚡ Desbloqueie todo o potencial, ${firstName}!</h2>
  <p style="color:#4b5563;font-size:15px;line-height:1.7;">
    Você já está usando o LinkMágico há uma semana. Se está vendo resultados,
    imagine o que pode fazer com <strong>mais poder</strong>:
  </p>
  <table cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;">
    <tr>
      <td style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:12px;padding:20px;text-align:center;width:48%;">
        <p style="color:#6366f1;font-size:22px;font-weight:700;margin:0;">Starter</p>
        <p style="color:#1f2937;font-size:28px;font-weight:700;margin:8px 0;">R$29<span style="font-size:14px;color:#6b7280;">/mês</span></p>
        <p style="color:#6b7280;font-size:12px;margin:0;">1.000 msgs • 3 chatbots • 50 extrações</p>
      </td>
      <td style="width:4%;"></td>
      <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;padding:20px;text-align:center;width:48%;">
        <p style="color:#fbbf24;font-size:11px;font-weight:600;margin:0;letter-spacing:1px;">⭐ MAIS POPULAR</p>
        <p style="color:#ffffff;font-size:22px;font-weight:700;margin:4px 0 0;">Pro</p>
        <p style="color:#ffffff;font-size:28px;font-weight:700;margin:8px 0;">R$69<span style="font-size:14px;color:rgba(255,255,255,0.7);">/mês</span></p>
        <p style="color:rgba(255,255,255,0.8);font-size:12px;margin:0;">5.000 msgs • 10 chatbots • WhatsApp</p>
      </td>
    </tr>
  </table>
  <div style="text-align:center;margin:8px 0 24px;">
    <p style="color:#6b7280;font-size:13px;">Plano <strong>Business R$97/mês</strong> — mensagens e chatbots ilimitados + WhiteLabel</p>
  </div>
  <div style="text-align:center;margin:24px 0;">
    ${ctaButton('🚀 Fazer upgrade agora', panelUrl, '#10b981')}
  </div>
  <p style="color:#94a3b8;font-size:12px;text-align:center;">
    Cancele quando quiser. Sem compromisso.
  </p>
</td></tr>
${emailFooter()}`
    };

    const templateFn = templates[templateId];
    if (!templateFn) return null;
    
    const sequence = ONBOARDING_SEQUENCE.find(s => s.id === templateId);
    return {
        subject: sequence ? sequence.subject : 'LinkMágico',
        html: templateFn()
    };
}

module.exports = {
    ONBOARDING_SEQUENCE,
    getOnboardingTemplate
};
