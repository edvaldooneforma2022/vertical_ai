Auditoria de mutações do pipeline final
Fluxo principal pós-generateAIResponse
A partir do momento em que a resposta da IA é atribuída a finalResponse, os módulos abaixo podem alterar o estado antes do return.

Mutações encontradas
cta-engine.js → applyCTA()

Arquivo: cta-engine.js
Função: applyCTA(response, ctaResult)
Variável: finalResponse
Condicional: sim
Flag: FEATURE_SMART_CTA
Posição: primeira camada pós-IA
Efeito: complementa, adiciona CTA sem sobrescrever totalmente
conversion-optimizer.js → optimizeByPerformance()

Arquivo: conversion-optimizer.js
Função: optimizeByPerformance(...)
Variável: finalResponse
Condicional: sim
Flag: FEATURE_CONVERSION_OPTIMIZER
Posição: após CTA Engine
Efeito: complementa/ajusta, substitui texto parcial
closing-scripts.js → applyClosingLayer()

Arquivo: closing-scripts.js
Função: applyClosingLayer(...)
Variável: finalResponse
Condicional: sim
Flag: FEATURE_CLOSING_SCRIPTS
Posição: após Conversion Optimizer
Efeito: complementa, adiciona fechamento natural
anti-dropoff.js → applyAntiDropoff()

Arquivo: anti-dropoff.js
Função: applyAntiDropoff(finalResponse, message, conversationId)
Variável: finalResponse
Condicional: sim
Flag: FEATURE_ANTI_DROPOFF
Posição: final da camada de conversão
Efeito: complementa/ajusta, mantém resposta mas pode alterar texto
orchestrator.js → orchestrator.apply()

Arquivo: orchestrator.js
Função: apply(...)
Variável: finalResponse
Condicional: sim
Flag: FEATURE_ORCHESTRATOR_V10
Posição: após camadas de CTA/closing/anti-dropoff
Efeito: sobrescreve totalmente finalResponse quando aplicado
server.js → V11 Action Resolver

Arquivo: server.js
Função: bloco V11 ACTION RESOLVER + STATE UPDATE
Variável: finalResponse
Condicional: sim
Flag: FEATURE_V11_ENGINE
Posição: após Orchestrator/V10
Efeito: complementa, anexa link de checkout se buy e link não estiver presente
decision-core.js → applyDecisionCoreSafe()

Arquivo: server.js / decision-core.js
Função: applyDecisionCoreSafe(...)
Variável: finalResponse
Condicional: sim
Flag: FEATURE_DECISION_CORE
Posição: antes do Orchestrator/V10 no fluxo process-chat-inteligente
Efeito: complementa ou sobrescreve por override de compra/post_sale
server.js → V10.1 Checkout Blocker

Arquivo: server.js
Função: bloco V10.1 CHECKOUT BLOCKER
Variável: finalResponse
Condicional: sim
Flag: FEATURE_ORCHESTRATOR_V10
Posição: após limpeza de texto e antes de V11/V12 no fluxo process-chat-inteligente
Efeito: sobrescreve parcialmente, remove checkout/CTA proibidos
server.js → V11.3 Sales Guard / Force Checkout

server.js → V11.3 Sales Guard / Force Checkout

Arquivo: server.js
Função: bloco V11.3-SALES / V11.3-SALES-GUARD
Variável: finalResponse
Condicional: sim
Flag: implícito em FEATURE_V11_ENGINE / buyIntent detectado
Posição: após V10.1 / antes V12
Efeito: complementa, adiciona checkout se necessário
server.js → V12 Safe Checkout

Arquivo: server.js
Função: bloco V12 SAFE CHECKOUT RESOLVER
Variável: finalResponse
Condicional: sim
Flag: FEATURE_V12_SAFE_CHECKOUT
Posição: antes de V12 Force
Efeito: sobrescreve parcialmente, remove ou substitui checkout inválido
force-checkout.js → applyForceCheckoutPipeline()

Arquivo: server.js / force-checkout.js
Função: applyForceCheckoutPipeline(...)
Variável: finalResponse
Condicional: sim
Flag: FEATURE_V12_FORCE_CHECKOUT
Posição: após V12 Safe Checkout
Efeito: sobrescreve totalmente finalResponse quando força, com texto novo
self-healing-engine.js → applyHealing()

