// ===== IMPORTAÇÕES NECESSÁRIAS =====
const path = require('path');
const fs = require('fs');
const { performance } = require('perf_hooks');

// ===== SISTEMA DE SEGURANÇA AVANÇADO - LINKMÁGICO =====
class SecuritySystem {
    constructor() {
        console.log("🛡️  SISTEMA DE SEGURANÇA AVANÇADO - Inicializando");
        
        this.threatDetection = new ThreatDetectionSystem();
        this.rateLimiter = new RateLimitSystem();
        this.inputValidator = new InputValidationSystem();
        this.firewall = new ApplicationFirewall();
        this.auditLogger = new SecurityAuditLogger();
        
        this.blockedIPs = new Set();
        this.suspiciousActivities = new Map();
        this.loginAttempts = new Map();
        
        this.startMonitoring();
    }

    // ===== MÉTODO PARA CONFIGURAR HELMET NO EXPRESS =====
    setupSecurityHeaders(app) {
        const helmet = require('helmet');
        
        app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'"],
                    frameSrc: ["'none'"],
                    objectSrc: ["'none'"]
                }
            },
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            },
            referrerPolicy: { policy: "strict-origin-when-cross-origin" },
            crossOriginEmbedderPolicy: true,
            crossOriginOpenerPolicy: { policy: "same-origin" },
            crossOriginResourcePolicy: { policy: "same-origin" }
        }));
        
        console.log("✅ Headers de segurança configurados com Helmet");
    }

    // ===== MIDDLEWARE DE SEGURANÇA GLOBAL =====
    securityMiddleware() {
        return (req, res, next) => {
            const clientIP = this.getClientIP(req);
            const userAgent = req.get('User-Agent') || '';
            
            // 🔒 Verificar se IP está bloqueado
            if (this.blockedIPs.has(clientIP)) {
                this.auditLogger.logBlockedAccess(req);
                return res.status(403).json({ 
                    success: false, 
                    error: "Acesso bloqueado por segurança" 
                });
            }

            // 🚨 Detectar atividades suspeitas
            if (this.threatDetection.isSuspiciousRequest(req)) {
                this.blockedIPs.add(clientIP);
                this.auditLogger.logThreatDetected(req, 'Suspicious request pattern');
                return res.status(403).json({ 
                    success: false, 
                    error: "Atividade suspeita detectada" 
                });
            }

            // ⚡ Rate Limiting por IP
            if (!this.rateLimiter.checkLimit(clientIP)) {
                this.auditLogger.logRateLimitExceeded(req);
                return res.status(429).json({ 
                    success: false, 
                    error: "Muitas requisições. Tente novamente mais tarde." 
                });
            }

            // 🛡️ Validar entrada de dados
            const validationResult = this.inputValidator.validateRequest(req);
            if (!validationResult.valid) {
                this.auditLogger.logInvalidInput(req, validationResult.errors);
                return res.status(400).json({ 
                    success: false, 
                    error: "Dados de entrada inválidos",
                    details: validationResult.errors
                });
            }

            // 🔍 Log de auditoria
            this.auditLogger.logRequest(req);

            next();
        };
    }

    getClientIP(req) {
        return req.ip || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
               '0.0.0.0';
    }

    startMonitoring() {
        // Inicializar monitoramento
        this.securityMonitor = new SecurityMonitor();
        console.log("✅ Sistema de monitoramento de segurança ativado");
    }
}

// ===== SISTEMA DE DETECÇÃO DE AMEAÇAS =====
class ThreatDetectionSystem {
    constructor() {
        this.maliciousPatterns = [
            /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /eval\s*\(/gi,
            /union\s+select/gi,
            /drop\s+table/gi,
            /insert\s+into/gi,
            /select\s+\*\s+from/gi,
            /\.\.\//gi, // Directory traversal
            /\.\.\\/gi,
            /\/etc\/passwd/gi,
            /\/bin\/sh/gi,
            /curl\s+/gi,
            /wget\s+/gi,
            /python\s+/gi,
            /perl\s+/gi,
            /bash\s+/gi,
            /php\s+/gi
        ];

        this.suspiciousUserAgents = [
            /sqlmap/gi,
            /nikto/gi,
            /metasploit/gi,
            /burpsuite/gi,
            /owasp/gi,
            /nmap/gi,
            /scanner/gi,
            /bot/gi,
            /crawler/gi,
            /spider/gi
        ];
    }

    isSuspiciousRequest(req) {
        const url = req.url.toLowerCase();
        const body = JSON.stringify(req.body || {}).toLowerCase();
        const headers = JSON.stringify(req.headers || {}).toLowerCase();
        const userAgent = req.get('User-Agent') || '';

        // Verificar padrões maliciosos na URL
        if (this.containsMaliciousPatterns(url)) {
            return true;
        }

        // Verificar padrões maliciosos no body
        if (this.containsMaliciousPatterns(body)) {
            return true;
        }

        // Verificar User-Agent suspeito
        if (this.isSuspiciousUserAgent(userAgent)) {
            return true;
        }

        // Verificar headers suspeitos
        if (this.containsMaliciousPatterns(headers)) {
            return true;
        }

        return false;
    }

    containsMaliciousPatterns(text) {
        return this.maliciousPatterns.some(pattern => pattern.test(text));
    }

    isSuspiciousUserAgent(userAgent) {
        return this.suspiciousUserAgents.some(pattern => pattern.test(userAgent));
    }
}

// ===== SISTEMA DE RATE LIMITING AVANÇADO =====
class RateLimitSystem {
    constructor() {
        this.requests = new Map();
        this.limits = {
            default: { windowMs: 60000, max: 100 }, // 100 requests por minuto
            chat: { windowMs: 60000, max: 30 },     // 30 requests de chat por minuto
            extract: { windowMs: 60000, max: 10 },  // 10 extrações por minuto
            auth: { windowMs: 900000, max: 5 }      // 5 tentativas de auth em 15 minutos
        };
    }

