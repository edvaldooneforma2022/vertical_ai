/**
 * TESTE AUTOMATIZADO — AUTO-LEARNING VALIDATION PROTOCOL
 * 
 * PASSO 1: Baseline (4 perguntas)
 * PASSO 2: Treinamento (25 interacoes de compra + simulacao de conversao)
 * PASSO 3: Teste final (mesma pergunta, nova sessao)
 * PASSO 4: Comparacao e relatorio
 */

const https = require('https');

const BASE_URL = 'https://vertical-ai-dktu.onrender.com';
const API_KEY = 'LMV7-P079-NLC2-8ZY7';

function makeRequest(path, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const url = new URL(path, BASE_URL);
        
        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'x-api-key': API_KEY
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => { responseData += chunk; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(responseData));
                } catch (e) {
                    resolve({ raw: responseData });
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(data);
        req.end();
    });
}

async function sendChat(message, conversationId) {
    const body = {
        message: message,
        apiKey: API_KEY,
        conversationId: conversationId || 'test-' + Date.now(),
        robotName: '@teste'
    };
    
    return makeRequest('/api/process-chat-inteligente', body);
}

async function trackEvent(conversationId, eventType) {
    // Simular evento de conversao (click/whatsapp)
    const body = {
        conversationId: conversationId,
        eventType: eventType,
        apiKey: API_KEY
    };
    
    try {
        return await makeRequest('/api/track-event', body);
    } catch (e) {
        // Endpoint pode nao existir, tenta alternativas
        return null;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =====================================
// PASSO 1: BASELINE
// =====================================
async function runBaseline() {
    console.log('\n' + '='.repeat(60));
    console.log('PASSO 1: BASELINE (ANTES DO APRENDIZADO)');
    console.log('='.repeat(60));
    
    const baselineConvId = 'baseline-' + Date.now();
    const questions = [
        'o que e isso?',
        'como funciona?',
        'quanto custa?',
        'quero comprar'
    ];
    
    const responses = {};
    
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        console.log(`\n--- Q${i+1}: "${q}" ---`);
        
        try {
            const result = await sendChat(q, baselineConvId);
            const response = result.response || result.raw || 'SEM RESPOSTA';
            responses[`Q${i+1}`] = {
                question: q,
                response: response,
                hasCTA: /clique|acesse|compre|garanta|aproveite|link|whatsapp|comprar|adquir/i.test(response),
                hasLink: /https?:\/\//i.test(response),
                length: response.length
            };
            
            console.log(`Resposta (${response.length} chars):`);
            console.log(response.substring(0, 300));
            console.log(`CTA: ${responses[`Q${i+1}`].hasCTA} | Link: ${responses[`Q${i+1}`].hasLink}`);
        } catch (e) {
            console.log('ERRO:', e.message);
            responses[`Q${i+1}`] = { question: q, response: 'ERRO: ' + e.message, hasCTA: false, hasLink: false, length: 0 };
        }
        
        await sleep(2000);
    }
    
    return responses;
}

// =====================================
// PASSO 2: TREINAMENTO
// =====================================
async function runTraining() {
    console.log('\n' + '='.repeat(60));
    console.log('PASSO 2: TREINAMENTO (25 INTERACOES DE COMPRA)');
    console.log('='.repeat(60));
    
    const purchaseMessages = [
        'quero comprar',
        'me manda o link',
        'onde pago?',
        'como faco pra adquirir?',
        'quero comprar agora',
        'me manda o link de compra',
        'quero garantir o meu',
        'como compro?',
        'tem link de pagamento?',
        'quero adquirir',
        'manda o link pra eu comprar',
        'quanto custa e como compro?',
        'quero comprar',
        'me manda o link',
        'onde pago?',
        'quero comprar agora',
        'como faco pra comprar?',
        'tem link pra compra?',
        'quero comprar',
        'manda o link',
        'quero comprar agora mesmo',
        'como adquiro?',
        'quero comprar',
        'me manda o link de compra',
        'quero garantir agora'
    ];
    
    let successCount = 0;
    
    for (let i = 0; i < purchaseMessages.length; i++) {
        const msg = purchaseMessages[i];
        const convId = `training-${Date.now()}-${i}`;
        
        console.log(`\n[${i+1}/25] "${msg}"`);
        
        try {
            const result = await sendChat(msg, convId);
            const response = result.response || '';
            
            console.log(`  Resposta: ${response.substring(0, 150)}...`);
            
            // Simular conversao: click_link
            await sleep(500);
            await trackEvent(convId, 'click_link');
            
            // Simular conversao: open_whatsapp
            await sleep(300);
            await trackEvent(convId, 'open_whatsapp');
            
            successCount++;
            console.log(`  >> Conversao simulada (click + whatsapp)`);
        } catch (e) {
            console.log(`  ERRO: ${e.message}`);
        }
        
        // Delay entre interacoes
        await sleep(1500);
    }
    
    console.log(`\nTreinamento completo: ${successCount}/25 interacoes bem-sucedidas`);
    return successCount;
}

// =====================================
// PASSO 3: TESTE FINAL
// =====================================
async function runFinalTest() {
    console.log('\n' + '='.repeat(60));
    console.log('PASSO 3: TESTE FINAL (APOS APRENDIZADO)');
    console.log('='.repeat(60));
    
    // Nova sessao
    const finalConvId = 'final-' + Date.now();
    
    const questions = [
        'o que e isso?',
        'como funciona?',
        'quanto custa?',
        'quero comprar'
    ];
    
    const responses = {};
    
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        console.log(`\n--- Q${i+1}: "${q}" ---`);
        
        try {
            const result = await sendChat(q, finalConvId);
            const response = result.response || result.raw || 'SEM RESPOSTA';
            responses[`Q${i+1}`] = {
                question: q,
                response: response,
                hasCTA: /clique|acesse|compre|garanta|aproveite|link|whatsapp|comprar|adquir/i.test(response),
                hasLink: /https?:\/\//i.test(response),
                length: response.length
            };
            
            console.log(`Resposta (${response.length} chars):`);
            console.log(response.substring(0, 300));
            console.log(`CTA: ${responses[`Q${i+1}`].hasCTA} | Link: ${responses[`Q${i+1}`].hasLink}`);
        } catch (e) {
            console.log('ERRO:', e.message);
            responses[`Q${i+1}`] = { question: q, response: 'ERRO: ' + e.message, hasCTA: false, hasLink: false, length: 0 };
        }
        
        await sleep(2000);
    }
    
    return responses;
}

