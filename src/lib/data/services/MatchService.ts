// src/lib/data/services/MatchService.ts

import { RemoteMatch } from "@/lib/supabase/types";
import { supabase } from "@/lib/supabase/supabaseClient";
import { randomUUID } from "@/lib/utils/uuid";
import { MatchRepository } from "../repositories/MatchRepository";
import { ProfileService } from "./ProfileService";
import { computeMatchFingerprint } from "../utils/matchFingerprint";

export interface ICreateMatchInput {
  created_by: string | null;

  team1_player1: string | null;
  team1_player2: string | null;
  team2_player1: string | null;
  team2_player2: string | null;

  score_team1: number;
  score_team2: number;

  venue_id: string | null;
}

export interface IMatchService {
  list(): Promise<RemoteMatch[]>;
  get(id: string): Promise<RemoteMatch | null>;
  fetchMatchesByProfileId(profileId: string): Promise<RemoteMatch[]>;
  fetchVerifiedMatchesByProfileId(profileId: string): Promise<RemoteMatch[]>;
  fetchAndMergeRemoteMatches(profileId: string): Promise<RemoteMatch[]>;

  createMatch(input: ICreateMatchInput): Promise<RemoteMatch>;
  verifyMatch(matchId: string, profileId: string): Promise<RemoteMatch>;
  verifyMatchRemote(matchId: string, profileId: string): Promise<RemoteMatch | null>;
  verifyMatchForTeam(matchId: string, profileId: string): Promise<RemoteMatch>;
  verifyMatchForTeamRemote(matchId: string, profileId: string): Promise<RemoteMatch | null>;
  updateMatch(id: string, fields: Partial<RemoteMatch>): Promise<RemoteMatch>;
  updateMatchScore(matchId: string, scoreTeam1: number, scoreTeam2: number, updatedBy: string): Promise<RemoteMatch>;
  updateMatchScoreRemote(matchId: string, scoreTeam1: number, scoreTeam2: number, expectedVersion: number, updatedBy: string): Promise<RemoteMatch | null>;
  deleteMatch(id: string): Promise<void>;
  deleteAll(): Promise<void>;
}

export class MatchService implements IMatchService {
  private repo: MatchRepository;
  private profiles: ProfileService;

  constructor(repo?: MatchRepository, profiles?: ProfileService) {
    this.repo = repo ?? new MatchRepository();
    this.profiles = profiles ?? new ProfileService();
  }

  async list() {
    return this.repo.list();
  }

  async get(id: string) {
    return this.repo.getById(id);
  }

  /**
   * Fetch all matches (verified or not) for a specific profile from Supabase
   */
  async fetchMatchesByProfileId(profileId: string): Promise<RemoteMatch[]> {
    return this.repo.fetchMatchesByProfileId(profileId);
  }

  /**
   * Fetch verified matches for a specific profile from Supabase
   */
  async fetchVerifiedMatchesByProfileId(profileId: string): Promise<RemoteMatch[]> {
    return this.repo.fetchVerifiedMatchesByProfileId(profileId);
  }

  /**
   * Fetch matches from Supabase for the given profile and merge with local storage.
   * This allows users to see matches recorded by other users.
   * Also downloads profile data for all players in the fetched matches.
   * Returns the merged list of matches.
   */
  async fetchAndMergeRemoteMatches(profileId: string): Promise<RemoteMatch[]> {
    try {
      console.log(`[MatchService] Fetching remote matches for profile ${profileId}`);
      const remoteMatches = await this.repo.fetchMatchesByProfileId(profileId);
      console.log(`[MatchService] Fetched ${remoteMatches.length} remote matches`);

      const localMatches = await this.repo.list();

      // Merge remote matches into local storage
      for (const remoteMatch of remoteMatches) {
        const localMatch = localMatches.find((m) => m.id === remoteMatch.id);
        
        // Save if not exists locally or if remote is newer
        if (!localMatch || remoteMatch.updated_at > localMatch.updated_at) {
          // Matches downloaded from Supabase are already synced
          const matchWithSyncedAt = {
            ...remoteMatch,
            synced_at: localMatch?.synced_at ?? remoteMatch.created_at,
          };
          await this.repo.save(matchWithSyncedAt);
        }
      }

      // Download profile data for all players in the fetched matches
      await this.downloadMissingPlayerProfiles(remoteMatches);

      // Return the updated list
      return this.repo.list();
    } catch (err) {
      console.error("[MatchService] Error fetching and merging remote matches:", err);
      return this.repo.list();
    }
  }

