import { View } from "react-native";

// Layered top fade (no gradient dependency) so status-bar content stays
// legible over full-bleed hero photos.
export function HeroScrim({ height }: { height: number }) {
  const layers = [0.28, 0.2, 0.13, 0.07, 0.03];
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height }}>
      {layers.map((opacity, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: "#000", opacity }} />
      ))}
    </View>
  );
}
