/**
 * FASE 5-7: Validacao Interna + Seguranca + Estabilidade
 */

const https = require('https');
const BASE_URL = 'https://vertical-ai-dktu.onrender.com';
const API_KEY = 'LMV7-P079-NLC2-8ZY7';

function makeRequest(path, body, method = 'POST') {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const url = new URL(path, BASE_URL);
        
        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + (url.search || ''),
            method: method,
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
                    resolve({ status: res.statusCode, data: JSON.parse(responseData) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: { raw: responseData } });
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
        req.write(data);
        req.end();
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

// =====================================
// FASE 5: VALIDACAO INTERNA
// =====================================
async function phase5_InternalValidation() {
    console.log('\n' + '='.repeat(60));
    console.log('FASE 5: VALIDACAO INTERNA');
    console.log('='.repeat(60));

    // Verificar se o endpoint de stats existe
    try {
        const statsResult = await makeRequest('/api/system-stats', { apiKey: API_KEY });
        console.log('\n[SYSTEM STATS]:', JSON.stringify(statsResult.data, null, 2).substring(0, 500));
    } catch (e) {
        console.log('[SYSTEM STATS] Endpoint nao disponivel:', e.message);
    }

    // Gerar interacoes com track-event para validar o pipeline
    console.log('\n--- Testando pipeline completo ---');
    
    // 1. Enviar mensagem
    const convId = 'validate-' + Date.now();
    const chatResult = await sendChat('quero comprar', convId);
    console.log('Chat response status:', chatResult.status);
    console.log('Chat response:', (chatResult.data.response || '').substring(0, 200));

    // 2. Enviar track-event
    await sleep(1000);
    const trackResult = await makeRequest('/api/track-event', {
        conversationId: convId,
        eventType: 'click_link',
        apiKey: API_KEY
    });
    console.log('\n[TRACK-EVENT] click_link:', JSON.stringify(trackResult.data));

    const trackResult2 = await makeRequest('/api/track-event', {
        conversationId: convId,
        eventType: 'open_whatsapp',
        apiKey: API_KEY
    });
    console.log('[TRACK-EVENT] open_whatsapp:', JSON.stringify(trackResult2.data));

    // 3. Validar tipos de evento invalidos
    const invalidTrack = await makeRequest('/api/track-event', {
        conversationId: convId,
        eventType: 'invalid_event',
        apiKey: API_KEY
    });
    console.log('[TRACK-EVENT] invalid (esperado 400):', invalidTrack.status, JSON.stringify(invalidTrack.data));

    return {
        chatOK: chatResult.status === 200,
        trackClickOK: trackResult.data.success === true,
        trackWhatsappOK: trackResult2.data.success === true,
        invalidRejected: invalidTrack.status === 400
    };
}

// =====================================
// FASE 7: TESTE DE ESTABILIDADE
// =====================================
async function phase7_StabilityTest() {
    console.log('\n' + '='.repeat(60));
    console.log('FASE 7: TESTE DE ESTABILIDADE (50 interacoes)');
    console.log('='.repeat(60));

    const messages = [
        'oi', 'o que e isso?', 'como funciona?', 'quanto custa?', 'quero comprar',
        'me manda o link', 'isso funciona?', 'como uso?', 'vou pensar', 'depois vejo',
        'quero comprar agora', 'me ajuda', 'tem desconto?', 'funciona pra loja?',
        'quero testar', 'qual o preco?', 'como pago?', 'aceita pix?', 'boa noite',
        'preciso de ajuda', 'como configura?', 'tem suporte?', 'funciona no instagram?',
        'e no whatsapp?', 'quero saber mais', 'me explica melhor', 'como comecar?',
        'vale a pena?', 'qual a garantia?', 'posso cancelar?', 'tem teste gratis?',
        'quero o link', 'como compro?', 'me manda', 'quero agora', 'onde pago?',
        'tem boleto?', 'aceita cartao?', 'quanto tempo demora?', 'e facil de usar?',
        'meu nome e joao', 'tenho uma loja', 'vendo roupas', 'preciso vender mais',
        'quero escalar', 'como automatizo?', 'funciona 24h?', 'quero testar gratis',
        'me convence', 'quero comprar'
    ];

    let successCount = 0;
    let errorCount = 0;
    let totalTime = 0;
    const errors = [];

    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const convId = `stab-${Date.now()}-${i}`;
        const start = Date.now();

        try {
            const result = await sendChat(msg, convId);
            const elapsed = Date.now() - start;
            totalTime += elapsed;

            if (result.status === 200 && (result.data.response || result.data.raw)) {
                successCount++;
                if (i % 10 === 0) {
                    console.log(`[${i+1}/50] "${msg}" -> OK (${elapsed}ms)`);
                }
            } else {
                errorCount++;
                errors.push({ msg, status: result.status, elapsed });
                console.log(`[${i+1}/50] "${msg}" -> ERRO status ${result.status} (${elapsed}ms)`);
            }
        } catch (e) {
            errorCount++;
            errors.push({ msg, error: e.message });
            console.log(`[${i+1}/50] "${msg}" -> EXCECAO: ${e.message}`);
        }

        // Delay menor para high-volume
        await sleep(800);
    }

    const avgTime = Math.round(totalTime / messages.length);
    console.log('\n--- RESULTADO ESTABILIDADE ---');
    console.log(`Sucessos: ${successCount}/50`);
    console.log(`Erros: ${errorCount}/50`);
    console.log(`Tempo medio: ${avgTime}ms`);
    if (errors.length > 0) {
        console.log('Erros:', JSON.stringify(errors, null, 2));
    }

    return {
        total: 50,
        success: successCount,
        errors: errorCount,
        avgResponseTime: avgTime,
        stable: errorCount <= 2 && avgTime < 15000 // Tolerancia: max 2 erros, <15s
    };
}

