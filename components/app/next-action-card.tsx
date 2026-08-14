import { AppLink } from "@/components/app/app-link";
import { buttonVariants } from "@/components/ui/button";
import type { NextAction } from "@/lib/workflow/next-action";
import { cn } from "@/lib/utils";

export function NextActionCard({ action }: { action: NextAction }) {
  return (
    <section className="rounded-xl border border-primary/20 bg-primary/5 p-5 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">
        Next step
      </p>
      <p className="mt-1 text-[17px] font-semibold text-on-surface">
        {action.title}
      </p>
      <p className="mt-1.5 text-[15px] leading-relaxed text-on-surface-variant">
        {action.detail}
      </p>
      {action.href && action.cta ? (
        <AppLink
          href={action.href}
          className={cn(buttonVariants({ size: "lg" }), "mt-4 inline-flex w-full md:w-auto")}
        >
          {action.cta}
        </AppLink>
      ) : null}
    </section>
  );
}
