// ===== WHATSAPP BUSINESS API INTEGRATION =====
// Módulo para enviar mensagens via WhatsApp usando Twilio ou Evolution API

const axios = require('axios');

class WhatsAppIntegration {
    constructor() {
        this.provider = null; // 'twilio' ou 'evolution'
        this.isConfigured = false;
        this.config = {};
        // NOVO: Cache de instâncias por tenant para multi-tenancy
        this.tenantInstances = new Map();
        this.messageTemplates = {
            newLead: `🎉 *Novo Lead Capturado!*

📋 *Informações:*
• Nome: {{leadName}}
• Email: {{leadEmail}}
• Telefone: {{leadPhone}}
• Chatbot: {{chatbotName}}

⏰ {{timestamp}}

Acesse o painel para mais detalhes!`,

            highIntent: `🔥 *Lead com Alta Intenção!*

Um cliente demonstrou muito interesse!

📋 *Dados:*
• Nome: {{leadName}}
• Interesse: {{interest}}
• Chatbot: {{chatbotName}}

💡 *Sugestão:* Entre em contato AGORA!`,

            dailySummary: `📊 *Resumo Diário - {{date}}*

Seu chatbot {{chatbotName}} teve:

• {{totalMessages}} mensagens
• {{totalConversations}} conversas
• {{totalLeads}} leads capturados
• {{successRate}}% taxa de sucesso

Continue assim! 🚀`
        };
    }

    // Configurar Twilio
    configureTwilio(config) {
        try {
            const { accountSid, authToken, fromNumber } = config;

            if (!accountSid || !authToken || !fromNumber) {
                console.log('⚠️  Twilio não configurado (credenciais ausentes)');
                return false;
            }

            this.provider = 'twilio';
            this.config = {
                accountSid,
                authToken,
                fromNumber
            };
            this.isConfigured = true;

            console.log('✅ Twilio WhatsApp configurado');
            return true;
        } catch (error) {
            console.error('❌ Erro ao configurar Twilio:', error.message);
            return false;
        }
    }

    // Configurar Evolution API
    configureEvolution(config) {
        try {
            const { apiUrl, apiKey, instanceName } = config;

            if (!apiUrl || !apiKey || !instanceName) {
                console.log('⚠️  Evolution API não configurada (credenciais ausentes)');
                return false;
            }

            this.provider = 'evolution';
            this.config = {
                apiUrl,
                apiKey,
                instanceName
            };
            this.isConfigured = true;

            console.log('✅ Evolution API WhatsApp configurada');
            return true;
        } catch (error) {
            console.error('❌ Erro ao configurar Evolution API:', error.message);
            return false;
        }
    }

    // Verificar se está configurado
    isReady() {
        return this.isConfigured && this.provider !== null;
    }

