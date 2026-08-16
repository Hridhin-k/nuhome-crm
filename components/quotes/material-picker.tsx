"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatInr } from "@/lib/format/money";
import { cn } from "@/lib/utils";

export type PickerMaterial = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  default_sell_price: number | string;
  default_cost: number | string;
  category_id: string | null;
  category_name?: string | null;
  hsn_code?: string | null;
  gst_rate?: number | string | null;
};

export function MaterialPicker({
  materials,
  categories,
  addedMaterialIds,
  onAdd,
  onAddMany: _onAddMany,
}: {
  materials: PickerMaterial[];
  categories: { id: string; name: string }[];
  addedMaterialIds: Set<string>;
  onAdd: (material: PickerMaterial) => void;
  onAddMany: (materials: PickerMaterial[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return materials.filter((m) => {
      const matchesCategory =
        categoryId === "all" || m.category_id === categoryId;
      const matchesQuery =
        !q ||
        m.name.toLowerCase().includes(q) ||
        (m.sku?.toLowerCase().includes(q) ?? false) ||
        (m.category_name?.toLowerCase().includes(q) ?? false);
      return matchesCategory && matchesQuery;
    });
  }, [materials, categoryId, query]);

  return (
    <div className="flex flex-col gap-4">
      <Input
        id="material-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or SKU…"
        className="h-11 min-h-11"
        aria-label="Search catalogue"
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          type="button"
          onClick={() => setCategoryId("all")}
          className={cn(
            "shrink-0 rounded-full px-4 py-1.5 text-label-caps uppercase tracking-wider transition-transform active:scale-95",
            categoryId === "all"
              ? "bg-primary text-on-primary"
              : "border border-outline-variant bg-surface-container-lowest text-secondary hover:bg-surface-container-low",
          )}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategoryId(cat.id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-label-caps uppercase tracking-wider transition-transform active:scale-95",
              categoryId === cat.id
                ? "bg-primary text-on-primary"
                : "border border-outline-variant bg-surface-container-lowest text-secondary hover:bg-surface-container-low",
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="max-h-[360px] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-on-surface-variant">
            No materials match your search.
          </p>
        ) : (
          <ul>
            {filtered.map((m) => {
              const isAdded = addedMaterialIds.has(m.id);
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 border-b border-surface-variant py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-body-md font-semibold text-on-surface">
                      {m.name}
                    </p>
                    <p className="mt-0.5 truncate text-data-tabular text-secondary">
                      {[m.sku, formatInr(Number(m.default_sell_price))]
                        .filter(Boolean)
                        .join(" · ")}
                      {isAdded ? " · added" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Add ${m.name}`}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-primary transition-transform hover:bg-surface-variant active:scale-90"
                    onClick={() => onAdd(m)}
                  >
                    <Plus className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
