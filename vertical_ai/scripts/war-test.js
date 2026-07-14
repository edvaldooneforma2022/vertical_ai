/**
 * 🧪 V12.0 — WAR TEST SCRIPT
 * 
 * Testes de estresse e validação do pipeline de checkout.
 * Simula cenários reais de produção:
 *   - Multi-tenant (vários apiKeys simultâneos)
 *   - Diferentes intenções (compra, info, pós-venda)
 *   - Verificação de cross-tenant contamination
 *   - Verificação de presença de checkout link
 * 
 * Uso: node scripts/war-test.js [BASE_URL]
 * Default: http://localhost:3000
 * 
 * @version 12.0.0
 */

const http = require('http');
const https = require('https');

// Configuração
const BASE_URL = process.argv[2] || 'http://localhost:3000';
const VERBOSE = process.env.VERBOSE === 'true';

// Cores para terminal
const C = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
    dim: '\x1b[2m'
};

// Casos de teste
const testCases = [
    // GRUPO 1: Intenção de compra (deve ter checkout)
    {
        name: '1a. "quero comprar" (compra direta)',
        group: 'BUY_INTENT',
        message: 'quero comprar',
        apiKey: process.env.TEST_API_KEY_1 || 'LMV7-QCBK-44S6-M0LF',
        expectCheckout: true
    },
    {
        name: '1b. "qual o preço?" (interesse financeiro)',
        group: 'BUY_INTENT',
        message: 'qual o preço?',
        apiKey: process.env.TEST_API_KEY_1 || 'LMV7-QCBK-44S6-M0LF',
        expectCheckout: true
    },
    {
        name: '1c. "aceita pix?" (método de pagamento)',
        group: 'BUY_INTENT',
        message: 'aceita pix?',
        apiKey: process.env.TEST_API_KEY_1 || 'LMV7-QCBK-44S6-M0LF',
        expectCheckout: true
    },
    {
        name: '1d. "me manda o link" (solicitação direta)',
        group: 'BUY_INTENT',
        message: 'me manda o link',
        apiKey: process.env.TEST_API_KEY_1 || 'LMV7-QCBK-44S6-M0LF',
        expectCheckout: true
    },

    // GRUPO 2: Informação (NÃO deve forçar checkout)
    {
        name: '2a. "como funciona?" (informação)',
        group: 'INFO',
        message: 'como funciona?',
        apiKey: process.env.TEST_API_KEY_1 || 'LMV7-QCBK-44S6-M0LF',
        expectCheckout: false
    },
    {
        name: '2b. "o que é isso?" (dúvida geral)',
        group: 'INFO',
        message: 'o que é isso?',
        apiKey: process.env.TEST_API_KEY_1 || 'LMV7-QCBK-44S6-M0LF',
        expectCheckout: false
    },

    // GRUPO 3: Pós-venda (NÃO deve ter checkout, deve ter suporte)
    {
        name: '3a. "já comprei" (pós-venda)',
        group: 'POST_SALE',
        message: 'já comprei',
        apiKey: process.env.TEST_API_KEY_1 || 'LMV7-QCBK-44S6-M0LF',
        expectCheckout: false,
        expectSupport: true
    },
    {
        name: '3b. "não recebi meu acesso" (suporte)',
        group: 'POST_SALE',
        message: 'não recebi meu acesso',
        apiKey: process.env.TEST_API_KEY_1 || 'LMV7-QCBK-44S6-M0LF',
        expectCheckout: false,
        expectSupport: true
    },

    // GRUPO 4: Cross-tenant (apiKeys diferentes)
    {
        name: '4a. Tenant A — "quero comprar"',
        group: 'CROSS_TENANT',
        message: 'quero comprar',
        apiKey: process.env.TEST_API_KEY_1 || 'LMV7-QCBK-44S6-M0LF',
        expectCheckout: true
    },
    {
        name: '4b. Tenant B — "quero comprar"',
        group: 'CROSS_TENANT',
        message: 'quero comprar',
        apiKey: process.env.TEST_API_KEY_2 || 'LMV7-9BOT-HM5M-JOUV',
        expectCheckout: true
    }
];

/**
 * Faz uma requisição HTTP/HTTPS
 */
function makeRequest(url, body) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const isHttps = parsedUrl.protocol === 'https:';
        const lib = isHttps ? https : http;

        const data = JSON.stringify(body);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (isHttps ? 443 : 80),
            path: parsedUrl.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            },
            timeout: 30000
        };

        const req = lib.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(body)
                    });
                } catch (_) {
                    resolve({
                        status: res.statusCode,
                        data: { raw: body.substring(0, 500) }
                    });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout (30s)'));
        });

        req.write(data);
        req.end();
    });
}

/**
 * Executa um caso de teste
 */
