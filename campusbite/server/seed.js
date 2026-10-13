// server/seed.js
// Creates (or resets the password of) the staff account from .env:
//   npm run seed
// The plain-text password is read here, hashed with bcrypt, and never stored.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

async function main() {
  const username = (process.env.STAFF_USERNAME || '').trim();
  const password = process.env.STAFF_PASSWORD || '';

  if (!username || !password) {
    throw new Error('Set STAFF_USERNAME and STAFF_PASSWORD in .env first.');
  }
  if (password.length < 8 || password === 'change-this-password') {
    throw new Error('STAFF_PASSWORD must be at least 8 characters and not the placeholder.');
  }

  await db.init(); // creates the database, tables and reference data if needed
  const hash = await bcrypt.hash(password, 10);

  const [result] = await db.query(
    `INSERT INTO staff (username, password_hash) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    [username, hash]
  );
  console.log(result.affectedRows === 1
    ? `Created staff account "${username}".`
    : `Updated the password for staff account "${username}".`);
  console.log('Log in at http://localhost:' + (process.env.PORT || 3000) + '/admin.html');
}

main()
  .then(() => db.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });
