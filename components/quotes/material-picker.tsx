"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ItemDescriptionHint } from "@/components/app/item-description-hint";
import { Input } from "@/components/ui/input";
import {
  formatSpecsInline,
  formatSpecValues,
  type MaterialSpec,
} from "@/lib/catalog/material-specs";
import { formatInr } from "@/lib/format/money";
import { chipVariants } from "@/components/ui/chip";

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
  description?: string | null;
  specs?: MaterialSpec[];
  office_available?: number | null;
};

function formatQty(value: number) {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
}

function officeLabel(material: PickerMaterial) {
  const ready = Number(material.office_available ?? 0);
  if (!(ready > 0)) return " · order";
  return ` · ${formatQty(ready)} in office`;
}

export function MaterialPicker({
  materials,
  categories,
  addedMaterialIds,
  onAdd,
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
        (m.category_name?.toLowerCase().includes(q) ?? false) ||
        (m.description?.toLowerCase().includes(q) ?? false) ||
        formatSpecsInline(m.specs).toLowerCase().includes(q);
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

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setCategoryId("all")}
          aria-pressed={categoryId === "all"}
          className={chipVariants({ selected: categoryId === "all" })}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategoryId(cat.id)}
            aria-pressed={categoryId === cat.id}
            className={chipVariants({ selected: categoryId === cat.id })}
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
              const specLine = formatSpecValues(m.specs);
              return (
                <li
                  key={m.id}
                  className="flex items-start justify-between gap-3 border-b border-surface-variant py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start gap-2">
                      <p className="min-w-0 flex-1 truncate text-body-md font-semibold text-on-surface">
                        {m.name}
                      </p>
                      <ItemDescriptionHint
                        description={[formatSpecsInline(m.specs), m.description?.trim()]
                          .filter(Boolean)
                          .join("\n")}
                      />
                    </div>
                    {specLine ? (
                      <p className="mt-0.5 truncate text-body-sm text-on-surface">
                        {specLine}
                      </p>
                    ) : null}
                    <p className="mt-0.5 truncate text-data-tabular text-on-surface-variant">
                      {[m.sku, formatInr(Number(m.default_sell_price))]
                        .filter(Boolean)
                        .join(" · ")}
                      {officeLabel(m)}
                      {isAdded ? " · added" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Add ${m.name}`}
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-primary transition-transform outline-none hover:bg-surface-variant focus-visible:ring-2 focus-visible:ring-primary/30 active:scale-90"
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
