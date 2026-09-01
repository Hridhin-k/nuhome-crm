import { z } from "zod";
import { isLocalMobile } from "@/lib/customers/phone";

export const optionalIndianMobileSchema = z
  .string()
  .trim()
  .optional()
  .refine((value) => isLocalMobile(value), {
    message: "Enter a 10-digit mobile number",
  });
