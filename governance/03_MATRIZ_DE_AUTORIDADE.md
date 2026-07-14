# 03_MATRIZ_DE_AUTORIDADE.md

# Matriz de Autoridade Arquitetural

Versão: 1.0

Status: Arquitetura Alvo

Tipo: Governança

---

# Objetivo

Este documento estabelece a matriz oficial de autoridade arquitetural do Link Mágico.

Seu objetivo é responder, para cada responsabilidade do sistema:

- Quem possui autoridade para decidir.
- Quem apenas consome essa decisão.
- Quem apenas valida.
- Quem apenas observa.
- Quais módulos atualmente executam essa responsabilidade.
- Quais módulos devem deixar de executá-la futuramente.

Este documento representa a arquitetura desejada (TO-BE).

Ele **não descreve necessariamente o comportamento atual do sistema**.

---

# Conceitos

Toda responsabilidade arquitetural deve possuir apenas uma autoridade.

Os demais componentes pertencem a apenas um dos grupos abaixo.

## Autoridade

Pode criar.

Pode alterar.

Pode remover.

Sua decisão é considerada definitiva.

---

## Consumidor

Recebe uma decisão.

Nunca pode modificá-la.

Pode apenas utilizá-la.

---

## Validador

Pode impedir estados inválidos.

Pode validar consistência.

Nunca altera regra de negócio.

---

## Observador

Não interfere.

Apenas registra.

Exemplos:

Analytics

Learning

Logs

Auditoria

---

# Princípio Fundamental

> Nenhuma responsabilidade poderá possuir duas autoridades simultaneamente.

Caso dois módulos alterem o mesmo atributo, existe sobreposição arquitetural.

Essa situação deve ser tratada como dívida técnica.

---

# MATRIZ OFICIAL

---

# 1. Intenção Conversacional

## Responsabilidade

Determinar a intenção principal da mensagem.

Exemplos:

- compra
- suporte
- informação
- objeção
- dúvida
- negociação

---

## Autoridade proposta

V17

---

## Consumidores

V19

CRM

Analytics

Scheduler

Pipeline Conversacional

---

## Validadores

V21

---

## Observadores

Learning

Logs

Analytics

---

## Módulos atualmente envolvidos

- Decision Core
- Decision Engine
- V13
- V16
- V17
- V19

---

## Módulos redundantes

Decision Core

Decision Engine

V13

V16

(para esta responsabilidade)

---

## Prioridade

★★★★★

---

# 2. Estratégia Conversacional

## Responsabilidade

Definir:

- tom
- abordagem
- estilo
- sellMode
- personalidade

---

## Autoridade proposta

V17

---

## Consumidores

Widget

WhatsApp

CRM

---

## Validadores

V21

---

## Observadores

Analytics

---

## Prioridade

★★★★★

---

# 3. CTA

## Responsabilidade

Determinar:

- se haverá CTA;
- qual CTA;
- momento do CTA.

---

## Autoridade proposta

V19

---

## Consumidores

Widget

WhatsApp

Link Curto

CRM

---

## Validadores

V21

---

## Observadores

Analytics

Learning

---

## Módulos atualmente envolvidos

Decision Core

Sales Layer

CTA Engine

V19

V21

---

## Módulos redundantes

Decision Core

Sales Layer

CTA Engine

V21 (criando CTA)

---

## Prioridade

★★★★★

---

# 4. Checkout

## Responsabilidade

Selecionar o checkout definitivo.

---

## Autoridade proposta

Checkout Authority

(ou V19 caso essa decisão seja adotada futuramente)

---

## Consumidores

Widget

WhatsApp

Link Curto

CRM

---

## Validadores

Safe Checkout

V21

---

## Observadores

Analytics

---

## Módulos atualmente envolvidos

Checkout Authority

Force Checkout

Fallback

V12

V19

---

## Prioridade

★★★★★

---

# 5. Resolução de Links

## Responsabilidade

Escolher links finais.

Exemplos:

- checkout
- WhatsApp
- redes sociais
- landing pages

---

## Autoridade proposta

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

## Observadores

Logs

---

## Módulos atualmente envolvidos

