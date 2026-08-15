import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Bundle, BundleStage, Order, OrderLineItem } from "@/types/database";

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
    };
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

      {dashboardOrders.length === 0 ? (
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
          {dashboardOrders.map((order) => (
            <article
              key={order.id}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm p-6"
            >
              <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                      {order.buyer}
                    </p>
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
          ))}
        </div>
      )}
    </main>
  );
}
