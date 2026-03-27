/**
 * 🎛️ SISTEMA DE FEATURE FLAGS - Link Mágico V8.0
 * 
 * Permite ativar/desativar funcionalidades de forma segura
 * Todas as features são DESABILITADAS por padrão
 * 
 * Configuração via:
 * - Variáveis de ambiente (FEATURE_*)
 * - Banco de dados (tabela feature_flags)
 * - Configuração em tempo de execução
 * 
 * @version 1.0.0
 * @author Link Mágico Team
 */

const fs = require('fs');
const path = require('path');

// Definição de todas as feature flags disponíveis
const FEATURE_DEFINITIONS = {
    // Fase 2: Persistência
    FEATURE_PERSISTENT_MEMORY: {
        name: 'Memória Persistente',
        description: 'Salva memória conversacional no banco de dados',
        defaultEnabled: false,
        riskLevel: 'low'
    },

    // Fase 3: Análise Semântica
    FEATURE_ENHANCED_SENTIMENT: {
        name: 'Análise de Sentimento Avançada',
        description: 'Análise emocional com contexto, negações e intensificadores',
        defaultEnabled: false,
        riskLevel: 'low'
    },

    // Fase 4: Compliance
    FEATURE_AUDIT_LOGGING: {
        name: 'Logs de Auditoria',
        description: 'Registra ações críticas para compliance',
        defaultEnabled: false,
        riskLevel: 'none'
    },
    FEATURE_ENCRYPT_SENSITIVE: {
        name: 'Criptografia de Dados Sensíveis',
        description: 'Criptografa emails, telefones e mensagens no banco',
        defaultEnabled: false,
        riskLevel: 'medium'
    },
    FEATURE_ADVANCED_RATE_LIMIT: {
        name: 'Rate Limiting Avançado',
        description: 'Rate limit granular por endpoint e tenant',
        defaultEnabled: false,
        riskLevel: 'low'
    },

    // Fase 5: Refatoração
    FEATURE_MODULAR_AI: {
        name: 'Sistema de IA Modular',
        description: 'Usa módulos refatorados de IA',
        defaultEnabled: false,
        riskLevel: 'medium'
    },

    // Melhorias Adicionais
    FEATURE_SMART_ESCALATION: {
        name: 'Escalonamento Inteligente',
        description: 'Detecta quando transferir para humano',
        defaultEnabled: false,
        riskLevel: 'low'
    },
    FEATURE_CONVERSATION_CONTEXT: {
        name: 'Contexto Conversacional',
        description: 'Mantém contexto entre mensagens para respostas melhores',
        defaultEnabled: false,
        riskLevel: 'low'
    },

    // Chat Limpo V2
    FEATURE_CLEAN_CHAT_V2: {
        name: 'Chat Limpo V2',
        description: 'Usa prompt limpo e direto, respeitando Instruções Personalizadas e FAQs sem floreios',
        defaultEnabled: false,
        riskLevel: 'low'
    },

    // Meus Assistentes Panel
    FEATURE_MEUS_ASSISTENTES: {
        name: 'Meus Assistentes',
        description: 'Painel de gerenciamento de assistentes IA por tenant',
        defaultEnabled: true,
        riskLevel: 'low'
    },
    // Camada de Venda Híbrida (sales-layer.js)
    FEATURE_SALES_LAYER: {
        name: 'Camada de Venda Híbrida',
        description: 'Pós-processamento persuasivo sobre resposta da IA base. Não altera contexto, URL ou instruções originais.',
        defaultEnabled: false,
        riskLevel: 'low'
    },

    // Sistema de Presets Multi-Nicho
    FEATURE_PRESETS: {
        name: 'Presets Multi-Nicho',
        description: 'Auto-seleção de comportamento de venda por tipo de negócio (produto_digital, afiliado, servico, lead, ecommerce, local_business)',
        defaultEnabled: true,
        riskLevel: 'low'
    },

    // Decision Engine (Modo Automático Inteligente)
    FEATURE_DECISION_ENGINE: {
        name: 'Decision Engine (Modo Automático)',
        description: 'Camada intermediária de decisão inteligente para modo automático. Detecta intenção real do usuário e decide estratégia de venda.',
        defaultEnabled: true,
        riskLevel: 'low'
    },

    // Decision Engine V2 (Evolução Avançada)
    FEATURE_DECISION_ENGINE_V2: {
        name: 'Decision Engine V2 (Avançado)',
        description: 'Evolução do Decision Engine com detecção avançada de intenção (confidence scoring), análise de histórico, decision matrix, anti-erro e auto-correção. Fallback automático para V1 se falhar.',
        defaultEnabled: false,
        riskLevel: 'low'
    },

};

