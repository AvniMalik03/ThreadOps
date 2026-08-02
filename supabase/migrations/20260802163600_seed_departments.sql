-- =============================================================================
-- ThreadOps: Seed — Departments
-- Migration: 20260802163600_seed_departments.sql
-- =============================================================================
-- Insert the 7 production departments with development PINs.
-- ON CONFLICT DO NOTHING prevents duplicate inserts on re-runs.
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
