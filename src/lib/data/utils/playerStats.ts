// src/lib/data/utils/playerStats.ts

import type { RemoteMatch } from "@/lib/supabase/types";
import { getProfileTeam } from "./matchStatus";

/**
 * Statistics for games where two players were on the same team
 */
export interface PairedStats {
  totalGames: number;
  wins: number;
  losses: number;
}

/**
 * Statistics for games where two players were on opposite teams
 */
export interface OpponentStats {
  totalGames: number;
  wins: number;
  losses: number;
}

/**
 * Combined head-to-head statistics between two players
 */
export interface PlayerHeadToHeadStats {
  paired: PairedStats;
  opponent: OpponentStats;
}

/**
 * Calculate head-to-head statistics between two players from a list of matches.
 * 
 * @param matches - List of verified matches to analyze
 * @param currentUserId - The current user's profile ID
 * @param otherPlayerId - The other player's profile ID
 * @returns Head-to-head statistics
 */
export function calculateHeadToHeadStats(
  matches: RemoteMatch[],
  currentUserId: string,
  otherPlayerId: string
): PlayerHeadToHeadStats {
  const stats: PlayerHeadToHeadStats = {
    paired: { totalGames: 0, wins: 0, losses: 0 },
    opponent: { totalGames: 0, wins: 0, losses: 0 },
  };

  for (const match of matches) {
    // Only count verified matches
    if (!match.is_verified) {
      continue;
    }

    // Determine which team each player is on
    const currentUserTeam = getProfileTeam(match, currentUserId);
    const otherPlayerTeam = getProfileTeam(match, otherPlayerId);

    // Skip if either player is not in this match
    if (currentUserTeam === null || otherPlayerTeam === null) {
      continue;
    }

    // Determine if they were teammates or opponents
    const wereTeammates = currentUserTeam === otherPlayerTeam;

    // Determine the winner
    const team1Won = match.score_team1 > match.score_team2;
    const team2Won = match.score_team2 > match.score_team1;

    // Calculate the result from current user's perspective
    const currentUserWon =
      (currentUserTeam === 1 && team1Won) ||
      (currentUserTeam === 2 && team2Won);
    const currentUserLost =
      (currentUserTeam === 1 && team2Won) ||
      (currentUserTeam === 2 && team1Won);

    if (wereTeammates) {
      // They were on the same team
      stats.paired.totalGames++;
      if (currentUserWon) {
        stats.paired.wins++;
      } else if (currentUserLost) {
        stats.paired.losses++;
      }
      // If it's a tie, it counts as a game but neither win nor loss
    } else {
      // They were opponents
      stats.opponent.totalGames++;
      if (currentUserWon) {
        stats.opponent.wins++;
      } else if (currentUserLost) {
        stats.opponent.losses++;
      }
      // If it's a tie, it counts as a game but neither win nor loss
    }
  }

  return stats;
}
