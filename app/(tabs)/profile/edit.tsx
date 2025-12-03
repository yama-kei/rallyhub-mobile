import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  StyleSheet,
  Text,
  TextInput,
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
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Text style={styles.title}>Edit Profile</Text>

      <Text style={styles.label}>Display Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your name"
        value={displayName}
        onChangeText={setDisplayName}
      />

      <Text style={styles.label}>Default Venue</Text>
      <VenueAutocomplete
        onSelectVenue={setSelectedVenue}
        selectedVenue={selectedVenue}
        placeholder="Search for a default venue..."
      />
      <Text style={styles.helpText}>
        This venue will be automatically selected when creating new matches.
      </Text>

      <View style={styles.buttons}>
        <Button title="Save" onPress={handleSave} />
        <View style={{ height: 12 }} />
        <Button title="Cancel" onPress={() => router.back()} color="#666" />
      </View>
    </SafeAreaView>
  );
}

//
// Styles
//
const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 12,
    flex: 1,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 16,
  },
  input: {
    marginTop: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    fontSize: 16,
  },
  helpText: {
    marginTop: 6,
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
  buttons: {
    marginTop: 32,
  },
});
