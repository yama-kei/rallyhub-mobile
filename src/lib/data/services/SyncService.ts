// src/lib/data/services/SyncService.ts

import { ProfileConflictError } from "@/lib/utils/errors";
import { ProfileRepository } from "../repositories/ProfileRepository";
import { MatchRepository } from "../repositories/MatchRepository";
import { KnownUserRepository } from "../repositories/KnownUserRepository";
import { KnownUserService } from "./KnownUserService";

/**
 * Service to sync local AsyncStorage data with Supabase backend.
 * Uploads local profiles and matches, then downloads remote data.
 */
export class SyncService {
  private profileRepo: ProfileRepository;
  private matchRepo: MatchRepository;
  private knownUserRepo: KnownUserRepository;
  private knownUserService: KnownUserService;

  constructor(
    profileRepo?: ProfileRepository,
    matchRepo?: MatchRepository,
    knownUserRepo?: KnownUserRepository,
    knownUserService?: KnownUserService
  ) {
    this.profileRepo = profileRepo ?? new ProfileRepository();
    this.matchRepo = matchRepo ?? new MatchRepository();
    this.knownUserRepo = knownUserRepo ?? new KnownUserRepository();
    this.knownUserService = knownUserService ?? new KnownUserService(this.knownUserRepo, this.profileRepo);
  }

  async syncAll(userId: string): Promise<void> {
    if (!userId) {
      console.log("[SyncService] No userId provided, skipping sync");
      return;
    }

    console.log(`[SyncService] Starting sync for auth user ${userId}`);

    try {
      // First, ensure the current device's profile is linked to this user
      await this.linkDeviceProfileToUser(userId);

      // Get the user's profile ID (profile.user_id === userId)
      const userProfile = await this.getUserProfile(userId);
      const profileId = userProfile?.id ?? null;
      
      console.log(`[SyncService] User profile ID: ${profileId}`);

      // Upload local profiles to Supabase
      await this.uploadProfiles(userId, profileId);

      // Upload local matches to Supabase
      await this.uploadMatches(userId, profileId);

      // Download profiles from Supabase
      await this.downloadProfiles(userId);

      // Sync known users BEFORE downloading matches
      // This ensures that when matches are downloaded, the profiles for all
      // players are already available locally, avoiding "Unknown player" issues
      await this.knownUserService.syncKnownUsers(userId);

      // Download matches from Supabase (after known users are synced)
      await this.downloadMatches(profileId);

      console.log("[SyncService] Sync completed successfully");
    } catch (error) {
      // Re-throw ProfileConflictError to allow callers to handle it
      if (error instanceof ProfileConflictError) {
        throw error;
      }
      console.error("[SyncService] Sync failed:", error);
    }
  }

  /**
   * Get the user's profile (where profile.user_id === auth user ID)
   */
  private async getUserProfile(userId: string) {
    try {
      const localProfiles = await this.profileRepo.list();
      // Find profile owned by this user
      return localProfiles.find((p) => p.user_id === userId) ?? null;
    } catch (error) {
      console.error("[SyncService] Failed to get user profile:", error);
      return null;
    }
  }

  /**
   * Link the current device's profile to the authenticated user.
   * This is called when a user signs in to ensure their local profile
   * is associated with their auth account.
   * 
   * IMPORTANT: This method also uploads the profile to Supabase immediately
   * so that other users who have recorded matches with this user can see
   * that the profile is now registered (has a user_id).
   */
  private async linkDeviceProfileToUser(userId: string): Promise<void> {
    // Import dynamically to avoid circular dependencies
    const { LocalProfileLinkService } = await import("./LocalProfileLinkService");
    const linkService = new LocalProfileLinkService();
    
    const deviceLink = await linkService.getLinkForDevice();
    
    if (!deviceLink) {
      console.log("[SyncService] No device link found, skipping profile linking");
      return;
    }

    const profile = await this.profileRepo.getById(deviceLink.profile_id);
    
    if (!profile) {
      console.log("[SyncService] Device profile not found, skipping linking");
      return;
    }

    // If profile already has this user_id, ensure it's uploaded to Supabase
    if (profile.user_id === userId) {
      console.log("[SyncService] Profile already linked to user, ensuring it's uploaded to Supabase");
      await this.profileRepo.upsertToSupabase(profile);
      return;
    }

    // If profile has a different user_id, don't override it
    if (profile.user_id && profile.user_id !== userId) {
      console.warn("[SyncService] Profile already owned by different user, skipping");
      return;
    }

    // Check if the user already has a profile in Supabase with a different ID
    // This prevents conflicts when a user creates a new local profile on a device
    // but already has an existing profile associated with their identity
    const existingRemoteProfile = await this.profileRepo.fetchProfileByUserIdFromSupabase(userId);
    
    if (existingRemoteProfile && existingRemoteProfile.id !== profile.id) {
      console.warn(
        `[SyncService] User ${userId} already has profile ${existingRemoteProfile.id} in Supabase, ` +
        `but device is linked to different profile ${profile.id}. Blocking sign-in.`
      );
      throw new ProfileConflictError();
    }

    // Link the profile to this user and mark as real profile
    console.log(`[SyncService] Linking device profile ${profile.id} to user ${userId}`);
    const updatedProfile = {
      ...profile,
      user_id: userId,
      is_placeholder: false,
      updated_at: new Date().toISOString(),
    };
    
    // Save locally first
    await this.profileRepo.save(updatedProfile);
    console.log("[SyncService] Device profile linked to user locally");
    
    // Then immediately upload to Supabase so other users can see the updated status
    // This is critical: other users who have recorded matches with this user
    // need to be able to fetch the updated profile to upload their matches
    console.log("[SyncService] Uploading profile to Supabase...");
    await this.profileRepo.upsertToSupabase(updatedProfile);
    console.log("[SyncService] Device profile uploaded to Supabase successfully");
  }

