import { featureFlags } from "@/config/featureFlags";
import { useAuth } from "@/lib/auth/auth";
import { emitUserActivity, getDeviceId, getAppVersion } from "@/lib/supabase/userActivity";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

// Throttle emission to once per day
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
        // Get device ID using shared helper
        const deviceId = await getDeviceId();

        // Get app version using shared helper
        const appVersion = getAppVersion();

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
