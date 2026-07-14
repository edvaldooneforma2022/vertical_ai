# 06_GLOSSARIO.md

# Glossário Oficial da Arquitetura

Versão: 1.0

Status: Documento de Referência

Tipo: Glossário

---

# Objetivo

Este documento define a terminologia oficial utilizada na arquitetura do Link Mágico.

Seu objetivo é eliminar ambiguidades durante:

- desenvolvimento;
- auditorias;
- documentação;
- revisão de código;
- utilização de Inteligência Artificial.

Sempre que um termo aparecer na documentação oficial, seu significado deverá ser o descrito neste documento.

---

# Organização

Os termos estão agrupados por categoria.

- Arquitetura
- Pipeline
- Inteligência Artificial
- Comercial
- Infraestrutura
- Governança

---

# A

## Analytics

Módulo responsável exclusivamente pela coleta e análise de métricas da plataforma.

Não participa da tomada de decisões.

Classificação:

Observador.

---

## Arquitetura AS-IS

Representação fiel da arquitetura atualmente existente.

Baseia-se exclusivamente em:

- código;
- documentação;
- testes;
- logs.

Não contém propostas de evolução.

---

## Arquitetura TO-BE

Representação da arquitetura desejada.

Define contratos, responsabilidades e objetivos futuros.

Não representa necessariamente o comportamento atual da plataforma.

---

## Autoridade

Módulo oficialmente responsável por determinada responsabilidade arquitetural.

Uma autoridade possui permissão para:

- criar;
- alterar;
- remover;
- decidir.

Toda responsabilidade deve possuir apenas uma autoridade.

---

# B

## Billing

Sistema responsável pela gestão financeira da plataforma.

Inclui:

- planos;
- assinaturas;
- cobranças;
- limites.

---

## Buyer Stage

Estágio comercial do usuário durante o funil de vendas.

Exemplos:

- Descoberta
- Interesse
- Avaliação
- Decisão
- Compra

---

# C

## Canal

Meio pelo qual ocorre a conversa.

Exemplos:

- Widget
- WhatsApp
- Link Curto
- Fullscreen

---

## Checkout

Destino utilizado para conclusão da compra.

Pode representar:

- link de pagamento;
- página de vendas;
- checkout externo.

---

## Checkout Authority

Autoridade responsável pela seleção do checkout definitivo.

---

## Consumidor

Módulo que utiliza decisões produzidas por outro componente.

Nunca altera a decisão recebida.

---

## Contrato Arquitetural

Regra permanente que define responsabilidades e limites entre módulos.

---

## CTA (Call To Action)

Ação sugerida ao usuário durante a conversa.

Exemplos:

- Comprar
- Agendar
- Falar no WhatsApp
- Solicitar orçamento

---

# D

## Decision Core

Motor determinístico legado responsável por decisões comerciais.

Na arquitetura alvo, tende a atuar como consumidor das decisões da autoridade principal.

---

## Diagnóstico Arquitetural

Documento que registra problemas observados na arquitetura atual.

Não contém propostas de solução.

---

# E

## Estado Atual

Arquitetura efetivamente existente.

Sinônimo de AS-IS.

---

## Extração

Processo responsável por identificar informações relevantes em páginas e documentos.

Exemplos:

- checkout;
- WhatsApp;
- redes sociais;
- formulários;
- contexto.

---

# F

## Feature Flag

Mecanismo utilizado para ativar ou desativar funcionalidades sem alterar o código principal.

Permite:

- rollout gradual;
- testes;
- rollback;
- experimentação.

---

## Force Checkout

Camada responsável por garantir a existência de um checkout quando permitido pela arquitetura.

Não deve criar decisões comerciais.

---

## Fallback

Comportamento alternativo utilizado quando determinada informação não está disponível.

Não deve substituir decisões válidas.

---

# G

## Governança Arquitetural

Conjunto de regras que controla a evolução da arquitetura.

Define:

- responsabilidades;
- autoridade;
- contratos;
- processo de mudança.

---

# H

## Hardening

Camada destinada ao aumento da robustez do sistema.

Seu papel é:

- validar;
- proteger;
- impedir estados inválidos.

Não deve alterar regras de negócio.

---

# I

## Intenção

Classificação principal atribuída a uma mensagem.

Exemplos:

- compra;
- suporte;
- informação;
- objeção.

Representa uma das decisões centrais do pipeline conversacional.

---

# K

## Knowledge

Conjunto de informações utilizadas pela IA para responder ao usuário.

Pode incluir:

