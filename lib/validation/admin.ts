import { z } from "zod";
import { APP_ROLES } from "@/lib/workflow/types";

export const createStaffSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  full_name: z.string().trim().min(1, "Name is required"),
  role: z.enum(APP_ROLES),
  phone: z.string().trim().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const updateStaffSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(1, "Name is required"),
  role: z.enum(APP_ROLES),
  phone: z.string().trim().optional(),
  is_active: z.boolean(),
});

export const vendorInputSchema = z.object({
  name: z.string().trim().min(1, "Vendor name is required"),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  notes: z.string().trim().optional(),
});

export const materialInputSchema = z.object({
  name: z.string().trim().min(1, "Material name is required"),
  sku: z.string().trim().min(1, "SKU is required"),
  category: z.string().trim().min(1, "Category is required"),
  unit: z.string().trim().min(1).default("pcs"),
  sell_price: z.number().nonnegative("Sell price cannot be negative"),
  cost: z.number().nonnegative("Cost cannot be negative"),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type VendorInput = z.infer<typeof vendorInputSchema>;
export type MaterialInput = z.infer<typeof materialInputSchema>;
