import React, { useCallback, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE, Region } from "@/components/NativeMap";
import * as Location from "expo-location";
import { useEffect } from "react";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { useRouter } from "expo-router";

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY!;

type SelectedLocation = {
    name: string | null;
    address: string | null;
    latitude: number;
    longitude: number;
    placeId: string | null;
    source: "google" | "manual";
};

const DEFAULT_REGION: Region = {
    latitude: 37.4419, // Palo Alto as a neutral default
    longitude: -122.1430,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
};

export default function VenueMapPickerScreen() {
    const router = useRouter();
    const mapRef = useRef<MapView | null>(null);

    const [region, setRegion] = useState<Region>(DEFAULT_REGION);
    const [initializing, setInitializing] = useState(true);
    const [selected, setSelected] = useState<SelectedLocation | null>(null);
    const [reverseGeocoding, setReverseGeocoding] = useState(false);

    // Get user location once on mount (best effort)
    useEffect(() => {
        const init = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== "granted") {
                    setInitializing(false);
                    return;
                }

                const loc = await Location.getCurrentPositionAsync({});
                const nextRegion: Region = {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                };
                setRegion(nextRegion);

                mapRef.current?.animateToRegion(nextRegion, 500);
            } catch (err) {
                console.warn("Failed to get current location", err);
            } finally {
                setInitializing(false);
            }
        };

        init();
    }, []);

    const handlePlaceSelected = useCallback(
        (data: any, details: any | null) => {
            if (!details?.geometry?.location) return;

            const { lat, lng } = details.geometry.location;
            const name = details.name ?? data.description ?? null;
            const address =
                details.formatted_address ??
                details.vicinity ??
                data.description ??
                null;

            const nextRegion: Region = {
                latitude: lat,
                longitude: lng,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            };

            setRegion(nextRegion);
            setSelected({
                name,
                address,
                latitude: lat,
                longitude: lng,
                placeId: data.place_id ?? null,
                source: "google",
            });

            if (mapRef.current) {
                mapRef.current.animateToRegion(nextRegion, 600);
            }
        },
        []
    );

    const reverseGeocode = useCallback(
        async (lat: number, lng: number) => {
            if (!GOOGLE_PLACES_API_KEY) return null;

            try {
                setReverseGeocoding(true);
                const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_PLACES_API_KEY}`;
                const res = await fetch(url);
                const json = await res.json();

                if (json.status !== "OK" || !json.results?.length) {
                    return null;
                }

                const top = json.results[0];
                return {
                    address: top.formatted_address as string,
                    placeId: top.place_id as string,
                };
            } catch (err) {
                console.warn("Reverse geocode failed", err);
                return null;
            } finally {
                setReverseGeocoding(false);
            }
        },
        []
    );

    const handleMapPress = useCallback(
        async (event: any) => {
            const { latitude, longitude } = event.nativeEvent.coordinate;

            // Try to find an address for this coordinate
            const geocodeResult = await reverseGeocode(latitude, longitude);

            setSelected({
                name: geocodeResult?.address ?? "Selected location",
                address: geocodeResult?.address ?? null,
                latitude,
                longitude,
                placeId: geocodeResult?.placeId ?? null,
                source: "manual",
            });
        },
        [reverseGeocode]
    );

    const handleConfirm = useCallback(() => {
        if (!selected) {
            Alert.alert("Select a location", "Please choose a place on the map first.");
            return;
        }

        // Push back to /venue/create with prefilled params
        router.replace({
            pathname: "/venue/create",
            params: {
                name: selected.name ?? "",
                address: selected.address ?? "",
                latitude: String(selected.latitude),
                longitude: String(selected.longitude),
                source: selected.source,
                source_id: selected.placeId ?? "",
            },
        });
    }, [router, selected]);

    if (initializing) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator />
                <Text style={styles.loadingText}>Loading map…</Text>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                provider={PROVIDER_GOOGLE}
                initialRegion={region}
                region={region}
                onRegionChangeComplete={setRegion}
                onPress={handleMapPress}
            >
                {selected && (
                    <Marker
                        coordinate={{
                            latitude: selected.latitude,
                            longitude: selected.longitude,
                        }}
                        title={selected.name ?? undefined}
                        description={selected.address ?? undefined}
                    />
                )}
            </MapView>

            {/* Search bar overlay */}
            <SafeAreaView style={styles.overlayTop} pointerEvents="box-none">
                <View style={styles.searchWrapper}>
                    <GooglePlacesAutocomplete
                        placeholder="Search for venue or court"
                        fetchDetails
                        enablePoweredByContainer={false}
                        onPress={handlePlaceSelected}
                        query={{
                            key: GOOGLE_PLACES_API_KEY,
                            language: "en",
                            // You could bias around current region:
                            location: `${region.latitude},${region.longitude}`,
                            radius: 30000, // meters
                        }}
                        styles={{
                            container: styles.autocompleteContainer,
                            textInput: styles.autocompleteInput,
                            listView: styles.autocompleteList,
                        }}
                    />
                </View>
            </SafeAreaView>

            {/* Bottom info + confirm button */}
            <SafeAreaView style={styles.overlayBottom} pointerEvents="box-none">
                <View style={styles.bottomCard}>
                    {selected ? (
                        <>
                            <Text style={styles.venueName} numberOfLines={1}>
                                {selected.name ?? "Selected location"}
                            </Text>
                            {selected.address && (
                                <Text style={styles.venueAddress} numberOfLines={2}>
                                    {selected.address}
                                </Text>
                            )}
                            <Text style={styles.coordsText}>
                                {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}
                            </Text>
                        </>
                    ) : (
                        <Text style={styles.placeholderText}>
                            Tap on the map or search above to select a venue.
                        </Text>
                    )}

                    {reverseGeocoding && (
                        <Text style={styles.helperText}>Fetching address…</Text>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.confirmButton,
                            !selected && styles.confirmButtonDisabled,
                        ]}
                        onPress={handleConfirm}
                        disabled={!selected}
                    >
                        <Text style={styles.confirmButtonText}>Use This Location</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
    },
    loadingText: {
        marginTop: 8,
        fontSize: 16,
    },
    overlayTop: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
    },
    searchWrapper: {
        marginTop: Platform.OS === "android" ? 16 : 0,
        paddingHorizontal: 12,
    },
    autocompleteContainer: {
        flex: 0,
    },
    autocompleteInput: {
        backgroundColor: "white",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 16,
        elevation: 2,
    },
    autocompleteList: {
        backgroundColor: "white",
        borderRadius: 8,
        marginTop: 4,
    },
    overlayBottom: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
    },
    bottomCard: {
        marginHorizontal: 12,
        marginBottom: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,0.95)",
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
    },
    venueName: {
        fontSize: 16,
        fontWeight: "600",
    },
    venueAddress: {
        fontSize: 14,
        marginTop: 4,
    },
    coordsText: {
        marginTop: 4,
        fontSize: 12,
        color: "#555",
    },
    placeholderText: {
        fontSize: 14,
        marginBottom: 8,
    },
    helperText: {
        marginTop: 4,
        fontSize: 12,
        color: "#555",
    },
    confirmButton: {
        marginTop: 10,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#2563EB", // Tailwind blue-600 equivalent
    },
    confirmButtonDisabled: {
        backgroundColor: "#9CA3AF",
    },
    confirmButtonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "600",
    },
});
