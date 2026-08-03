"use server";

import { createClient } from "@/lib/supabase/server";
import { orderSchema } from "./validation";
import { revalidatePath } from "next/cache";

export async function createOrderAction(formData: FormData) {
  const buyer = formData.get("buyer") as string;
  const style_code = formData.get("style_code") as string;
  const deadline = formData.get("deadline") as string;

  // Validate the data using Zod
  const validation = orderSchema.safeParse({ buyer, style_code, deadline });

  if (!validation.success) {
    return {
      success: false,
      errors: validation.error.flatten().fieldErrors,
      message: "Validation failed.",
    };
  }

  const supabase = await createClient();

  const newOrder = {
    buyer: validation.data.buyer,
    style_code: validation.data.style_code,
    deadline: validation.data.deadline,
  };

  const { data, error } = await supabase
    .from("orders")
    // @ts-expect-error Supabase strict typing issue with hand-authored types
    .insert(newOrder)
    .select("id")
    .single();

  if (error || !data) {
    return {
      success: false,
      message: "Failed to create order. Please try again.",
    };
  }

  revalidatePath("/dashboard/orders");
  
  return {
    success: true,
    orderId: (data as any).id,
  };
}
