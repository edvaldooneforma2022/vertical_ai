/**
 * 📱 WHATSAPP CHANNEL - Link Mágico V21
 * Canal PURO de transporte — consome o mesmo endpoint do Link Curto
 *
 * SAFE PATCH - WA-CHANNEL-002 (V21 PARITY)
 *
 * PRINCÍPIO: Canal ≠ Inteligência
 * WhatsApp apenas: recebe → resolve tenant → envia ao Unified Brain → entrega resposta
 * Toda decisão comercial (intent, journey, CTA, captura, agendamento) vem do pipeline central.
 *
 * NÃO ALTERA: server.js, motores de IA, prompts, CRM core,
 * pipeline, analytics core, billing core, widget, link curto.
 *
 * Provedores:
 *   Fase 2A — Evolution API (principal)
 *   Fase 2B — Meta Cloud API (futuro)
 *   Fase 2C — Twilio (compatibilidade)
 */

const http = require('http');
const crypto = require('crypto');

// ════════════════════════════════════════════════════════════════
// V21 PARITY: Auditoria de paridade WhatsApp ↔ Link Curto
// ════════════════════════════════════════════════════════════════
let waParityAudit = null;
try {
    waParityAudit = require('./lib/wa-parity-audit');
    console.log('📊 [WA-PARITY] Módulo de auditoria V21 carregado');
} catch (_auditLoadErr) {
    console.warn('📊 [WA-PARITY] Auditoria não disponível (sem impacto):', _auditLoadErr.message);
    waParityAudit = { log: () => {} }; // stub silencioso
}

// ============================================================
// CONSTANTES
// ============================================================
const WA_MSG_MAX_LEN    = 4096;
const RATE_LIMIT_MAX    = 30;       // msgs por minuto por telefone
const RATE_LIMIT_WINDOW = 60000;    // 1 minuto
const TENANT_CACHE_TTL  = 300000;   // 5 minutos
const AI_TIMEOUT        = 30000;    // 30 segundos para resposta da IA

// ════════════════════════════════════════════════════════════════
// V21 FEATURE FLAG: Rollback instantâneo para pipeline anterior
// WA_USE_FULL_PIPELINE=true  → /api/process-chat-inteligente (Link Curto)
// WA_USE_FULL_PIPELINE=false → /api/chat-universal (legado)
// ════════════════════════════════════════════════════════════════
const WA_USE_FULL_PIPELINE = process.env.WA_USE_FULL_PIPELINE !== 'false';

// ============================================================
// CLASSE PRINCIPAL
// ============================================================
class WhatsAppChannel {

    /**
     * @param {Object} deps - Dependências injetadas
     * @param {Object} deps.db            - Instância do banco
     * @param {boolean} deps.USE_POSTGRES - Flag PostgreSQL
     * @param {Function} deps.getLeadSystem - Factory de LeadCaptureSystem
     * @param {Object} deps.whatsappManager - whatsapp-integration singleton
     * @param {Object} deps.analytics       - Objeto de analytics global
     */
    constructor(deps) {
        this.db            = deps.db;
        this.USE_POSTGRES  = deps.USE_POSTGRES;
        this.getLeadSystem = deps.getLeadSystem;
        this.whatsappMgr   = deps.whatsappManager;
        this.analytics     = deps.analytics;
        this.serverPort    = parseInt(process.env.PORT, 10) || 3000;

        // Caches
        this._tenantCache  = new Map();   // instanceName → { apiKey, ... }
        this._rateLimits   = new Map();   // phone → [timestamps]

        console.log('📱 [WA-CHANNEL] Módulo de canal WhatsApp inicializado');
    }

    // ============================================================
    // REGISTRO DE ROTAS (chamado pelo server.js)
    // ============================================================
    registerRoutes(app) {
        // ── Webhooks de entrada ──
        app.post('/api/webhook/evolution', (req, res) => this._handleEvolutionWebhook(req, res));
        app.post('/api/webhook/twilio',    (req, res) => this._handleTwilioWebhook(req, res));

        // ── Status do canal ──
        app.get('/api/whatsapp/channel/status', (req, res) => {
            res.json({
                channel: 'whatsapp',
                active: true,
                providers: ['evolution', 'twilio'],
                version: 'WA-CHANNEL-001'
            });
        });

        console.log('📱 [WA-CHANNEL] Rotas de webhook registradas: /api/webhook/evolution, /api/webhook/twilio');
    }

