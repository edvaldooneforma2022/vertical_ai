/**
 * 🛣️ NOVAS ROTAS DE API - Link Mágico
 * Rotas para as novas funcionalidades implementadas
 */

const express = require('express');
const { DatabaseHelpers, USE_POSTGRES } = require('./database');
const { CacheManager, isRedisConnected } = require('./cache');
const { webhookManager, WebhookEvents } = require('./webhooks');
const { billingManager, PLANS } = require('./billing');
const { analyticsManager } = require('./analytics');
const { llmOptimizer } = require('./llm-optimizer');
const { knowledgeBaseManager } = require('./knowledge-base');

// SAFE PATCH - BUG-LEADS-002: Importar getLeadSystem para dados de leads consistentes
let getLeadSystem = null;
try {
    const leadsModule = require('./lib/leads/lead-capture');
    getLeadSystem = leadsModule.getLeadSystem;
    console.log('✅ Módulo de leads carregado em routes.js');
} catch (e) {
    console.warn('⚠️ Módulo de leads não disponível para routes.js:', e.message);
}

// ===== Feature Flags (Meus Assistentes) =====
let featureFlags = null;
try {
    const ffModule = require('./lib/feature-flags');
    featureFlags = ffModule.featureFlags;
} catch (e) {
    // Feature flags não disponível — rotas protegidas retornarão 403
}
const crypto = require('crypto');

/**
 * Configurar todas as novas rotas
 */
