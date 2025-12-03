import { supabase } from './supabaseClient';
import { randomUUID } from '@/lib/utils/uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Database } from './types';

const SESSION_ID_KEY = 'rallyhub_session_id';

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
