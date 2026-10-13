-- =====================================================================
-- CampusBite Student Food Delivery — relational schema
-- (MySQL 5.7+/8.x, MariaDB 10.3+)
--
-- Run in MySQL Workbench or phpMyAdmin (Import / SQL tab), or let the
-- application create it automatically on first start (server/db.js runs
-- this same file, so there is exactly one definition of the schema).
--
-- Normal form: every table is in Third Normal Form (3NF).
--   * customer details live only in `customers`
--   * delivery fee and area type live only in `delivery_zones`
--   * an order's lines live in `order_items` (no repeating groups)
-- Stored money columns on `orders` and `order_items.unit_price` are
-- deliberate historical snapshots — see docs/INFS222_Database_Documentation.md §3.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS campusbite
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE campusbite;

-- staff: kitchen / admin employees who may log in to the dashboard
CREATE TABLE IF NOT EXISTS staff (
  staff_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(50)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (staff_id),
  UNIQUE KEY uq_staff_username (username)
) ENGINE=InnoDB;

-- customers: one row per person; phone number is the natural key.
-- student_no is optional (off-campus residents and staff may also order).
CREATE TABLE IF NOT EXISTS customers (
  customer_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name   VARCHAR(100) NOT NULL,
  phone       VARCHAR(15)  NOT NULL,
  email       VARCHAR(150) NULL,
  student_no  VARCHAR(10)  NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id),
  UNIQUE KEY uq_customers_phone (phone)
) ENGINE=InnoDB;

-- delivery_zones: where food can go and what it costs.
-- area_type 'Collection' means the customer collects (no address, no fee).
CREATE TABLE IF NOT EXISTS delivery_zones (
  zone_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(100) NOT NULL,
  area_type    ENUM('On-campus','Off-campus','Collection') NOT NULL,
  delivery_fee DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (zone_id),
  UNIQUE KEY uq_zones_name (name),
  CONSTRAINT chk_zones_fee CHECK (delivery_fee >= 0)
) ENGINE=InnoDB;

-- menu_categories / menu_items: what the kitchen sells.
CREATE TABLE IF NOT EXISTS menu_categories (
  category_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(50)  NOT NULL,
  PRIMARY KEY (category_id),
  UNIQUE KEY uq_menu_categories_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS menu_items (
  item_id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id  INT UNSIGNED NOT NULL,
  name         VARCHAR(100) NOT NULL,
  description  VARCHAR(255) NOT NULL,
  price        DECIMAL(8,2) NOT NULL,
  image_path   VARCHAR(255) NULL,
  is_active    TINYINT(1)   NOT NULL DEFAULT 1,  -- 0 = removed from the menu
  is_available TINYINT(1)   NOT NULL DEFAULT 1,  -- 0 = sold out today
  PRIMARY KEY (item_id),
  UNIQUE KEY uq_menu_items_name (name),
  KEY idx_menu_items_category (category_id),
  CONSTRAINT fk_menu_items_category FOREIGN KEY (category_id)
    REFERENCES menu_categories (category_id) ON DELETE RESTRICT,
  CONSTRAINT chk_menu_items_price CHECK (price >= 0)
) ENGINE=InnoDB;

-- kitchen_settings: a single row holding the kitchen's capacity.
-- orders_per_slot = how many orders can be accepted for one hourly window.
CREATE TABLE IF NOT EXISTS kitchen_settings (
  setting_id      TINYINT UNSIGNED NOT NULL,
  orders_per_slot SMALLINT UNSIGNED NOT NULL DEFAULT 12,
  PRIMARY KEY (setting_id),
  CONSTRAINT chk_kitchen_single_row CHECK (setting_id = 1),
  CONSTRAINT chk_kitchen_capacity CHECK (orders_per_slot > 0)
) ENGINE=InnoDB;

-- orders: one checkout. The customer picks a zone and an hourly window.
-- delivery_address is NULL for collection orders.
CREATE TABLE IF NOT EXISTS orders (
  order_id         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  order_ref        VARCHAR(30)   NOT NULL,
  customer_id      INT UNSIGNED  NOT NULL,
  zone_id          INT UNSIGNED  NOT NULL,
  delivery_address VARCHAR(200)  NULL,
  order_date       DATE          NOT NULL,
  slot_time        TIME          NOT NULL,
  subtotal         DECIMAL(10,2) NOT NULL,
  delivery_fee     DECIMAL(10,2) NOT NULL,
  total            DECIMAL(10,2) NOT NULL,
  vat_included     DECIMAL(10,2) NOT NULL,
  payment_method   ENUM('Cash','Card','EFT') NOT NULL DEFAULT 'Cash',
  notes            VARCHAR(200)  NULL,
  status           ENUM('Placed','Preparing','Ready','Delivered','Cancelled')
                   NOT NULL DEFAULT 'Placed',
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (order_id),
  UNIQUE KEY uq_orders_ref (order_ref),
  KEY idx_orders_slot (order_date, slot_time, status),
  KEY idx_orders_customer (customer_id),
  KEY idx_orders_zone (zone_id),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id)
    REFERENCES customers (customer_id) ON DELETE RESTRICT,
  CONSTRAINT fk_orders_zone FOREIGN KEY (zone_id)
    REFERENCES delivery_zones (zone_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  order_id   INT UNSIGNED      NOT NULL,
  item_id    INT UNSIGNED      NOT NULL,
  quantity   SMALLINT UNSIGNED NOT NULL,
  unit_price DECIMAL(8,2)      NOT NULL,
  PRIMARY KEY (order_id, item_id),
  KEY idx_order_items_item (item_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id)
    REFERENCES orders (order_id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_item FOREIGN KEY (item_id)
    REFERENCES menu_items (item_id) ON DELETE RESTRICT,
  CONSTRAINT chk_order_items_qty CHECK (quantity > 0)
) ENGINE=InnoDB;
