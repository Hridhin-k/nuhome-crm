import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent text-[12px] font-semibold tracking-[0.05em] uppercase whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-secondary/30 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-on-primary hover:bg-inverse-surface",
        outline:
          "border-outline bg-surface-container-lowest text-primary hover:bg-surface-container-low",
        secondary:
          "border-outline-variant bg-surface-container-low text-on-surface hover:bg-surface-container",
        ghost: "text-on-surface hover:bg-surface-container-high normal-case tracking-normal",
        destructive:
          "bg-error-container text-on-error-container hover:bg-error/15",
        link: "rounded-none text-secondary underline-offset-4 hover:underline normal-case tracking-normal",
      },
      size: {
        default: "h-12 min-h-12 gap-2 px-5",
        xs: "h-8 gap-1 px-3 text-[10px]",
        sm: "h-10 gap-1.5 px-4 text-[11px]",
        lg: "h-12 min-h-12 gap-2 px-6",
        icon: "size-12",
        "icon-xs": "size-8",
        "icon-sm": "size-10",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
