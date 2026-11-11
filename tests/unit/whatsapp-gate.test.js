'use strict';

const { isWhatsAppOperational } = require('../../lib/whatsapp-gate');

describe('🔒 WhatsApp Gate — Fail-Closed Operational Control', () => {
    const originalEnv = process.env.FEATURE_WHATSAPP_OPERATIONAL;

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.FEATURE_WHATSAPP_OPERATIONAL;
        } else {
            process.env.FEATURE_WHATSAPP_OPERATIONAL = originalEnv;
        }
    });

    test('deve retornar false quando a variável estiver ausente', () => {
        delete process.env.FEATURE_WHATSAPP_OPERATIONAL;
        expect(isWhatsAppOperational()).toBe(false);
    });

    test('deve retornar false quando a variável for string vazia', () => {
        process.env.FEATURE_WHATSAPP_OPERATIONAL = '';
        expect(isWhatsAppOperational()).toBe(false);
    });

    test('deve retornar false quando a variável for "false"', () => {
        process.env.FEATURE_WHATSAPP_OPERATIONAL = 'false';
        expect(isWhatsAppOperational()).toBe(false);
    });

    test('deve retornar false para valores comumente interpretados como true (fail-closed estrito)', () => {
        const truthyVariants = ['1', 'yes', 'enabled', 'true ', 'True', 'TRUE', 'ok', 'active'];
        for (const val of truthyVariants) {
            process.env.FEATURE_WHATSAPP_OPERATIONAL = val;
            expect(isWhatsAppOperational()).toBe(false);
        }
    });

    test('deve retornar false para valores inválidos ou aleatórios', () => {
        const invalidVariants = ['null', 'undefined', '0', 'no', 'disabled', 'xyz'];
        for (const val of invalidVariants) {
            process.env.FEATURE_WHATSAPP_OPERATIONAL = val;
            expect(isWhatsAppOperational()).toBe(false);
        }
    });

    test('deve retornar true ESTRITAMENTE quando o valor for "true"', () => {
        process.env.FEATURE_WHATSAPP_OPERATIONAL = 'true';
        expect(isWhatsAppOperational()).toBe(true);
    });
});
