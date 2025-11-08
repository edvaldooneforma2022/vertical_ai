const fetch = require('node-fetch');

// Configurações de Teste
const API_BASE = "http://localhost:3000"; // Assumindo que o servidor está rodando na porta 3000
const TEST_API_KEY = "LMV7-NI12-9HIH-46S6"; // Chave de teste
const TEST_EMAIL = "agendamento.teste@linkmagico.com";
const TEST_NOME = "Agendamento Teste";
const TEST_HORARIO = "Quarta 16:00";

async function runTest(name, url, method, body, expectedStatus, expectedSuccess) {
    console.log(`\n--- Teste: ${name} ---`);
    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const status = response.status;
        const result = await response.json();

        const statusPass = status === expectedStatus;
        const successPass = result.success === expectedSuccess;
        const overallPass = statusPass && successPass;

        console.log(`Status Esperado: ${expectedStatus}, Recebido: ${status} [${statusPass ? '✅' : '❌'}]`);
        console.log(`Success Esperado: ${expectedSuccess}, Recebido: ${result.success} [${successPass ? '✅' : '❌'}]`);
        console.log(`Resultado da API:`, result);
        
        return overallPass;

    } catch (error) {
        console.error(`❌ Erro de Conexão/Execução: ${error.message}`);
        return false;
    }
}

async function testBookingFeature() {
    let passedCount = 0;
    let totalCount = 0;

    // Teste 1: Agendamento de sucesso (Lead existente ou novo)
    totalCount++;
    if (await runTest(
        "Agendamento de Sucesso (Com API Key)",
        `${API_BASE}/api/schedule-booking`,
        'POST',
        {
            nome: TEST_NOME,
            email: TEST_EMAIL,
            horario: TEST_HORARIO,
            apiKey: TEST_API_KEY,
            url_origem: "https://teste.com/agendamento",
            robotName: "@agendador"
        },
        200,
        true
    )) passedCount++;

    // Teste 2: Falha por falta de API Key
    totalCount++;
    if (await runTest(
        "Falha: API Key Ausente",
        `${API_BASE}/api/schedule-booking`,
        'POST',
        {
            nome: TEST_NOME,
            email: TEST_EMAIL,
            horario: TEST_HORARIO,
            url_origem: "https://teste.com/agendamento",
            robotName: "@agendador"
        },
        401,
        false
    )) passedCount++;

    // Teste 3: Falha por falta de Horário
    totalCount++;
    if (await runTest(
        "Falha: Horário Ausente",
        `${API_BASE}/api/schedule-booking`,
        'POST',
        {
            nome: TEST_NOME,
            email: TEST_EMAIL,
            apiKey: TEST_API_KEY,
            url_origem: "https://teste.com/agendamento",
            robotName: "@agendador"
        },
        400,
        false
    )) passedCount++;

    // Teste 4: Falha por falta de Email
    totalCount++;
    if (await runTest(
        "Falha: Email Ausente",
        `${API_BASE}/api/schedule-booking`,
        'POST',
        {
            nome: TEST_NOME,
            horario: TEST_HORARIO,
            apiKey: TEST_API_KEY,
            url_origem: "https://teste.com/agendamento",
            robotName: "@agendador"
        },
        400,
        false
    )) passedCount++;


    console.log(`\n===================================`);
    console.log(`✅ Testes Passados: ${passedCount}/${totalCount}`);
    console.log(`❌ Testes Falhados: ${totalCount - passedCount}/${totalCount}`);
    console.log(`===================================\n`);
    
    if (passedCount === totalCount) {
        console.log("🎉 TODOS OS TESTES DE AGENDAMENTO PASSARAM!");
    } else {
        console.log("⚠️ FALHA EM UM OU MAIS TESTES DE AGENDAMENTO!");
    }
}

// Para rodar o teste, o servidor deve estar ativo na porta 3000
// Ex: node server.js & node test-api-booking.js
console.log("⚠️ ATENÇÃO: Este teste requer que o servidor 'server.js' esteja rodando na porta 3000.");
// testBookingFeature(); // Descomente para rodar o teste
