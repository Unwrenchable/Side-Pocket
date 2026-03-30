'use strict';
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_JSON = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'db.json');

function readDb() {
  try {
    if (!fs.existsSync(DB_JSON)) {
      const init = { users: [], orders: [], nextUserId: 1, nextOrderId: 1 };
      fs.writeFileSync(DB_JSON, JSON.stringify(init, null, 2));
      return init;
    }
    return JSON.parse(fs.readFileSync(DB_JSON, 'utf8') || '{}');
  } catch { return { users: [], orders: [], nextUserId: 1, nextOrderId: 1 }; }
}
function writeDb(db) { fs.writeFileSync(DB_JSON, JSON.stringify(db, null, 2)); }

function findByEmail(email) { return readDb().users.find(u => u.email === email) || null; }
function findById(id) { return readDb().users.find(u => u.id === id) || null; }

async function createUser({ email, password, name }) {
  const db = readDb();
  if (db.users.find(u => u.email === email)) throw new Error('exists');
  const hashed = await bcrypt.hash(password, 10);
  const id = db.nextUserId++;
  const user = { id, email, password: hashed, name: name || null, created_at: new Date().toISOString() };
  db.users.push(user); writeDb(db); return user;
}

async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.password);
}

function updateUser(user) {
  const db = readDb();
  const i = db.users.findIndex(u => u.id === user.id);
  if (i === -1) return false;
  db.users[i] = user; writeDb(db); return true;
}

function getAllUsers() {
  return readDb().users.map(u => ({ id: u.id, email: u.email, name: u.name, created_at: u.created_at }));
}

module.exports = { findByEmail, findById, createUser, verifyPassword, updateUser, getAllUsers };
