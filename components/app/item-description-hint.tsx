"use client";

import { useState, useRef, useEffect } from "react";
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
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const updateCoords = () => {
    if (detailsRef.current) {
      const rect = detailsRef.current.getBoundingClientRect();
      const rightMargin = Math.max(12, window.innerWidth - rect.right - 80);
      setCoords({
        top: rect.bottom + 6,
        right: rightMargin,
      });
    }
  };

  const handleToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (e.currentTarget.open) {
      updateCoords();
    }
  };

  useEffect(() => {
    if (!coords) return;
    const handleScrollOrResize = () => {
      if (detailsRef.current?.open) {
        updateCoords();
      }
    };
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [coords]);

  return (
    <details
      ref={detailsRef}
      onToggle={handleToggle}
      className={cn("relative inline-flex shrink-0", className)}
    >
      <summary
        title={label}
        aria-label={label}
        className={cn(
          "flex h-4 w-4 cursor-pointer list-none items-center justify-center rounded-full",
          "border-2 border-primary bg-primary text-[10px] pt-[10%] font-bold leading-none text-on-primary",
          "shadow-sm transition-colors hover:bg-primary/90",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        i
      </summary>

      {/* Transparent overlay to close details on outside touch/click */}
      <div
        className="fixed inset-0 z-[9998] bg-transparent"
        onClick={() => {
          if (detailsRef.current) detailsRef.current.open = false;
        }}
      />

      <div
        role="dialog"
        style={
          coords
            ? {
                position: "fixed",
                top: `${coords.top}px`,
                right: `${coords.right}px`,
              }
            : undefined
        }
        className={cn(
          "z-[9999] w-64 max-w-[calc(100vw-2rem)] max-h-60 overflow-y-auto",
          "rounded-xl border border-outline-variant bg-card p-3 text-left shadow-xl",
          !coords && "absolute right-[-4rem] top-[calc(100%+0.35rem)]"
        )}
      >
        <p className="text-label-caps font-semibold text-on-surface-variant">Description</p>
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