Link Resolver

V17 Link Resolver

ResolveLink()

---

## Prioridade

★★★★★

---

# 6. Extração Inteligente

## Responsabilidade

Construir pageData.

Extrair:

- checkout
- WhatsApp
- redes sociais
- formulários
- contexto

---

## Autoridade proposta

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

## Observadores

Analytics

---

## Módulos atualmente envolvidos

Crawler

Deep Context

V11

V18

Fallback

---

## Prioridade

★★★★☆

---

# 7. Conhecimento

## Responsabilidade

Construir contexto utilizado pela IA.

---

## Autoridade proposta

Knowledge Engine

---

## Consumidores

V17

---

## Validadores

Knowledge Guard

---

## Observadores

Learning

---

## Prioridade

★★★★☆

---

# 8. Buyer Stage

## Responsabilidade

Determinar estágio do comprador.

---

## Autoridade proposta

V19

---

## Consumidores

CRM

Analytics

Scheduler

---

## Validadores

V21

---

## Prioridade

★★★★☆

---

# 9. Lead Capture

## Responsabilidade

Determinar quando criar um Lead.

---

## Autoridade proposta

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

## Módulos atualmente envolvidos

Widget

Server

Lead Capture Score

Feature Chat First

---

## Prioridade

★★★★☆

---

# 10. CRM

## Responsabilidade

Persistência comercial.

---

## Autoridade

CRM

---

## Consumidores

Todos

---

## Prioridade

★★☆☆☆

---

# 11. Billing

## Autoridade

Billing

---

Nunca recebe decisões externas.

---

# 12. Scheduler

## Autoridade

Scheduler

---

Responsável exclusivamente por agenda.

---

# 13. Analytics

## Autoridade

Analytics

---

Nunca altera decisões.

Apenas observa.

---

# 14. Learning

## Autoridade

Learning Engine

---

Nunca altera resposta em tempo real.

Utiliza apenas histórico.

---

# MATRIZ RESUMIDA

| Responsabilidade | Autoridade | Consumidores | Validadores | Observadores |
|-----------------|------------|--------------|--------------|--------------|
| Intent | V17 | V19, CRM | V21 | Analytics |
| Estratégia | V17 | Widget | V21 | Analytics |
| CTA | V19 | Widget, WhatsApp | V21 | Learning |
| Checkout | Checkout Authority | Widget | Safe Checkout | Analytics |
| Links | Link Resolver | CTA | Safe Resolver | Logs |
| Extração | V18 | V17 | Guards | Analytics |
| Knowledge | Knowledge | V17 | Guards | Learning |
| Buyer Stage | V19 | CRM | V21 | Analytics |
| Lead Capture | Lead Capture | CRM | Validator | Analytics |
| CRM | CRM | Todos | — | — |
| Billing | Billing | Todos | — | — |
| Scheduler | Scheduler | Todos | — | — |
| Analytics | Analytics | — | — | — |

---

# Regras de Governança

Toda nova funcionalidade deverá responder obrigatoriamente às perguntas abaixo.

## Existe uma autoridade para essa responsabilidade?

Se não existir, ela deverá ser criada.

---

## Essa alteração cria uma segunda autoridade?

Se sim, a alteração deve ser reavaliada.

---

## Algum módulo existente deixará de ser autoridade?

Caso positivo, isso deverá ser documentado.

---

## O módulo apenas consome a decisão?

Se sim, ele nunca poderá modificá-la.

---

# Critério de Aceitação

Uma responsabilidade será considerada corretamente modelada quando:

- possuir exatamente uma autoridade;
- possuir consumidores claramente definidos;
- possuir validadores claramente definidos;
- possuir observadores claramente definidos;
- não existir outro módulo alterando silenciosamente essa decisão.

---

# Objetivo Final

A Matriz de Autoridade representa o contrato central da arquitetura do Link Mágico.

Todos os demais documentos devem ser consistentes com esta matriz.

Toda evolução futura deverá preservar o princípio de autoridade única por responsabilidade.

Caso um novo módulo necessite interferir em uma decisão já existente, essa alteração deverá ser explicitamente registrada e aprovada antes da implementação.