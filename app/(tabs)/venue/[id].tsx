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
import { useAuth } from "@/lib/auth/auth";
import { useLocalProfileLinkStore } from "@/lib/data/hooks/useLocalProfileLinkStore";
import { useProfileStore } from "@/lib/data/hooks/useProfileStore";
import Ionicons from "@expo/vector-icons/Ionicons";

type Venue = Database["public"]["Tables"]["venues"]["Row"];

// Default coordinates (Palo Alto, CA) used when venue location is unavailable
const DEFAULT_COORDINATES: [number, number] = [-122.143, 37.4419];

export default function VenueDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);

  // Profile data for setting default venue
  const { currentLink, loadLink } = useLocalProfileLinkStore();
  const { profiles, loadProfiles, upsertProfile } = useProfileStore();

  // Current user's profile
  const currentProfile = currentLink
    ? profiles.find((p) => p.id === currentLink.profile_id)
    : null;

  // Check if this venue is already the user's default
  const isDefaultVenue = currentProfile?.default_venue_id === id;

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

  // Load profile data on mount
  // Note: loadLink and loadProfiles are stable references from Zustand stores
  useEffect(() => {
    loadLink();
    loadProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadVenue();
    // Also refresh profile data to sync default venue state
    loadLink();
    loadProfiles();
  };

  // -------------------------------
  // Set as Default Venue Handler
  // -------------------------------
  const handleSetAsDefaultVenue = async () => {
    if (!currentProfile) {
      Alert.alert("Error", "No profile found. Please set up your profile first.");
      return;
    }

    if (isDefaultVenue) {
      // Already the default, remove it
      try {
        setSettingDefault(true);
        await upsertProfile({
          id: currentProfile.id,
          default_venue_id: null,
        });
        Alert.alert("Success", "Default venue removed.");
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Failed to remove default venue.";
        Alert.alert("Error", errorMessage);
      } finally {
        setSettingDefault(false);
      }
    } else {
      // Set this venue as default
      try {
        setSettingDefault(true);
        await upsertProfile({
          id: currentProfile.id,
          default_venue_id: id,
        });
        Alert.alert("Success", `${venue?.name} is now your default venue.`);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Failed to set default venue.";
        Alert.alert("Error", errorMessage);
      } finally {
        setSettingDefault(false);
      }
    }
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

  // Use generated columns for coordinates
  const lat = venue.lat ?? DEFAULT_COORDINATES[1];
  const lng = venue.lng ?? DEFAULT_COORDINATES[0];

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
        {/* Title Row */}
        <View style={styles.headerRow}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 8 }}>
              <Ionicons name="chevron-back" size={28} color="#2563EB" />
            </TouchableOpacity>
            <Text style={styles.title}>{venue.name}</Text>
          </View>
          {session?.user.id === venue.created_by && (
            <TouchableOpacity onPress={() => router.push(`/venue/${id}/edit`)}>
              <Ionicons name="create-outline" size={24} color="#2563EB" />
            </TouchableOpacity>
          )}
        </View>

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

        {/* Set as Default Venue Button */}
        {currentProfile && (
          <TouchableOpacity
            style={[
              styles.defaultVenueButton,
              isDefaultVenue && styles.defaultVenueButtonActive,
            ]}
            onPress={handleSetAsDefaultVenue}
            disabled={settingDefault}
          >
            {settingDefault ? (
              <ActivityIndicator size="small" color={isDefaultVenue ? "#2563EB" : "#fff"} />
            ) : (
              <>
                <Ionicons
                  name={isDefaultVenue ? "star" : "star-outline"}
                  size={20}
                  color={isDefaultVenue ? "#2563EB" : "#fff"}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.defaultVenueButtonText,
                    isDefaultVenue && styles.defaultVenueButtonTextActive,
                  ]}
                >
                  {isDefaultVenue ? "Default Venue" : "Set as Default Venue"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* View Leaderboard Button */}
        <TouchableOpacity
          style={styles.leaderboardButton}
          onPress={() => router.push(`/leaderboard?venueId=${id}`)}
        >
          <Ionicons
            name="trophy-outline"
            size={20}
            color="#fff"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.leaderboardButtonText}>View Leaderboard</Text>
        </TouchableOpacity>

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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    flex: 1, // Allow text to wrap if needed
    marginRight: 8,
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

  // Default Venue Button
  defaultVenueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
  },
  defaultVenueButtonActive: {
    backgroundColor: "#EFF6FF",
    borderWidth: 2,
    borderColor: "#2563EB",
  },
  defaultVenueButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  defaultVenueButtonTextActive: {
    color: "#2563EB",
  },

  // Leaderboard Button
  leaderboardButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F59E0B",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 12,
  },
  leaderboardButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

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
