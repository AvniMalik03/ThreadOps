import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Bundle, Department, Order, OrderLineItem, StageEvent } from "@/types/database";
import { isOrderStuck } from "@/lib/utils/isOrderStuck";
import {
  StageProgressBar,
  computeStageProgress,
} from "@/components/shared/StageProgressBar";
import { StuckBadge } from "@/components/shared/StuckBadge";
import { BundleRow } from "@/components/shared/BundleRow";
import type { BundleRowData } from "@/components/shared/BundleRow";

export const metadata = {
  title: "Order Details | ThreadOps",
};

const ORDER_STATUS_STYLES: Record<string, string> = {
  active:    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 ring-emerald-300 dark:ring-emerald-700",
  completed: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 ring-neutral-300 dark:ring-neutral-600",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 ring-rose-300 dark:ring-rose-700",
};

export default async function OrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rawOrder, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (orderError || !rawOrder) {
    notFound();
  }
  const order = rawOrder as unknown as Order;

  const { data: rawLineItems } = await supabase
    .from("order_line_items")
    .select("*")
    .eq("order_id", id)
    .order("size", { ascending: true });

  const lineItems = (rawLineItems || []) as unknown as OrderLineItem[];
  const lineItemIds = lineItems.map((li) => li.id);

  let bundles: Bundle[] = [];
  let stageEvents: StageEvent[] = [];
  let departments: Department[] = [];

  if (lineItemIds.length > 0) {
    const [bundlesResult, deptResult] = await Promise.all([
      supabase
        .from("bundles")
        .select("*")
        .in("order_line_item_id", lineItemIds)
        .order("bundle_number", { ascending: true }),
      supabase.from("departments").select("id, name"),
    ]);

    bundles = (bundlesResult.data || []) as unknown as Bundle[];
    departments = (deptResult.data || []) as unknown as Department[];

    if (bundles.length > 0) {
      const bundleIds = bundles.map((b) => b.id);
      const { data: rawEvents } = await supabase
        .from("stage_events")
        .select("*")
        .in("bundle_id", bundleIds)
        .order("created_at", { ascending: true });

      stageEvents = (rawEvents || []) as unknown as StageEvent[];
    }
  }

  const totalQuantityOrdered = lineItems.reduce(
    (sum, li) => sum + li.quantity_ordered,
    0
  );

  const stageProgress = computeStageProgress(totalQuantityOrdered, bundles);
  const stuckResult = isOrderStuck(order, bundles, stageEvents);

  const deptById = new Map(departments.map((d) => [d.id, d.name]));
  const bundleNumberById = new Map(bundles.map((b) => [b.id, b.bundle_number]));

  const eventsByBundleId = new Map<string, StageEvent[]>();
  for (const event of stageEvents) {
    const list = eventsByBundleId.get(event.bundle_id) ?? [];
    list.push(event);
    eventsByBundleId.set(event.bundle_id, list);
  }

  const bundleRowData: BundleRowData[] = bundles.map((bundle) => {
    const events = eventsByBundleId.get(bundle.id) ?? [];
    return {
      id: bundle.id,
      bundle_number: bundle.bundle_number,
      quantity: bundle.quantity,
      current_stage: bundle.current_stage,
      status: bundle.status,
      parent_bundle_id: bundle.parent_bundle_id,
      parent_bundle_number: bundle.parent_bundle_id
        ? (bundleNumberById.get(bundle.parent_bundle_id) ?? null)
        : null,
      events: events.map((e) => ({
        id: e.id,
        stage: e.stage,
        quantity_passed: e.quantity_passed,
        quantity_rejected: e.quantity_rejected,
        department_name: deptById.get(e.department_id) ?? "Unknown",
        created_at: e.created_at,
      })),
    };
  });

  const bundlesByLineItemId = new Map<string, BundleRowData[]>();
  for (const b of bundleRowData) {
    const rawBundle = bundles.find((raw) => raw.id === b.id);
    if (!rawBundle) continue;
    const lineItemId = rawBundle.order_line_item_id;
    const list = bundlesByLineItemId.get(lineItemId) ?? [];
    list.push(b);
    bundlesByLineItemId.set(lineItemId, list);
  }

  return (
    <main className="p-6 md:p-8 max-w-6xl mx-auto w-full">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      <div
        className={[
          "rounded-xl shadow-sm p-6 mb-8 border",
          stuckResult.isStuck
            ? "border-l-4 border-amber-400 dark:border-amber-500 bg-amber-50/40 dark:bg-amber-950/20"
            : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800",
        ].join(" ")}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                {order.buyer}
              </p>
              <span
                className={"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset capitalize " +
                  (ORDER_STATUS_STYLES[order.status] ?? ORDER_STATUS_STYLES.active)}
              >
                {order.status}
              </span>
              <StuckBadge
                isStuck={stuckResult.isStuck}
                daysSinceLastMovement={stuckResult.daysSinceLastMovement}
              />
            </div>
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">
              {order.style_code}
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1">
              Deadline
            </p>
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">
              {order.deadline}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1">
              Total Units
            </p>
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">
              {totalQuantityOrdered.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1">
              Line Items
            </p>
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">
              {lineItems.length}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1">
              Total Bundles
            </p>
            <p className="text-sm font-semibold text-neutral-900 dark:text-white">
              {bundles.length}
            </p>
          </div>
        </div>

        <StageProgressBar stageProgress={stageProgress} />
      </div>

      <div className="flex flex-col gap-6">
        {lineItems.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-10 text-center shadow-sm">
            <p className="text-neutral-500 dark:text-neutral-400">
              No line items found for this order.
            </p>
          </div>
        ) : (
          lineItems.map((item) => {
            const itemBundles = bundlesByLineItemId.get(item.id) ?? [];

            return (
              <section
                key={item.id}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm overflow-hidden"
              >
                <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-0.5">
                      Size / Color
                    </p>
                    <p className="text-base font-bold text-neutral-900 dark:text-white">
                      {item.size} / {item.color}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="font-medium text-neutral-500 dark:text-neutral-400">Ordered:</span>{" "}
                      <span className="font-bold text-neutral-900 dark:text-white">{item.quantity_ordered}</span>
                    </div>
                    <div>
                      <span className="font-medium text-neutral-500 dark:text-neutral-400">Bundles:</span>{" "}
                      <span className="font-bold text-neutral-900 dark:text-white">{itemBundles.length}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 flex flex-col gap-2">
                  {itemBundles.length === 0 ? (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">
                      No bundles generated for this line item.
                    </p>
                  ) : (
                    itemBundles.map((bundle) => (
                      <BundleRow key={bundle.id} bundle={bundle} />
                    ))
                  )}
                </div>
              </section>
            );
          })
        )}
      </div>
    </main>
  );
}
