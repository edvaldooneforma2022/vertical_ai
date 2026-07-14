#!/usr/bin/env node
// QA V17.3.1 — 16 Perguntas + V16.2 Anti-Perda de Venda
// Uso: node tests/qa-v17-full.js
// Cada tenant recebe conversationId ÚNICO por bloco

const BASE = 'https://vertical-ai-dktu.onrender.com';

const SHORT_CODES = [
    'GDSw5I', 'y8yPkk', 'Syg9GC', 'YLdKI7', 'f9Jf18',
    'WNTdiR', '66OrU2', 'QrZqY2', 'I2cYjs'
];

// ═══ BLOCOS DE TESTE ═══
const QA_16 = [
    { id: 'B1.1', msg: 'Vi seu anúncio… me explica rápido o que você vende?', expect: 'nome do produto', block: 'PRIMEIRO_CONTATO' },
    { id: 'B1.2', msg: 'Mas tipo assim… isso serve pra quê na prática mesmo?', expect: 'explicação prática', block: 'PRIMEIRO_CONTATO' },
    { id: 'B2.1', msg: 'Como isso funciona passo a passo?', expect: 'explicação concreta', block: 'ENTENDIMENTO' },
    { id: 'B2.2', msg: 'O que exatamente eu recebo quando compro?', expect: 'conteúdo real', block: 'ENTENDIMENTO' },
    { id: 'B2.3', msg: 'Precisa ter experiência ou qualquer pessoa consegue usar?', expect: 'resposta direta', block: 'ENTENDIMENTO' },
    { id: 'B3.1', msg: 'Você já me explicou isso antes… lembra?', expect: 'reconhecer contexto', block: 'MEMORIA' },
    { id: 'B3.2', msg: 'Então resume tudo em 1 frase pra mim', expect: 'síntese coerente', block: 'MEMORIA' },
    { id: 'B4.1', msg: 'Quanto custa?', expect: 'link ou contexto de preço', block: 'COMPRA' },
    { id: 'B4.2', msg: 'Quero comprar agora', expect: '1 link válido sem duplicação', block: 'COMPRA' },
    { id: 'B4.3', msg: 'Me manda o link certo porque o outro não abriu', expect: 'alternativa ou WhatsApp', block: 'COMPRA' },
    { id: 'B5.1', msg: 'Isso parece golpe, é confiável mesmo?', expect: 'tranquilizar SEM checkout', block: 'OBJECAO' },
    { id: 'B5.2', msg: 'Não entendi nada ainda, explica como se eu fosse leigo', expect: 'explicação clara SEM venda', block: 'OBJECAO' },
    { id: 'B5.3', msg: 'Achei caro… vale mesmo a pena?', expect: 'reforço de valor SEM pressão', block: 'OBJECAO' },
    { id: 'B6.1', msg: 'Quero falar com alguém de verdade', expect: 'WhatsApp SEM checkout', block: 'SUPORTE' },
    { id: 'B7.1', msg: 'Tá bom, depois eu vejo isso', expect: 'leve SEM link', block: 'SAIDA' },
    { id: 'B7.2', msg: 'Valeu, tchau', expect: 'despedida ZERO checkout', block: 'SAIDA' },
];

const V162_TESTS = [
    { id: 'V1', msg: 'quero comprar', expect: 'checkout direto', cat: 'ALTA_INTENCAO' },
    { id: 'V2', msg: 'tem link?', expect: 'checkout direto', cat: 'ALTA_INTENCAO' },
    { id: 'V3', msg: 'me manda o link', expect: 'checkout direto', cat: 'ALTA_INTENCAO' },
    { id: 'V4', msg: 'como faço pra comprar', expect: 'checkout direto', cat: 'ALTA_INTENCAO' },
    { id: 'V5', msg: 'bora', expect: 'checkout direto', cat: 'ALTA_INTENCAO' },
    { id: 'V6', msg: 'quanto custa', expect: 'conduzir ao checkout', cat: 'PRECO' },
    { id: 'V7', msg: 'qual o valor', expect: 'conduzir ao checkout', cat: 'PRECO' },
    { id: 'V8', msg: 'tem parcelamento?', expect: 'checkout + contexto', cat: 'PAGAMENTO' },
    { id: 'V9', msg: 'aceita pix?', expect: 'checkout + contexto', cat: 'PAGAMENTO' },
    { id: 'V10', msg: 'qro compra', expect: 'detectar intenção', cat: 'FUZZY' },
    { id: 'V11', msg: 'tem o link ai', expect: 'detectar intenção', cat: 'FUZZY' },
    { id: 'V12', msg: 'manda o site', expect: 'detectar intenção', cat: 'FUZZY' },
    { id: 'V13', msg: 'quero suporte', expect: 'WhatsApp SEM checkout', cat: 'SUPORTE' },
    { id: 'V14', msg: 'falar com atendente', expect: 'WhatsApp SEM checkout', cat: 'SUPORTE' },
    { id: 'V15', msg: 'quero comprar de novo', expect: 'checkout direto', cat: 'RECOMPRA' },
];

