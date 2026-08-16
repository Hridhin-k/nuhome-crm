import {
  formatAuditEvent,
  groupAuditByDay,
  type AuditEvent,
} from "@/lib/workflow/audit-labels";
import { cn } from "@/lib/utils";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function isToday(label: string) {
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  return label === today;
}

export function ActivityTimeline({
  events,
  emptyMessage = "No activity recorded yet.",
}: {
  events: AuditEvent[];
  emptyMessage?: string;
}) {
  if (events.length === 0) {
    return (
      <section className="rounded-2xl border border-outline-variant bg-card p-4 shadow-card">
        <h2 className="text-subheading text-on-surface">Activity</h2>
        <p className="mt-3 text-sm text-on-surface-variant">{emptyMessage}</p>
      </section>
    );
  }

  const groups = groupAuditByDay(events);

  return (
    <section className="rounded-2xl border border-outline-variant bg-card p-4 shadow-card">
      <h2 className="text-subheading text-on-surface">Activity</h2>
      <div className="mt-4 space-y-6">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="text-[12px] font-medium text-on-surface-variant">
              {isToday(group.label) ? "Today" : group.label}
            </p>
            <ol className="mt-3 space-y-4">
              {group.items.map((event, index) => {
                const formatted = formatAuditEvent(event);
                const isFirst = index === 0 && isToday(group.label);
                return (
                  <li key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          isFirst
                            ? "bg-success text-on-primary"
                            : "bg-surface-container-high text-on-surface-variant",
                        )}
                        aria-hidden
                      >
                        {isFirst ? "✓" : "·"}
                      </span>
                      {index < group.items.length - 1 ? (
                        <span className="mt-1 w-px flex-1 bg-surface-variant" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 pb-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium text-on-surface">
                          {formatted.title}
                        </p>
                        <time
                          className="text-xs text-on-surface-variant"
                          dateTime={event.created_at}
                        >
                          {formatTime(event.created_at)}
                        </time>
                      </div>
                      {formatted.detail ? (
                        <p className="mt-0.5 text-sm text-on-surface-variant">
                          {formatted.detail}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-outline">
                        {formatted.actor}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
