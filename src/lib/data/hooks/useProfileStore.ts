// src/data/hooks/useProfileStore.ts

import { ProfileService } from "@/lib/data/services/ProfileService";
import type { RemoteProfile } from "@/lib/supabase/types";
import { create } from "zustand";

interface ProfileState {
  profiles: RemoteProfile[];
  loading: boolean;

  // Actions
  loadProfiles: () => Promise<void>;
  getProfile: (id: string) => RemoteProfile | undefined;
  upsertProfile: (p: Partial<RemoteProfile>) => Promise<RemoteProfile>;
  createPlaceholder: (displayName: string) => Promise<RemoteProfile>;
  refresh: () => Promise<void>;
}

const profileService = new ProfileService();

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  loading: false,

  // ---- Load all profiles from AsyncStorage ----
  loadProfiles: async () => {
    set({ loading: true });
    const list = await profileService.listProfiles();
    set({ profiles: list, loading: false });
  },

  // ---- Lookup by ID ----
  getProfile: (id) => {
    return get().profiles.find((p) => p.id === id);
  },

  // ---- Update or Insert a full/partial profile ----
  upsertProfile: async (partialProfile) => {
    const saved = await profileService.upsertProfile(partialProfile);

    // Refresh store data
    const updatedList = await profileService.listProfiles();
    set({ profiles: updatedList });

    return saved;
  },

  // ---- Create placeholder user for offline players ----
  createPlaceholder: async (displayName) => {
    const placeholder = await profileService.createPlaceholder(displayName);

    // Refresh store
    const updatedList = await profileService.listProfiles();
    set({ profiles: updatedList });

    return placeholder;
  },

  // ---- Force reload (useful after match verification, imports, resets) ----
  refresh: async () => {
    const list = await profileService.listProfiles();
    set({ profiles: list });
  },
}));
