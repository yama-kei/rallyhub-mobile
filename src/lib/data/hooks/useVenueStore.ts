// src/data/hooks/useVenueStore.ts

import { VenueService } from "@/lib/data/services/VenueService";
import type { RemoteVenue } from "@/lib/supabase/types";
import { create } from "zustand";

interface VenueState {
  venues: RemoteVenue[];
  loading: boolean;

  // Actions
  loadVenues: () => Promise<void>;
  getVenue: (id: string) => RemoteVenue | undefined;
  upsertVenue: (v: Partial<RemoteVenue>) => Promise<RemoteVenue>;
  deleteVenue: (id: string) => Promise<void>;
  searchVenues: (query: string) => RemoteVenue[];
  refresh: () => Promise<void>;
  syncFromSupabase: () => Promise<void>;
}

const venueService = new VenueService();

export const useVenueStore = create<VenueState>((set, get) => ({
  venues: [],
  loading: false,

  // ---- Load all venues from AsyncStorage ----
  loadVenues: async () => {
    set({ loading: true });
    const list = await venueService.listVenues();
    set({ venues: list, loading: false });
  },

  // ---- Lookup by ID ----
  getVenue: (id) => {
    return get().venues.find((v) => v.id === id);
  },

  // ---- Create or Update venue ----
  upsertVenue: async (partialVenue) => {
    const saved = await venueService.upsertVenue(partialVenue);

    // refresh after save
    const updatedList = await venueService.listVenues();
    set({ venues: updatedList });

    return saved;
  },

  // ---- Delete venue ----
  deleteVenue: async (id) => {
    await venueService.deleteVenue(id);

    // refresh
    const updatedList = await venueService.listVenues();
    set({ venues: updatedList });
  },

  // ---- In-memory search ----
  searchVenues: (query) => {
    const venues = get().venues;
    const q = query.trim().toLowerCase();

    if (!q) return venues;

    return venues.filter((v) =>
      v.name.toLowerCase().includes(q)
    );
  },

  // ---- Force reload ----
  refresh: async () => {
    const list = await venueService.listVenues();
    set({ venues: list });
  },

  // ---- Sync from Supabase ----
  syncFromSupabase: async () => {
    set({ loading: true });
    await venueService.syncFromSupabase();
    const list = await venueService.listVenues();
    set({ venues: list, loading: false });
  },
}));
