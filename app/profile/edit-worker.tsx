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
import { workersApi, authApi, uploadImage } from "@/lib/api";
import { getAllCategories, groupSubcategoriesByCategory } from "@/lib/categories";
import { CategorySelector } from "@/components/CategorySelector";
import { SubcategorySelector } from "@/components/SubcategorySelector";
import { MapLocationPicker, type LocationData } from "@/components/MapLocationPicker";
import type { WorkerProfile } from "@/types";
import { mapCategoriesToSkills } from "@/lib/utils";
import { BackButton } from "@/components/BackButton";
import { PhoneField, isValidPakistaniMobile } from "@/components/PhoneField";

export default function EditWorkerProfileScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<WorkerProfile | null>(null);
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
  const [bio, setBio] = useState("");
  const [dailyWage, setDailyWage] = useState("");
  const [experience, setExperience] = useState("");
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
      if (me.workerProfile) {
        setProfile(me.workerProfile);
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
      if (profile && name && selectedCategoryIds.length > 0) {
        await workersApi.upsertProfile({
          name,
          bio: bio || undefined,
          categoryIds: selectedCategoryIds,
          subcategoryIds: selectedSubcategoryIds,
          skills: mapCategoriesToSkills(selectedCategoryIds),
          dailyWage: Number(dailyWage),
          experience: Number(experience) || 0,
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
        "Your profile is currently being reviewed by our team. You cannot make changes until the admin approves or rejects your application.",
      );
      return;
    }
    if (profile) {
      setName(profile.name);
      setBio(profile.bio ?? "");
      setDailyWage(String(profile.dailyWage));
      setExperience(String(profile.experience));
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

  function cancelEditing() {
    setEditing(false);
  }

  function handleCategoryChange(ids: string[]) {
    setSelectedCategoryIds(ids);
    // Remove subcategories whose parent category was deselected
    const allCats = getAllCategories();
    setSelectedSubcategoryIds((prev) =>
      prev.filter((subId) =>
        allCats.some(
          (c) => ids.includes(c.id) && c.subcategories.some((s) => s.id === subId),
        ),
      ),
    );
  }

  async function handleSave() {
    const isApproved = approvalStatus === "approved";

    if (!isApproved && (!name || !dailyWage || selectedCategoryIds.length === 0)) {
      Alert.alert("Missing fields", "Please fill in name, wage, and at least one category.");
      return;
    }
    if (isApproved && selectedCategoryIds.length === 0) {
      Alert.alert("Select category", "Please select at least one work category.");
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
      const updated = await workersApi.upsertProfile({
        // When approved, keep locked fields from existing profile unchanged
        name: isApproved ? (profile?.name ?? name) : name,
        phone,
        bio: isApproved ? (profile?.bio || undefined) : (bio || undefined),
        dailyWage: isApproved ? (profile?.dailyWage ?? Number(dailyWage)) : Number(dailyWage),
        experience: isApproved ? (profile?.experience ?? 0) : (Number(experience) || 0),
        categoryIds: selectedCategoryIds,
        subcategoryIds: selectedSubcategoryIds,
        skills: mapCategoriesToSkills(selectedCategoryIds),
        address: location?.address,
        city: location?.city,
        latitude: location?.latitude,
        longitude: location?.longitude,
        profilePicture: isApproved ? profile?.profilePicture : profilePicture,
        selfieUrl: isApproved ? profile?.selfieUrl : selfieUrl,
        nationalIdCardUrl: isApproved ? profile?.nationalIdCardUrl : nationalIdCardUrl,
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
        <BackButton />
        <Text style={styles.headerTitle}>
          {editing ? (profile ? "Edit Profile" : "Create Profile") : "My Profile"}
        </Text>
        {!editing && profile && approvalStatus !== "pending" && (
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
            {profile.address ? (
              <View style={styles.profileCityRow}>
                <MaterialCommunityIcons name="map-marker" size={13} color="#6b7280" />
                <Text style={styles.profileCity}>{profile.address}</Text>
              </View>
            ) : null}
            <View style={styles.ratingRow}>
              <MaterialCommunityIcons name="star" size={14} color="#f59e0b" />
              <Text style={styles.ratingText}>{profile.rating.toFixed(1)}</Text>
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

          {profile.bio ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          ) : null}

          {/* Categories + Subcategories grouped view */}
          {(profile.categoryIds?.length ?? 0) > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Services</Text>
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
                {approvalStatus === "approved" ? "Edit Categories & Location" : "Edit Profile"}
              </Text>
            </TouchableOpacity>
          )}

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
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {approvalStatus === "approved" ? (
            /* ── APPROVED: restricted edit banner ── */
            <View style={styles.restrictedBanner}>
              <MaterialCommunityIcons name="shield-check" size={18} color="#166534" />
              <View style={{ flex: 1 }}>
                <Text style={styles.restrictedTitle}>Identity Verified</Text>
                <Text style={styles.restrictedDesc}>
                  Your name, selfie, and ID card are locked. You can update your location and work categories.
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

              {/* Identity Verification */}
              <View style={styles.verifySection}>
                <View style={styles.verifySectionHeader}>
                  <MaterialCommunityIcons name="shield-check" size={16} color="#16a34a" />
                  <Text style={styles.verifySectionTitle}>Identity Verification</Text>
                </View>
                <Text style={styles.verifySectionDesc}>
                  Upload a selfie and your CNIC to build trust with clients.
                </Text>
                <View style={styles.docsRow}>
                  <TouchableOpacity style={styles.docCard} onPress={handlePickSelfie} disabled={uploadingSelfie}>
                    <View style={styles.selfiePreview}>
                      {uploadingSelfie ? (
                        <ActivityIndicator color="#16a34a" />
                      ) : selfieUrl ? (
                        <Image source={{ uri: selfieUrl }} style={styles.selfieImage} />
                      ) : (
                        <MaterialCommunityIcons name="camera-account" size={32} color="#9ca3af" />
                      )}
                    </View>
                    <Text style={styles.docCardLabel}>{selfieUrl ? "Change Selfie" : "Take Selfie"}</Text>
                    {selfieUrl && (
                      <View style={styles.docDoneTag}>
                        <MaterialCommunityIcons name="check-circle" size={12} color="#16a34a" />
                        <Text style={styles.docDoneText}>Uploaded</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.docCard} onPress={handlePickIdCard} disabled={uploadingIdCard}>
                    <View style={styles.idCardPreview}>
                      {uploadingIdCard ? (
                        <ActivityIndicator color="#16a34a" />
                      ) : nationalIdCardUrl ? (
                        <Image source={{ uri: nationalIdCardUrl }} style={styles.idCardImage} />
                      ) : (
                        <MaterialCommunityIcons name="card-account-details" size={32} color="#9ca3af" />
                      )}
                    </View>
                    <Text style={styles.docCardLabel}>{nationalIdCardUrl ? "Change CNIC" : "Upload CNIC"}</Text>
                    {nationalIdCardUrl && (
                      <View style={styles.docDoneTag}>
                        <MaterialCommunityIcons name="check-circle" size={12} color="#16a34a" />
                        <Text style={styles.docDoneText}>Uploaded</Text>
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
                placeholder="e.g. Muhammad Ali"
              />

              <PhoneField value={phone} onChange={setPhone} />

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
            </>
          )}

          {/* Location — always editable */}
          <Text style={styles.label}>Location *</Text>
          <TouchableOpacity style={styles.locationBtn} onPress={() => setLocationPickerVisible(true)}>
            <MaterialCommunityIcons name="map-marker" size={20} color="#16a34a" />
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
            title="Select Your Work Location"
          />

          {/* Categories — always editable */}
          <Text style={styles.label}>Categories *</Text>
          <CategorySelector selectedIds={selectedCategoryIds} onChange={handleCategoryChange} />

          <Text style={styles.label}>Specializations</Text>
          <SubcategorySelector
            categoryIds={selectedCategoryIds}
            selectedIds={selectedSubcategoryIds}
            onChange={setSelectedSubcategoryIds}
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
  profileCityRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10 },
  profileCity: { fontSize: 14, color: "#6b7280" },
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  bioText: { fontSize: 14, color: "#6b7280", lineHeight: 22 },
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
    backgroundColor: "#f0fdf4",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: 14,
    marginTop: 20,
    marginBottom: 4,
  },
  verifySectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  verifySectionTitle: { fontSize: 13, fontWeight: "700", color: "#15803d" },
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
