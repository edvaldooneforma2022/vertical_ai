# Matriz de Propriedade — Link Mágico

> Documento de auditoria técnica baseado em evidências do código. Não propõe correções; mapeia proprietários funcionais, entradas, saídas, dependências e risco de alteração.

## Escopo e leitura rápida

- **Responsável** significa o arquivo/módulo que efetivamente controla a regra, decisão, persistência ou transformação observada no código.
- **Owner comercial** é o ponto que decide venda, CTA, checkout, agendamento, lead, handoff ou contexto.
- **Arquivos críticos** listados aqui devem passar por auditoria antes de alteração, pois concentram múltiplos comportamentos.

## Matriz principal

| Componente | Responsável | Arquivos | Entradas | Saídas | Dependências | Impacto de Alteração |
| ---------- | ----------- | -------- | -------- | ------ | ------------ | -------------------- |
| Link Curto / Assistentes | `ShortUrlGenerator`, rotas de assistentes e tabela `short_urls` | `short-url-generator.js`, `server.js`, `routes.js`, `database.js`, `public/index_app.html` | URL de venda, API key, nome do robô, instruções, status do assistente | Código curto, `/s/:shortCode`, dados do assistente, widget gerado | `DatabaseHelpers.getShortUrlsByApiKey`, autenticação/API key, painel “Meus Assistentes”, feature `FEATURE_MEUS_ASSISTENTES` | Alto: muda descoberta de assistentes, links públicos, geração de widget, checkout injetado do DB e listagem por tenant. |
| Widget inline / embed | Frontend gerado no `server.js` e variantes em `widget.js`/`public/widget.js` | `server.js`, `widget.js`, `public/widget.js`, `public/index_app.html`, `public/widget-inline-generator.js` | API key, URL, `pageData`, mensagem, `conversationId`, `leadId`, cor, saudação, `salesMode`, `salesPreset` | UI de chat, chamadas `/api/process-chat-inteligente`, `/api/chat-universal`, `/api/capture-lead`, eventos de conversão | Endpoints de chat, captura de lead, scheduler, feature `FEATURE_WIDGET_TOKEN`, auto-checkout, billing | Alto: regressões afetam entrada principal do SaaS, captura de leads, estado conversacional, checkout e telemetria. |
| WhatsApp — contato/CTA/canal | Extração de contatos, WA CTA promoter, settings multi-tenant e UI do painel | `server.js`, `database.js`, `whatsapp-integration.js`, `lib/wa-cta-promoter.js`, `lib/channel-resolver-safe.js`, `enhanced-content-extractor.js`, `public/index_app.html` | Links `wa.me`, `api.whatsapp.com`, configurações `whatsapp_settings`, mensagem, tenant/API key, dados extraídos | `whatsappLink`, `contatos.whatsapp`, `contatos.whatsappLinks`, promoção de WA como checkout/CTA, status de canal | Extração HTML/Puppeteer, V18 guard, CTA Engine, Decision Engine, rotas `/api/whatsapp/*`, feature `FEATURE_WA_CTA_PROMOTER` e `FEATURE_CHANNEL_RESOLVER_SAFE` | Alto: influencia CTA, handoff humano, fallback quando não há checkout, CRM/lead e painel de canal. |
| Journey Stage | `journeyAnalyzer` e `LeadSystem.updateLeadJourneyStage` | `server.js`, `modules/leads/journey-analyzer.js`, `lib/ai-systems/journey-analyzer.js`, `sales/sales-layer.js`, `sales/decision-engine.js` | Mensagem limpa, histórico, leadId, estágio atual | Estágio `descoberta`, `negociacao`, `objecao`, `fidelizacao`/similares, pressão de venda, cópia por estágio | LeadSystem, Sales Layer, Decision Engine, prompt universal, histórico | Médio/alto: altera pressão comercial, CTA, scripts de fechamento e leitura do funil. |
| Intent Detection | Decision Engine V1/V2, Decision Core, V17/V19 e heurísticas locais | `sales/decision-engine.js`, `lib/decision-core.js`, `lib/v17-orchestrator.js`, `lib/v19-deterministic-engine.js`, `server.js` | Mensagem do usuário, histórico, stage, contexto da página, confidence de dados | `intent`, `confidence`, `action`, `strategy`, `allowCTA`, `allowCheckout`, `nextStep` | Feature flags `FEATURE_DECISION_ENGINE`, `FEATURE_DECISION_ENGINE_V2`, `FEATURE_DECISION_CORE`, `FEATURE_V17_BRAIN`, `FEATURE_DETERMINISTIC_V19` | Muito alto: é dono de decisões comerciais e pode bloquear/forçar CTA, checkout, suporte e saída. |
| Lead Capture | `LeadSystem` e endpoint `/api/capture-lead` | `server.js`, `lib/leads/lead-capture.js`, `modules/leads/index.js`, `database.js`, `public/index_app.html` | Nome, email, telefone, URL origem, robô, `conversationId`, API key | Lead persistido, `leadId`, CRM sync, contador `analytics.leadsCaptured`, histórico vinculado | API key, CRM Manager, `conversationId`, `/api/link-conversation`, storage JSON/PostgreSQL | Alto: muda conversão, CRM, vínculo chat-first, agendamento e jornada. |
| CTA Engine | `sales/cta-engine.js` | `sales/cta-engine.js`, `server.js`, `sales/sales-layer.js`, `lib/orchestrator.js` | Intent/action, contexto da página, WhatsApp, checkout, `conversationId` | CTA textual, URL de CTA, tipo `soft`/`hard`, aplicação na resposta | Decision Core/Engine, Orchestrator V10, feature `FEATURE_SMART_CTA`, anti-repetição em memória | Alto: dono direto de CTAs quando V10 não centraliza; alteração afeta conversão e duplicidade de CTA. |
| Scheduler / Agendamento | Métodos de agendamento em `LeadSystem`, endpoints e `scheduling-manager.js` | `server.js`, `scheduling-manager.js`, `database.js`, `public/index_app.html` | Data, hora, leadId, contato, notas, API key, disponibilidade | `appointment`, status `pendente/confirmado/cancelado/realizado`, listagem admin, eventos `schedule_created` | `tenant_appointments`, LeadSystem, widget calendário, analytics/auto-learning | Alto: impacta agendamento, CRM operacional, jornada e conversão pós-lead. |
| KB First / Knowledge Base | `knowledgeBaseManager`, `knowledge-builder`, enforcers V15/V11.2 | `knowledge-base.js`, `lib/knowledge-builder.js`, `lib/v15-knowledge-enforcer.js`, `server.js`, `public/index_app.html` | Pergunta, chatbotId/API key, FAQs, páginas extraídas, `cleanText` | Contexto KB, resposta priorizando FAQ, RAG/knowledge block, validação contra conhecimento | `FEATURE_CLEAN_CHAT_V2`, `FEATURE_V15_KNOWLEDGE_ENFORCER`, `FEATURE_V11_ENGINE`, painel Knowledge | Alto: altera fonte de verdade das respostas e pode reduzir/inibir alucinação ou sobrepor conteúdo de página. |
| Observer Layer | Camadas de logging/observação sem interceptar resposta | `server.js`, `lib/v14-conversation-logger.js`, `lib/v14-context-layer.js`, `lib/v14-outcome-detector.js`, `lib/v14-pattern-analyzer.js` | Mensagem, resposta, `conversationId`, leadId, outcome, flags legadas | Histórico, logs, telemetria V20, padrões de auto-otimização | `FEATURE_V14_CONTEXT_LAYER`, `FEATURE_V14_SELF_OPTIMIZING`, auto-learning, V20 observer | Médio: esperado ser aditivo; se virar interceptador, pode alterar fluxo comercial silenciosamente. |
| V17 Brain | `lib/v17-orchestrator.js` | `lib/v17-orchestrator.js`, `lib/v17-link-resolver.js`, `server.js` | Mensagem, contexto, links, histórico | Prompt/estratégia final, intent normalizada, links sanitizados, resposta LLM pós-sanitização | `FEATURE_V17_BRAIN`, LLM, V14.3, link resolver, sanitizer | Muito alto: declara-se ponto único de decisão quando ativo e proíbe camadas posteriores de alterar resposta. |
| V18 Extraction Guard | `lib/v18-extraction-guard.js` | `lib/v18-extraction-guard.js`, `server.js` | `pageData`, URL, contexto tenant/conversa, links descobertos | `_extractionGuard`, status `ok/partial/failed`, confidence, fallback opcional | `FEATURE_V18_EXTRACTION_GUARD`, `FEATURE_V18_FALLBACK`, extractor, checkout/WhatsApp discovery | Alto: influencia confiança de checkout/WhatsApp e diferencia ausência real de falha de extração. |
| V19 Deterministic Engine | `lib/v19-deterministic-engine.js` | `lib/v19-deterministic-engine.js`, `server.js` | Mensagem, intent V17 opcional, `conversationId`, dados extraídos | Intent final, estado determinístico, `allowSell`, `allowCTA`, `allowCheckout` | `FEATURE_DETERMINISTIC_V19` false/shadow/true, V17 fallback, estado in-memory | Muito alto: declara autoridade única de decisão comercial quando ativo. |
| V20 Observer | Blocos V20 no `server.js` | `server.js` | `inteligencias`, mensagem, ids, resposta final | Logs `V20-OBSERVER` e `AUDIT-LLM-BYPASS-V20` com “would bypass legacy” | Pipeline `process-chat-inteligente`, camada 5 legada, IA executada | Médio: atualmente observador; risco se reintroduzir bypass/interceptação de LLM. |
| `/api/process-chat-inteligente` | Endpoint principal superinteligente | `server.js`, módulos `lib/v*`, `sales/*`, `knowledge-base.js` | Mensagem, URL/pageData, API key, `conversationId`, leadId, instruções, sales mode/preset | Resposta final, atualização de lead/histórico, eventos, CTA, checkout, handoff | Billing/auth, extraction, KB, V13–V20, Orchestrator, CTA Engine, V11/V12/V15, OpenAI/Groq/OpenRouter | Muito alto: maior pipeline de comportamento; alterações têm alto potencial de regressão em IA, venda e lead. |
| `/api/chat-universal` | Endpoint legado/universal com captura e camadas de conversão | `server.js` | Mensagem, URL/pageData, API key, `conversationId`, leadId, instruções, robô | Resposta IA, histórico V14, lead conversation, CTA/closing/orchestrator | `generateAIResponse`, extraction, V18, WA CTA, CTA Engine, Orchestrator V10, V11/V12/V15 | Muito alto: usado pelo widget/integrações e compartilha muitas camadas com process-chat. |
| `extractPageData` | Função monolítica de extração | `server.js`, `enhanced-content-extractor.js`, `lib/puppeteer-extractor.js`, `lib/deep-context-explorer.js`, `lib/extraction/*` | URL, cache, HTML, DOM renderizado, OCR, iframes, links | `title`, `description`, `cleanText`, `summary`, preço, bônus, FAQ, contatos, checkout, WhatsApp | Axios/Cheerio, Puppeteer, enhanced extractor, cache, V14.3, V18, conversion scan | Muito alto: base de contexto, CTA e respostas; falha impacta tudo que depende de conteúdo. |
| `cleanText` / limpeza textual | `extractCleanTextFromHTML`, `uniqueLines`, pós-processamento de `extractPageData` | `server.js`, `enhanced-content-extractor.js`, `sales/context-lock.js`, `sales/auto-instructions.js` | HTML/texto extraído, conteúdo dinâmico/OCR | Texto limpo deduplicado, resumo, primeira linha como título fallback | Cheerio/Puppeteer, enhanced extractor, context lock, prompt universal | Alto: controla o que a IA “sabe”; ruído ou perda de texto muda resposta, intent e contexto. |
| Chunking / limitação de contexto | Cortes por substring, limites de histórico e Knowledge Builder | `server.js`, `lib/knowledge-builder.js`, `knowledge-base.js`, `sales/auto-instructions.js` | `cleanText`, páginas extraídas, histórico, FAQs | Trechos limitados para prompt/KB/RAG, últimas mensagens | LLM token budget, V14 context layer, KB search, auto-instructions | Médio/alto: altera recall da IA, perda de informações e custo/latência. |
| Context merge | Merge seguro entre `pageData` do widget, extração, DB checkout, WA CTA, V18 | `server.js`, `lib/v18-extraction-guard.js`, `lib/deep-context-explorer.js`, `enhanced-content-extractor.js` | `pageData`, URL, resultado extraído, checkout do DB, WhatsApp descoberto | `processedPageData` consolidado com checkout/WA/contexto | Widget, extractor, DB, V18, WA CTA, auto-checkout, channel resolver | Muito alto: ordem de merge define fonte de verdade de checkout/WhatsApp/contexto. |
| Conversation State | Mapas em memória, V14 context layer, V11/V19 state | `server.js`, `lib/conversation-state.js`, `lib/v14-context-layer.js`, `lib/v19-deterministic-engine.js` | `conversationId`, leadId, mensagens, intents anteriores | Histórico, estado por sessão/lead, stage/intent, memória contextual | `buildIdentityKey`, LeadSystem, chat-first, V14, V19, active chats | Alto: muda continuidade, personalização, isBuyer, vínculo anônimo→lead. |
| Orchestrator | `lib/orchestrator.js` V10 e V17 quando ativo | `lib/orchestrator.js`, `lib/v17-orchestrator.js`, `server.js` | Resposta base, contexto, decision, CTA data, closing data, mode | Resposta final orquestrada, razão (`buy`, `interest`, `post_sale`, etc.) | Feature `FEATURE_ORCHESTRATOR_V10`, Decision Core, CTA Engine, Closing Scripts | Muito alto: centraliza ou bloqueia alterações finais de venda/CTA/checkout. |
| Decision Engine | `sales/decision-engine.js` e `lib/decision-core.js` | `sales/decision-engine.js`, `lib/decision-core.js`, `server.js` | Mensagem, histórico, stage, contexto, messageCount | Intent, action, urgency, nextStep, strategy, pressure | Journey Stage, Sales Layer, CTA Engine, Orchestrator, feature flags | Muito alto: dono de decisão comercial nos fluxos automáticos sem V17/V19 total. |
| Feature Flags | `featureFlags` e variáveis `FEATURE_*` | `lib/feature-flags.js`, `server.js`, `routes.js`, `sales/*`, `lib/*` | Env vars, config runtime, defaults, DB/config local | Ativação/desativação de módulos, rollout shadow/true/off | Praticamente todos os pipelines | Alto: muda comportamento sem alterar código; flags críticas exigem auditoria e registro de rollout. |
| Handoff humano | Intercepts de suporte/humano e WhatsApp disponível | `server.js`, `lib/v17-orchestrator.js`, `lib/v19-deterministic-engine.js`, `lib/orchestrator.js`, `sales/decision-engine.js` | Mensagem pedindo atendente/humano/suporte, WhatsApp/contatos | Resposta de transferência ou direcionamento para WhatsApp/suporte; intent `support`/`human` | WhatsApp extraction, Decision Engine, Orchestrator, V17/V19, `FEATURE_SMART_ESCALATION` | Alto: altera experiência de suporte e pode confundir pergunta “você é humano?” com transferência real. |

