'use strict';
const fs = require('fs');
const path = require('path');

const DB_JSON = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'db.json');

function readDb() {
  try {
    if (!fs.existsSync(DB_JSON)) return { users: [], orders: [], nextUserId: 1, nextOrderId: 1 };
    return JSON.parse(fs.readFileSync(DB_JSON, 'utf8') || '{}');
  } catch { return { users: [], orders: [], nextUserId: 1, nextOrderId: 1 }; }
}
function writeDb(db) { fs.writeFileSync(DB_JSON, JSON.stringify(db, null, 2)); }

function createOrder({ user_id, items, amount_cents }) {
  const db = readDb();
  const id = db.nextOrderId++;
  const order = {
    id, user_id, items, amount_cents: amount_cents || 0,
    currency: 'usd', status: 'created', created_at: new Date().toISOString()
  };
  db.orders.push(order); writeDb(db); return order;
}

function getOrderById(id) { return readDb().orders.find(o => o.id === id) || null; }

function updateOrder(order) {
  const db = readDb();
  const i = db.orders.findIndex(o => o.id === order.id);
  if (i === -1) return false;
  db.orders[i] = order; writeDb(db); return true;
}

function getOrdersByUser(user_id) { return readDb().orders.filter(o => o.user_id === user_id); }

function getAllOrders() { return readDb().orders; }

module.exports = { createOrder, getOrderById, updateOrder, getOrdersByUser, getAllOrders };
