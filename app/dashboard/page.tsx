import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Bundle, BundleStage, Order, OrderLineItem, StageEvent } from "@/types/database";
import { isOrderStuck } from "@/lib/utils/isOrderStuck";

export const metadata = {
  title: "Dashboard | ThreadOps",
};

const PIPELINE: BundleStage[] = [
  "received",
  "cutting",
  "stitching",
  "finishing",
  "ironing",
  "packing",
  "dispatch",
];

const STAGE_STYLES: Record<BundleStage, { label: string; color: string }> = {
  received: { label: "Received", color: "bg-sky-500" },
  cutting: { label: "Cutting", color: "bg-amber-500" },
  stitching: { label: "Stitching", color: "bg-violet-500" },
  finishing: { label: "Finishing", color: "bg-emerald-500" },
  ironing: { label: "Ironing", color: "bg-rose-500" },
  packing: { label: "Packing", color: "bg-indigo-500" },
  dispatch: { label: "Dispatch", color: "bg-teal-500" },
};

type StageProgress = {
  stage: BundleStage;
  quantity: number;
  percentage: number;
};

type DashboardOrder = Order & {
  lineItems: OrderLineItem[];
  bundles: Bundle[];
  totalQuantityOrdered: number;
  stageProgress: StageProgress[];
  /** Stuck-order detection result, computed from stage_events. */
  stuck: {
    isStuck: boolean;
    daysSinceLastMovement: number;
  };
};

type SupabaseErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
  name?: string;
};

function getSupabaseEndpoint(path: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) return path;

  try {
    const origin = new URL(supabaseUrl).origin;
    return `${origin}/rest/v1/${path}`;
  } catch {
    return `/rest/v1/${path}`;
  }
}

function logSupabaseError(
  context: string,
  error: SupabaseErrorLike,
  endpoint: string
) {
  console.error(context, {
    message: error.message ?? null,
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
    name: error.name ?? null,
    endpoint,
  });
}

function getSupabaseErrorMessage(context: string, error: SupabaseErrorLike) {
  return `${context}: ${error.message ?? error.details ?? error.code ?? "Unknown Supabase error"}`;
}

function formatPercent(value: number) {
  if (value === 0) return "0%";
  if (value < 1) return "<1%";
  return `${Math.round(value)}%`;
}

