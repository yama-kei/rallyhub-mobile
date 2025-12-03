import { useAuth } from "@/lib/auth/auth";
import { dataEnv } from "@/lib/data/DataEnvironment";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

export function useForegroundSync() {
  const { session } = useAuth();
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state !== "active") return;

      // Throttle: sync at most every 20 seconds
      const now = Date.now();
      if (now - lastSyncRef.current < 20_000) return;

      const userId = session?.user?.id;
      if (!userId) return;

      console.log("🔄 App foreground detected → syncing…");

      await dataEnv.syncService.syncAll(userId);
      lastSyncRef.current = now;
    });

    return () => subscription.remove();
  }, [session]);
}
