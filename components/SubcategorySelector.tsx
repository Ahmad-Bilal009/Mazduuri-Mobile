import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  SectionList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Dimensions,
} from "react-native";
import { useState, useMemo } from "react";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { getAllCategories, type Subcategory } from "@/lib/categories";

const MAX_MULTI = 15;
const SCREEN_H = Dimensions.get("window").height;

interface Props {
  categoryIds: string[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  singleSelect?: boolean;
  accentColor?: string;
}

export function SubcategorySelector({
  categoryIds,
  selectedIds,
  onChange,
  singleSelect,
  accentColor = "#16a34a",
}: Props) {
  const MAX = singleSelect ? 1 : MAX_MULTI;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const allCategories = getAllCategories();

  // Build section data from selected parent categories
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allCategories
      .filter((c) => categoryIds.includes(c.id))
      .map((c) => ({
        category: c,
        data: q
          ? c.subcategories.filter((s) => s.name.toLowerCase().includes(q))
          : c.subcategories,
      }))
      .filter((s) => s.data.length > 0);
  }, [allCategories, categoryIds, query]);

  const allSubs = useMemo(
    () =>
      allCategories
        .filter((c) => categoryIds.includes(c.id))
        .flatMap((c) => c.subcategories),
    [allCategories, categoryIds],
  );

  const selectedSubs = allSubs.filter((s) => selectedIds.includes(s.id));
  const atLimit = !singleSelect && selectedIds.length >= MAX;

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else if (singleSelect) {
      onChange([id]);
      setOpen(false);
    } else if (selectedIds.length >= MAX) {
      return;
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function remove(id: string) {
    onChange(selectedIds.filter((i) => i !== id));
  }

  // No categories selected state
  if (categoryIds.length === 0) {
    return (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons name="tag-off-outline" size={16} color="#d1d5db" />
        <Text style={styles.emptyStateText}>Please select a category first</Text>
      </View>
    );
  }

  const renderSectionHeader = ({
    section,
  }: {
    section: { category: { icon: string; name: string }; data: Subcategory[] };
  }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>
        {section.category.icon}{"  "}{section.category.name}
      </Text>
    </View>
  );

  const renderItem = ({ item: sub }: { item: Subcategory }) => {
    const selected = selectedIds.includes(sub.id);
    const disabled = atLimit && !selected;
    return (
      <TouchableOpacity
        style={[styles.listItem, disabled && styles.listItemDisabled]}
        onPress={() => toggle(sub.id)}
        activeOpacity={0.6}
        disabled={disabled}
      >
        <Text
          style={[styles.listItemLabel, selected && { color: accentColor, fontWeight: "700" }]}
          numberOfLines={1}
        >
          {sub.name}
        </Text>
        {selected ? (
          <MaterialCommunityIcons name="check-circle" size={20} color={accentColor} />
        ) : (
          <View style={[styles.unchecked, disabled && { borderColor: "#d1d5db" }]} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      {/* Trigger */}
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        {selectedSubs.length === 0 ? (
          <Text style={styles.triggerPlaceholder}>
            {singleSelect ? "Select specialization" : `Select up to ${MAX} specializations`}
          </Text>
        ) : (
          <View style={styles.chipRow}>
            {selectedSubs.map((sub) => (
              <TouchableOpacity
                key={sub.id}
                style={[styles.chip, { borderColor: accentColor + "60", backgroundColor: accentColor + "12" }]}
                onPress={() => remove(sub.id)}
                hitSlop={4}
              >
                <Text style={[styles.chipText, { color: accentColor }]} numberOfLines={1}>
                  {sub.name}
                </Text>
                <MaterialCommunityIcons name="close" size={11} color={accentColor} />
              </TouchableOpacity>
            ))}
          </View>
        )}
        <MaterialCommunityIcons
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color="#9ca3af"
          style={{ marginLeft: 4 }}
        />
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={open} animationType="slide" transparent statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheetWrap}
        >
          <View style={[styles.sheet, { maxHeight: SCREEN_H * 0.8 }]}>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {singleSelect ? "Select Specialization" : `Specializations (max ${MAX})`}
              </Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchWrap}>
              <MaterialCommunityIcons name="magnify" size={18} color="#9ca3af" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search specializations..."
                placeholderTextColor="#9ca3af"
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {query.length > 0 && Platform.OS !== "ios" && (
                <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                  <MaterialCommunityIcons name="close-circle" size={16} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>

            {/* Limit badge */}
            {!singleSelect && (
              <View style={styles.limitRow}>
                <Text style={styles.limitText}>
                  {selectedIds.length}/{MAX} selected
                  {atLimit ? " — limit reached" : ""}
                </Text>
              </View>
            )}

            {/* Section list */}
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              renderSectionHeader={renderSectionHeader}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 16 }}
              stickySectionHeadersEnabled={false}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>
                    {query ? "No specializations found" : "No subcategories available"}
                  </Text>
                </View>
              }
            />

            {/* Done */}
            {!singleSelect && (
              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: accentColor }]}
                onPress={() => setOpen(false)}
              >
                <Text style={styles.doneBtnText}>
                  Done ({selectedIds.length} selected)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // No-category state
  emptyState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f9fafb",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  emptyStateText: { fontSize: 14, color: "#9ca3af", fontStyle: "italic" },

  // Trigger
  trigger: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    gap: 4,
  },
  triggerPlaceholder: { flex: 1, fontSize: 14, color: "#9ca3af" },
  chipRow: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 180,
  },
  chipText: { fontSize: 12, fontWeight: "600", flexShrink: 1 },

  // Modal
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheetWrap: { position: "absolute", bottom: 0, left: 0, right: 0 },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#d1d5db",
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#111827", paddingVertical: 0 },

  limitRow: { marginBottom: 4, paddingHorizontal: 2 },
  limitText: { fontSize: 12, color: "#9ca3af", fontWeight: "500" },

  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 2,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  sectionHeaderText: { fontSize: 12, fontWeight: "700", color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 },

  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f9fafb",
    gap: 10,
  },
  listItemDisabled: { opacity: 0.38 },
  listItemLabel: { flex: 1, fontSize: 14, color: "#374151", fontWeight: "500" },
  unchecked: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#d1d5db" },

  emptyWrap: { paddingVertical: 32, alignItems: "center" },
  emptyText: { fontSize: 14, color: "#9ca3af" },

  doneBtn: { borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
