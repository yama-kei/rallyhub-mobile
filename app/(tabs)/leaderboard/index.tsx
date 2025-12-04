// app/(tabs)/leaderboard/index.tsx

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useAuth } from "@/lib/auth/auth";
import { useLeaderboardStore } from "@/lib/data/hooks/useLeaderboardStore";
import { useLocalProfileLinkStore } from "@/lib/data/hooks/useLocalProfileLinkStore";
import { useProfileStore } from "@/lib/data/hooks/useProfileStore";
import { useVenueStore } from "@/lib/data/hooks/useVenueStore";

export default function LeaderboardScreen() {
  const { session } = useAuth();
  const { venueId: venueIdParam } = useLocalSearchParams<{ venueId?: string }>();
  const { currentLink, loadLink } = useLocalProfileLinkStore();
  const { profiles, loadProfiles } = useProfileStore();
  const { venues, loadVenues } = useVenueStore();
  const { entries, loading, error, fetchLeaderboard } = useLeaderboardStore();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [venuePickerVisible, setVenuePickerVisible] = useState(false);
  const [venueSearch, setVenueSearch] = useState("");

  // Load necessary data on mount
  useEffect(() => {
    loadLink();
    loadProfiles();
    loadVenues();
  }, []);

  // Get the current user's profile and default venue
  const profile = currentLink && profiles.length > 0
    ? profiles.find((p) => p.id === currentLink.profile_id)
    : null;

  const defaultVenue = profile?.default_venue_id
    ? venues.find((v) => v.id === profile.default_venue_id)
    : null;

  // Initialize selected venue from URL param or default venue
  useEffect(() => {
    if (venueIdParam) {
      setSelectedVenueId(venueIdParam);
    } else if (defaultVenue && !selectedVenueId) {
      setSelectedVenueId(defaultVenue.id);
    }
  }, [venueIdParam, defaultVenue?.id]);

  // Get the currently selected venue object
  const selectedVenue = selectedVenueId
    ? venues.find((v) => v.id === selectedVenueId)
    : defaultVenue;

  // Check access conditions
  const isSignedIn = !!session;
  const hasDefaultVenue = !!defaultVenue;
  const canAccessLeaderboard = isSignedIn && hasDefaultVenue;

  // Fetch leaderboard when conditions are met and venue is selected
  useEffect(() => {
    if (canAccessLeaderboard && selectedVenue) {
      fetchLeaderboard(selectedVenue.id, 7);
    }
  }, [canAccessLeaderboard, selectedVenue?.id]);

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    if (!canAccessLeaderboard || !selectedVenue) return;
    setRefreshing(true);
    try {
      await Promise.all([
        loadProfiles(),
        loadVenues(),
        fetchLeaderboard(selectedVenue.id, 7),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [canAccessLeaderboard, selectedVenue?.id, loadProfiles, loadVenues, fetchLeaderboard]);

  // Handle venue selection
  const handleVenueSelect = (venueId: string) => {
    setSelectedVenueId(venueId);
    setVenuePickerVisible(false);
    setVenueSearch("");
    fetchLeaderboard(venueId, 7);
  };

  // Filter venues for picker
  const filteredVenues = venueSearch
    ? venues.filter((v) =>
        v.name.toLowerCase().includes(venueSearch.toLowerCase())
      )
    : venues;

  // Show access restricted message if user cannot access leaderboard
  if (!canAccessLeaderboard) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'left', 'right']}>
        <Text style={styles.restrictedTitle}>Leaderboard Unavailable</Text>
        <Text style={styles.restrictedMessage}>
          Leaderboard is available for users who have signed-in, and have default venue selected
        </Text>
        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Signed in:</Text>
            <Text style={[styles.statusValue, isSignedIn ? styles.statusOk : styles.statusNo]}>
              {isSignedIn ? "Yes" : "No"}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Default venue:</Text>
            <Text style={[styles.statusValue, hasDefaultVenue ? styles.statusOk : styles.statusNo]}>
              {hasDefaultVenue ? defaultVenue?.name : "Not set"}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading leaderboard...</Text>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'left', 'right']}>
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => fetchLeaderboard(selectedVenue?.id ?? null, 7)}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Empty state
  if (entries.length === 0) {
    return (
      <SafeAreaView style={styles.center} edges={['top', 'left', 'right']}>
        <Text style={styles.emptyTitle}>No Activity</Text>
        <Text style={styles.emptySubtitle}>
          No verified matches found at {selectedVenue?.name} in the last 7 days.
        </Text>
        <Text style={styles.emptyHint}>
          Play and verify matches to appear on the leaderboard!
        </Text>
        {/* Venue selector in empty state */}
        <TouchableOpacity
          style={styles.venuePickerButton}
          onPress={() => setVenuePickerVisible(true)}
        >
          <Ionicons name="location-outline" size={18} color="#007AFF" />
          <Text style={styles.venuePickerButtonText}>Change Venue</Text>
          <Ionicons name="chevron-down" size={16} color="#007AFF" />
        </TouchableOpacity>
        {renderVenuePickerModal()}
      </SafeAreaView>
    );
  }

  // Venue picker modal renderer
  function renderVenuePickerModal() {
    return (
      <Modal
        visible={venuePickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setVenuePickerVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Venue</Text>
            <TouchableOpacity
              onPress={() => {
                setVenuePickerVisible(false);
                setVenueSearch("");
              }}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Search venues..."
            value={venueSearch}
            onChangeText={setVenueSearch}
            autoCorrect={false}
          />
          <FlatList
            data={filteredVenues}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.venueOption,
                  item.id === selectedVenueId && styles.venueOptionSelected,
                ]}
                onPress={() => handleVenueSelect(item.id)}
              >
                <View style={styles.venueOptionContent}>
                  <Text style={styles.venueOptionName}>{item.name}</Text>
                  {item.address && (
                    <Text style={styles.venueOptionAddress}>{item.address}</Text>
                  )}
                </View>
                {item.id === selectedVenueId && (
                  <Ionicons name="checkmark" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.venueOptionSeparator} />}
            ListEmptyComponent={
              <Text style={styles.noVenuesText}>No venues found</Text>
            }
          />
        </SafeAreaView>
      </Modal>
    );
  }

  // Render leaderboard
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <TouchableOpacity
          style={styles.venueSelector}
          onPress={() => setVenuePickerVisible(true)}
        >
          <Ionicons name="location-outline" size={16} color="#666" />
          <Text style={styles.venueSelectorText}>{selectedVenue?.name}</Text>
          <Ionicons name="chevron-down" size={14} color="#666" />
        </TouchableOpacity>
        <Text style={styles.subtitle}>Last 7 days</Text>
      </View>

      {renderVenuePickerModal()}

      <FlatList
        data={entries}
        keyExtractor={(item) => item.profile_id}
        renderItem={({ item, index }) => (
          <View style={styles.entryCard}>
            <View style={styles.rankContainer}>
              <Text style={[
                styles.rank,
                index === 0 && styles.rankGold,
                index === 1 && styles.rankSilver,
                index === 2 && styles.rankBronze,
              ]}>
                #{index + 1}
              </Text>
            </View>
            <View style={styles.entryInfo}>
              <Text style={styles.playerName}>{item.display_name}</Text>
              <Text style={styles.matchCount}>
                {item.verified_matches_count} verified {item.verified_matches_count === 1 ? 'match' : 'matches'}
              </Text>
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        alwaysBounceVertical={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  venueSelector: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    alignSelf: "flex-start",
    gap: 6,
  },
  venueSelectorText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  venuePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    gap: 8,
  },
  venuePickerButtonText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  searchInput: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#ddd",
    fontSize: 16,
  },
  venueOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  venueOptionSelected: {
    backgroundColor: "#EFF6FF",
  },
  venueOptionContent: {
    flex: 1,
  },
  venueOptionName: {
    fontSize: 16,
    fontWeight: "500",
  },
  venueOptionAddress: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  venueOptionSeparator: {
    height: 1,
    backgroundColor: "#eee",
    marginHorizontal: 16,
  },
  noVenuesText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
    color: "#666",
  },
  listContent: {
    padding: 16,
  },
  entryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
  },
  rankContainer: {
    width: 50,
    alignItems: "center",
  },
  rank: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  rankGold: {
    color: "#FFD700",
    fontSize: 20,
  },
  rankSilver: {
    color: "#C0C0C0",
    fontSize: 19,
  },
  rankBronze: {
    color: "#CD7F32",
    fontSize: 18,
  },
  entryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerName: {
    fontSize: 16,
    fontWeight: "600",
  },
  matchCount: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  separator: {
    height: 8,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
  },
  emptyHint: {
    fontSize: 14,
    color: "#666",
    marginTop: 16,
    textAlign: "center",
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#dc3545",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  restrictedTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  restrictedMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  statusContainer: {
    marginTop: 24,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    maxWidth: 300,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: "#666",
  },
  statusValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusOk: {
    color: "#28a745",
  },
  statusNo: {
    color: "#dc3545",
  },
});
