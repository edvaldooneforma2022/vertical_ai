# Validação das Correções - Link Mágico Chatbot

## ✅ Correções Implementadas

### 1. Backend - Rota `/api/capture-lead` (server.js - Linha 3626)

**Antes:**
```javascript
app.post("/api/capture-lead", async (req, res) => {
    const leadSystem = getLeadSystem(apiKey); // ❌ apiKey não definida
    try {
        const { nome, email, telefone, url_origem, robotName, apiKey } = req.body || {};
        // ...
```

**Depois:**
```javascript
app.post("/api/capture-lead", async (req, res) => {
    try {
        const { nome, email, telefone, url_origem, robotName, apiKey } = req.body || {};
        
        // Validar se apiKey foi fornecida
        if (!apiKey) {
            return res.status(401).json({ 
                success: false, 
                error: "API Key é obrigatória" 
            });
        }
        
        const leadSystem = getLeadSystem(apiKey); // ✅ apiKey extraída primeiro
        // ...
```

**Mudanças:**
- ✅ Extração da `apiKey` do `req.body` **antes** de usar
- ✅ Validação para garantir que `apiKey` foi fornecida
- ✅ Rota permanece pública (sem middleware `requireApiKey`)
- ✅ Sistema multi-tenant funcionando corretamente

---

### 2. Frontend - JavaScript do Chatbot (server.js - Linha 4085)

**Antes:**
```javascript
<script>
    const pageData = ${escapedPageData};
    const robotName = "${safeRobotName}";
    // ... sem extração de apiKey
```

**Depois:**
```javascript
<script>
    // Extrair apiKey da URL
    const urlParams = new URLSearchParams(window.location.search);
    const apiKey = urlParams.get('apiKey');
    
    const pageData = ${escapedPageData};
    const robotName = "${safeRobotName}";
    // ...
```

**Mudanças:**
- ✅ Extração da `apiKey` dos parâmetros da URL
- ✅ Variável `apiKey` disponível para uso em requisições

---

### 3. Frontend - Requisição de Captura de Lead (server.js - Linha 4120)

**Antes:**
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
        // ❌ Falta apiKey
    })
});
```

**Depois:**
```javascript
const response = await fetch('/api/capture-lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        nome: name || 'Não informado',
        email: email,
        telefone: phone || 'Não informado',
        url_origem: window.location.href,
        robotName: robotName,
        apiKey: apiKey  // ✅ apiKey incluída
    })
});
```

**Mudanças:**
- ✅ `apiKey` incluída no corpo da requisição
- ✅ Aplicado em **ambas** as ocorrências do código (linhas 4120 e 4313)

---

### 4. Widget Inline para Clientes

**Arquivo:** `widget-inline-final.html`

**Características:**
- ✅ Configuração simples com objeto `config`
- ✅ Campo `apiKey` obrigatório e validado
- ✅ Balão flutuante responsivo com animação
- ✅ Abre janela popup com todos os parâmetros incluindo `apiKey`
- ✅ URL construída corretamente: `/chatbot?apiKey=XXX&robotName=YYY&...`
- ✅ Funciona em qualquer site (WordPress, Wix, Elementor, HTML puro)
- ✅ Instruções de uso detalhadas no código

---

## 🧪 Testes Recomendados

### Teste 1: Captura de Lead com API Key Válida

**Requisição:**
```bash
curl -X POST https://linkmagico-comercial.onrender.com/api/capture-lead \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "João Silva",
    "email": "joao@teste.com",
    "telefone": "+5511999999999",
    "url_origem": "https://exemplo.com",
    "robotName": "@convertaleads",
    "apiKey": "LMV7-NI12-9HIH-46S6"
  }'
```

**Resposta Esperada:**
```json
{
  "success": true,
  "lead": {
    "id": "lead_xxx",
    "nome": "João Silva",
    "email": "joao@teste.com",
    "telefone": "+5511999999999",
    "url_origem": "https://exemplo.com",
    "robotName": "@convertaleads",
    "timestamp": "2025-11-07T12:00:00.000Z"
  },
  "message": "Lead capturado com sucesso"
}
```

---

### Teste 2: Captura de Lead sem API Key

**Requisição:**
```bash
curl -X POST https://linkmagico-comercial.onrender.com/api/capture-lead \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Maria Santos",
    "email": "maria@teste.com",
    "telefone": "+5511988888888"
  }'
```

**Resposta Esperada:**
```json
{
  "success": false,
  "error": "API Key é obrigatória"
}
```

**Status HTTP:** 401 Unauthorized

---

### Teste 3: Multi-Tenant (Diferentes API Keys)

**Cenário:** Dois clientes diferentes com API Keys distintas devem ter leads separados.

**Cliente A:**
```bash
curl -X POST https://linkmagico-comercial.onrender.com/api/capture-lead \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lead1@clienteA.com",
    "apiKey": "API_KEY_CLIENTE_A"
  }'
```

**Cliente B:**
```bash
curl -X POST https://linkmagico-comercial.onrender.com/api/capture-lead \
  -H "Content-Type: application/json" \
  -d '{
    "email": "lead1@clienteB.com",
    "apiKey": "API_KEY_CLIENTE_B"
  }'
```

**Validação:**
- ✅ Leads devem ser armazenados em sistemas separados
- ✅ Cliente A não deve ver leads do Cliente B
- ✅ Cada tenant deve ter seu próprio diretório de backup

---

### Teste 4: Widget Inline em Site Externo

**Passos:**
1. Criar arquivo HTML de teste
2. Incluir o código do `widget-inline-final.html`
3. Configurar `apiKey` válida
4. Abrir o arquivo no navegador
5. Clicar no balão flutuante
6. Verificar se a janela do chatbot abre com a URL correta
7. Preencher o formulário de lead
8. Verificar se o lead é capturado com sucesso

**URL Esperada da Janela:**
```
https://linkmagico-comercial.onrender.com/chatbot?apiKey=XXX&robotName=YYY&url=ZZZ&instructions=WWW&color=CCC
```

---

## 📋 Checklist de Validação

- [ ] Backend: Rota `/api/capture-lead` extrai `apiKey` corretamente
- [ ] Backend: Validação de `apiKey` obrigatória funciona
- [ ] Backend: Sistema multi-tenant separa leads por `apiKey`
- [ ] Frontend: `apiKey` é extraída da URL
- [ ] Frontend: `apiKey` é enviada na requisição de captura
- [ ] Widget: Balão flutuante aparece no site
- [ ] Widget: Janela do chatbot abre com parâmetros corretos
- [ ] Widget: Formulário de lead funciona
- [ ] Widget: Lead é capturado e armazenado corretamente
- [ ] Erro: Requisição sem `apiKey` retorna 401
- [ ] Multi-tenant: Diferentes `apiKeys` geram leads separados

---

## 🚀 Deploy e Próximos Passos

### 1. Deploy do Backend

```bash
# No servidor de produção
cd /caminho/do/projeto
git pull origin main
npm install
pm2 restart linkmagico
```

### 2. Distribuição do Widget

- Enviar arquivo `widget-inline-final.html` para clientes
- Fornecer API Key única para cada cliente
- Instruir sobre configuração e instalação

### 3. Monitoramento

- Verificar logs de captura de leads
- Monitorar erros de autenticação
- Validar separação de dados entre tenants

---

## 📞 Suporte

Em caso de problemas:
1. Verificar logs do servidor
2. Validar se `apiKey` está sendo enviada corretamente
3. Testar com curl para isolar o problema
4. Verificar se a rota está registrada corretamente no Express
