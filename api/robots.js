'use strict';
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nSitemap: https://sidepocketapparel.com/sitemap.xml\n`);
};
