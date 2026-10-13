// server/routes/auth.js
// POST /api/auth/login — staff sign-in. Passwords are verified against a
// bcrypt hash; on success the server issues a signed, expiring JWT.

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { HttpError, asyncHandler } = require('../middleware/errors');

const router = express.Router();

// A throwaway hash, so a login for an unknown username takes about as long
// as one for a real username (prevents username enumeration by timing).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

router.post('/login', asyncHandler(async (req, res) => {
  const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!username || !password) throw new HttpError(400, 'Enter your username and password.');

  const [rows] = await db.query(
    'SELECT staff_id, username, password_hash FROM staff WHERE username = ?', [username]
  );
  const staff = rows[0];
  const ok = await bcrypt.compare(password, staff ? staff.password_hash : DUMMY_HASH);
  if (!staff || !ok) throw new HttpError(401, 'Incorrect username or password.');

  const token = jwt.sign(
    { sub: staff.staff_id, username: staff.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
  res.json({ token, username: staff.username });
}));

module.exports = router;
