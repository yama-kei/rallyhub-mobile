/* // src/data/hooks/useMatchVerificationStore.ts


import { MatchVerificationService } from "@/lib/data/services/MatchVerificationService";
import type { RemoteMatch } from "@/lib/supabase/types";
import { create } from "zustand";

export interface MatchVerification {
  id: string;
  match_id: string;
  profile_id: string;
  verified_at: string;
}

interface MatchVerificationState {
  verifications: MatchVerification[];
  loading: boolean;

  // Core actions
  loadVerifications: () => Promise<void>;
  refresh: () => Promise<void>;

  verifyMatch: (
    matchId: string,
    profileId: string
  ) => Promise<RemoteMatch>;

  // Queries
  hasVerified: (matchId: string, profileId: string) => boolean;
  verificationsForMatch: (matchId: string) => MatchVerification[];
  verificationsByProfile: (profileId: string) => MatchVerification[];
}

const verificationService = new MatchVerificationService();

export const useMatchVerificationStore = create<MatchVerificationState>((set, get) => ({
  verifications: [],
  loading: false,

  // ---- Load all verification records ----
  loadVerifications: async () => {
    set({ loading: true });
    const list = await verificationService.repo.list(); // direct repository list
    set({ verifications: list, loading: false });
  },

  // ---- Force reload from AsyncStorage ----
  refresh: async () => {
    const list = await verificationService.repo.list();
    set({ verifications: list });
  },

  // ---- Verify a match (creates verification record + updates match) ----
  verifyMatch: async (matchId, profileId) => {
    // Service handles preventing duplicates + match updating
    const updatedMatch = await verificationService.verify(matchId, profileId);

    // Reload verification list
    const list = await verificationService.repo.list();
    set({ verifications: list });

    return updatedMatch;
  },

  // ---- Check if profile already verified match ----
  hasVerified: (matchId, profileId) => {
    return get().verifications.some(
      (v) => v.match_id === matchId && v.profile_id === profileId
    );
  },

  // ---- Get verification events for a match ----
  verificationsForMatch: (matchId) => {
    return get().verifications.filter((v) => v.match_id === matchId);
  },

  // ---- Get all verifications by a specific profile ----
  verificationsByProfile: (profileId) => {
    return get().verifications.filter((v) => v.profile_id === profileId);
  },
}));
 */