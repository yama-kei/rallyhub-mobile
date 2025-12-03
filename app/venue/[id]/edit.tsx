import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase/supabaseClient";
import type { Database } from "@/lib/supabase/types";

type Venue = Database["public"]["Tables"]["venues"]["Row"];

export default function EditVenueScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [numCourts, setNumCourts] = useState("");
  const [surface, setSurface] = useState("");
  const [indoor, setIndoor] = useState(false);
  const [lighting, setLighting] = useState(false);

  // -----------------------------
  // Load venue
  // -----------------------------
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

      const venueData = data as Venue;
      setVenue(venueData);

      // Prefill form
      setName(venueData.name);
      setAddress(venueData.address ?? "");
      setNumCourts(venueData.num_courts?.toString() ?? "");
      setSurface(venueData.surface ?? "");
      setIndoor(venueData.indoor ?? false);
      setLighting(venueData.lighting ?? false);

      const geom = venueData.geom as { coordinates?: [number, number] } | null;
      const [lng, lat] = geom?.coordinates ?? [null, null];

      setLatitude(lat !== null ? String(lat) : "");
      setLongitude(lng !== null ? String(lng) : "");
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to load venue.";
      Alert.alert("Error", message);
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

  // -----------------------------
  // Save changes
  // -----------------------------
  const handleSubmit = async () => {
    if (!venue) return;
    if (!name) return Alert.alert("Name required", "Venue name cannot be empty.");
    if (!latitude || !longitude)
      return Alert.alert("Location required", "Venue must have coordinates.");

    try {
      setSubmitting(true);

      const lat = Number(latitude);
      const lng = Number(longitude);

      if (isNaN(lat) || isNaN(lng)) {
        Alert.alert("Invalid Coordinates", "Latitude and longitude must be numbers.");
        return;
      }

      // Use RPC function to update venue with PostGIS geometry
      // Type assertion needed due to Supabase RPC type inference limitations
      const { error } = await supabase.rpc(
        "rpc_update_venue" as never,
        {
          p_venue_id: venue.id,
          p_name: name,
          p_address: address || null,
          p_lat: lat,
          p_lng: lng,
          p_num_courts: numCourts ? Number(numCourts) : null,
          p_surface: surface || null,
          p_indoor: indoor,
          p_lighting: lighting,
        } as never
      );

      if (error) throw error;

      Alert.alert("Success", "Venue updated successfully.");
      router.replace(`/venue/${venue.id}`);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to update venue.";
      Alert.alert("Error", message);
    } finally {
      setSubmitting(false);
    }
  };

  // -----------------------------
  // Select new location
  // -----------------------------
  const openMapPicker = () => {
    router.push({
      pathname: "/venue/map-picker",
      params: { returnTo: `/venue/${id}/edit` },
    });
  };

  // If Map Picker prefilled new params
  const { name: pName, address: pAddress, latitude: pLat, longitude: pLng } =
    useLocalSearchParams<{
      name?: string;
      address?: string;
      latitude?: string;
      longitude?: string;
    }>();

  useEffect(() => {
    if (pName) setName(pName);
    if (pAddress) setAddress(pAddress);
    if (pLat) setLatitude(pLat);
    if (pLng) setLongitude(pLng);
  }, [pName, pAddress, pLat, pLng]);

  if (loading || !venue) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.form}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>Edit Venue</Text>

        {/* Name */}
        <Text style={styles.label}>Venue Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Venue name"
        />

        {/* Address */}
        <Text style={styles.label}>Address</Text>
        <TextInput
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          placeholder="Address"
        />

        {/* Map Picker */}
        <TouchableOpacity style={styles.mapButton} onPress={openMapPicker}>
          <Text style={styles.mapButtonText}>Select New Location on Map</Text>
        </TouchableOpacity>

        {/* Coordinates */}
        <Text style={styles.label}>Latitude</Text>
        <TextInput
          style={styles.input}
          value={latitude}
          onChangeText={setLatitude}
          keyboardType="numeric"
        />

        <Text style={styles.label}>Longitude</Text>
        <TextInput
          style={styles.input}
          value={longitude}
          onChangeText={setLongitude}
          keyboardType="numeric"
        />

        {/* Optional fields */}
        <Text style={styles.label}>Number of Courts</Text>
        <TextInput
          style={styles.input}
          value={numCourts}
          onChangeText={setNumCourts}
          keyboardType="numeric"
          placeholder="e.g., 4"
        />



        {/* Toggles */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggle, indoor && styles.toggleActive]}
            onPress={() => setIndoor(!indoor)}
          >
            <Text style={[styles.toggleText, !indoor && styles.toggleTextInactive]}>Indoor</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggle, lighting && styles.toggleActive]}
            onPress={() => setLighting(!lighting)}
          >
            <Text style={[styles.toggleText, !lighting && styles.toggleTextInactive]}>Lighting</Text>
          </TouchableOpacity>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitText}>
            {submitting ? "Saving…" : "Save Changes"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// -----------------------------
// Styles
// -----------------------------
const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  form: { padding: 16 },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 20,
  },
  label: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 16,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  mapButton: {
    marginTop: 12,
    backgroundColor: "#2563EB",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  mapButtonText: {
    color: "white",
    fontWeight: "600",
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  toggle: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
  },
  toggleActive: {
    backgroundColor: "#2563EB",
  },
  toggleText: {
    color: "white",
    fontWeight: "600",
  },
  toggleTextInactive: {
    color: "#374151",
  },
  submitButton: {
    marginTop: 24,
    backgroundColor: "#10B981",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.6 },
  submitText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
});
