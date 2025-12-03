// src/lib/data/services/PlayerIdentityService.ts

import { LocalProfileLinkService } from "./LocalProfileLinkService";
import { ICreateMatchInput, MatchService } from "./MatchService";
import { ProfileService } from "./ProfileService";

import type {
  RemoteMatch,
  RemoteProfile,
} from "@/lib/supabase/types";

import type { RallyHubQRPayload } from "@/lib/qr/QRPayloadBuilder";

//
// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------
//

export interface ResolvedPlayer {
  profile: RemoteProfile;
  isLocal: boolean;
  isPlaceholder: boolean;
  createdNow?: boolean;
}

export interface IPlayerIdentityService {
  getCurrentPlayer(): Promise<ResolvedPlayer>;
  resolveFromQR(payload: RallyHubQRPayload): Promise<ResolvedPlayer>;
  createPlaceholder(name?: string): Promise<ResolvedPlayer>;
  normalizePlayer(profileId: string | null): Promise<ResolvedPlayer | null>;

  createMatchFromPlayers(
    players: {
      team1: (ResolvedPlayer | null)[];
      team2: (ResolvedPlayer | null)[];
    },
    scores: { team1: number; team2: number },
    venueId: string | null
  ): Promise<RemoteMatch>;
}

//
// ------------------------------------------------------------
// SERVICE IMPLEMENTATION
// ------------------------------------------------------------
//

export class PlayerIdentityService implements IPlayerIdentityService {
  private profiles: ProfileService;
  private links: LocalProfileLinkService;
  private matches: MatchService;

  constructor(
    profiles?: ProfileService,
    links?: LocalProfileLinkService,
    matches?: MatchService
  ) {
    this.profiles = profiles ?? new ProfileService();
    this.links = links ?? new LocalProfileLinkService();
    this.matches = matches ?? new MatchService();
  }

  //
  // ------------------------------------------------------------
  // CURRENT DEVICE USER
  // ------------------------------------------------------------
  //

  async getCurrentPlayer(): Promise<ResolvedPlayer> {
    let link = await this.links.getLinkForDevice();

    if (!link) {
      // New device → create “You” placeholder
      const placeholder = await this.profiles.createPlaceholder("You");
      link = await this.links.ensureLinkForDevice(placeholder.id);

      return {
        profile: placeholder,
        isLocal: true,
        isPlaceholder: true,
        createdNow: true,
      };
    }

    const profile = await this.profiles.getProfile(link.profile_id);

    if (!profile) {
      // Broken reference → recreate placeholder
      const fallback = await this.profiles.createPlaceholder("You");
      await this.links.ensureLinkForDevice(fallback.id);

      return {
        profile: fallback,
        isLocal: true,
        isPlaceholder: true,
        createdNow: true,
      };
    }

    return {
      profile,
      isLocal: true,
      isPlaceholder: profile.is_placeholder,
    };
  }

  //
  // ------------------------------------------------------------
  // QR RESOLUTION
  // ------------------------------------------------------------
  //

  /**
   * Resolve a scanned QR code into a player identity.
   * First tries to fetch from Supabase to get the most up-to-date profile data
   * (especially user_id status). Falls back to local storage or creates a new profile.
   */
  async resolveFromQR(payload: RallyHubQRPayload): Promise<ResolvedPlayer> {
    if (!payload || payload.type !== "rallyhub:profile" || !payload.profileId) {
      throw new Error("Invalid QR payload");
    }

    // 1. Try fetching the profile from Supabase to get the latest user_id status
    //    This is important because the scanned user may have signed in since the
    //    last time we saw their profile, and we need their user_id for match upload
    let profile = await this.profiles.fetchProfileFromSupabase(payload.profileId);

    if (profile) {
      // Save the remote profile locally to keep our cache in sync
      await this.profiles.upsertProfile(profile);
    } else {
      // 2. Try loading existing profile from local storage
      profile = await this.profiles.getProfile(payload.profileId);
    }

    // 3. If still missing → create a profile from QR payload
    //    Note: We preserve the is_placeholder from QR payload (defaults to false for safety)
    if (!profile) {
      profile = await this.profiles.upsertProfile({
        id: payload.profileId,
        display_name: payload.display_name,
        is_placeholder: payload.is_placeholder ?? false,
      });
    }

    return {
      profile,
      isLocal: false,
      isPlaceholder: profile.is_placeholder,
    };
  }

  //
  // ------------------------------------------------------------
  // PLACEHOLDER CREATION
  // ------------------------------------------------------------
  //

  async createPlaceholder(name?: string): Promise<ResolvedPlayer> {
    // If no name provided, auto-generate a unique guest name
    const guestName = name ?? await this.profiles.generateUniqueGuestName();
    const placeholder = await this.profiles.createPlaceholder(guestName);

    return {
      profile: placeholder,
      isLocal: false,
      isPlaceholder: true,
      createdNow: true,
    };
  }

  //
  // ------------------------------------------------------------
  // NORMALIZATION
  // ------------------------------------------------------------
  //

  async normalizePlayer(profileId: string | null): Promise<ResolvedPlayer | null> {
    if (!profileId) return null;

    const profile = await this.profiles.getProfile(profileId);
    if (!profile) return null;

    return {
      profile,
      isLocal: false,
      isPlaceholder: profile.is_placeholder,
    };
  }

  //
  // ------------------------------------------------------------
  // MATCH CREATION
  // ------------------------------------------------------------
  //

  async createMatchFromPlayers(
    players: {
      team1: (ResolvedPlayer | null)[];
      team2: (ResolvedPlayer | null)[];
    },
    scores: { team1: number; team2: number },
    venueId: string | null
  ): Promise<RemoteMatch> {
    // Validate that both teams have the same number of players
    const team1Count = players.team1.filter((p) => p !== null).length;
    const team2Count = players.team2.filter((p) => p !== null).length;

    if (team1Count === 0 || team2Count === 0) {
      throw new Error(
        "Both sides must have at least one player."
      );
    }

    if (team1Count !== team2Count) {
      throw new Error(
        `Both sides must have the same number of players. Side 1 has ${team1Count} player(s), Side 2 has ${team2Count} player(s).`
      );
    }

    // Validate no duplicate players across all slots
    const allPlayerIds = [
      ...players.team1.map((p) => p?.profile.id),
      ...players.team2.map((p) => p?.profile.id),
    ].filter((id): id is string => id != null);

    const uniquePlayerIds = new Set(allPlayerIds);
    if (uniquePlayerIds.size !== allPlayerIds.length) {
      throw new Error(
        "A player cannot be added to a match multiple times. Please ensure each player is only assigned to one slot."
      );
    }

    const me = await this.getCurrentPlayer();

    const input: ICreateMatchInput = {
      created_by: me.profile.id,

      team1_player1: players.team1[0]?.profile.id ?? null,
      team1_player2: players.team1[1]?.profile.id ?? null,
      team2_player1: players.team2[0]?.profile.id ?? null,
      team2_player2: players.team2[1]?.profile.id ?? null,

      score_team1: scores.team1,
      score_team2: scores.team2,

      venue_id: venueId,
    };

    return this.matches.createMatch(input);
  }
}
