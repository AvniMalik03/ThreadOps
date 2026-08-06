import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Order, OrderLineItem, Bundle } from "@/types/database";

export const metadata = {
  title: "Order Details | ThreadOps",
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

  const lineItemIds = lineItems.map(item => item.id);
  let bundles: Bundle[] = [];
  
  if (lineItemIds.length > 0) {
    const { data: rawBundles } = await supabase
      .from("bundles")
      .select("*")
      .in("order_line_item_id", lineItemIds)
      .order("bundle_number", { ascending: true });
      
    bundles = (rawBundles || []) as unknown as Bundle[];
  }


  return (
    <main className="p-8 max-w-5xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">
          Order Details
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-2 text-lg">
          {order.style_code} • {order.buyer}
        </p>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-8 mb-8">
        <h2 className="text-xl font-bold mb-6 text-neutral-900 dark:text-white">Order Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Buyer</p>
            <p className="text-neutral-900 dark:text-white font-medium">{order.buyer}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Style Code</p>
            <p className="text-neutral-900 dark:text-white font-medium">{order.style_code}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Deadline</p>
            <p className="text-neutral-900 dark:text-white font-medium">{order.deadline}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Status</p>
            <p className="text-neutral-900 dark:text-white font-medium capitalize">{order.status}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Created At</p>
            <p className="text-neutral-900 dark:text-white font-medium">{new Date(order.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Line Items</h2>
        </div>
        <div className="p-6 flex flex-col gap-8">
          {lineItems?.map((item) => {
            const itemBundles = bundles.filter(b => b.order_line_item_id === item.id);
            return (
              <div key={item.id} className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                <div className="bg-neutral-50 dark:bg-neutral-800/50 p-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-neutral-900 dark:text-white">Size: {item.size}</span>
                    <span className="mx-2 text-neutral-400">•</span>
                    <span className="text-neutral-600 dark:text-neutral-300">Color: {item.color}</span>
                  </div>
                  <div className="font-medium text-neutral-900 dark:text-white">
                    Ordered Qty: {item.quantity_ordered}
                  </div>
                </div>
                <div className="p-0">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400">
                        <th className="py-3 px-4 font-medium">Bundle #</th>
                        <th className="py-3 px-4 font-medium">Quantity</th>
                        <th className="py-3 px-4 font-medium">Current Stage</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                      {itemBundles.map((bundle) => (
                        <tr key={bundle.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors bg-white dark:bg-neutral-900">
                          <td className="py-3 px-4 text-neutral-900 dark:text-white font-medium">{bundle.bundle_number}</td>
                          <td className="py-3 px-4 text-neutral-900 dark:text-white">{bundle.quantity}</td>
                          <td className="py-3 px-4 text-neutral-600 dark:text-neutral-300 capitalize">{bundle.current_stage}</td>
                          <td className="py-3 px-4 text-neutral-600 dark:text-neutral-300 capitalize">{bundle.status.replace('_', ' ')}</td>
                        </tr>
                      ))}
                      {itemBundles.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-neutral-500">No bundles generated.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {!lineItems || lineItems.length === 0 ? (
            <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
              No line items found.
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
