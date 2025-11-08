# 🔐 DOCUMENTAÇÃO: Sistema de Backup Automático de Leads

## LinkMágico v3.0.4 - Backup de Leads
**Data:** 10 de Outubro de 2025

---

## 🎯 Visão Geral

Para garantir a segurança e a integridade dos dados, implementamos um sistema de backup automático e manual para os leads capturados. Este sistema protege contra perda de dados acidental, falhas de servidor ou problemas durante o deploy.

### Funcionalidades Principais:

1. ✅ **Backup Automático Diário**: A cada 24 horas, um backup completo é criado.
2. ✅ **Backup no Startup**: Um backup é criado sempre que o servidor é iniciado.
3. ✅ **Backup no Shutdown**: Um backup é criado antes do servidor ser desligado.
4. ✅ **Backup Manual**: Crie backups a qualquer momento pelo painel.
5. ✅ **Retenção de 7 Dias**: Os últimos 7 backups são mantidos, e os mais antigos são removidos automaticamente.
6. ✅ **Restauração Fácil**: Restaure qualquer backup com um clique.
7. ✅ **Backup de Segurança**: Antes de restaurar, um backup do estado atual é criado para segurança extra.

---

## 📁 Estrutura de Arquivos

- **`data/leads.json`**: Arquivo principal com os leads ativos.
- **`data/backups/`**: Diretório onde todos os backups são armazenados.

### Formato do Backup:

Cada backup é um arquivo JSON com o seguinte formato:

```json
{
  "timestamp": "2025-10-10T18:00:00.000Z",
  "type": "daily",
  "leadsCount": 150,
  "leads": [
    // ... array completo de leads ...
  ]
}
```

### Tipos de Backup:

- **`daily`**: Backup automático diário.
- **`startup`**: Backup na inicialização do servidor.
- **`shutdown`**: Backup no desligamento do servidor.
- **`manual`**: Backup criado pelo usuário no painel.
- **`pre-restore`**: Backup de segurança criado antes de uma restauração.

---

## 💻 Implementação Técnica

### Classe `LeadBackupSystem` (`server.js`)

Esta nova classe gerencia todo o ciclo de vida dos backups.

**Métodos Principais:**

- `constructor(leadSystem)`: Inicializa o sistema, agenda backups e configura hooks de shutdown.
- `createBackup(type)`: Cria um novo arquivo de backup.
- `cleanOldBackups()`: Remove backups com mais de 7 dias.
- `listBackups()`: Retorna uma lista de todos os backups disponíveis.
- `restoreBackup(filename)`: Restaura um backup específico.
- `scheduleAutomaticBackups()`: Agenda o backup diário.
- `setupShutdownHook()`: Garante o backup antes do servidor parar.

### Endpoints da API

- **`POST /admin/leads/backup/create`**: Cria um backup manual.
- **`GET /admin/leads/backup/list`**: Lista todos os backups.
- **`POST /admin/leads/backup/restore`**: Restaura um backup.

---

## 🎨 Interface do Usuário

Uma nova seção **"🔐 Backup de Leads"** foi adicionada à aba **Leads** nos **Sistemas V2.0**.

### Funcionalidades da Interface:

1. **Botão "Criar Backup Agora"**: Para backups manuais.
2. **Botão "Atualizar Lista"**: Para recarregar a lista de backups.
3. **Lista de Backups**: Mostra todos os backups com:
   - Tipo (Manual, Diário, etc.)
   - Data e hora
   - Quantidade de leads
   - Tamanho do arquivo
   - Botão "Restaurar Este Backup"

### Como Usar:

1. **Acesse o painel** em `/app`.
2. **Clique em "Novos Sistemas V2.0"**.
3. **Abra a aba "Leads"**.
4. **Role para baixo** até a seção "Backup de Leads".

---

## 🔄 Como Restaurar um Backup

1. **Vá para a seção de backups** na aba Leads.
2. **Encontre o backup** que deseja restaurar na lista.
3. **Clique no botão "♻️ Restaurar Este Backup"**.
4. **Confirme a ação** na caixa de diálogo de segurança.

**O que acontece durante a restauração:**

1. ⚠️ Um backup do estado atual (`pre-restore`) é criado para segurança.
2. 🔄 Os leads do backup selecionado substituem os leads atuais.
3. ✅ Os painéis são atualizados com os dados restaurados.

---

## ⚠️ Recomendações

1. **Faça Backup Manual Antes de Mudanças Críticas**: Antes de fazer um grande deploy ou alteração, crie um backup manual.
2. **Verifique os Backups Regularmente**: Acesse a lista de backups para garantir que estão sendo criados corretamente.
3. **Não Edite os Arquivos Manualmente**: Evite editar os arquivos em `data/backups/` para não corrompê-los.

---

## ✅ Validação

- **Sintaxe do Código**: Validada (server.js e index_app.html).
- **Criação de Diretórios**: `data/backups/` é criado automaticamente.
- **Testes de API**: Endpoints de backup testados e funcionando.
- **Testes de Interface**: Interface visual testada e funcional.

---

## 🎯 Benefícios

1. **Segurança dos Dados**: Proteção contra perda de leads.
2. **Recuperação de Desastres**: Restaure facilmente em caso de falha.
3. **Auditoria**: Histórico de backups com data e tipo.
4. **Controle Total**: Gerencie backups pelo painel, sem precisar de acesso ao servidor.

---

**Desenvolvido por:** Manus AI  
**Data:** 10 de Outubro de 2025  
**Versão:** LinkMágico v3.0.4 - Backup de Leads

