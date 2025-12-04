// app/(tabs)/match/index.tsx

import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import MatchCard from "@/components/MatchCard";
import { useAuth } from "@/lib/auth/auth";
import { useDebugModeStore } from "@/lib/data/hooks/useDebugModeStore";
import { useLocalProfileLinkStore } from "@/lib/data/hooks/useLocalProfileLinkStore";
import { useMatchStore } from "@/lib/data/hooks/useMatchStore";
import { matchNeedsUserVerification } from "@/lib/data/utils/matchStatus";

export default function MatchListScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { currentLink, loadLink } = useLocalProfileLinkStore();
  const { matches, loadMatches, loadRemoteMatches, loading } = useMatchStore();
  const [refreshing, setRefreshing] = useState(false);
  const { isDebugMode, loadDebugMode } = useDebugModeStore();

  useEffect(() => {
    loadLink();
    loadDebugMode();
  }, []);

  useEffect(() => {
    // If user is signed in and has a profile, fetch remote matches
    if (session && currentLink?.profile_id) {
      loadRemoteMatches(currentLink.profile_id);
    } else {
      // Otherwise, just load local matches
      loadMatches();
    }
  }, [session, currentLink?.profile_id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (session && currentLink?.profile_id) {
        await loadRemoteMatches(currentLink.profile_id);
      } else {
        await loadMatches();
      }
    } finally {
      setRefreshing(false);
    }
  }, [session, currentLink?.profile_id, loadRemoteMatches, loadMatches]);

  // Count matches that need verification from the current user
  const verificationNeededCount = useMemo(() => {
    if (!currentLink?.profile_id) return 0;
    return matches.filter((m) => matchNeedsUserVerification(m, currentLink.profile_id)).length;
  }, [matches, currentLink?.profile_id]);

  // Sort matches: verification needed first, then by date
  const sorted = useMemo(() => {
    const profileId = currentLink?.profile_id;
    return [...matches].sort((a, b) => {
      // Matches needing verification come first
      const aNeeds = profileId ? matchNeedsUserVerification(a, profileId) : false;
      const bNeeds = profileId ? matchNeedsUserVerification(b, profileId) : false;
      if (aNeeds && !bNeeds) return -1;
      if (!aNeeds && bNeeds) return 1;
      // Then sort by date (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [matches, currentLink?.profile_id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Loading matches…</Text>
      </SafeAreaView>
    );
  }

  if (sorted.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyTitle}>No matches yet</Text>
        <Text style={styles.emptySubtitle}>
          Record games in the “Play” tab to see them here.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <FlatList
        data={sorted}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <MatchCard
            match={item}
            onPress={() => router.push(`/match/${item.id}`)}
          />
        )}
        contentContainerStyle={{ paddingVertical: 16 }}
        alwaysBounceVertical={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          verificationNeededCount > 0 ? (
            <View style={styles.verificationAlert}>
              <Text style={styles.verificationAlertText}>
                ⚠️ {verificationNeededCount === 1 
                  ? "1 match needs your verification" 
                  : `${verificationNeededCount} matches need your verification`}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          isDebugMode ? (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.debugButton}
                onPress={() => {
                  Alert.alert(
                    "Delete All Matches",
                    "Are you sure you want to delete ALL match records from this device? This cannot be undone.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete All",
                        style: "destructive",
                        onPress: async () => {
                          await useMatchStore.getState().deleteAllMatches();
                        },
                      },
                    ]
                  );
                }}
              >
                <Text style={styles.debugButtonText}>Delete All Matches (Debug)</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
  },
  center: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#888",
  },
  verificationAlert: {
    backgroundColor: "#fff3cd",
    borderWidth: 1,
    borderColor: "#ffc107",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  verificationAlertText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#856404",
    textAlign: "center",
  },
  footer: {
    marginTop: 40,
    alignItems: "center",
    paddingBottom: 20,
  },
  debugButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  debugButtonText: {
    fontSize: 12,
    color: "#dc3545",
    fontWeight: "600",
  },
});
