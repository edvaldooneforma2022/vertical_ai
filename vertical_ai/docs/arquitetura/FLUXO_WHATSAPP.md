# Fluxo WhatsApp

## Arquivos envolvidos

- `server.js`: registra endpoints globais WhatsApp, carrega `whatsapp-routes.js` e registra `whatsapp-channel.js`.
- `whatsapp-routes.js`: endpoints multi-tenant de configuração e conexão WhatsApp.
- `whatsapp-channel.js`: canal nativo para webhooks Evolution/Twilio e ponte para o pipeline de IA.
- `whatsapp-integration.js`: provider manager para Twilio/Evolution, envio de mensagens, cache de instâncias e configuração global/tenant.
- `database.js`: leitura e escrita de `whatsapp_settings`, consulta de `short_urls` e `checkout_links` no canal.
- `public/index_app.html` e partes do painel: telas e chamadas de configuração/status/teste WhatsApp.
- Pipeline de lead/CRM e IA usado pelo canal WhatsApp.

## Endpoints utilizados

### Configuração e envio

- `GET /api/whatsapp/status`
- `POST /api/whatsapp/send`
- `POST /api/whatsapp/settings`
- `GET /api/whatsapp/settings`
- `POST /api/whatsapp/settings/test`
- `DELETE /api/whatsapp/settings`
- `POST /api/whatsapp/saas/connect`
- `GET /api/whatsapp/saas/status`
- `POST /api/whatsapp/saas/disconnect`
- `POST /api/whatsapp/saas/reconnect`

### Canal nativo

- `POST /api/webhook/evolution`
- `POST /api/webhook/twilio`
- `GET /api/whatsapp/channel/status`
- Chamada interna para `POST /api/process-chat-inteligente` quando `WA_USE_FULL_PIPELINE=true`.
- Chamada interna para `POST /api/chat-universal` quando `WA_USE_FULL_PIPELINE=false`.

## Fluxo completo de execução

### Configuração por tenant

1. O painel consulta `/api/whatsapp/settings` ou `/api/whatsapp/status` para exibir estado.
2. O usuário salva provider e credenciais em `/api/whatsapp/settings`.
3. `whatsapp-routes.js` resolve a API Key por sessão, header `x-api-key`, query ou body.
4. A rota valida provider `twilio` ou `evolution` e campos obrigatórios.
5. As configurações são salvas via `DatabaseHelpers.saveWhatsAppSettings`.
6. O cache do tenant é limpo para forçar reload da instância.
7. O teste usa `/api/whatsapp/settings/test`, obtém instância por tenant e envia mensagem de teste.
8. O modo SaaS/Evolution central usa `/api/whatsapp/saas/connect`, `/status`, `/disconnect` e `/reconnect` para criar ou reusar instância e atualizar estado em `whatsapp_settings`.

### Recebimento de mensagem

1. O provider envia webhook para `/api/webhook/evolution` ou `/api/webhook/twilio`.
2. `whatsapp-channel.js` responde rapidamente com 200 para evitar reenvios.
3. O canal identifica formato do evento, ignora eventos não-mensagem, mensagens enviadas por ele mesmo e grupos.
4. O canal extrai telefone, texto, nome/pushName, instance e identificadores.
5. O canal resolve o tenant por `whatsapp_settings`, número/instância ou fallback configurado.
6. O canal obtém ou cria lead associado ao telefone.
7. O canal busca dados do assistente em `short_urls`, usando a mesma fonte do Link Curto.
8. Se houver `salesUrl`, tenta enriquecer com checkout confirmado em `checkout_links` e pageData quando possível.
9. O canal monta payload com `message`, `apiKey`, `conversationId`, `leadId`, `url`, `robotName`, `instructions`, `pageData` e `context`.
10. O canal chama internamente `/api/process-chat-inteligente` ou `/api/chat-universal`, conforme `WA_USE_FULL_PIPELINE`.
11. A resposta da IA é adaptada para WhatsApp: markdown simplificado, truncamento e tradução de CTAs/links para texto clicável.
12. O envio é feito pela instância do tenant; se não existir, tenta a configuração global.
13. Logs registram origem, endpoint usado, status de envio, CTAs e sinais de jornada/captura.

## Dependências

- `WHATSAPP_PROVIDER` global ou configurações por tenant em `whatsapp_settings`.
- Twilio: Account SID, Auth Token e número WhatsApp.
- Evolution: URL/API Key/instance ou Evolution central SaaS.
- Banco com `whatsapp_settings`, `short_urls` e, quando aplicável, `checkout_links`.
- `WA_USE_FULL_PIPELINE` para alternar entre pipeline principal e legado.
- Servidor local acessível em `127.0.0.1:<PORT>` para chamadas internas do canal.
- Pipeline de IA, lead/CRM e providers externos.

## Pontos críticos

- Resolução do tenant a partir de número/instância é determinante para isolamento.
- Webhooks precisam responder rápido para evitar duplicidade de eventos.
- Mensagens de grupo e mensagens `fromMe` são filtradas.
- O canal usa `short_urls` como fonte do assistente, alinhado ao Link Curto.
- Chamada HTTP interna depende da porta correta do servidor.
- O envio final depende da instância do tenant ou fallback global.
- Credenciais não devem ser expostas em respostas de consulta.

## Possíveis pontos de regressão

- Mudanças no formato de webhook Evolution/Twilio podem impedir extração de mensagem.
- Alterações em `whatsapp_settings` podem quebrar resolução de tenant e envio.
- Alterações no payload de `/api/process-chat-inteligente` ou `/api/chat-universal` podem quebrar o canal.
- Alterações em `short_urls` afetam diretamente o assistente usado no WhatsApp.
- Mudanças em `WA_USE_FULL_PIPELINE` alteram comportamento do canal.
- Falha no servidor local/porta torna a IA indisponível para WhatsApp mesmo com webhook funcionando.
- Mudanças no provider manager podem afetar fallback tenant/global.
