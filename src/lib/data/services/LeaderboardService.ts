// src/lib/data/services/LeaderboardService.ts

import { supabase } from "@/lib/supabase/supabaseClient";
import type { RemoteMatch, RemoteProfile } from "@/lib/supabase/types";

export interface LeaderboardEntry {
  profile_id: string;
  display_name: string;
  verified_matches_count: number;
}

export interface ILeaderboardService {
  fetchLeaderboard(venueId: string | null, days?: number): Promise<LeaderboardEntry[]>;
}

export class LeaderboardService implements ILeaderboardService {
  /**
   * Fetch leaderboard data for a given venue (or global if venueId is null).
   * Returns users ranked by the number of verified matches played in the last N days.
   * @param venueId - The venue ID to filter by, or null for global leaderboard
   * @param days - Number of days to look back (default: 7)
   */
  async fetchLeaderboard(venueId: string | null, days: number = 7): Promise<LeaderboardEntry[]> {
    try {
      // Calculate the date cutoff
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffIso = cutoffDate.toISOString();

      // Build the query for verified matches in the time period
      let query = supabase
        .from("matches")
        .select(`
          id,
          team1_player1,
          team1_player2,
          team2_player1,
          team2_player2,
          created_at
        `)
        .eq("is_verified", true)
        .gte("created_at", cutoffIso);

      // Filter by venue if specified
      if (venueId) {
        query = query.eq("venue_id", venueId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("[LeaderboardService] Error fetching matches:", error);
        return [];
      }

      const matches = data as Pick<RemoteMatch, 'id' | 'team1_player1' | 'team1_player2' | 'team2_player1' | 'team2_player2' | 'created_at'>[] | null;

      if (!matches || matches.length === 0) {
        return [];
      }

      // Count matches per player
      const playerMatchCounts = new Map<string, number>();

      for (const match of matches) {
        const players = [
          match.team1_player1,
          match.team1_player2,
          match.team2_player1,
          match.team2_player2,
        ].filter((id): id is string => id != null);

        for (const playerId of players) {
          playerMatchCounts.set(playerId, (playerMatchCounts.get(playerId) || 0) + 1);
        }
      }

      // Get profile data for all players
      const playerIds = Array.from(playerMatchCounts.keys());
      
      if (playerIds.length === 0) {
        return [];
      }

      const { data: profilesData, error: profileError } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", playerIds);

      if (profileError) {
        console.error("[LeaderboardService] Error fetching profiles:", profileError);
        return [];
      }

      const profiles = profilesData as Pick<RemoteProfile, 'id' | 'display_name'>[] | null;

      // Build leaderboard entries
      const leaderboardEntries: LeaderboardEntry[] = [];

      for (const profile of profiles || []) {
        const matchCount = playerMatchCounts.get(profile.id) || 0;
        leaderboardEntries.push({
          profile_id: profile.id,
          display_name: profile.display_name,
          verified_matches_count: matchCount,
        });
      }

      // Sort by match count descending
      leaderboardEntries.sort((a, b) => b.verified_matches_count - a.verified_matches_count);

      return leaderboardEntries;
    } catch (err) {
      console.error("[LeaderboardService] fetchLeaderboard error:", err);
      return [];
    }
  }
}
