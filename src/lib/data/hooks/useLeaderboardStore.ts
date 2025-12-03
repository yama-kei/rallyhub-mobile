// src/lib/data/hooks/useLeaderboardStore.ts

import { LeaderboardEntry, LeaderboardService } from "@/lib/data/services/LeaderboardService";
import { create } from "zustand";

interface LeaderboardState {
  entries: LeaderboardEntry[];
  loading: boolean;
  error: string | null;

  // Actions
  fetchLeaderboard: (venueId: string | null, days?: number) => Promise<void>;
  clearLeaderboard: () => void;
}

const leaderboardService = new LeaderboardService();

export const useLeaderboardStore = create<LeaderboardState>((set) => ({
  entries: [],
  loading: false,
  error: null,

  fetchLeaderboard: async (venueId, days = 7) => {
    set({ loading: true, error: null });
    try {
      const entries = await leaderboardService.fetchLeaderboard(venueId, days);
      set({ entries, loading: false });
    } catch (err) {
      console.error("[useLeaderboardStore] Error fetching leaderboard:", err);
      set({ 
        error: err instanceof Error ? err.message : "Failed to fetch leaderboard",
        loading: false 
      });
    }
  },

  clearLeaderboard: () => {
    set({ entries: [], loading: false, error: null });
  },
}));
