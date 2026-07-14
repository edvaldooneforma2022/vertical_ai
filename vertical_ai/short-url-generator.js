/**
 * 🔗 SHORT URL GENERATOR - Link Mágico
 * Gerador de códigos curtos únicos usando base62
 * 
 * Funcionalidades:
 * - Geração de códigos de 6 caracteres (base62)
 * - 56 bilhões de combinações possíveis
 * - Verificação de unicidade
 * - Segurança criptográfica
 */

const crypto = require('crypto');

class ShortUrlGenerator {
    // Base62: [0-9a-zA-Z] = 62 caracteres possíveis
    // 6 caracteres = 62^6 = 56.800.235.584 combinações únicas
    static CHARSET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    static CODE_LENGTH = 6;

    /**
     * Gera um código curto aleatório
     */
    static generate() {
        let code = '';
        const bytes = crypto.randomBytes(this.CODE_LENGTH);

        for (let i = 0; i < this.CODE_LENGTH; i++) {
            code += this.CHARSET[bytes[i] % this.CHARSET.length];
        }

        return code;
    }

    /**
     * Gera um código único verificando se já existe
     * @param {Function} checkFunction - Função async que verifica se código existe
     * @returns {Promise<string>} Código único gerado
     */
    static async generateUnique(checkFunction) {
        let attempts = 0;
        const MAX_ATTEMPTS = 10;

        while (attempts < MAX_ATTEMPTS) {
            const code = this.generate();
            const exists = await checkFunction(code);

            if (!exists) {
                console.log(`✅ Short code gerado: ${code} (tentativa ${attempts + 1})`);
                return code;
            }

            attempts++;
            console.log(`⚠️ Colisão detectada no código ${code}, tentando novamente...`);
        }

        throw new Error('Failed to generate unique short code after 10 attempts');
    }

    /**
     * Valida se um código está no formato correto
     */
    static isValid(code) {
        if (!code || typeof code !== 'string') {
            return false;
        }

        if (code.length !== this.CODE_LENGTH) {
            return false;
        }

        // Verificar se todos os caracteres são válidos
        for (let char of code) {
            if (!this.CHARSET.includes(char)) {
                return false;
            }
        }

        return true;
    }
}

module.exports = { ShortUrlGenerator };
