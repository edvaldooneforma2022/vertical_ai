// setup-auth.js - Script de Inicialização Simples
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔐 LinkMágico v6.0 - Configuração de Autenticação\n');

// Criar diretório data se não existir
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('✅ Pasta "data" criada');
}

// Gerar primeira API Key
function generateFirstApiKey() {
    const keyId = crypto.randomUUID();
    const keySecret = crypto.randomBytes(32).toString('hex');
    const apiKey = `lm_${keyId.split('-')[0]}_${keySecret.substring(0, 32)}`;
    
    const keyData = {
        key: apiKey,
        client: 'Cliente Principal',
        plan: 'pro',
        created: new Date().toISOString(),
        active: true,
        limits: {
            dailyRequests: 500,
            monthlyRequests: 10000,
            chatbotsPerDay: 25,
            extractionsPerDay: 100
        },
        usage: {
            requests: 0,
            chatbots: 0,
            extractions: 0,
            lastUsed: null
        }
    };

    // Salvar API Key
    const apiKeysData = {
        apiKeys: [[apiKey, keyData]],
        saved: new Date().toISOString()
    };

    const dataFile = path.join(dataDir, 'api_keys.json');
    fs.writeFileSync(dataFile, JSON.stringify(apiKeysData, null, 2));

    // Salvar dados de uso
    const usageData = {
        usage: [[apiKey, {
            daily: { date: new Date().toDateString(), requests: 0 },
            monthly: { month: getCurrentMonth(), requests: 0 }
        }]],
        saved: new Date().toISOString()
    };

    const usageFile = path.join(dataDir, 'usage.json');
    fs.writeFileSync(usageFile, JSON.stringify(usageData, null, 2));

    return keyData;
}

function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Executar configuração
try {
    console.log('Gerando sua primeira API Key...\n');
    
    const keyData = generateFirstApiKey();
    
    console.log('✅ Sistema configurado com sucesso!\n');
    console.log('📋 SUA PRIMEIRA API KEY:');
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log(`│ ${keyData.key}                    │`);
    console.log('└─────────────────────────────────────────────────────────────────┘');
    console.log('');
    console.log('🔗 Para usar no frontend:');
    console.log(`localStorage.setItem('linkmagico_api_key', '${keyData.key}');`);
    console.log('');
    console.log('⚠️  IMPORTANTE:');
    console.log('1. Guarde esta API Key em local seguro');
    console.log('2. Não compartilhe publicamente');
    console.log('3. Use apenas em aplicações autorizadas');
    console.log('');
    console.log('🚀 Próximo passo: npm start');
    
} catch (error) {
    console.error('❌ Erro na configuração:', error.message);
    process.exit(1);
}