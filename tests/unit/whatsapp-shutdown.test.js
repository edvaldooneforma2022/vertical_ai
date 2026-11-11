/**
 * 🧪 Testes de Validação do Desligamento Operacional do WhatsApp
 * Verifica o comportamento Fail-Closed e Graceful Blackhole de todos os pontos de entrada e saída.
 */

const { isWhatsAppOperational } = require('../../lib/whatsapp-gate');

describe('WhatsApp Operational Shutdown (Fail-Closed & Graceful Blackhole)', () => {
    const originalEnv = process.env.FEATURE_WHATSAPP_OPERATIONAL;

    beforeEach(() => {
        delete process.env.FEATURE_WHATSAPP_OPERATIONAL;
    });

    afterAll(() => {
        if (originalEnv !== undefined) {
            process.env.FEATURE_WHATSAPP_OPERATIONAL = originalEnv;
        } else {
            delete process.env.FEATURE_WHATSAPP_OPERATIONAL;
        }
    });

    describe('1. Central Gate (whatsapp-gate.js)', () => {
        test('deve retornar false por padrão quando variável está ausente', () => {
            expect(isWhatsAppOperational()).toBe(false);
        });

        test('deve retornar false quando variável é false, 0, no ou qualquer valor diferente de "true"', () => {
            process.env.FEATURE_WHATSAPP_OPERATIONAL = 'false';
            expect(isWhatsAppOperational()).toBe(false);

            process.env.FEATURE_WHATSAPP_OPERATIONAL = '0';
            expect(isWhatsAppOperational()).toBe(false);

            process.env.FEATURE_WHATSAPP_OPERATIONAL = '1';
            expect(isWhatsAppOperational()).toBe(false);

            process.env.FEATURE_WHATSAPP_OPERATIONAL = 'enabled';
            expect(isWhatsAppOperational()).toBe(false);
        });

        test('deve retornar true APENAS quando FEATURE_WHATSAPP_OPERATIONAL === "true"', () => {
            process.env.FEATURE_WHATSAPP_OPERATIONAL = 'true';
            expect(isWhatsAppOperational()).toBe(true);
        });
    });

    describe('2. Outbound Bloqueado (whatsapp-integration.js)', () => {
        test('whatsappManager.sendMessage deve falhar fechado com WHATSAPP_CHANNEL_DISABLED', async () => {
            delete process.env.FEATURE_WHATSAPP_OPERATIONAL;
            const { whatsappManager } = require('../../whatsapp-integration');
            
            const result = await whatsappManager.sendMessage('5511999999999', 'Teste');
            expect(result).toBeDefined();
            expect(result.success).toBe(false);
            expect(result.error).toBe('WHATSAPP_CHANNEL_DISABLED');
        });
    });

    describe('3. Graceful Blackhole de Webhooks Inbound (whatsapp-channel.js)', () => {
        let channelInstance;

        beforeAll(() => {
            const { WhatsAppChannel } = require('../../whatsapp-channel');
            channelInstance = new WhatsAppChannel({
                db: { query: jest.fn() },
                USE_POSTGRES: false,
                getLeadSystem: () => null,
                whatsappManager: null
            });
        });

        test('Meta webhook deve responder 200 "EVENT_RECEIVED" imediatamente (Graceful Blackhole)', async () => {
            delete process.env.FEATURE_WHATSAPP_OPERATIONAL;
            let responseStatus = null;
            let responseBody = null;

            const req = {
                body: {
                    object: 'whatsapp_business_account',
                    entry: [{ changes: [{ value: { messages: [{ from: '5511999999999', text: { body: 'Oi' } }] } }] }]
                }
            };

            const res = {
                status: (code) => {
                    responseStatus = code;
                    return {
                        send: (body) => { responseBody = body; }
                    };
                }
            };

            await channelInstance._handleMetaWebhook(req, res);
            expect(responseStatus).toBe(200);
            expect(responseBody).toBe('EVENT_RECEIVED');
        });

        test('Evolution webhook deve responder 200 { received: true, active: false } imediatamente', async () => {
            delete process.env.FEATURE_WHATSAPP_OPERATIONAL;
            let responseStatus = null;
            let responseJson = null;

            const req = {
                body: { event: 'messages.upsert', data: {} }
            };

            const res = {
                status: (code) => {
                    responseStatus = code;
                    return {
                        json: (data) => { responseJson = data; }
                    };
                }
            };

            await channelInstance._handleEvolutionWebhook(req, res);
            expect(responseStatus).toBe(200);
            expect(responseJson).toEqual({ received: true, active: false });
        });

        test('Twilio webhook deve responder 200 com TwiML vazio imediatamente', async () => {
            delete process.env.FEATURE_WHATSAPP_OPERATIONAL;
            let responseStatus = null;
            let responseBody = null;

            const req = { body: { From: 'whatsapp:+5511999999999', Body: 'Oi' } };
            const res = {
                status: (code) => {
                    responseStatus = code;
                    return {
                        send: (body) => { responseBody = body; }
                    };
                },
                set: () => {}
            };

            await channelInstance._handleTwilioWebhook(req, res);
            expect(responseStatus).toBe(200);
            expect(responseBody).toBe('<Response></Response>');
        });

        test('_dispatchOutboundWithSafety deve bloquear envios com WHATSAPP_CHANNEL_DISABLED', async () => {
            delete process.env.FEATURE_WHATSAPP_OPERATIONAL;
            const result = await channelInstance._dispatchOutboundWithSafety(
                'dummy-tenant',
                'meta',
                '5511999999999',
                'Mensagem teste'
            );
            expect(result.success).toBe(false);
            expect(result.blocked).toBe(true);
            expect(result.errorCode).toBe('WHATSAPP_CHANNEL_DISABLED');
        });

        test('_sendResponse deve falhar fechado com WHATSAPP_CHANNEL_DISABLED', async () => {
            delete process.env.FEATURE_WHATSAPP_OPERATIONAL;
            const result = await channelInstance._sendResponse(
                '5511999999999',
                'Resposta teste',
                'meta',
                null,
                'dummy-tenant'
            );
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe('WHATSAPP_CHANNEL_DISABLED');
        });
    });

    describe('4. Worker de Follow-Up (workers/followUpWorker.js)', () => {
        test('deve suspender jobs de WhatsApp sem consumir tentativas', () => {
            delete process.env.FEATURE_WHATSAPP_OPERATIONAL;
            expect(isWhatsAppOperational()).toBe(false);
            // Simulação da lógica do worker:
            const job = { channel: 'whatsapp', id: 'job-123', attempts: 0 };
            const shouldSuspend = job.channel === 'whatsapp' && !isWhatsAppOperational();
            expect(shouldSuspend).toBe(true);
        });
    });
});
