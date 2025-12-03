// src/lib/qr/QRPayloadBuilder.ts

import type { RemoteProfile } from "@/lib/supabase/types";

//
// ---------------------------------------------------------------
// QR Payload Types
// ---------------------------------------------------------------
//

// Versioned schema
export const QR_VERSION = 2;

// Expiration window (ms)
export const QR_EXPIRES_IN_MS = 60 * 1000;

export interface RallyHubQRPayload {
  type: "rallyhub:profile";
  version: number;
  profileId: string;
  display_name: string;
  /**
   * Whether the profile is a placeholder (guest) profile.
   * Only real profiles (is_placeholder = false) can be used to claim placeholders.
   */
  is_placeholder: boolean;
  exp: number; // ms timestamp
}

//
// ---------------------------------------------------------------
// Builder
// ---------------------------------------------------------------
export class QRPayloadBuilder {
  /**
   * Build a QR payload for a given profile.
   */
  static buildProfilePayload(profile: RemoteProfile): RallyHubQRPayload {
    const exp = Date.now() + QR_EXPIRES_IN_MS;

    return {
      type: "rallyhub:profile",
      version: QR_VERSION,
      profileId: profile.id,
      display_name: profile.display_name,
      is_placeholder: profile.is_placeholder,
      exp,
    };
  }

  /**
   * Encode a profile → string for QRCode component.
   */
  static encode(profile: RemoteProfile): string {
    const payload = QRPayloadBuilder.buildProfilePayload(profile);
    return JSON.stringify(payload);
  }

  //
  // -------------------------------------------------------------
  // Parsing + Validation
  // -------------------------------------------------------------
  //

  /**
   * Parse raw QR JSON value.
   * Will throw error on anything invalid.
   * @param raw - Raw QR code JSON string
   * @param skipExpirationCheck - If true, skips the expiration check (used in debug mode)
   */
  static parse(raw: string, skipExpirationCheck: boolean = false): RallyHubQRPayload {
    let data: any;

    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("Invalid QR code format (not JSON)");
    }

    // Basic structural validation
    if (data.type !== "rallyhub:profile") {
      throw new Error("Invalid RallyHub QR type");
    }

    if (!data.profileId || typeof data.profileId !== "string") {
      throw new Error("Invalid QR: missing profileId");
    }

    if (!data.display_name || typeof data.display_name !== "string") {
      throw new Error("Invalid QR: missing display_name");
    }

    if (typeof data.version !== "number") {
      throw new Error("Invalid QR: version missing");
    }

    if (typeof data.exp !== "number") {
      throw new Error("Invalid QR: expiration missing");
    }

    // Expiration check (skipped in debug mode)
    if (!skipExpirationCheck && Date.now() > data.exp) {
      throw new Error("QR code expired");
    }

    // For v1 QR codes, is_placeholder defaults to false (backward compatibility)
    if (data.version < 2 && typeof data.is_placeholder !== "boolean") {
      data.is_placeholder = false;
    }

    // For v2+, is_placeholder is required
    if (data.version >= 2 && typeof data.is_placeholder !== "boolean") {
      throw new Error("Invalid QR: missing is_placeholder");
    }

    return data as RallyHubQRPayload;
  }

  //
  // -------------------------------------------------------------
  // Helper
  // -------------------------------------------------------------
  //

  /**
   * Check whether a parsed QR payload belongs to the given profile.
   */
  static matchesProfile(payload: RallyHubQRPayload, profileId: string): boolean {
    return payload.profileId === profileId;
  }

  /**
   * Check if the QR payload represents a real (non-placeholder) profile.
   * Only real profiles can be used to claim placeholder profiles.
   */
  static isRealProfile(payload: RallyHubQRPayload): boolean {
    return !payload.is_placeholder;
  }
}
