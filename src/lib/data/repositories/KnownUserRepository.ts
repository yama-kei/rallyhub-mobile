// src/lib/data/repositories/KnownUserRepository.ts

import { RemoteKnownUser } from "@/lib/supabase/types";
import { supabase } from "@/lib/supabase/supabaseClient";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "rh:known_users";

export interface IKnownUserRepository {
  list(): Promise<RemoteKnownUser[]>;
  getByOwner(ownerUserId: string): Promise<RemoteKnownUser[]>;
  save(knownUser: RemoteKnownUser): Promise<void>;
  remove(id: string): Promise<void>;
  removeByKnownProfileId(ownerUserId: string, knownProfileId: string): Promise<void>;
  clearAll(): Promise<void>;
  fetchFromSupabase(ownerUserId: string): Promise<RemoteKnownUser[]>;
  upsertToSupabase(knownUser: RemoteKnownUser): Promise<boolean>;
  deleteFromSupabase(ownerUserId: string, knownProfileId: string): Promise<void>;
}

export class KnownUserRepository implements IKnownUserRepository {
  /**
   * List all known user entries from local storage
   */
  async list(): Promise<RemoteKnownUser[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as RemoteKnownUser[];
    } catch (err) {
      console.error("[KnownUserRepository] list error:", err);
      return [];
    }
  }

  /**
   * Get known users for a specific owner (auth user ID)
   */
  async getByOwner(ownerUserId: string): Promise<RemoteKnownUser[]> {
    const all = await this.list();
    return all.filter((ku) => ku.owner_user_id === ownerUserId);
  }

  /**
   * Save or update a known user entry locally
   */
  async save(knownUser: RemoteKnownUser): Promise<void> {
    const all = await this.list();
    const idx = all.findIndex((ku) => ku.id === knownUser.id);

    if (idx >= 0) {
      all[idx] = knownUser;
    } else {
      // Check if this owner/profile combination already exists
      const existingIdx = all.findIndex(
        (ku) =>
          ku.owner_user_id === knownUser.owner_user_id &&
          ku.known_profile_id === knownUser.known_profile_id
      );
      if (existingIdx >= 0) {
        all[existingIdx] = knownUser;
      } else {
        all.push(knownUser);
      }
    }

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  /**
   * Remove a known user entry by its ID
   */
  async remove(id: string): Promise<void> {
    const all = await this.list();
    const filtered = all.filter((ku) => ku.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }

  /**
   * Remove a known user entry by owner and known profile ID
   */
  async removeByKnownProfileId(ownerUserId: string, knownProfileId: string): Promise<void> {
    const all = await this.list();
    const filtered = all.filter(
      (ku) => !(ku.owner_user_id === ownerUserId && ku.known_profile_id === knownProfileId)
    );
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }

  /**
   * Clear all known user entries from local storage
   */
  async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Fetch known users from Supabase for the current authenticated user
   */
  async fetchFromSupabase(ownerUserId: string): Promise<RemoteKnownUser[]> {
    try {
      // Validate UUID format to prevent injection
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(ownerUserId)) {
        console.error("[KnownUserRepository] Invalid owner user ID format:", ownerUserId);
        return [];
      }

      const { data, error } = await supabase
        .from("known_users")
        .select("*")
        .eq("owner_user_id", ownerUserId);

      if (error) {
        console.error("[KnownUserRepository] Supabase fetch error:", error);
        return [];
      }

      return data as RemoteKnownUser[];
    } catch (err) {
      console.error("[KnownUserRepository] fetchFromSupabase error:", err);
      return [];
    }
  }

  /**
   * Upsert a known user entry to Supabase
   * @returns true if successful, false otherwise
   */
  async upsertToSupabase(knownUser: RemoteKnownUser): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("known_users")
        .upsert(knownUser as any, { onConflict: "owner_user_id,known_profile_id" });

      if (error) {
        console.error("[KnownUserRepository] Supabase upsert error:", error);
        return false;
      }
      return true;
    } catch (err) {
      console.error("[KnownUserRepository] upsertToSupabase error:", err);
      return false;
    }
  }

  /**
   * Delete a known user entry from Supabase
   */
  async deleteFromSupabase(ownerUserId: string, knownProfileId: string): Promise<void> {
    try {
      // Validate UUID format to prevent injection
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(ownerUserId) || !uuidRegex.test(knownProfileId)) {
        console.error("[KnownUserRepository] Invalid UUID format");
        return;
      }

      const { error } = await supabase
        .from("known_users")
        .delete()
        .eq("owner_user_id", ownerUserId)
        .eq("known_profile_id", knownProfileId);

      if (error) {
        console.error("[KnownUserRepository] Supabase delete error:", error);
      }
    } catch (err) {
      console.error("[KnownUserRepository] deleteFromSupabase error:", err);
    }
  }
}
