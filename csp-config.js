// csp-config.js - NOVO ARQUIVO
const helmet = require('helmet');

class CSPConfig {
    constructor() {
        this.cspDirectives = {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'", 
                "'unsafe-inline'", 
                "https://cdnjs.cloudflare.com",
                "https://ajax.googleapis.com"
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'", 
                "https://fonts.googleapis.com",
                "https://cdnjs.cloudflare.com"
            ],
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com",
                "https://cdnjs.cloudflare.com"
            ],
            imgSrc: [
                "'self'",
                "data:",
                "https:",
                "blob:"
            ],
            connectSrc: [
                "'self'",
                "https://linkmagico-comercial.onrender.com",
                "wss://linkmagico-comercial.onrender.com"
            ],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            manifestSrc: ["'self'"],
            workerSrc: ["'self'", "blob:"],
            formAction: ["'self'"],
            baseUri: ["'self'"],
            frameAncestors: ["'none'"],
            reportUri: "/api/security/csp-violation"
        };

        this.helmetConfig = {
            contentSecurityPolicy: {
                directives: this.cspDirectives,
                reportOnly: false // Bloquear violações em produção
            },
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            },
            crossOriginEmbedderPolicy: true,
            crossOriginOpenerPolicy: { policy: "same-origin" },
            crossOriginResourcePolicy: { policy: "same-origin" },
            referrerPolicy: { policy: "strict-origin-when-cross-origin" },
            noSniff: true,
            ieNoOpen: true,
            hidePoweredBy: true,
            frameguard: { action: 'deny' }
        };
    }

    getMiddleware() {
        return helmet(this.helmetConfig);
    }

    // Endpoint para relatar violações CSP
    handleCSPViolation(req, res) {
        const violation = req.body;
        
        console.log('🚨 Violação de CSP detectada:', {
            violatedDirective: violation['violated-directive'],
            blockedURI: violation['blocked-uri'],
            documentURI: violation['document-uri'],
            originalPolicy: violation['original-policy'],
            timestamp: new Date().toISOString(),
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        res.status(204).send(); // No content
    }

    // Configuração para desenvolvimento (menos restritiva)
    getDevMiddleware() {
        const devConfig = {
            ...this.helmetConfig,
            contentSecurityPolicy: {
                directives: {
                    ...this.cspDirectives,
                    reportOnly: true // Apenas reportar em desenvolvimento
                }
            }
        };

        return helmet(devConfig);
    }
}

module.exports = CSPConfig;
