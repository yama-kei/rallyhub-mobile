// src/lib/data/DataEnvironment.ts

/**
 * Central place to construct repositories and services.
 * UI (stores/hooks) should import DataEnvironment instead of creating
 * repositories or services directly. This makes it trivial to swap
 * AsyncStorage implementations for Supabase in the future.
 */

import { ProfileRepository } from "./repositories/ProfileRepository";
import { ProfileService } from "./services/ProfileService";

import { VenueRepository } from "./repositories/VenueRepository";
import { VenueService } from "./services/VenueService";

import { MatchRepository } from "./repositories/MatchRepository";
import { MatchService } from "./services/MatchService";

import { MatchVerificationRepository } from "./repositories/MatchVerificationRepository";
import { MatchVerificationService } from "./services/MatchVerificationService";

import { LocalProfileLinkRepository } from "./repositories/LocalProfileLinkRepository";
import { LocalProfileLinkService } from "./services/LocalProfileLinkService";
import { SyncService } from "./services/SyncService";
import { ClaimProfileService } from "./services/ClaimProfileService";

import { KnownUserRepository } from "./repositories/KnownUserRepository";
import { KnownUserService } from "./services/KnownUserService";

export class DataEnvironment {
  profileRepository: ProfileRepository;
  profileService: ProfileService;

  venueRepository: VenueRepository;
  venueService: VenueService;

  matchRepository: MatchRepository;
  matchService: MatchService;

  matchVerificationRepository: MatchVerificationRepository;
  matchVerificationService: MatchVerificationService;

  localProfileLinkRepository: LocalProfileLinkRepository;
  localProfileLinkService: LocalProfileLinkService;

  knownUserRepository: KnownUserRepository;
  knownUserService: KnownUserService;

  syncService: SyncService;
  claimProfileService: ClaimProfileService;

  constructor() {
    // ---- Profiles ----
    this.profileRepository = new ProfileRepository();
    this.profileService = new ProfileService(this.profileRepository);

    // ---- Venues ----
    this.venueRepository = new VenueRepository();
    this.venueService = new VenueService(this.venueRepository);

    // ---- Matches ----
    this.matchRepository = new MatchRepository(this.profileRepository);
    this.matchService = new MatchService(
      this.matchRepository,
      this.profileService
    );

    // ---- Match Verifications ----
    this.matchVerificationRepository = new MatchVerificationRepository();
    this.matchVerificationService = new MatchVerificationService(
      this.matchVerificationRepository,
      this.matchService,
      this.profileService
    );

    // ---- Local Profile Links ----
    this.localProfileLinkRepository = new LocalProfileLinkRepository();
    this.localProfileLinkService = new LocalProfileLinkService(
      this.localProfileLinkRepository,
      this.profileService
    );

    // ---- Known Users ----
    this.knownUserRepository = new KnownUserRepository();
    this.knownUserService = new KnownUserService(
      this.knownUserRepository,
      this.profileRepository
    );

    // ---- Sync (stub for now) ----
    this.syncService = new SyncService(
      this.profileRepository,
      this.matchRepository,
      this.knownUserRepository,
      this.knownUserService
    );

    // ---- Claim Profile Service ----
    this.claimProfileService = new ClaimProfileService(
      this.profileRepository,
      this.matchRepository
    );
  }
}

// Create a global singleton Environment
export const dataEnvironment = new DataEnvironment();

// Backwards-compatible alias used throughout the app
export const dataEnv = dataEnvironment;
