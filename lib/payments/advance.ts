export function defaultAdvanceAmount(outstanding: number) {
  if (!Number.isFinite(outstanding) || outstanding <= 0) return 0;
  return Math.round(outstanding * 50) / 100;
}

export const ADVANCE_QUOTE_NOTE =
  "50% advance on booking unless otherwise agreed. Nil / credit booking is allowed when Accounts agrees.";
