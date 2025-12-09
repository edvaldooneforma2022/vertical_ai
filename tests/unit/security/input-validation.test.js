/**
 * Testes Unitários - Security System
 * Testa validação de inputs e detecção de ameaças
 */

// Importar módulo a testar
const {
    InputValidationSystem,
    ThreatDetectionSystem,
    RateLimitSystem
} = require('../../security-system');

describe('InputValidationSystem', () => {
    let validator;

    beforeEach(() => {
        validator = new InputValidationSystem();
    });

    describe('validateURL', () => {
        test('deve aceitar URLs válidas com HTTPS', () => {
            const result = validator.validateURL('https://example.com');
            expect(result.isValid).toBe(true);
        });

        test('deve aceitar URLs válidas com HTTP', () => {
            const result = validator.validateURL('http://example.com');
            expect(result.isValid).toBe(true);
        });

        test('deve rejeitar URLs inválidas', () => {
            const result = validator.validateURL('not-a-url');
            expect(result.isValid).toBe(false);
        });

        test('deve rejeitar URLs vazias', () => {
            const result = validator.validateURL('');
            expect(result.isValid).toBe(false);
        });

        test('deve rejeitar URLs com protocolo javascript:', () => {
            const result = validator.validateURL('javascript:alert(1)');
            expect(result.isValid).toBe(false);
        });
    });

    describe('validateMessage', () => {
        test('deve aceitar mensagens normais', () => {
            const result = validator.validateMessage('Olá, preciso de ajuda');
            expect(result.isValid).toBe(true);
        });

        test('deve rejeitar mensagens vazias', () => {
            const result = validator.validateMessage('');
            expect(result.isValid).toBe(false);
        });

        test('deve sanitizar scripts maliciosos', () => {
            const result = validator.validateMessage('<script>alert("xss")</script>');
            expect(result.sanitized).not.toContain('<script>');
        });

        test('deve rejeitar mensagens muito longas', () => {
            const longMessage = 'a'.repeat(10001);
            const result = validator.validateMessage(longMessage);
            expect(result.isValid).toBe(false);
        });
    });

    describe('validateEmail', () => {
        test('deve aceitar emails válidos', () => {
            const result = validator.validateEmail('teste@example.com');
            expect(result.isValid).toBe(true);
        });

        test('deve rejeitar emails inválidos', () => {
            const result = validator.validateEmail('email-invalido');
            expect(result.isValid).toBe(false);
        });

        test('deve rejeitar emails vazios', () => {
            const result = validator.validateEmail('');
            expect(result.isValid).toBe(false);
        });
    });

    describe('validateApiKey', () => {
        test('deve aceitar API keys válidas', () => {
            const result = validator.validateApiKey('LMV7-VX9Z-ZSR1-DONX');
            expect(result.isValid).toBe(true);
        });

        test('deve rejeitar API keys vazias', () => {
            const result = validator.validateApiKey('');
            expect(result.isValid).toBe(false);
        });

        test('deve rejeitar API keys muito curtas', () => {
            const result = validator.validateApiKey('abc');
            expect(result.isValid).toBe(false);
        });
    });
});

describe('ThreatDetectionSystem', () => {
    let detector;

    beforeEach(() => {
        detector = new ThreatDetectionSystem();
    });

    describe('containsMaliciousPatterns', () => {
        test('deve detectar scripts maliciosos', () => {
            const result = detector.containsMaliciousPatterns('<script>alert(1)</script>');
            expect(result).toBe(true);
        });

        test('deve detectar tentativas de SQL injection', () => {
            const result = detector.containsMaliciousPatterns("'; DROP TABLE users; --");
            expect(result).toBe(true);
        });

        test('deve aceitar texto normal', () => {
            const result = detector.containsMaliciousPatterns('Olá, preciso de informações sobre o produto');
            expect(result).toBe(false);
        });
    });
});

describe('RateLimitSystem', () => {
    let rateLimiter;

    beforeEach(() => {
        rateLimiter = new RateLimitSystem();
    });

    describe('checkLimit', () => {
        test('deve permitir primeiras requisições', () => {
            const result = rateLimiter.checkLimit('192.168.1.1', 'default');
            expect(result.allowed).toBe(true);
        });

        test('deve bloquear após exceder limite', () => {
            const ip = '192.168.1.100';

            // Simular várias requisições
            for (let i = 0; i < 101; i++) {
                rateLimiter.checkLimit(ip, 'default');
            }

            const result = rateLimiter.checkLimit(ip, 'default');
            expect(result.allowed).toBe(false);
        });

        test('deve ter limites diferentes por endpoint', () => {
            const ip = '192.168.1.200';

            // Limite de auth é mais restritivo (5 tentativas)
            for (let i = 0; i < 6; i++) {
                rateLimiter.checkLimit(ip, 'auth');
            }

            const result = rateLimiter.checkLimit(ip, 'auth');
            expect(result.allowed).toBe(false);
        });
    });
});
