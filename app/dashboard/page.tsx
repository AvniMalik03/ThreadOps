import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Bundle, Order, OrderLineItem, StageEvent } from "@/types/database";
import { isOrderStuck } from "@/lib/utils/isOrderStuck";
import {
  StageProgressBar,
  computeStageProgress,
} from "@/components/shared/StageProgressBar";
import { StuckBadge } from "@/components/shared/StuckBadge";

export const metadata = {
  title: "Dashboard | ThreadOps",
};

type DashboardOrder = Order & {
  lineItems: OrderLineItem[];
  bundles: Bundle[];
  totalQuantityOrdered: number;
  stageProgress: ReturnType<typeof computeStageProgress>;
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

function logSupabaseError(context: string, error: SupabaseErrorLike, endpoint: string) {
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
    throw new Error(getSupabaseErrorMessage("Failed to fetch active orders", ordersError));
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
      logSupabaseError("Error fetching dashboard line items", lineItemsError, lineItemsEndpoint);
      throw new Error(getSupabaseErrorMessage("Failed to fetch dashboard line items", lineItemsError));
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
        logSupabaseError("Error fetching dashboard bundles", bundlesError, bundlesEndpoint);
        throw new Error(getSupabaseErrorMessage("Failed to fetch dashboard bundles", bundlesError));
      }

      bundles = (rawBundles || []) as unknown as Bundle[];

      // Fetch stage_events for stuck-order detection
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
          logSupabaseError("Error fetching dashboard stage events", stageEventsError, stageEventsEndpoint);
          throw new Error(getSupabaseErrorMessage("Failed to fetch dashboard stage events", stageEventsError));
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
      stageProgress: computeStageProgress(totalQuantityOrdered, orderBundles),
      stuck: isOrderStuck(order, orderBundles, stageEvents),
    };
  });

  // Sort: stuck orders first (most stalled first), then non-stuck by deadline asc
  const sortedOrders = [...dashboardOrders].sort((a, b) => {
    if (a.stuck.isStuck && !b.stuck.isStuck) return -1;
    if (!a.stuck.isStuck && b.stuck.isStuck) return 1;
    if (a.stuck.isStuck && b.stuck.isStuck) {
      return b.stuck.daysSinceLastMovement - a.stuck.daysSinceLastMovement;
    }
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
        <div className="flex flex-col md:items-end gap-2">
          <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            {dashboardOrders.length} active order
            {dashboardOrders.length !== 1 ? "s" : ""}
          </div>
          <Link
            href="/dashboard/activity"
            className="text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            View Activity Log &rarr;
          </Link>
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
                        <StuckBadge
                          isStuck={isStuck}
                          daysSinceLastMovement={daysSinceLastMovement}
                        />
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

                  <StageProgressBar stageProgress={order.stageProgress} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
