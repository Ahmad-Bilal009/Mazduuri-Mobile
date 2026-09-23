import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Dimensions,
} from "react-native";
import { useState, useMemo } from "react";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { getAllCategories, type Category } from "@/lib/categories";

const MAX_MULTI = 5;
const SCREEN_H = Dimensions.get("window").height;

interface Props {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  singleSelect?: boolean;
  accentColor?: string;
  placeholder?: string;
}

export function CategorySelector({
  selectedIds,
  onChange,
  singleSelect,
  accentColor = "#16a34a",
  placeholder,
}: Props) {
  const MAX = singleSelect ? 1 : MAX_MULTI;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const all = getAllCategories();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
  }, [all, query]);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((i) => i !== id));
    } else if (singleSelect) {
      onChange([id]);
      setOpen(false);
    } else if (selectedIds.length >= MAX) {
      // already at limit — ignore
      return;
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function remove(id: string) {
    onChange(selectedIds.filter((i) => i !== id));
  }

  const selectedCategories = all.filter((c) => selectedIds.includes(c.id));
  const atLimit = !singleSelect && selectedIds.length >= MAX;

  const defaultPlaceholder = singleSelect
    ? "Select category"
    : `Select up to ${MAX} categories`;

  const renderItem = ({ item: cat }: { item: Category }) => {
    const selected = selectedIds.includes(cat.id);
    const disabled = atLimit && !selected;
    return (
      <TouchableOpacity
        style={[styles.listItem, disabled && styles.listItemDisabled]}
        onPress={() => toggle(cat.id)}
        activeOpacity={0.6}
        disabled={disabled}
      >
        <Text style={styles.listItemIcon}>{cat.icon}</Text>
        <Text
          style={[styles.listItemLabel, selected && { color: accentColor, fontWeight: "700" }]}
          numberOfLines={1}
        >
          {cat.name}
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
        {selectedCategories.length === 0 ? (
          <Text style={styles.triggerPlaceholder}>{placeholder ?? defaultPlaceholder}</Text>
        ) : (
          <View style={styles.chipRow}>
            {selectedCategories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.chip, { borderColor: accentColor + "60", backgroundColor: accentColor + "12" }]}
                onPress={() => remove(cat.id)}
                hitSlop={4}
              >
                <Text style={styles.chipIcon}>{cat.icon}</Text>
                <Text style={[styles.chipText, { color: accentColor }]} numberOfLines={1}>
                  {cat.name}
                </Text>
                <MaterialCommunityIcons name="close" size={12} color={accentColor} />
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
          <View style={[styles.sheet, { maxHeight: SCREEN_H * 0.75 }]}>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>
                {singleSelect ? "Select Category" : `Select Categories (max ${MAX})`}
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
                placeholder="Search categories..."
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

            {/* List */}
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 16 }}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>No categories found</Text>
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
  triggerPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: "#9ca3af",
  },
  chipRow: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    maxWidth: 160,
  },
  chipIcon: { fontSize: 12 },
  chipText: { fontSize: 12, fontWeight: "600", flexShrink: 1 },

  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheetWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
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

  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#f9fafb",
    gap: 10,
  },
  listItemDisabled: { opacity: 0.38 },
  listItemIcon: { fontSize: 20, width: 28, textAlign: "center" },
  listItemLabel: { flex: 1, fontSize: 14, color: "#374151", fontWeight: "500" },
  unchecked: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#d1d5db",
  },

  emptyWrap: { paddingVertical: 32, alignItems: "center" },
  emptyText: { fontSize: 14, color: "#9ca3af" },

  doneBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
