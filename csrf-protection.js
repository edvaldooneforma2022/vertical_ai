// csrf-protection.js - NOVO ARQUIVO
const csrf = require('csurf');

class CSRFProtection {
    constructor() {
        this.csrfProtection = csrf({
            cookie: {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 3600 // 1 hora
            }
        });
    }

    // Middleware CSRF
    getMiddleware() {
        return this.csrfProtection;
    }

    // Endpoint para obter token CSRF
    getCSRFToken(req, res) {
        res.json({
            success: true,
            csrfToken: req.csrfToken(),
            timestamp: Date.now(),
            expiresIn: '1 hour'
        });
    }

    // Middleware de verificação CSRF customizado
    verifyCSRF(req, res, next) {
        // Skip CSRF para webhooks e APIs externas
        if (this.shouldSkipCSRF(req)) {
            return next();
        }

        return this.csrfProtection(req, res, next);
    }

    shouldSkipCSRF(req) {
        const skipPaths = ['/webhook/', '/api/external/'];
        return skipPaths.some(path => req.path.startsWith(path));
    }
}

module.exports = CSRFProtection;