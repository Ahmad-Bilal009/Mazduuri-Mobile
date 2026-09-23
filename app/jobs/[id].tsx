import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Image,
  Alert,
  Dimensions,
  Share,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { HeroScrim } from "@/components/HeroScrim";
import { jobsApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { getCategoryName, getSubcategoryName, getCategory } from "@/lib/categories";
import type { Job, JobApplication } from "@/types";
import { formatCurrency, DURATION_LABELS, timeAgo, formatPhone } from "@/lib/utils";
import { ApplyModal } from "@/components/ApplyModal";

const SCREEN_W = Dimensions.get("window").width;
const HERO_H = Math.round(SCREEN_W * 0.68);

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user, token } = useAuthStore();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [pastHero, setPastHero] = useState(false);

  const loadJob = useCallback(() => {
    setError("");
    setLoading(true);
    jobsApi
      .get(id)
      .then(setJob)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load job"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  // Check if the current worker already applied (runs after job or user loads)
  useEffect(() => {
    if (user?.role === "worker" && job?.applications) {
      const alreadyApplied = job.applications.some(
        (a: JobApplication) => a.workerId === user.id || a.worker?.id === user.id
      );
      if (alreadyApplied) setApplied(true);
    }
  }, [job, user]);

  async function handleToggleStatus() {
    if (!job) return;
    const isOpen = job.status === "open";
    const nextStatus = isOpen ? "cancelled" : "open";
    const label = isOpen ? "Close Job" : "Reopen Job";
    Alert.alert(
      label,
      isOpen
        ? "This will close the job and prevent new applications. You can reopen it later."
        : "This will reopen the job for new applications.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: label,
          style: isOpen ? "destructive" : "default",
          onPress: async () => {
            setActionLoading(true);
            try {
              await jobsApi.updateStatus(id, nextStatus as "open" | "cancelled");
              setJob((prev) => prev ? { ...prev, status: nextStatus as Job["status"] } : prev);
            } catch (e: unknown) {
              Alert.alert("Error", e instanceof Error ? e.message : "Failed to update job");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  }

  async function handleDelete() {
    Alert.alert(
      "Delete Job",
      "This will permanently delete the job and all its applications. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              await jobsApi.delete(id);
              router.replace("/(tabs)/jobs");
            } catch (e: unknown) {
              Alert.alert("Error", e instanceof Error ? e.message : "Failed to delete job");
              setActionLoading(false);
            }
          },
        },
      ]
    );
  }

  async function handleApplySubmit(payload: { message?: string; offerAmount?: number }) {
    await jobsApi.apply(id, payload);
    setApplied(true);
    setModalVisible(false);
    // Reload to get updated applicant list + count
    loadJob();
  }

  function handleShare() {
    if (!job) return;
    Share.share({
      message: `${job.title} — ${formatCurrency(job.budget)} · ${job.address ?? job.city ?? ""}. Posted on Mazduuri.`,
    }).catch(() => {});
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (error || !job) {
    return (
      <View style={styles.center}>
        <StatusBar style="dark" />
        <Text style={{ fontSize: 40, marginBottom: 12 }}>😕</Text>
        <Text style={styles.errorTitle}>Job not found</Text>
        {error ? <Text style={styles.errorSub}>{error}</Text> : null}
        <TouchableOpacity style={styles.errorBackBtn} onPress={() => router.back()}>
          <Text style={styles.errorBackBtnText}>Go Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.errorBackBtn, { marginTop: 8, backgroundColor: "#6b7280" }]}
          onPress={loadJob}
        >
          <Text style={styles.errorBackBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isClient = user?.role === "client";
  const isOwner = isClient && job.client?.id === user?.id;
  const applications = job.applications ?? [];
  const clientName = job.client?.clientProfile?.name;
  const category = getCategory(job.categoryId);
  const showApplyBar =
    job.status === "open" && !isOwner && (user?.role === "worker" || !isAuthenticated);

  return (
    <View style={styles.safe}>
      <StatusBar style={job.image && !pastHero ? "light" : "dark"} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: showApplyBar ? 120 : insets.bottom + 24 }}
        onScroll={(e) =>
          setPastHero(e.nativeEvent.contentOffset.y > HERO_H - insets.top - 50)
        }
        scrollEventThrottle={16}
      >
        {/* ── Photo header ── */}
        {job.image ? (
          <View style={styles.hero}>
            <Image source={{ uri: job.image }} style={styles.heroImage} />
            {/* Status-bar scrim so time/battery stay readable over the photo */}
            <HeroScrim height={insets.top + 46} />
            <View style={[styles.heroTopBar, { top: insets.top + 8 }]}>
              <TouchableOpacity style={styles.heroCircleBtn} onPress={() => router.back()} hitSlop={8}>
                <MaterialCommunityIcons name="arrow-left" size={22} color="#111827" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.heroCircleBtn} onPress={handleShare} hitSlop={8}>
                <MaterialCommunityIcons name="share-variant-outline" size={20} color="#111827" />
              </TouchableOpacity>
            </View>
            <View style={styles.dotsRow}>
              <View style={[styles.dot, styles.dotActive]} />
            </View>
          </View>
        ) : (
          <View style={[styles.plainHeader, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity style={styles.plainCircleBtn} onPress={() => router.back()} hitSlop={8}>
              <MaterialCommunityIcons name="arrow-left" size={22} color="#111827" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.plainCircleBtn} onPress={handleShare} hitSlop={8}>
              <MaterialCommunityIcons name="share-variant-outline" size={20} color="#111827" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.body}>
          {/* Status pill for non-open jobs */}
          {job.status !== "open" && (
            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>
                {job.status === "cancelled" ? "Closed" : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
              </Text>
            </View>
          )}

          {/* Title */}
          <Text style={styles.title}>{job.title}</Text>

          {/* Poster row */}
          <View style={styles.posterRow}>
            <View style={[styles.posterAvatar, { backgroundColor: getColor(clientName ?? "C") }]}>
              <Text style={styles.posterAvatarText}>{(clientName ?? "C")[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.posterName}>{clientName ?? "Client"}</Text>
              <Text style={styles.posterTime}>Posted {timeAgo(job.createdAt)}</Text>
            </View>
          </View>

          {/* ── Info card ── */}
          <View style={styles.infoCard}>
            {job.categoryId ? (
              <InfoRow
                icon="tools"
                label="Category"
                value={`${category?.icon ? category.icon + " " : ""}${getCategoryName(job.categoryId)}`}
              />
            ) : null}
            {job.subcategoryId ? (
              <InfoRow icon="tag-outline" label="Specialization" value={getSubcategoryName(job.subcategoryId)} />
            ) : null}
            <InfoRow icon="wallet-outline" label="Budget" value={`${formatCurrency(job.budget)} / day`} />
            {(job.address || job.city) ? (
              <InfoRow icon="map-marker-outline" label="Location" value={job.address ?? job.city ?? ""} />
            ) : null}
            <InfoRow icon="calendar-blank-outline" label="Duration" value={DURATION_LABELS[job.duration]} last />
          </View>

          {/* ── Description ── */}
          <Text style={styles.sectionHeading}>Description</Text>
          <Text style={styles.description}>{job.description}</Text>

          <View style={styles.metaRow}>
            {job._count?.applications !== undefined && (
              <Text style={styles.metaText}>
                {job._count.applications} applicant{job._count.applications !== 1 ? "s" : ""}
              </Text>
            )}
          </View>

          {/* ── Owner actions ── */}
          {isOwner && (
            <View style={styles.ownerBar}>
              <TouchableOpacity
                style={styles.ownerBtnEdit}
                onPress={() => router.push(`/jobs/edit/${id}`)}
                disabled={actionLoading || job.status === "cancelled"}
              >
                <MaterialCommunityIcons name="pencil-outline" size={16} color="#374151" />
                <Text style={styles.ownerBtnEditText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.ownerBtnStatus,
                  job.status === "open" ? styles.ownerBtnClose : styles.ownerBtnReopen,
                  actionLoading && styles.disabled,
                ]}
                onPress={handleToggleStatus}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name={job.status === "open" ? "lock-outline" : "lock-open-outline"}
                      size={16}
                      color="#fff"
                    />
                    <Text style={styles.ownerBtnStatusText}>
                      {job.status === "open" ? "Close" : "Reopen"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.ownerBtnDelete, actionLoading && styles.disabled]}
                onPress={handleDelete}
                disabled={actionLoading}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Contact (authenticated non-owner) ── */}
          {!isOwner && isAuthenticated && job.client?.phone ? (
            <View style={styles.contactRow}>
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() => Linking.openURL(`tel:${job.client!.phone}`)}
              >
                <MaterialCommunityIcons name="phone-outline" size={18} color="#16a34a" />
                <Text style={styles.contactBtnText}>{formatPhone(job.client.phone)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactBtn, styles.waBtn]}
                onPress={() =>
                  Linking.openURL(`https://wa.me/${job.client!.phone!.replace(/\D/g, "")}`)
                }
              >
                <MaterialCommunityIcons name="whatsapp" size={18} color="#fff" />
                <Text style={[styles.contactBtnText, { color: "#fff" }]}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* ── Applied confirmation ── */}
          {applied && (
            <View style={styles.appliedBox}>
              <MaterialCommunityIcons name="check-circle" size={30} color="#16a34a" />
              <Text style={styles.appliedTitle}>Application Submitted!</Text>
              <Text style={styles.appliedDesc}>The client will contact you if interested.</Text>
            </View>
          )}

          {/* ── Applicants list — owner or applied worker ── */}
          {(isOwner || applied) && applications.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <Text style={styles.sectionHeading}>Applicants ({applications.length})</Text>
              {applications.map((app) => (
                <ApplicantCard
                  key={app.id}
                  application={app}
                  jobBudget={job.budget}
                  onPress={() =>
                    router.push(
                      `/workers/${app.workerId}?applicationId=${app.id}&jobId=${id}&appStatus=${app.status}`
                    )
                  }
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Sticky Apply bar ── */}
      {showApplyBar && !applied && (
        <View style={[styles.applyBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={styles.applyBtn}
            activeOpacity={0.85}
            onPress={() => {
              if (!isAuthenticated || !token) {
                router.push("/auth");
              } else {
                setModalVisible(true);
              }
            }}
          >
            <Text style={styles.applyBtnText}>
              {isAuthenticated ? "Apply for Job" : "Login to Apply"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ApplyModal
        visible={modalVisible}
        jobBudget={job.budget}
        onClose={() => setModalVisible(false)}
        onSubmit={handleApplySubmit}
      />
    </View>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  last,
}: {
  icon: string;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <View style={styles.infoLeft}>
        <MaterialCommunityIcons name={icon} size={19} color="#6b7280" />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

// ─── Applicant Card ───────────────────────────────────────────────────────────

function ApplicantCard({
  application,
  jobBudget,
  onPress,
}: {
  application: JobApplication;
  jobBudget: number;
  onPress: () => void;
}) {
  const profile = application.worker?.workerProfile;
  const name = profile?.name ?? "Worker";
  const rating = profile?.rating ?? 0;
  const experience = profile?.experience ?? 0;
  const city = profile?.city;
  const effectiveOffer = application.offerAmount ?? jobBudget;

  return (
    <TouchableOpacity style={styles.applicantCard} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.applicantLeft}>
        {profile?.profilePicture ? (
          <Image source={{ uri: profile.profilePicture }} style={styles.applicantAvatar} />
        ) : (
          <View style={styles.applicantAvatarPlaceholder}>
            <Text style={styles.applicantAvatarText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
      </View>

      <View style={styles.applicantInfo}>
        <View style={styles.applicantNameRow}>
          <Text style={styles.applicantName}>{name}</Text>
          <View style={[styles.appStatusBadge, getAppStatusStyle(application.status)]}>
            <Text style={[styles.appStatusText, getAppStatusTextStyle(application.status)]}>
              {application.status}
            </Text>
          </View>
        </View>

        <View style={styles.applicantMeta}>
          <MaterialCommunityIcons name="star" size={12} color="#f59e0b" />
          <Text style={styles.applicantMetaText}>{rating.toFixed(1)}</Text>
          <Text style={styles.applicantMetaDot}>·</Text>
          <Text style={styles.applicantMetaText}>{experience}y exp</Text>
          {city ? (
            <>
              <Text style={styles.applicantMetaDot}>·</Text>
              <MaterialCommunityIcons name="map-marker" size={12} color="#6b7280" />
              <Text style={styles.applicantMetaText}>{city}</Text>
            </>
          ) : null}
        </View>

        {application.message ? (
          <Text style={styles.applicantMessage} numberOfLines={2}>
            "{application.message}"
          </Text>
        ) : null}

        <View style={styles.applicantOfferRow}>
          <Text style={styles.applicantOffer}>{formatCurrency(effectiveOffer)}/day</Text>
          {application.offerAmount && application.offerAmount !== jobBudget ? (
            <Text style={styles.applicantOfferLabel}>custom offer</Text>
          ) : (
            <Text style={styles.applicantOfferLabel}>listed rate</Text>
          )}
          <Text style={styles.applicantTime}>{timeAgo(application.createdAt)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function getAppStatusStyle(status: string) {
  if (status === "accepted") return { backgroundColor: "#f0fdf4" };
  if (status === "rejected") return { backgroundColor: "#fef2f2" };
  return { backgroundColor: "#fffbeb" };
}
function getAppStatusTextStyle(status: string) {
  if (status === "accepted") return { color: "#16a34a" };
  if (status === "rejected") return { color: "#ef4444" };
  return { color: "#d97706" };
}

function getColor(name: string): string {
  const palette = ["#16a34a", "#2563eb", "#9333ea", "#ea580c", "#0d9488"];
  return palette[name.charCodeAt(0) % palette.length];
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#fff" },
  errorTitle: { fontSize: 18, fontWeight: "600", color: "#374151", marginBottom: 6 },
  errorSub: { fontSize: 13, color: "#ef4444", marginBottom: 16, textAlign: "center", paddingHorizontal: 24 },
  errorBackBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  errorBackBtnText: { color: "#fff", fontWeight: "600" },

  // Hero
  hero: { width: SCREEN_W, height: HERO_H, backgroundColor: "#e5e7eb" },
  heroImage: { width: "100%", height: "100%" },
  heroTopBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  dotsRow: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  dotActive: { backgroundColor: "#fff" },

  // Plain header (no image)
  plainHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  plainCircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },

  body: { paddingHorizontal: 20, paddingTop: 18 },
  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: "#f3f4f6",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 10,
  },
  statusPillText: { fontSize: 12, fontWeight: "600", color: "#6b7280" },
  title: { fontSize: 24, fontWeight: "700", color: "#111827", lineHeight: 30 },

  posterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
  },
  posterAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  posterAvatarText: { color: "#fff", fontWeight: "700", fontSize: 17 },
  posterName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  posterTime: { fontSize: 13, color: "#6b7280", marginTop: 1 },

  // Info card
  infoCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    paddingHorizontal: 16,
    marginTop: 20,
    backgroundColor: "#fff",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 15,
    gap: 12,
  },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  infoLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoLabel: { fontSize: 14.5, color: "#374151", fontWeight: "500" },
  infoValue: {
    flex: 1,
    fontSize: 14.5,
    color: "#111827",
    fontWeight: "600",
    textAlign: "right",
  },

  sectionHeading: { fontSize: 18, fontWeight: "700", color: "#111827", marginTop: 24, marginBottom: 10 },
  description: { fontSize: 14.5, color: "#374151", lineHeight: 22 },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 10 },
  metaText: { fontSize: 12, color: "#9ca3af" },

  // Owner actions
  ownerBar: { flexDirection: "row", gap: 8, marginTop: 20 },
  ownerBtnEdit: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerBtnEditText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  ownerBtnStatus: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  ownerBtnClose: { backgroundColor: "#f59e0b" },
  ownerBtnReopen: { backgroundColor: "#16a34a" },
  ownerBtnStatusText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  ownerBtnDelete: {
    width: 46,
    backgroundColor: "#fef2f2",
    borderWidth: 1.5,
    borderColor: "#fca5a5",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.5 },

  // Contact
  contactRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  contactBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    paddingVertical: 13,
    backgroundColor: "#fff",
  },
  contactBtnText: { fontSize: 14, fontWeight: "600", color: "#111827" },
  waBtn: { backgroundColor: "#25D366", borderColor: "#25D366" },

  // Applied
  appliedBox: {
    backgroundColor: "#f0fdf4",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    marginTop: 24,
    gap: 4,
  },
  appliedTitle: { fontSize: 16, fontWeight: "700", color: "#15803d" },
  appliedDesc: { fontSize: 13, color: "#16a34a", textAlign: "center" },

  // Sticky apply bar
  applyBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
  },
  applyBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },

  // Applicant card
  applicantCard: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  applicantLeft: { justifyContent: "flex-start" },
  applicantAvatar: { width: 48, height: 48, borderRadius: 24 },
  applicantAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
  },
  applicantAvatarText: { fontSize: 20, fontWeight: "700", color: "#374151" },
  applicantInfo: { flex: 1 },
  applicantNameRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  applicantName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  appStatusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  appStatusText: { fontSize: 10, fontWeight: "600" },
  applicantMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  applicantMetaText: { fontSize: 12, color: "#6b7280" },
  applicantMetaDot: { fontSize: 12, color: "#d1d5db" },
  applicantMessage: {
    fontSize: 12,
    color: "#6b7280",
    fontStyle: "italic",
    marginBottom: 6,
    lineHeight: 16,
  },
  applicantOfferRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  applicantOffer: { fontSize: 13, fontWeight: "700", color: "#16a34a" },
  applicantOfferLabel: {
    fontSize: 10,
    color: "#9ca3af",
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  applicantTime: { fontSize: 10, color: "#9ca3af", marginLeft: "auto" },
});
