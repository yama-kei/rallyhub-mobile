import { featureFlags } from "@/config/featureFlags";
import { useAuth } from "@/lib/auth/auth";
import { emitUserActivity } from "@/lib/supabase/userActivity";
import { randomUUID } from "@/lib/utils/uuid";
import * as Application from "expo-application";
import Constants from "expo-constants";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

// Throttle emission to once per day
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const UNKNOWN_DEVICE = "unknown-device";

/**
 * Hook to track user activity (DAU/MAU metrics).
 * Emits activity when app comes to foreground, throttled to once per day.
 * Tracks both authenticated and unauthenticated users.
 * 
 * Note: This feature can be disabled via featureFlags.enableUserActivityTracking
 */
export function useUserActivityTracking() {
  const { session } = useAuth();
  const lastEmitRef = useRef<number>(0);
  const hasEmittedInitial = useRef<boolean>(false);

  useEffect(() => {
    // Skip if user activity tracking is disabled
    if (!featureFlags.enableUserActivityTracking) {
      return;
    }

    // Helper function to emit activity
    const attemptEmit = async (trigger: string) => {
      console.log(`[useUserActivityTracking] ${trigger} - Checking if should emit...`, {
        hasSession: !!session,
        hasUserId: !!session?.user?.id,
        lastEmit: lastEmitRef.current,
        timeSinceLastEmit: Date.now() - lastEmitRef.current,
      });

      // Throttle: emit at most once per day
      const now = Date.now();
      if (now - lastEmitRef.current < ONE_DAY_MS) {
        console.log('[useUserActivityTracking] Throttled: too soon since last emit');
        return;
      }

      console.log("📊 [useUserActivityTracking] Emitting user activity metrics...");

      try {
        // Get device ID
        let deviceId = UNKNOWN_DEVICE;
        try {
          if (Platform.OS === "web") {
            // For web, use a persistent identifier based on localStorage
            const webDeviceId = await AsyncStorage.getItem('web_device_id');
            if (webDeviceId) {
              deviceId = webDeviceId;
            } else {
              const newWebDeviceId = randomUUID();
              await AsyncStorage.setItem('web_device_id', newWebDeviceId);
              deviceId = newWebDeviceId;
            }
          } else if (Platform.OS === "android" && typeof Application.getAndroidId === "function") {
            const id = Application.getAndroidId();
            if (id) deviceId = id.toString();
          } else if (
            Platform.OS === "ios" &&
            typeof Application.getIosIdForVendorAsync === "function"
          ) {
            const iosId = await Application.getIosIdForVendorAsync();
            if (iosId) deviceId = iosId;
          }
        } catch (e) {
          console.warn("[useUserActivityTracking] Failed to get device ID", e);
        }

        // Get app version
        const appVersion = Constants.expoConfig?.version || "1.0.0";

        // Determine if user has account (authenticated session)
        const hasAccount = !!session?.user?.id;

        console.log('[useUserActivityTracking] About to call emitUserActivity with:', {
          hasAccount,
          activityType: 'app_open',
          deviceId,
          appVersion,
          platform: Platform.OS,
        });

        // Emit activity with 'app_open' type
        await emitUserActivity({
          hasAccount,
          activityType: 'app_open',
          deviceId,
          appVersion,
          platform: Platform.OS,
        });

        lastEmitRef.current = now;
        console.log('[useUserActivityTracking] ✅ Activity emission completed, lastEmit updated to:', now);
      } catch (error) {
        console.error("[useUserActivityTracking] Failed to emit activity", error);
      }
    };

    // Emit on initial mount
    if (!hasEmittedInitial.current) {
      hasEmittedInitial.current = true;
      attemptEmit('Initial mount').catch(console.error);
    }

    // Listen for app state changes
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state !== "active") return;
      await attemptEmit(`App became active`);
    });

    return () => subscription.remove();
  }, [session]);
}
