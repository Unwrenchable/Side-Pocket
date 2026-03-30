'use strict';
const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  try {
    // Try server/data/products.json first, then root products.json
    let p = path.join(process.cwd(), 'server', 'data', 'products.json');
    if (!fs.existsSync(p)) p = path.join(process.cwd(), 'products.json');
    if (!fs.existsSync(p)) return res.json({ products: [] });
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Could not read products' });
  }
};
