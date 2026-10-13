// server/validators.js
// Input validation. Pure functions (the clock is injected) so they can be
// unit-tested. Every function returns { errors: string[], value }.

const config = require('./config');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(?:\+27|0)\d{9}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const clean = (s) => (typeof s === 'string' ? s.trim() : '');

// South African numbers: 0821234567 or +27821234567 -> stored as 0821234567
function normalisePhone(input) {
  const stripped = clean(input).replace(/[\s\-()]/g, '');
  if (!PHONE_RE.test(stripped)) return null;
  return stripped.startsWith('+27') ? '0' + stripped.slice(3) : stripped;
}

function todayInZone(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.TIMEZONE }).format(now); // YYYY-MM-DD
}

function timeInZone(now = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: config.TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now); // HH:MM
}

const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

function isRealDate(iso) {
  if (!DATE_RE.test(iso)) return false;
  const d = new Date(iso + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

const weekday = (iso) => new Date(iso + 'T00:00:00Z').getUTCDay();

function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// A date is orderable if it is real, not past, within range and not a closed day.
function validateOrderDate(date, now = new Date()) {
  if (!isRealDate(date)) return 'Choose a valid date.';
  const today = todayInZone(now);
  if (date < today) return 'That date has already passed.';
  if (date > addDays(today, config.MAX_ADVANCE_DAYS)) return 'You can only order up to two days ahead.';
  if (config.CLOSED_WEEKDAYS.includes(weekday(date))) return 'We are closed on that day.';
  return null;
}

// Is this hourly window still orderable (given lead time)?
function isSlotInPast(date, time, now = new Date()) {
  if (date !== todayInZone(now)) return false;
  return minutesOf(time) - minutesOf(timeInZone(now)) < config.LEAD_MINUTES;
}

// Validates the order form. The zone's address rule is applied by the route
// (it needs the zone from the database): see requiresAddress().
function validateOrder(body, now = new Date()) {
  const errors = [];
  const name = clean(body.customerName);
  const phone = normalisePhone(body.phone);
  const email = clean(body.email);
  const studentNo = clean(body.studentNo);
  const address = clean(body.address);
  const notes = clean(body.notes);
  const zoneId = Number(body.zoneId);
  const date = clean(body.date);
  const slot = clean(body.slot);
  const paymentMethod = clean(body.paymentMethod) || 'Cash';

  if (name.length < 2 || name.length > 100) errors.push('Enter your full name.');
  if (!phone) errors.push('Enter a valid South African phone number (e.g. 082 123 4567).');
  if (email && (!EMAIL_RE.test(email) || email.length > 150)) errors.push('Enter a valid email address.');
  if (studentNo && !/^\d{7,10}$/.test(studentNo)) errors.push('Student number must be 7 to 10 digits.');
  if (address.length > 200) errors.push('The address is too long.');
  if (notes.length > 200) errors.push('Notes must be 200 characters or fewer.');
  if (!Number.isInteger(zoneId) || zoneId < 1) errors.push('Choose where we should deliver.');
  if (!config.PAYMENT_METHODS.includes(paymentMethod)) errors.push('Choose a payment method.');

  const dateError = validateOrderDate(date, now);
  if (dateError) errors.push(dateError);
  if (!config.SLOTS.includes(slot)) {
    errors.push('Choose one of the available times.');
  } else if (!dateError && isSlotInPast(date, slot, now)) {
    errors.push('That time window is no longer available. Please choose a later one.');
  }

  return {
    errors,
    value: {
      name, phone, email: email || null, studentNo: studentNo || null,
      address: address || null, notes: notes || null, zoneId, date, slot, paymentMethod,
    },
  };
}

// Delivery zones need an address; collection does not.
const requiresAddress = (areaType) => areaType !== 'Collection';

// items: [{ itemId, quantity }] -> merged, validated list
function validateOrderItems(items) {
  const errors = [];
  if (!Array.isArray(items) || items.length === 0) return { errors: ['Your cart is empty.'], value: [] };
  if (items.length > config.MAX_ORDER_LINES) return { errors: ['Too many items in one order.'], value: [] };
  const merged = new Map();
  for (const item of items) {
    const itemId = Number(item && item.itemId);
    const quantity = Number(item && item.quantity);
    if (!Number.isInteger(itemId) || itemId < 1 ||
        !Number.isInteger(quantity) || quantity < 1 || quantity > config.MAX_LINE_QUANTITY) {
      errors.push('One of the cart items is invalid.');
      break;
    }
    merged.set(itemId, Math.min((merged.get(itemId) || 0) + quantity, config.MAX_LINE_QUANTITY));
  }
  return { errors, value: [...merged].map(([itemId, quantity]) => ({ itemId, quantity })) };
}

module.exports = {
  normalisePhone, todayInZone, timeInZone, isRealDate, addDays,
  validateOrderDate, isSlotInPast, validateOrder, requiresAddress, validateOrderItems,
};
