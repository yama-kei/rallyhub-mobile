// src/lib/data/repositories/MatchRepository.ts

import { RemoteMatch } from "@/lib/supabase/types";
import { supabase } from "@/lib/supabase/supabaseClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { computeMatchFingerprint } from "../utils/matchFingerprint";
import { ProfileRepository } from "./ProfileRepository";

const STORAGE_KEY = "rh:matches";

export interface MatchSyncValidation {
  canSync: boolean;
  unsyncableProfileIds: string[];
  reason?: string;
}

export interface IMatchRepository {
  list(): Promise<RemoteMatch[]>;
  getById(id: string): Promise<RemoteMatch | null>;
  save(match: RemoteMatch): Promise<void>;
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
  fetchFromSupabase(profileId: string): Promise<RemoteMatch[]>;
  fetchMatchesByProfileId(profileId: string): Promise<RemoteMatch[]>;
  fetchVerifiedMatchesByProfileId(profileId: string): Promise<RemoteMatch[]>;
  upsertToSupabase(match: RemoteMatch): Promise<void>;
  deleteFromSupabase(id: string): Promise<void>;
  validateMatchForSync(match: RemoteMatch): Promise<MatchSyncValidation>;
  verifyMatchInSupabase(matchId: string, profileId: string): Promise<void>;
  verifyMatchForTeamInSupabase(matchId: string, profileId: string): Promise<RemoteMatch | null>;
  updateMatchScoreInSupabase(matchId: string, scoreTeam1: number, scoreTeam2: number, expectedVersion: number, updatedBy: string): Promise<RemoteMatch | null>;
}

export class MatchRepository implements IMatchRepository {
  private profileRepo: ProfileRepository;

  /**
   * Constructor for MatchRepository.
   * @param profileRepo - ProfileRepository instance for validating player profiles.
   *                      When using DataEnvironment, pass the shared ProfileRepository
   *                      to ensure consistent data access across the application.
   */
  constructor(profileRepo?: ProfileRepository) {
    this.profileRepo = profileRepo ?? new ProfileRepository();
  }