function setupRoutes(app) {

    // ===== ROTAS DE ANALYTICS =====

    /**
     * GET /api/analytics/:chatbotId
     * Obter analytics de um chatbot
     */
    app.get('/api/analytics/:chatbotId', async (req, res) => {
        try {
            const { chatbotId } = req.params;
            const { days = 30 } = req.query;

            const summary = await analyticsManager.getSummary(chatbotId, parseInt(days));

            res.json({
                success: true,
                chatbotId,
                period: `${days} dias`,
                analytics: summary
            });
        } catch (error) {
            console.error('❌ Erro ao obter analytics:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao obter analytics'
            });
        }
    });

    /**
     * GET /api/analytics/:chatbotId/export
     * Exportar analytics para CSV
     */
    app.get('/api/analytics/:chatbotId/export', async (req, res) => {
        try {
            const { chatbotId } = req.params;
            const { startDate, endDate } = req.query;

            if (!startDate || !endDate) {
                return res.status(400).json({
                    success: false,
                    error: 'startDate e endDate são obrigatórios'
                });
            }

            const csv = await analyticsManager.exportToCSV(chatbotId, startDate, endDate);

            if (!csv) {
                return res.status(404).json({
                    success: false,
                    error: 'Nenhum dado encontrado para o período'
                });
            }

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=analytics-${chatbotId}.csv`);
            res.send(csv);
        } catch (error) {
            console.error('❌ Erro ao exportar analytics:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao exportar analytics'
            });
        }
    });

    // ===== ROTA: Estatísticas do Tenant para Dashboard =====
    // SAFE PATCH - BUG-DASH-001: Corrige contador de assistentes ativos

    /**
     * GET /api/tenant-stats
     * Retorna estatísticas do tenant para o dashboard
     */
    app.get('/api/tenant-stats', async (req, res) => {
        const FEATURE_TENANT_STATS_API = true;

        // Feature flag: se desativado, retorna zeros (comportamento original)
        if (!FEATURE_TENANT_STATS_API) {
            return res.json({
                success: true,
                stats: { activeAssistants: 0, createdToday: 0, totalLeads: 0, leadsToday: 0 }
            });
        }

        try {
            const { apiKey } = req.query;

            // Sem API Key, retornar zeros (comportamento original mantido)
            if (!apiKey) {
                return res.json({
                    success: true,
                    stats: { activeAssistants: 0, createdToday: 0, totalLeads: 0, leadsToday: 0 }
                });
            }

            // Buscar short URLs (assistentes) do tenant
            let activeAssistants = 0;
            let createdToday = 0;
            let totalLeads = 0;
            let leadsToday = 0;

            try {
                const shortUrls = await DatabaseHelpers.getShortUrlsByApiKey(apiKey);
                // SAFE PATCH - BUG-DASH-002: Filtrar apenas assistentes ativos (excluir soft-deleted)
                const activeUrls = shortUrls.filter(s => s.status === 'active' || !s.status);
                activeAssistants = activeUrls.length;

                // Contar criados hoje (apenas ativos)
                const today = new Date().toISOString().split('T')[0];
                createdToday = activeUrls.filter(s =>
                    s.created_at && s.created_at.toString().startsWith(today)
                ).length;
            } catch (err) {
                console.warn('⚠️ Erro ao buscar assistentes:', err.message);
                // Fallback: manter zeros
            }

            try {
                // SAFE PATCH - BUG-LEADS-002: Buscar leads via getLeadSystem (mesma fonte que /admin/leads)
                if (getLeadSystem) {
                    const leadSystem = getLeadSystem(apiKey);
                    const leads = leadSystem.getLeads();
                    totalLeads = leads.length;

                    const today = new Date().toISOString().split('T')[0];
                    leadsToday = leads.filter(l => {
                        const ts = l.timestamp || l.created_at || l.lastInteraction;
                        return ts && ts.toString().startsWith(today);
                    }).length;
                } else {
                    // Fallback: usar DatabaseHelpers se módulo de leads indisponível
                    const leads = await DatabaseHelpers.getLeads(apiKey);
                    totalLeads = leads.length;
                    const today = new Date().toISOString().split('T')[0];
                    leadsToday = leads.filter(l =>
                        l.created_at && l.created_at.toString().startsWith(today)
                    ).length;
                }
            } catch (err) {
                console.warn('⚠️ Erro ao buscar leads:', err.message);
                // Fallback: manter zeros
            }

            console.log(`📊 Stats for tenant ${apiKey.substring(0, 8)}...: ${activeAssistants} assistants, ${totalLeads} leads`);

            res.json({
                success: true,
                stats: {
                    activeAssistants,
                    createdToday,
                    totalLeads,
                    leadsToday
                }
            });

        } catch (error) {
            console.error('❌ Erro ao buscar tenant stats:', error);
            // Fallback seguro: retornar zeros (comportamento original)
            res.json({
                success: true,
                stats: { activeAssistants: 0, createdToday: 0, totalLeads: 0, leadsToday: 0 }
            });
        }
    });

    // ===== ROTAS DE WEBHOOKS =====

    /**
     * POST /api/webhooks/:chatbotId
     * Registrar novo webhook
     */
    app.post('/api/webhooks/:chatbotId', async (req, res) => {
        try {
            const { chatbotId } = req.params;
            const { eventType, url, secret, headers } = req.body;

            if (!eventType || !url) {
                return res.status(400).json({
                    success: false,
                    error: 'eventType e url são obrigatórios'
                });
            }

            const webhook = webhookManager.registerWebhook(chatbotId, eventType, url, {
                secret,
                headers
            });

            res.json({
                success: true,
                webhook
            });
        } catch (error) {
            console.error('❌ Erro ao registrar webhook:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao registrar webhook'
            });
        }
    });

    /**
     * GET /api/webhooks/:chatbotId
     * Listar webhooks de um chatbot
     */
    app.get('/api/webhooks/:chatbotId', (req, res) => {
        try {
            const { chatbotId } = req.params;
            const webhooks = webhookManager.listWebhooks(chatbotId);

            res.json({
                success: true,
                webhooks
            });
        } catch (error) {
            console.error('❌ Erro ao listar webhooks:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao listar webhooks'
            });
        }
    });

    /**
     * DELETE /api/webhooks/:chatbotId/:webhookId
     * Remover webhook
     */
    app.delete('/api/webhooks/:chatbotId/:webhookId', (req, res) => {
        try {
            const { chatbotId, webhookId } = req.params;
            const removed = webhookManager.removeWebhook(chatbotId, webhookId);

            if (removed) {
                res.json({
                    success: true,
                    message: 'Webhook removido com sucesso'
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Webhook não encontrado'
                });
            }
        } catch (error) {
            console.error('❌ Erro ao remover webhook:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao remover webhook'
            });
        }
    });

    /**
     * POST /api/webhooks/:chatbotId/:webhookId/test
     * Testar webhook
     */
    app.post('/api/webhooks/:chatbotId/:webhookId/test', async (req, res) => {
        try {
            const { chatbotId, webhookId } = req.params;
            const webhooks = webhookManager.listWebhooks(chatbotId);
            const webhook = webhooks.find(w => w.id === webhookId);

            if (!webhook) {
                return res.status(404).json({
                    success: false,
                    error: 'Webhook não encontrado'
                });
            }

            const result = await webhookManager.testWebhook(webhook);

            res.json({
                success: result.success,
                result
            });
        } catch (error) {
            console.error('❌ Erro ao testar webhook:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao testar webhook'
            });
        }
    });

    // ===== ROTAS DE BILLING =====

    /**
     * GET /api/plans
     * Listar todos os planos disponíveis
     */
    app.get('/api/plans', (req, res) => {
        try {
            const plans = billingManager.listPlans();

            res.json({
                success: true,
                plans
            });
        } catch (error) {
            console.error('❌ Erro ao listar planos:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao listar planos'
            });
        }
    });

    /**
     * GET /api/subscription/:userId
     * Obter assinatura de um usuário
     */
    app.get('/api/subscription/:userId', async (req, res) => {
        try {
            const { userId } = req.params;
            const subscription = await billingManager.getSubscription(userId);
            const usage = billingManager.getUsage(userId);
            const limits = await billingManager.getRemainingLimits(userId);

            res.json({
                success: true,
                subscription,
                usage,
                limits
            });
        } catch (error) {
            console.error('❌ Erro ao obter assinatura:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao obter assinatura'
            });
        }
    });

    /**
     * POST /api/subscription/:userId/upgrade
     * Fazer upgrade de plano
     */
    app.post('/api/subscription/:userId/upgrade', async (req, res) => {
        try {
            const { userId } = req.params;
            const { planId } = req.body;

            if (!planId) {
                return res.status(400).json({
                    success: false,
                    error: 'planId é obrigatório'
                });
            }

            const subscription = await billingManager.upgradePlan(userId, planId);

            res.json({
                success: true,
                subscription
            });
        } catch (error) {
            console.error('❌ Erro ao fazer upgrade:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * POST /api/subscription/:userId/checkout
     * Criar sessão de checkout
     */
    app.post('/api/subscription/:userId/checkout', async (req, res) => {
        try {
            const { userId } = req.params;
            const { planId, successUrl, cancelUrl } = req.body;

            if (!planId || !successUrl || !cancelUrl) {
                return res.status(400).json({
                    success: false,
                    error: 'planId, successUrl e cancelUrl são obrigatórios'
                });
            }

            const session = await billingManager.createCheckoutSession(
                userId,
                planId,
                successUrl,
                cancelUrl
            );

            res.json({
                success: true,
                sessionId: session.id,
                url: session.url
            });
        } catch (error) {
            console.error('❌ Erro ao criar checkout:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    /**
     * POST /api/webhooks/stripe
     * Webhook do Stripe
     */
    app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
        try {
            const sig = req.headers['stripe-signature'];
            const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

            if (!webhookSecret) {
                console.error('❌ STRIPE_WEBHOOK_SECRET não configurado');
                return res.status(500).send('Webhook secret not configured');
            }

            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

            await billingManager.handleStripeWebhook(event);

            res.json({ received: true });
        } catch (error) {
            console.error('❌ Erro no webhook Stripe:', error);
            res.status(400).send(`Webhook Error: ${error.message}`);
        }
    });

    /**
     * GET /api/billing/limits
     * Obter limites de billing do tenant autenticado
     * SAFE PATCH - QA FIX: BUG-003
     */
    app.get('/api/billing/limits', async (req, res) => {
        try {
            // Obter API Key da sessão para identificar o tenant
            const apiKey = req.session?.validatedApiKey || req.headers['x-api-key'];

            if (!apiKey) {
                return res.status(401).json({
                    success: false,
                    error: 'Não autenticado'
                });
            }

            // Usar API Key como userId para o billingManager
            const userId = apiKey;

            const subscription = await billingManager.getSubscription(userId);
            const usage = billingManager.getUsage(userId);
            const limits = await billingManager.getRemainingLimits(userId);

            res.json({
                success: true,
                planName: subscription.plan?.name || 'Gratuito',
                planId: subscription.planId || 'free',
                limits: {
                    messages: {
                        limit: limits.messages?.limit ?? 100,
                        used: limits.messages?.used ?? 0,
                        remaining: limits.messages?.remaining ?? 100
                    },
                    extractions: {
                        limit: limits.extractions?.limit ?? 10,
                        used: limits.extractions?.used ?? 0,
                        remaining: limits.extractions?.remaining ?? 10
                    },
                    chatbots: {
                        limit: subscription.plan?.features?.maxChatbots ?? 1
                    }
                },
                usage: usage
            });
        } catch (error) {
            console.error('❌ Erro ao obter limites de billing:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao obter limites'
            });
        }
    });

    // ===== ROTAS DE KNOWLEDGE BASE =====

    /**
     * POST /api/knowledge/:chatbotId/faq
     * Adicionar FAQ
     */
    app.post('/api/knowledge/:chatbotId/faq', (req, res) => {
        try {
            const { chatbotId } = req.params;
            const { question, answer, category } = req.body;

            if (!question || !answer) {
                return res.status(400).json({
                    success: false,
                    error: 'question e answer são obrigatórios'
                });
            }

            const faq = knowledgeBaseManager.addFAQ(chatbotId, question, answer, category);

            res.json({
                success: true,
                faq
            });
        } catch (error) {
            console.error('❌ Erro ao adicionar FAQ:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao adicionar FAQ'
            });
        }
    });

    /**
     * POST /api/knowledge/:chatbotId/faqs/bulk
     * Adicionar múltiplas FAQs
     */
    app.post('/api/knowledge/:chatbotId/faqs/bulk', (req, res) => {
        try {
            const { chatbotId } = req.params;
            const { faqs } = req.body;

            if (!Array.isArray(faqs)) {
                return res.status(400).json({
                    success: false,
                    error: 'faqs deve ser um array'
                });
            }

            const addedFaqs = knowledgeBaseManager.addMultipleFAQs(chatbotId, faqs);

            res.json({
                success: true,
                count: addedFaqs.length,
                faqs: addedFaqs
            });
        } catch (error) {
            console.error('❌ Erro ao adicionar FAQs:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao adicionar FAQs'
            });
        }
    });

    /**
     * POST /api/knowledge/:chatbotId/document
     * Adicionar documento
     */
    app.post('/api/knowledge/:chatbotId/document', (req, res) => {
        try {
            const { chatbotId } = req.params;
            const { title, content, metadata } = req.body;

            if (!title || !content) {
                return res.status(400).json({
                    success: false,
                    error: 'title e content são obrigatórios'
                });
            }

            const document = knowledgeBaseManager.addDocument(chatbotId, title, content, metadata);

            res.json({
                success: true,
                document
            });
        } catch (error) {
            console.error('❌ Erro ao adicionar documento:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao adicionar documento'
            });
        }
    });

    /**
     * GET /api/knowledge/:chatbotId
     * Obter base de conhecimento completa
     */
    app.get('/api/knowledge/:chatbotId', async (req, res) => {
        try {
            const { chatbotId } = req.params;

            // SAFE PATCH - BUG-FAQ-003: Tentar PostgreSQL primeiro (persistente)
            let kb = knowledgeBaseManager.getKnowledgeBase(chatbotId);

            // Se não está em cache, tentar carregar do PostgreSQL diretamente
            if (!kb && knowledgeBaseManager.usePostgres) {
                kb = await knowledgeBaseManager.loadFromPostgres(chatbotId);
            }

            // Se ainda não existe, auto-inicializar com FAQs de exemplo
            if (!kb) {
                kb = knowledgeBaseManager.initializeKnowledgeBase(chatbotId);
                console.log(`📚 [Knowledge] KB auto-inicializada para: ${chatbotId.substring(0, 8)}...`);
            }

            res.json({
                success: true,
                knowledgeBase: kb
            });
        } catch (error) {
            console.error('❌ Erro ao obter base de conhecimento:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao obter base de conhecimento'
            });
        }
    });

    /**
     * GET /api/knowledge/:chatbotId/stats
     * Obter estatísticas da base de conhecimento
     */
    app.get('/api/knowledge/:chatbotId/stats', (req, res) => {
        try {
            const { chatbotId } = req.params;
            const stats = knowledgeBaseManager.getStats(chatbotId);

            res.json({
                success: true,
                stats
            });
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao obter estatísticas'
            });
        }
    });

    /**
     * DELETE /api/knowledge/:chatbotId/:entryType/:entryId
     * Remover entrada da base de conhecimento
     */
    app.delete('/api/knowledge/:chatbotId/:entryType/:entryId', (req, res) => {
        try {
            const { chatbotId, entryType, entryId } = req.params;
            const removed = knowledgeBaseManager.removeEntry(chatbotId, entryId, entryType);

            if (removed) {
                res.json({
                    success: true,
                    message: 'Entrada removida com sucesso'
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'Entrada não encontrada'
                });
            }
        } catch (error) {
            console.error('❌ Erro ao remover entrada:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao remover entrada'
            });
        }
    });

    // ===== ROTAS DE OTIMIZAÇÃO LLM =====

    /**
     * GET /api/llm/stats/:chatbotId
     * Obter estatísticas de uso de LLM
     */
    app.get('/api/llm/stats/:chatbotId', (req, res) => {
        try {
            const { chatbotId } = req.params;
            const { days = 30 } = req.query;

            const stats = llmOptimizer.getUsageStats(chatbotId, parseInt(days));
            const savings = llmOptimizer.getSavingsSummary(chatbotId);
            const cacheStats = llmOptimizer.getCacheStats();

            res.json({
                success: true,
                usage: stats,
                savings,
                cache: cacheStats
            });
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas LLM:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao obter estatísticas'
            });
        }
    });

    // ===== ROTAS DE CACHE =====

    /**
     * GET /api/cache/stats
     * Obter estatísticas do cache
     */
    app.get('/api/cache/stats', async (req, res) => {
        try {
            const stats = await CacheManager.getCacheStats();

            res.json({
                success: true,
                stats
            });
        } catch (error) {
            console.error('❌ Erro ao obter estatísticas do cache:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao obter estatísticas'
            });
        }
    });

    /**
     * POST /api/cache/clear
     * Limpar cache
     */
    app.post('/api/cache/clear', async (req, res) => {
        try {
            const { pattern } = req.body;

            let cleared;
            if (pattern) {
                cleared = await CacheManager.clearCacheByPattern(pattern);
            } else {
                cleared = await CacheManager.clearAllCache();
            }

            res.json({
                success: true,
                message: 'Cache limpo com sucesso',
                cleared
            });
        } catch (error) {
            console.error('❌ Erro ao limpar cache:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao limpar cache'
            });
        }
    });

    // ===== ROTA DE STATUS DO SISTEMA =====

    /**
     * GET /api/system/status
     * Obter status de todos os sistemas
     */
    app.get('/api/system/status', async (req, res) => {
        try {
            const status = {
                server: 'online',
                timestamp: new Date().toISOString(),
                database: {
                    type: USE_POSTGRES ? 'PostgreSQL' : 'SQLite',
                    connected: true
                },
                cache: {
                    type: isRedisConnected() ? 'Redis' : 'In-Memory',
                    connected: true,
                    stats: await CacheManager.getCacheStats()
                },
                webhooks: webhookManager.getStats(),
                features: {
                    billing: !!process.env.STRIPE_SECRET_KEY,
                    webhooks: true,
                    analytics: true,
                    llmOptimization: true,
                    knowledgeBase: true
                }
            };

            res.json({
                success: true,
                status
            });
        } catch (error) {
            console.error('❌ Erro ao obter status:', error);
            res.status(500).json({
                success: false,
                error: 'Erro ao obter status'
            });
        }
    });

    // ===== ROTAS DE ASSISTENTES (Meus Assistentes) =====

    /**
     * GET /api/assistants
     * Listar assistentes do tenant (lê de short_urls)
     */
    app.get('/api/assistants', async (req, res) => {
        try {
            const apiKey = req.session?.validatedApiKey || req.query.apiKey;
            if (!apiKey) {
                return res.status(401).json({ success: false, error: 'API Key não fornecida' });
            }

            // Feature flag check (fallback seguro: permite acesso se flag indisponível)
            try {
                if (featureFlags && typeof featureFlags.isEnabled === 'function' && featureFlags.isEnabled('FEATURE_MEUS_ASSISTENTES') === false) {
                    return res.status(403).json({ success: false, error: 'Funcionalidade desabilitada' });
                }
            } catch (ffErr) {
                console.warn('🤖 [Assistentes] Feature flag check falhou, permitindo acesso (fallback):', ffErr.message);
            }

            const shortUrls = await DatabaseHelpers.getShortUrlsByApiKey(apiKey);

            // Filter active only and map to frontend format
            const assistants = shortUrls
                .filter(s => s.status === 'active' || !s.status)
                .map(s => ({
                    id: s.id,
                    name: s.robot_name || s.short_code,
                    shortUrl: `${req.protocol}://${req.get('host')}/s/${s.short_code}`,
                    salesUrl: s.sales_url || '',
                    instructions: s.instructions || '',
                    accessCount: s.access_count || 0,
                    createdAt: s.created_at,
                    status: s.status || 'active'
                }));

            // SAFE PATCH - BUG-LEADS-002: Incluir contagem de leads do tenant (mesma fonte que /admin/leads)
            let totalLeads = 0;
            try {
                if (getLeadSystem) {
                    const leadSystem = getLeadSystem(apiKey);
                    const leads = leadSystem.getLeads();
                    totalLeads = leads ? leads.length : 0;
                } else {
                    // Fallback: DatabaseHelpers
                    const leads = await DatabaseHelpers.getLeads(apiKey);
                    totalLeads = leads ? leads.length : 0;
                }
            } catch (leadsErr) {
                console.warn('⚠️ Erro ao buscar leads para assistentes:', leadsErr.message);
            }

            res.json({ success: true, assistants, total: assistants.length, totalLeads });
        } catch (error) {
            console.error('❌ Erro ao listar assistentes:', error);
            res.status(500).json({ success: false, error: 'Erro ao carregar assistentes' });
        }
    });

    /**
     * DELETE /api/assistants/:id
     * Remover assistente (soft-delete no short_urls)
     */
    app.delete('/api/assistants/:id', async (req, res) => {
        try {
            const apiKey = req.session?.validatedApiKey || req.query.apiKey;
            if (!apiKey) {
                return res.status(401).json({ success: false, error: 'API Key não fornecida' });
            }

            try {
                if (featureFlags && typeof featureFlags.isEnabled === 'function' && featureFlags.isEnabled('FEATURE_MEUS_ASSISTENTES') === false) {
                    return res.status(403).json({ success: false, error: 'Funcionalidade desabilitada' });
                }
            } catch (ffErr) {
                console.warn('🤖 [Assistentes] Feature flag check falhou, permitindo acesso (fallback):', ffErr.message);
            }

            const { id } = req.params;
            const removed = await DatabaseHelpers.deleteShortUrl(apiKey, id);

            if (!removed) {
                return res.status(404).json({ success: false, error: 'Assistente não encontrado' });
            }

            // ===== 🧹 LIMPEZA COMPLETA DE DADOS ASSOCIADOS =====
            // Cada bloco em try/catch isolado — se um falhar, os demais continuam
            const cleanup = { leads: 0, whitelabel: false, appointments: 0, structuredLeads: 0, knowledgeBase: 0, crm: 0 };
            const robotName = removed.robot_name;
            const shortCode = removed.short_code;

            // 1. 🎯 Limpar Leads (JSON + PostgreSQL)
            try {
                if (getLeadSystem && robotName) {
                    const leadSystem = getLeadSystem(apiKey);
                    if (leadSystem && typeof leadSystem.deleteLeadsByRobotName === 'function') {
                        cleanup.leads = leadSystem.deleteLeadsByRobotName(robotName);
                    }
                }
            } catch (err) {
                console.warn('⚠️ Limpeza de leads falhou (não crítico):', err.message);
            }

            // 2. 🎨 Limpar Whitelabel
            try {
                const { whitelabelManager } = require('./whitelabel');
                if (whitelabelManager && typeof whitelabelManager.removeSettings === 'function') {
                    await whitelabelManager.removeSettings(apiKey);
                    cleanup.whitelabel = true;
                }
            } catch (err) {
                console.warn('⚠️ Limpeza de whitelabel falhou (não crítico):', err.message);
            }

            // 3. 📅 Limpar Agendamentos (PostgreSQL)
            try {
                const delApptQuery = USE_POSTGRES
                    ? `DELETE FROM tenant_appointments WHERE api_key = $1`
                    : `DELETE FROM tenant_appointments WHERE api_key = ?`;
                const apptResult = await DatabaseHelpers.run(delApptQuery, [apiKey]);
                cleanup.appointments = apptResult?.changes || 0;
            } catch (err) {
                console.warn('⚠️ Limpeza de agendamentos falhou (não crítico):', err.message);
            }

            // 4. 📋 Limpar Leads Estruturados (structured_leads)
            try {
                const { structuredLeadsManager } = require('./structured-leads');
                if (structuredLeadsManager && typeof structuredLeadsManager.removeSettings === 'function') {
                    await structuredLeadsManager.removeSettings(apiKey);
                }
                // Fallback direto no banco
                const delStructQuery = USE_POSTGRES
                    ? `DELETE FROM structured_leads WHERE chatbot_id = $1`
                    : `DELETE FROM structured_leads WHERE chatbot_id = ?`;
                const structResult = await DatabaseHelpers.run(delStructQuery, [apiKey]);
                cleanup.structuredLeads = structResult?.changes || 0;
            } catch (err) {
                // Tabela pode não existir — ignorar silenciosamente
                console.warn('⚠️ Limpeza de leads estruturados falhou (não crítico):', err.message);
            }

            // 5. 📚 Limpar Knowledge Base
            try {
                const { knowledgeBaseManager } = require('./knowledge-base');
                if (knowledgeBaseManager && typeof knowledgeBaseManager.deleteByAssistant === 'function') {
                    await knowledgeBaseManager.deleteByAssistant(apiKey);
                }
                // Fallback direto no banco
                const delKbQuery = USE_POSTGRES
                    ? `DELETE FROM knowledge_base WHERE chatbot_id = $1`
                    : `DELETE FROM knowledge_base WHERE chatbot_id = ?`;
                const kbResult = await DatabaseHelpers.run(delKbQuery, [apiKey]);
                cleanup.knowledgeBase = kbResult?.changes || 0;
            } catch (err) {
                console.warn('⚠️ Limpeza de Knowledge Base falhou (não crítico):', err.message);
            }

            // 6. 📊 Limpar CRM/Pipeline (leads CRM, atividades, deals, follow-up)
            try {
                // Buscar tenant_id via api_key
                const tenantQuery = USE_POSTGRES
                    ? `SELECT t.id FROM tenants t JOIN api_keys ak ON ak.tenant_id = t.id WHERE ak.key_hash = $1 LIMIT 1`
                    : `SELECT tenant_uuid as id FROM tenant_leads WHERE api_key = ? LIMIT 1`;
                const crypto = require('crypto');
                const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
                const tenantResult = await DatabaseHelpers.get(
                    USE_POSTGRES ? tenantQuery : tenantQuery.replace('$1', '?'),
                    USE_POSTGRES ? [keyHash] : [apiKey]
                );
                const tenantId = tenantResult?.id;

                if (tenantId) {
                    // Deletar follow-up jobs e logs primeiro (dependências)
                    try {
                        const delJobsQuery = USE_POSTGRES
                            ? `DELETE FROM followup_jobs WHERE tenant_id = $1`
                            : `DELETE FROM followup_jobs WHERE tenant_id = ?`;
                        await DatabaseHelpers.run(delJobsQuery, [tenantId]);
                    } catch (e) { /* tabela pode não existir */ }

                    try {
                        const delRulesQuery = USE_POSTGRES
                            ? `DELETE FROM followup_rules WHERE tenant_id = $1`
                            : `DELETE FROM followup_rules WHERE tenant_id = ?`;
                        await DatabaseHelpers.run(delRulesQuery, [tenantId]);
                    } catch (e) { /* tabela pode não existir */ }

                    // Deletar atividades CRM
                    try {
                        const delActQuery = USE_POSTGRES
                            ? `DELETE FROM crm_activities WHERE tenant_id = $1`
                            : `DELETE FROM crm_activities WHERE tenant_id = ?`;
                        await DatabaseHelpers.run(delActQuery, [tenantId]);
                    } catch (e) { /* tabela pode não existir */ }

                    // Deletar deals CRM
                    try {
                        const delDealsQuery = USE_POSTGRES
                            ? `DELETE FROM crm_deals WHERE tenant_id = $1`
                            : `DELETE FROM crm_deals WHERE tenant_id = ?`;
                        await DatabaseHelpers.run(delDealsQuery, [tenantId]);
                    } catch (e) { /* tabela pode não existir */ }

                    // Deletar leads CRM
                    try {
                        const delCrmLeadsQuery = USE_POSTGRES
                            ? `DELETE FROM crm_leads WHERE tenant_id = $1`
                            : `DELETE FROM crm_leads WHERE tenant_id = ?`;
                        const crmResult = await DatabaseHelpers.run(delCrmLeadsQuery, [tenantId]);
                        cleanup.crm = crmResult?.changes || 0;
                    } catch (e) { /* tabela pode não existir */ }

                    // Deletar stages e pipelines CRM
                    try {
                        const delStagesQuery = USE_POSTGRES
                            ? `DELETE FROM crm_stages WHERE pipeline_id IN (SELECT id FROM crm_pipelines WHERE tenant_id = $1)`
                            : `DELETE FROM crm_stages WHERE pipeline_id IN (SELECT id FROM crm_pipelines WHERE tenant_id = ?)`;
                        await DatabaseHelpers.run(delStagesQuery, [tenantId]);
                        const delPipelineQuery = USE_POSTGRES
                            ? `DELETE FROM crm_pipelines WHERE tenant_id = $1`
                            : `DELETE FROM crm_pipelines WHERE tenant_id = ?`;
                        await DatabaseHelpers.run(delPipelineQuery, [tenantId]);
                    } catch (e) { /* tabela pode não existir */ }

                    // Deletar automações e webhooks CRM
                    try {
                        await DatabaseHelpers.run(
                            USE_POSTGRES ? `DELETE FROM crm_automation_rules WHERE tenant_id = $1` : `DELETE FROM crm_automation_rules WHERE tenant_id = ?`,
                            [tenantId]
                        );
                        await DatabaseHelpers.run(
                            USE_POSTGRES ? `DELETE FROM crm_webhooks WHERE tenant_id = $1` : `DELETE FROM crm_webhooks WHERE tenant_id = ?`,
                            [tenantId]
                        );
                    } catch (e) { /* tabelas podem não existir */ }
                }
            } catch (err) {
                console.warn('⚠️ Limpeza de CRM/Pipeline falhou (não crítico):', err.message);
            }

            // 7. 🗄️ Limpar tenant_leads restantes no PostgreSQL (que não tenham robotName)
            try {
                if (USE_POSTGRES) {
                    const delAllLeadsQuery = `DELETE FROM tenant_leads WHERE api_key = $1`;
                    await DatabaseHelpers.run(delAllLeadsQuery, [apiKey]);
                }
            } catch (err) {
                console.warn('⚠️ Limpeza final de tenant_leads falhou (não crítico):', err.message);
            }

            console.log(`🗑️ EXCLUSÃO COMPLETA do assistente: ${robotName || shortCode} (tenant ${apiKey.substring(0, 8)}...)`, cleanup);
            res.json({
                success: true,
                message: 'Assistente e todos os dados associados removidos permanentemente',
                removedId: id,
                cleanup
            });
        } catch (error) {
            console.error('❌ Erro ao remover assistente:', error);
            res.status(500).json({ success: false, error: 'Erro ao remover assistente' });
        }
    });

    console.log('✅ Novas rotas de API configuradas');
}

module.exports = { setupRoutes };
