// src/lib/data/services/VenueService.ts

import { RemoteVenue } from "@/lib/supabase/types";
import { randomUUID } from "@/lib/utils/uuid";
import { VenueRepository } from "../repositories/VenueRepository";

export interface IVenueService {
  listVenues(): Promise<RemoteVenue[]>;
  getVenue(id: string): Promise<RemoteVenue | null>;
  upsertVenue(v: Partial<RemoteVenue>): Promise<RemoteVenue>;
  deleteVenue(id: string): Promise<void>;
  searchByName(query: string): Promise<RemoteVenue[]>;
  syncFromSupabase(): Promise<void>;
}

export class VenueService implements IVenueService {
  private repo: VenueRepository;

  constructor(repo?: VenueRepository) {
    this.repo = repo ?? new VenueRepository();
  }

  async listVenues() {
    return this.repo.list();
  }

  async getVenue(id: string) {
    return this.repo.getById(id);
  }

  /**
   * Create or update a venue.
   * Missing values get safe defaults.
   */
  async upsertVenue(v: Partial<RemoteVenue>): Promise<RemoteVenue> {
    const now = new Date().toISOString();
    const id = v.id ?? randomUUID();

    const full: RemoteVenue = {
      id,
      name: v.name ?? "Unknown Venue",
      address: v.address ?? null,
      geom: v.geom ?? null,
      source: v.source ?? null,
      source_id: v.source_id ?? null,
      status: v.status ?? null,
      num_courts: v.num_courts ?? null,
      surface: v.surface ?? null,
      indoor: v.indoor ?? null,
      lighting: v.lighting ?? null,
      created_by: v.created_by ?? null,
      created_at: v.created_at ?? now,
      updated_at: now,
    };

    await this.repo.save(full);
    return full;
  }

  async deleteVenue(id: string): Promise<void> {
    await this.repo.remove(id);
  }

  /**
   * Basic text search by venue name.
   */
  async searchByName(query: string): Promise<RemoteVenue[]> {
    const all = await this.repo.list();
    const q = query.trim().toLowerCase();

    if (!q) return all;

    return all.filter((v) =>
      v.name.toLowerCase().includes(q)
    );
  }

  /**
   * Sync venues from Supabase backend to local storage.
   */
  async syncFromSupabase(): Promise<void> {
    await this.repo.syncWithSupabase();
  }
}
