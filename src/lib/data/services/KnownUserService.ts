// src/lib/data/services/KnownUserService.ts

import { RemoteKnownUser, RemoteProfile } from "@/lib/supabase/types";
import { randomUUID } from "@/lib/utils/uuid";
import { KnownUserRepository } from "../repositories/KnownUserRepository";
import { ProfileRepository } from "../repositories/ProfileRepository";

export interface IKnownUserService {
  listKnownUsers(ownerUserId: string): Promise<RemoteKnownUser[]>;
  addKnownUser(ownerUserId: string, profile: RemoteProfile): Promise<RemoteKnownUser | null>;
  removeKnownUser(ownerUserId: string, knownProfileId: string): Promise<void>;
  syncKnownUsers(ownerUserId: string): Promise<void>;
  buildKnownUsersFromLocalProfiles(ownerUserId: string, ownerProfileId: string): Promise<void>;
}

export class KnownUserService implements IKnownUserService {
  private knownUserRepo: KnownUserRepository;
  private profileRepo: ProfileRepository;

  constructor(
    knownUserRepo?: KnownUserRepository,
    profileRepo?: ProfileRepository
  ) {
    this.knownUserRepo = knownUserRepo ?? new KnownUserRepository();
    this.profileRepo = profileRepo ?? new ProfileRepository();
  }

  /**
   * List all known users for a given owner (auth user ID)
   */
  async listKnownUsers(ownerUserId: string): Promise<RemoteKnownUser[]> {
    return this.knownUserRepo.getByOwner(ownerUserId);
  }

  /**
   * Add a profile to the known users list.
   * Only profiles with a user_id (not pure placeholders/guests) will be stored.
   * Returns null if the profile doesn't have a user_id.
   */
  async addKnownUser(ownerUserId: string, profile: RemoteProfile): Promise<RemoteKnownUser | null> {
    // Skip guest users who don't have any user identity
    if (!profile.user_id) {
      console.log(
        `[KnownUserService] Skipping profile ${profile.id} - no user_id (guest user)`
      );
      return null;
    }

    // Don't add the user's own profile to their known users list
    if (profile.user_id === ownerUserId) {
      console.log(
        `[KnownUserService] Skipping profile ${profile.id} - owner's own profile`
      );
      return null;
    }

    const now = new Date().toISOString();
    const knownUser: RemoteKnownUser = {
      id: randomUUID(),
      owner_user_id: ownerUserId,
      known_profile_id: profile.id,
      created_at: now,
    };

    await this.knownUserRepo.save(knownUser);
    return knownUser;
  }

  /**
   * Remove a profile from the known users list
   */
  async removeKnownUser(ownerUserId: string, knownProfileId: string): Promise<void> {
    await this.knownUserRepo.removeByKnownProfileId(ownerUserId, knownProfileId);
  }

  /**
   * Build the known users list from local profiles.
   * This scans all local profiles and adds those with a user_id to the known users list.
   * Called during sync to ensure the known users list is up to date.
   */
  async buildKnownUsersFromLocalProfiles(ownerUserId: string, ownerProfileId: string): Promise<void> {
    try {
      const localProfiles = await this.profileRepo.list();
      console.log(
        `[KnownUserService] Building known users from ${localProfiles.length} local profiles`
      );

      // Fetch existing known users once to avoid N+1 queries
      const existingKnownUsers = await this.knownUserRepo.getByOwner(ownerUserId);
      const knownProfileIds = new Set(existingKnownUsers.map((ku) => ku.known_profile_id));

      let addedCount = 0;
      let skippedCount = 0;

      for (const profile of localProfiles) {
        // Skip the owner's own profile
        if (profile.id === ownerProfileId) {
          continue;
        }

        // Only add profiles that have a user_id (registered users, not guests)
        if (!profile.user_id) {
          skippedCount++;
          continue;
        }

        // Check if already in known users (using the pre-fetched set)
        if (knownProfileIds.has(profile.id)) {
          continue;
        }

        await this.addKnownUser(ownerUserId, profile);
        addedCount++;
        // Add to set to prevent duplicates in subsequent iterations
        knownProfileIds.add(profile.id);
      }

      console.log(
        `[KnownUserService] Built known users: added ${addedCount}, skipped ${skippedCount} (guests)`
      );
    } catch (error) {
      console.error("[KnownUserService] Build known users failed:", error);
    }
  }

  /**
   * Sync known users with Supabase:
   * 1. Build known users from local profiles (add any new ones)
   * 2. Upload local known users to Supabase (only those with user_id)
   * 3. Download known users from Supabase
   * 4. Download the profiles for all known users
   */
  async syncKnownUsers(ownerUserId: string): Promise<void> {
    if (!ownerUserId) {
      console.log("[KnownUserService] No ownerUserId provided, skipping sync");
      return;
    }

    console.log(`[KnownUserService] Starting known users sync for ${ownerUserId}`);

    try {
      // Get the owner's profile ID
      const localProfiles = await this.profileRepo.list();
      const ownerProfile = localProfiles.find((p) => p.user_id === ownerUserId);
      const ownerProfileId = ownerProfile?.id ?? "";

      // 1. Build known users from local profiles
      if (ownerProfileId) {
        await this.buildKnownUsersFromLocalProfiles(ownerUserId, ownerProfileId);
      }

      // 2. Upload local known users to Supabase
      await this.uploadKnownUsers(ownerUserId);

      // 3. Download known users from Supabase
      await this.downloadKnownUsers(ownerUserId);

      // 4. Download profiles for all known users
      await this.downloadKnownUserProfiles(ownerUserId);

      console.log("[KnownUserService] Known users sync completed successfully");
    } catch (error) {
      console.error("[KnownUserService] Known users sync failed:", error);
    }
  }

