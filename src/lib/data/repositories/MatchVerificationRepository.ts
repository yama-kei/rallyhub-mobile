// src/lib/data/repositories/MatchVerificationRepository.ts

import AsyncStorage from "@react-native-async-storage/async-storage";

export interface RemoteMatchVerification {
  id: string;
  match_id: string;
  profile_id: string;
  verified_at: string;
}

const STORAGE_KEY = "rh:match_verifications";

export interface IMatchVerificationRepository {
  list(): Promise<RemoteMatchVerification[]>;
  getByMatch(matchId: string): Promise<RemoteMatchVerification[]>;
  getByProfile(profileId: string): Promise<RemoteMatchVerification[]>;
  hasVerified(matchId: string, profileId: string): Promise<boolean>;
  save(v: RemoteMatchVerification): Promise<void>;
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
}

export class MatchVerificationRepository
  implements IMatchVerificationRepository
{
  async list(): Promise<RemoteMatchVerification[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as RemoteMatchVerification[];
    } catch (err) {
      console.error("[MatchVerificationRepository] list error:", err);
      return [];
    }
  }

  async getByMatch(matchId: string): Promise<RemoteMatchVerification[]> {
    const all = await this.list();
    return all.filter((v) => v.match_id === matchId);
  }

  async getByProfile(profileId: string): Promise<RemoteMatchVerification[]> {
    const all = await this.list();
    return all.filter((v) => v.profile_id === profileId);
  }

  async hasVerified(matchId: string, profileId: string): Promise<boolean> {
    const all = await this.list();
    return all.some(
      (v) => v.match_id === matchId && v.profile_id === profileId
    );
  }

  async save(v: RemoteMatchVerification): Promise<void> {
    const all = await this.list();
    const idx = all.findIndex((x) => x.id === v.id);

    if (idx >= 0) all[idx] = v;
    else all.push(v);

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
}
