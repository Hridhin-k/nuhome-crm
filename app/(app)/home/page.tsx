import { ActivityTimeline } from "@/components/app/activity-timeline";
import { FloorBoard } from "@/components/app/floor-board";
import { HomeHero, HomeSection, type HeroMetric } from "@/components/app/home-hero";
import { InboxList } from "@/components/app/inbox-list";
import { PageFrame } from "@/components/app/page-frame";
import { AppLink } from "@/components/app/app-link";
import {
  cardById,
  getHomeQueuesForRoles,
  getOperationsSnapshot,
  type QueueCard,
} from "@/lib/api/dashboard";
import { workWaiting } from "@/lib/workflow/home-counts";
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
  if (hour < 12) return "Good morning 👋";
  if (hour < 17) return "Good afternoon 👋";
  return "Good evening 👋";
}

function dateLabel(now = new Date()) {
  const date = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(now);
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(now);
  return `${date} • ${time} IST`;
}

function metric(
  card: QueueCard | undefined,
  spec: {
    label: string;
    href: string;
    tone: HeroMetric["tone"];
    empty: string;
    filled: string;
  },
): HeroMetric {
  const value = card?.count ?? 0;
  return {
    label: spec.label,
    value,
    href: card?.href ?? spec.href,
    tone: spec.tone,
    hint: value === 0 ? spec.empty : spec.filled,
  };
}

function roleMetrics(role: AppRole, queues: QueueCard[]): HeroMetric[] {
  if (role === "accounts") {
    return [
      metric(cardById(queues, "approvals"), {
        label: "Approvals",
        href: "/approvals",
        tone: "violet",
        empty: "No quotes to review",
        filled: "Quotes to review",
      }),
      metric(cardById(queues, "payments"), {
        label: "Verify",
        href: "/payments",
        tone: "blue",
        empty: "No receipts waiting",
        filled: "Receipts to confirm",
      }),
      metric(cardById(queues, "attention"), {
        label: "Attention",
        href: "/orders?bucket=attention",
        tone: "amber",
        empty: "No orders waiting",
        filled: "Jobs need a look",
      }),
    ];
  }

  if (role === "procurement") {
    return [
      metric(cardById(queues, "awaiting-vendor"), {
        label: "Send",
        href: "/fulfillment",
        tone: "violet",
        empty: "Nothing to send",
        filled: "Not sent yet",
      }),
      metric(cardById(queues, "vendor-dispatches"), {
        label: "Sent",
        href: "/fulfillment",
        tone: "blue",
        empty: "None waiting dispatch",
        filled: "Sent, not dispatched",
      }),
      metric(cardById(queues, "vendor-overdue"), {
        label: "Overdue",
        href: "/fulfillment",
        tone: "rose",
        empty: "Vendors on time",
        filled: "Past expected date",
      }),
    ];
  }

  if (role === "store") {
    return [
      metric(cardById(queues, "ready-delivery"), {
        label: "Ready",
        href: "/ready",
        tone: "green",
        empty: "Nothing to hand over",
        filled: "Unlocked for delivery",
      }),
      metric(cardById(queues, "collect-handover"), {
        label: "Hold",
        href: "/orders?bucket=hold",
        tone: "amber",
        empty: "No collections due",
        filled: "Collect at handover",
      }),
      metric(cardById(queues, "vendor-overdue"), {
        label: "Overdue",
        href: "/orders?bucket=active",
        tone: "rose",
        empty: "Vendors on time",
        filled: "Past expected date",
      }),
    ];
  }

  return [
    metric(cardById(queues, "pending-quotes"), {
      label: "Quotes",
      href: "/quotes?group=quote",
      tone: "violet",
      empty: "No open quotes",
      filled: "Not an order yet",
    }),
    metric(cardById(queues, "payment"), {
      label: "Payment",
      href: "/orders?bucket=payment",
      tone: "blue",
      empty: "No payment waiting",
      filled: "Sent or verifying",
    }),
    metric(cardById(queues, "active-orders"), {
      label: "Active",
      href: "/orders?bucket=active",
      tone: "green",
      empty: "No active orders",
      filled: "With vendor or store",
    }),
  ];
}

function filledHint(value: number, empty: string, filled: string) {
  return value === 0 ? empty : filled;
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
  const hello = greeting();
  const today = dateLabel();
  const badge = roleLabels(user.roles);

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
          role="admin"
          badge={badge}
          line={deskLine("admin", user.roles, waiting)}
          dateLabel={today}
          action={heroAction(user.roles)}
          metrics={[
            {
              label: "In play",
              value: snapshot.open,
              href: "/quotes",
              tone: "violet",
              hint: filledHint(snapshot.open, "Floor is quiet", "Open jobs"),
            },
            {
              label: "Overdue",
              value: snapshot.overdue,
              href: "/fulfillment",
              tone: "rose",
              hint: filledHint(snapshot.overdue, "Vendors on time", "Past expected date"),
            },
            {
              label: "Done",
              value: snapshot.delivered,
              href: "/orders?bucket=closed",
              tone: "green",
              hint: filledHint(
                snapshot.delivered,
                "None delivered yet",
                "Delivered or closed",
              ),
            },
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
  const openCount = workWaiting(queues);

  return (
    <PageFrame>
      <HomeHero
        hello={hello}
        role={user.role}
        badge={badge}
        line={deskLine(user.role, user.roles, openCount)}
        dateLabel={today}
        action={heroAction(user.roles)}
        metrics={roleMetrics(user.role, queues)}
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
