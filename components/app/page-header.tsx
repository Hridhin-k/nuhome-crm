import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div className="min-w-0">
        {/* Desktop top bar already shows Overview — hide duplicate on md+ when title is Overview */}
        <h1 className="text-[28px] leading-[34px] font-bold tracking-[-0.02em] text-primary md:text-display-lg">
          {title}
        </h1>
        {description ? (
          <p className="text-body-lg mt-2 text-on-surface-variant">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
