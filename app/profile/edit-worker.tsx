import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { workersApi, authApi, uploadImage } from "@/lib/api";
import { ALL_SKILLS, SKILL_LABELS } from "@/lib/utils";
import type { Skill, WorkerProfile } from "@/types";

export default function EditWorkerProfileScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [dailyWage, setDailyWage] = useState("");
  const [experience, setExperience] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
  const [profilePicture, setProfilePicture] = useState<string | undefined>();

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoadingProfile(true);
    try {
      const me = await authApi.me();
      if (me.workerProfile) {
        setProfile(me.workerProfile);
      }
    } catch {
      // no profile yet — go straight to edit
      setEditing(true);
    } finally {
      setLoadingProfile(false);
    }
  }

  async function handlePickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo library access to upload a profile picture.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploadingImage(true);
    try {
      const url = await uploadImage(result.assets[0].uri, "profiles");
      setProfilePicture(url);
      // Auto-save if profile already exists so the picture persists immediately
      if (profile && name && city && dailyWage && selectedSkills.length > 0) {
        await workersApi.upsertProfile({
          name,
          bio: bio || undefined,
          city,
          dailyWage: Number(dailyWage),
          experience: Number(experience) || 0,
          skills: selectedSkills,
          profilePicture: url,
        });
        setProfile((prev) => prev ? { ...prev, profilePicture: url } : prev);
      }
    } catch (e: unknown) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Could not upload image");
    } finally {
      setUploadingImage(false);
    }
  }

  function startEditing() {
    if (profile) {
      setName(profile.name);
      setBio(profile.bio ?? "");
      setCity(profile.city);
      setDailyWage(String(profile.dailyWage));
      setExperience(String(profile.experience));
      setSelectedSkills(profile.skills);
      setProfilePicture(profile.profilePicture);
    }
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
  }

  function toggleSkill(skill: Skill) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  }

  async function handleSave() {
    if (!name || !city || !dailyWage || selectedSkills.length === 0) {
      Alert.alert("Missing fields", "Please fill in name, city, wage, and at least one skill.");
      return;
    }
    setSaving(true);
    try {
      const updated = await workersApi.upsertProfile({
        name,
        bio: bio || undefined,
        city,
        dailyWage: Number(dailyWage),
        experience: Number(experience) || 0,
        skills: selectedSkills,
        profilePicture,
      });
      setProfile(updated);
      setEditing(false);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  if (loadingProfile) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ActivityIndicator color="#16a34a" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {editing ? (profile ? "Edit Profile" : "Create Profile") : "My Profile"}
        </Text>
        {!editing && profile && (
          <TouchableOpacity style={styles.editBtn} onPress={startEditing}>
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
        )}
        {!editing && !profile && (
          <TouchableOpacity style={styles.editBtn} onPress={startEditing}>
            <Text style={styles.editBtnText}>Setup</Text>
          </TouchableOpacity>
        )}
        {editing && (
          <TouchableOpacity onPress={cancelEditing}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── VIEW MODE ── */}
      {!editing && profile && (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Avatar + name */}
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              {profile.profilePicture ? (
                <Image source={{ uri: profile.profilePicture }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {profile.name.slice(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
            <Text style={styles.profileName}>{profile.name}</Text>
            <Text style={styles.profileCity}>📍 {profile.city}</Text>
            <View style={styles.ratingRow}>
              <Text style={styles.ratingText}>⭐ {profile.rating.toFixed(1)}</Text>
              <Text style={styles.ratingDot}>·</Text>
              <Text style={styles.ratingText}>{profile.totalJobs} jobs</Text>
              <Text style={styles.ratingDot}>·</Text>
              <View style={[styles.badge, profile.availability ? styles.badgeGreen : styles.badgeGray]}>
                <Text style={[styles.badgeText, { color: profile.availability ? "#16a34a" : "#9ca3af" }]}>
                  {profile.availability ? "Available" : "Unavailable"}
                </Text>
              </View>
            </View>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>PKR {profile.dailyWage.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Daily Wage</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{profile.experience} yr{profile.experience !== 1 ? "s" : ""}</Text>
              <Text style={styles.statLabel}>Experience</Text>
            </View>
          </View>

          {/* Bio */}
          {profile.bio ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          ) : null}

          {/* Skills */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skillGrid}>
              {profile.skills.map((skill) => (
                <View key={skill} style={styles.skillChipSelected}>
                  <Text style={styles.skillChipTextSelected}>{SKILL_LABELS[skill]}</Text>
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.editProfileBtn} onPress={startEditing}>
            <Text style={styles.editProfileBtnText}>Edit Profile</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── NO PROFILE YET ── */}
      {!editing && !profile && (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 52, marginBottom: 16 }}>👷</Text>
          <Text style={styles.emptyTitle}>No profile yet</Text>
          <Text style={styles.emptyDesc}>Set up your worker profile so clients can find you.</Text>
          <TouchableOpacity style={styles.editProfileBtn} onPress={startEditing}>
            <Text style={styles.editProfileBtnText}>Set Up Profile</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── EDIT MODE ── */}
      {editing && (
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Profile picture picker */}
          <View style={styles.pickerRow}>
            <TouchableOpacity style={styles.pickerAvatar} onPress={handlePickImage} disabled={uploadingImage}>
              {uploadingImage ? (
                <ActivityIndicator color="#16a34a" />
              ) : profilePicture ? (
                <Image source={{ uri: profilePicture }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {name ? name.slice(0, 2).toUpperCase() : "?"}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.changePhotoBtn} onPress={handlePickImage} disabled={uploadingImage}>
              <Text style={styles.changePhotoText}>
                {profilePicture ? "Change Photo" : "Add Photo"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Full Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Muhammad Ali" />

          <Text style={styles.label}>City *</Text>
          <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="e.g. Lahore" />

          <Text style={styles.label}>Daily Wage (PKR) *</Text>
          <TextInput
            style={styles.input}
            value={dailyWage}
            onChangeText={setDailyWage}
            keyboardType="numeric"
            placeholder="e.g. 1500"
          />

          <Text style={styles.label}>Experience (years)</Text>
          <TextInput
            style={styles.input}
            value={experience}
            onChangeText={setExperience}
            keyboardType="numeric"
            placeholder="e.g. 3"
          />

          <Text style={styles.label}>Bio</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Describe your work experience..."
            multiline
            numberOfLines={4}
          />

          <Text style={styles.label}>Skills *</Text>
          <View style={styles.skillGrid}>
            {ALL_SKILLS.map((skill) => (
              <TouchableOpacity
                key={skill}
                style={[styles.skillChip, selectedSkills.includes(skill) && styles.skillChipSelected]}
                onPress={() => toggleSkill(skill)}
              >
                <Text style={[styles.skillChipText, selectedSkills.includes(skill) && styles.skillChipTextSelected]}>
                  {SKILL_LABELS[skill]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.disabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save Profile</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  backBtn: { marginRight: 8 },
  backArrow: { fontSize: 28, color: "#374151", lineHeight: 30 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: "#111827" },
  editBtn: {
    backgroundColor: "#f0fdf4",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  editBtnText: { color: "#16a34a", fontWeight: "600", fontSize: 13 },
  cancelText: { color: "#6b7280", fontWeight: "600", fontSize: 14 },

  // View mode
  container: { padding: 16 },
  avatarSection: { alignItems: "center", paddingVertical: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  avatarImage: { width: 80, height: 80 },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 28 },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8, marginBottom: 4 },
  pickerAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  changePhotoBtn: {
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  changePhotoText: { color: "#16a34a", fontWeight: "600", fontSize: 14 },
  profileName: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 4 },
  profileCity: { fontSize: 14, color: "#6b7280", marginBottom: 10 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ratingText: { fontSize: 13, color: "#374151", fontWeight: "500" },
  ratingDot: { color: "#d1d5db", fontSize: 16 },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  badgeGreen: { backgroundColor: "#f0fdf4" },
  badgeGray: { backgroundColor: "#f3f4f6" },
  badgeText: { fontSize: 11, fontWeight: "600" },

  statsRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    marginBottom: 16,
    overflow: "hidden",
  },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 16 },
  statDivider: { width: 1, backgroundColor: "#f3f4f6" },
  statValue: { fontSize: 17, fontWeight: "700", color: "#111827", marginBottom: 2 },
  statLabel: { fontSize: 12, color: "#9ca3af" },

  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  bioText: { fontSize: 14, color: "#6b7280", lineHeight: 22 },
  skillGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  editProfileBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  editProfileBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, marginBottom: 24 },

  // Edit mode
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
  },
  textArea: { height: 100, textAlignVertical: "top" },
  skillChip: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  skillChipSelected: { borderColor: "#16a34a", backgroundColor: "#f0fdf4", borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  skillChipText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  skillChipTextSelected: { color: "#16a34a", fontSize: 13, fontWeight: "500" },
  saveBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.6 },
});
