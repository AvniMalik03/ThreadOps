/**
 * ThreadOps — Supabase Database Types
 *
 * Hand-authored to match the schema in:
 *   supabase/migrations/20260802163555_initial_schema.sql
 *
 * Replace this file with the CLI-generated version once the project
 * is linked:
 *   npx supabase gen types typescript --linked > types/database.ts
 */

// ---------------------------------------------------------------------------
// Primitive aliases
// ---------------------------------------------------------------------------

export type UUID = string;
export type Timestamptz = string; // ISO-8601 string as returned by Supabase

// ---------------------------------------------------------------------------
// CHECK-constraint string unions
// ---------------------------------------------------------------------------

export type OrderStatus = "active" | "completed" | "cancelled";

export type BundleStage =
  | "received"
  | "cutting"
  | "stitching"
  | "finishing"
  | "ironing"
  | "packing"
  | "dispatch";

export type BundleStatus = "in_progress" | "rework" | "completed";

// ---------------------------------------------------------------------------
// Row types  (what Supabase SELECT returns)
// ---------------------------------------------------------------------------

export interface Department {
  id: UUID;
  name: string;
  pin: string;
  created_at: Timestamptz;
}

export interface Order {
  id: UUID;
  buyer: string;
  style_code: string;
  /** ISO-8601 date string, e.g. "2026-12-31" */
  deadline: string;
  status: OrderStatus;
  created_at: Timestamptz;
}

export interface OrderLineItem {
  id: UUID;
  order_id: UUID;
  size: string;
  color: string;
  quantity_ordered: number;
  created_at: Timestamptz;
}

export interface Bundle {
  id: UUID;
  order_line_item_id: UUID;
  bundle_number: number;
  quantity: number;
  current_stage: BundleStage;
  status: BundleStatus;
  /** NULL for top-level bundles; set for split child bundles */
  parent_bundle_id: UUID | null;
  created_at: Timestamptz;
}

export interface StageEvent {
  id: UUID;
  bundle_id: UUID;
  stage: BundleStage;
  quantity_passed: number;
  quantity_rejected: number;
  department_id: UUID;
  created_at: Timestamptz;
}

// ---------------------------------------------------------------------------
// Insert types  (what you pass to Supabase INSERT)
// ---------------------------------------------------------------------------

export interface DepartmentInsert {
  id?: UUID;
  name: string;
  pin: string;
  created_at?: Timestamptz;
}

export interface OrderInsert {
  id?: UUID;
  buyer: string;
  style_code: string;
  deadline: string;
  status?: OrderStatus;
  created_at?: Timestamptz;
}

export interface OrderLineItemInsert {
  id?: UUID;
  order_id: UUID;
  size: string;
  color: string;
  quantity_ordered: number;
  created_at?: Timestamptz;
}

export interface BundleInsert {
  id?: UUID;
  order_line_item_id: UUID;
  bundle_number: number;
  quantity: number;
  current_stage?: BundleStage;
  status?: BundleStatus;
  parent_bundle_id?: UUID | null;
  created_at?: Timestamptz;
}

export interface StageEventInsert {
  id?: UUID;
  bundle_id: UUID;
  stage: BundleStage;
  quantity_passed: number;
  quantity_rejected?: number;
  department_id: UUID;
  created_at?: Timestamptz;
}

// ---------------------------------------------------------------------------
// Update types  (what you pass to Supabase UPDATE — all fields optional)
// ---------------------------------------------------------------------------

export type DepartmentUpdate = Partial<Omit<DepartmentInsert, "id">>;
export type OrderUpdate = Partial<Omit<OrderInsert, "id">>;
export type OrderLineItemUpdate = Partial<Omit<OrderLineItemInsert, "id">>;
export type BundleUpdate = Partial<Omit<BundleInsert, "id">>;
export type StageEventUpdate = Partial<Omit<StageEventInsert, "id">>;

// ---------------------------------------------------------------------------
// Supabase Database shape  (for createClient<Database>())
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: Department;
        Insert: DepartmentInsert;
        Update: DepartmentUpdate;
        Relationships: any[];
      };
      orders: {
        Row: Order;
        Insert: OrderInsert;
        Update: OrderUpdate;
        Relationships: any[];
      };
      order_line_items: {
        Row: OrderLineItem;
        Insert: OrderLineItemInsert;
        Update: OrderLineItemUpdate;
        Relationships: any[];
      };
      bundles: {
        Row: Bundle;
        Insert: BundleInsert;
        Update: BundleUpdate;
        Relationships: any[];
      };
      stage_events: {
        Row: StageEvent;
        Insert: StageEventInsert;
        Update: StageEventUpdate;
        Relationships: any[];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
