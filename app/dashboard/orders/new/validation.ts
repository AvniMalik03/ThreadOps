import { z } from "zod";

export const orderSchema = z.object({
  buyer: z.string().trim().min(1, { message: "Buyer is required." }),
  style_code: z.string().trim().min(1, { message: "Style Code is required." }),
  deadline: z.string().trim().min(1, { message: "Deadline is required." }).refine(
    (dateStr) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selected = new Date(dateStr);
      return selected >= today;
    },
    { message: "Deadline cannot be in the past." }
  ),
});

export type OrderFormData = z.infer<typeof orderSchema>;
