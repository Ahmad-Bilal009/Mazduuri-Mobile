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
  Modal,
  Pressable,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import MapView, { Marker } from "react-native-maps";
import { jobsApi, uploadImage, authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { CategorySelector } from "@/components/CategorySelector";
import { SubcategorySelector } from "@/components/SubcategorySelector";
import { MapLocationPicker, type LocationData } from "@/components/MapLocationPicker";
import { DURATION_LABELS, mapCategoriesToSkills } from "@/lib/utils";
import type { JobDuration } from "@/types";

const DURATIONS: JobDuration[] = [
  "one_day",
  "few_days",
  "one_week",
  "one_month",
  "ongoing",
];

const DESCRIPTION_MAX = 500;

export default function PostJobScreen() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [duration, setDuration] = useState<JobDuration>("one_day");
  const [durationSheetOpen, setDurationSheetOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>("");
  const [location, setLocation] = useState<LocationData | undefined>();
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [image, setImage] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Posting is client-only. The screen is normally reached from the profile
  // menu, but the route is addressable, so guard it here too.
  useEffect(() => {
    if (isAuthenticated && user?.role === "client") return;
    Alert.alert(
      isAuthenticated ? "Clients only" : "Login required",
      isAuthenticated
        ? "Switch to a client account to post jobs."
        : "Log in to post a job. Browsing stays free.",
      [
        {
          text: isAuthenticated ? "OK" : "Log in",
          onPress: () => {
            router.back();
            if (!isAuthenticated) router.push("/auth");
          },
        },
      ],
    );
  }, [isAuthenticated, user?.role]);

  // Pre-fill category from client profile
  useEffect(() => {
    if (!isAuthenticated) return;
    authApi.me().then((data) => {
      const catId = data.clientProfile?.categoryIds?.[0];
      if (catId) setSelectedCategoryId(catId);
    }).catch(() => {});
  }, []);

  function handleCategoryChange(ids: string[]) {
    const newId = ids[0] ?? "";
    if (newId !== selectedCategoryId) {
      // Reset subcategory when category changes
      setSelectedSubcategoryId("");
    }
    setSelectedCategoryId(newId);
  }

  function handleSubcategoryChange(ids: string[]) {
    setSelectedSubcategoryId(ids[0] ?? "");
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
    if (!title || !description || !budget || !selectedCategoryId || !selectedSubcategoryId) {
      Alert.alert(
        "Missing fields",
        "Please fill in title, description, budget, and select a category with a specialization.",
      );
      return;
    }
    if (description.length < 20) {
      Alert.alert("Too short", "Description must be at least 20 characters.");
      return;
    }
    if (!location?.city) {
      Alert.alert("Missing location", "Please select a location on the map so we can set the city.");
      return;
    }
    setSaving(true);
    try {
      await jobsApi.create({
        title,
        description,
        categoryId: selectedCategoryId,
        subcategoryId: selectedSubcategoryId,
        skills: mapCategoriesToSkills([selectedCategoryId]),
        city: location.city,
        address: location.address,
        latitude: location.latitude,
        longitude: location.longitude,
        budget: Number(budget),
        duration,
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

  const selectedCategoryArr = selectedCategoryId ? [selectedCategoryId] : [];
  const selectedSubcategoryArr = selectedSubcategoryId ? [selectedSubcategoryId] : [];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.headerBack}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post a Job</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Fix leaking kitchen sink"
          placeholderTextColor="#9ca3af"
        />

        {/* Category */}
        <Text style={styles.label}>Category</Text>
        <CategorySelector
          selectedIds={selectedCategoryArr}
          onChange={handleCategoryChange}
          singleSelect
          placeholder="Select category"
        />

        {selectedCategoryId ? (
          <>
            <Text style={styles.label}>Specialization</Text>
            <SubcategorySelector
              categoryIds={selectedCategoryArr}
              selectedIds={selectedSubcategoryArr}
              onChange={handleSubcategoryChange}
              singleSelect
            />
          </>
        ) : null}

        {/* Budget */}
        <Text style={styles.label}>Budget</Text>
        <View style={styles.budgetBox}>
          <Text style={styles.budgetPrefix}>Rs</Text>
          <TextInput
            style={styles.budgetInput}
            value={budget}
            onChangeText={(t) => setBudget(t.replace(/[^0-9]/g, ""))}
            keyboardType="numeric"
            placeholder="2,000"
            placeholderTextColor="#9ca3af"
          />
          <Text style={styles.budgetSuffix}>/ day</Text>
        </View>

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <View style={styles.textAreaWrap}>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the job in detail (at least 20 characters)..."
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={DESCRIPTION_MAX}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length}/{DESCRIPTION_MAX}</Text>
        </View>

        {/* Upload Photos */}
        <Text style={styles.label}>Upload Photos</Text>
        <View style={styles.photosRow}>
          {image ? (
            <View style={styles.photoTile}>
              <Image source={{ uri: image }} style={styles.photoThumb} />
              <TouchableOpacity style={styles.photoRemove} onPress={() => setImage(undefined)} hitSlop={6}>
                <MaterialCommunityIcons name="close" size={13} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.photoAdd}
              onPress={handlePickImage}
              disabled={uploadingImage}
              activeOpacity={0.7}
            >
              {uploadingImage ? (
                <ActivityIndicator color="#16a34a" />
              ) : (
                <>
                  <MaterialCommunityIcons name="plus" size={26} color="#6b7280" />
                  <Text style={styles.photoAddText}>Add</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Location */}
        <Text style={styles.label}>Location</Text>
        <TouchableOpacity
          style={styles.mapCard}
          onPress={() => setLocationPickerVisible(true)}
          activeOpacity={0.85}
        >
          {location ? (
            <>
              <MapView
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                region={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                }}
              >
                <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} />
              </MapView>
              <View style={styles.mapPill}>
                <MaterialCommunityIcons name="map-marker" size={15} color="#111827" />
                <Text style={styles.mapPillText} numberOfLines={1}>
                  {location.address ?? location.city}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.mapPlaceholder}>
              <MaterialCommunityIcons name="map-marker-outline" size={30} color="#9ca3af" />
              <Text style={styles.mapPlaceholderText}>Tap to select location on map</Text>
            </View>
          )}
        </TouchableOpacity>

        <MapLocationPicker
          visible={locationPickerVisible}
          onLocationSelected={(selectedLocation) => {
            setLocation(selectedLocation as LocationData);
            setLocationPickerVisible(false);
          }}
          onCancel={() => setLocationPickerVisible(false)}
          initialLocation={location ? { latitude: location.latitude, longitude: location.longitude } : undefined}
          title="Select Job Location"
        />

        {/* Duration */}
        <Text style={styles.label}>Duration</Text>
        <TouchableOpacity
          style={styles.selectField}
          onPress={() => setDurationSheetOpen(true)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="calendar-blank-outline" size={19} color="#6b7280" />
          <Text style={styles.selectFieldText}>{DURATION_LABELS[duration]}</Text>
          <MaterialCommunityIcons name="chevron-down" size={20} color="#9ca3af" />
        </TouchableOpacity>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.postBtn, saving && styles.disabled]}
          onPress={handlePost}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.postBtnText}>Submit Job</Text>}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── Duration bottom sheet ── */}
      <Modal visible={durationSheetOpen} animationType="slide" transparent statusBarTranslucent>
        <Pressable style={styles.sheetBackdrop} onPress={() => setDurationSheetOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Job Duration</Text>
          {DURATIONS.map((d) => (
            <TouchableOpacity
              key={d}
              style={styles.sheetOption}
              onPress={() => {
                setDuration(d);
                setDurationSheetOpen(false);
              }}
            >
              <Text style={[styles.sheetOptionText, duration === d && styles.sheetOptionTextActive]}>
                {DURATION_LABELS[d]}
              </Text>
              {duration === d && (
                <MaterialCommunityIcons name="check-circle" size={20} color="#16a34a" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  headerBack: {
    width: 40,
    height: 40,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  container: { paddingHorizontal: 20 },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
    marginTop: 18,
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: "#111827",
  },

  // Budget
  budgetBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
  },
  budgetPrefix: { fontSize: 15, color: "#6b7280", fontWeight: "500", marginRight: 8 },
  budgetInput: { flex: 1, fontSize: 15, color: "#111827", paddingVertical: 13 },
  budgetSuffix: { fontSize: 13, color: "#9ca3af" },

  // Description
  textAreaWrap: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  textArea: {
    minHeight: 110,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 6,
    fontSize: 15,
    color: "#111827",
  },
  charCount: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "right",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },

  // Photos
  photosRow: { flexDirection: "row", gap: 10 },
  photoTile: { width: 88, height: 88 },
  photoThumb: { width: 88, height: 88, borderRadius: 12, backgroundColor: "#f3f4f6" },
  photoRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  photoAdd: {
    width: 88,
    height: 88,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    backgroundColor: "#fff",
  },
  photoAddText: { fontSize: 12, color: "#6b7280", fontWeight: "500" },

  // Map preview
  mapCard: {
    height: 150,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  mapPill: {
    position: "absolute",
    top: 16,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
    maxWidth: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  mapPillText: { fontSize: 13, fontWeight: "600", color: "#111827" },
  mapPlaceholder: { alignItems: "center", gap: 6 },
  mapPlaceholderText: { fontSize: 13, color: "#9ca3af" },

  // Duration select
  selectField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "#fff",
  },
  selectFieldText: { flex: 1, fontSize: 15, color: "#111827" },

  // Submit
  postBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
  },
  postBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },
  disabled: { opacity: 0.6 },

  // Duration sheet
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 34,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 6 },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f9fafb",
  },
  sheetOptionText: { fontSize: 15, color: "#374151" },
  sheetOptionTextActive: { color: "#16a34a", fontWeight: "700" },
});
