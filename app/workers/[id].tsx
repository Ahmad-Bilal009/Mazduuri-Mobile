import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Image,
  Alert,
  TextInput,
  Dimensions,
  Share,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { HeroScrim } from "@/components/HeroScrim";
import { workersApi, jobsApi, chatApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useSavedStore } from "@/store/savedStore";
import { useAuthGate } from "@/hooks/useAuthGate";
import { getCategoryName, groupSubcategoriesByCategory } from "@/lib/categories";
import type { WorkerProfile, ApplicationStatus, Review } from "@/types";
import { formatCurrency, timeAgo } from "@/lib/utils";

const SCREEN_W = Dimensions.get("window").width;
const HERO_H = Math.round(SCREEN_W * 0.92);
const GALLERY_GAP = 8;
const GALLERY_SIZE = (SCREEN_W - 20 * 2 - GALLERY_GAP * 2) / 3;

type Tab = "about" | "skills" | "reviews" | "gallery";

export default function WorkerDetailScreen() {
  const { id, applicationId, jobId, appStatus } = useLocalSearchParams<{
    id: string;
    applicationId?: string;
    jobId?: string;
    appStatus?: ApplicationStatus;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { gate } = useAuthGate();
  const savedIds = useSavedStore((s) => s.ids);
  const toggleSaved = useSavedStore((s) => s.toggle);

  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus | undefined>(
    appStatus as ApplicationStatus | undefined
  );
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("about");

  const [pastHero, setPastHero] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [starDraft, setStarDraft] = useState(0);
  const [commentDraft, setCommentDraft] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadWorker = useCallback(() => {
    workersApi
      .get(id)
      .then(setWorker)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const loadReviews = useCallback(() => {
    setReviewsLoading(true);
    workersApi
      .getReviews(id)
      .then((data) => {
        setReviews(data);
        // Find if the current client already reviewed via this applicationId
        if (applicationId) {
          const existing = data.find((r) => r.applicationId === applicationId);
          if (existing) {
            setMyReview(existing);
            setStarDraft(existing.rating);
            setCommentDraft(existing.comment ?? "");
          }
        }
      })
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  }, [id, applicationId]);

  useEffect(() => {
    if (user?.role === "worker") {
      router.replace("/(tabs)");
      return;
    }
    loadWorker();
    loadReviews();
  }, [id]);

  async function handleUpdateApplication(status: "accepted" | "rejected") {
    if (!applicationId || !jobId) return;
    setUpdating(true);
    try {
      await jobsApi.updateApplication(jobId, applicationId, status);
      setApplicationStatus(status);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to update application");
    } finally {
      setUpdating(false);
    }
  }

  const [startingChat, setStartingChat] = useState(false);

  async function handleMessage() {
    if (!gate(() => {}, "message this worker")) return;
    const workerUserId = worker?.userId ?? worker?.user?.id;
    if (!workerUserId) return;
    setStartingChat(true);
    try {
      const conv = await chatApi.start(workerUserId);
      router.push(`/chat/${conv.id}`);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not open chat");
    } finally {
      setStartingChat(false);
    }
  }

  function handleHireNow() {
    if (!gate(() => {}, "hire this worker")) return;
    // Coming from a job application → hiring means accepting the worker
    if (applicationId && jobId && applicationStatus === "pending") {
      Alert.alert("Hire Worker", `Accept ${worker?.name}'s application for this job?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Hire", onPress: () => handleUpdateApplication("accepted") },
      ]);
      return;
    }
    // Otherwise start a conversation to arrange the work
    handleMessage();
  }

  const isSaved = !!worker && savedIds.has(worker.id);

  function handleToggleSave() {
    if (!worker) return;
    gate(() => {
      // Always key on the profile id: /workers/:id also accepts a user id, and
      // saving under the wrong one would split the heart across screens.
      toggleSaved(worker.id).catch(() =>
        Alert.alert("Error", "Could not update your saved workers."),
      );
    }, "save workers");
  }

  function handleShare() {
    if (!worker) return;
    Share.share({
      message: `${worker.name} — ${getCategoryName(worker.categoryIds?.[0] ?? "")} on Mazduuri. ${formatCurrency(worker.dailyWage)}/day.`,
    }).catch(() => {});
  }

  async function handleSubmitReview() {
    if (!applicationId || starDraft === 0) return;
    setSubmittingReview(true);
    try {
      const submitted = await workersApi.submitReview(id, {
        applicationId,
        rating: starDraft,
        comment: commentDraft.trim() || undefined,
      });
      setMyReview(submitted);
      // Refresh full list so count/avg update
      loadReviews();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to submit review");
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (error || !worker) {
    return (
      <View style={styles.center}>
        <StatusBar style="dark" />
        <Text style={{ fontSize: 40, marginBottom: 12 }}>😕</Text>
        <Text style={styles.errorTitle}>Worker not found</Text>
        <TouchableOpacity style={styles.errorBackBtn} onPress={() => router.back()}>
          <Text style={styles.errorBackBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasApplication = !!(applicationId && jobId && user?.role === "client");
  const canReview = hasApplication && applicationStatus === "accepted";
  const phone = worker.user?.phone;
  const categoryLabel = worker.categoryIds?.[0] ? getCategoryName(worker.categoryIds[0]) : null;
  const galleryPhotos = [worker.profilePicture].filter(Boolean) as string[];

  const TABS: { key: Tab; label: string }[] = [
    { key: "about", label: "About" },
    { key: "skills", label: "Skills" },
    { key: "reviews", label: "Reviews" },
    { key: "gallery", label: "Gallery" },
  ];

  return (
    <View style={styles.safe}>
      <StatusBar style={pastHero ? "dark" : "light"} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        onScroll={(e) =>
          setPastHero(e.nativeEvent.contentOffset.y > HERO_H - insets.top - 50)
        }
        scrollEventThrottle={16}
      >
        {/* ── Hero photo ── */}
        <View style={styles.hero}>
          {worker.profilePicture ? (
            <Image source={{ uri: worker.profilePicture }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroFallback, { backgroundColor: getColor(worker.name) }]}>
              <Text style={styles.heroFallbackText}>{worker.name[0]?.toUpperCase()}</Text>
            </View>
          )}

          {/* Status-bar scrim so time/battery stay readable over the photo */}
          <HeroScrim height={insets.top + 46} />

          {/* Overlay controls */}
          <View style={[styles.heroTopBar, { top: insets.top + 8 }]}>
            <TouchableOpacity style={styles.heroCircleBtn} onPress={() => router.back()} hitSlop={8}>
              <MaterialCommunityIcons name="arrow-left" size={22} color="#111827" />
            </TouchableOpacity>
            <View style={styles.heroTopRight}>
              <TouchableOpacity style={styles.heroCircleBtn} onPress={handleToggleSave} hitSlop={8}>
                <MaterialCommunityIcons
                  name={isSaved ? "heart" : "heart-outline"}
                  size={21}
                  color={isSaved ? "#ef4444" : "#111827"}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.heroCircleBtn} onPress={handleShare} hitSlop={8}>
                <MaterialCommunityIcons name="dots-horizontal" size={22} color="#111827" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Verified badge on the seam */}
          <View style={styles.verifiedBadge}>
            <MaterialCommunityIcons name="check-decagram" size={26} color="#16a34a" />
          </View>
        </View>

        {/* ── Identity card (overlaps hero) ── */}
        <View style={styles.identityCard}>
          <Text style={styles.name}>{worker.name}</Text>
          <Text style={styles.subtitle}>
            {[categoryLabel, worker.experience > 0 ? `${worker.experience} yrs experience` : null]
              .filter(Boolean)
              .join(" · ")}
          </Text>

          <View style={styles.ratingRow}>
            <StarDisplay rating={worker.rating} size={17} />
            <Text style={styles.ratingValue}>{worker.rating > 0 ? worker.rating.toFixed(1) : "New"}</Text>
            {worker.totalJobs > 0 && (
              <Text style={styles.ratingJobs}>
                ·  {worker.totalJobs} job{worker.totalJobs !== 1 ? "s" : ""}
              </Text>
            )}
          </View>

          {/* Stat chips */}
          <View style={styles.chipsRow}>
            {worker.experience > 0 && (
              <View style={styles.statChip}>
                <MaterialCommunityIcons name="clock-outline" size={15} color="#374151" />
                <Text style={styles.statChipText}>{worker.experience} yrs exp</Text>
              </View>
            )}
            {(worker.city || worker.address) && (
              <View style={styles.statChip}>
                <MaterialCommunityIcons name="map-marker-outline" size={15} color="#374151" />
                <Text style={styles.statChipText} numberOfLines={1}>{worker.city ?? worker.address}</Text>
              </View>
            )}
            <View style={styles.statChip}>
              <MaterialCommunityIcons name="cash" size={16} color="#374151" />
              <Text style={styles.statChipText}>Rs {worker.dailyWage.toLocaleString("en-PK")}+</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.hireBtn, updating && styles.disabled]}
              onPress={handleHireNow}
              disabled={updating}
              activeOpacity={0.85}
            >
              {updating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.hireBtnText}>Hire Now</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chatBtn, startingChat && styles.disabled]}
              onPress={handleMessage}
              disabled={startingChat}
              activeOpacity={0.85}
            >
              {startingChat ? (
                <ActivityIndicator color="#16a34a" size="small" />
              ) : (
                <Text style={styles.chatBtnText}>Chat</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                gate(() => {
                  if (phone) {
                    Linking.openURL(`https://wa.me/${phone.replace(/\D/g, "")}`);
                  } else {
                    Alert.alert(
                      "No phone number",
                      "This worker hasn't added a phone number yet. Try messaging them instead.",
                    );
                  }
                }, "contact this worker on WhatsApp");
              }}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="whatsapp" size={22} color="#16a34a" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                gate(() => {
                  if (phone) {
                    Linking.openURL(`tel:${phone}`);
                  } else {
                    Alert.alert(
                      "No phone number",
                      "This worker hasn't added a phone number yet. Try messaging them instead.",
                    );
                  }
                }, "call this worker");
              }}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="phone-outline" size={21} color="#16a34a" />
            </TouchableOpacity>
          </View>

          {/* Application decision (when opened from an applicant) */}
          {hasApplication && (
            <View style={styles.decisionCard}>
              {applicationStatus === "accepted" ? (
                <View style={styles.decisionResult}>
                  <MaterialCommunityIcons name="check-circle" size={28} color="#16a34a" />
                  <Text style={[styles.decisionLabel, { color: "#16a34a" }]}>Worker Accepted</Text>
                  <Text style={styles.decisionSub}>Contact the worker to finalise the arrangement.</Text>
                </View>
              ) : applicationStatus === "rejected" ? (
                <View style={styles.decisionResult}>
                  <MaterialCommunityIcons name="close-circle" size={28} color="#ef4444" />
                  <Text style={[styles.decisionLabel, { color: "#ef4444" }]}>Application Rejected</Text>
                  <TouchableOpacity
                    style={styles.undoBtn}
                    onPress={() => handleUpdateApplication("accepted")}
                    disabled={updating}
                  >
                    <Text style={styles.undoBtnText}>Undo — Accept Instead</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.decisionBtns}>
                  <TouchableOpacity
                    style={[styles.rejectBtn, updating && styles.disabled]}
                    onPress={() =>
                      Alert.alert("Reject Application", `Reject ${worker.name}'s application?`, [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Reject",
                          style: "destructive",
                          onPress: () => handleUpdateApplication("rejected"),
                        },
                      ])
                    }
                    disabled={updating}
                  >
                    <Text style={styles.rejectBtnText}>✕  Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.acceptBtn, updating && styles.disabled]}
                    onPress={() => handleUpdateApplication("accepted")}
                    disabled={updating}
                  >
                    {updating ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.acceptBtnText}>✓  Accept Worker</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* ── Tabs ── */}
          <View style={styles.tabsRow}>
            {TABS.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={styles.tabItem}
                onPress={() => setActiveTab(t.key)}
                hitSlop={4}
              >
                <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>
                  {t.label}
                </Text>
                <View style={[styles.tabUnderline, activeTab === t.key && styles.tabUnderlineActive]} />
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Tab content ── */}
          {activeTab === "about" && (
            <View style={styles.tabContent}>
              {worker.bio ? (
                <Text style={styles.bio}>{worker.bio}</Text>
              ) : (
                <Text style={styles.emptyText}>No bio added yet.</Text>
              )}
              {(worker.categoryIds?.length ?? 0) > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={styles.blockTitle}>Services</Text>
                  {groupSubcategoriesByCategory(
                    worker.categoryIds ?? [],
                    worker.subcategoryIds ?? [],
                  ).map(({ category, subcategories }) => (
                    <View key={category.id} style={styles.catGroup}>
                      <Text style={styles.catGroupLabel}>
                        {category.icon}{"  "}{category.name}
                      </Text>
                      <View style={styles.skillsWrap}>
                        {subcategories.map((sub) => (
                          <View key={sub.id} style={styles.skillChip}>
                            <Text style={styles.skillChipText}>{sub.name}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              )}
              <View style={{ marginTop: 16 }}>
                <Text style={styles.blockTitle}>Daily Rate</Text>
                <Text style={styles.wageValue}>
                  {formatCurrency(worker.dailyWage)}
                  <Text style={styles.wagePer}>  / day</Text>
                </Text>
              </View>
            </View>
          )}

          {activeTab === "skills" && (
            <View style={styles.tabContent}>
              {groupSubcategoriesByCategory(worker.categoryIds ?? [], worker.subcategoryIds ?? [])
                .flatMap(({ subcategories }) => subcategories).length > 0 ? (
                <View style={styles.skillsWrap}>
                  {groupSubcategoriesByCategory(worker.categoryIds ?? [], worker.subcategoryIds ?? [])
                    .flatMap(({ subcategories }) => subcategories)
                    .map((sub) => (
                      <View key={sub.id} style={styles.skillChip}>
                        <Text style={styles.skillChipText}>{sub.name}</Text>
                      </View>
                    ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>No skills listed yet.</Text>
              )}

              {galleryPhotos.length > 0 && (
                <View style={{ marginTop: 20 }}>
                  <Text style={styles.galleryTitle}>Photo Gallery</Text>
                  <PhotoGrid photos={galleryPhotos} />
                </View>
              )}
            </View>
          )}

          {activeTab === "reviews" && (
            <View style={styles.tabContent}>
              {/* Review composer — clients who hired this worker */}
              {canReview && (
                <View style={styles.composerCard}>
                  <Text style={styles.blockTitle}>{myReview ? "Your Review" : "Rate this Worker"}</Text>
                  {myReview ? (
                    <View style={styles.myReviewCard}>
                      <StarDisplay rating={myReview.rating} size={22} />
                      {myReview.comment ? (
                        <Text style={styles.myReviewComment}>{myReview.comment}</Text>
                      ) : null}
                      <TouchableOpacity style={styles.undoBtn} onPress={() => setMyReview(null)}>
                        <Text style={styles.undoBtnText}>Edit Review</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View>
                      <StarPicker value={starDraft} onChange={setStarDraft} />
                      <TextInput
                        style={styles.commentInput}
                        placeholder="Leave a comment (optional)"
                        placeholderTextColor="#9ca3af"
                        value={commentDraft}
                        onChangeText={setCommentDraft}
                        multiline
                        maxLength={500}
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                      <TouchableOpacity
                        style={[
                          styles.submitReviewBtn,
                          (starDraft === 0 || submittingReview) && styles.disabled,
                        ]}
                        onPress={handleSubmitReview}
                        disabled={starDraft === 0 || submittingReview}
                      >
                        {submittingReview ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.submitReviewBtnText}>Submit Review</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {reviewsLoading ? (
                <ActivityIndicator color="#16a34a" style={{ marginVertical: 16 }} />
              ) : reviews.length === 0 ? (
                <Text style={styles.emptyText}>No reviews yet.</Text>
              ) : (
                reviews.map((review) => <ReviewCard key={review.id} review={review} />)
              )}
            </View>
          )}

          {activeTab === "gallery" && (
            <View style={styles.tabContent}>
              {galleryPhotos.length > 0 ? (
                <PhotoGrid photos={galleryPhotos} />
              ) : (
                <Text style={styles.emptyText}>No photos yet.</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PhotoGrid({ photos }: { photos: string[] }) {
  return (
    <View style={styles.galleryGrid}>
      {photos.map((uri, i) => (
        <Image key={`${uri}-${i}`} source={{ uri }} style={styles.galleryPhoto} />
      ))}
    </View>
  );
}

function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <MaterialCommunityIcons
          key={n}
          name={n <= Math.round(rating) ? "star" : "star-outline"}
          size={size}
          color={n <= Math.round(rating) ? "#f59e0b" : "#d1d5db"}
        />
      ))}
    </View>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={styles.starPicker}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={8}>
          <MaterialCommunityIcons
            name={n <= value ? "star" : "star-outline"}
            size={34}
            color={n <= value ? "#f59e0b" : "#d1d5db"}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const clientName = review.client?.clientProfile?.name ?? "Client";
  const pic = review.client?.clientProfile?.profilePicture;
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={[styles.reviewAvatar, { backgroundColor: getColor(clientName) }]}>
          {pic ? (
            <Image source={{ uri: pic }} style={styles.reviewAvatarImg} />
          ) : (
            <Text style={styles.reviewAvatarText}>{clientName[0]?.toUpperCase()}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reviewName}>{clientName}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <StarDisplay rating={review.rating} size={13} />
            <Text style={styles.reviewTime}>{timeAgo(review.createdAt)}</Text>
          </View>
        </View>
      </View>
      {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
    </View>
  );
}

function getColor(name: string): string {
  const palette = ["#16a34a", "#2563eb", "#9333ea", "#ea580c", "#0d9488"];
  return palette[name.charCodeAt(0) % palette.length];
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
    padding: 24,
  },
  errorTitle: { fontSize: 18, fontWeight: "600", color: "#374151", marginBottom: 16 },
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
  heroFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  heroFallbackText: { fontSize: 88, fontWeight: "700", color: "rgba(255,255,255,0.9)" },
  heroTopBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroTopRight: { flexDirection: "row", gap: 10 },
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
  verifiedBadge: {
    position: "absolute",
    right: 22,
    bottom: 34,
    zIndex: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 4,
  },

  // Identity card
  identityCard: {
    marginTop: -26,
    backgroundColor: "#fff",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  name: { fontSize: 26, fontWeight: "700", color: "#111827" },
  subtitle: { fontSize: 15, color: "#6b7280", marginTop: 3 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  ratingValue: { fontSize: 15, fontWeight: "600", color: "#111827" },
  ratingJobs: { fontSize: 14, color: "#6b7280" },

  chipsRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexShrink: 1,
  },
  statChipText: { fontSize: 13, color: "#374151", fontWeight: "500" },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 18 },
  hireBtn: {
    flex: 1.35,
    backgroundColor: "#16a34a",
    borderRadius: 14,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  hireBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  chatBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  chatBtnText: { color: "#111827", fontWeight: "600", fontSize: 16 },
  iconBtn: {
    width: 50,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },

  // Application decision
  decisionCard: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#f9fafb",
  },
  decisionBtns: { flexDirection: "row", gap: 10 },
  rejectBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#fca5a5",
    backgroundColor: "#fef2f2",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  rejectBtnText: { fontSize: 15, fontWeight: "700", color: "#ef4444" },
  acceptBtn: {
    flex: 2,
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  acceptBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  decisionResult: { alignItems: "center", paddingVertical: 6, gap: 6 },
  decisionLabel: { fontSize: 16, fontWeight: "700" },
  decisionSub: { fontSize: 13, color: "#6b7280", textAlign: "center" },
  undoBtn: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  undoBtnText: { fontSize: 13, color: "#374151", fontWeight: "500" },
  disabled: { opacity: 0.6 },

  // Tabs
  tabsRow: {
    flexDirection: "row",
    marginTop: 22,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    gap: 26,
  },
  tabItem: { alignItems: "center" },
  tabLabel: { fontSize: 15, fontWeight: "500", color: "#6b7280", paddingBottom: 10 },
  tabLabelActive: { color: "#16a34a", fontWeight: "700" },
  tabUnderline: { height: 2.5, alignSelf: "stretch", backgroundColor: "transparent", borderRadius: 2 },
  tabUnderlineActive: { backgroundColor: "#16a34a" },
  tabContent: { paddingTop: 18 },

  // About
  bio: { fontSize: 14.5, color: "#374151", lineHeight: 21 },
  blockTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 10 },
  catGroup: { marginBottom: 12 },
  catGroupLabel: { fontSize: 13.5, fontWeight: "600", color: "#374151", marginBottom: 8 },
  wageValue: { fontSize: 24, fontWeight: "700", color: "#15803d" },
  wagePer: { fontSize: 13, fontWeight: "500", color: "#6b7280" },

  // Skills
  skillsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  skillChip: {
    backgroundColor: "#f3f4f6",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  skillChipText: { fontSize: 14, color: "#111827", fontWeight: "500" },

  // Gallery
  galleryTitle: { fontSize: 17, fontWeight: "700", color: "#111827", marginBottom: 12 },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: GALLERY_GAP },
  galleryPhoto: {
    width: GALLERY_SIZE,
    height: GALLERY_SIZE,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
  },

  // Reviews
  composerCard: {
    borderWidth: 1,
    borderColor: "#f3f4f6",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    backgroundColor: "#f9fafb",
  },
  starPicker: { flexDirection: "row", gap: 8, marginBottom: 12 },
  commentInput: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    backgroundColor: "#fff",
    minHeight: 80,
    marginBottom: 12,
  },
  submitReviewBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitReviewBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  myReviewCard: { alignItems: "center", gap: 8, paddingVertical: 6 },
  myReviewComment: { fontSize: 14, color: "#374151", textAlign: "center", lineHeight: 20 },

  reviewCard: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  reviewAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  reviewAvatarImg: { width: 38, height: 38, borderRadius: 19 },
  reviewAvatarText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  reviewName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  reviewTime: { fontSize: 11, color: "#9ca3af" },
  reviewComment: { fontSize: 13.5, color: "#374151", lineHeight: 19, marginTop: 2 },

  emptyText: { fontSize: 14, color: "#9ca3af", paddingVertical: 8 },
});
