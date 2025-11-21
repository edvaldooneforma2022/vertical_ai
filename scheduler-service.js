const db = require('./scheduler-db');
const { customAlphabet } = require('nanoid');
const nano = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 10);

function generateSlotsForDate(availability, dateStr) {
  // dateStr YYYY-MM-DD
  const [y,m,d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m-1, d));
  let weekday = dt.getUTCDay(); // 0-6
  weekday = weekday === 0 ? 7 : weekday; // 1-7
  const slots = [];
  for (const slot of (availability || []).filter(s => s.weekday === weekday)) {
    const [sh, sm] = slot.start.split(':').map(Number);
    const [eh, em] = slot.end.split(':').map(Number);
    const duration = Number(slot.durationMinutes) || 30;
    let t = new Date(Date.UTC(y, m-1, d, sh, sm));
    const end = new Date(Date.UTC(y, m-1, d, eh, em));
    while (t < end) {
      const hh = String(t.getUTCHours()).padStart(2,'0');
      const mm = String(t.getUTCMinutes()).padStart(2,'0');
      slots.push({ date: dateStr, time: `${hh}:${mm}`, durationMinutes: duration });
      t = new Date(t.getTime() + duration*60000);
    }
  }
  return slots;
}

async function bookNextAvailable(apiKey, name, email, phone, timezone, metadata) {
  const availability = await db.getAvailability(apiKey);
  const today = new Date();
  let dateCursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  for (let i=0;i<30;i++) {
    const dateStr = dateCursor.toISOString().slice(0,10);
    const slots = generateSlotsForDate(availability, dateStr);
    for (const s of slots) {
      const bookings = await db.listBookings(apiKey, 'confirmed');
      const conflict = bookings.find(b => b.date === s.date && b.time === s.time);
      if (!conflict) {
        const booking = {
          id: nano(),
          name, email, phone: phone||null,
          date: s.date, time: s.time, durationMinutes: s.durationMinutes,
          timezone: timezone||'UTC',
          metadata: metadata||{},
          createdAt: new Date().toISOString(),
          status: 'confirmed'
        };
        await db.addBooking(apiKey, booking);
        return booking;
      }
    }
    dateCursor = new Date(dateCursor.getTime() + 24*3600*1000);
  }
  return null;
}

module.exports = {
  generateSlotsForDate,
  bookNextAvailable,
};
