import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import type { WorkerProfile } from "@/types";
import { formatCurrency, SKILL_LABELS, SKILL_ICONS } from "@/lib/utils";

interface Props {
  worker: WorkerProfile;
  onPress?: () => void;
}

export function WorkerCard({ worker, onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.row}>
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

        <View style={styles.info}>
          <View style={styles.header}>
            <Text style={styles.name} numberOfLines={1}>
              {worker.name}
            </Text>
            <Text style={styles.wage}>
              {formatCurrency(worker.dailyWage)}/day
            </Text>
          </View>

          {worker.city && (
            <View style={styles.locationRow}>
              <MaterialCommunityIcons name="map-marker" size={12} color="#6b7280" />
              <Text style={styles.location}>{worker.city}</Text>
            </View>
          )}

          <View style={styles.skills}>
            {worker.skills.slice(0, 3).map((skill) => (
              <View key={skill} style={styles.skillTag}>
                <View style={styles.skillInner}>
                  <MaterialCommunityIcons name={SKILL_ICONS[skill]} size={11} color="#4b5563" />
                  <Text style={styles.skillText}>{SKILL_LABELS[skill]}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.footer}>
            <View
              style={[
                styles.badge,
                worker.availability ? styles.badgeGreen : styles.badgeGray,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: worker.availability ? "#16a34a" : "#6b7280" },
                ]}
              >
                {worker.availability ? "Available" : "Busy"}
              </Text>
            </View>
            {worker.experience > 0 && (
              <Text style={styles.exp}>{worker.experience} yrs exp</Text>
            )}
          </View>
        </View>
      </View>
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
    borderColor: "#f3f4f6",
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  row: { flexDirection: "row", gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarImage: { width: 52, height: 52, borderRadius: 26 },
  avatarText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  info: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  name: { fontSize: 15, fontWeight: "600", color: "#111827", flex: 1 },
  wage: { fontSize: 13, fontWeight: "700", color: "#16a34a", marginLeft: 8 },
  location: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  skillInner: { flexDirection: "row", alignItems: "center", gap: 3 },
  skills: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  skillTag: {
    backgroundColor: "#f3f4f6",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  skillText: { fontSize: 10, color: "#4b5563" },
  footer: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeGreen: { backgroundColor: "#f0fdf4" },
  badgeGray: { backgroundColor: "#f3f4f6" },
  badgeText: { fontSize: 10, fontWeight: "600" },
  exp: { fontSize: 11, color: "#6b7280" },
});
