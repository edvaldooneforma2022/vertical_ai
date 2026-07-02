# 10_TAXONOMIA_OFICIAL_DE_INTENTS.md

> **Status:** Documento de Governança Arquitetural
>
> **Classificação:** Contrato Arquitetural (Estado AS-IS + Taxonomia Canônica de Referência)
>
> **Versão:** 1.0
>
> **Objetivo:** Definir a linguagem semântica oficial utilizada pelo Link Mágico para representar intenções, estados comerciais, estados operacionais e estados de CTA, reduzindo ambiguidades e estabelecendo uma referência única para futuras evoluções arquiteturais.

---

# 1. Objetivo

Este documento estabelece a taxonomia oficial utilizada pelo Link Mágico para representar os diversos estados cognitivos, comerciais e operacionais identificados durante o processamento de uma conversa.

O objetivo **não é alterar o comportamento atual do sistema**.

Seu propósito é:

* documentar a arquitetura existente (AS-IS);
* identificar equivalências semânticas;
* reduzir ambiguidades entre módulos;
* criar uma linguagem comum para documentação;
* servir de base para futuras migrações.

---

# 2. Escopo

Este documento abrange:

* Decision Core
* V17
* V18
* V19
* Sales Layer
* CTA Engine
* Closing Scripts
* Link Resolver
* Checkout Authority
* Analytics
* Lead Capture
* Orchestrator

Não define implementação.

Não altera código.

Não modifica Feature Flags.

Não substitui contratos arquiteturais.

---

# 3. Princípios

A taxonomia deve obedecer aos seguintes princípios:

## 3.1 Um conceito representa apenas um significado

Exemplo:

```
buy
```

Sempre representa intenção explícita de compra.

Jamais deverá significar:

* curiosidade
* interesse
* dúvida

---

## 3.2 Um mesmo conceito pode possuir representações históricas

Exemplo:

```
buy
comprar
ready_to_buy
```

Representam o mesmo conceito de negócio.

Porém pertencem a domínios diferentes.

---

## 3.3 Traduções devem ser explícitas

É proibido criar conversões implícitas espalhadas pelo código.

Toda tradução deverá estar documentada.

---

## 3.4 A documentação não altera o sistema

Este documento descreve o estado observado.

Não determina comportamento de produção.

---

# 4. Domínios Semânticos

Durante a auditoria arquitetural foram identificados quatro domínios principais.

## 4.1 Intenção Conversacional

Representa o objetivo imediato do usuário.

Exemplos:

```
buy
support
objection
explain
info
neutral
```

---

## 4.2 Estado Comercial

Representa o estágio comercial percebido.

Exemplos:

```
interest

ready_to_buy

hesitation

curiosity
```

---

## 4.3 Estado Operacional

Representa problemas técnicos ou operacionais.

Exemplos:

```
checkout_issue

link_broken
```

---

## 4.4 Estado de CTA

Representa qual estratégia de CTA deve ser utilizada.

Exemplos:

```
ready_to_buy

interest

curiosity

hesitation

exit
```

---

# 5. Inventário Completo de Intents

## Decision Core

```
checkout_issue
human
objection
post_sale
buy
explain
info
interest
stress
neutral
```

---

## V17

```
buy
support
price
link_request
guarantee
info
explain
exit
objection
```

---

## V17 Link Resolver

```
buy
price_strong
price_objection
support
link_request
link_broken
info
explain
```

---

## V19

```
buy
support
price
neutral
objection
confusion
exit
```

---

## Sales Decision Engine

```
comprar
duvida
objecao
curioso
sair
```

---

## CTA Engine

```
ready_to_buy
interest
objection
hesitation
exit
curiosity
```

---

## Closing Scripts

```
ready_to_buy
interest
objection
hesitation
exit
curiosity
```

---

# 6. Conceitos Canônicos

Esta seção define o conceito arquitetural utilizado como referência documental.

Importante:

Isto **não significa** que o código atual utilize exclusivamente esses nomes.

| Conceito          | Nome Canônico  |
| ----------------- | -------------- |
| Compra            | buy            |
| Explicação        | explain        |
| Informação        | info           |
| Interesse         | interest       |
| Objeção           | objection      |
| Suporte           | support        |
| Problema Checkout | checkout_issue |
| Saída             | exit           |
| Garantia          | guarantee      |
| Confusão          | confusion      |
| Pós-venda         | post_sale      |

---

# 7. Equivalências Semânticas

## Compra

```
buy

comprar

ready_to_buy
```

Mesmo conceito.

Domínios diferentes.

---

## Explicação

```
explain

duvida

curioso

curiosity
```

Representam estados próximos.

Nem sempre equivalentes operacionalmente.

---

## Objeção

```
objection

objecao

price_objection
```

---

## Suporte

```
support

human
```

---

## Problema Checkout

```
checkout_issue

link_broken
```

---

## Interesse

```
interest

curiosity
```

Dependem do domínio.

---

# 8. Matriz Geral

| Conceito   | Decision Core  | V17       | V19       | Sales   | CTA          |
| ---------- | -------------- | --------- | --------- | ------- | ------------ |
| Compra     | buy            | buy       | buy       | comprar | ready_to_buy |
| Explicação | explain        | explain   | —         | duvida  | curiosity    |
| Informação | info           | info      | —         | duvida  | interest     |
| Objeção    | objection      | objection | objection | objecao | objection    |
| Suporte    | human          | support   | support   | —       | support      |
| Interesse  | interest       | —         | —         | curioso | interest     |
| Saída      | —              | exit      | exit      | sair    | exit         |
| Checkout   | checkout_issue | —         | —         | —       | —            |

