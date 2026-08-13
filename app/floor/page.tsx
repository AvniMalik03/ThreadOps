import { createClient } from "@/lib/supabase/server";
import { BundleStage } from "@/types/database";
import FloorClient from "./FloorClient";

const CURRENT_DEPARTMENT = process.env.NEXT_PUBLIC_DEV_DEPARTMENT ?? "QC";

// Note: During development, QC maps to "received", which is the initial 
// stage for newly generated bundles, allowing the queue to display them.
const STAGE_MAP: Record<string, BundleStage> = {
  Cutting: "cutting",
  Stitching: "stitching",
  Finishing: "finishing",
  Ironing: "ironing",
  Packing: "packing",
  Dispatch: "dispatch",
  QC: "received",
};

export default async function FloorPage() {
  const supabase = await createClient();
  const currentStage = STAGE_MAP[CURRENT_DEPARTMENT];

  // Fetch bundles for the current stage, along with nested line items and orders
  const { data: rawBundles, error } = await supabase
    .from("bundles")
    .select(`
      *,
      order_line_items (
        size,
        color,
        orders (
          buyer,
          style_code
        )
      ),
      stage_events (
        created_at,
        stage
      )
    `)
    .eq("current_stage", currentStage);

  if (error) {
    console.error("Error fetching bundles:", error);
  }

  // Process and sort bundles
  const bundles = (rawBundles || []).map((b: any) => {
    // Find the latest stage_event timestamp (if any exist)
    const eventTimes = (b.stage_events || []).map((e: any) =>
      new Date(e.created_at).getTime()
    );
    const latestEventTime =
      eventTimes.length > 0
        ? Math.max(...eventTimes)
        : new Date(b.created_at).getTime();

    return {
      id: b.id,
      bundle_number: b.bundle_number,
      quantity: b.quantity,
      status: b.status,
      buyer: b.order_line_items?.orders?.buyer || "Unknown",
      style_code: b.order_line_items?.orders?.style_code || "Unknown",
      size: b.order_line_items?.size || "Unknown",
      color: b.order_line_items?.color || "Unknown",
      sortTime: latestEventTime,
    };
  });

  // Sort by oldest first (ascending order of sortTime)
  bundles.sort((a, b) => a.sortTime - b.sortTime);

  return (
    <main className="min-h-screen bg-neutral-950 p-4 md:p-8 flex flex-col font-sans">
      <FloorClient bundles={bundles} currentDepartment={CURRENT_DEPARTMENT} />
    </main>
  );
}