Arquivo: server.js / self-healing-engine.js
Função: applyHealing(...)
Variável: finalResponse
Condicional: sim
Flag: FEATURE_V12_SELF_HEALING
Posição: após V12 Force Checkout
Efeito: sobrescreve parcialmente/totalmente se detecta falha
server.js → PP GLOBAL

Arquivo: server.js
Função: bloco PÓS-PROCESSADOR GLOBAL V16.3
Variável: finalResponse
Condicional: sim
Flag: nenhum direto; __v19Active false
Posição: após V12 e antes dos fixes V21/V15/V17
Efeito: complementa ou sobrescreve, injetando checkout/WhatsApp ou substituindo resposta genérica
channel-safe-routing.js → enforcePageDataTruth()

Arquivo: server.js / channel-safe-routing.js
Função: enforcePageDataTruth(...)
Variável: finalResponse
Condicional: sim
Flag: FEATURE_CHANNEL_SAFE_ROUTING / fix enforcePageDataTruth
Posição: após PP GLOBAL e antes V15
Efeito: sobrescreve totalmente quando aplica
v15-context-enforcer.js →  _v15EnforceContext(...)

Arquivo: server.js / v15-context-enforcer.js
Função: enforceContext(...)
Variável: finalResponse
Condicional: sim
Flag: FEATURE_V15_CONTEXT_ENFORCEMENT
Posição: após V21 PageData Truth
Efeito: sobrescreve totalmente quando aplica
v17-link-resolver.js → stripCTAText()

Arquivo: v17-link-resolver.js
Função: stripCTAText(text)
Variável: finalResponse
Condicional: sim
Flag: n/a
Posição: imediatamente antes do Channel Resolver no final do fluxo
Efeito: complementa/remova CTA antiga, gesto de sanitização
v17-link-resolver.js → detectIntent(), resolveBestLink(), buildCTA()

Arquivo: v17-link-resolver.js
Função: detectIntent(), resolveBestLink(), buildCTA()
Variável: _cuCta / cta
Condicional: sim
Flag: n/a
Posição: mesma fase de final output guard
Efeito: define cta retornado, mas não necessariamente altera texto final no endpoint
channel-resolver-safe.js → resolve()

Arquivo: channel-resolver-safe.js
Função: resolve(...)
Variável: finalResponse
Condicional: sim
Flag: FEATURE_CHANNEL_RESOLVER_SAFE
Posição: antes de V19 apply

Efeito: sobrescreve totalmente a resposta quando resolve suporte/saída
v19-deterministic-engine.js → applyDecision()

Arquivo: v19-deterministic-engine.js
Função: applyDecision(decision, finalResponse)
Variável: finalResponse
Condicional: sim
Flag: FEATURE_DETERMINISTIC_V19 / _v19Mode === true
Posição: último modificador do pipeline
Efeito: sobrescreve totalmente ou parcialmente, removendo CTA/injetando checkout/corrigindo genérico
Legacy V18.4 fallback

Arquivo: server.js
Função: bloco V18.4-FALLBACK
Variável: finalResponse
Condicional: sim
Flag: V19 não ativo ou shadow
Posição: último passo se V19 não ativo
Efeito: complementa, adiciona CTA final se ainda não houver link

Sequência cronológica de mutação:

CTA Engine ↓ Conversion Optimizer ↓ Closing Scripts ↓ Anti-Dropoff ↓ Orchestrator V10 ↓ V11 Action Resolver ↓ V10.1 Checkout Blocker ↓ V11.3 Sales Guard ↓ V12 Safe Checkout ↓ V12 Force Checkout ↓ V12 Self-Healing ↓ PP GLOBAL ↓ V21 PageData Truth ↓ V15 Context Enforcement ↓ V17.2 Link Resolver stripCTAText ↓ Channel Resolver Safe ↓ V19 Apply / V18.4 fallback ↓ return

Observações chave
O primeiro toque no texto ocorre em cta-engine.js quando FEATURE_SMART_CTA está ativo.
O primeiro possível override completo é orchestrator.js com FEATURE_ORCHESTRATOR_V10.
O último toque definitivo, quando ativo, é v19-deterministic-engine.js via applyDecision().
Se V19 não está ativo, o último mutador real é o fallback V18.4 ou o Channel Resolver Safe, dependendo do caminho.
V17.2 Link Resolver é importante porque remove CTA antigo e também produz cta separado para retorno.
Isso responde claramente: depois que outro módulo já decidiu, ainda podem tocar a resposta Action Resolver, Checkout Blocker, Sales Guard, V12/PP GLOBAL/V15, V17.2, Channel Resolver, e por fim V19 Apply ou V18.4 fallback.

