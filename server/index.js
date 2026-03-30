'use strict';
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

dotenv.config();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET must be set in production');
  process.exit(1);
}
const DB_JSON = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'db.json');
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
let stripe = null;
if (STRIPE_SECRET_KEY) stripe = require('stripe')(STRIPE_SECRET_KEY);

const dataDir = path.dirname(DB_JSON);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// ── DB helpers ─────────────────────────────────────────────
function readDb() {
  try {
    if (!fs.existsSync(DB_JSON)) {
      const init = { users: [], orders: [], nextUserId: 1, nextOrderId: 1 };
      fs.writeFileSync(DB_JSON, JSON.stringify(init, null, 2));
      return init;
    }
    return JSON.parse(fs.readFileSync(DB_JSON, 'utf8') || '{}');
  } catch (e) {
    return { users: [], orders: [], nextUserId: 1, nextOrderId: 1 };
  }
}
function writeDb(db) { fs.writeFileSync(DB_JSON, JSON.stringify(db, null, 2)); }
function findUserByEmail(email) { return readDb().users.find(u => u.email === email); }
function findUserById(id) { return readDb().users.find(u => u.id === id); }
function updateUser(user) {
  const db = readDb();
  const i = db.users.findIndex(u => u.id === user.id);
  if (i === -1) return false;
  db.users[i] = user; writeDb(db); return true;
}
function createUser({ email, passwordHash, name }) {
  const db = readDb();
  if (db.users.find(u => u.email === email)) throw new Error('exists');
  const id = db.nextUserId++;
  const user = { id, email, password: passwordHash, name: name || null, created_at: new Date().toISOString() };
  db.users.push(user); writeDb(db); return user;
}
function createOrder({ user_id, items, amount_cents }) {
  const db = readDb();
  const id = db.nextOrderId++;
  const order = { id, user_id, items, amount_cents: amount_cents || 0, currency: 'usd', status: 'created', created_at: new Date().toISOString() };
  db.orders.push(order); writeDb(db); return order;
}
function updateOrder(order) {
  const db = readDb();
  const i = db.orders.findIndex(o => o.id === order.id);
  if (i === -1) return false;
  db.orders[i] = order; writeDb(db); return true;
}

// ── Email helper ───────────────────────────────────────────
async function sendEmail({ to, subject, text, html }) {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    const t = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await t.sendMail({ from: process.env.FROM_EMAIL || process.env.SMTP_USER, to, subject, text, html });
  } else {
    console.log('--- dev email ---', { to, subject, text });
  }
}

function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Express app ────────────────────────────────────────────
const app = express();

app.use((req, res, next) => {
  console.log(req.method, req.url);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' https://js.stripe.com 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "img-src 'self' data: https: http:; font-src 'self' https://fonts.gstatic.com; " +
    "connect-src 'self' https://api.stripe.com; frame-src https://js.stripe.com; " +
    "object-src 'none'; base-uri 'self'; form-action 'self'");
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

// ── CSRF protection ────────────────────────────────────────
// All state-changing requests must include the X-Requested-With header.
// Cross-origin form/script submissions cannot set this header without a
// CORS preflight, providing effective CSRF protection for JSON APIs.
function csrfCheck(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const hdr = req.headers['x-requested-with'];
  if (!hdr) return res.status(403).json({ error: 'CSRF check failed: missing X-Requested-With header' });
  return next();
}
app.use(csrfCheck);

// ── Rate limiters ──────────────────────────────────────────
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const newsletterLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false });
app.use('/api/register', authLimiter);
app.use('/api/login', authLimiter);
app.use('/api/newsletter', newsletterLimiter);
app.use('/api/', apiLimiter);
const pageViewLimiter = rateLimit({ windowMs: 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });

function signToken(p) { return jwt.sign(p, JWT_SECRET, { expiresIn: '30d' }); }

function authMiddleware(req, res, next) {
  const token = (req.cookies && req.cookies.token) || (req.headers.authorization && req.headers.authorization.replace('Bearer ', ''));
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try { req.user = jwt.verify(token, JWT_SECRET); return next(); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }
}

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.admin_token;
  if (!token || token !== process.env.ADMIN_TOKEN) return res.status(403).json({ error: 'Forbidden' });
  next();
}