    // Substituir variáveis no template
    replaceVariables(template, variables) {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, value || 'N/A');
        }
        return result;
    }

    // Formatar número de telefone (adicionar código do país se necessário)
    formatPhoneNumber(phone) {
        // Remove caracteres não numéricos
        let cleaned = phone.replace(/\D/g, '');

        // Se não tem código do país, adiciona +55 (Brasil)
        if (!cleaned.startsWith('55') && cleaned.length <= 11) {
            cleaned = '55' + cleaned;
        }

        // Adiciona + no início
        if (!cleaned.startsWith('+')) {
            cleaned = '+' + cleaned;
        }

        return cleaned;
    }

    // Enviar mensagem via Twilio
    async sendViaTwilio(to, message) {
        try {
            const { accountSid, authToken, fromNumber } = this.config;

            const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

            const formattedTo = this.formatPhoneNumber(to);
            const formattedFrom = `whatsapp:${fromNumber}`;
            const formattedToWhatsApp = `whatsapp:${formattedTo}`;

            const response = await axios.post(url,
                new URLSearchParams({
                    To: formattedToWhatsApp,
                    From: formattedFrom,
                    Body: message
                }),
                {
                    auth: {
                        username: accountSid,
                        password: authToken
                    },
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            console.log(`✅ WhatsApp enviado via Twilio para ${to}`);
            return { success: true, messageId: response.data.sid };
        } catch (error) {
            console.error('❌ Erro ao enviar via Twilio:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    // Enviar mensagem via Evolution API
    async sendViaEvolution(to, message) {
        try {
            const { apiUrl, apiKey, instanceName } = this.config;

            const url = `${apiUrl}/message/sendText/${instanceName}`;

            const formattedTo = this.formatPhoneNumber(to);

            const response = await axios.post(url, {
                number: formattedTo,
                textMessage: {
                    text: message
                }
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': apiKey
                }
            });

            console.log(`✅ WhatsApp enviado via Evolution para ${to}`);
            return { success: true, messageId: response.data.key?.id };
        } catch (error) {
            console.error('❌ Erro ao enviar via Evolution:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    // Enviar mensagem (detecta provider automaticamente)
    async sendMessage(to, message) {
        if (!this.isReady()) {
            console.log('⚠️  WhatsApp não configurado, mensagem não enviada');
            return { success: false, error: 'WhatsApp não configurado' };
        }

        if (this.provider === 'twilio') {
            return await this.sendViaTwilio(to, message);
        } else if (this.provider === 'evolution') {
            return await this.sendViaEvolution(to, message);
        } else {
            return { success: false, error: 'Provider desconhecido' };
        }
    }

    // Notificar novo lead
    async notifyNewLead(leadData, chatbotData, ownerPhone) {
        if (!this.isReady() || !ownerPhone) {
            return { success: false, error: 'WhatsApp não configurado ou telefone ausente' };
        }

        const template = this.messageTemplates.newLead;
        const variables = {
            leadName: leadData.name || 'Não informado',
            leadEmail: leadData.email || 'Não informado',
            leadPhone: leadData.phone || 'Não informado',
            chatbotName: chatbotData.name || 'Chatbot',
            timestamp: new Date().toLocaleString('pt-BR')
        };

        const message = this.replaceVariables(template, variables);
        return await this.sendMessage(ownerPhone, message);
    }

    /**
     * Notificar novo lead (Versão Compatível com server.js)
     * @param {Object} lead - Dados do lead do structuredLeadsManager
     */
    async sendLeadNotification(lead) {
        if (!this.isReady()) return { success: false, error: 'WhatsApp não configurado' };

        // Tenta obter o telefone do dono das variáveis de ambiente
        const ownerPhone = process.env.NOTIFICATION_PHONE || process.env.ADMIN_PHONE || process.env.TWILIO_WHATSAPP_NUMBER;

        if (!ownerPhone) {
            console.log('⚠️ Telefone de notificação não configurado (NOTIFICATION_PHONE)');
            return { success: false, error: 'Telefone de notificação ausente' };
        }

        const template = this.messageTemplates.newLead;
        const variables = {
            leadName: lead.name || 'Novo Lead',
            leadEmail: lead.email || 'Não informado',
            leadPhone: lead.phone || 'Não informado',
            chatbotName: 'Seu Chatbot',
            timestamp: new Date().toLocaleString('pt-BR')
        };

        const message = this.replaceVariables(template, variables);
        return await this.sendMessage(ownerPhone, message);
    }

    // Notificar alta intenção de compra
    async notifyHighIntent(leadData, chatbotData, ownerPhone) {
        if (!this.isReady() || !ownerPhone) {
            return { success: false, error: 'WhatsApp não configurado ou telefone ausente' };
        }

        const template = this.messageTemplates.highIntent;
        const variables = {
            leadName: leadData.name || 'Cliente',
            interest: leadData.interest || 'Produto/Serviço',
            chatbotName: chatbotData.name || 'Chatbot'
        };

        const message = this.replaceVariables(template, variables);
        return await this.sendMessage(ownerPhone, message);
    }

    // Enviar resumo diário
    async sendDailySummary(analytics, chatbotData, ownerPhone) {
        if (!this.isReady() || !ownerPhone) {
            return { success: false, error: 'WhatsApp não configurado ou telefone ausente' };
        }

        const template = this.messageTemplates.dailySummary;
        const variables = {
            date: new Date().toLocaleDateString('pt-BR'),
            chatbotName: chatbotData.name || 'Chatbot',
            totalMessages: analytics.totalMessages || 0,
            totalConversations: analytics.totalConversations || 0,
            totalLeads: analytics.totalLeads || 0,
            successRate: analytics.successRate || 0
        };

        const message = this.replaceVariables(template, variables);
        return await this.sendMessage(ownerPhone, message);
    }

    // Enviar mensagem customizada
    async sendCustomMessage(to, content, variables = {}) {
        if (!this.isReady()) {
            return { success: false, error: 'WhatsApp não configurado' };
        }

        const message = this.replaceVariables(content, variables);
        return await this.sendMessage(to, message);
    }

    // Adicionar template customizado
    addTemplate(name, template) {
        this.messageTemplates[name] = template;
        console.log(`✅ Template WhatsApp '${name}' adicionado`);
    }

    // Listar templates disponíveis
    getTemplates() {
        return Object.keys(this.messageTemplates);
    }

    // Testar conexão
    async testConnection(testPhone) {
        if (!this.isReady()) {
            return { success: false, error: 'WhatsApp não configurado' };
        }

        const testMessage = `✅ Teste de conexão WhatsApp\n\nSua integração está funcionando corretamente!\n\nProvider: ${this.provider}`;

        return await this.sendMessage(testPhone, testMessage);
    }

    // Obter status da configuração
    getStatus() {
        return {
            configured: this.isConfigured,
            provider: this.provider,
            ready: this.isReady()
        };
    }

    // ===== MULTI-TENANT METHODS (NOVO) =====

    /**
     * NOVO: Obter ou criar instância WhatsApp para um tenant específico
     * @param {string} apiKey - API key do tenant
     * @returns {WhatsAppIntegration} Instância configurada para o tenant ou global (fallback)
     */
    async getTenantInstance(apiKey) {
        // Verificar cache
        if (this.tenantInstances.has(apiKey)) {
            console.log(`📦 Usando instância WhatsApp em cache para tenant ${apiKey}`);
            return this.tenantInstances.get(apiKey);
        }

        // Buscar configurações do banco
        try {
            const { DatabaseHelpers } = require('./database');
            const settings = await DatabaseHelpers.getWhatsAppSettings(apiKey);

            if (!settings) {
                // FALLBACK: Usar configuração global (admin)
                console.log(`⚠️ Tenant ${apiKey} sem WhatsApp próprio, usando configuração global`);
                return this; // Retorna instância global
            }

            // Criar instância isolada para o tenant
            const tenantInstance = new WhatsAppIntegration();

            if (settings.provider === 'twilio') {
                tenantInstance.configureTwilio({
                    accountSid: settings.twilio_account_sid,
                    authToken: settings.twilio_auth_token,
                    fromNumber: settings.twilio_from_number
                });
            } else if (settings.provider === 'evolution') {
                tenantInstance.configureEvolution({
                    apiUrl: settings.evolution_api_url,
                    apiKey: settings.evolution_api_key,
                    instanceName: settings.evolution_instance_name
                });
            } else if (settings.provider === 'evolution_saas') {
                // WA-SAAS-001: Modo SaaS — usa credenciais da Evolution Central
                const centralUrl = process.env.CENTRAL_EVOLUTION_URL;
                const centralKey = process.env.CENTRAL_EVOLUTION_API_KEY;
                const saasInstance = settings.saas_instance_name || settings.evolution_instance_name;

                if (centralUrl && centralKey && saasInstance) {
                    tenantInstance.configureEvolution({
                        apiUrl: centralUrl,
                        apiKey: centralKey,
                        instanceName: saasInstance
                    });
                    console.log(`📱 [WA-SAAS] Instância SaaS configurada para tenant ${apiKey} (${saasInstance})`);
                } else {
                    console.warn(`⚠️ [WA-SAAS] Tenant ${apiKey} é SaaS mas Evolution Central não está configurada`);
                    return this; // Fallback para instância global
                }
            }

            // Armazenar em cache
            this.tenantInstances.set(apiKey, tenantInstance);
            console.log(`✅ Instância WhatsApp criada para tenant ${apiKey} (${settings.provider})`);

            return tenantInstance;
        } catch (error) {
            console.error(`❌ Erro ao obter instância para tenant ${apiKey}:`, error);
            // Em caso de erro, usar global como fallback
            return this;
        }
    }

    /**
     * NOVO: Enviar notificação de lead com suporte multi-tenant
     * @param {string} apiKey - API key do tenant
     * @param {Object} lead - Dados do lead
     * @param {string} ownerPhone - Telefone do dono (opcional)
     */
    async sendLeadNotificationForTenant(apiKey, lead, ownerPhone = null) {
        try {
            const instance = await this.getTenantInstance(apiKey);

            // Determinar telefone do dono
            let phone = ownerPhone;
            if (!phone) {
                phone = await this._getOwnerPhoneFromSettings(apiKey);
            }
            if (!phone) {
                phone = process.env.NOTIFICATION_PHONE || process.env.ADMIN_PHONE;
            }

            if (!phone) {
                console.log(`⚠️ Tenant ${apiKey}: sem telefone configurado para notificações`);
                return { success: false, reason: 'no_phone' };
            }

            // Usar método existente da instância
            const template = instance.messageTemplates.newLead;
            const variables = {
                leadName: lead.name || lead.nome || 'Novo Lead',
                leadEmail: lead.email || 'Não informado',
                leadPhone: lead.phone || lead.telefone || 'Não informado',
                chatbotName: 'Seu Chatbot',
                timestamp: new Date().toLocaleString('pt-BR')
            };

            const message = instance.replaceVariables(template, variables);
            return await instance.sendMessage(phone, message);
        } catch (error) {
            console.error(`❌ Erro ao enviar notificação para tenant ${apiKey}:`, error);
            return { success: false, error: error.message };
        }
    }

    /**
     * NOVO: Obter telefone do dono das configurações do tenant
     * @param {string} apiKey - API key do tenant
     * @returns {string|null} Telefone ou null
     */
    async _getOwnerPhoneFromSettings(apiKey) {
        try {
            const { DatabaseHelpers } = require('./database');
            const settings = await DatabaseHelpers.getWhatsAppSettings(apiKey);
            return settings?.notification_phone || null;
        } catch (error) {
            console.error('❌ Erro ao buscar telefone do dono:', error);
            return null;
        }
    }

    /**
     * NOVO: Invalidar cache de um tenant (útil após atualizar configurações)
     * @param {string} apiKey - API key do tenant
     */
    clearTenantCache(apiKey) {
        if (this.tenantInstances.has(apiKey)) {
            this.tenantInstances.delete(apiKey);
            console.log(`🗑️ Cache invalidado para tenant ${apiKey}`);
        }
    }
}

// Singleton instance
const whatsappIntegration = new WhatsAppIntegration();

// Configurar automaticamente se variáveis de ambiente existirem
if (process.env.WHATSAPP_PROVIDER === 'twilio') {
    whatsappIntegration.configureTwilio({
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_WHATSAPP_NUMBER
    });
} else if (process.env.WHATSAPP_PROVIDER === 'evolution') {
    whatsappIntegration.configureEvolution({
        apiUrl: process.env.EVOLUTION_API_URL,
        apiKey: process.env.EVOLUTION_API_KEY,
        instanceName: process.env.EVOLUTION_INSTANCE_NAME
    });
}

module.exports = {
    whatsappIntegration,
    whatsappManager: whatsappIntegration, // Alias para compatibilidade com server.js
    WhatsAppIntegration,
    // NOVO: Exportar método multi-tenant
    getTenantInstance: (apiKey) => whatsappIntegration.getTenantInstance(apiKey),
    clearTenantCache: (apiKey) => whatsappIntegration.clearTenantCache(apiKey)
};

