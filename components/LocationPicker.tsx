import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as Location from "expo-location";

export interface LocationData {
  address: string;
  latitude: number;
  longitude: number;
}

interface Props {
  value?: LocationData;
  onConfirm: (data: LocationData) => void;
}

export function LocationPicker({ value, onConfirm }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleGetLocation() {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission required",
          "Allow location access to automatically fill your address.",
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = loc.coords;

      let address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      try {
        const results = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (results.length > 0) {
          const r = results[0];
          const parts = [r.street, r.district, r.city, r.region].filter(Boolean);
          if (parts.length > 0) address = parts.join(", ");
        }
      } catch {
        // keep coordinate string as fallback
      }

      onConfirm({ address, latitude, longitude });
    } catch (e: unknown) {
      Alert.alert(
        "Location error",
        e instanceof Error ? e.message : "Could not get current location.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {value ? (
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.pin}>📍</Text>
            <View style={styles.cardText}>
              <Text style={styles.address} numberOfLines={2}>
                {value.address}
              </Text>
              <Text style={styles.coords}>
                {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.btn, loading && styles.disabled]}
        onPress={handleGetLocation}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.btnText}>
            {value ? "Update Location" : "Use Current Location"}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  card: {
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: 12,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  pin: { fontSize: 18, lineHeight: 22 },
  cardText: { flex: 1 },
  address: {
    fontSize: 14,
    color: "#15803d",
    fontWeight: "600",
    lineHeight: 20,
  },
  coords: {
    fontSize: 11,
    color: "#6b7280",
    marginTop: 2,
  },
  btn: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  disabled: {
    opacity: 0.6,
  },
});
