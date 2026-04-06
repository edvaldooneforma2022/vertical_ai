// LinkMágico Commercial Widget v6.0
// Enterprise-grade chatbot widget with security and analytics
(function (window, document) {
    'use strict';

    // Prevent multiple initializations
    if (window.LinkMagicoWidget) {
        console.warn('LinkMagico Widget already initialized');
        return;
    }

    // Auto-detect server domain from script source
    const scripts = document.querySelectorAll('script[src*="widget.js"]');
    const currentScript = scripts[scripts.length - 1];
    const scriptSrc = currentScript ? currentScript.src : '';

    // Extract server domain from script URL
    let detectedServerDomain = '';
    if (scriptSrc) {
        try {
            const scriptUrl = new URL(scriptSrc);
            detectedServerDomain = scriptUrl.origin;
            console.log('LinkMagico Widget: Server domain detected as', detectedServerDomain);
        } catch (e) {
            console.warn('LinkMagico Widget: Could not auto-detect server domain');
        }
    }

    // Optional token from URL parameters
    const urlParams = new URLSearchParams(scriptSrc.split('?')[1] || '');
    const widgetToken = urlParams.get('token');

    // Token is optional - widget can work without it for basic functionality
    if (!widgetToken) {
        console.log('LinkMagico Widget: No token provided, using configuration-based authentication');
    }

    var LinkMagicoWidget = {
        version: '6.0.0-commercial',
        initialized: false,
        isOpen: false,
        messageCount: 0,
        conversationId: null,
        token: widgetToken,
        startTime: Date.now(),

        // Lead capture state
        leadCaptured: false,
        leadId: null,

        // Security configuration
        security: {
            maxMessageLength: 500,
            rateLimitWindow: 60000, // 1 minute
            maxMessagesPerWindow: 10,
            messageHistory: []
        },

        // Default configuration
        config: {
            position: 'bottom-right',
            primaryColor: '#3b82f6',
            secondaryColor: '#1e40af',
            successColor: '#10b981',
            errorColor: '#ef4444',
            robotName: 'Assistente IA',
            salesUrl: '',
            instructions: '',
            apiBase: detectedServerDomain || window.location.origin,
            showBadge: true,
            autoOpen: false,
            openDelay: 5000,
            theme: 'light',
            language: 'pt-BR',
            welcomeMessage: 'Olá! 👋 Como posso te ajudar hoje?',
            placeholder: 'Digite sua pergunta...',
            buttonIcon: 'fas fa-comments',
            zIndex: 999999,
            maxMessages: 50,
            typingDelay: 1000,
            animationSpeed: 300,
            mobileBreakpoint: 768,
            borderRadius: '24px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',

            // Commercial features
            branding: true,
            analytics: true,
            customCSS: '',
            retryAttempts: 3,
            timeout: 15000,

            // Lead capture
            captureLeads: true,
            apiKey: '',

            // Callbacks
            onOpen: null,
            onClose: null,
            onMessage: null,
            onError: null,
            onRateLimit: null,
            onLeadCaptured: null
        },

        // Initialize the widget
        init: async function (userConfig) {
            if (this.initialized) {
                console.warn('LinkMagico Widget already initialized');
                return;
            }

            try {
                // Merge configuration
                this.config = this.mergeConfig(this.config, userConfig || {});

                // 🎨 SAFE PATCH - WL-V3-001: Buscar cores do Whitelabel do servidor
                // Executa ANTES de criar o widget para que as cores sejam aplicadas nos estilos CSS
                try {
                    await this.loadWhitelabelColors();
                } catch (wlErr) {
                    console.warn('⚠️ LinkMagico Widget: Whitelabel load falhou (usando padrão):', wlErr.message);
                }

                // Validate domain (if configured on server)
                if (!this.validateDomain()) {
                    console.error('LinkMagico Widget: Domain not authorized');
                    return;
                }

                // Generate conversation ID
                this.conversationId = 'widget_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

                // SAFE PATCH - LEAD-001: Restore lead from localStorage if available
                try {
                    if (this.config.captureLeads) {
                        var storedLeadId = this.getStoredLeadId();
                        if (storedLeadId) {
                            this.leadId = storedLeadId;
                            this.leadCaptured = true;
                            console.log('✅ LinkMagico Widget: Lead restaurado:', storedLeadId);
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ LinkMagico Widget: Erro ao restaurar lead:', e.message);
                }

                // Wait for DOM to be ready
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', this.createWidget.bind(this));
                } else {
                    this.createWidget();
                }

                this.initialized = true;
                this.log('LinkMagico Commercial Widget v' + this.version + ' initialized');
                console.log('🎨 [WL-V3-001] Config final:', { primary: this.config.primaryColor, secondary: this.config.secondaryColor, robot: this.config.robotName, logo: this.config.logoUrl || '(sem logo)' });

                // Track initialization
                this.trackEvent('widget_initialized');

            } catch (error) {
                console.error('LinkMagico Widget initialization failed:', error);
                this.handleError('initialization_failed', error.message);
            }
        },

        // 🎨 Buscar cores do Whitelabel do servidor
        loadWhitelabelColors: async function () {
            try {
                const apiBase = this.config.apiBase;
                // Usar apiKey da configuração, do token ou 'default' como fallback
                const chatbotId = this.config.apiKey || this.token || 'default';

                // Usar endpoint público (não requer autenticação)
                // SAFE PATCH - WL-V4-001: Removido Content-Type header do GET para evitar CORS preflight
                // GET com Content-Type custom dispara OPTIONS preflight que falha em domínios externos
                const response = await fetch(apiBase + '/api/whitelabel-public/' + encodeURIComponent(chatbotId), {
                    method: 'GET'
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.config) {
                        const wlConfig = data.config;

                        // Aplicar cores do whitelabel
                        if (wlConfig.primaryColor) {
                            this.config.primaryColor = wlConfig.primaryColor;
                        }
                        if (wlConfig.secondaryColor) {
                            this.config.secondaryColor = wlConfig.secondaryColor;
                        }

                        // 🎯 BUG-FIX-001: Aplicar logo e nome da empresa do whitelabel
                        if (wlConfig.companyName) {
                            this.config.robotName = wlConfig.companyName;
                        }
                        if (wlConfig.logoUrl) {
                            this.config.logoUrl = wlConfig.logoUrl;
                        }

                        // 🎯 BUG-FIX-002/005: Aplicar mensagem de saudação do whitelabel
                        if (wlConfig.welcomeMessage) {
                            this.config.welcomeMessage = wlConfig.welcomeMessage;
                        }

                        console.log('🎨 LinkMagico Widget: Whitelabel aplicado', {
                            primary: this.config.primaryColor,
                            secondary: this.config.secondaryColor,
                            company: this.config.robotName,
                            logo: this.config.logoUrl || '(sem logo)',
                            welcomeMessage: this.config.welcomeMessage
                        });
                    }
                }
            } catch (error) {
                // Se falhar, usa cores padrão - não interrompe o widget
                console.warn('LinkMagico Widget: Não foi possível carregar whitelabel, usando cores padrão', error.message);
            }
        },


        // Deep merge configuration objects
        mergeConfig: function (defaultConfig, userConfig) {
            var merged = {};
            for (var key in defaultConfig) {
                merged[key] = defaultConfig[key];
            }
            for (var key in userConfig) {
                if (userConfig.hasOwnProperty(key)) {
                    merged[key] = userConfig[key];
                }
            }
            return merged;
        },

        // Validate domain authorization
        validateDomain: function () {
            // Domain validation is handled server-side
            // This is just a client-side check for obvious issues
            const currentDomain = window.location.hostname;

            // Allow localhost for development
            if (currentDomain === 'localhost' || currentDomain === '127.0.0.1') {
                return true;
            }

            // Allow any domain - server will validate
            return true;
        },

        // Rate limiting check
        checkRateLimit: function () {
            const now = Date.now();
            const window = this.security.rateLimitWindow;

            // Clean old messages
            this.security.messageHistory = this.security.messageHistory.filter(time =>
                now - time < window
            );

            // Check if under limit
            if (this.security.messageHistory.length >= this.security.maxMessagesPerWindow) {
                this.handleRateLimit();
                return false;
            }

            // Add current message
            this.security.messageHistory.push(now);
            return true;
        },

        // Handle rate limiting
        handleRateLimit: function () {
            this.showError('Muitas mensagens enviadas. Aguarde um momento.');
            if (this.config.onRateLimit) {
                this.config.onRateLimit();
            }
            this.trackEvent('rate_limit_hit');
        },

        // Create the widget HTML structure
        createWidget: function () {
            try {
                // Create main container
                var container = document.createElement('div');
                container.id = 'linkmagico-widget';
                container.className = 'lm-widget-container';
                container.setAttribute('data-version', this.version);

                // Create widget HTML
                container.innerHTML = this.getWidgetHTML();

                // Add widget styles
                this.injectStyles();

                // Append to body
                document.body.appendChild(container);

                // Bind events
                this.bindEvents();

                // Auto-open if configured
                if (this.config.autoOpen) {
                    setTimeout(this.openChat.bind(this), this.config.openDelay);
                }

                // Track widget ready
                this.trackEvent('widget_ready');
                this.dispatchEvent('widgetReady');

            } catch (error) {
                console.error('LinkMagico Widget creation failed:', error);
                this.handleError('widget_creation_failed', error.message);
            }
        },

        // Generate widget HTML with enhanced security
        getWidgetHTML: function () {
            var position = this.config.position;
            var positionClass = 'lm-position-' + position;

            return `
                <div class="lm-widget-button ${positionClass}" id="lm-widget-button">
                    <i class="${this.config.buttonIcon}"></i>
                    ${this.config.showBadge ? '<span class="lm-widget-badge" id="lm-widget-badge">1</span>' : ''}
                </div>

                <div class="lm-widget-chat ${positionClass}" id="lm-widget-chat">
                    <div class="lm-chat-header">
                        <div class="lm-chat-info">
                            <div class="lm-chat-avatar">
                                ${this.config.logoUrl ? `<img src="${this.escapeHtml(this.config.logoUrl)}" alt="${this.escapeHtml(this.config.robotName)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><i class="fas fa-robot" style="display:none;width:40px;height:40px;align-items:center;justify-content:center"></i>` : `<i class="fas fa-robot"></i>`}
                            </div>
                            <div class="lm-chat-details">
                                <div class="lm-chat-title">${this.escapeHtml(this.config.robotName)}</div>
                                <div class="lm-chat-status">
                                    <span class="lm-status-dot"></span>
                                    <span class="lm-status-text">Online</span>
                                </div>
                            </div>
                        </div>
                        <div class="lm-chat-actions">
                            <button class="lm-chat-minimize" id="lm-chat-minimize" title="Minimizar">
                                <i class="fas fa-minus"></i>
                            </button>
                            <button class="lm-chat-close" id="lm-chat-close" title="Fechar">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>

                    <div class="lm-chat-messages" id="lm-chat-messages">
                        <div class="lm-message lm-bot-message lm-welcome-message">
                            <div class="lm-message-avatar">
                                <i class="fas fa-robot"></i>
                            </div>
                            <div class="lm-message-content">
                                ${this.escapeHtml(this.config.welcomeMessage)}
                            </div>
                        </div>

                        <!-- Lead Capture Form (hidden by default, shown by showLeadForm) -->
                        <div class="lm-lead-form" id="lm-lead-form" style="display: none;">
                            <div class="lm-lead-form-title">Para melhor atendê-lo, informe seus dados:</div>
                            <input type="text" id="lm-lead-name" class="lm-lead-input" placeholder="Seu nome *" required>
                            <input type="email" id="lm-lead-email" class="lm-lead-input" placeholder="Seu melhor email">
                            <input type="tel" id="lm-lead-phone" class="lm-lead-input" placeholder="WhatsApp (opcional)">
                            <button id="lm-lead-submit" class="lm-lead-submit">Continuar conversa →</button>
                        </div>
                    </div>

                    <div class="lm-typing-indicator" id="lm-typing-indicator">
                        <div class="lm-typing-avatar">
                            <i class="fas fa-robot"></i>
                        </div>
                        <div class="lm-typing-content">
                            <div class="lm-typing-dots">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                            <span class="lm-typing-text">Digitando...</span>
                        </div>
                    </div>

                    <div class="lm-chat-input">
                        <div class="lm-input-group">
                            <textarea 
                                id="lm-message-input" 
                                class="lm-message-input"
                                placeholder="${this.escapeHtml(this.config.placeholder)}"
                                maxlength="${this.security.maxMessageLength}"
                                rows="1"></textarea>
                            <button id="lm-send-button" class="lm-send-button" title="Enviar">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </div>
                        <div class="lm-input-footer">
                            <div class="lm-char-counter">
                                <span id="lm-char-count">0</span>/${this.security.maxMessageLength}
                            </div>
                            ${this.config.branding ? '<div class="lm-powered-by">Powered by <strong>LinkMágico</strong></div>' : ''}
                        </div>
                    </div>
                </div>

                <div class="lm-widget-overlay" id="lm-widget-overlay"></div>

                <div class="lm-error-message" id="lm-error-message" style="display: none;">
                    <div class="lm-error-content">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span id="lm-error-text"></span>
                        <button class="lm-error-close" id="lm-error-close">&times;</button>
                    </div>
                </div>
            `;
        },

        // Enhanced CSS with commercial styling
        getWidgetCSS: function () {
            var config = this.config;
            var primaryColor = config.primaryColor;
            var secondaryColor = config.secondaryColor;
            var successColor = config.successColor;
            var errorColor = config.errorColor;
            var isDark = config.theme === 'dark';
            var isMobile = window.innerWidth <= config.mobileBreakpoint;

            return `
                /* LinkMagico Commercial Widget Styles v${this.version} */
                .lm-widget-container {
                    all: initial;
                    position: fixed;
                    z-index: ${config.zIndex};
                    font-family: ${config.fontFamily};
                    font-size: 14px;
                    line-height: 1.4;
                    color: #333;
                    box-sizing: border-box;
                    pointer-events: none;
                    -webkit-text-size-adjust: 100%;
                }

                .lm-widget-container *,
                .lm-widget-container *::before,
                .lm-widget-container *::after {
                    box-sizing: border-box;
                }

                .lm-widget-container > * {
                    pointer-events: auto;
                }

                /* Position variants */
                .lm-position-bottom-right { bottom: 20px; right: 20px; }
                .lm-position-bottom-left { bottom: 20px; left: 20px; }
                .lm-position-top-right { top: 20px; right: 20px; }
                .lm-position-top-left { top: 20px; left: 20px; }

                /* Widget button with enhanced styling */
                .lm-widget-button {
                    width: 64px;
                    height: 64px;
                    background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 24px;
                    cursor: pointer;
                    box-shadow: ${config.boxShadow}, 0 0 0 0 rgba(59, 130, 246, 0.7);
                    transition: all ${config.animationSpeed}ms ease;
                    position: relative;
                    border: none;
                    outline: none;
                    animation: lm-pulse-ring 2s infinite;
                }

                @keyframes lm-pulse-ring {
                    0% { box-shadow: ${config.boxShadow}, 0 0 0 0 rgba(59, 130, 246, 0.7); }
                    70% { box-shadow: ${config.boxShadow}, 0 0 0 10px rgba(59, 130, 246, 0); }
                    100% { box-shadow: ${config.boxShadow}, 0 0 0 0 rgba(59, 130, 246, 0); }
                }

                .lm-widget-button:hover {
                    transform: scale(1.05);
                    box-shadow: 0 12px 40px rgba(0,0,0,0.2);
                }

                .lm-widget-button:active {
                    transform: scale(0.95);
                }

                .lm-widget-badge {
                    position: absolute;
                    top: -6px;
                    right: -6px;
                    background: ${errorColor};
                    color: white;
                    border-radius: 50%;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: bold;
                    animation: lm-badge-bounce 2s infinite;
                }

                @keyframes lm-badge-bounce {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                }

                /* Enhanced chat window */
                .lm-widget-chat {
                    position: absolute;
                    width: 380px;
                    height: 600px;
                    background: ${isDark ? '#1f2937' : 'white'};
                    border-radius: ${config.borderRadius};
                    box-shadow: ${config.boxShadow};
                    display: none;
                    flex-direction: column;
                    overflow: hidden;
                    transform: scale(0.8) translateY(20px);
                    opacity: 0;
                    transition: all ${config.animationSpeed}ms cubic-bezier(0.4, 0, 0.2, 1);
                    border: 1px solid rgba(0,0,0,0.1);
                }

                .lm-widget-chat.lm-position-bottom-right,
                .lm-widget-chat.lm-position-bottom-left { bottom: 84px; }
                .lm-widget-chat.lm-position-top-right,
                .lm-widget-chat.lm-position-top-left { top: 84px; }
                .lm-widget-chat.lm-position-bottom-left,
                .lm-widget-chat.lm-position-top-left { left: 0; }
                .lm-widget-chat.lm-position-bottom-right,
                .lm-widget-chat.lm-position-top-right { right: 0; }

                .lm-widget-chat.lm-chat-open {
                    display: flex;
                    transform: scale(1) translateY(0);
                    opacity: 1;
                }

                /* Mobile responsive enhancements */
                @media (max-width: ${config.mobileBreakpoint}px) {
                    .lm-widget-chat {
                        position: fixed !important;
                        top: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        bottom: 0 !important;
                        width: 100% !important;
                        height: 100% !important;
                        border-radius: 0 !important;
                        transform: translateY(100%);
                        max-height: 100vh;
                    }

                    .lm-widget-chat.lm-chat-open {
                        transform: translateY(0);
                    }

                    .lm-widget-overlay {
                        display: block !important;
                    }
                }

                /* Enhanced chat header */
                .lm-chat-header {
                    background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
                    color: white;
                    padding: 16px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }

                .lm-chat-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .lm-chat-avatar {
                    width: 40px;
                    height: 40px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                }

                .lm-chat-title {
                    font-weight: 600;
                    font-size: 16px;
                    margin-bottom: 2px;
                }

                .lm-chat-status {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 12px;
                    opacity: 0.9;
                }

                .lm-status-dot {
                    width: 8px;
                    height: 8px;
                    background: ${successColor};
                    border-radius: 50%;
                    animation: lm-status-pulse 2s infinite;
                }

                @keyframes lm-status-pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }

                .lm-chat-actions {
                    display: flex;
                    gap: 8px;
                }

                .lm-chat-minimize,
                .lm-chat-close {
                    background: rgba(255,255,255,0.1);
                    border: none;
                    color: white;
                    width: 32px;
                    height: 32px;
                    border-radius: 6px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }

                .lm-chat-minimize:hover,
                .lm-chat-close:hover {
                    background: rgba(255,255,255,0.2);
                    transform: scale(1.1);
                }

                /* Enhanced messages area */
                .lm-chat-messages {
                    flex: 1;
                    padding: 20px;
                    overflow-y: auto;
                    background: ${isDark ? 'linear-gradient(to bottom, #111827, #1f2937)' : 'linear-gradient(to bottom, #f9fafb, white)'};
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .lm-chat-messages::-webkit-scrollbar {
                    width: 6px;
                }

                .lm-chat-messages::-webkit-scrollbar-track {
                    background: transparent;
                }

                .lm-chat-messages::-webkit-scrollbar-thumb {
                    background: rgba(0,0,0,0.1);
                    border-radius: 3px;
                }

                .lm-chat-messages::-webkit-scrollbar-thumb:hover {
                    background: rgba(0,0,0,0.2);
                }

                /* Enhanced message styling */
                .lm-message {
                    display: flex;
                    align-items: flex-end;
                    gap: 10px;
                    max-width: 85%;
                    animation: lm-message-appear 0.3s ease;
                }

                @keyframes lm-message-appear {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .lm-user-message {
                    align-self: flex-end;
                    flex-direction: row-reverse;
                }

                .lm-bot-message {
                    align-self: flex-start;
                }

                .lm-message-avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    color: white;
                    flex-shrink: 0;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }

                .lm-bot-message .lm-message-avatar {
                    background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
                }

                .lm-user-message .lm-message-avatar {
                    background: linear-gradient(135deg, ${successColor}, #059669);
                }

                .lm-message-content {
                    padding: 12px 16px;
                    border-radius: 18px;
                    font-size: 14px;
                    line-height: 1.5;
                    word-wrap: break-word;
                    white-space: pre-line;
                    position: relative;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    transition: all 0.2s ease;
                }

                .lm-message-content:hover {
                    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
                }

                .lm-user-message .lm-message-content {
                    background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
                    color: white;
                }

                .lm-bot-message .lm-message-content {
                    background: ${isDark ? '#374151' : 'white'};
                    color: ${isDark ? '#e5e7eb' : '#374151'};
                    border: 1px solid ${isDark ? '#4b5563' : '#e5e7eb'};
                }

                /* Enhanced CTA buttons */
                .lm-cta-button {
                    display: inline-block;
                    background: linear-gradient(135deg, ${successColor}, #059669);
                    color: white !important;
                    padding: 10px 18px;
                    border-radius: 20px;
                    text-decoration: none;
                    font-weight: 600;
                    font-size: 13px;
                    margin-top: 8px;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
                    border: none;
                    cursor: pointer;
                }

                .lm-cta-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
                    text-decoration: none;
                    color: white;
                }

                .lm-cta-button i {
                    margin-left: 6px;
                }

                /* Enhanced typing indicator */
                .lm-typing-indicator {
                    display: none;
                    padding: 0 20px 16px;
                    align-items: flex-end;
                    gap: 10px;
                }

                .lm-typing-avatar {
                    width: 32px;
                    height: 32px;
                    background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    color: white;
                    flex-shrink: 0;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }

                .lm-typing-content {
                    background: ${isDark ? '#374151' : 'white'};
                    border: 1px solid ${isDark ? '#4b5563' : '#e5e7eb'};
                    padding: 12px 16px;
                    border-radius: 18px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }

                .lm-typing-dots {
                    display: flex;
                    gap: 4px;
                }

                .lm-typing-dots span {
                    width: 6px;
                    height: 6px;
                    background: ${primaryColor};
                    border-radius: 50%;
                    animation: lm-typing 1.4s infinite ease-in-out;
                }

                .lm-typing-dots span:nth-child(1) { animation-delay: -0.32s; }
                .lm-typing-dots span:nth-child(2) { animation-delay: -0.16s; }
                .lm-typing-dots span:nth-child(3) { animation-delay: 0s; }

                @keyframes lm-typing {
                    0%, 80%, 100% {
                        transform: scale(0.8);
                        opacity: 0.5;
                    }
                    40% {
                        transform: scale(1.2);
                        opacity: 1;
                    }
                }

                .lm-typing-text {
                    font-size: 12px;
                    color: ${isDark ? '#9ca3af' : '#6b7280'};
                    font-style: italic;
                }

                /* Enhanced chat input */
                .lm-chat-input {
                    padding: 16px 20px;
                    background: ${isDark ? '#1f2937' : 'white'};
                    border-top: 1px solid ${isDark ? '#374151' : '#e5e7eb'};
                }

                .lm-input-group {
                    display: flex;
                    gap: 12px;
                    align-items: flex-end;
                }

                .lm-message-input {
                    flex: 1;
                    min-height: 44px;
                    max-height: 120px;
                    padding: 12px 16px;
                    border: 2px solid ${isDark ? '#374151' : '#e5e7eb'};
                    border-radius: 22px;
                    font-size: 14px;
                    line-height: 1.4;
                    font-family: inherit;
                    background: ${isDark ? '#374151' : '#f9fafb'};
                    color: ${isDark ? '#e5e7eb' : '#374151'};
                    resize: none;
                    outline: none;
                    transition: all 0.3s ease;
                }

                .lm-message-input:focus {
                    border-color: ${primaryColor};
                    background: ${isDark ? '#4b5563' : 'white'};
                    box-shadow: 0 0 0 3px ${primaryColor}20;
                }

                .lm-message-input::placeholder {
                    color: ${isDark ? '#9ca3af' : '#6b7280'};
                }

                .lm-send-button {
                    width: 44px;
                    height: 44px;
                    border: none;
                    border-radius: 50%;
                    background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
                    color: white;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 16px;
                    transition: all 0.3s ease;
                    flex-shrink: 0;
                    box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
                }

                .lm-send-button:hover:not(:disabled) {
                    transform: scale(1.05);
                    box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);
                }

                .lm-send-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }

                .lm-input-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 8px;
                    font-size: 11px;
                    color: ${isDark ? '#6b7280' : '#9ca3af'};
                }

                .lm-char-counter {
                    font-variant-numeric: tabular-nums;
                }

                .lm-powered-by {
                    font-size: 10px;
                    opacity: 0.7;
                }

                .lm-powered-by strong {
                    color: ${primaryColor};
                }

                /* Error message styling */
                .lm-error-message {
                    position: fixed;
                    bottom: 100px;
                    right: 20px;
                    background: ${errorColor};
                    color: white;
                    padding: 12px 16px;
                    border-radius: 12px;
                    box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
                    z-index: ${config.zIndex + 1};
                    max-width: 300px;
                    animation: lm-error-appear 0.3s ease;
                }

                .lm-error-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                }

                .lm-error-close {
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    font-size: 18px;
                    margin-left: 8px;
                    opacity: 0.8;
                }

                .lm-error-close:hover {
                    opacity: 1;
                }

                @keyframes lm-error-appear {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Overlay for mobile */
                .lm-widget-overlay {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    z-index: ${config.zIndex - 1};
                    backdrop-filter: blur(2px);
                }

                /* Dark theme adjustments */
                ${isDark ? `
                .lm-widget-chat {
                    border: 1px solid #374151;
                }
                .lm-chat-messages {
                    background: linear-gradient(to bottom, #111827, #1f2937);
                }
                ` : ''}

                /* Accessibility improvements */
                .lm-widget-button:focus,
                .lm-send-button:focus,
                .lm-message-input:focus,
                .lm-chat-minimize:focus,
                .lm-chat-close:focus {
                    outline: 2px solid ${primaryColor};
                    outline-offset: 2px;
                }

                /* High contrast mode */
                @media (prefers-contrast: high) {
                    .lm-message-content {
                        border: 2px solid currentColor;
                    }
                    
                    .lm-send-button,
                    .lm-widget-button {
                        border: 2px solid white;
                    }
                }

                /* Reduced motion */
                @media (prefers-reduced-motion: reduce) {
                    .lm-widget-chat,
                    .lm-widget-button,
                    .lm-message,
                    .lm-send-button,
                    .lm-chat-minimize,
                    .lm-chat-close {
                        transition: none;
                        animation: none;
                    }

                    .lm-widget-badge,
                    .lm-status-dot,
                    .lm-typing-dots span {
                        animation: none;
                    }
                }

                /* Lead capture form */
                .lm-lead-form {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 16px;
                    margin: 8px 12px;
                    animation: lm-message-appear 0.3s ease;
                }

                .lm-lead-form-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: #475569;
                    margin-bottom: 12px;
                    text-align: center;
                }

                .lm-lead-input {
                    width: 100%;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 10px 14px;
                    font-size: 14px;
                    margin-bottom: 8px;
                    outline: none;
                    transition: border-color 0.2s ease;
                    font-family: inherit;
                    background: white;
                    color: #1e293b;
                    box-sizing: border-box;
                }

                .lm-lead-input:focus {
                    border-color: ${primaryColor};
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }

                .lm-lead-input::placeholder {
                    color: #94a3b8;
                }

                .lm-lead-submit {
                    width: 100%;
                    background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
                    color: white;
                    border: none;
                    border-radius: 8px;
                    padding: 10px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-family: inherit;
                    margin-top: 4px;
                }

                .lm-lead-submit:hover {
                    opacity: 0.9;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                }

                .lm-lead-submit:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }

                /* CTA Button for links in bot messages */
                .lm-cta-button {
                    display: inline-block;
                    background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
                    color: white !important;
                    text-decoration: none;
                    padding: 10px 20px;
                    border-radius: 25px;
                    font-weight: 600;
                    margin: 8px 4px;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    cursor: pointer;
                    font-size: 13px;
                }

                .lm-cta-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(0,0,0,0.2);
                    opacity: 0.95;
                }

                .lm-cta-button i {
                    margin-left: 6px;
                    font-size: 11px;
                }

                /* ===== CALENDAR WIDGET STYLES (SAFE PATCH - CALENDAR-004) ===== */
                .lm-cal-container {
                    width: 100%;
                    max-height: 280px;
                    overflow-y: auto;
                    border-radius: 12px;
                    background: ${isDark ? '#1f2937' : '#f8fafc'};
                    border: 1px solid ${isDark ? '#374151' : '#e2e8f0'};
                }

                .lm-cal-container::-webkit-scrollbar {
                    width: 4px;
                }
                .lm-cal-container::-webkit-scrollbar-thumb {
                    background: rgba(0,0,0,0.15);
                    border-radius: 2px;
                }

                .lm-cal-loading {
                    text-align: center;
                    padding: 20px;
                    color: ${isDark ? '#9ca3af' : '#64748b'};
                    font-size: 13px;
                }

                .lm-cal-loading .lm-cal-spinner {
                    display: inline-block;
                    width: 20px;
                    height: 20px;
                    border: 2px solid ${primaryColor}40;
                    border-top-color: ${primaryColor};
                    border-radius: 50%;
                    animation: lm-cal-spin 0.8s linear infinite;
                    margin-bottom: 8px;
                }

                @keyframes lm-cal-spin {
                    to { transform: rotate(360deg); }
                }

                .lm-cal-day {
                    padding: 10px 12px;
                    border-bottom: 1px solid ${isDark ? '#374151' : '#e2e8f0'};
                }

                .lm-cal-day:last-child {
                    border-bottom: none;
                }

                .lm-cal-day-header {
                    font-weight: 600;
                    font-size: 12px;
                    color: ${primaryColor};
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .lm-cal-slots {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                }

                .lm-cal-slot {
                    padding: 6px 12px;
                    border: 1px solid ${isDark ? '#4b5563' : '#cbd5e1'};
                    border-radius: 20px;
                    background: ${isDark ? '#374151' : 'white'};
                    color: ${isDark ? '#e5e7eb' : '#334155'};
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-family: inherit;
                    line-height: 1;
                }

                .lm-cal-slot:hover {
                    background: ${primaryColor};
                    color: white;
                    border-color: ${primaryColor};
                    transform: scale(1.05);
                    box-shadow: 0 2px 8px ${primaryColor}40;
                }

                .lm-cal-slot:active {
                    transform: scale(0.95);
                }

                .lm-cal-slot.lm-cal-slot-selected {
                    background: ${primaryColor};
                    color: white;
                    border-color: ${primaryColor};
                }

                .lm-cal-confirm {
                    margin-top: 12px;
                    padding: 10px 16px;
                    background: linear-gradient(135deg, ${successColor}, #059669);
                    color: white;
                    border: none;
                    border-radius: 20px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    width: 100%;
                    transition: all 0.2s ease;
                    font-family: inherit;
                    box-shadow: 0 2px 8px rgba(16,185,129,0.3);
                }

                .lm-cal-confirm:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 16px rgba(16,185,129,0.4);
                }

                .lm-cal-confirm:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }

                .lm-cal-error {
                    text-align: center;
                    padding: 16px;
                    color: ${isDark ? '#9ca3af' : '#64748b'};
                    font-size: 13px;
                }

                .lm-cal-success {
                    text-align: center;
                    padding: 16px;
                    color: ${successColor};
                    font-size: 14px;
                    font-weight: 600;
                }

                /* Custom CSS injection */
                ${config.customCSS || ''}
            `;
        },

        // Inject CSS styles with enhanced error handling
        injectStyles: function () {
            if (document.getElementById('linkmagico-widget-styles')) {
                return; // Styles already injected
            }

            try {
                var styles = document.createElement('style');
                styles.id = 'linkmagico-widget-styles';
                styles.textContent = this.getWidgetCSS();
                document.head.appendChild(styles);
            } catch (error) {
                console.error('LinkMagico Widget: Failed to inject styles', error);
            }
        },

        // Enhanced event binding with error handling
        bindEvents: function () {
            var self = this;

            try {
                // Widget button click
                this.bindEvent('lm-widget-button', 'click', function () {
                    self.toggleChat();
                });

                // Close and minimize buttons
                this.bindEvent('lm-chat-close', 'click', function () {
                    self.closeChat();
                });

                this.bindEvent('lm-chat-minimize', 'click', function () {
                    self.minimizeChat();
                });

                // Send button and input events
                this.bindEvent('lm-send-button', 'click', function () {
                    self.sendMessage();
                });

                var input = document.getElementById('lm-message-input');
                if (input) {
                    // Enter key handling
                    input.addEventListener('keydown', function (e) {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            self.sendMessage();
                        }
                    });

                    // Auto-resize and character count
                    input.addEventListener('input', function () {
                        self.autoResizeInput(this);
                        self.updateCharCounter(this);
                    });

                    // Focus handling
                    input.addEventListener('focus', function () {
                        self.hideBadge();
                    });
                }

                // Error message close
                this.bindEvent('lm-error-close', 'click', function () {
                    self.hideError();
                });

                // Overlay click to close on mobile
                this.bindEvent('lm-widget-overlay', 'click', function () {
                    self.closeChat();
                });

                // Global event listeners
                window.addEventListener('resize', function () {
                    self.handleResize();
                });

                // Handle visibility change for analytics
                document.addEventListener('visibilitychange', function () {
                    if (!document.hidden && self.isOpen) {
                        self.hideBadge();
                        self.trackEvent('widget_focused');
                    }
                });

                // SAFE PATCH - LEAD-002: Lead form submit binding
                this.bindEvent('lm-lead-submit', 'click', function () {
                    self.captureLead();
                });

                // Allow Enter key on lead form name field
                var leadNameInput = document.getElementById('lm-lead-name');
                if (leadNameInput) {
                    leadNameInput.addEventListener('keydown', function (e) {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            self.captureLead();
                        }
                    });
                }

            } catch (error) {
                console.error('LinkMagico Widget event binding failed:', error);
            }
        },

        // Helper function for safe event binding
        bindEvent: function (elementId, eventType, handler) {
            var element = document.getElementById(elementId);
            if (element) {
                element.addEventListener(eventType, handler);
            }
        },

        // ===== SAFE PATCH - LEAD CAPTURE METHODS =====

        // Show the lead capture form
        showLeadForm: function () {
            try {
                var form = document.getElementById('lm-lead-form');
                if (form) {
                    form.style.display = 'block';
                    var nameInput = document.getElementById('lm-lead-name');
                    if (nameInput) {
                        setTimeout(function () { nameInput.focus(); }, 100);
                    }
                    // Hide the message input area while form is visible
                    var chatInput = document.querySelector('.lm-chat-input');
                    if (chatInput) {
                        chatInput.style.display = 'none';
                    }
                    this.trackEvent('lead_form_shown');
                }
            } catch (error) {
                console.error('LinkMagico Widget: Failed to show lead form:', error);
                // Fallback: allow chat without lead capture
                this.leadCaptured = true;
            }
        },

        // Capture lead data and send to API
        captureLead: function () {
            var self = this;
            try {
                var nameEl = document.getElementById('lm-lead-name');
                var emailEl = document.getElementById('lm-lead-email');
                var phoneEl = document.getElementById('lm-lead-phone');
                var submitBtn = document.getElementById('lm-lead-submit');

                var name = nameEl ? nameEl.value.trim() : '';
                var email = emailEl ? emailEl.value.trim() : '';
                var phone = phoneEl ? phoneEl.value.trim() : '';

                // Name is required
                if (!name) {
                    if (nameEl) { nameEl.focus(); nameEl.style.borderColor = '#ef4444'; }
                    return;
                }

                // Disable submit button while processing
                if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Enviando...'; }

                var payload = {
                    nome: name,
                    email: email || '',
                    telefone: phone || '',
                    url_origem: this.config.salesUrl || window.location.href,
                    robotName: this.config.robotName,
                    apiKey: this.config.apiKey || ''
                };

                fetch(this.config.apiBase + '/api/capture-lead', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                    .then(function (response) { return response.json(); })
                    .then(function (data) {
                        if (data.success && data.lead && data.lead.id) {
                            self.leadId = data.lead.id;
                            self.storeLeadId(data.lead.id);
                            console.log('✅ LinkMagico Widget: Lead capturado:', data.lead.id);
                        }
                        self.leadCaptured = true;
                        self.onLeadCaptureComplete(name);

                        // Track and callback
                        self.trackEvent('lead_captured', { leadId: self.leadId });
                        if (self.config.onLeadCaptured) {
                            self.config.onLeadCaptured({ name: name, email: email, phone: phone, leadId: self.leadId });
                        }
                    })
                    .catch(function (error) {
                        console.error('LinkMagico Widget: Lead capture API error:', error);
                        // Fallback: allow chat even if API fails
                        self.leadCaptured = true;
                        self.onLeadCaptureComplete(name);
                        self.trackEvent('lead_capture_error', { error: error.message });
                    });

            } catch (error) {
                console.error('LinkMagico Widget: Lead capture failed:', error);
                // Fallback: allow chat
                this.leadCaptured = true;
                this.onLeadCaptureComplete('');
            }
        },

        // Handle post-capture UI transition
        onLeadCaptureComplete: function (name) {
            try {
                // Hide lead form
                var form = document.getElementById('lm-lead-form');
                if (form) { form.style.display = 'none'; }

                // Show message input area
                var chatInput = document.querySelector('.lm-chat-input');
                if (chatInput) { chatInput.style.display = ''; }

                // Add welcome message with name — usa welcomeMessage configurada (whitelabel/config)
                var baseGreeting = this.config.welcomeMessage || 'Olá! Como posso ajudar?';
                var greeting = name ? ('Olá ' + this.escapeHtml(name) + '! ' + baseGreeting) : baseGreeting;
                this.addMessage(greeting, false);

                // Focus input
                var input = document.getElementById('lm-message-input');
                if (input) { input.focus(); }
            } catch (error) {
                console.error('LinkMagico Widget: Post-capture UI error:', error);
            }
        },

        // localStorage helpers for lead persistence
        getStoredLeadId: function () {
            try {
                var key = 'lm_lead_' + (this.config.apiKey || this.config.robotName || 'default');
                return localStorage.getItem(key);
            } catch (e) { return null; }
        },

        storeLeadId: function (leadId) {
            try {
                var key = 'lm_lead_' + (this.config.apiKey || this.config.robotName || 'default');
                localStorage.setItem(key, leadId);
            } catch (e) { /* localStorage not available */ }
        },

        // ===== END LEAD CAPTURE METHODS =====

        // Enhanced chat control methods
        toggleChat: function () {
            if (this.isOpen) {
                this.closeChat();
            } else {
                this.openChat();
            }
        },

        openChat: function () {
            try {
                var chat = document.getElementById('lm-widget-chat');
                var overlay = document.getElementById('lm-widget-overlay');

                if (chat) {
                    chat.classList.add('lm-chat-open');
                    this.isOpen = true;
                    this.hideBadge();

                    // Show overlay on mobile
                    if (this.isMobile()) {
                        overlay.style.display = 'block';
                    }

                    // SAFE PATCH - LEAD-003: Show lead form on first open if captureLeads enabled
                    if (this.config.captureLeads && !this.leadCaptured) {
                        this.showLeadForm();
                    } else {
                        // Focus input after animation (original behavior)
                        var self = this;
                        setTimeout(function () {
                            var input = document.getElementById('lm-message-input');
                            if (input) {
                                input.focus();
                            }
                        }, this.config.animationSpeed);
                    }

                    // Track and callback
                    this.trackEvent('chat_opened');
                    this.dispatchEvent('chatOpened');

                    if (this.config.onOpen) {
                        this.config.onOpen();
                    }
                }
            } catch (error) {
                console.error('Failed to open chat:', error);
                this.handleError('chat_open_failed', error.message);
            }
        },

        closeChat: function () {
            try {
                var chat = document.getElementById('lm-widget-chat');
                var overlay = document.getElementById('lm-widget-overlay');

                if (chat) {
                    chat.classList.remove('lm-chat-open');
                    this.isOpen = false;

                    if (overlay) {
                        overlay.style.display = 'none';
                    }

                    // Track and callback
                    this.trackEvent('chat_closed', {
                        duration: Date.now() - this.startTime,
                        messageCount: this.messageCount
                    });

                    this.dispatchEvent('chatClosed');

                    if (this.config.onClose) {
                        this.config.onClose();
                    }
                }
            } catch (error) {
                console.error('Failed to close chat:', error);
            }
        },

        minimizeChat: function () {
            this.closeChat();
            this.trackEvent('chat_minimized');
        },

        // Enhanced message sending with security
        sendMessage: function () {
            var input = document.getElementById('lm-message-input');
            var message = input ? input.value.trim() : '';

            if (!message) return;

            // SAFE PATCH - LEAD-004: Block sending before lead capture
            if (this.config.captureLeads && !this.leadCaptured) {
                this.showLeadForm();
                return;
            }

            // Security checks
            if (message.length > this.security.maxMessageLength) {
                this.showError('Mensagem muito longa. Limite: ' + this.security.maxMessageLength + ' caracteres.');
                return;
            }

            if (!this.checkRateLimit()) {
                return; // Rate limit message already shown
            }

            try {
                // Disable input during sending
                this.setInputState(false);

                // Add user message to chat
                this.addMessage(message, true);

                // Clear input
                input.value = '';
                this.autoResizeInput(input);
                this.updateCharCounter(input);

                // Show typing indicator
                this.showTyping();

                // Track message
                this.trackEvent('message_sent', {
                    length: message.length,
                    messageCount: this.messageCount
                });

                // Send to API with retries
                this.callAPI(message, 0);

            } catch (error) {
                console.error('Failed to send message:', error);
                this.setInputState(true);
                this.hideTyping();
                this.handleError('message_send_failed', error.message);
            }
        },

        // ═══════════════════════════════════════════════════════
        // 🔍 V9.1/V9.2 — SMART CHECKOUT DETECTION
        // Analisa todos os links/botões da página e retorna o melhor candidato a checkout
        // ═══════════════════════════════════════════════════════
        extractBestCheckoutLink: function () {
            try {
                var elements = [];
                try { elements = Array.from(document.querySelectorAll('a, button')); } catch(_) { return null; }
                if (!elements.length) return null;

                var keywordsHigh   = ['comprar', 'buy', 'checkout', 'pagar', 'finalizar', 'adquirir', 'assinar'];
                var keywordsMedium = ['carrinho', 'cart', 'quero', 'garantir', 'inscrever', 'matricular'];
                var keywordsLow    = ['saiba', 'detalhes', 'ver mais', 'sobre', 'contato', 'blog'];

                // Domínios de plataformas de pagamento (bonus alto)
                var paymentDomains = ['hotmart', 'kiwify', 'eduzz', 'monetizze', 'pay.', 'checkout.', 'mercadopago', 'pagar.me', 'stripe', 'paypal'];

                function scoreElement(el) {
                    var score = 0;
                    var text = (el.innerText || el.textContent || '').toLowerCase().trim();
                    var href = (el.href || '').toLowerCase();

                    // Peso por palavra-chave no texto/href
                    keywordsHigh.forEach(function(k) { if (text.includes(k) || href.includes(k)) score += 50; });
                    keywordsMedium.forEach(function(k) { if (text.includes(k) || href.includes(k)) score += 20; });
                    keywordsLow.forEach(function(k) { if (text.includes(k)) score -= 10; });

                    // Bonus: link para plataforma de pagamento
                    paymentDomains.forEach(function(d) { if (href.includes(d)) score += 60; });

                    // Link válido HTTP
                    if (href.startsWith('http')) score += 10;

                    // Penalizar anchors internos
                    if (href.includes('#') && !href.includes('http')) score -= 30;

                    // Penalizar links vazios ou auto-referentes
                    if (!href || href === 'javascript:void(0)') score -= 50;
                    try { if (href === window.location.href) score -= 30; } catch(_) {}

                    // Bonus: botão com atributo data-checkout
                    try { if (el.getAttribute('data-checkout')) score += 40; } catch(_) {}

                    // Bonus: onclick com URL de pagamento
                    try {
                        var onclick = el.getAttribute('onclick') || '';
                        if (onclick) {
                            paymentDomains.forEach(function(d) { if (onclick.includes(d)) score += 50; });
                        }
                    } catch(_) {}

                    return score;
                }

                var scored = elements.map(function(el) {
                    var href = el.href || null;
                    // Tentar extrair URL de onclick se não tem href
                    if (!href) {
                        try {
                            var onclick = el.getAttribute('onclick') || '';
                            var match = onclick.match(/https?:\/\/[^\s'"]+/);
                            if (match) href = match[0];
                        } catch(_) {}
                    }
                    return { el: el, score: scoreElement(el), href: href };
                }).filter(function(item) { return item.href && item.score > 0; });

                if (!scored.length) return null;

                scored.sort(function(a, b) { return b.score - a.score; });

                var best = scored[0];
                console.log('[SMART-CHECKOUT] Melhor link:', best.href, 'score:', best.score);
                if (scored.length > 1) {
                    console.log('[SMART-CHECKOUT] Top 3:', scored.slice(0, 3).map(function(s) { return s.href + ' (' + s.score + ')'; }));
                }

                return best.href;

            } catch (err) {
                console.warn('[SMART-CHECKOUT] Erro na detecção (fallback: null):', err.message || err);
                return null;
            }
        },

        // Enhanced API call with retry logic
        callAPI: function (message, retryCount) {
            var self = this;
            retryCount = retryCount || 0;

            // 🔍 V9.1: Auto-detect checkout link from page
            var detectedCheckoutLink = null;
            try { detectedCheckoutLink = this.extractBestCheckoutLink(); } catch(_) {}

            var payload = {
                message: message,
                robotName: this.config.robotName,
                instructions: this.config.instructions,
                salesUrl: this.config.salesUrl,
                // SAFE PATCH - CAL-V4-001: Adicionar pageData para que o servidor detecte contexto
                // corretamente (incluindo intent de agendamento). Sem pageData, o Decision Engine
                // não injeta [CALENDAR_WIDGET] na resposta. Widget-v2 e link curto já enviam isso.
                pageData: {
                    url: this.config.salesUrl,
                    checkoutLink: detectedCheckoutLink  // 🔥 V9.1: checkout auto-detectado
                },
                conversationId: this.conversationId,
                // SAFE PATCH - LEAD-005: Include lead data in API call
                leadId: this.leadId || null,
                apiKey: this.config.apiKey || ''
            };

            var headers = {
                'Content-Type': 'application/json',
                'X-Widget-Token': this.token
            };

            var controller = new AbortController();
            var timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

            fetch(this.config.apiBase + '/api/process-chat-inteligente', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload),
                signal: controller.signal
            })
                .then(function (response) {
                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        throw new Error('API request failed: ' + response.status + ' ' + response.statusText);
                    }
                    return response.json();
                })
                .then(function (data) {
                    self.hideTyping();
                    self.setInputState(true);

                    if (data.success && data.response) {
                        // SAFE PATCH - CALENDAR-002: Armazenar hash do calendário para renderização
                        if (data.calendarHash) {
                            self.calendarHash = data.calendarHash;
                        }
                        self.addMessage(data.response, false);

                        // Handle bonuses if present
                        if (data.bonuses_detected && data.bonuses_detected.length > 0) {
                            var bonusText = "🎁 Bônus inclusos: " + data.bonuses_detected.slice(0, 3).join(", ");
                            setTimeout(function () {
                                self.addMessage(bonusText, false);
                            }, 500);
                        }

                        // Track successful response
                        self.trackEvent('message_received', {
                            hasBonus: !!(data.bonuses_detected && data.bonuses_detected.length > 0)
                        });

                        // Callback
                        if (self.config.onMessage) {
                            self.config.onMessage(message, data.response);
                        }
                    } else {
                        throw new Error(data.error || 'Invalid response format');
                    }
                })
                .catch(function (error) {
                    clearTimeout(timeoutId);
                    self.hideTyping();
                    self.setInputState(true);

                    // Handle different error types
                    if (error.name === 'AbortError') {
                        self.handleError('request_timeout', 'Timeout - tente novamente');
                    } else if (error.message.includes('401')) {
                        self.handleError('auth_failed', 'Token inválido');
                    } else if (error.message.includes('403')) {
                        self.handleError('access_denied', 'Domínio não autorizado');
                    } else if (error.message.includes('429')) {
                        self.handleError('rate_limit', 'Muitas mensagens - aguarde');
                    } else if (retryCount < self.config.retryAttempts) {
                        // Retry with exponential backoff
                        var delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
                        setTimeout(function () {
                            self.callAPI(message, retryCount + 1);
                        }, delay);
                        return;
                    } else {
                        self.handleError('api_failed', 'Erro de conexão');
                    }

                    // Track error
                    self.trackEvent('message_error', {
                        error: error.message,
                        retryCount: retryCount
                    });
                });
        },

        // Enhanced message display
        addMessage: function (content, isUser) {
            try {
                var messagesContainer = document.getElementById('lm-chat-messages');
                if (!messagesContainer) return;

                // Limit message history for performance
                this.limitMessages();

                var messageDiv = document.createElement('div');
                messageDiv.className = 'lm-message ' + (isUser ? 'lm-user-message' : 'lm-bot-message');

                var avatar = document.createElement('div');
                avatar.className = 'lm-message-avatar';
                avatar.innerHTML = isUser ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';

                var contentDiv = document.createElement('div');
                contentDiv.className = 'lm-message-content';

                // SAFE PATCH - CALENDAR-V3-001: Renderizar calendário visual inline
                // Normalizar marcador — tratar variações com espaços, colchetes HTML entities, etc.
                var calendarMarker = '[CALENDAR_WIDGET]';
                var hasCalMarker = false;
                if (!isUser && content && typeof content === 'string') {
                    hasCalMarker = content.indexOf(calendarMarker) !== -1;
                    // Fallback: verificar variações comuns
                    if (!hasCalMarker) {
                        hasCalMarker = content.indexOf('CALENDAR_WIDGET') !== -1;
                    }
                }

                if (hasCalMarker) {
                    console.log('📅 [CALENDAR-V3-001] Marcador detectado, renderizando calendário...');
                    try {
                        var textBefore = content.split(calendarMarker)[0];
                        // Se split não separou (variação sem colchetes), tentar outra forma
                        if (textBefore === content) {
                            textBefore = content.split('CALENDAR_WIDGET')[0];
                        }
                        textBefore = textBefore.replace(/\*\*/g, '').replace(/\n+/g, ' ').trim();
                        if (textBefore) {
                            var textEl = document.createElement('div');
                            textEl.style.marginBottom = '12px';
                            textEl.style.fontWeight = '600';
                            textEl.textContent = textBefore;
                            contentDiv.appendChild(textEl);
                        }
                        var calContainer = this.renderCalendarWidget();
                        if (calContainer) {
                            contentDiv.appendChild(calContainer);
                        }
                        contentDiv.style.padding = '16px';
                        contentDiv.style.maxWidth = '100%';
                    } catch (calErr) {
                        console.error('⚠️ [CALENDAR-V3-001] Erro ao renderizar calendário:', calErr);
                        contentDiv.textContent = content.replace(calendarMarker, '').replace('CALENDAR_WIDGET', '').trim() || '📅 Para agendar, entre em contato diretamente.';
                    }
                // Process content for URLs and CTAs
                } else if (!isUser && this.containsURL(content)) {
                    contentDiv.appendChild(this.processMessageContent(content));
                } else {
                    contentDiv.textContent = content;
                }

                messageDiv.appendChild(avatar);
                messageDiv.appendChild(contentDiv);
                messagesContainer.appendChild(messageDiv);

                // Smooth scroll to bottom
                this.scrollToBottom();

                this.messageCount++;
                this.dispatchEvent('messageAdded', { content: content, isUser: isUser });

            } catch (error) {
                console.error('Failed to add message:', error);
                this.handleError('message_display_failed', 'Erro ao exibir mensagem');
            }
        },

        // Process message content with enhanced URL handling
        processMessageContent: function (content) {
            var container = document.createElement('div');
            var urlRegex = /(https?:\/\/[^\s]+)/g;
            var parts = content.split(urlRegex);

            for (var i = 0; i < parts.length; i++) {
                var part = parts[i];

                // FIX: Usar regex literal sem flag /g para evitar bug de lastIndex
                if (/^https?:\/\//.test(part)) {
                    // Create enhanced CTA button for URL
                    var ctaLink = document.createElement('a');
                    ctaLink.href = part;
                    ctaLink.target = '_blank';
                    ctaLink.rel = 'noopener noreferrer';
                    ctaLink.className = 'lm-cta-button';
                    ctaLink.innerHTML = 'Acessar agora <i class="fas fa-external-link-alt"></i>';

                    // Track CTA clicks
                    ctaLink.addEventListener('click', this.trackEvent.bind(this, 'cta_clicked', { url: part }));

                    container.appendChild(ctaLink);
                } else if (part.trim()) {
                    // Add text content
                    var textNode = document.createTextNode(part);
                    container.appendChild(textNode);
                    if (i < parts.length - 1) {
                        container.appendChild(document.createElement('br'));
                    }
                }
            }

            return container;
        },

        // Enhanced error handling
        handleError: function (errorType, message) {
            console.error('LinkMagico Widget Error (' + errorType + '):', message);

            this.showError(message || 'Ocorreu um erro inesperado.');

            if (this.config.onError) {
                this.config.onError(errorType, message);
            }

            this.trackEvent('error_occurred', {
                type: errorType,
                message: message
            });
        },

        showError: function (message) {
            var errorElement = document.getElementById('lm-error-message');
            var errorText = document.getElementById('lm-error-text');

            if (errorElement && errorText) {
                errorText.textContent = message;
                errorElement.style.display = 'block';

                // Auto-hide after 5 seconds
                setTimeout(this.hideError.bind(this), 5000);
            }
        },

        hideError: function () {
            var errorElement = document.getElementById('lm-error-message');
            if (errorElement) {
                errorElement.style.display = 'none';
            }
        },

        // Utility methods
        showTyping: function () {
            var typingIndicator = document.getElementById('lm-typing-indicator');
            if (typingIndicator) {
                typingIndicator.style.display = 'flex';
                this.scrollToBottom();
            }
        },

        hideTyping: function () {
            var typingIndicator = document.getElementById('lm-typing-indicator');
            if (typingIndicator) {
                typingIndicator.style.display = 'none';
            }
        },

        autoResizeInput: function (input) {
            if (input) {
                input.style.height = 'auto';
                input.style.height = Math.min(input.scrollHeight, 120) + 'px';
            }
        },

        updateCharCounter: function (input) {
            var counter = document.getElementById('lm-char-count');
            if (counter && input) {
                counter.textContent = input.value.length;

                // Change color based on usage
                var usage = input.value.length / this.security.maxMessageLength;
                if (usage > 0.9) {
                    counter.style.color = '#ef4444';
                } else if (usage > 0.7) {
                    counter.style.color = '#f59e0b';
                } else {
                    counter.style.color = '';
                }
            }
        },

        setInputState: function (enabled) {
            var input = document.getElementById('lm-message-input');
            var button = document.getElementById('lm-send-button');

            if (input) input.disabled = !enabled;
            if (button) button.disabled = !enabled;
        },

        scrollToBottom: function () {
            var messagesContainer = document.getElementById('lm-chat-messages');
            if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        },

        hideBadge: function () {
            var badge = document.getElementById('lm-widget-badge');
            if (badge) {
                badge.style.display = 'none';
            }
        },

        limitMessages: function () {
            var messagesContainer = document.getElementById('lm-chat-messages');
            if (!messagesContainer) return;

            var messages = messagesContainer.querySelectorAll('.lm-message:not(.lm-welcome-message)');
            if (messages.length >= this.config.maxMessages) {
                var toRemove = messages.length - this.config.maxMessages + 1;
                for (var i = 0; i < toRemove; i++) {
                    if (messages[i]) {
                        messages[i].remove();
                    }
                }
            }
        },

        containsURL: function (text) {
            return /https?:\/\/[^\s]+/.test(text);
        },

        isMobile: function () {
            return window.innerWidth <= this.config.mobileBreakpoint;
        },

        handleResize: function () {
            if (this.isOpen && this.isMobile()) {
                var overlay = document.getElementById('lm-widget-overlay');
                if (overlay) {
                    overlay.style.display = 'block';
                }
            }
        },

        escapeHtml: function (text) {
            var div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        // Analytics and tracking
        trackEvent: function (eventName, data) {
            if (!this.config.analytics) return;

            try {
                var eventData = {
                    event: eventName,
                    timestamp: Date.now(),
                    conversationId: this.conversationId,
                    version: this.version,
                    url: window.location.href,
                    userAgent: navigator.userAgent,
                    ...data
                };

                // Send to analytics endpoint (fire and forget)
                if (navigator.sendBeacon) {
                    navigator.sendBeacon(
                        this.config.apiBase + '/api/widget/analytics',
                        JSON.stringify(eventData)
                    );
                } else {
                    // Fallback for older browsers
                    fetch(this.config.apiBase + '/api/widget/analytics', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(eventData),
                        keepalive: true
                    }).catch(function () {
                        // Ignore analytics failures
                    });
                }
            } catch (error) {
                // Ignore analytics errors
            }
        },

        // Event system
        dispatchEvent: function (eventName, data) {
            try {
                var event = new CustomEvent('linkmagico:' + eventName, {
                    detail: data || {}
                });
                window.dispatchEvent(event);
            } catch (error) {
                // Fallback for older browsers
                var event = document.createEvent('CustomEvent');
                event.initCustomEvent('linkmagico:' + eventName, false, false, data || {});
                window.dispatchEvent(event);
            }
        },

        log: function () {
            if (this.config.debug) {
                console.log.apply(console, arguments);
            }
        },

        // Public API methods
        open: function () {
            this.openChat();
        },

        close: function () {
            this.closeChat();
        },

        toggle: function () {
            this.toggleChat();
        },

        sendMessage: function (message) {
            if (message && typeof message === 'string') {
                var input = document.getElementById('lm-message-input');
                if (input) {
                    input.value = message;
                    this.sendMessage();
                }
            }
        },

        updateConfig: function (newConfig) {
            this.config = this.mergeConfig(this.config, newConfig);

            // Re-inject styles with new config
            var existingStyles = document.getElementById('linkmagico-widget-styles');
            if (existingStyles) {
                existingStyles.textContent = this.getWidgetCSS();
            }
        },

        getState: function () {
            return {
                initialized: this.initialized,
                isOpen: this.isOpen,
                messageCount: this.messageCount,
                conversationId: this.conversationId,
                version: this.version,
                uptime: Date.now() - this.startTime
            };
        },

        destroy: function () {
            try {
                // Track destruction
                this.trackEvent('widget_destroyed');

                // Remove widget elements
                var container = document.getElementById('linkmagico-widget');
                if (container) {
                    container.remove();
                }

                // Remove styles
                var styles = document.getElementById('linkmagico-widget-styles');
                if (styles) {
                    styles.remove();
                }

                // Reset state
                this.initialized = false;
                this.isOpen = false;
                this.messageCount = 0;

                this.dispatchEvent('widgetDestroyed');

            } catch (error) {
                console.error('Failed to destroy widget:', error);
            }
        },

        // ===== SAFE PATCH - CALENDAR-V3-002: Calendário Visual Inline (Reforçado) =====

        // Buscar e renderizar slots em um container existente (usado pelo fallback crypto)
        fetchAndRenderSlots: function (container, hash, apiBase) {
            var self = this;
            console.log('📅 [CALENDAR-V3-003] Buscando slots com hash:', hash);
            fetch(apiBase + '/api/public/availability/' + encodeURIComponent(hash), {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            })
            .then(function (response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            })
            .then(function (data) {
                if (!data.success || !data.slots || data.slots.length === 0) {
                    container.innerHTML = '<div class="lm-cal-error">😕 Nenhum horário disponível no momento.<br>Tente novamente mais tarde.</div>';
                    return;
                }
                self._buildCalendarUI(container, data.slots, hash);
            })
            .catch(function (error) {
                console.error('❌ [CALENDAR-V3-003] Erro ao buscar slots:', error);
                container.innerHTML = '<div class="lm-cal-error">⚠️ Não foi possível carregar os horários.<br>Tente novamente.</div>';
            });
        },

        // Renderizar widget de calendário interativo dentro da mensagem do bot
        renderCalendarWidget: function () {
            var self = this;
            var container = document.createElement('div');
            container.className = 'lm-cal-container';
            container.id = 'lm-cal-' + Date.now();

            // Estado de loading
            container.innerHTML = '<div class="lm-cal-loading"><div class="lm-cal-spinner"></div><br>Carregando horários...</div>';

            // Determinar hash: prefere o armazenado via API, senão gera client-side
            var hash = this.calendarHash || null;
            console.log('📅 [CALENDAR-V3-002] renderCalendarWidget chamado. calendarHash:', hash, '| apiKey:', this.config.apiKey ? this.config.apiKey.substring(0, 8) + '...' : 'vazio');

            if (!hash && this.config.apiKey) {
                // SAFE PATCH - CALENDAR-V3-004: Fallback — gerar hash client-side
                // Usa o mesmo algoritmo do scheduling-manager.js: sha256("calendar_" + apiKey).hex().substring(0,16)
                try {
                    var self2 = this;
                    var apiBase2 = this.config.apiBase;
                    crypto.subtle.digest('SHA-256', new TextEncoder().encode('calendar_' + this.config.apiKey))
                        .then(function (buf) {
                            var hashHex = Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
                            var clientHash = hashHex.substring(0, 16);
                            self2.calendarHash = clientHash;
                            console.log('📅 [CALENDAR-V3-004] Hash gerado client-side:', clientHash);
                            // Buscar slots com o hash gerado — usa fetchAndRenderSlots agora definida
                            self2.fetchAndRenderSlots(container, clientHash, apiBase2);
                        })
                        .catch(function (err) {
                            console.warn('⚠️ [CALENDAR-V3-004] Crypto fallback falhou:', err.message);
                            container.innerHTML = '<div class="lm-cal-error">📅 Para agendar, entre em contato diretamente.</div>';
                        });
                    return container;
                } catch (cryptoErr) {
                    console.warn('⚠️ [CALENDAR-V3-004] Web Crypto não disponível:', cryptoErr.message);
                    container.innerHTML = '<div class="lm-cal-error">📅 Para agendar, entre em contato diretamente.</div>';
                    return container;
                }
            }

            if (!hash) {
                // Fallback final: sem hash e sem apiKey
                container.innerHTML = '<div class="lm-cal-error">📅 Para agendar, entre em contato diretamente.</div>';
                return container;
            }

            // Buscar slots disponíveis via API pública — usa fetchAndRenderSlots
            this.fetchAndRenderSlots(container, hash, this.config.apiBase);
            return container;
        },

        // Construir UI do calendário a partir dos slots retornados
        _buildCalendarUI: function (container, slots, hash) {
            var self = this;
            // Renderizar slots (máximo 5 dias para caber no widget)
            var slotsToShow = slots.slice(0, 5);
            var html = '';

            slotsToShow.forEach(function (day) {
                html += '<div class="lm-cal-day">';
                html += '<div class="lm-cal-day-header">📅 ' + self.escapeHtml(day.dayName) + ' — ' + self.formatCalDate(day.date) + '</div>';
                html += '<div class="lm-cal-slots">';

                // Mostrar máximo 6 horários por dia
                var timesToShow = day.times.slice(0, 6);
                timesToShow.forEach(function (time) {
                    html += '<button class="lm-cal-slot" data-date="' + self.escapeHtml(day.date) + '" data-time="' + self.escapeHtml(time) + '" data-dayname="' + self.escapeHtml(day.dayName) + '">';
                    html += time;
                    html += '</button>';
                });

                if (day.times.length > 6) {
                    html += '<span style="font-size:11px;color:#94a3b8;padding:4px;">+' + (day.times.length - 6) + ' mais</span>';
                }

                html += '</div></div>';
            });

            html += '<button class="lm-cal-confirm" id="lm-cal-confirm-btn" disabled>Selecione um horário acima</button>';

            container.innerHTML = html;

            // Estado de seleção
            var selectedDate = null;
            var selectedTime = null;
            var selectedDayName = null;

            // Bind eventos nos slots
            var slotButtons = container.querySelectorAll('.lm-cal-slot');
            slotButtons.forEach(function (btn) {
                btn.addEventListener('click', function () {
                    // Desselecionar anterior
                    var prev = container.querySelector('.lm-cal-slot-selected');
                    if (prev) prev.classList.remove('lm-cal-slot-selected');

                    // Selecionar este
                    btn.classList.add('lm-cal-slot-selected');
                    selectedDate = btn.getAttribute('data-date');
                    selectedTime = btn.getAttribute('data-time');
                    selectedDayName = btn.getAttribute('data-dayname');

                    // Habilitar botão de confirmação
                    var confirmBtn = container.querySelector('#lm-cal-confirm-btn');
                    if (confirmBtn) {
                        confirmBtn.disabled = false;
                        confirmBtn.textContent = '✅ Confirmar ' + selectedDayName + ' às ' + selectedTime;
                    }
                });
            });

            // Bind botão de confirmação
            var confirmBtn = container.querySelector('#lm-cal-confirm-btn');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', function () {
                    if (!selectedDate || !selectedTime) return;
                    self.bookSlot(hash, selectedDate, selectedTime, selectedDayName, container);
                });
            }

            self.scrollToBottom();
        },

        // Formatar data para exibição amigável (2026-03-31 → 31/03)
        formatCalDate: function (dateStr) {
            try {
                var parts = dateStr.split('-');
                return parts[2] + '/' + parts[1];
            } catch (e) {
                return dateStr;
            }
        },

        // Confirmar agendamento via API pública
        bookSlot: function (hash, date, time, dayName, container) {
            var self = this;
            var confirmBtn = container.querySelector('#lm-cal-confirm-btn');
            if (confirmBtn) {
                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Agendando...';
            }

            var payload = {
                date: date,
                time: time,
                name: 'Visitante',
                email: '',
                phone: '',
                leadId: this.leadId || null,
                notes: 'Agendado via widget'
            };

            // Tentar pegar dados do lead capturado
            try {
                var nameEl = document.getElementById('lm-lead-name');
                var emailEl = document.getElementById('lm-lead-email');
                var phoneEl = document.getElementById('lm-lead-phone');
                if (nameEl && nameEl.value) payload.name = nameEl.value.trim();
                if (emailEl && emailEl.value) payload.email = emailEl.value.trim();
                if (phoneEl && phoneEl.value) payload.phone = phoneEl.value.trim();
            } catch (e) { /* campos não disponíveis */ }

            fetch(this.config.apiBase + '/api/public/book/' + encodeURIComponent(hash), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(function (response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.json();
            })
            .then(function (data) {
                if (data.success) {
                    container.innerHTML = '<div class="lm-cal-success">✅ Agendamento confirmado!<br>📅 ' + self.escapeHtml(dayName) + ' às ' + self.escapeHtml(time) + '<br><br><span style="font-size:12px;color:#64748b;">Nossa equipe entrará em contato para confirmar.</span></div>';
                    self.trackEvent('calendar_booked', { date: date, time: time });
                    self.scrollToBottom();
                } else {
                    throw new Error(data.error || 'Erro ao agendar');
                }
            })
            .catch(function (error) {
                console.error('❌ [CALENDAR] Erro ao confirmar agendamento:', error);
                if (confirmBtn) {
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = '⚠️ Erro — Tente novamente';
                    confirmBtn.style.background = '#ef4444';
                }
                self.trackEvent('calendar_book_error', { error: error.message });
            });
        }
    };

    // Expose widget to global scope
    window.LinkMagicoWidget = LinkMagicoWidget;

    // Function to run auto-initialization
    function runAutoInit() {
        if (LinkMagicoWidget.initialized) return;

        // Priority 1: Check for window.LinkMagicoWidgetConfig (recommended method)
        if (window.LinkMagicoWidgetConfig) {
            try {
                console.log('LinkMagico Widget: Initializing with window.LinkMagicoWidgetConfig');
                // Support both apiKey and apikey (lowercase)
                const config = window.LinkMagicoWidgetConfig;
                if (!config.apiKey && config.apikey) config.apiKey = config.apikey;

                LinkMagicoWidget.init(config);
                return;
            } catch (error) {
                console.error('Failed to auto-initialize LinkMagico Widget from window config:', error);
            }
        }

        // Priority 2: Check for data attributes
        var scripts = document.querySelectorAll('script[data-linkmagico-config]');
        if (scripts.length > 0) {
            try {
                var configScript = scripts[0];
                var config = JSON.parse(configScript.getAttribute('data-linkmagico-config'));
                console.log('LinkMagico Widget: Initializing with data-linkmagico-config');
                LinkMagicoWidget.init(config);
            } catch (error) {
                console.error('Failed to auto-initialize LinkMagico Widget from data attribute:', error);
            }
        }
    }

    // Auto-initialize if config is provided
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runAutoInit);
    } else {
        // DOM already ready, run immediately
        runAutoInit();
    }

    // Track page unload for analytics
    window.addEventListener('beforeunload', function () {
        if (LinkMagicoWidget.initialized) {
            LinkMagicoWidget.trackEvent('page_unload', {
                uptime: Date.now() - LinkMagicoWidget.startTime,
                messageCount: LinkMagicoWidget.messageCount
            });
        }
    });

    // AMD/CommonJS compatibility
    if (typeof define === 'function' && define.amd) {
        define(function () {
            return LinkMagicoWidget;
        });
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = LinkMagicoWidget;
    }

})(window, document);