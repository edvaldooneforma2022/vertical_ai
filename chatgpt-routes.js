// ===== MULTI-TENANT CHATGPT API ROUTES (NOVO) =====

const { DatabaseHelpers } = require('./database');
const { chatgptIntegration, clearTenantCache } = require('./chatgpt-integration');

module.exports = function (app, logger) {
    /**
     * Salvar configurações ChatGPT do tenant
     */
    app.post('/api/chatgpt/settings', async (req, res) => {
        try {
            const apiKey = req.session.validatedApiKey;
            const settings = req.body;

            // Validar API Key da OpenAI
            if (!settings.openaiApiKey || !settings.openaiApiKey.startsWith('sk-')) {
                return res.status(400).json({
                    success: false,
                    error: 'API Key da OpenAI inválida. Deve começar com "sk-"'
                });
            }

            // Salvar no banco
            await DatabaseHelpers.saveChatGPTSettings(apiKey, settings);

            // Invalidar cache para forçar reload
            clearTenantCache(apiKey);

            logger.info(`✅ Configurações ChatGPT salvas para tenant ${apiKey}`);
            res.json({
                success: true,
                message: 'Configurações salvas com sucesso'
            });
        } catch (error) {
            logger.error('Erro ao salvar configurações ChatGPT:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Buscar configurações ChatGPT do tenant
     */
    app.get('/api/chatgpt/settings', async (req, res) => {
        try {
            const apiKey = req.session.validatedApiKey;
            const settings = await DatabaseHelpers.getChatGPTSettings(apiKey);

            if (!settings) {
                return res.json({
                    success: true,
                    configured: false,
                    usingGlobal: !!process.env.CHATGPT_API_KEY, // Indica se está usando fallback
                    message: 'Nenhuma configuração própria. Configure para personalizar.'
                });
            }

            // Retornar sem dados sensíveis (não enviar API key completa)
            res.json({
                success: true,
                configured: true,
                settings: {
                    defaultModel: settings.default_model,
                    temperature: settings.temperature,
                    maxTokens: settings.max_tokens,
                    isActive: settings.is_active,
                    hasOpenAIKey: !!settings.openai_api_key,
                    // Mostrar apenas últimos 4 caracteres da chave
                    openaiKeyHint: settings.openai_api_key ? `sk-****${settings.openai_api_key.slice(-4)}` : null,
                    createdAt: settings.created_at
                }
            });
        } catch (error) {
            logger.error('Erro ao buscar configurações ChatGPT:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Testar configuração ChatGPT do tenant
     */
    app.post('/api/chatgpt/settings/test', async (req, res) => {
        try {
            const apiKey = req.session.validatedApiKey;

            const instance = await chatgptIntegration.getTenantInstance(apiKey);

            if (!instance.isReady()) {
                return res.status(400).json({
                    success: false,
                    error: 'ChatGPT não configurado. Salve uma API Key válida primeiro.'
                });
            }

            const result = await instance.testConnection();

            logger.info(`🤖 Teste ChatGPT para tenant ${apiKey}: ${result.success ? 'SUCESSO' : 'FALHA'}`);

            res.json({
                success: result.success,
                message: result.success
                    ? '✅ Conexão com OpenAI testada com sucesso!'
                    : '❌ Falha ao conectar com OpenAI',
                details: result
            });
        } catch (error) {
            logger.error('Erro ao testar ChatGPT:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Deletar configurações ChatGPT do tenant
     */
    app.delete('/api/chatgpt/settings', async (req, res) => {
        try {
            const apiKey = req.session.validatedApiKey;

            await DatabaseHelpers.deleteChatGPTSettings(apiKey);

            // Invalidar cache
            clearTenantCache(apiKey);

            logger.info(`🗑️ Configurações ChatGPT removidas para tenant ${apiKey}`);

            res.json({
                success: true,
                message: 'Configurações removidas. Usando configuração global (fallback).'
            });
        } catch (error) {
            logger.error('Erro ao deletar configurações ChatGPT:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * Gerar resposta usando instância do tenant (atualização da rota existente)
     */
    app.post('/api/chatgpt/generate-tenant', async (req, res) => {
        try {
            const apiKey = req.session.validatedApiKey;
            const { prompt, model, pageContent } = req.body;

            if (!prompt) {
                return res.status(400).json({
                    success: false,
                    error: 'Prompt é obrigatório'
                });
            }

            const instance = await chatgptIntegration.getTenantInstance(apiKey);

            if (!instance.isReady()) {
                return res.status(400).json({
                    success: false,
                    error: 'ChatGPT não configurado. Configure sua API Key primeiro.'
                });
            }

            const result = pageContent
                ? await instance.generateResponseWithContext(prompt, pageContent, { model })
                : await instance.generateResponse(prompt, { model });

            res.json({ success: result.success, result });
        } catch (error) {
            logger.error('Erro ao gerar resposta ChatGPT:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    logger.info('✅ Rotas Multi-Tenant ChatGPT configuradas');
};
