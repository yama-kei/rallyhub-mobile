// src/lib/data/services/ClaimProfileService.ts

import { RemoteProfile, RemoteMatch } from "@/lib/supabase/types";
import type { RallyHubQRPayload } from "@/lib/qr/QRPayloadBuilder";
import { QRPayloadBuilder } from "@/lib/qr/QRPayloadBuilder";
import { ProfileRepository } from "../repositories/ProfileRepository";
import { MatchRepository } from "../repositories/MatchRepository";

export interface ClaimResult {
  success: boolean;
  claimedProfile: RemoteProfile | null;
  updatedMatchCount: number;
  error?: string;
}

export interface IClaimProfileService {
  /**
   * Get all placeholder profiles that can be claimed (not yet claimed by anyone).
   * @param excludeProfileId - Optional profile ID to exclude from the list (e.g., the current user's own profile)
   */
  getUnclaimedPlaceholders(excludeProfileId?: string): Promise<RemoteProfile[]>;

  /**
   * Claim a placeholder profile using a real user's QR code.
   * 
   * @param placeholderId - The ID of the placeholder profile to be claimed
   * @param realUserQRPayload - The QR payload from the real user who will claim this profile
   * @returns ClaimResult with success status and details
   */
  claimPlaceholder(
    placeholderId: string,
    realUserQRPayload: RallyHubQRPayload
  ): Promise<ClaimResult>;

  /**
   * Update all local match references from old profile ID to new profile ID.
   * Used when a placeholder is replaced by a real profile and needs ID migration.
   */
  updateMatchReferences(
    oldProfileId: string,
    newProfileId: string
  ): Promise<number>;
}

export class ClaimProfileService implements IClaimProfileService {
  private profileRepo: ProfileRepository;
  private matchRepo: MatchRepository;

  /**
   * Constructor requires both repositories to be provided to avoid creating
   * inconsistent repository instances. Use DataEnvironment for proper dependency injection.
   */
  constructor(profileRepo: ProfileRepository, matchRepo: MatchRepository) {
    this.profileRepo = profileRepo;
    this.matchRepo = matchRepo;
  }

  /**
   * Get all placeholder profiles that haven't been claimed yet.
   * @param excludeProfileId - Optional profile ID to exclude from the list (e.g., the current user's own profile)
   */
  async getUnclaimedPlaceholders(excludeProfileId?: string): Promise<RemoteProfile[]> {
    const allProfiles = await this.profileRepo.list();
    return allProfiles.filter(
      (p) => p.is_placeholder && !p.claimed_by && !p.user_id && p.id !== excludeProfileId
    );
  }

  /**
   * Claim a placeholder profile using a real user's QR code.
   * 
   * Steps:
   * 1. Validate the QR payload represents a real (non-placeholder) profile
   * 2. Validate the target profile is a placeholder
   * 3. Update the placeholder with real user's info
   * 4. Update all local match references
   */
  async claimPlaceholder(
    placeholderId: string,
    realUserQRPayload: RallyHubQRPayload
  ): Promise<ClaimResult> {
    // Step 1: Validate QR payload is from a real profile
    if (!QRPayloadBuilder.isRealProfile(realUserQRPayload)) {
      return {
        success: false,
        claimedProfile: null,
        updatedMatchCount: 0,
        error: "Cannot claim with a placeholder profile. The scanned QR must be from a registered user.",
      };
    }

    // Step 2: Get the placeholder profile
    const placeholder = await this.profileRepo.getById(placeholderId);
    if (!placeholder) {
      return {
        success: false,
        claimedProfile: null,
        updatedMatchCount: 0,
        error: "Placeholder profile not found.",
      };
    }

    // Verify it's actually a placeholder that can be claimed
    if (!placeholder.is_placeholder) {
      return {
        success: false,
        claimedProfile: null,
        updatedMatchCount: 0,
        error: "This profile is not a placeholder and cannot be claimed.",
      };
    }

    if (placeholder.claimed_by) {
      return {
        success: false,
        claimedProfile: null,
        updatedMatchCount: 0,
        error: "This placeholder has already been claimed.",
      };
    }

    // Step 3: Fetch the real user's profile to get their user_id
    const realProfile = await this.profileRepo.fetchProfileByIdFromSupabase(
      realUserQRPayload.profileId
    );

    // If we can't fetch from Supabase, try local storage
    const localRealProfile = await this.profileRepo.getById(
      realUserQRPayload.profileId
    );

    const realUserId = realProfile?.user_id ?? localRealProfile?.user_id;

    if (!realUserId) {
      return {
        success: false,
        claimedProfile: null,
        updatedMatchCount: 0,
        error: "Could not verify the real user's identity. The scanned profile must be linked to a signed-in account.",
      };
    }

    // Step 4: Update the placeholder profile
    // The profile ID stays the same, but we update the profile data to link it
    // to the real user. This means all existing matches that reference this
    // placeholder profile ID will automatically belong to the real user now.
    const now = new Date().toISOString();
    const claimedProfile: RemoteProfile = {
      ...placeholder,
      user_id: realUserId,
      claimed_by: realUserId,
      is_placeholder: false,
      display_name: realUserQRPayload.display_name,
      updated_at: now,
    };

    await this.profileRepo.save(claimedProfile);

    // Step 5: Sync matches containing this profile to Supabase
    // Now that the profile has a user_id, matches that were previously blocked
    // from syncing (because they had placeholder players) can be uploaded.
    const updatedMatchCount = await this.syncMatchesForProfile(placeholderId);

    return {
      success: true,
      claimedProfile,
      updatedMatchCount,
    };
  }

