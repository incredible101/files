# CampusBite Student Food Delivery — Database Documentation (INFS222)

DBMS: MySQL 8 / MariaDB 10.3+ · Database: `campusbite` · Engine: InnoDB · Character set: utf8mb4

Source of truth: `database/schema.sql`. Sample queries: `database/queries.sql`. System-catalog queries: `database/system_catalog.sql`.

## 1. Entity Relationship Diagram
See `docs/erd.png` (editable source `docs/erd.dot`; regenerate with `dot -Tpng docs/erd.dot -o docs/erd.png`).

| Relationship | Cardinality | Rule |
|---|---|---|
| customers — orders | 1 : M | A customer places zero or more orders; every order has one customer (RESTRICT). |
| delivery_zones — orders | 1 : M | Every order is for one zone (on-campus, off-campus or collection) (RESTRICT). |
| orders — menu_items | M : N | Resolved by the associative entity `order_items` (composite PK). Deleting an order deletes its lines (CASCADE); a menu item that has been sold cannot be deleted (RESTRICT). |
| menu_categories — menu_items | 1 : M | Every item has one category (RESTRICT). |

`staff` (dashboard logins) and `kitchen_settings` (a single capacity row) are not linked to other tables by foreign keys.

## 2. Relational schema
PK = primary key, FK = foreign key, UQ = unique.

- staff(**staff_id**, username UQ, password_hash, created_at)
- customers(**customer_id**, full_name, phone UQ, email, student_no, created_at)
- delivery_zones(**zone_id**, name UQ, area_type, delivery_fee, is_active)
- menu_categories(**category_id**, name UQ)
- menu_items(**item_id**, *category_id* FK→menu_categories, name UQ, description, price, image_path, is_active, is_available)
- kitchen_settings(**setting_id**, orders_per_slot)
- orders(**order_id**, order_ref UQ, *customer_id* FK→customers, *zone_id* FK→delivery_zones, delivery_address, order_date, slot_time, subtotal, delivery_fee, total, vat_included, payment_method, notes, status, created_at)
- order_items(**order_id** FK→orders, **item_id** FK→menu_items, quantity, unit_price) — composite PK (order_id, item_id)

## 3. Normalisation
**Unnormalised starting point.** One flat order record holding the customer's name, phone and student number, the zone name and its fee, the delivery address, and the whole cart as a list such as "2 x Burger, 1 x Chips".

**1NF.** The repeating group (the cart) became rows of `order_items`; every column is atomic.

**2NF.** `order_items` has a composite key (order_id, item_id). Quantity and unit price depend on the whole key; the item's name and description depend only on item_id, so they sit in `menu_items`.

**3NF.** Customer name, phone, email and student number depend on the customer, not on the order, so they moved to `customers`. The zone name, area type and fee depend on the zone, so they moved to `delivery_zones`. The category name moved to `menu_categories`. Every non-key attribute now depends on "the key, the whole key, and nothing but the key".

**Documented, deliberate denormalisation.** `orders.subtotal, delivery_fee, total, vat_included` and `order_items.unit_price` are stored although they could be recomputed. They are historical snapshots: if a price or delivery fee changes later, past receipts must not change. Query Q10 checks the stored subtotal still equals the sum of its lines.

## 4. Data dictionary
### customers
| Column | Type | Null | Key | Description / constraint |
|---|---|---|---|---|
| customer_id | INT UNSIGNED | No | PK, auto | Surrogate key |
| full_name | VARCHAR(100) | No | | Name as first supplied |
| phone | VARCHAR(15) | No | UQ | Normalised local format, e.g. 0821234567; identifies a returning customer |
| email | VARCHAR(150) | Yes | | Optional |
| student_no | VARCHAR(10) | Yes | | Optional; 7–10 digits (validated by the application) |
| created_at | TIMESTAMP | No | | Default CURRENT_TIMESTAMP |

### delivery_zones
| Column | Type | Null | Key | Description / constraint |
|---|---|---|---|---|
| zone_id | INT UNSIGNED | No | PK, auto | |
| name | VARCHAR(100) | No | UQ | e.g. "Campus residences" |
| area_type | ENUM | No | | On-campus, Off-campus, Collection |
| delivery_fee | DECIMAL(6,2) | No | | CHECK ≥ 0; 0 for collection |
| is_active | TINYINT(1) | No | | Soft delete |

### menu_categories
| Column | Type | Null | Key | Description |
|---|---|---|---|---|
| category_id | INT UNSIGNED | No | PK, auto | |
| name | VARCHAR(50) | No | UQ | Breakfast, Meals, Snacks, Drinks |

