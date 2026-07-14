# Fluxo de Link Curto

## Arquivos envolvidos

- `public/index_app.html`: cria o assistente, aciona `/api/create-short-url`, exibe link e botões de compartilhamento.
- `server.js`: implementa `GET /l/:shortCode`, `POST /api/create-short-url`, `/chatbot`, `/api/capture-lead`, `/api/process-chat-inteligente` e `/api/chat-universal`.
- `short-url-generator.js`: valida e gera códigos curtos únicos.
- `database.js`: persiste e consulta `short_urls` e dados relacionados.
- `cache-manager.js` / `CacheManager`: guarda short URL por chave `short_url:<shortCode>`.
- `whitelabel` manager: enriquece o redirect com parâmetros de marca quando há configuração do tenant.
- `analyticsManager`: registra criação e acesso ao link curto.
- `routes.js`: lista e remove assistentes a partir da tabela `short_urls`.

## Endpoints utilizados

- `POST /api/create-short-url`
- `GET /l/:shortCode`
- `GET /chatbot`
- `POST /api/capture-lead`
- `POST /api/process-chat-inteligente`
- `POST /api/chat-universal`
- `GET /api/assistants`
- `DELETE /api/assistants/:id`
- `POST /api/extract`
- `POST /api/extract-enhanced`
- `POST /api/track-event`

## Fluxo completo de execução

1. No painel, o usuário preenche dados do assistente: nome do robô, URL de vendas, instruções e API Key.
2. Opcionalmente, o painel chama `/api/extract` ou `/api/extract-enhanced` para extrair dados da página de vendas.
3. O painel chama `POST /api/create-short-url` com `robotName`, `salesUrl`, `instructions` e `apiKey`.
4. O backend valida API Key, nome e URL.
5. O backend verifica limites de billing do tenant.
6. O backend gera um `shortCode` único com `ShortUrlGenerator.generateUnique`.
7. O backend monta a `longUrl` no formato `/chatbot?...`.
8. O backend grava o registro em `short_urls` via `DatabaseHelpers.createShortUrl`.
9. O backend grava cache Redis com a chave `short_url:<shortCode>`.
10. O backend registra analytics de criação e retorna a URL pública `/l/:shortCode`.
11. Quando alguém acessa `/l/:shortCode`, o backend valida o formato com `ShortUrlGenerator.isValid`.
12. O backend tenta resolver o código pelo cache; em cache miss, consulta `DatabaseHelpers.getShortUrl`.
13. Se não encontrar registro, retorna 404.
14. Se encontrar, atualiza contador de acesso de forma assíncrona.
15. O backend registra analytics de acesso.
16. O backend carrega whitelabel do tenant.
17. O backend redireciona para `/chatbot` com `name`, `url`, `instructions`, `apiKey` e parâmetros de whitelabel.
18. A página `/chatbot` captura lead quando necessário via `/api/capture-lead`.
19. As mensagens são enviadas ao pipeline por `/api/process-chat-inteligente` ou, em partes legadas, `/api/chat-universal`.
20. Eventos de conversão podem ser registrados via `/api/track-event`.

## Dependências

- `short_urls` no banco.
- `apiKey` como chave de tenant.
- Redis/cache para performance do redirect.
- Billing para limite de assistentes/chatbots.
- Analytics para eventos de criação e acesso.
- Whitelabel para personalização do redirect.
- Pipeline de IA e extração para conversa após o redirect.

## Pontos críticos

- O redirect depende de `apiKey`, `sales_url`, `robot_name` e `instructions` armazenados no registro.
- O cache de short URL precisa permanecer compatível com o formato lido no redirect.
- O código curto precisa ser único e válido.
- O endpoint de criação tem verificações de billing em mais de um trecho.
- O redirect carrega dados em query string para `/chatbot`.
- A leitura de assistentes no painel usa a mesma fonte (`short_urls`) esperada pelo fluxo.

## Possíveis pontos de regressão

- Alterar nomes de campos em `short_urls` sem migração quebra redirect, painel e WhatsApp.
- Alterar o padrão `/l/:shortCode` quebra links já compartilhados.
- Remover parâmetros de `/chatbot` quebra links curtos antigos.
- Modificar a forma de resolver `apiKey` pode impedir criação, lead ou conversa.
- Incompatibilidade entre cache e DB pode gerar redirects com dados antigos.
- Alterações no limite de billing podem bloquear criação de assistentes existentes.
