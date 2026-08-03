import OrderForm from "./components/OrderForm";

export const metadata = {
  title: "Create Production Order | ThreadOps",
};

export default function NewOrderPage() {
  return (
    <main className="p-8 max-w-5xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">
          New Production Order
        </h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-2 text-lg">
          Create a new order to begin tracking it on the production floor.
        </p>
      </div>
      
      <OrderForm />
    </main>
  );
}
