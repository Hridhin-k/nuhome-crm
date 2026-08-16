import { ActivityTimeline } from "@/components/app/activity-timeline";
import { FloorBoard } from "@/components/app/floor-board";
import { HomeHero, HomeSection } from "@/components/app/home-hero";
import { InboxList } from "@/components/app/inbox-list";
import { PageFrame } from "@/components/app/page-frame";
import { AppLink } from "@/components/app/app-link";
import { getHomeQueuesForRoles, getOperationsSnapshot } from "@/lib/api/dashboard";
import { getCatalogSnapshot } from "@/lib/api/catalog";
import { listRecentAudit } from "@/lib/api/reports";
import { requireUser } from "@/lib/auth/guards";
import { roleLabels } from "@/lib/auth/nav";
import { rolesHavePermission } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/workflow/types";

function greeting(now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function dateLabel(now = new Date()) {
  return `${new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(now)} IST`;
}

function heroMetrics(
  queues: { title: string; count: number }[],
) {
  const overdue = queues.find((card) =>
    card.title.toLowerCase().includes("overdue"),
  );
  const rest = queues.filter((card) => card !== overdue);
  const ordered =
    overdue && overdue.count > 0
      ? [rest[0], overdue, rest[1]].filter(Boolean)
      : queues;
  return ordered.slice(0, 3).map((card) => ({
    label: metricLabel(card.title),
    value: String(card.count),
    alert: card.title.toLowerCase().includes("overdue"),
  }));
}

function metricLabel(title: string) {
  const key = title.toLowerCase();
  if (key.includes("approval")) return "Approvals";
  if (key.includes("verification") || key.includes("payment")) return "Verify";
  if (key.includes("customer")) return "Customers";
  if (key.includes("overdue")) return "Overdue";
  if (key.includes("hold") || key.includes("collect")) return "Hold";
  if (key.includes("ready") || key.includes("deliver")) return "Ready";
  if (key.includes("quote")) return "Quotes";
  if (key.includes("dispatch")) return "Dispatch";
  if (key.includes("expected") || key.includes("item")) return "Incoming";
  if (key.includes("attention")) return "Attention";
  if (key.includes("active") || key.includes("awaiting vendor")) return "Active";
  return title.split(" ")[0] ?? title;
}

function deskLine(primary: AppRole, roles: AppRole[], openCount: number) {
  const lines: Record<AppRole, string> = {
    sales: "Quotes, customers, and cash on the floor.",
    accounts: "Price, discount, and receipts — nothing moves without you.",
    procurement: "Send, chase, and receive vendor batches.",
    store: "Handover only when the gate is unlocked.",
    admin: "Every job, every status, in one view.",
  };
  if (openCount === 0) {
    return `${lines[primary]} You’re clear.`;
  }
  if (roles.length > 1 && primary !== "admin") {
    return `${lines[primary]} ${openCount} waiting across your hats.`;
  }
  return `${lines[primary]} ${openCount} waiting.`;
}

function heroAction(roles: AppRole[]) {
  if (roles.includes("admin")) {
    return { href: "/reports?view=floor", label: "Reports and exports" };
  }
  if (rolesHavePermission(roles, "quotes.create")) {
    return { href: "/walk-in", label: "Customer walk-in" };
  }
  if (roles.includes("procurement")) {
    return { href: "/fulfillment", label: "Open fulfillment" };
  }
  if (roles.includes("store")) {
    return { href: "/ready", label: "Ready to deliver" };
  }
  if (roles.includes("accounts")) {
    return { href: "/approvals", label: "Review quotes" };
  }
  return undefined;
}

export default async function HomePage() {
  const user = await requireUser();
  const firstName = user.fullName.split(" ")[0] || user.fullName;
  const hello = greeting();
  const today = dateLabel();
  const desk = roleLabels(user.roles);

  if (user.roles.includes("admin")) {
    const [snapshot, catalog, recent] = await Promise.all([
      getOperationsSnapshot(),
      getCatalogSnapshot(),
      listRecentAudit(12),
    ]);
    const waiting =
      snapshot.overdue + snapshot.pendingPayments + snapshot.pendingApprovals;
    return (
      <PageFrame>
        <HomeHero
          hello={hello}
          firstName={firstName}
          desk={desk}
          line={deskLine(user.role, user.roles, waiting)}
          dateLabel={today}
          action={heroAction(user.roles)}
          metrics={[
            { label: "In play", value: String(snapshot.open) },
            {
              label: "Overdue",
              value: String(snapshot.overdue),
              alert: true,
            },
            { label: "Done", value: String(snapshot.delivered) },
          ]}
        />
        <div className="space-y-8">
          <FloorBoard
            census={snapshot.census}
            asOf={snapshot.asOf}
            overdue={snapshot.overdue}
            pendingPayments={snapshot.pendingPayments}
            pendingApprovals={snapshot.pendingApprovals}
            open={snapshot.open}
            customers={snapshot.customers}
            delivered={snapshot.delivered}
          />
          <HomeSection
            title="Catalog"
            action={
              <AppLink href="/users" className="text-body-sm text-primary">
                Manage
              </AppLink>
            }
          >
            <ul className="grid grid-cols-3 gap-3">
              {[
                { label: "Users", count: catalog.users, href: "/users" },
                { label: "Vendors", count: catalog.vendors, href: "/vendors" },
                {
                  label: "Materials",
                  count: catalog.materials,
                  href: "/materials",
                },
              ].map((item) => (
                <li key={item.label}>
                  <AppLink
                    href={item.href}
                    className="flex h-full flex-col rounded-2xl border border-outline-variant bg-card px-3 py-4 shadow-card"
                  >
                    <span className="text-headline-md tabular-nums text-on-surface">
                      {item.count}
                    </span>
                    <span className="mt-1 text-label-caps text-on-surface-variant">
                      {item.label}
                    </span>
                  </AppLink>
                </li>
              ))}
            </ul>
          </HomeSection>
          <ActivityTimeline
            events={recent}
            emptyMessage="No floor activity yet."
          />
        </div>
      </PageFrame>
    );
  }

  const queues = await getHomeQueuesForRoles(user.roles);
  const openCount = queues.reduce((sum, card) => sum + card.count, 0);

  return (
    <PageFrame>
      <HomeHero
        hello={hello}
        firstName={firstName}
        desk={desk}
        line={deskLine(user.role, user.roles, openCount)}
        dateLabel={today}
        action={heroAction(user.roles)}
        metrics={heroMetrics(queues)}
      />
      <HomeSection title="Your board">
        <InboxList
          highlight
          items={queues.map((item) => ({
            ...item,
            alert: item.title.toLowerCase().includes("overdue"),
          }))}
        />
      </HomeSection>
    </PageFrame>
  );
}
