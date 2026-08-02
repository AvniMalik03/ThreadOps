/**
 * Global type definitions for ThreadOps.
 * Database types are generated from the Supabase schema.
 */

// Re-export all database types for convenient imports
export type {
  Database,
  // Primitive aliases
  UUID,
  Timestamptz,
  // String unions
  OrderStatus,
  BundleStage,
  BundleStatus,
  // Row types
  Department,
  Order,
  OrderLineItem,
  Bundle,
  StageEvent,
  // Insert types
  DepartmentInsert,
  OrderInsert,
  OrderLineItemInsert,
  BundleInsert,
  StageEventInsert,
  // Update types
  DepartmentUpdate,
  OrderUpdate,
  OrderLineItemUpdate,
  BundleUpdate,
  StageEventUpdate,
} from "./database";
