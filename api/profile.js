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
    if (!fs.existsSync(DB_JSON)) return { users: [] };
    return JSON.parse(fs.readFileSync(DB_JSON, 'utf8') || '{}');
  } catch { return { users: [] }; }
}

module.exports = (req, res) => {
  const rawCookie = (req.headers.cookie || '').split(';').find(c => c.trim().startsWith('token='));
  const token = rawCookie ? rawCookie.split('=')[1].trim() : (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = readDb().users.find(u => u.id === payload.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: { id: user.id, email: user.email, name: user.name, created_at: user.created_at } });
  } catch { res.status(401).json({ error: 'Invalid token' }); }
};
