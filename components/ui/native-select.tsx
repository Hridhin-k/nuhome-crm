import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

function NativeSelect({
  className,
  wrapperClassName,
  ...props
}: React.ComponentProps<"select"> & { wrapperClassName?: string }) {
  return (
    <div className={cn("relative w-full min-w-0", wrapperClassName)}>
      <select
        data-slot="native-select"
        className={cn(
          "h-11 w-full min-w-0 appearance-none rounded-xl border border-outline-variant bg-surface-container-lowest pr-10 pl-3 text-base text-on-surface transition-colors outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:bg-surface-container-low disabled:opacity-50 aria-invalid:border-destructive md:text-sm",
          className,
        )}
        {...props}
      />
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-on-surface-variant"
        aria-hidden
      />
    </div>
  );
}

export { NativeSelect };
