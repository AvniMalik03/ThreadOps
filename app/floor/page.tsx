import { createClient } from "@/lib/supabase/server";
import { BundleStage } from "@/types/database";

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
      <header className="mb-8">
        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
          {CURRENT_DEPARTMENT} Queue
        </h1>
        <p className="text-neutral-400 mt-2 text-lg md:text-xl">
          {bundles.length} bundle{bundles.length !== 1 && "s"} pending
        </p>
      </header>

      {bundles.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <h2 className="text-3xl md:text-5xl font-bold text-neutral-600 tracking-tight">
            All caught up
          </h2>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {bundles.map((bundle) => (
            <div
              key={bundle.id}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-lg relative overflow-hidden"
            >
              {bundle.status === "rework" && (
                <div className="absolute top-0 right-0 bg-red-600 text-white font-black text-xl md:text-2xl px-6 py-2 rounded-bl-2xl">
                  REWORK
                </div>
              )}
              
              <div className="mb-8">
                <div className="text-neutral-400 text-lg md:text-xl font-medium mb-1 uppercase tracking-wider">
                  {bundle.buyer}
                </div>
                <div className="text-white text-3xl md:text-4xl font-bold mb-4">
                  {bundle.style_code}
                </div>
                
                <div className="flex flex-wrap gap-4 mt-6">
                  <div className="bg-neutral-800 rounded-2xl px-5 py-3">
                    <div className="text-neutral-500 text-sm md:text-base font-semibold uppercase tracking-wider mb-1">
                      Size
                    </div>
                    <div className="text-white text-2xl md:text-3xl font-bold">
                      {bundle.size}
                    </div>
                  </div>
                  <div className="bg-neutral-800 rounded-2xl px-5 py-3">
                    <div className="text-neutral-500 text-sm md:text-base font-semibold uppercase tracking-wider mb-1">
                      Color
                    </div>
                    <div className="text-white text-2xl md:text-3xl font-bold">
                      {bundle.color}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-end justify-between mt-auto pt-6 border-t border-neutral-800">
                <div>
                  <div className="text-neutral-500 text-sm md:text-base font-semibold uppercase tracking-wider mb-1">
                    Bundle
                  </div>
                  <div className="text-white text-4xl md:text-5xl font-black">
                    #{bundle.bundle_number}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-neutral-500 text-sm md:text-base font-semibold uppercase tracking-wider mb-1">
                    Qty
                  </div>
                  <div className="text-white text-4xl md:text-5xl font-black">
                    {bundle.quantity}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
