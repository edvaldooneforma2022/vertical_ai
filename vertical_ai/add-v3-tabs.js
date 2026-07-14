const fs = require('fs');

let html = fs.readFileSync('public/index_app.html', 'utf8');

// 1. Adicionar novos botões de abas (depois do botão "Sistema")
const newTabButtons = `
                <button class="new-tab" onclick="showNewTab('gmail')" style="background:#334155; color:white; border:none; padding:1rem 1.5rem; border-radius:12px; cursor:pointer; font-weight:600;">
                    📧 Gmail
                </button>
                <button class="new-tab" onclick="showNewTab('whatsapp')" style="background:#334155; color:white; border:none; padding:1rem 1.5rem; border-radius:12px; cursor:pointer; font-weight:600;">
                    📱 WhatsApp
                </button>
                <button class="new-tab" onclick="showNewTab('chatgpt')" style="background:#334155; color:white; border:none; padding:1rem 1.5rem; border-radius:12px; cursor:pointer; font-weight:600;">
                    🤖 ChatGPT
                </button>
                <button class="new-tab" onclick="showNewTab('whitelabel')" style="background:#334155; color:white; border:none; padding:1rem 1.5rem; border-radius:12px; cursor:pointer; font-weight:600;">
                    🎨 Whitelabel
                </button>
                <button class="new-tab" onclick="showNewTab('leads')" style="background:#334155; color:white; border:none; padding:1rem 1.5rem; border-radius:12px; cursor:pointer; font-weight:600;">
                    📝 Leads
                </button>`;

// Encontrar onde inserir (depois do botão Sistema)
const systemButtonPattern = /<button class="new-tab" onclick="showNewTab\('system'\)"[^>]*>[\s\S]*?⚙️ Sistema[\s\S]*?<\/button>/;
const systemButtonMatch = html.match(systemButtonPattern);

if (systemButtonMatch) {
    const insertIndex = html.indexOf(systemButtonMatch[0]) + systemButtonMatch[0].length;
    html = html.slice(0, insertIndex) + newTabButtons + html.slice(insertIndex);
    console.log('✅ Botões das abas adicionados');
} else {
    console.log('❌ Não encontrou botão Sistema');
}

