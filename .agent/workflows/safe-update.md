---
description: Workflow para atualizações seguras do sistema LinkMágico
---

# Workflow: Atualização Segura do Sistema

Este workflow deve ser seguido **SEMPRE** que for modificar o código do LinkMágico para evitar quebras em produção.

---

## Pré-Requisitos

Antes de iniciar qualquer modificação:

// turbo
1. Certifique-se de estar na branch `main` atualizada:
```bash
git fetch origin
git checkout main
git pull origin main
```

---

## Checklist Obrigatório

### Antes de Modificar

- [ ] Li o arquivo `docs/ARCHITECTURE.md` para entender a estrutura
- [ ] Identifiquei quais endpoints/funções serão afetados
- [ ] Verifiquei se há testes existentes para a área que vou modificar

### Arquivos Críticos (Requerem Revisão Extra)

| Arquivo | Motivo |
|---------|--------|
| `server.js` | Servidor principal - qualquer erro quebra toda a aplicação |
| `public/index_app.html` | Painel administrativo - afeta todos os clientes |
| `data/api_keys.json` | Autenticação - pode bloquear acesso dos clientes |

### Funções Críticas no server.js

- `escapeForJS()` - Escape de strings para JavaScript
- `generateFullChatbotHTML()` - Gera HTML do chatbot
- `generateChatbotHTML()` - Versão alternativa
- `LeadCaptureSystem` - Sistema de captura de leads
- `LeadBackupSystem` - Sistema de backup
- Configuração de CORS - Afeta widget externo

---

## Rodando Testes

// turbo
2. Antes de qualquer commit, rode os testes:
```bash
npm test
```

// turbo
3. Para ver cobertura de testes:
```bash
npm run test:coverage
```

4. Verifique se todos os testes passaram:
   - ✅ Testes de chatbot (escape de strings)
   - ✅ Testes de leads
   - ✅ Testes de backup
   - ✅ Testes de analytics

---

## Após Modificar

// turbo
5. Verificar se não há erros de sintaxe:
```bash
node --check server.js
```

6. Testar localmente (se possível):
```bash
npm run dev
```

7. Fazer commit com mensagem descritiva:
```bash
git add .
git commit -m "tipo(escopo): descrição curta

- Detalhe 1
- Detalhe 2"
```

Tipos de commit:
- `fix` - Correção de bug
- `feat` - Nova funcionalidade
- `refactor` - Refatoração sem mudar comportamento
- `docs` - Apenas documentação
- `test` - Apenas testes

8. Push para o repositório:
```bash
git push origin main
```

---

## Deploy

9. Após push, fazer deploy no Render:
   - Acesse https://dashboard.render.com
   - Selecione o serviço `vertical-ai`
   - Clique em **Manual Deploy** → **Deploy latest commit**

10. Após deploy, testar em produção:
    - [ ] Ativar chatbot com instruções contendo caracteres especiais
    - [ ] Preencher formulário de lead
    - [ ] Enviar mensagem no chat
    - [ ] Verificar lead no dashboard
    - [ ] Testar widget externo em site cliente

---

## Rollback de Emergência

Se algo quebrar em produção:

1. Identificar último commit estável (tag `render-prod-ok`)
2. Reverter:
```bash
git revert HEAD
git push origin main
```

3. Fazer deploy imediato no Render

---

## Contatos

- Repositório: https://github.com/edvaldooneforma2022/vertical_ai
- Produção: https://vertical-ai-dktu.onrender.com
