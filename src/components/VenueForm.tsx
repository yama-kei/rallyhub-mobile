import React from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
} from "react-native";

export type VenueFormValues = {
    name: string;
    canonicalName?: string | null;
    address: string;
    latitude: string;
    longitude: string;
    numCourts: string;
    indoor: boolean;
    lighting: boolean;
};

export type VenueFormProps = {
    values: VenueFormValues;
    loading?: boolean;
    submitting?: boolean;

    onChange: (field: keyof VenueFormValues, value: any) => void;
    onPressMap: () => void;
    onSubmit: () => void;

    submitLabel?: string;
};

export function VenueForm({
    values,
    loading = false,
    submitting = false,
    onChange,
    onPressMap,
    onSubmit,
    submitLabel = "Save",
}: VenueFormProps) {
    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <View style={styles.form}>
            {/* Map Picker - Moved to top */}
            <TouchableOpacity style={styles.mapButton} onPress={onPressMap}>
                <Text style={styles.mapButtonText}>Select Location on Map</Text>
            </TouchableOpacity>

            {/* Name */}
            <Text style={styles.label}>Venue Name *</Text>
            <TextInput
                style={styles.input}
                value={values.name}
                onChangeText={(t) => onChange("name", t)}
                placeholder="Venue name"
            />

            {/* Address - Read only */}
            <Text style={styles.label}>Address</Text>
            <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={values.address}
                editable={false}
                placeholder="Address (select from map)"
            />

            {/* Coordinates - Read only */}
            <Text style={styles.label}>Latitude</Text>
            <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={values.latitude}
                editable={false}
            />

            <Text style={styles.label}>Longitude</Text>
            <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={values.longitude}
                editable={false}
            />

            {/* Optional fields */}
            <Text style={styles.label}>Number of Courts</Text>
            <TextInput
                style={styles.input}
                value={values.numCourts}
                onChangeText={(t) => onChange("numCourts", t)}
                keyboardType="numeric"
                placeholder="e.g., 4"
            />

            {/* Toggles */}
            <View style={styles.toggleRow}>
                <TouchableOpacity
                    style={[styles.toggle, values.indoor && styles.toggleActive]}
                    onPress={() => onChange("indoor", !values.indoor)}
                >
                    <Text style={styles.toggleText}>Indoor</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.toggle, values.lighting && styles.toggleActive]}
                    onPress={() => onChange("lighting", !values.lighting)}
                >
                    <Text style={styles.toggleText}>Lighting</Text>
                </TouchableOpacity>
            </View>

            {/* Submit */}
            <TouchableOpacity
                style={[styles.submitButton, submitting && styles.submitDisabled]}
                onPress={onSubmit}
                disabled={submitting}
            >
                <Text style={styles.submitText}>
                    {submitting ? "Saving…" : submitLabel}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    form: {
        paddingTop: 4,
        paddingBottom: 40,
    },
    centered: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 40,
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
        marginTop: 24,
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
