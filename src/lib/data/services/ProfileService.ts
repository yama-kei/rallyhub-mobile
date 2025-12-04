// src/lib/data/services/ProfileService.ts
import { RemoteProfile } from "@/lib/supabase/types";
import { trackUserActivity } from "@/lib/supabase/userActivity";
import { randomUUID } from "@/lib/utils/uuid";
import { ProfileRepository } from "../repositories/ProfileRepository";

export interface IProfileService {
  listProfiles(): Promise<RemoteProfile[]>;
  getProfile(id: string): Promise<RemoteProfile | null>;
  fetchProfileFromSupabase(profileId: string): Promise<RemoteProfile | null>;
  fetchProfileByUserIdFromSupabase(userId: string): Promise<RemoteProfile | null>;
  upsertProfile(profile: Partial<RemoteProfile>): Promise<RemoteProfile>;
  createPlaceholder(display_name: string): Promise<RemoteProfile>;
  generateUniqueGuestName(): Promise<string>;
}

export class ProfileService implements IProfileService {
  private repo: ProfileRepository;

  constructor(repo?: ProfileRepository) {
    this.repo = repo ?? new ProfileRepository();
  }

  async listProfiles() {
    return this.repo.list();
  }

  async getProfile(id: string) {
    return this.repo.getById(id);
  }

  /**
   * Fetch a profile from Supabase by ID (for viewing other players)
   */
  async fetchProfileFromSupabase(profileId: string): Promise<RemoteProfile | null> {
    return this.repo.fetchProfileByIdFromSupabase(profileId);
  }

  /**
   * Fetch a profile from Supabase by user_id (for retrieving existing profile on sign-in)
   */
  async fetchProfileByUserIdFromSupabase(userId: string): Promise<RemoteProfile | null> {
    return this.repo.fetchProfileByUserIdFromSupabase(userId);
  }

  /**
   * Save full or partial profile. If a profile with the same ID exists,
   * the provided fields are merged with existing data. New profiles use defaults.
   */
  async upsertProfile(
    profile: Partial<RemoteProfile>
  ): Promise<RemoteProfile> {
    if (!profile.id) {
      profile.id = randomUUID();
    }

    const now = new Date().toISOString();

    // Try to get existing profile to merge with
    const existing = await this.repo.getById(profile.id);

    const full: RemoteProfile = {
      // Start with existing data if available, otherwise use defaults
      id: profile.id,
      user_id: profile.user_id ?? existing?.user_id ?? null,
      display_name: profile.display_name ?? existing?.display_name ?? "Unnamed Player",
      is_placeholder: profile.is_placeholder ?? existing?.is_placeholder ?? false,
      placeholder_code: profile.placeholder_code ?? existing?.placeholder_code ?? null,
      claimed_by: profile.claimed_by ?? existing?.claimed_by ?? null,
      default_venue_id: profile.default_venue_id ?? existing?.default_venue_id ?? null,
      created_at: profile.created_at ?? existing?.created_at ?? now,
      updated_at: now,
    };

    await this.repo.save(full);

    // Track profile_update activity only when updating an existing profile (non-blocking)
    if (existing) {
      trackUserActivity('profile_update').catch((err) => {
        console.error("[ProfileService] Failed to track profile_update activity:", err);
      });
    }

    return full;
  }

  /**
   * Create lightweight placeholder for offline users
   */
  async createPlaceholder(displayName: string): Promise<RemoteProfile> {
    const now = new Date().toISOString();
    const placeholder: RemoteProfile = {
      id: randomUUID(),
      user_id: null,
      display_name: displayName,
      is_placeholder: true,
      placeholder_code: Math.random().toString(36).substring(2, 8),
      claimed_by: null,
      default_venue_id: null,
      created_at: now,
      updated_at: now,
    };

    await this.repo.save(placeholder);
    return placeholder;
  }

  /**
   * Generate a unique guest name based on existing placeholders
   */
  async generateUniqueGuestName(): Promise<string> {
    const all = await this.repo.list();
    
    // Find all guest placeholders and extract their numbers
    const guestNumbers = all
      .filter((p) => p.is_placeholder && p.display_name.startsWith("Guest "))
      .map((p) => {
        const match = p.display_name.match(/^Guest (\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);
    
    // Find the highest number and increment, or start at 1
    const maxNumber = guestNumbers.length > 0 ? Math.max(...guestNumbers) : 0;
    return `Guest ${maxNumber + 1}`;
  }

  /**
   * Load an existing local profile or create one if none exist.
   */
  async getOrCreateLocalProfile(): Promise<RemoteProfile> {
    const all = await this.repo.list();

    // Prefer a profile without a linked Supabase user
    const existing =
      all.find((p) => !p.user_id) ?? all[0];
    if (existing) return existing;

    const now = new Date().toISOString();
    const localProfile: RemoteProfile = {
      id: randomUUID(),
      user_id: null,
      display_name: "Local Player",
      is_placeholder: true,
      placeholder_code: Math.random().toString(36).substring(2, 8),
      claimed_by: null,
      default_venue_id: null,
      created_at: now,
      updated_at: now,
    };

    await this.repo.save(localProfile);
    return localProfile;
  }
}
