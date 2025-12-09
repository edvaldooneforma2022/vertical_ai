# 🎨 Guia Visual de Alterações
## Link Mágico - Correções de API Key

---

## 📍 Mapa de Alterações no server.js

### Alteração 1: Rota `/api/capture-lead`
**Localização:** Linha 3626-3674

#### ❌ ANTES (Código com Erro)
```javascript
3625  // ===== ENDPOINT: Captura de Lead =====
3626  app.post("/api/capture-lead", async (req, res) => {
3627      const leadSystem = getLeadSystem(apiKey);  // ❌ ERRO: apiKey não existe ainda
3628      try {
3629          const { nome, email, telefone, url_origem, robotName, apiKey } = req.body || {};
3630  
3631          if (!email) {
3632              return res.status(400).json({ 
3633                  success: false, 
3634                  error: "Email é obrigatório" 
3635              });
3636          }
```

#### ✅ DEPOIS (Código Corrigido)
```javascript
3625  // ===== ENDPOINT: Captura de Lead =====
3626  app.post("/api/capture-lead", async (req, res) => {
3627      try {
3628          const { nome, email, telefone, url_origem, robotName, apiKey } = req.body || {};
3629          
3630          // Validar se apiKey foi fornecida
3631          if (!apiKey) {
3632              return res.status(401).json({ 
3633                  success: false, 
3634                  error: "API Key é obrigatória" 
3635              });
3636          }
3637          
3638          const leadSystem = getLeadSystem(apiKey);  // ✅ CORRETO: apiKey já foi extraída
3639  
3640          if (!email) {
3641              return res.status(400).json({ 
3642                  success: false, 
3643                  error: "Email é obrigatório" 
3644              });
3645          }
```

**O que mudou:**
1. ✅ Linha 3627: `try` movido para antes da extração
2. ✅ Linha 3628: Extração de `apiKey` do `req.body` agora é a primeira linha
3. ✅ Linhas 3630-3636: Nova validação de `apiKey` obrigatória
4. ✅ Linha 3638: `getLeadSystem(apiKey)` agora usa a variável corretamente

---

### Alteração 2: JavaScript do Chatbot (Primeira Ocorrência)
**Localização:** Linha 4085-4099

#### ❌ ANTES
```javascript
4085      <script>
4086          const pageData = ${escapedPageData};
4087          const robotName = "${safeRobotName}";
4088          const customInstructions = "${safeInstructions}";
4089          const chatMessages = document.getElementById('chatMessages');
```

#### ✅ DEPOIS
```javascript
4085      <script>
4086          // Extrair apiKey da URL
4087          const urlParams = new URLSearchParams(window.location.search);
4088          const apiKey = urlParams.get('apiKey');
4089          
4090          const pageData = ${escapedPageData};
4091          const robotName = "${safeRobotName}";
4092          const customInstructions = "${safeInstructions}";
4093          const chatMessages = document.getElementById('chatMessages');
```

**O que mudou:**
1. ✅ Linhas 4086-4088: Adicionado código para extrair `apiKey` da URL
2. ✅ Variável `apiKey` agora disponível para uso

---

### Alteração 3: Requisição de Captura de Lead (Primeira Ocorrência)
**Localização:** Linha 4120-4131

#### ❌ ANTES
```javascript
4107              try {
4108                  const response = await fetch('/api/capture-lead', {
4109                      method: 'POST',
4110                      headers: { 'Content-Type': 'application/json' },
4111                      body: JSON.stringify({
4112                          nome: name || 'Não informado',
4113                          email: email,
4114                          telefone: phone || 'Não informado',
4115                          url_origem: window.location.href,
4116                          robotName: robotName
                           // ❌ FALTA: apiKey
4117                      })
4118                  });
```

#### ✅ DEPOIS
```javascript
4119              try {
4120                  const response = await fetch('/api/capture-lead', {
4121                      method: 'POST',
4122                      headers: { 'Content-Type': 'application/json' },
4123                      body: JSON.stringify({
4124                          nome: name || 'Não informado',
4125                          email: email,
4126                          telefone: phone || 'Não informado',
4127                          url_origem: window.location.href,
4128                          robotName: robotName,
4129                          apiKey: apiKey  // ✅ ADICIONADO
4130                      })
4131                  });
```

**O que mudou:**
1. ✅ Linha 4129: Adicionado `apiKey: apiKey` no corpo da requisição

---

### Alteração 4: JavaScript do Chatbot (Segunda Ocorrência)
**Localização:** Linha 4282-4294

