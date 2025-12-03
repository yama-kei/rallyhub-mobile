// src/lib/data/repositories/LocalProfileLinkRepository.ts

import { RemoteLocalProfileLink } from "@/lib/supabase/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "rh:local_profile_links";

export interface ILocalProfileLinkRepository {
  list(): Promise<RemoteLocalProfileLink[]>;
  getById(id: string): Promise<RemoteLocalProfileLink | null>;
  getByLocalId(localId: string): Promise<RemoteLocalProfileLink | null>;
  getByProfileId(profileId: string): Promise<RemoteLocalProfileLink[]>;
  save(link: RemoteLocalProfileLink): Promise<void>;
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
}

export class LocalProfileLinkRepository implements ILocalProfileLinkRepository {
  async list(): Promise<RemoteLocalProfileLink[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as RemoteLocalProfileLink[];
    } catch (err) {
      console.error("[LocalProfileLinkRepository] list error:", err);
      return [];
    }
  }

  async getById(id: string): Promise<RemoteLocalProfileLink | null> {
    const all = await this.list();
    return all.find((l) => l.id === id) ?? null;
  }

  async getByLocalId(localId: string): Promise<RemoteLocalProfileLink | null> {
    const all = await this.list();
    return all.find((l) => l.local_id === localId) ?? null;
  }

  async getByProfileId(profileId: string): Promise<RemoteLocalProfileLink[]> {
    const all = await this.list();
    return all.filter((l) => l.profile_id === profileId);
  }

  async save(link: RemoteLocalProfileLink): Promise<void> {
    const all = await this.list();
    const idx = all.findIndex((l) => l.id === link.id);

    if (idx >= 0) all[idx] = link;
    else all.push(link);

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  async remove(id: string): Promise<void> {
    const all = await this.list();
    const filtered = all.filter((l) => l.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  }

  async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}
