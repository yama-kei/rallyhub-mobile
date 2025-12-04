import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useLocalProfileLinkStore } from "@/lib/data/hooks/useLocalProfileLinkStore";
import { useProfileStore } from "@/lib/data/hooks/useProfileStore";
import { useVenueStore } from "@/lib/data/hooks/useVenueStore";
import VenueAutocomplete from "@/components/VenueAutocomplete";
import type { RemoteVenue } from "@/lib/supabase/types";

export default function EditProfileScreen() {
  const router = useRouter();

  const { profiles, loadProfiles, upsertProfile } = useProfileStore();
  const { currentLink, loadLink } = useLocalProfileLinkStore();
  const { venues, loadVenues } = useVenueStore();

  const [displayName, setDisplayName] = useState("");
  const [selectedVenue, setSelectedVenue] = useState<RemoteVenue | null>(null);

  //
  // Load link + profiles (AsyncStorage)
  //
  useEffect(() => {
    loadLink();
    loadProfiles();
    loadVenues();
  }, []);

  //
  // Determine *current profile* from local link
  //
  const currentProfile = currentLink
    ? profiles.find((p) => p.id === currentLink.profile_id)
    : null;

  //
  // Populate input with current profile
  //
  useEffect(() => {
    if (currentProfile) {
      setDisplayName(currentProfile.display_name ?? "");
      
      // Set selected venue if the profile has a default venue
      if (currentProfile.default_venue_id) {
        const venue = venues.find((v) => v.id === currentProfile.default_venue_id);
        if (venue) {
          setSelectedVenue(venue);
        }
      } else {
        setSelectedVenue(null);
      }
    }
  }, [currentProfile, venues]);

  //
  // Save handler
  //
  async function handleSave() {
    try {
      if (!currentProfile) {
        Alert.alert("Error", "No profile linked to this device.");
        return;
      }

      const updated = await upsertProfile({
        id: currentProfile.id,
        display_name: displayName.trim() || "Player",
        default_venue_id: selectedVenue?.id ?? null,
      });

      Alert.alert("Success", "Profile updated!");
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to update profile");
    }
  }

  //
  // Loading fallback
  //
  if (!currentProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  //
  // UI
  //
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Edit Profile</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your name"
            placeholderTextColor="#aaa"
            value={displayName}
            onChangeText={setDisplayName}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Default Venue</Text>
          <VenueAutocomplete
            onSelectVenue={setSelectedVenue}
            selectedVenue={selectedVenue}
            placeholder="Search for a default venue..."
          />
          <Text style={styles.helpText}>
            This venue will be automatically selected when creating new matches.
          </Text>
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Save</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

//
// Styles
//
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 40,
    flexGrow: 1,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  input: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  helpText: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
  buttonsContainer: {
    marginTop: 16,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
});
