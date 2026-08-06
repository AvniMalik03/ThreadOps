"use server";

import { createClient } from "@/lib/supabase/server";
import { orderSchema } from "./validation";
import { revalidatePath } from "next/cache";
import { DEFAULT_BUNDLE_SIZE } from "@/constants/bundles";
import { generateBundles } from "@/lib/utils/generateBundles";

export async function createOrderAction(formData: FormData) {
  const buyer = formData.get("buyer") as string;
  const style_code = formData.get("style_code") as string;
  const deadline = formData.get("deadline") as string;
  const lineItemsRaw = formData.get("lineItems") as string;

  let parsedLineItems = [];
  try {
    if (lineItemsRaw) {
      parsedLineItems = JSON.parse(lineItemsRaw);
    }
  } catch (e) {
    return {
      success: false,
      message: "Malformed line items data.",
    };
  }

  // Validate the data using Zod
  const validation = orderSchema.safeParse({ buyer, style_code, deadline, lineItems: parsedLineItems });

  if (!validation.success) {
    let fallbackMessage = "Validation failed.";
    if (validation.error.issues.some((err) => err.path.includes("lineItems"))) {
      fallbackMessage = "Validation failed for one or more line items. Please check sizes, colors, and quantities.";
    }

    return {
      success: false,
      errors: validation.error.flatten().fieldErrors,
      message: fallbackMessage,
    };
  }

  const supabase = await createClient();

  const newOrder = {
    buyer: validation.data.buyer,
    style_code: validation.data.style_code,
    deadline: validation.data.deadline,
  };

  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    // @ts-expect-error Supabase strict typing issue with hand-authored types
    .insert(newOrder)
    .select("id")
    .single();

  if (orderError || !orderData) {
    return {
      success: false,
      message: "Failed to create order. Please try again.",
    };
  }

  const orderId = (orderData as any).id;

  const lineItemsToInsert = validation.data.lineItems.map((item) => ({
    order_id: orderId,
    size: item.size,
    color: item.color,
    quantity_ordered: item.quantity,
  }));

  const { data: insertedLineItems, error: lineItemsError } = await supabase
    .from("order_line_items")
    // @ts-expect-error Supabase strict typing issue with hand-authored types
    .insert(lineItemsToInsert)
    .select("id, quantity_ordered");

  if (lineItemsError || !insertedLineItems) {
    // Attempt rollback
    await supabase.from("orders").delete().eq("id", orderId);
    
    return {
      success: false,
      message: "Failed to save order line items. The order creation was rolled back.",
    };
  }

  const bundlesToInsert = [];
  const items = insertedLineItems as { id: string; quantity_ordered: number }[];
  
  for (const lineItem of items) {
    const generated = generateBundles(lineItem.quantity_ordered, DEFAULT_BUNDLE_SIZE);
    for (const bundle of generated) {
      bundlesToInsert.push({
        order_line_item_id: lineItem.id,
        bundle_number: bundle.bundleNumber,
        quantity: bundle.quantity,
        current_stage: "received",
        status: "in_progress",
      });
    }
  }

  if (bundlesToInsert.length > 0) {
    const { error: bundlesError } = await supabase
      .from("bundles")
      // @ts-expect-error Supabase strict typing issue with hand-authored types
      .insert(bundlesToInsert);

    if (bundlesError) {
      // Attempt rollback
      await supabase.from("orders").delete().eq("id", orderId);
      
      return {
        success: false,
        message: "Failed to generate production bundles. The order creation was rolled back.",
      };
    }
  }

  revalidatePath("/dashboard/orders");
  
  return {
    success: true,
    orderId,
  };
}
