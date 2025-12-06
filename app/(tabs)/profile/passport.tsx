import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";

import { appConfig } from "@/config/appConfig";
import { useLocalProfileLinkStore } from "@/lib/data/hooks/useLocalProfileLinkStore";
import { useMatchStore } from "@/lib/data/hooks/useMatchStore";
import { useProfileStore } from "@/lib/data/hooks/useProfileStore";
import { useVenueStore } from "@/lib/data/hooks/useVenueStore";

type PassportStats = {
  gamesCount: number;
  uniquePlayersCount: number;
  venuesCount: number;
};

type KnownPlayer = {
  id: string;
  display_name: string;
  lastPlayedAt: string | null;
  gamesTogether: number;
};

type PlayerVenue = {
  id: string;
  name: string;
  games: number;
  lastPlayedAt: string | null;
};

export default function PlayerPassportScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stores
  const { currentLink, loadLink } = useLocalProfileLinkStore();
  const { profiles, loadProfiles } = useProfileStore();
  const { matches, loadMatches } = useMatchStore();
  const { venues, loadVenues } = useVenueStore();

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadLink(), loadProfiles(), loadMatches(), loadVenues()]);
      } catch (err) {
        setError("Failed to load passport data");
        console.error("[PlayerPassport] Error loading data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Find the profile for this device
  const profile = useMemo(() => {
    if (!currentLink || profiles.length === 0) return null;
    return profiles.find((p) => p.id === currentLink.profile_id) ?? null;
  }, [currentLink, profiles]);

  // Compute user's matches
  const userMatches = useMemo(() => {
    if (!profile) return [];
    return matches.filter(
      (m) =>
        m.team1_player1 === profile.id ||
        m.team1_player2 === profile.id ||
        m.team2_player1 === profile.id ||
        m.team2_player2 === profile.id
    );
  }, [profile, matches]);

  // Derive known players from matches
  const knownPlayers = useMemo((): KnownPlayer[] => {
    if (!profile || userMatches.length === 0) return [];

    const playerMap = new Map<
      string,
      { lastPlayedAt: string | null; gamesTogether: number }
    >();

    userMatches.forEach((m) => {
      const playerIds = [
        m.team1_player1,
        m.team1_player2,
        m.team2_player1,
        m.team2_player2,
      ].filter((pid): pid is string => Boolean(pid) && pid !== profile.id);

      playerIds.forEach((pid) => {
        const existing = playerMap.get(pid);
        if (existing) {
          existing.gamesTogether += 1;
          if (
            !existing.lastPlayedAt ||
            m.created_at > existing.lastPlayedAt
          ) {
            existing.lastPlayedAt = m.created_at;
          }
        } else {
          playerMap.set(pid, {
            lastPlayedAt: m.created_at,
            gamesTogether: 1,
          });
        }
      });
    });

    // Map to known players with profile info
    const result: KnownPlayer[] = [];
    playerMap.forEach((info, playerId) => {
      const playerProfile = profiles.find((p) => p.id === playerId);
      result.push({
        id: playerId,
        display_name: playerProfile?.display_name ?? "Unknown Player",
        lastPlayedAt: info.lastPlayedAt,
        gamesTogether: info.gamesTogether,
      });
    });

    // Sort by games together descending
    return result.sort((a, b) => b.gamesTogether - a.gamesTogether);
  }, [profile, userMatches, profiles]);

  // Derive venues from matches
  const playerVenues = useMemo((): PlayerVenue[] => {
    if (!profile || userMatches.length === 0) return [];

    const venueMap = new Map<
      string,
      { games: number; lastPlayedAt: string | null }
    >();

    userMatches.forEach((m) => {
      if (!m.venue_id) return;

      const existing = venueMap.get(m.venue_id);
      if (existing) {
        existing.games += 1;
        if (!existing.lastPlayedAt || m.created_at > existing.lastPlayedAt) {
          existing.lastPlayedAt = m.created_at;
        }
      } else {
        venueMap.set(m.venue_id, {
          games: 1,
          lastPlayedAt: m.created_at,
        });
      }
    });

    // Map to player venues with venue info
    const result: PlayerVenue[] = [];
    venueMap.forEach((info, venueId) => {
      const venue = venues.find((v) => v.id === venueId);
      result.push({
        id: venueId,
        name: venue?.display_name ?? venue?.name ?? "Unknown Venue",
        games: info.games,
        lastPlayedAt: info.lastPlayedAt,
      });
    });

    // Sort by games descending
    return result.sort((a, b) => b.games - a.games);
  }, [profile, userMatches, venues]);

  // Compute stats
  const stats = useMemo((): PassportStats => {
    return {
      gamesCount: userMatches.length,
      uniquePlayersCount: knownPlayers.length,
      venuesCount: playerVenues.length,
    };
  }, [userMatches, knownPlayers, playerVenues]);

  // Public profile URL for QR
  const publicProfileUrl = profile
    ? `${appConfig.publicProfileBaseUrl}/${profile.id}`
    : null;

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={["top", "left", "right"]}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading your passport...</Text>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.center} edges={["top", "left", "right"]}>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  // No profile state
  if (!profile) {
    return (
      <SafeAreaView style={styles.center} edges={["top", "left", "right"]}>
        <Text style={styles.errorText}>No profile found.</Text>
      </SafeAreaView>
    );
  }

  // Render known player item
  const renderKnownPlayer = ({ item }: { item: KnownPlayer }) => (
    <View style={styles.listItem}>
      <View style={styles.listItemInfo}>
        <Text style={styles.listItemName}>{item.display_name}</Text>
        <Text style={styles.listItemSub}>
          {item.gamesTogether} game{item.gamesTogether !== 1 ? "s" : ""} together
        </Text>
      </View>
      {item.lastPlayedAt && (
        <Text style={styles.listItemDate}>
          {formatDate(item.lastPlayedAt)}
        </Text>
      )}
    </View>
  );

  // Render venue item
  const renderVenue = ({ item }: { item: PlayerVenue }) => (
    <View style={styles.listItem}>
      <View style={styles.listItemInfo}>
        <Text style={styles.listItemName}>{item.name}</Text>
        <Text style={styles.listItemSub}>
          {item.games} game{item.games !== 1 ? "s" : ""} played
        </Text>
      </View>
      {item.lastPlayedAt && (
        <Text style={styles.listItemDate}>{formatDate(item.lastPlayedAt)}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.heading}>Player Passport</Text>
        <Text style={styles.subHeading}>{profile.display_name}</Text>

        {/* QR Code */}
        {publicProfileUrl && (
          <View style={styles.qrBox}>
            <QRCode value={publicProfileUrl} size={120} />
          </View>
        )}

        {/* Stats Summary */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Ionicons name="game-controller-outline" size={24} color="#007AFF" />
            <Text style={styles.statNumber}>{stats.gamesCount}</Text>
            <Text style={styles.statLabel}>Games</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="people-outline" size={24} color="#28a745" />
            <Text style={styles.statNumber}>{stats.uniquePlayersCount}</Text>
            <Text style={styles.statLabel}>Players Met</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="location-outline" size={24} color="#FF9500" />
            <Text style={styles.statNumber}>{stats.venuesCount}</Text>
            <Text style={styles.statLabel}>Venues</Text>
          </View>
        </View>

        {/* Known Players Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="people" size={18} color="#333" /> Players You&apos;ve Met
          </Text>
          {knownPlayers.length === 0 ? (
            <Text style={styles.emptyText}>
              No players met yet. Play some games!
            </Text>
          ) : (
            <View style={styles.listContainer}>
              {knownPlayers.slice(0, 5).map((player) => (
                <View key={player.id}>{renderKnownPlayer({ item: player })}</View>
              ))}
              {knownPlayers.length > 5 && (
                <Text style={styles.moreText}>
                  +{knownPlayers.length - 5} more players
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Venues Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="location" size={18} color="#333" /> Venues Visited
          </Text>
          {playerVenues.length === 0 ? (
            <Text style={styles.emptyText}>No venues visited yet.</Text>
          ) : (
            <View style={styles.listContainer}>
              {playerVenues.slice(0, 5).map((venue) => (
                <View key={venue.id}>{renderVenue({ item: venue })}</View>
              ))}
              {playerVenues.length > 5 && (
                <Text style={styles.moreText}>
                  +{playerVenues.length - 5} more venues
                </Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Helper function to format date
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  errorText: {
    fontSize: 16,
    color: "#dc3545",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 4,
  },
  subHeading: {
    fontSize: 18,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },
  qrBox: {
    alignSelf: "center",
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 20,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 24,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  listContainer: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    overflow: "hidden",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  listItemInfo: {
    flex: 1,
  },
  listItemName: {
    fontSize: 16,
    fontWeight: "500",
  },
  listItemSub: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  listItemDate: {
    fontSize: 12,
    color: "#999",
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
    paddingVertical: 16,
  },
  moreText: {
    fontSize: 14,
    color: "#007AFF",
    padding: 14,
    textAlign: "center",
  },
});
