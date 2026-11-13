/**
 * Icon + colour for each category id in data/categories.json.
 *
 * Filled glyphs read better than outlines at tile size, and giving each trade
 * its own hue makes the services grid scannable at a glance (the usual
 * pattern in service marketplaces). `bg` is the soft tile, `fg` the glyph.
 */
type CategoryVisual = { icon: string; fg: string; bg: string };

const AMBER = { fg: "#d97706", bg: "#fef3c7" };
const SKY = { fg: "#0284c7", bg: "#e0f2fe" };
const ROSE = { fg: "#e11d48", bg: "#ffe4e6" };
const ORANGE = { fg: "#ea580c", bg: "#ffedd5" };
const RED = { fg: "#dc2626", bg: "#fee2e2" };
const INDIGO = { fg: "#4f46e5", bg: "#e0e7ff" };
const BLUE = { fg: "#2563eb", bg: "#dbeafe" };
const TEAL = { fg: "#0d9488", bg: "#ccfbf1" };
const PINK = { fg: "#db2777", bg: "#fce7f3" };
const GREEN = { fg: "#16a34a", bg: "#dcfce7" };
const LIME = { fg: "#65a30d", bg: "#ecfccb" };
const CYAN = { fg: "#0891b2", bg: "#cffafe" };
const VIOLET = { fg: "#7c3aed", bg: "#ede9fe" };
const SLATE = { fg: "#475569", bg: "#e2e8f0" };
const FUCHSIA = { fg: "#c026d3", bg: "#fae8ff" };
const EMERALD = { fg: "#059669", bg: "#d1fae5" };
const BROWN = { fg: "#a16207", bg: "#fef9c3" };

export const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  construction_building: { icon: "crane", ...ORANGE },
  electrical: { icon: "lightning-bolt", ...AMBER },
  plumbing: { icon: "pipe-wrench", ...SKY },
  painting_finishing: { icon: "format-paint", ...ROSE },
  carpentry_wood: { icon: "hand-saw", ...BROWN },
  metal_welding: { icon: "anvil", ...RED },
  drivers: { icon: "steering", ...INDIGO },
  transport_logistics: { icon: "truck-fast", ...BLUE },
  cleaning: { icon: "spray-bottle", ...TEAL },
  cooking: { icon: "chef-hat", ...ORANGE },
  domestic_workers: { icon: "home-heart", ...PINK },
  agriculture: { icon: "tractor", ...GREEN },
  gardening_landscaping: { icon: "flower-tulip", ...LIME },
  hvac_cooling: { icon: "snowflake", ...CYAN },
  electronics_repair: { icon: "chip", ...VIOLET },
  vehicle_services: { icon: "car-wrench", ...SLATE },
  security: { icon: "shield-account", ...INDIGO },
  events: { icon: "party-popper", ...FUCHSIA },
  office_business_support: { icon: "briefcase", ...SLATE },
  delivery_services: { icon: "moped", ...ORANGE },
  tailoring: { icon: "content-cut", ...VIOLET },
  religious_community: { icon: "mosque", ...EMERALD },
  education: { icon: "school", ...BLUE },
  animal_pet_care: { icon: "paw", ...AMBER },
  digital_freelance: { icon: "laptop", ...VIOLET },
  installation_services: { icon: "toolbox", ...SKY },
  factory_industrial: { icon: "factory", ...SLATE },
  retail: { icon: "storefront", ...ROSE },
  emergency_services: { icon: "ambulance", ...RED },
  general_labour: { icon: "account-hard-hat", ...GREEN },
};

const FALLBACK: CategoryVisual = { icon: "briefcase", ...GREEN };

export function categoryVisual(id?: string): CategoryVisual {
  return (id && CATEGORY_VISUALS[id]) || FALLBACK;
}

export function categoryIcon(id?: string): string {
  return categoryVisual(id).icon;
}
