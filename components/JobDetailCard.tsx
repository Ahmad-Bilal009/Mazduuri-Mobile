import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import type { Job } from "@/types";
import { formatCurrency, DURATION_LABELS, timeAgo, jobCategoryId } from "@/lib/utils";
import { getCategory } from "@/lib/categories";
import { categoryIcon } from "@/lib/categoryIcons";
import { CategoryIcon } from "@/components/CategoryIcon";

interface Props {
  job: Job & { distance?: number };
  onPress?: () => void;
}

/** Visual twin of WorkerDetailCard so the Jobs and Workers tabs read as one app. */
export function JobDetailCard({ job, onPress }: Props) {
  const catId = jobCategoryId(job);
  const category = catId ? getCategory(catId) : undefined;
  const client = job.client?.clientProfile?.companyName || job.client?.clientProfile?.name || "Client";
  const applicants = job._count?.applications;
  const where = job.address ?? job.city;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.95}>
      {/* Header: icon, title + client, budget */}
      <View style={styles.header}>
        {job.image ? (
          <View style={styles.iconTile}>
            <Image source={{ uri: job.image }} style={styles.iconImage} />
          </View>
        ) : (
          <CategoryIcon id={catId} size={56} />
        )}

        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={2}>
            {job.title}
          </Text>
          <Text style={styles.client} numberOfLines={1}>
            {client} · {timeAgo(job.createdAt)}
          </Text>
        </View>

        <View style={styles.budgetBlock}>
          <Text style={styles.budget}>{formatCurrency(job.budget)}</Text>
          <Text style={styles.budgetLabel}>budget</Text>
        </View>
      </View>

      {/* Chips: category + place */}
      {(category || where) && (
        <View style={styles.chips}>
          {category && (
            <View style={styles.chip}>
              <MaterialCommunityIcons name={categoryIcon(category.id)} size={13} color="#16a34a" />
              <Text style={styles.chipText} numberOfLines={1}>
                {category.name.replace(/\s*\(.*?\)\s*/g, "")}
              </Text>
            </View>
          )}
          {where && (
            <View style={[styles.chip, styles.chipMuted]}>
              <MaterialCommunityIcons name="map-marker-outline" size={13} color="#475569" />
              <Text style={[styles.chipText, styles.chipTextMuted]} numberOfLines={1}>
                {job.distance !== undefined ? `${job.distance.toFixed(1)} km · ${where}` : where}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Stats */}
      <View style={styles.stats}>
        <Stat value={DURATION_LABELS[job.duration] ?? "—"} label="Duration" />
        <View style={styles.statDivider} />
        <Stat value={applicants !== undefined ? String(applicants) : "—"} label="Applicants" />
        <View style={styles.statDivider} />
        <Stat value={job.status === "open" ? "Open" : job.status.replace("_", " ")} label="Status" />
      </View>

      {/* CTA */}
      <TouchableOpacity style={styles.cta} onPress={onPress} activeOpacity={0.85}>
        <Text style={styles.ctaText}>View Job</Text>
        <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconTile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  iconImage: { width: 56, height: 56 },
  titleBlock: { flex: 1, paddingTop: 2 },
  title: { fontSize: 16.5, fontWeight: "700", color: "#0f172a", lineHeight: 21 },
  client: { fontSize: 13, color: "#64748b", marginTop: 3 },
  budgetBlock: { alignItems: "flex-end", paddingTop: 2, maxWidth: 110 },
  budget: { fontSize: 17, fontWeight: "800", color: "#22c55e" },
  budgetLabel: { fontSize: 12, color: "#64748b", marginTop: 2 },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "100%",
    backgroundColor: "#dcfce7",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  chipMuted: { backgroundColor: "#f1f5f9" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#16a34a", flexShrink: 1 },
  chipTextMuted: { color: "#475569" },

  stats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 16,
    paddingVertical: 12,
    marginTop: 12,
  },
  stat: { flex: 1, alignItems: "center", paddingHorizontal: 4 },
  statValue: { fontSize: 15, fontWeight: "800", color: "#0f172a", textTransform: "capitalize" },
  statLabel: { fontSize: 11, color: "#64748b", marginTop: 3 },
  statDivider: { width: 1, height: 28, backgroundColor: "#e2e8f0" },

  cta: {
    marginTop: 12,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#22c55e",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 2,
  },
  ctaText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
