import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, Alert } from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import type { WorkerProfile } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { getCategory, getSubcategory } from "@/lib/categories";
import { useSavedStore } from "@/store/savedStore";
import { useAuthGate } from "@/hooks/useAuthGate";

interface Props {
  worker: WorkerProfile;
  onPress?: () => void;
  /** Hidden on the Saved screen, where every row is saved by definition. */
  showSaveButton?: boolean;
}

export function WorkerDetailCard({ worker, onPress, showSaveButton = true }: Props) {
  const categories = worker.categoryIds?.slice(0, 5) ?? [];
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

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.95}
    >
      {/* Header Section */}
      <View style={styles.headerSection}>
        {/* Avatar */}
        <View
          style={[styles.avatar, { backgroundColor: getColor(worker.name) }]}
        >
          {worker.profilePicture ? (
            <Image source={{ uri: worker.profilePicture }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{worker.name[0]?.toUpperCase()}</Text>
          )}
        </View>

        {/* Name and Rating */}
        <View style={styles.nameSection}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{worker.name}</Text>
            <Text style={styles.badge}>✓</Text>
          </View>
          <View style={styles.ratingRow}>
            <MaterialCommunityIcons name="star" size={14} color="#f59e0b" />
            <Text style={styles.rating}>{worker.rating?.toFixed(1) ?? "N/A"}</Text>
            <Text style={styles.reviewCount}>({worker.totalJobs ?? 0} jobs)</Text>
          </View>
        </View>

        {/* Wage */}
        <View style={styles.wageContainer}>
          <Text style={styles.wageValue}>{formatCurrency(worker.dailyWage)}</Text>
          <Text style={styles.wagePer}>/day</Text>
        </View>

        {showSaveButton && (
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleToggleSave}
            hitSlop={10}
          >
            <MaterialCommunityIcons
              name={isSaved ? "heart" : "heart-outline"}
              size={20}
              color={isSaved ? "#ef4444" : "#9ca3af"}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Location (currently hidden) */}

      {/* Skills */}
      {categories.length > 0 && (
        <View style={styles.skillsSection}>
          <Text style={styles.skillsTitle}>Skills & Services</Text>
          <View style={styles.skillsList}>
            {categories.map((catId) => {
              const cat = getCategory(catId);
              return (
                <View key={catId} style={styles.skillTag}>
                  <Text style={styles.skillText}>
                    {cat?.icon ?? ""} {cat?.name ?? ""}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{worker.experience}+</Text>
          <Text style={styles.statLabel}>Years Exp.</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{worker.totalJobs ?? 0}</Text>
          <Text style={styles.statLabel}>Jobs Done</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{Math.round((worker.rating ?? 0) * 20)}%</Text>
          <Text style={styles.statLabel}>Positive Rate</Text>
        </View>
      </View>

      {/* Bio */}
      {worker.bio && (
        <View style={styles.bioSection}>
          <Text style={styles.bioTitle}>About Me</Text>
          <Text style={styles.bioText} numberOfLines={3}>{worker.bio}</Text>
        </View>
      )}

      {/* View Profile Button */}
      <TouchableOpacity
        style={styles.viewButton}
        onPress={onPress}
      >
        <Text style={styles.viewButtonText}>View Profile →</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function getColor(name: string): string {
  const colors = ["#16a34a", "#2563eb", "#9333ea", "#ea580c", "#0d9488"];
  return colors[name.charCodeAt(0) % colors.length];
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
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarImage: { width: 64, height: 64, borderRadius: 32 },
  avatarText: { color: "#fff", fontSize: 24, fontWeight: "700" },
  nameSection: { flex: 1 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  name: { fontSize: 18, fontWeight: "700", color: "#1f2937" },
  badge: { fontSize: 16, color: "#16a34a" },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rating: { fontSize: 14, fontWeight: "600", color: "#111827" },
  reviewCount: { fontSize: 13, color: "#6b7280" },
  saveBtn: { paddingLeft: 10, paddingTop: 2, alignSelf: "flex-start" },
  wageContainer: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  wageValue: { fontSize: 18, fontWeight: "700", color: "#16a34a" },
  wagePer: { fontSize: 12, color: "#6b7280" },
  locationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  locationText: { fontSize: 13, color: "#4b5563" },
  availableBadge: {
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availableText: { fontSize: 12, fontWeight: "600", color: "#16a34a" },
  skillsSection: { marginBottom: 12 },
  skillsTitle: { fontSize: 13, fontWeight: "600", color: "#1f2937", marginBottom: 8 },
  skillsList: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  skillTag: {
    backgroundColor: "#f0fdf4",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#dcfce7",
  },
  skillText: { fontSize: 12, fontWeight: "500", color: "#15803d" },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    justifyContent: "space-around",
  },
  statItem: { alignItems: "center" },
  statValue: { fontSize: 16, fontWeight: "700", color: "#111827" },
  statLabel: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "#e5e7eb" },
  bioSection: { marginBottom: 12 },
  bioTitle: { fontSize: 13, fontWeight: "600", color: "#1f2937", marginBottom: 6 },
  bioText: { fontSize: 13, color: "#4b5563", lineHeight: 18 },
  viewButton: {
    backgroundColor: "#16a34a",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  viewButtonText: { fontSize: 14, fontWeight: "600", color: "#fff" },
});