## Donos das decisões solicitadas

1. **Dono de cada decisão comercial**: em modo legado/auto, `sales/decision-engine.js`, `lib/decision-core.js`, `sales/sales-layer.js` e `lib/orchestrator.js`; com `FEATURE_V17_BRAIN`, `lib/v17-orchestrator.js`; com `FEATURE_DETERMINISTIC_V19=true`, `lib/v19-deterministic-engine.js` assume autoridade declarada.
2. **Dono de cada CTA**: `sales/cta-engine.js` seleciona/aplica CTA; `lib/orchestrator.js` decide se aplica ou bloqueia quando V10 está ativo; `sales/sales-layer.js` injeta CTAs comerciais; `lib/wa-cta-promoter.js` promove WhatsApp como CTA quando falta checkout.
3. **Dono do agendamento**: `LeadSystem` em `server.js` e persistência em `database.js`/`scheduling-manager.js`; UI/calendário do widget em `server.js`/`public/index_app.html`.
4. **Dono da captura de leads**: endpoint `/api/capture-lead` e `LeadSystem` em `server.js`; módulos `lib/leads/lead-capture.js` e `modules/leads/*` complementam captura/score; CRM sync é dependente, não proprietário primário.
5. **Dono do handoff humano**: detecções de suporte/humano no `server.js`, `sales/decision-engine.js`, `lib/v17-orchestrator.js` e `lib/v19-deterministic-engine.js`; WhatsApp é o canal preferencial quando extraído.
6. **Dono da extração de conteúdo**: `extractPageData` em `server.js`; `enhanced-content-extractor.js`, `lib/puppeteer-extractor.js`, `lib/deep-context-explorer.js` e `lib/extraction/*` enriquecem/validam.
7. **Dono da montagem do contexto enviado para IA**: `generateAIResponse` em `server.js`, com contribuições de `knowledge-base.js`, `lib/knowledge-builder.js`, `lib/v14-context-layer.js`, `sales/context-lock.js`, `sales/auto-instructions.js`, V11/V15/V18 e merge de `processedPageData` nos endpoints.

