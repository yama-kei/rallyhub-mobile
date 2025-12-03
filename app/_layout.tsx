import { useForegroundSync } from "@/hooks/useForegroundSync";
import { useUserActivityTracking } from "@/hooks/useUserActivityTracking";
import { AuthProvider } from "@/lib/auth/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Stack, useRouter, useSegments } from "expo-router";
import React, { useEffect, useState } from "react";

// Inner component that uses hooks requiring AuthProvider
function AppContent() {
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);
  useForegroundSync(); // 🔄 enables background → foreground sync globally
  useUserActivityTracking(); // 📊 tracks user activity for DAU/MAU metrics

  // Check for username on app load and redirect to profile setup if not found
  useEffect(() => {
    async function init() {
      const username = await AsyncStorage.getItem("username");

      if (!username) {
        // Only redirect when we are NOT inside profile/setup or profile/sign-in already
        const inSetup =
          segments.length >= 2 &&
          segments[0] === "profile" &&
          segments.at(1) === "setup";

        const inSignIn =
          segments.length >= 2 &&
          segments[0] === "profile" &&
          segments.at(1) === "sign-in";

        if (!inSetup && !inSignIn) {
          console.log("Redirecting to profile/setup...");
          router.replace("/profile/setup");
        }
      }
      setReady(true);
    }
    init();
  }, [segments]);

  // Prevent initial flash of wrong screen
  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="player-detail/[id]" options={{ headerShown: true, title: "Player Profile", headerBackTitle: "Back" }} />
      <Stack.Screen name="known-players" options={{ headerShown: true, title: "Known Players", headerBackTitle: "Back" }} />
      <Stack.Screen name="claim-guest" options={{ headerShown: true, title: "Claim Guest", headerBackTitle: "Back" }} />
      <Stack.Screen name="show-qr" options={{ headerShown: true, title: "Share Your QR", headerBackTitle: "Back" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