// 2. Adicionar conteúdos das novas abas (antes do fechamento do modal)
const newTabContents = `
            
            <!-- Tab Gmail -->
            <div id="tab-gmail" class="new-tab-content" style="display:none;">
                <div style="background:#1e293b; padding:2rem; border-radius:16px;">
                    <h2 style="color:#60a5fa; margin-bottom:1rem;">📧 Integração Gmail</h2>
                    <p style="color:#cbd5e1; margin-bottom:1.5rem;">Configure envio automático de emails</p>
                    
                    <div style="background:#334155; padding:1.5rem; border-radius:12px; margin-bottom:1.5rem;">
                        <h3 style="color:#cbd5e1; margin-bottom:1rem;">Status da Integração</h3>
                        <div id="gmail-status" style="color:#94a3b8;">Carregando...</div>
                    </div>
                    
                    <div style="background:#334155; padding:1.5rem; border-radius:12px;">
                        <h3 style="color:#cbd5e1; margin-bottom:1rem;">Testar Envio</h3>
                        <input type="email" id="test-email" placeholder="email@exemplo.com" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid #475569; background:#1e293b; color:#cbd5e1; margin-bottom:1rem;">
                        <button onclick="testGmail()" style="background:#3b82f6; color:white; border:none; padding:0.75rem 1.5rem; border-radius:8px; cursor:pointer; font-weight:600;">
                            Enviar Email de Teste
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Tab WhatsApp - MULTI-TENANT -->
            <div id="tab-whatsapp" class="new-tab-content" style="display:none;">
                <div style="padding:2rem;">
                    <h2 style="color:#60a5fa; margin-bottom:1rem;">📱 Configurar WhatsApp</h2>
                    <p style="color:#cbd5e1; margin-bottom:1.5rem;">
                        Configure suas próprias credenciais para receber notificações no seu WhatsApp
                    </p>

                    <!-- Status -->
                    <div id="whatsapp-status-card" style="padding:1.5rem; background:#1e293b; border-radius:12px; margin-bottom:2rem;">
                        <h3 style="color:#cbd5e1; margin-bottom:1rem;">Status da Configuração</h3>
                        <div id="whatsapp-current-status" style="color:#94a3b8;">Carregando...</div>
                    </div>

                    <!-- Escolha de Provider -->
                    <div style="margin-bottom:2rem;">
                        <label style="color:#cbd5e1; display:block; margin-bottom:0.75rem; font-weight:600;">Escolha o Provider:</label>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem;">
                            <button onclick="selectProvider('twilio')" id="btn-twilio" class="provider-btn" style="padding:1.5rem; background:#1e293b; border:2px solid #334155; border-radius:12px; color:#cbd5e1; cursor:pointer; font-weight:600; transition:all 0.3s;">
                                📱 Twilio<br><small style="font-weight:400; color:#94a3b8;">Pago e Confiável</small>
                            </button>
                            <button onclick="selectProvider('evolution')" id="btn-evolution" class="provider-btn" style="padding:1.5rem; background:#1e293b; border:2px solid #334155; border-radius:12px; color:#cbd5e1; cursor:pointer; font-weight:600; transition:all 0.3s;">
                                🆓 Evolution API<br><small style="font-weight:400; color:#94a3b8;">Grátis (self-hosted)</small>
                            </button>
                        </div>
                    </div>

                    <!-- Formulário Twilio -->
                    <div id="form-twilio" style="display:none; background:#1e293b; padding:1.5rem; border-radius:12px; margin-bottom:2rem;">
                        <h3 style="color:#60a5fa; margin-bottom:1rem;">⚙️ Configurar Twilio</h3>
                        <div style="display:flex; flex-direction:column; gap:1rem;">
                            <div>
                                <label style="color:#cbd5e1; display:block; margin-bottom:0.5rem;">Account SID:</label>
                                <input type="text" id="twilio-sid" placeholder="ACxxxxxxxxx" style="width:100%; padding:0.75rem; background:#0f172a; border:1px solid #334155; border-radius:6px; color:white;">
                            </div>
                            <div>
                                <label style="color:#cbd5e1; display:block; margin-bottom:0.5rem;">Auth Token:</label>
                                <input type="password" id="twilio-token" placeholder="Seu token secreto" style="width:100%; padding:0.75rem; background:#0f172a; border:1px solid #334155; border-radius:6px; color:white;">
                            </div>
                            <div>
                                <label style="color:#cbd5e1; display:block; margin-bottom:0.5rem;">WhatsApp Number (From):</label>
                                <input type="text" id="twilio-number" placeholder="+14155238886" style="width:100%; padding:0.75rem; background:#0f172a; border:1px solid #334155; border-radius:6px; color:white;">
                            </div>
                            <div>
                                <label style="color:#cbd5e1; display:block; margin-bottom:0.5rem;">Seu Telefone (Receber Notificações):</label>
                                <input type="text" id="twilio-notification-phone" placeholder="+55 11 99999-9999" style="width:100%; padding:0.75rem; background:#0f172a; border:1px solid #334155; border-radius:6px; color:white;">
                            </div>
                        </div>
                    </div>

                    <!-- Formulário Evolution -->
                    <div id="form-evolution" style="display:none; background:#1e293b; padding:1.5rem; border-radius:12px; margin-bottom:2rem;">
                        <h3 style="color:#60a5fa; margin-bottom:1rem;">⚙️ Configurar Evolution API</h3>
                        <div style="display:flex; flex-direction:column; gap:1rem;">
                            <div>
                                <label style="color:#cbd5e1; display:block; margin-bottom:0.5rem;">API URL:</label>
                                <input type="url" id="evolution-url" placeholder="https://sua-evolution-api.com" style="width:100%; padding:0.75rem; background:#0f172a; border:1px solid #334155; border-radius:6px; color:white;">
                            </div>
                            <div>
                                <label style="color:#cbd5e1; display:block; margin-bottom:0.5rem;">API Key:</label>
                                <input type="password" id="evolution-key" placeholder="Sua chave API" style="width:100%; padding:0.75rem; background:#0f172a; border:1px solid #334155; border-radius:6px; color:white;">
                            </div>
                            <div>
                                <label style="color:#cbd5e1; display:block; margin-bottom:0.5rem;">Instance Name:</label>
                                <input type="text" id="evolution-instance" placeholder="minha_instancia" style="width:100%; padding:0.75rem; background:#0f172a; border:1px solid #334155; border-radius:6px; color:white;">
                            </div>
                            <div>
                                <label style="color:#cbd5e1; display:block; margin-bottom:0.5rem;">Seu Telefone (Receber Notificações):</label>
                                <input type="text" id="evolution-notification-phone" placeholder="+55 11 99999-9999" style="width:100%; padding:0.75rem; background:#0f172a; border:1px solid #334155; border-radius:6px; color:white;">
                            </div>
                        </div>
                    </div>

                    <!-- Ações -->
                    <div style="display:flex; gap:1rem; flex-wrap:wrap;">
                        <button onclick="saveWhatsAppSettings()" style="flex:1; min-width:200px; background:#10b981; color:white; border:none; padding:1rem 1.5rem; border-radius:8px; cursor:pointer; font-weight:600; transition:all 0.3s;">
                            💾 Salvar Configurações
                        </button>
                        <button onclick="testWhatsAppConnection()" style="flex:1; min-width:200px; background:#3b82f6; color:white; border:none; padding:1rem 1.5rem; border-radius:8px; cursor:pointer; font-weight:600; transition:all 0.3s;">
                            ✅ Testar Conexão
                        </button>
                        <button onclick="deleteWhatsAppSettings()" style="flex:1; min-width:200px; background:#ef4444; color:white; border:none; padding:1rem 1.5rem; border-radius:8px; cursor:pointer; font-weight:600; transition:all 0.3s;">
                            🗑️ Remover Config
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Tab ChatGPT -->
            <div id="tab-chatgpt" class="new-tab-content" style="display:none;">
                <div style="background:#1e293b; padding:2rem; border-radius:16px;">
                    <h2 style="color:#60a5fa; margin-bottom:1rem;">🤖 Integração ChatGPT</h2>
                    <p style="color:#cbd5e1; margin-bottom:1.5rem;">Use GPT-4 para respostas de alta qualidade</p>
                    
                    <div style="background:#334155; padding:1.5rem; border-radius:12px; margin-bottom:1.5rem;">
                        <h3 style="color:#cbd5e1; margin-bottom:1rem;">Status da Integração</h3>
                        <div id="chatgpt-status" style="color:#94a3b8;">Carregando...</div>
                    </div>
                    
                    <div style="background:#334155; padding:1.5rem; border-radius:12px; margin-bottom:1.5rem;">
                        <h3 style="color:#cbd5e1; margin-bottom:1rem;">Modelos Disponíveis</h3>
                        <div id="chatgpt-models" style="color:#94a3b8;">Carregando...</div>
                    </div>
                    
                    <div style="background:#334155; padding:1.5rem; border-radius:12px;">
                        <h3 style="color:#cbd5e1; margin-bottom:1rem;">Testar Geração</h3>
                        <textarea id="test-prompt" placeholder="Digite uma pergunta..." style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid #475569; background:#1e293b; color:#cbd5e1; margin-bottom:1rem; min-height:100px;"></textarea>
                        <button onclick="testChatGPT()" style="background:#10a37f; color:white; border:none; padding:0.75rem 1.5rem; border-radius:8px; cursor:pointer; font-weight:600;">
                            Gerar Resposta
                        </button>
                        <div id="chatgpt-response" style="margin-top:1rem; padding:1rem; background:#1e293b; border-radius:8px; color:#cbd5e1; display:none;"></div>
                    </div>
                </div>
            </div>
            
            <!-- Tab Whitelabel -->
            <div id="tab-whitelabel" class="new-tab-content" style="display:none;">
                <div style="background:#1e293b; padding:2rem; border-radius:16px;">
                    <h2 style="color:#60a5fa; margin-bottom:1rem;">🎨 Whitelabel</h2>
                    <p style="color:#cbd5e1; margin-bottom:1.5rem;">Personalize a marca do seu chatbot</p>
                    
                    <div style="background:#334155; padding:1.5rem; border-radius:12px; margin-bottom:1.5rem;">
                        <h3 style="color:#cbd5e1; margin-bottom:1rem;">Configuração</h3>
                        
                        <label style="color:#94a3b8; display:block; margin-bottom:0.5rem;">Nome da Empresa:</label>
                        <input type="text" id="wl-company" placeholder="Minha Empresa" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid #475569; background:#1e293b; color:#cbd5e1; margin-bottom:1rem;">
                        
                        <label style="color:#94a3b8; display:block; margin-bottom:0.5rem;">URL do Logo:</label>
                        <input type="url" id="wl-logo" placeholder="https://exemplo.com/logo.png" style="width:100%; padding:0.75rem; border-radius:8px; border:1px solid #475569; background:#1e293b; color:#cbd5e1; margin-bottom:1rem;">
                        
                        <label style="color:#94a3b8; display:block; margin-bottom:0.5rem;">Cor Primária:</label>
                        <input type="color" id="wl-primary" value="#3b82f6" style="width:100%; padding:0.5rem; border-radius:8px; border:1px solid #475569; background:#1e293b; margin-bottom:1rem;">
                        
                        <label style="color:#94a3b8; display:block; margin-bottom:0.5rem;">Cor Secundária:</label>
                        <input type="color" id="wl-secondary" value="#8b5cf6" style="width:100%; padding:0.5rem; border-radius:8px; border:1px solid #475569; background:#1e293b; margin-bottom:1.5rem;">
                        
                        <button onclick="saveWhitelabel()" style="background:#3b82f6; color:white; border:none; padding:0.75rem 1.5rem; border-radius:8px; cursor:pointer; font-weight:600; width:100%;">
                            Salvar Configuração
                        </button>
                    </div>
                    
                    <div style="background:#334155; padding:1.5rem; border-radius:12px;">
                        <h3 style="color:#cbd5e1; margin-bottom:1rem;">Preview</h3>
                        <div id="wl-preview" style="padding:2rem; background:#1e293b; border-radius:8px; text-align:center;">
                            <div style="color:#94a3b8;">Configure os campos acima para ver o preview</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Tab Leads -->
            <div id="tab-leads" class="new-tab-content" style="display:none;">
                <div style="background:#1e293b; padding:2rem; border-radius:16px;">
                    <h2 style="color:#60a5fa; margin-bottom:1rem;">📝 Leads Estruturados</h2>
                    <p style="color:#cbd5e1; margin-bottom:1.5rem;">Gerencie leads capturados com campos estruturados</p>
                    
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-bottom:2rem;">
                        <div style="background:#334155; padding:1.5rem; border-radius:12px;">
                            <div style="color:#94a3b8; font-size:0.9rem; margin-bottom:0.5rem;">Total de Leads</div>
                            <div id="leads-total" style="color:#60a5fa; font-size:2rem; font-weight:700;">-</div>
                        </div>
                        <div style="background:#334155; padding:1.5rem; border-radius:12px;">
                            <div style="color:#94a3b8; font-size:0.9rem; margin-bottom:0.5rem;">Leads Hot</div>
                            <div id="leads-hot" style="color:#ef4444; font-size:2rem; font-weight:700;">-</div>
                        </div>
                        <div style="background:#334155; padding:1.5rem; border-radius:12px;">
                            <div style="color:#94a3b8; font-size:0.9rem; margin-bottom:0.5rem;">Leads Warm</div>
                            <div id="leads-warm" style="color:#f59e0b; font-size:2rem; font-weight:700;">-</div>
                        </div>
                        <div style="background:#334155; padding:1.5rem; border-radius:12px;">
                            <div style="color:#94a3b8; font-size:0.9rem; margin-bottom:0.5rem;">Leads Cold</div>
                            <div id="leads-cold" style="color:#3b82f6; font-size:2rem; font-weight:700;">-</div>
                        </div>
                    </div>
                    
                    <div style="background:#334155; padding:1.5rem; border-radius:12px; margin-bottom:1.5rem;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                            <h3 style="color:#cbd5e1; margin:0;">Lista de Leads</h3>
                            <button onclick="exportLeads()" style="background:#10b981; color:white; border:none; padding:0.5rem 1rem; border-radius:8px; cursor:pointer; font-weight:600;">
                                📥 Exportar CSV
                            </button>
                        </div>
                        <div id="leads-list" style="color:#94a3b8;">Carregando...</div>
                    </div>
                </div>
            </div>`;

