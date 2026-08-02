-- =============================================================================
-- ThreadOps: Combined Migration + Seed for Dashboard SQL Editor
--
-- Run this in: Supabase Dashboard → SQL Editor → New Query
--
-- This is the full idempotent setup script combining:
--   1. supabase/migrations/20260802163555_initial_schema.sql
--   2. supabase/migrations/20260802163600_seed_departments.sql
-- =============================================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =============================================================================
-- TABLE: departments
-- =============================================================================
CREATE TABLE IF NOT EXISTS departments (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text        NOT NULL UNIQUE,
    pin         text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABLE: orders
-- =============================================================================
CREATE TABLE IF NOT EXISTS orders (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer       text        NOT NULL,
    style_code  text        NOT NULL,
    deadline    date        NOT NULL,
    status      text        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABLE: order_line_items
-- =============================================================================
CREATE TABLE IF NOT EXISTS order_line_items (
    id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id         uuid        NOT NULL
                                 REFERENCES orders(id) ON DELETE CASCADE,
    size             text        NOT NULL,
    color            text        NOT NULL,
    quantity_ordered integer     NOT NULL CHECK (quantity_ordered > 0),
    created_at       timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- TABLE: bundles
-- =============================================================================
CREATE TABLE IF NOT EXISTS bundles (
    id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_line_item_id   uuid        NOT NULL
                                     REFERENCES order_line_items(id) ON DELETE CASCADE,
    bundle_number        integer     NOT NULL,
    quantity             integer     NOT NULL CHECK (quantity > 0),
    current_stage        text        NOT NULL DEFAULT 'received'
                                     CHECK (current_stage IN (
                                         'received', 'cutting', 'stitching',
                                         'finishing', 'ironing', 'packing', 'dispatch'
                                     )),
    status               text        NOT NULL DEFAULT 'in_progress'
                                     CHECK (status IN ('in_progress', 'rework', 'completed')),
    parent_bundle_id     uuid        REFERENCES bundles(id) ON DELETE SET NULL,
    created_at           timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT bundles_order_line_item_id_bundle_number_key
        UNIQUE (order_line_item_id, bundle_number)
);

-- =============================================================================
-- TABLE: stage_events
-- =============================================================================
CREATE TABLE IF NOT EXISTS stage_events (
    id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    bundle_id          uuid        NOT NULL
                                   REFERENCES bundles(id) ON DELETE CASCADE,
    stage              text        NOT NULL,
    quantity_passed    integer     NOT NULL CHECK (quantity_passed >= 0),
    quantity_rejected  integer     NOT NULL DEFAULT 0 CHECK (quantity_rejected >= 0),
    department_id      uuid        NOT NULL
                                   REFERENCES departments(id),
    created_at         timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_status
    ON orders (status);

CREATE INDEX IF NOT EXISTS idx_order_line_items_order_id
    ON order_line_items (order_id);

CREATE INDEX IF NOT EXISTS idx_bundles_order_line_item_id
    ON bundles (order_line_item_id);

CREATE INDEX IF NOT EXISTS idx_bundles_current_stage
    ON bundles (current_stage);

CREATE INDEX IF NOT EXISTS idx_bundles_status
    ON bundles (status);

CREATE INDEX IF NOT EXISTS idx_bundles_parent_bundle_id
    ON bundles (parent_bundle_id);

CREATE INDEX IF NOT EXISTS idx_stage_events_bundle_id
    ON stage_events (bundle_id);

CREATE INDEX IF NOT EXISTS idx_stage_events_department_id
    ON stage_events (department_id);

CREATE INDEX IF NOT EXISTS idx_stage_events_stage
    ON stage_events (stage);

-- =============================================================================
-- SEED: departments
-- =============================================================================
INSERT INTO departments (name, pin) VALUES
  ('Cutting',   '1111'),
  ('Stitching', '2222'),
  ('Finishing', '3333'),
  ('Ironing',   '4444'),
  ('Packing',   '5555'),
  ('Dispatch',  '6666'),
  ('QC',        '7777')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- VERIFICATION QUERIES
-- Run these separately to confirm setup:
--
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--   ORDER BY table_name;
--
-- SELECT COUNT(*) FROM departments;
--
-- SELECT name, pin FROM departments ORDER BY name;
--
-- SELECT indexname FROM pg_indexes
--   WHERE schemaname = 'public'
--   ORDER BY indexname;
-- =============================================================================
