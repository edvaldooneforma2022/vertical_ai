const fs = require('fs');
const path = require('path');
let RedisClient = null;
let redisAvailable = false;

async function initRedis(redisUrl) {
  try {
    const { createClient } = require('redis');
    const client = createClient({ url: redisUrl });
    client.on('error', (e) => console.error('Redis error', e));
    await client.connect();
    RedisClient = client;
    redisAvailable = true;
    return client;
  } catch (e) {
    console.warn('Redis init failed, falling back to JSON files:', e.message);
    redisAvailable = false;
    return null;
  }
}

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

// API: getData, setData, addBooking, listBookings, cancelBooking, setAvailability, getAvailability
async function getData(apiKey) {
  if (redisAvailable && RedisClient) {
    const key = `scheduler:data:${tenantKey(apiKey)}`;
    const raw = await RedisClient.get(key);
    if (raw) return JSON.parse(raw);
    // fallback to file
  }
  const fn = await jsonFileForTenant(apiKey);
  const txt = await fs.promises.readFile(fn, 'utf8');
  return JSON.parse(txt || '{}');
}

async function setData(apiKey, obj) {
  if (redisAvailable && RedisClient) {
    const key = `scheduler:data:${tenantKey(apiKey)}`;
    await RedisClient.set(key, JSON.stringify(obj));
  }
  const fn = await jsonFileForTenant(apiKey);
  await fs.promises.writeFile(fn, JSON.stringify(obj, null, 2));
  return true;
}

async function addBooking(apiKey, booking) {
  const data = await getData(apiKey);
  data.bookings = data.bookings || [];
  data.bookings.push(booking);
  await setData(apiKey, data);
  return booking;
}

async function listBookings(apiKey, status) {
  const data = await getData(apiKey);
  let arr = data.bookings || [];
  if (status) arr = arr.filter(b => b.status === status);
  return arr;
}

async function cancelBooking(apiKey, bookingId, reason) {
  const data = await getData(apiKey);
  const idx = (data.bookings || []).findIndex(b => b.id === bookingId);
  if (idx === -1) return null;
  data.bookings[idx].status = 'cancelled';
  data.bookings[idx].cancelledAt = new Date().toISOString();
  if (reason) data.bookings[idx].cancelReason = reason;
  await setData(apiKey, data);
  return data.bookings[idx];
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

module.exports = {
  initRedis,
  addBooking,
  listBookings,
  cancelBooking,
  setAvailability,
  getAvailability,
};