class FeatureFlagsManager {
    constructor() {
        this.flags = new Map();
        this.overrides = new Map(); // Overrides em tempo de execução
        this.tenantOverrides = new Map(); // Overrides por tenant
        this.initialized = false;
        this.configPath = path.join(__dirname, '..', 'data', 'feature_flags.json');

        console.log('🎛️ Sistema de Feature Flags inicializando...');
    }

    /**
     * Inicializa o sistema de feature flags
     * Carrega de env vars primeiro, depois de arquivo de config
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // 1. Carregar defaults
            for (const [key, definition] of Object.entries(FEATURE_DEFINITIONS)) {
                this.flags.set(key, definition.defaultEnabled);
            }

            // 2. Carregar de variáveis de ambiente (sobrescreve defaults)
            this._loadFromEnvironment();

            // 3. Carregar de arquivo de configuração (se existir)
            await this._loadFromFile();

            this.initialized = true;
            console.log('✅ Feature Flags inicializadas:', this.getEnabledFlags());

        } catch (error) {
            console.error('⚠️ Erro ao inicializar Feature Flags (usando defaults):', error.message);
            // Em caso de erro, mantém os defaults (todas desabilitadas)
            this.initialized = true;
        }
    }

    /**
     * Carrega flags de variáveis de ambiente
     * Formato: FEATURE_NAME=true|false|1|0
     */
    _loadFromEnvironment() {
        for (const key of Object.keys(FEATURE_DEFINITIONS)) {
            const envValue = process.env[key];
            if (envValue !== undefined) {
                const enabled = envValue === 'true' || envValue === '1';
                this.flags.set(key, enabled);
                console.log(`🎛️ [ENV] ${key} = ${enabled}`);
            }
        }
    }

    /**
     * Carrega flags de arquivo de configuração JSON
     */
    async _loadFromFile() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf8');
                const config = JSON.parse(data);

                for (const [key, enabled] of Object.entries(config.flags || {})) {
                    if (FEATURE_DEFINITIONS[key]) {
                        this.flags.set(key, Boolean(enabled));
                        console.log(`🎛️ [FILE] ${key} = ${enabled}`);
                    }
                }

                // Carregar overrides por tenant
                if (config.tenantOverrides) {
                    for (const [tenantId, flags] of Object.entries(config.tenantOverrides)) {
                        this.tenantOverrides.set(tenantId, new Map(Object.entries(flags)));
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Não foi possível carregar feature_flags.json:', error.message);
        }
    }

    /**
     * Verifica se uma feature está habilitada
     * @param {string} flagName - Nome da flag (ex: 'FEATURE_PERSISTENT_MEMORY')
     * @param {string} [tenantId] - ID do tenant para verificar override
     * @returns {boolean}
     */
    isEnabled(flagName, tenantId = null) {
        // Verificar override em tempo de execução primeiro
        if (this.overrides.has(flagName)) {
            return this.overrides.get(flagName);
        }

        // Verificar override do tenant
        if (tenantId && this.tenantOverrides.has(tenantId)) {
            const tenantFlags = this.tenantOverrides.get(tenantId);
            if (tenantFlags.has(flagName)) {
                return tenantFlags.get(flagName);
            }
        }

        // Retornar valor do Map, com fallback para defaultEnabled da definição
        const flagValue = this.flags.get(flagName);
        if (flagValue !== undefined) return flagValue;
        const def = FEATURE_DEFINITIONS[flagName];
        return def ? def.defaultEnabled : false;
    }

