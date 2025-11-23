
/*
  Enhanced widget.js for Link Mágico
  - Intercepts "Agendar" actions
  - Calls /api/schedule/availability
  - Renders slot picker in chat
  - Calls /api/schedule/book to confirm booking
  - Graceful fallback to original chat flow
*/

(async function(){
  // Simple DOM-friendly widget integration; adapt selectors as needed
  function $(sel, root=document) { return root.querySelector(sel); }
  function createEl(tag, props={}, children=[]) {
    const el = document.createElement(tag);
    Object.assign(el, props);
    for (const c of children) {
      if (typeof c === 'string') el.appendChild(document.createTextNode(c));
      else el.appendChild(c);
    }
    return el;
  }

  // Wait helper
  function waitFor(selector, timeout=5000) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const iv = setInterval(()=>{
        const el = document.querySelector(selector);
        if (el) { clearInterval(iv); resolve(el); }
        if (Date.now() - t0 > timeout) { clearInterval(iv); reject(new Error('timeout')); }
      }, 150);
    });
  }

  // Main integration logic
  async function initSchedulerWidget(){
    // try to find the agendar button
    let agendarBtn;
    try {
      agendarBtn = await waitFor('button#lm-agendar, .lm-agendar, button[data-action="agendar"]', 3000);
    } catch(e) {
      // fallback: search by text
      const candidates = [...document.querySelectorAll('button, a')].filter(b=>/agendar|agendamento|agenda/i.test(b.innerText));
      agendarBtn = candidates[0];
    }
    if (!agendarBtn) return console.warn('[Widget Scheduler] Agendar button not found');

    agendarBtn.addEventListener('click', async (ev)=>{
      ev.preventDefault();
      // Open a custom slot picker in chat container
      try {
        const chatContainer = document.querySelector('.chat-messages, .widget-messages, .lm-chat') || document.body;
        const promptNode = createEl('div', { className: 'lm-slot-picker', style: 'padding:12px;border-radius:10px;background:#fff;margin:10px 8px;border:1px solid rgba(0,0,0,0.06);' });
        const loading = createEl('div', { innerText: 'Buscando horários disponíveis...' });
        promptNode.appendChild(loading);
        chatContainer.appendChild(promptNode);
        // call availability API
        const apiKey = window.LINKMAGICO_APIKEY || (new URLSearchParams(location.search).get('apiKey')) || 'public';
        const res = await fetch(`/api/schedule/availability?apiKey=${encodeURIComponent(apiKey)}`, { method: 'GET', credentials: 'same-origin' });
        if (!res.ok) {
          loading.innerText = 'Não foi possível obter horários. Tente novamente.';
          return;
        }
        const j = await res.json();
        const slots = (j && j.availability) || [];
        loading.remove();
        if (!slots.length) {
          promptNode.appendChild(createEl('div',{innerText:'Nenhuma disponibilidade configurada. Por favor, peça ao administrador para configurar.'}));
          return;
        }
        // Build UI: show next 14 days combined with slots
        const days = [];
        for (let i=0;i<14;i++){
          const d = new Date();
          d.setDate(d.getDate()+i);
          days.push(d);
        }
        // For each day, generate time slots based on availability rules (same logic as server)
        function generateSlotsForDay(availability, date){
          const weekday = date.getDay() === 0 ? 7 : date.getDay(); // 1-7
          const dateStr = date.toISOString().slice(0,10);
          const result = [];
          for (const slot of availability.filter(s=>s.weekday===weekday)){
            const [sh,sm] = slot.start.split(':').map(Number);
            const [eh,em] = slot.end.split(':').map(Number);
            const dur = Number(slot.durationMinutes)||30;
            let t = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), sh, sm));
            const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), eh, em));
            while (t < end) {
              const hh = String(t.getUTCHours()).padStart(2,'0');
              const mm = String(t.getUTCMinutes()).padStart(2,'0');
              result.push({ date: dateStr, time:`${hh}:${mm}`, durationMinutes: dur });
              t = new Date(t.getTime() + dur*60000);
            }
          }
          return result;
        }

        const listNode = createEl('div', { style: 'display:flex;flex-direction:column;gap:8px;max-height:300px;overflow:auto;padding-top:8px;' });
        // flatten slots for upcoming days
        const flatSlots = [];
        for (const d of days) {
          const ds = generateSlotsForDay(slots, d);
          for (const s of ds) {
            flatSlots.push(s);
          }
        }
        if (!flatSlots.length) {
          promptNode.appendChild(createEl('div',{innerText:'Nenhum slot disponível nos próximos dias.'}));
          return;
        }
        // show first 20 slots
        flatSlots.slice(0,20).forEach(s=>{
          const b = createEl('button', { className: 'lm-slot-btn', style: 'padding:10px 12px;border-radius:8px;border:1px solid #e6e9ef;background:#f7f9fc;cursor:pointer;text-align:left;' });
          b.appendChild(createEl('div',{innerText: `${s.date} ${s.time}`}));
          b.addEventListener('click', async ()=>{
            // show confirm form
            const form = createEl('div',{style:'margin-top:8px;padding:8px;border-radius:8px;background:#fff;border:1px solid #eef2ff;'});
            form.appendChild(createEl('div',{innerText:'Confirme seu nome e e-mail para agendar:'}));
            const name = createEl('input',{placeholder:'Seu nome completo', style:'width:100%;padding:8px;margin-top:6px;border-radius:6px;border:1px solid #ddd;'});
            const email = createEl('input',{placeholder:'Seu melhor email', style:'width:100%;padding:8px;margin-top:6px;border-radius:6px;border:1px solid #ddd;'});
            const submit = createEl('button',{innerText:'Confirmar agendamento', style:'margin-top:8px;padding:8px;border-radius:6px;background:#2d6cdf;color:#fff;border:none;cursor:pointer;'});
            form.appendChild(name); form.appendChild(email); form.appendChild(submit);
            b.replaceWith(form);
            submit.addEventListener('click', async ()=>{
              submit.disabled = true;
              submit.innerText = 'Agendando...';
              const payload = { apiKey, name: name.value || 'Cliente', email: email.value || '', preferred: { date: s.date, time: s.time } };
              const bookRes = await fetch('/api/schedule/book', {
                method: 'POST',
                headers: { 'Content-Type':'application/json' },
                body: JSON.stringify(payload),
                credentials:'same-origin'
              });
              if (!bookRes.ok) {
                submit.innerText = 'Erro ao agendar';
                submit.disabled = false;
                return;
              }
              const bj = await bookRes.json();
              if (bj && bj.ok && bj.booking) {
                form.innerHTML = '<div style="padding:8px;color:#0b8a3e;font-weight:700">Agendamento confirmado!</div>';
                form.appendChild(createEl('div',{innerText:`ID: ${bj.booking.id}`}));
                form.appendChild(createEl('div',{innerText:`Data: ${bj.booking.date} ${bj.booking.time}`}));
              } else {
                form.innerHTML = '<div style="color:#c0392b">Falha ao agendar. Tente novamente.</div>';
              }
            });
          });
          listNode.appendChild(b);
        });

        promptNode.appendChild(listNode);

      } catch (err) {
        console.error('[Widget Scheduler] error', err);
      }
    });
  }

  // initialize after DOM ready
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initSchedulerWidget);
  } else initSchedulerWidget();

})();
