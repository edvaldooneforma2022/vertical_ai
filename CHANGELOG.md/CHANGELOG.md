# Changelog — Link Mágico

Todas as alterações importantes deste projeto devem ser registradas neste documento.

Este projeto segue o princípio de **Evolução Controlada**.

Uma alteração só pode ser considerada concluída quando:

- código foi implementado;
- regressões foram verificadas;
- documentação foi atualizada;
- impacto arquitetural foi registrado.

---

# Versionamento

Seguimos:

MAJOR.MINOR.PATCH

Exemplos

7.0.0
7.1.0
7.1.1

ou

V17.0
V17.1
V18
V19
V21

quando a mudança representar uma engine interna.

---

# Tipos de alteração

Cada item deve possuir uma categoria.

### Added

Nova funcionalidade.

---

### Changed

Mudança de comportamento.

---

### Fixed

Correção de bug.

---

### Security

Correções de segurança.

---

### Performance

Melhorias de desempenho.

---

### Refactor

Refatoração sem alteração funcional.

---

### Docs

Alterações apenas em documentação.

---

### Governance

Mudanças em governança, arquitetura ou contratos.

---

# Template obrigatório

## [Versão]

Data:

### Added

-

### Changed

-

### Fixed

-

### Performance

-

### Security

-

### Refactor

-

### Governance

-

### Impacto

Componentes afetados:

-

Risco:

Baixo
Médio
Alto

Regressão executada?

☐ Sim

☐ Não

Documento ADR relacionado:

ADR-00X

---

# Histórico

## V22.1

### Added

- Agendamento conversacional via WhatsApp.

### Fixed

- Melhorias na estabilidade do Scheduler.

---

## V21.2

### Fixed

- Hardening do pipeline de CTA.

---

## V21.1

### Fixed

- Ajustes de escopo de intent.

---

## V19

### Added

- Engine determinística V19.

---

## V18

### Added

- Extraction Guard.

---

## V17

### Added

- Unified Brain.

---

## V16

### Added

- Decision Engine determinística.

---

## V13

### Added

- Intent Classifier.

---

# Regras obrigatórias

Nunca apagar histórico.

Nunca editar versões antigas.

Nunca alterar datas.

Nunca reescrever decisões.

Correções posteriores devem gerar nova entrada.

---

# Integração com ADR

Toda alteração arquitetural importante deve possuir:

- CHANGELOG

e

- ADR correspondente.

Exemplo

CHANGELOG

V22.2

Fixed

Corrigido conflito de autoridade entre V17 e Decision Core.

↓

ADR-021

Decisão:

V17 passa a ser autoridade única sobre Intent.

---

# Integração com Governança

Antes de adicionar qualquer item neste arquivo é obrigatório verificar:

governance/

01_ENGINEERING_CONSTITUTION.md

02_ARCHITECTURE_AUTHORITY.md

03_PERMISSION_MATRIX.md

04_DECISION_PIPELINE.md

05_CHANGE_IMPACT_PLAYBOOK.md

...

---

# Objetivo

O CHANGELOG existe para responder rapidamente:

O que mudou?

Quando mudou?

Quem mudou?

Por que mudou?

Qual decisão arquitetural justificou a mudança?

Quais módulos foram impactados?

Qual risco existia?

Quais testes de regressão foram executados?