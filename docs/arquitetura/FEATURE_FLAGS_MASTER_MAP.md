# FEATURE_FLAGS_MASTER_MAP — Link Mágico

> Documento gerado por leitura estática do código real. Não contém recomendações, correções ou patches.

## SEÇÃO 1 — VISÃO GERAL

O sistema de Feature Flags do Link Mágico é um mecanismo híbrido de controle condicional implementado principalmente em `lib/feature-flags.js`, com `FEATURE_DEFINITIONS`, carregamento por variáveis de ambiente, arquivo `data/feature_flags.json`, overrides em memória e overrides por tenant. O servidor também possui gates diretos por `process.env` fora do gerenciador central.

Tecnicamente, o objetivo é ativar/desativar camadas SaaS sem deploy: memória, compliance, IA modular, checkout, CTA, Decision Core, orquestração, extração, WhatsApp, captura de lead e versões V10–V19. Comercialmente, as flags controlam venda, trial, afiliados, onboarding, checkout, CTA, WhatsApp como CTA e captura de leads. Na arquitetura V17–V20, V17 é cérebro unificado, V18 blinda extração, V19 oferece autoridade determinística e V20 aparece apenas como marcador/pesquisa textual sem definição central consumida. Segurança entra por auditoria, criptografia, rate limit, isolamento de checkout, tokens e channel resolver. Deploy/rollback são feitos por opt-in/opt-out e kill switches como `WA_USE_FULL_PIPELINE`, `FEATURE_DETERMINISTIC_V19=shadow|true|false` e flags `FEATURE_*`.

Podem mudar sem alterar código: prompts e comportamento de IA, resolução de checkout/CTA, extração com fallback Puppeteer/Crawl4AI, roteamento WhatsApp, captura de lead, módulos comerciais, persistência PostgreSQL/Redis, limites/circuit breakers, onboarding/billing e logs.

## SEÇÃO 2 — INVENTÁRIO GLOBAL

Inventário central: 49 definições em `lib/feature-flags.js`; inventário adicional: 21 gates/env toggles relevantes fora do mapa central.

