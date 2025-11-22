const { DatabaseHelpers } = require('./database');
const { getChatbotByApiKey } = DatabaseHelpers;

// O sistema de agendamento original usava arquivos JSON/Redis para persistência.
// O novo sistema usará o banco de dados centralizado (PostgreSQL/SQLite)
// com isolamento de tenant via chatbot_id (obtido da API Key).

// Funções de disponibilidade (ainda usam o sistema de arquivos/Redis temporariamente)
// O ideal seria migrar a disponibilidade para o banco de dados também, mas
// o foco é o agendamento (bookings).

const fs = require('fs');
const path = require('path');

function tenantKey(apiKey) {
  return apiKey.replace(/[^a-zA-Z0-9_-]/g, '_') || 'public';
}

function dataDir() {
  return path.join(__dirname, 'scheduler_data');
}

async function ensureDir(p) {
  return fs.promises.mkdir(p, { recursive: true });
}

async function jsonFileForTenant(apiKey) {
  const dir = dataDir();
  await ensureDir(dir);
  const fn = path.join(dir, `${tenantKey(apiKey)}.json`);
  // ensure file exists
  try {
    await fs.promises.access(fn);
  } catch {
    await fs.promises.writeFile(fn, JSON.stringify({ availability: [], bookings: [] }, null, 2));
  }
  return fn;
}

async function getData(apiKey) {
  const fn = await jsonFileForTenant(apiKey);
  const txt = await fs.promises.readFile(fn, 'utf8');
  return JSON.parse(txt || '{}');
}

async function setData(apiKey, obj) {
  const fn = await jsonFileForTenant(apiKey);
  await fs.promises.writeFile(fn, JSON.stringify(obj, null, 2));
  return true;
}

async function setAvailability(apiKey, availability) {
  const data = await getData(apiKey);
  data.availability = availability || [];
  await setData(apiKey, data);
  return data.availability;
}

async function getAvailability(apiKey) {
  const data = await getData(apiKey);
  return data.availability || [];
}

// =================================================================
// FUNÇÕES DE AGENDAMENTO (BOOKINGS) - MIGRANDO PARA O BANCO DE DADOS
// =================================================================

async function getChatbotId(apiKey) {
    const chatbot = await getChatbotByApiKey(apiKey);
    if (!chatbot) {
        throw new Error('Chatbot not found for API Key');
    }
    return chatbot.id;
}

async function addBooking(apiKey, booking) {
    const chatbot_id = await getChatbotId(apiKey);
    const appointmentData = {
        chatbot_id,
        name: booking.name,
        email: booking.email,
        phone: booking.phone,
        date: booking.date,
        time: booking.time,
        duration_minutes: booking.durationMinutes,
        timezone: booking.timezone,
        metadata: booking.metadata,
        status: booking.status
    };
    // Persistir no banco de dados principal
    const newBooking = await DatabaseHelpers.addAppointment(appointmentData);
    return newBooking;
}

async function listBookings(apiKey, status) {
    const chatbot_id = await getChatbotId(apiKey);
    // Recuperar do banco de dados principal
    const bookings = await DatabaseHelpers.listAppointments(chatbot_id, status);
    return bookings.map(b => ({
        id: b.id,
        name: b.name,
        email: b.email,
        phone: b.phone,
        date: b.date,
        time: b.time,
        durationMinutes: b.duration_minutes,
        timezone: b.timezone,
        metadata: b.metadata,
        createdAt: b.created_at,
        status: b.status
    }));
}

async function cancelBooking(apiKey, bookingId, reason) {
    const chatbot_id = await getChatbotId(apiKey);
    // Cancelar no banco de dados principal
    const cancelledBooking = await DatabaseHelpers.cancelAppointment(chatbot_id, bookingId, reason);
    return cancelledBooking;
}

module.exports = {
  // initRedis, // Não é mais necessário
  addBooking,
  listBookings,
  cancelBooking,
  setAvailability,
  getAvailability,
};
