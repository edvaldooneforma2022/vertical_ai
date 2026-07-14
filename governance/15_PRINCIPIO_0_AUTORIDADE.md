# PRINCÍPIO 0 — Nenhuma correção antes da confirmação de autoridade

## Objetivo

Nenhuma alteração de código poderá ser realizada antes da confirmação explícita de qual módulo possui autoridade sobre a responsabilidade envolvida.

Este é o princípio mais importante de toda a governança do Link Mágico.

---

## Motivação

Grande parte das regressões históricas ocorreu porque correções foram aplicadas em módulos que já não eram mais os responsáveis finais pela decisão.

Exemplos:

- corrigir Decision Core quando V17 já recalcula Intent;
- alterar CTA Engine quando V19 decide CTA;
- alterar Link Resolver paralelo sem confirmar qual resolver é autoridade.

---

## Fluxo obrigatório

Antes de editar qualquer código o agente deverá responder:

### 1. Qual responsabilidade está sendo alterada?

Exemplos

- Intent
- CTA
- Checkout
- Extração
- Links
- Lead Capture
- Scheduler
- CRM

---

### 2. Quem é a autoridade comprovada?

Não pode ser inferência.

A resposta deve citar:

- contrato arquitetural
- documentação
- mapa
- código

---

### 3. O módulo que será alterado é

- Autoridade
- Consumidor
- Validador
- Compatibilidade
- Shadow
- Legado

---

### 4. Quem consome esta decisão?

Exemplo

Decision Core

↓

V17

↓

V19

↓

Widget

↓

WhatsApp

↓

CRM

---

### 5. O comportamento final passa por esse módulo?

Responder com evidências.

---

### 6. O bug está comprovado?

Classificação

🔴 Confirmado

🟡 Provável

⚪ Hipótese

---

Sem essas respostas nenhuma alteração poderá ser iniciada.