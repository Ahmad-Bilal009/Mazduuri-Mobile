import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  FlatList,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { Platform } from "react-native";
import * as Location from "expo-location";
import { SafeAreaView } from "react-native-safe-area-context";

export interface LocationData {
  address?: string;
  city?: string;
  latitude: number;
  longitude: number;
}

interface MapLocationPickerProps {
  visible: boolean;
  onLocationSelected: (location: LocationData) => void;
  onCancel: () => void;
  initialLocation?: LocationData;
  title?: string;
}

export function MapLocationPicker({
  visible,
  onLocationSelected,
  onCancel,
  initialLocation,
  title = "Select Location",
}: MapLocationPickerProps) {
  const [region, setRegion] = useState(
    initialLocation
      ? {
          latitude: initialLocation.latitude,
          longitude: initialLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }
      : {
          latitude: 31.5204,
          longitude: 74.3587,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }
  );
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(
    initialLocation || null
  );
  const [address, setAddress] = useState<string>(initialLocation?.address || "");
  const [loading, setLoading] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ address: string; latitude: number; longitude: number }>
  >([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Get current location on mount
  useEffect(() => {
    if (visible && !selectedLocation) {
      getCurrentLocation();
    }
  }, [visible]);

  const getCurrentLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;
        setSelectedLocation({ latitude, longitude });
        setRegion({
          latitude,
          longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
        // Get address from coordinates
        await reverseGeocode(latitude, longitude);
      }
    } catch (error) {
      console.error("Error getting location:", error);
    } finally {
      setLoading(false);
    }
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    setLoadingAddress(true);
    try {
      const addresses = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      if (addresses.length > 0) {
        const addr: any = addresses[0];
        const fullAddress = [addr.street, addr.city, addr.region]
          .filter(Boolean)
          .join(", ");
        setAddress(fullAddress);
        // Update selectedLocation with city
        if (selectedLocation) {
          setSelectedLocation({
            ...selectedLocation,
            city: addr.city || addr.region || "",
          });
        }
      } else {
        setAddress("");
      }
    } catch (error) {
      console.error("Error reverse geocoding:", error);
      setAddress("");
    } finally {
      setLoadingAddress(false);
    }
  };

  const handleMapPress = async (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude, address: "" });
    await reverseGeocode(latitude, longitude);
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);

    // Clear previous timeout
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (text.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    // Debounce search
    searchTimeout.current = setTimeout(() => {
      performSearch(text);
    }, 500);
  };

  const performSearch = async (query: string) => {
    setSearchLoading(true);
    try {
      const results = await Location.geocodeAsync(query);
      const formatted = results.map((result: any) => {
        const fullAddress = [
          result.street,
          result.city,
          result.region,
          result.country,
        ]
          .filter(Boolean)
          .join(", ");
        return {
          address: fullAddress || query,
          latitude: result.latitude,
          longitude: result.longitude,
        };
      });
      setSearchResults(formatted);
    } catch (error) {
      console.error("Error searching location:", error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectSearchResult = async (
    result: (typeof searchResults)[0]
  ) => {
    // Extract city from address if possible
    const addressParts = result.address.split(", ");
    const city = addressParts.length > 1 ? addressParts[addressParts.length - 2] : addressParts[0];
    
    setSelectedLocation({
      ...result,
      city,
    });
    setAddress(result.address);
    setSearchResults([]);
    setSearchQuery("");
    setRegion({
      latitude: result.latitude,
      longitude: result.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    });
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onLocationSelected({
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        address: address || undefined,
        city: selectedLocation.city || undefined,
      });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel}>
            <Text style={styles.cancelBtn}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <View style={{ width: 30 }} />
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search for location..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={handleSearchChange}
              editable={!loading}
            />
            {searchLoading && (
              <ActivityIndicator color="#16a34a" size="small" />
            )}
          </View>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <View style={styles.resultsContainer}>
              <FlatList
                data={searchResults}
                keyExtractor={(_, index) => index.toString()}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.resultItem}
                    onPress={() => handleSelectSearchResult(item)}
                  >
                    <MaterialCommunityIcons name="map-marker" size={16} color="#6b7280" />
                    <Text style={styles.resultItemText}>{item.address}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#16a34a" />
              <Text style={styles.loadingText}>Getting your location...</Text>
            </View>
          ) : (
            <>
              <MapView
                style={styles.map}
                provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
                region={region}
                onRegionChange={setRegion}
                onPress={handleMapPress}
              >
                {selectedLocation && (
                  <Marker
                    coordinate={selectedLocation}
                    draggable
                    onDragEnd={(e) => {
                      const { latitude, longitude } = e.nativeEvent.coordinate;
                      setSelectedLocation({ latitude, longitude });
                      reverseGeocode(latitude, longitude);
                    }}
                  >
                    <View style={styles.markerContainer}>
                      <View style={styles.marker} />
                    </View>
                  </Marker>
                )}
              </MapView>

              {/* Center button */}
              <TouchableOpacity
                style={styles.centerBtn}
                onPress={() => {
                  if (selectedLocation) {
                    setRegion({
                      latitude: selectedLocation.latitude,
                      longitude: selectedLocation.longitude,
                      latitudeDelta: 0.05,
                      longitudeDelta: 0.05,
                    });
                  }
                }}
              >
                <MaterialCommunityIcons name="map-marker" size={20} color="#16a34a" />
              </TouchableOpacity>

              {/* Current location button */}
              <TouchableOpacity
                style={styles.currentLocationBtn}
                onPress={getCurrentLocation}
              >
                <Text style={styles.currentLocationBtnText}>📌 Current</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Location details */}
        <View style={styles.detailsContainer}>
          <View style={styles.locationInfo}>
            <Text style={styles.locationLabel}>Selected Location</Text>
            {loadingAddress ? (
              <ActivityIndicator
                color="#16a34a"
                size="small"
                style={{ marginVertical: 8 }}
              />
            ) : (
              <>
                {address && <Text style={styles.address}>{address}</Text>}
                {selectedLocation && (
                  <View style={styles.coordinatesRow}>
                    <MaterialCommunityIcons name="map-marker" size={13} color="#6b7280" />
                    <Text style={styles.coordinates}>
                      {selectedLocation.latitude.toFixed(5)}, {selectedLocation.longitude.toFixed(5)}
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Action buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                !selectedLocation && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!selectedLocation}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  cancelBtn: {
    fontSize: 20,
    color: "#6b7280",
    fontWeight: "600",
  },
  mapContainer: {
    flex: 1,
    position: "relative",
    marginBottom: 12,
  },
  map: { flex: 1 },
  searchContainer: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    marginRight: 8,
  },
  resultsContainer: {
    position: "absolute",
    top: 56,
    left: 12,
    right: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    maxHeight: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 9,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  resultItemIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  resultItemText: {
    flex: 1,
    fontSize: 13,
    color: "#111827",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#6b7280",
  },
  markerContainer: {
    alignItems: "center",
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#16a34a",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  centerBtn: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  centerBtnText: { fontSize: 20 },
  currentLocationBtn: {
    position: "absolute",
    bottom: 16,
    left: 16,
    backgroundColor: "#16a34a",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  currentLocationBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  detailsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  locationInfo: {
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#dcfce7",
  },
  locationLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 6,
  },
  address: {
    fontSize: 14,
    fontWeight: "600",
    color: "#15803d",
    marginBottom: 6,
  },
  coordinatesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  coordinates: {
    fontSize: 12,
    color: "#6b7280",
  },
  buttonsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  confirmButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "#16a34a",
    paddingVertical: 12,
    alignItems: "center",
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
