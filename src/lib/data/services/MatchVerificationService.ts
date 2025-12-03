// src/lib/data/services/MatchVerificationService.ts

import type { RemoteMatch } from "@/lib/supabase/types";
import { randomUUID } from "@/lib/utils/uuid";
import { MatchVerificationRepository } from "../repositories/MatchVerificationRepository";
import { MatchService } from "./MatchService";
import { ProfileService } from "./ProfileService";

export interface IMatchVerificationService {
  verify(matchId: string, profileId: string): Promise<RemoteMatch>;
  getVerifications(matchId: string): Promise<
    {
      id: string;
      match_id: string;
      profile_id: string;
      verified_at: string;
    }[]
  >;
  hasVerified(matchId: string, profileId: string): Promise<boolean>;
}

export class MatchVerificationService implements IMatchVerificationService {
  private repo: MatchVerificationRepository;
  private matches: MatchService;
  private profiles: ProfileService;

  constructor(
    repo?: MatchVerificationRepository,
    matches?: MatchService,
    profiles?: ProfileService
  ) {
    this.repo = repo ?? new MatchVerificationRepository();
    this.matches = matches ?? new MatchService();
    this.profiles = profiles ?? new ProfileService();
  }

  async getVerifications(matchId: string) {
    return this.repo.getByMatch(matchId);
  }

  async hasVerified(matchId: string, profileId: string): Promise<boolean> {
    return this.repo.hasVerified(matchId, profileId);
  }

  /**
   * Main verification flow:
   * 1. Ensure match + profile exist
   * 2. Prevent duplicate verification
   * 3. Insert verification event
   * 4. Mark match as verified (via MatchService)
   */
  async verify(matchId: string, profileId: string): Promise<RemoteMatch> {
    const match = await this.matches.get(matchId);
    if (!match) throw new Error("Match not found");

    const profile = await this.profiles.getProfile(profileId);
    if (!profile) throw new Error("Profile not found");

    const already = await this.repo.hasVerified(matchId, profileId);
    if (already) {
      // Return the match as-is (no need to write again)
      return match;
    }

    const now = new Date().toISOString();

    await this.repo.save({
      id: randomUUID(),
      match_id: matchId,
      profile_id: profileId,
      verified_at: now,
    });

    // Also mark match as verified
    return this.matches.verifyMatch(matchId, profileId);
  }
}
