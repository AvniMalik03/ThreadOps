/**
 * Shared utility functions for ThreadOps.
 * Add reusable helpers here as the project grows.
 */

/**
 * Formats an ISO date string into a human-readable format.
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Creates a sleep/delay promise for use with async/await.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
