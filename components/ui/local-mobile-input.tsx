"use client";

import { Input } from "@/components/ui/input";
import { sanitizeLocalMobileInput } from "@/lib/customers/phone";
import { cn } from "@/lib/utils";

export function LocalMobileInput({
  id,
  name,
  value,
  onChange,
  className,
  required,
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (next: string) => void;
  className?: string;
  required?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center rounded-xl border border-outline-variant bg-surface-container-lowest focus-within:border-primary focus-within:ring-1 focus-within:ring-primary",
        className,
      )}
    >
      <span className="shrink-0 pl-3 text-base text-on-surface-variant select-none md:text-sm">
        +91
      </span>
      <Input
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        required={required}
        maxLength={10}
        pattern="[0-9]{10}"
        title="10-digit mobile number, without country code"
        placeholder="9876543210"
        value={value}
        onKeyDown={(event) => {
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          if (event.key.length === 1 && !/[0-9]/.test(event.key)) {
            event.preventDefault();
          }
        }}
        onChange={(event) => onChange(sanitizeLocalMobileInput(event.target.value))}
        className="h-full min-h-0 flex-1 rounded-xl border-0 bg-transparent px-2 shadow-none focus-visible:border-transparent focus-visible:ring-0"
      />
    </div>
  );
}
