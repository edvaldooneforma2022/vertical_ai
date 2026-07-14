/**
 * Script de Teste - API de Captura de Leads
 * Link Mágico - Validação das Correções
 */

const API_BASE = "http://localhost:3000"; // Alterar para URL de produção se necessário

// Cores para output no terminal
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName) {
    console.log('\n' + '='.repeat(60));
    log(`🧪 TESTE: ${testName}`, 'cyan');
    console.log('='.repeat(60));
}

function logSuccess(message) {
    log(`✅ SUCESSO: ${message}`, 'green');
}

function logError(message) {
    log(`❌ ERRO: ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠️  AVISO: ${message}`, 'yellow');
}

// ===== TESTE 1: Captura de Lead COM API Key =====
async function test1_capturaComApiKey() {
    logTest('Captura de Lead COM API Key Válida');
    
    const payload = {
        nome: "João Silva Teste",
        email: `teste_${Date.now()}@exemplo.com`,
        telefone: "+5511999999999",
        url_origem: "https://exemplo.com/teste",
        robotName: "@convertaleads",
        apiKey: "LMV7-NI12-9HIH-46S6" // API Key de teste
    };
    
    try {
        log('📤 Enviando requisição...', 'blue');
        console.log('Payload:', JSON.stringify(payload, null, 2));
        
        const response = await fetch(`${API_BASE}/api/capture-lead`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        log(`📥 Status: ${response.status}`, 'blue');
        console.log('Resposta:', JSON.stringify(data, null, 2));
        
        if (response.status === 200 && data.success) {
            logSuccess('Lead capturado com sucesso!');
            logSuccess(`Lead ID: ${data.lead.id}`);
            return true;
        } else {
            logError(`Falha ao capturar lead: ${data.error || 'Erro desconhecido'}`);
            return false;
        }
    } catch (error) {
        logError(`Exceção: ${error.message}`);
        return false;
    }
}

// ===== TESTE 2: Captura de Lead SEM API Key =====
async function test2_capturaSemApiKey() {
    logTest('Captura de Lead SEM API Key (deve falhar)');
    
    const payload = {
        nome: "Maria Santos Teste",
        email: `teste_${Date.now()}@exemplo.com`,
        telefone: "+5511988888888",
        url_origem: "https://exemplo.com/teste",
        robotName: "@vendas"
        // apiKey não incluída propositalmente
    };
    
    try {
        log('📤 Enviando requisição SEM apiKey...', 'blue');
        console.log('Payload:', JSON.stringify(payload, null, 2));
        
        const response = await fetch(`${API_BASE}/api/capture-lead`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        log(`📥 Status: ${response.status}`, 'blue');
        console.log('Resposta:', JSON.stringify(data, null, 2));
        
        if (response.status === 401 && !data.success && data.error.includes('API Key')) {
            logSuccess('Validação funcionando! Requisição sem API Key foi rejeitada corretamente.');
            return true;
        } else {
            logError('Validação FALHOU! Requisição sem API Key deveria retornar 401.');
            return false;
        }
    } catch (error) {
        logError(`Exceção: ${error.message}`);
        return false;
    }
}

// ===== TESTE 3: Captura de Lead sem Email =====
async function test3_capturaSemEmail() {
    logTest('Captura de Lead sem Email (deve falhar)');
    
    const payload = {
        nome: "Pedro Oliveira Teste",
        telefone: "+5511977777777",
        url_origem: "https://exemplo.com/teste",
        robotName: "@suporte",
        apiKey: "LMV7-NI12-9HIH-46S6"
        // email não incluído propositalmente
    };
    
    try {
        log('📤 Enviando requisição SEM email...', 'blue');
        console.log('Payload:', JSON.stringify(payload, null, 2));
        
        const response = await fetch(`${API_BASE}/api/capture-lead`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        log(`📥 Status: ${response.status}`, 'blue');
        console.log('Resposta:', JSON.stringify(data, null, 2));
        
        if (response.status === 400 && !data.success && data.error.includes('Email')) {
            logSuccess('Validação funcionando! Requisição sem email foi rejeitada corretamente.');
            return true;
        } else {
            logError('Validação FALHOU! Requisição sem email deveria retornar 400.');
            return false;
        }
    } catch (error) {
        logError(`Exceção: ${error.message}`);
        return false;
    }
}

// ===== TESTE 4: Multi-Tenant (Diferentes API Keys) =====
async function test4_multiTenant() {
    logTest('Multi-Tenant - Diferentes API Keys');
    
    const apiKey1 = "LMV7-NI12-9HIH-46S6";
    const apiKey2 = "TEST-KEY2-XXXX-YYYY";
    
    const payload1 = {
        nome: "Cliente A - Lead 1",
        email: `clienteA_${Date.now()}@exemplo.com`,
        telefone: "+5511999991111",
        url_origem: "https://clienteA.com",
        robotName: "@clienteA",
        apiKey: apiKey1
    };
    
    const payload2 = {
        nome: "Cliente B - Lead 1",
        email: `clienteB_${Date.now()}@exemplo.com`,
        telefone: "+5511999992222",
        url_origem: "https://clienteB.com",
        robotName: "@clienteB",
        apiKey: apiKey2
    };
    
    try {
        log('📤 Enviando lead para Cliente A...', 'blue');
        const response1 = await fetch(`${API_BASE}/api/capture-lead`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload1)
        });
        const data1 = await response1.json();
        
        log('📤 Enviando lead para Cliente B...', 'blue');
        const response2 = await fetch(`${API_BASE}/api/capture-lead`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload2)
        });
        const data2 = await response2.json();
        
        if (data1.success && data2.success) {
            logSuccess('Ambos os leads foram capturados!');
            logWarning('VALIDAÇÃO MANUAL NECESSÁRIA: Verificar se os leads estão em sistemas separados.');
            logWarning(`Lead Cliente A ID: ${data1.lead.id}`);
            logWarning(`Lead Cliente B ID: ${data2.lead.id}`);
            return true;
        } else {
            logError('Falha ao capturar um ou ambos os leads.');
            return false;
        }
    } catch (error) {
        logError(`Exceção: ${error.message}`);
        return false;
    }
}

