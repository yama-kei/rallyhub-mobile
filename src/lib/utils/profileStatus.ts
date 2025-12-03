// src/lib/utils/profileStatus.ts

import type { RemoteProfile } from "@/lib/supabase/types";

/**
 * Profile status indicates the type of profile:
 * - "guest": A placeholder profile created for an offline player
 * - "registered": A profile linked to an authenticated user account
 * - "local": A profile created locally but not yet linked to an authenticated account
 */
export type ProfileStatus = "guest" | "registered" | "local";

/**
 * Determines the profile status based on profile data.
 * @param profile - The profile to check
 * @returns The profile status
 */
export function getProfileStatus(profile: RemoteProfile): ProfileStatus {
  if (profile.is_placeholder) {
    return "guest";
  }
  if (profile.user_id) {
    return "registered";
  }
  return "local";
}

/**
 * Returns a human-readable label for the profile status.
 * @param status - The profile status
 * @returns A capitalized label for display
 */
export function getProfileStatusLabel(status: ProfileStatus): string {
  switch (status) {
    case "guest":
      return "Guest";
    case "registered":
      return "Registered";
    case "local":
      return "Local";
  }
}
