# 🚀 LinkMágico v3.1.0 - Sistema Multi-Tenant

## 🌟 Visão Geral

Esta atualização transforma o LinkMágico em uma plataforma **multi-tenant**, permitindo que você venda o serviço para milhares de clientes com total **isolamento de dados** e **privacidade**.

### ✅ O que é Multi-Tenant?

Significa que cada cliente (empresa) tem seus próprios dados completamente separados dos outros, mesmo usando a mesma plataforma. Isso é essencial para garantir a segurança e a conformidade com a LGPD.

### 🔑 Como Funciona?

O sistema utiliza as **API Keys** que você já tem para identificar cada cliente. Cada cliente recebe uma API Key única, e todos os seus dados (leads e backups) são associados a essa chave.

---

## ✨ Funcionalidades Implementadas

### 1. **Isolamento Total de Leads**
- Cada cliente tem seu próprio arquivo de leads: `data/leads/{api-key}.json`
- É impossível para um cliente acessar os leads de outro

### 2. **Backups Separados por Cliente**
- Cada cliente tem seu próprio diretório de backups: `data/backups/{api-key}/`
- Backups automáticos (diário, startup, shutdown) e manuais são isolados

### 3. **Painel Inteligente**
- O painel em `/app` detecta automaticamente a API Key do cliente logado
- Exibe apenas os leads, estatísticas e backups daquele cliente

### 4. **Widget Multi-Tenant**
- O widget do chatbot agora aceita o parâmetro `apiKey`
- Captura leads e inicia conversas para o cliente correto

---

## 🚀 Como Usar

### Para Clientes (Donos de Sites)

1. **Receba sua API Key única** do administrador.
2. **Configure o widget** no seu site, adicionando sua API Key:

```html
<script src="https://linkmagico-comercial.onrender.com/public/widget.js"></script>
<script>
  window.LinkMagicoWidget.init({
    robotName: 'Meu Assistente',
    salesUrl: 'https://meusite.com',
    instructions: 'Seja prestativo e objetivo',
    apiKey: 'SUA-API-KEY-AQUI'  // ← Adicione sua chave aqui
  });
</script>
```

3. **Acesse o painel** em `/app` com sua API Key para ver seus leads.

### Para Administrador

1. **Gere API Keys** para cada novo cliente.
2. **Entregue a API Key** de forma segura para cada cliente.
3. **Instrua seus clientes** a adicionar a API Key no script do widget.
4. **Monitore os logs** para ver a atividade de cada cliente.
5. **Faça backup regular** dos diretórios `data/leads/` e `data/backups/`.

---

## 📂 Estrutura de Arquivos

A nova estrutura de dados garante o isolamento:

```
data/
├── leads/
│   ├── cliente-a-key.json
│   ├── cliente-b-key.json
│   └── ...
├── backups/
│   ├── cliente-a-key/
│   │   ├── backup_2025-10-10_14-00-00.json
│   │   └── ...
│   ├── cliente-b-key/
│   │   └── ...
```

---

## ⚠️ Migração de Dados Antigos

Os leads capturados **antes desta atualização** estão no arquivo `data/leads.json`. Eles **não serão exibidos** no novo sistema.

**Recomendação:** Se você tem leads importantes neste arquivo, é necessário migrá-los manualmente para os novos arquivos de cada cliente. Um script de migração pode ser criado se você precisar.

---

## ✅ Conclusão

Com esta atualização, o LinkMágico está pronto para ser comercializado como uma plataforma SaaS (Software as a Service) robusta, segura e escalável.

**Status:** ✅ Pronto para Produção
**Versão:** LinkMágico v3.1.0 Multi-Tenant
**Data:** 10 de outubro de 2025

