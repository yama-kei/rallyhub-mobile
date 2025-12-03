// src/data/hooks/useDebugModeStore.ts

import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

const DEBUG_MODE_STORAGE_KEY = "debug_mode_enabled";

interface DebugModeState {
  isDebugMode: boolean;
  loading: boolean;

  loadDebugMode: () => Promise<void>;
  enableDebugMode: () => Promise<void>;
  disableDebugMode: () => Promise<void>;
  toggleDebugMode: () => Promise<void>;
}

export const useDebugModeStore = create<DebugModeState>((set, get) => ({
  isDebugMode: false,
  loading: false,

  // Load debug mode state from AsyncStorage
  loadDebugMode: async () => {
    set({ loading: true });
    try {
      const value = await AsyncStorage.getItem(DEBUG_MODE_STORAGE_KEY);
      const isEnabled = value === "true";
      set({ isDebugMode: isEnabled, loading: false });
    } catch (error) {
      console.error("[useDebugModeStore] loadDebugMode error:", error);
      set({ loading: false });
    }
  },

  // Enable debug mode and persist to AsyncStorage
  enableDebugMode: async () => {
    try {
      await AsyncStorage.setItem(DEBUG_MODE_STORAGE_KEY, "true");
      set({ isDebugMode: true });
    } catch (error) {
      console.error("[useDebugModeStore] enableDebugMode error:", error);
    }
  },

  // Disable debug mode and persist to AsyncStorage
  disableDebugMode: async () => {
    try {
      await AsyncStorage.setItem(DEBUG_MODE_STORAGE_KEY, "false");
      set({ isDebugMode: false });
    } catch (error) {
      console.error("[useDebugModeStore] disableDebugMode error:", error);
    }
  },

  // Toggle debug mode
  toggleDebugMode: async () => {
    const { isDebugMode } = get();
    if (isDebugMode) {
      await get().disableDebugMode();
    } else {
      await get().enableDebugMode();
    }
  },
}));
