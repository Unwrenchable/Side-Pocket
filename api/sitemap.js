'use strict';
const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  let productsXml = '';
  try {
    let p = path.join(process.cwd(), 'server', 'data', 'products.json');
    if (!fs.existsSync(p)) p = path.join(process.cwd(), 'products.json');
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      (data.products || []).filter(pr => pr.published).forEach(pr => {
        productsXml += `  <url><loc>https://sidepocketapparel.com/product/${pr.sku || pr.id}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
      });
    }
  } catch {}
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://sidepocketapparel.com/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://sidepocketapparel.com/shop</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>https://sidepocketapparel.com/about</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>
  <url><loc>https://sidepocketapparel.com/contact</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
${productsXml}</urlset>`;
  res.setHeader('Content-Type', 'application/xml');
  res.send(xml);
};
