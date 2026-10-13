// server/db.js
// MySQL / MariaDB access. The database structure is NOT written here: it
// lives in database/schema.sql (and reference rows in database/data.sql),
// which init() executes. One definition of the schema, no drift.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DB_NAME = process.env.DB_NAME || 'campusbite';
if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) {
  throw new Error('DB_NAME may only contain letters, numbers and underscores.');
}

const connection = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};

let pool = null;

// Reads an .sql file and drops the CREATE DATABASE / USE lines, because
// init() selects the database named in .env instead.
function readSql(file) {
  return fs
    .readFileSync(path.join(__dirname, '..', 'database', file), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(CREATE DATABASE|USE)\b/i.test(line) && !/^\s+CHARACTER SET utf8mb4 COLLATE/i.test(line))
    .join('\n');
}

async function init() {
  // 1. Make sure the database exists (needs a connection without a database).
  const boot = await mysql.createConnection({ ...connection, charset: 'utf8mb4', multipleStatements: true });
  try {
    await boot.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    // 2. Create tables, then load reference rows. Both files are idempotent.
    await boot.query(`USE \`${DB_NAME}\``);
    await boot.query(readSql('schema.sql'));
    await boot.query(readSql('data.sql'));
  } finally {
    await boot.end();
  }

  // 3. The pool used by the application does NOT allow multiple statements,
  //    which limits the damage of any injection bug.
  pool = mysql.createPool({
    ...connection,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true, // DATE/TIMESTAMP come back as plain strings (no timezone surprises)
    charset: 'utf8mb4',
  });
  return pool;
}

function getPool() {
  if (!pool) throw new Error('Database not initialised — call init() first.');
  return pool;
}

module.exports = {
  init,
  query: (...args) => getPool().query(...args),
  getConnection: () => getPool().getConnection(),
  end: async () => { if (pool) await pool.end(); },
};