// ═══ HELPERS ═══
function genConvId() {
    return 'qa-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now();
}

async function resolveShortLink(code) {
    try {
        const resp = await fetch(`${BASE}/l/${code}`, { redirect: 'manual' });
        const location = resp.headers.get('location') || '';
        const params = new URLSearchParams(location.split('?')[1] || '');
        return {
            code,
            apiKey: params.get('apiKey') || '',
            url: params.get('url') || '',
            name: params.get('name') || 'Assistente',
            instructions: params.get('instructions') || ''
        };
    } catch (e) {
        console.error(`❌ Erro resolvendo ${code}:`, e.message);
        return null;
    }
}

async function sendMessage(tenant, message, conversationId) {
    try {
        const body = {
            message,
            conversationId,
            apiKey: tenant.apiKey,
            url: tenant.url,
            robotName: tenant.name,
            instructions: tenant.instructions
        };
        const resp = await fetch(`${BASE}/api/process-chat-inteligente`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await resp.json();
        return data;
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// ═══ AVALIADORES ═══
function hasCheckoutInText(text) {
    return /https?:\/\//.test(text) || /FINALIZAR COMPRA/i.test(text) || /━━━/.test(text);
}

function hasCTA(data) {
    return data.cta && data.cta.url;
}

function hasWhatsApp(data) {
    const text = (data.response || '').toLowerCase();
    return text.includes('whatsapp') || text.includes('wa.me') ||
        (data.cta && data.cta.text && data.cta.text.toLowerCase().includes('whatsapp'));
}

function isGeneric(text) {
    const patterns = ['ótima pergunta', 'deixe-me explicar', 'como posso ajudar', 'posso te mostrar'];
    return patterns.some(p => text.toLowerCase().includes(p));
}

function evaluateQA(test, data) {
    const text = data.response || '';
    const checks = [];

    // Regra universal: sem resposta genérica
    if (isGeneric(text)) checks.push('⚠️ GENÉRICO');

    // Regra universal: encoding ok
    if (text.includes('�')) checks.push('❌ ENCODING');

    // CTA no texto (V17.3.1 deveria ter limpado)
    if (hasCheckoutInText(text)) checks.push('⚠️ CTA_INLINE');

    // Regras por bloco
    if (test.block === 'OBJECAO' || test.block === 'SAIDA') {
        if (hasCTA(data)) checks.push('❌ CTA_INDEVIDO');
        if (hasCheckoutInText(text)) checks.push('❌ CHECKOUT_INDEVIDO');
    }
    if (test.block === 'SUPORTE') {
        if (!hasWhatsApp(data)) checks.push('⚠️ SEM_WHATSAPP');
        if (hasCTA(data) && data.cta.text !== 'Falar no WhatsApp') checks.push('❌ CTA_NAO_WHATSAPP');
    }
    if (test.block === 'COMPRA' && test.id === 'B4.2') {
        if (!hasCTA(data)) checks.push('⚠️ SEM_CTA_COMPRA');
    }
    if (text.length < 15) checks.push('⚠️ RESPOSTA_CURTA');

    return checks.length === 0 ? '✅' : checks.join(' | ');
}

function evaluateV162(test, data) {
    const text = data.response || '';
    const checks = [];

    if (text.includes('�')) checks.push('❌ ENCODING');

    if (test.cat === 'ALTA_INTENCAO' || test.cat === 'RECOMPRA') {
        if (!hasCTA(data) && !hasCheckoutInText(text)) checks.push('❌ SEM_CHECKOUT');
    }
    if (test.cat === 'PRECO' || test.cat === 'PAGAMENTO') {
        if (!hasCTA(data) && !hasCheckoutInText(text) && !text.toLowerCase().includes('valor')) checks.push('⚠️ SEM_DIRECAO');
    }
    if (test.cat === 'SUPORTE') {
        if (hasCTA(data) && data.cta.text !== 'Falar no WhatsApp') checks.push('❌ CTA_NAO_WHATSAPP');
    }
    if (test.cat === 'FUZZY') {
        if (!hasCTA(data) && !hasCheckoutInText(text)) checks.push('⚠️ NAO_DETECTOU');
    }
    if (isGeneric(text)) checks.push('⚠️ GENÉRICO');
    if (text.length < 10) checks.push('⚠️ VAZIO');

    return checks.length === 0 ? '✅' : checks.join(' | ');
}

// ═══ MAIN ═══
async function main() {
    console.log('═══════════════════════════════════════════');
    console.log('🧪 QA V17.3.1 — FULL SUITE');
    console.log('═══════════════════════════════════════════');
    console.log(`Tenants: ${SHORT_CODES.length} | QA16: ${QA_16.length} | V16.2: ${V162_TESTS.length}`);
    console.log(`Total estimado: ${SHORT_CODES.length * (QA_16.length + V162_TESTS.length)} requests\n`);

    // 1. Resolver todos os tenants
    console.log('🔗 Resolvendo short links...');
    const tenants = [];
    for (const code of SHORT_CODES) {
        const t = await resolveShortLink(code);
        if (t && t.apiKey) {
            tenants.push(t);
            console.log(`  ✅ ${code} → ${t.name} (${t.apiKey.substring(0, 8)}...)`);
        } else {
            console.log(`  ❌ ${code} → falhou`);
        }
    }
    console.log(`\n📊 ${tenants.length}/${SHORT_CODES.length} tenants resolvidos\n`);

    const results = { qa16: {}, v162: {} };
    let globalScore = { qa16: { pass: 0, total: 0 }, v162: { pass: 0, total: 0 } };

    // 2. QA-16 para cada tenant
    for (const tenant of tenants) {
        const label = `${tenant.name} (${tenant.code})`;
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`🧠 QA-16: ${label}`);
        console.log(`${'═'.repeat(60)}`);

        results.qa16[tenant.code] = [];
        const convId = genConvId();
        let tenantPass = 0;

        for (const test of QA_16) {
            const data = await sendMessage(tenant, test.msg, convId);
            const status = evaluateQA(test, data);
            const passed = status === '✅';
            if (passed) tenantPass++;
            globalScore.qa16.total++;
            if (passed) globalScore.qa16.pass++;

            const respPreview = (data.response || '').substring(0, 80).replace(/\n/g, ' ');
            const ctaInfo = data.cta ? `CTA:${data.cta.text}` : 'CTA:null';
            console.log(`  ${status} [${test.id}] "${test.msg.substring(0, 40)}..." → ${ctaInfo} | "${respPreview}..."`);

            results.qa16[tenant.code].push({
                test: test.id,
                msg: test.msg,
                block: test.block,
                status,
                response: (data.response || '').substring(0, 200),
                cta: data.cta || null,
                metadata: data.metadata
            });

            // Delay entre mensagens (simular humano)
            await new Promise(r => setTimeout(r, 1500));
        }
        console.log(`  📊 Score: ${tenantPass}/${QA_16.length}`);
    }

    // 3. V16.2 para cada tenant
    for (const tenant of tenants) {
        const label = `${tenant.name} (${tenant.code})`;
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`🔥 V16.2 ANTI-PERDA: ${label}`);
        console.log(`${'═'.repeat(60)}`);

        results.v162[tenant.code] = [];
        let tenantPass = 0;

        for (const test of V162_TESTS) {
            // Cada teste V16.2 usa conversationId NOVO (sem reutilizar)
            const convId = genConvId();
            const data = await sendMessage(tenant, test.msg, convId);
            const status = evaluateV162(test, data);
            const passed = status === '✅';
            if (passed) tenantPass++;
            globalScore.v162.total++;
            if (passed) globalScore.v162.pass++;

            const respPreview = (data.response || '').substring(0, 80).replace(/\n/g, ' ');
            const ctaInfo = data.cta ? `CTA:${data.cta.text}` : 'CTA:null';
            console.log(`  ${status} [${test.id}] "${test.msg}" → ${ctaInfo} | "${respPreview}..."`);

            results.v162[tenant.code].push({
                test: test.id,
                msg: test.msg,
                cat: test.cat,
                status,
                response: (data.response || '').substring(0, 200),
                cta: data.cta || null,
                metadata: data.metadata
            });

            await new Promise(r => setTimeout(r, 1200));
        }
        console.log(`  📊 Score: ${tenantPass}/${V162_TESTS.length}`);
    }

    // 4. Resumo Final
    console.log(`\n${'═'.repeat(60)}`);
    console.log('📊 RESUMO FINAL');
    console.log(`${'═'.repeat(60)}`);
    console.log(`QA-16:  ${globalScore.qa16.pass}/${globalScore.qa16.total} (${Math.round(globalScore.qa16.pass / globalScore.qa16.total * 100)}%)`);
    console.log(`V16.2:  ${globalScore.v162.pass}/${globalScore.v162.total} (${Math.round(globalScore.v162.pass / globalScore.v162.total * 100)}%)`);
    const totalPass = globalScore.qa16.pass + globalScore.v162.pass;
    const totalTests = globalScore.qa16.total + globalScore.v162.total;
    console.log(`TOTAL:  ${totalPass}/${totalTests} (${Math.round(totalPass / totalTests * 100)}%)`);

    const pct = Math.round(totalPass / totalTests * 100);
    if (pct >= 85) console.log('\n🔥 PRONTO PRA VENDER');
    else if (pct >= 60) console.log('\n⚠️ VENDE, MAS PERDE DINHEIRO');
    else console.log('\n💀 AINDA INSTÁVEL');

    // 5. Salvar resultados
    const fs = require('fs');
    const outPath = __dirname + '/qa-v17-results.json';
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Resultados salvos em: ${outPath}`);
}

main().catch(e => {
    console.error('💥 ERRO FATAL:', e);
    process.exit(1);
});