    checkLimit(ip, endpoint = 'default') {
        const now = Date.now();
        const limitConfig = this.limits[endpoint] || this.limits.default;
        
        if (!this.requests.has(ip)) {
            this.requests.set(ip, {});
        }

        const ipData = this.requests.get(ip);
        
        if (!ipData[endpoint]) {
            ipData[endpoint] = { count: 0, firstRequest: now };
        }

        const endpointData = ipData[endpoint];

        // Reset counter if window has passed
        if (now - endpointData.firstRequest > limitConfig.windowMs) {
            endpointData.count = 0;
            endpointData.firstRequest = now;
        }

        // Check if limit exceeded
        if (endpointData.count >= limitConfig.max) {
            return false;
        }

        endpointData.count++;
        return true;
    }

    cleanup() {
        const now = Date.now();
        for (const [ip, ipData] of this.requests) {
            for (const [endpoint, data] of Object.entries(ipData)) {
                const limitConfig = this.limits[endpoint] || this.limits.default;
                if (now - data.firstRequest > limitConfig.windowMs * 2) {
                    delete ipData[endpoint];
                }
            }
            if (Object.keys(ipData).length === 0) {
                this.requests.delete(ip);
            }
        }
    }
}

// ===== SISTEMA DE VALIDAÇÃO DE ENTRADA =====
class InputValidationSystem {
    validateRequest(req) {
        const errors = [];
        const validationRules = {
            url: this.validateURL.bind(this),
            message: this.validateMessage.bind(this),
            email: this.validateEmail.bind(this),
            apiKey: this.validateApiKey.bind(this),
            leadData: this.validateLeadData.bind(this)
        };

        // Validar parâmetros da URL
        if (req.query) {
            Object.keys(req.query).forEach(key => {
                const value = req.query[key];
                if (validationRules[key]) {
                    const result = validationRules[key](value);
                    if (!result.valid) errors.push(`${key}: ${result.error}`);
                }
            });
        }

        // Validar body da requisição
        if (req.body) {
            Object.keys(req.body).forEach(key => {
                const value = req.body[key];
                if (validationRules[key]) {
                    const result = validationRules[key](value);
                    if (!result.valid) errors.push(`${key}: ${result.error}`);
                }
            });
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    validateURL(url) {
        if (!url) return { valid: true };
        
        try {
            const parsedUrl = new URL(url);
            const allowedProtocols = ['http:', 'https:'];
            
            if (!allowedProtocols.includes(parsedUrl.protocol)) {
                return { valid: false, error: "Protocolo não permitido" };
            }

            // Bloquear URLs suspeitas
            const suspiciousDomains = ['localhost', '127.0.0.1', '0.0.0.0', 'internal'];
            if (suspiciousDomains.some(domain => parsedUrl.hostname.includes(domain))) {
                return { valid: false, error: "Domínio não permitido" };
            }

            return { valid: true };
        } catch {
            return { valid: false, error: "URL inválida" };
        }
    }

    validateMessage(message) {
        if (!message || typeof message !== 'string') {
            return { valid: false, error: "Mensagem inválida" };
        }

        // Limitar tamanho da mensagem
        if (message.length > 1000) {
            return { valid: false, error: "Mensagem muito longa" };
        }

        // Prevenir XSS
        const xssPatterns = [
            /<script\b[^>]*>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /eval\s*\(/gi
        ];

        if (xssPatterns.some(pattern => pattern.test(message))) {
            return { valid: false, error: "Conteúdo malicioso detectado" };
        }

        return { valid: true };
    }

    validateEmail(email) {
        if (!email) return { valid: true };
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { valid: false, error: "Email inválido" };
        }

        return { valid: true };
    }

    validateApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            return { valid: false, error: "API Key inválida" };
        }

        if (apiKey.length > 100) {
            return { valid: false, error: "API Key muito longa" };
        }

        return { valid: true };
    }

