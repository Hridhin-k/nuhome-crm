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
    <div className="rounded-xl border border-dashed border-outline-variant bg-surface px-5 py-14 text-center">
      <h2 className="text-headline-sm text-on-surface">{title}</h2>
      <p className="text-body-md mx-auto mt-2 max-w-sm text-on-surface-variant">
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