  /**
   * Upload local known users to Supabase.
   * Only uploads entries where the known profile has a user_id and that haven't been synced yet.
   */
  private async uploadKnownUsers(ownerUserId: string): Promise<void> {
    try {
      const localKnownUsers = await this.knownUserRepo.getByOwner(ownerUserId);
      console.log(
        `[KnownUserService] Checking ${localKnownUsers.length} local known users for upload`
      );

      let uploadedCount = 0;
      let skippedCount = 0;
      let alreadySyncedCount = 0;

      // Filter out already synced users first
      const unsyncedKnownUsers = localKnownUsers.filter((ku) => {
        if (ku.synced_at) {
          alreadySyncedCount++;
          return false;
        }
        return true;
      });

      // Early return if nothing to process
      if (unsyncedKnownUsers.length === 0) {
        console.log(
          `[KnownUserService] Uploaded ${uploadedCount} known users, skipped ${skippedCount} (no user_id or profile not in Supabase), ${alreadySyncedCount} already synced`
        );
        return;
      }

      // Collect profile IDs that need to be checked for existence in Supabase
      // Only include profiles that have a user_id locally
      const profileIdsToCheck: string[] = [];
      const knownUsersWithValidLocalProfile: typeof unsyncedKnownUsers = [];

      for (const knownUser of unsyncedKnownUsers) {
        const profile = await this.profileRepo.getById(knownUser.known_profile_id);
        
        if (!profile || !profile.user_id) {
          console.log(
            `[KnownUserService] Skipping upload of known user ${knownUser.known_profile_id} - no user_id`
          );
          skippedCount++;
          continue;
        }

        profileIdsToCheck.push(knownUser.known_profile_id);
        knownUsersWithValidLocalProfile.push(knownUser);
      }

      // Batch check which profiles exist in Supabase
      const existingProfileIds = await this.profileRepo.fetchProfilesByIdsFromSupabase(
        profileIdsToCheck
      );

      // Process known users that have valid profiles in Supabase
      for (const knownUser of knownUsersWithValidLocalProfile) {
        if (!existingProfileIds.has(knownUser.known_profile_id)) {
          console.log(
            `[KnownUserService] Skipping upload of known user ${knownUser.known_profile_id} - profile not yet in Supabase`
          );
          skippedCount++;
          continue;
        }

        const success = await this.knownUserRepo.upsertToSupabase(knownUser);

        // Only mark known user as synced if upload was successful
        if (success) {
          const now = new Date().toISOString();
          await this.knownUserRepo.save({
            ...knownUser,
            synced_at: now,
          });
          uploadedCount++;
        }
      }

      console.log(
        `[KnownUserService] Uploaded ${uploadedCount} known users, skipped ${skippedCount} (no user_id or profile not in Supabase), ${alreadySyncedCount} already synced`
      );
    } catch (error) {
      console.error("[KnownUserService] Upload known users failed:", error);
    }
  }

  /**
   * Download known users from Supabase and merge with local storage
   */
  private async downloadKnownUsers(ownerUserId: string): Promise<void> {
    try {
      const remoteKnownUsers = await this.knownUserRepo.fetchFromSupabase(ownerUserId);
      console.log(
        `[KnownUserService] Downloaded ${remoteKnownUsers.length} known users from Supabase`
      );

      // Merge remote known users with local storage
      // Mark them as synced since they came from the backend
      // Note: synced_at is a local-only field, so remote users won't have it
      const now = new Date().toISOString();
      for (const remoteKnownUser of remoteKnownUsers) {
        await this.knownUserRepo.save({
          ...remoteKnownUser,
          synced_at: now,
        });
      }
    } catch (error) {
      console.error("[KnownUserService] Download known users failed:", error);
    }
  }

  /**
   * Download profiles for all known users from Supabase
   * This ensures we have the latest profile data for all known users
   */
  private async downloadKnownUserProfiles(ownerUserId: string): Promise<void> {
    try {
      const knownUsers = await this.knownUserRepo.getByOwner(ownerUserId);
      console.log(
        `[KnownUserService] Downloading profiles for ${knownUsers.length} known users`
      );

      let downloadedCount = 0;
      let skippedCount = 0;

      for (const knownUser of knownUsers) {
        // Check if we already have this profile locally
        const localProfile = await this.profileRepo.getById(knownUser.known_profile_id);
        
        // Fetch the latest profile from Supabase
        const remoteProfile = await this.profileRepo.fetchProfileByIdFromSupabase(
          knownUser.known_profile_id
        );

        if (remoteProfile) {
          // Save if newer or if we don't have it locally
          if (!localProfile || remoteProfile.updated_at > localProfile.updated_at) {
            await this.profileRepo.save(remoteProfile);
            downloadedCount++;
          } else {
            skippedCount++;
          }
        } else {
          skippedCount++;
        }
      }

      console.log(
        `[KnownUserService] Downloaded ${downloadedCount} profiles, skipped ${skippedCount}`
      );
    } catch (error) {
      console.error("[KnownUserService] Download known user profiles failed:", error);
    }
  }
}