  private async uploadProfiles(userId: string, profileId: string | null): Promise<void> {
    try {
      const localProfiles = await this.profileRepo.list();
      console.log(`[SyncService] Uploading ${localProfiles.length} profiles`);

      // Upload profiles that belong to this user:
      // - user_id === userId: Profiles directly owned by this user
      // - claimed_by === userId: Placeholder profiles claimed by this user
      const profilesToUpload = localProfiles.filter(
        (p) => p.user_id === userId || p.claimed_by === userId
      );

      console.log(`[SyncService] Found ${profilesToUpload.length} profiles to upload for user ${userId}`);

      for (const profile of profilesToUpload) {
        await this.profileRepo.upsertToSupabase(profile);
      }
    } catch (error) {
      console.error("[SyncService] Upload profiles failed:", error);
    }
  }

  private async uploadMatches(userId: string, profileId: string | null): Promise<void> {
    try {
      const localMatches = await this.matchRepo.list();
      console.log(`[SyncService] Uploading ${localMatches.length} matches`);

      // Only sync if we have a profile ID
      if (!profileId) {
        console.warn("[SyncService] No profile ID available, skipping match upload");
        return;
      }

      // Upload matches created by this user's profile that haven't been synced yet
      // The !m.synced_at check handles null, undefined, and empty string cases
      const matchesToUpload = localMatches.filter(
        (m) => m.created_by === profileId && !m.synced_at
      );

      console.log(`[SyncService] Found ${matchesToUpload.length} matches to upload for profile ${profileId}`);

      let uploadedCount = 0;
      let skippedCount = 0;

      for (const match of matchesToUpload) {
        // Validate that all players have valid profiles before uploading
        const validation = await this.matchRepo.validateMatchForSync(match);
        
        if (!validation.canSync) {
          console.log(`[SyncService] Skipping match ${match.id}: ${validation.reason}`);
          skippedCount++;
          continue;
        }

        await this.matchRepo.upsertToSupabase(match);

        // Mark match as synced in local storage
        const now = new Date().toISOString();
        await this.matchRepo.save({
          ...match,
          synced_at: now,
        });

        uploadedCount++;
      }

      console.log(`[SyncService] Uploaded ${uploadedCount} matches, skipped ${skippedCount} (placeholder players)`);
    } catch (error) {
      console.error("[SyncService] Upload matches failed:", error);
    }
  }

  private async downloadProfiles(userId: string): Promise<void> {
    try {
      const remoteProfiles = await this.profileRepo.fetchFromSupabase(userId);
      console.log(
        `[SyncService] Downloaded ${remoteProfiles.length} profiles from Supabase`
      );

      // Merge remote profiles with local storage
      const localProfiles = await this.profileRepo.list();
      const localProfileIds = new Set(localProfiles.map((p) => p.id));

      for (const remoteProfile of remoteProfiles) {
        // Only save if not already in local storage or if remote is newer
        const localProfile = localProfiles.find((p) => p.id === remoteProfile.id);
        if (!localProfile || remoteProfile.updated_at > localProfile.updated_at) {
          await this.profileRepo.save(remoteProfile);
        }
      }
    } catch (error) {
      console.error("[SyncService] Download profiles failed:", error);
    }
  }

  private async downloadMatches(profileId: string | null): Promise<void> {
    if (!profileId) {
      console.log("[SyncService] No profile ID available, skipping match download");
      return;
    }

    try {
      const remoteMatches = await this.matchRepo.fetchFromSupabase(profileId);
      console.log(
        `[SyncService] Downloaded ${remoteMatches.length} matches from Supabase`
      );

      // Merge remote matches with local storage
      const localMatches = await this.matchRepo.list();

      for (const remoteMatch of remoteMatches) {
        // Only save if not already in local storage or if remote is newer
        const localMatch = localMatches.find((m) => m.id === remoteMatch.id);
        if (!localMatch || remoteMatch.updated_at > localMatch.updated_at) {
          // Matches downloaded from Supabase are already synced
          // Use local synced_at if available, otherwise use the match's created_at
          // (since the match must have been uploaded around the time it was created)
          const matchWithSyncedAt = {
            ...remoteMatch,
            synced_at: localMatch?.synced_at ?? remoteMatch.created_at,
          };
          await this.matchRepo.save(matchWithSyncedAt);
        }
      }
    } catch (error) {
      console.error("[SyncService] Download matches failed:", error);
    }
  }
}
