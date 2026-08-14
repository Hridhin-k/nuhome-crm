import { Lock } from "lucide-react";
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
    <section className="flex flex-col gap-3">
      <div className="flex items-start gap-3 rounded-lg border border-error/20 bg-error-container p-4 text-on-error-container">
        <Lock className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div>
          <p className="text-subheading">Delivery locked until balance verified</p>
          <p className="mt-1 text-body-sm opacity-90">
            Full payment is required before handover.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-outline-variant border-l-4 border-l-error bg-card p-4">
        <span className="text-subheading text-on-surface">
          Outstanding before delivery
        </span>
        <span className="text-headline-md text-error tabular-nums">
          {formatInr(outstanding)}
        </span>
      </div>
      {canRecord ? (
        <AppLink
          href={`/orders/${orderId}#payment`}
          className={cn(buttonVariants({ size: "lg" }), "inline-flex")}
        >
          Record payment
        </AppLink>
      ) : null}
    </section>
  );
}
