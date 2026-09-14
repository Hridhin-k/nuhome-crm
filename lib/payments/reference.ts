export const PAYMENT_METHODS = [
  "cash",
  "upi",
  "bank_transfer",
  "cheque",
  "card",
  "other",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function customerPaymentReferenceRequired(kind?: string | null) {
  return kind !== "nil";
}

export function vendorPaymentReferenceRequired(
  method?: string | null,
  amount = 0,
) {
  if (amount <= 0) return false;
  return method !== "cash";
}

export function remainingPaymentKinds(
  payments: { kind?: string | null; status?: string | null }[],
): Array<"advance" | "full" | "nil"> {
  const advancePaid = payments.some(
    (payment) => payment.kind === "advance" && payment.status === "verified",
  );
  return advancePaid ? ["full", "nil"] : ["advance", "full", "nil"];
}
