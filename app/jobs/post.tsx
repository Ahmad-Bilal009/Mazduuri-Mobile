import { useState } from "react";
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
import { jobsApi, uploadImage } from "@/lib/api";
import { ALL_SKILLS, SKILL_LABELS, DURATION_LABELS } from "@/lib/utils";
import type { Skill, JobDuration } from "@/types";

const DURATIONS: JobDuration[] = [
  "one_day",
  "few_days",
  "one_week",
  "one_month",
  "ongoing",
];

export default function PostJobScreen() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [budget, setBudget] = useState("");
  const [duration, setDuration] = useState<JobDuration>("one_day");
  const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
  const [image, setImage] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  function toggleSkill(skill: Skill) {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  }

  async function handlePickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow photo library access to attach an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploadingImage(true);
    try {
      const url = await uploadImage(result.assets[0].uri, "jobs");
      setImage(url);
    } catch (e: unknown) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Could not upload image");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handlePost() {
    if (!title || !description || !city || !budget || selectedSkills.length === 0) {
      Alert.alert("Missing fields", "Please fill in title, description, city, budget, and at least one skill.");
      return;
    }
    if (description.length < 20) {
      Alert.alert("Too short", "Description must be at least 20 characters.");
      return;
    }
    setSaving(true);
    try {
      await jobsApi.create({
        title,
        description,
        city,
        budget: Number(budget),
        duration,
        skills: selectedSkills,
        image,
      });
      Alert.alert("Posted!", "Your job has been posted.", [
        { text: "OK", onPress: () => router.replace("/(tabs)/jobs") },
      ]);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to post job");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post a Job</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Job image */}
        <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage} disabled={uploadingImage}>
          {uploadingImage ? (
            <ActivityIndicator color="#16a34a" size="large" />
          ) : image ? (
            <>
              <Image source={{ uri: image }} style={styles.jobImage} />
              <View style={styles.imageOverlay}>
                <Text style={styles.imageOverlayText}>Change Image</Text>
              </View>
            </>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={{ fontSize: 32 }}>📷</Text>
              <Text style={styles.imagePlaceholderText}>Add Job Image (optional)</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Job Title *</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Need Electrician for Office Wiring" />

        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the job in detail (at least 20 characters)..."
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>City *</Text>
        <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="e.g. Lahore" />

        <Text style={styles.label}>Budget (PKR) *</Text>
        <TextInput
          style={styles.input}
          value={budget}
          onChangeText={setBudget}
          keyboardType="numeric"
          placeholder="e.g. 5000"
        />

        <Text style={styles.label}>Duration *</Text>
        <View style={styles.durationRow}>
          {DURATIONS.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.durationChip, duration === d && styles.durationChipSelected]}
              onPress={() => setDuration(d)}
            >
              <Text style={[styles.durationText, duration === d && styles.durationTextSelected]}>
                {DURATION_LABELS[d]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Skills Required *</Text>
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
          style={[styles.postBtn, saving && styles.disabled]}
          onPress={handlePost}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.postBtnText}>Post Job</Text>}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  container: { padding: 16 },

  // Image picker
  imagePicker: {
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
    marginBottom: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  jobImage: { width: "100%", height: "100%" },
  imageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingVertical: 8,
    alignItems: "center",
  },
  imageOverlayText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  imagePlaceholder: { alignItems: "center", gap: 8 },
  imagePlaceholderText: { fontSize: 13, color: "#9ca3af" },

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
  textArea: { height: 110, textAlignVertical: "top" },

  durationRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  durationChip: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  durationChipSelected: { borderColor: "#16a34a", backgroundColor: "#f0fdf4" },
  durationText: { fontSize: 12, color: "#6b7280", fontWeight: "500" },
  durationTextSelected: { color: "#16a34a" },

  skillGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillChip: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
  },
  skillChipSelected: { borderColor: "#16a34a", backgroundColor: "#f0fdf4" },
  skillChipText: { fontSize: 13, color: "#6b7280", fontWeight: "500" },
  skillChipTextSelected: { color: "#16a34a" },

  postBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 24,
  },
  postBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.6 },
});