****************************************************************************************************************************************************************
Para uma única mensagem de teste (por exemplo: "Quanto custa?"), percorra o fluxo completo e registre, em ordem cronológica, somente os módulos que realmente modificaram finalResponse durante essa execução.

Para cada mutação, informe:

valor antes;
valor depois;
motivo da alteração;
feature flag responsável;
se foi complemento, substituição parcial ou sobrescrita total.

Ao final, gere uma linha do tempo completa das mutações:

Resumo Compacto

Objetivo: Auditar autoridade, consumidores, redundâncias e riscos do pipeline de decisão/CTA, com foco em intent curiosity e mutações de finalResponse.
Código-chave: server.js, decision-core.js, v17-link-resolver.js, v19-deterministic-engine.js, cta-engine.js, feature-flags.js.
Estado atual: Taxonomia AS-IS criada em AUDITORIA_TAXONOMIA_AS_IS.md. Leitura e mapeamento dos mutadores concluídos; nenhuma modificação de código aplicada.
Autoridade final: Quando FEATURE_DETERMINISTIC_V19 está true, V19 é a autoridade única; se false, o último mutador real varia (Channel Resolver / V18 fallback / PP-GLOBAL / V17). FEATURE_DETERMINISTIC_V19 pode também rodar em shadow.
Pipeline resumido (ordem prática): LLM → Sales (CTA, optimizer, closing, anti-dropoff) → Orchestrator V10 → V11/V12 (force/safe/validators) → PP-GLOBAL / V15 / V17 link-resolver → Channel Resolver → V19 apply (se ativo) → retorno final em server.js.
Principais riscos: taxonomias divergentes (curiosity vs explain), múltiplos injetores/removers de checkout/CTA, baixa observabilidade das mutações (diferenças não registradas), comportamento dependente de flags.
Pendência prioritária: Executar trace de mutações para a mensagem de teste "Quanto custa?" e registrar snapshots antes/depois em cada mutador (valor, razão, flag, tipo de mutação).
Requisito para reprodução: preciso do estado efetivo das feature flags (ENV ou permissão para usar defaults — por padrão FEATURE_DETERMINISTIC_V19=false) para executar a chamada local que captura o trace.
*****************************************************************************************************************************************************************************************

buscar apenas em arquivos .js onde cada flag é referenciada, para listar os módulos que a leem. Isso me permite mapear módulos afetados.

