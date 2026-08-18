/**
 * Application-wide constants for ThreadOps.
 * Add shared constants here as the project grows.
 */

export const APP_NAME = "ThreadOps" as const;

export const APP_DESCRIPTION =
  "Real-time Garment Production Workflow Management System" as const;

/**
 * Number of days without any bundle stage_event activity before an order
 * is considered "stuck". Used by the dashboard early-warning system.
 * Change this single value to adjust the threshold globally.
 */
export const STUCK_THRESHOLD_DAYS = 3;
