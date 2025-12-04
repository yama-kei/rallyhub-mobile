import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
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

            {/* Profile Info Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Display Name</Text>
              <Text style={styles.sectionValue}>{profile.display_name}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Default Venue</Text>
              <Text style={styles.sectionValue}>
                {defaultVenue ? defaultVenue.name : "Not set"}
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push("/(tabs)/profile/edit")}
              >
                <Ionicons name="create-outline" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>Edit Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.push("/show-qr")}
              >
                <Ionicons name="qr-code-outline" size={20} color="#007AFF" />
                <Text style={styles.secondaryButtonText}>Show My QR Code</Text>
              </TouchableOpacity>
            </View>

            {/* ---- SIGNED IN ---- */}
            {session ? (
              <View style={styles.authSection}>
                <View style={styles.signedInCard}>
                  <Ionicons name="checkmark-circle" size={24} color="#28a745" />
                  <View style={styles.signedInInfo}>
                    <Text style={styles.signedInLabel}>Signed in as</Text>
                    <Text style={styles.signedInEmail}>{session.user.email}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.signOutButton}
                  onPress={signOut}
                >
                  <Text style={styles.signOutButtonText}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ---- NOT SIGNED IN ---- */
              <View style={styles.authSection}>
                <View style={styles.notSignedInCard}>
                  <Ionicons name="person-circle-outline" size={24} color="#666" />
                  <Text style={styles.notSignedInText}>You are not signed in</Text>
                </View>

                {/* Google Sign-In */}
                <TouchableOpacity
                  style={styles.googleButton}
                  onPress={signInWithGoogle}
                >
                  <Ionicons name="logo-google" size={20} color="#fff" />
                  <Text style={styles.googleButtonText}>Sign In with Google</Text>
                </TouchableOpacity>

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Email Magic Link Section */}
                <View style={styles.magicLinkSection}>
                  <Text style={styles.magicLinkLabel}>Sign in with a magic link</Text>
                  <TextInput
                    style={styles.emailInput}
                    placeholder="Enter your email"
                    placeholderTextColor="#aaa"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={[
                      styles.magicLinkButton,
                      (!email.trim() || sendingMagicLink) && styles.buttonDisabled,
                    ]}
                    onPress={handleMagicLinkSignIn}
                    disabled={sendingMagicLink || !email.trim()}
                  >
                    <Text style={styles.magicLinkButtonText}>
                      {sendingMagicLink ? "Sending..." : "Send Magic Link"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {isDebugMode && (
              <TouchableOpacity style={styles.resetButton} onPress={clearLocalAppData}>
                <Text style={styles.resetButtonText}>Reset App</Text>
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
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 24,
  },

  // Profile Info Sections
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
  sectionValue: {
    fontSize: 18,
    fontWeight: "500",
  },

  // Action Buttons
  actionsContainer: {
    marginTop: 8,
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
  secondaryButton: {
    backgroundColor: "#f0f0f0",
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryButtonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },

  // Auth Section
  authSection: {
    marginTop: 32,
  },
  signedInCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fff4",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  signedInInfo: {
    flex: 1,
  },
  signedInLabel: {
    fontSize: 14,
    color: "#666",
  },
  signedInEmail: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: "#dc3545",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  signOutButtonText: {
    color: "#dc3545",
    fontSize: 16,
    fontWeight: "600",
  },

  // Not Signed In
  notSignedInCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  notSignedInText: {
    fontSize: 16,
    color: "#666",
  },

  // Google Button
  googleButton: {
    backgroundColor: "#DB4437",
    paddingVertical: 14,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  googleButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  // Divider
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd",
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: "#888",
    fontWeight: "500",
  },

  // Magic Link Section
  magicLinkSection: {
    marginTop: 0,
  },
  magicLinkLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  emailInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: "#f9f9f9",
  },
  magicLinkButton: {
    backgroundColor: "#2196F3",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  magicLinkButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
  },

  // Debug Reset Button
  resetButton: {
    marginTop: 40,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dee2e6",
    alignSelf: "center",
  },
  resetButtonText: {
    fontSize: 12,
    color: "#dc3545",
    fontWeight: "600",
  },
});
