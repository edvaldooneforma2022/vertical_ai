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

    describe('2. Webhook POST — Segurança e Assinatura X-Hub-Signature-256', () => {
        const appSecret = 'my-meta-app-secret-12345';

        beforeEach(() => {
            process.env.META_APP_SECRET = appSecret;
        });

        it('deve validar com sucesso requisição com assinatura HMAC SHA-256 válida', async () => {
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

        it('deve rejeitar com 403 Forbidden quando secret está configurado mas header de assinatura está ausente', async () => {
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
            expect(res.json).toHaveBeenCalledWith({ error: 'Invalid signature' });
        });
    });

    describe('3. Webhook POST — Ingestão de Mensagens e Deduplicação (wamid)', () => {
        it('deve processar mensagem de texto, resolver tenant e disparar pipeline', async () => {
            delete process.env.META_APP_SECRET;

            const tenantSettings = {
                api_key: 'lm_meta_tenant_key_111',
                channel_mode: 'auto',
                notification_phone: '5511999999999',
                meta_phone_number_id: 'phone_id_999',
                meta_waba_id: 'waba_id_888',
                meta_access_token: 'valid_meta_token_abc',
                tenant_uuid: '11111111-1111-1111-1111-111111111111'
            };

            mockDb.query.mockResolvedValueOnce({ rows: [tenantSettings] });

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

            const req = { body, headers: {} };
            const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };

            const handler = registeredRoutes['POST /api/webhook/meta'];
            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith('EVENT_RECEIVED');
            expect(spyProcess).toHaveBeenCalledWith(expect.objectContaining({
                apiKey: 'lm_meta_tenant_key_111',
                phone: '5511988887777',
                pushName: 'Maria Silva',
                text: 'Gostaria de agendar uma consulta',
                waMessageId: 'wamid.HBgLMTE5ODg4ODc3NzcVAgASGBQzQTkyREI4RDQyQzQ0MzVGREQxOQA=',
                provider: 'meta',
                extraOptions: expect.objectContaining({
                    phoneNumberId: 'phone_id_999',
                    wabaId: 'waba_id_888',
                    tenantUuid: '11111111-1111-1111-1111-111111111111'
                })
            }));
        });

        it('deve deduplicar e ignorar mensagens recebidas repetidas vezes com o mesmo wamid', async () => {
            delete process.env.META_APP_SECRET;

            const tenantSettings = {
                api_key: 'lm_tenant_dedup',
                meta_phone_number_id: 'phone_id_dedup',
                meta_access_token: 'token_dedup'
            };

            mockDb.query.mockResolvedValue({ rows: [tenantSettings] });
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

            const req = { body, headers: {} };
            const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };

            const handler = registeredRoutes['POST /api/webhook/meta'];

            // Primeira chamada: processa normalmente
            await handler(req, res);
            expect(spyProcess).toHaveBeenCalledTimes(1);

            // Segunda chamada: deduplica e não processa novamente
            await handler(req, res);
            expect(spyProcess).toHaveBeenCalledTimes(1);
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
});
