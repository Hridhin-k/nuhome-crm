"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatInrExact } from "@/lib/format/money";
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
};

export function MaterialPicker({
  materials,
  categories,
  addedMaterialIds,
  onAdd,
  onAddMany,
}: {
  materials: PickerMaterial[];
  categories: { id: string; name: string }[];
  addedMaterialIds: Set<string>;
  onAdd: (material: PickerMaterial) => void;
  onAddMany: (materials: PickerMaterial[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function addSelected() {
    const toAdd = filtered.filter((m) => selected.has(m.id));
    if (toAdd.length === 0) return;
    onAddMany(toAdd);
    setSelected(new Set());
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label htmlFor="material-search">Browse catalogue</Label>
        <Input
          id="material-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or SKU…"
          className="mt-2 h-11 min-h-11"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategoryId("all")}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            categoryId === "all"
              ? "bg-primary text-on-primary"
              : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
          )}
        >
          All ({materials.length})
        </button>
        {categories.map((cat) => {
          const count = materials.filter((m) => m.category_id === cat.id).length;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryId(cat.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                categoryId === cat.id
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high",
              )}
            >
              {cat.name} ({count})
            </button>
          );
        })}
      </div>

      {selected.size > 0 ? (
        <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <Button type="button" size="sm" onClick={addSelected}>
            Add selected
          </Button>
        </div>
      ) : null}

      <div className="max-h-[360px] overflow-y-auto rounded-xl border border-surface-variant">
        {filtered.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-on-surface-variant">
            No materials match your search.
          </p>
        ) : (
          <ul className="divide-y divide-surface-variant">
            {filtered.map((m) => {
              const isAdded = addedMaterialIds.has(m.id);
              const isSelected = selected.has(m.id);
              return (
                <li key={m.id}>
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(m.id)}
                      className="size-4 shrink-0 rounded border-outline accent-primary"
                      aria-label={`Select ${m.name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-on-surface">
                        {m.name}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {m.sku ? `${m.sku} · ` : ""}
                        {m.unit}
                        {m.category_name ? ` · ${m.category_name}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-on-surface">
                      {formatInrExact(Number(m.default_sell_price))}
                    </p>
                    <Button
                      type="button"
                      variant={isAdded ? "outline" : "default"}
                      size="sm"
                      className="h-9 min-w-[72px] shrink-0"
                      onClick={() => onAdd(m)}
                    >
                      {isAdded ? "+1" : "Add"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
