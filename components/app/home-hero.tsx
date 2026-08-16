import type { ReactNode } from "react";
import { AppLink } from "@/components/app/app-link";
import { cn } from "@/lib/utils";

export function HomeHero({
  hello,
  firstName,
  desk,
  line,
  dateLabel,
  metrics,
  action,
}: {
  hello: string;
  firstName: string;
  desk: string;
  line: string;
  dateLabel: string;
  metrics?: { label: string; value: string; alert?: boolean }[];
  action?: { href: string; label: string };
}) {
  return (
    <section className="relative -mx-4 mb-6 overflow-hidden bg-primary text-on-primary md:mx-0 md:rounded-2xl">
      <div className="relative px-4 py-6 md:px-8 md:py-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_70%_at_100%_0%,rgba(255,255,255,0.14),transparent_55%)]"
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-label-caps text-on-primary/55">{dateLabel}</p>
            <p className="mt-3 text-body-sm text-on-primary/70">{hello}</p>
            <h1 className="mt-0.5 truncate text-headline-lg tracking-tight">
              {firstName}
            </h1>
            <p className="mt-3 inline-flex rounded-full bg-white/12 px-2.5 py-1 text-label-caps text-on-primary/80">
              {desk}
            </p>
            <p className="mt-3 max-w-md text-body-sm text-on-primary/75">{line}</p>
            {action ? (
              <AppLink
                href={action.href}
                className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-on-primary px-5 text-subheading text-primary"
              >
                {action.label}
              </AppLink>
            ) : null}
          </div>
          {metrics && metrics.length > 0 ? (
            <dl className="grid min-w-0 grid-cols-3 gap-3 md:min-w-[18rem]">
              {metrics.map((metric) => (
                <div key={metric.label} className="min-w-0">
                  <dt className="truncate text-label-caps text-on-primary/50">
                    {metric.label}
                  </dt>
                  <dd
                    className={cn(
                      "mt-1 text-headline-md tabular-nums tracking-tight",
                      metric.alert && metric.value !== "0"
                        ? "text-[#ffb4ab]"
                        : "text-on-primary",
                    )}
                  >
                    {metric.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function HomeSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-subheading text-on-surface">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