  async list(): Promise<RemoteMatch[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as RemoteMatch[];
    } catch (err) {
      console.error("[MatchRepository] list error:", err);
      return [];
    }
  }

  async getById(id: string): Promise<RemoteMatch | null> {
    const all = await this.list();
    return all.find((m) => m.id === id) ?? null;
  }

  async save(match: RemoteMatch): Promise<void> {
    const all = await this.list();
    const idx = all.findIndex((m) => m.id === match.id);

    const now = new Date().toISOString();
    const updated: RemoteMatch = {
      ...match,
      updated_at: match.updated_at ?? now,
      created_at: match.created_at ?? now,
    };

    if (idx >= 0) all[idx] = updated;
    else all.push(updated);

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  async remove(id: string): Promise<void> {
    const all = await this.list();
    const filtered = all.filter((m) => m.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }

  async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Fetch matches from Supabase backend for a specific profile.
   * Returns all matches where the profile is a participant (creator or player).
   */
  async fetchFromSupabase(profileId: string): Promise<RemoteMatch[]> {
    try {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .or(`created_by.eq.${profileId},team1_player1.eq.${profileId},team1_player2.eq.${profileId},team2_player1.eq.${profileId},team2_player2.eq.${profileId}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[MatchRepository] Supabase fetch error:", error);
        return [];
      }

      return data as RemoteMatch[];
    } catch (err) {
      console.error("[MatchRepository] fetchFromSupabase error:", err);
      return [];
    }
  }

  /**
   * Fetch all matches (verified or not) for a specific profile from Supabase
   * where the user is a participant. Used to retrieve matches recorded by
   * other users that include this profile as a player.
   */
  async fetchMatchesByProfileId(profileId: string): Promise<RemoteMatch[]> {
    try {
      // Validate UUID format to prevent injection
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(profileId)) {
        console.error("[MatchRepository] Invalid profile ID format:", profileId);
        return [];
      }

      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .or(`team1_player1.eq.${profileId},team1_player2.eq.${profileId},team2_player1.eq.${profileId},team2_player2.eq.${profileId}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[MatchRepository] Supabase fetch matches by profile error:", error);
        return [];
      }

      return data as RemoteMatch[];
    } catch (err) {
      console.error("[MatchRepository] fetchMatchesByProfileId error:", err);
      return [];
    }
  }

  /**
   * Fetch verified matches for a specific profile from Supabase
   * Used for viewing other player's match history
   */
  async fetchVerifiedMatchesByProfileId(profileId: string): Promise<RemoteMatch[]> {
    try {
      // Validate UUID format to prevent injection
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(profileId)) {
        console.error("[MatchRepository] Invalid profile ID format:", profileId);
        return [];
      }

      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .eq("is_verified", true)
        .or(`team1_player1.eq.${profileId},team1_player2.eq.${profileId},team2_player1.eq.${profileId},team2_player2.eq.${profileId}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[MatchRepository] Supabase fetch verified matches error:", error);
        return [];
      }

      return data as RemoteMatch[];
    } catch (err) {
      console.error("[MatchRepository] fetchVerifiedMatchesByProfileId error:", err);
      return [];
    }
  }

  /**
   * Upsert a match to Supabase backend
   */
  async upsertToSupabase(match: RemoteMatch): Promise<void> {
    try {
      // Ensure fingerprint is present, compute it if missing
      // Fingerprint is stored for potential future use but is not required to be unique
      const fingerprint = match.fingerprint || computeMatchFingerprint(match);

      // Build payload with only database columns (exclude local-only fields like synced_at)
      const matchPayload = {
        id: match.id,
        created_by: match.created_by,
        team1_player1: match.team1_player1,
        team1_player2: match.team1_player2,
        team2_player1: match.team2_player1,
        team2_player2: match.team2_player2,
        score_team1: match.score_team1,
        score_team2: match.score_team2,
        last_updated_by: match.last_updated_by,
        version: match.version,
        team1_verified_by: match.team1_verified_by,
        team1_verified_at: match.team1_verified_at,
        team2_verified_by: match.team2_verified_by,
        team2_verified_at: match.team2_verified_at,
        is_verified: match.is_verified,
        verified_by: match.verified_by,
        verified_at: match.verified_at,
        fingerprint: fingerprint,
        venue_id: match.venue_id,
        created_at: match.created_at,
        updated_at: match.updated_at,
      };

      // Upsert based on match ID (primary key)
      // Each match has a unique ID generated by the client (randomUUID)
      // Duplicate matches are allowed since fingerprints are no longer unique
      const { error } = await supabase
        .from("matches")
        .upsert(matchPayload as any);

      if (error) {
        console.error("[MatchRepository] Supabase upsert error:", error);
      }
    } catch (err) {
      console.error("[MatchRepository] upsertToSupabase error:", err);
    }
  }

  /**
   * Delete a match from Supabase backend
   */
  async deleteFromSupabase(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("matches")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("[MatchRepository] Supabase delete error:", error);
      }
    } catch (err) {
      console.error("[MatchRepository] deleteFromSupabase error:", err);
    }
  }

  /**
   * Validate if a match can be synced to Supabase.
   * A match can only be synced if all player profiles have a user_id
   * (are not pure placeholders).
   * 
   * This method first attempts to refresh profile data from Supabase
   * to check if any placeholder profiles have since been registered.
   * 
   * After validation, this method also uploads all player profiles to Supabase
   * to ensure foreign key constraints are satisfied when the match is inserted.
   */
  async validateMatchForSync(match: RemoteMatch): Promise<MatchSyncValidation> {
    const playerProfileIds = [
      match.team1_player1,
      match.team1_player2,
      match.team2_player1,
      match.team2_player2,
    ].filter((id): id is string => id != null);

    // First, try to refresh profile data from Supabase for any profiles
    // that don't have a user_id locally. This handles the case where
    // a player has signed in since we last saw their profile.
    await this.refreshProfilesFromSupabase(playerProfileIds);

    const result = await this.profileRepo.areProfilesSyncable(playerProfileIds);

    if (!result.allSyncable) {
      return {
        canSync: false,
        unsyncableProfileIds: result.unsyncableIds,
        reason: `Match cannot be synced: ${result.unsyncableIds.length} player(s) have placeholder profiles that haven't been claimed. All players must have registered accounts before the match can be uploaded.`,
      };
    }

    // Upload all player profiles to Supabase to ensure foreign key constraints
    // are satisfied when the match is inserted. This handles the case where
    // a player's profile exists locally with user_id but hasn't been uploaded yet.
    const failedProfileIds = await this.uploadPlayerProfilesToSupabase(playerProfileIds);

    if (failedProfileIds.length > 0) {
      return {
        canSync: false,
        unsyncableProfileIds: failedProfileIds,
        reason: `Match cannot be synced: Failed to upload ${failedProfileIds.length} player profile(s) to the server. Please try again later.`,
      };
    }

    return {
      canSync: true,
      unsyncableProfileIds: [],
    };
  }

  /**
   * Refresh profile data from Supabase for profiles that don't have a user_id locally.
   * This ensures we have the latest registration status for all players.
   */
  private async refreshProfilesFromSupabase(profileIds: string[]): Promise<void> {
    for (const profileId of profileIds) {
      const localProfile = await this.profileRepo.getById(profileId);
      
      // Only refresh if local profile doesn't have a user_id
      // (it might have been registered since we last saw it)
      if (localProfile && localProfile.user_id === null) {
        try {
          const remoteProfile = await this.profileRepo.fetchProfileByIdFromSupabase(profileId);
          
          // If we found a remote profile with a user_id, update local storage
          if (remoteProfile && remoteProfile.user_id !== null) {
            console.log(`[MatchRepository] Profile ${profileId} now has user_id, updating local storage`);
            await this.profileRepo.save(remoteProfile);
          }
        } catch (err) {
          console.error(`[MatchRepository] Failed to refresh profile ${profileId} from Supabase:`, err);
          // Continue with validation even if refresh fails
        }
      }
    }
  }

  /**
   * Upload all player profiles to Supabase to ensure they exist before
   * inserting a match. This is necessary because matches have foreign key
   * constraints on player profile IDs.
   * 
   * Registered profiles (is_placeholder === false) are skipped since they
   * should already exist in the backend - they are uploaded during sign-in.
   * 
   * @returns Array of profile IDs that failed to upload
   */
  private async uploadPlayerProfilesToSupabase(profileIds: string[]): Promise<string[]> {
    const failedIds: string[] = [];
    
    // Get all local profiles with user_id in parallel
    const profilePromises = profileIds.map(async (profileId) => {
      const localProfile = await this.profileRepo.getById(profileId);
      return { profileId, localProfile };
    });
    
    const profiles = await Promise.all(profilePromises);
    
    // Filter profiles that need to be uploaded:
    // - Must have a user_id (required for foreign key constraint in matches table)
    // - Must be a placeholder (registered profiles with is_placeholder=false are already in Supabase)
    // Note: In practice, this case (placeholder with user_id) is rare because when a placeholder
    // is claimed, is_placeholder is set to false at the same time. This filter primarily serves
    // to skip registered profiles and ensure we don't make unnecessary upload calls.
    const profilesToUpload = profiles.filter(
      (item): item is { profileId: string; localProfile: NonNullable<typeof item.localProfile> } =>
        item.localProfile !== null && 
        item.localProfile.user_id !== null && 
        item.localProfile.is_placeholder
    );

    if (profilesToUpload.length === 0) {
      return failedIds;
    }
    
    // Upload placeholder profiles concurrently
    const uploadResults = await Promise.allSettled(
      profilesToUpload.map(async ({ profileId, localProfile }) => {
        console.log(`[MatchRepository] Uploading player profile ${profileId} to Supabase`);
        await this.profileRepo.upsertToSupabase(localProfile);
        return profileId;
      })
    );
    
    // Collect failed profile IDs
    for (let i = 0; i < uploadResults.length; i++) {
      const result = uploadResults[i];
      if (result.status === "rejected") {
        const profileId = profilesToUpload[i].profileId;
        console.error(`[MatchRepository] Failed to upload profile ${profileId} to Supabase:`, result.reason);
        failedIds.push(profileId);
      }
    }
    
    return failedIds;
  }

  /**
   * Verify a match in Supabase backend.
   * This updates the match record to mark it as verified by the given profile.
   * @deprecated Use verifyMatchForTeamInSupabase for dual-team verification
   */
  async verifyMatchInSupabase(matchId: string, profileId: string): Promise<void> {
    try {
      // Validate UUID format to prevent injection
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(matchId) || !uuidRegex.test(profileId)) {
        console.error("[MatchRepository] Invalid match or profile ID format");
        return;
      }

      const now = new Date().toISOString();

      // Use raw SQL update via rpc or direct update
      // Cast to any to bypass strict type checking since Supabase types don't match our usage
      const { error } = await (supabase
        .from("matches") as any)
        .update({
          is_verified: true,
          verified_by: profileId,
          verified_at: now,
          updated_at: now,
        })
        .eq("id", matchId);

      if (error) {
        console.error("[MatchRepository] Supabase verify match error:", error);
        throw error;
      }
    } catch (err) {
      console.error("[MatchRepository] verifyMatchInSupabase error:", err);
      throw err;
    }
  }

  /**
   * Verify a match for a specific team in Supabase backend.
   * Uses RPC function that determines which team the profile belongs to
   * and updates the appropriate team verification fields.
   * Match becomes fully verified when both teams have verified.
   */
  async verifyMatchForTeamInSupabase(matchId: string, profileId: string): Promise<RemoteMatch | null> {
    try {
      // Validate UUID format to prevent injection
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(matchId) || !uuidRegex.test(profileId)) {
        console.error("[MatchRepository] Invalid match or profile ID format");
        return null;
      }

      // Cast to any to call custom RPC function that's not in auto-generated types
      const { data, error } = await (supabase as any).rpc("rpc_verify_match_for_team", {
        p_match_id: matchId,
        p_profile_id: profileId,
      });

      if (error) {
        console.error("[MatchRepository] Supabase verify match for team error:", error);
        throw error;
      }

      // Fetch the updated match to get all fields
      const { data: matchData, error: fetchError } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (fetchError) {
        console.error("[MatchRepository] Error fetching updated match:", fetchError);
        return null;
      }

      return matchData as RemoteMatch;
    } catch (err) {
      console.error("[MatchRepository] verifyMatchForTeamInSupabase error:", err);
      throw err;
    }
  }

  /**
   * Update match score in Supabase with optimistic locking.
   * Uses RPC function that checks version to prevent lost updates from race conditions.
   * @throws Error if version mismatch (match was updated by someone else)
   */
  async updateMatchScoreInSupabase(
    matchId: string,
    scoreTeam1: number,
    scoreTeam2: number,
    expectedVersion: number,
    updatedBy: string
  ): Promise<RemoteMatch | null> {
    try {
      // Validate UUID format to prevent injection
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(matchId) || !uuidRegex.test(updatedBy)) {
        console.error("[MatchRepository] Invalid match or profile ID format");
        return null;
      }

      // Cast to any to call custom RPC function that's not in auto-generated types
      const { data, error } = await (supabase as any).rpc("rpc_update_match_score", {
        p_match_id: matchId,
        p_score_team1: scoreTeam1,
        p_score_team2: scoreTeam2,
        p_expected_version: expectedVersion,
        p_updated_by: updatedBy,
      });

      if (error) {
        // Check if this is a version mismatch error
        // PostgreSQL serialization_failure has SQLSTATE 40001
        // Supabase may return it differently, so also check message
        if (
          error.code === "40001" ||
          error.code === "P0001" ||
          error.message?.includes("Version mismatch")
        ) {
          throw new Error("MATCH_VERSION_CONFLICT: The match was updated by someone else. Please refresh and try again.");
        }
        console.error("[MatchRepository] Supabase update match score error:", error);
        throw error;
      }

      // Fetch the updated match to get all fields
      const { data: matchData, error: fetchError } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (fetchError) {
        console.error("[MatchRepository] Error fetching updated match:", fetchError);
        return null;
      }

      return matchData as RemoteMatch;
    } catch (err) {
      console.error("[MatchRepository] updateMatchScoreInSupabase error:", err);
      throw err;
    }
  }
}
