import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth/auth";
import { useDebugModeStore } from "@/lib/data/hooks/useDebugModeStore";
import { useLocalProfileLinkStore } from "@/lib/data/hooks/useLocalProfileLinkStore";
import { useProfileStore } from "@/lib/data/hooks/useProfileStore";
import { useVenueStore } from "@/lib/data/hooks/useVenueStore";
import { useDebugGestureDetector } from "@/hooks/useDebugGestureDetector";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function ProfileScreen() {
  const router = useRouter();
  const { session, signOut, signInWithGoogle, signInWithMagicLink } = useAuth();

  // NEW: Device-linked profile store
  const { currentLink, loadLink } = useLocalProfileLinkStore();

  // NEW: All loaded profiles (AsyncStorage)
  const { profiles, loadProfiles } = useProfileStore();

  // Load venues to resolve default venue
  const { venues, loadVenues } = useVenueStore();

  // Debug mode store
  const { isDebugMode, loadDebugMode, toggleDebugMode } = useDebugModeStore();

  // Email input for magic link
  const [email, setEmail] = useState("");
  const [sendingMagicLink, setSendingMagicLink] = useState(false);

  // Debug gesture pattern handler
  const handleDebugPatternDetected = useCallback(async () => {
    const newState = !isDebugMode;
    await toggleDebugMode();
    Alert.alert(
      "Debug Mode",
      newState ? "Debug mode enabled" : "Debug mode disabled"
    );
  }, [isDebugMode, toggleDebugMode]);

  // Debug gesture detector
  const panResponder = useDebugGestureDetector(handleDebugPatternDetected);

  //
  // Load the link & profiles on mount
  //
  useEffect(() => {
    loadLink();
    loadProfiles();
    loadVenues();
    loadDebugMode();
  }, []);

  //
  // Find the profile for this device
  //
  const profile =
    currentLink && profiles.length > 0
      ? profiles.find((p) => p.id === currentLink.profile_id)
      : null;

  //
  // Find the default venue for this profile
  //
  const defaultVenue =
    profile && profile.default_venue_id
      ? venues.find((v) => v.id === profile.default_venue_id)
      : null;

  //
  // Magic link login
  //
  const handleMagicLinkSignIn = async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }

    setSendingMagicLink(true);
    const { error } = await signInWithMagicLink(email);
    setSendingMagicLink(false);

    if (error) {
      Alert.alert("Error", `Failed to send magic link: ${error.message}`);
    } else {
      Alert.alert("Success", "Magic link sent! Check your email.");
    }
  };

  //
  // Loading state: profile not loaded yet
  //
  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  async function clearLocalAppData() {
    try {
      // Clear AsyncStorage
      await AsyncStorage.clear();

      // Clear browser storages
      localStorage.clear();
      sessionStorage.clear();

      // Clear IndexedDB databases (optional)
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name);
        }
      }

      console.log("Local data cleared successfully!");
    } catch (e) {
      console.error("Error clearing local data:", e);
    }
  }

  //
  // UI Rendering
  //
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.gestureContainer} {...panResponder.panHandlers}>
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
          >
            {isDebugMode && (
              <View style={styles.debugBadge}>
                <Text style={styles.debugBadgeText}>🐛 Debug Mode</Text>
              </View>
            )}
            <Text style={styles.title}>My Profile</Text>

            <Text style={styles.label}>Display Name:</Text>
            <Text style={styles.value}>{profile.display_name}</Text>

            <Text style={styles.label}>Default Venue:</Text>
            <Text style={styles.value}>
              {defaultVenue ? defaultVenue.name : "Not set"}
            </Text>

            <View style={{ marginTop: 24 }}>
              <Button
                title="Edit Profile"
                onPress={() => router.push("/(tabs)/profile/edit")}
              />
              <View style={{ height: 12 }} />
              <Button
                title="Show My QR Code"
                onPress={() => router.push("/show-qr")}
              />
            </View>

            {/* ---- SIGNED IN ---- */}
            {session ? (
              <View style={{ marginTop: 32 }}>
                <Text style={styles.signedInText}>
                  Signed in as {session.user.email}
                </Text>

                <Button title="Sign Out" onPress={signOut} />
              </View>
            ) : (
              /* ---- NOT SIGNED IN ---- */
              <View style={styles.authContainer}>
                <Text style={styles.label}>Sign-in status:</Text>
                <Text style={styles.subMessage}>You are not signed in.</Text>

                {/* Google Sign-In */}
                <Button title="Sign In with Google" onPress={signInWithGoogle} />
                <Text style={styles.orText}>or</Text>

                {/* Email Magic Link Section */}
                <View style={styles.magicLinkSection}>
                  <Text style={styles.magicLinkLabel}>
                    Sign in with a magic link:
                  </Text>
                  <TextInput
                    style={styles.emailInput}
                    placeholder="Enter your email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Button
                    title={sendingMagicLink ? "Sending..." : "Send Magic Link"}
                    onPress={handleMagicLinkSignIn}
                    disabled={sendingMagicLink}
                  />
                </View>
              </View>
            )}
            {isDebugMode && (
              <TouchableOpacity onPress={clearLocalAppData}>
                <Text>Reset App</Text>
              </TouchableOpacity>
            )}

          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  gestureContainer: {
    flex: 1,
  },
  container: {
    padding: 16,
    paddingTop: 12,
    paddingBottom: 40,
    backgroundColor: "#fff",
  },
  debugBadge: {
    backgroundColor: "#FFD700",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  debugBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 12,
  },
  label: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
  },
  value: {
    fontSize: 16,
  },
  subMessage: {
    fontSize: 16,
    marginBottom: 12,
  },
  authContainer: {
    marginTop: 12,
  },
  signedInText: {
    fontSize: 16,
    marginBottom: 12,
  },
  magicLinkSection: {
    marginTop: 4,
  },
  orText: {
    fontSize: 16,
    textAlign: "center",
    marginVertical: 12,
    color: "#666",
  },
  magicLinkLabel: {
    fontSize: 16,
    marginBottom: 4,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 4,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
});
