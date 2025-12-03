import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Alert,
  Platform,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "@/components/NativeMap";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase/supabaseClient";
import type { Database } from "@/lib/supabase/types";

type Venue = Database["public"]["Tables"]["venues"]["Row"];

// Default coordinates (Palo Alto, CA) used when venue location is unavailable
const DEFAULT_COORDINATES: [number, number] = [-122.143, 37.4419];

export default function VenueDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // -------------------------------
  // Load Venue Data
  // -------------------------------
  const loadVenue = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setVenue(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load venue.";
      console.error(err);
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadVenue();
  }, [loadVenue]);

  const onRefresh = () => {
    setRefreshing(true);
    loadVenue();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (!venue) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={{ fontSize: 16 }}>Venue not found.</Text>
      </SafeAreaView>
    );
  }

  // Parse coordinates (PostGIS)
  const geom = venue.geom as { coordinates?: [number, number] } | null;
  const [lng, lat] = geom?.coordinates ?? DEFAULT_COORDINATES;

  // Open external maps
  const openInMaps = async () => {
    const url = Platform.select({
      ios: `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(
        venue.name
      )}`,
      android: `geo:${lat},${lng}?q=${encodeURIComponent(venue.name)}`,
      default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    });
    if (url) {
      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          Alert.alert("Error", "Unable to open maps application.");
        }
      } catch (err) {
        console.error("Failed to open maps:", err);
        Alert.alert("Error", "Failed to open maps application.");
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Title */}
        <Text style={styles.title}>{venue.name}</Text>

        {/* Address */}
        <Text style={styles.address}>
          {venue.address || "No address provided"}
        </Text>

        {/* Map Preview */}
        <TouchableOpacity style={styles.mapContainer} onPress={openInMaps}>
          <MapView
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: lat,
              longitude: lng,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
          >
            <Marker coordinate={{ latitude: lat, longitude: lng }} />
          </MapView>
          <View style={styles.openMapsBadge}>
            <Text style={styles.openMapsText}>Open in Maps</Text>
          </View>
        </TouchableOpacity>

        {/* Metadata */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Venue Details</Text>

          <DetailRow
            label="Number of Courts"
            value={venue.num_courts ?? "Unknown"}
          />
          <DetailRow label="Indoor" value={venue.indoor ? "Yes" : "No"} />
          <DetailRow label="Lighting" value={venue.lighting ? "Yes" : "No"} />

          <DetailRow label="Source" value={venue.source ?? "user"} />
          <DetailRow label="Status" value={venue.status ?? "approved"} />
        </View>

        {/* Created by */}
        {venue.created_by && (
          <TouchableOpacity
            onPress={() => router.push(`/player-detail/${venue.created_by}`)}
            style={styles.creatorBox}
          >
            <Text style={styles.creatorText}>
              Created by: {venue.created_by}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ----------------------------------------
// Detail Row Component
// ----------------------------------------
function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}:</Text>
      <Text style={styles.detailValue}>{String(value)}</Text>
    </View>
  );
}

// ----------------------------------------
// Styles
// ----------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Title
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 6,
  },
  address: {
    fontSize: 16,
    color: "#555",
    marginBottom: 16,
  },

  // Map
  mapContainer: {
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    position: "relative",
  },
  map: { flex: 1 },
  openMapsBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  openMapsText: { color: "white", fontSize: 13 },

  // Detail section
  section: { marginTop: 12 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 10,
  },

  detailRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  detailLabel: {
    width: 150,
    fontWeight: "600",
  },
  detailValue: { flex: 1 },

  // Creator
  creatorBox: {
    marginTop: 20,
    paddingVertical: 10,
  },
  creatorText: {
    color: "#2563EB",
    fontSize: 15,
  },
});
