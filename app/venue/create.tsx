import React, { useState } from "react";
import {
    View,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase/supabaseClient";
import { useProfileStore } from "@/lib/data/hooks/useProfileStore";
import { useLocalProfileLinkStore } from "@/lib/data/hooks/useLocalProfileLinkStore";

export default function VenueCreateScreen() {
    const router = useRouter();
    const { profiles } = useProfileStore();
    const { currentLink } = useLocalProfileLinkStore();
    const profile = currentLink?.profile_id
        ? profiles.find((p) => p.id === currentLink.profile_id)
        : undefined;

    const params = useLocalSearchParams<{
        name?: string;
        address?: string;
        latitude?: string;
        longitude?: string;
        source?: string;
        source_id?: string;
    }>();

    // --- Form State ---
    const [name, setName] = useState(params.name ?? "");
    const [address, setAddress] = useState(params.address ?? "");
    const [latitude, setLatitude] = useState(params.latitude ?? "");
    const [longitude, setLongitude] = useState(params.longitude ?? "");
    const [source] = useState(params.source ?? "user");
    const [sourceId] = useState(params.source_id ?? "");

    const [numCourts, setNumCourts] = useState("");
    const [surface, setSurface] = useState("");
    const [indoor, setIndoor] = useState(false);
    const [lighting, setLighting] = useState(false);

    const [submitting, setSubmitting] = useState(false);

    // --- Handler: Map Picker ---
    const goToMapPicker = () => {
        router.push("/venue/map-picker");
    };

    // --- Handler: Submit ---
    const handleSubmit = async () => {
        if (!name) return Alert.alert("Missing name", "Please enter venue name.");
        if (!latitude || !longitude)
            return Alert.alert(
                "Missing location",
                "Please select a location from the map."
            );
        if (!profile?.id)
            return Alert.alert("No profile linked", "Cannot create venue.");

        try {
            setSubmitting(true);

            const lat = Number(latitude);
            const lng = Number(longitude);

            if (isNaN(lat) || isNaN(lng)) {
                Alert.alert("Invalid location", "Latitude and longitude must be numbers.");
                return;
            }

            // Insert directly into venues table with GeoJSON Point for geom column
            const { data, error } = await supabase
                .from("venues")
                .insert({
                    name,
                    address: address || null,
                    geom: `POINT(${lng} ${lat})`,
                    source,
                    source_id: sourceId || null,
                    num_courts: numCourts ? Number(numCourts) : null,
                    surface: surface || null,
                    indoor,
                    lighting,
                    created_by: profile.id,
                })
                .select("id")
                .single();

            if (error) throw error;

            Alert.alert("Success", "Venue created successfully.");
            router.replace(`/venue/${data.id}`); // Go to venue detail page (optional)
        } catch (err: any) {
            console.error(err);
            Alert.alert("Error", err.message ?? "Failed to create venue.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.form}>
                <Text style={styles.title}>Create Venue</Text>

                {/* Map Picker - at top */}
                <TouchableOpacity style={styles.mapButton} onPress={goToMapPicker}>
                    <Text style={styles.mapButtonText}>Select from Map</Text>
                </TouchableOpacity>

                {/* Address - read-only, populated from map */}
                <Text style={styles.label}>Address</Text>
                <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    value={address}
                    placeholder="Select location from map"
                    editable={false}
                />

                {/* Latitude - read-only, populated from map */}
                <Text style={styles.label}>Latitude</Text>
                <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    value={latitude}
                    placeholder="—"
                    editable={false}
                />

                {/* Longitude - read-only, populated from map */}
                <Text style={styles.label}>Longitude</Text>
                <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    value={longitude}
                    placeholder="—"
                    editable={false}
                />

                {/* Name */}
                <Text style={styles.label}>Venue Name *</Text>
                <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g., The Hub (Silicon Valley)"
                />

                {/* Optional Fields */}
                <Text style={styles.label}>Number of Courts</Text>
                <TextInput
                    style={styles.input}
                    value={numCourts}
                    onChangeText={setNumCourts}
                    keyboardType="numeric"
                    placeholder="e.g., 4"
                />

                <Text style={styles.label}>Surface</Text>
                <TextInput
                    style={styles.input}
                    value={surface}
                    onChangeText={setSurface}
                    placeholder="e.g., Concrete, Asphalt, Wood"
                />

                {/* Toggles */}
                <View style={styles.toggleRow}>
                    <TouchableOpacity
                        style={[styles.toggle, indoor && styles.toggleActive]}
                        onPress={() => setIndoor(!indoor)}
                    >
                        <Text style={styles.toggleText}>Indoor</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.toggle, lighting && styles.toggleActive]}
                        onPress={() => setLighting(!lighting)}
                    >
                        <Text style={styles.toggleText}>Lighting</Text>
                    </TouchableOpacity>
                </View>

                {/* Submit */}
                <TouchableOpacity
                    style={[styles.submitButton, submitting && styles.submitDisabled]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    <Text style={styles.submitText}>
                        {submitting ? "Creating…" : "Create Venue"}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    form: { padding: 16 },
    title: {
        fontSize: 24,
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
    inputDisabled: {
        backgroundColor: "#f3f4f6",
        color: "#9ca3af",
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
        fontSize: 16,
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
    submitButton: {
        marginTop: 20,
        backgroundColor: "#10B981",
        padding: 14,
        borderRadius: 8,
        alignItems: "center",
    },
    submitDisabled: {
        opacity: 0.6,
    },
    submitText: {
        color: "white",
        fontSize: 16,
        fontWeight: "700",
    },
});
