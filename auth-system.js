// auth-system.js - NOVO ARQUIVO
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

class AuthSystem {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'seu-segredo-super-secreto-aqui';
        this.apiKeys = new Map(); // Em produção, use database
    }

    // Gerar hash seguro da API Key para validação
    async hashApiKey(apiKey) {
        return await bcrypt.hash(apiKey, 12);
    }

    // Validar API Key
    async validateApiKey(providedKey, storedHash) {
        return await bcrypt.compare(providedKey, storedHash);
    }

    // Gerar token JWT temporário
    generateWidgetToken(apiKey, domain, userId = 'widget') {
        const payload = {
            userId: userId,
            domain: domain,
            type: 'widget_access',
            permissions: ['chat', 'capture_lead'],
            iss: 'linkmagico-security',
            aud: 'widget-client'
        };

        return jwt.sign(payload, this.jwtSecret, {
            expiresIn: '15m', // Token de 15 minutos
            jwtid: this.generateTokenId()
        });
    }

    // Verificar token JWT
    verifyToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            throw new Error('Token inválido ou expirado');
        }
    }

    generateTokenId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    // Middleware de autenticação para rotas
    authenticateWidget() {
        return (req, res, next) => {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.replace('Bearer ', '');

            if (!token) {
                return res.status(401).json({
                    success: false,
                    error: 'Token de acesso não fornecido'
                });
            }

            try {
                const decoded = this.verifyToken(token);
                
                // Verificar se o token é para widget
                if (decoded.type !== 'widget_access') {
                    return res.status(403).json({
                        success: false,
                        error: 'Tipo de token inválido'
                    });
                }

                req.widgetUser = decoded;
                next();
            } catch (error) {
                return res.status(403).json({
                    success: false,
                    error: 'Token inválido ou expirado'
                });
            }
        };
    }
}

module.exports = AuthSystem;