const db = require('./scheduler-db');
const service = require('./scheduler-service');
const { DatabaseHelpers } = require('./database');
const { customAlphabet } = require('nanoid');
const nano = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 10);

async function getChatbotId(apiKey) {
    const chatbot = await DatabaseHelpers.getChatbotByApiKey(apiKey);
    if (!chatbot) {
        throw new Error('Chatbot not found for API Key');
    }
    return chatbot.id;
}


function requireApiKey(req, res) {
  const key = req.query.apiKey || req.body?.apiKey || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (!key) {
    res.status(401).json({ error: 'apiKey required' });
    return null;
  }
  return key;
}

async function postAvailability(req, res) {
  try {
    const apiKey = requireApiKey(req, res); if (!apiKey) return;
    const availability = req.body.availability;
    if (!Array.isArray(availability)) return res.status(400).json({ error: 'availability must be an array' });
    // basic validation
    for (const slot of availability) {
      if (typeof slot.weekday !== 'number' || slot.weekday <1 || slot.weekday>7) return res.status(400).json({ error: 'weekday must be 1..7' });
      if (!/^\d{2}:\d{2}$/.test(slot.start) || !/^\d{2}:\d{2}$/.test(slot.end)) return res.status(400).json({ error: 'start/end must be HH:MM' });
      slot.durationMinutes = Number(slot.durationMinutes) || 30;
    }
    const result = await db.setAvailability(apiKey, availability);
    res.json({ ok: true, availability: result });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server_error' }); }
}

async function getAvailability(req, res) {
  try {
    const apiKey = requireApiKey(req, res); if (!apiKey) return;
    const avail = await db.getAvailability(apiKey);
    res.json({ ok: true, availability: avail });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server_error' }); }
}

async function postBook(req, res) {
  try {
    const apiKey = requireApiKey(req, res); if (!apiKey) return;
    const { name, email, phone, preferred, timezone, metadata } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'name and email required' });
	    // if preferred provided, try exact
	    if (preferred && preferred.date && preferred.time) {
	      const slots = await service.generateSlotsForDate(await db.getAvailability(apiKey), preferred.date);
	      const match = slots.find(s => s.time === preferred.time);
	      if (!match) return res.status(400).json({ error: 'preferred_slot_unavailable' });
	      const bookings = await db.listBookings(apiKey, 'confirmed');
	      const conflict = bookings.find(b => b.date===preferred.date && b.time===preferred.time);
	      if (conflict) return res.status(409).json({ error: 'slot_already_booked' });
	      const booking = {
	        id: nano(),
	        name, email, phone: phone||null,
	        date: preferred.date, time: preferred.time, durationMinutes: match.durationMinutes,
	        timezone: timezone||'UTC', metadata: metadata||{}, createdAt: new Date().toISOString(), status: 'confirmed'
	      };
	      await db.addBooking(apiKey, booking);
	      return res.json({ ok: true, booking });
	    }
    // otherwise book next available
    const booking = await service.bookNextAvailable(apiKey, name, email, phone, timezone, metadata);
    if (!booking) return res.status(404).json({ error: 'no_slots_available' });
    res.json({ ok: true, booking });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server_error' }); }
}

async function getBookings(req, res) {
  try {
    const apiKey = requireApiKey(req, res); if (!apiKey) return;
    const status = req.query.status;
    const bookings = await db.listBookings(apiKey, status);
    res.json({ ok: true, bookings });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server_error' }); }
}

async function postCancel(req, res) {
  try {
    const apiKey = requireApiKey(req, res); if (!apiKey) return;
    const { bookingId, reason } = req.body;
    if (!bookingId) return res.status(400).json({ error: 'bookingId required' });
    const bk = await db.cancelBooking(apiKey, bookingId, reason);
    if (!bk) return res.status(404).json({ error: 'booking_not_found' });
    res.json({ ok: true, booking: bk });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server_error' }); }
}

module.exports = {
  postAvailability,
  getAvailability,
  postBook,
  getBookings,
  postCancel
};
