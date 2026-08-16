import { AppLink } from "@/components/app/app-link";
import { pathWithQuery } from "@/lib/search";
import type { ExportKind } from "@/lib/reports/load-export";
import { cn } from "@/lib/utils";

type View = "floor" | "business" | "pipeline" | "audit";

const LINKS: Record<View, { kind: ExportKind; label: string }[]> = {
  floor: [{ kind: "floor", label: "Floor CSV" }],
  pipeline: [{ kind: "queues", label: "Queues CSV" }],
  audit: [{ kind: "audit", label: "Audit CSV" }],
  business: [
    { kind: "collections", label: "Collections CSV" },
    { kind: "sitting", label: "Sitting CSV" },
    { kind: "aging", label: "Aging CSV" },
  ],
};

export function ReportExportBar({
  view,
  from,
  to,
  action,
  q,
}: {
  view: View;
  from: string;
  to: string;
  action?: string;
  q?: string;
}) {
  const printKind =
    view === "pipeline" ? "queues" : view === "business" ? "business" : view;
  const query = { kind: printKind, from, to, action, q };

  return (
    <div className="mb-4 flex flex-wrap gap-2 print:hidden">
      {LINKS[view].map((item) => (
        <a
          key={item.kind}
          href={pathWithQuery("/reports/export", {
            kind: item.kind,
            from,
            to,
            action,
            q,
          })}
          className="inline-flex h-9 items-center rounded-full border border-outline-variant bg-card px-3 text-body-sm text-on-surface"
        >
          {item.label}
        </a>
      ))}
      <AppLink
        href={pathWithQuery("/reports/print", query)}
        className={cn(
          "inline-flex h-9 items-center rounded-full bg-primary px-3 text-body-sm text-on-primary",
        )}
      >
        PDF
      </AppLink>
    </div>
  );
}
