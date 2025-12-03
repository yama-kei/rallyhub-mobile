import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase/supabaseClient";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import type { Database } from "@/lib/supabase/types";

type Venue = Database["public"]["Tables"]["venues"]["Row"];

export default function VenueListScreen() {
  const router = useRouter();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [filtered, setFiltered] = useState<Venue[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // User location (optional for sorting)
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // -----------------------------
  // Fetch venues
  // -----------------------------
  const loadVenues = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("venues").select("*");
      if (error) throw error;

      setVenues(data ?? []);
      setFiltered(data ?? []);
    } catch (err) {
      console.warn("Failed to load venues:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadVenues();
  }, [loadVenues]);

  // -----------------------------
  // User location (optional)
  // -----------------------------
  useEffect(() => {
    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        });
      } catch (err) {
        console.warn("Location unavailable:", err);
      }
    };

    getLocation();
  }, []);

  // -----------------------------
  // Search filter
  // -----------------------------
  useEffect(() => {
    if (!search) {
      setFiltered(venues);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(
      venues.filter((v) => v.name.toLowerCase().includes(q))
    );
  }, [search, venues]);

  // -----------------------------
  // Sort by distance (optional)
  // -----------------------------
  const sortByDistance = (list: Venue[]) => {
    if (!userLocation) return list;

    return [...list].sort((a, b) => {
      const aGeom = a.geom as { coordinates?: [number, number] } | null;
      const bGeom = b.geom as { coordinates?: [number, number] } | null;

      const [aLng, aLat] = aGeom?.coordinates ?? [-122.143, 37.4419];
      const [bLng, bLat] = bGeom?.coordinates ?? [-122.143, 37.4419];

      const da =
        (aLat - userLocation.lat) ** 2 +
        (aLng - userLocation.lng) ** 2;
      const db =
        (bLat - userLocation.lat) ** 2 +
        (bLng - userLocation.lng) ** 2;

      return da - db;
    });
  };

  const sorted = sortByDistance(filtered);

  // -----------------------------
  // Helpers
  // -----------------------------
  const getDistanceText = (venue: Venue) => {
    if (!userLocation) return null;

    const geom = venue.geom as { coordinates?: [number, number] } | null;
    const [lng, lat] = geom?.coordinates ?? [0, 0];

    const R = 6371; // km
    const dLat = ((lat - userLocation.lat) * Math.PI) / 180;
    const dLng = ((lng - userLocation.lng) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((userLocation.lat * Math.PI) / 180) *
        Math.cos((lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const km = R * c;

    return `${(km * 0.621371).toFixed(1)} mi away`;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVenues();
    setRefreshing(false);
  };

  // -----------------------------
  // Render Row
  // -----------------------------
  const renderItem = ({ item }: { item: Venue }) => {
    const distance = getDistanceText(item);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/venue/${item.id}`)}
      >
        <Text style={styles.cardTitle}>{item.name}</Text>
        {item.address && (
          <Text style={styles.cardAddress}>{item.address}</Text>
        )}

        <View style={styles.metaRow}>
          {distance && <Text style={styles.meta}>{distance}</Text>}
          {item.num_courts && (
            <Text style={styles.meta}>{item.num_courts} courts</Text>
          )}
          {item.surface && (
            <Text style={styles.meta}>{item.surface}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Venues</Text>

      <TextInput
        style={styles.search}
        placeholder="Search venue…"
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <Text style={{ textAlign: "center", marginTop: 20 }}>
              No venues found.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    fontSize: 28,
    fontWeight: "700",
    marginTop: 8,
    paddingHorizontal: 16,
  },
  search: {
    marginTop: 12,
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    fontSize: 16,
  },
  card: {
    backgroundColor: "white",
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  cardAddress: {
    marginTop: 4,
    color: "#555",
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  meta: {
    fontSize: 12,
    color: "#666",
    backgroundColor: "#f2f2f2",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
});
