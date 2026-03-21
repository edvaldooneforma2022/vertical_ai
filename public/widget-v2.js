/**
 * LinkMágico Widget v2.0 - Design Moderno Inline
 * Widget de chat que abre inline na página (estilo moderno)
 * 
 * Uso:
 * <script>
 *   window.LinkMagicoWidgetConfig = {
 *     robotName: "Meu Assistente",
 *     salesUrl: "https://exemplo.com",
 *     instructions: "Seja amigável",
 *     primaryColor: "#3b82f6",
 *     apiKey: "SUA_API_KEY"
 *   };
 * </script>
 * <script src="https://vertical-ai-dktu.onrender.com/public/widget-v2.js"></script>
 */

(function () {
    'use strict';

    // Configuração padrão
    const config = window.LinkMagicoWidgetConfig || {};
    const robotName = config.robotName || 'Assistente IA';
    const salesUrl = config.salesUrl || window.location.href;
    const instructions = config.instructions || '';
    const primaryColor = config.primaryColor || '#3b82f6';
    const apiKey = config.apiKey || '';
    const apiBase = config.apiBase || 'https://vertical-ai-dktu.onrender.com';
    const avatarUrl = config.avatarUrl || '';
    const greetingMessage = config.greetingMessage || 'Oi! Posso ajudar?';
    const welcomeMessage = config.welcomeMessage || `Olá 👋 Muito bom ter você aqui!`;
    const secondMessage = config.secondMessage || `Vou te ajudar a tirar todas as suas dúvidas!`;

    // Verificar API Key
    if (!apiKey || apiKey === 'SUA_API_KEY') {
        console.error('❌ LinkMágico: API Key não configurada!');
        return;
    }

    // CSS do Widget
    const styles = `
        /* Reset para o widget */
        .lm-widget-container * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }

        /* Container do Widget */
        .lm-widget-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 999999;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 12px;
        }

        /* Tooltip de Saudação */
        .lm-greeting-tooltip {
            background: #1f2937;
            color: white;
            padding: 10px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 15px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            gap: 8px;
            animation: lm-slideIn 0.3s ease;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .lm-greeting-tooltip:hover {
            transform: scale(1.02);
            box-shadow: 0 6px 20px rgba(0,0,0,0.2);
        }

        .lm-greeting-tooltip .lm-online-dot {
            width: 8px;
            height: 8px;
            background: #22c55e;
            border-radius: 50%;
            animation: lm-pulse 2s infinite;
        }

        .lm-greeting-tooltip.lm-hidden {
            display: none;
        }

        /* Balão Flutuante */
        .lm-bubble {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, ${primaryColor} 0%, #1e40af 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
            transition: all 0.3s ease;
            overflow: hidden;
        }

        .lm-bubble:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 25px rgba(59, 130, 246, 0.5);
        }

        .lm-bubble img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .lm-bubble svg {
            width: 28px;
            height: 28px;
            fill: white;
        }

        .lm-bubble.lm-hidden {
            display: none;
        }

        /* Janela do Chat */
        .lm-chat-window {
            position: fixed;
            bottom: 90px;
            right: 20px;
            width: 380px;
            height: 520px;
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15);
            display: none;
            flex-direction: column;
            overflow: hidden;
            animation: lm-scaleIn 0.3s ease;
            z-index: 999998;
        }

        .lm-chat-window.lm-open {
            display: flex;
        }

        /* Header do Chat */
        .lm-chat-header {
            background: white;
            border-bottom: 1px solid #e5e7eb;
            padding: 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .lm-chat-header-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .lm-chat-avatar {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: linear-gradient(135deg, ${primaryColor} 0%, #8b5cf6 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 18px;
            overflow: hidden;
        }

        .lm-chat-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .lm-chat-header-info {
            display: flex;
            flex-direction: column;
        }

        .lm-chat-header-subtitle {
            font-size: 12px;
            color: #6b7280;
        }

        .lm-chat-header-title {
            font-size: 15px;
            font-weight: 600;
            color: #1f2937;
        }

        .lm-chat-header-right {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .lm-header-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: none;
            background: #f3f4f6;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            color: #6b7280;
        }

        .lm-header-btn:hover {
            background: #e5e7eb;
            color: #1f2937;
        }

        /* Área de Mensagens */
        .lm-chat-messages {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            background: #f9fafb;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        /* Mensagens */
        .lm-message {
            max-width: 80%;
            padding: 12px 16px;
            border-radius: 18px;
            font-size: 14px;
            line-height: 1.5;
            animation: lm-fadeIn 0.3s ease;
        }

        .lm-message.lm-bot {
            background: white;
            color: #1f2937;
            align-self: flex-start;
            border: 1px solid #e5e7eb;
            border-bottom-left-radius: 4px;
        }

        .lm-message.lm-user {
            background: linear-gradient(135deg, ${primaryColor} 0%, #1e40af 100%);
            color: white;
            align-self: flex-end;
            border-bottom-right-radius: 4px;
        }

        /* Rating Stars */
        .lm-rating {
            display: flex;
            gap: 2px;
            margin-top: 8px;
        }

        .lm-rating span {
            color: #fbbf24;
            font-size: 14px;
        }

        /* Quick Replies */
        .lm-quick-replies {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 12px;
        }

        .lm-quick-reply {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 20px;
            padding: 8px 16px;
            font-size: 13px;
            color: #374151;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .lm-quick-reply:hover {
            background: ${primaryColor};
            color: white;
            border-color: ${primaryColor};
        }

        /* Indicador de Digitação */
        .lm-typing {
            display: none;
            align-items: center;
            gap: 4px;
            padding: 12px 16px;
            background: white;
            border-radius: 18px;
            border: 1px solid #e5e7eb;
            align-self: flex-start;
            max-width: 80px;
        }

        .lm-typing.lm-active {
            display: flex;
        }

        .lm-typing-dot {
            width: 8px;
            height: 8px;
            background: #9ca3af;
            border-radius: 50%;
            animation: lm-typingBounce 1.4s infinite;
        }

        .lm-typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .lm-typing-dot:nth-child(3) { animation-delay: 0.4s; }

        /* Área de Input */
        .lm-chat-input-area {
            padding: 16px;
            background: white;
            border-top: 1px solid #e5e7eb;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .lm-chat-input {
            flex: 1;
            border: 1px solid #e5e7eb;
            border-radius: 24px;
            padding: 12px 20px;
            font-size: 14px;
            outline: none;
            transition: all 0.2s ease;
            background: #f9fafb;
        }

        .lm-chat-input:focus {
            border-color: ${primaryColor};
            background: white;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .lm-chat-input::placeholder {
            color: #9ca3af;
        }

        .lm-send-btn {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            border: none;
            background: linear-gradient(135deg, ${primaryColor} 0%, #1e40af 100%);
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
        }

        .lm-send-btn:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
        }

        .lm-send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }

        .lm-send-btn svg {
            width: 20px;
            height: 20px;
        }

        /* Formulário de Lead Compacto */
        .lm-lead-prompt {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 16px;
            margin: 8px 0;
            align-self: flex-start;
            max-width: 90%;
        }

        .lm-lead-prompt input {
            width: 100%;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 10px 14px;
            font-size: 14px;
            margin-bottom: 10px;
            outline: none;
            transition: all 0.2s ease;
        }

        .lm-lead-prompt input:focus {
            border-color: ${primaryColor};
        }

        .lm-lead-prompt button {
            width: 100%;
            background: linear-gradient(135deg, ${primaryColor} 0%, #1e40af 100%);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 10px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .lm-lead-prompt button:hover {
            opacity: 0.9;
        }

        /* Animações */
        @keyframes lm-slideIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes lm-scaleIn {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
        }

        @keyframes lm-fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes lm-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        @keyframes lm-typingBounce {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-4px); }
        }

        /* Responsivo */
        @media (max-width: 480px) {
            .lm-chat-window {
                width: calc(100% - 20px);
                height: calc(100% - 100px);
                right: 10px;
                bottom: 80px;
                border-radius: 20px;
            }

            .lm-widget-container {
                right: 10px;
                bottom: 10px;
            }

            .lm-bubble {
                width: 55px;
                height: 55px;
            }

            .lm-greeting-tooltip {
                display: none;
            }
        }
    `;

    // Injetar CSS
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    // Criar HTML do Widget
    const widgetHTML = `
        <div class="lm-widget-container" id="lmWidgetContainer">
            <!-- Tooltip de Saudação -->
            <div class="lm-greeting-tooltip" id="lmGreeting" onclick="window.LMWidget.open()">
                <span class="lm-online-dot"></span>
                <span>${greetingMessage}</span>
            </div>

            <!-- Balão Flutuante -->
            <div class="lm-bubble" id="lmBubble" onclick="window.LMWidget.toggle()">
                ${avatarUrl ? `<img src="${avatarUrl}" alt="Avatar">` : `
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                    <path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/>
                </svg>`}
            </div>

            <!-- Janela do Chat -->
            <div class="lm-chat-window" id="lmChatWindow">
                <!-- Header -->
                <div class="lm-chat-header">
                    <div class="lm-chat-header-left">
                        <div class="lm-chat-avatar" id="lmChatAvatar">
                            ${avatarUrl ? `<img src="${avatarUrl}" alt="${robotName}">` : robotName.charAt(0).toUpperCase()}
                        </div>
                        <div class="lm-chat-header-info">
                            <span class="lm-chat-header-subtitle">Assistente Virtual</span>
                            <span class="lm-chat-header-title">${robotName}</span>
                        </div>
                    </div>
                    <div class="lm-chat-header-right">
                        <button class="lm-header-btn" onclick="window.LMWidget.close()" title="Fechar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Mensagens -->
                <div class="lm-chat-messages" id="lmMessages">
                    <!-- Mensagens serão inseridas aqui -->
                </div>

                <!-- Indicador de Digitação -->
                <div class="lm-typing" id="lmTyping">
                    <span class="lm-typing-dot"></span>
                    <span class="lm-typing-dot"></span>
                    <span class="lm-typing-dot"></span>
                </div>

                <!-- Input -->
                <div class="lm-chat-input-area">
                    <input type="text" class="lm-chat-input" id="lmInput" placeholder="Escreva sua mensagem..." autocomplete="off">
                    <button class="lm-send-btn" id="lmSendBtn" onclick="window.LMWidget.send()">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Injetar HTML
    const container = document.createElement('div');
    container.innerHTML = widgetHTML;
    document.body.appendChild(container.firstElementChild);

    // Estado do Widget
    let isOpen = false;
    let leadId = null;
    let leadCaptured = false;
    let conversationId = 'lm_' + Date.now();

    // Elementos
    const chatWindow = document.getElementById('lmChatWindow');
    const bubble = document.getElementById('lmBubble');
    const greeting = document.getElementById('lmGreeting');
    const messages = document.getElementById('lmMessages');
    const input = document.getElementById('lmInput');
    const sendBtn = document.getElementById('lmSendBtn');
    const typing = document.getElementById('lmTyping');

    // API do Widget
    window.LMWidget = {
        open: function () {
            isOpen = true;
            chatWindow.classList.add('lm-open');
            greeting.classList.add('lm-hidden');
            input.focus();

            // Primeira abertura - mostrar mensagens de boas-vindas
            if (messages.children.length === 0) {
                this.addMessage(welcomeMessage, false);
                setTimeout(() => {
                    this.addMessage(secondMessage, false);
                    this.showQuickReplies();
                }, 800);
            }
        },

        close: function () {
            isOpen = false;
            chatWindow.classList.remove('lm-open');
        },

        toggle: function () {
            if (isOpen) {
                this.close();
            } else {
                this.open();
            }
        },

        addMessage: function (text, isUser) {
            const msgDiv = document.createElement('div');
            msgDiv.className = 'lm-message ' + (isUser ? 'lm-user' : 'lm-bot');
            if (isUser) {
                msgDiv.textContent = text;
                        } else {
                // [WIDGET-HTML-RENDER] — Renderiza HTML do servidor (botões, links)
                // O servidor já sanitizou e gerou os botões — renderizamos diretamente
                if (/<a\s/i.test(text) || /<button/i.test(text)) {
                    msgDiv.innerHTML = text;
                } else {
                    msgDiv.textContent = text;
                }
            }
            messages.appendChild(msgDiv);
            messages.scrollTop = messages.scrollHeight;
        },

        showQuickReplies: function () {
            const repliesDiv = document.createElement('div');
            repliesDiv.className = 'lm-quick-replies';
            repliesDiv.innerHTML = `
                <button class="lm-quick-reply" onclick="window.LMWidget.quickReply('Quero saber mais')">Quero saber mais</button>
                <button class="lm-quick-reply" onclick="window.LMWidget.quickReply('Qual o preço?')">Qual o preço?</button>
            `;
            messages.appendChild(repliesDiv);
            messages.scrollTop = messages.scrollHeight;
        },

        quickReply: function (text) {
            // Remover quick replies
            const replies = messages.querySelector('.lm-quick-replies');
            if (replies) replies.remove();

            // Verificar se precisa capturar lead primeiro
            if (!leadCaptured) {
                this.showLeadForm();
                return;
            }

            input.value = text;
            this.send();
        },

        showLeadForm: function () {
            const formDiv = document.createElement('div');
            formDiv.className = 'lm-lead-prompt';
            formDiv.id = 'lmLeadForm';
            formDiv.innerHTML = `
                <input type="text" id="lmLeadName" placeholder="Qual o seu nome?" required>
                <input type="email" id="lmLeadEmail" placeholder="Seu melhor email" required>
                <input type="tel" id="lmLeadPhone" placeholder="WhatsApp (opcional)">
                <button onclick="window.LMWidget.captureLead()">Continuar conversa</button>
            `;
            messages.appendChild(formDiv);
            messages.scrollTop = messages.scrollHeight;
            document.getElementById('lmLeadName').focus();
        },

        captureLead: async function () {
            const name = document.getElementById('lmLeadName').value.trim();
            const email = document.getElementById('lmLeadEmail').value.trim();
            const phone = document.getElementById('lmLeadPhone').value.trim();

            if (!name) {
                document.getElementById('lmLeadName').focus();
                return;
            }

            // Remover formulário
            const form = document.getElementById('lmLeadForm');
            if (form) form.remove();

            try {
                const response = await fetch(apiBase + '/api/capture-lead', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nome: name,
                        email: email || '',
                        telefone: phone || '',
                        url_origem: salesUrl,
                        robotName: robotName,
                        apiKey: apiKey
                    })
                });

                const data = await response.json();
                if (data.success) {
                    leadId = data.lead.id;
                    leadCaptured = true;
                    this.addMessage('Olá ' + name + '! Prazer em te conhecer. Como posso ajudar?', false);
                }
            } catch (error) {
                console.error('Erro ao capturar lead:', error);
                leadCaptured = true; // Continua mesmo com erro
            }
        },

        send: async function () {
            const message = input.value.trim();
            if (!message) return;

            // Verificar se precisa capturar lead
            if (!leadCaptured) {
                this.showLeadForm();
                return;
            }

            this.addMessage(message, true);
            input.value = '';
            sendBtn.disabled = true;
            typing.classList.add('lm-active');

            try {
                const response = await fetch(apiBase + '/api/process-chat-inteligente', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: message,
                        pageData: { url: salesUrl },
                        robotName: robotName,
                        instructions: instructions,
                        conversationId: conversationId,
                        leadId: leadId,
                        apiKey: apiKey
                    })
                });

                const data = await response.json();
                typing.classList.remove('lm-active');

                if (data.success && data.response) {
                    this.addMessage(data.response, false);
                } else {
                    this.addMessage('Desculpe, tive um problema. Pode repetir?', false);
                }
            } catch (error) {
                typing.classList.remove('lm-active');
                this.addMessage('Ops! Erro de conexão. Tente novamente.', false);
                console.error('Erro:', error);
            }

            sendBtn.disabled = false;
            input.focus();
        }
    };

    // Event Listeners
    input.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            window.LMWidget.send();
        }
    });

    // Esconder tooltip após alguns segundos
    setTimeout(() => {
        if (!isOpen) {
            greeting.style.opacity = '0.9';
        }
    }, 5000);

    console.log('✅ LinkMágico Widget v2.0 carregado!');
    console.log('🤖 Robot:', robotName);

})();
