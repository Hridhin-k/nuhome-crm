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

/** Office counter money pays for items already handed over, so it never uses up the advance. */
export function remainingPaymentKinds(
  payments: {
    kind?: string | null;
    status?: string | null;
    office_counter?: boolean | null;
  }[],
): Array<"advance" | "full" | "nil"> {
  const advancePaid = payments.some(
    (payment) =>
      payment.kind === "advance" &&
      payment.status === "verified" &&
      !payment.office_counter,
  );
  return advancePaid ? ["full", "nil"] : ["advance", "full", "nil"];
}