// Encontrar onde inserir (antes do fechamento do modal)
const closingDivPattern = /<\/div>\s*<\/div>\s*<button id="openNewSystemsBtn"/;
const closingMatch = html.match(closingDivPattern);

if (closingMatch) {
    const insertIndex = html.indexOf(closingMatch[0]);
    html = html.slice(0, insertIndex) + newTabContents + '\n        ' + html.slice(insertIndex);
    console.log('✅ Conteúdos das abas adicionados');
} else {
    console.log('❌ Não encontrou local para inserir conteúdos');
}

// 3. Adicionar funções JavaScript (antes do fechamento do script)
const newFunctions = `
        
        // ===== FUNÇÕES DAS NOVAS INTEGRAÇÕES V3 =====
        
        async function loadGmailStatus() {
            try {
                const response = await fetch('/api/gmail/status');
                const data = await response.json();
                const statusEl = document.getElementById('gmail-status');
                
                if (data.configured) {
                    statusEl.innerHTML = '<div style="color:#10b981;">✅ Gmail configurado e pronto para uso</div>';
                } else {
                    statusEl.innerHTML = '<div style="color:#f59e0b;">⚠️ Gmail não configurado. Configure as variáveis GMAIL_USER e GMAIL_PASSWORD no .env</div>';
                }
            } catch (error) {
                console.error('Erro ao carregar status Gmail:', error);
            }
        }
        
        async function testGmail() {
            const email = document.getElementById('test-email').value;
            if (!email) {
                alert('Digite um email!');
                return;
            }
            
            try {
                const response = await fetch('/api/gmail/send', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        to: email,
                        subject: 'Teste Link Mágico V3',
                        html: '<h1>Email de teste!</h1><p>Se você recebeu este email, a integração Gmail está funcionando! 🎉</p>'
                    })
                });
                
                const data = await response.json();
                if (data.success) {
                    alert('Email enviado com sucesso! Verifique a caixa de entrada.');
                } else {
                    alert('Erro ao enviar email: ' + (data.error || 'Desconhecido'));
                }
            } catch (error) {
                console.error('Erro:', error);
                alert('Erro ao enviar email');
            }
        }
        
        
        // ===== WHATSAPP MULTI-TENANT (NOVO) =====
        
        let currentProvider = null;

        async function loadWhatsAppSettings() {
            try {
                const apiKey = window.currentApiKey;
                if (!apiKey) {
                    console.error('API Key não disponível');
                    return;
                }

                const response = await fetch('/api/whatsapp/settings', {
                    headers: { 'X-API-Key': apiKey }
                });
                const data = await response.json();
                
                const statusEl = document.getElementById('whatsapp-current-status');
                
                if (data.configured) {
                    let html = '<div style="color:#10b981; margin-bottom:0.5rem;">';
                    html += '✅ <strong>WhatsApp Configurado</strong>';
                    html += '</div>';
                    html += '<div style="color:#94a3b8; font-size:0.9rem;">';
                    html += 'Provider: <strong>' + data.settings.provider.toUpperCase() + '</strong><br>';
                    html += 'Telefone: ' + (data.settings.notificationPhone || 'Não informado') + '<br>';
                    html += 'Status: ' + (data.settings.isActive ? '🟢 Ativo' : '🔴 Inativo');
                    html += '</div>';
                    statusEl.innerHTML = html;
                    
                    // Preencher formulário com dados existentes
                    selectProvider(data.settings.provider);
                    if (data.settings.provider === 'twilio' && data.settings.hasTwilioConfig) {
                        document.getElementById('twilio-notification-phone').value = data.settings.notificationPhone || '';
                    } else if (data.settings.provider === 'evolution' && data.settings.hasEvolutionConfig) {
                        document.getElementById('evolution-notification-phone').value = data.settings.notificationPhone || '';
                    }
                } else {
                    const fallbackMessage = data.usingGlobal 
                        ? '🔄 Usando configuração global do administrador' 
                        : 'Configure suas próprias credenciais';
                    
                    let html = '<div style="color:#f59e0b; margin-bottom:0.5rem;">';
                    html += '⚠️ <strong>Sem Configuração Própria</strong>';
                    html += '</div>';
                    html += '<div style="color:#94a3b8; font-size:0.9rem;">';
                    html += fallbackMessage;
                    html += '</div>';
                    statusEl.innerHTML = html;
                }
            } catch (error) {
                console.error('Erro ao carregar configurações WhatsApp:', error);
                document.getElementById('whatsapp-current-status').innerHTML = 
                    '<div style="color:#ef4444;">❌ Erro ao carregar status</div>';
            }
        }

            function selectProvider(provider) {
                currentProvider = provider;

            // Atualizar botões
            document.getElementById('btn-twilio').style.borderColor = provider === 'twilio' ? '#10b981' : '#334155';
            document.getElementById('btn-twilio').style.background = provider === 'twilio' ? '#065f46' : '#1e293b';

            document.getElementById('btn-evolution').style.borderColor = provider === 'evolution' ? '#10b981' : '#334155';
            document.getElementById('btn-evolution').style.background = provider === 'evolution' ? '#065f46' : '#1e293b';

            // Mostrar formulário apropriado
            document.getElementById('form-twilio').style.display = provider === 'twilio' ? 'block' : 'none';
            document.getElementById('form-evolution').style.display = provider === 'evolution' ? 'block' : 'none';
        }

            async function saveWhatsAppSettings() {
            if (!currentProvider) {
                alert('⚠️ Selecione um provider primeiro (Twilio ou Evolution)');
            return;
            }

            const settings = {provider: currentProvider };

            if (currentProvider === 'twilio') {
                settings.twilioAccountSid = document.getElementById('twilio-sid').value;
            settings.twilioAuthToken = document.getElementById('twilio-token').value;
            settings.twilioFromNumber = document.getElementById('twilio-number').value;
            settings.notificationPhone = document.getElementById('twilio-notification-phone').value;

            if (!settings.twilioAccountSid || !settings.twilioAuthToken || !settings.twilioFromNumber) {
                alert('❌ Preencha todos os campos obrigatórios do Twilio');
            return;
                }
            } else if (currentProvider === 'evolution') {
                settings.evolutionApiUrl = document.getElementById('evolution-url').value;
            settings.evolutionApiKey = document.getElementById('evolution-key').value;
            settings.evolutionInstanceName = document.getElementById('evolution-instance').value;
            settings.notificationPhone = document.getElementById('evolution-notification-phone').value;

            if (!settings.evolutionApiUrl || !settings.evolutionApiKey || !settings.evolutionInstanceName) {
                alert('❌ Preencha todos os campos obrigatórios da Evolution API');
            return;
                }
            }

            try {
                const apiKey = window.currentApiKey;
            const response = await fetch('/api/whatsapp/settings', {
                method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            'X-API-Key': apiKey
                    },
            body: JSON.stringify(settings)
                });

            const data = await response.json();

            if (data.success) {
                alert('✅ Configurações salvas com sucesso!');
            loadWhatsAppSettings();
                } else {
                alert('❌ Erro: ' + data.error);
                }
            } catch (error) {
                console.error('Erro:', error);
            alert('❌ Erro ao salvar: ' + error.message);
            }
        }

            async function testWhatsAppConnection() {
            const phone = currentProvider === 'twilio'
            ? document.getElementById('twilio-notification-phone').value
            : document.getElementById('evolution-notification-phone').value;

            if (!phone) {
                alert('⚠️ Informe o telefone para teste');
            return;
            }

            if (!confirm('📱 Enviar mensagem de teste para ' + phone + '?')) {
                return;
            }

            try {
                const apiKey = window.currentApiKey;
            const response = await fetch('/api/whatsapp/settings/test', {
                method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            'X-API-Key': apiKey
                    },
            body: JSON.stringify({phoneNumber: phone })
                });

            const data = await response.json();
            alert(data.message);
            } catch (error) {
                console.error('Erro:', error);
            alert('❌ Erro ao testar: ' + error.message);
            }
        }

            async function deleteWhatsAppSettings() {
            if (!confirm('🗑️ Tem certeza? Você voltará a usar a configuração global do admin.')) {
                return;
            }

            try {
                const apiKey = window.currentApiKey;
            const response = await fetch('/api/whatsapp/settings', {
                method: 'DELETE',
            headers: {'X-API-Key': apiKey }
                });

            const data = await response.json();

            if (data.success) {
                alert('✅ Configurações removidas com sucesso!');
                    // Limpar formulários
                    document.getElementById('form-twilio').querySelectorAll('input').forEach(input => input.value = '');
                    document.getElementById('form-evolution').querySelectorAll('input').forEach(input => input.value = '');
            currentProvider = null;
            document.getElementById('btn-twilio').style.borderColor = '#334155';
            document.getElementById('btn-twilio').style.background = '#1e293b';
            document.getElementById('btn-evolution').style.borderColor = '#334155';
            document.getElementById('btn-evolution').style.background = '#1e293b';
            document.getElementById('form-twilio').style.display = 'none';
            document.getElementById('form-evolution').style.display = 'none';
            loadWhatsAppSettings();
                } else {
                alert('❌ Erro: ' + data.error);
                }
            } catch (error) {
                console.error('Erro:', error);
            alert('❌ Erro ao deletar: ' + error.message);
            }
        }

            // Manter função antiga para compatibilidade (ainda é usada pela aba antiga se existir)
            async function loadWhatsAppStatus() {
                await loadWhatsAppSettings();
        }

            async function testWhatsApp() {
                await testWhatsAppConnection();
        }

            async function loadChatGPTStatus() {
            try {
                const response = await fetch('/api/chatgpt/status');
            const data = await response.json();
            const statusEl = document.getElementById('chatgpt-status');

            if (data.configured) {
                statusEl.innerHTML = '<div style="color:#10b981;">✅ ChatGPT configurado e pronto</div>';
                } else {
                statusEl.innerHTML = '<div style="color:#f59e0b;">⚠️ ChatGPT não configurado. Configure CHATGPT_API_KEY no .env</div>';
                }

            // Carregar modelos
            const modelsResponse = await fetch('/api/chatgpt/models');
            const modelsData = await modelsResponse.json();
            const modelsEl = document.getElementById('chatgpt-models');
                
                if (modelsData.length > 0) {
                modelsEl.innerHTML = modelsData.map(m => \`
            <div style="background:#1e293b; padding:1rem; border-radius:8px; margin-bottom:0.5rem;">
                <div style="color:#cbd5e1; font-weight:600;">\${m.name}</div>
                <div style="color:#94a3b8; font-size:0.9rem;">\${m.description}</div>
            </div>
            \`).join('');
                }
            } catch (error) {
                console.error('Erro ao carregar status ChatGPT:', error);
            }
        }

            async function testChatGPT() {
            const prompt = document.getElementById('test-prompt').value;
            if (!prompt) {
                alert('Digite uma pergunta!');
            return;
            }

            const responseEl = document.getElementById('chatgpt-response');
            responseEl.style.display = 'block';
            responseEl.innerHTML = '<div style="color:#94a3b8;">Gerando resposta...</div>';

            try {
                const response = await fetch('/api/chatgpt/generate', {
                method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                prompt: prompt,
            model: 'gpt-4-turbo'
                    })
                });

            const data = await response.json();
            if (data.success) {
                responseEl.innerHTML = \`<div style="color:#cbd5e1;">\${data.result.response}</div>\`;
                } else {
                responseEl.innerHTML = \`<div style="color:#ef4444;">Erro: \${data.error}</div>\`;
                }
            } catch (error) {
                console.error('Erro:', error);
            responseEl.innerHTML = '<div style="color:#ef4444;">Erro ao gerar resposta</div>';
            }
        }

            async function saveWhitelabel() {
            const config = {
                companyName: document.getElementById('wl-company').value,
            logoUrl: document.getElementById('wl-logo').value,
            primaryColor: document.getElementById('wl-primary').value,
            secondaryColor: document.getElementById('wl-secondary').value
            };

            try {
                const response = await fetch('/api/whitelabel/default', {
                method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(config)
                });

            const data = await response.json();
            if (data.success) {
                alert('Configuração salva com sucesso!');
            updateWhitelabelPreview(config);
                } else {
                alert('Erro ao salvar: ' + (data.error || 'Desconhecido'));
                }
            } catch (error) {
                console.error('Erro:', error);
            alert('Erro ao salvar configuração');
            }
        }

            function updateWhitelabelPreview(config) {
            const preview = document.getElementById('wl-preview');
            preview.innerHTML = \`
            <div style="background:linear-gradient(135deg, \${config.primaryColor}, \${config.secondaryColor}); padding:2rem; border-radius:12px;">
                \${config.logoUrl ?\`<img src="\${config.logoUrl}" style="max-width:200px; margin-bottom:1rem;">\` : ''}
                    <h3 style="color:white; margin:0;">\${config.companyName || 'Sua Empresa'}</h3>
            </div>
            \`;
        }

            async function loadLeadsStats() {
            try {
                const response = await fetch('/api/leads/stats/default');
            const data = await response.json();

            if (data.success) {
                document.getElementById('leads-total').textContent = data.stats.total || 0;
            document.getElementById('leads-hot').textContent = data.stats.hot || 0;
            document.getElementById('leads-warm').textContent = data.stats.warm || 0;
            document.getElementById('leads-cold').textContent = data.stats.cold || 0;
                }

            // Carregar lista
            const leadsResponse = await fetch('/api/leads/structured/default?limit=10');
            const leadsData = await leadsResponse.json();

            const listEl = document.getElementById('leads-list');
                if (leadsData.success && leadsData.leads.length > 0) {
                listEl.innerHTML = leadsData.leads.map(lead => \`
            <div style="background:#1e293b; padding:1rem; border-radius:8px; margin-bottom:0.5rem;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <div style="color:#cbd5e1; font-weight:600;">\${lead.name || 'Sem nome'}</div>
                        <div style="color:#94a3b8; font-size:0.9rem;">\${lead.email || ''} | \${lead.phone || ''}</div>
                    </div>
                    <div style="background:\${lead.classification === 'hot' ? '#ef4444' : lead.classification === 'warm' ? '#f59e0b' : '#3b82f6'}; color:white; padding:0.25rem 0.75rem; border-radius:6px; font-size:0.8rem;">
                        \${lead.classification?.toUpperCase() || 'N/A'}
                    </div>
                </div>
            </div>
            \`).join('');
                } else {
                listEl.innerHTML = '<p style="color:#94a3b8;">Nenhum lead capturado ainda.</p>';
                }
            } catch (error) {
                console.error('Erro ao carregar leads:', error);
            }
        }

            async function exportLeads() {
            try {
                window.open('/api/leads/export/default', '_blank');
            } catch (error) {
                console.error('Erro ao exportar leads:', error);
            alert('Erro ao exportar leads');
            }
        }`;

