import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  TouchableOpacity,
  View,
  Text,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase/supabaseClient";
import type { Database } from "@/lib/supabase/types";
import { VenueForm, VenueFormValues } from "@/components/VenueForm";

type Venue = Database["public"]["Tables"]["venues"]["Row"];

export default function EditVenueScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [venue, setVenue] = useState<Venue | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state using VenueFormValues
  const [formValues, setFormValues] = useState<VenueFormValues>({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    numCourts: "",
    indoor: false,
    lighting: false,
  });

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
      const geom = venueData.geom as { coordinates?: [number, number] } | null;
      const [lng, lat] = geom?.coordinates ?? [null, null];

      setFormValues({
        name: venueData.name,
        address: venueData.address ?? "",
        latitude: lat !== null ? String(lat) : "",
        longitude: lng !== null ? String(lng) : "",
        numCourts: venueData.num_courts?.toString() ?? "",
        indoor: venueData.indoor ?? false,
        lighting: venueData.lighting ?? false,
      });
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
  // Form change handler
  // -----------------------------
  const handleChange = (field: keyof VenueFormValues, value: any) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  // -----------------------------
  // Save changes
  // -----------------------------
  const handleSubmit = async () => {
    if (!venue) return;
    if (!formValues.name) return Alert.alert("Name required", "Venue name cannot be empty.");
    if (!formValues.latitude || !formValues.longitude)
      return Alert.alert("Location required", "Venue must have coordinates.");

    try {
      setSubmitting(true);

      const lat = Number(formValues.latitude);
      const lng = Number(formValues.longitude);

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
          p_name: formValues.name,
          p_address: formValues.address || null,
          p_lat: lat,
          p_lng: lng,
          p_num_courts: formValues.numCourts ? Number(formValues.numCourts) : null,
          p_surface: null,
          p_indoor: formValues.indoor,
          p_lighting: formValues.lighting,
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
    setFormValues((prev) => ({
      ...prev,
      ...(pName !== undefined && { name: pName }),
      ...(pAddress !== undefined && { address: pAddress }),
      ...(pLat !== undefined && { latitude: pLat }),
      ...(pLng !== undefined && { longitude: pLng }),
    }));
  }, [pName, pAddress, pLat, pLng]);

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Edit Venue</Text>
        <View style={{ width: 50 }} />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        alwaysBounceVertical={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <VenueForm
          values={formValues}
          loading={loading}
          submitting={submitting}
          onChange={handleChange}
          onPressMap={openMapPicker}
          onSubmit={handleSubmit}
          submitLabel="Save Changes"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// -----------------------------
// Styles
// -----------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  cancelText: {
    fontSize: 16,
    color: "#666",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  scroll: { padding: 16 },
});
