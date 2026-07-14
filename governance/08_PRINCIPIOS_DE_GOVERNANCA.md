# 08_PRINCIPIOS_DE_GOVERNANCA.md

# Princípios de Governança Arquitetural

Versão: 1.0

Status: Documento Normativo

Tipo: Governança

---

# Objetivo

Este documento estabelece os princípios obrigatórios para evolução do Link Mágico.

Seu propósito é garantir que toda alteração preserve:

- estabilidade;
- previsibilidade;
- compatibilidade;
- rastreabilidade;
- segurança arquitetural.

Os princípios aqui definidos devem orientar todas as decisões técnicas do projeto.

---

# Escopo

Aplica-se a:

- desenvolvimento;
- revisão de código;
- auditorias;
- refatorações;
- correções de bugs;
- novas funcionalidades;
- uso de Inteligência Artificial;
- documentação.

---

# Princípio 1

# Arquitetura Antes do Código

Toda alteração deverá começar pela compreensão da arquitetura.

Nunca modificar código antes de compreender:

- pipeline envolvido;
- responsabilidade;
- autoridade;
- impacto.

---

## Regra

A implementação é consequência da arquitetura.

Nunca o contrário.

---

# Princípio 2

# Responsabilidade Única

Cada responsabilidade deve possuir apenas uma autoridade.

Exemplos:

- intenção;
- CTA;
- checkout;
- links;
- extração;
- lead capture.

Caso dois módulos executem a mesma responsabilidade, existe dívida arquitetural.

---

# Princípio 3

# Single Source of Truth

Cada informação deverá possuir apenas uma origem oficial.

Exemplos:

Intent

↓

V17

---

CTA

↓

V19

---

Checkout

↓

Checkout Authority

---

Links

↓

Link Resolver

---

Nenhum módulo poderá criar versões paralelas da mesma informação.

---

# Princípio 4

# Separação entre Decisão e Validação

Decidir e validar são responsabilidades diferentes.

## Decisão

Cria regras.

Define comportamento.

---

## Validação

Confirma consistência.

Impede estados inválidos.

Nunca cria novas decisões.

---

# Princípio 5

# Compatibilidade

Toda alteração deve preservar obrigatoriamente:

- Widget Inline;
- Widget Fullscreen;
- WhatsApp;
- CRM;
- Billing;
- Scheduler;
- Multi Tenant;
- Analytics;
- Login;
- Backup;
- APIs públicas.

Compatibilidade é requisito arquitetural.

---

# Princípio 6

# Evolução Incremental

Mudanças deverão ser pequenas.

Grandes refatorações são proibidas.

Toda evolução deve ser:

- incremental;
- reversível;
- testável.

---

# Princípio 7

# Feature Flags

Toda alteração significativa deverá possuir Feature Flag.

Objetivos:

- rollout gradual;
- rollback;
- testes;
- comparação.

Feature Flags controlam implementações.

Nunca alteram contratos arquiteturais.

---

# Princípio 8

# Shadow Mode

Sempre que um novo motor substituir outro:

Primeiro:

executar em Shadow.

Depois:

comparar resultados.

Somente então:

ativar produção.

---

Fluxo recomendado:

Motor Atual

↓

Resposta Oficial

---

Novo Motor

↓

Shadow

↓

Logs

↓

Diferenças

↓

Validação

---

# Princípio 9

# Não Criar Segunda Autoridade

Antes de qualquer alteração perguntar:

Esta funcionalidade já possui uma autoridade?

Se a resposta for sim:

o novo código deverá consumir essa decisão.

Nunca criar uma segunda autoridade.

---

# Princípio 10

# Consumidores Não Decidem

Consumidores apenas utilizam decisões.

Nunca modificam:

- intenção;
- CTA;
- checkout;
- links;
- buyer stage.

---

# Princípio 11

# Validadores Não Alteram Negócio

Validadores podem:

✔ impedir estados inválidos

✔ validar

✔ registrar erros

---

Validadores nunca podem:

✘ criar CTA

✘ alterar checkout

✘ mudar intenção

✘ mudar estratégia

---

# Princípio 12

# Observadores Não Interferem

Analytics.

Learning.

Logs.

Auditoria.

Nunca alteram comportamento.

Seu papel é exclusivamente observacional.

---

# Princípio 13

# Documentação é Parte do Código

Nenhuma alteração arquitetural será considerada concluída sem atualização da documentação.

Sempre atualizar:

- Estado Atual;
- Diagnóstico;
- Matriz de Autoridade;
- Contratos;
- Roadmap;
- Matriz de Confiança.

---

# Princípio 14

# Evidência Antes da Conclusão

Nenhuma conclusão poderá ser considerada fato sem evidência.

