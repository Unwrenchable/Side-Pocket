'use strict';
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const DB_JSON = process.env.DATABASE_PATH || path.join(process.cwd(), 'server', 'data', 'db.json');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

function readDb() {
  try {
    if (!fs.existsSync(DB_JSON)) return { users: [], orders: [], nextUserId: 1, nextOrderId: 1 };
    return JSON.parse(fs.readFileSync(DB_JSON, 'utf8') || '{}');
  } catch { return { users: [], orders: [], nextUserId: 1, nextOrderId: 1 }; }
}
function writeDb(db) { fs.writeFileSync(DB_JSON, JSON.stringify(db, null, 2)); }

module.exports = (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const rawCookie = (req.headers.cookie || '').split(';').find(c => c.trim().startsWith('token='));
  const token = rawCookie ? rawCookie.split('=')[1].trim() : (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  let payload;
  try { payload = jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ error: 'Invalid token' }); }
  const { items, amount_cents } = req.body || {};
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Invalid items' });
  try {
    const db = readDb();
    const id = db.nextOrderId++;
    const order = { id, user_id: payload.id, items, amount_cents: amount_cents || 0, currency: 'usd', status: 'created', created_at: new Date().toISOString() };
    db.orders.push(order); writeDb(db);
    res.json({ ok: true, orderId: order.id });
  } catch { res.status(500).json({ error: 'Could not create order' }); }
};
