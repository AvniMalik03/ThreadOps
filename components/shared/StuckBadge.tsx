/**
 * StuckBadge — shared presentational component.
 *
 * Renders the amber warning pill shown on the dashboard and order detail page
 * when an order has had no bundle movement beyond STUCK_THRESHOLD_DAYS.
 *
 * Pass `isStuck={false}` (or omit) and nothing is rendered — the absence of
 * the badge is the "healthy" state, by design.
 */

interface StuckBadgeProps {
  isStuck: boolean;
  daysSinceLastMovement: number;
}

export function StuckBadge({ isStuck, daysSinceLastMovement }: StuckBadgeProps) {
  if (!isStuck) return null;

  const stuckDays = Math.floor(daysSinceLastMovement);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300 ring-1 ring-inset ring-amber-300 dark:ring-amber-700">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-3.5 w-3.5 shrink-0"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
      No movement in {stuckDays} day{stuckDays !== 1 ? "s" : ""}
    </span>
  );
}
