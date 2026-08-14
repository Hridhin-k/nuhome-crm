import { z } from "zod";
import { PAYMENT_KINDS } from "@/lib/workflow/types";

const uuid = z.string().uuid();
const money = z.number().nonnegative();

export const quoteItemSchema = z.object({
  material_id: uuid.optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: money,
  unit_cost: money.optional().default(0),
  discount: money.optional().default(0),
  tax: money.optional().default(0),
});

export const createQuoteSchema = z.object({
  customer_id: uuid,
  notes: z.string().optional(),
  items: z.array(quoteItemSchema).min(1),
});

export const reviseQuoteSchema = z.object({
  quote_id: uuid,
  notes: z.string().optional(),
  items: z.array(quoteItemSchema).min(1),
});

export const rejectQuoteSchema = z.object({
  quote_id: uuid,
  reason: z.string().trim().min(1, "Rejection reason is required"),
});

export const recordPaymentSchema = z.object({
  quote_id: uuid,
  kind: z.enum(PAYMENT_KINDS),
  amount: money,
  method: z
    .enum(["cash", "upi", "bank_transfer", "cheque", "card", "other"])
    .optional(),
  reference: z.string().optional(),
  paid_at: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.kind === "nil" && value.amount !== 0) {
    ctx.addIssue({ code: "custom", message: "Nil payment must be amount 0", path: ["amount"] });
  }
  if ((value.kind === "advance" || value.kind === "full") && value.amount <= 0) {
    ctx.addIssue({
      code: "custom",
      message: "Advance and full payments must be greater than 0",
      path: ["amount"],
    });
  }
});

export const verifyPaymentSchema = z.object({
  payment_id: uuid,
  notes: z.string().optional(),
});

export const rejectPaymentSchema = z.object({
  payment_id: uuid,
  notes: z.string().trim().min(1, "Rejection reason is required"),
});

export const sendToVendorSchema = z.object({
  order_id: uuid,
  vendor_id: uuid,
  expected_delivery: z.string().optional(),
  items: z
    .array(
      z.object({
        order_item_id: uuid,
        quantity: z.number().positive(),
      }),
    )
    .min(1),
});

export const receiveItemsSchema = z.object({
  vendor_order_id: uuid,
  received: z
    .array(
      z.object({
        order_item_id: uuid,
        quantity: z.number().positive(),
      }),
    )
    .min(1),
});

export const completeDeliverySchema = z.object({
  order_id: uuid,
  notes: z.string().optional(),
});

export const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
