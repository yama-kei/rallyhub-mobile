// Cross-platform UUID generation utility
// Uses Web Crypto API on web and expo-crypto on native platforms

import { Platform } from "react-native";

// Cache the expo-crypto module to avoid repeated imports
let expoCryptoModule: { randomUUID: () => string } | null = null;

/**
 * Generate a random UUID v4.
 * Works on both web and native platforms.
 */
export function randomUUID(): string {
  if (Platform.OS === "web") {
    // Use Web Crypto API on web - supported in all modern browsers
    // The crypto global is available in all modern browsers that support Expo web
    if (typeof globalThis.crypto?.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    // Fallback for older browsers (though Expo requires modern browsers)
    throw new Error("Web Crypto API not available");
  }
  
  // Use expo-crypto on native platforms
  // Cache the module to avoid repeated require() calls
  if (!expoCryptoModule) {
    expoCryptoModule = require("expo-crypto");
  }
  return expoCryptoModule!.randomUUID();
}
