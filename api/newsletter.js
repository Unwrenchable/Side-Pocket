'use strict';
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Valid email required' });
  const nlPath = path.join(process.cwd(), 'server', 'data', 'newsletter.json');
  let db = { subscribers: [] };
  try {
    if (fs.existsSync(nlPath)) db = JSON.parse(fs.readFileSync(nlPath, 'utf8'));
  } catch {}
  if (db.subscribers.find(s => s.email === email))
    return res.status(200).json({ ok: true, message: 'Already subscribed' });
  db.subscribers.push({ email, subscribed_at: new Date().toISOString() });
  try {
    const dir = path.dirname(nlPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(nlPath, JSON.stringify(db, null, 2));
  } catch (e) { console.warn('newsletter write failed', e.message); }
  res.json({ ok: true });
};