// ── Auth endpoints ─────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email format' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    const user = createUser({ email, passwordHash: hashed, name });
    try {
      const verifyToken = crypto.randomBytes(20).toString('hex');
      user.verifyToken = verifyToken;
      user.verifyExpires = Date.now() + 86400000;
      updateUser(user);
      const origin = req.headers.origin || (req.protocol + '://' + req.get('host'));
      const verifyUrl = `${origin}/verify.html?token=${verifyToken}`;
      await sendEmail({ to: user.email, subject: 'Verify your Side Pocket account',
        text: `Verify: ${verifyUrl}`, html: `<p>Click to verify: <a href="${verifyUrl}">${verifyUrl}</a></p>` });
    } catch (e) { console.warn('verify email failed', e && e.message); }
    const token = signToken({ id: user.id, email });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 2592000000 });
    res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    if (err.message === 'exists') return res.status(400).json({ error: 'Email already exists' });
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const user = findUserByEmail(email);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });
    const token = signToken({ id: user.id, email: user.email });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 2592000000 });
    res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) { console.error('Login error:', err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });

app.get('/api/profile', authMiddleware, (req, res) => {
  const row = findUserById(req.user.id);
  if (!row) return res.status(404).json({ error: 'User not found' });
  res.json({ user: { id: row.id, email: row.email, name: row.name, created_at: row.created_at } });
});

// ── Products ───────────────────────────────────────────────
app.get('/api/products', (req, res) => {
  try {
    // First try server/data/products.json, then root products.json
    let p = path.join(dataDir, 'products.json');
    if (!fs.existsSync(p)) p = path.join(__dirname, '..', 'products.json');
    if (!fs.existsSync(p)) return res.json({ products: [] });
    return res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
  } catch (e) { res.status(500).json({ error: 'Could not read products' }); }
});

// ── Instagram ──────────────────────────────────────────────
app.get('/api/instagram', async (req, res) => {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;
  if (!token || !userId) return res.status(400).json({ error: 'Instagram not configured' });
  try {
    const url = `https://graph.instagram.com/${userId}/media?fields=id,caption,media_url,permalink,thumbnail_url,media_type&access_token=${token}`;
    const r = await axios.get(url);
    res.json({ data: (r.data && r.data.data) || [] });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch Instagram' }); }
});

// ── Newsletter ─────────────────────────────────────────────
app.post('/api/newsletter', async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Valid email required' });
  const nlPath = path.join(dataDir, 'newsletter.json');
  let db = { subscribers: [] };
  try { db = JSON.parse(fs.readFileSync(nlPath, 'utf8')); } catch {}
  if (db.subscribers.find(s => s.email === email))
    return res.status(200).json({ ok: true, message: 'Already subscribed' });
  db.subscribers.push({ email, subscribed_at: new Date().toISOString() });
  try { fs.writeFileSync(nlPath, JSON.stringify(db, null, 2)); } catch (e) { console.warn('newsletter write failed', e.message); }
  try {
    await sendEmail({ to: email, subject: 'Welcome to Side Pocket Apparel!',
      text: 'Thanks for subscribing! Get early access to new drops and exclusive deals.',
      html: '<p>Thanks for subscribing to <b>Side Pocket Apparel</b>! Stay tuned for new drops.</p>' });
  } catch (e) { console.warn('newsletter email failed', e.message); }
  res.json({ ok: true });
});

