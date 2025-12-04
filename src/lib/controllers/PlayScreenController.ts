// src/lib/controllers/PlayScreenController.ts

import { usePlayerSlotStore } from "@/lib/data/hooks/usePlayerSlotStore";
import type { ResolvedPlayer } from "@/lib/data/services/PlayerIdentityService";
import { PlayerIdentityService } from "@/lib/data/services/PlayerIdentityService";
import type { RallyHubQRPayload } from "@/lib/qr/QRPayloadBuilder";
import { trackUserActivity } from "@/lib/supabase/userActivity";

import { dataEnvironment } from "@/lib/data/DataEnvironment";
import { MatchService } from "@/lib/data/services/MatchService";

export class PlayScreenController {
  private identity: PlayerIdentityService;
  private matches: MatchService;

  constructor() {
    // Use DataEnvironment bindings
    this.identity = new PlayerIdentityService(
      dataEnvironment.profileService,
      dataEnvironment.localProfileLinkService,
      dataEnvironment.matchService
    );

    this.matches = dataEnvironment.matchService;
  }

  // ----------------------------------------------------
  // INITIALIZATION
  // ----------------------------------------------------
  /**
   * Ensures current device user is assigned to the first slot if empty.
   */
  async init() {
    const me = await this.identity.getCurrentPlayer();

    const { team1, assignToSlot } = usePlayerSlotStore.getState();

    // Auto-fill me into team1[0] if empty
    if (!team1[0].player) {
      assignToSlot(1, 0, me);
    }

    return me;
  }

  // ----------------------------------------------------
  // QR SCANNING
  // ----------------------------------------------------
  /**
   * Resolve a scanned QR payload and assign to slot.
   * @throws Error if player is already assigned to another slot
   */
  async handleQRScan(payload: RallyHubQRPayload) {
    const resolved: ResolvedPlayer = await this.identity.resolveFromQR(payload);

    const {
      activeSlot,
      clearActiveSlot,
      assignToSlot,
      autoAssignPlayer,
      isPlayerAlreadyAssigned,
    } = usePlayerSlotStore.getState();

    // Check if player is already assigned to a slot
    if (isPlayerAlreadyAssigned(resolved.profile.id)) {
      throw new Error(`${resolved.profile.display_name} is already added to this match. Each player can only be in one slot.`);
    }

    if (activeSlot) {
      const success = assignToSlot(activeSlot.team, activeSlot.index, resolved);
      if (!success) {
        throw new Error(`${resolved.profile.display_name} is already added to this match. Each player can only be in one slot.`);
      }
      clearActiveSlot();
    } else {
      const success = autoAssignPlayer(resolved);
      if (!success) {
        throw new Error("No available slots to assign this player.");
      }
    }

    // Track qr_scan activity (non-blocking)
    trackUserActivity('qr_scan').catch((err) => {
      console.error("[PlayScreenController] Failed to track qr_scan activity:", err);
    });

    return resolved;
  }

  // ----------------------------------------------------
  // PLACEHOLDER CREATION
  // ----------------------------------------------------
  /**
   * Create a guest profile with auto-generated name and assign it to either active slot or first open slot.
   */
  async handleAddPlaceholder() {
    const placeholder = await this.identity.createPlaceholder();

    const {
      activeSlot,
      clearActiveSlot,
      assignToSlot,
      autoAssignPlayer,
    } = usePlayerSlotStore.getState();

    if (activeSlot) {
      // Placeholders are newly created, so they shouldn't be duplicates
      // but we still check for safety
      const success = assignToSlot(activeSlot.team, activeSlot.index, placeholder);
      if (!success) {
        throw new Error("Failed to assign guest player.");
      }
      clearActiveSlot();
    } else {
      const success = autoAssignPlayer(placeholder);
      if (!success) {
        throw new Error("No available slots to add a guest player.");
      }
    }

    return placeholder;
  }

  // ----------------------------------------------------
  // MATCH CREATION
  // ----------------------------------------------------
  /**
   * Submit the match based on current UI slot state.
   */
  async createMatch(scores: { team1: number; team2: number }, venueId: string | null) {
    const { getPlayersForMatch } = usePlayerSlotStore.getState();
    const players = getPlayersForMatch();

    const match = await this.identity.createMatchFromPlayers(
      players,
      scores,
      venueId
    );

    return match;
  }

  // ----------------------------------------------------
  // AFTER MATCH
  // ----------------------------------------------------
  /**
   * Reset slot state after match submission.
   */
  resetSlots() {
    const { resetAll } = usePlayerSlotStore.getState();
    resetAll();
  }

  // ----------------------------------------------------
  // Helpers used in UI
  // ----------------------------------------------------
  getSlots() {
    const { team1, team2, activeSlot } = usePlayerSlotStore.getState();
    return { team1, team2, activeSlot };
  }

  setActiveSlot(team: 1 | 2, index: 0 | 1) {
    const { setActiveSlot } = usePlayerSlotStore.getState();
    setActiveSlot(team, index);
  }

  clearActiveSlot() {
    const { clearActiveSlot } = usePlayerSlotStore.getState();
    clearActiveSlot();
  }
}
