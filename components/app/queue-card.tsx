import { AppLink } from "@/components/app/app-link";
import { cn } from "@/lib/utils";
import type { Accent } from "@/components/app/progress-bar";

export function QueueCard({
  title,
  count,
  href,
  detail,
}: {
  title: string;
  count: number;
  href: string;
  detail: string;
  accent?: Accent;
  progress?: { value: number; max: number };
}) {
  const empty = count === 0;

  return (
    <AppLink
      href={href}
      className="block rounded-lg focus-visible:ring-3 focus-visible:ring-secondary/30"
    >
      <article className="rounded-lg border border-border bg-card px-4 py-4 transition-colors hover:bg-muted/50">
        <span className="text-[13px] font-medium text-on-surface-variant">
          {title}
        </span>
        <div className="mt-3">
          <span
            className={cn(
              "block text-[22px] leading-none font-semibold tracking-tight tabular-nums",
              empty ? "text-outline" : "text-on-surface",
            )}
          >
            {count}
          </span>
          <span className="mt-1.5 block text-[13px] text-on-surface-variant">
            {detail}
          </span>
        </div>
      </article>
    </AppLink>
  );
}
