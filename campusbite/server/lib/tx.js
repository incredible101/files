// server/lib/tx.js — shared database helpers.
const db = require('../db');

// Runs fn(conn) inside a transaction; commits on success, rolls back on error.
async function withTransaction(fn) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Finds a customer by phone number or creates them; returns customer_id.
// ON DUPLICATE KEY keeps the first name on record and only fills in missing
// optional fields, so a stranger can't overwrite someone else's details.
async function findOrCreateCustomer(conn, { name, phone, email, studentNo }) {
  const [result] = await conn.query(
    `INSERT INTO customers (full_name, phone, email, student_no) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE email = COALESCE(email, VALUES(email)),
                             student_no = COALESCE(student_no, VALUES(student_no)),
                             customer_id = LAST_INSERT_ID(customer_id)`,
    [name, phone, email, studentNo]
  );
  return result.insertId;
}

module.exports = { withTransaction, findOrCreateCustomer };
