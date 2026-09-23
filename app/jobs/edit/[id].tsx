import { useEffect, useState } from "react";
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
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { jobsApi, uploadImage } from "@/lib/api";
import { MapLocationPicker, type LocationData } from "@/components/MapLocationPicker";
import { DURATION_LABELS } from "@/lib/utils";
import { BackButton } from "@/components/BackButton";
import type { Job, JobDuration } from "@/types";

const DURATIONS: JobDuration[] = [
  "one_day",
  "few_days",
  "one_week",
  "one_month",
  "ongoing",
];

export default function EditJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [job, setJob] = useState<Job | null>(null);
  const [loadError, setLoadError] = useState("");

  // Form state — populated once job loads
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [duration, setDuration] = useState<JobDuration>("one_day");
  const [city, setCity] = useState("");
  const [location, setLocation] = useState<LocationData | undefined>();
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [image, setImage] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    jobsApi
      .get(id)
      .then((data) => {
        setJob(data);
        setTitle(data.title);
        setDescription(data.description);
        setBudget(String(data.budget));
        setDuration(data.duration);
        setCity(data.city ?? "");
        setImage(data.image);
        if (data.latitude && data.longitude) {
          setLocation({
            latitude: data.latitude,
            longitude: data.longitude,
            address: data.address ?? data.city ?? "",
            city: data.city ?? "",
          });
        }
      })
      .catch((e) => setLoadError(e.message));
  }, [id]);

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

  async function handleSave() {
    const trimmedTitle = title.trim();
    const trimmedDesc = description.trim();
    const trimmedCity = (location?.city ?? city).trim();

    if (!trimmedTitle || !trimmedDesc || !budget) {
      Alert.alert("Missing fields", "Title, description and budget are required.");
      return;
    }
    if (trimmedDesc.length < 20) {
      Alert.alert("Too short", "Description must be at least 20 characters.");
      return;
    }
    setSaving(true);
    try {
      await jobsApi.update(id, {
        title: trimmedTitle,
        description: trimmedDesc,
        budget: Number(budget),
        duration,
        city: trimmedCity || undefined,
        address: location?.address,
        latitude: location?.latitude,
        longitude: location?.longitude,
        image,
      });
      Alert.alert("Saved!", "Job updated successfully.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  if (!job && !loadError) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Edit Job</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
              <MaterialCommunityIcons name="camera" size={40} color="#9ca3af" />
              <Text style={styles.imagePlaceholderText}>Add Job Image (optional)</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Job Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Need Electrician for Office Wiring"
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Describe the job in detail (at least 20 characters)..."
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Budget (PKR) *</Text>
        <TextInput
          style={styles.input}
          value={budget}
          onChangeText={setBudget}
          keyboardType="numeric"
          placeholder="e.g. 5000"
          placeholderTextColor="#9ca3af"
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

        <Text style={styles.label}>Location</Text>
        <TouchableOpacity
          style={styles.locationBtn}
          onPress={() => setLocationPickerVisible(true)}
        >
          <MaterialCommunityIcons name="map-marker" size={20} color="#16a34a" />
          <View style={styles.locationBtnContent}>
            {location ? (
              <>
                <Text style={styles.locationBtnLabel}>{location.address || location.city}</Text>
                <Text style={styles.locationBtnCoords}>
                  {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                </Text>
              </>
            ) : city ? (
              <Text style={styles.locationBtnLabel}>{city}</Text>
            ) : (
              <Text style={styles.locationBtnPlaceholder}>Tap to change location</Text>
            )}
          </View>
          <Text style={styles.locationBtnArrow}>›</Text>
        </TouchableOpacity>

        <MapLocationPicker
          visible={locationPickerVisible}
          onLocationSelected={(selectedLocation) => {
            setLocation(selectedLocation as LocationData);
            setCity((selectedLocation as LocationData).city ?? "");
            setLocationPickerVisible(false);
          }}
          onCancel={() => setLocationPickerVisible(false)}
          initialLocation={
            location
              ? { latitude: location.latitude, longitude: location.longitude }
              : undefined
          }
          title="Select Job Location"
        />

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.disabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save Changes</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorText: { fontSize: 15, color: "#ef4444", marginBottom: 16, textAlign: "center" },
  backBtn: { backgroundColor: "#16a34a", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 24 },
  backBtnText: { color: "#fff", fontWeight: "600" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: "#111827", textAlign: "center" },
  container: { padding: 16 },
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
  locationBtn: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  locationBtnIcon: { fontSize: 18 },
  locationBtnContent: { flex: 1 },
  locationBtnLabel: { fontSize: 15, color: "#111827", fontWeight: "600" },
  locationBtnPlaceholder: { fontSize: 14, color: "#9ca3af" },
  locationBtnCoords: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  locationBtnArrow: { fontSize: 16, color: "#d1d5db" },
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