function getStageProgress(
  totalQuantityOrdered: number,
  bundles: Bundle[]
): StageProgress[] {
  return PIPELINE.map((stage) => {
    const quantity = bundles
      .filter((bundle) => bundle.current_stage === stage)
      .reduce((sum, bundle) => sum + bundle.quantity, 0);

    return {
      stage,
      quantity,
      percentage:
        totalQuantityOrdered > 0 ? (quantity / totalQuantityOrdered) * 100 : 0,
    };
  });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const ordersEndpoint = getSupabaseEndpoint(
    "orders?select=*&status=eq.active&order=deadline.asc"
  );

  const { data: rawOrders, error: ordersError } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "active")
    .order("deadline", { ascending: true });

  if (ordersError) {
    logSupabaseError("Error fetching active orders", ordersError, ordersEndpoint);
    throw new Error(
      getSupabaseErrorMessage("Failed to fetch active orders", ordersError)
    );
  }

  const orders = (rawOrders || []) as unknown as Order[];
  const orderIds = orders.map((order) => order.id);

  let lineItems: OrderLineItem[] = [];
  let bundles: Bundle[] = [];
  let stageEvents: StageEvent[] = [];

  if (orderIds.length > 0) {
    const lineItemsEndpoint = getSupabaseEndpoint(
      "order_line_items?select=*&order_id=in.(...)"
    );
    const { data: rawLineItems, error: lineItemsError } = await supabase
      .from("order_line_items")
      .select("*")
      .in("order_id", orderIds);

    if (lineItemsError) {
      logSupabaseError(
        "Error fetching dashboard line items",
        lineItemsError,
        lineItemsEndpoint
      );
      throw new Error(
        getSupabaseErrorMessage(
          "Failed to fetch dashboard line items",
          lineItemsError
        )
      );
    }

    lineItems = (rawLineItems || []) as unknown as OrderLineItem[];
    const lineItemIds = lineItems.map((item) => item.id);

    if (lineItemIds.length > 0) {
      const bundlesEndpoint = getSupabaseEndpoint(
        "bundles?select=*&order_line_item_id=in.(...)&status=in.(in_progress,rework)"
      );
      const { data: rawBundles, error: bundlesError } = await supabase
        .from("bundles")
        .select("*")
        .in("order_line_item_id", lineItemIds)
        .in("status", ["in_progress", "rework"]);

      if (bundlesError) {
        logSupabaseError(
          "Error fetching dashboard bundles",
          bundlesError,
          bundlesEndpoint
        );
        throw new Error(
          getSupabaseErrorMessage(
            "Failed to fetch dashboard bundles",
            bundlesError
          )
        );
      }

      bundles = (rawBundles || []) as unknown as Bundle[];

      // Fetch stage_events for all bundles so we can detect stuck orders.
      // Only bundle_id + created_at are needed for the stuck check.
      if (bundles.length > 0) {
        const bundleIds = bundles.map((b) => b.id);
        const stageEventsEndpoint = getSupabaseEndpoint(
          "stage_events?select=id,bundle_id,created_at&bundle_id=in.(...)"
        );
        const { data: rawStageEvents, error: stageEventsError } = await supabase
          .from("stage_events")
          .select("id, bundle_id, created_at")
          .in("bundle_id", bundleIds);

        if (stageEventsError) {
          logSupabaseError(
            "Error fetching dashboard stage events",
            stageEventsError,
            stageEventsEndpoint
          );
          throw new Error(
            getSupabaseErrorMessage(
              "Failed to fetch dashboard stage events",
              stageEventsError
            )
          );
        }

        stageEvents = (rawStageEvents || []) as unknown as StageEvent[];
      }
    }
  }

  const dashboardOrders: DashboardOrder[] = orders.map((order) => {
    const orderLineItems = lineItems.filter((item) => item.order_id === order.id);
    const orderLineItemIds = new Set(orderLineItems.map((item) => item.id));
    const orderBundles = bundles.filter((bundle) =>
      orderLineItemIds.has(bundle.order_line_item_id)
    );
    const totalQuantityOrdered = orderLineItems.reduce(
      (sum, item) => sum + item.quantity_ordered,
      0
    );

    return {
      ...order,
      lineItems: orderLineItems,
      bundles: orderBundles,
      totalQuantityOrdered,
      stageProgress: getStageProgress(totalQuantityOrdered, orderBundles),
      // Pass this order's bundles + the full events list (isOrderStuck filters internally)
      stuck: isOrderStuck(order, orderBundles, stageEvents),
    };
  });

  // Sort: stuck orders first (most stalled first), then non-stuck by deadline asc
  const sortedOrders = [...dashboardOrders].sort((a, b) => {
    if (a.stuck.isStuck && !b.stuck.isStuck) return -1;
    if (!a.stuck.isStuck && b.stuck.isStuck) return 1;
    if (a.stuck.isStuck && b.stuck.isStuck) {
      // Both stuck — show the most stalled one first
      return b.stuck.daysSinceLastMovement - a.stuck.daysSinceLastMovement;
    }
    // Both healthy — keep deadline-asc order (same as Supabase returned)
    return a.deadline < b.deadline ? -1 : a.deadline > b.deadline ? 1 : 0;
  });

  return (
    <main className="p-6 md:p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-2 text-lg">
            Active production orders by current unit location.
          </p>
        </div>
        <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
          {dashboardOrders.length} active order
          {dashboardOrders.length !== 1 ? "s" : ""}
        </div>
      </div>

      {sortedOrders.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-10 text-center shadow-sm">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
            No active orders
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 mt-2">
            Active production orders will appear here once they are created.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {sortedOrders.map((order) => {
            const { isStuck, daysSinceLastMovement } = order.stuck;
            // Floor to whole days for the human-readable badge
            const stuckDays = Math.floor(daysSinceLastMovement);

            return (
              <article
                key={order.id}
                className={[
                  "rounded-xl shadow-sm p-6 border",
                  isStuck
                    ? "border-l-4 border-amber-400 dark:border-amber-500 bg-amber-50/40 dark:bg-amber-950/20"
                    : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900",
                ].join(" ")}
              >
                <div className="flex flex-col gap-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                          {order.buyer}
                        </p>
                        {isStuck && (
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
                        )}
                      </div>
                      <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">
                        {order.style_code}
                      </h2>
                    </div>
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="shrink-0 rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      View Details
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-neutral-500 dark:text-neutral-400">
                        Deadline
                      </p>
                      <p className="text-neutral-900 dark:text-white mt-1 font-semibold">
                        {order.deadline}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-neutral-500 dark:text-neutral-400">
                        Total Ordered
                      </p>
                      <p className="text-neutral-900 dark:text-white mt-1 font-semibold">
                        {order.totalQuantityOrdered}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="h-6 w-full overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-800 flex">
                      {order.stageProgress.map(({ stage, quantity, percentage }) =>
                        quantity > 0 ? (
                          <div
                            key={stage}
                            className={`${STAGE_STYLES[stage].color} h-full min-w-1`}
                            style={{ width: `${percentage}%` }}
                            title={`${STAGE_STYLES[stage].label}: ${quantity} units (${formatPercent(
                              percentage
                            )})`}
                          />
                        ) : null
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {order.stageProgress.map(({ stage, quantity, percentage }) => (
                        <div key={stage} className="flex items-center gap-2 min-w-0">
                          <span
                            className={`${STAGE_STYLES[stage].color} h-3 w-3 rounded-sm shrink-0`}
                          />
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
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
