import { ActivityTimeline } from "@/components/app/activity-timeline";
import { FloorBoard } from "@/components/app/floor-board";
import { InboxList } from "@/components/app/inbox-list";
import { PageFrame } from "@/components/app/page-frame";
import { AppLink } from "@/components/app/app-link";
import { getHomeQueuesForRoles, getOperationsSnapshot } from "@/lib/api/dashboard";
import { getCatalogSnapshot } from "@/lib/api/catalog";
import { listRecentAudit } from "@/lib/api/reports";
import { requireUser } from "@/lib/auth/guards";
import { roleLabels } from "@/lib/auth/nav";
import { rolesHavePermission } from "@/lib/auth/permissions";

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

function HomeHero({
  hello,
  firstName,
  subtitle,
  inverted,
}: {
  hello: string;
  firstName: string;
  subtitle: string;
  inverted?: boolean;
}) {
  if (inverted) {
    return (
      <section className="-mx-4 mb-6 bg-primary px-4 py-6 text-on-primary md:mx-0 md:rounded-xl">
        <p className="text-label-caps text-on-primary/70">{hello}</p>
        <h1 className="mt-1 truncate text-headline-lg">{firstName}</h1>
        <p className="mt-1 text-body-sm text-on-primary/80">{subtitle}</p>
      </section>
    );
  }

  return (
    <section className="mb-6 min-w-0">
      <h1 className="truncate text-headline-lg text-on-surface">
        {hello}, {firstName}
      </h1>
      <p className="mt-2 text-subheading text-on-surface-variant">{subtitle}</p>
    </section>
  );
}

function withCtas(
  items: { title: string; count: number; href: string; detail: string }[],
) {
  return items.map((item) => {
    const title = item.title.toLowerCase();
    let cta: string | undefined;
    if (title.includes("approval")) cta = "Review Quotes";
    else if (title.includes("verification") || title.includes("payment"))
      cta = "Verify Payments";
    else if (title.includes("attention") || title.includes("order"))
      cta = "View Orders";
    return {
      ...item,
      cta,
      alert: title.includes("overdue"),
    };
  });
}

export default async function HomePage() {
  const user = await requireUser();
  const firstName = user.fullName.split(" ")[0] || user.fullName;
  const hello = greeting();

  if (user.roles.includes("admin")) {
    const [snapshot, catalog, recent] = await Promise.all([
      getOperationsSnapshot(),
      getCatalogSnapshot(),
      listRecentAudit(12),
    ]);
    return (
      <PageFrame>
        <HomeHero
          hello={hello}
          firstName={firstName}
          subtitle="Live floor — every job, every status"
        />
        <div className="space-y-5">
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
          <section className="rounded-lg border border-outline-variant bg-card p-4 shadow-card">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-subheading text-on-surface">Catalog</h2>
              <AppLink href="/users" className="text-body-sm text-primary">
                Manage
              </AppLink>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Users", count: catalog.users, href: "/users" },
                { label: "Vendors", count: catalog.vendors, href: "/vendors" },
                {
                  label: "Materials",
                  count: catalog.materials,
                  href: "/materials",
                },
              ].map((item) => (
                <AppLink
                  key={item.label}
                  href={item.href}
                  className="flex flex-col items-center rounded bg-surface-container-low p-3"
                >
                  <span className="text-headline-sm text-primary">
                    {item.count}
                  </span>
                  <span className="mt-1 text-center text-label-caps text-secondary">
                    {item.label}
                  </span>
                </AppLink>
              ))}
            </div>
          </section>
          <ActivityTimeline
            events={recent}
            emptyMessage="No floor activity yet."
          />
          <AppLink
            href="/reports?view=floor"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-subheading text-on-primary"
          >
            Reports and exports
          </AppLink>
        </div>
      </PageFrame>
    );
  }

  const queues = await getHomeQueuesForRoles(user.roles);
  const canQuote = rolesHavePermission(user.roles, "quotes.create");
  const openCount = queues.reduce((sum, card) => sum + card.count, 0);
  const inverted =
    user.roles.includes("sales") ||
    user.roles.includes("procurement") ||
    user.roles.includes("store");

  return (
    <PageFrame>
      <HomeHero
        hello={hello}
        firstName={firstName}
        subtitle={
          openCount > 0
            ? `${roleLabels(user.roles)} · ${openCount} waiting`
            : `${roleLabels(user.roles)} · you’re clear`
        }
        inverted={inverted}
      />
      {canQuote ? (
        <AppLink
          href="/walk-in"
          className="mb-4 hidden h-11 items-center justify-center rounded-lg bg-primary text-subheading text-on-primary md:flex"
        >
          Customer walk-in
        </AppLink>
      ) : null}
      <InboxList
        items={
          user.roles.includes("accounts")
            ? withCtas(queues)
            : queues.map((q) => ({
                ...q,
                alert: q.title.toLowerCase().includes("overdue"),
              }))
        }
      />
    </PageFrame>
  );
}
