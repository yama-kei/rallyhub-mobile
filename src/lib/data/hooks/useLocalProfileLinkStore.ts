// src/data/hooks/useLocalProfileLinkStore.ts

import { LocalProfileLinkService } from "@/lib/data/services/LocalProfileLinkService";
import { ProfileService } from "@/lib/data/services/ProfileService";
import type { RemoteLocalProfileLink, RemoteProfile } from "@/lib/supabase/types";
import { create } from "zustand";

interface LocalProfileLinkState {
  currentLink: RemoteLocalProfileLink | null;
  loading: boolean;

  loadLink: () => Promise<void>;
  setProfileForDevice: (profileId: string) => Promise<RemoteLocalProfileLink>;
  createPlaceholderForDevice: (name: string) => Promise<RemoteLocalProfileLink>;
  fetchAndLinkExistingProfile: (userId: string) => Promise<RemoteProfile | null>;
}

const linkService = new LocalProfileLinkService();
const profileService = new ProfileService();

export const useLocalProfileLinkStore = create<LocalProfileLinkState>((set) => ({
  currentLink: null,
  loading: false,

  // ---- Load current device's link ----
  loadLink: async () => {
    set({ loading: true });
    const link = await linkService.getLinkForDevice();
    set({ currentLink: link, loading: false });
  },

  // ---- Assign a remote profile to this device ----
  setProfileForDevice: async (profileId) => {
    const link = await linkService.ensureLinkForDevice(profileId);
    set({ currentLink: link });
    return link;
  },

  // ---- Create placeholder + link to this device ----
  createPlaceholderForDevice: async (name) => {
    const placeholder = await profileService.createPlaceholder(name);
    const link = await linkService.ensureLinkForDevice(placeholder.id);
    set({ currentLink: link });
    return link;
  },

  // ---- Fetch existing profile from Supabase by user_id and link it to this device ----
  fetchAndLinkExistingProfile: async (userId) => {
    set({ loading: true });
    try {
      // Try to fetch existing profile from Supabase
      const existingProfile = await profileService.fetchProfileByUserIdFromSupabase(userId);
      
      if (existingProfile) {
        // Save the profile locally
        await profileService.upsertProfile(existingProfile);
        // Link this device to the existing profile
        const link = await linkService.ensureLinkForDevice(existingProfile.id);
        set({ currentLink: link, loading: false });
        return existingProfile;
      }
      
      set({ loading: false });
      return null;
    } catch (error) {
      console.error("[useLocalProfileLinkStore] fetchAndLinkExistingProfile error:", error);
      set({ loading: false });
      return null;
    }
  },
}));
