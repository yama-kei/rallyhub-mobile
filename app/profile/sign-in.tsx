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

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [sendingMagicLink, setSendingMagicLink] = useState(false);
  const [checkingExistingProfile, setCheckingExistingProfile] = useState(false);
  const router = useRouter();
  const { session, loading: authLoading, signInWithGoogle, signInWithMagicLink } = useAuth();
  const { fetchAndLinkExistingProfile } = useLocalProfileLinkStore();

  // When user signs in, check for existing profile and redirect
  useEffect(() => {
    const handleExistingProfile = async () => {
      const shouldCheckForExistingProfile = session && !authLoading && !checkingExistingProfile;
      if (shouldCheckForExistingProfile) {
        setCheckingExistingProfile(true);
        try {
          console.log("[SignIn] User signed in, checking for existing profile...");
          const existingProfile = await fetchAndLinkExistingProfile(session.user.id);
          
          if (existingProfile) {
            console.log("[SignIn] Found existing profile, using it:", existingProfile.display_name);
            // Save display name to legacy storage for backward compatibility
            await AsyncStorage.setItem("username", existingProfile.display_name);
          }
          // Navigate to home tab after sign-in (profile was already created in setup page)
          router.replace("/(tabs)/home");
        } catch (error) {
          console.error("[SignIn] Error checking for existing profile:", error);
          setCheckingExistingProfile(false);
        }
      }
    };
    
    handleExistingProfile();
  }, [session, authLoading]);

  const handleSkip = () => {
    // Navigate to home screen without signing in
    router.replace("/(tabs)/home");
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
        "We sent you a magic link. Click the link in your email to sign in and join the RallyHub community."
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
            {checkingExistingProfile ? "Setting up your profile..." : "Loading..."}
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
            <Text style={styles.title}>Sign In to RallyHub</Text>
            
            <Text style={styles.description}>
              Sign in using one of the supported authentication methods to upload your matches and join the RallyHub community.
            </Text>

            {/* Sign-in section */}
            <View style={styles.section}>
              {/* Google Sign-In */}
              <TouchableOpacity
                style={styles.googleButton}
                onPress={signInWithGoogle}
              >
                <Text style={styles.googleButtonText}>Sign In with Google</Text>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

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
                  { backgroundColor: sendingMagicLink || !email.trim() ? "#ccc" : "#2196F3" },
                ]}
                disabled={sendingMagicLink || !email.trim()}
                onPress={handleMagicLinkSignIn}
              >
                <Text style={styles.buttonText}>
                  {sendingMagicLink ? "Sending..." : "Send Magic Link"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Benefits note */}
            <View style={styles.benefitsSection}>
              <Text style={styles.benefitsTitle}>Why sign in?</Text>
              <Text style={styles.benefitsText}>• Sync your matches across devices</Text>
              <Text style={styles.benefitsText}>• Back up your game history</Text>
              <Text style={styles.benefitsText}>• Connect with other players</Text>
              <Text style={styles.benefitsText}>• Access the full RallyHub community</Text>
            </View>

            {/* Skip button */}
            <View style={styles.skipSection}>
              <Text style={styles.skipNote}>
                You can always sign in later from your profile settings.
              </Text>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkip}
              >
                <Text style={styles.skipButtonText}>Skip for Now</Text>
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
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
    color: "#222",
  },
  description: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  section: {
    marginBottom: 24,
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
  benefitsSection: {
    backgroundColor: "#f0f8ff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  benefitsText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 22,
  },
  skipSection: {
    alignItems: "center",
  },
  skipNote: {
    fontSize: 14,
    color: "#888",
    textAlign: "center",
    marginBottom: 12,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipButtonText: {
    color: "#666",
    fontSize: 16,
    textAlign: "center",
    textDecorationLine: "underline",
  },
});
