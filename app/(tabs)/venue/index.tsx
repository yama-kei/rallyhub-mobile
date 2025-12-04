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
import Ionicons from "@expo/vector-icons/Ionicons";

type Venue = Database["public"]["Tables"]["venues"]["Row"];

// Default coordinates (Palo Alto, CA) used when venue location is unavailable
const DEFAULT_COORDINATES: [number, number] = [-122.143, 37.4419];

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
    // Helpers
    // -----------------------------

    // Calculate Haversine distance in kilometers
    const calculateDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
        const R = 6371; // Earth's radius in km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLng = ((lng2 - lng1) * Math.PI) / 180;

        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // -----------------------------
    // Sort by distance (optional)
    // -----------------------------
    const sortByDistance = (list: Venue[]) => {
        if (!userLocation) return list;

        return [...list].sort((a, b) => {
            // Use generated columns if available, otherwise fallback (though migration should ensure they exist)
            // or parse geom if absolutely necessary, but we prefer lat/lng cols now.
            // For backward compatibility or if migration not run, we might want to check both,
            // but let's assume lat/lng cols are there or we use default.

            const aLat = a.lat ?? DEFAULT_COORDINATES[1];
            const aLng = a.lng ?? DEFAULT_COORDINATES[0];
            const bLat = b.lat ?? DEFAULT_COORDINATES[1];
            const bLng = b.lng ?? DEFAULT_COORDINATES[0];

            const da = calculateDistanceKm(userLocation.lat, userLocation.lng, aLat, aLng);
            const db = calculateDistanceKm(userLocation.lat, userLocation.lng, bLat, bLng);

            return da - db;
        });
    };

    const sorted = sortByDistance(filtered);

    const getDistanceText = (venue: Venue) => {
        if (!userLocation) return null;

        const lat = venue.lat ?? DEFAULT_COORDINATES[1];
        const lng = venue.lng ?? DEFAULT_COORDINATES[0];

        const km = calculateDistanceKm(userLocation.lat, userLocation.lng, lat, lng);

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

                </View>
            </TouchableOpacity>
        );
    };

    // -----------------------------
    // Render
    // -----------------------------
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.headerRow}>
                <Text style={styles.header}>Venues</Text>
                <TouchableOpacity
                    style={styles.createButton}
                    onPress={() => router.push("/venue/create")}
                >
                    <Ionicons name="add-circle" size={28} color="#2563EB" />
                    <Text style={styles.createButtonText}>Create</Text>
                </TouchableOpacity>
            </View>

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
                    alwaysBounceVertical={true}
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
    container: { flex: 1, backgroundColor: "#f8f9fa" },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        marginTop: 8,
    },
    header: {
        fontSize: 28,
        fontWeight: "700",
    },
    createButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    createButtonText: {
        color: "#2563EB",
        fontSize: 16,
        fontWeight: "600",
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
