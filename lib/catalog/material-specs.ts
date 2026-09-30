export type MaterialSpec = { label: string; value: string };

export const SUGGESTED_SPEC_LABELS = [
  "Colour",
  "Dimensions",
  "Size",
  "Finish",
  "Material",
  "Model",
] as const;

const MAX_SPECS = 12;
const MAX_LABEL = 40;
const MAX_VALUE = 120;

/** Trimmed label/value pairs. Rows missing either side are dropped. */
export function normalizeMaterialSpecs(rows: unknown): MaterialSpec[] {
  if (!Array.isArray(rows)) return [];
  const specs: MaterialSpec[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const label = String((row as { label?: unknown }).label ?? "").trim();
    const value = String((row as { value?: unknown }).value ?? "").trim();
    if (!label || !value) continue;
    if (label.length > MAX_LABEL) {
      throw new Error(`Spec name “${label.slice(0, 20)}…” is too long`);
    }
    if (value.length > MAX_VALUE) {
      throw new Error(`The value for ${label} is too long`);
    }
    specs.push({ label, value });
  }
  if (specs.length > MAX_SPECS) {
    throw new Error(`Add at most ${MAX_SPECS} specs`);
  }
  return specs;
}

/** CSV cell: `Colour: White|Dimensions: 600 mm`. */
export function parseSpecColumn(value: string): MaterialSpec[] {
  return value
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const splitAt = part.indexOf(":");
      const label = part.slice(0, splitAt).trim();
      const specValue = part.slice(splitAt + 1).trim();
      if (splitAt <= 0 || !label || !specValue) {
        throw new Error("Write each spec as Label: value, separated by |");
      }
      return { label, value: specValue };
    });
}

/** Specs as one line, e.g. "Colour: White · Dimensions: 600 × 560 mm". */
export function formatSpecsInline(specs: unknown) {
  return normalizeSpecsSafe(specs)
    .map((spec) => `${spec.label}: ${spec.value}`)
    .join(" · ");
}

/** Values only, for tight lists, e.g. "White · 600 × 560 mm". */
export function formatSpecValues(specs: unknown) {
  return normalizeSpecsSafe(specs)
    .map((spec) => spec.value)
    .join(" · ");
}

function normalizeSpecsSafe(specs: unknown) {
  try {
    return normalizeMaterialSpecs(specs);
  } catch {
    return [];
  }
}
