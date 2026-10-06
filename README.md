# StrumCart (Node.js + Express + MongoDB)
## Setup (Windows)
1. Install Node 18+ and MongoDB Community (or use a free MongoDB Atlas URI).
2. `copy .env.example .env` and set `SESSION_SECRET` (long random string) and `MONGO_URI`.
3. For the first admin, set `ADMIN_EMAIL` and a 12+ char `ADMIN_PASSWORD` in `.env`, run `npm run seed`, then **delete the password from `.env`**.
4. `npm install` → `npm run dev` → open http://localhost:3000 (admin UI: /admin.html)
## Design notes
- Sessions in MongoDB (HttpOnly cookie, `Secure` in production), CSRF header token, rate-limited login/register, helmet, bcrypt(12).
- Prices, stock and totals are always computed server-side. Orders snapshot name/SKU/price.
- Checkout uses an atomic `stock >= qty` decrement per item with compensating rollback (works on standalone MongoDB, no replica set needed) and a per-user idempotency key against duplicate orders.
- Only Delivered orders count as revenue. Cancelling restores stock. "Delete" product = hide (order history stays intact).
## Deploy
Express + MongoDB need a Node host (Render, Railway, VPS) and MongoDB Atlas; static hosts such as GitHub Pages can't run the server. Set `NODE_ENV=production` and the env vars; serve over HTTPS.
## Not included (yet)
Reviews, coupons, newsletter/contact forms, forgot-password email, address book, image upload, automated tests. Frontend is a compact hash-routed SPA, not the multi-page layout in the original spec.

## Deploy on Vercel
1. Create a free **MongoDB Atlas** cluster + DB user; Network Access: allow `0.0.0.0/0`. Use a connection string ending in `/strumcart`.
2. Run `npm run seed` once locally with `MONGO_URI` set to Atlas (loads products + admin).
3. Push to GitHub (project files must be at the repo root, next to `index.js`) and import in Vercel. Vercel auto-detects Express via `index.js`; no build command.
4. Add env vars `MONGO_URI`, `SESSION_SECRET`, `NODE_ENV=production`, then deploy and use the https URL.

## Important GitHub folder structure
Keep `server/routes.js`, `server/models.js`, and `server/seed.js` inside the `server` folder. Keep frontend files inside `public`. Do not upload these files flat beside `index.js`, because relative imports and static-file serving depend on these paths.
