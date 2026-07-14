# CODE OWNERSHIP MATRIX

Versão: 1.0

Objetivo

Definir claramente quem é DONO de cada responsabilidade.

Ser dono significa:

✔ decidir

✔ alterar

✔ produzir

Não significa:

validar

consumir

observar

---

| Responsabilidade | Dono | Consumidores | Validadores | Observadores |
|-----------------|------|--------------|-------------|--------------|

Intent

V17

↓

V19

↓

Analytics

↓

CRM

↓

Widget

---

CTA

V19

↓

Widget

↓

WhatsApp

↓

Link Curto

---

Checkout

Checkout Authority

↓

Widget

↓

WhatsApp

↓

Billing

---

Links

Link Resolver

↓

CTA

↓

Checkout

---

Extração

V18

↓

V17

↓

Knowledge

↓

CRM

---

Lead Capture

Lead Capture

↓

CRM

↓

Analytics

---

Scheduler

Scheduler

↓

CRM

↓

WhatsApp

---

Analytics

Analytics

↓

Dashboard

↓

Learning

---

CRM

CRM

↓

Dashboard

↓

Scheduler

---

# Regra

Somente o DONO pode produzir.

Consumidores nunca podem alterar.

Validadores nunca podem sobrescrever.

Observadores nunca podem modificar.

Qualquer violação deverá ser considerada dívida arquitetural.