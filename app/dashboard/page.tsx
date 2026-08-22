import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Bundle, Order, OrderLineItem, StageEvent } from "@/types/database";
import { isOrderStuck } from "@/lib/utils/isOrderStuck";
import {
  StageProgressBar,
  computeStageProgress,
  PIPELINE,
  STAGE_STYLES,
} from "@/components/shared/StageProgressBar";
import { StuckBadge } from "@/components/shared/StuckBadge";

export const metadata = {
  title: "Dashboard | ThreadOps",
};

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Helpers (unchanged) ──────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

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

  // Derived KPI values — from already-fetched data, no extra queries
  const totalUnitsInProduction = dashboardOrders.reduce(
    (sum, o) => sum + o.totalQuantityOrdered,
    0
  );
  const stuckOrderCount = dashboardOrders.filter((o) => o.stuck.isStuck).length;

  // ── Production pipeline aggregation ────────────────────────────────────────
  // Aggregate units per stage across ALL active orders.
  // Uses the already-computed stageProgress arrays — zero new DB queries.
  const pipelineTotals = PIPELINE.map((stage) => {
    const totalUnits = dashboardOrders.reduce((sum, order) => {
      const sp = order.stageProgress.find((s) => s.stage === stage);
      return sum + (sp?.quantity ?? 0);
    }, 0);
    // Count bundles at this stage — from the already-fetched bundles array
    const bundleCount = bundles.filter(
      (b) => b.current_stage === stage && b.parent_bundle_id === null
    ).length;
    return { stage, totalUnits, bundleCount };
  });
  const pipelineMax = Math.max(...pipelineTotals.map((p) => p.totalUnits), 1);

  // ── Dominant stage per order (for "Current Stage" column) ─────────────────
  // Derived from already-computed stageProgress — no new logic needed.
  function dominantStage(order: DashboardOrder): string {
    const sp = order.stageProgress;
    const top = sp.reduce(
      (best, cur) => (cur.quantity > best.quantity ? cur : best),
      sp[0]
    );
    return top && top.quantity > 0 ? STAGE_STYLES[top.stage].label : "—";
  }

  // ─── JSX ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">

      {/* ── Page topbar ────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-6 py-3.5 border-b shrink-0"
        style={{
          backgroundColor: "var(--to-surface)",
          borderColor: "var(--to-border)",
        }}
      >
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-0.5"
            style={{ color: "var(--to-text-muted)" }}
          >
            ThreadOps
          </p>
          <h1
            className="text-sm font-semibold tracking-tight leading-none"
            style={{ color: "var(--to-text-primary)" }}
          >
            Production Overview
          </h1>
          <p
            className="text-[11px] mt-0.5"
            style={{ color: "var(--to-text-muted)" }}
          >
            A clear view of everything moving through production.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/dashboard/activity"
            className="text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--to-text-secondary)" }}
          >
            Activity log →
          </Link>
          <Link
            href="/dashboard/orders/new"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "var(--to-text-primary)",
              color: "var(--to-surface)",
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            New Order
          </Link>
        </div>
      </div>

      {/* ── Scrollable body ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">

        {/* ── KPI strip ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-5">

          {/* Active Orders */}
          <div
            className="rounded-lg border px-4 py-3"
            style={{ backgroundColor: "var(--to-surface)", borderColor: "var(--to-border)" }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-widest mb-1"
              style={{ color: "var(--to-text-muted)" }}
            >
              Active Orders
            </p>
            <p
              className="text-2xl font-semibold tabular-nums leading-none"
              style={{ color: "var(--to-text-primary)" }}
            >
              {dashboardOrders.length}
            </p>
            <p
              className="text-[11px] mt-1"
              style={{ color: "var(--to-text-muted)" }}
            >
              {dashboardOrders.length === 1 ? "order in production" : "orders in production"}
            </p>
          </div>

          {/* Units in Production */}
          <div
            className="rounded-lg border px-4 py-3"
            style={{ backgroundColor: "var(--to-surface)", borderColor: "var(--to-border)" }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-widest mb-1"
              style={{ color: "var(--to-text-muted)" }}
            >
              Units in Production
            </p>
            <p
              className="text-2xl font-semibold tabular-nums leading-none"
              style={{ color: "var(--to-text-primary)" }}
            >
              {totalUnitsInProduction.toLocaleString()}
            </p>
            <p
              className="text-[11px] mt-1"
              style={{ color: "var(--to-text-muted)" }}
            >
              across all active orders
            </p>
          </div>

          {/* Needs Attention */}
          <div
            className="rounded-lg border px-4 py-3"
            style={{
              backgroundColor: stuckOrderCount > 0 ? "var(--to-amber-light)" : "var(--to-surface)",
              borderColor: stuckOrderCount > 0 ? "var(--to-amber-border)" : "var(--to-border)",
            }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-widest mb-1"
              style={{ color: stuckOrderCount > 0 ? "var(--to-amber)" : "var(--to-text-muted)" }}
            >
              Needs Attention
            </p>
            <p
              className="text-2xl font-semibold tabular-nums leading-none"
              style={{ color: stuckOrderCount > 0 ? "var(--to-amber)" : "var(--to-text-primary)" }}
            >
              {stuckOrderCount}
            </p>
            <p
              className="text-[11px] mt-1"
              style={{ color: stuckOrderCount > 0 ? "var(--to-amber)" : "var(--to-text-muted)" }}
            >
              {stuckOrderCount === 0
                ? "all orders moving"
                : stuckOrderCount === 1
                ? "stuck order"
                : "stuck orders"}
            </p>
          </div>
        </div>

        {/* ── Active Orders panel ──────────────────────────────────────────────── */}
        <div
          className="rounded-lg border overflow-hidden mb-5"
          style={{ backgroundColor: "var(--to-surface)", borderColor: "var(--to-border)" }}
        >
          {/* Panel header */}
          <div
            className="flex items-center justify-between px-4 py-2.5 border-b"
            style={{ borderColor: "var(--to-border)", backgroundColor: "var(--to-surface-raised)" }}
          >
            <h2
              className="text-xs font-semibold"
              style={{ color: "var(--to-text-primary)" }}
            >
              Active Orders
              <span className="ml-1.5 font-normal" style={{ color: "var(--to-text-muted)" }}>
                ({sortedOrders.length})
              </span>
            </h2>
            {stuckOrderCount > 0 && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: "var(--to-amber-light)",
                  color: "var(--to-amber)",
                  border: "1px solid var(--to-amber-border)",
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                {stuckOrderCount} stuck
              </span>
            )}
          </div>

          {/* Column headers */}
          {sortedOrders.length > 0 && (
            <div
              className="grid border-b"
              style={{
                gridTemplateColumns: "minmax(140px,1.8fr) minmax(120px,1.2fr) 72px 96px 160px 60px",
                padding: "6px 16px",
                borderColor: "var(--to-border-subtle)",
                backgroundColor: "#fafaf8",
              }}
            >
              {["Order", "Current Stage", "Units", "Deadline", "Progress", ""].map((h) => (
                <span
                  key={h}
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: "var(--to-text-muted)" }}
                >
                  {h}
                </span>
              ))}
            </div>
          )}

          {/* ── Empty state ────────────────────────────────────────────────── */}
          {sortedOrders.length === 0 ? (
            <div className="py-12 text-center">
              <div
                className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--to-border-subtle)" }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                  strokeWidth={1.5} stroke="currentColor" className="h-4 w-4"
                  style={{ color: "var(--to-text-muted)" }} aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: "var(--to-text-primary)" }}>
                No active orders
              </p>
              <p className="text-xs mb-4" style={{ color: "var(--to-text-secondary)" }}>
                Active production orders will appear here once created.
              </p>
              <Link
                href="/dashboard/orders/new"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--to-text-primary)", color: "var(--to-surface)" }}
              >
                Create your first order
              </Link>
            </div>
          ) : (
            /* ── Order rows ──────────────────────────────────────────────── */
            <div>
              {sortedOrders.map((order) => {
                const { isStuck, daysSinceLastMovement } = order.stuck;
                const stageName = dominantStage(order);

                return (
                  <article
                    key={order.id}
                    className={`to-order-row${isStuck ? " stuck" : ""}`}
                    style={{ gridTemplateColumns: "minmax(140px,1.8fr) minmax(120px,1.2fr) 72px 96px 160px 60px" }}
                    aria-label={`Order ${order.style_code} for ${order.buyer}`}
                  >
                    {/* Order identity */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-xs font-semibold truncate"
                          style={{ color: "var(--to-text-primary)" }}
                        >
                          {order.style_code}
                        </span>
                        <StuckBadge
                          isStuck={isStuck}
                          daysSinceLastMovement={daysSinceLastMovement}
                        />
                      </div>
                      <span
                        className="text-[11px] block mt-0.5 truncate"
                        style={{ color: "var(--to-text-muted)" }}
                      >
                        {order.buyer}
                      </span>
                    </div>

                    {/* Current (dominant) stage */}
                    <div>
                      <span
                        className="text-xs tabular-nums"
                        style={{ color: "var(--to-text-secondary)" }}
                      >
                        {stageName}
                      </span>
                    </div>

                    {/* Units */}
                    <div>
                      <span
                        className="text-xs font-medium tabular-nums"
                        style={{ color: "var(--to-text-primary)" }}
                      >
                        {order.totalQuantityOrdered.toLocaleString()}
                      </span>
                    </div>

                    {/* Deadline */}
                    <div>
                      <span
                        className="text-xs tabular-nums"
                        style={{ color: "var(--to-text-secondary)" }}
                      >
                        {order.deadline}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="min-w-0">
                      <StageProgressBar
                        stageProgress={order.stageProgress}
                        showLegend={false}
                      />
                    </div>

                    {/* Action */}
                    <div className="flex justify-end">
                      <Link
                        href={`/dashboard/orders/${order.id}`}
                        className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium transition-colors hover:opacity-80"
                        style={{
                          border: "1px solid var(--to-border)",
                          color: "var(--to-text-secondary)",
                          backgroundColor: "var(--to-surface)",
                        }}
                      >
                        View
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
                          <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                        </svg>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Production Pipeline ──────────────────────────────────────────────── */}
        <div
          className="rounded-lg border overflow-hidden"
          style={{ backgroundColor: "var(--to-surface)", borderColor: "var(--to-border)" }}
        >
          {/* Panel header */}
          <div
            className="flex items-center justify-between px-4 py-2.5 border-b"
            style={{ borderColor: "var(--to-border)", backgroundColor: "var(--to-surface-raised)" }}
          >
            <h2
              className="text-xs font-semibold"
              style={{ color: "var(--to-text-primary)" }}
            >
              Production Pipeline
            </h2>
            <p
              className="text-[11px]"
              style={{ color: "var(--to-text-muted)" }}
            >
              Units by stage across all active orders
            </p>
          </div>

          {/* Stage blocks */}
          <div className="flex divide-x" style={{ borderColor: "var(--to-border-subtle)" }}>
            {pipelineTotals.map(({ stage, totalUnits, bundleCount }) => {
              const style = STAGE_STYLES[stage];
              const isActive = totalUnits > 0;
              const barHeight = totalUnits > 0
                ? Math.max(3, Math.round((totalUnits / pipelineMax) * 32))
                : 0;

              return (
                <div
                  key={stage}
                  className="to-pipeline-block flex flex-col"
                  style={
                    isActive
                      ? { backgroundColor: "var(--to-sage-bg)", borderColor: "var(--to-border-subtle)" }
                      : { borderColor: "var(--to-border-subtle)" }
                  }
                >
                  {/* Stage color dot + name */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <span
                      className={`h-2 w-2 rounded-sm shrink-0 opacity-80 ${style.color}`}
                    />
                    <span
                      className="text-[11px] font-semibold uppercase tracking-wide truncate"
                      style={{ color: isActive ? "var(--to-sage-text)" : "var(--to-text-muted)" }}
                    >
                      {style.label}
                    </span>
                  </div>

                  {/* Mini bar — proportional to pipelineMax */}
                  <div
                    className="mb-2 rounded-full overflow-hidden"
                    style={{ height: "4px", backgroundColor: "var(--to-border-subtle)" }}
                  >
                    {isActive && (
                      <div
                        className={`h-full rounded-full opacity-70 ${style.color}`}
                        style={{ width: `${(totalUnits / pipelineMax) * 100}%` }}
                      />
                    )}
                  </div>

                  {/* Unit count */}
                  <p
                    className="text-base font-semibold tabular-nums leading-none mb-0.5"
                    style={{ color: isActive ? "var(--to-text-primary)" : "var(--to-text-muted)" }}
                  >
                    {totalUnits > 0 ? totalUnits.toLocaleString() : "—"}
                  </p>

                  {/* Bundle count sub-label */}
                  <p
                    className="text-[10px]"
                    style={{ color: "var(--to-text-muted)" }}
                  >
                    {bundleCount > 0
                      ? `${bundleCount} bundle${bundleCount !== 1 ? "s" : ""}`
                      : "no activity"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
