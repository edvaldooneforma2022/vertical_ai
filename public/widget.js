// LinkMágico Commercial Widget v7.0 - Multi-Tenant Universal
// Este script é a versão universal para ser distribuída aos clientes.
// Ele carrega o widget.js do servidor LinkMágico com a API Key do cliente.
(function(window, document) {
    'use strict';

    // Previne inicializações múltiplas
    if (window.LinkMagicoWidgetLoaded) {
        console.warn('LinkMagico Widget Universal já carregado.');
        return;
    }
    window.LinkMagicoWidgetLoaded = true;

    // 1. Obter a configuração do cliente a partir do script tag
    // O cliente deve usar um script tag como este:
    // <script id="linkmagico-config" data-api-key="LMV7-GTN1-14EQ-AOEX" data-robot-name="@teste" data-sales-url="https://vendas.com" data-instructions="Instruções personalizadas" data-primary-color="#FFD700" src="https://SEU_DOMINIO/public/widget.js"></script>
    
    const currentScript = document.getElementById('linkmagico-config');
    if (!currentScript) {
        console.error('❌ LinkMágico Widget: Script tag com id="linkmagico-config" não encontrado. O widget não será carregado.');
        return;
    }

    const apiKey = currentScript.getAttribute('data-api-key');
    const robotName = currentScript.getAttribute('data-robot-name') || 'Assistente IA';
    const salesUrl = currentScript.getAttribute('data-sales-url') || window.location.href;
    const instructions = currentScript.getAttribute('data-instructions') || '';
    const primaryColor = currentScript.getAttribute('data-primary-color') || '#3b82f6';
    
    // 2. Validar a API Key
    if (!apiKey || apiKey.length < 10) {
        console.error('❌ LinkMágico Widget: API Key inválida ou não fornecida no atributo data-api-key.');
        return;
    }

    // 3. Determinar o domínio do servidor LinkMágico
    // O domínio é extraído do atributo 'src' do script tag.
    let apiBase = '';
    try {
        const scriptUrl = new URL(currentScript.src);
        apiBase = scriptUrl.origin;
    } catch (e) {
        console.error('❌ LinkMágico Widget: Não foi possível determinar o domínio do servidor a partir do atributo src do script tag.', e);
        return;
    }

    // 4. Injetar o script do widget real (chat.html)
    // Este é o script que o cliente deve usar para carregar o balão flutuante.
    // Ele aponta para o servidor LinkMágico, passando todos os parâmetros.
    
    const chatUrl = `${apiBase}/chatbot?` + 
        `apiKey=${encodeURIComponent(apiKey)}&` +
        `robotName=${encodeURIComponent(robotName)}&` +
        `url=${encodeURIComponent(salesUrl)}&` +
        `instructions=${encodeURIComponent(instructions)}&` +
        `color=${encodeURIComponent(primaryColor)}`;

    // Cria o balão flutuante
    const bubble = document.createElement('div');
    bubble.innerHTML = `
        <style>
            .linkmagico-chat-bubble {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, ${primaryColor} 0%, #1e40af 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 999999;
                transition: all 0.3s ease;
                animation: pulse 2s infinite;
            }
            .linkmagico-chat-bubble:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 20px rgba(0,0,0,0.25);
            }
            .linkmagico-chat-bubble svg {
                width: 30px;
                height: 30px;
                fill: white;
            }
            @keyframes pulse {
                0%, 100% { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
                50% { box-shadow: 0 4px 20px rgba(59,130,246,0.4); }
            }
            @media (max-width: 768px) {
                .linkmagico-chat-bubble {
                    bottom: 15px;
                    right: 15px;
                    width: 55px;
                    height: 55px;
                }
            }
        </style>
        <div class="linkmagico-chat-bubble" id="linkmagicoChatBubble">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                <path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/>
            </svg>
        </div>
    `;
    
    document.body.appendChild(bubble);
    
    // Abrir janela do chatbot ao clicar no balão
    document.getElementById('linkmagicoChatBubble').addEventListener('click', function() {
        // Abrir janela popup
        const width = 450;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        
        window.open(
            chatUrl,
            'LinkMagicoChatbot',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );
    });
    
    console.log('✅ LinkMágico Widget Universal carregado com sucesso!');
    console.log('📊 API Key:', apiKey);
    console.log('🤖 Robot Name:', robotName);

})(window, document);
