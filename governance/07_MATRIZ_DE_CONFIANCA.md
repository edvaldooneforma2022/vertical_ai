# 07_MATRIZ_DE_CONFIANCA.md

# Matriz de Confiança Arquitetural

Versão: 1.0

Status: Governança

Tipo: Evidência

---

# Objetivo

Este documento estabelece o nível de confiança das informações utilizadas na documentação arquitetural do Link Mágico.

Seu objetivo é garantir que toda afirmação técnica seja claramente classificada de acordo com as evidências disponíveis.

A Matriz de Confiança evita que:

- hipóteses sejam tratadas como fatos;
- propostas sejam confundidas com implementações;
- conclusões parciais sejam incorporadas como arquitetura oficial.

---

# Princípio Fundamental

Nenhuma conclusão arquitetural deverá ser considerada parte do Estado Atual (AS-IS) sem evidência objetiva.

Toda afirmação deverá possuir:

- classificação;
- nível de confiança;
- fonte de evidência;
- data da validação;
- responsável pela validação (quando aplicável).

---

# Níveis de Confiança

## 🟢 Alta

Representa informações confirmadas por evidências objetivas.

Critérios:

- inspeção do código-fonte;
- documentação oficial;
- execução dinâmica;
- logs;
- testes automatizados.

Uma informação com confiança alta pode ser utilizada como referência oficial da arquitetura.

---

## 🟡 Média

Representa informações fortemente suportadas por evidências, porém ainda sem confirmação completa.

Critérios:

- documentação parcial;
- análise estática;
- comportamento observado;
- histórico consistente.

Essas informações devem ser tratadas como altamente prováveis, mas ainda sujeitas à validação.

---

## 🟠 Baixa

Representa hipóteses técnicas.

Critérios:

- inferências;
- engenharia reversa;
- comportamento indireto;
- ausência de confirmação objetiva.

Não devem orientar decisões arquiteturais sem validação adicional.

---

## 🔵 Proposta

Representa decisões futuras.

Não descreve comportamento existente.

Inclui:

- contratos;
- arquitetura alvo;
- roadmap;
- governança futura.

Nunca deve ser confundida com o estado atual do sistema.

---

# Fontes de Evidência

Toda classificação deverá indicar pelo menos uma das seguintes fontes.

## Código-Fonte

Maior nível de confiabilidade.

Exemplos:

- implementação;
- chamadas;
- dependências;
- pipelines.

Peso:

★★★★★

---

## Documentação Oficial

Documentação presente no repositório.

Exemplos:

- doc/
- diagramas
- especificações
- mapas arquiteturais

Peso:

★★★★☆

---

## Logs

Execução real do sistema.

Exemplos:

- V17
- V18
- V19
- Decision Core

Peso:

★★★★☆

---

## Testes Automatizados

Confirmação por execução controlada.

Peso:

★★★★★

---

## Auditoria Dinâmica

Validação através da execução do pipeline.

Peso:

★★★★★

---

## Engenharia Reversa

Inferência baseada na análise do projeto.

Peso:

★★★☆☆

Necessita confirmação posterior.

---

# Critérios de Classificação

Uma afirmação será considerada oficial apenas quando atender pelo menos um dos critérios abaixo.

| Critério | Confiança |
|-----------|-----------|
| Código-fonte | 🟢 |
| Código + Logs | 🟢 |
| Código + Documentação | 🟢 |
| Logs + Testes | 🟢 |
| Apenas documentação | 🟡 |
| Apenas análise estática | 🟡 |
| Engenharia reversa | 🟠 |
| Suposição técnica | 🟠 |
| Arquitetura desejada | 🔵 |

---

# Matriz de Confiança

## Arquitetura Geral

| Item | Confiança | Evidência |
|------|-----------|-----------|
| Plataforma SaaS Multi Tenant | 🟢 | Código + Documentação |
| CRM integrado | 🟢 | Código |
| Widget Inline | 🟢 | Código |
| Widget Fullscreen | 🟢 | Código |
| WhatsApp | 🟢 | Código |
| Billing | 🟢 | Código |
| Scheduler | 🟢 | Código |
| Analytics | 🟢 | Código |

---

