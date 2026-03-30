'use strict';
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const DB_JSON = process.env.DATABASE_PATH || path.join(process.cwd(), 'server', 'data', 'db.json');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

function readDb() {
  try {
    if (!fs.existsSync(DB_JSON)) {
      const init = { users: [], orders: [], nextUserId: 1, nextOrderId: 1 };
      const dir = path.dirname(DB_JSON);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(DB_JSON, JSON.stringify(init, null, 2));
      return init;
    }
    return JSON.parse(fs.readFileSync(DB_JSON, 'utf8') || '{}');
  } catch { return { users: [], orders: [], nextUserId: 1, nextOrderId: 1 }; }
}
function writeDb(db) { fs.writeFileSync(DB_JSON, JSON.stringify(db, null, 2)); }

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email format' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const db = readDb();
    if (db.users.find(u => u.email === email)) return res.status(400).json({ error: 'Email already exists' });
    const hashed = await bcrypt.hash(password, 10);
    const id = db.nextUserId++;
    const user = { id, email, password: hashed, name: name || null, created_at: new Date().toISOString() };
    db.users.push(user); writeDb(db);
    const token = jwt.sign({ id, email }, JWT_SECRET, { expiresIn: '30d' });
    res.setHeader('Set-Cookie', `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
    res.json({ ok: true, user: { id, email, name: user.name } });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
};
