import { z } from "zod";

const uuid = z.string().uuid();

export const stockPurchaseItemSchema = z.object({
  material_id: uuid,
  description: z.string().trim().min(1),
  quantity: z.number().positive(),
  unit_cost: z.number().nonnegative().optional().default(0),
});

export const createStockPurchaseSchema = z.object({
  vendor_id: uuid,
  notes: z.string().trim().optional(),
  items: z.array(stockPurchaseItemSchema).min(1),
});

export const receiveStockSchema = z.object({
  purchase_id: uuid,
  items: z
    .array(
      z.object({
        stock_purchase_item_id: uuid,
        quantity: z.number().nonnegative(),
      }),
    )
    .min(1),
});

export const adjustStockSchema = z.object({
  material_id: uuid,
  delta: z.number().refine((value) => value !== 0, "Enter a quantity change"),
  reason: z.string().trim().min(1, "A reason is required"),
});

export const handOverOfficeSchema = z.object({
  quote_id: uuid,
  amount: z.number().positive("Enter the amount collected"),
  method: z.enum(["cash", "upi", "bank_transfer", "cheque", "card", "other"]),
  reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
}).superRefine((value, ctx) => {
  if (value.method !== "cash" && !value.reference) {
    ctx.addIssue({
      code: "custom",
      message: "Payment reference is required",
      path: ["reference"],
    });
  }
});

export const voidOfficeHandoverSchema = z.object({
  quote_id: uuid,
  reason: z.string().trim().min(1, "A reason is required"),
});
