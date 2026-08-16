import type { ReactNode } from "react";
import { ChevronRight, Info } from "lucide-react";
import { AppLink } from "@/components/app/app-link";
import { listRowClass } from "@/components/app/page-frame";
import { StatusBadge } from "@/components/app/status-badge";
import { cn } from "@/lib/utils";
import type { WorkflowStatus } from "@/lib/workflow/types";

export function JobRow({
  href,
  title,
  subtitle,
  amount,
  meta,
  hint,
  footer,
  status,
  trailing,
  alert,
  stacked,
}: {
  href: string;
  title: string;
  subtitle?: string;
  amount?: string;
  meta?: ReactNode;
  hint?: string;
  footer?: ReactNode;
  status?: WorkflowStatus;
  trailing?: ReactNode;
  alert?: boolean;
  stacked?: boolean;
}) {
  const hintText = hint ?? (typeof meta === "string" ? meta : undefined);
  const extraMeta = typeof meta === "string" ? null : meta;
  const person = Boolean(footer) || stacked;

  return (
    <li className="min-w-0">
      <AppLink
        href={href}
        className={cn(listRowClass, alert && "border-error")}
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {person ? (
              <>
                <p className="truncate text-subheading text-on-surface">
                  {title}
                </p>
                {subtitle ? (
                  <p className="mt-0.5 truncate text-body-sm text-on-surface-variant">
                    {subtitle}
                  </p>
                ) : null}
              </>
            ) : (
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="truncate text-data-tabular text-on-surface">
                  {title}
                </p>
                {subtitle ? (
                  <>
                    <span className="text-outline-variant">•</span>
                    <p className="truncate text-subheading text-on-surface">
                      {subtitle}
                    </p>
                  </>
                ) : null}
              </div>
            )}
            {!person && (status || trailing) ? (
              <div className="mt-2">
                {trailing ?? (status ? <StatusBadge status={status} /> : null)}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-start gap-2">
            {person ? (
              <>
                {trailing ?? (status ? <StatusBadge status={status} /> : null)}
                {!footer ? (
                  <ChevronRight
                    className="mt-0.5 size-4 text-on-surface-variant"
                    aria-hidden
                  />
                ) : null}
              </>
            ) : amount ? (
              <p className="text-data-tabular text-on-surface">{amount}</p>
            ) : (
              <ChevronRight
                className="mt-0.5 size-4 text-on-surface-variant"
                aria-hidden
              />
            )}
          </div>
        </div>
        {hintText ? (
          <div className="mt-3 rounded-xl bg-surface-container-low p-3">
            <p className="flex items-start gap-2 text-body-sm text-on-surface-variant">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{hintText}</span>
            </p>
          </div>
        ) : extraMeta ? (
          <p className="mt-2 line-clamp-2 text-body-sm text-on-surface-variant">
            {extraMeta}
          </p>
        ) : null}
        {footer ? (
          <div className="mt-3 flex items-center justify-between border-t border-outline-variant/40 pt-2">
            <span className="text-data-tabular text-on-surface-variant">
              {footer}
            </span>
            <ChevronRight
              className="size-4 text-on-surface-variant"
              aria-hidden
            />
          </div>
        ) : null}
      </AppLink>
    </li>
  );
}
