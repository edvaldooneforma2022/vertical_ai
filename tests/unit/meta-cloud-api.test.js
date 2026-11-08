/**
 * 🧪 TESTES UNITÁRIOS — META WHATSAPP CLOUD API (OFICIAL v21.0)
 *
 * Cobre:
 * 1. Webhook GET: Verificação de desafio (Hub challenge & verify token).
 * 2. Webhook POST: Validação de assinatura HMAC SHA-256 (X-Hub-Signature-256).
 * 3. Webhook POST: Deduplicação por wamid e ingestão de mensagens.
 * 4. Resolução de tenant multi-tenant por phoneNumberId e wabaId.
 * 5. Despacho de mensagens via Meta Graph API v21.0.
 * 6. Tratamento de erros, limites de taxa e tokens expirados.
 * 7. Isolamento de credenciais e mensagens entre tenants.
 * 8. Fallback ADMIN_SECRET_KEY na rota de métricas administrativas.
 */

process.env.USE_POSTGRES = 'true';
process.env.ADMIN_SECRET_KEY = 'admin-super-secret-key-999';
delete process.env.ADMIN_API_KEY;

const crypto = require('crypto');
const axios = require('axios');
const { WhatsAppChannel } = require('../../whatsapp-channel');

describe('Meta WhatsApp Cloud API Integration (v21.0)', () => {
    let channel;
    let mockDb;
    let mockApp;
    let registeredRoutes = {};

    beforeEach(() => {
        jest.clearAllMocks();

        registeredRoutes = {};
        mockApp = {
            get: jest.fn((path, handler) => { registeredRoutes[`GET ${path}`] = handler; }),
            post: jest.fn((path, handler) => { registeredRoutes[`POST ${path}`] = handler; })
        };

        mockDb = {
            query: jest.fn().mockResolvedValue({ rows: [] })
        };

        const mockDeps = {
            db: mockDb,
            USE_POSTGRES: true,
            getLeadSystem: jest.fn().mockReturnValue({
                updateLeadConversation: jest.fn()
            }),
            getApiKeyManager: jest.fn().mockReturnValue({
                validateKey: jest.fn().mockResolvedValue({ valid: true, tenantId: '11111111-1111-1111-1111-111111111111' })
            }),
            whatsappManager: {
                isReady: jest.fn().mockReturnValue(false),
                sendMessage: jest.fn()
            },
            analytics: {},
            encryptionManager: {
                enabled: true,
                encrypt: jest.fn((val) => `ENC:${Buffer.from(val).toString('base64')}`),
                decrypt: jest.fn((val) => {
                    if (val.startsWith('ENC:')) {
                        return Buffer.from(val.replace('ENC:', ''), 'base64').toString('utf8');
                    }
                    return val;
                })
            }
        };

        channel = new WhatsAppChannel(mockDeps);
        channel.registerRoutes(mockApp);
    });

    afterEach(() => {
        if (channel) {
            channel.destroy();
        }
    });

    describe('1. Webhook GET — Desafio da Meta (Hub Challenge)', () => {
        it('deve retornar 200 com o challenge quando token bate com META_VERIFY_TOKEN global', async () => {
            process.env.META_VERIFY_TOKEN = 'meta-global-verify-123';

            const req = {
                query: {
                    'hub.mode': 'subscribe',
                    'hub.verify_token': 'meta-global-verify-123',
                    'hub.challenge': 'challenge-token-abc-987'
                }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            const handler = registeredRoutes['GET /api/webhook/meta'];
            expect(handler).toBeDefined();

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith('challenge-token-abc-987');
        });

        it('deve retornar 200 com o challenge quando token bate com verify_token do tenant no banco', async () => {
            process.env.META_VERIFY_TOKEN = 'different-token';

            mockDb.query.mockResolvedValueOnce({
                rows: [{ id: 42, meta_verify_token: 'tenant-custom-token-xyz' }]
            });

            const req = {
                query: {
                    'hub.mode': 'subscribe',
                    'hub.verify_token': 'tenant-custom-token-xyz',
                    'hub.challenge': 'tenant-challenge-555'
                }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            const handler = registeredRoutes['GET /api/webhook/meta'];
            await handler(req, res);

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('meta_verify_token = $1'),
                ['tenant-custom-token-xyz']
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith('tenant-challenge-555');
        });

        it('deve retornar 403 Forbidden quando token é inválido', async () => {
            process.env.META_VERIFY_TOKEN = 'correct-token';
            mockDb.query.mockResolvedValueOnce({ rows: [] });

            const req = {
                query: {
                    'hub.mode': 'subscribe',
                    'hub.verify_token': 'wrong-token',
                    'hub.challenge': 'challenge-999'
                }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            const handler = registeredRoutes['GET /api/webhook/meta'];
            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.send).toHaveBeenCalledWith('Forbidden');
        });

        it('deve retornar 403 Forbidden quando hub.mode não é subscribe', async () => {
            const req = {
                query: {
                    'hub.mode': 'unsubscribe',
                    'hub.verify_token': 'correct-token',
                    'hub.challenge': 'challenge-999'
                }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            const handler = registeredRoutes['GET /api/webhook/meta'];
            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.send).toHaveBeenCalledWith('Forbidden');
        });
    });

    describe('2. Webhook POST — Segurança e Assinatura X-Hub-Signature-256 (Correção A)', () => {
        const appSecret = 'my-meta-app-secret-12345';

        beforeEach(() => {
            process.env.META_APP_SECRET = appSecret;
        });

        it('deve validar com sucesso requisição com assinatura HMAC SHA-256 válida usando segredo global', async () => {
            const body = {
                object: 'whatsapp_business_account',
                entry: [{ id: 'waba_123', changes: [] }]
            };

            const rawBody = Buffer.from(JSON.stringify(body));
            const signature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

            const req = {
                body,
                rawBody,
                headers: { 'x-hub-signature-256': signature }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn(),
                json: jest.fn()
            };

            const handler = registeredRoutes['POST /api/webhook/meta'];
            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith('EVENT_RECEIVED');
        });

        it('deve rejeitar com 403 Forbidden quando assinatura HMAC é inválida', async () => {
            const body = { object: 'whatsapp_business_account', entry: [] };
            const req = {
                body,
                rawBody: Buffer.from(JSON.stringify(body)),
                headers: { 'x-hub-signature-256': 'sha256=invalidhash00000000000000000000000000000000000000000000000000000000' }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const handler = registeredRoutes['POST /api/webhook/meta'];
            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
        });

        it('deve rejeitar com 403 Forbidden quando header de assinatura está ausente', async () => {
            const body = { object: 'whatsapp_business_account', entry: [] };
            const req = {
                body,
                rawBody: Buffer.from(JSON.stringify(body)),
                headers: {}
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const handler = registeredRoutes['POST /api/webhook/meta'];
            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ error: 'Signature header missing' });
        });

        it('deve validar com sucesso requisição usando segredo específico do tenant quando segredo global não existe', async () => {
            delete process.env.META_APP_SECRET;

            const tenantSecret = 'tenant-custom-app-secret-777';
            mockDb.query.mockResolvedValueOnce({
                rows: [{ meta_app_secret: tenantSecret }]
            });

            const body = {
                object: 'whatsapp_business_account',
                entry: [
                    {
                        id: 'waba_tenant_custom',
                        changes: [
                            {
                                field: 'messages',
                                value: {
                                    metadata: { phone_number_id: 'phone_custom_777' }
                                }
                            }
                        ]
                    }
                ]
            };

            const rawBody = Buffer.from(JSON.stringify(body));
            const signature = 'sha256=' + crypto.createHmac('sha256', tenantSecret).update(rawBody).digest('hex');

            const req = {
                body,
                rawBody,
                headers: { 'x-hub-signature-256': signature }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn(),
                json: jest.fn()
            };

            const handler = registeredRoutes['POST /api/webhook/meta'];
            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith('EVENT_RECEIVED');
        });

        it('deve rejeitar com 403 Forbidden quando assinatura pertence a outro tenant (isolamento)', async () => {
            delete process.env.META_APP_SECRET;

            // Tenant A tem phone_A e secret_A
            const secretTenantA = 'secret-tenant-A';
            const secretTenantB = 'secret-tenant-B';

            // Banco retorna apenas o secret do Tenant A para a requisição de phone_A
            mockDb.query.mockResolvedValueOnce({
                rows: [{ meta_app_secret: secretTenantA }]
            });

            const body = {
                object: 'whatsapp_business_account',
                entry: [
                    {
                        id: 'waba_tenant_A',
                        changes: [
                            {
                                field: 'messages',
                                value: { metadata: { phone_number_id: 'phone_A' } }
                            }
                        ]
                    }
                ]
            };

            // Requisição com phone_A assinada fraudulentamente com a chave do Tenant B
            const rawBody = Buffer.from(JSON.stringify(body));
            const forgedSig = 'sha256=' + crypto.createHmac('sha256', secretTenantB).update(rawBody).digest('hex');

            const req = {
                body,
                rawBody,
                headers: { 'x-hub-signature-256': forgedSig }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const handler = registeredRoutes['POST /api/webhook/meta'];
            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
        });

        it('deve rejeitar com 403 Forbidden quando o corpo da requisição foi adulterado após cálculo da assinatura', async () => {
            const originalBody = { object: 'whatsapp_business_account', text: 'original' };
            const originalRaw = Buffer.from(JSON.stringify(originalBody));
            const signature = 'sha256=' + crypto.createHmac('sha256', appSecret).update(originalRaw).digest('hex');

            // Corpo adulterado em trânsito
            const tamperedBody = { object: 'whatsapp_business_account', text: 'tampered-payload' };
            const tamperedRaw = Buffer.from(JSON.stringify(tamperedBody));

            const req = {
                body: tamperedBody,
                rawBody: tamperedRaw,
                headers: { 'x-hub-signature-256': signature }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const handler = registeredRoutes['POST /api/webhook/meta'];
            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
        });

        it('deve rejeitar com 403 Forbidden quando não há nenhum segredo configurado no sistema', async () => {
            delete process.env.META_APP_SECRET;

            // Banco de dados não tem secret cadastrado
            mockDb.query.mockResolvedValueOnce({ rows: [] });

            const body = { object: 'whatsapp_business_account', entry: [] };
            const rawBody = Buffer.from(JSON.stringify(body));
            const fakeSig = 'sha256=' + crypto.createHmac('sha256', 'some-random-key').update(rawBody).digest('hex');

            const req = {
                body,
                rawBody,
                headers: { 'x-hub-signature-256': fakeSig }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const handler = registeredRoutes['POST /api/webhook/meta'];
            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
        });
    });

    describe('3. Webhook POST — Ingestão de Mensagens, Deduplicação e Identidade Canônica (Correções B, C, D)', () => {
        const testSecret = 'test-secret-suite-3';

        const createSignedWebhookReq = (body, secret = testSecret) => {
            const rawBody = Buffer.from(JSON.stringify(body));
            const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
            return {
                body,
                rawBody,
                headers: { 'x-hub-signature-256': signature }
            };
        };

        beforeEach(() => {
            process.env.META_APP_SECRET = testSecret;
            channel.clearDedupCache();
        });

        it('deve processar mensagem de texto, realizar claim atômico e persistir no banco antes do ACK 200', async () => {
            const tenantSettings = {
                api_key: 'lm_meta_tenant_key_111',
                channel_mode: 'auto',
                notification_phone: '5511999999999',
                meta_phone_number_id: 'phone_id_999',
                meta_waba_id: 'waba_id_888',
                meta_access_token: 'valid_meta_token_abc',
                tenant_uuid: '11111111-1111-1111-1111-111111111111'
            };

            const insertedRows = [];
            mockDb.query.mockImplementation(async (sql, params) => {
                if (typeof sql === 'string' && sql.includes('INSERT INTO whatsapp_messages')) {
                    insertedRows.push({ sql, params });
                    return { rows: [{ id: 'db_msg_uuid_101' }], rowCount: 1 };
                }
                if (typeof sql === 'string' && sql.includes('SELECT id, tenant_id, api_key, wa_message_id')) {
                    return {
                        rows: [{
                            id: 'db_msg_uuid_101',
                            tenant_id: '11111111-1111-1111-1111-111111111111',
                            tenant_uuid: '11111111-1111-1111-1111-111111111111',
                            api_key: 'lm_meta_tenant_key_111',
                            wa_message_id: 'wamid.HBgLMTE5ODg4ODc3NzcVAgASGBQzQTkyREI4RDQyQzQ0MzVGREQxOQA=',
                            wa_phone: '5511988887777',
                            content: 'Gostaria de agendar uma consulta',
                            metadata: JSON.stringify({ phoneNumberId: 'phone_id_999', wabaId: 'waba_id_888', pushName: 'Maria Silva' }),
                            attempts: 0,
                            outbound_sent: false,
                            status: 'received'
                        }]
                    };
                }
                return { rows: [tenantSettings] };
            });

            const spyProcess = jest.spyOn(channel, '_processIncomingMessage').mockResolvedValue();

            const body = {
                object: 'whatsapp_business_account',
                entry: [
                    {
                        id: 'waba_id_888',
                        changes: [
                            {
                                field: 'messages',
                                value: {
                                    messaging_product: 'whatsapp',
                                    metadata: {
                                        display_phone_number: '15550231234',
                                        phone_number_id: 'phone_id_999'
                                    },
                                    contacts: [
                                        { profile: { name: 'Maria Silva' }, wa_id: '5511988887777' }
                                    ],
                                    messages: [
                                        {
                                            from: '5511988887777',
                                            id: 'wamid.HBgLMTE5ODg4ODc3NzcVAgASGBQzQTkyREI4RDQyQzQ0MzVGREQxOQA=',
                                            timestamp: '1731000000',
                                            type: 'text',
                                            text: { body: 'Gostaria de agendar uma consulta' }
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                ]
            };

            const req = createSignedWebhookReq(body);
            const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };

            const handler = registeredRoutes['POST /api/webhook/meta'];
            await handler(req, res);

            // Garantia B: ACK 200 enviado com sucesso
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith('EVENT_RECEIVED');

            // Garantia B & C: Mensagem foi persistida no banco com id canônico
            expect(insertedRows.length).toBeGreaterThanOrEqual(1);
            const claimInsert = insertedRows[0];
            expect(claimInsert.params).toContain('11111111-1111-1111-1111-111111111111');
            expect(claimInsert.params).toContain('wamid.HBgLMTE5ODg4ODc3NzcVAgASGBQzQTkyREI4RDQyQzQ0MzVGREQxOQA=');

            // Webhook NÃO executa pipeline inline pós-ACK (Worker durável é o único consumidor)
            expect(spyProcess).not.toHaveBeenCalled();

            // Consumidor durável executa a mensagem com parâmetros canônicos
            await channel.processPendingQueue({ batchSize: 5 });
            expect(spyProcess).toHaveBeenCalledWith(expect.objectContaining({
                apiKey: 'lm_meta_tenant_key_111',
                phone: '5511988887777',
                pushName: 'Maria Silva',
                text: 'Gostaria de agendar uma consulta',
                waMessageId: 'wamid.HBgLMTE5ODg4ODc3NzcVAgASGBQzQTkyREI4RDQyQzQ0MzVGREQxOQA=',
                provider: 'meta'
            }));
        });

        it('deve retornar 500 e NÃO enviar 200 quando falhar a persistência durável no banco (fail-closed)', async () => {
            const tenantSettings = {
                api_key: 'lm_meta_tenant_key_fail',
                meta_phone_number_id: 'phone_fail_999',
                meta_waba_id: 'waba_fail_888',
                meta_access_token: 'valid_token',
                tenant_uuid: '22222222-2222-2222-2222-222222222222'
            };

            // Simular erro catastrófico no PostgreSQL durante INSERT
            mockDb.query.mockImplementation(async (sql) => {
                if (typeof sql === 'string' && sql.includes('INSERT INTO whatsapp_messages')) {
                    throw new Error('Postgres connection terminated unexpectedly');
                }
                return { rows: [tenantSettings] };
            });

            const spyProcess = jest.spyOn(channel, '_processIncomingMessage').mockResolvedValue();

            const body = {
                object: 'whatsapp_business_account',
                entry: [
                    {
                        id: 'waba_fail_888',
                        changes: [
                            {
                                field: 'messages',
                                value: {
                                    metadata: { phone_number_id: 'phone_fail_999' },
                                    messages: [
                                        { from: '5511900000000', id: 'wamid.FAIL_PERSISTENCE', type: 'text', text: { body: 'Teste' } }
                                    ]
                                }
                            }
                        ]
                    }
                ]
            };

            const req = createSignedWebhookReq(body);
            const res = { status: jest.fn().mockReturnThis(), send: jest.fn(), json: jest.fn() };

            const handler = registeredRoutes['POST /api/webhook/meta'];
            await handler(req, res);

            // Requisito B (fail-closed): Não confirma recebimento à Meta em caso de erro no banco
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).not.toHaveBeenCalledWith('EVENT_RECEIVED');
            expect(spyProcess).not.toHaveBeenCalled();
        });

        it('deve deduplicar e ignorar mensagens recebidas repetidas vezes com o mesmo wamid', async () => {
            const tenantSettings = {
                api_key: 'lm_tenant_dedup',
                meta_phone_number_id: 'phone_id_dedup',
                meta_access_token: 'token_dedup',
                tenant_uuid: '33333333-3333-3333-3333-333333333333'
            };

            let queueRows = [{
                id: '1',
                tenant_id: '33333333-3333-3333-3333-333333333333',
                tenant_uuid: '33333333-3333-3333-3333-333333333333',
                api_key: 'lm_tenant_dedup',
                wa_message_id: 'wamid.SAME_MESSAGE_ID_DUPLICATE_CHECK',
                wa_phone: '5511911112222',
                content: 'Oi',
                metadata: JSON.stringify({ phoneNumberId: 'phone_id_dedup', wabaId: 'waba_dedup' }),
                attempts: 0,
                status: 'received'
            }];

            mockDb.query.mockImplementation(async (sql) => {
                if (typeof sql === 'string' && sql.includes('INSERT INTO whatsapp_messages')) {
                    return { rows: [{ id: '1' }], rowCount: 1 };
                }
                if (typeof sql === 'string' && sql.includes('SELECT id, tenant_id, api_key, wa_message_id')) {
                    const current = queueRows;
                    queueRows = [];
                    return { rows: current };
                }
                return { rows: [tenantSettings] };
            });

            const spyProcess = jest.spyOn(channel, '_processIncomingMessage').mockResolvedValue();

            const body = {
                object: 'whatsapp_business_account',
                entry: [
                    {
                        id: 'waba_dedup',
                        changes: [
                            {
                                field: 'messages',
                                value: {
                                    metadata: { phone_number_id: 'phone_id_dedup' },
                                    messages: [
                                        {
                                            from: '5511911112222',
                                            id: 'wamid.SAME_MESSAGE_ID_DUPLICATE_CHECK',
                                            type: 'text',
                                            text: { body: 'Oi' }
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                ]
            };

            const req = createSignedWebhookReq(body);
            const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
            const handler = registeredRoutes['POST /api/webhook/meta'];

            // Primeira chamada: persiste e responde 200 sem inline
            await handler(req, res);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(spyProcess).not.toHaveBeenCalled();

            // Consumidor durável processa a mensagem
            await channel.processPendingQueue({ batchSize: 5 });
            expect(spyProcess).toHaveBeenCalledTimes(1);

            // Segunda chamada: deduplica (L1) e não gera novo processamento
            await handler(req, res);
            await channel.processPendingQueue({ batchSize: 5 });
            expect(spyProcess).toHaveBeenCalledTimes(1);
        });

        it('deve deduplicar atômica e concorrentemente requisições simultâneas com o mesmo wamid (Promise.all)', async () => {
            const tenantSettings = {
                api_key: 'lm_tenant_concurrent',
                meta_phone_number_id: 'phone_concurrent',
                meta_access_token: 'token_concurrent',
                tenant_uuid: '44444444-4444-4444-4444-444444444444'
            };

            let insertCount = 0;
            let queueRows = [{
                id: 'claim_1',
                tenant_id: '44444444-4444-4444-4444-444444444444',
                tenant_uuid: '44444444-4444-4444-4444-444444444444',
                api_key: 'lm_tenant_concurrent',
                wa_message_id: 'wamid.CONCURRENT_DELIVERY_TEST_123',
                wa_phone: '5511955554444',
                content: 'Entrega simultânea',
                metadata: JSON.stringify({ phoneNumberId: 'phone_concurrent', wabaId: 'waba_concurrent' }),
                attempts: 0,
                status: 'received'
            }];

            mockDb.query.mockImplementation(async (sql) => {
                if (typeof sql === 'string' && sql.includes('INSERT INTO whatsapp_messages')) {
                    insertCount++;
                    // Apenas a primeira operação de INSERT adquire o lock do índice único (ON CONFLICT DO NOTHING)
                    if (insertCount === 1) {
                        return { rows: [{ id: 'claim_1' }], rowCount: 1 };
                    } else {
                        // Conflito atômico na constraint do banco: 0 rows afetadas
                        return { rows: [], rowCount: 0 };
                    }
                }
                if (typeof sql === 'string' && sql.includes('SELECT id, tenant_id, api_key, wa_message_id')) {
                    const current = queueRows;
                    queueRows = [];
                    return { rows: current };
                }
                return { rows: [tenantSettings] };
            });

            const spyProcess = jest.spyOn(channel, '_processIncomingMessage').mockResolvedValue();

            const body = {
                object: 'whatsapp_business_account',
                entry: [
                    {
                        id: 'waba_concurrent',
                        changes: [
                            {
                                field: 'messages',
                                value: {
                                    metadata: { phone_number_id: 'phone_concurrent' },
                                    messages: [
                                        {
                                            from: '5511955554444',
                                            id: 'wamid.CONCURRENT_DELIVERY_TEST_123',
                                            type: 'text',
                                            text: { body: 'Entrega simultânea' }
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                ]
            };

            const req1 = createSignedWebhookReq(body);
            const req2 = createSignedWebhookReq(body);

            const res1 = { status: jest.fn().mockReturnThis(), send: jest.fn() };
            const res2 = { status: jest.fn().mockReturnThis(), send: jest.fn() };

            const handler = registeredRoutes['POST /api/webhook/meta'];

            // Executar ambas as requisições em paralelo (concorrência real)
            await Promise.all([
                handler(req1, res1),
                handler(req2, res2)
            ]);

            // Ambas retornam 200 EVENT_RECEIVED para a Meta
            expect(res1.status).toHaveBeenCalledWith(200);
            expect(res2.status).toHaveBeenCalledWith(200);

            // Nenhuma execução inline no webhook
            expect(spyProcess).not.toHaveBeenCalled();

            // Consumidor durável processa a fila e executa exatamente uma única vez!
            await channel.processPendingQueue({ batchSize: 5 });
            expect(spyProcess).toHaveBeenCalledTimes(1);
        });

        it('deve deduplicar mensagem mesmo após reinicialização da memória se já existir no banco (persistência L2)', async () => {
            const tenantSettings = {
                api_key: 'lm_tenant_dedup_l2',
                meta_phone_number_id: 'phone_id_dedup_l2',
                meta_access_token: 'token_dedup_l2',
                tenant_uuid: '55555555-5555-5555-5555-555555555555'
            };

            // Simular que o banco já contém a mensagem gravada (ON CONFLICT retornará 0 rows)
            mockDb.query.mockImplementation(async (sql, params) => {
                if (typeof sql === 'string' && sql.includes('INSERT INTO whatsapp_messages')) {
                    // Já existia no banco: 0 linhas inseridas
                    return { rows: [], rowCount: 0 };
                }
                return { rows: [tenantSettings] };
            });

            // Limpar cache em memória para simular reinicialização do servidor
            channel.clearDedupCache();
            const spyProcess = jest.spyOn(channel, '_processIncomingMessage').mockResolvedValue();

            const body = {
                object: 'whatsapp_business_account',
                entry: [
                    {
                        id: 'waba_dedup',
                        changes: [
                            {
                                field: 'messages',
                                value: {
                                    metadata: { phone_number_id: 'phone_id_dedup_l2' },
                                    messages: [
                                        {
                                            from: '5511911112222',
                                            id: 'wamid.PERSISTENT_L2_MESSAGE_ID',
                                            type: 'text',
                                            text: { body: 'Mensagem que já estava no banco' }
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                ]
            };

            const req = createSignedWebhookReq(body);
            const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
            const handler = registeredRoutes['POST /api/webhook/meta'];

            await handler(req, res);

            // Confirma que não chamou o processamento porque a mensagem já existia no banco
            expect(spyProcess).not.toHaveBeenCalled();
        });

        it('deve descartar mensagem Meta se o tenant_uuid for nulo ou inválido (fail-closed)', async () => {
            // Tenant sem tenant_uuid canônico
            const invalidTenant = {
                api_key: 'lm_invalid_tenant',
                meta_phone_number_id: 'phone_invalid',
                meta_waba_id: 'waba_invalid',
                meta_access_token: 'token',
                tenant_uuid: null // Não possui UUID canônico
            };

            mockDb.query.mockResolvedValue({ rows: [invalidTenant] });
            const spyProcess = jest.spyOn(channel, '_processIncomingMessage').mockResolvedValue();

            const body = {
                object: 'whatsapp_business_account',
                entry: [
                    {
                        id: 'waba_invalid',
                        changes: [
                            {
                                field: 'messages',
                                value: {
                                    metadata: { phone_number_id: 'phone_invalid' },
                                    messages: [
                                        { from: '5511988887777', id: 'wamid.NO_CANONICAL_UUID', type: 'text', text: { body: 'Teste' } }
                                    ]
                                }
                            }
                        ]
                    }
                ]
            };

            const req = createSignedWebhookReq(body);
            const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
            const handler = registeredRoutes['POST /api/webhook/meta'];

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            // Mensagem NÃO pode ser enviada para processamento nem persistida
            expect(spyProcess).not.toHaveBeenCalled();
        });

        it('_logMessage deve rejeitar fail-closed qualquer mensagem Meta sem tenant_uuid canônico', async () => {
            mockDb.query.mockClear();

            // Chamada direta com tenantId nulo e tenantUuid nulo para provider 'meta'
            await channel._logMessage({
                apiKey: 'some_key',
                waMessageId: 'wamid.ORPHAN',
                waPhone: '+5511999999999',
                direction: 'inbound',
                content: 'Orphan message',
                provider: 'meta',
                tenantId: null,
                tenantUuid: null
            });

            // Requisito D: Nenhuma query executada, persistência bloqueada fail-closed
            expect(mockDb.query).not.toHaveBeenCalled();
        });
    });

    describe('4. Despacho de Mensagens via Meta Graph API v21.0', () => {
        it('deve enviar mensagem para https://graph.facebook.com/v21.0/{phoneId}/messages com header Bearer', async () => {
            const spyPost = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                status: 200,
                data: {
                    messaging_product: 'whatsapp',
                    contacts: [{ input: '5511999998888', wa_id: '5511999998888' }],
                    messages: [{ id: 'wamid.OUTBOUND_MESSAGE_SUCCESS_ID_123' }]
                }
            });

            const result = await channel._sendResponse(
                'dummy_key',
                '55 (11) 99999-8888',
                'Olá! Seu agendamento foi confirmado.',
                'meta',
                null,
                null,
                {
                    phoneNumberId: '10987654321',
                    accessToken: 'EAAB_test_access_token_123456'
                }
            );

            expect(spyPost).toHaveBeenCalledWith(
                'https://graph.facebook.com/v21.0/10987654321/messages',
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: '5511999998888',
                    type: 'text',
                    text: { preview_url: false, body: 'Olá! Seu agendamento foi confirmado.' }
                },
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer EAAB_test_access_token_123456',
                        'Content-Type': 'application/json'
                    })
                })
            );

            expect(result.success).toBe(true);
            expect(result.provider).toBe('meta_cloud_api');
            expect(result.messageId).toBe('wamid.OUTBOUND_MESSAGE_SUCCESS_ID_123');

            spyPost.mockRestore();
        });

        it('deve descriptografar token criptografado antes de enviar para a Graph API', async () => {
            const spyPost = jest.spyOn(axios, 'post').mockResolvedValueOnce({
                status: 200,
                data: { messages: [{ id: 'wamid.DECRYPTED_TOKEN_SENT' }] }
            });

            // Token criptografado com formato ENC:base64
            const rawToken = 'super-secret-meta-access-token';
            const encryptedToken = `ENC:${Buffer.from(rawToken).toString('base64')}`;

            const result = await channel._sendResponse(
                'tenant_api_key_enc',
                '5511977776666',
                'Mensagem com token descriptografado',
                'meta',
                null,
                null,
                {
                    phoneNumberId: '9988776655',
                    accessToken: encryptedToken,
                    tenantUuid: '11111111-1111-1111-1111-111111111111'
                }
            );

            expect(spyPost).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(Object),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: `Bearer ${rawToken}`
                    })
                })
            );

            expect(result.success).toBe(true);
            spyPost.mockRestore();
        });

        it('deve tratar erro da Graph API (ex: rate limit ou token expirado) sem quebrar o servidor', async () => {
            const spyPost = jest.spyOn(axios, 'post').mockRejectedValueOnce({
                response: {
                    status: 400,
                    data: {
                        error: {
                            message: 'Message failed to send because more than 24 hours have passed',
                            type: 'OAuthException',
                            code: 131047,
                            error_subcode: 2494010
                        }
                    }
                }
            });

            const result = await channel._sendResponse(
                'dummy_key',
                '5511999998888',
                'Tentativa após 24h',
                'meta',
                null,
                null,
                {
                    phoneNumberId: '10987654321',
                    accessToken: 'some_token'
                }
            );

            expect(result.success).toBe(false);
            expect(result.provider).toBe('meta_cloud_api');
            expect(result.errorCode).toBe(131047);
            expect(result.error).toContain('24 hours');

            spyPost.mockRestore();
        });
    });

    describe('5. Isolamento Multi-Tenant de Credenciais', () => {
        it('deve usar credenciais estritamente isoladas para cada tenant', async () => {
            const spyPost = jest.spyOn(axios, 'post').mockResolvedValue({
                status: 200,
                data: { messages: [{ id: 'wamid.SUCCESS' }] }
            });

            // Envio para Tenant A
            await channel._sendResponse('key_a', '5511911111111', 'Msg A', 'meta', null, null, {
                phoneNumberId: 'PHONE_A',
                accessToken: 'TOKEN_A'
            });

            expect(spyPost).toHaveBeenLastCalledWith(
                'https://graph.facebook.com/v21.0/PHONE_A/messages',
                expect.any(Object),
                expect.objectContaining({
                    headers: expect.objectContaining({ Authorization: 'Bearer TOKEN_A' })
                })
            );

            // Envio para Tenant B
            await channel._sendResponse('key_b', '5511922222222', 'Msg B', 'meta', null, null, {
                phoneNumberId: 'PHONE_B',
                accessToken: 'TOKEN_B'
            });

            expect(spyPost).toHaveBeenLastCalledWith(
                'https://graph.facebook.com/v21.0/PHONE_B/messages',
                expect.any(Object),
                expect.objectContaining({
                    headers: expect.objectContaining({ Authorization: 'Bearer TOKEN_B' })
                })
            );

            spyPost.mockRestore();
        });
    });

    describe('6. Fallback de Segurança ADMIN_SECRET_KEY na rota de métricas', () => {
        it('deve autenticar rota de métricas usando ADMIN_SECRET_KEY quando ADMIN_API_KEY não existe', async () => {
            const req = {
                headers: { 'x-admin-key': 'admin-super-secret-key-999' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const handler = registeredRoutes['GET /api/whatsapp/webhook-metrics'];
            expect(handler).toBeDefined();

            await handler(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                metrics: expect.any(Object)
            }));
        });

        it('deve rejeitar com 403 Forbidden quando x-admin-key não confere com ADMIN_SECRET_KEY', async () => {
            const req = {
                headers: { 'x-admin-key': 'wrong-admin-key' }
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            const handler = registeredRoutes['GET /api/whatsapp/webhook-metrics'];
            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
        });
    });

    describe('7. Consultas CRM e Isolamento Multi-Tenant (Correção E)', () => {
        let whatsappRoutesHandler;
        let crmRoutes = {};

        beforeAll(() => {
            const mockCrmApp = {
                get: jest.fn((path, handler) => { crmRoutes[`GET ${path}`] = handler; }),
                post: jest.fn((path, handler) => { crmRoutes[`POST ${path}`] = handler; }),
                put: jest.fn((path, handler) => { crmRoutes[`PUT ${path}`] = handler; }),
                delete: jest.fn((path, handler) => { crmRoutes[`DELETE ${path}`] = handler; })
            };
            const registerWhatsappRoutes = require('../../whatsapp-routes');
            registerWhatsappRoutes(mockCrmApp, { error: jest.fn(), warn: jest.fn(), info: jest.fn(), log: jest.fn() });
            whatsappRoutesHandler = crmRoutes['GET /api/whatsapp/messages'];
        });

        it('Tenant A consulta suas mensagens e query restringe estritamente por tenant_uuid', async () => {
            const tenantAUuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
            let executedQuery = '';
            let executedParams = [];

            const dbModule = require('../../database');
            const spyDb = jest.spyOn(dbModule.db, 'query').mockImplementation(async (sql, params) => {
                executedQuery = sql;
                executedParams = params;
                return {
                    rows: [
                        { id: 'msg_a1', tenant_uuid: tenantAUuid, content: 'Olá Tenant A' }
                    ]
                };
            });

            const req = {
                headers: { 'x-api-key': 'key_tenant_a' },
                session: { tenantUuid: tenantAUuid },
                query: {}
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await whatsappRoutesHandler(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                messages: expect.arrayContaining([
                    expect.objectContaining({ id: 'msg_a1' })
                ])
            }));

            // Confirma que a query utilizou o tenant_uuid canônico
            expect(executedQuery).toContain('m.tenant_uuid');
            expect(executedParams).toContain(tenantAUuid);

            spyDb.mockRestore();
        });

        it('Tenant B não acessa mensagens do Tenant A (isolamento garantido na query)', async () => {
            const tenantBUuid = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
            let executedParams = [];

            const dbModule = require('../../database');
            const spyDb = jest.spyOn(dbModule.db, 'query').mockImplementation(async (sql, params) => {
                executedParams = params;
                return { rows: [] };
            });

            const req = {
                headers: { 'x-api-key': 'key_tenant_b' },
                session: { tenantUuid: tenantBUuid },
                query: {}
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await whatsappRoutesHandler(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                messages: []
            }));

            expect(executedParams[0]).toBe(tenantBUuid);
            expect(executedParams).not.toContain('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

            spyDb.mockRestore();
        });

        it('JOIN com tenant_leads possui isolamento explícito de tenant para evitar cross-tenant leak', async () => {
            let executedQuery = '';

            const dbModule = require('../../database');
            const spyDb = jest.spyOn(dbModule.db, 'query').mockImplementation(async (sql) => {
                executedQuery = sql;
                return { rows: [] };
            });

            const req = {
                headers: { 'x-api-key': 'key_tenant_x' },
                session: { tenantUuid: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
                query: {}
            };
            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            await whatsappRoutesHandler(req, res);

            // Verifica que o LEFT JOIN tenant_leads possui isolamento por tenant_uuid
            expect(executedQuery).toMatch(/LEFT JOIN tenant_leads l ON m\.lead_id = l\.id\s+AND \(\(l\.tenant_uuid IS NOT NULL AND l\.tenant_uuid =/);

            spyDb.mockRestore();
        });
    });

    describe('8. Fila Durável, Resiliência e Migração Segura', () => {
        const { checkHistoricalDuplicatesForUniqueIndex, runPhase2c3Migrations } = require('../../database');

        it('deve sinalizar pendingQueue e acionar processPendingQueue quando Meta reenvia mensagem que ainda está em received', async () => {
            const spyProcessQueue = jest.spyOn(channel, 'processPendingQueue').mockResolvedValue({ processed: 1 });

            // Simular que o INSERT deu conflito (já existia)
            mockDb.query
                .mockResolvedValueOnce({ rowCount: 0 }) // INSERT conflitou
                .mockResolvedValueOnce({ rows: [{ id: 'msg_rec_1', status: 'received', attempts: 0 }] }); // SELECT de verificação

            const result = await channel._claimAndPersistInboundMessage({
                apiKey: 'test_key',
                tenantUuid: '11111111-1111-1111-1111-111111111111',
                waMessageId: 'wamid.retry.123',
                senderPhone: '5511999999999',
                text: 'Oi',
                phoneNumberId: 'p1',
                wabaId: 'w1'
            });

            expect(result.claimed).toBe(false);
            expect(result.pendingQueue).toBe(true);
            expect(result.id).toBe('msg_rec_1');

            spyProcessQueue.mockRestore();
        });

        it('processPendingQueue deve buscar mensagens pendentes, processar e marcar delivered', async () => {
            const pendingRow = {
                id: 'msg_pending_99',
                tenant_id: '11111111-1111-1111-1111-111111111111',
                api_key: 'lm_meta_tenant_key_111',
                wa_message_id: 'wamid.pending.99',
                wa_phone: '5511999999999',
                content: 'Olá pendente',
                metadata: JSON.stringify({ phoneNumberId: 'phone_id_999', wabaId: 'waba_id_888' }),
                attempts: 0,
                outbound_sent: false,
                tenant_uuid: '11111111-1111-1111-1111-111111111111',
                status: 'received'
            };

            const tenantSettings = {
                id: 1,
                api_key: 'lm_meta_tenant_key_111',
                meta_phone_number_id: 'phone_id_999',
                meta_waba_id: 'waba_id_888',
                meta_access_token: 'meta_valid_token_xyz',
                meta_app_secret: 'app_secret_123',
                tenant_uuid: '11111111-1111-1111-1111-111111111111',
                channel_mode: 'auto'
            };

            mockDb.query.mockImplementation(async (sql) => {
                if (sql.includes('SELECT id, tenant_id, api_key, wa_message_id')) {
                    return { rows: [pendingRow] };
                }
                if (sql.includes('SELECT * FROM whatsapp_settings') || sql.includes('SELECT id, api_key, meta_phone_number_id')) {
                    return { rows: [tenantSettings] };
                }
                return { rows: [], rowCount: 1 };
            });

            const spyProcess = jest.spyOn(channel, '_processIncomingMessage').mockResolvedValue();
            const spyMarkDelivered = jest.spyOn(channel, '_markMessageDelivered').mockResolvedValue();

            const res = await channel.processPendingQueue({ batchSize: 5 });

            expect(res.processed).toBe(1);
            expect(spyProcess).toHaveBeenCalledWith(expect.objectContaining({
                waMessageId: 'wamid.pending.99',
                apiKey: 'lm_meta_tenant_key_111'
            }));
            expect(spyMarkDelivered).toHaveBeenCalledWith('msg_pending_99', '11111111-1111-1111-1111-111111111111', 'wamid.pending.99', expect.any(String));

            spyProcess.mockRestore();
            spyMarkDelivered.mockRestore();
        });

        it('processPendingQueue deve registrar falha com retryable ou failed se o processamento lançar exceção', async () => {
            const pendingRow = {
                id: 'msg_fail_99',
                tenant_id: '11111111-1111-1111-1111-111111111111',
                api_key: 'lm_meta_tenant_key_111',
                wa_message_id: 'wamid.fail.99',
                wa_phone: '5511999999999',
                content: 'Olá erro',
                metadata: JSON.stringify({ phoneNumberId: 'phone_id_999', wabaId: 'waba_id_888' }),
                attempts: 2,
                outbound_sent: false,
                tenant_uuid: '11111111-1111-1111-1111-111111111111',
                status: 'retryable'
            };

            mockDb.query.mockImplementation(async (sql) => {
                if (sql.includes('SELECT id, tenant_id, api_key, wa_message_id')) {
                    return { rows: [pendingRow] };
                }
                return { rows: [], rowCount: 1 };
            });

            jest.spyOn(channel, '_resolveMetaTenant').mockResolvedValue({
                api_key: 'lm_meta_tenant_key_111',
                tenant_uuid: '11111111-1111-1111-1111-111111111111'
            });

            jest.spyOn(channel, '_processIncomingMessage').mockRejectedValue(new Error('AI model failure'));
            const spyMarkFailed = jest.spyOn(channel, '_markMessageFailed').mockResolvedValue();

            const res = await channel.processPendingQueue({ batchSize: 5, maxAttempts: 3 });

            expect(res.processed).toBe(0);
            expect(spyMarkFailed).toHaveBeenCalledWith('msg_fail_99', 'AI model failure', 3, 3, expect.any(String));

            channel._resolveMetaTenant.mockRestore();
            channel._processIncomingMessage.mockRestore();
            spyMarkFailed.mockRestore();
        });

        it('outboundSent true deve prevenir novo envio de resposta na Meta Graph API', async () => {
            const spySendResponse = jest.spyOn(channel, '_sendResponse');
            jest.spyOn(channel, '_callUnifiedBrain').mockResolvedValue({ response: 'Resposta de teste' });

            await channel._processIncomingMessage({
                apiKey: 'lm_meta_tenant_key_111',
                channelMode: 'auto',
                notifPhone: null,
                phone: '5511999999999',
                pushName: 'Teste',
                text: 'Olá',
                waMessageId: 'wamid.already.sent',
                provider: 'meta',
                instanceName: 'meta_p1',
                instanceToken: 'token_xyz',
                extraOptions: {
                    tenantUuid: '11111111-1111-1111-1111-111111111111',
                    persistedRecordId: 'msg_already_sent_1',
                    outboundSent: true
                }
            });

            // Como outboundSent=true, _sendResponse NÃO deve ser chamado
            expect(spySendResponse).not.toHaveBeenCalled();

            spySendResponse.mockRestore();
            channel._callUnifiedBrain.mockRestore();
        });

        it('checkHistoricalDuplicatesForUniqueIndex deve detectar grupos duplicados sem alterar dados', async () => {
            const mockDbWithDups = {
                query: jest.fn()
                    .mockResolvedValueOnce({ rows: [{ exists_table: 'whatsapp_messages' }] })
                    .mockResolvedValueOnce({
                        rows: [
                            { tenant_uuid: '11111111-1111-1111-1111-111111111111', provider: 'meta', wa_message_id: 'dup.wamid.1', count: 2 }
                        ]
                    })
            };

            const dupCheck = await checkHistoricalDuplicatesForUniqueIndex(mockDbWithDups, true);
            expect(dupCheck.hasDuplicates).toBe(true);
            expect(dupCheck.count).toBe(2);
            expect(dupCheck.groupsCount).toBe(1);
            expect(dupCheck.duplicates[0].wa_message_id).toBe('dup.wamid.1');
        });

        it('runPhase2c3Migrations deve abortar de forma limpa e descritiva quando duplicidades históricas existem', async () => {
            const mockDbWithDups = {
                query: jest.fn().mockImplementation(async (sql) => {
                    if (sql.includes("to_regclass('public.whatsapp_messages')")) {
                        return { rows: [{ exists_table: 'whatsapp_messages' }] };
                    }
                    if (sql.includes('SELECT tenant_uuid, provider, wa_message_id')) {
                        return {
                            rows: [
                                { tenant_uuid: '11111111-1111-1111-1111-111111111111', provider: 'meta', wa_message_id: 'dup.wamid.1', count: 3 }
                            ]
                        };
                    }
                    return { rows: [], rowCount: 1 };
                })
            };

            const res = await runPhase2c3Migrations(mockDbWithDups, true);
            expect(res.success).toBe(false);
            expect(res.error).toContain('[MIGRATION-ABORTED]');
            expect(res.error).toContain('Duplicidades históricas detectadas');
            expect(res.duplicateDetails.hasDuplicates).toBe(true);
            expect(res.duplicateDetails.count).toBe(3);
        });
    });

    describe('9. Correções Finais: Exclusão Mútua, Backoff, Atomicidade e Outbound Safety', () => {
        const { runPhase2c3Migrations } = require('../../database');

        it('1. Webhook insere com status received e sem processamento inline', async () => {
            let insertSql = '';
            const insertedParams = [];
            mockDb.query.mockImplementation(async (sql, params) => {
                if (typeof sql === 'string' && sql.includes('INSERT INTO whatsapp_messages')) {
                    insertSql = sql;
                    insertedParams.push(params);
                    return { rows: [{ id: 'atomic_claim_1' }], rowCount: 1 };
                }
                return { rows: [{ api_key: 'key1', tenant_uuid: '11111111-1111-1111-1111-111111111111' }] };
            });

            const res = await channel._claimAndPersistInboundMessage({
                apiKey: 'key1',
                tenantUuid: '11111111-1111-1111-1111-111111111111',
                waMessageId: 'wamid.atomic.1',
                senderPhone: '5511999999999',
                text: 'Teste atômico',
                phoneNumberId: 'p1',
                wabaId: 'w1',
                pushName: 'User'
            });

            expect(res.claimed).toBe(true);
            expect(typeof res.id).toBe('string');
            expect(res.id.length).toBe(24);
            expect(insertedParams.length).toBe(1);
            expect(insertSql).toContain("'received'");
        });

        it('2. Worker processPendingQueue filtra e respeita locked_until para mensagens retryable', async () => {
            let capturedSelectSql = '';
            mockDb.query.mockImplementation(async (sql) => {
                if (typeof sql === 'string' && sql.includes('SELECT id, tenant_id, api_key, wa_message_id')) {
                    capturedSelectSql = sql;
                    return { rows: [] };
                }
                return { rows: [], rowCount: 0 };
            });

            await channel.processPendingQueue({ batchSize: 5 });

            expect(capturedSelectSql).toContain("status = 'retryable' AND (locked_until IS NULL OR locked_until <=");
            expect(capturedSelectSql).toContain("status = 'processing' AND (locked_until IS NULL OR locked_until <");
        });

        it('3. runPhase2c3Migrations aborta na pré-validação antes de qualquer DDL quando duplicidades existem', async () => {
            const executedQueries = [];
            const mockDbAtomic = {
                query: jest.fn().mockImplementation(async (sql) => {
                    executedQueries.push(sql);
                    if (sql.includes("to_regclass('public.whatsapp_messages')")) {
                        return { rows: [{ exists_table: 'whatsapp_messages' }] };
                    }
                    if (sql.includes('SELECT tenant_uuid, provider, wa_message_id')) {
                        return {
                            rows: [
                                { tenant_uuid: '11111111-1111-1111-1111-111111111111', provider: 'meta', wa_message_id: 'dup.wamid.pre', count: 2 }
                            ]
                        };
                    }
                    return { rows: [], rowCount: 1 };
                })
            };

            const res = await runPhase2c3Migrations(mockDbAtomic, true);

            expect(res.success).toBe(false);
            expect(res.error).toContain('[MIGRATION-ABORTED]');
            // Nenhuma instrução ALTER TABLE deve ter sido executada
            const alterQueries = executedQueries.filter(q => typeof q === 'string' && q.includes('ALTER TABLE'));
            expect(alterQueries.length).toBe(0);
        });

        it('4. _dispatchOutboundWithSafety registra sending antes do POST, sent com WAMID pós-Meta e bloqueia outbound_unknown', async () => {
            const recordedStates = [];
            mockDb.query.mockImplementation(async (sql, params) => {
                if (typeof sql === 'string' && sql.includes('outbound_status')) {
                    recordedStates.push({ sql, params });
                    return { rowCount: 1 };
                }
                return { rows: [] };
            });

            const spySend = jest.spyOn(channel, '_sendResponse').mockResolvedValue({
                success: true,
                provider: 'meta_cloud_api',
                messageId: 'wamid.outbound.confirmed.123'
            });

            // 1. Envio normal bem-sucedido
            const resSuccess = await channel._dispatchOutboundWithSafety({
                apiKey: 'key_safe',
                phone: '5511999999999',
                message: 'Olá seguro',
                provider: 'meta',
                instanceName: 'meta_p1',
                instanceToken: 'token1',
                extraOptions: { persistedRecordId: 'msg_safe_1', tenantUuid: '11111111-1111-1111-1111-111111111111' },
                conversationId: 'conv1'
            });

            expect(resSuccess.success).toBe(true);
            expect(resSuccess.messageId).toBe('wamid.outbound.confirmed.123');

            // Verificação da ordem das transições: primeiro 'sending', depois 'sent' com wamid
            const sendingUpdate = recordedStates.find(s => s.sql.includes("outbound_status = 'sending'"));
            expect(sendingUpdate).toBeDefined();
            expect(sendingUpdate.params).toContain('msg_safe_1');

            const sentUpdate = recordedStates.find(s => s.sql.includes("outbound_status = 'sent'"));
            expect(sentUpdate).toBeDefined();
            expect(sentUpdate.params).toContain('wamid.outbound.confirmed.123');

            // 2. Tentativa de reenvio com registro em 'outbound_unknown': deve bloquear reenvio
            spySend.mockClear();
            const resBlocked = await channel._dispatchOutboundWithSafety({
                apiKey: 'key_safe',
                phone: '5511999999999',
                message: 'Tentativa duplicada',
                provider: 'meta',
                instanceName: 'meta_p1',
                instanceToken: 'token1',
                extraOptions: {
                    persistedRecordId: 'msg_unknown_99',
                    outboundStatus: 'outbound_unknown',
                    tenantUuid: '11111111-1111-1111-1111-111111111111'
                },
                conversationId: 'conv1'
            });

            expect(resBlocked.success).toBe(false);
            expect(resBlocked.ambiguous).toBe(true);
            expect(spySend).not.toHaveBeenCalled();

            spySend.mockRestore();
        });

        it('5. Fallback da IA utiliza obrigatoriamente _dispatchOutboundWithSafety sem bypass direto', async () => {
            const spyDispatch = jest.spyOn(channel, '_dispatchOutboundWithSafety').mockResolvedValue({ success: true, messageId: 'wamid.fallback.1' });
            const spySendDirect = jest.spyOn(channel, '_sendResponse');

            // Simular IA retornando vazio/sem resposta para acionar o fallback
            jest.spyOn(channel, '_callUnifiedBrain').mockResolvedValueOnce({ response: null });

            await channel._processIncomingMessage({
                apiKey: 'test_key',
                channelMode: 'auto',
                phone: '5511999990001',
                text: 'Olá',
                waMessageId: 'wamid.fallback.trigger',
                provider: 'meta',
                extraOptions: { persistedRecordId: 'rec_fb_1', tenantUuid: '11111111-1111-1111-1111-111111111111' }
            });

            // Deve ter acionado _dispatchOutboundWithSafety com o texto de fallback
            expect(spyDispatch).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Recebi sua mensagem! Em breve retornaremos.',
                provider: 'meta',
                extraOptions: expect.objectContaining({ persistedRecordId: 'rec_fb_1' })
            }));

            // Nenhum bypass direto para _sendResponse
            expect(spySendDirect).not.toHaveBeenCalled();

            spyDispatch.mockRestore();
            spySendDirect.mockRestore();
            channel._callUnifiedBrain.mockRestore();
        });

        it('6. Lease CAS: _renewLease com lease_token incorreto falha e bloqueia despacho outbound', async () => {
            mockDb.query.mockImplementation(async (sql, params) => {
                if (typeof sql === 'string' && sql.includes('UPDATE whatsapp_messages SET locked_until')) {
                    // Simular que o lease_token não confere (outra execução assumiu): 0 rows
                    return { rowCount: 0, rows: [] };
                }
                return { rows: [] };
            });

            // 1. Renovação com token antigo deve retornar false
            const renewSuccess = await channel._renewLease('rec_lost_1', 'old-lease-token-123', 60);
            expect(renewSuccess).toBe(false);

            // 2. Despacho com posse perdida (isLeaseActive false) deve abortar e não chamar Meta
            const spySend = jest.spyOn(channel, '_sendResponse');
            const resAborted = await channel._dispatchOutboundWithSafety({
                apiKey: 'key1',
                phone: '5511999990001',
                message: 'Resposta atrasada',
                provider: 'meta',
                extraOptions: {
                    persistedRecordId: 'rec_lost_1',
                    leaseToken: 'old-lease-token-123',
                    isLeaseActive: () => false // Posse perdida
                }
            });

            expect(resAborted.success).toBe(false);
            expect(resAborted.leaseLost).toBe(true);
            expect(spySend).not.toHaveBeenCalled();

            spySend.mockRestore();
        });
    });
});
