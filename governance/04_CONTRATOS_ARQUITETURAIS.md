# 04_CONTRATOS_ARQUITETURAIS.md

# Contratos Arquiteturais

Versão: 1.0

Status: Arquitetura Alvo

Tipo: Governança

---

# Objetivo

Este documento estabelece os contratos arquiteturais oficiais do Link Mágico.

Um contrato arquitetural define uma regra permanente da arquitetura.

Esses contratos descrevem:

- quem possui autoridade sobre determinada responsabilidade;
- quais módulos podem consumir essa decisão;
- quais módulos podem validá-la;
- quais módulos jamais poderão modificá-la.

Os contratos representam o estado desejado da arquitetura.

Toda evolução futura deverá respeitar estes contratos.

---

# O que é um Contrato Arquitetural

Um contrato arquitetural é uma regra de governança.

Ele não descreve implementação.

Ele descreve responsabilidades.

Enquanto implementações podem mudar ao longo do tempo, contratos permanecem estáveis.

---

# Princípios Gerais

Todos os contratos deste documento seguem cinco princípios fundamentais.

## 1. Autoridade Única

Cada responsabilidade possui apenas um dono.

Nenhum outro módulo poderá alterar essa decisão.

---

## 2. Consumo Passivo

Consumidores recebem decisões prontas.

Nunca as modificam.

---

## 3. Validação Não é Decisão

Validadores verificam consistência.

Não alteram regras de negócio.

---

## 4. Observação Não é Participação

Logs.

Analytics.

Learning.

Auditoria.

Nunca alteram comportamento.

---

## 5. Compatibilidade

Todo contrato deve preservar:

- Widget
- Widget Fullscreen
- WhatsApp
- CRM
- Billing
- Scheduler
- Multi Tenant
- Analytics
- Link Curto

---

# CONTRATO 001

# Autoridade da Intenção

## Responsabilidade

Determinar a intenção principal da mensagem.

Exemplos:

- compra
- suporte
- informação
- objeção
- negociação

---

## Autoridade

V17

---

## Consumidores

V19

CRM

Analytics

Scheduler

Knowledge

---

## Validadores

V21

---

## Proibições

Nenhum outro módulo poderá:

- recriar intent;
- alterar intent;
- substituir intent;
- reinterpretar intent.

---

## Motivação

Intent é a principal decisão conversacional.

Toda decisão posterior depende dela.

---

# CONTRATO 002

# Estratégia Conversacional

## Responsabilidade

Determinar:

- tom
- personalidade
- estilo
- sellMode
- abordagem

---

## Autoridade

V17

---

## Consumidores

Widget

WhatsApp

CRM

---

## Proibições

Nenhuma camada posterior poderá alterar:

- tom;
- estratégia;
- personalidade.

---

# CONTRATO 003

# CTA

## Responsabilidade

Definir:

- existência;
- tipo;
- momento;
- prioridade.

---

## Autoridade

V19

---

## Consumidores

Widget

WhatsApp

CRM

Link Curto

---

## Validadores

V21

---

## Proibições

Nenhum módulo poderá criar CTA posteriormente.

Se o CTA não existir:

nenhuma camada poderá inventá-lo.

---

## Exemplo

Correto

V19

↓

Sem CTA

↓

V21

↓

Sem CTA

---

Incorreto

V19

↓

Sem CTA

↓

V21

↓

Criar CTA

---

# CONTRATO 004

# Checkout

## Responsabilidade

Selecionar o checkout definitivo.

---

## Autoridade

Checkout Authority

(ou V19 caso a arquitetura evolua nesse sentido)

---

## Consumidores

Widget

WhatsApp

CRM

---

## Validadores

Safe Checkout

V21

---

## Proibições

Fallbacks nunca poderão substituir checkout válido.

---

Force Checkout nunca poderá alterar decisão comercial.

---

Checkout Fallback nunca poderá criar comportamento diferente.

---

# CONTRATO 005

# Resolução de Links

## Responsabilidade

Resolver links finais.

---

## Autoridade

Link Resolver

---

## Consumidores

CTA

Widget

WhatsApp

CRM

---

## Validadores

Safe Resolver

---

## Proibições

Nenhum outro módulo poderá priorizar links.

---

Nenhum módulo poderá alterar links resolvidos.

---

# CONTRATO 006

# Extração

## Responsabilidade

Produzir pageData.

---

## Autoridade

V18

---

## Consumidores

Knowledge

V17

CRM

---

## Validadores

Extraction Guard

---

## Proibições

Nenhum consumidor poderá modificar pageData.

