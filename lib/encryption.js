/**
 * 🔐 SISTEMA DE CRIPTOGRAFIA - Link Mágico V8.0
 * 
 * Criptografa dados sensíveis antes de salvar no banco
 * Campos: email, telefone, mensagens de chat
 * 
 * SEGURANÇA:
 * - Feature flag controlável
 * - AES-256-GCM para criptografia autenticada
 * - Chave derivada de senha com PBKDF2
 * - Fallback: dados em plaintext (comportamento V7.0)
 * 
 * @version 1.0.0
 */

const crypto = require('crypto');

// Configurações de criptografia
const CONFIG = {
    algorithm: 'aes-256-gcm',
    keyLength: 32, // 256 bits
    ivLength: 16,  // 128 bits
    saltLength: 16,
    tagLength: 16,
    iterations: 100000 // PBKDF2 iterations
};

class EncryptionManager {
    constructor() {
        this.enabled = false;
        this.masterKey = null;
        this.keyCache = new Map(); // Cache de chaves derivadas

        console.log('🔐 Sistema de Criptografia inicializando...');
    }

    /**
     * Inicializa o sistema de criptografia
     */
    async initialize() {
        try {
            // Verificar se feature está habilitada
            let featureFlags;
            try {
                featureFlags = require('./feature-flags').featureFlags;
                this.enabled = featureFlags.isEnabled('FEATURE_ENCRYPT_SENSITIVE');
            } catch (e) {
                this.enabled = process.env.FEATURE_ENCRYPT_SENSITIVE === 'true';
            }

            if (!this.enabled) {
                console.log('🔐 Criptografia desabilitada (use FEATURE_ENCRYPT_SENSITIVE=true)');
                return;
            }

            // Obter chave mestra de variável de ambiente
            const masterPassword = process.env.ENCRYPTION_MASTER_KEY || process.env.SESSION_SECRET;

            if (!masterPassword) {
                console.warn('⚠️ ENCRYPTION_MASTER_KEY não definida - criptografia desabilitada');
                this.enabled = false;
                return;
            }

            // Derivar chave mestra
            this.masterKey = this._deriveKey(masterPassword, 'linkmagico-master-salt');

            console.log('✅ Criptografia habilitada e configurada');

        } catch (error) {
            console.error('⚠️ Erro ao inicializar Criptografia:', error.message);
            this.enabled = false;
        }
    }

    /**
     * Deriva chave de uma senha usando PBKDF2
     */
    _deriveKey(password, salt) {
        const cacheKey = `${password}:${salt}`;

        if (this.keyCache.has(cacheKey)) {
            return this.keyCache.get(cacheKey);
        }

        const key = crypto.pbkdf2Sync(
            password,
            salt,
            CONFIG.iterations,
            CONFIG.keyLength,
            'sha256'
        );

        this.keyCache.set(cacheKey, key);
        return key;
    }

    /**
     * Criptografa um valor
     * 
     * @param {string} plaintext - Texto a criptografar
     * @param {string} [contextKey] - Chave de contexto para derivação (ex: tenantId)
     * @returns {string} Texto criptografado em formato base64
     */
    encrypt(plaintext, contextKey = null) {
        // Se desabilitado, retorna texto original
        if (!this.enabled || !this.masterKey) {
            return plaintext;
        }

        if (!plaintext || typeof plaintext !== 'string') {
            return plaintext;
        }

        try {
            // Gerar IV aleatório
            const iv = crypto.randomBytes(CONFIG.ivLength);

            // Usar chave derivada do contexto se fornecida
            const key = contextKey
                ? this._deriveKey(this.masterKey.toString('hex'), contextKey)
                : this.masterKey;

            // Criar cipher
            const cipher = crypto.createCipheriv(CONFIG.algorithm, key, iv);

            // Criptografar
            let encrypted = cipher.update(plaintext, 'utf8', 'base64');
            encrypted += cipher.final('base64');

            // Obter auth tag
            const authTag = cipher.getAuthTag();

            // Combinar: iv + authTag + encrypted
            const combined = Buffer.concat([
                iv,
                authTag,
                Buffer.from(encrypted, 'base64')
            ]).toString('base64');

            // Prefixar com marcador para identificar dados criptografados
            return `ENC:${combined}`;

        } catch (error) {
            console.error('⚠️ Erro ao criptografar:', error.message);
            // Em caso de erro, retorna texto original
            return plaintext;
        }
    }

