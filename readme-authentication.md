# LinkMágico v6.0 - Sistema de Licenciamento

## 🔑 Sistema de Autenticação por API Keys

O LinkMágico v6.0 agora possui um sistema de licenciamento robusto baseado em chaves de API individuais e intransferíveis, garantindo que apenas clientes autorizados possam usar a ferramenta.

## 📋 Funcionalidades de Segurança

### ✅ Implementado
- **Autenticação por API Key**: Todas as rotas protegidas requerem chave válida
- **Middleware de Segurança**: Validação automática em todas as requisições
- **Cache de Validação**: Sistema otimizado para reduzir consultas
- **Chaves de Demonstração**: Duas chaves para testes (ver abaixo)
- **Widget Autenticado**: JavaScript widget com validação integrada
- **Páginas HTML Protegidas**: Chat e outras páginas requerem licença
- **Analytics de Uso**: Rastreamento de clientes e uso por chave
- **Conformidade LGPD**: Políticas de privacidade e exclusão mantidas

### 🔐 Chaves de Demonstração

Para testar a ferramenta, use uma das seguintes chaves:

```
a1b2c3d4e5f6g7h8i9j0     (Cliente Demo - 1000 usos)
demo123456789abcdef      (Demo User - 500 usos)
```

## 🚀 Como Usar

### 1. Interface Web
1. Acesse a página principal
2. Insira uma das chaves de demonstração no campo "Chave de API"
3. Aguarde a validação (aparecerá ✅ se válida)
4. Preencha os outros campos normalmente
5. Clique em "Ativar Chatbot Inteligente"

### 2. API Direta

#### Validar Chave
```bash
curl -X GET "http://localhost:3000/api/validate-key" \
  -H "X-API-Key: a1b2c3d4e5f6g7h8i9j0"
```

#### Extrair Dados
```bash
curl -X POST "http://localhost:3000/extract" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: a1b2c3d4e5f6g7h8i9j0" \
  -d '{"url":"https://exemplo.com","instructions":"resposta curta"}'
```

#### Chat Universal
```bash
curl -X POST "http://localhost:3000/chat-universal" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: a1b2c3d4e5f6g7h8i9j0" \
  -d '{"message":"Como funciona?","robotName":"Teste"}'
```

### 3. Widget JavaScript

```html
<script>
(function() {
    var config = {
        robotName: 'Meu Assistente',
        salesUrl: 'https://minha-pagina.com',
        instructions: 'Responda em até 3 frases',
        apiKey: 'a1b2c3d4e5f6g7h8i9j0',  // SUA CHAVE AQUI
        position: 'bottom-right',
        primaryColor: '#3b82f6'
    };
    
    var script = document.createElement('script');
    script.src = '/widget.js?key=' + config.apiKey;
    script.onload = function() {
        window.LinkMagicoWidget.init(config);
    };
    document.head.appendChild(script);
})();
</script>
```

## 🛠️ Configuração do Servidor

### Variáveis de Ambiente
```env
# APIs de IA (opcional)
GROQ_API_KEY=sua_chave_groq
OPENAI_API_KEY=sua_chave_openai

# Configurações do servidor
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Salt para hash de IPs (segurança)
IP_SALT=seu_salt_aleatorio
```

### Instalação
```bash
# Instalar dependências
npm install

# Iniciar servidor
npm start

# Desenvolvimento com hot reload
npm run dev
```

## 🔧 Gerenciamento de Chaves

### Adicionar Nova Chave (Código)
```javascript
const { addAPIKey } = require('./auth');

// Criar nova chave para cliente
const novaChave = addAPIKey('Nome do Cliente', 1000); // 1000 usos
console.log('Nova chave criada:', novaChave);
```

### Remover Chave
```javascript
const { removeAPIKey } = require('./auth');

removeAPIKey('chave_a_ser_removida');
```

### Listar Chaves Ativas
```javascript
const { listAPIKeys } = require('./auth');

const chaves = listAPIKeys();
console.log('Chaves ativas:', chaves);
```

## 📊 Analytics

O sistema rastreia automaticamente:
- Requisições por chave
- Clientes únicos
- Sucessos/falhas de extração
- Tempo de resposta médio
- Uso por endpoint

Acesse `/health` para ver métricas em tempo real.

## 🚫 Rotas Protegidas

### Requer Autenticação
- `/extract` - Extração de dados
- `/chat-universal` - Chat com IA
- `/chatbot` - Interface do chatbot
- `/chat.html` - Página de chat
- `/widget.js` - Widget JavaScript

### Rotas Públicas
- `/` - Página inicial
- `/health` - Status do sistema
- `/privacy