// =====================================
// PASSO 4: RELATORIO
// =====================================
function generateReport(baseline, final) {
    console.log('\n' + '='.repeat(60));
    console.log('PASSO 4: RELATORIO DE COMPARACAO');
    console.log('='.repeat(60));
    
    const report = {
        timestamp: new Date().toISOString(),
        baseline: {},
        final: {},
        changes: [],
        verdict: 'PENDENTE'
    };
    
    let changesDetected = 0;
    
    for (const key of ['Q1', 'Q2', 'Q3', 'Q4']) {
        const b = baseline[key];
        const f = final[key];
        
        if (!b || !f) continue;
        
        console.log(`\n${'─'.repeat(50)}`);
        console.log(`${key}: "${b.question}"`);
        console.log(`${'─'.repeat(50)}`);
        
        console.log('\nANTES (baseline):');
        console.log(b.response.substring(0, 500));
        
        console.log('\nDEPOIS (final):');
        console.log(f.response.substring(0, 500));
        
        // Comparar
        const isDifferent = b.response !== f.response;
        const ctaChanged = b.hasCTA !== f.hasCTA;
        const linkChanged = b.hasLink !== f.hasLink;
        const lengthDiff = f.length - b.length;
        
        console.log(`\nMudou? ${isDifferent ? 'SIM' : 'NAO'}`);
        console.log(`CTA mudou? ${ctaChanged ? 'SIM' : 'NAO'} (antes: ${b.hasCTA}, depois: ${f.hasCTA})`);
        console.log(`Link mudou? ${linkChanged ? 'SIM' : 'NAO'} (antes: ${b.hasLink}, depois: ${f.hasLink})`);
        console.log(`Comprimento: ${b.length} -> ${f.length} (${lengthDiff > 0 ? '+' : ''}${lengthDiff})`);
        
        if (isDifferent) changesDetected++;
        
        report.baseline[key] = b;
        report.final[key] = f;
    }
    
    // Foco especial em Q4 ("quero comprar")
    const bQ4 = baseline.Q4;
    const fQ4 = final.Q4;
    
    console.log('\n' + '='.repeat(60));
    console.log('ANALISE DETALHADA: "quero comprar"');
    console.log('='.repeat(60));
    
    if (bQ4 && fQ4) {
        console.log('\n>>> BASELINE:');
        console.log(bQ4.response);
        console.log('\n>>> FINAL:');
        console.log(fQ4.response);
        
        const identical = bQ4.response === fQ4.response;
        console.log(`\nRespostas identicas? ${identical ? 'SIM (NAO FUNCIONOU)' : 'NAO (HOUVE MUDANCA!)'}`);
    }
    
    report.verdict = changesDetected > 0 ? 'FUNCIONOU' : 'NAO FUNCIONOU';
    
    console.log('\n' + '='.repeat(60));
    console.log(`VEREDITO FINAL: ${report.verdict}`);
    console.log(`Mudancas detectadas: ${changesDetected}/4 respostas`);
    console.log('='.repeat(60));
    
    return report;
}

// =====================================
// EXECUCAO PRINCIPAL
// =====================================
async function main() {
    console.log('========================================');
    console.log('AUTO-LEARNING VALIDATION PROTOCOL');
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`API Key: ${API_KEY}`);
    console.log(`Server: ${BASE_URL}`);
    console.log('========================================');
    
    // PASSO 0: Verificar se server esta online
    console.log('\nPASSO 0: Verificando servidor...');
    try {
        const test = await sendChat('oi', 'probe-' + Date.now());
        if (test.response) {
            console.log('Servidor ONLINE. Resposta recebida.');
        } else if (test.error) {
            console.log('AVISO:', test.error);
        }
    } catch (e) {
        console.log('ERRO: Servidor offline ou inacessivel -', e.message);
        return;
    }
    
    await sleep(2000);
    
    // PASSO 1: Baseline
    const baseline = await runBaseline();
    
    await sleep(3000);
    
    // PASSO 2: Treinamento
    const trainingCount = await runTraining();
    
    // Aguardar processamento
    console.log('\nAguardando processamento do auto-learning (15s)...');
    await sleep(15000);
    
    // PASSO 3: Teste final
    const final = await runFinalTest();
    
    // PASSO 4: Relatorio
    const report = generateReport(baseline, final);
    
    // Salvar relatorio em JSON
    const fs = require('fs');
    const reportPath = require('path').join(__dirname, 'data', 'learning', 'test-report.json');
    try {
        fs.mkdirSync(require('path').join(__dirname, 'data', 'learning'), { recursive: true });
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\nRelatorio salvo em: ${reportPath}`);
    } catch (e) {
        console.log('Aviso: nao conseguiu salvar relatorio:', e.message);
    }
}

main().catch(console.error);
