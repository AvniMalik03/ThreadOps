-- =============================================================================
-- ThreadOps: Initial Production Database Schema
-- Migration: 20260802163555_initial_schema.sql
-- =============================================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =============================================================================
-- TABLE: departments
-- Represents production floor departments (e.g. Cutting, Stitching, QC).
-- Workers log in via department PIN on the floor tablet.
-- =============================================================================
CREATE TABLE departments (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text        NOT NULL UNIQUE,
    pin         text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);


-- =============================================================================
-- TABLE: orders
-- A buyer order for a specific garment style with a delivery deadline.
-- =============================================================================
CREATE TABLE orders (
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
-- A size/colour variant within an order, specifying how many units are required.
-- =============================================================================
CREATE TABLE order_line_items (
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
-- A physical bundle of cut panels moving through production stages.
-- A bundle may be split into child bundles (parent_bundle_id self-reference).
-- =============================================================================
CREATE TABLE bundles (
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
-- An immutable audit log of every stage transition for a bundle.
-- Records how many units passed or were rejected at each stage.
-- =============================================================================
CREATE TABLE stage_events (
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
-- Optimised for floor dashboard and owner dashboard query patterns.
-- =============================================================================

-- orders
CREATE INDEX idx_orders_status
    ON orders (status);

-- order_line_items
CREATE INDEX idx_order_line_items_order_id
    ON order_line_items (order_id);

-- bundles
CREATE INDEX idx_bundles_order_line_item_id
    ON bundles (order_line_item_id);

CREATE INDEX idx_bundles_current_stage
    ON bundles (current_stage);

CREATE INDEX idx_bundles_status
    ON bundles (status);

CREATE INDEX idx_bundles_parent_bundle_id
    ON bundles (parent_bundle_id);

-- stage_events
CREATE INDEX idx_stage_events_bundle_id
    ON stage_events (bundle_id);

CREATE INDEX idx_stage_events_department_id
    ON stage_events (department_id);

CREATE INDEX idx_stage_events_stage
    ON stage_events (stage);
