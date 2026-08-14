"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function FormSheet({
  title,
  description,
  trigger,
  defaultOpen = false,
  size = "md",
  triggerClassName,
  children,
}: {
  title: string;
  description?: string;
  trigger: ReactNode;
  defaultOpen?: boolean;
  size?: "md" | "lg";
  triggerClassName?: string;
  children: ReactNode;
}) {
  return (
    <Sheet defaultOpen={defaultOpen}>
      <SheetTrigger
        className={cn(
          "inline-flex items-center justify-center",
          triggerClassName ?? "w-full",
        )}
      >
        {trigger}
      </SheetTrigger>
      <SheetContent placement="form" size={size}>
        <SheetHeader className="shrink-0 px-5 pt-1 pb-3">
          <SheetTitle className="text-[20px] font-semibold tracking-tight">
            {title}
          </SheetTitle>
          {description ? (
            <SheetDescription className="text-[14px] leading-relaxed">
              {description}
            </SheetDescription>
          ) : null}
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}

export function FormSheetBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-1",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FormSheetFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "shrink-0 border-t border-surface-variant bg-surface-container-lowest px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      {children}
    </div>
  );
}
