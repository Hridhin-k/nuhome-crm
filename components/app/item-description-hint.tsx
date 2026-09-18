import { cn } from "@/lib/utils";

export function ItemDescriptionHint({
  description,
  label = "Item description",
  className,
}: {
  description: string;
  label?: string;
  className?: string;
}) {
  const text = description.trim();
  const body = text || "No description available for this item";

  return (
    <details
      className={cn("relative inline-flex shrink-0", className)}
    >
      <summary
        title={label}
        aria-label={label}
        className={cn(
          "flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full",
          "border-2 border-primary bg-primary text-[13px] font-bold leading-none text-on-primary",
          "shadow-sm transition-colors hover:bg-primary/90",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        i
      </summary>
      <div
        role="dialog"
        className={cn(
          "absolute right-0 top-[calc(100%+0.35rem)] z-50 w-[min(18rem,calc(100vw-2.5rem))]",
          "rounded-xl border border-outline-variant bg-card p-3 text-left shadow-card",
        )}
      >
        <p className="text-label-caps text-on-surface-variant">Description</p>
        <p
          className={cn(
            "mt-1 whitespace-pre-wrap text-sm leading-snug",
            text ? "text-on-surface" : "text-on-surface-variant",
          )}
        >
          {body}
        </p>
      </div>
    </details>
  );
}
