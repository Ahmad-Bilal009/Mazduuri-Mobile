import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { workersApi } from "@/lib/api";
import { getAllCategories } from "@/lib/categories";
import { WorkerDetailCard } from "@/components/WorkerDetailCard";
import { CategorySelector } from "@/components/CategorySelector";
import { SubcategorySelector } from "@/components/SubcategorySelector";
import { BackButton } from "@/components/BackButton";
import type { WorkerProfile } from "@/types";

interface AppliedFilters {
  categoryIds: string[];
  subcategoryIds: string[];
}

const EMPTY_FILTERS: AppliedFilters = { categoryIds: [], subcategoryIds: [] };

export default function WorkersListScreen() {
  const router = useRouter();
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>(EMPTY_FILTERS);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftCategoryIds, setDraftCategoryIds] = useState<string[]>([]);
  const [draftSubcategoryIds, setDraftSubcategoryIds] = useState<string[]>([]);

  const activeFilterCount =
    appliedFilters.categoryIds.length + appliedFilters.subcategoryIds.length;

  const fetchWorkers = useCallback(
    async (pg = 1, append = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await workersApi.list({
          city: search || undefined,
          categoryIds: appliedFilters.categoryIds.length ? appliedFilters.categoryIds : undefined,
          subcategoryIds: appliedFilters.subcategoryIds.length ? appliedFilters.subcategoryIds : undefined,
          page: pg,
        });
        if (append) setWorkers((prev) => [...prev, ...res.data]);
        else setWorkers(res.data);
        setHasMore(res.hasMore);
        setPage(pg);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load workers");
      } finally {
        setLoading(false);
      }
    },
    [search, appliedFilters],
  );

  useEffect(() => {
    fetchWorkers(1);
  }, [fetchWorkers]);

  function openFilterModal() {
    setDraftCategoryIds(appliedFilters.categoryIds);
    setDraftSubcategoryIds(appliedFilters.subcategoryIds);
    setFilterModalVisible(true);
  }

  function handleDraftCategoryChange(ids: string[]) {
    setDraftCategoryIds(ids);
    const allCats = getAllCategories();
    setDraftSubcategoryIds((prev) =>
      prev.filter((subId) =>
        allCats.some(
          (c) => ids.includes(c.id) && c.subcategories.some((s) => s.id === subId),
        ),
      ),
    );
  }

  function applyFilters() {
    setAppliedFilters({ categoryIds: draftCategoryIds, subcategoryIds: draftSubcategoryIds });
    setFilterModalVisible(false);
  }

  function clearFilters() {
    setDraftCategoryIds([]);
    setDraftSubcategoryIds([]);
    setAppliedFilters(EMPTY_FILTERS);
    setFilterModalVisible(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.topRow}>
        <BackButton />
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by city..."
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => fetchWorkers(1)}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Text style={{ color: "#9ca3af", fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={openFilterModal}
        >
          <Text style={[styles.filterBtnText, activeFilterCount > 0 && styles.filterBtnTextActive]}>
            {activeFilterCount > 0 ? `Filter (${activeFilterCount})` : "Filter"}
          </Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchWorkers(1)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={workers}
          keyExtractor={(w) => w.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <WorkerDetailCard
              worker={item}
              onPress={() => router.push(`/workers/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.empty}>
                <Text style={{ fontSize: 40 }}>👷</Text>
                <Text style={styles.emptyTitle}>No workers found</Text>
                <Text style={styles.emptyDesc}>Try adjusting your filters or city</Text>
              </View>
            )
          }
          ListFooterComponent={
            loading ? (
              <ActivityIndicator color="#16a34a" style={{ marginVertical: 20 }} />
            ) : hasMore ? (
              <TouchableOpacity style={styles.loadMore} onPress={() => fetchWorkers(page + 1, true)}>
                <Text style={styles.loadMoreText}>Load More</Text>
              </TouchableOpacity>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={filterModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Workers</Text>
            <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.filterLabel}>Categories</Text>
            <CategorySelector selectedIds={draftCategoryIds} onChange={handleDraftCategoryChange} />
            {draftCategoryIds.length > 0 && (
              <>
                <Text style={styles.filterLabel}>Specializations</Text>
                <SubcategorySelector
                  categoryIds={draftCategoryIds}
                  selectedIds={draftSubcategoryIds}
                  onChange={setDraftSubcategoryIds}
                />
              </>
            )}
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
              <Text style={styles.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 8,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, color: "#111827" },
  filterBtn: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  filterBtnActive: { backgroundColor: "#f0fdf4", borderColor: "#16a34a" },
  filterBtnText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  filterBtnTextActive: { color: "#16a34a" },
  list: { paddingHorizontal: 12, paddingBottom: 40 },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#374151" },
  emptyDesc: { fontSize: 13, color: "#9ca3af" },
  loadMore: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginVertical: 8,
  },
  loadMoreText: { color: "#374151", fontWeight: "600", fontSize: 14 },
  errorBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  errorText: { fontSize: 14, color: "#ef4444", textAlign: "center" },
  retryBtn: { backgroundColor: "#16a34a", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  modalSafe: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  modalClose: { fontSize: 20, color: "#6b7280" },
  modalContent: { padding: 20, gap: 4 },
  filterLabel: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 8, marginTop: 14 },
  modalFooter: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    backgroundColor: "#fff",
  },
  clearBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  clearBtnText: { color: "#374151", fontWeight: "600", fontSize: 14 },
  applyBtn: { flex: 2, borderRadius: 12, paddingVertical: 13, alignItems: "center", backgroundColor: "#16a34a" },
  applyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