# Dependências Cruzadas

- Link Curto → influencia → Widget, Assistentes, Checkout DB, Página pública `/s/:shortCode`.
- Widget → influencia → Lead Capture, Conversation State, Auto Checkout Detection, process-chat-inteligente/chat-universal.
- WhatsApp → influencia → Lead Capture, CTA Engine, Handoff Humano, Scheduler, WA CTA Promoter.
- Scheduler → influencia → Journey Stage, Conversão, CRM/agenda operacional, Auto-learning.
- CTA Engine → influencia → Conversão, Orchestrator, Sales Layer, resposta final.
- Lead Capture → influencia → Scheduler, Journey Stage, CRM, Conversation State, Histórico de mensagens.
- Journey Stage → influencia → Sales Layer, Decision Engine, CTA, pressão comercial.
- Intent Detection → influencia → CTA Engine, Orchestrator, Handoff Humano, Checkout, KB/prompt.
- KB First → influencia → generateAIResponse, Clean Chat V2, Context Merge, resposta final.
- extractPageData → influencia → cleanText, Context Merge, V18 Guard, CTA/Checkout/WhatsApp, prompt da IA.
- cleanText → influencia → Auto Instructions, Context Lock, Knowledge Builder, Prompt Universal.
- Chunking → influencia → Contexto enviado à IA, custo/latência, perda de informação.
- Context Merge → influencia → Decision Engine, CTA Engine, Orchestrator, V18/V19 confidence.
- Conversation State → influencia → V19 isBuyer/stage, V14 histórico, resposta contextual, lead retroativo.
- Orchestrator → influencia → resposta final, CTA, checkout, post-sale, bloqueio de oversell.
- V17 → influencia → intent, estratégia, link sanitizado, prompt da IA.
- V18 → influencia → confiança do pageData, fallback de links, diagnóstico de falha de extração.
- V19 → influencia → autoridade final de venda, CTA, checkout e reset de estado.
- V20 Observer → influencia → auditoria futura; não deve influenciar resposta enquanto observador.
- Feature Flags → influencia → todos os módulos versionados e camadas comerciais.

