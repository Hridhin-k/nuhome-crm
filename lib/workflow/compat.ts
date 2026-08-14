import type { QuoteStatus, WorkflowStatus } from "@/lib/workflow/types";
import { assertTransition } from "@/lib/workflow/transitions";

export function assertQuoteTransition(from: QuoteStatus, to: QuoteStatus) {
  assertTransition(from, to);
}

export function assertOrderTransition(from: WorkflowStatus, to: WorkflowStatus) {
  assertTransition(from, to);
}
