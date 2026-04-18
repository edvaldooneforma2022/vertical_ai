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

    // Auto-Learning System V1.0
    FEATURE_AUTO_LEARNING: {
        name: 'Auto-Learning System',
        description: 'Sistema de aprendizado automático que coleta dados de conversas e otimiza respostas com base em padrões de conversão. Tracker → Performance Engine → Memory Store → Optimizer.',
        defaultEnabled: true,
        riskLevel: 'low'
    },

    // Auto-Learning Test Mode
    AUTO_LEARNING_TEST_MODE: {
        name: 'Auto-Learning Modo de Teste',
        description: 'Reduz limiares para testar o auto-learning mais rapidamente. Recálculo a cada 5 eventos em vez de 100.',
        defaultEnabled: true,
        riskLevel: 'none'
    },

    // ═══════════════════════════════════════════════════════
    // V9.0 BLINDADA — NOVAS FEATURE FLAGS
    // ═══════════════════════════════════════════════════════

    FEATURE_HEALTH_V2: {
        name: 'Health Check V2 (/healthz)',
        description: 'Endpoint /healthz com status de DB, cache, Puppeteer, event loop lag e memória do processo.',
        defaultEnabled: true,
        riskLevel: 'none'
    },
    FEATURE_RATE_LIMIT_V2: {
        name: 'Rate Limiter V9 Inteligente',
        description: 'Rate limiting com whitelist de IP (ENV), bypass de stress test (header), tenant tiers (apiKey-based) e log JSON.',
        defaultEnabled: true,
        riskLevel: 'low'
    },
    FEATURE_CACHE_V2: {
        name: 'Cache LLM V9',
        description: 'Cache de respostas LLM com TTL de 5 minutos, normalização de mensagem para melhor hit rate e logs estruturados.',
        defaultEnabled: true,
        riskLevel: 'low'
    },
    FEATURE_CIRCUIT_BREAKER: {
        name: 'Circuit Breaker V9',
        description: 'Proteção contra chamadas lentas (timeout configurável via ENV). Circuit breaker com estados CLOSED/OPEN/HALF_OPEN para LLM, Puppeteer e Extração.',
        defaultEnabled: true,
        riskLevel: 'low'
    },
    FEATURE_STRUCTURED_LOGS: {
        name: 'Logs Estruturados V9',
        description: 'Padronização de logs em JSON estruturado: [RATE-LIMIT], [DB], [LLM], [CACHE_HIT], [CACHE_MISS], [TIMEOUT], [FALLBACK].',
        defaultEnabled: true,
        riskLevel: 'none'
    },

    FEATURE_DECISION_CORE: {
        name: 'Decision Core V9',
        description: 'Camada determinística de decisão para override final de intenções críticas (Venda/Pós-Venda).',
        defaultEnabled: true,
        riskLevel: 'low'
    },

    // ═══════════════════════════════════════════════════════
    // V10.0 — ORCHESTRATOR (CAMADA ÚNICA DE DECISÃO FINAL)
    // ═══════════════════════════════════════════════════════

    FEATURE_ORCHESTRATOR_V10: {
        name: 'Orchestrator V10',
        description: 'Camada única de decisão final que elimina conflitos entre CTA, Closing, Decision Core e Sales Layer. Hierarquia: post_sale > buy > CTA > closing > default.',
        defaultEnabled: true,
        riskLevel: 'low'
    },

    FEATURE_AUTO_CHECKOUT_DETECTION: {
        name: 'Auto Checkout Detection V9.1',
        description: 'Detecta automaticamente links de checkout no frontend (widget) e envia ao backend via context. Prioridade máxima no link-resolver.',
        defaultEnabled: true,
        riskLevel: 'low'
    },

    FEATURE_SMART_CHECKOUT_SELECTOR: {
        name: 'Smart Checkout Selector V9.2',
        description: 'Seleciona o melhor botão de checkout baseado em score heurístico quando há múltiplos links na página.',
        defaultEnabled: true,
        riskLevel: 'low'
    },

    // ═══════════════════════════════════════════════════════
    // V9.5 — CHECKOUT AUTHORITY (HARD OVERRIDE FINAL)
    // ═══════════════════════════════════════════════════════

    FEATURE_CHECKOUT_AUTHORITY: {
        name: 'Checkout Authority V9.5',
        description: 'Camada FINAL de autoridade que garante link de checkout obrigatório quando intenção de compra é detectada. Determinístico, sem depender da IA.',
        defaultEnabled: true,
        riskLevel: 'low'
    },

    // ═══════════════════════════════════════════════════════
    // V10.0 — BEHAVIOR LAYER (DISCIPLINA COMPORTAMENTAL DA IA)
    // ═══════════════════════════════════════════════════════

    FEATURE_V10_BEHAVIOR_LAYER: {
        name: 'V10 Behavior Layer',
        description: 'Camada de disciplina comportamental da IA no system prompt. Garante resposta direta, proíbe inversão de lógica, elimina respostas genéricas. Atua no INPUT (prompt), não conflita com Orchestrator (OUTPUT).',
        defaultEnabled: true,
        riskLevel: 'low'
    },

    // ═══════════════════════════════════════════════════════
    // V11.0 — ENGINE COMPLETA (CHECKOUT DISCOVERY + LINKS MAP + STATE)
    // ═══════════════════════════════════════════════════════

    FEATURE_V11_ENGINE: {
        name: 'V11 Engine (Checkout Discovery + Links Map + State)',
        description: 'Engine completa V11: Checkout Discovery (Puppeteer), Links Map (fonte única), Action Resolver (determinístico), Conversation State (memória). Ativado via env ENABLE_V11_DISCOVERY para discovery Puppeteer.',
        defaultEnabled: false,
        riskLevel: 'low'
    },

    // ═══════════════════════════════════════════════════════
    // V11.2 — RAG ENGINE (DOMAIN CRAWLER + CONTENT EXTRACTION + KNOWLEDGE)
    // ═══════════════════════════════════════════════════════

    FEATURE_V11_2_RAG: {
        name: 'V11.2 RAG Engine (Auto Extração + Conhecimento + Checkout)',
        description: 'Engine V11.2: Domain Crawler (sublinks), Content Extractor (conteúdo real), Knowledge Builder (RAG simples), Checkout Discovery passivo (fallback por links). Ativo APENAS em modo automático. Não impacta manual/desligado.',
        defaultEnabled: true,
        riskLevel: 'low'
    },

    // ═══════════════════════════════════════════════════════
    // V11.3 — FALLBACK INVISÍVEL (CHECKOUT MAGIC)
    // ═══════════════════════════════════════════════════════

    FEATURE_V11_3_FALLBACK: {
        name: 'V11.3 Fallback Invisível (Checkout Magic)',
        description: 'Fallback invisível de checkout: auto-detecção + cache DB + UI mágica que pede link sem parecer configuração. Persiste checkout por tenant. Integra com V11.2 RAG. SOMENTE modo automático.',
        defaultEnabled: true,
        riskLevel: 'low'
    },

    // ═══════════════════════════════════════════════════════
    // V12.0 — ESTABILIZAÇÃO TOTAL (ISOLAMENTO + FORCE + STATE)
    // ═══════════════════════════════════════════════════════

    FEATURE_V12_SAFE_CHECKOUT: {
        name: 'V12 Safe Checkout Resolver',
        description: 'Isolamento absoluto anti-cross-tenant: validação de domínio, sanitização de URL, cache de validação por tenant. Bloqueia checkout inválido/contaminado.',
        defaultEnabled: true,
        riskLevel: 'low'
    },

    FEATURE_V12_FORCE_CHECKOUT: {
        name: 'V12 Force Checkout Layer',
        description: 'Backend soberano: garante injeção de checkout quando IA detecta intenção de compra, independente do que a IA responde. Anti-duplicação, anti-spam, fallback inteligente.',
        defaultEnabled: true,
        riskLevel: 'low'
    },

    FEATURE_V12_STATE_PROMPT: {
        name: 'V12 Conversation State Prompt',
        description: 'Injeção de estado conversacional (estágio, histórico de intenções) no system prompt. Anti-amnésia: IA mantém coerência entre mensagens.',
        defaultEnabled: true,
        riskLevel: 'low'
    },

    FEATURE_V12_SELF_HEALING: {
        name: 'V12 Self-Healing Engine + Response Validator + Learning Memory',
        description: 'Sistema autônomo: detecta falhas (checkout missing, resposta fraca, baixa confiança), corrige em tempo real, valida resposta e registra para aprendizado. SOMENTE modo automático.',
        defaultEnabled: true,
        riskLevel: 'low'
    },

    FEATURE_V13_BLINDADO: {
        name: 'V13 Arquitetura Blindada — Controle Externo da IA',
        description: 'Pipeline completo: Intent Classifier (determinístico) → State Manager (score) → Rule Engine (hard rules) → Prompt Blindado (IA limitada) → Validador (anti-alucinação) → Checkout Engine (fora da IA). ATENÇÃO: Quando ativo, substitui o fluxo V0-V12 no modo automático.',
        defaultEnabled: false,
        riskLevel: 'medium'
    },

    FEATURE_V13_MULTI_CHECKOUT: {
        name: 'V13.2 Multi-Checkout Engine — Upsell/Downsell Inteligente',
        description: 'Decide qual checkout enviar (primary/upsell/downsell) com base em intent, state e contexto. Requer FEATURE_V13_BLINDADO ativo. Usa env var FEATURE_V13_MULTI_CHECKOUT=true.',
        defaultEnabled: false,
        riskLevel: 'low'
    },

    // ═══════════════════════════════════════════════════════
    // V14.1 — CONTEXT LAYER (MEMÓRIA + ANTI-REPETIÇÃO + COERÊNCIA)
    // ═══════════════════════════════════════════════════════

    FEATURE_V14_CONTEXT_LAYER: {
        name: 'V14 Context & Human Behavior Layer',
        description: 'Memória de curto prazo (últimas 10 msgs por sessão), anti-repetição, contexto conversacional injetado no prompt, coerência de produto. Atua no COMPORTAMENTO da IA sem alterar decisões (V16) ou pipeline (V13). SOMENTE modo automático.',
        defaultEnabled: true,
        riskLevel: 'low'
    },

    // ═══════════════════════════════════════════════════════
    // V16.2 — DECISION ENGINE BLINDADO FINAL (ANTI-PERDA DE VENDA)
    // ═══════════════════════════════════════════════════════

    FEATURE_V16_2_BLINDADO_FINAL: {
        name: 'V16.2 Decision Engine Blindado Final — Anti-Perda de Venda',
        description: 'Camada determinística de decisão comercial SOBRE V13. Normalização de input, engine de prioridade, price handler agressivo, anti-resposta-fraca, validação de checkout com cache, expiração de buyer state (15min). NÃO altera V13/V14. SOMENTE modo automático.',
        defaultEnabled: false,
        riskLevel: 'low'
    },

    FEATURE_ASSISTANT_DIAGNOSTIC: {
        name: 'Assistant Diagnostic & Readiness Score',
        description: 'Valida se o assistente tem dados suficientes (checkout, conteúdo, FAQ, WhatsApp) antes da ativação. Mostra diagnóstico no frontend.',
        defaultEnabled: true,
        riskLevel: 'low'
    },

    // ═══════════════════════════════════════════════════════
    // V14.3 — DEEP CONTEXT EXPLORER (ECOSSISTEMA COMPLETO)
    // ═══════════════════════════════════════════════════════

    FEATURE_DEEP_CONTEXT_EXPLORER: {
        name: 'V14.3 Deep Context Explorer',
        description: 'Explora subpáginas do mesmo domínio (até 5 páginas, 3 níveis) para enriquecer dados extraídos: FAQ, WhatsApp, checkout, conteúdo. Puppeteer interativo para accordion/toggle/botões JS. Classificação de links (suporte/compra/conteúdo). Output unificado com confidenceScore. NÃO sobrescreve dados existentes. Timeout controlado (45s).',
        defaultEnabled: true,
        riskLevel: 'low'
    },

    // ═══════════════════════════════════════════════════════
    // V15 — CONTEXT ENFORCEMENT LAYER (SAFE)
    // ═══════════════════════════════════════════════════════

    FEATURE_V15_CONTEXT_ENFORCEMENT: {
        name: 'V15 Context Enforcement Layer',
        description: 'Middleware determinístico de última milha: intercepta resposta final e garante entrega obrigatória de checkout, WhatsApp e FAQ quando intenção alta é detectada. NÃO decide (V16 decide). Apenas corrige respostas genéricas/fracas. SOMENTE modo automático.',
        defaultEnabled: false,
        riskLevel: 'low'
    },

    // ═══════════════════════════════════════════════════════
    // V15.5 — KNOWLEDGE ENFORCEMENT LAYER (STABLE)
    // ═══════════════════════════════════════════════════════

    FEATURE_V15_KNOWLEDGE_ENFORCER: {
        name: 'V15.5 Knowledge Enforcement Layer',
        description: 'Força uso de conteúdo real (FAQ, descrição) sem interferir em decisão ou venda. Corrige respostas genéricas/fracas usando dados extraídos (V14.3). NÃO injeta checkout. NÃO toca no V16. SOMENTE modo automático.',
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
