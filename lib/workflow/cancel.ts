import { rolesHavePermission } from "@/lib/auth/permissions";
import type { AppRole, WorkflowStatus } from "@/lib/workflow/types";

export function isCancelledStatus(status: WorkflowStatus) {
  return status === "cancelled";
}

export function canCancelJob(input: {
  quoteStatus: WorkflowStatus;
  orderStatus?: WorkflowStatus | null;
  roles: AppRole[] | AppRole;
}) {
  const { quoteStatus, orderStatus, roles } = input;
  const live = orderStatus ?? quoteStatus;
  if (live === "cancelled" || quoteStatus === "cancelled") {
    return false;
  }
  if (live === "delivered" || live === "closed") {
    return false;
  }

  if (orderStatus) {
    return (
      rolesHavePermission(roles, "quotes.create") ||
      rolesHavePermission(roles, "orders.send_to_vendor")
    );
  }

  if (rolesHavePermission(roles, "quotes.create")) {
    return true;
  }
  return (
    quoteStatus === "quote_pending_accounts" &&
    rolesHavePermission(roles, "quotes.approve")
  );
}