#### ❌ ANTES
```javascript
4282      <script>
4283          const chatMessages = document.getElementById('chatMessages');
4284          const chatInput = document.getElementById('chatInput');
4285          const sendButton = document.getElementById('sendButton');
```

#### ✅ DEPOIS
```javascript
4282      <script>
4283          // Extrair apiKey da URL
4284          const urlParams = new URLSearchParams(window.location.search);
4285          const apiKey = urlParams.get('apiKey');
4286          
4287          const chatMessages = document.getElementById('chatMessages');
4288          const chatInput = document.getElementById('chatInput');
4289          const sendButton = document.getElementById('sendButton');
```

**O que mudou:**
1. ✅ Linhas 4283-4285: Adicionado código para extrair `apiKey` da URL
2. ✅ Mesma lógica da primeira ocorrência

---

### Alteração 5: Requisição de Captura de Lead (Segunda Ocorrência)
**Localização:** Linha 4313-4324

#### ❌ ANTES
```javascript
4308              try {
4309                  const response = await fetch('/api/capture-lead', {
4310                      method: 'POST',
4311                      headers: { 'Content-Type': 'application/json' },
4312                      body: JSON.stringify({
4313                          nome: name || 'Não informado',
4314                          email: email,
4315                          telefone: phone || 'Não informado',
4316                          url_origem: window.location.href,
4317                          robotName: config.robotName
                           // ❌ FALTA: apiKey
4318                      })
4319                  });
```

#### ✅ DEPOIS
```javascript
4312              try {
4313                  const response = await fetch('/api/capture-lead', {
4314                      method: 'POST',
4315                      headers: { 'Content-Type': 'application/json' },
4316                      body: JSON.stringify({
4317                          nome: name || 'Não informado',
4318                          email: email,
4319                          telefone: phone || 'Não informado',
4320                          url_origem: window.location.href,
4321                          robotName: config.robotName,
4322                          apiKey: apiKey  // ✅ ADICIONADO
4323                      })
4324                  });
```

**O que mudou:**
1. ✅ Linha 4322: Adicionado `apiKey: apiKey` no corpo da requisição

---

## 🔄 Fluxo de Dados Corrigido

### Antes (Com Erro)
```
┌─────────────────┐
│  Site Cliente   │
│  (Widget)       │
└────────┬────────┘
         │ Abre janela sem apiKey
         ↓
┌─────────────────┐
│  /chatbot       │
│  (Frontend)     │
└────────┬────────┘
         │ Não extrai apiKey
         │ Não envia apiKey
         ↓
┌─────────────────┐
│ POST            │
│ /api/capture-   │
│ lead            │
│ (Backend)       │
└────────┬────────┘
         │ Tenta usar apiKey
         │ antes de extrair
         ↓
         ❌ ERRO
```

### Depois (Corrigido)
```
┌─────────────────┐
│  Site Cliente   │
│  (Widget)       │
└────────┬────────┘
         │ Abre janela COM apiKey na URL
         │ /chatbot?apiKey=XXX
         ↓
┌─────────────────┐
│  /chatbot       │
│  (Frontend)     │
└────────┬────────┘
         │ ✅ Extrai apiKey da URL
         │ ✅ Envia apiKey no body
         ↓
┌─────────────────┐
│ POST            │
│ /api/capture-   │
│ lead            │
│ (Backend)       │
└────────┬────────┘
         │ ✅ Extrai apiKey do body
         │ ✅ Valida apiKey
         │ ✅ Usa apiKey corretamente
         ↓
         ✅ SUCESSO
```

---

## 📊 Comparação de Requisições

### Requisição ANTES (Falhava)
```http
POST /api/capture-lead HTTP/1.1
Content-Type: application/json

{
  "nome": "João Silva",
  "email": "joao@teste.com",
  "telefone": "+5511999999999",
  "url_origem": "https://exemplo.com",
  "robotName": "@convertaleads"
  // ❌ FALTA: "apiKey"
}
```

**Resposta:**
```http
HTTP/1.1 500 Internal Server Error

{
  "success": false,
  "error": "Erro interno ao capturar lead"
}
```

### Requisição DEPOIS (Funciona)
```http
POST /api/capture-lead HTTP/1.1
Content-Type: application/json

{
  "nome": "João Silva",
  "email": "joao@teste.com",
  "telefone": "+5511999999999",
  "url_origem": "https://exemplo.com",
  "robotName": "@convertaleads",
  "apiKey": "LMV7-NI12-9HIH-46S6"  // ✅ ADICIONADO
}
```

