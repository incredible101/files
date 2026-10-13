// server/routes/orders.js
// Food orders. Placing one is public; viewing and progressing them is
// staff-only.
//
// SECURITY: the browser only says WHICH items, HOW MANY, WHERE and WHEN.
// Prices and delivery fees come from the database and totals are calculated
// here, so a customer cannot change what they pay by editing the page.

const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const requireAuth = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../middleware/errors');
const { validateOrder, validateOrderItems, requiresAddress, todayInZone } = require('../validators');
const { toCents, toRand, computeTotals } = require('../pricing');
const { withTransaction, findOrCreateCustomer } = require('../lib/tx');

const router = express.Router();

const STATUSES = ['Placed', 'Preparing', 'Ready', 'Delivered', 'Cancelled'];
const TRANSITIONS = {
  Placed: ['Preparing', 'Cancelled'],
  Preparing: ['Ready', 'Cancelled'],
  Ready: ['Delivered', 'Cancelled'],
  Delivered: [],
  Cancelled: [],
};

const money = (cents) => (cents / 100).toFixed(2);

function generateOrderRef() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `CB-${stamp}-${rand}`;
}

// POST /api/orders — public
router.post('/', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const order = validateOrder(body);
  const items = validateOrderItems(body.items);
  const errors = [...order.errors, ...items.errors];
  if (errors.length) throw new HttpError(400, errors[0]);
  const o = order.value;

  const [[zone]] = await db.query(
    'SELECT zone_id, area_type, delivery_fee FROM delivery_zones WHERE zone_id = ? AND is_active = 1', [o.zoneId]
  );
  if (!zone) throw new HttpError(400, 'That delivery area is not available.');
  if (requiresAddress(zone.area_type) && (!o.address || o.address.length < 5)) {
    throw new HttpError(400, 'Enter your residence, room or street address for delivery.');
  }
  const address = requiresAddress(zone.area_type) ? o.address : null;

  // Look up the real, current prices and check everything is on sale.
  const ids = items.value.map((i) => i.itemId);
  const [menu] = await db.query(
    'SELECT item_id, name, price, is_available FROM menu_items WHERE is_active = 1 AND item_id IN (?)', [ids]
  );
  const byId = new Map(menu.map((m) => [m.item_id, m]));
  const missing = items.value.find((i) => !byId.has(i.itemId));
  if (missing) throw new HttpError(400, 'An item in your cart is no longer on the menu.');
  const soldOut = menu.find((m) => !m.is_available);
  if (soldOut) throw new HttpError(409, `Sorry, ${soldOut.name} is sold out. Please remove it from your cart.`);

  const lines = items.value.map((i) => ({
    itemId: i.itemId, quantity: i.quantity, unitPriceCents: toCents(byId.get(i.itemId).price),
  }));
  const totals = computeTotals(lines, toCents(zone.delivery_fee));
  const orderRef = generateOrderRef();

  await withTransaction(async (conn) => {
    // Locking the single kitchen row makes concurrent orders take turns, so
    // two customers cannot both take the last place in an hourly window.
    const [[kitchen]] = await conn.query(
      'SELECT orders_per_slot AS capacity FROM kitchen_settings WHERE setting_id = 1 FOR UPDATE'
    );
    if (!kitchen) throw new HttpError(503, 'Ordering is unavailable right now.');
    const [[{ taken }]] = await conn.query(
      `SELECT COUNT(*) AS taken FROM orders
       WHERE order_date = ? AND slot_time = ? AND status <> 'Cancelled'`,
      [o.date, o.slot]
    );
    if (Number(taken) >= Number(kitchen.capacity)) {
      throw new HttpError(409, 'That time window just filled up. Please choose another.');
    }

    const customerId = await findOrCreateCustomer(conn, o);
    const [inserted] = await conn.query(
      `INSERT INTO orders (order_ref, customer_id, zone_id, delivery_address, order_date, slot_time,
                           subtotal, delivery_fee, total, vat_included, payment_method, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Placed')`,
      [orderRef, customerId, zone.zone_id, address, o.date, o.slot,
        money(totals.subtotal), money(totals.deliveryFee), money(totals.total), money(totals.vatIncluded),
        o.paymentMethod, o.notes]
    );
    await conn.query(
      'INSERT INTO order_items (order_id, item_id, quantity, unit_price) VALUES ?',
      [lines.map((l) => [inserted.insertId, l.itemId, l.quantity, money(l.unitPriceCents)])]
    );
  });

  res.status(201).json({
    orderRef, date: o.date, slot: o.slot, fulfilment: zone.area_type === 'Collection' ? 'Collection' : 'Delivery',
    subtotal: toRand(totals.subtotal), deliveryFee: toRand(totals.deliveryFee),
    total: toRand(totals.total), vatIncluded: toRand(totals.vatIncluded),
  });
}));