async function runTest(testCase) {
    const startTime = Date.now();
    
    try {
        const url = `${BASE_URL}/api/chat-universal`;
        const body = {
            message: testCase.message,
            apiKey: testCase.apiKey,
            conversationId: `war-test-${Date.now()}-${Math.random().toString(36).substring(7)}`
        };

        const result = await makeRequest(url, body);
        const elapsed = Date.now() - startTime;
        const response = result.data?.response || '';

        // Análise
        const hasUrl = /https?:\/\/[^\s]+/.test(response);
        const hasCheckoutKeyword = /compra|checkout|finalizar|pagar/i.test(response);
        const hasSupportKeyword = /comprou|recebeu|acesso|suporte|ajud/i.test(response);

        // Validação
        let passed = true;
        let details = [];

        if (testCase.expectCheckout && !hasUrl) {
            passed = false;
            details.push('❌ Esperava checkout link, mas não encontrou URL');
        }
        
        if (!testCase.expectCheckout && testCase.group === 'INFO' && hasCheckoutKeyword && hasUrl) {
            // Info com checkout forçado = problema (mas não fatal)
            details.push('⚠️ Info com checkout link (possível oversell)');
        }

        if (testCase.expectSupport && !hasSupportKeyword) {
            details.push('⚠️ Pós-venda sem palavras de suporte');
        }

        if (result.status !== 200) {
            passed = false;
            details.push(`❌ HTTP ${result.status}`);
        }

        return {
            ...testCase,
            passed,
            elapsed,
            httpStatus: result.status,
            responsePreview: response.substring(0, 200),
            hasUrl,
            details
        };

    } catch (err) {
        return {
            ...testCase,
            passed: false,
            elapsed: Date.now() - startTime,
            httpStatus: 0,
            responsePreview: '',
            hasUrl: false,
            details: [`❌ Erro: ${err.message}`]
        };
    }
}

/**
 * Execução principal
 */
async function main() {
    console.log(`\n${C.bold}${C.cyan}═══════════════════════════════════════════${C.reset}`);
    console.log(`${C.bold}${C.cyan}  🧪 V12 WAR TEST — Link Mágico${C.reset}`);
    console.log(`${C.bold}${C.cyan}═══════════════════════════════════════════${C.reset}`);
    console.log(`${C.dim}  Target: ${BASE_URL}${C.reset}`);
    console.log(`${C.dim}  Tests:  ${testCases.length}${C.reset}`);
    console.log(`${C.dim}  Time:   ${new Date().toISOString()}${C.reset}\n`);

    let passed = 0;
    let failed = 0;
    let warnings = 0;
    let currentGroup = '';

    // FASE 1: Sequencial
    console.log(`${C.bold}📋 FASE 1: Testes Sequenciais${C.reset}\n`);

    for (const testCase of testCases) {
        if (testCase.group !== currentGroup) {
            currentGroup = testCase.group;
            console.log(`  ${C.bold}[${currentGroup}]${C.reset}`);
        }

        const result = await runTest(testCase);

        const icon = result.passed ? `${C.green}✅` : `${C.red}❌`;
        const time = `${C.dim}(${result.elapsed}ms)${C.reset}`;
        
        console.log(`    ${icon} ${result.name}${C.reset} ${time}`);
        
        if (result.details.length > 0) {
            for (const detail of result.details) {
                console.log(`       ${detail}`);
                if (detail.startsWith('⚠️')) warnings++;
            }
        }

        if (VERBOSE && result.responsePreview) {
            console.log(`       ${C.dim}Response: ${result.responsePreview}${C.reset}`);
        }

        if (result.passed) passed++;
        else failed++;
    }

    // FASE 2: Paralelo (cross-tenant)
    console.log(`\n${C.bold}📋 FASE 2: Testes Paralelos (Cross-Tenant)${C.reset}\n`);

    const crossTests = testCases.filter(t => t.group === 'CROSS_TENANT');
    const parallelStart = Date.now();
    const parallelResults = await Promise.all(crossTests.map(t => runTest(t)));
    const parallelElapsed = Date.now() - parallelStart;

    console.log(`  ${C.dim}Todos ${crossTests.length} testes rodaram em paralelo (${parallelElapsed}ms)${C.reset}`);
    
    for (const result of parallelResults) {
        const icon = result.passed ? `${C.green}✅` : `${C.red}❌`;
        console.log(`    ${icon} ${result.name}${C.reset} ${C.dim}(${result.elapsed}ms)${C.reset}`);
    }

    // Resumo final
    console.log(`\n${C.bold}${C.cyan}═══════════════════════════════════════════${C.reset}`);
    console.log(`${C.bold}  📊 RESULTADO FINAL${C.reset}`);
    console.log(`${C.cyan}═══════════════════════════════════════════${C.reset}`);
    console.log(`  ${C.green}✅ Passou:  ${passed}${C.reset}`);
    console.log(`  ${C.red}❌ Falhou:   ${failed}${C.reset}`);
    console.log(`  ${C.yellow}⚠️ Avisos:  ${warnings}${C.reset}`);
    console.log(`${C.cyan}═══════════════════════════════════════════${C.reset}\n`);

    // Exit code
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error(`\n${C.red}❌ FATAL: ${err.message}${C.reset}`);
    process.exit(2);
});