## Motores Arquiteturais

| Item | Confiança | Evidência |
|------|-----------|-----------|
| Existência do V17 | 🟢 | Código + Logs |
| Existência do V18 | 🟢 | Código |
| Existência do V19 | 🟢 | Código |
| Existência do V21 | 🟢 | Código |
| Coexistência de múltiplas versões | 🟢 | Código + Documentação |

---

## Pipelines

| Item | Confiança | Evidência |
|------|-----------|-----------|
| Pipeline Conversacional | 🟢 | Código |
| Pipeline Comercial | 🟡 | Engenharia Reversa + Documentação |
| Pipeline de Extração | 🟢 | Código |
| Pipeline de Checkout | 🟡 | Análise Estática |

---

## Responsabilidades

| Item | Confiança | Evidência |
|------|-----------|-----------|
| V17 participa da decisão conversacional | 🟢 | Código + Logs |
| V18 participa da extração | 🟢 | Código |
| V19 participa das decisões comerciais | 🟢 | Código |
| V21 participa do hardening | 🟢 | Código |

---

## Diagnóstico Arquitetural

| Item | Confiança | Evidência |
|------|-----------|-----------|
| Sobreposição de responsabilidades | 🟡 | Auditoria |
| Duplicação de decisões | 🟡 | Engenharia Reversa |
| Múltiplos resolvedores de links | 🟢 | Código |
| Múltiplos resolvedores de checkout | 🟢 | Código |
| Crescimento incremental da arquitetura | 🟢 | Histórico + Código |

---

## Hipóteses

Os itens abaixo ainda dependem de confirmação adicional.

| Hipótese | Confiança |
|-----------|-----------|
| Todo conflito de CTA decorre apenas da duplicação de autoridades | 🟠 |
| Todo conflito de checkout decorre apenas dos resolvedores paralelos | 🟠 |
| Todas as regressões possuem origem arquitetural | 🟠 |

Essas hipóteses deverão ser verificadas por testes e execução dinâmica.

---

## Arquitetura Alvo

Os itens abaixo representam propostas de evolução.

Não descrevem o comportamento atual.

| Item | Confiança |
|------|-----------|
| V17 como única autoridade de intenção | 🔵 |
| V19 como única autoridade de CTA | 🔵 |
| Checkout Authority como autoridade exclusiva | 🔵 |
| Link Resolver como resolvedor único | 🔵 |
| V21 apenas como validador | 🔵 |
| Autoridade única por responsabilidade | 🔵 |

---

# Processo de Validação

Toda nova conclusão deverá seguir o fluxo abaixo.

```mermaid
flowchart TD

Nova Evidência

--> Classificação

--> Validação

--> Revisão

--> Atualização da Matriz

--> Documentação
```

---

# Atualização da Confiança

Sempre que novas evidências forem obtidas, a classificação deverá ser revisada.

Exemplo:

🟠 Hipótese

↓

Teste Automatizado

↓

🟡 Média

↓

Logs

↓

🟢 Alta

---

# Regras Obrigatórias

Nenhum documento da arquitetura poderá:

- apresentar hipóteses como fatos;
- utilizar propostas como descrição do sistema atual;
- remover o nível de confiança de uma afirmação.

Toda informação técnica deverá indicar claramente sua classificação.

---

# Relação com os Demais Documentos

Esta matriz complementa:

- 01_ESTADO_ATUAL_AS_IS.md
- 02_DIAGNOSTICO_ARQUITETURAL.md
- 03_MATRIZ_DE_AUTORIDADE.md
- 04_CONTRATOS_ARQUITETURAIS.md
- 05_ROADMAP_DE_MIGRACAO.md

Ela define o grau de confiança de todas as informações utilizadas nesses documentos.

---

# Cláusula Final

A Matriz de Confiança constitui o mecanismo oficial de validação do conhecimento arquitetural do Link Mágico.

Seu objetivo é preservar a integridade técnica da documentação, garantindo que fatos, hipóteses e propostas permaneçam claramente separados.

Toda evolução futura da arquitetura deverá atualizar esta matriz sempre que novas evidências forem obtidas ou quando hipóteses forem confirmadas, refutadas ou substituídas.