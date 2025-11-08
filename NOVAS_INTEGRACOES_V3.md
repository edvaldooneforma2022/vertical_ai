# 🚀 Link Mágico V3.0 - Novas Integrações

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Gmail Integration](#1-gmail-integration)
3. [WhatsApp Integration](#2-whatsapp-integration)
4. [ChatGPT Integration](#3-chatgpt-integration)
5. [Whitelabel System](#4-whitelabel-system)
6. [Structured Leads](#5-structured-leads)
7. [CRM Integrations](#6-crm-integrations)
8. [Configuração Rápida](#configuração-rápida)
9. [Troubleshooting](#troubleshooting)

---

## Visão Geral

O Link Mágico V3.0 adiciona **6 integrações profissionais** que transformam sua ferramenta em uma plataforma empresarial completa:

| Integração | Descrição | Benefício |
|------------|-----------|-----------|
| 📧 **Gmail** | Envio automático de emails | Notificações instantâneas de leads |
| 📱 **WhatsApp** | Mensagens via WhatsApp Business | Alcance imediato no canal preferido |
| 🤖 **ChatGPT** | GPT-4 e GPT-3.5 Turbo | Respostas de altíssima qualidade |
| 🎨 **Whitelabel** | Personalização total da marca | Venda como produto próprio |
| 📝 **Leads Estruturados** | Captura organizada com validação | Dados limpos e exportáveis |
| 🔗 **CRM** | Integração com RD, HubSpot, etc. | Automação de vendas |

---

## 1. Gmail Integration

### 📧 O Que É?

Sistema para enviar emails automáticos quando eventos importantes acontecem (novo lead, alta intenção, etc.).

### ✨ Funcionalidades

- ✅ Notificação automática quando captura lead
- ✅ Email de boas-vindas para o lead
- ✅ Templates customizáveis
- ✅ Suporte a variáveis dinâmicas
- ✅ Teste de conexão integrado

### 🔧 Configuração

#### Passo 1: Gerar Senha de Aplicativo no Gmail

1. Acesse: https://myaccount.google.com/apppasswords
2. Selecione "App: Email" e "Device: Outro"
3. Digite "Link Mágico" e clique em "Gerar"
4. Copie a senha gerada (16 caracteres)

#### Passo 2: Configurar no .env

```env
GMAIL_USER=seu@gmail.com
GMAIL_PASSWORD=abcd efgh ijkl mnop
GMAIL_FROM=seu@gmail.com
OWNER_EMAIL=seu@gmail.com
```

#### Passo 3: Testar no Painel

1. Abra o painel: `/app`
2. Clique em "🚀 Novos Sistemas V2.0"
3. Vá na aba "📧 Gmail"
4. Preencha os campos
5. Clique em "Testar Conexão"

### 📝 Templates Disponíveis

#### 1. Novo Lead Capturado

Enviado para você quando um lead é capturado.

**Variáveis:**
- `{{chatbotName}}` - Nome do chatbot
- `{{leadName}}` - Nome do lead
- `{{leadEmail}}` - Email do lead
- `{{leadPhone}}` - Telefone do lead
- `{{timestamp}}` - Data/hora
- `{{lastMessage}}` - Última mensagem

#### 2. Boas-vindas ao Lead

Enviado automaticamente para o lead após captura.

**Variáveis:**
- `{{leadName}}` - Nome do lead
- `{{companyName}}` - Nome da sua empresa

### 💻 Uso via API

```javascript
// Enviar email customizado
const response = await fetch('/api/gmail/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        to: 'cliente@email.com',
        subject: 'Assunto do Email',
        html: '<h1>Olá!</h1><p>Conteúdo do email</p>'
    })
});
```

---

## 2. WhatsApp Integration

### 📱 O Que É?

Sistema para enviar mensagens via WhatsApp Business API usando Twilio ou Evolution API.

### ✨ Funcionalidades

- ✅ Notificação de novo lead no WhatsApp
- ✅ Alerta de alta intenção de compra
- ✅ Resumo diário de performance
- ✅ Suporte a Twilio (pago) e Evolution (gratuito)
- ✅ Templates personalizáveis

### 🔧 Configuração

#### Opção A: Twilio (Recomendado para Produção)

**Passo 1: Criar Conta Twilio**

1. Acesse: https://www.twilio.com/try-twilio
2. Crie uma conta gratuita
3. Ative WhatsApp Sandbox ou compre número

**Passo 2: Obter Credenciais**

1. Dashboard > Account Info
2. Copie Account SID e Auth Token

**Passo 3: Configurar no .env**

```env
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=+14155238886
OWNER_WHATSAPP=+5511999999999
```

#### Opção B: Evolution API (Gratuito)

**Passo 1: Instalar Evolution API**

```bash
# Docker
docker run -d \
  --name evolution-api \
  -p 8080:8080 \
  atendai/evolution-api
```

**Passo 2: Criar Instância**

```bash
curl -X POST http://localhost:8080/instance/create \
  -H "apikey: SUA_CHAVE" \
  -d '{"instanceName": "meu_chatbot"}'
```

**Passo 3: Configurar no .env**

```env
WHATSAPP_PROVIDER=evolution
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua_chave_api
EVOLUTION_INSTANCE_NAME=meu_chatbot
OWNER_WHATSAPP=+5511999999999
```

### 📝 Templates Disponíveis

#### 1. Novo Lead

```
🎉 *Novo Lead Capturado!*

📋 *Informações:*
• Nome: {{leadName}}
• Email: {{leadEmail}}
• Telefone: {{leadPhone}}

⏰ {{timestamp}}
```

#### 2. Alta Intenção

```
🔥 *Lead com Alta Intenção!*

Um cliente demonstrou muito interesse!

📋 *Dados:*
• Nome: {{leadName}}
• Interesse: {{interest}}

💡 Entre em contato AGORA!
```

### 💻 Uso via API

```javascript
// Enviar mensagem WhatsApp
const response = await fetch('/api/whatsapp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        to: '+5511999999999',
        message: 'Olá! Novo lead capturado.'
    })
});
```

---

## 3. ChatGPT Integration

### 🤖 O Que É?

Integração com modelos GPT-4, GPT-4 Turbo e GPT-3.5 Turbo da OpenAI para respostas de altíssima qualidade.

### ✨ Funcionalidades

- ✅ Suporte a GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
- ✅ Seleção de modelo por chatbot
- ✅ Cálculo automático de custos
- ✅ Comparação de modelos
- ✅ Fallback para GROQ se ChatGPT falhar

### 🔧 Configuração

#### Passo 1: Obter API Key

1. Acesse: https://platform.openai.com/api-keys
2. Clique em "Create new secret key"
3. Copie a chave (começa com `sk-proj-`)

#### Passo 2: Configurar no .env

```env
CHATGPT_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxx
```

#### Passo 3: Escolher Modelo Padrão

No painel, vá em "🤖 ChatGPT" e selecione:

| Modelo | Quando Usar |
|--------|-------------|
| **GPT-4** | Máxima qualidade, respostas complexas |
| **GPT-4 Turbo** | Melhor custo-benefício (recomendado) |
| **GPT-3.5 Turbo** | Respostas rápidas, economia máxima |

### 💰 Comparação de Custos

| Modelo | Custo/1k tokens | Qualidade | Velocidade |
|--------|-----------------|-----------|------------|
| GPT-4 | $0.03 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| GPT-4 Turbo | $0.01 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| GPT-3.5 Turbo | $0.0015 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Exemplo de custo:**
- 1.000 conversas/mês
- 500 tokens/conversa
- **GPT-4 Turbo:** ~$5/mês
- **GPT-3.5 Turbo:** ~$0.75/mês

### 💻 Uso via API

```javascript
// Gerar resposta com ChatGPT
const response = await fetch('/api/chatgpt/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        prompt: 'Qual o horário de funcionamento?',
        model: 'gpt-4-turbo',
        pageContent: 'Conteúdo da página...'
    })
});
```

---

## 4. Whitelabel System

### 🎨 O Que É?

Sistema para remover a marca "Link Mágico" e personalizar com sua própria marca.

### ✨ Funcionalidades

- ✅ Logo customizado
- ✅ Cores personalizadas
- ✅ Remover "Powered by"
- ✅ Domínio próprio
- ✅ CSS customizado
- ✅ Preview em tempo real

### 🔧 Configuração

#### Requisitos

- Plano **Profissional** ou **Empresarial**

#### Passo 1: Preparar Assets

1. **Logo:** PNG/SVG transparente, 200x50px
2. **Favicon:** ICO ou PNG, 32x32px
3. **Cores:** Escolha 2 cores que combinem

#### Passo 2: Configurar no Painel

1. Abra o painel: `/app`
2. Clique em "🚀 Novos Sistemas V2.0"
3. Vá na aba "🎨 Whitelabel"
4. Preencha:
   - Nome da Empresa
   - URL do Logo
   - Cor Primária
   - Cor Secundária
   - Mostrar "Powered by" (desmarque)
5. Clique em "Salvar Personalização"

#### Passo 3: Ver Preview

O preview aparece automaticamente abaixo do formulário.

### 📝 Exemplo de Configuração

```javascript
{
    companyName: "Minha Empresa",
    logoUrl: "https://exemplo.com/logo.png",
    primaryColor: "#FF6B6B",
    secondaryColor: "#4ECDC4",
    showPoweredBy: false,
    customDomain: "chat.minhaempresa.com"
}
```

### 🎨 CSS Customizado

Você pode adicionar CSS customizado para personalizar ainda mais:

```css
/* Exemplo de CSS customizado */
.chatbot-container {
    font-family: 'Montserrat', sans-serif;
    border-radius: 20px;
}

.chatbot-header {
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

.message-user {
    border-radius: 18px 18px 4px 18px;
}
```

---

## 5. Structured Leads

### 📝 O Que É?

Sistema avançado de captura de leads com campos estruturados, validação e exportação.

### ✨ Funcionalidades

- ✅ Campos separados (nome, email, telefone, empresa, etc.)
- ✅ Validação automática de email e telefone
- ✅ Score automático de qualificação (0-100)
- ✅ Classificação: Hot, Warm, Cold
- ✅ Exportação para CSV
- ✅ Estatísticas em tempo real

### 🔧 Configuração

#### Campos Disponíveis

**Obrigatórios:**
- Nome
- Email

**Opcionais:**
- Telefone
- Empresa
- Cargo
- Website
- Produto de Interesse
- Nível de Interesse
- Faixa de Orçamento

**Automáticos:**
- Score (0-100)
- Status (hot/warm/cold)
- Origem (URL, UTM)
- Duração da conversa
- Total de mensagens

### 📊 Sistema de Scoring

O score é calculado automaticamente baseado em:

| Fator | Pontos |
|-------|--------|
| Nome preenchido | 10 |
| Email preenchido | 10 |
| Telefone preenchido | 15 |
| Empresa preenchida | 10 |
| Cargo preenchido | 10 |
| Website preenchido | 5 |
| Produto de interesse | 15 |
| Interesse alto | 20 |
| Orçamento informado | 10 |
| Mais de 5 mensagens | 10 |
| Conversa > 2 minutos | 10 |

**Classificação:**
- **Hot (70-100):** Lead qualificado, pronto para venda
- **Warm (40-69):** Lead interessado, precisa nutrição
- **Cold (0-39):** Lead frio, baixo interesse

### 💻 Uso via API

#### Salvar Lead Estruturado

```javascript
const response = await fetch('/api/leads/structured', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        chatbotId: 'seu_chatbot_id',
        leadData: {
            name: 'João Silva',
            email: 'joao@empresa.com',
            phone: '(11) 98765-4321',
            company: 'Empresa XYZ',
            position: 'Gerente de Marketing',
            interestProduct: 'Plano Profissional',
            interestLevel: 'high',
            budgetRange: 'R$ 500-1000'
        },
        metadata: {
            sourceUrl: 'https://exemplo.com',
            utmSource: 'google',
            utmMedium: 'cpc'
        }
    })
});
```

#### Buscar Leads

```javascript
const response = await fetch('/api/leads/structured/seu_chatbot_id?status=hot&limit=50');
const data = await response.json();
```

#### Exportar CSV

```javascript
const response = await fetch('/api/leads/export/seu_chatbot_id');
const blob = await response.blob();
// Download automático
```

### 📥 Exportação CSV

O CSV exportado contém todas as colunas:

```csv
ID,Nome,Email,Telefone,Empresa,Cargo,Website,Produto de Interesse,Nível de Interesse,Faixa de Orçamento,Score,Status,Total de Mensagens,Duração da Conversa,Origem URL,UTM Source,UTM Medium,UTM Campaign,Data de Criação,Notas
```

---

## 6. CRM Integrations

### 🔗 O Que É?

Documentação e templates prontos para integrar com os principais CRMs via webhooks.

### ✨ CRMs Suportados

1. **RD Station** - CRM brasileiro líder
2. **HubSpot** - Plataforma completa
3. **Pipedrive** - Focado em vendas
4. **ActiveCampaign** - Automação de marketing

### 🔧 Configuração

#### RD Station

**Passo 1: Obter Token**

1. Acesse: https://app.rdstation.com.br/integracoes
2. Vá em "API" > "Gerar Token Público"
3. Copie o token

**Passo 2: Configurar Webhook**

```bash
POST /api/webhooks/seu_chatbot_id

{
  "eventType": "lead_captured",
  "url": "https://api.rd.services/platform/conversions?api_key=SEU_TOKEN",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "payloadTemplate": {
    "event_type": "CONVERSION",
    "event_family": "CDP",
    "payload": {
      "conversion_identifier": "lead_chatbot",
      "name": "{{leadName}}",
      "email": "{{leadEmail}}",
      "mobile_phone": "{{leadPhone}}",
      "cf_origem": "Chatbot"
    }
  }
}
```

#### HubSpot

**Passo 1: Criar Formulário**

1. Marketing > Lead Capture > Forms
2. Create Form
3. Copie Form GUID

**Passo 2: Configurar Webhook**

```bash
POST /api/webhooks/seu_chatbot_id

{
  "eventType": "lead_captured",
  "url": "https://api.hsforms.com/submissions/v3/integration/submit/PORTAL_ID/FORM_GUID",
  "method": "POST",
  "payloadTemplate": {
    "fields": [
      {"name": "firstname", "value": "{{leadName}}"},
      {"name": "email", "value": "{{leadEmail}}"},
      {"name": "phone", "value": "{{leadPhone}}"}
    ]
  }
}
```

### 💻 Uso via Painel

1. Abra o painel: `/app`
2. Clique em "🚀 Novos Sistemas V2.0"
3. Vá na aba "🔗 Webhooks"
4. Clique em "Adicionar Webhook"
5. Escolha o CRM
6. Preencha as credenciais
7. Teste a integração

---

## Configuração Rápida

### 🚀 Setup em 10 Minutos

#### 1. Instalar Dependências

```bash
cd linkmagico-v3
npm install
```

#### 2. Configurar .env

Copie `.env.example` para `.env` e preencha:

```env
# Obrigatório
GROQ_API_KEY=sua_chave_groq

# Gmail (Opcional)
GMAIL_USER=seu@gmail.com
GMAIL_PASSWORD=senha_de_app

# ChatGPT (Opcional)
CHATGPT_API_KEY=sk-proj-xxx

# WhatsApp (Opcional)
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
```

#### 3. Iniciar Servidor

```bash
npm start
```

#### 4. Acessar Painel

```
http://localhost:3000/app
```

#### 5. Configurar Integrações

1. Clique em "🚀 Novos Sistemas V2.0"
2. Configure cada integração desejada
3. Teste cada uma
4. Pronto!

---

## Troubleshooting

### Gmail Não Envia

**Problema:** Emails não são enviados

**Soluções:**
1. Verifique se gerou senha de aplicativo (não use senha normal)
2. Ative "Acesso a apps menos seguros" se necessário
3. Teste conexão no painel
4. Veja logs do servidor

### WhatsApp Não Conecta

**Problema:** Mensagens não são enviadas

**Soluções:**
1. **Twilio:** Verifique se ativou WhatsApp Sandbox
2. **Evolution:** Verifique se API está rodando
3. Teste com número de telefone válido (+55...)
4. Veja logs do servidor

### ChatGPT Erro de API

**Problema:** "API key invalid"

**Soluções:**
1. Verifique se API key começa com `sk-proj-`
2. Verifique se tem créditos na conta OpenAI
3. Teste API key em: https://platform.openai.com/playground
4. Gere nova chave se necessário

### Whitelabel Não Aparece

**Problema:** Personalização não aplicada

**Soluções:**
1. Verifique se está no plano Profissional/Empresarial
2. Limpe cache do navegador
3. Verifique se URL do logo é válida
4. Teste em modo anônimo

### Leads Não Aparecem

**Problema:** Lista de leads vazia

**Soluções:**
1. Capture um lead de teste primeiro
2. Clique em "🔄 Atualizar"
3. Verifique se chatbot ID está correto
4. Veja logs do servidor

---

## 📞 Suporte

Precisa de ajuda? Entre em contato:

- **Email:** suporte@linkmagico.com
- **WhatsApp:** +55 11 99999-9999
- **Documentação:** https://docs.linkmagico.com

---

**Versão:** 3.0.0  
**Data:** 09 de Outubro de 2025  
**Autor:** Manus AI

**🎉 Parabéns! Você agora tem uma plataforma de chatbot de nível empresarial!**

