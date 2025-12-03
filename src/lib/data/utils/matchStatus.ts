// src/lib/data/utils/matchStatus.ts

import type { RemoteMatch } from "@/lib/supabase/types";

/**
 * Match status values:
 * - "local": Match exists only in local storage (not uploaded)
 * - "submitted": Match has been uploaded to backend but not verified
 * - "needs_verification": Match has been submitted and requires the current user's verification
 * - "verified": Match has been verified by at least one opponent player
 */
export type MatchStatus = "local" | "submitted" | "needs_verification" | "verified";

/**
 * Determine which team a profile belongs to in a match.
 * Returns 1 for team1, 2 for team2, or null if not a participant.
 */
export function getProfileTeam(match: RemoteMatch, profileId: string): 1 | 2 | null {
  if (profileId === match.team1_player1 || profileId === match.team1_player2) {
    return 1;
  }
  if (profileId === match.team2_player1 || profileId === match.team2_player2) {
    return 2;
  }
  return null;
}

/**
 * Check if a match needs verification from the current user.
 * A match needs the user's verification if:
 * 1. Match is not fully verified
 * 2. User is a participant in the match
 * 3. User's team has not yet verified
 * 4. Match has been synced (uploaded to backend)
 * 
 * @param match - The match to check
 * @param profileId - Current user's profile ID. Returns false if null.
 * @returns true if the match needs verification from this user
 */
export function matchNeedsUserVerification(match: RemoteMatch, profileId: string | null): boolean {
  // If no profile ID or already fully verified, no verification needed
  if (!profileId || match.is_verified) {
    return false;
  }

  // If match is not synced (local only), no verification needed from others
  if (!match.synced_at) {
    return false;
  }

  // Determine which team the user belongs to
  const team = getProfileTeam(match, profileId);
  
  // If user is not a participant, they can't verify
  if (team === null) {
    return false;
  }

  // Check if user's team has already verified
  if (team === 1) {
    return match.team1_verified_by === null;
  } else {
    return match.team2_verified_by === null;
  }
}

/**
 * Get the status of a match based on sync and verification state.
 * Optionally takes a profileId to show "needs_verification" status for matches
 * that require the current user's verification.
 */
export function getMatchStatus(match: RemoteMatch, profileId?: string | null): MatchStatus {
  if (match.is_verified) {
    return "verified";
  }
  
  // Check if this match needs verification from the current user
  if (profileId && matchNeedsUserVerification(match, profileId)) {
    return "needs_verification";
  }
  
  if (match.synced_at) {
    return "submitted";
  }
  return "local";
}

/**
 * Get a human-readable label for the match status.
 */
export function getMatchStatusLabel(status: MatchStatus): string {
  switch (status) {
    case "local":
      return "Local";
    case "submitted":
      return "Submitted";
    case "needs_verification":
      return "Needs Your Verification";
    case "verified":
      return "Verified";
  }
}

/**
 * Get a color for the match status badge.
 */
export function getMatchStatusColor(status: MatchStatus): string {
  switch (status) {
    case "local":
      return "#6c757d"; // gray
    case "submitted":
      return "#ffc107"; // yellow/amber
    case "needs_verification":
      return "#dc3545"; // red - attention needed
    case "verified":
      return "#28a745"; // green
  }
}
