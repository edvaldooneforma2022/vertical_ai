# Arquitetura do Sistema LinkMágico v7.0

## Visão Geral

O LinkMágico é uma plataforma SaaS de chatbot com IA para vendas e captura de leads. Este documento descreve a arquitetura crítica que **NÃO DEVE SER ALTERADA** sem revisão cuidadosa.

---

## Estrutura de Arquivos Críticos

```
vertical_ai/
├── server.js              # ⚠️ CRÍTICO - Servidor principal (210KB)
├── public/
│   ├── index_app.html     # ⚠️ CRÍTICO - Painel administrativo
│   ├── chat.html          # Página do chatbot (fallback)
│   └── widget.js          # Widget externo
├── data/
│   ├── api_keys.json      # ⚠️ CRÍTICO - Chaves de API dos clientes
│   └── leads_*.json       # Dados de leads por tenant
└── tests/                 # Testes automatizados
```

---

## Endpoints Críticos da API

### Autenticação e Sessão
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/validate-api-key` | POST | Valida API Key e cria sessão |
| `/app` | GET | Redireciona para painel após autenticação |

### Chatbot
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/chatbot` | GET | Página HTML do chatbot (gerada dinamicamente) |
| `/chat.html` | GET | Página alternativa do chatbot |
| `/api/process-chat-inteligente` | POST | Processa mensagem com IA |
| `/api/chat-universal` | POST | Endpoint alternativo de chat |

### Leads
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/capture-lead` | POST | Captura novo lead |
| `/admin/leads` | GET | Lista todos os leads (requer auth) |
| `/admin/leads/:id` | GET | Obtém lead específico |

### Backup
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/admin/leads/backup/create` | POST | Cria backup manual |
| `/admin/leads/backup/list` | GET | Lista backups disponíveis |
| `/admin/leads/backup/restore` | POST | Restaura backup |

### Agendamentos
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/appointments` | POST | Cria novo agendamento |
| `/admin/appointments` | GET | Lista agendamentos |
| `/api/appointments/:leadId` | GET | Agendamentos de um lead |

---

## Fluxo de Dados Principal

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Site Cliente  │────▶│  Widget/Chatbot │────▶│   API Server    │
│  (widget.js)    │     │   (/chatbot)    │     │   (server.js)   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┼───────────────┐
                        │                                │               │
                        ▼                                ▼               ▼
                ┌───────────────┐              ┌─────────────┐   ┌──────────────┐
                │ LeadCaptureSystem│           │  Groq/OpenAI │   │   Analytics  │
                │ (Multi-Tenant)   │           │     LLM      │   │    Manager   │
                └───────┬───────┘              └─────────────┘   └──────────────┘
                        │
                        ▼
                ┌───────────────┐
                │  JSON/PostgreSQL│
                │    Storage      │
                └─────────────────┘
```

---

## Sistema de Tenancy (Isolamento por API Key)

Cada cliente possui uma API Key única que isola seus dados:

```javascript
// Funções de isolamento - NÃO ALTERAR
getLeadSystem(apiKey)       // Retorna sistema de leads do tenant
getBackupSystem(leadSystem, apiKey)  // Retorna sistema de backup do tenant
getTenantDataPath(apiKey)   // Retorna caminho de dados do tenant
```

**Arquivos por Tenant:**
- `data/leads_{apiKey}.json` - Leads do cliente
- `data/backups/{apiKey}/` - Backups do cliente

---

## Funções Críticas no server.js

### Geração de HTML do Chatbot
```javascript
// ⚠️ CRÍTICO - Usa escapeForJS para evitar SyntaxError
function escapeForJS(str)                    // Linha ~4577
function generateFullChatbotHTML(...)        // Linha ~4590
function generateChatbotHTML(...)            // Linha ~4797
```

### Sistema de Leads
```javascript
class LeadCaptureSystem { ... }              // Gerencia leads por tenant
class LeadBackupSystem { ... }               // Sistema de backup
```

### Extração de Páginas
```javascript
async function extractPageData(url) { ... }  // Extrai dados de páginas de vendas
class SistemaExtracaoApurado { ... }         // Sistema de extração aprimorado
```

---

## Configuração de CORS

```javascript
app.use(cors({
    origin: function (origin, callback) {
        // Permitir todas as origens (necessário para widget externo)
        if (!origin) return callback(null, true);
        return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-API-Key"]
}));
```

**⚠️ NÃO RESTRINGIR ORIGENS** - O widget precisa funcionar em qualquer domínio cliente.

---

## Variáveis de Ambiente Críticas

| Variável | Descrição |
|----------|-----------|
| `GROQ_API_KEY` | Chave da API Groq (LLM) |
| `OPENAI_API_KEY` | Chave da API OpenAI (alternativa) |
| `API_KEYS_JSON` | JSON com API Keys dos clientes |
| `SESSION_SECRET` | Segredo para sessões |
| `REDIS_URL` | URL do Redis (produção) |
| `DATABASE_URL` | PostgreSQL (produção) |

---

## Checklist Antes de Modificar

- [ ] Rodar `npm test` antes de qualquer alteração
- [ ] Verificar se alteração afeta endpoints listados acima
- [ ] Testar escape de strings se alterar geração de HTML
- [ ] Verificar isolamento de tenant se alterar sistema de leads
- [ ] Testar CORS se alterar middleware
- [ ] Validar backup/restore após alterações no LeadCaptureSystem
