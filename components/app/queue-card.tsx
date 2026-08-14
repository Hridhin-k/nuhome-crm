import { AppLink } from "@/components/app/app-link";
import {
  accentFill,
  accentLabel,
  accentText,
  accentWash,
  type Accent,
} from "@/components/app/progress-bar";
import { cn } from "@/lib/utils";

/**
 * Stitch metric card — desktop style (sales_dashboard_desktop)
 * and mobile style (sales_dashboard_mobile / accounts_dashboard_mobile).
 */
export function QueueCard({
  title,
  count,
  href,
  detail,
  accent = "cerulean",
}: {
  title: string;
  count: number;
  href: string;
  detail: string;
  accent?: Accent;
  progress?: { value: number; max: number };
}) {
  return (
    <AppLink
      href={href}
      className="block rounded-xl focus-visible:ring-3 focus-visible:ring-secondary/30"
    >
      {/* Desktop: Stitch metric card */}
      <article className="hidden h-[140px] flex-col justify-between rounded-xl border border-surface-variant bg-surface-container-lowest p-4 shadow-card transition-colors hover:border-outline-variant md:flex">
        <div className="flex items-start justify-between gap-3">
          <span className="text-label-md text-on-surface-variant">{title}</span>
          <span className={cn("size-2.5 rounded-full", accentFill[accent])} />
        </div>
        <div>
          <span className="text-display-lg block text-on-surface">{count}</span>
          <span className="text-body-md mt-1 block text-outline">{detail}</span>
        </div>
      </article>

      {/* Mobile: Stitch attention card */}
      <article className="flex min-h-[140px] flex-col justify-between rounded-xl border border-surface-variant bg-surface-container-lowest p-4 shadow-card transition-colors hover:border-outline-variant md:hidden">
        <div className="flex items-start justify-between gap-3">
          <span
            className={cn(
              "inline-flex size-10 items-center justify-center rounded-lg",
              accentWash[accent],
            )}
          >
            <span className={cn("size-2 rounded-full", accentFill[accent])} />
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold tracking-wider uppercase",
              accentWash[accent],
              accentText[accent],
            )}
          >
            <span className={cn("size-1.5 rounded-full", accentFill[accent])} />
            {accentLabel[accent]}
          </span>
        </div>
        <div className="mt-4">
          <h2 className="text-headline-md text-primary">
            {count} {title}
          </h2>
          <p className="text-body-md mt-1 text-on-surface-variant">{detail}</p>
        </div>
      </article>
    </AppLink>
  );
}
