export const PROFESSIONS = [
  "Interior Designer",
  "Interior Contractor",
  "OEM Factory",
  "Architect",
  "Carpenter",
  "House Owner",
  "Others",
] as const;

export const PROPERTY_TYPES = [
  "Apartment",
  "Villa",
  "Commercial",
  "Residential",
  "Other",
] as const;

export const PROJECT_STATUSES = [
  "New Construction",
  "Renovation",
  "Under Planning",
] as const;

export const INTERESTS = [
  "Kitchen Hardware",
  "Ambient Lights",
  "Wall Papers",
  "Laminates",
  "Wall Frames",
  "Charcoal Panels",
  "Décor Items",
  "Louvers",
  "Fluted Panels",
  "Canes",
  "Smart Digital Lock",
  "Handles",
  "Edge Band",
  "S S Profile",
  "Mouldings",
  "Adhesives",
  "Artificial Plants",
] as const;

export const HEAR_SOURCES = [
  "Walk-in",
  "Social Media",
  "Friend / Reference",
  "Advertisement",
  "Others",
] as const;

export const FOLLOW_UP_ACTIONS = [
  "Call",
  "Site Visit",
  "Quotation",
  "Meeting",
] as const;

export function listFromForm(values: FormDataEntryValue[]) {
  return values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}
