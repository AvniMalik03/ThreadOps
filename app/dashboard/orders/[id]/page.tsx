export const metadata = {
  title: "Order Details | ThreadOps",
};

export default async function OrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  return (
    <main className="p-8 max-w-5xl mx-auto w-full">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-8">
        <h1 className="text-2xl font-bold mb-4">Production Order</h1>
        <p className="text-neutral-600 dark:text-neutral-400 font-mono text-lg">
          Order ID: {id}
        </p>
      </div>
    </main>
  );
}
