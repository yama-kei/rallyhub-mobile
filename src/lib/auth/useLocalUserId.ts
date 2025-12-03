import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { useEffect, useState } from "react";

const KEY = "rallyhub_local_user_id";

export function useLocalUserId() {
  const [localId, setLocalId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const existing = await AsyncStorage.getItem(KEY);
      if (existing) {
        setLocalId(existing);
        return;
      }

      // Generate new anonymous userID
      let bytes: Uint8Array;
      try {
        bytes = await Crypto.getRandomBytesAsync(16);
      } catch (e) {
        console.warn("Crypto.getRandomBytesAsync failed on Android, using fallback");
        bytes = new Uint8Array(16).map(() => Math.floor(Math.random() * 256));
      }

      // Convert Uint8Array to hex string
      const newId = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      await AsyncStorage.setItem(KEY, newId);
      setLocalId(newId);
    }

    load();
  }, []);

  return localId;
}
