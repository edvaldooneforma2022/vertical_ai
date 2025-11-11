# 🚀 Link Mágico - Guia Completo de Configuração

## 📋 Índice

1. [Visão Geral das Melhorias](#visão-geral-das-melhorias)
2. [Pré-requisitos](#pré-requisitos)
3. [Instalação](#instalação)
4. [Configuração Básica](#configuração-básica)
5. [Configuração Avançada](#configuração-avançada)
6. [Deploy no Render](#deploy-no-render)
7. [Testando as Funcionalidades](#testando-as-funcionalidades)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral das Melhorias

### ✅ O que foi implementado:

1. **Sistema de Banco de Dados**
   - PostgreSQL para produção
   - SQLite para desenvolvimento
   - Persistência de chatbots, conversas e analytics

2. **Sistema de Cache Inteligente**
   - Redis para produção
   - In-Memory para desenvolvimento
   - Cache de extrações (24h) e respostas (1h)
   - Rate limiting por API key

3. **Dashboard de Analytics Profissional**
   - Métricas detalhadas de uso
   - Exportação para CSV
   - Rastreamento de custos
   - Análise de satisfação

4. **Sistema de Webhooks**
   - Integração com sistemas externos
   - Eventos: conversa iniciada/finalizada, lead capturado, etc.
   - Retry automático
   - Assinatura HMAC para segurança

5. **Sistema de Billing e Pagamentos**
   - 4 planos: Free, Starter, Professional, Enterprise
   - Integração com Stripe
   - Preparado para PayPal e PagSeguro
   - Controle de limites e uso

6. **Gestão de Conhecimento Avançada**
   - Múltiplas fontes: URLs, FAQs, Documentos
   - Upload de PDFs (preparado)
   - Busca inteligente
   - Base de conhecimento incremental

7. **Otimização de Custos LLM**
   - Cache de respostas similares
   - Análise de complexidade de perguntas
   - Fallback inteligente entre provedores
   - Monitoramento de tokens e custos

8. **Melhorias no Sistema de Extração**
   - Cache de extrações
   - Retry em caso de falha
   - Validação de qualidade

### ✅ O que foi mantido intacto:

- ✅ GROQ API como principal
- ✅ OpenAI API como fallback 1
- ✅ OpenRouter API como fallback 2
- ✅ Lógica nativa existente
- ✅ Todas as rotas e fluxos atuais
- ✅ Sistema de leads
- ✅ Análise de jornada do cliente
- ✅ Extração de contatos
- ✅ Widget e embed

---

## 📦 Pré-requisitos

### Desenvolvimento Local:

```bash
- Node.js >= 18.x
- npm ou yarn
- Git
```

### Produção (Render):

```bash
- Conta no Render (gratuita)
- Conta no Stripe (opcional, para pagamentos)
- Conta no Redis Cloud (opcional, para cache)
- Conta no ElephantSQL ou similar (opcional, para PostgreSQL)
```

---

## 🔧 Instalação

### 1. Clonar/Baixar o Projeto

Se você está usando o código melhorado:

```bash
cd linkmagico-melhorado
```

### 2. Instalar Dependências

```bash
npm install
```

As novas dependências já estão no `package.json`:
- `pg` - PostgreSQL client
- `better-sqlite3` - SQLite client
- `stripe` - Pagamentos
- `redis` - Cache (já estava instalado)

### 3. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
# ===== ESSENCIAL =====
PORT=3000
NODE_ENV=development

# APIs de LLM (mantenha as que você já tem)
GROQ_API_KEY=sua_chave_groq
OPENAI_API_KEY=sua_chave_openai
OPENROUTER_API_KEY=sua_chave_openrouter

# Segurança
SESSION_SECRET=gere_uma_chave_aleatoria_aqui_min_32_caracteres

# ===== DESENVOLVIMENTO (usar SQLite e cache in-memory) =====
USE_POSTGRES=false
USE_REDIS=false

# ===== PRODUÇÃO (configurar depois) =====
# DATABASE_URL=postgresql://...
# REDIS_URL=redis://...
# STRIPE_SECRET_KEY=sk_live_...
```

---

## 🚀 Configuração Básica (Desenvolvimento)

### Passo 1: Usar o Server Melhorado

Renomeie o server original e use o melhorado:

```bash
# Backup do original (já foi feito)
# cp server.js server.js.backup

# Usar o server melhorado
cp server-melhorado.js server.js
```

### Passo 2: Iniciar o Servidor

```bash
npm start
```

Ou para desenvolvimento com auto-reload:

```bash
npm run dev
```

### Passo 3: Verificar Status

Acesse no navegador:

```
http://localhost:3000/api/system/status
```

Você deve ver algo como:

```json
{
  "success": true,
  "status": {
    "server": "online",
    "database": {
      "type": "SQLite",
      "connected": true
    },
    "cache": {
      "type": "In-Memory",
      "connected": true
    },
    "webhooks": {
      "totalWebhooks": 0,
      "activeWebhooks": 0
    },
    "features": {
      "billing": false,
      "webhooks": true,
      "analytics": true,
      "llmOptimization": true,
      "knowledgeBase": true
    }
  }
}
```

---

## ⚙️ Configuração Avançada

### 1. Configurar PostgreSQL (Produção)

#### Opção A: ElephantSQL (Gratuito)

1. Acesse https://www.elephantsql.com/
2. Crie uma conta gratuita
3. Crie uma nova instância (plano Tiny Turtle - gratuito)
4. Copie a URL de conexão
5. Adicione no `.env`:

```env
USE_POSTGRES=true
DATABASE_URL=postgres://usuario:senha@host/database
```

#### Opção B: Render PostgreSQL

1. No dashboard do Render, crie um novo PostgreSQL
2. Copie a "Internal Database URL"
3. Adicione no `.env`

### 2. Configurar Redis (Produção)

#### Opção A: Redis Cloud (Gratuito)

1. Acesse https://redis.com/try-free/
2. Crie uma conta gratuita
3. Crie um novo database (30MB gratuito)
4. Copie a URL de conexão
5. Adicione no `.env`:

```env
USE_REDIS=true
REDIS_URL=redis://default:senha@host:port
```

#### Opção B: Upstash (Gratuito)

1. Acesse https://upstash.com/
2. Crie um database Redis
3. Copie a URL de conexão

### 3. Configurar Stripe (Pagamentos)

1. Acesse https://stripe.com/
2. Crie uma conta
3. Vá em Developers > API Keys
4. Copie as chaves:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

5. Configure o webhook:
   - URL: `https://seu-dominio.com/api/webhooks/stripe`
   - Eventos: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
   - Copie o Signing Secret:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 4. Configurar Rate Limiting

```env
RATE_LIMIT_REQUESTS=100  # Requisições por janela
RATE_LIMIT_WINDOW=60     # Janela em segundos
```

### 5. Configurar Analytics

```env
ANALYTICS_RETENTION_DAYS=90      # Manter dados por 90 dias
ANALYTICS_FLUSH_INTERVAL=60000   # Salvar a cada 60 segundos
```

---

## 🌐 Deploy no Render

### Passo 1: Preparar o Repositório

1. Certifique-se de que todos os arquivos estão commitados:

```bash
git add .
git commit -m "Implementação de melhorias - Link Mágico"
git push origin main
```

### Passo 2: Criar Web Service no Render

1. Acesse https://dashboard.render.com/
2. Clique em "New +" > "Web Service"
3. Conecte seu repositório GitHub
4. Configure:
   - **Name**: linkmagico-melhorado
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### Passo 3: Configurar Variáveis de Ambiente

No Render, vá em "Environment" e adicione:

```
GROQ_API_KEY=sua_chave
OPENAI_API_KEY=sua_chave
OPENROUTER_API_KEY=sua_chave
SESSION_SECRET=chave_aleatoria_32_chars
NODE_ENV=production
USE_POSTGRES=false
USE_REDIS=false
```

### Passo 4: Deploy

1. Clique em "Create Web Service"
2. Aguarde o deploy (5-10 minutos)
3. Acesse a URL fornecida pelo Render

### Passo 5: Configurar PostgreSQL (Opcional)

1. No Render, crie um PostgreSQL
2. Copie a "Internal Database URL"
3. Adicione nas variáveis de ambiente:

```
USE_POSTGRES=true
DATABASE_URL=postgresql://...
```

4. Faça um novo deploy

### Passo 6: Configurar Redis (Opcional)

1. Crie um Redis no Redis Cloud ou Upstash
2. Adicione nas variáveis de ambiente:

```
USE_REDIS=true
REDIS_URL=redis://...
```

3. Faça um novo deploy

---

## 🧪 Testando as Funcionalidades

### 1. Testar Analytics

```bash
# Obter analytics de um chatbot
curl http://localhost:3000/api/analytics/CHATBOT_ID?days=7

# Exportar para CSV
curl http://localhost:3000/api/analytics/CHATBOT_ID/export?startDate=2024-01-01&endDate=2024-01-31
```

### 2. Testar Webhooks

```bash
# Registrar webhook
curl -X POST http://localhost:3000/api/webhooks/CHATBOT_ID \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "lead_captured",
    "url": "https://webhook.site/seu-id"
  }'

# Listar webhooks
curl http://localhost:3000/api/webhooks/CHATBOT_ID

# Testar webhook
curl -X POST http://localhost:3000/api/webhooks/CHATBOT_ID/WEBHOOK_ID/test
```

### 3. Testar Billing

```bash
# Listar planos
curl http://localhost:3000/api/plans

# Obter assinatura
curl http://localhost:3000/api/subscription/USER_ID

# Fazer upgrade
curl -X POST http://localhost:3000/api/subscription/USER_ID/upgrade \
  -H "Content-Type: application/json" \
  -d '{"planId": "professional"}'
```

### 4. Testar Knowledge Base

```bash
# Adicionar FAQ
curl -X POST http://localhost:3000/api/knowledge/CHATBOT_ID/faq \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Qual o horário de funcionamento?",
    "answer": "Funcionamos de segunda a sexta, das 9h às 18h",
    "category": "atendimento"
  }'

# Adicionar múltiplas FAQs
curl -X POST http://localhost:3000/api/knowledge/CHATBOT_ID/faqs/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "faqs": [
      {
        "question": "Aceitam cartão?",
        "answer": "Sim, aceitamos todas as bandeiras",
        "category": "pagamento"
      },
      {
        "question": "Fazem entrega?",
        "answer": "Sim, entregamos em toda a cidade",
        "category": "entrega"
      }
    ]
  }'

# Obter estatísticas
curl http://localhost:3000/api/knowledge/CHATBOT_ID/stats
```

### 5. Testar Otimização LLM

```bash
# Obter estatísticas de uso
curl http://localhost:3000/api/llm/stats/CHATBOT_ID?days=30
```

### 6. Testar Cache

```bash
# Obter estatísticas do cache
curl http://localhost:3000/api/cache/stats

# Limpar cache
curl -X POST http://localhost:3000/api/cache/clear \
  -H "Content-Type: application/json" \
  -d '{"pattern": "extraction:*"}'
```

---

## 🔍 Troubleshooting

### Problema: Erro ao conectar no PostgreSQL

**Solução:**
1. Verifique se a URL está correta
2. Teste a conexão:

```bash
psql "postgresql://usuario:senha@host/database"
```

3. Se não funcionar, use SQLite temporariamente:

```env
USE_POSTGRES=false
```

### Problema: Erro ao conectar no Redis

**Solução:**
1. Verifique se a URL está correta
2. Teste a conexão:

```bash
redis-cli -u redis://default:senha@host:port ping
```

3. Se não funcionar, use cache in-memory:

```env
USE_REDIS=false
```

### Problema: Stripe não funciona

**Solução:**
1. Verifique se as chaves estão corretas
2. Use o modo de teste primeiro (`sk_test_...`)
3. Configure o webhook corretamente
4. Se não precisar de pagamentos agora, deixe desabilitado

### Problema: Server não inicia

**Solução:**
1. Verifique os logs:

```bash
npm start
```

2. Verifique se todas as dependências estão instaladas:

```bash
npm install
```

3. Verifique se o `.env` está configurado corretamente

4. Teste a sintaxe:

```bash
node -c server.js
```

### Problema: Rotas antigas não funcionam

**Solução:**
Todas as rotas antigas foram mantidas. Se alguma não funcionar:

1. Verifique se o `server-melhorado.js` foi copiado corretamente
2. Compare com o `server.js.original`
3. Se necessário, reverta:

```bash
cp server.js.original server.js
```

---

## 📊 Estrutura de Arquivos

```
linkmagico-melhorado/
├── server.js                    # Server principal (melhorado)
├── server.js.original           # Backup do original
├── server-melhorado.js          # Versão melhorada (antes de copiar)
├── database.js                  # Sistema de banco de dados
├── cache.js                     # Sistema de cache
├── webhooks.js                  # Sistema de webhooks
├── billing.js                   # Sistema de billing
├── analytics.js                 # Sistema de analytics
├── llm-optimizer.js             # Otimização de custos LLM
├── knowledge-base.js            # Gestão de conhecimento
├── routes.js                    # Novas rotas de API
├── init.js                      # Script de inicialização
├── .env                         # Variáveis de ambiente
├── .env.example                 # Exemplo de configuração
├── package.json                 # Dependências
├── GUIA_CONFIGURACAO.md         # Este arquivo
└── data/                        # Dados persistentes
    ├── linkmagico.db            # SQLite database (dev)
    ├── analytics/               # Arquivos de analytics
    └── knowledge/               # Bases de conhecimento
```

---

## 🎯 Próximos Passos

### Curto Prazo:

1. ✅ Testar todas as funcionalidades localmente
2. ✅ Fazer deploy no Render
3. ✅ Configurar PostgreSQL e Redis
4. ✅ Configurar Stripe (se for usar pagamentos)

### Médio Prazo:

1. 📱 Desenvolver app Shopify
2. 🔌 Plugin WooCommerce
3. 📧 Sistema de email
4. 📊 Dashboard visual (frontend)

### Longo Prazo:

1. 🤖 Integração com mais LLMs
2. 🌍 Suporte multi-idioma
3. 📱 App mobile
4. 🎨 White-label completo

---

## 📞 Suporte

Se tiver dúvidas ou problemas:

1. Verifique este guia primeiro
2. Consulte os logs do servidor
3. Teste as rotas de API
4. Verifique as variáveis de ambiente

---

## 🎉 Conclusão

Parabéns! Você agora tem uma versão profissional e escalável do Link Mágico com:

- ✅ Banco de dados persistente
- ✅ Cache inteligente
- ✅ Analytics profissional
- ✅ Sistema de webhooks
- ✅ Billing e pagamentos
- ✅ Gestão de conhecimento
- ✅ Otimização de custos
- ✅ Todas as funcionalidades originais mantidas

**Boa sorte com seu projeto!** 🚀
