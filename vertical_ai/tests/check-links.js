const axios = require('axios');
const cheerio = require('cheerio');

async function checkLinks() {
    const { data: html } = await axios.get('https://llovers.com.br/institucional');
    const $ = cheerio.load(html);
    
    console.log('=== TODOS OS <a href> ===');
    let count = 0;
    $('a[href]').each((_, el) => {
        const href = ($(el).attr('href') || '').trim();
        const text = ($(el).text() || '').trim().substring(0, 50);
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
            count++;
            if (count <= 30) console.log(`  [${count}] ${href.substring(0, 80)} | TEXT: "${text}"`);
        }
    });
    console.log(`\nTotal links <a>: ${count}`);
    
    console.log('\n=== <button> COM TEXTO ===');
    $('button').each((_, el) => {
        const text = ($(el).text() || '').trim();
        const onclick = $(el).attr('onclick') || '';
        if (text.length > 2) {
            console.log(`  BUTTON: "${text.substring(0, 60)}" ${onclick ? '| onclick: ' + onclick.substring(0, 80) : ''}`);
        }
    });
    
    console.log('\n=== ELEMENTOS COM onclick ===');
    $('[onclick]').each((_, el) => {
        const onclick = $(el).attr('onclick') || '';
        const text = ($(el).text() || '').trim().substring(0, 40);
        console.log(`  onclick: ${onclick.substring(0, 80)} | TEXT: "${text}"`);
    });
    
    console.log('\n=== LINKS COM starts-with http (filtro atual) ===');
    let httpCount = 0;
    $('a[href]').each((_, el) => {
        const href = ($(el).attr('href') || '').trim();
        if (href.startsWith('http')) httpCount++;
    });
    console.log(`  Total http links: ${httpCount}`);
}

checkLinks().catch(e => console.error(e.message));
