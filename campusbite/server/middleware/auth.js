// server/middleware/auth.js
// Guards staff-only routes. Expects "Authorization: Bearer <token>", where
// the token was issued by POST /api/auth/login.

const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please log in.' });

  try {
    req.staff = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Your session has expired — please log in again.' });
  }
}

module.exports = requireAuth;