Searched for regex FEATURE_DETERMINISTIC_V19|FEATURE_ORCHESTRATOR_V10|FEATURE_SMART_CTA|FEATURE_CONVERSION_OPTIMIZER|FEATURE_CLOSING_SCRIPTS|FEATURE_ANTI_DROPOFF|FEATURE_V11_ENGINE|FEATURE_V12_SAFE_CHECKOUT|FEATURE_V12_FORCE_CHECKOUT|FEATURE_V12_SELF_HEALING|FEATURE_CHANNEL_RESOLVER_SAFE|FEATURE_CHANNEL_SAFE_ROUTING|FEATURE_V15_CONTEXT_ENFORCEMENT|FEATURE_CHECKOUT_AUTHORITY|FEATURE_V18_FALLBACK (**/*.js), 94 results

Vou verificar se FEATURE_SMART_CTA está definido em feature-flags.js e quais módulos o referenciam; se não existir, indicarei a flag equivalente encontrada (FEATURE_WA_CTA_PROMOTER, FEATURE_SMART_CHECKOUT_SELECTOR, etc.).

Vou ler as variáveis de ambiente relevantes (as que o server.js checa via process.env) para registrar os valores efetivos sem alterar nada. Vou imprimir apenas as VARs de interesse.

Vou localizar no server.js onde _ctaEngine, _conversionOptimizer, _closingScripts, _antiDropoff são chamados para documentar a ordem de aplicação no pipeline.

Vou buscar especificamente FEATURE_CHANNEL_SAFE_ROUTING e FEATURE_CHANNEL_RESOLVER_SAFE ocorrências para mapear suas definições e módulos.

Vou procurar se existe uma função exportável ou helper generateAIResponse que eu possa chamar para executar o pipeline sem subir o servidor. Isso possibilita rodar o trace local sem modificar código.

Vou procurar se generateAIResponse ou o pipeline são exportados por algum módulo — isso facilita montar o trace sem executar o servidor inteiro.

Atualizando o plano: marco a auditoria das flags e o mapeamento como concluídos, deixando o trace em andamento. Em seguida pergunto como devo executar o trace (IA real vs stub).

Starting: Executar Runtime Mutation Trace para "Quanto custa?" (5/6)

Progresso: coletei o estado efetivo das flags em runtime e mapeei onde são definidas e consumidas. Antes de rodar o trace, preciso decidir como gerar a resposta IA.

Pergunta rápida: prefere que eu execute o trace usando

a) o pipeline real, chamando generateAIResponse (pode requerer chaves/infra externa e executa LLM), ou b) um harness local que usa um aiResponse sintético (determinístico, não depende de chaves)?
Tabela resumida das Feature Flags solicitadas

Feature Flag | Default (código) | Valor Efetivo | Origem do valor | Módulos Afetados | Impacto / Ordem no pipeline

FEATURE_DETERMINISTIC_V19: default=false; efetivo=false; origem=feature-flags.js (default); módulos=lib/v19-deterministic-engine.js, server.js; impacto=Autoridade única quando true — aplicado no final (aplica/remova CTA/checkout). Ordem: depois do Channel Resolver, antes do retorno final.
FEATURE_ORCHESTRATOR_V10: default=true; efetivo=true; origem=feature-flags.js (default); módulos=lib/orchestrator.js, server.js; impacto=Orquestrador unificado — roda após Conversion Layer (CTA/Optimizer/Closing) e pode substituir finalResponse.
FEATURE_SMART_CTA: default=(enum via ENV; não definido em feature-flags.js) -> server.js lê process.env.FEATURE_SMART_CTA; efetivo=false (ENV não está definido); origem=ENV (unset → false pelo check process.env==='true'); módulos=sales/cta-engine.js, server.js; impacto=CTA Engine roda no início do Conversion Layer (se true) e pode aplicar CTA inline salvo Orchestrator ativo.
FEATURE_CONVERSION_OPTIMIZER: default=ENV toggle in server.js; efetivo=false (ENV unset); origem=ENV; módulos=sales/conversion-optimizer.js, server.js; impacto=rodaria após CTA (otimiza estrutura/resposta).
FEATURE_CLOSING_SCRIPTS: default=ENV in server.js; efetivo=false (ENV unset); origem=ENV; módulos=sales/closing-scripts.js, server.js; impacto=aplica frases de fechamento dentro do Conversion Layer (antes do Anti-Dropoff).
FEATURE_ANTI_DROPOFF: default=ENV in server.js; efetivo=false (ENV unset); origem=ENV; módulos=sales/anti-dropoff.js, server.js; impacto=último do Conversion Layer — retenção/ajustes finais.
FEATURE_V11_ENGINE: default=false; efetivo=false; origem=feature-flags.js (default); módulos=lib/v11* (checkout-discovery, action resolver, state), server.js; impacto=V11 injeta/força checkout (Action Resolver) e atualiza state — roda após Orchestrator/Conversion Layer when enabled.
FEATURE_V12_SAFE_CHECKOUT: default=true; efetivo=true; origem=feature-flags.js (default); módulos=lib/safe-checkout-resolver.js, lib/force-checkout.js, server.js; impacto=validação/sanitização de checkout (aplica quando checkout é injetado).
FEATURE_V12_FORCE_CHECKOUT: default=true; efetivo=true; origem=feature-flags.js (default); módulos=lib/force-checkout.js, server.js; impacto=força injeção de checkout quando intenção de compra detectada (pos-processamento).
FEATURE_V12_SELF_HEALING: default=true; efetivo=true; origem=feature-flags.js (default); módulos=lib/self-healing-engine.js, server.js; impacto=corrige respostas fracas/missing checkout como etapa de validação depois das injeções.
FEATURE_CHANNEL_RESOLVER_SAFE: default=true; efetivo=true; origem=feature-flags.js (default); módulos=lib/channel-resolver-safe.js, server.js; impacto=garante canais acionáveis (WhatsApp/support) em intents de suporte; executa perto do fim do pipeline antes de V19.
FEATURE_CHANNEL_SAFE_ROUTING: não aparece como definição ativa em feature-flags.js (mencionada em docs); módulo relacionado channel-safe-routing.js existe e é carregado por server.js; origem=documentação/module (não definida como flag central); efetivo=module carregado; impacto=isola roteamento de canal (WhatsApp-only) — late-stage channel handling.
FEATURE_V15_CONTEXT_ENFORCEMENT: default=false; efetivo=false; origem=feature-flags.js (default); módulos=lib/v15-context-enforcer.js, server.js; impacto=camada de última milha que força presença de checkout/whatsapp/FAQ quando intenção alta — aplicada depois das mutações principais (se ativa).
FEATURE_CHECKOUT_AUTHORITY: default=true; efetivo=true; origem=feature-flags.js (default); módulos=lib/force-checkout.js, server.js (trecho CHECKOUT_AUTHORITY); impacto=hard override que força inserção de checkout quando regex de compra detecta a mensagem; roda após V11/V10 quando Orchestrator não gerencia links.
FEATURE_V18_FALLBACK: default=false; efetivo=false; origem=feature-flags.js (default); módulos=lib/v18-extraction-guard.js, server.js; impacto=fallback de extração (preenche checkout/whatsapp ausentes usando pageData discovered links) — guard rail de extração, executado antes das decisões finais.
Observações adicionais (demais flags que influenciam intent/CTA/checkout/finalResponse)
FEATURE_DECISION_CORE (default=true; efetivo=true — feature-flags): Decision core é usado aditivamente para detectar intent.
FEATURE_V17_BRAIN (default=false; efetivo=false): quando true, V17 pode burlar camadas legadas (bypassa V13/V15/V16/PP-GLOBAL/Sales Layer).
FEATURE_WA_CTA_PROMOTER (default=true; efetivo=true): promove WhatsApp como CTA quando não há checkout.
FEATURE_V18_EXTRACTION_GUARD (default=true; efetivo=true): proteção de extração aplicada cedo.
Observação sobre origem: o featureFlags.getAllFlags() reporta source que pode ser default (valor do código em feature-flags.js), config (lido de arquivo feature_flags.json) ou runtime (override em tempo de execução). Para flags controladas via process.env no server.js (ex.: FEATURE_SMART_CTA, FEATURE_CONVERSION_OPTIMIZER, FEATURE_CLOSING_SCRIPTS, FEATURE_ANTI_DROPOFF), o código trata process.env==='true' como habilitado — no ambiente atual essas ENV estão ausentes (null), logo o check resulta em false (não habilitado).
Fontes/como verifiquei

feature-flags.js — definições e defaults; usei featureFlags.getAllFlags() em runtime para confirmar enabled e source.
server.js — local de carregamento/invocação do pipeline (carrega/condiciona módulos por flags/env); examinei os blocos de Conversion Layer → Orchestrator → V11 → Channel Resolver → V19.
Buscas no repositório (grep_search) para mapear módulos consumidores: cta-engine.js, conversion-optimizer.js, closing-scripts.js, anti-dropoff.js, v19-deterministic-engine.js, orchestrator.js, v15-context-enforcer.js, lib/v11*, force-checkout.js, self-healing-engine.js, channel-resolver-safe.js, etc.
Próximo passo (trace)

Já marquei a auditoria das flags como concluída e iniciei a tarefa de trace (veja TODOs atualizados).

Para executar o Runtime Mutation Trace sobre a mensagem "Quanto custa?": preciso que escolha uma das opções acima (IA real vs stub). A diferença:
IA real: chama generateAIResponse("Quanto custa?", ...) e executa o pipeline real — melhor fidelidade, pode requerer API keys/infra, e registra as mutações reais.
Stub: uso um aiResponse controlado (por ex. "O produto X custa R$ 99,90. Saiba mais...") e executo as mutações em ordem real (CTA, Optimizer, Closing, V10, V11, V12, Channel Resolver, V19, etc.) para capturar antes/depois de finalResponse. Risco: pode não reproduzir exatamente um LLM real, mas garante determinismo local e mostra quais módulos efetivamente mutam a string.
Diga qual opção prefere e eu executo o trace imediatamente, registrando para cada mutação:

módulo;
função;
valor antes;
valor depois;
motivo;
flag responsável;
tipo de mutação (complemento / substituição parcial / sobrescrita total).
Quer que eu rode com IA real ou com stub determinístico?




