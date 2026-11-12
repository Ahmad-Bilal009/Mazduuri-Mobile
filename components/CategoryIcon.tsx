import { View, StyleSheet } from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { categoryVisual } from "@/lib/categoryIcons";

/**
 * A category's icon on its own coloured tile. Use this everywhere a service is
 * shown so the same trade always has the same look.
 */
export function CategoryIcon({ id, size = 52 }: { id?: string; size?: number }) {
  const v = categoryVisual(id);
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size * 0.32, backgroundColor: v.bg },
      ]}
    >
      {/* Soft highlight in the top-left gives the flat tile a little depth. */}
      <View
        style={[
          styles.shine,
          { width: size * 0.9, height: size * 0.9, borderRadius: size * 0.45, top: -size * 0.38, left: -size * 0.3 },
        ]}
      />
      <MaterialCommunityIcons name={v.icon} size={Math.round(size * 0.5)} color={v.fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  shine: { position: "absolute", backgroundColor: "rgba(255,255,255,0.45)" },
});
