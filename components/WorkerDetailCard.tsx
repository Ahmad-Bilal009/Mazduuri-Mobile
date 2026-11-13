import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import type { WorkerProfile } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { getCategory } from "@/lib/categories";
import { useSavedStore } from "@/store/savedStore";
import { useAuthGate } from "@/hooks/useAuthGate";

interface Props {
  worker: WorkerProfile;
  onPress?: () => void;
  /** Hidden on the Saved screen, where every row is saved by definition. */
  showSaveButton?: boolean;
}

export function WorkerDetailCard({ worker, onPress, showSaveButton = true }: Props) {
  const categories = worker.categoryIds?.slice(0, 3) ?? [];
  const { gate } = useAuthGate();
  const isSaved = useSavedStore((s) => s.ids.has(worker.id));
  const toggleSaved = useSavedStore((s) => s.toggle);

  function handleToggleSave() {
    gate(() => {
      toggleSaved(worker.id).catch(() =>
        Alert.alert("Error", "Could not update your saved workers."),
      );
    }, "save workers");
  }

  const jobs = worker.totalJobs ?? 0;
  const hasRating = (worker.rating ?? 0) > 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.95}>
      {/* Header: avatar, name + rating, wage */}
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          <View style={[styles.avatar, { backgroundColor: getColor(worker.name) }]}>
            {worker.profilePicture ? (
              <Image source={{ uri: worker.profilePicture }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{worker.name[0]?.toUpperCase()}</Text>
            )}
          </View>
          {/* Only verified workers are listed in production. */}
          <View style={styles.verified}>
            <MaterialCommunityIcons name="check-decagram-outline" size={13} color="#fff" />
          </View>
        </View>

        <View style={styles.nameBlock}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {worker.name}
            </Text>
            {showSaveButton && (
              <TouchableOpacity onPress={handleToggleSave} hitSlop={10} style={styles.saveBtn}>
                <MaterialCommunityIcons
                  name={isSaved ? "heart" : "heart-outline"}
                  size={18}
                  color={isSaved ? "#ef4444" : "#94a3b8"}
                />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.ratingRow}>
            <MaterialCommunityIcons name="star" size={15} color="#facc15" />
            <Text style={styles.rating}>{hasRating ? worker.rating.toFixed(1) : "New"}</Text>
            <Text style={styles.jobs}>
              · {jobs} {jobs === 1 ? "job" : "jobs"}
            </Text>
          </View>
        </View>

        <View style={styles.wageBlock}>
          <Text style={styles.wage}>{formatCurrency(worker.dailyWage)}</Text>
          <Text style={styles.wagePer}>/day</Text>
        </View>
      </View>

      {/* Skills */}
      {categories.length > 0 && (
        <View style={styles.skills}>
          <Text style={styles.sectionLabel}>SKILLS & SERVICES</Text>
          <View style={styles.chips}>
            {categories.map((catId) => {
              const cat = getCategory(catId);
              if (!cat) return null;
              return (
                <View key={catId} style={styles.chip}>
                  <Text style={styles.chipIcon}>{cat.icon}</Text>
                  <Text style={styles.chipText}>{cat.name}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Stats */}
      <View style={styles.stats}>
        <Stat value={`${worker.experience ?? 0}+`} label="Years Exp." />
        <View style={styles.statDivider} />
        <Stat value={String(jobs)} label="Jobs Done" />
        <View style={styles.statDivider} />
        <Stat
          value={hasRating ? `${Math.round(worker.rating * 20)}%` : "—"}
          label="Positive Rate"
        />
      </View>

      {/* CTA */}
      <TouchableOpacity style={styles.cta} onPress={onPress} activeOpacity={0.85}>
        <Text style={styles.ctaText}>View Profile</Text>
        <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function getColor(name: string): string {
  const colors = ["#16a34a", "#2563eb", "#9333ea", "#ea580c", "#0d9488"];
  return colors[name.charCodeAt(0) % colors.length];
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
  avatarWrap: { width: 58, height: 58 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 56, height: 56 },
  avatarText: { color: "#fff", fontSize: 22, fontWeight: "700" },
  verified: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  nameBlock: { flex: 1, paddingTop: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flexShrink: 1, fontSize: 17, fontWeight: "700", color: "#0f172a" },
  saveBtn: { paddingHorizontal: 2 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  rating: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  jobs: { fontSize: 13, color: "#64748b" },
  wageBlock: { alignItems: "flex-end", paddingTop: 2 },
  wage: { fontSize: 17, fontWeight: "800", color: "#22c55e" },
  wagePer: { fontSize: 12, color: "#64748b", marginTop: 2 },

  skills: { marginTop: 14 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#dcfce7",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipIcon: { fontSize: 12 },
  chipText: { fontSize: 13, fontWeight: "600", color: "#16a34a" },

  stats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 16,
    paddingVertical: 12,
    marginTop: 12,
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
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
