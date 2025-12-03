// src/lib/data/repositories/VenueRepository.ts

import { RemoteVenue } from "@/lib/supabase/types";
import { supabase } from "@/lib/supabase/supabaseClient";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "rh:venues";

export interface IVenueRepository {
  list(): Promise<RemoteVenue[]>;
  getById(id: string): Promise<RemoteVenue | null>;
  save(venue: RemoteVenue): Promise<void>;
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
  fetchFromSupabase(): Promise<RemoteVenue[]>;
  syncWithSupabase(): Promise<void>;
}

export class VenueRepository implements IVenueRepository {
  async list(): Promise<RemoteVenue[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as RemoteVenue[];
    } catch (err) {
      console.error("[VenueRepository] list error:", err);
      return [];
    }
  }

  async getById(id: string): Promise<RemoteVenue | null> {
    const all = await this.list();
    return all.find((v) => v.id === id) ?? null;
  }

  async save(venue: RemoteVenue): Promise<void> {
    const all = await this.list();
    const idx = all.findIndex((v) => v.id === venue.id);

    const now = new Date().toISOString();
    const updated: RemoteVenue = {
      ...venue,
      updated_at: venue.updated_at ?? now,
      created_at: venue.created_at ?? now,
    };

    if (idx >= 0) {
      all[idx] = updated;
    } else {
      all.push(updated);
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  async remove(id: string): Promise<void> {
    const all = await this.list();
    const filtered = all.filter((v) => v.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }

  async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Fetch venues from Supabase backend
   */
  async fetchFromSupabase(): Promise<RemoteVenue[]> {
    try {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        console.error("[VenueRepository] Supabase fetch error:", error);
        return [];
      }

      return data as RemoteVenue[];
    } catch (err) {
      console.error("[VenueRepository] fetchFromSupabase error:", err);
      return [];
    }
  }

  /**
   * Sync venues from Supabase to local storage
   */
  async syncWithSupabase(): Promise<void> {
    try {
      const remoteVenues = await this.fetchFromSupabase();
      
      if (remoteVenues.length > 0) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remoteVenues));
      }
    } catch (err) {
      console.error("[VenueRepository] syncWithSupabase error:", err);
    }
  }
}
