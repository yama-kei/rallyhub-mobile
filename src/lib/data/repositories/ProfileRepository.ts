// src/lib/data/repositories/ProfileRepository.ts
import { RemoteProfile } from "@/lib/supabase/types";
import { supabase } from "@/lib/supabase/supabaseClient";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "rh:profiles";

export interface IProfileRepository {
  list(): Promise<RemoteProfile[]>;
  getById(id: string): Promise<RemoteProfile | null>;
  save(profile: RemoteProfile): Promise<void>;
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
  fetchFromSupabase(userId: string): Promise<RemoteProfile[]>;
  fetchProfileByIdFromSupabase(profileId: string): Promise<RemoteProfile | null>;
  fetchProfilesByIdsFromSupabase(profileIds: string[]): Promise<Set<string>>;
  fetchProfileByUserIdFromSupabase(userId: string): Promise<RemoteProfile | null>;
  upsertToSupabase(profile: RemoteProfile): Promise<void>;
}

export class ProfileRepository implements IProfileRepository {
  async list(): Promise<RemoteProfile[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as RemoteProfile[];
    } catch (err) {
      console.error("[ProfileRepository] list() failed:", err);
      return [];
    }
  }

  async getById(id: string): Promise<RemoteProfile | null> {
    const all = await this.list();
    return all.find((p) => p.id === id) ?? null;
  }

  async save(profile: RemoteProfile): Promise<void> {
    const all = await this.list();
    const idx = all.findIndex((p) => p.id === profile.id);

    const now = new Date().toISOString();
    const updated: RemoteProfile = {
      ...profile,
      updated_at: profile.updated_at ?? now,
      created_at: profile.created_at ?? now,
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
    const filtered = all.filter((p) => p.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }

  async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Fetch profiles from Supabase backend for the current user
   */
  async fetchFromSupabase(userId: string): Promise<RemoteProfile[]> {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .or(`user_id.eq.${userId},claimed_by.eq.${userId}`);

      if (error) {
        console.error("[ProfileRepository] Supabase fetch error:", error);
        return [];
      }

      return data as RemoteProfile[];
    } catch (err) {
      console.error("[ProfileRepository] fetchFromSupabase error:", err);
      return [];
    }
  }

  /**
   * Fetch a single profile by ID from Supabase backend
   */
  async fetchProfileByIdFromSupabase(profileId: string): Promise<RemoteProfile | null> {
    try {
      // Validate UUID format to prevent injection
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(profileId)) {
        console.error("[ProfileRepository] Invalid profile ID format:", profileId);
        return null;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", profileId)
        .maybeSingle();

      if (error) {
        console.error("[ProfileRepository] Supabase fetch by ID error:", error);
        return null;
      }

      return data as RemoteProfile | null;
    } catch (err) {
      console.error("[ProfileRepository] fetchProfileByIdFromSupabase error:", err);
      return null;
    }
  }

  /**
   * Batch fetch profile IDs from Supabase to check existence
   * Returns a Set of profile IDs that exist in Supabase
   */
  async fetchProfilesByIdsFromSupabase(profileIds: string[]): Promise<Set<string>> {
    try {
      if (profileIds.length === 0) {
        return new Set();
      }

      // Validate UUID format for all IDs to prevent injection
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validIds = profileIds.filter((id) => uuidRegex.test(id));
      
      if (validIds.length === 0) {
        console.warn("[ProfileRepository] No valid profile IDs to fetch");
        return new Set();
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id")
        .in("id", validIds);

      if (error) {
        console.error("[ProfileRepository] Supabase batch fetch by IDs error:", error);
        return new Set();
      }

      return new Set((data ?? []).map((p) => p.id));
    } catch (err) {
      console.error("[ProfileRepository] fetchProfilesByIdsFromSupabase error:", err);
      return new Set();
    }
  }

  /**
   * Fetch a profile by user_id (auth user ID) from Supabase
   */
  async fetchProfileByUserIdFromSupabase(userId: string): Promise<RemoteProfile | null> {
    try {
      // Validate UUID format to prevent injection
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        console.error("[ProfileRepository] Invalid user ID format:", userId);
        return null;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("[ProfileRepository] Supabase fetch by user ID error:", error);
        return null;
      }

      return data as RemoteProfile | null;
    } catch (err) {
      console.error("[ProfileRepository] fetchProfileByUserIdFromSupabase error:", err);
      return null;
    }
  }

  /**
   * Upsert a profile to Supabase backend
   */
  async upsertToSupabase(profile: RemoteProfile): Promise<void> {
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert(profile as any, { onConflict: "id" });

      if (error) {
        console.error("[ProfileRepository] Supabase upsert error:", error);
      }
    } catch (err) {
      console.error("[ProfileRepository] upsertToSupabase error:", err);
    }
  }

  /**
   * Check if a profile has a valid user_id (is not a pure placeholder).
   * A profile is considered "syncable" if it has a user_id, meaning it's
   * either a real profile or a claimed placeholder.
   */
  async isProfileSyncable(profileId: string): Promise<boolean> {
    const profile = await this.getById(profileId);
    if (!profile) return false;
    return profile.user_id !== null;
  }

  /**
   * Check if all given profile IDs are syncable (have user_id).
   * Returns an object with the result and any invalid profile IDs.
   */
  async areProfilesSyncable(profileIds: (string | null)[]): Promise<{
    allSyncable: boolean;
    unsyncableIds: string[];
  }> {
    const unsyncableIds: string[] = [];
    
    for (const id of profileIds) {
      if (id === null) continue;
      const isSyncable = await this.isProfileSyncable(id);
      if (!isSyncable) {
        unsyncableIds.push(id);
      }
    }

    return {
      allSyncable: unsyncableIds.length === 0,
      unsyncableIds,
    };
  }
}
