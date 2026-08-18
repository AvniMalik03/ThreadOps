/**
 * isOrderStuck.ts
 *
 * Pure utility that determines whether a production order is "stuck"
 * (i.e. has had no bundle stage_event activity for more than
 * STUCK_THRESHOLD_DAYS days).
 *
 * No side effects — safe to call in server components, client components,
 * and unit tests alike.
 */

import { STUCK_THRESHOLD_DAYS } from "@/constants";
import type { Bundle, StageEvent, Order } from "@/types/database";

export interface OrderStuckResult {
  isStuck: boolean;
  /** Fractional days since the most recent activity (event or order creation). */
  daysSinceLastMovement: number;
}

/**
 * Determines whether an order is stuck.
 *
 * Algorithm:
 * 1. Collect the `created_at` timestamp of every stage_event that belongs
 *    to any bundle in this order.
 * 2. If there are events, use the most recent one.
 * 3. If there are NO events at all, fall back to the order's own `created_at`
 *    (an order with zero movement since creation is also considered stuck
 *    once the threshold passes).
 * 4. Compare that timestamp to now; if the gap exceeds STUCK_THRESHOLD_DAYS,
 *    the order is stuck.
 *
 * @param order        The raw Order row (needs `created_at`).
 * @param bundles      All Bundle rows that belong to this order's line items.
 * @param stageEvents  All StageEvent rows for those bundles.
 */
export function isOrderStuck(
  order: Pick<Order, "created_at">,
  bundles: Pick<Bundle, "id">[],
  stageEvents: Pick<StageEvent, "bundle_id" | "created_at">[]
): OrderStuckResult {
  const bundleIdSet = new Set(bundles.map((b) => b.id));

  // Only consider events that belong to this order's bundles
  const relevantEvents = stageEvents.filter((e) =>
    bundleIdSet.has(e.bundle_id)
  );

  let referenceTimestamp: string;

  if (relevantEvents.length > 0) {
    // Find the most recent event timestamp
    referenceTimestamp = relevantEvents.reduce((latest, event) =>
      event.created_at > latest.created_at ? event : latest
    ).created_at;
  } else {
    // No events at all — fall back to order creation time
    referenceTimestamp = order.created_at;
  }

  const nowMs = Date.now();
  const referenceMs = new Date(referenceTimestamp).getTime();
  const daysSinceLastMovement = (nowMs - referenceMs) / (1000 * 60 * 60 * 24);

  return {
    isStuck: daysSinceLastMovement > STUCK_THRESHOLD_DAYS,
    daysSinceLastMovement,
  };
}