# Componentes de Alto Risco

## `server.js`

- **Ponto único de falha**: contém bootstrap de módulos, feature flags, endpoints críticos, extração, prompt, lead system, scheduler, chat universal, process-chat-inteligente, widget público e pós-processamentos V9–V20.
- **Risco principal**: ordem de execução. Pequena mudança na sequência de merge/guard/CTA/orchestrator pode trocar a fonte de verdade de checkout, WhatsApp ou intent.
- **Áreas sensíveis**:
  - `extractPageData` e seus fallbacks.
  - `generateAIResponse` e montagem de prompt/contexto.
  - `/api/process-chat-inteligente` e `/api/chat-universal`.
  - Blocos de feature flag V13–V20.
  - Captura de lead, vínculo de conversa e agendamento.

## Módulos críticos

- `lib/v19-deterministic-engine.js`: autoridade determinística de decisão comercial quando flag ativa.
- `lib/v17-orchestrator.js`: declara controle único do cérebro quando flag ativa.
- `lib/orchestrator.js`: decisão final V10 entre CTA, checkout, pós-venda e bloqueio de oversell.
- `sales/decision-engine.js`: intent/action/strategy/stage matrix para venda.
- `sales/cta-engine.js`: banco e seleção de CTAs.
- `sales/sales-layer.js`: pós-processamento persuasivo e fechamento.
- `lib/v18-extraction-guard.js`: confiança/diagnóstico de extração.
- `knowledge-base.js` e `lib/knowledge-builder.js`: fonte de conhecimento/FAQ/RAG.
- `database.js`: schema e persistência de leads, agendamentos, WhatsApp, short URLs.
- `enhanced-content-extractor.js` e `lib/puppeteer-extractor.js`: conteúdo dinâmico, WhatsApp e checkout renderizados.

