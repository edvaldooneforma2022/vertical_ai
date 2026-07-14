# CONTRIBUTING.md

# Guia de Contribuição

**Projeto:** Link Mágico

Versão: 1.0

---

# Objetivo

Este documento define as regras obrigatórias para qualquer contribuição ao Link Mágico.

Aplica-se igualmente a:

* Desenvolvedores internos
* Desenvolvedores externos
* Freelancers
* Consultores
* GitHub Copilot
* ChatGPT
* Claude
* Cursor
* Windsurf
* Qualquer outro agente de IA

---

# Regra Absoluta

> **Nenhuma linha de código pode ser alterada antes da compreensão da arquitetura.**

---

# Antes de contribuir

É obrigatório concluir o seguinte processo:

✅ Ler `README.md`

✅ Ler `ONBOARDING.md`

✅ Ler toda a pasta `governance/`

✅ Ler a documentação técnica em `docs/`

---

# Filosofia do Projeto

O Link Mágico prioriza:

* Arquitetura
* Estabilidade
* Governança
* Clareza
* Baixo acoplamento
* Responsabilidade única
* Evolução incremental

Não prioriza:

* Velocidade de implementação
* Gambiarras
* Soluções temporárias permanentes
* Correções sem investigação

---

# Fluxo obrigatório para qualquer alteração

## 1. Entender o problema

Antes de abrir qualquer arquivo, responda:

* Qual é o comportamento esperado?
* Qual é o comportamento atual?
* Existe documentação?
* Existe ADR?
* Existe contrato arquitetural?

---

## 2. Confirmar autoridade

Pergunte:

* Quem é o dono desta responsabilidade?
* Quem apenas consome?
* Quem apenas valida?
* Quem apenas observa?

Se houver dúvida:

**Pare.**

Investigue antes de modificar código.

---

## 3. Mapear impacto

Identifique:

* Consumidores
* Dependências
* Rotas
* Integrações
* Feature Flags
* Possíveis regressões

---

## 4. Planejar rollback

Toda alteração deve possuir rollback definido.

---

## 5. Implementar

As alterações devem ser:

* Pequenas
* Isoladas
* Incrementais
* Reversíveis

---

## 6. Executar testes

Antes e depois da alteração:

* Chat
* Widget
* WhatsApp
* Checkout
* CRM
* Scheduler
* Analytics
* Captura de Leads

Seguir obrigatoriamente o `22_REGRESSION_PLAYBOOK.md`.

---

# Regras para Pull Requests

Todo Pull Request deve conter:

## Objetivo

O que está sendo alterado?

---

## Responsabilidade

Qual responsabilidade está sendo modificada?

---

## Autoridade

Quem é o dono dessa responsabilidade?

---

## Consumidores

Quem depende dessa decisão?

---

## Contrato

Existe contrato arquitetural relacionado?

---

## ADR

Existe registro da decisão?

---

## Testes

Quais testes foram executados?

---

## Rollback

Como desfazer esta alteração?

---

# Regras de Código

Sempre:

* Preferir simplicidade
* Reutilizar código existente
* Evitar duplicação
* Documentar decisões importantes
* Respeitar contratos arquiteturais

Nunca:

* Criar segunda autoridade
* Duplicar responsabilidades
* Criar atalhos
* Ignorar governança
* Alterar comportamento silenciosamente

---

# Feature Flags

Toda nova Feature Flag deve possuir:

* Nome claro
* Objetivo
* Responsável
* Data de criação
* Plano de remoção
* Plano de rollback

Feature Flags não substituem arquitetura.

---

# Commits

Os commits devem ser pequenos e objetivos.

Exemplos:

```
FIX-021 Corrige classificação de intent "price"

FIX-034 Remove duplicação de CTA

REF-011 Centraliza resolução de checkout

DOC-008 Atualiza contrato arquitetural
```

Evitar commits genéricos:

```
fix

update

ajustes

mudanças

teste
```

---

# Princípios de Engenharia

Antes de alterar qualquer código, pergunte:

* Estou preservando a arquitetura?
* Estou criando uma nova responsabilidade?
* Estou criando uma segunda autoridade?
* Estou reduzindo ou aumentando a complexidade?
* Existe uma solução mais simples?

---

# Revisão de Código

Todo código deve ser revisado considerando:

* Arquitetura
* Governança
* Contratos
* Regressões
* Segurança
* Performance
* Clareza

A revisão não deve focar apenas na sintaxe.

---

# Quando NÃO alterar código

Não altere código quando:

* A autoridade não estiver clara.
* O comportamento esperado não estiver documentado.
* O impacto não puder ser medido.
* Não existir rollback.
* Não houver testes suficientes.

---

# Cultura da Equipe

No Link Mágico acreditamos que:

Uma alteração pequena e segura vale mais do que uma grande alteração cheia de riscos.

A estabilidade do sistema é mais importante do que a velocidade da entrega.

A arquitetura é um ativo estratégico e deve ser preservada continuamente.

Todo desenvolvedor é responsável por manter essa arquitetura saudável para as próximas evoluções do produto.
