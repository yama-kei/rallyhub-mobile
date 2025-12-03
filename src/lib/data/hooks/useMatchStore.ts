// src/data/hooks/useMatchStore.ts

import { MatchService } from "@/lib/data/services/MatchService";
import type { RemoteMatch } from "@/lib/supabase/types";
import { create } from "zustand";

interface MatchState {
  matches: RemoteMatch[];
  loading: boolean;

  // Actions
  loadMatches: () => Promise<void>;
  loadRemoteMatches: (profileId: string) => Promise<void>;
  refresh: () => Promise<void>;

  getMatch: (id: string) => RemoteMatch | undefined;
  createMatch: (input: any) => Promise<RemoteMatch>;
  verifyMatch: (matchId: string, profileId: string) => Promise<RemoteMatch>;
  verifyMatchRemote: (matchId: string, profileId: string) => Promise<RemoteMatch | null>;
  updateMatch: (
    id: string,
    fields: Partial<RemoteMatch>
  ) => Promise<RemoteMatch>;
  updateMatchScore: (
    matchId: string,
    scoreTeam1: number,
    scoreTeam2: number,
    updatedBy: string
  ) => Promise<RemoteMatch>;
  deleteMatch: (id: string) => Promise<void>;
  deleteAllMatches: () => Promise<void>;

  // Derived queries
  search: (query: string) => RemoteMatch[];
  matchesByProfile: (profileId: string) => RemoteMatch[];
  matchesByVenue: (venueId: string) => RemoteMatch[];
  sortedByDate: () => RemoteMatch[];
}

const matchService = new MatchService();

export const useMatchStore = create<MatchState>((set, get) => ({
  matches: [],
  loading: false,

  // ---- Load all matches from AsyncStorage ----
  loadMatches: async () => {
    set({ loading: true });
    const list = await matchService.list();
    set({ matches: list, loading: false });
  },

  // ---- Load matches from Supabase and merge with local ----
  loadRemoteMatches: async (profileId) => {
    set({ loading: true });
    const list = await matchService.fetchAndMergeRemoteMatches(profileId);
    set({ matches: list, loading: false });
  },

  // ---- Force reload ----
  refresh: async () => {
    const list = await matchService.list();
    set({ matches: list });
  },

  // ---- Lookup by ID ----
  getMatch: (id) => {
    return get().matches.find((m) => m.id === id);
  },

  // ---- Create new match ----
  createMatch: async (input) => {
    const created = await matchService.createMatch(input);
    const updatedList = await matchService.list();
    set({ matches: updatedList });
    return created;
  },

  // ---- Verify a match (local + upload to backend) ----
  verifyMatch: async (matchId, profileId) => {
    const verified = await matchService.verifyMatch(matchId, profileId);
    const updatedList = await matchService.list();
    set({ matches: updatedList });
    return verified;
  },

  // ---- Verify a match remotely (for matches created by other users) ----
  verifyMatchRemote: async (matchId, profileId) => {
    const verified = await matchService.verifyMatchRemote(matchId, profileId);
    const updatedList = await matchService.list();
    set({ matches: updatedList });
    return verified;
  },

  // ---- Update match fields ----
  updateMatch: async (id, fields) => {
    const updated = await matchService.updateMatch(id, fields);
    const updatedList = await matchService.list();
    set({ matches: updatedList });
    return updated;
  },

  // ---- Update match score with auto-verification for the updater's team ----
  updateMatchScore: async (matchId, scoreTeam1, scoreTeam2, updatedBy) => {
    const updated = await matchService.updateMatchScore(matchId, scoreTeam1, scoreTeam2, updatedBy);
    const updatedList = await matchService.list();
    set({ matches: updatedList });
    return updated;
  },

  // ---- Delete match ----
  deleteMatch: async (id) => {
    await matchService.deleteMatch(id);
    const updatedList = await matchService.list();
    set({ matches: updatedList });
  },

  // ---- Delete all matches (Debug) ----
  deleteAllMatches: async () => {
    await matchService.deleteAll();
    set({ matches: [] });
  },

  // ---- Search keyword across matches ----
  search: (query) => {
    const q = query.trim().toLowerCase();
    if (!q) return get().matches;

    return get().matches.filter((m) => {
      const venue = m.venue_id ?? "";
      const fp = m.fingerprint ?? "";
      const creator = m.created_by ?? "";
      return (
        venue.toLowerCase().includes(q) ||
        creator.toLowerCase().includes(q) ||
        fp.toLowerCase().includes(q)
      );
    });
  },

  // ---- Get all matches played by a given profile ----
  matchesByProfile: (profileId) => {
    return get().matches.filter(
      (m) =>
        m.team1_player1 === profileId ||
        m.team1_player2 === profileId ||
        m.team2_player1 === profileId ||
        m.team2_player2 === profileId
    );
  },

  // ---- Get all matches at a venue ----
  matchesByVenue: (venueId) => {
    return get().matches.filter((m) => m.venue_id === venueId);
  },

  // ---- Date-sorted list for history screen ----
  sortedByDate: () => {
    return [...get().matches].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  },
}));
