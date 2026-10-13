# CampusBite — Student Food Delivery for NWU Mahikeng Campus and Off-Campus Residents

INFS221 (E-Commerce) / INFS222 (Databases) group project. Mahikeng, North West.
"CampusBite" is a placeholder trading name; replace it with your group's name. The project is not affiliated with NWU.

**Stack:** Node.js 18+ · Express · MySQL (or MariaDB) · plain HTML/CSS/JS front end.

## 1. Features
- Menu with categories, photos and a **sold-out** flag controlled by the kitchen.
- Cart and checkout for **delivery to on-campus residences, delivery to off-campus areas, or collection**. Delivery fee depends on the zone; free over R150 of food.
- **Hourly order windows with live capacity**: a window disappears once the kitchen is full, and needs 45 minutes' notice. Students order for today up to two days ahead.
- Prices and fees are calculated **on the server**. Menu prices include 15% VAT, shown on the confirmation.
- Pay on delivery or collection (cash, card machine or EFT). No online payment gateway.
- Kitchen dashboard (`/admin.html`): today's orders by window, move orders Placed → Preparing → Ready → Delivered/Collected, cancel, mark items sold out, and see today's sales.
- Not built (future work): SMS/WhatsApp order alerts, live driver tracking, loyalty points, online card payment.

## 2. Run it locally (Windows / macOS / Linux)
1. Install **Node.js 20 LTS** and **XAMPP** (start the *MySQL* module) or any MySQL 8 server.
2. In the project folder:
   ```
   npm install
   copy .env.example .env        (macOS/Linux: cp .env.example .env)
   ```
3. Edit `.env`: set `DB_PASSWORD` (blank for default XAMPP), a `JWT_SECRET` of 32+ characters
   (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`), and your `STAFF_USERNAME` / `STAFF_PASSWORD` (8+ characters).
4. `npm run seed` — creates the database, tables, sample menu and zones, and your staff account.
5. `npm start`, then open http://localhost:3000 (kitchen: http://localhost:3000/admin.html).

Run the automated tests with `npm test`.

## 3. Database
Normalised to 3NF, eight tables: staff, customers, delivery_zones, menu_categories, menu_items, kitchen_settings, orders, order_items. See `docs/INFS222_Database_Documentation.md` (ERD, relational schema, data dictionary, normalisation, system catalog) and `docs/erd.png`. The app creates the schema from `database/schema.sql` on start, so you can also import that file manually in MySQL Workbench/phpMyAdmin.

## 4. Project layout
```
database/  schema.sql, data.sql, queries.sql, system_catalog.sql
docs/      INFS222 documentation, ER diagram
public/    website (index.html, admin.html, css/, js/, images/menu/)
server/    Express API (routes/, middleware/, lib/, validators, pricing, db)
tests/     unit tests (node --test)
```
Placeholders to replace with your real figures: delivery zones and fees and menu prices (`database/data.sql`), kitchen capacity (`kitchen_settings`), opening windows (`server/config.js`).

## 5. Security notes
Passwords hashed with bcrypt · JWT with expiry on staff routes · parameterised SQL · helmet security headers + CSP · rate limiting · server-side validation. The staff token is kept in `sessionStorage` (cleared when the tab closes); a production system would prefer an HttpOnly cookie. Never commit `.env` (it is in `.gitignore`).

## 6. Hosting
**GitHub Pages cannot run this project** — it serves static files only, and this app needs Node.js and MySQL.
- **GitHub** — store the code and show commit history (evidence for the contribution report).
- **Railway** (or similar) — create a project from the GitHub repo, add a **MySQL** service, set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `STAFF_USERNAME`, `STAFF_PASSWORD`, `NODE_ENV=production`, then run `npm run seed` once. Free tiers and pricing change; check the platform's current terms.
- Or present from your laptop with XAMPP, which needs no hosting.

## 7. Git quick start
```
git init
git add .
git commit -m "CampusBite: menu, ordering, kitchen dashboard"
git branch -M main
git remote add origin https://github.com/<you>/campusbite.git
git push -u origin main
```