### menu_items
| Column | Type | Null | Key | Description / constraint |
|---|---|---|---|---|
| item_id | INT UNSIGNED | No | PK, auto | |
| category_id | INT UNSIGNED | No | FK | → menu_categories, RESTRICT |
| name | VARCHAR(100) | No | UQ | |
| description | VARCHAR(255) | No | | |
| price | DECIMAL(8,2) | No | | CHECK ≥ 0; VAT-inclusive selling price |
| image_path | VARCHAR(255) | Yes | | Path under public/ |
| is_active | TINYINT(1) | No | | 0 = removed from the menu |
| is_available | TINYINT(1) | No | | 0 = sold out today (staff toggle) |

### kitchen_settings
| Column | Type | Null | Key | Description / constraint |
|---|---|---|---|---|
| setting_id | TINYINT UNSIGNED | No | PK | CHECK = 1 (single-row table) |
| orders_per_slot | SMALLINT UNSIGNED | No | | CHECK > 0; orders accepted per hourly window |

### orders
| Column | Type | Null | Key | Description / constraint |
|---|---|---|---|---|
| order_id | INT UNSIGNED | No | PK, auto | |
| order_ref | VARCHAR(30) | No | UQ | Customer-facing reference, e.g. CB-… |
| customer_id | INT UNSIGNED | No | FK | → customers, RESTRICT |
| zone_id | INT UNSIGNED | No | FK | → delivery_zones, RESTRICT |
| delivery_address | VARCHAR(200) | Yes | | Residence/room/street; NULL for collection |
| order_date | DATE | No | | Day the food is wanted (today to +2 days) |
| slot_time | TIME | No | | Start of the hourly window; index idx_orders_slot (order_date, slot_time, status) |
| subtotal | DECIMAL(10,2) | No | | Food total, snapshot |
| delivery_fee | DECIMAL(10,2) | No | | Snapshot; 0 when free or collection |
| total | DECIMAL(10,2) | No | | subtotal + delivery_fee |
| vat_included | DECIMAL(10,2) | No | | VAT contained in total (15%) |
| payment_method | ENUM | No | | Cash, Card, EFT (paid on delivery/collection) |
| notes | VARCHAR(200) | Yes | | e.g. "no onions" |
| status | ENUM | No | | Placed, Preparing, Ready, Delivered, Cancelled (default Placed) |
| created_at | TIMESTAMP | No | | |

### order_items
| Column | Type | Null | Key | Description / constraint |
|---|---|---|---|---|
| order_id | INT UNSIGNED | No | PK, FK | → orders, CASCADE |
| item_id | INT UNSIGNED | No | PK, FK | → menu_items, RESTRICT |
| quantity | SMALLINT UNSIGNED | No | | CHECK > 0 |
| unit_price | DECIMAL(8,2) | No | | Price at time of sale |

### staff
| Column | Type | Null | Key | Description |
|---|---|---|---|---|
| staff_id | INT UNSIGNED | No | PK, auto | |
| username | VARCHAR(50) | No | UQ | |
| password_hash | VARCHAR(255) | No | | bcrypt hash; plain text is never stored |
| created_at | TIMESTAMP | No | | |

## 5. Integrity, concurrency and security design
- **Referential integrity:** foreign keys with explicit ON DELETE rules (above).
- **Domain integrity:** ENUM status fields; CHECK constraints (fees and prices ≥ 0, quantity > 0, capacity > 0, single kitchen row); NOT NULL; UNIQUE keys.
- **Concurrency:** order creation runs in a transaction that locks the `kitchen_settings` row (`SELECT … FOR UPDATE`) before counting the orders already in the chosen hourly window, so two students cannot both take the last place.
- **Status workflow:** Placed → Preparing → Ready → Delivered/Collected, with Cancelled possible before delivery; invalid jumps are refused by the API.
- **Money:** calculated server-side in integer cents; menu prices are VAT-inclusive, so VAT is extracted (total × 15/115); the browser never supplies prices or fees.
- **Injection:** every query is parameterised.

## 6. System catalog
MySQL stores the structure of the database in `information_schema`. `database/system_catalog.sql` queries it (C1 tables, C2 columns, C3 constraints, C4 foreign keys, C5 indexes). Run it in MySQL Workbench and paste the output into your report as evidence.

## 7. Group contribution report (complete this as a group)
| Member | Student no. | Sections / tasks completed | Evidence (commits, files) | % |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |

Each member should add a short individual reflection (what you built, what you learned, one thing you would change).
