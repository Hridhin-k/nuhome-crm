import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariantClasses = cva(
  "group/button inline-flex items-center justify-center rounded-xl border border-transparent text-center text-subheading whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 max-md:whitespace-normal [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-on-primary hover:bg-primary/90",
        outline:
          "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low",
        bordered:
          "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low",
        secondary:
          "border-outline-variant bg-muted text-on-surface hover:bg-surface-container",
        ghost: "text-on-surface-variant hover:bg-muted hover:text-on-surface",
        destructive:
          "border-error/50 bg-surface-container-lowest text-error hover:bg-error-container/60 focus-visible:ring-error/30",
        link: "rounded-none text-secondary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 min-h-11 gap-1.5 px-4 py-2.5",
        xs: "h-8 gap-1 px-2.5",
        sm: "h-9 gap-1.5 px-3",
        lg: "h-11 min-h-11 gap-1.5 px-4 py-2.5",
        icon: "size-11",
        "icon-xs": "size-8",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/** Merged so variant colours win over the base border and text classes. */
function buttonVariants(
  props?: Parameters<typeof buttonVariantClasses>[0],
): string {
  return cn(buttonVariantClasses(props));
}

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariantClasses>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