    /**
     * Descriptografa um valor
     * 
     * @param {string} ciphertext - Texto criptografado
     * @param {string} [contextKey] - Chave de contexto para derivação
     * @returns {string} Texto original
     */
    decrypt(ciphertext, contextKey = null) {
        // Se não é dado criptografado, retorna como está
        if (!ciphertext || typeof ciphertext !== 'string' || !ciphertext.startsWith('ENC:')) {
            return ciphertext;
        }

        // Se desabilitado, não consegue descriptografar
        if (!this.enabled || !this.masterKey) {
            console.warn('⚠️ Tentativa de descriptografar sem criptografia habilitada');
            return ciphertext.replace('ENC:', '[ENCRYPTED]');
        }

        try {
            // Remover prefixo
            const combined = Buffer.from(ciphertext.substring(4), 'base64');

            // Extrair componentes
            const iv = combined.slice(0, CONFIG.ivLength);
            const authTag = combined.slice(CONFIG.ivLength, CONFIG.ivLength + CONFIG.tagLength);
            const encrypted = combined.slice(CONFIG.ivLength + CONFIG.tagLength);

            // Usar chave derivada do contexto se fornecida
            const key = contextKey
                ? this._deriveKey(this.masterKey.toString('hex'), contextKey)
                : this.masterKey;

            // Criar decipher
            const decipher = crypto.createDecipheriv(CONFIG.algorithm, key, iv);
            decipher.setAuthTag(authTag);

            // Descriptografar
            let decrypted = decipher.update(encrypted, undefined, 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;

        } catch (error) {
            console.error('⚠️ Erro ao descriptografar:', error.message);
            // Em caso de erro, retorna indicador
            return '[DECRYPTION_FAILED]';
        }
    }

    /**
     * Criptografa um objeto (campos específicos)
     * 
     * @param {Object} obj - Objeto a criptografar
     * @param {string[]} fields - Campos a criptografar
     * @param {string} [contextKey] - Chave de contexto
     * @returns {Object} Objeto com campos criptografados
     */
    encryptFields(obj, fields, contextKey = null) {
        if (!this.enabled || !obj) return obj;

        const encrypted = { ...obj };

        for (const field of fields) {
            if (encrypted[field] && typeof encrypted[field] === 'string') {
                encrypted[field] = this.encrypt(encrypted[field], contextKey);
            }
        }

        return encrypted;
    }

    /**
     * Descriptografa um objeto (campos específicos)
     * 
     * @param {Object} obj - Objeto a descriptografar
     * @param {string[]} fields - Campos a descriptografar
     * @param {string} [contextKey] - Chave de contexto
     * @returns {Object} Objeto com campos descriptografados
     */
    decryptFields(obj, fields, contextKey = null) {
        if (!obj) return obj;

        const decrypted = { ...obj };

        for (const field of fields) {
            if (decrypted[field] && typeof decrypted[field] === 'string') {
                decrypted[field] = this.decrypt(decrypted[field], contextKey);
            }
        }

        return decrypted;
    }

    /**
     * Helper para campos de lead
     */
    encryptLeadData(lead, tenantId = null) {
        return this.encryptFields(lead, ['email', 'telefone', 'phone', 'message'], tenantId);
    }

    decryptLeadData(lead, tenantId = null) {
        return this.decryptFields(lead, ['email', 'telefone', 'phone', 'message'], tenantId);
    }

    /**
     * Gera hash seguro de um valor (para comparação sem expor original)
     * 
     * @param {string} value - Valor a hashear
     * @param {string} [salt] - Salt customizado
     * @returns {string} Hash do valor
     */
    hash(value, salt = null) {
        if (!value) return null;

        const effectiveSalt = salt || 'linkmagico-hash-salt';
        return crypto
            .createHmac('sha256', effectiveSalt)
            .update(value)
            .digest('hex');
    }

    /**
     * Verifica se um valor corresponde a um hash
     */
    verifyHash(value, hash, salt = null) {
        return this.hash(value, salt) === hash;
    }

    /**
     * Gera token seguro para sessões, API keys, etc
     * 
     * @param {number} length - Tamanho em bytes
     * @returns {string} Token em formato hex
     */
    generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Status do módulo
     */
    getStatus() {
        return {
            enabled: this.enabled,
            algorithm: CONFIG.algorithm,
            keyConfigured: !!this.masterKey,
            keyCacheSize: this.keyCache.size
        };
    }
}

// Singleton instance
const encryptionManager = new EncryptionManager();

// Inicializar automaticamente
encryptionManager.initialize().catch(err => {
    console.error('❌ Falha ao inicializar Encryption:', err);
});

module.exports = {
    encryptionManager,
    EncryptionManager
};
