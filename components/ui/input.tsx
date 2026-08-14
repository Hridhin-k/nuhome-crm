import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest px-3.5 py-2 text-base text-on-surface transition-colors outline-none placeholder:text-outline focus-visible:border-secondary focus-visible:ring-3 focus-visible:ring-secondary/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-container-low disabled:opacity-50 aria-invalid:border-destructive md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
