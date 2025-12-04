// app/(tabs)/match/[id].tsx

import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth/auth";
import { useLocalProfileLinkStore } from "@/lib/data/hooks/useLocalProfileLinkStore";
import { useMatchStore } from "@/lib/data/hooks/useMatchStore";
import { useProfileStore } from "@/lib/data/hooks/useProfileStore";
import { useVenueStore } from "@/lib/data/hooks/useVenueStore";
import {
  getMatchStatus,
  getMatchStatusColor,
  getMatchStatusLabel,
  matchNeedsUserVerification,
} from "@/lib/data/utils/matchStatus";

import ScoreEditorModal from "@/components/ScoreEditorModal";

export default function MatchDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();

  const { matches, loadMatches, updateMatchScore, deleteMatch, verifyMatch, verifyMatchRemote } = useMatchStore();
  const { profiles, loadProfiles } = useProfileStore();
  const { venues, loadVenues } = useVenueStore();
  const { currentLink, loadLink } = useLocalProfileLinkStore();

  // Modal visibility
  const [editingScore, setEditingScore] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMatches();
    loadProfiles();
    loadVenues();
    loadLink();
  }, []);

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadMatches(), loadProfiles(), loadVenues(), loadLink()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadMatches, loadProfiles, loadVenues, loadLink]);

  const match = matches.find((m) => m.id === id) ?? null;

  // Debug: Log player profiles
  useEffect(() => {
    if (!match || profiles.length === 0) return;

    const playerIds = [
      match.team1_player1,
      match.team1_player2,
      match.team2_player1,
      match.team2_player2,
    ].filter(Boolean) as string[];

    console.log(`[MatchDetail] Debugging match ${match.id}`);
    playerIds.forEach((pid) => {
      const p = profiles.find((profile) => profile.id === pid);
      if (p) {
        console.log(`[MatchDetail] Player ${p.display_name} (${p.id}):`, {
          is_placeholder: p.is_placeholder,
          claimed_by: p.claimed_by,
          user_id: p.user_id,
        });
      } else {
        console.log(`[MatchDetail] Player ${pid}: Not found in local profiles`);
      }
    });
  }, [match, profiles]);

  const getName = (pid: string | null) =>
    pid
      ? profiles.find((p) => p.id === pid)?.display_name || "Unknown Player"
      : "—";

  const renderPlayerName = (pid: string | null) => {
    const name = getName(pid);

    // If no player ID (empty slot), just render the text
    if (!pid) {
      return <Text style={styles.player}>{name}</Text>;
    }

    // Otherwise, make it clickable
    return (
      <TouchableOpacity
        onPress={() => router.push({
          pathname: "/player-detail/[id]",
          params: { id: pid }
        })}
        style={styles.playerTouchable}
      >
        <Text style={styles.player}>{name}</Text>
      </TouchableOpacity>
    );
  };

  const venueName = useMemo(() => {
    if (!match?.venue_id) return "Unknown Venue";
    return venues.find((v) => v.id === match.venue_id)?.name ?? "Unknown Venue";
  }, [match, venues]);

  // Check if current user is a participant in this match
  const isParticipant = useMemo(() => {
    if (!match || !currentLink?.profile_id) return false;
    const profileId = currentLink.profile_id;
    return (
      match.team1_player1 === profileId ||
      match.team1_player2 === profileId ||
      match.team2_player1 === profileId ||
      match.team2_player2 === profileId
    );
  }, [match, currentLink?.profile_id]);

  // Check if current user can verify this match (their team hasn't verified yet)
  const canVerify = useMemo(() => {
    if (!match || !currentLink?.profile_id) return false;
    return matchNeedsUserVerification(match, currentLink.profile_id);
  }, [match, currentLink?.profile_id]);

  // If match is not yet loaded
  if (!match) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading match…</Text>
      </SafeAreaView>
    );
  }

  const team1Won = match.score_team1 > match.score_team2;
  const team2Won = match.score_team2 > match.score_team1;

  // Check if current user is the creator of this match
  const isCreator = currentLink && match.created_by === currentLink.profile_id;

  // Get match status - pass profile ID to show "needs verification" status
  const status = getMatchStatus(match, currentLink?.profile_id);
  const statusLabel = getMatchStatusLabel(status);
  const statusColor = getMatchStatusColor(status);

  // Save score from the modal - auto-verifies the updater's team
  async function handleSaveScore(team1: number, team2: number) {
    if (!match || !currentLink?.profile_id) return;

    // Use updateMatchScore which auto-verifies the updater's team
    await updateMatchScore(match.id, team1, team2, currentLink.profile_id);

    // Refresh the store and close modal
    await loadMatches();
    setEditingScore(false);
  }

  // Handle match verification
  async function handleVerifyMatch() {
    if (!match || !currentLink?.profile_id) return;

    setVerifying(true);
    try {
      // If user is signed in, verify remotely (updates both Supabase and local)
      // Otherwise, verify locally only
      if (session) {
        await verifyMatchRemote(match.id, currentLink.profile_id);
        Alert.alert("Success", "Match has been verified!");
      } else {
        await verifyMatch(match.id, currentLink.profile_id);
        Alert.alert("Success", "Match verified locally. Sign in to sync verification to the server.");
      }
      await loadMatches();
    } catch (error) {
      console.error("[MatchDetail] Error verifying match:", error);
      Alert.alert("Error", "Failed to verify match. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  // Delete match with confirmation
  async function handleDeleteMatch() {
    if (!match) return;

    Alert.alert(
      "Delete Match",
      "Are you sure you want to delete this match? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteMatch(match.id);
            router.back();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.container}
        alwaysBounceVertical={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Verification Needed Banner - shown when user needs to verify */}
        {canVerify && (
          <View style={styles.verificationBanner}>
            <Text style={styles.verificationBannerTitle}>⚠️ Verification Needed</Text>
            <Text style={styles.verificationBannerText}>
              This match result needs your verification. Please review the score and verify if it's correct.
            </Text>
          </View>
        )}

        {/* Scoreboard */}
        <View style={styles.scoreBox}>
          <View style={[styles.team, team1Won && styles.winnerBox]}>
            {renderPlayerName(match.team1_player1)}
            {renderPlayerName(match.team1_player2)}
          </View>

          <View style={styles.scoreMiddle}>
            <Text style={[styles.score, team1Won && styles.winnerScore]}>
              {match.score_team1}
            </Text>
            <Text style={styles.scoreDivider}>—</Text>
            <Text style={[styles.score, team2Won && styles.winnerScore]}>
              {match.score_team2}
            </Text>
          </View>

          <View style={[styles.team, team2Won && styles.winnerBox]}>
            {renderPlayerName(match.team2_player1)}
            {renderPlayerName(match.team2_player2)}
          </View>
        </View>

        {/* Venue */}
        <View style={styles.section}>
          <Text style={styles.label}>Venue</Text>
          <Text style={styles.value}>{venueName}</Text>
        </View>

        {/* Verification Status */}
        <View style={styles.section}>
          <Text style={styles.label}>Status</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusText}>{statusLabel}</Text>
            </View>
          </View>
        </View>

        {/* Timestamp */}
        <View style={styles.section}>
          <Text style={styles.label}>Created At</Text>
          <Text style={styles.value}>
            {new Date(match.created_at).toLocaleString()}
          </Text>
        </View>

        {/* Verify Match Button - shown to participants whose team hasn't verified */}
        {canVerify && (
          <View style={{ marginTop: 24 }}>
            <TouchableOpacity
              style={styles.verifyButton}
              onPress={handleVerifyMatch}
              disabled={verifying}
            >
              {verifying ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify Match Result</Text>
              )}
            </TouchableOpacity>
            <Text style={styles.verifyHint}>
              Confirm that this match result is accurate
            </Text>
          </View>
        )}

        {/* Button to open the modal - hidden for verified matches */}
        {!match.is_verified && (
          <View style={{ marginTop: 24 }}>
            <Button title="Enter / Edit Score" onPress={() => setEditingScore(true)} />
          </View>
        )}

        {/* Delete button - only shown to creator and hidden for verified matches */}
        {isCreator && !match.is_verified && (
          <View style={{ marginTop: 12 }}>
            <Button title="Delete Match" onPress={handleDeleteMatch} color="#dc3545" />
          </View>
        )}
      </ScrollView>

      {/* Score Modal */}
      <ScoreEditorModal
        visible={editingScore}
        initialTeam1={match.score_team1}
        initialTeam2={match.score_team2}
        onClose={() => setEditingScore(false)}
        onSave={handleSaveScore}
      />
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

  scoreBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 24,
    marginBottom: 32,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
  },

  team: {
    flex: 1,
    alignItems: "center",
  },

  player: {
    fontSize: 18,
    fontWeight: "500",
    marginBottom: 2,
  },

  playerTouchable: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
  },

  scoreMiddle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  score: {
    fontSize: 32,
    fontWeight: "900",
  },

  scoreDivider: {
    fontSize: 20,
    opacity: 0.6,
    marginHorizontal: 8,
  },

  winnerBox: {
    backgroundColor: "rgba(40, 167, 69, 0.12)", // light green tint
    borderRadius: 8,
    paddingVertical: 4,
  },

  winnerScore: {
    color: "#28a745",
    fontWeight: "900",
  },

  section: {
    marginBottom: 20,
  },

  label: {
    fontSize: 14,
    color: "#666",
  },

  value: {
    fontSize: 17,
    fontWeight: "500",
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },

  statusText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },

  verificationBanner: {
    backgroundColor: "#fff3cd",
    borderWidth: 1,
    borderColor: "#ffc107",
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },

  verificationBannerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#856404",
    marginBottom: 4,
  },

  verificationBannerText: {
    fontSize: 14,
    color: "#856404",
    lineHeight: 20,
  },

  verifyButton: {
    backgroundColor: "#28a745",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  verifyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  verifyHint: {
    marginTop: 8,
    fontSize: 13,
    color: "#666",
    textAlign: "center",
  },
});
