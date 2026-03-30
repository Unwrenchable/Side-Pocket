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
    if (!fs.existsSync(DB_JSON)) return { users: [], orders: [], nextUserId: 1, nextOrderId: 1 };
    return JSON.parse(fs.readFileSync(DB_JSON, 'utf8') || '{}');
  } catch { return { users: [], orders: [], nextUserId: 1, nextOrderId: 1 }; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const user = readDb().users.find(u => u.email === email);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.setHeader('Set-Cookie', `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
    res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
};
