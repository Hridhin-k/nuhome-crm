import type { AppRole, AuditAction } from "@/lib/workflow/types";

export type AuditEventInput = {
  actorId: string;
  actorRole: AppRole;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldState?: string | null;
  newState?: string | null;
  metadata?: Record<string, unknown>;
};

export function buildAuditRow(input: AuditEventInput) {
  return {
    actor_id: input.actorId,
    actor_role: input.actorRole,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId,
    old_state: input.oldState ?? null,
    new_state: input.newState ?? null,
    metadata: input.metadata ?? {},
  };
}
