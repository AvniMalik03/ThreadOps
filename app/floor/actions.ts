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

async function getNextBundleNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderLineItemId: string
) {
  const { data, error } = await (supabase as any)
    .from("bundles")
    .select("bundle_number")
    .eq("order_line_item_id", orderLineItemId)
    .order("bundle_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to determine next bundle number: ${error.message}`);
  }

  return ((data as any)?.bundle_number ?? 0) + 1;
}

async function createReworkBundle({
  supabase,
  orderLineItemId,
  quantity,
  currentStage,
  parentBundleId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  orderLineItemId: string;
  quantity: number;
  currentStage: BundleStage;
  parentBundleId: string;
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nextBundleNumber = await getNextBundleNumber(
      supabase,
      orderLineItemId
    );

    const { error } = await (supabase as any).from("bundles").insert({
      order_line_item_id: orderLineItemId,
      quantity,
      current_stage: currentStage,
      status: "rework",
      parent_bundle_id: parentBundleId,
      bundle_number: nextBundleNumber,
    });

    if (!error) return;

    if (error.code !== "23505" || attempt === 2) {
      throw new Error(`Failed to create rework bundle: ${error.message}`);
    }
  }
}

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
    .select("quantity, current_stage, order_line_item_id")
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

  const bundleCurrentStage = bundle.current_stage as BundleStage;

  // Determine next stage
  const currentStageIndex = PIPELINE.indexOf(bundleCurrentStage);
  if (currentStageIndex === -1) {
    throw new Error(`Invalid current stage: ${bundleCurrentStage}`);
  }
  const nextStage =
    currentStageIndex + 1 < PIPELINE.length
      ? PIPELINE[currentStageIndex + 1]
      : null;

  // Insert stage event
  const { error: eventError } = await (supabase as any).from("stage_events").insert({
    bundle_id: bundleId,
    stage: bundleCurrentStage,
    quantity_passed: quantityPassed,
    quantity_rejected: quantityRejected,
    department_id: department.id,
  });

  if (eventError) {
    throw new Error(`Failed to record stage event: ${eventError.message}`);
  }

  if (quantityPassed > 0) {
    const updatePayload: any = {
      quantity: quantityPassed,
    };

    if (bundleCurrentStage === "dispatch") {
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
  } else if (quantityRejected === bundle.quantity) {
    const { error: updateError } = await (supabase as any)
      .from("bundles")
      .update({ status: "rework" })
      .eq("id", bundleId);

    if (updateError) {
      throw new Error(`Failed to update bundle: ${updateError.message}`);
    }
  }

  if (quantityRejected > 0 && quantityPassed > 0) {
    await createReworkBundle({
      supabase,
      orderLineItemId: bundle.order_line_item_id,
      quantity: quantityRejected,
      currentStage: bundleCurrentStage,
      parentBundleId: bundleId,
    });
  }

  return { success: true };
}