| Flag | Arquivo:linha | Default | Risco | Finalidade |
|---|---:|---|---|---|
| `FEATURE_PERSISTENT_MEMORY` | `lib/feature-flags.js:22` | `false` | low | Memória Persistente: Salva memória conversacional no banco de dados |
| `FEATURE_ENHANCED_SENTIMENT` | `lib/feature-flags.js:30` | `false` | low | Análise de Sentimento Avançada: Análise emocional com contexto, negações e intensificadores |
| `FEATURE_AUDIT_LOGGING` | `lib/feature-flags.js:38` | `false` | none | Logs de Auditoria: Registra ações críticas para compliance |
| `FEATURE_ENCRYPT_SENSITIVE` | `lib/feature-flags.js:44` | `false` | medium | Criptografia de Dados Sensíveis: Criptografa emails, telefones e mensagens no banco |
| `FEATURE_ADVANCED_RATE_LIMIT` | `lib/feature-flags.js:50` | `false` | low | Rate Limiting Avançado: Rate limit granular por endpoint e tenant |
| `FEATURE_MODULAR_AI` | `lib/feature-flags.js:58` | `false` | medium | Sistema de IA Modular: Usa módulos refatorados de IA |
| `FEATURE_SMART_ESCALATION` | `lib/feature-flags.js:66` | `false` | low | Escalonamento Inteligente: Detecta quando transferir para humano |
| `FEATURE_CONVERSATION_CONTEXT` | `lib/feature-flags.js:72` | `false` | low | Contexto Conversacional: Mantém contexto entre mensagens para respostas melhores |
| `FEATURE_CLEAN_CHAT_V2` | `lib/feature-flags.js:80` | `false` | low | Chat Limpo V2: Usa prompt limpo e direto, respeitando Instruções Personalizadas e FAQs sem floreios |
| `FEATURE_MEUS_ASSISTENTES` | `lib/feature-flags.js:88` | `true` | low | Meus Assistentes: Painel de gerenciamento de assistentes IA por tenant |
| `FEATURE_SALES_LAYER` | `lib/feature-flags.js:95` | `false` | low | Camada de Venda Híbrida: Pós-processamento persuasivo sobre resposta da IA base. Não altera contexto, URL ou instruções originais. |
| `FEATURE_PRESETS` | `lib/feature-flags.js:103` | `true` | low | Presets Multi-Nicho: Auto-seleção de comportamento de venda por tipo de negócio (produto_digital, afiliado, servico, lead, ecommerce, local_business) |
| `FEATURE_DECISION_ENGINE` | `lib/feature-flags.js:111` | `true` | low | Decision Engine (Modo Automático): Camada intermediária de decisão inteligente para modo automático. Detecta intenção real do usuário e decide estratégia de venda. |
| `FEATURE_DECISION_ENGINE_V2` | `lib/feature-flags.js:119` | `false` | low | Decision Engine V2 (Avançado): Evolução do Decision Engine com detecção avançada de intenção (confidence scoring), análise de histórico, decision matrix, anti-erro e auto- |
| `FEATURE_AUTO_LEARNING` | `lib/feature-flags.js:127` | `true` | low | Auto-Learning System: Sistema de aprendizado automático que coleta dados de conversas e otimiza respostas com base em padrões de conversão. Tracker → Performance  |
| `AUTO_LEARNING_TEST_MODE` | `lib/feature-flags.js:135` | `true` | none | Auto-Learning Modo de Teste: Reduz limiares para testar o auto-learning mais rapidamente. Recálculo a cada 5 eventos em vez de 100. |
| `FEATURE_HEALTH_V2` | `lib/feature-flags.js:146` | `true` | none | Health Check V2 (/healthz): Endpoint /healthz com status de DB, cache, Puppeteer, event loop lag e memória do processo. |
| `FEATURE_RATE_LIMIT_V2` | `lib/feature-flags.js:152` | `true` | low | Rate Limiter V9 Inteligente: Rate limiting com whitelist de IP (ENV), bypass de stress test (header), tenant tiers (apiKey-based) e log JSON. |
| `FEATURE_CACHE_V2` | `lib/feature-flags.js:158` | `true` | low | Cache LLM V9: Cache de respostas LLM com TTL de 5 minutos, normalização de mensagem para melhor hit rate e logs estruturados. |
| `FEATURE_CIRCUIT_BREAKER` | `lib/feature-flags.js:164` | `true` | low | Circuit Breaker V9: Proteção contra chamadas lentas (timeout configurável via ENV). Circuit breaker com estados CLOSED/OPEN/HALF_OPEN para LLM, Puppeteer e Extr |
| `FEATURE_STRUCTURED_LOGS` | `lib/feature-flags.js:170` | `true` | none | Logs Estruturados V9: Padronização de logs em JSON estruturado: [RATE-LIMIT], [DB], [LLM], [CACHE_HIT], [CACHE_MISS], [TIMEOUT], [FALLBACK]. |
| `FEATURE_DECISION_CORE` | `lib/feature-flags.js:177` | `true` | low | Decision Core V9: Camada determinística de decisão para override final de intenções críticas (Venda/Pós-Venda). |
| `FEATURE_ORCHESTRATOR_V10` | `lib/feature-flags.js:188` | `true` | low | Orchestrator V10: Camada única de decisão final que elimina conflitos entre CTA, Closing, Decision Core e Sales Layer. Hierarquia: post_sale > buy > CTA > clo |
| `FEATURE_AUTO_CHECKOUT_DETECTION` | `lib/feature-flags.js:195` | `true` | low | Auto Checkout Detection V9.1: Detecta automaticamente links de checkout no frontend (widget) e envia ao backend via context. Prioridade máxima no link-resolver. |
| `FEATURE_SMART_CHECKOUT_SELECTOR` | `lib/feature-flags.js:202` | `true` | low | Smart Checkout Selector V9.2: Seleciona o melhor botão de checkout baseado em score heurístico quando há múltiplos links na página. |
| `FEATURE_CHECKOUT_AUTHORITY` | `lib/feature-flags.js:213` | `true` | low | Checkout Authority V9.5: Camada FINAL de autoridade que garante link de checkout obrigatório quando intenção de compra é detectada. Determinístico, sem depender da I |
| `FEATURE_V10_BEHAVIOR_LAYER` | `lib/feature-flags.js:224` | `true` | low | V10 Behavior Layer: Camada de disciplina comportamental da IA no system prompt. Garante resposta direta, proíbe inversão de lógica, elimina respostas genéricas. |
| `FEATURE_V11_ENGINE` | `lib/feature-flags.js:235` | `false` | low | V11 Engine (Checkout Discovery + Links Map + State): Engine completa V11: Checkout Discovery (Puppeteer), Links Map (fonte única), Action Resolver (determinístico), Conversation State (memória) |
| `FEATURE_V11_2_RAG` | `lib/feature-flags.js:246` | `true` | low | V11.2 RAG Engine (Auto Extração + Conhecimento + Checkout): Engine V11.2: Domain Crawler (sublinks), Content Extractor (conteúdo real), Knowledge Builder (RAG simples), Checkout Discovery passivo (fal |
| `FEATURE_V11_3_FALLBACK` | `lib/feature-flags.js:257` | `true` | low | V11.3 Fallback Invisível (Checkout Magic): Fallback invisível de checkout: auto-detecção + cache DB + UI mágica que pede link sem parecer configuração. Persiste checkout por tenant. I |
| `FEATURE_V12_SAFE_CHECKOUT` | `lib/feature-flags.js:268` | `true` | low | V12 Safe Checkout Resolver: Isolamento absoluto anti-cross-tenant: validação de domínio, sanitização de URL, cache de validação por tenant. Bloqueia checkout inválido/c |
| `FEATURE_V12_FORCE_CHECKOUT` | `lib/feature-flags.js:275` | `true` | low | V12 Force Checkout Layer: Backend soberano: garante injeção de checkout quando IA detecta intenção de compra, independente do que a IA responde. Anti-duplicação, anti |
| `FEATURE_V12_STATE_PROMPT` | `lib/feature-flags.js:282` | `true` | low | V12 Conversation State Prompt: Injeção de estado conversacional (estágio, histórico de intenções) no system prompt. Anti-amnésia: IA mantém coerência entre mensagens. |
| `FEATURE_V12_SELF_HEALING` | `lib/feature-flags.js:289` | `true` | low | V12 Self-Healing Engine + Response Validator + Learning Memory: Sistema autônomo: detecta falhas (checkout missing, resposta fraca, baixa confiança), corrige em tempo real, valida resposta e registra para |
| `FEATURE_V13_BLINDADO` | `lib/feature-flags.js:296` | `false` | medium | V13 Arquitetura Blindada — Controle Externo da IA: Pipeline completo: Intent Classifier (determinístico) → State Manager (score) → Rule Engine (hard rules) → Prompt Blindado (IA limitada) → V |
| `FEATURE_V13_MULTI_CHECKOUT` | `lib/feature-flags.js:303` | `false` | low | V13.2 Multi-Checkout Engine — Upsell/Downsell Inteligente: Decide qual checkout enviar (primary/upsell/downsell) com base em intent, state e contexto. Requer FEATURE_V13_BLINDADO ativo. Usa env var F |
| `FEATURE_V14_CONTEXT_LAYER` | `lib/feature-flags.js:314` | `true` | low | V14 Context & Human Behavior Layer: Memória de curto prazo (últimas 10 msgs por sessão), anti-repetição, contexto conversacional injetado no prompt, coerência de produto. Atua  |
| `FEATURE_V16_2_BLINDADO_FINAL` | `lib/feature-flags.js:325` | `false` | low | V16.2 Decision Engine Blindado Final — Anti-Perda de Venda: Camada determinística de decisão comercial SOBRE V13. Normalização de input, engine de prioridade, price handler agressivo, anti-resposta-fr |
| `FEATURE_ASSISTANT_DIAGNOSTIC` | `lib/feature-flags.js:332` | `true` | low | Assistant Diagnostic & Readiness Score: Valida se o assistente tem dados suficientes (checkout, conteúdo, FAQ, WhatsApp) antes da ativação. Mostra diagnóstico no frontend. |
| `FEATURE_DEEP_CONTEXT_EXPLORER` | `lib/feature-flags.js:343` | `true` | low | V14.3 Deep Context Explorer: Explora subpáginas do mesmo domínio (até 5 páginas, 3 níveis) para enriquecer dados extraídos: FAQ, WhatsApp, checkout, conteúdo. Puppeteer  |
| `FEATURE_V15_CONTEXT_ENFORCEMENT` | `lib/feature-flags.js:354` | `false` | low | V15 Context Enforcement Layer: Middleware determinístico de última milha: intercepta resposta final e garante entrega obrigatória de checkout, WhatsApp e FAQ quando intenç |
| `FEATURE_V15_KNOWLEDGE_ENFORCER` | `lib/feature-flags.js:365` | `false` | low | V15.5 Knowledge Enforcement Layer: Força uso de conteúdo real (FAQ, descrição) sem interferir em decisão ou venda. Corrige respostas genéricas/fracas usando dados extraídos (V |
| `FEATURE_V17_BRAIN` | `lib/feature-flags.js:378` | `false` | high | V17 Unified Brain Orchestrator: Cérebro unificado: V17 decide estratégia (intent, sellMode, tone), monta prompt dinâmico, LLM responde, sanitizer leve. Bypassa completament |
| `FEATURE_V18_EXTRACTION_GUARD` | `lib/feature-flags.js:386` | `true` | low | V18 Extraction Guard: Blindagem contra extractor imperfeito. Avalia confiança da extração (ok/partial/failed), classifica links descobertos, diferencia "não exist |
| `FEATURE_V18_FALLBACK` | `lib/feature-flags.js:392` | `false` | medium | V18 Fallback Inteligente: Preenche checkout/whatsapp ausentes usando links descobertos no pageData quando extração não é confiável. Requer FEATURE_V18_EXTRACTION_GUAR |
| `FEATURE_WA_CTA_PROMOTER` | `lib/feature-flags.js:403` | `true` | low | WA-as-CTA Promoter: Promove WhatsApp como CTA primário quando: (1) nenhum checkout detectado, (2) WhatsApp tem intenção de conversão (confidence >= 0.6). Usa sc |
| `FEATURE_DETERMINISTIC_V19` | `lib/feature-flags.js:418` | `false` | medium | V19 Deterministic Decision Engine: Autoridade ÚNICA de decisão comercial. Substitui V18.1-V18.4/PP-GLOBAL/IS_BUYER sticky. Intent resolver determinístico, state machine com re |
| `FEATURE_CHANNEL_RESOLVER_SAFE` | `lib/feature-flags.js:432` | `true` | low | Channel Resolver Safe Layer: Garante que o usuário nunca fique sem caminho de contato quando pede suporte/humano. Só atua em support intent, nunca sobrescreve WhatsApp j |
| `FEATURE_CHAT_FIRST` | `lib/feature-flags.js:445` | `true` | low | Chat First + Captura Inteligente: Elimina formulário bloqueante na entrada. Visitante entra direto no chat. Captura de lead ocorre inline quando Lead Capture Score detecta in |
| `WA_USE_FULL_PIPELINE` | `whatsapp-channel.js:49` | `true` | — | Kill switch do pipeline completo WhatsApp; false retorna ao pipeline anterior. |
| `FEATURE_PUPPETEER` | `server.js:627,5910; lib/puppeteer-extractor.js:427` | `false` | — | Fallback de extração JS-heavy; só roda quando true. |
| `ENABLE_V11_DISCOVERY` | `server.js:6463` | `false` | — | Ativa discovery Puppeteer da V11. |
| `SALES_LAYER_MODE` | `server.js:6212,6488,6641,7274,7961,8385` | `auto` | — | Modo comercial global quando pageData não define salesMode. |
| `DEBUG_SALES` | `server.js:7981,8000; sales/decision-engine.js` | `false` | — | Logs de decisão comercial. |
| `FEATURE_WIDGET_TOKEN` | `server.js:3781,12758` | `true` | — | Gate de token de widget; false desativa validação/registro. |
| `FEATURE_TRIAL` | `stripe-routes.js:62,210` | `true` | — | Gate comercial de trial Stripe; false bloqueia trial. |
| `FEATURE_AFFILIATES` | `affiliate-program.js:26; server.js:12811` | `true` | — | Gate do programa de afiliados. |
| `FEATURE_SELF_SERVICE_SIGNUP` | `server.js:12736` | `true` | — | Gate de signup self-service. |
| `FEATURE_EMAIL_LOGIN` | `server.js:12747` | `true` | — | Gate de login por email. |
| `FEATURE_ONBOARDING_EMAILS` | `email-queue-worker.js:16; server.js:12773` | `true` | — | Gate de emails de onboarding. |
| `FEATURE_TEMPLATES` | `server.js:12800` | `true` | — | Gate de templates. |
| `FEATURE_WEEKLY_REPORT` | `weekly-report.js:14; server.js:12825` | `true` | — | Gate de relatório semanal. |
| `USE_POSTGRES` | `database.js:16; whitelabel.js; lib/leads/lead-capture.js:15` | `auto DATABASE_URL ou true` | — | Seleciona PostgreSQL vs SQLite/compatibilidade. |
| `USE_REDIS` | `cache.js:12` | `auto REDIS_URL ou true` | — | Seleciona Redis vs cache em memória. |
| `RATE_LIMIT_DISABLED` | `lib/rate-limiter-advanced.js:42` | `false` | — | Kill switch global do rate limit avançado. |
| `CRAWL4AI_MODE` | `firecrawl-replacement.js:27` | `python` | — | Seleciona modo docker/python/api para Crawl4AI. |
| `CRAWL4AI_DOCKER_URL` | `crawl4ai-adapter.js:20` | `http://localhost:11235` | — | Endpoint do adapter Crawl4AI Docker. |
| `GROQ_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY` | `server.js:6000-6060` | `ausente` | — | Gates por disponibilidade de provedor LLM. |
| `CHATGPT_API_KEY` | `chatgpt-integration.js:327` | `ausente` | — | Gate global de integração ChatGPT. |
| `WHATSAPP_PROVIDER` | `whatsapp-integration.js:487; whatsapp-routes.js:83` | `ausente` | — | Seleciona Twilio/Evolution e indica fallback global. |

## SEÇÃO 3 — MATRIZ GLOBAL DE FLAGS

| Flag | Arquivo | Default | Consumidores | Impacto Comercial | Impacto Técnico |
|---|---|---|---|---|---|
| `FEATURE_PERSISTENT_MEMORY` | `lib/feature-flags.js:22` | `false` | `featureFlags.isEnabled`, server/lib consumidores | baixo/suporte | central manager/env/file/tenant override; risco low |
| `FEATURE_ENHANCED_SENTIMENT` | `lib/feature-flags.js:30` | `false` | `featureFlags.isEnabled`, server/lib consumidores | baixo/suporte | central manager/env/file/tenant override; risco low |
| `FEATURE_AUDIT_LOGGING` | `lib/feature-flags.js:38` | `false` | `featureFlags.isEnabled`, server/lib consumidores | baixo/suporte | central manager/env/file/tenant override; risco none |
| `FEATURE_ENCRYPT_SENSITIVE` | `lib/feature-flags.js:44` | `false` | `featureFlags.isEnabled`, server/lib consumidores | baixo/suporte | central manager/env/file/tenant override; risco medium |
| `FEATURE_ADVANCED_RATE_LIMIT` | `lib/feature-flags.js:50` | `false` | `featureFlags.isEnabled`, server/lib consumidores | baixo/suporte | central manager/env/file/tenant override; risco low |
| `FEATURE_MODULAR_AI` | `lib/feature-flags.js:58` | `false` | `featureFlags.isEnabled`, server/lib consumidores | médio | central manager/env/file/tenant override; risco medium |
| `FEATURE_SMART_ESCALATION` | `lib/feature-flags.js:66` | `false` | `featureFlags.isEnabled`, server/lib consumidores | baixo/suporte | central manager/env/file/tenant override; risco low |
| `FEATURE_CONVERSATION_CONTEXT` | `lib/feature-flags.js:72` | `false` | `featureFlags.isEnabled`, server/lib consumidores | médio | central manager/env/file/tenant override; risco low |
| `FEATURE_CLEAN_CHAT_V2` | `lib/feature-flags.js:80` | `false` | `featureFlags.isEnabled`, server/lib consumidores | baixo/suporte | central manager/env/file/tenant override; risco low |
| `FEATURE_MEUS_ASSISTENTES` | `lib/feature-flags.js:88` | `true` | `featureFlags.isEnabled`, server/lib consumidores | baixo/suporte | central manager/env/file/tenant override; risco low |
| `FEATURE_SALES_LAYER` | `lib/feature-flags.js:95` | `false` | `featureFlags.isEnabled`, server/lib consumidores | alto | central manager/env/file/tenant override; risco low |
| `FEATURE_PRESETS` | `lib/feature-flags.js:103` | `true` | `featureFlags.isEnabled`, server/lib consumidores | baixo/suporte | central manager/env/file/tenant override; risco low |
| `FEATURE_DECISION_ENGINE` | `lib/feature-flags.js:111` | `true` | `featureFlags.isEnabled`, server/lib consumidores | alto | central manager/env/file/tenant override; risco low |
| `FEATURE_DECISION_ENGINE_V2` | `lib/feature-flags.js:119` | `false` | `featureFlags.isEnabled`, server/lib consumidores | alto | central manager/env/file/tenant override; risco low |
| `FEATURE_AUTO_LEARNING` | `lib/feature-flags.js:127` | `true` | `featureFlags.isEnabled`, server/lib consumidores | médio | central manager/env/file/tenant override; risco low |
| `AUTO_LEARNING_TEST_MODE` | `lib/feature-flags.js:135` | `true` | `featureFlags.isEnabled`, server/lib consumidores | médio | central manager/env/file/tenant override; risco none |
| `FEATURE_HEALTH_V2` | `lib/feature-flags.js:146` | `true` | `featureFlags.isEnabled`, server/lib consumidores | baixo/suporte | central manager/env/file/tenant override; risco none |
| `FEATURE_RATE_LIMIT_V2` | `lib/feature-flags.js:152` | `true` | `featureFlags.isEnabled`, server/lib consumidores | baixo/suporte | central manager/env/file/tenant override; risco low |
| `FEATURE_CACHE_V2` | `lib/feature-flags.js:158` | `true` | `featureFlags.isEnabled`, server/lib consumidores | baixo/suporte | central manager/env/file/tenant override; risco low |
| `FEATURE_CIRCUIT_BREAKER` | `lib/feature-flags.js:164` | `true` | `featureFlags.isEnabled`, server/lib consumidores | baixo/suporte | central manager/env/file/tenant override; risco low |
| `FEATURE_STRUCTURED_LOGS` | `lib/feature-flags.js:170` | `true` | `featureFlags.isEnabled`, server/lib consumidores | baixo/suporte | central manager/env/file/tenant override; risco none |
| `FEATURE_DECISION_CORE` | `lib/feature-flags.js:177` | `true` | `featureFlags.isEnabled`, server/lib consumidores | alto | central manager/env/file/tenant override; risco low |
| `FEATURE_ORCHESTRATOR_V10` | `lib/feature-flags.js:188` | `true` | `featureFlags.isEnabled`, server/lib consumidores | médio | central manager/env/file/tenant override; risco low |
| `FEATURE_AUTO_CHECKOUT_DETECTION` | `lib/feature-flags.js:195` | `true` | `featureFlags.isEnabled`, server/lib consumidores | alto | central manager/env/file/tenant override; risco low |
| `FEATURE_SMART_CHECKOUT_SELECTOR` | `lib/feature-flags.js:202` | `true` | `featureFlags.isEnabled`, server/lib consumidores | alto | central manager/env/file/tenant override; risco low |
| `FEATURE_CHECKOUT_AUTHORITY` | `lib/feature-flags.js:213` | `true` | `featureFlags.isEnabled`, server/lib consumidores | alto | central manager/env/file/tenant override; risco low |
| `FEATURE_V10_BEHAVIOR_LAYER` | `lib/feature-flags.js:224` | `true` | `featureFlags.isEnabled`, server/lib consumidores | médio | central manager/env/file/tenant override; risco low |
| `FEATURE_V11_ENGINE` | `lib/feature-flags.js:235` | `false` | `featureFlags.isEnabled`, server/lib consumidores | médio | central manager/env/file/tenant override; risco low |
| `FEATURE_V11_2_RAG` | `lib/feature-flags.js:246` | `true` | `featureFlags.isEnabled`, server/lib consumidores | médio | central manager/env/file/tenant override; risco low |
| `FEATURE_V11_3_FALLBACK` | `lib/feature-flags.js:257` | `true` | `featureFlags.isEnabled`, server/lib consumidores | médio | central manager/env/file/tenant override; risco low |
| `FEATURE_V12_SAFE_CHECKOUT` | `lib/feature-flags.js:268` | `true` | `featureFlags.isEnabled`, server/lib consumidores | alto | central manager/env/file/tenant override; risco low |
| `FEATURE_V12_FORCE_CHECKOUT` | `lib/feature-flags.js:275` | `true` | `featureFlags.isEnabled`, server/lib consumidores | alto | central manager/env/file/tenant override; risco low |
| `FEATURE_V12_STATE_PROMPT` | `lib/feature-flags.js:282` | `true` | `featureFlags.isEnabled`, server/lib consumidores | médio | central manager/env/file/tenant override; risco low |
| `FEATURE_V12_SELF_HEALING` | `lib/feature-flags.js:289` | `true` | `featureFlags.isEnabled`, server/lib consumidores | médio | central manager/env/file/tenant override; risco low |
| `FEATURE_V13_BLINDADO` | `lib/feature-flags.js:296` | `false` | `featureFlags.isEnabled`, server/lib consumidores | médio | central manager/env/file/tenant override; risco medium |
| `FEATURE_V13_MULTI_CHECKOUT` | `lib/feature-flags.js:303` | `false` | `featureFlags.isEnabled`, server/lib consumidores | alto | central manager/env/file/tenant override; risco low |
| `FEATURE_V14_CONTEXT_LAYER` | `lib/feature-flags.js:314` | `true` | `featureFlags.isEnabled`, server/lib consumidores | médio | central manager/env/file/tenant override; risco low |
| `FEATURE_V16_2_BLINDADO_FINAL` | `lib/feature-flags.js:325` | `false` | `featureFlags.isEnabled`, server/lib consumidores | médio | central manager/env/file/tenant override; risco low |
| `FEATURE_ASSISTANT_DIAGNOSTIC` | `lib/feature-flags.js:332` | `true` | `featureFlags.isEnabled`, server/lib consumidores | baixo/suporte | central manager/env/file/tenant override; risco low |
| `FEATURE_DEEP_CONTEXT_EXPLORER` | `lib/feature-flags.js:343` | `true` | `featureFlags.isEnabled`, server/lib consumidores | baixo/suporte | central manager/env/file/tenant override; risco low |
| `FEATURE_V15_CONTEXT_ENFORCEMENT` | `lib/feature-flags.js:354` | `false` | `featureFlags.isEnabled`, server/lib consumidores | médio | central manager/env/file/tenant override; risco low |
| `FEATURE_V15_KNOWLEDGE_ENFORCER` | `lib/feature-flags.js:365` | `false` | `featureFlags.isEnabled`, server/lib consumidores | médio | central manager/env/file/tenant override; risco low |
| `FEATURE_V17_BRAIN` | `lib/feature-flags.js:378` | `false` | `featureFlags.isEnabled`, server/lib consumidores | médio | central manager/env/file/tenant override; risco high |
| `FEATURE_V18_EXTRACTION_GUARD` | `lib/feature-flags.js:386` | `true` | `featureFlags.isEnabled`, server/lib consumidores | médio | central manager/env/file/tenant override; risco low |
| `FEATURE_V18_FALLBACK` | `lib/feature-flags.js:392` | `false` | `featureFlags.isEnabled`, server/lib consumidores | médio | central manager/env/file/tenant override; risco medium |
| `FEATURE_WA_CTA_PROMOTER` | `lib/feature-flags.js:403` | `true` | `featureFlags.isEnabled`, server/lib consumidores | alto | central manager/env/file/tenant override; risco low |
| `FEATURE_DETERMINISTIC_V19` | `lib/feature-flags.js:418` | `false` | `featureFlags.isEnabled`, server/lib consumidores | médio | central manager/env/file/tenant override; risco medium |
| `FEATURE_CHANNEL_RESOLVER_SAFE` | `lib/feature-flags.js:432` | `true` | `featureFlags.isEnabled`, server/lib consumidores | baixo/suporte | central manager/env/file/tenant override; risco low |
| `FEATURE_CHAT_FIRST` | `lib/feature-flags.js:445` | `true` | `featureFlags.isEnabled`, server/lib consumidores | alto | central manager/env/file/tenant override; risco low |
| `WA_USE_FULL_PIPELINE` | `whatsapp-channel.js:49` | `true` | consumidores diretos por `process.env` | variável conforme domínio | Kill switch do pipeline completo WhatsApp; false retorna ao pipeline anterior. |
| `FEATURE_PUPPETEER` | `server.js:627,5910; lib/puppeteer-extractor.js:427` | `false` | consumidores diretos por `process.env` | variável conforme domínio | Fallback de extração JS-heavy; só roda quando true. |
| `ENABLE_V11_DISCOVERY` | `server.js:6463` | `false` | consumidores diretos por `process.env` | variável conforme domínio | Ativa discovery Puppeteer da V11. |
| `SALES_LAYER_MODE` | `server.js:6212,6488,6641,7274,7961,8385` | `auto` | consumidores diretos por `process.env` | variável conforme domínio | Modo comercial global quando pageData não define salesMode. |
| `DEBUG_SALES` | `server.js:7981,8000; sales/decision-engine.js` | `false` | consumidores diretos por `process.env` | variável conforme domínio | Logs de decisão comercial. |
| `FEATURE_WIDGET_TOKEN` | `server.js:3781,12758` | `true` | consumidores diretos por `process.env` | variável conforme domínio | Gate de token de widget; false desativa validação/registro. |
| `FEATURE_TRIAL` | `stripe-routes.js:62,210` | `true` | consumidores diretos por `process.env` | variável conforme domínio | Gate comercial de trial Stripe; false bloqueia trial. |
| `FEATURE_AFFILIATES` | `affiliate-program.js:26; server.js:12811` | `true` | consumidores diretos por `process.env` | variável conforme domínio | Gate do programa de afiliados. |
| `FEATURE_SELF_SERVICE_SIGNUP` | `server.js:12736` | `true` | consumidores diretos por `process.env` | variável conforme domínio | Gate de signup self-service. |
| `FEATURE_EMAIL_LOGIN` | `server.js:12747` | `true` | consumidores diretos por `process.env` | variável conforme domínio | Gate de login por email. |
| `FEATURE_ONBOARDING_EMAILS` | `email-queue-worker.js:16; server.js:12773` | `true` | consumidores diretos por `process.env` | variável conforme domínio | Gate de emails de onboarding. |
| `FEATURE_TEMPLATES` | `server.js:12800` | `true` | consumidores diretos por `process.env` | variável conforme domínio | Gate de templates. |
| `FEATURE_WEEKLY_REPORT` | `weekly-report.js:14; server.js:12825` | `true` | consumidores diretos por `process.env` | variável conforme domínio | Gate de relatório semanal. |
| `USE_POSTGRES` | `database.js:16; whitelabel.js; lib/leads/lead-capture.js:15` | `auto DATABASE_URL ou true` | consumidores diretos por `process.env` | variável conforme domínio | Seleciona PostgreSQL vs SQLite/compatibilidade. |
| `USE_REDIS` | `cache.js:12` | `auto REDIS_URL ou true` | consumidores diretos por `process.env` | variável conforme domínio | Seleciona Redis vs cache em memória. |
| `RATE_LIMIT_DISABLED` | `lib/rate-limiter-advanced.js:42` | `false` | consumidores diretos por `process.env` | variável conforme domínio | Kill switch global do rate limit avançado. |
| `CRAWL4AI_MODE` | `firecrawl-replacement.js:27` | `python` | consumidores diretos por `process.env` | variável conforme domínio | Seleciona modo docker/python/api para Crawl4AI. |
| `CRAWL4AI_DOCKER_URL` | `crawl4ai-adapter.js:20` | `http://localhost:11235` | consumidores diretos por `process.env` | variável conforme domínio | Endpoint do adapter Crawl4AI Docker. |
| `GROQ_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY` | `server.js:6000-6060` | `ausente` | consumidores diretos por `process.env` | variável conforme domínio | Gates por disponibilidade de provedor LLM. |
| `CHATGPT_API_KEY` | `chatgpt-integration.js:327` | `ausente` | consumidores diretos por `process.env` | variável conforme domínio | Gate global de integração ChatGPT. |
| `WHATSAPP_PROVIDER` | `whatsapp-integration.js:487; whatsapp-routes.js:83` | `ausente` | consumidores diretos por `process.env` | variável conforme domínio | Seleciona Twilio/Evolution e indica fallback global. |

## SEÇÃO 4 — FLAGS DE IA
OpenAI/Groq/OpenRouter são gates por API key/model/base no servidor; `FEATURE_MODULAR_AI`, `FEATURE_CACHE_V2`, `FEATURE_CIRCUIT_BREAKER`, `FEATURE_UNIVERSAL_PROMPT`, `FEATURE_CLEAN_CHAT_V2`, `FEATURE_V10_BEHAVIOR_LAYER`, `FEATURE_V14_CONTEXT_LAYER`, `FEATURE_V15_KNOWLEDGE_ENFORCER`, `FEATURE_DEEP_CONTEXT_EXPLORER`, `LLM_CACHE_TTL_MS` e `LLM_TIMEOUT_MS` alteram provedor, prompt, cache, timeout, conhecimento e resposta conversacional.


## SEÇÃO 5 — FLAGS DE EXTRAÇÃO
`FEATURE_V18_EXTRACTION_GUARD`, `FEATURE_V18_FALLBACK`, `FEATURE_PUPPETEER`, `FEATURE_DEEP_CONTEXT_EXPLORER`, `ENABLE_V11_DISCOVERY`, `FEATURE_V11_2_RAG`, `CRAWL4AI_MODE`, `CRAWL4AI_DOCKER_URL`, `EXTRACTION_TIMEOUT_MS` e `PUPPETEER_TIMEOUT_MS` controlam extractPageData, Crawl4AI, scraping, cache/fallback e confiança de links.


## SEÇÃO 6 — FLAGS DE WHATSAPP
`WA_USE_FULL_PIPELINE` é kill switch do canal; `WHATSAPP_PROVIDER` seleciona Twilio/Evolution; `FEATURE_WA_CTA_PROMOTER` promove WhatsApp como CTA quando não há checkout; `FEATURE_CHANNEL_RESOLVER_SAFE` evita dead-end de suporte/humano; `FEATURE_CHAT_FIRST` governa captura inline no chat.


## SEÇÃO 7 — FLAGS DE LINK CURTO
Link curto depende da resolução central de checkout/CTA: `FEATURE_CHECKOUT_AUTHORITY`, `FEATURE_AUTO_CHECKOUT_DETECTION`, `FEATURE_SMART_CHECKOUT_SELECTOR`, `FEATURE_V12_FORCE_CHECKOUT`, `FEATURE_V13_MULTI_CHECKOUT`, `FEATURE_DETERMINISTIC_V19` e `SALES_LAYER_MODE`.


## SEÇÃO 8 — FLAGS DE WIDGET
Widget é afetado por `FEATURE_WIDGET_TOKEN`, `FEATURE_CHAT_FIRST`, `FEATURE_AUTO_CHECKOUT_DETECTION`, `FEATURE_CLEAN_CHAT_V2`, `FEATURE_CONVERSATION_CONTEXT`, `FEATURE_ASSISTANT_DIAGNOSTIC` e flags de analytics/learning.


## SEÇÃO 9 — FLAGS DE CTA
CTA Engine usa `FEATURE_SMART_CTA`; resolver/authority usam `FEATURE_CHECKOUT_AUTHORITY`, `FEATURE_SMART_CHECKOUT_SELECTOR`, `FEATURE_AUTO_CHECKOUT_DETECTION`, `FEATURE_V13_MULTI_CHECKOUT`, `FEATURE_WA_CTA_PROMOTER`, `FEATURE_DETERMINISTIC_V19`.


## SEÇÃO 10 — FLAGS DE LEAD CAPTURE
`FEATURE_CHAT_FIRST` ativa captura inline orientada por score; `FEATURE_CONVERSATION_CONTEXT`, `FEATURE_DECISION_CORE`, `FEATURE_DECISION_ENGINE(_V2)` e `USE_POSTGRES` impactam score, bloqueios e persistência.


## SEÇÃO 11 — FLAGS DE SCHEDULER
Regras de agenda/reunião aparecem como comportamento condicional de intenção e links/canais; flags reais associadas são `FEATURE_CHANNEL_RESOLVER_SAFE`, `FEATURE_DECISION_CORE`, `FEATURE_DETERMINISTIC_V19`, `FEATURE_V12_STATE_PROMPT` e `FEATURE_CHAT_FIRST`.


## SEÇÃO 12 — FLAGS DE JOURNEY STAGE
Estágios descoberta/consideração/negociação/agendamento/compra são governados por state/decision: `FEATURE_V12_STATE_PROMPT`, `FEATURE_V13_BLINDADO`, `FEATURE_V16_2_BLINDADO_FINAL`, `FEATURE_DETERMINISTIC_V19`, `FEATURE_DECISION_ENGINE_V2`.


## SEÇÃO 13 — FLAGS DE INTENT DETECTION
Compra/suporte/sair/especialista/humano dependem de `FEATURE_DECISION_CORE`, `FEATURE_DECISION_ENGINE`, `FEATURE_DECISION_ENGINE_V2`, `FEATURE_V13_BLINDADO`, `FEATURE_CHANNEL_RESOLVER_SAFE`, `FEATURE_DETERMINISTIC_V19`.


## SEÇÃO 14 — FLAGS DE OBSERVER LAYER
Observação/analytics/monitoramento: `FEATURE_AUTO_LEARNING`, `AUTO_LEARNING_TEST_MODE`, `DEBUG_LEARNING`, `FEATURE_AUDIT_LOGGING`, `FEATURE_STRUCTURED_LOGS`, `FEATURE_HEALTH_V2`, `DEBUG_SALES`.


## SEÇÃO 15 — FLAGS DE DECISION CORE
Priorização/bloqueios/fallback/resolução final: `FEATURE_DECISION_CORE`, `FEATURE_ORCHESTRATOR_V10`, `FEATURE_CHECKOUT_AUTHORITY`, `FEATURE_V12_FORCE_CHECKOUT`, `FEATURE_V16_2_BLINDADO_FINAL`, `FEATURE_DETERMINISTIC_V19`.


## SEÇÃO 16 — FLAGS DE CONVERSATION STATE
Memória/sessão/contexto/persistência: `FEATURE_PERSISTENT_MEMORY`, `FEATURE_CONVERSATION_CONTEXT`, `FEATURE_V12_STATE_PROMPT`, `FEATURE_V14_CONTEXT_LAYER`, `FEATURE_CONTEXT_LOCK`, `USE_POSTGRES`, `REDIS_URL`/`USE_REDIS`.


## SEÇÃO 17 — DEPENDÊNCIAS OCULTAS
Flags multi-módulo: `FEATURE_DETERMINISTIC_V19` pode bypassar V18.1–V18.4/PP-GLOBAL; `FEATURE_V17_BRAIN` bypassa V13/V15/V16/PP-GLOBAL/Sales Layer; `FEATURE_V13_MULTI_CHECKOUT` requer V13; `FEATURE_V18_FALLBACK` requer V18 Guard; `FEATURE_CHAT_FIRST` depende de score/intenção; `DATABASE_URL` ativa USE_POSTGRES mesmo sem `USE_POSTGRES=true`.


## SEÇÃO 18 — FLAGS MORTAS
Definições centrais sem consumidor direto evidente na busca estática incluem partes V9/V10 como `FEATURE_HEALTH_V2`, `FEATURE_RATE_LIMIT_V2`, `FEATURE_STRUCTURED_LOGS` quando não aparecem como `isEnabled` fora do mapa; são documentadas como órfãs potenciais, não como removíveis. `V20*` não foi encontrado como flag definida/consumida.


## SEÇÃO 19 — FLAGS CRÍTICAS
CRÍTICO ABSOLUTO: `FEATURE_DETERMINISTIC_V19`, `FEATURE_V17_BRAIN`, `WA_USE_FULL_PIPELINE`, `USE_POSTGRES`, `FEATURE_CHECKOUT_AUTHORITY`. CRÍTICO: `FEATURE_V18_FALLBACK`, `FEATURE_V13_BLINDADO`, `FEATURE_V16_2_BLINDADO_FINAL`, `FEATURE_CHAT_FIRST`, `FEATURE_WIDGET_TOKEN`. IMPORTANTE: CTA, Decision, V12, channel resolver, provider keys. SUPORTE: debug/log/health/email/report.


## SEÇÃO 20 — COMBINAÇÕES DE RISCO
Casos reais: `FEATURE_V18_FALLBACK=true` com `FEATURE_V18_EXTRACTION_GUARD=false` perde pré-condição declarada; `FEATURE_V13_MULTI_CHECKOUT=true` com `FEATURE_V13_BLINDADO=false` não tem base V13; `FEATURE_DETERMINISTIC_V19=true` com V13/V15/V16 ligados cria bypass esperado; `FEATURE_V17_BRAIN=true` bypassa múltiplas camadas; `FEATURE_PUPPETEER=true` sob memória crítica é bloqueado pelo guard; `WA_USE_FULL_PIPELINE=false` remove paridade com Link Curto.


## SEÇÃO 21 — HISTÓRICO DE REGRESSÕES
Evidências no código mencionam V17 Link Resolver, V18 guard/fallback, V19 shadow/true e V21 WhatsApp parity. Não há flag V20/V21 central; V21 aparece como comentários e `WA_USE_FULL_PIPELINE`. Regressões são tratadas por modos shadow, fallback, try/catch e kill switches.


## SEÇÃO 22 — MATRIZ DE PROPRIEDADE
Cria: `lib/feature-flags.js` e módulos com `process.env`. Consome: `server.js`, `lib/*`, `sales/*`, `whatsapp-*`, `stripe-*`, workers. Modifica: env, arquivo `data/feature_flags.json`, `enable/disable`, `setTenantOverride`. Persiste: arquivo JSON e overrides de tenant em memória/config. Depende: IA, vendas, checkout, widget, WhatsApp, analytics, DB/cache.


## SEÇÃO 23 — ÁRVORE DE CONTROLE GLOBAL
Feature Flag → módulo → decisão → resultado: `FEATURE_DETERMINISTIC_V19` → v19 engine → autoridade final → resposta/CTA; `FEATURE_V18_*` → extraction guard → confiança/fallback → pageData enriquecido; `FEATURE_CHAT_FIRST` → lead score → captura inline → lead; `WA_USE_FULL_PIPELINE` → whatsapp-channel → pipeline central ou legado → paridade/rollback; `FEATURE_CHECKOUT_AUTHORITY` → resolver → checkout obrigatório → venda.


## SEÇÃO 24 — MAPA DE GOVERNANÇA
Auditoria obrigatória antes de alterar: V17 Brain, V19 Deterministic, Checkout Authority, V12 Force/Safe Checkout, V13/V16, WA pipeline, USE_POSTGRES, Widget Token, Trial/Affiliates, encryption/rate-limit/audit. Nunca alterar sem relatório de impacto: flags de checkout/vendas, WhatsApp, captura, persistência, segurança e provider LLM.


## SEÇÃO 25 — CONCLUSÃO EXECUTIVA
O sistema funciona por mapa central + env gates diretos. Existem 49 flags centrais e 21 gates adicionais relevantes nesta documentação. Controlam vendas: checkout/CTA/decision/sales/chat-first/trial/affiliates. Controlam IA: provider keys/model/base, modular AI, clean prompt, universal prompt, learning, cache, circuit breaker, V10/V14/V15/V17. Controlam WhatsApp: provider, full pipeline, WA CTA, channel resolver. Controlam Scheduler/Lead Capture: decision/state/chat-first/channel resolver. Maior risco arquitetural: V17, V19, checkout authority/force, WA pipeline, USE_POSTGRES e V18 fallback.

