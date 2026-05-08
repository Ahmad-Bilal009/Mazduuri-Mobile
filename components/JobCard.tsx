import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import type { Job } from "@/types";
import { formatCurrency, DURATION_LABELS, timeAgo } from "@/lib/utils";

interface Props {
  job: Job;
  onPress?: () => void;
}

export function JobCard({ job, onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {job.title}
        </Text>
        <View style={[styles.badge, { backgroundColor: "#f0fdf4" }]}>
          <Text style={{ color: "#16a34a", fontSize: 10, fontWeight: "600" }}>
            {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
          </Text>
        </View>
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {job.description}
      </Text>

      <View style={styles.meta}>
        <Text style={styles.wage}>💰 {formatCurrency(job.budget)}/day</Text>
        {job.location.city && (
          <Text style={styles.metaItem}>📍 {job.location.city}</Text>
        )}
        <Text style={styles.metaItem}>⏱ {DURATION_LABELS[job.duration]}</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.time}>{timeAgo(job.createdAt)}</Text>
        {job.applicants && (
          <Text style={styles.applicants}>{job.applicants.length} applied</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  title: { fontSize: 15, fontWeight: "600", color: "#111827", flex: 1 },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  description: {
    fontSize: 13,
    color: "#4b5563",
    lineHeight: 18,
    marginBottom: 8,
  },
  meta: { flexDirection: "row", gap: 12, flexWrap: "wrap", marginBottom: 8 },
  wage: { fontSize: 13, fontWeight: "700", color: "#16a34a" },
  metaItem: { fontSize: 12, color: "#6b7280" },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f9fafb",
    paddingTop: 8,
  },
  time: { fontSize: 11, color: "#9ca3af" },
  applicants: { fontSize: 11, color: "#6b7280" },
});
