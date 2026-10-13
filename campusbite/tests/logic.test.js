// Run with:  npm test      (Node's built-in test runner; no extra packages)
const test = require('node:test');
const assert = require('node:assert/strict');

const { computeTotals, toCents } = require('../server/pricing');
const {
  normalisePhone, validateOrder, validateOrderDate, isSlotInPast, validateOrderItems, requiresAddress,
} = require('../server/validators');

// A fixed "now": Monday 12 Oct 2026, 10:30 in Mahikeng (08:30 UTC).
const NOW = new Date('2026-10-12T08:30:00Z');

const goodOrder = {
  customerName: 'Naledi Mokoena', phone: '082 123 4567', email: '', studentNo: '',
  zoneId: 1, address: 'Block B, Room 214', date: '2026-10-12', slot: '12:00',
  paymentMethod: 'Cash', notes: '', items: [{ itemId: 1, quantity: 2 }],
};

// ---------- pricing ----------
test('toCents avoids floating-point drift', () => {
  assert.equal(toCents(0.1) + toCents(0.2), toCents(0.3));
  assert.equal(toCents('45.00'), 4500);
});

test('delivery fee is added below the free-delivery threshold; VAT is extracted', () => {
  const t = computeTotals([{ unitPriceCents: 4500, quantity: 2 }], 1000); // R90 + R10
  assert.deepEqual(t, { subtotal: 9000, deliveryFee: 1000, total: 10000, vatIncluded: 1304 });
});

test('delivery is free at R150 or more', () => {
  const t = computeTotals([{ unitPriceCents: 5000, quantity: 3 }], 3000); // exactly R150
  assert.equal(t.deliveryFee, 0);
  assert.equal(t.total, 15000);
});

test('collection (zone fee 0) never charges delivery', () => {
  assert.equal(computeTotals([{ unitPriceCents: 2500, quantity: 1 }], 0).total, 2500);
});

test('empty cart costs nothing', () => {
  assert.deepEqual(computeTotals([], 1000), { subtotal: 0, deliveryFee: 0, total: 0, vatIncluded: 0 });
});

// ---------- phone numbers ----------
test('phone numbers are normalised to local format', () => {
  assert.equal(normalisePhone('082 123 4567'), '0821234567');
  assert.equal(normalisePhone('+27821234567'), '0821234567');
});

test('invalid phone numbers are rejected', () => {
  assert.equal(normalisePhone('12345'), null);
  assert.equal(normalisePhone(undefined), null);
});

// ---------- dates and windows ----------
test('a valid order passes and is normalised', () => {
  const { errors, value } = validateOrder(goodOrder, NOW);
  assert.deepEqual(errors, []);
  assert.equal(value.phone, '0821234567');
  assert.equal(value.email, null);
  assert.equal(value.studentNo, null);
});

test('past dates and dates more than two days ahead are refused', () => {
  assert.ok(validateOrderDate('2026-10-11', NOW));
  assert.ok(validateOrderDate('2026-10-15', NOW));
  assert.equal(validateOrderDate('2026-10-14', NOW), null);
});

test('impossible dates are refused', () => {
  assert.ok(validateOrderDate('2026-02-30', NOW));
  assert.ok(validateOrderDate('soon', NOW));
});

test('a window needs 45 minutes of notice today', () => {
  assert.equal(isSlotInPast('2026-10-12', '10:00', NOW), true);  // already started
  assert.equal(isSlotInPast('2026-10-12', '11:00', NOW), true);  // only 30 min away
  assert.equal(isSlotInPast('2026-10-12', '12:00', NOW), false);
  assert.equal(isSlotInPast('2026-10-13', '07:00', NOW), false); // tomorrow is fine
});

test('times outside the window list are refused', () => {
  assert.ok(validateOrder({ ...goodOrder, slot: '03:00' }, NOW).errors.length > 0);
});

test('student number, email, payment method and notes are checked', () => {
  assert.ok(validateOrder({ ...goodOrder, studentNo: 'abc' }, NOW).errors.length > 0);
  assert.deepEqual(validateOrder({ ...goodOrder, studentNo: '12345678' }, NOW).errors, []);
  assert.ok(validateOrder({ ...goodOrder, email: 'nope' }, NOW).errors.length > 0);
  assert.ok(validateOrder({ ...goodOrder, paymentMethod: 'Bitcoin' }, NOW).errors.length > 0);
  assert.ok(validateOrder({ ...goodOrder, notes: 'x'.repeat(201) }, NOW).errors.length > 0);
  assert.ok(validateOrder({ ...goodOrder, customerName: '' }, NOW).errors.length > 0);
});

test('only collection orders can skip the address', () => {
  assert.equal(requiresAddress('On-campus'), true);
  assert.equal(requiresAddress('Off-campus'), true);
  assert.equal(requiresAddress('Collection'), false);
});

// ---------- cart ----------
test('cart items are merged, bounded and validated', () => {
  const merged = validateOrderItems([{ itemId: 1, quantity: 2 }, { itemId: 1, quantity: 3 }, { itemId: 2, quantity: 1 }]);
  assert.deepEqual(merged.value, [{ itemId: 1, quantity: 5 }, { itemId: 2, quantity: 1 }]);
  assert.ok(validateOrderItems([]).errors.length > 0);
  assert.ok(validateOrderItems([{ itemId: 1, quantity: 0 }]).errors.length > 0);
  assert.ok(validateOrderItems([{ itemId: 1, quantity: 99 }]).errors.length > 0);
  assert.ok(validateOrderItems([{ itemId: 'x', quantity: 1 }]).errors.length > 0);
});