---

# CONTRATO 007

# Conhecimento

## Responsabilidade

Construção do contexto utilizado pela IA.

---

## Autoridade

Knowledge Engine

---

## Consumidores

V17

---

## Validadores

Knowledge Guard

---

## Proibições

Nenhum módulo poderá alterar conhecimento após sua consolidação.

---

# CONTRATO 008

# Buyer Stage

## Responsabilidade

Determinar estágio comercial.

---

## Autoridade

V19

---

## Consumidores

CRM

Scheduler

Analytics

---

## Proibições

Nenhuma camada poderá alterar buyer stage.

---

# CONTRATO 009

# Lead Capture

## Responsabilidade

Determinar quando um Lead deve ser criado.

---

## Autoridade

Lead Capture Engine

---

## Consumidores

CRM

Analytics

Scheduler

---

## Validadores

Capture Validator

---

## Proibições

Widget.

Server.

Decision Engines.

Nunca deverão criar Leads diretamente.

Toda criação deverá passar pela autoridade oficial.

---

# CONTRATO 010

# CRM

## Responsabilidade

Persistência comercial.

---

## Autoridade

CRM

---

## Regra

CRM nunca toma decisões.

CRM apenas persiste.

---

# CONTRATO 011

# Billing

## Responsabilidade

Gestão financeira.

---

## Autoridade

Billing

---

## Regra

Billing nunca interfere em decisões conversacionais.

---

# CONTRATO 012

# Scheduler

## Responsabilidade

Agendamento.

---

## Autoridade

Scheduler

---

## Regra

Scheduler nunca altera decisões comerciais.

---

# CONTRATO 013

# Analytics

## Responsabilidade

Observação.

---

## Autoridade

Analytics

---

## Regra

Analytics jamais altera comportamento.

Analytics apenas registra.

---

# CONTRATO 014

# Learning

## Responsabilidade

Aprendizado.

---

## Autoridade

Learning Engine

---

## Regra

Learning nunca modifica respostas em tempo real.

Toda aprendizagem deverá ocorrer fora do pipeline síncrono.

---

# CONTRATO 015

# Hardening

## Responsabilidade

Validação.

Proteção.

Correção.

---

## Autoridade

V21

---

## Limites

V21 poderá:

✔ validar

✔ impedir estados inválidos

✔ corrigir inconsistências técnicas

---

V21 nunca poderá:

✘ alterar intenção

✘ criar CTA

✘ alterar estratégia

✘ alterar buyer stage

✘ alterar checkout escolhido

✘ alterar links resolvidos

---

# CONTRATO 016

# Feature Flags

Toda alteração arquitetural deverá possuir:

- rollback simples;
- isolamento;
- logs;
- compatibilidade.

Feature Flags nunca deverão modificar contratos arquiteturais.

Elas apenas controlam implementações.

---

# CONTRATO 017

# Compatibilidade

Nenhuma alteração poderá quebrar:

- Widget
- WhatsApp
- CRM
- Billing
- Scheduler
- Analytics
- Multi Tenant
- Link Curto

Sem estratégia explícita de migração.

---

# CONTRATO 018

# Observabilidade

Toda decisão crítica deverá produzir logs estruturados.

Exemplos:

Intent

CTA

Checkout

Buyer Stage

Lead Capture

Extração

Os logs deverão permitir reconstruir o pipeline de decisão.

---

# CONTRATO 019

# Não Regressão

Toda alteração deverá responder:

Existe autoridade única?

Existe segunda autoridade?

Existe Feature Flag?

Existe rollback?

Existe validação?

Existe teste?

Caso qualquer resposta seja negativa, a alteração deverá ser revisada.

---

# CONTRATO 020

# Evolução da Arquitetura

Toda evolução deverá obedecer à seguinte ordem.

```mermaid
flowchart TD

Nova Funcionalidade

--> Identificar Responsabilidade

--> Localizar Autoridade

--> Avaliar Impacto

--> Implementar

--> Testar

--> Documentar
```

Nenhuma funcionalidade poderá criar uma nova autoridade sem atualização da Matriz de Autoridade e deste documento.

---

# Cláusula Final

Os Contratos Arquiteturais constituem a referência normativa da arquitetura do Link Mágico.

Implementações podem evoluir.

Pipelines podem ser reorganizados.

Motores podem ser substituídos.

Entretanto, os contratos de responsabilidade definidos neste documento devem permanecer consistentes ao longo da evolução da plataforma.

Qualquer exceção deverá ser explicitamente documentada, justificada e aprovada antes da implementação.