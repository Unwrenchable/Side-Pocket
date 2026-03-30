# Side Pocket Apparel

Pool/billiards-themed streetwear e-commerce — Node.js/Express backend with vanilla HTML/CSS/JS frontend.

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file and fill in your keys
cp .env.example .env

# Start the dev server (port 3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
├── index.html          # Home page
├── shop.html           # Shop / product listing
├── about.html          # Brand story
├── contact.html        # Contact page
├── admin.html          # Admin dashboard (token-protected)
├── products.json       # Product catalog (seed data)
├── styles/
│   ├── main.css        # Main stylesheet
│   └── admin.css       # Admin panel styles
├── scripts/
│   └── cart.js         # SPCart module (localStorage cart)
├── images/
│   └── logo.svg        # Brand logo
├── api/                # Vercel serverless functions
│   ├── products.js
│   ├── newsletter.js
│   ├── login.js
│   ├── register.js
│   ├── logout.js
│   ├── profile.js
│   ├── create-order.js
│   ├── config.js
│   ├── sitemap.js
│   └── robots.js
└── server/
    ├── index.js        # Express server (local dev + self-hosted)
    ├── data/           # JSON database (gitignored)
    └── services/
        ├── userService.js
        └── orderService.js
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret key for JWT tokens |
| `ADMIN_TOKEN` | Token for admin dashboard access |
| `STRIPE_SECRET_KEY` | Stripe secret key (optional) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (optional) |
| `SMTP_HOST` | Email host (optional) |
| `SMTP_USER` / `SMTP_PASS` | Email credentials (optional) |
| `INSTAGRAM_ACCESS_TOKEN` | Instagram API token (optional) |

## Admin Dashboard

Visit `/admin.html` and enter your `ADMIN_TOKEN` to access the dashboard. Features:
- Overview stats (orders, customers, products, subscribers)
- Product catalog management (add/edit/delete/publish)
- Order history
- Customer list
- Newsletter subscriber list + CSV export
- Instagram sync

## Deployment (Vercel)

```bash
vercel --prod
```

Set environment variables in the Vercel dashboard under **Settings → Environment Variables**.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/products` | — | List products |
| GET | `/api/config` | — | Public config (Stripe key) |
| POST | `/api/register` | — | Create account |
| POST | `/api/login` | — | Sign in |
| POST | `/api/logout` | — | Sign out |
| GET | `/api/profile` | JWT | Get current user |
| POST | `/api/newsletter` | — | Subscribe to newsletter |
| POST | `/api/stripe/create-checkout` | JWT | Create Stripe checkout session |
| POST | `/api/create-order` | JWT | Create order record |
| GET | `/api/admin/orders` | Admin token | All orders |
| GET | `/api/admin/users` | Admin token | All users |
| GET | `/api/admin/newsletter` | Admin token | Subscriber list |
| POST | `/api/admin/save-products` | Admin token | Save product catalog |
| POST | `/api/admin/sync-instagram` | Admin token | Sync products from Instagram |

Upgrade to old crappy site
