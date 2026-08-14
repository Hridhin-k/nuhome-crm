import type { ReactNode } from "react";
import { AppLink } from "@/components/app/app-link";
import { buttonVariants } from "@/components/ui/button";
import type { NextAction } from "@/lib/workflow/next-action";
import { cn } from "@/lib/utils";

export function NextActionCard({
  action,
  actionSlot,
}: {
  action: NextAction;
  actionSlot?: ReactNode;
}) {
  const blocked =
    /hold|locked|returned|revise/i.test(`${action.title} ${action.detail}`);
  const hasCta = Boolean(actionSlot || (action.href && action.cta));

  return (
    <section
      className={cn(
        "relative min-w-0 overflow-hidden rounded-lg border border-outline-variant bg-card shadow-card",
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-2",
          blocked ? "bg-error" : "bg-primary",
        )}
      />
      <div className="flex flex-col gap-4 p-4 pl-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-label-caps text-on-surface-variant">Next</p>
          <p className="mt-1 text-subheading text-on-surface">{action.title}</p>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            {action.detail}
          </p>
        </div>
        {actionSlot ? (
          <div className="w-full shrink-0 sm:w-auto">{actionSlot}</div>
        ) : hasCta ? (
          <AppLink
            href={action.href!}
            className={cn(
              buttonVariants({ size: "lg" }),
              "w-full shrink-0 sm:w-auto",
            )}
          >
            {action.cta}
          </AppLink>
        ) : null}
      </div>
    </section>
  );
}
