const fs = require('fs');

const html = fs.readFileSync('C:\\Users\\edval\\vertical_ai\\public\\index_app.html', 'utf8');

let inTag = false;
let currentTag = '';
let output = [];
let depth = 0;

for(let i=0; i<html.length; i++) {
    const char = html[i];
    
    if (char === '<' && html[i+1] !== '!' && html[i+1] !== '/') {
        inTag = true;
        currentTag = '';
        continue;
    }
    
    if (inTag && char === '>') {
        inTag = false;
        
        const parts = currentTag.trim().split(/\s+/);
        const tagName = parts[0];
        
        let idMatch = currentTag.match(/id=(["'])(.*?)\1/);
        let classMatch = currentTag.match(/class=(["'])(.*?)\1/);
        
        let id = idMatch ? idMatch[2] : '';
        let cls = classMatch ? classMatch[2] : '';
        
        if (['div', 'main', 'section', 'header', 'nav', 'form', 'button', 'input', 'h1', 'h2'].includes(tagName.toLowerCase())) {
            if (id || cls) {
                output.push('  '.repeat(depth) + `<${tagName}${id ? ' id="'+id+'"' : ''}${cls ? ' class="'+cls+'"' : ''}>`);
            }
        }
        
        if (!['input', 'img', 'br', 'hr', 'meta', 'link'].includes(tagName.toLowerCase()) && !currentTag.endsWith('/')) {
            depth++;
        }
        continue;
    }
    
    if (char === '<' && html[i+1] === '/') {
        let closeTagEnd = html.indexOf('>', i);
        let tagName = html.substring(i+2, closeTagEnd).trim().split(/\s+/)[0];
        if (!['input', 'img', 'br', 'hr', 'meta', 'link'].includes(tagName.toLowerCase())) {
            depth--;
            if (depth < 0) depth = 0;
        }
        i = closeTagEnd;
        continue;
    }
    
    if (inTag) {
        currentTag += char;
    }
}

fs.writeFileSync('C:\\Users\\edval\\vertical_ai\\structure.txt', output.join('\n'));
console.log('Structure saved to structure.txt');
