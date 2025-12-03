// src/data/hooks/usePlayerSlotStore.ts

import type { ResolvedPlayer } from "@/lib/data/services/PlayerIdentityService";
import { create } from "zustand";

//
// PlayerSlot = a ResolvedPlayer or null
//
export interface PlayerSlot {
  player: ResolvedPlayer | null;
}

//
// Store State
//
interface PlayerSlotState {
  // 4 slots in total
  team1: [PlayerSlot, PlayerSlot];
  team2: [PlayerSlot, PlayerSlot];

  // Which slot is currently awaiting QR assignment
  activeSlot: { team: 1 | 2; index: 0 | 1 } | null;

  // Actions
  setActiveSlot: (team: 1 | 2, index: 0 | 1) => void;
  clearActiveSlot: () => void;

  /**
   * Assign a player to a specific slot.
   * Returns true if assignment was successful, false if player is already assigned elsewhere.
   */
  assignToSlot: (
    team: 1 | 2,
    index: 0 | 1,
    player: ResolvedPlayer
  ) => boolean;

  /**
   * Auto-assign a player to the first available slot.
   * Returns true if assignment was successful, false if player is already assigned or no slots available.
   */
  autoAssignPlayer: (player: ResolvedPlayer) => boolean;

  swapSlots: (
    a: { team: 1 | 2; index: 0 | 1 },
    b: { team: 1 | 2; index: 0 | 1 }
  ) => void;

  clearSlot: (team: 1 | 2, index: 0 | 1) => void;
  resetAll: () => void;

  getPlayersForMatch: () => {
    team1: (ResolvedPlayer | null)[];
    team2: (ResolvedPlayer | null)[];
  };

  /**
   * Check if a player is already assigned to any slot.
   */
  isPlayerAlreadyAssigned: (profileId: string) => boolean;
}

const emptySlot: PlayerSlot = { player: null };

export const usePlayerSlotStore = create<PlayerSlotState>((set, get) => ({
  team1: [ { ...emptySlot }, { ...emptySlot } ],
  team2: [ { ...emptySlot }, { ...emptySlot } ],

  activeSlot: null,

  //
  // -----------------------------
  // ACTIVE SLOT (QR targeting)
  // -----------------------------
  //

  setActiveSlot: (team, index) => {
    set({ activeSlot: { team, index } });
  },

  clearActiveSlot: () => {
    set({ activeSlot: null });
  },

  //
  // -----------------------------
  // HELPER: CHECK FOR DUPLICATES
  // -----------------------------
  //

  isPlayerAlreadyAssigned: (profileId) => {
    const { team1, team2 } = get();
    const assignedPlayerIds = [
      team1[0].player?.profile.id,
      team1[1].player?.profile.id,
      team2[0].player?.profile.id,
      team2[1].player?.profile.id,
    ].filter(Boolean);

    return assignedPlayerIds.includes(profileId);
  },

  //
  // -----------------------------
  // ASSIGNING PLAYERS
  // -----------------------------
  //

  assignToSlot: (team, index, player) => {
    const { isPlayerAlreadyAssigned, team1, team2 } = get();

    // Check if this player is already assigned to a different slot
    // (Allow replacing the same slot, but not assigning to a second slot)
    const currentSlot = team === 1 ? team1[index] : team2[index];
    const isReplacingSameSlot = currentSlot.player?.profile.id === player.profile.id;

    if (!isReplacingSameSlot && isPlayerAlreadyAssigned(player.profile.id)) {
      // Player is already assigned to a different slot - reject
      return false;
    }

    set((state) => {
      const copyTeam1 = [...state.team1];
      const copyTeam2 = [...state.team2];

      if (team === 1) {
        copyTeam1[index] = { player };
      } else {
        copyTeam2[index] = { player };
      }

      return {
        team1: copyTeam1 as [PlayerSlot, PlayerSlot],
        team2: copyTeam2 as [PlayerSlot, PlayerSlot],
      };
    });

    return true;
  },

  /**
   * Auto-assign a player to the first available slot.
   * Useful for QR scan when user didn't specify a slot.
   * Returns true if assignment was successful, false if player is already assigned or no slots available.
   */
  autoAssignPlayer: (player) => {
    const { team1, team2, assignToSlot, isPlayerAlreadyAssigned } = get();

    // Check if player is already assigned anywhere
    if (isPlayerAlreadyAssigned(player.profile.id)) {
      return false;
    }

    // Team 1 first
    if (!team1[0].player) return assignToSlot(1, 0, player);
    if (!team1[1].player) return assignToSlot(1, 1, player);

    // Then team 2
    if (!team2[0].player) return assignToSlot(2, 0, player);
    if (!team2[1].player) return assignToSlot(2, 1, player);

    // No slots available
    return false;
  },

  //
  // -----------------------------
  // SWAP
  // -----------------------------
  //

  swapSlots: (a, b) => {
    set((state) => {
      const t1 = [...state.team1];
      const t2 = [...state.team2];

      const getSlot = (s: { team: 1 | 2; index: 0 | 1 }) =>
        s.team === 1 ? t1[s.index] : t2[s.index];

      const setSlot = (
        s: { team: 1 | 2; index: 0 | 1 },
        value: PlayerSlot
      ) => {
        if (s.team === 1) t1[s.index] = value;
        else t2[s.index] = value;
      };

      const tempA = getSlot(a);
      const tempB = getSlot(b);

      setSlot(a, tempB);
      setSlot(b, tempA);

      return {
        team1: t1 as [PlayerSlot, PlayerSlot],
        team2: t2 as [PlayerSlot, PlayerSlot],
      };
    });
  },

  //
  // -----------------------------
  // CLEARING
  // -----------------------------
  //

  clearSlot: (team, index) => {
    set((state) => {
      const copyTeam1 = [...state.team1];
      const copyTeam2 = [...state.team2];

      if (team === 1) copyTeam1[index] = { player: null };
      else copyTeam2[index] = { player: null };

      return {
        team1: copyTeam1 as [PlayerSlot, PlayerSlot],
        team2: copyTeam2 as [PlayerSlot, PlayerSlot],
      };
    });
  },

  resetAll: () => {
    set({
      team1: [ { ...emptySlot }, { ...emptySlot } ],
      team2: [ { ...emptySlot }, { ...emptySlot } ],
      activeSlot: null,
    });
  },

  //
  // -----------------------------
  // MATCH EXPORT
  // -----------------------------
  //

  getPlayersForMatch: () => {
    const { team1, team2 } = get();

    return {
      team1: [team1[0].player, team1[1].player],
      team2: [team2[0].player, team2[1].player],
    };
  },
}));
