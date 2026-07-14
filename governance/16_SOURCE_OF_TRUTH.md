# SOURCE OF TRUTH

## Objetivo

Toda regra de negócio do Link Mágico deve possuir uma origem oficial.

Nenhuma alteração poderá ser baseada apenas em inferência.

---

## Hierarquia da verdade

Nível 1

Contrato Arquitetural

↓

Nível 2

Documentação Oficial

↓

Nível 3

Business Rules

↓

Nível 4

Código

↓

Nível 5

Testes

↓

Nível 6

Inferência

---

## Exemplo

Pergunta

Como funciona?

Intent esperado

info

Origem

BUSINESS_RULES.md

Consumidores

V17

Analytics

CRM

---

Pergunta

Quanto custa?

Intent

price

Checkout

Permitido

Origem

Contrato Comercial

---

Toda alteração deverá informar explicitamente sua Source of Truth.