    validateLeadData(leadData) {
        if (!leadData || typeof leadData !== 'object') {
            return { valid: false, error: "Dados do lead inválidos" };
        }

        // Validar campos específicos do lead
        if (leadData.email && !this.validateEmail(leadData.email).valid) {
            return { valid: false, error: "Email do lead inválido" };
        }

        if (leadData.telefone && leadData.telefone.length > 20) {
            return { valid: false, error: "Telefone muito longo" };
        }

        return { valid: true };
    }
}

// ===== FIREWALL DE APLICAÇÃO =====
class ApplicationFirewall {
    constructor() {
        this.blockedPaths = [
            '/.env',
            '/config',
            '/database',
            '/.git',
            '/backup',
            '/admin',
            '/phpmyadmin',
            '/mysql',
            '/sql',
            '/debug',
            '/test',
            '/api/test'
        ];
    }

    checkPath(path) {
        const normalizedPath = path.toLowerCase();
        return this.blockedPaths.some(blockedPath => 
            normalizedPath.includes(blockedPath.toLowerCase())
        );
    }

    middleware() {
        return (req, res, next) => {
            if (this.checkPath(req.path)) {
                console.log(`🚨 FIREWALL: Tentativa de acesso a caminho bloqueado: ${req.path}`);
                return res.status(403).json({ 
                    success: false, 
                    error: "Acesso não autorizado" 
                });
            }
            next();
        };
    }
}

// ===== SISTEMA DE LOG DE AUDITORIA DE SEGURANÇA =====
class SecurityAuditLogger {
    constructor() {
        this.logFile = path.join(__dirname, 'logs', 'security.log');
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    logRequest(req) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            ip: this.getClientIP(req),
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent') || 'Unknown',
            action: 'REQUEST'
        };

        this.writeLog(logEntry);
    }

    logBlockedAccess(req) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            ip: this.getClientIP(req),
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent') || 'Unknown',
            action: 'BLOCKED_ACCESS'
        };

        this.writeLog(logEntry);
    }

    logThreatDetected(req, reason) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            ip: this.getClientIP(req),
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent') || 'Unknown',
            action: 'THREAT_DETECTED',
            reason: reason
        };

        this.writeLog(logEntry);
        console.log(`🚨 AMEAÇA DETECTADA: ${reason} - IP: ${this.getClientIP(req)}`);
    }

    logRateLimitExceeded(req) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            ip: this.getClientIP(req),
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent') || 'Unknown',
            action: 'RATE_LIMIT_EXCEEDED'
        };

        this.writeLog(logEntry);
    }

    logInvalidInput(req, errors) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            ip: this.getClientIP(req),
            method: req.method,
            url: req.url,
            userAgent: req.get('User-Agent') || 'Unknown',
            action: 'INVALID_INPUT',
            errors: errors
        };

        this.writeLog(logEntry);
    }

    writeLog(entry) {
        try {
            const logLine = JSON.stringify(entry) + '\n';
            fs.appendFileSync(this.logFile, logLine, 'utf8');
        } catch (error) {
            console.error('Erro ao escrever log de segurança:', error);
        }
    }

    getClientIP(req) {
        return req.ip || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
               '0.0.0.0';
    }
}

// ===== SISTEMA DE MONITORAMENTO CONTÍNUO =====
class SecurityMonitor {
    constructor() {
        this.monitoringInterval = null;
        this.startMonitoring();
    }

    startMonitoring() {
        this.monitoringInterval = setInterval(() => {
            this.checkSystemHealth();
            this.cleanupOldData();
        }, 60000); // Verificar a cada minuto
    }

    checkSystemHealth() {
        // Monitorar uso de memória
        const memoryUsage = process.memoryUsage();
        if (memoryUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
            console.log('⚠️  ALERTA: Uso alto de memória detectado');
        }

        // Monitorar número de conexões
        // (Implementar conforme necessidade)
    }

    cleanupOldData() {
        // Limpar dados antigos do rate limiter
        if (global.rateLimitSystem) {
            global.rateLimitSystem.cleanup();
        }
    }

    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
    }
}

// ===== EXPORTAÇÕES PARA USO EM OUTROS ARQUIVOS =====
module.exports = {
    SecuritySystem,
    ThreatDetectionSystem,
    RateLimitSystem,
    InputValidationSystem,
    ApplicationFirewall,
    SecurityAuditLogger,
    SecurityMonitor
};

console.log("🛡️  MÓDULO DE SEGURANÇA AVANÇADO CARREGADO COM SUCESSO!");
