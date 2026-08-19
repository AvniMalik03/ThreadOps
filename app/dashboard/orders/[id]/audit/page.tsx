import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PrintButton } from "@/components/shared/PrintButton";
import { STAGE_STYLES } from "@/components/shared/StageProgressBar";
import type { Bundle, Department, Order, OrderLineItem, StageEvent } from "@/types/database";

export const metadata = {
  title: "Order Audit Trail | ThreadOps",
};

const ORDER_STATUS_STYLES: Record<string, string> = {
  active:    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 ring-emerald-300 dark:ring-emerald-700",
  completed: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 ring-neutral-300 dark:ring-neutral-600",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 ring-rose-300 dark:ring-rose-700",
};

interface CombinedEvent {
  event: StageEvent;
  bundle: Bundle;
  lineItem: OrderLineItem;
  departmentName: string;
  parentBundleNumber: number | null;
}

export default async function OrderAuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch Order
  const { data: rawOrder, error: orderError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (orderError || !rawOrder) {
    notFound();
  }
  const order = rawOrder as unknown as Order;

  // Fetch Line Items
  const { data: rawLineItems } = await supabase
    .from("order_line_items")
    .select("*")
    .eq("order_id", id);
  const lineItems = (rawLineItems || []) as unknown as OrderLineItem[];
  const lineItemIds = lineItems.map((li) => li.id);
  const lineItemsById = new Map(lineItems.map((li) => [li.id, li]));

  let bundles: Bundle[] = [];
  let stageEvents: StageEvent[] = [];
  let departments: Department[] = [];

  if (lineItemIds.length > 0) {
    const [bundlesResult, deptResult] = await Promise.all([
      supabase
        .from("bundles")
        .select("*")
        .in("order_line_item_id", lineItemIds),
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
        .order("created_at", { ascending: true }); // Server-side sorting

      stageEvents = (rawEvents || []) as unknown as StageEvent[];
    }
  }

  const totalQuantityOrdered = lineItems.reduce(
    (sum, li) => sum + li.quantity_ordered,
    0
  );

  const deptById = new Map(departments.map((d) => [d.id, d.name]));
  const bundleById = new Map(bundles.map((b) => [b.id, b]));

  // Combine data into a single timeline array
  const combinedTimeline: CombinedEvent[] = stageEvents
    .map((event) => {
      const bundle = bundleById.get(event.bundle_id);
      if (!bundle) return null;
      
      const lineItem = lineItemsById.get(bundle.order_line_item_id);
      if (!lineItem) return null;

      const parentBundleNumber = bundle.parent_bundle_id 
        ? bundleById.get(bundle.parent_bundle_id)?.bundle_number ?? null
        : null;

      return {
        event,
        bundle,
        lineItem,
        departmentName: deptById.get(event.department_id) ?? "Unknown",
        parentBundleNumber,
      };
    })
    .filter((e): e is CombinedEvent => e !== null);

  // Fallback sort just in case, though DB order is used above.
  combinedTimeline.sort(
    (a, b) => new Date(a.event.created_at).getTime() - new Date(b.event.created_at).getTime()
  );

  return (
    <main className="p-6 md:p-8 max-w-4xl mx-auto w-full bg-white dark:bg-neutral-950 min-h-screen text-neutral-900 dark:text-neutral-100 print:bg-white print:text-black print:p-0">
      {/* Non-printable header actions */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link
          href={`/dashboard/orders/${id}`}
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
          Back to Order
        </Link>
        <PrintButton />
      </div>

      {/* Order Summary Header */}
      <div className="rounded-xl shadow-sm p-6 mb-8 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 print:shadow-none print:border-neutral-300 print:border-2 print:rounded-none print:break-inside-avoid">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 print:text-neutral-600">
                {order.buyer}
              </p>
              <span
                className={
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset capitalize print:border print:border-neutral-400 print:text-black print:bg-transparent " +
                  (ORDER_STATUS_STYLES[order.status] ?? ORDER_STATUS_STYLES.active)
                }
              >
                {order.status}
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight print:text-black">
              {order.style_code} - Production Audit Trail
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 print:text-neutral-600 mb-1">
              Deadline
            </p>
            <p className="text-sm font-semibold print:text-black">
              {order.deadline}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 print:text-neutral-600 mb-1">
              Total Units
            </p>
            <p className="text-sm font-semibold print:text-black">
              {totalQuantityOrdered.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Audit Timeline */}
      <div className="print:block">
        <h2 className="text-lg font-bold mb-6 print:text-black border-b pb-2 border-neutral-200 dark:border-neutral-800 print:border-neutral-400">
          Complete Production Timeline
        </h2>

        {combinedTimeline.length === 0 ? (
          <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl p-8 text-center print:border-neutral-300 print:bg-white">
            <p className="text-neutral-500 dark:text-neutral-400 print:text-neutral-600">
              No production events recorded yet.
            </p>
          </div>
        ) : (
          <div className="relative space-y-6">
            <div className="absolute left-[19px] top-4 bottom-4 w-px bg-neutral-200 dark:bg-neutral-800 print:bg-neutral-300"></div>

            {combinedTimeline.map((item, index) => {
              const date = new Date(item.event.created_at);
              const formattedDate = date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const formattedTime = date.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div key={item.event.id} className="relative flex gap-6 print:break-inside-avoid print:page-break-inside-avoid">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center shrink-0 mt-1.5 z-10">
                    <div
                      className={`h-3 w-3 rounded-full border-2 border-white dark:border-neutral-950 print:border-white ${
                        STAGE_STYLES[item.event.stage]?.color ?? "bg-neutral-500"
                      }`}
                    />
                  </div>

                  {/* Content Card */}
                  <div className="flex-1 border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 bg-white dark:bg-neutral-900 shadow-sm print:shadow-none print:border-neutral-300">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-bold text-base print:text-black">
                            Bundle #{item.bundle.bundle_number}
                          </span>
                          {item.bundle.status === "rework" && (
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-900/40 dark:text-rose-300 dark:ring-rose-700 print:border-black print:text-black print:bg-transparent">
                              REWORK
                            </span>
                          )}
                        </div>
                        
                        {item.parentBundleNumber !== null && (
                          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1 print:text-black">
                            ↳ Rework from Bundle #{item.parentBundleNumber}
                          </p>
                        )}
                        
                        <div className="text-sm text-neutral-600 dark:text-neutral-400 print:text-neutral-700 flex gap-2">
                          <span>Size: {item.lineItem.size}</span>
                          <span className="text-neutral-300 dark:text-neutral-600 print:text-neutral-400">|</span>
                          <span>Color: {item.lineItem.color}</span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-sm font-semibold print:text-black">
                          {formattedDate}
                        </div>
                        <div className="text-sm text-neutral-500 dark:text-neutral-400 print:text-neutral-600">
                          {formattedTime}
                        </div>
                      </div>
                    </div>

                    <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-md p-3 border border-neutral-100 dark:border-neutral-800 print:bg-transparent print:border-neutral-200 flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-wider font-semibold text-neutral-500 dark:text-neutral-400 print:text-neutral-600 mb-1">
                          Stage & Department
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm capitalize print:text-black">
                            {STAGE_STYLES[item.event.stage]?.label ?? item.event.stage}
                          </span>
                          <span className="text-neutral-400 print:text-neutral-400">•</span>
                          <span className="text-sm text-neutral-700 dark:text-neutral-300 print:text-black">
                            {item.departmentName}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex gap-6 text-right">
                        <div>
                          <p className="text-xs uppercase tracking-wider font-semibold text-neutral-500 dark:text-neutral-400 print:text-neutral-600 mb-1">
                            Passed
                          </p>
                          <p className="text-sm font-bold text-neutral-900 dark:text-white print:text-black">
                            {item.event.quantity_passed}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider font-semibold text-neutral-500 dark:text-neutral-400 print:text-neutral-600 mb-1">
                            Rejected
                          </p>
                          <p className={`text-sm font-bold ${item.event.quantity_rejected > 0 ? "text-rose-600 dark:text-rose-400 print:text-black" : "text-neutral-400 print:text-neutral-500"}`}>
                            {item.event.quantity_rejected}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
