import type { Skill, JobDuration } from "@/types";

// ─── Phone ────────────────────────────────────────────────────────────────────

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("92") && digits.length === 12) {
    return `+92 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return `0${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11) return `+92${digits.slice(1)}`;
  if (digits.startsWith("92") && digits.length === 12) return `+${digits}`;
  return `+${digits}`;
}

// ─── Currency ─────────────────────────────────────────────────────────────────

export function formatCurrency(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-PK")}`;
}

// ─── Skills ───────────────────────────────────────────────────────────────────

export const SKILL_LABELS: Record<Skill, string> = {
  construction: "Construction",
  plumbing: "Plumbing",
  electrical: "Electrical",
  painting: "Painting",
  carpentry: "Carpentry",
  welding: "Welding",
  driving: "Driving",
  cleaning: "Cleaning",
  cooking: "Cooking",
  agriculture: "Agriculture",
  security: "Security Guard",
  other: "Other",
};

export const SKILL_ICONS: Record<Skill, string> = {
  construction: "hammer-wrench",
  plumbing: "pipe-wrench",
  electrical: "lightning-bolt",
  painting: "palette",
  carpentry: "hammer",
  welding: "fire",
  driving: "car",
  cleaning: "broom",
  cooking: "chef-hat",
  agriculture: "sprout",
  security: "shield",
  other: "dots-horizontal",
};

export const ALL_SKILLS: Skill[] = [
  "construction", "plumbing", "electrical", "painting",
  "carpentry", "welding", "driving", "cleaning",
  "cooking", "agriculture", "security", "other",
];

// ─── Duration ─────────────────────────────────────────────────────────────────

export const DURATION_LABELS: Record<JobDuration, string> = {
  one_day: "1 Day",
  few_days: "Few Days",
  one_week: "1 Week",
  one_month: "1 Month",
  ongoing: "Ongoing",
};

// ─── Date ─────────────────────────────────────────────────────────────────────

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toLocaleDateString("en-PK", { day: "numeric", month: "short" });
}

// ─── Distance ─────────────────────────────────────────────────────────────────

export function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Categories to Skills Mapping ──────────────────────────────────────────────

export function mapCategoriesToSkills(categoryIds?: string[] | null): Skill[] {
  if (!categoryIds || categoryIds.length === 0) return [];
  const skillsSet = new Set<Skill>();
  for (const catId of categoryIds) {
    switch (catId) {
      case "construction_building":
      case "factory_industrial":
      case "general_labour":
        skillsSet.add("construction");
        break;
      case "electrical":
      case "hvac_cooling":
      case "electronics_repair":
      case "installation_services":
        skillsSet.add("electrical");
        break;
      case "plumbing":
      case "emergency_services":
        skillsSet.add("plumbing");
        break;
      case "painting_finishing":
        skillsSet.add("painting");
        break;
      case "carpentry_wood":
        skillsSet.add("carpentry");
        break;
      case "metal_welding":
        skillsSet.add("welding");
        break;
      case "drivers":
      case "delivery_services":
        skillsSet.add("driving");
        break;
      case "cleaning":
      case "domestic_workers":
      case "transport_logistics":
        skillsSet.add("cleaning");
        break;
      case "cooking":
        skillsSet.add("cooking");
        break;
      case "agriculture":
      case "animal_pet_care":
        skillsSet.add("agriculture");
        break;
      case "security":
        skillsSet.add("security");
        break;
      default:
        skillsSet.add("other");
        break;
    }
  }
  return Array.from(skillsSet);
}
