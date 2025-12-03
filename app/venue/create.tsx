import React, { useState, useEffect } from "react";
import {
    StyleSheet,
    Alert,
    ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase/supabaseClient";
import { useProfileStore } from "@/lib/data/hooks/useProfileStore";
import { useLocalProfileLinkStore } from "@/lib/data/hooks/useLocalProfileLinkStore";
import { VenueForm, VenueFormValues } from "@/components/VenueForm";

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

    const [source] = useState(params.source ?? "user");
    const [sourceId] = useState(params.source_id ?? "");
    const [submitting, setSubmitting] = useState(false);

    // Form state using VenueFormValues
    const [formValues, setFormValues] = useState<VenueFormValues>({
        name: params.name ?? "",
        address: params.address ?? "",
        latitude: params.latitude ?? "",
        longitude: params.longitude ?? "",
        numCourts: "",
        indoor: false,
        lighting: false,
    });

    // Update form values when params change (e.g., from map picker)
    useEffect(() => {
        setFormValues((prev) => ({
            ...prev,
            ...(params.name && { name: params.name }),
            ...(params.address && { address: params.address }),
            ...(params.latitude && { latitude: params.latitude }),
            ...(params.longitude && { longitude: params.longitude }),
        }));
    }, [params.name, params.address, params.latitude, params.longitude]);

    // --- Form change handler ---
    const handleChange = (field: keyof VenueFormValues, value: any) => {
        setFormValues((prev) => ({ ...prev, [field]: value }));
    };

    // --- Handler: Map Picker ---
    const goToMapPicker = () => {
        router.push("/venue/map-picker");
    };

    // --- Handler: Submit ---
    const handleSubmit = async () => {
        if (!formValues.name) return Alert.alert("Missing name", "Please enter venue name.");
        if (!formValues.latitude || !formValues.longitude)
            return Alert.alert(
                "Missing location",
                "Please select a location from the map."
            );
        if (!profile?.id)
            return Alert.alert("No profile linked", "Cannot create venue.");

        try {
            setSubmitting(true);

            const lat = Number(formValues.latitude);
            const lng = Number(formValues.longitude);

            if (isNaN(lat) || isNaN(lng)) {
                Alert.alert("Invalid location", "Latitude and longitude must be numbers.");
                return;
            }

            // Use RPC function to insert venue with PostGIS geometry
            // Type assertion needed due to Supabase RPC type inference limitations
            const { data, error } = await supabase.rpc(
                "rpc_insert_venue" as never,
                {
                    p_name: formValues.name,
                    p_address: formValues.address || null,
                    p_lat: lat,
                    p_lng: lng,
                    p_source: source,
                    p_source_id: sourceId || null,
                    p_num_courts: formValues.numCourts ? Number(formValues.numCourts) : null,
                    p_surface: null,
                    p_indoor: formValues.indoor,
                    p_lighting: formValues.lighting,
                    p_created_by: profile.id,
                } as never
            );

            if (error) throw error;

            Alert.alert("Success", "Venue created successfully.");
            router.replace(`/venue/${data}`); // Go to venue detail page (optional)
        } catch (err: any) {
            console.error(err);
            Alert.alert("Error", err.message ?? "Failed to create venue.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <VenueForm
                    values={formValues}
                    submitting={submitting}
                    onChange={handleChange}
                    onPressMap={goToMapPicker}
                    onSubmit={handleSubmit}
                    submitLabel="Create Venue"
                />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scroll: { padding: 16 },
});
