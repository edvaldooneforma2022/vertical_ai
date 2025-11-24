<script>
(function() {
    'use strict';
    
    // ===== CONFIGURAÇÃO DO CLIENTE =====
    // O cliente deve configurar apenas estes campos:
    const config = {
        robotName: "@teste",              // Nome do robô/assistente
        salesUrl: "https://www.arsenalsecretodosceos.com.br/r3bu6mj",  // URL do produto/página de vendas
        instructions: "Sempre responda de forma amigável, consultiva e entusiasmada, mas objetiva.", // Instruções personalizadas
        primaryColor: "#FFD700",                  // Cor primária do widget
        apiKey: "LMV7-GTN1-14EQ-AOEX"                // ⚠️ CHAVE ÚNICA DE CADA CLIENTE (OBRIGATÓRIA )
    };

    // ===== CONFIGURAÇÃO DO SERVIDOR =====
    const apiBase = "https://vertical-ai-dktu.onrender.com"; // Domínio do seu servidor
    
    // ===== NÃO MODIFICAR ABAIXO DESTA LINHA =====
    
    // Verificar se apiKey foi configurada
    if (!config.apiKey || config.apiKey === "SUA_API_KEY_AQUI" ) {
        console.error("❌ LinkMágico Widget: API Key não configurada! Configure a propriedade 'apiKey' no objeto config.");
        return;
    }
    
    // Criar balão flutuante
    const bubble = document.createElement('div');
    bubble.innerHTML = `
        <style>
            .linkmagico-chat-bubble {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 60px;
                height: 60px;
                background: linear-gradient(135deg, ${config.primaryColor} 0%, #1e40af 100%);
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
    
    document.body.appendChild(bubble );
    
    // Abrir janela do chatbot ao clicar no balão
    document.getElementById('linkmagicoChatBubble').addEventListener('click', function() {
        // Construir URL com todos os parâmetros incluindo apiKey
        const chatUrl = `${apiBase}/chatbot?` + 
            `apiKey=${encodeURIComponent(config.apiKey)}&` +
            `robotName=${encodeURIComponent(config.robotName)}&` +
            `url=${encodeURIComponent(config.salesUrl)}&` +
            `instructions=${encodeURIComponent(config.instructions)}&` +
            `color=${encodeURIComponent(config.primaryColor)}`;
        
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
    
    console.log('✅ LinkMágico Widget carregado com sucesso!');
    console.log('📊 API Key:', config.apiKey);
    console.log('🤖 Robot Name:', config.robotName);
    
})();
</script>
