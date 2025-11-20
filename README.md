# ✨ Link_Mágico — Plataforma de IA Conversacional Inteligente  
**Versão:** 7.0  
**Status:** Ativa e em Produção  
**Tecnologias:** Node.js · Express · PostgreSQL/JSON · OpenAI · Redis Cache · Playwright Stealth · Crawler Inteligente

---

## 📌 Sobre o Link Mágico
O **Link Mágico** é uma plataforma SaaS de **IA Conversacional Personalizada**, projetada para atender empresas, empreendedores, criadores de conteúdo e profissionais que desejam oferecer:

- Atendimento automático 24h  
- Geração de leads qualificados  
- Agendamento inteligente  
- Funis de vendas personalizados  
- Extração automática de informações (Crawler IA)  
- Integração com WhatsApp, E-mail e Marketing  

Tudo isso através de um **chat flutuante**, fácil de instalar, auto configurável e totalmente inteligente.

---

## 🎯 Objetivo da Plataforma
Criar uma experiência de atendimento **personalizada**, com IA capaz de:

- Entender emoções  
- Adaptar personalidade  
- Seguir jornadas conversacionais  
- Agendar reuniões automaticamente  
- Registrar leads em CRM interno  
- Executar ações reais (API Actions)  
- Avaliar risco, intenção, urgência e nível do usuário  

---

## 🚀 Principais Recursos

### 🧠 Inteligência Conversacional Evoluída
- Raciocínio avançado  
- Emoções contextuais  
- Memória de longo prazo  
- Perfil comportamental do usuário  
- Linguagem natural em formato humano real  

### 🤖 Motor de IA Multi-Camadas
- Mecanismo primário conversacional  
- Mecanismo secundário de contextualização  
- Mecanismo de interpretação semântica  
- Cálculo de intenção, urgência e risco  
- Controle de tom, humor e jornada  

---

## 📅 Agendamento Inteligente V7
A plataforma agora conta com um **sistema real de agendamentos**, gratuito e integrado:

- Cadastro de horários disponíveis  
- Registro de reuniões  
- Responses automáticas da IA  
- Consulta rápida de slots livres  
- Criação automática de reuniões durante o chat  
- Compatível com multi-tenant  

*(Versão inicial — microserviço separado ou acoplado ao backend principal.)*

---

## 🕸 Crawler / Extração Inteligente (IA)
O Link Mágico possui um sistema de EXTRAÇÃO AUTOMÁTICA que utiliza:

- Axios (requisições rápidas)
- Cheerio (scraping estruturado)
- Playwright Stealth (para páginas complexas)
- Fallback automático
- Sanitização de dados
- Parsing semântico
- Geração de insights automáticos

Ideal para:

- captar dados de sites  
- localizar preços  
- extrair descrições  
- coletar informações públicas  

---

## ⚙️ Arquitetura Interna
O backend contém:

- **Servidor Express modular**  
- **Sistema de Segurança Interno (WAF, Threat IA, RateLimit)**  
- **Gerenciamento de Tenants**  
- **Cache Redis com fallback JSON**  
- **Database inteligente (Postgres ou JSON dinâmico)**  
- **Módulo de Backup automático**  
- **CRM interno integrado**  
- **Widget externo com injeção inteligente**  

---

## 🔗 Integrações Disponíveis

### 📞 WhatsApp (API externa)
Envio e recepção de mensagens automáticas.

### 📧 Gmail API
Leitura e envio de e-mails.

### 🤖 OpenAI (Modelos suportados)
- GPT-4  
- GPT-4.1  
- GPT-4o  
- GPT-o-mini  
- O1 / O1-Mini  
- Funções / Actions  

### 🌐 API HTTP + Webhooks
- Rotas públicas  
- Rotas autenticadas  
- Rotas admin  
- Rotas de backup  
- Rotas de agendamento  

---

## 🧩 Widget.js (Instalação Simples)
O widget de chat pode ser instalado com:

```html
<script src="https://SEU_DOMINIO/widget.js"></script>

Inclui:

Botão flutuante inteligente

Adaptativo ao dispositivo

IA embarcada

Carregamento rápido

Sistema de fallback

📁 Estrutura do Projeto
/root
 ├── server.js               # Backend principal
 ├── public/                 # Arquivos estáticos
 ├── widget/                 # Widget.js externo
 ├── ai/                     # Módulo de IA principal
 ├── scheduler/              # Microserviço de Agendamento
 ├── database/               # Arquivos de data
 ├── backups/                # Backups automáticos
 └── README.md               # Este arquivo

⚡ Deploy

Pode ser hospedado em:

Render (free)

Railway (free)

Fly.io

GitHub Codespaces

Servidores básicos Node.js

Comando padrão:

npm install
npm run start

🔐 Segurança

O Link Mágico inclui:

Firewall interno (ApplicationFirewall)

Limitação de requisições

Anti-bot

Anti-spam

Verificação de autenticidade

Controle de tenants

Sanitização de entrada

Backup automático de leads

📦 Sistema de Agendamento (v1.0)

Endpoints principais:

POST /api/schedule/create
GET  /api/schedule/slots
GET  /api/schedule/list


Integração rápida com IA e frontend.

🛠 Desenvolvimento

Clone o repositório:

git clone https://github.com/SEU_USUARIO/vertical_ai.git
cd vertical_ai
npm install
npm start

🤝 Contribuição

Contribuições são bem-vindas!

Faça um fork → crie uma branch → envie seu Pull Request.

📄 Licença

Este projeto é distribuído sob licença MIT.
Uso comercial permitido.

👨‍💻 Criado por

Edvaldo — Link Mágico
Uma plataforma de IA feita para transformar negócios.