import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth/auth";
import { useLocalProfileLinkStore } from "@/lib/data/hooks/useLocalProfileLinkStore";
import { useProfileStore } from "@/lib/data/hooks/useProfileStore";
import { MatchService } from "@/lib/data/services/MatchService";
import { ProfileService } from "@/lib/data/services/ProfileService";
import { RemoteMatch, RemoteProfile } from "@/lib/supabase/types";

export default function PlayerProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { session } = useAuth();
  const { profiles, loadProfiles, upsertProfile } = useProfileStore();
  const { currentLink, loadLink } = useLocalProfileLinkStore();

  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchedProfile, setFetchedProfile] = useState<RemoteProfile | null>(null);
  const [verifiedMatches, setVerifiedMatches] = useState<RemoteMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [canViewProfile, setCanViewProfile] = useState(false);

  // Create service instances once - they are stateless
  const profileService = useMemo(() => new ProfileService(), []);
  const matchService = useMemo(() => new MatchService(), []);

  //
  // Load profiles + device link + check access control
  //
  useEffect(() => {
    loadProfiles();
    loadLink();
  }, []);

  //
  // Check access control and load profile data
  //
  useEffect(() => {
    async function loadPlayerData() {
      if (!id) return;

      setLoading(true);

      // First check if profile exists locally
      const localProfile = profiles.find((p) => p.id === id);

      if (localProfile) {
        // Profile exists locally - user has played with this person
        setFetchedProfile(localProfile);
        setCanViewProfile(true);
      } else if (session) {
        // User is signed in - try to fetch from Supabase
        const remoteProfile = await profileService.fetchProfileFromSupabase(id);
        if (remoteProfile) {
          setFetchedProfile(remoteProfile);
          setCanViewProfile(true);
        } else {
          setCanViewProfile(false);
        }
      } else {
        // Guest user trying to view unknown profile
        setCanViewProfile(false);
      }

      setLoading(false);
    }

    loadPlayerData();
  }, [id, profiles, session]);

  //
  // Resolve profile (use fetched profile if available)
  //
  const profile = useMemo(() => {
    return fetchedProfile ?? profiles.find((p) => p.id === id) ?? null;
  }, [fetchedProfile, profiles, id]);

  //
  // Load verified matches for this profile (only if we can view the profile and user is signed in)
  //
  useEffect(() => {
    async function loadMatches() {
      if (!canViewProfile || !profile || !session) return;

      setLoadingMatches(true);
      const matches = await matchService.fetchVerifiedMatchesByProfileId(profile.id);
      setVerifiedMatches(matches);
      setLoadingMatches(false);
    }

    loadMatches();
  }, [canViewProfile, profile, session]);

  //
  // Prepare editing defaults
  //
  useEffect(() => {
    if (profile) {
      setNewName(profile.display_name);
    }
  }, [profile]);

  //
  // Determine if this is the local device's profile
  //
  const isLocalUser = currentLink?.profile_id === id;

  //
  // Save
  //
  async function handleSaveName() {
    if (!profile) return;

    try {
      await upsertProfile({
        id: profile.id,
        display_name: newName.trim() || profile.display_name,
      });

      setEditing(false);
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to update profile.");
    }
  }

  //
  // Loading
  //
  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['bottom', 'left', 'right']}>
        <ActivityIndicator size="large" />
        <Text>Loading player…</Text>
      </SafeAreaView>
    );
  }

  //
  // Access denied
  //
  if (!canViewProfile) {
    return (
      <SafeAreaView style={styles.center} edges={['bottom', 'left', 'right']}>
        <Text style={styles.errorTitle}>Profile Not Available</Text>
        <Text style={styles.errorText}>
          {session
            ? "This profile could not be found."
            : "Sign in to view profiles of players you haven't played with."}
        </Text>
        <View style={{ marginTop: 20 }}>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  //
  // Profile not found
  //
  if (!profile) {
    return (
      <SafeAreaView style={styles.center} edges={['bottom', 'left', 'right']}>
        <ActivityIndicator size="large" />
        <Text>Loading player…</Text>
      </SafeAreaView>
    );
  }

  //
  // Render
  //
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Display Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Display Name</Text>

          {editing ? (
            <>
              <TextInput
                style={styles.input}
                value={newName}
                onChangeText={setNewName}
              />
              <View style={styles.buttonRow}>
                <Button title="Save" onPress={handleSaveName} />
                <Button
                  title="Cancel"
                  onPress={() => setEditing(false)}
                  color="#666"
                />
              </View>
            </>
          ) : (
            <View style={styles.rowBetween}>
              <Text style={styles.value}>{profile.display_name}</Text>

              {/* Editable only for non-local known players that are placeholders */}
              {!isLocalUser && profile.is_placeholder && (
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => setEditing(true)}
                >
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* User Status */}
        <View style={styles.section}>
          <Text style={styles.label}>Status</Text>
          <Text style={styles.value}>
            {profile.user_id
              ? "Registered User"
              : profile.is_placeholder
                ? "Placeholder User"
                : "Known User"}
          </Text>
        </View>

        {/* Claim Guest Profile Button - only shown for placeholder profiles */}
        {profile.is_placeholder && !isLocalUser && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.claimButton}
              onPress={() => router.push({
                pathname: "/claim-guest",
                params: { profileId: profile.id }
              })}
            >
              <Text style={styles.claimButtonText}>Claim This Guest</Text>
            </TouchableOpacity>
            <Text style={styles.claimHint}>
              If this guest has a registered account, you can link their profile here.
            </Text>
          </View>
        )}

        {/* Profile ID */}
        <View style={styles.section}>
          <Text style={styles.label}>Profile ID</Text>
          <Text style={[styles.value, styles.small]}>{profile.id}</Text>
        </View>

        {/* Verified Matches Section - only shown when user is signed in */}
        {session && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Verified Matches</Text>

            {loadingMatches ? (
              <ActivityIndicator size="small" style={{ marginTop: 12 }} />
            ) : verifiedMatches.length > 0 ? (
              <View style={styles.matchesContainer}>
                {verifiedMatches.map((match) => (
                  <TouchableOpacity
                    key={match.id}
                    style={styles.matchRow}
                    onPress={() => router.push({
                      pathname: "/(tabs)/match/[id]",
                      params: { id: match.id }
                    })}
                  >
                    <View style={styles.matchInfo}>
                      <Text style={styles.matchScore}>
                        {match.score_team1} - {match.score_team2}
                      </Text>
                      <Text style={styles.matchDate}>
                        {new Date(match.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyMatches}>No verified matches yet</Text>
            )}
          </View>
        )}

        {/* Notice for Local User */}
        {isLocalUser && (
          <View style={{ marginTop: 40 }}>
            <Text style={{ textAlign: "center", opacity: 0.6 }}>
              This is your own profile.
              Editing name is available in your Profile tab.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

//
// Styles
//
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flexGrow: 1,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 24,
  },

  section: {
    marginBottom: 24,
  },

  label: {
    fontSize: 14,
    color: "#666",
    marginBottom: 6,
  },

  value: {
    fontSize: 18,
    fontWeight: "500",
  },

  small: {
    fontSize: 14,
    color: "#777",
  },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 12,
    fontSize: 16,
  },

  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },

  editBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: "#eee",
    borderRadius: 6,
  },

  editBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },

  errorTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },

  errorText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    paddingHorizontal: 32,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },

  matchesContainer: {
    marginTop: 8,
  },

  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    marginBottom: 8,
  },

  matchInfo: {
    flex: 1,
  },

  matchScore: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },

  matchDate: {
    fontSize: 14,
    color: "#666",
  },

  emptyMatches: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
    marginTop: 8,
  },

  chevron: {
    fontSize: 24,
    color: "#aaa",
    marginLeft: 8,
  },

  claimButton: {
    backgroundColor: "#007aff",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },

  claimButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  claimHint: {
    fontSize: 13,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 18,
  },
});
