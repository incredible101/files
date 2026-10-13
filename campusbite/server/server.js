// server/server.js
// One Express app: JSON API under /api, static website from /public.

require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const db = require('./db');
const { errorHandler } = require('./middleware/errors');

const PLACEHOLDER_SECRETS = ['', 'replace-this-with-a-long-random-string'];
if (PLACEHOLDER_SECRETS.includes(process.env.JWT_SECRET || '') || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET is missing, still the placeholder, or shorter than 32 characters.');
  console.error('Generate one:  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Behind a hosting platform's proxy, trust it so rate limiting sees the
// real client address instead of the proxy's.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
}));
app.use(express.json({ limit: '20kb' }));

// Rate limits: tight on login (brute-force protection), looser elsewhere.
const limiter = (max) => rateLimit({ windowMs: 15 * 60 * 1000, max, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth', limiter(20));
app.use('/api', limiter(600));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin/menu', require('./routes/menu'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api', require('./routes/catalogue'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(errorHandler);

db.init()
  .then(() => {
    app.listen(PORT, () => console.log(`CampusBite running at http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Could not set up the database:', err.message);
    console.error('Is MySQL running, and do DB_HOST / DB_USER / DB_PASSWORD in .env match it?');
    process.exit(1);
  });