// ===== EXECUTAR TODOS OS TESTES =====
async function runAllTests() {
    console.clear();
    log('\n🚀 INICIANDO TESTES DE VALIDAÇÃO - LINK MÁGICO', 'cyan');
    log(`🌐 API Base: ${API_BASE}\n`, 'yellow');
    
    const results = {
        total: 0,
        passed: 0,
        failed: 0
    };
    
    // Executar testes
    const tests = [
        { name: 'Teste 1', fn: test1_capturaComApiKey },
        { name: 'Teste 2', fn: test2_capturaSemApiKey },
        { name: 'Teste 3', fn: test3_capturaSemEmail },
        { name: 'Teste 4', fn: test4_multiTenant }
    ];
    
    for (const test of tests) {
        results.total++;
        const passed = await test.fn();
        if (passed) {
            results.passed++;
        } else {
            results.failed++;
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay entre testes
    }
    
    // Resumo
    console.log('\n' + '='.repeat(60));
    log('📊 RESUMO DOS TESTES', 'cyan');
    console.log('='.repeat(60));
    log(`Total de Testes: ${results.total}`, 'blue');
    log(`✅ Aprovados: ${results.passed}`, 'green');
    log(`❌ Reprovados: ${results.failed}`, 'red');
    
    if (results.failed === 0) {
        log('\n🎉 TODOS OS TESTES PASSARAM!', 'green');
    } else {
        log(`\n⚠️  ${results.failed} TESTE(S) FALHARAM!`, 'red');
    }
    
    console.log('='.repeat(60) + '\n');
}

// Executar
runAllTests().catch(error => {
    logError(`Erro fatal: ${error.message}`);
    console.error(error);
});