    /**
     * Habilita uma feature em tempo de execução
     * @param {string} flagName 
     */
    enable(flagName) {
        if (!FEATURE_DEFINITIONS[flagName]) {
            console.warn(`⚠️ Feature flag desconhecida: ${flagName}`);
            return false;
        }
        this.overrides.set(flagName, true);
        console.log(`✅ Feature habilitada: ${flagName}`);
        return true;
    }

    /**
     * Desabilita uma feature em tempo de execução
     * @param {string} flagName 
     */
    disable(flagName) {
        if (!FEATURE_DEFINITIONS[flagName]) {
            console.warn(`⚠️ Feature flag desconhecida: ${flagName}`);
            return false;
        }
        this.overrides.set(flagName, false);
        console.log(`🚫 Feature desabilitada: ${flagName}`);
        return true;
    }

    /**
     * Define override para um tenant específico
     * @param {string} tenantId 
     * @param {string} flagName 
     * @param {boolean} enabled 
     */
    setTenantOverride(tenantId, flagName, enabled) {
        if (!this.tenantOverrides.has(tenantId)) {
            this.tenantOverrides.set(tenantId, new Map());
        }
        this.tenantOverrides.get(tenantId).set(flagName, enabled);
        console.log(`🎛️ Tenant ${tenantId}: ${flagName} = ${enabled}`);
        return true;
    }

    /**
     * Retorna lista de flags habilitadas
     * @returns {string[]}
     */
    getEnabledFlags() {
        const enabled = [];
        for (const [key, value] of this.flags.entries()) {
            if (value || this.overrides.get(key)) {
                enabled.push(key);
            }
        }
        return enabled;
    }

    /**
     * Retorna status de todas as flags
     * @returns {Object}
     */
    getAllFlags() {
        const result = {};
        for (const [key, definition] of Object.entries(FEATURE_DEFINITIONS)) {
            result[key] = {
                ...definition,
                enabled: this.isEnabled(key),
                source: this.overrides.has(key) ? 'runtime' :
                    this.flags.get(key) !== definition.defaultEnabled ? 'config' : 'default'
            };
        }
        return result;
    }

    /**
     * Salva configuração atual em arquivo
     */
    async saveConfig() {
        try {
            const config = {
                flags: {},
                tenantOverrides: {},
                updatedAt: new Date().toISOString()
            };

            for (const [key, value] of this.flags.entries()) {
                config.flags[key] = value;
            }

            for (const [tenantId, flags] of this.tenantOverrides.entries()) {
                config.tenantOverrides[tenantId] = Object.fromEntries(flags);
            }

            // Garantir que o diretório existe
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
            console.log('💾 Feature Flags salvas em arquivo');
            return true;
        } catch (error) {
            console.error('❌ Erro ao salvar Feature Flags:', error.message);
            return false;
        }
    }

    /**
     * Helper para executar código apenas se feature estiver habilitada
     * Com fallback automático para comportamento anterior
     * 
     * @param {string} flagName - Nome da feature flag
     * @param {Function} newBehavior - Função com novo comportamento
     * @param {Function} [fallback] - Função com comportamento anterior (opcional)
     * @param {string} [tenantId] - ID do tenant
     * @returns {*} Resultado da função executada
     */
    async runIfEnabled(flagName, newBehavior, fallback = null, tenantId = null) {
        if (this.isEnabled(flagName, tenantId)) {
            try {
                return await newBehavior();
            } catch (error) {
                console.error(`❌ [${flagName}] Erro no novo comportamento:`, error.message);
                console.log(`🔄 [${flagName}] Executando fallback...`);

                if (fallback) {
                    try {
                        return await fallback();
                    } catch (fallbackError) {
                        console.error(`❌ [${flagName}] Fallback também falhou:`, fallbackError.message);
                        throw fallbackError;
                    }
                }
                throw error;
            }
        } else if (fallback) {
            return await fallback();
        }
        return null;
    }
}

// Singleton instance
const featureFlags = new FeatureFlagsManager();

// Inicializar automaticamente
featureFlags.initialize().catch(err => {
    console.error('❌ Falha crítica ao inicializar Feature Flags:', err);
});

// Exportar definições para documentação
const FEATURES = Object.keys(FEATURE_DEFINITIONS);

module.exports = {
    featureFlags,
    FEATURES,
    FEATURE_DEFINITIONS,
    FeatureFlagsManager
};
