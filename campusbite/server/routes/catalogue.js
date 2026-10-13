// server/routes/catalogue.js
// Public, read-only data the website needs: rules, menu, delivery zones and
// live availability of hourly order windows.

const express = require('express');
const config = require('../config');
const db = require('../db');
const { HttpError, asyncHandler } = require('../middleware/errors');
const { validateOrderDate, isSlotInPast, todayInZone, addDays } = require('../validators');

const router = express.Router();

// GET /api/config — business rules shared with the browser
router.get('/config', (req, res) => {
  const today = todayInZone();
  res.json({
    slots: config.SLOTS,
    vatRate: config.VAT_RATE,
    freeDeliveryThreshold: config.FREE_DELIVERY_THRESHOLD,
    maxLineQuantity: config.MAX_LINE_QUANTITY,
    paymentMethods: config.PAYMENT_METHODS,
    today,
    lastOrderDate: addDays(today, config.MAX_ADVANCE_DAYS),
  });
});

// GET /api/menu — active items; sold-out ones are flagged, not hidden
router.get('/menu', asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT m.item_id AS id, m.name, c.name AS category, m.description, m.price,
            m.image_path AS image, m.is_available AS available
     FROM menu_items m JOIN menu_categories c ON c.category_id = m.category_id
     WHERE m.is_active = 1
     ORDER BY c.category_id, m.item_id`
  );
  res.json(rows.map((r) => ({ ...r, price: Number(r.price), available: Boolean(r.available) })));
}));

// GET /api/zones
router.get('/zones', asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT zone_id AS id, name, area_type AS areaType, delivery_fee AS fee
     FROM delivery_zones WHERE is_active = 1 ORDER BY zone_id`
  );
  res.json(rows.map((r) => ({ ...r, fee: Number(r.fee) })));
}));

// GET /api/slots?date=YYYY-MM-DD
// A window is open while (orders in it) < (kitchen capacity) and it is not too soon.
router.get('/slots', asyncHandler(async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : '';
  const problem = validateOrderDate(date);
  if (problem) throw new HttpError(400, problem);

  const [[kitchen]] = await db.query('SELECT orders_per_slot AS capacity FROM kitchen_settings WHERE setting_id = 1');
  const capacity = kitchen ? Number(kitchen.capacity) : 0;
  const [taken] = await db.query(
    `SELECT TIME_FORMAT(slot_time, '%H:%i') AS time, COUNT(*) AS n
     FROM orders WHERE order_date = ? AND status <> 'Cancelled' GROUP BY slot_time`,
    [date]
  );
  const used = new Map(taken.map((t) => [t.time, Number(t.n)]));
  res.json({
    date,
    slots: config.SLOTS.map((time) => ({
      time,
      available: (used.get(time) || 0) < capacity && !isSlotInPast(date, time),
    })),
  });
}));

module.exports = router;
