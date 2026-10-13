-- =====================================================================
-- CampusBite — reference data (safe to run repeatedly: INSERT IGNORE
-- skips rows whose unique value already exists, so edits made later in
-- phpMyAdmin / Workbench are never overwritten).
--
-- NOTE: delivery zones, fees and menu prices are placeholders for the
-- project. Replace them with the group's real figures.
-- =====================================================================

INSERT IGNORE INTO kitchen_settings (setting_id, orders_per_slot) VALUES (1, 12);

INSERT IGNORE INTO delivery_zones (name, area_type, delivery_fee) VALUES
  ('Campus residences',                     'On-campus',  10.00),
  ('Student Centre and lecture venues',     'On-campus',  10.00),
  ('Mmabatho (off-campus)',                 'Off-campus', 25.00),
  ('Mahikeng town and Golfview (off-campus)','Off-campus', 30.00),
  ('Other off-campus (within 10 km)',       'Off-campus', 40.00),
  ('Collect from our kitchen',              'Collection',  0.00);

INSERT IGNORE INTO menu_categories (name) VALUES
  ('Breakfast'), ('Meals'), ('Snacks'), ('Drinks');

INSERT IGNORE INTO menu_items (category_id, name, description, price, image_path) VALUES
  ((SELECT category_id FROM menu_categories WHERE name = 'Breakfast'), 'Egg and Cheese Toastie',   'Two eggs and melted cheddar on toasted white or brown bread.', 28.00, 'images/menu/m1.svg'),
  ((SELECT category_id FROM menu_categories WHERE name = 'Breakfast'), 'Egg and Bacon Roll',       'Fried egg and crispy bacon in a fresh roll.',                  35.00, 'images/menu/m2.svg'),
  ((SELECT category_id FROM menu_categories WHERE name = 'Breakfast'), 'Oats and Banana Bowl',     'Warm oats with sliced banana and a drizzle of honey.',         25.00, 'images/menu/m3.svg'),
  ((SELECT category_id FROM menu_categories WHERE name = 'Meals'),     'Pap, Wors and Chakalaka',  'Stiff pap, grilled boerewors and spicy chakalaka.',            45.00, 'images/menu/m4.svg'),
  ((SELECT category_id FROM menu_categories WHERE name = 'Meals'),     'Chicken Stew and Pap',     'Slow-cooked chicken stew with pap and cabbage.',               50.00, 'images/menu/m5.svg'),
  ((SELECT category_id FROM menu_categories WHERE name = 'Meals'),     'Beef Burger and Chips',    'Beef patty, lettuce, tomato and sauce with a portion of chips.', 55.00, 'images/menu/m6.svg'),
  ((SELECT category_id FROM menu_categories WHERE name = 'Meals'),     'Chicken Wrap and Chips',   'Grilled chicken strips, salad and mayo in a wrap, with chips.', 48.00, 'images/menu/m7.svg'),
  ((SELECT category_id FROM menu_categories WHERE name = 'Meals'),     'Vegetable Curry and Rice', 'Mild vegetable curry on steamed rice. Vegetarian.',            40.00, 'images/menu/m8.svg'),
  ((SELECT category_id FROM menu_categories WHERE name = 'Snacks'),    'Vetkoek and Mince',        'Fried vetkoek filled with savoury mince.',                     28.00, 'images/menu/m9.svg'),
  ((SELECT category_id FROM menu_categories WHERE name = 'Snacks'),    'Chips Box',                'Hot salted chips in a box. Add sauce on request.',             25.00, 'images/menu/m10.svg'),
  ((SELECT category_id FROM menu_categories WHERE name = 'Snacks'),    'Beef Samoosas (3)',        'Three crispy samoosas with a spicy beef filling.',             24.00, 'images/menu/m11.svg'),
  ((SELECT category_id FROM menu_categories WHERE name = 'Snacks'),    'Fat Cakes (3)',            'Three freshly fried fat cakes (magwinya).',                    15.00, 'images/menu/m12.svg'),
  ((SELECT category_id FROM menu_categories WHERE name = 'Drinks'),    'Still Water 500 ml',       'Chilled bottled water.',                                       10.00, 'images/menu/m13.svg'),
  ((SELECT category_id FROM menu_categories WHERE name = 'Drinks'),    'Fruit Juice 330 ml',       'Chilled mixed-fruit juice.',                                   15.00, 'images/menu/m14.svg'),
  ((SELECT category_id FROM menu_categories WHERE name = 'Drinks'),    'Iced Tea 500 ml',          'Lemon iced tea, served cold.',                                 18.00, 'images/menu/m15.svg'),
  ((SELECT category_id FROM menu_categories WHERE name = 'Drinks'),    'Cappuccino',               'Freshly made cappuccino.',                                     22.00, 'images/menu/m16.svg');
