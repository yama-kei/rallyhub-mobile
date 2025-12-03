import React, { forwardRef, useImperativeHandle } from "react";
import { View, Text, StyleSheet } from "react-native";

// Mock types to match react-native-maps
export type Region = {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
};

export const PROVIDER_GOOGLE = "google";

// Mock Marker component
export const Marker = (props: any) => {
    return null;
};

// Mock MapView component
const MapView = forwardRef((props: any, ref) => {
    useImperativeHandle(ref, () => ({
        animateToRegion: (region: Region, duration: number) => {
            // No-op for web placeholder
            console.log("animateToRegion called on web", region);
        },
    }));

    return (
        <View style={[styles.container, props.style]}>
            <Text style={styles.text}>Map is not supported on web yet.</Text>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f0f0f0",
    },
    text: {
        color: "#666",
    },
});

export default MapView;
