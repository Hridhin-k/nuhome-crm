import { AppLink } from "@/components/app/app-link";
import { buttonVariants } from "@/components/ui/button";
import { formatInr } from "@/lib/format/money";
import { cn } from "@/lib/utils";

export function HoldCard({
  outstanding,
  orderId,
  canRecord,
}: {
  outstanding: number;
  orderId: string;
  canRecord: boolean;
}) {
  return (
    <section className="rounded-xl border border-warning/40 border-l-4 border-l-warning bg-warning-container px-5 py-5">
      <p className="text-label-md font-bold tracking-[0.05em] text-warning uppercase">
        Order on hold
      </p>
      <p className="mt-2 text-body-lg font-bold text-on-surface">
        Delivery locked — {formatInr(outstanding)} outstanding
      </p>
      <p className="text-body-md mt-1 text-on-surface-variant">
        Full payment is required before delivery can be scheduled.
      </p>
      {canRecord ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <AppLink
            href={`/orders/${orderId}#payment`}
            className={cn(buttonVariants({ size: "lg" }), "inline-flex flex-1")}
          >
            Record payment
          </AppLink>
          <AppLink
            href={`/orders/${orderId}`}
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "inline-flex flex-1",
            )}
          >
            Contact Customer
          </AppLink>
        </div>
      ) : null}
    </section>
  );
}
