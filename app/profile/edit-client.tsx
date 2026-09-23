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
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { profileApi, authApi, uploadImage } from "@/lib/api";
import { getAllCategories, groupSubcategoriesByCategory } from "@/lib/categories";
import { CategorySelector } from "@/components/CategorySelector";
import { SubcategorySelector } from "@/components/SubcategorySelector";
import { MapLocationPicker, type LocationData } from "@/components/MapLocationPicker";
import { BackButton } from "@/components/BackButton";
import type { ClientProfile } from "@/types";
import { PhoneField, isValidPakistaniMobile } from "@/components/PhoneField";

export default function EditClientProfileScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<string>("pending");
  const [approvalNote, setApprovalNote] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [uploadingIdCard, setUploadingIdCard] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<string[]>([]);
  const [location, setLocation] = useState<LocationData | undefined>();
  const [profilePicture, setProfilePicture] = useState<string | undefined>();
  const [selfieUrl, setSelfieUrl] = useState<string | undefined>();
  const [nationalIdCardUrl, setNationalIdCardUrl] = useState<string | undefined>();
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoadingProfile(true);
    try {
      const me = await authApi.me();
      setApprovalStatus(me.approvalStatus ?? "pending");
      setApprovalNote(me.approvalNote ?? null);
      setPhone(me.phone?.replace(/^\+92/, "") ?? "");
      if (me.clientProfile) {
        setProfile(me.clientProfile as ClientProfile);
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
      if (profile && name) {
        await profileApi.upsertClient({
          name,
          companyName: companyName || undefined,
          categoryIds: selectedCategoryIds,
          subcategoryIds: selectedSubcategoryIds,
          address: location?.address,
          latitude: location?.latitude,
          longitude: location?.longitude,
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

  async function handlePickSelfie() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera needed", "Allow camera access to take a selfie for identity verification.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploadingSelfie(true);
    try {
      const url = await uploadImage(result.assets[0].uri, "documents");
      setSelfieUrl(url);
    } catch (e: unknown) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Could not upload selfie");
    } finally {
      setUploadingSelfie(false);
    }
  }

  async function handlePickIdCard() {
    Alert.alert("Upload ID Card", "Choose how to add your CNIC / ID card", [
      {
        text: "Take Photo",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Camera needed", "Allow camera access to photograph your ID card.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [85, 54],
            quality: 0.9,
          });
          if (result.canceled) return;
          setUploadingIdCard(true);
          try {
            const url = await uploadImage(result.assets[0].uri, "documents");
            setNationalIdCardUrl(url);
          } catch (e: unknown) {
            Alert.alert("Upload failed", e instanceof Error ? e.message : "Could not upload ID card");
          } finally {
            setUploadingIdCard(false);
          }
        },
      },
      {
        text: "Choose from Library",
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Permission needed", "Allow photo library access to upload your ID card.");
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [85, 54],
            quality: 0.9,
          });
          if (result.canceled) return;
          setUploadingIdCard(true);
          try {
            const url = await uploadImage(result.assets[0].uri, "documents");
            setNationalIdCardUrl(url);
          } catch (e: unknown) {
            Alert.alert("Upload failed", e instanceof Error ? e.message : "Could not upload ID card");
          } finally {
            setUploadingIdCard(false);
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function startEditing() {
    if (approvalStatus === "pending") {
      Alert.alert(
        "Profile Under Review",
        "Your profile is being reviewed by our team. You cannot make changes until the review is complete.",
      );
      return;
    }
    if (profile) {
      setName(profile.name);
      setCompanyName(profile.companyName ?? "");
      setSelectedCategoryIds(profile.categoryIds ?? []);
      setSelectedSubcategoryIds(profile.subcategoryIds ?? []);
      setProfilePicture(profile.profilePicture);
      setSelfieUrl(profile.selfieUrl);
      setNationalIdCardUrl(profile.nationalIdCardUrl);
      if (profile.latitude && profile.longitude) {
        setLocation({
          address: profile.address ?? `${profile.latitude}, ${profile.longitude}`,
          latitude: profile.latitude,
          longitude: profile.longitude,
        });
      }
    }
    setEditing(true);
  }

  function handleCategoryChange(ids: string[]) {
    setSelectedCategoryIds(ids);
    const allCats = getAllCategories();
    setSelectedSubcategoryIds((prev) =>
      prev.filter((subId) =>
        allCats.some(
          (c) => ids.includes(c.id) && c.subcategories.some((s) => s.id === subId),
        ),
      ),
    );
  }

  const isApproved = approvalStatus === "approved";

  async function handleSave() {
    if (!isApproved && !name) {
      Alert.alert("Missing fields", "Please fill in your name.");
      return;
    }
    if (!location?.city) {
      Alert.alert("Missing location", "Please select a location with a valid city.");
      return;
    }
    if (!isValidPakistaniMobile(phone)) {
      Alert.alert("Missing phone", "Enter a valid Pakistani mobile number, e.g. 0300 1234567.");
      return;
    }
    setSaving(true);
    try {
      const updated = await profileApi.upsertClient(
        isApproved
          ? {
              // Approved: only location + categories; keep everything else locked
              name: profile?.name ?? name,
              phone,
              companyName: profile?.companyName ?? undefined,
              categoryIds: selectedCategoryIds,
              subcategoryIds: selectedSubcategoryIds,
              address: location?.address,
              city: location?.city,
              latitude: location?.latitude,
              longitude: location?.longitude,
              profilePicture: profile?.profilePicture,
              selfieUrl: profile?.selfieUrl,
              nationalIdCardUrl: profile?.nationalIdCardUrl,
            }
          : {
              name,
              phone,
              companyName: companyName || undefined,
              categoryIds: selectedCategoryIds,
              subcategoryIds: selectedSubcategoryIds,
              address: location?.address,
              city: location?.city,
              latitude: location?.latitude,
              longitude: location?.longitude,
              profilePicture,
              selfieUrl,
              nationalIdCardUrl,
            },
      );
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
        <BackButton />
        <Text style={styles.headerTitle}>
          {editing ? (profile ? "Edit Profile" : "Create Profile") : "My Profile"}
        </Text>
        {!editing && approvalStatus !== "pending" && (
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
              {profile.profilePicture ? (
                <Image source={{ uri: profile.profilePicture }} style={styles.avatarImage} />
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
            {profile.address ? (
              <View style={styles.profileCityRow}>
                <MaterialCommunityIcons name="map-marker" size={13} color="#6b7280" />
                <Text style={styles.profileCity}>{profile.address}</Text>
              </View>
            ) : null}
          </View>

          {/* Approval status banner */}
          {approvalStatus === "pending" && (
            <View style={[styles.approvalBanner, styles.approvalPending]}>
              <MaterialCommunityIcons name="clock-outline" size={16} color="#92400e" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.approvalBannerTitle, { color: "#92400e" }]}>Under Review</Text>
                <Text style={[styles.approvalBannerDesc, { color: "#a16207" }]}>
                  Your profile is being reviewed by our team. This may take up to 12 hours.
                </Text>
              </View>
            </View>
          )}
          {approvalStatus === "changes_required" && (
            <View style={[styles.approvalBanner, styles.approvalChanges]}>
              <MaterialCommunityIcons name="pencil-circle-outline" size={16} color="#9a3412" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.approvalBannerTitle, { color: "#9a3412" }]}>
                  Changes Requested
                </Text>
                <Text style={[styles.approvalBannerDesc, { color: "#c2410c" }]}>
                  {approvalNote ||
                    "Our team asked for some changes. Update your profile and submit again."}
                </Text>
              </View>
            </View>
          )}
          {approvalStatus === "rejected" && (
            <View style={[styles.approvalBanner, styles.approvalRejected]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#991b1b" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.approvalBannerTitle, { color: "#991b1b" }]}>Verification Failed</Text>
                <Text style={[styles.approvalBannerDesc, { color: "#b91c1c" }]}>
                  {approvalNote ||
                    "Your documents were not accepted. Please edit your profile and re-upload your selfie and CNIC."}
                </Text>
              </View>
            </View>
          )}
          {approvalStatus === "approved" && (
            <View style={[styles.approvalBanner, styles.approvalApproved]}>
              <MaterialCommunityIcons name="shield-check" size={16} color="#166534" />
              <Text style={[styles.approvalBannerTitle, { color: "#166534" }]}>Identity Verified</Text>
            </View>
          )}

          {/* Services hired for */}
          {(profile.categoryIds?.length ?? 0) > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Usually Hires For</Text>
              {groupSubcategoriesByCategory(
                profile.categoryIds ?? [],
                profile.subcategoryIds ?? [],
              ).map(({ category, subcategories }) => (
                <View key={category.id} style={styles.catGroup}>
                  <Text style={styles.catGroupLabel}>
                    {category.icon}{"  "}{category.name}
                  </Text>
                  {subcategories.map((sub) => (
                    <Text key={sub.id} style={styles.subItem}>• {sub.name}</Text>
                  ))}
                </View>
              ))}
            </View>
          ) : null}

          {approvalStatus !== "pending" && (
            <TouchableOpacity style={styles.editProfileBtn} onPress={startEditing}>
              <Text style={styles.editProfileBtnText}>
                {isApproved ? "Edit Categories & Location" : "Edit Profile"}
              </Text>
            </TouchableOpacity>
          )}
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
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isApproved ? (
            /* ── APPROVED: restricted edit banner ── */
            <View style={styles.restrictedBanner}>
              <MaterialCommunityIcons name="shield-check" size={18} color="#166534" />
              <View style={{ flex: 1 }}>
                <Text style={styles.restrictedTitle}>Identity Verified</Text>
                <Text style={styles.restrictedDesc}>
                  Your name, selfie, and ID card are locked. You can update your location and hiring categories.
                </Text>
              </View>
            </View>
          ) : (
            /* ── REJECTED / NEW: full edit ── */
            <>
              {/* Profile picture */}
              <View style={styles.pickerRow}>
                <TouchableOpacity style={styles.pickerAvatar} onPress={handlePickImage} disabled={uploadingImage}>
                  {uploadingImage ? (
                    <ActivityIndicator color="#9333ea" />
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

              {/* Identity Verification */}
              <View style={styles.verifySection}>
                <View style={styles.verifySectionHeader}>
                  <MaterialCommunityIcons name="shield-check" size={16} color="#9333ea" />
                  <Text style={[styles.verifySectionTitle, { color: "#7e22ce" }]}>Identity Verification</Text>
                </View>
                <Text style={styles.verifySectionDesc}>
                  Upload a selfie and your CNIC to build trust with workers.
                </Text>
                <View style={styles.docsRow}>
                  <TouchableOpacity style={styles.docCard} onPress={handlePickSelfie} disabled={uploadingSelfie}>
                    <View style={styles.selfiePreview}>
                      {uploadingSelfie ? (
                        <ActivityIndicator color="#9333ea" />
                      ) : selfieUrl ? (
                        <Image source={{ uri: selfieUrl }} style={styles.selfieImage} />
                      ) : (
                        <MaterialCommunityIcons name="camera-account" size={32} color="#9ca3af" />
                      )}
                    </View>
                    <Text style={styles.docCardLabel}>{selfieUrl ? "Change Selfie" : "Take Selfie"}</Text>
                    {selfieUrl && (
                      <View style={styles.docDoneTag}>
                        <MaterialCommunityIcons name="check-circle" size={12} color="#9333ea" />
                        <Text style={[styles.docDoneText, { color: "#9333ea" }]}>Uploaded</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.docCard} onPress={handlePickIdCard} disabled={uploadingIdCard}>
                    <View style={styles.idCardPreview}>
                      {uploadingIdCard ? (
                        <ActivityIndicator color="#9333ea" />
                      ) : nationalIdCardUrl ? (
                        <Image source={{ uri: nationalIdCardUrl }} style={styles.idCardImage} />
                      ) : (
                        <MaterialCommunityIcons name="card-account-details" size={32} color="#9ca3af" />
                      )}
                    </View>
                    <Text style={styles.docCardLabel}>{nationalIdCardUrl ? "Change CNIC" : "Upload CNIC"}</Text>
                    {nationalIdCardUrl && (
                      <View style={styles.docDoneTag}>
                        <MaterialCommunityIcons name="check-circle" size={12} color="#9333ea" />
                        <Text style={[styles.docDoneText, { color: "#9333ea" }]}>Uploaded</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Ali Hassan"
              />

              <PhoneField
                value={phone}
                onChange={setPhone}
                hint="Workers call this number to reach you. We'll verify it during review."
              />

              <Text style={styles.label}>Company Name</Text>
              <TextInput
                style={styles.input}
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="e.g. Hassan Builders (optional)"
              />
            </>
          )}

          {/* Location — always editable */}
          <Text style={styles.label}>Location *</Text>
          <TouchableOpacity style={styles.locationBtn} onPress={() => setLocationPickerVisible(true)}>
            <MaterialCommunityIcons name="map-marker" size={20} color="#9333ea" />
            <View style={styles.locationBtnContent}>
              {location ? (
                <>
                  <Text style={styles.locationBtnLabel}>{location.address}</Text>
                  <Text style={styles.locationBtnCoords}>
                    {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                  </Text>
                </>
              ) : (
                <Text style={styles.locationBtnLabel}>Select your location on map</Text>
              )}
            </View>
            <Text style={styles.locationBtnArrow}>›</Text>
          </TouchableOpacity>

          <MapLocationPicker
            visible={locationPickerVisible}
            onLocationSelected={(selectedLocation) => {
              setLocation(selectedLocation as LocationData);
              setLocationPickerVisible(false);
            }}
            onCancel={() => setLocationPickerVisible(false)}
            initialLocation={location ? { latitude: location.latitude, longitude: location.longitude } : undefined}
            title="Select Your Business Location"
          />

          {/* Categories — always editable */}
          <Text style={styles.label}>Categories I Hire For</Text>
          <CategorySelector
            selectedIds={selectedCategoryIds}
            onChange={handleCategoryChange}
            accentColor="#9333ea"
          />

          <Text style={styles.label}>Specific Services</Text>
          <SubcategorySelector
            categoryIds={selectedCategoryIds}
            selectedIds={selectedSubcategoryIds}
            onChange={setSelectedSubcategoryIds}
            accentColor="#9333ea"
          />

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.disabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
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
  profileCityRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  profileCity: { fontSize: 14, color: "#6b7280" },
  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  catGroup: { marginBottom: 10 },
  catGroupLabel: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 4 },
  subItem: { fontSize: 13, color: "#6b7280", lineHeight: 22, paddingLeft: 4 },
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
  approvalBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  approvalPending: { backgroundColor: "#fffbeb", borderColor: "#fcd34d" },
  approvalChanges: { backgroundColor: "#fff7ed", borderColor: "#fed7aa" },
  approvalRejected: { backgroundColor: "#fef2f2", borderColor: "#fca5a5" },
  approvalApproved: { backgroundColor: "#f0fdf4", borderColor: "#86efac" },
  approvalBannerTitle: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  approvalBannerDesc: { fontSize: 12, lineHeight: 17 },
  restrictedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    backgroundColor: "#f0fdf4",
    borderColor: "#86efac",
  },
  restrictedTitle: { fontSize: 13, fontWeight: "700", color: "#166534", marginBottom: 2 },
  restrictedDesc: { fontSize: 12, color: "#15803d", lineHeight: 17 },
  verifySection: {
    backgroundColor: "#faf5ff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e9d5ff",
    padding: 14,
    marginTop: 20,
    marginBottom: 4,
  },
  verifySectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  verifySectionTitle: { fontSize: 13, fontWeight: "700", color: "#7e22ce" },
  verifySectionDesc: { fontSize: 12, color: "#6b7280", marginBottom: 14, lineHeight: 18 },
  docsRow: { flexDirection: "row", gap: 12 },
  docCard: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    padding: 12,
    gap: 8,
  },
  selfiePreview: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  selfieImage: { width: 64, height: 64 },
  idCardPreview: {
    width: "100%",
    height: 48,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  idCardImage: { width: "100%", height: 48 },
  docCardLabel: { fontSize: 12, fontWeight: "600", color: "#374151", textAlign: "center" },
  docDoneTag: { flexDirection: "row", alignItems: "center", gap: 3 },
  docDoneText: { fontSize: 11, color: "#16a34a", fontWeight: "600" },
});
