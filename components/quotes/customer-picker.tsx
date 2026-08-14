"use client";

import { useMemo, useState } from "react";
import { CustomerForm } from "@/components/customers/customer-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Customer = { id: string; name: string; phone?: string | null };

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function CustomerPicker({
  customers,
  value,
  onChange,
  returnTo,
}: {
  customers: Customer[];
  value: string;
  onChange: (id: string) => void;
  returnTo?: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone?.toLowerCase().includes(q) ?? false),
    );
  }, [customers, query]);

  const selected = customers.find((c) => c.id === value);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Label htmlFor="customer-search" className="text-label-caps uppercase">
          Select Customer
        </Label>
        <Input
          id="customer-search"
          value={selected && !query ? selected.name : query}
          onChange={(e) => {
            onChange("");
            setQuery(e.target.value);
          }}
          placeholder="Search customers..."
          className="mt-1 h-11 min-h-11"
        />
      </div>

      {selected && !query ? (
        <div className="flex items-center gap-3 rounded-lg border border-surface-variant bg-surface-container-low p-3">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary-container text-headline-md text-on-secondary-container">
            {initials(selected.name) || "C"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-subheading text-on-surface">
              {selected.name}
            </p>
            <p className="truncate text-body-sm text-on-surface-variant">
              {selected.phone ?? "No phone"}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-full px-2 py-1 text-body-sm text-primary"
            onClick={() => {
              onChange("");
              setQuery("");
            }}
          >
            Change
          </button>
        </div>
      ) : (
        <div className="max-h-[200px] overflow-y-auto rounded-lg border border-border">
          {filtered.length === 0 ? (
            <p className="px-4 py-4 text-sm text-on-surface-variant">
              No customers match. Create a new profile below.
            </p>
          ) : (
            <ul className="divide-y divide-surface-variant">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex min-h-11 w-full min-w-0 items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface-container",
                      value === c.id && "bg-surface-container-high",
                    )}
                    onClick={() => {
                      onChange(c.id);
                      setQuery("");
                    }}
                  >
                    <span className="min-w-0 truncate font-medium">{c.name}</span>
                    {c.phone ? (
                      <span className="shrink-0 text-[12px] text-on-surface-variant">
                        {c.phone}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <CustomerForm
        returnTo={returnTo}
        triggerClassName="w-full"
        trigger={
          <span className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-subheading text-on-surface">
            Create New Customer
          </span>
        }
      />
    </div>
  );
}
