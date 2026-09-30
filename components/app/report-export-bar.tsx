import { Download, Printer } from "lucide-react";
import { AppLink } from "@/components/app/app-link";
import { buttonVariants } from "@/components/ui/button";
import { pathWithQuery } from "@/lib/search";
import type { ExportKind } from "@/lib/reports/load-export";

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
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <Download aria-hidden />
          {item.label}
        </a>
      ))}
      <AppLink
        href={pathWithQuery("/reports/print", query)}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <Printer aria-hidden />
        PDF
      </AppLink>
    </div>
  );
}
