// server/routes/menu.js — staff-only menu control (mark items sold out).
const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/auth');
const { HttpError, asyncHandler } = require('../middleware/errors');

const router = express.Router();
router.use(requireAuth);

// GET /api/admin/menu
router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT m.item_id AS id, m.name, c.name AS category, m.price, m.is_available AS available
     FROM menu_items m JOIN menu_categories c ON c.category_id = m.category_id
     WHERE m.is_active = 1 ORDER BY c.category_id, m.item_id`
  );
  res.json(rows.map((r) => ({ ...r, price: Number(r.price), available: Boolean(r.available) })));
}));

// PATCH /api/admin/menu/:id  Body: { available: true|false }
router.patch('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { available } = req.body || {};
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Invalid item.');
  if (typeof available !== 'boolean') throw new HttpError(400, 'Say whether the item is available.');
  const [result] = await db.query('UPDATE menu_items SET is_available = ? WHERE item_id = ? AND is_active = 1', [available ? 1 : 0, id]);
  if (result.affectedRows === 0) throw new HttpError(404, 'Item not found.');
  res.json({ id, available });
}));

module.exports = router;
