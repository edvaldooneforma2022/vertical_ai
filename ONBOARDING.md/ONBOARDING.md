# ONBOARDING.md

# Bem-vindo ao Link Mágico

Se você está lendo este documento, significa que recebeu acesso ao repositório do Link Mágico.

Antes de escrever qualquer linha de código, existe uma regra absoluta:

> **Você deve compreender a arquitetura antes de modificar a arquitetura.**

O Link Mágico é um sistema SaaS de produção com múltiplos motores de decisão, pipelines determinísticos, extração de conteúdo, múltiplos canais (Widget, WhatsApp, Link Curto, Checkout) e dezenas de Feature Flags.

A maioria dos bugs históricos ocorreu porque desenvolvedores modificaram um módulo sem compreender os consumidores daquela responsabilidade.

Este projeto NÃO recompensa velocidade.

Este projeto recompensa estabilidade.

---

# Regra nº 1

**É proibido alterar código antes de concluir todo o processo de onboarding.**

---

# Ordem obrigatória de leitura

Leia exatamente nesta ordem.

## 1. Pasta governance/

Leia TODOS os documentos.

A ordem sugerida é:

00_ARQUITETURA_GOVERNANCA.md

01_ESTADO_ATUAL_AS_IS.md

02_DIAGNOSTICO_ARQUITETURAL.md

03_MATRIZ_DE_AUTORIDADE.md

04_CONTRATOS_ARQUITETURAIS.md

05_ROADMAP_DE_MIGRACAO.md

06_GLOSSARIO.md

07_MATRIZ_DE_CONFIANCA.md

08_PRINCIPIOS_DE_GOVERNANCA.md

09_CHECKLIST_DE_VALIDACAO.md

10_TAXONOMIA_DE_INTENCOES.md

11_MAPA_DE_PIPELINES.md

12_MAPA_DE_DECISOES.md

13_MODELO_DE_DOMINIOS.md

14_ARQUITETURA_ALVO.md

15_PRINCIPIO_ZERO.md

16_MATRIZ_DE_PERMISSOES.md

17_CONTRATOS_DE_AUTORIDADE.md

18_GOVERNANCA_DE_RESPONSABILIDADES.md

19_MATRIZ_DE_IMPACTO.md

20_VALIDACAO_DE_AUTORIDADE.md

21_DECISION_RECORDS.md

22_REGRESSION_PLAYBOOK.md

23_CODE_OWNERSHIP_MATRIX.md

24_ENGINEERING_CONSTITUTION.md

---

## 2. Pasta docs/

Depois leia a documentação técnica existente.

Prioridade máxima:

* CTA_ENGINE_MASTER_MAP
* DECISION_CORE_MASTER_MAP
* MATRIZ_DE_PROPRIEDADE
* CHANGE_IMPACT_PLAYBOOK
* POSTMORTEMS
* Documentação das Feature Flags
* Fluxos do Widget
* Fluxos WhatsApp
* Fluxos Checkout

---

## 3. Entender o pipeline completo

Você deve conseguir explicar de memória o fluxo abaixo:

Usuário

↓

Widget / WhatsApp

↓

Extração

↓

Contexto

↓

Intent

↓

Decision Engine

↓

CTA

↓

Checkout

↓

CRM

↓

Analytics

---

# O que você deve saber antes de programar

Você deve ser capaz de responder:

Quem decide Intent?

Quem decide CTA?

Quem decide Checkout?

Quem resolve Links?

Quem produz pageData?

Quem captura Leads?

Quem grava CRM?

Quem agenda?

Quem apenas consome decisões?

Quem apenas observa?

Quem possui autoridade?

---

# Fonte Oficial

Sempre considere esta prioridade:

1. ENGINEERING_CONSTITUTION.md
2. CONTRATOS_ARQUITETURAIS.md
3. MATRIZ_DE_AUTORIDADE.md
4. DECISION_RECORDS.md
5. Código

Se houver conflito entre código e documentação, registre a divergência.

Nunca assuma.

---

# Antes de alterar qualquer código

É obrigatório responder:

Qual responsabilidade será alterada?

Quem é o dono dessa responsabilidade?

Quem consome essa responsabilidade?

Existe Contrato Arquitetural?

Existe ADR?

Existe rollback?

Existe teste?

Existe Feature Flag?

Qual o impacto?

---

# Princípio Zero

Nenhuma correção pode ser feita antes da confirmação da autoridade daquela responsabilidade.

---

# Regra da Autoridade

Um módulo somente pode:

DECIDIR

VALIDAR

OBSERVAR

Nunca mais de uma dessas funções ao mesmo tempo.

---

# Regra da Responsabilidade Única

Cada responsabilidade possui apenas um dono.

Se dois módulos decidem a mesma coisa:

A arquitetura está incorreta.

---

# Feature Flags

Toda Feature Flag nova deve possuir:

Objetivo

Data

Autor

Plano de rollback

Condição de remoção

Documentação

---

# Pull Requests

Nenhum Pull Request será aceito sem responder:

O que mudou?

Por que mudou?

Quem autorizou essa mudança?

Qual contrato foi alterado?

Qual ADR registra essa decisão?

Quais consumidores foram avaliados?

Qual regressão foi testada?

Como desfazer?

---

# É proibido

❌ Corrigir bug sem identificar autoridade.

❌ Duplicar responsabilidade.

❌ Criar novo ponto de decisão.

❌ Ignorar contratos arquiteturais.

❌ Alterar Feature Flag sem documentação.

❌ Criar atalhos ("gambiarras").

❌ Alterar comportamento sem testes.

---

# O que esperamos de um desenvolvedor

Não esperamos quem programe mais rápido.

Esperamos quem:

Compreenda arquitetura.

Faça poucas alterações.

Gere poucas regressões.

Documente decisões.

Questione responsabilidades.

Preserve a estabilidade.

---

# Mentalidade

Sempre pergunte:

Quem é o dono desta responsabilidade?

Quem consome essa decisão?

Estou criando uma segunda autoridade?

Existe um contrato para isso?

Estou preservando a arquitetura?

---

# Missão

O objetivo do Link Mágico não é apenas funcionar.

O objetivo é permanecer estável durante anos, permitindo evolução contínua sem regressões.

Todo desenvolvedor é responsável por preservar essa arquitetura.

Antes de escrever código...

Entenda o sistema.

Depois melhore o sistema.

Nunca o contrário.
