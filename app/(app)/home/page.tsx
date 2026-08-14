import { OperationsPipeline } from "@/components/app/operations-pipeline";
import { QueueCard } from "@/components/app/queue-card";
import { getHomeQueues, getOperationsSnapshot } from "@/lib/api/dashboard";
import { requireUser } from "@/lib/auth/guards";
import { roleLabel } from "@/lib/auth/nav";
import { AppLink } from "@/components/app/app-link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { roleHasPermission } from "@/lib/auth/permissions";

export default async function HomePage() {
  const user = await requireUser();
  const firstName = user.fullName.split(" ")[0] || user.fullName;

  if (user.role === "admin") {
    const snapshot = await getOperationsSnapshot();
    return (
      <div className="space-y-6">
        {/* Mobile greeting */}
        <section className="md:hidden">
          <h1 className="text-[28px] leading-[34px] font-bold text-primary">
            Good morning, {firstName}.
          </h1>
          <p className="text-body-lg mt-2 text-on-surface-variant">
            Here is what requires your attention today.
          </p>
        </section>

        {/* Desktop title — Stitch top content */}
        <div className="mb-2 hidden items-center justify-between md:flex">
          <h1 className="text-headline-md text-on-surface">Overview</h1>
        </div>

        {/* Metric bento — exact Stitch 3-up */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {snapshot.queues.slice(0, 3).map((card) => (
            <QueueCard key={card.title} {...card} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-6 xl:col-span-8">
            <OperationsPipeline
              stages={snapshot.stages}
              open={snapshot.open}
              customers={snapshot.customers}
              delivered={snapshot.delivered}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {snapshot.queues.slice(3).map((card) => (
                <QueueCard key={`more-${card.title}`} {...card} />
              ))}
            </div>
          </div>

          <aside className="xl:col-span-4">
            <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-xl border border-surface-variant bg-surface-container-lowest shadow-card">
              <div className="border-b border-surface-variant bg-surface p-4">
                <h3 className="text-headline-sm text-on-surface">
                  Activity Stream
                </h3>
              </div>
              <div className="relative ml-2 flex-1 space-y-6 border-l-2 border-surface-variant p-4 pl-6">
                <div className="relative">
                  <span className="absolute -left-[31px] top-1 size-4 rounded-full bg-primary ring-4 ring-surface-container-lowest" />
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <h4 className="text-label-md text-on-surface">
                      Pipeline snapshot
                    </h4>
                    <span className="text-xs text-outline">Now</span>
                  </div>
                  <p className="text-body-md text-on-surface-variant">
                    {snapshot.open} open items across quotes, payments, and
                    fulfillment.
                  </p>
                </div>
                <div className="relative">
                  <span className="absolute -left-[31px] top-1 size-4 rounded-full bg-surface-variant ring-4 ring-surface-container-lowest" />
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <h4 className="text-label-md text-on-surface">Customers</h4>
                  </div>
                  <p className="text-body-md text-on-surface-variant">
                    {snapshot.customers} customer profiles in the system.
                  </p>
                </div>
                <div className="relative">
                  <span className="absolute -left-[31px] top-1 size-4 rounded-full bg-surface-variant ring-4 ring-surface-container-lowest" />
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <h4 className="text-label-md text-on-surface">Delivered</h4>
                  </div>
                  <p className="text-body-md text-on-surface-variant">
                    {snapshot.delivered} orders delivered or closed.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  const queues = await getHomeQueues(user.role);
  const canQuote = roleHasPermission(user.role, "quotes.create");

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-[28px] leading-[34px] font-bold text-primary md:text-display-lg">
          Good morning, {firstName}.
        </h1>
        <p className="text-body-lg mt-2 text-on-surface-variant">
          Here is what requires your attention today —{" "}
          {roleLabel(user.role).toLowerCase()}.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {queues.map((card) => (
          <QueueCard key={card.title} {...card} />
        ))}
      </section>

      {canQuote ? (
        <section className="space-y-4">
          <h2 className="text-headline-sm text-primary">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <AppLink
              href="/walk-in"
              className={cn(
                buttonVariants({ size: "lg" }),
                "flex h-auto min-h-[72px] flex-col items-start gap-1 px-6 py-4 text-left",
              )}
            >
              <span className="text-base font-semibold">Customer walk-in</span>
              <span className="text-sm font-normal opacity-80">
                Profile → Materials → Submit to Accounts
              </span>
            </AppLink>
            <AppLink
              href="/customers"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "flex h-auto min-h-[72px] flex-col items-start gap-1 px-6 py-4 text-left",
              )}
            >
              <span className="text-base font-semibold">Find customer</span>
              <span className="text-sm font-normal opacity-80">
                Search existing profiles
              </span>
            </AppLink>
          </div>
        </section>
      ) : null}
    </div>
  );
}