// Encontrar onde inserir (antes do fechamento do último script)
const scriptClosingPattern = /<\/script>\s*<\/body>/;
const scriptMatch = html.match(scriptClosingPattern);

if (scriptMatch) {
    const insertIndex = html.indexOf(scriptMatch[0]);
    html = html.slice(0, insertIndex) + newFunctions + '\n    ' + html.slice(insertIndex);
    console.log('✅ Funções JavaScript adicionadas');
} else {
    console.log('❌ Não encontrou local para inserir funções');
}

// 4. Atualizar a função showNewTab para incluir as novas tabs
const showNewTabPattern = /if \(tabName === 'system'\) loadSystemStatus\(\);/;
if (html.match(showNewTabPattern)) {
    html = html.replace(showNewTabPattern, `if (tabName === 'system') loadSystemStatus();
            if (tabName === 'gmail') loadGmailStatus();
            if (tabName === 'whatsapp') loadWhatsAppStatus();
            if (tabName === 'chatgpt') loadChatGPTStatus();
            if (tabName === 'leads') loadLeadsStats();`);
    console.log('✅ Função showNewTab atualizada');
}

// Salvar arquivo
fs.writeFileSync('public/index_app.html', html, 'utf8');

console.log('\n✅ Painel atualizado com sucesso!');
console.log('📊 Tamanho final:', html.length, 'caracteres');
console.log('📝 Total de linhas:', html.split('\n').length);
