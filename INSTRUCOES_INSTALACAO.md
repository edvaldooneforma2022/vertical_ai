# Instruções de Instalação - Widget LinkMágico Corrigido

## ⚠️ IMPORTANTE: Faça Backup Antes de Instalar

Antes de aplicar as correções, faça backup dos arquivos originais:

```bash
# No servidor de produção
cp public/widget.js public/widget.js.backup
cp server.js server.js.backup
cp public/index_app.html public/index_app.html.backup
```

---

## Passo 1: Substituir os Arquivos

### Opção A: Via Upload Manual

1. Acesse o painel do Render ou seu servidor
2. Navegue até o diretório do projeto
3. Substitua os seguintes arquivos:

```
📁 Seu Projeto/
├── 📄 server.js                    ← SUBSTITUIR
└── 📁 public/
    ├── 📄 widget.js                ← SUBSTITUIR
    └── 📄 index_app.html           ← SUBSTITUIR
```

### Opção B: Via Git (Recomendado)

```bash
# 1. Clone ou acesse seu repositório
cd /caminho/do/seu/projeto

# 2. Copie os arquivos corrigidos
cp /caminho/dos/arquivos/corrigidos/widget.js public/widget.js
cp /caminho/dos/arquivos/corrigidos/server.js server.js
cp /caminho/dos/arquivos/corrigidos/index_app.html public/index_app.html

# 3. Commit e push
git add public/widget.js server.js public/index_app.html
git commit -m "fix: corrige widget para funcionar em sites externos"
git push origin main
```

---

## Passo 2: Reiniciar o Servidor

### No Render:

1. Acesse o dashboard do Render
2. Selecione seu serviço "linkmagico-comercial"
3. Clique em **"Manual Deploy"** > **"Deploy latest commit"**
4. Aguarde o deploy finalizar (2-5 minutos)

### Em Servidor VPS/Local:

```bash
# Reiniciar o serviço Node.js
pm2 restart linkmagico
# ou
npm restart
# ou
node server.js
```

---

## Passo 3: Verificar a Instalação

### 3.1. Verificar o Widget.js

Abra no navegador:
```
https://linkmagico-comercial.onrender.com/public/widget.js
```

**Verificações:**
- ✅ Arquivo deve carregar (status 200)
- ✅ Deve conter: `detectedServerDomain`
- ✅ Deve conter: `LinkMagico Widget: Server domain detected`
- ✅ Deve conter: `window.LinkMagicoWidgetConfig`

### 3.2. Verificar o Painel

Acesse:
```
https://linkmagico-comercial.onrender.com/app
```

**Verificações:**
- ✅ Painel carrega normalmente
- ✅ Todas as abas funcionam (Dashboard, Chatbot, Leads, etc.)
- ✅ Menu "Novos Sistemas 2.0" está presente

### 3.3. Gerar Código do Widget

1. No painel, vá para a aba **"Chatbot"**
2. Preencha os campos:
   - Nome do Robô: `Teste Widget`
   - URL da Página: `https://exemplo.com`
   - Instruções: `Ajude com vendas`
3. Clique em **"Ativar Chatbot"**
4. Copie o código gerado

**O código deve estar assim:**
```html
<!-- LinkMágico Chatbot Widget -->
<script>
    window.LinkMagicoWidgetConfig = {
        robotName: "Teste Widget",
        salesUrl: "https://exemplo.com",
        instructions: "Ajude com vendas",
        primaryColor: "#3b82f6"
    };
</script>
<script src="https://linkmagico-comercial.onrender.com/public/widget.js"></script>
```

**✅ CORRETO:** URL absoluta `https://linkmagico-comercial.onrender.com/public/widget.js`
**❌ INCORRETO:** URL relativa `/public/widget.js`

---

## Passo 4: Testar em Site Real

### 4.1. Criar Página de Teste

Crie um arquivo `teste-widget.html` em qualquer servidor:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Teste Widget LinkMágico</title>
    <!-- Font Awesome para os ícones -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" rel="stylesheet">
</head>
<body>
    <h1>Teste do Widget LinkMágico</h1>
    <p>O balão flutuante deve aparecer no canto inferior direito da tela.</p>

    <!-- COLE O CÓDIGO DO WIDGET AQUI -->
    <script>
        window.LinkMagicoWidgetConfig = {
            robotName: "Teste Widget",
            salesUrl: "https://exemplo.com",
            instructions: "Ajude com vendas",
            primaryColor: "#3b82f6"
        };
    </script>
    <script src="https://linkmagico-comercial.onrender.com/public/widget.js"></script>
