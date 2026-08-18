/**
 * StageProgressBar — shared component used on both the dashboard overview
 * and the order drill-down page. Renders the segmented stage bar + legend.
 *
 * All stage colors and labels are defined here as the single source of truth.
 * Import STAGE_STYLES and PIPELINE from this file wherever you need them.
 */

import type { BundleStage } from "@/types/database";

// ---------------------------------------------------------------------------
// Stage metadata — single source of truth for colors across the whole app
// ---------------------------------------------------------------------------

export const PIPELINE: BundleStage[] = [
  "received",
  "cutting",
  "stitching",
  "finishing",
  "ironing",
  "packing",
  "dispatch",
];

export const STAGE_STYLES: Record<BundleStage, { label: string; color: string }> = {
  received:  { label: "Received",  color: "bg-sky-500"     },
  cutting:   { label: "Cutting",   color: "bg-amber-500"   },
  stitching: { label: "Stitching", color: "bg-violet-500"  },
  finishing: { label: "Finishing", color: "bg-emerald-500" },
  ironing:   { label: "Ironing",   color: "bg-rose-500"    },
  packing:   { label: "Packing",   color: "bg-indigo-500"  },
  dispatch:  { label: "Dispatch",  color: "bg-teal-500"    },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export type StageProgress = {
  stage: BundleStage;
  quantity: number;
  percentage: number;
};

export function formatPercent(value: number): string {
  if (value === 0) return "0%";
  if (value < 1) return "<1%";
  return `${Math.round(value)}%`;
}

/**
 * Derive per-stage quantity/percentage from a list of bundles.
 * `bundles` should only be the bundles belonging to this specific order.
 *
 * Rework bundles (those with a non-null `parent_bundle_id`) are intentionally
 * excluded from this calculation. When a bundle has rejected units the floor
 * action (1) trims the original bundle's quantity to the units that passed and
 * (2) creates a child rework bundle for the rejected quantity. Including both
 * would double-count those rejected units — the rework child's quantity is
 * already "carved out" of the original bundle's updated quantity. Excluding
 * rework bundles keeps the bar denominator equal to totalQuantityOrdered and
 * prevents the bar from ever exceeding 100%.
 */
export function computeStageProgress(
  totalQuantityOrdered: number,
  bundles: { current_stage: BundleStage; quantity: number; parent_bundle_id: string | null }[]
): StageProgress[] {
  // Only count top-level (original) bundles — rework children are subsets of
  // units already represented in their trimmed parent bundle.
  const originalBundles = bundles.filter((b) => b.parent_bundle_id === null);

  return PIPELINE.map((stage) => {
    const quantity = originalBundles
      .filter((b) => b.current_stage === stage)
      .reduce((sum, b) => sum + b.quantity, 0);
    return {
      stage,
      quantity,
      percentage: totalQuantityOrdered > 0 ? (quantity / totalQuantityOrdered) * 100 : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface StageProgressBarProps {
  stageProgress: StageProgress[];
  /** When true, shows the legend grid below the bar. Defaults to true. */
  showLegend?: boolean;
}

export function StageProgressBar({
  stageProgress,
  showLegend = true,
}: StageProgressBarProps) {
  return (
    <div>
      {/* Segmented bar */}
      <div className="h-6 w-full overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800 flex">
        {stageProgress.map(({ stage, quantity, percentage }) =>
          quantity > 0 ? (
            <div
              key={stage}
              className={`${STAGE_STYLES[stage].color} h-full min-w-1`}
              style={{ width: `${percentage}%` }}
              title={`${STAGE_STYLES[stage].label}: ${quantity} units (${formatPercent(percentage)})`}
            />
          ) : null
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {stageProgress.map(({ stage, quantity, percentage }) => (
            <div key={stage} className="flex items-center gap-2 min-w-0">
              <span className={`${STAGE_STYLES[stage].color} h-3 w-3 rounded-sm shrink-0`} />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 truncate">
                  {STAGE_STYLES[stage].label}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {quantity} / {formatPercent(percentage)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
