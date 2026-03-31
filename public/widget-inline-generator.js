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
    // SAFE PATCH - CALENDAR-V2-002: Hash do calendário para renderização
    let calendarHash = null;

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
        /* === SAFE PATCH - CALENDAR-V2-001: Estilos do calendário inline === */
        .lm-cal-container {
            width: 100%;
            max-height: 260px;
            overflow-y: auto;
            border-radius: 10px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            margin-top: 8px;
        }
        .lm-cal-container::-webkit-scrollbar { width: 4px; }
        .lm-cal-container::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 2px; }
        .lm-cal-loading {
            text-align: center;
            padding: 16px;
            color: #64748b;
            font-size: 13px;
        }
        .lm-cal-spinner {
            display: inline-block;
            width: 18px;
            height: 18px;
            border: 2px solid rgba(59,130,246,0.25);
            border-top-color: \${config.primaryColor};
            border-radius: 50%;
            animation: lm-cal-spin 0.8s linear infinite;
            margin-bottom: 6px;
        }
        @keyframes lm-cal-spin { to { transform: rotate(360deg); } }
        .lm-cal-day {
            padding: 10px 12px;
            border-bottom: 1px solid #e2e8f0;
        }
        .lm-cal-day:last-child { border-bottom: none; }
        .lm-cal-day-header {
            font-weight: 600;
            font-size: 12px;
            color: \${config.primaryColor};
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .lm-cal-slots {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }
        .lm-cal-slot {
            padding: 5px 10px;
            border: 1px solid #cbd5e1;
            border-radius: 16px;
            background: white;
            color: #334155;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: inherit;
            line-height: 1;
        }
        .lm-cal-slot:hover {
            background: \${config.primaryColor};
            color: white;
            border-color: \${config.primaryColor};
            transform: scale(1.05);
        }
        .lm-cal-slot.lm-cal-selected {
            background: \${config.primaryColor};
            color: white;
            border-color: \${config.primaryColor};
        }
        .lm-cal-confirm {
            margin-top: 10px;
            padding: 8px 14px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            border: none;
            border-radius: 16px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            transition: all 0.2s ease;
            font-family: inherit;
        }
        .lm-cal-confirm:hover { opacity: 0.9; transform: translateY(-1px); }
        .lm-cal-confirm:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .lm-cal-error {
            text-align: center;
            padding: 14px;
            color: #64748b;
            font-size: 13px;
        }
        .lm-cal-success {
            text-align: center;
            padding: 14px;
            color: #059669;
            font-size: 14px;
            font-weight: 600;
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
        // SAFE PATCH - CALENDAR-V3-006: Detectar [CALENDAR_WIDGET] e renderizar calendário visual (reforçado)
        } else if (!isUser && text && typeof text === 'string' && (text.indexOf('[CALENDAR_WIDGET]') !== -1 || text.indexOf('CALENDAR_WIDGET') !== -1)) {
            console.log('📅 [CALENDAR-V3-006] Marcador detectado no widget inline');
            try {
                var calMarker = '[CALENDAR_WIDGET]';
                var textBefore = text.split(calMarker)[0];
                if (textBefore === text) textBefore = text.split('CALENDAR_WIDGET')[0];
                textBefore = textBefore.replace(/\*\*/g, '').replace(/\n+/g, ' ').trim();
                if (textBefore) {
                    var textEl = document.createElement('div');
                    textEl.style.marginBottom = '10px';
                    textEl.style.fontWeight = '600';
                    textEl.textContent = textBefore;
                    msgDiv.appendChild(textEl);
                }
                var calContainer = renderCalendarWidget();
                if (calContainer) {
                    msgDiv.appendChild(calContainer);
                }
                msgDiv.style.maxWidth = '95%';
                console.log('📅 [CALENDAR-V3-006] Calendário renderizado com sucesso');
            } catch (calErr) {
                console.error('⚠️ [CALENDAR-V3-006] Erro ao renderizar:', calErr);
                msgDiv.textContent = text.replace('[CALENDAR_WIDGET]', '').replace('CALENDAR_WIDGET', '').trim() || '📅 Para agendar, entre em contato diretamente.';
            }
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
                // SAFE PATCH - CALENDAR-V2-004: Capturar calendarHash da resposta
                if (data.calendarHash) {
                    calendarHash = data.calendarHash;
                    console.log('📅 [CALENDAR-V2-004] calendarHash recebido:', calendarHash);
                }
                // SAFE PATCH - CALENDAR-V2-005: Se tem [CALENDAR_WIDGET] mas não tem hash, buscar via /api/availability
                if (!calendarHash && data.response.indexOf('[CALENDAR_WIDGET]') !== -1 && config.apiKey) {
                    try {
                        var hashResp = await fetch(apiBase + '/api/availability?apiKey=' + encodeURIComponent(config.apiKey));
                        var hashData = await hashResp.json();
                        if (hashData.publicHash) {
                            calendarHash = hashData.publicHash;
                            console.log('📅 [CALENDAR-V2-005] calendarHash obtido via /api/availability:', calendarHash);
                        }
                    } catch (hashErr) {
                        console.warn('⚠️ [CALENDAR-V2-005] Fallback hash falhou:', hashErr.message);
                    }
                }
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
            // SAFE PATCH - WL-V4-003: Usar mensagem de whitelabel se carregada
            var wlWelcome = window._lmWlWelcomeInline || config.welcomeMessage;
            addMessage(wlWelcome, false);
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

    // ===== SAFE PATCH - CALENDAR-V2-006: Renderização do calendário visual =====
    function renderCalendarWidget() {
        var container = document.createElement('div');
        container.className = 'lm-cal-container';
        container.innerHTML = '<div class="lm-cal-loading"><div class="lm-cal-spinner"></div><br>Carregando horários...</div>';

        var hash = calendarHash || null;

        // Se não tem hash mas tem apiKey, gerar client-side via Web Crypto
        if (!hash && config.apiKey) {
            try {
                crypto.subtle.digest('SHA-256', new TextEncoder().encode('calendar_' + config.apiKey))
                    .then(function(buf) {
                        var hexHash = Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
                        var clientHash = hexHash.substring(0, 16);
                        calendarHash = clientHash;
                        console.log('📅 [CALENDAR-V2-006] Hash gerado client-side:', clientHash);
                        fetchCalendarSlots(container, clientHash);
                    })
                    .catch(function(err) {
                        console.warn('⚠️ [CALENDAR-V2-006] Crypto fallback falhou:', err.message);
                        container.innerHTML = '<div class="lm-cal-error">📅 Para agendar, entre em contato diretamente.</div>';
                    });
                return container;
            } catch (cryptoErr) {
                console.warn('⚠️ [CALENDAR-V2-006] Web Crypto não disponível:', cryptoErr.message);
                container.innerHTML = '<div class="lm-cal-error">📅 Para agendar, entre em contato diretamente.</div>';
                return container;
            }
        }

        if (!hash) {
            container.innerHTML = '<div class="lm-cal-error">📅 Para agendar, entre em contato diretamente.</div>';
            return container;
        }

        fetchCalendarSlots(container, hash);
        return container;
    }

    function fetchCalendarSlots(container, hash) {
        fetch(apiBase + '/api/public/availability/' + encodeURIComponent(hash))
            .then(function(r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function(data) {
                if (!data.success || !data.slots || data.slots.length === 0) {
                    container.innerHTML = '<div class="lm-cal-error">😕 Nenhum horário disponível no momento.<br>Tente novamente mais tarde.</div>';
                    return;
                }
                var slotsToShow = data.slots.slice(0, 5);
                var html = '';
                slotsToShow.forEach(function(day) {
                    html += '<div class="lm-cal-day">';
                    var parts = day.date.split('-');
                    html += '<div class="lm-cal-day-header">📅 ' + escHtml(day.dayName) + ' — ' + parts[2] + '/' + parts[1] + '</div>';
                    html += '<div class="lm-cal-slots">';
                    var times = day.times.slice(0, 6);
                    times.forEach(function(time) {
                        html += '<button class="lm-cal-slot" data-date="' + escHtml(day.date) + '" data-time="' + escHtml(time) + '" data-dayname="' + escHtml(day.dayName) + '">' + time + '</button>';
                    });
                    if (day.times.length > 6) {
                        html += '<span style="font-size:11px;color:#94a3b8;padding:4px;">+' + (day.times.length - 6) + ' mais</span>';
                    }
                    html += '</div></div>';
                });
                html += '<button class="lm-cal-confirm" id="lmCalConfirm" disabled>Selecione um horário acima</button>';
                container.innerHTML = html;

                var selectedDate = null, selectedTime = null, selectedDayName = null;
                container.querySelectorAll('.lm-cal-slot').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var prev = container.querySelector('.lm-cal-selected');
                        if (prev) prev.classList.remove('lm-cal-selected');
                        btn.classList.add('lm-cal-selected');
                        selectedDate = btn.getAttribute('data-date');
                        selectedTime = btn.getAttribute('data-time');
                        selectedDayName = btn.getAttribute('data-dayname');
                        var conf = container.querySelector('#lmCalConfirm');
                        if (conf) {
                            conf.disabled = false;
                            conf.textContent = '✅ Confirmar ' + selectedDayName + ' às ' + selectedTime;
                        }
                    });
                });
                var confBtn = container.querySelector('#lmCalConfirm');
                if (confBtn) {
                    confBtn.addEventListener('click', function() {
                        if (!selectedDate || !selectedTime) return;
                        bookSlot(hash, selectedDate, selectedTime, selectedDayName, container);
                    });
                }
                messages.scrollTop = messages.scrollHeight;
            })
            .catch(function(err) {
                console.error('❌ [CALENDAR-V2] Erro ao buscar slots:', err);
                container.innerHTML = '<div class="lm-cal-error">⚠️ Não foi possível carregar os horários.<br>Tente novamente.</div>';
            });
    }

    function bookSlot(hash, date, time, dayName, container) {
        var confBtn = container.querySelector('#lmCalConfirm');
        if (confBtn) { confBtn.disabled = true; confBtn.textContent = 'Agendando...'; }
        var payload = {
            date: date,
            time: time,
            name: 'Visitante',
            email: '',
            phone: '',
            leadId: leadId || null,
            notes: 'Agendado via widget inline v2.0'
        };
        // Tentar pegar dados do lead se capturado previously
        try {
            var nameEl = document.getElementById('lmLeadName');
            var emailEl = document.getElementById('lmLeadEmail');
            var phoneEl = document.getElementById('lmLeadPhone');
            if (nameEl && nameEl.value) payload.name = nameEl.value.trim();
            if (emailEl && emailEl.value) payload.email = emailEl.value.trim();
            if (phoneEl && phoneEl.value) payload.phone = phoneEl.value.trim();
        } catch (e) { /* campos não disponíveis */ }

        fetch(apiBase + '/api/public/book/' + encodeURIComponent(hash), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(function(r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then(function(data) {
            if (data.success) {
                container.innerHTML = '<div class="lm-cal-success">✅ Agendamento confirmado!<br>📅 ' + escHtml(dayName) + ' às ' + escHtml(time) + '<br><br><span style="font-size:12px;color:#64748b;">Nossa equipe entrará em contato.</span></div>';
                messages.scrollTop = messages.scrollHeight;
            } else {
                throw new Error(data.error || 'Erro ao agendar');
            }
        })
        .catch(function(err) {
            console.error('❌ [CALENDAR-V2] Erro ao confirmar:', err);
            if (confBtn) { confBtn.disabled = false; confBtn.textContent = '⚠️ Erro — Tente novamente'; confBtn.style.background = '#ef4444'; }
        });
    }

    function escHtml(t) {
        var d = document.createElement('div');
        d.textContent = t;
        return d.innerHTML;
    }
    // ===== FIM CALENDAR-V2 =====

    // ===== SAFE PATCH - WL-V4-003: Carregar Whitelabel do servidor =====
    // Busca cores, logo e nome da empresa para aplicar ao widget inline
    // Executa APÓS widget criado (não bloqueia renderização inicial)
    // Fallback silencioso: se falhar, widget usa cores padrão do config
    try {
        fetch(apiBase + '/api/whitelabel-public/' + encodeURIComponent(config.apiKey))
            .then(function(r) { return r.ok ? r.json() : null; })
            .then(function(data) {
                if (!data || !data.success || !data.config) return;
                var wl = data.config;
                console.log('🎨 [WL-V4-003] Whitelabel carregado:', JSON.stringify(wl));

                // Atualizar nome no header
                if (wl.companyName) {
                    var titleEl = document.querySelector('.lm-chat-header-title');
                    if (titleEl) titleEl.textContent = wl.companyName;
                    var avatarEl = document.querySelector('.lm-chat-avatar');
                    if (avatarEl && !avatarEl.querySelector('img')) {
                        avatarEl.textContent = wl.companyName.charAt(0).toUpperCase();
                    }
                }

                // Atualizar logo
                if (wl.logoUrl) {
                    var chatAvatar = document.querySelector('.lm-chat-avatar');
                    if (chatAvatar) {
                        chatAvatar.innerHTML = '<img src="' + wl.logoUrl + '" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
                    }
                    var bubbleEl = document.getElementById('lmBubble');
                    if (bubbleEl && !bubbleEl.querySelector('img')) {
                        bubbleEl.innerHTML = '<img src="' + wl.logoUrl + '" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
                    }
                }

                // Sobrescrever cores via CSS adicional (incremental, reversível)
                if (wl.primaryColor && wl.primaryColor !== config.primaryColor) {
                    var p = wl.primaryColor;
                    var s = wl.secondaryColor || wl.primaryColor;
                    var overrideCSS = document.createElement('style');
                    overrideCSS.id = 'lm-wl-override-inline';
                    overrideCSS.textContent =
                        '.lm-bubble{background:linear-gradient(135deg,'+p+' 0%,'+s+' 100%)!important}' +
                        '.lm-chat-avatar{background:linear-gradient(135deg,'+p+' 0%,'+s+' 100%)!important}' +
                        '.lm-message.lm-user{background:linear-gradient(135deg,'+p+' 0%,'+s+' 100%)!important}' +
                        '.lm-chat-input:focus{border-color:'+p+'!important}' +
                        '.lm-send-btn{background:linear-gradient(135deg,'+p+' 0%,'+s+' 100%)!important}' +
                        '.lm-lead-prompt button{background:linear-gradient(135deg,'+p+' 0%,'+s+' 100%)!important}' +
                        '.lm-lead-prompt input:focus{border-color:'+p+'!important}' +
                        '.lm-cal-day-header{color:'+p+'!important}' +
                        '.lm-cal-slot:hover,.lm-cal-slot.lm-cal-selected{background:'+p+'!important;border-color:'+p+'!important}' +
                        '.lm-cal-spinner{border-top-color:'+p+'!important}';
                    document.head.appendChild(overrideCSS);
                    console.log('🎨 [WL-V4-003] Cores CSS atualizadas:', p, s);
                }

                // Guardar welcome override para quando o chat abrir
                if (wl.welcomeMessage) {
                    window._lmWlWelcomeInline = wl.welcomeMessage;
                }
            })
            .catch(function(e) {
                console.warn('⚠️ [WL-V4-003] Whitelabel fallback (cores padrão):', e.message);
            });
    } catch(e) { /* Fallback silencioso */ }
    // ===== FIM WL-V4-003 =====

    console.log('✅ LinkMágico Widget v2.0 carregado com sucesso!');
    console.log('🤖 Robot Name:', config.robotName);
})();
</script>
`;
}

// Exportar para uso
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateModernWidgetScript };
}
