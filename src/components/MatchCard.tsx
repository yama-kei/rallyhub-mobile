// src/components/MatchCard.tsx

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useLocalProfileLinkStore } from "@/lib/data/hooks/useLocalProfileLinkStore";
import { useProfileStore } from "@/lib/data/hooks/useProfileStore";
import {
  getMatchStatus,
  getMatchStatusColor,
  getMatchStatusLabel,
} from "@/lib/data/utils/matchStatus";
import type { RemoteMatch } from "@/lib/supabase/types";

export default function MatchCard({
  match,
  onPress,
}: {
  match: RemoteMatch;
  onPress: () => void;
}) {
  const { profiles } = useProfileStore();
  const { currentLink } = useLocalProfileLinkStore();

  const getName = (pid: string | null) =>
    pid ? profiles.find((p) => p.id === pid)?.display_name || "Unknown" : "—";

  // Pass current user's profile ID to determine if verification is needed from them
  const status = getMatchStatus(match, currentLink?.profile_id);
  const statusLabel = getMatchStatusLabel(status);
  const statusColor = getMatchStatusColor(status);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {getName(match.team1_player1)} / {getName(match.team1_player2)}
            {"  vs  "}
            {getName(match.team2_player1)} / {getName(match.team2_player2)}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
        </View>

        <Text style={styles.score}>
          {match.score_team1} — {match.score_team2}
        </Text>

        <Text style={styles.date}>
          {new Date(match.created_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

//
// Styles
//
const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  score: {
    fontSize: 20,
    fontWeight: "900",
  },
  date: {
    marginTop: 6,
    fontSize: 13,
    color: "#777",
  },
});
