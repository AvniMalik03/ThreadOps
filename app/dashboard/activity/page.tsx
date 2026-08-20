import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { STAGE_STYLES } from "@/components/shared/StageProgressBar";
import { ActivityFilters } from "./ActivityFilters";

export const metadata = {
  title: "Factory Activity | ThreadOps",
};

const PAGE_SIZE = 20;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  // 1. Parse and validate search parameters
  let page = 1;
  if (typeof params.page === "string") {
    const parsedPage = parseInt(params.page, 10);
    if (!isNaN(parsedPage) && parsedPage > 0) {
      page = parsedPage;
    }
  }

  const departmentFilter = typeof params.department === "string" ? params.department : "all";
  const rangeFilter = typeof params.range === "string" ? params.range : "all";

  // 2. Fetch departments for the filter
  const { data: rawDepartments } = await supabase
    .from("departments")
    .select("id, name")
    .order("name");
    
  const departments = (rawDepartments || []) as { id: string; name: string }[];
  
  // Resolve department ID if filtering by department name
  let departmentIdToFilter: string | null = null;
  if (departmentFilter !== "all") {
    const dept = departments.find((d) => d.name === departmentFilter);
    if (dept) {
      departmentIdToFilter = dept.id;
    }
  }

  // 3. Build query for stage_events
  // We fetch PAGE_SIZE + 1 to check if there is a next page
  let query = supabase
    .from("stage_events")
    .select(`
      *,
      departments!inner(name),
      bundles!inner(
        bundle_number,
        status,
        parent_bundle_id,
        order_line_items!inner(
          size,
          color,
          orders!inner(
            id,
            buyer,
            style_code
          )
        )
      )
    `)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE); // 0 to 20 for page 1 (fetches 21 items)

  if (departmentIdToFilter) {
    query = query.eq("department_id", departmentIdToFilter);
  }

  if (rangeFilter === "today") {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    query = query.gte("created_at", startOfToday.toISOString());
  } else if (rangeFilter === "7d") {
    const startOf7DaysAgo = new Date();
    startOf7DaysAgo.setDate(startOf7DaysAgo.getDate() - 7);
    startOf7DaysAgo.setHours(0, 0, 0, 0);
    query = query.gte("created_at", startOf7DaysAgo.toISOString());
  }

  const { data: rawEvents, error } = await query;

  if (error) {
    console.error("Error fetching activity feed:", error);
    // Still render, but perhaps show an error or empty state
  }

  // The type of rawEvents is heavily nested. We will cast it carefully.
  // Using any here as a step to the final mapped type because Supabase inferred types for nested joins are complex.
  const allFetchedEvents = (rawEvents || []) as any[];

  const hasNextPage = allFetchedEvents.length > PAGE_SIZE;
  // Slice to PAGE_SIZE to only display the required amount
  const displayEvents = allFetchedEvents.slice(0, PAGE_SIZE);

  // We need to resolve parent bundle numbers for rework bundles
  // Fetch all parent bundles in one go
  const parentBundleIds = Array.from(
    new Set(
      displayEvents
        .map((e) => e.bundles.parent_bundle_id)
        .filter((id): id is string => id !== null)
    )
  );
  
  let parentBundleNumberById = new Map<string, number>();
  if (parentBundleIds.length > 0) {
    const { data: rawParentBundles } = await supabase
      .from("bundles")
      .select("id, bundle_number")
      .in("id", parentBundleIds);
      
    const parentBundles = (rawParentBundles || []) as { id: string; bundle_number: number }[];
    for (const pb of parentBundles) {
      parentBundleNumberById.set(pb.id, pb.bundle_number);
    }
  }

  return (
    <main className="p-6 md:p-8 max-w-5xl mx-auto w-full">
      <div className="mb-6 flex items-center justify-between">
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

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">
          Activity Log
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-2 text-lg">
          Factory-wide production activity.
        </p>
      </div>

      <ActivityFilters departments={departments} />

      {displayEvents.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-10 text-center shadow-sm">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
            No production activity found.
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 mt-2">
            Try adjusting your filters to see more events.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayEvents.map((event) => {
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

            const order = event.bundles.order_line_items.orders;
            const lineItem = event.bundles.order_line_items;
            const bundle = event.bundles;
            const parentBundleNumber = bundle.parent_bundle_id
              ? parentBundleNumberById.get(bundle.parent_bundle_id)
              : null;
            const deptName = event.departments.name;

            return (
              <div
                key={event.id}
                className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3 mb-1">
                      <Link
                        href={`/dashboard/orders/${order.id}`}
                        className="text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        {order.buyer}
                      </Link>
                      <span className="text-neutral-300 dark:text-neutral-600 text-xs">/</span>
                      <Link
                        href={`/dashboard/orders/${order.id}`}
                        className="text-sm font-bold text-neutral-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        {order.style_code}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-bold text-base">
                        Bundle #{bundle.bundle_number}
                      </span>
                      {bundle.status === "rework" && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-900/40 dark:text-rose-300 dark:ring-rose-700">
                          REWORK
                        </span>
                      )}
                    </div>
                    {parentBundleNumber !== undefined && parentBundleNumber !== null && (
                      <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1">
                        ↳ Rework from Bundle #{parentBundleNumber}
                      </p>
                    )}
                    <div className="text-sm text-neutral-600 dark:text-neutral-400 mt-1 flex gap-2">
                      <span>Size: {lineItem.size}</span>
                      <span className="text-neutral-300 dark:text-neutral-600">|</span>
                      <span>Color: {lineItem.color}</span>
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                      {formattedDate}
                    </div>
                    <div className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {formattedTime}
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-4 border border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5">
                      Stage & Department
                    </p>
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${
                          STAGE_STYLES[event.stage as keyof typeof STAGE_STYLES]?.color ?? "bg-neutral-500"
                        }`}
                      />
                      <span className="font-semibold text-sm capitalize text-neutral-900 dark:text-white">
                        {STAGE_STYLES[event.stage as keyof typeof STAGE_STYLES]?.label ?? event.stage}
                      </span>
                      <span className="text-neutral-400 text-xs">•</span>
                      <span className="text-sm text-neutral-600 dark:text-neutral-300">
                        {deptName}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-6 text-right">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5">
                        Passed
                      </p>
                      <p className="text-sm font-bold text-neutral-900 dark:text-white">
                        {event.quantity_passed}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5">
                        Rejected
                      </p>
                      <p
                        className={`text-sm font-bold ${
                          event.quantity_rejected > 0
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-neutral-400 dark:text-neutral-500"
                        }`}
                      >
                        {event.quantity_rejected}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {displayEvents.length > 0 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href={`/dashboard/activity?page=${page - 1}${
              departmentFilter !== "all" ? `&department=${encodeURIComponent(departmentFilter)}` : ""
            }${rangeFilter !== "all" ? `&range=${encodeURIComponent(rangeFilter)}` : ""}`}
            className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${
              page <= 1
                ? "border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-600 pointer-events-none"
                : "border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800"
            }`}
            aria-disabled={page <= 1}
          >
            Previous
          </Link>
          <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
            Page {page}
          </span>
          <Link
            href={`/dashboard/activity?page=${page + 1}${
              departmentFilter !== "all" ? `&department=${encodeURIComponent(departmentFilter)}` : ""
            }${rangeFilter !== "all" ? `&range=${encodeURIComponent(rangeFilter)}` : ""}`}
            className={`px-4 py-2 text-sm font-semibold rounded-lg border transition-colors ${
              !hasNextPage
                ? "border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-600 pointer-events-none"
                : "border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800"
            }`}
            aria-disabled={!hasNextPage}
          >
            Next
          </Link>
        </div>
      )}
    </main>
  );
}
