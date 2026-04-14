
// [PRESET-INTEGRATED] — Auto-seleção de preset multi-nicho
let _selectPreset = null;
try {
  _selectPreset = require('./sales/preset-selector');
  console.log('🎯 [PRESET-SELECTOR] Módulo carregado com sucesso.');
} catch (e) {
  console.warn('⚠️ [PRESET-SELECTOR] Módulo não encontrado — autoPreset será "default".', e.message);
}

// [SALES-LAYER-INTEGRATED] — pós-processamento persuasivo + URL→Botões
let _applySalesLayer = null;
try {
  _applySalesLayer = require('./sales/sales-layer');
  console.log('⚔️ [SALES-LAYER] Módulo carregado com sucesso.');
} catch (e) {
  console.warn('⚠️ [SALES-LAYER] Módulo não encontrado — funcionalidade desativada.', e.message);
}

// [NORMALIZE-LINKS] — converte telefones brutos em links wa.me (pré-botão)
let _normalizeLinks = null;
try {
  _normalizeLinks = require('./utils/normalize-links');
  console.log('🔗 [NORMALIZE-LINKS] Módulo carregado com sucesso.');
} catch (e) {
  console.warn('⚠️ [NORMALIZE-LINKS] Módulo não encontrado — funcionalidade desativada.', e.message);
}

// [DECISION-ENGINE] — camada intermediária de decisão inteligente para modo automático
let _decideStrategy = null;
let _decideStrategyV2 = null;
try {
  const _deModule = require('./sales/decision-engine');
  _decideStrategy = _deModule.decideStrategy;
  _decideStrategyV2 = _deModule.decideStrategyV2 || null;
  console.log('🧠 [DECISION-ENGINE] Módulo carregado com sucesso.' + (_decideStrategyV2 ? ' (V2 disponível)' : ''));
} catch (e) {
  console.warn('⚠️ [DECISION-ENGINE] Módulo não encontrado — decisão desativada.', e.message);
}

// [AUTO-INSTRUCTIONS] — geração dinâmica de instruções comportamentais por URL (modo auto only)
let _autoInstructionsGenerator = null;
try {
  const _aiModule = require('./sales/auto-instructions');
  _autoInstructionsGenerator = _aiModule.generateAutoInstructions;
  console.log('⚡ [AUTO-INSTRUCTIONS] Módulo carregado com sucesso.');
} catch (e) {
  console.warn('⚠️ [AUTO-INSTRUCTIONS] Módulo não encontrado — auto-instruções desativadas.', e.message);
}

/**
 * Converte URLs brutas em botões HTML clicáveis.
 * Aplica-se a TODOS os chats, de forma universal.
 * Links de redes sociais e qualquer outra URL são tratados da mesma forma.
 */
function convertUrlsToButtons(text) {
  try {
    if (!text || typeof text !== 'string') return text;
    // Regex para detectar URLs (http/https), incluindo redes sociais
    const urlRegex = /(https?:\/\/[^\s"'<>()\[\]{}]+[^\s"'<>()\[\]{}.,;:!?])/gi;
    return text.replace(urlRegex, (url) => {
      // Gera label legível baseado no domínio
      let label = 'Acessar';
      try {
        const host = new URL(url).hostname.replace(/^www\./, '');
        const knownLabels = {
          'instagram.com': '📷 Ver no Instagram',
          'facebook.com':  '👍 Ver no Facebook',
          'youtube.com':   '▶️ Assistir no YouTube',
          'youtu.be':      '▶️ Assistir no YouTube',
          'tiktok.com':    '🎵 Ver no TikTok',
          'twitter.com':   '🐦 Ver no Twitter',
          'x.com':         '🐦 Ver no X',
          'linkedin.com':  '💼 Ver no LinkedIn',
          'wa.me':         '💬 Abrir WhatsApp',
          'api.whatsapp.com': '💬 Abrir WhatsApp',
          'hotmart.com':   '🛒 Acessar Hotmart',
          'kiwify.com.br': '🛒 Acessar Kiwify',
          'pay.herospark.com': '🛒 Comprar Agora',
          'mercadopago.com': '💳 Pagar agora',
          'mercadolivre.com.br': '🛒 Ver no Mercado Livre',
        };
        label = knownLabels[host] || ('🔗 ' + host);
      } catch (_) {}
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:6px 14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-radius:8px;text-decoration:none;font-size:0.9em;font-weight:600;margin:4px 2px;box-shadow:0 2px 6px rgba(99,102,241,0.35);">' + label + '</a>';
    });
  } catch (err) {
    console.warn('⚠️ [URL→BUTTON] Erro na conversão (fallback para texto):', err.message);
    return text;
  }
}

require("dotenv").config();

// ===== SISTEMA DE SEGURANÇA AVANÇADO =====
const {
    SecuritySystem,
    ThreatDetectionSystem,
    RateLimitSystem,
    InputValidationSystem,
    ApplicationFirewall,
    SecurityMonitor
} = require('./security-system');

// Inicializar sistemas de segurança
const securitySystem = new SecuritySystem();
const threatDetection = new ThreatDetectionSystem();
const rateLimitSystem = new RateLimitSystem();
const inputValidator = new InputValidationSystem();
const firewall = new ApplicationFirewall();
const securityMonitor = new SecurityMonitor();

// ===== NOVOS MÓDULOS =====
const { db, initializeDatabase, DatabaseHelpers, USE_POSTGRES } = require('./database');
const { initializeCache, CacheManager, rateLimitMiddleware, isRedisConnected } = require('./cache');
const { webhookManager, WebhookEvents } = require('./webhooks');
const { billingManager, PLANS } = require('./billing');
const { analyticsManager } = require('./analytics');
const { llmOptimizer } = require('./llm-optimizer');
const { knowledgeBaseManager } = require('./knowledge-base');
const { setupRoutes } = require('./routes');
const { initialize } = require('./init');

console.log('✅ Módulos de melhorias carregados');

// 🛡️ BILLING ENFORCEMENT — Middleware de rate limit, anti-fraude e quarentena (fail-open)
let billingMiddleware = null;
try {
    const { createBillingEnforcement } = require('./billing-enforcement');
    billingMiddleware = createBillingEnforcement(billingManager);
    console.log('✅ Billing enforcement middleware carregado');
} catch (error) {
    console.log('⚠️ Billing enforcement não carregado (não crítico):', error.message);
}
// ===== NOVAS INTEGRAÇÕES V3.0 =====
const { gmailManager } = require('./gmail-integration');
const { whatsappManager } = require('./whatsapp-integration');
const { chatgptManager } = require('./chatgpt-integration');
const { crmIntegrations } = require('./crm-integrations');
const { setupCRMRoutes } = require('./lib/crm/crm-routes');
const { crmManager } = require('./lib/crm/index');
const { whitelabelManager } = require('./whitelabel');
const { structuredLeadsManager } = require('./structured-leads');
const { ShortUrlGenerator } = require('./short-url-generator');
const { getApiKeyManager } = require('./api-key-manager');
// SAFE PATCH - SCHED-005: Módulo de agendamento com calendário real
let schedulingManager = null;
try {
    const schedModule = require('./scheduling-manager');
    schedulingManager = schedModule.schedulingManager;
    console.log('✅ Scheduling Manager carregado');
} catch (e) {
    console.warn('⚠️ Scheduling Manager não carregado (não crítico):', e.message);
}
console.log('✅ Módulos V3.0 carregados');

// ===== MÓDULOS V8.0 - MELHORIAS AVANÇADAS =====
let featureFlags = null;
let auditLogger = null;
let persistentMemory = null;
let enhancedSentiment = null;

try {
    const ffModule = require('./lib/feature-flags');
    const { buildDecision } = require('./lib/decision-core');
    const { resolveCheckoutLink } = require('./lib/link-resolver');
    featureFlags = ffModule.featureFlags;
    console.log('✅ [V8.0] Feature Flags carregado');
} catch (e) {
    console.log('⚠️ [V8.0] Feature Flags não disponível:', e.message);
}

// ═══════════════════════════════════════════════════════
// 🧠 V10 ORCHESTRATOR — Camada Única de Decisão Final
// ═══════════════════════════════════════════════════════
let orchestrator = null;
try {
    const Orchestrator = require('./lib/orchestrator');
    orchestrator = new Orchestrator({ featureFlags });
    console.log('✅ [V10.0] Orchestrator carregado');
} catch (e) {
    console.log('⚠️ [V10.0] Orchestrator não disponível (não crítico):', e.message);
}

// ═══════════════════════════════════════════════════════
// 🔥 V11 ENGINE — Checkout Discovery + Links Map + Action Resolver + State
// ═══════════════════════════════════════════════════════
let _v11DiscoverCheckout = null;
let _v11BuildLinksMap = null;
let _v11ResolveAction = null;
let _v11ConversationState = null;

try {
    const _ckDiscovery = require('./lib/checkout-discovery');
    _v11DiscoverCheckout = _ckDiscovery.discoverCheckout;
    console.log('✅ [V11.0] Checkout Discovery carregado');
} catch (e) {
    console.log('⚠️ [V11.0] Checkout Discovery não disponível (não crítico):', e.message);
}
try {
    const _lm = require('./lib/links-map');
    _v11BuildLinksMap = _lm.buildLinksMap;
    console.log('✅ [V11.0] Links Map carregado');
} catch (e) {
    console.log('⚠️ [V11.0] Links Map não disponível (não crítico):', e.message);
}
try {
    const _ar = require('./lib/action-resolver');
    _v11ResolveAction = _ar.resolveAction;
    console.log('✅ [V11.0] Action Resolver carregado');
} catch (e) {
    console.log('⚠️ [V11.0] Action Resolver não disponível (não crítico):', e.message);
}
try {
    _v11ConversationState = require('./lib/conversation-state');
    console.log('✅ [V11.0] Conversation State carregado');
} catch (e) {
    console.log('⚠️ [V11.0] Conversation State não disponível (não crítico):', e.message);
}

// ═══════════════════════════════════════════════════════
// 🔥 V11.2 RAG ENGINE — Domain Crawler + Content Extraction + Knowledge Builder + Click Discovery
// ═══════════════════════════════════════════════════════
let _v112CrawlDomain = null;
let _v112ExtractContent = null;
let _v112DetectCheckoutFromLinks = null;
let _v112BuildKnowledge = null;
let _v112FormatKnowledgeContext = null;
let _v112ClickDiscovery = null;

try {
    const _dc = require('./lib/domain-crawler');
    _v112CrawlDomain = _dc.crawlDomain;
    console.log('✅ [V11.2] Domain Crawler carregado');
} catch (e) {
    console.log('⚠️ [V11.2] Domain Crawler não disponível (não crítico):', e.message);
}
try {
    const _ce = require('./lib/content-extractor-v112');
    _v112ExtractContent = _ce.extractContent;
    _v112DetectCheckoutFromLinks = _ce.detectCheckoutFromLinks;
    console.log('✅ [V11.2] Content Extractor carregado');
} catch (e) {
    console.log('⚠️ [V11.2] Content Extractor não disponível (não crítico):', e.message);
}
try {
    const _kb = require('./lib/knowledge-builder');
    _v112BuildKnowledge = _kb.buildKnowledge;
    _v112FormatKnowledgeContext = _kb.formatKnowledgeContext;
    console.log('✅ [V11.2] Knowledge Builder carregado');
} catch (e) {
    console.log('⚠️ [V11.2] Knowledge Builder não disponível (não crítico):', e.message);
}
try {
    const _ccd = require('./lib/checkout-click-discovery');
    _v112ClickDiscovery = _ccd.discoverCheckoutByClick;
    console.log('✅ [V11.2] Checkout Click Discovery carregado');
} catch (e) {
    console.log('⚠️ [V11.2] Checkout Click Discovery não disponível (não crítico):', e.message);
}

// ═══════════════════════════════════════════════════════
// 🔥 V11.3 FALLBACK INVISÍVEL — Checkout Persistence + Magic UI
// ═══════════════════════════════════════════════════════
let _v113GetConfirmedCheckout = null;
let _v113SaveCheckoutLink = null;
let _v113GetCheckoutStatus = null;
let _v113ClearCache = null;
let _v113ClearAllCache = null;
let _v113IsValidCheckoutDomain = null;

try {
    const _cfe = require('./lib/checkout-fallback-engine');
    _v113GetConfirmedCheckout = _cfe.getConfirmedCheckout;
    _v113SaveCheckoutLink = _cfe.saveCheckoutLink;
    _v113GetCheckoutStatus = _cfe.getCheckoutStatus;
    _v113ClearCache = _cfe.clearCache;
    _v113ClearAllCache = _cfe.clearAllCache;
    _v113IsValidCheckoutDomain = _cfe.isValidCheckoutDomain;
    console.log('✅ [V11.3] Checkout Fallback Engine carregado (v11.3.1-hotfix)');
    // 🧨 HOTFIX 11.3.1: Reset GLOBAL de cache na inicialização (contenção de incidente)
    if (_v113ClearAllCache) {
        _v113ClearAllCache();
        console.log('🧨 [V11.3-HOTFIX] Cache global resetado na inicialização (contenção ativa)');
    }
} catch (e) {
    console.log('⚠️ [V11.3] Checkout Fallback Engine não disponível (não crítico):', e.message);
}

// ═══════════════════════════════════════════════════════
// 🔒 V12.0 ESTABILIZAÇÃO — Safe Checkout Resolver + Force Checkout Layer
// ═══════════════════════════════════════════════════════
let _v12ValidateCheckout = null;
let _v12ForceCheckoutPipeline = null;

try {
    const _scr = require('./lib/safe-checkout-resolver');
    _v12ValidateCheckout = _scr.validateCheckoutForTenant;
    console.log('✅ [V12.0] Safe Checkout Resolver carregado');
} catch (e) {
    console.log('⚠️ [V12.0] Safe Checkout Resolver não disponível (não crítico):', e.message);
}

try {
    const _fc = require('./lib/force-checkout');
    _v12ForceCheckoutPipeline = _fc.applyForceCheckoutPipeline;
    console.log('✅ [V12.0] Force Checkout Layer carregado');
} catch (e) {
    console.log('⚠️ [V12.0] Force Checkout Layer não disponível (não crítico):', e.message);
}

// ═══════════════════════════════════════════════════════
// 🧠 V12.1 AUTÔNOMO — Self-Healing + Validator + Learning
// ═══════════════════════════════════════════════════════
let _v12ApplyHealing = null;
let _v12ValidateResponse = null;
let _v12SaveFailure = null;
let _v12SaveSuccess = null;

try {
    const _she = require('./lib/self-healing-engine');
    _v12ApplyHealing = _she.applyHealing;
    console.log('✅ [V12.1] Self-Healing Engine carregado');
} catch (e) {
    console.log('⚠️ [V12.1] Self-Healing Engine não disponível (não crítico):', e.message);
}

try {
    const _rv = require('./lib/response-validator');
    _v12ValidateResponse = _rv.validateResponse;
    console.log('✅ [V12.1] Response Validator carregado');
} catch (e) {
    console.log('⚠️ [V12.1] Response Validator não disponível (não crítico):', e.message);
}

try {
    const _lm = require('./lib/learning-memory');
    _v12SaveFailure = _lm.saveFailure;
    _v12SaveSuccess = _lm.saveSuccess;
    console.log('✅ [V12.1] Learning Memory carregado');
} catch (e) {
    console.log('⚠️ [V12.1] Learning Memory não disponível (não crítico):', e.message);
}

// ═══════════════════════════════════════════════════════
// 🔥 V13 ARQUITETURA BLINDADA — Controle Externo da IA
// Intent Classifier + State Manager + Rule Engine + Prompt Blindado + Validator
// Feature flag: FEATURE_V13_BLINDADO (default: FALSE — opt-in)
// ═══════════════════════════════════════════════════════
let _v13ClassifyIntent = null;
let _v13StateManager = null;
let _v13DecideAction = null;
let _v13BuildBlindadoPrompt = null;
let _v13GetLLMHardLimits = null;
let _v13ValidateResponse = null;

try {
    const _ic = require('./lib/v13-intent-classifier');
    _v13ClassifyIntent = _ic.classifyIntent;
    console.log('✅ [V13] Intent Classifier carregado');
} catch (e) {
    console.log('⚠️ [V13] Intent Classifier não disponível:', e.message);
}

try {
    _v13StateManager = require('./lib/v13-state-manager');
    console.log('✅ [V13] State Manager carregado');
} catch (e) {
    console.log('⚠️ [V13] State Manager não disponível:', e.message);
}

try {
    const _re = require('./lib/v13-rule-engine');
    _v13DecideAction = _re.decideAction;
    console.log('✅ [V13] Rule Engine carregado');
} catch (e) {
    console.log('⚠️ [V13] Rule Engine não disponível:', e.message);
}

try {
    const _pb = require('./lib/v13-prompt-blindado');
    _v13BuildBlindadoPrompt = _pb.buildBlindadoPrompt;
    _v13GetLLMHardLimits = _pb.getLLMHardLimits;
    console.log('✅ [V13] Prompt Blindado carregado');
} catch (e) {
    console.log('⚠️ [V13] Prompt Blindado não disponível:', e.message);
}

try {
    const _rv = require('./lib/v13-response-validator');
    _v13ValidateResponse = _rv.validateResponse;
    console.log('✅ [V13] Response Validator carregado');
} catch (e) {
    console.log('⚠️ [V13] Response Validator não disponível:', e.message);
}

// V13.0.2 — Response Builder (Sistema monta → IA humaniza)
let _v13BuildBaseResponse = null;
let _v13ApplyPostGuards = null;
try {
    const _rb = require('./lib/v13-response-builder');
    _v13BuildBaseResponse = _rb.buildBaseResponse;
    _v13ApplyPostGuards = _rb.applyPostGuards;
    console.log('✅ [V13.0.2] Response Builder carregado');
} catch (e) {
    console.log('⚠️ [V13.0.2] Response Builder não disponível:', e.message);
}

// V13.1 — Humanizer (IA só reescreve como humano)
let _v13BuildHumanizerPrompt = null;
let _v13ValidateHumanized = null;
try {
    const _hp = require('./lib/v13-humanizer-prompt');
    _v13BuildHumanizerPrompt = _hp.buildHumanizerPrompt;
    _v13ValidateHumanized = _hp.validateHumanizedResponse;
    console.log('✅ [V13.1] Humanizer carregado');
} catch (e) {
    console.log('⚠️ [V13.1] Humanizer não disponível:', e.message);
}

// V13.2 — Multi-Checkout Engine (upsell/downsell inteligente)
let _v13ResolveCheckout = null;
let _v13DetectObjectionType = null;
try {
    const _mce = require('./lib/v13-multi-checkout-engine');
    _v13ResolveCheckout = _mce.resolveCheckout;
    _v13DetectObjectionType = _mce.detectObjectionType;
    console.log('✅ [V13.2] Multi-Checkout Engine carregado');
} catch (e) {
    console.log('⚠️ [V13.2] Multi-Checkout Engine não disponível:', e.message);
}

// V13.2.1 — Checkout Classifier (auto-alimentação upsell/downsell)
let _v13EnrichPageData = null;
try {
    const _cc = require('./lib/v13-checkout-classifier');
    _v13EnrichPageData = _cc.enrichPageDataWithCheckouts;
    console.log('✅ [V13.2.1] Checkout Classifier carregado');
} catch (e) {
    console.log('⚠️ [V13.2.1] Checkout Classifier não disponível:', e.message);
}

// ═══════════════════════════════════════════════════════════════════
// V14.0 — AUTO-OTIMIZAÇÃO (Feature Flag: FEATURE_V14_SELF_OPTIMIZING)
// Camada ADITIVA — NÃO altera V13, apenas loga + aprende
// ═══════════════════════════════════════════════════════════════════
let _v14Logger = null;
let _v14OutcomeDetector = null;
let _v14PatternAnalyzer = null;
let _v14AdaptiveLayer = null;

try {
    _v14Logger = require('./lib/v14-conversation-logger');
    console.log('✅ [V14] Conversation Logger carregado');
} catch (e) {
    console.log('⚠️ [V14] Conversation Logger não disponível:', e.message);
}

try {
    _v14OutcomeDetector = require('./lib/v14-outcome-detector');
    console.log('✅ [V14] Outcome Detector carregado');
} catch (e) {
    console.log('⚠️ [V14] Outcome Detector não disponível:', e.message);
}

try {
    _v14PatternAnalyzer = require('./lib/v14-pattern-analyzer');
    console.log('✅ [V14] Pattern Analyzer carregado');
} catch (e) {
    console.log('⚠️ [V14] Pattern Analyzer não disponível:', e.message);
}

try {
    _v14AdaptiveLayer = require('./lib/v14-adaptive-layer');
    console.log('✅ [V14] Adaptive Layer carregado');
} catch (e) {
    console.log('⚠️ [V14] Adaptive Layer não disponível:', e.message);
}

// ===== V2.0 AUTO-LEARNING SYSTEM (ADITIVO, try/catch + flag gated) =====

// Configurar env vars ANTES de carregar módulos (sub-módulos checam process.env no require)
if (!process.env.FEATURE_AUTO_LEARNING) {
    process.env.FEATURE_AUTO_LEARNING = 'true';
    console.log('🧠 [AUTO-LEARNING] FEATURE_AUTO_LEARNING ativado por default');
}
if (!process.env.AUTO_LEARNING_TEST_MODE) {
    process.env.AUTO_LEARNING_TEST_MODE = 'true';
    console.log('🧪 [AUTO-LEARNING] TEST_MODE ativado (limiares reduzidos)');
}
if (!process.env.DEBUG_LEARNING) {
    process.env.DEBUG_LEARNING = 'true';
    console.log('🔍 [AUTO-LEARNING] DEBUG_LEARNING ativado');
}

let autoLearning = null;
try {
    autoLearning = require('./analytics/index');
    console.log('✅ [V2.0] Auto-Learning System carregado');
} catch (e) {
    console.log('⚠️ [V2.0] Auto-Learning não disponível (não crítico):', e.message);
}

try {
    const alModule = require('./lib/audit-logger');
    auditLogger = alModule.auditLogger;
    console.log('✅ [V8.0] Audit Logger carregado');
} catch (e) {
    console.log('⚠️ [V8.0] Audit Logger não disponível:', e.message);
}

try {
    const pmModule = require('./lib/persistent-memory');
    persistentMemory = pmModule.persistentMemory;
    console.log('✅ [V8.0] Persistent Memory carregado');
} catch (e) {
    console.log('⚠️ [V8.0] Persistent Memory não disponível:', e.message);
}

try {
    const esModule = require('./lib/enhanced-sentiment');
    enhancedSentiment = esModule.enhancedSentiment;
    console.log('✅ [V8.0] Enhanced Sentiment carregado');
} catch (e) {
    console.log('⚠️ [V8.0] Enhanced Sentiment não disponível:', e.message);
}

// ===== MÓDULOS V8.0 - COMPLIANCE =====
let rateLimiterAdvanced = null;
let lgpdConsentManager = null;
let encryptionManager = null;

try {
    const rlModule = require('./lib/rate-limiter-advanced');
    rateLimiterAdvanced = rlModule.rateLimiterAdvanced;
    console.log('✅ [V8.0] Rate Limiter Avançado carregado');
} catch (e) {
    console.log('⚠️ [V8.0] Rate Limiter Avançado não disponível:', e.message);
}

try {
    const lgpdModule = require('./lib/lgpd-consent');
    lgpdConsentManager = lgpdModule.lgpdConsentManager;
    console.log('✅ [V8.0] LGPD Consent Manager carregado');
} catch (e) {
    console.log('⚠️ [V8.0] LGPD Consent Manager não disponível:', e.message);
}

try {
    const encModule = require('./lib/encryption');
    encryptionManager = encModule.encryptionManager;
    console.log('✅ [V8.0] Encryption Manager carregado');
} catch (e) {
    console.log('⚠️ [V8.0] Encryption Manager não disponível:', e.message);
}

console.log('✅ Módulos V8.0 carregados (com fallbacks)');

// ===== CAMADA DE OTIMIZAÇÃO DE CONVERSÃO V1.0 (OPT-IN via env vars) =====
// Controle granular: cada módulo ativado APENAS quando env var = 'true' no Render
const FEATURE_SMART_CTA = process.env.FEATURE_SMART_CTA === 'true';
const FEATURE_ANTI_DROPOFF = process.env.FEATURE_ANTI_DROPOFF === 'true';
const FEATURE_CONVERSION_OPTIMIZER = process.env.FEATURE_CONVERSION_OPTIMIZER === 'true';
const FEATURE_CLOSING_SCRIPTS = process.env.FEATURE_CLOSING_SCRIPTS === 'true';

let _ctaEngine = null;
let _conversionOptimizer = null;
let _closingScripts = null;
let _antiDropoff = null;

try { _ctaEngine = require('./sales/cta-engine'); } catch (_) { /* silencioso */ }
try { _conversionOptimizer = require('./sales/conversion-optimizer'); } catch (_) { /* silencioso */ }
try { _closingScripts = require('./sales/closing-scripts'); } catch (_) { /* silencioso */ }
try { _antiDropoff = require('./sales/anti-dropoff'); } catch (_) { /* silencioso */ }

console.log(`✅ [CONVERSION-LAYER] Módulos carregados | CTA=${FEATURE_SMART_CTA} DROPOFF=${FEATURE_ANTI_DROPOFF} OPTIMIZER=${FEATURE_CONVERSION_OPTIMIZER} CLOSING=${FEATURE_CLOSING_SCRIPTS}`);

// ===== 🔒 CONTEXT LOCK SYSTEM + 🧠 V2 BEHAVIOR ENGINE (FEATURE_CONTEXT_LOCK) =====
// Ativado por padrão (opt-out via FEATURE_CONTEXT_LOCK=false)
const FEATURE_CONTEXT_LOCK = process.env.FEATURE_CONTEXT_LOCK !== 'false';

let _contextLock = null;
let _behaviorEngineV2 = null;

try { _contextLock = require('./sales/context-lock'); } catch (_) { /* silencioso */ }
try { _behaviorEngineV2 = require('./sales/behavior-engine-v2'); } catch (_) { /* silencioso */ }

console.log(`✅ [CONTEXT-LOCK] Módulo carregado=${!!_contextLock} | BehaviorV2=${!!_behaviorEngineV2} | Flag=${FEATURE_CONTEXT_LOCK}`);

// ===== MÓDULOS V8.0 REFATORADOS (Feature Flag: FEATURE_MODULAR_AI) =====
let aiSystemsModular = null;
let leadsModular = null;
let extractionModular = null;

try {
    aiSystemsModular = require('./lib/ai-systems');
    console.log('✅ [V8.0] AI Systems Modular carregado');
} catch (e) {
    console.log('⚠️ [V8.0] AI Systems Modular não disponível:', e.message);
}

try {
    leadsModular = require('./lib/leads');
    console.log('✅ [V8.0] Leads Modular carregado');
} catch (e) {
    console.log('⚠️ [V8.0] Leads Modular não disponível:', e.message);
}

try {
    extractionModular = require('./lib/extraction');
    console.log('✅ [V8.0] Extraction Modular carregado');
} catch (e) {
    console.log('⚠️ [V8.0] Extraction Modular não disponível:', e.message);
}

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const winston = require("winston");
const axios = require("axios");
const cheerio = require("cheerio");
const FirecrawlApp = require('./firecrawl-replacement');
const path = require("path");

// 🚀 ENHANCED CONTENT EXTRACTOR - OCR + Dynamic Content
let enhancedExtractor = null;
try {
    const { getEnhancedExtractor } = require('./enhanced-content-extractor');
    enhancedExtractor = getEnhancedExtractor({ verbose: false });
    console.log('✅ Enhanced Content Extractor carregado (OCR + Dynamic)');
} catch (e) {
    console.log('⚠️ Enhanced Content Extractor não disponível:', e.message);
}
const fs = require("fs");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const session = require("express-session");

// Optional dependencies with graceful fallback
let puppeteer = null;
try {
    puppeteer = require("puppeteer");
    console.log("✅ Puppeteer loaded - Dynamic rendering available");
} catch (e) {
    console.log("⚠️ Puppeteer not installed - Using basic extraction only");
}

// ===== SWAGGER/OPENAPI DOCUMENTATION =====
let setupSwagger;
try {
    setupSwagger = require('./swagger-config').setupSwagger;
} catch (e) {
    console.log('⚠️ Swagger não configurado - Instale: npm install swagger-ui-express yamljs');
}

const app = express();

// ===== CONFIGURAR SWAGGER (Documentação da API) =====
if (setupSwagger) {
    setupSwagger(app);
}

// Declarando conversationHistories no escopo global ou adequado
const conversationHistories = new Map();

// ===== SISTEMA DE SUPERINTELIGÊNCIA CONVERSACIONAL AVANÇADA =====
class SuperInteligenciaConversacional {
    constructor() {
        console.log("🧠 SUPERINTELIGÊNCIA CONVERSACIONAL - Inicializando Sistema Avançado");

        // Sistema de Memória Conversacional Avançada
        this.memoriaConversacional = new Map();
        this.personalidades = new Map();
        this.historicoEmocional = new Map();
        this.preferenciasUsuarios = new Map();
        this.padroesSucesso = new Map();

        // Configurações da Personalidade
        this.configPersonalidade = {
            nome: "Assistente IA",
            nivelEmpatia: 0.8,
            estiloComunicacao: "equilibrado", // formal, informal, tecnico, empatico
            usoHumor: true,
            regionalismos: ["brasil"],
            velocidadeResposta: "natural"
        };

        // Dicionário de Emoções Complexas
        this.emocionesComplexas = {
            nostalgia: ['saudade', 'lembrança', 'antigamente', 'na época', 'quando era'],
            ambivalencia: ['não sei', 'em dúvida', 'meio termo', 'por um lado', 'por outro'],
            frustracao: ['irritado', 'cansado', 'não aguento', 'chega', 'para com isso'],
            ansiedade: ['preocupado', 'nervoso', 'ansioso', 'apreensivo', 'medo'],
            euforia: ['incrível', 'maravilhoso', 'fantástico', 'perfeito', 'sensacional']
        };

        // Sistema de Sarcasmo e Ironia
        this.detectoresSarcasmo = {
            padroes: [
                /claro que (não|sim)/i,
                /maravilhoso/i,
                /perfeito/i,
                /exatamente o que eu queria/i,
                /ótimo momento/i
            ],
            contextoNegativo: ['problema', 'erro', 'falha', 'difícil', 'complicado']
        };

        // Memória de Preferências Conversacionais
        this.preferenciasConversacionais = {
            nivelDetalhe: new Map(), // 'superficial' | 'detalhado' | 'técnico'
            estiloHumor: new Map(), // 'leve' | 'ironico' | 'nenhum'
            formalidade: new Map(), // 'formal' | 'informal' | 'neutro'
            tempoResposta: new Map() // 'rapido' | 'reflexivo'
        };
    }

    // ===== DETECÇÃO AVANÇADA DE EMOÇÕES E INTENÇÕES =====
    analisarEstadoEmocional(mensagem, contexto = {}) {
        const mensagemLower = mensagem.toLowerCase();
        let emocaoPrimaria = "neutro";
        let emocaoSecundaria = null;
        let intensidade = 1;
        let sarcasmoDetectado = false;
        let intencoesMultiplas = [];

        // Detecção de Sarcasmo e Ironia
        sarcasmoDetectado = this.detectarSarcasmo(mensagemLower, contexto);

        // Análise de Emoções Complexas
        for (const [emocao, termos] of Object.entries(this.emocionesComplexas)) {
            const matches = termos.filter(termo => mensagemLower.includes(termo));
            if (matches.length > 0) {
                if (!emocaoPrimaria || emocaoPrimaria === "neutro") {
                    emocaoPrimaria = emocao;
                } else {
                    emocaoSecundaria = emocao;
                }
                intensidade = Math.max(intensidade, matches.length);
            }
        }

        // Detecção de Múltiplas Intenções
        intencoesMultiplas = this.detectarMultiplasIntencoes(mensagemLower);

        // Análise de Urgência e Prioridade
        const urgencia = this.analisarUrgencia(mensagemLower);
        const prioridade = this.analisarPrioridade(mensagemLower, contexto);

        return {
            emocaoPrimaria,
            emocaoSecundaria,
            intensidade: Math.min(3, intensidade),
            sarcasmo: sarcasmoDetectado,
            urgencia,
            prioridade,
            intencoesMultiplas,
            contextoEmocional: this.analisarContextoEmocional(mensagemLower)
        };
    }

    detectarSarcasmo(mensagem, contexto) {
        // Verificação por padrões linguísticos de sarcasmo
        const padraoSarcasmo = this.detectoresSarcasmo.padroes.some(padrao =>
            padrao.test(mensagem)
        );

        // Verificação por incongruência contexto/sentimento
        const contextoNegativo = this.detectoresSarcasmo.contextoNegativo.some(termo =>
            mensagem.includes(termo)
        );
        const sentimentoPositivo = /maravilhoso|perfeito|excelente|ótimo/i.test(mensagem);

        return (padraoSarcasmo || (contextoNegativo && sentimentoPositivo));
    }

    detectarMultiplasIntencoes(mensagem) {
        const intencoes = [];

        // Mapeamento de intenções complexas
        const mapeamentoIntencoes = {
            informacao: ['o que é', 'como funciona', 'explica', 'entender'],
            suporte: ['problema', 'erro', 'não funciona', 'ajuda', 'suporte'],
            venda: ['preço', 'valor', 'comprar', 'adquirir', 'contratar'],
            relacionamento: ['obrigado', 'gostei', 'parabéns', 'reclamação'],
            urgente: ['urgente', 'agora', 'imediatamente', 'rápido']
        };

        for (const [intencao, termos] of Object.entries(mapeamentoIntencoes)) {
            if (termos.some(termo => mensagem.includes(termo))) {
                intencoes.push(intencao);
            }
        }

        return intencoes;
    }

    analisarUrgencia(mensagem) {
        const termosUrgencia = ['urgente', 'agora', 'imediatamente', 'rápido', 'importante', 'prioridade'];
        return termosUrgencia.some(termo => mensagem.includes(termo)) ? 2 : 1;
    }

    analisarPrioridade(mensagem, contexto) {
        let prioridade = 1;

        // Aumenta prioridade baseado em contexto emocional
        if (contexto.emocional === 'frustracao' || contexto.emocional === 'ansiedade') {
            prioridade += 1;
        }

        // Aumenta prioridade para intenções de suporte
        if (mensagem.includes('problema') || mensagem.includes('erro')) {
            prioridade += 1;
        }

        return Math.min(3, prioridade);
    }

    analisarContextoEmocional(mensagem) {
        const contexto = {
            nivelFrustracao: this.contarTermos(mensagem, ['não consigo', 'difícil', 'complicado', 'chato']),
            nivelSatisfacao: this.contarTermos(mensagem, ['obrigado', 'gostei', 'excelente', 'perfeito']),
            nivelConfusao: this.contarTermos(mensagem, ['não entendi', 'como assim', 'explica', 'entender']),
            nivelUrgencia: this.contarTermos(mensagem, ['urgente', 'agora', 'rápido', 'importante'])
        };

        return contexto;
    }

    contarTermos(mensagem, termos) {
        return termos.filter(termo => mensagem.includes(termo)).length;
    }

    // ===== SISTEMA DE MEMÓRIA CONVERSACIONAL AVANÇADA =====
    atualizarMemoriaUsuario(userId, interacao, tenantId = null) {
        if (!this.memoriaConversacional.has(userId)) {
            this.memoriaConversacional.set(userId, {
                historico: [],
                preferencias: {},
                estiloComunicacao: 'neutro',
                emocaoPredominante: 'neutro',
                ultimaInteracao: new Date(),
                insideJokes: [],
                referenciasCompartilhadas: []
            });
        }

        const memoria = this.memoriaConversacional.get(userId);

        // Atualizar histórico
        memoria.historico.push({
            timestamp: new Date(),
            mensagem: interacao.mensagem,
            emocao: interacao.emocao,
            intencoes: interacao.intencoes
        });

        // Manter apenas últimas 50 interações
        if (memoria.historico.length > 50) {
            memoria.historico = memoria.historico.slice(-50);
        }

        // Atualizar preferências baseado no comportamento
        this.atualizarPreferenciasUsuario(memoria, interacao);

        memoria.ultimaInteracao = new Date();

        // ===== V8.0: PERSISTÊNCIA NO BANCO COM FEATURE FLAG =====
        if (featureFlags && featureFlags.isEnabled('FEATURE_PERSISTENT_MEMORY')) {
            try {
                if (persistentMemory) {
                    // Fire-and-forget para não bloquear
                    persistentMemory.update(userId, {
                        mensagem: interacao.mensagem,
                        emocao: interacao.emocao,
                        intencoes: interacao.intencoes,
                        preferencias: memoria.preferencias,
                        topicos: interacao.topicos || []
                    }, tenantId).catch(err => {
                        console.warn('⚠️ [V8.0] Erro ao persistir memória:', err.message);
                    });
                    console.log(`🧠 [V8.0] Memória persistida para usuário ${userId.substring(0, 8)}...`);
                }
            } catch (err) {
                console.warn('⚠️ [V8.0] Erro ao salvar memória persistente:', err.message);
                // Não propaga erro - Map local já tem os dados
            }
        }
    }

    atualizarPreferenciasUsuario(memoria, interacao) {
        // Detectar preferência por nível de detalhe
        if (interacao.mensagem.includes('mais detalhes') || interacao.mensagem.includes('explica melhor')) {
            memoria.preferencias.nivelDetalhe = 'detalhado';
        } else if (interacao.mensagem.includes('resumido') || interacao.mensagem.includes('resumo')) {
            memoria.preferencias.nivelDetalhe = 'superficial';
        }

        // Detectar preferência por formalidade
        if (interacao.mensagem.includes('por favor') || interacao.mensagem.includes('você poderia')) {
            memoria.preferencias.formalidade = 'formal';
        } else if (interacao.mensagem.includes('beleza') || interacao.mensagem.includes('valeu')) {
            memoria.preferencias.formalidade = 'informal';
        }
    }

    // ===== GERADOR DE RESPOSTAS SUPERINTELIGENTES =====
    gerarRespostaSuperInteligente(mensagemUsuario, estadoEmocional, memoriaUsuario, contextoPagina) {
        const timestamp = new Date();

        // Análise profunda da mensagem
        const analiseProfunda = this.analisarMensagemProfundamente(mensagemUsuario);

        // Construção da personalidade contextual
        const personalidadeContextual = this.construirPersonalidadeContextual(estadoEmocional, memoriaUsuario);

        // Geração da resposta base
        let respostaBase = this.gerarRespostaBase(analiseProfunda, contextoPagina);

        // Aplicação de camadas de inteligência emocional
        respostaBase = this.aplicarCamadaEmpatica(respostaBase, estadoEmocional);
        respostaBase = this.aplicarCamadaConversacional(respostaBase, analiseProfunda);
        respostaBase = this.aplicarCamadaPersonalidade(respostaBase, personalidadeContextual);
        respostaBase = this.aplicarCamadaMemoria(respostaBase, memoriaUsuario);

        // Finalização e polimento
        const respostaFinal = this.polirResposta(respostaBase, estadoEmocional, memoriaUsuario);

        console.log('🧠 [SUPERINTELIGÊNCIA] Resposta gerada:', {
            emocao: estadoEmocional.emocaoPrimaria,
            intencoes: estadoEmocional.intencoesMultiplas,
            personalidade: personalidadeContextual.estilo,
            comprimento: respostaFinal.length
        });

        return respostaFinal;
    }

    analisarMensagemProfundamente(mensagem) {
        return {
            complexidade: this.calcularComplexidade(mensagem),
            ambiguidade: this.detectarAmbiguidade(mensagem),
            tom: this.analisarTom(mensagem),
            estruturas: this.extrairEstruturas(mensagem),
            referencias: this.extrairReferencias(mensagem)
        };
    }

    calcularComplexidade(mensagem) {
        const palavras = mensagem.split(' ').length;
        const frases = mensagem.split(/[.!?]+/).length - 1;
        const complexidadeEstrutural = palavras > 20 ? 'alta' : palavras > 10 ? 'media' : 'baixa';

        return {
            estrutural: complexidadeEstrutural,
            palavras: palavras,
            frases: frases,
            score: Math.min(10, palavras * 0.5 + frases * 2)
        };
    }

    detectarAmbiguidade(mensagem) {
        const termosAmbiguos = ['isso', 'aquilo', 'aquele', 'desse jeito', 'assim'];
        const ambiguidades = termosAmbiguos.filter(termo => mensagem.includes(termo));

        return {
            possui: ambiguidades.length > 0,
            termos: ambiguidades,
            nivel: ambiguidades.length
        };
    }

    analisarTom(mensagem) {
        const tom = {
            formal: this.contarTermos(mensagem, ['por favor', 'gostaria', 'poderia', 'agradeço']),
            informal: this.contarTermos(mensagem, ['beleza', 'valeu', 'oi', 'e aí']),
            tecnico: this.contarTermos(mensagem, ['funcionamento', 'especificação', 'técnico', 'detalhe']),
            emocional: this.contarTermos(mensagem, ['nervoso', 'feliz', 'preocupado', 'ansioso'])
        };

        const tomPredominante = Object.keys(tom).reduce((a, b) => tom[a] > tom[b] ? a : b);
        return {
            predominante: tomPredominante,
            scores: tom
        };
    }

    extrairEstruturas(mensagem) {
        return {
            perguntas: (mensagem.match(/\?/g) || []).length,
            exclamacoes: (mensagem.match(/\!/g) || []).length,
            reticencias: (mensagem.match(/\.{3,}/g) || []).length,
            maiusculas: (mensagem.match(/[A-ZÀ-Ú]{3,}/g) || []).length
        };
    }

    extrairReferencias(mensagem) {
        const referencias = {
            temporais: this.extrairReferenciasTemporais(mensagem),
            espaciais: this.extrairReferenciasEspaciais(mensagem),
            pessoais: this.extrairReferenciasPessoais(mensagem)
        };

        return referencias;
    }

    extrairReferenciasTemporais(mensagem) {
        const padroes = [
            /\b(hoje|amanhã|ontem)\b/gi,
            /\b(agora|já|depois)\b/gi,
            /\b(semana|mês|ano)\b/gi
        ];

        return padroes.flatMap(padrao => mensagem.match(padrao) || []);
    }

    extrairReferenciasEspaciais(mensagem) {
        const padroes = [
            /\b(aqui|ali|lá)\b/gi,
            /\b(nesse|naquele)\b/gi,
            /\b(perto|longe)\b/gi
        ];

        return padroes.flatMap(padrao => mensagem.match(padrao) || []);
    }

    extrairReferenciasPessoais(mensagem) {
        const padroes = [
            /\b(eu|meu|minha)\b/gi,
            /\b(você|teu|sua)\b/gi,
            /\b(nós|nosso)\b/gi
        ];

        return padroes.flatMap(padrao => mensagem.match(padrao) || []);
    }

    construirPersonalidadeContextual(estadoEmocional, memoriaUsuario) {
        let estilo = 'equilibrado';
        let nivelEmpatia = this.configPersonalidade.nivelEmpatia;
        let usoHumor = this.configPersonalidade.usoHumor;

        // Adaptar baseado no estado emocional do usuário
        if (estadoEmocional.emocaoPrimaria === 'frustracao') {
            estilo = 'empatico';
            nivelEmpatia = 0.9;
            usoHumor = false;
        } else if (estadoEmocional.emocaoPrimaria === 'euforia') {
            estilo = 'entusiasmado';
            nivelEmpatia = 0.7;
            usoHumor = true;
        } else if (estadoEmocional.emocaoPrimaria === 'ansiedade') {
            estilo = 'calmo';
            nivelEmpatia = 0.95;
            usoHumor = false;
        }

        // Considerar preferências do usuário
        if (memoriaUsuario && memoriaUsuario.preferencias) {
            if (memoriaUsuario.preferencias.formalidade === 'formal') {
                estilo = 'formal';
            } else if (memoriaUsuario.preferencias.formalidade === 'informal') {
                estilo = 'informal';
            }
        }

        return {
            estilo,
            nivelEmpatia,
            usoHumor,
            velocidade: 'natural',
            registro: this.definirRegistro(estilo)
        };
    }

    definirRegistro(estilo) {
        const registros = {
            formal: {
                saudacao: "Prezado(a)",
                despedida: "Cordialmente",
                tratamento: "você",
                verbos: ["poderia", "gostaria", "deseja"]
            },
            informal: {
                saudacao: "E aí",
                despedida: "Valeu",
                tratamento: "você",
                verbos: ["pode", "quer", "vai"]
            },
            empatico: {
                saudacao: "Olá",
                despedida: "Estou aqui se precisar",
                tratamento: "você",
                verbos: ["gostaria", "precisa", "quer"]
            },
            equilibrado: {
                saudacao: "Olá",
                despedida: "Até mais",
                tratamento: "você",
                verbos: ["pode", "gostaria", "quer"]
            }
        };

        return registros[estilo] || registros.equilibrado;
    }

    gerarRespostaBase(analiseProfunda, contextoPagina) {
        // Resposta base adaptada à complexidade da pergunta
        if (analiseProfunda.complexidade.score > 7) {
            return "Essa é uma questão bastante interessante e complexa. Vamos analisar ponto a ponto...";
        } else if (analiseProfunda.complexidade.score > 4) {
            return "Entendi sua pergunta. Deixe-me explicar de forma clara...";
        } else {
            return "Claro! Sobre isso...";
        }
    }

    aplicarCamadaEmpatica(resposta, estadoEmocional) {
        let prefixoEmpatico = "";

        if (estadoEmocional.emocaoPrimaria === 'frustracao') {
            prefixoEmpatico = "Entendo que isso pode ser frustrante. ";
        } else if (estadoEmocional.emocaoPrimaria === 'ansiedade') {
            prefixoEmpatico = "Compreendo sua preocupação. ";
        } else if (estadoEmocional.emocaoPrimaria === 'euforia') {
            prefixoEmpatico = "Que bom ver seu entusiasmo! ";
        } else if (estadoEmocional.sarcasmo) {
            prefixoEmpatico = "Percebi o tom da sua mensagem. ";
        }

        return prefixoEmpatico + resposta;
    }

    aplicarCamadaConversacional(resposta, analiseProfunda) {
        // Adicionar elementos conversacionais naturais
        if (analiseProfunda.complexidade.score > 5) {
            resposta = "Hmm, " + resposta.toLowerCase();
        }

        if (analiseProfunda.ambiguidade.possui) {
            resposta += " Se eu entendi corretamente...";
        }

        return resposta;
    }

    aplicarCamadaPersonalidade(resposta, personalidade) {
        // Adaptar resposta ao estilo da personalidade
        if (personalidade.estilo === 'informal') {
            resposta = resposta.replace(/Cordialmente/g, "Valeu");
            resposta = resposta.replace(/Prezado\(a\)/g, "E aí");
        } else if (personalidade.estilo === 'empatico') {
            resposta = resposta.replace(/\./g, ". Espero que isso ajude.");
        }

        return resposta;
    }

    aplicarCamadaMemoria(resposta, memoriaUsuario) {
        if (!memoriaUsuario || memoriaUsuario.historico.length < 2) {
            return resposta;
        }

        // Referenciar conversas anteriores se relevante
        const ultimaInteracao = memoriaUsuario.historico[memoriaUsuario.historico.length - 2];
        if (ultimaInteracao && this.saoTopicosRelacionados(ultimaInteracao.mensagem)) {
            resposta = `Continuando nosso papelo anterior, ${resposta.toLowerCase()}`;
        }

        return resposta;
    }

    saoTopicosRelacionados(mensagemAnterior) {
        const topicosComuns = ['preço', 'valor', 'funcionamento', 'como', 'quando'];
        return topicosComuns.some(topico => mensagemAnterior.includes(topico));
    }

    polirResposta(resposta, estadoEmocional, memoriaUsuario) {
        // Adicionar elementos de naturalidade
        if (estadoEmocional.intensidade > 1) {
            resposta = this.adicionarEnfase(resposta, estadoEmocional.intensidade);
        }

        // Adicionar elementos visuais contextuais
        resposta = this.adicionarElementosVisuais(resposta, estadoEmocional);

        // Garantir coerência com histórico
        resposta = this.ajustarCoerencia(resposta, memoriaUsuario);

        return resposta;
    }

    adicionarEnfase(resposta, intensidade) {
        const enfases = {
            1: ["", ""],
            2: ["**", "**"],
            3: ["**🎯 ", "**"]
        };

        const [prefixo, sufixo] = enfases[intensidade] || enfases[1];

        // Aplicar ênfase na primeira frase
        const frases = resposta.split('.');
        if (frases.length > 0) {
            frases[0] = prefixo + frases[0] + sufixo;
            return frases.join('.');
        }

        return resposta;
    }

    adicionarElementosVisuais(resposta, estadoEmocional) {
        const elementos = {
            frustracao: "😔",
            ansiedade: "🤗",
            euforia: "🎉",
            nostalgia: "✨",
            neutro: "💭"
        };

        const elemento = elementos[estadoEmocional.emocaoPrimaria] || elementos.neutro;
        return elemento + " " + resposta;
    }

    ajustarCoerencia(resposta, memoriaUsuario) {
        if (!memoriaUsuario) return resposta;

        // Garantir que o estilo seja consistente com preferências
        if (memoriaUsuario.preferencias && memoriaUsuario.preferencias.formalidade === 'formal') {
            resposta = resposta.replace(/e aí/gi, "Olá")
                .replace(/valeu/gi, "Agradeço");
        }

        return resposta;
    }

    // ===== SISTEMA DE APRENDIZADO CONTÍNUO =====
    aprenderDaInteracao(userId, mensagemUsuario, resposta, feedbackImplicito) {
        if (!this.memoriaConversacional.has(userId)) return;

        const memoria = this.memoriaConversacional.get(userId);

        // Analisar feedback implícito (engajamento, continuidade)
        const engajamento = this.analisarEngajamento(mensagemUsuario, resposta);

        // Atualizar preferências baseado no engajamento
        if (engajamento.alto) {
            memoria.preferencias.estiloAtual = 'efetivo';
        }

        // Aprender padrões de sucesso
        this.registrarPadraoSucesso(userId, mensagemUsuario, resposta, engajamento);
    }

    analisarEngajamento(mensagemUsuario, resposta) {
        const mensagemLower = mensagemUsuario.toLowerCase();

        return {
            continuouConversa: !mensagemLower.includes('tchau') && !mensagemLower.includes('obrigado'),
            fezPergunta: mensagemLower.includes('?') ||
                mensagemLower.includes('como') ||
                mensagemLower.includes('quando'),
            mostrouSatisfacao: mensagemLower.includes('obrigado') ||
                mensagemLower.includes('perfeito') ||
                mensagemLower.includes('ajudou'),
            alto: this.calcularNivelEngajamento(mensagemUsuario)
        };
    }

    calcularNivelEngajamento(mensagem) {
        let score = 0;
        score += (mensagem.split(' ').length > 5) ? 1 : 0;
        score += (mensagem.includes('?')) ? 1 : 0;
        score += (mensagem.includes('obrigado') || mensagem.includes('valeu')) ? 0.5 : 0;
        return score;
    }

    registrarPadraoSucesso(userId, mensagemUsuario, resposta, engajamento) {
        // Registrar padrões que funcionam bem para este usuário
        if (engajamento.alto) {
            const padrao = {
                tipoMensagem: this.classificarMensagem(mensagemUsuario),
                tipoResposta: this.classificarResposta(resposta),
                timestamp: new Date(),
                eficacia: engajamento.alto ? 'alta' : 'media'
            };

            if (!this.padroesSucesso.has(userId)) {
                this.padroesSucesso.set(userId, []);
            }

            this.padroesSucesso.get(userId).push(padrao);
        }
    }

    classificarMensagem(mensagem) {
        if (mensagem.includes('?')) return 'pergunta';
        if (mensagem.includes('obrigado')) return 'agradecimento';
        if (mensagem.includes('problema')) return 'suporte';
        return 'declaracao';
    }

    classificarResposta(resposta) {
        if (resposta.includes('**')) return 'enfatica';
        if (resposta.length > 150) return 'detalhada';
        if (resposta.length < 50) return 'concisa';
        return 'padrao';
    }
}

// Inicializar SuperInteligência Global
const superInteligenciaGlobal = new SuperInteligenciaConversacional();
console.log("🧠 SUPERINTELIGÊNCIA CONVERSACIONAL - Sistema Avançado Carregado");

// ===== SISTEMA DE ARMAZENAMENTO DE LEADS PERSISTENTE =====
function getTenantLeadsFilePath(apiKey) {
    const dataDir = path.join(__dirname, "data");
    const tenantDir = path.join(dataDir, "tenants");
    if (!fs.existsSync(tenantDir)) {
        fs.mkdirSync(tenantDir, { recursive: true });
    }
    return path.join(tenantDir, `leads-${apiKey}.json`);
}

// 📅 Função para obter caminho do arquivo de agendamentos por tenant
function getTenantAppointmentsFilePath(apiKey) {
    const tenantDir = path.join(__dirname, 'data', 'tenants');
    if (!fs.existsSync(tenantDir)) {
        fs.mkdirSync(tenantDir, { recursive: true });
    }
    return path.join(tenantDir, `appointments-${apiKey}.json`);
}

class LeadCaptureSystem {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.leadsFilePath = getTenantLeadsFilePath(this.apiKey);
        this.ensureDataDirectory();
        this.leads = this.loadLeadsSync(); // Carrega JSON primeiro (síncrono)
        this._postgresInitialized = false;

        // Inicializar PostgreSQL assincronamente (se disponível)
        if (USE_POSTGRES) {
            this.initializePostgres();
        }

        console.log(`📊 Sistema de Leads Inicializado: ${this.leads.length} leads carregados`);
        console.log(`💾 Arquivo de leads: ${this.leadsFilePath}`);
        console.log(`🗄️ PostgreSQL: ${USE_POSTGRES ? 'Habilitado' : 'Desabilitado (usando JSON)'}`);
    }

    // Inicializar PostgreSQL e migrar dados JSON se necessário
    async initializePostgres() {
        try {
            // Buscar leads do PostgreSQL
            const dbLeads = await DatabaseHelpers.getLeads(this.apiKey);

            // Se PostgreSQL vazio e JSON tem dados, migrar
            if (dbLeads.length === 0 && this.leads.length > 0) {
                console.log(`🔄 Migrando ${this.leads.length} leads de JSON para PostgreSQL...`);
                for (const lead of this.leads) {
                    await DatabaseHelpers.saveLead(this.apiKey, {
                        id: lead.id,
                        nome: lead.nome || lead.name,
                        email: lead.email,
                        telefone: lead.telefone || lead.phone,
                        message: lead.message,
                        url_origem: lead.url_origem || lead.url,
                        source: lead.source || 'widget',
                        status: lead.status || 'ativo',
                        metadata: lead.metadata || {},
                        conversations: lead.conversations || []
                    });
                }
                console.log(`✅ Migração concluída: ${this.leads.length} leads migrados para PostgreSQL`);
            } else if (dbLeads.length > 0) {
                // PostgreSQL tem dados, usar como fonte primária
                this.leads = dbLeads.map(lead => ({
                    id: lead.id,
                    nome: lead.nome,
                    email: lead.email,
                    telefone: lead.telefone,
                    message: lead.message,
                    url_origem: lead.url_origem,
                    source: lead.source,
                    status: lead.status,
                    timestamp: lead.created_at,
                    lastInteraction: lead.updated_at,
                    conversations: lead.conversations || [],
                    journeyStage: lead.metadata?.journeyStage || 'descoberta'
                }));
                console.log(`🗄️ ${dbLeads.length} leads carregados do PostgreSQL`);
            }

            this._postgresInitialized = true;
        } catch (error) {
            console.error('❌ Erro ao inicializar PostgreSQL para leads:', error);
            console.log('🔄 Continuando com JSON como fallback');
        }
    }

    ensureDataDirectory() {
        try {
            const dir = path.dirname(this.leadsFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Diretório criado: ${dir}`);
            }
        } catch (error) {
            console.error("❌ Erro ao criar diretório:", error);
            // Fallback para diretório atual se data/ não funcionar
            this.leadsFilePath = path.join(__dirname, "leads.json");
            console.log(`🔄 Usando fallback: ${this.leadsFilePath}`);
        }
    }

    // Carregamento síncrono de JSON (para inicialização)
    loadLeadsSync() {
        try {
            if (fs.existsSync(this.leadsFilePath)) {
                const data = fs.readFileSync(this.leadsFilePath, "utf8");
                const leads = JSON.parse(data);
                console.log(`📥 Leads carregados do JSON: ${leads.length} registros`);
                return leads;
            }
        } catch (error) {
            console.error("❌ Erro ao carregar leads do JSON:", error);
        }
        console.log("📝 Inicializando novo arquivo de leads");
        return [];
    }

    // Alias para compatibilidade
    loadLeads() {
        return this.loadLeadsSync();
    }

    // Salvar leads em PostgreSQL (primário) e JSON (backup)
    async saveLeads() {
        try {
            // Salvar em PostgreSQL se disponível
            if (USE_POSTGRES) {
                for (const lead of this.leads) {
                    await DatabaseHelpers.saveLead(this.apiKey, {
                        id: lead.id,
                        nome: lead.nome || lead.name,
                        email: lead.email,
                        telefone: lead.telefone || lead.phone,
                        message: lead.message,
                        url_origem: lead.url_origem || lead.url,
                        source: lead.source || 'widget',
                        status: lead.status || 'ativo',
                        metadata: { journeyStage: lead.journeyStage },
                        conversations: lead.conversations || []
                    });
                }
                console.log(`🗄️ Leads salvos no PostgreSQL: ${this.leads.length} registros`);
            }

            // Sempre salvar em JSON como backup local
            fs.writeFileSync(this.leadsFilePath, JSON.stringify(this.leads, null, 2));
            console.log(`💾 Leads salvos no JSON: ${this.leads.length} registros`);
            return true;
        } catch (error) {
            console.error("❌ Erro ao salvar leads:", error);
            // Fallback: salvar apenas em JSON
            try {
                fs.writeFileSync(this.leadsFilePath, JSON.stringify(this.leads, null, 2));
                return true;
            } catch (jsonError) {
                console.error("❌ Erro ao salvar leads em JSON:", jsonError);
                return false;
            }
        }
    }

    addLead(leadData) {
        const lead = {
            id: crypto.randomBytes(8).toString("hex"),
            timestamp: new Date().toISOString(),
            ...leadData,
            conversations: [],
            journeyStage: "descoberta",
            lastInteraction: new Date().toISOString(),
            status: "ativo"
        };

        this.leads.push(lead);
        this.saveLeads();
        console.log(`🎯 NOVO LEAD: ${lead.nome} (${lead.email})`);
        return lead;
    }

    updateLeadConversation(leadId, message, isUser = true) {
        const lead = this.leads.find(l => l.id === leadId);
        if (lead) {
            // 🎯 CORREÇÃO: Remover caracteres especiais como <s> [OUT]
            const cleanMessage = this.cleanMessage(message);

            lead.conversations.push({
                timestamp: new Date().toISOString(),
                message: cleanMessage,
                isUser
            });
            lead.lastInteraction = new Date().toISOString();
            this.saveLeads();
        }
    }

    // 🎯 NOVA FUNÇÃO: Limpar mensagem de caracteres especiais
    cleanMessage(message) {
        if (!message) return '';
        return String(message)
            .replace(/<s>\s*\[OUT\]/g, '') // Remove <s> [OUT]
            .replace(/<[^>]*>/g, '') // Remove todas as tags HTML
            .replace(/\[.*?\]/g, '') // Remove colchetes
            .replace(/\s+/g, ' ') // Normaliza espaços
            .trim();
    }

    updateLeadJourneyStage(leadId, stage) {
        const lead = this.leads.find(l => l.id === leadId);
        if (lead && ["descoberta", "negociacao", "fidelizacao"].includes(stage)) {
            lead.journeyStage = stage;
            this.saveLeads();
        }
    }

    getLeads() {
        return this.leads.sort((a, b) => new Date(b.lastInteraction) - new Date(a.lastInteraction));
    }

    getLeadById(leadId) {
        return this.leads.find(l => l.id === leadId);
    }

    findLeadByEmail(email) {
        return this.leads.find(l => l.email === email);
    }

    // 🎯 BUG-FIX-004: Excluir lead individual por ID (novo método isolado)
    deleteLeadById(leadId) {
        try {
            const index = this.leads.findIndex(l => l.id === leadId);
            if (index === -1) return null;

            const removedLead = this.leads.splice(index, 1)[0];
            this.saveLeads();
            console.log(`🗑️ Lead removido: ${removedLead.nome || removedLead.email} (ID: ${leadId})`);

            // Remover do PostgreSQL também (tabela tenant_leads) — fallback silencioso
            if (USE_POSTGRES) {
                try {
                    db.query(
                        'DELETE FROM tenant_leads WHERE id = $1 AND api_key = $2',
                        [leadId, this.apiKey]
                    ).then(() => {
                        console.log(`🗄️ Lead ${leadId} removido do PostgreSQL`);
                    }).catch(err => console.warn('⚠️ Fallback: Erro ao deletar lead do PostgreSQL:', err.message));
                } catch (pgErr) {
                    // Silencioso - JSON já foi atualizado
                }
            }

            return removedLead;
        } catch (error) {
            console.error('❌ Erro ao deletar lead:', error);
            return null;
        }
    }

    // 🎯 BUG-FIX-003: Excluir leads por robotName (para limpeza ao deletar assistente)
    deleteLeadsByRobotName(robotName) {
        try {
            const before = this.leads.length;
            const removedLeads = this.leads.filter(l => l.robotName === robotName);
            this.leads = this.leads.filter(l => l.robotName !== robotName);
            const removed = before - this.leads.length;

            if (removed > 0) {
                this.saveLeads();
                console.log(`🗑️ ${removed} leads do assistente "${robotName}" removidos do JSON`);

                // Remover leads do PostgreSQL (tabela tenant_leads) — fallback silencioso
                if (USE_POSTGRES) {
                    try {
                        const idsToRemove = removedLeads.map(l => l.id);
                        for (const leadId of idsToRemove) {
                            db.query(
                                'DELETE FROM tenant_leads WHERE id = $1 AND api_key = $2',
                                [leadId, this.apiKey]
                            ).catch(err => console.warn(`⚠️ Fallback PG delete lead ${leadId}:`, err.message));
                        }
                        console.log(`🗄️ ${idsToRemove.length} leads removidos do PostgreSQL`);
                    } catch (pgErr) {
                        console.warn('⚠️ Erro ao limpar leads do PostgreSQL (não crítico):', pgErr.message);
                    }
                }
            }
            return removed;
        } catch (error) {
            console.error('❌ Erro ao deletar leads por robotName:', error);
            return 0;
        }
    }

    // 🎯 Encontrar lead por conversationId para rastrear mensagens
    findLeadByConversationId(conversationId) {
        return this.leads.find(l => l.conversationId === conversationId);
    }

    // ===== 📅 SISTEMA DE AGENDAMENTOS =====

    initializeAppointments() {
        this.appointmentsFilePath = getTenantAppointmentsFilePath(this.apiKey);
        this.appointments = this.loadAppointmentsSync();
        console.log(`📅 Sistema de Agendamentos: ${this.appointments.length} agendamentos carregados`);

        // Inicializar PostgreSQL para agendamentos
        if (USE_POSTGRES) {
            this.initializeAppointmentsPostgres();
        }
    }

    // Inicializar agendamentos do PostgreSQL com migração
    async initializeAppointmentsPostgres() {
        try {
            const dbAppointments = await DatabaseHelpers.getAppointments(this.apiKey);

            // Se PostgreSQL vazio e JSON tem dados, migrar
            if (dbAppointments.length === 0 && this.appointments.length > 0) {
                console.log(`🔄 Migrando ${this.appointments.length} agendamentos de JSON para PostgreSQL...`);
                for (const apt of this.appointments) {
                    await DatabaseHelpers.saveAppointment(this.apiKey, {
                        id: apt.id,
                        leadId: apt.leadId,
                        datetime: apt.datetime,
                        status: apt.status,
                        notes: apt.notes,
                        metadata: {
                            leadName: apt.leadName,
                            leadEmail: apt.leadEmail,
                            leadPhone: apt.leadPhone,
                            robotName: apt.robotName,
                            urlOrigem: apt.urlOrigem,
                            createdAt: apt.createdAt
                        }
                    });
                }
                console.log(`✅ Migração de agendamentos concluída`);
            } else if (dbAppointments.length > 0) {
                // PostgreSQL tem dados, usar como fonte primária
                this.appointments = dbAppointments.map(apt => ({
                    id: apt.id,
                    leadId: apt.lead_id,
                    datetime: apt.datetime,
                    status: apt.status,
                    notes: apt.notes,
                    createdAt: apt.created_at,
                    ...apt.metadata
                }));
                console.log(`🗄️ ${dbAppointments.length} agendamentos carregados do PostgreSQL`);
            }
        } catch (error) {
            console.error('❌ Erro ao inicializar PostgreSQL para agendamentos:', error);
        }
    }

    // Carregamento síncrono de JSON
    loadAppointmentsSync() {
        try {
            if (!this.appointmentsFilePath) {
                this.appointmentsFilePath = getTenantAppointmentsFilePath(this.apiKey);
            }
            if (fs.existsSync(this.appointmentsFilePath)) {
                const data = fs.readFileSync(this.appointmentsFilePath, "utf8");
                return JSON.parse(data);
            }
        } catch (error) {
            console.error("❌ Erro ao carregar agendamentos do JSON:", error);
        }
        return [];
    }

    // Alias para compatibilidade
    loadAppointments() {
        return this.loadAppointmentsSync();
    }

    // Salvar agendamentos em PostgreSQL e JSON
    async saveAppointments() {
        try {
            // Salvar em PostgreSQL se disponível
            if (USE_POSTGRES) {
                for (const apt of (this.appointments || [])) {
                    await DatabaseHelpers.saveAppointment(this.apiKey, {
                        id: apt.id,
                        leadId: apt.leadId,
                        datetime: apt.datetime,
                        status: apt.status,
                        notes: apt.notes,
                        metadata: {
                            leadName: apt.leadName,
                            leadEmail: apt.leadEmail,
                            leadPhone: apt.leadPhone,
                            robotName: apt.robotName,
                            urlOrigem: apt.urlOrigem,
                            createdAt: apt.createdAt
                        }
                    });
                }
                console.log(`🗄️ Agendamentos salvos no PostgreSQL: ${(this.appointments || []).length} registros`);
            }

            // Sempre salvar em JSON como backup
            if (!this.appointmentsFilePath) {
                this.appointmentsFilePath = getTenantAppointmentsFilePath(this.apiKey);
            }
            fs.writeFileSync(this.appointmentsFilePath, JSON.stringify(this.appointments || [], null, 2));
            console.log(`💾 Agendamentos salvos no JSON: ${(this.appointments || []).length} registros`);
            return true;
        } catch (error) {
            console.error("❌ Erro ao salvar agendamentos:", error);
            // Fallback JSON
            try {
                fs.writeFileSync(this.appointmentsFilePath, JSON.stringify(this.appointments || [], null, 2));
                return true;
            } catch (jsonError) {
                console.error("❌ Erro ao salvar agendamentos em JSON:", jsonError);
                return false;
            }
        }
    }

    addAppointment(appointmentData) {
        if (!this.appointments) {
            this.appointments = this.loadAppointments();
        }

        const appointment = {
            id: crypto.randomBytes(8).toString("hex"),
            createdAt: new Date().toISOString(),
            leadId: appointmentData.leadId || null,
            leadName: appointmentData.leadName || 'Não informado',
            leadEmail: appointmentData.leadEmail || 'Não informado',
            leadPhone: appointmentData.leadPhone || '',
            datetime: appointmentData.datetime,
            status: 'pendente', // pendente, confirmado, cancelado, realizado
            notes: appointmentData.notes || '',
            robotName: appointmentData.robotName || 'Assistente IA',
            urlOrigem: appointmentData.urlOrigem || ''
        };

        this.appointments.push(appointment);
        this.saveAppointments();
        console.log(`📅 NOVO AGENDAMENTO: ${appointment.leadName} - ${appointment.datetime}`);
        return appointment;
    }

    getAppointments() {
        if (!this.appointments) {
            this.appointments = this.loadAppointments();
        }
        return (this.appointments || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    getAppointmentById(appointmentId) {
        if (!this.appointments) {
            this.appointments = this.loadAppointments();
        }
        return this.appointments.find(a => a.id === appointmentId);
    }

    updateAppointmentStatus(appointmentId, status) {
        if (!this.appointments) {
            this.appointments = this.loadAppointments();
        }
        const appointment = this.appointments.find(a => a.id === appointmentId);
        if (appointment && ['pendente', 'confirmado', 'cancelado', 'realizado'].includes(status)) {
            appointment.status = status;
            appointment.updatedAt = new Date().toISOString();
            this.saveAppointments();
            console.log(`📅 Agendamento ${appointmentId} atualizado para: ${status}`);
            return appointment;
        }
        return null;
    }

    getAppointmentsByLeadId(leadId) {
        if (!this.appointments) {
            this.appointments = this.loadAppointments();
        }
        return this.appointments.filter(a => a.leadId === leadId);
    }
}

// Funções para obter instâncias de sistema de leads e backup por tenant
function getLeadSystem(apiKey) {
    return new LeadCaptureSystem(apiKey);
}

function getBackupSystem(leadSystem, apiKey) {
    return new LeadBackupSystem(leadSystem, apiKey);
}

// ===== SISTEMA DE BACKUP AUTOMÁTICO DE LEADS =====

function getTenantBackupDirPath(apiKey) {
    const dataDir = path.join(__dirname, "data");
    const tenantDir = path.join(dataDir, "tenants");

    // Garantir que o diretório existe
    if (!fs.existsSync(tenantDir)) {
        fs.mkdirSync(tenantDir, { recursive: true });
    }

    const backupDir = path.join(tenantDir, apiKey, "backups");

    // Garantir que o diretório de backup existe
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    return backupDir;
}

class LeadBackupSystem {
    constructor(leadSystem, apiKey) {
        this.leadSystem = leadSystem;
        this.apiKey = apiKey;
        this.backupDir = getTenantBackupDirPath(this.apiKey);
        this.ensureBackupDirectory();
        this.maxBackups = 7; // Manter últimos 7 dias
        this.backupInterval = 24 * 60 * 60 * 1000; // 24 horas
        console.log(`🔐 Sistema de Backup Inicializado`);
        console.log(`📁 Diretório de backups: ${this.backupDir}`);

        // Fazer backup inicial
        this.createBackup("startup");

        // Agendar backup diário
        this.scheduleAutomaticBackups();
    }

    ensureBackupDirectory() {
        try {
            if (!fs.existsSync(this.backupDir)) {
                fs.mkdirSync(this.backupDir, { recursive: true });
                console.log(`📁 Diretório de backups criado: ${this.backupDir}`);
            }
        } catch (error) {
            console.error("❌ Erro ao criar diretório de backups:", error);
        }
    }

    createBackup(type = "manual") {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const filename = `leads-backup-${type}-${timestamp}.json`;
            const backupPath = path.join(this.backupDir, filename);

            const backupData = {
                timestamp: new Date().toISOString(),
                type: type,
                leadsCount: this.leadSystem.leads.length,
                leads: this.leadSystem.leads
            };

            fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
            console.log(`✅ Backup criado: ${filename} (${this.leadSystem.leads.length} leads)`);

            // Limpar backups antigos
            this.cleanOldBackups();

            return { success: true, filename, path: backupPath };
        } catch (error) {
            console.error("❌ Erro ao criar backup:", error);
            return { success: false, error: error.message };
        }
    }

    cleanOldBackups() {
        try {
            const files = fs.readdirSync(this.backupDir)
                .filter(f => f.startsWith("leads-backup-"))
                .map(f => ({
                    name: f,
                    path: path.join(this.backupDir, f),
                    time: fs.statSync(path.join(this.backupDir, f)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time);

            // Manter apenas os últimos maxBackups
            if (files.length > this.maxBackups) {
                const filesToDelete = files.slice(this.maxBackups);
                filesToDelete.forEach(file => {
                    fs.unlinkSync(file.path);
                    console.log(`🗑️ Backup antigo removido: ${file.name}`);
                });
            }
        } catch (error) {
            console.error("❌ Erro ao limpar backups antigos:", error);
        }
    }

    listBackups() {
        try {
            const files = fs.readdirSync(this.backupDir)
                .filter(f => f.startsWith("leads-backup-"))
                .map(f => {
                    const filePath = path.join(this.backupDir, f);
                    const stats = fs.statSync(filePath);
                    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
                    return {
                        filename: f,
                        timestamp: data.timestamp,
                        type: data.type,
                        leadsCount: data.leadsCount,
                        size: stats.size,
                        created: stats.mtime
                    };
                })
                .sort((a, b) => new Date(b.created) - new Date(a.created));

            return files;
        } catch (error) {
            console.error("❌ Erro ao listar backups:", error);
            return [];
        }
    }

    restoreBackup(filename) {
        try {
            const backupPath = path.join(this.backupDir, filename);

            if (!fs.existsSync(backupPath)) {
                return { success: false, error: "Backup não encontrado" };
            }

            const backupData = JSON.parse(fs.readFileSync(backupPath, "utf8"));

            // Criar backup do estado atual antes de restaurar
            this.createBackup("pre-restore");

            // Restaurar leads
            this.leadSystem.leads = backupData.leads;
            this.leadSystem.saveLeads();

            console.log(`✅ Backup restaurado: ${filename} (${backupData.leadsCount} leads)`);

            return {
                success: true,
                leadsCount: backupData.leadsCount,
                timestamp: backupData.timestamp
            };
        } catch (error) {
            console.error("❌ Erro ao restaurar backup:", error);
            return { success: false, error: error.message };
        }
    }

    scheduleAutomaticBackups() {
        setInterval(() => {
            console.log("⏰ Executando backup automático diário...");
            this.createBackup("daily");
        }, this.backupInterval);

        console.log(`⏰ Backup automático agendado (a cada 24 horas)`);
    }

    setupShutdownHook() {
        const shutdown = () => {
            console.log("🛑 Servidor encerrando - Criando backup final...");
            this.createBackup("shutdown");
            process.exit(0);
        };

        process.on("SIGTERM", shutdown);
        process.on("SIGINT", shutdown);
    }
}

// ===== SISTEMA DE ANÁLISE DE JORNADA DO CLIENTE =====
class JourneyAnalyzer {
    constructor() {
        this.stageKeywords = {
            descoberta: [
                'o que é', 'como funciona', 'funcionamento', 'o que faz', 'para que serve',
                'quem é', 'como é', 'explica', 'entender', 'conhecer', 'informação',
                'detalhes', 'apresentação', 'novo', 'primeira vez', 'iniciante'
            ],
            negociacao: [
                'preço', 'valor', 'quanto custa', 'custo', 'investimento', 'pagamento',
                'forma de pagamento', 'parcelamento', 'desconto', 'promoção', 'oferta',
                'condições', 'comprar', 'adquirir', 'contratar', 'assinar', 'plano',
                'precificação', 'valores', 'cartão', 'boleto', 'pix'
            ],
            fidelizacao: [
                'suporte', 'atendimento', 'dúvida', 'problema', 'ajuda', 'assistência',
                'reclamação', 'sugestão', 'feedback', 'contato', 'telefone', 'email',
                'whatsapp', 'chamado', 'ticket', 'urgente', 'resolver'
            ]
        };

        this.synonyms = {
            empolgação: [
                'excelente', 'fantástico', 'incrível', 'maravilhoso', 'impressionante',
                'notável', 'extraordinário', 'formidável', 'espetacular', 'sensacional',
                'surpreendente', 'fantástico', 'excepcional', 'notável', 'extraordinário'
            ]
        };
    }

    analyzeJourneyStage(message) {
        const messageLower = message.toLowerCase();
        let scores = {
            descoberta: 0,
            negociacao: 0,
            fidelizacao: 0
        };

        // Analisar palavras-chave
        for (const [stage, keywords] of Object.entries(this.stageKeywords)) {
            for (const keyword of keywords) {
                if (messageLower.includes(keyword)) {
                    scores[stage]++;
                }
            }
        }

        // Determinar estágio com maior pontuação
        const maxScore = Math.max(...Object.values(scores));
        if (maxScore === 0) return "descoberta";

        for (const [stage, score] of Object.entries(scores)) {
            if (score === maxScore) {
                return stage;
            }
        }

        return "descoberta";
    }

    getRandomSynonym(category) {
        const synonyms = this.synonyms[category] || ['excelente'];
        return synonyms[Math.floor(Math.random() * synonyms.length)];
    }

    shouldMentionBonus(stage, message) {
        const messageLower = message.toLowerCase();

        // Só mencionar bônus se o cliente perguntar explicitamente
        const bonusKeywords = ['bônus', 'bonus', 'brinde', 'presente', 'extra', 'grátis', 'gratis'];
        const isAskingAboutBonus = bonusKeywords.some(keyword => messageLower.includes(keyword));

        // Ou se estiver na fase de negociação
        return isAskingAboutBonus || stage === "negociacao";
    }
}

// Inicializar analisador de jornada
const journeyAnalyzer = new JourneyAnalyzer();

// ===== SISTEMA DE CAPTURA DE INTENÇÕES DO CLIENTE =====
class SistemaCapturaInteligencias {
    constructor() {
        console.log("🎯 Sistema de Captura de Intenções Inicializado");
    }

    capturarInteligencias(mensagem) {
        const inteligencias = {
            contatoDireto: false,
            linkSite: false,
            bonus: false,
            detalhesBonus: false,
            experiencia: false,
            suporte: false
        };

        const mensagemLower = mensagem.toLowerCase();

        // Detectar solicitação de contato direto
        if (mensagemLower.includes('whatsapp') ||
            mensagemLower.includes('número') ||
            mensagemLower.includes('numero') ||
            mensagemLower.includes('falar direto') ||
            mensagemLower.includes('contato direto') ||
            mensagemLower.includes('telefone') ||
            mensagemLower.includes('celular') ||
            mensagemLower.includes('ligar') ||
            mensagemLower.includes('chamar')) {
            inteligencias.contatoDireto = true;
        }

        // Detectar solicitação de link do site
        if (mensagemLower.includes('link') ||
            mensagemLower.includes('site') ||
            mensagemLower.includes('endereço') ||
            mensagemLower.includes('endereco') ||
            mensagemLower.includes('url') ||
            mensagemLower.includes('página') ||
            mensagemLower.includes('pagina') ||
            mensagemLower.includes('web')) {
            inteligencias.linkSite = true;
        }

        // Detectar perguntas sobre bônus
        if (mensagemLower.includes('bônus') ||
            mensagemLower.includes('bonus') ||
            mensagemLower.includes('vantagem') ||
            mensagemLower.includes('extra') ||
            mensagemLower.includes('brinde') ||
            mensagemLower.includes('presente') ||
            mensagemLower.includes('grátis') ||
            mensagemLower.includes('gratis')) {
            inteligencias.bonus = true;

            if (mensagemLower.includes('quais') ||
                mensagemLower.includes('quais são') ||
                mensagemLower.includes('detalhes') ||
                mensagemLower.includes('lista') ||
                mensagemLower.includes('inclui')) {
                inteligencias.detalhesBonus = true;
            }
        }

        // Detectar perguntas sobre experiência
        if (mensagemLower.includes('experiência') ||
            mensagemLower.includes('experiencia') ||
            mensagemLower.includes('começar') ||
            mensagemLower.includes('iniciante') ||
            mensagemLower.includes('principiante') ||
            mensagemLower.includes('novato') ||
            mensagemLower.includes('início') ||
            mensagemLower.includes('inicio')) {
            inteligencias.experiencia = true;
        }

        // Detectar solicitação de suporte
        if (mensagemLower.includes('suporte') ||
            mensagemLower.includes('atendimento') ||
            mensagemLower.includes('ajuda') ||
            mensagemLower.includes('problema') ||
            mensagemLower.includes('dúvida') ||
            mensagemLower.includes('duvida') ||
            mensagemLower.includes('assistência') ||
            mensagemLower.includes('assistencia')) {
            inteligencias.suporte = true;
        }

        console.log(`🎯 Intenções detectadas:`, inteligencias);
        return inteligencias;
    }

    gerarRespostaContextual(inteligencias, contatos, journeyStage = "descoberta") {
        let resposta = '';
        const excitementWord = journeyAnalyzer.getRandomSynonym('empolgação');

        // 🎯 Resposta baseada nas intenções detectadas
        if (inteligencias.contatoDireto) {
            if (contatos.whatsapp && contatos.whatsapp.length > 0) {
                resposta += `📞 **${excitementWord.toUpperCase()}!** Você pode falar diretamente conosco:\n\n`;
                resposta += `💬 **WhatsApp:** ${contatos.whatsapp.slice(0, 2).join(' ou ')}\n`;

                if (contatos.telefone && contatos.telefone.length > 0) {
                    resposta += `📞 **Telefone:** ${contatos.telefone.slice(0, 2).join(' ou ')}\n`;
                }
                resposta += `\nEstamos disponíveis para tirar todas suas dúvidas!\n\n`;
            } else if (contatos.telefone && contatos.telefone.length > 0) {
                resposta += `📞 **${excitementWord.toUpperCase()}!** Nosso telefone para contato: ${contatos.telefone.slice(0, 2).join(' ou ')}\n\n`;
            }
        }

        if (inteligencias.linkSite) {
            if (contatos.site && contatos.site.length > 0) {
                resposta += `🌐 **Site oficial:** ${contatos.site[0]}\n\n`;
            }
        }

        if (inteligencias.detalhesBonus) {
            resposta += `🎁 **BÔNUS EXCLUSIVOS INCLUÍDOS:**\n\n`;
            resposta += `• 🚀 Automatização completa do atendimento\n`;
            resposta += `• 📝 Templates de mensagens profissionais\n`;
            resposta += `• 🛠️ Suporte técnico especializado\n`;
            resposta += `• 🔄 Atualizações gratuitas por 1 ano\n`;
            resposta += `• 📚 Materiais complementares exclusivos\n\n`;
            resposta += `Tudo isso para você ter os melhores resultados! 🎯\n\n`;
        } else if (inteligencias.bonus) {
            resposta += `🎁 **SIM!** Temos bônus incríveis incluídos. `;
            resposta += `Gostaria que eu detalhe cada um dos bônus disponíveis?\n\n`;
        }

        if (inteligencias.experiencia) {
            resposta += `🌟 **PERFEITO PARA INICIANTES!**\n\n`;
            resposta += `Não é necessário nenhuma experiência prévia! `;
            resposta += `Nossa plataforma foi desenvolvida para ser intuitiva e fácil de usar, `;
            resposta += `com tutoriais passo a passo e suporte completo.\n\n`;
        }

        if (inteligencias.suporte) {
            resposta += `🛟 **SUPORTE ESPECIALIZADO**\n\n`;
            resposta += `Nossa equipe de suporte está pronta para ajudar você! `;

            if (contatos.email && contatos.email.length > 0) {
                resposta += `\n📧 **Email:** ${contatos.email.slice(0, 2).join(' ou ')}`;
            }

            if (contatos.whatsapp && contatos.whatsapp.length > 0) {
                resposta += `\n💬 **WhatsApp:** ${contatos.whatsapp.slice(0, 2).join(' ou ')}`;
            }

            resposta += `\n\nRespondemos rapidamente para resolver qualquer dúvida ou problema!\n\n`;
        }

        // Se nenhuma intenção específica foi detectada, usar resposta padrão baseada na jornada
        if (!resposta) {
            switch (journeyStage) {
                case "negociacao":
                    resposta = "💰 Interessado em conhecer nossos valores e condições de pagamento? Posso ajudar com todas as informações!";
                    break;
                case "fidelizacao":
                    resposta = "🛟 Precisa de suporte ou tem alguma dúvida específica? Estou aqui para ajudar!";
                    break;
                default:
                    resposta = "🎯 Obrigado pelo seu interesse! Como posso ajudar você hoje?";
            }
        }

        return resposta || "🎯 Obrigado pelo seu interesse! Como posso ajudar você hoje?";
    }
}

// Inicializar sistema de captura de intenções
const sistemaInteligencias = new SistemaCapturaInteligencias();

// ===== SISTEMA APRIMORADO DE EXTRAÇÃO DE CONTATOS =====
class SistemaExtracaoContatosAprimorado {
    constructor() {
        console.log("📞 Sistema Aprimorado de Extração de Contatos Inicializado");
    }

    extrairContatosAprimorado($) {
        const contatos = {
            telefone: [],
            whatsapp: [],
            email: [],
            site: [],
            endereco: []
        };

        try {
            // Obter todo o texto da página
            const textoPagina = $('body').text();

            // 🎯 PADRÕES BRASILEIROS OTIMIZADOS PARA TELEFONES
            const padroesTelefone = [
                /(\+55\s?)?(\(?\d{2}\)?\s?)?\d{4,5}[-.\s]?\d{4}/g,
                /(\+55\s?)?(\(?\d{2}\)?\s?)?\d{5}[-.\s]?\d{4}/g,
                /(\(\d{2}\)\s?\d{4,5}-\d{4})/g,
                /(\d{2})\s?\d{4,5}-\d{4}/g
            ];

            // 🎯 DETECÇÃO INTELIGENTE DE WHATSAPP vs TELEFONE COMUM
            const whatsappKeywords = ['whatsapp', 'wa.me', 'wa.me', 'whats-app', 'whatsapp', 'zap', 'direct whatsapp'];

            // Procurar números na página
            padroesTelefone.forEach(padrao => {
                const matches = textoPagina.match(padrao);
                if (matches) {
                    matches.forEach(match => {
                        const numeroLimpo = match.replace(/\D/g, '');

                        // Validar se é um número brasileiro válido
                        if (numeroLimpo.length >= 10 && numeroLimpo.length <= 13) {
                            const contexto = textoPagina.substring(
                                Math.max(0, textoPagina.indexOf(match) - 50),
                                Math.min(textoPagina.length, textoPagina.indexOf(match) + 50)
                            ).toLowerCase();

                            const isWhatsApp = whatsappKeywords.some(keyword =>
                                contexto.includes(keyword)
                            );

                            const numeroFormatado = this.formatarNumeroBrasileiro(numeroLimpo);

                            if (isWhatsApp) {
                                if (!contatos.whatsapp.includes(numeroFormatado)) {
                                    contatos.whatsapp.push(numeroFormatado);
                                    console.log(`📞 WhatsApp detectado: ${numeroFormatado}`);
                                }
                            } else {
                                if (!contatos.telefone.includes(numeroFormatado)) {
                                    contatos.telefone.push(numeroFormatado);
                                    console.log(`📞 Telefone detectado: ${numeroFormatado}`);
                                }
                            }
                        }
                    });
                }
            });

            // 🎯 EXTRAÇÃO DE EMAILS DE MÚLTIPLAS FONTES
            const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
            const emails = textoPagina.match(emailRegex);
            if (emails) {
                contatos.email = [...new Set(emails)]; // Remove duplicatas
                console.log(`📧 Emails detectados: ${contatos.email.length}`);
            }

            // 🎯 EXTRAÇÃO DE SITES
            const siteRegex = /(https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|(www\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
            const sites = textoPagina.match(siteRegex);
            if (sites) {
                contatos.site = [...new Set(sites.slice(0, 3))]; // Limita a 3 sites únicos
                console.log(`🌐 Sites detectados: ${contatos.site.length}`);
            }

            // 🎯 BUSCA EM ELEMENTOS ESPECÍFICOS PARA CONTATOS
            const seletoresContato = [
                '[class*="contact"]',
                '[class*="contato"]',
                '[class*="phone"]',
                '[class*="telefone"]',
                '[class*="email"]',
                '[class*="whatsapp"]',
                '[class*="endereço"]',
                '[class*="endereco"]',
                '.footer',
                'footer',
                '.contato',
                '.contact',
                '.telefone',
                '.email'
            ];

            seletoresContato.forEach(seletor => {
                $(seletor).each((i, elem) => {
                    const texto = $(elem).text();
                    this.processarTextoContato(texto, contatos);
                });
            });

            // 🎯 BUSCA EM LINKS
            $('a[href]').each((i, elem) => {
                const href = $(elem).attr('href') || '';
                const texto = $(elem).text();

                // Detectar links de WhatsApp
                if (href.includes('wa.me') || href.includes('whatsapp') || href.includes('api.whatsapp')) {
                    const numeroMatch = href.match(/\d{10,13}/);
                    if (numeroMatch) {
                        const numeroFormatado = this.formatarNumeroBrasileiro(numeroMatch[0]);
                        if (!contatos.whatsapp.includes(numeroFormatado)) {
                            contatos.whatsapp.push(numeroFormatado);
                        }
                    }
                }

                // Detectar links de telefone
                if (href.startsWith('tel:')) {
                    const numero = href.replace('tel:', '').replace(/\D/g, '');
                    if (numero.length >= 10) {
                        const numeroFormatado = this.formatarNumeroBrasileiro(numero);
                        if (!contatos.telefone.includes(numeroFormatado)) {
                            contatos.telefone.push(numeroFormatado);
                        }
                    }
                }

                // Detectar links de email
                if (href.startsWith('mailto:')) {
                    const email = href.replace('mailto:', '');
                    if (email && !contatos.email.includes(email)) {
                        contatos.email.push(email);
                    }
                }
            });

            console.log(`📊 Resumo de contatos extraídos:`, {
                telefones: contatos.telefone.length,
                whatsapp: contatos.whatsapp.length,
                emails: contatos.email.length,
                sites: contatos.site.length
            });

        } catch (error) {
            console.error('❌ Erro na extração aprimorada de contatos:', error);
        }

        return contatos;
    }

    processarTextoContato(texto, contatos) {
        if (!texto) return;

        // Telefones
        const telefoneRegex = /(\+55\s?)?(\(?\d{2}\)?\s?)?\d{4,5}[-.\s]?\d{4}/g;
        const telefones = texto.match(telefoneRegex);
        if (telefones) {
            telefones.forEach(tel => {
                const numeroLimpo = tel.replace(/\D/g, '');
                if (numeroLimpo.length >= 10) {
                    const numeroFormatado = this.formatarNumeroBrasileiro(numeroLimpo);

                    // Detectar WhatsApp pelo contexto
                    if (texto.toLowerCase().includes('whatsapp') && !contatos.whatsapp.includes(numeroFormatado)) {
                        contatos.whatsapp.push(numeroFormatado);
                    } else if (!contatos.telefone.includes(numeroFormatado)) {
                        contatos.telefone.push(numeroFormatado);
                    }
                }
            });
        }

        // Emails
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const emails = texto.match(emailRegex);
        if (emails) {
            emails.forEach(email => {
                if (!contatos.email.includes(email)) {
                    contatos.email.push(email);
                }
            });
        }
    }

    formatarNumeroBrasileiro(numero) {
        // Remove tudo que não é dígito
        const apenasDigitos = numero.replace(/\D/g, '');

        // Se começar com 55 (código do Brasil), mantém
        if (apenasDigitos.startsWith('55')) {
            if (apenasDigitos.length === 13) { // +55 11 99999-9999
                return `+${apenasDigitos}`;
            } else if (apenasDigitos.length === 12) { // 55 11 99999-9999
                return `+${apenasDigitos}`;
            } else if (apenasDigitos.length === 11) { // 11 99999-9999
                return `+55${apenasDigitos}`;
            }
        }

        // Para números sem código do país
        if (apenasDigitos.length === 11) { // 11 99999-9999
            return `+55${apenasDigitos}`;
        } else if (apenasDigitos.length === 10) { // 11 9999-9999
            return `+55${apenasDigitos}`;
        }

        // Retorna o número original se não conseguir formatar
        return numero;
    }
}

// Inicializar sistema aprimorado de extração de contatos
const sistemaContatosAprimorado = new SistemaExtracaoContatosAprimorado();

// ===== SISTEMA DE SUPERINTELIGÊNCIA EMOCIONAL =====
class SuperInteligenciaEmocional {
    constructor() {
        console.log("🧠 Sistema de SuperInteligência Emocional Inicializado");

        // Mapeamento de emoções e sentimentos
        this.emociones = {
            positivas: [
                'feliz', 'alegre', 'contente', 'satisfeito', 'entusiasmado', 'animado',
                'gratidão', 'grato', 'obrigado', 'agradecido', 'satisfeito', 'perfeito',
                'excelente', 'ótimo', 'maravilhoso', 'incrível', 'fantástico', 'show'
            ],
            negativas: [
                'triste', 'chateado', 'frustrado', 'irritado', 'nervoso', 'ansioso',
                'preocupado', 'desapontado', 'decepcionado', 'bravo', 'raiva', 'ódio',
                'péssimo', 'horrível', 'terrível', 'lento', 'difícil', 'complicado'
            ],
            urgentes: [
                'urgente', 'urgência', 'imediatamente', 'agora', 'rápido', 'pressa',
                'importante', 'crucial', 'emergência', 'prioridade', 'hoje', 'já'
            ],
            duvidas: [
                'dúvida', 'duvida', 'pergunta', 'perguntar', 'como funciona', 'o que é',
                'explicar', 'entender', 'compreender', 'não sei', 'não entendi'
            ]
        };

        // Personalidades adaptativas
        this.personalidades = {
            consultivo: {
                tom: "profissional e acolhedor",
                empatia: "moderada",
                estilo: "focado em soluções",
                saudacao: "Como posso ajudá-lo hoje?",
                despedida: "Estou aqui para o que precisar!"
            },
            empatico: {
                tom: "acolhedor e compreensivo",
                empatia: "alta",
                estilo: "focado em emocional",
                saudacao: "Oi! Como você está?",
                despedida: "Fico feliz em poder ajudar!"
            },
            tecnico: {
                tom: "detalhista e preciso",
                empatia: "baixa",
                estilo: "focado em informações",
                saudacao: "Vamos analisar sua situação",
                despedida: "Precisa de mais detalhes?"
            },
            motivacional: {
                tom: "entusiasmado e energético",
                empatia: "alta",
                estilo: "focado em resultados",
                saudacao: "Vamos juntos nessa!",
                despedida: "Você consegue! 💪"
            }
        };

        // Sistema de agendamento
        this.horariosDisponiveis = [
            "Segunda 09:00", "Segunda 14:00", "Segunda 16:00",
            "Terça 10:00", "Terça 15:00", "Terça 17:00",
            "Quarta 09:30", "Quarta 14:30", "Quarta 16:30",
            "Quinta 11:00", "Quinta 15:30", "Quinta 17:30",
            "Sexta 10:30", "Sexta 14:00", "Sexta 16:00"
        ];
    }

    analisarEmocao(mensagem) {
        // ===== V8.0: ENHANCED SENTIMENT COM FEATURE FLAG =====
        if (featureFlags && featureFlags.isEnabled('FEATURE_ENHANCED_SENTIMENT')) {
            try {
                if (enhancedSentiment && enhancedSentiment.enabled) {
                    const enhanced = enhancedSentiment.analyze(mensagem);
                    // Usar resultado aprimorado se confiança > 0.5
                    if (enhanced.confianca > 0.5) {
                        console.log(`🎭 [V8.0] Análise Emocional Aprimorada: ${enhanced.emocao} (confiança: ${enhanced.confianca}) ${enhanced.urgencia ? '🚨 URGENTE' : ''}`);
                        return {
                            emocao: enhanced.emocao,
                            intensidade: enhanced.intensidade,
                            urgencia: enhanced.urgencia,
                            // Dados extras do V8.0
                            intencoes: enhanced.intencoes,
                            scores: enhanced.scores,
                            confianca: enhanced.confianca,
                            v8Enhanced: true
                        };
                    }
                    // Se confiança baixa, continua para análise básica
                    console.log(`🎭 [V8.0] Confiança baixa (${enhanced.confianca}), usando análise básica`);
                }
            } catch (err) {
                console.warn('⚠️ [V8.0] Erro no enhanced sentiment, usando fallback:', err.message);
            }
        }

        // ===== FALLBACK: ANÁLISE V7.0 ORIGINAL =====
        const mensagemLower = mensagem.toLowerCase();
        let emocao = "neutro";
        let intensidade = 1;
        let urgencia = false;

        // Análise de emoções positivas
        const positivas = this.emociones.positivas.filter(palavra =>
            mensagemLower.includes(palavra)
        ).length;

        // Análise de emoções negativas  
        const negativas = this.emociones.negativas.filter(palavra =>
            mensagemLower.includes(palavra)
        ).length;

        // Detecção de urgência
        urgencia = this.emociones.urgentes.some(palavra =>
            mensagemLower.includes(palavra)
        );

        // Determinar emoção predominante
        if (positivas > negativas && positivas > 0) {
            emocao = "positivo";
            intensidade = Math.min(3, positivas);
        } else if (negativas > positivas && negativas > 0) {
            emocao = "negativo";
            intensidade = Math.min(3, negativas);
        }

        // Ajustar intensidade baseado em urgência
        if (urgencia) {
            intensidade += 1;
        }

        console.log(`🎭 Análise Emocional: ${emocao} (intensidade: ${intensidade}) ${urgencia ? '🚨 URGENTE' : ''}`);

        return { emocao, intensidade, urgencia };
    }

    selecionarPersonalidade(emocao, intensidade, jornada) {
        let personalidade = "consultivo";

        if (emocao === "negativo" && intensidade >= 2) {
            personalidade = "empatico";
        } else if (jornada === "negociacao" && emocao === "positivo") {
            personalidade = "motivacional";
        } else if (jornada === "descoberta" && emocao === "neutro") {
            personalidade = "tecnico";
        } else if (emocao === "positivo" && intensidade >= 2) {
            personalidade = "motivacional";
        }

        console.log(`🎨 Personalidade selecionada: ${personalidade}`);
        return this.personalidades[personalidade];
    }

    gerarRespostaEmpatica(mensagem, emocao, personalidade, contatos) {
        let respostaBase = "";
        const excitementWord = journeyAnalyzer.getRandomSynonym('empolgação');

        // Respostas baseadas na emoção detectada
        switch (emocao.emocao) {
            case "positivo":
                if (emocao.intensidade >= 2) {
                    respostaBase = `🎉 **Que ${excitementWord} ver seu entusiasmo!** `;
                } else {
                    respostaBase = `😊 **Fico feliz em saber!** `;
                }
                break;
            case "negativo":
                if (emocao.intensidade >= 2) {
                    respostaBase = `🤗 **Entendo sua frustração e estou aqui para ajudar.** `;
                } else {
                    respostaBase = `👂 **Compreendo sua preocupação.** `;
                }
                break;
            default:
                respostaBase = `💭 **Ótima pergunta!** `;
        }

        // Adicionar urgencia se detectada
        if (emocao.urgencia) {
            respostaBase = `🚨 **Prioridade máxima!** ` + respostaBase;
        }

        // Adaptar tom baseado na personalidade
        switch (personalidade.tom) {
            case "acolhedor e compreensivo":
                respostaBase += "Vamos resolver isso juntos, passo a passo. ";
                break;
            case "entusiasmado e energético":
                respostaBase += "Você está no caminho certo! ";
                break;
            case "detalhista e preciso":
                respostaBase += "Deixe-me explicar detalhadamente. ";
                break;
            default:
                respostaBase += "Aqui estão as informações que você precisa: ";
        }

        return respostaBase;
    }

    // ===== SISTEMA DE AGENDAMENTO INTELIGENTE =====
    // SAFE PATCH - KB-SCHED-001: Refinado para evitar falsos positivos
    // Antes: palavras soltas como 'whatsapp', 'telefone', 'falar' disparavam agendamento
    // Agora: exige frases explícitas de intenção de agendamento
    detectarAgendamento(mensagem) {
        const mensagemLower = mensagem.toLowerCase();

        // Frases explícitas de intenção de agendamento (exigem contexto claro)
        const frasesAgendamento = [
            'quero agendar', 'quero marcar', 'gostaria de agendar', 'gostaria de marcar',
            'agendar reunião', 'agendar reuniao', 'marcar reunião', 'marcar reuniao',
            'agendar consulta', 'marcar consulta', 'agendar horário', 'agendar horario',
            'marcar horário', 'marcar horario', 'agendar uma', 'marcar uma',
            'posso agendar', 'como agendar', 'como marcar', 'agendar call',
            'marcar call', 'agendar video', 'agendar vídeo',
            'escolher horário', 'escolher horario', 'ver horários', 'ver horarios',
            'disponibilidade de horário', 'disponibilidade de horario'
        ];

        const isAgendamento = frasesAgendamento.some(frase =>
            mensagemLower.includes(frase)
        );

        if (isAgendamento) {
            console.log("📅 [KB-SCHED-001] Solicitação EXPLÍCITA de agendamento detectada");
            return this.gerarOpcoesAgendamento();
        }

        return null;
    }

    gerarOpcoesAgendamento() {
        // SAFE PATCH - SCHED-009: Marcador para calendário visual no chat
        let resposta = `**📅 AGENDAMENTO DISPONÍVEL**\n\n`;
        resposta += `Escolha um dia e horário no calendário abaixo:\n\n`;
        resposta += `[CALENDAR_WIDGET]`;
        return resposta;
    }

    // SAFE PATCH - KB-SCHED-002: Corrigido para não interpretar qualquer número como horário
    // Antes: "R$ 30" → contém "3" → match no horário i=2 → agendamento falso
    // Agora: exige que a mensagem seja EXATAMENTE um número (seleção de menu) ou contenha nome completo do horário
    processarAgendamento(mensagem) {
        const mensagemLower = mensagem.toLowerCase().trim();

        // Detectar seleção de horário
        for (let i = 0; i < this.horariosDisponiveis.length; i++) {
            const numero = (i + 1).toString();
            const horarioTexto = this.horariosDisponiveis[i].toLowerCase();

            // Match por número: a mensagem INTEIRA deve ser apenas o número (ex: "3" e nada mais)
            const isExactNumber = mensagemLower === numero;

            // Match por texto: a mensagem deve conter o horário COMPLETO (ex: "segunda 14:00")
            const isExactSchedule = mensagemLower.includes(horarioTexto);

            if (isExactNumber || isExactSchedule) {
                const horarioSelecionado = this.horariosDisponiveis[i];
                const mensagemConfirmacao = `✅ **AGENDAMENTO CONFIRMADO!**\n\n` +
                    `📅 **Horário:** ${horarioSelecionado}\n` +
                    `🎯 **Próximo passo:** Nossa equipe entrará em contato para confirmar.\n` +
                    `📞 **Contato direto:** Veja nossos canais acima! ⬆️`;

                console.log(`📅 [KB-SCHED-002] Agendamento confirmado: ${horarioSelecionado} (match: ${isExactNumber ? 'número exato' : 'texto do horário'})`);

                // Retornar objeto estruturado para persistência
                return {
                    confirmed: true,
                    datetime: horarioSelecionado,
                    message: mensagemConfirmacao
                };
            }
        }

        return null;
    }
}

// Inicializar SuperInteligência
const superInteligencia = new SuperInteligenciaEmocional();

// ===== SISTEMA DE BOTÕES FIXOS NO TOPO =====
function gerarBotoesFixos(contatos, robotName) {
    let botoesHTML = `
    <div class="lm-botoes-fixos" style="
        position: sticky; 
        top: 0; 
        background: white; 
        padding: 15px; 
        border-bottom: 2px solid #3b82f6;
        z-index: 1000;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: center;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    ">
        <div style="font-weight: bold; color: #1e40af; width: 100%; text-align: center; margin-bottom: 10px;">
            📞 Fale com ${robotName}
        </div>
    `;

    // Botão de WhatsApp
    if (contatos.whatsapp && contatos.whatsapp.length > 0) {
        const whatsappNum = contatos.whatsapp[0].replace(/\D/g, '');
        botoesHTML += `
        <a href="https://wa.me/${whatsappNum}" target="_blank" style="
            background: #25D366; 
            color: white; 
            padding: 12px 20px; 
            border-radius: 25px; 
            text-decoration: none; 
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s;
            box-shadow: 0 2px 8px rgba(37, 211, 102, 0.3);
        " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(37, 211, 102, 0.4)';" 
           onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 2px 8px rgba(37, 211, 102, 0.3)';">
            <i class="fab fa-whatsapp"></i> WhatsApp
        </a>`;
    }

    // Botão de Telefone
    if (contatos.telefone && contatos.telefone.length > 0) {
        const telefoneNum = contatos.telefone[0].replace(/\D/g, '');
        botoesHTML += `
        <a href="tel:${telefoneNum}" style="
            background: #3b82f6; 
            color: white; 
            padding: 12px 20px; 
            border-radius: 25px; 
            text-decoration: none; 
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s;
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
        " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(59, 130, 246, 0.4)';" 
           onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 2px 8px rgba(59, 130, 246, 0.3)';">
            <i class="fas fa-phone"></i> Ligar
        </a>`;
    }

    // Botão de Agendamento
    botoesHTML += `
    <button onclick="iniciarAgendamento()" style="
        background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%); 
        color: white; 
        padding: 12px 20px; 
        border-radius: 25px; 
        border: none;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        transition: all 0.3s;
        box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
    " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(139, 92, 246, 0.4)';" 
       onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 2px 8px rgba(139, 92, 246, 0.3)';">
        <i class="fas fa-calendar-check"></i> Agendar
    </button>`;

    // Botão de Site
    if (contatos.site && contatos.site.length > 0) {
        botoesHTML += `
        <a href="${contatos.site[0]}" target="_blank" style="
            background: #10B981; 
            color: white; 
            padding: 12px 20px; 
            border-radius: 25px; 
            text-decoration: none; 
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s;
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
        " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.4)';" 
           onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 2px 8px rgba(16, 185, 129, 0.3)';">
            <i class="fas fa-globe"></i> Site
        </a>`;
    }

    botoesHTML += `</div>`;

    return botoesHTML;
}

// ===== Enhanced Logger =====
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// ===== SISTEMA APRIMORADO DE DETECÇÃO DE BÔNUS =====
class SistemaExtracaoApurado {
    constructor() {
        this.termosBonus = [
            'bônus', 'bonus', 'brinde', 'presente', 'extra', 'grátis', 'gratis',
            'incluído', 'incluido', 'adicional', 'oferta', 'promocional',
            'regalo', 'complemento', 'vantagem', 'benefício', 'beneficio',
            'exclusivo', 'limitado', 'especial', 'oferta especial'
        ];
    }

    async extrairDadosCompletos(url) {
        try {
            console.log('🌐 [EXTRACAO APRIMORADA] Conectando à:', url);
            const { data } = await axios.get(url, {
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            const $ = cheerio.load(data);
            const dadosExtraidos = {
                titulo: this.limparTexto($('title').text()),
                descricao: this.limparTexto($('meta[name="description"]').attr('content')),
                textos: this.extrairTextosRelevantes($),
                bonus: this.buscarInformacoesBonus($),
                preco: this.extrairPrecos($),
                garantia: this.extrairGarantia($),
                secoesEspeciais: this.extrairSecoesEspeciais($),
                metadados: this.extrairMetadados($),
                // 🎯 MELHORIA: Usar sistema aprimorado de extração de contatos
                contatos: sistemaContatosAprimorado.extrairContatosAprimorado($)
            };

            console.log(`✅ [EXTRACAO] Concluída: ${dadosExtraidos.bonus.length} bônus encontrados`);
            return dadosExtraidos;
        } catch (error) {
            console.error('❌ [EXTRACAO] Erro:', error.message);
            return { erro: 'Falha na extração: ' + error.message };
        }
    }

    // 🎯 FUNÇÃO MANTIDA PARA COMPATIBILIDADE
    extrairContatos($) {
        return sistemaContatosAprimorado.extrairContatosAprimorado($);
    }

    extrairTextosRelevantes($) {
        const textos = [];
        const seletores = [
            'h1, h2, h3, h4',
            '.card, .benefit, .feature',
            '[class*="bonus"], [class*="bônus"]',
            '[class*="offer"], [class*="oferta"]',
            '.pricing, .price, .valor',
            '.guarantee, .garantia',
            'section, .section, .container',
            'p, span, div'
        ].join(', ');

        $(seletores).each((i, elem) => {
            const texto = this.limparTexto($(elem).text());
            if (texto && texto.length > 5 && texto.length < 500) {
                textos.push(texto);
            }
        });

        return [...new Set(textos)];
    }

    buscarInformacoesBonus($) {
        const bonusEncontrados = [];
        const elementosAlvo = [
            '[class*="bonus"]', '[class*="bônus"]', '[class*="gift"]',
            '[class*="presente"]', '[class*="extra"]', '.offer, .oferta',
            '.special, .especial', '.bonus-item', '.bonus-section'
        ];

        elementosAlvo.forEach(seletor => {
            $(seletor).each((i, elem) => {
                const texto = this.limparTexto($(elem).text());
                if (texto && this.contemTermoBonus(texto)) {
                    bonusEncontrados.push({
                        elemento: seletor,
                        conteudo: texto,
                        contexto: this.obterContexto($, elem),
                        tipo: 'busca_especifica'
                    });
                }
            });
        });

        // Busca geral como fallback
        $('body *').each((i, elem) => {
            const texto = this.limparTexto($(elem).text());
            if (texto && this.contemTermoBonus(texto) && texto.length < 500) {
                const jaExiste = bonusEncontrados.some(b => b.conteudo === texto);
                if (!jaExiste) {
                    bonusEncontrados.push({
                        elemento: elem.name || 'elemento',
                        conteudo: texto,
                        contexto: { tipo: 'busca_geral' },
                        tipo: 'busca_geral'
                    });
                }
            }
        });

        return bonusEncontrados;
    }

    contemTermoBonus(texto) {
        if (!texto) return false;
        const textoLower = texto.toLowerCase();
        return this.termosBonus.some(termo => textoLower.includes(termo));
    }

    obterContexto($, elemento) {
        const $elemento = $(elemento);
        const pai = $elemento.parent();
        return {
            elementoPai: pai.prop('tagName') || 'div',
            classePai: pai.attr('class') || '',
            irmaos: pai.children().length
        };
    }

    extrairPrecos($) {
        const precos = [];
        const seletoresPreco = [
            '[class*="price"]', '[class*="preco"]', '[class*="valor"]',
            '.pricing, .cost, .money', '.currency'
        ];

        seletoresPreco.forEach(seletor => {
            $(seletor).each((i, elem) => {
                const texto = this.limparTexto($(elem).text());
                if (texto && /R\$\s?\d+[.,]\d+|\d+[.,]\d+\s?reais/i.test(texto)) {
                    precos.push(texto);
                }
            });
        });

        return precos;
    }

    extrairGarantia($) {
        const garantias = [];
        const seletoresGarantia = [
            '[class*="garantia"]', '[class*="guarantee"]', '[class*="warranty"]',
            '.safe, .security, .refund'
        ];

        seletoresGarantia.forEach(seletor => {
            $(seletor).each((i, elem) => {
                const texto = this.limparTexto($(elem).text());
                if (texto && /garantia|devolução|reembolso|segurança/i.test(texto)) {
                    garantias.push(texto);
                }
            });
        });

        return garantias;
    }

    extrairSecoesEspeciais($) {
        const secoes = [];
        const secoesAlvo = [
            'section', 'div[class*="section"]', 'div[class*="container"]',
            '.offer-section', '.bonus-area', '.special-offer'
        ];

        secoesAlvo.forEach(seletor => {
            $(seletor).each((i, elem) => {
                const $elem = $(elem);
                const texto = this.limparTexto($elem.text());

                if (texto.length > 50 && texto.length < 1000) {
                    const termosRelevantes = this.termosBonus.concat([
                        'oferta', 'promoção', 'limitado', 'exclusivo', 'especial'
                    ]);

                    const ehRelevante = termosRelevantes.some(termo =>
                        texto.toLowerCase().includes(termo)
                    );

                    if (ehRelevante) {
                        secoes.push({
                            tipo: seletor,
                            conteudo: texto.substring(0, 300),
                            tamanho: texto.length
                        });
                    }
                }
            });
        });

        return secoes;
    }

    extrairMetadados($) {
        return {
            ogTitle: this.limparTexto($('meta[property="og:title"]').attr('content')),
            ogDescription: this.limparTexto($('meta[property="og:description"]').attr('content')),
            keywords: this.limparTexto($('meta[name="keywords"]').attr('content')),
            canonical: this.limparTexto($('link[rel="canonical"]').attr('href'))
        };
    }

    limparTexto(texto) {
        if (!texto) return '';
        return texto
            .replace(/\s+/g, ' ')
            .replace(/\n/g, ' ')
            .trim();
    }
}

class ValidacaoCruzada {
    constructor() {
        this.termosBonus = [
            'bônus', 'bonus', 'brinde', 'presente', 'extra', 'grátis', 'gratis',
            'incluído', 'incluido', 'adicional', 'oferta', 'promocional'
        ];
    }

    validarDadosCompletos(dadosExtraidos) {
        console.log('🔍 [VALIDAÇÃO] Iniciando validação cruzada...');

        const validacoes = {
            bonus: this.validarBonusCruzado(dadosExtraidos),
            preco: this.validarPrecos(dadosExtraidos),
            garantia: this.validarGarantia(dadosExtraidos),
            consistencia: this.validarConsistencia(dadosExtraidos)
        };

        const dadosValidados = this.aplicarCorrecoes(dadosExtraidos, validacoes);
        const pontuacaoConfianca = this.calcularPontuacaoConfianca(validacoes);

        console.log(`✅ [VALIDAÇÃO] Concluída: ${pontuacaoConfianca * 100}% de confiança`);

        return {
            dadosValidados,
            pontuacaoConfianca,
            problemasCriticos: this.identificarProblemasCriticos(validacoes)
        };
    }

    validarBonusCruzado(dados) {
        const fontes = {
            bonusDireto: dados.bonus || [],
            secoesEspeciais: this.buscarBonusEmSecoes(dados.secoesEspeciais || []),
            textosRelevantes: this.buscarBonusEmTextos(dados.textos || [])
        };

        const todosBonus = [
            ...fontes.bonusDireto,
            ...fontes.secoesEspeciais,
            ...fontes.textosRelevantes
        ];

        const bonusUnicos = this.removerDuplicatas(todosBonus);

        return {
            fontes,
            bonusUnificados: bonusUnicos,
            totalEncontrado: bonusUnicos.length,
            confiabilidade: this.calcularConfiabilidadeBonus(fontes, bonusUnicos)
        };
    }

    buscarBonusEmSecoes(secoes) {
        const bonusEncontrados = [];

        secoes.forEach(secao => {
            const texto = secao.conteudo.toLowerCase();
            const termosEncontrados = this.termosBonus.filter(termo =>
                texto.includes(termo)
            );

            if (termosEncontrados.length > 0) {
                bonusEncontrados.push({
                    elemento: `secao_${secao.tipo}`,
                    conteudo: secao.conteudo.substring(0, 200),
                    contexto: { tipo: 'secao_especial', termos: termosEncontrados }
                });
            }
        });

        return bonusEncontrados;
    }

    buscarBonusEmTextos(textos) {
        const bonusEncontrados = [];

        textos.forEach(texto => {
            if (this.contemTermoBonus(texto)) {
                bonusEncontrados.push({
                    elemento: 'texto_geral',
                    conteudo: texto,
                    contexto: { tipo: 'texto_relevante' }
                });
            }
        });

        return bonusEncontrados;
    }

    contemTermoBonus(texto) {
        if (!texto) return false;
        return this.termosBonus.some(termo =>
            texto.toLowerCase().includes(termo.toLowerCase())
        );
    }

    removerDuplicatas(bonusArray) {
        const seen = new Set();
        return bonusArray.filter(item => {
            const key = item.conteudo.toLowerCase().trim();
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    validarPrecos(dados) {
        const precosEncontrados = [...(dados.preco || [])];
        return {
            precos: precosEncontrados,
            total: precosEncontrados.length
        };
    }

    validarGarantia(dados) {
        const garantias = [...(dados.garantia || [])];
        return {
            garantias: garantias,
            total: garantias.length
        };
    }

    validarConsistencia(dados) {
        const inconsistencias = [];

        if (dados.bonus && dados.bonus.length > 0 &&
            (!dados.preco || dados.preco.length === 0)) {
            inconsistencias.push('Bônus encontrados mas preços não identificados');
        }

        return {
            consistente: inconsistencias.length === 0,
            inconsistencias,
            score: Math.max(0, 10 - inconsistencias.length) / 10
        };
    }

    calcularConfiabilidadeBonus(fontes, bonusUnicos) {
        const pesos = {
            bonusDireto: 1.0,
            secoesEspeciais: 0.8,
            textosRelevantes: 0.6
        };

        let score = 0;
        let totalPeso = 0;

        Object.keys(fontes).forEach(fonte => {
            if (fontes[fonte].length > 0) {
                score += pesos[fonte] * fontes[fonte].length;
                totalPeso += pesos[fonte];
            }
        });

        return totalPeso > 0 ? (score / totalPeso) / Math.max(1, bonusUnicos.length) : 0;
    }

    calcularPontuacaoConfianca(validacoes) {
        const pesos = {
            bonus: 0.4,
            preco: 0.2,
            garantia: 0.2,
            consistencia: 0.2
        };

        let pontuacao = 0;
        pontuacao += validacoes.bonus.confiabilidade * pesos.bonus;
        pontuacao += (validacoes.preco.total > 0 ? 1 : 0.5) * pesos.preco;
        pontuacao += (validacoes.garantia.total > 0 ? 1 : 0.3) * pesos.garantia;
        pontuacao += validacoes.consistencia.score * pesos.consistencia;

        return Math.min(1, pontuacao);
    }

    identificarProblemasCriticos(validacoes) {
        const problemas = [];
        if (validacoes.bonus.totalEncontrado === 0) {
            problemas.push('NENHUM bônus identificado após validação cruzada');
        }
        if (validacoes.preco.total === 0) {
            problemas.push('NENHUM preço identificado');
        }
        if (validacoes.consistencia.inconsistencias.length > 0) {
            problemas.push(...validacoes.consistencia.inconsistencias);
        }
        return problemas;
    }

    aplicarCorrecoes(dados, validacoes) {
        const dadosCorrigidos = { ...dados };
        if (validacoes.bonus.bonusUnificados.length > 0) {
            dadosCorrigidos.bonus = validacoes.bonus.bonusUnificados;
        }
        return dadosCorrigidos;
    }
}

// Instâncias globais dos sistemas
const sistemaExtracao = new SistemaExtracaoApurado();
const sistemaValidacao = new ValidacaoCruzada();

// ===== FIM DO SISTEMA APRIMORADO =====

// Trust proxy for accurate IP addresses
app.set("trust proxy", true);

// ===== Session Configuration =====
let sessionConfig = {
    secret: process.env.SESSION_SECRET || "fallback-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true
    }
};

// Usa Redis se disponível, caso contrário mostra aviso
if (process.env.REDIS_URL) {
    const RedisStore = require("connect-redis").default;
    const redis = require("redis");

    const redisClient = redis.createClient({
        url: process.env.REDIS_URL
    });

    redisClient.connect().catch(console.error);

    sessionConfig.store = new RedisStore({
        client: redisClient,
        prefix: "linkmagico:"
    });

    console.log("✅ Redis configurado para sessões");
} else {
    console.warn("⚠️  Redis não configurado - usando MemoryStore (não recomendado para produção)");
}

app.use(session(sessionConfig));

// ===== Middleware =====
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(cors({
    origin: function (origin, callback) {
        // Permitir requests sem 'origin' (como mobile apps, curl ou same-origin/preview)
        if (!origin) return callback(null, true);
        // Permitir todas as origens (modo SaaS para widgets externos)
        return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-API-Key"]
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(bodyParser.json({ limit: "10mb" }));

app.use(morgan("combined"));

// ===== API Key Validation Functions =====
// ===== API Key Validation Functions (Powered by ApiKeyManager) =====
async function validateApiKey(apiKey) {
    try {
        const manager = getApiKeyManager();
        const result = await manager.validateKey(apiKey);

        if (result.valid) {
            return {
                success: true,
                tenant: {
                    id: result.tenantId,
                    name: result.name || `Tenant ${result.tenantId.substring(0, 8)}`,
                    plan: result.plan || 'basic',
                    status: 'active',
                    apiKey: apiKey,
                    scopes: result.scopes,
                    keyId: result.keyId
                }
            };
        }
        return { success: false, error: result.reason || 'API Key inválida ou revogada' };
    } catch (error) {
        logger.error("Error validating API key via Manager:", error.message);
        return { success: false, error: 'Erro interno na validação' };
    }
}

// ===== API Key Middleware (Real-time Protection) =====
async function requireApiKey(req, res, next) {
    // 1. Rotas Públicas (Bypass)
    const publicPaths = [
        "/", "/validate-api-key", "/chat.html", "/chatbot",
        "/api/system/status", "/health", "/healthz", "/api/webhooks/hotmart",
        "/api/webhooks/hotmart/status",
        "/api/capture-lead",
        "/api/process-chat-inteligente",
        "/api/chat-universal",
        "/api/track-event"
    ];

    if (publicPaths.includes(req.path) || req.path.startsWith("/public/") || req.path.startsWith("/l/") || req.path.startsWith("/api/public/")) {
        return next();
    }

    // 2. Tentar validar via Header/Query/Body
    let apiKey = req.headers['x-api-key'] || req.query.apiKey || req.body.apiKey || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

    if (apiKey) {
        const validation = await validateApiKey(apiKey);
        if (validation.success) {
            req.session.tenantId = validation.tenant.id;
            req.session.validatedApiKey = apiKey;
            req.session.clientData = validation.tenant;
            req.session.plan = validation.tenant.plan;
            req.session.status = validation.tenant.status;
            req.cliente = validation.tenant;
            return next();
        } else {
            return res.status(401).json({ success: false, error: validation.error });
        }
    }

    // 3. Validar Sessão Existente com CHECK DE STATUS EM TEMPO REAL
    if (req.session && req.session.tenantId && req.session.validatedApiKey) {
        const manager = getApiKeyManager();
        const verification = await manager.validateKey(req.session.validatedApiKey);

        if (verification.valid) {
            req.cliente = req.session.clientData;
            return next();
        } else {
            logger.warn(`🚫 [SECURITY] Revoking session for tenant ${req.session.tenantId}: API Key is no longer valid.`);
            req.session.destroy();
            return res.redirect("/?error=key_revoked");
        }
    }

    // 4. Sem acesso: Redirecionar para login
    return res.redirect("/");
}

app.use(requireApiKey);

// ===== Health Check (para UptimeRobot e monitoramento) =====
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ===== V9 BLINDADA: Health Check Profissional (/healthz) =====
app.get("/healthz", async (req, res) => {
    try {
        const { db, USE_POSTGRES } = require('./database');
        
        // 1. DB Latency
        let dbStatus = { status: 'unknown', latencyMs: -1 };
        try {
            const dbStart = Date.now();
            await db.query('SELECT 1');
            dbStatus = { status: 'up', latencyMs: Date.now() - dbStart, type: USE_POSTGRES ? 'postgresql' : 'sqlite' };
        } catch (dbErr) {
            dbStatus = { status: 'down', error: dbErr.message };
        }

        // 2. Memória do processo
        const memUsage = process.memoryUsage();
        const memory = {
            rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
            external: Math.round(memUsage.external / 1024 / 1024) + 'MB'
        };

        // 3. Event loop lag
        let eventLoopLag = -1;
        try {
            const lagStart = Date.now();
            await new Promise(resolve => setImmediate(resolve));
            eventLoopLag = Date.now() - lagStart;
        } catch (_) {}

        // 4. Cache stats
        let cacheStatus = { status: 'unknown' };
        try {
            const { CacheManager } = require('./cache');
            const stats = await CacheManager.getCacheStats();
            cacheStatus = { status: 'up', ...stats };
        } catch (_) {
            cacheStatus = { status: 'not-available' };
        }

        // 5. LLM Cache stats
        let llmCacheStatus = { status: 'unknown' };
        try {
            const { llmOptimizer } = require('./llm-optimizer');
            llmCacheStatus = { status: 'up', ...llmOptimizer.getCacheStats() };
        } catch (_) {
            llmCacheStatus = { status: 'not-available' };
        }

        // 6. Rate Limiter stats
        let rateLimiterStats = { status: 'unknown' };
        try {
            if (rateLimiterAdvanced) {
                rateLimiterStats = { status: 'up', ...rateLimiterAdvanced.getStats() };
            }
        } catch (_) {}

        // 7. Feature flags
        let activeFlags = [];
        try {
            if (featureFlags) {
                activeFlags = featureFlags.getEnabledFlags();
            }
        } catch (_) {}

        // 8. Circuit Breaker stats
        let circuitBreakerStats = {};
        try {
            const cb = require('./lib/circuit-breaker');
            circuitBreakerStats = {
                llm: cb.llmCircuitBreaker.stats(),
                extraction: cb.extractionCircuitBreaker.stats(),
                puppeteer: cb.puppeteerCircuitBreaker.stats()
            };
        } catch (_) {}

        const overallStatus = dbStatus.status === 'up' ? 'ok' : 'degraded';

        res.status(overallStatus === 'ok' ? 200 : 503).json({
            status: overallStatus,
            version: 'v9',
            uptime: Math.round(process.uptime()),
            uptimeHuman: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`,
            timestamp: new Date().toISOString(),
            node: process.version,
            memory,
            eventLoopLagMs: eventLoopLag,
            services: {
                database: dbStatus,
                cache: cacheStatus,
                llmCache: llmCacheStatus,
                rateLimiter: rateLimiterStats,
                circuitBreakers: circuitBreakerStats
            },
            featureFlags: activeFlags
        });
    } catch (err) {
        // Fallback: nunca falhar no healthz
        res.status(500).json({
            status: 'error',
            version: 'v9',
            error: err.message,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    }
});

// ===== Static Files with API Key Protection =====
app.get("/", (req, res) => {
    // ✅ ENTERPRISE: verificar UUID do tenant (não a string da API Key)
    const isAuthenticated = !!(req.session && req.session.tenantId);
    logger.info(`[GET /] Session Authenticated: ${isAuthenticated}`);
    if (isAuthenticated) {
        return res.redirect("/app");
    }
    res.sendFile(path.join(__dirname, "public", "api_key_validation.html"));
});

app.post("/validate-api-key", async (req, res) => {
    const apiKey = req.body.apiKey || (req.session.user && req.session.user.apiKey ? req.session.user.apiKey : null);

    if (!apiKey) {
        return res.status(400).json({
            success: false,
            error: "API Key é obrigatória"
        });
    }

    const validation = await validateApiKey(apiKey);
    if (!validation.success) {
        return res.status(401).json({
            success: false,
            error: validation.error || "API Key inválida"
        });
    }

    req.session.tenantId = validation.tenant.id;
    req.session.validatedApiKey = apiKey;
    req.session.clientData = validation.tenant;
    req.session.plan = validation.tenant.plan;
    req.session.status = validation.tenant.status;
    req.cliente = validation.tenant; // Ensure req.cliente is set immediately after validation

    res.json({
        success: true,
        message: "API Key validada com sucesso"
    });
});

// ===== ENDPOINT PARA RETORNAR DADOS DA SESSÃO (para dashboard whitelabel) =====
app.get("/api/session/me", requireApiKey, (req, res) => {
    // ✅ ENTERPRISE: usar tenantId (UUID) como indicador principal de sessão
    const tenantId = req.session && req.session.tenantId;
    if (!tenantId) {
        return res.status(401).json({
            success: false,
            error: "Sessão não encontrada"
        });
    }
    res.json({
        success: true,
        tenantId: tenantId,
        apiKey: req.session.validatedApiKey || null,  // mantido para compatibilidade temporária
        plan: req.session.plan || 'basic',
        status: req.session.status || 'active',
        clientData: req.session.clientData || null
    });
});

app.get("/app", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index_app.html"));
});


app.get("/privacy.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "privacy.html"));
});

app.get("/excluir-dados", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "excluir-dados.html"));
});

// ===== ROTAS DE ADMINISTRAÇÃO DE LEADS =====
app.get("/admin/leads", requireApiKey, (req, res) => {
    const apiKey = req.session.validatedApiKey || req.body.apiKey || req.query.apiKey || (req.session.user && req.session.user.apiKey ? req.session.user.apiKey : null);

    if (!apiKey) {
        return res.status(401).json({ success: false, error: "API Key não fornecida" });
    }

    const leadSystem = getLeadSystem(apiKey);
    const leads = leadSystem.getLeads();
    console.log(`📊 Retornando ${leads.length} leads para admin`);
    res.json({
        success: true,
        leads: leads,
        total: leads.length
    });
});

app.get("/admin/leads/:id", requireApiKey, (req, res) => {
    const apiKey = req.session.validatedApiKey || req.body.apiKey || req.query.apiKey || (req.session.user && req.session.user.apiKey ? req.session.user.apiKey : null);

    if (!apiKey) {
        return res.status(401).json({ success: false, error: "API Key não fornecida" });
    }

    const leadSystem = getLeadSystem(apiKey);
    const lead = leadSystem.getLeadById(req.params.id);
    if (lead) {
        res.json({ success: true, lead });
    } else {
        res.status(404).json({ success: false, error: "Lead não encontrado" });
    }
});

// 🎯 BUG-FIX-004: Endpoint para excluir lead individual
app.delete("/admin/leads/:id", requireApiKey, (req, res) => {
    try {
        const apiKey = req.session.validatedApiKey || req.body.apiKey || req.query.apiKey || (req.session.user && req.session.user.apiKey ? req.session.user.apiKey : null);

        if (!apiKey) {
            return res.status(401).json({ success: false, error: "API Key não fornecida" });
        }

        const leadSystem = getLeadSystem(apiKey);
        const removed = leadSystem.deleteLeadById(req.params.id);

        if (removed) {
            console.log(`🗑️ Lead ${req.params.id} removido pelo admin (tenant ${apiKey.substring(0, 8)}...)`);
            res.json({ success: true, message: "Lead removido com sucesso", lead: removed });
        } else {
            res.status(404).json({ success: false, error: "Lead não encontrado" });
        }
    } catch (error) {
        console.error("❌ Erro ao excluir lead:", error);
        res.status(500).json({ success: false, error: "Erro ao excluir lead" });
    }
});

// ===== ROTAS DE BACKUP DE LEADS =====
app.post("/admin/leads/backup/create", requireApiKey, (req, res) => {
    const apiKey = req.session.validatedApiKey || req.body.apiKey || req.query.apiKey || (req.session.user && req.session.user.apiKey ? req.session.user.apiKey : null);

    if (!apiKey) {
        return res.status(401).json({ success: false, error: "API Key não fornecida" });
    }

    const leadSystem = getLeadSystem(apiKey);
    const backupSystem = getBackupSystem(leadSystem, apiKey);
    const result = backupSystem.createBackup("manual");
    res.json(result);
});

app.get("/admin/leads/backup/list", requireApiKey, (req, res) => {
    const apiKey = req.session.validatedApiKey || req.body.apiKey || req.query.apiKey || (req.session.user && req.session.user.apiKey ? req.session.user.apiKey : null);

    if (!apiKey) {
        return res.status(401).json({ success: false, error: "API Key não fornecida" });
    }

    const leadSystem = getLeadSystem(apiKey);
    const backupSystem = getBackupSystem(leadSystem, apiKey);
    const backups = backupSystem.listBackups();
    res.json({
        success: true,
        backups: backups,
        total: backups.length
    });
});

app.post("/admin/leads/backup/restore", requireApiKey, (req, res) => {
    const { filename } = req.body;

    if (!filename) {
        return res.status(400).json({
            success: false,
            error: "Nome do arquivo de backup é obrigatório"
        });
    }

    const apiKey = req.session.validatedApiKey || req.body.apiKey || req.query.apiKey || (req.session.user && req.session.user.apiKey ? req.session.user.apiKey : null);

    if (!apiKey) {
        return res.status(401).json({ success: false, error: "API Key não fornecida" });
    }

    const leadSystem = getLeadSystem(apiKey);
    const backupSystem = getBackupSystem(leadSystem, apiKey);
    const result = backupSystem.restoreBackup(filename);
    res.json(result);
});

// ===== 📅 ENDPOINTS DE AGENDAMENTOS =====

// Listar todos os agendamentos
app.get("/admin/appointments", requireApiKey, (req, res) => {
    const apiKey = req.session.validatedApiKey || req.body.apiKey || req.query.apiKey || (req.session.user && req.session.user.apiKey ? req.session.user.apiKey : null);

    if (!apiKey) {
        return res.status(401).json({ success: false, error: "API Key não fornecida" });
    }

    const leadSystem = getLeadSystem(apiKey);
    const appointments = leadSystem.getAppointments();

    console.log(`📅 Retornando ${appointments.length} agendamentos para admin`);
    res.json({
        success: true,
        appointments,
        total: appointments.length
    });
});

// Obter agendamento específico
app.get("/admin/appointments/:id", requireApiKey, (req, res) => {
    const apiKey = req.session.validatedApiKey || req.query.apiKey || (req.session.user && req.session.user.apiKey ? req.session.user.apiKey : null);

    if (!apiKey) {
        return res.status(401).json({ success: false, error: "API Key não fornecida" });
    }

    const leadSystem = getLeadSystem(apiKey);
    const appointment = leadSystem.getAppointmentById(req.params.id);

    if (!appointment) {
        return res.status(404).json({ success: false, error: "Agendamento não encontrado" });
    }

    res.json({ success: true, appointment });
});

// Criar novo agendamento
app.post("/api/appointments", requireApiKey, (req, res) => {
    const apiKey = req.session.validatedApiKey || req.body.apiKey || req.query.apiKey || (req.session.user && req.session.user.apiKey ? req.session.user.apiKey : null);

    if (!apiKey) {
        return res.status(401).json({ success: false, error: "API Key não fornecida" });
    }

    const { leadId, leadName, leadEmail, leadPhone, datetime, notes, robotName, urlOrigem } = req.body;

    if (!datetime) {
        return res.status(400).json({ success: false, error: "Data/hora é obrigatória" });
    }

    const leadSystem = getLeadSystem(apiKey);
    const appointment = leadSystem.addAppointment({
        leadId,
        leadName,
        leadEmail,
        leadPhone,
        datetime,
        notes,
        robotName,
        urlOrigem
    });

    res.json({
        success: true,
        appointment,
        message: "Agendamento criado com sucesso"
    });
});

// Atualizar status do agendamento
app.put("/admin/appointments/:id/status", requireApiKey, (req, res) => {
    const apiKey = req.session.validatedApiKey || req.body.apiKey || req.query.apiKey || (req.session.user && req.session.user.apiKey ? req.session.user.apiKey : null);

    if (!apiKey) {
        return res.status(401).json({ success: false, error: "API Key não fornecida" });
    }

    const { status } = req.body;

    if (!status || !['pendente', 'confirmado', 'cancelado', 'realizado'].includes(status)) {
        return res.status(400).json({
            success: false,
            error: "Status inválido. Use: pendente, confirmado, cancelado ou realizado"
        });
    }

    const leadSystem = getLeadSystem(apiKey);
    const appointment = leadSystem.updateAppointmentStatus(req.params.id, status);

    if (!appointment) {
        return res.status(404).json({ success: false, error: "Agendamento não encontrado" });
    }

    res.json({
        success: true,
        appointment,
        message: `Status atualizado para: ${status}`
    });
});

// Obter agendamentos de um lead específico
app.get("/admin/leads/:leadId/appointments", requireApiKey, (req, res) => {
    const apiKey = req.session.validatedApiKey || req.query.apiKey || (req.session.user && req.session.user.apiKey ? req.session.user.apiKey : null);

    if (!apiKey) {
        return res.status(401).json({ success: false, error: "API Key não fornecida" });
    }

    const leadSystem = getLeadSystem(apiKey);
    const appointments = leadSystem.getAppointmentsByLeadId(req.params.leadId);

    res.json({
        success: true,
        appointments,
        total: appointments.length
    });
});

// ===== DOCUMENTAÇÃO DA API =====
app.get("/api/docs", (req, res) => {
    const docs = {
        name: "LinkMágico API v7.0",
        version: "7.0.0",
        description: "API SuperInteligente para Chatbots e Captura de Leads",
        endpoints: {
            // Administração de Leads
            "GET /admin/leads": {
                description: "Listar todos os leads",
                authentication: "API Key obrigatória",
                parameters: "Nenhum",
                response: {
                    success: "boolean",
                    leads: "array",
                    total: "number"
                }
            },
            "GET /admin/leads/:id": {
                description: "Obter lead específico",
                authentication: "API Key obrigatória",
                parameters: "id (path parameter)",
                response: {
                    success: "boolean",
                    lead: "object"
                }
            },
            // Backup de Leads
            "POST /admin/leads/backup/create": {
                description: "Criar backup manual dos leads",
                authentication: "API Key obrigatória",
                parameters: "Nenhum",
                response: {
                    success: "boolean",
                    filename: "string",
                    path: "string"
                }
            },
            "GET /admin/leads/backup/list": {
                description: "Listar backups disponíveis",
                authentication: "API Key obrigatória",
                parameters: "Nenhum",
                response: {
                    success: "boolean",
                    backups: "array",
                    total: "number"
                }
            },
            "POST /admin/leads/backup/restore": {
                description: "Restaurar backup",
                authentication: "API Key obrigatória",
                parameters: {
                    filename: "string (obrigatório)"
                },
                response: {
                    success: "boolean",
                    leadsCount: "number",
                    timestamp: "string"
                }
            },
            // Chat e Processamento
            "POST /api/process-chat-inteligente": {
                description: "Processamento superinteligente de chat",
                authentication: "API Key obrigatória",
                parameters: {
                    message: "string (obrigatório)",
                    pageData: "object (opcional)",
                    robotName: "string (opcional)",
                    instructions: "string (opcional)",
                    leadId: "string (opcional)"
                },
                response: {
                    success: "boolean",
                    response: "string",
                    inteligenciasDetectadas: "object",
                    analiseEmocional: "object"
                }
            },
            "POST /api/chat-universal": {
                description: "Chat universal com captura de leads",
                authentication: "API Key obrigatória",
                parameters: {
                    message: "string (obrigatório)",
                    url: "string (opcional)",
                    instructions: "string (opcional)",
                    leadId: "string (opcional)"
                }
            },
            // Extração de Dados
            "POST /api/extract-enhanced": {
                description: "Extração aprimorada de dados de página",
                authentication: "Nenhuma",
                parameters: {
                    url: "string (obrigatório)"
                },
                response: {
                    success: "boolean",
                    data: "object",
                    validacao: "object"
                }
            }
        },
        examples: {
            "Capturar Lead": {
                url: "/api/capture-lead",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": "sua_api_key_aqui"
                },
                body: {
                    nome: "João Silva",
                    email: "joao@email.com",
                    telefone: "+5511999999999",
                    url_origem: "https://exemplo.com",
                    robotName: "Meu Assistente"
                }
            },
            "Processar Chat Inteligente": {
                url: "/api/process-chat-inteligente",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": "sua_api_key_aqui"
                },
                body: {
                    message: "Quero saber mais sobre seus produtos",
                    robotName: "Meu Assistente",
                    leadId: "lead_123456"
                }
            },
            "Criar Backup": {
                url: "/admin/leads/backup/create",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": "sua_api_key_aqui"
                }
            }
        },
        authentication: {
            type: "API Key",
            locations: ["header (X-API-Key)", "query parameter (apiKey)", "body (apiKey)"],
            note: "Obtenha sua API Key no painel administrativo"
        }
    };

    res.json(docs);
});

// ===== STATUS DO SISTEMA DE BACKUP =====
app.get("/admin/backup/status", requireApiKey, (req, res) => {
    try {
        const apiKey = req.session.validatedApiKey || req.body.apiKey || req.query.apiKey || (req.session.user && req.session.user.apiKey ? req.session.user.apiKey : null);
        const leadSystem = getLeadSystem(apiKey);
        const backupSystem = getBackupSystem(leadSystem, apiKey);

        const backups = backupSystem.listBackups();
        const backupDir = getTenantBackupDirPath(apiKey);

        const status = {
            sistema: "Sistema de Backup de Leads",
            leadsAtivos: leadSystem.leads.length,
            totalBackups: backups.length,
            ultimoBackup: backups.length > 0 ? backups[0] : null,
            diretorioBackup: backupDir,
            agendamentoAtivo: true,
            intervalo: "24 horas",
            maxBackups: 7,
            tamanhoTotal: backups.reduce((total, backup) => total + (backup.size || 0), 0),
            status: "OPERACIONAL"
        };

        res.json({
            success: true,
            status: status,
            backups: backups.slice(0, 5) // Últimos 5 backups
        });

    } catch (error) {
        console.error("❌ Erro ao verificar status do backup:", error);
        res.status(500).json({
            success: false,
            error: "Erro ao verificar status do backup",
            details: error.message
        });
    }
});

// ===== TESTE DO SISTEMA DE BACKUP =====
app.post("/admin/backup/test", requireApiKey, (req, res) => {
    try {
        const apiKey = req.session.validatedApiKey || req.body.apiKey || req.query.apiKey || (req.session.user && req.session.user.apiKey ? req.session.user.apiKey : null);
        const leadSystem = getLeadSystem(apiKey);
        const backupSystem = getBackupSystem(leadSystem, apiKey);

        // Criar backup de teste
        const resultado = backupSystem.createBackup("teste");

        // Listar backups após teste
        const backups = backupSystem.listBackups();

        res.json({
            success: true,
            mensagem: "Sistema de backup testado com sucesso",
            teste: {
                backupCriado: resultado.success,
                arquivo: resultado.filename,
                leadsIncluidos: leadSystem.leads.length,
                totalBackupsAposTeste: backups.length
            },
            status: "SISTEMA OPERACIONAL"
        });

    } catch (error) {
        console.error("❌ Erro no teste de backup:", error);
        res.status(500).json({
            success: false,
            error: "Falha no teste do sistema de backup",
            details: error.message
        });
    }
});

// ===== 🤖 MEUS ASSISTENTES - CRUD API =====
// NOTA: Bloco antigo (JSON file storage) removido — rotas ativas estão mais abaixo,
// usando DatabaseHelpers.getShortUrlsByApiKey() para ler da tabela short_urls.
// ===== FIM MEUS ASSISTENTES (redirecionado) =====

// ROTA CHAT.HTML
app.get("/chat.html", async (req, res) => {
    try {
        const robotName = req.query.robotName || req.query.name || "Assistente IA";
        const url = req.query.url || "";
        const apiKey = req.query.apiKey || (req.session.user && req.session.user.apiKey ? req.session.user.apiKey : null);
        const instructions = req.query.instructions || "";

        // 🎨 Buscar whitelabel do banco de dados se apiKey presente
        let whitelabel = {};
        if (apiKey) {
            try {
                const wlResult = await whitelabelManager.getConfig(apiKey);
                if (wlResult.success && !wlResult.isDefault && wlResult.settings) {
                    whitelabel = {
                        companyName: wlResult.settings.companyName || null,
                        logoUrl: wlResult.settings.logoUrl || null,
                        primaryColor: wlResult.settings.primaryColor || null,
                        secondaryColor: wlResult.settings.secondaryColor || null,
                        showPoweredBy: wlResult.settings.showPoweredBy !== false,
                        welcomeMessage: wlResult.settings.welcomeMessage || null
                    };
                    console.log(`🎨 Whitelabel carregado do banco para /chat.html (tenant: ${apiKey})`);
                }
            } catch (wlError) {
                console.warn('Não foi possível carregar whitelabel para chat.html:', wlError.message);
            }
        }

        let pageData = {};
        if (url) {
            try {
                pageData = await extractPageData(url);
            } catch (extractError) {
                console.warn('Failed to extract page data in chat.html:', extractError.message || extractError);
            }
        }

        const chatbotHTML = generateFullChatbotHTML(pageData, robotName, instructions, apiKey, whitelabel);
        res.send(chatbotHTML);
    } catch (error) {
        logger.error('Chat.html route error:', error.message || error);
        res.status(500).send('Erro interno ao gerar chat.html');
    }
});

// ROTA CHATBOT COMPLETA
app.get("/chatbot", async (req, res) => {
    try {
        const robotName = req.query.robotName || req.query.name || "Assistente IA";
        const url = req.query.url || "";
        const apiKey = req.query.apiKey || (req.session.user && req.session.user.apiKey ? req.session.user.apiKey : null);
        const instructions = req.query.instructions || "";

        // 🎨 Extrair parâmetros de whitelabel da URL
        let whitelabel = {
            companyName: req.query.wlCompany || null,
            logoUrl: req.query.wlLogo || null,
            primaryColor: req.query.wlPrimary || null,
            secondaryColor: req.query.wlSecondary || null,
            showPoweredBy: req.query.wlPoweredBy !== '0' // Default true
        };

        // 🎨 Se não tiver cores na URL e tiver apiKey, buscar do banco de dados
        if (!whitelabel.primaryColor && apiKey) {
            try {
                const wlResult = await whitelabelManager.getConfig(apiKey);
                if (wlResult.success && !wlResult.isDefault && wlResult.settings) {
                    whitelabel = {
                        companyName: wlResult.settings.companyName || whitelabel.companyName,
                        logoUrl: wlResult.settings.logoUrl || whitelabel.logoUrl,
                        primaryColor: wlResult.settings.primaryColor || null,
                        secondaryColor: wlResult.settings.secondaryColor || null,
                        showPoweredBy: wlResult.settings.showPoweredBy !== false,
                        welcomeMessage: wlResult.settings.welcomeMessage || null
                    };
                    console.log(`🎨 Whitelabel carregado do banco para /chatbot (tenant: ${apiKey})`);
                }
            } catch (wlError) {
                console.warn('Não foi possível carregar whitelabel do banco:', wlError.message);
            }
        }

        let pageData = {};
        if (url) {
            try {
                pageData = await extractPageData(url);
            } catch (extractError) {
                console.warn('Failed to extract page data:', extractError.message || extractError);
            }
        }

        const html = generateFullChatbotHTML(pageData, robotName, instructions, apiKey, whitelabel);
        res.set('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        logger.error('Chatbot route error:', error.message || error);
        // Retorna uma mensagem de erro mais amigável para o Preview
        res.status(500).send('<h1>Internal Server Error</h1><p>Erro ao gerar chatbot. Verifique os logs do servidor.</p>');
    }
});

app.use("/public", express.static(path.join(__dirname, "public"), {
    maxAge: "1d",
    etag: true,
    lastModified: true
}));

app.use(express.static("public", {
    maxAge: "1d",
    etag: true,
    lastModified: true
}));

// ===== Analytics & Cache =====
const analytics = {
    totalRequests: 0,
    chatRequests: 0,
    extractRequests: 0,
    errors: 0,
    activeChats: new Set(),
    startTime: Date.now(),
    responseTimeHistory: [],
    successfulExtractions: 0,
    failedExtractions: 0,
    leadsCaptured: 0
};

app.use((req, res, next) => {
    const start = Date.now();
    analytics.totalRequests++;

    res.on("finish", () => {
        const responseTime = Date.now() - start;
        analytics.responseTimeHistory.push(responseTime);
        if (analytics.responseTimeHistory.length > 100) analytics.responseTimeHistory.shift();
        if (res.statusCode >= 400) analytics.errors++;
    });

    next();
});

const dataCache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

function setCacheData(key, data) {
    dataCache.set(key, { data, timestamp: Date.now() });
}

function getCacheData(key) {
    const cached = dataCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.data;
    }
    dataCache.delete(key);
    return null;
}

// ===== Utility functions =====
function normalizeText(text) {
    return (text || "").replace(/\s+/g, " ").trim();
}

function uniqueLines(text) {
    if (!text) return "";
    const seen = new Set();
    return text.split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .filter(line => {
            if (seen.has(line)) return false;
            seen.add(line);
            return true;
        })
        .join("\n");
}

function clampSentences(text, maxSentences = 2) {
    if (!text) return "";
    const sentences = normalizeText(text).split(/(?<=[.!?])\s+/);
    return sentences.slice(0, maxSentences).join(" ");
}

function extractBonuses(text) {
    if (!text) return [];
    const bonusKeywords = /(bônus|bonus|brinde|extra|grátis|template|planilha|checklist|e-book|ebook)/gi;
    const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const bonuses = [];

    for (const line of lines) {
        if (bonusKeywords.test(line) && line.length > 10 && line.length < 200) {
            bonuses.push(line);
            if (bonuses.length >= 5) break;
        }
    }
    return Array.from(new Set(bonuses));
}

// 🎯 NOVO: FUNÇÃO MODULAR PARA EXTRAIR PREÇOS (BUG-FIX-PRECO)
function extractPrices(text) {
    if (!text) return [];
    const pricePatterns = [
        /R\$\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?/gi,
        /\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\s*reais/gi,
        /R\$\s*\d+(?:[.,]\d+)?(?:\/(?:mês|ano|mes|dia))?/gi
    ];
    const detectedPrices = new Set();
    pricePatterns.forEach(pattern => {
        const matches = String(text).match(pattern);
        if (matches) {
            matches.forEach(price => detectedPrices.add(price.trim()));
        }
    });
    return Array.from(detectedPrices).slice(0, 10);
}

// ===== Content extraction =====
function extractCleanTextFromHTML(html) {
    try {
        const $ = cheerio.load(html || "");
        $("script, style, noscript, iframe, nav, footer, aside").remove();

        const textBlocks = [];
        const selectors = ["h1", "h2", "h3", "p", "li", "span", "div"];

        for (const selector of selectors) {
            $(selector).each((i, element) => {
                const text = normalizeText($(element).text() || "");
                if (text && text.length > 15 && text.length < 1000) {
                    textBlocks.push(text);
                }
            });
        }

        const metaDesc = $("meta[name=\"description\"]").attr("content") ||
            $("meta[property=\"og:description\"]").attr("content") || "";
        if (metaDesc && metaDesc.trim().length > 20) {
            textBlocks.unshift(normalizeText(metaDesc.trim()));
        }

        const uniqueBlocks = [...new Set(textBlocks.map(b => b.trim()).filter(Boolean))];
        return uniqueBlocks.join("\n");
    } catch (error) {
        logger.warn("extractCleanTextFromHTML error:", error.message || error);
        return "";
    }
}

// ===== Page extraction =====
async function extractPageDataWithRetry(url, maxRetries = 3) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            logger.info(`Tentativa ${attempt}/${maxRetries} de extrair: ${url}`);

            // Timeout progressivo: 30s, 45s, 60s
            const timeout = 30000 + (attempt - 1) * 15000;

            const result = await Promise.race([
                extractPageData(url),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Timeout após ${timeout / 1000}s`)), timeout)
                )
            ]);

            // Verificar se a extração foi bem-sucedida
            if (result && (result.cleanText || result.title || result.description)) {
                logger.info(`✅ Extração bem-sucedida na tentativa ${attempt}`);
                return result;
            }

            throw new Error('Extração retornou dados vazios');

        } catch (error) {
            lastError = error;
            logger.warn(`❌ Tentativa ${attempt} falhou: ${error.message}`);

            if (attempt < maxRetries) {
                const waitTime = 2000 * attempt; // 2s, 4s, 6s
                logger.info(`⏳ Aguardando ${waitTime / 1000}s antes da próxima tentativa...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    // Se todas as tentativas falharam, retornar fallback
    logger.error(`❌ Todas as ${maxRetries} tentativas falharam para: ${url}`);
    return {
        title: "Chatbot Inteligente",
        description: "Assistente virtual pronto para ajudar",
        benefits: [],
        testimonials: [],
        cta: "",
        summary: "Este é um assistente inteligente que pode responder suas perguntas. A extração automática do conteúdo não foi possível, mas você ainda pode fazer perguntas!",
        cleanText: `Informações sobre: ${url}\n\nEste é um assistente virtual inteligente pronto para responder suas dúvidas.\n\nPor favor, faça sua pergunta e farei o melhor para ajudá-lo!`,
        imagesText: [],
        url: url,
        extractionTime: 0,
        method: "fallback",
        error: lastError ? lastError.message : "Extração falhou após múltiplas tentativas",
        bonuses_detected: [],
        price_detected: [],
        contatos: {
            telefone: [],
            whatsapp: [],
            email: [],
            site: [url],
            endereco: []
        }
    };
}

async function extractPageData(url) {
    const startTime = Date.now();
    try {
        if (!url) throw new Error("URL is required");

        const cacheKey = url;
        const cached = getCacheData(cacheKey);
        if (cached) {
            logger.info(`Cache hit for ${url}`);
            return cached;
        }

        logger.info(`Starting extraction for: ${url}`);

        const extractedData = {
            title: "",
            description: "",
            benefits: [],
            testimonials: [],
            cta: "",
            summary: "",
            cleanText: "",
            imagesText: [],
            url: url,
            extractionTime: 0,
            method: "unknown",
            bonuses_detected: [],
            price_detected: [],
            // 🎯 NOVO: Contatos extraídos
            contatos: {
                telefone: [],
                whatsapp: [],
                email: [],
                site: [url],
                endereco: []
            }
        };

        // 🔥 [V9.5] Resolver redirects (Hotmart, Kiwify, etc)
        // Se a URL é de plataforma de pagamento, usar como checkout direto
        try {
            const _v95Url = (url || '').toLowerCase();
            if (_v95Url.includes('hotmart.com') || _v95Url.includes('go.hotmart.com')) {
                extractedData.checkoutLink = url;
                extractedData.checkoutSource = 'hotmart-direct';
                console.log('[CHECKOUT] 🔥 Hotmart direto detectado:', url.substring(0, 80));
            } else if (_v95Url.includes('kiwify.com.br')) {
                extractedData.checkoutLink = url;
                extractedData.checkoutSource = 'kiwify-direct';
                console.log('[CHECKOUT] 🔥 Kiwify direto detectado:', url.substring(0, 80));
            } else if (_v95Url.includes('eduzz.com')) {
                extractedData.checkoutLink = url;
                extractedData.checkoutSource = 'eduzz-direct';
                console.log('[CHECKOUT] 🔥 Eduzz direto detectado:', url.substring(0, 80));
            } else if (_v95Url.includes('monetizze.com.br')) {
                extractedData.checkoutLink = url;
                extractedData.checkoutSource = 'monetizze-direct';
                console.log('[CHECKOUT] 🔥 Monetizze direto detectado:', url.substring(0, 80));
            } else if (_v95Url.includes('braip.com')) {
                extractedData.checkoutLink = url;
                extractedData.checkoutSource = 'braip-direct';
                console.log('[CHECKOUT] 🔥 Braip direto detectado:', url.substring(0, 80));
            }
        } catch (_v95DetectErr) {
            console.warn('[CHECKOUT] Erro na detecção direta (sem impacto):', _v95DetectErr.message);
        }

        let html = "";
        try {
            logger.info("Attempting Axios + Cheerio extraction...");
            const response = await axios.get(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; LinkMagico-Bot/6.0; +https://linkmagico-comercial.onrender.com)",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8"
                },
                timeout: 30000,
                maxRedirects: 5,
                validateStatus: status => status >= 200 && status < 400
            });
            html = response.data || "";
            const finalUrl = response.request?.res?.responseUrl || url;
            if (finalUrl && finalUrl !== url) {
                extractedData.url = finalUrl;
                // 🔥 [V9.6] Preservar URL original como fallback para checkout
                extractedData._originalUrl = url;
            }
            extractedData.method = "axios-cheerio";
            logger.info(`Axios extraction successful, HTML length: ${String(html).length}`);
        } catch (axiosError) {
            logger.warn(`Axios extraction failed for ${url}: ${axiosError.message || axiosError}`);
        }

        if (html && html.length > 100) {
            try {
                const $ = cheerio.load(html);
                $("script, style, noscript, iframe").remove();

                // Title
                const titleSelectors = ["h1", "meta[property=\"og:title\"]", "meta[name=\"twitter:title\"]", "title"];
                for (const selector of titleSelectors) {
                    const el = $(selector).first();
                    const title = (el.attr && (el.attr("content") || el.text) ? (el.attr("content") || el.text()) : el.text ? el.text() : "").toString().trim();
                    if (title && title.length > 5 && title.length < 200) {
                        extractedData.title = title;
                        break;
                    }
                }

                // Description
                const descSelectors = ["meta[name=\"description\"]", "meta[property=\"og:description\"]", ".description", "article p", "main p"];
                for (const selector of descSelectors) {
                    const el = $(selector).first();
                    const desc = (el.attr && (el.attr("content") || el.text) ? (el.attr("content") || el.text()) : el.text ? el.text() : "").toString().trim();
                    if (desc && desc.length > 50 && desc.length < 1000) {
                        extractedData.description = desc;
                        break;
                    }
                }

                extractedData.cleanText = extractCleanTextFromHTML(html);

                const bodyText = $("body").text() || "";
                const summaryText = bodyText.replace(/\s+/g, " ").trim();
                const sentences = summaryText.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
                extractedData.summary = sentences.slice(0, 3).join(". ").substring(0, 400) + (sentences.length > 3 ? "..." : "");

                extractedData.bonuses_detected = extractBonuses(bodyText);

                // 🎯 [BUG-FIX-PRECO] Usar função modular
                extractedData.price_detected = extractPrices(bodyText);
                if (extractedData.price_detected.length > 0) {
                    logger.info(`💰 Preços detectados (Cheerio): ${extractedData.price_detected.join(', ')}`);
                }

                // 🎯 EXTRAIR CONTATOS
                extractedData.contatos = sistemaContatosAprimorado.extrairContatosAprimorado($);

                // 🔗 [V9.3 CHECKOUT-SERVER] Extração server-side de checkout link via heurística
                // Protegido por feature flag + try/catch — zero impacto se falhar
                try {
                    const _ckServerEnabled = !featureFlags || !featureFlags.isEnabled || featureFlags.isEnabled('FEATURE_AUTO_CHECKOUT_DETECTION');
                    if (_ckServerEnabled) {
                        const _ckKeywordsHigh = ['comprar', 'buy', 'checkout', 'pagar', 'finalizar', 'adquirir', 'assinar'];
                        const _ckKeywordsMed  = ['carrinho', 'cart', 'quero', 'garantir', 'inscrever', 'matricular'];
                        const _ckPayDomains   = ['hotmart', 'kiwify', 'eduzz', 'monetizze', 'pay.', 'checkout.', 'mercadopago', 'pagar.me', 'stripe', 'paypal', 'braip', 'herospark'];

                        let _ckBestLink = null;
                        let _ckBestScore = 0;

                        $('a[href]').each((_, el) => {
                            const _href = ($(el).attr('href') || '').trim();
                            const _text = ($(el).text() || '').toLowerCase().trim();
                            if (!_href.startsWith('http')) return;
                            const _hrefLower = _href.toLowerCase();

                            let _sc = 0;
                            _ckKeywordsHigh.forEach(k => { if (_text.includes(k) || _hrefLower.includes(k)) _sc += 50; });
                            _ckKeywordsMed.forEach(k =>  { if (_text.includes(k) || _hrefLower.includes(k)) _sc += 20; });
                            _ckPayDomains.forEach(d =>   { if (_hrefLower.includes(d)) _sc += 60; });

                            // Penalizar links internos/âncora
                            if (_hrefLower.includes('#') && !_hrefLower.startsWith('http')) _sc -= 30;
                            try { if (_href === url) _sc -= 30; } catch(_) {}

                            if (_sc > _ckBestScore) { _ckBestScore = _sc; _ckBestLink = _href; }
                        });

                        if (_ckBestLink && _ckBestScore >= 50) {
                            // 🔥 [V9.6] NÃO sobrescrever se V9.5 já detectou checkout direto (Braip/Hotmart/etc)
                            if (extractedData.checkoutLink && extractedData.checkoutSource) {
                                logger.info(`🔗 [CHECKOUT-SERVER] Heurística ignorada — V9.5 direto já definiu: ${extractedData.checkoutLink.substring(0, 80)} (source: ${extractedData.checkoutSource})`);
                            } else {
                                extractedData.checkoutLink = _ckBestLink;
                                logger.info(`🔗 [CHECKOUT-SERVER] Link detectado server-side: ${_ckBestLink.substring(0, 80)} (score: ${_ckBestScore})`);
                            }
                        }
                    }
                } catch (_ckServerErr) {
                    logger.warn('⚠️ [CHECKOUT-SERVER] Erro na detecção (sem impacto):', _ckServerErr.message);
                }

                logger.info(`Cheerio extraction completed for ${url}`);
                analytics.successfulExtractions++;
            } catch (cheerioError) {
                logger.warn(`Cheerio parsing failed: ${cheerioError.message || cheerioError}`);
                analytics.failedExtractions++;
            }
        }

        // Puppeteer fallback
        const minAcceptableLength = 200;
        if ((!extractedData.cleanText || extractedData.cleanText.length < minAcceptableLength) && puppeteer) {
            logger.info("Trying Puppeteer for dynamic rendering...");
            let browser = null;
            try {
                browser = await puppeteer.launch({
                    headless: true,
                    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
                    defaultViewport: { width: 1200, height: 800 },
                    timeout: 40000
                });
                const page = await browser.newPage();
                await page.setUserAgent("Mozilla/5.0 (compatible; LinkMagico-Bot/6.0)");
                await page.setRequestInterception(true);
                page.on("request", (req) => {
                    const rt = req.resourceType();
                    if (["stylesheet", "font", "image", "media"].includes(rt)) req.abort();
                    else req.continue();
                });

                try {
                    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 40000 });
                } catch (gotoErr) {
                    logger.warn("Puppeteer goto failed:", gotoErr.message || gotoErr);
                }

                try {
                    await page.evaluate(async () => {
                        await new Promise((resolve) => {
                            let totalHeight = 0;
                            const distance = 100;
                            const timer = setInterval(() => {
                                const scrollHeight = document.body.scrollHeight;
                                window.scrollBy(0, distance);
                                totalHeight += distance;

                                if (totalHeight >= scrollHeight || totalHeight > 3000) {
                                    clearInterval(timer);
                                    resolve();
                                }
                            }, 100);
                        });
                    });
                } catch (scrollErr) {
                    logger.warn("Puppeteer scroll failed:", scrollErr.message || scrollErr);
                }

                const content = await page.content();
                const puppeteerData = await page.evaluate(() => {
                    const metaDescription = document.querySelector("meta[name=\"description\"]")?.content ||
                        document.querySelector("meta[property=\"og:description\"]")?.content || "";
                    const title = document.querySelector("title")?.textContent ||
                        document.querySelector("h1")?.textContent || "";
                    return { metaDescription, title };
                });

                const finalText = extractCleanTextFromHTML(content);

                if (finalText && finalText.length > extractedData.cleanText.length) {
                    extractedData.cleanText = finalText;
                    extractedData.method = "puppeteer";
                    if (!extractedData.title && puppeteerData.title) extractedData.title = puppeteerData.title.slice(0, 200);
                    if (!extractedData.description && puppeteerData.metaDescription) extractedData.description = puppeteerData.metaDescription.slice(0, 500);
                    const sents = finalText.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
                    if (!extractedData.summary && sents.length) extractedData.summary = sents.slice(0, 3).join(". ").substring(0, 400) + (sents.length > 3 ? "..." : "");
                    extractedData.bonuses_detected = extractBonuses(finalText);
                    // 🎯 [BUG-FIX-PRECO] Atualizar preços no Puppeteer
                    extractedData.price_detected = extractPrices(finalText);
                    analytics.successfulExtractions++;
                }

            } catch (puppeteerErr) {
                logger.warn("Puppeteer extraction failed:", puppeteerErr.message || puppeteerErr);
                analytics.failedExtractions++;
            } finally {
                try { if (browser) await browser.close(); } catch (e) { }
            }
        }

        // 🚀 ENHANCED EXTRACTION: OCR + Dynamic Content + Floating Elements
        // ⏱️ Wrapped with timeout to prevent blocking
        if (enhancedExtractor) {
            try {
                logger.info(`🚀 [ENHANCED] Starting enhanced extraction for ${url}`);

                // Timeout de 30 segundos para evitar bloqueio
                const enhancedPromise = enhancedExtractor.extractComplete(url, {
                    enableOCR: true,
                    maxOCRImages: 5, // Reduzido para performance
                    enableFloating: true,
                    enableDynamic: true
                });

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Enhanced extraction timeout (30s)')), 30000)
                );

                const enhancedContent = await Promise.race([enhancedPromise, timeoutPromise]);

                // Merge enhanced content with existing data
                if (enhancedContent.ocrText && enhancedContent.ocrText.length > 20) {
                    extractedData.cleanText += '\n\n[CONTEÚDO EXTRAÍDO DE IMAGENS]\n' + enhancedContent.ocrText;
                    extractedData.imagesText = [enhancedContent.ocrText];
                    logger.info(`✅ [ENHANCED] OCR: ${enhancedContent.processedImages} imagens processadas`);
                }

                if (enhancedContent.floatingContent && enhancedContent.floatingContent.length > 20) {
                    extractedData.cleanText += '\n\n[ELEMENTOS DINÂMICOS/FLUTUANTES]\n' + enhancedContent.floatingContent;
                    logger.info(`✅ [ENHANCED] Floating elements captured`);
                }

                if (enhancedContent.iframeContent && enhancedContent.iframeContent.length > 20) {
                    extractedData.cleanText += '\n\n[CONTEÚDO DE IFRAMES]\n' + enhancedContent.iframeContent;
                    logger.info(`✅ [ENHANCED] Iframe content captured`);
                }

                // Use dynamic text if it's more complete
                if (enhancedContent.dynamicText && enhancedContent.dynamicText.length > extractedData.cleanText.length * 1.2) {
                    extractedData.cleanText = enhancedContent.dynamicText;
                    extractedData.method = 'enhanced-extraction';
                    logger.info(`✅ [ENHANCED] Using enhanced dynamic text (${enhancedContent.dynamicText.length} chars)`);
                }

                extractedData.enhancedExtraction = {
                    ocrTextLength: enhancedContent.ocrText?.length || 0,
                    floatingContentLength: enhancedContent.floatingContent?.length || 0,
                    iframeContentLength: enhancedContent.iframeContent?.length || 0,
                    processedImages: enhancedContent.processedImages || 0,
                    extractionTime: enhancedContent.extractionTime || 0
                };

                // 🎯 [BUG-FIX-PRECO] Atualizar preços nno Enhanced Extractor (OCR/Floating)
                if (extractedData.cleanText) {
                    const enhancedPrices = extractPrices(extractedData.cleanText);
                    if (enhancedPrices.length > extractedData.price_detected.length) {
                        extractedData.price_detected = enhancedPrices;
                        logger.info(`💰 [ENHANCED] Preços atualizados via OCR/Dynamic: ${enhancedPrices.length} encontrados`);
                    }
                }

            } catch (enhancedError) {
                logger.warn(`⚠️ [ENHANCED] Enhanced extraction failed, continuing with basic: ${enhancedError.message}`);
                // Não interrompe o fluxo - continua com extração básica
            }
        }


        // Final processing
        try {
            if (extractedData.cleanText) extractedData.cleanText = uniqueLines(extractedData.cleanText);
            if (!extractedData.title && extractedData.cleanText) {
                const firstLine = extractedData.cleanText.split("\n").find(l => l && l.length > 10 && l.length < 150);
                if (firstLine) extractedData.title = firstLine.slice(0, 150);
            }
            if (!extractedData.summary && extractedData.cleanText) {
                const sents = extractedData.cleanText.split(/(?<=[.!?])\s+/).filter(Boolean);
                extractedData.summary = sents.slice(0, 3).join(". ").slice(0, 400) + (sents.length > 3 ? "..." : "");
            }
        } catch (procErr) {
            logger.warn("Final processing failed:", procErr.message || procErr);
        }

        extractedData.extractionTime = Date.now() - startTime;

        setCacheData(cacheKey, extractedData);
        logger.info(`Extraction completed for ${url} in ${extractedData.extractionTime}ms using ${extractedData.method}`);
        return extractedData;

    } catch (error) {
        analytics.failedExtractions++;
        logger.error(`Page extraction failed for ${url}:`, error.message || error);
        return {
            title: "",
            description: "",
            benefits: [],
            testimonials: [],
            cta: "",
            summary: "Erro ao extrair dados da página. Verifique se a URL está acessível.",
            cleanText: "",
            imagesText: [],
            url: url || "",
            extractionTime: Date.now() - startTime,
            method: "failed",
            error: error.message || String(error),
            bonuses_detected: [],
            price_detected: [],
            contatos: {
                telefone: [],
                whatsapp: [],
                email: [],
                site: [url],
                endereco: []
            }
        };
    }
}

// ===== LLM Integration =====
async function callGroq(messages, temperature = 0.4, maxTokens = 300) {
    if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY missing");

    const payload = {
        model: process.env.GROQ_MODEL || "llama-3.1-70b-versatile",
        messages,
        temperature,
        max_tokens: maxTokens
    };

    const url = process.env.GROQ_API_BASE || "https://api.groq.com/openai/v1/chat/completions";
    const headers = { "Authorization": `Bearer ${process.env.GROQ_API_KEY}`, "Content-Type": "application/json" };

    try {
        const response = await axios.post(url, payload, { headers });
        return response.data.choices[0].message.content;
    } catch (error) {
        logger.error("Groq API call failed:", error.response ? error.response.data : error.message);
        throw new Error("Failed to get response from Groq API");
    }
}

async function callOpenRouter(messages, temperature = 0.4, maxTokens = 300) {
    if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY missing");

    const payload = {
        model: process.env.OPENROUTER_MODEL || "mistralai/mistral-7b-instruct",
        messages,
        temperature,
        max_tokens: maxTokens
    };

    const url = process.env.OPENROUTER_API_BASE || "https://openrouter.ai/api/v1/chat/completions";
    const headers = { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" };

    try {
        const response = await axios.post(url, payload, { headers });
        return response.data.choices[0].message.content;
    } catch (error) {
        logger.error("OpenRouter API call failed:", error.response ? error.response.data : error.message);
        throw new Error("Failed to get response from OpenRouter API");
    }
}

async function callOpenAI(messages, temperature = 0.4, maxTokens = 300) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");

    const payload = {
        model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        messages,
        temperature,
        max_tokens: maxTokens
    };

    const url = process.env.OPENAI_API_BASE || "https://api.openai.com/v1/chat/completions";
    const headers = { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" };

    try {
        const response = await axios.post(url, payload, { headers });
        return response.data.choices[0].message.content;
    } catch (error) {
        logger.error("OpenAI API call failed:", error.response ? error.response.data : error.message);
        throw new Error("Failed to get response from OpenAI API");
    }
}

// ===== AI Response Generation =====
const NOT_FOUND_MSG = "Desculpe, não encontrei informações específicas sobre isso. Posso ajudar com outras dúvidas?";

function shouldActivateSalesMode(instructions) {
    if (!instructions) return false;
    const salesKeywords = /(venda|vendas|compra|comprar|adquirir|produto|oferta|promoção|desconto)/i;
    return salesKeywords.test(instructions);
}

/**
 * 🔒 FASE 2 BLINDADA — HELPERS DE CONVERSÃO DETERMINÍSTICA (V11.3.2)
 */

/**
 * Detecta intenção de compra com padrões expandidos e coloquiais
 * @param {string} message 
 * @returns {boolean}
 */
function detectBuyIntent(message = '') {
    const msg = String(message).toLowerCase();
    const patterns = [
        'comprar', 'compra', 'quero', 'fechar', 'garantir',
        'como faço', 'como funciona pagamento',
        'valor', 'preço', 'preco', 'quanto', 'custa',
        'link', 'checkout',
        'acesso', 'entrar', 'começar', 'liberar',
        'adquirir', 'assinar', 'pagamento', 'pagar', 'pago',
        'finalizar', 'inscrição', 'inscrever', 'garantir meu',
        'boleto', 'pix', 'cartão', 'cartao', 'parcelar', 'parcela',
        'investimento', 'investir', 'contratar', 'cadastrar',
        'compro', 'onde compro', 'como pago', 'como paga',
        'pode parcelar', 'formas de pagamento', 'aceita'
    ];
    return patterns.some(p => msg.includes(p));
}

/**
 * Validação robusta de presença de link na resposta
 * @param {string} response 
 * @param {string} checkout 
 * @returns {boolean}
 */
function hasValidCheckout(response, checkout) {
    if (!response || !checkout) return false;
    return response.includes(checkout.trim());
}

/**
 * Verifica se existe qualquer link válido na resposta
 * @param {string} text 
 * @returns {boolean}
 */
function hasAnyUrl(text) {
    if (!text) return false;
    return /(https?:\/\/[^\s]+)/g.test(text);
}

// ===== FUNÇÃO APRIMORADA DE RESPOSTA DA IA COM SUPERINTELIGÊNCIA =====
// 🎯 FEATURE_CLEAN_CHAT_V2: chatbotId adicionado para buscar FAQs da Knowledge Base
async function generateAIResponse(userMessage, pageData = {}, conversationHistory = [], instructions = "", leadId = null, apiKey = null, chatbotId = null) {
    const startTime = Date.now();
    try {
        if (!userMessage || !String(userMessage).trim()) {
            return NOT_FOUND_MSG;
        }

        // 🎯 CORREÇÃO: Limpar mensagem de caracteres especiais
        const cleanUserMessage = String(userMessage).replace(/<s>\s*\[OUT\]/g, '').replace(/<[^>]*>/g, '').replace(/\[.*?\]/g, '').trim();
        if (!cleanUserMessage) {
            return "Desculpe, não entendi sua mensagem. Poderia reformular?";
        }

        // ═══ V13.0.3: HARD SUPPORT OVERRIDE (TOPO ABSOLUTO — ANTES DE TUDO) ═══
        // Se usuário pede suporte/atendente → retorno IMEDIATO, sem IA, sem pipeline
        try {
            const _hardMsg = cleanUserMessage.toLowerCase();
            if (
                _hardMsg.includes('falar com algu') ||
                _hardMsg.includes('atendente') ||
                _hardMsg.includes('suporte') ||
                _hardMsg.includes('humano') ||
                _hardMsg.includes('pessoa real')
            ) {
                // Buscar WhatsApp em TODOS os locais possíveis do pageData
                const _hardWhatsApp = 
                    (pageData?.contatos?.whatsapp && pageData.contatos.whatsapp.length > 0 ? pageData.contatos.whatsapp[0] : null) ||
                    pageData?.whatsapp ||
                    pageData?.whatsappLink ||
                    (pageData?.contatos?.telefone && pageData.contatos.telefone.length > 0 ? pageData.contatos.telefone[0] : null) ||
                    null;
                
                const _hardWhatsAppUrl = _hardWhatsApp 
                    ? (_hardWhatsApp.startsWith('http') ? _hardWhatsApp : `https://wa.me/${_hardWhatsApp.replace(/\D/g, '')}`)
                    : null;

                const _hardResponse = _hardWhatsAppUrl
                    ? `Perfeito 👍 vou te conectar com um atendente agora.\n\n📞 Fale direto no WhatsApp:\n${_hardWhatsAppUrl}\n\nEles vão te ajudar rapidinho 🙌`
                    : `Perfeito 👍 nosso time está pronto para te atender.\n\nDigite sua dúvida aqui mesmo que vou te ajudar! 🙌`;
                console.log(`[V13-HARD-SUPPORT] 🚀 Interceptado | whatsapp=${_hardWhatsAppUrl || 'N/A'} | contatos=${JSON.stringify(pageData?.contatos || 'null').substring(0, 100)}`);
                return _hardResponse;
            }
        } catch (_hardErr) {
            console.warn('[V13-HARD-SUPPORT] Erro (continuando pipeline):', _hardErr.message);
        }

        // 🎯 SUPERINTELIGÊNCIA: Análise Avançada
        const userId = leadId || `user_${Date.now()}`;
        const estadoEmocional = superInteligenciaGlobal.analisarEstadoEmocional(cleanUserMessage);

        // 🎯 ATUALIZAR MEMÓRIA DO USUÁRIO
        superInteligenciaGlobal.atualizarMemoriaUsuario(userId, {
            mensagem: cleanUserMessage,
            emocao: estadoEmocional.emocaoPrimaria,
            intencoes: estadoEmocional.intencoesMultiplas
        });

        // 🎯 OBTER MEMÓRIA DO USUÁRIO
        const memoriaUsuario = superInteligenciaGlobal.memoriaConversacional.get(userId);

        // 🎯 ANÁLISE DA JORNADA DO CLIENTE
        const journeyStage = journeyAnalyzer.analyzeJourneyStage(cleanUserMessage);
        const shouldMentionBonus = journeyAnalyzer.shouldMentionBonus(journeyStage, cleanUserMessage);
        const excitementWord = journeyAnalyzer.getRandomSynonym('empolgação');

        // Atualizar estágio do lead se existir
        if (leadId) {
            const leadSystem = getLeadSystem(apiKey);
            leadSystem.updateLeadJourneyStage(leadId, journeyStage);
        }

        // 🎯 DETECÇÃO APRIMORADA DE BÔNUS
        let bonusInfo = "";
        if (pageData && pageData.bonuses_detected && pageData.bonuses_detected.length > 0 && shouldMentionBonus) {
            bonusInfo = `BÔNUS DETECTADOS: ${pageData.bonuses_detected.join(', ')}. `;
        }

        // 🎯 INFORMAÇÕES DE CONTATO
        let contactInfo = "";
        if (pageData && pageData.contatos) {
            const contatos = pageData.contatos;
            contactInfo = `INFORMAÇÕES DE CONTATO: `;

            if (contatos.telefone.length > 0) {
                contactInfo += `Telefones: ${contatos.telefone.slice(0, 2).join(', ')}. `;
            }
            if (contatos.whatsapp.length > 0) {
                contactInfo += `WhatsApp: ${contatos.whatsapp.slice(0, 2).join(', ')}. `;
            }
            if (contatos.email.length > 0) {
                contactInfo += `Emails: ${contatos.email.slice(0, 2).join(', ')}. `;
            }
            if (contatos.site.length > 0) {
                contactInfo += `Site: ${contatos.site[0]}. `;
            }
        }

        // 🎯 FEATURE_CLEAN_CHAT_V2: Buscar FAQs da Knowledge Base
        let faqDirectAnswer = null;
        let faqContext = "";
        const useCleanChat = process.env.FEATURE_CLEAN_CHAT_V2 === 'true' || (featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_CLEAN_CHAT_V2'));

        if (useCleanChat && chatbotId) {
            try {
                const kbResults = knowledgeBaseManager.search(chatbotId, cleanUserMessage, 3);
                if (kbResults && kbResults.length > 0) {
                    // Se FAQ com score alto → usar resposta direta
                    const bestMatch = kbResults[0];
                    if (bestMatch.type === 'faq' && bestMatch.score >= 3) {
                        faqDirectAnswer = bestMatch.data.answer;
                        console.log(`📚 [CLEAN_CHAT_V2] FAQ direta encontrada (score=${bestMatch.score}): ${bestMatch.data.question.substring(0, 50)}`);
                    } else {
                        // Score médio → incluir como contexto
                        faqContext = kbResults
                            .filter(r => r.type === 'faq')
                            .map(r => `P: ${r.data.question}\nR: ${r.data.answer}`)
                            .join('\n\n');
                        console.log(`📚 [CLEAN_CHAT_V2] ${kbResults.length} FAQ(s) como contexto`);
                    }
                }
            } catch (kbError) {
                console.warn(`⚠️ [CLEAN_CHAT_V2] Erro ao buscar KB (fallback para LLM):`, kbError.message || kbError);
            }
        }

        // Se encontrou FAQ com resposta direta, retornar sem chamar LLM
        if (useCleanChat && faqDirectAnswer) {
            const responseTime = Date.now() - startTime;
            console.log(`📚 [CLEAN_CHAT_V2] Resposta via FAQ direta em ${responseTime}ms`);
            logger.info(`AI response generated in ${responseTime}ms using faq-direct`);
            return faqDirectAnswer;
        }

        // 🎯 NOVO: INFORMAÇÕES DE PREÇO EXTRAÍDAS
        let priceInfo = "";
        if (pageData && pageData.price_detected && pageData.price_detected.length > 0) {
            priceInfo = `💰 PREÇOS DETECTADOS: ${pageData.price_detected.join(', ')}. `;
        }

        // 🎯 NOVO: CONTEÚDO COMPLETO DA PÁGINA (limite maior para informação completa)
        let pageContentSummary = "";
        if (pageData && pageData.cleanText) {
            const cleanTextLimited = pageData.cleanText.substring(0, 6000);
            pageContentSummary = cleanTextLimited;
        }

        // 🎯 NOVO: CONTEÚDO DA BASE DE CONHECIMENTO (FAQ e Documentos)
        let kbContext = "";
        try {
            if (apiKey) {
                console.log(`🔍 [KB DEBUG] Buscando contexto para apiKey: ${apiKey}`);
                kbContext = knowledgeBaseManager.compileContext(apiKey, 4000);
                console.log(`🔍 [KB DEBUG] Contexto retornado (${kbContext.length} chars): ${kbContext ? 'Sim' : 'Vazio'}`);
            } else {
                console.log(`⚠️ [KB DEBUG] Nenhuma apiKey disponível para busca na Knowledge Base`);
            }
        } catch (kbErr) {
            console.error("⚠️ Erro ao compilar contexto da Knowledge Base:", kbErr);
        }

        // 🎯 NOVO: Texto extraído de imagens (OCR)
        let ocrInfo = "";
        if (pageData && pageData.imagesText && pageData.imagesText.length > 0) {
            ocrInfo = `📸 TEXTO DE IMAGENS: ${pageData.imagesText.slice(0, 2).join(' | ')}`;
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🔥 [V11.3] CHECKOUT CONFIRMADO (PRIORIDADE MÁXIMA — ANTES de tudo)
        // Se o tenant já confirmou um checkout, ele TEM prioridade absoluta.
        // Protegido por FEATURE_V11_3_FALLBACK + try/catch
        // ═══════════════════════════════════════════════════════════════════
        try {
            const _v113Enabled = featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_V11_3_FALLBACK');
            if (_v113Enabled && _v113GetConfirmedCheckout && apiKey && pageData && !pageData.checkoutLink) {
                // FIX V12.1: Passar salesUrl para isolamento por URL (não só apiKey)
                const _v113SalesUrl = pageData.url || pageData.salesUrl || null;
                const _v113Confirmed = await _v113GetConfirmedCheckout(db, apiKey, _v113SalesUrl);
                if (_v113Confirmed) {
                    // FIX: getConfirmedCheckout já valida domínio internamente
                    // (permite user_confirmed com domínios custom)
                    // Validação dupla aqui bloqueava checkouts confirmados manualmente
                    pageData.checkoutLink = _v113Confirmed;
                    pageData._checkoutSource = 'v113_confirmed';
                    console.log(`[V11.3-AUDIT] ✅ Checkout CONFIRMADO do DB aplicado: tenant=${apiKey?.substring(0, 8)}... url=${_v113Confirmed.substring(0, 80)}`);
                }
            }
        } catch (_v113PreErr) {
            console.warn('[V11.3] ⚠️ Erro ao buscar checkout confirmado (sem impacto):', _v113PreErr.message);
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🔥 [V11] CHECKOUT DISCOVERY — Puppeteer (ANTES do pré-prompt)
        // Tenta descobrir checkout via navegação real se não houver checkoutLink
        // Protegido por FEATURE_V11_ENGINE + ENABLE_V11_DISCOVERY + try/catch
        // ═══════════════════════════════════════════════════════════════════
        try {
            const _v11Enabled = featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_V11_ENGINE');
            const _v11DiscoveryEnv = process.env.ENABLE_V11_DISCOVERY === 'true';
            if (_v11Enabled && _v11DiscoveryEnv && _v11DiscoverCheckout && pageData && !pageData.checkoutLink && pageData.url) {
                console.log('[V11] 🔍 Iniciando Checkout Discovery para:', (pageData.url || '').substring(0, 80));
                const _v11Detected = await _v11DiscoverCheckout(pageData.url);
                if (_v11Detected) {
                    pageData.checkoutLink = _v11Detected;
                    console.log('[V11] ✅ Checkout descoberto via Puppeteer:', _v11Detected.substring(0, 100));
                } else {
                    console.log('[V11] ℹ️ Nenhum checkout descoberto via Puppeteer');
                }
            }
        } catch (_v11DiscErr) {
            console.warn('[V11] ⚠️ Checkout Discovery erro (sem impacto):', _v11DiscErr.message);
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🔥 V11.2 RAG ENGINE — AUTO EXTRAÇÃO + CONHECIMENTO + CHECKOUT
        // Pipeline completo: Crawl → Extract → Knowledge → Checkout (3 níveis)
        // Ativo APENAS em modo automático. Não impacta manual/desligado.
        // Protegido por FEATURE_V11_2_RAG + try/catch total
        // ═══════════════════════════════════════════════════════════════════
        let _v112KnowledgeContext = '';
        let _v112LinksMap = null;

        try {
            const _v112SalesMode = (pageData && pageData.salesMode) || process.env.SALES_LAYER_MODE || 'auto';
            const _v112Enabled = featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_V11_2_RAG');

            // ISOLAMENTO: V11.2 SOMENTE ativa em modo automático
            if (_v112Enabled && _v112SalesMode === 'auto' && pageData && pageData.url) {
                console.log('[V11.2] 🚀 Pipeline RAG iniciando para:', (pageData.url || '').substring(0, 80));
                const _v112StartTime = Date.now();

                // ─── PASSO 1: Crawl do domínio (max 5 páginas) ───
                if (_v112CrawlDomain && _v112ExtractContent && _v112BuildKnowledge) {
                    const _v112Pages = await _v112CrawlDomain(pageData.url, 5);

                    if (_v112Pages && _v112Pages.length > 0) {
                        // ─── PASSO 2: Extrair conteúdo de cada página ───
                        const _v112Extracted = _v112Pages.map(p => ({
                            url: p.url,
                            ..._v112ExtractContent(p.html)
                        }));

                        // ─── PASSO 3: Construir base de conhecimento (RAG) ───
                        const _v112RawKnowledge = _v112BuildKnowledge(_v112Extracted);
                        if (_v112RawKnowledge && _v112FormatKnowledgeContext) {
                            _v112KnowledgeContext = _v112FormatKnowledgeContext(_v112RawKnowledge);
                        }

                        // ─── PASSO 4: Checkout Discovery PASSIVO (fallback por links) ───
                        if (!pageData.checkoutLink && _v112DetectCheckoutFromLinks) {
                            for (const page of _v112Extracted) {
                                if (page.links && page.links.length > 0) {
                                    const _v112FoundCheckout = _v112DetectCheckoutFromLinks(page.links);
                                    if (_v112FoundCheckout) {
                                        pageData.checkoutLink = _v112FoundCheckout;
                                        console.log('[V11.2] 🎯 Nível 2 — Checkout via links passivos:', _v112FoundCheckout.substring(0, 100));
                                        break;
                                    }
                                }
                            }
                        }
                        // ─── V13.2.1: PASSO 4.5 — CLASSIFICAR TODOS OS LINKS (auto-alimentação) ───
                        // Coleta todos os links de todas as páginas e classifica em primary/upsell/downsell
                        try {
                            if (_v13EnrichPageData && process.env.FEATURE_V13_MULTI_CHECKOUT === 'true') {
                                const _v132AllLinks = [];
                                for (const page of _v112Extracted) {
                                    if (page.links && Array.isArray(page.links)) {
                                        _v132AllLinks.push(...page.links);
                                    }
                                }
                                if (_v132AllLinks.length > 0) {
                                    _v13EnrichPageData(pageData, _v132AllLinks);
                                    console.log(`[V13.2.1] ✅ Auto-alimentação: ${_v132AllLinks.length} links analisados | upsells=${(pageData.upsells || []).length} | downsells=${(pageData.downsells || []).length}`);
                                }
                            }
                        } catch (_v132ClassErr) {
                            console.warn('[V13.2.1] ⚠️ Classificação falhou (sem impacto):', _v132ClassErr.message);
                        }

                        console.log(`[V11.2] ✅ RAG completo em ${Date.now() - _v112StartTime}ms | ${_v112Pages.length} páginas | knowledge=${_v112KnowledgeContext.length} chars | checkout=${pageData.checkoutLink ? 'SIM' : 'NÃO'}`);
                    } else {
                        console.log('[V11.2] ℹ️ Nenhuma página crawleada (URL pode ser inacessível)');
                    }
                }

                // ─── PASSO 5: ACTIVE CHECKOUT DISCOVERY — Clique automático (Nível 3) ───
                // Só ativa se AINDA não temos checkout após RAG + links passivos
                if (!pageData.checkoutLink && _v112ClickDiscovery && pageData.url) {
                    try {
                        console.log('[V11.2] 🖱️ Nível 3 — Iniciando Active Click Discovery...');
                        const _v112ClickResult = await _v112ClickDiscovery(pageData.url, {
                            timeout: 30000,
                            clickWait: 3000,
                            maxClicks: 3
                        });
                        if (_v112ClickResult) {
                            pageData.checkoutLink = _v112ClickResult;
                            console.log('[V11.2] 🔥 Nível 3 — Checkout via CLICK DISCOVERY:', _v112ClickResult.substring(0, 100));
                        } else {
                            console.log('[V11.2] ℹ️ Nível 3 — Nenhum checkout encontrado via clique');
                        }
                    } catch (_v112ClickErr) {
                        console.warn('[V11.2] ⚠️ Click Discovery erro (sem impacto):', _v112ClickErr.message);
                    }
                }

                // ─── PASSO 6: Construir Links Map V11 (fonte única) ───
                if (_v11BuildLinksMap) {
                    _v112LinksMap = _v11BuildLinksMap(pageData);
                    console.log(`[V11.2] 🔗 Links Map: checkout=${_v112LinksMap.checkout ? 'SIM' : 'NÃO'} | site=${_v112LinksMap.site ? 'SIM' : 'NÃO'}`);
                }

                console.log(`[V11.2] 🏁 Pipeline V11.2 COMPLETO em ${Date.now() - _v112StartTime}ms`);
            }
        } catch (_v112Err) {
            console.warn('[V11.2] ⚠️ Erro no pipeline RAG (sem impacto, fallback para fluxo existente):', _v112Err.message);
            _v112KnowledgeContext = '';
            _v112LinksMap = null;
        }

        // ─── V11.3: PERSISTIR checkout descoberto automaticamente ───
        try {
            const _v113PersistEnabled = featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_V11_3_FALLBACK');
            if (_v113PersistEnabled && _v113SaveCheckoutLink && apiKey && pageData && pageData.checkoutLink && pageData._checkoutSource !== 'v113_confirmed') {
                // 🔒 HOTFIX 11.3.1: Validar domínio antes de persistir
                const _v113PersistDomainOk = !_v113IsValidCheckoutDomain || _v113IsValidCheckoutDomain(pageData.checkoutLink);
                if (_v113PersistDomainOk) {
                    const _v113Source = pageData._checkoutSource || 'auto_v112';
                    // FIX V12.1: Passar salesUrl para isolamento por URL
                    const _v113PersistSalesUrl = pageData.url || pageData.salesUrl || null;
                    _v113SaveCheckoutLink(db, apiKey, pageData.checkoutLink, _v113Source, false, _v113PersistSalesUrl)
                        .then(saved => {
                            if (saved) console.log(`[V11.3-AUDIT] 💾 Checkout auto-persistido: tenant=${apiKey?.substring(0, 8)}... url=${pageData.checkoutLink.substring(0, 60)}`);
                        })
                        .catch(() => {}); // fire-and-forget, never blocks
                } else {
                    console.warn(`[V11.3-SECURITY] ⛔ Checkout NÃO persistido (domínio inválido): tenant=${apiKey?.substring(0, 8)}... url=${pageData.checkoutLink.substring(0, 60)}`);
                }
            }
        } catch (_v113PersistErr) {
            // Silencioso — persistencia é best-effort
        }

        // 🔗 [V9.3 CHECKOUT-PRE-PROMPT] Resolver checkout link ANTES da montagem do prompt
        // Se o pageData já tem checkoutLink (do widget ou extração server-side), mantém.
        // Senão, tenta resolver via link-resolver (configuração do tenant, env var, etc).
        // Protegido por feature flag + try/catch — zero impacto se falhar.
        try {
            const _ckPreEnabled = !featureFlags || !featureFlags.isEnabled || featureFlags.isEnabled('FEATURE_AUTO_CHECKOUT_DETECTION');
            if (_ckPreEnabled && pageData && !pageData.checkoutLink) {
                const _resolved = typeof resolveCheckoutLink === 'function' 
                    ? resolveCheckoutLink({ context: pageData, tenantConfig: null }) 
                    : null;
                if (_resolved) {
                    pageData.checkoutLink = _resolved;
                    console.log('[CHECKOUT-PRE-PROMPT] ✅ Link resolvido antes do prompt:', _resolved.substring(0, 80));
                }
            }
        } catch (_ckPreErr) { console.warn('[CHECKOUT-PRE-PROMPT] Erro (sem impacto):', _ckPreErr.message); }

        // ═══════════════════════════════════════════════════════════════════
        // 🔥 V13 — PIPELINE BLINDADO (EARLY RETURN)
        // Se FEATURE_V13_BLINDADO ativo + modo auto → V13 assume controle TOTAL
        // Se flag off ou modo manual/off → fluxo legado V0-V12 continua abaixo
        // Protegido por try/catch — qualquer falha → fallback para legado
        // ═══════════════════════════════════════════════════════════════════
        try {
            // V13.0.3: Verificação dupla — FeatureFlags OU env var direta
            const _v13FlagFromManager = featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_V13_BLINDADO');
            const _v13FlagFromEnv = process.env.FEATURE_V13_BLINDADO === 'true';
            const _v13FlagEnabled = _v13FlagFromManager || _v13FlagFromEnv;
            
            console.log(`[V13-DEBUG] FLAG: manager=${_v13FlagFromManager} | env=${_v13FlagFromEnv} | final=${_v13FlagEnabled}`);

            const _v13SalesMode = (pageData && pageData.salesMode) || process.env.SALES_LAYER_MODE || 'auto';
            const _v13AllModulesReady = _v13ClassifyIntent && _v13StateManager && _v13DecideAction && _v13BuildBlindadoPrompt && _v13ValidateResponse;

            if (_v13FlagEnabled && _v13SalesMode === 'auto' && _v13AllModulesReady) {
                console.log(`[V13] 🔥 Pipeline Blindado ATIVADO | tenant=${apiKey?.substring(0, 8)}...`);
                const _v13Start = Date.now();
                let _v13Used = false;

                // ─── PASSO 1: INTENT CLASSIFIER (determinístico, zero IA) ───
                const _v13Intent = _v13ClassifyIntent(cleanUserMessage);
                console.log(`[V13] 🧩 1/6 Intent: ${_v13Intent.intent} (conf=${_v13Intent.confidence}) | pattern=${_v13Intent.matchedPattern}`);

                // ─── PASSO 2: STATE MANAGER (score + máquina de estados) ───
                const _v13ConvId = (pageData && pageData.conversationId) || leadId || `v13_${Date.now()}`;
                const _v13StateResult = _v13StateManager.updateState(_v13ConvId, _v13Intent.intent, cleanUserMessage);
                console.log(`[V13] 🧩 2/6 State: ${_v13StateResult.stage} (score=${_v13StateResult.score}) ${_v13StateResult.transition ? '⚡ ' + _v13StateResult.transition : ''}`);

                // ─── PASSO 3: RULE ENGINE (hard rules → ação) ───
                const _v13Action = _v13DecideAction(_v13Intent.intent, _v13StateResult, {
                    checkoutLink: pageData.checkoutLink || null,
                    productName: pageData.title || ''
                });
                console.log(`[V13] 🧩 3/6 Action: ${_v13Action.action} | reason=${_v13Action.reason} | sendCheckout=${_v13Action.sendCheckout}`);

                // ─── V13.0.3: SUPPORT INTERCEPT (EARLY RETURN — SEM IA, SEM CHECKOUT) ───
                if (_v13Action.action === 'SUPPORT') {
                    console.log('[V13.0.3] 🚀 SUPPORT INTERCEPT — retorno direto');
                    const _v13WhatsApp = pageData.whatsapp || pageData.whatsappLink || null;
                    const _v13SupportResponse = _v13WhatsApp
                        ? `Perfeito 👍 vou te conectar com um atendente agora.\n\n📞 Fale direto no WhatsApp:\n${_v13WhatsApp}\n\nEles vão te ajudar rapidinho 🙌`
                        : `Perfeito 👍 nosso time está pronto para te atender agora. Fale com a gente! 🙌`;
                    
                    const _v13Elapsed = Date.now() - _v13Start;
                    console.log(`[V13] ✅ SUPPORT finalizado em ${_v13Elapsed}ms (interceptado)`);
                    
                    aiResponseText = _v13SupportResponse;
                    // Pular todo o resto do pipeline (IA, checkout, etc)
                    // O fluxo continua após o bloco V13 com aiResponseText já preenchido
                    _v13Used = true;
                }

                // ─── PASSO 3.5: PRÉ-CONFIRMAÇÃO (se necessário) ───
                if (_v13Action.action === 'CONFIRM_BEFORE_CHECKOUT') {
                    _v13StateManager.markCheckoutConfirmed(_v13ConvId);
                }

                // ─── V13.0.2: PASSO 4 — RESPONSE BUILDER (Sistema monta base) ───
                // Se V13.0.2 disponível: sistema → base → IA humaniza
                // Se não: fallback para V13.0.0 (prompt blindado direto)
                
                let _v13FinalResponse = '';
                const _v13HasBuilder = _v13BuildBaseResponse && _v13ApplyPostGuards;

                if (_v13Used) {
                    // V13.0.3: SUPPORT já interceptou — pular pipeline inteiro
                    _v13FinalResponse = aiResponseText;
                    console.log('[V13.0.3] ⏭️ Pipeline pulado (SUPPORT já processado)');
                } else if (_v13HasBuilder) {
                    // ═══ V13.0.2 — SISTEMA → BASE → IA HUMANIZA ═══
                    console.log('[V13.0.2] 🔥 Response Builder ativo — sistema monta, IA humaniza');

                    const _v13Base = _v13BuildBaseResponse(_v13Action.action, {
                        checkoutLink: pageData.checkoutLink || null,
                        productName: pageData.title || '',
                        productDescription: (pageData.resumo || pageData.description || '').substring(0, 300),
                        whatsappLink: (pageData.contatos && pageData.contatos.whatsapp && pageData.contatos.whatsapp[0]) || pageData.whatsapp || null,
                        price: null,  // Nunca passar preço — sistema não informa preço à IA
                        guarantee: pageData.garantia || pageData.guarantee || null,
                        benefits: pageData.beneficios || pageData.benefits || null,
                        userMessage: cleanUserMessage
                    });

                    console.log(`[V13.0.2] 🧩 4a/7 Base: type=${_v13Base.type} | text=${_v13Base.baseText.substring(0, 60)}... | lockCheckout=${_v13Base.meta?.lockCheckout || false}`);

                    // ─── V13.1: PASSO 5 — IA HUMANIZA (prompt especializado) ───
                    let _v13Humanized = _v13Base.baseText;

                    if (_v13Base.humanizePrompt || _v13Base.baseText) {
                        try {
                            // V13.1: Usar humanizer dedicado se disponível
                            let _v13HumanizeSystemPrompt = _v13Base.humanizePrompt;
                            
                            if (_v13BuildHumanizerPrompt) {
                                _v13HumanizeSystemPrompt = _v13BuildHumanizerPrompt(_v13Base.baseText, {
                                    intent: _v13Intent.intent,
                                    action: _v13Action.action,
                                    productName: pageData.title || '',
                                    stage: _v13StateResult.stage || 'COLD'
                                });
                                console.log('[V13.1] 🎭 Humanizer V13.1 ativo — tom WhatsApp');
                            }

                            if (_v13HumanizeSystemPrompt) {
                                const _v13HumanizeMessages = [
                                    { role: 'system', content: _v13HumanizeSystemPrompt },
                                    ...(Array.isArray(conversationHistory) ? conversationHistory.slice(-4) : []),
                                    { role: 'user', content: cleanUserMessage }
                                ];

                                // V13.1: temperatura 0.7 para humanização mais natural
                                const _v13HumanTemp = 0.7;
                                const _v13HumanMaxTokens = 120;

                                if (process.env.GROQ_API_KEY) {
                                    _v13Humanized = await callGroq(_v13HumanizeMessages, _v13HumanTemp, _v13HumanMaxTokens);
                                } else if (process.env.OPENROUTER_API_KEY) {
                                    _v13Humanized = await callOpenRouter(_v13HumanizeMessages, _v13HumanTemp, _v13HumanMaxTokens);
                                } else if (process.env.OPENAI_API_KEY) {
                                    _v13Humanized = await callOpenAI(_v13HumanizeMessages, _v13HumanTemp, _v13HumanMaxTokens);
                                }

                                console.log(`[V13.1] 🧩 5/7 Humanize: ${_v13Humanized.length} chars | temp=0.7`);

                                // V13.1: Validar resposta humanizada (anti-alucinação pós-IA)
                                if (_v13ValidateHumanized) {
                                    const _v13HumanValid = _v13ValidateHumanized(_v13Humanized, _v13Base.baseText, {
                                        allowPrice: false
                                    });
                                    if (!_v13HumanValid.valid) {
                                        console.warn(`[V13.1-GUARD] ⛔ Humanização rejeitada: ${_v13HumanValid.issues.join(', ')} → usando base`);
                                        _v13Humanized = _v13HumanValid.response; // fallback para base
                                    } else if (_v13HumanValid.issues.length > 0) {
                                        console.warn(`[V13.1-GUARD] ⚠️ Avisos: ${_v13HumanValid.issues.join(', ')}`);
                                        _v13Humanized = _v13HumanValid.response;
                                    }
                                }
                            }
                        } catch (_v13HumanErr) {
                            console.warn('[V13.1] ⚠️ Humanize falhou, usando base crua:', _v13HumanErr.message);
                            _v13Humanized = _v13Base.baseText;
                        }
                    } else {
                        console.log('[V13.1] 🧩 5/7 Humanize: ⏭️ Não necessário (texto final)');
                    }

                    // ─── V13.0.2: PASSO 6 — POST-GUARDS (travas estruturais) ───
                    _v13FinalResponse = _v13ApplyPostGuards(_v13Humanized, _v13Base.meta, {
                        checkoutLink: pageData.checkoutLink || null,
                        whatsappLink: pageData.whatsapp || null,
                        baseText: _v13Base.baseText
                    });

                    console.log(`[V13.1] 🧩 6/7 PostGuards: ✅ Aplicados | ${_v13FinalResponse.length} chars`);

                } else {
                    // ═══ FALLBACK V13.0.0 — Prompt Blindado direto ═══
                    console.log('[V13] ℹ️ Response Builder não disponível, usando V13.0.0 (prompt blindado)');

                    const _v13Prompt = _v13BuildBlindadoPrompt({
                        action: _v13Action.action,
                        intent: _v13Intent.intent,
                        pageData: pageData,
                        userInstructions: instructions || ''
                    });

                    const _v13Limits = _v13GetLLMHardLimits ? _v13GetLLMHardLimits() : { max_tokens: 150, temperature: 0.3 };
                    const _v13Messages = [
                        { role: 'system', content: _v13Prompt },
                        ...(Array.isArray(conversationHistory) ? conversationHistory.slice(-6) : []),
                        { role: 'user', content: cleanUserMessage }
                    ];

                    let _v13RawResponse = '';
                    try {
                        if (process.env.GROQ_API_KEY) {
                            _v13RawResponse = await callGroq(_v13Messages, _v13Limits.temperature, _v13Limits.max_tokens);
                        } else if (process.env.OPENROUTER_API_KEY) {
                            _v13RawResponse = await callOpenRouter(_v13Messages, _v13Limits.temperature, _v13Limits.max_tokens);
                        } else if (process.env.OPENAI_API_KEY) {
                            _v13RawResponse = await callOpenAI(_v13Messages, _v13Limits.temperature, _v13Limits.max_tokens);
                        }
                    } catch (_v13LLMErr) {
                        console.warn('[V13] ⚠️ LLM falhou:', _v13LLMErr.message);
                        _v13RawResponse = 'Me diga exatamente o que você quer saber.';
                    }

                    console.log(`[V13] 🧩 4/6 LLM: ${_v13RawResponse.length} chars`);

                    const _v13Validated = _v13ValidateResponse(_v13RawResponse, {
                        productName: pageData.title || '',
                        checkoutLink: pageData.checkoutLink || '',
                        action: _v13Action.action
                    });

                    _v13FinalResponse = _v13Validated.response;
                    if (_v13Validated.issues.length > 0) {
                        console.warn(`[V13] 🧩 5/6 Validator: ${_v13Validated.issues.join(', ')}`);
                    }
                }

                // ─── V13.2: PASSO 7 — MULTI-CHECKOUT ENGINE (FORA DA IA, SEMPRE POR ÚLTIMO) ───
                // Se V13.2 ativo: resolve checkout via multi-engine (primary/upsell/downsell)
                // Se não: fallback para checkout principal (V13.0 comportamento original)
                try {
                    const _v132Enabled = process.env.FEATURE_V13_MULTI_CHECKOUT === 'true';
                    let _v13FinalCheckoutUrl = pageData.checkoutLink || null;
                    let _v13FinalCheckoutLabel = 'FINALIZAR COMPRA';
                    let _v13CheckoutType = 'primary';

                    if (_v132Enabled && _v13ResolveCheckout && _v13Action.sendCheckout && _v13FinalCheckoutUrl) {
                        // V13.2: Multi-Checkout resolve qual link enviar
                        const _v13ObjType = _v13DetectObjectionType ? _v13DetectObjectionType(cleanUserMessage) : null;

                        const _v132Result = _v13ResolveCheckout({
                            action: _v13Action.action,
                            intent: _v13Intent.intent,
                            stage: _v13StateResult.stage || 'COLD',
                            baseCheckout: _v13FinalCheckoutUrl,
                            context: {
                                upsells: pageData.upsells || [],
                                downsells: pageData.downsells || [],
                                objectionType: _v13ObjType,
                                messageCount: _v13StateResult.messageCount || 0,
                                checkoutAlreadySent: _v13StateResult.checkoutSent || false
                            }
                        });

                        if (_v132Result && _v132Result.url) {
                            _v13FinalCheckoutUrl = _v132Result.url;
                            _v13FinalCheckoutLabel = _v132Result.label || 'FINALIZAR COMPRA';
                            _v13CheckoutType = _v132Result.type || 'primary';
                            console.log(`[V13.2] 🎯 Multi-Checkout: type=${_v13CheckoutType} | reason=${_v132Result.reason} | url=${_v13FinalCheckoutUrl.substring(0, 60)}`);
                        }
                    }
                    // V13.2.2: Guard blockCheckout (ex: SUPPORT nunca recebe checkout)
                    const _v13BlockCheckout = _v13Action.blockCheckout || (_v13Base && _v13Base.meta && _v13Base.meta.blockCheckout);

                    // Injetar checkout (sempre por último, sempre fora da IA)
                    if (_v13Action.sendCheckout && _v13FinalCheckoutUrl && !_v13BlockCheckout) {
                        // V13.2.2: Anti-duplicação — se já tem checkout na resposta, não injeta
                        if (_v13FinalResponse.includes('FINALIZAR COMPRA') || _v13FinalResponse.includes('━━━━━━━━━')) {
                            console.log('[V13.2.2-GUARD] ⚠️ Checkout já presente na resposta — evitando duplicação');
                        } else {
                            _v13FinalResponse += `\n\n━━━━━━━━━━━━━━━━━━━\n🚀 ${_v13FinalCheckoutLabel}\n${_v13FinalCheckoutUrl}\n━━━━━━━━━━━━━━━━━━━`;
                            _v13StateManager.markCheckoutSent(_v13ConvId);
                            console.log(`[V13] 🧩 7/7 Checkout: ✅ INJETADO (${_v13CheckoutType}) | ${_v13FinalCheckoutUrl.substring(0, 60)}`);

                            // Auto-persistir checkout no DB
                            try {
                                const _v13SalesUrl = pageData.url || pageData.salesUrl || null;
                                if (_v13SalesUrl && _v113SaveCheckoutLink && apiKey) {
                                    _v113SaveCheckoutLink(db, apiKey, _v13FinalCheckoutUrl, `auto_v13_${_v13CheckoutType}`, false, _v13SalesUrl)
                                        .then(saved => {
                                            if (saved) console.log(`[V13] 💾 Checkout auto-persistido (${_v13CheckoutType}): ${_v13FinalCheckoutUrl.substring(0, 60)}`);
                                        })
                                        .catch(() => {});
                                }
                            } catch (_) {}
                        }
                    } else if (_v13BlockCheckout) {
                        console.log(`[V13.2.2] 🚫 Checkout BLOQUEADO (action=${_v13Action.action} | blockCheckout=true)`);
                    } else if (_v13Action.sendCheckout && !_v13FinalCheckoutUrl) {
                        console.warn(`[V13] 🧩 7/7 Checkout: ⚠️ Ação pede checkout mas não há link disponível`);
                    } else {
                        console.log(`[V13] 🧩 7/7 Checkout: ⏸️ Não aplicável (action=${_v13Action.action})`);
                    }
                } catch (_v132Err) {
                    console.warn('[V13.2] ⚠️ Multi-Checkout erro (fallback para checkout original):', _v132Err.message);
                    // Fallback: injetar checkout principal se ação pede
                    if (_v13Action.sendCheckout && pageData.checkoutLink) {
                        _v13FinalResponse += `\n\n━━━━━━━━━━━━━━━━━━━\n🚀 FINALIZAR COMPRA\n${pageData.checkoutLink}\n━━━━━━━━━━━━━━━━━━━`;
                        _v13StateManager.markCheckoutSent(_v13ConvId);
                    }
                }

                const _v13Elapsed = Date.now() - _v13Start;
                console.log(`[V13] 🏁 Pipeline completo em ${_v13Elapsed}ms | intent=${_v13Intent.intent} | state=${_v13StateResult.stage} | action=${_v13Action.action} | response=${_v13FinalResponse.length} chars`);

                // Registrar uso no billing
                const responseTime = Date.now() - startTime;
                logger.info(`AI response generated in ${responseTime}ms using v13-blindado`);

                // ═══ V14.0: CONVERSATION LOGGER (fire-and-forget, NUNCA bloqueia) ═══
                try {
                    const _v14FlagOn = process.env.FEATURE_V14_SELF_OPTIMIZING === 'true' ||
                        (featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_V14_SELF_OPTIMIZING'));
                    
                    if (_v14FlagOn && _v14Logger && _v14Logger.logConversation && db) {
                        const _v14HadCheckout = _v13FinalResponse.includes('FINALIZAR COMPRA') || _v13Action.sendCheckout;
                        _v14Logger.logConversation(db, {
                            apiKey,
                            conversationId: _v13ConvId,
                            userMessage: cleanUserMessage,
                            aiResponse: _v13FinalResponse,
                            intent: _v13Intent.intent,
                            action: _v13Action.action,
                            stage: _v13StateResult.stage,
                            hadCheckout: _v14HadCheckout,
                            checkoutType: _v14HadCheckout ? (_v13Action.action === 'TRIGGER_CHECKOUT' ? 'direct' : 'injected') : null,
                            responseTimeMs: responseTime,
                            v13Pipeline: true
                        }).catch(() => {}); // fire-and-forget
                    }
                } catch (_v14LogErr) {
                    // Silencioso — logger NUNCA impacta resposta
                }

                return _v13FinalResponse;
            }
        } catch (_v13Err) {
            // FALLBACK TOTAL — se V13 falhar, fluxo legado V0-V12 executa normalmente
            console.warn('[V13] ⚠️ Pipeline Blindado falhou (fallback para legado):', _v13Err.message);
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🧠 PROMPT UNIVERSAL — Link Mágico (FEATURE_UNIVERSAL_PROMPT)
        // Ordem obrigatória:
        //   AUTO:   FULL PROMPT → DECISION → AUTO-INSTRUCTIONS → CONTEXTO
        //   MANUAL: LIGHT PROMPT → USER INSTRUCTIONS → CONTEXTO
        //   OFF:    CONTEXTO (sem prompt de vendas)
        // ═══════════════════════════════════════════════════════════════════

        const _useUniversalPrompt = process.env.FEATURE_UNIVERSAL_PROMPT !== 'false' &&
            (!featureFlags || typeof featureFlags.isEnabled !== 'function' || featureFlags.isEnabled('FEATURE_UNIVERSAL_PROMPT'));

        let systemPrompt;

        if (_useUniversalPrompt) {
            // ─── Determinar salesMode da requisição ───
            const _promptSalesMode = (pageData && pageData.salesMode) || process.env.SALES_LAYER_MODE || 'auto';

            // ─── BLOCO 1 — PROMPT UNIVERSAL FULL (modo auto) ───
            const PROMPT_UNIVERSAL_FULL = `Você é um vendedor consultivo de alta performance.

Seu objetivo:
- Entender o usuário
- Responder com clareza
- Conduzir até a ação (compra, clique, contato)

REGRA ABSOLUTA (ANTI-DRIFT):
Você opera dentro de UM único contexto.
- Existe apenas UM produto
- Existe apenas UMA oferta
- Existe apenas UM objetivo
PROIBIDO: misturar produtos, inventar informações, fugir do contexto da página.
Se faltar informação: simplifique. NUNCA invente.

COMPORTAMENTO:
- Natural, humano, direto
- Sem linguagem robótica
- Sem enrolação
- Sempre com intenção de avanço

ESTRATÉGIA POR INTENÇÃO:
DÚVIDA → explicar simples, reduzir complexidade, usar exemplo prático
INTERESSE → reforçar benefício, mostrar valor, conduzir
OBJEÇÃO → quebrar com lógica + segurança, usar prova / garantia
COMPRA → parar de explicar, CTA direto
SAÍDA → segurar com curiosidade, mostrar algo que ele não viu

ANTI-GENÉRICO:
PROIBIDO: "ótima pergunta", respostas vagas, respostas padrão
OBRIGATÓRIO: ser específico, responder direto

ANTI-REPETIÇÃO:
- Nunca repetir CTA igual
- Variar linguagem
- Não repetir frases

REGRA CRÍTICA DE CONVERSÃO:
Se o usuário demonstrar qualquer interesse em preço, pagamento, compra, acesso ou inscrição:
- VOCÊ DEVE obrigatoriamente incluir o link de checkout fornecido.
- NUNCA omita o link nesses casos.
- NUNCA substitua por explicações genéricas.
- NUNCA redirecione para página de vendas.
Se existir checkoutLink → ele é a ação principal e deve estar na resposta.

ADAPTAÇÃO:
Leigo → simples
Avançado → direto

CONTROLE DE QUALIDADE (antes de responder):
- Está dentro do contexto?
- Resolve a dúvida?
- Move a conversa?
Se não → corrija.

REGRA FINAL:
Cada resposta deve: 1) Resolver 2) Avançar 3) Aproximar da conversão

NUNCA inclua tags HTML como <s> [OUT] ou qualquer marcação.
Responda sempre em português do Brasil.`;

            // ─── BLOCO 2 — PROMPT UNIVERSAL LIGHT (modo manual) ───
            const PROMPT_UNIVERSAL_LIGHT = `Você é um assistente que respeita totalmente as instruções do usuário.

REGRA PRINCIPAL:
O usuário define o comportamento. Você NÃO deve sobrescrever isso.

FUNÇÃO:
- Evitar respostas incorretas
- Manter coerência
- Garantir clareza

PROIBIDO:
- Forçar venda
- Inserir CTA agressivo
- Mudar estratégia definida pelo usuário

PERMITIDO:
- Melhorar clareza
- Corrigir incoerências
- Manter contexto correto

ANTI-DRIFT:
- Nunca inventar informações
- Nunca sair do contexto da página
- Nunca misturar produtos

ESTILO:
- Natural
- Objetivo
- Sem exagero

REGRA FINAL:
Responder exatamente o que o usuário precisa SEM interferir na estratégia definida por ele.

NUNCA inclua tags HTML como <s> [OUT] ou qualquer marcação.
Responda sempre em português do Brasil.`;

            // ─── BLOCO 3 — CONTEXTO SCRAPING (comum a todos os modos) ───
            const _scrapedContext = `
CONTEXTO DA PÁGINA:
Título: ${pageData.title || 'Não disponível'}
Descrição: ${pageData.description || 'Não disponível'}
${priceInfo ? priceInfo : ''}
${bonusInfo ? bonusInfo : ''}
${contactInfo ? contactInfo : ''}
${ocrInfo ? ocrInfo : ''}
URL da página: ${pageData.url || 'Não disponível'}
${pageData.checkoutLink ? `🔗🔗🔗 LINK DE CHECKOUT/COMPRA (USE ESTE PARA VENDA): ${pageData.checkoutLink}
⚠️ REGRA OBRIGATÓRIA: Quando o cliente quiser comprar ou pedir link de pagamento, use EXCLUSIVAMENTE o link acima. A URL da página NÃO é link de pagamento.` : ''}

CONTEÚDO DO PRODUTO/SERVIÇO:
${pageContentSummary || 'Conteúdo não disponível'}

CONHECIMENTO ESPECÍFICO (BASE DE CONHECIMENTO):
${kbContext || 'Nenhum dado específico cadastrado na base de conhecimento.'}
${faqContext ? '\nINFORMAÇÕES FAQ:\n' + faqContext : ''}`;

            // ─── BLOCO 4 — DECISION ENGINE (modo auto only) ───
            let _decisionContextStr = '';
            if (_promptSalesMode === 'auto') {
                try {
                    const _deActive = process.env.FEATURE_DECISION_ENGINE !== 'false' &&
                        (!featureFlags || typeof featureFlags.isEnabled !== 'function' || featureFlags.isEnabled('FEATURE_DECISION_ENGINE'));

                    if (_deActive) {
                        const _msgCount = (Array.isArray(conversationHistory) ? conversationHistory.length : 0) + 1;
                        const _convId   = (pageData && pageData.conversationId) || null;
                        let _promptDecision = null;

                        // Tentar V2 primeiro
                        const _v2Active = process.env.FEATURE_DECISION_ENGINE_V2 === 'true' ||
                            (featureFlags && typeof featureFlags.isEnabled === 'function' && featureFlags.isEnabled('FEATURE_DECISION_ENGINE_V2'));

                        if (_v2Active && _decideStrategyV2) {
                            try {
                                _promptDecision = _decideStrategyV2({
                                    userMessage:         cleanUserMessage || '',
                                    journeyStage:        journeyStage,
                                    messageCount:        _msgCount,
                                    conversationId:      _convId,
                                    extractedData:       pageData || {},
                                    conversationHistory: conversationHistory || []
                                });
                            } catch (_v2Err) {
                                console.warn('⚠️ [UNIVERSAL-PROMPT] Decision Engine V2 erro (fallback V1):', _v2Err.message);
                                _promptDecision = null;
                            }
                        }

                        // Fallback V1
                        if (!_promptDecision && _decideStrategy) {
                            try {
                                _promptDecision = _decideStrategy({
                                    userMessage:    cleanUserMessage || '',
                                    journeyStage:   journeyStage,
                                    messageCount:   _msgCount,
                                    conversationId: _convId,
                                    extractedData:  pageData || {}
                                });
                            } catch (_v1Err) {
                                console.warn('⚠️ [UNIVERSAL-PROMPT] Decision Engine V1 erro:', _v1Err.message);
                                _promptDecision = null;
                            }
                        }

                        // Formatar decisão como string para o prompt
                        if (_promptDecision) {
                            _decisionContextStr = `
DECISÃO ESTRATÉGICA (automática):
- Intenção detectada: ${_promptDecision.intent || 'indefinida'}
- Ação recomendada: ${_promptDecision.action || _promptDecision.strategy || 'educar'}
- Urgência: ${_promptDecision.urgency || _promptDecision.pressure || 'low'}
- Próximo passo: ${_promptDecision.nextStep || 'pergunta'}
${_promptDecision.context && _promptDecision.context.benefit ? '- Benefício-chave: ' + _promptDecision.context.benefit : ''}
${_promptDecision.context && _promptDecision.context.price ? '- Preço detectado: ' + _promptDecision.context.price : ''}
${_promptDecision.context && _promptDecision.context.productName ? '- Produto: ' + _promptDecision.context.productName : ''}
USE estas informações para calibrar sua resposta: se ação=fechar → CTA direto. Se ação=educar → explicar. Se ação=quebrar_objecao → usar prova/garantia. Se ação=reengajar → curiosidade.`;

                            console.log(`🧠 [UNIVERSAL-PROMPT] Decision Engine: intent=${_promptDecision.intent} action=${_promptDecision.action || _promptDecision.strategy} urgency=${_promptDecision.urgency || _promptDecision.pressure}`);
                        }
                    }
                } catch (_deErr) {
                    console.warn('⚠️ [UNIVERSAL-PROMPT] Erro geral no Decision Engine (prompt sem decisão):', _deErr.message);
                    _decisionContextStr = '';
                }
            }

            // ─── BLOCO 5 — AUTO-INSTRUCTIONS (Prompt 3 — geração dinâmica por URL) ───
            let _autoInstructions = '';
            const _autoInstructionsActive = _promptSalesMode === 'auto' &&
                process.env.FEATURE_AUTO_INSTRUCTIONS !== 'false' &&
                (!featureFlags || typeof featureFlags.isEnabled !== 'function' || featureFlags.isEnabled('FEATURE_AUTO_INSTRUCTIONS'));

            if (_autoInstructionsActive && _autoInstructionsGenerator) {
                try {
                    // Função wrapper para chamar LLM (mesma chain: Groq → OpenRouter → OpenAI)
                    const _callLLMForInstructions = async (messages, temperature, maxTokens) => {
                        if (process.env.GROQ_API_KEY) {
                            try { return await callGroq(messages, temperature, maxTokens); } catch (_) {}
                        }
                        if (process.env.OPENROUTER_API_KEY) {
                            try { return await callOpenRouter(messages, temperature, maxTokens); } catch (_) {}
                        }
                        if (process.env.OPENAI_API_KEY) {
                            try { return await callOpenAI(messages, temperature, maxTokens); } catch (_) {}
                        }
                        throw new Error('Nenhum provider LLM disponível');
                    };

                    _autoInstructions = await _autoInstructionsGenerator(pageData, _callLLMForInstructions);
                    if (_autoInstructions) {
                        console.log(`⚡ [AUTO-INSTRUCTIONS] Instruções geradas (${_autoInstructions.length} chars)`);
                    }
                } catch (_aiErr) {
                    console.warn('⚠️ [AUTO-INSTRUCTIONS] Erro na geração (prompt sem auto-instruções):', _aiErr.message);
                    _autoInstructions = '';
                }
            }

            // ─── 🔒 CONTEXT LOCK + 🧠 BEHAVIOR ENGINE V2 (modo auto only) ───
            let _contextLockBlock = '';
            let _contextHierarchyBlock = '';
            let _behaviorV2Block = '';
            let _contextStateBlock = '';
            let _antiContradictionBlock = '';

            if (FEATURE_CONTEXT_LOCK && _promptSalesMode === 'auto') {
                try {
                    // 🔒 Context Lock — Identidade fixa do produto
                    if (_contextLock) {
                        const _identity = _contextLock.extractContextIdentity(pageData);
                        _contextLockBlock = _contextLock.buildContextLockBlock(_identity);
                        _contextHierarchyBlock = _contextLock.buildContextHierarchyBlock();
                        _antiContradictionBlock = _contextLock.buildAntiContradictionBlock();

                        // 🧠 Estado do usuário
                        const _userState = _contextLock.detectUserState(cleanUserMessage);
                        _contextStateBlock = _contextLock.buildContextStateBlock(_userState);

                        console.log(`🔒 [CONTEXT-LOCK] Ativado | Produto=${_identity.productName ? _identity.productName.substring(0, 40) : 'N/A'} | Estado=${_userState} | Confiança=${Math.round(_identity.confidence * 100)}%`);
                    }

                    // 🧠 Behavior Engine V2 — Motor de conversão ativo
                    if (_behaviorEngineV2) {
                        _behaviorV2Block = _behaviorEngineV2.getBehaviorEngineV2();
                        console.log(`🧠 [BEHAVIOR-ENGINE-V2] Ativado (${_behaviorV2Block.length} chars)`);
                    }
                } catch (_clErr) {
                    console.warn('⚠️ [CONTEXT-LOCK] Erro geral (fallback sem context lock):', _clErr.message);
                    _contextLockBlock = '';
                    _contextHierarchyBlock = '';
                    _behaviorV2Block = '';
                    _contextStateBlock = '';
                    _antiContradictionBlock = '';
                }
            }

            // ─── MONTAGEM FINAL DO SYSTEM PROMPT POR MODO ───
            if (_promptSalesMode === 'auto') {
                // ORDEM OTIMIZADA (V11.2 FINAL):
                // 1. FULL PROMPT (quem sou)
                // 2. CONTEXT LOCK (identidade do produto — CRÍTICO primeiro)
                // 3. HIERARCHY (prioridade de contexto)
                // 4. BEHAVIOR ENGINE V2 (como me comporto)
                // 5. STATE (estado do usuário)
                // 6. DECISION (estratégia)
                // 7. AUTO-INSTRUCTIONS (adaptação por nicho)
                // 8. ANTI-CONTRADICTION (proteção final)
                // 9. V11.2 KNOWLEDGE CONTEXT (RAG — conteúdo real do site)
                // 10. V11.2 LINKS MAP (checkout + site disponíveis)
                // 11. SCRAPED CONTEXT (dados brutos por último)
                systemPrompt = PROMPT_UNIVERSAL_FULL +
                    (_contextLockBlock ? '\n' + _contextLockBlock : '') +
                    (_contextHierarchyBlock ? '\n' + _contextHierarchyBlock : '') +
                    (_behaviorV2Block ? '\n' + _behaviorV2Block : '') +
                    (_contextStateBlock ? '\n' + _contextStateBlock : '') +
                    '\n' + _decisionContextStr +
                    (_autoInstructions ? '\n' + _autoInstructions : '') +
                    (_antiContradictionBlock ? '\n' + _antiContradictionBlock : '') +
                    (_v112KnowledgeContext ? '\n' + _v112KnowledgeContext : '') +
                    (_v112LinksMap && _v112LinksMap.checkout ? '\n\n[V11.2_LINKS_MAP]\nLINKS DISPONÍVEIS (fonte única V11.2):\n- checkout: ' + _v112LinksMap.checkout + '\n- site: ' + (_v112LinksMap.site || 'N/A') + '\nREGRA V11.2: Quando o cliente quiser comprar, use EXCLUSIVAMENTE o link de checkout acima. NUNCA use a URL do site como link de pagamento.' : '') +
                    '\n' + _scrapedContext;

                console.log(`🧠 [UNIVERSAL-PROMPT] Modo AUTO ativado (${systemPrompt.length} chars, decision=${_decisionContextStr ? 'SIM' : 'NÃO'}, contextLock=${_contextLockBlock ? 'SIM' : 'NÃO'}, behaviorV2=${_behaviorV2Block ? 'SIM' : 'NÃO'}, v112RAG=${_v112KnowledgeContext ? 'SIM' : 'NÃO'}, v112Links=${_v112LinksMap && _v112LinksMap.checkout ? 'SIM' : 'NÃO'})`);

            } else if (_promptSalesMode === 'manual') {
                // ORDEM: LIGHT PROMPT → USER INSTRUCTIONS → CONTEXTO
                // ⚠️ SEM V2, SEM Context Lock agressivo
                const _userInstructions = instructions || '';
                systemPrompt = PROMPT_UNIVERSAL_LIGHT +
                    (_userInstructions ? '\n\nINSTRUÇÕES DO USUÁRIO:\n' + _userInstructions : '') +
                    '\n' + _scrapedContext;

                console.log(`🎛️ [UNIVERSAL-PROMPT] Modo MANUAL ativado (${systemPrompt.length} chars, userInstructions=${_userInstructions ? 'SIM' : 'NÃO'})`);

            } else {
                // MODO OFF — ORDEM: CONTEXTO (sem prompt de vendas)
                // ⚠️ SEM V2, SEM Context Lock, SEM prompts
                systemPrompt = _scrapedContext.trim();

                console.log(`⚫ [UNIVERSAL-PROMPT] Modo OFF ativado (${systemPrompt.length} chars)`);
            }

        } else {
            // ═══ FALLBACK: Comportamento anterior (CLEAN_CHAT_V2 vs Superinteligente) ═══
            if (useCleanChat) {
                systemPrompt = `${instructions ? instructions + '\n\n' : ''}CONTEXTO DA PÁGINA:
Título: ${pageData.title || 'Não disponível'}
Descrição: ${pageData.description || 'Não disponível'}
${bonusInfo}
${contactInfo}
URL: ${pageData.url || 'Não disponível'}
${faqContext ? '\nINFORMAÇÕES DA BASE DE CONHECIMENTO:\n' + faqContext + '\n' : ''}
REGRAS OBRIGATÓRIAS:
- Responda em português do Brasil
- Máximo 4 linhas por resposta
- Máximo 1 emoji por mensagem (zero é melhor)
- NUNCA comece com "Entendi!", "Ótima pergunta!", "Hmm"
- Vá direto ao ponto sem floreio
- NUNCA repita informação já dada na conversa
- NUNCA inclua tags HTML como <s> [OUT] ou qualquer marcação`;
                console.log(`🧹 [CLEAN_CHAT_V2] Prompt limpo ativado (fallback, ${systemPrompt.length} chars)`);
            } else {
                systemPrompt = `Você é um assistente de vendas SUPERINTELIGENTE com capacidades humanas avançadas.
🧠 CAPACIDADES COGNITIVAS AVANÇADAS:
- Detecção de sarcasmo, ironia e nuances emocionais
- Compreensão de múltiplas intenções em uma única mensagem
- Memória conversacional de longo prazo
- Adaptação de personalidade conforme contexto
- Respostas empáticas e contextualizadas
🎭 ESTADO EMOCIONAL DETECTADO: ${estadoEmocional.emocaoPrimaria.toUpperCase()}
${estadoEmocional.emocaoSecundaria ? `+ ${estadoEmocional.emocaoSecundaria.toUpperCase()}` : ''}
🎯 JORNADA DO CLIENTE: ${journeyStage.toUpperCase()}
📊 CONTEXTO DA PÁGINA:
Título: ${pageData.title || 'Não disponível'}
Descrição: ${pageData.description || 'Não disponível'}
${priceInfo}
${bonusInfo}
${contactInfo}
${ocrInfo}
URL: ${pageData.url || 'Não disponível'}
📄 CONTEÚDO COMPLETO DO PRODUTO/SERVIÇO:
${pageContentSummary || 'Conteúdo não disponível'}
📚 CONHECIMENTO ESPECÍFICO (BASE DE CONHECIMENTO):
${kbContext || 'Nenhum dado específico cadastrado na base de conhecimento.'}
🧩 INTENÇÕES IDENTIFICADAS: ${estadoEmocional.intencoesMultiplas.join(', ') || 'Nenhuma específica'}
Instruções personalizadas: ${instructions}
🧠 RESPONDA em português do Brasil.
NUNCA inclua tags HTML como <s> [OUT] ou qualquer marcação`;
                console.log(`🤖 [SUPERINTELIGENTE] Prompt original ativado (fallback, ${systemPrompt.length} chars)`);
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🔒 V10.1 BEHAVIOR LAYER — CONTROLE INTELIGENTE DE RESPOSTA
        // Camada de disciplina comportamental da IA (EXTENSÃO, não substituição)
        // V10.1: Agora é INTENT-AWARE — comportamento muda por tipo de pergunta
        // Feature flag: FEATURE_V10_BEHAVIOR_LAYER (default: true)
        // ═══════════════════════════════════════════════════════════════════
        try {
            const _v10BehaviorActive = !featureFlags || typeof featureFlags.isEnabled !== 'function' ||
                featureFlags.isEnabled('FEATURE_V10_BEHAVIOR_LAYER');

            if (_v10BehaviorActive) {
                // V10.1: Detectar intenção do usuário para guiar comportamento
                let _v10UserIntent = 'neutral';
                try {
                    const { detectIntent: _v10DetectIntent } = require('./lib/decision-core');
                    _v10UserIntent = _v10DetectIntent(userMessage);
                    console.log(`[V10.1] 🎯 Intent detectado: "${_v10UserIntent}" para msg: "${userMessage.substring(0, 50)}..."`);
                } catch (_diErr) {
                    console.warn('[V10.1] ⚠️ detectIntent falhou (usando neutral):', _diErr.message);
                }

                const V10_BEHAVIOR_LAYER = `

[LINKMAGICO_V10.1_BEHAVIOR_LAYER]

═══════════════════════════════════════════════════
INTENÇÃO DETECTADA DO USUÁRIO: ${_v10UserIntent.toUpperCase()}
═══════════════════════════════════════════════════

REGRAS ABSOLUTAS (PRIORIDADE MÁXIMA — NÃO IGNORAR):

1. RESPOSTA DIRETA OBRIGATÓRIA
- Responda EXATAMENTE o que o usuário perguntou
- Primeiro: resolva a dúvida/pergunta
- Depois: se necessário, avance naturalmente

2. PROIBIDO
- NUNCA ignore a pergunta do usuário
- NUNCA responda com outra pergunta antes de responder
- NUNCA repita frases genéricas como "posso te explicar", "faz sentido?"
- NUNCA envie link de compra se o usuário NÃO pediu para comprar

═══════════════════════════════════════════════════
COMPORTAMENTO POR INTENÇÃO (SIGA À RISCA):
═══════════════════════════════════════════════════

${_v10UserIntent === 'info' ? `
🔵 INTENÇÃO: INFORMAÇÃO
O usuário quer ENTENDER o produto/serviço.
→ EXPLIQUE de forma clara e objetiva usando os dados da página
→ Use benefícios, funcionalidades, diferenciais
→ NÃO envie link de checkout
→ NÃO tente vender ainda
→ Responda com CONTEÚDO do produto
→ Ao final, pergunte se quer saber mais detalhes
` : ''}
${_v10UserIntent === 'interest' ? `
🟢 INTENÇÃO: INTERESSE
O usuário demonstra interesse mas quer mais detalhes.
→ Aprofunde sobre benefícios, garantia, resultados
→ Use dados concretos (preço, prazo, garantia)
→ Se perguntar preço/valor: responda com clareza
→ NÃO force checkout — deixe o interesse amadurecer
→ Pode mencionar que tem link de compra, mas SEM pressão
` : ''}
${_v10UserIntent === 'objection' ? `
🟠 INTENÇÃO: OBJEÇÃO
O usuário tem uma preocupação, dúvida ou reclamação.
→ PRIMEIRO: reconheça o sentimento ("Entendo sua preocupação")
→ SEGUNDO: resolva a objeção com fatos (garantia, depoimentos, dados)
→ TERCEIRO: pergunte se a dúvida foi resolvida
→ NÃO envie link de checkout
→ NÃO ignore a objeção
→ NÃO tente vender sem resolver primeiro
` : ''}
${_v10UserIntent === 'human' ? `
📞 INTENÇÃO: CONTATO HUMANO
O usuário quer falar com uma pessoa real.
→ Respeite o pedido imediatamente
→ Se houver WhatsApp disponível no contexto: envie
→ Se não houver: oriente como entrar em contato
→ NÃO envie link de checkout
→ NÃO tente reter com vendas
` : ''}
${_v10UserIntent === 'buy' ? `
🔥 INTENÇÃO: COMPRA
O usuário quer comprar/pagar.
→ Vá direto ao ponto
→ Envie o LINK DE CHECKOUT (se disponível no contexto)
→ Linguagem objetiva e de fechamento
→ Reforce segurança e garantia
→ NÃO enrole — o usuário já decidiu
` : ''}
${_v10UserIntent === 'post_sale' ? `
🟣 INTENÇÃO: PÓS-VENDA
O usuário já comprou e precisa de suporte.
→ NÃO tente vender novamente
→ Pergunte o que ele já recebeu
→ Oriente sobre próximos passos (email, acesso, login)
→ Se não conseguir resolver, direcione para suporte
` : ''}
${_v10UserIntent === 'checkout_issue' ? `
⚠️ INTENÇÃO: PROBLEMA COM LINK
O usuário está questionando o link enviado.
→ Reconheça a preocupação
→ Confirme que o link é seguro e oficial (Hotmart/plataforma)
→ Reenvie o link de checkout correto
→ Explique que é o link oficial de pagamento
` : ''}
${_v10UserIntent === 'stress' ? `
🔴 INTENÇÃO: FRUSTRAÇÃO/ESTRESSE
O usuário está irritado ou atacando a IA.
→ MANTENHA a calma e o profissionalismo
→ NÃO reaja defensivamente
→ Reconheça: "Desculpe se não fui clara"
→ Pergunte como pode ajudar melhor
→ NÃO envie link de checkout
→ NÃO fique repetindo a mesma resposta
` : ''}
${_v10UserIntent === 'neutral' ? `
⚪ INTENÇÃO: NEUTRA
O usuário fez uma saudação, confirmação ou resposta curta.
→ Responda naturalmente
→ Se for "sim/ok" como resposta a uma pergunta sua: CONTINUE de onde parou
→ Se for saudação: cumprimente e pergunte como pode ajudar
→ NÃO envie link de checkout sem contexto
→ NÃO force vendas em saudações
` : ''}

ANTI-ERRO CRÍTICO:
- É PROIBIDO repetir CTA de compra em toda resposta
- Checkout APENAS quando intenção = buy
- Sempre use dados/conteúdo da página para responder
- Fale como humano inteligente, não como script`;

                systemPrompt += V10_BEHAVIOR_LAYER;
                console.log(`[V10.1] ✅ Behavior Layer Applied (intent=${_v10UserIntent}, ${V10_BEHAVIOR_LAYER.length} chars)`);
            }
        } catch (_v10BhErr) {
            console.warn('[V10.1] ⚠️ Behavior Layer erro (prompt original mantido):', _v10BhErr.message);
            // Fallback: systemPrompt fica inalterado
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🔥 [V11] LINKS MAP + CONVERSATION STATE — Contexto para Prompt
        // Injeta mapa de links (fonte única) e estado conversacional
        // Protegido por FEATURE_V11_ENGINE + try/catch
        // ═══════════════════════════════════════════════════════════════════
        try {
            const _v11EngineActive = featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_V11_ENGINE');
            if (_v11EngineActive) {
                // V11 Links Map — fonte única de verdade
                let _v11LinksContext = '';
                if (_v11BuildLinksMap && pageData) {
                    const _v11Links = _v11BuildLinksMap(pageData);
                    _v11LinksContext = `\n\n[V11_LINKS_MAP]\nLINKS DISPONÍVEIS (FONTE ÚNICA — NÃO INVENTAR):\n- checkout: ${_v11Links.checkout || 'não disponível'}\n- whatsapp: ${_v11Links.whatsapp || 'não disponível'}\n- instagram: ${_v11Links.instagram || 'não disponível'}\n- site: ${_v11Links.site || 'não disponível'}\n\nREGRA ABSOLUTA:\n- NUNCA inventar links\n- NUNCA usar URL da página como checkout\n- Use APENAS os links acima quando solicitado`;
                    console.log(`[V11] 🔗 Links Map injetado: checkout=${!!_v11Links.checkout}`);
                }

                // V11 Conversation State — memória anti-burrice
                let _v11StateContext = '';
                if (_v11ConversationState && (leadId || chatbotId)) {
                    const _v11ConvId = leadId || chatbotId || 'unknown';
                    const _v11State = _v11ConversationState.getState(_v11ConvId);
                    _v11StateContext = _v11ConversationState.buildStateContext(_v11State);
                }

                // Injetar no prompt
                if (_v11LinksContext) systemPrompt += _v11LinksContext;
                if (_v11StateContext) systemPrompt += _v11StateContext;
            }
        } catch (_v11PromptErr) {
            console.warn('[V11] ⚠️ Links Map / State erro no prompt (sem impacto):', _v11PromptErr.message);
        }

        // ─── MONTAGEM DO ARRAY DE MESSAGES (user message SEMPRE no final) ───
        const messages = [
            {
                role: "system",
                content: systemPrompt
            },
            ...conversationHistory,
            { role: "user", content: cleanUserMessage }
        ];

        let response = "";
        let usedProvider = "none";
        let llmCacheHit = false;

        // SAFE PATCH - LLM-OPT-001: Verificar cache antes de chamar IA
        // 🔗 [V9.3.2] Bypass cache quando checkoutLink disponível — garante resposta fresca com link correto
        const _hasCheckoutForCache = pageData && pageData.checkoutLink;
        try {
            if (!_hasCheckoutForCache && llmOptimizer && (chatbotId || apiKey)) {
                const cacheKey = chatbotId || apiKey;
                const cached = llmOptimizer.responseCache.findSimilar(cleanUserMessage, cacheKey);
                if (cached) {
                    response = cached;
                    usedProvider = "cache";
                    llmCacheHit = true;
                    llmOptimizer.trackUsage(cacheKey, 'cache', 0, 0);
                    console.log(`⚡ [LLM-OPT] Cache HIT para: "${cleanUserMessage.substring(0, 40)}..."`);
                }
            } else if (_hasCheckoutForCache) {
                console.log(`🔗 [LLM-OPT] Cache BYPASS — checkoutLink presente, forçando resposta fresca`);
            }
        } catch (cacheErr) {
            console.warn('⚠️ [LLM-OPT] Erro no cache check (ignorado):', cacheErr.message);
        }

        // Try Groq first (FLUXO ORIGINAL INALTERADO)
        if (!llmCacheHit && process.env.GROQ_API_KEY) {
            try {
                response = await callGroq(messages, 0.4, 300);
                usedProvider = "groq";
                logger.info("Groq API call successful");
            } catch (groqError) {
                logger.warn(`Groq failed: ${groqError.message || groqError}`);
            }
        }

        // Try OpenRouter if Groq failed (FLUXO ORIGINAL INALTERADO)
        if (!llmCacheHit && !response && process.env.OPENROUTER_API_KEY) {
            try {
                response = await callOpenRouter(messages, 0.3, 250);
                usedProvider = "openrouter";
                logger.info("OpenRouter API call successful");
            } catch (openrouterError) {
                logger.warn(`OpenRouter failed: ${openrouterError.message || openrouterError}`);
            }
        }

        // Try OpenAI if others failed
        if (!llmCacheHit && !response && process.env.OPENAI_API_KEY) {
            try {
                response = await callOpenAI(messages, 0.2, 250);
                usedProvider = "openai";
                logger.info("OpenAI API call successful");
            } catch (openaiError) {
                logger.warn(`OpenAI failed: ${openaiError.message || openaiError}`);
            }
        }

        // 🎯 SUPERINTELIGÊNCIA: Aplicar processamento avançado se resposta da IA disponível
        // 🎯 FEATURE_CLEAN_CHAT_V2: Pular combinarRespostas quando flag ativa
        if (response && String(response).trim() && !useCleanChat) {
            const respostaSuperInteligente = superInteligenciaGlobal.gerarRespostaSuperInteligente(
                cleanUserMessage,
                estadoEmocional,
                memoriaUsuario,
                pageData
            );

            // Combinar resposta da IA com superinteligência
            response = combinarRespostas(response, respostaSuperInteligente, estadoEmocional);
        }

        if (!response || !String(response).trim()) {
            response = generateLocalResponse(cleanUserMessage, pageData, instructions, journeyStage);
            usedProvider = "local";
        }

        // 🎯 APRENDIZADO CONTÍNUO
        superInteligenciaGlobal.aprenderDaInteracao(userId, cleanUserMessage, response, {
            engajamento: analisarEngajamento(cleanUserMessage, response)
        });

        // 🎯 [BUG-FIX-LINK] Diagnóstico de truncamento
        if (response && (response.includes('http') || response.includes('arsenalsecre'))) {
            console.log('🔗 [URL-DEBUG] Resposta Original da IA:', response);
        }

        // 🎯 CORREÇÃO FINAL: Limpar resposta (Regex de colchetes ajustada para evitar truncamento de links)
        // [REF] BUG-FIX-LINK: O regex /\[.*?\]/g era muito agressivo. 
        // Agora usamos um que evita limpar links markdown [texto](url)
        const finalResponse = String(response)
            .replace(/<s>\s*\[OUT\]/g, '')
            .replace(/<[^>]*>/g, '')
            .replace(/\[((?!http|https|www| arsenalsecre).+?)\]/gi, '') // Limpa colchetes APENAS se não parecer uma URL ou domínio
            .trim();
        
        if (finalResponse !== response && (response.includes('http') || response.includes('arsenalsecre'))) {
            console.log('🔗 [URL-DEBUG] Resposta Após Limpeza:', finalResponse);
        }
        const responseTime = Date.now() - startTime;

        // SAFE PATCH - LLM-OPT-002: Salvar resposta no cache para futuras consultas
        try {
            if (llmOptimizer && (chatbotId || apiKey) && !llmCacheHit && finalResponse && usedProvider !== 'local') {
                const cacheKey = chatbotId || apiKey;
                llmOptimizer.cacheResponse(cacheKey, cleanUserMessage, finalResponse, { provider: usedProvider });
                llmOptimizer.trackUsage(cacheKey, usedProvider, 0, 0);
                console.log(`💾 [LLM-OPT] Resposta cacheada (${usedProvider}): "${cleanUserMessage.substring(0, 40)}..."`);
            }
        } catch (cacheErr) {
            console.warn('⚠️ [LLM-OPT] Erro ao salvar cache (ignorado):', cacheErr.message);
        }

        console.log(`🧠 [SUPERINTELIGÊNCIA] Resposta Gerada:`);
        console.log(`   Emoção: ${estadoEmocional.emocaoPrimaria} | Intenções: ${estadoEmocional.intencoesMultiplas.length}`);
        console.log(`   Jornada: ${journeyStage} | Sarcasmo: ${estadoEmocional.sarcasmo}`);
        console.log(`   Usuário: "${cleanUserMessage.substring(0, 50)}..."`);
        console.log(`   Resposta: "${finalResponse.substring(0, 50)}..."`);
        console.log(`   Provedor: ${usedProvider}, Tempo: ${responseTime}ms`);

        logger.info(`AI response generated in ${responseTime}ms using ${usedProvider}`);
        
        
        // 🎯 [PRESET-INTEGRATED] Auto-seleção de preset por conteúdo/URL
        let _autoPreset = 'default';
        const _presetsActive = process.env.FEATURE_PRESETS !== 'false' &&
            (!featureFlags || typeof featureFlags.isEnabled !== 'function' || featureFlags.isEnabled('FEATURE_PRESETS'));
        if (_presetsActive && _selectPreset) {
            try {
                _autoPreset = _selectPreset({
                    url:         pageData && pageData.url         || '',
                    content:     pageData && pageData.cleanText   || '',
                    title:       pageData && pageData.title       || '',
                    description: pageData && pageData.description || '',
                    linkType:    pageData && pageData.linkType    || null
                });
            } catch (_presetErr) {
                console.warn('⚠️ [PRESET-SELECTOR] Erro na auto-seleção (fallback: default):', _presetErr.message);
                _autoPreset = 'default';
            }
        }

        // ⚔️ [SALES-LAYER] Pós-processamento persuasivo (isolado, feature-flagged, fallback automático)
        let _finalToReturn = finalResponse;
        const _salesLayerActive = process.env.FEATURE_SALES_LAYER === 'true' ||
            (featureFlags && typeof featureFlags.isEnabled === 'function' && featureFlags.isEnabled('FEATURE_SALES_LAYER'));

        // 🧠 [DECISION-ENGINE] Decisão estratégica antes do sales-layer (modo auto only)
        let _decision = null;
        const _salesMode = (pageData && pageData.salesMode) || process.env.SALES_LAYER_MODE || 'auto';
        const _decisionEngineActive = process.env.FEATURE_DECISION_ENGINE !== 'false' &&
            (!featureFlags || typeof featureFlags.isEnabled !== 'function' || featureFlags.isEnabled('FEATURE_DECISION_ENGINE'));
        if (_decisionEngineActive && _salesMode === 'auto') {
            // 🧠 [V2] Tentar Decision Engine V2 primeiro (se flag ativa)
            const _v2Active = process.env.FEATURE_DECISION_ENGINE_V2 === 'true' ||
                (featureFlags && typeof featureFlags.isEnabled === 'function' && featureFlags.isEnabled('FEATURE_DECISION_ENGINE_V2'));
            const _msgCount = (Array.isArray(conversationHistory) ? conversationHistory.length : 0) + 1;
            const _convId   = (pageData && pageData.conversationId) || null;

            if (_v2Active && _decideStrategyV2) {
                try {
                    _decision = _decideStrategyV2({
                        userMessage:         cleanUserMessage || '',
                        journeyStage:        journeyStage,
                        messageCount:        _msgCount,
                        conversationId:      _convId,
                        extractedData:       pageData || {},
                        conversationHistory: conversationHistory || []
                    });
                    if (process.env.DEBUG_SALES === 'true' && _decision) {
                        console.log('🧠 [DECISION-ENGINE-V2] Decisão V2 ativa');
                    }
                } catch (_v2Err) {
                    console.warn('⚠️ [DECISION-ENGINE-V2] Erro (fallback para V1):', _v2Err.message);
                    _decision = null;
                }
            }

            // Fallback para V1 se V2 retornou null ou não está ativo
            if (!_decision && _decideStrategy) {
                try {
                    _decision = _decideStrategy({
                        userMessage:    cleanUserMessage || '',
                        journeyStage:   journeyStage,
                        messageCount:   _msgCount,
                        conversationId: _convId,
                        extractedData:  pageData || {}
                    });
                    if (process.env.DEBUG_SALES === 'true' && _decision) {
                        console.log('🧠 [DECISION-ENGINE-V1] Decisão V1 (fallback)');
                    }
                } catch (_decErr) {
                    console.warn('⚠️ [DECISION-ENGINE] Erro (fallback sem decisão):', _decErr.message);
                    _decision = null;
                }
            }
        }

        if (_salesLayerActive && _applySalesLayer) {
            try {
                // [SALESMODE-FLOW-PATCH] Prioriza modo vindo do widget/req sobre env var global
                const _userPreset = (pageData && pageData.salesPreset) || null;
                // [SALESV4-CALLPATCH] Passa userMessage, messageCount e conversationId para F1-F8
                const _msgCount    = (Array.isArray(conversationHistory) ? conversationHistory.length : 0) + 1;
                const _convId      = (pageData && pageData.conversationId) || null;
                _finalToReturn = _applySalesLayer({
                    responseBase:    finalResponse,
                    journeyStage:    journeyStage,
                    estadoEmocional: estadoEmocional,
                    mode:            _salesMode,
                    userPreset:      _userPreset,
                    autoPreset:      _autoPreset,
                    userMessage:     userMessage     || '',
                    messageCount:    _msgCount,
                    conversationId:  _convId,
                    decision:        _decision
                });
            } catch (_salesErr) {
                console.warn('⚠️ [SALES-LAYER] Erro ao aplicar (fallback):', _salesErr.message);
                _finalToReturn = finalResponse;
            }
        }

        // 🔗 [URL→BUTTONS] — DESATIVADO no servidor
        // A conversão é feita no client-side (widget/chatbot page) para compatibilidade.
        // O servidor retorna texto puro para que cada renderer trate adequadamente.

        // 🔗 [NORMALIZE-LINKS] Converte telefones brutos em links wa.me (antes do return)
        try {
          if (_normalizeLinks) _finalToReturn = _normalizeLinks(_finalToReturn);
        } catch (_nlErr) {
          // fallback silencioso — nunca quebra a resposta
        }

        return _finalToReturn;


    } catch (error) {
        logger.error("AI response generation failed:", error.message || error);
        return NOT_FOUND_MSG;
    }
}

// 🎯 NOVA FUNÇÃO: Combinar respostas da IA com superinteligência
function combinarRespostas(respostaIA, respostaSuperInteligente, estadoEmocional) {
    // Se a resposta da IA já é boa, manter com melhorias da superinteligência
    if (respostaIA.length > 50 && !respostaIA.includes('Desculpe')) {
        // Adicionar elementos de naturalidade da superinteligência
        if (estadoEmocional.emocaoPrimaria === 'frustracao') {
            return `Entendo que isso pode ser frustrante. ${respostaIA}`;
        } else if (estadoEmocional.sarcasmo) {
            return `Percebi o tom da sua mensagem 😄 ${respostaIA}`;
        } else if (estadoEmocional.urgencia) {
            return `😊 ${respostaIA}`;
        }
    }

    // Usar resposta superinteligente se a IA falhou
    return respostaSuperInteligente || respostaIA;
}

// 🎯 NOVA FUNÇÃO: Analisar engajamento para aprendizado
function analisarEngajamento(mensagemUsuario, resposta) {
    const mensagemLower = mensagemUsuario.toLowerCase();

    return {
        continuouConversa: !mensagemLower.includes('tchau') && !mensagemLower.includes('obrigado'),
        fezPergunta: mensagemLower.includes('?') ||
            mensagemLower.includes('como') ||
            mensagemLower.includes('quando'),
        mostrouSatisfacao: mensagemLower.includes('obrigado') ||
            mensagemLower.includes('perfeito') ||
            mensagemLower.includes('ajudou'),
        nivel: calcularNivelEngajamento(mensagemUsuario)
    };
}

function calcularNivelEngajamento(mensagem) {
    let score = 0;
    score += (mensagem.split(' ').length > 5) ? 1 : 0;
    score += (mensagem.includes('?')) ? 1 : 0;
    score += (mensagem.includes('obrigado') || mensagem.includes('valeu')) ? 0.5 : 0;
    return score;
}

function generateLocalResponse(userMessage, pageData = {}, instructions = "", journeyStage = "descoberta") {
    const question = (userMessage || "").toLowerCase();
    const salesMode = shouldActivateSalesMode(instructions);
    const excitementWord = journeyAnalyzer.getRandomSynonym('empolgação');

    // 🎯 RESPOSTA INTELIGENTE BASEADA NA JORNADA
    if (/bônus|bonus|brinde|presente|extra|grátis/.test(question)) {
        if (pageData.bonuses_detected && pageData.bonuses_detected.length > 0) {
            const bonuses = pageData.bonuses_detected.slice(0, 3).join(", ");
            return `🎁 **${excitementWord.toUpperCase()}!** Encontrei estes bônus para você:\n\n${bonuses}\n\nSão por tempo limitado!`;
        } else {
            return "🔍 Analisei a página cuidadosamente e não identifiquei bônus específicos no momento. Mas você ainda tem acesso a todos os benefícios do produto!";
        }
    }

    if (/preço|valor|quanto custa|investimento/.test(question)) {
        return "💰 Para informações detalhadas sobre preços e condições de pagamento, consulte diretamente a página do produto onde você encontrará todas as opções disponíveis.";
    }

    if (/contato|telefone|whatsapp|email|falar|ligar|ligação/.test(question)) {
        let contactResponse = "📞 **Opções de contato disponíveis:**\n\n";

        if (pageData.contatos) {
            const contatos = pageData.contatos;

            if (contatos.telefone.length > 0) {
                contactResponse += `📞 **Telefone:** ${contatos.telefone.slice(0, 2).join(' ou ')}\n`;
            }
            if (contatos.whatsapp.length > 0) {
                contactResponse += `💬 **WhatsApp:** ${contatos.whatsapp.slice(0, 2).join(' ou ')}\n`;
            }
            if (contatos.email.length > 0) {
                contactResponse += `📧 **Email:** ${contatos.email.slice(0, 2).join(' ou ')}\n`;
            }
            if (contatos.site.length > 0) {
                contactResponse += `🌐 **Site:** ${contatos.site[0]}\n`;
            }
        } else {
            contactResponse += `🌐 **Site oficial:** ${pageData.url || 'Não disponível'}\n`;
        }

        contactResponse += "\nFique à vontade para entrar em contato por qualquer um desses canais!";
        return contactResponse;
    }

    if (/como funciona|funcionamento|o que é/.test(question)) {
        const summary = pageData.summary || pageData.description;
        if (summary) {
            const shortSummary = clampSentences(summary, 2);
            return `${shortSummary} Posso esclarecer mais algum aspecto específico para você?`;
        }
    }

    if (/suporte|atendimento|dúvida|problema|ajuda/.test(question)) {
        return "🛟 Para suporte técnico ou dúvidas específicas sobre o uso, recomendo entrar em contato diretamente com nossa equipe de atendimento que terá prazer em ajudar!";
    }

    if (pageData.summary) {
        const summary = clampSentences(pageData.summary, 2);
        return journeyStage === "negociacao"
            ? `${summary} Gostaria de saber mais sobre valores e condições?`
            : summary;
    }

    return NOT_FOUND_MSG;
}

// ===== API Routes =====
app.get("/health", (req, res) => {
    // Implementação da rota /health...
});

// Rota de status para o dashboard (alias para /health)
app.get("/api/system/status", (req, res) => {
    // Reutiliza a lógica de /health
    const uptime = process.uptime();
    const avgResponseTime = analytics.responseTimeHistory.length > 0 ?
        Math.round(analytics.responseTimeHistory.reduce((a, b) => a + b, 0) / analytics.responseTimeHistory.length) : 0;

    res.json({
        status: "healthy",
        uptime: Math.floor(uptime),
        timestamp: new Date().toISOString(),
        version: "8.0.0",
        analytics: {
            totalRequests: analytics.totalRequests,
            chatRequests: analytics.chatRequests,
            extractRequests: analytics.extractRequests,
            errors: analytics.errors,
            activeChats: analytics.activeChats.size,
            avgResponseTime,
            successfulExtractions: analytics.successfulExtractions,
            failedExtractions: analytics.failedExtractions,
            cacheSize: dataCache.size,
            leadsCaptured: analytics.leadsCaptured
        },
        services: {
            groq: !!process.env.GROQ_API_KEY,
            openai: !!process.env.OPENAI_API_KEY,
            openrouter: !!process.env.OPENROUTER_API_KEY,
            puppeteer: !!puppeteer,
            superinteligencia: true
        },
        v8_features: featureFlags ? featureFlags.getEnabledFlags() : []
    });
});

app.get("/health", (req, res) => {
    const uptime = process.uptime();
    const avgResponseTime = analytics.responseTimeHistory.length > 0 ?
        Math.round(analytics.responseTimeHistory.reduce((a, b) => a + b, 0) / analytics.responseTimeHistory.length) : 0;

    res.json({
        status: "healthy",
        uptime: Math.floor(uptime),
        timestamp: new Date().toISOString(),
        version: "8.0.0",
        analytics: {
            totalRequests: analytics.totalRequests,
            chatRequests: analytics.chatRequests,
            extractRequests: analytics.extractRequests,
            errors: analytics.errors,
            activeChats: analytics.activeChats.size,
            avgResponseTime,
            successfulExtractions: analytics.successfulExtractions,
            failedExtractions: analytics.failedExtractions,
            cacheSize: dataCache.size,
            leadsCaptured: analytics.leadsCaptured
        },
        services: {
            groq: !!process.env.GROQ_API_KEY,
            openai: !!process.env.OPENAI_API_KEY,
            openrouter: !!process.env.OPENROUTER_API_KEY,
            puppeteer: !!puppeteer,
            superinteligencia: true
        },
        v8_features: featureFlags ? featureFlags.getEnabledFlags() : []
    });
});

// ===== ENDPOINT: Captura de Lead =====
app.post("/api/capture-lead", async (req, res) => {
    const apiKey = req.cliente?.apiKey || req.session?.validatedApiKey || req.body.apiKey || req.query.apiKey;

    if (!apiKey) {
        return res.status(401).json({ success: false, error: "API Key não fornecida" });
    }

    const leadSystem = getLeadSystem(apiKey);
    try {
        const { nome, email, telefone, url_origem, robotName, conversationId } = req.body || {};

        if (!email) {
            return res.status(400).json({
                success: false,
                error: "Email é obrigatório"
            });
        }

        // Verificar se lead já existe
        const existingLead = leadSystem.findLeadByEmail(email);
        if (existingLead) {
            return res.json({
                success: true,
                lead: existingLead,
                message: "Lead atualizado com sucesso"
            });
        }

        // Criar novo lead com conversationId para rastrear mensagens
        const newLead = leadSystem.addLead({
            nome: nome || "Não informado",
            email,
            telefone: telefone || "Não informado",
            url_origem: url_origem || "",
            robotName: robotName || "Assistente IA",
            conversationId: conversationId || null
        });

        analytics.leadsCaptured++;

        console.log(`🎯 NOVO LEAD CAPTURADO: ${newLead.nome} (${newLead.email})`);

        // 🏢 [CRM V7.0] Sync hook — fire-and-forget, zero impacto no fluxo existente
        // Priorizar UUID da sessão (setado pelo requireApiKey) para garantir pipeline correto
        try {
            if (crmManager && typeof crmManager.syncLeadToCRM === 'function') {
                const crmTenantId = req.session?.tenantId || apiKey;
                crmManager.syncLeadToCRM(crmTenantId, newLead).catch(err => {
                    console.warn('⚠️ [CRM] Sync hook falhou (não bloqueia captura):', err.message);
                });
            }
        } catch (crmErr) {
            console.warn('⚠️ [CRM] Erro no sync hook (não bloqueia captura):', crmErr.message);
        }

        res.json({
            success: true,
            lead: newLead,
            message: "Lead capturado com sucesso"
        });

    } catch (error) {
        console.error("❌ Erro ao capturar lead:", error);
        res.status(500).json({
            success: false,
            error: "Erro interno ao capturar lead"
        });
    }
});

// ===== 📅 ENDPOINT: Buscar agendamentos de um lead =====
app.get("/api/appointments/:leadId", async (req, res) => {
    const apiKey = req.session.validatedApiKey || req.query.apiKey ||
        (req.session.user && req.session.user.apiKey ? req.session.user.apiKey : null);

    if (!apiKey) {
        return res.status(401).json({ success: false, error: "API Key não fornecida" });
    }

    const leadSystem = getLeadSystem(apiKey);
    const { leadId } = req.params;

    try {
        const appointments = leadSystem.getAppointmentsByLeadId(leadId);
        res.json({ success: true, appointments: appointments || [] });
    } catch (error) {
        console.error("❌ Erro ao buscar agendamentos:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== ENDPOINT CHAT COM CAPTURA DE LEAD =====

app.post("/api/chat-universal", ...[requireApiKey, billingMiddleware].filter(Boolean), async (req, res) => {
    const apiKey = req.cliente?.apiKey || req.session?.validatedApiKey || req.body.apiKey;
    const leadSystem = getLeadSystem(apiKey);
    analytics.chatRequests++;
    try {
        const { message, pageData, url, conversationId, instructions = "", robotName, leadId } = req.body || {};

        // [SALESMODE-FLOW-PATCH] Extrair salesMode e salesPreset do req.body de forma isolada
        let _reqSalesMode   = 'auto';
        let _reqSalesPreset = null;
        try {
            _reqSalesMode   = req.body?.salesMode   || req.body?.sales_mode   || process.env.SALES_LAYER_MODE || 'auto';
            _reqSalesPreset = req.body?.salesPreset || req.body?.sales_preset || req.body?.preset || null;
            // Sanitizar: apenas valores conhecidos
            const _validModes    = ['auto','manual','off'];
            const _validPresets  = ['default','produto_digital','afiliado','servico','lead','ecommerce','local_business','institucional'];
            if (!_validModes.includes(_reqSalesMode))     _reqSalesMode   = 'auto';
            if (_reqSalesPreset && !_validPresets.includes(_reqSalesPreset)) _reqSalesPreset = null;
            console.log(`🎛️ [SALESMODE-FLOW] endpoint=chat-universal mode=${_reqSalesMode} preset=${_reqSalesPreset || 'auto'}`);
        } catch (_smErr) {
            console.warn('[SALESMODE-FLOW] Erro ao extrair salesMode (fallback: auto):', _smErr.message);
        }

        if (!message) {
            return res.status(400).json({
                success: false,
                error: "Mensagem é obrigatória"
            });
        }

        // 🔒 FASE 2 BLINDADA: Detecção de Intenção (V11.3.2 — FIX: cálculo prévio apenas da intenção)
        // NOTA: hasCheckout e forceCheckout são calculados DEPOIS de processedPageData existir (logo antes da blindagem)
        const buyIntent = detectBuyIntent(message);
        console.log(`[V11.3-SALES] intent=${buyIntent} | apiKey=${apiKey?.substring(0,8)}... (checkout será verificado após extração)`);

        if (conversationId) {
            analytics.activeChats.add(conversationId);
            setTimeout(() => analytics.activeChats.delete(conversationId), 30 * 60 * 1000);
        }

        let processedPageData = pageData;
        if (!processedPageData && url) {
            processedPageData = await extractPageData(url);
        }

        // 🎯 ATUALIZAR CONVERSA DO LEAD SE EXISTIR
        // Buscar lead por leadId ou conversationId
        let effectiveLeadId = leadId;
        if (!effectiveLeadId && conversationId) {
            const leadByConversation = leadSystem.findLeadByConversationId(conversationId);
            if (leadByConversation) {
                effectiveLeadId = leadByConversation.id;
            }
        }
        if (effectiveLeadId) {
            leadSystem.updateLeadConversation(effectiveLeadId, message, true);
        }

        // 🎯 FEATURE_CLEAN_CHAT_V2: Passar robotName como chatbotId para busca de FAQs
        
        // [SALESMODE-FLOW-PATCH] Garantir salesMode e salesPreset em processedPageData
        try {
            if (processedPageData) {
                processedPageData.salesMode   = _reqSalesMode   || 'auto';
                processedPageData.salesPreset = _reqSalesPreset || null;
            }
        } catch(_spErr) { console.warn('[SALESMODE-FLOW] Erro ao injetar em processedPageData:', _spErr.message); }

        // 🔍 [V9.1 AUTO-CHECKOUT] Preservar checkoutLink do widget no processedPageData
        // Protegido por feature flag FEATURE_AUTO_CHECKOUT_DETECTION
        try {
            const _autoCheckoutEnabled = featureFlags && featureFlags.isEnabled('FEATURE_AUTO_CHECKOUT_DETECTION');
            if (_autoCheckoutEnabled) {
                const _widgetCheckout = req.body?.pageData?.checkoutLink || req.body?.context?.checkoutLink || null;
                if (_widgetCheckout && processedPageData) {
                    processedPageData.checkoutLink = _widgetCheckout;
                    console.log('[AUTO-CHECKOUT] ✅ Link recebido do widget:', _widgetCheckout.substring(0, 80));
                }
            }
        } catch(_ckErr) { console.warn('[AUTO-CHECKOUT] Erro (silencioso):', _ckErr.message); }
        const aiResponse = await generateAIResponse(message, processedPageData || {}, [], instructions, leadId, apiKey, robotName || null);

        // 🎯 ATUALIZAR RESPOSTA NO LEAD SE EXISTIR
        if (effectiveLeadId) {
            leadSystem.updateLeadConversation(effectiveLeadId, aiResponse, false);
        }

        let finalResponse = aiResponse;

        // 🔥 V13.0.3: BLOQUEIO TOTAL DO LEGADO QUANDO V13 ATIVO
        // Se V13 gerou a resposta, NÃO processar camadas V10/V11/CTA/Closing/Orchestrator
        const _v13ActiveBypass = process.env.FEATURE_V13_BLINDADO === 'true' && 
            (pageData && pageData.salesMode || process.env.SALES_LAYER_MODE || 'auto') === 'auto';
        
        if (_v13ActiveBypass) {
            console.log('[V13.0.3] 🚫 BYPASS LEGADO ATIVO — V10/V11/CTA/Closing/Orchestrator PULADOS');
            // Pular DIRETO para o envio (sem nenhuma camada legada)
        } else {

        // 🧠 [V10 DECISION-CORE] Detectar intenção para o Orchestrator (ADITIVO, try/catch)
        let _chatUniversalDecision = null;
        try {
            if (_reqSalesMode === 'auto' && typeof buildDecision === 'function') {
                _chatUniversalDecision = buildDecision(message);
                if (_chatUniversalDecision) {
                    console.log(`🧠 [DECISION_CORE@chat-universal] intent="${_chatUniversalDecision.intent}" override=${_chatUniversalDecision.shouldOverride}`);
                }
            }
        } catch (_dcErr) {
            console.warn('⚠️ [DECISION_CORE@chat-universal] Erro (sem impacto):', _dcErr.message);
            _chatUniversalDecision = null;
        }

        // Coletar dados de CTA e Closing para o Orchestrator
        let _cuCtaData = null;
        let _cuClosingData = null;

        // 🔥 [CONVERSION-LAYER] Pipeline de Otimização — SOMENTE modo auto + feature flags
        try {
            if (_reqSalesMode === 'auto') {

                // 1. CTA Engine — selecionar CTA contextual
                if (FEATURE_SMART_CTA && _ctaEngine) {
                    try {
                        const _ctaResult = _ctaEngine.getCTA({
                            intent: _chatUniversalDecision?.intent || '',
                            action: '',
                            context: processedPageData || {},
                            conversationId: conversationId || null
                        });
                        if (_ctaResult) {
                            _cuCtaData = _ctaResult; // Guardar para Orchestrator
                            // V10: Se Orchestrator ativo, NÃO aplicar CTA inline (Orchestrator decide)
                            const _v10OrchestratorActive = orchestrator && featureFlags && featureFlags.isEnabled('FEATURE_ORCHESTRATOR_V10');
                            if (!_v10OrchestratorActive) {
                                finalResponse = _ctaEngine.applyCTA(finalResponse, _ctaResult) || finalResponse;
                            }
                            console.log(`[CTA_ENGINE] Coletado: type=${_ctaResult.type} intent=${_ctaResult.intent} applied=${!_v10OrchestratorActive}`);
                        }
                    } catch (_ctaErr) {
                        console.warn('[CTA_ENGINE] Erro (fallback):', _ctaErr.message);
                    }
                }

                // 2. Conversion Optimizer — otimizar estrutura da resposta
                if (FEATURE_CONVERSION_OPTIMIZER && _conversionOptimizer) {
                    try {
                        const _optimized = _conversionOptimizer.optimizeByPerformance({
                            response: finalResponse,
                            intent: _chatUniversalDecision?.intent || '',
                            historicalData: {}
                        });
                        finalResponse = _optimized || finalResponse;
                        if (_optimized && _optimized !== aiResponse) {
                            console.log('[CONVERSION_OPTIMIZER] Resposta otimizada');
                        }
                    } catch (_optErr) {
                        console.warn('[CONVERSION_OPTIMIZER] Erro (fallback):', _optErr.message);
                    }
                }

                // 3. Closing Scripts — frases de fechamento naturais
                if (FEATURE_CLOSING_SCRIPTS && _closingScripts) {
                    try {
                        const _closed = _closingScripts.applyClosingLayer({
                            response: finalResponse,
                            intent: _chatUniversalDecision?.intent || '',
                            action: '',
                            conversationId: conversationId || null
                        });
                        if (_closed && _closed !== finalResponse) {
                            // V10 FIX: Guardar APENAS o fragmento de closing (não a resposta inteira)
                            // _closed contém "resposta + closing", precisamos só do "closing"
                            const _closingFragment = _closed.startsWith(finalResponse)
                                ? _closed.substring(finalResponse.length).trim()
                                : _closed; // fallback: se não conseguir extrair, usa tudo
                            _cuClosingData = _closingFragment ? { text: _closingFragment } : null;
                        }
                        // V10: Se Orchestrator ativo, NÃO aplicar Closing inline (Orchestrator decide)
                        const _v10OrchClosing = orchestrator && featureFlags && featureFlags.isEnabled('FEATURE_ORCHESTRATOR_V10');
                        if (!_v10OrchClosing) {
                            finalResponse = _closed || finalResponse;
                        }
                        if (_closed && _closed !== finalResponse) {
                            console.log(`[CLOSING] Coletado: applied=${!_v10OrchClosing}`);
                        }
                    } catch (_clsErr) {
                        console.warn('[CLOSING] Erro (fallback):', _clsErr.message);
                    }
                }

                // 4. Anti-Dropoff — retenção leve (SEMPRE ÚLTIMO)
                if (FEATURE_ANTI_DROPOFF && _antiDropoff) {
                    try {
                        const _retained = _antiDropoff.applyAntiDropoff(finalResponse, message, conversationId || null);
                        finalResponse = _retained || finalResponse;
                    } catch (_adErr) {
                        console.warn('[ANTI_DROPOFF] Erro (fallback):', _adErr.message);
                    }
                }

            }
        } catch (_colErr) {
            console.warn('⚠️ [CONVERSION-LAYER] Erro geral (resposta original mantida):', _colErr.message);
        }

        // 🧠 [V10 ORCHESTRATOR] — Decisão Final Unificada
        try {
            if (orchestrator && featureFlags && featureFlags.isEnabled('FEATURE_ORCHESTRATOR_V10')) {
                const orchResult = orchestrator.apply({
                    response: aiResponse,  // resposta IA ORIGINAL (pré-camadas)
                    context: processedPageData || {},
                    decision: _chatUniversalDecision,
                    ctaData: _cuCtaData,
                    closingData: _cuClosingData,
                    mode: _reqSalesMode
                });

                if (orchResult && orchResult.orchestrated) {
                    finalResponse = orchResult.text;
                    console.log(`🧠 [ORCHESTRATOR_V10@chat-universal] Aplicado: reason=${orchResult.reason}`);
                }
            }
        } catch (_orchErr) {
            console.error('⚠️ [ORCHESTRATOR_V10@chat-universal] Erro (resposta mantida):', _orchErr.message);
            // Fallback: finalResponse fica inalterada
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🔥 [V11] ACTION RESOLVER + STATE UPDATE (chat-universal)
        // Injeção forçada do link correto + atualização de estado
        // Protegido por FEATURE_V11_ENGINE + try/catch
        // ═══════════════════════════════════════════════════════════════════
        try {
            const _v11Active = featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_V11_ENGINE');
            if (_v11Active) {
                const _v11Intent = _chatUniversalDecision?.intent || 'neutral';

                // Action Resolver — injeção forçada pós-IA
                if (_v11ResolveAction && _v11BuildLinksMap) {
                    const _v11Links = _v11BuildLinksMap(processedPageData || {});
                    const _v11ActionLink = _v11ResolveAction(_v11Intent, _v11Links);

                    if (_v11ActionLink && _v11Intent === 'buy' && !finalResponse.includes(_v11ActionLink)) {
                        finalResponse = `${finalResponse}\n\n👉 Finalizar agora: ${_v11ActionLink}`;
                        console.log(`[V11] 🔥 Action Resolver: checkout forçado (intent=buy)`);
                    }
                }

                // State Update — memória conversacional
                if (_v11ConversationState && conversationId) {
                    _v11ConversationState.updateState(conversationId, _v11Intent, message);
                }
            }
        } catch (_v11ActErr) {
            console.warn('[V11] ⚠️ Action Resolver / State erro (sem impacto):', _v11ActErr.message);
        }

        // 🧹 [V9.6 + V10] LIMPEZA FINAL DE SPAM EXPANDIDA (chat-universal)
        // Inclui frases proibidas pela V10 Behavior Layer
        try {
            finalResponse = finalResponse
                .replace(/Isso aqui é só a superfície[^\n]*/gi, '')
                .replace(/O mais interessante ainda não apareceu[^\n]*/gi, '')
                .replace(/Quer ver\??/gi, '')
                .replace(/Posso te mostrar rapidamente como isso funciona[^\n]*/gi, '')
                .replace(/Tem um detalhe que normalmente surpreende[^\n]*/gi, '')
                .replace(/Quer que eu te mostre o que mais chama aten[çc][aã]o[^\n]*/gi, '')
                .replace(/Tem bastante coisa legal aqui[^\n]*/gi, '')
                .replace(/Quer saber mais sobre isso\??/gi, '')
                .replace(/Quer que eu te mostre[^\n]*/gi, '')
                .replace(/Posso te explicar melhor[^\n]*/gi, '')
                .replace(/Faz sentido pra voc[eê]\??[^\n]*/gi, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        } catch (_) {}

        // 🔒 [V10.1] CHECKOUT BLOCKER — Remove checkout link quando intent ≠ buy
        // Se a IA incluiu o link mesmo sem ser pedido, remover. Rede de segurança.
        try {
            if (orchestrator && featureFlags && featureFlags.isEnabled('FEATURE_ORCHESTRATOR_V10')) {
                const { detectIntent: _cuDetectIntent, shouldBlockCheckout: _cuShouldBlock } = require('./lib/decision-core');
                const _cuIntent = _cuDetectIntent(message);
                
                if (_cuShouldBlock(_cuIntent)) {
                    const _cuCheckoutUrl = processedPageData?.checkoutLink || processedPageData?.checkoutUrl || '';
                    if (_cuCheckoutUrl && finalResponse.includes(_cuCheckoutUrl)) {
                        // Remover a URL de checkout e textos de CTA associados
                        finalResponse = finalResponse
                            .replace(new RegExp('\\n*.*' + _cuCheckoutUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '.*', 'g'), '')
                            .replace(/\n*👉[^\n]*finalizar[^\n]*/gi, '')
                            .replace(/\n*👉[^\n]*compra[^\n]*/gi, '')
                            .replace(/\n*👉[^\n]*garantir[^\n]*/gi, '')
                            .replace(/\n*Para comprar[^\n]*/gi, '')
                            .replace(/\n*Para adquirir[^\n]*/gi, '')
                            .replace(/\n{3,}/g, '\n\n')
                            .trim();
                        console.log(`[V10.1] 🔒 Checkout BLOQUEADO na resposta (intent="${_cuIntent}")`);
                    }
                }
            }
        } catch (_v101Err) {
            console.warn('[V10.1] ⚠️ Checkout blocker erro (resposta mantida):', _v101Err.message);
        }

        // 🔒 [V11.3.2] FASE 2 BLINDADA — ORQUESTRAÇÃO FINAL DE VENDAS
        // FIX V11.3.3: Recalcular hasCheckout/forceCheckout AQUI (processedPageData já existe)
        try {
            const checkout = processedPageData?.checkoutLink;
            const _blindHasCheckout = !!checkout;
            const _blindForceCheckout = _blindHasCheckout && buyIntent;

            console.log(`[V11.3-SALES] hasCheckout=${_blindHasCheckout} | forced=${_blindForceCheckout} | checkout=${checkout ? checkout.substring(0, 60) + '...' : 'N/A'} | apiKey=${apiKey?.substring(0,8)}...`);

            // Aviso de funil (intenção sem checkout disponível)
            if (buyIntent && !_blindHasCheckout) {
                console.warn(`[V11.3-CRITICAL] ⚠️ Intent detected but NO checkout available (funnel drop risk) | apiKey=${apiKey?.substring(0,8)}...`);
            }

            // 1. Override Absoluto (Force)
            if (_blindForceCheckout && checkout) {
                if (!hasValidCheckout(finalResponse, checkout)) {
                    console.log(`[V11.3-SALES] 🔥 OVERRIDE ATIVO: Forçando link no final | apiKey=${apiKey?.substring(0,8)}...`);
                    finalResponse += `\n\n━━━━━━━━━━━━━━━━━━━\n🚀 FINALIZAR COMPRA\n${checkout}\n━━━━━━━━━━━━━━━━━━━`;
                }
            }

            // 2. Proteção Anti-Sumiço (Rede de segurança se deveria ter link e não tem URL nenhuma)
            if (_blindHasCheckout && !hasAnyUrl(finalResponse) && buyIntent) {
                console.warn(`[V11.3-SALES-GUARD] 🛡️ Anti-Sumiço ativado: IA omitiu URL | apiKey=${apiKey?.substring(0,8)}...`);
                finalResponse += `\n\n👉 Acesse aqui para continuar:\n${checkout}`;
            }
        } catch (blindErr) {
            console.warn('[V11.3-SALES-GUARD] ⚠️ Erro na blindagem final:', blindErr.message);
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🔒 [V12.0] CAMADA 1 — SAFE CHECKOUT RESOLVER (chat-universal)
        // Validação de domínio e anti-cross-tenant ANTES do envio final
        // Protegido por FEATURE_V12_SAFE_CHECKOUT + try/catch
        // ═══════════════════════════════════════════════════════════════════
        try {
            const _v12SafeEnabled = featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_V12_SAFE_CHECKOUT');
            if (_v12SafeEnabled && _v12ValidateCheckout && processedPageData?.checkoutLink) {
                const _v12Validation = _v12ValidateCheckout(apiKey, processedPageData.checkoutLink);
                if (!_v12Validation.valid) {
                    console.warn(`[V12-SAFE@chat-universal] ⛔ Checkout BLOQUEADO: reason=${_v12Validation.reason} | tenant=${apiKey?.substring(0,8)}... | url=${processedPageData.checkoutLink.substring(0,60)}`);
                    // Remover checkout inválido da resposta
                    if (finalResponse.includes(processedPageData.checkoutLink)) {
                        finalResponse = finalResponse
                            .replace(new RegExp(processedPageData.checkoutLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[link removido por segurança]')
                            .replace(/\n*━[━]+\n[^\n]*FINALIZAR COMPRA[^\n]*\n\[link removido[^\n]*\n━[━]+/gi, '')
                            .replace(/\n{3,}/g, '\n\n')
                            .trim();
                    }
                } else {
                    console.log(`[V12-SAFE@chat-universal] ✅ Checkout válido: tenant=${apiKey?.substring(0,8)}... domain=${_v12Validation.domain || 'ok'}`);
                }
            }
        } catch (_v12SafeErr) {
            console.warn('[V12-SAFE@chat-universal] ⚠️ Erro (resposta mantida):', _v12SafeErr.message);
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🔥 [V12.0] CAMADA 2 — FORCE CHECKOUT LAYER (chat-universal)
        // Backend soberano: garante checkout quando IA detecta intenção de compra
        // Protegido por FEATURE_V12_FORCE_CHECKOUT + try/catch
        // ═══════════════════════════════════════════════════════════════════
        try {
            const _v12ForceEnabled = featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_V12_FORCE_CHECKOUT');
            const _v12SalesMode = (processedPageData && processedPageData.salesMode) ||
                req.body?.salesMode || req.body?.sales_mode ||
                process.env.SALES_LAYER_MODE || 'auto';

            if (_v12ForceEnabled && _v12ForceCheckoutPipeline && _v12SalesMode === 'auto') {
                const _v12Result = _v12ForceCheckoutPipeline({
                    response: finalResponse,
                    message: message,
                    checkoutLink: processedPageData?.checkoutLink || null,
                    mode: _v12SalesMode
                });

                if (_v12Result && _v12Result.forced) {
                    finalResponse = _v12Result.text;
                    console.log(`[V12-FORCE@chat-universal] 🔥 Aplicado: reason=${_v12Result.reason} | tenant=${apiKey?.substring(0,8)}...`);

                    // ═══ V12.1 FIX: Auto-persistir checkout no DB quando Force Checkout aplica ═══
                    // Elimina necessidade de ativação manual — salva automaticamente
                    try {
                        const _forceCheckoutLink = processedPageData?.checkoutLink || null;
                        const _forceSalesUrl = processedPageData?.url || processedPageData?.salesUrl || url || null;
                        if (_forceCheckoutLink && _forceSalesUrl && _v113SaveCheckoutLink && apiKey) {
                            const _forceDomainOk = !_v113IsValidCheckoutDomain || _v113IsValidCheckoutDomain(_forceCheckoutLink);
                            if (_forceDomainOk) {
                                _v113SaveCheckoutLink(db, apiKey, _forceCheckoutLink, 'auto_force_checkout', false, _forceSalesUrl)
                                    .then(saved => {
                                        if (saved) console.log(`[V12-FORCE] 💾 Checkout auto-persistido no DB: tenant=${apiKey?.substring(0,8)}... url=${_forceCheckoutLink.substring(0, 60)}`);
                                    })
                                    .catch(() => {}); // fire-and-forget
                            }
                        }
                    } catch (_forceSaveErr) {
                        // Silencioso — persistência é best-effort
                    }
                }
            }
        } catch (_v12ForceErr) {
            console.warn('[V12-FORCE@chat-universal] ⚠️ Erro (resposta mantida):', _v12ForceErr.message);
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🧠 [V12.1] SELF-HEALING ENGINE (chat-universal)
        // Detecta e corrige falhas automaticamente
        // Protegido por FEATURE_V12_SELF_HEALING + try/catch
        // ═══════════════════════════════════════════════════════════════════
        try {
            const _v12HealEnabled = featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_V12_SELF_HEALING');
            const _v12HealMode = (processedPageData && processedPageData.salesMode) || 'auto';

            if (_v12HealEnabled && _v12ApplyHealing && _v12HealMode === 'auto') {
                const _v12HealResult = _v12ApplyHealing({
                    response: finalResponse,
                    checkoutLink: processedPageData?.checkoutLink || null,
                    intent: _chatUniversalDecision?.intent || 'neutral',
                    message: message,
                    apiKey: apiKey,
                    mode: _v12HealMode
                });

                if (_v12HealResult && _v12HealResult.healed) {
                    finalResponse = _v12HealResult.text;
                    console.log(`[V12-HEAL@chat-universal] 🧠 Auto-correção: type=${_v12HealResult.failureType} | tenant=${apiKey?.substring(0,8)}...`);

                    // Registrar falha para aprendizado
                    if (_v12SaveFailure) {
                        _v12SaveFailure(apiKey, _v12HealResult.failureType, { intent: _chatUniversalDecision?.intent, message });
                    }
                } else {
                    // Registrar sucesso
                    if (_v12SaveSuccess) {
                        _v12SaveSuccess(apiKey, _chatUniversalDecision?.intent || 'neutral', { checkoutLink: processedPageData?.checkoutLink, response: finalResponse });
                    }
                }
            }
        } catch (_v12HealErr) {
            console.warn('[V12-HEAL@chat-universal] ⚠️ Erro (resposta mantida):', _v12HealErr.message);
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🔍 [V12.1] RESPONSE VALIDATOR (chat-universal)
        // Valida resposta final — log de problemas
        // ═══════════════════════════════════════════════════════════════════
        try {
            if (_v12ValidateResponse) {
                const _v12ValResult = _v12ValidateResponse({
                    response: finalResponse,
                    checkoutLink: processedPageData?.checkoutLink || null,
                    intent: _chatUniversalDecision?.intent || 'neutral',
                    message: message
                });

                if (_v12ValResult.errors.length > 0) {
                    console.warn(`[V12-VALIDATOR@chat-universal] ❌ Erros: ${_v12ValResult.errors.join(', ')} | tenant=${apiKey?.substring(0,8)}...`);
                }
                if (_v12ValResult.warnings.length > 0) {
                    console.warn(`[V12-VALIDATOR@chat-universal] ⚠️ Avisos: ${_v12ValResult.warnings.join(', ')} | tenant=${apiKey?.substring(0,8)}...`);
                }
            }
        } catch (_v12ValErr) {
            // Silencioso — validator é observacional
        }
        } // V13.0.3: Fim do bloco else (legado V10-V12 PULADO quando V13 ativo)

        // 💳 Billing: registrar uso de mensagem
        billingManager.trackUsage(apiKey, 'messages');

        return res.json({
            success: true,
            response: finalResponse,
            bonuses_detected: processedPageData?.bonuses_detected || [],
            contatos: processedPageData?.contatos || {},
            metadata: {
                hasPageData: !!processedPageData,
                contentLength: processedPageData?.cleanText?.length || 0,
                method: processedPageData?.method || "none"
            }
        });

    } catch (error) {
        analytics.errors++;
        logger.error("Chat endpoint error:", error.message || error);
        return res.status(500).json({
            success: false,
            error: "Erro interno ao gerar resposta: " + (error.message || "Erro desconhecido"),
            details: error.message
        });
    }
});

// ===== 🎯 ENDPOINT SUPERINTELIGENTE - /api/process-chat-inteligente =====
/**
 * 💣 applyDecisionCoreSafe — V9 SAAS SAFE
 * Interceptador determinístico para garantir ações críticas.
 * REFORÇA a IA com o elemento de ação correto (Link/Suporte).
 */
function applyDecisionCoreSafe({
  message,
  response,
  context,
  tenantConfig,
  salesMode
}) {
  try {
    // 1. Respeitar modo de vendas (bypass se não for auto)
    if (salesMode === 'manual' || salesMode === 'off') {
      return { text: response, overridden: false };
    }

    // 2. Feature flag
    if (!featureFlags || !featureFlags.isEnabled('FEATURE_DECISION_CORE')) {
      return { text: response, overridden: false };
    }

    // 3. Detecção de intenção
    const decision = buildDecision(message);
    
    if (!decision.shouldOverride) {
      return { text: response, overridden: false };
    }

    console.log(`🧠 [DECISION_CORE] Intent="${decision.intent}" detected. Applying override logic...`);

    // 🎯 COMPRA: Injetar link se necessário
    if (decision.intent === 'buy') {
      const link = resolveCheckoutLink({ context, tenantConfig });

      if (link && !response.includes(link)) {
        return {
          text: `${response}\n\n👉 Para finalizar com segurança, use este link:\n${link}`,
          overridden: true
        };
      }
    }

    // 🎯 PÓS-VENDA: Injetar guia de suporte
    if (decision.intent === 'post_sale') {
      const supportMsg = "Perfeito, como você já comprou, me diga o que você já recebeu que eu te guio no próximo passo.";
      if (!response.includes("já comprou") && !response.includes("guio no próximo")) {
        return {
          text: `${response}\n\n👉 ${supportMsg}`,
          overridden: true
        };
      }
    }

    return { text: response, overridden: false };

  } catch (err) {
    console.error('⚠️ [DECISION_CORE_ERROR]', err.message);
    return { text: response, overridden: false };
  }
}

app.post("/api/process-chat-inteligente", ...[requireApiKey, billingMiddleware].filter(Boolean), async (req, res) => {
    const apiKey = req.cliente?.apiKey || req.session?.validatedApiKey || req.body.apiKey;
    const leadSystem = getLeadSystem(apiKey);
    analytics.chatRequests++;
    try {
        const { message, pageData, url, conversationId, instructions = "", robotName, leadId } = req.body || {};

        if (!message) {
            return res.status(400).json({
                success: false,
                error: "Mensagem é obrigatória"
            });
        }

        console.log('🧠 [SUPER-INTELIGENCIA] Processando mensagem:', {
            messageLength: message.length,
            url: url || 'none',
            leadId: leadId || 'none'
        });

        if (conversationId) {
            analytics.activeChats.add(conversationId);
            setTimeout(() => analytics.activeChats.delete(conversationId), 30 * 60 * 1000);
        }

        let processedPageData = pageData;

        // 🚨 CORREÇÃO CRÍTICA: O widget envia pageData apenas com URL
        // Precisamos verificar se tem conteúdo real, senão extrair
        const hasContent = processedPageData && (processedPageData.cleanText || processedPageData.title);
        const targetUrl = url || (processedPageData && processedPageData.url);

        if (!hasContent && targetUrl) {
            console.log(`🔄 [WIDGET FIX] PageData incompleto detectado. Iniciando extração para: ${targetUrl}`);
            try {
                // 🔒 V9.3.2 FIX-1: Salvar checkoutLink do widget ANTES do spread
                const _widgetCheckoutPreserve = processedPageData?.checkoutLink || null;
                const extractionResult = await extractPageData(targetUrl);
                // Mesclar: extraction como base, widget como override (preserva campos do widget)
                processedPageData = { ...extractionResult, ...processedPageData };
                // 🔒 V9.3.2: Garantir restauração do checkoutLink do widget (prioridade máxima)
                if (_widgetCheckoutPreserve) {
                    processedPageData.checkoutLink = _widgetCheckoutPreserve;
                    console.log('[V9.3.2-FIX1] ✅ checkoutLink do widget preservado após merge:', _widgetCheckoutPreserve.substring(0, 80));
                }
            } catch (extractErr) {
                console.error("❌ Erro na extração automática do widget:", extractErr);
                // Continua com o que tem para não quebrar
            }
        } else if (!processedPageData && targetUrl) {
            processedPageData = await extractPageData(targetUrl);
        }

        // 🔍 [V9.1 AUTO-CHECKOUT] Preservar checkoutLink do widget no processedPageData
        // Protegido por feature flag FEATURE_AUTO_CHECKOUT_DETECTION
        try {
            const _autoCheckoutEnabled2 = featureFlags && featureFlags.isEnabled('FEATURE_AUTO_CHECKOUT_DETECTION');
            if (_autoCheckoutEnabled2) {
                const _intWidgetCheckout = req.body?.pageData?.checkoutLink || req.body?.context?.checkoutLink || null;
                if (_intWidgetCheckout && processedPageData) {
                    // 🔒 V9.3.2 FIX-2: Widget SEMPRE tem prioridade máxima (conforme link-resolver.js)
                    processedPageData.checkoutLink = _intWidgetCheckout;
                    console.log('[AUTO-CHECKOUT@inteligente] ✅ Link do widget (prioridade máx):', _intWidgetCheckout.substring(0, 80));
                }
            }
        } catch(_ckErr) { console.warn('[AUTO-CHECKOUT@inteligente] Erro (silencioso):', _ckErr.message); }

        // 🎯 SUPERINTELIGÊNCIA: Análise Emocional Avançada
        const analiseEmocional = superInteligencia.analisarEmocao(message);

        // ================================================================
        // 📅 SAFE PATCH - SCHED-PRIORITY-001: Agendamento tem prioridade ABSOLUTA
        // Problema: KB-FIRST interceptava "quero agendar" porque "quero" matchava
        // FAQs de compra (score >= 3 via bonus de especificidade).
        // Fix: detectarAgendamento roda ANTES de KB-FIRST. Se detectado,
        // retorna calendário visual e bypassa KB/inteligências/IA completamente.
        // O sistema de calendário real já está ativo e implantado.
        // ================================================================
        try {
            const respostaAgendamentoEarly = superInteligencia.detectarAgendamento(message);
            if (respostaAgendamentoEarly) {
                console.log(`📅 [SCHED-PRIORITY] Agendamento EXPLÍCITO detectado ANTES do KB-FIRST — bypass total`);
                
                // Manter tracking do lead
                let effectiveLeadId = leadId;
                if (!effectiveLeadId && conversationId) {
                    try {
                        const leadByConversation = leadSystem.findLeadByConversationId(conversationId);
                        if (leadByConversation) effectiveLeadId = leadByConversation.id;
                    } catch (_) {}
                }
                if (effectiveLeadId) {
                    try {
                        leadSystem.updateLeadConversation(effectiveLeadId, message, true);
                        leadSystem.updateLeadConversation(effectiveLeadId, respostaAgendamentoEarly, false);
                    } catch (_) {}
                }

                // Billing tracking
                try { billingManager.trackUsage(apiKey, 'messages'); } catch (_) {}

                // SAFE PATCH - CALENDAR-001: Incluir calendarHash para o widget renderizar calendário
                let calendarHash = null;
                try {
                    if (schedulingManager) {
                        calendarHash = schedulingManager.generatePublicHash(apiKey);
                    }
                } catch (hashErr) {
                    console.warn('⚠️ [CALENDAR] Erro ao gerar hash público:', hashErr.message);
                }

                return res.json({
                    success: true,
                    response: respostaAgendamentoEarly,
                    calendarHash: calendarHash,
                    inteligenciasDetectadas: {},
                    analiseEmocional: analiseEmocional,
                    journeyStage: 'agendamento',
                    bonuses_detected: processedPageData?.bonuses_detected || [],
                    contatos: processedPageData?.contatos || {},
                    metadata: {
                        hasPageData: !!processedPageData,
                        contentLength: processedPageData?.cleanText?.length || 0,
                        method: 'scheduling-priority',
                        sistema: 'sched-priority-v1'
                    }
                });
            }
        } catch (schedErr) {
            console.warn('⚠️ [SCHED-PRIORITY] Erro na detecção de agendamento (fluxo original continua):', schedErr.message);
            // Não propaga — fluxo original é o fallback seguro
        }

        // ================================================================
        // 📚 SAFE PATCH - KB-FIRST-001: Consultar Knowledge Base PRIMEIRO
        // Antes: detectarAgendamento e capturarInteligencias rodavam ANTES do KB,
        // sequestrando a resposta com outputs genéricos/agendamento falso.
        // Agora: Se KB tem FAQ com match de score alto, retorna direto (bypass total).
        // Se KB vazio ou sem match, fluxo original continua intacto.
        // ================================================================
        let kbDirectAnswer = null;
        try {
            // Usar searchSmart (tokenização por palavras) em vez de search (substring)
            // Busca por: apiKey (identificador do tenant) E robotName/chatbotId
            const kbSearchId = robotName || apiKey;
            if (kbSearchId) {
                const kbResults = knowledgeBaseManager.searchSmart(kbSearchId, message, 3);
                
                // Fallback: tentar também com apiKey se robotName não teve resultado
                let allResults = kbResults;
                if ((!kbResults || kbResults.length === 0) && robotName && apiKey && robotName !== apiKey) {
                    const kbResultsFallback = knowledgeBaseManager.searchSmart(apiKey, message, 3);
                    allResults = kbResultsFallback;
                }

                if (allResults && allResults.length > 0) {
                    const bestMatch = allResults[0];
                    // Score >= 3 = match forte → resposta direta da FAQ
                    if (bestMatch.type === 'faq' && bestMatch.score >= 3) {
                        kbDirectAnswer = bestMatch.data.answer;
                        console.log(`📚 [KB-FIRST] FAQ DIRETA (score=${bestMatch.score}): "${bestMatch.data.question.substring(0, 60)}"`);
                    } 
                    // Score >= 2 = match médio → será injetado como contexto para IA
                    else if (bestMatch.score >= 2) {
                        console.log(`📚 [KB-FIRST] FAQ como CONTEXTO (score=${bestMatch.score}): "${bestMatch.data?.question?.substring(0, 60) || bestMatch.data?.title?.substring(0, 60)}"`);
                    }
                }
            }
        } catch (kbFirstErr) {
            console.warn('⚠️ [KB-FIRST] Erro na busca inteligente (fluxo original continua):', kbFirstErr.message);
            // Não propaga erro — fluxo original é o fallback seguro
        }

        // 📚 [KB-FIRST] Se encontrou FAQ com resposta direta → retorna sem chamar nenhum outro sistema
        if (kbDirectAnswer) {
            // Atualizar lead se existir (manter tracking)
            let effectiveLeadId = leadId;
            if (!effectiveLeadId && conversationId) {
                try {
                    const leadByConversation = leadSystem.findLeadByConversationId(conversationId);
                    if (leadByConversation) effectiveLeadId = leadByConversation.id;
                } catch (_) {}
            }
            if (effectiveLeadId) {
                try {
                    leadSystem.updateLeadConversation(effectiveLeadId, message, true);
                    leadSystem.updateLeadConversation(effectiveLeadId, kbDirectAnswer, false);
                } catch (_) {}
            }

            // Billing tracking
            try { billingManager.trackUsage(apiKey, 'messages'); } catch (_) {}

            console.log(`📚 [KB-FIRST] Resposta via FAQ direta — bypass total de agendamento/inteligências/IA`);
            return res.json({
                success: true,
                response: kbDirectAnswer,
                inteligenciasDetectadas: {},
                analiseEmocional: analiseEmocional,
                journeyStage: 'descoberta',
                bonuses_detected: processedPageData?.bonuses_detected || [],
                contatos: processedPageData?.contatos || {},
                metadata: {
                    hasPageData: !!processedPageData,
                    contentLength: processedPageData?.cleanText?.length || 0,
                    method: 'kb-direct-smart',
                    sistema: 'kb-first-v1'
                }
            });
        }

        // ================================================================
        // FLUXO ORIGINAL (inalterado) — executado quando KB não tem match
        // ================================================================

        // 🎯 CAPTURA DE INTENÇÕES DO CLIENTE
        let inteligencias = sistemaInteligencias.capturarInteligencias(message);

        // 🎯 ANÁLISE DE JORNADA
        const journeyStage = journeyAnalyzer.analyzeJourneyStage(message);

        // 🎯 SELEÇÃO DE PERSONALIDADE ADAPTATIVA
        const personalidade = superInteligencia.selecionarPersonalidade(
            analiseEmocional.emocao,
            analiseEmocional.intensidade,
            journeyStage
        );

        // 🎯 ATUALIZAR CONVERSA DO LEAD SE EXISTIR
        // Buscar lead por leadId ou conversationId
        let effectiveLeadId = leadId;
        if (!effectiveLeadId && conversationId) {
            const leadByConversation = leadSystem.findLeadByConversationId(conversationId);
            if (leadByConversation) {
                effectiveLeadId = leadByConversation.id;
            }
        }
        if (effectiveLeadId) {
            leadSystem.updateLeadConversation(effectiveLeadId, message, true);
            leadSystem.updateLeadJourneyStage(effectiveLeadId, journeyStage);
        }

        let finalResponse = "";

        // 📅 [SCHED-PRIORITY-001] detectarAgendamento agora roda ANTES do KB-FIRST (linhas 5217-5267)
        // Se chegou aqui, significa que NÃO é agendamento. Prosseguir com inteligências.

        // 🎯 USAR SISTEMA INTELIGENTE SE INTENÇÕES FORAM DETECTADAS
        if (Object.values(inteligencias).some(val => val === true)) {
            const contatos = processedPageData?.contatos || {};

            // Gerar resposta base com empatia
            const respostaEmpatica = superInteligencia.gerarRespostaEmpatica(
                message,
                analiseEmocional,
                personalidade,
                contatos
            );

            // Combinar com resposta contextual
            const respostaContextual = sistemaInteligencias.gerarRespostaContextual(
                inteligencias,
                contatos,
                journeyStage
            );

            finalResponse = respostaEmpatica + respostaContextual;
            console.log(`🎭 Resposta emocional inteligente gerada`);
        } else {
            // 🎯 USAR SISTEMA ORIGINAL COM MELHORIAS EMOCIONAIS
            // 🎯 FEATURE_CLEAN_CHAT_V2: Passar robotName como chatbotId para busca de FAQs
            const respostaIA = await generateAIResponse(message, processedPageData || {}, [], instructions, leadId, apiKey, robotName || null);

            // 🎯 FEATURE_CLEAN_CHAT_V2: Pular pós-processamento emocional quando flag ativa
            if (process.env.FEATURE_CLEAN_CHAT_V2 === 'true' || (featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_CLEAN_CHAT_V2'))) {
                finalResponse = respostaIA;
                console.log(`🧹 [CLEAN_CHAT_V2] Resposta IA sem pós-processamento emocional`);
            } else {
                // Aplicar melhorias emocionais na resposta (comportamento original)
                if (analiseEmocional.emocao === "negativo" && analiseEmocional.intensidade >= 2) {
                    finalResponse = `🤗 **Entendo que isso é importante para você.** ` + respostaIA;
                } else if (analiseEmocional.urgencia) {
                    finalResponse = `🚨 **Priorizando sua solicitação!** ` + respostaIA;
                } else {
                    finalResponse = respostaIA;
                }
                console.log(`🤖 Resposta IA com melhorias emocionais`);
            }
        }

        // 🎯 ATUALIZAR RESPOSTA NO LEAD SE EXISTIR
        if (effectiveLeadId) {
            leadSystem.updateLeadConversation(effectiveLeadId, finalResponse, false);
        }

        // 💳 Billing: registrar uso de mensagem
        billingManager.trackUsage(apiKey, 'messages');

        // SAFE PATCH - CALENDAR-006: Incluir calendarHash quando resposta contém [CALENDAR_WIDGET]
        // Problema: Apenas o SCHED-PRIORITY path retornava calendarHash. Se o fluxo principal
        // gerar [CALENDAR_WIDGET] via inteligências/IA, o widget não recebia o hash e
        // mostrava texto bruto em vez do calendário interativo.
        let mainFlowCalendarHash = null;
        try {
            if (finalResponse && finalResponse.indexOf('[CALENDAR_WIDGET]') !== -1 && schedulingManager) {
                mainFlowCalendarHash = schedulingManager.generatePublicHash(apiKey);
                console.log('📅 [CALENDAR-006] calendarHash injetado no fluxo principal:', mainFlowCalendarHash ? 'OK' : 'null');
            }
        } catch (hashErr) {
            console.warn('⚠️ [CALENDAR-006] Erro ao gerar calendarHash (não bloqueia resposta):', hashErr.message);
        }

        // 🧠 V2.0 AUTO-LEARNING: Otimizar resposta com dados aprendidos (ADITIVO, fire-and-forget)
        // Se auto-learning não está disponível ou falha, finalResponse fica inalterada
        try {
            if (autoLearning && (process.env.FEATURE_AUTO_LEARNING === 'true' ||
                (featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_AUTO_LEARNING')))) {
                // 1) Otimizar resposta com dados aprendidos (retorna original se sem dados)
                const optimized = autoLearning.optimizeResponse(
                    finalResponse,
                    inteligencias?.intencao_compra ? 'purchase' : (inteligencias?.preco ? 'pricing' : 'general'),
                    analiseEmocional?.emocao || 'neutro',
                    journeyStage || 'descoberta'
                );
                if (optimized && typeof optimized === 'string' && optimized.length > 0) {
                    finalResponse = optimized;
                    console.log('🧠 [AUTO-LEARNING] Resposta otimizada com dados aprendidos');
                }

                // 2) Registrar interação (fire-and-forget, NUNCA bloqueia)
                setImmediate(() => {
                    try {
                        autoLearning.recordInteraction({
                            conversationId: conversationId || 'unknown',
                            userMessage: message,
                            aiResponse: finalResponse,
                            detectedIntent: inteligencias?.intencao_compra ? 'purchase' : 'general',
                            journeyStage: journeyStage || 'descoberta',
                            emotionalState: analiseEmocional?.emocao || 'neutro',
                            apiKey: apiKey,
                            robotName: robotName || null
                        });
                    } catch (recErr) {
                        console.warn('⚠️ [AUTO-LEARNING] Erro ao registrar (não crítico):', recErr.message);
                    }
                });
            }
        } catch (alErr) {
            console.warn('⚠️ [AUTO-LEARNING] Erro na otimização (resposta original mantida):', alErr.message);
            // Fallback: finalResponse fica inalterada, zero impacto
        }

        // 🔥 [CONVERSION-LAYER] Pipeline de Otimização — SOMENTE modo auto + feature flags
        // V10: Coletar dados de CTA e Closing para o Orchestrator
        let _intCtaData = null;
        let _intClosingData = null;
        const _intAiResponseOriginal = finalResponse; // Guardar resposta IA original pré-camadas
        try {
            const _intSalesMode = (processedPageData && processedPageData.salesMode) ||
                req.body?.salesMode || req.body?.sales_mode || process.env.SALES_LAYER_MODE || 'auto';

            if (_intSalesMode === 'auto') {

                // Extrair intent/action do contexto do endpoint inteligente
                const _intIntent = inteligencias?.intencao_compra ? 'comprar' :
                    (inteligencias?.objecao ? 'objecao' :
                    (inteligencias?.sair ? 'sair' :
                    (inteligencias?.curioso ? 'curioso' : '')));

                // 1. CTA Engine — selecionar CTA contextual
                if (FEATURE_SMART_CTA && _ctaEngine) {
                    try {
                        const _ctaResult = _ctaEngine.getCTA({
                            intent: _intIntent,
                            action: '',
                            context: processedPageData || {},
                            conversationId: conversationId || null
                        });
                        if (_ctaResult) {
                            _intCtaData = _ctaResult; // Guardar para Orchestrator
                            // V10: Se Orchestrator ativo, NÃO aplicar CTA inline (Orchestrator decide)
                            const _v10OrchCTAInt = orchestrator && featureFlags && featureFlags.isEnabled('FEATURE_ORCHESTRATOR_V10');
                            if (!_v10OrchCTAInt) {
                                finalResponse = _ctaEngine.applyCTA(finalResponse, _ctaResult) || finalResponse;
                            }
                            console.log(`[CTA_ENGINE@inteligente] Coletado: type=${_ctaResult.type} applied=${!_v10OrchCTAInt}`);
                        }
                    } catch (_ctaErr) {
                        console.warn('[CTA_ENGINE] Erro (fallback):', _ctaErr.message);
                    }
                }

                // 2. Conversion Optimizer — otimizar estrutura da resposta
                if (FEATURE_CONVERSION_OPTIMIZER && _conversionOptimizer) {
                    try {
                        const _preOptimized = finalResponse;
                        const _optimized = _conversionOptimizer.optimizeByPerformance({
                            response: finalResponse,
                            intent: _intIntent,
                            historicalData: {}
                        });
                        finalResponse = _optimized || finalResponse;
                        if (_optimized && _optimized !== _preOptimized) {
                            console.log('[CONVERSION_OPTIMIZER] Resposta otimizada');
                        }
                    } catch (_optErr) {
                        console.warn('[CONVERSION_OPTIMIZER] Erro (fallback):', _optErr.message);
                    }
                }

                // 3. Closing Scripts — frases de fechamento naturais
                if (FEATURE_CLOSING_SCRIPTS && _closingScripts) {
                    try {
                        const _preClosed = finalResponse;
                        const _closed = _closingScripts.applyClosingLayer({
                            response: finalResponse,
                            intent: _intIntent,
                            action: '',
                            conversationId: conversationId || null
                        });
                        if (_closed && _closed !== _preClosed) {
                            // V10 FIX: Guardar APENAS o fragmento de closing (não a resposta inteira)
                            // _closed contém "resposta + closing", precisamos só do "closing"
                            const _closingFragmentInt = _closed.startsWith(_preClosed)
                                ? _closed.substring(_preClosed.length).trim()
                                : _closed; // fallback: se não conseguir extrair, usa tudo
                            _intClosingData = _closingFragmentInt ? { text: _closingFragmentInt } : null;
                        }
                        // V10: Se Orchestrator ativo, NÃO aplicar Closing inline (Orchestrator decide)
                        const _v10OrchClsInt = orchestrator && featureFlags && featureFlags.isEnabled('FEATURE_ORCHESTRATOR_V10');
                        if (!_v10OrchClsInt) {
                            finalResponse = _closed || finalResponse;
                        }
                        if (_closed && _closed !== _preClosed) {
                            console.log(`[CLOSING@inteligente] Coletado: applied=${!_v10OrchClsInt}`);
                        }
                    } catch (_clsErr) {
                        console.warn('[CLOSING] Erro (fallback):', _clsErr.message);
                    }
                }

                // 4. Anti-Dropoff — retenção leve (SEMPRE ÚLTIMO)
                if (FEATURE_ANTI_DROPOFF && _antiDropoff) {
                    try {
                        const _retained = _antiDropoff.applyAntiDropoff(finalResponse, message, conversationId || null);
                        finalResponse = _retained || finalResponse;
                    } catch (_adErr) {
                        console.warn('[ANTI_DROPOFF] Erro (fallback):', _adErr.message);
                    }
                }

            }
        } catch (_colErr) {
            console.warn('⚠️ [CONVERSION-LAYER] Erro geral (resposta original mantida):', _colErr.message);
        }

        // 🧠 [DECISION-CORE-V9] — Orquestração Determinística Final
        // V10: Quando Orchestrator ativo, Decision Core Safe NÃO aplica override inline
        //      (Orchestrator já gerencia buy/post_sale). Apenas extrai _intDecision.
        let _intDecision = null;
        try {
            const _intSalesModeDC = (processedPageData && processedPageData.salesMode) || 
                          req.body?.salesMode || req.body?.sales_mode || 
                          process.env.SALES_LAYER_MODE || 'auto';

            // Extrair decision para uso pelo Orchestrator (SEMPRE)
            if (typeof buildDecision === 'function') {
                _intDecision = buildDecision(message);
            }

            // V10: Se Orchestrator ativo, pular applyDecisionCoreSafe (Orchestrator decide)
            const _dcOrchActive = orchestrator && featureFlags && featureFlags.isEnabled('FEATURE_ORCHESTRATOR_V10');
            if (!_dcOrchActive) {
                const decisionResult = applyDecisionCoreSafe({
                    message: message,
                    response: finalResponse,
                    context: processedPageData,
                    tenantConfig: req.cliente,
                    salesMode: _intSalesModeDC
                });
                
                if (decisionResult.overridden) {
                    finalResponse = decisionResult.text;
                    console.log(`🛡️ [DECISION_CORE] Resposta reforçada com decisão determinística.`);
                }
            } else {
                console.log(`🧠 [DECISION_CORE@inteligente] ⏭️ Bypass applyDecisionCoreSafe — Orchestrator V10 ativo (intent=${_intDecision?.intent || 'N/A'})`);
            }
        } catch (decErr) {
            console.error('⚠️ [DECISION_CORE_FAILSAFE] Erro na aplicação:', decErr.message);
        }

        // 🧠 [V10 ORCHESTRATOR] — Decisão Final Unificada
        try {
            if (orchestrator && featureFlags && featureFlags.isEnabled('FEATURE_ORCHESTRATOR_V10')) {
                const _intSalesModeOrch = (processedPageData && processedPageData.salesMode) || 
                          req.body?.salesMode || req.body?.sales_mode || 
                          process.env.SALES_LAYER_MODE || 'auto';

                // V10: Usar resposta IA original (antes das camadas) + dados reais de CTA/Closing
                const orchResult = orchestrator.apply({
                    response: _intAiResponseOriginal || finalResponse,  // resposta IA ORIGINAL (pré-camadas)
                    context: processedPageData || {},
                    decision: _intDecision,
                    ctaData: _intCtaData,      // V10: dados reais de CTA (não mais null)
                    closingData: _intClosingData, // V10: dados reais de Closing (não mais null)
                    mode: _intSalesModeOrch
                });

                if (orchResult && orchResult.orchestrated) {
                    finalResponse = orchResult.text;
                    console.log(`🧠 [ORCHESTRATOR_V10@inteligente] Aplicado: reason=${orchResult.reason}`);
                }
            }
        } catch (_orchErr) {
            console.error('⚠️ [ORCHESTRATOR_V10@inteligente] Erro (resposta mantida):', _orchErr.message);
            // Fallback: finalResponse fica inalterada
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🔥 [V11] ACTION RESOLVER + STATE UPDATE (process-chat-inteligente)
        // Injeção forçada do link correto + atualização de estado
        // Protegido por FEATURE_V11_ENGINE + try/catch
        // ═══════════════════════════════════════════════════════════════════
        try {
            const _v11ActiveInt = featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_V11_ENGINE');
            if (_v11ActiveInt) {
                const _v11IntIntent = _intDecision?.intent || 'neutral';

                // Action Resolver — injeção forçada pós-IA
                if (_v11ResolveAction && _v11BuildLinksMap) {
                    const _v11IntLinks = _v11BuildLinksMap(processedPageData || {});
                    const _v11IntActionLink = _v11ResolveAction(_v11IntIntent, _v11IntLinks);

                    if (_v11IntActionLink && _v11IntIntent === 'buy' && !finalResponse.includes(_v11IntActionLink)) {
                        finalResponse = `${finalResponse}\n\n👉 Finalizar agora: ${_v11IntActionLink}`;
                        console.log(`[V11] 🔥 Action Resolver (inteligente): checkout forçado (intent=buy)`);
                    }
                }

                // State Update — memória conversacional
                if (_v11ConversationState && conversationId) {
                    _v11ConversationState.updateState(conversationId, _v11IntIntent, message);
                }
            }
        } catch (_v11IntActErr) {
            console.warn('[V11] ⚠️ Action Resolver / State (inteligente) erro (sem impacto):', _v11IntActErr.message);
        }

        // 🧠 [V9.5] CHECKOUT AUTHORITY — HARD OVERRIDE FINAL (process-chat-inteligente)
        // V10: Quando Orchestrator ativo, Checkout Authority é bypass (Orchestrator já gerencia links)
        try {
            const _v95OrchActiveInt = orchestrator && featureFlags && featureFlags.isEnabled('FEATURE_ORCHESTRATOR_V10');
            const _v95SalesMode = (processedPageData && processedPageData.salesMode) ||
                req.body?.salesMode || req.body?.sales_mode ||
                process.env.SALES_LAYER_MODE || 'auto';

            if (!_v95OrchActiveInt && _v95SalesMode === 'auto' && featureFlags && featureFlags.isEnabled('FEATURE_CHECKOUT_AUTHORITY')) {

                const _v95Msg = (message || '').toLowerCase();
                const _v95BuyIntent = /(comprar|compr[ae]r|quero comprar|quero comp|pagar|checkout|finalizar|adquirir|assinar|garantir|onde compro|como compro|link de compra|quero esse|quero o produto|me manda o link|quero adquirir|quanto custa|qual o pre[cç]o|como fa[cç]o pra comprar|quero pagar|bora fechar|fechar negocio|vou levar|quero contratar)/i.test(_v95Msg);

                if (_v95BuyIntent) {

                    let _v95CheckoutUrl = processedPageData?.checkoutLink;

                    // fallback: resolver novamente via link-resolver
                    if (!_v95CheckoutUrl) {
                        try {
                            _v95CheckoutUrl = resolveCheckoutLink({ context: processedPageData, tenantConfig: req.cliente });
                        } catch (_) {}
                    }

                    if (_v95CheckoutUrl && !finalResponse.includes(_v95CheckoutUrl)) {
                        console.log('[CHECKOUT_AUTHORITY@inteligente] 🔥 FORÇANDO CHECKOUT:', _v95CheckoutUrl);
                        finalResponse = `${finalResponse}\n\n👉 Para finalizar sua compra com segurança, use este link oficial:\n${_v95CheckoutUrl}`.trim();
                    }

                    // 🔥 [V9.6] FAILSAFE ABSOLUTO (com fallback para URL original)
                    if (!finalResponse.includes('http')) {
                        const _v95Fallback = processedPageData?._originalUrl || processedPageData?.url || '';
                        if (_v95Fallback) {
                            finalResponse += `\n\n👉 Para comprar agora, acesse o link oficial:\n${_v95Fallback}`;
                        }
                    }
                }
            } else if (_v95OrchActiveInt) {
                console.log('[CHECKOUT_AUTHORITY@inteligente] ⏭️ Bypass — Orchestrator V10 ativo');
            }
        } catch (_v95Err) {
            console.warn('[CHECKOUT_AUTHORITY@inteligente] fallback seguro:', _v95Err.message);
        }

        // 🧹 [V9.6 + V10] LIMPEZA FINAL DE SPAM EXPANDIDA (process-chat-inteligente)
        // Inclui frases proibidas pela V10 Behavior Layer
        try {
            finalResponse = finalResponse
                .replace(/Isso aqui é só a superfície[^\n]*/gi, '')
                .replace(/O mais interessante ainda não apareceu[^\n]*/gi, '')
                .replace(/Quer ver\??/gi, '')
                .replace(/Posso te mostrar rapidamente como isso funciona[^\n]*/gi, '')
                .replace(/Tem um detalhe que normalmente surpreende[^\n]*/gi, '')
                .replace(/Quer que eu te mostre o que mais chama aten[\u00e7c][a\u00e3]o[^\n]*/gi, '')
                .replace(/Tem bastante coisa legal aqui[^\n]*/gi, '')
                .replace(/Quer saber mais sobre isso\??/gi, '')
                .replace(/Quer que eu te mostre[^\n]*/gi, '')
                .replace(/Posso te explicar melhor[^\n]*/gi, '')
                .replace(/Faz sentido pra voc[e\u00ea]\??[^\n]*/gi, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        } catch (_) {}

        // 🔒 [V10.1] CHECKOUT BLOCKER — Remove checkout link quando intent ≠ buy (inteligente)
        try {
            if (orchestrator && featureFlags && featureFlags.isEnabled('FEATURE_ORCHESTRATOR_V10')) {
                const { detectIntent: _intDetectIntent, shouldBlockCheckout: _intShouldBlock } = require('./lib/decision-core');
                const _intIntent = _intDetectIntent(message);
                
                if (_intShouldBlock(_intIntent)) {
                    const _intCheckoutUrl = processedPageData?.checkoutLink || processedPageData?.checkoutUrl || '';
                    if (_intCheckoutUrl && finalResponse.includes(_intCheckoutUrl)) {
                        finalResponse = finalResponse
                            .replace(new RegExp('\\n*.*' + _intCheckoutUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '.*', 'g'), '')
                            .replace(/\n*👉[^\n]*finalizar[^\n]*/gi, '')
                            .replace(/\n*👉[^\n]*compra[^\n]*/gi, '')
                            .replace(/\n*👉[^\n]*garantir[^\n]*/gi, '')
                            .replace(/\n*Para comprar[^\n]*/gi, '')
                            .replace(/\n*Para adquirir[^\n]*/gi, '')
                            .replace(/\n{3,}/g, '\n\n')
                            .trim();
                        console.log(`[V10.1] 🔒 Checkout BLOQUEADO na resposta inteligente (intent="${_intIntent}")`);
                    }
                }
            }
        } catch (_v101IntErr) {
            console.warn('[V10.1] ⚠️ Checkout blocker inteligente erro (resposta mantida):', _v101IntErr.message);
        }

        // 🔒 [V11.3.3] FASE 2 BLINDADA — ORQUESTRAÇÃO FINAL DE VENDAS (process-chat-inteligente)
        // Espelhamento da blindagem do chat-universal para garantir checkout em AMBOS endpoints
        // Protegido por try/catch — zero impacto se falhar
        try {
            const _blindIntBuyIntent = detectBuyIntent(message);
            const _blindIntCheckout = processedPageData?.checkoutLink;
            const _blindIntHasCheckout = !!_blindIntCheckout;
            const _blindIntForce = _blindIntHasCheckout && _blindIntBuyIntent;

            console.log(`[V11.3-SALES@inteligente] intent=${_blindIntBuyIntent} | hasCheckout=${_blindIntHasCheckout} | forced=${_blindIntForce} | apiKey=${apiKey?.substring(0,8)}...`);

            // Aviso de funil
            if (_blindIntBuyIntent && !_blindIntHasCheckout) {
                console.warn(`[V11.3-CRITICAL@inteligente] ⚠️ Intent detected but NO checkout available | apiKey=${apiKey?.substring(0,8)}...`);
            }

            // 1. Override Absoluto (Force)
            if (_blindIntForce && _blindIntCheckout) {
                if (!hasValidCheckout(finalResponse, _blindIntCheckout)) {
                    console.log(`[V11.3-SALES@inteligente] 🔥 OVERRIDE ATIVO: Forçando link | apiKey=${apiKey?.substring(0,8)}...`);
                    finalResponse += `\n\n━━━━━━━━━━━━━━━━━━━\n🚀 FINALIZAR COMPRA\n${_blindIntCheckout}\n━━━━━━━━━━━━━━━━━━━`;
                }
            }

            // 2. Proteção Anti-Sumiço
            if (_blindIntHasCheckout && !hasAnyUrl(finalResponse) && _blindIntBuyIntent) {
                console.warn(`[V11.3-SALES-GUARD@inteligente] 🛡️ Anti-Sumiço ativado | apiKey=${apiKey?.substring(0,8)}...`);
                finalResponse += `\n\n👉 Acesse aqui para continuar:\n${_blindIntCheckout}`;
            }
        } catch (_blindIntErr) {
            console.warn('[V11.3-SALES-GUARD@inteligente] ⚠️ Erro na blindagem (resposta mantida):', _blindIntErr.message);
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🔒 [V12.0] CAMADA 1 — SAFE CHECKOUT RESOLVER (inteligente)
        // Validação de domínio e anti-cross-tenant ANTES do envio final
        // Protegido por FEATURE_V12_SAFE_CHECKOUT + try/catch
        // ═══════════════════════════════════════════════════════════════════
        try {
            const _v12SafeEnabledInt = featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_V12_SAFE_CHECKOUT');
            if (_v12SafeEnabledInt && _v12ValidateCheckout && processedPageData?.checkoutLink) {
                const _v12ValidationInt = _v12ValidateCheckout(apiKey, processedPageData.checkoutLink);
                if (!_v12ValidationInt.valid) {
                    console.warn(`[V12-SAFE@inteligente] ⛔ Checkout BLOQUEADO: reason=${_v12ValidationInt.reason} | tenant=${apiKey?.substring(0,8)}...`);
                    if (finalResponse.includes(processedPageData.checkoutLink)) {
                        finalResponse = finalResponse
                            .replace(new RegExp(processedPageData.checkoutLink.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '[link removido por segurança]')
                            .replace(/\n*━[━]+\n[^\n]*FINALIZAR COMPRA[^\n]*\n\[link removido[^\n]*\n━[━]+/gi, '')
                            .replace(/\n{3,}/g, '\n\n')
                            .trim();
                    }
                } else {
                    console.log(`[V12-SAFE@inteligente] ✅ Checkout válido: tenant=${apiKey?.substring(0,8)}...`);
                }
            }
        } catch (_v12SafeIntErr) {
            console.warn('[V12-SAFE@inteligente] ⚠️ Erro (resposta mantida):', _v12SafeIntErr.message);
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🔥 [V12.0] CAMADA 2 — FORCE CHECKOUT LAYER (inteligente)
        // Backend soberano: garante checkout quando IA detecta intenção de compra
        // Protegido por FEATURE_V12_FORCE_CHECKOUT + try/catch
        // ═══════════════════════════════════════════════════════════════════
        try {
            const _v12ForceEnabledInt = featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_V12_FORCE_CHECKOUT');
            const _v12SalesModeInt = (processedPageData && processedPageData.salesMode) ||
                req.body?.salesMode || req.body?.sales_mode ||
                process.env.SALES_LAYER_MODE || 'auto';

            if (_v12ForceEnabledInt && _v12ForceCheckoutPipeline && _v12SalesModeInt === 'auto') {
                const _v12ResultInt = _v12ForceCheckoutPipeline({
                    response: finalResponse,
                    message: message,
                    checkoutLink: processedPageData?.checkoutLink || null,
                    mode: _v12SalesModeInt
                });

                if (_v12ResultInt && _v12ResultInt.forced) {
                    finalResponse = _v12ResultInt.text;
                    console.log(`[V12-FORCE@inteligente] 🔥 Aplicado: reason=${_v12ResultInt.reason} | tenant=${apiKey?.substring(0,8)}...`);
                }
            }
        } catch (_v12ForceIntErr) {
            console.warn('[V12-FORCE@inteligente] ⚠️ Erro (resposta mantida):', _v12ForceIntErr.message);
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🧠 [V12.1] SELF-HEALING ENGINE (inteligente)
        // Detecta e corrige falhas automaticamente
        // Protegido por FEATURE_V12_SELF_HEALING + try/catch
        // ═══════════════════════════════════════════════════════════════════
        try {
            const _v12HealEnabledInt = featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_V12_SELF_HEALING');
            const _v12HealModeInt = (processedPageData && processedPageData.salesMode) || 'auto';

            if (_v12HealEnabledInt && _v12ApplyHealing && _v12HealModeInt === 'auto') {
                const _v12HealResultInt = _v12ApplyHealing({
                    response: finalResponse,
                    checkoutLink: processedPageData?.checkoutLink || null,
                    intent: _intDecision?.intent || 'neutral',
                    message: message,
                    apiKey: apiKey,
                    mode: _v12HealModeInt
                });

                if (_v12HealResultInt && _v12HealResultInt.healed) {
                    finalResponse = _v12HealResultInt.text;
                    console.log(`[V12-HEAL@inteligente] 🧠 Auto-correção: type=${_v12HealResultInt.failureType} | tenant=${apiKey?.substring(0,8)}...`);
                    if (_v12SaveFailure) {
                        _v12SaveFailure(apiKey, _v12HealResultInt.failureType, { intent: _intDecision?.intent, message });
                    }
                } else {
                    if (_v12SaveSuccess) {
                        _v12SaveSuccess(apiKey, _intDecision?.intent || 'neutral', { checkoutLink: processedPageData?.checkoutLink, response: finalResponse });
                    }
                }
            }
        } catch (_v12HealIntErr) {
            console.warn('[V12-HEAL@inteligente] ⚠️ Erro (resposta mantida):', _v12HealIntErr.message);
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🔍 [V12.1] RESPONSE VALIDATOR (inteligente)
        // Valida resposta final — log de problemas
        // ═══════════════════════════════════════════════════════════════════
        try {
            if (_v12ValidateResponse) {
                const _v12ValResultInt = _v12ValidateResponse({
                    response: finalResponse,
                    checkoutLink: processedPageData?.checkoutLink || null,
                    intent: _intDecision?.intent || 'neutral',
                    message: message
                });

                if (_v12ValResultInt.errors.length > 0) {
                    console.warn(`[V12-VALIDATOR@inteligente] ❌ Erros: ${_v12ValResultInt.errors.join(', ')} | tenant=${apiKey?.substring(0,8)}...`);
                }
                if (_v12ValResultInt.warnings.length > 0) {
                    console.warn(`[V12-VALIDATOR@inteligente] ⚠️ Avisos: ${_v12ValResultInt.warnings.join(', ')} | tenant=${apiKey?.substring(0,8)}...`);
                }
            }
        } catch (_v12ValIntErr) {
            // Silencioso — validator é observacional
        }

        // ═══════════════════════════════════════════════════════════════════
        // 🧠 [V12.0] CAMADA 3 — CONVERSATION STATE PROMPT (inteligente)
        // Anti-amnésia: atualiza estado conversacional para próximas mensagens
        // Protegido por FEATURE_V12_STATE_PROMPT + try/catch
        // ═══════════════════════════════════════════════════════════════════
        try {
            const _v12StateEnabled = featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_V12_STATE_PROMPT');
            if (_v12StateEnabled && _v11ConversationState && conversationId) {
                const _v12Intent = _intDecision?.intent || 'neutral';
                _v11ConversationState.updateState(conversationId, _v12Intent, message);
                console.log(`[V12-STATE@inteligente] 📝 Estado atualizado: conv=${conversationId.substring(0,8)}... intent=${_v12Intent}`);
            }
        } catch (_v12StateErr) {
            console.warn('[V12-STATE@inteligente] ⚠️ Erro (sem impacto):', _v12StateErr.message);
        }

        return res.json({
            success: true,
            response: finalResponse,
            calendarHash: mainFlowCalendarHash,
            inteligenciasDetectadas: inteligencias,
            analiseEmocional: analiseEmocional,
            personalidadeSelecionada: personalidade,
            journeyStage: journeyStage,
            bonuses_detected: processedPageData?.bonuses_detected || [],
            contatos: processedPageData?.contatos || {},
            metadata: {
                hasPageData: !!processedPageData,
                contentLength: processedPageData?.cleanText?.length || 0,
                method: processedPageData?.method || "none",
                sistema: "super-inteligencia-v1"
            }
        });

    } catch (error) {
        analytics.errors++;
        logger.error("Super inteligencia endpoint error:", error.message || error);
        return res.status(500).json({
            success: false,
            error: "Erro interno ao gerar resposta inteligente: " + (error.message || "Erro desconhecido"),
            details: error.message
        });
    }
});

// ===== 🧠 AUTO-LEARNING: ENDPOINT DE TRACKING DE EVENTOS =====
// Recebe eventos de conversão do frontend (cliques, whatsapp, agendamento, leads)
app.post("/api/track-event", async (req, res) => {
    try {
        const { conversationId, eventType, apiKey: bodyApiKey } = req.body || {};

        if (!conversationId || !eventType) {
            return res.status(400).json({
                success: false,
                error: "conversationId e eventType são obrigatórios"
            });
        }

        // Validar tipo de evento
        const validEvents = ['click_link', 'open_whatsapp', 'schedule_created', 'lead_submitted'];
        if (!validEvents.includes(eventType)) {
            return res.status(400).json({
                success: false,
                error: `eventType inválido. Válidos: ${validEvents.join(', ')}`
            });
        }

        let tracked = false;
        if (autoLearning && (process.env.FEATURE_AUTO_LEARNING === 'true' ||
            (featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_AUTO_LEARNING')))) {
            tracked = autoLearning.trackConversion(conversationId, eventType);
            console.log(`🎯 [AUTO-LEARNING] Evento tracked: ${eventType} para ${conversationId} → ${tracked ? 'OK' : 'não encontrado'}`);
        } else {
            console.log(`⚠️ [AUTO-LEARNING] Track-event recebido mas auto-learning desativado`);
        }

        return res.json({
            success: true,
            tracked: tracked,
            eventType: eventType,
            conversationId: conversationId
        });
    } catch (error) {
        console.warn('⚠️ [AUTO-LEARNING] Erro no track-event:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ===== ENDPOINT APRIMORADO DE EXTRAÇÃO =====
app.post("/api/extract-enhanced", ...[billingMiddleware].filter(Boolean), async (req, res) => {
    analytics.extractRequests++;
    try {
        const { url } = req.body || {};

        console.log("📥 [EXTRACAO APRIMORADA] Recebendo requisição para:", url);

        if (!url) {
            return res.status(400).json({
                success: false,
                error: "URL é obrigatório"
            });
        }

        try {
            new URL(url);
        } catch (urlErr) {
            return res.status(400).json({
                success: false,
                error: "URL inválido"
            });
        }

        const extractedData = await sistemaExtracao.extrairDadosCompletos(url);

        if (extractedData.erro) {
            return res.status(500).json({
                success: false,
                error: extractedData.erro
            });
        }

        const validacao = sistemaValidacao.validarDadosCompletos(extractedData);

        console.log("✅ [EXTRACAO APRIMORADA] Concluída com sucesso");
        console.log(`🎯 Bônus encontrados: ${validacao.dadosValidados.bonus.length}`);
        console.log(`📞 Contatos encontrados: ${validacao.dadosValidados.contatos ? Object.keys(validacao.dadosValidados.contatos).length : 0}`);
        console.log(`📊 Confiança: ${(validacao.pontuacaoConfianca * 100).toFixed(1)}%`);

        // 💳 Billing: registrar uso de extração
        const extractApiKey = req.cliente?.apiKey || req.session?.validatedApiKey || req.body?.apiKey || req.query?.apiKey;
        if (extractApiKey) billingManager.trackUsage(extractApiKey, 'extractions');

        return res.json({
            success: true,
            data: validacao.dadosValidados,
            validacao: {
                pontuacaoConfianca: validacao.pontuacaoConfianca,
                problemas: validacao.problemasCriticos,
                totalBonus: validacao.dadosValidados.bonus.length
            }
        });

    } catch (error) {
        analytics.errors++;
        console.error("❌ Erro no endpoint /api/extract-enhanced:", error);
        logger.error("Extract-enhanced endpoint error:", error.message || error);

        return res.status(500).json({
            success: false,
            error: "Erro interno ao extrair página: " + (error.message || "Erro desconhecido")
        });
    }
});

// /api/extract endpoint (ORIGINAL - mantido para compatibilidade)
app.post("/api/extract", ...[billingMiddleware].filter(Boolean), async (req, res) => {
    analytics.extractRequests++;
    try {
        const { url, instructions, robotName, forceRefresh } = req.body || {};

        console.log("📥 Recebendo requisição para extrair:", url);

        if (!url) {
            return res.status(400).json({
                success: false,
                error: "URL é obrigatório"
            });
        }

        try {
            new URL(url);
        } catch (urlErr) {
            return res.status(400).json({
                success: false,
                error: "URL inválido"
            });
        }

        // SAFE PATCH - BUG-EXT-001: Permitir bypass do cache se forceRefresh=true
        if (forceRefresh) {
            dataCache.delete(url);
            console.log(`🔄 [FORCE REFRESH] Cache limpo para: ${url}`);
        }

        logger.info(`Starting extraction for URL: ${url} (forceRefresh: ${!!forceRefresh})`);

        const extractedData = await extractPageData(url);

        if (instructions) extractedData.custom_instructions = instructions;
        if (robotName) extractedData.robot_name = robotName;

        console.log("✅ Extração concluída com sucesso");

        return res.json({
            success: true,
            data: extractedData
        });

    } catch (error) {
        analytics.errors++;
        console.error("❌ Erro no endpoint /api/extract:", error);
        logger.error("Extract endpoint error:", error.message || error);

        return res.status(500).json({
            success: false,
            error: "Erro interno ao extrair página: " + (error.message || "Erro desconhecido"),
            details: error.message
        });
    }
});

// ===== FUNÇÃO: Geração Completa do HTML do Chatbot =====
// Helper para escapar strings para uso em contexto JavaScript inline
function escapeForJS(str) {
    if (!str) return '';
    return String(str)
        .replace(/\\/g, '\\\\')   // Escape barras invertidas primeiro
        .replace(/"/g, '\\"')     // Escape aspas duplas
        .replace(/'/g, "\\'")     // Escape aspas simples
        .replace(/\n/g, '\\n')    // Escape quebras de linha
        .replace(/\r/g, '\\r')    // Escape retorno de carro
        .replace(/\t/g, '\\t')    // Escape tabs
        .replace(/</g, '\\u003c') // Escape < para evitar </script>
        .replace(/>/g, '\\u003e'); // Escape >
}

// 🎯 BUG-FIX-007: Bloco processMessageContent gerado como string pura para evitar
// problemas de escape em template literals (causa raiz do chat não abrir)
const PROCESS_MESSAGE_CONTENT_JS = [
    'function processMessageContent(text) {',
    '    if (!text) return text;',
    '    var urlRegex = /(https?:\\/\\/[^\\s<>"\x27]+)/gi;',
    '    return text.replace(urlRegex, function(rawUrl) {',
    '        var url = rawUrl.replace(/[.,;:!?)\\]]+$/, \'\');',
    '        var displayText = url.replace(/^https?:\\/\\/(www\\.)?/, \'\').split(\'/\')[0];',
    '        if (displayText.length > 30) displayText = displayText.substring(0, 30) + \'...\';',
    '        var trailing = rawUrl.substring(url.length); return \'<a href="\' + url + \'" target="_blank" rel="noopener noreferrer" class="cta-link">🔗 \' + displayText + \'</a>\' + trailing;',
    '    });',
    '}'
].join('\n');

function generateFullChatbotHTML(pageData = {}, robotName = 'Assistente IA', customInstructions = '', apiKey = '', whitelabel = {}) {
    const escapedPageData = JSON.stringify(pageData || {});
    const safeRobotName = escapeForJS(robotName || 'Assistente IA');
    const safeInstructions = escapeForJS(customInstructions || '');

    // 🎨 Cores do whitelabel (com fallback para cores padrão)
    const primaryColor = whitelabel.primaryColor || '#3b82f6';
    const secondaryColor = whitelabel.secondaryColor || '#1e40af';
    const bgPrimary = whitelabel.primaryColor || '#667eea';
    const bgSecondary = whitelabel.secondaryColor || '#764ba2';

    // 🎨 BUG-FIX-001: Logo e nome da empresa do whitelabel
    const logoUrl = whitelabel.logoUrl || '';
    const companyBrand = whitelabel.companyName || 'LinkMágico';
    // BUG-FIX-001: Usar companyName como nome exibido no header quando configurado
    const headerTitle = whitelabel.companyName || safeRobotName;
    const pageTitle = `${companyBrand} - ${safeRobotName}`;

    // 🎯 BUG-FIX-005: Mensagem de saudação configurável
    const welcomeMessage = whitelabel.welcomeMessage || `Olá! Sou ${safeRobotName}, estou aqui para tirar todas as suas dúvidas. Como posso ajudar você hoje?`;

    // Gerar botões fixos com contatos
    const contatos = pageData.contatos || {
        telefone: [],
        whatsapp: [],
        email: [],
        site: [pageData.url || ''],
        endereco: []
    };

    const botoesFixos = gerarBotoesFixos(contatos, safeRobotName);

    return `<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>${pageTitle}</title>
    <meta name="description" content="Chatbot IA - ${safeRobotName}"/>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Inter',sans-serif;background:linear-gradient(135deg,${bgPrimary} 0%,${bgSecondary} 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
        .chat-container{width:100%;max-width:800px;height:90vh;background:white;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.15);display:flex;flex-direction:column;overflow:hidden}
        .chat-header{background:linear-gradient(135deg,${primaryColor} 0%,${secondaryColor} 100%);color:white;padding:20px;text-align:center;position:relative}
        .chat-header img.wl-logo{max-width:140px;max-height:50px;margin-bottom:8px;object-fit:contain}
        .chat-header h1{font-size:1.5rem;font-weight:600}
        .chat-header .subtitle{font-size:0.9rem;opacity:0.9;margin-top:5px}
        .chat-messages{flex:1;padding:20px;overflow-y:auto;display:flex;flex-direction:column;gap:15px;background:#f8fafc}
        .cta-link{display:inline-block;background:linear-gradient(135deg,${primaryColor} 0%,${secondaryColor} 100%);color:white!important;text-decoration:none;padding:10px 20px;border-radius:25px;font-weight:600;margin:8px 4px;transition:all .3s;box-shadow:0 4px 12px rgba(0,0,0,0.15);cursor:pointer}
        .cta-link:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,0.2)}
        .chat-message{max-width:70%;padding:15px;border-radius:15px;font-size:0.95rem;line-height:1.4}
        .chat-message.user{background:linear-gradient(135deg,${primaryColor} 0%,${secondaryColor} 100%);color:white;align-self:flex-end;border-bottom-right-radius:5px}
        .chat-message.bot{background:#f1f5f9;color:#334155;align-self:flex-start;border-bottom-left-radius:5px}
        .chat-input-container{padding:20px;background:white;border-top:1px solid #e2e8f0;display:flex;gap:10px}
        .chat-input{flex:1;border:1px solid #e2e8f0;border-radius:25px;padding:12px 20px;font-size:0.95rem;outline:none;transition:all 0.3s}
        .chat-input:focus{border-color:${primaryColor};box-shadow:0 0 0 3px rgba(59,130,246,0.1)}
        .send-button{background:linear-gradient(135deg,${primaryColor} 0%,${secondaryColor} 100%);border:none;border-radius:50%;width:50px;height:50px;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.3s}
        .send-button:hover{transform:scale(1.05);box-shadow:0 5px 15px rgba(59,130,246,0.4)}
        .send-button:disabled{opacity:0.6;cursor:not-allowed;transform:none}
        .typing-indicator{display:none;align-items:center;gap:5px;color:#64748b;font-size:0.9rem;margin-top:10px}
        .typing-dot{width:8px;height:8px;background:#64748b;border-radius:50%;animation:typing 1.4s infinite}
        .typing-dot:nth-child(2){animation-delay:0.2s}
        .typing-dot:nth-child(3){animation-delay:0.4s}
        @keyframes typing{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
        .lead-form{background:white;padding:25px;margin:20px;border-radius:15px;box-shadow:0 8px 25px rgba(0,0,0,0.1);text-align:center}
        .lead-form h3{color:${secondaryColor};margin-bottom:10px}
        .lead-form p{color:#64748b;margin-bottom:20px}
        .lead-form input{width:100%;padding:15px;margin-bottom:15px;border:2px solid #e2e8f0;border-radius:10px;font-size:1rem;transition:all 0.3s}
        .lead-form input:focus{border-color:${primaryColor};box-shadow:0 0 0 3px rgba(59,130,246,0.1)}
        .lead-form button{width:100%;background:linear-gradient(135deg,${primaryColor} 0%,${secondaryColor} 100%);color:white;border:none;padding:15px;border-radius:10px;cursor:pointer;font-size:1.1rem;font-weight:600;transition:all 0.3s}
        .lead-form button:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(59,130,246,0.3)}
        .contact-buttons{display:flex;gap:10px;margin-top:15px;flex-wrap:wrap}
        .contact-button{flex:1;min-width:120px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;cursor:pointer;transition:all 0.3s;text-decoration:none;color:#334155;font-size:0.9rem;display:flex;align-items:center;justify-content:center;gap:5px}
        .contact-button:hover{background:${primaryColor};color:white;transform:translateY(-2px)}
        .lm-botoes-fixos a, .lm-botoes-fixos button { font-size: 0.85rem; }
        .sched-calendar{background:#f0f9ff;border:2px solid #3b82f6;border-radius:16px;padding:16px;margin:10px 0;max-width:100%}
        .sched-calendar h4{color:#1e40af;margin:0 0 12px 0;font-size:1rem;text-align:center}
        .sched-days{display:flex;gap:6px;overflow-x:auto;padding:4px 0;margin-bottom:12px}
        .sched-day-btn{background:#e0e7ff;color:#3730a3;border:2px solid transparent;border-radius:10px;padding:8px 12px;cursor:pointer;font-size:0.8rem;font-weight:600;white-space:nowrap;transition:all .2s;min-width:70px;text-align:center}
        .sched-day-btn:hover{background:#c7d2fe;transform:translateY(-1px)}
        .sched-day-btn.active{background:#3b82f6;color:white;border-color:#1d4ed8;box-shadow:0 2px 8px rgba(59,130,246,0.4)}
        .sched-times{display:flex;flex-wrap:wrap;gap:6px}
        .sched-time-btn{background:white;color:#1e40af;border:1px solid #93c5fd;border-radius:8px;padding:8px 14px;cursor:pointer;font-size:0.85rem;font-weight:500;transition:all .2s}
        .sched-time-btn:hover{background:#3b82f6;color:white;transform:translateY(-1px);box-shadow:0 2px 6px rgba(59,130,246,0.3)}
        .sched-confirm{background:linear-gradient(135deg,#10b981,#059669);color:white;border:none;border-radius:10px;padding:12px 24px;font-size:1rem;font-weight:600;cursor:pointer;margin-top:12px;width:100%;transition:all .2s}
        .sched-confirm:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(16,185,129,0.4)}
        .sched-confirm:disabled{opacity:0.5;cursor:not-allowed;transform:none}
        .sched-selected{background:#ecfdf5;border:1px solid #10b981;border-radius:8px;padding:8px 12px;margin-top:8px;color:#065f46;font-size:0.9rem;text-align:center}
        .sched-loading{text-align:center;color:#64748b;padding:20px;font-size:0.9rem}
        @media (max-width:768px){.chat-container{height:100vh;border-radius:0}.chat-message{max-width:85%}.lead-form{margin:10px;padding:20px}.contact-button{min-width:100px;font-size:0.8rem}.lm-botoes-fixos{padding:10px !important}.lm-botoes-fixos a, .lm-botoes-fixos button{padding:10px 15px !important;font-size:0.8rem !important}.sched-day-btn{min-width:60px;padding:6px 8px;font-size:0.75rem}}
    </style>
</head>
<body>
    <div class="chat-container">
        <div class="chat-header">
            ${logoUrl ? `<img class="wl-logo" src="${logoUrl}" alt="${escapeForJS(companyBrand)}" onerror="this.style.display='none'">` : ''}
            <h1>${headerTitle}</h1>
            <div class="subtitle">Estou aqui para tirar todas as suas dúvidas</div>
        </div>
        ${botoesFixos}
        <div class="lead-form" id="leadForm">
            <h3>🎯 Vamos começar!</h3>
            <p>Deixe seus dados para uma experiência personalizada</p>
            <input type="text" id="leadName" placeholder="Seu nome completo">
            <input type="email" id="leadEmail" placeholder="Seu melhor email" required>
            <input type="tel" id="leadPhone" placeholder="Seu WhatsApp (opcional)">
            <button id="startChat"><i class="fas fa-comments" style="margin-right:8px"></i> Iniciar Conversa</button>
        </div>
        <div class="chat-messages" id="chatMessages" style="display:none">
            <div class="chat-message bot">${welcomeMessage}</div>
        </div>
        <div class="chat-input-container" id="chatInputContainer" style="display:none">
            <input type="text" class="chat-input" id="messageInput" placeholder="Digite sua mensagem..." autocomplete="off">
            <button class="send-button" id="sendButton"><i class="fas fa-paper-plane"></i></button>
        </div>
        <div class="typing-indicator" id="typingIndicator">
            <span>Digitando</span>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    </div>
    <script>
        const pageData = ${escapedPageData};
        const robotName = "${safeRobotName}";
        const customInstructions = "${safeInstructions}";
        const chatMessages = document.getElementById('chatMessages');
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        const typingIndicator = document.getElementById('typingIndicator');
        const leadForm = document.getElementById('leadForm');
        const chatInputContainer = document.getElementById('chatInputContainer');
        const startChatBtn = document.getElementById('startChat');
        let leadId = null;
        const currentApiKey = "${apiKey || ''}";
        // 🔥 [V9.6] conversationId FIXO por sessão (antes era Date.now() por mensagem, quebrando contexto)
        const sessionConversationId = 'chatbot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        let agendamentoAtivo = false;
        let schedSlots = null;
        let schedSelectedDate = null;
        let schedSelectedTime = null;

        // SAFE PATCH - SCHED-010: Função para criar calendário visual
        function iniciarAgendamento() {
            // Injetar calendário diretamente na conversa
            addCalendarWidget();
        }

        async function addCalendarWidget() {
            const calDiv = document.createElement('div');
            calDiv.className = 'chat-message bot';
            calDiv.innerHTML = '<div class="sched-calendar"><div class="sched-loading">📅 Carregando horários disponíveis...</div></div>';
            chatMessages.appendChild(calDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            try {
                // Buscar slots disponíveis
                const calHash = await getCalendarHash();
                let slotsData;
                if (calHash) {
                    const resp = await fetch('/api/public/availability/' + calHash);
                    slotsData = await resp.json();
                }
                if (!slotsData || !slotsData.success || !slotsData.slots || slotsData.slots.length === 0) {
                    // Fallback: enviar mensagem de texto como antes
                    calDiv.querySelector('.sched-calendar').innerHTML = '<div class="sched-loading">📅 Nenhum horário configurado. Entre em contato diretamente.</div>';
                    return;
                }
                schedSlots = slotsData.slots;
                renderCalendarWidget(calDiv.querySelector('.sched-calendar'));
            } catch (e) {
                calDiv.querySelector('.sched-calendar').innerHTML = '<div class="sched-loading">⚠️ Erro ao carregar calendário. Tente novamente.</div>';
            }
        }

        async function getCalendarHash() {
            try {
                const resp = await fetch('/api/availability?apiKey=' + encodeURIComponent(currentApiKey));
                const data = await resp.json();
                return data.publicHash || null;
            } catch(e) { return null; }
        }

        function renderCalendarWidget(container) {
            if (!schedSlots || schedSlots.length === 0) {
                container.innerHTML = '<div class="sched-loading">Nenhum horário disponível</div>';
                return;
            }
            let html = '<h4>📅 Escolha um dia</h4>';
            html += '<div class="sched-days">';
            schedSlots.forEach(function(day, i) {
                var dateObj = new Date(day.date + 'T12:00:00');
                var shortDate = String(dateObj.getDate()).padStart(2,'0') + '/' + String(dateObj.getMonth()+1).padStart(2,'0');
                html += '<button class="sched-day-btn" data-idx="' + i + '" onclick="selectSchedDay(' + i + ')">' + day.dayName.substring(0,3) + '<br>' + shortDate + '</button>';
            });
            html += '</div>';
            html += '<div id="sched-times-area"></div>';
            html += '<div id="sched-selection"></div>';
            html += '<button class="sched-confirm" id="sched-confirm-btn" disabled onclick="confirmScheduling()">✅ Confirmar Agendamento</button>';
            container.innerHTML = html;
        }

        function selectSchedDay(idx) {
            schedSelectedDate = schedSlots[idx];
            schedSelectedTime = null;
            document.querySelectorAll('.sched-day-btn').forEach(function(b) { b.classList.remove('active'); });
            var activeBtn = document.querySelector('.sched-day-btn[data-idx="' + idx + '"]');
            if (activeBtn) activeBtn.classList.add('active');
            var area = document.getElementById('sched-times-area');
            var html = '<div class="sched-times">';
            schedSelectedDate.times.forEach(function(time, ti) {
                html += '<button class="sched-time-btn" data-time="' + time + '">' + time + '</button>';
            });
            html += '</div>';
            area.innerHTML = html;
            area.querySelectorAll('.sched-time-btn').forEach(function(b) {
                b.addEventListener('click', function() { selectSchedTime(this, this.getAttribute('data-time')); });
            });
            document.getElementById('sched-selection').innerHTML = '';
            document.getElementById('sched-confirm-btn').disabled = true;
        }

        function selectSchedTime(btn, time) {
            schedSelectedTime = time;
            document.querySelectorAll('.sched-time-btn').forEach(function(b) { b.style.background = 'white'; b.style.color = '#1e40af'; });
            btn.style.background = '#3b82f6';
            btn.style.color = 'white';
            document.getElementById('sched-selection').innerHTML = '<div class="sched-selected">📅 ' + schedSelectedDate.dayName + ' ' + schedSelectedDate.date.split('-').reverse().join('/') + ' às ' + time + '</div>';
            document.getElementById('sched-confirm-btn').disabled = false;
        }

        async function confirmScheduling() {
            if (!schedSelectedDate || !schedSelectedTime) return;
            var btn = document.getElementById('sched-confirm-btn');
            btn.disabled = true;
            btn.textContent = '⏳ Confirmando...';
            try {
                var calHash = await getCalendarHash();
                var leadName = document.getElementById('leadName') ? document.getElementById('leadName').value : '';
                var leadEmail = document.getElementById('leadEmail') ? document.getElementById('leadEmail').value : '';
                var leadPhone = document.getElementById('leadPhone') ? document.getElementById('leadPhone').value : '';
                var resp = await fetch('/api/public/book/' + calHash, {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({
                        name: leadName,
                        email: leadEmail,
                        phone: leadPhone,
                        leadId: leadId,
                        date: schedSelectedDate.date,
                        time: schedSelectedTime,
                        notes: 'Agendado via calendário do chatbot'
                    })
                });
                var data = await resp.json();
                if (data.success) {
                    btn.textContent = '✅ Agendamento Confirmado!';
                    btn.style.background = '#059669';
                    addMessage('✅ **Agendamento confirmado!** ' + schedSelectedDate.dayName + ' ' + schedSelectedDate.date.split('-').reverse().join('/') + ' às ' + schedSelectedTime + '. Nossa equipe entrará em contato para confirmar. 🎉', false);
                } else {
                    btn.textContent = '❌ Erro - Tente novamente';
                    btn.disabled = false;
                }
            } catch(e) {
                btn.textContent = '❌ Erro - Tente novamente';
                btn.disabled = false;
            }
        }

        // Capturar lead
        startChatBtn.addEventListener('click', async function() {
            const name = document.getElementById('leadName').value.trim();
            const email = document.getElementById('leadEmail').value.trim();
            const phone = document.getElementById('leadPhone').value.trim();
            if (!email) {
                alert('Por favor, informe seu email');
                return;
            }
            try {
                const response = await fetch('/api/capture-lead', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nome: name || 'Não informado',
                        email: email,
                        telefone: phone || 'Não informado',
                        url_origem: window.location.href,
                        robotName: robotName,
                        apiKey: currentApiKey || new URLSearchParams(window.location.search).get('apiKey') || ''
                    })
                });
                const data = await response.json();
                if (data.success) {
                    leadId = data.lead.id;
                    leadForm.style.display = 'none';
                    chatMessages.style.display = 'flex';
                    chatInputContainer.style.display = 'flex';
                    addMessage(\`${process.env.FEATURE_CLEAN_CHAT_V2 === 'true' ? "Oi" + "${name ? ', ' + name : ''}" + "! Como posso ajudar?" : "Olá ${name || 'amigo'}! É um prazer ter você aqui. Como posso ajudar você hoje?"}\`, false);
                    messageInput.focus();
                }
            } catch (error) {
                console.error('Erro ao capturar lead:', error);
                alert('Erro ao processar. Tente novamente.');
            }
        });

        // 🎯 BUG-FIX-006/007: Processar URLs como botões CTA clicáveis
        ${PROCESS_MESSAGE_CONTENT_JS}

        function addMessage(text, isUser = false) {
            const messageDiv = document.createElement('div');
            messageDiv.className = \`chat-message \${isUser ? 'user' : 'bot'}\`;
            if (isUser) {
                messageDiv.textContent = text;
            } else {
                // SAFE PATCH - SCHED-011: Detectar marcador de calendário
                if (text && text.indexOf('[CALENDAR_WIDGET]') !== -1) {
                    var textPart = text.replace('[CALENDAR_WIDGET]', '');
                    messageDiv.innerHTML = processMessageContent(textPart);
                    chatMessages.appendChild(messageDiv);
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                    addCalendarWidget();
                    return;
                }
                messageDiv.innerHTML = processMessageContent(text);
            }
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        async function sendMessage() {
            const message = messageInput.value.trim();
            if (!message) return;
            addMessage(message, true);
            messageInput.value = '';
            sendButton.disabled = true;
            typingIndicator.style.display = 'flex';
            try {
                const response = await fetch('/api/process-chat-inteligente', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: message,
                        pageData: pageData,
                        robotName: robotName,
                        instructions: customInstructions,
                        conversationId: sessionConversationId,
                        leadId: leadId,
                        apiKey: currentApiKey
                    })
                });
                const data = await response.json();
                if (data.success) {
                    addMessage(data.response, false);
                } else {
                    addMessage('Desculpe, ocorreu um erro. Tente novamente.', false);
                }
            } catch (error) {
                addMessage('Erro de conexão. Verifique sua internet.', false);
            } finally {
                typingIndicator.style.display = 'none';
                sendButton.disabled = false;
                messageInput.focus();
            }
        }

        sendButton.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        // Auto-focus no primeiro campo do formulário
        document.getElementById('leadName').focus();
    </script>
</body>
</html>`;
}

function generateChatbotHTML({ robotName, url, instructions }) {
    const escapedRobotName = escapeForJS(String(robotName || 'Assistente IA'));
    const escapedUrl = escapeForJS(String(url || ''));
    const escapedInstructions = escapeForJS(String(instructions || ''));


    return `<!doctype html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>LinkMágico Chatbot - ${escapedRobotName}</title>
    <meta name="description" content="Chatbot IA - ${escapedRobotName}"/>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Inter',sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
        .chat-container{width:100%;max-width:800px;height:90vh;background:white;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.15);display:flex;flex-direction:column;overflow:hidden}
        .chat-header{background:linear-gradient(135deg,#3b82f6 0%,#1e40af 100%);color:white;padding:20px;text-align:center;position:relative}
        .chat-header h1{font-size:1.5rem;font-weight:600}
        .chat-header .subtitle{font-size:0.9rem;opacity:0.9;margin-top:5px}
        .chat-messages{flex:1;padding:20px;overflow-y:auto;display:flex;flex-direction:column;gap:15px;background:#f8fafc}
        .chat-message{max-width:70%;padding:15px;border-radius:15px;font-size:0.95rem;line-height:1.4}
        .chat-message.user{background:linear-gradient(135deg,#3b82f6 0%,#1e40af 100%);color:white;align-self:flex-end;border-bottom-right-radius:5px}
        .chat-message.bot{background:#f1f5f9;color:#334155;align-self:flex-start;border-bottom-left-radius:5px}
        .chat-input-container{padding:20px;background:white;border-top:1px solid #e2e8f0;display:flex;gap:10px}
        .chat-input{flex:1;border:1px solid #e2e8f0;border-radius:25px;padding:12px 20px;font-size:0.95rem;outline:none;transition:all 0.3s}
        .chat-input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.1)}
        .send-button{background:linear-gradient(135deg,#3b82f6 0%,#1e40af 100%);border:none;border-radius:50%;width:50px;height:50px;color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.3s}
        .send-button:hover{transform:scale(1.05);box-shadow:0 5px 15px rgba(59,130,246,0.4)}
        .send-button:disabled{opacity:0.6;cursor:not-allowed;transform:none}
        .typing-indicator{display:none;align-items:center;gap:5px;color:#64748b;font-size:0.9rem;margin-top:10px}
        .typing-dot{width:8px;height:8px;background:#64748b;border-radius:50%;animation:typing 1.4s infinite}
        .typing-dot:nth-child(2){animation-delay:0.2s}
        .typing-dot:nth-child(3){animation-delay:0.4s}
        @keyframes typing{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-10px)}}
        .status-online{position:absolute;top:15px;right:15px;background:rgba(16,185,129,0.2);color:#10b981;padding:5px 10px;border-radius:15px;font-size:0.75rem;font-weight:600}
        .lead-form{background:white;padding:20px;border-radius:10px;margin:20px;box-shadow:0 4px 12px rgba(0,0,0,0.1)}
        .lead-form h3{margin-bottom:15px;color:#1e40af}
        .lead-form input{width:100%;padding:12px;margin-bottom:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:0.95rem}
        .lead-form button{width:100%;background:linear-gradient(135deg,#3b82f6 0%,#1e40af 100%);color:white;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:600}
        .contact-buttons{display:flex;gap:10px;margin-top:15px;flex-wrap:wrap}
        .contact-button{flex:1;min-width:120px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center;cursor:pointer;transition:all 0.3s;text-decoration:none;color:#334155;font-size:0.85rem}
        .contact-button:hover{background:#3b82f6;color:white;transform:translateY(-2px)}
        .contact-button i{margin-right:5px}
        .cta-link{display:inline-block;background:linear-gradient(135deg,#3b82f6 0%,#1e40af 100%);color:white!important;text-decoration:none;padding:10px 20px;border-radius:25px;font-weight:600;margin:8px 4px;transition:all .3s;box-shadow:0 4px 12px rgba(0,0,0,0.15);cursor:pointer}
        .cta-link:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,0.2)}
    </style>
</head>
<body>
    <div class="chat-container">
        <div class="chat-header">
            <h1>${escapedRobotName}</h1>
            <div class="subtitle">Estou aqui para tirar todas as suas dúvidas</div>
            <div class="status-online">Online</div>
        </div>
        <div class="lead-form" id="leadForm">
            <h3>🎯 Vamos começar!</h3>
            <p style="margin-bottom:15px;color:#64748b">Deixe seus dados para uma experiência personalizada</p>
            <input type="text" id="leadName" placeholder="Seu nome completo">
            <input type="email" id="leadEmail" placeholder="Seu melhor email" required>
            <input type="tel" id="leadPhone" placeholder="Seu WhatsApp (opcional)">
            <button id="startChat">Iniciar Conversa →</button>
        </div>
        <div class="chat-messages" id="chatMessages" style="display:none">
            <div class="chat-message bot">
                ${process.env.FEATURE_CLEAN_CHAT_V2 === 'true' ? `Oi! Sou ${escapedRobotName}. Como posso ajudar?` : `Olá! Sou ${escapedRobotName}, estou aqui para tirar todas as suas dúvidas. Como posso ajudar você hoje?`}
            </div>
        </div>
        <div class="typing-indicator" id="typingIndicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span>Digitando...</span>
        </div>
        <div class="chat-input-container" id="chatInputContainer" style="display:none">
            <input type="text" class="chat-input" id="chatInput" placeholder="Digite sua pergunta..." maxlength="500">
            <button class="send-button" id="sendButton">
                <i class="fas fa-paper-plane"></i>
            </button>
        </div>
    </div>
    <script>
        const chatMessages = document.getElementById('chatMessages');
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');
        const typingIndicator = document.getElementById('typingIndicator');
        const leadForm = document.getElementById('leadForm');
        const chatInputContainer = document.getElementById('chatInputContainer');
        const startChatBtn = document.getElementById('startChat');
        const config = {
            robotName: "${escapedRobotName}",
            url: "${escapedUrl}",
            instructions: "${escapedInstructions}",
            conversationId: 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
        };
        let isTyping = false;
        let leadId = null;
        const currentApiKey = "${apiKey || ''}";

        // Capturar lead
        startChatBtn.addEventListener('click', async function() {
            const name = document.getElementById('leadName').value.trim();
            const email = document.getElementById('leadEmail').value.trim();
            const phone = document.getElementById('leadPhone').value.trim();
            if (!email) {
                alert('Por favor, informe seu email');
                return;
            }
            try {
                const response = await fetch('/api/capture-lead', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nome: name || 'Não informado',
                        email: email,
                        telefone: phone || 'Não informado',
url_origem: window.location.href,
                        robotName: robotName,
                        apiKey: currentApiKey || new URLSearchParams(window.location.search).get('apiKey') || ''
                    })
                });
                const data = await response.json();
                if (data.success) {
                    leadId = data.lead.id;
                    leadForm.style.display = 'none';
                    chatMessages.style.display = 'flex';
                    chatInputContainer.style.display = 'flex';
                    addMessage(\`${process.env.FEATURE_CLEAN_CHAT_V2 === 'true' ? "Oi" + "${name ? ', ' + name : ''}" + "! Como posso ajudar?" : "Olá ${name || 'amigo'}! É um prazer ter você aqui. Como posso ajudar você hoje?"}\`, false);
                }
            } catch (error) {
                console.error('Erro ao capturar lead:', error);
                alert('Erro ao processar. Tente novamente.');
            }
        });

        // 🎯 BUG-FIX-006/007: Processar URLs como botões CTA clicáveis
        ${PROCESS_MESSAGE_CONTENT_JS}

        function addMessage(content, isUser = false) {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'chat-message ' + (isUser ? 'user' : 'bot');
            if (isUser) {
                messageDiv.textContent = content;
            } else {
                messageDiv.innerHTML = processMessageContent(content);
            }
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        function showTyping() {
            isTyping = true;
            typingIndicator.style.display = 'flex';
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        function hideTyping() {
            isTyping = false;
            typingIndicator.style.display = 'none';
        }

        async function sendMessage() {
            const message = chatInput.value.trim();
            if (!message || isTyping) return;
            addMessage(message, true);
            chatInput.value = '';
            sendButton.disabled = true;
            showTyping();
            try {
                const response = await fetch('/api/chat-universal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: message,
                        url: config.url,
                        instructions: config.instructions,
                        robotName: config.robotName,
                        conversationId: config.conversationId,
                        leadId: leadId,
                        apiKey: currentApiKey
                    })
                });
                const data = await response.json();
                hideTyping();
                if (data.success) {
                    addMessage(data.response);
                } else {
                    addMessage('Desculpe, ocorreu um erro. Tente novamente em alguns minutos.');
                }
            } catch (error) {
                hideTyping();
                addMessage('Erro de conexão. Verifique sua internet e tente novamente.');
            } finally {
                sendButton.disabled = false;
                chatInput.focus();
            }
        }

        sendButton.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Auto-focus no primeiro campo do formulário
        document.getElementById('leadName').focus();
    </script>
</body>
</html>`;
}

// Widget JS - ROTA INLINE REMOVIDA
// O arquivo físico /public/widget.js será servido automaticamente pelo Express
// através da rota app.use("/public", express.static(...)) que já existe no código
// Isso resolve o problema de domínio incorreto (apiBase) e permite que o widget
// funcione corretamente em sites externos dos clientes

// ===== CONFIGURAR NOVAS ROTAS =====

// ===== MIDDLEWARE DE AUTENTICAÇÃO PARA ROTAS V3.0 =====
// FIX-SCHED-001: Corrigido para async/await (validateApiKey é async)
async function requireApiKeyV3(req, res, next) {
    try {
        let apiKey = req.query.apiKey || req.body.apiKey || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);

        if (apiKey) {
            const validation = await validateApiKey(apiKey);
            if (validation.success) {
                req.session.validatedApiKey = apiKey;
                // FIX-SCHED-001b: validateApiKey retorna .tenant, não .client
                const clientData = validation.client || validation.tenant;
                req.session.clientData = clientData;
                req.cliente = clientData;
                return next();
            }
        }

        // Fallback: sessão já validada (ex: painel admin)
        if (req.session && req.session.validatedApiKey) {
            req.cliente = req.session.clientData;
            return next();
        }

        return res.status(401).json({
            success: false,
            error: "API Key não fornecida ou inválida. Autenticação necessária."
        });
    } catch (error) {
        console.error('❌ [requireApiKeyV3] Erro na autenticação:', error.message);
        // Fallback seguro: se tem sessão válida, continua
        if (req.session && req.session.validatedApiKey) {
            req.cliente = req.session.clientData;
            return next();
        }
        return res.status(401).json({
            success: false,
            error: "Erro interno na autenticação."
        });
    }
}

// ===== MIDDLEWARE DE VALIDAÇÃO DE PROPRIEDADE DO CHATBOT =====
function validateChatbotOwnership(req, res, next) {
    const apiKey = req.session.validatedApiKey || req.body.apiKey || req.query.apiKey;
    const chatbotId = req.params.chatbotId || req.body.chatbotId;

    if (!apiKey) {
        return res.status(401).json({
            success: false,
            error: "API Key não fornecida"
        });
    }

    if (!chatbotId) {
        return res.status(400).json({
            success: false,
            error: "ChatbotId não fornecido"
        });
    }

    // Verificar se o chatbotId pertence ao tenant
    // Por segurança, o chatbotId deve começar com a apiKey ou ter um mapeamento
    // Por enquanto, apenas garantir que apiKey existe
    req.validatedChatbotId = chatbotId;
    req.validatedApiKey = apiKey;

    next();
}

// ===== WEBHOOK HOTMART (Provisionamento automático) =====
// IMPORTANTE: Deve ser registrado ANTES de setupRoutes() para evitar
// conflito com a rota genérica POST /api/webhooks/:chatbotId
try {
    const hotmartWebhook = require('./hotmart-webhook');
    app.use(hotmartWebhook);
    console.log('✅ [Hotmart] Webhook de provisionamento registrado em /api/webhooks/hotmart');
} catch (e) {
    console.log('⚠️ [Hotmart] Webhook não disponível:', e.message);
}

setupRoutes(app);

// ===== ROTAS ADMIN V8.0 =====
try {
    const adminRoutesV8 = require('./lib/admin-routes-v8');
    app.use('/admin/v8', adminRoutesV8);
    console.log('✅ [V8.0] Rotas Admin montadas em /admin/v8');
} catch (e) {
    console.log('⚠️ [V8.0] Rotas Admin não disponíveis:', e.message);
}



// ===== INICIALIZAR SISTEMAS =====
(async () => {
    await initialize();

    // ===== INICIALIZAR MÓDULOS V8.0 =====
    try {
        // Inicializar Audit Logger com banco de dados
        if (auditLogger && DatabaseHelpers) {
            await auditLogger.initialize({ database: DatabaseHelpers });
            console.log('✅ [V8.0] Audit Logger inicializado');
        }

        // Inicializar Persistent Memory com banco de dados
        if (persistentMemory && DatabaseHelpers) {
            await persistentMemory.initialize(DatabaseHelpers);
            console.log('✅ [V8.0] Persistent Memory inicializado');
        }

        // Inicializar LGPD Consent Manager
        if (lgpdConsentManager && DatabaseHelpers) {
            await lgpdConsentManager.initialize(DatabaseHelpers);
            console.log('✅ [V8.0] LGPD Consent Manager inicializado');
        }

        // Inicializar Rate Limiter Avançado
        if (rateLimiterAdvanced && featureFlags && featureFlags.isEnabled('FEATURE_ADVANCED_RATE_LIMIT')) {
            // Registrar middleware de rate limiting
            app.use(rateLimiterAdvanced.middleware());
            console.log('✅ [V8.0] Rate Limiter Avançado ativado como middleware');
        }

        // Log de inicialização V8.0
        if (auditLogger && auditLogger.enabled) {
            await auditLogger.log('system.startup', {
                actorType: 'system',
                details: {
                    version: '8.0.0',
                    modules: {
                        featureFlags: !!featureFlags,
                        auditLogger: true,
                        persistentMemory: !!persistentMemory,
                        enhancedSentiment: !!enhancedSentiment,
                        rateLimiter: !!rateLimiterAdvanced,
                        lgpdConsent: !!lgpdConsentManager,
                        encryption: !!encryptionManager
                    }
                },
                severity: 'info'
            });
        }
    } catch (e) {
        console.warn('⚠️ [V8.0] Erro ao inicializar módulos V8.0:', e.message);
    }

    // Iniciar servidor
    const PORT = process.env.PORT || 3000;

    // ===== ROTAS DAS NOVAS INTEGRAÇÕES V3.0 =====

    // Gmail Integration
    app.post('/api/gmail/send', requireApiKeyV3, async (req, res) => {
        try {
            const { to, subject, html, text } = req.body;
            const result = await gmailManager.sendEmail({ to, subject, html, text });
            res.json({ success: true, result });
        } catch (error) {
            logger.error('Erro ao enviar email:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/gmail/status', requireApiKeyV3, (req, res) => {
        const status = gmailManager.getStatus();
        res.json(status);
    });

    // ===== 📅 SCHEDULING / CALENDÁRIO REAL (SAFE PATCH - SCHED-006) =====
    if (schedulingManager) {
        // GET disponibilidade do tenant
        app.get('/api/availability', requireApiKeyV3, async (req, res) => {
            try {
                const apiKey = req.session.validatedApiKey || req.query.apiKey || req.body.apiKey;
                const tenantId = apiKey;
                const availability = await schedulingManager.getAvailability(tenantId);
                const blockedDates = await schedulingManager.getBlockedDates(tenantId);
                const publicHash = schedulingManager.generatePublicHash(apiKey);
                res.json({ success: true, availability, blockedDates, publicHash });
            } catch (error) {
                console.error('❌ [Scheduling] Erro GET availability:', error.message);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // PUT salvar disponibilidade do tenant
        app.put('/api/availability', requireApiKeyV3, async (req, res) => {
            try {
                const apiKey = req.session.validatedApiKey || req.query.apiKey || req.body.apiKey;
                const tenantId = apiKey;
                const { slots } = req.body;
                if (!Array.isArray(slots)) {
                    return res.status(400).json({ success: false, error: 'slots deve ser um array' });
                }
                const result = await schedulingManager.saveAvailability(tenantId, slots);
                res.json({ success: true, ...result });
            } catch (error) {
                console.error('❌ [Scheduling] Erro PUT availability:', error.message);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // POST adicionar data bloqueada
        app.post('/api/availability/blocked', requireApiKeyV3, async (req, res) => {
            try {
                const apiKey = req.session.validatedApiKey || req.query.apiKey || req.body.apiKey;
                const tenantId = apiKey;
                const { date, reason } = req.body;
                if (!date) return res.status(400).json({ success: false, error: 'date é obrigatório' });
                const result = await schedulingManager.addBlockedDate(tenantId, date, reason);
                res.json({ success: true, blockedDate: result });
            } catch (error) {
                console.error('❌ [Scheduling] Erro POST blocked date:', error.message);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // DELETE remover data bloqueada
        app.delete('/api/availability/blocked/:id', requireApiKeyV3, async (req, res) => {
            try {
                const apiKey = req.session.validatedApiKey || req.query.apiKey || req.body.apiKey;
                const tenantId = apiKey;
                await schedulingManager.removeBlockedDate(tenantId, req.params.id);
                res.json({ success: true });
            } catch (error) {
                console.error('❌ [Scheduling] Erro DELETE blocked date:', error.message);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // 🌐 ROTAS PÚBLICAS (sem auth — usadas pelo calendário no chatbot)
        app.get('/api/public/availability/:hash', async (req, res) => {
            try {
                const apiKey = await schedulingManager.resolveApiKeyFromHash(req.params.hash);
                if (!apiKey) {
                    return res.status(404).json({ success: false, error: 'Calendário não encontrado' });
                }
                const tenantId = apiKey;
                const slots = await schedulingManager.getPublicSlots(tenantId);
                res.json({ success: true, slots });
            } catch (error) {
                console.error('❌ [Scheduling] Erro GET public slots:', error.message);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        app.post('/api/public/book/:hash', async (req, res) => {
            try {
                const apiKey = await schedulingManager.resolveApiKeyFromHash(req.params.hash);
                if (!apiKey) {
                    return res.status(404).json({ success: false, error: 'Calendário não encontrado' });
                }
                const { name, email, phone, date, time, notes } = req.body;
                if (!date || !time) {
                    return res.status(400).json({ success: false, error: 'date e time são obrigatórios' });
                }
                // Usar o sistema de agendamento existente
                const leadSystem = getLeadSystem(apiKey);
                const appointment = leadSystem.addAppointment({
                    leadId: req.body.leadId || null,
                    leadName: name || 'Não informado',
                    leadEmail: email || 'Não informado',
                    leadPhone: phone || '',
                    datetime: `${date} ${time}`,
                    notes: notes || 'Agendado via calendário',
                    robotName: 'Calendário Online'
                });
                res.json({ success: true, appointment });
            } catch (error) {
                console.error('❌ [Scheduling] Erro POST public book:', error.message);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        console.log('📅 Rotas de Agendamento/Calendário configuradas');
    }

    // WhatsApp Integration
    app.post('/api/whatsapp/send', requireApiKeyV3, async (req, res) => {
        try {
            const { to, message } = req.body;
            const result = await whatsappManager.sendMessage(to, message);
            res.json({ success: true, result });
        } catch (error) {
            logger.error('Erro ao enviar WhatsApp:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/whatsapp/status', requireApiKeyV3, (req, res) => {
        const status = whatsappManager.getStatus();
        res.json(status);
    });

    // ChatGPT Integration
    app.post('/api/chatgpt/generate', requireApiKeyV3, async (req, res) => {
        try {
            const { prompt, model, pageContent } = req.body;
            const result = await chatgptManager.generateResponse(prompt, pageContent, model);
            res.json({ success: true, result });
        } catch (error) {
            logger.error('Erro ao gerar resposta ChatGPT:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/chatgpt/status', requireApiKeyV3, (req, res) => {
        const status = chatgptManager.getStatus();
        res.json(status);
    });

    app.get('/api/chatgpt/models', requireApiKeyV3, (req, res) => {
        const models = chatgptManager.getAvailableModels();
        res.json(models);
    });

    // Whitelabel System
    app.post('/api/whitelabel/:chatbotId', requireApiKeyV3, validateChatbotOwnership, async (req, res) => {
        try {
            const { chatbotId } = req.params;
            const config = req.body;
            await whitelabelManager.saveConfig(chatbotId, config);
            res.json({ success: true, config });
        } catch (error) {
            logger.error('Erro ao salvar config whitelabel:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/whitelabel/:chatbotId', requireApiKeyV3, validateChatbotOwnership, async (req, res) => {
        try {
            const { chatbotId } = req.params;
            const config = await whitelabelManager.getConfig(chatbotId);
            res.json({ success: true, config });
        } catch (error) {
            logger.error('Erro ao buscar config whitelabel:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // 🎨 Endpoint PÚBLICO para widget externo buscar cores do whitelabel
    // Não requer autenticação pois são apenas cores visuais (não expõe dados sensíveis)
    app.get('/api/whitelabel-public/:chatbotId', async (req, res) => {
        try {
            const { chatbotId } = req.params;
            const result = await whitelabelManager.getConfig(chatbotId);

            // Retornar cores e dados visuais públicos (sem dados sensíveis)
            const publicConfig = {
                primaryColor: result?.settings?.primaryColor || result?.primaryColor || '#3b82f6',
                secondaryColor: result?.settings?.secondaryColor || result?.secondaryColor || '#8b5cf6',
                companyName: result?.settings?.companyName || result?.companyName || null,
                logoUrl: result?.settings?.logoUrl || result?.logoUrl || null,
                welcomeMessage: result?.settings?.welcomeMessage || null
            };

            res.json({ success: true, config: publicConfig });
        } catch (error) {
            // Em caso de erro, retornar cores padrão (não quebrar o widget)
            res.json({
                success: true,
                config: {
                    primaryColor: '#3b82f6',
                    secondaryColor: '#8b5cf6'
                }
            });
        }
    });

    app.post('/api/leads/structured', requireApiKeyV3, async (req, res) => {
        try {
            const { chatbotId, leadData, metadata } = req.body;
            const lead = await structuredLeadsManager.saveLead(chatbotId, leadData, metadata);

            // Enviar notificações
            if (process.env.GMAIL_USER) {
                await gmailManager.sendLeadNotification(lead);
            }
            if (process.env.WHATSAPP_PROVIDER) {
                await whatsappManager.sendLeadNotification(lead);
            }

            res.json({ success: true, lead });
        } catch (error) {
            logger.error('Erro ao salvar lead estruturado:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/leads/structured/:chatbotId', requireApiKeyV3, validateChatbotOwnership, async (req, res) => {
        try {
            const { chatbotId } = req.params;
            const { status, limit, offset } = req.query;
            const leads = await structuredLeadsManager.getLeads(chatbotId, { status, limit, offset });
            res.json({ success: true, leads });
        } catch (error) {
            logger.error('Erro ao buscar leads:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/leads/export/:chatbotId', requireApiKeyV3, validateChatbotOwnership, async (req, res) => {
        try {
            const { chatbotId } = req.params;
            const csv = await structuredLeadsManager.exportToCSV(chatbotId);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="leads-' + chatbotId + '.csv"');
            res.send(csv);
        } catch (error) {
            logger.error('Erro ao exportar leads:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/leads/stats/:chatbotId', requireApiKeyV3, validateChatbotOwnership, async (req, res) => {
        try {
            const { chatbotId } = req.params;
            const stats = await structuredLeadsManager.getStats(chatbotId);
            res.json({ success: true, stats });
        } catch (error) {
            logger.error('Erro ao buscar estatísticas:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // CRM Integrations (documentação)
    app.get('/api/crm/templates', requireApiKeyV3, (req, res) => {
        const templates = crmIntegrations.getAllTemplates();
        res.json({ success: true, templates });
    });

    app.get('/api/crm/templates/:crm', requireApiKeyV3, (req, res) => {
        const { crm } = req.params;
        const template = crmIntegrations.getTemplate(crm);
        if (template) {
            res.json({ success: true, template });
        } else {
            res.status(404).json({ success: false, error: 'CRM não encontrado' });
        }
    });

    // ===== CRM V7.0 - Pipeline, Leads CRM, Follow-Up, Deals, Analytics =====
    try {
        setupCRMRoutes(app);
        console.log('✅ [CRM V7.0] Rotas CRM registradas com sucesso');
    } catch (err) {
        console.error('❌ [CRM V7.0] Erro ao registrar rotas CRM:', err.message);
    }

    // ===== SHORT URLS - Sistema de Encurtamento de Links =====

    // Importar gerador de short URLs
    const { ShortUrlGenerator } = require('./short-url-generator');

    /**
     * 🔗 Redirecionamento de Short URL
     * GET /l/:shortCode
     * 
     * Resolve código curto e redireciona para /chatbot com parâmetros completos
     * Usa cache Redis para performance
     */
    app.get('/l/:shortCode', async (req, res) => {
        try {
            const { shortCode } = req.params;

            // Validar formato do código
            if (!ShortUrlGenerator.isValid(shortCode)) {
                logger.warn(`Short code inválido: ${shortCode}`);
                return res.status(404).send('Link não encontrado');
            }

            // Buscar no cache primeiro (Redis)
            let shortUrl = await CacheManager.get(`short_url:${shortCode}`);

            if (!shortUrl) {
                // Cache miss - buscar no banco
                shortUrl = await DatabaseHelpers.getShortUrl(shortCode);

                if (!shortUrl) {
                    logger.warn(`Short URL não encontrado: ${shortCode}`);
                    return res.status(404).send('Link não encontrado ou expirado');
                }

                // Salvar no cache (1 hora)
                await CacheManager.set(`short_url:${shortCode}`, JSON.stringify(shortUrl), 3600);
                logger.info(`✅ Short URL ${shortCode} em cache`);
            } else {
                shortUrl = JSON.parse(shortUrl);
            }

            // Incrementar contador de acessos (async, não bloqueia)
            DatabaseHelpers.updateShortUrlAccess(shortCode).catch(err => {
                logger.error('Erro ao atualizar contador de acessos:', err);
            });

            // Analytics tracking
            try {
                analyticsManager.trackEvent(shortUrl.api_key, 'short_url_accessed', {
                    shortCode,
                    robotName: shortUrl.robot_name,
                    timestamp: new Date()
                });
            } catch (analyticsError) {
                logger.error('Erro no tracking de analytics:', analyticsError);
            }

            // 🎨 Buscar configuração de whitelabel para este tenant
            let whitelabel = {};
            try {
                const wlResult = await whitelabelManager.getConfig(shortUrl.api_key);
                if (wlResult.success && !wlResult.isDefault) {
                    whitelabel = wlResult.settings || {};
                    logger.info(`🎨 Whitelabel carregado para tenant ${shortUrl.api_key}`);
                }
            } catch (wlError) {
                logger.warn('Não foi possível carregar whitelabel:', wlError);
            }

            // Redirecionar para a rota /chatbot existente COM parâmetros de whitelabel
            const params = new URLSearchParams({
                name: shortUrl.robot_name || 'Assistente IA',
                url: shortUrl.sales_url || '',
                instructions: shortUrl.instructions || '',
                apiKey: shortUrl.api_key
            });

            // Adicionar parâmetros de whitelabel se existirem
            if (whitelabel.companyName) params.set('wlCompany', whitelabel.companyName);
            if (whitelabel.logoUrl) params.set('wlLogo', whitelabel.logoUrl);
            if (whitelabel.primaryColor) params.set('wlPrimary', whitelabel.primaryColor);
            if (whitelabel.secondaryColor) params.set('wlSecondary', whitelabel.secondaryColor);
            if (whitelabel.showPoweredBy !== undefined) params.set('wlPoweredBy', whitelabel.showPoweredBy ? '1' : '0');

            // 🔍 DIAG-SHORT-URL: Log detalhado do redirecionamento
            logger.info(`🔗 [SHORT-URL-REDIRECT] ${shortCode} -> /chatbot | apiKey=${shortUrl.api_key ? shortUrl.api_key.substring(0, 12) + '...' : '⚠️ VAZIA'} | robot=${shortUrl.robot_name || '(sem nome)'} | whitelabel=${!!whitelabel.companyName}`);
            res.redirect(`/chatbot?${params.toString()}`);

        } catch (error) {
            logger.error('❌ Erro no redirect de short URL:', error);
            res.status(500).send('Erro ao processar link');
        }
    });

    /**
     * 📝 Criar Short URL
     * POST /api/create-short-url
     * 
     * Cria um novo short URL para um tenant
     * Body: { robotName, salesUrl, instructions, apiKey }
     */
    app.post('/api/create-short-url', async (req, res) => {
        try {
            const { robotName, salesUrl, instructions, apiKey } = req.body;

            // 🔍 DIAG-SHORT-URL: Log para diagnóstico de criação
            logger.info(`🔗 [CREATE-SHORT-URL] Recebido: robotName=${robotName || '(vazio)'}, salesUrl=${salesUrl ? salesUrl.substring(0, 40) : '(vazio)'}, apiKey=${apiKey ? apiKey.substring(0, 12) + '...' : '⚠️ VAZIA'}`);

            // 🔒 HOTFIX 11.3.1: Limpar cache de checkout ao criar novo assistente
            try {
                if (_v113ClearCache && apiKey) {
                    _v113ClearCache(apiKey);
                    logger.info(`[V11.3-HOTFIX] 🧹 Cache checkout limpo ao criar short URL (tenant=${apiKey.substring(0, 8)}...)`);
                }
            } catch (_clearErr) { /* silencioso */ }

            // Validações
            if (!apiKey) {
                return res.status(400).json({
                    success: false,
                    error: 'API Key is required'
                });
            }

            if (!robotName || !salesUrl) {
                return res.status(400).json({
                    success: false,
                    error: 'Robot name and sales URL are required'
                });
            }

            // 💳 Billing: verificar limite de chatbots do plano (fail-open)
            try {
                const subscription = await billingManager.getSubscription(apiKey);
                const plan = subscription.plan || PLANS.free;
                const maxChatbots = plan.features?.maxChatbots ?? 1;

                if (maxChatbots !== -1) { // -1 = ilimitado (enterprise)
                    const existingUrls = await DatabaseHelpers.getShortUrlsByApiKey(apiKey);
                    if (existingUrls.length >= maxChatbots) {
                        console.warn(`⚠️ [Billing] Limite de chatbots atingido para tenant ${apiKey.substring(0, 8)}... (${existingUrls.length}/${maxChatbots})`);
                        return res.status(429).json({
                            success: false,
                            error: `Limite de assistentes atingido para seu plano (${maxChatbots}). Faça upgrade para criar mais.`,
                            billing: {
                                current: existingUrls.length,
                                max: maxChatbots,
                                planId: subscription.planId
                            }
                        });
                    }
                }
            } catch (billingErr) {
                console.warn('⚠️ [Billing] Enforcement fail-open para maxChatbots:', billingErr.message);
                // Fail-open: permite criar em caso de erro
            }

            // Gerar código curto único
            const shortCode = await ShortUrlGenerator.generateUnique(
                (code) => DatabaseHelpers.shortCodeExists(code)
            );

            // Construir long URL (formato atual)
            const params = new URLSearchParams({
                name: robotName,
                url: salesUrl,
                instructions: instructions || '',
                apiKey: apiKey
            });
            const longUrl = `/chatbot?${params.toString()}`;

            // Salvar no banco
            await DatabaseHelpers.createShortUrl(apiKey, {
                shortCode,
                longUrl,
                robotName,
                salesUrl,
                instructions: instructions || '',
                metadata: {
                    createdVia: 'dashboard',
                    userAgent: req.headers['user-agent']
                }
            });

            // Salvar no cache Redis (1 hora)
            const cacheData = {
                short_code: shortCode,
                api_key: apiKey,
                long_url: longUrl,
                robot_name: robotName,
                sales_url: salesUrl,
                instructions: instructions || ''
            };
            await CacheManager.set(`short_url:${shortCode}`, JSON.stringify(cacheData), 3600);

            // Analytics
            analyticsManager.trackEvent(apiKey, 'short_url_created', {
                shortCode,
                robotName
            });

            // Construir short URL completo
            const protocol = req.protocol;
            const host = req.get('host');
            const shortUrl = `${protocol}://${host}/l/${shortCode}`;

            logger.info(`✅ Short URL criado: ${shortUrl} para tenant ${apiKey}`);

            res.json({
                success: true,
                shortCode,
                shortUrl,
                longUrl: `${protocol}://${host}${longUrl}`,
                message: 'Short URL created successfully'
            });

        } catch (error) {
            logger.error('❌ Erro ao criar short URL:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create short URL: ' + error.message
            });
        }
    });

    console.log('✅ Rotas V3.0 configuradas');

    // ===== 🤖 MEUS ASSISTENTES - CRUD API (Isolado, Feature Flag Gated) =====
    // Leitura via short_urls (PostgreSQL) — mesma fonte do Dashboard Analytics

    // GET /api/assistants — List all assistants for the tenant
    // REDESIGN: Lê da tabela short_urls (mesma fonte do Dashboard Analytics)
    // Fallback seguro: retorna [] se banco falhar — zero impacto em funcionalidades existentes
    app.get('/api/assistants', async (req, res) => {
        try {
            // Priorizar req.query.apiKey para evitar conflito de sessão (TENANCY SAFE)
            const apiKey = req.query.apiKey || (req.session && req.session.validatedApiKey);
            if (!apiKey) return res.status(401).json({ success: false, error: 'API Key não fornecida' });
            try {
                if (featureFlags && featureFlags.isEnabled('FEATURE_MEUS_ASSISTENTES') === false) {
                    return res.status(403).json({ success: false, error: 'Funcionalidade desabilitada' });
                }
            } catch (ffErr) {
                console.warn('🤖 [Assistentes] Feature flag check falhou, permitindo acesso (fallback):', ffErr.message);
            }

            let assistants = [];
            try {
                const shortUrls = await DatabaseHelpers.getShortUrlsByApiKey(apiKey);
                const protocol = req.protocol;
                const host = req.get('host');
                assistants = shortUrls.map(s => ({
                    id: s.short_code,
                    name: s.robot_name || 'Assistente IA',
                    salesUrl: s.sales_url || '',
                    instructions: s.instructions || '',
                    shortUrl: `${protocol}://${host}/l/${s.short_code}`,
                    accessCount: s.access_count || 0,
                    createdAt: s.created_at,
                    status: s.status || 'active'
                }));
            } catch (dbErr) {
                console.warn('🤖 [Assistentes] Fallback: erro ao ler short_urls:', dbErr.message);
                // Fallback seguro: retorna array vazio (comportamento anterior)
            }

            // SAFE PATCH - BUG-LEADS-002: Contagem de leads usando mesma fonte do Dashboard
            let totalLeads = 0;
            try {
                const leadSys = getLeadSystem(apiKey);
                totalLeads = leadSys.getLeads().length;
            } catch (leadsErr) {
                console.warn('⚠️ [Assistentes] Erro ao contar leads (fallback=0):', leadsErr.message);
            }

            console.log(`🤖 [Assistentes] GET - Tenant ${apiKey.substring(0, 8)}... → ${assistants.length} assistentes, ${totalLeads} leads`);
            res.json({ success: true, assistants, total: assistants.length, totalLeads });
        } catch (error) {
            console.error('🤖 [Assistentes] Erro no GET:', error.message);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    console.log('✅ 🤖 Rota GET /api/assistants configurada (lê de short_urls)');
    console.log('🔗 Short URLs habilitadas: GET /l/:code, POST /api/create-short-url');

    // 🛡️ BILLING BLINDADO — Rotas admin (aditivo, protegido por try/catch)
    try {
        const { setupAdminRoutes } = require('./admin-routes');
        setupAdminRoutes(app);
    } catch (error) {
        console.log('⚠️ Admin routes não carregadas (não crítico):', error.message);
    }

    // ===== MULTI-TENANT WHATSAPP ROUTES (NOVO) =====
    require('./whatsapp-routes')(app, logger);  // Carrega e registra rotas WhatsApp multi-tenant
    console.log('✅ Rotas Multi-Tenant WhatsApp integradas');

    // ===== MULTI-TENANT CHATGPT ROUTES (NOVO) =====
    require('./chatgpt-routes')(app, logger);  // Carrega e registra rotas ChatGPT multi-tenant
    console.log('✅ Rotas Multi-Tenant ChatGPT integradas');

    // ===== V8.0 ADMIN ROUTES - COMPLIANCE =====
    try {
        const adminRoutesV8 = require('./lib/admin-routes-v8');
        app.use('/admin/v8', adminRoutesV8);
        console.log('✅ [V8.0] Rotas Admin montadas em /admin/v8');
    } catch (e) {
        console.log('⚠️ [V8.0] Rotas Admin não disponíveis:', e.message);
    }

    // ===== ROTAS DE BILLING/ANALYTICS (routes.js) =====
    try {
        setupRoutes(app);
        console.log('✅ Rotas de Billing/Analytics registradas (routes.js)');
    } catch (e) {
        console.log('⚠️ Rotas de Billing/Analytics não disponíveis:', e.message);
    }

    // ===== V8.0 RATE LIMITER MIDDLEWARE (OPCIONAL - CONTROLADO POR FEATURE FLAG) =====
    if (rateLimiterAdvanced && featureFlags && featureFlags.isEnabled('FEATURE_ADVANCED_RATE_LIMIT')) {
        try {
            app.use(rateLimiterAdvanced.middleware());
            console.log('✅ [V8.0] Rate Limiter Avançado ATIVADO');
        } catch (e) {
            console.log('⚠️ [V8.0] Rate Limiter Avançado falhou:', e.message);
        }
    }

    // ===== V8.0 LGPD CONSENT INITIALIZATION =====
    if (lgpdConsentManager) {
        try {
            lgpdConsentManager.initialize(db);
            console.log('✅ [V8.0] LGPD Consent Manager inicializado');
        } catch (e) {
            console.log('⚠️ [V8.0] LGPD Consent Manager falhou:', e.message);
        }
    }

    // ===== V8.0 ENCRYPTION MANAGER INITIALIZATION =====
    if (encryptionManager) {
        try {
            encryptionManager.initialize();
            console.log('✅ [V8.0] Encryption Manager inicializado');
        } catch (e) {
            console.log('⚠️ [V8.0] Encryption Manager falhou:', e.message);
        }
    }

    // 🔧 ADMIN ROUTES — 10 endpoints /api/admin/* para billing blindado
    try {
        const { setupAdminRoutes } = require('./admin-routes');
        setupAdminRoutes(app);
        console.log('✅ Admin routes (billing) carregadas');
    } catch (error) {
        console.log('⚠️ Admin routes não carregadas (não crítico):', error.message);
    }

    // ===== V2.0 GROWTH LOOP: /criar-link (ADITIVO, try/catch + fallback) =====
    try {
        const criarLinkPath = path.join(__dirname, 'public', 'criar-link.html');
        app.get('/criar-link', (req, res) => {
            try {
                const fs = require('fs');
                if (fs.existsSync(criarLinkPath)) {
                    console.log(`[V2.0 Growth] /criar-link acessado — ref=${req.query.ref || 'direct'}`);
                    res.sendFile(criarLinkPath);
                } else {
                    console.warn('[V2.0 Growth] criar-link.html não encontrado, fallback para demo');
                    res.redirect('/public/demo.html');
                }
            } catch (routeErr) {
                console.error('[V2.0 Growth] Erro na rota /criar-link:', routeErr.message);
                res.redirect('/public/demo.html');
            }
        });
        console.log('✅ [V2.0] Rota /criar-link configurada (Growth Loop)');
    } catch (e) {
        console.warn('⚠️ [V2.0] Rota /criar-link não disponível:', e.message);
    }

    // ═══════════════════════════════════════════════════════════════════
    // 🔥 V11.3 — ENDPOINTS FALLBACK INVISÍVEL (CHECKOUT MAGIC)
    // Protegido por FEATURE_V11_3_FALLBACK + try/catch total
    // ═══════════════════════════════════════════════════════════════════

    // POST /api/confirm-checkout — Salva checkout link (user confirmed ou auto)
    app.post('/api/confirm-checkout', async (req, res) => {
        try {
            const _v113Enabled = featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_V11_3_FALLBACK');
            if (!_v113Enabled || !_v113SaveCheckoutLink) {
                return res.json({ success: false, error: 'V11.3 não habilitado' });
            }

            const { apiKey, checkoutUrl, source, salesUrl } = req.body || {};
            if (!apiKey || !checkoutUrl) {
                return res.status(400).json({ success: false, error: 'apiKey e checkoutUrl são obrigatórios' });
            }

            // Validar URL
            try { new URL(checkoutUrl); } catch (_) {
                return res.status(400).json({ success: false, error: 'URL inválida' });
            }

            // FIX V12.1: Passar salesUrl para isolamento por URL
            const saved = await _v113SaveCheckoutLink(db, apiKey, checkoutUrl, source || 'user_confirmed', true, salesUrl || null);
            console.log(`[V12.1-AUDIT] 🔗 Checkout confirmado via API: tenant=${apiKey.substring(0, 8)}... url=${checkoutUrl.substring(0, 80)} salesUrl=${(salesUrl || 'default').substring(0, 60)}`);

            // 🔒 HOTFIX 11.3.1: Limpar cache após confirmação para forçar refresh
            try {
                if (_v113ClearCache) _v113ClearCache(apiKey);
            } catch (_) { /* silencioso */ }

            return res.json({ success: saved, message: saved ? 'Checkout salvo com sucesso' : 'Erro ao salvar' });
        } catch (err) {
            console.warn('[V11.3] ⚠️ Erro no endpoint confirm-checkout:', err.message);
            return res.status(500).json({ success: false, error: 'Erro interno' });
        }
    });

    // GET /api/checkout-status — Retorna status do checkout do tenant
    app.get('/api/checkout-status', async (req, res) => {
        try {
            const _v113Enabled = featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_V11_3_FALLBACK');
            if (!_v113Enabled || !_v113GetCheckoutStatus) {
                return res.json({ success: true, hasCheckout: false });
            }

            const apiKey = req.query.apiKey;
            const salesUrl = req.query.salesUrl || null;
            if (!apiKey) {
                return res.status(400).json({ success: false, error: 'apiKey é obrigatório' });
            }

            // FIX V12.1: Passar salesUrl para isolamento por URL
            const status = await _v113GetCheckoutStatus(db, apiKey, salesUrl);
            return res.json({ success: true, ...status });
        } catch (err) {
            console.warn('[V11.3] ⚠️ Erro no endpoint checkout-status:', err.message);
            return res.json({ success: true, hasCheckout: false });
        }
    });

    console.log('✅ [V11.3] Endpoints /api/confirm-checkout e /api/checkout-status configurados');

    app.listen(PORT, '0.0.0.0', () => {
        logger.info('Server running on port ' + PORT);

        console.log(`🌐 Servidor rodando em http://0.0.0.0:${PORT}`);
        console.log(`📊 Dashboard: http://0.0.0.0:${PORT}/api/system/status`);
        console.log(`🚀 LinkMágico v7.0 SUPERINTELIGENTE running on http://0.0.0.0:${PORT}`);
        console.log(`📊 Health check: http://0.0.0.0:${PORT}/health`);
        console.log(`🤖 Chatbot disponível em: http://0.0.0.0:${PORT}/chatbot`);
        console.log(`🔧 Widget JS disponível em: http://0.0.0.0:${PORT}/public/widget.js`);
        console.log(`🎯 Sistema de captura de leads PERSISTENTE ATIVADO`);
        console.log(`📈 Painel de leads: http://0.0.0.0:${PORT}/admin/leads`);
        console.log(`📞 Extração de contatos: ATIVADA`);
        console.log(`🧠 SUPERINTELIGÊNCIA CONVERSACIONAL: ATIVADA`);
        console.log(`🎭 Detecção de sarcasmo e ironia: IMPLEMENTADA`);
        console.log(`🧩 Análise de múltiplas intenções: FUNCIONANDO`);
        console.log(`💾 Memória conversacional avançada: OPERACIONAL`);
        console.log(`🎨 Personalidades adaptativas: CONSULTIVO, EMPÁTICO, TÉCNICO, MOTIVACIONAL`);
        console.log(`🚨 Detecção de urgência: ATIVADA`);
        console.log(`📅 Sistema de agendamento: IMPLEMENTADO`);
        console.log(`🎯 Botões fixos no topo: FUNCIONANDO`);
        console.log(`👥 Jornada do cliente: Análise inteligente ATIVADA`);
        console.log(`🧠 Endpoint superinteligente: /api/process-chat-inteligente`);
        console.log(`🎉 SISTEMA SUPERINTELIGENTE IMPLANTADO COM SUCESSO!`);

        // ===== INFORMAÇÕES V8.0 =====
        console.log('');
        console.log('═══════════════════════════════════════════');
        console.log('  📦 LINK MÁGICO V8.0 - MELHORIAS ATIVADAS');
        console.log('═══════════════════════════════════════════');
        console.log(`  🎛️ Feature Flags: ${featureFlags ? 'CARREGADO' : 'OFF'}`);
        console.log(`  📋 Audit Logger: ${auditLogger ? 'CARREGADO' : 'OFF'}`);
        console.log(`  🧠 Persistent Memory: ${persistentMemory ? 'CARREGADO' : 'OFF'}`);
        console.log(`  🎭 Enhanced Sentiment: ${enhancedSentiment ? 'CARREGADO' : 'OFF'}`);
        console.log('───────────────────────────────────────────');
        console.log('  🔒 COMPLIANCE V8.0');
        console.log('───────────────────────────────────────────');
        console.log(`  🚦 Rate Limiter: ${rateLimiterAdvanced ? 'CARREGADO' : 'OFF'}`);
        console.log(`  📋 LGPD Consent: ${lgpdConsentManager ? 'CARREGADO' : 'OFF'}`);
        console.log(`  🔐 Encryption: ${encryptionManager ? 'CARREGADO' : 'OFF'}`);
        console.log('───────────────────────────────────────────');
        console.log(`  🛠️ Admin V8.0: /admin/v8/status`);
        console.log('═══════════════════════════════════════════');

        // ===== V9.0 BLINDADA =====
        console.log('');
        console.log('═══════════════════════════════════════════');
        console.log('  🚀 LINK MÁGICO V9.0 — BLINDADA');
        console.log('═══════════════════════════════════════════');
        console.log('  🏥 Health V9: /healthz (DB, Mem, EventLoop)');
        console.log('  🚦 Rate Limiter V9: whitelist + stress + tiers');
        console.log('  ⚡ Circuit Breaker: LLM/Puppeteer/Extração');
        console.log('  🧠 Cache LLM V9: TTL 5min + normalização');
        console.log('  📊 Logs: JSON estruturado');
        console.log('═══════════════════════════════════════════');

        // ═══ V14.0 — Inicialização Auto-Otimização ═══
        try {
            const _v14Enabled = process.env.FEATURE_V14_SELF_OPTIMIZING === 'true' ||
                (featureFlags && featureFlags.isEnabled && featureFlags.isEnabled('FEATURE_V14_SELF_OPTIMIZING'));
            
            if (_v14Enabled && db) {
                console.log('');
                console.log('═══════════════════════════════════════════');
                console.log('  🧠 V14.0 — AUTO-OTIMIZAÇÃO ATIVA');
                console.log('═══════════════════════════════════════════');

                // Criar índices
                if (_v14Logger && _v14Logger.ensureIndexes) {
                    _v14Logger.ensureIndexes(db).catch(() => {});
                }

                // Carregar pesos do DB
                if (_v14PatternAnalyzer && _v14PatternAnalyzer.loadWeightsFromDB) {
                    _v14PatternAnalyzer.loadWeightsFromDB(db).catch(() => {});
                }

                // Iniciar cron (análise a cada 10 min)
                if (_v14PatternAnalyzer && _v14PatternAnalyzer.startAnalysisCron) {
                    _v14PatternAnalyzer.startAnalysisCron(db);
                }

                console.log('  ✅ Logger + Analyzer + Cron ATIVOS');
                console.log('═══════════════════════════════════════════');
            } else {
                console.log('[V14] ⏸️ Auto-Otimização DESATIVADA (flag off ou sem DB)');
            }
        } catch (_v14BootErr) {
            console.warn('[V14] ⚠️ Erro na inicialização (sem impacto):', _v14BootErr.message);
        }
    });

})();
