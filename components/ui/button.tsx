import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex items-center justify-center rounded-lg border border-transparent text-subheading whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 max-md:whitespace-normal [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-on-primary hover:bg-primary/90",
        outline:
          "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low",
        bordered:
          "border-primary bg-surface-container-lowest text-primary hover:bg-surface-container-low",
        secondary:
          "border-outline-variant bg-muted text-on-surface hover:bg-surface-container",
        ghost: "text-on-surface-variant hover:bg-muted hover:text-on-surface",
        destructive:
          "bg-error-container text-on-error-container hover:bg-error/15",
        link: "rounded-none text-secondary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 min-h-11 gap-1.5 px-4",
        xs: "h-8 gap-1 px-2.5 text-[12px]",
        sm: "h-9 gap-1.5 px-3 text-[12px]",
        lg: "h-11 min-h-11 gap-1.5 px-4",
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
