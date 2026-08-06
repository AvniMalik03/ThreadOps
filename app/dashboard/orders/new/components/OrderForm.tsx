"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createOrderAction } from "../actions";

export default function OrderForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [lineItems, setLineItems] = useState([{ size: "", color: "", quantity: "" }]);

  const addLineItem = () => {
    setLineItems([...lineItems, { size: "", color: "", quantity: "" }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const updateLineItem = (index: number, field: string, value: string) => {
    const newItems = [...lineItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setLineItems(newItems);
  };


  const handleSubmit = async (formData: FormData) => {
    setErrorMsg(null);
    setFieldErrors({});
    formData.append("lineItems", JSON.stringify(lineItems));

    
    startTransition(async () => {
      const result = await createOrderAction(formData);
      
      if (!result.success) {
        if (result.errors) {
          setFieldErrors(result.errors);
        }
        if (result.message) {
          setErrorMsg(result.message);
        }
        return;
      }
      
      setToast({ message: "Production order created successfully.", type: "success" });
      
      setTimeout(() => {
        if (result.orderId) {
          router.push(`/dashboard/orders/${result.orderId}`);
        }
      }, 1000);
    });
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 p-8">
      {toast && toast.type === "success" && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg border border-green-200 dark:border-green-800 font-medium text-sm">
          {toast.message}
        </div>
      )}
      
      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800 font-medium text-sm">
          {errorMsg}
        </div>
      )}

      <form action={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="buyer" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Buyer
          </label>
          <input
            type="text"
            id="buyer"
            name="buyer"
            disabled={isPending || (toast?.type === "success")}
            className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
            placeholder="e.g. Acme Corp"
          />
          {fieldErrors.buyer && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{fieldErrors.buyer[0]}</p>
          )}
        </div>

        <div>
          <label htmlFor="style_code" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Style Code
          </label>
          <input
            type="text"
            id="style_code"
            name="style_code"
            disabled={isPending || (toast?.type === "success")}
            className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
            placeholder="e.g. FW24-Jacket-01"
          />
          {fieldErrors.style_code && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{fieldErrors.style_code[0]}</p>
          )}
        </div>

        <div>
          <label htmlFor="deadline" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Deadline
          </label>
          <input
            type="date"
            id="deadline"
            name="deadline"
            disabled={isPending || (toast?.type === "success")}
            className="w-full px-4 py-3 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
          />
          {fieldErrors.deadline && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{fieldErrors.deadline[0]}</p>
          )}
        </div>

        <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Line Items</h2>
            <button
              type="button"
              onClick={addLineItem}
              disabled={isPending || (toast?.type === "success")}
              className="text-sm bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              + Add Line Item
            </button>
          </div>
          
          <div className="space-y-4">
            {lineItems.map((item, index) => (
              <div key={index} className="flex gap-4 items-start p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-800">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Size</label>
                  <input
                    type="text"
                    required
                    value={item.size}
                    onChange={(e) => updateLineItem(index, "size", e.target.value)}
                    disabled={isPending || (toast?.type === "success")}
                    className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50 text-sm"
                    placeholder="e.g. M"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Color</label>
                  <input
                    type="text"
                    required
                    value={item.color}
                    onChange={(e) => updateLineItem(index, "color", e.target.value)}
                    disabled={isPending || (toast?.type === "success")}
                    className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50 text-sm"
                    placeholder="e.g. Red"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">Quantity</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(index, "quantity", e.target.value)}
                    disabled={isPending || (toast?.type === "success")}
                    className="w-full px-3 py-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50 text-sm"
                    placeholder="0"
                  />
                </div>
                <div className="pt-6">
                  <button
                    type="button"
                    onClick={() => removeLineItem(index)}
                    disabled={lineItems.length <= 1 || isPending || (toast?.type === "success")}
                    className="text-red-500 hover:text-red-700 disabled:opacity-30 transition-colors p-2"
                    aria-label="Remove Line Item"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
          {fieldErrors.lineItems && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{fieldErrors.lineItems[0]}</p>
          )}
        </div>


        <div className="pt-4">
          <button
            type="submit"
            disabled={isPending || (toast?.type === "success")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors focus:ring-4 focus:ring-blue-500/30 disabled:opacity-70 flex justify-center items-center h-12"
          >
            {isPending ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving Order...
              </>
            ) : (
              "Create Production Order"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
