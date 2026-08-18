"use client";

/**
 * BundleRow — client component rendered inside the order drill-down page.
 *
 * Each row shows bundle metadata; clicking it expands an inline
 * chronological stage_events timeline for that bundle.
 *
 * Kept as a client component so the expand/collapse toggle works without
 * a full page reload, while the parent page stays a server component.
 */

import { useState } from "react";
import { STAGE_STYLES } from "@/components/shared/StageProgressBar";
import type { BundleStage, BundleStatus } from "@/types/database";

// ---------------------------------------------------------------------------
// Types (plain data — no Supabase imports needed here)
// ---------------------------------------------------------------------------

export interface BundleRowData {
  id: string;
  bundle_number: number;
  quantity: number;
  current_stage: BundleStage;
  status: BundleStatus;
  parent_bundle_id: string | null;
  /** bundle_number of the parent bundle, resolved server-side */
  parent_bundle_number: number | null;
  events: StageEventData[];
}

export interface StageEventData {
  id: string;
  stage: BundleStage;
  quantity_passed: number;
  quantity_rejected: number;
  department_name: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Stage badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<BundleStatus, { label: string; classes: string }> = {
  in_progress: {
    label: "In Progress",
    classes:
      "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 ring-sky-300 dark:ring-sky-700",
  },
  rework: {
    label: "Rework",
    classes:
      "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 ring-rose-300 dark:ring-rose-700",
  },
  completed: {
    label: "Completed",
    classes:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 ring-emerald-300 dark:ring-emerald-700",
  },
};

function StageBadge({ stage }: { stage: BundleStage }) {
  const { label, color } = STAGE_STYLES[stage];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-sm ${color}`} />
      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
        {label}
      </span>
    </span>
  );
}

function StatusPill({ status }: { status: BundleStatus }) {
  const { label, classes } = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${classes}`}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Timeline row
// ---------------------------------------------------------------------------

function EventRow({ event, index }: { event: StageEventData; index: number }) {
  const date = new Date(event.created_at);
  const formattedDate = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const isFirst = index === 0;

  return (
    <div className="flex gap-3">
      {/* Timeline spine */}
      <div className="flex flex-col items-center">
        <div
          className={`h-2 w-2 rounded-full mt-1 shrink-0 ${STAGE_STYLES[event.stage].color}`}
        />
        {/* connector line — shown for all but last, handled by parent */}
        <div className="flex-1 w-px bg-neutral-200 dark:bg-neutral-700 mt-1" />
      </div>

      {/* Content */}
      <div className="pb-4 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            {STAGE_STYLES[event.stage].label}
          </span>
          {event.quantity_rejected > 0 && (
            <span className="rounded-full bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-300 dark:ring-rose-700">
              {event.quantity_rejected} rejected
            </span>
          )}
        </div>
        <div className="text-xs text-neutral-500 dark:text-neutral-400 space-y-0.5">
          <p>
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              {event.quantity_passed}
            </span>{" "}
            units passed
            {event.quantity_rejected > 0 && (
              <>
                ,{" "}
                <span className="font-medium text-rose-600 dark:text-rose-400">
                  {event.quantity_rejected}
                </span>{" "}
                rejected
              </>
            )}
          </p>
          <p>
            Dept:{" "}
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              {event.department_name}
            </span>
          </p>
          <p>
            {formattedDate} at {formattedTime}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function BundleRow({ bundle }: { bundle: BundleRowData }) {
  const [expanded, setExpanded] = useState(false);
  const hasEvents = bundle.events.length > 0;

  return (
    <div
      className={`border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden transition-colors ${
        bundle.status === "rework"
          ? "border-l-4 border-l-rose-400 dark:border-l-rose-600"
          : ""
      }`}
    >
      {/* Bundle header row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500"
        aria-expanded={expanded}
      >
        {/* Chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 ${
            expanded ? "rotate-90" : ""
          }`}
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>

        {/* Bundle # */}
        <span className="w-20 shrink-0 text-sm font-bold text-neutral-900 dark:text-white">
          Bundle #{bundle.bundle_number}
        </span>

        {/* Qty */}
        <span className="w-24 shrink-0 text-sm text-neutral-600 dark:text-neutral-300">
          {bundle.quantity} units
        </span>

        {/* Stage */}
        <span className="flex-1 min-w-0">
          <StageBadge stage={bundle.current_stage} />
        </span>

        {/* Status */}
        <span className="shrink-0">
          <StatusPill status={bundle.status} />
        </span>

        {/* Event count hint */}
        <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500 tabular-nums">
          {hasEvents
            ? `${bundle.events.length} event${bundle.events.length !== 1 ? "s" : ""}`
            : "no history"}
        </span>
      </button>

      {/* Rework parent note */}
      {bundle.parent_bundle_number !== null && (
        <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/30 border-t border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-medium">
          ↳ Rework from Bundle #{bundle.parent_bundle_number}
        </div>
      )}

      {/* Expandable history */}
      {expanded && (
        <div className="border-t border-neutral-200 dark:border-neutral-700 px-4 pt-4 pb-1 bg-neutral-50/50 dark:bg-neutral-900/50">
          {hasEvents ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3">
                Stage History
              </p>
              <div>
                {bundle.events.map((event, i) => (
                  <EventRow key={event.id} event={event} index={i} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 pb-4">
              No stage events recorded yet for this bundle.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