  /**
   * Download profile data for all players in the given matches that are not
   * already in local storage. This ensures player names are displayed correctly
   * when viewing matches recorded by other users.
   */
  private async downloadMissingPlayerProfiles(matches: RemoteMatch[]): Promise<void> {
    try {
      // Collect unique player IDs from all matches
      const playerIds = new Set<string>();
      for (const match of matches) {
        if (match.team1_player1) playerIds.add(match.team1_player1);
        if (match.team1_player2) playerIds.add(match.team1_player2);
        if (match.team2_player1) playerIds.add(match.team2_player1);
        if (match.team2_player2) playerIds.add(match.team2_player2);
      }

      if (playerIds.size === 0) {
        console.log("[MatchService] No player IDs to download");
        return;
      }

      console.log(`[MatchService] Checking ${playerIds.size} player profiles for download`);

      // Check which profiles already exist locally (concurrently)
      const playerIdArray = Array.from(playerIds);
      const existenceChecks = await Promise.allSettled(
        playerIdArray.map(async (playerId) => ({
          playerId,
          exists: await this.profiles.getProfile(playerId) !== null,
        }))
      );

      const missingPlayerIds: string[] = [];
      let skippedCount = 0;

      for (let i = 0; i < existenceChecks.length; i++) {
        const result = existenceChecks[i];
        const playerId = playerIdArray[i];
        
        if (result.status === "fulfilled") {
          if (result.value.exists) {
            skippedCount++;
          } else {
            missingPlayerIds.push(playerId);
          }
        } else {
          // If existence check failed, treat as missing and try to download
          console.warn(`[MatchService] Failed to check existence for profile ${playerId}, will attempt download`);
          missingPlayerIds.push(playerId);
        }
      }

      if (missingPlayerIds.length === 0) {
        console.log(`[MatchService] All ${skippedCount} player profiles already exist locally`);
        return;
      }

      // Download missing profiles concurrently for better performance
      const downloadResults = await Promise.allSettled(
        missingPlayerIds.map(async (playerId) => {
          const remoteProfile = await this.profiles.fetchProfileFromSupabase(playerId);
          if (remoteProfile) {
            await this.profiles.upsertProfile(remoteProfile);
            return { playerId, success: true };
          }
          return { playerId, success: false };
        })
      );

      let downloadedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < downloadResults.length; i++) {
        const result = downloadResults[i];
        const playerId = missingPlayerIds[i];
        
        if (result.status === "fulfilled" && result.value.success) {
          downloadedCount++;
        } else if (result.status === "rejected") {
          failedCount++;
          console.warn(`[MatchService] Failed to download profile ${playerId}: ${result.reason}`);
        } else if (result.status === "fulfilled" && !result.value.success) {
          failedCount++;
          console.log(`[MatchService] Profile not found in Supabase: ${playerId}`);
        }
      }

      console.log(
        `[MatchService] Player profiles: downloaded ${downloadedCount}, skipped ${skippedCount} (already local), failed ${failedCount}`
      );
    } catch (err) {
      console.error("[MatchService] Error downloading missing player profiles:", err);
      // Don't throw - this is a best-effort operation
    }
  }

  /**
   * Check if user is authenticated and return user ID if so.
   * Note: getSession() reads from local storage, not a network call.
   */
  private async getAuthenticatedUserId(): Promise<string | null> {
    try {
      const { data } = await supabase.auth.getSession();
      return data.session?.user?.id ?? null;
    } catch (err) {
      console.error("[MatchService] Error getting session:", err);
      return null;
    }
  }

  /**
   * Upload match to backend if user is authenticated and all players have valid profiles.
   * @returns true if uploaded successfully, false otherwise
   */
  private async uploadMatchIfAuthenticated(match: RemoteMatch): Promise<boolean> {
    try {
      const userId = await this.getAuthenticatedUserId();
      if (!userId) {
        console.log(`[MatchService] User not authenticated, skipping upload for match ${match.id}`);
        return false;
      }

      // Validate that all players have valid profiles before uploading
      const validation = await this.repo.validateMatchForSync(match);
      if (!validation.canSync) {
        console.log(`[MatchService] Match ${match.id} cannot be synced: ${validation.reason}`);
        return false;
      }

      console.log(`[MatchService] Uploading match ${match.id} for user ${userId}`);
      await this.repo.upsertToSupabase(match);

      // Mark match as synced in local storage
      const now = new Date().toISOString();
      const syncedMatch: RemoteMatch = {
        ...match,
        synced_at: now,
      };
      await this.repo.save(syncedMatch);
      console.log(`[MatchService] Match ${match.id} synced_at set to ${now}`);

      return true;
    } catch (err) {
      console.error("[MatchService] Error uploading match to backend:", err);
      return false;
    }
  }

  /**
   * Schedule a background upload of a match to the backend
   */
  private scheduleBackgroundUpload(match: RemoteMatch): void {
    this.uploadMatchIfAuthenticated(match).catch((err) => {
      console.error("[MatchService] Unexpected error in background upload:", err);
    });
  }

  /**
   * Fingerprint ensures both sides produce identical signed match record
   * for verification. Includes players + scores + venue.
   */
  private computeFingerprint(input: ICreateMatchInput | RemoteMatch): string {
    return computeMatchFingerprint(input);
  }

  /**
   * Create a new match with auto-verification for the creator's team.
   * 
   * When a participant creates a match:
   * - Their team is automatically considered as having verified (they approve their own score entry)
   * - Only the OTHER team needs to verify the match
   * 
   * When a non-participant (spectator) creates a match:
   * - Both teams need to verify the match
   */
  async createMatch(input: ICreateMatchInput): Promise<RemoteMatch> {
    const now = new Date().toISOString();

    // Determine which team the creator belongs to (if any)
    // Note: creatorTeam is null if input.created_by is null or if creator is not a participant
    const creatorTeam = input.created_by
      ? this.getProfileTeamFromPlayers(input, input.created_by)
      : null;

    // Set verification status based on who is creating the match:
    // - If creator is on team 1: auto-verify team 1, require team 2 verification
    // - If creator is on team 2: auto-verify team 2, require team 1 verification
    // - If creator is not a participant (spectator): require both teams to verify
    let team1_verified_by: string | null = null;
    let team1_verified_at: string | null = null;
    let team2_verified_by: string | null = null;
    let team2_verified_at: string | null = null;

    if (creatorTeam === 1) {
      team1_verified_by = input.created_by;
      team1_verified_at = now;
    } else if (creatorTeam === 2) {
      team2_verified_by = input.created_by;
      team2_verified_at = now;
    }
    // If creatorTeam is null (spectator or no creator), both verifications stay null

    const match: RemoteMatch = {
      id: randomUUID(),
      created_by: input.created_by,

      team1_player1: input.team1_player1,
      team1_player2: input.team1_player2,
      team2_player1: input.team2_player1,
      team2_player2: input.team2_player2,

      score_team1: input.score_team1,
      score_team2: input.score_team2,

      // New fields for tracking updates and verification
      last_updated_by: input.created_by,
      version: 1,

      // Team-specific verification (auto-verify creator's team)
      team1_verified_by,
      team1_verified_at,
      team2_verified_by,
      team2_verified_at,

      // Overall verification status
      is_verified: false,
      verified_by: null,
      verified_at: null,

      fingerprint: this.computeFingerprint(input),
      venue_id: input.venue_id,

      created_at: now,
      updated_at: now,
    };

    await this.repo.save(match);

    // Upload to backend if user is signed in (non-blocking)
    this.scheduleBackgroundUpload(match);

    return match;
  }

  /**
   * Mark match as verified by given profile.
   * @deprecated Use verifyMatchForTeam for dual-team verification workflow
   */
  async verifyMatch(matchId: string, profileId: string): Promise<RemoteMatch> {
    const match = await this.repo.getById(matchId);
    if (!match) throw new Error("Match not found");

    const profile = await this.profiles.getProfile(profileId);
    if (!profile) throw new Error("Profile not found");

    const now = new Date().toISOString();
    const updated: RemoteMatch = {
      ...match,
      is_verified: true,
      verified_by: profileId,
      verified_at: now,
      updated_at: now,
    };

    await this.repo.save(updated);

    // Upload to backend if user is signed in (non-blocking)
    this.scheduleBackgroundUpload(updated);

    return updated;
  }

  /**
   * Verify a match that exists in Supabase backend.
   * This is used when verifying a match recorded by another user.
   * Updates both remote and local storage.
   * @deprecated Use verifyMatchForTeamRemote for dual-team verification workflow
   */
  async verifyMatchRemote(matchId: string, profileId: string): Promise<RemoteMatch | null> {
    try {
      // First verify in Supabase
      await this.repo.verifyMatchInSupabase(matchId, profileId);
      console.log(`[MatchService] Match ${matchId} verified in Supabase by profile ${profileId}`);

      // Update local storage
      const match = await this.repo.getById(matchId);
      if (match) {
        const now = new Date().toISOString();
        const updated: RemoteMatch = {
          ...match,
          is_verified: true,
          verified_by: profileId,
          verified_at: now,
          updated_at: now,
        };
        await this.repo.save(updated);
        return updated;
      }

      return null;
    } catch (err) {
      console.error("[MatchService] Error verifying match remotely:", err);
      throw err;
    }
  }

  /**
   * Determine which team a profile belongs to based on player positions.
   * Returns 1 for team1, 2 for team2, or null if not a participant.
   */
  private getProfileTeamFromPlayers(
    players: {
      team1_player1: string | null;
      team1_player2: string | null;
      team2_player1: string | null;
      team2_player2: string | null;
    },
    profileId: string
  ): 1 | 2 | null {
    if (profileId === players.team1_player1 || profileId === players.team1_player2) {
      return 1;
    }
    if (profileId === players.team2_player1 || profileId === players.team2_player2) {
      return 2;
    }
    return null;
  }

  /**
   * Determine which team a profile belongs to in a match.
   * Returns 1 for team1, 2 for team2, or null if not a participant.
   */
  private getProfileTeam(match: RemoteMatch, profileId: string): 1 | 2 | null {
    return this.getProfileTeamFromPlayers(match, profileId);
  }

  /**
   * Mark match as verified by given profile's team.
   * Uses dual-team verification: match is fully verified when both teams verify.
   */
  async verifyMatchForTeam(matchId: string, profileId: string): Promise<RemoteMatch> {
    const match = await this.repo.getById(matchId);
    if (!match) throw new Error("Match not found");

    const profile = await this.profiles.getProfile(profileId);
    if (!profile) throw new Error("Profile not found");

    // Determine which team the profile belongs to
    const team = this.getProfileTeam(match, profileId);
    if (team === null) {
      throw new Error("Profile is not a participant in this match");
    }

    const now = new Date().toISOString();
    let updated: RemoteMatch;

    if (team === 1) {
      updated = {
        ...match,
        team1_verified_by: profileId,
        team1_verified_at: now,
        updated_at: now,
      };
    } else {
      updated = {
        ...match,
        team2_verified_by: profileId,
        team2_verified_at: now,
        updated_at: now,
      };
    }

    // Check if both teams have verified
    if (updated.team1_verified_by && updated.team2_verified_by) {
      updated.is_verified = true;
      updated.verified_at = now;
      updated.verified_by = profileId; // Last verifier
    }

    await this.repo.save(updated);

    // Upload to backend if user is signed in (non-blocking)
    this.scheduleBackgroundUpload(updated);

    return updated;
  }

  /**
   * Verify a match for a team in Supabase backend using the RPC function.
   * This handles race conditions properly on the server side.
   * Updates both remote and local storage.
   */
  async verifyMatchForTeamRemote(matchId: string, profileId: string): Promise<RemoteMatch | null> {
    try {
      // Use the RPC function that handles team determination and race conditions
      const updatedMatch = await this.repo.verifyMatchForTeamInSupabase(matchId, profileId);
      
      if (updatedMatch) {
        console.log(`[MatchService] Match ${matchId} verified for team in Supabase by profile ${profileId}`);
        
        // Update local storage with the returned match
        await this.repo.save({
          ...updatedMatch,
          synced_at: new Date().toISOString(),
        });
        
        return updatedMatch;
      }

      return null;
    } catch (err) {
      console.error("[MatchService] Error verifying match for team remotely:", err);
      throw err;
    }
  }

  /**
   * Update selected match fields
   * Verified matches cannot be updated.
   */
  async updateMatch(
    id: string,
    fields: Partial<RemoteMatch>
  ): Promise<RemoteMatch> {
    const match = await this.repo.getById(id);
    if (!match) throw new Error("Match not found");

    // Prevent updating verified matches
    if (match.is_verified) {
      throw new Error("Cannot update a verified match");
    }

    const updated: RemoteMatch = {
      ...match,
      ...fields,
      updated_at: new Date().toISOString(),
    };

    await this.repo.save(updated);

    // Upload to backend if user is signed in (non-blocking)
    this.scheduleBackgroundUpload(updated);

    return updated;
  }

  /**
   * Update match score locally and track who made the update.
   * This allows participants to dispute/correct scores before verification.
   * Verified matches cannot be updated.
   * 
   * When a participant updates the score:
   * - Their team is automatically considered as having verified (they approve their own change)
   * - Only the OTHER team needs to verify the updated score
   * 
   * When a non-participant (spectator) updates the score:
   * - Both teams need to verify the updated score
   */
  async updateMatchScore(
    matchId: string,
    scoreTeam1: number,
    scoreTeam2: number,
    updatedBy: string
  ): Promise<RemoteMatch> {
    const match = await this.repo.getById(matchId);
    if (!match) throw new Error("Match not found");

    // Prevent updating verified matches
    if (match.is_verified) {
      throw new Error("Cannot update a verified match");
    }

    const now = new Date().toISOString();
    
    // Determine which team the updater belongs to (if any)
    const updaterTeam = this.getProfileTeam(match, updatedBy);
    
    // Set verification status based on who is making the update:
    // - If updater is on team 1: auto-verify team 1, require team 2 verification
    // - If updater is on team 2: auto-verify team 2, require team 1 verification
    // - If updater is not a participant (spectator): require both teams to verify
    let team1_verified_by: string | null = null;
    let team1_verified_at: string | null = null;
    let team2_verified_by: string | null = null;
    let team2_verified_at: string | null = null;
    
    if (updaterTeam === 1) {
      // Team 1 member is updating - they auto-verify, team 2 needs to verify
      team1_verified_by = updatedBy;
      team1_verified_at = now;
    } else if (updaterTeam === 2) {
      // Team 2 member is updating - they auto-verify, team 1 needs to verify
      team2_verified_by = updatedBy;
      team2_verified_at = now;
    }
    // If updaterTeam is null (spectator), both verifications stay null
    
    const updated: RemoteMatch = {
      ...match,
      score_team1: scoreTeam1,
      score_team2: scoreTeam2,
      last_updated_by: updatedBy,
      version: (match.version || 1) + 1,
      team1_verified_by,
      team1_verified_at,
      team2_verified_by,
      team2_verified_at,
      fingerprint: this.computeFingerprint({
        ...match,
        score_team1: scoreTeam1,
        score_team2: scoreTeam2,
      }),
      updated_at: now,
    };

    await this.repo.save(updated);

    // Upload to backend if user is signed in (non-blocking)
    this.scheduleBackgroundUpload(updated);

    return updated;
  }

  /**
   * Update match score in Supabase with optimistic locking.
   * Uses RPC function that checks version to prevent lost updates from race conditions.
   * If another user updated the match, the version will not match and an error will be thrown.
   */
  async updateMatchScoreRemote(
    matchId: string,
    scoreTeam1: number,
    scoreTeam2: number,
    expectedVersion: number,
    updatedBy: string
  ): Promise<RemoteMatch | null> {
    try {
      const updatedMatch = await this.repo.updateMatchScoreInSupabase(
        matchId,
        scoreTeam1,
        scoreTeam2,
        expectedVersion,
        updatedBy
      );

      if (updatedMatch) {
        console.log(`[MatchService] Match ${matchId} score updated in Supabase by profile ${updatedBy}`);

        // Update local storage with the returned match
        await this.repo.save({
          ...updatedMatch,
          synced_at: new Date().toISOString(),
        });

        return updatedMatch;
      }

      return null;
    } catch (err) {
      console.error("[MatchService] Error updating match score remotely:", err);
      throw err;
    }
  }

  /**
   * Delete a match.
   * Verified matches cannot be deleted.
   */
  async deleteMatch(id: string): Promise<void> {
    const match = await this.repo.getById(id);

    // Prevent deleting verified matches
    if (match?.is_verified) {
      throw new Error("Cannot delete a verified match");
    }

    // Delete from local storage
    await this.repo.remove(id);

    // Delete from Supabase if user is authenticated
    try {
      const userId = await this.getAuthenticatedUserId();
      if (userId) {
        console.log(`[MatchService] Deleting match ${id} from Supabase for user ${userId}`);
        await this.repo.deleteFromSupabase(id);
      }
    } catch (err) {
      console.error("[MatchService] Error deleting match from backend:", err);
    }
  }

  async deleteAll(): Promise<void> {
    await this.repo.clearAll();
  }
}
