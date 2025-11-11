# 📅 Implementação de Agendamento - Link Mágico

## 🎯 Objetivo
Implementar uma funcionalidade robusta de agendamento de reuniões/contatos no chatbot, garantindo que os dados sejam persistidos e associados corretamente ao lead do cliente (tenant).

## 🛠️ Alterações Realizadas

### 1. Backend (server.js)

#### 1.1. Rota de API Dedicada
- **Nova Rota:** `POST /api/schedule-booking`
- **Função:** Recebe os dados do agendamento (`nome`, `email`, `horario`, `apiKey`, etc.), valida a `apiKey` e persiste o agendamento.
- **Validação:** Requer `apiKey`, `email` e `horario`. Retorna 401 ou 400 em caso de falha.
- **Notificação:** Adicionado `console.log` para simular a notificação imediata de um novo agendamento.

#### 1.2. Persistência de Dados
- **Classe `LeadCaptureSystem`:** Adicionado o método `addBooking(bookingData)`.
- **Função:** Este método localiza o lead pelo email e adiciona o agendamento a um novo array `lead.bookings`.
- **Jornada do Cliente:** O estágio da jornada (`journeyStage`) do lead é automaticamente alterado para `"negociacao"` após o agendamento.

### 2. Frontend (JavaScript do Chatbot embutido no server.js)

#### 2.1. Interface de Agendamento
- **Novo HTML:** Injetado um formulário de agendamento (`#agendamentoForm`) no HTML do chatbot.
- **Campos:** Nome, Email (preenchidos automaticamente do lead) e um `select` para o horário.
- **Botões:** "Confirmar Agendamento" e "Cancelar".

#### 2.2. Lógica de Interação
- **`iniciarAgendamento()`:** A função foi modificada para:
    - Verificar se o lead já foi capturado.
    - Ocultar a interface de chat e mostrar o formulário de agendamento.
    - Preencher o `select` de horários (atualmente simulado com horários fixos).
- **Submissão:** O botão "Confirmar Agendamento" faz uma requisição `POST` para a nova rota `/api/schedule-booking`, enviando todos os dados necessários, incluindo a `apiKey`.
- **Confirmação:** Após o sucesso da API, o formulário é ocultado e uma mensagem de confirmação é enviada para o chat.

#### 2.3. Lógica de IA (SuperInteligenciaEmocional)
- **`detectarAgendamento()`:** A função agora retorna uma mensagem instruindo o usuário a usar o botão "Agendar" (em vez de tentar processar a seleção de horário via chat).
- **`gerarOpcoesAgendamento()` e `processarAgendamento()`:** Foram desativadas/simplificadas, pois a lógica de agendamento agora é tratada pelo formulário e pela rota de API dedicada.

## 🧪 Teste de Validação

### 1. Teste de API (Backend)
- **Arquivo:** `test-api-booking.js`
- **Instrução:** Rode este script com o servidor `server.js` ativo na porta 3000 para validar a nova rota `/api/schedule-booking`.

### 2. Teste de Interface (Frontend)
1. Abra o chatbot (link ou preview).
2. Preencha o formulário de leads e clique em "Iniciar Conversa".
3. Clique no botão **"Agendar"** (ou digite algo como "quero agendar").
4. O formulário de agendamento deve aparecer.
5. Selecione um horário e clique em "Confirmar Agendamento".
6. Verifique se a mensagem de confirmação aparece no chat e se o console do servidor exibe a notificação de agendamento.

## 📦 Arquivos Modificados
- `server.js` (Adição da rota `/api/schedule-booking`, método `addBooking`, e alterações no JavaScript do chatbot).

## 📦 Arquivos Novos
- `test-api-booking.js` (Script de teste para a nova rota).
- `README_AGENDAMENTO.md` (Este documento).
