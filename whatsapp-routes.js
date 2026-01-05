// ===== MULTI-TENANT WHATSAPP API ROUTES (NOVO) =====

const { DatabaseHelpers } = require('./database');
const { whatsappIntegration, clearTenantCache } = require('./whatsapp-integration');

module.exports = function (app, logger) {
    /**
     * Salvar configurações WhatsApp do tenant
     */
    app.post('/api/whatsapp/settings', async (req, res) => {
        try {
            const apiKey = req.session.validatedApiKey;
            const settings = req.body;

            // Validar campos obrigatórios
            if (!settings.provider || !['twilio', 'evolution'].includes(settings.provider)) {
                return res.status(400).json({
                    success: false,
                    error: 'Provider inválido. Use "twilio" ou "evolution"'
                });
            }

            // Validar campos específicos por provider
            if (settings.provider === 'twilio') {
                if (!settings.twilioAccountSid || !settings.twilioAuthToken || !settings.twilioFromNumber) {
                    return res.status(400).json({
                        success: false,
                        error: 'Twilio requer: twilioAccountSid, twilioAuthToken e twilioFromNumber'
                    });
                }
            } else if (settings.provider === 'evolution') {
                if (!settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
                    return res.status(400).json({
                        success: false,
                        error: 'Evolution API requer: evolutionApiUrl, evolutionApiKey e evolutionInstanceName'
                    });
                }
            }

            // Salvar no banco
            await DatabaseHelpers.saveWhatsAppSettings(apiKey, settings);

            // Invalidar cache para forçar reload
            clearTenantCache(apiKey);

            logger.info(`✅ Configurações WhatsApp salvas para tenant ${apiKey} `);
            res.json({
                success: true,
                message: 'Configurações salvas com sucesso'
            });
        } catch (error) {
            logger.error('Erro ao salvar configurações WhatsApp:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Buscar configurações WhatsApp do tenant
     */
    app.get('/api/whatsapp/settings', async (req, res) => {
        try {
            const apiKey = req.session.validatedApiKey;
            const settings = await DatabaseHelpers.getWhatsAppSettings(apiKey);

            if (!settings) {
                return res.json({
                    success: true,
                    configured: false,
                    usingGlobal: !!process.env.WHATSAPP_PROVIDER, // Indica se está usando fallback
                    message: 'Nenhuma configuração própria. Configure para personalizar.'
                });
            }

            // Retornar sem dados sensíveis (não enviar tokens/senhas)
            res.json({
                success: true,
                configured: true,
                settings: {
                    provider: settings.provider,
                    notificationPhone: settings.notification_phone,
                    isActive: settings.is_active,
                    // Indicadores sem expor credenciais
                    hasTwilioConfig: !!settings.twilio_account_sid,
                    hasEvolutionConfig: !!settings.evolution_api_url,
                    createdAt: settings.created_at
                }
            });
        } catch (error) {
            logger.error('Erro ao buscar configurações WhatsApp:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Testar configuração WhatsApp do tenant
     */
    app.post('/api/whatsapp/settings/test', async (req, res) => {
        try {
            const apiKey = req.session.validatedApiKey;
            const { phoneNumber } = req.body;

            if (!phoneNumber) {
                return res.status(400).json({
                    success: false,
                    error: 'Telefone de teste obrigatório'
                });
            }

            const instance = await whatsappIntegration.getTenantInstance(apiKey);
            const result = await instance.testConnection(phoneNumber);

            logger.info(`📱 Teste WhatsApp para tenant ${apiKey}: ${result.success ? 'SUCESSO' : 'FALHA'} `);

            res.json({
                success: result.success,
                message: result.success
                    ? '✅ Mensagem de teste enviada com sucesso!'
                    : '❌ Falha ao enviar mensagem de teste',
                details: result
            });
        } catch (error) {
            logger.error('Erro ao testar WhatsApp:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Deletar configurações WhatsApp do tenant
     */
    app.delete('/api/whatsapp/settings', async (req, res) => {
        try {
            const apiKey = req.session.validatedApiKey;

            await DatabaseHelpers.deleteWhatsAppSettings(apiKey);

            // Invalidar cache
            clearTenantCache(apiKey);

            logger.info(`🗑️ Configurações WhatsApp removidas para tenant ${apiKey} `);

            res.json({
                success: true,
                message: 'Configurações removidas. Usando configuração global (fallback).'
            });
        } catch (error) {
            logger.error('Erro ao deletar configurações WhatsApp:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    logger.info('✅ Rotas Multi-Tenant WhatsApp configuradas');
};