## Pontos únicos de falha

- `processedPageData`: objeto consolidado que alimenta IA, decisão, CTA, checkout e V18/V19.
- `conversationId`/`buildIdentityKey`: chave de continuidade entre visitante anônimo, lead e histórico.
- `featureFlags.isEnabled(...)`: pode mudar comportamento em produção sem alteração de código.
- `checkoutLink`: fonte de verdade disputada entre widget, DB, extractor, WA promoter e fallbacks.
- `cleanText`: base textual para prompt, KB, auto-instructions e context lock.
- `LeadSystem` por tenant: concentra lead, conversas, journey stage e appointments.

## Áreas com maior potencial de regressão

- Alterar ordem entre extração → merge → V18 guard → V19/V17/Decision Engine → CTA/Orchestrator.
- Alterar detecção de WhatsApp, pois afeta CTA, handoff humano e fallback de checkout.
- Alterar regras de intent, pois afeta compra, objeção, suporte, saída e pressão comercial.
- Alterar `FEATURE_*` defaults, pois liga/desliga pipelines inteiros.
- Alterar widget sem validar `/api/process-chat-inteligente`, `/api/chat-universal`, `/api/capture-lead`, scheduler e auto-checkout.
- Alterar `database.js` em tabelas `short_urls`, `tenant_appointments`, `whatsapp_settings` e leads sem migração/rollback.

## Arquivos que não devem ser alterados sem auditoria

- `server.js`
- `database.js`
- `short-url-generator.js`
- `widget.js`, `public/widget.js`, `public/index_app.html`, `public/widget-inline-generator.js`
- `knowledge-base.js`
- `enhanced-content-extractor.js`
- `scheduling-manager.js`
- `lib/feature-flags.js`
- `lib/orchestrator.js`
- `lib/v17-orchestrator.js`
- `lib/v18-extraction-guard.js`
- `lib/v19-deterministic-engine.js`
- `lib/channel-resolver-safe.js`
- `lib/wa-cta-promoter.js`
- `lib/conversation-state.js`
- `lib/v14-context-layer.js`
- `sales/decision-engine.js`
- `sales/cta-engine.js`
- `sales/sales-layer.js`
- `sales/context-lock.js`
