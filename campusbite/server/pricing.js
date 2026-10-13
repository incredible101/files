// server/pricing.js
// Pure money logic, kept free of Express/MySQL so it can be unit-tested.
// All arithmetic is in whole cents (0.1 + 0.2 !== 0.3 in JavaScript).
// Menu prices are VAT-inclusive, so VAT is extracted, not added.

const config = require('./config');

const toCents = (rand) => Math.round(Number(rand) * 100);
const toRand = (cents) => cents / 100;

// lines: [{ unitPriceCents, quantity }]; zoneFeeCents: the zone's fee.
// Delivery is free once the food subtotal reaches the threshold.
function computeTotals(lines, zoneFeeCents, rules = config) {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  const free = subtotal === 0 || subtotal >= rules.FREE_DELIVERY_THRESHOLD * 100;
  const deliveryFee = free ? 0 : zoneFeeCents;
  const total = subtotal + deliveryFee;
  const vatIncluded = Math.round((total * rules.VAT_RATE) / (1 + rules.VAT_RATE));
  return { subtotal, deliveryFee, total, vatIncluded };
}

module.exports = { toCents, toRand, computeTotals };