Fontes aceitas:

- código-fonte;
- documentação oficial;
- logs;
- testes;
- auditoria dinâmica.

Caso contrário:

classificar como hipótese.

---

# Princípio 15

# Auditoria Antes da Refatoração

Antes de remover código:

identificar:

- responsabilidade;
- consumidores;
- dependências;
- Feature Flags;
- impacto.

Nunca remover código apenas porque parece redundante.

---

# Princípio 16

# Pequenos Commits

Cada commit deve possuir:

- objetivo único;
- escopo reduzido;
- rollback simples.

Evitar commits que alterem múltiplos pipelines simultaneamente.

---

# Princípio 17

# Logs Estruturados

Toda decisão crítica deverá gerar logs estruturados.

Exemplos:

Intent

CTA

Checkout

Buyer Stage

Extração

Lead Capture

Feature Flags

Esses logs devem permitir reconstruir o pipeline de decisão.

---

# Princípio 18

# Rollback Obrigatório

Toda alteração arquitetural deverá possuir estratégia de rollback.

Se não existir rollback:

a alteração não está pronta para produção.

---

# Princípio 19

# Testes Antes da Produção

Toda alteração deverá ser validada por:

- testes automatizados;
- validação manual;
- comparação de comportamento;
- análise de logs.

---

# Princípio 20

# Governança Permanente

A arquitetura nunca deve ser considerada concluída.

Ela deve evoluir continuamente.

Cada nova funcionalidade deverá reduzir:

- duplicações;
- acoplamento;
- sobreposição;
- regressões.

Nunca aumentar esses fatores.

---

# Fluxo Oficial de Mudança

Toda alteração deverá seguir obrigatoriamente o fluxo abaixo.

```mermaid
flowchart TD

Problema

--> Auditoria

--> Estado Atual

--> Diagnóstico

--> Autoridade

--> Contratos

--> Impacto

--> Aprovação

--> Implementação

--> Shadow

--> Testes

--> Rollback Validado

--> Produção

--> Atualização da Documentação
```

---

# Perguntas Obrigatórias

Antes de qualquer alteração responder:

- Qual responsabilidade será alterada?
- Quem é a autoridade?
- Existe outra autoridade?
- O comportamento atual está documentado?
- Existe Feature Flag?
- Existe Shadow Mode?
- Existe rollback?
- Existe teste?
- Existe impacto em outro pipeline?
- A documentação será atualizada?

Se qualquer resposta for negativa, a alteração deve ser reavaliada.

---

# Critérios de Aceitação

Uma alteração arquitetural somente poderá ser considerada concluída quando:

- respeitar todos os contratos arquiteturais;
- preservar compatibilidade;
- possuir rollback;
- possuir testes;
- possuir documentação atualizada;
- não introduzir nova autoridade;
- não aumentar o acoplamento.

---

# Relação com os Demais Documentos

Este documento complementa:

- 00_ARQUITETURA_GOVERNANCA.md
- 03_MATRIZ_DE_AUTORIDADE.md
- 04_CONTRATOS_ARQUITETURAIS.md
- 05_ROADMAP_DE_MIGRACAO.md
- 07_MATRIZ_DE_CONFIANCA.md

Ele estabelece os princípios que orientam a aplicação prática desses documentos.

---

# Cláusula Final

Os Princípios de Governança constituem as regras permanentes de evolução do Link Mágico.

Eles não substituem decisões técnicas, mas estabelecem os limites dentro dos quais essas decisões devem ocorrer.

Toda alteração que viole um ou mais princípios deverá ser considerada uma exceção arquitetural, exigindo justificativa formal, análise de impacto e aprovação antes de sua implementação.

O objetivo final desta governança é garantir que a plataforma evolua de forma previsível, auditável, incremental e sustentável, reduzindo continuamente o risco de regressões e preservando a estabilidade operacional do sistema.
```

---

## Minha avaliação

Dos nove documentos produzidos até agora, este é o que mais se aproxima de um **"Engineering Handbook"** usado por empresas como Google, Microsoft ou Amazon. Ele não depende da tecnologia utilizada nem das versões V17, V18 ou V19; estabelece princípios que continuam válidos mesmo que esses motores sejam substituídos no futuro.

Há apenas um aprimoramento que eu faria em uma versão 2.0: adicionar um **Princípio 21 — Governança por ADR (Architecture Decision Record)**. Toda decisão arquitetural relevante passaria a gerar um ADR numerado, contendo contexto, alternativas avaliadas, decisão tomada, consequências e data de aprovação. Isso criaria um histórico rastreável da evolução da arquitetura e reduziria ainda mais o risco de futuras interpretações equivocadas.