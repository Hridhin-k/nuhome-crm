import type { ReactNode } from "react";
import { AppLink } from "@/components/app/app-link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
  action,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-outline-variant bg-card px-4 py-10 text-center shadow-card">
      <h2 className="text-subheading text-on-surface">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-body-sm text-on-surface-variant">
        {description}
      </p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
      {!action && actionHref && actionLabel ? (
        <AppLink
          href={actionHref}
          className={cn(buttonVariants({ size: "lg" }), "mt-6 inline-flex px-6")}
        >
          {actionLabel}
        </AppLink>
      ) : null}
    </div>
  );
}