    // ============================================================
    // WEBHOOK — EVOLUTION API  (Fase 2A)
    // ============================================================
    async _handleEvolutionWebhook(req, res) {
        // Ack imediato — Evolution reenvia se não receber 200 rápido
        res.status(200).json({ received: true });

        try {
            const body = req.body || {};

            // ═══ OBSERVABILIDADE: log permanente ═══
            console.log(`📱 [WA-WEBHOOK] ══════════════════════════════════════`);
            console.log(`📱 [WA-WEBHOOK] POST /api/webhook/evolution RECEBIDO`);
            console.log(`📱 [WA-WEBHOOK] Body keys: ${Object.keys(body).join(', ')}`);
            console.log(`📱 [WA-WEBHOOK] Body (1500 chars): ${JSON.stringify(body).substring(0, 1500)}`);

            // ═══ EXTRAIR CAMPOS COMUNS ═══
            const event    = body.event || body.type || '';
            const instance = body.instanceName || body.instance || body.instance_name || '';

            console.log(`📱 [WA-WEBHOOK] event='${event}' instance='${instance}'`);

            // ═══ FILTRAR EVENTOS ═══
            // Evolution Go v0.7.1 envia event='Message'
            // Evolution API v1 envia event='messages.upsert'
            const eventLower = (event || '').toLowerCase();
            const isMessageEvent = eventLower === 'message' || eventLower === 'messages.upsert'
                || eventLower === 'messages_upsert';

            if (!isMessageEvent) {
                console.log(`📱 [WA-WEBHOOK] Evento ignorado: '${event}'`);
                return;
            }

            const data = body.data || {};

            // ═══ EXTRAIR METADADOS DA MENSAGEM ═══
            // Evolution Go v0.7.1: data.Info.Chat, data.Info.IsFromMe, data.Info.ID, data.Info.IsGroup
            // Evolution API v1:    data.key.remoteJid, data.key.fromMe, data.key.id
            let remoteJid, isFromMe, isGroup, waMessageId;

            if (data.Info) {
                // ── Formato Evolution Go v0.7.1 ──
                remoteJid   = data.Info.Chat || '';
                isFromMe    = data.Info.IsFromMe === true;
                isGroup     = data.Info.IsGroup === true;
                waMessageId = data.Info.ID || '';
                console.log(`📱 [WA-WEBHOOK] Formato: Evolution Go v0.7.1`);
            } else if (data.key) {
                // ── Formato Evolution API v1 (fallback) ──
                remoteJid   = data.key.remoteJid || '';
                isFromMe    = data.key.fromMe === true;
                isGroup     = (remoteJid || '').endsWith('@g.us');
                waMessageId = data.key.id || '';
                console.log(`📱 [WA-WEBHOOK] Formato: Evolution API v1`);
            } else {
                console.log(`📱 [WA-WEBHOOK] ❌ Formato desconhecido — sem data.Info nem data.key`);
                console.log(`📱 [WA-WEBHOOK] data keys: ${Object.keys(data).join(', ')}`);
                return;
            }

            console.log(`📱 [WA-WEBHOOK] remoteJid='${remoteJid}' isFromMe=${isFromMe} isGroup=${isGroup}`);

            // Filtros
            if (isFromMe) {
                console.log(`📱 [WA-WEBHOOK] Mensagem fromMe — ignorando`);
                return;
            }
            if (isGroup) {
                console.log(`📱 [WA-WEBHOOK] Mensagem de grupo — ignorando`);
                return;
            }
            if (!remoteJid) {
                console.log(`📱 [WA-WEBHOOK] ❌ remoteJid vazio — descartando`);
                return;
            }

            // ═══ EXTRAIR TEXTO DA MENSAGEM ═══
            // Evolution Go v0.7.1: data.Message.conversation ou data.Message.extendedTextMessage.text
            // Evolution API v1:    data.message.conversation ou data.message.extendedTextMessage.text
            const msgObj = data.Message || data.message || {};
            const text = msgObj.conversation
                      || msgObj.extendedTextMessage?.text
                      || '';

            // ═══ EXTRAIR PHONE E PUSHNAME ═══
            const phone    = this._normalizePhone(remoteJid.replace('@s.whatsapp.net', ''));
            // Evolution Go v0.7.1: PushName está dentro de data.Info.PushName
            const pushName = data.Info?.PushName || data.PushName || data.pushName || body.pushName || '';

            console.log(`📱 [WA-WEBHOOK] phone='${phone}' pushName='${pushName}' text='${text.substring(0, 80)}'`);

            if (!phone || !text.trim()) {
                console.log(`📱 [WA-WEBHOOK] ❌ phone ou text vazio — descartando`);
                return;
            }

            console.log(`📱 [EVOLUTION MESSAGE RECEIVED] ${phone} (${pushName}): "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`);

            // Rate limit
            if (!this._checkRateLimit(phone)) {
                console.warn(`📱 [WA-CHANNEL] Rate limit excedido para ${phone}`);
                return;
            }

            // ═══ RESOLVER TENANT ═══
            console.log(`📱 [WA-WEBHOOK] Resolvendo tenant para instância: '${instance}'`);
            const tenant = await this._resolveTenantByInstance(instance);
            if (!tenant) {
                console.warn(`📱 [WA-CHANNEL] ❌ Instância desconhecida: "${instance}" — tenant não encontrado no DB`);
                return;
            }
            console.log(`📱 [EVOLUTION TENANT RESOLVED] apiKey=${tenant.apiKey?.substring(0, 12)}... mode=${tenant.channelMode}`);

            // ═══ PROCESSAR MENSAGEM ═══
            console.log(`📱 [EVOLUTION MESSAGE PROCESSING]`);
            await this._processIncomingMessage({
                apiKey:      tenant.apiKey,
                channelMode: tenant.channelMode,
                notifPhone:  tenant.notificationPhone,
                phone,
                pushName,
                text,
                waMessageId,
                provider:    'evolution',
                instanceName: instance,  // ← instância que recebeu
                instanceToken: body.instanceToken || ''  // ← token para autenticação
            });
            console.log(`📱 [EVOLUTION MESSAGE PROCESSED] ✅`);

        } catch (error) {
            console.error('📱 [WA-CHANNEL] ❌ Erro no webhook Evolution:', error.message, error.stack);
        }
    }

