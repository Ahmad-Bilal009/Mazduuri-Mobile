import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import type { Job } from "@/types";
import { formatCurrency, DURATION_LABELS, timeAgo } from "@/lib/utils";
import { getCategory } from "@/lib/categories";

interface Props {
  job: Job;
  onPress?: () => void;
}

export function JobDetailCard({ job, onPress }: Props) {
  const category = getCategory(job.categoryId);
  const clientName = job.client?.clientProfile?.name ?? "Anonymous";

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.95}
    >
      {/* Header Section */}
      <View style={styles.headerSection}>
        {/* Job Icon/Avatar */}
        <View
          style={[styles.avatar, { backgroundColor: getCategoryColor(job.categoryId) }]}
        >
          <Text style={styles.avatarText}>{category?.icon ?? "💼"}</Text>
        </View>

        {/* Title and Info */}
        <View style={styles.titleSection}>
          <Text style={styles.title} numberOfLines={2}>{job.title}</Text>
          <Text style={styles.client}>by {clientName}</Text>
        </View>

        {/* Budget */}
        <View style={styles.budgetContainer}>
          <Text style={styles.budgetValue}>{formatCurrency(job.budget)}</Text>
          <Text style={styles.budgetPer}>/day</Text>
        </View>
      </View>

      {/* Location and Status */}
      <View style={styles.locationRow}>
        <View style={{ flex: 1 }}>
          {(job.address || job.city) && (
            <Text style={styles.locationText}>📍 {job.address ?? job.city}</Text>
          )}
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>
            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
          </Text>
        </View>
      </View>

      {/* Duration, Applicants, Posted */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Duration</Text>
          <Text style={styles.metaValue}>{DURATION_LABELS[job.duration]}</Text>
        </View>
        {job._count?.applications !== undefined && (
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Applicants</Text>
            <Text style={styles.metaValue}>{job._count.applications}</Text>
          </View>
        )}
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Posted</Text>
          <Text style={styles.metaValue}>{timeAgo(job.createdAt)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function getCategoryColor(categoryId?: string): string {
  const colors = ["#f0fdf4", "#eff6ff", "#fef3c7", "#fce7f3", "#f3e8ff"];
  if (!categoryId) return colors[0];
  return colors[categoryId.charCodeAt(0) % colors.length];
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  headerSection: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { fontSize: 32 },
  titleSection: { flex: 1 },
  title: { fontSize: 16, fontWeight: "700", color: "#1f2937", lineHeight: 22 },
  client: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  budgetContainer: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  budgetValue: { fontSize: 18, fontWeight: "700", color: "#16a34a" },
  budgetPer: { fontSize: 12, color: "#6b7280" },
  locationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  locationText: { fontSize: 13, color: "#4b5563" },
  statusBadge: {
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { fontSize: 12, fontWeight: "600", color: "#16a34a" },
  metaRow: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    gap: 12,
  },
  metaItem: { flex: 1, alignItems: "center" },
  metaLabel: { fontSize: 10, color: "#6b7280", marginBottom: 2 },
  metaValue: { fontSize: 12, fontWeight: "600", color: "#111827" },
});
