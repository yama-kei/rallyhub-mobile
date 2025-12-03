import { supabase } from "@/lib/supabase/supabaseClient";
import { randomUUID } from "@/lib/utils/uuid";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

type LocalProfile = {
  id: string; // local UUID OR supabase user_id
  username: string | null;
  dupr_id: string | null;
  synced: boolean; // true = matches Supabase
};

type ProfileContextType = {
  profile: LocalProfile | null;
  loading: boolean;
  updateProfile: (updates: Partial<LocalProfile>) => Promise<void>;
  syncWithServer: (supabaseUserId: string) => Promise<void>;
};

const ProfileContext = createContext<ProfileContextType>({
  profile: null,
  loading: true,
  updateProfile: async () => {},
  syncWithServer: async () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load profile from device on startup
  useEffect(() => {
    const loadProfile = async () => {
      const stored = await AsyncStorage.getItem("local_profile");

      if (stored) {
        setProfile(JSON.parse(stored));
      } else {
        // Create temporary local profile
        const tmpId = randomUUID();
        const emptyProfile: LocalProfile = {
          id: tmpId,
          username: null,
          dupr_id: null,
          synced: false,
        };
        await AsyncStorage.setItem("local_profile", JSON.stringify(emptyProfile));
        setProfile(emptyProfile);
      }

      setLoading(false);
    };

    loadProfile();
  }, []);

  const saveProfile = async (p: LocalProfile) => {
    setProfile(p);
    await AsyncStorage.setItem("local_profile", JSON.stringify(p));
  };

  // Update local profile only
  const updateProfile = async (updates: Partial<LocalProfile>) => {
    if (!profile) return;

    const updated = {
      ...profile,
      ...updates,
      synced: false, // mark dirty
    };

    await saveProfile(updated);
  };

  // Migrate local profile to Supabase once user signs in
  const syncWithServer = async (supabaseUserId: string) => {
    if (!profile) return;

    // 1. Fetch existing profile from Supabase
    const { data: existing } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", supabaseUserId)
      .maybeSingle();

    if (!existing) {
      // 2. If Supabase profile does not exist → create using local values
      await supabase.from("profiles").upsert({
        user_id: supabaseUserId,
        username: profile.username,
        dupr_id: profile.dupr_id,
      });
    }

    // 3. Replace local temp UUID with the real Supabase user_id
    const updated: LocalProfile = {
      ...profile,
      id: supabaseUserId,
      synced: true,
    };

    await saveProfile(updated);
  };

  return (
    <ProfileContext.Provider value={{ profile, loading, updateProfile, syncWithServer }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
