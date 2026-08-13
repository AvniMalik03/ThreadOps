"use server";

import { createClient } from "@/lib/supabase/server";
import { BundleStage } from "@/types/database";

const PIPELINE: BundleStage[] = [
  "received",
  "cutting",
  "stitching",
  "finishing",
  "ironing",
  "packing",
  "dispatch",
];

const STAGE_MAP: Record<string, BundleStage> = {
  Cutting: "cutting",
  Stitching: "stitching",
  Finishing: "finishing",
  Ironing: "ironing",
  Packing: "packing",
  Dispatch: "dispatch",
  QC: "received",
};

export async function processBundleAction(
  bundleId: string,
  quantityPassed: number,
  quantityRejected: number,
  currentDepartmentName: string
) {
  const supabase = await createClient();

  // Validate inputs
  if (!bundleId) throw new Error("Missing bundle ID");
  if (!Number.isInteger(quantityPassed) || quantityPassed < 0) {
    throw new Error("Quantity passed must be a non-negative integer");
  }
  if (!Number.isInteger(quantityRejected) || quantityRejected < 0) {
    throw new Error("Quantity rejected must be a non-negative integer");
  }
  if (quantityPassed === 0 && quantityRejected === 0) {
    throw new Error("At least one quantity must be greater than 0");
  }

  // Fetch the current department
  const { data: department, error: deptError } = await (supabase as any)
    .from("departments")
    .select("id")
    .eq("name", currentDepartmentName)
    .single();

  if (deptError || !department) {
    throw new Error(`Department not found: ${currentDepartmentName}`);
  }

  const currentStage = STAGE_MAP[currentDepartmentName];
  if (!currentStage) {
    throw new Error(`Invalid department name: ${currentDepartmentName}`);
  }

  // Fetch the bundle to validate quantities
  const { data: bundleData, error: bundleError } = await (supabase as any)
    .from("bundles")
    .select("quantity, current_stage")
    .eq("id", bundleId)
    .single();

  const bundle = bundleData as any;

  if (bundleError || !bundle) {
    throw new Error("Bundle not found");
  }

  if (quantityPassed + quantityRejected > bundle.quantity) {
    throw new Error(
      "Total processed quantity cannot exceed bundle total quantity"
    );
  }

  // Determine next stage
  const currentStageIndex = PIPELINE.indexOf(currentStage);
  if (currentStageIndex === -1) {
    throw new Error(`Invalid current stage: ${currentStage}`);
  }
  const nextStage =
    currentStageIndex + 1 < PIPELINE.length
      ? PIPELINE[currentStageIndex + 1]
      : null;

  // Insert stage event
  const { error: eventError } = await (supabase as any).from("stage_events").insert({
    bundle_id: bundleId,
    stage: currentStage,
    quantity_passed: quantityPassed,
    quantity_rejected: quantityRejected,
    department_id: department.id,
  });

  if (eventError) {
    throw new Error(`Failed to record stage event: ${eventError.message}`);
  }

  // Update bundle if passed > 0
  if (quantityPassed > 0) {
    const updatePayload: any = {
      quantity: quantityPassed,
    };

    if (currentStage === "dispatch") {
      updatePayload.status = "completed";
    } else if (nextStage) {
      updatePayload.current_stage = nextStage;
    }

    const { error: updateError } = await (supabase as any)
      .from("bundles")
      .update(updatePayload)
      .eq("id", bundleId);

    if (updateError) {
      throw new Error(`Failed to update bundle: ${updateError.message}`);
    }
  }

  return { success: true };
}
