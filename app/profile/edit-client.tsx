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
import { profileApi, uploadImage } from "@/lib/api";
import type { ClientProfile } from "@/types";

export default function EditClientProfileScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [city, setCity] = useState("");
  const [profilePicture, setProfilePicture] = useState<string | undefined>();

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoadingProfile(true);
    try {
      const data = await profileApi.get();
      if (data && "city" in data && "name" in data) {
        setProfile(data as ClientProfile);
      }
    } catch {
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
      if (profile && name && city) {
        await profileApi.upsertClient({
          name,
          companyName: companyName || undefined,
          city,
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
      setCompanyName(profile.companyName ?? "");
      setCity(profile.city);
      setProfilePicture((profile as ClientProfile & { profilePicture?: string }).profilePicture);
    }
    setEditing(true);
  }

  async function handleSave() {
    if (!name || !city) {
      Alert.alert("Missing fields", "Please fill in name and city.");
      return;
    }
    setSaving(true);
    try {
      const updated = await profileApi.upsertClient({
        name,
        companyName: companyName || undefined,
        city,
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

  const pic = (profile as (ClientProfile & { profilePicture?: string }) | null)?.profilePicture;

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
        {!editing && (
          <TouchableOpacity style={styles.editBtn} onPress={startEditing}>
            <Text style={styles.editBtnText}>{profile ? "Edit" : "Setup"}</Text>
          </TouchableOpacity>
        )}
        {editing && (
          <TouchableOpacity onPress={() => setEditing(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── VIEW MODE ── */}
      {!editing && profile && (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              {pic ? (
                <Image source={{ uri: pic }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {profile.name.slice(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
            <Text style={styles.profileName}>{profile.name}</Text>
            {profile.companyName ? (
              <Text style={styles.companyName}>🏢 {profile.companyName}</Text>
            ) : null}
            <Text style={styles.profileCity}>📍 {profile.city}</Text>
          </View>

          <TouchableOpacity style={styles.editProfileBtn} onPress={startEditing}>
            <Text style={styles.editProfileBtnText}>Edit Profile</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── NO PROFILE ── */}
      {!editing && !profile && (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 52, marginBottom: 16 }}>🏢</Text>
          <Text style={styles.emptyTitle}>No profile yet</Text>
          <Text style={styles.emptyDesc}>Set up your client profile so workers can contact you.</Text>
          <TouchableOpacity style={styles.editProfileBtn} onPress={startEditing}>
            <Text style={styles.editProfileBtnText}>Set Up Profile</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── EDIT MODE ── */}
      {editing && (
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Profile picture */}
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
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Ali Hassan" />

          <Text style={styles.label}>Company Name</Text>
          <TextInput style={styles.input} value={companyName} onChangeText={setCompanyName} placeholder="e.g. Hassan Builders (optional)" />

          <Text style={styles.label}>City *</Text>
          <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="e.g. Lahore" />

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.disabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Profile</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
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
  container: { padding: 16 },
  avatarSection: { alignItems: "center", paddingVertical: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#9333ea",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  avatarImage: { width: 80, height: 80 },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 28 },
  profileName: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 4 },
  companyName: { fontSize: 14, color: "#6b7280", marginBottom: 4 },
  profileCity: { fontSize: 14, color: "#6b7280" },
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
  pickerRow: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8, marginBottom: 4 },
  pickerAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#9333ea",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  changePhotoBtn: {
    backgroundColor: "#faf5ff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e9d5ff",
  },
  changePhotoText: { color: "#9333ea", fontWeight: "600", fontSize: 14 },
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
