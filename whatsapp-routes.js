// ===== MULTI-TENANT WHATSAPP API ROUTES (NOVO) =====

const { DatabaseHelpers } = require('./database');
const { whatsappIntegration, clearTenantCache } = require('./whatsapp-integration');

// Helper: resolver apiKey de múltiplas fontes (alinhado com server.js:3640)
function resolveApiKey(req) {
    return req.session?.validatedApiKey || req.headers['x-api-key'] || req.query?.apiKey || req.body?.apiKey || null;
}

module.exports = function (app, logger) {
    /**
     * Salvar configurações WhatsApp do tenant
     */
    app.post('/api/whatsapp/settings', async (req, res) => {
        try {
            const apiKey = resolveApiKey(req);
            if (!apiKey) {
                return res.status(401).json({ success: false, error: 'API Key não fornecida' });
            }
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
            const apiKey = resolveApiKey(req);
            if (!apiKey) {
                return res.status(401).json({ success: false, error: 'API Key não fornecida' });
            }
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
            const apiKey = resolveApiKey(req);
            if (!apiKey) {
                return res.status(401).json({ success: false, error: 'API Key não fornecida' });
            }
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
            const apiKey = resolveApiKey(req);
            if (!apiKey) {
                return res.status(401).json({ success: false, error: 'API Key não fornecida' });
            }

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

    // ═══════════════════════════════════════════════════════════════
    // WA-SAAS-001 — ROTAS SAAS (Evolution Central gerenciada pelo Link Mágico)
    // Compatibilidade: Coexiste com rotas existentes (settings, test, delete)
    // Segurança: Todas protegidas por apiKey + tenantId de sessão
    // ═══════════════════════════════════════════════════════════════

    const axios = require('axios');
    const crypto = require('crypto');

    // Config da Evolution Central (variáveis de ambiente)
    const CENTRAL_EVOLUTION_URL = process.env.CENTRAL_EVOLUTION_URL || '';
    const CENTRAL_EVOLUTION_API_KEY = process.env.CENTRAL_EVOLUTION_API_KEY || '';
    const APP_URL = process.env.APP_URL || 'https://linkmagico.app.br';

    // Helpers SaaS
    function generateInstanceName(tenantId) {
        // lm_<8 primeiros chars do tenantId> — permanente, não muda com API Key
        const hash = tenantId.replace(/-/g, '').substring(0, 8).toLowerCase();
        return `lm_${hash}`;
    }

    // Evolution Go v0.7.1: cada instância recebe um token único
    function generateInstanceToken(tenantId) {
        return crypto.createHash('sha256').update(`lm_${tenantId}_${Date.now()}`).digest('hex').substring(0, 32).toUpperCase();
    }

    function isSaasConfigured() {
        return !!(CENTRAL_EVOLUTION_URL && CENTRAL_EVOLUTION_API_KEY);
    }

    /**
     * POST /api/whatsapp/saas/connect
     * Cria instância na Evolution Central + retorna QR Code
     * Proteção: idempotente (reutiliza instância existente)
     */
    app.post('/api/whatsapp/saas/connect', async (req, res) => {
        try {
            const apiKey = resolveApiKey(req);
            const tenantId = req.session?.tenantId;

            if (!apiKey || !tenantId) {
                return res.status(401).json({ success: false, error: 'Autenticação necessária' });
            }

            if (!isSaasConfigured()) {
                return res.status(503).json({
                    success: false,
                    error: 'Integração SaaS WhatsApp ainda não está disponível. Configure CENTRAL_EVOLUTION_URL e CENTRAL_EVOLUTION_API_KEY.'
                });
            }

            const instanceName = generateInstanceName(tenantId);
            logger.info(`📱 [WA-SAAS] Conectando tenant ${tenantId} → instância: ${instanceName}`);

            // ═══ PROTEÇÃO CONTRA DUPLICAÇÃO ═══
            // Verifica se instância já existe no DB
            const existingSettings = await DatabaseHelpers.getWhatsAppSettings(apiKey);
            const alreadyHasSaasInstance = existingSettings?.saas_instance_name === instanceName;

            let instanceExists = false;

            // Evolution Go v0.7.1: verificar se instância já existe usando token salvo
            let instanceToken = existingSettings?.evolution_api_key || null;
            try {
                if (instanceToken) {
                    const checkResp = await axios.get(
                        `${CENTRAL_EVOLUTION_URL}/instance/status`,
                        { headers: { apikey: instanceToken }, timeout: 10000 }
                    );
                    const statusData = checkResp.data?.data || {};
                    instanceExists = statusData.Connected !== undefined;

                    // PROTEÇÃO: se instância está morta (QR expirou, disconnect permanente), deletar e recriar
                    if (instanceExists && !statusData.Connected && !statusData.LoggedIn) {
                        // Verificar se tem disconnect_reason (QR limit, etc.)
                        try {
                            const allResp = await axios.get(
                                `${CENTRAL_EVOLUTION_URL}/instance/all`,
                                { headers: { apikey: CENTRAL_EVOLUTION_API_KEY }, timeout: 8000 }
                            );
                            const instances = allResp.data?.data || [];
                            const thisInstance = instances.find(i => i.name === instanceName);
                            if (thisInstance?.disconnect_reason && thisInstance.disconnect_reason.includes('QR code limit')) {
                                logger.info(`📱 [WA-SAAS] Instância ${instanceName} com QR expirado — deletando para recriar...`);
                                try {
                                    await axios.delete(
                                        `${CENTRAL_EVOLUTION_URL}/instance/delete/${thisInstance.id}`,
                                        { headers: { apikey: CENTRAL_EVOLUTION_API_KEY }, timeout: 10000 }
                                    );
                                    logger.info(`📱 [WA-SAAS] ✅ Instância expirada ${instanceName} deletada`);
                                } catch (delErr) {
                                    logger.warn(`📱 [WA-SAAS] Aviso ao deletar instância expirada:`, delErr.message);
                                }
                                instanceExists = false;
                                instanceToken = null;
                            }
                        } catch (checkAllErr) {
                            logger.warn(`📱 [WA-SAAS] Aviso ao verificar disconnect_reason:`, checkAllErr.message);
                        }
                    }

                    if (instanceExists) {
                        logger.info(`📱 [WA-SAAS] Instância ${instanceName} já existe (Connected: ${statusData.Connected})`);
                    }
                }
            } catch (checkErr) {
                instanceExists = false;
                instanceToken = null;
                logger.info(`📱 [WA-SAAS] Instância ${instanceName} não encontrada, criando nova...`);
            }

            // Criar instância apenas se não existe
            if (!instanceExists) {
                try {
                    // Evolution Go v0.7.1: { name, token } + header apikey = GLOBAL_KEY
                    instanceToken = generateInstanceToken(tenantId);
                    await axios.post(
                        `${CENTRAL_EVOLUTION_URL}/instance/create`,
                        {
                            name: instanceName,
                            token: instanceToken
                        },
                        { headers: { apikey: CENTRAL_EVOLUTION_API_KEY }, timeout: 15000 }
                    );
                    logger.info(`📱 [WA-SAAS] ✅ Instância ${instanceName} criada com sucesso (Evolution Go)`);
                } catch (createErr) {
                    // Se erro é "instance already exists", tudo bem — idempotente
                    if (createErr.response?.data?.error?.includes?.('already') ||
                        createErr.response?.data?.message?.includes?.('already') ||
                        createErr.response?.status === 409) {
                        logger.info(`📱 [WA-SAAS] Instância ${instanceName} já existia (idempotente)`);
                        instanceExists = true;
                    } else {
                        logger.error(`📱 [WA-SAAS] ❌ Erro ao criar instância:`, createErr.response?.data || createErr.message);
                        return res.status(500).json({
                            success: false,
                            error: 'Falha ao criar instância WhatsApp. Tente novamente.'
                        });
                    }
                }
            }

            // Buscar QR Code (Evolution Go: GET /instance/qr com token da instância)
            let qrcode = null;
            try {
                const qrResp = await axios.get(
                    `${CENTRAL_EVOLUTION_URL}/instance/qr`,
                    { headers: { apikey: instanceToken }, timeout: 15000 }
                );
                // Evolution Go retorna: { data: { Qrcode: "data:image/png;base64,..." } }
                qrcode = qrResp.data?.data?.Qrcode || qrResp.data?.base64 || null;
            } catch (qrErr) {
                logger.warn(`📱 [WA-SAAS] Aviso ao buscar QR:`, qrErr.response?.data || qrErr.message);
                // Se já conectado, não terá QR — isso é OK
            }

            // Salvar/atualizar no banco
            try {
                await DatabaseHelpers.saveWhatsAppSettings(apiKey, {
                    provider: 'evolution_saas',
                    evolutionApiUrl: CENTRAL_EVOLUTION_URL,
                    evolutionApiKey: instanceToken, // Token da instância Evolution Go (identifica o tenant)
                    evolutionInstanceName: instanceName,
                    notificationPhone: existingSettings?.notification_phone || null,
                    isActive: true
                });

                // Atualizar colunas SaaS específicas
                const USE_POSTGRES = !!process.env.DATABASE_URL;
                const updateQuery = USE_POSTGRES
                    ? `UPDATE whatsapp_settings SET saas_instance_name = $1, connection_state = $2, last_seen = CURRENT_TIMESTAMP WHERE api_key = $3`
                    : `UPDATE whatsapp_settings SET saas_instance_name = ?, connection_state = ?, last_seen = datetime('now') WHERE api_key = ?`;
                await DatabaseHelpers.query
                    ? DatabaseHelpers.query(updateQuery, [instanceName, 'connecting', apiKey])
                    : require('./database').db?.query(updateQuery, [instanceName, 'connecting', apiKey]);
            } catch (dbErr) {
                logger.warn(`📱 [WA-SAAS] Aviso ao salvar SaaS settings:`, dbErr.message);
                // Não falhar — a instância já foi criada
            }

            // Invalidar cache
            clearTenantCache(apiKey);

            res.json({
                success: true,
                instanceName,
                qrcode,
                message: qrcode ? 'Escaneie o QR Code com seu WhatsApp' : 'Instância conectada ou aguardando QR'
            });

        } catch (error) {
            logger.error('📱 [WA-SAAS] Erro no connect:', error);
            res.status(500).json({ success: false, error: 'Erro interno ao conectar WhatsApp' });
        }
    });

    /**
     * GET /api/whatsapp/saas/status
     * Status de conexão com phone, pushName, provider
     */
    app.get('/api/whatsapp/saas/status', async (req, res) => {
        try {
            const apiKey = resolveApiKey(req);
            if (!apiKey) {
                return res.status(401).json({ success: false, error: 'API Key não fornecida' });
            }

            // Buscar settings do DB
            const settings = await DatabaseHelpers.getWhatsAppSettings(apiKey);
            if (!settings?.saas_instance_name) {
                return res.json({
                    success: true,
                    status: 'not_configured',
                    message: 'WhatsApp SaaS não configurado para este tenant'
                });
            }

            const instanceName = settings.saas_instance_name;

            if (!isSaasConfigured()) {
                return res.json({
                    success: true,
                    status: settings.connection_state || 'unknown',
                    phone: settings.saas_phone || null,
                    pushName: settings.saas_push_name || null,
                    instanceName,
                    provider: 'evolution_saas',
                    message: 'Dados do cache local (Evolution Central indisponível)'
                });
            }

            // Consultar Evolution Central
            let state = 'disconnected';
            let phone = settings.saas_phone || null;
            let pushName = settings.saas_push_name || null;

            // Evolution Go v0.7.1: /instance/status com token da instância
            const instanceToken = settings.evolution_api_key || CENTRAL_EVOLUTION_API_KEY;
            try {
                const stateResp = await axios.get(
                    `${CENTRAL_EVOLUTION_URL}/instance/status`,
                    { headers: { apikey: instanceToken }, timeout: 8000 }
                );
                const goData = stateResp.data?.data || {};
                state = (goData.Connected && goData.LoggedIn) ? 'open'
                      : goData.Connected ? 'connecting'
                      : 'disconnected';
                pushName = goData.Name || pushName;
            } catch (stateErr) {
                logger.warn(`📱 [WA-SAAS] Erro ao consultar estado:`, stateErr.message);
                state = settings.connection_state || 'disconnected';
            }

            // Se conectado, buscar dados da instância (número, nome)
            if (state === 'open') {
                try {
                    // Evolution Go: /instance/all retorna lista de instâncias
                    const infoResp = await axios.get(
                        `${CENTRAL_EVOLUTION_URL}/instance/all`,
                        {
                            headers: { apikey: instanceToken },
                            timeout: 8000
                        }
                    );
                    const instances = infoResp.data?.data || [];
                    const instanceData = instances.find(i => i.name === instanceName);

                    if (instanceData) {
                        const jid = instanceData.jid || '';
                        if (jid) {
                            phone = '+' + jid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
                        }
                    }
                } catch (infoErr) {
                    logger.warn(`📱 [WA-SAAS] Aviso ao buscar info da instância:`, infoErr.message);
                }

                // Atualizar DB com estado e dados
                try {
                    const USE_POSTGRES = !!process.env.DATABASE_URL;
                    const uq = USE_POSTGRES
                        ? `UPDATE whatsapp_settings SET connection_state = 'connected', saas_phone = $1, saas_push_name = $2, connected_at = CURRENT_TIMESTAMP, last_seen = CURRENT_TIMESTAMP WHERE api_key = $3`
                        : `UPDATE whatsapp_settings SET connection_state = 'connected', saas_phone = ?, saas_push_name = ?, connected_at = datetime('now'), last_seen = datetime('now') WHERE api_key = ?`;
                    const dbRef = require('./database');
                    await (dbRef.db || dbRef).query(uq, [phone, pushName, apiKey]);
                } catch (dbErr) {
                    logger.warn(`📱 [WA-SAAS] Aviso ao atualizar status no DB:`, dbErr.message);
                }
            } else if (state === 'close' || state === 'disconnected') {
                // Atualizar DB
                try {
                    const USE_POSTGRES = !!process.env.DATABASE_URL;
                    const uq = USE_POSTGRES
                        ? `UPDATE whatsapp_settings SET connection_state = 'disconnected', last_seen = CURRENT_TIMESTAMP WHERE api_key = $1`
                        : `UPDATE whatsapp_settings SET connection_state = 'disconnected', last_seen = datetime('now') WHERE api_key = ?`;
                    const dbRef = require('./database');
                    await (dbRef.db || dbRef).query(uq, [apiKey]);
                } catch (dbErr) { /* silencioso */ }
            }

            res.json({
                success: true,
                status: state === 'open' ? 'connected' : state === 'connecting' ? 'connecting' : 'disconnected',
                phone,
                pushName,
                instanceName,
                provider: 'evolution_saas',
                connectedAt: settings.connected_at || null,
                lastSeen: settings.last_seen || null
            });

        } catch (error) {
            logger.error('📱 [WA-SAAS] Erro no status:', error);
            res.status(500).json({ success: false, error: 'Erro ao consultar status' });
        }
    });

    /**
     * POST /api/whatsapp/saas/disconnect
     * Logout da instância (NÃO deleta — preserva histórico)
     */
    app.post('/api/whatsapp/saas/disconnect', async (req, res) => {
        try {
            const apiKey = resolveApiKey(req);
            if (!apiKey) {
                return res.status(401).json({ success: false, error: 'API Key não fornecida' });
            }

            const settings = await DatabaseHelpers.getWhatsAppSettings(apiKey);
            if (!settings?.saas_instance_name) {
                return res.status(400).json({ success: false, error: 'Nenhuma instância SaaS configurada' });
            }

            const instanceName = settings.saas_instance_name;
            logger.info(`📱 [WA-SAAS] Desconectando instância ${instanceName}...`);

            // Logout na Evolution Central (NÃO delete!)
            if (isSaasConfigured()) {
                try {
                    // Evolution Go v0.7.1: DELETE /instance/logout com token da instância
                    const instanceToken = settings.evolution_api_key || CENTRAL_EVOLUTION_API_KEY;
                    await axios.delete(
                        `${CENTRAL_EVOLUTION_URL}/instance/logout`,
                        { headers: { apikey: instanceToken }, timeout: 10000 }
                    );
                    logger.info(`📱 [WA-SAAS] ✅ Logout realizado para ${instanceName} (Evolution Go)`);
                } catch (logoutErr) {
                    logger.warn(`📱 [WA-SAAS] Aviso no logout:`, logoutErr.response?.data || logoutErr.message);
                    // Continuar mesmo com erro — atualizar DB de qualquer forma
                }
            }

            // Atualizar DB: estado desconectado, manter instância
            try {
                const USE_POSTGRES = !!process.env.DATABASE_URL;
                const uq = USE_POSTGRES
                    ? `UPDATE whatsapp_settings SET connection_state = 'disconnected', connected_at = NULL, last_seen = CURRENT_TIMESTAMP WHERE api_key = $1`
                    : `UPDATE whatsapp_settings SET connection_state = 'disconnected', connected_at = NULL, last_seen = datetime('now') WHERE api_key = ?`;
                const dbRef = require('./database');
                await (dbRef.db || dbRef).query(uq, [apiKey]);
            } catch (dbErr) {
                logger.warn(`📱 [WA-SAAS] Aviso ao atualizar DB após disconnect:`, dbErr.message);
            }

            // Invalidar cache
            clearTenantCache(apiKey);

            res.json({
                success: true,
                message: 'WhatsApp desconectado. Instância preservada para reconexão.'
            });

        } catch (error) {
            logger.error('📱 [WA-SAAS] Erro no disconnect:', error);
            res.status(500).json({ success: false, error: 'Erro ao desconectar' });
        }
    });

    /**
     * POST /api/whatsapp/saas/reconnect
     * Reconectar instância existente (novo QR Code, sem criar nova instância)
     */
    app.post('/api/whatsapp/saas/reconnect', async (req, res) => {
        try {
            const apiKey = resolveApiKey(req);
            if (!apiKey) {
                return res.status(401).json({ success: false, error: 'API Key não fornecida' });
            }

            if (!isSaasConfigured()) {
                return res.status(503).json({ success: false, error: 'Evolution Central não configurada' });
            }

            const settings = await DatabaseHelpers.getWhatsAppSettings(apiKey);
            if (!settings?.saas_instance_name) {
                return res.status(400).json({
                    success: false,
                    error: 'Nenhuma instância SaaS encontrada. Use /connect primeiro.'
                });
            }

            const instanceName = settings.saas_instance_name;
            logger.info(`📱 [WA-SAAS] Reconectando instância ${instanceName}...`);

            // Buscar novo QR Code
            let qrcode = null;
            try {
                const qrResp = await axios.get(
                    `${CENTRAL_EVOLUTION_URL}/instance/connect/${instanceName}`,
                    { headers: { apikey: CENTRAL_EVOLUTION_API_KEY }, timeout: 15000 }
                );
                qrcode = qrResp.data?.base64 || qrResp.data?.qrcode?.base64 || qrResp.data?.code || null;
            } catch (qrErr) {
                // Se já conectado, a Evolution pode retornar erro
                if (qrErr.response?.status === 400 || qrErr.response?.data?.message?.includes?.('connected')) {
                    return res.json({
                        success: true,
                        status: 'already_connected',
                        instanceName,
                        message: 'WhatsApp já está conectado!'
                    });
                }
                logger.error(`📱 [WA-SAAS] Erro ao buscar QR para reconexão:`, qrErr.response?.data || qrErr.message);
                return res.status(500).json({ success: false, error: 'Falha ao gerar QR Code' });
            }

            // Atualizar estado
            try {
                const USE_POSTGRES = !!process.env.DATABASE_URL;
                const uq = USE_POSTGRES
                    ? `UPDATE whatsapp_settings SET connection_state = 'connecting', last_seen = CURRENT_TIMESTAMP WHERE api_key = $1`
                    : `UPDATE whatsapp_settings SET connection_state = 'connecting', last_seen = datetime('now') WHERE api_key = ?`;
                const dbRef = require('./database');
                await (dbRef.db || dbRef).query(uq, [apiKey]);
            } catch (dbErr) { /* silencioso */ }

            clearTenantCache(apiKey);

            res.json({
                success: true,
                instanceName,
                qrcode,
                message: 'Escaneie o novo QR Code para reconectar'
            });

        } catch (error) {
            logger.error('📱 [WA-SAAS] Erro no reconnect:', error);
            res.status(500).json({ success: false, error: 'Erro ao reconectar' });
        }
    });

    logger.info('✅ Rotas Multi-Tenant WhatsApp configuradas');
    if (isSaasConfigured()) {
        logger.info('📱 [WA-SAAS] ✅ Rotas SaaS ativas (Evolution Central: ' + CENTRAL_EVOLUTION_URL + ')');
    } else {
        logger.info('📱 [WA-SAAS] ⚠️ Rotas SaaS registradas mas Evolution Central não configurada');
    }
};
