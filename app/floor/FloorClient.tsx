"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { processBundleAction } from "./actions";

type BundleData = {
  id: string;
  bundle_number: number;
  quantity: number;
  status: string;
  buyer: string;
  style_code: string;
  size: string;
  color: string;
  sortTime: number;
};

type FloorClientProps = {
  bundles: BundleData[];
  currentDepartment: string;
};

export default function FloorClient({ bundles, currentDepartment }: FloorClientProps) {
  const router = useRouter();
  const [selectedBundle, setSelectedBundle] = useState<BundleData | null>(null);
  const [quantityPassed, setQuantityPassed] = useState<string>("");
  const [quantityRejected, setQuantityRejected] = useState<string>("0");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleBundleClick = (bundle: BundleData) => {
    setSelectedBundle(bundle);
    setQuantityPassed(bundle.quantity.toString());
    setQuantityRejected("0");
    setError(null);
  };

  const closeDialog = () => {
    setSelectedBundle(null);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!selectedBundle) return;

    setError(null);

    const passedRaw = Number(quantityPassed);
    const rejectedRaw = Number(quantityRejected);

    // Must be finite, non-negative, whole numbers
    const passed = Math.floor(passedRaw);
    const rejected = Math.floor(rejectedRaw);

    if (!Number.isFinite(passedRaw) || passedRaw < 0 || passedRaw !== passed) {
      setError("Quantity passed must be a non-negative whole number.");
      return;
    }
    if (!Number.isFinite(rejectedRaw) || rejectedRaw < 0 || rejectedRaw !== rejected) {
      setError("Quantity rejected must be a non-negative whole number.");
      return;
    }
    if (passed === 0 && rejected === 0) {
      setError("At least one quantity must be greater than 0.");
      return;
    }
    if (passed + rejected > selectedBundle.quantity) {
      setError("Total processed quantity cannot exceed the bundle's total quantity.");
      return;
    }

    startTransition(async () => {
      try {
        await processBundleAction(selectedBundle.id, passed, rejected, currentDepartment);
        closeDialog();
        router.refresh();
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      }
    });
  };

  return (
    <>
      <header className="mb-8">
        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
          {currentDepartment} Queue
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
              onClick={() => handleBundleClick(bundle)}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8 flex flex-col justify-between shadow-lg relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
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

      {selectedBundle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl w-full max-w-lg p-6 md:p-8 flex flex-col shadow-2xl relative">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-black text-white mb-1">
                  Bundle #{selectedBundle.bundle_number}
                </h2>
                <div className="text-neutral-400 text-lg md:text-xl font-medium">
                  {selectedBundle.buyer} • {selectedBundle.style_code}
                </div>
              </div>
              <button
                onClick={closeDialog}
                className="text-neutral-500 hover:text-white transition-colors p-2 -mr-2 -mt-2"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="flex gap-4 mb-8">
              <div className="bg-neutral-800 flex-1 rounded-2xl p-4">
                <div className="text-neutral-500 text-sm font-semibold uppercase tracking-wider mb-1">
                  Size
                </div>
                <div className="text-white text-2xl font-bold">{selectedBundle.size}</div>
              </div>
              <div className="bg-neutral-800 flex-1 rounded-2xl p-4">
                <div className="text-neutral-500 text-sm font-semibold uppercase tracking-wider mb-1">
                  Color
                </div>
                <div className="text-white text-2xl font-bold">{selectedBundle.color}</div>
              </div>
              <div className="bg-neutral-800 flex-1 rounded-2xl p-4">
                <div className="text-neutral-500 text-sm font-semibold uppercase tracking-wider mb-1">
                  Total Qty
                </div>
                <div className="text-white text-2xl font-bold">{selectedBundle.quantity}</div>
              </div>
            </div>

            <div className="space-y-6 mb-8">
              <div>
                <label className="block text-neutral-400 text-lg font-semibold mb-2">
                  Quantity Passed
                </label>
                <input
                  type="number"
                  min="0"
                  value={quantityPassed}
                  onChange={(e) => setQuantityPassed(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 text-white text-4xl md:text-5xl font-black rounded-2xl p-4 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-neutral-400 text-lg font-semibold mb-2">
                  Quantity Rejected
                </label>
                <input
                  type="number"
                  min="0"
                  value={quantityRejected}
                  onChange={(e) => setQuantityRejected(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 text-white text-4xl md:text-5xl font-black rounded-2xl p-4 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                  placeholder="0"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-8 font-medium">
                {error}
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="w-full bg-white text-black font-black text-2xl md:text-3xl py-5 rounded-2xl hover:bg-neutral-200 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
            >
              {isPending ? "Processing..." : "Confirm"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
