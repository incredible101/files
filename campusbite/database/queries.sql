-- =====================================================================
-- CampusBite — example queries for the INFS222 report (Q1–Q10).
-- Run after the database has some orders in it.
-- =====================================================================
USE campusbite;

-- Q1. Today's kitchen sheet: orders in slot order with customer and zone.
SELECT o.order_ref, o.slot_time, c.full_name, c.phone, z.name AS zone,
       o.delivery_address, o.status, o.total
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
JOIN delivery_zones z ON z.zone_id = o.zone_id
WHERE o.order_date = CURDATE() AND o.status <> 'Cancelled'
ORDER BY o.slot_time, o.order_id;

-- Q2. Slot load: orders per hourly window against kitchen capacity.
SELECT o.order_date, o.slot_time, COUNT(*) AS orders_taken, k.orders_per_slot AS capacity
FROM orders o CROSS JOIN kitchen_settings k
WHERE o.status <> 'Cancelled'
GROUP BY o.order_date, o.slot_time, k.orders_per_slot
ORDER BY o.order_date, o.slot_time;

-- Q3. Best-selling menu items by quantity and revenue.
SELECT m.name, SUM(oi.quantity) AS units_sold, SUM(oi.quantity * oi.unit_price) AS revenue
FROM order_items oi
JOIN menu_items m ON m.item_id = oi.item_id
JOIN orders o ON o.order_id = oi.order_id
WHERE o.status <> 'Cancelled'
GROUP BY m.item_id, m.name
ORDER BY units_sold DESC;

-- Q4. Revenue by menu category.
SELECT mc.name AS category, SUM(oi.quantity * oi.unit_price) AS revenue
FROM order_items oi
JOIN menu_items m ON m.item_id = oi.item_id
JOIN menu_categories mc ON mc.category_id = m.category_id
JOIN orders o ON o.order_id = oi.order_id
WHERE o.status <> 'Cancelled'
GROUP BY mc.category_id, mc.name
ORDER BY revenue DESC;

-- Q5. On-campus versus off-campus demand (the two target markets).
SELECT z.area_type, COUNT(*) AS orders, SUM(o.total) AS revenue, ROUND(AVG(o.total), 2) AS avg_order
FROM orders o JOIN delivery_zones z ON z.zone_id = o.zone_id
WHERE o.status <> 'Cancelled'
GROUP BY z.area_type;

-- Q6. Busiest hours of the day.
SELECT slot_time, COUNT(*) AS orders
FROM orders WHERE status <> 'Cancelled'
GROUP BY slot_time ORDER BY orders DESC;

-- Q7. Repeat customers (two or more orders).
SELECT c.full_name, c.phone, COUNT(*) AS orders, SUM(o.total) AS spent
FROM customers c JOIN orders o ON o.customer_id = c.customer_id
WHERE o.status <> 'Cancelled'
GROUP BY c.customer_id, c.full_name, c.phone
HAVING COUNT(*) >= 2
ORDER BY spent DESC;

-- Q8. A full receipt for one order.
SELECT o.order_ref, c.full_name, m.name AS item, oi.quantity, oi.unit_price,
       oi.quantity * oi.unit_price AS line_total
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
JOIN order_items oi ON oi.order_id = o.order_id
JOIN menu_items m ON m.item_id = oi.item_id
WHERE o.order_ref = 'CB-REPLACE-ME'
ORDER BY m.name;

-- Q9. Items often bought together (cross-sell).
SELECT a.name AS item_a, b.name AS item_b, COUNT(*) AS together
FROM order_items x
JOIN order_items y ON y.order_id = x.order_id AND y.item_id > x.item_id
JOIN menu_items a ON a.item_id = x.item_id
JOIN menu_items b ON b.item_id = y.item_id
GROUP BY a.item_id, b.item_id, a.name, b.name
ORDER BY together DESC LIMIT 10;

-- Q10. Integrity check: stored subtotal must equal the sum of its lines
-- (returns no rows when the data is consistent).
SELECT o.order_id, o.order_ref, o.subtotal, SUM(oi.quantity * oi.unit_price) AS lines_total
FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
GROUP BY o.order_id, o.order_ref, o.subtotal
HAVING o.subtotal <> SUM(oi.quantity * oi.unit_price);
