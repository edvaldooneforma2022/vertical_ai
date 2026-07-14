const { extractWithGoogleCache, shouldUsePuppeteer } = require('../lib/puppeteer-extractor');

(async () => {
    const url = 'https://innerai.com';
    
    // Simular pageData vazio (como axios-cheerio retornaria)
    const mockPageData = { cleanText: '', checkoutLink: null, whatsappLink: null, method: 'axios-cheerio' };
    console.log('shouldUsePuppeteer(mockPageData):', shouldUsePuppeteer(mockPageData), '(esperado: true)');
    
    console.log('\n=== Google Cache para innerai.com ===');
    const result = await extractWithGoogleCache(url);
    
    if (result) {
        console.log('✅ Text length:', result.text.length);
        console.log('✅ HTML length:', (result.html || '').length);
        console.log('✅ Links:', result.links.length);
        console.log('\n📖 Texto (preview 400 chars):');
        console.log(result.text.substring(0, 400));
        
        // Checkout
        const checkoutPatterns = ['hotmart', 'kiwify', 'eduzz', 'braip', 'pay.', 'checkout'];
        const ckLinks = result.links.filter(l => checkoutPatterns.some(p => (l.href || '').toLowerCase().includes(p)));
        console.log('\n💰 Checkout links:', ckLinks.length);
        ckLinks.forEach(l => console.log('  💰', l.href));
        
        // WhatsApp
        const waLinks = result.links.filter(l => (l.href || '').toLowerCase().includes('wa.me') || (l.href || '').toLowerCase().includes('whatsapp'));
        console.log('\n📱 WhatsApp links:', waLinks.length);
        waLinks.forEach(l => console.log('  📱', l.href));
        
        // Todos os links
        console.log('\n🔗 Todos os links (max 20):');
        result.links.slice(0, 20).forEach(l => console.log(`  [${l.text || 'N/A'}] → ${l.href}`));
    } else {
        console.log('❌ Google Cache retornou null');
    }
})();
