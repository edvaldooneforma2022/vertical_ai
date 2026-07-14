# Link Mágico V7/V8
# ARCHITECTURE.md

> Documento mestre da arquitetura do sistema.
>
> Antes de alterar qualquer linha de código, leia este documento integralmente.

---

# Objetivo da Plataforma

O Link Mágico NÃO é apenas um chatbot.

É uma plataforma SaaS multi-tenant composta por diversos subsistemas integrados que trabalham em conjunto para transformar páginas em vendedores automáticos inteligentes.

A arquitetura foi construída ao longo de centenas de evoluções e hoje possui dezenas de motores especializados.

A prioridade absoluta é:

**Preservar estabilidade.**

Toda evolução deve ser incremental.

Nunca disruptiva.

---

# Visão Geral

A plataforma possui diversos subsistemas independentes.

## CRM

Responsável por:

- Leads
- Pipeline
- Histórico
- Conversas
- Agendamentos
- Follow-up

---

## IA Conversacional

Responsável por:

- entendimento
- intenção
- estratégia
- vendas
- respostas

Não é responsável por:

- checkout
- links
- widgets
- tenancy
- billing

---

## Extração Inteligente

Responsável por:

- Crawl
- RAG
- Conteúdo
- FAQ
- Produtos
- WhatsApp
- Checkout
- Links

---

## Widget

Responsável por:

- Interface
- Captura
- UX

Nunca deve decidir vendas.

---

## WhatsApp

Responsável apenas por transporte.

Nunca decide estratégia.

---

## Billing

Responsável por:

- planos
- pagamentos
- limites
- assinaturas

Nunca interfere na IA.

---

# Arquitetura Geral

```
Cliente

↓

Widget
WhatsApp
Link Curto

↓

Server

↓

Pipeline Conversacional

↓

Motores Especializados

↓

Resposta

↓

CRM
Analytics
Learning
```

---

# Filosofia

A arquitetura segue o princípio:

## Uma responsabilidade

↓

Um dono

↓

Uma autoridade

↓

Múltiplos consumidores

Jamais o contrário.

---

# Autoridades Oficiais

Consulte:

```
docs/governance/
ARCHITECTURE_AUTHORITY.md
```

Somente aquele documento define quem possui autoridade sobre cada responsabilidade.

Caso exista conflito entre documentos:

ARCHITECTURE_AUTHORITY.md prevalece.

---

# Contratos Arquiteturais

Os contratos encontram-se em:

```
docs/governance/
ARCHITECTURE_AUTHORITY.md
```

Nenhum desenvolvedor pode criar um segundo ponto de decisão para uma responsabilidade já existente.

---

# Princípios Fundamentais

Toda alteração deve obedecer:

- Engineering Constitution
- Code Ownership
- Regression Playbook
- ADRs

---

# Pipeline

O pipeline deve permanecer previsível.

Cada módulo possui apenas uma função.

Exemplo:

```
Entrada

↓

Extração

↓

Intent

↓

Estratégia

↓

CTA

↓

Checkout

↓

Resposta

↓

Persistência
```

Nenhum módulo pode "voltar" etapas anteriores.

---

# Responsabilidades

Consulte:

```
23_CODE_OWNERSHIP_MATRIX.md
```

---

# Decisões Arquiteturais

Toda decisão importante deve possuir um ADR.

Consulte:

```
21_DECISION_RECORDS.md
```

---

# Testes Obrigatórios

Nenhuma alteração pode ser aprovada sem executar:

```
22_REGRESSION_PLAYBOOK.md
```

---

# Princípio da Não Regressão

Toda melhoria deve preservar:

✓ Widget

✓ WhatsApp

✓ Link Curto

✓ CRM

✓ Billing

✓ Multi-tenancy

✓ Analytics

✓ Scheduler

✓ Extração

✓ CTA

✓ Checkout

---

# Multi-tenancy

Jamais acessar:

Tenant A

↓

dados do

↓

Tenant B

Toda alteração deve preservar isolamento completo.

---

# Feature Flags

Toda funcionalidade nova deve nascer atrás de Feature Flag.

Nunca substituir comportamento consolidado diretamente.

---

# Alterações Permitidas

É permitido:

- otimizar

- simplificar

- documentar

- corrigir

desde que:

não alterem contratos arquiteturais.

---

# Alterações Proibidas

É proibido:

- duplicar lógica

- duplicar autoridade

- mover responsabilidades entre motores

- alterar pipeline sem ADR

- remover fallback

- alterar ordem do pipeline sem aprovação

---

# Fluxo para qualquer alteração

1.

Ler:

```
README.md
```

↓

2.

Ler:

```
CONTRIBUTING.md
```

↓

3.

Ler:

```
ONBOARDING.md
```

↓

4.

Ler:

```
docs/governance/
```

↓

5.

Confirmar autoridade.

↓

6.

Confirmar consumidores.

↓

7.

Executar alteração.

↓

8.

Executar Regression Playbook.

↓

9.

Registrar ADR (se necessário).

---

# Ordem de Leitura Obrigatória

Todo novo desenvolvedor deve ler nesta ordem:

1.
README.md

2.
ARCHITECTURE.md

3.
CONTRIBUTING.md

4.
ONBOARDING.md

5.
docs/governance/
ENGINEERING_CONSTITUTION.md

6.
ARCHITECTURE_AUTHORITY.md

7.
23_CODE_OWNERSHIP_MATRIX.md

8.
22_REGRESSION_PLAYBOOK.md

9.
21_DECISION_RECORDS.md

---

# Objetivo Final

O objetivo desta arquitetura é garantir que:

- nenhuma funcionalidade seja quebrada;

- nenhuma responsabilidade seja duplicada;

- nenhuma decisão seja tomada por mais de um motor;

- toda evolução preserve estabilidade;

- o sistema permaneça previsível mesmo após centenas de novas versões.

Toda alteração deve fortalecer a arquitetura, nunca aumentar sua complexidade.