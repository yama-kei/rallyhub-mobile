import { supabase } from './supabaseClient';
import { randomUUID } from '@/lib/utils/uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from "expo-application";
import Constants from "expo-constants";
import { Platform } from "react-native";
import type { Database } from './types';
import { featureFlags } from '@/config/featureFlags';

const SESSION_ID_KEY = 'rallyhub_session_id';
const WEB_DEVICE_ID_KEY = 'web_device_id';
const UNKNOWN_DEVICE = 'unknown-device';

type UserActivityParams = Database['public']['Functions']['rpc_insert_user_activity']['Args'];

/**
 * Supported user activity types for analytics tracking.
 */
export type ActivityType =
  | 'app_open'
  | 'game_played'
  | 'game_submitted'
  | 'qr_scan'
  | 'profile_update';

/**
 * Metadata for game-related activity events.
 */
export interface GameActivityMetadata {
  venue_id?: string;
  match_id?: string;
}

export async function emitUserActivity({ 
  hasAccount = false, 
  activityType = 'app_open',
  deviceId, 
  appVersion, 
  platform,
  metadata = {},
}: {
  hasAccount?: boolean;
  activityType?: ActivityType;
  deviceId?: string | null;
  appVersion?: string | null;
  platform?: string | null;
  metadata?: GameActivityMetadata;
}) {
  console.log('[emitUserActivity] Starting user activity emission...', {
    hasAccount,
    activityType,
    hasDeviceId: !!deviceId,
    appVersion,
    platform,
    metadata,
  });

  let sessionId = await AsyncStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = randomUUID();
    await AsyncStorage.setItem(SESSION_ID_KEY, sessionId);
    console.log('[emitUserActivity] Generated new session ID:', sessionId);
  } else {
    console.log('[emitUserActivity] Using existing session ID:', sessionId);
  }

  const params: UserActivityParams = {
    p_has_account: hasAccount,
    p_activity_type: activityType,
    p_session_id: sessionId ?? null,
    p_device_id: deviceId ?? null,
    p_app_version: appVersion ?? null,
    p_platform: platform ?? null,
    p_metadata: metadata as Record<string, unknown>,
  };

  console.log('[emitUserActivity] Calling RPC with params:', params);

  try {
    // Type assertion needed due to Supabase RPC type inference limitations
    // See: https://github.com/supabase/supabase-js/issues/668
    const { data, error } = await supabase.rpc(
      'rpc_insert_user_activity' as never,
      params as never
    );

    if (error) {
      console.error('[emitUserActivity] RPC returned error:', {
        error,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return;
    }

    console.log('[emitUserActivity] ✅ Successfully emitted user activity', { data });
  } catch (err) {
    console.error('[emitUserActivity] Exception while calling RPC:', err);
  }
}

/**
 * Helper function to get device ID based on platform.
 */
async function getDeviceId(): Promise<string> {
  try {
    if (Platform.OS === "web") {
      const webDeviceId = await AsyncStorage.getItem(WEB_DEVICE_ID_KEY);
      if (webDeviceId) {
        return webDeviceId;
      }
      const newWebDeviceId = randomUUID();
      await AsyncStorage.setItem(WEB_DEVICE_ID_KEY, newWebDeviceId);
      return newWebDeviceId;
    } else if (Platform.OS === "android" && typeof Application.getAndroidId === "function") {
      const id = Application.getAndroidId();
      if (id) return id.toString();
    } else if (Platform.OS === "ios" && typeof Application.getIosIdForVendorAsync === "function") {
      const iosId = await Application.getIosIdForVendorAsync();
      if (iosId) return iosId;
    }
  } catch (e) {
    console.warn("[trackUserActivity] Failed to get device ID", e);
  }
  return UNKNOWN_DEVICE;
}

/**
 * Helper function to get app version.
 */
function getAppVersion(): string {
  return Constants.expoConfig?.version || "1.0.0";
}

/**
 * Helper function to check if user has an account (authenticated session).
 */
async function getHasAccount(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session?.user?.id;
  } catch {
    return false;
  }
}

/**
 * Simplified helper to track user activity from anywhere in the app.
 * Automatically retrieves device info, app version, and account status.
 * 
 * Use this for tracking activity events like game_submitted, qr_scan, profile_update.
 * For app_open, use the useUserActivityTracking hook which handles throttling.
 * 
 * @param activityType - The type of activity to track
 * @param metadata - Optional metadata for the activity (e.g., venue_id, match_id)
 */
export async function trackUserActivity(
  activityType: ActivityType,
  metadata: GameActivityMetadata = {}
): Promise<void> {
  // Skip if user activity tracking is disabled
  if (!featureFlags.enableUserActivityTracking) {
    return;
  }

  try {
    const [deviceId, hasAccount] = await Promise.all([
      getDeviceId(),
      getHasAccount(),
    ]);

    await emitUserActivity({
      hasAccount,
      activityType,
      deviceId,
      appVersion: getAppVersion(),
      platform: Platform.OS,
      metadata,
    });
  } catch (error) {
    console.error("[trackUserActivity] Failed to emit activity:", error);
  }
}
