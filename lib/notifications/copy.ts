export function notificationBody(input: {
  customerName?: string | null;
  status?: string | null;
  ref?: string | null;
  item?: string | null;
  detail: string;
}) {
  const parts = [
    input.customerName?.trim(),
    input.status?.trim(),
    input.ref?.trim(),
    input.item?.trim(),
  ].filter(Boolean);
  const head = parts.join(" · ");
  return head ? `${head}. ${input.detail}` : input.detail;
}
