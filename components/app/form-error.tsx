import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function FormError({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-xl border border-error/20 bg-error-container/60 px-3 py-2.5 text-body-sm text-on-error-container",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-error" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
