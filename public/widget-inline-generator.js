/**
 * Gera script inline do widget LinkMágico com design moderno v2.0
 * Este script deve ser usado inline nas páginas (não como arquivo externo)
 */

function generateModernWidgetScript(config) {
    const {
        robotName = 'Assistente IA',
        salesUrl = '',
        instructions = '',
        primaryColor = '#3b82f6',
        apiKey = 'SUA_API_KEY',
        greetingMessage = 'Oi! Posso ajudar?',
        welcomeMessage = 'Olá 👋 Muito bom ter você aqui!',
        secondMessage = 'Como posso ajudar você hoje?'
    } = config;

    return `<script>
(function() {
    'use strict';
    
    // ===== CONFIGURAÇÃO DO CLIENTE =====
    const config = {
        robotName: "${robotName}",
        salesUrl: "${salesUrl}",
        instructions: "${instructions}",
        primaryColor: "${primaryColor}",
        apiKey: "${apiKey}",
        greetingMessage: "${greetingMessage}",
        welcomeMessage: "${welcomeMessage}",
        secondMessage: "${secondMessage}"
    };

    // ===== CONFIGURAÇÃO DO SERVIDOR =====
    const apiBase = "https://vertical-ai-dktu.onrender.com";
    
    // ===== VERIFICAÇÃO =====
    if (!config.apiKey || config.apiKey === "SUA_API_KEY") {
        console.error("❌ LinkMágico Widget: API Key não configurada!");
        return;
    }

    // ===== VARIÁVEIS DE ESTADO =====
    let isOpen = false;
    let leadId = null;
    let leadCaptured = false;
    let conversationId = 'lm_' + Date.now();

    // ===== INJETAR CSS =====
    const styles = document.createElement('style');
    styles.textContent = \`
        .lm-widget-container * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        }
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
        .lm-greeting-tooltip.lm-hidden { display: none; }
        .lm-bubble {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, \${config.primaryColor} 0%, #1e40af 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
            transition: all 0.3s ease;
        }
        .lm-bubble:hover {
            transform: scale(1.1);
            box-shadow: 0 6px 25px rgba(59, 130, 246, 0.5);
        }
        .lm-bubble svg {
            width: 28px;
            height: 28px;
            fill: white;
        }
        .lm-bubble.lm-hidden { display: none; }
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
        .lm-chat-window.lm-open { display: flex; }
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
            background: linear-gradient(135deg, \${config.primaryColor} 0%, #8b5cf6 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 18px;
        }
        .lm-chat-header-info { display: flex; flex-direction: column; }
        .lm-chat-header-subtitle { font-size: 12px; color: #6b7280; }
        .lm-chat-header-title { font-size: 15px; font-weight: 600; color: #1f2937; }
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
        .lm-header-btn:hover { background: #e5e7eb; color: #1f2937; }
        .lm-chat-messages {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            background: #f9fafb;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
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
            background: linear-gradient(135deg, \${config.primaryColor} 0%, #1e40af 100%);
            color: white;
            align-self: flex-end;
            border-bottom-right-radius: 4px;
        }
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
        .lm-typing.lm-active { display: flex; }
        .lm-typing-dot {
            width: 8px;
            height: 8px;
            background: #9ca3af;
            border-radius: 50%;
            animation: lm-typingBounce 1.4s infinite;
        }
        .lm-typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .lm-typing-dot:nth-child(3) { animation-delay: 0.4s; }
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
            border-color: \${config.primaryColor};
            background: white;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        .lm-chat-input::placeholder { color: #9ca3af; }
        .lm-send-btn {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            border: none;
            background: linear-gradient(135deg, \${config.primaryColor} 0%, #1e40af 100%);
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
        .lm-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .lm-send-btn svg { width: 20px; height: 20px; }
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
        .lm-lead-prompt input:focus { border-color: \${config.primaryColor}; }
        .lm-lead-prompt button {
            width: 100%;
            background: linear-gradient(135deg, \${config.primaryColor} 0%, #1e40af 100%);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 10px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .lm-lead-prompt button:hover { opacity: 0.9; }
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
        @media (max-width: 480px) {
            .lm-chat-window {
                width: calc(100% - 20px);
                height: calc(100% - 100px);
                right: 10px;
                bottom: 80px;
                border-radius: 20px;
            }
            .lm-widget-container { right: 10px; bottom: 10px; }
            .lm-bubble { width: 55px; height: 55px; }
            .lm-greeting-tooltip { display: none; }
        }
    \`;
    document.head.appendChild(styles);

    // ===== CRIAR HTML =====
    const container = document.createElement('div');
    container.className = 'lm-widget-container';
    container.id = 'lmWidgetContainer';
    container.innerHTML = \`
        <div class="lm-greeting-tooltip" id="lmGreeting">
            <span class="lm-online-dot"></span>
            <span>\${config.greetingMessage}</span>
        </div>
        <div class="lm-bubble" id="lmBubble">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                <path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/>
            </svg>
        </div>
        <div class="lm-chat-window" id="lmChatWindow">
            <div class="lm-chat-header">
                <div class="lm-chat-header-left">
                    <div class="lm-chat-avatar">\${config.robotName.charAt(0).toUpperCase()}</div>
                    <div class="lm-chat-header-info">
                        <span class="lm-chat-header-subtitle">Assistente Virtual</span>
                        <span class="lm-chat-header-title">\${config.robotName}</span>
                    </div>
                </div>
                <button class="lm-header-btn" id="lmCloseBtn" title="Fechar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div class="lm-chat-messages" id="lmMessages"></div>
            <div class="lm-typing" id="lmTyping">
                <span class="lm-typing-dot"></span>
                <span class="lm-typing-dot"></span>
                <span class="lm-typing-dot"></span>
            </div>
            <div class="lm-chat-input-area">
                <input type="text" class="lm-chat-input" id="lmInput" placeholder="Escreva sua mensagem..." autocomplete="off">
                <button class="lm-send-btn" id="lmSendBtn">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                </button>
            </div>
        </div>
    \`;
    document.body.appendChild(container);

    // ===== ELEMENTOS =====
    const chatWindow = document.getElementById('lmChatWindow');
    const bubble = document.getElementById('lmBubble');
    const greeting = document.getElementById('lmGreeting');
    const messages = document.getElementById('lmMessages');
    const input = document.getElementById('lmInput');
    const sendBtn = document.getElementById('lmSendBtn');
    const typing = document.getElementById('lmTyping');
    const closeBtn = document.getElementById('lmCloseBtn');

    // ===== FUNÇÕES =====
    function processUrlsInText(text) {
        var urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
        var escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return escaped.replace(urlRegex, function(url) {
            return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:white;padding:6px 14px;border-radius:16px;text-decoration:none;font-size:13px;font-weight:600;margin:4px 0;">' +
                '🔗 Acessar agora</a>';
        });
    }

    function addMessage(text, isUser = false) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'lm-message ' + (isUser ? 'lm-user' : 'lm-bot');
        if (isUser) {
            msgDiv.textContent = text;
        } else if (/https?:\/\//i.test(text)) {
            msgDiv.innerHTML = processUrlsInText(text);
        } else {
            msgDiv.textContent = text;
        }
        messages.appendChild(msgDiv);
        messages.scrollTop = messages.scrollHeight;
    }

    function showLeadForm() {
        const formDiv = document.createElement('div');
        formDiv.className = 'lm-lead-prompt';
        formDiv.id = 'lmLeadForm';
        formDiv.innerHTML = \`
            <input type="text" id="lmLeadName" placeholder="Qual o seu nome?" required>
            <input type="email" id="lmLeadEmail" placeholder="Seu melhor email">
            <input type="tel" id="lmLeadPhone" placeholder="WhatsApp (opcional)">
            <button id="lmLeadSubmit">Continuar conversa</button>
        \`;
        messages.appendChild(formDiv);
        messages.scrollTop = messages.scrollHeight;
        document.getElementById('lmLeadName').focus();
        
        document.getElementById('lmLeadSubmit').addEventListener('click', captureLead);
    }

    async function captureLead() {
        const name = document.getElementById('lmLeadName').value.trim();
        const email = document.getElementById('lmLeadEmail').value.trim();
        const phone = document.getElementById('lmLeadPhone').value.trim();

        if (!name) {
            document.getElementById('lmLeadName').focus();
            return;
        }

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
                    url_origem: config.salesUrl,
                    robotName: config.robotName,
                    apiKey: config.apiKey
                })
            });

            const data = await response.json();
            if (data.success) {
                leadId = data.lead.id;
                leadCaptured = true;
                addMessage('Olá ' + name + '! Prazer em te conhecer. Como posso ajudar?', false);
            }
        } catch (error) {
            console.error('Erro ao capturar lead:', error);
            leadCaptured = true;
        }
    }

    async function sendMessage() {
        const message = input.value.trim();
        if (!message) return;

        if (!leadCaptured) {
            showLeadForm();
            return;
        }

        addMessage(message, true);
        input.value = '';
        sendBtn.disabled = true;
        typing.classList.add('lm-active');

        try {
            const response = await fetch(apiBase + '/api/process-chat-inteligente', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    pageData: { url: config.salesUrl },
                    robotName: config.robotName,
                    instructions: config.instructions,
                    conversationId: conversationId,
                    leadId: leadId,
                    apiKey: config.apiKey
                })
            });

            const data = await response.json();
            typing.classList.remove('lm-active');

            if (data.success && data.response) {
                addMessage(data.response, false);
            } else {
                addMessage('Desculpe, tive um problema. Pode repetir?', false);
            }
        } catch (error) {
            typing.classList.remove('lm-active');
            addMessage('Ops! Erro de conexão. Tente novamente.', false);
            console.error('Erro:', error);
        }

        sendBtn.disabled = false;
        input.focus();
    }

    function openChat() {
        isOpen = true;
        chatWindow.classList.add('lm-open');
        greeting.classList.add('lm-hidden');
        input.focus();

        if (messages.children.length === 0) {
            addMessage(config.welcomeMessage, false);
            setTimeout(() => {
                addMessage(config.secondMessage, false);
            }, 800);
        }
    }

    function closeChat() {
        isOpen = false;
        chatWindow.classList.remove('lm-open');
    }

    function toggleChat() {
        if (isOpen) {
            closeChat();
        } else {
            openChat();
        }
    }

    // ===== EVENT LISTENERS =====
    bubble.addEventListener('click', toggleChat);
    greeting.addEventListener('click', openChat);
    closeBtn.addEventListener('click', closeChat);
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });

    console.log('✅ LinkMágico Widget v2.0 carregado com sucesso!');
    console.log('🤖 Robot Name:', config.robotName);
})();
</script>`;
}

// Exportar para uso
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateModernWidgetScript };
}
