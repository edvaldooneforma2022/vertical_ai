
/* === Scheduler Chat Integration (assistant) ===
   This snippet demonstrates adding a simple webhook/proxy in server to allow the chat backend
   to instruct the LLM to call scheduler endpoints or to proxy scheduler calls safely.
   Place where your chat endpoints are defined and your message handling logic exists.
*/

app.post('/api/chat/with-scheduler', async (req, res) => {
  try {
    // Example: receive { userMessage, apiKey, sessionId }
    const { userMessage, apiKey } = req.body;
    // Basic intent detection (can be improved)
    if (/agendar|marcar reunião|agendamento|quero agendar/i.test(userMessage)) {
      // instruct client to open scheduler flow
      return res.json({ ok: true, action: 'open_scheduler', message: 'Vamos agendar — preciso do seu nome e email.' });
    }
    // fallback: normal chat processing
    return res.json({ ok: true, action: 'chat', message: '...' });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'server_error' });
  }
});
