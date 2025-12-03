// src/lib/services/profileService.ts
import { supabase } from "@/lib/supabase/supabaseClient";

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error("[getProfile] Error:", error);
    return null;
  }

  return data;
}

export async function updateProfile(userId: string, updates: any) {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ user_id: userId, ...updates });

  if (error) throw error;
  return data;
}
