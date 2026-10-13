// server/config.js
// Business rules in ONE place. The browser reads these through
// GET /api/config, so the server and the website can never disagree.

module.exports = {
  TIMEZONE: 'Africa/Johannesburg',

  // Hourly order windows (start times, 24h). The kitchen accepts at most
  // kitchen_settings.orders_per_slot orders for each window.
  SLOTS: ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
    '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],

  // 0 = Sunday ... 6 = Saturday. Empty = open every day.
  CLOSED_WEEKDAYS: [],

  // Students order for today or the next two days.
  MAX_ADVANCE_DAYS: 2,

  // A window can only be chosen if it starts at least this many minutes
  // from now (the kitchen needs preparation and travel time).
  LEAD_MINUTES: 45,

  // Money rules (amounts in rand). Menu prices already INCLUDE 15% VAT,
  // as is usual for food sold to the public.
  VAT_RATE: 0.15,
  FREE_DELIVERY_THRESHOLD: 150,
  MAX_LINE_QUANTITY: 10,
  MAX_ORDER_LINES: 30,

  PAYMENT_METHODS: ['Cash', 'Card', 'EFT'], // paid on delivery/collection
};