- documentos;
- páginas;
- memória;
- conteúdos extraídos.

---

# L

## Lead

Registro comercial criado a partir de uma interação.

---

## Lead Capture

Processo responsável por determinar quando um Lead deve ser criado.

---

## Learning

Camada responsável pela aprendizagem baseada em histórico.

Não altera respostas em tempo real.

---

## Link Curto

Sistema responsável pela criação e resolução de URLs simplificadas.

---

## Link Resolver

Autoridade responsável pela seleção dos links utilizados na resposta.

---

# M

## Matriz de Autoridade

Documento que define a autoridade oficial de cada responsabilidade arquitetural.

---

## Multi Tenant

Arquitetura que permite múltiplos clientes compartilharem a mesma plataforma com isolamento lógico.

---

# O

## Observador

Módulo que apenas registra informações.

Nunca altera decisões.

Exemplos:

- Analytics
- Logs
- Learning

---

## Orquestrador

Componente responsável por coordenar a execução de diferentes módulos.

Não necessariamente possui autoridade sobre decisões.

---

# P

## PageData

Estrutura contendo informações extraídas de uma página.

Pode incluir:

- checkout;
- WhatsApp;
- redes sociais;
- conteúdo;
- contexto.

---

## Pipeline

Sequência ordenada de etapas executadas durante o processamento de uma mensagem.

---

## Pipeline Conversacional

Fluxo responsável por transformar uma mensagem em uma resposta.

---

# R

## Regressão

Alteração que provoca comportamento incorreto em funcionalidades anteriormente estáveis.

---

## Responsabilidade

Conjunto de decisões pertencentes a determinado módulo.

Cada responsabilidade deve possuir uma única autoridade.

---

## Roadmap de Migração

Plano oficial de evolução arquitetural da plataforma.

---

# S

## Sales Layer

Camada especializada em lógica comercial.

---

## Scheduler

Sistema responsável por:

- agendamentos;
- follow-ups;
- lembretes.

---

## Shadow Mode

Modo de execução em que um novo motor processa as mesmas entradas do motor oficial sem alterar o comportamento do sistema.

Seu objetivo é permitir comparação segura entre resultados.

---

## Single Source of Truth

Princípio arquitetural segundo o qual cada informação deve possuir apenas uma fonte oficial.

---

# T

## Tenant

Cliente isolado dentro da arquitetura Multi Tenant.

Cada tenant possui:

- configurações;
- conhecimento;
- integrações;
- dados.

---

# U

## Unified Brain

Nome utilizado para o V17.

Representa o principal motor conversacional da plataforma.

---

# V

## Validador

Módulo responsável por verificar consistência.

Pode impedir estados inválidos.

Nunca altera regras de negócio.

---

## V17

Motor conversacional responsável pela estratégia da resposta.

Entre suas responsabilidades observadas encontram-se:

- contexto;
- intenção;
- tom;
- estratégia;
- resposta.

---

## V18

Motor especializado em extração inteligente de informações estruturadas.

---

## V19

Motor determinístico voltado para decisões comerciais.

Pode operar em modo Shadow.

---

## V21

Camada de hardening destinada à validação e proteção da arquitetura.

---

# W

## WhatsApp Resolver

Componente responsável por selecionar o contato oficial de WhatsApp quando aplicável.

---

## Widget

Interface conversacional incorporada a sites.

Existem duas modalidades principais:

- Inline
- Fullscreen

---

# Princípios de Terminologia

Para manter consistência na documentação, adotam-se as seguintes convenções:

- "Autoridade" refere-se sempre ao módulo que decide.
- "Consumidor" refere-se ao módulo que utiliza uma decisão.
- "Validador" refere-se ao módulo que verifica consistência.
- "Observador" refere-se ao módulo que apenas registra informações.
- "Arquitetura Atual" (AS-IS) nunca deve ser confundida com "Arquitetura Alvo" (TO-BE).
- "Hipótese" nunca deve ser tratada como fato até ser validada por código, documentação ou execução dinâmica.

---

# Manutenção do Glossário

Sempre que novos conceitos forem introduzidos na arquitetura do Link Mágico, este documento deverá ser atualizado antes da implementação correspondente.

Nenhum termo técnico deverá ser utilizado na documentação oficial sem definição prévia neste glossário.

---

# Cláusula Final

Este glossário constitui a referência oficial de terminologia do Link Mágico.

Todos os documentos arquiteturais, auditorias, revisões de código e futuras evoluções da plataforma deverão utilizar as definições aqui estabelecidas para garantir consistência técnica e reduzir ambiguidades.