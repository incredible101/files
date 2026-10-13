-- =====================================================================
-- CampusBite — system catalog queries (INFS222 "create the system catalog").
-- MySQL/MariaDB expose their catalog through INFORMATION_SCHEMA. These
-- queries list the metadata the DBMS itself stores about the database.
-- =====================================================================

-- C1. Every table in the database, its engine and row estimate.
SELECT table_name, engine, table_rows, create_time
FROM information_schema.tables
WHERE table_schema = 'campusbite' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- C2. Every column with its type, nullability, default and key role.
SELECT table_name, ordinal_position AS pos, column_name, column_type,
       is_nullable, column_default, column_key, extra
FROM information_schema.columns
WHERE table_schema = 'campusbite'
ORDER BY table_name, ordinal_position;

-- C3. Primary, unique and foreign key constraints.
SELECT table_name, constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'campusbite'
ORDER BY table_name, constraint_type, constraint_name;

-- C4. Foreign key relationships (child column -> parent column).
SELECT k.table_name AS child_table, k.column_name AS child_column,
       k.referenced_table_name AS parent_table,
       k.referenced_column_name AS parent_column,
       r.delete_rule
FROM information_schema.key_column_usage k
JOIN information_schema.referential_constraints r
  ON r.constraint_schema = k.constraint_schema
 AND r.constraint_name   = k.constraint_name
WHERE k.table_schema = 'campusbite' AND k.referenced_table_name IS NOT NULL
ORDER BY k.table_name, k.column_name;

-- C5. Indexes.
SELECT table_name, index_name, non_unique, seq_in_index, column_name
FROM information_schema.statistics
WHERE table_schema = 'campusbite'
ORDER BY table_name, index_name, seq_in_index;
