// src/lib/utils/errors.ts

/**
 * Error thrown when a user tries to sign in with an identity that is already
 * associated with a different profile than their current local profile.
 */
export class ProfileConflictError extends Error {
  readonly code = "PROFILE_CONFLICT";
  
  constructor(message?: string) {
    super(message ?? "You already have a profile associated to your identity");
    this.name = "ProfileConflictError";
  }
}
