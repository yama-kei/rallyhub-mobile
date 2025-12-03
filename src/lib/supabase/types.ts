export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string | null;
          display_name: string;
          is_placeholder: boolean;
          placeholder_code: string | null;
          claimed_by: string | null;
          default_venue_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          display_name: string;
          is_placeholder?: boolean;
          placeholder_code?: string | null;
          claimed_by?: string | null;
          default_venue_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };

      local_profile_links: {
        Row: {
          id: string;
          profile_id: string;
          local_id: string;
          device_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          local_id: string;
          device_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["local_profile_links"]["Insert"]>;
      };

      known_users: {
        Row: {
          id: string;
          owner_user_id: string;
          known_profile_id: string;
          created_at: string;

          // Local-only field to track when known user was uploaded to backend
          synced_at?: string | null;
        };
        Insert: {
          id?: string;
          owner_user_id: string;
          known_profile_id: string;
          created_at?: string;

          // Local-only field to track when known user was uploaded to backend
          synced_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["known_users"]["Insert"]>;
      };

      venues: {
        Row: {
          id: string;
          name: string;
          address: string | null;
          geom: unknown | null;
          source: string | null;
          source_id: string | null;
          status: string | null;
          num_courts: number | null;
          surface: string | null;
          indoor: boolean | null;
          lighting: boolean | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address?: string | null;
          geom?: unknown | null;
          source?: string | null;
          source_id?: string | null;
          status?: string | null;
          num_courts?: number | null;
          surface?: string | null;
          indoor?: boolean | null;
          lighting?: boolean | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["venues"]["Insert"]>;
      };

      matches: {
        Row: {
          id: string;
          created_by: string | null;

          team1_player1: string | null;
          team1_player2: string | null;
          team2_player1: string | null;
          team2_player2: string | null;

          score_team1: number;
          score_team2: number;

          // Track who last updated the score
          last_updated_by: string | null;

          // Optimistic locking version for race condition handling
          version: number;

          // Team-specific verification (both teams must verify for match to be fully verified)
          team1_verified_by: string | null;
          team1_verified_at: string | null;
          team2_verified_by: string | null;
          team2_verified_at: string | null;

          // Overall verification status
          is_verified: boolean;
          verified_by: string | null;
          verified_at: string | null;

          fingerprint: string | null;
          venue_id: string | null;

          created_at: string;
          updated_at: string;

          // Local-only field to track when match was uploaded to backend
          synced_at?: string | null;
        };
        Insert: {
          id?: string;
          created_by?: string | null;

          team1_player1?: string | null;
          team1_player2?: string | null;
          team2_player1?: string | null;
          team2_player2?: string | null;

          score_team1: number;
          score_team2: number;

          last_updated_by?: string | null;
          version?: number;

          team1_verified_by?: string | null;
          team1_verified_at?: string | null;
          team2_verified_by?: string | null;
          team2_verified_at?: string | null;

          is_verified?: boolean;
          verified_by?: string | null;
          verified_at?: string | null;

          fingerprint?: string | null;
          venue_id?: string | null;

          created_at?: string;
          updated_at?: string;

          // Local-only field to track when match was uploaded to backend
          synced_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["matches"]["Insert"]>;
      };

      match_verifications: {
        Row: {
          id: string;
          match_id: string;
          profile_id: string;
          verified_at: string;
        };
        Insert: {
          id?: string;
          match_id: string;
          profile_id: string;
          verified_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["match_verifications"]["Insert"]>;
      };

      user_activity: {
        Row: {
          id: string;
          has_account: boolean;
          activity_type: string;
          activity_date: string;
          activity_timestamp: string;
          session_id: string | null;
          device_id: string | null;
          app_version: string | null;
          platform: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          has_account?: boolean;
          activity_type?: string;
          activity_date?: string;
          activity_timestamp?: string;
          session_id?: string | null;
          device_id?: string | null;
          app_version?: string | null;
          platform?: string | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_activity"]["Insert"]>;
      };
    };

    Views: {
      leaderboard_stats: {
        Row: {
          profile_id: string;
          display_name: string;
          verified_matches_played: number | null;
          verified_wins: number | null;
        };
      };
    };

    Functions: {
      rpc_insert_user_activity: {
        Args: {
          p_has_account?: boolean;
          p_activity_type?: string;
          p_session_id?: string | null;
          p_device_id?: string | null;
          p_app_version?: string | null;
          p_platform?: string | null;
          p_metadata?: Record<string, unknown> | null;
        };
        Returns: void;
      };
      rpc_update_match_score: {
        Args: {
          p_match_id: string;
          p_score_team1: number;
          p_score_team2: number;
          p_expected_version: number;
          p_updated_by: string;
        };
        Returns: {
          id: string;
          score_team1: number;
          score_team2: number;
          version: number;
          is_verified: boolean;
          updated_at: string;
        }[];
      };
      rpc_verify_match_for_team: {
        Args: {
          p_match_id: string;
          p_profile_id: string;
        };
        Returns: {
          id: string;
          is_verified: boolean;
          team1_verified_by: string | null;
          team1_verified_at: string | null;
          team2_verified_by: string | null;
          team2_verified_at: string | null;
          verified_at: string | null;
        }[];
      };
    };
    Enums: Record<string, unknown>;
    CompositeTypes: Record<string, unknown>;
  };
}

export type RemoteProfile = Database["public"]["Tables"]["profiles"]["Row"];
export type RemoteMatch = Database["public"]["Tables"]["matches"]["Row"];
export type RemoteVenue = Database["public"]["Tables"]["venues"]["Row"];
export type RemoteLocalProfileLink =
  Database["public"]["Tables"]["local_profile_links"]["Row"];
export type RemoteKnownUser = Database["public"]["Tables"]["known_users"]["Row"];
