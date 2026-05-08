/**
 * Mazduuri Mobile — Design System Tokens
 * Use these in StyleSheet.create() to keep UI consistent.
 */

export const colors = {
  // Brand
  primary:      "#16a34a",
  primaryDark:  "#15803d",
  primaryLight: "#f0fdf4",

  // Accent
  accent:       "#f97316",
  accentLight:  "#fff7ed",

  // WhatsApp green
  whatsapp:     "#25D366",

  // Neutrals
  background:   "#f9fafb",
  surface:      "#ffffff",
  border:       "#f3f4f6",
  borderMd:     "#e5e7eb",

  // Text
  textPrimary:   "#111827",
  textSecondary: "#374151",
  textMuted:     "#6b7280",
  textHint:      "#9ca3af",

  // Semantic
  success:      "#22c55e",
  successLight: "#f0fdf4",
  error:        "#ef4444",
  errorLight:   "#fef2f2",
  warning:      "#f59e0b",
  warningLight: "#fffbeb",

  // Status badges
  workerBadgeBg:   "#f0fdf4",
  workerBadgeText: "#16a34a",
  clientBadgeBg:   "#faf5ff",
  clientBadgeText: "#9333ea",
  busyBadgeBg:     "#f3f4f6",
  busyBadgeText:   "#6b7280",

  // Avatar palette
  avatarColors: ["#16a34a", "#2563eb", "#9333ea", "#ea580c", "#0d9488", "#db2777"],
} as const;

export const spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  "2xl":24,
  "3xl":32,
} as const;

export const typography = {
  fontSizes: {
    xs:   10,
    sm:   12,
    base: 14,
    md:   15,
    lg:   16,
    xl:   18,
    "2xl":20,
    "3xl":24,
    "4xl":28,
  },
  fontWeights: {
    normal:   "400" as const,
    medium:   "500" as const,
    semibold: "600" as const,
    bold:     "700" as const,
  },
  lineHeights: {
    tight:  18,
    normal: 20,
    relaxed:22,
  },
} as const;

export const radii = {
  sm:   8,
  md:   12,
  lg:   14,
  xl:   16,
  "2xl":20,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius:  4,
    elevation:     2,
  },
  md: {
    shadowColor:   "#000",
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius:  8,
    elevation:     4,
  },
} as const;

// Convenience: get avatar color from name
export function getAvatarColor(name: string): string {
  return colors.avatarColors[name.charCodeAt(0) % colors.avatarColors.length];
}