// ── Stripe Checkout ────────────────────────────────────────
app.post('/api/stripe/create-checkout', authMiddleware, async (req, res) => {
  if (!stripe) return res.status(400).json({ error: 'Stripe not configured' });
  const { items } = req.body;
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Invalid items' });
  try {
    const lineItems = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: { name: item.name },
        unit_amount: Math.round(item.price * 100)
      },
      quantity: item.qty || 1
    }));
    const origin = req.headers.origin || (req.protocol + '://' + req.get('host'));
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${origin}/order-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/shop.html`
    });
    res.json({ url: session.url });
  } catch (e) { console.error('Stripe error', e.message); res.status(500).json({ error: 'Checkout failed' }); }
});

app.post('/api/create-order', authMiddleware, (req, res) => {
  const { items, amount_cents } = req.body;
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Invalid items' });
  try {
    const order = createOrder({ user_id: req.user.id, items, amount_cents });
    res.json({ ok: true, orderId: order.id });
  } catch (e) { res.status(500).json({ error: 'Could not create order' }); }
});

// ── Public config ──────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    instagramConfigured: !!(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_USER_ID)
  });
});

// ── Admin ──────────────────────────────────────────────────
app.get('/api/admin/orders', adminAuth, (req, res) => {
  try { res.json({ orders: readDb().orders || [] }); }
  catch { res.status(500).json({ error: 'Could not read orders' }); }
});

app.get('/api/admin/users', adminAuth, (req, res) => {
  try {
    const users = (readDb().users || []).map(u => ({ id: u.id, email: u.email, name: u.name, created_at: u.created_at }));
    res.json({ users });
  } catch { res.status(500).json({ error: 'Could not read users' }); }
});

app.get('/api/admin/newsletter', adminAuth, (req, res) => {
  try {
    const nlPath = path.join(dataDir, 'newsletter.json');
    const db = fs.existsSync(nlPath) ? JSON.parse(fs.readFileSync(nlPath, 'utf8')) : { subscribers: [] };
    res.json(db);
  } catch { res.status(500).json({ error: 'Could not read newsletter list' }); }
});

app.post('/api/admin/save-products', adminAuth, (req, res) => {
  const products = req.body && Array.isArray(req.body.products) ? req.body.products : null;
  if (!products) return res.status(400).json({ error: 'Expected { products: [] }' });
  try {
    const p = path.join(dataDir, 'products.json');
    fs.writeFileSync(p, JSON.stringify({ products }, null, 2));
    res.json({ ok: true, count: products.length });
  } catch { res.status(500).json({ error: 'Could not save products' }); }
});

app.post('/api/admin/sync-instagram', adminAuth, async (req, res) => {
  const userId = process.env.INSTAGRAM_USER_ID;
  if (!token || !userId) return res.status(400).json({ error: 'Instagram not configured' });
  try {
    const url = `https://graph.instagram.com/${userId}/media?fields=id,caption,media_url,permalink,thumbnail_url,media_type&access_token=${token}`;
    const r = await axios.get(url);
    const media = (r.data && r.data.data) || [];
    const products = media.filter(m => m.media_type === 'IMAGE').map(m => {
      const caption = (m.caption || '').trim();
      let title = caption.split('\n')[0] || `Instagram ${m.id}`;
      const priceMatch = caption.match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)/);
      return {
        id: `ig_${m.id}`, sku: `ig_${m.id}`, name: title,
        description: caption, price: priceMatch ? parseFloat(priceMatch[1]) : 0,
        published: true, image: m.media_url || null, source: 'instagram'
      };
    });
    const p = path.join(dataDir, 'products.json');
    fs.writeFileSync(p, JSON.stringify({ products }, null, 2));
    res.json({ ok: true, count: products.length });
  } catch (e) { res.status(500).json({ error: 'Could not sync Instagram' }); }
});

// ── Product detail page (SEO) ──────────────────────────────
app.get('/product/:id', pageViewLimiter, (req, res) => {
  try {
    let p = path.join(dataDir, 'products.json');
    if (!fs.existsSync(p)) p = path.join(__dirname, '..', 'products.json');
    if (!fs.existsSync(p)) return res.status(404).send('Not found');
    const all = JSON.parse(fs.readFileSync(p, 'utf8'));
    const prod = (all.products || []).find(x => String(x.id) === String(req.params.id) || String(x.sku) === String(req.params.id));
    if (!prod) return res.status(404).send('Product not found');
    const siteUrl = req.protocol + '://' + req.get('host');
    const url = `${siteUrl}/product/${req.params.id}`;
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!doctype html><html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(prod.name)} | Side Pocket Apparel</title>
<meta name="description" content="${escapeHtml((prod.description||'').slice(0,160))}"/>
<meta property="og:title" content="${escapeHtml(prod.name)}"/>
<meta property="og:image" content="${escapeHtml(prod.image||'')}"/>
<meta property="og:url" content="${url}"/>
<meta name="twitter:card" content="summary_large_image"/>
<script>window.location="${siteUrl}/shop?product=${encodeURIComponent(prod.id)}"</script>
</head><body><p>Redirecting...</p></body></html>`);
  } catch (e) { res.status(500).send('Server error'); }
});

// ── Static files ───────────────────────────────────────────
const rootDir = path.join(__dirname, '..');
app.use(express.static(rootDir));
app.get('*', pageViewLimiter, (req, res) => {
  const f = path.join(rootDir, 'index.html');
  if (fs.existsSync(f)) res.sendFile(f);
  else res.status(404).send('Not found');
});

app.listen(PORT, () => console.log(`Side Pocket server running on port ${PORT}`));
module.exports = app;
