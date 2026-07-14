# Fluxo do Widget

## Arquivos envolvidos

- `public/index_app.html`: exibe e gera o código de instalação do widget com `window.LinkMagicoWidgetConfig`.
- `public/widget.js`: script do widget moderno embarcável.
- `server.js`: serve `/public/widget.js`, recebe `/api/capture-lead` e processa chat em `/api/process-chat-inteligente` e `/api/chat-universal`.
- `public/script.js`: widget/cliente legado que conversa com `/chat-universal` sem prefixo `/api`.
- `widget.js`, `widget.js.js` e `public/widjet.js`: variantes legadas ou alternativas de widget existentes no repositório.
- Módulos de lead/CRM, analytics, billing e IA chamados pelo servidor.

## Endpoints utilizados

- `GET /public/widget.js`
- `POST /api/capture-lead`
- `POST /api/process-chat-inteligente`
- `POST /api/chat-universal`
- `POST /chat-universal` ou `/chat-universal` em widgets legados, conforme arquivo usado.
- `POST /api/track-event`
- `POST /api/extract` e `POST /api/extract-enhanced` no painel antes da geração.

## Fluxo completo de execução

1. No painel, o usuário cria ou configura o assistente com nome, URL de vendas, instruções, cor e API Key.
2. O painel gera um snippet com `window.LinkMagicoWidgetConfig` e referência a `/public/widget.js`.
3. O cliente cola o snippet no site externo.
4. O navegador do visitante baixa `/public/widget.js` do servidor Link Mágico.
5. O script detecta `window.LinkMagicoWidgetConfig` e inicializa o widget com `apiBase`, `apiKey`, `robotName`, `salesUrl`, `instructions`, cores e preferências.
6. O widget cria DOM, estilos, botão flutuante, janela de chat, campos de lead e estado de conversa.
7. Quando o visitante informa dados de lead, o widget envia `POST /api/capture-lead` com nome, email, telefone, URL de origem, robô, conversa e API Key.
8. Quando o visitante envia mensagem, o widget chama `POST /api/process-chat-inteligente` com mensagem, URL, instruções, robô, conversationId, leadId, pageData/contexto e API Key conforme disponível.
9. O backend autentica/resolve tenant, aplica billing quando configurado, processa IA, aplica regras de links/checkout/WhatsApp e retorna resposta.
10. O widget renderiza a resposta, CTAs e eventuais links detectados.
11. Eventos de clique, WhatsApp, lead ou conversão podem ser enviados para `/api/track-event`.
12. Em implementações legadas, `public/script.js`, `widget.js.js` ou outros arquivos podem chamar `/chat-universal` ou `/api/chat-universal`, mantendo compatibilidade com instalações anteriores.

## Dependências

- `window.LinkMagicoWidgetConfig` presente antes do carregamento do script.
- Servidor Express entregando `/public/widget.js` como estático.
- API Key válida ou resolvível pelo backend.
- Pipeline de lead/CRM em `/api/capture-lead`.
- Pipeline conversacional em `/api/process-chat-inteligente`.
- IA, extração, billing, analytics e guardrails de link/checkout.
- Compatibilidade com CORS/CSP no site onde o widget é instalado.

## Pontos críticos

- O snippet gerado no painel é contrato público com clientes.
- `apiBase` e rotas precisam estar coerentes com o domínio real do backend.
- `apiKey` é necessária para isolamento multi-tenant.
- Mudanças no payload do widget afetam instalações externas já copiadas.
- O widget depende do DOM e pode coexistir com CSS/JS de sites de terceiros.
- Variantes legadas usam endpoints diferentes do widget moderno.

## Possíveis pontos de regressão

- Alterar `window.LinkMagicoWidgetConfig` quebra inicialização em sites externos.
- Alterar `/public/widget.js` ou a rota estática quebra instalações já publicadas.
- Alterar `/api/process-chat-inteligente` sem compatibilidade quebra conversa do widget.
- Alterar `/api/capture-lead` sem compatibilidade quebra captura de lead.
- Remover compatibilidade com `/api/chat-universal` ou `/chat-universal` pode quebrar widgets antigos.
- Mudanças de CSS global podem afetar isolamento visual do widget.
