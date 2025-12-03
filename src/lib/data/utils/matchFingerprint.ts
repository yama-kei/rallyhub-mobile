// src/lib/data/utils/matchFingerprint.ts

/**
 * Compute a fingerprint for a match to ensure uniqueness and enable verification.
 * The fingerprint includes players, scores, and venue.
 * 
 * This function is used by both MatchService and MatchRepository to ensure
 * consistent fingerprint generation across the codebase.
 */
export function computeMatchFingerprint(match: {
  team1_player1: string | null;
  team1_player2: string | null;
  team2_player1: string | null;
  team2_player2: string | null;
  score_team1: number;
  score_team2: number;
  venue_id: string | null;
}): string {
  const fields = [
    match.team1_player1,
    match.team1_player2,
    match.team2_player1,
    match.team2_player2,
    match.score_team1,
    match.score_team2,
    match.venue_id,
  ];
  return JSON.stringify(fields);
}