    // ============================================================
    // WEBHOOK — TWILIO  (Compatibilidade)
    // ============================================================
    async _handleTwilioWebhook(req, res) {
        res.status(200).send('<Response></Response>');  // TwiML ack

        try {
            const body = req.body || {};
            const from = body.From || '';  // whatsapp:+5511999998888
            const text = body.Body || '';
            const sid  = body.MessageSid || '';

            if (!from || !text.trim()) return;

            const phone = this._normalizePhone(from.replace('whatsapp:', ''));
            const pushName = body.ProfileName || '';

            console.log(`📱 [WA-IN-TWILIO] ${phone}: "${text.substring(0, 60)}"`);

            if (!this._checkRateLimit(phone)) return;

            // Resolver tenant pelo número Twilio que recebeu a mensagem
            const tenant = await this._resolveTenantByTwilioNumber(body.To || '');
            if (!tenant) {
                console.warn(`📱 [WA-CHANNEL] Número Twilio não mapeado: ${body.To}`);
                return;
            }

            await this._processIncomingMessage({
                apiKey:      tenant.apiKey,
                channelMode: tenant.channelMode,
                notifPhone:  tenant.notificationPhone,
                phone,
                pushName,
                text,
                waMessageId: sid,
                provider:    'twilio'
            });

        } catch (error) {
            console.error('📱 [WA-CHANNEL] Erro no webhook Twilio:', error.message);
        }
    }

    // ============================================================
    // PROCESSAMENTO UNIFICADO (todos os provedores convergem aqui)
    // ============================================================
    async _processIncomingMessage({ apiKey, channelMode, notifPhone, phone, pushName, text, waMessageId, provider, instanceName, instanceToken }) {
        try {
            // 1. Resolver ou criar lead pelo telefone
            const lead = await this._resolveLeadByPhone(apiKey, phone, pushName);
            // GARANTIA OMNICHANNEL (CENÁRIO B): Priorizar o conversationId do CRM (Widget) para unificar a memória da IA
            const conversationId = lead?.conversationId || this._makeConversationId(phone, apiKey);

            // 2. Registrar mensagem de entrada
            await this._logMessage({
                apiKey, waMessageId, waPhone: phone, direction: 'inbound',
                content: text, leadId: lead?.id, conversationId, provider
            });

            // 3. Atualizar histórico do lead
            if (lead) {
                try {
                    const ls = this.getLeadSystem(apiKey);
                    ls.updateLeadConversation(lead.id, text, true);
                } catch (e) { /* não bloqueia */ }
            }

            // 4. Incrementar analytics
            try {
                if (this.analytics) {
                    this.analytics.chatRequests = (this.analytics.chatRequests || 0) + 1;
                    if (this.analytics.activeChats) this.analytics.activeChats.add(conversationId);
                }
            } catch (e) { /* não bloqueia */ }

            // ── ⚫ DESLIGADO ──
            if (channelMode === 'off') {
                console.log(`📱 [WA-CHANNEL] Modo ⚫ Desligado — apenas notificação para dono`);
                await this._notifyOwner(apiKey, phone, pushName, text, notifPhone);
                return;
            }

            // ── ⚡ AUTOMÁTICO / 🎛️ MANUAL ──
            // V21 PARITY: Chamar o mesmo endpoint do Link Curto
            const aiResult = await this._callUnifiedBrain(apiKey, text, conversationId, lead?.id);

            if (!aiResult || !aiResult.response) {
                console.warn('📱 [WA-CHANNEL] IA sem resposta, enviando fallback');
                await this._sendResponse(apiKey, phone, 'Recebi sua mensagem! Em breve retornaremos.', provider, instanceName, instanceToken);
                return;
            }

            // Adaptar resposta para WhatsApp + injetar CTA/links inline
            let adapted = this._adaptForWhatsApp(aiResult.response);

            // ═══ INJETAR CTA COMO TEXTO (widget renderiza como botão, WA precisa inline) ═══
            try {
                // 1. CTA do pipeline central (V17.2 Link Resolver)
                if (aiResult.cta && aiResult.cta.url && !adapted.includes(aiResult.cta.url)) {
                    const ctaLabel = aiResult.cta.label || aiResult.cta.text || '🚀 Acesse aqui';
                    adapted += `\n\n${ctaLabel}\n👉 ${aiResult.cta.url}`;
                    console.log(`📱 [WA-CTA] Injetado CTA inline: ${aiResult.cta.url.substring(0, 60)}`);
                }

                // 2. Link de WhatsApp de contato (se houver)
                const waLink = aiResult.contatos?.whatsappLink || aiResult.contatos?.whatsappLinks?.[0];
                if (waLink && !adapted.includes(waLink) && !adapted.includes('wa.me')) {
                    adapted += `\n\n📱 Fale com a equipe: ${waLink}`;
                    console.log(`📱 [WA-CTA] Injetado WhatsApp link: ${waLink.substring(0, 60)}`);
                }
            } catch (ctaErr) {
                console.warn(`📱 [WA-CTA] Erro ao injetar CTA (sem impacto):`, ctaErr.message);
            }

            // ════════════════════════════════════════════════════════════════
            // V21 PARITY: TRADUZIR sinais do pipeline central para WhatsApp
            // O WhatsApp NÃO decide — apenas traduz o que o Link Curto decidiu
            // ════════════════════════════════════════════════════════════════
            try {
                // ── CAPTURA: Traduzir sinal de leadCapture para texto ──
                // O pipeline retorna shouldCapture=true quando o Lead Score atingiu
                // o threshold. O WhatsApp apenas converte isso em pergunta textual.
                // REGRA: Nenhuma lógica de captura própria — apenas tradução.
                if (aiResult.leadCapture && aiResult.leadCapture.shouldCapture && !lead?.email_captured) {
                    const captureMsg = aiResult.leadCapture.captureMessage
                        || '📋 Para que eu possa te ajudar melhor, posso saber seu nome?';
                    adapted += `\n\n${captureMsg}`;
                    console.log(`📱 [WA-V21-CAPTURE] Sinal de captura traduzido do pipeline central`);
                }

                // ── AGENDAMENTO: Traduzir calendarHash para URL amigável ──
                // O pipeline retorna calendarHash quando detecta intenção de agendamento.
                // No Link Curto, isso renderiza um widget calendário.
                // No WhatsApp, traduzimos para URL clicável.
                // REGRA: Agendamento só aparece APÓS captura (ordem do Link Curto).
                if (aiResult.calendarHash && !adapted.includes('/agendar/')) {
                    const hasLeadData = lead && (lead.email || lead.telefone || lead.wa_phone);
                    if (hasLeadData || (aiResult.leadCapture && !aiResult.leadCapture.shouldCapture)) {
                        // Lead já capturado OU pipeline não pediu captura → mostrar agendamento
                        const baseUrl = process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || 'https://linkmagico.app.br';
                        const scheduleUrl = `${baseUrl}/agendar/${aiResult.calendarHash}`;
                        adapted += `\n\n📅 Agende aqui:\n👉 ${scheduleUrl}`;
                        console.log(`📱 [WA-V21-SCHEDULE] Agendamento traduzido para URL: ${scheduleUrl.substring(0, 60)}`);
                    } else {
                        // Lead NÃO capturado E pipeline PEDIU captura → captura primeiro
                        // O agendamento aparecerá na próxima interação após captura
                        console.log(`📱 [WA-V21-SCHEDULE] Agendamento ADIADO — aguardando captura do lead (ordem: CAPTURA → AGENDAMENTO)`);
                    }
                }
            } catch (_v21TranslateErr) {
                console.warn(`📱 [WA-V21] Erro na tradução de sinais (sem impacto):`, _v21TranslateErr.message);
            }

            // Enviar resposta
            const sendResult = await this._sendResponse(apiKey, phone, adapted, provider, instanceName, instanceToken);

            // Registrar mensagem de saída
            if (sendResult?.success) {
                await this._logMessage({
                    apiKey, waMessageId: sendResult.messageId || '', waPhone: phone,
                    direction: 'outbound', content: adapted, leadId: lead?.id,
                    conversationId, provider
                });

                // Atualizar histórico com resposta da IA
                if (lead) {
                    try {
                        const ls = this.getLeadSystem(apiKey);
                        ls.updateLeadConversation(lead.id, adapted, false);
                    } catch (e) { /* não bloqueia */ }
                }
            }

            // ════════════════════════════════════════════════════════════════
            // V21 PARITY AUDIT: Registrar telemetria para comparação
            // ════════════════════════════════════════════════════════════════
            try {
                waParityAudit.log({
                    message: text,
                    channel: 'whatsapp',
                    conversationId,
                    leadId: lead?.id || '',
                    journeyStage: aiResult.journeyStage || 'N/A',
                    intentDetected: aiResult.inteligenciasDetectadas || {},
                    leadScore: aiResult.leadCapture?.score || 0,
                    ctaTriggered: !!(aiResult.cta && aiResult.cta.url),
                    captureTriggered: !!(aiResult.leadCapture && aiResult.leadCapture.shouldCapture),
                    scheduleTriggered: !!aiResult.calendarHash,
                    generateAIResponseExecuted: true,
                    responseSource: WA_USE_FULL_PIPELINE ? 'process-chat-inteligente' : 'chat-universal',
                    responsePreview: adapted?.substring(0, 120),
                    wouldMatchLinkCurto: WA_USE_FULL_PIPELINE
                });
            } catch (_auditErr) {
                // Auditoria NUNCA impacta o fluxo
            }

            console.log(`📱 [WA-OUT] ${phone}: enviado ${adapted.length} chars | cta=${!!(aiResult.cta && aiResult.cta.url)} | journey=${aiResult.journeyStage || 'N/A'} | capture=${!!(aiResult.leadCapture?.shouldCapture)} | schedule=${!!aiResult.calendarHash}`);

        } catch (error) {
            console.error('📱 [WA-CHANNEL] Erro ao processar mensagem:', error.message);
        }
    }

