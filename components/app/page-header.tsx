import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
  hideTitleOnMobile = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  hideTitleOnMobile?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1
          className={cn(
            "text-headline-lg tracking-tight text-on-surface",
            hideTitleOnMobile && "hidden md:block",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              "text-body-sm text-on-surface-variant",
              hideTitleOnMobile ? "mt-0 md:mt-1" : "mt-1",
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 self-start">{action}</div> : null}
    </div>
  );
}
