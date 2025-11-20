const express = require('express');
const router = express.Router();
const ctrl = require('./scheduler-controller');

// endpoints
router.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

router.post('/availability', ctrl.postAvailability); // admin keys handled by client via API_KEY
router.get('/availability', ctrl.getAvailability);

router.post('/book', ctrl.postBook);
router.get('/bookings', ctrl.getBookings);
router.post('/cancel', ctrl.postCancel);

module.exports = router;
exports.default = router;