    // ============================================================
    // V21 PARITY: CHAMAR UNIFIED BRAIN VIA HTTP INTERNO
    // Mesmo endpoint do Link Curto: /api/process-chat-inteligente
    // Feature flag WA_USE_FULL_PIPELINE para rollback
    // (zero acoplamento — reutiliza toda a stack: auth, billing, IA, inteligências)
    // ============================================================
    async _callUnifiedBrain(apiKey, message, conversationId, leadId) {
        return new Promise(async (resolve) => {
            const timeout = setTimeout(() => {
                console.warn('📱 [WA-CHANNEL] Timeout da IA (30s)');
                resolve(null);
            }, AI_TIMEOUT);

            try {
                // ═══ BUSCAR TODOS os dados DO ASSISTENTE (idêntico ao link curto) ═══
                let salesUrl = null;
                let robotName = null;
                let instructions = null;
                let checkoutLink = null;
                let pageData = null;

                try {
                    if (this.USE_POSTGRES && this.db) {
                        // 1. Dados do assistente (short_urls) — mesma fonte do Link Curto
                        const urlResult = await this.db.query(
                            `SELECT sales_url, robot_name, instructions FROM short_urls WHERE api_key = $1 ORDER BY id DESC LIMIT 1`,
                            [apiKey]
                        );
                        const urlRow = (urlResult.rows || urlResult)[0];
                        if (urlRow) {
                            salesUrl = urlRow.sales_url || null;
                            robotName = urlRow.robot_name || null;
                            instructions = urlRow.instructions || null;
                        }

                        // 2. Checkout confirmado (checkout_links)
                        if (salesUrl) {
                            try {
                                const urlHash = crypto.createHash('md5').update(salesUrl).digest('hex').substring(0, 16);
                                const ckResult = await this.db.query(
                                    `SELECT checkout_url FROM checkout_links WHERE api_key = $1 AND url_hash = $2 AND confirmed = true LIMIT 1`,
                                    [apiKey, urlHash]
                                );
                                const ckRow = (ckResult.rows || ckResult)[0];
                                if (ckRow && ckRow.checkout_url) {
                                    checkoutLink = ckRow.checkout_url;
                                }
                            } catch (ckErr) {
                                console.warn(`📱 [WA-CHANNEL] Checkout DB lookup falhou:`, ckErr.message);
                            }
                        }

                        // 3. Extração do site (mesma que o Link Curto faz via extractPageData no /chatbot)
                        if (salesUrl) {
                            try {
                                const { extractPageData } = require('./server-utils') || {};
                                if (typeof extractPageData === 'function') {
                                    pageData = await extractPageData(salesUrl);
                                }
                            } catch (exErr) {
                                // extractPageData pode não estar disponível como módulo separado
                                // Nesse caso, o endpoint fará a extração via url
                            }
                        }

                        console.log(`📱 [WA-V21] Assistente: name=${robotName} url=${(salesUrl || '').substring(0, 50)} checkout=${(checkoutLink || 'N/A').substring(0, 50)} pageData=${pageData ? 'SIM' : 'via-url'}`);
                    }
                } catch (e) {
                    console.warn(`📱 [WA-CHANNEL] Erro ao buscar dados do assistente:`, e.message);
                }

                // Montar pageData com checkout se disponível
                const enrichedPageData = pageData ? { ...pageData } : undefined;
                if (enrichedPageData && checkoutLink) {
                    enrichedPageData.checkoutLink = checkoutLink;
                    enrichedPageData.checkoutSource = 'db_confirmed';
                }

                // ════════════════════════════════════════════════════════════════
                // V21: PAYLOAD IDÊNTICO AO LINK CURTO (linhas 11448-11456 server.js)
                // Campos: message, pageData, robotName, instructions, conversationId, leadId, apiKey
                // ════════════════════════════════════════════════════════════════
                const postData = JSON.stringify({
                    message,
                    apiKey,
                    conversationId,
                    leadId: leadId || undefined,
                    url: salesUrl || undefined,
                    robotName: robotName || undefined,
                    instructions: instructions || undefined,
                    pageData: enrichedPageData || undefined,
                    context: checkoutLink ? { checkoutLink } : undefined
                });

                // V21: Selecionar endpoint baseado na feature flag
                const endpointPath = WA_USE_FULL_PIPELINE
                    ? '/api/process-chat-inteligente'
                    : '/api/chat-universal';

                console.log(`📱 [WA-V21] Endpoint: ${endpointPath} | pipeline=${WA_USE_FULL_PIPELINE ? 'FULL' : 'LEGACY'}`);

                const options = {
                    hostname: '127.0.0.1',
                    port: this.serverPort,
                    path: endpointPath,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData),
                        'X-Internal-Channel': 'whatsapp'   // Marcador de canal (não altera lógica)
                    }
                };

                const req = http.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        clearTimeout(timeout);
                        try {
                            const parsed = JSON.parse(data);
                            resolve(parsed);
                        } catch (e) {
                            console.error('📱 [WA-CHANNEL] Erro ao parsear resposta da IA:', e.message);
                            resolve(null);
                        }
                    });
                });

                req.on('error', (err) => {
                    clearTimeout(timeout);
                    console.error('📱 [WA-CHANNEL] Erro HTTP interno:', err.message);
                    resolve(null);
                });

                req.write(postData);
                req.end();

            } catch (err) {
                clearTimeout(timeout);
                console.error('📱 [WA-CHANNEL] Erro ao chamar Unified Brain:', err.message);
                resolve(null);
            }
        });
    }

    // ============================================================
    // RESOLUÇÃO DE LEAD POR TELEFONE
    // ============================================================
    async _resolveLeadByPhone(apiKey, phone, pushName) {
        try {
            const leadSystem = this.getLeadSystem(apiKey);
            const leads = leadSystem.getLeads();

            // 1. Buscar por wa_phone (campo novo)
            let lead = leads.find(l => l.wa_phone === phone);
            if (lead) return lead;

            // 2. Buscar por telefone normalizado existente
            const phoneVariants = [phone, phone.replace('+', ''), phone.replace('+55', '')];
            lead = leads.find(l => {
                if (!l.telefone) return false;
                const norm = this._normalizePhone(l.telefone);
                return phoneVariants.includes(norm) || phoneVariants.includes(l.telefone);
            });

            if (lead) {
                // Vincular wa_phone ao lead existente
                lead.wa_phone = phone;
                lead.channel = lead.channel || 'widget';  // preservar canal original
                leadSystem.saveLeads();
                console.log(`📱 [WA-CHANNEL] Lead existente vinculado via telefone: ${lead.nome || lead.email} ← ${phone}`);
                return lead;
            }

            // 3. Criar lead novo automaticamente
            const newLead = leadSystem.addLead({
                nome: pushName || 'WhatsApp ' + phone.slice(-4),
                email: 'Não informado',
                telefone: phone,
                wa_phone: phone,
                url_origem: 'whatsapp://' + phone,
                robotName: 'Assistente IA',
                source: 'whatsapp',
                channel: 'whatsapp'
            });

            console.log(`📱 [WA-CHANNEL] Novo lead criado via WhatsApp: ${newLead.nome} (${phone})`);

            // Sync com CRM (fire-and-forget)
            try {
                const { crmManager } = require('./lib/crm/index');
                if (crmManager && typeof crmManager.syncLeadToCRM === 'function') {
                    crmManager.syncLeadToCRM(apiKey, newLead).catch(() => {});
                }
            } catch (e) { /* CRM sync não bloqueia */ }

            return newLead;

        } catch (error) {
            console.error('📱 [WA-CHANNEL] Erro ao resolver lead:', error.message);
            return null;
        }
    }

    // ============================================================
    // ENVIAR RESPOSTA VIA WHATSAPP
    // ============================================================
    async _sendResponse(apiKey, phone, message, provider, instanceName, instanceToken) {
        try {
            // ═══ PRIORIDADE 1: Envio DIRETO pela mesma instância que RECEBEU ═══
            const centralUrl = process.env.CENTRAL_EVOLUTION_URL;
            const centralKey = process.env.CENTRAL_EVOLUTION_API_KEY;

            if (instanceName && centralUrl) {
                // Evolution Go v0.7.1: POST /send/text
                // Body: { number, text }
                // Header apikey: instanceToken (preferencial) ou centralKey (fallback)
                const authKey = instanceToken || centralKey;
                if (!authKey) {
                    console.warn(`📱 [WA-SEND] Sem token para instância ${instanceName}`);
                } else {
                    console.log(`📱 [WA-SEND] Enviando via /send/text: instance=${instanceName} token=${authKey.substring(0, 8)}...`);
                    const axios = require('axios');
                    const phoneClean = phone.replace(/\D/g, '');

                    try {
                        const sendResp = await axios.post(
                            `${centralUrl}/send/text`,
                            { number: phoneClean, text: message },
                            {
                                headers: { 'Content-Type': 'application/json', apikey: authKey },
                                timeout: 15000
                            }
                        );
                        console.log(`📱 [EVOLUTION RESPONSE SENT] ✅ instance=${instanceName} status=${sendResp.status}`);
                        return { success: true, provider: 'evolution_go_direct', messageId: sendResp.data?.key?.id || sendResp.data?.data?.id || null };
                    } catch (err1) {
                        console.warn(`📱 [WA-SEND] /send/text com instanceToken falhou:`, JSON.stringify(err1.response?.data || err1.message));

                        // Fallback: tentar com centralKey se o instanceToken falhou
                        if (instanceToken && centralKey && instanceToken !== centralKey) {
                            try {
                                const sendResp2 = await axios.post(
                                    `${centralUrl}/send/text`,
                                    { number: phoneClean, text: message },
                                    {
                                        headers: { 'Content-Type': 'application/json', apikey: centralKey },
                                        timeout: 15000
                                    }
                                );
                                console.log(`📱 [EVOLUTION RESPONSE SENT] ✅ (centralKey) instance=${instanceName}`);
                                return { success: true, provider: 'evolution_go_centralkey', messageId: sendResp2.data?.key?.id || null };
                            } catch (err2) {
                                console.error(`📱 [WA-SEND] ❌ /send/text com centralKey também falhou:`, JSON.stringify(err2.response?.data || err2.message));
                            }
                        }
                    }
                }
            }

            // ═══ PRIORIDADE 2: Instância tenant via whatsapp_settings ═══
            try {
                const instance = await this.whatsappMgr.getTenantInstance(apiKey);
                if (instance && instance !== this.whatsappMgr && instance.isReady()) {
                    return await instance.sendMessage(phone, message);
                }
            } catch (e) {
                console.warn(`📱 [WA-SEND] getTenantInstance falhou:`, e.message);
            }

            // ═══ PRIORIDADE 3: Instância global ═══
            if (this.whatsappMgr.isReady()) {
                return await this.whatsappMgr.sendMessage(phone, message);
            }

            console.warn('📱 [WA-CHANNEL] Nenhuma instância WhatsApp disponível para envio');
            return { success: false, error: 'No WhatsApp instance' };
        } catch (error) {
            console.error('📱 [WA-CHANNEL] Erro ao enviar resposta:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ============================================================
    // ADAPTAR RESPOSTA DA IA PARA WHATSAPP
    // ============================================================
    _adaptForWhatsApp(response) {
        if (!response) return '';

        let text = String(response);

        // Remover marcadores internos do sistema
        text = text.replace(/\[CALENDAR_WIDGET\]/g, '📅 Para agendar, me diga qual dia e horário você prefere.');
        text = text.replace(/\[CTA:[^\]]*\]/g, '');
        text = text.replace(/\[OUT\]/g, '');
        text = text.replace(/<s>\s*/g, '');

        // Converter Markdown → WhatsApp formatting
        text = text.replace(/\*\*(.*?)\*\*/g, '*$1*');     // **bold** → *bold*
        text = text.replace(/__(.*?)__/g, '_$1_');           // __italic__ → _italic_
        text = text.replace(/~~(.*?)~~/g, '~$1~');           // ~~strike~~ → ~strike~

        // Remover tags HTML
        text = text.replace(/<[^>]*>/g, '');

        // Limpar espaços extras
        text = text.replace(/\n{3,}/g, '\n\n');
        text = text.trim();

        // Truncar se necessário (limite WhatsApp: 4096 chars)
        if (text.length > WA_MSG_MAX_LEN) {
            text = text.substring(0, WA_MSG_MAX_LEN - 20) + '\n\n_(continua...)_';
        }

        return text;
    }

    // ============================================================
    // NOTIFICAR DONO (modo ⚫ Desligado)
    // ============================================================
    async _notifyOwner(apiKey, phone, pushName, messageText, notifPhone) {
        try {
            const targetPhone = notifPhone
                || process.env.NOTIFICATION_PHONE
                || process.env.ADMIN_PHONE;

            if (!targetPhone) {
                console.warn('📱 [WA-CHANNEL] Sem telefone de notificação configurado');
                return;
            }

            const notification = `📱 *Nova mensagem WhatsApp*\n\n`
                + `👤 *De:* ${pushName || 'Desconhecido'} (${phone})\n`
                + `💬 *Mensagem:* ${messageText.substring(0, 500)}\n\n`
                + `⏰ ${new Date().toLocaleString('pt-BR')}\n\n`
                + `_O canal WhatsApp está no modo ⚫ Desligado. Responda manualmente._`;

            await this._sendResponse(apiKey, targetPhone, notification, 'evolution');
        } catch (error) {
            console.error('📱 [WA-CHANNEL] Erro ao notificar dono:', error.message);
        }
    }

    // ============================================================
    // RESOLVER TENANT POR INSTÂNCIA EVOLUTION
    // ============================================================
    async _resolveTenantByInstance(instanceName) {
        if (!instanceName) return null;

        // Cache
        const cached = this._tenantCache.get(`evo_${instanceName}`);
        if (cached && cached._expiresAt > Date.now()) return cached;

        try {
            // Tentativa 1: Buscar na tabela whatsapp_settings
            const q = this.USE_POSTGRES
                ? `SELECT api_key, notification_phone, is_active FROM whatsapp_settings
                   WHERE (evolution_instance_name = $1 OR saas_instance_name = $1) AND is_active = true LIMIT 1`
                : `SELECT api_key, notification_phone, is_active FROM whatsapp_settings
                   WHERE (evolution_instance_name = ? OR saas_instance_name = ?) AND is_active = 1 LIMIT 1`;

            const params = this.USE_POSTGRES ? [instanceName] : [instanceName, instanceName];
            const result = await this.db.query(q, params);
            let row = (result.rows || result)[0];

            // Tentativa 2 (FALLBACK): Se não encontrou, resolver pelo padrão lm_{tenantIdPrefix}
            // A instância é nomeada como lm_{first8chars_of_tenant_id}
            if (!row && instanceName.startsWith('lm_')) {
                const tenantIdPrefix = instanceName.replace('lm_', '');
                console.log(`📱 [WA-CHANNEL] Fallback: buscando tenant por ID prefix '${tenantIdPrefix}%'`);
                try {
                    const q2 = this.USE_POSTGRES
                        ? `SELECT ak.key_value as api_key FROM api_keys ak
                           JOIN tenants t ON ak.tenant_id = t.id
                           WHERE t.id::text LIKE $1 AND t.status = 'active' AND ak.active = true
                           LIMIT 1`
                        : `SELECT ak.key_value as api_key FROM api_keys ak
                           JOIN tenants t ON ak.tenant_id = t.id
                           WHERE t.id LIKE ? AND t.status = 'active' AND ak.active = 1
                           LIMIT 1`;
                    const r2 = await this.db.query(q2, [`${tenantIdPrefix}%`]);
                    const row2 = (r2.rows || r2)[0];
                    if (row2) {
                        console.log(`📱 [WA-CHANNEL] ✅ Fallback: tenant encontrado via ID prefix: ${row2.api_key?.substring(0, 12)}...`);
                        row = { api_key: row2.api_key, notification_phone: null, is_active: true };
                    }
                } catch (fbErr) {
                    console.warn(`📱 [WA-CHANNEL] Fallback tenant error:`, fbErr.message);
                }
            }

            if (!row) return null;

            // Buscar channel_mode (pode não existir ainda — fallback 'auto')
            let channelMode = 'auto';
            try {
                const q2 = this.USE_POSTGRES
                    ? `SELECT channel_mode FROM whatsapp_settings WHERE api_key = $1 LIMIT 1`
                    : `SELECT channel_mode FROM whatsapp_settings WHERE api_key = ? LIMIT 1`;
                const r2 = await this.db.query(q2, [row.api_key]);
                const row2 = (r2.rows || r2)[0];
                if (row2 && row2.channel_mode) channelMode = row2.channel_mode;
            } catch (e) {
                // Coluna pode não existir ainda — fallback para 'auto'
            }

            const tenant = {
                apiKey: row.api_key,
                notificationPhone: row.notification_phone,
                channelMode,
                _expiresAt: Date.now() + TENANT_CACHE_TTL
            };

            this._tenantCache.set(`evo_${instanceName}`, tenant);
            return tenant;

        } catch (error) {
            console.error('📱 [WA-CHANNEL] Erro ao resolver tenant por instância:', error.message);
            return null;
        }
    }

    // ============================================================
    // RESOLVER TENANT POR NÚMERO TWILIO
    // ============================================================
    async _resolveTenantByTwilioNumber(twilioNumber) {
        if (!twilioNumber) return null;

        const cleanNumber = twilioNumber.replace('whatsapp:', '');
        const cached = this._tenantCache.get(`twilio_${cleanNumber}`);
        if (cached && cached._expiresAt > Date.now()) return cached;

        try {
            const q = this.USE_POSTGRES
                ? `SELECT api_key, notification_phone FROM whatsapp_settings
                   WHERE twilio_from_number = $1 AND is_active = true LIMIT 1`
                : `SELECT api_key, notification_phone FROM whatsapp_settings
                   WHERE twilio_from_number = ? AND is_active = 1 LIMIT 1`;

            const result = await this.db.query(q, [cleanNumber]);
            const row = (result.rows || result)[0];
            if (!row) return null;

            let channelMode = 'auto';
            try {
                const q2 = this.USE_POSTGRES
                    ? `SELECT channel_mode FROM whatsapp_settings WHERE api_key = $1 LIMIT 1`
                    : `SELECT channel_mode FROM whatsapp_settings WHERE api_key = ? LIMIT 1`;
                const r2 = await this.db.query(q2, [row.api_key]);
                const row2 = (r2.rows || r2)[0];
                if (row2 && row2.channel_mode) channelMode = row2.channel_mode;
            } catch (e) { /* coluna pode não existir */ }

            const tenant = {
                apiKey: row.api_key,
                notificationPhone: row.notification_phone,
                channelMode,
                _expiresAt: Date.now() + TENANT_CACHE_TTL
            };

            this._tenantCache.set(`twilio_${cleanNumber}`, tenant);
            return tenant;

        } catch (error) {
            console.error('📱 [WA-CHANNEL] Erro ao resolver tenant Twilio:', error.message);
            return null;
        }
    }

    // ============================================================
    // LOG DE MENSAGENS (whatsapp_messages)
    // ============================================================
    async _logMessage({ apiKey, waMessageId, waPhone, direction, content, leadId, conversationId, provider }) {
        try {
            if (!this.USE_POSTGRES) return; // Só loga em PostgreSQL

            const id = crypto.randomBytes(12).toString('hex');
            const q = `INSERT INTO whatsapp_messages
                (id, tenant_id, api_key, wa_message_id, wa_phone, direction, content, lead_id, conversation_id, provider)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT DO NOTHING`;

            await this.db.query(q, [
                id, apiKey, apiKey,
                waMessageId || '', waPhone, direction,
                (content || '').substring(0, 10000),  // limitar tamanho
                leadId || null, conversationId || '', provider || ''
            ]);
        } catch (error) {
            // Log falho não bloqueia o fluxo
            console.warn('📱 [WA-CHANNEL] Erro ao salvar log de mensagem:', error.message);
        }
    }

    // ============================================================
    // RATE LIMITING (por telefone)
    // ============================================================
    _checkRateLimit(phone) {
        const now = Date.now();
        let timestamps = this._rateLimits.get(phone) || [];

        // Remover timestamps fora da janela
        timestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);

        if (timestamps.length >= RATE_LIMIT_MAX) return false;

        timestamps.push(now);
        this._rateLimits.set(phone, timestamps);

        // Limpar map periodicamente (evitar memory leak)
        if (this._rateLimits.size > 5000) {
            const cutoff = now - RATE_LIMIT_WINDOW;
            for (const [key, val] of this._rateLimits) {
                if (val.every(t => t < cutoff)) this._rateLimits.delete(key);
            }
        }

        return true;
    }

    // ============================================================
    // UTILITÁRIOS
    // ============================================================

    /** Normalizar telefone para formato E.164 (+55...) */
    _normalizePhone(phone) {
        if (!phone) return '';
        let cleaned = String(phone).replace(/\D/g, '');

        // Adicionar código do país Brasil se ausente
        if (cleaned.length <= 11 && !cleaned.startsWith('55')) {
            cleaned = '55' + cleaned;
        }

        return '+' + cleaned;
    }

    /** Gerar conversationId estável para WhatsApp */
    _makeConversationId(phone, apiKey) {
        // Formato: wa_<phone>_<apiKey8chars>
        const keyPart = (apiKey || '').substring(0, 8);
        const phonePart = phone.replace(/\D/g, '');
        return `wa_${phonePart}_${keyPart}`;
    }

    /** Invalidar cache de tenant */
    clearTenantCache(apiKey) {
        for (const [key, val] of this._tenantCache) {
            if (val.apiKey === apiKey) this._tenantCache.delete(key);
        }
    }
}

// ============================================================
// EXPORTAÇÃO / REGISTRO
// ============================================================

let _channelInstance = null;

/**
 * Registrar canal WhatsApp no Express app
 * Chamado uma vez em server.js com injeção de dependências
 *
 * @param {Object} app - Express app
 * @param {Object} deps - { db, USE_POSTGRES, getLeadSystem, whatsappManager, analytics }
 * @returns {WhatsAppChannel}
 */
function registerWhatsAppChannel(app, deps) {
    try {
        _channelInstance = new WhatsAppChannel(deps);
        _channelInstance.registerRoutes(app);
        console.log('📱 [WA-CHANNEL] Canal WhatsApp registrado com sucesso');
        return _channelInstance;
    } catch (error) {
        console.error('📱 [WA-CHANNEL] Erro ao registrar canal (não bloqueia servidor):', error.message);
        return null;
    }
}

module.exports = {
    registerWhatsAppChannel,
    WhatsAppChannel,
    getChannelInstance: () => _channelInstance
};
