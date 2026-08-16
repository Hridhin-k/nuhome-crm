import { z } from "zod";

export const ATTACHMENT_KINDS = [
  "measurement",
  "drawing",
  "photo",
  "file",
] as const;

export const attachmentKindSchema = z.enum(ATTACHMENT_KINDS);

export const uploadAttachmentSchema = z.object({
  entity_type: z.enum(["customer", "quote", "order"]),
  entity_id: z.string().uuid(),
  kind: attachmentKindSchema,
  return_to: z.string().startsWith("/").optional(),
});

export const companySettingsSchema = z.object({
  legal_name: z.string().trim().min(1, "Legal name is required"),
  gstin: z
    .string()
    .trim()
    .max(15)
    .optional()
    .or(z.literal("")),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  state_code: z.string().trim().max(2).optional(),
  default_gst_rate: z.number().min(0).max(100),
});

export const installationSchema = z.object({
  order_id: z.string().uuid(),
  scheduled_on: z.string().trim().min(1, "Pick a date"),
  notes: z.string().trim().optional(),
  status: z.enum(["scheduled", "done", "cancelled"]).optional(),
});

export const warrantySchema = z.object({
  order_id: z.string().uuid(),
  kind: z.enum(["warranty", "amc"]),
  starts_on: z.string().trim().min(1, "Start date is required"),
  ends_on: z.string().trim().min(1, "End date is required"),
  notes: z.string().trim().optional(),
});

export type AttachmentKind = z.infer<typeof attachmentKindSchema>;
export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;
