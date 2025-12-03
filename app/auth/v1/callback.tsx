import { useAuth } from "@/lib/auth/auth";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";

/**
 * Timeout in ms to wait for session to be established after auth callback.
 * The AuthProvider handles deep link URL processing and session establishment.
 */
const SESSION_WAIT_TIMEOUT_MS = 3000;

export default function Callback() {
  const { session, loading } = useAuth();
  const [waitingForSession, setWaitingForSession] = useState(Platform.OS !== "web");

  // On native platforms, give the AuthProvider time to process the deep link URL
  // and establish the session before redirecting
  useEffect(() => {
    if (Platform.OS === "web") {
      // On web, Supabase's detectSessionInUrl handles this automatically
      return;
    }

    console.log("[callback] Callback loaded, waiting for session...");
    
    // Set a timeout to stop waiting if session doesn't appear
    const timeout = setTimeout(() => {
      if (!session) {
        console.log("[callback] Session wait timeout reached");
        setWaitingForSession(false);
      }
    }, SESSION_WAIT_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [session]);

  // When session becomes available, stop waiting
  useEffect(() => {
    if (session) {
      console.log("[callback] Session detected, stopping wait");
      setWaitingForSession(false);
    }
  }, [session]);

  useEffect(() => {
    // Wait for session processing to complete on native
    if (waitingForSession) return;
    
    console.log("[callback] Callback ready - session:", !!session, "loading:", loading);
    
    // Once session is loaded, navigate based on session state
    if (!loading) {
      if (session) {
        // Session exists, navigate to home (tabs)
        console.log("[callback] Session established, navigating to home");
        router.replace("/(tabs)/home");
      } else {
        // No session, navigate back to profile
        console.log("[callback] No session, navigating to profile");
        router.replace("/(tabs)/profile");
      }
    }
  }, [session, loading, waitingForSession]);

  // Show loading indicator while waiting for session
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}
