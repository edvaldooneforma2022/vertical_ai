# Architecture Authority Contracts

Este documento define os contratos de autoridade arquitetural do Link Mágico. Ele deve ser usado como referência oficial para decisões futuras de arquitetura e implementação.

## Contrato 001
Somente `lib/v17-orchestrator.js` pode criar ou alterar a intenção principal (`Intent`) quando `FEATURE_V17_BRAIN` estiver ativo.

## Contrato 002
Somente `lib/v19-deterministic-engine.js` pode criar, remover ou alterar o estado final de CTA e checkout quando `FEATURE_DETERMINISTIC_V19=true`.

## Contrato 003
Somente a camada de Checkout Authority (resolver/links do pipeline central: `lib/v17-link-resolver.js`, `lib/link-resolver.js`, `lib/safe-checkout-resolver.js`) pode definir o checkout final exposto ao cliente.

## Contrato 004
Somente `lib/v17-link-resolver.js` e seus componentes associados do pipeline central podem resolver URLs finais de compra e fallback de WhatsApp para o fluxo de conversão.

## Contrato 005
Somente `lib/v18-extraction-guard.js` pode produzir e classificar `pageData` confiável para o pipeline de decisão, incluindo confiança de checkout e WhatsApp.

## Contrato 006
A V21 (`whatsapp-channel.js`) nunca cria decisões comerciais; ela apenas valida e traduz decisões existentes do pipeline central para o canal WhatsApp.

## Contrato 007
`analytics.js`, `lib/wa-parity-audit.js`, `lib/commercial-events.js`, `lib/v20-*` e outras camadas observadoras nunca alteram comportamento; elas apenas registram e observam.

## Contrato 008
CRM (`crm-manager`, `crm-integration`, `lib/leads/*` consumidores) nunca altera decisões conversacionais; o CRM apenas consome eventos e dados de lead.

## Contrato 009
`server.js` orquestra fluxo, mas não deve incorporar regras de decisão comercial direta; essas regras devem residir em módulos especializados como V17, V19, CTA Engine e Decision Core.

## Contrato 010
`public/widget.js` e o widget embarcável somente consomem decisões e renderizam ações; o widget não é autoridade de CTA/checkout/lead capture, apenas de apresentação.

## Contrato 011
`lib/feature-flags.js` apenas habilita ou desabilita pipelines e comportamentos; ela não deve conter a lógica de decisão comercial em si.

## Contrato 012
`LeadCaptureSystem` e `lib/lead-capture-score.js` podem decidir se o lead deve ser capturado, mas não devem decidir o texto da resposta principal ou o CTA exibido.

## Contrato 013
Scheduler (`scheduling-manager.js`, `detectarAgendamento`, `calendarHash`) é a única autoridade para criar e expor `calendarHash` e rotas de agendamento.

## Contrato 014
`lib/conversation-state.js` é a única autoridade para manter e servir estado de conversa por `conversationId` dentro do pipeline.

## Contrato 015
`lib/v17-link-resolver.js` e `lib/v19-deterministic-engine.js` são as únicas camadas que podem remover CTA existente de uma resposta final antes de entrega.

## Contrato 016
`lib/decision-core.js` pode atuar como autoridade legada de intent e bloqueio de checkout apenas quando V17/V19 não estiverem desempenhando autoridade única; caso contrário, é consumidor ou fallback.

## Contrato 017
`whatsapp-channel.js` não deve injetar links de WhatsApp (`wa.me`) dentro de respostas enviadas pelo próprio WhatsApp.

## Contrato 018
`lib/wa-cta-promoter.js` só pode promover WhatsApp como CTA em canais que não sejam o próprio WhatsApp.

## Contrato 019
`Link Curto` e `short-url-generator.js` são autoridades únicas para resolver o tenant e o contexto de campanha dos short URLs.

## Contrato 020
`lib/v18-extraction-guard.js` deve ser a autoridade de diagnóstico que diferencia ausência real de informação de simples falha de extração.

## Contrato 021
`Knowledge Base` (`knowledge-base.js`, `lib/knowledge-builder.js`) só pode validar e fornecer contexto de conhecimento; ela não deve overpor a decisão comercial de venda/CTA/checkout.

## Contrato 022
`Billing` (`billing-enforcement.js`, `billing-audit.js`) nunca deve bloquear respostas comerciais sem um sinal explícito de estado de assinatura inativo ou limites excedidos.

## Contrato 023
`V17` pode ser autoridade de estratégia e prompt, mas não deve ser autoridade final de checkout quando `V19` estiver ativo e autorizado.

## Contrato 024
`V21` é um contrato de paridade: o canal WhatsApp deve usar o mesmo pipeline central do Link Curto e só adaptar o formato de saída.

## Contrato 025
`Observer Layer` (`lib/v14-*`, `v20`, auditoria) deve ser puramente aditiva: não deve alterar flags, decisões nem injetar lógica emergente por observação.

---

*Este documento deve ser atualizado somente com nova auditoria arquitetural, não com correções de implementação.*