// GET /api/orders/stats — staff (today's figures)
router.get('/stats', requireAuth, asyncHandler(async (req, res) => {
  const [[r]] = await db.query(
    `SELECT COALESCE(SUM(status <> 'Cancelled'), 0) AS orders,
            COALESCE(SUM(status = 'Placed'), 0)     AS placed,
            COALESCE(SUM(status = 'Preparing'), 0)  AS preparing,
            COALESCE(SUM(CASE WHEN status <> 'Cancelled' THEN total ELSE 0 END), 0) AS revenue
     FROM orders WHERE order_date = ?`,
    [todayInZone()]
  );
  res.json({
    orders: Number(r.orders), placed: Number(r.placed), preparing: Number(r.preparing), revenue: Number(r.revenue),
  });
}));

// GET /api/orders?date=YYYY-MM-DD&status=Placed — staff
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { date, status } = req.query;
  if (status !== undefined && status !== '' && !STATUSES.includes(status)) throw new HttpError(400, 'Unknown status.');
  if (date !== undefined && date !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'Invalid date.');

  const where = []; const params = [];
  if (date) { where.push('o.order_date = ?'); params.push(date); }
  if (status) { where.push('o.status = ?'); params.push(status); }

  const [orders] = await db.query(
    `SELECT o.order_id AS id, o.order_ref AS ref, c.full_name AS customerName, c.phone, c.student_no AS studentNo,
            z.name AS zone, z.area_type AS areaType, o.delivery_address AS address,
            o.order_date AS date, TIME_FORMAT(o.slot_time, '%H:%i') AS slot,
            o.subtotal, o.delivery_fee AS deliveryFee, o.total, o.vat_included AS vatIncluded,
            o.payment_method AS paymentMethod, o.notes, o.status, o.created_at AS createdAt
     FROM orders o
     JOIN customers c ON c.customer_id = o.customer_id
     JOIN delivery_zones z ON z.zone_id = o.zone_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY o.order_date, o.slot_time, o.order_id`,
    params
  );
  let items = [];
  if (orders.length) {
    [items] = await db.query(
      `SELECT oi.order_id AS orderId, m.name, oi.quantity, oi.unit_price AS unitPrice
       FROM order_items oi JOIN menu_items m ON m.item_id = oi.item_id
       WHERE oi.order_id IN (?) ORDER BY m.name`,
      [orders.map((o) => o.id)]
    );
  }
  res.json(orders.map((o) => ({
    ...o,
    subtotal: Number(o.subtotal), deliveryFee: Number(o.deliveryFee),
    total: Number(o.total), vatIncluded: Number(o.vatIncluded),
    items: items.filter((i) => i.orderId === o.id).map((i) => ({
      name: i.name, quantity: i.quantity, unitPrice: Number(i.unitPrice),
    })),
  })));
}));

// PATCH /api/orders/:id — staff. Body: { status }
router.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Invalid order.');
  if (!STATUSES.includes(status)) throw new HttpError(400, 'Invalid status.');

  await withTransaction(async (conn) => {
    const [[current]] = await conn.query('SELECT status FROM orders WHERE order_id = ? FOR UPDATE', [id]);
    if (!current) throw new HttpError(404, 'Order not found.');
    if (!TRANSITIONS[current.status].includes(status)) {
      throw new HttpError(409, `A ${current.status.toLowerCase()} order cannot become ${status.toLowerCase()}.`);
    }
    await conn.query('UPDATE orders SET status = ? WHERE order_id = ?', [status, id]);
  });
  res.json({ id, status });
}));

module.exports = router;