**Resposta:**
```http
HTTP/1.1 200 OK

{
  "success": true,
  "lead": {
    "id": "lead_1699368000000",
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

## 🎯 Validação de API Key

### Requisição SEM API Key (Agora Retorna 401)
```http
POST /api/capture-lead HTTP/1.1
Content-Type: application/json

{
  "nome": "Maria Santos",
  "email": "maria@teste.com"
  // ❌ Sem apiKey
}
```

**Resposta:**
```http
HTTP/1.1 401 Unauthorized

{
  "success": false,
  "error": "API Key é obrigatória"
}
```

---

## 📱 Widget Inline - Antes e Depois

### ANTES (Não Funcionava)
```javascript
// Widget não passava apiKey na URL
window.open(`${apiBase}/chatbot?robotName=${robotName}&url=${url}`);
```

### DEPOIS (Funciona)
```javascript
// Widget passa apiKey na URL
const chatUrl = `${apiBase}/chatbot?` + 
    `apiKey=${encodeURIComponent(config.apiKey)}&` +  // ✅ ADICIONADO
    `robotName=${encodeURIComponent(config.robotName)}&` +
    `url=${encodeURIComponent(config.salesUrl)}`;

window.open(chatUrl, 'LinkMagicoChatbot', ...);
```

---

## 🔍 Como Identificar se as Correções Estão Aplicadas

### Verificação 1: Rota de Captura
```bash
# Buscar a linha com validação de apiKey
grep -n "API Key é obrigatória" server.js
```

**Resultado esperado:**
```
3634:                error: "API Key é obrigatória"
```

### Verificação 2: Extração de apiKey no Frontend
```bash
# Buscar extração de apiKey da URL
grep -n "urlParams.get('apiKey')" server.js
```

**Resultado esperado:**
```
4088:        const apiKey = urlParams.get('apiKey');
4285:        const apiKey = urlParams.get('apiKey');
```

### Verificação 3: Envio de apiKey na Requisição
```bash
# Buscar inclusão de apiKey no body
grep -n "apiKey: apiKey" server.js
```

**Resultado esperado:**
```
4129:                        apiKey: apiKey
4322:                        apiKey: apiKey
```

---

## 📈 Impacto das Mudanças

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Captura de Leads** | ❌ Falhava com erro | ✅ Funciona corretamente |
| **Autenticação** | ❌ Sem validação | ✅ API Key obrigatória |
| **Multi-Tenant** | ❌ Não funcionava | ✅ Isolamento por apiKey |
| **Segurança** | ⚠️ Baixa | ✅ Alta |
| **Mensagens de Erro** | ❌ Genéricas | ✅ Descritivas |
| **Compatibilidade** | ✅ Mantida | ✅ Mantida |

---

## 🎓 Para Desenvolvedores

### Padrão de Código Aplicado

**Princípio:** Extrair e validar dados antes de usar

```javascript
// ❌ ERRADO
function processar(req, res) {
    const sistema = getSistema(apiKey);  // apiKey não existe
    const { apiKey } = req.body;
}

// ✅ CORRETO
function processar(req, res) {
    const { apiKey } = req.body;  // Extrair primeiro
    if (!apiKey) return res.status(401).json({...});  // Validar
    const sistema = getSistema(apiKey);  // Usar depois
}
```

---

## 📝 Resumo Visual

```
┌─────────────────────────────────────────────────────────┐
│                  CORREÇÕES APLICADAS                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. Backend: Rota /api/capture-lead                    │
│     ✅ Extração de apiKey ANTES de usar                │
│     ✅ Validação obrigatória de apiKey                 │
│     ✅ Retorno 401 se apiKey ausente                   │
│                                                         │
│  2. Frontend: JavaScript do Chatbot (2 ocorrências)    │
│     ✅ Extração de apiKey da URL                       │
│     ✅ Variável disponível para requisições            │
│                                                         │
│  3. Frontend: Requisições de Captura (2 ocorrências)   │
│     ✅ apiKey incluída no corpo da requisição          │
│     ✅ Autenticação funcionando                        │
│                                                         │
│  4. Widget: Código Inline                              │
│     ✅ Configuração simples                            │
│     ✅ apiKey passada na URL                           │
│     ✅ Compatível com qualquer site                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

**Desenvolvido por:** Equipe de Desenvolvimento LinkMágico  
**Versão:** 1.0.0  
**Data:** 07/11/2025
