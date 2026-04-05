const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { marked } = require('marked');

// Paths
const conversationDir = 'C:\\Users\\edval\\.gemini\\antigravity\\brain\\b4a9eeaf-7fb5-4263-a6fa-b0be8faa4eb6';
const walkthroughPath = path.join(conversationDir, 'artifacts', 'walkthrough.md');
const pdfOutputPath = path.join(conversationDir, 'artifacts', 'Auto-Learning-Validation-Report.pdf');

async function generatePDF() {
  console.log('📖 Lendo walkthrough.md...');
  const markdown = fs.readFileSync(walkthroughPath, 'utf8');

  // Ajustar caminhos de imagem para o HTML (converter caminhos absolutos para file:// se necessário)
  const markdownWithAbsoluteImages = markdown.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
    // Se o caminho já for absoluto e começar com C:, adicionar file:///
    const fixedSrc = src.startsWith('C:') ? `file:///${src.replace(/\\/g, '/')}` : src;
    return `![${alt}](${fixedSrc})`;
  });

  console.log('🎨 Convertendo Markdown para HTML com Estilo Premium...');
  const htmlContent = marked(markdownWithAbsoluteImages);

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Relatório de Validação - Auto-Learning V2.0</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Inter', sans-serif;
          color: #1e293b;
          line-height: 1.6;
        }
        h1 { @apply text-4xl font-bold mb-8 text-blue-600 border-b-2 border-blue-100 pb-4; }
        h2 { @apply text-2xl font-semibold mt-12 mb-6 text-slate-800 border-l-4 border-blue-500 pl-4 bg-slate-50 py-2; }
        h3 { @apply text-xl font-medium mt-8 mb-4 text-slate-700; }
        p { @apply mb-4 text-slate-600; }
        table { @apply w-full border-collapse mb-8 rounded-lg overflow-hidden shadow-sm; }
        th { @apply bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200; }
        td { @apply px-4 py-3 border-b border-slate-100 text-slate-600; }
        img { @apply rounded-xl shadow-lg my-8 max-w-full border border-slate-200; }
        .alert { @apply p-4 rounded-lg my-6 border-l-4; }
        .alert-important { @apply bg-blue-50 border-blue-500 text-blue-800; }
        .alert-note { @apply bg-slate-50 border-slate-400 text-slate-700; }
        .alert-tip { @apply bg-emerald-50 border-emerald-500 text-emerald-800; }
        .carousel-slide { @apply block; }
        code { @apply bg-slate-100 text-pink-600 px-1 rounded font-mono text-sm; }
        pre { @apply bg-slate-900 text-slate-100 p-6 rounded-xl overflow-x-auto my-6 shadow-xl; }
        pre code { @apply bg-transparent text-inherit p-0; }
        .page-break { page-break-after: always; }
      </style>
    </head>
    <body class="max-w-4xl mx-auto p-12">
      <header class="mb-12 flex items-center justify-between">
        <div>
          <h1 class="text-3xl border-none mb-0">Relatório de Validação Técnica</h1>
          <p class="text-slate-400 mt-1 uppercase tracking-widest font-semibold text-xs">LinkMágico Growth Loop • Auto-Learning V2.0</p>
        </div>
        <div class="text-right">
          <p class="text-sm text-slate-400">Data: ${new Date().toLocaleDateString('pt-BR')}</p>
          <p class="text-sm text-slate-400">Versão: 1.0 (Final)</p>
        </div>
      </header>
      
      <div id="content">
        ${htmlContent}
      </div>

      <footer class="mt-20 pt-8 border-t border-slate-100 text-center text-slate-400 text-xs">
        © ${new Date().getFullYear()} LinkMágico. Relatório confidencial de validação de sistema.
      </footer>
    </body>
    </html>
  `;

  console.log('🚀 Iniciando Puppeteer para gerar PDF...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Set content and wait for images and webfonts to load
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

  console.log('🖨️ Imprimindo para PDF...');
  await page.pdf({
    path: pdfOutputPath,
    format: 'A4',
    margin: {
      top: '20mm',
      right: '15mm',
      bottom: '20mm',
      left: '15mm'
    },
    printBackground: true,
    displayHeaderFooter: false
  });

  await browser.close();
  console.log(`✅ PDF gerado com sucesso: ${pdfOutputPath}`);
}

generatePDF().catch(err => {
  console.error('❌ Erro ao gerar PDF:', err);
  process.exit(1);
});