  /**
   * Sync all matches containing the given profile ID to Supabase.
   * This is called after claiming a profile to ensure matches that were
   * previously blocked (due to placeholder players) can now be uploaded.
   * @returns Number of matches successfully synced
   */
  private async syncMatchesForProfile(profileId: string): Promise<number> {
    const matches = await this.matchRepo.list();
    let syncedCount = 0;

    for (const match of matches) {
      // Check if this match contains the claimed profile
      const containsProfile =
        match.team1_player1 === profileId ||
        match.team1_player2 === profileId ||
        match.team2_player1 === profileId ||
        match.team2_player2 === profileId ||
        match.created_by === profileId;

      if (!containsProfile) {
        continue;
      }

      // Validate that the match can now be synced (all players have user_id)
      const validation = await this.matchRepo.validateMatchForSync(match);
      if (!validation.canSync) {
        console.log(
          `[ClaimProfileService] Match ${match.id} still cannot be synced: ${validation.reason}`
        );
        continue;
      }

      // Upload the match to Supabase
      try {
        await this.matchRepo.upsertToSupabase(match);

        // Mark match as synced in local storage
        const now = new Date().toISOString();
        await this.matchRepo.save({
          ...match,
          synced_at: now,
        });

        syncedCount++;
        console.log(
          `[ClaimProfileService] Successfully synced match ${match.id} after claiming profile ${profileId}`
        );
      } catch (err) {
        console.error(
          `[ClaimProfileService] Failed to sync match ${match.id}:`,
          err
        );
      }
    }

    return syncedCount;
  }

  /**
   * Update all local match references from old profile ID to new profile ID.
   * This is used when we need to migrate match records to a different profile ID,
   * such as when merging two distinct profile records.
   * 
   * Note: This is NOT called during normal claim operations because the profile ID
   * stays the same - we only update the profile data to link it to the real user.
   */
  async updateMatchReferences(
    oldProfileId: string,
    newProfileId: string
  ): Promise<number> {
    const matches = await this.matchRepo.list();
    let updateCount = 0;

    for (const match of matches) {
      let needsUpdate = false;
      const updatedMatch: RemoteMatch = { ...match };

      if (match.team1_player1 === oldProfileId) {
        updatedMatch.team1_player1 = newProfileId;
        needsUpdate = true;
      }
      if (match.team1_player2 === oldProfileId) {
        updatedMatch.team1_player2 = newProfileId;
        needsUpdate = true;
      }
      if (match.team2_player1 === oldProfileId) {
        updatedMatch.team2_player1 = newProfileId;
        needsUpdate = true;
      }
      if (match.team2_player2 === oldProfileId) {
        updatedMatch.team2_player2 = newProfileId;
        needsUpdate = true;
      }
      if (match.created_by === oldProfileId) {
        updatedMatch.created_by = newProfileId;
        needsUpdate = true;
      }
      if (match.verified_by === oldProfileId) {
        updatedMatch.verified_by = newProfileId;
        needsUpdate = true;
      }

      if (needsUpdate) {
        updatedMatch.updated_at = new Date().toISOString();
        await this.matchRepo.save(updatedMatch);
        updateCount++;
      }
    }

    return updateCount;
  }
}
