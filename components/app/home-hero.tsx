import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Boxes,
  CheckSquare,
  FileText,
  Plus,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { AppLink } from "@/components/app/app-link";
import { roleLabel } from "@/lib/auth/nav";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/workflow/types";

export type HeroMetric = {
  label: string;
  value: number;
  hint: string;
  href: string;
  tone: HeroTone;
};

export type HeroTone = "violet" | "blue" | "green" | "amber" | "rose";

const TONE: Record<HeroTone, { icon: string; fill: string }> = {
  violet: { icon: "text-[#c4b5fd]", fill: "bg-[#6366f1]/25" },
  blue: { icon: "text-[#7dd3fc]", fill: "bg-[#0ea5e9]/20" },
  green: { icon: "text-[#6ee7b7]", fill: "bg-[#10b981]/20" },
  amber: { icon: "text-[#fbbf24]", fill: "bg-[#f59e0b]/20" },
  rose: { icon: "text-[#fda4af]", fill: "bg-[#f43f5e]/20" },
};

const METRIC_ICON: Record<string, LucideIcon> = {
  Quotes: FileText,
  Approvals: CheckSquare,
  Customers: Users,
  Users: Users,
  Verify: Wallet,
  Payments: Wallet,
  Active: Activity,
  Incoming: Boxes,
  Dispatch: Truck,
  Ready: Truck,
  Hold: Wallet,
  Overdue: Activity,
  Attention: FileText,
  "In play": BarChart3,
  Done: CheckSquare,
  Catalog: Boxes,
};

const ROLE_MOTIF: Record<AppRole, LucideIcon[]> = {
  sales: [Users, FileText, Activity],
  accounts: [CheckSquare, Wallet, FileText],
  procurement: [Truck, Boxes, Activity],
  store: [Truck, Boxes, Users],
  admin: [BarChart3, Users, FileText],
};

export function HomeHero({
  hello,
  role,
  badge,
  line,
  dateLabel,
  metrics,
  action,
}: {
  hello: string;
  role: AppRole;
  badge: string;
  line: string;
  dateLabel: string;
  metrics: HeroMetric[];
  action?: { href: string; label: string };
}) {
  const title = roleLabel(role);
  const values = metrics.map((metric) => metric.value);

  return (
    <section className="relative -mx-4 mb-6 overflow-hidden bg-[#09090b] text-white md:mx-0 md:rounded-[1.75rem]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_80%_at_100%_0%,rgba(99,102,241,0.38),transparent_58%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 right-[-20%] size-56 rounded-full bg-[#6366f1]/20 blur-3xl"
      />

      <div className="relative px-4 pt-5 pb-4 md:px-7 md:pt-7 md:pb-5">
        <div className="relative min-h-[11.5rem] pr-[7.5rem] md:min-h-[13rem] md:pr-48">
          <p className="text-[11px] font-medium tracking-wide text-white/45 md:text-xs">
            {dateLabel}
          </p>
          <p className="mt-4 text-[15px] text-white/80 md:text-base">{hello}</p>
          <h1 className="mt-1 text-[34px] leading-none font-bold tracking-tight md:text-[42px]">
            {title}
          </h1>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#6366f1]/35 px-2.5 py-1 text-[11px] font-semibold text-[#ddd6fe]">
            <Users className="size-3.5" aria-hidden />
            {badge}
          </p>
          <p className="mt-3 max-w-[17rem] text-[13px] leading-5 text-white/60 md:max-w-sm md:text-sm">
            {line}
          </p>
          {action ? (
            <AppLink
              href={action.href}
              className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-[13px] font-semibold text-[#111] md:h-12 md:px-5 md:text-sm"
            >
              {action.href === "/walk-in" ? (
                <Plus className="size-4" strokeWidth={2.5} aria-hidden />
              ) : null}
              {action.label}
            </AppLink>
          ) : null}

          <LiveOverview role={role} values={values} />
        </div>

        {metrics.length > 0 ? (
          <dl className="mt-6 grid grid-cols-3 divide-x divide-white/10 rounded-2xl bg-white/[0.06] ring-1 ring-white/10">
            {metrics.slice(0, 3).map((metric) => (
              <MetricCell key={metric.label} metric={metric} />
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}

function MetricCell({ metric }: { metric: HeroMetric }) {
  const Icon = METRIC_ICON[metric.label] ?? Activity;
  const tone = TONE[metric.tone];

  return (
    <AppLink href={metric.href} className="min-w-0 px-2.5 py-3 md:px-4 md:py-3.5">
      <dt className="flex items-center gap-1.5">
        <span
          className={cn(
            "inline-flex size-6 items-center justify-center rounded-md md:size-7",
            tone.fill,
            tone.icon,
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </span>
        <span className="sr-only">{metric.label}</span>
      </dt>
      <dd className="mt-2 text-[22px] leading-none font-bold tabular-nums tracking-tight md:text-[26px]">
        {metric.value}
      </dd>
      <p className="mt-1.5 truncate text-[11px] text-white/45">{metric.hint}</p>
    </AppLink>
  );
}

function LiveOverview({ role, values }: { role: AppRole; values: number[] }) {
  const motifs = ROLE_MOTIF[role];

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-8 right-0 h-[8.5rem] w-[7.25rem] md:top-6 md:h-40 md:w-44"
    >
      {motifs.map((Icon, index) => (
        <div
          key={index}
          className="absolute rounded-2xl border border-white/12 bg-white/[0.07]"
          style={{
            width: 36,
            height: 58,
            right: 8 + index * 22,
            top: 18 + (index % 2) * 6,
          }}
        >
          <Icon className="mt-3 ml-2 size-3.5 text-white/55" />
        </div>
      ))}
      <div className="absolute right-0 bottom-0 w-[6.75rem] rounded-2xl border border-white/15 bg-white/[0.09] px-2.5 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.35)] md:w-40 md:px-3 md:py-2.5">
        <p className="text-[9px] font-semibold tracking-wide text-white/50 uppercase md:text-[10px]">
          Live overview
        </p>
        <Sparkline values={values} />
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const live = values.some((value) => value > 0);
  const series = live ? [0, ...values] : [3, 7, 5, 11, 8, 14];
  const peak = Math.max(...series, 1);
  const width = 120;
  const height = 36;
  const points = series.map((value, index) => {
    const x = (index / Math.max(series.length - 1, 1)) * width;
    const y = height - 4 - (value / peak) * (height - 8);
    return `${x},${y}`;
  });
  const last = points[points.length - 1]?.split(",") ?? ["0", "0"];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-1 h-8 w-full md:h-10">
      <polyline
        fill="none"
        stroke="#a78bfa"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points.join(" ")}
      />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="#c4b5fd" />
    </svg>
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
