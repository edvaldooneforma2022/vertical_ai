# Link Mágico - Atualizações Recentes (Janeiro 2026)

## Correções de Bugs Implementadas

### BUG-004: Validação ao Compartilhar nas Redes Sociais ✅

**Problema:** Ao clicar nos botões de compartilhamento (WhatsApp, Facebook, etc.) antes de ativar o assistente, ocorria erro de API Key.

**Solução:** Adicionada validação defensiva. Agora ao clicar em qualquer botão de compartilhamento social antes de ativar o chatbot, aparece a mensagem:

> ⚠️ "Ative o assistente primeiro antes de compartilhar!"

**Arquivos alterados:**
- `public/index_app.html`
- `public/app_scripts.js`

---

### BUG-002: Status do Sistema ✅

**Problema:** A aba "Sistema" ficava carregando indefinidamente.

**Solução:** Corrigido endpoint `/api/system/status` para retornar dados corretamente, mostrando:
- Status do servidor (online/degradado)
- Uptime
- Versão da plataforma
- Serviços de IA disponíveis

---

### BUG-001: Contagem de Analytics ✅

**Problema:** O contador de mensagens não refletia os valores reais.

**Solução:** Corrigida query SQL que busca métricas de mensagens por tenant.

---

## Novas Funcionalidades

### Filtros de Período no Analytics
Agora você pode filtrar estatísticas por:
- Últimos 7 dias
- Últimos 30 dias
- Últimos 90 dias

### Aba Widget Dedicada
Nova aba exclusiva para configuração e cópia do código do widget.

### Integração Multi-Tenant WhatsApp e ChatGPT
Cada usuário pode configurar suas próprias credenciais de forma isolada e segura.

---

## Como Atualizar

O sistema é atualizado automaticamente via deploy no Render. Basta acessar a plataforma para usar as novas funcionalidades.

---

*Última atualização: 13 de Janeiro de 2026*
