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
  ActionSheetIOS,
  Platform,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { profileApi, uploadImage } from "@/lib/api";
import { CategorySelector } from "@/components/CategorySelector";
import { SubcategorySelector } from "@/components/SubcategorySelector";
import { MapLocationPicker, type LocationData } from "@/components/MapLocationPicker";
import { PhoneField, isValidPakistaniMobile } from "@/components/PhoneField";

const ACCENT = "#9333ea";
const ACCENT_BG = "#faf5ff";
const ACCENT_BORDER = "#e9d5ff";

// ─── Doc Card ────────────────────────────────────────────────────────────────

function DocCard({
  label,
  hint,
  uri,
  onPress,
  loading,
  aspect = "square",
}: {
  label: string;
  hint: string;
  uri: string | null;
  onPress: () => void;
  loading: boolean;
  aspect?: "square" | "id";
}) {
  return (
    <TouchableOpacity
      style={[styles.docCard, uri ? styles.docCardDone : null]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={ACCENT} />
      ) : uri ? (
        <Image
          source={{ uri }}
          style={aspect === "id" ? styles.docImageId : styles.docImageSquare}
        />
      ) : (
        <MaterialCommunityIcons name="camera-plus" size={32} color="#9ca3af" />
      )}
      <Text style={[styles.docLabel, uri ? { color: ACCENT } : null]}>{label}</Text>
      <Text style={styles.docHint}>{hint}</Text>
    </TouchableOpacity>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ current }: { current: number }) {
  return (
    <View style={styles.dotsRow}>
      {[1, 2].map((n) => (
        <View
          key={n}
          style={[styles.dot, n === current ? styles.dotActive : styles.dotInactive]}
        />
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreateClientScreen() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [idFrontUrl, setIdFrontUrl] = useState<string | null>(null);
  const [idBackUrl, setIdBackUrl] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationData | undefined>();
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);

  // Step 2 fields
  const [companyName, setCompanyName] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [subcategoryIds, setSubcategoryIds] = useState<string[]>([]);

  // Upload states
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [uploadingIdFront, setUploadingIdFront] = useState(false);
  const [uploadingIdBack, setUploadingIdBack] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Upload helpers ────────────────────────────────────────────────────────

  async function pickAndUpload(
    options: ImagePicker.ImagePickerOptions,
    folder: "profiles" | "documents",
    onDone: (url: string) => void,
    setLoading: (v: boolean) => void,
  ) {
    let result: ImagePicker.ImagePickerResult;
    if (options.cameraType === ImagePicker.CameraType.front) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Camera access is required.");
        return;
      }
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Photo library access is required.");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync(options);
    }
    if (result.canceled) return;
    setLoading(true);
    try {
      const url = await uploadImage(result.assets[0].uri, folder);
      onDone(url);
    } catch (e: unknown) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Could not upload image");
    } finally {
      setLoading(false);
    }
  }

  function pickIdDoc(setUrl: (url: string) => void, setLoading: (v: boolean) => void) {
    const doCamera = () =>
      pickAndUpload(
        { mediaTypes: ["images"], allowsEditing: true, aspect: [85, 54], quality: 0.85 },
        "documents",
        setUrl,
        setLoading,
      );
    const doLibrary = () =>
      pickAndUpload(
        { mediaTypes: ["images"], allowsEditing: true, aspect: [85, 54], quality: 0.85 },
        "documents",
        setUrl,
        setLoading,
      );

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancel", "Take Photo", "Choose from Library"], cancelButtonIndex: 0 },
        (i) => {
          if (i === 1) doCamera();
          else if (i === 2) doLibrary();
        },
      );
    } else {
      Alert.alert("Select Source", "", [
        { text: "Camera", onPress: doCamera },
        { text: "Library", onPress: doLibrary },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function goToStep2() {
    if (!name.trim()) {
      Alert.alert("Missing name", "Please enter your full name.");
      return;
    }
    if (!isValidPakistaniMobile(phone)) {
      Alert.alert("Missing phone", "Enter a valid Pakistani mobile number, e.g. 0300 1234567.");
      return;
    }
    if (!selfieUrl) {
      Alert.alert("Missing selfie", "Please take a selfie photo.");
      return;
    }
    if (!idFrontUrl) {
      Alert.alert("Missing ID front", "Please upload the front of your CNIC.");
      return;
    }
    if (!idBackUrl) {
      Alert.alert("Missing ID back", "Please upload the back of your CNIC.");
      return;
    }
    if (!location?.city) {
      Alert.alert("Missing location", "Please pin your location on the map.");
      return;
    }
    setStep(2);
  }

  async function handleSubmit() {
    if (!categoryIds.length) {
      Alert.alert("Select category", "Please select at least one category you hire for.");
      return;
    }
    setSaving(true);
    try {
      await profileApi.upsertClient({
        name: name.trim(),
        phone,
        companyName: companyName.trim() || undefined,
        city: location!.city,
        address: location!.address,
        latitude: location!.latitude,
        longitude: location!.longitude,
        profilePicture: profilePicUrl ?? undefined,
        selfieUrl: selfieUrl ?? undefined,
        nationalIdCardUrl: idFrontUrl ?? undefined,
        nationalIdBackUrl: idBackUrl ?? undefined,
        categoryIds,
        subcategoryIds,
      });
      router.replace("/(tabs)/profile");
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to create profile");
    } finally {
      setSaving(false);
    }
  }

  // ── Step 1 ─────────────────────────────────────────────────────────────────

  const step1 = (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>Personal Information</Text>
      <Text style={styles.stepDesc}>
        Add your name, a selfie, CNIC photos, and your location.
      </Text>

      {/* Profile photo (optional) */}
      <Text style={styles.label}>Profile Photo (optional)</Text>
      <TouchableOpacity
        style={styles.avatarPicker}
        onPress={() =>
          pickAndUpload(
            { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 },
            "profiles",
            setProfilePicUrl,
            setUploadingAvatar,
          )
        }
        disabled={uploadingAvatar}
      >
        {uploadingAvatar ? (
          <ActivityIndicator color={ACCENT} />
        ) : profilePicUrl ? (
          <Image source={{ uri: profilePicUrl }} style={styles.avatarImage} />
        ) : (
          <>
            <MaterialCommunityIcons name="account-circle" size={52} color="#d1d5db" />
            <Text style={styles.avatarHint}>Add photo</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>Full Name *</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Sara Khan"
        autoCapitalize="words"
      />

      <PhoneField value={phone} onChange={setPhone}
        hint="Workers call this number to reach you. We'll verify it during review." />

      <Text style={styles.label}>Your Selfie *</Text>
      <Text style={styles.fieldDesc}>Take a clear front-facing photo of your face.</Text>
      <DocCard
        label="Take Selfie"
        hint="Front-facing camera"
        uri={selfieUrl}
        aspect="square"
        loading={uploadingSelfie}
        onPress={() =>
          pickAndUpload(
            {
              mediaTypes: ["images"],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.85,
              cameraType: ImagePicker.CameraType.front,
            },
            "documents",
            setSelfieUrl,
            setUploadingSelfie,
          )
        }
      />

      <Text style={styles.label}>CNIC / National ID *</Text>
      <Text style={styles.fieldDesc}>Upload both front and back of your ID card.</Text>
      <View style={styles.docsRow}>
        <View style={{ flex: 1 }}>
          <DocCard
            label="ID Front"
            hint="Front side of CNIC"
            uri={idFrontUrl}
            aspect="id"
            loading={uploadingIdFront}
            onPress={() => pickIdDoc(setIdFrontUrl, setUploadingIdFront)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <DocCard
            label="ID Back"
            hint="Back side of CNIC"
            uri={idBackUrl}
            aspect="id"
            loading={uploadingIdBack}
            onPress={() => pickIdDoc(setIdBackUrl, setUploadingIdBack)}
          />
        </View>
      </View>

      <Text style={styles.label}>Location *</Text>
      <TouchableOpacity
        style={styles.locationBtn}
        onPress={() => setLocationPickerVisible(true)}
      >
        <MaterialCommunityIcons name="map-marker" size={20} color={ACCENT} />
        <View style={styles.locationBtnContent}>
          {location ? (
            <>
              <Text style={styles.locationBtnLabel}>{location.address}</Text>
              <Text style={styles.locationBtnCoords}>
                {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </Text>
            </>
          ) : (
            <Text style={styles.locationBtnPlaceholder}>Tap to select location on map</Text>
          )}
        </View>
        <Text style={styles.locationArrow}>›</Text>
      </TouchableOpacity>

      <MapLocationPicker
        visible={locationPickerVisible}
        onLocationSelected={(loc) => {
          setLocation(loc as LocationData);
          setLocationPickerVisible(false);
        }}
        onCancel={() => setLocationPickerVisible(false)}
        initialLocation={location ? { latitude: location.latitude, longitude: location.longitude } : undefined}
        title="Select Your Location"
      />

      <TouchableOpacity style={styles.nextBtn} onPress={goToStep2}>
        <Text style={styles.nextBtnText}>Continue →</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );

  // ── Step 2 ─────────────────────────────────────────────────────────────────

  const step2 = (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.stepTitle}>Hiring Preferences</Text>
      <Text style={styles.stepDesc}>
        Tell workers what kind of work you hire for.
      </Text>

      <Text style={styles.label}>Company / Business Name (optional)</Text>
      <TextInput
        style={styles.input}
        value={companyName}
        onChangeText={setCompanyName}
        placeholder="e.g. Khan Constructions"
        autoCapitalize="words"
      />

      <Text style={styles.label}>Categories I Hire For *</Text>
      <Text style={styles.fieldDesc}>
        Select the types of work you usually need. These will show as suggestions when you post a job.
      </Text>
      <CategorySelector
        selectedIds={categoryIds}
        onChange={(ids) => {
          setCategoryIds(ids);
          setSubcategoryIds([]);
        }}
      />

      {categoryIds.length > 0 && (
        <>
          <Text style={styles.label}>Specializations (optional)</Text>
          <SubcategorySelector
            categoryIds={categoryIds}
            selectedIds={subcategoryIds}
            onChange={setSubcategoryIds}
          />
        </>
      )}

      <View style={styles.backNextRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBtn, { flex: 1 }, saving && styles.disabled]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.nextBtnText}>Create Profile</Text>
          )}
        </TouchableOpacity>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (step === 1 ? router.back() : setStep(1))}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#374151" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerTitle}>Client Profile</Text>
          <StepDots current={step} />
        </View>
        <Text style={styles.stepCounter}>{step} / 2</Text>
      </View>

      {step === 1 ? step1 : step2}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    gap: 8,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  stepCounter: { fontSize: 13, color: "#9ca3af", fontWeight: "600", minWidth: 28, textAlign: "right" },
  dotsRow: { flexDirection: "row", gap: 5, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { backgroundColor: ACCENT },
  dotInactive: { backgroundColor: "#d1d5db" },

  container: { padding: 16 },
  stepTitle: { fontSize: 20, fontWeight: "800", color: "#111827", marginBottom: 4 },
  stepDesc: { fontSize: 13, color: "#6b7280", marginBottom: 20, lineHeight: 18 },

  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6, marginTop: 14 },
  fieldDesc: { fontSize: 12, color: "#9ca3af", marginBottom: 8, marginTop: -4 },

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

  avatarPicker: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    alignSelf: "center",
  },
  avatarImage: { width: 90, height: 90, borderRadius: 45 },
  avatarHint: { fontSize: 11, color: "#9ca3af", marginTop: 2 },

  docsRow: { flexDirection: "row", gap: 10 },
  docCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    gap: 6,
    overflow: "hidden",
    minHeight: 120,
    justifyContent: "center",
  },
  docCardDone: {
    borderColor: ACCENT_BORDER,
    borderStyle: "solid",
    backgroundColor: ACCENT_BG,
    padding: 0,
    paddingBottom: 8,
  },
  docImageSquare: { width: "100%", height: 100, resizeMode: "cover" },
  docImageId: { width: "100%", height: 80, resizeMode: "cover" },
  docLabel: { fontSize: 12, fontWeight: "700", color: "#374151" },
  docHint: { fontSize: 11, color: "#9ca3af", textAlign: "center", paddingHorizontal: 4 },

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
  locationBtnContent: { flex: 1 },
  locationBtnLabel: { fontSize: 14, color: "#111827", fontWeight: "600" },
  locationBtnPlaceholder: { fontSize: 14, color: "#9ca3af" },
  locationBtnCoords: { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  locationArrow: { fontSize: 16, color: "#d1d5db" },

  nextBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 24,
  },
  nextBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  backNextRow: { flexDirection: "row", gap: 10, marginTop: 24 },
  backBtn: {
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  backBtnText: { fontSize: 15, fontWeight: "600", color: "#374151" },

  disabled: { opacity: 0.6 },
});
