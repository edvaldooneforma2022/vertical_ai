/**
 * 🧪 TESTE V9.3 — Validação REAL do Checkout Link Fix
 * URL de teste: https://ev.braip.com/ref?pv=prov6q42&af=afi11l16n6
 * 
 * Testa:
 * 1. Extração server-side de checkout links via Cheerio (extractPageData)
 * 2. Heurística de scoring (mesma lógica do widget)
 * 3. Presença do checkoutLink no resultado
 */

const axios = require('axios');
const cheerio = require('cheerio');

const TEST_URL = 'https://ev.braip.com/ref?pv=prov6q42&af=afi11l16n6';

// Mesma heurística do patch V9.3 no server.js
function extractCheckoutFromHTML(html, pageUrl) {
    const $ = cheerio.load(html);
    $('script, style, noscript, iframe').remove();

    const ckKeywordsHigh = ['comprar', 'buy', 'checkout', 'pagar', 'finalizar', 'adquirir', 'assinar'];
    const ckKeywordsMed  = ['carrinho', 'cart', 'quero', 'garantir', 'inscrever', 'matricular'];
    const ckPayDomains   = ['hotmart', 'kiwify', 'eduzz', 'monetizze', 'pay.', 'checkout.', 'mercadopago', 'pagar.me', 'stripe', 'paypal', 'braip', 'ev.braip'];

    let bestLink = null;
    let bestScore = 0;
    const allScored = [];

    $('a[href]').each((_, el) => {
        const href = ($(el).attr('href') || '').trim();
        const text = ($(el).text() || '').toLowerCase().trim();
        if (!href.startsWith('http')) return;
        const hrefLower = href.toLowerCase();

        let sc = 0;
        ckKeywordsHigh.forEach(k => { if (text.includes(k) || hrefLower.includes(k)) sc += 50; });
        ckKeywordsMed.forEach(k =>  { if (text.includes(k) || hrefLower.includes(k)) sc += 20; });
        ckPayDomains.forEach(d =>   { if (hrefLower.includes(d)) sc += 60; });

        if (hrefLower.includes('#') && !hrefLower.startsWith('http')) sc -= 30;
        try { if (href === pageUrl) sc -= 30; } catch(_) {}

        if (sc > 0) {
            allScored.push({ href: href.substring(0, 100), text: text.substring(0, 60), score: sc });
        }

        if (sc > bestScore) { bestScore = sc; bestLink = href; }
    });

    return { bestLink, bestScore, allScored, totalLinks: $('a[href]').length };
}

async function runTest() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🧪 TESTE V9.3 — Checkout Link Fix (LIVE)');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`📍 URL de teste: ${TEST_URL}\n`);

    // 1. Baixar HTML da página
    console.log('📥 [PASSO 1] Baixando HTML da página...');
    let html = '';
    let finalUrl = TEST_URL;
    try {
        const response = await axios.get(TEST_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; LinkMagico-Bot/6.0)',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
            },
            timeout: 30000,
            maxRedirects: 5,
            validateStatus: status => status >= 200 && status < 400
        });
        html = response.data || '';
        finalUrl = response.request?.res?.responseUrl || TEST_URL;
        console.log(`   ✅ HTML baixado: ${html.length} chars`);
        console.log(`   📎 URL final (após redirects): ${finalUrl}`);
    } catch (err) {
        console.error(`   ❌ ERRO ao baixar: ${err.message}`);
        process.exit(1);
    }

    // 2. Extrair título e descrição para contexto
    console.log('\n📄 [PASSO 2] Extraindo contexto básico...');
    const $ = cheerio.load(html);
    const title = $('title').text().trim() || $('h1').first().text().trim() || 'N/A';
    const desc = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || 'N/A';
    console.log(`   Título: ${title.substring(0, 100)}`);
    console.log(`   Descrição: ${desc.substring(0, 150)}`);

    // 3. Executar heurística de checkout
    console.log('\n🔗 [PASSO 3] Executando heurística de checkout (V9.3)...');
    const result = extractCheckoutFromHTML(html, TEST_URL);
    console.log(`   Total de links na página: ${result.totalLinks}`);
    console.log(`   Links com score > 0: ${result.allScored.length}`);

    if (result.allScored.length > 0) {
        console.log('\n   📊 Top links por score:');
        result.allScored
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .forEach((item, i) => {
                console.log(`   ${i + 1}. [score=${item.score}] ${item.href}`);
                if (item.text) console.log(`      texto: "${item.text}"`);
            });
    }

    // 4. Resultado final
    console.log('\n═══════════════════════════════════════════════════════');
    if (result.bestLink && result.bestScore >= 50) {
        console.log(`✅ CHECKOUT DETECTADO!`);
        console.log(`   Link: ${result.bestLink}`);
        console.log(`   Score: ${result.bestScore}`);
        
        // Verificar se NÃO é a URL da página
        if (result.bestLink === TEST_URL || result.bestLink === finalUrl) {
            console.log(`   ❌ PROBLEMA: Link detectado é a própria URL da página!`);
        } else {
            console.log(`   ✅ Link é DIFERENTE da URL da página (correto!)`);
        }

        // Verificar se é um domínio de pagamento
        const payDomains = ['hotmart', 'kiwify', 'eduzz', 'monetizze', 'pay.', 'checkout.', 'mercadopago', 'pagar.me', 'stripe', 'paypal', 'braip'];
        const isPayment = payDomains.some(d => result.bestLink.toLowerCase().includes(d));
        if (isPayment) {
            console.log(`   ✅ Link é de domínio de pagamento (correto!)`);
        } else {
            console.log(`   ⚠️ Link NÃO é de domínio de pagamento conhecido`);
        }
    } else {
        console.log(`❌ CHECKOUT NÃO DETECTADO`);
        console.log(`   Melhor score: ${result.bestScore} (mínimo: 50)`);
        if (result.bestLink) console.log(`   Melhor candidato: ${result.bestLink}`);
        
        // Diagnóstico: mostrar todos os links da página
        console.log('\n   📋 Diagnóstico — Todos os links http encontrados:');
        const $diag = cheerio.load(html);
        $diag('a[href]').each((i, el) => {
            const href = $diag(el).attr('href') || '';
            const text = ($diag(el).text() || '').trim().substring(0, 60);
            if (href.startsWith('http') && i < 20) {
                console.log(`   ${i + 1}. ${href.substring(0, 100)} | "${text}"`);
            }
        });
    }
    console.log('═══════════════════════════════════════════════════════');
}

runTest().catch(err => {
    console.error('❌ Erro fatal:', err.message);
    process.exit(1);
});
