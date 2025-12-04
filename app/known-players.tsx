import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";


import { useLocalProfileLinkStore } from "@/lib/data/hooks/useLocalProfileLinkStore";
import { useProfileStore } from "@/lib/data/hooks/useProfileStore";
import type { RemoteProfile } from "@/lib/supabase/types";
import { getProfileStatus, getProfileStatusLabel } from "@/lib/utils/profileStatus";

export default function KnownPlayersScreen() {
  const router = useRouter();

  const { profiles, loadProfiles } = useProfileStore();
  const { currentLink, loadLink } = useLocalProfileLinkStore();
  const [refreshing, setRefreshing] = useState(false);

  //
  // Load all profiles + the local device link
  //
  useEffect(() => {
    loadProfiles();
    loadLink();
  }, []);

  //
  // Pull-to-refresh handler
  //
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadProfiles(), loadLink()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadProfiles, loadLink]);

  //
  // Identify the local user
  //
  const localProfileId = currentLink?.profile_id;

  //
  // Filter out the local device profile
  //
  const knownPlayers = profiles.filter((p) => p.id !== localProfileId);

  //
  // Sort: real users → placeholders → alphabetical
  //
  knownPlayers.sort((a, b) => {
    if (a.is_placeholder !== b.is_placeholder) {
      return a.is_placeholder ? 1 : -1; // real first
    }
    return a.display_name.localeCompare(b.display_name);
  });

  //
  // Render Single Item
  //
  const renderItem = ({ item }: { item: RemoteProfile }) => {
    const status = getProfileStatus(item);
    const statusLabel = getProfileStatusLabel(status);
    return (
      <TouchableOpacity
        style={styles.playerRow}
        onPress={() => {
          router.push({
            pathname: "/player-detail/[id]",
            params: { id: item.id },
          });
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.playerName}>{item.display_name}</Text>
          <Text style={styles.statusTag}>{statusLabel}</Text>
        </View>

        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  };

  //
  // Render Empty State
  //
  if (knownPlayers.length === 0) {
    return (
      <SafeAreaView style={styles.emptyContainer} edges={['bottom', 'left', 'right']}>
        <Text style={styles.emptyText}>No known players yet.</Text>
        <Text style={styles.emptySub}>
          Scan a player’s QR code to play a game with them.
        </Text>
      </SafeAreaView>
    );
  }

  //
  // Render List
  //
  return (
    <View style={styles.container}>


      <FlatList
        data={knownPlayers}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 40 }}
        alwaysBounceVertical={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}

//
// Styles
//
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },

  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  playerName: {
    fontSize: 18,
    fontWeight: "600",
  },
  statusTag: {
    fontSize: 12,
    color: "#666",
  },
  chevron: {
    fontSize: 28,
    color: "#aaa",
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    paddingTop: 60,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: "#666",
  },
});