</body>
</html>
```

### 4.2. Verificar o Console do Navegador

Abra o DevTools (F12) e vá para a aba **Console**.

**Mensagens esperadas:**
```
LinkMagico Widget: Server domain detected as https://linkmagico-comercial.onrender.com
LinkMagico Widget: No token provided, using configuration-based authentication
LinkMagico Widget: Initializing with window.LinkMagicoWidgetConfig
LinkMagico Commercial Widget v6.0.0-commercial initialized
```

**✅ Sucesso:** Balão flutuante azul aparece no canto inferior direito

### 4.3. Testar Funcionalidades

1. **Clique no balão flutuante** - janela do chat deve abrir
2. **Formulário de lead** deve aparecer (se configurado)
3. **Digite uma mensagem** e envie
4. **Resposta do bot** deve aparecer

---

## Passo 5: Integrar em Sites de Clientes

Agora você pode fornecer o código do widget para seus clientes integrarem em seus sites.

### Instruções para o Cliente:

```
1. Copie o código abaixo
2. Cole antes do fechamento da tag </body> no seu site
3. O chatbot aparecerá automaticamente
```

---

## Troubleshooting (Resolução de Problemas)

### Problema: Widget não aparece

**Verificar:**

1. **Console do navegador** (F12 > Console)
   - Há erros em vermelho?
   - As mensagens de inicialização aparecem?

2. **Network** (F12 > Network)
   - O arquivo `widget.js` foi carregado? (status 200)
   - Qual é a URL completa do widget.js?

3. **Font Awesome**
   - O ícone `fas fa-comments` precisa do Font Awesome
   - Adicione: `<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" rel="stylesheet">`

### Problema: Erro de CORS

**Sintoma:** Console mostra `CORS policy: No 'Access-Control-Allow-Origin'`

**Solução:** Verificar se o server.js tem a configuração CORS:
```javascript
app.use(cors());
```

### Problema: Widget aparece mas não responde

**Verificar:**

1. **apiBase está correto?**
   - No console: `LinkMagico Widget: Server domain detected as https://...`
   - Deve ser o domínio do servidor LinkMágico, não do cliente

2. **Requisições estão indo para o servidor correto?**
   - F12 > Network > filtrar por "api"
   - Verificar URL das requisições

### Problema: Código gerado ainda tem URL relativa

**Sintoma:** Código gerado mostra `<script src="/public/widget.js">`

**Solução:**
1. Limpar cache do navegador (Ctrl+Shift+Delete)
2. Recarregar o painel (Ctrl+F5)
3. Gerar novo código

---

## Rollback (Reverter Alterações)

Se algo der errado, você pode reverter para os arquivos originais:

```bash
# Restaurar backups
cp public/widget.js.backup public/widget.js
cp server.js.backup server.js
cp public/index_app.html.backup public/index_app.html

# Reiniciar servidor
pm2 restart linkmagico
```

---

## Suporte

Se encontrar problemas durante a instalação:

1. **Verifique os logs do servidor:**
   ```bash
   pm2 logs linkmagico
   # ou
   tail -f /var/log/linkmagico.log
   ```

2. **Verifique o console do navegador** (F12)

3. **Compare os arquivos** com os backups para garantir que foram substituídos corretamente

---

## Checklist de Instalação

- [ ] Backup dos arquivos originais criado
- [ ] Arquivo `public/widget.js` substituído
- [ ] Arquivo `server.js` substituído
- [ ] Arquivo `public/index_app.html` substituído
- [ ] Servidor reiniciado
- [ ] Widget.js carrega corretamente (status 200)
- [ ] Painel funciona normalmente
- [ ] Código gerado tem URL absoluta
- [ ] Teste em página HTML funcionou
- [ ] Balão flutuante aparece
- [ ] Chat responde mensagens

---

## Conclusão

Após seguir todos os passos, o widget deve funcionar perfeitamente em qualquer site externo! 🎉

O problema estava na combinação de:
1. Token obrigatório bloqueando inicialização
2. apiBase incorreto apontando para o site do cliente
3. Rota inline conflitando com arquivo físico
4. URL relativa no código gerado

Todas essas questões foram resolvidas nas correções aplicadas.
