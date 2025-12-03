import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { useLocalProfileLinkStore } from "@/lib/data/hooks/useLocalProfileLinkStore";

export default function ProfileSetupScreen() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [sendingMagicLink, setSendingMagicLink] = useState(false);
  const [checkingExistingProfile, setCheckingExistingProfile] = useState(false);
  const router = useRouter();
  const { session, loading: authLoading, signInWithGoogle, signInWithMagicLink } = useAuth();
  const { createPlaceholderForDevice, fetchAndLinkExistingProfile } = useLocalProfileLinkStore();

  // When user signs in, check for existing profile and redirect
  useEffect(() => {
    const handleExistingProfile = async () => {
      const shouldCheckForExistingProfile = session && !authLoading && !checkingExistingProfile;
      if (shouldCheckForExistingProfile) {
        setCheckingExistingProfile(true);
        try {
          console.log("[ProfileSetup] User signed in, checking for existing profile...");
          const existingProfile = await fetchAndLinkExistingProfile(session.user.id);
          
          if (existingProfile) {
            console.log("[ProfileSetup] Found existing profile, using it:", existingProfile.display_name);
            // Save display name to legacy storage for backward compatibility
            await AsyncStorage.setItem("username", existingProfile.display_name);
            // Navigate to profile tab
            router.replace("/(tabs)/profile");
          } else {
            // User has an account but no profile yet - they need to create one
            console.log("[ProfileSetup] No existing profile found for this user");
            setCheckingExistingProfile(false);
          }
        } catch (error) {
          console.error("[ProfileSetup] Error checking for existing profile:", error);
          setCheckingExistingProfile(false);
        }
      }
    };
    
    handleExistingProfile();
  }, [session, authLoading]);

  const onSave = async () => {
    const name = username.trim();
    if (!name) return;

    try {
      // Save to the new profile system
      await createPlaceholderForDevice(name);

      // Also save to legacy username key for backward compatibility
      await AsyncStorage.setItem("username", name);

      // Go to profile tab (and show tabs)
      router.replace("/(tabs)/profile");
    } catch (error) {
      console.error("Failed to save profile:", error);
      Alert.alert(
        "Error",
        "Failed to save your profile. Please try again."
      );
    }
  };

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
      Alert.alert(
        "Check Your Email",
        "We sent you a magic link. Click the link in your email to sign in and retrieve your profile."
      );
    }
  };

  // Show loading state while checking for existing profile
  if (authLoading || checkingExistingProfile) {
    return (
      <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>
            {checkingExistingProfile ? "Checking for existing profile..." : "Loading..."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <Text style={styles.title}>Welcome to RallyHub</Text>
            
            {/* New user section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>New to RallyHub?</Text>
              <Text style={styles.sectionSubtitle}>
                Create a new profile to get started
              </Text>

              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="Enter your display name"
                placeholderTextColor="#aaa"
                style={styles.input}
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={[
                  styles.button,
                  { backgroundColor: username.trim() ? "#4CAF50" : "#ccc" },
                ]}
                disabled={!username.trim()}
                onPress={onSave}
              >
                <Text style={styles.buttonText}>Create Profile</Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Returning user section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Already have an account?</Text>
              <Text style={styles.sectionSubtitle}>
                Sign in to retrieve your existing profile
              </Text>
              
              {/* Google Sign-In */}
              <TouchableOpacity
                style={styles.googleButton}
                onPress={signInWithGoogle}
              >
                <Text style={styles.googleButtonText}>Sign In with Google</Text>
              </TouchableOpacity>

              <Text style={styles.orText}>or</Text>

              {/* Email Magic Link */}
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor="#aaa"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[
                  styles.magicLinkButton,
                  { backgroundColor: sendingMagicLink ? "#ccc" : "#2196F3" },
                ]}
                disabled={sendingMagicLink || !email.trim()}
                onPress={handleMagicLinkSignIn}
              >
                <Text style={styles.buttonText}>
                  {sendingMagicLink ? "Sending..." : "Send Magic Link"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  container: {
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#555",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 32,
    textAlign: "center",
    color: "#222",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
    textAlign: "center",
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: "#f9f9f9",
  },
  button: {
    paddingVertical: 16,
    borderRadius: 10,
  },
  googleButton: {
    paddingVertical: 16,
    borderRadius: 10,
    backgroundColor: "#DB4437",
  },
  magicLinkButton: {
    paddingVertical: 16,
    borderRadius: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    fontWeight: "600",
  },
  googleButtonText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    fontWeight: "600",
  },
  orText: {
    fontSize: 14,
    textAlign: "center",
    marginVertical: 12,
    color: "#888",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
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
});
