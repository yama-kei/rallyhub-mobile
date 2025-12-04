// src/lib/data/services/LocalProfileLinkService.ts

import { RemoteLocalProfileLink } from "@/lib/supabase/types";
import { randomUUID } from "@/lib/utils/uuid";
import * as Application from "expo-application";
import { Platform } from "react-native";
import { LocalProfileLinkRepository } from "../repositories/LocalProfileLinkRepository";
import { ProfileService } from "./ProfileService";

export interface ILocalProfileLinkService {
  getLinkForDevice(): Promise<RemoteLocalProfileLink | null>;
  ensureLinkForDevice(profileId: string): Promise<RemoteLocalProfileLink>;
  linkProfile(localId: string, profileId: string): Promise<RemoteLocalProfileLink>;
}

export class LocalProfileLinkService implements ILocalProfileLinkService {
  private repo: LocalProfileLinkRepository;
  private profiles: ProfileService;

  constructor(
    repo?: LocalProfileLinkRepository,
    profiles?: ProfileService
  ) {
    this.repo = repo ?? new LocalProfileLinkRepository();
    this.profiles = profiles ?? new ProfileService();
  }

  /**
   * Platform-specific stable device id.
   * - Android: Application.getAndroidId()
   * - iOS: Application.getIosIdForVendorAsync()
   * Falls back to "unknown-device" if unavailable.
   */
  private async getCurrentDeviceId(): Promise<string> {
    try {
      if (Platform.OS === "android" && typeof Application.getAndroidId === "function") {
        const id = Application.getAndroidId();
        if (id) return id.toString();
      }

      if (
        Platform.OS === "ios" &&
        typeof Application.getIosIdForVendorAsync === "function"
      ) {
        const iosId = await Application.getIosIdForVendorAsync();
        if (iosId) return iosId;
      }
    } catch (e) {
      console.warn("[LocalProfileLinkService] getCurrentDeviceId failed", e);
    }

    return "unknown-device";
  }

  /**
   * Get current device → profile mapping
   */
  async getLinkForDevice(): Promise<RemoteLocalProfileLink | null> {
    const deviceId = await this.getCurrentDeviceId();
    return this.repo.getByLocalId(deviceId);
  }

  /**
   * Create or update a link to ensure this device is linked to the specified profile.
   * If a link already exists but points to a different profile, it will be updated.
   */
  async ensureLinkForDevice(profileId: string): Promise<RemoteLocalProfileLink> {
    const deviceId = await this.getCurrentDeviceId();

    // Check if device already has a link
    const existing = await this.repo.getByLocalId(deviceId);
    
    if (existing) {
      // If already linked to the same profile, return existing link
      if (existing.profile_id === profileId) {
        return existing;
      }
      
      // Link exists but points to a different profile - update it
      console.log(`[LocalProfileLinkService] Updating device link from profile ${existing.profile_id} to ${profileId}`);
      const updated: RemoteLocalProfileLink = {
        ...existing,
        profile_id: profileId,
      };
      await this.repo.save(updated);
      return updated;
    }

    // No existing link - create a new one
    const now = new Date().toISOString();
    const link: RemoteLocalProfileLink = {
      id: randomUUID(),
      profile_id: profileId,
      local_id: deviceId,
      device_id: deviceId,
      created_at: now,
    };

    await this.repo.save(link);
    return link;
  }

  /**
   * Assign a remote profile to a given localId (e.g. after QR / login)
   */
  async linkProfile(
    localId: string,
    profileId: string
  ): Promise<RemoteLocalProfileLink> {
    const now = new Date().toISOString();

    const existing = await this.repo.getByLocalId(localId);
    if (existing) {
      const updated: RemoteLocalProfileLink = {
        ...existing,
        profile_id: profileId,
        // created_at stays as original
      };
      await this.repo.save(updated);
      return updated;
    }

    const link: RemoteLocalProfileLink = {
      id: randomUUID(),
      profile_id: profileId,
      local_id: localId,
      device_id: localId,
      created_at: now,
    };

    await this.repo.save(link);
    return link;
  }
}
