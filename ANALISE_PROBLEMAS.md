# Análise de Problemas - Link Mágico Chatbot

## Problemas Identificados

### 1. Rota `/api/capture-lead` no server.js (Linha 3626-3674)

**Problema 1.1:** A variável `apiKey` está sendo usada na linha 3627 **antes** de ser extraída do `req.body` na linha 3629.

```javascript
// LINHA 3627 - ERRO: apiKey não está definida ainda
const leadSystem = getLeadSystem(apiKey);

// LINHA 3629 - apiKey só é extraída aqui
const { nome, email, telefone, url_origem, robotName, apiKey } = req.body || {};
```

**Problema 1.2:** A rota não está recebendo a `apiKey` no corpo da requisição porque o frontend não está enviando.

**Problema 1.3:** A rota deveria ser pública (sem middleware `requireApiKey`), mas usar a `apiKey` do corpo da requisição para identificar o tenant.

### 2. Frontend do Chatbot (server.js - Linhas 4098-4130)

**Problema 2.1:** O JavaScript do botão "Iniciar Conversa" não está extraindo a `apiKey` da URL.

**Problema 2.2:** O JavaScript não está enviando a `apiKey` no corpo da requisição POST para `/api/capture-lead`.

**Código Atual (Linha 4107-4116):**
```javascript
const response = await fetch('/api/capture-lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        nome: name || 'Não informado',
        email: email,
        telefone: phone || 'Não informado',
        url_origem: window.location.href,
        robotName: robotName
        // FALTA: apiKey
    })
});
```

### 3. Rota `/chatbot` - Necessidade de Passar apiKey

A rota `/chatbot` precisa receber a `apiKey` como parâmetro de URL e disponibilizá-la para o JavaScript do frontend.

## Soluções Planejadas

### Solução 1: Corrigir Backend (server.js - Linha 3626)

1. Extrair `apiKey` do `req.body` **antes** de usar
2. Validar se `apiKey` foi fornecida
3. Usar `apiKey` para obter o sistema de leads correto
4. Manter a rota pública (sem middleware `requireApiKey`)

### Solução 2: Corrigir Frontend do Chatbot

1. Extrair `apiKey` dos parâmetros da URL no JavaScript
2. Incluir `apiKey` no corpo da requisição POST `/api/capture-lead`
3. Garantir que a `apiKey` seja passada na URL ao abrir a janela do chatbot

### Solução 3: Atualizar Widget Inline

1. Garantir que o widget inline passe a `apiKey` na URL ao abrir o chatbot
2. Formato: `/chatbot?apiKey=XXX&robotName=YYY&...`

## Arquivos a Serem Modificados

1. **server.js** (Linha 3626-3674): Rota `/api/capture-lead`
2. **server.js** (Linha 4098-4130): JavaScript do botão "Iniciar Conversa"
3. **server.js** (Linha ~4290-4305): Segunda ocorrência do código de captura de lead
4. **Criar novo arquivo**: `widget-inline-final.html` com código atualizado para clientes

## Validações Necessárias

1. Testar captura de lead com `apiKey` válida
2. Testar captura de lead sem `apiKey` (deve retornar erro)
3. Testar multi-tenant (diferentes `apiKeys` devem gerar leads separados)
4. Validar que o widget inline funciona em sites externos
