import { z } from "zod";
import { optionalIndianMobileSchema } from "@/lib/validation/phone";
import { PAYMENT_KINDS } from "@/lib/workflow/types";

const uuid = z.string().uuid();
const money = z.number().nonnegative();

export const quoteItemSchema = z.object({
  material_id: uuid.optional(),
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unit_price: money,
  unit_cost: money.optional().default(0),
  discount: money.optional().default(0),
  tax: money.optional().default(0),
  hsn_code: z.string().trim().max(8).optional(),
  gst_rate: z.number().min(0).max(100).optional(),
});

export const createQuoteSchema = z.object({
  customer_id: uuid,
  notes: z.string().optional(),
  items: z.array(quoteItemSchema).min(1),
  warranty_months: z.number().int().min(0).max(120).optional(),
  include_amc: z.boolean().optional(),
  amc_months: z.number().int().min(0).max(120).optional(),
});

export const reviseQuoteSchema = z.object({
  quote_id: uuid,
  notes: z.string().optional(),
  items: z.array(quoteItemSchema).min(1),
  warranty_months: z.number().int().min(0).max(120).optional(),
  include_amc: z.boolean().optional(),
  amc_months: z.number().int().min(0).max(120).optional(),
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

export const saveVendorQuoteSchema = z.object({
  vendor_order_id: uuid,
  quote_ref: z.string().trim().min(1, "Vendor quote reference is required"),
  quote_amount: money.refine((n) => n > 0, "Vendor quote amount must be greater than 0"),
});

export const decideVendorQuoteSchema = z.object({
  vendor_order_id: uuid,
  approve: z.boolean(),
  reason: z.string().trim().optional(),
}).superRefine((value, ctx) => {
  if (!value.approve && !value.reason) {
    ctx.addIssue({
      code: "custom",
      message: "A reason is required to return a vendor quote",
      path: ["reason"],
    });
  }
});

export const allocateVendorsSchema = z.object({
  order_id: uuid,
  order_number: z.string().min(1),
  expected_delivery: z.string().optional(),
  items: z
    .array(
      z.object({
        order_item_id: uuid,
        vendor_id: uuid,
        quantity: z.number().int().positive(),
        unit_cost: z.number().nonnegative().optional(),
        vendor_name: z.string().optional(),
      }),
    )
    .min(1),
});

export const sendToVendorSchema = z.object({
  order_id: uuid,
  vendor_id: uuid,
  expected_delivery: z.string().optional(),
  items: z
    .array(
      z.object({
        order_item_id: uuid,
        quantity: z.number().int().positive(),
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
        quantity: z.number().int().nonnegative(),
      }),
    )
    .min(1),
});

export const writeOffItemsSchema = z.object({
  order_id: uuid,
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        order_item_id: uuid,
        quantity: z.number().int().positive(),
        reason: z.enum(["shortage", "damaged", "returned", "cancelled"]),
      }),
    )
    .min(1),
});

export const completeDeliverySchema = z.object({
  order_id: uuid,
  notes: z.string().optional(),
});

export const cancelJobSchema = z.object({
  quote_id: uuid,
  reason: z.string().trim().min(1, "A reason is required to cancel"),
});

export const customerSchema = z.object({
  name: z.string().min(1),
  phone: optionalIndianMobileSchema,
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  gstin: z.string().trim().max(15).optional(),
  billing_address: z.string().optional(),
  site_address: z.string().optional(),
  notes: z.string().optional(),
  firm: z.string().optional(),
  whatsapp: optionalIndianMobileSchema,
  profession: z.array(z.string()).optional(),
  profession_other: z.string().optional(),
  property_type: z.string().optional(),
  property_other: z.string().optional(),
  project_status: z.string().optional(),
  interests: z.array(z.string()).optional(),
  source: z.string().optional(),
  source_other: z.string().optional(),
  follow_up_on: z.string().optional(),
  follow_up_action: z.string().optional(),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
