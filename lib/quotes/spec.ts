export function splitItemNameAndSpec(description: string) {
  const idx = description.indexOf(" — ");
  if (idx === -1) {
    return { name: description.trim(), specification: "" };
  }
  return {
    name: description.slice(0, idx).trim(),
    specification: description.slice(idx + 3).trim(),
  };
}

export function displaySpecification(
  specification?: string | null,
  description?: string | null,
) {
  const direct = specification?.trim();
  if (direct) return direct;
  if (!description) return "";
  return splitItemNameAndSpec(description).specification;
}
