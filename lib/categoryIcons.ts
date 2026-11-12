/** Outline icons for each category id in data/categories.json. */
export const CATEGORY_ICONS: Record<string, string> = {
  construction_building: "wall",
  electrical: "lightning-bolt-outline",
  plumbing: "pipe-wrench",
  painting_finishing: "format-paint",
  carpentry_wood: "hammer",
  metal_welding: "fire",
  drivers: "car-outline",
  transport_logistics: "truck-outline",
  cleaning: "broom",
  cooking: "chef-hat",
  domestic_workers: "home-outline",
  agriculture: "sprout-outline",
  gardening_landscaping: "flower-outline",
  hvac_cooling: "air-conditioner",
  electronics_repair: "television",
  vehicle_services: "car-wrench",
  security: "shield-outline",
  events: "party-popper",
  office_business_support: "briefcase-outline",
  delivery_services: "package-variant-closed",
  tailoring: "needle",
  religious_community: "mosque",
  education: "school-outline",
  animal_pet_care: "paw",
  digital_freelance: "laptop",
  installation_services: "tools",
  factory_industrial: "factory",
  retail: "storefront-outline",
  emergency_services: "ambulance",
  general_labour: "account-hard-hat",
};

export function categoryIcon(id: string): string {
  return CATEGORY_ICONS[id] ?? "account-hard-hat";
}
