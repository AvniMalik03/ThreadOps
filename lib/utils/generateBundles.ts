export interface GeneratedBundle {
  bundleNumber: number;
  quantity: number;
}

export function generateBundles(
  quantity: number,
  bundleSize: number
): GeneratedBundle[] {
  if (quantity <= 0) {
    throw new Error("Quantity must be greater than 0");
  }
  if (bundleSize <= 0) {
    throw new Error("Bundle size must be greater than 0");
  }

  const bundles: GeneratedBundle[] = [];
  let remainingQuantity = quantity;
  let currentBundleNumber = 1;

  while (remainingQuantity > 0) {
    const currentQuantity = Math.min(remainingQuantity, bundleSize);
    bundles.push({
      bundleNumber: currentBundleNumber,
      quantity: currentQuantity,
    });

    remainingQuantity -= currentQuantity;
    currentBundleNumber += 1;
  }

  const totalGeneratedQuantity = bundles.reduce(
    (sum, bundle) => sum + bundle.quantity,
    0
  );

  if (totalGeneratedQuantity !== quantity) {
    throw new Error("Validation failed: Sum of bundle quantities does not match total ordered quantity.");
  }

  return bundles;
}