---

# 9. Traduções Implícitas Identificadas

Durante a auditoria foram encontradas diversas traduções implícitas.

Exemplos:

```
comprar

↓

buy
```

---

```
buy

↓

ready_to_buy
```

---

```
duvida

↓

explain
```

---

```
curioso

↓

curiosity
```

---

```
support

↓

human
```

---

```
checkout_issue

↓

link_broken
```

Essas traduções representam dívida arquitetural.

---

# 10. Conflitos Semânticos

## Explain × Curioso

Mesmo significado em alguns fluxos.

Nomes diferentes.

---

## Human × Support

Mesmo conceito.

Dois nomes.

---

## Buy × Comprar × Ready_to_buy

Mesmo conceito.

Três domínios.

---

## Price × Price Strong

Preço pode significar:

* curiosidade
* compra
* objeção

Dependendo do módulo.

---

## Checkout Issue × Link Broken

Mesmo problema.

Representações distintas.

---

# 11. Fragmentação da Taxonomia

Foi identificado o seguinte padrão.

```
Decision Core

↓

explain

↓

Sales

↓

duvida

↓

CTA

↓

curiosity
```

Embora semanticamente semelhantes, representam camadas distintas.

Essa fragmentação aumenta:

* complexidade;
* retrabalho;
* regressões;
* necessidade de tradutores.

---

# 12. Diagnóstico Arquitetural

## DA-004 — Fragmentação da Taxonomia de Intents

Foi identificado que múltiplos módulos representam conceitos equivalentes utilizando nomenclaturas diferentes.

Consequências:

* aumento da complexidade;
* dificuldade de manutenção;
* traduções implícitas;
* divergências entre motores;
* maior risco de regressões.

---

# 13. Diretrizes de Governança

Toda nova intent deverá responder:

1. Qual conceito representa?

2. Já existe conceito equivalente?

3. Em qual domínio pertence?

4. Qual módulo será autoridade?

5. Quem apenas consumirá essa informação?

---

# 14. Regras para Novas Intents

É proibido:

* criar sinônimos desnecessários;
* reutilizar nomes existentes com outro significado;
* alterar significado histórico sem documentação.

É obrigatório:

* registrar neste documento;
* atualizar a Matriz de Autoridade;
* atualizar os Contratos Arquiteturais;
* atualizar o Glossário.

---

# 15. Roadmap de Convergência

Este documento não propõe alterações imediatas.

Como direção futura, recomenda-se:

1. eliminar traduções implícitas;
2. centralizar mapeamentos;
3. reduzir sinônimos;
4. utilizar uma taxonomia única por domínio;
5. documentar qualquer exceção.

---

# 16. Relação com Outros Documentos

Este documento complementa:

* 00_ARQUITETURA_GOVERNANCA.md
* 01_ESTADO_ATUAL_AS_IS.md
* 02_DIAGNOSTICO_ARQUITETURAL.md
* 03_MATRIZ_DE_AUTORIDADE.md
* 04_CONTRATOS_ARQUITETURAIS.md
* 06_GLOSSARIO.md
* 07_MATRIZ_DE_CONFIANCA.md
* 08_PRINCIPIOS_DE_GOVERNANCA.md

---

# 17. Conclusão

A auditoria arquitetural demonstrou que o Link Mágico evoluiu ao longo de diversas versões, resultando em múltiplas taxonomias para representar conceitos semelhantes.

Essa fragmentação não caracteriza, por si só, um erro de implementação. Trata-se de uma consequência natural da evolução incremental do sistema.

Este documento estabelece uma referência semântica comum para toda a documentação arquitetural do projeto. Ele não altera o comportamento do software, não modifica Feature Flags e não redefine autoridades de execução. Seu papel é servir como linguagem oficial de documentação, reduzindo ambiguidades e facilitando futuras análises, auditorias e processos de migração arquitetural.

---

# 18. Normalização de Fronteira Implementada (Task 01)

## Alteração

Implementada normalização automática na fronteira entre o Sales Pipeline (PT) e o V17 Pipeline (EN) em `server.js`.

Aplica-se SOMENTE à variável `_v21ResolvedIntent` quando a fonte é `inteligencias`.

## Mapa (SALES_TO_V17_INTENT_MAP)

| Sales (PT) | V17 (EN) |
|------------|----------|
| `comprar`  | `buy`    |
| `objecao`  | `objection` |
| `sair`     | `exit`   |
| `curioso`  | `interest` |
| `duvida`   | `explain` |

## Feature Flag

`FEATURE_TAXONOMY_NORMALIZATION` — default `true`.

## Não Altera

- Sales Pipeline interno
- CTA_BANK keys
- Prompts, checkout, regex
- Decision Core, V17, V19, Link Resolver

## Diagnóstico Resolvido

DA-004 (parcial) — Vazamento de intents PT no domínio V17.

## NON-GOALS

Esta task não resolve: `support × human`, `buy × comprar × ready_to_buy`, `link_request`, `price / price_strong / price_objection`, `checkout_issue × link_broken`.

