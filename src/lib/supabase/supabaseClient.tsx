import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import type { Database } from "./types";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// On the web we want Supabase to detect the session in the URL after an OAuth redirect.
// For native (Expo) apps we typically keep detectSessionInUrl disabled.
const isBrowser = typeof window !== "undefined" && typeof window.location !== "undefined";

// Custom storage adapter for React Native using AsyncStorage.
// This ensures auth sessions are persisted across app restarts and background states.
// Wrapped with defensive error handling to prevent crashes during early app initialization
// when the native TurboModule may not be fully ready (iOS release build crash fix).
const asyncStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.warn("[asyncStorageAdapter] getItem failed:", error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.warn("[asyncStorageAdapter] setItem failed:", error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.warn("[asyncStorageAdapter] removeItem failed:", error);
    }
  },
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: isBrowser,
    // Use AsyncStorage for session persistence on native platforms (iOS/Android).
    // On web, Supabase defaults to localStorage which works fine.
    storage: Platform.OS !== "web" ? asyncStorageAdapter : undefined,
  },
});