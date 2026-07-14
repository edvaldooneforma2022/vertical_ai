# README.md

# 🚀 Link Mágico

## Transforme qualquer página em um vendedor automático com Inteligência Artificial

---

## Visão Geral

O **Link Mágico** é uma plataforma SaaS de CRM Conversacional baseada em Inteligência Artificial que transforma páginas, produtos e negócios em vendedores automáticos capazes de responder dúvidas, quebrar objeções e conduzir visitantes até a compra.

Não é um chatbot tradicional.

É uma plataforma completa de automação conversacional composta por dezenas de módulos especializados trabalhando em conjunto.

---

# Principais recursos

* CRM Conversacional Multi-Tenant
* Assistentes Inteligentes
* Widget Inteligente para Sites
* Integração WhatsApp (Twilio / Evolution)
* Checkout Inteligente
* Pipeline Comercial
* Agendamento
* Analytics
* Auto Learning
* Extração Inteligente de Conteúdo
* Knowledge Base Automática
* White Label
* Sistema de Billing
* Painel Administrativo
* Sistema de Leads
* Estratégias Conversacionais de Venda
* Feature Flags
* Arquitetura Modular

---

# Arquitetura

O Link Mágico é composto por diversos motores especializados.

Exemplos:

* Extração
* Intent
* Decision Engine
* CTA Engine
* Checkout Authority
* CRM
* Scheduler
* Analytics
* Learning
* Widget
* WhatsApp

Todos trabalham seguindo contratos arquiteturais definidos na pasta **governance/**.

---

# ⚠ IMPORTANTE

Este NÃO é um projeto simples.

Antes de alterar qualquer linha de código, é obrigatório seguir o processo abaixo.

---

# Ordem obrigatória de leitura

## Passo 1

Leia integralmente:

```text
ONBOARDING.md
```

---

## Passo 2

Leia TODOS os documentos da pasta

```text
governance/
```

---

## Passo 3

Leia a documentação técnica

```text
docs/
```

Principalmente:

* CTA_ENGINE_MASTER_MAP
* DECISION_CORE_MASTER_MAP
* MATRIZ_DE_PROPRIEDADE
* CHANGE_IMPACT_PLAYBOOK
* Postmortems
* Documentação das Feature Flags

---

## Passo 4

Somente após compreender a arquitetura você poderá alterar código.

---

# Filosofia do projeto

No Link Mágico valorizamos:

✔ Arquitetura

✔ Estabilidade

✔ Clareza

✔ Baixo acoplamento

✔ Responsabilidade única

✔ Evolução segura

Não valorizamos:

❌ Correções rápidas

❌ Gambiarras

❌ Duplicação de responsabilidades

❌ Novos pontos de decisão

❌ Alterações sem investigação

---

# Regra de Ouro

Antes de alterar qualquer código, responda:

* Quem é o dono desta responsabilidade?
* Quem consome essa decisão?
* Existe contrato arquitetural?
* Existe Source of Truth?
* Existe ADR?
* Existe rollback?
* Existe teste de regressão?

Se alguma resposta for "não sei", pare.

Primeiro investigue.

---

# Estrutura do projeto

```text
README.md

ONBOARDING.md

governance/

docs/

server.js

routes/

services/

lib/

widget/

analytics/

crm/

...
```

---

# Documentação

## ONBOARDING.md

Como iniciar corretamente no projeto.

---

## governance/

Constituição da arquitetura.

Define:

* Autoridades
* Contratos
* Governança
* Princípios
* Roadmaps
* Responsabilidades
* ADRs

---

## docs/

Documentação técnica do sistema.

Mapas.

Playbooks.

Fluxos.

Histórico.

---

# Pull Requests

Nenhum Pull Request será aceito sem:

* identificação da responsabilidade alterada;
* confirmação da autoridade;
* análise dos consumidores;
* execução do Regression Playbook;
* documentação da decisão;
* rollback definido.

---

# Objetivo da Engenharia

O objetivo da equipe não é apenas adicionar funcionalidades.

O objetivo principal é preservar a arquitetura e reduzir regressões.

Uma funcionalidade entregue sem regressão vale mais do que dez funcionalidades entregues rapidamente.

---

# Para Desenvolvedores

Antes de abrir seu editor e começar a programar, faça uma pergunta:

> **"Eu realmente compreendi este sistema?"**

Se a resposta for "ainda não", continue estudando.

Arquitetura sempre vem antes do código.

---

# Para Agentes de IA

Copilot

Claude

ChatGPT

Cursor

Windsurf

Qualquer agente deve seguir exatamente as mesmas regras de um desenvolvedor humano.

Nenhuma IA possui autorização para alterar código antes de concluir o processo definido em **ONBOARDING.md**.

---

# Missão

Construir a plataforma de automação conversacional mais estável, previsível e evolutiva possível, preservando a arquitetura em primeiro lugar e garantindo que novas funcionalidades nunca comprometam a confiabilidade do sistema.