// =====================================
// FASE 4 RETEST: NOVA SESSAO POS-TREINO
// =====================================
async function phase4_PostTrainingTest() {
    console.log('\n' + '='.repeat(60));
    console.log('FASE 4: VALIDACAO POS-APRENDIZADO (nova sessao)');
    console.log('='.repeat(60));

    const convId = 'post-training-' + Date.now();
    const questions = [
        'o que e isso?',
        'como funciona?',
        'quanto custa?',
        'quero comprar'
    ];

    const results = {};
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        console.log(`\n--- Q${i+1}: "${q}" ---`);
        try {
            const result = await sendChat(q, convId);
            const response = result.data.response || result.data.raw || 'SEM RESPOSTA';
            results[`Q${i+1}`] = {
                question: q,
                response: response,
                hasCTA: /clique|acesse|compre|garanta|aproveite|link|whatsapp|comprar|adquir/i.test(response),
                hasLink: /https?:\/\//i.test(response),
                length: response.length
            };
            console.log(`Resposta (${response.length} chars):`);
            console.log(response.substring(0, 400));
            console.log(`CTA: ${results[`Q${i+1}`].hasCTA} | Link: ${results[`Q${i+1}`].hasLink}`);
        } catch (e) {
            console.log('ERRO:', e.message);
            results[`Q${i+1}`] = { question: q, response: 'ERRO', hasCTA: false, hasLink: false, length: 0 };
        }
        await sleep(2000);
    }

    return results;
}

// =====================================
// MAIN
// =====================================
async function main() {
    console.log('========================================');
    console.log('VALIDACAO COMPLETA — FASES 4/5/7');
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('========================================');

    // FASE 5
    const phase5 = await phase5_InternalValidation();
    console.log('\n>> FASE 5 RESULTADO:', JSON.stringify(phase5));

    await sleep(2000);

    // FASE 4 (re-test pos volume)
    const phase4 = await phase4_PostTrainingTest();

    await sleep(2000);

    // FASE 7
    const phase7 = await phase7_StabilityTest();
    console.log('\n>> FASE 7 RESULTADO:', JSON.stringify(phase7));

    // RELATORIO FINAL
    console.log('\n' + '='.repeat(60));
    console.log('RELATORIO CONSOLIDADO');
    console.log('='.repeat(60));

    // Carregar baseline do teste anterior
    const fs = require('fs');
    const path = require('path');
    let baseline = null;
    try {
        const reportPath = path.join(__dirname, 'data', 'learning', 'test-report.json');
        baseline = JSON.parse(fs.readFileSync(reportPath, 'utf8')).baseline;
    } catch (e) {
        console.log('Baseline nao encontrado');
    }

    if (baseline && phase4) {
        console.log('\n--- COMPARACAO ANTES vs DEPOIS ---');
        for (const key of ['Q1', 'Q2', 'Q3', 'Q4']) {
            const b = baseline[key];
            const f = phase4[key];
            if (!b || !f) continue;

            const isDiff = b.response !== f.response;
            console.log(`\n${key}: "${b.question}"`);
            console.log(`  ANTES: ${b.response.substring(0, 150)}...`);
            console.log(`  DEPOIS: ${f.response.substring(0, 150)}...`);
            console.log(`  Mudou: ${isDiff ? 'SIM' : 'NAO'} | CTA: ${b.hasCTA}->${f.hasCTA} | Link: ${b.hasLink}->${f.hasLink}`);
        }
    }

    console.log('\n--- STATUS DO SISTEMA ---');
    console.log(`Tracking: ${phase5.chatOK ? 'OK' : 'FALHA'}`);
    console.log(`Track Events: ${phase5.trackClickOK && phase5.trackWhatsappOK ? 'OK' : 'FALHA'}`);
    console.log(`Validation: ${phase5.invalidRejected ? 'OK' : 'FALHA'}`);
    console.log(`Estabilidade: ${phase7.stable ? 'OK' : 'FALHA'} (${phase7.success}/${phase7.total}, avg ${phase7.avgResponseTime}ms)`);

    // Salvar resultado completo
    const finalReport = {
        timestamp: new Date().toISOString(),
        phase4_postTraining: phase4,
        phase5_validation: phase5,
        phase7_stability: phase7,
        baseline: baseline
    };

    try {
        const reportDir = path.join(__dirname, 'data', 'learning');
        fs.mkdirSync(reportDir, { recursive: true });
        fs.writeFileSync(
            path.join(reportDir, 'validation-report.json'),
            JSON.stringify(finalReport, null, 2)
        );
        console.log('\nRelatorio salvo em: data/learning/validation-report.json');
    } catch (e) {
        console.log('Nao conseguiu salvar relatorio:', e.message);
    }
}

main().catch(console.error);
