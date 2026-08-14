export const WRITE_OFF_REASONS = [
  "shortage",
  "damaged",
  "returned",
  "cancelled",
] as const;

export type WriteOffReason = (typeof WRITE_OFF_REASONS)[number];

export const WRITE_OFF_LABELS: Record<WriteOffReason, string> = {
  shortage: "Shortage",
  damaged: "Damaged",
  returned: "Returned",
  cancelled: "Cancelled / held back",
};

export function todayIsoDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    now,
  );
}

export function availableToSend(item: {
  quantity: number;
  allocated: number;
  quantity_written_off?: number;
}) {
  return Math.max(
    0,
    Number(item.quantity) -
      Number(item.allocated) -
      Number(item.quantity_written_off ?? 0),
  );
}

export function unaccountedQty(item: {
  quantity: number;
  quantity_received: number;
  quantity_written_off?: number;
}) {
  return Math.max(
    0,
    Number(item.quantity) -
      Number(item.quantity_received) -
      Number(item.quantity_written_off ?? 0),
  );
}

export function isVendorOrderOverdue(
  input: { expected_delivery_at: string | null | undefined; status: string },
  today = todayIsoDate(),
) {
  if (!input.expected_delivery_at) return false;
  if (!["sent", "dispatched"].includes(input.status)) return false;
  return input.expected_delivery_at.slice(0, 10) < today;
}

export function vendorOrderList(
  value:
    | { status: string; expected_delivery_at?: string | null }
    | { status: string; expected_delivery_at?: string | null }[]
    | null
    | undefined,
) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function orderHasOverdueVendor(
  vendorOrders:
    | { status: string; expected_delivery_at?: string | null }
    | { status: string; expected_delivery_at?: string | null }[]
    | null
    | undefined,
  today = todayIsoDate(),
) {
  return vendorOrderList(vendorOrders).some((vendorOrder) =>
    isVendorOrderOverdue(
      {
        expected_delivery_at: vendorOrder.expected_delivery_at ?? null,
        status: vendorOrder.status,
      },
      today,
    ),
  );
}

export function earliestOpenExpectedDate(
  vendorOrders:
    | { status: string; expected_delivery_at?: string | null }
    | { status: string; expected_delivery_at?: string | null }[]
    | null
    | undefined,
) {
  const dates = vendorOrderList(vendorOrders)
    .filter(
      (vendorOrder) =>
        ["sent", "dispatched"].includes(vendorOrder.status) &&
        vendorOrder.expected_delivery_at,
    )
    .map((vendorOrder) => vendorOrder.expected_delivery_at!.slice(0, 10))
    .sort();
  return dates[0] ?? null;
}

export function formatExpectedDate(value: string | null | undefined) {
  if (!value) return null;
  const date = value.slice(0, 10);
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
}
