# 01_ESTADO_ATUAL_AS_IS.md

# Estado Atual da Arquitetura (AS-IS)

Versão: 1.0

Status: Referência Técnica

Tipo: Estado Atual

---

# Objetivo

Este documento descreve o estado atual conhecido da arquitetura do Link Mágico.

Seu propósito é registrar, da forma mais objetiva possível, como a plataforma está organizada atualmente.

Este documento **não contém propostas de melhoria**.

Também **não define arquitetura futura**.

Seu conteúdo deve representar apenas aquilo que pode ser observado através de:

- código-fonte;
- documentação oficial;
- auditorias realizadas;
- logs de execução;
- comportamento conhecido do sistema.

---

# Escopo

Este documento descreve:

- arquitetura geral;
- módulos existentes;
- pipelines;
- versões coexistentes;
- responsabilidades atualmente observadas;
- feature flags relevantes;
- integrações;
- componentes principais.

Não descreve:

- problemas;
- riscos;
- duplicações;
- sugestões;
- roadmap.

Esses assuntos pertencem aos documentos posteriores.

---

# Visão Geral da Plataforma

O Link Mágico é uma plataforma SaaS multi-tenant orientada à automação comercial.

Sua arquitetura evoluiu incrementalmente ao longo de diversas versões.

Hoje a plataforma é composta por diversos módulos especializados que atuam em conjunto.

Entre suas principais capacidades encontram-se:

- CRM
- IA Conversacional
- Captura Inteligente de Leads
- Extração Inteligente de Conteúdo
- WhatsApp
- Scheduler
- Billing
- Analytics
- Multi Tenant
- Widget Conversacional
- Link Curto
- Pipeline Comercial
- Memória Conversacional
- Sistema de Conhecimento
- Sistema de CTA
- Sistema de Checkout
- Sistema de Feature Flags

---

# Arquitetura Geral

Em alto nível, o processamento de uma mensagem segue o fluxo abaixo.

```mermaid
flowchart TD

Mensagem

--> Extração

--> Knowledge

--> Decision

--> IA Conversacional

--> Sales

--> CTA

--> Checkout

--> Pipeline Final

--> Resposta
```

Este fluxo representa uma visão simplificada da arquitetura.

Diversas camadas adicionais participam do processamento dependendo das Feature Flags ativas.

---

# Componentes Principais

## CRM

Responsável pelo gerenciamento de:

- Leads
- Clientes
- Histórico
- Pipeline Comercial

---

## Multi Tenant

Responsável pelo isolamento entre clientes da plataforma.

Cada tenant possui:

- configurações;
- conhecimento;
- integrações;
- billing;
- analytics;
- widgets;
- links.

---

## Billing

Responsável pelo gerenciamento de assinaturas.

Inclui:

- planos;
- pagamentos;
- limites;
- licenciamento.

---

## Scheduler

Gerencia:

- lembretes;
- follow-ups;
- tarefas;
- agendamentos.

---

## Widget

O sistema possui dois modos principais.

### Widget Inline

Balão conversacional incorporado.

---

### Widget Fullscreen

Experiência completa em tela cheia.

---

## Link Curto

Sistema responsável por:

- geração de links;
- resolução;
- redirecionamentos.

---

## WhatsApp

Integrações observadas:

- Twilio
- Evolution API

Responsável pela comunicação via WhatsApp.

---

## Analytics

Coleta métricas relacionadas a:

- utilização;
- conversões;
- interações;
- comportamento.

---

## Sistema de Conhecimento

Camada utilizada para fornecer contexto à IA.

Inclui:

- documentos;
- páginas;
- conteúdos extraídos;
- memória.

---

## IA Conversacional

Responsável pela geração de respostas naturais.

Integra:

- contexto
- conhecimento
- histórico
- estratégia conversacional

---

# Evolução da Arquitetura

Ao longo da evolução do projeto surgiram diversas versões dos motores internos.

Entre elas:

- V10
- V11
- V12
- V13
- V14
- V15
- V16
- V17
- V18
- V19
- V21

Nem todas substituíram completamente suas versões anteriores.

Em diversos casos novas versões passaram a coexistir com módulos legados.

---

# V17

O V17 é atualmente reconhecido como o principal motor conversacional.

Entre suas responsabilidades observadas estão:

- interpretação contextual;
- geração da resposta;
- estratégia conversacional;
- definição de tom;
- sell mode;
- intenção principal.

Logs normalmente associados:

[V17]

Unified Brain

intent

tone

sellMode

checkout

whatsapp

---

# V18

O V18 atua principalmente sobre informações estruturadas.

Responsabilidades observadas:

- extração inteligente;
- descoberta de checkout;
- descoberta de WhatsApp;
- descoberta de redes sociais;
- confidence score.

Possui mecanismos adicionais de proteção (guards).

---

# V19

O V19 introduz um mecanismo determinístico para decisões comerciais.

Entre suas responsabilidades observadas:

- CTA;
- buyer;
- stage;
- checkout;
- decisão comercial.

Pode operar em modo Shadow.

---

# V21

O V21 foi introduzido como camada de hardening.

Seu objetivo declarado é:

- priorização;
- correções;
- robustez;
- proteção.

---

# Pipeline Observado

De forma simplificada, o processamento atual pode ser representado como:

```mermaid
flowchart TD

Mensagem

--> Extração

--> Conhecimento

--> Decision Core

--> V17

--> Learning

--> CTA

--> Sales Layer

--> Checkout

--> Estado

--> V19

--> V21

--> Resposta
```

O comportamento exato pode variar conforme Feature Flags.

---

# Feature Flags

A plataforma utiliza extensivamente Feature Flags.

Entre as mais relevantes encontram-se:

- FEATURE_DETERMINISTIC_V19
- FEATURE_V17_EXTENDED_CONTEXT
- FEATURE_CHANNEL_RESOLVER_SAFE
- FEATURE_SMART_CTA
- FEATURE_SALES_LAYER
- FEATURE_CLEAN_CHAT_V2
- FEATURE_DECISION_ENGINE_V2
- FEATURE_V18_FALLBACK

Outras Feature Flags adicionais podem existir.

---

# Persistência

A plataforma mantém persistência para:

- CRM
- Leads
- Conversas
- Conhecimento
- Configurações
- Billing
- Analytics

---

# Integrações

Entre as integrações observadas:

- OpenAI
- Twilio
- Evolution
- Sistemas de pagamento
- Crawlers
- Extração Web

---

# Logs

Diversos módulos produzem logs específicos.

Exemplos:

[V17]

[V18]

[V19]

[V21]

Decision Core

Checkout

Extraction

Analytics

---

# Compatibilidade

O sistema mantém compatibilidade com:

- Widget Inline
- Widget Fullscreen
- Link Curto
- WhatsApp
- CRM
- Billing
- Scheduler
- Multi Tenant
- Analytics

---

# Estado da Arquitetura

A arquitetura atual caracteriza-se por:

- evolução incremental;
- coexistência de múltiplas versões;
- utilização intensiva de Feature Flags;
- forte modularização;
- múltiplos pipelines especializados.

Este documento descreve apenas o estado atual conhecido da plataforma.

Problemas, duplicações, conflitos e propostas de evolução são tratados nos documentos subsequentes.