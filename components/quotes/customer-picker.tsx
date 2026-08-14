"use client";

import { useMemo, useState } from "react";
import { createCustomerAction, type ActionState } from "@/app/actions/workflow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useActionState } from "react";

type Customer = { id: string; name: string; phone?: string | null };

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
  const [showNew, setShowNew] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createCustomerAction,
    {},
  );

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
        <Label htmlFor="customer-search">Customer</Label>
        <Input
          id="customer-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or phone…"
          className="mt-2 h-11 min-h-11"
        />
      </div>

      {selected && !query ? (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <div>
            <p className="font-medium text-on-surface">{selected.name}</p>
            {selected.phone ? (
              <p className="text-sm text-on-surface-variant">{selected.phone}</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange("")}
          >
            Change
          </Button>
        </div>
      ) : (
        <div className="max-h-[200px] overflow-y-auto rounded-xl border border-surface-variant">
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
                      "flex min-h-12 w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors hover:bg-surface-container",
                      value === c.id && "bg-surface-container-high",
                    )}
                    onClick={() => {
                      onChange(c.id);
                      setQuery("");
                    }}
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.phone ? (
                      <span className="text-on-surface-variant">{c.phone}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!showNew ? (
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => setShowNew(true)}
        >
          + New customer
        </Button>
      ) : (
        <form action={action} className="rounded-xl border border-surface-variant p-4">
          {returnTo ? (
            <input type="hidden" name="returnTo" value={returnTo} />
          ) : null}
          <p className="mb-3 text-sm font-semibold text-on-surface">New customer</p>
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="new-name">Name</Label>
              <Input id="new-name" name="name" required className="mt-1 h-11" />
            </div>
            <div>
              <Label htmlFor="new-phone">Phone</Label>
              <Input id="new-phone" name="phone" type="tel" className="mt-1 h-11" />
            </div>
            {state.error ? (
              <p className="text-sm text-destructive" role="alert">
                {state.error}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={pending} className="flex-1">
                {pending ? "Saving…" : "Save & select"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNew(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
